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
const st = { off: null, offClick: null, asked: new Map(), retry: 0 };   // asked: when an automatic section was last asked to open, by key

const CSS = `
/* Logseq's words in the bar on top (Contents, Page graph, Help, the cube with a +) stay left out, as with the tabs: the ? at the
   window's bottom right opens Logseq's help. */
#right-sidebar[data-lk-stack] .cp__right-sidebar-settings > div:not([class*="lk-"]) { display: none !important; }
/* The page's own parts first, in their order; what you opened after them, as Logseq stacks it. */
#right-sidebar[data-lk-stack] .sidebar-item-list { display: flex; flex-direction: column; }
#right-sidebar[data-lk-stack] .sidebar-item-list > * { order: 10; flex: none !important; }   /* each section its own height, the column scrolls, as Logseq stacks them */
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
  }
  // The first section seen: the first part shown, else the first item shown in Logseq's order.
  const shown = item => !item.hasAttribute('data-lk-aside') && !item.hasAttribute('data-lk-contents') && !item.hasAttribute('data-lk-wait') && !item.hasAttribute('data-lk-closed');
  const all = [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')];
  const first = [...partItems.keys()].filter(shown).sort((a, b) => parts.indexOf(partItems.get(a)) - parts.indexOf(partItems.get(b)))[0] || all.find(item => !partItems.has(item) && shown(item));
  for (const item of all) toggle(item, 'data-lk-first', item === first);
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
  for (const n of doc.querySelectorAll('#right-sidebar :is([data-lk-part], [data-lk-aside], [data-lk-contents], [data-lk-wait], [data-lk-first])')) {
    for (const a of ['data-lk-part', 'data-lk-aside', 'data-lk-contents', 'data-lk-wait', 'data-lk-first']) n.removeAttribute(a);
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
  // Kept for the parts that picked a tab: with every section in view there is nothing to pick.
  pick() { draw(); },
  draw, stop,
  // Logseq's own list of what its sidebar holds, for the parts that work with it (two pages side by side).
  list: logseqList,
};
})();
