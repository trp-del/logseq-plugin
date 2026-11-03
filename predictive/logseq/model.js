/* Asking Apple's model, through Predictive's helper on this Mac (helper/, 127.0.0.1 only). What to ask and what to keep is
   core/model.js; this only carries the question and the answer, and stays silent when the helper is not there: no helper,
   no model on this Mac, or the setting off, and Predictive works as it always has.

   The model takes about a second, so it is asked only once typing has paused a little longer than for the rules, one
   question at a time (a newer one cancels the older), and each answer is kept for the same words. */
(function () {
const Flow = (window.Flow ||= {});
const { app, model } = Flow;

const HELPER = 'http://127.0.0.1:47615', LOOK_AGAIN = 30000, WAIT = 500, GIVE_UP = 8000, KEEP = 60;
const S = { ready: null, at: 0, checking: null, asking: null, answers: new Map() };

// Whether the helper is there and its model ready, looked at again every 30 seconds.
async function ready() {
  if (!app.setting('proposalsModel')) return false;
  if (S.ready !== null && Date.now() - S.at < LOOK_AGAIN) return S.ready;
  S.checking ||= fetch(HELPER + '/status', { signal: AbortSignal.timeout(800) }).then(r => r.json()).then(r => !!r.ready, () => false)
    .then(ok => { S.ready = ok; S.at = Date.now(); S.checking = null; return ok; });
  return S.checking;
}

const keyOf = req => JSON.stringify(req.fill);
// The answer already had for these words, as guesses, or null when there is none yet.
function had(ctx, b, result) {
  const req = model.request(ctx, b, result);
  const reply = req && S.answers.get(keyOf(req));
  return reply ? model.pieces(ctx, req, reply) : null;
}
// Whether there is anything to ask the model about this bullet.
const wanted = (ctx, b, result) => !!model.request(ctx, b, result);

// The model's reply to a question: null when there is no helper, or a newer question came. wait: the pause after typing.
async function replyTo(req, { wait = WAIT, giveUp = GIVE_UP } = {}) {
  if (!req || !await ready()) return null;
  const key = keyOf(req);
  if (S.answers.has(key)) return S.answers.get(key);
  S.asking?.abort();
  const mine = S.asking = new AbortController();
  if (wait) await new Promise(r => setTimeout(r, wait));
  if (mine.signal.aborted) return null;
  try {
    const response = await fetch(HELPER + '/fill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: key, signal: AbortSignal.any([mine.signal, AbortSignal.timeout(giveUp)]) });
    const reply = await response.json();
    if (reply.error) { app.warnOnce('Apple’s model did not answer', reply.error); return null; }
    S.answers.set(key, reply);
    if (S.answers.size > KEEP) S.answers.delete(S.answers.keys().next().value);
    return reply;
  } catch (error) {
    if (!mine.signal.aborted && error?.name !== 'TimeoutError') { S.ready = null; app.warnOnce('the helper for Apple’s model could not be reached', error); }
    return null;
  } finally { if (S.asking === mine) S.asking = null; }
}
// The model's guesses for the bullet: [] when there is nothing to ask, no helper, or a newer question came.
async function ask(ctx, b, result) {
  const req = model.request(ctx, b, result), reply = await replyTo(req);
  return reply ? model.pieces(ctx, req, reply) : [];
}
// Option-T: the tag the model reads the bullet as, or null; asked at once, and not waited for longer than a moment.
async function tagFor(ctx, b) {
  const req = model.tagRequest(ctx, b), reply = await replyTo(req, { wait: 0, giveUp: 2500 });
  return reply ? model.tagOf(req, reply) : null;
}

// What the helper says now, asked afresh, for the settings window: { reached: false } when nothing answers on this Mac,
// else { reached: true, ready, reason }. The ready() above takes the answer too.
async function status() {
  try {
    const r = await fetch(HELPER + '/status', { signal: AbortSignal.timeout(800) }).then(response => response.json());
    S.ready = !!r.ready; S.at = Date.now();
    return { reached: true, ready: !!r.ready, reason: r.reason || '' };
  } catch (error) { S.ready = false; S.at = Date.now(); return { reached: false }; }
}

Flow.modelAsk = { ready, status, had, wanted, ask, tagFor, forget: () => { S.answers.clear(); S.ready = null; } };
})();
