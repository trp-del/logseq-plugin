/* Measuring Apple's model on this graph, on the Mac that has it: the command "Predictive: measure Apple's model on this
   graph", and the row of the same name in the settings window. What is asked and how it is judged is core/measure.js;
   this reads the notes, asks the helper one question at a time, and shows the report in a window of its own.

   It writes nothing to the graph. The report holds numbers and the names of tags and properties, never a note's words,
   so it can be copied and passed on; only on a graph made for measuring, marked by a page titled "Predictive test graph", does it
   also list each note's words with what the model said. It takes a minute or two: each note is asked two questions, each under
   a second. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, measure } = Flow;

const HELPER = 'http://127.0.0.1:47615', GIVE_UP = 20000, NOTES = 60, BEFORE = 2;
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const host = () => window.parent.document;
const S = { dlg: null, stop: null, report: '' };

async function helperStatus() {
  try { return await fetch(HELPER + '/status', { signal: AbortSignal.timeout(1500) }).then(r => r.json()); }
  catch (error) { return null; }
}
async function ask(fill, signal) {
  const t0 = performance.now();
  try {
    const reply = await fetch(HELPER + '/fill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fill), signal: AbortSignal.any([signal, AbortSignal.timeout(GIVE_UP)]) }).then(r => r.json());
    return { reply: reply.error ? null : reply, ms: performance.now() - t0, error: reply.error };
  } catch (error) { return { reply: null, ms: null, error: String(error?.name || error) }; }
}

/* One note as the core wants it: the bullet, what it holds under each property (a number's value, a date's day), the words
   around it. null when it holds nothing the core can judge. */
async function noteOf(ctx, id) {
  const block = await db.pullBlockById(id);
  if (!block) return null;
  const b = db.bulletOf(block, null, ctx.schema);
  if (!b.tags.length || !b.page) return null;
  const props = new Map(ctx.schema.props.map(p => [p.ident, p]));
  const held = [...b.values].filter(([ident]) => props.has(ident) && ident !== 'block/tags');
  const inner = await db.valueEntities(held.flatMap(([ident, ids]) => props.get(ident).type === 'number' || props.get(ident).type === 'date' ? ids : []));
  const truth = new Map();
  for (const [ident, ids] of held) {
    const prop = props.get(ident);
    if (prop.type === 'number') { const n = Number(inner.get(ids[0])?.number); if (Number.isFinite(n)) truth.set(ident, { kind: 'number', number: n }); }
    else if (prop.type === 'date') { const day = inner.get(ids[0])?.day; if (day) truth.set(ident, { kind: 'date', day }); }
    else truth.set(ident, { kind: 'ids', ids });
  }
  if (!truth.size) return null;
  const parent = db.pick(block, 'block/parent');
  const before = [];
  for (let at = b.uuid; before.length < BEFORE;) {
    const sib = await logseq.Editor.getPreviousSiblingBlock(at).catch(() => null);
    if (!sib) break;
    before.unshift(String(sib.title ?? sib.content ?? ''));
    at = sib.uuid;
  }
  return {
    b, truth, before: before.filter(Boolean),
    parent: parent && db.pick(parent, 'block/page') ? String(db.pick(parent, 'block/title') ?? '') : '',
    pageTitle: b.page.day ? '' : b.page.title, day: b.page.day || undefined,
  };
}

/* The run. progress(done, of, left ms) is called after each note; signal stops it between questions. */
async function run(progress, signal) {
  const status = await helperStatus();
  if (!status) return { error: 'The helper for Apple’s model is not running on this Mac. Plugin settings, Predictive, says how to start it.' };
  if (!status.ready) return { error: `Apple’s model is not ready on this Mac (${status.reason || 'no reason given'}).` };
  const oldHelper = !(status.version >= 3), noTagger = !oldHelper && status.tagging === false;
  // Only the settings this helper can take: an older one would answer every setting as it comes.
  const allowed = ({ req }) => { const setting = req.fill.model || 'default'; return setting === 'default' || !oldHelper && !(setting === 'tagging' && noTagger); };
  const ctx = await app.context();
  if (!ctx?.index?.entries.length) return { error: 'This graph has no tagged notes to measure on yet.' };
  const records = [], details = measure.isTestGraph(ctx) ? [] : null, started = performance.now();
  for (const id of measure.candidates(ctx)) {
    if (signal.aborted || records.length >= NOTES) break;
    const note = await noteOf(ctx, id).catch(() => null);
    if (!note) continue;
    const q = measure.questions(ctx, note);
    q.props = q.props.filter(allowed);
    q.tags = q.tags.filter(allowed);
    if (!q.asked.some(a => note.truth.has(a.prop.ident))) continue;
    const rec = { tagTitle: ctx.byId.get(note.b.tags[0])?.title || '', asked: q.asked, props: [], tags: [] };
    for (const { way, req } of q.props) {
      if (signal.aborted) break;
      const { reply, ms, error } = await ask(req.fill, signal);
      if (signal.aborted) break;
      rec.props.push({ way, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', results: measure.judge(ctx, note, req, reply, reply ? null : error) });
    }
    for (const { way, req } of q.tags) {
      if (signal.aborted) break;
      const { reply, ms, error } = await ask(req.fill, signal);
      if (signal.aborted) break;
      rec.tags.push({ way, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', result: measure.judgeTag(note, req, reply, reply ? null : error), said: reply ? measure.tagSaid(req, reply) : null });
    }
    if (signal.aborted) break;
    records.push(rec);
    if (details) details.push(measure.detailOf(ctx, note, q.asked, rec.props, rec.tags));
    const each = (performance.now() - started) / records.length;
    progress(records.length, NOTES, each * (NOTES - records.length));
  }
  const about = { version: logseq.baseInfo?.version || '', helper: status.version || 1, date: new Date().toISOString().slice(0, 10), oldHelper, noTagger };
  return { text: measure.text(measure.tally(records), about, details, measure.outsideRange(ctx)), stopped: signal.aborted, count: records.length, test: !!details };
}

/* The window: one real dialog in Logseq's own window, in the grammar's look, as the settings window is. */
const CSS = `.pm-dialog { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important;
  width: min(820px, 92vw); max-height: 86vh; box-sizing: border-box; padding: 0; border: 1px solid var(--lk-hair); border-radius: 8px;
  background: var(--lk-paper, #fff); color: var(--lk-text, #222); font-size: 14px; line-height: 1.5; box-shadow: 0 10px 30px rgba(0,0,0,.14); }
.pm-dialog::backdrop { background: rgba(0,0,0,.18); }
.pm-dialog[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.pm-head { display: flex; align-items: baseline; gap: 10px; padding: 14px 18px 8px 22px; }
.pm-head b { font-size: 16px; font-weight: 600; }
.pm-head .lk-close { margin-left: auto; }
.pm-body { padding: 4px 22px 14px; overflow: auto; min-height: 0; }
.pm-body p { margin: 0 0 10px; }
.pm-quiet { color: var(--lk-quiet); }
.pm-report { font: 12.5px/1.55 var(--lk-mono, ui-monospace, monospace); white-space: pre; overflow-x: auto; margin: 4px 0 0; }
.pm-foot { display: flex; align-items: baseline; gap: 18px; padding: 10px 22px 16px; }
.pm-foot .pm-quiet { margin-right: auto; font-size: 13px; }`;

function draw(body, foot) {
  S.dlg.querySelector('.pm-body').innerHTML = body;
  S.dlg.querySelector('.pm-foot').innerHTML = foot;
}
const minutes = ms => ms < 60000 ? 'under a minute' : `about ${Math.round(ms / 60000)} minute${Math.round(ms / 60000) === 1 ? '' : 's'}`;

async function open() {
  if (S.dlg?.open) return;
  const doc = host();
  if (!doc.getElementById('pm-style')) { const st = doc.createElement('style'); st.id = 'pm-style'; st.textContent = CSS; doc.head.appendChild(st); }
  S.dlg = doc.createElement('dialog');
  S.dlg.className = 'pm-dialog';
  S.dlg.innerHTML = `<div class="pm-head"><b>Measuring Apple’s model</b><span class="pm-quiet">on this graph</span><button type="button" class="lk-close" aria-label="Close" title="Close (Esc)">×</button></div><div class="pm-body"></div><div class="pm-foot"></div>`;
  doc.body.appendChild(S.dlg);
  const stopper = S.stop = new AbortController();
  const close = () => { stopper.abort(); S.dlg?.close(); S.dlg?.remove(); S.dlg = null; };
  S.dlg.addEventListener('cancel', event => { event.preventDefault(); close(); });
  S.dlg.addEventListener('click', event => {
    const t = event.target;
    if (t.closest('.lk-close')) return close();
    if (t.closest('[data-pm="stop"]')) return stopper.abort();
    if (t.closest('[data-pm="copy"]')) {
      const done = () => { t.closest('[data-pm="copy"]').textContent = 'Copied'; };
      return navigator.clipboard.writeText(S.report).then(done, () => { const pre = S.dlg.querySelector('.pm-report'); const r = doc.createRange(); r.selectNodeContents(pre); const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(r); });
    }
  });
  S.dlg.showModal();
  // The keyboard rests on the window, not on its ×, so nothing is ringed when it opens; Escape still closes it.
  const body = S.dlg.querySelector('.pm-body'); body.tabIndex = -1; body.style.outline = 'none'; body.focus();
  draw(`<p>Each note is asked as if it held nothing, as Predictive asks, and the answers are set against what you wrote. Nothing is written to the graph.</p><p class="pm-quiet" id="pm-progress">Reading the graph…</p>`,
    `<span class="pm-quiet">Only numbers and the names of tags and properties are kept, never your words.</span><button type="button" class="lk-lone lk-i-x" data-pm="stop">Stop</button>`);
  const result = await run((done, of, left) => {
    const line = S.dlg?.querySelector('#pm-progress');
    if (line) line.textContent = `${done} of ${of} notes asked · ${minutes(left)} left`;
  }, stopper.signal).catch(error => ({ error: String(error?.message || error) }));
  if (!S.dlg) return;
  if (result.error) return draw(`<p>${esc(result.error)}</p>`, '');
  S.report = result.text;
  draw(`${result.stopped ? `<p class="pm-quiet">Stopped after ${result.count} notes; the numbers are of those.</p>` : ''}<pre class="pm-report">${esc(result.text)}</pre>`,
    `<span class="pm-quiet">${result.test ? 'A test graph: the report lists its notes’ words, which are about no one real.' : 'Only numbers and the names of tags and properties, never your words.'}</span><button type="button" class="lk-accent lk-i-copy" data-pm="copy">Copy the report</button>`);
}

// Gone with the plugin: the window and its stylesheet.
app.onStop(() => { S.stop?.abort(); S.dlg?.remove(); S.dlg = null; try { host().getElementById('pm-style')?.remove(); } catch (error) { /* Logseq's window is gone */ } });

Flow.measureUi = { open, run };
})();
