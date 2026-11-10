/* The "looks like" engine. Ported from logseq-db-refinements (parts/alike.js) and made explicit about
   its limits: nothing here reads a global, so the same engine can be tuned for each graph.

   A new bullet is filled the way the nodes it most resembles were filled. Every remembered node is a bag of tokens:
   its words (lower-case, lightly stemmed), the pages it links (link:id) and its tags (tag:id). A rare token weighs
   more (inverse document frequency). The nearest nodes are found by the cosine of the weighted bags through an
   inverted index, so only nodes sharing a token are touched; for a property, the nearest holders vote for their value
   with the square of their similarity, and a clear lead speaks. */
(function () {
const text = (typeof require === 'function' && typeof module !== 'undefined') ? require('./text.js') : window.Flow.text;
const { WORD } = text;

// k: how many nearest holders vote. nearLeast: the least similarity of the nearest holder. lead: the share of the vote
// the leading value must hold. The tag* ones are the same for the tag of an untagged bullet, stricter because a wrong
// tag brings wrong properties with it. These came from one graph's scoreboard: tools/tune.js (or the plugin's
// "Tune to this graph" command) finds the numbers that fit another.
// tagGap: when the vote finds no near-twin, the lead in log-odds a tag's word profile needs over the runner-up (core/profile.js;
// 0 turns the profile off). profileLeast: the fewest bullet lines a tag needs to have a profile. profileAlpha: its smoothing.
const DEFAULT_LIMITS = Object.freeze({ k: 5, nearLeast: .3, lead: .7, stem: true, tagNearLeast: .6, tagLead: .7, tagLeast: 1, tagLinks: false, tagGap: 3, profileLeast: 10, profileAlpha: .25 });

// A light stem: a trailing s (not ss), ed or ing off words of five letters or more, so "flagged", "flagging" and
// "flags" meet. Crude on purpose: it is the same on both sides, which is all the cosine needs. Other languages: set
// limits.stem false, or give stem a function.
function stemmer(limits) {
  if (typeof limits.stem === 'function') return limits.stem;
  return limits.stem ? word => word.length >= 5 ? word.replace(/(?:ing|ed|(?<!s)s)$/u, '') : word : word => word;
}
const wordsOf = t => (String(t || '').toLowerCase().match(WORD) || []).filter(w => w.length >= 3 && !/^\d+$/.test(w));

// The tokens of a node: its words (a text, or an iterable of words already split), the ids of the pages it links, the
// ids of its tags. Each token once.
function tokensOf(words, links = [], tags = [], limits = DEFAULT_LIMITS) {
  const stem = stemmer(limits), out = new Set();
  for (const w of typeof words === 'string' ? wordsOf(words) : [...(words || [])].flatMap(wordsOf)) out.add(stem(w));
  for (const id of links) if (id != null) out.add('link:' + id);
  for (const id of tags) if (id != null) out.add('tag:' + id);
  return [...out];
}

// The index: each token's weight (smoothed so it is never under 1), the entries holding it, each entry's norm. A token
// never seen weighs as the rarest, so a line of new words resembles nothing.
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

// One entry learned at once: a node just written or changed takes its place in the index (or is added) without
// building it again. The weights stay those of the last full reading; the next full reading puts them right.
function updateEntry(index, entry) {
  if (!index) return;
  index.byId ||= new Map(index.entries.map((e, i) => [e.id, i]));
  const was = index.byId.get(entry.id);
  if (was == null && !entry.tokens.length) return;
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

// The k nearest entries to a bag of tokens, best first, each with its cosine similarity. skip: ids to leave out (the
// node being written). keep(entry): narrows to the entries wanted.
function neighbours(index, tokens, { k = DEFAULT_LIMITS.k, skip = new Set(), keep = () => true } = {}) {
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
    if (!entry || skip.has(entry.id) || !keep(entry)) continue;
    found.push({ entry, sim: dot / (qnorm * index.norms[i]) });
  }
  found.sort((a, b) => b.sim - a.sim);
  return found.slice(0, k);
}

// What the nearest entries holding the property agree on: each votes for its value with the square of its similarity;
// the leading value is returned when the nearest holder is near enough, the value holds the lead's share of the vote,
// and at least `least` entries voted for it.
function vote(near, ident, { nearLeast = DEFAULT_LIMITS.nearLeast, lead = DEFAULT_LIMITS.lead, least = 1 } = {}) {
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

const api = { DEFAULT_LIMITS, stemmer, wordsOf, tokensOf, buildIndex, updateEntry, neighbours, vote };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).engine = api;
})();
