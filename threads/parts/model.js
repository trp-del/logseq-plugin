/* Loaded by main.js right after parts/shared.js, before the other parts. Kept in its own scope. */
(() => {
/* The Logseq model (0.4.164): the one place that knows what a page, block, tag, property, journal day and
   link are in a DB graph, so that the parts above read the graph through it instead of each working it out.
   Gathered from main.js (the title helpers, the stored-link form, the version and screen checks), from
   parts/inline-props.js (the property schema, the pages, the fields of a record, the day reader, the journal
   page of a day) and from the old parts/editor.js (the journal title format, stored ids as the titles people see).
   It knows nothing of how anything is drawn; it writes nothing except a journal page a day needs (journalIdFor,
   through Logseq's own Editor.createPage, on behalf of a part that is writing).

   WHAT IT PROVIDES (core.provided):
   - titleOf(block), trailingTags, storedRef                       the words of a block, where its tags sit, how a link is stored
   - readableTitle(text, { pagesOnly, depth, asShown })             stored [[uuid]] and ((uuid)) as the titles people see
   - kindOfPage(pageId)                                              a tag page, a property page, a plain page, aliases
   - tagChain(uuid), tagChains(uuid), tagChainIndex()                a tag and the tags above it, for the title's corner;
                                                                    the same for each tag a page has; every chain at once
   - propSchema(), propPages(), fieldsOf(uuid, schema)              your properties with their types, every page with its
                                                                    tags, the fields a record's tags give it (remembered
                                                                    for the session; read again when the graph changes)
   - parseDay(text, today), dayNumber(d), sameDay(a, b), dayAfter(d, n), DAYS   a day typed in words, and days as numbers
   - journalIdFor(day, title), journalTitleFor(y, m, d), formatJournalTitle(date, format)   journal pages and their titles
   - pageTitles(doc), titleAnchor(doc, title)                      the page titles drawn in the page area, and the row a title sits in
   - CHECKED_WITH, PAGE_TITLE, screenChecks()                       the Logseq version the plugin was checked with, the
                                                                    title selector, and what a drawn page must hold
   - bare(value), pick(node, name), idOf(value)                     readers of a pulled map (keys come back shortened)
   - tagGraph(), propInfo(), ownProps(), inheritedProps(tag)        every tag as a tree with its properties, read fresh
   - tagPropIds, acceptedIds, choicesOf, choiceUse, choiceCounts, choiceNodes, idByUuid, descriptionOf, titleNow,
     valuesOf, userValues, mergeFacts                               what a tag, property, choice or node holds right now
   - propUses()                                                     how many nodes hold each property, in one question (0.4.429)
   - structureUse()                                                 every value, the tags on every node, text words, the pages named
                                                                    in the words: what the map's counts and findings rest on (0.4.448)
   - propNodeIds(ident), choiceIds(prop)                            merging a link or a choice property (0.4.430)
   - crumbsInto(pageId)                                             where each node naming a page sits: its parents (0.4.437)
   - linksInto(pageId), mentionsInto(pageId), nodeFields(uuid),     the nodes pointing at a page through your properties or
     firstLines(uuid, n)                                            naming it in their words (0.4.423),
     nodeValues(uuids), firstTags(ids), nodesOfTag(id), pagesAmong,  a node's own values and first lines, many nodes' values and
     tagUuidNamed, uuidById, nodeLines(ids)                         first tags at once, a tag's nodes, many nodes as lines
   - pagesNamed, blockInEdit, BLOCK_PULL, userTagIds, taggedNodes, nodesById, aliasPairs, plainLines, journalDays, datedByTag,
     valueTitle, numberValues, linkedPages, hasTag, pageLines       what the proposals read while a bullet is written
   - propTextValues, propNamed                                     turning a property into links (0.4.241)
   - propTextBlocks, propValueBlocks                               merging and deleting properties (0.4.422)
   - heldBelow(uuids)                                              what folded nodes hold: open tasks, tags, the nearest due day, files, quotes
   - setValue, unsetValue, addTag, removeTag, setWords, editBlock, exitEditing, insertBlock, addLineTo, currentPage, currentGraph, tagTitles,
     getPage, createPage, deletePage, appendBlock, removeBlock, renamePage, moveBlock, pageBlocksTree, addTagExtends,
     removeTagExtends, openInSidebar, showSidebar, EXTENDS, ALIAS, ICON, PARENT_TAGS
                                                                    THE writes (0.4.315, docs/LAYERS.md layer 1): the one door a
                                                                    part writes the graph through; Logseq's own calls live here only */
const shared = window.refinementShared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (model): ' });
// From the core, taken when the part starts.
let dsQuery, graphWide;
const take = (core, names) => shared.take(core, names, warnOnce);

// The Logseq version whose page structure the plugin was last checked against. Most of what the
// plugin draws depends on names Logseq uses inside its own pages, which can change in any release.
const CHECKED_WITH = '2.0.2';
const PAGE_TITLE = '.ls-page-title, .page-title, h1.title';
// Every page title drawn in the page area (moved from parts/pages.js in 0.4.177).
function pageTitles(doc) {
  return doc.querySelectorAll(`#main-content-container :is(${PAGE_TITLE})`);
}
// Small lines under a page title go below the row the title sits in (beside its icon or buttons),
// not squeezed in next to it.
function titleAnchor(doc, title) {
  let anchor = title;
  const win = doc.defaultView;
  while (anchor.parentElement && anchor.parentElement.id !== 'main-content-container') {
    const cs = win.getComputedStyle(anchor.parentElement);
    if (!cs.display.includes('flex') || cs.flexDirection.startsWith('column')) break;
    anchor = anchor.parentElement;
  }
  return anchor;
}

/* What a drawn page must hold, for the core's self-check after a Logseq update: when the page plainly has a
   thing (blocks, a title, references) but the part the plugin finds inside it is missing, Logseq has most
   likely renamed that part, and the features listed beside it have quietly stopped.
   [what is missing, the page has this (at least min), but none of this, what stops, min] */
const screenChecks = () => [
  ['the page area', '#head', '#main-content-container', 'almost everything the plugin draws', 1],
  ['block text', '#main-content-container .ls-block[blockid]', '#main-content-container .block-title-wrap', 'cues after blocks, block-link dots, reference rows', 2],
  ['the title row', `#main-content-container :is(${PAGE_TITLE})`, '#main-content-container .is-page-title-row', 'tags beside the title, #Page, Add tags', 1],
  ['reference headings', '#main-content-container .references', '#main-content-container .references .ls-foldable-title', 'the Linked references layout, counts and labels', 1],
  ['the sidebar buttons', '#right-sidebar .sidebar-item', '#right-sidebar .cp__right-sidebar-settings', 'sidebar tidy', 1],
];

// The words of a block, and a title without its trailing tags.
const titleOf = block => (block?.title || block?.content || '').trim();
// Drops a leading bullet, every trailing tag (#work, #[[Long tag]]), and the brackets around links.
const trailingTags = /(?:\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+))+\s*$/;
// DB graphs store links as [[uuid]] and block references as ((uuid)). Swap in the titles people see.
// pagesOnly leaves ((uuid)) alone, matching what the block editor shows; asShown also leaves a [[uuid]]
// that points at a block (not a page) alone, because the editor shows such a link as its id.
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
// Every title asked for in one moment goes as one question: a section of 300 mentions reads the links in them at one go.
const titleAsk = { want: new Set(), asked: null };
function titlesOf(uuids) {
  for (const uuid of uuids) titleAsk.want.add(uuid);
  return titleAsk.asked ||= Promise.resolve().then(async () => {
    const list = [...titleAsk.want];
    titleAsk.want.clear(); titleAsk.asked = null;
    const rows = await dsQuery(`[:find ?u ?t ?n :where [(ground [${list.map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?b :block/uuid ?u] [?b :block/title ?t] [(get-else $ ?b :block/name "") ?n]]`).catch(() => []);
    return new Map(rows.map(([u, t, n]) => [String(u).toLowerCase(), { title: String(t ?? '').trim(), isPage: !!n }]));
  });
}
async function readableTitle(text, { pagesOnly = false, depth = 2, asShown = false } = {}) {
  const value = String(text || '');
  const keys = [...new Set([...value.matchAll(storedRef)].filter(([, open]) => !pagesOnly || open !== '((').map(([, , uuid]) => uuid.toLowerCase()))];
  const names = new Map();
  if (keys.length) {
    const found = await titlesOf(keys);
    await Promise.all(keys.map(async key => {
      const entity = found.get(key);
      if (asShown && entity && !entity.isPage) return names.set(key, ''); // a block: shown as its id
      names.set(key, entity?.title && depth > 1 ? await readableTitle(entity.title, { pagesOnly, depth: depth - 1 }) : entity?.title || '');
    }));
  }
  return value.replace(storedRef, (match, open, uuid, close) => {
    const name = names.get(uuid.toLowerCase());
    if (!name || (open === '[[') !== (close === ']]')) return match;
    return open === '[[' ? `[[${name}]]` : name;
  });
}

// Readers of a pulled map: a value comes back with its keys shortened ("db/id" as "id", "block/title" as "title").
const bare = value => String(value ?? '').replace(/^:/, '');
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The schema: your properties (and the four of Logseq's that a record takes: Deadline, Scheduled, Status,
   Priority) with their type, cardinality, class and choices; and which tag has which fields. Remembered for the
   session (graphWide) and read again when the graph has changed. */
const OWN_PROP = /^(?:user\.property\/|logseq\.property\/(?:deadline|scheduled|status|priority)$)/;
// Every property as Logseq holds it, and every choice with the property it belongs to: the one reading of the
// properties, which propSchema, propInfo and ownProps shape each their own way (0.4.224).
const readProps = async () => (await dsQuery(`[:find (pull ?p [:db/id :db/ident :block/uuid :block/title :logseq.property/type :db/cardinality :logseq.property/icon
      {:logseq.property/classes [:db/id :block/uuid :block/title]}
      {:logseq.property/description [:block/title]}])
    :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`)).map(([p]) => p);
const readChoices = () => dsQuery(`[:find ?p (pull ?v [:db/id :block/uuid :block/title :block/order :logseq.property/icon]) :where [?v :block/closed-value-property ?p]]`);
const orderOf = v => String(pick(v, 'block/order') ?? '');
async function loadSchema() {
  const [rows, choices] = await Promise.all([readProps(), readChoices()]);
  const props = [], byId = new Map();
  for (const p of rows) {
    const ident = bare(pick(p, 'db/ident')), title = String(pick(p, 'block/title') ?? '');
    if (!OWN_PROP.test(ident) || !title) continue;
    const classes = (pick(p, 'logseq.property/classes') || []).map(c => ({ id: idOf(c), uuid: String(pick(c, 'block/uuid') ?? ''), title: String(pick(c, 'block/title') ?? '') }));
    const prop = { id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), ident, title, lower: title.toLowerCase(),
      type: bare(pick(p, 'logseq.property/type')) || 'default', many: bare(pick(p, 'db/cardinality')) === 'db.cardinality/many', classes, choices: [], icon: pick(p, 'logseq.property/icon') };
    props.push(prop); byId.set(prop.id, prop);
  }
  for (const [pid, v] of choices) {
    const prop = byId.get(pid);
    if (prop) prop.choices.push({ id: idOf(v), title: String(pick(v, 'block/title') ?? ''), order: orderOf(v), icon: pick(v, 'logseq.property/icon') });
  }
  for (const prop of props) prop.choices.sort((a, b) => a.order.localeCompare(b.order));
  props.sort((a, b) => a.lower.localeCompare(b.lower));
  const classProps = new Map();
  for (const [c, p] of await dsQuery(`[:find ?c ?p :where [?c :logseq.property.class/properties ?p]]`)) { if (!classProps.has(c)) classProps.set(c, []); classProps.get(c).push(p); }
  const parentsOf = new Map();
  for (const [child, parent] of await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`)) { if (!parentsOf.has(child)) parentsOf.set(child, []); parentsOf.get(child).push(parent); }
  // Logseq's own tags (Root, Page, Task, …; 0.4.220): every tag of yours extends Root in the end, so the top of your
  // own chains is the tag just under one of these.
  const builtIn = new Set((await tagIdents()).filter(([, ident]) => !/^:?user\.class\//.test(String(ident))).map(([c]) => idOf(c)));
  return { props, byId, classProps, parentsOf, builtIn };
}
// Pages a page-valued field can point at: every page with its tags (journals left out: a day is a Date's business).
// A pulled page as the parts see it: null for Logseq's own hidden pages ($$$…). A second name of another page (an
// alias) says whose: aliasOf { id, title } (0.4.383; opening it opens that page, and a link to it means that page).
function pageOf(p) {
  const title = String(pick(p, 'block/title') ?? '');
  if (!title || title.startsWith('$$$')) return null;
  const tags = (pick(p, 'block/tags') || []).map(t => ({ id: idOf(t), title: String(pick(t, 'block/title') ?? ''), ident: bare(pick(t, 'db/ident')) })).filter(t => t.title);
  const [owner] = pick(p, 'block/_alias') || [];
  const aliasOf = owner && idOf(owner) != null ? { id: idOf(owner), title: String(pick(owner, 'block/title') ?? '') } : null;
  return { id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), title, lower: title.toLowerCase(), tags, icon: pick(p, 'logseq.property/icon'), isTag: tags.some(t => t.ident === 'logseq.class/Tag'), aliasOf };
}
// Pages in Logseq's Recycle are left out (2026-10-23): Logseq keeps them, findable by name, but they are not there.
async function loadPages() {
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title :logseq.property/icon {:block/tags [:db/id :block/title :db/ident]} {:block/_alias [:db/id :block/title]}])
    :where [?p :block/name _] (not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _]) (not [?p :logseq.property/deleted-at _])]`);
  const pages = rows.map(([p]) => pageOf(p)).filter(Boolean);
  pages.sort((a, b) => a.lower.localeCompare(b.lower));
  return pages;
}
// The same, for pages named now (by their lower-case names), read fresh: a page made a moment ago counts at once.
async function pagesNamed(names) {
  if (!names.length) return [];
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title {:block/tags [:db/id :block/title :db/ident]} {:block/_alias [:db/id :block/title]}])
    :where [(ground [${names.map(name => JSON.stringify(name)).join(' ')}]) [?n ...]] [?p :block/name ?n] (not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _]) (not [?p :logseq.property/deleted-at _])]`).catch(() => []);
  return rows.map(([p]) => pageOf(p)).filter(Boolean);
}

/* What the proposals read (0.4.226, moved here from parts/shadow.js). blockInEdit(uuid): the block with its tags and
   values, its page, its parent and the parent's parent (BLOCK_PULL). The earlier lines the "looks like" engine learns
   from: userTagIds (your own tags, never Logseq's), taggedNodes (every node with one of those tags, pages too since 0.4.239, with its links
   under the given properties), aliasPairs, plainLines (nodes with no tag at all). journalDays: every journal page's day
   by id; datedByTag(dateIdent): for each tag, how many of its nodes dated with that property are dated the day they are
   written on, and how many another day. And what a node holds right now: valueTitle, numberValues, linkedPages, hasTag. */
const PAGE_PULL = '[:db/id :block/uuid :block/title :block/journal-day {:block/tags [:db/id]}]';
const BLOCK_PULL = `[* {:block/tags [:db/id]} {:block/page ${PAGE_PULL}} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]}]}]}]`;
async function blockInEdit(uuid) {
  if (!UUID.test(uuid)) return null;
  const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`);
  return b || null;
}
const tagIdents = () => dsQuery('[:find ?t ?i :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]]').catch(() => []);
const userTagIds = async () => (await tagIdents()).filter(([, ident]) => /^:?user\.class\//.test(String(ident))).map(([t]) => Number(t));
const taggedNodes = (tagIds, idents) => !tagIds.length ? Promise.resolve([]) : dsQuery(`[:find (pull ?b [:db/id :block/title {:block/tags [:db/id]} ${idents.map(ident => `{:${ident} [:db/id]}`).join(' ')}])
      :where [(ground #{${tagIds.join(' ')}}) [?t ...]] [?b :block/tags ?t] (not [?b :logseq.property/deleted-at _])]`).then(rows => rows.map(([n]) => n));
// The same as taggedNodes, for nodes by their ids, whatever their tags, for learning a node just written (0.4.267); a node
// deleted since is not among them.
const nodesById = (ids, idents) => !ids.length ? Promise.resolve([]) : dsQuery(`[:find (pull ?b [:db/id :block/title {:block/tags [:db/id]} ${idents.map(ident => `{:${ident} [:db/id]}`).join(' ')}])
      :where [(ground #{${ids.join(' ')}}) [?b ...]] [?b :block/uuid _] (not [?b :logseq.property/deleted-at _])]`).then(rows => rows.map(([n]) => n));
const aliasPairs = async () => (await dsQuery('[:find ?o ?a :where [?o :block/alias ?a]]').catch(() => [])).map(([o, a]) => [Number(o), Number(a)]);
// The other names of a page: what it is an alias of, its aliases, and theirs. Logseq's Linked references counts a link to any of them.
async function aliasesOf(id) {
  const pairs = await graphWide('inlineAliases', () => dsQuery('[:find ?o ?a :where [?o :block/alias ?a]]'));
  const found = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const [o, a] of pairs) { if (found.has(o) !== found.has(a)) { found.add(o); found.add(a); grew = true; } } }
  found.delete(id);
  return [...found];
}
const plainLines = async () => (await dsQuery('[:find ?b ?t :where [?b :block/page _] [?b :block/title ?t] [(not= ?t "")] (not [?b :block/tags _]) (not [?b :logseq.property/deleted-at _])]').catch(() => []))
  .map(([id, title]) => ({ id: Number(id), title: String(title) }));
const journalDays = async () => new Map((await dsQuery('[:find ?p ?d :where [?p :block/journal-day ?d]]')).map(([p, d]) => [p, Number(d)]));
async function datedByTag(dateIdent) {
  const dated = new Map();
  const rows = dateIdent ? await dsQuery(`[:find ?t ?same (count ?b) :where [?b :block/tags ?t] [?b :${dateIdent} ?dp] [?dp :block/journal-day ?d] [?b :block/page ?pg] [?pg :block/journal-day ?pd] [(= ?d ?pd) ?same]]`).catch(() => []) : [];
  for (const [t, same, count] of rows) { const n = dated.get(t) || { same: 0, other: 0 }; n[same ? 'same' : 'other'] += Number(count) || 0; dated.set(t, n); }
  return dated;
}
// The title of a node's value under a property (a text value is a small block of its own); the numbers it holds;
// the pages its words link, by lower-case title; whether a page has a tag.
const valueTitle = async (uuid, ident) => { const [[title] = []] = await dsQuery(`[:find ?t :where [?r :block/uuid #uuid "${uuid}"] [?r :${ident} ?v] [?v :block/title ?t]]`); return title; };
const numberValues = async (uuid, ident) => (await dsQuery(`[:find ?n :where [?r :block/uuid #uuid "${uuid}"] [?r :${ident} ?v] [?v :logseq.property/value ?n]]`)).map(([n]) => Number(n));
const linkedPages = async uuid => new Map((await dsQuery(`[:find ?p ?u ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/refs ?p] [?p :block/title ?t] [?p :block/uuid ?u]]`))
  .map(([id, pageUuid, title]) => [String(title).toLowerCase(), { id: Number(id), uuid: String(pageUuid), title: String(title) }]));
const hasTag = async (pageUuid, tagUuid) => (await dsQuery(`[:find ?t :where [?p :block/uuid #uuid "${pageUuid}"] [?p :block/tags ?t] [?t :block/uuid #uuid "${tagUuid}"]]`)).length > 0;
// The cache keys are the ones Properties in the line used, so nothing else changes (0.4.164).
const propSchema = () => graphWide('inlinePropsSchema', loadSchema);
const propPages = () => graphWide('inlinePropsPages', loadPages);
// The fields of the block's own tags, own tags first, then what they inherit, without repeats.
async function fieldsOf(uuid, schema) {
  if (!UUID.test(uuid)) return [];
  const tags = (await dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/tags ?t]]`)).map(([t]) => t);
  const seen = new Set(), fields = [], queue = [...tags];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}

// A page fits a link property when one of its tags, or a tag that tag extends, is a tag the property takes.
function fits(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    if (classIds.has(c)) return true;
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return false;
}

/* The tags (0.4.224, moved here from parts/tags.js so that the tag tree reads the graph through the model like the
   other parts). tagGraph() is every tag with its parents, children, own properties, description and node count, read
   fresh each time (the tree reads again at every change), with propInfo beside it: your properties with what they
   hold. inheritedProps and ownProps shape the same. The small readers after them are what the tree checks before and
   after it writes (what a tag's property list, a property's accepted tags, a choice, a description or a value is now). */
const TREE_PROP = /^(user|plugin)\.property/;
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
// Your properties with what they hold: type, one value or many, the tags a link accepts, the choices (by id).
async function propInfo() {
  const [rows, choices] = await Promise.all([readProps(), readChoices()]);
  const props = new Map();
  for (const p of rows) {
    const ident = bare(pick(p, 'db/ident'));
    if (!TREE_PROP.test(ident)) continue;
    props.set(idOf(p), { id: idOf(p), ident, title: String(pick(p, 'block/title') ?? ''), uuid: String(pick(p, 'block/uuid') ?? ''),
      type: bare(pick(p, 'logseq.property/type')) || 'default', many: bare(pick(p, 'db/cardinality')) === 'db.cardinality/many',
      desc: String(pick(pick(p, 'logseq.property/description'), 'block/title') ?? '').trim(),
      accepts: list(pick(p, 'logseq.property/classes')).map(idOf).filter(v => v != null), choices: [] });
  }
  for (const [id, v] of choices.sort((a, b) => orderOf(a[1]).localeCompare(orderOf(b[1])))) props.get(id)?.choices.push(String(pick(v, 'block/title') ?? ''));
  return props;
}
// The graph's own properties (made by you or a plugin), by name, for adding one to a tag.
async function ownProps() {
  return (await readProps()).map(p => ({ ident: bare(pick(p, 'db/ident')), title: String(pick(p, 'block/title') ?? ''), uuid: String(pick(p, 'block/uuid') ?? ''), id: idOf(p), type: bare(pick(p, 'logseq.property/type')) }))
    .filter(p => p.title && TREE_PROP.test(p.ident)).sort(byTitle);
}
async function tagGraph(onPropInfoFailed) {
  const [rows, counts, info] = await Promise.all([
    dsQuery(`[:find (pull ?t [:db/id :block/uuid :block/title :db/ident
                {:logseq.property.class/extends [:db/id]}
                {:logseq.property.class/properties [:db/id :db/ident :block/title :block/uuid]}
                {:logseq.property/description [:block/title]}])
      :where [?t :block/tags :logseq.class/Tag]]`),
    // Each tag's nodes, those in the Recycle left out (0.4.473): count is how many, nodes the ids, so a tag and those under
    // it are counted without a node with two of them counted twice (the map's counts and the tag lists' agree).
    dsQuery(`[:find ?t ?b :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t] ${LIVE}]`),
    propInfo().catch(error => { onPropInfoFailed?.(error); return new Map(); }),
  ]);
  const tags = new Map();
  for (const [node] of rows) {
    const id = idOf(node);
    const ident = bare(pick(node, 'db/ident'));
    if (id == null || ident === 'logseq.class/Root') continue;
    tags.set(id, {
      id, ident,
      uuid: String(pick(node, 'block/uuid') ?? ''),
      title: String(pick(node, 'block/title') ?? ''),
      builtIn: ident.startsWith('logseq.class/'),
      parentIds: list(pick(node, 'logseq.property.class/extends')).map(idOf).filter(v => v != null),
      propList: list(pick(node, 'logseq.property.class/properties')).map(p => ({ ident: bare(pick(p, 'db/ident')), title: String(pick(p, 'block/title') ?? ''), uuid: String(pick(p, 'block/uuid') ?? ''), id: idOf(p) })).filter(p => p.title),
      desc: String(pick(pick(node, 'logseq.property/description'), 'block/title') ?? '').trim(),
      count: 0, nodes: new Set(), parents: [], kids: [],
    });
  }
  for (const [id, b] of counts) if (tags.has(id)) tags.get(id).nodes.add(b);
  for (const tag of tags.values()) tag.count = tag.nodes.size;
  for (const tag of tags.values()) tag.props = tag.propList.map(p => p.title);
  // Parents that are not shown (Logseq's Root tag) leave a tag at the top level.
  for (const tag of tags.values()) {
    tag.parents = tag.parentIds.map(id => tags.get(id)).filter(Boolean);
    for (const parent of tag.parents) parent.kids.push(tag);
  }
  for (const tag of tags.values()) tag.kids.sort(byTitle);
  const byName = new Map([...tags.values()].map(tag => [tag.title.toLowerCase(), tag]));
  // Tags that share a name with another tag (Logseq allows it); they are marked so they can be merged.
  const sameName = new Map();
  for (const tag of tags.values()) if (!tag.builtIn) { const key = tag.title.toLowerCase(); sameName.set(key, [...(sameName.get(key) || []), tag]); }
  for (const [key, group] of sameName) if (group.length < 2) sameName.delete(key);
  // Which tags give each property, and the links that point at each tag (listed on the tag the link
  // names, not again on every tag inside it).
  for (const prop of info.values()) prop.givenBy = [];
  for (const tag of tags.values()) for (const p of tag.propList) info.get(p.id)?.givenBy.push(tag);
  for (const tag of tags.values()) tag.pointers = [];
  for (const prop of info.values()) if (prop.type === 'node') for (const id of prop.accepts) tags.get(id)?.pointers.push(prop);
  return { tags, byName, byTitle, sameName, propInfo: info };
}
// The properties a tag gets from the tags above it (Logseq gives a tag every property of the tags it
// extends), nearest first, each once, with the tag it comes from.
function inheritedProps(tag) {
  const have = new Set(tag.propList.map(p => p.ident));
  const out = [], seen = new Set([tag.id]);
  for (let level = tag.parents.slice(); level.length;) {
    const next = [];
    for (const parent of level) {
      if (seen.has(parent.id)) continue;
      seen.add(parent.id);
      for (const prop of parent.propList) if (!have.has(prop.ident)) { have.add(prop.ident); out.push({ ...prop, from: parent }); }
      next.push(...parent.parents);
    }
    level = next;
  }
  return out;
}
// A tag's own properties, as ids (read as the tag's "Tag properties" value: Logseq 2.0.2's addTagProperty refuses every tag).
const TAG_PROPS = 'logseq.property.class/properties';
const tagPropIds = async tag => (await dsQuery(`[:find ?p :where [?t :block/uuid #uuid "${tag.uuid}"] [?t :${TAG_PROPS} ?p]]`)).map(([id]) => id);
// The tags a link property accepts ("Specify node tags"), as ids.
const ACCEPTS = 'logseq.property/classes';
const acceptedIds = async prop => (await dsQuery(`[:find ?c :where [?p :block/uuid #uuid "${prop.uuid}"] [?p :${ACCEPTS} ?c]]`)).map(([id]) => id);
// A property's choices: each a small block that belongs to the property, in their order.
async function choicesOf(prop) {
  const rows = await dsQuery(`[:find (pull ?v [:block/uuid :block/title :block/order]) :where [?p :block/uuid #uuid "${prop.uuid}"] [?v :block/closed-value-property ?p]]`);
  return rows.map(([v]) => ({ uuid: String(pick(v, 'block/uuid') ?? ''), title: String(pick(v, 'block/title') ?? ''), order: orderOf(v) }))
    .sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
}
// How many nodes hold a choice; and, for a tag, how many of its nodes hold each choice (by the choice's uuid).
const choiceUse = async (prop, choice) => (await dsQuery(`[:find (count ?b) :where [?v :block/uuid #uuid "${choice.uuid}"] [?b :${prop.ident} ?v]]`))[0]?.[0] || 0;
async function choiceCounts(tag, prop) {
  const counts = await dsQuery(`[:find ?u (count ?b) :where [?t :block/uuid #uuid "${tag.uuid}"] [?v :block/closed-value-property ?p] [?p :block/uuid #uuid "${prop.uuid}"] [?b :block/tags ?t] [?b :${prop.ident} ?v] [?v :block/uuid ?u]]`);
  return new Map(counts.map(([u, n]) => [String(u), n]));
}
// The nodes of a tag that hold a choice, as uuids; and the choice's id.
const choiceNodes = async (tag, prop, choice) => (await dsQuery(`[:find ?u :where [?t :block/uuid #uuid "${tag.uuid}"] [?v :block/uuid #uuid "${choice.uuid}"] [?b :block/tags ?t] [?b :${prop.ident} ?v] [?b :block/uuid ?u]]`)).map(([u]) => String(u));
// Turning a property into links (0.4.241): every node holding it, with the words of each value (a text value is a small
// block of its own, a choice has its title); and your own property of a name and kind, once Logseq has made it.
const propTextValues = async ident => (await dsQuery(`[:find ?u ?vt :where [?b :${ident} ?v] [?b :block/uuid ?u] [?v :block/title ?vt] (not [?b :logseq.property/deleted-at _])]`))
  .map(([u, t]) => ({ uuid: String(u), value: String(t).trim() })).filter(r => r.value);
// The same with each value's own block (0.4.422, merging text properties): a value is changed by changing its words.
const propTextBlocks = async ident => (await dsQuery(`[:find ?u ?vu ?vt :where [?b :${ident} ?v] [?b :block/uuid ?u] [?v :block/uuid ?vu] [?v :block/title ?vt] (not [?b :logseq.property/deleted-at _])]`))
  .map(([u, vu, t]) => ({ uuid: String(u), valueUuid: String(vu), value: String(t).trim() }));
// Every value block a property made (a text or a number is a small block of its own): Logseq deleting the property leaves
// them on their pages as loose blocks (seen 2026-10-25), so they are removed first.
const propValueBlocks = async ident => (await dsQuery(`[:find ?u :where [?p :db/ident :${ident}] [?v :logseq.property/created-from-property ?p] [?v :block/uuid ?u] (not [?v :block/closed-value-property _])]`)).map(([u]) => String(u));
async function propNamed(title, type) {
  const rows = await dsQuery(`[:find ?p ?u ?i ?c :where [?p :block/title ${JSON.stringify(title)}] [?p :block/tags :logseq.class/Property] [?p :logseq.property/type :${type}] [?p :db/ident ?i] [?p :block/uuid ?u] [?p :db/cardinality ?c] (not [?p :logseq.property/deleted-at _])]`);
  const user = rows.filter(([, , i]) => /^:?user\.property\//.test(String(i)));
  if (!user.length) return null;
  const [p, u, i, c] = user[user.length - 1];
  return { id: Number(p), uuid: String(u), ident: bare(i), title, type, many: /many/.test(String(c)) };
}
const idByUuid = async uuid => (await dsQuery(`[:find ?v :where [?v :block/uuid #uuid "${uuid}"]]`))[0]?.[0];
// A tag's description, and a node's title, as they are now.
const DESCRIPTION = 'logseq.property/description';
const descriptionOf = async tag => String((await dsQuery(`[:find ?t :where [?p :block/uuid #uuid "${tag.uuid}"] [?p :${DESCRIPTION} ?d] [?d :block/title ?t]]`))[0]?.[0] || '');
const titleNow = async uuid => { const [[title] = []] = await dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?t]]`); return title == null ? null : String(title); };
// A node's values of one property (ids for links, else the values), and the names of your properties it holds.
const valuesOf = async (uuid, ident) => (await dsQuery(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${ident} ?v]]`)).map(([v]) => idOf(v) ?? v);
const userValues = async uuid => (await dsQuery(`[:find ?a :where [?b :block/uuid #uuid "${uuid}"] [?b ?a _] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property]]`))
  .map(([a]) => bare(a)).filter(a => TREE_PROP.test(a));
// How many nodes hold a property at all (the property map's "on 12 nodes", 0.4.305).
const propUse = async ident => Number((await dsQuery(`[:find (count ?b) :where [?b :${ident} _] (not [?b :logseq.property/deleted-at _])]`))[0]?.[0]) || 0;
// Merging a link or a choice property (0.4.430): every node holding it with the ids of its values; a property's choices
// by their words, with their ids.
async function propNodeIds(ident) {
  const rows = await dsQuery(`[:find ?u ?v :where [?b :${ident} ?v] [?b :block/uuid ?u] (not [?b :logseq.property/deleted-at _])]`);
  const nodes = new Map();
  for (const [u, v] of rows) { const id = idOf(v) ?? v; if (!Number.isSafeInteger(id)) continue; const key = String(u); nodes.set(key, [...nodes.get(key) || [], id]); }
  return nodes;
}
async function choiceIds(prop) {
  const rows = await dsQuery(`[:find ?v ?t :where [?p :block/uuid #uuid "${prop.uuid}"] [?v :block/closed-value-property ?p] [?v :block/title ?t]]`);
  return new Map(rows.map(([v, title]) => [idOf(v) ?? v, String(title)]));
}
// Every property of yours with how many nodes hold it, in one question (0.4.429, the tag map's tables): a property no
// node holds is left out, so it reads as 0.
async function propUses() {
  const rows = await dsQuery('[:find ?a (count ?b) :where [?p :logseq.property/type _] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b ?a _] (not [?b :logseq.property/deleted-at _])]');
  return new Map(rows.map(([ident, n]) => [bare(ident), Number(n) || 0]));
}
// The nodes that hold a property, newest day first, each with its words and the words of its values (a page's or
// choice's title, a day's title, a number, yes or no): the property map's Nodes line (0.4.307, the owner: "show the
// nodes that have the properties").
async function propHolders(ident) {
  const where = `[?b :${ident} ?v] [?b :block/uuid ?u] [?b :block/title ?t] (not [?b :logseq.property/deleted-at _]) (not-join [?b] [?b :block/page ?pg] [?pg :logseq.property/deleted-at _])`;
  const [raw, titled, numbered, written] = await Promise.all([
    dsQuery(`[:find ?u ?t ?v :where ${where}]`),
    dsQuery(`[:find ?u ?v ?vt :where ${where} [?v :block/title ?vt]]`),
    dsQuery(`[:find ?u ?v ?n :where ${where} [?v :logseq.property/value ?n]]`),
    dsQuery(`[:find ?u ?day :where ${where} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
  ]);
  const nodes = new Map(), known = new Set();
  const node = (u, t) => { const key = String(u); if (!nodes.has(key)) nodes.set(key, { uuid: key, title: String(t ?? ''), values: [], day: 0 }); return nodes.get(key); };
  for (const [u, t] of raw) node(u, t);
  for (const [u, v, vt] of titled) { known.add(`${u}|${v}`); node(u).values.push(String(vt)); }
  for (const [u, v, n] of numbered) { if (known.has(`${u}|${v}`)) continue; known.add(`${u}|${v}`); node(u).values.push(String(n)); }
  for (const [u, , v] of raw) if (typeof v === 'boolean') node(u).values.push(v ? 'yes' : 'no');
  for (const [u, day] of written) { const n = nodes.get(String(u)); if (n) n.day = Number(day) || 0; }
  // Links in the words read as their names, resolved in one question for all the nodes at once (hundreds of nodes
  // would otherwise be hundreds of look-ups), and brackets taken off.
  const names = await namesOfRefs([...nodes.values()].flatMap(n => [n.title, ...n.values]));
  const plain = text => String(text).replace(storedRef, (m, open, uuid) => names.get(uuid.toLowerCase()) ?? m).replace(/\[\[([^\]]*)\]\]/g, '$1').trim();
  for (const n of nodes.values()) { n.title = plain(n.title); n.values = n.values.map(plain); }
  return [...nodes.values()].sort((a, b) => b.day - a.day || a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
}
// The titles of the pages and blocks that some texts link, by uuid, in one question (two rounds: a title can link on).
async function namesOfRefs(texts, depth = 2) {
  const names = new Map();
  let pending = texts;
  for (let round = 0; round < depth && pending.length; round++) {
    const uuids = [...new Set(pending.flatMap(t => [...String(t || '').matchAll(storedRef)].map(m => m[2].toLowerCase())))].filter(u => !names.has(u));
    if (!uuids.length) break;
    const rows = await dsQuery(`[:find ?u ?t :where [(ground [${uuids.map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?b :block/uuid ?u] [?b :block/title ?t]]`).catch(() => []);
    for (const [u, t] of rows) names.set(String(u).toLowerCase(), String(t ?? ''));
    pending = rows.map(([, t]) => String(t ?? ''));
  }
  // A name that links on reads as its own words too.
  for (const [u, t] of names) names.set(u, t.replace(storedRef, (m, open, uuid) => names.get(uuid.toLowerCase()) ?? m));
  return names;
}
// Everything that points at a tag or sits on its page, for merging it into another: the nodes tagged with it, the
// nodes whose words link it, the property values that point at it, the blocks on its page in order, the values set
// on its own page, and which properties the other tag's page already has.
async function mergeFacts(source, target) {
  const S = source.id;
  const [tagged, refs, propRefs, pageBlocks, ownValues, targetValues] = await Promise.all([
    dsQuery(`[:find ?u :where [?b :block/tags ${S}] [?b :block/uuid ?u]]`),
    dsQuery(`[:find ?u ?t :where [?b :block/refs ${S}] [?b :block/uuid ?u] [?b :block/title ?t]]`),
    // Only your own properties are looked at (binding the property first keeps this quick).
    dsQuery(`[:find ?u ?a :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?a] [?b ?a ${S}] [?b :block/uuid ?u]]`),
    dsQuery(`[:find ?u ?o :where [?b :block/parent ${S}] [?b :block/page ${S}] [?b :block/uuid ?u] [?b :block/order ?o] (not [?b :logseq.property/created-from-property])]`),
    // Values set on each tag's own page: aliases, the icon, and your own properties.
    dsQuery(`[:find ?a ?v :where [${S} ?a ?v] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property]]`),
    dsQuery(`[:find ?a :where [${target.id} ?a _] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property]]`),
  ]);
  return {
    tagged: tagged.map(([u]) => String(u)),
    refs: refs.map(([uuid, title]) => ({ uuid: String(uuid), title: String(title ?? '') })),
    propRefs: propRefs.map(([uuid, a]) => ({ uuid: String(uuid), attr: bare(a) })),
    pageBlocks: pageBlocks.sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([u]) => String(u)),
    ownValues: ownValues.map(([a, v]) => [bare(a), idOf(v) ?? v]),
    targetAttrs: new Set(targetValues.map(([a]) => bare(a))),
  };
}

/* Links into pages (0.4.225, moved here from parts/two-way.js). linksInto(id) is every node that points at the page
   (every page but journals when id is null) through a property of yours, with the property's name and ident, the
   node's words as stored, its first tag of yours by name, and its day: a Date property of yours (the one titled Date
   first, whatever its ident, else the earliest), else the journal day it is written on. Deleted nodes and nodes on deleted pages are left
   out, and a page's own blocks do not count as pointing at it. nodeFields(uuid) is what a node's own properties of
   yours hold, by name, each value a day, a title or plain text; firstLines(uuid, n) its first children's words. */
const LIVE = '(not [?b :logseq.property/deleted-at]) (not-join [?b] [?b :block/page ?pg] [?pg :logseq.property/deleted-at])';
const USER_PROP = /^:?user\.property\//;
async function linksInto(id) {
  // One round of questions (0.4.150): each is asked about the blocks that point here through a property of yours,
  // rather than waiting for that list first, since every wait right after a page change is long. For every page the
  // properties come first, so the database walks only their values (0.4.182).
  const fields = '[?prop :db/ident ?attr] [(namespace ?attr) ?pns] [(= ?pns "user.property")]';
  const these = id == null
    ? `${fields} [?b ?attr ?page] [?page :block/name] (not [?page :block/journal-day]) [(not= ?b ?page)] (not [?b :block/page ?page]) ${LIVE}`
    : `[(identity ${id}) ?page] [?b ?attr ?page] ${fields} [(not= ?b ?page)] (not [?b :block/page ?page]) ${LIVE}`;
  // Plain finds (a pull here was refused by Logseq's query call: "Extra inputs passed").
  const [links, titled, tagged, dated, written] = await Promise.all([
    dsQuery(`[:find ?page ?pu ?b ?attr ?name ?fu :where ${these} [?prop :block/title ?name] [?page :block/uuid ?pu] [?prop :block/uuid ?fu]]`),
    dsQuery(`[:find ?b ?uuid ?title :where ${these} [?b :block/uuid ?uuid] [?b :block/title ?title]]`),
    dsQuery(`[:find ?b ?tag :where ${these} [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/title ?tag]]`),
    dsQuery(`[:find ?b ?dattr ?day ?dname :where ${these} [?dprop :logseq.property/type :date] [?dprop :db/ident ?dattr] [?dprop :block/title ?dname] [?b ?dattr ?d] [?d :block/journal-day ?day]]`),
    dsQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
  ]);
  const isId = v => Number.isSafeInteger(v) && v > 0;
  const pages = new Map(), fieldsByName = new Map(), ids = new Set();
  for (const [page, pageUuid, b, attr, name, fieldUuid] of links) {
    // Only properties you made; built-in links such as tags, aliases and parents are left out.
    if (!isId(b) || !name || !USER_PROP.test(String(attr))) continue;
    const field = fieldsByName.get(name) || { uuid: '', ident: bare(attr) };
    if (fieldUuid) field.uuid = String(fieldUuid);
    fieldsByName.set(name, field);
    if (!pages.has(page)) pages.set(page, { uuid: String(pageUuid || ''), byField: new Map() });
    const byField = pages.get(page).byField;
    if (!byField.has(name)) byField.set(name, new Set());
    byField.get(name).add(b);
    ids.add(b);
  }
  const records = new Map();
  if (!ids.size) return { pages, fields: fieldsByName, records };
  const days = new Map();
  for (const [b, attr, day, name] of dated) {
    if (!/^user\.property\//.test(bare(attr))) continue;
    const rank = String(name).trim().toLowerCase() === 'date' ? 0 : 1, had = days.get(b);
    if (!had || rank < had.rank || (rank === had.rank && day < had.day)) days.set(b, { rank, day });
  }
  for (const [b, day] of written) if (!days.has(b)) days.set(b, { rank: 2, day });
  const tags = new Map();
  for (const [b, tag] of tagged) if (!tags.has(b) || tag < tags.get(b)) tags.set(b, tag);
  for (const [b, uuid, title] of titled) if (isId(b)) records.set(b, { uuid: String(uuid), title: title || '', tag: tags.get(b) || '', day: days.get(b)?.day || 0 });
  return { pages, fields: fieldsByName, records };
}
/* Mentions (0.4.423, the owner's pick A from docs/history/TWO-WAY-POTENTIALS-2026-10-25.html): the nodes whose own words
   link the page, [[its uuid]] in their stored words, as linksInto describes its nodes (uuid, words, first tag of yours,
   day). A tag written in the words (#[[…]]) is no mention, a page's own blocks do not count, deleted ones are left out.
   Whether a node also points here through a property is the caller's to say. One page only, never every page. */
async function mentionsInto(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return [];
  const ids = [id, ...await aliasesOf(id)];
  const these = `[(ground [${ids.join(' ')}]) [?page ...]] [?b :block/refs ?page] ${ids.map(one => `[(not= ?b ${one})] (not [?b :block/page ${one}])`).join(' ')} [?b :block/page _] ${LIVE}`;
  const [titled, tagged, dated, written, uuids] = await Promise.all([
    dsQuery(`[:find ?b ?uuid ?title :where ${these} [?b :block/uuid ?uuid] [?b :block/title ?title]]`),
    dsQuery(`[:find ?b ?tag :where ${these} [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/title ?tag]]`),
    dsQuery(`[:find ?b ?dattr ?day ?dname :where ${these} [?dprop :logseq.property/type :date] [?dprop :db/ident ?dattr] [?dprop :block/title ?dname] [?b ?dattr ?d] [?d :block/journal-day ?day]]`),
    dsQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
    dsQuery(`[:find ?pu :where [(ground [${ids.join(' ')}]) [?page ...]] [?page :block/uuid ?pu]]`),
  ]);
  const links = uuids.map(([uuid]) => `[[${String(uuid).toLowerCase()}]]`);
  if (!links.length) return [];
  const days = new Map();
  for (const [b, attr, day, name] of dated) {
    if (!/^user\.property\//.test(bare(attr))) continue;
    const rank = String(name).trim().toLowerCase() === 'date' ? 0 : 1, had = days.get(b);
    if (!had || rank < had.rank || (rank === had.rank && day < had.day)) days.set(b, { rank, day });
  }
  for (const [b, day] of written) if (!days.has(b)) days.set(b, { rank: 2, day });
  const tags = new Map();
  for (const [b, tag] of tagged) if (!tags.has(b) || tag < tags.get(b)) tags.set(b, tag);
  const out = [];
  for (const [b, uuid, title] of titled) {
    const words = String(title || '').toLowerCase();
    // In the words, and not only as a tag: some [[link]] that has no # before it.
    let said = false;
    for (const link of links) { let at = words.indexOf(link); while (at >= 0 && !said) { if (words[at - 1] !== '#') said = true; at = words.indexOf(link, at + 1); } }
    if (said) out.push({ id: b, uuid: String(uuid), title: String(title || ''), tag: tags.get(b) || '', day: days.get(b)?.day || 0 });
  }
  return out;
}
/* What the structure is used for (0.4.448, docs/MAP-DESIGN.md 4): the evidence the tag map's counts and findings rest
   on, for the whole graph, in four questions asked at once. values: property ident -> [[node, value]] (a value is the id
   of a node, a page, a choice or a text block, or a number); tagsOf: node -> [ids of your tags on it]; texts: text block
   id -> its words; named: node -> Set of the pages it names in its words (its property values, its tags, its own page,
   journal days and Logseq's own pages left out). Deleted ones are left out. One reading for the whole map, kept by the
   caller and asked again on a change; never on the way to drawing. */
async function structureUse() {
  const user = '[?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")]';
  const [values, tagged, texts, refs] = await Promise.all([
    dsQuery(`[:find ?b ?a ?v :where ${user} [?b ?a ?v] ${LIVE}]`),
    dsQuery(`[:find ?b ?t :where [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?tns] [(= ?tns "user.class")] ${LIVE}]`),
    dsQuery(`[:find ?v ?w :where [?p :logseq.property/type :default] ${user} [?b ?a ?v] [?v :block/title ?w] ${LIVE}]`),
    dsQuery(`[:find ?b ?pg :where [?b :block/refs ?pg] [?pg :block/name] (not [?pg :db/ident]) (not [?pg :block/journal-day]) [?b :block/page _] (not [?b :block/page ?pg]) ${LIVE}]`),
  ]);
  const out = { values: new Map(), tagsOf: new Map(), texts: new Map(), named: new Map() };
  const held = new Set();
  for (const [b, a, v] of values) {
    const ident = bare(a);
    if (!USER_PROP.test(ident)) continue;
    if (!out.values.has(ident)) out.values.set(ident, []);
    out.values.get(ident).push([b, v]);
    held.add(`${b} ${v}`);
  }
  for (const [b, t] of tagged) { if (!out.tagsOf.has(b)) out.tagsOf.set(b, []); out.tagsOf.get(b).push(t); }
  for (const [v, w] of texts) out.texts.set(v, String(w ?? ''));
  for (const [b, pg] of refs) {
    if (held.has(`${b} ${pg}`)) continue;
    if (!out.named.has(b)) out.named.set(b, new Set());
    out.named.get(b).add(pg);
  }
  return out;
}
/* Where each node that names a page sits (0.4.437, the two-way section taking over Linked references, which shows a
   mention under its page and parent bullets): for every block that links the page, its parents from the page down,
   each { uuid, title } (titles as stored). Five levels at most, each one question. */
async function crumbsInto(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return new Map();
  const out = new Map();
  for (let k = 1; k <= 5; k++) {
    const chain = Array.from({ length: k }, (_, i) => `[${i ? '?x' + i : '?b'} :block/parent ?x${i + 1}]`).join(' ');
    const rows = await dsQuery(`[:find ?bu ?xu ?xt :where [(identity ${id}) ?page] [?b :block/refs ?page] [?b :block/uuid ?bu] ${chain} [?x${k} :block/uuid ?xu] [?x${k} :block/title ?xt]]`).catch(() => []);
    if (!rows.length) break;
    for (const [bu, xu, xt] of rows) { const key = String(bu); if (!out.has(key)) out.set(key, []); out.get(key).unshift({ uuid: String(xu), title: String(xt || '') }); }
  }
  return out;
}
// The nodes that carry one tag (0.4.445, the tag map's Nodes count): [{ id, uuid, title, day }], the journal day each is
// written on, newest first; deleted ones left out.
async function nodesOfTag(tagId) {
  if (!Number.isSafeInteger(tagId) || tagId <= 0) return [];
  const these = `[?b :block/tags ${tagId}] ${LIVE}`;
  const [titled, written] = await Promise.all([
    dsQuery(`[:find ?b ?u ?t :where ${these} [?b :block/uuid ?u] [?b :block/title ?t]]`),
    dsQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`)]);
  const days = new Map(written);
  const words = await namedIn(titled.map(([, , t]) => t));
  return titled.map(([b, u, t]) => ({ id: b, uuid: String(u), title: words(t), day: days.get(b) || 0 })).sort((a, b) => b.day - a.day || a.title.localeCompare(b.title));
}
// The words of many titles as people read them, in one question: a stored link [[uuid]] becomes the name it points at.
async function namedIn(titles) {
  const ids = new Set();
  for (const t of titles) for (const [, , uuid] of String(t || '').matchAll(storedRef)) ids.add(uuid.toLowerCase());
  const names = new Map(ids.size ? (await dsQuery(`[:find ?u ?t :where [(ground [${[...ids].map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?e :block/uuid ?u] [?e :block/title ?t]]`).catch(() => []))
    .map(([u, t]) => [String(u).toLowerCase(), String(t || '')]) : []);
  return t => String(t || '').replace(storedRef, (match, open, uuid) => names.get(uuid.toLowerCase()) ?? match).replace(/\[\[([^\]]*)\]\]/g, '$1').trim();
}
/* Many nodes as lines (0.4.457, the map's counts opening their nodes): id -> { id, uuid, title, day }, the title as
   people read it, the journal day it is written on (0 for a page). A value node gives its words too: a text value its
   title, a number its value, a day its journal day's title. Deleted ones left out. */
async function nodeLines(ids) {
  const list = [...new Set((ids || []).filter(id => Number.isSafeInteger(id) && id > 0))];
  const out = new Map();
  if (!list.length) return out;
  const these = `[(ground [${list.join(' ')}]) [?b ...]] [?b :block/uuid ?u] (not [?b :logseq.property/deleted-at _])`;
  const [titled, numbered, written] = await Promise.all([
    dsQuery(`[:find ?b ?u ?t :where ${these} [?b :block/title ?t]]`),
    dsQuery(`[:find ?b ?u ?n :where ${these} [?b :logseq.property/value ?n]]`).catch(() => []),
    dsQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`).catch(() => [])]);
  const days = new Map(written);
  const words = await namedIn(titled.map(([, , t]) => t));
  for (const [b, u, n] of numbered) out.set(b, { id: b, uuid: String(u), title: String(n ?? ''), day: days.get(b) || 0 });
  for (const [b, u, t] of titled) out.set(b, { id: b, uuid: String(u), title: words(t), day: days.get(b) || 0 });
  return out;
}
// The first tag of yours on each of these nodes, by id (0.4.442, the tag after every node in the two-way section's
// digging): id -> tag title, the first by name, as linksInto gives a node's tag.
async function firstTags(ids) {
  const list = [...new Set((ids || []).filter(id => Number.isSafeInteger(id) && id > 0))];
  if (!list.length) return new Map();
  const rows = await dsQuery(`[:find ?b ?tag :where [(ground [${list.join(' ')}]) [?b ...]] [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/title ?tag]]`);
  const out = new Map();
  for (const [b, tag] of rows) if (!out.has(b) || tag < out.get(b)) out.set(b, String(tag));
  return out;
}
async function nodeFields(uuid) {
  const where = `[?b :block/uuid #uuid "${uuid}"] [?b ?attr ?v] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")] [?prop :block/title ?name]`;
  // Each value with its node's uuid, and each property's own page (fields.props, name -> uuid), so a card can open
  // them (0.4.262, the owner: "make the different links and elements of the hover clickable").
  const [raw, titled, dated] = await Promise.all([
    dsQuery(`[:find ?name ?v ?pu :where ${where} [?prop :block/uuid ?pu]]`),
    dsQuery(`[:find ?name ?v ?t ?vu :where ${where} [?v :block/title ?t] [?v :block/uuid ?vu]]`),
    dsQuery(`[:find ?name ?v ?d ?vu :where ${where} [?v :block/journal-day ?d] [?v :block/uuid ?vu]]`),
  ]);
  const fields = new Map(), known = new Set();
  fields.props = new Map(raw.map(([name, , pu]) => [name, String(pu)]));
  const add = (name, value) => { if (!fields.has(name)) fields.set(name, []); fields.get(name).push(value); };
  for (const [name, v, day, vu] of dated) { known.add(`${name}|${v}`); add(name, { day, uuid: String(vu) }); }
  for (const [name, v, title, vu] of titled) { if (known.has(`${name}|${v}`)) continue; known.add(`${name}|${v}`); add(name, { title: String(title), uuid: String(vu) }); }
  for (const [name, v] of raw) if (!known.has(`${name}|${v}`) && !(typeof v === 'number' && Number.isSafeInteger(v) && v > 0)) add(name, { text: String(v) });
  return fields;
}
async function firstLines(uuid, n, withIds = false) {
  const entity = await logseq.Editor.getBlock(uuid, { includeChildren: true });
  const children = entity?.name || entity?.originalName ? await logseq.Editor.getPageBlocksTree(uuid) : entity?.children;
  // withIds (0.4.262): { uuid, title } each, so a card can open the bullet a line is.
  return (children || []).slice(0, n).map(child => withIds ? { uuid: String(child?.uuid || ''), title: titleOf(child) } : titleOf(child));
}
/* What many nodes hold under each of your properties, at once (0.4.369, for grouping a row, parts/two-way.js):
   uuid -> property name -> { ident, values }, each value { text } with { id, uuid } when it is a node or a choice (a
   text value is a node of its own in Logseq, so it has an id too), { day, id } for a day, and for a number or a yes/no
   { text, number } or { text, boolean }: Logseq keeps those in a small value node of their own, the number in its
   logseq.property/value (seen in the app, 2026-10-24: Severity on a symptom log); a Date-and-time is a timestamp on the node
   itself, { day, time }. A node holding nothing of yours has no entry. logseqs: Logseq's four as well (Deadline, Scheduled, Status,
   Priority), for a node opened in a row, which lists them; a list's grouping and what tells its rows apart stay with yours. */
const STAMP = 100000000000;   // a ref is a small entity id, a timestamp is past this
async function nodeValues(uuids, { logseqs = false } = {}) {
  const list = [...new Set((uuids || []).map(String))].filter(u => UUID.test(u));
  const out = new Map();
  if (!list.length) return out;
  const mine = '[(namespace ?attr) ?ns] [(= ?ns "user.property")]';
  const whose = logseqs ? `(or-join [?attr] (and ${mine}) [(contains? #{:logseq.property/deadline :logseq.property/scheduled :logseq.property/status :logseq.property/priority} ?attr)])` : mine;
  const where = `[(ground [${list.map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?b :block/uuid ?u] [?b ?attr ?v] [?prop :db/ident ?attr] ${whose} [?prop :block/title ?name]`;
  const [raw, titled, dated, typed] = await Promise.all([
    dsQuery(`[:find ?u ?name ?attr ?v :where ${where}]`),
    dsQuery(`[:find ?u ?name ?attr ?v ?t ?vu :where ${where} [?v :block/title ?t] [?v :block/uuid ?vu]]`),
    dsQuery(`[:find ?u ?name ?attr ?v ?d :where ${where} [?v :block/journal-day ?d]]`),
    dsQuery(`[:find ?u ?name ?attr ?v ?n :where ${where} [?v :logseq.property/value ?n]]`),
  ]);
  const known = new Set();
  const slot = (u, name, attr) => {
    const id = String(u);
    if (!out.has(id)) out.set(id, new Map());
    const held = out.get(id);
    if (!held.has(name)) held.set(name, { ident: bare(attr), values: [] });
    return held.get(name).values;
  };
  const once = (u, name, v) => { const key = `${u}|${name}|${v}`; if (known.has(key)) return false; known.add(key); return true; };
  for (const [u, name, attr, v, d] of dated) if (once(u, name, v)) slot(u, name, attr).push({ day: Number(d), id: v });
  for (const [u, name, attr, v, t, vu] of titled) if (once(u, name, v)) slot(u, name, attr).push({ text: String(t), id: v, uuid: String(vu) });
  for (const [u, name, attr, v, n] of typed) if (once(u, name, v)) slot(u, name, attr).push(typeof n === 'boolean' ? { text: n ? 'yes' : 'no', boolean: n } : typeof n === 'number' ? { text: String(n), number: n } : { text: String(n) });
  for (const [u, name, attr, v] of raw) {
    if (typeof v === 'string' && once(u, name, v)) slot(u, name, attr).push({ text: v });
    else if (typeof v === 'number' && v > STAMP && once(u, name, v)) slot(u, name, attr).push({ day: dayNumber(new Date(v)), time: v });
  }
  return out;
}
// The words of the bullets written straight on a page, for the page's own proposals (0.4.239); a property's text value
// is not one (it has a property of its own pointing at it).
const pageLines = async uuid => !UUID.test(uuid) ? [] : (await dsQuery(`[:find ?t :where [?p :block/uuid #uuid "${uuid}"] [?b :block/parent ?p] [?b :block/page ?p] [?b :block/title ?t] (not [?b :logseq.property/created-from-property _])]`).catch(() => [])).map(([t]) => String(t));
// How many of these nodes are pages; the uuid of the tag of yours with this name; a node's uuid by its id.
const pagesAmong = async (uuids, uuidsIn) => (await dsQuery(`[:find ?u :where ${uuidsIn('?u', uuids)} [?b :block/uuid ?u] [?b :block/name _]]`)).length;
const tagUuidNamed = async title => String((await dsQuery(`[:find ?u :where [?t :block/tags :logseq.class/Tag] [?t :block/title ${JSON.stringify(title)}] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/uuid ?u]]`))[0]?.[0] || '');
const uuidById = async id => { const [[u] = []] = await dsQuery(`[:find ?u :where [(identity ${id}) ?p] [?p :block/uuid ?u]]`); return u ? String(u) : ''; };

/* Days. A value typed for a Date: today, tomorrow, yesterday, a weekday (the next one after today), "next" and a
   weekday (a week later), +3 or -2 (days from today), 2026-10-23, 23 oct, oct 23 (this year, or next year when
   that day has passed). */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dayAfter = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; };
// A date only when the day exists: 30 February or 31 September is no day (0.4.168: they used to roll over into the
// next month, so "31 sep" read as 1 October).
const exactDay = (year, month, day) => { const d = new Date(year, month, day); return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null; };
const weekdayIndex = word => DAYS.findIndex(d => d.startsWith(word) && word.length >= 2);
function parseDay(text, today) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (t === 'today') return today;
  if (t === 'tomorrow' || t === 'tmr') return dayAfter(today, 1);
  if (t === 'yesterday') return dayAfter(today, -1);
  let m = t.match(/^([+-])(\d{1,3})$/);
  if (m) return dayAfter(today, (m[1] === '-' ? -1 : 1) * Number(m[2]));
  m = t.match(/^(next\s+)?([a-z]{2,9})$/);
  if (m) {
    const wd = weekdayIndex(m[2]);
    if (wd >= 0) { let n = (wd - today.getDay() + 7) % 7 || 7; if (m[1]) n += 7; return dayAfter(today, n); }
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return exactDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/) || t.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m) {
    const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const month = MONTHS.findIndex(name => name.startsWith(b));
    if (month < 0) return null;
    let date = exactDay(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(a));
    if (!m[3] && date && date < today) date = exactDay(today.getFullYear() + 1, month, Number(a));
    return date;
  }
  return null;
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/* Journal pages. A day's page by its number (made when it does not exist yet, as Logseq would), and a day's title
   in the format the graph uses (MMM do, yyyy; E, dd.MM.yyyy; yyyyMMdd ...), read once from Logseq's settings. */
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
const journalFormat = { value: null };
async function journalTitleFor(year, month, day) {
  const journalDay = year * 10000 + month * 100 + day;
  try {
    const [[title] = []] = await dsQuery(`[:find ?t :where [?p :block/journal-day ${journalDay}] [?p :block/title ?t]]`);
    if (title) return String(title);
  } catch (error) { /* no such journal yet: use the format below */ }
  if (!journalFormat.value) {
    try { journalFormat.value = (await logseq.App.getUserConfigs())?.preferredDateFormat || null; } catch (error) { /* default below */ }
  }
  return formatJournalTitle(new Date(year, month - 1, day), journalFormat.value || 'MMM do, yyyy');
}

/* What kind of page a page is (0.4.170, moved from parts/pages.js): a tag page, a property page, an ordinary page with
   no tag of its own (plain), and the pages it is an alias of, as [uuid, title] by title. Logseq records an alias only on
   the original page, so it is looked up from the alias's side. Both asked together: right after a page change each
   answer waits behind Logseq loading the page (0.4.150). */
async function kindOfPage(pageId) {
  if (!Number.isSafeInteger(pageId) || pageId <= 0) return { isTag: false, isProperty: false, plain: false, aliasOf: [] };
  const [rows, originals] = await Promise.all([
    dsQuery(`[:find ?ident
      :where [(identity ${pageId}) ?p] [?p :block/tags ?c] [?c :db/ident ?ident]]`),
    dsQuery(`[:find ?uuid ?title
      :where [(identity ${pageId}) ?p] [?o :block/alias ?p] [?o :block/uuid ?uuid] [?o :block/title ?title]]`),
  ]);
  const idents = new Set(rows.map(row => bare(row[0])));
  return {
    isTag: idents.has('logseq.class/Tag'),
    isProperty: idents.has('logseq.class/Property'),
    plain: idents.size === 1 && idents.has('logseq.class/Page'),
    aliasOf: originals.filter(row => UUID.test(String(row[0]))).map(row => [String(row[0]), String(row[1])]).sort((a, b) => a[1].localeCompare(b[1])),
  };
}

/* Where a tag sits (0.4.328): the tag with this uuid and the tags above it, nearest first, following at each step the
   first parent by title, and the tag's other direct parents; null when the page is not a tag. Logseq's Root, which every
   tag without a parent of yours sits under, is left out, so a top-level tag's chain is the tag alone.
   tagChains(uuid) (0.4.329) gives the same for the page itself (own, when it is a tag) and for each tag it has (tags),
   leaving out Logseq's kinds of page (Page, Journal, Tag, Property, Whiteboard), which say what a page is, not a tag. */
const PAGE_KINDS = new Set(['logseq.class/Page', 'logseq.class/Journal', 'logseq.class/Tag', 'logseq.class/Property', 'logseq.class/Whiteboard']);
async function tagIndex() {
  const [rows, links] = await Promise.all([
    dsQuery(`[:find ?t ?u ?title ?ident :where [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title] [?t :db/ident ?ident]]`),
    dsQuery(`[:find ?c ?p :where [?c :${EXTENDS} ?p]]`),
  ]);
  const byId = new Map(rows.map(([id, u, title, ident]) => [id, { uuid: String(u), title: String(title), ident: bare(ident) }]));
  const parents = new Map();
  for (const [child, parent] of links) {
    if (byId.get(parent)?.ident === 'logseq.class/Root' || !byId.has(parent)) continue;
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child).push(parent);
  }
  for (const list of parents.values()) list.sort((a, b) => byId.get(a).title.localeCompare(byId.get(b).title));
  return { byId, parents };
}
function chainOf({ byId, parents }, id) {
  const shown = ({ uuid, title }) => ({ uuid, title });
  const chain = [shown(byId.get(id))], seen = new Set([id]);
  for (let at = id; ;) {
    const next = (parents.get(at) || []).find(p => !seen.has(p));
    if (next == null) break;
    seen.add(next);
    chain.push(shown(byId.get(next)));
    at = next;
  }
  return { chain, others: (parents.get(id) || []).slice(1).map(p => shown(byId.get(p))) };
}
// The index as a thing a part keeps (0.4.331): the chain of any tag by its uuid, with no wait, so the title's corner can be
// drawn in the same frame as the title. Read again when the graph changes.
async function tagChainIndex() {
  const index = await tagIndex();
  const idByUuid = new Map([...index.byId].map(([id, tag]) => [tag.uuid, id]));
  return {
    byUuid: uuid => { const id = idByUuid.get(String(uuid || '')); return id == null ? null : chainOf(index, id); },
    isPageKind: uuid => { const id = idByUuid.get(String(uuid || '')); return id != null && PAGE_KINDS.has(index.byId.get(id).ident); },
  };
}
async function tagChains(uuid) {
  if (!UUID.test(String(uuid || ''))) return null;
  const [index, own] = await Promise.all([tagIndex(), dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/tags ?t]]`)]);
  const me = [...index.byId].find(([, tag]) => tag.uuid === String(uuid));
  const tags = own.map(([id]) => id).filter(id => index.byId.has(id) && !PAGE_KINDS.has(index.byId.get(id).ident))
    .sort((a, b) => index.byId.get(a).title.localeCompare(index.byId.get(b).title));
  return { own: me ? chainOf(index, me[0]) : null, tags: tags.map(id => chainOf(index, id)) };
}
const tagChain = async uuid => (await tagChains(uuid))?.own || null;
/* THE writes (0.4.315): every write a part makes to the graph goes through here, so Logseq's own calls live in one
   place. A property's value (an entity id with { entityId: true }, several with { reset: true }), a value taken off,
   a tag given or taken from a node, a block's words, a block put in edit or left, a block made after or inside
   another, the page and the graph open now. */
const setValue = (uuid, ident, value, opts) => logseq.Editor.upsertBlockProperty(uuid, ident, value, opts);
const unsetValue = (uuid, ident) => logseq.Editor.removeBlockProperty(uuid, ident);
const addTag = (uuid, tagUuid) => logseq.Editor.addBlockTag(uuid, tagUuid);
const removeTag = (uuid, tagUuid) => logseq.Editor.removeBlockTag(uuid, tagUuid);
const setWords = (uuid, text) => logseq.Editor.updateBlock(uuid, text);
const editBlock = (uuid, opts) => logseq.Editor.editBlock(uuid, opts);
const exitEditing = () => logseq.Editor.exitEditingMode();
const insertBlock = (uuid, text, opts) => logseq.Editor.insertBlock(uuid, text, opts);
/* A new last bullet inside a node (0.4.369, "write into a node without leaving", parts/two-way.js): at the end of a
   page's blocks, after the last child of a block, or as a block's first child when it has none. Not put in edit.
   Returns the new block, which removeBlock takes away again. */
async function addLineTo(uuid, text) {
  const entity = await logseq.Editor.getBlock(uuid, { includeChildren: true });
  if (!entity) throw new Error('the node was not found');
  if (entity.name || entity.originalName) return logseq.Editor.appendBlockInPage(uuid, text);
  const last = (entity.children || []).filter(child => child && child.uuid).slice(-1)[0];
  return last ? logseq.Editor.insertBlock(String(last.uuid), text, { sibling: true, focus: false }) : logseq.Editor.insertBlock(uuid, text, { sibling: false, focus: false });
}
const currentPage = () => logseq.Editor.getCurrentPage();
// The block being written in, the blocks picked, and a block by its id (with its parent and page), for a command (0.4.357).
const currentBlock = () => Promise.resolve(logseq.Editor.getCurrentBlock()).catch(() => null);
const pickedBlocks = () => Promise.resolve(logseq.Editor.getSelectedBlocks()).then(list => list || []).catch(() => []);
const getBlock = (uuid, opts) => logseq.Editor.getBlock(uuid, opts);
const getPage = key => logseq.Editor.getPage(key);
// A page in Logseq's Recycle (deleted, kept for a while): Logseq still finds it by its name, and "making" a page of that
// name hands it back still in the Recycle (seen in the app, 2026-10-23), so a part that makes pages by name asks this
// first and brings it back with restorePage.
const inRecycle = async uuid => UUID.test(String(uuid)) && (await dsQuery(`[:find ?d :where [?p :block/uuid #uuid "${uuid}"] [?p :logseq.property/deleted-at ?d]]`)).length > 0;
const restorePage = uuid => logseq.Editor.restorePage(uuid);
// Words typed with a link: stored as Logseq stores a link, by the page's uuid, so it stays a link. A name that holds no page stays as typed.
async function storedWords(text) {
  let out = String(text);
  for (const name of new Set([...out.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]).filter(name => !UUID.test(name)))) {
    const page = await getPage(name).catch(() => null);
    if (page?.uuid && !await inRecycle(String(page.uuid))) out = out.split(`[[${name}]]`).join(`[[${page.uuid}]]`);
  }
  return out;
}
// A thing just made, as it stands: its words, when it last changed, the bullets inside it. Changed since, it is no longer only what was made.
async function madeState(uuid) {
  const [[id, words, at] = []] = await dsQuery(`[:find ?b ?w ?at :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?w] [?b :block/updated-at ?at]]`);
  if (id == null) return '';
  const [[kids] = [0]] = await dsQuery(`[:find (count ?k) :where [?k :block/parent ${id}] (not [?k :logseq.property/created-from-property _])]`);
  return JSON.stringify([words, at, kids]);
}
const createPage = (name, props, opts) => logseq.Editor.createPage(name, props, opts);
const deletePage = name => logseq.Editor.deletePage(name);
const appendBlock = (pageUuid, text) => logseq.Editor.appendBlockInPage(pageUuid, text);
const removeBlock = uuid => logseq.Editor.removeBlock(uuid);
const currentGraph = () => Promise.resolve(logseq.App.getCurrentGraph?.()).catch(() => null);
// The tag map's doors (0.4.319): a page's new name, a block moved after another, a page's blocks as a tree, a tag put
// under or taken out from under another (its Extends), a page or block opened in the right sidebar, the sidebar shown.
const renamePage = (uuid, name) => logseq.Editor.renamePage(uuid, name);
const moveBlock = (uuid, target, opts) => logseq.Editor.moveBlock(uuid, target, opts);
const pageBlocksTree = uuid => logseq.Editor.getPageBlocksTree(uuid);
const EXTENDS = 'logseq.property.class/extends';
// A page's aliases and icon, and Logseq's own tags another tag may extend (Task, Card; its others, Page, Journal …, cannot be parents).
const ALIAS = 'logseq.property/alias', ICON = 'logseq.property/icon';
const PARENT_TAGS = new Set(['logseq.class/Task', 'logseq.class/Card']);
const addTagExtends = (uuid, parentUuid) => logseq.Editor.addTagExtends(uuid, parentUuid);
const removeTagExtends = (uuid, parentUuid) => logseq.Editor.removeTagExtends(uuid, parentUuid);
const openInSidebar = uuid => logseq.Editor.openInRightSidebar(uuid);
const showSidebar = (on = true) => Promise.resolve(logseq.App.setRightSidebarVisible?.(on));
// Every tag's title, for a list to offer (the settings window).
const tagTitles = async () => [...new Set(((await logseq.Editor.getAllTags?.()) || []).map(tag => tag.title || tag.originalName || tag.name).filter(Boolean))].sort();

/* How often each page's name is linked, and how often written plain (0.4.373, for the suggested links' learning): every
   block's words read once, each [[uuid]] counted for its page, and each page's name counted where it stands as whole
   words outside a link. By the page's lower-case name: { linked, plain }. Pages are the model's own list (journals and
   properties left out). Read at most every 30 s (graphWide), as the page list is. */
async function loadLinkRates() {
  const [pages, rows] = await Promise.all([propPages(), dsQuery('[:find ?t :where [?b :block/page _] [?b :block/title ?t] [(not= ?t "")] (not [?b :logseq.property/deleted-at _])]').catch(() => [])]);
  return linkRatesOf(pages, rows.map(([t]) => String(t)));
}
function linkRatesOf(pages, titles) {
  const rates = new Map(), byUuid = new Map();
  for (const page of pages) { rates.set(page.lower, { linked: 0, plain: 0 }); if (page.uuid) byUuid.set(page.uuid.toLowerCase(), page.lower); }
  // Names as whole words, longest first so "Colon cancer" is not also counted as "Colon".
  const names = [...rates.keys()].filter(n => n.length >= 2).sort((a, b) => b.length - a.length);
  const escape = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const finder = names.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
  for (const title of titles) {
    // A link by uuid (as the app writes it) or by name (as an import may): each counts for its page.
    const plain = title.replace(/\[\[([^\[\]]+)\]\]/g, (m, inner) => {
      const key = inner.trim().toLowerCase(), lower = byUuid.get(key) || (rates.has(key) ? key : null);
      if (lower) rates.get(lower).linked++;
      return ' ';
    }).replace(storedRef, ' ');
    if (finder) for (const m of plain.matchAll(finder)) { const r = rates.get(m[0].toLowerCase()); if (r) r.plain++; }
  }
  return rates;
}
const linkRates = () => graphWide('linkRates', loadLinkRates);

/* PDF highlights (0.4.364, for parts/pdf-quote.js): for highlight nodes by uuid, the page of the PDF they are on, the PDF
   they come from (its uuid) and its title. In a DB graph a highlight is a child of its PDF, tagged Pdf-annotation, with
   the page in logseq.property.pdf/hl-page and the PDF in logseq.property/asset (seen in Logseq 2.0.2, 2026-10-23). */
async function pdfSources(uuids) {
  const list = [...new Set(uuids)].filter(u => UUID.test(u));
  const sources = new Map();
  if (!list.length) return sources;
  const rows = await dsQuery(`[:find ?u ?page ?su ?title :where [(ground [${list.map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?a :block/uuid ?u]
      [?a :logseq.property.pdf/hl-page ?page] [?a :logseq.property/asset ?s] [?s :block/uuid ?su] [(get-else $ ?s :block/title "PDF") ?title]]`);
  for (const [uuid, page, sourceUuid, title] of rows || []) sources.set(String(uuid).toLowerCase(), { page: Number(page), sourceUuid: String(sourceUuid).toLowerCase(), title: String(title || 'PDF') });
  return sources;
}

/* What a folded node holds (0.4.393, the folded-node note; first made at 0.4.75 in the old links part): for each node,
   everything under it at any depth. task: the unfinished tasks; tags: the owner's tags, counted, most first (Logseq's
   own classes such as Task left out); due: the nearest Deadline or Scheduled of an unfinished task, as a day number
   (a journal page, or a Date-and-time value, which is a timestamp); files: each kind of file at any depth with its count
   ([['image', 2], ['pdf', 1]], in that order: 'image', 'pdf', 'file'), each file counted once however many nodes show
   or link it; quotes: how many passages are under it, a PDF highlight, one cited by a node there, or a node Logseq shows
   as a quote, each counted once (0.4.466). A highlight's own PDF and an area highlight's picture belong to the quote and
   are not counted as files. The tree under each node is worked out here from one look-up of its page's nodes and their parents,
   instead of one look-up per level. A property's text value is a node of the page too, and is left out. */
async function heldBelow(uuids) {
  const list = [...new Set(uuids)].map(String).filter(u => UUID.test(u));
  const held = new Map();
  if (!list.length) return held;
  const ground = (variable, values) => `[(ground [${values.join(' ')}]) [${variable} ...]]`;
  const roots = await dsQuery(`[:find ?u ?r ?pg :where ${ground('?u', list.map(u => `#uuid "${u}"`))} [?r :block/uuid ?u] [?r :block/page ?pg]]`);
  if (!roots.length) return held;
  const tree = await dsQuery(`[:find ?b ?parent :where ${ground('?pg', [...new Set(roots.map(r => r[2]))])} [?b :block/page ?pg] [?b :block/parent ?parent]
      (not [?b :logseq.property/created-from-property _])]`);
  const kids = new Map(), parentOf = new Map();
  for (const [b, parent] of tree) { if (!kids.has(parent)) kids.set(parent, []); kids.get(parent).push(b); parentOf.set(b, parent); }
  const below = new Map(); // root id -> every node under it
  for (const [, r] of roots) {
    const all = [], todo = [...(kids.get(r) || [])];
    while (todo.length) { const b = todo.pop(); all.push(b); todo.push(...(kids.get(b) || [])); }
    below.set(r, all);
  }
  const ids = [...new Set([...below.values()].flat())];
  if (!ids.length) return held;
  const among = ground('?b', ids);
  const [tagRows, statusRows, dayRows, stampRows, fileRows, quoteRows] = await Promise.all([
    dsQuery(`[:find ?b ?title ?ident :where ${among} [?b :block/tags ?t] [?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]]`),
    dsQuery(`[:find ?b ?sid :where ${among} [?b :logseq.property/status ?s] [(get-else $ ?s :db/ident :none) ?sid]]`),
    dsQuery(`[:find ?b ?day :where ${among} (or [?b :logseq.property/deadline ?d] [?b :logseq.property/scheduled ?d]) [?d :block/journal-day ?day]]`),
    // A ref is a small entity id, a timestamp is past 1e11: the comparison tells them apart without a type predicate.
    dsQuery(`[:find ?b ?ms :where ${among} (or [?b :logseq.property/deadline ?ms] [?b :logseq.property/scheduled ?ms]) [(> ?ms 100000000000)]]`),
    dsQuery(`[:find ?b ?a ?type :where ${among} (or-join [?b ?a] [(identity ?b) ?a] [?b :logseq.property/asset ?a] [?b :block/refs ?a]) [?a :logseq.property.asset/type ?type]]`),
    // A quote (0.4.466): a PDF highlight, a node citing one, or a node Logseq shows as a quote (written with >); ?q is
    // the passage itself, so a highlight and a note citing it under the same node count as one quote.
    dsQuery(`[:find ?b ?q :where ${among} (or-join [?b ?q] (and [?b :logseq.property.pdf/hl-page _] [(identity ?b) ?q])
      (and [?b :block/refs ?q] [?q :logseq.property.pdf/hl-page _]) (and [?b :logseq.property.node/display-type :quote] [(identity ?b) ?q]))]`),
  ]);
  const tagsOf = new Map(), taskIds = new Set(), dueOf = new Map(), filesOf = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const [b, title, ident] of tagRows) {
    if (String(ident) === ':logseq.class/Task') taskIds.add(b); // a task tag with no status yet is open
    else if (!/^:?logseq\.class\//.test(String(ident))) add(tagsOf, b, String(title));
  }
  const closed = new Set();
  for (const [b, status] of statusRows) { if (/\.(done|canceled|cancelled)$/.test(String(status))) closed.add(b); else taskIds.add(b); }
  for (const b of closed) taskIds.delete(b);
  const sooner = (b, n) => { if (Number.isFinite(n) && n > 0 && (!dueOf.has(b) || n < dueOf.get(b))) dueOf.set(b, n); };
  for (const [b, day] of dayRows) sooner(b, Number(day));
  for (const [b, ms] of stampRows) { const d = new Date(Number(ms)); if (!Number.isNaN(d.getTime())) sooner(b, dayNumber(d)); }
  const quoteOf = new Map(); // node -> the passages it is or cites
  for (const [b, q] of quoteRows) add(quoteOf, b, q);
  for (const [b, a, type] of fileRows) {
    // A highlight holds its PDF as its asset, and an area highlight its picture as a child: both are the quote, not files.
    if (quoteOf.has(b) || quoteOf.has(parentOf.get(b))) continue;
    const t = String(type).replace(/^:/, '').toLowerCase();
    add(filesOf, b, [t === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(t) ? 'image' : 'file', a]);
  }
  for (const [u, r] of roots) {
    const counts = new Map();
    let task = 0, due = 0;
    // Distinct passages and distinct files: a picture shown twice, or linked from a second node, is one picture.
    const passages = new Set(), fileSets = new Map();
    for (const b of below.get(r)) {
      for (const q of quoteOf.get(b) || []) passages.add(q);
      for (const [kind, a] of filesOf.get(b) || []) { if (!fileSets.has(kind)) fileSets.set(kind, new Set()); fileSets.get(kind).add(a); }
      for (const title of tagsOf.get(b) || []) counts.set(title, (counts.get(title) || 0) + 1);
      if (!taskIds.has(b)) continue;
      task++;
      if (dueOf.has(b) && (!due || dueOf.get(b) < due)) due = dueOf.get(b);
    }
    // Pictures, PDFs and other files at any depth, counted (0.4.466; before, one icon per kind just below).
    const files = ['image', 'pdf', 'file'].filter(kind => fileSets.has(kind)).map(kind => [kind, fileSets.get(kind).size]);
    const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    held.set(String(u).toLowerCase(), { task, tags, due, files, quotes: passages.size });
  }
  return held;
}

function provide(core) {
  core.provide({ aliasesOf, madeState, storedWords, inRecycle, restorePage, setValue, unsetValue, addTag, removeTag, setWords, editBlock, exitEditing, insertBlock, addLineTo, currentPage, currentBlock, pickedBlocks, getBlock, currentGraph, tagTitles, getPage, createPage, deletePage, appendBlock, removeBlock, inRecycle, restorePage,
    renamePage, moveBlock, pageBlocksTree, EXTENDS, ALIAS, ICON, PARENT_TAGS, addTagExtends, removeTagExtends, openInSidebar, showSidebar,
    titleOf, trailingTags, storedRef, readableTitle, bare, pick, idOf,
    propSchema, propPages, fieldsOf, fits, kindOfPage, tagChain, tagChains, tagChainIndex, parseDay, dayNumber, sameDay, dayAfter, DAYS,
    tagGraph, propInfo, ownProps, inheritedProps, tagPropIds, acceptedIds, choicesOf, choiceUse, choiceCounts, choiceNodes, idByUuid,
    descriptionOf, titleNow, valuesOf, userValues, mergeFacts, TAG_PROPS, ACCEPTS, DESCRIPTION,
    linksInto, mentionsInto, firstTags, nodesOfTag, nodeLines, nodeFields, nodeValues, firstLines, pagesAmong, tagUuidNamed, uuidById,
    pagesNamed, BLOCK_PULL, blockInEdit, userTagIds, taggedNodes, nodesById, aliasPairs, plainLines, journalDays, datedByTag, valueTitle, numberValues, linkedPages, hasTag, pageLines,
    propTextValues, propTextBlocks, propValueBlocks, propNamed, propUse, propUses, structureUse, propNodeIds, choiceIds, crumbsInto, propHolders, pdfSources, heldBelow, linkRates, linkRatesOf, journalIdFor, journalTitleFor, formatJournalTitle, CHECKED_WITH, PAGE_TITLE, screenChecks, pageTitles, titleAnchor });
}
function start() {
  window.refinementCore.onGraphChange(() => { journalFormat.value = null; });   // each graph has its own
  ({ dsQuery, graphWide } = take(window.refinementCore, ['dsQuery', 'graphWide']));
}
(window.refinementParts ||= []).push({ name: 'model', foundation: true, schema: [], provide, start, stop: runUnloadTasks });
})();
