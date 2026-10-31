/* The scorer and the tuner: how the proposals do on THIS graph, and the limits that suit it.

   The original plugin's numbers (nearest at least .3, lead .7, tag nearest at least .6) were picked on one graph by a
   scoreboard. A graph written differently needs its own, so the scorer is part of the plugin and the plugin offers a
   command that runs it ("Tune proposals to this graph").

   The test is leave-one-out on the graph's own lines: take a line that has a value, hide that value, ask what would be
   proposed, compare. The line itself is left out of the engine's memory while it is asked about. Three counts:
   - properties: sure right/wrong, guess right/wrong, silent (nothing proposed);
   - tags: the tag an untagged line would get, right/wrong/silent, on lines that have a tag of yours;
   - plain: lines with no tag at all, `spoke` when a tag was proposed for one (the one thing that should stay near zero).
   Dates are not scored (a line's entry does not carry the page it was written on); the date rules are the graph's
   evidence, not a vote. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
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
      const got = propose(ctx, bulletOf(entry, null, [])).pieces.some(p => p.kind === 'tag');
      out.plain[got ? 'spoke' : 'silent']++;
      continue;
    }
    // The tag, asked of the line as if it had none.
    if (only !== 'properties') {
      const tagPiece = propose(ctx, bulletOf(entry, null, [])).pieces.find(p => p.kind === 'tag');
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

const wrongRate = (right, wrong) => right + wrong ? wrong / (right + wrong) : 0;

/* Tries a small grid of limits on this graph and picks, for the properties, the setting with the most right guesses among
   those whose wrong guesses stay under `maxWrong` of what they said (ties go to the stricter one); and for the tag, the
   loosest tag limit that keeps plain lines silent and wrong tags under `maxWrong`. Returns { limits, table, before, after }.
   Does not change ctx. */
async function tune(ctx, { sample = 1200, seed = 7, maxWrong = .03, grid, pause = null } = {}) {
  const near = grid?.nearLeast || [.2, .3, .4, .5, .6], lead = grid?.lead || [.6, .7, .8], tagNear = grid?.tagNearLeast || [.4, .5, .6, .7, .8];
  namesFor(ctx);
  // Each run is a pause apart (pause: an async function that lets the screen breathe), since a large graph takes a while.
  const run = async (limits, only) => { await pause?.(); return score({ ...ctx, limits: { ...ctx.limits, ...limits } }, { sample, seed, only }); };
  const before = await run({});
  const table = [];
  for (const nearLeast of near) for (const l of lead) {
    const s = (await run({ nearLeast, lead: l }, 'properties')).properties;
    table.push({ nearLeast, lead: l, right: s.guessRight, wrong: s.guessWrong, silent: s.silent, wrongRate: wrongRate(s.guessRight, s.guessWrong) });
  }
  const feasible = table.filter(t => t.wrongRate <= maxWrong);
  const best = (feasible.length ? feasible : table).slice().sort((a, b) => feasible.length
    ? (b.right - a.right) || (b.nearLeast - a.nearLeast) || (b.lead - a.lead)
    : (a.wrongRate - b.wrongRate) || (b.right - a.right))[0];
  const tagTable = [];
  for (const tagNearLeast of tagNear) {
    const s = await run({ nearLeast: best.nearLeast, lead: best.lead, tagNearLeast }, 'tags');
    tagTable.push({ tagNearLeast, right: s.tags.right, wrong: s.tags.wrong, silent: s.tags.silent, spoke: s.plain.spoke, plain: s.plain.spoke + s.plain.silent });
  }
  const tagOk = tagTable.filter(t => wrongRate(t.right, t.wrong) <= maxWrong && (t.plain ? t.spoke / t.plain <= .01 : true));
  const tagBest = (tagOk.length ? tagOk : tagTable).slice().sort((a, b) => tagOk.length ? (b.right - a.right) || (b.tagNearLeast - a.tagNearLeast) : (a.wrong - b.wrong) || (b.tagNearLeast - a.tagNearLeast))[0];
  const limits = { nearLeast: best.nearLeast, lead: best.lead, tagNearLeast: tagBest.tagNearLeast };
  return { limits, table, tagTable, before, after: await run(limits) };
}

const api = { score, tune, isLinkProp };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).score = api;
})();
