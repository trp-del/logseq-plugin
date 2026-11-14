/* The button library: every button a module draws carries a name from the library (button-library.html in the workspace,
   the drawings in plugin.js), so no module has a look of its own for one. Run from the plugin's folder: node test/library.js
   A hand-made button fails here. A button that is Logseq's own, or not a library job, is named in NOT_A_LIBRARY_BUTTON. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const FILES = ['structure/logseq', 'threads/parts', 'find/logseq', 'export/logseq', 'settings', 'look/logseq', 'predictive/logseq', 'todo']
  .flatMap(d => walk(path.join(ROOT, d))).filter(f => f.endsWith('.js'));

global.window = {};
require(path.join(ROOT, 'plugin.js'));
const NAMES = global.window.PluginDoor.NAMES;
const KINDS = ['lk-strip', 'lk-bar', 'lk-btn', 'lk-low', 'lk-del', 'lk-answers', 'lk-accent', 'lk-big', 'lk-hint', 'lk-lone', 'lk-add', 'lk-fix', 'lk-x', 'lk-plus', 'lk-change', 'lk-more', 'lk-undo', 'lk-close',
  'lk-views', 'lk-view', 'lk-trail', 'lk-step', 'lk-head', 'lk-menu', 'lk-item', 'lk-value', 'lk-pick', 'lk-alts', 'lk-name', 'lk-reveal', 'lk-reveals', 'lk-picked'];
for (const kind of KINDS) assert.ok(NAMES.includes('.' + kind), `the library draws ${kind}`);
assert.ok(NAMES.includes('.lk-enter'), 'the library draws the return sign');

// A piece of a line that makes a button: a <button> in a template, or a word Structure marks as an action.
const BUTTON = /<button\b[^>]*>|\bcreateElement\('button'\)|\bel\(\s*\w+,\s*'button'|class="[^"]*\bact\b[^"]*"/g;
const LIBRARY = new RegExp(KINDS.join('|'));
// Choices and things that are not buttons: tick boxes, fold and dig arrows, a value (Group ▾, a draft's property), Find's
// choices, Threads' kind words and a draft's property choice, and the kit's helpers, which take the
// name from whoever calls them.
// Threads' task circle is Logseq's own (th-task), drawn in Logseq's shapes and colours.
const NOT_A_LIBRARY_BUTTON = /tick|lk-tick|lk-fold|fold|dig|lk-row|th-tw-chip|th-tw-dpick|th-task|fd-c\b|choice/;

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
// A press that shows under the pointer is the library's lk-reveal: a :hover on one thing bringing in another after it, by
// opacity or visibility, is a reveal of its own.
const splitTop = list => { const out = []; let depth = 0, from = 0; for (let i = 0; i < list.length; i++) { const c = list[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === ',' && !depth) { out.push(list.slice(from, i)); from = i + 1; } } return [...out, list.slice(from)]; };
const reaches = selector => { const at = selector.indexOf(':hover'); if (at < 0) return false; let i = at + 6, depth = 0; for (let j = 0; j < at; j++) depth += selector[j] === '(' ? 1 : selector[j] === ')' ? -1 : 0; for (; i < selector.length && (depth > 0 || !/[\s>+~]/.test(selector[i])); i++) depth += selector[i] === '(' ? 1 : selector[i] === ')' ? -1 : 0; return /[\w.#\[*:]/.test(selector.slice(i)); };
const ownReveals = [];
for (const file of FILES) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of text.matchAll(/([^\n{}]*:hover[^{}]*)\{([^}]*)\}/g)) {
    if (/lk-fold|lk-tick|fd-nb/.test(rule[1]) || !/opacity:\s*(1\b|0?\.\d)|visibility:\s*visible/.test(rule[2])) continue;
    if (splitTop(rule[1]).some(reaches)) ownReveals.push(`${path.relative(ROOT, file)}: ${rule[0].trim().slice(0, 110)}`);
  }
}
if (ownReveals.length) { console.error('A press brought in by a :hover of its own, not lk-reveal:\n  ' + ownReveals.join('\n  ')); process.exit(1); }
if (boxes.length) { console.error('A box round a control under the keyboard:\n  ' + boxes.join('\n  ')); process.exit(1); }
if (symbols.length) { console.error('A key as a symbol:\n  ' + symbols.join('\n  ')); process.exit(1); }
// Words that are not Logseq's or are old, on what the person reads.
const WORDS = [...FILES, path.join(ROOT, 'threads/main.js')].map(file => [file, fs.readFileSync(file, 'utf8')]);
const OLD = [/notify\([^\n]*\brecords?\b/, /Refinements plugin/, /Refinements: troubleshooting/, /Pointed at by/, /type to find/, /&gt; for a command/, /(link|links) to <span/, /\(Shift: in the sidebar\)[`"]/, /Shift-click: in the sidebar\)">/, /return 'a record'/, /a name opens the node/, /a fix first says/, /name: 'Phenomenon'/, /in their field/];
for (const [file, text] of WORDS) for (const word of OLD) assert.ok(!word.test(text), `${path.relative(ROOT, file)} still says ${word}`);
/* The pieces the library draws whole since 6 November 2026 (plugin.js: lk-window, lk-pop, lk-tick, lk-fold, lk-bul, lk-field, lk-none,
   lk-undo, the one motion): a module's stylesheet draws none again. A shadow is a frame of the module's own; a ::backdrop a window's
   own dimming; a keyframe or animation a motion of its own; appearance: none on a checkbox a tick box of its own; a hex colour
   outside a var() fallback a colour of its own. What a module may still carry is named here with its reason. */
for (const name of ['.lk-window', '.lk-pop', 'input.lk-tick[type=checkbox]', '.lk-fold::before', '.lk-bul::before', '.lk-field', '.lk-none', 'input.lk-value', '.lk-undo-dock']) assert.ok(NAMES.includes(name), `the library draws ${name}`);
const OWN = [
  // A shadow that is not a frame: the printed sheet on the desk, a wash ring under the keyboard, Logseq's own notices, sidebar and search window restyled by Look, a specimen in the settings window.
  [/box-shadow:\s*0 [^;}]*/, /xp-desk iframe|\.pv-page|0 0 0 3px var\(--lk-wash\)|look\/logseq\/(notices|sidebar|settings|calm)\.js/, 'a shadow of its own'],
  [/::backdrop/, /^$/, 'a backdrop of its own'],
  // A link's faint line, the ↗ after a web address and a tag's name are the door's (Door.LOOKS, 12 November 2026): written out again, they drift.
  [/text-decoration-color:\s*var\(--lk-link\)|content:\s*"\\+2197"|font-family:\s*var\(--lk-tag-face\)/, /^$/, 'a link’s line, a web address’s arrow or a tag’s name written again (PluginDoor.LOOKS)'],
  [/@keyframes|\banimation:/, /^$/, 'a motion of its own'],
  [/appearance:\s*none[^}]*\}/, /^$/, 'a tick box or control drawn again'],
  // A text size off the scale (6 November 2026, measured in Logseq): the body is the place's own (16 px on a page, 14 px in a window,
  // a pop-up or the sidebar, as Logseq's own), the small size is --lk-small (13 px: days, counts, notes, keys, trails) and the label
  // --lk-label (12 px: the small name over a value, a pop-up's head, the year line's words); a tag is .85em, as Logseq's own. A glyph
  // (an icon, a chevron, a ×, a superscript number), a heading (a page's title, in calm.js; Threads' Linked, 9 November 2026), monospaced text, a specimen of Logseq's look and the printed page keep theirs.
  [/font-size:\s*(?!\s|14px|16px|inherit|var\(--lk-(small|label)\)|var\(--th-name, 1em\)|\.85em)[^;}`'"]+/, /\.ti\b|icon|kind|chev|close|-x\b|flow-x|cite-n|flow-model|st-pi|th-drawn|lk-undo|h2|th-tw-whole-name|picked|sw-head|sw-pic|look\/logseq\/(settings|calm)\.js|export\/(core|logseq\/preview)|mono|Georgia/, 'a text size of its own'],
  [/(color|background|stroke|fill|border)[^;:]*:\s*[^;]*#[0-9a-fA-F]{3,6}\b/, /var\(--[\w-]+,\s*#|export\/logseq\/preview\.js|xp-desk iframe|color-mix\([^)]*#000\)|<!doctype html>|look\/logseq\/settings\.js/, 'a colour of its own'],
];
const own = [];
for (const file of FILES) {
  const rel = path.relative(ROOT, file);
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*')) return;
    for (const [what, allowed, says] of OWN) { const m = line.match(what); if (m && !allowed.test(rel + ' ' + line)) own.push(`${rel}:${i + 1} ${says}: ${line.trim().slice(0, 100)}`); }
  });
}
/* A motion made by script (element.animate) is a motion all the same, and the rules above read only stylesheets (12 November 2026,
   the library review: the focus glide came in unseen). What opens rolls by the door's one motion (Door.unroll, rollUp, regrow); a
   module that moves something itself is named here with how many and why. One more, anywhere, fails; so does one fewer. */
const SCRIPTED = {
  'look/logseq/focus.js': 3,             // the glide into a bullet and out (the owner's pick, 11 November 2026): a move across the view, the old view fading, the new fading in
  'predictive/logseq/propose-ui.js': 2,  // a pencilled value cross-fades where it stands when the guess changes
  'structure/logseq/view.js': 2,         // the top bar of waiting changes slides open and shut
};
for (const file of FILES) {
  const rel = path.relative(ROOT, file), n = (fs.readFileSync(file, 'utf8').match(/\.animate\(/g) || []).length;
  if (n !== (SCRIPTED[rel] || 0)) own.push(`${rel}: ${n} motions made by script where ${SCRIPTED[rel] || 0} are named in test/library.js (use the door's roll, or name it with its reason)`);
}
if (own.length) { console.error('A look drawn by a module that the library draws whole:\n  ' + own.join('\n  ')); process.exit(1); }
console.log(`library: ${KINDS.length} kinds drawn, every button in ${FILES.length} files draws from them; no module draws a frame, a tick box, a colour or a motion of its own`);
