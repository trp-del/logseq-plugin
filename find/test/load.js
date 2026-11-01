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
let DATED = [], ENTITY = false, made = [];   // date properties: [node, journal day, the property's name]; Consultation under a tag called Entity
let SHARED = false;   // for the check of a tag under two parents: Top over A and B, Both under A and B
const TAGS_SHARED = [[5, 'Top', 'user.class/Top'], [6, 'A', 'user.class/A'], [7, 'B', 'user.class/B'], [8, 'Both', 'user.class/Both']];
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
  if (has(':logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title] [?t :db/ident ?ident]')) return (SHARED ? TAGS_SHARED : ENTITY ? [...TAGS, [9, 'Entity', 'user.class/Entity']] : TAGS).map(([id, t, i]) => [id, U(id), t, ':' + i]);
  if (has('logseq.property.class/extends ?p')) return ENTITY ? [[2, 9]] : SHARED ? [[6, 5], [7, 5], [8, 6], [8, 7]] : [];
  if (has('[?b :block/tags ?t] [?t :block/tags :logseq.class/Tag]')) return SHARED ? [[8, 40], [7, 41]] : CARRIED;
  const given = () => (q.includes('#uuid') ? uuidsIn(q).map(idOfUuid) : idsIn(q));
  if (has(':find ?b ?u ?title ?name :where')) return given().map(id => [id, U(id), titleOf(id), PAGES[id] ? titleOf(id).toLowerCase() : '']);
  if (has(':find ?b ?ptitle ?pday :where')) return given().filter(id => BLOCKS[id]).map(id => [id, PAGES[BLOCKS[id].page], DAYS[BLOCKS[id].page]]);
  if (has(':find ?b ?t :where') && has('[?b :block/tags ?t]')) { const ids = q.includes('#uuid') ? uuidsIn(q).map(idOfUuid) : idsIn(q); return CARRIED.filter(([, b]) => ids.includes(b)).map(([t, b]) => [b, t]); }
  if (has(':find ?b ?d :where') && has('[?b :block/journal-day ?d]')) return [];
  if (has(':find ?b ?d ?name :where')) return DATED.filter(([b]) => given().includes(b));
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
  DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) }, UI: { showMsg() {} }, Editor: { openInRightSidebar: u => opened.push('sidebar:' + u), createPage: async name => { made.push(name); return null; } },
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
  doc.querySelector('.fd-kids .fd-g .fd-nm').click(); await settle();
  assert.ok(doc.querySelector('.fd-kids .fd-g .fd-bul.fd-folded') && !doc.querySelector('.fd-gn .fd-r'), 'a click on a line\'s words does not unfold it');
  assert.ok(doc.querySelector('.fd-kids .fd-g.fd-on'), 'it moves the cursor there'); await key('ArrowUp');
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
  assert.deepEqual(text('.fd-ck.lk-prop'), ['Provider', 'Topic'], 'a property named with the shared name');
  assert.deepEqual(text('.fd-head'), [], 'no head over the choices or the rows: a gap tells them apart');
  assert.deepEqual(text('.fd-ch:nth-of-type(1) .fd-c'), ['Dr. Mei Chen3', 'Dr. Sofia Alvarez1'], 'the Provider values with counts');
  assert.deepEqual(text('.fd-r .fd-day'), ['Oct 7', 'Sep 14', 'Sep 1', 'Aug 20'], 'newest first, the day in the margin');
  assert.equal(doc.querySelectorAll('.fd-r .lk-tag').length, 0, 'the picked kind is not repeated on every row');
  // A letter cannot change the choices, so it does not count them again; an arrow moves the lit mark and draws no row again.
  const counted = Find.window.state.facets;
  await type('s'); assert.equal(Find.window.state.facets, counted, 'a letter does not count the choices again'); await type('');
  const rowOne = doc.querySelector('.fd-r');
  await key('ArrowDown');
  assert.ok(rowOne.isConnected && !rowOne.classList.contains('fd-on'), 'an arrow leaves the row where it is, unlit');
  assert.ok(doc.querySelectorAll('.fd-r')[1].classList.contains('fd-on') && doc.querySelectorAll('.fd-r.fd-on').length === 1, 'and lights the next');
  assert.ok(text('.fd-foot')[0].includes('open Saw'), 'the foot follows the cursor: ' + text('.fd-foot')[0]);
  await key('ArrowUp');
  // "mei" lights Dr. Mei Chen under Provider; Enter picks; the rows narrow
  await type('mei');
  assert.deepEqual(text('.fd-c.fd-lit'), ['Dr. Mei Chen3'], 'the typed letters light the value');
  assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'the rows narrow to the words meanwhile');
  await key('Tab');
  assert.deepEqual(text('.fd-piece'), ['×Consultation', '×ProviderDr. Mei Chen'], 'the value sits in the line as the node');
  assert.ok(doc.querySelector('.fd-piece .lk-node[data-uuid]'), 'the node carries its uuid for Look\'s mark');
  assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'her three consultations');
  assert.deepEqual(text('.fd-ck'), ['Topic', 'When'], 'Provider is picked, so it is no longer offered');
  assert.deepEqual(text('.fd-piece .lk-prop'), ['Provider'], 'in the find line too, the shared name');
  assert.ok(text('.fd-foot')[0].includes('open Video call'), 'the foot names what Enter opens: ' + text('.fd-foot')[0]);
  // → digs into the first row: its properties, then what points at it
  await key('ArrowRight');
  await settle();
  assert.ok(doc.querySelector('.fd-kids .fd-kv'), 'the node opens in place with its properties');
  assert.deepEqual(text('.fd-kids .fd-k.lk-prop'), ['Specialized in'], 'the property name');
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
  // A mouse press leaves the keyboard in the one box, and a change in the graph leaves the window as it is.
  Find.window.open(); await settle();
  const box = () => doc.querySelector('.fd-input'), shown = () => [text('.fd-c'), text('.fd-r .fd-w')], at = shown();
  box().blur(); doc.querySelector('.fd-r').click(); await settle(); assert.equal(doc.activeElement, box(), 'a row pressed');
  box().blur(); doc.querySelector('.fd-foot').click(); assert.equal(doc.activeElement, box(), 'the foot pressed');
  Find.window.forget(); await key('ArrowDown'); assert.deepEqual(shown(), at, 'a change in the graph empties nothing');
  await key('ArrowRight'); await settle(); assert.ok(doc.querySelector('.fd-kids'), 'a node digs'); Find.window.forget(); await key('ArrowDown'); assert.ok(doc.querySelector('.fd-kids') && !/reading/.test(text('.fd-kids').join()), 'and stays read after a change');
  await key('ArrowUp'); await key('ArrowLeft'); await settle();
  box().blur(); doc.querySelector('.fd-c').click(); await settle(); assert.equal(doc.activeElement, box(), 'a kind pressed'); assert.equal(doc.querySelectorAll('.fd-piece').length, 1);
  await key('Backspace'); await settle();
  // Two words: the kinds among the results, not the biggest; a kind of two words still answers to them.
  await type('mei chen');
  assert.deepEqual(text('.fd-c'), ['Consultation1', 'Doctor1'], 'a name of two words shows the kinds among the results');
  // With > there are no choices: Up stays in the commands, Enter runs one.
  await type('>toggle wide'); await key('ArrowUp'); assert.equal(Find.window.state.mode, 'rows', 'Up finds no choices to step into');
  await key('Escape'); await settle();
  // A tag under two parents keeps its nodes under both.
  SHARED = true; Find.db.forget();
  const shared = await Find.db.tagIndex();
  assert.deepEqual([...shared.byId.get(7).under].sort(), [40, 41], 'B holds the nodes of the tag it shares with A');
  assert.deepEqual([...shared.byId.get(6).under], [40], 'and A holds them too');
  assert.deepEqual([...shared.byId.get(5).under].sort(), [40, 41], 'each node once at the top');
  SHARED = false; Find.db.forget();
  // A kind too long to read whole keeps its newest, and says so.
  CARRIED.reverse(); Find.db.forget();   // the oldest read first, so a cut before the days are read would keep those
  const cut = await Find.db.nodesOfKind(2, 2);
  CARRIED.reverse(); Find.db.forget();
  assert.deepEqual([...cut].map(n => n.day).sort().reverse(), [20261007, 20260914], 'the newest two of four');
  assert.equal(cut.cutFrom, 4, 'and it knows how many there were');
  Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
  Find.window.state.cache.kind.get(2).cutFrom = 9;
  await type('s'); await type('');
  assert.deepEqual(text('.fd-none'), ['the newest 4 of 9'], 'the list says it is cut');
  await key('Escape'); Find.window.forget();
  // The margin says when a node happened: the property titled Date, else the earliest date, else the day it is written on; an Entity nothing.
  DATED = [[40, 20260815, 'Visited'], [40, 20260903, 'Date'], [41, 20260601, 'Noted'], [41, 20260501, 'Seen']]; Find.db.forget();
  const dayOf = async id => (await Find.db.details([id], []))[0].day;
  assert.equal(await dayOf(40), 20260903, 'the property titled Date first, though another is earlier');
  assert.equal(await dayOf(41), 20260501, 'else the earliest date');
  assert.equal(await dayOf(42), 20260901, 'else the journal day it is written on');
  ENTITY = true; Find.db.forget();
  assert.equal(await dayOf(40), 0, 'an Entity shows no day, whatever it holds and wherever it is written');
  assert.equal(await dayOf(42), 0, 'nor one on a journal page');
  const sorted = (await Find.db.details([41, 43, 42], [])).sort(Find.db.byDay).map(n => n.id);
  assert.deepEqual(sorted, [41, 42, 43], 'with no day they keep the order of the days they were written');
  ENTITY = false; Find.db.forget();
  Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
  assert.ok(text('.fd-r .fd-day').includes('Sep 3') && text('.fd-r .fd-day').includes('May 1'), 'the rows carry those days: ' + text('.fd-r .fd-day'));
  await key('Escape'); await settle(); DATED = []; Find.window.forget();
  // Enter takes what is offered. With no rows at all it makes the page, the key beside the words; pressed before the letters are read, it waits for them.
  Find.window.open(); await settle(); await type('nothing has this');
  assert.deepEqual(text('.fd-foot .fd-right .fd-k'), ['Enter'], 'the key stands beside "make a page"');
  await key('Enter'); await settle(); assert.deepEqual(made, ['nothing has this'], 'Enter makes the page'); made = [];
  Find.window.close(); Find.window.open(); await settle();
  { const input = doc.querySelector('.fd-input'); input.value = 'nor has this'; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); assert.deepEqual(made, [], 'not before the letters are read'); }
  await settle(); await sleep(50); assert.deepEqual(made, ['nor has this'], 'then it takes what they found'); made = [];
  Find.window.close(); Find.window.open(); await settle(); await type('mei');
  assert.deepEqual(text('.fd-foot .fd-right .fd-k'), [], 'with rows, the key is not offered there'); await key('Enter'); assert.deepEqual(made, [], 'and Enter opens the row'); opened.length = 0;
  // Row thirteen on: Down past the last row shows the rest, the cursor on the first of them.
  Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
  logseq.settings.rowsShown = 2; await type('s'); await type('');
  assert.equal(doc.querySelectorAll('.fd-r').length, 2); await key('ArrowDown'); await key('ArrowDown');
  assert.equal(doc.querySelectorAll('.fd-r').length, 4, 'Down past the last row shows them all'); assert.equal(Find.window.state.rowAt, 2);
  delete logseq.settings.rowsShown; await key('Escape'); await settle();
  // A group's "show all" the same way.
  BLOCKS[43].provider = 20; Find.window.forget(); Find.db.forget();
  Find.window.open(); await settle(); await type('mei'); await key('ArrowRight'); await settle();
  await key('ArrowDown'); await key('ArrowRight'); await settle();
  const groupRows = () => doc.querySelectorAll('.fd-gn .fd-r').length;
  assert.equal(groupRows(), 3, 'a group shows three'); for (let i = 0; i < 4; i++) await key('ArrowDown');
  assert.equal(groupRows(), 4, 'Down past the third shows the rest of the group'); await key('Escape'); await key('Escape'); await settle(); BLOCKS[43].provider = 21; Find.window.forget();
  // "more" is a choice: the arrows reach it, Tab or Enter takes it, and the cursor stands on the first that came.
  { Find.window.open(); await settle(); const kept = Find.window.state.kinds; Find.window.state.kinds = [1, 2, 3, 4, 5].map(n => ({ id: 100 + n, uuid: U(100 + n), title: 'Kind ' + n, count: n }));
    await key('Tab'); await key('ArrowRight'); await key('ArrowRight'); await key('ArrowRight');
    assert.ok(text('.fd-foot')[0].includes('show moreTab'), 'the foot says what the key does: ' + text('.fd-foot')[0]);
    assert.ok(doc.querySelector('.fd-more.fd-lit'), 'more is lit'); await key('Enter');
    assert.equal(text('.fd-c').length, 5, 'and shows the rest'); assert.ok(doc.querySelector('.fd-c.fd-lit')?.textContent.startsWith('Kind 4'), 'the cursor on the first that came');
    await key('Escape'); await key('Escape'); await settle(); Find.window.state.kinds = kept; }
  { Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
    Find.window.state.facets = { props: ['a', 'b', 'c', 'd', 'e'].map(n => ({ name: n, type: 'default', values: [{ key: '1', label: n + '1', count: 1 }, { key: '2', label: n + '2', count: 2 }] })), months: [], kinds: [] };
    await key('Tab'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown');
    assert.ok(doc.querySelector('.fd-more.fd-lit')?.textContent.includes('2 more properties'), 'the line of properties too'); await key('Tab');
    assert.equal(text('.fd-ch').length, 5, 'and it opens them'); await key('Escape'); await key('Escape'); await settle(); Find.window.forget(); }
  // At rest the foot says no hint; one height from the opening, whatever is listed; a kind named, no mark before a name.
  { Find.window.open(); await settle();
    const foot = () => doc.querySelector('.fd-foot').textContent, dlg = doc.querySelector('dialog.fd');
    assert.ok(!/type to find|for a command/.test(foot()), 'no hint at rest'); assert.ok(foot().includes('Enter'), 'what Enter does stays');
    assert.equal(dlg.style.height, 220 + 12 * 28 + 'px', 'room for the rows shown');
    assert.ok(!fs.readFileSync(path.join(root, 'find/logseq/find.js'), 'utf8').includes('minHeight'), 'no height is kept from what was listed');
    await type('>'); await settle(); assert.equal(dlg.style.height, 220 + 12 * 28 + 'px'); assert.equal(dlg.style.minHeight, '', 'the commands leave no height behind');
    await key('Backspace'); await type('mei'); await settle(); assert.equal(dlg.style.height, 220 + 12 * 28 + 'px');
    assert.ok(doc.querySelector('.fd-w.lk-node') && !doc.querySelector('.fd-w.lk-bare'), 'where sorts mix, a page keeps its mark');
    await key('Escape'); await settle();
    Find.window.open(); await settle(); await type('doct'); await settle(); await key('Tab'); await settle();
    assert.ok(doc.querySelector('.fd-w.lk-node') && !doc.querySelector('.fd-w.lk-node:not(.lk-bare)'), 'under a kind picked, no mark');
    await key('Escape'); await settle(); }
  // The foot: the words in the text colour, the key faint.
  assert.ok(styles['find-find'].includes('.fd-foot .fd-k { color: var(--fd-faint);') && /\.fd-foot \{[^}]*color: var\(--lk-text/.test(styles['find-find']), 'the key faint, what it does in the text colour');
  // the key specimen, and the stop
  assert.ok(Find.settings.specimen({ key: 'takesSearchKey', type: 'boolean' }, true).includes('Cmd K'), 'the key specimen, in plain words');
  await logseq._unload();
  assert.equal(doc.querySelectorAll('dialog, .fd-own').length, 0, 'nothing of the plugin\'s is left after the stop');
  assert.deepEqual(errors, [], 'no errors');
  console.log('ok: ' + order.length + ' files load; the window opens, narrows by choice and by letters, digs, widens, opens a row, lists commands, closes; the stop sweeps');
})().catch(error => { console.error(error); process.exit(1); });
