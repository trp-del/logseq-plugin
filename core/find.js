/* Finding, decided. No Logseq here.
     tree(tags)                 the tags as an outline: [{ tag, depth }], tops by name, each tag's children under it by name
     under(id, tags)            the ids of a tag and of every tag below it
     counts(tags, pairs)        tag id -> how many nodes hold it or a tag below it; pairs: [[tag id, node id]]
     kinds(tags, words)         the tags whose name holds every typed word, best first
     narrow(nodes, words)       the nodes that hold every typed word, in their words, their tag, a value of theirs or their day;
                                each answered with why: the values a word matched that the node's own words do not show
   tags: id -> { id, title, parents: [id] }; a node: { words, tag, day, values: [name] } (words as plain text). */
(function (root) {
const tokens = text => String(text == null ? '' : text).toLowerCase().split(/\s+/).filter(Boolean);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dayWords = day => day ? `${MONTHS[Math.floor(day / 100) % 100 - 1] || ''} ${day % 100} ${Math.floor(day / 10000)}` : '';
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
function kinds(tags, words) {
  const want = tokens(words);
  if (!want.length) return [];
  return [...tags.values()].filter(tag => want.every(word => tag.title.toLowerCase().includes(word)))
    .sort((a, b) => (b.title.toLowerCase().startsWith(want[0]) - a.title.toLowerCase().startsWith(want[0])) || a.title.length - b.title.length || a.title.localeCompare(b.title));
}
function narrow(nodes, words) {
  const want = tokens(words);
  if (!want.length) return nodes.map(node => ({ ...node, why: [] }));
  const out = [];
  for (const node of nodes) {
    const own = String(node.words || '').toLowerCase(), tag = String(node.tag || '').toLowerCase(), day = dayWords(node.day), values = node.values || [], why = new Set();
    let starts = false;
    const all = want.every(word => {
      if (own.includes(word)) { if (own.startsWith(word)) starts = true; return true; }
      if (tag.includes(word) || day.split(' ').some(part => part.startsWith(word))) return true;
      const value = values.find(name => String(name).toLowerCase().includes(word));
      if (value) { why.add(String(value)); return true; }
      return false;
    });
    if (all) out.push({ node: { ...node, why: [...why] }, starts });
  }
  return out.sort((a, b) => b.starts - a.starts).map(found => found.node);
}
// How many nodes stand under each tag: its own and those of every tag below it, a node counted once. pairs: [[tag id, node id]].
function counts(tags, pairs) {
  const own = new Map();
  for (const [tag, node] of pairs) { if (!tags.has(tag)) continue; if (!own.has(tag)) own.set(tag, new Set()); own.get(tag).add(node); }
  const out = new Map();
  for (const id of tags.keys()) { const all = new Set(); for (const one of under(id, tags)) for (const node of own.get(one) || []) all.add(node); out.set(id, all.size); }
  return out;
}
const api = { tokens, tree, under, kinds, narrow, counts };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).find = api;
})(typeof window !== 'undefined' ? window : globalThis);
