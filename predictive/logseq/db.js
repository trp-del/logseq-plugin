/* The one place that knows how Logseq DB graphs hold things. It reads the graph into the plain data the core wants
   (core/context.js) and writes through Logseq's own editor calls. The queries are those of logseq-db-refinements
   (parts/model.js), which were checked against Logseq 2.0.2; nothing here names a tag, a property or a page of any
   particular graph. Only ids that Logseq gives every DB graph are used: :logseq.class/Tag, :block/title, :block/tags,
   user.class/ and user.property/ for what you made. */
(function () {
const Flow = (window.Flow ||= {});
const { buildContext, learnEntry } = Flow.context;
const { isLinkProp, isDateProp } = Flow.schema;
const { rateCounter } = Flow.link;

const UUID = Flow.text.UUID;
const isEntityId = id => Number.isSafeInteger(id) && id > 0;
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};
// Readers of a pulled map: keys come back shortened ("db/id" as "id", "block/title" as "title"), sometimes with a colon.
const bare = value => String(value ?? '').replace(/^:/, '');
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const listOf = value => value == null ? [] : Array.isArray(value) ? value : [value];
// A pulled map's values under a property, by its ident, whatever the key's spelling; [] when the property is empty.
function valuesOf(node, ident) {
  for (const key of Object.keys(node || {})) if (bare(key) === ident) return listOf(node[key]).map(idOf).filter(id => id != null);
  return [];
}

/* The schema: the properties you made (and the four of Logseq's that a record takes: Deadline, Scheduled, Status,
   Priority) with type, cardinality, the tags a link accepts and its choices; which tag gives which properties; which tag
   extends which. */
const OWN_PROP = /^(?:user\.property\/|logseq\.property\/(?:deadline|scheduled|status|priority)$)/;
const readProps = async () => (await dsQuery(`[:find (pull ?p [:db/id :db/ident :block/uuid :block/title :logseq.property/type :db/cardinality
      {:logseq.property/classes [:db/id :block/uuid :block/title]}])
    :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`)).map(([p]) => p);
const readChoices = () => dsQuery('[:find ?p (pull ?v [:db/id :block/title :block/order]) :where [?v :block/closed-value-property ?p]]');
const tagIdents = () => dsQuery('[:find ?t ?i :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]]').catch(() => []);
async function loadSchema() {
  const [rows, choices] = await Promise.all([readProps(), readChoices()]);
  const props = [], byId = new Map();
  for (const p of rows) {
    const ident = bare(pick(p, 'db/ident')), title = String(pick(p, 'block/title') ?? '');
    if (!OWN_PROP.test(ident) || !title) continue;
    const classes = listOf(pick(p, 'logseq.property/classes')).map(c => ({ id: idOf(c), uuid: String(pick(c, 'block/uuid') ?? ''), title: String(pick(c, 'block/title') ?? '') }));
    const prop = { id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), ident, title, lower: title.toLowerCase(),
      type: bare(pick(p, 'logseq.property/type')) || 'default', many: bare(pick(p, 'db/cardinality')) === 'db.cardinality/many', classes, choices: [] };
    props.push(prop); byId.set(prop.id, prop);
  }
  for (const [pid, v] of choices) byId.get(pid)?.choices.push({ id: idOf(v), title: String(pick(v, 'block/title') ?? '') });
  const classProps = new Map(), parentsOf = new Map();
  for (const [c, p] of await dsQuery('[:find ?c ?p :where [?c :logseq.property.class/properties ?p]]')) { if (!classProps.has(c)) classProps.set(c, []); classProps.get(c).push(p); }
  for (const [child, parent] of await dsQuery('[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]')) { if (!parentsOf.has(child)) parentsOf.set(child, []); parentsOf.get(child).push(parent); }
  // Logseq's own tags (Root, Page, Task ...): every tag of yours extends Root in the end, so the top of your own chains is
  // the tag just under one of these.
  const builtIn = new Set((await tagIdents()).filter(([, ident]) => !/^:?user\.class\//.test(String(ident))).map(([c]) => Number(c)));
  return { props, byId, classProps, parentsOf, builtIn };
}

// A pulled page as the core sees it: null for Logseq's own hidden pages ($$$...). A second name of another page (an
// alias) says whose: aliasOf { id, title }.
function pageOf(p) {
  const title = String(pick(p, 'block/title') ?? '');
  if (!title || title.startsWith('$$$')) return null;
  const tags = listOf(pick(p, 'block/tags')).map(t => ({ id: idOf(t), title: String(pick(t, 'block/title') ?? ''), ident: bare(pick(t, 'db/ident')) })).filter(t => t.title);
  const [owner] = listOf(pick(p, 'block/_alias'));
  const aliasOf = owner && idOf(owner) != null ? { id: idOf(owner), title: String(pick(owner, 'block/title') ?? '') } : null;
  return { id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), title, lower: title.toLowerCase(), tags, isTag: tags.some(t => t.ident === 'logseq.class/Tag'), aliasOf };
}
const PAGE_RULES = '(not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _]) (not [?p :logseq.property/deleted-at _])';
async function loadPages() {
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title {:block/tags [:db/id :block/title :db/ident]} {:block/_alias [:db/id :block/title]}])
    :where [?p :block/name _] ${PAGE_RULES}]`);
  return rows.map(([p]) => pageOf(p)).filter(Boolean).sort((a, b) => a.lower.localeCompare(b.lower));
}
// The PDFs of the graph, for citing one. A PDF is a node on a page, not a page.
const loadPdfs = async () => (await dsQuery('[:find ?u ?t :where [?a :logseq.property.asset/type "pdf"] [?a :block/uuid ?u] [?a :block/title ?t] (not [?a :logseq.property/deleted-at _])]'))
  .map(([uuid, title]) => ({ uuid: String(uuid), title: String(title), lower: String(title).toLowerCase(), pdf: true }));
// Pages named now (by lower-case name), read fresh: a page made a moment ago counts at once.
async function pagesNamed(names) {
  if (!names.length) return [];
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title {:block/tags [:db/id :block/title :db/ident]} {:block/_alias [:db/id :block/title]}])
    :where [(ground [${names.map(name => JSON.stringify(name)).join(' ')}]) [?n ...]] [?p :block/name ?n] ${PAGE_RULES}]`).catch(() => []);
  return rows.map(([p]) => pageOf(p)).filter(Boolean);
}

/* The bullet being written, as the core wants it. BLOCK_PULL gives the block with its tags and values, its page, its
   parent. text is what the box holds now (the saved title lags a moment behind). */
const PAGE_PULL = '[:db/id :block/uuid :block/title :block/journal-day {:block/tags [:db/id]}]';
const BLOCK_PULL = `[* {:block/tags [:db/id]} {:block/page ${PAGE_PULL}} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]}]}]`;
async function pullBlock(uuid) {
  if (!UUID.test(String(uuid))) return null;
  const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`);
  return b || null;
}
// The same, by the block's id (the engine's entries know ids, not uuids): for measuring Apple's model on earlier notes.
async function pullBlockById(id) {
  if (!Number.isInteger(Number(id))) return null;
  const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [(ground ${Number(id)}) ?b] [?b :block/uuid _]]`);
  return b || null;
}
/* What a value holds, for the entities a property points at: a number's value, a journal page's day. id -> { number, day }. */
async function valueEntities(ids) {
  const list = ids.map(Number).filter(Number.isInteger);
  if (!list.length) return new Map();
  const rows = await dsQuery(`[:find (pull ?v [:db/id :block/journal-day :logseq.property/value]) :where [(ground [${list.join(' ')}]) [?v ...]] [?v :block/uuid _]]`);
  return new Map(rows.map(([v]) => [idOf(v), { number: pick(v, 'logseq.property/value'), day: Number(pick(v, 'block/journal-day') || 0) }]));
}
function valuesMap(node, schema) {
  const values = new Map();
  for (const prop of schema.props) { const ids = valuesOf(node, prop.ident); if (ids.length) values.set(prop.ident, ids); }
  return values;
}
function bulletOf(block, text, schema) {
  const tagsOf = node => listOf(pick(node, 'block/tags')).map(idOf).filter(id => id != null);
  const page = pick(block, 'block/page'), parent = pick(block, 'block/parent');
  return {
    id: idOf(block), uuid: String(pick(block, 'block/uuid') ?? ''), text: String(text ?? pick(block, 'block/title') ?? ''),
    tags: tagsOf(block), values: valuesMap(block, schema),
    page: page ? { id: idOf(page), uuid: String(pick(page, 'block/uuid') ?? ''), title: String(pick(page, 'block/title') ?? ''), day: Number(pick(page, 'block/journal-day') || 0), tags: tagsOf(page) } : null,
    // A parent counts only when it is a block (a page has no page of its own).
    parent: parent && pick(parent, 'block/page') ? { id: idOf(parent), uuid: String(pick(parent, 'block/uuid') ?? ''), tags: tagsOf(parent), values: valuesMap(parent, schema) } : null,
  };
}

/* What the engine learns from: every node under a tag of yours (with the links it holds under the link properties) and
   every plain line. Also the journal days, and for each date property how many nodes under each tag carry the day they
   were written on and how many another day. */
const userTagIds = async () => (await tagIdents()).filter(([, ident]) => /^:?user\.class\//.test(String(ident))).map(([t]) => Number(t));
const NODE_PULL = idents => `[:db/id :block/title {:block/tags [:db/id]} {:block/page [:db/id]} ${idents.map(ident => `{:${ident} [:db/id]}`).join(' ')}]`;
const taggedNodes = (tagIds, idents) => !tagIds.length ? Promise.resolve([]) : dsQuery(`[:find (pull ?b ${NODE_PULL(idents)})
      :where [(ground #{${tagIds.join(' ')}}) [?t ...]] [?b :block/tags ?t] (not [?b :logseq.property/deleted-at _])]`).then(rows => rows.map(([n]) => n));
const nodesById = (ids, idents) => !ids.length ? Promise.resolve([]) : dsQuery(`[:find (pull ?b ${NODE_PULL(idents)})
      :where [(ground #{${ids.join(' ')}}) [?b ...]] [?b :block/uuid _] (not [?b :logseq.property/deleted-at _])]`).then(rows => rows.map(([n]) => n));
const aliasPairs = async () => (await dsQuery('[:find ?o ?a :where [?o :block/alias ?a]]').catch(() => [])).map(([o, a]) => [Number(o), Number(a)]);
// The page Predictive keeps its lessons on (logseq/lessons.js) is not writing of yours: its lines are never learned from.
const LESSONS_PAGE = 'predictive lessons';
const plainLines = async () => (await dsQuery(`[:find ?b ?t :where [?b :block/page ?pg] [?b :block/title ?t] [(not= ?t "")] (not [?b :block/tags _]) (not [?b :logseq.property/deleted-at _]) (not [?pg :block/name "${LESSONS_PAGE}"])]`).catch(() => []))
  .map(([id, title]) => ({ id: Number(id), title: String(title) }));
// The journal days, by page; and each day's own title, which Logseq keeps when the date format changes (the pencil copies it).
const dayTitles = new Map();
const journalDays = async () => {
  const rows = await dsQuery('[:find ?p ?d ?t :where [?p :block/journal-day ?d] [?p :block/title ?t]]').catch(() => []);
  dayTitles.clear();
  for (const [, d, t] of rows) dayTitles.set(Number(d), String(t));
  return new Map(rows.map(([p, d]) => [p, Number(d)]));
};
async function datedByTag(dateIdent) {
  const dated = new Map();
  const rows = await dsQuery(`[:find ?t ?same (count ?b) :where [?b :block/tags ?t] [?b :${dateIdent} ?dp] [?dp :block/journal-day ?d] [?b :block/page ?pg] [?pg :block/journal-day ?pd] [(= ?d ?pd) ?same]]`).catch(() => []);
  for (const [t, same, count] of rows) { const n = dated.get(t) || { same: 0, other: 0 }; n[same ? 'same' : 'other'] += Number(count) || 0; dated.set(t, n); }
  return dated;
}

// numbers: the number properties the node holds a value in (which, not the value), for learning which property a sum of money
// in the words goes to (core/propose.js, money).
const rawEntry = (node, learned, known, numberProps = []) => {
  const tags = listOf(pick(node, 'block/tags')).map(idOf).filter(id => known.has(id));
  return { id: idOf(node), title: String(pick(node, 'block/title') ?? ''), tags, values: new Map(learned.map(p => [p.ident, valuesOf(node, p.ident)]).filter(([, v]) => v.length)),
    numbers: numberProps.filter(p => valuesOf(node, p.ident).length).map(p => p.ident) };
};

// The whole reading: the schema, the pages, the earlier lines, the days. A few hundred milliseconds on a large graph; done in
// the background every few minutes and never while a key is being handled.
async function readContext({ limits = {}, locale, linkRates = true } = {}) {
  const [schema, pages] = await Promise.all([loadSchema(), loadPages()]);
  const learned = schema.props.filter(isLinkProp), numberProps = schema.props.filter(p => p.type === 'number');
  const tagIds = await userTagIds(), known = new Set(tagIds);
  const [nodes, aliases, plain, days] = await Promise.all([taggedNodes(tagIds, [...learned, ...numberProps].map(p => p.ident)).catch(() => []), aliasPairs(), plainLines(), journalDays()]);
  const dated = new Map();
  for (const prop of schema.props.filter(isDateProp)) dated.set(prop.ident, await datedByTag(prop.ident));
  const entries = [...plain.map(({ id, title }) => ({ id, title, tags: [], values: new Map() })), ...nodes.map(n => rawEntry(n, learned, known, numberProps))];
  const ctx = buildContext({ schema, pages, aliases, userTagIds: tagIds, entries, days, dated, limits, locale });
  ctx.learned = learned; ctx.numberProps = numberProps; ctx.readAt = Date.now(); ctx.dayTitles = new Map(dayTitles);
  if (linkRates) ctx.linkLines = await countLinks(pages);
  return ctx;
}
// How often each page's name is linked and written plain, for the suggested links' learning: every block's words once, a
// slice at a time so a key is never held up; the words are kept, so a changed line can be taken back (learnNodes).
const SLICE = 1000;
async function countLinks(pages) {
  const rows = await dsQuery('[:find ?b ?t :where [?b :block/page _] [?b :block/title ?t] [(not= ?t "")] (not [?b :logseq.property/deleted-at _])]').catch(() => []);
  const counter = rateCounter(pages), lines = new Map();
  for (let at = 0; at < rows.length; at += SLICE) {
    for (const [id, title] of rows.slice(at, at + SLICE)) { lines.set(Number(id), String(title)); counter.add(String(title)); }
    await new Promise(resolve => setTimeout(resolve));
  }
  return { counter, lines };
}
function learnLine(ctx, id, title) {
  const { counter, lines } = ctx.linkLines, old = lines.get(id);
  if (old === title) return;
  if (old !== undefined) { counter.add(old, -1); lines.delete(id); }
  if (title) { counter.add(title); lines.set(id, title); }
}
// Nodes changed a moment ago take their new place in what the guesses learn from, so a value filled in counts for the next
// bullet at once instead of at the next full reading.
let lessonsPage = 0;
const lessonsPageId = async () => lessonsPage || (lessonsPage = Number((await dsQuery(`[:find ?p :where [?p :block/name "${LESSONS_PAGE}"]]`).catch(() => []))[0]?.[0] || 0));
async function learnNodes(ctx, ids) {
  const list = [...new Set(ids)].filter(isEntityId);
  if (!ctx?.index || !list.length) return;
  const known = ctx.knownTags, lessonsId = await lessonsPageId();
  const nodes = new Map((await nodesById(list, [...ctx.learned, ...(ctx.numberProps || [])].map(p => p.ident))).map(n => [idOf(n), n]));
  for (const id of list) {
    let node = nodes.get(id);
    if (node && lessonsId && idOf(pick(node, 'block/page')) === lessonsId) node = null;   // a line of the lessons page: not yours, never learned
    if (ctx.linkLines) learnLine(ctx, id, node && pick(node, 'block/page') ? String(pick(node, 'block/title') ?? '') : '');
    if (!node) { learnEntry(ctx, id, null); continue; }
    const raw = rawEntry(node, ctx.learned, known, ctx.numberProps || []), anyTags = listOf(pick(node, 'block/tags')).length;
    // Tagged only with tags that are not yours: not learned from. Plain (no tag at all): learned as a plain line.
    learnEntry(ctx, id, raw.tags.length || !anyTags ? raw : null);
  }
  // The matcher learns the same nodes, a moment later (logseq/meaning.js).
  Flow.meaningAsk?.learnIds?.(ctx, list);
}

// The title of a node's value under a property (a text value is a small block of its own).
const valueTitle = async (uuid, ident) => { const [[title] = []] = await dsQuery(`[:find ?t :where [?r :block/uuid #uuid "${uuid}"] [?r :${ident} ?v] [?v :block/title ?t]]`); return title; };
// What a node holds now, for deciding whether an Undo may take a value away: only what is still as it was filled in.
async function currentIds(uuid, prop) {
  if (prop.type === 'number') return (await dsQuery(`[:find ?n :where [?r :block/uuid #uuid "${uuid}"] [?r :${prop.ident} ?v] [?v :logseq.property/value ?n]]`)).map(([n]) => Number(n));
  return valuesOf(await pullBlock(uuid), prop.ident);
}

/* Journal pages. A day's page by its number (made when it does not exist yet, as Logseq would), and a day's title in the
   format the graph uses (MMM do, yyyy; E, dd.MM.yyyy; yyyyMMdd ...), read once from Logseq's settings. */
async function journalIdFor(day, title) {
  const [[p] = []] = await dsQuery(`[:find (pull ?p [:db/id]) :where [?p :block/journal-day ${day}]]`);
  if (p && idOf(p)) return idOf(p);
  const page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false, journal: true });
  return page?.id ?? null;
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function formatJournalTitle(date, format) {
  const pad = n => String(n).padStart(2, '0');
  const parts = {
    yyyy: date.getFullYear(), yy: pad(date.getFullYear() % 100),
    MMMM: MONTH_NAMES[date.getMonth()], MMM: MONTH_NAMES[date.getMonth()].slice(0, 3), MM: pad(date.getMonth() + 1), M: date.getMonth() + 1,
    do: ordinal(date.getDate()), dd: pad(date.getDate()), d: date.getDate(),
    EEEE: DAY_NAMES[date.getDay()], EEE: DAY_NAMES[date.getDay()].slice(0, 3), E: DAY_NAMES[date.getDay()].slice(0, 3),
  };
  return format.replace(/yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|E/g, token => parts[token]);
}
let journalFormat = null;
const forget = () => { journalFormat = null; };   // each graph has its own
async function journalTitleFor(year, month, day) {
  const journalDay = year * 10000 + month * 100 + day;
  try {
    const [[title] = []] = await dsQuery(`[:find ?t :where [?p :block/journal-day ${journalDay}] [?p :block/title ?t]]`);
    if (title) return String(title);
  } catch (error) { /* no such journal yet: use the format below */ }
  if (!journalFormat) { try { journalFormat = (await logseq.App.getUserConfigs())?.preferredDateFormat || null; } catch (error) { /* default below */ } }
  return formatJournalTitle(new Date(year, month - 1, day), journalFormat || 'MMM do, yyyy');
}
// The journal page of a day, made when the graph has none yet.
const journalPageFor = async day => journalIdFor(day, await journalTitleFor(Math.floor(day / 10000), Math.floor(day / 100) % 100, day % 100));

// A page made for a name (core/people.js), with its tag: { id, uuid, title }. And taken back by Undo, only while nothing has been
// written on it (a page the person has since filled is theirs, and stays).
async function makePage(title, tagUuid) {
  const page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false });
  if (!page?.uuid) throw new Error('the page could not be made');
  if (tagUuid) await logseq.Editor.addBlockTag(page.uuid, tagUuid);
  return { id: page.id, uuid: String(page.uuid), title: String(page.title ?? page.originalName ?? title) };
}
async function dropPage(page) {
  // The door's one check (8 November 2026): no words on it, nothing pointing at it, no value of its own.
  if (!await window.PluginDoor.pageUntouched(page.uuid)) return false;
  await logseq.Editor.deletePage(page.title);
  return true;
}

// THE writes: Logseq's own editor calls, here only.
const setValue = (uuid, ident, value, opts) => logseq.Editor.upsertBlockProperty(uuid, ident, value, opts);
const unsetValue = (uuid, ident) => logseq.Editor.removeBlockProperty(uuid, ident);
const addTag = (uuid, tagUuid) => logseq.Editor.addBlockTag(uuid, tagUuid);
const removeTag = (uuid, tagUuid) => logseq.Editor.removeBlockTag(uuid, tagUuid);
const currentGraph = () => Promise.resolve(logseq.App.getCurrentGraph?.()).catch(() => null);

Flow.db = { forget, dsQuery, bare, pick, idOf, valuesOf, loadSchema, loadPages, loadPdfs, pagesNamed, pullBlock, pullBlockById, valueEntities, bulletOf, readContext, learnNodes,
  currentIds, valueTitle, journalPageFor, makePage, dropPage, setValue, unsetValue, addTag, removeTag, currentGraph };
})();
