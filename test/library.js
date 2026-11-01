/* The button library: every button a module draws carries a name from the library (button-library.html in the workspace,
   the drawings in plugin.js), so no module has a look of its own for one. Run from the plugin's folder: node test/library.js
   A hand-made button fails here. A button that is Logseq's own, or not a library job, is named in NOT_A_LIBRARY_BUTTON. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const FILES = ['structure/logseq', 'threads/parts', 'find/logseq', 'export/logseq', 'settings', 'look/logseq', 'predictive/logseq']
  .flatMap(d => walk(path.join(ROOT, d))).filter(f => f.endsWith('.js'));

global.window = {};
require(path.join(ROOT, 'plugin.js'));
const NAMES = global.window.PluginDoor.NAMES;
const KINDS = ['lk-strip', 'lk-bar', 'lk-btn', 'lk-answers', 'lk-accent', 'lk-hint', 'lk-lone', 'lk-add', 'lk-fix', 'lk-x', 'lk-plus', 'lk-more', 'lk-undo', 'lk-close',
  'lk-views', 'lk-view', 'lk-trail', 'lk-step', 'lk-head', 'lk-menu', 'lk-item', 'lk-value', 'lk-pick', 'lk-alts', 'lk-name'];
for (const kind of KINDS) assert.ok(NAMES.includes('.' + kind), `the library draws ${kind}`);

// A piece of a line that makes a button: a <button> in a template, or a word Structure marks as an action.
const BUTTON = /<button\b[^>]*>|\bcreateElement\('button'\)|\bel\(\s*\w+,\s*'button'|class="[^"]*\bact\b[^"]*"/g;
const LIBRARY = new RegExp(KINDS.join('|'));
const NOT_A_LIBRARY_BUTTON = /tick|lk-tick|lk-fold|fold|dig|lk-row|rf-kind|rf-group|ps-|xp-tab|xp-cho|choice/;

const strays = [];
for (const file of FILES) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const hit of line.match(BUTTON) || []) {
      const near = line.slice(Math.max(0, line.indexOf(hit) - 120), line.indexOf(hit) + hit.length + 160);
      if (LIBRARY.test(near) || NOT_A_LIBRARY_BUTTON.test(near)) continue;
      strays.push(`${path.relative(ROOT, file)}:${i + 1}  ${hit.slice(0, 90)}`);
    }
  });
}
if (strays.length) { console.error('Buttons that do not draw from the library:\n  ' + strays.join('\n  ')); process.exit(1); }
console.log(`library: ${KINDS.length} kinds drawn, every button in ${FILES.length} files draws from them`);
