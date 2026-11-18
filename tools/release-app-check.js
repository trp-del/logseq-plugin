#!/usr/bin/env node
/* The release gate in the real Logseq (18 November 2026): node tools/release-app-check.js [--full] [--keep] [--only a,b]
   tools/release.sh runs it after test/all.sh and builds no zip unless it passes. Until then the checks that drive the real app never
   gated a release, and stale ones went on saying OK (view-change-check pressed tabs that had gone, 10 of its 27 changes did nothing).

   What it does:
   1. Starts a Logseq of its own (tools/audit/fresh.js): its own home folder and profile in a new folder under the system's temporary
      folder, its own debugging port (LOGSEQ_PORT, default 9555; never the owner's Logseq or its graphs), a throwaway copy of the
      Illness Test Graph from TEST_GRAPHS_ROOT (default ~/logseq-test-graphs, made by tools/audit/make-graphs.sh), and a copy of this
      folder's plugin, with Apple's tools switched off in its settings. Anything a check would copy, save or print stays inside the run.
   2. Runs the in-app checks one after another, each from the plugin copy, and prints one plain line each: PASS or FAIL, how long it
      took, and its telling line. A check fails when it exits with anything but 0 (2 is "could not run", which fails too) or prints a
      RESULT line with a verdict that does not hold.
   3. Stops that Logseq and its graph workers (also on a failure or Ctrl-C) and exits 1 if any check failed or the Logseq could not be
      started. Nothing is skipped: no Playwright, no Logseq app, no test graph or a plugin that does not load is a failure.
   --full adds each part's own in-app check (Look, Find, DB Export, Ontology, Predictive): a few minutes more.
   --keep leaves the Logseq running at the end (its folder is printed; stop it with tools/audit/own-logseq.js stop <folder>).
   --only runs the named checks alone. Logs and pictures: <run folder>/logs and <run folder>/plugin/dist. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..'), AUDIT = path.join(__dirname, 'audit');
const has = f => process.argv.includes(f);
const arg = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const PORT = String(process.env.LOGSEQ_PORT || 9555);
const NODE_PATH = process.env.NODE_PATH || path.join(ROOT, 'node_modules');
const GRAPH = 'Illness Test Graph';
const env = { ...process.env, NODE_PATH, LOGSEQ_PORT: PORT, TEST_GRAPHS: GRAPH, GRAPH, RELEASE_CHECK: '1' };
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), `logseq-release-check-${stamp}-`)), logs = path.join(dir, 'logs'), copy = path.join(dir, 'plugin');
fs.mkdirSync(logs, { recursive: true });
const t0 = Date.now(), secs = since => Math.round((Date.now() - since) / 1000);

// The checks, in the order they run: the ones that only look first, the ones that write after them.
const node = (file, ...args) => ['node', [file, ...args]];
const CHECKS = [
  { id: 'logseq-contract', what: 'what the plugin relies on in Logseq is there', cmd: node('tools/logseq-contract-app.js'), timeout: 180 },
  { id: 'view-change', what: 'every view that redraws never stands blank between', pre: ['sidebar-open'], cmd: node('tools/view-change-check.js'), timeout: 600 },
  { id: 'motion', what: 'the plugin on against off: no jump, flash or late piece', pre: ['sidebar', 'home'], cmd: node('tools/motion-check.js'), timeout: 900 },
  { id: 'sidebar-sections', what: 'the stacked sidebar, hidden Linked references, Relations at a day\'s foot', pre: ['sidebar', 'home'], cmd: node('tools/app-checks/sidebar-sections.js', path.join(dir, 'shots')), timeout: 240 },
  { id: 'row-view', what: 'the row view, and a double press editing each kind of cell', pre: ['sidebar', 'home'], cmd: node('tools/app-checks/row-view.js', path.join(dir, 'shots')), timeout: 300 },
  { id: 'tag-placement', what: 'a tag put anywhere in the tree, Set Tags as a tree, Change to another tag', pre: ['sidebar', 'home'], cmd: node('tools/app-checks/tag-placement.js', path.join(dir, 'shots')), timeout: 240 },
  { id: 'write-check', what: 'every kind of write, made, read back and taken back', pre: ['scratch', 'sidebar'], cmd: node('tools/write-check.js'), timeout: 300 },
  { id: 'hands-on', what: 'the plugin used by real clicks and keys: typing, answering, nothing moving by itself', pre: ['sidebar', 'home'], cmd: node(path.join(AUDIT, 'hands-on-verdict.js'), '.'), timeout: 900 },
];
const FULL = [
  { id: 'look-app', what: 'Look in the real Logseq', cmd: node('look/tools/app/check.js'), timeout: 180 },
  { id: 'find-app', what: 'Find in the real Logseq', cmd: node('find/tools/app/check.js'), timeout: 300 },
  { id: 'export-app', what: 'DB Export in the real Logseq', pre: ['home'], cmd: node('export/tools/app/check.js', path.join(dir, 'export'), 'Dr. Mei Chen'), timeout: 300 },
  { id: 'ontology-app', what: 'Ontology in the real Logseq', cmd: node('structure/tools/app/check.js', path.join(dir, 'ontology')), timeout: 300 },
  { id: 'predictive-app', what: 'Predictive in the real Logseq', cmd: node('predictive/tools/app/check.js', path.join(dir, 'predictive')), timeout: 900 },
];
const only = (arg('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const list = [...CHECKS, ...(has('--full') ? FULL : [])].filter(c => !only.length || only.includes(c.id));

const run = (cmd, args, { cwd = ROOT, timeout = 300, log } = {}) => new Promise(resolve => {
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const take = d => { out += d; if (log) fs.appendFileSync(log, d); };
  child.stdout.on('data', take); child.stderr.on('data', take);
  const timer = setTimeout(() => { out += `\n(stopped after ${timeout} s)`; child.kill('SIGKILL'); }, timeout * 1000);
  child.on('close', code => { clearTimeout(timer); resolve({ code: code === null ? 124 : code, out }); });
});
let stopped = false;
const stopLogseq = () => { if (stopped || has('--keep')) return; stopped = true; spawnSync('node', [path.join(AUDIT, 'own-logseq.js'), 'stop', dir], { env, encoding: 'utf8', timeout: 60000 }); };
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopLogseq(); process.exit(130); });

// The one line that says the most: a RESULT verdict that does not hold, the first PROBLEM, else the check's last line.
function telling(out) {
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
  const res = lines.filter(l => l.startsWith('RESULT ')).map(l => { try { return JSON.parse(l.slice(7)); } catch (e) { return null; } }).filter(Boolean);
  const badRes = res.flatMap(r => Object.values(r)).filter(v => v && v.ok === false);
  const problem = lines.find(l => /^(PROBLEM|FAIL)\b/.test(l));
  return { badRes, line: (badRes[0]?.said || problem || lines.filter(l => !l.startsWith('RESULT ')).pop() || '(said nothing)').slice(0, 220), problems: lines.filter(l => /^(PROBLEM|FAIL)\b/.test(l)).length };
}

(async () => {
  const fails = [];
  const ready = () => {
    try { require.resolve('playwright', { paths: NODE_PATH.split(path.delimiter) }); } catch (e) { return 'Playwright is not on NODE_PATH (' + NODE_PATH + ')'; }
    if (!fs.existsSync('/Applications/Logseq.app/Contents/MacOS/Logseq')) return 'Logseq is not installed in /Applications';
    const graphs = process.env.TEST_GRAPHS_ROOT || path.join(os.homedir(), 'logseq-test-graphs');
    if (!fs.existsSync(path.join(graphs, 'graphs', GRAPH, 'db.sqlite')) && !fs.existsSync(path.join(graphs, 'graphs', GRAPH, 'backup'))) return `no copy of the ${GRAPH} in ${graphs} (make it with sh tools/audit/make-graphs.sh Illness)`;
    const busy = spawnSync('lsof', ['-iTCP:' + PORT, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout.trim();
    if (busy) return `port ${PORT} is already in use (another Logseq?): give LOGSEQ_PORT a free port`;
    return '';
  };
  const notReady = ready();
  console.log(`Release checks in Logseq: port ${PORT}, run folder ${dir}`);
  if (notReady) { console.log(`FAIL  Logseq could not be started: ${notReady}`); console.log('release-app-check: FAILED (the checks could not run)'); process.exit(1); }
  const started = await run('node', [path.join(AUDIT, 'fresh.js'), dir, '--plugin', ROOT], { timeout: 240, log: path.join(logs, 'start.log') });
  const loaded = (started.out.match(/^plugin (\S+) loaded: (.*)$/m) || []);
  if (started.code !== 0 || !loaded[1] || !/guarded$/m.test(started.out)) {
    console.log(`FAIL  Logseq could not be started with the plugin: ${started.out.trim().split('\n').pop()}`);
    stopLogseq(); console.log('release-app-check: FAILED (the checks could not run)'); process.exit(1);
  }
  console.log(`      Logseq up, plugin ${loaded[1]} loaded (${loaded[2]}) in ${secs(t0)} s`);
  for (const c of list) {
    const t = Date.now(), log = path.join(logs, c.id + '.log');
    if (c.pre) await run('node', [path.join(AUDIT, 'prep.js'), ...c.pre], { cwd: copy, timeout: 60, log });
    const r = await run(c.cmd[0], c.cmd[1], { cwd: copy, timeout: c.timeout, log });
    const tell = telling(r.out), ok = r.code === 0 && !tell.badRes.length;
    if (!ok) fails.push(c.id);
    const why = r.code === 2 ? 'could not run: ' : r.code === 124 ? 'did not finish: ' : '';
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.id.padEnd(17)} ${String(secs(t)).padStart(4)} s  ${ok ? c.what : why + tell.line}${!ok && tell.problems > 1 ? ` (and ${tell.problems - 1} more)` : ''}`);
  }
  stopLogseq();
  console.log(`\nlogs: ${logs}${has('--keep') ? `\nLogseq left running: stop it with LOGSEQ_PORT=${PORT} node tools/audit/own-logseq.js stop ${dir}` : ''}`);
  console.log(fails.length ? `release-app-check: FAILED (${fails.join(', ')}) in ${secs(t0)} s` : `release-app-check: OK (${list.length} checks) in ${secs(t0)} s`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('FAIL  ' + (e && e.message || e)); stopLogseq(); console.log('release-app-check: FAILED'); process.exit(1); });
