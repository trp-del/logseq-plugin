// A table's state line and what a table says once (look/logseq/tables.js): how the view reads its sort, group and filters; the line drawn
// under the bar; the column names kept for the first group; a tag's own page not saying its tag down a column of its own.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<body><div id="main-content-container"><div class="root">
  <div class="ls-foldable-title"><div class="ls-view-head"><div class="views"><button data-view-tab-id="view-tab-00000006-1018-4849-1000-000000000000" class="as-text">All</button></div>
    <div class="view-actions"><button><span class="ls-icon-arrows-up-down"></span></button><button><span class="ls-icon-filter"></span></button><button><span class="ls-icon-dots"></span></button></div></div></div>
  <div class="ls-foldable-content">
    <div class="ls-table"><div class="ls-table-header"><div class="sticky-columns flex-row"><div><div class="ls-table-header-cell"></div></div></div><div class="flex-row"><div role="button"><div class="ls-table-header-cell"><span title="Name">Name</span></div></div><div role="button"><div class="ls-table-header-cell"><span title="Tags">Tags</span></div></div></div></div>
      <div class="ls-table-row"><div class="sticky-columns flex-row"><div class="h-full"><div class="ls-table-cell" title=""></div></div></div><div class="flex-row"><div class="h-full"><div class="ls-table-cell" title="Books"></div></div><div class="h-full"><div class="ls-table-cell" title="Page, Purchase"></div></div></div></div>
      <div class="ls-table-row"><div class="sticky-columns flex-row"><div class="h-full"><div class="ls-table-cell" title=""></div></div></div><div class="flex-row"><div class="h-full"><div class="ls-table-cell" title="Gas"></div></div><div class="h-full"><div class="ls-table-cell" title="Purchase"></div></div></div></div></div>
    <div class="ls-table"><div class="ls-table-header"><div class="ls-table-header-cell"></div></div></div>
  </div></div></div></body>`, { url: 'https://logseq.test/#/page/purchase?graph-id=1', pretendToBeVisual: true });
const doc = dom.window.document;
const kit = { el: (d, tag, props = {}, ...kids) => { const e = d.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); } for (const kid of kids) if (kid != null) e.append(kid); return e; },
  host: () => doc, onGraphChange: () => {}, onStop: () => {}, run: () => {}, watchScreen: () => {} };
let view = { };   // what the view block holds, as Logseq's datascript pull hands it
const Door = { bare: v => String(v ?? '').replace(/^:/, ''), screen: { press: el => el.click() }, UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  pick: (node, name) => node?.[name] ?? node?.[':' + name], idOf: v => typeof v === 'number' ? v : v?.id, listOf: v => v == null ? [] : Array.isArray(v) ? v : [v],
  query: async q => q.includes('pull') ? [[view]] : q.includes(':db/ident') ? [['Amount']] : [['Category']] };
const window = { PluginDoor: Door, Look: { kit } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../logseq/tables.js'), 'utf8'), { window, document: doc, console, PointerEvent: dom.window.PointerEvent, MouseEvent: dom.window.MouseEvent });
const { read, pass } = window.Look.tables;
const U = '00000006-1018-4849-1000-000000000000';
(async () => {
  // No sort written: Logseq's own, the day changed, newest first.
  const said = async () => JSON.parse(JSON.stringify(await read(U)));
  assert.deepStrictEqual(await said(), { sort: 'Sorted by Updated, newest first', group: '', filter: '' });
  // A sort by Name: Logseq's last tie-break, the day changed, is not the table's sort and is not said.
  view = { ':logseq.property.table/sorting': [{ id: 'title', 'asc?': true }, { id: 'updated-at', 'asc?': false }] };
  assert.strictEqual((await read(U)).sort, 'Sorted by Name, A to Z');
  view = { ':logseq.property.table/sorting': [{ id: 'user.property/amount', 'asc?': false }] };
  assert.strictEqual((await read(U)).sort, 'Sorted by Amount, descending');
  view = { ':logseq.property.table/sorting': [{ id: 'created-at', 'asc?': false }], ':logseq.property.view/group-by-property': { id: 285 }, ':logseq.property.table/filters': { 'or?': false, filters: [[':user.property/amount', 'is', ['x']], [':user.property/amount', 'is', ['y']]] } };
  assert.deepStrictEqual(await said(), { sort: 'Sorted by Created, newest first', group: 'Grouped by Category', filter: 'Filtered by Amount' });
  assert.strictEqual((await read('not-a-uuid')), null, 'a view id that is not one is not asked for');

  // The page: a line under the bar once the view is read; the second table has no column names; the Tags column of a tag's own page is hidden.
  view = {};
  pass(doc); await new Promise(r => setTimeout(r, 20)); pass(doc);
  const line = doc.querySelector('.lk-tstate');
  assert.ok(line && line.previousElementSibling === doc.querySelector('.ls-foldable-title'), 'the state line stands right under the bar');
  assert.strictEqual(line.textContent, 'Sorted by Updated, newest first');
  assert.ok(line.querySelector('.lk-change.lk-tpart[data-lk-opens="sort"]'), 'each part is a press that opens Logseq’s own list');
  const tables = doc.querySelectorAll('.ls-table');
  assert.ok(!tables[0].hasAttribute('data-lk-nohead') && tables[1].hasAttribute('data-lk-nohead'), 'the column names stand once, in the first table');
  assert.strictEqual(tables[0].getAttribute('data-lk-notags'), '2', 'the Tags column of Purchase’s own page, the second of its columns, is left out');
  // Another tag on one row: the column comes back.
  doc.querySelectorAll('.ls-table-row .ls-table-cell')[5].setAttribute('title', 'Purchase, Bills');
  pass(doc);
  assert.ok(!tables[0].hasAttribute('data-lk-notags'), 'a row with another tag says the column again');
  // The press opens Logseq's button, not a write of its own.
  let pressed = 0; doc.querySelector('.view-actions button').addEventListener('click', () => pressed++);
  line.querySelector('[data-lk-opens="sort"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.strictEqual(pressed, 1, 'the sort press presses Logseq’s sort button');
  // A table folded away (no content) has no line.
  doc.querySelector('.ls-foldable-content').remove(); doc.querySelectorAll('.ls-table').forEach(t => t.remove());
  pass(doc);
  assert.strictEqual(doc.querySelectorAll('.lk-tstate').length, 0, 'a folded table keeps no line');
  console.log('ok: the sort, group and filters read from the view; the line under the bar; column names once; a tag’s own Tags column left out');
})().catch(error => { console.error(error); process.exit(1); });
