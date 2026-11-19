/* The audit's last items (reports/changes-to-make.md, N1 to N7 of 12 November 2026): each check fails if a piece taken out comes
   back or a piece built goes. Run from the plugin's folder: node test/leftovers.js */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const all = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (/node_modules|test|tools|dist/.test(e.name) ? [] : all(path.join(dir, e.name))) : /\.js$/.test(e.name) ? [path.join(dir, e.name)] : []);
const code = ['threads', 'structure', 'export', 'look', 'find', 'settings', 'predictive'].flatMap(all).map(f => [f, read(f)]);
const nowhere = (words, why) => { const at = code.filter(([, text]) => text.includes(words)).map(([f]) => f); assert.deepStrictEqual(at, [], `${why}: still in ${at.join(', ')}`); };

// N4: the three things taken out stay out, with everything that only they used.
nowhere('Keep this view', '"Keep this view" was taken out (55)');
nowhere('thTwoWayViews', 'the kept views went with "Keep this view"');
nowhere('th-tw-views', 'the kept views\' line has no look left');
nowhere('Export list', '"Export list…" was taken out (56)');
nowhere('structure-sidebar', 'the old tree command was taken out (57)');
assert.ok(!/registerSidebarRenderer\(SIDEBAR_KEY/.test(read('structure/logseq/mount.js')), 'the old tree has no panel in the right sidebar');

// N5: the plugin's export says what it makes, in the page's menu and a bullet's.
const exp = read('export/main.js');
assert.ok((exp.match(/'PDF or Markdown, your styles…'/g) || []).length === 2 && !exp.includes('Export as PDF or Markdown'), 'the export\'s menu item is named apart from Logseq\'s Export page');
assert.ok(read('settings/ways-in.js').includes("'PDF or Markdown, your styles…'"), 'its icon follows the name');

// N6: a section of the right sidebar can say it has nothing to show; Outline says so on a page with no headings, Item with no row pressed.
// Endnotes stand under Links (the owner, 12 November 2026) and have no heading on a page with no citations.
const links = read('look/logseq/links.js');
assert.ok(/if \(!state\.notes\.length\) return \[\];/.test(links) && !/key: 'notes'/.test(links), 'Endnotes are no tab: a heading under Links, absent without citations');
/* The sidebar as Logseq's stacked sections (the owner, 17 November 2026): Ontology, Item and Outline are the page's parts, opened by
   themselves where they apply and without ×; Links and Todo only when opened; the last thing you opened closed, the sidebar closes. */
assert.ok(/insp\.applies = !plain/.test(read('structure/logseq/inspector.js')), 'the page read says whether Ontology applies');
/* Proved in the real Logseq since 18 November 2026 by tools/app-checks/sidebar-sections.js (a release gate, tools/release-app-check.js),
   which replaced the source matches that stood here: a part with nothing to show stands aside; Outline only on a page with headings;
   Ontology only on a tag's or a property's page; Ontology and Outline are parts of the page, opened by themselves; the last thing you
   opened closed by its ×, the sidebar closes; Todo's toolbar button opens it in the sidebar; a blank sidebar closes and opens again
   where a part applies. What it does not press (the command palette, a part's missing ×) stays matched below. */
const stack = read('sidebar-tabs.js');
assert.ok(/if \(sidebarOpen\(\)\) for \(const view of parts\)/.test(stack) && /\[data-lk-part\] \.sidebar-item-header \.item-actions \{ display: none !important; \}/.test(stack), 'a part opens by itself only in an open sidebar, and has no ×');
assert.ok(/addMenuItem\?\.\(\{ key: 'links', label: 'View links'/.test(read('look/logseq/links.js')) && /label: 'View links' \}, viewLinks/.test(read('look/logseq/links.js')), 'Links opens from View links, in the ··· menu and the command palette');
// The row view (the owner, 17 November 2026): a toolbar button; only then does a press on a table row show it. Since 19 November 2026
// (A of bullets-sidebar-rowview.html) the other sections stay, folded to their heads at the sidebar's foot, at most four, then
// "and N more"; folded once as the view comes on and opened again as it goes, marked on Logseq's element so a plugin reload heals.
// Proved in the real Logseq by tools/app-checks/row-view.js (a release gate): the row view is a toolbar button and a row shows only
// while it is on; a pressed row opens Logseq's own view of its node, "N of M".
assert.ok(/\[data-lk-rows\] \.sidebar-item-list > \.sidebar-item\[data-lk-over\] \{ display: none !important; \}/.test(stack) && /const FOOT_MAX = 4;/.test(stack) && /if \(st\.rows && st\.foldDue\)/.test(stack) && /data-lk-rows-folded/.test(stack), 'in the row view the other sections stay as heads at the foot, at most four, folded once as the view comes on and opened again as it goes');
assert.ok(/key: 'item', word: 'Item'[\s\S]{0,400}hidden: \(\) => !S\.inspector\.row\(\)/.test(read('structure/logseq/mount.js')), 'Item has no tab with no row pressed');
assert.ok(/word: 'Outline'/.test(links), 'Outline is named so');
assert.ok(/readNotes\(blocks\)/.test(links) && /const whole = state\.open\.links \|\| setting\('citationNumbers'\)/.test(links), 'the citations are read with both sections closed');

// N7: on a journal day the rows read what is scheduled or due first, and only then stand in for Linked references.
const tw = read('threads/parts/two-way.js');
assert.ok(/if \(state\.pageJournal\) groups = await duesGroups\(/.test(tw) && /\breplaces = read && dues &&/.test(tw), 'a journal day: scheduled and due read, then the rows replace Linked references');
assert.ok(/async function duesOn\(day\)/.test(read('threads/parts/model.js')), 'the model reads what is scheduled or due on a day');

// N1, as the owner changed it on 12 November 2026: the pressed row has a tab of its own, Item, and that tab is Logseq's own view of
// the row's node, so it is edited there ("make Item pane fully editable"); the read-only copy is gone. The row keeps a blue outline.
const insp = read('structure/logseq/inspector.js'), view = read('structure/logseq/view.js');
assert.ok(!/function drawNode|function outline|st-insp-words/.test(insp + view), 'no read-only copy of the node is drawn');
assert.ok(/insp\.openedKeys\.add\(wanted\(\)\)/.test(insp) && /!insp\.openedKeys\.has\(key\) \|\| keep\.has\(key\)\) continue;/.test(insp) && /function closeStale/.test(insp) && /if \(uuid && !active\(\)\) return;/.test(insp), 'only an item the plugin opened is closed; with the sidebar shut or on another tab a press is Logseq\'s');
assert.ok(/find: doc => S\.inspector\.item\(doc\)/.test(read('structure/logseq/mount.js')), 'the Item tab is that view');
assert.ok(/\.ls-table-row\[data-st-picked\]::after \{[^}]*border: 1\.5px solid var\(--lk-picked\)/.test(view) && /--lk-picked: var\(--rx-blue-09/.test(read('plugin.js')), 'the row shown keeps a blue outline');

// N3: every find box lights the first match and Enter opens it.
assert.ok(/function lightFirst\(\)/.test(view) && /k === 'Enter'\) \{ e\.preventDefault\(\); if \(st\.find\.trim\(\) && \(lightFirst\(\), lit\(\)\)\) openHere\(e\.shiftKey\)/.test(view), 'Structure\'s find box');
assert.ok(/event\.key === 'Enter'[^\n]*shared\.openEntity\(to\.dataset\.uuid, event\.shiftKey\)/.test(read('threads/parts/two-way/find.js')), 'Linked\'s find line');
assert.ok(/t === find && event\.key === 'Enter'/.test(read('settings/window.js')), 'the settings\' find box');

console.log('leftovers: every check passed (N1, N3 to N7)');
