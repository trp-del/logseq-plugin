/* node tools/harness/measure.js [--held 600] [--notes 6000] [--seed 7] [--set meaningLeast=.4 ...] [--no-model] [--json file]
   Measures Predictive on a large made-up graph (tools/harness/corpus.js: one fictional patient, about no one real), outside
   Logseq: the plugin's own core (the rules, core/meaning.js, core/model.js) with the real helper on this Mac for Apple's
   matcher and, where the Mac has it, Apple's model. Nothing is written anywhere but the report.

   Each held-out note is asked about as if it were being written: first with its tag and no values (the properties), then
   with no tag (which tag is it). The proposals are put together as while writing: the rules, then the matcher for what the
   rules left open, then the model for what is still open. Not here: the name finder (it offers new pages, which a made-up
   graph cannot judge) and dates.

   The report: what you would see (written at once, pencilled, nothing) against what a careful person filled in, by who
   proposed it and by how the note carries the value (a link, a name, a part of a name, other words, not in the words); the
   tag; plain notes that should get no tag. Where the model is on the Mac, also the measure's own report (core/measure.js):
   named against range too, the tag three ways.

   --set changes a limit for the run (ctx.limits: meaningLeast, meaningLead, meaningGap, meaningK, nearLeast, lead ...), to see
   what a setting does before it is changed in the plugin. */
const path = require('node:path'), fs = require('node:fs');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const { propose } = core('propose'), meaning = core('meaning'), model = core('model'), measure = core('measure');
const corpus = require('./corpus.js');

const HELPER = 'http://127.0.0.1:47615';
const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const limits = {};
args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); limits[k] = v === 'true' ? true : v === 'false' ? false : Number(v); } });
const post = (where, body, wait = 20000) => fetch(HELPER + where, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(wait) }).then(r => r.json());

const blank = () => ({ right: 0, wrong: 0, silent: 0, spoke: 0 });
const SOURCE = piece => { const how = String(piece.how || '').split('+'); return how.includes('model') ? 'Apple\'s model' : how.includes('meaning') ? 'by meaning' : 'the rules'; };
const pct = (n, of) => of ? Math.round(100 * n / of) + '%' : '–';

(async () => {
  const status = await fetch(HELPER + '/status', { signal: AbortSignal.timeout(2000) }).then(r => r.json()).catch(() => null);
  if (!status) { console.error('Predictive\'s helper is not running on this Mac (predictive/helper/install.sh).'); process.exit(1); }
  const made = corpus.make({ notes: Number(arg('notes', 6000)), held: Number(arg('held', 600)), seed: Number(arg('seed', 7)) });
  const { ctx } = made;
  Object.assign(ctx.limits, limits);
  const modelHere = !!status.ready && !args.includes('--no-model');
  const page = { id: 9902, uuid: '00000000-0000-4000-8000-000000009902', title: 'Nov 2', day: 20261102, tags: [] };

  // The matcher learns the graph, as logseq/meaning.js teaches it.
  const entries = ctx.index.entries.filter(e => e.tokens?.length);
  if (status.meaning) for (let at = 0; at < entries.length; at += 400)
    await post('/meaning', { graph: ctx.graph, learn: entries.slice(at, at + 400).map(e => ({ id: e.id, text: meaning.textOf(ctx, e.title) })), replace: at === 0 }, 60000);
  const nearOf = async (text, k) => !status.meaning ? [] : meaning.nearOf(ctx, (await post('/meaning', { graph: ctx.graph, text: meaning.textOf(ctx, text), k, skip: [] })).near);
  const fill = async req => { const r = await post('/fill', req.fill).catch(() => null); return r && !r.error ? r : null; };
  // As logseq/apple.js: what came before is done when the next tool is asked, and a pencilled tag is the tag assumed.
  const withMore = (result, more) => { const tag = more.find(p => p.kind === 'tag'); return { ...result, pieces: [...result.pieces, ...more.filter(p => !result.pieces.some(q => q.ident === p.ident))], assume: result.assume || (tag ? tag.tag : null) }; };

  const seen = { sure: blank(), guess: blank(), silent: 0, empty: 0, bySource: new Map(), byHow: new Map(), byProp: new Map() };
  const tags = { rules: blank(), meaning: blank(), model: blank(), silent: 0, of: 0 }, plain = { rules: 0, meaning: 0, model: 0, of: 0 };
  const records = [];
  let n = 0;
  for (const note of made.held) {
    const b = { id: -(++n), uuid: '', text: note.text, tags: [note.tag], values: new Map(), page, parent: null };
    // The properties, the tag given.
    const rules = propose(ctx, b);
    const near = await nearOf(b.text, ctx.limits.meaningK || meaning.LIMITS.meaningK);
    let more = meaning.wanted(ctx, b, rules) ? meaning.pieces(ctx, b, rules, near) : [];
    if (modelHere) { const req = model.request(ctx, b, withMore(rules, more)); const reply = req && await fill(req); if (reply) more = model.merge(more, model.pieces(ctx, req, reply)); }
    const judged = measure.judgeSeen(ctx, { b, truth: note.truth }, model.merge(rules.pieces, more));
    for (const r of judged) {
      if (r.result === 'quiet' || r.result === 'spoke') seen.empty++;
      if (r.result === 'quiet') continue;
      const ident = ctx.schema.props.find(p => p.title === r.title).ident, how = note.how.get(ident) || 'left empty';
      const cell = (map, key) => { if (!map.has(key)) map.set(key, blank()); return map.get(key); };
      cell(seen.byHow, how)[r.result]++; cell(seen.byProp, `${note.tagTitle} · ${r.title}`)[r.result]++;
      if (r.result === 'silent') { seen.silent++; continue; }
      seen[r.sure ? 'sure' : 'guess'][r.result]++;
      cell(seen.bySource, (r.sure ? 'written: ' : 'pencilled: ') + r.source)[r.result]++;
    }
    // The tag, the note bare.
    const bare = { ...b, tags: [] }, bareRules = propose(ctx, bare);
    let tag = bareRules.assume || bareRules.pieces.find(p => p.kind === 'tag')?.tag || null, by = 'rules';
    if (!tag && meaning.wanted(ctx, bare, bareRules)) { tag = meaning.pieces(ctx, bare, bareRules, near).find(p => p.kind === 'tag')?.tag || null; by = 'meaning'; }
    if (!tag && modelHere && !bareRules.pieces.length) { const req = model.tagRequest(ctx, bare); const reply = req && await fill(req); tag = reply ? model.tagOf(req, reply) : null; by = 'model'; }
    tags.of++;
    if (!tag) tags.silent++; else tags[by][tag.id === note.tag ? 'right' : 'wrong']++;
    // The measure's own questions (named against range too, the tag three ways), where the model is here.
    if (modelHere) {
      const q = measure.questions(ctx, { b, truth: note.truth, day: page.day }, { nearTags: measure.nearTags(ctx, await nearOf(b.text, 20)) });
      const rec = { tagTitle: note.tagTitle, asked: q.asked, props: [], tags: [] }, had = new Map();
      const once = async f => { const key = JSON.stringify(f); if (!had.has(key)) { const t0 = performance.now(); const r = await post('/fill', f).catch(e => ({ error: String(e?.name || e) })); had.set(key, { reply: r.error ? null : r, error: r.error, ms: performance.now() - t0 }); } return had.get(key); };
      for (const { way, req, full } of q.props) {
        if (!req) { rec.props.push({ way, ms: null, size: null, error: null, results: measure.notAsked({ truth: note.truth }, full, null) }); continue; }
        const { reply, ms, error } = await once(req.fill);
        rec.props.push({ way, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', results: [...measure.judge(ctx, { b, truth: note.truth }, req, reply, error), ...(full ? measure.notAsked({ truth: note.truth }, full, req) : [])] });
      }
      for (const { way, req, listed } of q.tags) {
        const { reply, ms, error } = await once(req.fill);
        rec.tags.push({ way, listed, ms, size: measure.size(req.fill), error: reply ? null : error || 'no answer', result: measure.judgeTag({ b }, req, reply, error), said: reply ? measure.tagSaid(req, reply) : null });
      }
      records.push(rec);
    }
    if (n % 100 === 0) process.stderr.write(`${n} of ${made.held.length} notes\n`);
  }
  // Plain notes: a tag pencilled on one is a wrong tag.
  for (const text of made.heldPlain) {
    const bare = { id: -(++n), uuid: '', text, tags: [], values: new Map(), page, parent: null }, rules = propose(ctx, bare);
    let by = rules.assume || rules.pieces.some(p => p.kind === 'tag') ? 'rules' : null;
    if (!by && meaning.wanted(ctx, bare, rules) && meaning.pieces(ctx, bare, rules, await nearOf(text, ctx.limits.meaningK || meaning.LIMITS.meaningK)).some(p => p.kind === 'tag')) by = 'meaning';
    if (!by && modelHere && !rules.pieces.length) { const req = model.tagRequest(ctx, bare); const reply = req && await fill(req); if (reply && model.tagOf(req, reply)) by = 'model'; }
    plain.of++; if (by) plain[by]++;
  }
  if (status.meaning) await post('/meaning', { graph: ctx.graph, learn: [], replace: true }).catch(() => {});

  const row = (label, cells) => String(label).padEnd(40) + cells.map(c => String(c).padStart(12)).join('');
  const rws = c => [c.right, c.wrong, c.silent, c.spoke];
  const filled = seen.sure.right + seen.sure.wrong + seen.guess.right + seen.guess.wrong + seen.silent;
  const shown = seen.sure.right + seen.sure.wrong + seen.guess.right + seen.guess.wrong, right = seen.sure.right + seen.guess.right;
  const order = ['link', 'name', 'part', 'other', 'absent', 'number', 'left empty'];
  const lines = [
    `Predictive on the made-up graph · ${ctx.index.entries.length} notes learned · ${made.held.length} held-out notes, ${made.heldPlain.length} plain · helper ${status.version}`,
    `Apple's matcher: ${status.meaning ? 'yes' : 'no'} · Apple's model: ${modelHere ? 'yes' : `no (${status.reason || 'not asked'})`}${Object.keys(limits).length ? ' · set: ' + JSON.stringify(limits) : ''}`,
    '', `WHAT YOU WOULD SEE: of ${filled} properties a careful person filled in`,
    row('', ['right', 'wrong']),
    row('written when you leave the bullet', [seen.sure.right, seen.sure.wrong]),
    row('pencilled, a guess', [seen.guess.right, seen.guess.wrong]),
    row('nothing shown', [seen.silent]),
    row('right of all filled', [`${pct(right, filled)} (${measure.range(right, filled)})`]),
    row('right of what was shown', [`${pct(right, shown)} (${measure.range(right, shown)})`]),
    row(`of ${seen.empty} left empty, filled anyway`, [`${seen.sure.spoke + seen.guess.spoke} (written ${seen.sure.spoke}, pencilled ${seen.guess.spoke})`]),
    '', 'BY WHO PROPOSED IT', row('', ['right', 'wrong', '', 'empty filled']),
    ...[...seen.bySource].sort().map(([name, c]) => row(name, rws(c).map((v, i) => i === 2 ? '' : v))),
    '', 'BY HOW THE NOTE CARRIES THE VALUE', row('', ['right', 'wrong', 'silent', 'empty filled']),
    ...order.filter(h => seen.byHow.has(h)).map(h => row(h, rws(seen.byHow.get(h)))),
    '', 'BY PROPERTY', row('', ['right', 'wrong', 'silent', 'empty filled']),
    ...[...seen.byProp].sort().map(([name, c]) => row(name, rws(c))),
    '', `THE TAG OF A NOTE (${tags.of} notes)`, row('', ['right', 'wrong']),
    row('the rules', [tags.rules.right, tags.rules.wrong]), row('by meaning', [tags.meaning.right, tags.meaning.wrong]), ...(modelHere ? [row('Apple\'s model', [tags.model.right, tags.model.wrong])] : []),
    row('no tag offered', [tags.silent]),
    '', `PLAIN NOTES THAT SHOULD GET NO TAG (${plain.of})`, row('tagged anyway', [`rules ${plain.rules}, by meaning ${plain.meaning}${modelHere ? `, model ${plain.model}` : ''}`]),
  ];
  if (records.length) lines.push('', '— The measure\'s own report on the same notes —', measure.text(measure.tally(records), { version: 'harness', helper: status.version, date: new Date().toISOString().slice(0, 10) }));
  const text = lines.join('\n');
  console.log(text);
  const out = arg('json', '');
  if (out) fs.writeFileSync(out, JSON.stringify({ seen: { ...seen, bySource: [...seen.bySource], byHow: [...seen.byHow], byProp: [...seen.byProp] }, tags, plain, limits }, null, 1));
})();
