/* node test/load.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules)
   Loads the plugin's files, in files.js's order, against a stand-in for Logseq: a fake `logseq` whose queries answer in the
   shapes Logseq 2.0.2 returns (a small graph: the kinds Doctor and Consultation, Dr. Mei Chen, four consultations with
   their Provider and Topic), and a jsdom page. It walks the window from the keyboard: the kinds offered, "cons" lighting
   Consultation and Enter picking it, the choices under it, "mei" lighting Dr. Mei Chen, the rows narrowing, → digging into
   a row, the sentence widened, Escape closing; the sentence read as kind, who and when, the near rows and the year line; then
   that the stop sweeps everything. Only the real app shows the rest. */
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
const PAGES = { 1: 'Doctor', 50: 'Provider', 20: 'Dr. Mei Chen', 21: 'Dr. Sofia Alvarez', 22: 'Fatigue', 23: 'Tingling fingers', 30: 'Oct 7th, 2026', 31: 'Sep 14th, 2026', 32: 'Sep 1st, 2026', 33: 'Aug 20th, 2026' };
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
  if (has(':find ?b ?type :where') && has('[?b :logseq.property/type ?type]')) return given().filter(id => id === 50).map(id => [id, ':node']);
  if (has(':find ?b ?u ?title ?name :where')) return given().map(id => [id, U(id), titleOf(id), PAGES[id] ? titleOf(id).toLowerCase() : '']);
  if (has(':find ?b ?u ?title :where [?b :block/name _]')) return Object.entries(PAGES).filter(([id]) => !DAYS[id]).map(([id, t]) => [Number(id), U(id), t]);
  if (has(':find ?b ?ptitle ?pday :where')) return given().filter(id => BLOCKS[id]).map(id => [id, PAGES[BLOCKS[id].page], DAYS[BLOCKS[id].page]]);
  if (has(':find ?b ?t :where') && has('[?b :block/tags ?t]')) { const ids = q.includes('#uuid') ? uuidsIn(q).map(idOfUuid) : idsIn(q); return CARRIED.filter(([, b]) => ids.includes(b)).map(([t, b]) => [b, t]); }
  if (has(':find ?b ?d :where') && has('[?b :block/journal-day ?d]')) return [];
  if (has(':find ?b ?d ?name :where')) return DATED.filter(([b]) => given().includes(b));
  if (has(':find ?u ?t :where') && has('[?r :block/uuid ?u] [?r :block/title ?t]')) return uuidsIn(q).map(u => [u, titleOf(idOfUuid(u))]);
  if (has(':find ?b ?name ?type ?v :where')) { const ids = idsIn(q); const rows = []; for (const id of ids) { const b = BLOCKS[id]; if (!b) continue; rows.push([id, 'Provider', ':node', b.provider], [id, 'Topic', ':node', b.topic]); if (b.onset) rows.push([id, 'Onset', ':datetime', b.onset]); } return rows; }
  if (idsIn(q).some(id => id > 2147483647)) throw new Error(`Highest supported entity id is 2147483647, got ${idsIn(q).find(id => id > 2147483647)}`);
  if (has('(pull ?v [:db/id :block/uuid :block/title :property.value/content :block/name')) return idsIn(q).map(id => [{ 'db/id': id, 'block/uuid': U(id), 'block/title': titleOf(id), 'block/name': titleOf(id).toLowerCase() }]);
  if (has(':find ?name ?type ?v :where [?p :block/uuid')) return [['Specialized in', ':node', 22], ...(BLOCKS[40].onset ? [['Onset', ':datetime', BLOCKS[40].onset]] : [])];
  // What points at a node, and what mentions it, leave the node's own block and the bullets on its page out: a page is never listed under itself.
  if (has(':find ?name ?b :where [?p :block/uuid') || (has(':find ?b :where [?p :block/uuid') && has(':block/refs'))) assert.ok(has('[(not= ?b ?p)]', '(not [?b :block/page ?p])'), 'a node is not among what points at it or mentions it: ' + q);
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
  assert.deepEqual(commands, ['Find', 'Find by sentence'], 'the commands are registered');
  assert.deepEqual(items, ['find-open'], 'the toolbar word is registered');
  // open: the kinds and the recents
  Find.window.open();
  await settle();
  const dlg = doc.querySelector('dialog.fd');
  assert.ok(dlg && dlg.hasAttribute('open'), 'the window opens in Logseq\'s document');
  assert.ok(styles['find-find'], 'its stylesheet is sent');
  assert.deepEqual(text('.fd-c'), ['Consultation4', 'Doctor2'], 'the kinds, most first, with how many');
  assert.deepEqual(text('.fd-r .fd-w'), ['Dr. Mei Chen', 'Fatigue'], 'the recents as rows');
  assert.deepEqual([...doc.querySelectorAll('.fd-r .fd-sign')].map(e => e.className + ' ' + e.innerHTML.match(/ti-[a-z-]+/)?.[0]), ['fd-bul fd-sign fd-page ti-file', 'fd-bul fd-sign fd-page ti-file'], 'a page carries Logseq\'s page sign, not a dot');
  assert.deepEqual(text('.fd-head'), ['recently opened'], 'the one head at rest; no "narrow by", no "open"');
  assert.ok(doc.querySelector('.fd-body').classList.contains('fd-noday'), 'pages with no day: no day column, no empty margin');
  assert.equal(doc.querySelector('.fd-find .fd-n'), null, 'no count in the find line');
  assert.ok(text('.fd-foot')[0].startsWith('narrowTabopen Dr. Mei Chen'), 'the foot says Tab narrows and Enter opens: ' + text('.fd-foot')[0]);
  // → digs Dr. Mei Chen open: the line that opens (Provider, from her consultations) is a row with its dot ringed while
  // closed, its number after the words; → again opens the three under it
  await key('ArrowRight'); await settle();
  assert.deepEqual(text('.fd-kids .fd-g .fd-nm'), ['ProviderConsultation3'], 'what points at her, as a line with its number after the words');
  doc.querySelector('.fd-kids .fd-g .fd-nm').click(); await settle();
  assert.ok(doc.querySelector('.fd-kids .fd-g .fd-bul.folded') && !doc.querySelector('.fd-gn .fd-r'), 'a click on a line\'s words does not unfold it');
  assert.ok(doc.querySelector('.fd-kids .fd-g.on'), 'it moves the cursor there'); await key('ArrowUp');
  assert.ok(doc.querySelector('.fd-kids .fd-g .fd-bul.folded'), 'the dot is ringed while the line is closed');
  assert.equal(doc.querySelector('.fd-kids .fd-g .fd-ct').parentElement.className, 'fd-nm', 'the number sits with the words, not at the edge');
  await key('ArrowDown'); await key('ArrowRight');
  assert.ok(!doc.querySelector('.fd-kids .fd-g .fd-bul.folded'), 'open, the dot is plain');
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
  assert.ok(!doc.querySelector('.fd-body').classList.contains('fd-noday'), 'with days, the day column stands');
  assert.equal(doc.querySelectorAll('.fd-r .lk-tag').length, 0, 'the picked kind is not repeated on every row');
  // A letter cannot change the choices, so it does not count them again; an arrow moves the lit mark and draws no row again.
  const counted = Find.window.state.facets;
  await type('s'); assert.equal(Find.window.state.facets, counted, 'a letter does not count the choices again'); await type('');
  const rowOne = doc.querySelector('.fd-r');
  await key('ArrowDown');
  assert.ok(rowOne.isConnected && !rowOne.classList.contains('on'), 'an arrow leaves the row where it is, unlit');
  assert.ok(doc.querySelectorAll('.fd-r')[1].classList.contains('on') && doc.querySelectorAll('.fd-r.on').length === 1, 'and lights the next');
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
  assert.deepEqual([...doc.querySelectorAll('.fd-r')].map(r => r.querySelector('.fd-sign')?.classList[2] || (r.querySelector('.lk-bul') ? 'dot' : '')), ['fd-page', 'dot'], 'a page its sign, a bullet its dot');
  { const signs = (await Find.db.details([1, 50], [])).map(n => [n.id, n.sign, n.propType]).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(signs, [[1, 'tag', ''], [50, 'property', 'node']], 'a tag reads as a tag, a property as a property with what it holds'); }
  await type('>');
  assert.deepEqual(text('.fd-r .fd-nm'), ['Copy page url', 'Redo', 'Go to journals', 'Do the thing', 'Toggle settings', 'Toggle wide mode', 'Plugin settings'], '> lists every command the app holds, by id, named from the dictionary or its own words');
  assert.deepEqual(text('.fd-r .fd-key'), ['', '⌘⇧Z', 'g j', '', 't s', 't w', ''], 'each with its key as the window writes it');
  assert.equal(doc.querySelectorAll('.fd-cmd .ti, .fd-cmd .fd-icon').length, 0, 'no picture before a command');
  assert.ok([...doc.querySelectorAll('.fd-cmd')].every(r => r.children.length === 2), 'and no empty margin: the name, then the key');
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
  // Cmd Shift . opens the window with > typed, the commands listed; again, it closes.
  { const press = () => doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '>', code: 'Period', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    press(); await settle();
    assert.equal(doc.querySelector('.fd-input')?.value, '>', 'Cmd Shift . opens the window with > typed');
    assert.ok(text('.fd-r .fd-nm').includes('Go to journals'), 'and the commands are listed');
    press(); await settle();
    assert.equal(doc.querySelector('dialog.fd'), null, 'pressed again, it closes'); }
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
  assert.deepEqual(text('.fd-none'), ['The newest 4 of 9'], 'the list says it is cut');
  await key('Escape'); Find.window.forget();
  // The margin says when a node happened: the property titled Date, else the earliest date, else the day it is written on, whatever its tag.
  DATED = [[40, 20260815, 'Visited'], [40, 20260903, 'Date'], [41, 20260601, 'Noted'], [41, 20260501, 'Seen']]; Find.db.forget();
  const dayOf = async id => (await Find.db.details([id], []))[0].day;
  assert.equal(await dayOf(40), 20260903, 'the property titled Date first, though another is earlier');
  assert.equal(await dayOf(41), 20260501, 'else the earliest date');
  assert.equal(await dayOf(42), 20260901, 'else the journal day it is written on');
  ENTITY = true; Find.db.forget();
  assert.equal(await dayOf(40), 20260903, 'a tag called Entity is a tag like any other: its node keeps its day');
  assert.equal(await dayOf(42), 20260901, 'and the journal day it is written on');
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
  assert.deepEqual(text('.fd-foot .fd-right .fd-k'), ['Cmd Enter'], 'with rows, the key beside "make a page" is Cmd Enter'); await key('Enter'); assert.deepEqual(made, [], 'and Enter opens the row'); opened.length = 0;
  Find.window.open(); await settle(); await type('mei'); await key('Enter', { metaKey: true }); assert.deepEqual(made, ['mei'], 'Cmd Enter makes the page though rows are listed'); made = [];
  Find.window.close(); Find.window.open(); await settle(); await type('cons'); await key('Tab'); await key('Enter', { metaKey: true }); assert.deepEqual([made, opened], [[], []], 'with a kind picked, Cmd Enter makes nothing and opens nothing'); Find.window.close();
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
    assert.deepEqual(text('.fd-tree .fd-col'), ['Consultation4', 'Doctor2'], 'opened with nothing typed, the kinds stand in columns under their top-level tags');
    assert.ok(doc.querySelector('.fd-c.fd-lit')?.textContent.startsWith('Consultation'), 'the cursor on the first of them');
    await key('Escape'); await key('Escape'); await settle(); Find.window.state.kinds = kept; }
  // The columns: the top-level tags by name, each tag under its parent, stepped in by depth; Right goes beside, Down runs down a column.
  { ENTITY = true; Find.db.forget(); Find.window.forget(); Find.window.open(); await settle();
    Find.window.state.moreOf.add('kind'); await key('Tab');
    assert.deepEqual([...doc.querySelectorAll('.fd-tree .fd-col')].map(c => [...c.querySelectorAll('.fd-c')].map(b => (b.classList.contains('fd-top') ? '*' : '') + b.childNodes[0].textContent + ':' + b.style.getPropertyValue('--fd-depth').trim())), [['*Doctor:0'], ['*Entity:0', 'Consultation:0']], 'by name: Doctor first, then Entity with Consultation under it; Entity has no place of its own');
    await key('ArrowRight'); assert.ok(doc.querySelector('.fd-c.fd-lit')?.textContent.startsWith('Entity'), 'Right goes to the column beside');
    await key('ArrowDown'); assert.ok(doc.querySelector('.fd-c.fd-lit')?.textContent.startsWith('Consultation'), 'Down steps down the column');
    await key('Enter'); assert.deepEqual(text('.fd-piece .lk-tag'), ['Consultation'], 'Enter picks the kind');
    await key('Escape'); await settle(); ENTITY = false; Find.db.forget(); Find.window.forget(); }
  { Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
    Find.window.state.facets = { props: ['a', 'b', 'c', 'd', 'e'].map(n => ({ name: n, type: 'default', values: [{ key: '1', label: n + '1', count: 1 }, { key: '2', label: n + '2', count: 2 }] })), months: [], kinds: [] };
    await key('Tab'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown');
    assert.ok(doc.querySelector('.fd-more.fd-lit')?.textContent.includes('2 more properties'), 'the line of properties too'); await key('Tab');
    assert.equal(text('.fd-ch').length, 5, 'and it opens them'); await key('Escape'); await key('Escape'); await settle(); Find.window.forget(); }
  // At rest the foot says no hint; one height from the opening, whatever is listed; a kind named, no mark before a name.
  { Find.window.open(); await settle();
    const foot = () => doc.querySelector('.fd-foot').textContent, dlg = doc.querySelector('dialog.fd');
    assert.ok(!/type to find|for a command/.test(foot()), 'no hint at rest'); assert.ok(foot().includes('Enter'), 'what Enter does stays');
    assert.equal(dlg.style.height, 236 + 12 * 32 + 'px', 'room for the rows shown');
    assert.ok(!fs.readFileSync(path.join(root, 'find/logseq/find.js'), 'utf8').includes('minHeight'), 'no height is kept from what was listed');
    await type('>'); await settle(); assert.equal(dlg.style.height, 236 + 12 * 32 + 'px'); assert.equal(dlg.style.minHeight, '', 'the commands leave no height behind');
    await key('Backspace'); await type('mei'); await settle(); assert.equal(dlg.style.height, 236 + 12 * 32 + 'px');
    assert.ok(doc.querySelector('.fd-w.lk-node') && !doc.querySelector('.fd-w.lk-bare'), 'where sorts mix, a page keeps its mark');
    await key('Escape'); await settle();
    Find.window.open(); await settle(); await type('doct'); await settle(); await key('Tab'); await settle();
    assert.ok(doc.querySelector('.fd-w.lk-node') && !doc.querySelector('.fd-w.lk-node:not(.lk-bare)'), 'under a kind picked, no mark');
    await key('Escape'); await settle(); }
  // The foot: the words in the text colour, the key faint.
  assert.ok(styles['find-find'].includes('.fd-foot .fd-k { color: var(--fd-faint);') && /\.fd-foot \{[^}]*color: var\(--lk-text/.test(styles['find-find']), 'the key faint, what it does in the text colour');
  // A date and time is kept as its milliseconds, not as a node: read as an id it made Logseq throw (the tag Symptomatic Event,
  // "Highest supported entity id is 2147483647, got 1791874800000"). Now no line says the graph could not be read, and the value reads as its day.
  { BLOCKS[40].onset = 1791874800000; BLOCKS[41].onset = 1791874800000; Find.window.forget(); Find.db.forget();
    Find.window.open(); await settle(); await type('cons'); await key('Tab'); await settle();
    assert.equal(doc.querySelectorAll('.fd-r').length, 4, 'the kind lists its nodes');
    assert.ok(!text('.fd-none').some(t => /could not be read/.test(t)), 'and says nothing of the graph not being read: ' + text('.fd-none'));
    assert.ok(!text('.fd-ck').includes('Onset'), 'a date and time is left to the months, not offered as words');
    await key('ArrowRight'); await settle();
    assert.ok(text('.fd-kids .fd-kv').join().includes('OnsetOct 13'), 'dug, it reads as its day: ' + text('.fd-kids .fd-kv'));
    await key('Escape'); await key('Escape'); await settle(); delete BLOCKS[40].onset; delete BLOCKS[41].onset; Find.window.forget(); Find.db.forget(); }
  // The sentence, read: a kind, a name, a time, in any order; "around" widens the month; the joining words say nothing.
  { const read = (...a) => JSON.parse(JSON.stringify(Find.sentence.read(...a))), today = new Date(2026, 10, 5);   // read in the plugin's own realm: its arrays are copied into this one
    const names = { kinds: new Map([['consultation', { id: 2, uuid: U(2), title: 'Consultation' }]]), pages: new Map([['dr. mei chen', { id: 20, uuid: U(20), title: 'Dr. Mei Chen' }]]), values: null };
    let r = read('Consultation with Dr. Mei Chen around May 2026', names, today);
    assert.deepEqual(r.picks.map(p => p.kind), ['tag', 'who', 'when'], 'kind, who, when');
    assert.deepEqual(r.spans.map(x => [x.cls, x.note]), [['fd-kind', 'kind'], ['fd-stop', ''], ['fd-who', 'node'], ['fd-when', 'when']], 'each stretch with its note, the joining word quiet, "around" part of the time');
    assert.deepEqual([r.picks[2].from, r.picks[2].to, r.picks[2].nearFrom, r.picks[2].nearTo, r.picks[2].label], [20260401, 20260630, 20251230, 20260930, 'around May 2026'], 'around May: April to June, near from the turn of the year to September');
    assert.deepEqual(r.words, [], 'nothing left to narrow by letters');
    r = read('mei chen consultation', names, today);
    assert.deepEqual([r.picks.map(p => p.kind), r.words, r.trail], [['tag'], ['mei', 'chen'], []], 'letters that name nothing narrow the rows; after the kind nothing trails');
    r = read('Consultation with mei', names, today);
    assert.deepEqual([r.trail, r.trailFrom], [['mei'], 18], 'the last words, less the joining one, are the trail Tab completes');
    r = read('7 May', names, today); assert.deepEqual([r.picks[0].from, r.picks[0].to, r.picks[0].around], [20260507, 20260507, false], 'a day');
    r = read('May', names, today); assert.equal(r.picks[0].from, 20260501, 'a month alone is the latest one up to today');
    r = read('Dec', names, today); assert.equal(r.picks[0].from, 20251201, 'December, in November, is last year\'s');
    r = read('2025', names, today); assert.deepEqual([r.picks[0].from, r.picks[0].to], [20250101, 20251231], 'a year');
    r = read('last month', names, today); assert.deepEqual([r.picks[0].from, r.picks[0].to], [20261001, 20261031], 'last month');
    r = read('Hydroxychloroquine 200 mg', names, today); assert.deepEqual(r.picks, [], 'a bare number is no time');
    r = read('Consultation, 7 May', names, today); assert.deepEqual(r.picks.map(p => p.kind), ['tag', 'when'], 'a comma after the kind is no part of its name');
    // A period: two times joined by "to", "until", a dash, or "between … and"; "since" runs to today (the owner, 5 November 2026: "is this able to show periods").
    const span = r => { const p = r.picks.find(p => p.kind === 'when'); return [p.from, p.to, p.label]; };
    assert.deepEqual(span(read('Consultation from May to August 2026', names, today)), [20260501, 20260831, 'May–Aug 2026'], 'May to August');
    assert.deepEqual(read('Consultation from May to August 2026', names, today).spans.map(x => [x.cls, x.note]), [['fd-kind', 'kind'], ['fd-stop', ''], ['fd-when', 'when']], 'the period one stretch, "from" quiet before it');
    assert.deepEqual(span(read('between 2024 and 2025', names, today)), [20240101, 20251231, '2024–2025'], 'between two years');
    assert.deepEqual(span(read('May–August', names, today)), [20260501, 20260831, 'May–Aug 2026'], 'a dash joins them too');
    assert.deepEqual(span(read('7–21 May', names, today)), [20260507, 20260521, '7–21 May 2026'], 'two days of one month');
    assert.deepEqual(span(read('Nov to Feb', names, today)), [20251101, 20260228, 'Nov 2025–Feb 2026'], 'a start that would follow its end moves a year back');
    assert.deepEqual(span(read('since March', names, today)), [20260301, 20261105, 'since Mar 2026'], 'since: up to today');
    assert.deepEqual(span(read('around May to June 2026', names, today)), [20260401, 20260731, 'around May–Jun 2026'], 'around widens both ends');
    assert.deepEqual(span(read('May to', names, today)), [20260501, 20260531, 'May 2026'], 'a "to" with nothing after it is only a quiet word'); }
  // Find by sentence: its own command opens the same window as a sentence; the pieces are the default (the owner, 5 November 2026:
  // "only as something that is triggered or addon to find"). Tab completes the word in the sentence; a time keeps the rows in
  // its window, lists the ones just outside under Near, and draws the year line.
  { Find.window.sentence(); await settle();
    const dlg = doc.querySelector('dialog.fd');
    assert.ok(dlg.classList.contains('fd-say') && dlg.style.height === 308 + 12 * 32 + 'px', 'the window as a sentence, with room for the notes and the year line');
    await type('cons'); await key('Tab');
    assert.equal(doc.querySelector('.fd-input').value, 'Consultation ', 'Tab completes the word in the sentence');
    assert.deepEqual(text('.fd-mirror .fd-note'), ['kind'], 'and the window pencils "kind" above it');
    assert.equal(doc.querySelectorAll('.fd-piece').length, 0, 'no pieces');
    await type('Consultation with mei'); await key('Tab');
    assert.equal(doc.querySelector('.fd-input').value, 'Consultation with Dr. Mei Chen ', 'Tab puts her name in place of the letters, the joining word kept');
    assert.deepEqual(text('.fd-mirror .fd-note'), ['kind', 'Provider'], 'the property she came through is pencilled above her name');
    assert.deepEqual([...doc.querySelectorAll('.fd-mirror .fd-part')].map(e => e.className), ['fd-part fd-kind', 'fd-part fd-stop', 'fd-part fd-who'], 'the kind, the joining word quiet, the node');
    assert.ok(doc.querySelector('.fd-mirror .fd-note.lk-name'), 'the note is the shared small name over a value');
    assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'her three consultations');
    await type('Consultation with '); assert.deepEqual(text('.fd-mirror .fd-note'), ['kind'], 'taking her name out of the sentence reads the kind alone'); assert.equal(doc.querySelectorAll('.fd-r').length, 4, 'and widens the list');
    await key('ArrowRight'); await settle(); assert.ok(doc.querySelector('.fd-kids'), '→ at the end of the sentence digs'); await key('ArrowLeft'); await settle(); assert.ok(!doc.querySelector('.fd-kids'), '← closes');
    await type('Consultation in September 2026'); await settle();
    assert.deepEqual(text('.fd-mirror .fd-note'), ['kind', 'when'], 'the kind and the time are read');
    assert.deepEqual(text('.fd-r .fd-day'), ['Sep 14', 'Sep 1', 'Oct 7', 'Aug 20'], 'September\'s two rows, then the near ones');
    assert.deepEqual(text('.fd-near'), ['Near'], 'under their head');
    assert.ok([...doc.querySelectorAll('.fd-r')].slice(2).every(r => r.previousElementSibling), 'after the rows found');
    const svg = doc.querySelector('.fd-line svg');
    assert.ok(svg && svg.querySelector('.fd-band') && svg.querySelectorAll('.fd-dot').length === 2 && svg.querySelectorAll('.fd-hollow').length === 2, 'the year line: a band for September, two dots, two hollow');
    assert.deepEqual([...svg.querySelectorAll('text')].map(t => t.textContent).slice(0, 3), ['Jan', '2026', 'Feb'], 'the months named, the year above January');
    assert.ok(!text('.fd-ck').includes('When'), 'with a time said, the months are not offered');
    await type('Consultation around September 2026'); await settle();
    assert.deepEqual(text('.fd-r .fd-day'), ['Oct 7', 'Sep 14', 'Sep 1', 'Aug 20'], 'around September reaches August and October');
    assert.deepEqual(text('.fd-near'), [], 'and nothing is near');
    await type('Consultation from August to September 2026'); await settle();
    assert.deepEqual(text('.fd-mirror .fd-note'), ['kind', 'when'], 'a period is read as the time');
    assert.deepEqual(text('.fd-r .fd-day'), ['Sep 14', 'Sep 1', 'Aug 20', 'Oct 7'], 'August to September: three rows, October near');
    assert.ok(doc.querySelector('.fd-line svg .fd-band') && doc.querySelectorAll('.fd-line svg .fd-dot').length === 3, 'the band spans the two months, three dots in it');
    // The line opened (the owner, 5 November 2026, from timeline-mockup.html: "looks good build it"): Up from the first line of
    // choices grows it in place; each day a column, the dots piled; the newest ringed and named; Left and Right walk them; Down
    // digs under the line; Up lays the lanes out; Escape closes what was dug, then folds the line.
    { const S = Find.window.state, line = () => doc.querySelector('.fd-line svg');
      const groupOfFirst = () => !doc.querySelector('.fd-ch:first-child .fd-lit, .fd-ch:first-child .fd-more.fd-lit');   // true until the lit choice is on the first line
      await type('Consultation from August to October 2026'); await settle();
      assert.equal(line().getAttribute('height'), '52', 'the strip, before');
      assert.ok(doc.querySelectorAll('.fd-c').length > 0, 'lines of choices stand between the line and the rows');
      await key('ArrowUp'); assert.equal(S.mode, 'choices', 'Up from the first row steps into the choices');
      while (S.mode === 'choices' && groupOfFirst()) await key('ArrowUp');
      assert.ok(text('.fd-foot').join(' ').includes('the line'), 'the foot offers the line from the first line of choices');
      await key('ArrowUp'); assert.deepEqual([S.mode, S.line, line().getAttribute('height')], ['line', 1, '148'], 'Up from the first line of choices opens the line to its full height');
      assert.equal(dlg.style.height, 308 + 12 * 32 + 96 + 'px', 'the window grows by what the line grew');
      assert.deepEqual([line().querySelectorAll('.fd-dot').length, line().querySelectorAll('.fd-hollow').length, line().querySelectorAll('.fd-ring').length], [4, 0, 1], 'the four dots, the cursor\'s ringed');
      assert.equal(S.lineDots[S.lineAt].node.day, 20261007, 'the cursor starts on the newest dot found');
      const name = doc.querySelector('.fd-line .fd-name');
      assert.ok(name && !name.hidden && name.textContent.startsWith('Oct 7') && name.querySelector('.lk-day'), 'the dot named beside it, day first in the margin\'s grey');
      assert.deepEqual(text('.fd-foot .fd-k'), ['Enter', 'Shift Enter', '↓', '↑', 'Escape'], 'the foot: open, in the sidebar, dig, lanes, fold');
      await key('ArrowLeft'); assert.equal(S.lineDots[S.lineAt].node.day, 20260914, 'Left walks to the dot before');
      assert.ok(doc.querySelector('.fd-line .fd-name').textContent.startsWith('Sep 14'), 'and names it');
      await key('ArrowDown'); await settle();
      assert.ok(S.lineDug && doc.querySelector('.fd-body > .fd-kids') && doc.querySelector('.fd-body').firstElementChild.classList.contains('fd-kids'), 'Down digs the dot\'s node: its box under the line, before the choices');
      assert.equal(S.mode, 'line', 'the cursor stays on the dot');
      assert.ok(text('.fd-foot').join(' ').includes('into it'), 'Down would step into it');
      await key('ArrowDown'); assert.deepEqual([S.mode, S.rowAt], ['rows', 0], 'Down again steps the cursor into what opened');
      await key('Escape'); await settle(); assert.deepEqual([S.lineDug, S.dug.length, S.mode], [null, 0, 'line'], 'Escape closes what was dug and the cursor is back on the dot');
      await key('ArrowUp'); assert.deepEqual([S.line, text('.fd-line .fd-lane'), text('.fd-line .fd-by .on')], [2, ['Dr. Mei Chen', 'Dr. Sofia Alvarez', 'others'], ['by Provider']], 'Up lays the lanes out: the first choice line\'s values, then the rest');
      assert.equal(line().getAttribute('height'), String(24 + 3 * 44 + 28), 'a lane a value');
      await key('ArrowUp'); assert.deepEqual([S.line, text('.fd-line .fd-by .on')], [1, ['one lane']], 'Up again gathers them');
      await key('Escape'); assert.deepEqual([S.line, S.mode, line().getAttribute('height')], [0, 'rows', '52'], 'Escape folds the line to the strip');
      line().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); assert.deepEqual([S.line, S.mode], [1, 'line'], 'a click on the strip opens it');
      await key('ArrowLeft'); await key('ArrowRight');
      opened.length = 0; await key('Enter'); assert.deepEqual([opened, !!doc.querySelector('dialog.fd')], [[U(S.lineDots[S.lineAt].node.id)], false], 'Enter opens the dot\'s node and the window closes');
      Find.window.sentence(); await settle(); }
    // Down past the last row found steps on to the near rows; → digs one of them too.
    await type('Consultation in September 2026'); await settle();
    await key('ArrowDown'); await key('ArrowDown'); assert.ok(doc.querySelectorAll('.fd-r')[2].classList.contains('on'), 'the cursor steps on to the near rows');
    await key('ArrowRight'); await settle(); assert.ok(doc.querySelector('.fd-kids'), 'a near row digs'); await key('ArrowLeft'); await settle();
    // The When choice says the month with its year, so it reads as that month.
    await type('Consultation '); await settle(); await key('Tab'); await key('ArrowDown'); await key('ArrowDown');
    assert.ok(doc.querySelector('.fd-c.fd-lit')?.textContent.startsWith('Oct'), 'the cursor on October: ' + doc.querySelector('.fd-c.fd-lit')?.textContent); await key('Enter'); await settle();
    assert.equal(doc.querySelector('.fd-input').value, 'Consultation Oct 2026 ', 'said with its year');
    assert.deepEqual(text('.fd-r .fd-day'), ['Oct 7', 'Sep 14', 'Sep 1', 'Aug 20'], 'October, then the three months before it near');
    await key('Escape'); await settle(); }
  // A name alone: everything that points at the page, the property it came through pencilled above the name, the kinds among them.
  { Find.window.sentence(); await settle(); await type('Dr. Mei Chen'); await settle();
    assert.deepEqual(text('.fd-mirror .fd-note'), ['Provider'], 'the property most of them came through');
    assert.equal(doc.querySelectorAll('.fd-r').length, 3, 'her three consultations');
    assert.deepEqual(text('.fd-c'), ['Consultation3', 'Oct1', 'Sep2'], 'the kinds among them, and their months');
    assert.ok(doc.querySelector('.fd-line svg .fd-dot'), 'the year line draws them');
    await type('Dr. Mei Chen tingling'); await settle();
    assert.equal(doc.querySelectorAll('.fd-r').length, 1, 'the other words narrow them');
    await key('Tab'); assert.equal(Find.window.state.mode, 'choices', 'with nothing lit, Tab steps into the choices'); await key('Tab'); await settle();
    assert.equal(doc.querySelector('.fd-input').value, 'Dr. Mei Chen tingling Consultation ', 'and Tab again says the one under the cursor after the words, since they did not light it');
    await key('Escape'); await settle(); }
  // The sentence's key from the pieces turns the open window into a sentence; from a sentence it closes; the command is registered.
  { Find.window.open(); await settle(); await type('cons'); await key('Tab');
    Find.window.sentence(); await settle(); const dlg = doc.querySelector('dialog.fd');
    assert.ok(dlg && dlg.classList.contains('fd-say') && doc.querySelectorAll('.fd-piece').length === 0 && dlg.style.height === 308 + 12 * 32 + 'px', 'the open window turns to a sentence, the picks gone');
    Find.window.sentence(); await settle(); assert.equal(doc.querySelector('dialog.fd'), null, 'pressed again, it closes');
    assert.deepEqual(commands, ['Find', 'Find by sentence'], 'both commands are registered'); }
  // the key specimen, and the stop
  assert.ok(Find.settings.specimen({ key: 'takesSearchKey', type: 'boolean' }, true).includes('Cmd K'), 'the key specimen, in plain words');
  await logseq._unload();
  assert.equal(doc.querySelectorAll('dialog, .fd-own').length, 0, 'nothing of the plugin\'s is left after the stop');
  assert.deepEqual(errors, [], 'no errors');
  console.log('ok: ' + order.length + ' files load; the window opens, narrows by choice and by letters, digs, widens, opens a row, lists commands, closes; the stop sweeps');
})().catch(error => { console.error(error); process.exit(1); });
