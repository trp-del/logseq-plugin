/* The one place that reads the graph and the one place that writes it. Reads: every tag of yours with the tags it
   extends and the properties it declares, every property with its kind and range, the nodes under each tag, which nodes
   hold which property, what a relation's values are tagged, the newest node of each tag; all in a few datascript rounds,
   into the raw shape core/model.js builds from. Writes: Logseq's own editor calls, each one line, called only by
   logseq/apply.js at Apply and Undo. Only Logseq's own idents are named here (user.class/, user.property/,
   logseq.class/Tag, logseq.property.class/extends and /properties, logseq.property/classes). Checked against Logseq 2.0.2. */
(function () {
const S = window.Structure;
const query = async q => { const rows = await logseq.DB.datascriptQuery(q); return Array.isArray(rows) ? rows : []; };
// A pulled map's keys come back shortened ("block/title" as "title"), sometimes with a colon; idents sometimes with one.
const bare = v => String(v ?? '').replace(/^:/, '');
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = v => typeof v === 'number' ? v : pick(v, 'db/id');
const listOf = v => v == null ? [] : Array.isArray(v) ? v : [v];
const LIVE = '(not [?b :logseq.property/deleted-at _])';
const EXTENDS = 'logseq.property.class/extends', CLASS_PROPS = 'logseq.property.class/properties', RANGE = 'logseq.property/classes';

/* The whole reading. A few hundred milliseconds on a large graph. */
async function read() {
  const [tagRows, propRows, choiceRows, nodeRows, holderRows, pointedRows, newestRows] = await Promise.all([
    query(`[:find (pull ?t [:db/id :block/uuid :block/title :db/ident {:${EXTENDS} [:db/id :db/ident]} {:${CLASS_PROPS} [:db/id]}]) :where [?t :block/tags :logseq.class/Tag] [?t :db/ident _]]`),
    query(`[:find (pull ?p [:db/id :db/ident :block/uuid :block/title :logseq.property/type :db/cardinality {:${RANGE} [:db/id]}]) :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`),
    query('[:find ?p :where [?v :block/closed-value-property ?p]]').catch(() => []),
    query(`[:find ?t ?b ?u :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t] [?b :block/uuid ?u] ${LIVE}]`),
    query(`[:find ?a ?b :where [?b :block/tags ?t] [?t :block/tags :logseq.class/Tag] [?b ?a _] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] ${LIVE}]`).catch(() => []),
    query(`[:find ?a ?t (count ?v) :where [?b ?a ?v] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?v :block/tags ?t] [?t :block/tags :logseq.class/Tag]]`).catch(() => []),
    query(`[:find ?t (max ?c) :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t] [?b :block/created-at ?c] ${LIVE}]`).catch(() => []),
  ]);
  const own = new Map();   // the graph's own tags, by id
  for (const [t] of tagRows) { const ident = bare(pick(t, 'db/ident')); if (/^user\.class\//.test(ident)) own.set(idOf(t), t); }
  const tags = [...own.values()].map(t => ({ id: idOf(t), uuid: String(pick(t, 'block/uuid') ?? ''), title: String(pick(t, 'block/title') ?? ''),
    parents: listOf(pick(t, EXTENDS)).map(idOf).filter(id => own.has(id)), props: listOf(pick(t, CLASS_PROPS)).map(idOf).filter(id => id != null) }));
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
  return { tags, props, nodes, holders, pointed, newest };
}
// A tag's nodes with their words, newest first, for the list the card's count opens (a few hundred at most).
async function nodesOf(tagId, limit = 400) {
  const rows = await query(`[:find ?u ?title ?c ?pg :where [?b :block/tags ${tagId}] [?b :block/uuid ?u] [?b :block/title ?title] [(get-else $ ?b :block/created-at 0) ?c] [(get-else $ ?b :block/page 0) ?pg] ${LIVE}]`).catch(() => []);
  return rows.map(([u, title, c, pg]) => ({ uuid: String(u), title: String(title), created: Number(c) || 0, isPage: !pg })).sort((a, b) => b.created - a.created).slice(0, limit);
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
// The tag a page holds, for the sidebar opening on the page's tag: the page on screen, by its uuid or name.
async function tagOfPage(page) {
  if (!page) return null;
  const rows = await query(`[:find ?t :where [?p :block/uuid #uuid "${page}"] [?p :block/tags ?t] [?t :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.class")]]`).catch(() => []);
  return rows[0]?.[0] ?? null;
}
// Nodes holding a value that points at a page (a tag's own page, before it is deleted): the node and the property.
const valueRefs = async pageId => (await query(`[:find ?u ?a :where [?b ?a ${pageId}] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?b :block/uuid ?u]]`).catch(() => [])).map(([u, a]) => ({ uuid: String(u), ident: bare(a) }));
const valueIds = async (uuid, ident) => (await query(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${ident} ?v]]`).catch(() => [])).map(([v]) => v);
const rangeIds = async propUuid => (await query(`[:find ?c :where [?p :block/uuid #uuid "${propUuid}"] [?p :${RANGE} ?c]]`).catch(() => [])).map(([c]) => c);
const setValues = (uuid, ident, ids) => logseq.Editor.upsertBlockProperty(uuid, ident, ids.length === 1 ? ids[0] : ids, { entityId: true, reset: true });
const tagIdByUuid = async uuid => (await query(`[:find ?t :where [?t :block/uuid #uuid "${uuid}"] [?t :block/tags :logseq.class/Tag]]`).catch(() => []))[0]?.[0] ?? null;
const classPropIds = async tagUuid => (await query(`[:find ?p :where [?t :block/uuid #uuid "${tagUuid}"] [?t :${CLASS_PROPS} ?p]]`)).map(([id]) => id);

/* THE writes. A tag's declared properties and a property's range are lists Logseq lets a plugin only clear and fill
   again, so taking one value out reads the list, clears it and puts the others back. */
const addExtends = (tagUuid, parentUuid) => logseq.Editor.addTagExtends(tagUuid, parentUuid);
const removeExtends = (tagUuid, parentUuid) => logseq.Editor.removeTagExtends(tagUuid, parentUuid);
const rename = (uuid, name) => logseq.Editor.renamePage(uuid, name);
const addTag = (nodeUuid, tagUuid) => logseq.Editor.addBlockTag(nodeUuid, tagUuid);
const removeTag = (nodeUuid, tagUuid) => logseq.Editor.removeBlockTag(nodeUuid, tagUuid);
const addClassProp = (tagUuid, propId) => logseq.Editor.upsertBlockProperty(tagUuid, CLASS_PROPS, propId, { entityId: true });
async function removeClassProp(tagUuid, propId) {
  const had = await classPropIds(tagUuid);
  if (!had.includes(propId)) return;
  await logseq.Editor.removeBlockProperty(tagUuid, CLASS_PROPS);
  for (const id of had) if (id !== propId) await addClassProp(tagUuid, id);
}
async function setRange(propUuid, tagIds) {
  await logseq.Editor.removeBlockProperty(propUuid, RANGE).catch(() => {});
  for (const id of tagIds) await logseq.Editor.upsertBlockProperty(propUuid, RANGE, id, { entityId: true });
}
async function makeTag(name) {
  const page = await logseq.Editor.createPage(name, {}, { redirect: false, class: true, createFirstBlock: false });
  if (!page?.uuid) throw new Error(`${name} could not be made a tag`);
  return { uuid: String(page.uuid), id: page.id ?? (await tagIdByUuid(String(page.uuid))) };
}
const deleteTag = uuid => logseq.Editor.deletePage(uuid);
const editing = () => Promise.resolve(logseq.Editor.checkEditing?.()).then(v => !!v).catch(() => false);

S.db = { query, read, nodesOf, valuesOf, nodesWhere, tagOfPage, tagIdByUuid, valueRefs, valueIds, rangeIds, setValues, addExtends, removeExtends, rename, addTag, removeTag, addClassProp, removeClassProp, setRange, makeTag, deleteTag, editing, bare, pick, idOf };
})();
