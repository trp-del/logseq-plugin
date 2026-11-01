/* The model: a graph's tags and properties as plain data, read once (logseq/db.js gives it the raw shape, the tests a
   hand-made one), with the questions the screen asks of it: the nodes under a tag, descendants included; a tag's kind,
   path and children; what a tag has and what is inherited; how many nodes fill a property; what points at a tag.
   Pure: no Logseq, no screen. Runs in Node. */
(function () {
const S = (window.Structure ||= {});

/* The four kinds, as the design names them, and the names a graph may give its own umbrella tag for each (Look reads
   them the same way). A kind row is always drawn; when the graph has no tag of that name the row stands empty. */
const KINDS = [
  { key: 'E', name: 'Entity', names: ['entity', 'entities'] },
  { key: 'O', name: 'Occurrence', names: ['occurrence', 'occurrences'] },
  { key: 'P', name: 'Phenomena', names: ['phenomenon', 'phenomena'] },
  { key: 'I', name: 'Information', names: ['information', 'interpretation'] },
];
const LOOSE = 'N';   // the row under which tags under no kind are gathered
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/* raw: { tags: [{ id, uuid, title, parents: [tagId], props: [propId], bullets: on its page, links: to it in bullets' words }], props: [{ id, uuid, ident, title, type, many,
   choice, range: [tagId] }], nodes: { tagId: [{ id, uuid }] }, holders: { ident: [nodeId] }, pointed: [[ident, tagId, n]],
   newest: { tagId: ms } }. Only the graph's own tags and properties; a parent that is Logseq's Root is left out. */
function build(raw) {
  const M = { tags: new Map(), props: new Map(), byIdent: new Map(), kinds: [], loose: [], holders: new Map(), pointed: new Map(), newest: new Map(raw.newest ? Object.entries(raw.newest).map(([k, v]) => [Number(k), v]) : []), memo: new Map(), nextId: -5 };
  for (const p of raw.props || []) M.props.set(p.id, { id: p.id, uuid: p.uuid || '', ident: p.ident, title: p.title, type: p.type || 'default', many: !!p.many, choice: !!p.choice, range: [...(p.range || [])], on: [] });
  for (const p of M.props.values()) M.byIdent.set(p.ident, p);
  for (const t of raw.tags || []) M.tags.set(t.id, { id: t.id, uuid: t.uuid || '', title: t.title, parents: [...(t.parents || [])], props: [...(t.props || [])].filter(id => M.props.has(id)), kids: [], nodes: new Set((raw.nodes?.[t.id] || []).map(n => typeof n === 'object' ? n.id : n)), nodeUuids: (raw.nodes?.[t.id] || []).map(n => typeof n === 'object' ? n.uuid : null).filter(Boolean), bullets: t.bullets || 0, links: t.links || 0 });
  for (const t of M.tags.values()) t.parents = t.parents.filter(id => M.tags.has(id) && id !== t.id);
  for (const [ident, ids] of Object.entries(raw.holders || {})) M.holders.set(ident, new Set(ids));
  for (const [ident, tagId, n] of raw.pointed || []) { if (!M.pointed.has(ident)) M.pointed.set(ident, new Map()); M.pointed.get(ident).set(tagId, n); }
  // The kinds: the graph's own tag named like one, at the top, else an empty row with a made-up id, the same one at every reading.
  for (const [at, kind] of KINDS.entries()) {
    const tag = [...M.tags.values()].find(t => !t.parents.length && kind.names.includes(t.title.trim().toLowerCase()));
    if (tag) { tag.kind = kind.key; M.kinds.push({ key: kind.key, name: kind.name, id: tag.id }); }
    else { const id = -1 - at; M.tags.set(id, { id, uuid: '', title: kind.name, parents: [], props: [], kids: [], nodes: new Set(), nodeUuids: [], kind: kind.key, missing: true }); M.kinds.push({ key: kind.key, name: kind.name, id }); }
  }
  link(M);
  return M;
}
// The tree from the parents: a tag sits under its first parent (the others are "also under"); tags under no kind are loose.
function link(M) {
  M.memo.clear();
  for (const t of M.tags.values()) t.kids = [];
  for (const p of M.props.values()) p.on = [];
  M.loose = [];
  for (const t of M.tags.values()) {
    if (t.parents.length) M.tags.get(t.parents[0]).kids.push(t.id);
    else if (!t.kind) M.loose.push(t.id);
    for (const pid of t.props) M.props.get(pid)?.on.push(t.id);
  }
  for (const t of M.tags.values()) t.kids.sort((a, b) => byTitle(M.tags.get(a), M.tags.get(b)));
  M.loose.sort((a, b) => byTitle(M.tags.get(a), M.tags.get(b)));
}
const memo = (M, key, make) => { if (!M.memo.has(key)) M.memo.set(key, make()); return M.memo.get(key); };
const tag = (M, id) => M.tags.get(id);
const prop = (M, id) => M.props.get(id);
const isKind = (M, id) => !!M.tags.get(id)?.kind;
const parentOf = (M, id) => M.tags.get(id)?.parents[0] ?? null;
const kids = (M, id) => id === LOOSE ? M.loose : (M.tags.get(id)?.kids || []);
// The nodes under a tag, descendants included, each once (a node with two tags of one branch counts once).
function nodesUnder(M, id) {
  return memo(M, 'nodes:' + id, () => {
    const out = new Set(), seen = new Set();
    const walk = x => { if (seen.has(x)) return; seen.add(x); const t = M.tags.get(x); if (!t) return; for (const n of t.nodes) out.add(n); for (const k of t.kids) walk(k); };
    if (id === LOOSE) M.loose.forEach(walk); else walk(id);
    return out;
  });
}
const count = (M, id) => nodesUnder(M, id).size;
// The tag of a branch that a node carries: the branch's own top first, for a node with two tags of one branch.
function carrier(M, id, node) {
  const seen = new Set(), walk = x => { if (seen.has(x)) return null; seen.add(x); const t = M.tags.get(x); if (!t) return null; if (t.nodes.has(node)) return x; for (const k of t.kids) { const found = walk(k); if (found != null) return found; } return null; };
  return walk(id);
}
// The path from the kind down, ids; the kind's key, or null when the tag sits under none (or, through two parents, under two).
const pathOf = (M, id) => { const p = []; for (let at = id, guard = 0; at != null && guard < 64; at = parentOf(M, at), guard++) p.unshift(at); return p; };
function kindOf(M, id) {
  const found = new Set(), seen = new Set(), queue = [id];
  while (queue.length) { const at = queue.shift(); if (seen.has(at)) continue; seen.add(at); const t = M.tags.get(at); if (!t) continue; if (t.kind) { found.add(t.kind); continue; } queue.push(...t.parents); }
  return found.size === 1 ? [...found][0] : null;
}
const under = (M, id, anc) => { for (let at = id, guard = 0; at != null && guard < 64; at = parentOf(M, at), guard++) if (at === anc) return true; return false; };
const depth = (M, id) => pathOf(M, id).length - 1;
// What a tag inherits: the properties of the tags above it (every parent), nearest first, each once, with the tag it comes from.
// without: a parent left out, to see what would go with it.
function inherited(M, id, without) {
  const have = new Set(M.tags.get(id)?.props || []), out = [], seen = new Set([id, without]);
  for (let level = [...(M.tags.get(id)?.parents || [])]; level.length;) {
    const next = [];
    for (const pid of level) { if (seen.has(pid)) continue; seen.add(pid); const t = M.tags.get(pid); for (const p of t.props) if (!have.has(p)) { have.add(p); out.push({ prop: p, from: pid }); } next.push(...t.parents); }
    level = next;
  }
  return out;
}
// How many of the nodes under a tag hold a value for a property.
function filled(M, tagId, propId) {
  const p = M.props.get(propId); if (!p) return 0;
  return memo(M, `fill:${tagId}:${propId}`, () => { const holders = M.holders.get(p.ident); if (!holders?.size) return 0; const nodes = nodesUnder(M, tagId); let n = 0; const [small, big] = holders.size < nodes.size ? [holders, nodes] : [nodes, holders]; for (const x of small) if (big.has(x)) n++; return n; });
}
// Of a tag's own nodes only (not those under its children).
function filledOwn(M, tagId, propId) {
  const p = M.props.get(propId), t = M.tags.get(tagId); if (!p || !t) return 0;
  const holders = M.holders.get(p.ident); if (!holders?.size) return 0;
  let n = 0; for (const x of t.nodes) if (holders.has(x)) n++; return n;
}
// Every declared property as the table lists it: the tag, the property, how many fill it of how many.
function propRows(M) {
  const rows = [];
  for (const t of M.tags.values()) for (const pid of t.props) rows.push({ tag: t.id, prop: pid, filled: filled(M, t.id, pid), of: count(M, t.id) });
  return rows;
}
// Relations whose range is this tag: the tag they are declared on, the property, how many nodes fill it.
function pointedAt(M, id) {
  const out = [];
  for (const p of M.props.values()) if (p.type === 'node' && p.range.includes(id)) for (const on of p.on) out.push({ tag: on, prop: p.id, filled: filled(M, on, p.id) });
  return out.sort((a, b) => b.filled - a.filled);
}
// What a relation's values are tagged, most common first: the guess for a range Logseq's property does not set.
const rangeGuess = (M, propId) => { const p = M.props.get(propId); const m = p && M.pointed.get(p.ident); return m ? [...m].filter(([t]) => M.tags.has(t) && !isKind(M, t)).sort((a, b) => b[1] - a[1]) : []; };
const kindWord = type => ({ date: 'a date', datetime: 'a date', number: 'a number', default: 'words', text: 'words', choice: 'a choice', checkbox: 'yes or no', url: 'a link', node: 'nodes', page: 'nodes' })[type] || 'words';
const propKind = p => p.choice ? 'choice' : p.type === 'node' || p.type === 'page' ? 'rel' : p.type === 'number' ? 'num' : /^date/.test(p.type) ? 'date' : 'text';
// A name that is free among the tags (Logseq allows two tags of one name; the map does not add a third).
const titled = (M, title) => [...M.tags.values()].filter(t => !t.missing && t.title.trim().toLowerCase() === String(title).trim().toLowerCase());
// A tag the model does not have yet (made in the tray): a made-up id, until Apply makes it real. The change keeps its id for good,
// so a line taken out of the tray never makes another line name a different tag.
let madeId = -1000;
function addTag(M, title, parent, id = madeId--) {
  M.tags.set(id, { id, uuid: '', title, parents: parent != null ? [parent] : [], props: [], kids: [], nodes: new Set(), nodeUuids: [], made: true });
  link(M); return id;
}
const removeTag = (M, id) => { M.tags.delete(id); for (const t of M.tags.values()) t.parents = t.parents.filter(p => p !== id); for (const p of M.props.values()) p.range = p.range.filter(r => r !== id); link(M); };

S.model = { KINDS, LOOSE, build, link, tag, prop, isKind, parentOf, kids, nodesUnder, count, carrier, pathOf, kindOf, under, depth, inherited, filled, filledOwn, propRows, pointedAt, rangeGuess, kindWord, propKind, titled, addTag, removeTag, byTitle };
})();
