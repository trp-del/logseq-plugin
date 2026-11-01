/* node test/load.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules)
   Loads the plugin's files, in files.js's order, against a stand-in for Logseq: a fake `logseq` whose queries answer
   from the mockup's graph in the shapes Logseq 2.0.2 returns, and whose editor calls are recorded. It draws the screen
   into a jsdom page, walks it with the words on the cards and the keys every list has (arrows, Enter, Escape, space),
   walks the trail back, answers a fix's ask, reads the tray, applies and undoes, and shows that the sidebar's tree draws
   alone with a cursor of its own. Only the real app shows the rest. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const { sample } = require('./sample.js');
const { root, order } = require('../../test/module.js')('structure');
const raw = sample(), id = n => raw.idOf.get(n), pid = n => raw.propIdOf.get(n), LOOSE_ROW = 'N';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The graph as Logseq's queries hand it back: pulled maps with shortened keys, idents with a colon.
let datedNodes = [], graphName = 'logseq_db_Test', lateNodes = {}, failOn = null, ranges = {}, declared = {}, pagesReal = false, duringWrite = null, deleted = new Set();
let failQuery = null;
const calls = [], taken = new Set();   // taken: names some other page, tag or property holds
let live = JSON.parse(JSON.stringify({ tags: raw.tags, props: raw.props, nodes: raw.nodes, holders: raw.holders }));
function fakeQuery(q) {
  const has = (...p) => p.every(x => q.includes(x));
  if (has(':logseq.class/Tag] [?t :db/ident _]')) return [...live.tags.map(t => [{ id: t.id, uuid: t.uuid, title: t.title, ident: ':user.class/' + t.title.replace(/\s/g, '-'), extends: t.parents.map(p => ({ id: p, ident: ':user.class/x' })), properties: t.props.map(p => ({ id: p })) }]), [{ id: 2, uuid: 'u2', title: 'Tag', ident: ':logseq.class/Tag', extends: [{ id: 1 }] }]];
  if (has(':logseq.class/Property] [?p :db/ident _]')) return live.props.map(p => [{ id: p.id, uuid: p.uuid, title: p.title, ident: ':' + p.ident, 'logseq.property/type': ':' + p.type, cardinality: ':db.cardinality/one', classes: p.range.map(r => ({ id: r })) }]);
  if (has('closed-value-property')) return live.props.filter(p => p.choice).map(p => [p.id]);
  if (/^\[:find \?u :where \[\?b :block\/tags (\d+)\]/.test(q)) return (lateNodes[q.match(/:block\/tags (\d+)/)[1]] || []).map(u => [u]);   // the last look before a delete
  if (has('[?b :block/uuid ?u] (not')) return Object.entries(live.nodes).flatMap(([t, list]) => list.map(n => [Number(t), n.id, n.uuid]));
  if (has('[?b ?a _] [?p :db/ident ?a]')) return Object.entries(live.holders).flatMap(([a, ids]) => ids.map(b => [':' + a, b]));
  if (has('(count ?v)')) return raw.pointed.map(([a, t, n]) => [':' + a, t, n]);
  if (has('(max ?c)')) return [[id('Consultation'), Date.UTC(2026, 9, 28)]];
  if (has(':find ?b ?u ?title ?c ?pg')) { const ids = new Set(q.match(/ground \[([\d ]*)\]/)[1].split(' ').map(Number)); return Object.entries(live.nodes).flatMap(([t, list]) => list.filter(n => ids.has(n.id)).map((n, i) => [n.id, n.uuid, `Node ${i + 1} of tag ${t}`, 1000 + n.id, 7])); }
  if (has(':find ?b ?d ?name')) return datedNodes;
  if (has('[?b :block/page ?pg] [?pg :block/journal-day ?d]')) return [];
  if (has('[?b :block/title ?title] [(get-else')) { const t = Number(q.match(/:block\/tags (\d+)/)[1]); return (live.nodes[t] || []).slice(0, 30).map((n, i) => [n.uuid, `Node ${i + 1} of tag ${t}`, 1000 + i, i % 2 ? 0 : 7]); }
  if (has('[?p :block/name ')) return taken.has(JSON.parse(q.match(/:block\/name ("[^"]*")/)[1])) ? [[1]] : [];
  if (has('[?b :block/page ?t]') || has('clojure.string/includes?')) return [];
  if (has('(count ?b)')) return [[1, 'follow-up', 19], [2, 'first', 71]];
  if (has(':logseq.property/classes ?c]')) { const u = q.match(/#uuid "([^"]+)"/)[1]; return (ranges[u] ??= [...(live.props.find(p => p.uuid === u)?.range || [])]).map(c => [c]); }
  if (has(':logseq.property.class/properties ?p]')) { const u = q.match(/#uuid "([^"]+)"/)[1]; return (declared[u] ??= [...(live.tags.find(t => t.uuid === u)?.props || [])]).map(c => [c]); }
  if (has('[?t :block/uuid #uuid')) { const u = q.match(/#uuid "([^"]+)"/)[1], t = live.tags.find(x => x.uuid === u); return t && !deleted.has(u) ? [[t.id]] : []; }
  if (has('[?p :block/uuid #uuid')) return [[id('Consultation')]];
  return [];
}
const html = `<html><head></head><body><div id="main-content-container"><div id="holder"></div></div><div id="right-sidebar"><div class="sidebar-item"><div class="page-title"><h3>x</h3></div><div id="side"></div></div></div></body></html>`;
const dom = new JSDOM(html, { pretendToBeVisual: true });
const win = dom.window, doc = win.document;
win.Element.prototype.scrollIntoView = () => {};
const styles = {}; let unload = null;
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, provideStyle: ({ key, style }) => { styles[key] = style; }, provideModel() {}, beforeunload(fn) { unload = fn; },
  App: { onCurrentGraphChanged(fn) { logseq.graphChanged = fn; }, getCurrentGraph: async () => ({ name: graphName }), onRouteChanged() {}, pushState: (...a) => calls.push(['pushState', ...a]), registerCommandPalette() {}, registerUIItem() {}, setRightSidebarVisible() {} },
  DB: { onChanged(fn) { logseq.changed = fn; }, datascriptQuery: async q => { if (failQuery?.test(q)) throw new Error('the read failed'); return fakeQuery(q); } },
  UI: { showMsg: (text, status) => calls.push(['notify', status, text]) },
  Editor: {
    getCurrentPage: async () => ({ uuid: 'page-uuid' }), openInRightSidebar: (...a) => calls.push(['openInRightSidebar', ...a]),
    addTagExtends: async (t, p) => calls.push(['addTagExtends', t, p]), removeTagExtends: async (t, p) => calls.push(['removeTagExtends', t, p]),
    renamePage: async (u, n) => calls.push(['renamePage', u, n]), addBlockTag: async (n, t) => calls.push(['addBlockTag', n, t]), removeBlockTag: async (n, t) => calls.push(['removeBlockTag', n, t]),
    upsertBlockProperty: async (u, k, v) => calls.push(['upsertBlockProperty', u, k, v]), removeBlockProperty: async (u, k) => calls.push(['removeBlockProperty', u, k]),
    createPage: async (name) => { calls.push(['createPage', name]); return { uuid: 'new-' + name, id: 9000 + calls.length }; }, deletePage: async u => calls.push(['deletePage', u]),
  },
};
// A failure on demand, and the two lists Logseq lets a plugin only clear and fill, kept as Logseq would.
for (const name of Object.keys(logseq.Editor)) {
  const real = logseq.Editor[name];
  logseq.Editor[name] = async (...a) => {
    if (/^(add|remove|upsert|rename|create|delete)/.test(name)) { duringWrite?.(name, a); if (failOn?.(name, a)) { calls.push(['refused', name, ...a]); throw new Error('Logseq refused'); } }
    if (name === 'removeBlockProperty') { if (a[1].endsWith('classes')) ranges[a[0]] = []; else declared[a[0]] = []; }
    if (name === 'upsertBlockProperty' && a[1].endsWith('classes')) (ranges[a[0]] ||= []).push(a[2]);
    if (name === 'upsertBlockProperty' && a[1].endsWith('class/properties')) (declared[a[0]] ||= []).push(a[2]);
    if (name === 'deletePage') deleted.add(a[0]);
    if (pagesReal && name === 'deletePage') live.tags = live.tags.filter(t => t.uuid !== a[0]);
    const out = await real(...a);
    if (pagesReal && name === 'createPage') live.tags.push({ id: out.id, uuid: out.uuid, title: a[0], parents: [], props: [] });
    return out;
  };
}
const sandbox = { window: win, document: doc, logseq, console, setTimeout, clearTimeout, Promise, Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp, Error };
Object.defineProperty(win, 'parent', { value: win });
vm.createContext(sandbox);
for (const f of order) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const key = (el, k, extra = {}) => el.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
const click = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const rowText = r => text(r.querySelector('.nm')) + ' ' + text(r.querySelector('.ct'));
const plain = x => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

(async () => {
  for (let i = 0; i < 40 && !win.Structure?.app?.readAt; i++) await sleep(25);
  const S = win.Structure, app = S.app;
  assert.ok(app.readAt, 'the graph was read');
  assert.equal(app.tray.model.kinds.map(k => k.name).join(), 'Entity,Occurrence,Phenomena,Information');
  // The main view.
  const view = S.view.make(doc.getElementById('holder'), 'page', app); app.mounted(view);
  const R = view.root;
  assert.ok(doc.getElementById('st-style'), 'the stylesheet is in Logseq\'s head');
  let rows = [...R.querySelectorAll('.st-row[data-row]')];
  assert.equal(rows.length, 4 + 4 + 4 + 4 + 9 + 1, 'the four kinds and their direct children, and the root row, one screen');
  assert.equal(rowText(rows[0]), 'Entity 78'); assert.ok(rows[0].querySelector('.st-km'), 'a kind carries its mark');
  const occ = rows.find(r => rowText(r).startsWith('Occurrence')); assert.equal(occ.querySelector('.iss').className, 'iss on', 'a faint dot: issues below');
  assert.ok(R.querySelector('.st-card h2'), 'a card is drawn'); assert.equal(text(R.querySelector('.st-tray')), '', 'the tray is empty');
  // Consultation's card: one path line ending on the thing itself, the two lists on its right, what it can take as words.
  app.st.cur = id('Consultation'); app.st.open.add(id('Medical event')); app.draw();
  assert.equal(text(R.querySelector('.st-ttl .st-place')), 'Medical event/Occurrence', 'the place in the tree at the title row\'s right end, nearest first'); assert.ok(R.querySelector('.st-ttl .st-place .lk-tag'), 'as tags');
  deq([...R.querySelectorAll('.st-views span')].map(text), ['tags', 'every property', 'health · ' + app.issues().length], 'the three views as words above the tree');
  assert.ok(R.querySelector('.st-row .st-bul') && R.querySelector('.st-row .lk-fold svg'), 'a row is built as a block: bullet, Logseq\'s chevron');
  assert.equal(text(R.querySelector('.st-card h2')), 'Consultation');
  assert.ok(text(R.querySelector('.st-card .sum')).startsWith('90 nodes'), text(R.querySelector('.st-card .sum')));
  deq([...R.querySelectorAll('.st-card .acts .act')].map(text), ['rename', 'move under…', 'new tag inside', 'add a property…'], 'what the tag can take, as words');
  const lines = [...R.querySelectorAll('.st-card .st-ln:not(.iss)')].map(text);
  const flat = lines.map(l => l.replace(/\s/g, '')); assert.equal(flat[0], 'Date90of90', 'own properties by how filled, the number without a bar'); assert.ok(flat.includes('ProviderpointsatDoctor87of90'), flat.join(' | ')); assert.ok(flat.includes('NotesinheritedfromMedicalevent'), flat.join(' | '));
  assert.ok(flat.includes('SourceonReport41'), 'pointed at by: the property, on the tag');
  assert.ok(R.querySelector('.st-card .lk-tag[data-go]'), 'a tag named on the card carries Look\'s name');
  // An issue with a line of its own on the card puts its fix at that line's right end, after the count; no Issues group then.
  assert.equal(text(R.querySelector('.st-ln.fx')).replace(/\s/g, ''), 'WithpointsatPerson7of90drop,orleave', 'the fix is a word, no letter, on the line it concerns'); assert.ok(!R.querySelector('.st-ln.iss') && ![...R.querySelectorAll('.st-card h3')].some(h => text(h) === 'Issues'), 'the Issues group stays only for issues with no line of their own');
  assert.ok(R.querySelector('.st-ln.fx .fix[data-fix]'), 'the fix on the line opens the ask like any other');
  assert.equal(R.querySelector('.st-row.cur .iss').className, 'iss own', 'a firm dot on the row with the issue');
  assert.ok(!R.querySelector('.st-keys'), 'no legend of keys');
  // Move: the word on the card opens the prompt under the row; type, Enter; the move waits in the tray, pencilled in on the row.
  click(R.querySelector('[data-do="move"]')); assert.ok(R.querySelector('.st-prompt'), 'the move prompt opens'); assert.ok(R.querySelector(`[data-row="${id('Consultation')}"] + .st-prompt`), 'in place, under its row'); assert.ok(text(R.querySelector('.st-prompt .ask')).startsWith('Move Consultation under'));
  const pin = R.querySelector('[data-pin]'); pin.value = 'conv'; pin.dispatchEvent(new win.Event('input', { bubbles: true }));
  deq([...R.querySelectorAll('.st-prompt [data-pick] .nm')].map(text), ['Conversation']);
  key(R.querySelector('[data-pin]'), 'Enter');
  assert.ok(!R.querySelector('.st-prompt'));
  assert.equal(text(R.querySelector('.st-tray')), '1 change waitingMove Consultation from Medical event to Conversation90 nodes×Apply · one Undo for 90 nodesCmd EnterDiscardCmd Delete');
  assert.equal(S.model.parentOf(app.tray.model, id('Consultation')), id('Conversation'), 'the tree shows the move before Apply');
  assert.ok(R.querySelector(`[data-row="${id('Consultation')}"] .nm .lk-pencil`) && R.querySelector('.st-card h2 .lk-pencil'), 'pencilled in with Look\'s name: the row and the card');
  // A single letter is not a command: typed on the tree, it finds.
  key(R, 'm'); assert.equal(app.st.find, 'm', 'a letter goes to the find box'); assert.ok(!R.querySelector('.st-prompt')); assert.equal(doc.activeElement, R.querySelector('[data-find]'));
  // Letters typed in the box stay in order, the caret after the last, whatever the redraw between them.
  for (const c of 'ons') { const b = R.querySelector('[data-find]'), at = b.selectionStart; b.value = b.value.slice(0, at) + c + b.value.slice(at); b.setSelectionRange(at + 1, at + 1); b.dispatchEvent(new win.Event('input', { bubbles: true })); }
  assert.equal(app.st.find, 'mons'); assert.equal(doc.activeElement, R.querySelector('[data-find]')); assert.equal(doc.activeElement.selectionStart, 4, 'the caret stays after the last letter');
  key(R.querySelector('[data-find]'), 'Escape'); assert.equal(app.st.find, '');
  // After any box the keyboard is the map's: the find box, a prompt, a tick by mouse.
  assert.equal(doc.activeElement, R, 'Escape in the find box hands the keyboard back to the map');
  R.querySelector('.st-card .act[data-do="move"]').click(); assert.equal(doc.activeElement, R.querySelector('[data-pin]'));
  key(R.querySelector('[data-pin]'), 'Escape'); assert.equal(doc.activeElement, R, 'and so does Escape in a prompt');
  const ticked = R.querySelector('.st-row .lk-tick'); ticked.focus(); ticked.click(); assert.equal(doc.activeElement, R, 'and a tick by mouse');
  key(R, 'Escape'); assert.equal(app.st.ticks.size, 0, 'Escape then clears it');
  // Tick two with space, merge into the cursor's row from its card.
  app.st.cur = id('Procedure'); app.draw(); key(R, ' '); key(R, 'ArrowDown'); key(R, ' ');
  assert.equal(app.st.ticks.size, 2); assert.equal(R.querySelectorAll('.lk-tick:checked').length, 2); assert.ok(R.querySelector('.lk-list[data-picking]'), 'the list says it is being picked from'); assert.ok(text(R.querySelector('.st-pick')).startsWith('2 ticked'), 'the pick bar above the tree');
  app.st.cur = id('Stay'); app.draw(); key(R, 'ArrowUp'); key(R, 'ArrowUp'); key(R, 'ArrowUp'); assert.equal(app.st.cur, id('Blood draw'));
  assert.ok(!R.querySelector('.st-views') && R.querySelector('.st-left > .st-pick'), 'the bar stands in the place of the three words, so the rows stay'); const mergeWord = R.querySelector('.st-card [data-do="merge"]'); assert.equal(text(mergeWord), 'merge the 2 ticked tags into this'); const staged = app.tray.changes.length; click(mergeWord);
  assert.equal(app.tray.changes.length, staged, 'a merge from the ticks asks first, as a fix does'); assert.equal(R.querySelectorAll('.st-card .st-ln.ask .st-two').length, 2, 'each merge shown side by side on the card'); assert.equal(R.querySelectorAll('.st-card [data-stage]').length, 1, 'one word stages them');
  key(R, 'Enter'); assert.equal(app.st.ticks.size, 0, 'Enter stages them and the ticks go');
  deq(app.tray.lines().map(l => l.text).slice(1), ['Merge Procedure into Blood draw, Procedure removed', 'Merge Scan into Blood draw, Scan removed']);
  // A fix from the card first says what it would do; Enter stages it (the issue now names the tags still under Medical event).
  app.st.cur = id('Medical event'); app.draw();
  const fix = [...R.querySelectorAll('.st-ln.iss .fix')].find(f => text(f).startsWith('pull up'));
  assert.ok(fix, [...R.querySelectorAll('.st-ln.iss')].map(text).join(' | ')); const before = app.tray.changes.length; click(fix);
  assert.equal(app.tray.changes.length, before, 'nothing staged yet'); const ask = R.querySelector('.st-ln.ask'); assert.ok(ask, 'the ask line opens under the issue');
  assert.ok(text(ask).startsWith('Move Date from Blood draw'), text(ask)); assert.ok(/\d+ nodes/.test(text(ask)), 'with the nodes it touches');
  const pull = [...R.querySelectorAll('.st-ln.iss')].find(l => text(l).startsWith('Date')); assert.ok(pull.querySelector('.w .sj[data-prop]') && pull.querySelectorAll('.w .lk-tag').length === 3 && pull.querySelector('.w .nm'), 'the issue keyed by role: the property opens its card, the tags as tags, the count a number'); assert.ok(!text(pull).includes('declared'));
  key(R, 'Escape'); assert.ok(!R.querySelector('.st-ln.ask'), 'Escape leaves it'); assert.equal(app.tray.changes.length, before);
  click([...R.querySelectorAll('.st-ln.iss .fix')].find(f => text(f).startsWith('pull up'))); key(R, 'Enter');
  assert.equal(app.tray.changes.length, before + 1); assert.ok(app.tray.lines().at(-1).text.startsWith('Move Date from Blood draw'), app.tray.lines().at(-1).text);
  // Rename in place: the word, type, Enter.
  app.st.cur = id('Stay'); app.draw(); click(R.querySelector('[data-do="rename"]')); const ed = R.querySelector('[data-edit]'); assert.ok(ed, 'a field in the row'); ed.value = 'Hospital stay'; key(ed, 'Enter');
  assert.equal(app.tray.lines().at(-1).text, 'Rename Stay to Hospital stay');
  // A line taken out of the tray.
  assert.ok(R.querySelector('.st-tray [data-drop="0"].lk-x'), 'the × that takes a change out is the library\'s');
  click(R.querySelector('[data-drop="0"]')); assert.equal(S.model.parentOf(app.tray.model, id('Consultation')), id('Medical event'));
  assert.equal(app.tray.changes.length, 4);
  // The table and the Health list open from the path line; Escape walks back along the trail.
  click(R.querySelector('[data-show="table"]')); assert.equal(text(R.querySelector('.st-card h2')), 'Every property'); assert.equal(R.querySelectorAll('.st-tbl .tr').length, 20, 'a few properties'); assert.equal(text(R.querySelector('.st-tbl [data-all="table"]')), `show all ${app.tray.model.props.size}`, 'then show all'); click(R.querySelector('[data-all="table"]')); assert.equal(R.querySelectorAll('.st-tbl .tr').length, app.tray.model.props.size, 'one row per property'); assert.ok([...R.querySelectorAll('.st-tbl .tr')].some(r => r.querySelectorAll('.on')[0].querySelectorAll('.lk-tag').length > 1), 'a row names every tag the property is on');
  assert.equal(text(R.querySelector('.st-trail')), 'Hospital stay›', 'the trail, with the name as it will be; it ends with ›, the title being where you are');
  assert.ok(!R.querySelector('.st-fill'), 'no bars'); assert.ok(!text(R.querySelector('.st-card .sum')).includes('sorted'), 'no sentence under the title: the lit head says the sort'); assert.ok(R.querySelector('.st-tbl .tr .lk'), 'a name carries the underline that means it opens');
  click(R.querySelector('[data-sort="name"]')); assert.equal(text(R.querySelector('.st-tbl .tr span')), 'About');
  click(R.querySelector('.st-tbl .tr')); assert.ok(R.querySelector('[data-propcard]'), 'a row opens the property\'s card'); assert.equal(text(R.querySelector('.st-card h2')), 'About');
  assert.equal(text(R.querySelector('.st-trail')), 'Hospital stay›every property›');
  key(R, 'Escape'); assert.equal(app.st.view, 'table', 'back to the table'); key(R, 'Escape'); assert.equal(app.st.view, 'tree'); assert.equal(app.st.cur, id('Stay'), 'back to Stay');
  assert.ok(!R.querySelector('.st-trail'), 'the trail is walked');
  // Editing a property: what it points at, a tag taken out and one added, waiting in the tray.
  app.st.propCur = `${id('Consultation')}·${pid('With')}`; app.st.cur = id('Consultation'); app.draw();
  assert.equal(text(R.querySelector('.st-card h2')), 'With'); assert.equal(R.querySelectorAll('.st-ln.rng').length, 1, 'Person, one row');
  assert.equal(text(R.querySelector('.st-ttl .st-place')), 'Consultation/Medical event/Occurrence', 'the property\'s place, nearest first');
  deq([...R.querySelectorAll('.st-card .acts .act')].map(text), ['rename', 'move to…', 'pull up to Medical event', 'split by its values…', 'drop'], 'short words on one line; another tag it points at is the last line of the Points at list');
  assert.equal(text(R.querySelector('.st-card .sum')), 'points at Person7 of 90 filled', 'the facts once: the tag is already named at the title row\'s right end');
  assert.ok(![...R.querySelectorAll('.st-card h3')].some(h => text(h) === 'Filled, by tag beneath'), 'no list of one row that repeats the facts line');
  click(R.querySelector('[data-unrange]')); assert.equal(app.tray.lines().at(-1).text, 'Set With to point at any node'); assert.equal(R.querySelectorAll('.st-ln.rng').length, 0);
  click(R.querySelector('[data-addrange]')); assert.ok(text(R.querySelector('.st-prompt .ask')).startsWith('With points at'), 'the last line adds a tag it points at');
  R.querySelector('[data-pin]').value = 'organ'; R.querySelector('[data-pin]').dispatchEvent(new win.Event('input', { bubbles: true })); key(R.querySelector('[data-pin]'), 'Enter');
  assert.equal(app.tray.lines().at(-1).text, 'Set With to point at Organisation'); assert.equal(text(R.querySelector('.st-ln.rng .tg')), 'Organisation');
  app.tray.changes.splice(-2, 2); app.tray.rebuild(); app.st.propCur = null; app.st.trail = []; app.draw();
  // A prompt that holds more than it shows says so, and shows the rest.
  click(R.querySelector('[data-do="move"]')); assert.ok(/^show all \d+$/.test(text(R.querySelector('.st-prompt .st-row.more'))), 'the last row says how many there are');
  const shortList = R.querySelectorAll('.st-prompt .st-row').length; click(R.querySelector('.st-prompt .st-row.more')); assert.ok(R.querySelectorAll('.st-prompt .st-row').length > shortList && !R.querySelector('.st-prompt .st-row.more'), 'and lists them all');
  assert.equal(R.ownerDocument.activeElement, R.querySelector('[data-pin]'), 'the keyboard stays in the prompt'); key(R.querySelector('[data-pin]'), 'Escape');
  click(R.querySelector('[data-show="health"]')); assert.equal(text(R.querySelector('.st-card h2')), 'Health'); assert.ok(!text(R.querySelector('.st-hl .sum')).includes('a fix first'), 'Health keeps no sentence explaining itself'); assert.ok([...R.querySelectorAll('.st-hl h3')].map(text).includes('Names say what they are'));
  assert.ok(!R.querySelector('.st-hl .fix kbd'), 'no key letters'); assert.ok(R.querySelector('.st-hl .fix.act'));
  // A merge is shown side by side before it is staged: the two tags with their properties lined up.
  const mergeFix = [...R.querySelectorAll('.st-hl .fix')].find(f => text(f).startsWith('merge')); assert.ok(mergeFix, 'a merge to settle'); click(mergeFix);
  assert.equal(R.querySelectorAll('.st-two .h').length, 2, 'two columns'); assert.ok(text(R.querySelector('.st-two .h')).includes('removed') && text(R.querySelector('.st-ln.ask')).includes('stage it'), 'the one going says so; the words wait');
  assert.ok(!/retagged|nodes\s*stage it/.test(text(R.querySelector('.st-ln.ask'))), 'the count once, in the column head: not in the sentence, not after it'); assert.ok(R.querySelector('.st-two .pr .n') && R.querySelector('.st-ln.ask.two'), 'the names at the left of their column');
  assert.ok([...R.querySelectorAll('.st-hl .st-ln.iss .w')].every(w => !w.querySelector('.lk-tag:first-child')), 'no leading tag on a Health row: the thing to settle leads');
  assert.ok([...R.querySelectorAll('.st-hl .st-ln.iss .w')].some(w => w.querySelectorAll('.lk-tag').length === 3 && /and \d+ more/.test(text(w))), 'a run of many tags is cut to three and "and N more"');
  key(R, 'Escape'); assert.ok(!R.querySelector('.st-two'));
  key(R, 'Escape'); assert.equal(app.st.view, 'tree');
  // A kind folds like any row, each level is one step in, as deep as the tree goes, and a long name is not cut.
  const kindRow = () => R.querySelector(`[data-row="${id('Occurrence')}"]`);
  assert.ok(R.querySelector(`[data-row="${id('Medical event')}"]`), 'a kind starts open');
  click(kindRow().querySelector('.lk-fold')); assert.equal(R.querySelector(`[data-row="${id('Medical event')}"]`), null, 'its fold arrow closes it');
  click(kindRow().querySelector('.lk-fold')); assert.ok(R.querySelector(`[data-row="${id('Medical event')}"]`), 'and opens it');
  assert.equal(R.querySelector(`[data-row="${id('Consultation')}"]`).getAttribute('style'), '--d:2', 'the indent is the depth');
  const sheet = doc.getElementById('st-style').textContent;
  assert.ok(sheet.includes('calc(var(--d, 0) * 12px)') && !/\.st-row \.nm \{[^}]*nowrap/.test(sheet), 'one step per level, and a name wraps');
  // The right-click menu has the card's words, and leaves the cursor where it is.
  const row = R.querySelector(`[data-row="${id('Consultation')}"]`); row.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }));
  deq([...R.querySelectorAll('.st-menu div:not(.gap)')].map(text).slice(0, 4), ['Open everything underShift →', 'Tickspace', 'Rename', 'New tag inside']); assert.ok([...R.querySelectorAll('.st-menu div')].some(d => /^Move under…\d+ nodes$/.test(text(d))), 'what reaches many says how many');
  assert.equal(app.st.cur, id('Consultation'));
  key(R, 'Escape'); assert.ok(!R.querySelector('.st-menu'));
  // Apply with ⌘⏎: the writer's calls, in order; then one Undo puts them back in reverse.
  calls.length = 0;
  key(R, 'Enter', { metaKey: true }); for (let i = 0; i < 40 && app.st.busy; i++) await sleep(10); await sleep(20);
  const ops = calls.map(c => c[0]);
  assert.equal(ops.filter(o => o === 'addBlockTag').length, 53); assert.equal(ops.filter(o => o === 'deletePage').length, 2);
  assert.ok(ops.indexOf('deletePage') > ops.lastIndexOf('removeBlockTag', ops.indexOf('deletePage')), 'a tag is deleted after its nodes are retagged');
  assert.ok(calls.some(c => c[0] === 'upsertBlockProperty' && c[1] === raw.tags.find(t => t.title === 'Medical event').uuid && c[2] === 'logseq.property.class/properties' && c[3] === pid('Date')), 'Date declared on Medical event');
  assert.ok(calls.some(c => c[0] === 'renamePage' && c[2] === 'Hospital stay'));
  assert.equal(text(R.querySelector('.st-tray')), '4 changes applied'); assert.ok(R.querySelector('.st-tray .st-done .lk-undo') && !R.querySelector('.st-tray .done'), 'the arrow carries Look\'s name; no .done for Logseq to strike through');
  calls.length = 0;
  await app.undo();
  const back = calls.map(c => c[0]);
  assert.equal(back[0], 'renamePage', 'undone in reverse: the rename first'); assert.equal(calls[0][2], 'Stay');
  assert.equal(back.filter(o => o === 'createPage').length, 2, 'the merged tags come back'); assert.ok(calls.some(c => c[0] === 'createPage' && c[1] === 'Procedure'));
  assert.equal(back.filter(o => o === 'addBlockTag').length, 53, 'their nodes get them back, once each');
  assert.equal(text(R.querySelector('.st-tray')), '');
  // The nodes of a tag: Enter on the row, tick with space, the word moves the ticked.
  app.st.cur = id('Consultation'); app.st.view = 'tree'; app.st.trail = []; app.draw(); key(R, 'Enter'); await sleep(30);
  assert.equal(app.st.view, 'nodes'); assert.equal(R.querySelectorAll('.st-nodes .st-ln').length, 20); assert.ok(R.querySelector('.st-nodes .lk-node[data-uuid]'));
  assert.equal(R.querySelectorAll('.st-nodes .lk-node.lk-bare').length, 20, 'under a head naming the tag, no mark before a name');
  assert.ok(!R.querySelector('.st-nodes .sum') && !text(R.querySelector('.st-nodes .st-pick')), 'no sentence explains the list; the bar\'s room stays, empty, so a tick moves no row');
  assert.equal(text(R.querySelector('.st-ttl .st-place')), 'Consultation/Medical event/Occurrence'); assert.ok(R.querySelector('.st-nodes .st-ln .lk-day') && R.querySelector('.st-nodes .st-ln .st-bul'), 'a node\'s row: the day in the margin, the bullet');
  key(R, ' '); key(R, 'ArrowDown'); key(R, ' '); click(R.querySelector('[data-do="nmove"]')); assert.ok(text(R.querySelector('.st-prompt .ask')).startsWith('Move 2 ticked nodes under'));
  R.querySelector('[data-pin]').value = 'call'; R.querySelector('[data-pin]').dispatchEvent(new win.Event('input', { bubbles: true })); key(R.querySelector('[data-pin]'), 'Enter');
  assert.equal(app.tray.lines()[0].text, 'Move 2 nodes from Consultation to Call');
  key(R, 'Backspace', { metaKey: true }); assert.equal(app.tray.changes.length, 0, '⌘⌫ discards'); assert.equal(text(R.querySelector('.st-tray')), '1 change dropped', 'and says so');
  key(R, 'Escape'); assert.equal(app.st.view, 'tree', 'Escape walks back from the nodes');
  const Mo = S.model;
  // The count opens what it counts: a tag with no nodes of its own lists those beneath; the words of the title and the number agree.
  { const parent = id('Medical event'), m = app.tray.model, n = Mo.count(m, parent);
    app.st.cur = parent; app.st.view = 'tree'; app.st.trail = []; app.draw(); click(R.querySelector('[data-nodes]')); await sleep(30);
    assert.equal(app.st.nodes.list.length, n, 'as many as the card said'); assert.ok(text(R.querySelector('.st-ttl')).startsWith(`${n} nodes of Medical event`));
    assert.ok(app.st.nodes.list.every(x => Mo.under(m, x.tag, parent)), 'each with the tag it carries');
    // Ticks moved: the tray's pencilled count follows, from the tag each carries.
    const from = app.st.nodes.list[0].tag, to = Mo.kids(m, parent).find(k => k !== from), had = Mo.count(m, from), hadTo = Mo.count(m, to);
    key(R, ' '); click(R.querySelector('[data-do="nmove"]')); R.querySelector('[data-pin]').value = m.tags.get(to).title; R.querySelector('[data-pin]').dispatchEvent(new win.Event('input', { bubbles: true })); key(R.querySelector('[data-pin]'), 'Enter');
    assert.equal(Mo.count(app.tray.model, from) + 1, had, 'the tag it left counts one fewer');
    assert.equal(Mo.count(app.tray.model, to) - 1, hadTo, 'the tag it went to one more');
    assert.equal(app.st.nodes.list.length, n, 'still under the tag: still in its list, as its count says');
    assert.ok(app.tray.plan().some(s => s.op === 'removeTag'), 'and Apply would write it'); key(R, 'Backspace', { metaKey: true }); key(R, 'Escape'); }
  // The margin of the list: a date property first, an Entity none.
  { const uuidless = id('Consultation'), first = [...app.tray.model.tags.get(uuidless).nodes][0];
    datedNodes = [[first, 20260903, 'Date'], [first, 20260101, 'Other']];
    assert.equal((await app.readNodes(uuidless))[0].day, 20260903, 'the date property titled Date'); datedNodes = []; }
  // A property's card says inherited only from a tag above it.
  { const m = app.tray.model, child = id('Consultation'), inh = Mo.inherited(m, child)[0], other = [...m.tags.values()].find(t => !t.kind && !Mo.under(m, child, t.id) && !t.props.includes(inh.prop));
    m.props.get(inh.prop).on.unshift(other.id); app.st.cur = child; app.st.propCur = `${child}·${inh.prop}`; app.draw();
    assert.ok(text(R.querySelector('.st-card .sum')).includes(`inherited from ${m.tags.get(inh.from).title}`), 'the tag above it: ' + text(R.querySelector('.st-card .sum')));
    m.props.get(inh.prop).on.shift(); app.st.propCur = null; app.draw(); }
  // A row click moves the cursor and no more: the trail is for jumps.
  { app.st.trail = []; app.st.view = 'tree'; app.st.propCur = null; app.draw();
    for (const name of ['Scan', 'Call', 'Stay']) click(R.querySelector(`[data-row="${id(name)}"]`));
    assert.equal(app.st.cur, id('Stay')); assert.equal(app.st.trail.length, 0, 'three clicks, no trail');
    app.st.trail = Array.from({ length: 9 }, (_, i) => ({ view: 'tree', cur: id('Scan'), propCur: null, nodes: null })); app.draw();
    assert.equal(R.querySelectorAll('.st-trail .lk-step').length, 4, 'the trail stays one line: the last few places'); click(R.querySelector('.st-trail .lk-step')); assert.equal(app.st.trail.length, 5, 'each still its own step back'); app.st.trail = []; app.draw(); }
  // The lit row of a prompt is one Enter can take, and the arrows pass over the others.
  { const m = app.tray.model, first = Mo.kids(m, m.kinds.find(k => Mo.kids(m, k.id).length).id)[0];
    app.st.cur = first; app.draw(); click(R.querySelector('[data-do="move"]'));
    const pin = () => R.querySelector('[data-pin]'), rows = () => [...R.querySelectorAll('.st-prompt .st-row')];
    // A letter that puts the tag itself, which is off, first in the list, with something it can go under after it.
    const letter = [...'abcdfghjklmopqrsuvwxz'].find(c => { pin().value = c; pin().dispatchEvent(new win.Event('input', { bubbles: true })); return rows()[0]?.classList.contains('off') && rows().some(r => !r.classList.contains('off') && !r.classList.contains('more')); });
    assert.ok(letter, 'a list that starts on a row that is off');
    assert.ok(!R.querySelector('.st-prompt .st-row.lit.off'), 'that row is not lit');
    const lit = R.querySelector('.st-prompt .st-row.lit .nm').textContent; key(pin(), 'ArrowUp'); assert.equal(R.querySelector('.st-prompt .st-row.lit .nm').textContent, lit, 'Up does not land on it');
    key(pin(), 'Enter'); assert.ok(!R.querySelector('.st-prompt') && app.tray.changes.length === 1, 'Enter takes it: ' + lit); key(R, 'Backspace', { metaKey: true }); }
  // Down passes over a row that is off to the one after it.
  { app.st.cur = id('Medical event'); app.draw(); click(R.querySelector('[data-do="move"]'));
    const pin = () => R.querySelector('[data-pin]'), rows = () => [...R.querySelectorAll('.st-prompt .st-row')], off = rows().findIndex(r => r.classList.contains('off'));
    assert.ok(off > 0 && rows().slice(off).some(r => !r.classList.contains('off')), 'a row that is off with rows to take on both sides');
    for (let i = 0; i < rows().length; i++) key(pin(), 'ArrowDown');
    assert.ok(rows().findIndex(r => r.classList.contains('lit')) > off, 'the cursor went past it'); key(pin(), 'Escape'); }
  // The × on a tag's own page asks here first: what it would do, with the nodes it touches; Enter stages, Apply writes.
  { const m = app.tray.model, tag = id('Consultation'), t = m.tags.get(tag), parent = m.tags.get(t.parents[0]);
    await app.askTakeOut(t.uuid, parent.uuid); await sleep(10);
    const ask = text(R.querySelector('.st-ln.ask'));
    assert.ok(ask.startsWith(`Take Consultation out from under ${parent.title}`) && ask.includes(`${Mo.count(m, tag)} nodes`), ask);
    assert.equal(app.tray.changes.length, 0, 'nothing waits before the yes');
    await app.reread(); assert.ok(R.querySelector('.st-ln.ask'), 'a reading of the graph, which opening the map brings, leaves the ask');
    key(R, 'Escape'); assert.ok(!R.querySelector('.st-ln.ask') && !app.tray.changes.length, 'Escape leaves it');
    await app.askTakeOut(t.uuid, parent.uuid); await sleep(10); key(R, 'Enter');
    assert.equal(app.tray.changes.length, 1); assert.ok(app.tray.lines()[0].text.startsWith('Take Consultation out from under'));
    assert.equal(app.tray.plan().map(s => s.op).join(), 'removeExtends'); key(R, 'Backspace', { metaKey: true });
    await app.askTakeOut(t.uuid, 'not-a-tag'); assert.ok(!R.querySelector('.st-ln.ask'), 'a place it no longer holds is not asked about'); }
  // Dragging a row onto another: the move waits in the tray, the ticked ones together.
  app.st.cur = id('Scan'); app.st.ticks.clear(); app.st.view = 'tree'; app.st.nodes = null; app.draw();
  const drag = (from, to, type = 'drop') => { const src = R.querySelector(`[data-row="${from}"]`), dst = R.querySelector(`[data-row="${to}"]`); src.dispatchEvent(new win.Event('dragstart', { bubbles: true, cancelable: true })); dst.dispatchEvent(new win.Event('dragover', { bubbles: true, cancelable: true })); const over = dst.classList.contains('over'); dst.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true })); return over; };
  assert.ok(R.querySelector(`[data-row="${id('Scan')}"]`).getAttribute('draggable') === 'true' && !R.querySelector(`[data-row="${id('Occurrence')}"]`).hasAttribute('draggable'), 'tags drag, kinds do not');
  assert.ok(drag(id('Scan'), id('Treatment')), 'the row under the pointer shows where it will go');
  assert.equal(app.tray.lines()[0].text, 'Move Scan from Medical event to Treatment'); assert.equal(S.model.parentOf(app.tray.model, id('Scan')), id('Treatment'));
  assert.ok(!drag(id('Medical event'), id('Stay')), 'no drop under its own child'); assert.equal(app.tray.changes.length, 1);
  app.st.ticks.add(id('Stay')); app.st.ticks.add(id('Procedure')); app.st.cur = id('Stay'); app.draw(); click(R.querySelector('[data-do="move"]')); R.querySelector('[data-pin]').value = 'not under'; R.querySelector('[data-pin]').dispatchEvent(new win.Event('input', { bubbles: true }));
  assert.deepEqual([...R.querySelectorAll('.st-prompt [data-pick] .nm')].map(text), ['Not under a kind']); key(R.querySelector('[data-pin]'), 'Enter');
  deq(app.tray.lines().slice(1).map(l => l.text), ['Take Stay out from under Medical event', 'Take Procedure out from under Medical event']); assert.equal(app.tray.model.loose.length, 2);
  app.discard();
  // A new tag under no kind (the root row has a card of its own), and a kind renamed.
  app.st.cur = 'N'; app.draw(); assert.equal(text(R.querySelector('.st-card h2')), 'Not under a kind'); click(R.querySelector('[data-do="new"]')); const nf = R.querySelector('[data-edit]'); assert.ok(nf); nf.value = 'Scratch'; key(nf, 'Enter'); await sleep(10);
  assert.equal(app.tray.lines()[0].text, 'Make Scratch under no kind'); assert.ok(app.st.cur < 0);
  app.st.cur = id('Phenomenon'); app.draw(); click(R.querySelector('[data-do="rename"]')); const kf = R.querySelector('[data-edit]'); assert.ok(kf, 'a kind can be renamed'); kf.value = 'Phenomena'; key(kf, 'Enter');
  assert.equal(app.tray.lines()[1].text, 'Rename Phenomenon to Phenomena'); app.discard();
  // A new tag cannot take a name in use, a tag's or a page's: the line stays and says so; and Apply refuses one that came to be taken.
  taken.add('dr. mei chen');
  for (const name of ['consultation', 'Dr. Mei Chen']) {
    app.st.cur = 'N'; app.draw(); click(R.querySelector('[data-do="new"]')); const typed = R.querySelector('[data-edit]'); typed.value = name; typed.dispatchEvent(new win.Event('input', { bubbles: true })); calls.length = 0; key(typed, 'Enter'); await sleep(10);
    assert.equal(app.tray.changes.length, 0, name + ' is not staged'); assert.ok(calls.some(c => c[0] === 'notify' && c[2].includes('already in the graph')), 'a notice says so'); assert.equal(R.querySelector('[data-edit]')?.value, name, 'the line stays, the words in it');
    key(R.querySelector('[data-edit]'), 'Escape');
  }
  app.stage({ kind: 'make', name: 'Late', under: null }); taken.add('late'); calls.length = 0; await app.apply();
  assert.ok(!calls.some(c => c[0] === 'createPage'), 'Apply refuses a name taken since'); assert.ok(calls.some(c => c[0] === 'notify' && c[2].includes('already in the graph')));
  app.discard(); taken.clear();
  // A merge's child tags: taken off before the delete, so no Root Tag stays on them, and back under the tag Undo makes. A name
  // held by the kept tag (two of one name) is not reused: Logseq's createPage would hand the kept tag back.
  const medical = raw.tags.find(t => t.title === 'Medical event'), child = raw.tags.find(t => t.parents[0] === medical.id), keptTag = raw.tags.find(t => t.title === 'Treatment');
  app.stage({ kind: 'merge', from: medical.id, into: keptTag.id }); calls.length = 0; await app.apply();
  const offKid = calls.findIndex(c => c[0] === 'removeTagExtends' && c[1] === child.uuid && c[2] === medical.uuid), gone = calls.findIndex(c => c[0] === 'deletePage' && c[1] === medical.uuid);
  assert.ok(offKid >= 0 && offKid < gone, 'the child tag is taken off before its parent goes');
  taken.add('medical event'); calls.length = 0; await app.undo();
  assert.ok(calls.some(c => c[0] === 'createPage' && c[1] === 'Medical event 2') && !calls.some(c => c[0] === 'createPage' && c[1] === 'Medical event'), 'the next free name, not the one held');
  assert.ok(calls.some(c => c[0] === 'addTagExtends' && c[1] === child.uuid && c[2] === 'new-Medical event 2'), 'the child back under the tag Undo made');
  taken.clear();
  // A failure halfway. A declared property cleared and not filled again: the tag gets back what it had, and the notice says so truly.
  const CP = 'logseq.property.class/properties', visit = raw.tags.find(t => t.title === 'Visit'), notices = () => calls.filter(c => c[0] === 'notify').map(c => c[2]), undoArrow = () => R.querySelector('.st-tray .st-done .lk-undo');
  const count = name => calls.filter(c => c[0] === name).length, fresh = () => { calls.length = 0; ranges = {}; declared = {}; failOn = null; deleted.clear(); };
  app.tray.done = null; fresh(); let once = true;
  app.stage({ kind: 'dropProp', prop: pid('Date'), tag: visit.id });
  failOn = (name, a) => { if (name === 'upsertBlockProperty' && a[1] === CP && once) { once = false; return true; } return false; };
  await app.apply();
  deq(declared[visit.uuid].sort(), visit.props.slice().sort(), 'cut short halfway, the tag gets every property back'); assert.ok(notices()[0].includes('at step 1 of 1') && notices()[0].includes('nothing was written')); assert.equal(app.tray.changes.length, 1, 'the line waits');
  app.discard();
  // The first inverse fails: every other still runs, the count is said, the arrow stands for what is left, and only that runs again.
  fresh(); const movedA = raw.tags.find(t => t.title === 'Scan'), movedB = raw.tags.find(t => t.title === 'Stay'), under = raw.tags.find(t => t.title === 'Treatment');
  app.stage({ kind: 'move', tag: movedA.id, to: under.id }); app.stage({ kind: 'move', tag: movedB.id, to: under.id });
  failOn = (name, a) => (name === 'addTagExtends' && a[0] === movedB.uuid) || (name === 'removeTagExtends' && a[0] === movedA.uuid && a[1] === under.uuid);
  await app.apply();
  assert.ok(notices()[0].includes('1 step could not be put back'), notices()[0]); assert.ok(!notices()[0].includes('were put back'));
  assert.equal(count('addTagExtends'), 2, 'the step, and the inverse of Scan\'s old parent, which ran after the failure'); assert.ok(undoArrow(), 'the arrow stands for it'); assert.equal(text(R.querySelector('.st-done')), '1 step not put back');
  calls.length = 0; failOn = null; await app.undo();
  assert.equal(calls.filter(c => c[0] !== 'notify').length, 1, 'only what failed runs again'); assert.equal(app.tray.done, null); assert.ok(!undoArrow());
  app.discard(); app.tray.note = '';
  // A failed Undo pressed again runs what is left, not everything from the top.
  fresh(); app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); await app.apply(); assert.ok(undoArrow());
  calls.length = 0; failOn = name => name === 'addBlockTag'; await app.undo();
  assert.equal(count('createPage'), 1, 'the tag came back'); assert.ok(notices()[0].startsWith('Could not undo 31 of'), notices()[0]); assert.equal(text(R.querySelector('.st-done')), '31 steps not undone');
  calls.length = 0; failOn = null; await app.undo();
  assert.equal(count('createPage'), 0, 'not made twice'); assert.equal(count('addBlockTag'), 31, 'the rest, each once'); assert.equal(count('renamePage'), 0); assert.equal(app.tray.done, null);
  // The tag cannot come back: what needs it fails and stays, and writes nothing on a dead uuid.
  fresh(); app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); await app.apply(); calls.length = 0; failOn = name => name === 'createPage'; await app.undo();
  assert.equal(count('addBlockTag'), 0, 'nothing named the tag while it was not back'); assert.ok(notices()[0].includes('not back') || notices()[0].includes('refused'));
  calls.length = 0; failOn = null; await app.undo(); assert.equal(count('createPage'), 1); assert.equal(count('addBlockTag'), 31); assert.equal(app.tray.done, null);
  // A delete Logseq refused: nothing is made twice. A read that fails before the delete stops it, so no value dies with the tag.
  fresh(); app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); failOn = name => name === 'deletePage'; await app.apply();
  assert.equal(count('createPage'), 0, 'the tag was never gone, so none is made'); assert.equal(app.tray.changes.length, 1); app.discard();
  for (const clause of ['[?b ?a ', '[?b :user.property/', 'logseq.property/classes ?c']) {
    fresh(); failQuery = new RegExp(clause.replace(/[[?\]/.]/g, '\\$&'));
    const pr = raw.props.find(p => p.range.includes(id('Consultation')) && p.type === 'node'); live.nodes[9999] = [];
    if (clause.startsWith('logseq')) app.stage({ kind: 'setRange', prop: pr.id, to: [] }); else app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') });
    const reading = S.db.valueRefs, ids = S.db.valueIds;
    if (clause === '[?b :user.property/') S.db.valueRefs = async () => [{ uuid: 'held', ident: 'user.property/x' }];
    failQuery = clause.startsWith('[?b ?a ') ? /\[\?b \?a \d+\]/ : clause.startsWith('[?b :user') ? /\[\?b :user\.property\/x \?v\]/ : /logseq\.property\/classes \?c\]/;
    await app.apply(); S.db.valueRefs = reading; failQuery = null;
    assert.equal(count('deletePage'), 0, `a failed read stops it (${clause})`); assert.equal(count('removeBlockProperty'), 0, 'and nothing is cleared on a read that failed'); assert.ok(notices().some(t => t.includes('the read failed'))); app.discard();
  }
  // A failed Apply put a deleted tag back under a new id: the line follows it, and pressing Apply again does the merge.
  fresh(); pagesReal = true; const saved = JSON.stringify(live);
  app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); app.stage({ kind: 'move', tag: movedA.id, to: under.id });
  failOn = (name, a) => name === 'addTagExtends' && a[0] === movedA.uuid; await app.apply();
  assert.equal(app.tray.changes.length, 2, 'both lines wait'); const newId = app.tray.changes[0].from; assert.notEqual(newId, visit.id); assert.equal(app.tray.lines()[0].text.split(',')[0], 'Merge Visit into Consultation');
  calls.length = 0; failOn = null; await app.apply(); assert.equal(count('deletePage'), 1, 'the merge ran again, not skipped'); assert.equal(app.tray.changes.length, 0);
  live = JSON.parse(saved); pagesReal = false; app.tray.done = null; await app.reread();
  // A node given the tag after the read: moved by the merge's last look, not left to lose the tag. A tag to remove that has nodes now stays.
  fresh(); lateNodes[visit.id] = ['late-node']; app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); await app.apply();
  assert.ok(calls.some(c => c[0] === 'addBlockTag' && c[1] === 'late-node' && c[2] === raw.tags.find(t => t.title === 'Consultation').uuid), 'on to the kept tag'); assert.ok(calls.findIndex(c => c[0] === 'removeBlockTag' && c[1] === 'late-node') < calls.findIndex(c => c[0] === 'deletePage'));
  calls.length = 0; await app.undo(); assert.ok(calls.some(c => c[0] === 'addBlockTag' && c[1] === 'late-node' && c[2] !== raw.tags.find(t => t.title === 'Consultation').uuid), 'and back'); assert.ok(calls.some(c => c[0] === 'removeBlockTag' && c[1] === 'late-node'));
  lateNodes = {}; fresh(); const source = raw.tags.find(t => t.title === 'Source'); lateNodes[source.id] = ['late-node']; app.stage({ kind: 'remove', tag: source.id }); await app.apply();
  assert.equal(count('deletePage'), 0); assert.ok(notices()[0].includes('has nodes now')); lateNodes = {}; app.discard();
  // A range holds what the map does not show: kept by an edit, and by its Undo.
  fresh(); const maker = raw.props.find(p => p.title === 'Maker'); ranges[maker.uuid] = [...maker.range, 99999]; app.stage({ kind: 'setRange', prop: maker.id, to: [id('Organisation')] }); await app.apply();
  deq([...ranges[maker.uuid]].sort(), [99999, id('Organisation')].sort(), 'Logseq\'s tag stays'); await app.undo(); deq(ranges[maker.uuid], [...maker.range, 99999]);
  // Only added to: nothing is cleared.
  fresh(); ranges[maker.uuid] = [id('Person')]; app.stage({ kind: 'setRange', prop: maker.id, to: [...app.tray.model.props.get(maker.id).range, id('Organisation')] }); await app.apply(); assert.equal(count('removeBlockProperty'), 0, 'a range only added to is not cleared'); app.tray.done = null;
  // A merge: the kept tag takes the merged one's place in a range; Undo puts the merged one back there.
  fresh(); const pointed = raw.props.find(p => p.range.includes(id('Consultation')) && p.type === 'node'), keeps = raw.tags.find(t => t.title === 'Report');
  app.stage({ kind: 'merge', from: id('Consultation'), into: keeps.id }); await app.apply(); assert.ok(ranges[pointed.uuid].includes(keeps.id) && !ranges[pointed.uuid].includes(id('Consultation')), 'swapped');
  await app.undo(); assert.ok(!ranges[pointed.uuid].includes(id('Consultation')) && ranges[pointed.uuid].some(x => x > 9000) && !ranges[pointed.uuid].includes(keeps.id) === !pointed.range.includes(keeps.id), 'the tag Undo made is back in it');
  // A stale map: read on opening, read again under a waiting tray, and a line that lost its tag says so.
  fresh(); let rereadsN = 0; const reading = app.reread; app.reread = async () => { rereadsN++; }; const again = S.view.make(doc.getElementById('side'), 'page', app); app.mounted(again); assert.equal(rereadsN, 1, 'read on opening'); again.destroy(); app.reread = reading;
  app.st.cur = id('Stay'); app.stage({ kind: 'rename', tag: movedB.id, name: 'Stay B' }); app.stage({ kind: 'move', tag: movedA.id, to: under.id }); const liveTags = live.tags;
  live.tags = live.tags.filter(t => t.id !== movedB.id); calls.length = 0;
  logseq.changed({ blocks: [{ id: 9101, title: 'Words', tags: [{ id: 9003, ident: 'user.class/Doctor' }], page: { id: 9002 } }], txMeta: { outlinerOp: 'save-block' } });
  await sleep(1650); deq(app.tray.lines().map(l => l.text), ['Move Scan from Medical event to Treatment']); assert.ok(notices().some(t => t.includes('left the tray')), 'a line that lost its tag says so'); assert.ok(app.tray.model.tags.has(app.st.cur) || app.st.cur === 'N', 'the cursor is on something');
  // The same at Apply: nothing is written, and the tray waits to be looked at.
  app.stage({ kind: 'rename', tag: movedA.id, name: 'Scan B' }); live.tags = live.tags.filter(t => t.id !== under.id); calls.length = 0; await app.apply();
  assert.ok(!calls.some(c => c[0] !== 'notify'), 'nothing written'); deq(app.tray.lines().map(l => l.text), ['Rename Scan to Scan B']); assert.ok(text(R.querySelector('.st-tray')).includes('1 change waiting'), 'and the tray is drawn again'); live.tags = liveTags; app.discard(); await app.reread(); app.tray.note = '';
  // The tray: staging keeps the last Undo, drawn with the lines; a discard keeps it; while Apply runs nothing can be staged or thrown away.
  fresh(); app.stage({ kind: 'rename', tag: movedA.id, name: 'Scan B' }); await app.apply(); assert.ok(undoArrow());
  app.stage({ kind: 'rename', tag: movedB.id, name: 'Stay B' }); app.draw(); assert.ok(undoArrow(), 'staged: the arrow stays'); assert.ok(text(R.querySelector('.st-tray')).includes('1 change waiting') && text(R.querySelector('.st-tray')).includes('1 change applied'));
  app.discard(); assert.equal(text(R.querySelector('.st-tray')), '1 change dropped1 change applied', 'discarded: the arrow stays, the line says what went'); calls.length = 0; await app.undo(); assert.ok(calls.some(c => c[0] === 'renamePage'), 'and it undoes');
  fresh(); app.stage({ kind: 'rename', tag: movedA.id, name: 'Scan B' }); app.stage({ kind: 'rename', tag: movedB.id, name: 'Stay B' }); let refused = 'not tried';
  duringWrite = () => { duringWrite = null; refused = app.stage({ kind: 'rename', tag: under.id, name: 'Treatment B' }); key(R, 'Backspace', { metaKey: true }); app.dropChange(0); };
  await app.apply(); assert.equal(refused, null, 'refused'); assert.equal(app.tray.changes.length, 0); assert.ok(notices().some(t => t.includes('Wait for this')), 'and says so'); assert.equal(count('renamePage'), 2, 'discard and × did nothing to the run'); app.tray.done = null; app.tray.note = '';
  // A run that fails after a discard or a × was tried: the lines wait, none lost.
  fresh(); app.stage({ kind: 'rename', tag: movedA.id, name: 'Scan B' }); app.stage({ kind: 'rename', tag: movedB.id, name: 'Stay B' });
  duringWrite = () => { duringWrite = null; app.discard(); app.dropChange(0); failOn = name => name === 'renamePage'; };
  await app.apply(); assert.equal(app.tray.changes.length, 2, 'both lines still wait'); app.discard(); app.tray.note = ''; failOn = null;
  // Another graph midway: not one more write, nothing put back into the graph now open, the Undo waits for its graph, and the map starts afresh.
  fresh(); app.st.ticks.add(movedA.id); app.st.cur = movedA.id; app.st.propCur = 'x'; app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') });
  let writes = 0; duringWrite = () => { if (++writes === 5) { duringWrite = null; graphName = 'logseq_db_Other'; logseq.graphChanged(); } };
  await app.apply();
  assert.ok(calls.filter(c => !['notify', 'refused'].includes(c[0])).length <= 5, 'stopped at the next step'); assert.ok(notices()[0].includes('another graph was opened'), notices()[0]); assert.equal(count('deletePage'), 0);
  await sleep(30); assert.equal(app.tray.changes.length, 0); assert.equal(app.tray.done, null, 'no arrow in the other graph'); assert.equal(app.st.ticks.size, 0); assert.equal(app.st.propCur, null); assert.ok(text(R.querySelector('.st-tray')).includes('dropped'), 'the tray says so'); assert.equal(app.st.busy, '');
  calls.length = 0; graphName = 'logseq_db_Test'; logseq.graphChanged(); await sleep(30); assert.ok(undoArrow(), 'back in its graph, the arrow is there'); await app.undo(); assert.equal(app.tray.done, null); assert.ok(count('removeBlockTag') + count('addBlockTag') > 0);
  // A step that fails because the graph went from under it: stopped as a switch, not put back into the graph now open.
  fresh(); app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); writes = 0;
  failOn = () => { if (++writes === 4) { graphName = 'logseq_db_Other'; return true; } return false; };
  await app.apply(); assert.ok(notices()[0].includes('another graph was opened'), notices()[0]); assert.equal(calls.filter(c => c[0] === 'refused').length, 1, 'one step refused, no inverse tried');
  await sleep(10); failOn = null; graphName = 'logseq_db_Test'; logseq.graphChanged(); await sleep(30); await app.undo(); assert.equal(app.tray.done, null); app.discard(); app.tray.note = '';
  // The new graph not answering yet: no notice, and the map waits for it.
  fresh(); let reads = 0; const readNow = S.db.read; S.db.read = async () => { if (++reads < 3) throw new Error('Failed to fetch'); return readNow(); };
  logseq.graphChanged(); await sleep(700); S.db.read = readNow; assert.ok(!notices().some(t => t.includes('could not be read')), 'nothing said while it opens'); assert.ok(reads >= 3);
  // Pressing Undo, with another graph opened midway: it stops, and the rest waits.
  fresh(); app.stage({ kind: 'merge', from: visit.id, into: id('Consultation') }); await app.apply(); calls.length = 0; writes = 0;
  duringWrite = () => { if (++writes === 3) { duringWrite = null; graphName = 'logseq_db_Other'; logseq.graphChanged(); } }; await app.undo();
  assert.ok(calls.filter(c => c[0] !== 'notify').length <= 3, 'stopped'); assert.ok(notices().some(t => t.includes('the Undo waits in Test')), 'and says where'); await sleep(30);
  graphName = 'logseq_db_Test'; logseq.graphChanged(); await sleep(30); assert.ok(undoArrow()); calls.length = 0; await app.undo(); assert.equal(count('createPage'), 0, 'the rest, not from the top'); assert.equal(app.tray.done, null);
  fresh(); app.st.view = 'tree'; app.st.cur = id('Stay'); await app.reread();
  // Find reveals the path; typing on the tree is finding.
  app.st.view = 'tree'; app.draw(); key(R, 'r'); key(R.querySelector('[data-find]'), 'e'); const find = R.querySelector('[data-find]'); find.value = 'res'; find.dispatchEvent(new win.Event('input', { bubbles: true }));
  rows = [...R.querySelectorAll('.st-row[data-row]')];
  deq(rows.map(r => rowText(r).split(' ')[0] + (r.classList.contains('dim') ? '~' : '')), ['Phenomenon~', 'Measurement~', 'Blood', 'Information~', 'Result', 'Lab', 'Scan', 'Results'], 'only the branches that hold a match, ancestors faint');
  key(R.querySelector('[data-find]'), 'Escape'); assert.equal(app.st.find, '');
  // The sidebar: the tree alone, opened on the page's tag, with a cursor of its own; Enter opens the map there, as a jump.
  app.st.cur = id('Stay'); app.st.trail = []; app.draw();
  const side = S.view.make(doc.getElementById('side'), 'side', app); app.mounted(side); await sleep(20);
  assert.ok(!side.root.querySelector('.st-right') && !side.root.querySelector('.st-tray') && !side.root.querySelector('.lk-tick'), 'no card, no tray, no ticks');
  assert.equal(app.st.side.cur, id('Consultation'), 'opened on the page\'s tag'); assert.equal(app.st.cur, id('Stay'), 'the main view\'s cursor stays'); assert.ok(side.root.querySelector('.st-row.cur'));
  assert.ok(side.root.querySelector('.st-row .iss.own'), 'the same dot in the sidebar');
  // The tree opened or clicked, then a bullet being written: no draw and no opening takes the keyboard from it.
  const bullet = doc.body.appendChild(doc.createElement('textarea'));
  side.root.focus(); bullet.focus(); await app.reread(); assert.equal(doc.activeElement, bullet, 'a read of the graph leaves the keyboard in the bullet');
  side.focus(); assert.equal(doc.activeElement, bullet, 'and so does the sidebar opening'); bullet.remove(); side.root.focus();
  key(side.root, 'Enter'); assert.equal(app.st.cur, id('Consultation')); assert.equal(text(R.querySelector('.st-trail')), 'Stay›');
  // Taken down.
  // Words written leave the map as it is; anything else reads it again.
  let rereads = 0; const reread = app.reread; app.reread = async () => { rereads++; };
  logseq.changed({ blocks: [{ id: 9001, title: 'Words', page: { id: 9002 } }], txMeta: { outlinerOp: 'save-block' } });
  await sleep(1600); assert.equal(rereads, 0, 'writing reads nothing');
  logseq.changed({ blocks: [{ id: 9001, title: 'Words', tags: [{ id: 9003, ident: 'user.class/Doctor' }], page: { id: 9002 } }], txMeta: { outlinerOp: 'save-block' } });
  await sleep(1600); assert.equal(rereads, 1, 'a tag typed in the words reads the map');
  logseq.changed({ blocks: [{ id: 9001, title: 'Words', page: { id: 9002 } }], txMeta: { outlinerOp: 'set-block-property' } });
  await sleep(1600); assert.equal(rereads, 2, 'a value set reads the map'); app.reread = reread;
  await unload(); assert.equal(doc.querySelectorAll('.st').length, 0); assert.ok(!doc.getElementById('st-style'));
  console.log('load: every check passed (the screen drawn, words and keys, the trail, the ask, tray, apply, undo, table, health, menu, nodes, find, sidebar)');
})().catch(error => { console.error(error); process.exit(1); });
