/* The "sounds like" profile: the second way an untagged bullet is given a tag, after the engine's vote has found no
   near-twin (core/engine.js). One profile per tag: how often each word (token) turns up in the lines that carry the tag,
   against how often in the plain lines and in every other tag's. A fresh line that shares no near-twin with any earlier
   line still shares its ordinary words with a tag's lines as a whole ("mouth", "feels", "stings" turn up in symptom
   lines far more than in conversations), and those small votes add up. Naive Bayes, each token once per line, Laplace
   smoothing (alpha), the prior from how many lines each tag has; the plain lines are a class of their own (tag 0), so
   a tag must out-argue the default of "no tag". Only tags that bullets carry are classes: a tag that is given to pages
   only (a person, a doctor) is never offered, and a tag with fewer than `least` bullet lines says too little to count.

   Measured against the neighbour vote on lines written afresh for the Illness Test Graph (README, "How readily a tag is
   suggested"): the vote alone 9 right of 45 with 1 wrong; the profile alone 17 right, none wrong; both 21 right. A
   summed-vector centroid with a cosine was tried in its place and did worse (11 right, 6 wrong): without the prior, one
   rare word matches a small tag's profile. */
(function () {
const PLAIN = 0;   // the class of a line with no tag (context.js gives a plain line the tag value [0])

// entries: the index's entries (context.js). isPage(entry): whether the entry is a page, not a bullet. knownTags: the
// ids of the user's own tags, or null for any. least: the fewest bullet lines a tag needs to be a class.
function buildProfile(entries, { isPage = () => false, knownTags = null, least = 10, alpha = .25 } = {}) {
  const classOf = e => (e.values?.get('block/tags') || [PLAIN])[0];
  const bullets = new Map();   // class -> how many bullet (not page) lines
  for (const e of entries) if (!isPage(e)) { const c = classOf(e); bullets.set(c, (bullets.get(c) || 0) + 1); }
  const classes = [...bullets].filter(([c, n]) => c === PLAIN ? n > 0 : n >= least && (!knownTags || knownTags.has(c))).map(([c]) => c);
  const counts = new Map(classes.map(c => [c, new Map()])), total = new Map(classes.map(c => [c, 0])), lines = new Map(classes.map(c => [c, 0]));
  const vocab = new Set(), byId = new Map();
  for (const e of entries) {
    const c = classOf(e);
    if (!counts.has(c)) continue;
    const tokens = [...new Set(e.tokens)].filter(t => !t.startsWith('tag:'));
    byId.set(e.id, { c, tokens });
    lines.set(c, lines.get(c) + 1); total.set(c, total.get(c) + tokens.length);
    const m = counts.get(c);
    for (const t of tokens) { m.set(t, (m.get(t) || 0) + 1); vocab.add(t); }
  }
  return { classes, counts, total, lines, byId, vocab: vocab.size, alpha };
}

// Each class's log-probability of the tokens, best first: [[classId, logp], ...]. skip: the id of the line being
// asked about, left out of its own class (the scorer asks lines the profile was built from).
function profileScores(profile, tokens, { skip = null } = {}) {
  const { classes, counts, total, lines, byId, vocab, alpha } = profile;
  if (!classes.length) return [];
  const own = skip != null ? byId.get(skip) : null, ownSet = own ? new Set(own.tokens) : null;
  const query = [...new Set(tokens)].filter(t => !t.startsWith('tag:'));
  let n = 0; for (const c of classes) n += lines.get(c) - (own?.c === c ? 1 : 0);
  if (n <= 0) return [];
  return classes.map(c => {
    const mine = own?.c === c, k = lines.get(c) - (mine ? 1 : 0);
    if (k <= 0) return [c, -Infinity];
    const m = counts.get(c), tot = total.get(c) - (mine ? own.tokens.length : 0);
    let lp = Math.log(k / n);
    for (const t of query) lp += Math.log(((m.get(t) || 0) - (mine && ownSet.has(t) ? 1 : 0) + alpha) / (tot + alpha * vocab));
    return [c, lp];
  }).sort((a, b) => b[1] - a[1]);
}

// The tag the profile gives the tokens, when a tag leads the runner-up (the plain class included) by `gap` in log-odds:
// { id, gap, over } or null. gap 0 or less: never.
function profileTag(profile, tokens, gap, { skip = null } = {}) {
  if (!(gap > 0) || !tokens?.length) return null;
  const [best, next] = profileScores(profile, tokens, { skip });
  if (!best || best[0] === PLAIN || !isFinite(best[1])) return null;
  const lead = best[1] - (next ? next[1] : -Infinity);
  return lead >= gap ? { id: best[0], gap: lead, over: next ? next[0] : null } : null;
}

const api = { PLAIN, buildProfile, profileScores, profileTag };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).profile = api;
})();
