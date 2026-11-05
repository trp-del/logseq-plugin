/* node test/load.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules)
   Loads the plugin's files, in files.js's order, against a stand-in for Logseq: a fake `logseq` whose queries answer
   from the mockup's graph in the shapes Logseq 2.0.2 returns, and whose editor calls are recorded. It draws the page of the
   whole, a tag's lines and the sidebar into a jsdom page, moves and merges with the keys and the menu, reads the tray, applies and
   undoes. Lines are drawn from measurements jsdom does not make: only the real app shows those (tools/app/check.js). */
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
  if (has('[?j :block/journal-day ?d]')) return q.includes(`#uuid "${dayNamed}"`) ? [[20261103]] : [];
  if (has(':logseq.class/Tag] [?t :db/ident _]')) return [...live.tags.map(t => [{ id: t.id, uuid: t.uuid, title: t.title, ident: ':user.class/' + t.title.replace(/\s/g, '-'), extends: t.parents.map(p => ({ id: p, ident: ':user.class/x' })), properties: t.props.map(p => ({ id: p })) }]), [{ id: 2, uuid: 'u2', title: 'Tag', ident: ':logseq.class/Tag', extends: [{ id: 1 }] }]];
  if (has(':logseq.class/Property] [?p :db/ident _]')) return live.props.map(p => [{ id: p.id, uuid: p.uuid, title: p.title, ident: ':' + p.ident, 'logseq.property/type': ':' + p.type, cardinality: ':db.cardinality/one', classes: p.range.map(r => ({ id: r })) }]);
  if (has('closed-value-property')) return live.props.filter(p => p.choice).map(p => [p.id]);
  if (/^\[:find \?u :where \[\?b :block\/tags (\d+)\]/.test(q)) return (lateNodes[q.match(/:block\/tags (\d+)/)[1]] || []).map(u => [u]);   // the last look before a delete
  if (has('[?b :block/uuid ?u] (not')) return Object.entries(live.nodes).flatMap(([t, list]) => list.map(n => [Number(t), n.id, n.uuid]));
  if (has('[?b ?a _] [?p :db/ident ?a]')) return Object.entries(live.holders).flatMap(([a, ids]) => ids.map(b => [':' + a, b]));
  if (has('(count ?v)')) return raw.pointed.map(([a, t, n]) => [':' + a, t, n]);
  if (has('(max ?c)')) return [[id('Consultation'), Date.UTC(2026, 9, 28)]];
  if (has(':find ?b ?u ?title ?c ?pg')) { const ids = new Set(q.match(/ground \[([\d ]*)\]/)[1].split(' ').map(Number)); return Object.entries(live.nodes).flatMap(([t, list]) => list.filter(n => ids.has(n.id)).map((n, i) => [n.id, n.uuid, n.words || `Node ${i + 1} of tag ${t}`, 1000 + n.id, 7])); }
  if (has(':find ?u ?t :where [(ground')) return [['1a000000-0000-4000-8000-00000000000e', 'Dr. Mei Chen']];
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
let dayNamed = '-';   // a tag that shares a journal day's name
const html = `<html><head></head><body><div id="main-content-container"><div id="holder"></div></div><div id="right-sidebar"><div class="sidebar-item"><div class="page-title"><h3>x</h3></div><div id="side"></div></div></div></body></html>`;
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://logseq.test/index.html' });
const win = dom.window, doc = win.document;
win.Element.prototype.scrollIntoView = () => {};
/* Every piece of HTML the plugin puts on the page, read for a box left open or closed twice. The browser mends a missing
   close without a word, so the page reads well and the rows after it fall inside: on 5 Nov the merge's ask left its column
   open and drew the next property, End, inside the ask. */
const unclosed = [], VOID = new Set(['input', 'br', 'img', 'hr', 'wbr', 'col', 'source', 'meta', 'link']);
function closes(h) {
  const open = [];
  for (const [, end, tag, self] of String(h).matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const t = tag.toLowerCase(); if (VOID.has(t) || self) continue;
    if (!end) { open.push(t); continue; }
    if (open.pop() !== t) return `</${t}> closes nothing open`;
  }
  return open.length ? `<${open.join('> <')}> never closed` : '';
}
const setInner = Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML');
Object.defineProperty(win.Element.prototype, 'innerHTML', { ...setInner, set(h) { const why = closes(h); if (why) unclosed.push(why + ' in ' + String(h).slice(0, 120)); setInner.set.call(this, h); } });
const styles = {}; let unload = null;
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, provideStyle: ({ key, style }) => { styles[key] = style; }, provideModel() {}, beforeunload(fn) { unload = fn; },
  App: { onCurrentGraphChanged(fn) { logseq.graphChanged = fn; }, getCurrentGraph: async () => ({ name: graphName }), onRouteChanged(fn) { logseq.routeChanged = fn; }, pushState: (...a) => calls.push(['pushState', ...a]), registerCommandPalette() {}, registerUIItem() {}, setRightSidebarVisible() {} },
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
  const S = win.Structure, app = S.app, st = app.st, M = () => app.tray.model;
  assert.ok(app.readAt, 'the graph was read');
  const view = S.view.make(doc.getElementById('holder'), 'page', app); app.mounted(view);
  const R = view.root;
  await sleep(50);
  assert.ok(doc.getElementById('st-style'), 'the stylesheet is in Logseq\'s head');
  const row = n => R.querySelector(`.st-row[data-row="${id(n)}"]`);

  // The whole: an area for each top-level tag, the first levels open, no card, no Health.
  assert.equal(R.querySelectorAll('.st-area').length, Mo().tops(M()).length, 'one area for each top-level tag');
  assert.ok(row('Consultation'), 'a tag stands in its area');
  assert.deepEqual([...R.querySelectorAll('.lk-view')].map(text), ['Regions', 'Every property', 'Log']);
  assert.ok(!R.querySelector('.st-card'), 'no card on the page of the whole');

  // A press lights a tag; its name opens its page.
  click(row('Consultation')); assert.equal(st.cur, id('Consultation'));
  assert.equal(text(R.querySelector('.st-focus .f-h')), 'Consultation');

  // A move with Tab: pencilled, in the tray, with the plain count; Old and new; one Undo for the lot.
  const parent = M().tags.get(id('Scan')).parents[0], sib = Mo().kids(M(), parent), at = sib.indexOf(id('Scan'));
  click(row('Scan')); key(R, 'Tab', {});
  assert.equal(app.tray.changes.length, at > 0 ? 1 : 0, 'Tab: one step in, under the row above');
  if (!app.tray.changes.length) app.stage({ kind: 'move', tag: id('Scan'), to: id('Conversation') });
  assert.ok(R.querySelector('.st-tray [data-apply]'));
  assert.match(text(R.querySelector('.st-tray')), /links kept/);
  assert.match(text(R.querySelector('.st-tray')), /Move Scan from /);
  assert.ok(row('Scan').querySelector('.lk-pencil'), 'pencilled in where it will land');
  click(R.querySelector('[data-compare]')); assert.ok(R.querySelector('.st-sb'), 'old and new side by side');
  click(R.querySelector('[data-compare]')); assert.ok(!R.querySelector('.st-sb'));
  key(R, 'Enter', { metaKey: true }); for (let i = 0; i < 40 && !app.tray.done; i++) await sleep(25);
  assert.ok(app.tray.done, 'Apply leaves one Undo'); assert.equal(app.tray.changes.length, 0);
  assert.ok(calls.some(c => c[0] === 'addTagExtends'), 'written through Logseq\'s own call');
  click(R.querySelector('[data-undo]')); for (let i = 0; i < 40 && app.tray.done; i++) await sleep(25);
  assert.ok(!app.tray.done, 'Undo puts it back');

  // Every property and a tag's nodes open in the place of the areas.
  click(R.querySelector('[data-show="table"]')); assert.ok(R.querySelector('.st-tbl')); assert.ok(!R.querySelector('.st-regions'));
  // New property asks which tag, then opens that tag's page, where Logseq's own Add tag property makes it; Structure writes nothing.
  click(R.querySelector('[data-pnew]')); assert.match(R.querySelector('.st-prompt .ask').textContent, /New property on/);
  const pins = calls.length; key(R.querySelector('[data-pin]'), 'Enter'); await sleep(10);
  assert.ok(!R.querySelector('.st-prompt'), 'the prompt closes'); assert.ok(calls.slice(pins).some(c => c[0] === 'pushState' && c[1] === 'page'), 'the tag\'s page opens');
  assert.equal(app.tray.changes.length, 0, 'nothing waits in the tray');
  // Merge into…: tick a property, press the one it goes into, and the ask opens under that row and holds no other row.
  click(R.querySelector(`[data-ptick="${pid('Surgeon')}"]`)); click(R.querySelector('[data-paim]'));
  click(R.querySelector(`.tr[data-prop$="·${pid('With')}"]`));
  for (let i = 0; i < 40 && !R.querySelector('.st-q'); i++) await sleep(25);
  assert.match(text(R.querySelector('.st-q')), /Merge Surgeon into With/);
  assert.ok(!R.querySelector('.st-q .tr'), 'the ask holds no other property\'s row');
  click(R.querySelector('.st-q [data-leave]')); assert.ok(!R.querySelector('.st-q'));
  if (st.pticks.size) click(R.querySelector(`[data-ptick="${pid('Surgeon')}"]`));
  click(R.querySelector('[data-show="tree"]')); assert.ok(R.querySelector('.st-regions'));

  // A letter typed finds; Escape puts the areas back.
  R.focus(); key(R, 'c'); assert.equal(st.find, 'c'); key(R.querySelector('[data-find]'), 'Escape'); assert.equal(st.find, '');

  // New top-level tag: its name, then its first child tags.
  click(R.querySelector('.st-new')); assert.ok(R.querySelector('[data-edit]'));
  let box = R.querySelector('[data-edit]'); box.value = 'Finances'; box.dispatchEvent(new win.Event('input', { bubbles: true })); key(box, 'Enter'); await sleep(30);
  assert.equal(st.edit?.what, 'kids', 'it asks for the first child tags');
  box = R.querySelector('[data-edit]'); box.value = 'Bill, Payment'; box.dispatchEvent(new win.Event('input', { bubbles: true })); key(box, 'Enter'); await sleep(30);
  deq(app.tray.lines().map(l => l.text), ['Make Finances at the top', 'Make Bill under Finances', 'Make Payment under Finances']);
  click(R.querySelector('[data-discard]')); assert.equal(app.tray.changes.length, 0);

  // A tag's own page: the lines above Logseq's table, in Logseq's words.
  const holder = doc.createElement('div'); doc.body.appendChild(holder);
  const tagView = S.view.make(holder, 'tag', app, { tag: id('Consultation') }); app.mounted(tagView); await sleep(30);
  const lines = text(tagView.root.querySelector('.st-lines-t'));
  for (const word of ['Extends', 'Child tags', 'Relationships']) assert.ok(lines.includes(word), word);
  assert.ok(!tagView.root.querySelector('.st-card'));
  click(tagView.root.querySelector('[data-do="move"]')); assert.ok(tagView.root.querySelector('.st-prompt'), 'the Extends line opens the choice in place');
  key(tagView.root.querySelector('[data-pin]'), 'Escape'); assert.ok(!tagView.root.querySelector('.st-prompt'));
  tagView.destroy(); holder.remove();

  // The sidebar: the outline alone, with a cursor of its own.
  const side = doc.createElement('div'); doc.body.appendChild(side);
  const sideView = S.view.make(side, 'side', app); app.mounted(sideView); await sleep(30);
  assert.ok(sideView.root.querySelector('.st-tree .st-row')); assert.ok(!sideView.root.querySelector('.st-regions'));
  sideView.destroy(); side.remove();

  await unload(); assert.equal(doc.querySelectorAll('.st').length, 0); assert.ok(!doc.getElementById('st-style'));
  // A tag's page gets its lines above Logseq's table; a journal day never does, nor a tag that shares a day's name (3 Nov:
  // "Extends · Child tags · Relationships" over the owner's Nov 3rd).
  {
    const tag = [...M().tags.values()].find(t => t.uuid), main = doc.getElementById('main-content-container');
    const show = async journal => {
      main.querySelectorAll('.page').forEach(p => p.remove());
      const page = doc.createElement('div'); page.className = journal ? 'is-journals page' : 'page';
      page.innerHTML = `<div class="page-inner"><div class="ls-page-title"><div class="ls-block" blockid="${tag.uuid}"></div></div><div class="ls-page-blocks"></div></div>`;
      main.append(page); logseq.routeChanged(); await sleep(80);
      return !!main.querySelector('.st-tagholder');
    };
    assert.ok(await show(false), 'a tag\'s page gets its lines');
    assert.ok(!(await show(true)), 'a journal day gets none, though the page drawn is a tag');
    dayNamed = tag.uuid;
    assert.ok(!(await show(false)), 'a tag that shares a journal day\'s name gets none');
    dayNamed = '-'; main.querySelectorAll('.page').forEach(p => p.remove()); logseq.routeChanged(); await sleep(50);
  }
  deq(unclosed, [], 'every box the plugin drew is closed');
  console.log('load: every check passed (the areas, a move, tray, apply, undo, Every property, finding, a new top-level tag, a tag\'s lines, the sidebar)');
})().catch(error => { console.error(error); process.exit(1); });
function Mo() { return win.Structure.model; }
