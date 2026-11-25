/* Where a tag sits among the tags: the path from it up to the top. No Logseq here.
   path(id, tags) answers [tag, its parent, the parent's parent, …]; tags: id -> { id, title, uuid, parents: [id] }.
   A tag under several parents follows the first by name; a loop among parents ends the path where it would repeat.
   above(id, tags) answers the ids of the tag and of every tag above it, by every parent. */
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
const api = { path, above };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).tags = api;
})(typeof window !== 'undefined' ? window : globalThis);
