/* The scorer, for the tests (test/run.js): how the proposals do on a graph's own lines. Until 24 November 2026 it was part of the
   plugin (core/score.js), behind two commands that scored and tuned a graph; those went, and it is no longer loaded there.

   The test is leave-one-out on the graph's own lines: take a line that has a value, hide that value, ask what would be
   proposed, compare. The line itself is left out of the engine's memory while it is asked about. Three counts:
   - properties: sure right/wrong, guess right/wrong, silent (nothing proposed);
   - tags: the tag an untagged line would get where one is asked for (propose's offerTag, as the Alfred workflow's Add panel
     asks), right/wrong/silent, on lines that have a tag of yours;
   - plain: lines with no tag at all, `spoke` when a tag was proposed for one (the one thing that should stay near zero).
   Dates are not scored (a line's entry does not carry the page it was written on); the date rules are the graph's
   evidence, not a vote. */
(function () {
const need = n => require('../core/' + n + '.js');
const { propose } = need('propose');
const { sameIds } = need('text');
const { namesFor } = need('names');
const { isLinkProp } = need('schema');

// A small deterministic shuffle, so the same graph scores the same each time.
function seeded(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function sampleOf(list, max, seed) {
  if (list.length <= max) return list;
  const rand = seeded(seed), copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, max);
}
const tagsOf = entry => (entry.values.get('block/tags') || []).filter(id => id !== 0);
const bulletOf = (entry, hide, tags) => ({
  id: entry.id, uuid: '', text: entry.title, tags,
  values: new Map([...entry.values].filter(([ident]) => ident !== hide && ident !== 'block/tags')),
  page: null, parent: null,
});

function score(ctx, { sample = 1500, seed = 7, only = null } = {}) {
  const out = { properties: { sureRight: 0, sureWrong: 0, guessRight: 0, guessWrong: 0, silent: 0 }, tags: { right: 0, wrong: 0, silent: 0 }, plain: { spoke: 0, silent: 0 }, lines: 0 };
  if (!ctx.index) return out;
  namesFor(ctx);   // built once, shared by every question below
  const entries = sampleOf(ctx.index.entries.filter(e => e.tokens.length), sample, seed);
  out.lines = entries.length;
  for (const entry of entries) {
    const tags = tagsOf(entry);
    if (!tags.length) {
      if (only === 'properties') continue;
      const got = propose(ctx, bulletOf(entry, null, []), null, { offerTag: true }).pieces.some(p => p.kind === 'tag');
      out.plain[got ? 'spoke' : 'silent']++;
      continue;
    }
    // The tag, asked of the line as if it had none.
    if (only !== 'properties') {
      const tagPiece = propose(ctx, bulletOf(entry, null, []), null, { offerTag: true }).pieces.find(p => p.kind === 'tag');
      if (!tagPiece) out.tags.silent++; else out.tags[sameIds(tagPiece.ids, tags) ? 'right' : 'wrong']++;
    }
    if (only === 'tags') continue;
    // Each link property it holds, hidden in turn.
    for (const [ident, ids] of entry.values) {
      if (ident === 'block/tags' || !ids.length) continue;
      const piece = propose(ctx, bulletOf(entry, ident, tags)).pieces.find(p => p.ident === ident && p.kind === 'node');
      if (!piece) { out.properties.silent++; continue; }
      const right = sameIds(piece.ids, ids), kind = piece.guess ? 'guess' : 'sure';
      out.properties[kind + (right ? 'Right' : 'Wrong')]++;
    }
  }
  return out;
}

module.exports = { score };
})();
