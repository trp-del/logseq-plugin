/* Apple's tools on this Mac, asked in one order for what the rules left open: the matcher first (meaning, milliseconds), then
   the name finder (names, milliseconds), then Apple's model (model, about a second) for what is still open. One door for the
   proposals (logseq/propose-ui.js): had, wanted, done and ask, as modelAsk alone offered before.

   The three never replace each other: what meaning filled is done when names and the model are asked; a tag meaning pencils is
   the tag the model is asked under (assume), as a tag the rules pencil is. The model may still replace a rules' guess from
   plain words alone (core/model.js, merge). */
(function () {
const Flow = (window.Flow ||= {});
const { model } = Flow;

const APPLE = new Set(['model', 'meaning', 'names']);
const fromApple = piece => String(piece?.how || '').split('+').some(how => APPLE.has(how));

// The result as the next tool sees it: the rules' pieces with what came before added, and a pencilled tag as the tag assumed.
function withMore(result, more) {
  if (!more?.length) return result;
  const tag = more.find(p => p.kind === 'tag');
  return { ...result, pieces: [...result.pieces, ...more.filter(p => !result.pieces.some(q => q.ident === p.ident))], assume: result.assume || (tag ? tag.tag : null) };
}
const wanted = (ctx, b, result) => !!(Flow.meaningAsk && Flow.meaning.wanted(ctx, b, result)) || !!(Flow.peopleAsk && (result.record === b || result.assume)) || !!Flow.modelAsk?.wanted(ctx, b, result);
/* What is already in for these words, each tool's kept answer in the same order as ask: the pieces, or null when any tool
   still has to be asked (then ask draws them as they come). done: nothing more is to come for these words. */
function had(ctx, b, result) {
  let more = [];
  const meant = Flow.meaningAsk ? Flow.meaningAsk.had(ctx, b, result) : [];
  if (!meant) return null;
  more = model.merge(more, meant);
  let seen = withMore(result, more);
  const named = Flow.peopleAsk ? Flow.peopleAsk.had(ctx, b, seen) : [];
  if (!named) return null;
  more = model.merge(more, named.map(p => seen.assume && !result.assume ? { ...p, needsTag: true } : p));
  seen = withMore(result, more);
  if (!Flow.modelAsk?.wanted(ctx, b, seen)) return more;
  const fromModel = Flow.modelAsk.had(ctx, b, seen);
  return fromModel ? model.merge(more, fromModel) : null;
}
function done(ctx, b, result) {
  const more = had(ctx, b, result);
  if (!more) return false;
  const seen = withMore(result, more);
  return !Flow.modelAsk?.wanted(ctx, b, seen) || Flow.modelAsk.done(ctx, b, seen);
}

/* The guesses from Apple's tools, in order; some(pieces) is handed what is in so far as soon as the next tool is slower than a
   moment (the model), so the quick ones are drawn without waiting. Returns everything in the end. */
async function ask(ctx, b, result, some = null) {
  let more = [];
  if (Flow.meaningAsk) more = model.merge(more, await Flow.meaningAsk.ask(ctx, b, result).catch(() => []));
  let seen = withMore(result, more);
  if (Flow.peopleAsk) more = model.merge(more, (await Flow.peopleAsk.ask(ctx, b, seen).catch(() => [])).map(p => seen.assume && !result.assume ? { ...p, needsTag: true } : p));
  seen = withMore(result, more);
  if (!Flow.modelAsk?.wanted(ctx, b, seen)) return more;
  if (more.length && some) some(more);
  const fromModel = await Flow.modelAsk.ask(ctx, b, seen, some && (first => some(model.merge(more, first))));
  return model.merge(more, fromModel);
}

Flow.apple = { ask, wanted, had, done, fromApple, withMore };
})();
