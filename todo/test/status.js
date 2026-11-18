/* Todo's statuses, outside Logseq, on a small stand-in graph. The circle's list: every status with its icon, the one in force
   checked, the keys walk it; Doing keeps the row, Canceled takes it away, each with an Undo back to exactly what was there.
   A node tagged with a tag under Task (two levels down) whose Status is empty: Todo lists it as Todo, writing nothing; ticking it
   writes Done; its Undo empties the Status again, never writes Todo. A node with a Status and no Task tag stays listed; a node
   tagged with a tag outside Task stays out, and so does a bullet with no words, with a Status or without. 
   Run from the plugin's folder or this one: node todo/test/status.js (needs jsdom: NODE_PATH). */
const path = require('node:path'), assert = require('node:assert');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.parent = window;

// The stand-in graph: Task (10) ⟵ Symptom check (11) ⟵ ZZ check (12); Consultation (13) stands outside Task.
const TASK = 10, STATUS_IDS = { backlog: 199, todo: 200, doing: 201, 'in-review': 203, done: 202, canceled: 204 };
const TITLES = { backlog: 'Backlog', todo: 'Todo', doing: 'Doing', 'in-review': 'In Review', done: 'Done', canceled: 'Canceled' };
const nameOf = title => Object.keys(TITLES).find(k => TITLES[k] === title);
const tags = { 10: 'Task', 11: 'Symptom check', 12: 'ZZ check', 13: 'Consultation' };
const extendsOf = [[11, 10], [12, 11]];
const uuidOf = id => `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`;
const nodes = new Map([
  [100, { words: 'ZZ ask about the fatigue', tags: [12], status: null }],   // a child tag of a child tag of Task, Status empty
  [101, { words: 'Book the scan', tags: [TASK], status: 'todo' }],
  [102, { words: 'Called the clinic', tags: [], status: 'doing' }],          // a Status, no Task tag: listed as before
  [103, { words: 'Notes from the consultation', tags: [13], status: null }],  // a tag outside Task: not a task
  [104, { words: '', tags: [TASK], status: null }],                          // no words: never a blank row
  [105, { words: '  ', tags: [], status: 'todo' }],                           // no words, with a Status: left out too
]);
const writes = [];
const idOfUuid = u => [...nodes.keys()].find(id => uuidOf(id) === u);
const ground = q => (q.match(/\(ground \[([\d ]*)\]\)/) || [, ''])[1].split(' ').filter(Boolean).map(Number);

function ask(q) {
  if (q.includes(':logseq.property.class/extends ?p')) return extendsOf;
  if (q === '[:find ?t :where [?t :db/ident :logseq.class/Task]]') return [[TASK]];
  if (q.includes('?v ?ident ?t ?o ?icon') && q.includes(':logseq.property/priority')) return [['low', 301], ['medium', 302], ['high', 303], ['urgent', 304]].map(([k, id], i) => [id, `logseq.property/priority.${k}`, k[0].toUpperCase() + k.slice(1), `b${i}`, { type: 'tabler-icon', id: 'Flag' }]);
  if (q.includes(':logseq.property/priority ?v]')) { const n = nodes.get(idOfUuid(q.match(/#uuid "([^"]+)"/)[1])); return n.priority ? [[`p:${n.priority}`]] : []; }
  if (q.includes(':logseq.property/deadline ?v]')) { const n = nodes.get(idOfUuid(q.match(/#uuid "([^"]+)"/)[1])); return n.deadline ? [[n.deadline]] : []; }
  if (q.includes('?v ?ident ?t ?o ?icon')) return Object.entries(STATUS_IDS).map(([k, id], i) => [id, `logseq.property/status.${k}`, TITLES[k], `a${i}`, { type: 'tabler-icon', id: 'Circle', color: 'inherit' }]);
  if (q.includes('[:find ?id ?t :where [?s :block/closed-value-property')) return Object.entries(STATUS_IDS).map(([k]) => [`logseq.property/status.${k}`, TITLES[k]]);
  if (q.startsWith('[:find ?b ?u ?w ?sid')) return [...nodes].filter(([, n]) => n.status).map(([id, n]) => [id, uuidOf(id), n.words, `logseq.property/status.${n.status}`, id, id]);
  if (q.startsWith('[:find ?b ?u ?w ?c ?up')) { const g = ground(q); return [...nodes].filter(([, n]) => !n.status && n.tags.some(t => g.includes(t))).map(([id, n]) => [id, uuidOf(id), n.words, id, id]); }
  if (q.startsWith('[:find ?b ?pt ?jd')) return ground(q).map(b => [b, 'Dr. Mei Chen', 0]);
  if (q.startsWith('[:find ?b ?tt')) return ground(q).flatMap(b => nodes.get(b).tags.filter(t => t !== TASK).map(t => [b, tags[t]]));
  if (q.includes(':logseq.property/status ?v]')) { const n = nodes.get(idOfUuid(q.match(/#uuid "([^"]+)"/)[1])); return n.status ? [[STATUS_IDS[n.status]]] : []; }
  if (q.startsWith('[:find ?b :where [?b :block/uuid #uuid')) { const id = idOfUuid(q.match(/#uuid "([^"]+)"/)[1]); return id ? [[id]] : []; }   // the Undo arrow's node is still there
  if (q.startsWith('[:find ?v ?t')) return ground(q).map(v => [v, Object.keys(STATUS_IDS).find(k => STATUS_IDS[k] === v)]);
  return [];
}
const settings = {};
global.logseq = window.logseq = {
  settings, updateSettings: v => Object.assign(settings, v),
  onSettingsChanged: () => () => {}, DB: { onChanged: () => () => {}, datascriptQuery: async q => ask(q) }, App: { onCurrentGraphChanged: () => () => {}, registerCommandPalette() {} },
  Experiments: {}, UI: { showMsg() {} },
  Editor: {
    upsertBlockProperty: async (uuid, ident, value) => { writes.push(['set', uuid, ident, value]); const n = nodes.get(idOfUuid(uuid)); if (ident.endsWith('/status')) n.status = nameOf(value); else n[ident.split('/')[1]] = value; },
    removeBlockProperty: async (uuid, ident) => { writes.push(['unset', uuid, ident]); const n = nodes.get(idOfUuid(uuid)); if (ident.endsWith('/status')) n.status = null; else n[ident.split('/')[1]] = null; },
  },
};
require(path.join(ROOT, 'plugin.js'));
const Door = window.PluginDoor;
Door.register = () => {};
for (const f of ['todo/logseq/db.js', 'todo/logseq/view.js', 'todo/main.js']) require(path.join(ROOT, f));
const T = window.Todo, app = T.app;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  app.tasks = await T.db.read(); app.read = true;
  const by = words => app.tasks.find(t => t.words === words);
  assert.deepEqual(app.tasks.map(t => t.words).sort(), ['Book the scan', 'Called the clinic', 'ZZ ask about the fatigue'], 'a Task child-tag node with an empty Status is listed, a Status without Task stays, a tag outside Task and bullets with no words stay out');
  const zz = by('ZZ ask about the fatigue');
  assert.equal(zz.status, 'todo', 'an empty Status reads as Todo');
  assert.equal(zz.empty, true);
  assert.equal(by('Book the scan').empty, false);
  assert.deepEqual(zz.tags, ['ZZ check'], 'its own tag, for grouping by tag');
  assert.deepEqual(writes, [], 'reading writes nothing');

  app.setBy('Status');
  assert.deepEqual(app.groups().parts.map(p => [p.head, p.rows.map(t => t.words).sort()]), [['Doing', ['Called the clinic']], ['Todo', ['Book the scan', 'ZZ ask about the fatigue']]], 'it goes with Todo');
  app.setBy('Tag');
  assert.deepEqual(app.groups().parts.find(p => p.head === 'ZZ check')?.rows.map(t => t.words), ['ZZ ask about the fatigue'], 'grouped under its tag');

  // The view draws it with Todo's circle.
  const holder = document.createElement('div'); document.body.append(holder);
  const view = T.view.make(holder, 'page');
  const row = view.rows(zz.uuid)[0];
  assert.ok(row, 'drawn');
  assert.match(row.querySelector('.td-circle').getAttribute('aria-label') || row.querySelector('.td-circle').title || '', /Todo|Done/, 'a status circle');
  view.destroy();

  // Ticked: Done written. Undo: the Status emptied again, Todo never written.
  await app.setTo(zz.uuid, 'done');
  assert.deepEqual(writes, [['set', zz.uuid, 'logseq.property/status', 'Done']]);
  assert.equal(nodes.get(100).status, 'done');
  assert.ok(Door.undo.has('todo:1'), 'the one Undo is offered');
  await Door.undo.take('todo:1'); await wait(20);
  assert.deepEqual(writes.at(-1), ['unset', zz.uuid, 'logseq.property/status'], 'Undo removes the Status');
  assert.equal(nodes.get(100).status, null, 'empty again');
  assert.ok(!writes.some(([k, , , v]) => k === 'set' && v === 'Todo'), 'Todo is never written');
  assert.equal(app.shown(zz), 'todo', 'shown as Todo again');

  // A task that had Todo: its Undo writes Todo back, as before.
  const scan = by('Book the scan');
  await app.setTo(scan.uuid, 'done');
  await Door.undo.take('todo:2'); await wait(20);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/status', 'Todo']);

  // Changed since the tick: the Undo keeps it.
  app.tasks = await T.db.read();
  await app.setTo(zz.uuid, 'done');
  nodes.get(100).status = 'doing';
  const before = writes.length;
  await Door.undo.take('todo:3'); await wait(20);
  assert.equal(writes.length, before, 'changed since, nothing written');
  // The circle's list: the library's menu, every status in the graph's order with its own icon, the one in force checked.
  nodes.get(100).status = null;
  app.tasks = await T.db.read(); app.status.clear(); app.setBy('Day');
  const holder2 = document.createElement('div'); document.body.append(holder2);
  const v2 = T.view.make(holder2, 'page');
  const circleOf = u => v2.rows(u)[0]?.querySelector('[data-status-of]');
  const key = (k) => document.querySelector('.lk-door-menu').dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const lastUndo = () => Door.undo.keys().at(-1);
  circleOf(scan.uuid).click();
  let menu = document.querySelector('.lk-door-menu');
  assert.ok(menu, 'the press opens the list');
  assert.equal(menu.querySelector('.lk-group').textContent, 'Set Status');
  assert.deepEqual([...menu.querySelectorAll('.lk-item')].map(b => b.textContent), ['Backlog', 'Todo', 'Doing', 'In Review', 'Done', 'Canceled'], 'every status, in the graph’s order');
  assert.equal(menu.querySelectorAll('.lk-item .lk-item-icon .ti, .lk-item .lk-item-icon svg').length, 6, 'each with its own icon');
  assert.equal(menu.querySelector('.lk-check').closest('.lk-item').textContent, 'Todo', 'the one in force checked');
  assert.equal(document.activeElement.textContent, 'Todo', 'the keys start on it');
  key('ArrowDown'); key('Enter'); await wait(30);
  assert.equal(document.querySelector('.lk-door-menu'), null, 'Return takes it and closes the list');
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/status', 'Doing'], 'Doing written');
  assert.ok(circleOf(scan.uuid)?.title.startsWith('Doing'), 'the row stays, its circle Doing');
  assert.equal(document.activeElement, circleOf(scan.uuid), 'the keys stay on its circle');
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/status', 'Todo'], 'its Undo puts Todo back');

  // Canceled: the task leaves the list; its Undo brings the row back.
  circleOf(scan.uuid).click();
  [...document.querySelectorAll('.lk-door-menu .lk-item')].find(b => b.textContent === 'Canceled').click();
  await wait(30);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/status', 'Canceled']);
  assert.equal(v2.rows(scan.uuid).length, 0, 'gone from the list');
  assert.ok(Door.undo.has(lastUndo()), 'its Undo waits');
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/status', 'Todo'], 'Undo writes Todo back');
  assert.equal(v2.rows(scan.uuid).length, 1, 'the row is back');

  // A Task whose Status is empty: nothing checked; Doing written; Undo empties it again.
  circleOf(zz.uuid).click();
  assert.equal(document.querySelector('.lk-door-menu .lk-check'), null, 'nothing checked on an empty Status');
  [...document.querySelectorAll('.lk-door-menu .lk-item')].find(b => b.textContent === 'Doing').click();
  await wait(30);
  assert.equal(nodes.get(100).status, 'doing');
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['unset', zz.uuid, 'logseq.property/status'], 'Undo empties it, never Todo');
  assert.equal(nodes.get(100).status, null);

  // Escape closes the list and changes nothing.
  const count = writes.length;
  circleOf(scan.uuid).click(); key('Escape');
  assert.equal(document.querySelector('.lk-door-menu'), null);
  assert.equal(writes.length, count, 'Escape writes nothing');

  // The right-click menu's Priority and Deadline: written at once, each with its Undo back to exactly what was there.
  assert.deepEqual(T.db.priorities.map(p => p.title), ['Urgent', 'High', 'Medium', 'Low'], 'Priority’s values, Urgent first');
  const rightClick = u => v2.rows(u)[0].querySelector('.td-words').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const line = word => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(b => b.textContent === word);
  rightClick(scan.uuid);
  assert.equal(line('Remove priority'), undefined, 'no Remove line where there is no priority');
  line('High').click(); await wait(30);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/priority', 'High'], 'High written by its name');
  assert.equal(app.tasks.find(t => t.uuid === scan.uuid).priority, 'high', 'shown at once');
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['unset', scan.uuid, 'logseq.property/priority'], 'its Undo takes the priority off again');
  nodes.get(101).priority = 'Low'; app.tasks.find(t => t.uuid === scan.uuid).priority = 'low';
  rightClick(scan.uuid); line('Remove priority').click(); await wait(30);
  assert.deepEqual(writes.at(-1), ['unset', scan.uuid, 'logseq.property/priority']);
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/priority', 'Low'], 'Undo puts Low back');
  rightClick(scan.uuid); line('Tomorrow').click(); await wait(30);
  const tomorrow = (() => { const d = Door.dates.date(Door.dates.today()); d.setDate(d.getDate() + 1); return d.getTime(); })();
  assert.deepEqual(writes.at(-1), ['set', scan.uuid, 'logseq.property/deadline', tomorrow], 'the day’s start, as Logseq’s date picker writes it');
  assert.equal(v2.rows(scan.uuid)[0].closest('[data-group]').dataset.group, 'coming', 'the row now stands in Coming up');
  await Door.undo.take(lastUndo()); await wait(30);
  assert.deepEqual(writes.at(-1), ['unset', scan.uuid, 'logseq.property/deadline'], 'Undo takes the deadline off again ');
  assert.equal(v2.rows(scan.uuid)[0].closest('[data-group]').dataset.group, 'any', 'and the row is back in Any time');
  v2.destroy();
  console.log('todo statuses ok');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
