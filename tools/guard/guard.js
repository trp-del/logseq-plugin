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
     node tools/guard/guard.js stop     Quits the guard's Logseq if a run was stopped halfway.

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

// One side (the plugin as it was, or as changed): each graph in a Logseq of its own, all at once, on ports 9340, 9341….
async function side(label, plugin, runDir, graphs, only) {
  const sandbox = require('./sandbox'), T = require('./tour');
  const shots = path.join(runDir, label); fs.mkdirSync(shots, { recursive: true });
  const one = async (graph, i) => {
    const box = await sandbox.start({ dir: path.join(runDir, 'box', label + '-' + graph.replace(/\W+/g, '-')), graph, plugin, port: sandbox.PORT + i });
    const caseResults = [], lines = [`${label}: ${graph}`];
    try {
      const records = await T.tour(box, shots, only);
      for (const c of cases().filter(c => c.graph === graph)) {
        let got;
        try { await T.reset(box); got = await c.check(box, T); } catch (e) { got = { ok: false, said: 'the case could not run: ' + String(e && e.message || e).slice(0, 160) }; }
        if (!got.ok) { got.picture = `case-${c.file.replace(/\.js$/, '')}.png`; await box.page.screenshot({ path: path.join(shots, got.picture), scale: 'css' }).catch(() => { delete got.picture; }); }
        caseResults.push({ file: c.file, name: c.name, from: c.from, ...got });
        lines.push(`  case ${got.ok ? 'passes' : 'FAILS'}: ${c.name}${got.ok ? '' : ' — ' + got.said}`);
      }
      console.log(lines.join('\n'));
      return { records, cases: caseResults };
    } finally { await sandbox.stop(box); }
  };
  const parts = await Promise.all(graphs.map(one));
  const out = { records: parts.flatMap(p => p.records), cases: parts.flatMap(p => p.cases) };
  fs.writeFileSync(path.join(runDir, label + '.json'), JSON.stringify(out, null, 1));
  return out;
}

/* The plugin as it was is photographed once per base commit and kept (the owner, 18 November 2026: eleven minutes a change is far
   too long). Kept under the base commit and the guard's own tour and cases, so a new tour or a new case takes new pictures. */
function baselineKey(base) {
  const commit = execFileSync('git', ['-C', REPO, 'rev-parse', base], { encoding: 'utf8' }).trim();
  const h = require('node:crypto').createHash('sha256');
  for (const f of ['tour.js', 'sandbox.js', ...fs.readdirSync(path.join(HERE, 'cases')).sort().map(f => 'cases/' + f)]) h.update(f + fs.readFileSync(path.join(HERE, f)));
  return { commit, key: commit.slice(0, 12) + '-' + h.digest('hex').slice(0, 12) };
}
async function baseline(base, graphs, only) {
  const { commit, key } = baselineKey(base);
  const dir = path.join(STORE, 'baseline', key);
  if (!only && fs.existsSync(path.join(dir, 'before.json'))) { console.log(`before: the pictures of ${commit.slice(0, 7)} taken earlier`); return { dir, ...JSON.parse(fs.readFileSync(path.join(dir, 'before.json'), 'utf8')) }; }
  const work = only ? path.join(STORE, 'runs', 'tmp-' + Date.now()) : dir + '.part';
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  const plugin = path.join(work, 'plugin-before'); fs.mkdirSync(plugin);
  execFileSync('sh', ['-c', `git -C "${REPO}" archive "${commit}" | tar -x -C "${plugin}"`]);
  const got = await side('before', plugin, work, graphs, only);
  fs.rmSync(path.join(work, 'box'), { recursive: true, force: true });
  if (!only) { fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(work, dir); return { dir, ...got }; }
  return { dir: work, ...got };
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
      <div class="pair"><figure><figcaption>Before</figcaption><img src="${img(path.join(r.beforeDir || runDir, 'before', s.file + '.png'))}"></figure>
      <figure><figcaption>After, differences in red</figcaption><img src="${img(path.join(runDir, 'after', s.file + (fs.existsSync(path.join(runDir, 'after', s.file + '.marked.png')) ? '.marked.png' : '.png')))}"></figure></div></section>`;
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
<h2>Your earlier complaints, checked again</h2><table><tr><th>Case</th><th>Before</th><th>After</th></tr>${caseRows}</table>
</body></html>`;
  fs.writeFileSync(path.join(runDir, 'page.html'), html);
  return { file: path.join(runDir, 'page.html'), v };
}

async function run() {
  const base = arg('--base', 'origin/main'), change = path.resolve(arg('--change', REPO));
  const graphs = (arg('--graphs', GRAPHS.join(','))).split(',').map(s => s.trim()).filter(Boolean);
  const only = arg('--only') ? arg('--only').split(',').map(s => s.trim()) : null;
  /* The screens the change means to alter, said before the guard looks (the owner, 18 November 2026: approving every release is
     tiresome, so the guard stands in for that yes). A difference on any other screen is the change reaching further than meant: it
     stops the release until it is fixed, and no reason passes it. */
  const expect = (arg('--expect', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  const known = require('./tour').SCREENS.map(s => s[0]);
  const unknown = expect.filter(e => !known.includes(e));
  if (unknown.length) { console.error(`no such screen: ${unknown.join(', ')}. The screens: ${known.join(' · ')}`); process.exit(2); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(STORE, 'runs', stamp); fs.mkdirSync(runDir, { recursive: true });
  // As changed: the folder's files, as release.sh would zip them. As it was: the base commit, photographed once and kept.
  const changePlugin = path.join(runDir, 'plugin-after'); fs.mkdirSync(changePlugin);
  execFileSync('rsync', ['-a', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', change + '/', changePlugin + '/']);
  const shipHash = ship.fromFolder(changePlugin);
  console.log(`guard run ${stamp}: before = ${base}, after = ${change} (ships as ${shipHash})`);
  const t0 = Date.now();
  const before = await baseline(base, graphs, only);
  const after = await side('after', changePlugin, runDir, graphs, only);
  fs.rmSync(path.join(runDir, 'box'), { recursive: true, force: true });
  console.log(`took ${Math.round((Date.now() - t0) / 1000)} s`);
  const screens = await require('./compare').compare(path.join(before.dir, 'before'), path.join(runDir, 'after'), before.records, after.records, path.join(runDir, 'after'));
  const casesOut = after.cases.map(c => ({ name: c.name, from: c.from, before: before.cases.find(b => b.file === c.file) || null, after: c }));
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify({ base, beforeDir: before.dir, change, ship: shipHash, expect, screens, cases: casesOut, partial: !!only || graphs.length < GRAPHS.length }, null, 1));
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
  else if (cmd === 'why') why();
  else if (cmd === 'page') report(path.resolve(process.argv[3]));
  else if (cmd === 'verify') verify();
  else if (cmd === 'baseline') { const b = await baseline(arg('--base', 'origin/main'), GRAPHS, null); console.log('kept in ' + b.dir); }
  else if (cmd === 'screens') console.log(require('./tour').SCREENS.map(s => s[0]).join('\n'));
  else if (cmd === 'stop') console.log(await require('./sandbox').stopAny());
  else console.log('run | why | page | verify | stop   (see the top of tools/guard/guard.js)');
})().catch(async e => { console.error(String(e && e.stack || e).slice(0, 1500)); try { await require('./sandbox').stopAny(); } catch (x) { /* nothing ran */ } process.exit(2); });
