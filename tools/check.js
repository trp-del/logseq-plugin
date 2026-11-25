#!/usr/bin/env node
/* The one check (19 November 2026, the owner: "clear all current checks, then build actual useful ones", and of three minutes a
   run, "this was the exact problem"). Run from your copy of the plugin:

     node tools/check.js                       the change in this folder, against GitHub's main: under half a minute
     node tools/check.js --expect "Todo"       the same, naming the screens the change means to alter
     node tools/check.js --release             everything, before a release: every screen and every earlier complaint
                                               (--again walks the screens even if the guard already passed on these files)

   Six things are checked, each for something that really went wrong here:
     safe      every write to the graph goes through the one door, and an Undo never takes away later work
     library   no part draws a look of its own: buttons, colours, sizes, motions, shared pieces restyled, greys mixed
     logic     Predictive's guesses, Ontology's changes, the export, Linked's reading of the graph, dates and keys
     same      the guard: the screens a change can touch, before and after, and the owner's earlier complaints as cases
     reads     on those screens: nothing cut off, too faint, out of line, empty, over other words or past the edge
     logseq    what the plugin relies on in Logseq is still there, and its lines of words measure as Logseq's do
   The first three need no Logseq and run side by side with the rest. The last three run in the guard's own Logseq, which stays
   running between checks and ends by itself after twenty idle minutes (tools/guard/sandbox.js).

   A change is checked only where it can reach: the parts whose files changed pick the logic checks, the screens and the cases.
   A file every part shares (plugin.js, main.js, the sidebar) reaches a screen of each part. --release leaves nothing out. */
const fs = require('node:fs'), path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..'), t0 = Date.now();
const has = flag => process.argv.includes(flag), arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const release = has('--release');
const env = { ...process.env, NODE_PATH: process.env.NODE_PATH || [path.join(ROOT, 'node_modules'), path.resolve(ROOT, '..', '..', 'logseq-plugin', 'node_modules')].find(d => fs.existsSync(d)) || '' };
const git = (...args) => { try { return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };

// What changed, against GitHub's main as it is now.
const base = arg('--base') || 'origin/main';
if (/^origin\//.test(base)) git('fetch', '-q', 'origin', base.slice(7));
const changed = [...new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '-o', '--exclude-standard').split('\n')])].filter(f => f && !f.startsWith('node_modules'));
// What ships: the files release.sh zips. A check, a tool, a README or the Alfred workflow reaches no screen.
const ships = f => !/(^|\/)(test|tools)\//.test(f) && !/^alfred\//.test(f) && !/(^|\/)README\.md$/.test(f) && !/^(CLAUDE\.md|\.gitignore|LICENSE)$/.test(f) && !/\.(md|png|gif|edn|py)$/.test(f);
const PART = f => /^(look|threads|structure|find|todo|predictive|export|settings)\//.test(f) ? f.split('/')[0] : /^sidebar-tabs\.js$/.test(f) ? 'sidebar' : /^split\.js$/.test(f) ? 'split' : 'shared';
const parts = release ? ['shared'] : [...new Set(changed.filter(ships).map(PART))];
const touches = (...names) => release || parts.includes('shared') || names.some(n => parts.includes(n));

// The screens a part's change can reach (the guard's names, tools/guard/tour.js). Dark and narrow twins are walked before a release.
const SCREENS = {
  look: ['person', 'tag with a table', 'a page in the right sidebar', 'key sheet'],
  threads: ['person', 'journal day', 'a page in the right sidebar'],
  structure: ['Ontology', 'tag with a table', 'property'],
  find: ['Find, typed', 'Find, in the choices', 'Find, a row opened', 'Find, a new page offered', 'Find, by sentence'], todo: ['Todo'], settings: ['settings window'],
  predictive: ['person, writing in a bullet'],
  sidebar: ['a page in the right sidebar'],
  export: [], split: [],
  shared: ['person', 'tag with a table', 'Ontology', 'Todo', 'Find, typed', 'a page in the right sidebar'],
};
const screens = release ? null : [...new Set(parts.flatMap(p => SCREENS[p] || SCREENS.shared))];

// The checks that need no Logseq: [name, what it guards, folder, command, when].
const QUICK = [
  ['library', 'no part draws a look of its own', '.', ['node', 'test/library.js'], true],
  ['safe: one door', 'every write goes through the one door', '.', ['node', 'test/writes.js'], true],
  ['safe: undo', 'an Undo never takes away later work', '.', ['node', 'test/undo.js'], touches('look', 'threads', 'structure', 'predictive')],
  ['safe: risks', 'the data-safety fixes stay fixed', '.', ['node', 'test/risks.js'], touches('look', 'threads', 'structure', 'predictive')],
  ['logic: dates', 'days and journal titles', '.', ['node', 'test/dates.js'], touches()],
  ['logic: folded note', 'the folded note\u2019s four rules', '.', ['node', 'test/folded.js'], touches('look', 'find', 'threads', 'todo')],
  ['logic: keys', 'keys as settings spell them', '.', ['node', 'test/keys.js'], touches('look', 'settings', 'predictive', 'find')],
  ['logic: Predictive', 'what Predictive guesses from words', 'predictive', ['node', 'test/run.js'], touches('predictive')],
  ['logic: Ontology', 'Ontology’s changes and their Undo', 'structure', ['sh', '-c', 'node test/core.test.js && node test/apply.test.js'], touches('structure')],
  ['logic: export', 'a page turned into Markdown and print', 'export', ['node', 'test/core.test.js'], touches('export')],
  ['logic: Linked', 'what points at a page, read from the graph', 'threads', ['node', 'tools/model-test.js'], touches('threads')],
  ['logseq: relied on', 'what the plugin relies on in Logseq is there', '.', ['node', 'test/logseq-contract.js'], release || changed.some(f => /logseq-contract/.test(f))],
  ['guard: its own lock', 'the guard’s record of what ships', '.', ['node', 'test/guard.js'], release || changed.some(f => /^tools\/guard\/|^test\/guard\.js$/.test(f))],
].filter(c => c[4]);

const run = (cmd, args, cwd, quiet) => new Promise(resolve => {
  const started = Date.now(), child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; const take = d => { out += d; if (!quiet) process.stdout.write(d); };
  child.stdout.on('data', take); child.stderr.on('data', take);
  child.on('close', code => resolve({ ok: code === 0, out, secs: (Date.now() - started) / 1000 }));
  child.on('error', e => resolve({ ok: false, out: String(e), secs: 0 }));
});

(async () => {
  console.log(release ? 'Checking everything, for a release.' : changed.length ? `Checking the change: ${changed.length} file${changed.length > 1 ? 's' : ''}${parts.length ? ' in ' + parts.join(', ') : ', none of which ships'}.` : 'Nothing differs from GitHub’s main: checking the plugin as it is.');
  const quick = Promise.all(QUICK.map(async ([name, what, dir, [cmd, ...args]]) => ({ name, what, ...(await run(cmd, args, path.join(ROOT, dir), true)) })));
  let guard = null, already = false;
  // Before a release the guard may have passed on exactly these files already (a first run, then a reason given for each meant
  // difference with `guard.js why`): its screens are not walked a second time.
  if (release && !has('--again')) already = (await run('node', ['tools/guard/guard.js', 'verify', '--folder', ROOT], ROOT, true)).ok;
  let warmed = null; if (already) warmed = await run('node', ['tools/guard/guard.js', 'warm', '--change', ROOT], ROOT, true);
  if (!already && (release || (screens && screens.length))) {
    const args = ['tools/guard/guard.js', 'run', '--change', ROOT, '--base', base];
    if (!release) args.push('--only', screens.join(','), '--parts', parts.join(','));
    if (arg('--expect')) args.push('--expect', arg('--expect'));
    // The checks that need the running app go along, into one of the guard's Logseqs, while the others walk their screens.
    if (release || parts.includes('shared')) args.push('--in-app', release ? 'write,contract' : 'write');
    guard = await run('node', args, ROOT, true);
  }
  const results = await quick, lines = [];
  /* In the guard's Logseq, on its copy of the Illness Test Graph, with the plugin as changed (before a release, or when a file every
     part shares changed): every kind of write made, read back and taken back, the graph left as it was; and, before a release, what
     the plugin relies on in Logseq looked at in the running app. */
  const port = String(Number(process.env.GUARD_PORT || 9340));
  const inApp = [], NAMES = { write: ['safe: in Logseq', 'every kind of write made in a real Logseq, read back and taken back'], contract: ['logseq: in the app', 'what the plugin relies on, looked at in the running Logseq'] };
  // What the guard ran along the way, one line each in its output.
  for (const m of (guard ? guard.out : '').matchAll(/^IN-APP (\{.*\})$/gm)) { try { const r = JSON.parse(m[1]); if (NAMES[r.name]) inApp.push({ name: NAMES[r.name][0], what: NAMES[r.name][1], ok: r.ok, out: r.out, secs: r.secs }); } catch (e) { /* not a line of ours */ } }
  if (!inApp.length && (release || parts.includes('shared')) && ((guard && !/did not answer|could not be started/.test(guard.out)) || (warmed && warmed.ok))) {
    const appEnv = { ...env, LOGSEQ_PORT: port };
    const app = (cmd) => new Promise(resolve => { const started = Date.now(), child = spawn('node', cmd, { cwd: ROOT, env: appEnv, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d); child.on('close', code => resolve({ ok: code === 0, out, secs: (Date.now() - started) / 1000 })); });
    inApp.push({ name: 'safe: in Logseq', what: 'every kind of write made in a real Logseq, read back and taken back', ...(await app(['tools/write-check.js'])) });
    if (release) inApp.push({ name: 'logseq: in the app', what: 'what the plugin relies on, looked at in the running Logseq', ...(await app(['tools/logseq-contract-app.js'])) });
  }
  results.push(...inApp);
  for (const r of results) lines.push(`${r.ok ? 'ok    ' : 'FAILED'}  ${r.name}: ${r.what}${r.secs >= 10 ? ` (${Math.round(r.secs)} s)` : ''}${r.ok ? '' : '\n' + r.out.trim().split('\n').slice(-12).map(l => '          ' + l).join('\n')}`);
  if (guard) {
    const tail = guard.out.trim().split('\n'), at = tail.findIndex(l => /^The page:/.test(l));
    const passed = /^PASSED/m.test(guard.out), open = /NOT PASSED/.test(guard.out), partial = /A part of the tour only/.test(guard.out);
    guard.ok = guard.ok && !open && (passed || partial);
    lines.push(`${guard.ok ? 'ok    ' : 'FAILED'}  same, reads, logseq: ${release ? 'every screen' : screens.length + ' screen' + (screens.length > 1 ? 's' : '') + ' (' + screens.join(' · ') + ')'} and the earlier complaints${guard.ok ? '' : '\n' + tail.slice(at >= 0 ? at : -14).map(l => '          ' + l).join('\n')}`);
    if (guard.ok && at >= 0) lines.push('        ' + tail[at]);
    // Where the time went, so a slow check says so itself: the Logseqs used, and the guard's own time.
    const shared = guard.out.match(/^after: \d+ Logseqs at once.*$/m), took = guard.out.match(/^took (\d+) s$/m);
    if (took) lines.push(`        the screens and cases took ${took[1]} s${shared ? '; ' + shared[0] : ''}`);
  } else if (already) lines.push('ok      same, reads, logseq: the guard already passed on exactly these files');
  else lines.push('—       no screen to look at: nothing that ships changed, or a part with no screen in the tour (export, split)');
  console.log(lines.join('\n'));
  const failed = results.some(r => !r.ok) || (guard && !guard.ok);
  console.log(`\n${failed ? 'NOT PASSED' : release ? 'PASSED: ready to release.' : 'Passed. Before a release: node tools/check.js --release'}  (${Math.round((Date.now() - t0) / 1000)} s)`);
  process.exit(failed ? 1 : 0);
})();
