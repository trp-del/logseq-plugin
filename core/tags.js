/* Where a tag sits among the tags: the path from it up to the top. No Logseq here.
   path(id, tags) answers [tag, its parent, the parent's parent, …]; tags: id -> { id, title, uuid, parents: [id] }.
   A tag under several parents follows the first by name; a loop among parents ends the path where it would repeat.
   above(id, tags) answers the ids of the tag and of every tag above it, by every parent.
   tree(tags)          the tags as an outline: [{ tag, depth }], tops by name, each tag's children under it by name
   under(id, tags)     the ids of a tag and of every tag below it
   folds(list, shut)   an outline [{ depth, name }] with some of its tags folded (shut(name)): for each line { kids, shut,
                       hidden }: whether lines stand under it, whether it is folded, whether a fold above hides it
   found(list, hit)    an outline [{ depth, name }] narrowed to the names hit(name) takes: for each line 'hit', 'path' (a tag
                       one of them sits under, kept so it is seen in its place) or '' (left out)
   counts(tags, pairs) tag id -> how many nodes hold it or a tag below it; pairs: [[tag id, node id]]
   filled(tags, pairs, byTag, held)  ident -> { on: [tag id], filled, of }: the tags that give each property (byTag: tag id ->
                       [ident]), the one with the most nodes first; of: the nodes of those tags (and of the tags below them), summed
                       over the tags; filled: how many of them hold something under it (held: ident -> [node id]). A property
                       no tag gives: on [], of 0, filled the nodes that hold it.
   step(id, tags, out) one step in or out for a tag, as Tab and Shift-Tab do in any outline, worked out from the tags and never
                       from what is drawn: in, under the tag just above it at its own level; out, under the tag its own
                       sits under. Answers the id of the tag it goes under, 0 for the top, null where there is nowhere to go
   going(things, nodes) the question before tags or properties are deleted, counting what truly goes. things: [{ kind: 'tag'
                       or 'property', title, nodes, kids, bullets }]: nodes, how many hold it (a tag: itself, not the tags
                       below it; a property: a value under it); kids, a tag's child tags that are not deleted with it;
                       bullets, the bullets written on its page. nodes: how many nodes together, where the caller counted a
                       node once that holds two of them. Answers { words, note, yes, whole }; whole: nothing goes with it,
                       so an Undo brings back all that went (never so for a property: its Undo brings back another item) */
(function (root) {
function path(id, tags) {
  const out = [], seen = new Set();
  for (let at = tags.get(id); at && !seen.has(at.id); ) {
    out.push(at); seen.add(at.id);
    at = at.parents.map(parent => tags.get(parent)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title))[0];
  }
  return out;
}
// A tag and every tag above it, by every parent.
function above(id, tags) {
  const out = new Set(), todo = [id];
  while (todo.length) { const at = todo.pop(), tag = tags.get(at); if (!tag || out.has(at)) continue; out.add(at); todo.push(...tag.parents); }
  return out;
}
const parentOf = (tag, tags) => tag.parents.map(id => tags.get(id)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title))[0] || null;
function tree(tags) {
  const kids = new Map(), tops = [];
  for (const tag of tags.values()) { const parent = parentOf(tag, tags); if (parent) { if (!kids.has(parent.id)) kids.set(parent.id, []); kids.get(parent.id).push(tag); } else tops.push(tag); }
  const out = [], seen = new Set(), byName = (a, b) => a.title.localeCompare(b.title);
  const walk = (tag, depth) => { if (seen.has(tag.id)) return; seen.add(tag.id); out.push({ tag, depth }); for (const kid of (kids.get(tag.id) || []).sort(byName)) walk(kid, depth + 1); };
  for (const tag of tops.sort(byName)) walk(tag, 0);
  for (const tag of [...tags.values()].sort(byName)) walk(tag, 0);   // tags caught in a loop of parents have no top: they stand at the top
  return out;
}
function under(id, tags) {
  const out = new Set([id]);
  for (let grew = true; grew; ) { grew = false; for (const tag of tags.values()) if (!out.has(tag.id) && tag.parents.some(parent => out.has(parent))) { out.add(tag.id); grew = true; } }
  return out;
}
// How many nodes stand under each tag: its own and those of every tag below it, a node counted once.
function counts(tags, pairs) {
  const own = new Map();
  for (const [tag, node] of pairs) { if (!tags.has(tag)) continue; if (!own.has(tag)) own.set(tag, new Set()); own.get(tag).add(node); }
  const out = new Map();
  for (const id of tags.keys()) { const all = new Set(); for (const one of under(id, tags)) for (const node of own.get(one) || []) all.add(node); out.set(id, all.size); }
  return out;
}
// How filled each property is on the tags that give it, as Ontology's table of properties says it ("2 of 6").
function filled(tags, pairs, byTag, held) {
  const own = new Map();
  for (const [tag, node] of pairs) { if (!tags.has(tag)) continue; if (!own.has(tag)) own.set(tag, new Set()); own.get(tag).add(node); }
  const nodesOf = new Map(), nodes = id => { if (!nodesOf.has(id)) { const all = new Set(); for (const one of under(id, tags)) for (const node of own.get(one) || []) all.add(node); nodesOf.set(id, all); } return nodesOf.get(id); };
  const out = new Map();
  for (const [ident, ids] of held) out.set(ident, { on: [], filled: new Set(ids).size, of: 0 });
  const given = new Map();
  for (const [tag, idents] of byTag) if (tags.has(tag)) for (const ident of idents) { if (!given.has(ident)) given.set(ident, []); given.get(ident).push(tag); }
  for (const [ident, on] of given) {
    const holding = new Set(held.get(ident) || []);
    on.sort((a, b) => nodes(b).size - nodes(a).size || tags.get(a).title.localeCompare(tags.get(b).title));
    let n = 0, of = 0;
    for (const tag of on) { const all = nodes(tag); of += all.size; for (const node of all) if (holding.has(node)) n++; }
    out.set(ident, { on, filled: n, of });
  }
  return out;
}
function folds(list, shut) {
  let cut = Infinity;   // the depth of the fold the lines below stand under
  return list.map((line, i) => {
    const depth = line.depth || 0, kids = (list[i + 1]?.depth || 0) > depth;
    if (depth <= cut) cut = Infinity;
    const hidden = depth > cut, folded = kids && !!shut(line.name);
    if (!hidden && folded) cut = depth;
    return { kids, shut: folded, hidden };
  });
}
function found(list, hit) {
  const out = list.map(line => hit(line.name) ? 'hit' : '');
  let level = 0;   // walking up from the end: a line less deep than the last one kept is what that one sits under
  for (let i = list.length - 1; i >= 0; i--) {
    const depth = list[i].depth || 0;
    if (!out[i] && depth < level) out[i] = 'path';
    if (out[i]) level = depth;
  }
  return out;
}
function step(id, tags, out) {
  const list = tree(tags), at = list.findIndex(row => row.tag.id === id);
  if (at < 0) return null;
  const depth = list[at].depth;
  // The nearest tag above in the outline at a depth: the one beside it (its own depth), the one its own sits under (two less).
  const up = want => { for (let i = at - 1; i >= 0; i--) { if (list[i].depth === want) return list[i].tag.id; if (list[i].depth < want) return null; } return null; };
  if (!out) return up(depth);
  if (!depth) return null;
  return depth > 1 ? up(depth - 2) ?? 0 : 0;
}
function going(things, nodes = things.reduce((n, one) => n + (one.nodes || 0), 0)) {
  const kind = things[0]?.kind === 'property' ? 'property' : 'tag', one = things.length === 1, sum = name => things.reduce((n, thing) => n + (thing[name] || 0), 0);
  const kids = kind === 'tag' ? sum('kids') : 0, bullets = sum('bullets'), whole = kind === 'tag' && !nodes && !kids && !bullets;
  const it = one ? 'it' : 'them', its = one ? 'its' : 'their', said = [];
  if (kind === 'tag') {
    if (nodes) said.push(`${nodes} ${nodes === 1 ? 'node holds' : 'nodes hold'} ${it}. ${one ? 'It is' : 'They are'} taken off ${nodes === 1 ? 'that node' : 'every one of them'}.`);
    if (kids) said.push(`${one ? 'Its' : 'Their'} ${kids === 1 ? 'child tag stays' : `${kids} child tags stay`}, without ${it} as ${kids === 1 ? 'its parent' : 'their parent'}.`);
  } else said.push(nodes ? `${nodes} ${nodes === 1 ? 'node holds' : 'nodes hold'} a value under ${it}. ${nodes === 1 && one ? 'That value is' : 'Those values are'} deleted with ${it}, for good.` : `No node holds a value under ${it}.`);
  if (bullets) said.push(`The ${bullets === 1 ? 'bullet written on' : `${bullets} bullets written on`} ${its} ${one ? 'page' : 'pages'} ${bullets === 1 ? 'is' : 'are'} deleted with ${it}, for good.`);
  if (whole) said.push(`No node holds ${it}, ${one ? 'it has' : 'they have'} no child tags and nothing is written on ${its} ${one ? 'page' : 'pages'}.`);
  const name = one ? `the ${kind} “${things[0].title}”` : `${things.length} ${kind === 'tag' ? 'tags' : 'properties'}`;
  return { words: `Delete ${name}?${whole ? '' : ' This cannot be undone.'}`, note: said.join(' '), yes: one ? `Delete the ${kind}` : `Delete ${name}`, whole };
}
const api = { path, above, tree, under, folds, found, counts, filled, step, going };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).tags = api;
})(typeof window !== 'undefined' ? window : globalThis);
