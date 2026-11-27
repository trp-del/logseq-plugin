/* The order of the graphs in the graph switcher. No Logseq here.
     order(graphs, recent)   graphs: each graph's address, as Logseq lists it; recent: those opened, the latest first, the open
                             one at the head. The ones opened come first in that order, as the Mac orders its apps; the rest by name.
     opened(recent, url)     recent with a graph just opened put at the head
     name(url)               the words a graph is called by
     step(at, by, n)         the place lit after a step, round past either end */
(function (root) {
const name = url => String(url || '').replace(/^logseq_db_/, '');
function order(graphs = [], recent = []) {
  const there = new Set(graphs), first = [...new Set(recent)].filter(url => there.has(url));
  return first.concat([...there].filter(url => !first.includes(url)).sort((a, b) => name(a).localeCompare(name(b))));
}
const opened = (recent, url) => url ? [url].concat((Array.isArray(recent) ? recent : []).filter(one => one !== url)).slice(0, 50) : [].concat(recent || []);
const step = (at, by, n) => n ? ((at + by) % n + n) % n : 0;
const api = { order, opened, name, step };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).graphs = api;
})(typeof window !== 'undefined' ? window : globalThis);
