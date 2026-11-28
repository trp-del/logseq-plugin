/* Values taken from one property into another, decided. No Logseq here.
   plan({ nodes, from, into, remove }) answers what would happen, before anything is written:
     nodes   [{ uuid, words, from: [value], into: [value] }]   each node with what it holds under the two properties; a value is
             { raw, text, under }: raw is what is written (a node's id, a time's number, a number, words), text is how it
             reads, under how many bullets are written under it (a value in words is a bullet of Logseq's own)
     from    { ident, title, type, many }        the property the values come out of
     into    { ident, title, type, many, isNew } the property they go into (isNew: it will be made, of from's kind)
     remove  whether the values are taken off the first property afterwards
   The answer: { refused, rows, values, kept, left }
     refused  words saying why nothing at all can be done ('' when it can)
     rows     [{ uuid, words, comes: [value], goes: [value], stays: [value], skip, why }]   for each node that holds a value under from:
              comes  what it will newly hold under into
              goes   what leaves from (all of it with remove, else nothing)
              stays  what it already held under into and keeps
              skip   words saying why this node is left as it is ('' when it is changed); why: the reason's name, 'one'
                     (into takes one value) or 'under' (a value with bullets written under it)
     values   how many values are written under into; kept: how many nodes are left as they are
     left     the nodes left as they are, by reason: [{ why, n, words }]
   The rules: the two properties hold the same kind of thing; a value a node already holds under into is not written twice; a
   property that takes one value is never given a second, and a node that would get two is left as it is and said so; a value
   that has bullets written under it stays where it is, because taken away it would lose them and copied it would arrive
   without them.
   left(made)  what the box says of the nodes left as they are, a line for each reason.
   merge({ kept, held, gone })  several properties merged into one that is kept, decided together: held, [{ uuid, values }], is
     what nodes hold under kept; gone, [{ prop, nodes: [{ uuid, words, values }] }], the properties that go with their nodes.
     Each is planned on what the kept property will hold once the ones before it are in, so a node that holds a value under
     two of them gets both, or, where the kept one takes one value, keeps the second where it stood. Answers [{ prop, made }],
     made as plan answers, in the order they are to be written.
   back(rows, now)  what the Undo of a move can take back without touching what was written since. rows: what the move kept of
     each node, { uuid, was: { from: [raw], into: [raw] }, wrote: { into: [raw] or null, from: true or false } } (wrote.into:
     what it set the node to hold under the second property, null where it wrote nothing there; wrote.from: whether it took
     the values off the first). now: { into: uuid -> [raw], from: uuid -> [raw] }, what the nodes hold this moment. A node is
     put back only where it still holds exactly what the move left; any other was changed since. Answers { back, left }. */
(function (root) {
const same = (a, b) => a.raw === b.raw;
function plan({ nodes = [], from, into, remove = false } = {}) {
  const none = { refused: '', rows: [], values: 0, kept: 0, left: [] };
  if (!from || !into) return { ...none, refused: 'Choose the property the values go into' };
  if (into.ident && into.ident === from.ident) return { ...none, refused: `They are already under ${from.title}` };
  if (!into.isNew && into.type !== from.type) return { ...none, refused: `${from.title} and ${into.title} hold different kinds of value, so one cannot take the other's` };
  const rows = [];
  for (const node of nodes) {
    const has = node.from || [], held = node.into || [];
    if (!has.length) continue;
    const comes = has.filter(value => !held.some(one => same(one, value)));
    let skip = '', why = '';
    if ((remove ? has : comes).some(value => value.under)) { why = 'under'; skip = `a value under ${from.title} that has bullets written under it stays where it is`; }
    else if (!into.many && held.length + comes.length > 1) { why = 'one'; skip = `${into.title} takes one value and this would hold ${held.length + comes.length}`; }
    rows.push({ uuid: node.uuid, words: node.words, comes: skip ? [] : comes, goes: skip || !remove ? [] : has, stays: held, skip, why });
  }
  const left = ['one', 'under'].map(why => { const of = rows.filter(row => row.why === why); return { why, n: of.length, words: of[0]?.skip || '' }; }).filter(one => one.n);
  return { refused: rows.length ? '' : `No node here holds a value under ${from.title}`, rows, values: rows.reduce((n, row) => n + row.comes.length, 0), kept: rows.filter(row => row.skip).length, left };
}
// What the yes says: "Copy 3 values", "Move 1 value"; with nothing to write but something to take away, "Remove 2 values".
function yes(made, remove) {
  const gone = made.rows.reduce((n, row) => n + row.goes.length, 0), n = made.values || (remove ? gone : 0);
  if (!n) return '';
  return `${made.values ? (remove ? 'Move' : 'Copy') : 'Remove'} ${n} ${n === 1 ? 'value' : 'values'}`;
}
const left = made => (made.left || []).map(one => `${one.n} ${one.n === 1 ? 'node is' : 'nodes are'} left as ${one.n === 1 ? 'it is' : 'they are'}: ${one.words}`);
function merge({ kept, held = [], gone = [] } = {}) {
  const now = new Map(held.map(node => [node.uuid, node.values]));
  return gone.map(({ prop, nodes }) => {
    const made = plan({ nodes: nodes.map(node => ({ uuid: node.uuid, words: node.words, from: node.values, into: now.get(node.uuid) || [] })), from: prop, into: kept, remove: true });
    for (const row of made.rows) if (!row.skip && row.comes.length) now.set(row.uuid, [...row.stays, ...row.comes]);
    return { prop, made };
  });
}
const key = list => (list || []).map(raw => JSON.stringify(raw)).sort().join();
function back(rows = [], now = {}) {
  const out = { back: [], left: [] };
  for (const row of rows) {
    const into = row.wrote?.into ? row.wrote.into : row.was.into, from = row.wrote?.from ? [] : row.was.from;
    const holds = key(now.into?.get(row.uuid)) === key(into) && key(now.from?.get(row.uuid)) === key(from);
    (holds ? out.back : out.left).push(row);
  }
  return out;
}
const api = { plan, yes, left, merge, back };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).move = api;
})(typeof window !== 'undefined' ? window : globalThis);
