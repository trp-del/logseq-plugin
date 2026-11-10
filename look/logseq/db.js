/* The one place that reads the graph. Datascript with Logseq's own idents, as the plugin SDK's guides do. Nothing here
   writes but the two tag changes the title row offers (a tag taken off a page, a tag put under another), through
   Logseq's own editor calls. */
(function () {
const Look = window.Look;
const { UUID, bare, query } = window.PluginDoor;   // the small readers every module shares (plugin.js)
const EXTENDS = 'logseq.property.class/extends';
// Logseq's kinds of page say what a page is, not a tag of yours.
const PAGE_KINDS = new Set(['logseq.class/Page', 'logseq.class/Journal', 'logseq.class/Tag', 'logseq.class/Property', 'logseq.class/Whiteboard']);

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
/* The index a part keeps: with no wait, the chain of any tag by its uuid, the tags a page holds with their chains, and a
   page's uuid by its name. Read once, again when a page or a tag changes. */
async function pageIndex() {
  const [index, taggedPages, taggedBlocks] = await Promise.all([tagIndex(),
    query(`[:find ?u ?n ?t :where [?p :block/name ?n] [?p :block/tags ?t] [?p :block/uuid ?u]]`),
    query(`[:find ?u ?t :where [?b :block/page _] [?b :block/tags ?t] [?b :block/uuid ?u] (not [?b :logseq.property/deleted-at _])]`)]);
  const tagged = [...taggedPages, ...taggedBlocks.map(([u, t]) => [u, null, t])];
  const idByUuid = new Map([...index.byId].map(([id, tag]) => [tag.uuid, id]));
  const tagsOf = new Map(), uuidByName = new Map();
  for (const [u, n, t] of tagged) {
    const key = String(u), tag = index.byId.get(t);
    if (n != null) uuidByName.set(String(n), key);
    if (!tag || /^logseq\.class\//.test(tag.ident)) continue;
    if (!tagsOf.has(key)) tagsOf.set(key, []);
    tagsOf.get(key).push(t);
  }
  return {
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
  const { pick } = window.PluginDoor;
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
   how many quotes, the tags inside (most used first, no numbers), and the nearest due day of an unfinished
   task. A picture shown twice, or a passage cited twice, counts once. */
const dayNumber = window.PluginDoor.dates.number;
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
  // A tag that extends Task, at any depth (7 November 2026, the owner: "include not just #tasks but other children of tasks"),
  // counts its nodes as tasks too, done or cancelled ones left out as for Task itself.
  const taskKinds = new Set();
  const extendsRows = await query(`[:find ?c ?p :where [?c :${EXTENDS} ?p]]`).catch(() => []);
  const [[taskId] = []] = await query('[:find ?t :where [?t :db/ident :logseq.class/Task]]').catch(() => []);
  if (taskId != null) { taskKinds.add(taskId); for (let grew = true; grew;) { grew = false; for (const [c, parent] of extendsRows) if (taskKinds.has(parent) && !taskKinds.has(c)) { taskKinds.add(c); grew = true; } } }
  const [tagRows, statusRows, dayRows, stampRows, fileRows, quoteRows] = await Promise.all([
    query(`[:find ?b ?title ?ident ?t :where ${among} [?b :block/tags ?t] [?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]]`),
    query(`[:find ?b ?sid :where ${among} [?b :logseq.property/status ?s] [(get-else $ ?s :db/ident :none) ?sid]]`),
    query(`[:find ?b ?day :where ${among} (or [?b :logseq.property/deadline ?d] [?b :logseq.property/scheduled ?d]) [?d :block/journal-day ?day]]`),
    query(`[:find ?b ?ms :where ${among} (or [?b :logseq.property/deadline ?ms] [?b :logseq.property/scheduled ?ms]) [(> ?ms 100000000000)]]`),
    query(`[:find ?b ?a ?type :where ${among} (or-join [?b ?a] [(identity ?b) ?a] [?b :logseq.property/asset ?a] [?b :block/refs ?a]) [?a :logseq.property.asset/type ?type]]`),
    query(`[:find ?b ?q :where ${among} (or-join [?b ?q] (and [?b :logseq.property.pdf/hl-page _] [(identity ?b) ?q]) (and [?b :block/refs ?q] [?q :logseq.property.pdf/hl-page _]) (and [?b :logseq.property.node/display-type :quote] [(identity ?b) ?q]))]`),
  ]);
  const tagsOf = new Map(), taskIds = new Set(), dueOf = new Map(), filesOf = new Map(), quoteOf = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const [b, title, ident, t] of tagRows) { if (String(ident) === ':logseq.class/Task' || taskKinds.has(t)) taskIds.add(b); if (!/^:?logseq\.class\//.test(String(ident))) add(tagsOf, b, String(title)); }
  const closed = new Set();
  for (const [b, status] of statusRows) { if (/\.(done|canceled|cancelled)$/.test(String(status))) closed.add(b); else taskIds.add(b); }
  for (const b of closed) taskIds.delete(b);
  const sooner = (b, n) => { if (Number.isFinite(n) && n > 0 && (!dueOf.has(b) || n < dueOf.get(b))) dueOf.set(b, n); };
  for (const [b, day] of dayRows) sooner(b, Number(day));
  for (const [b, ms] of stampRows) { const d = new Date(Number(ms)); if (!Number.isNaN(d.getTime())) sooner(b, dayNumber(d)); }
  for (const [b, q] of quoteRows) add(quoteOf, b, q);
  for (const [b, a, type] of fileRows) {
    if (quoteOf.has(b) || quoteOf.has(parentOf.get(b))) continue;
    const t = bare(type).toLowerCase();
    add(filesOf, b, [t === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(t) ? 'image' : 'file', a]);
  }
  for (const [u, r] of roots) {
    const counts = new Map(), fileSets = new Map(), passages = new Set();
    let task = 0, due = 0;
    for (const b of below.get(r)) {
      for (const q of quoteOf.get(b) || []) passages.add(q);
      for (const [kind, a] of filesOf.get(b) || []) { if (!fileSets.has(kind)) fileSets.set(kind, new Set()); fileSets.get(kind).add(a); }
      for (const title of tagsOf.get(b) || []) counts.set(title, (counts.get(title) || 0) + 1);
      if (!taskIds.has(b)) continue;
      task++;
      if (dueOf.has(b) && (!due || dueOf.get(b) < due)) due = dueOf.get(b);
    }
    const files = ['image', 'pdf', 'file'].filter(k => fileSets.has(k)).map(k => [k, fileSets.get(k).size]);
    const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([title]) => title);
    held.set(String(u).toLowerCase(), { task, files, quotes: passages.size, tags, due });
  }
  return held;
}

// The two writes the title row makes, through Logseq's own calls.
const removeTag = (pageUuid, tagUuid) => window.PluginDoor.write.removeTag(pageUuid, tagUuid);
const addTag = (pageUuid, tagUuid) => window.PluginDoor.write.addTag(pageUuid, tagUuid);
const getPage = name => Promise.resolve(logseq.Editor.getPage(name)).catch(() => null);

Look.db = { query, tagIndex, chainOf, pageIndex, propIndex, heldBelow, removeTag, addTag, getPage, UUID, EXTENDS, PAGE_KINDS };
})();
