/* Where a tag sits among the tags: the path from it up to the top. No Logseq here.
   path(id, tags) answers [tag, its parent, the parent's parent, …]; tags: id -> { id, title, uuid, parents: [id] }.
   A tag under several parents follows the first by name; a loop among parents ends the path where it would repeat. */
(function (root) {
function path(id, tags) {
  const out = [], seen = new Set();
  for (let at = tags.get(id); at && !seen.has(at.id); ) {
    out.push(at); seen.add(at.id);
    at = at.parents.map(parent => tags.get(parent)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title))[0];
  }
  return out;
}
const api = { path };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).tags = api;
})(typeof window !== 'undefined' ? window : globalThis);
