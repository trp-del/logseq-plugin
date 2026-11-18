#!/usr/bin/env node
/* node fresh.js <dir> [--plugin <folder>] [--graphs "Illness Test Graph,Stress Check"] [--settings '{"key":value}']
   Builds a fresh home for the checks' own Logseq under <dir> and starts it: a copy of each test graph named (taken from Logseq's
   own newest backup of it, under the same name, in the home made here), a copy of the plugin (the folder given,
   else the last commit of logseq-plugin), Apple's tools switched off in the plugin's settings. Then loads the plugin.
   Prints the plugin copy's folder. Nothing of the owner's Logseq is touched. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const HERE = __dirname;
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const dir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('fresh.js needs a folder'); process.exit(2); }
const REPO = path.resolve(HERE, '../..');
const env = { ...process.env, NODE_PATH: process.env.NODE_PATH || path.resolve(HERE, '../../node_modules') };
const node = (file, args = []) => { const r = spawnSync('node', [path.join(HERE, file), ...args], { env, encoding: 'utf8', timeout: 180000 }); return ((r.stdout || '') + (r.stderr || '')).trim(); };
const home = path.join(dir, 'home'), copy = path.join(dir, 'plugin');
if (fs.existsSync(home)) { console.error('that folder already holds a home: give a new one'); process.exit(2); }
fs.mkdirSync(path.join(home, '.logseq', 'settings'), { recursive: true }); fs.mkdirSync(copy, { recursive: true });
const graphs = (arg('--graphs') || 'Illness Test Graph').split(',').map(s => s.trim()).filter(Boolean);
const NAMES = {};   // a copy keeps its graph's name: it lives in a home of its own, and the plugin's older tools know the graphs by name
for (const g of graphs) {
  const base = path.join(process.env.TEST_GRAPHS_ROOT || path.join(os.homedir(), 'logseq-test-graphs'), 'graphs', g), backups = path.join(base, 'backup');   // made by make-graphs.sh, never the owner's ~/logseq
  let from = null;
  if (fs.existsSync(backups)) { const newest = fs.readdirSync(backups).filter(n => fs.existsSync(path.join(backups, n, 'db.sqlite'))).sort().pop(); if (newest) from = path.join(backups, newest, 'db.sqlite'); }
  if (!from && fs.existsSync(path.join(base, 'db.sqlite'))) from = path.join(base, 'db.sqlite');   // a graph that is not open has no lock on its file
  if (!from) { console.error('no copy to take for ' + g); process.exit(2); }
  const to = path.join(home, 'logseq', 'graphs', NAMES[g] || path.basename(g));
  fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(from, path.join(to, 'db.sqlite'));
  console.log(`graph “${NAMES[g] || path.basename(g)}” from ${path.relative(os.homedir(), from)}`);
}
const settings = { proposalsModel: false, readingWidth: 'Narrow', ...(arg('--settings') ? JSON.parse(arg('--settings')) : {}) };
fs.writeFileSync(path.join(home, '.logseq', 'settings', 'logseq-plugin.json'), JSON.stringify(settings));
const from = arg('--plugin');
if (from) execFileSync('rsync', ['-a', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', '--exclude', 'check.log', path.resolve(from) + '/', copy + '/']);
else execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${copy}"`]);
console.log(node('own-logseq.js', ['start', dir]));
spawnSync('sleep', ['9']);
console.log(node('load-plugin.js', [copy]));
console.log(node('prep.js', ['guard']));   // nothing a check does reaches the Mac's clipboard, Finder, browser or print window
console.log('plugin copy: ' + copy);
