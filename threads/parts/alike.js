/* Loaded by main.js after parts/model.js and before parts/shadow.js. Kept in its own scope. */
(() => {
/* The "looks like" engine (0.4.212, proposals piece 3; docs/ALIKE.md): a new bullet is filled the way the nodes it
   most resembles were filled. Built at the owner's word, 2026-10-20: the guess rules were "too based on the current
   graph instead of developing a more dynamic and fluid system with less friction". Nothing here knows the graph's
   tags or words; the graph itself is the only knowledge, and it changes as the owner writes.

   How: every remembered node is a bag of tokens, its words (lower-case, lightly stemmed, so "flagged" and
   "flagging" meet), the pages it links (link:id) and its tags (tag:id). A rare token weighs more (inverse document
   frequency: "neutrophils" says more than "day"). The bullet being written is tokened the same way, and the nearest
   nodes are found by the cosine of the weighted bags through an inverted index, so only nodes sharing a token are
   touched. For a property, the nearest nodes that hold it vote for their value, each with the square of its similarity; the
   leading value wins when it is clearly ahead and the nearest node is near enough (vote). The numbers in `limits`
   are picked by the scorer (tools/shadow-check.js), never by hand; docs/ALIKE.md keeps the scoreboard.

   WHAT IT PROVIDES (core.provided.alike):
   - tokensOf(words, links, tags)          the bag of tokens of a node or of the bullet being written
   - buildIndex(entries)                   { id, tokens, values: Map(ident -> ids) } each; the index the rest read
   - updateEntry(index, entry)             one entry put in, or put in place of the one with its id (0.4.267)
   - neighbours(index, tokens, options)    the k nearest entries, [{ entry, sim }], best first; options.skip (ids),
                                           options.keep(entry), options.k
   - vote(near, ident, limits)             { ids, share, sim, n } the value the nearest holders agree on, or null
   - limits                                { k, nearLeast, lead, tagNearLeast, tagLead, tagLeast }, read on each call,
                                           so the scorer can try others; the tag ones are stage D's (docs/ALIKE.md) */
const shared = window.refinementShared;
const { runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (alike): ' });

// Picked by the scorer on 2026-10-20 (docs/ALIKE.md, stage C): nearest at least .3 gave three more right guesses and no
// wrong one; .2 let lines sharing only "day" or "this morning" vote, and three wrong guesses in.
// The tag's own (stage D, picked 2026-10-20 by a sweep of 36 settings): the nearest node at least .6 alike gave 22 tags
// right of 56 and none wrong; looser settings mistook a planned operation for a hospital stay and a call for a visit.
// The tag is voted by the words alone (tagLinks false, the stress test of 2026-10-21: "[[Dr. X]] rang" was voted a
// consultation because that doctor is mostly seen in consultations; a link says who, the words what kind of thing).
const limits = { k: 5, nearLeast: .3, lead: .7, stem: true, tagNearLeast: .6, tagLead: .7, tagLeast: 1, tagLinks: false };
const WORD = /[\p{L}\p{N}]+/gu;
// A light stem: a trailing s (not ss), ed or ing taken off words of five letters or more, so "flagged", "flagging"
// and "flags" meet at "flagg". Crude on purpose: it is the same on both sides, which is all the cosine needs.
const stem = word => limits.stem && word.length >= 5 ? word.replace(/(?:ing|ed|(?<!s)s)$/u, '') : word;
const wordsOf = text => (String(text || '').toLowerCase().match(WORD) || []).filter(w => w.length >= 3 && !/^\d+$/.test(w));
// The tokens of a node: its words (a text, or an iterable of words already split), the ids of the pages it links,
// the ids of its tags. Each token once.
function tokensOf(words, links = [], tags = []) {
  const out = new Set();
  for (const w of typeof words === 'string' ? wordsOf(words) : [...(words || [])].flatMap(wordsOf)) out.add(stem(w));
  for (const id of links) if (id != null) out.add('link:' + id);
  for (const id of tags) if (id != null) out.add('tag:' + id);
  return [...out];
}
// The index: each token's weight (inverse document frequency, smoothed so it is never under 1), the entries holding
// it, and each entry's norm. An unknown token in a bullet weighs as the rarest, so a line of new words resembles nothing.
function buildIndex(entries) {
  const df = new Map();
  for (const e of entries) for (const t of new Set(e.tokens)) df.set(t, (df.get(t) || 0) + 1);
  const n = entries.length, idf = new Map(), postings = new Map();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 1)) + 1);
  const norms = new Float64Array(n);
  entries.forEach((e, i) => {
    let sum = 0;
    for (const t of new Set(e.tokens)) { const w = idf.get(t); sum += w * w; if (!postings.has(t)) postings.set(t, []); postings.get(t).push(i); }
    norms[i] = Math.sqrt(sum) || 1;
  });
  return { entries, idf, postings, norms, n, unknown: Math.log(n + 1) + 1 };
}
// One entry learned at once (0.4.267, layer 2 item 9): a node just written or changed takes its place in the index (or
// is added), without building the index again. The weights stay those of the last full reading, and a token never seen
// weighs as the rarest, as in a query; an entry with no tokens is in effect gone. The full reading every five minutes
// puts the weights right again.
function updateEntry(index, entry) {
  if (!index) return;
  index.byId ||= new Map(index.entries.map((e, i) => [e.id, i]));
  const was = index.byId.get(entry.id);
  if (was == null && !entry.tokens.length) return; // nothing to learn from, and nothing to take out
  if (was != null) for (const t of new Set(index.entries[was].tokens)) {
    const list = index.postings.get(t), at = list ? list.indexOf(was) : -1;
    if (at >= 0) list.splice(at, 1);
  }
  const i = was ?? index.entries.length;
  index.entries[i] = entry;
  if (!Array.isArray(index.norms)) index.norms = Array.from(index.norms);
  let sum = 0;
  for (const t of new Set(entry.tokens)) {
    if (!index.idf.has(t)) index.idf.set(t, index.unknown);
    const w = index.idf.get(t); sum += w * w;
    if (!index.postings.has(t)) index.postings.set(t, []);
    index.postings.get(t).push(i);
  }
  index.norms[i] = Math.sqrt(sum) || 1;
  if (was == null) { index.byId.set(entry.id, i); index.n = index.entries.length; }
}
// The k nearest entries to a bag of tokens, best first, each with its cosine similarity. Only entries sharing a token
// are touched; skip holds ids to leave out (the node being written), keep(entry) narrows to the entries wanted.
function neighbours(index, tokens, { k = limits.k, skip = new Set(), keep = () => true } = {}) {
  if (!index || !tokens?.length) return [];
  const query = [...new Set(tokens)], scores = new Map();
  let qnorm = 0;
  for (const t of query) {
    const w = index.idf.get(t) ?? index.unknown;
    qnorm += w * w;
    for (const i of index.postings.get(t) || []) scores.set(i, (scores.get(i) || 0) + w * w);
  }
  qnorm = Math.sqrt(qnorm) || 1;
  const found = [];
  for (const [i, dot] of scores) {
    const entry = index.entries[i];
    if (skip.has(entry.id) || !keep(entry)) continue;
    found.push({ entry, sim: dot / (qnorm * index.norms[i]) });
  }
  found.sort((a, b) => b.sim - a.sim);
  return found.slice(0, k);
}
// What the nearest entries holding the property agree on: each votes for its value with the square of its similarity
// (a near-identical line outweighs a few that share one word); the leading value is returned when the nearest holder
// is near enough, the value holds the lead's share of the vote, and at least `least` entries voted for it (a tag,
// stage D, asks for more than one).
function vote(near, ident, { nearLeast = limits.nearLeast, lead = limits.lead, least = 1 } = {}) {
  const holders = near.filter(x => x.entry.values?.get(ident)?.length);
  if (!holders.length || holders[0].sim < nearLeast) return null;
  const tally = new Map();
  let total = 0;
  for (const { entry, sim } of holders) {
    const ids = entry.values.get(ident), key = [...ids].sort((a, b) => a - b).join(',');
    const t = tally.get(key) || { ids, sum: 0, sim: 0, n: 0 };
    t.sum += sim * sim; t.sim = Math.max(t.sim, sim); t.n++; tally.set(key, t); total += sim * sim;
  }
  const best = [...tally.values()].sort((a, b) => b.sum - a.sum)[0];
  const share = total ? best.sum / total : 0;
  return share >= lead && best.n >= least ? { ids: best.ids, share, sim: best.sim, n: best.n } : null;
}

function provide(core) { core.provide({ alike: { tokensOf, buildIndex, updateEntry, neighbours, vote, stem, wordsOf, limits } }); }
(window.refinementParts ||= []).push({ name: 'alike', schema: [], provide, start() {}, stop: runUnloadTasks });
})();
