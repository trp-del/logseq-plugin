/* Matching by meaning, through Predictive's helper on this Mac (helper/, /meaning). What to make of the near notes is
   core/meaning.js; this teaches the helper the graph's notes and asks it which are nearest. Apple's sentence matcher runs on the
   Mac with no Apple Intelligence and no filter; the helper keeps a vector per note in memory and never the words.

   The graph is taught after each reading of the context (every few minutes, in slices so a key is never held up) and a changed
   node is taught alone a moment later. The helper answers in a few milliseconds, so the near notes are asked for at the same
   pause as the rules and drawn with them. */
(function () {
const Flow = (window.Flow ||= {});
const { app, meaning } = Flow;

const { HELPER } = window.PluginDoor, LOOK_AGAIN = 30000, SLICE = 400, KEEP = 60;
const S = { ready: null, at: 0, checking: null, taught: null, teaching: null, answers: new Map(), graph: '' };

// Whether the helper is there with the matcher, looked at again every 30 seconds. Shares the setting with Apple's model.
async function ready() {
  if (!app.setting('proposalsModel')) return false;
  if (S.ready !== null && Date.now() - S.at < LOOK_AGAIN) return S.ready;
  S.checking ||= fetch(HELPER + '/status', { signal: AbortSignal.timeout(800) }).then(r => r.json()).then(r => !!r.meaning, () => false)
    .then(ok => { S.ready = ok; S.at = Date.now(); S.checking = null; return ok; });
  return S.checking;
}
const post = (body, giveUp = 4000) => fetch(HELPER + '/meaning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(giveUp) }).then(r => r.json());

/* The whole graph taught: every entry of the context's index, in slices. Once per reading (ctx.readAt); a reading already taught
   is not taught again. */
async function teach(ctx) {
  if (!ctx?.index || !await ready()) return false;
  const key = `${ctx.graph}\n${ctx.readAt}`;
  if (S.taught === key) return true;
  if (S.teaching?.key === key) return S.teaching.job;
  const job = (async () => {
    const entries = ctx.index.entries.filter(e => e.tokens?.length);
    let first = true;
    for (let at = 0; at < entries.length; at += SLICE) {
      const learn = entries.slice(at, at + SLICE).map(e => ({ id: e.id, text: meaning.textOf(ctx, e.title) }));
      const r = await post({ graph: ctx.graph || '', learn, replace: first }, 20000);
      if (r?.error) throw new Error(r.error);
      first = false;
      await new Promise(resolve => setTimeout(resolve));
    }
    if (!entries.length) await post({ graph: ctx.graph || '', learn: [], replace: true });
    S.taught = key; S.answers.clear();
    return true;
  })().catch(error => { S.ready = null; app.warnOnce('the graph could not be taught to the matcher', error); return false; }).finally(() => { if (S.teaching?.key === key) S.teaching = null; });
  S.teaching = { key, job };
  return job;
}
// One node learned at once: its words as they are now, or taken out when it is gone.
async function learn(ctx, id, title) {
  if (!ctx?.index || S.taught !== `${ctx.graph}\n${ctx.readAt}` || !await ready()) return;
  S.answers.clear();
  await post({ graph: ctx.graph || '', learn: [{ id, text: title ? meaning.textOf(ctx, title) : '' }] }).catch(() => {});
}

// Nodes learned a moment ago (logseq/db.js, learnNodes): taught as they now stand in the index, or taken out.
function learnIds(ctx, ids) {
  const byId = ctx.index?.byId;
  if (!byId) return;
  for (const id of ids) { const i = byId.get(id), entry = i == null ? null : ctx.index.entries[i]; learn(ctx, id, entry?.tokens?.length ? entry.title : '').catch(() => {}); }
}

// The near notes for these words: [{ entry, sim }] best first, or [] when the helper is not there or the graph is not taught yet.
async function near(ctx, b) {
  if (!ctx?.index || !await ready()) return [];
  if (S.taught !== `${ctx.graph}\n${ctx.readAt}`) { teach(ctx).catch(() => {}); return []; }   // still learning the graph: nothing yet, never a wait
  const text = meaning.textOf(ctx, b.text), key = `${ctx.graph}\n${text}`;
  if (!text) return [];
  if (!S.answers.has(key)) {
    const k = (ctx.limits?.meaningK || meaning.LIMITS.meaningK);
    const found = await post({ graph: ctx.graph || '', text, k, skip: [b.id].filter(id => id > 0) }).then(r => r?.near || [], () => null);
    if (!found) { S.ready = null; return []; }
    S.answers.set(key, found);
    if (S.answers.size > KEEP) S.answers.delete(S.answers.keys().next().value);
  }
  return meaning.nearOf(ctx, S.answers.get(key));
}
// The guesses already in for these words (the near notes kept from an earlier ask), or null when there is none yet.
function had(ctx, b, result) {
  if (!ctx?.index || !meaning.wanted(ctx, b, result)) return [];
  const text = meaning.textOf(ctx, b.text), found = S.answers.get(`${ctx.graph}\n${text}`);
  return found ? meaning.pieces(ctx, b, result, meaning.nearOf(ctx, found)) : null;
}
// The guesses by meaning for the bullet, or [].
async function ask(ctx, b, result) {
  if (!meaning.wanted(ctx, b, result)) return [];
  return meaning.pieces(ctx, b, result, await near(ctx, b));
}
// The tag the near notes carry, for Option-T: or null.
async function tagFor(ctx, b) {
  const found = await ask(ctx, b, { pieces: [], record: b, quiet: [] });
  return found.find(p => p.kind === 'tag')?.tag || null;
}

Flow.meaningAsk = { ready, teach, learn, learnIds, near, had, ask, tagFor, forget: () => { S.taught = null; S.answers.clear(); S.ready = null; } };
})();
