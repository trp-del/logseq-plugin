/* node test/review.js
   The production review of 12 November 2026: each check fails if one of its fixes goes back. What moves on screen is checked in
   the real Logseq by tools/view-change-check.js; this holds the rules in place without the app. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
global.window = { addEventListener() {} };
require(path.join(ROOT, 'files.js'));
const SHIP = global.window.PluginFiles.filter(f => !/vendor\//.test(f));
require(path.join(ROOT, 'plugin.js'));
const Door = global.window.PluginDoor;

// 1. The Item tab never stands blank: the row shown before stays until the new row's view is drawn, and the tabs know both.
const insp = read('structure/logseq/inspector.js'), tabs = read('sidebar-tabs.js');
assert.ok(/const now = items\.find\(i => holds\(i\) && drawn\(i\)\);/.test(insp) && /const keyOf = item =>/.test(insp), 'the Item tab shows the new row only once it is drawn, and knows an item by the node it holds, never by its element');
assert.ok(/const owns = el => \{ const key = keyOf\(el\); return key \? insp\.openedKeys\.has\(key\)/.test(insp), 'the items coming and going are the Item tab\'s own');
assert.ok(/v\.owns\?\.\(item\)/.test(tabs), 'the sidebar\'s tabs leave a view\'s own waiting items out of "Opened"');
assert.ok(/\.sidebar-item-list > \.sidebar-drop-indicator \{ display: none !important; \}/.test(tabs), 'a hidden item coming or going does not move the one shown');
assert.ok(/settling && lines/.test(insp), 'the Ontology tab\'s hint line holds while a tag\'s page loads');

// 2. A property on a wrapped line is moved left only when it has the space it is moved by; an empty property is told by the stylesheet.
const style = read('look/logseq/style.js'), props = read('look/logseq/props.js');
assert.ok(!/\.bottom-property-pill\[data-lk-line\] \{ transform/.test(style.replace(/\$\{FILLED\} ~ \.bottom-property-pill\[data-lk-line\]/g, '')), 'the shift of a wrapped property applies only after a filled one');
assert.ok(/EMPTY_ROWS = `[^`]*:has\(> \.property-value-container :is\(\.is-blank, \.empty-value\)\)/.test(style) && !/lk-empty/.test(style + props), 'an empty property is faint from the first frame, by the stylesheet alone');

// 3. Ontology: labels and values on one baseline, room in a narrow sidebar, areas of one width, no word broken inside.
const view = read('structure/logseq/view.js');
assert.ok(/\.st-lines-t \{[^}]*align-items: baseline/.test(view), 'a label and its value share a baseline');
assert.ok(/\.st-lines-t dd \.lk-btn \{ align-items: baseline; \}/.test(view), 'a press with an icon stands on its words\' baseline');
assert.ok(/@container \(max-width: 360px\)/.test(view) && /\.st-holder-insp \{ container-type: inline-size; \}/.test(view), 'a narrow sidebar stacks each label over its value');
assert.ok(/\.st-regions \{[^}]*display: grid; grid-template-columns: repeat\(auto-fill, minmax\(232px, 1fr\)\)/.test(view), 'the map\'s areas are one width');
assert.ok(/\.st-tbl td, \.st-lines-t dd, \.st-rel, \.st-ln \{ word-break: normal; overflow-wrap: break-word; \}/.test(view) && /class="to and">and/.test(view) && /\.st-regions \.st-row \.nm \{ word-break: normal; overflow-wrap: break-word; \}/.test(view), 'no word breaks inside itself');

// 4. Small ones: the export window's ×, the key sheet's grid, the + keeping its room.
assert.ok(/\.xp-bar \.g\.end \{[^}]*align-items: center/.test(read('export/logseq/ui.js')), 'the export window\'s × stands on the buttons\' line');
const keys = read('look/logseq/keys.js');
assert.ok(/\.lk-ks-group \{ break-inside: avoid; padding-bottom: 32px; \}/.test(keys) && /\.lk-ks-head \{[^}]*line-height: 24px; padding: 4px 0; margin: 0; \}/.test(keys), 'the key sheet\'s lines stand on one 32 px grid');
assert.ok(/th-tw-add-room/.test(read('threads/parts/two-way.js')) && /\.th-tw-add-room \{ visibility: hidden; pointer-events: none; \}/.test(read('threads/parts/two-way/look.js')), 'the + keeps its room while its add line is open');

// 4b. The export window's preview is drawn unseen and swapped in when laid out; the Item tab is picked only once it has something to show.
assert.ok(/next\.style\.visibility = 'hidden'[\s\S]{0,900}next\.srcdoc = html/.test(read('export/logseq/ui.js')) && /swap\(\); fit\(\); setTimeout\(fit, 300\)/.test(read('export/logseq/ui.js')), 'the export preview never stands empty between two drawings');
assert.ok(/insp\.pickedFor !== insp\.ask/.test(insp), 'the Item tab is picked when the row has a view');

// 5. Notices: never a raw error; a one-sentence notice has no full stop; "bullet", not "block".
const problems = [];
for (const f of SHIP) read(f).split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/(?:notify|showMsg)\((?:`[^`]*`|'[^']*'[^,)]*)/g)) {
    const said = m[0];
    if (/\$\{\s*(?:error|e|failures\[0\])\??\.message\s*\}|\+ \(?error\??\.message/.test(said)) problems.push(`a raw error in a notice: ${f}:${i + 1}`);
    if (/\bblock\b/i.test(said.replace(/\$\{[^}]*\}/g, ''))) problems.push(`"block" in a notice (say bullet): ${f}:${i + 1}`);
    const one = said.match(/^(?:notify|showMsg)\((['`])((?:(?!\1).)*)\.\1$/);
    if (one && !one[2].includes('. ') && !one[2].includes('\\n')) problems.push(`a one-sentence notice ends with a full stop: ${f}:${i + 1}`);
  }
});
assert.deepStrictEqual(problems, [], problems.join('\n'));
assert.strictEqual(Door.reason(new TypeError("Cannot read properties of undefined (reading 'x')"), 'plain words'), 'plain words', 'a technical error is said in plain words');
assert.strictEqual(Door.reason(new Error('A page named “Mei” is already there.'), 'plain words'), 'A page named “Mei” is already there', 'the plugin\'s own reason is said as it is');
assert.strictEqual(Door.reason(null, 'plain words'), 'plain words');

// 6. Find shows what it read before while it reads again, reads once at the start, and shows nothing of another graph.
const find = read('find/logseq/find.js');
assert.ok(/S\.again = \{ kinds: S\.kinds\.length > 0/.test(find) && /async function warm\(\)/.test(find) && /if \(whole\) \{ S\.kinds = \[\]; S\.tree = null; S\.recents = \[\]/.test(find), 'Find\'s window is never empty while the graph is read again');
assert.ok(/Find\.window\.forget\(true\)/.test(read('find/main.js')), 'another graph forgets everything Find read');

// 6b. Linked reads the page's other names before its rows are drawn; the Ontology tab says no line before the page is known.
assert.ok(/const names = ownNamesOf\(page\.id, false\)[\s\S]{0,260}await names;/.test(read('threads/parts/two-way.js')), 'an alias in a row is plain from the first drawing');
assert.ok(/if \(settling && !lines && !table && !insp\.plain\) return;/.test(insp) && /S\.inspector\.pageKnown\?\.\(id == null && prop == null\)/.test(read('structure/main.js')), 'the Ontology tab\'s line is not said before the page is known');

// 7. Old words stay out of what a person reads.
for (const [f, re, what] of [['look/README.md', /the Contents tab/, 'the Contents tab'], ['predictive/logseq/app.js', /prefix: 'Flow: '/, 'Flow'], ['threads/parts/diagnostics.js', /th-tag-path/, 'a mark nothing draws']])
  assert.ok(!re.test(read(f)), `${what} is still in ${f}`);
console.log('review: all checks passed');
