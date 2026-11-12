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

// N6: a tab of the right sidebar can say it has nothing to show; Outline says so on a page with no headings, Item with no row pressed.
// Endnotes stand under Links (the owner, 12 November 2026) and have no heading on a page with no citations.
assert.ok(/filter\(v => !v\.hidden\?\.\(doc\)\)/.test(read('sidebar-tabs.js')), 'a hidden view has no tab');
const links = read('look/logseq/links.js');
assert.ok(/hidden: key === 'contents' \? \(\) => state\.read && !state\.heads\.length/.test(links), 'Outline is hidden on a page read and found without headings');
assert.ok(/if \(!state\.notes\.length\) return \[\];/.test(links) && !/key: 'notes'/.test(links), 'Endnotes are no tab: a heading under Links, absent without citations');
assert.ok(/key: 'item', word: 'Item'[\s\S]{0,400}hidden: \(\) => !S\.inspector\.row\(\)/.test(read('structure/logseq/mount.js')), 'Item has no tab with no row pressed');
assert.ok(/word: 'Opened'/.test(read('sidebar-tabs.js')) && /word: 'Outline'/.test(links), 'the tabs\' names: Opened, Outline');
assert.ok(/readNotes\(blocks\)/.test(links) && /const whole = state\.open\.links \|\| setting\('citationNumbers'\)/.test(links), 'the citations are read with both sections closed');

// N7: on a journal day the rows read what is scheduled or due first, and only then stand in for Linked references.
const tw = read('threads/parts/two-way.js');
assert.ok(/if \(state\.pageJournal\) groups = await duesGroups\(/.test(tw) && /state\.replaces = read && dues &&/.test(tw), 'a journal day: scheduled and due read, then the rows replace Linked references');
assert.ok(/async function duesOn\(day\)/.test(read('threads/parts/model.js')), 'the model reads what is scheduled or due on a day');

// N1, as the owner changed it on 12 November 2026: the pressed row has a tab of its own, Item; the tag's lines stay on Ontology.
const insp = read('structure/logseq/inspector.js'), view = read('structure/logseq/view.js');
assert.ok(/toggleAttribute\('data-row', !!insp\.uuid\)/.test(insp) && !/st-insp-about/.test(insp) && /function whereHtml/.test(insp) && /sideTabs\?\.pick\('item'\)/.test(insp), 'a row pressed picks Item; where it stands; no About line');
assert.ok(/#right-sidebar\[data-lk-tab="item"\] \.st-holder-insp\[data-row\] \.st-insp-top \{ display: none; \}/.test(view) && /#right-sidebar:not\(\[data-lk-tab="item"\]\) \.st-holder-insp\[data-row\] \.st-insp-node \{ display: none; \}/.test(view), 'Item shows the row alone, Ontology the lines alone');
assert.ok(/setAttribute\('data-lk-tab', tabs\.cur \|\| ''\)/.test(read('sidebar-tabs.js')), 'the sidebar says which tab is picked');

// N3: every find box lights the first match and Enter opens it.
assert.ok(/function lightFirst\(\)/.test(view) && /k === 'Enter'\) \{ e\.preventDefault\(\); if \(loc\.find\.trim\(\) && \(lightFirst\(\), lit\(\)\)\) openHere\(e\.shiftKey\)/.test(view), 'Structure\'s find box');
assert.ok(/event\.key === 'Enter'[^\n]*shared\.openEntity\(to\.dataset\.uuid, event\.shiftKey\)/.test(read('threads/parts/two-way/find.js')), 'Linked\'s find line');
assert.ok(/t === find && event\.key === 'Enter'/.test(read('settings/window.js')), 'the settings\' find box');

console.log('leftovers: every check passed (N1, N3 to N7)');
