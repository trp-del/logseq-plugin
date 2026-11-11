/* One idea, one look, and the small polish (reports/changes-to-make.md, 27 to 38, built 10 November 2026): each check fails if a
   piece goes back to drawing its own look. Run from the plugin's folder: node test/one-look.js */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
global.window = {};
require(path.join(ROOT, 'plugin.js'));
const NAMES = global.window.PluginDoor.NAMES;
const rule = (css, sel) => { const at = css.indexOf(sel + ' {'); return at < 0 ? '' : css.slice(at, css.indexOf('}', at)); };

// 27: "pick a view" is the library's lk-view everywhere: the one in force darker with a short bar under its word; no underline,
// no ground, no change of weight; the sidebar's tabs, Links, Structure and Linked's kinds all draw it.
const on = rule(NAMES, '.lk-view.on'), bar = rule(NAMES, '.lk-view.on::after');
assert.ok(on && !/underline|font-weight|background/.test(on), 'the view in force: only its colour changes');
assert.ok(/height: 2px/.test(bar) && /var\(--lk-view-pad/.test(bar), 'the view in force has its short bar, the word\'s width');
assert.ok(!/\.lk-view:hover[^{]*\{[^}]*background/.test(NAMES) && !/\.lk-view:hover, \.lk-view:focus-visible, \.lk-item/.test(NAMES), 'no ground under a view');
assert.ok(/className = `lk-view\$\{on/.test(read('sidebar-tabs.js')), 'the sidebar\'s tabs are views');
assert.ok(/class: `lk-view\$\{state\.view/.test(read('look/logseq/links.js')), 'Links\' two orders are views');
assert.ok(/class="lk-view \$\{v === k/.test(read('structure/logseq/view.js')), 'Structure\'s three views are views');
assert.ok(/th-tw-chip lk-view\$\{tag === only/.test(read('threads/parts/two-way.js')), 'Linked\'s kinds are views');

// 28: no filled pills: Find's "make a page", the settings' "Changed by you", "Logseq's list" and "default", Structure's Merge into and
// Combine as are presses with no ground at rest (lk-low).
assert.ok(/class: 'lk-btn lk-low lk-i-plus', type: 'button', title: 'Make a page/.test(read('find/logseq/find.js')), 'Find\'s make a page');
const sw = read('settings/window.js');
assert.ok(/sw-default lk-btn lk-low/.test(sw) && /sw-word lk-btn lk-low\$\{/.test(sw) && /sw-word lk-btn lk-low" id="sw-plain"/.test(sw) && !/sw-(word|default) lk-lone/.test(sw), 'the settings\' foot and default');
const st = read('structure/logseq/view.js');
assert.ok(/lk-btn lk-low lk-i-merge \$\{n \? '' : 'waits'\}" data-paim/.test(st) && /lk-btn lk-low lk-i-rename/.test(st) && /lk-btn lk-low lk-i-move \$\{n/.test(st), 'Structure\'s bars');

// 30: a day says only the day; what it is of stands after the words (Journal in a tag's mono), so no list's day column widens.
const sh = read('threads/parts/shared.js');
assert.ok(!/th-ol-dfrom/.test(sh) && /from: day =>/.test(sh), 'the day column holds the day alone');
assert.ok(/const fromWidth = \(\) => 0;/.test(read('threads/parts/two-way.js')), 'no list widens its day column');
for (const f of ['threads/parts/two-way.js', 'threads/parts/two-way/dig.js', 'threads/parts/two-way/beside.js']) assert.ok(/O\.from\(/.test(read(f)), f + ' says what a day is of after the words');

// 32: one nothing-here line, the library's, at the top of every sidebar tab; Links shows its two orders only with something to order.
const links = read('look/logseq/links.js');
assert.ok((links.match(/lk-links-none lk-none/g) || []).length === 4, 'Links and Endnotes: the library\'s nothing-here line');
assert.ok(links.indexOf("return [el(doc, 'div', { class: 'lk-links-none lk-none' }, 'No links") < links.indexOf("const body = [el(doc, 'div', { class: 'lk-views' }"), 'no views above nothing');
assert.ok(/<p class="st-insp-none lk-none">\$\{say\}/.test(read('structure/logseq/inspector.js')), 'the inspector\'s nothing-here line');

// 33: no hairline between Linked's kinds, space alone; a comma between the tags in Structure's table (the owner, 10 November 2026:
// "just put a comma", "in the table").
const look = read('threads/parts/two-way/look.js');
assert.ok(/\.th-tw-head \.th-tw-sep \{ display: none; \}/.test(look) && !/content: ",";/.test(look), 'Linked\'s kinds: space alone, no hairline, no comma');
assert.ok(/const ranges = ids => ids\.slice\(0, 3\)\.map\(tagLink\)\.join\('<span class="to sp">, <\/span>'\)/.test(st), 'Structure\'s tags: a comma between them');

// 34: the Linked heading in the size and weight of Logseq's Unlinked references.
assert.ok(/\.th-tw-whole-name \{ color: inherit; font-size: 14px; font-weight: 500;/.test(look), 'Linked: Logseq\'s heading size');

// 35 and 38: Find's small name above its values; the sentence's nothing-here line where the sentence starts.
const find = read('find/logseq/find.js');
assert.ok(/\.fd-ch \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/.test(find), 'Find: the name above its values');
assert.ok(/\.fd-say :is\(\.fd-none, \.fd-wait\) \{ padding-left: 0; \}/.test(find), 'Find by sentence: nothing here at the left edge');

// 36: pencilled values on one line, centred as Logseq's own pills.
assert.ok(/\.positioned-properties\.flow-made \.bottom-properties-row \{ display: flex; flex-wrap: wrap; align-items: center;/.test(read('predictive/logseq/propose-ui.js')), 'Predictive: the pills on one line');

// 37: a tag stays beside the words in a narrow pane while the words keep half of it.
assert.ok(/> \.block-content-wrapper \{ flex: 1 1 min\(20em, 50%\);/.test(read('look/logseq/style.js')), 'a tag beside the words in the right sidebar');

console.log('one-look: every check passed (27, 28, 30, 32 to 38; 31 in structure/test/load.js; 39 was Logseq\'s)');
