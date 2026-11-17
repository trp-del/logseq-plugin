/* The right sidebar as Logseq's own: stacked sections, each under its own head with its fold arrow and its × (the owner, 17 November
   2026, picking B of the sidebar mockup, after the tabs of 9 to 17 November: "things can be Xed out and the sidebar disappears like
   it would normally do with just a sidebar").

   Two kinds of section. The page's own parts appear by themselves, at the top, while the sidebar is open, and only on a page where
   they apply: Outline on a page with headings (Look), Ontology on a tag's or a property's page, and Item, the row pressed in that
   page's table (Structure). They have no ×: they come and go with the page ("Ontology appears when ontology is relevant. outline
   appears when there is a page with an outline"). Everything else is there only because you opened it, each with its ×: Links
   (View links in the ··· menu, or the command palette), Todo (its toolbar button), and any page or block opened with Shift and a
   press. Closing the last thing you opened closes the sidebar, as Logseq does when its last item goes; the parts of the page alone
   never keep it open. Logseq's Contents, which it puts in a sidebar opened empty, is not shown.

   A module adds a section with Door.sideTabs.add({ key, word, order, find(doc) → its .sidebar-item or null, open(), hidden(doc)? →
   true where it has nothing to show, auto? → true for a part of the page, opened by itself, owns(item)? → an item of the section's
   that is on its way in or out, panel? → the name its panel is registered under in Logseq's sidebar }) and gets back what takes it
   off. The name sideTabs is kept from the tabs, so the modules did not change their calls. */
(function () {
const Door = window.PluginDoor;
const { host } = Door;
const views = [];
const rowsHeard = new Set();   // who hears the row view go on or off
const st = { off: null, offClick: null, asked: new Map(), retry: 0, emptyTimer: 0, autoShut: false, rows: false, folded: false, width: 0, shownParts: new Set(), wasOpen: false, openAt: 0 };   // rows: the row view is on; folded: Ontology was folded by the row view   // autoShut: the sidebar was closed for standing blank, not by you   // asked: when an automatic section was last asked to open, by key

const CSS = `
/* Logseq's words in the bar on top (Contents, Page graph, Help, the cube with a +) stay left out, as with the tabs: the ? at the
   window's bottom right opens Logseq's help. */
#right-sidebar[data-lk-stack] .cp__right-sidebar-settings > div:not([class*="lk-"]) { display: none !important; }
/* The page's own parts first, in their order; what you opened after them, as Logseq stacks it. */
#right-sidebar[data-lk-stack] .sidebar-item-list { display: flex; flex-direction: column; }
/* The first section sits just under the bar (the owner, 17 November 2026: "why is there a big gap on the top?"): Logseq's 24 px above
   the list, under its own 48 px bar, made a band of 72 px with nothing in it. */
#right-sidebar[data-lk-stack] .sidebar-item-list { padding-top: 8px !important; }
/* Logseq's bar on top of the sidebar holds nothing here (its words are left out, below), so it goes, and the first section's head
   stands level with the toolbar (the owner, 17 November 2026: "there is still a massive gap above"). Two pages side by side keep it
   (split.js draws the right page's title there). */
#right-sidebar[data-lk-stack]:not([data-lk-split]) .cp__right-sidebar-topbar { display: none !important; }
#right-sidebar[data-lk-stack] .sidebar-item-list > * { order: 10; flex: none !important; }
/* While the sidebar slides open or shut, what it holds keeps the width it has open, cut at the sidebar's edge, rather than being laid
   out again at every width on the way: its words stood one letter a line for a few frames (the owner, 17 November 2026: "when
   things change, there is a flash"). */
#right-sidebar[data-lk-stack] .cp__right-sidebar-scrollable { overflow-x: hidden !important; }
#right-sidebar[data-lk-stack] .sidebar-item-list { min-width: var(--lk-side-w, 0px); }   /* each section its own height, the column scrolls, as Logseq stacks them */
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item[data-lk-part] { order: var(--lk-part-order, 1); }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item[data-lk-part] + .sidebar-drop-indicator { order: var(--lk-part-order, 1); }
/* A part of the page has no ×: it goes with the page, not by hand. */
#right-sidebar[data-lk-stack] .sidebar-item[data-lk-part] .sidebar-item-header .item-actions { display: none !important; }
/* One hairline between one section and the next, as Look draws them, by the order they are seen in (the page's parts come first
   whatever their place in Logseq's list): the first seen has none. */
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item { border-top: 1px solid var(--lk-line) !important; margin-top: 10px; padding-top: 6px; }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item[data-lk-first] { border-top: 0 !important; margin-top: 0; padding-top: 0; }
/* A part with nothing to show on this page, Logseq's Contents, and an item on its way in or out stand aside. */
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item:is([data-lk-aside], [data-lk-contents]) { display: none !important; }
/* The row view (the owner, 17 November 2026: "the table view should be a different view, not in stack. open with toolbar button";
   "ontology part is folded. main focus is the row item"): only the row pressed, and Ontology folded under it. */
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item:not([data-lk-row]) { display: none !important; }
/* Ontology, folded, stands low in the sidebar, under the room the row takes, so a row taller or shorter than the one before moves
   nothing under it; and Logseq's 8 px places to drop an item, which come and go with each row's view, are out of the row view, where
   nothing is dragged: each one moved Ontology 8 px for a frame (the owner, 17 November 2026: "still moves things up and down"). */
#right-sidebar[data-lk-rows] .sidebar-item-list { min-height: 100%; box-sizing: border-box; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-lk-row]:not([data-st-item]) { margin-top: auto !important; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-drop-indicator { display: none !important; }
/* Logseq's button that opens and shuts the sidebar is drawn as a sidebar of stacked sections (the owner, 17 November 2026: "switch
   sidebar icon to something that looks stacked"): the window, its right part cut into three. Drawn with the icon's own colour and
   size, so its strength, the pointer's wash and the dark mode stay Logseq's. */
#head .toggle-right-sidebar .ui__icon > svg { visibility: hidden; }
#head .toggle-right-sidebar .ui__icon { position: relative; }
#head .toggle-right-sidebar .ui__icon::before { content: ''; position: absolute; inset: 0; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM14 4v16M14 9.5h6M14 14.5h6'/%3E%3C/svg%3E") center / 20px 20px no-repeat; }
/* No row pressed yet: one faint line says what the view waits for, above Ontology's folded head. */
#right-sidebar[data-lk-rows]:not(:has(.sidebar-item[data-st-item])) .sidebar-item-list::before { content: 'Press a row in the table to see it here.'; order: 0; display: block; color: var(--lk-quiet); font-size: var(--lk-small); padding: 4px 8px 12px; }
/* Its toolbar button, while the row view is on: in the text colour on the wash, as a button held down. */
.lk-tool[aria-pressed="true"] { color: var(--lk-text) !important; opacity: 1 !important; background: var(--lk-wash) !important; border-radius: 6px; }
/* An item on its way in (a pressed row's view while Logseq draws it) is laid out, unseen and out of the flow, at the width it will
   have: Look's passes then mark it as they mark what is on screen, so nothing in it settles after it is shown (13 November 2026). */
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item[data-lk-wait] { visibility: hidden !important; position: absolute !important; pointer-events: none !important; }`;

const itemsOf = doc => [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].filter(item => !item.hasAttribute('data-lk-closed'));
// Logseq's own list of what its sidebar holds, top first: [graph, id, kind] each, the id a page's or bullet's number, or a plugin's
// panel by its name. Read here once; two pages side by side (split.js) reads it through this.
const logseqList = () => { try { return host().defaultView.logseq?.api?.get_state_from_store('sidebar/blocks') || []; } catch (error) { return []; } };
const sidebarOpen = () => { try { return !!host().defaultView.logseq?.api?.get_state_from_store('ui/sidebar-open?'); } catch (error) { return false; } };
/* A section's panel that Logseq still holds in its list. Its item may stand in the sidebar a moment before the plugin's part inside it
   is drawn, as when the sidebar opens; opening the panel again at that moment adds nothing and only moves it to the top of Logseq's
   list, over a page just opened there (the 0.4 audit, 16 November 2026). So a panel Logseq holds is waited for, never opened again. */
const held = view => !!view.panel && logseqList().some(entry => entry?.[1] === `:${logseq.baseInfo?.id || 'logseq-plugin'}/_sidebar.${view.panel}`);
const nameOf = item => (item.querySelector('.sidebar-item-header .page-title')?.textContent || item.querySelector('.sidebar-item-header')?.textContent || '').trim();
const isContents = item => nameOf(item) === 'Contents' && !item.classList.contains('lk-side');
const toggle = (el, name, on) => { if (on !== el.hasAttribute(name)) el.toggleAttribute(name, on); };

function draw(doc = host()) {
  const side = doc.getElementById('right-sidebar');
  if (!side) return;
  toggle(side, 'data-lk-stack', true);
  // Two pages side by side use the sidebar as the right half and show only that page (split.js): nothing is opened or marked then.
  if (side.hasAttribute('data-lk-split')) return;
  const parts = views.filter(v => v.auto).sort((a, b) => a.order - b.order);
  /* A part of the page that applies here and is not in the sidebar yet is opened, while the sidebar is open: it never opens the
     sidebar by itself. Asked once a second at most, should Logseq be slow to draw it. */
  /* Not while Logseq's list holds a page or bullet it has yet to draw (the sidebar opening for the page beside, split.js): opened
     then, a part went to the top of Logseq's list over that page, and the half stood blank (the 0.4 audit, 16 November 2026). */
  const drawn = itemsOf(doc).filter(item => item.classList.contains('item-type-page') || item.classList.contains('item-type-block')).length;
  const coming = logseqList().filter(entry => typeof entry?.[1] === 'number').length > drawn;
  if (coming) { if (!st.retry) st.retry = doc.defaultView.setTimeout(() => { st.retry = 0; draw(); }, 400); }
  else if (sidebarOpen()) for (const view of parts) {
    if (view.hidden?.(doc) || view.find(doc) || held(view)) continue;
    if (Date.now() - (st.asked.get(view.key) || 0) < 1000) continue;
    st.asked.set(view.key, Date.now()); view.open();
  }
  const partItems = new Map();
  for (const view of parts) { const item = view.find(doc); if (item) partItems.set(item, view); }
  for (const item of doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')) {
    const view = partItems.get(item);
    toggle(item, 'data-lk-part', !!view);
    if (view) { const order = String(parts.indexOf(view) + 1); if (item.style.getPropertyValue('--lk-part-order') !== order) item.style.setProperty('--lk-part-order', order); }
    else if (item.style.getPropertyValue('--lk-part-order')) item.style.removeProperty('--lk-part-order');
    toggle(item, 'data-lk-aside', !!view && !!view.hidden?.(doc));
    toggle(item, 'data-lk-contents', isContents(item));
    toggle(item, 'data-lk-wait', !view && views.some(v => v.owns?.(item)));
    toggle(item, 'data-lk-row', !!view?.rows);
  }
  toggle(side, 'data-lk-rows', st.rows);
  // The open width, taken only once it holds still for a pass, so a width on the way open or shut never sets it.
  const w = Math.round(side.getBoundingClientRect().width);
  if (w > 240 && w === st.width && side.style.getPropertyValue('--lk-side-w') !== w - 16 + 'px') side.style.setProperty('--lk-side-w', w - 16 + 'px');
  st.width = w;
  // The Row view button reads as pressed while the row view is on.
  for (const a of doc.querySelectorAll('.lk-tool[data-on-click="rowView"]')) if (a.getAttribute('aria-pressed') !== String(st.rows)) a.setAttribute('aria-pressed', String(st.rows));
  // In the row view Ontology stands folded under the row, by Logseq's own fold, so its head still opens it.
  if (st.rows) { const ont = [...partItems].find(([, v]) => v.rows && v.key !== 'item')?.[0]; const fold = ont?.querySelector('.sidebar-item-header > button[aria-expanded="true"]'); if (fold && !st.folded) { st.folded = true; Door.screen.click(fold); } }
  // A part of the page that comes into view rolls out of where it stands, as every section that opens (the grammar).
  // Not while the sidebar itself slides open: that is motion enough.
  const nowOpen = sidebarOpen();
  if (nowOpen && !st.wasOpen) st.openAt = Date.now();
  st.wasOpen = nowOpen;
  /* Known by the part, not by its element: Logseq hands a row's view a new element on every row, and the row's view changing is a
     fade of its own (inspector.js), never a roll. */
  for (const view of parts) {
    const item = view.find(doc);
    const seen = nowOpen && !!item && !item.hasAttribute('data-lk-aside') && (!st.rows || view.rows) && !!item.getClientRects().length;
    if (seen && !st.shownParts.has(view.key)) { st.shownParts.add(view.key); if (Date.now() - st.openAt > 450) Door.unroll(item); }   // in the same pass, before it is painted whole
    else if (!seen && !(view.key === 'item' && view.owns && st.shownParts.has('item') && views.some(v => v.key === 'item' && !v.hidden?.(doc)))) st.shownParts.delete(view.key);
  }
  // The first section seen: the first part shown, else the first item shown in Logseq's order.
  const shown = item => !item.hasAttribute('data-lk-aside') && !item.hasAttribute('data-lk-contents') && !item.hasAttribute('data-lk-wait') && !item.hasAttribute('data-lk-closed') && (!st.rows || item.hasAttribute('data-lk-row'));
  const all = [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')];
  const first = [...partItems.keys()].filter(shown).sort((a, b) => parts.indexOf(partItems.get(a)) - parts.indexOf(partItems.get(b)))[0] || all.find(item => !partItems.has(item) && shown(item));
  for (const item of all) toggle(item, 'data-lk-first', item === first);
  /* The sidebar never stands open and blank (the owner, 17 November 2026: "the sidebar also shouldn't have a blank or be open to
     that"): open with nothing to show, and no part of the page on its way, it closes after a moment. Closed that way, it opens again
     by itself on the next page where a part of the page applies (from Dr. Mei Chen back to Doctor, Ontology is back). Closed by you,
     it stays closed. */
  const open = sidebarOpen();
  const due = parts.some(view => view.key !== 'item' && !view.hidden?.(doc) && (!st.rows || view.rows));
  if (open) st.autoShut = false;
  else if (st.autoShut && due) { st.autoShut = false; logseq.App.setRightSidebarVisible(true); return; }
  const empty = open && !coming && !all.some(shown) && !parts.some(view => !view.hidden?.(doc) && !view.find(doc) && (!st.rows || view.rows));
  if (empty && !st.emptyTimer) st.emptyTimer = doc.defaultView.setTimeout(() => {
    st.emptyTimer = 0;
    const d = host(), side = d.getElementById('right-sidebar');
    if (!sidebarOpen() || side?.hasAttribute('data-lk-split')) return;
    const still = ![...d.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].some(shown) && !views.filter(v => v.auto).some(v => !v.hidden?.(d) && !v.find(d) && (!st.rows || v.rows));
    if (still) { logseq.App.setRightSidebarVisible(false); st.autoShut = true; }
  }, 700);
}

/* Something you opened is closed by its ×: once the sidebar has taken it away, if nothing you opened is left, the sidebar closes,
   even with a part of the page still in it. */
const opened = doc => itemsOf(doc).some(item => !item.hasAttribute('data-lk-part') && !item.hasAttribute('data-lk-contents') && !item.hasAttribute('data-lk-wait') && !views.some(v => v.owns?.(item)));
function onClose(event) {
  const doc = host();
  const close = event.target?.closest?.('#right-sidebar .sidebar-item .item-actions button, #right-sidebar .sidebar-item .lk-close');
  // A person's press only: the plugin closing a view of its own (a pressed row's, the page since left) never closes the sidebar.
  if (!event.isTrusted || !close || doc.getElementById('right-sidebar')?.hasAttribute('data-lk-split')) return;
  if (close.closest('.sidebar-item')?.hasAttribute('data-lk-part')) return;
  const win = doc.defaultView;
  win.setTimeout(() => { draw(doc); if (sidebarOpen() && !opened(doc)) logseq.App.setRightSidebarVisible(false); }, 360);   // the section rolls up in 140 ms
}

function start() {
  if (st.off) return;
  Door.root.style('sidebar-tabs', CSS);
  st.off = Door.root.watch(draw);
  st.offClick = Door.root.listen(host(), 'click', onClose, true);
}
function stop() {
  st.off?.(); st.off = null; st.offClick?.(); st.offClick = null;
  Door.root.style('sidebar-tabs', '');
  const doc = host();
  doc.getElementById('right-sidebar')?.removeAttribute('data-lk-stack');
  doc.getElementById('right-sidebar')?.removeAttribute('data-lk-rows'); doc.getElementById('right-sidebar')?.style.removeProperty('--lk-side-w');
  for (const n of doc.querySelectorAll('#right-sidebar :is([data-lk-part], [data-lk-aside], [data-lk-contents], [data-lk-wait], [data-lk-first], [data-lk-row])')) {
    for (const a of ['data-lk-part', 'data-lk-aside', 'data-lk-contents', 'data-lk-wait', 'data-lk-first', 'data-lk-row']) n.removeAttribute(a);
    n.style.removeProperty('--lk-part-order');
  }
}
Door.sideTabs = {
  add(view) {
    const i = views.findIndex(v => v.key === view.key); if (i >= 0) views.splice(i, 1);
    views.push(view); start(); draw();
    return () => { const at = views.indexOf(view); if (at >= 0) views.splice(at, 1); if (!views.length) stop(); else draw(); };
  },
  // A section asked for from elsewhere (the ··· menu, the command palette, a toolbar button): opened, and the sidebar with it.
  // A part of the page is only shown with the sidebar; it opens by itself where it applies.
  show(key) { const view = views.find(v => v.key === key); if (view && !view.auto && !view.find(host()) && !held(view)) view.open(); logseq.App.setRightSidebarVisible(true); draw(); },
  /* The row view, on or off (the toolbar's Row view button). On: the sidebar opens, showing the row pressed and Ontology folded. Off:
     Ontology unfolded again if the row view folded it, and the stack as it was; the module that draws the row lets it go (onRows). */
  rows(on) {
    if (on === undefined) return st.rows;
    st.rows = !!on;
    const doc = host();
    if (!st.rows && st.folded) { st.folded = false; const fold = doc.querySelector('#right-sidebar .sidebar-item[data-lk-row].collapsed .sidebar-item-header > button[aria-expanded="false"]'); if (fold) Door.screen.click(fold); }
    for (const fn of rowsHeard) { try { fn(st.rows); } catch (error) { console.error('logseq-plugin: the row view could not be followed', error); } }
    if (st.rows) logseq.App.setRightSidebarVisible(true);
    draw();
    return st.rows;
  },
  onRows(fn) { rowsHeard.add(fn); return () => rowsHeard.delete(fn); },
  // Kept for the parts that picked a tab: with every section in view there is nothing to pick.
  pick() { draw(); },
  draw, stop,
  // Logseq's own list of what its sidebar holds, for the parts that work with it (two pages side by side).
  list: logseqList,
};
})();
