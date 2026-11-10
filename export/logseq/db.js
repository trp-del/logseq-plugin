/* The only file that reads Logseq's database. It turns a page, or some blocks, into the document of core/doc.js: every
   attribute of every block is read in one query, the things they point at (pages, choices, days, assets) in a second,
   and the ids in the words are swapped for names. Written against Logseq 2.0.2 DB graphs; the shapes it reads are the
   ones logseq-db-refinements reads (its parts/model.js), seen in the Illness Test Graph (test/graph.js has the same). */
(function () {
const E = (window.DbExport ||= {});
const { doc: D } = E;
// DB Export's base (plugin.js, Door.base): its window's listeners on Logseq's page, Logseq's hooks and its stylesheet, taken off at stop.
E.base = window.PluginDoor.base('export', { prefix: 'DB Export: ' });
const { UUID } = window.PluginDoor;
const IMAGE = /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/i;

const dsQuery = window.PluginDoor.query, keyName = window.PluginDoor.bare;
const idOf = v => window.PluginDoor.idOf(v) ?? null;   // null, not undefined, where a thing has no number
const ground = (variable, values) => `[(ground [${values.join(' ')}]) [${variable} ...]]`;
const uuidsOf = list => [...new Set(list.map(u => String(u).toLowerCase()))].filter(u => UUID.test(u));
// An attribute by its ident, or by its last part: Logseq's API hands :block/tags back as "tags" (seen 2026-10-29).
const get = (a, ident) => a.get(ident) || a.get(ident.split('/').pop());
const titleOf = e => String(e?.title ?? e?.['block/title'] ?? e?.content ?? e?.originalName ?? e?.name ?? '');
const pick = (o, ...keys) => { for (const k of keys) { if (o && o[k] !== undefined) return o[k]; if (o && o[':' + k] !== undefined) return o[':' + k]; } return undefined; };

/* Everything stored on the given blocks: for each, a Map by attribute ident of { ident, name, type, order, values }.
   A value that points at another thing comes as its number; describeEntities() looks those up. */
async function attributesOf(uuids) {
  const list = uuidsOf(uuids), out = new Map();
  for (let i = 0; i < list.length; i += 300) {   // in slices: a ground over thousands of uuids is slow to parse
    const slice = list.slice(i, i + 300);
    const rows = await dsQuery(`[:find ?u ?a ?name ?type ?order ?v :in $ :where ${ground('?u', slice.map(u => `#uuid "${u}"`))} [?b :block/uuid ?u] [?b ?a ?v]
      [?p :db/ident ?a] [(get-else $ ?p :block/title "") ?name] [(get-else $ ?p :logseq.property/type :none) ?type] [(get-else $ ?p :block/order "") ?order]]`);
    for (const [u, a, name, type, order, v] of rows) {
      const key = String(u).toLowerCase();
      if (!out.has(key)) out.set(key, new Map());
      const attrs = out.get(key), ident = keyName(a);
      if (!attrs.has(ident)) attrs.set(ident, { ident, name: String(name || ''), type: keyName(type), order: String(order || ''), values: [] });
      attrs.get(ident).values.push(v);
    }
  }
  return out;
}

/* What a thing pointed at is: its title (a page, a tag, a property's choice), its stored value (a text or number kept
   as a block), its day if it is a journal page, its ident, its uuid and file type if it is a file in the assets folder. */
const entities = new Map();
async function describeEntities(ids) {
  const wanted = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0 && id < 2147483647 && !entities.has(id));
  for (let i = 0; i < wanted.length; i += 500) {
    const slice = wanted.slice(i, i + 500);
    const rows = await dsQuery(`[:find (pull ?e [:db/id :db/ident :block/uuid :block/title :block/name :logseq.property/value :block/journal-day :logseq.property.asset/type :logseq.property.pdf/hl-page {:block/tags [:db/ident]}]) :in $ :where ${ground('?e', slice)}]`);
    for (const [e] of rows) {
      if (!e) continue;
      const id = pick(e, 'db/id', 'id');
      const value = pick(e, 'logseq.property/value', 'value');
      entities.set(id, {
        id, title: String(pick(e, 'block/title', 'title') ?? ''), name: pick(e, 'block/name', 'name'),
        value: value && typeof value === 'object' ? String(pick(value, 'block/title', 'title') ?? '') : value,
        ident: keyName(pick(e, 'db/ident', 'ident') ?? ''), uuid: String(pick(e, 'block/uuid', 'uuid') ?? '').toLowerCase(),
        journalDay: pick(e, 'block/journal-day', 'journal-day', 'journalDay') ?? null, assetType: keyName(pick(e, 'logseq.property.asset/type') ?? ''),
        highlight: pick(e, 'logseq.property.pdf/hl-page') != null, tagIdents: (pick(e, 'block/tags', 'tags') || []).map(t => keyName(pick(t, 'db/ident', 'ident') ?? '')),
      });
    }
    for (const id of slice) if (!entities.has(id)) entities.set(id, null);
  }
}
const entity = id => entities.get(id) || null;
const entityText = id => { const e = entity(id); if (!e) return ''; return e.value !== '' && e.value != null ? String(e.value) : e.title; };

/* The ids in a block's words, swapped for names: [[id]] → [[Name]], #[[id]] → #[[Name]], ((id)) → the block's words.
   Names are read for every text at once; a name holding a link of its own is read a second time. */
const storedRef = /(#?\[\[|\(\()([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\]\]|\)\))/gi;
const names = new Map();
async function learnNames(texts, depth = 2) {
  const wanted = new Set();
  for (const t of texts) for (const m of String(t || '').matchAll(storedRef)) { const u = m[2].toLowerCase(); if (!names.has(u)) wanted.add(u); }
  const list = [...wanted];
  for (let i = 0; i < list.length; i += 300) {
    const slice = list.slice(i, i + 300);
    // A PDF highlight's words come with its page and its PDF's title, so a block citing it reads as a quotation.
    const rows = await dsQuery(`[:find ?u ?t ?page ?pdf :in $ :where ${ground('?u', slice.map(u => `#uuid "${u}"`))} [?b :block/uuid ?u] [?b :block/title ?t]
      (or-join [?b ?page ?pdf] (and [?b :logseq.property.pdf/hl-page ?page] [?b :logseq.property/asset ?a] [?a :block/title ?pdf])
        (and (not [?b :logseq.property.pdf/hl-page _]) [(ground 0) ?page] [(ground "") ?pdf]))]`);
    for (const [u, t, page, pdf] of rows) names.set(String(u).toLowerCase(), Number(page) > 0 ? `“${String(t ?? '').trim()}” (${String(pdf || 'PDF')}, p. ${Number(page)})` : String(t ?? ''));
    for (const u of slice) if (!names.has(u)) names.set(u, '');
  }
  if (depth > 1 && list.length) await learnNames(list.map(u => names.get(u)), depth - 1);
}
const resolveRefs = text => String(text || '').replace(storedRef, (m, open, uuid) => {
  const name = resolveRefs(names.get(uuid.toLowerCase()) || '');
  return open === '((' ? name : open === '#[[' ? `#[[${name}]]` : `[[${name}]]`;
});

/* One stored value of a property as the document's { text, day, ms, url, id }. */
function valueOf(p, v) {
  if (typeof v === 'boolean') return { text: v ? 'yes' : 'no' };
  if (p.type === 'datetime' && typeof v === 'number') return { ms: v, text: '' };
  if (p.type === 'raw-number') return { text: String(v) };
  // A number, like words, is kept as a block of its own and pointed at; a choice, a page, a day are entities with a title.
  const id = idOf(v);
  if (id != null) {
    const e = entity(id);
    if (e?.journalDay) return { day: e.journalDay, text: e.title, id };
    const text = e ? entityText(id) : '';
    return text ? { text, id, ...(p.type === 'url' ? { url: text } : {}) } : null;
  }
  if (v && typeof v === 'object') return null;
  return { text: String(v), ...(p.type === 'url' ? { url: String(v) } : {}) };
}
const isUserProp = ident => ident.startsWith('user.property/');
function propertiesOf(attrs) {
  // One order everywhere (the database keeps none): dates first, then by name.
  const isDate = p => p.type === 'date' || p.type === 'datetime';
  return [...attrs.values()].filter(p => isUserProp(p.ident)).sort((a, b) => (isDate(b) - isDate(a)) || a.name.localeCompare(b.name))
    .map(p => ({ ident: p.ident, name: p.name || p.ident.replace(/^user\.property\//, ''), type: p.type, values: p.values.map(v => valueOf(p, v)).filter(Boolean) }))
    .filter(p => p.values.length);
}
// Every id the attributes point at, to describe before building: tags, status, priority, the page, the query, assets, your properties' values.
function pointedAt(attrsByBlock) {
  const ids = [];
  for (const attrs of attrsByBlock.values()) for (const p of attrs.values()) {
    const wanted = isUserProp(p.ident) ? !['checkbox', 'datetime', 'raw-number'].includes(p.type)
      : /(^|\/)(tags|page|link|status|priority|query|asset|deadline|scheduled|hl-image)$/.test(p.ident);   // with or without the namespace
    if (wanted) for (const v of p.values) { const id = idOf(v); if (id != null) ids.push(id); }
  }
  return ids;
}

const dayOrMs = v => { if (typeof v === 'number' && v > 100000000000) return v; const e = entity(idOf(v)); return e?.journalDay ?? null; };
const after = (ident, prefix) => ident.startsWith(prefix) ? ident.slice(prefix.length) : '';
const assetFile = e => e?.uuid && e.assetType ? `assets/${e.uuid}.${e.assetType}` : '';

/* The document's node for one raw block from Logseq's tree, with its attributes read. */
async function nodeOf(raw, attrsByBlock, ctx) {
  const uuid = String(raw.uuid || pick(raw, 'block/uuid') || '').toLowerCase();
  const a = attrsByBlock.get(uuid) || new Map();
  const first = ident => get(a, ident)?.values?.[0];
  const n = D.node({ uuid });
  const tagEntities = (get(a, 'block/tags')?.values || []).map(v => entity(idOf(v))).filter(Boolean);
  const tagIdents = tagEntities.map(t => t.ident);
  n.tags = tagEntities.filter(t => !t.ident.startsWith('logseq.class/')).map(t => t.title);
  if (first('logseq.property/created-from-property') != null && first('logseq.property.asset/type') == null) n.kind = 'value';
  else if (tagIdents.includes('logseq.class/Template')) n.kind = 'template';
  n.text = resolveRefs(titleOf(raw) || first('block/title') || '');
  const md = n.text.match(/^(#{1,6})\s+([\s\S]*)$/);
  const heading = first('logseq.property/heading');
  n.heading = md ? md[1].length : typeof heading === 'number' ? Math.min(6, heading) : heading === true ? 1 : 0;
  if (md) n.text = md[2];
  n.display = keyName(first('logseq.property.node/display-type') ?? '');
  n.lang = String(first('logseq.property.code/lang') ?? '');
  n.numbered = String(first('logseq.property/order-list-type') ?? '') === 'number';
  const page = entity(idOf(first('block/page')));
  n.journalDay = page?.journalDay ?? ctx.journalDay ?? null;
  const status = entity(idOf(first('logseq.property/status')));
  if (tagIdents.includes('logseq.class/Task') || status) {
    n.tags.push('Task');   // Logseq's own class, kept on a task: where no box is drawn it is the only sign
    n.task = { status: after(status?.ident || '', 'logseq.property/status.'), priority: after(entity(idOf(first('logseq.property/priority')))?.ident || '', 'logseq.property/priority.'),
      deadline: first('logseq.property/deadline') != null ? dayOrMs(first('logseq.property/deadline')) : null, scheduled: first('logseq.property/scheduled') != null ? dayOrMs(first('logseq.property/scheduled')) : null };
  }
  n.properties = propertiesOf(a);
  const assetType = keyName(first('logseq.property.asset/type') ?? '');
  if (assetType) {
    const file = `assets/${uuid}.${assetType}`;
    if (IMAGE.test(assetType)) { n.kind = 'image'; n.image = { file, name: n.text, width: Number(first('logseq.property.asset/width')) || null }; }
    else { n.kind = 'file'; n.file = { file, name: n.text, type: assetType }; }
  } else if (first('logseq.property.pdf/hl-page') != null) {
    n.kind = 'highlight';
    const area = entity(idOf(first('logseq.property.pdf/hl-image')));
    n.highlight = { page: Number(first('logseq.property.pdf/hl-page')), pdf: entity(idOf(first('logseq.property/asset')))?.title || 'PDF', area: area && assetFile(area) ? { file: assetFile(area) } : null };
  } else if (first('logseq.property/query') != null) {
    n.kind = 'query';
    const q = first('logseq.property/query');
    const text = typeof q === 'string' ? q : String(entityText(idOf(q)) || '');
    n.query = { text, columns: ctx.columnsOf ? await ctx.columnsOf(uuid) : null, rows: await queryRows(text, uuid, ctx) };
  } else if (first('block/link') != null) {
    n.kind = 'embed';
    const target = entity(idOf(first('block/link')));
    if (target?.uuid && !ctx.seen.has(target.uuid) && ctx.depth < 6) {
      const trees = target.name ? await pageTree(target.uuid) : [await blockTree(target.uuid)].filter(Boolean);
      n.children = await nodesOf(trees, { ...ctx, depth: ctx.depth + 1, seen: new Set([...ctx.seen, target.uuid]) });
    }
    return n;
  }
  const kids = (raw.children || []).filter(c => c && !Array.isArray(c));
  n.children = kids.length ? await nodesOf(kids, ctx) : [];
  // An area highlight's picture is kept as a child block of the highlight: it is the quotation, not a picture of its own.
  if (n.kind === 'highlight' && n.highlight.area) n.children = n.children.filter(c => c.kind !== 'image' || c.image.file !== n.highlight.area.file);
  return n;
}
const collectRaw = (nodes, out = []) => { for (const n of nodes || []) { if (!n || Array.isArray(n)) continue; out.push(n); collectRaw(n.children, out); } return out; };
/* Raw trees from Logseq into nodes: their attributes in one read, the things pointed at in another, the names in a third. */
async function nodesOf(trees, ctx) {
  const all = collectRaw(trees);
  if (!all.length) return [];
  const attrs = await attributesOf(all.map(r => r.uuid || pick(r, 'block/uuid')));
  await describeEntities(pointedAt(attrs));
  await learnNames(all.map(r => titleOf(r)));
  const out = [];
  for (const raw of trees) if (raw && !Array.isArray(raw)) out.push(await nodeOf(raw, attrs, ctx));
  return out;
}

/* A query's rows, read once: what the query showed. Simple queries ("(task todo)") go through DB.q, advanced ones
   ([:find …]) through customQuery; the query block itself is left out, and rows come as nodes without children. */
async function queryRows(text, ownUuid, ctx) {
  const query = String(text || '').trim();
  if (!query || ctx.depth > 2) return [];
  let rows = [];
  try { rows = /^[[{]/.test(query) ? await logseq.DB.customQuery(query) : await logseq.DB.q(query); } catch (error) { console.warn('DB Export: a query failed', query, error); }
  const seen = new Set([ownUuid]);
  const blocks = (Array.isArray(rows) ? rows.flat(Infinity) : []).filter(r => { const u = String(r?.uuid || '').toLowerCase(); if (!r || typeof r !== 'object' || !UUID.test(u) || seen.has(u)) return false; seen.add(u); return true; });
  if (ctx.order) { const by = new Map(blocks.map(b => [String(b.uuid).toLowerCase(), b])); const sorted = (await ctx.order(ownUuid)) || []; if (sorted.length) { const rest = blocks.filter(b => !sorted.includes(String(b.uuid).toLowerCase())); blocks.splice(0, blocks.length, ...sorted.map(u => by.get(u)).filter(Boolean), ...rest); } }
  return nodesOf(blocks.map(b => ({ ...b, children: [] })), { ...ctx, depth: ctx.depth + 1 });
}

const pageTree = uuid => Promise.resolve(logseq.Editor.getPageBlocksTree(uuid)).then(t => t || []).catch(() => []);
const blockTree = uuid => Promise.resolve(logseq.Editor.getBlock(uuid, { includeChildren: true })).catch(() => null);
const context = (over = {}) => ({ depth: 0, seen: new Set(), journalDay: null, columnsOf: null, order: null, ...over });

/* A page as a document: its title, tags and properties, its nodes; on a tag's page the nodes carrying the tag too. */
async function readPage(idOrName, over = {}) {
  const page = idOrName ? await logseq.Editor.getPage(idOrName) : await logseq.Editor.getCurrentPage();
  if (!page) return null;
  const uuid = String(page.uuid).toLowerCase();
  if (!page.name && !page.originalName && page.page) return readBlocks([uuid], over);   // zoomed into a block
  const attrs = await attributesOf([uuid]);
  await describeEntities(pointedAt(attrs));
  const a = attrs.get(uuid) || new Map();
  await learnNames([titleOf(page)]);
  const tagEntities = (get(a, 'block/tags')?.values || []).map(v => entity(idOf(v))).filter(Boolean);
  const journalDay = get(a, 'block/journal-day')?.values?.[0] ?? null;
  const ctx = context({ ...over, journalDay, seen: new Set([uuid]) });
  const trees = await pageTree(uuid);
  let tagged = [];
  if (tagEntities.some(t => t.ident === 'logseq.class/Tag')) {
    // The nodes carrying the tag, as Logseq lists them under the tag's page: a block with everything under it, a page as
    // one line (its title and properties; its own content stays on its page).
    const id = page.id ?? pick(page, 'db/id');
    const rows = Number.isSafeInteger(id) ? await dsQuery(`[:find ?u ?isPage :in $ :where [?b :block/tags ${id}] [?b :block/uuid ?u] [(get-else $ ?b :block/name "") ?isPage]]`) : [];
    const own = new Set(collectRaw(trees).map(r => String(r.uuid).toLowerCase()));
    const taggedTrees = [];
    for (const [u, isPage] of rows) {
      const k = String(u).toLowerCase();
      if (own.has(k) || k === uuid) continue;
      if (isPage) { const p = await logseq.Editor.getPage(k).catch(() => null); if (p) taggedTrees.push({ uuid: k, title: titleOf(p), children: [] }); }
      else { const t = await blockTree(k); if (t) taggedTrees.push(t); }
    }
    taggedTrees.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    tagged = await nodesOf(taggedTrees, ctx);
    const self = titleOf(page);
    for (const n of tagged) { n.tags = n.tags.filter(t => t !== self); n.text = n.text.replace(` #[[${self}]]`, '').replace(`#[[${self}]]`, ''); }
  }
  return D.document({ title: resolveRefs(titleOf(page)), kind: 'page', journalDay, tags: tagEntities.filter(t => !t.ident.startsWith('logseq.class/')).map(t => t.title),
    properties: propertiesOf(a), nodes: await nodesOf(trees, ctx), tagged });
}
/* Some blocks, each with everything under it, as a document without a title. A block whose parent is also given is left out. */
async function readBlocks(uuids, over = {}) {
  const trees = [];
  for (const u of uuidsOf(uuids)) { const t = await blockTree(u); if (t) trees.push(t); }
  const inside = new Set();
  for (const t of trees) for (const r of collectRaw(t.children)) inside.add(String(r.uuid).toLowerCase());
  const roots = trees.filter(t => !inside.has(String(t.uuid).toLowerCase()));
  return D.document({ kind: 'blocks', nodes: await nodesOf(roots, context(over)) });
}
const forget = () => { entities.clear(); names.clear(); };

E.db = { readPage, readBlocks, forget, attributesOf, describeEntities, learnNames, resolveRefs, nodesOf, dsQuery, idOf, titleOf };
})();
