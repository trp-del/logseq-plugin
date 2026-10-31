/* node test/load.js
   Loads the plugin's browser files, in files.js's order, against a stand-in for Logseq (a fake `logseq`, a fake window).
   It cannot show that the plugin works inside Logseq 2.0.2 (only running it there can), but it does show that every file
   parses, that they find each other in order, that the adapter turns Logseq-shaped query rows into the core's data, and that
   the whole path from "read the graph" to "propose" works on those rows. The rows have the shapes the original plugin's
   readers (parts/model.js) were written against. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { root, order } = require('../../test/module.js')('predictive');
const listeners = [], styles = {}, commands = [], shown = [], palette = {};

// A tiny graph in the shapes Logseq's datascript queries return.
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tag = (id, name) => ({ 'db/id': id, 'block/uuid': U(id), 'block/title': name, 'db/ident': `user.class/${name}`, 'block/tags': [{ 'db/id': 1, 'block/title': 'Tag', 'db/ident': 'logseq.class/Tag' }] });
const person = (id, name) => ({ 'db/id': id, 'block/uuid': U(id), 'block/title': name, 'block/tags': [{ 'db/id': 10, 'block/title': 'Person', 'db/ident': 'user.class/Person' }] });
const pages = [tag(10, 'Person'), tag(11, 'Visit'), person(20, 'Dr. Mei Chen'), person(21, 'Ruth Okoro')];
const doctorProp = { 'db/id': 100, 'db/ident': 'user.property/doctor', 'block/uuid': U(100), 'block/title': 'Doctor', 'logseq.property/type': 'node', 'db/cardinality': 'db.cardinality/one', 'logseq.property/classes': [{ 'db/id': 10, 'block/uuid': U(10), 'block/title': 'Person' }] };
const visits = [
  { 'db/id': 300, 'block/title': `Saw [[${U(20)}]] about the tingling in my fingers`, 'block/tags': [{ 'db/id': 11 }], 'user.property/doctor': [{ 'db/id': 20 }] },
  { 'db/id': 301, 'block/title': `Saw [[${U(20)}]] about the tingling again`, 'block/tags': [{ 'db/id': 11 }], 'user.property/doctor': [{ 'db/id': 20 }] },
  { 'db/id': 302, 'block/title': `Saw [[${U(21)}]] about a sprained ankle`, 'block/tags': [{ 'db/id': 11 }], 'user.property/doctor': [{ 'db/id': 21 }] },
];
const block = (text, over = {}) => ({ 'db/id': 400, 'block/uuid': U(400), 'block/title': text, 'block/tags': [{ 'db/id': 11 }],
  'block/page': { 'db/id': 500, 'block/uuid': U(500), 'block/title': 'Oct 28th, 2026', 'block/journal-day': 20261028, 'block/tags': [] }, ...over });

function fakeQuery(query) {
  const has = (...parts) => parts.every(p => query.includes(p));
  if (has('logseq.property/classes', 'logseq.class/Property')) return [[doctorProp]];
  if (has('closed-value-property')) return [];
  if (has('[?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]')) return [[10, ':user.class/Person'], [11, ':user.class/Visit'], [1, ':logseq.class/Root']];
  if (has('logseq.property.class/properties')) return [[11, 100]];
  if (has('logseq.property.class/extends')) return [];
  if (has(':block/name _')) return pages.map(p => [p]);
  if (has('[?p :block/name ?n]')) return pages.filter(p => query.includes(JSON.stringify(p['block/title'].toLowerCase()))).map(p => [p]);
  if (has('ground #{')) return visits.map(n => [n]);
  if (has('not [?b :block/tags _]')) return [[600, 'Bought bread and milk on the way home']];
  if (has('?o :block/alias ?a')) return [];
  if (has('[?p :block/journal-day ?d]')) return [[500, 20261028]];
  if (has('#uuid')) return [[block(`Saw [[${U(21)}]] today`)]];
  return [];
}
const doc = { activeElement: null, body: { append() {} }, documentElement: { classList: { toggle() {}, remove() {} } }, querySelectorAll: () => [], querySelector: () => null, defaultView: {
  addEventListener: (type, fn) => listeners.push(type), removeEventListener() {}, requestAnimationFrame: fn => 0, cancelAnimationFrame() {},
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } } } };
const window = { parent: { document: doc }, Flow: undefined };
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, updateSettings() {}, provideStyle: ({ key, style }) => { styles[key] = style; }, useSettingsSchema() {}, beforeunload() {},
  provideModel() {}, App: { registerCommandPalette: ({ key }, fn) => { commands.push(key); palette[key] = fn; }, registerUIItem() {}, onCurrentGraphChanged() {}, onRouteChanged() {}, getCurrentGraph: async () => ({ name: 'logseq_db_pretend' }), getUserConfigs: async () => ({ preferredDateFormat: 'MMM do, yyyy' }) },
  DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) },
  UI: { showMsg: m => shown.push(m) }, Editor: {},
};
const errors = [];
const quietConsole = { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); console.error(...a); } };
const sandbox = { window, logseq, document: { currentScript: null }, console: quietConsole, setTimeout, clearTimeout, Promise, URL, performance, Date, Map, Set, WeakMap, WeakSet };
window.window = window;
vm.createContext(sandbox);
for (const file of order) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });

(async () => {
  await new Promise(r => setTimeout(r, 50));   // main() runs after logseq.ready
  const Flow = window.Flow;
  assert.deepEqual(errors, [], 'main() started without an error');
  assert.ok(Flow.propose && Flow.profile && Flow.db && Flow.app && Flow.linkUi && Flow.proposeUi && Flow.steps, 'every part registered');
  assert.deepEqual(commands.sort(), ['flow-choose-tag', 'flow-reread', 'flow-score', 'flow-tune'], 'commands registered');
  assert.ok(listeners.includes('input') && listeners.includes('focusout'), 'listeners attached to Logseq\'s window');
  assert.ok(styles['flow-proposals'] && styles['flow-link-suggest'], 'styles sent');
  console.log('  ok  every file loads in order and main() starts');

  const ctx = await Flow.app.context();
  assert.equal(ctx.schema.props.length, 1);
  assert.equal(ctx.schema.props[0].title, 'Doctor');
  assert.deepEqual([...ctx.schema.classProps.get(11)], [100]);
  assert.equal(ctx.pages.length, 4);
  assert.equal(ctx.index.entries.length, 4, 'three visits and one plain line learned from');
  console.log('  ok  Logseq-shaped rows become a schema, pages and a learned index');

  const bullet = Flow.db.bulletOf(block(`Saw [[${U(21)}]] today`), `Saw [[Ruth Okoro]] today`, ctx.schema);
  assert.equal(bullet.page.day, 20261028); assert.deepEqual([...bullet.tags], [11]); assert.equal(bullet.parent, null);
  const linked = Flow.propose.propose(ctx, bullet).pieces.find(p => p.ident === 'user.property/doctor');
  assert.deepEqual([...linked.ids], [21]); assert.ok(!linked.guess);
  console.log('  ok  a pulled block becomes a bullet and a linked person fills Doctor');

  const words = Flow.db.bulletOf(block('Back to the doctor about the tingling in my fingers'), 'Back to the doctor about the tingling in my fingers', ctx.schema);
  const guess = Flow.propose.propose(ctx, words).pieces.find(p => p.ident === 'user.property/doctor');
  assert.deepEqual([...guess.ids], [20]); assert.ok(guess.guess);
  console.log('  ok  the doctor is guessed from what the earlier lines were about');

  // The settings window: no language row, and the eagerness specimen shows the choice by placement.
  assert.ok(!Flow.settingsSchema.some(s => s.key === 'locale'), 'no row for one language');
  assert.equal(Flow.app.state.ctx.reader.locale, Flow.dates.en, 'dates in words still read in English');
  const opened = sandbox.window.PluginDoor.described.predictive;
  const pencils = value => (opened.specimen({ key: 'tagEagerness' }, value).match(/lk-pencil/g) || []).length;
  assert.deepEqual(['careful', 'balanced', 'eager'].map(pencils), [0, 1, 2]);
  const lines = opened.specimen({ key: 'tagEagerness' }, 'eager').split('<br>');
  assert.ok(lines[0].includes('sandpaper') && lines[0].includes('lk-pencil') && lines[1].includes('bread') && lines[1].includes('lk-pencil'));
  assert.ok(!opened.specimen({ key: 'tagEagerness' }, 'balanced').split('<br>')[1].includes('lk-pencil'), 'balanced leaves the plain note alone');
  assert.ok(!opened.specimen({ key: 'proposals' }, false).includes('lk-pencil') && opened.specimen({ key: 'proposals' }, true).includes('lk-pencil'), 'the switches still read as on and off');
  console.log('  ok  the settings window: no language row, three eagerness specimens');

  // Option-Enter: the pencil stays while the list is open and Logseq's empty value is back, unseen, for the list to sit under.
  const css = styles['flow-proposals'];
  assert.ok(!css.includes('${'), 'the stylesheet is written out in full');
  assert.ok(/\.bottom-property-pill\.bottom-property-pill\[data-flow-at\]::after \{ inset: -2px 0 !important;/.test(css), 'the ring while the list has the keyboard');
  assert.ok(/ ~ \.bottom-property-pill\.bottom-property-pill\[data-flow-at\]::after \{ left: 16px/.test(css), 'the ring leaves the dot outside');
  assert.ok(!/\[data-flow-at\] \.flow-ghost \{ display: none/.test(css), 'the guess no longer steps aside for the list');
  assert.ok(/\[data-flow-at\]:not\(:has\(input, textarea\)\) \.empty-value \{ position: absolute; opacity: 0;/.test(css));
  console.log('  ok  the pencil stays under an open list');

  const same = await Flow.db.pagesNamed(['dr. mei chen']);
  assert.equal(same.length, 1);
  assert.equal(await Flow.app.allowed(), true);
  console.log('  ok  fresh page lookup and the per-graph switch');
  process.exit(0);
})().catch(error => { console.error('FAIL ', error); process.exit(1); });
