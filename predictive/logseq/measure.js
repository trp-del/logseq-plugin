/* Measuring Apple's model on this graph, on the Mac that has it: the command "Predictive: measure Apple's model on this
   graph", and the row of the same name in the settings window. What is asked and how it is judged is core/measure.js;
   this reads the notes, asks the helper one question at a time, and shows the report in a window of its own.

   It writes nothing to the graph. The report holds numbers and the names of tags and properties, never a note's words,
   so it can be copied and passed on; only on a graph made for measuring, marked by a page titled "Predictive test graph", does it
   also list each note's words with what the model said. It takes several minutes: each note is asked up to five questions, each
   under a second (the properties as Predictive asks now and as it asked before, the tag three ways), then everything Predictive
   would show for it while writing is put together and judged (seen). */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, measure } = Flow;

const { helper } = window.PluginDoor, GIVE_UP = 20000, NOTES = 60, BEFORE = 2;
const { esc, host } = window.PluginDoor;
const S = { dlg: null, stop: null, report: '' };

async function helperStatus() {
  try { return await helper.status(1500); }
  catch (error) { return null; }
}
async function ask(fill, signal) {
  const t0 = performance.now();
  try {
    const reply = await helper.post('/fill', fill, { wait: GIVE_UP, signal });
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

/* The note asked by meaning and by the name finder, as Predictive asks: untagged and empty for the tag (core/meaning.js), tagged
   and empty for the properties the rules leave open, and the finder on the tagged note (a new page it offers is a double, since
   the note's names all had pages). { tag, props: [{ title, result }], doubles, named } */
async function byMeaning(ctx, note) {
  const { sameIds } = Flow.text;
  const bare = { ...note.b, tags: [], values: new Map() }, bareResult = { pieces: [], record: bare, quiet: [] };
  const tagPieces = await Flow.meaningAsk.ask(ctx, bare, bareResult);
  const tag = tagPieces.find(p => p.kind === 'tag');
  const tagged = { ...note.b, values: new Map() }, result = Flow.propose.propose(ctx, tagged);
  const pieces = await Flow.meaningAsk.ask(ctx, tagged, result);
  const props = [];
  // The page properties only where they are voted by meaning at all (the limit meaningProps; not since 12 November 2026).
  for (const prop of ctx.limits?.meaningProps ? Flow.meaning.openProps(ctx, tagged, result) : []) {
    const truth = note.truth.get(prop.ident);
    if (!truth || truth.kind !== 'ids') continue;
    const said = pieces.find(p => p.ident === prop.ident);
    props.push({ title: `${ctx.byId.get(note.b.tags[0])?.title || ''} · ${prop.title}`, result: !said ? 'silent' : sameIds(said.ids, truth.ids) ? 'right' : 'wrong' });
  }
  const found = Flow.peopleAsk ? await Flow.peopleAsk.ask(ctx, tagged, result).catch(() => []) : [];
  const named = Flow.peopleAsk ? (await Flow.peopleAsk.namesIn(ctx, tagged).catch(() => [])).length > 0 : false;
  return { tag: !tag ? 'silent' : note.b.tags.includes(tag.tag.id) ? 'right' : 'wrong', props, doubles: found.length, named: named ? 1 : 0 };
}

/* The run. progress(done, of, left ms) is called after each note; signal stops it between questions. */
/* What you would see while writing this note, were it new: the rules' proposals for the tagged note with its values taken out,
   then Apple's tools for what the rules left open, through the same door the proposals use (logseq/apple.js), judged. */
async function seen(ctx, note) {
  const tagged = { ...note.b, values: new Map() }, result = Flow.propose.propose(ctx, tagged);
  const more = await Flow.apple.ask(ctx, tagged, result).catch(() => []);
  return measure.judgeSeen(ctx, note, Flow.model.merge(result.pieces, more));
}

// Twice the notes of the first measures (12 November 2026): forty to sixty notes could not tell one way of asking from another.
const MOST = NOTES * 2;
async function run(progress, signal) {
  const status = await helperStatus();
  if (!status) return { error: 'The helper for Apple’s model is not running on this Mac. Plugin settings, Predictive, says how to start it.' };
  // Without Apple's model (no Apple Intelligence on this Mac), the matcher and the name finder are measured alone, as they work.
  if (!status.ready && !status.meaning) return { error: `Apple’s model is not ready on this Mac (${status.reason || 'no reason given'}).` };
  const modelHere = !!status.ready, oldHelper = !(status.version >= 3), noTagger = !oldHelper && status.tagging === false;
  // Only the settings this helper can take: an older one would answer every setting as it comes.
  const allowed = ({ req }) => { const setting = req.fill.model || 'default'; return setting === 'default' || !oldHelper && !(setting === 'tagging' && noTagger); };
  const ctx = await app.context();
  if (!ctx?.index?.entries.length) return { error: 'This graph has no tagged notes to measure on yet.' };
  // The matcher must know the whole graph before it is measured: taught afresh, as the helper may have been started again since.
  if (status.meaning) { Flow.meaningAsk.forget(); await Flow.meaningAsk.teach(ctx); }
  const records = [], details = measure.isTestGraph(ctx) ? [] : null, started = performance.now();
  for (const id of measure.candidates(ctx)) {
    if (signal.aborted || records.length >= MOST) break;
    const note = await noteOf(ctx, id).catch(() => null);
    if (!note) continue;
    // The tags of the notes nearest in meaning, for the tag asked from a short list.
    const nearest = status.meaning ? await Flow.meaningAsk.near(ctx, { ...note.b, tags: [], values: new Map() }, 20).catch(() => []) : [];
    const q = measure.questions(ctx, note, { nearTags: measure.nearTags(ctx, nearest) });
    q.props = modelHere ? q.props.filter(x => !x.req || allowed(x)) : [];
    q.tags = modelHere ? q.tags.filter(allowed) : [];
    if (!q.asked.some(a => note.truth.has(a.prop.ident))) continue;
    const rec = { tagTitle: ctx.byId.get(note.b.tags[0])?.title || '', asked: q.asked, props: [], tags: [] };
    // One answer for one question: the two ways ask the same when every page asked about is named in the words.
    const had = new Map(), once = async fill => { const key = JSON.stringify(fill); if (!had.has(key)) had.set(key, await ask(fill, signal)); return had.get(key); };
    for (const { way, req, full } of q.props) {
      if (signal.aborted) break;
      if (!req) { rec.props.push({ way, ms: null, size: null, error: null, results: measure.notAsked(note, full, null) }); continue; }   // nothing named: no question
      const { reply, ms, error } = await once(req.fill);
      if (signal.aborted) break;
      rec.props.push({ way, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', results: [...measure.judge(ctx, note, req, reply, reply ? null : error), ...(full ? measure.notAsked(note, full, req) : [])] });
    }
    for (const { way, req, listed } of q.tags) {
      if (signal.aborted) break;
      const { reply, ms, error } = await ask(req.fill, signal);
      if (signal.aborted) break;
      rec.tags.push({ way, listed, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', result: measure.judgeTag(note, req, reply, reply ? null : error), said: reply ? measure.tagSaid(req, reply) : null });
    }
    if (signal.aborted) break;
    if (status.meaning) rec.meaning = await byMeaning(ctx, note).catch(() => null);
    rec.seen = await seen(ctx, note).catch(() => null);
    records.push(rec);
    if (details) details.push(measure.detailOf(ctx, note, q.asked, rec.props, rec.tags));
    const each = (performance.now() - started) / records.length;
    progress(records.length, MOST, each * (MOST - records.length));
  }
  const about = { version: logseq.baseInfo?.version || '', helper: status.version || 1, date: new Date().toISOString().slice(0, 10), oldHelper, noTagger };
  return { text: measure.text(measure.tally(records), about, details, measure.outsideRange(ctx)), stopped: signal.aborted, count: records.length, test: !!details };
}

/* The window: one real dialog in Logseq's own window, the library's lk-window; here its place and size. */
const CSS = `.pm-dialog { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important;
  width: min(820px, 92vw); max-height: 86vh; box-sizing: border-box; padding: 0; }
.pm-dialog[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.pm-head { display: flex; align-items: baseline; gap: 10px; padding: 14px 18px 8px 22px; }
.pm-head b { font-size: 16px; font-weight: 600; }
.pm-head .lk-close { margin-left: auto; }
.pm-body { padding: 4px 22px 14px; overflow: auto; min-height: 0; }
.pm-body p { margin: 0 0 10px; }
.pm-quiet { color: var(--lk-quiet); }
.pm-report { font: 12.5px/1.55 var(--lk-mono, ui-monospace, monospace); white-space: pre; overflow-x: auto; margin: 4px 0 0; }
.pm-foot { display: flex; align-items: baseline; gap: 18px; padding: 10px 22px 16px; }
.pm-foot .pm-quiet { margin-right: auto; font-size: var(--lk-small); }`;

function draw(body, foot) {
  S.dlg.querySelector('.pm-body').innerHTML = body;
  S.dlg.querySelector('.pm-foot').innerHTML = foot;
}
const minutes = ms => ms < 60000 ? 'under a minute' : `about ${Math.round(ms / 60000)} minute${Math.round(ms / 60000) === 1 ? '' : 's'}`;

async function open() {
  if (S.dlg?.open) return;
  const doc = host();
  app.sheet('pm-style', CSS, '', doc);   // the base's own stylesheet in Logseq's page, taken out at stop
  S.dlg = doc.createElement('dialog');
  S.dlg.className = 'pm-dialog lk-window';
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
      const button = t.closest('[data-pm="copy"]');
      return window.PluginDoor.copy({ text: S.report }).then(ok => { button.textContent = ok ? 'Copied' : 'Could not copy: select the report and press ⌘C'; });
    }
  });
  S.dlg.showModal();
  // The keyboard rests on the window, not on its ×, so nothing is ringed when it opens; Escape still closes it.
  const body = S.dlg.querySelector('.pm-body'); body.tabIndex = -1; body.style.outline = 'none'; body.focus();
  draw(`<p>Each note is asked as if it held nothing, as Predictive asks (Apple’s model, the matcher and the name finder, those on this Mac), and the answers are set against what you wrote. Nothing is written to the graph.</p><p class="pm-quiet" id="pm-progress">Reading the graph…</p>`,
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
app.onStop(() => { S.stop?.abort(); S.dlg?.remove(); S.dlg = null; });

Flow.measureUi = { open, run };
})();
