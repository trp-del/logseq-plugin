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
// Choices and things that are not buttons: tick boxes, fold and dig arrows, a value (Group ▾, a draft's property), Find's
// choices, Threads' kind words, a word's own × in the kit (a chip nothing draws yet), and the kit's helpers, which take the
// name from whoever calls them.
const NOT_A_LIBRARY_BUTTON = /tick|lk-tick|lk-fold|fold|dig|lk-row|rf-tw-chip|rf-tw-groupby|rf-tw-dpick|rf-chip-x|rf-ol-act|fd-c\b|rf-quiet\$\{faint|ps-|xp-tab|xp-cho|choice/;

const strays = [];
for (const file of FILES) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(BUTTON)) {
    const line = text.slice(text.lastIndexOf('\n', match.index) + 1, match.index);
    if (line.trimStart().startsWith('//')) continue;
    const near = text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 200);
    if (LIBRARY.test(near) || NOT_A_LIBRARY_BUTTON.test(near)) continue;
    strays.push(`${path.relative(ROOT, file)}:${text.slice(0, match.index).split('\n').length}  ${match[0].slice(0, 90)}`);
  }
}
if (strays.length) { console.error('Buttons that do not draw from the library:\n  ' + strays.join('\n  ')); process.exit(1); }
console.log(`library: ${KINDS.length} kinds drawn, every button in ${FILES.length} files draws from them`);
