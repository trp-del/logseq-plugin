/* node test/load.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules)
   Loads the plugin's files, in files.js's order, against a stand-in for Logseq: a fake `logseq` whose queries answer in the
   shapes Logseq 2.0.2 returns (a small graph: the kinds Doctor and Consultation, Dr. Mei Chen, four consultations with
   their Provider and Topic), and a jsdom page. It walks the window from the keyboard: the kinds offered, "cons" lighting
   Consultation and Enter picking it, the choices under it, "mei" lighting Dr. Mei Chen, the rows narrowing, → digging into
   a row, Backspace widening, Escape closing; then that the stop sweeps everything. Only the real app shows the rest. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }

const { root, order } = require('../../test/module.js')('find');
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// ids: tags 1 Doctor, 2 Consultation, 3 Page (Logseq's), 4 Tag; pages 20 Dr. Mei Chen, 21 Dr. Sofia Alvarez, 22 Fatigue, 23 Tingling;
// journal pages 30..33 (days); consultation blocks 40..43; property value entities: the pages themselves.
const TAGS = [[1, 'Doctor', 'user.class/Doctor'], [2, 'Consultation', 'user.class/Consultation'], [3, 'Page', 'logseq.class/Page'], [4, 'Tag', 'logseq.class/Tag']];
const CARRIED = [[1, 20], [1, 21], [2, 40], [2, 41], [2, 42], [2, 43], [3, 20], [3, 21], [3, 22], [3, 23]];
const PAGES = { 20: 'Dr. Mei Chen', 21: 'Dr. Sofia Alvarez', 22: 'Fatigue', 23: 'Tingling fingers', 30: 'Oct 7th, 2026', 31: 'Sep 14th, 2026', 32: 'Sep 1st, 2026', 33: 'Aug 20th, 2026' };
const DAYS = { 30: 20261007, 31: 20260914, 32: 20260901, 33: 20260820 };
const BLOCKS = { 40: { title: `Video call with [[${U(20)}]] about the tingling`, page: 30, provider: 20, topic: 23 }, 41: { title: `Saw [[${U(20)}]] about the taste changes`, page: 31, provider: 20, topic: 22 },
  42: { title: 'Saw Dr. Mei Chen about not sleeping', page: 32, provider: 20, topic: 22 }, 43: { title: 'Dr. Sofia Alvarez on the scan dates', page: 33, provider: 21, topic: 23 } };
const PROPS = { provider: ['Provider', ':node'], topic: ['Topic', ':node'], specialty: ['Specialized in', ':node'] };
const idsIn = q => (q.match(/\(ground \[([0-9 ]+)\]\)/) || [, ''])[1].split(' ').filter(Boolean).map(Number);
const uuidsIn = q => [...q.matchAll(/#uuid "([0-9a-f-]+)"/g)].map(m => m[1]);
const idOfUuid = u => Number(u.slice(-12));
const titleOf = id => PAGES[id] || BLOCKS[id]?.title || '';
const log = [];
function fakeQuery(q) {
  log.push(q.slice(0, 60));
  const has = (...p) => p.every(x => q.includes(x));
  if (has(':logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title] [?t :db/ident ?ident]')) return TAGS.map(([id, t, i]) => [id, U(id), t, ':' + i]);
  if (has('logseq.property.class/extends ?p')) return [];
  if (has('[?b :block/tags ?t] [?t :block/tags :logseq.class/Tag]')) return CARRIED;
  const given = () => (q.includes('#uuid') ? uuidsIn(q).map(idOfUuid) : idsIn(q));
  if (has(':find ?b ?u ?title ?name :where')) return given().map(id => [id, U(id), titleOf(id), PAGES[id] ? titleOf(id).toLowerCase() : '']);
  if (has(':find ?b ?ptitle ?pday :where')) return given().filter(id => BLOCKS[id]).map(id => [id, PAGES[BLOCKS[id].page], DAYS[BLOCKS[id].page]]);
  if (has(':find ?b ?t :where') && has('[?b :block/tags ?t]')) { const ids = q.includes('#uuid') ? uuidsIn(q).map(idOfUuid) : idsIn(q); return CARRIED.filter(([, b]) => ids.includes(b)).map(([t, b]) => [b, t]); }
  if (has(':find ?b ?d :where') && has('[?b :block/journal-day ?d]')) return [];
  if (has(':find ?b ?d :where') && has(':logseq.property/type :date')) return [];
  if (has(':find ?u ?t :where') && has('[?r :block/uuid ?u] [?r :block/title ?t]')) return uuidsIn(q).map(u => [u, titleOf(idOfUuid(u))]);
  if (has(':find ?b ?name ?type ?v :where')) { const ids = idsIn(q); const rows = []; for (const id of ids) { const b = BLOCKS[id]; if (!b) continue; rows.push([id, 'Provider', ':node', b.provider], [id, 'Topic', ':node', b.topic]); } return rows; }
  if (has('(pull ?v [:db/id :block/uuid :block/title :property.value/content :block/name')) return idsIn(q).map(id => [{ 'db/id': id, 'block/uuid': U(id), 'block/title': titleOf(id), 'block/name': titleOf(id).toLowerCase() }]);
  if (has(':find ?name ?type ?v :where [?p :block/uuid')) return [['Specialized in', ':node', 22]];
  if (has(':find ?name ?b :where [?p :block/uuid')) { const u = uuidsIn(q)[0], id = idOfUuid(u); return Object.entries(BLOCKS).filter(([, b]) => b.provider === id).map(([bid]) => ['Provider', Number(bid)]); }
  if (has(':find ?b :where [?p :block/uuid') && has(':block/refs')) return [];
  if (has('[?b :block/name _] [?b :block/updated-at ?up]')) return [[20, 2], [22, 1]];
  return [];
}
const dom = new JSDOM('<html><head></head><body><div id="head" class="cp__header"></div><div id="main-content-container"></div></body></html>', { pretendToBeVisual: true });
const doc = dom.window.document;
if (!dom.window.HTMLDialogElement.prototype.showModal) dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
if (!dom.window.HTMLDialogElement.prototype.close) dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new dom.window.Event('close')); };
const styles = {}, commands = [], items = [], opened = [], sleep = ms => new Promise(r => setTimeout(r, ms));
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, provideStyle: ({ key, style }) => { styles[key] = style; }, useSettingsSchema() {}, onSettingsChanged() {}, updateSettings(v) { Object.assign(logseq.settings, v); }, provideModel() {},
  beforeunload(fn) { logseq._unload = fn; }, App: { pushState: (k, v) => opened.push(v.name), registerCommandPalette: c => commands.push(c.label), registerUIItem: (where, item) => items.push(item.key), onCurrentGraphChanged() {}, invokeExternalCommand: async id => { ran.push(id); },
    search: async words => ({ blocks: words.includes('mei') ? [{ uuid: U(20), title: 'Dr. $pfts_2lqh>$Mei$<pfts_2lqh$ Chen' }, { uuid: U(42), title: 'Saw Dr. Mei Chen about not sleeping' }] : [] }) },
  DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) }, UI: { showMsg() {} }, Editor: { openInRightSidebar: u => opened.push('sidebar:' + u), createPage: async () => null },
};
const errors = [];
// The host's api on the parent window: Logseq's palette commands as its state holds them (ids as keywords, keys as shown).
const hostCommands = [
  { id: ':go/journals', shortcut: 'g j', action: () => {}, handlerId: ':shortcut.handler/global-non-editing-only' },
  { id: ':ui/toggle-wide-mode', shortcut: 't w', action: () => {} }, { id: ':editor/redo', shortcut: '⌘+⇧+z | ⌘+y', action: () => {} },
  { id: ':ui/toggle-settings', shortcut: 't s | ⌘+,', action: () => {} }, { id: ':editor/copy-page-url', shortcut: '', action: () => {} },
  { id: ':my-plugin/doThing', desc: 'Do the thing', shortcut: '', action: () => { ran.push('action:my-plugin/doThing'); } },
];
const ran = [];
const sandbox = { window: { parent: { document: doc, logseq: { api: { get_state_from_store: path => path === 'command-palette/commands' ? hostCommands : null } } } }, logseq, document: { currentScript: null }, navigator: { platform: 'MacIntel' }, console: { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); console.error(...a); } }, setTimeout, clearTimeout, Promise, URL, Date, Map, Set, JSON, encodeURIComponent, String, Number, Array, Object, RegExp, Math };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
const settle = () => sleep(220);
const key = (k, extra = {}) => { const dlg = doc.querySelector('dialog.fd .fd-input') || doc.querySelector('dialog.fd'); dlg.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })); return settle(); };
const type = async text => { const input = doc.querySelector('.fd-input'); input.value = text; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle(); };
const text = sel => [...doc.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
(async () => {
  for (const file of order) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  await sleep(50);
  const Find = sandbox.window.Find;
  assert.ok(Find.kit && Find.db && Find.settings && Find.window, 'the parts are on window.Find');
  assert.deepEqual(commands, ['Find'], 'the commands are registered');
  assert.deepEqual(items, ['find-open'], 'the toolbar word is registered');
  // open: the kinds and the recents
  Find.window.open();
  await settle();
  const dlg = doc.querySelector('dialog.fd');
  assert.ok(dlg && dlg.hasAttribute('open'), 'the window opens in Logseq\'s document');
  assert.ok(styles['find-find'], 'its stylesheet is sent');
  assert.deepEqual(text('.fd-c'), ['Consultation4', 'Doctor2'], 'the kinds, most first, with how many');
  assert.deepEqual(text('.fd-r .fd-w'), ['Dr. Mei Chen', 'Fatigue'], 'the recents as rows');
  assert.deepEqual(text('.fd-head'), ['recently opened'], 'the one head at rest; no "narrow by", no "open"');
  assert.equal(doc.querySelector('.fd-find .fd-n'), null, 'no count in the find line');
  assert.ok(text('.fd-foot')[0].startsWith('narrowTabopen Dr. Mei Chen'), 'the foot says Tab narrows and Enter opens: ' + text('.fd-foot')[0]);
  // → digs Dr. Mei Chen open: the line that opens (Provider, from her consultations) is a row with its dot ringed while
  // closed, its number after the words; → again opens the three under it
  await key('ArrowRight'); await settle();
  assert.deepEqual(text('.fd-kids .fd-g .fd-nm'), ['ProviderConsultation3'], 'what points at her, as a line with its number after the words');
  assert.ok(doc.querySelector('.fd-kids .fd-g .fd-bul.fd-folded'), 'the dot is ringed while the line is closed');
  assert.equal(doc.querySelector('.fd-kids .fd-g .fd-ct').parentElement.className, 'fd-nm', 'the number sits with the words, not at the edge');
  await key('ArrowDown'); await key('ArrowRight');
  assert.ok(!doc.querySelector('.fd-kids .fd-g .fd-bul.fd-folded'), 'open, the dot is plain');
  assert.equal(doc.querySelectorAll('.fd-gn .fd-r').length, 3, 'her three consultations under the line');
  assert.equal(doc.querySelector('.fd-gn .fd-showall'), null, 'no "show all" when the three are all');
  await key('ArrowLeft'); await key('ArrowUp'); await key('ArrowLeft');
  assert.equal(doc.querySelectorAll('.fd-kids').length, 0, '← closes the line, then the node');
  await key('Tab');
  assert.deepEqual(text('.fd-c.fd-lit'), ['Consultation4'], 'Tab with nothing typed steps into the choices');
  assert.ok(text('.fd-foot')[0].startsWith('narrow to ConsultationTab'), 'and the foot names the choice under the cursor: ' + text('.fd-foot')[0]);
  await key('Escape');
  assert.ok(doc.querySelector('dialog.fd'), 'Escape steps back to the rows, the window stays');
  // "cons" lights Consultation; Enter picks it
  await type('cons');
  assert.deepEqual(text('.fd-c.fd-lit'), ['Consultation4'], 'the typed letters light the kind');
  assert.ok(text('.fd-foot')[0].startsWith('narrow to ConsultationTab'), 'the foot says Tab takes it: ' + text('.fd-foot')[0]);
  await key('Tab');
  assert.deepEqual(text('.fd-piece .lk-tag'), ['Consultation'], 'the pick sits in the find line as a tag');
  assert.equal(doc.querySelector('.fd-input').value, '', 'the letters are cleared');
  assert.equal(doc.querySelectorAll('.fd-r').length, 4, 'the four consultations');
  assert.deepEqual(text('.fd-ck'), ['Provider', 'Topic', 'When'], 'its properties and the months as choices');
  assert.deepEqual(text('.fd-head'), [], 'no head over the choices or the rows: a gap tells them apart');
  assert.deepEqual(text('.fd-ch:nth-of-type(1) .fd-c'), ['Dr. Mei Chen3', 'Dr. Sofia Alvarez1'], 'the Provider values with counts');
  assert.deepEqual(text('.fd-r .fd-day'), ['Oct 7', 'Sep 14', 'Sep 1', 'Aug 20'], 'newest first, the day in the margin');
  assert.equal(doc.querySelectorAll('.fd-r .lk-tag').length, 0, 'the picked kind is not repeated on every row');
  // "mei" lights Dr. Mei Chen under Provider; Enter picks; the rows narrow
  await type('mei');
  assert.deepEqual(text('.fd-c.fd-lit'), ['Dr. Mei Chen3'], 'the typed letters light the value');
  assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'the rows narrow to the words meanwhile');
  await key('Tab');
  assert.deepEqual(text('.fd-piece'), ['×Consultation', '×ProviderDr. Mei Chen'], 'the value sits in the line as the node');
  assert.ok(doc.querySelector('.fd-piece .lk-node[data-uuid]'), 'the node carries its uuid for Look\'s mark');
  assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'her three consultations');
  assert.deepEqual(text('.fd-ck'), ['Topic', 'When'], 'Provider is picked, so it is no longer offered');
  assert.ok(text('.fd-foot')[0].includes('open Video call'), 'the foot names what Enter opens: ' + text('.fd-foot')[0]);
  // → digs into the first row: its properties, then what points at it
  await key('ArrowRight');
  await settle();
  assert.ok(doc.querySelector('.fd-kids .fd-kv'), 'the node opens in place with its properties');
  assert.deepEqual(text('.fd-kids .fd-k'), ['Specialized in'], 'the property name');
  // the second row, dug too, shows what points at it (nothing in this graph) without breaking
  await key('ArrowLeft');
  assert.equal(doc.querySelectorAll('.fd-kids').length, 0, '← closes it');
  // Backspace widens: the value pick goes
  await key('Backspace');
  assert.deepEqual(text('.fd-piece .lk-tag'), ['Consultation'], 'Backspace takes the last pick off');
  assert.equal(doc.querySelectorAll('.fd-r').length, 4, 'the list widens');
  // Enter with nothing lit opens the first row
  await key('ArrowDown');
  await key('Enter');
  assert.deepEqual(opened, [U(41)], 'Enter opens the row the cursor is on');
  assert.equal(doc.querySelector('dialog.fd'), null, 'and the window closes');
  // words without a kind: Logseq's search, the kinds among the results
  Find.window.open();
  await settle();
  await type('mei');
  assert.equal(doc.querySelectorAll('.fd-r').length, 2, 'Logseq\'s results as rows');
  assert.deepEqual(text('.fd-c'), ['Consultation1', 'Doctor1'], 'the kinds among the results, by name when counts tie');
  await type('>');
  assert.deepEqual(text('.fd-r .fd-nm'), ['Copy page url', 'Redo', 'Go to journals', 'Do the thing', 'Toggle settings', 'Toggle wide mode', 'Plugin settings'], '> lists every command the app holds, by id, named from the dictionary or its own words');
  assert.deepEqual(text('.fd-r .fd-key'), ['', '⌘⇧Z', 'g j', '', 't s', 't w', ''], 'each with its key as the window writes it');
  assert.equal(doc.querySelectorAll('.fd-cmd .ti, .fd-cmd .fd-icon').length, 0, 'no picture before a command');
  await type('>toggle wide');
  assert.deepEqual(text('.fd-r .fd-nm'), ['Toggle wide mode'], 'the words after > narrow them, every word must occur');
  assert.ok(doc.querySelector('.fd-r .fd-w b, .fd-r .fd-w strong, .fd-r .fd-w mark'), 'the letters are marked in the name');
  await key('Enter');
  assert.deepEqual(ran, ['logseq.ui/toggle-wide-mode'], 'Enter runs it through Logseq by its id');
  assert.ok(!doc.querySelector('dialog.fd'), 'and the window closes');
  Find.window.open(); await settle();
  await type('>do the');
  await key('Enter');
  assert.deepEqual(ran, ['logseq.ui/toggle-wide-mode', 'action:my-plugin/doThing'], "a plugin's command with capitals in its id runs through its own action");
  Find.window.open(); await settle();
  await type('>jour');
  assert.ok(text('.fd-r').some(t => t.includes('Go to journals')), '> lists the commands');
  await key('Escape');
  assert.equal(doc.querySelector('dialog.fd'), null, 'Escape closes');
  // the key specimen, and the stop
  assert.ok(Find.settings.specimen({ key: 'takesSearchKey', type: 'boolean' }, true).includes('⌘K'), 'the key specimen');
  await logseq._unload();
  assert.equal(doc.querySelectorAll('dialog, .fd-own').length, 0, 'nothing of the plugin\'s is left after the stop');
  assert.deepEqual(errors, [], 'no errors');
  console.log('ok: ' + order.length + ' files load; the window opens, narrows by choice and by letters, digs, widens, opens a row, lists commands, closes; the stop sweeps');
})().catch(error => { console.error(error); process.exit(1); });
