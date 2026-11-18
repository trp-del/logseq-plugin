/* A table's state line, and what a table says once (the owner, 18 November 2026, B of table-sidebar-look.html). Under a table's bar one
   quiet line says how the table is cut: how it is sorted, what it is grouped by, which properties are filtered, each part a press that opens
   Logseq's own list for it (so nothing is written from here: what you change, Logseq changes, with its own Delete sort). A grouped
   table says its column names once, at the top of the first group; and a table of one tag's own nodes does not say that tag down a
   column of its own. The look of the bar itself is calm.js's (calmTables); this part reads the view and marks what to hide. */
(function () {
const Look = window.Look;
const { host, el, onGraphChange, onStop } = Look.kit;
const Door = window.PluginDoor;
const HEAD = '#main-content-container .ls-view-head, #right-sidebar .ls-view-head';
const NAMES = { title: 'Name', 'updated-at': 'Updated', 'created-at': 'Created' };
const BY_DATE = new Set(['updated-at', 'created-at']);
const known = new Map();      // a view's uuid → what it is cut by, once read
const reading = new Set();
const names = new Map();      // a property's ident → its name
let generation = 0;

const idName = async id => {
  if (NAMES[id]) return NAMES[id];
  if (names.has(id)) return names.get(id);
  const ident = Door.bare(id || '');
  if (!/^[\w.\-]+\/[\w.\-]+$/.test(ident)) return ident;
  const rows = await Door.query(`[:find ?t :where [?e :db/ident :${ident}] [?e :block/title ?t]]`);
  const name = rows[0]?.[0] || ident.split('/').pop();
  names.set(id, name);
  return name;
};
const directionWords = (id, asc) => id === 'title' ? (asc ? 'A to Z' : 'Z to A') : BY_DATE.has(id) ? (asc ? 'oldest first' : 'newest first') : (asc ? 'ascending' : 'descending');
// What the view's block says it is cut by: the sort (Logseq's own, newest changed first, when none is written), the group, the filters.
async function read(uuid) {
  if (!Door.UUID.test(uuid)) return null;
  const rows = await Door.query(`[:find (pull ?v [*]) :where [?v :block/uuid #uuid "${uuid}"]]`);
  const view = rows[0]?.[0];
  if (!view) return null;
  const sorting = Door.listOf(Door.pick(view, 'logseq.property.table/sorting'));
  // Logseq keeps the day changed, newest first, as the last tie-break of every sort; it is not the table's own sort, so it is not said.
  const shown = sorting.filter((s, i) => !(i && i === sorting.length - 1 && Door.pick(s, 'id') === 'updated-at' && !(s['asc?'] ?? s[':asc?'])));
  const sorts = shown.length ? shown : [{ id: 'updated-at', 'asc?': false }];
  const first = sorts[0], firstId = Door.pick(first, 'id'), firstAsc = !!(first['asc?'] ?? first[':asc?']);
  const sortNames = await Promise.all(sorts.map(s => idName(Door.pick(s, 'id'))));
  const sort = `Sorted by ${sortNames.join(', then ')}, ${directionWords(firstId, firstAsc)}`;
  const groupId = Door.idOf(Door.pick(view, 'logseq.property.view/group-by-property'));
  let group = '';
  if (groupId) { const t = await Door.query(`[:find ?t :where [${groupId} :block/title ?t]]`); group = `Grouped by ${t[0]?.[0] || 'a property'}`; }
  const filters = Door.pick(view, 'logseq.property.table/filters');
  const list = Array.isArray(filters) ? filters : Door.listOf(Door.pick(filters || {}, 'filters'));
  const filtered = [...new Set(await Promise.all(list.map(f => idName(Array.isArray(f) ? f[0] : Door.pick(f, 'id')))))];
  const filter = filtered.length ? `Filtered by ${filtered.join(', ')}` : '';
  return { sort, group, filter };
}
const press = (doc, words, what) => el(doc, 'button', { type: 'button', class: 'lk-change lk-tpart', 'data-lk-opens': what, 'aria-haspopup': 'menu', title: 'Change in Logseq’s list' }, el(doc, 'span', {}, words), el(doc, 'span', { class: 'lk-i-chevron', 'aria-hidden': 'true' }));
// The press opens what Logseq opens: the sort and the filter are its own buttons in the bar; the grouping is in its ··· menu.
function open(head, what) {
  const bar = head.querySelector('.view-actions');
  const button = what === 'sort' ? bar?.querySelector(':scope > button:has(.ls-icon-arrows-up-down)') : what === 'filter' ? bar?.querySelector(':scope > button:has(.ls-icon-filter)') : bar?.querySelector(':scope > button:has(.ls-icon-dots)');
  if (!button) return;
  Door.screen.press(button);   // as the mouse presses it: Logseq opens its lists on the press
}
function drawLine(doc, head, root, uuid) {
  const title = head.closest('.ls-foldable-title');
  let line = root.querySelector(':scope > .lk-tstate');
  const has = root.querySelector(':scope > .ls-foldable-content, :scope > .ls-foldable-content-inner') || root.querySelector('.ls-table');
  if (!has || !uuid) { line?.remove(); return; }
  if (!line) { line = el(doc, 'div', { class: 'lk-own lk-tstate' }); title.after(line); line.addEventListener('click', event => { const part = event.target.closest?.('.lk-tpart'); if (part) open(head, part.dataset.lkOpens); }); }
  const state = known.get(uuid);
  const key = state ? [state.sort, state.group, state.filter].join('|') : '';
  if (line.dataset.lkUuid === uuid && line.dataset.lkKey === key) return;
  line.dataset.lkUuid = uuid; line.dataset.lkKey = key;
  if (!state) { line.replaceChildren(); return; }
  line.replaceChildren(...[['sort', state.sort], ['group', state.group], ['filter', state.filter]].filter(([, words]) => words).map(([what, words]) => press(doc, words, what)));
}
function ask(uuid) {
  if (known.has(uuid) || reading.has(uuid)) return;
  reading.add(uuid);
  const mine = generation;
  read(uuid).then(state => { reading.delete(uuid); if (mine !== generation || !state) return; known.set(uuid, state); Look.kit.run(host()); }, error => { reading.delete(uuid); console.error('Look: could not read how a table is cut', error); });
}
// A grouped table says its column names once: the first of its tables keeps them.
function markHeads(root) {
  const tables = [...root.querySelectorAll('.ls-table')];
  tables.forEach((table, i) => { if (i && !table.hasAttribute('data-lk-nohead')) table.setAttribute('data-lk-nohead', ''); else if (!i && table.hasAttribute('data-lk-nohead')) table.removeAttribute('data-lk-nohead'); });
}
// A tag's own page: its table need not say that tag on every row. Only while every row shown carries that one tag and no other.
function markTags(doc, root) {
  const page = decodeURIComponent((doc.defaultView.location.hash.match(/#\/page\/([^?]+)/) || [])[1] || '').toLowerCase();
  for (const table of root.querySelectorAll('.ls-table')) {
    const heads = [...table.querySelectorAll('.ls-table-header .ls-table-header-cell')];
    const at = heads.findIndex(h => h.querySelector('span[title]')?.getAttribute('title') === 'Tags');
    const rows = [...table.querySelectorAll('.ls-table-row')];
    const cells = at < 0 ? [] : rows.map(r => r.querySelectorAll('.ls-table-cell')[at]).filter(Boolean);
    const said = cells.filter(c => c.getAttribute('title'));   // a row whose cell has not been drawn yet says nothing
    // Logseq's own Page tag, on every page, is not said in the column either, so it is not counted as another tag.
    const tagsOf = c => c.getAttribute('title').toLowerCase().split(',').map(t => t.trim()).filter(t => t && t !== 'page');
    const alone = !!page && said.length > 0 && said.every(c => { const tags = tagsOf(c); return tags.length === 1 && tags[0] === page; });
    const marked = [...table.querySelectorAll('[data-lk-gone]')];
    const want = alone ? new Set([heads[at], ...cells]) : new Set();
    for (const node of marked) if (!want.has(node)) node.removeAttribute('data-lk-gone');
    for (const node of want) if (!node.hasAttribute('data-lk-gone')) node.setAttribute('data-lk-gone', '');
  }
}
function pass(doc) {
  for (const head of doc.querySelectorAll(HEAD)) {
    const root = head.closest('.ls-foldable-title')?.parentElement;
    if (!root) continue;
    const tab = head.querySelector('.views button[data-view-tab-id]:not(.text-muted-foreground)') || head.querySelector('.views button[data-view-tab-id]');
    const uuid = (tab?.getAttribute('data-view-tab-id') || '').replace(/^view-tab-/, '');
    if (uuid) ask(uuid);
    drawLine(doc, head, root, uuid);
    markHeads(root);
    markTags(doc, root);
  }
}
function start() {
  Look.kit.watchScreen(pass);
  // A change in the graph may be a sort, a group or a filter changed: read again after it.
  onGraphChange(() => { generation++; known.clear(); reading.clear(); Look.kit.run(host()); });
  onStop(() => {
    generation++; known.clear(); reading.clear();
    const doc = host();
    for (const node of doc.querySelectorAll('.lk-tstate')) node.remove();
    for (const attr of ['data-lk-nohead', 'data-lk-gone']) for (const node of doc.querySelectorAll(`[${attr}]`)) node.removeAttribute(attr);
  });
}
Look.tables = { start, stop() {}, read, pass };
})();
