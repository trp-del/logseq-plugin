/* Where a tag sits among the tags: the path from it up to the top. No Logseq here.
   path(id, tags) answers [tag, its parent, the parent's parent, …]; tags: id -> { id, title, uuid, parents: [id] }.
   A tag under several parents follows the first by name; a loop among parents ends the path where it would repeat.
   above(id, tags) answers the ids of the tag and of every tag above it, by every parent.
   tree(tags)          the tags as an outline: [{ tag, depth }], tops by name, each tag's children under it by name
   under(id, tags)     the ids of a tag and of every tag below it
   counts(tags, pairs) tag id -> how many nodes hold it or a tag below it; pairs: [[tag id, node id]] */
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
const api = { path, above, tree, under, counts };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).tags = api;
})(typeof window !== 'undefined' ? window : globalThis);
