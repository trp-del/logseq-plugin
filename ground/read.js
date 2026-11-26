/* GROUND: the one way the plugin reads the graph. Nothing here draws.
     read.q(query)            a question in, rows out
     read.node(uuid)          { id, uuid, day } of a node by its uuid (day: the journal day, when it is one), or null
     read.opened(to)          the node a link leads to, by its uuid or a page's name: { id, uuid, title, isPage, kind }
                              (kind: 'tag' or 'property' for the page of one, else ''), or null
     read.describe(ids)       id -> the node as a line shows it: { id, uuid, words, tag, day, dayFrom, status, isPage, written, dates, made, changed }
                              written: the journal day it is written on; dates: { name: day } every day it holds; made, changed: times
                              tag: its first tag of the person's own (or Task) by name; day: its Date property (the one named
                              Date first, else the earliest), else the journal day it is written on; status: the id of its Status
     read.pointingAt(id)      { links: [{ prop, node }], mentions: [node] }   what holds this node as a value, what names it
     read.dues(day)           [{ which, node }]   what Logseq's Scheduled and Deadline put on a journal day
     read.names(uuids)        uuid -> the node's name as plain words
     read.properties()        ident -> { ident, title, uuid, type }   the person's own properties
     read.statuses()          Logseq's statuses in its order: [{ id, name, title, icon }]
     read.tags()              id -> { id, title, uuid, parents: [id] }   the person's own tags and what each sits under
     read.tagsOf(id)          the ids of a node's own tags
     read.tagIds()            the ids of the person's tags as they are this moment (never kept)
     read.tagPairs()          [[tag id, node id]]   which node holds which of the person's tags
     read.propertyCounts()    property uuid -> how many nodes hold something under it
     read.relations()         [[tag id, property ident, tag id, n]]   n nodes of the first tag hold, under the property, a node of the second
     read.holders(ident)      the nodes holding a value under a property: [{ id, uuid, words, tag, values: [{ raw, text }] }]
     read.heldUnder(node, value)  the name of the property under which one node holds another (uuids), or ''
     read.graph()             the open graph's name
     read.newPages(since)     the plain, untagged pages made since a time in milliseconds (never kept): [{ id, uuid, title }]
     read.search(words)       Logseq's own search for the words, its order kept: [node]
     read.tagged(tagIds)      the nodes holding any of these tags: [node]
     read.values(ids)         id -> [words]   what each node holds under the person's properties
     read.held(ids)           id -> { name: [words] }   the same, told apart by the property's name
     read.where(ids)          id -> [{ uuid, words, day }]   where a bullet sits: its page (day: a journal's, else 0), then the bullet it is under
     read.withLines(ids)      which of these nodes keep lines under them
     read.recycled()          Logseq's Recycle, newest first: [{ uuid, words, isPage, from, at }]
     read.tasks()             the open tasks, each a node whose day is the day it is due (Deadline, else Scheduled), with its priority's name
     read.journal(day)        the uuid of a day's journal page, or '' when the graph has none
     read.pageNamed(name)     the page of that very name, { uuid, gone } (gone: it lies in Logseq's Recycle), or null
     read.byUuids(uuids)      the nodes of these uuids, in their order: [node]
     read.recent(n)           the pages opened last, newest first: [node] (Logseq's own list of them; else the pages changed last)
     read.pageNames()         every page of the person's own by name, journal days left out: [{ id, uuid, title }]
     read.schema()            { props: ident -> { ident, title, type, range: [tag id], many }, byTag: tag id -> [ident] }
     read.writing(uuid)       what a bullet's words say, as core/sure.js takes it; null for a bullet with no tag of the person's
     read.outline(uuid, isPage)  a node's bullets in their order: [{ id, uuid, depth, words }], words as a person reads them
     read.holds(id)           what one node holds under each of the person's properties: ident -> [{ raw, text, uuid }]
     read.choices()           the set choices of the person's properties: ident -> [{ raw, text }], in Logseq's order
   Deleted nodes, and nodes on deleted pages, are never answered. */
(function () {
const G = window.PluginDoor, W = G.words, D = G.days;
const q = async query => { const rows = await logseq.DB.datascriptQuery(query); return Array.isArray(rows) ? rows : []; };
const isId = v => Number.isSafeInteger(v) && v > 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bare = value => String(value ?? '').replace(/^:/, '');
const among = (variable, ids) => `[(ground [${[...new Set(ids)].filter(isId).join(' ')}]) [${variable} ...]]`;
const amongUuids = (variable, uuids) => `[(ground [${[...new Set(uuids.map(u => String(u).toLowerCase()))].filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
const STAMP = 100000000000;   // an id of the graph is small; a time in milliseconds is past this
const dayOfTime = ms => D.number(new Date(ms));
const LIVE = '(not [?b :logseq.property/deleted-at]) (not-join [?b] [?b :block/page ?pg] [?pg :logseq.property/deleted-at])';

// What is asked once and kept until the graph changes (G.read.forget, called by the ground on every change).
const kept = new Map();
const once = (name, ask) => { if (!kept.has(name)) { const asked = ask(); kept.set(name, asked); asked.catch(() => kept.delete(name)); } return kept.get(name); };

const properties = () => once('properties', async () => {
  const rows = await q('[:find ?i ?t ?u ?ty :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?p :block/title ?t] [?p :block/uuid ?u] [(get-else $ ?p :logseq.property/type :default) ?ty]]');
  return new Map(rows.map(([ident, title, uuid, type]) => [bare(ident), { ident: bare(ident), title: String(title), uuid: String(uuid), type: bare(type) }]));
});
// The tags a line is named by: the person's own, and Logseq's Task. Logseq's other tags (Page, Journal, Tag) say nothing a line needs.
const lineTags = () => once('lineTags', async () => {
  const rows = await q('[:find ?t ?i ?n :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?t :block/title ?n]]');
  return new Map(rows.filter(([, ident]) => /^(user\.class\/|logseq\.class\/Task$)/.test(bare(ident))).map(([id, , name]) => [id, String(name)]));
});
const tags = () => once('tags', async () => {
  const [rows, above] = await Promise.all([
    q('[:find ?t ?i ?n ?u :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?t :block/title ?n] [?t :block/uuid ?u]]'),
    q('[:find ?t ?p :where [?t :logseq.property.class/extends ?p]]'),
  ]);
  const out = new Map(rows.filter(([, ident]) => /^user\.class\//.test(bare(ident))).map(([id, , name, uuid]) => [id, { id, title: String(name), uuid: String(uuid).toLowerCase(), parents: [] }]));
  for (const [t, parent] of above) if (out.has(t) && out.has(parent)) out.get(t).parents.push(parent);
  return out;
});
// The ids of the person's tags, asked afresh each time (never kept): how a tag made a moment ago is noticed.
const tagIds = async () => new Set((await q('[:find ?t ?i :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]]')).filter(([, ident]) => /^user\.class\//.test(bare(ident))).map(([id]) => id));
// The plain pages made since a moment (a time in milliseconds), asked afresh each time: no journal day, no tag, no property,
// and none that already holds one of the person's tags.
// Which node holds which of the person's tags: [[tag id, node id]], kept until the graph changes.
const propertyCounts = async () => new Map((await q(`[:find ?u (count ?b) :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?p :block/uuid ?u] [?b ?i _]]`)).map(([u, n]) => [String(u).toLowerCase(), Number(n) || 0]));
const tagPairs = () => once('tagPairs', async () => {
  const mine = await tagIds();
  return (await q(`[:find ?t ?b :where [?b :block/tags ?t] [?t :block/tags :logseq.class/Tag] ${LIVE}]`)).filter(([t]) => mine.has(t));
});
// How the person's tags are joined by their properties, from the real values: [[tag id, property ident, tag id, how many]], a
// node of the first tag holding, under the property, a node of the second. Kept until the graph changes.
const relations = () => once('relations', async () => {
  const mine = await tagIds();
  const rows = await q(`[:find ?ta ?a ?tb (count ?b) :where [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b ?a ?v] [?b :block/tags ?ta] [?v :block/tags ?tb]]`);
  return rows.filter(([a, , b]) => mine.has(a) && mine.has(b)).map(([a, ident, b, n]) => [a, bare(ident), b, Number(n) || 0]);
});
/* The nodes that hold a value under one of the person's properties, each with what it holds: [{ id, uuid, words, tag, values }],
   a value { raw, text }: raw is what is written to give another node the same value (a node's or a day's id, a number, words),
   text is how it reads. Asked afresh each time. */
async function holders(ident) {
  const prop = (await schema()).props.get(ident);
  if (!prop || !/^user\.property\/[\w.-]+$/.test(ident)) return [];
  const rows = await q(`[:find ?b ?v :where [?b :${ident} ?v] ${LIVE}]`);
  if (!rows.length) return [];
  const ref = prop.type === 'node' || prop.type === 'date', ids = [...new Set(rows.map(([, v]) => v).filter(isId))];
  const [nodes, titles, numbers] = await Promise.all([describe(rows.map(([b]) => b)),
    ids.length ? q(`[:find ?v ?t :where ${among('?v', ids)} [?v :block/title ?t]]`) : [], ids.length ? q(`[:find ?v ?n :where ${among('?v', ids)} [?v :logseq.property/value ?n]]`) : []]);
  const title = new Map(titles.map(([v, t]) => [v, String(t)])), number = new Map(numbers);
  const names = await G.read.names([...nodes.values()].flatMap(node => W.named(node.words)));
  const value = v => !isId(v) || prop.type === 'checkbox' ? { raw: v, text: String(v) } : ref ? { raw: v, text: title.get(v) || '' } : number.has(v) ? { raw: number.get(v), text: String(number.get(v)) } : { raw: title.get(v) ?? '', text: title.get(v) ?? '' };
  const out = new Map();
  for (const [b, v] of rows) { const node = nodes.get(b); if (!node) continue; if (!out.has(b)) out.set(b, { id: b, uuid: node.uuid, words: W.plain(W.firstLine(node.words).line, names), tag: node.tag, values: [] }); out.get(b).values.push(value(v)); }
  return [...out.values()];
}
// The name of the property under which one node holds another, '' when it holds it under none (a link in its words).
async function heldUnder(node, value) {
  if (!UUID.test(String(node)) || !UUID.test(String(value))) return '';
  const rows = await q(`[:find ?pt :where [?b :block/uuid #uuid "${node}"] [?v :block/uuid #uuid "${value}"] [?b ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :block/title ?pt]]`);
  return rows.length ? String(rows.map(([t]) => t).sort()[0]) : '';
}
const graph = async () => String((await logseq.App.getCurrentGraph())?.name || '');
async function newPages(since) {
  const rows = await q(`[:find ?p ?u ?t :where [?p :block/created-at ?c] [(> ?c ${Number(since) || 0})] [?p :block/tags :logseq.class/Page] [?p :block/uuid ?u] [?p :block/title ?t]]`);
  if (!rows.length) return [];
  const [mine, tagged] = await Promise.all([tagIds(), q(`[:find ?p ?t :where ${among('?p', rows.map(([p]) => p))} [?p :block/tags ?t]]`)]);
  const has = new Set(tagged.filter(([, t]) => mine.has(t)).map(([p]) => p));
  return rows.filter(([p]) => !has.has(p)).map(([id, uuid, title]) => ({ id, uuid: String(uuid).toLowerCase(), title: String(title) }));
}
const tagsOf = async id => isId(id) ? (await q(`[:find ?t :where [${id} :block/tags ?t]]`)).map(([t]) => t) : [];
const statuses = () => once('statuses', async () => {
  const rows = await q('[:find ?v ?ident ?t ?o ?icon :where [?v :block/closed-value-property ?p] [?p :db/ident :logseq.property/status] [?v :block/title ?t] [(get-else $ ?v :db/ident "") ?ident] [(get-else $ ?v :block/order "") ?o] [(get-else $ ?v :logseq.property/icon "") ?icon]]');
  return rows.map(([id, ident, title, order, icon]) => ({ id: Number(id), name: bare(ident).replace(/^logseq\.property\/status\./, ''), title: String(title || ''), order: String(order || ''), icon: icon && typeof icon === 'object' ? icon : null }))
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id - b.id));
});

async function node(uuid) {
  if (!UUID.test(String(uuid || ''))) return null;
  const [[id, day] = []] = await q(`[:find ?b ?d :where [?b :block/uuid #uuid "${uuid}"] [(get-else $ ?b :block/journal-day 0) ?d] ${LIVE}]`);
  return isId(id) ? { id, uuid: String(uuid).toLowerCase(), day: Number(day) || 0 } : null;
}

async function opened(to) {
  const found = await logseq.Editor.getPage(String(to)).catch(() => null) || (UUID.test(String(to)) ? await logseq.Editor.getBlock(String(to)).catch(() => null) : null);
  if (!found?.id || !found.uuid) return null;
  const isPage = !!found.name && !found.page, ident = String(found.ident || '');
  return { id: found.id, uuid: String(found.uuid).toLowerCase(), isPage, title: String(found.title || found.originalName || found.name || ''), kind: !isPage ? '' : /\.class\//.test(ident) ? 'tag' : /\.property\//.test(ident) ? 'property' : '' };
}

async function describe(ids) {
  const list = [...new Set(ids)].filter(isId), out = new Map();
  if (!list.length) return out;
  const these = among('?b', list);
  const [titled, tagged, dated, written, status, pages, tags, ...moments] = await Promise.all([
    q(`[:find ?b ?u ?t :where ${these} [?b :block/uuid ?u] [?b :block/title ?t] ${LIVE}]`),
    q(`[:find ?b ?t :where ${these} [?b :block/tags ?t]]`),
    q(`[:find ?b ?attr ?day ?name :where ${these} [?prop :logseq.property/type :date] [?prop :db/ident ?attr] [?prop :block/title ?name] [?b ?attr ?d] [?d :block/journal-day ?day]]`),
    q(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
    q(`[:find ?b ?s :where ${these} [?b :logseq.property/status ?s]]`),
    q(`[:find ?b :where ${these} [?b :block/name]]`),
    lineTags(),
    Promise.all([q(`[:find ?b ?c :where ${these} [?b :block/created-at ?c]]`), q(`[:find ?b ?u :where ${these} [?b :block/updated-at ?u]]`)]),
    q(`[:find ?b ?attr ?v :where ${these} [(ground [:logseq.property/deadline :logseq.property/scheduled]) [?attr ...]] [?b ?attr ?v]]`).catch(() => []),
  ]);
  const times = moments[0], dueRows = moments[1];
  const tagOf = new Map();
  for (const [b, t] of tagged) { const name = tags.get(t); if (name && (!tagOf.has(b) || name < tagOf.get(b))) tagOf.set(b, name); }
  const dayOf = new Map();
  for (const [b, attr, day, name] of dated) {
    if (!/^user\.property\//.test(bare(attr))) continue;
    const rank = String(name).trim().toLowerCase() === 'date' ? 0 : 1, had = dayOf.get(b);
    if (!had || rank < had.rank || (rank === had.rank && day < had.day)) dayOf.set(b, { rank, day: Number(day), from: String(name).trim() });
  }
  for (const [b, day] of written) if (!dayOf.has(b)) dayOf.set(b, { rank: 2, day: Number(day), from: '' });
  // Every day a node holds, by the name of what holds it: its date properties, Logseq's Deadline and Scheduled; the day it is written on; when it was made and last changed.
  const datesOf = new Map(), put = (b, name, day) => { if (!day) return; if (!datesOf.has(b)) datesOf.set(b, {}); datesOf.get(b)[name] = Number(day); };
  for (const [b, attr, day, name] of dated) if (/^user\.property\//.test(bare(attr))) put(b, String(name).trim(), day);
  const asked = dueRows.map(([, , v]) => v).filter(v => isId(v) && v < STAMP), journals = asked.length ? new Map(await q(`[:find ?p ?d :where ${among('?p', asked)} [?p :block/journal-day ?d]]`)) : new Map();
  for (const [b, attr, v] of dueRows) put(b, /deadline$/.test(bare(attr)) ? 'Deadline' : 'Scheduled', v > STAMP ? dayOfTime(v) : journals.get(v));
  const writtenOn = new Map(written.map(([b, day]) => [b, Number(day)])), timeOf = new Map(times[0].map(([b, c]) => [b, { made: Number(c) || 0, changed: Number(c) || 0 }]));
  for (const [b, u] of times[1]) { const at = timeOf.get(b) || { made: 0, changed: 0 }; at.changed = Number(u) || at.changed; timeOf.set(b, at); }
  const statusOf = new Map(status.map(([b, s]) => [b, Number(s) || 0])), isPage = new Set(pages.map(([b]) => b));
  for (const [b, uuid, title] of titled) out.set(b, { id: b, uuid: String(uuid).toLowerCase(), words: String(title ?? ''), tag: tagOf.get(b) || '', day: dayOf.get(b)?.day || 0, dayFrom: dayOf.get(b)?.from || '', status: statusOf.get(b) || 0, isPage: isPage.has(b),
    written: writtenOn.get(b) || 0, dates: datesOf.get(b) || {}, made: timeOf.get(b)?.made || 0, changed: timeOf.get(b)?.changed || 0 });
  return out;
}

async function pointingAt(id) {
  if (!isId(id)) return { links: [], mentions: [] };
  const [props, aliases, [[mine] = []]] = await Promise.all([properties(), q(`[:find ?a :where [${id} :block/alias ?a]]`), q(`[:find ?u :where [${id} :block/uuid ?u]]`)]);
  const targets = [id, ...aliases.map(([a]) => a).filter(isId)];
  // A node's own bullets do not point at it, and it does not point at itself.
  const outside = `[(not= ?b ${id})] (not [?b :block/page ${id}])`;
  const [held, named, uuids] = await Promise.all([
    q(`[:find ?b ?attr :where [?b ?attr ${id}] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")] ${outside} ${LIVE}]`),
    q(`[:find ?b :where ${among('?t', targets)} [?b :block/refs ?t] [?b :block/page _] ${outside} (not [?b :logseq.property/created-from-property _]) ${LIVE}]`),   // a property's words-value is a block of its own to Logseq: it is no note
    q(`[:find ?u ?n :where ${among('?t', targets)} [?t :block/uuid ?u] [(get-else $ ?t :block/title "") ?n]]`),
  ]);
  const nodes = await describe([...held.map(([b]) => b), ...named.map(([b]) => b)]);
  const links = [];
  for (const [b, attr] of held) { const prop = props.get(bare(attr)), n = nodes.get(b); if (prop && n) links.push({ prop, node: n }); }
  // Named in the words, and not only as a tag: a link to this node (or to a name it also goes by) with no # before it.
  const marks = [...new Set([String(mine ?? ''), ...uuids.map(([u]) => String(u))].filter(Boolean).flatMap(u => [`[[${u.toLowerCase()}]]`, `((${u.toLowerCase()}))`])
    .concat(uuids.map(([, name]) => String(name).trim().toLowerCase()).filter(Boolean).map(name => `[[${name}]]`)))];
  const says = words => { const text = words.toLowerCase(); return marks.some(mark => { for (let at = text.indexOf(mark); at >= 0; at = text.indexOf(mark, at + 1)) if (text[at - 1] !== '#') return true; return false; }); };
  // A bullet that says nothing but this node's own name tells the page nothing it does not know: it is no row there
  // (the owner, 25 November 2026: thirteen rows reading only "City of Hope" on City of Hope's own page).
  const more = words => marks.reduce((text, mark) => text.split(mark).join(''), words.toLowerCase()).replace(/[\s.,;:!?()\[\]–—-]+/g, '') !== '';
  const mentions = named.map(([b]) => nodes.get(b)).filter(n => n && says(n.words) && more(n.words));
  return { links, mentions };
}

async function dues(day) {
  const span = D.span(day);
  if (!span) return [];
  const [[page] = []] = await q(`[:find ?p :where [?p :block/journal-day ${day}]]`);
  const found = [];
  for (const [which, attr] of [['Scheduled', ':logseq.property/scheduled'], ['Deadline', ':logseq.property/deadline']]) {
    const [timed, paged] = await Promise.all([
      q(`[:find ?b :where [?b ${attr} ?t] [(>= ?t ${span.from})] [(< ?t ${span.to})] ${LIVE}]`).catch(() => []),
      isId(page) ? q(`[:find ?b :where [?b ${attr} ${page}] ${LIVE}]`).catch(() => []) : [],
    ]);
    for (const [b] of [...timed, ...paged]) found.push([which, b]);
  }
  const nodes = await describe(found.map(([, b]) => b));
  return found.map(([which, b]) => ({ which, node: nodes.get(b) })).filter(due => due.node && !(isId(page) && due.node.id === page));
}

// Names as plain words. A name that itself links other nodes reads with their names (one level in; deeper links read as "…").
async function names(uuids) {
  const ask = async list => new Map((list.length ? await q(`[:find ?u ?t :where ${amongUuids('?u', list)} [?b :block/uuid ?u] [?b :block/title ?t]]`) : []).map(([u, t]) => [String(u).toLowerCase(), String(t ?? '')]));
  const first = await ask([...uuids]);
  const inner = await ask([...new Set([...first.values()].flatMap(W.named))].filter(u => !first.has(u)));
  const known = new Map([...inner, ...first]);
  return new Map([...first].map(([u, t]) => [u, W.plain(W.firstLine(t).line, new Map([...known].map(([k, v]) => [k, W.named(v).length ? '…' : v])))]));
}

async function search(words, limit = 40) {
  let found = null;
  try { found = await logseq.App.search(String(words), { limit, 'search-limit': limit }); } catch (error) { console.warn('Logseq Plugin: Logseq\'s search did not answer', error); return []; }
  const ids = [...new Set((found?.blocks || []).map(block => block.id).filter(isId))];
  if (!ids.length) return [];
  // A property's text value (a tag's description) is a block of its own to Logseq: it is no note, and is left out. A tag and a
  // property found by name say that they are one.
  const [nodes, values, kinds] = await Promise.all([describe(ids), q(`[:find ?b :where ${among('?b', ids)} [?b :logseq.property/created-from-property _]]`),
    q(`[:find ?b ?k :where ${among('?b', ids)} [?b :block/tags ?t] [?t :db/ident ?k]]`)]);
  const value = new Set(values.map(([b]) => b)), kind = new Map();
  for (const [b, k] of kinds) { const name = bare(k) === 'logseq.class/Tag' ? 'Tag' : bare(k) === 'logseq.class/Property' ? 'Property' : ''; if (name) kind.set(b, name); }
  return ids.filter(id => !value.has(id)).map(id => { const node = nodes.get(id); return node && !node.tag && kind.has(id) ? { ...node, tag: kind.get(id) } : node; }).filter(Boolean);
}
async function tagged(tagIds) {
  const list = [...new Set(tagIds)].filter(isId);
  if (!list.length) return [];
  const rows = await q(`[:find ?b :where ${among('?t', list)} [?b :block/tags ?t] ${LIVE}]`);
  return [...(await describe(rows.map(([b]) => b))).values()];
}
async function values(ids) {
  const list = [...new Set(ids)].filter(isId), out = new Map();
  if (!list.length) return out;
  const raw = await q(`[:find ?b ?v :where ${among('?b', list)} [?b ?attr ?v] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")]]`);
  const held = [...new Set(raw.map(([, v]) => v).filter(v => isId(v) && v < STAMP))];
  const [titles, kept] = held.length ? await Promise.all([q(`[:find ?v ?t :where ${among('?v', held)} [?v :block/title ?t]]`), q(`[:find ?v ?n :where ${among('?v', held)} [?v :logseq.property/value ?n]]`)]) : [[], []];
  const said = new Map([...kept.map(([v, n]) => [v, String(n)]), ...titles.map(([v, t]) => [v, String(t)])]);
  for (const [b, v] of raw) { const word = said.get(v) ?? (typeof v === 'string' ? v : ''); if (word) { if (!out.has(b)) out.set(b, []); out.get(b).push(word); } }
  return out;
}
// What each node holds under each of the person's properties, by the property's name, as words: id -> { name: [words] }.
async function held(ids) {
  const list = [...new Set(ids)].filter(isId), out = new Map();
  if (!list.length) return out;
  const [props, raw] = await Promise.all([properties(), q(`[:find ?b ?attr ?v :where ${among('?b', list)} [?b ?attr ?v] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")]]`)]);
  const refs = [...new Set(raw.map(([, , v]) => v).filter(v => isId(v) && v < STAMP))];
  const [titles, kept, days] = refs.length ? await Promise.all([q(`[:find ?v ?t :where ${among('?v', refs)} [?v :block/title ?t]]`), q(`[:find ?v ?n :where ${among('?v', refs)} [?v :logseq.property/value ?n]]`), q(`[:find ?v ?d :where ${among('?v', refs)} [?v :block/journal-day ?d]]`)]) : [[], [], []];
  const said = new Map([...kept.map(([v, n]) => [v, String(n)]), ...titles.map(([v, t]) => [v, W.plain(W.firstLine(String(t)).line, new Map())]), ...days.map(([v, d]) => [v, D.short(Number(d))])]);
  for (const [b, attr, v] of raw) {
    const prop = props.get(bare(attr)), word = said.get(v) ?? (typeof v === 'string' ? v : typeof v === 'number' && !isId(v) ? String(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : '');
    if (!prop || !word) continue;
    if (!out.has(b)) out.set(b, {});
    (out.get(b)[prop.title] ||= []).push(word);
  }
  return out;
}
// Where each bullet sits: its page, then the bullet it is under when that is not the page itself. id -> [{ uuid, words }].
async function where(ids) {
  const list = [...new Set(ids)].filter(isId), out = new Map();
  if (!list.length) return out;
  const [pages, parents] = await Promise.all([q(`[:find ?b ?pg ?u ?t ?d :where ${among('?b', list)} [?b :block/page ?pg] [?pg :block/uuid ?u] [?pg :block/title ?t] [(get-else $ ?pg :block/journal-day 0) ?d]]`),
    q(`[:find ?b ?p ?u ?t :where ${among('?b', list)} [?b :block/parent ?p] [?p :block/uuid ?u] [?p :block/title ?t]]`)]);
  const page = new Map(pages.map(([b, pg, u, t, d]) => [b, { id: pg, uuid: String(u).toLowerCase(), words: String(t ?? ''), day: Number(d) || 0 }]));
  for (const [b, at] of page) out.set(b, [{ uuid: at.uuid, words: at.words, day: at.day }]);
  for (const [b, p, u, t] of parents) if (page.get(b) && page.get(b).id !== p) out.get(b).push({ uuid: String(u).toLowerCase(), words: W.firstLine(String(t ?? '')).line });
  return out;
}
// Which of these nodes keep lines under them (their own bullets, never the values of their properties): a set of ids.
async function withLines(ids) {
  const list = [...new Set(ids)].filter(isId);
  if (!list.length) return new Set();
  const kids = await q(`[:find ?b ?c :where ${among('?b', list)} [?c :block/parent ?b] (not [?c :logseq.property/created-from-property]) (not [?c :logseq.property/deleted-at])]`);
  return new Set(kids.map(([b]) => b));
}
// Logseq's Recycle: what was deleted and can still be brought back, newest first. [{ uuid, words, isPage, from, at }]
async function recycled() {
  const [rows, pages, from] = await Promise.all([q('[:find ?b ?u ?d :where [?b :logseq.property/deleted-at ?d] [?b :block/uuid ?u]]'), q('[:find ?b :where [?b :logseq.property/deleted-at _] [?b :block/name]]'),
    q('[:find ?b ?t :where [?b :logseq.property/deleted-at _] [?b :logseq.property.recycle/original-page ?p] [?p :block/title ?t]]').catch(() => [])]);
  const ids = rows.map(([b]) => b), titles = ids.length ? new Map(await q(`[:find ?b ?t :where ${among('?b', ids)} [?b :block/title ?t]]`)) : new Map();
  const isPage = new Set(pages.map(([b]) => b)), where = new Map(from);
  return rows.map(([b, u, d]) => ({ uuid: String(u).toLowerCase(), words: W.firstLine(String(titles.get(b) ?? '')).line, isPage: isPage.has(b), from: String(where.get(b) ?? ''), at: Number(d) || 0 })).sort((a, b) => b.at - a.at);
}
async function tasks() {
  const all = await statuses(), shut = new Set(all.filter(s => /^(done|canceled|cancelled)$/.test(s.name)).map(s => s.id));
  const held = (await q(`[:find ?b ?s :where [?b :logseq.property/status ?s] ${LIVE}]`)).filter(([, s]) => !shut.has(s));
  const ids = held.map(([b]) => b);
  if (!ids.length) return [];
  const [nodes, deadline, scheduled, days, ranked] = await Promise.all([describe(ids),
    q(`[:find ?b ?v :where ${among('?b', ids)} [?b :logseq.property/deadline ?v]]`), q(`[:find ?b ?v :where ${among('?b', ids)} [?b :logseq.property/scheduled ?v]]`),
    q('[:find ?p ?d :where [?p :block/journal-day ?d]]'), q(`[:find ?b ?t :where ${among('?b', ids)} [?b :logseq.property/priority ?p] [?p :block/title ?t]]`).catch(() => [])]);
  const priority = new Map(ranked);
  const journal = new Map(days), dayOf = v => v > STAMP ? dayOfTime(v) : Number(journal.get(v)) || 0;
  const due = new Map();
  for (const [b, v] of scheduled) due.set(b, { day: dayOf(v), from: 'Scheduled' });
  for (const [b, v] of deadline) due.set(b, { day: dayOf(v), from: 'Deadline' });
  return ids.map(id => nodes.get(id)).filter(Boolean).map(node => ({ ...node, day: due.get(node.id)?.day || 0, dayFrom: due.get(node.id)?.from || '', priority: String(priority.get(node.id) || '') }));
}
const journal = async day => { const [[uuid] = []] = await q(`[:find ?u :where [?p :block/journal-day ${Number(day)}] [?p :block/uuid ?u] (not [?p :logseq.property/deleted-at])]`); return uuid ? String(uuid) : ''; };

async function byUuids(uuids) {
  const list = uuids.map(u => String(u).toLowerCase()).filter(u => UUID.test(u));
  if (!list.length) return [];
  const ids = new Map((await q(`[:find ?u ?b :where ${amongUuids('?u', list)} [?b :block/uuid ?u]]`)).map(([u, b]) => [String(u).toLowerCase(), b]));
  const nodes = await describe([...ids.values()]);
  return list.map(u => nodes.get(ids.get(u))).filter(Boolean);
}
const schema = () => once('schema', async () => {
  const [all, ranges, many, given] = await Promise.all([properties(),
    q('[:find ?i ?c :where [?p :logseq.property/classes ?c] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")]]'),
    q('[:find ?i :where [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?p :db/cardinality :db.cardinality/many]]'),
    q('[:find ?t ?i :where [?t :logseq.property.class/properties ?p] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")]]')]);
  const props = new Map([...all].map(([ident, prop]) => [ident, { ...prop, range: [], many: false }])), byTag = new Map();
  for (const [ident, tag] of ranges) props.get(bare(ident))?.range.push(tag);
  for (const [ident] of many) { const prop = props.get(bare(ident)); if (prop) prop.many = true; }
  for (const [tag, ident] of given) { if (!byTag.has(tag)) byTag.set(tag, []); byTag.get(tag).push(bare(ident)); }
  return { props, byTag };
});
async function writing(uuid) {
  const at = await node(uuid);
  if (!at) return null;
  const [tagIndex, known, mine] = await Promise.all([tags(), schema(), tagsOf(at.id)]);
  const own = mine.filter(id => tagIndex.has(id));
  if (!own.length) return null;
  const idents = new Set();
  for (const id of own) for (const up of G.tags.above(id, tagIndex)) for (const ident of known.byTag.get(up) || []) idents.add(ident);
  const props = [...idents].map(ident => known.props.get(ident)).filter(Boolean);
  if (!props.length) return null;
  const [held, refs, [[pageId, pageDay] = []]] = await Promise.all([
    q(`[:find ?a ?v :where [${at.id} ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")]]`),
    q(`[:find ?r :where [${at.id} :block/refs ?r] [?r :block/title _] (not [?r :db/ident _])]`),
    q(`[:find ?p ?d :where [${at.id} :block/page ?p] [(get-else $ ?p :block/journal-day 0) ?d]]`)]);
  // A node the bullet already holds as a value is no link of its words (Logseq counts a value among a bullet's references): it
  // is never offered to a second property.
  const valued = new Set(held.map(([, v]) => v).filter(isId)), linkedRefs = refs.filter(([r]) => !valued.has(r));
  const about = [...new Set([...linkedRefs.map(([r]) => r), pageId].filter(isId))];
  const tagged = about.length ? await q(`[:find ?n ?t :where ${among('?n', about)} [?n :block/tags ?t]]`) : [];
  const tagsFor = id => tagged.filter(([n, t]) => n === id && tagIndex.has(t)).map(([, t]) => t);
  const dated = new Map();
  if (pageDay) for (const prop of props.filter(one => one.type === 'date' && !held.some(([a]) => bare(a) === one.ident))) {
    const rows = await q(`[:find ?b ?d ?jd :where ${among('?t', own)} [?b :block/tags ?t] [?b :${prop.ident} ?v] [?v :block/journal-day ?d] [?b :block/page ?pg] [?pg :block/journal-day ?jd]]`);
    dated.set(prop.ident, { same: rows.filter(([, d, jd]) => d === jd).length, other: rows.filter(([, d, jd]) => d !== jd).length });
  }
  return { uuid: at.uuid, tags: own, tagIndex, props, held: new Set(held.map(([a]) => bare(a))), linked: linkedRefs.map(([r]) => ({ id: r, tags: tagsFor(r) })).filter(one => one.tags.length),
    page: isId(pageId) ? { id: pageId, tags: tagsFor(pageId), day: Number(pageDay) || 0 } : null, dated };
}

// The page of a name, as Logseq keeps names (small letters); one in the Recycle is answered too, and said to be gone.
async function pageNamed(name) {
  const low = String(name || '').trim().toLowerCase();
  if (!low) return null;
  const [found, gone] = await Promise.all([q(`[:find ?u :where [?b :block/name ${JSON.stringify(low)}] [?b :block/uuid ?u]]`), q(`[:find ?u :where [?b :block/name ${JSON.stringify(low)}] [?b :logseq.property/deleted-at] [?b :block/uuid ?u]]`)]);
  if (!found.length) return null;
  const lost = new Set(gone.map(([u]) => String(u))), live = found.map(([u]) => String(u)).find(u => !lost.has(u));
  return live ? { uuid: live.toLowerCase(), gone: false } : { uuid: String(found[0][0]).toLowerCase(), gone: true };
}
/* A node's bullets as an outline, in the order they stand: [{ id, uuid, depth, words }]. words are as a person reads them: a link
   as [[the node's name]], which is also what Logseq takes back when the words are written again. */
async function outline(uuid, isPage) {
  if (!UUID.test(String(uuid || ''))) return [];
  let top = [];
  try { top = isPage ? await logseq.Editor.getPageBlocksTree(uuid) : (await logseq.Editor.getBlock(uuid, { includeChildren: true }))?.children; } catch (error) { top = []; }
  const out = [], inOrder = (a, b) => (String(a.order || '') < String(b.order || '') ? -1 : String(a.order || '') > String(b.order || '') ? 1 : 0);
  const walk = (blocks, depth) => { for (const block of (Array.isArray(blocks) ? blocks : []).filter(one => one && one.uuid && isId(one.id)).sort(inOrder)) { out.push({ id: block.id, uuid: String(block.uuid).toLowerCase(), depth, words: String(block.fullTitle ?? block.title ?? '') }); walk(block.children, depth + 1); } };
  walk(top, 0);
  if (!out.length) return out;
  // The words a property holds are a block of their own to Logseq, kept under the node: they are a value, not a bullet.
  const values = new Set((await q(`[:find ?b :where ${among('?b', out.map(line => line.id))} [?b :logseq.property/created-from-property _]]`)).map(([b]) => b));
  if (!values.size) return out;
  const kept = [];
  for (let i = 0; i < out.length; i++) {
    if (!values.has(out[i].id)) { kept.push(out[i]); continue; }
    const depth = out[i].depth;
    while (i + 1 < out.length && out[i + 1].depth > depth) i++;
  }
  return kept;
}
/* What a node holds under each of the person's properties: ident -> [{ raw, text, uuid }]. raw is what is written to give a node
   the same value (the id of a node, a day or a set choice; a number; words; true or false). uuid is set where the value is a node
   or a day, so that it can be gone to. (held(ids), above, answers the words alone, by the property's name, for many nodes.) */
async function holds(id) {
  const out = new Map();
  if (!isId(id)) return out;
  const [rows, known] = await Promise.all([q(`[:find ?a ?v :where [${id} ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")]]`), schema()]);
  const ids = [...new Set(rows.map(([, v]) => v).filter(v => isId(v) && v < STAMP))];
  const [titles, numbers, picked] = ids.length ? await Promise.all([
    q(`[:find ?v ?u ?t ?d :where ${among('?v', ids)} [?v :block/uuid ?u] [(get-else $ ?v :block/title "") ?t] [(get-else $ ?v :block/journal-day 0) ?d]]`),
    q(`[:find ?v ?n :where ${among('?v', ids)} [?v :logseq.property/value ?n]]`), q(`[:find ?v :where ${among('?v', ids)} [?v :block/closed-value-property _]]`)]) : [[], [], []];
  const about = new Map(titles.map(([v, u, t, d]) => [v, { uuid: String(u).toLowerCase(), title: String(t ?? ''), day: Number(d) || 0 }])), number = new Map(numbers), choice = new Set(picked.map(([v]) => v));
  for (const [attr, v] of rows) {
    const ident = bare(attr), type = known.props.get(ident)?.type || 'default', it = about.get(v);
    const value = type === 'checkbox' ? { raw: v === true, text: v === true ? 'Yes' : 'No' }
      : type === 'datetime' && typeof v === 'number' ? { raw: v, text: D.short(dayOfTime(v)) }
      : type === 'node' || type === 'date' ? { raw: v, text: (type === 'date' && it?.day ? D.short(it.day) : '') || it?.title || '', uuid: it?.uuid || '' }
      : number.has(v) ? { raw: number.get(v), text: String(number.get(v)) }
      : it ? { raw: choice.has(v) ? v : it.title, text: it.title } : { raw: v, text: String(v) };
    if (!out.has(ident)) out.set(ident, []);
    out.get(ident).push(value);
  }
  for (const values of out.values()) values.sort((a, b) => String(a.text).localeCompare(String(b.text)));
  return out;
}
// The set choices of the person's properties, in the order Logseq lists them: ident -> [{ raw, text }], raw the choice's id.
async function choices() {
  const rows = await q('[:find ?i ?v ?t ?o :where [?v :block/closed-value-property ?p] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [(get-else $ ?v :block/title "") ?t] [(get-else $ ?v :block/order "") ?o]]');
  const numbers = new Map(rows.length ? await q(`[:find ?v ?n :where ${among('?v', rows.map(([, v]) => v))} [?v :logseq.property/value ?n]]`) : []), out = new Map();
  for (const [ident, v, title, order] of [...rows].sort((a, b) => (String(a[3]) < String(b[3]) ? -1 : String(a[3]) > String(b[3]) ? 1 : a[1] - b[1]))) {
    const key = bare(ident);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push({ raw: v, text: String(title) || String(numbers.get(v) ?? '') });
  }
  return out;
}

async function recent(n = 8) {
  let uuids = [];
  try { const got = await logseq.App.getCurrentGraphRecent?.(); if (Array.isArray(got)) uuids = got.map(one => String(one?.uuid || one?.['block/uuid'] || one || '').toLowerCase()).filter(uuid => UUID.test(uuid)); } catch (error) { uuids = []; }
  if (uuids.length) return byUuids([...new Set(uuids)].slice(0, n));
  // Logseq keeps no list yet (a graph just opened): the pages changed last stand in for it.
  const rows = await q(`[:find ?b ?u ?at :where [?b :block/name _] [?b :block/uuid ?u] [?b :block/updated-at ?at] (not [?b :block/journal-day _]) (not [?b :logseq.property/built-in? true]) (not [?b :block/tags :logseq.class/Property]) (not [?b :block/tags :logseq.class/Tag]) ${LIVE}]`);
  return byUuids(rows.sort((a, b) => Number(b[2]) - Number(a[2])).slice(0, n).map(([, uuid]) => String(uuid).toLowerCase()));
}
const pageNames = () => once('pageNames', async () => (await q(`[:find ?b ?u ?title :where [?b :block/name _] [?b :block/uuid ?u] [?b :block/title ?title] (not [?b :block/journal-day _]) (not [?b :logseq.property/built-in? true]) ${LIVE}]`))
  .map(([id, uuid, title]) => ({ id, uuid: String(uuid).toLowerCase(), title: String(title) })).filter(page => page.title));

G.read = { recent, pageNames, pageNamed, outline, holds, choices, recycled, held, where, withLines, byUuids, schema, writing, search, tagged, values, tasks, journal, q, node, opened, describe, pointingAt, dues, names, properties, statuses, tags, tagIds, tagPairs, propertyCounts, relations, holders, heldUnder, graph, newPages, tagsOf, forget: () => kept.clear(), isId, UUID };
})();
