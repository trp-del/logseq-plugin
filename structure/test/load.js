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
const calls = [], taken = new Set();   // taken: names some other page, tag or property holds
let live = JSON.parse(JSON.stringify({ tags: raw.tags, props: raw.props, nodes: raw.nodes, holders: raw.holders }));
function fakeQuery(q) {
  const has = (...p) => p.every(x => q.includes(x));
  if (has(':logseq.class/Tag] [?t :db/ident _]')) return [...live.tags.map(t => [{ id: t.id, uuid: t.uuid, title: t.title, ident: ':user.class/' + t.title.replace(/\s/g, '-'), extends: t.parents.map(p => ({ id: p, ident: ':user.class/x' })), properties: t.props.map(p => ({ id: p })) }]), [{ id: 2, uuid: 'u2', title: 'Tag', ident: ':logseq.class/Tag', extends: [{ id: 1 }] }]];
  if (has(':logseq.class/Property] [?p :db/ident _]')) return live.props.map(p => [{ id: p.id, uuid: p.uuid, title: p.title, ident: ':' + p.ident, 'logseq.property/type': ':' + p.type, cardinality: ':db.cardinality/one', classes: p.range.map(r => ({ id: r })) }]);
  if (has('closed-value-property')) return live.props.filter(p => p.choice).map(p => [p.id]);
  if (has('[?b :block/uuid ?u] (not')) return Object.entries(live.nodes).flatMap(([t, list]) => list.map(n => [Number(t), n.id, n.uuid]));
  if (has('[?b ?a _] [?p :db/ident ?a]')) return Object.entries(live.holders).flatMap(([a, ids]) => ids.map(b => [':' + a, b]));
  if (has('(count ?v)')) return raw.pointed.map(([a, t, n]) => [':' + a, t, n]);
  if (has('(max ?c)')) return [[id('Consultation'), Date.UTC(2026, 9, 28)]];
  if (has('[?b :block/title ?title] [(get-else')) { const t = Number(q.match(/:block\/tags (\d+)/)[1]); return (live.nodes[t] || []).slice(0, 30).map((n, i) => [n.uuid, `Node ${i + 1} of tag ${t}`, 1000 + i, i % 2 ? 0 : 7]); }
  if (has('[?p :block/name ')) return taken.has(JSON.parse(q.match(/:block\/name ("[^"]*")/)[1])) ? [[1]] : [];
  if (has('[?b :block/page ?t]') || has('clojure.string/includes?')) return [];
  if (has('(count ?b)')) return [[1, 'follow-up', 19], [2, 'first', 71]];
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
  App: { onCurrentGraphChanged() {}, onRouteChanged() {}, pushState: (...a) => calls.push(['pushState', ...a]), registerCommandPalette() {}, registerUIItem() {}, setRightSidebarVisible() {} },
  DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) },
  UI: { showMsg: (text, status) => calls.push(['notify', status, text]) },
  Editor: {
    getCurrentPage: async () => ({ uuid: 'page-uuid' }), openInRightSidebar: (...a) => calls.push(['openInRightSidebar', ...a]),
    addTagExtends: async (t, p) => calls.push(['addTagExtends', t, p]), removeTagExtends: async (t, p) => calls.push(['removeTagExtends', t, p]),
    renamePage: async (u, n) => calls.push(['renamePage', u, n]), addBlockTag: async (n, t) => calls.push(['addBlockTag', n, t]), removeBlockTag: async (n, t) => calls.push(['removeBlockTag', n, t]),
    upsertBlockProperty: async (u, k, v) => calls.push(['upsertBlockProperty', u, k, v]), removeBlockProperty: async (u, k) => calls.push(['removeBlockProperty', u, k]),
    createPage: async (name) => { calls.push(['createPage', name]); return { uuid: 'new-' + name, id: 9000 + calls.length }; }, deletePage: async u => calls.push(['deletePage', u]),
  },
};
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
  assert.equal(app.tray.model.kinds.map(k => k.name).join(), 'Entity,Occurrence,Phenomenon,Information');
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
  assert.equal(text(R.querySelector('.st-tray')), '1 change waitingMove Consultation from Medical event to Conversation90 nodes×Apply · one Undo for 90 nodes⌘ EnterDiscard⌘ Delete');
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
  assert.equal(text(R.querySelector('.st-pick [data-do="merge"]')), 'merge into Blood draw', 'the pick bar offers it too'); const mergeWord = R.querySelector('.st-card [data-do="merge"]'); assert.equal(text(mergeWord), 'merge the 2 ticked tags into this'); click(mergeWord);
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
  click(R.querySelector('[data-drop="0"]')); assert.equal(S.model.parentOf(app.tray.model, id('Consultation')), id('Medical event'));
  assert.equal(app.tray.changes.length, 4);
  // The table and the Health list open from the path line; Escape walks back along the trail.
  click(R.querySelector('[data-show="table"]')); assert.equal(text(R.querySelector('.st-card h2')), 'Every property'); assert.equal(R.querySelectorAll('.st-tbl .tr').length, app.tray.model.props.size, 'one row per property'); assert.ok([...R.querySelectorAll('.st-tbl .tr')].some(r => r.querySelectorAll('.on')[0].querySelectorAll('.lk-tag').length > 1), 'a row names every tag the property is on');
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
  click(R.querySelector('[data-show="health"]')); assert.equal(text(R.querySelector('.st-card h2')), 'Health'); assert.ok([...R.querySelectorAll('.st-hl h3')].map(text).includes('Names say what they are'));
  assert.ok(!R.querySelector('.st-hl .fix kbd'), 'no key letters'); assert.ok(R.querySelector('.st-hl .fix.act'));
  // A merge is shown side by side before it is staged: the two tags with their properties lined up.
  const mergeFix = [...R.querySelectorAll('.st-hl .fix')].find(f => text(f).startsWith('merge')); assert.ok(mergeFix, 'a merge to settle'); click(mergeFix);
  assert.equal(R.querySelectorAll('.st-two .h').length, 2, 'two columns'); assert.ok(text(R.querySelector('.st-two .h')).includes('removed') && text(R.querySelector('.st-ln.ask')).includes('stage it'), 'the one going says so; the words wait');
  assert.ok(!/retagged|nodes\s*stage it/.test(text(R.querySelector('.st-ln.ask'))), 'the count once, in the column head: not in the sentence, not after it'); assert.ok(R.querySelector('.st-two .pr .n') && R.querySelector('.st-ln.ask.two'), 'the names at the left of their column');
  assert.ok([...R.querySelectorAll('.st-hl .st-ln.iss .w')].every(w => !w.querySelector('.lk-tag:first-child')), 'no leading tag on a Health row: the thing to settle leads');
  assert.ok([...R.querySelectorAll('.st-hl .st-ln.iss .w')].some(w => w.querySelectorAll('.lk-tag').length === 3 && /and \d+ more/.test(text(w))), 'a run of many tags is cut to three and "and N more"');
  key(R, 'Escape'); assert.ok(!R.querySelector('.st-two'));
  key(R, 'Escape'); assert.equal(app.st.view, 'tree');
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
  assert.equal(text(R.querySelector('.st-tray')), '4 changes applied ↶'); assert.ok(R.querySelector('.st-tray .st-done .lk-undo') && !R.querySelector('.st-tray .done'), 'the arrow carries Look\'s name; no .done for Logseq to strike through');
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
  assert.equal(text(R.querySelector('.st-ttl .st-place')), 'Consultation/Medical event/Occurrence'); assert.ok(R.querySelector('.st-nodes .st-ln .lk-day') && R.querySelector('.st-nodes .st-ln .st-bul'), 'a node\'s row: the day in the margin, the bullet');
  key(R, ' '); key(R, 'ArrowDown'); key(R, ' '); click(R.querySelector('[data-do="nmove"]')); assert.ok(text(R.querySelector('.st-prompt .ask')).startsWith('Move 2 ticked nodes under'));
  R.querySelector('[data-pin]').value = 'call'; R.querySelector('[data-pin]').dispatchEvent(new win.Event('input', { bubbles: true })); key(R.querySelector('[data-pin]'), 'Enter');
  assert.equal(app.tray.lines()[0].text, 'Move 2 nodes from Consultation to Call');
  key(R, 'Backspace', { metaKey: true }); assert.equal(app.tray.changes.length, 0, '⌘⌫ discards'); assert.equal(text(R.querySelector('.st-tray')), '1 change dropped', 'and says so');
  key(R, 'Escape'); assert.equal(app.st.view, 'tree', 'Escape walks back from the nodes');
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
  await unload(); assert.equal(doc.querySelectorAll('.st').length, 0); assert.ok(!doc.getElementById('st-style'));
  console.log('load: every check passed (the screen drawn, words and keys, the trail, the ask, tray, apply, undo, table, health, menu, nodes, find, sidebar)');
})().catch(error => { console.error(error); process.exit(1); });
