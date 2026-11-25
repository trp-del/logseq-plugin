/* Values taken from one property into another, decided. No Logseq here.
   plan({ nodes, from, into, remove }) answers what would happen, before anything is written:
     nodes   [{ uuid, words, from: [value], into: [value] }]   each node with what it holds under the two properties; a value is
             { raw, text }: raw is what is written (a node's id, a number, words), text is how it reads
     from    { ident, title, type, many }        the property the values come out of
     into    { ident, title, type, many, isNew } the property they go into (isNew: it will be made, of from's kind)
     remove  whether the values are taken off the first property afterwards
   The answer: { refused, rows, values, kept }
     refused  words saying why nothing at all can be done ('' when it can)
     rows     [{ uuid, words, comes: [value], goes: [value], stays: [value], skip }]   for each node that holds a value under from:
              comes  what it will newly hold under into
              goes   what leaves from (all of it with remove, else nothing)
              stays  what it already held under into and keeps
              skip   words saying why this node is left as it is ('' when it is changed)
     values   how many values are written under into; kept: how many nodes are left as they are
   The rules: the two properties hold the same kind of thing; a value a node already holds under into is not written twice; a
   property that takes one value is never given a second, and a node that would get two is left as it is and said so. */
(function (root) {
const same = (a, b) => a.raw === b.raw;
function plan({ nodes = [], from, into, remove = false } = {}) {
  const none = { refused: '', rows: [], values: 0, kept: 0 };
  if (!from || !into) return { ...none, refused: 'Choose the property the values go into' };
  if (into.ident && into.ident === from.ident) return { ...none, refused: `They are already under ${from.title}` };
  if (!into.isNew && into.type !== from.type) return { ...none, refused: `${from.title} and ${into.title} hold different kinds of value, so one cannot take the other's` };
  const rows = [];
  for (const node of nodes) {
    const has = node.from || [], held = node.into || [];
    if (!has.length) continue;
    const comes = has.filter(value => !held.some(one => same(one, value)));
    let skip = '';
    if (!into.many && held.length + comes.length > 1) skip = `${into.title} takes one value and this would hold ${held.length + comes.length}`;
    rows.push({ uuid: node.uuid, words: node.words, comes: skip ? [] : comes, goes: skip || !remove ? [] : has, stays: held, skip });
  }
  return { refused: rows.length ? '' : `No node here holds a value under ${from.title}`, rows, values: rows.reduce((n, row) => n + row.comes.length, 0), kept: rows.filter(row => row.skip).length };
}
// What the yes says: "Copy 3 values", "Move 1 value"; with nothing to write but something to take away, "Remove 2 values".
function yes(made, remove) {
  const gone = made.rows.reduce((n, row) => n + row.goes.length, 0), n = made.values || (remove ? gone : 0);
  if (!n) return '';
  return `${made.values ? (remove ? 'Move' : 'Copy') : 'Remove'} ${n} ${n === 1 ? 'value' : 'values'}`;
}
const api = { plan, yes };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).move = api;
})(typeof window !== 'undefined' ? window : globalThis);
