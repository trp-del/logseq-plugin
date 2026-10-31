/* The one place that reads the graph. Datascript with Logseq's own idents, as the plugin SDK's guides do; Logseq's own
   search engine for the words. Nothing here writes but one thing: a page made from the find line, through Logseq's own
   editor call. Shapes checked in Logseq 2.0.2 on the Illness Test Graph (2026-10-30): a user property's ident is in the
   "user.property" namespace; a value is an entity with a title (a node, a page, a journal day for a date, the text or
   number itself for words and numbers); Logseq's search answers { blocks: [{ uuid, title, tags, page?, page }] } with the
   found letters between $pfts_2lqh>$ and $<pfts_2lqh$. */
(function () {
const Find = window.Find;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bare = value => String(value ?? '').replace(/^:/, '');
const query = async q => { const rows = await logseq.DB.datascriptQuery(q); return Array.isArray(rows) ? rows : []; };
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const LIVE = '(not [?b :logseq.property/deleted-at _])';
const USER_PROP = '[?prop :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")]';
const isId = id => Number.isSafeInteger(id) && id > 0;
const idsIn = (variable, ids) => `[(ground [${[...new Set(ids)].filter(isId).join(' ')}]) [${variable} ...]]`;
const uuidsIn = (variable, uuids) => `[(ground [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
const MARKERS = /\$pfts_2lqh>\$|\$<pfts_2lqh\$/g;
const REF = /\[\[([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]\]|\(\(([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\)\)/gi;
// Logseq's own kinds are not kinds of yours; Task is kept, since tasks are things people look for.
const OWN = /^logseq\.class\//;

/* Every tag: id, uuid, title, ident, the tags it extends; and, for each, how many live nodes carry it or a tag under it. */
let tags = null;
async function tagIndex(force) {
  if (tags && !force) return tags;
  const [rows, links, carried] = await Promise.all([
    query('[:find ?t ?u ?title ?ident :where [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title] [?t :db/ident ?ident]]'),
    query('[:find ?c ?p :where [?c :logseq.property.class/extends ?p]]'),
    query(`[:find ?t ?b :where [?b :block/tags ?t] [?t :block/tags :logseq.class/Tag] ${LIVE}]`),
  ]);
  const byId = new Map(rows.map(([id, u, title, ident]) => [id, { id, uuid: String(u), title: String(title), ident: bare(ident), own: OWN.test(bare(ident)), kids: [], parents: [] }]));
  for (const [c, p] of links) { const child = byId.get(c), parent = byId.get(p); if (child && parent && parent.ident !== 'logseq.class/Root') { parent.kids.push(child); child.parents.push(parent); } }
  const direct = new Map();
  for (const [t, b] of carried) { if (!direct.has(t)) direct.set(t, new Set()); direct.get(t).add(b); }
  // Under a tag: its own nodes and those of every tag below it, each node once.
  const under = (tag, seen = new Set()) => {
    if (tag.under) return tag.under;
    const set = new Set(direct.get(tag.id) || []);
    seen.add(tag.id);
    for (const kid of tag.kids) if (!seen.has(kid.id)) for (const b of under(kid, seen)) set.add(b);
    tag.under = set;
    return set;
  };
  for (const tag of byId.values()) under(tag);
  const byUuid = new Map([...byId.values()].map(t => [t.uuid, t]));
  tags = { byId, byUuid, list: [...byId.values()] };
  return tags;
}
// The kinds offered: your tags (and Task), those with nodes first, most first.
async function kinds() {
  const index = await tagIndex();
  return index.list.filter(t => (!t.own || t.ident === 'logseq.class/Task') && t.under.size).sort((a, b) => b.under.size - a.under.size || a.title.localeCompare(b.title))
    .map(t => ({ id: t.id, uuid: t.uuid, title: t.title, count: t.under.size }));
}
// The first of a node's tags that is a kind of yours, by title; Logseq's own left out.
function kindOf(index, tagIds) {
  const own = tagIds.map(id => index.byId.get(id)).filter(t => t && (!t.own || t.ident === 'logseq.class/Task'));
  own.sort((a, b) => a.title.localeCompare(b.title));
  return own[0] || null;
}

/* The nodes under a kind: id, uuid, title (refs as names), the page they sit on, the day (the page's journal day, else
   a date property's), their kind. Up to `limit`, newest day first. */
async function nodesOfKind(tagId, limit = 3000) {
  const index = await tagIndex();
  const tag = index.byId.get(tagId);
  if (!tag) return [];
  const ids = [...tag.under].slice(0, limit);
  return details(ids, []);
}
/* The details of nodes given by id or by uuid: [{ id, uuid, title, text, isPage, page: { uuid, title, journal }, day, tags, kind }]. */
async function details(ids, uuids) {
  const index = await tagIndex();
  const where = ids.length ? `${idsIn('?b', ids)} [?b :block/uuid ?u]` : `${uuidsIn('?u', uuids)} [?b :block/uuid ?u]`;
  if (!ids.length && !uuids.length) return [];
  // A page has no page of its own: the page a block sits on is read apart (a lookup on a missing page id throws).
  const [basics, pages, tagRows, days, dates] = await Promise.all([
    query(`[:find ?b ?u ?title ?name :where ${where} [?b :block/title ?title] [(get-else $ ?b :block/name "") ?name]]`),
    query(`[:find ?b ?ptitle ?pday :where ${where} [?b :block/page ?pg] [?pg :block/title ?ptitle] [(get-else $ ?pg :block/journal-day 0) ?pday]]`),
    query(`[:find ?b ?t :where ${where} [?b :block/tags ?t]]`),
    query(`[:find ?b ?d :where ${where} [?b :block/journal-day ?d]]`),
    query(`[:find ?b ?d :where ${where} [?b ?a ?v] ${USER_PROP} [?prop :logseq.property/type :date] [?v :block/journal-day ?d]]`),
  ]);
  const tagsOf = new Map();
  for (const [b, t] of tagRows) { if (!tagsOf.has(b)) tagsOf.set(b, []); tagsOf.get(b).push(t); }
  const ownDay = new Map(days.map(([b, d]) => [b, Number(d)]));
  const dateDay = new Map();
  for (const [b, d] of dates) if (!dateDay.has(b) || Number(d) < dateDay.get(b)) dateDay.set(b, Number(d));
  const pageOf = new Map(pages.map(([b, ptitle, pday]) => [b, { title: String(ptitle), journal: Number(pday) || 0 }]));
  const list = basics.map(([b, u, title, name]) => {
    const t = tagsOf.get(b) || [];
    const isPage = !!name, page = isPage ? null : (pageOf.get(b) || { title: '', journal: 0 });
    return { id: b, uuid: String(u).toLowerCase(), raw: String(title), isPage, journal: !!ownDay.get(b), page,
      day: ownDay.get(b) || page?.journal || dateDay.get(b) || 0, tags: t, kind: kindOf(index, t) };
  });
  await resolveNames(list);
  return list;
}
// Titles name pages as [[uuid]]: the names are read and put in place; `text` is the plain words, `parts` the pieces.
async function resolveNames(list) {
  const refs = new Set();
  for (const n of list) for (const m of n.raw.matchAll(REF)) refs.add((m[1] || m[2]).toLowerCase());
  const names = new Map();
  if (refs.size) for (const [u, t] of await query(`[:find ?u ?t :where ${uuidsIn('?u', refs)} [?r :block/uuid ?u] [?r :block/title ?t]]`)) names.set(String(u).toLowerCase(), String(t));
  for (const n of list) {
    const parts = [];
    let at = 0;
    for (const m of n.raw.matchAll(REF)) {
      if (m.index > at) parts.push({ text: n.raw.slice(at, m.index) });
      const uuid = (m[1] || m[2]).toLowerCase();
      parts.push({ text: names.get(uuid) || '…', uuid });
      at = m.index + m[0].length;
    }
    if (at < n.raw.length) parts.push({ text: n.raw.slice(at) });
    // A name written as [[Name]] in the words (not stored as a link) reads as the name alone.
    n.parts = parts.map(p => ({ ...p, text: p.text.replace(MARKERS, '').replace(/\[\[([^\]]+)\]\]/g, '$1') }));
    n.text = n.parts.map(p => p.text).join('');
  }
}

/* What the given nodes hold, as choices: for each user property, its values with how many of the nodes hold each
   ([{ name, type, values: [{ key, label, count, uuid }] }]); dates are left to the months. Each node's values are kept
   (byNode: id -> Set of "name=key") so a pick can narrow without another read. */
async function facets(nodes) {
  const ids = nodes.map(n => n.id);
  if (!ids.length) return { props: [], byNode: new Map() };
  const rows = await query(`[:find ?b ?name ?type ?v :where ${idsIn('?b', ids)} [?b ?a ?v] ${USER_PROP} [?prop :block/title ?name] [?prop :logseq.property/type ?type]]`);
  const valueIds = [...new Set(rows.filter(([, , type]) => bare(type) !== 'date').map(([, , , v]) => v).filter(isId))];
  const labels = new Map();
  if (valueIds.length) for (const [v] of await query(`[:find (pull ?v [:db/id :block/uuid :block/title :property.value/content :block/name]) :in $ :where ${idsIn('?v', valueIds)}]`)) {
    const id = pick(v, 'db/id'), title = pick(v, 'block/title'), content = pick(v, 'property.value/content');
    labels.set(id, { label: String(title ?? content ?? '').trim(), uuid: String(pick(v, 'block/uuid') || '') });
  }
  const props = new Map(), byNode = new Map();
  for (const [b, name, type, v] of rows) {
    const kind = bare(type);
    if (kind === 'date' || kind === 'checkbox') continue;
    const got = labels.get(v);
    if (!got || !got.label) continue;
    const key = String(v);
    if (!props.has(name)) props.set(name, { name: String(name), type: kind, values: new Map() });
    const p = props.get(name);
    // A value that is a node keeps its uuid, so the pick in the find line reads as the node; words and numbers have none.
    if (!p.values.has(key)) p.values.set(key, { key, label: got.label, uuid: kind === 'node' || kind === 'page' ? got.uuid : '', count: 0, nodes: new Set() });
    const val = p.values.get(key);
    if (!val.nodes.has(b)) { val.nodes.add(b); val.count++; }
    if (!byNode.has(b)) byNode.set(b, new Set());
    byNode.get(b).add(name + '=' + key);
  }
  const total = ids.length;
  const list = [...props.values()].map(p => ({ name: p.name, type: p.type,
    values: [...p.values.values()].filter(v => v.count < total || p.values.size > 1).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).map(({ nodes, ...v }) => v) }))
    // A property with one value, or one every node holds, narrows nothing; words with a value per node are not choices.
    .filter(p => p.values.length > 1 && !(p.type === 'default' && p.values.length > 24))
    .sort((a, b) => (a.type === 'node' ? 0 : 1) - (b.type === 'node' ? 0 : 1) || a.name.localeCompare(b.name));
  return { props: list, byNode };
}
// The months among the nodes' days, newest first: [{ key: 202610, label: 'Oct', count }].
function months(nodes) {
  const map = new Map();
  for (const n of nodes) { if (!n.day) continue; const key = Math.floor(n.day / 100); map.set(key, (map.get(key) || 0) + 1); }
  return [...map].sort((a, b) => b[0] - a[0]).map(([key, count]) => ({ key, label: monthLabel(key), count }));
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(key) { const y = Math.floor(key / 100), m = key % 100; return MONTHS[m - 1] + (y === new Date().getFullYear() ? '' : ' ' + y); }
function dayLabel(day) { if (!day) return ''; const y = Math.floor(day / 10000), m = Math.floor(day / 100) % 100, d = day % 100; return `${MONTHS[m - 1]} ${d}${y === new Date().getFullYear() ? '' : ', ' + y}`; }

/* Logseq's own search for the words: its index and its order, up to `limit`, each result read in full. */
async function search(words, limit = 80) {
  const options = { limit, 'search-limit': limit, 'built-in?': true, 'enable-snippet?': true };
  let found;
  try { found = await logseq.App.search(words, options); } catch (error) { console.warn('Find: Logseq\'s search did not answer', error); return []; }
  const blocks = Array.isArray(found?.blocks) ? found.blocks : Array.isArray(found) ? found : [];
  const uuids = [], seen = new Set();
  for (const b of blocks) {
    const u = String(b?.uuid || b?.['block/uuid'] || '').toLowerCase();
    if (UUID.test(u) && !seen.has(u)) { seen.add(u); uuids.push(u); }
  }
  const list = await details([], uuids);
  const order = new Map(uuids.map((u, i) => [u, i]));
  return list.sort((a, b) => order.get(a.uuid) - order.get(b.uuid));
}

/* A node opened in place: its properties with their values, and what points at it, by property and by the kind of the
   pointing node, with those nodes; then what mentions it in its words. */
async function node(uuid) {
  const index = await tagIndex();
  const [props, pointing, mentions] = await Promise.all([
    query(`[:find ?name ?type ?v :where [?p :block/uuid #uuid "${uuid}"] [?p ?a ?v] ${USER_PROP} [?prop :block/title ?name] [?prop :logseq.property/type ?type]]`),
    query(`[:find ?name ?b :where [?p :block/uuid #uuid "${uuid}"] [?b ?a ?p] ${USER_PROP} [?prop :block/title ?name] ${LIVE}]`),
    query(`[:find ?b :where [?p :block/uuid #uuid "${uuid}"] [?b :block/refs ?p] ${LIVE}]`),
  ]);
  const valueIds = [...new Set(props.map(([, , v]) => v).filter(isId))];
  const labels = new Map();
  if (valueIds.length) for (const [v] of await query(`[:find (pull ?v [:db/id :block/uuid :block/title :property.value/content :block/name :block/journal-day]) :in $ :where ${idsIn('?v', valueIds)}]`)) {
    const id = pick(v, 'db/id'), day = pick(v, 'block/journal-day');
    labels.set(id, { label: day ? dayLabel(Number(day)) : String(pick(v, 'block/title') ?? pick(v, 'property.value/content') ?? '').trim(), uuid: pick(v, 'block/name') != null ? String(pick(v, 'block/uuid') || '') : '' });
  }
  const properties = new Map();
  for (const [name, type, v] of props) {
    const got = labels.get(v); if (!got || !got.label) continue;
    if (!properties.has(name)) properties.set(name, { name: String(name), type: bare(type), values: [] });
    properties.get(name).values.push(got);
  }
  const pointedIds = [...new Set(pointing.map(([, b]) => b))];
  const viaProp = new Set(pointedIds);
  const mentionIds = mentions.map(([b]) => b).filter(b => !viaProp.has(b));
  const all = await details([...pointedIds, ...mentionIds], []);
  const byId = new Map(all.map(n => [n.id, n]));
  const groups = new Map();
  for (const [name, b] of pointing) {
    const n = byId.get(b); if (!n) continue;
    const key = name + '|' + (n.kind?.title || '');
    if (!groups.has(key)) groups.set(key, { name: String(name), kind: n.kind?.title || '', nodes: [] });
    if (!groups.get(key).nodes.some(x => x.id === b)) groups.get(key).nodes.push(n);
  }
  const byDay = (a, b) => b.day - a.day;
  const pointed = [...groups.values()].map(g => ({ ...g, nodes: g.nodes.sort(byDay) })).sort((a, b) => b.nodes.length - a.nodes.length);
  const mentioned = mentionIds.map(b => byId.get(b)).filter(Boolean).sort(byDay);
  return { properties: [...properties.values()], pointed, mentioned };
}

/* Recently opened pages, as Logseq keeps them; failing that, the pages changed last. */
async function recents(limit = 8) {
  // Logseq 2.0.2 hands back the pages as objects with their uuid, the last opened first.
  let uuids = [];
  try { const r = await logseq.App.getCurrentGraphRecent?.(); if (Array.isArray(r)) uuids = r.map(x => String(x?.uuid || x?.['block/uuid'] || '').toLowerCase()).filter(u => UUID.test(u)); } catch (error) { /* not in this version */ }
  if (uuids.length) {
    const list = await details([], uuids.slice(0, limit));
    const order = new Map(uuids.map((u, i) => [u, i]));
    return list.sort((a, b) => order.get(a.uuid) - order.get(b.uuid));
  }
  const rows = await query(`[:find ?b ?up :where [?b :block/name _] [?b :block/updated-at ?up] (not [?b :block/journal-day _]) (not [?b :logseq.property/built-in? true]) (not [?b :block/tags :logseq.class/Property]) ${LIVE}]`);
  const top = rows.sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, limit).map(([b]) => b);
  const list = await details(top, []);
  const order = new Map(top.map((b, i) => [b, i]));
  return list.sort((a, b) => order.get(a.id) - order.get(b.id));
}
// A page made from the find line, through Logseq's own call; opened once made.
async function makePage(name) {
  const page = await logseq.Editor.createPage(name, {}, { redirect: true, createFirstBlock: true });
  return page?.uuid ? String(page.uuid) : null;
}
const forget = () => { tags = null; };

Find.db = { tagIndex, kinds, nodesOfKind, details, facets, months, search, node, recents, makePage, dayLabel, monthLabel, forget, UUID };
})();
