/* Todo's groupings, outside Logseq: Day, Page, Tag, Priority, Status, each in day order, Done at the foot; the "By day" word and
   the library's menu that changes it. Run from the plugin's folder or this one: node todo/test/group.js (needs jsdom: NODE_PATH). */
const path = require('node:path'), assert = require('node:assert');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.parent = window;
const settings = {}, saved = [];
global.logseq = window.logseq = {
  settings, updateSettings: v => { saved.push(v); Object.assign(settings, v); },
  onSettingsChanged: () => () => {}, DB: { onChanged: () => () => {} }, App: { onCurrentGraphChanged: () => () => {}, registerCommandPalette() {} },
  Experiments: {}, UI: { showMsg() {} },
};
require(path.join(ROOT, 'plugin.js'));
const Door = window.PluginDoor;
Door.register = () => {};
for (const f of ['todo/logseq/db.js', 'todo/logseq/view.js', 'todo/main.js']) require(path.join(ROOT, f));
const T = window.Todo, app = T.app, today = Door.dates.today();
const day = n => { const d = Door.dates.date(today); d.setDate(d.getDate() + n); return Door.dates.number(d); };
let n = 0;
const task = (words, more = {}) => ({ id: ++n, uuid: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`, raw: words, words, status: 'todo', day: 0, page: { title: 'Dr. Mei Chen', journal: 0 }, tags: [], priority: '', created: n, updated: n, ...more });
app.tasks = [
  task('Ask about the fatigue', { day: day(-2), page: { title: 'Nov 11th, 2026', journal: day(-2) }, tags: ['Consultation'], priority: 'high' }),
  task('Book the scan', { day: day(3), tags: ['Consultation', 'Scan'], priority: 'urgent', status: 'doing' }),
  task('Read the report', { page: { title: 'blood report', journal: 0 } }),
  task('Call the pharmacy', { day: day(0), page: { title: 'Nov 13th, 2026', journal: day(0) }, priority: 'low' }),
  task('Sent the letter', { status: 'done', updated: Date.now() }),
];
app.read = true;
const heads = () => app.groups().parts.map(p => [p.head, p.rows.map(t => t.words)]);

assert.equal(app.by(), 'Day', 'Day by default');
assert.deepEqual(heads(), [['Today', ['Ask about the fatigue', 'Call the pharmacy']], ['Coming up', ['Book the scan']], ['Any time', ['Read the report']]]);
assert.deepEqual(app.groups().done.map(t => t.words), ['Sent the letter'], 'Done at the foot');

app.setBy('Page');
assert.deepEqual(saved.at(-1), { todoGroupBy: 'Page' }, 'the choice is kept in the settings');
assert.deepEqual(heads(), [['blood report', ['Read the report']], ['Dr. Mei Chen', ['Book the scan']], ['Journals', ['Ask about the fatigue', 'Call the pharmacy']]], 'pages A to Z, case aside, Journals last');
assert.equal(app.groups().parts[1].where, false, 'a page group does not repeat its page under each row');
assert.equal(app.groups().parts[2].where, true, 'Journals says which day each row is on');

app.setBy('Tag');
assert.deepEqual(heads(), [['Consultation', ['Ask about the fatigue', 'Book the scan']], ['Scan', ['Book the scan']], ['No tag', ['Call the pharmacy', 'Read the report']]], 'a task under each tag, No tag last');

app.setBy('Priority');
assert.deepEqual(heads(), [['Urgent', ['Book the scan']], ['High', ['Ask about the fatigue']], ['Low', ['Call the pharmacy']], ['No priority', ['Read the report']]], 'Urgent to Low, empty ones left out');

app.setBy('Status');
assert.deepEqual(heads(), [['Doing', ['Book the scan']], ['Todo', ['Ask about the fatigue', 'Call the pharmacy', 'Read the report']]]);

// The view: the word says the grouping; the menu is the library's, its check on the one in force; a line taken regroups.
const holder = document.createElement('div'); document.body.append(holder);
const view = T.view.make(holder, 'page');
const by = holder.querySelector('[data-by]');
assert.ok(by.classList.contains('lk-change'), 'the word is the library’s lk-change');
assert.equal(by.textContent.trim(), 'By status');
assert.ok(holder.querySelector('.td-day.lk-day'), 'the day is the library’s lk-day');
assert.ok(holder.querySelector('.td-fold-head .lk-note'), 'Done’s count is the library’s faint note');
by.click();
const menu = document.querySelector('.lk-pop.lk-menu');
assert.ok(menu, 'the library’s menu opens');
assert.equal(menu.querySelector('.lk-group').textContent, 'Group by');
assert.deepEqual([...menu.querySelectorAll('.lk-item')].map(b => b.textContent), ['Day', 'Page', 'Tag', 'Priority', 'Status']);
assert.equal(menu.querySelector('.lk-check').closest('.lk-item').textContent, 'Status', 'the check on the one in force');
assert.equal(document.activeElement.textContent, 'Status', 'the keys start on the one in force');
menu.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
assert.equal(document.activeElement.textContent, 'Day', 'Down walks round');
menu.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
assert.equal(document.querySelector('.lk-pop'), null, 'Enter takes it and closes the menu');
assert.equal(app.by(), 'Day');
assert.equal(by.textContent.trim(), 'By day');
assert.deepEqual([...holder.querySelectorAll('.td-head')].map(h => h.textContent), ['Today', 'Coming up', 'Any time', 'Done1']);
assert.equal(document.activeElement, by, 'the keys go back to the word');
by.click(); document.querySelector('.lk-pop').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(document.querySelector('.lk-pop'), null, 'Escape closes it');
assert.equal(app.by(), 'Day', 'Escape changes nothing');
by.click(); by.click();
assert.equal(document.querySelector('.lk-pop'), null, 'pressing the word again closes it');
by.click(); document.body.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
assert.equal(document.querySelector('.lk-pop'), null, 'a press elsewhere closes it');
view.destroy();

// No open task in a grouping other than Day: one nothing-here line.
app.tasks = app.tasks.filter(t => t.status === 'done'); app.setBy('Tag');
const empty = document.createElement('div'); document.body.append(empty); T.view.make(empty, 'side');
assert.equal(empty.querySelector('.lk-none').textContent, 'Nothing to do.');

// The library's pieces: the heads are its small faint name (lk-name), as Find's; the page under a row and the day the add line
// reads are its quiet line (lk-note); the add line is its field (lk-field), with no hairline of Todo's own.
app.setBy('Day'); app.tasks.push(task('Phone the clinic', { day: day(0) }));
const lib = document.createElement('div'); document.body.append(lib); T.view.make(lib, 'side');
assert.ok([...lib.querySelectorAll('.td-head')].every(h => h.classList.contains('lk-name')), 'every heading is the library’s lk-name');
assert.ok(lib.querySelector('.td-where').classList.contains('lk-note') && lib.querySelector('.td-when').classList.contains('lk-note'), 'the page line and the day line are lk-note');
assert.ok(lib.querySelector('.td-add').classList.contains('lk-field'));
const css = document.getElementById('td-style')?.textContent || [...document.querySelectorAll('style')].map(x => x.textContent).join('');
assert.ok(!/\.td-add[^{]*\{[^}]*border-bottom-color/.test(css), 'the field’s hairline is the library’s');
assert.ok(!/\.td \.lk-none/.test(css) && !/\.td-head \.lk-tag/.test(css), 'the nothing-here line and the tag are the library’s as drawn');

// A sidebar panel Logseq kept while the plugin stopped (a reload, an update) is drawn again at start: never a blank panel.
const kept = document.createElement('div'); kept.className = 'td-holder td-holder-side'; document.body.append(kept);
const reread = app.reread; app.reread = async () => {};   // the graph is not read here
T.adopt();
assert.ok(kept.querySelector(':scope > .td .td-add') && kept.querySelector('.td-head'), 'the kept panel has its add line and its list');
const count = app.views.size; T.adopt();
assert.equal(app.views.size, count, 'a panel already drawn is not drawn twice');
app.reread = reread;

// Not read yet: the add line alone; a read that failed says so in a plain line where the list stands.
app.read = false; app.failed = 'Logseq did not answer';
const failed = document.createElement('div'); document.body.append(failed); T.view.make(failed, 'side');
assert.ok(failed.querySelector('.td-add'), 'the add line stands');
assert.equal(failed.querySelector('.td-list .lk-none').textContent, 'The tasks could not be read: Logseq did not answer.');
console.log('todo groupings ok');
