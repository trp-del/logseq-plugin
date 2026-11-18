#!/usr/bin/env node
/* node faults.js <dir> [--only <ids>]   Goalpost line 7.4: a pass means something.
   <dir> is the folder of a running Logseq of the checks' own (made by fresh.js: <dir>/plugin is the plugin copy it runs).
   Each fault below breaks one thing on purpose in that copy (one exact edit of one file), reloads the plugin, runs the check
   that guards the thing, and expects that check to FAIL on the goalpost line named. Then the file is put back. A check that
   still passes with its thing broken proves nothing: it is named, and line 7.4 fails. At the end every file is as it was (each
   is compared with its saved copy), the plugin is reloaded whole, and faults.json in AUDIT_OUT (else <dir>) says what was caught.
   The working folder and the owner's Logseq are never touched: only the throwaway copy under <dir>. */
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const HERE = __dirname, ROOT = path.resolve(HERE, '..');
const dir = path.resolve(process.argv[2] || ''), copy = path.join(dir, 'plugin');
const onlyAt = process.argv.indexOf('--only'), only = onlyAt > 0 ? process.argv[onlyAt + 1].split(',') : [];
if (!process.argv[2] || !fs.existsSync(path.join(copy, 'plugin.js')) || !/\/home\b|scratchpad|logseq-proof|\/tmp\//.test(dir + '/home')) { console.error('faults.js needs the folder of a running Logseq of the checks\' own'); process.exit(2); }
const out = path.join(dir, 'faults'); fs.mkdirSync(out, { recursive: true });
const NODE_PATH = process.env.NODE_PATH || path.resolve(HERE, '../../node_modules');
const env = { ...process.env, NODE_PATH, LOGSEQ_PORT: String(process.env.LOGSEQ_PORT || 9555), GRAPH: 'Illness Test Graph', TEST_GRAPHS: 'Illness Test Graph' };
const node = (file, args = [], cwd = HERE, timeout = 600000) => { const r = spawnSync('node', [file, ...args], { cwd, env, encoding: 'utf8', timeout, maxBuffer: 1 << 26 }); return { out: (r.stdout || '') + (r.stderr || ''), status: r.status }; };
const mine = (file, args = []) => () => node(path.join(HERE, file), args);

/* id, what is broken (plain words), the file and the one edit, the check, the line it must fail on, app: whether Logseq is needed. */
const FAULTS = [
  { id: 'wash', line: '3.6', breaks: 'a change that waits loses its yellow wash', file: 'plugin.js', find: '.lk-coming { background: var(--rx-yellow-a5, rgba(255, 213, 0, .35));', put: '.lk-coming { background: transparent;', app: true, run: mine('waiting-look.js', [path.join(out, 'wash'), 'fault']) },
  { id: 'yes-named-apply', line: '3.5', breaks: 'the yes of the delete-for-good question reads plain “Apply” again', file: 'structure/logseq/view.js', find: '<span class="lk-big" data-stage>${esc(yes)}</span>', put: '<span class="lk-big" data-stage>Apply</span>', app: true, run: mine('for-good.js', [path.join(out, 'yes'), 'fault']) },
  // Since 17 November 2026 the sidebar is Logseq's stacked sections, with no tab to pick again: what a split must put back is the sidebar's list in its order.
  { id: 'list-not-back', line: '2.2', breaks: 'two pages side by side, closed, no longer puts the sidebar’s sections back in their order', file: 'split.js', find: 'if (out && before) await reorder(doc, before.list);', put: '', app: true, run: mine('split-try.js', [path.join(out, 'split')]) },
  { id: 'deadlines-unread', line: '5.2', breaks: 'Linked no longer reads the tasks due on a day', file: 'threads/parts/model.js', find: 'async function duesOn(day) {', put: 'async function duesOn(day) { return [];', app: true, run: mine('linked-truth.js') },
  { id: 'left-on-page', line: '6.7', breaks: 'a stylesheet the plugin puts in Logseq’s page is left there when the plugin is switched off', file: 'plugin.js', find: "base.onStop(() => { sheets.delete(id); doc.getElementById(id)?.remove(); });", put: "base.onStop(() => { sheets.delete(id); });", app: true, run: mine('off-on.js', [path.join(out, 'off-on'), 'fault']) },
  { id: 'command-throws', line: '5.1', breaks: 'the command “Todo in the sidebar” throws', file: 'todo/main.js', find: "logseq.App.registerCommandPalette({ key: 'todo-side', label: 'Todo in the sidebar' }, openSide);", put: "logseq.App.registerCommandPalette({ key: 'todo-side', label: 'Todo in the sidebar' }, () => { throw new Error('broken on purpose'); });", app: true, run: mine('commands.js', [path.join(out, 'commands')]) },
  { id: 'says-block', line: '3.2', breaks: 'a command says “blocks” again', file: 'export/main.js', find: "label: 'Export: the selected bullets…'", put: "label: 'Export: the selected blocks…'", app: false, run: () => node(path.join(HERE, 'words.js'), [copy]) },
  { id: 'readme-silent', line: '7.2', breaks: 'a README no longer names a command', file: 'threads/README.md', find: '**Relations: troubleshooting**', put: 'a list of tools', app: false, run: () => node(path.join(HERE, 'readme-check.js'), [copy]) },
  { id: 'door-bypassed', line: '7.1', breaks: 'a part writes to the graph past the one write door', file: 'todo/main.js', find: "const Door = window.PluginDoor;", put: "const Door = window.PluginDoor;\nconst zzBroken = () => logseq.Editor.updateBlock('x', 'y');", app: false, run: () => node('test/writes.js', [], copy) },
  { id: 'preview-skipped', line: '5.3', breaks: 'Move under… stages at once again, with no preview', file: 'structure/logseq/view.js', find: "if (p.what === 'tag' && p.preview && !TAGISH) return askTagMove(p.tags, row.key);", put: '', app: false, run: () => node('test/load.js', [], path.join(copy, 'structure')) },
];

const reload = () => { const r = node(path.join(HERE, 'reload-plugin.js')); if (!/reloaded/.test(r.out)) throw new Error('the plugin did not come back after a reload: ' + r.out.slice(0, 300)); };
const rows = [];
let dirty = false;
for (const f of FAULTS) {
  if (only.length && !only.includes(f.id)) continue;
  const file = path.join(copy, f.file), was = fs.readFileSync(file, 'utf8');
  const file2 = f.also ? path.join(copy, f.also.file) : null, was2 = file2 ? fs.readFileSync(file2, 'utf8') : null;
  if (was.split(f.find).length !== 2) { rows.push({ ...f, run: undefined, caught: false, said: `the edit could not be made: “${f.find.slice(0, 50)}” stands ${was.split(f.find).length - 1} times in ${f.file}` }); console.log(`SKIP ${f.id}: ${rows.at(-1).said}`); continue; }
  let got = { out: '', status: 1 };
  try {
    fs.writeFileSync(file, was.replace(f.find, f.put));
    if (file2) fs.writeFileSync(file2, was2.replace(f.also.find, f.also.put));
    if (f.app) { reload(); dirty = true; }
    got = f.run();
  } finally { fs.writeFileSync(file, was); if (file2) fs.writeFileSync(file2, was2); }
  fs.writeFileSync(path.join(out, f.id + '.log'), got.out);
  const line = got.out.split('\n').reverse().find(l => l.startsWith('RESULT '));
  let verdict = null; try { verdict = line ? JSON.parse(line.slice(7))[f.line] : null; } catch (e) { verdict = null; }
  const failed = verdict ? verdict.ok === false : got.status !== 0;
  const said = verdict ? verdict.said : (got.out.match(/^(FAIL|FAILED|PROBLEM|AssertionError)[^\n]*/m) || [got.out.trim().split('\n').pop() || ''])[0].slice(0, 240);
  rows.push({ id: f.id, line: f.line, breaks: f.breaks, check: f.run.name || '', caught: failed, said });
  console.log(`${failed ? 'caught' : 'MISSED'}  ${f.id} (line ${f.line}): ${f.breaks}  →  ${said.slice(0, 170)}`);
}
if (dirty) reload();
// Every file as it was: the copy must equal what the run began with (each edit restored its file in a finally).
const missed = rows.filter(r => !r.caught);
fs.writeFileSync(path.join(process.env.AUDIT_OUT || dir, 'faults.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log(`${rows.length - missed.length} of ${rows.length} deliberate faults were caught by their checks`);
console.log('RESULT ' + JSON.stringify({ '7.4': { ok: !missed.length && rows.length >= 8, said: missed.length ? `${missed.length} of ${rows.length} checks still passed with their thing broken on purpose: ${missed.slice(0, 3).map(m => m.breaks).join('; ')}` : `${rows.length} things were broken on purpose, one at a time, and each check that guards one failed as it must` } }));
process.exit(missed.length ? 1 : 0);
