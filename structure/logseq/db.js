/* The one place that reads the graph and the one place that writes it. Reads: every tag of yours with the tags it
   extends and the properties it declares, every property with its kind and range, the nodes under each tag, which nodes
   hold which property, what a relation's values are tagged, the newest node of each tag; all in a few datascript rounds,
   into the raw shape core/model.js builds from. Writes: Logseq's own editor calls, each one line, called only by
   logseq/apply.js at Apply and Undo. Only Logseq's own idents are named here (user.class/, user.property/,
   logseq.class/Tag, logseq.property.class/extends and /properties, logseq.property/classes). Checked against Logseq 2.0.2. */
(function () {
const S = window.Structure;
// Structure's base (plugin.js, Door.base): its listeners, its passes on the screen watcher, Logseq's hooks and its stylesheets, taken off at stop.
S.base = window.PluginDoor.base('structure', { prefix: 'Structure: ' });
// The small readers are the door's (plugin.js). A pulled map's keys come back shortened ("block/title" as "title"), sometimes with a colon; idents sometimes with one.
const { query, bare, pick, idOf, listOf } = window.PluginDoor;
const LIVE = '(not [?b :logseq.property/deleted-at _])';
const EXTENDS = 'logseq.property.class/extends', CLASS_PROPS = 'logseq.property.class/properties', RANGE = 'logseq.property/classes';

/* The whole reading. A few hundred milliseconds on a large graph. */
async function read() {
  const [tagRows, propRows, choiceRows, nodeRows, holderRows, pointedRows, newestRows, bulletRows, linkRows, roadRows, refRows] = await Promise.all([
    query(`[:find (pull ?t [:db/id :block/uuid :block/title :db/ident {:${EXTENDS} [:db/id :db/ident]} {:${CLASS_PROPS} [:db/id]}]) :where [?t :block/tags :logseq.class/Tag] [?t :db/ident _]]`),
    query(`[:find (pull ?p [:db/id :db/ident :block/uuid :block/title :logseq.property/type :db/cardinality {:${RANGE} [:db/id]}]) :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`),
    query('[:find ?p :where [?v :block/closed-value-property ?p]]').catch(() => []),
    query(`[:find ?t ?b ?u :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t] [?b :block/uuid ?u] ${LIVE}]`),
    query(`[:find ?a ?b :where [?b :block/tags ?t] [?t :block/tags :logseq.class/Tag] [?b ?a _] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] ${LIVE}]`).catch(() => []),
    query(`[:find ?a ?t (count ?v) :where [?b ?a ?v] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?v :block/tags ?t] [?t :block/tags :logseq.class/Tag]]`).catch(() => []),
    query(`[:find ?t (max ?c) :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t] [?b :block/created-at ?c] ${LIVE}]`).catch(() => []),
    // What a tag's deletion takes with it, for the merge's sentence: the bullets written on its page, the bullets that link it in their words.
    query(`[:find ?t (count ?b) :where [?t :block/tags :logseq.class/Tag] [?b :block/page ?t] (not [?b :logseq.property/created-from-property _])]`).catch(() => []),
    query(`[:find ?t (count ?b) :where [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u] [?b :block/refs ?t] [(str ?u) ?us] [?b :block/title ?w] [(clojure.string/includes? ?w ?us)]]`).catch(() => []),
    // The relationships as they really are: how many nodes of a tag hold a node of another tag in a property.
    query(`[:find ?s ?a ?t (count-distinct ?b) :where [?b ?a ?v] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?v :block/tags ?t] [?t :block/tags :logseq.class/Tag] [?b :block/tags ?s] [?s :block/tags :logseq.class/Tag]]`).catch(() => []),
    // Everything that links to a tag's nodes, for the count before Apply.
    query(`[:find ?t (count ?r) :where [?t :block/tags :logseq.class/Tag] [?n :block/tags ?t] [?r :block/refs ?n]]`).catch(() => []),
  ]);
  const own = new Map();   // the graph's own tags, by id
  for (const [t] of tagRows) { const ident = bare(pick(t, 'db/ident')); if (/^user\.class\//.test(ident)) own.set(idOf(t), t); }
  const bullets = new Map(bulletRows), links = new Map(linkRows), refs = new Map(refRows);
  const tags = [...own.values()].map(t => ({ id: idOf(t), uuid: String(pick(t, 'block/uuid') ?? ''), title: String(pick(t, 'block/title') ?? ''),
    parents: listOf(pick(t, EXTENDS)).map(idOf).filter(id => own.has(id)), props: listOf(pick(t, CLASS_PROPS)).map(idOf).filter(id => id != null),
    bullets: Number(bullets.get(idOf(t))) || 0, links: Number(links.get(idOf(t))) || 0, refs: Number(refs.get(idOf(t))) || 0 }));
  const choice = new Set(choiceRows.map(([p]) => p));
  const props = propRows.map(([p]) => p).filter(p => /^user\.property\//.test(bare(pick(p, 'db/ident')))).map(p => ({ id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), ident: bare(pick(p, 'db/ident')), title: String(pick(p, 'block/title') ?? ''),
    type: bare(pick(p, 'logseq.property/type')) || 'default', many: /many$/.test(bare(pick(p, 'db/cardinality'))), choice: choice.has(idOf(p)), range: listOf(pick(p, RANGE)).map(idOf).filter(id => own.has(id)) }));
  const nodes = {};
  for (const [t, b, u] of nodeRows) { if (!own.has(t)) continue; (nodes[t] ||= []).push({ id: b, uuid: String(u) }); }
  const holders = {};
  for (const [a, b] of holderRows) (holders[bare(a)] ||= []).push(b);
  const pointed = pointedRows.filter(([, t]) => own.has(t)).map(([a, t, n]) => [bare(a), t, Number(n)]);
  const newest = {};
  for (const [t, c] of newestRows) if (own.has(t)) newest[t] = Number(c);
  const roads = roadRows.filter(([s, , t]) => own.has(s) && own.has(t)).map(([s, a, t, n]) => [s, bare(a), t, Number(n)]);
  return { tags, props, nodes, holders, pointed, newest, roads };
}
// The nodes the card's count counts, with their words and days, for the list it opens. The day is the margin's: when it happened, not
// when it was written: its date property, else the journal day it is written on.
// A node's words are stored with [[uuid]] and ((uuid)) where a page or a node is named: the names go in their place, as Logseq shows them.
const STORED = /\[\[([0-9a-f]{8}-[0-9a-f-]{27})\]\]|\(\(([0-9a-f]{8}-[0-9a-f-]{27})\)\)/gi;
async function named(titles) {
  const ids = new Set(titles.flatMap(t => [...t.matchAll(STORED)].map(m => (m[1] || m[2]).toLowerCase())));
  const names = new Map(ids.size ? (await query(`[:find ?u ?t :where [(ground [${[...ids].map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]] [?e :block/uuid ?u] [?e :block/title ?t]]`)).map(([u, t]) => [String(u).toLowerCase(), String(t)]) : []);
  return t => t.replace(STORED, (match, a, b) => names.get((a || b).toLowerCase()) ?? '…').replace(/\[\[([^\]]*)\]\]/g, '$1');
}
async function nodesOf(nodeIds) {
  const these = `[(ground [${nodeIds.join(' ')}]) [?b ...]]`;
  const [rows, dates, written] = await Promise.all([
    query(`[:find ?b ?u ?title ?c ?pg :where ${these} [?b :block/uuid ?u] [(get-else $ ?b :block/title "") ?title] [(get-else $ ?b :block/created-at 0) ?c] [(get-else $ ?b :block/page 0) ?pg] ${LIVE}]`),
    query(`[:find ?b ?d ?name :where ${these} [?b ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :logseq.property/type :date] [?p :block/title ?name] [?v :block/journal-day ?d]]`),
    query(`[:find ?b ?d :where ${these} [?b :block/page ?pg] [?pg :block/journal-day ?d]]`),
  ]);
  const dated = window.PluginDoor.datedDays(dates), onDay = new Map(written), words = await named(rows.map(row => String(row[2])));
  return rows.map(([id, u, title, c, pg]) => ({ id, uuid: String(u), title: words(String(title)), created: Number(c) || 0, day: dated.get(id) || Number(onDay.get(id)) || 0, isPage: !pg }));
}
// The values of a property among a tag's nodes, with how many nodes hold each (a choice or a link), for a split by value.
async function valuesOf(tagId, ident) {
  const rows = await query(`[:find ?v ?title (count ?b) :where [?b :block/tags ${tagId}] [?b :${ident} ?v] [?v :block/title ?title] ${LIVE}]`).catch(() => []);
  return rows.map(([v, title, n]) => ({ id: v, title: String(title), count: Number(n) })).sort((a, b) => b.count - a.count);
}
async function nodesWhere(tagId, ident, valueId) {
  const rows = await query(`[:find ?b ?u :where [?b :block/tags ${tagId}] [?b :${ident} ${valueId}] [?b :block/uuid ?u] ${LIVE}]`).catch(() => []);
  return rows.map(([id, u]) => ({ id, uuid: String(u) }));
}
/* A property's values, node by node, for a merge: Map of node id to [{ id, title, raw, day }]. A yes or no is held raw; anything
   else points at an entity: a node, a day, a choice, or the words of a text or number value. */
async function propValues(ident, type) {
  const at = `[?b :${ident} ?v] ${LIVE}`;
  const [rows, titles, nums, days] = await Promise.all([
    query(`[:find ?b ?v :where ${at}]`),
    type === 'checkbox' ? [] : query(`[:find ?v ?t :where ${at} [?v :block/title ?t]]`).catch(() => []),
    type === 'checkbox' ? [] : query(`[:find ?v ?n :where ${at} [?v :logseq.property/value ?n]]`).catch(() => []),
    type === 'checkbox' ? [] : query(`[:find ?v ?d :where ${at} [?v :block/journal-day ?d]]`).catch(() => []),
  ]);
  const title = new Map(titles), num = new Map(nums), day = new Map(days), out = new Map();
  for (const [b, v] of rows) {
    const id = typeof v === 'object' && v ? idOf(v) : v, entity = typeof id === 'number' && (title.has(id) || num.has(id) || day.has(id));
    const value = entity ? { id, title: String(title.get(id) ?? num.get(id) ?? ''), day: Number(day.get(id)) || 0 } : { raw: v };
    (out.get(b) || out.set(b, []).get(b)).push(value);
  }
  return out;
}
// A choice property's choices, by their words in lower case, for a merge into it.
const choicesOf = async propId => new Map((await query(`[:find ?t ?v :where [?v :block/closed-value-property ${propId}] [?v :block/title ?t]]`).catch(() => [])).map(([t, v]) => [String(t).toLowerCase(), v]));
const uuidOfNode = async id => (await query(`[:find ?u :where [${id} :block/uuid ?u]]`))[0]?.[0];
// The page of a name, for words that become a node: the id, and whether it was made here (so Undo takes it away again).
async function pageNamed(name) {
  const found = (await query(`[:find ?p :where [?p :block/name ${JSON.stringify(String(name).trim().toLowerCase())}] (not [?p :logseq.property/deleted-at _])]`))[0]?.[0];
  if (found != null) return { id: found };
  const page = await window.PluginDoor.write.createPage(name, {}, { redirect: false, createFirstBlock: false });
  return { id: page.id ?? (await query(`[:find ?p :where [?p :block/uuid #uuid "${page.uuid}"]]`))[0]?.[0], made: String(page.uuid) };
}
async function dayPage(day) {
  const found = (await query(`[:find ?p :where [?p :block/journal-day ${day}]]`))[0]?.[0];
  if (found != null) return { id: found };
  const page = await window.PluginDoor.write.createJournalPage(new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100));
  return { id: page.id ?? (await query(`[:find ?p :where [?p :block/journal-day ${day}]]`))[0]?.[0], made: String(page.uuid) };
}
/* A node's values of a property become exactly these. Ids point at entities; words and numbers are written as words, each its
   own value; a yes or no raw. None: the property comes off the node. */
async function putValues(node, ident, list) {
  if (!list.length) return window.PluginDoor.write.unsetValue(node, ident);
  if (list.every(v => v.id != null)) return setValues(node, ident, [...new Set(list.map(v => v.id))]);
  if (list.length === 1 || list.every(v => v.raw != null)) return window.PluginDoor.write.setValue(node, ident, list[0].raw ?? list[0].num ?? list[0].text ?? list[0].title, { reset: true });
  await window.PluginDoor.write.unsetValue(node, ident);
  for (const v of list) await window.PluginDoor.write.setValue(node, ident, v.id != null ? v.id : v.num ?? v.text ?? v.title, v.id != null ? { entityId: true } : {});
}
// The tag a page holds, for the sidebar opening on the page's tag: the page on screen, by its uuid or name.
async function tagOfPage(page) {
  if (!page) return null;
  const rows = await query(`[:find ?t :where [?p :block/uuid #uuid "${page}"] [?p :block/tags ?t] [?t :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.class")]]`).catch(() => []);
  return rows[0]?.[0] ?? null;
}
// Nodes holding a value that points at a page (a tag's own page, before it is deleted): the node and the property.
const valueRefs = async pageId => (await query(`[:find ?u ?a :where [?b ?a ${pageId}] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b :block/uuid ?u]]`)).map(([u, a]) => ({ uuid: String(u), ident: bare(a) }));
const valueIds = async (uuid, ident) => (await query(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${ident} ?v]]`)).map(([v]) => v);
const rangeIds = async propUuid => (await query(`[:find ?c :where [?p :block/uuid #uuid "${propUuid}"] [?p :${RANGE} ?c]]`)).map(([c]) => c);
const setValues = (uuid, ident, ids) => window.PluginDoor.write.setValue(uuid, ident, ids.length === 1 ? ids[0] : ids, { entityId: true, reset: true });
const tagIdByUuid = async uuid => (await query(`[:find ?t :where [?t :block/uuid #uuid "${uuid}"] [?t :block/tags :logseq.class/Tag] (not [?t :logseq.property/deleted-at _])]`))[0]?.[0] ?? null;
const titleOf = async uuid => (await query(`[:find ?w :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?w]]`))[0]?.[0];
// The nodes a tag holds this moment, fresh, for the last look before it is deleted.
const nodeUuids = async tagId => (await query(`[:find ?u :where [?b :block/tags ${tagId}] [?b :block/uuid ?u] ${LIVE}]`)).map(([u]) => String(u));
const classPropIds = async tagUuid => (await query(`[:find ?p :where [?t :block/uuid #uuid "${tagUuid}"] [?t :${CLASS_PROPS} ?p]]`)).map(([id]) => id);

/* THE writes. A tag's declared properties and a property's range are lists Logseq lets a plugin only clear and fill
   again, so taking one value out reads the list, clears it and puts the others back. */
const addExtends = (tagUuid, parentUuid) => window.PluginDoor.write.addExtends(tagUuid, parentUuid);
const removeExtends = (tagUuid, parentUuid) => window.PluginDoor.write.removeExtends(tagUuid, parentUuid);
const rename = (uuid, name) => window.PluginDoor.write.renamePage(uuid, name);
const addTag = (nodeUuid, tagUuid) => window.PluginDoor.write.addTag(nodeUuid, tagUuid);
const removeTag = (nodeUuid, tagUuid) => window.PluginDoor.write.removeTag(nodeUuid, tagUuid);
const addClassProp = (tagUuid, propId) => window.PluginDoor.write.setValue(tagUuid, CLASS_PROPS, propId, { entityId: true });
async function removeClassProp(tagUuid, propId) {
  const had = await classPropIds(tagUuid);
  if (!had.includes(propId)) return;
  await window.PluginDoor.write.unsetValue(tagUuid, CLASS_PROPS);
  for (const id of had) if (id !== propId) await addClassProp(tagUuid, id);
}
// Declared again, each one missing: what a failed clear left short gets its properties back.
async function putClassProps(tagUuid, ids) {
  const now = await classPropIds(tagUuid);
  for (const id of ids) if (!now.includes(id)) await addClassProp(tagUuid, id);
}
// The range becomes exactly tagIds. Cleared only when something leaves it, so an addition can lose nothing.
async function setRange(propUuid, tagIds) {
  const now = await rangeIds(propUuid);
  const leaves = now.some(id => !tagIds.includes(id));
  if (leaves) await window.PluginDoor.write.unsetValue(propUuid, RANGE);
  for (const id of tagIds) if (leaves || !now.includes(id)) await window.PluginDoor.write.setValue(propUuid, RANGE, id, { entityId: true });
}
// Logseq's createPage hands back whatever already holds a name, a tag, a page or a property, with no error (seen in 2.0.2).
const nameTaken = async name => (await query(`[:find ?p :where [?p :block/name ${JSON.stringify(String(name).trim().toLowerCase())}] (not [?p :logseq.property/deleted-at _])]`)).length > 0;
async function makeTag(name) {
  if (await nameTaken(name)) throw new Error(`“${name}” is already in the graph`);
  const page = await window.PluginDoor.write.createPage(name, {}, { redirect: false, class: true, createFirstBlock: false });
  if (!page?.uuid) throw new Error(`${name} could not be made a tag`);
  return { uuid: String(page.uuid), id: page.id ?? (await tagIdByUuid(String(page.uuid))) };
}
// A deleted tag made again. Its name may be held by now (two tags of one name, merged), and Logseq allows no rename onto a tag's name: the next free one.
async function remakeTag(name) {
  let free = name;
  for (let n = 2; await nameTaken(free); n++) free = `${name} ${n}`;
  return makeTag(free);
}
const deleteTag = uuid => window.PluginDoor.write.deletePage(uuid, query);
/* What an Undo may take away again (8 November 2026): a page or tag Apply made, only while nothing has been written on it or
   pointed at it since (PluginDoor.pageUntouched: a tagged node points at its tag too) and no tag extends it. */
const untouched = async uuid => await window.PluginDoor.pageUntouched(uuid, query) && !(await query(`[:find ?k :where [?t :block/uuid #uuid "${uuid}"] [?k :${EXTENDS} ?t]]`)).length;
// What a node holds under a property, to compare before an Undo writes over it (PluginDoor.valueStamp).
const stamp = (uuid, ident) => window.PluginDoor.valueStamp(uuid, ident, query);
// The bullets on a page's top level, in order, without the ones Logseq keeps for the page's own property values.
const pageBullets = async uuid => ((await logseq.Editor.getPageBlocksTree(uuid)) || []).filter(b => !b?.['logseq.property/created-from-property'] && !b?.createdFromProperty).map(b => String(b.uuid));
// Bullets moved, in their order, after the last bullet on another page (or as its first when it has none), with their children.
async function moveBullets(uuids, pageUuid) {
  let last = (await pageBullets(pageUuid)).at(-1);
  for (const uuid of uuids) {
    if (last) await window.PluginDoor.write.moveBlock(uuid, last, { before: false }); else await window.PluginDoor.write.moveBlock(uuid, pageUuid, { children: true });
    last = uuid;
  }
}
const graph = async () => (await logseq.App.getCurrentGraph())?.name || '';
const editing = () => Promise.resolve(logseq.Editor.checkEditing?.()).then(v => !!v).catch(() => false);

// A journal day, or a page that shares a day's name (a tag made with a day's name): Structure sets nothing above it.
const isDay = async uuid => /^[0-9a-f-]{36}$/i.test(uuid) && (await query(`[:find ?d :where [?p :block/uuid #uuid "${uuid}"] [?p :block/name ?n] [?j :block/name ?n] [?j :block/journal-day ?d]]`)).length > 0;
S.db = { propValues, choicesOf, uuidOfNode, pageNamed, dayPage, putValues, query, read, isDay, nodesOf, valuesOf, nodesWhere, tagOfPage, tagIdByUuid, titleOf, nodeUuids, graph, valueRefs, valueIds, rangeIds, classPropIds, putClassProps, setValues, addExtends, removeExtends, rename, addTag, removeTag, addClassProp, removeClassProp, setRange, nameTaken, makeTag, remakeTag, deleteTag, untouched, stamp, pageBullets, moveBullets, editing, bare, pick, idOf };
})();
