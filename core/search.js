/* Searching, decided. No Logseq here.
     tokens(text)               the words typed, lower case
     kinds(tags, words)         the tags whose name holds every typed word, best first
     narrow(nodes, words)       the nodes that hold every typed word, in their words, their tag, a value of theirs or their day;
                                each answered with why: the values a word matched that the node's own words do not show
     rank(nodes, words)         what a search shows: only the nodes whose own words or name hold every typed word (the owner's
                                marked page, 26 November 2026: "Most results have no 'tadi' in them"), each node once, the
                                best first: the name itself, then a name that starts with it, a word that does, then the rest
   A node: { uuid, words, tag, day, values: [name] } (words as plain text). */
(function (root) {
const tokens = text => String(text == null ? '' : text).toLowerCase().split(/\s+/).filter(Boolean);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dayWords = day => day ? `${MONTHS[Math.floor(day / 100) % 100 - 1] || ''} ${day % 100} ${Math.floor(day / 10000)}` : '';
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
function rank(nodes, words) {
  const want = tokens(words), seen = new Set(), out = [];
  if (!want.length) return [];
  const whole = want.join(' ');
  for (const node of nodes) {
    if (!node || seen.has(node.uuid)) continue;
    const own = String(node.words || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!want.every(word => own.includes(word))) continue;
    seen.add(node.uuid);
    const score = own === whole ? 0 : own.startsWith(whole) ? 1 : own.split(/[^a-z0-9\u00c0-\uffff]+/).some(part => part.startsWith(want[0])) ? 2 : 3;
    out.push({ node, score, page: node.isPage ? 0 : 1, at: out.length });
  }
  return out.sort((a, b) => a.page - b.page || a.score - b.score || a.at - b.at).map(one => one.node);
}
const api = { tokens, kinds, narrow, rank };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).search = api;
})(typeof window !== 'undefined' ? window : globalThis);
