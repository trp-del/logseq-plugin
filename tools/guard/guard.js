#!/usr/bin/env node
/* The guard (18 November 2026). Fixes here kept bringing new faults: a change reached further than meant (the table bar's style
   also dressed Logseq's Linked references), only the changed screen was looked at again, a fix was called done before the owner's
   own case was seen to pass, and what was tested was not what shipped. The guard answers each:

     node tools/guard/guard.js run --expect "screen,…" [--base <git ref>] [--change <folder>] [--graphs "A,B"] [--only "screen,…"]
         Starts the guard's own Logseq (port 9340, copies of the test graphs; the owner's Logseq is never touched), loads the
         plugin as it was (--base, default origin/main) and goes round every screen of the tour and every case, then the same on
         the plugin as changed (--change, default this folder's files). Compares them screen by screen and writes a page with
         each difference marked in red, before and after side by side. Prints where the page is and what still needs a reason.
         --expect names, before the run, the screens the change means to alter (node tools/guard/guard.js screens lists them).
         A difference anywhere else stops the release and cannot be given a reason.
     node tools/guard/guard.js why <run> "<screen>" "<the reason, in the owner's terms>"
         Gives the reason a difference is meant. Every difference must have one; a case that passed before and fails after
         cannot be given one: it is a fault to fix.
     node tools/guard/guard.js verify [--index <repo>] [--folder <folder>] [--ref <repo> <ref>]
         Says whether the guard passed on exactly what ships from there (tools/release.sh and the Claude hook ask this).
     node tools/guard/guard.js baseline [--base <git ref>]
         Takes the pictures of the plugin as released ahead of time (a run does it the first time it needs them, and keeps them).
     node tools/guard/guard.js stop     Quits the guard's Logseq if a run was stopped halfway, and ends the graph workers it left.

   Runs and passes are kept in ~/.logseq-guard (outside every copy of the plugin, so a clean clone sees them too). */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '../..');
const STORE = process.env.GUARD_STORE || path.join(os.homedir(), '.logseq-guard');
const PASSES = path.join(STORE, 'passes.jsonl');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const ship = require('./ship');

const GRAPHS = ['Illness Test Graph', 'Personal Finance'];
const cases = () => fs.readdirSync(path.join(HERE, 'cases')).filter(f => f.endsWith('.js')).sort().map(f => ({ file: f, ...require(path.join(HERE, 'cases', f)) }));

/* How many Logseqs a side may use at once (24 November 2026). The check had grown to 27 screens and 60 cases gone round one after
   another in two Logseqs, eight minutes a side and half an hour when a side had to be taken twice. The work is waiting, not
   computing (a Logseq sits near idle while a case waits for a list to draw), so the cure is more Logseqs side by side, each
   with its share. Four on a Mac with 8 GB, six from 16 GB; GUARD_SHARDS sets it by hand. Six were tried on the 8 GB Mac the same
   day: no faster (250 s against 250 s), and cases that pass alone failed from the load (words typed after Enter in Find, a tap
   of Hyper, a table's columns), so each needed a second look. More Logseqs than the Mac carries make the check slower, not faster. */
const SHARDS = Math.max(GRAPHS.length, Number(process.env.GUARD_SHARDS) || (os.totalmem() >= 15 * 2 ** 30 ? 6 : 4));
const TIMES = path.join(STORE, 'times.json');
const times = () => { try { return JSON.parse(fs.readFileSync(TIMES, 'utf8')); } catch (e) { return {}; } };
const keep = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.part', JSON.stringify(data, null, 1)); fs.renameSync(file + '.part', file); };
// The share of each Logseq: the longest pieces first, each to the Logseq with the least so far (times as last measured here).
function shares(graphs, screenNames, caseList, extras = []) {
  const known = times(), cost = (k, dflt) => Math.max(1, Number(known[k]) || dflt);
  /* A graph's screens stay together, in the tour's order, in that graph's first Logseq: a screen can carry something of the one
     before it (a table row left ticked by "row view, a row pressed" showed in its dark twin, 24 November 2026), so the plugin as
     it was and as changed must walk them in the same order. Only the cases, which each start from a clean state and are judged by
     what they find, not by a picture, are shared out. */
  const tour = g => screenNames.filter(n => require('./tour').SCREENS.some(x => x[0] === n && x[1] === g));
  const items = g => caseList.filter(c => c.graph === g).map(c => ({ case: c, secs: cost('case ' + c.file, 10) }));
  const tourSecs = g => tour(g).reduce((n, name) => n + cost('screen ' + name, 6), 0);
  const work = graphs.map(g => ({ graph: g, items: items(g), screens: tour(g) })).filter(w => w.items.length || w.screens.length);
  const total = w => w.items.reduce((n, i) => n + i.secs, 0) + tourSecs(w.graph);
  // A Logseq for each graph that has work, then one more at a time to the graph whose Logseqs carry the most; none for under 40 s of work.
  const n = new Map(work.map(w => [w.graph, 1]));
  for (let spare = SHARDS - work.length; spare > 0; spare--) {
    const most = work.filter(w => total(w) / n.get(w.graph) > 40 && n.get(w.graph) < w.items.length + (w.screens.length ? 1 : 0)).sort((x, y) => total(y) / n.get(y.graph) - total(x) / n.get(x.graph))[0];
    if (!most) break; n.set(most.graph, n.get(most.graph) + 1);
  }
  const out = [];
  for (const w of work) {
    // A Logseq's port follows its graph and its place among that graph's Logseqs, whatever the plan: a kept Logseq is found again on it.
    const boxes = Array.from({ length: n.get(w.graph) }, (_, i) => ({ graph: w.graph, index: i, port: require('./sandbox').PORT + GRAPHS.indexOf(w.graph) + GRAPHS.length * i, screens: [], cases: [], secs: 0 }));
    // The checks that need the running app (check.js asks for them) go to the first Logseq of the first test graph, counted in its share.
    if (w.graph === GRAPHS[0] && extras.length) { boxes[0].extras = extras; boxes[0].secs += extras.reduce((n, x) => n + cost('in-app ' + x.name, x.secs), 0); }
    boxes[0].screens = w.screens; boxes[0].secs += tourSecs(w.graph);
    for (const it of [...w.items].sort((x, y) => y.secs - x.secs)) { const least = boxes.reduce((m, x) => x.secs < m.secs ? x : m); least.cases.push(it.case); least.secs += it.secs; }
    out.push(...boxes);
  }
  return out;
}

// One side (the plugin as it was, or as changed): the screens and cases asked for, shared out among Logseqs that run at once.
async function side(label, plugin, runDir, graphs, only, parts, pickCases, extras) {
  const sandbox = require('./sandbox'), T = require('./tour');
  const shots = path.join(runDir, label); fs.mkdirSync(shots, { recursive: true });
  const wantScreens = T.SCREENS.map(x => x[0]).filter(n => !only || only.includes(n));
  const wantCases = cases().filter(c => graphs.includes(c.graph) && (!parts || parts.includes('shared') || (c.parts || []).some(p => parts.includes(p)))).filter(c => !pickCases || pickCases(c));
  const took = {};
  const one = async sh => {
    const began = Date.now();
    // Kept running between checks (sandbox.warm); GUARD_COLD=1 starts and ends a fresh one each time.
    const box = process.env.GUARD_COLD ? await sandbox.start({ dir: path.join(runDir, 'box', label + '-' + sh.graph.replace(/\W+/g, '-') + '-' + sh.index), graph: sh.graph, plugin, port: sh.port }) : await sandbox.warm({ store: STORE, graph: sh.graph, plugin, port: sh.port, index: sh.index });
    const caseResults = [], lines = [`${label}: ${sh.graph}${sh.index ? ', Logseq ' + (sh.index + 1) : ''}`];
    // A Logseq started this moment has no debugging session yet (the tour opens one; a share of cases alone never reached it).
    box.cdp = box.cdp || await box.page.context().newCDPSession(box.page);
    const ready = Date.now();
    try {
      const records = sh.screens.length ? await T.tour(box, shots, sh.screens, took) : [];
      for (const c of sh.cases) {
        let got; const c0 = Date.now(); let tried = 0;
        // A case fails only when it fails twice: one slow frame in a busy Logseq must not stop a release.
        for (let tries = 0; tries < 2 && !(got && got.ok); tries++) {
          tried++;
          try { await T.reset(box); got = await c.check(box, T); } catch (e) { got = { ok: false, said: 'the case could not run: ' + String(e && e.message || e).slice(0, 160) }; }
        }
        took['case ' + c.file] = Math.round((Date.now() - c0) / 100) / 10;   // both tries, when it took two: that is what its Logseq spends on it
        if (process.env.GUARD_TIME) console.log(`    ${((Date.now() - c0) / 1000).toFixed(1)} s${tried > 1 ? ' (tried twice)' : ''}  ${c.file}`);
        if (!got.ok) { got.picture = `case-${c.file.replace(/\.js$/, '')}.png`; await box.page.screenshot({ path: path.join(shots, got.picture), scale: 'css' }).catch(() => { delete got.picture; }); }
        caseResults.push({ file: c.file, name: c.name, from: c.from, ...got });
        lines.push(`  case ${got.ok ? 'passes' : 'FAILS'}: ${c.name}${got.ok ? '' : ' — ' + got.said}`);
      }
      lines[0] += ` (${Math.round((ready - began) / 1000)} s to be ready, ${Math.round((Date.now() - ready) / 1000)} s for its share)`;
      console.log(lines.join('\n'));
      /* The checks that need the real app with the plugin as changed (every kind of write read back, what the plugin relies on in
         Logseq) run here, in this Logseq, while the others go on with their share; until 24 November 2026 they ran after the
         whole tour, three quarters of a minute with every other Logseq idle. One line each, for check.js to read. */
      for (const x of sh.extras || []) {
        await T.reset(box).catch(() => {});
        const x0 = Date.now(), r = require('node:child_process').spawnSync(process.execPath, x.cmd, { cwd: plugin, env: { ...process.env, LOGSEQ_PORT: String(sh.port), NODE_PATH: process.env.NODE_PATH || path.join(REPO, 'node_modules') }, encoding: 'utf8', timeout: 180000 });
        took['in-app ' + x.name] = Math.round((Date.now() - x0) / 100) / 10;
        console.log('IN-APP ' + JSON.stringify({ name: x.name, ok: r.status === 0, secs: took['in-app ' + x.name], out: String((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).join('\n') }));
      }
      return { records, cases: caseResults };
    } finally { if (box.warm) await sandbox.leave(box); else await sandbox.stop(box); }
  };
  const plan = shares(graphs, wantScreens, wantCases, extras);
  if (plan.length > 1) console.log(`${label}: ${plan.length} Logseqs at once (${plan.map(p => `${p.graph.split(' ')[0]} ${p.screens.length}+${p.cases.length}, about ${Math.round(p.secs)} s`).join('; ')})`);
  const sides = await Promise.all(plan.map(one));
  try { keep(TIMES, { ...times(), ...took }); } catch (e) { /* the times are only a help */ }
  // In the tour's own order and the cases' own order, however they were shared out.
  const order = T.SCREENS.map(x => x[0]), files = cases().map(c => c.file);
  const out = { records: sides.flatMap(p => p.records).sort((x, y) => order.indexOf(x.name) - order.indexOf(y.name)), cases: sides.flatMap(p => p.cases).sort((x, y) => files.indexOf(x.file) - files.indexOf(y.file)) };
  fs.writeFileSync(path.join(runDir, label + '.json'), JSON.stringify(out, null, 1));
  return out;
}

/* The plugin as it was is photographed once per base commit and kept (the owner, 18 November 2026: eleven minutes a change is far
   too long). Kept in two parts (24 November 2026): the screens under the commit, the tour and the test graphs; each case under
   those and its own file. Until then one key covered the tour and every case together, so each fix, which adds a case, threw the
   whole kept side away and the release check took it again: every screen and every case, twice over. Now a new case is run alone
   on the plugin as it was, and the screens are walked again only for a new commit, a new tour or a new copy of a test graph. */
function baselineKey(base) {
  /* origin/main means GitHub's main as it is now: fetched first. On 19 November a run compared a change with 0.3.162, because the
     checkout the guard ran from had not fetched for a day, and showed eleven screens "changed" that the change never touched. */
  if (/^origin\//.test(base)) try { execFileSync('git', ['-C', REPO, 'fetch', '-q', 'origin', base.slice(7)], { stdio: 'ignore', timeout: 30000 }); } catch (e) { console.log(`could not fetch ${base} from GitHub: comparing with the copy this Mac last fetched`); }
  const commit = execFileSync('git', ['-C', REPO, 'rev-parse', base], { encoding: 'utf8' }).trim();
  const sha = () => require('node:crypto').createHash('sha256');
  const h = sha();
  for (const f of ['tour.js', 'reads.js', 'sandbox.js']) h.update(f + fs.readFileSync(path.join(HERE, f)));
  /* And under the test graphs' copies themselves: a graph that changed since the pictures were taken (19 November: today's test
     graphs had new notes) made every run fail on five screens no change had touched. A new copy of a graph takes new pictures. */
  // By content, not by file name or time: Logseq writes a new backup every hour while a graph is open, most of them the same notes.
  for (const g of GRAPHS) { try { h.update(g + sha().update(fs.readFileSync(require('./sandbox').graphFile(g))).digest('hex')); } catch (e) { h.update(g + 'missing'); } }
  const ground = h.digest('hex');
  return { commit, key: commit.slice(0, 12) + '-' + ground.slice(0, 12), caseKey: file => sha().update(ground + fs.readFileSync(path.join(HERE, 'cases', file))).digest('hex').slice(0, 16) };
}
async function baseline(base, graphs, only, parts) {
  const { commit, key, caseKey } = baselineKey(base);
  const dir = path.join(STORE, 'kept', key), shots = path.join(dir, 'before');
  const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return {}; } };
  const T = require('./tour');
  const wantScreens = T.SCREENS.filter(x => graphs.includes(x[1]) && (!only || only.includes(x[0]))).map(x => x[0]);
  const wantCases = cases().filter(c => graphs.includes(c.graph) && (!parts || parts.includes('shared') || (c.parts || []).some(p => parts.includes(p))));
  let screens = read('screens.json'), kept = read('cases.json');
  const has = c => kept[c.file] && kept[c.file].key === caseKey(c.file);
  /* A graph's screens are kept only from a walk of its whole tour, in the tour's order (see shares()). A part of the tour is compared
     with the kept walk when there is one; when there is none it is photographed for this run alone and not kept. */
  const whole = g => T.SCREENS.filter(x => x[1] === g).map(x => x[0]);
  const keptWhole = g => whole(g).every(n => screens[n] && fs.existsSync(path.join(shots, screens[n].file + '.png')));
  const needScreens = graphs.flatMap(g => keptWhole(g) ? [] : only ? whole(g).filter(n => only.includes(n)) : whole(g));
  const needCases = wantCases.filter(c => !has(c));
  const plugin = path.join(dir, 'plugin-before');
  if (!fs.existsSync(path.join(plugin, 'package.json'))) { fs.rmSync(plugin, { recursive: true, force: true }); fs.mkdirSync(plugin, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive "${commit}" | tar -x -C "${plugin}"`]); }
  if (!needScreens.length && !needCases.length) console.log(`before: ${base} is ${commit.slice(0, 7)}; its pictures and cases were taken earlier`);
  else {
    console.log(`before: ${base} is ${commit.slice(0, 7)}; taking ${needScreens.length} screen(s) and ${needCases.length} case(s) not kept yet`);
    const work = path.join(dir, 'taking-' + process.pid);
    const got = await side('before', plugin, work, graphs, needScreens, parts, c => needCases.some(n => n.file === c.file));
    fs.mkdirSync(shots, { recursive: true });
    // Read again before writing: another check may have kept its own pieces meanwhile.
    screens = read('screens.json'); kept = read('cases.json');
    for (const c of got.cases) kept[c.file] = { key: caseKey(c.file), result: c };
    keep(path.join(dir, 'cases.json'), kept);
    if (needScreens.length && !only && got.records.every(r => !r.failed)) {
      for (const f of fs.readdirSync(path.join(work, 'before'))) fs.renameSync(path.join(work, 'before', f), path.join(shots, f));
      for (const r of got.records) screens[r.name] = r;
      keep(path.join(dir, 'screens.json'), screens);
      fs.rmSync(work, { recursive: true, force: true });
    } else if (needScreens.length) {
      // A part of the tour, or a walk in which a screen's set-up failed: used for this run, from this run's own folder, not kept.
      if (!only) for (const r of got.records.filter(r => r.failed)) console.log(`  not kept, a screen's set-up failed: ${r.name}`);
      return { dir, shots: path.join(work, 'before'), records: wantScreens.map(n => got.records.find(r => r.name === n) || screens[n]).filter(Boolean), cases: wantCases.filter(c => kept[c.file]).map(c => kept[c.file].result) };
    } else fs.rmSync(work, { recursive: true, force: true });
  }
  return { dir, shots, records: wantScreens.map(n => screens[n]).filter(Boolean), cases: wantCases.filter(c => kept[c.file]).map(c => kept[c.file].result) };
}

// What still stops a commit: a difference with no reason, a case broken by the change.
function verdict(runDir) {
  const r = JSON.parse(fs.readFileSync(path.join(runDir, 'result.json'), 'utf8'));
  const reasons = fs.existsSync(path.join(runDir, 'reasons.json')) ? JSON.parse(fs.readFileSync(path.join(runDir, 'reasons.json'), 'utf8')) : {};
  const open = [];
  const meant = r.expect || [];
  for (const s of r.screens) if (s.notes.some(n => n.kind !== 'info') && !meant.includes(s.name)) open.push(`“${s.name}” changed, and the change was not meant to touch it: ${s.notes.filter(n => n.kind !== 'info').map(n => n.said).join('; ')}. Fix what reached it; a reason cannot pass it`);
  for (const s of r.screens) if (s.notes.some(n => n.kind !== 'info') && meant.includes(s.name) && !reasons[s.name]) open.push(`“${s.name}”: ${s.notes.filter(n => n.kind !== 'info').map(n => n.said).join('; ')}`);
  for (const c of r.cases) if (c.before && c.before.ok && !c.after.ok) open.push(`case “${c.name}” passed before and fails now (${c.after.said}): fix the plugin, a reason cannot pass it`);
  for (const f of (r.reads && r.reads.news) || []) open.push(`“${f.screen}” reads worse than before: ${f.said}. Fix the plugin; a reason cannot pass it`);
  for (const c of r.cases) if (!c.before && !c.after.ok) open.push(`new case “${c.name}” fails after the change (${c.after.said})`);
  return { r, reasons, open };
}

function record(runDir, v) {
  if (v.open.length) return false;
  fs.mkdirSync(STORE, { recursive: true });
  fs.appendFileSync(PASSES, JSON.stringify({ ship: v.r.ship, at: new Date().toISOString(), run: runDir, base: v.r.base, differences: v.r.screens.filter(s => s.notes.some(n => n.kind !== 'info')).length }) + '\n');
  return true;
}

function page(runDir) {
  const v = verdict(runDir), { r, reasons } = v;
  const img = f => fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const changed = r.screens.filter(s => s.notes.some(n => n.kind !== 'info'));
  const same = r.screens.filter(s => !s.notes.some(n => n.kind !== 'info'));
  let n = 0;
  const blocks = changed.map(s => {
    n++;
    const why = reasons[s.name];
    const what = s.notes.filter(x => x.kind !== 'info').map(x => `<li>${esc(x.said)}${x.what && x.what.length ? `<ul>${x.what.map(w => `<li class="q">${esc(w)}</li>`).join('')}</ul>` : ''}</li>`).join('');
    return `<section><h2>${n}. ${esc(s.name[0].toUpperCase() + s.name.slice(1))}</h2>
      <p class="${why && (r.expect || []).includes(s.name) ? 'why' : 'nowhy'}">${!(r.expect || []).includes(s.name) ? 'Not meant to change: this difference stops the release.' : why ? 'Meant: ' + esc(why) : 'No reason given yet: this difference stops the release.'}</p>
      <ul class="what">${what}</ul>
      <div class="pair"><figure><figcaption>Before</figcaption><img src="${img(s.beforeDir ? path.join(runDir, s.beforeDir, s.file + '.png') : path.join(r.beforeDir || runDir, 'before', s.file + '.png'))}"></figure>
      <figure><figcaption>After, differences in red</figcaption><img src="${img(path.join(runDir, s.dir || 'after', s.file + (fs.existsSync(path.join(runDir, s.dir || 'after', s.file + '.marked.png')) ? '.marked.png' : '.png')))}"></figure></div></section>`;
  }).join('\n');
  const caseRows = r.cases.map(c => `<tr><td>${esc(c.name)}<div class="q">${esc(c.from || '')}</div></td><td>${c.before ? (c.before.ok ? 'passes' : 'fails') : 'new'}</td><td class="${c.after.ok ? '' : 'bad'}">${c.after.ok ? 'passes' : 'fails: ' + esc(c.after.said)}${!c.after.ok && c.after.picture ? `<img src="${img(path.join(runDir, 'after', c.after.picture))}">` : ''}</td></tr>`).join('');
  const head = v.open.length ? `<p class="nowhy"><b>Not passed.</b> ${v.open.length} thing${v.open.length > 1 ? 's' : ''} still stop${v.open.length > 1 ? '' : 's'} the commit.</p>` : `<p class="why"><b>Passed.</b> Every difference has a reason and every case passes.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guard: before and after</title>
<style>
:root{--paper:#fbfaf8;--text:#433f38;--muted:#8a8478;--line:#e6e2da;--bad:#c0392b;--good:#2e7d4f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#1f1e1c;--text:#e8e4dc;--muted:#a39d91;--line:#3a3833;--bad:#ef6b5b;--good:#6fcf97}}
:root[data-theme="dark"]{--paper:#1f1e1c;--text:#e8e4dc;--muted:#a39d91;--line:#3a3833;--bad:#ef6b5b;--good:#6fcf97}
body{background:var(--paper);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;margin:0 auto;max-width:1500px;padding:24px 16px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:40px 0 4px}.sub{color:var(--muted);margin:0 0 16px}
.why{color:var(--good)}.nowhy,.bad{color:var(--bad)}.q{color:var(--muted);font-size:14px}
ul.what{margin:4px 0 12px;padding-left:20px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:800px){.pair{grid-template-columns:1fr}}
figure{margin:0}figcaption{font-size:13px;color:var(--muted);margin-bottom:4px}img{width:100%;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
</style></head><body>
<h1>Before and after the change</h1>
<p class="sub">The plugin as it was (${esc(r.base)}) and as changed, on ${r.screens.length} screens of the test graphs, in a private copy of Logseq. Meant to change, as said before the run: ${(r.expect || []).length ? (r.expect || []).map(esc).join(', ') : 'no screen'}.</p>
${head}
${v.open.length ? `<ul class="nowhy">${v.open.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${blocks || '<p>No screen looks different.</p>'}
<h2>Screens that look the same</h2><p class="q">${same.map(s => esc(s.name)).join(' · ') || 'none'}</p>
<h2>How the screens read</h2>
${(r.reads && r.reads.news.length) ? `<ul class="nowhy">${r.reads.news.map(f => `<li>${esc(f.screen)}: ${esc(f.said)}</li>`).join('')}</ul>` : '<p class="why">The change brought nothing that is cut off, too faint, out of line, empty, over other words, or unlike Logseq.</p>'}
${(r.reads && r.reads.known.length) ? `<details><summary class="q">${r.reads.known.length} known from before the change, still to fix</summary><ul class="q">${r.reads.known.map(f => `<li>${esc(f.screen)}: ${esc(f.said)}</li>`).join('')}</ul></details>` : ''}
<h2>Your earlier complaints, checked again</h2><table><tr><th>Case</th><th>Before</th><th>After</th></tr>${caseRows}</table>
</body></html>`;
  fs.writeFileSync(path.join(runDir, 'page.html'), html);
  return { file: path.join(runDir, 'page.html'), v };
}

async function run() {
  const base = arg('--base', 'origin/main'), change = path.resolve(arg('--change', REPO));
  const graphs = (arg('--graphs', GRAPHS.join(','))).split(',').map(s => s.trim()).filter(Boolean);
  const parts = arg('--parts') ? arg('--parts').split(',').map(s => s.trim()) : null;
  let only = arg('--only') ? arg('--only') : null;
  /* The screens the change means to alter, said before the guard looks (the owner, 18 November 2026: approving every release is
     tiresome, so the guard stands in for that yes). A difference on any other screen is the change reaching further than meant: it
     stops the release until it is fixed, and no reason passes it. */
  const known = require('./tour').SCREENS.map(s => s[0]);
  /* Screen names hold commas themselves ("person, dark"): the pieces between commas are joined back, the longest run that makes a
     screen's name first (18 November 2026: "row view, a row pressed, dark" could not be named before). */
  const named = list => { const pieces = (list || '').split(',').map(s => s.trim()).filter(Boolean), out = []; for (let i = 0; i < pieces.length;) { let j = pieces.length; while (j > i + 1 && !known.includes(pieces.slice(i, j).join(', '))) j--; out.push(pieces.slice(i, j).join(', ')); i = j; } return out; };
  const expect = named(arg('--expect', ''));
  if (only) only = named(only);
  const unknown = [...expect, ...(only || [])].filter(e => !known.includes(e));
  if (unknown.length) { console.error(`no such screen: ${unknown.join(', ')}. The screens: ${known.join(' · ')}`); process.exit(2); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(STORE, 'runs', stamp); fs.mkdirSync(runDir, { recursive: true });
  // As changed: the folder's files, as release.sh would zip them. As it was: the base commit, photographed once and kept.
  const changePlugin = path.join(runDir, 'plugin-after'); fs.mkdirSync(changePlugin);
  execFileSync('rsync', ['-a', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', change + '/', changePlugin + '/']);
  const shipHash = ship.fromFolder(changePlugin);
  console.log(`guard run ${stamp}: before = ${base}, after = ${change} (ships as ${shipHash})`);
  const t0 = Date.now();
  // Only the test graphs the screens asked for are opened.
  const needed = only ? graphs.filter(g => require('./tour').SCREENS.some(x => x[1] === g && only.includes(x[0]))) : graphs;
  const before = await baseline(base, needed, only, parts);
  // --in-app "write,contract": the checks that need the running app, run in one of the after side's Logseqs (see side()).
  const INAPP = { write: { name: 'write', secs: 15, cmd: ['tools/write-check.js'] }, contract: { name: 'contract', secs: 32, cmd: ['tools/logseq-contract-app.js'] } };
  const extras = needed.includes(GRAPHS[0]) ? (arg('--in-app', '')).split(',').map(k => INAPP[k.trim()]).filter(Boolean) : [];
  const after = await side('after', changePlugin, runDir, needed, only, parts, null, extras);
  fs.rmSync(path.join(runDir, 'box'), { recursive: true, force: true });
  console.log(`took ${Math.round((Date.now() - t0) / 1000)} s`);
  const C = require('./compare');
  let screens = await C.compare(before.shots, path.join(runDir, 'after'), before.records, after.records, path.join(runDir, 'after'));
  let casesOut = after.cases.map(c => ({ name: c.name, from: c.from, before: before.cases.find(b => b.file === c.file) || null, after: c }));
  /* A second look (19 November 2026: an unchanged plugin failed on screens where a card or a shade happened to be caught in one
     picture). Each screen that differs, and each case broken now, is taken again on both sides, the plugin as it was and as
     changed, in fresh Logseqs; only what differs both times counts. */
  const differs = s => s.notes.some(n => n.kind !== 'info');
  const SC = require('./tour').SCREENS;
  let b2 = null, a2 = null;
  /* Not for a screen named in --expect (20 November 2026, the owner: "I never okayed hour long checks"; a release that changed a screen
     on purpose took five to eight minutes): its difference is the change itself and needs its reason either way, so starting two
     more Logseqs to see it differ again only costs time. A screen nobody named still gets its second look. */
  const again = screens.filter(differs).filter(s => !expect.includes(s.name)).map(s => s.name);
  const brokeCases = casesOut.filter(c => c.before && c.before.ok && !c.after.ok);
  if (again.length || brokeCases.length) {
    const gs = [...new Set([...again.map(n => SC.find(x => x[0] === n)[1]), ...brokeCases.map(c => cases().find(x => x.name === c.name)?.graph).filter(Boolean)])];
    console.log(`a second look at ${again.length} screen(s) and ${brokeCases.length} case(s), on both sides`);
    const onlyAgain = again.length ? again : ['(none)'];
    // Only what differed is taken again: the screens named, and the cases broken now (not every case of their graph).
    const broke = c => brokeCases.some(x => x.name === c.name);
    b2 = await side('before-again', path.join(before.dir, 'plugin-before'), runDir, gs, onlyAgain, parts, broke);
    a2 = await side('after-again', changePlugin, runDir, gs, onlyAgain, parts, broke);
    fs.rmSync(path.join(runDir, 'box'), { recursive: true, force: true });
    const second = await C.compare(path.join(runDir, 'before-again'), path.join(runDir, 'after-again'), b2.records, a2.records, path.join(runDir, 'after-again'));
    screens = screens.map(s => {
      if (!differs(s)) return s;
      const t = second.find(x => x.name === s.name);
      if (t && !differs(t)) return { name: s.name, graph: s.graph, file: s.file, notes: [{ kind: 'info', said: 'differed in one picture, the same on a second look' }] };
      return t && differs(t) ? { ...t, dir: 'after-again', beforeDir: 'before-again' } : s;
    });
    casesOut = casesOut.map(c => {
      if (!(c.before && c.before.ok && !c.after.ok)) return c;
      const bb = b2.cases.find(x => x.name === c.name), aa = a2.cases.find(x => x.name === c.name);
      return bb && aa && (aa.ok || !bb.ok) ? { ...c, before: bb, after: aa, again: true } : c;
    });
  }
  /* How each screen reads (reads.js): what the change brought stops it, what was there before is listed as known. A screen taken a
     second time is judged by that second look, on both sides. */
  const R = require('./reads');
  const pick = (first, second) => first.map(r => (second && second.records.find(x => x.name === r.name)) || r);
  const reads = R.brought(pick(before.records, b2), pick(after.records, a2));
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify({ base, beforeDir: path.dirname(before.shots), change, ship: shipHash, expect, screens, cases: casesOut, reads, partial: !!only || !!parts || graphs.length < GRAPHS.length }, null, 1));
  report(runDir);
}

function report(runDir) {
  const { file, v } = page(runDir);
  const passed = !v.r.partial && record(runDir, v);
  console.log(`\nThe page: ${file}`);
  if (v.r.partial) console.log('A part of the tour only: it can show differences, it cannot pass a change.');
  if (v.open.length) { console.log(`NOT PASSED — ${v.open.length} still open:`); for (const o of v.open) console.log('  - ' + o); console.log(`Give a reason: node tools/guard/guard.js why ${runDir} "<screen>" "<reason>"`); process.exitCode = 1; }
  else if (passed) console.log(`PASSED: what ships as ${v.r.ship} may be committed and released.`);
}

function why() {
  const [runDir, screen, reason] = process.argv.slice(3);
  if (!runDir || !screen || !reason) { console.error('why <run> "<screen>" "<reason>"'); process.exit(2); }
  const r = JSON.parse(fs.readFileSync(path.join(runDir, 'result.json'), 'utf8'));
  if (!(r.expect || []).includes(screen)) { console.error(`“${screen}” was not named in --expect before the run: a difference there is the change reaching too far. Fix it, or run again with the screen named if the change is really meant to alter it.`); process.exit(2); }
  if (!r.screens.some(s => s.name === screen)) { console.error(`no screen “${screen}” in that run; its screens: ${r.screens.map(s => s.name).join(', ')}`); process.exit(2); }
  if (reason.trim().split(/\s+/).length < 4) { console.error('a reason says what changed and why it is meant, in a sentence'); process.exit(2); }
  const file = path.join(runDir, 'reasons.json');
  const reasons = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  reasons[screen] = reason.trim(); fs.writeFileSync(file, JSON.stringify(reasons, null, 1));
  report(runDir);
}

function passedFor(hash) {
  if (!fs.existsSync(PASSES)) return null;
  return fs.readFileSync(PASSES, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).reverse().find(p => p.ship === hash) || null;
}

function verify() {
  let hash, where;
  if (arg('--index')) { const repo = path.resolve(arg('--index')); hash = ship.fromGit(repo, ''); where = 'the files staged in ' + repo;
    // A commit that changes nothing that ships (a test, a README, a tool) needs no pass.
    let head = null; try { head = ship.fromGit(repo, 'HEAD'); } catch (e) { /* no commit yet */ }
    if (head === hash) { console.log('nothing that ships changes in this commit'); return; }
  } else if (arg('--ref')) { const i = process.argv.indexOf('--ref'); const repo = path.resolve(process.argv[i + 1]), ref = process.argv[i + 2]; hash = ship.fromGit(repo, ref); where = ref + ' in ' + repo; }
  else { const dir = path.resolve(arg('--folder', REPO)); hash = ship.fromFolder(dir); where = 'the files in ' + dir; }
  const p = passedFor(hash);
  if (p) { console.log(`the guard passed on ${where} (${hash}) at ${p.at}`); return; }
  console.log(`THE GUARD HAS NOT PASSED on ${where} (${hash}).\nRun it on exactly these files: node tools/guard/guard.js run --change <the folder that holds them>, give a reason for every difference, fix what a case finds, then try again.`);
  process.exit(1);
}

const cmd = process.argv[2];
(async () => {
  if (cmd === 'run') await run();
  // The guard's Logseq on the Illness Test Graph, running with this folder's plugin, for a check that needs the real app (the write check).
  else if (cmd === 'warm') { const sandbox = require('./sandbox'); const box = await sandbox.warm({ store: STORE, graph: GRAPHS[0], plugin: path.resolve(arg('--change', REPO)), port: sandbox.PORT }); await sandbox.leave(box); console.log('the guard’s Logseq is running on ' + sandbox.PORT); }
  else if (cmd === 'why') why();
  else if (cmd === 'page') report(path.resolve(process.argv[3]));
  else if (cmd === 'verify') verify();
  else if (cmd === 'baseline') { const t0 = Date.now(); const b = await baseline(arg('--base', 'origin/main'), GRAPHS, null); console.log(`kept in ${b.dir} (${Math.round((Date.now() - t0) / 1000)} s)`); }
  else if (cmd === 'screens') console.log(require('./tour').SCREENS.map(s => s[0]).join('\n'));
  else if (cmd === 'stop') console.log(await require('./sandbox').stopAny(STORE));
  else console.log('run | why | page | verify | stop   (see the top of tools/guard/guard.js)');
})().catch(async e => { console.error(String(e && e.stack || e).slice(0, 1500)); try { await require('./sandbox').stopAny(); } catch (x) { /* nothing ran */ } process.exit(2); });
