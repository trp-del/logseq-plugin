/* Searching, decided. No Logseq here.
     tokens(text)               the words typed, lower case
     kinds(tags, words)         the tags whose name holds every typed word, best first
     narrow(nodes, words)       the nodes that hold every typed word, in their words, their tag, a value of theirs or their day;
                                each answered with why: the values a word matched that the node's own words do not show
     rank(nodes, words)         what a search shows: only the nodes whose own words or name hold every typed word (the owner's
                                marked page, 26 November 2026: "Most results have no 'tadi' in them"), each node once, the
                                best first: the name itself, then a name that starts with it, a word that does, then the rest
     choices(nodes)             what a kind's nodes hold to narrow by, as Find offered it: [{ prop, values: [{ label, count }] }], then
                                { months: [{ key: 202610, label: 'Oct 2026', count }] }, newest first. A property with one value, or one
                                every node holds, narrows nothing and is left out; so are words with a value per node (more than 24)
     holds(node, picks)         whether a node holds every value and month picked: picks [{ kind: 'value', prop, label } | { kind: 'month', key }]
     kindsAmong(nodes)          the kinds of the nodes found, most first: [{ title, count }]
   A node: { uuid, words, tag, day, values: [name], held: { prop: [words] } } (words as plain text). */
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
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function choices(nodes) {
  const props = new Map(), months = new Map(), total = nodes.length;
  for (const node of nodes) {
    for (const [prop, words] of Object.entries(node.held || {})) {
      if (!props.has(prop)) props.set(prop, new Map());
      for (const label of new Set(words)) { const values = props.get(prop); values.set(label, (values.get(label) || 0) + 1); }
    }
    if (node.day) { const key = Math.floor(node.day / 100); months.set(key, (months.get(key) || 0) + 1); }
  }
  const out = [...props].map(([prop, values]) => ({ prop, values: [...values].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }))
    .filter(one => one.values.length > 1 && one.values.length <= 24 && !(one.values.length === 1 && one.values[0].count === total))
    .sort((a, b) => b.values[0].count - a.values[0].count || a.prop.localeCompare(b.prop));
  return { props: out, months: [...months].sort((a, b) => b[0] - a[0]).map(([key, count]) => ({ key, label: `${SHORT[key % 100 - 1]} ${Math.floor(key / 100)}`, count })) };
}
const holds = (node, picks) => picks.every(pick => pick.kind === 'value' ? (node.held?.[pick.prop] || []).includes(pick.label)
  : pick.kind === 'month' ? Math.floor((node.day || 0) / 100) === pick.key
  : pick.kind === 'when' ? (node.day || 0) >= pick.from && (node.day || 0) <= pick.to : true);
function kindsAmong(nodes) {
  const counts = new Map();
  for (const node of nodes) if (node.tag) counts.set(node.tag, (counts.get(node.tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([title, count]) => ({ title, count }));
}
const api = { tokens, kinds, narrow, rank, choices, holds, kindsAmong };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).search = api;
})(typeof window !== 'undefined' ? window : globalThis);
