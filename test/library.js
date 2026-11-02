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
const KINDS = ['lk-strip', 'lk-bar', 'lk-btn', 'lk-low', 'lk-del', 'lk-answers', 'lk-accent', 'lk-big', 'lk-hint', 'lk-lone', 'lk-add', 'lk-fix', 'lk-x', 'lk-plus', 'lk-more', 'lk-undo', 'lk-close',
  'lk-views', 'lk-view', 'lk-trail', 'lk-step', 'lk-head', 'lk-menu', 'lk-item', 'lk-value', 'lk-pick', 'lk-alts', 'lk-name'];
for (const kind of KINDS) assert.ok(NAMES.includes('.' + kind), `the library draws ${kind}`);
assert.ok(NAMES.includes('.lk-enter'), 'the library draws the return sign');

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
// Every icon a press names is one the library draws.
const ICONS = global.window.PluginDoor.ICONS;
for (const file of FILES) for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(/lk-i-([a-z]+)/g)) assert.ok(ICONS[name], `${path.relative(ROOT, file)} names an icon the library lacks: ${name}`);
// Focus is a wash or a firmer line, never a box round a control (grammar); a key is told in plain words, never a symbol.
const boxes = [], symbols = [];
for (const file of FILES) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of text.matchAll(/[^\n{}]*:focus-visible[^{}\n]*\{[^}]*\}/g)) if (/outline:\s*\d/.test(rule[0])) boxes.push(`${path.relative(ROOT, file)}: ${rule[0].slice(0, 90)}`);
  for (const key of text.matchAll(/[^\n]*(<kbd>[^<]*⌘|class="ky">[^<]*⌘|class="sw-k">⌘)[^\n]{0,20}/g)) symbols.push(`${path.relative(ROOT, file)}: ${key[1]}`);
}
if (boxes.length) { console.error('A box round a control under the keyboard:\n  ' + boxes.join('\n  ')); process.exit(1); }
if (symbols.length) { console.error('A key as a symbol:\n  ' + symbols.join('\n  ')); process.exit(1); }
// Words that are not Logseq's or are old, on what the person reads.
const WORDS = [...FILES, path.join(ROOT, 'threads/main.js')].map(file => [file, fs.readFileSync(file, 'utf8')]);
const OLD = [/notify\([^\n]*\brecords?\b/, /Refinements plugin/, /Refinements: troubleshooting/, /Pointed at by/, /type to find/, /&gt; for a command/, /(link|links) to <span/, /\(Shift: in the sidebar\)[`"]/, /Shift-click: in the sidebar\)">/, /return 'a record'/, /a name opens the node/, /a fix first says/, /name: 'Phenomenon'/, /in their field/];
for (const [file, text] of WORDS) for (const word of OLD) assert.ok(!word.test(text), `${path.relative(ROOT, file)} still says ${word}`);
console.log(`library: ${KINDS.length} kinds drawn, every button in ${FILES.length} files draws from them`);
