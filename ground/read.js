/* GROUND: the one way the plugin reads the graph. Nothing here draws.
     read.q(query)            a question in, rows out
     read.node(uuid)          { id, uuid, day } of a node by its uuid (day: the journal day, when it is one), or null
     read.opened(to)          the node a link leads to, by its uuid or a page's name: { id, uuid, title, isPage, kind }
                              (kind: 'tag' or 'property' for the page of one, else ''), or null
     read.describe(ids)       id -> the node as a line shows it: { id, uuid, words, tag, tags, day, dayFrom, status, isPage, written, dates, made, changed }
                              written: the journal day it is written on; dates: { name: day } every day it holds; made, changed: times
                              tag: its first tag of the person's own (or Task) by name; tags: every one of them, [{ id, title }],
                              by name; day: its Date property (the one named
                              Date first, else the earliest), else the journal day it is written on; status: the id of its Status
     read.pointingAt(id)      { links: [{ prop, node }], mentions: [node] }   what holds this node as a value, what names it
                              (in its own words, or in the words of a value it holds under one of the person's properties)
     read.dues(day)           [{ which, node }]   what Logseq's Scheduled and Deadline put on a journal day
     read.names(uuids)        uuid -> the node's name as plain words
     read.properties()        ident -> { ident, title, uuid, type }   the person's own properties
     read.statuses()          Logseq's statuses in its order: [{ id, name, title, icon }]
     read.tags()              id -> { id, title, uuid, parents: [id] }   the person's own tags and what each sits under
     read.tagsOf(id)          the ids of a node's own tags
     read.tagIds()            the ids of the person's tags as they are this moment (never kept)
     read.tagPairs()          [[tag id, node id]]   which node holds which of the person's tags
     read.holding()           property ident -> [node id]   the nodes that hold something under each of the person's properties
     read.relations()         [[tag id, property ident, tag id, n]]   n nodes of the first tag hold, under the property, a node of the second
     read.holders(ident)      the nodes holding a value under a property: [{ id, uuid, words, tag, values: [{ raw, text }] }]
                              raw: a node's, a day's or a file's id; a time in milliseconds; a number; words; true or false.
                              A value in words that has bullets written under it says how many (under)
     read.under(uuid, ident)  what one node holds under one property, as the graph keeps it (never kept): { held: [value],
                              words: [{ id, uuid, words, under }] }, words being the values in words among them, each a
                              bullet of Logseq's own, with how many bullets it holds
     read.heldUnder(node, value)  the name of the property under which one node holds another (uuids), or ''
     read.graph()             the open graph's name
     read.newPages(since)     the plain, untagged pages made since a time in milliseconds (never kept): [{ id, uuid, title }]
     read.search(words)       Logseq's own search for the words, its order kept: [node]; before them, the page of that name
                              (in any case) and every node whose words are exactly these, read from the graph itself, so one
                              Logseq's search misses is still found. Words found in a value a node holds answer that node
     read.files(ids)          id -> the type of the file a node is ('pdf', 'png'), for those that are files
     read.fileTwin(file)      the node a file of this Mac (ground/touch.js file) already is in the graph: { uuid, title, gone }
                              (gone: it lies on a page in Logseq's Recycle), or null. Found as Logseq itself finds it before
                              it takes a file: by the checksum it keeps of every file (never kept)
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
     read.recentKinds()       Logseq's list of the pages opened last, in its order: [{ title, kind }] (kind: 'page', 'property'
                              or 'tag')
     read.pageNames()         every page of the person's own by name, journal days left out: [{ id, uuid, title }]
     read.folded(uuids)       what each folded node holds under it: uuid -> { task, done, image, pdf, file, due } (tasks open
                              and done at any depth, files right under it, the nearest day an open task is due)
     read.schema()            { props: ident -> { ident, title, type, hidden, at, range: [tag id], many }, byTag: tag id -> [ident] }
                              hidden: the property is set to "Hide by default" in Logseq
                              at: where Logseq shows it, 'properties' | 'block-left' | 'block-right' | 'block-below'
     read.writing(uuid)       what a bullet's words say, as core/sure.js takes it; null for a bullet with no tag of the person's
     read.typed(uuid)         a bullet's words as Logseq keeps them; null for a page, code or maths, and a property's value
     read.outline(uuid, isPage)  a node's bullets in their order: [{ id, uuid, depth, words, raw }], words as a person reads
                              them (a link as [[the node's name]]), raw as Logseq keeps them (a link as [[its id]])
     read.asKept(uuid, words) words read from a bullet (outline's words), perhaps changed by the person, made ready to be
                              written back to it: each link and tag the bullet holds is the link it is again, by its id
     read.chosen(asked)       what an export is asked for: { blocks: [uuid] } (the bullet a menu named, else the bullets picked,
                              else, where asked, the one being written), else { page } (the page named, or the one on screen)
     read.sheet(what, shown)  that page or those bullets as core/export.js takes them, every bullet with its facts, its names
                              read, embedded nodes and a query's rows in place; on a tag's page the nodes carrying the tag
                              too; null where there is no page. shown(uuid) answers a query's columns and row order on screen
     read.holds(id)           what one node holds under each of the person's properties: ident -> [{ raw, text, uuid }]
                              (a date and time reads whole, "Nov 27, 09:00", as in read.holders)
     read.choices()           the set choices of the person's properties: ident -> [{ raw, text }], in Logseq's order
     read.reach(id)           what a tag or a property reaches, for a merge: { tagged: [uuid] the nodes holding it as a tag,
                              named: [{ uuid, words }] bullets whose words link it, words raw as Logseq keeps them,
                              held: [{ uuid, ident, raws }] nodes holding it under one of the person's properties,
                              bullets: [uuid] the bullets on its own page, outermost only, props: [id] the properties it gives
                              its nodes, ranges: [{ uuid, ids }] the node properties whose values must hold it }
   Deleted nodes, and nodes on deleted pages, are never answered. (Logseq 2.0.2 keeps only a deleted page, with its bullets, in
   its Recycle: a deleted bullet is gone from the graph with what was under it. Tried 27 November 2026.) */
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
const live = variable => LIVE.split('?b').join(variable);   // the same, said of another variable
const MINE = /^user\.property\/[\w.-]+$/;
// A time as it reads: its day, then the hour and minute.
const timeText = ms => { const at = new Date(ms), two = n => String(n).padStart(2, '0'); return `${D.short(dayOfTime(ms))}, ${two(at.getHours())}:${two(at.getMinutes())}`; };

// What is asked once and kept until the graph changes (G.read.forget, called by the ground on every change).
const kept = new Map();
const once = (name, ask) => { if (!kept.has(name)) { const asked = ask(); kept.set(name, asked); asked.catch(() => kept.delete(name)); } return kept.get(name); };

const properties = () => once('properties', async () => {
  const rows = await q('[:find ?i ?t ?u ?ty ?h ?at :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?p :block/title ?t] [?p :block/uuid ?u] [(get-else $ ?p :logseq.property/type :default) ?ty] [(get-else $ ?p :logseq.property/hide? false) ?h] [(get-else $ ?p :logseq.property/ui-position :properties) ?at]]');
  return new Map(rows.map(([ident, title, uuid, type, hide, at]) => [bare(ident), { ident: bare(ident), title: String(title), uuid: String(uuid), type: bare(type), hidden: hide === true, at: bare(at) }]));
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
// The nodes that hold something under each of the person's properties: ident -> [node id], kept until the graph changes.
const holding = () => once('holding', async () => {
  const out = new Map();
  for (const [ident, b] of await q(`[:find ?i ?b :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?b ?i _] ${LIVE}]`)) { const key = bare(ident); if (!out.has(key)) out.set(key, []); out.get(key).push(b); }
  return out;
});
// Which node holds which of the person's tags: [[tag id, node id]], kept until the graph changes.
const tagPairs = () => once('tagPairs', async () => {
  const mine = await tagIds();
  return (await q(`[:find ?t ?b :where [?b :block/tags ?t] [?t :block/tags :logseq.class/Tag] ${LIVE}]`)).filter(([t]) => mine.has(t));
});
// How the person's tags are joined by their properties, from the real values: [[tag id, property ident, tag id, how many]], a
// node of the first tag holding, under the property, a node of the second. Kept until the graph changes.
const relations = () => once('relations', async () => {
  const mine = await tagIds();
  const rows = await q(`[:find ?ta ?a ?tb (count ?b) :where [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b ?a ?v] [?b :block/tags ?ta] [?v :block/tags ?tb] ${LIVE} ${live('?v')}]`);
  return rows.filter(([a, , b]) => mine.has(a) && mine.has(b)).map(([a, ident, b, n]) => [a, bare(ident), b, Number(n) || 0]);
});
/* The nodes that hold a value under one of the person's properties, each with what it holds: [{ id, uuid, words, tag, values }],
   a value { raw, text }: raw is what is written to give another node the same value (a node's or a day's id, a number, words),
   text is how it reads. Asked afresh each time. */
async function holders(ident) {
  const prop = (await schema()).props.get(ident);
  if (!prop || !MINE.test(ident)) return [];
  const rows = await q(`[:find ?b ?v :where [?b :${ident} ?v] ${LIVE}]`);
  if (!rows.length) return [];
  // A node, a day and a file are held by their id; a time is a number of its own, never an id (Logseq keeps it so).
  const ref = ['node', 'date', 'asset'].includes(prop.type), timed = prop.type === 'datetime';
  const ids = timed || prop.type === 'checkbox' ? [] : [...new Set(rows.map(([, v]) => v).filter(isId))];
  const [nodes, titles, numbers, kids] = await Promise.all([describe(rows.map(([b]) => b)),
    ids.length ? q(`[:find ?v ?t :where ${among('?v', ids)} [?v :block/title ?t]]`) : [], ids.length ? q(`[:find ?v ?n :where ${among('?v', ids)} [?v :logseq.property/value ?n]]`) : [],
    ids.length && !ref ? q(`[:find ?v (count ?c) :where ${among('?v', ids)} [?c :block/parent ?v]]`) : []]);   // a value in words is a bullet of Logseq's own, which can hold bullets
  const title = new Map(titles.map(([v, t]) => [v, String(t)])), number = new Map(numbers), below = new Map(kids);
  const names = await G.read.names([...nodes.values()].flatMap(node => W.named(node.words)));
  const value = v => timed && typeof v === 'number' ? { raw: v, text: timeText(v) }
    : !isId(v) || prop.type === 'checkbox' ? { raw: v, text: String(v) } : ref ? { raw: v, text: title.get(v) || '' } : number.has(v) ? { raw: number.get(v), text: String(number.get(v)) }
    : { raw: title.get(v) ?? '', text: title.get(v) ?? '', ...(below.get(v) ? { under: Number(below.get(v)) } : {}) };
  const out = new Map();
  for (const [b, v] of rows) { const node = nodes.get(b); if (!node) continue; if (!out.has(b)) out.set(b, { id: b, uuid: node.uuid, words: W.plain(W.firstLine(node.words).line, names), tag: node.tag, values: [] }); out.get(b).values.push(value(v)); }
  return [...out.values()];
}
/* What one node holds under one of the person's properties, as the graph keeps it, asked afresh each time: what a write looks at
   before it changes that. held: each value as kept (the id of a node, a day, a file, a set choice or a value's own bullet; a
   time; true or false). words: the values in words among them (no set choice, no number), each with how many bullets it holds. */
async function under(uuid, ident) {
  if (!UUID.test(String(uuid || '')) || !MINE.test(String(ident))) return { held: [], words: [] };
  const held = (await q(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${ident} ?v]]`)).map(([v]) => v), ids = held.filter(v => isId(v) && v < STAMP);
  if (!ids.length) return { held, words: [] };
  const [mine, kids] = await Promise.all([
    q(`[:find ?v ?u ?t :where ${among('?v', ids)} [?v :logseq.property/created-from-property _] [?v :block/uuid ?u] [?v :block/title ?t] (not [?v :block/closed-value-property _]) (not [?v :logseq.property/value _])]`),
    q(`[:find ?v (count ?c) :where ${among('?v', ids)} [?c :block/parent ?v]]`)]);
  const below = new Map(kids);
  return { held, words: mine.map(([id, u, t]) => ({ id, uuid: String(u).toLowerCase(), words: String(t ?? ''), under: Number(below.get(id)) || 0 })) };
}
/* Who holds a node under one of the person's properties: [[holder id, property ident, holder uuid]]. Each property is asked
   by its name, so Logseq looks the node up under it and does not go through everything the graph holds; should Logseq not
   take the question in that form, the plain one is asked. more: further clauses about ?b. */
async function holdersOf(id, more = '') {
  if (!isId(id)) return [];
  const idents = [...(await properties()).keys()].filter(ident => MINE.test(ident));
  if (!idents.length) return [];
  try { return await q(`[:find ?b ?attr ?u :where (or-join [?b ?attr] ${idents.map(ident => `(and [?b :${ident} ${id}] [(ground :${ident}) ?attr])`).join(' ')}) [?b :block/uuid ?u] ${more} ${LIVE}]`); }
  catch (error) { return q(`[:find ?b ?attr ?u :where [?b ?attr ${id}] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")] [?b :block/uuid ?u] ${more} ${LIVE}]`); }
}
// The name of the property under which one node holds another, '' when it holds it under none (a link in its words).
async function heldUnder(node, value) {
  if (!UUID.test(String(node)) || !UUID.test(String(value))) return '';
  const rows = await q(`[:find ?pt :where [?b :block/uuid #uuid "${node}"] [?v :block/uuid #uuid "${value}"] [?b ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :block/title ?pt]]`);
  return rows.length ? String(rows.map(([t]) => t).sort()[0]) : '';
}
const graph = async () => String((await logseq.App.getCurrentGraph())?.name || '');
async function newPages(since) {
  const rows = await q(`[:find ?p ?u ?t :where [?p :block/tags :logseq.class/Page] [?p :block/created-at ?c] [(> ?c ${Number(since) || 0})] [?p :block/uuid ?u] [?p :block/title ?t] (not [?p :logseq.property/deleted-at])]`);
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
  const tagOf = new Map(), tagsOn = new Map();
  for (const [b, t] of tagged) { const name = tags.get(t); if (!name) continue; if (!tagOf.has(b) || name < tagOf.get(b)) tagOf.set(b, name); if (!tagsOn.has(b)) tagsOn.set(b, []); tagsOn.get(b).push({ id: t, title: name }); }
  for (const all of tagsOn.values()) all.sort((a, z) => (a.title < z.title ? -1 : a.title > z.title ? 1 : a.id - z.id));
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
  for (const [b, uuid, title] of titled) out.set(b, { id: b, uuid: String(uuid).toLowerCase(), words: String(title ?? ''), tag: tagOf.get(b) || '', tags: tagsOn.get(b) || [], day: dayOf.get(b)?.day || 0, dayFrom: dayOf.get(b)?.from || '', status: statusOf.get(b) || 0, isPage: isPage.has(b),
    written: writtenOn.get(b) || 0, dates: datesOf.get(b) || {}, made: timeOf.get(b)?.made || 0, changed: timeOf.get(b)?.changed || 0 });
  return out;
}

async function pointingAt(id) {
  if (!isId(id)) return { links: [], mentions: [] };
  const [props, aliases, [[mine] = []]] = await Promise.all([properties(), q(`[:find ?a :where [${id} :block/alias ?a]]`), q(`[:find ?u :where [${id} :block/uuid ?u]]`)]);
  const targets = [id, ...aliases.map(([a]) => a).filter(isId)];
  // A node's own bullets do not point at it, and it does not point at itself.
  const outside = `[(not= ?b ${id})] (not [?b :block/page ${id}])`;
  const [held, named, uuids, valued] = await Promise.all([
    holdersOf(id, outside),
    q(`[:find ?b :where ${among('?t', targets)} [?b :block/refs ?t] [?b :block/page _] ${outside} (not [?b :logseq.property/created-from-property _]) ${LIVE}]`),   // a property's words-value is a block of its own to Logseq: it is no note
    q(`[:find ?u ?n :where ${among('?t', targets)} [?t :block/uuid ?u] [(get-else $ ?t :block/title "") ?n]]`),
    // ... and what such a value names is named by the node that holds the value (Logseq keeps a value under its node)
    q(`[:find ?b ?w :where ${among('?t', targets)} [?v :block/refs ?t] [?v :logseq.property/created-from-property ?p] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?v :block/parent ?b] [?v :block/title ?w] ${outside} ${LIVE}]`),
  ]);
  const nodes = await describe([...held.map(([b]) => b), ...named.map(([b]) => b), ...valued.map(([b]) => b)]);
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
  for (const [b, words] of valued) { const n = nodes.get(b); if (n && says(String(words ?? '')) && !mentions.includes(n)) mentions.push(n); }
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
  const typed = String(words).trim(), asked = typed.toLowerCase();
  /* Logseq's search reads an index of its own, which can lack older notes (seen 27 November 2026): the name is asked of the graph
     too. A page is found by its name in any case, a bullet by its exact words: both are looked up, where putting every node's
     words in small letters went through the whole graph at each search. */
  const [found, named] = await Promise.all([G.touch.search(typed, limit),
    asked ? Promise.all([q(`[:find ?b :where [?b :block/name ${JSON.stringify(asked)}] ${LIVE}]`), q(`[:find ?b :where [?b :block/title ${JSON.stringify(typed)}] ${LIVE}]`)]).then(rows => rows.flat()) : []]);
  const all = [...new Set([...named.map(([b]) => b), ...(found || [])].filter(isId))].slice(0, limit);
  if (!all.length) return [];
  /* A property's value in words is a block of its own to Logseq, kept under the node that holds it: words found in a value of
     one of the person's properties answer that node; any other value (a tag's description) is no note, and is left out. */
  const [values, holders] = await Promise.all([q(`[:find ?b :where ${among('?b', all)} [?b :logseq.property/created-from-property _]]`),
    q(`[:find ?b ?n :where ${among('?b', all)} [?b :logseq.property/created-from-property ?p] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b :block/parent ?n]]`)]);
  const value = new Set(values.map(([b]) => b)), holder = new Map(holders);
  const ids = [...new Set(all.map(id => (value.has(id) ? holder.get(id) : id)).filter(isId))];
  if (!ids.length) return [];
  // A tag and a property found by name say that they are one.
  const [nodes, kinds] = await Promise.all([describe(ids), q(`[:find ?b ?k :where ${among('?b', ids)} [?b :block/tags ?t] [?t :db/ident ?k]]`)]);
  const kind = new Map();
  for (const [b, k] of kinds) { const name = bare(k) === 'logseq.class/Tag' ? 'Tag' : bare(k) === 'logseq.class/Property' ? 'Property' : ''; if (name) kind.set(b, name); }
  return ids.map(id => { const node = nodes.get(id); return node && !node.tag && kind.has(id) ? { ...node, tag: kind.get(id) } : node; }).filter(Boolean);
}
async function files(ids) {
  const list = [...new Set(ids)].filter(isId);
  return new Map(list.length ? (await q(`[:find ?b ?type :where ${among('?b', list)} [?b :logseq.property.asset/type ?type]]`)).map(([b, type]) => [b, bare(type).toLowerCase()]) : []);
}
/* The node a file already is. Logseq keeps a checksum of every file it takes and takes no file whose checksum the graph
   already holds, wherever that node lies (its own code, editor/assets.cljs and db/async.cljs, 2.0.2): the same question is
   asked here, so what is answered null is what Logseq will take. A node still on a page of the person's is answered before
   one on a page in the Recycle. */
async function fileTwin(file) {
  const sum = String(file?.sum || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sum)) return null;
  const rows = await q(`[:find ?u ?t ?b :where [?b :logseq.property.asset/checksum "${sum}"] [?b :block/uuid ?u] [(get-else $ ?b :block/title "") ?t]]`);
  if (!rows.length) return null;
  const here = new Set((await q(`[:find ?b :where ${among('?b', rows.map(([, , b]) => b))} ${LIVE}]`)).map(([b]) => b));
  const [uuid, title, id] = rows.find(([, , b]) => here.has(b)) || rows[0];
  return { uuid: String(uuid).toLowerCase(), title: String(title || file.title || ''), gone: !here.has(id) };
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
async function typed(uuid) {
  if (!UUID.test(String(uuid || ''))) return null;
  const rows = await q(`[:find ?w :where [?b :block/uuid #uuid "${uuid}"] [?b :block/page _] [?b :block/title ?w]
    (not [?b :logseq.property/created-from-property _]) (not-join [?b] [?b :logseq.property.node/display-type ?kind] [(not= ?kind :quote)])]`);
  return rows.length ? String(rows[0][0]) : null;
}
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
/* A node's bullets as an outline, in the order they stand: [{ id, uuid, depth, words, raw }]. words are as a person reads them: a
   link as [[the node's name]]. Written back as they are, Logseq would look each name up again (a name that is a bullet's words
   became a new page, tried in Logseq 2.0.2, 27 November 2026): raw is the words as Logseq keeps them, each link by its id, and
   asKept, below, makes words a person changed ready to be written back. */
async function outline(uuid, isPage) {
  if (!UUID.test(String(uuid || ''))) return [];
  let top = [];
  try { top = isPage ? await logseq.Editor.getPageBlocksTree(uuid) : (await logseq.Editor.getBlock(uuid, { includeChildren: true }))?.children; } catch (error) { top = []; }
  const out = [], inOrder = (a, b) => (String(a.order || '') < String(b.order || '') ? -1 : String(a.order || '') > String(b.order || '') ? 1 : 0);
  const walk = (blocks, depth) => { for (const block of (Array.isArray(blocks) ? blocks : []).filter(one => one && one.uuid && isId(one.id)).sort(inOrder)) { out.push({ id: block.id, uuid: String(block.uuid).toLowerCase(), depth, words: String(block.fullTitle ?? block.title ?? ''), raw: String(block.title ?? '') }); walk(block.children, depth + 1); } };
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
const NAMED = /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi;
async function asKept(uuid, words) {
  const text = String(words ?? '');
  if (!UUID.test(String(uuid || ''))) return text;
  const [[kept] = []] = await q(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?t]]`);
  const held = [...String(kept ?? '').matchAll(NAMED)].map(m => m[1].toLowerCase());   // the bullet's links, in the order they stand
  if (!held.length) return text;
  // Each one's name as Logseq writes it out: its words, the links inside them written out in turn.
  const title = new Map();
  for (let ask = [...new Set(held)], depth = 0; ask.length && depth < 5; depth++) {
    for (const [u, t] of await q(`[:find ?u ?t :where ${amongUuids('?u', ask)} [?n :block/uuid ?u] [?n :block/title ?t]]`)) title.set(String(u).toLowerCase(), String(t ?? ''));
    ask = [...new Set([...title.values()].flatMap(t => [...t.matchAll(NAMED)].map(m => m[1].toLowerCase())))].filter(u => !title.has(u));
  }
  const nameOf = (u, depth = 0) => (title.get(u) ?? '').replace(NAMED, (all, inner) => (depth < 5 && title.has(inner.toLowerCase()) ? `[[${nameOf(inner.toLowerCase(), depth + 1)}]]` : all));
  // The same name may stand for two nodes: the first time it is met it is the first of them, the second time the second.
  const byName = new Map();
  for (const u of held) { const name = nameOf(u); if (name) { if (!byName.has(name)) byName.set(name, []); byName.get(name).push(u); } }
  let out = text;
  for (const [name, ids] of [...byName].sort((a, z) => z[0].length - a[0].length)) {
    let met = 0;
    const next = () => ids[Math.min(met++, ids.length - 1)];
    out = out.split(`[[${name}]]`).reduce((done, piece, i) => (i ? `${done}[[${next()}]]${piece}` : piece), '');
    // A tag of one word is read as #Name, with no brackets round it.
    if (/^[^\s#\[\]]+$/.test(name)) out = out.replace(new RegExp(`#${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![^\\s.,;:!?)\\]])`, 'g'), () => `#[[${next()}]]`);
  }
  return out;
}
/* What a node holds under each of the person's properties: ident -> [{ raw, text, uuid }]. raw is what is written to give a node
   the same value (the id of a node, a day, a file or a set choice; a time; a number; words; true or false). uuid is set where
   the value is a node, a day or a file, so that it can be gone to. (held(ids), above, answers the words alone, by the property's name, for many nodes.) */
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
      : type === 'datetime' && typeof v === 'number' ? { raw: v, text: timeText(v) }
      : type === 'node' || type === 'date' || type === 'asset' ? { raw: v, text: (type === 'date' && it?.day ? D.short(it.day) : '') || it?.title || '', uuid: it?.uuid || '' }
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
async function recentKinds() {
  const got = await Promise.resolve(logseq.App.getCurrentGraphRecent?.()).catch(() => null);
  return (Array.isArray(got) ? got : []).map(one => {
    const of = (Array.isArray(one?.tags) ? one.tags : []).map(tag => bare(tag?.ident || ''));
    return { title: String(one?.title || one?.originalName || one?.name || ''), kind: of.includes('logseq.class/Property') ? 'property' : of.includes('logseq.class/Tag') ? 'tag' : 'page' };
  });
}
const pageNames = () => once('pageNames', async () => (await q(`[:find ?b ?u ?title :where [?b :block/name _] [?b :block/uuid ?u] [?b :block/title ?title] (not [?b :block/journal-day _]) (not [?b :logseq.property/built-in? true]) ${LIVE}]`))
  .map(([id, uuid, title]) => ({ id, uuid: String(uuid).toLowerCase(), title: String(title) })).filter(page => page.title));

async function chosen({ uuid, page, blockFirst } = {}) {
  if (typeof uuid === 'string' && UUID.test(uuid)) return { blocks: [uuid] };
  const picked = await Promise.resolve(logseq.Editor.getSelectedBlocks()).catch(() => null);
  if (picked?.length) return { blocks: picked.map(block => block.uuid) };
  if (blockFirst) { const at = await Promise.resolve(logseq.Editor.getCurrentBlock()).catch(() => null); if (at?.uuid) return { blocks: [at.uuid] }; }
  return { page: page || '' };
}
/* An export's facts. The bullets come as Logseq's own trees; what each holds is read in one question for them all, what those
   point at in another, the names in a third. */
const SLICE = 300;
const slices = list => Array.from({ length: Math.ceil(list.length / SLICE) }, (_, i) => list.slice(i * SLICE, (i + 1) * SLICE));
async function attributes(uuids) {
  const out = new Map();
  for (const some of slices(uuids)) for (const [u, a, v] of await q(`[:find ?u ?a ?v :where ${amongUuids('?u', some)} [?b :block/uuid ?u] [?b ?a ?v]]`)) {
    // Logseq's API hands its own :block/… names back bare ("title", "tags"): they are given their namespace again.
    const key = String(u).toLowerCase(), said = bare(a), name = said.includes('/') ? said : `block/${said}`;
    if (!out.has(key)) out.set(key, new Map());
    const held = out.get(key);
    if (!held.has(name)) held.set(name, []);
    held.get(name).push(v);
  }
  return out;
}
const refId = v => isId(v) && v < STAMP ? v : v && typeof v === 'object' && isId(v.id ?? v['db/id']) ? (v.id ?? v['db/id']) : 0;
async function things(ids, known) {
  for (const some of slices([...new Set(ids)].filter(id => id && !known.has(id)))) {
    const these = among('?e', some);
    const [titled, ...rest] = await Promise.all([q(`[:find ?e ?u ?t :where ${these} [?e :block/uuid ?u] [(get-else $ ?e :block/title "") ?t]]`),
      ...[':db/ident', ':block/journal-day', ':logseq.property/value', ':logseq.property.asset/type', ':block/name'].map(attr => q(`[:find ?e ?v :where ${these} [?e ${attr} ?v]]`))]);
    const [ident, day, value, asset, name] = rest.map(rows => new Map(rows));
    for (const [id, uuid, title] of titled) known.set(id, { uuid: String(uuid).toLowerCase(), title: String(title ?? ''), ident: bare(ident.get(id) || ''), day: Number(day.get(id)) || 0,
      value: value.has(id) && typeof value.get(id) !== 'object' ? value.get(id) : null, asset: bare(asset.get(id) || ''), isPage: name.has(id) });
    for (const id of some) if (!known.has(id)) known.set(id, null);
  }
}
const REFS = ['block/tags', 'block/alias', 'block/link', 'logseq.property/status', 'logseq.property/priority', 'logseq.property/deadline', 'logseq.property/scheduled',
  'logseq.property/query', 'logseq.property/asset', 'logseq.property.pdf/hl-image', 'logseq.property/order-list-type'];
async function sheetFacts(uuids, read) {
  const held = await attributes(uuids), ids = [];
  const { props } = await schema();
  for (const attrs of held.values()) for (const [name, values] of attrs) {
    if (REFS.includes(name) || (props.has(name) && !['checkbox', 'datetime'].includes(props.get(name).type))) for (const v of values) if (refId(v)) ids.push(refId(v));
  }
  await things(ids, read.things);
  return held;
}
// What a bullet holds under the person's own properties, and the other names of a page: dates first, then by name.
function sheetProperties(attrs, props, known) {
  const out = [];
  for (const [name, values] of attrs) {
    const prop = name === 'block/alias' ? { title: 'Alias', type: 'node' } : props.get(name);
    if (!prop) continue;
    const said = values.map(v => {
      if (typeof v === 'boolean') return { text: v ? 'Yes' : 'No' };
      if (prop.type === 'datetime' && typeof v === 'number') return { time: v };
      const thing = known.get(refId(v));
      if (thing?.day) return { day: thing.day, text: thing.title };
      const text = thing ? String(thing.value ?? thing.title) : typeof v === 'object' ? '' : String(v);
      return text ? { text, ...(prop.type === 'url' ? { url: text } : {}) } : null;
    }).filter(Boolean);
    if (said.length) out.push({ ident: name, name: prop.title, type: prop.type, values: said, ...(prop.hidden ? { hidden: true } : {}) });
  }
  const dated = p => p.type === 'date' || p.type === 'datetime';
  return out.sort((a, b) => (dated(b) - dated(a)) || a.name.localeCompare(b.name));
}
function factsOf(uuid, attrs = new Map(), props, known) {
  const all = name => attrs.get(name) || [], first = name => all(name)[0], thing = name => known.get(refId(first(name)));
  const tags = all('block/tags').map(v => known.get(refId(v))).filter(Boolean), is = ident => tags.some(tag => tag.ident === ident);
  const text = name => { const one = thing(name); return String(one ? one.value ?? one.title : first(name) ?? ''); };
  const when = name => { const v = first(name); if (typeof v === 'number' && v >= STAMP) return { time: v }; const day = known.get(refId(v))?.day; return day ? { day } : null; };
  const status = thing('logseq.property/status'), area = thing('logseq.property.pdf/hl-image'), page = Number(first('logseq.property.pdf/hl-page'));
  const task = is('logseq.class/Task') || status ? { status: (status?.ident || '').replace(/^logseq\.property\/status\./, ''), priority: String(thing('logseq.property/priority')?.title || ''),
    deadline: when('logseq.property/deadline'), scheduled: when('logseq.property/scheduled') } : null;
  return { uuid, words: String(first('block/title') ?? ''), heading: first('logseq.property/heading'), display: bare(first('logseq.property.node/display-type')), lang: String(first('logseq.property.code/lang') ?? ''),
    numbered: first('logseq.property/order-list-type') != null && text('logseq.property/order-list-type') === 'number',
    tags: tags.filter(tag => !tag.ident.startsWith('logseq.class/')).map(tag => tag.title), task, properties: sheetProperties(attrs, props, known),
    template: is('logseq.class/Template'), value: first('logseq.property/created-from-property') != null,
    asset: bare(first('logseq.property.asset/type')), width: first('logseq.property.asset/width'),
    highlight: page ? { page, pdf: String(thing('logseq.property/asset')?.title || 'PDF'), area: area?.asset ? `assets/${area.uuid}.${area.asset}` : '' } : null,
    query: first('logseq.property/query') == null ? null : text('logseq.property/query'), embed: first('block/link') != null, link: refId(first('block/link')) };
}
const pageTree = uuid => Promise.resolve(logseq.Editor.getPageBlocksTree(uuid)).then(tree => tree || []).catch(() => []);
const blockTree = uuid => Promise.resolve(logseq.Editor.getBlock(uuid, { includeChildren: true })).catch(() => null);
const childrenOf = block => (Array.isArray(block?.children) ? block.children : []).filter(one => one && one.uuid).sort((a, b) => (String(a.order || '') < String(b.order || '') ? -1 : String(a.order || '') > String(b.order || '') ? 1 : 0));
const uuidsIn = (trees, out = []) => { for (const block of trees) if (block?.uuid) { out.push(String(block.uuid).toLowerCase()); uuidsIn(childrenOf(block), out); } return out; };
async function sheetNodes(trees, read, seen, depth) {
  const uuids = uuidsIn(trees);
  if (!uuids.length) return [];
  const [held, { props }] = await Promise.all([sheetFacts(uuids, read), schema()]);
  const make = async block => {
    const uuid = String(block.uuid).toLowerCase(), facts = factsOf(uuid, held.get(uuid), props, read.things), n = G.export.node(facts);
    read.words.push(n.words, ...n.properties.flatMap(p => p.values.map(v => v.text || '')));
    if (n.kind === 'embed') {
      const to = read.things.get(facts.link);
      if (to && !seen.has(to.uuid) && depth < 6) {
        const inside = to.isPage ? await pageTree(to.uuid) : [await blockTree(to.uuid)].filter(Boolean);
        n.children = await sheetNodes(inside, read, new Set([...seen, to.uuid]), depth + 1);
      }
      return n;
    }
    if (n.kind === 'query' && depth <= 2) {
      const on = await read.shown(uuid);
      n.query.columns = on?.columns || null;
      n.query.rows = await sheetNodes(await queryRows(n.query.text, uuid, on?.order), read, seen, depth + 1);
    }
    for (const child of childrenOf(block)) n.children.push(await make(child));
    // An area highlight's picture is kept as a bullet under the highlight: it is the quotation, not a picture of its own.
    if (n.kind === 'highlight' && n.highlight.area) n.children = n.children.filter(child => child.image?.file !== n.highlight.area);
    return n;
  };
  const out = [];
  for (const block of trees) if (block?.uuid) out.push(await make(block));
  return out;
}
// A query's rows, as Logseq's own query answers them (the query's bullet left out), in the order shown on screen where it is.
async function queryRows(text, own, order) {
  const asked = String(text || '').trim();
  if (!asked) return [];
  let rows = [];   // a plain query may begin with [[ too: only { and [:find are advanced ones
  try { rows = /^(\{|\[\s*:find\b)/.test(asked) ? await logseq.DB.customQuery(asked) : await logseq.DB.q(asked); } catch (error) { console.warn('Logseq Plugin: a query could not be read', asked, error); }
  const found = new Map();
  for (const row of Array.isArray(rows) ? rows.flat(Infinity) : []) { const uuid = String(row?.uuid || row?.['block/uuid'] || '').toLowerCase(); if (UUID.test(uuid) && uuid !== own) found.set(uuid, { uuid, children: [] }); }
  const first = (order || []).filter(uuid => found.has(uuid));
  return [...first.map(uuid => found.get(uuid)), ...[...found.values()].filter(row => !first.includes(row.uuid))];
}
// The names every bullet's words need; a reference to a PDF highlight reads as the quotation it is.
async function sheetNames(words) {
  const uuids = [...new Set(words.flatMap(W.named))];
  const out = await names(uuids);
  for (const some of slices(uuids)) for (const [u, t, page, pdf] of await q(`[:find ?u ?t ?page ?pdf :where ${amongUuids('?u', some)} [?b :block/uuid ?u] [?b :block/title ?t] [?b :logseq.property.pdf/hl-page ?page] [?b :logseq.property/asset ?a] [?a :block/title ?pdf]]`))
    out.set(String(u).toLowerCase(), `“${String(t ?? '').trim()}” (${pdf}, p. ${page})`);
  return out;
}
async function sheet(what = {}, shown = () => null) {
  const read = { things: new Map(), words: [], shown };
  const done = async made => ({ ...made, names: await sheetNames(read.words) });
  if (what.blocks) {
    const trees = [];
    for (const uuid of [...new Set(what.blocks.map(u => String(u).toLowerCase()))].filter(u => UUID.test(u))) { const tree = await blockTree(uuid); if (tree) trees.push(tree); }
    // A bullet whose parent is also asked for is written once, under it.
    const inside = new Set(trees.flatMap(tree => uuidsIn(childrenOf(tree))));
    const nodes = await sheetNodes(trees.filter(tree => !inside.has(String(tree.uuid).toLowerCase())), read, new Set(), 0);
    return nodes.length ? done({ kind: 'blocks', title: '', tags: [], properties: [], nodes, tagged: [] }) : null;
  }
  const page = what.page ? await logseq.Editor.getPage(what.page) : await logseq.Editor.getCurrentPage();
  if (!page?.uuid) return null;
  const uuid = String(page.uuid).toLowerCase();
  if (!page.name && !page.originalName && page.page) return sheet({ blocks: [uuid] }, shown);   // zoomed into a bullet
  const [held, { props }] = await Promise.all([sheetFacts([uuid], read), schema()]);
  const facts = factsOf(uuid, held.get(uuid), props, read.things);
  const trees = await pageTree(uuid), nodes = await sheetNodes(trees, read, new Set([uuid]), 0);
  let tagged = [];
  if ((held.get(uuid)?.get('block/tags') || []).some(v => read.things.get(refId(v))?.ident === 'logseq.class/Tag')) {
    // The nodes carrying the tag, as Logseq lists them under the tag's page: a bullet with everything under it, a page as one line.
    const own = new Set(uuidsIn(trees));
    const rows = await q(`[:find ?u ?t :where [?tag :block/uuid #uuid "${uuid}"] [?b :block/tags ?tag] [?b :block/uuid ?u] [(get-else $ ?b :block/title "") ?t] ${LIVE}]`);
    const isPage = new Set((await q(`[:find ?u :where [?tag :block/uuid #uuid "${uuid}"] [?b :block/tags ?tag] [?b :block/uuid ?u] [?b :block/name]]`)).map(([u]) => String(u).toLowerCase()));
    const carrying = [];
    for (const [u] of rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])))) {
      const key = String(u).toLowerCase();
      if (own.has(key) || key === uuid) continue;
      const tree = isPage.has(key) ? { uuid: key, children: [] } : await blockTree(key);
      if (tree) carrying.push(tree);
    }
    tagged = await sheetNodes(carrying, read, new Set([uuid]), 0);
    const self = facts.words;
    for (const n of tagged) { n.tags = n.tags.filter(tag => tag !== self); n.words = n.words.split(` #[[${uuid}]]`).join('').split(`#[[${uuid}]]`).join(''); }
  }
  read.words.push(facts.words, ...facts.properties.flatMap(p => p.values.map(v => v.text || '')));
  return done({ kind: 'page', title: facts.words || String(page.title || page.originalName || ''), tags: facts.tags, properties: facts.properties, nodes, tagged });
}

async function reach(id) {
  if (!isId(id)) return { tagged: [], named: [], held: [], bullets: [], props: [], ranges: [] };
  const [tagged, named, held, bullets, props, ranges] = await Promise.all([
    q(`[:find ?u :where [?b :block/tags ${id}] [?b :block/uuid ?u] ${LIVE}]`),
    q(`[:find ?u ?t :where [?b :block/refs ${id}] [?b :block/page _] [?b :block/title ?t] [?b :block/uuid ?u] ${LIVE}]`),
    holdersOf(id).then(rows => rows.map(([, attr, u]) => [u, attr])),
    q(`[:find ?u ?o :where [?b :block/page ${id}] [?b :block/parent ${id}] [?b :block/uuid ?u] [(get-else $ ?b :block/order "") ?o] ${LIVE}]`),
    q(`[:find ?p :where [${id} :logseq.property.class/properties ?p]]`),
    q(`[:find ?pu :where [?p :logseq.property/classes ${id}] [?p :block/uuid ?pu]]`),
  ]);
  const rangeOf = await Promise.all(ranges.map(async ([u]) => ({ uuid: String(u), ids: (await q(`[:find ?c :where [?p :block/uuid #uuid "${String(u)}"] [?p :logseq.property/classes ?c]]`)).map(([c]) => c) })));
  const heldRaws = await Promise.all(held.map(async ([u, attr]) => ({ uuid: String(u), ident: bare(attr), raws: (await q(`[:find ?v :where [?b :block/uuid #uuid "${String(u)}"] [?b ${String(attr).startsWith(':') ? attr : ':' + attr} ?v]]`)).map(([v]) => v) })));
  return { tagged: tagged.map(([u]) => String(u)), named: named.map(([u, t]) => ({ uuid: String(u), words: String(t) })), held: heldRaws,
    bullets: bullets.sort((a, b) => (String(a[1]) < String(b[1]) ? -1 : 1)).map(([u]) => String(u)), props: props.map(([p]) => p), ranges: rangeOf };
}
async function folded(uuids) {
  const out = new Map(), roots = await q(`[:find ?u ?r ?pg :where ${amongUuids('?u', uuids)} [?r :block/uuid ?u] [?r :block/page ?pg]]`);
  if (!roots.length) return out;
  const tree = await q(`[:find ?b ?parent :where ${among('?pg', roots.map(r => r[2]))} [?b :block/page ?pg] [?b :block/parent ?parent] (not [?b :logseq.property/created-from-property _]) ${LIVE}]`);
  const kids = new Map(); for (const [b, parent] of tree) { if (!kids.has(parent)) kids.set(parent, []); kids.get(parent).push(b); }
  const below = new Map(), near = new Map();
  for (const [, r] of roots) { const all = [], seen = new Set(), walk = (b, depth) => { for (const c of kids.get(b) || []) if (!seen.has(c)) { seen.add(c); all.push(c); walk(c, depth + 1); } }; walk(r, 0); below.set(r, all); near.set(r, new Set(kids.get(r) || [])); }
  const ids = [...new Set([...below.values()].flat())];
  const [all, status, deadline, scheduled, files] = ids.length ? await Promise.all([statuses(),
    q(`[:find ?b ?s :where ${among('?b', ids)} [?b :logseq.property/status ?s]]`),
    q(`[:find ?b ?v :where ${among('?b', ids)} [?b :logseq.property/deadline ?v]]`), q(`[:find ?b ?v :where ${among('?b', ids)} [?b :logseq.property/scheduled ?v]]`),
    q(`[:find ?b ?type :where ${among('?b', ids)} (or-join [?b ?a] [(identity ?b) ?a] [?b :logseq.property/asset ?a]) [?a :logseq.property.asset/type ?type]]`).catch(() => [])]) : [[], [], [], [], []];
  const doneIds = new Set(all.filter(s => s.name === 'done').map(s => s.id)), shut = new Set(all.filter(s => /^(done|canceled|cancelled)$/.test(s.name)).map(s => s.id));
  const statusOf = new Map(status), kindOf = new Map(files.map(([b, type]) => { const k = bare(type).toLowerCase(); return [b, k === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(k) ? 'image' : 'file']; }));
  const journals = deadline.length || scheduled.length ? new Map(await q('[:find ?p ?d :where [?p :block/journal-day ?d]]')) : new Map(), dayOf = v => v > STAMP ? dayOfTime(v) : Number(journals.get(v)) || 0;
  const dueOf = new Map(); for (const [b, v] of [...scheduled, ...deadline]) { const day = dayOf(v); if (day && (!dueOf.has(b) || day < dueOf.get(b))) dueOf.set(b, day); }
  for (const [u, r] of roots) {
    const held = { task: 0, done: 0, image: 0, pdf: 0, file: 0, due: 0 };
    for (const b of below.get(r)) {
      const s = statusOf.get(b);
      if (s != null && doneIds.has(s)) held.done++;
      else if (s != null && !shut.has(s)) { held.task++; const day = dueOf.get(b); if (day && (!held.due || day < held.due)) held.due = day; }
      if (near.get(r).has(b) && kindOf.has(b)) held[kindOf.get(b)]++;
    }
    out.set(String(u).toLowerCase(), held);
  }
  return out;
}

G.read = { recentKinds, files, fileTwin, chosen, sheet, recent, pageNames, pageNamed, outline, holds, choices, recycled, held, where, withLines, byUuids, schema, typed, writing, search, tagged, values, tasks, journal, q, node, opened, describe, pointingAt, dues, names, properties, statuses, tags, tagIds, tagPairs, relations, holders, under, asKept, heldUnder, graph, newPages, tagsOf, forget: () => kept.clear(), isId, UUID, reach, folded, holding };
})();
