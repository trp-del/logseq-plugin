/* Idea 4, corrections count for the right tag, tried outside the plugin first. A line whose tag was guessed wrong and then set
   by hand is a correction; it counts `weight` times in the word profiles and the clue counts, so the words that misled the
   guess lean toward the right tag next time. Simulated on a graph by taking as corrections the lines a first pass got wrong
   (at the end or on the way); each line is still asked with itself left out. */
const path = require('node:path');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const profileLib = core('profile'), context = core('context');
const PLAIN = 0;

// The word profile with some lines counted `weight` times.
function weightedProfile(ctx, weights) {
  const base = context.profileOf(ctx), classes = base.classes, set = new Set(classes);
  const counts = new Map(classes.map(c => [c, new Map()])), total = new Map(classes.map(c => [c, 0])), lines = new Map(classes.map(c => [c, 0]));
  const byId = new Map();
  for (const e of ctx.index.entries) {
    const c = (e.values?.get('block/tags') || [PLAIN])[0];
    if (!set.has(c)) continue;
    const w = weights.get(e.id) || 1, tokens = [...new Set(e.tokens)].filter(t => !t.startsWith('tag:'));
    byId.set(e.id, { c, tokens, w });
    lines.set(c, lines.get(c) + w); total.set(c, total.get(c) + w * tokens.length);
    const m = counts.get(c);
    for (const t of tokens) m.set(t, (m.get(t) || 0) + w);
  }
  return { ...base, counts, total, lines, byId };
}
function scores(p, tokens, skip) {
  const own = p.byId.get(skip), ownSet = own ? new Set(own.tokens) : null, w = own?.w || 1;
  const query = [...new Set(tokens)].filter(t => !t.startsWith('tag:'));
  let n = 0; for (const c of p.classes) n += p.lines.get(c) - (own?.c === c ? w : 0);
  return p.classes.map(c => {
    const mine = own?.c === c, k = p.lines.get(c) - (mine ? w : 0);
    if (k <= 0) return [c, -Infinity];
    const m = p.counts.get(c), tot = p.total.get(c) - (mine ? w * own.tokens.length : 0);
    let lp = Math.log(k / n);
    for (const t of query) lp += Math.log(((m.get(t) || 0) - (mine && ownSet.has(t) ? w : 0) + p.alpha) / (tot + p.alpha * p.vocab));
    return [c, lp];
  }).sort((a, b) => b[1] - a[1]);
}
module.exports = { weightedProfile, scores };
