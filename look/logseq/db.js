/* The one place that reads the graph. Datascript with Logseq's own idents, as the plugin SDK's guides do. Nothing here
   writes but the two tag changes the title row offers (a tag taken off a page, a tag put under another), through
   Logseq's own editor calls. */
(function () {
const Look = window.Look;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bare = value => String(value ?? '').replace(/^:/, '');
const query = async q => { const rows = await logseq.DB.datascriptQuery(q); return Array.isArray(rows) ? rows : []; };
const EXTENDS = 'logseq.property.class/extends';
// Logseq's kinds of page say what a page is, not a tag of yours.
const PAGE_KINDS = new Set(['logseq.class/Page', 'logseq.class/Journal', 'logseq.class/Tag', 'logseq.class/Property', 'logseq.class/Whiteboard']);
// A graph's own umbrella tag named like one of the four sorts places every tag under it.
const { SORT_NAMES } = window.PluginDoor;

/* Every tag with its uuid, title and ident, and which tag each extends (Root left out). */
async function tagIndex() {
  const [rows, links] = await Promise.all([
    query(`[:find ?t ?u ?title ?ident :where [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title] [?t :db/ident ?ident]]`),
    query(`[:find ?c ?p :where [?c :${EXTENDS} ?p]]`),
  ]);
  const byId = new Map(rows.map(([id, u, title, ident]) => [id, { id, uuid: String(u), title: String(title), ident: bare(ident) }]));
  const parents = new Map();
  for (const [child, parent] of links) {
    if (!byId.has(parent) || byId.get(parent).ident === 'logseq.class/Root') continue;
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child).push(parent);
  }
  for (const list of parents.values()) list.sort((a, b) => byId.get(a).title.localeCompare(byId.get(b).title));
  return { byId, parents };
}
// A tag's chain upward, nearest first, and any other parents of the tag itself.
function chainOf({ byId, parents }, id) {
  const shown = t => ({ uuid: t.uuid, title: t.title });
  const chain = [shown(byId.get(id))], seen = new Set([id]);
  for (let at = id; ;) {
    const next = (parents.get(at) || []).find(p => !seen.has(p));
    if (next == null) break;
    seen.add(next); chain.push(shown(byId.get(next))); at = next;
  }
  return { chain, others: (parents.get(id) || []).slice(1).map(p => shown(byId.get(p))) };
}
// Which of the four sorts a tag falls under: the umbrella named like one, itself or any tag above it; under two, none.
function sortOfTag(index, id, memo = new Map()) {
  if (memo.has(id)) return memo.get(id);
  memo.set(id, null);
  const found = new Set(), seen = new Set([id]), queue = [id];
  while (queue.length) {
    const at = queue.shift(), tag = index.byId.get(at);
    const own = tag && !/^logseq\.class\//.test(tag.ident) ? SORT_NAMES[tag.title.trim().toLowerCase()] : null;
    if (own) { found.add(own); continue; }
    for (const p of index.parents.get(at) || []) if (!seen.has(p)) { seen.add(p); queue.push(p); }
  }
  const one = found.size === 1 ? [...found][0] : null;
  memo.set(id, one);
  return one;
}

/* The index a part keeps: with no wait, the chain of any tag by its uuid, the sort of any tagged node (a page by its uuid
   or its name, a bullet by its uuid), and the tags a page holds. Read once, again when a page or a tag changes. */
async function pageIndex() {
  const [index, taggedPages, taggedBlocks] = await Promise.all([tagIndex(),
    query(`[:find ?u ?n ?t :where [?p :block/name ?n] [?p :block/tags ?t] [?p :block/uuid ?u]]`),
    query(`[:find ?u ?t :where [?b :block/page _] [?b :block/tags ?t] [?b :block/uuid ?u] (not [?b :logseq.property/deleted-at _])]`)]);
  const tagged = [...taggedPages, ...taggedBlocks.map(([u, t]) => [u, null, t])];
  const idByUuid = new Map([...index.byId].map(([id, tag]) => [tag.uuid, id]));
  const memo = new Map();
  const sortsOf = new Map(), tagsOf = new Map(), uuidByName = new Map();
  for (const [u, n, t] of tagged) {
    const key = String(u), tag = index.byId.get(t);
    if (n != null) uuidByName.set(String(n), key);
    if (!tag || /^logseq\.class\//.test(tag.ident)) continue;
    if (!sortsOf.has(key)) sortsOf.set(key, new Set());
    sortsOf.get(key).add(sortOfTag(index, t, memo));
    if (!tagsOf.has(key)) tagsOf.set(key, []);
    tagsOf.get(key).push(t);
  }
  const sortByUuid = new Map();
  for (const [u, sorts] of sortsOf) { sorts.delete(null); if (sorts.size === 1) sortByUuid.set(u, [...sorts][0]); }
  // A tag has no mark (the grammar), even one given a tag of its own.
  for (const tag of index.byId.values()) sortByUuid.delete(tag.uuid);
  return {
    sortByUuid: uuid => sortByUuid.get(String(uuid || '')) || null,
    sortByName: name => { const u = uuidByName.get(String(name || '').toLowerCase()); return u ? sortByUuid.get(u) || null : null; },
    chainByUuid: uuid => { const id = idByUuid.get(String(uuid || '')); return id == null ? null : chainOf(index, id); },
    isTag: uuid => idByUuid.has(String(uuid || '')),
    isPageKind: uuid => { const id = idByUuid.get(String(uuid || '')); return id != null && PAGE_KINDS.has(index.byId.get(id).ident); },
    // The chains of the tags a page holds (Logseq's own kinds left out), by the page's uuid.
    chainsOfPage: uuid => (tagsOf.get(String(uuid || '')) || []).filter(t => !PAGE_KINDS.has(index.byId.get(t).ident)).sort((a, b) => index.byId.get(a).title.localeCompare(index.byId.get(b).title)).map(t => chainOf(index, t)),
    uuidByName: name => uuidByName.get(String(name || '').toLowerCase()) || null,
  };
}

/* Every property with what it holds: its type, whether it takes several, its own icon if set, and whether it is a
   choice (a closed list of values). By title, which is how Logseq names it on screen. */
async function propIndex() {
  const [rows, choices] = await Promise.all([
    query(`[:find (pull ?p [:db/id :block/title :logseq.property/type :db/cardinality :logseq.property/icon]) :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`),
    query(`[:find ?p :where [?v :block/closed-value-property ?p]]`),
  ]);
  const withChoices = new Set(choices.map(([p]) => p));
  const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
  const byTitle = new Map();
  for (const [p] of rows) {
    const id = pick(p, 'db/id'), title = String(pick(p, 'block/title') || '');
    if (!title) continue;
    const type = bare(pick(p, 'logseq.property/type') || 'default');
    byTitle.set(title, { kind: withChoices.has(id) ? 'choice' : type, many: /many$/.test(bare(pick(p, 'db/cardinality'))), icon: !!pick(p, 'logseq.property/icon') });
  }
  return byTitle;
}

/* What folded nodes hold, at any depth: how many unfinished tasks, how many files of each kind (picture, PDF, other),
   how many quotes, how many links, the tags inside (most used first, no numbers), and the nearest due day of an unfinished
   task. A picture shown twice, a passage cited twice, or a link written twice, counts once. A link is one in the words, a
   [[name]] or a web address, read from the words because :block/refs also holds a node's tags and property values; a tag
   written in the words is a tag, and a highlight or a file cited is counted as that. */
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const linksIn = title => [...String(title).matchAll(/(?<!#)\[\[([^[\]]+)\]\]|https?:\/\/[^\s)\]>]+/g)].map(m => (m[1] || m[0]).toLowerCase());
async function heldBelow(uuids) {
  const list = [...new Set(uuids)].map(String).filter(u => UUID.test(u));
  const held = new Map();
  if (!list.length) return held;
  const ground = (variable, values) => `[(ground [${values.join(' ')}]) [${variable} ...]]`;
  const roots = await query(`[:find ?u ?r ?pg :where ${ground('?u', list.map(u => `#uuid "${u}"`))} [?r :block/uuid ?u] [?r :block/page ?pg]]`);
  if (!roots.length) return held;
  held.pages = roots.map(r => r[2]);
  const tree = await query(`[:find ?b ?parent :where ${ground('?pg', [...new Set(roots.map(r => r[2]))])} [?b :block/page ?pg] [?b :block/parent ?parent] (not [?b :logseq.property/created-from-property _])]`);
  const kids = new Map(), parentOf = new Map();
  for (const [b, parent] of tree) { if (!kids.has(parent)) kids.set(parent, []); kids.get(parent).push(b); parentOf.set(b, parent); }
  const below = new Map();
  for (const [, r] of roots) { const all = [], todo = [...(kids.get(r) || [])]; while (todo.length) { const b = todo.pop(); all.push(b); todo.push(...(kids.get(b) || [])); } below.set(r, all); }
  const ids = [...new Set([...below.values()].flat())];
  if (!ids.length) return held;
  const among = ground('?b', ids);
  const [tagRows, statusRows, dayRows, stampRows, fileRows, quoteRows, titleRows, countedRows] = await Promise.all([
    query(`[:find ?b ?title ?ident :where ${among} [?b :block/tags ?t] [?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]]`),
    query(`[:find ?b ?sid :where ${among} [?b :logseq.property/status ?s] [(get-else $ ?s :db/ident :none) ?sid]]`),
    query(`[:find ?b ?day :where ${among} (or [?b :logseq.property/deadline ?d] [?b :logseq.property/scheduled ?d]) [?d :block/journal-day ?day]]`),
    query(`[:find ?b ?ms :where ${among} (or [?b :logseq.property/deadline ?ms] [?b :logseq.property/scheduled ?ms]) [(> ?ms 100000000000)]]`),
    query(`[:find ?b ?a ?type :where ${among} (or-join [?b ?a] [(identity ?b) ?a] [?b :logseq.property/asset ?a] [?b :block/refs ?a]) [?a :logseq.property.asset/type ?type]]`),
    query(`[:find ?b ?q :where ${among} (or-join [?b ?q] (and [?b :logseq.property.pdf/hl-page _] [(identity ?b) ?q]) (and [?b :block/refs ?q] [?q :logseq.property.pdf/hl-page _]) (and [?b :logseq.property.node/display-type :quote] [(identity ?b) ?q]))]`),
    query(`[:find ?b ?title :where ${among} [?b :block/title ?title]]`),
    query(`[:find ?u :where ${among} [?b :block/refs ?r] (or [?r :logseq.property.pdf/hl-page _] [?r :logseq.property.asset/type _]) [?r :block/uuid ?u]]`),
  ]);
  const tagsOf = new Map(), taskIds = new Set(), dueOf = new Map(), filesOf = new Map(), quoteOf = new Map(), linksOf = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const [b, title, ident] of tagRows) { if (String(ident) === ':logseq.class/Task') taskIds.add(b); else if (!/^:?logseq\.class\//.test(String(ident))) add(tagsOf, b, String(title)); }
  const closed = new Set();
  for (const [b, status] of statusRows) { if (/\.(done|canceled|cancelled)$/.test(String(status))) closed.add(b); else taskIds.add(b); }
  for (const b of closed) taskIds.delete(b);
  const sooner = (b, n) => { if (Number.isFinite(n) && n > 0 && (!dueOf.has(b) || n < dueOf.get(b))) dueOf.set(b, n); };
  for (const [b, day] of dayRows) sooner(b, Number(day));
  for (const [b, ms] of stampRows) { const d = new Date(Number(ms)); if (!Number.isNaN(d.getTime())) sooner(b, dayNumber(d)); }
  for (const [b, q] of quoteRows) add(quoteOf, b, q);
  for (const [b, a, type] of fileRows) {
    if (quoteOf.has(b) || quoteOf.has(parentOf.get(b))) continue;
    const t = String(type).replace(/^:/, '').toLowerCase();
    add(filesOf, b, [t === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(t) ? 'image' : 'file', a]);
  }
  const counted = new Set(countedRows.map(([u]) => String(u).toLowerCase()));
  for (const [b, title] of titleRows) for (const link of linksIn(title)) if (!counted.has(link)) add(linksOf, b, link);
  for (const [u, r] of roots) {
    const counts = new Map(), fileSets = new Map(), passages = new Set(), links = new Set();
    let task = 0, due = 0;
    for (const b of below.get(r)) {
      for (const q of quoteOf.get(b) || []) passages.add(q);
      for (const link of linksOf.get(b) || []) links.add(link);
      for (const [kind, a] of filesOf.get(b) || []) { if (!fileSets.has(kind)) fileSets.set(kind, new Set()); fileSets.get(kind).add(a); }
      for (const title of tagsOf.get(b) || []) counts.set(title, (counts.get(title) || 0) + 1);
      if (!taskIds.has(b)) continue;
      task++;
      if (dueOf.has(b) && (!due || dueOf.get(b) < due)) due = dueOf.get(b);
    }
    const files = ['image', 'pdf', 'file'].filter(k => fileSets.has(k)).map(k => [k, fileSets.get(k).size]);
    const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([title]) => title);
    held.set(String(u).toLowerCase(), { task, files, quotes: passages.size, links: links.size, tags, due });
  }
  return held;
}

// The two writes the title row makes, through Logseq's own calls.
const removeTag = (pageUuid, tagUuid) => logseq.Editor.removeBlockTag(pageUuid, tagUuid);
const addTag = (pageUuid, tagUuid) => logseq.Editor.addBlockTag(pageUuid, tagUuid);
const getPage = name => Promise.resolve(logseq.Editor.getPage(name)).catch(() => null);

Look.db = { query, tagIndex, chainOf, sortOfTag, pageIndex, propIndex, heldBelow, removeTag, addTag, getPage, UUID, EXTENDS, PAGE_KINDS, SORT_NAMES };
})();
