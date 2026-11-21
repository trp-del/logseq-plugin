/* A table's state line, and what a table says once (the owner, 18 November 2026, B of table-sidebar-look.html). Under a table's bar one
   quiet line says how the table is cut: how it is sorted, what it is grouped by, which properties are filtered, each part a press that opens
   Logseq's own list for it (so nothing is written from here: what you change, Logseq changes, with its own Delete sort). A grouped
   table says its column names once, at the top of the first group; and a table of one tag's own nodes does not say that tag down a
   column of its own. The look of the bar itself is calm.js's (calmTables); this part reads the view and marks what to hide. */
(function () {
const Look = window.Look;
const { host, el, onGraphChange, onStop, style } = Look.kit;
const Door = window.PluginDoor;
const HEAD = '#main-content-container .ls-view-head, #right-sidebar .ls-view-head';
const NAMES = { title: 'Name', 'updated-at': 'Updated', 'created-at': 'Created' };
const BY_DATE = new Set(['updated-at', 'created-at']);
const known = new Map();      // a view's uuid → what it is cut by, once read
const reading = new Set();
const stale = new Set();      // views read before the graph last changed: their line keeps its words until the new answer comes
const names = new Map();      // a property's ident → its name
let generation = 0;

const idName = async id => {
  if (NAMES[id]) return NAMES[id];
  if (names.has(id)) return names.get(id);
  const ident = Door.bare(id || '');
  if (!/^[\w.\-]+\/[\w.\-]+$/.test(ident)) return ident;
  const rows = await Door.query(`[:find ?t :where [?e :db/ident :${ident}] [?e :block/title ?t]]`);
  const name = rows[0]?.[0] || Door.plainName(ident);
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
  /* Until the view is read, the line keeps the room of one press, an unseen one, so the words come into room kept and the table under
     it never moves (it went 6 px down as the words came, 19 November 2026). */
  if (!state) { const room = press(doc, '\u200b', 'sort'); room.style.visibility = 'hidden'; room.tabIndex = -1; room.setAttribute('aria-hidden', 'true'); line.replaceChildren(room); return; }
  line.replaceChildren(...[['sort', state.sort], ['group', state.group], ['filter', state.filter]].filter(([, words]) => words).map(([what, words]) => press(doc, words, what)));
}
function ask(uuid) {
  if ((known.has(uuid) && !stale.has(uuid)) || reading.has(uuid)) return;
  reading.add(uuid);
  const mine = generation;
  read(uuid).then(state => { reading.delete(uuid); if (mine !== generation || !state) return; stale.delete(uuid); known.set(uuid, state); Look.kit.run(host()); }, error => { reading.delete(uuid); console.error('Look: could not read how a table is cut', error); });
}
// A grouped table says its column names once: the first of its tables keeps them.
function markHeads(root) {
  const tables = [...root.querySelectorAll('.ls-table')];
  tables.forEach((table, i) => { if (i && !table.hasAttribute('data-lk-nohead')) table.setAttribute('data-lk-nohead', ''); else if (!i && table.hasAttribute('data-lk-nohead')) table.removeAttribute('data-lk-nohead'); });
}
/* The tags whose every node carries that tag alone (Logseq's Page aside), by name and by uuid: read once at start and after a graph
   change, so a tag's table hides its Tags column in the frame its header is drawn, before its rows come. Until 19 November 2026 the
   column stood for a frame or two and the columns after it slid 180 px left (the release check's motion fault). */
const SOLO_KEY = 'look-solo-tags';
let solo = new Set((() => { try { return JSON.parse(localStorage.getItem(SOLO_KEY) || '[]'); } catch (e) { return []; } })());   // the last answer, kept, so the first table after a start knows at once
async function readSolo() {
  const mine = generation;
  // A tag's table lists its child tags' nodes too, which say the child's name: a tag with a child in use is not alone either.
  const [mixed, parents, tags] = await Promise.all([
    Door.query('[:find ?t :where [?n :block/tags ?t] [?n :block/tags ?o] [(not= ?t ?o)] (not [?o :db/ident :logseq.class/Page])]'),
    Door.query('[:find ?t :where [?c :logseq.property.class/extends ?t] [_ :block/tags ?c]]'),
    Door.query('[:find ?t ?title ?u :where [?t :block/tags :logseq.class/Tag] [?t :block/title ?title] [?t :block/uuid ?u] [_ :block/tags ?t]]'),
  ]);
  if (mine !== generation) return;
  const no = new Set([...mixed, ...parents].map(r => r[0]));
  solo = new Set(tags.filter(([t]) => !no.has(t)).flatMap(([, title, u]) => [String(title).toLowerCase(), String(u).toLowerCase()]));
  try { localStorage.setItem(SOLO_KEY, JSON.stringify([...solo])); } catch (e) { /* kept for this run only */ }
  Look.kit.run(host());
}
/* A tag's own page: its table need not say that tag on every row. Only while every row shown carries that one tag and no other.
   Said once on the table, as the column's place among the columns (data-lk-notags), and hidden by a rule (calm.js), so a row Logseq
   draws later is hidden as it comes, in the frame it is drawn, never shown and then taken away. */
function markTags(doc, root) {
  const page = decodeURIComponent((doc.defaultView.location.hash.match(/#\/page\/([^?]+)/) || [])[1] || '').toLowerCase();
  for (const table of root.querySelectorAll('.ls-table')) {
    const heads = [...table.querySelectorAll('.ls-table-header .ls-table-header-cell')];
    const head = heads.find(h => h.querySelector('span[title]')?.getAttribute('title') === 'Tags');
    const slot = head?.closest('.ls-table-header > .flex-row > *');
    const n = slot ? [...slot.parentElement.children].indexOf(slot) + 1 : 0;
    const at = heads.indexOf(head);
    const cells = at < 0 ? [] : [...table.querySelectorAll('.ls-table-row')].map(r => r.querySelectorAll('.ls-table-cell')[at]).filter(Boolean);
    const said = cells.filter(c => c.getAttribute('title'));   // a row whose cell has not been drawn yet says nothing
    // Logseq's own Page tag, on every page, is not said in the column either, so it is not counted as another tag.
    const tagsOf = c => c.getAttribute('title').toLowerCase().split(',').map(t => t.trim()).filter(t => t && t !== 'page');
    // Before Logseq has drawn the rows (it draws the header first), the graph's answer stands in, so the column never shows for a frame.
    const alone = n > 0 && !!page && (said.length > 0 ? said.every(c => { const tags = tagsOf(c); return tags.length === 1 && tags[0] === page; }) : solo.has(page));
    const want = alone ? String(n) : null;
    if (table.getAttribute('data-lk-notags') !== want) { if (want) table.setAttribute('data-lk-notags', want); else table.removeAttribute('data-lk-notags'); }
  }
}
/* A table's columns drawn where they stay (the release check's motion fault, fixed 19 November 2026 at the owner's "ok go ahead").
   Logseq draws a tag's table in steps: the built-in columns first (Name, Tags, Created, Updated), the tag's own (Provider, Topic,
   Date) a moment later and before them, so Created and Updated slid right 20–40 px and more as the page drew, on the page and in the
   right sidebar, with the plugin or without it. Each table is held out of sight, its room kept, from the frame it is first drawn until
   its columns are whole: the columns this view showed last time are all there, or its columns have not changed for a moment
   (MOTION.columnsSettle), and never longer than MOTION.columnsWait. Nothing about the table changes: it appears once, as it stays. */
const COLS_KEY = 'look-table-columns';
const lastColumns = (() => { try { return new Map(Object.entries(JSON.parse(localStorage.getItem(COLS_KEY) || '{}'))); } catch (e) { return new Map(); } })();
const holds = new WeakMap();  // a table as first drawn → { uuid, sig, born, changed, timer, done }
const columnsOf = table => [...table.querySelectorAll('.ls-table-header .ls-table-header-cell [title]')].map(e => e.getAttribute('title'));
function holdColumns(table, uuid) {
  const now = performance.now(), names = columnsOf(table), sig = names.join('|');
  let h = holds.get(table);
  // Held only as it is first drawn: a table already on screen (another view of it chosen, a column added) is never hidden.
  if (!h) { h = { uuid, sig, born: now, changed: now, timer: 0, done: false }; holds.set(table, h); table.setAttribute('data-lk-hold', ''); }
  if (h.done) return;
  if (h.uuid !== uuid) h.uuid = uuid;   // the view's tab is read a moment after the table comes
  if (sig !== h.sig) { h.sig = sig; h.changed = now; }
  const want = uuid && lastColumns.get(uuid);
  const settle = Door.MOTION.columnsSettle.ms, wait = Door.MOTION.columnsWait.ms;
  const whole = (names.length > 0 && want && want.every(n => names.includes(n))) || (names.length > 0 && now - h.changed >= settle) || now - h.born >= wait;
  clearTimeout(h.timer);
  if (!whole) { h.timer = setTimeout(() => { if (table.isConnected) holdColumns(table, uuid); }, Math.max(16, Math.min(settle - (now - h.changed), wait - (now - h.born)))); return; }
  h.done = true;
  table.removeAttribute('data-lk-hold');
  if (uuid && names.length && sig !== (want || []).join('|')) {
    lastColumns.set(uuid, names);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(Object.fromEntries([...lastColumns].slice(-300)))); } catch (e) { /* kept for this run only */ }
  }
}
const holdTables = (root, uuid) => { for (const table of root.querySelectorAll('.ls-table')) holdColumns(table, uuid); };
const holdCss = `:is(#main-content-container, #right-sidebar) .ls-table[data-lk-hold] { visibility: hidden; }`;
// What a table's head says, found for each table on the screen: its root and the uuid of the view in force.
function eachHead(doc, fn) {
  for (const head of doc.querySelectorAll(HEAD)) {
    const root = head.closest('.ls-foldable-title')?.parentElement;
    if (!root) continue;
    const tab = head.querySelector('.views button[data-view-tab-id]:not(.text-muted-foreground)') || head.querySelector('.views button[data-view-tab-id]');
    fn(head, root, (tab?.getAttribute('data-view-tab-id') || '').replace(/^view-tab-/, ''));
  }
}
function pass(doc) {
  eachHead(doc, (head, root, uuid) => {
    if (uuid) ask(uuid);
    drawLine(doc, head, root, uuid);
    markHeads(root);
    markTags(doc, root);
    holdTables(root, uuid);
  });
}
function start() {
  /* The state line's room and the Tags column are settled in the frame Logseq draws the table (the early pass runs before the screen
     is painted): the line came a frame later and pushed the table down 28 px, and the columns after Tags slid 180 px left (the release
     check's motion faults, 18 November 2026). The words of the line come when the view is read, into room already kept. */
  style('tables', holdCss);
  Look.kit.watchScreen(pass, doc => eachHead(doc, (head, root, uuid) => { drawLine(doc, head, root, uuid); markTags(doc, root); holdTables(root, uuid); }));
  // A change in the graph may be a sort, a group or a filter changed: read again after it.
  /* The line keeps its words while the view is read again: emptied, it stood 6 px shorter for a frame on every change in the graph (a
     key typed anywhere), and the table under it went up and down (19 November 2026, Doctor in the right sidebar). */
  onGraphChange(pages => { generation++; for (const uuid of known.keys()) stale.add(uuid); reading.clear(); if (pages) readSolo().catch(() => {}); Look.kit.run(host()); });   // words alone written change no node's tags
  readSolo().catch(error => console.error('Look: could not read which tags stand alone on their nodes', error));
  onStop(() => {
    generation++; known.clear(); stale.clear(); reading.clear();
    const doc = host();
    for (const node of doc.querySelectorAll('.lk-tstate')) node.remove();
    for (const attr of ['data-lk-nohead', 'data-lk-notags', 'data-lk-hold']) for (const node of doc.querySelectorAll(`[${attr}]`)) node.removeAttribute(attr);
  });
}
Look.tables = { start, stop() {}, read, pass };
})();
