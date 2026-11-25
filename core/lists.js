/* What points at a node, shaped into the lists a page shows. No Logseq here.
   lists({ links, mentions, dues }) answers [{ key, kind, name, prop?, tag, rows }]:
     links     [{ prop: { ident, title, uuid }, node }]   a node holding this one as a property's value
     mentions  [node]                                      a node naming this one in its words
     dues      [{ which: 'Scheduled' | 'Deadline', node }] on a journal day, what Logseq's own dates put there
   One list for each property, the fullest first, then by the property's name; then Scheduled and Deadline; Mentioned in last. A node already in a
   property's list is not said again under Mentioned in. Rows: dated ones newest first, then the undated by their words.
   A list whose rows all have the same tag says the tag once, on the list (tag), and its rows leave it out (row.tagShown false).
   A list of two or more says how many (count, said: "4 Transfers", or the bare number where the tags differ) and, where its rows
   have different days, from when to when (from, to).
   own: the day of the node itself, when it is a journal day: a row's day is left out where it would only repeat it (dayShown). */
(function (root) {
const byRow = (a, b) => (b.day || 0) - (a.day || 0) || String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
// A tag's name for several of its kind: "Transfer" -> "Transfers", "Category" -> "Categories", "Bills" stays.
function plural(name) {
  const word = String(name || '');
  if (!word || /s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(x|z|ch|sh)$/i.test(word)) return word + 'es';
  return word + 's';
}
function finish(list, own) {
  const seen = new Set();
  list.rows = list.rows.filter(node => !seen.has(node.uuid) && seen.add(node.uuid)).sort(byRow);
  const tags = new Set(list.rows.map(node => node.tag || ''));
  list.one = tags.size === 1 ? [...tags][0] : '';   // the one tag all its rows hold, a single row's too: what + adds
  list.tag = list.one && list.rows.length > 1 ? list.one : '';
  list.rows = list.rows.map(node => ({ ...node, tagShown: !list.tag && !!node.tag, dayShown: node.day && node.day !== own ? node.day : 0 }));
  // How many, of what, over what time: said once on the list's head. One row needs no count; one day needs no span.
  list.count = list.rows.length > 1 ? list.rows.length : 0;
  list.said = !list.count ? '' : list.tag ? `${list.count} ${plural(list.tag)}` : String(list.count);
  const days = list.rows.map(node => node.dayShown).filter(Boolean);
  list.from = days.length > 1 ? Math.min(...days) : 0; list.to = days.length > 1 ? Math.max(...days) : 0;
  if (list.from === list.to) list.from = list.to = 0;
  return list;
}
function lists({ links = [], mentions = [], dues = [], own = 0 } = {}) {
  const byProp = new Map(), held = new Set();
  for (const { prop, node } of links) {
    if (!prop || !node) continue;
    if (!byProp.has(prop.ident)) byProp.set(prop.ident, { key: `prop:${prop.ident}`, kind: 'property', name: prop.title, prop, rows: [] });
    byProp.get(prop.ident).rows.push(node); held.add(node.uuid);
  }
  const out = [...byProp.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));   // the fullest list first, as the plugin before the rebuild had it
  for (const which of ['Scheduled', 'Deadline']) {
    const rows = dues.filter(due => due.which === which).map(due => due.node);
    if (rows.length) out.push({ key: `due:${which}`, kind: 'due', name: which, rows });
  }
  const said = mentions.filter(node => !held.has(node.uuid));
  if (said.length) out.push({ key: 'mentions', kind: 'mentions', name: 'Mentioned in', rows: said });
  return out.map(list => finish(list, own));
}
// Which rows a list shows before "Show all": the first few, or every one once asked or when only a couple more would be hidden.
function shown(rows, all, few = 10) { return all || rows.length <= few + 2 ? rows : rows.slice(0, few); }
const api = { lists, shown, plural };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).lists = api;
})(typeof window !== 'undefined' ? window : globalThis);
