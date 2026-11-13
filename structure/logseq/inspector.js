/* The Ontology tab and the Item tab of Logseq's right sidebar, beside a tag's or a property's page (8 and 12 November 2026).
   Ontology is a panel Logseq hosts (mount.js): it holds the lines that otherwise stand above the page's table (main.js places the
   same 'tag' view there while the panel is shown). Item is the row pressed in the page's table, or reached with the arrows: Logseq's
   own view of that node, the one Shift and a press open in the sidebar, so its words, its tags, its properties and the bullets under
   it are edited there as on any page, with Logseq's own Undo (the owner, 12 November 2026: "make Item pane fully editable"; until
   then this file drew a copy of the node that could only be read). The plugin opens that view when a row is pressed, names it as the
   Item tab's (sidebar-tabs.js shows it alone, without its head), puts one quiet line on top saying where the row stands in the table,
   and closes it when another row is pressed or the page is left. A node the person had already opened in the sidebar is shown as it
   is and never closed by the plugin. The row shown keeps a blue outline in the table. */
(function () {
const S = window.Structure;
const { host } = window.PluginDoor;
const ROW = '#main-content-container .ls-table-row[blockid]';
const ITEMS = '#right-sidebar .sidebar-item-list > .sidebar-item';
const insp = { holder: null, top: null, node: null, uuid: '', ask: 0, stops: [], el: null, before: null, kind: '', title: '', openedKeys: new Set(), shownKey: '', since: 0, pageAt: 0 };

// Shown: the panel is in the page and drawn (Logseq's sidebar open and the panel not folded).
const shown = () => !!(insp.holder?.isConnected && insp.holder.getClientRects().length);
const top = () => (shown() ? insp.top : null);
// At work: the sidebar is open on one of the two tabs, Ontology or Item. Only then does a press on a row pick it.
const active = () => shown() || !!(insp.uuid && host().querySelector('#right-sidebar[data-lk-tab="item"]')?.getClientRects().length);

const sync = () => insp.holder?.toggleAttribute('data-row', !!insp.uuid);

/* Logseq's item for the node shown. Just asked for, it is the item that was not there before the ask (told in the same pass of the
   screen that first sees it, so the tabs never take it for a page opened by hand); after that, the one that holds the node: a
   bullet's item starts with the bullet, a page's is named in its head. */
const nameOf = item => (item.querySelector('.sidebar-item-header .page-title > span:last-child')?.textContent || '').trim();
/* An item is known by the node it holds, never by its element: Logseq keeps its sidebar's items by their place in the list, so when
   a new one comes in at the top the elements are handed on (the element that showed one node shows the next), and an item followed
   by its element was lost: the first row's view was never closed and stood under "Opened" for good (found 13 November 2026). */
const keyOf = item => item.classList.contains('item-type-page') ? 'page:' + nameOf(item)
  : item.querySelector('.sidebar-panel-content .ls-block[blockid]')?.getAttribute('blockid') || '';
const wanted = () => (!insp.uuid || !insp.kind ? '' : insp.kind === 'page' ? 'page:' + insp.title : insp.uuid);
const holds = item => !!wanted() && keyOf(item) === wanted();
const listed = doc => [...doc.querySelectorAll(ITEMS)].filter(i => !i.classList.contains('lk-side') && !i.classList.contains('item-type-plugin'));
/* The row's view is drawn by Logseq a moment after it is asked for: its item comes empty and fills some frames later. Shown
   at once, the pane stood blank for about a tenth of a second on every row change (measured 12 November 2026: 83 to 168 ms).
   So the view shown before (shownKey: the node it holds) stays until an item holds the new row's node, drawn; the first row
   pressed has no view before it, and the tab that was showing stays until then (pass picks Item). A view that has not come two
   seconds after the press is given up: what is there is shown. */
const drawn = el => !!el.querySelector('.sidebar-panel-content :is(.ls-block, .ls-page-blocks, .ls-page-properties, .ls-page-title)');
function item(doc = host()) {
  if (!insp.uuid) return null;
  const items = listed(doc);
  const now = items.find(i => holds(i) && drawn(i));
  if (now) { insp.shownKey = wanted(); return now; }
  const old = insp.shownKey ? items.find(i => keyOf(i) === insp.shownKey) || null : null;
  return old;
}
/* The items that are the Item tab's though not the one shown: a view the plugin opened that is on its way out or in, and, while a
   row's view is awaited, an item that holds nothing yet. The tabs leave them out of "Opened". */
const owns = el => { const key = keyOf(el); return key ? insp.openedKeys.has(key) : !!insp.uuid && Date.now() - insp.since < 2000 && (el.classList.contains('item-type-block') || el.classList.contains('item-type-page')); };
// A view the plugin opened and no longer shows goes, by its own ×, as a person would close it. The one shown, and the one awaited, stay.
function closeStale(doc = host()) {
  const keep = new Set(insp.uuid ? [wanted(), insp.shownKey].filter(Boolean) : []);
  const items = listed(doc);
  for (const el of items) { const key = keyOf(el); if (key && insp.openedKeys.has(key) && !keep.has(key)) window.PluginDoor.screen.click(el.querySelector('.sidebar-item-header .item-actions button:last-child')); }
  for (const key of [...insp.openedKeys]) if (!keep.has(key) && !items.some(el => keyOf(el) === key)) insp.openedKeys.delete(key);
  if (!insp.uuid) insp.shownKey = '';
}
/* Where the row stands in Logseq's table, "Consultation · 12 of 53" (the owner's O1c, 12 November 2026): its place is the
   number Logseq's list gives the row (data-item-index, as only the rows near the screen are drawn), the whole is the count
   Logseq writes beside the table's view. Either one missing, the line is not drawn. */
function whereText(uuid) {
  const row = host().querySelector(`${ROW}[blockid="${uuid}"]`);
  const at = Number(row?.closest('[data-item-index]')?.dataset.itemIndex);
  let all = NaN;
  for (let up = row?.parentElement, i = 0; up && i < 14 && !(all > 0); up = up.parentElement, i++) {
    const n = [...up.querySelectorAll('.text-muted-foreground.text-xs')].map(e => e.textContent.trim()).find(t => /^\d+$/.test(t));
    if (n) all = Number(n);
  }
  if (!row || !(at >= 0) || !(all > 0) || at >= all) return '';
  // Whose table it is: the page's own title, which stands whichever tab is picked.
  const of = (host().querySelector('#main-content-container .ls-page-title .block-title-wrap, #main-content-container .ls-page-title h1')?.textContent || '').trim();
  return `${of ? `${of} · ` : ''}${at + 1} of ${all}`;
}
// One pass of the screen: the item is named as the Item tab's and carries its line; what was shown before goes.
function pass(doc) {
  const el = item(doc);
  // Item is picked once the row has a view to show: the one before it, or its own once drawn.
  if (el && insp.uuid && insp.pickedFor !== insp.ask) { insp.pickedFor = insp.ask; window.PluginDoor.sideTabs?.pick('item'); }
  for (const old of doc.querySelectorAll('#right-sidebar [data-st-item]')) if (old !== el) { old.removeAttribute('data-st-item'); old.querySelector('.st-item-where')?.remove(); }
  if (el) {
    if (!el.hasAttribute('data-st-item')) el.setAttribute('data-st-item', '');
    const waiting = !holds(el);   // the view shown is still the row before: its line stays as it is
    const body = el.querySelector('.sidebar-panel-content'), say = waiting ? (el.querySelector('.st-item-where')?.textContent || '') : whereText(insp.uuid) || insp.where || '';
    if (!waiting) insp.where = say;
    let line = el.querySelector('.st-item-where');
    if (body && say) {
      if (!line) { line = doc.createElement('div'); line.className = 'st-item-where lk-own'; }
      if (line.textContent !== say) line.textContent = say;
      if (body.firstElementChild !== line) body.prepend(line);
    } else line?.remove();
    if (!waiting) closeStale(doc);
  }
  mark(insp.uuid);
}

// No row pressed: one faint line says what the panel is waiting for, or nothing when the lines above already fill it.
function idle() {
  sync();
  const box = insp.node; if (!box || insp.uuid) return;
  const doc = box.ownerDocument, lines = !!insp.top?.querySelector('.st-lines-t');
  /* Between two tags' pages Logseq has no table for a moment and gives the panel a new holder: said from what stood there in that
     moment, the line went and came back within a quarter of a second (seen frame by frame, 12 November 2026). For the first 700 ms
     of a page that has the lines, the table is taken as coming; then it is asked again and said as it is. */
  const settling = Date.now() - insp.pageAt < 700;
  const table = !!doc.querySelector(ROW) || (settling && lines);
  if (settling && !idle.again) idle.again = doc.defaultView.setTimeout(() => { idle.again = 0; idle(); }, 720);
  if (settling && !lines && !table && !insp.plain) return;   // nothing is known of the page yet: no line said, so none is pushed down when the tag's lines come (a 260 px jump, the motion check, 12 November 2026)
  const say = table ? 'Press a row in the table to see it in the Item tab.' : lines ? '' : 'Open a tag’s or a property’s page to see it here.';
  if (box.textContent === say) return;
  box.innerHTML = say ? `<p class="st-insp-none lk-none">${say}</p>` : '';
}
/* A row is picked: Logseq is asked for its node's view, which becomes the Item tab and is picked; the view shown before goes once
   the new one stands, so the sidebar is never left empty. No row (the page left): the view goes and the sidebar falls back to
   Ontology. */
async function pick(uuid) {
  if (uuid === insp.uuid) return mark(uuid);
  if (uuid && !active()) return;   // the sidebar shut, or on another tab: the press is Logseq's alone
  const ask = ++insp.ask, doc = host();
  insp.uuid = uuid; insp.kind = ''; insp.title = ''; insp.where = ''; insp.since = Date.now();
  sync(); mark(uuid);
  if (!uuid) { closeStale(doc); window.PluginDoor.sideTabs?.draw(); return idle(); }
  let block = null, page = null;
  try {
    block = await logseq.Editor.getBlock(uuid).catch(() => null);
    if (!block || block.page == null) page = await logseq.Editor.getPage(uuid).catch(() => null);   // a page's row: Logseq hands it only as a page
  } catch (error) { /* gone meanwhile */ }
  if (ask !== insp.ask) return;
  insp.kind = block && block.page != null ? 'block' : 'page';
  insp.title = String(page?.title ?? page?.name ?? '');
  // Asked for only when no item holds the node yet (one the person opened is shown as it is, and never closed by the plugin).
  if (!listed(doc).some(holds)) {
    insp.openedKeys.add(wanted());
    try { await logseq.Editor.openInRightSidebar(uuid); } catch (error) { console.error('Structure: the row could not be opened in the sidebar', error); insp.openedKeys.delete(wanted()); }
  }
  if (ask !== insp.ask) return;
  pass(doc);
  // Should the view never come, the row is no longer waited for: whatever is there is shown, and the tabs are drawn once more.
  doc.defaultView.setTimeout(() => { if (ask === insp.ask) { pass(host()); window.PluginDoor.sideTabs?.draw(); } }, 2050);
}
// The row Item shows carries a blue outline, so the eye finds it in the table; the arrows move it with the row.
function mark(uuid) {
  const doc = host();
  for (const r of doc.querySelectorAll('[data-st-picked]')) if (r.getAttribute('blockid') !== uuid) r.removeAttribute('data-st-picked');
  if (uuid) for (const r of doc.querySelectorAll(`${ROW}[blockid="${uuid}"]:not([data-st-picked])`)) r.setAttribute('data-st-picked', '');
}
/* While the Ontology or the Item tab is shown, a single press on a cell of the table only selects its row (the owner, 8 November 2026: "single
   to select and double to edit"): Logseq's own press, which opens the cell's editor or follows a link, waits for a double press,
   which hands it the press it would have had. The tick box, the heads and the keys stay Logseq's; with neither tab shown every
   press is Logseq's as before. Cmd, Ctrl, Alt and Shift presses pass, so Shift still opens a link in the sidebar. */
const TICK = '[data-table-row-select], [role="checkbox"]';
let replaying = false;
function cellOf(e) {
  if (replaying || !active() || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  const cell = e.target?.closest?.('.ls-table-cell');
  return cell && cell.closest(ROW) && !e.target.closest(TICK) ? cell : null;
}
// Logseq follows a link as the button goes down, so the press is held from there on, not only at its click.
function hold(e) { if (cellOf(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
function press(e) {
  const cell = cellOf(e); if (!cell) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.detail > 1) return;   // the second press of a double press: the dblclick does the work
  cell.focus({ preventScroll: true });
  pick(cell.closest(ROW).getAttribute('blockid') || '');
}
function twice(e) {
  const cell = cellOf(e); if (!cell) return;
  e.preventDefault(); e.stopImmediatePropagation();
  // The press held back is played again where it was made, through the door's screen door (plugin.js).
  replaying = true;
  try { window.PluginDoor.screen.press(e.target, { composed: true, clientX: e.clientX, clientY: e.clientY, detail: 1 }); }
  finally { replaying = false; }
}
// A row of Logseq's table is pressed, or reached with the arrows: its node is the one shown. Only rows in the main view count.
function onRow(e) { const row = e.target?.closest?.(ROW); if (row) pick(row.getAttribute('blockid') || ''); }
function start() {
  const doc = host();
  const HELD = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
  const { listen } = S.base;
  const offKeys = [listen(doc, HELD, hold, true), listen(doc, 'click', press, true), listen(doc, 'dblclick', twice, true), listen(doc, ['focusin', 'click'], onRow, true)];
  const offRoute = S.base.onStop(logseq.App.onRouteChanged?.(() => { insp.pageAt = Date.now(); insp.plain = false; pick(''); }));
  insp.stops = [...offKeys, () => { insp.uuid = ''; closeStale(); mark(''); }, offRoute, window.PluginDoor.watch(pass)];
}
function stop() { for (const s of insp.stops) { try { s?.(); } catch (error) { /* already gone */ } } insp.stops = []; if (insp.holder) insp.holder.innerHTML = ''; insp.watch?.disconnect(); }

// Logseq gives the panel a holder: the line that says what it waits for, and the place of the tag's or property's lines.
function mounted(holder) {
  const doc = holder.ownerDocument;
  S.view.ensureStyle(doc);
  holder.innerHTML = '<div class="st st-tag st-insp-node"></div><div class="st-insp-top"></div>';
  insp.holder = holder; insp.node = holder.firstChild; insp.top = holder.lastChild; insp.pageAt = Date.now();
  // Logseq's sidebar hidden or the panel folded leaves the holder in the page with no size: the lines go back above the table.
  let was = shown();
  insp.watch?.disconnect();
  insp.watch = doc.defaultView.ResizeObserver && new doc.defaultView.ResizeObserver(() => { if (shown() !== was) { was = shown(); S.inspector.changed?.(); } });
  insp.watch?.observe(holder);
  idle();
  S.inspector.changed?.();
}
function gone(holder) { if (insp.holder !== holder) return; insp.watch?.disconnect(); insp.holder = insp.top = insp.node = null; S.inspector.changed?.(); }

// The page is read: no tag's and no property's (plain), so the tab's line need not wait.
function pageKnown(plain) { const was = insp.plain; insp.plain = !!plain; if (plain && !was) idle(); }
S.inspector = { start, stop, mounted, gone, top, shown, idle, pageKnown, row: () => insp.uuid, item, owns, KEY: 'structure-inspector', model: null, changed: null };
})();
