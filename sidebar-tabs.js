/* The right sidebar as tabs (the owner, 9 November 2026: "it doesn't make sense why there are tabs for different parts yet they
   all appear in one long column with their own headers"; "how about for other sidebar items?"). The row on top of the sidebar is
   one tab per thing the sidebar can show, and only the tab picked is shown, without the head Logseq gives each item (its name,
   fold arrow and ×): the tab names it.

   The plugin's views come first, always there, in the order they ask for: Inspector (Structure), Links and Endnotes (Look). A view
   not yet open opens when its tab is picked. After them, one tab, Sidebar, while anything else is open there (a page or block
   opened with Shift and a link): Logseq's own sidebar as it is, those items stacked with their own heads (the owner: "why not just
   have a tab as the normal sidebar?"). A page or block just opened picks it. Logseq's Contents, Page graph and Help and the
   cube with a + are left out of the row (Contents, which Logseq puts in a sidebar opened empty, is not shown).

   A module adds a view with Door.sideTabs.add({ key, word, order, find(doc) → its .sidebar-item or null, open() }) and gets back
   what takes it off. The bar is drawn by one pass of the shared screen watcher while any view is added. */
(function () {
const Door = window.PluginDoor;
const { host } = Door;
const views = [];
const SIDE = 'sidebar';
const tabs = { cur: null, seen: new WeakSet(), pending: null, off: null };   // cur: a view's key, or SIDE

const BAR = '#right-sidebar .cp__right-sidebar-settings';
const CSS = `
#right-sidebar[data-lk-tabs] ${BAR.replace('#right-sidebar ', '')} > div:not(.lk-tabs) { display: none !important; }
#right-sidebar[data-lk-tabs] .lk-tabs { display: flex; align-items: center; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
#right-sidebar[data-lk-tabs] .lk-tabs::-webkit-scrollbar { display: none; }
#right-sidebar[data-lk-tabs] .lk-tab { display: inline-flex; align-items: center; flex: none; max-width: 180px; }
#right-sidebar[data-lk-tabs] .lk-tab .cp__right-sidebar-settings-btn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
#right-sidebar[data-lk-tabs] .lk-tab.on .cp__right-sidebar-settings-btn { opacity: 1 !important; font-weight: 500; }
#right-sidebar[data-lk-tabs] .sidebar-item-list > .sidebar-item:not([data-lk-tab-on]) { display: none !important; }
#right-sidebar[data-lk-tabs] .sidebar-item-list > .sidebar-item[data-lk-tab-view] .sidebar-item-header { display: none !important; }
#right-sidebar[data-lk-tabs] .sidebar-item-list > .sidebar-item[data-lk-tab-view] { border-top: 0 !important; margin-top: 0 !important; padding-top: 0 !important; }`;

const itemsOf = doc => [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].filter(item => !item.hasAttribute('data-lk-closed'));
const viewOf = (doc, item) => views.find(v => v.find(doc) === item);
const nameOf = item => (item.querySelector('.sidebar-item-header .page-title')?.textContent || item.querySelector('.sidebar-item-header')?.textContent || '').trim();
const isContents = item => nameOf(item) === 'Contents' && !item.classList.contains('lk-side');

function pick(doc, what) {
  tabs.cur = what;
  draw(doc);
}
function pickView(doc, view) {
  if (!view.find(doc)) { tabs.pending = view.key; view.open(); }
  pick(doc, view.key);
}
function tabEl(doc, { word, on, title, click }) {
  const box = doc.createElement('div'); box.className = `text-sm lk-tab${on ? ' on' : ''}`;
  const press = doc.createElement('button'); press.type = 'button'; press.className = 'button cp__right-sidebar-settings-btn'; press.textContent = word;
  if (title) press.title = title;
  press.addEventListener('click', click);
  box.appendChild(press);
  return box;
}

function draw(doc = host()) {
  const side = doc.getElementById('right-sidebar'), bar = doc.querySelector(BAR);
  if (!side || !bar) return;
  if (!side.hasAttribute('data-lk-tabs')) side.setAttribute('data-lk-tabs', '');
  const items = itemsOf(doc);
  const ordered = [...views].sort((a, b) => a.order - b.order);
  // A page or block just opened in the sidebar is the one shown; a view's item appearing after its tab was picked stays picked.
  for (const item of items) {
    if (tabs.seen.has(item)) continue;
    tabs.seen.add(item);
    const view = viewOf(doc, item);
    if (view) { if (tabs.pending === view.key) { tabs.cur = view.key; tabs.pending = null; } }
    else if (!isContents(item)) tabs.cur = SIDE;
  }
  const others = items.filter(item => !viewOf(doc, item) && !isContents(item));
  if (tabs.cur === SIDE && !others.length) tabs.cur = null;
  // The tab picked is gone: the first view that is open, else the first view, opened.
  if (tabs.cur !== SIDE && !views.some(v => v.key === tabs.cur)) tabs.cur = ordered.find(v => v.find(doc))?.key || null;
  if (!tabs.cur && ordered[0] && !tabs.pending) { pickView(doc, ordered[0]); return; }
  // Which items show: the view picked, alone and without its head; or, on Sidebar, everything else as Logseq stacks it.
  const view = views.find(v => v.key === tabs.cur), viewItem = view?.find(doc);
  const viewItems = new Set(views.map(v => v.find(doc)).filter(Boolean));
  for (const item of doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')) {
    const on = tabs.cur === SIDE ? others.includes(item) : item === viewItem;
    if (on !== item.hasAttribute('data-lk-tab-on')) item.toggleAttribute('data-lk-tab-on', on);
    const isView = viewItems.has(item);
    if (isView !== item.hasAttribute('data-lk-tab-view')) item.toggleAttribute('data-lk-tab-view', isView);
  }
  // The row, drawn again only when what it says changes.
  const sig = JSON.stringify([ordered.map(v => [v.key, v.word]), others.length > 0, tabs.cur]);
  let row = bar.querySelector(':scope > .lk-tabs');
  if (row && row.dataset.sig === sig && bar.firstElementChild === row) return;
  if (!row) { row = doc.createElement('div'); row.className = 'lk-tabs lk-own-tabs'; }
  row.dataset.sig = sig;
  const made = ordered.map(v => tabEl(doc, { word: v.word, on: tabs.cur === v.key, click: () => pickView(doc, v) }));
  if (others.length) made.push(tabEl(doc, { word: 'Sidebar', title: 'The pages and blocks opened in the sidebar', on: tabs.cur === SIDE, click: () => pick(doc, SIDE) }));
  row.replaceChildren(...made);
  if (bar.firstElementChild !== row) bar.prepend(row);
}

function start() {
  if (tabs.off) return;
  Door.root.style('sidebar-tabs', CSS);
  tabs.off = Door.root.watch(draw);
}
function stop() {
  tabs.off?.(); tabs.off = null;
  Door.root.style('sidebar-tabs', '');
  const doc = host();
  doc.getElementById('right-sidebar')?.removeAttribute('data-lk-tabs');
  doc.querySelectorAll('#right-sidebar .lk-tabs').forEach(n => n.remove());
  doc.querySelectorAll('#right-sidebar [data-lk-tab-on], #right-sidebar [data-lk-tab-view]').forEach(n => { n.removeAttribute('data-lk-tab-on'); n.removeAttribute('data-lk-tab-view'); });
}
Door.sideTabs = {
  add(view) {
    const i = views.findIndex(v => v.key === view.key); if (i >= 0) views.splice(i, 1);
    views.push(view); start(); draw();
    return () => { const at = views.indexOf(view); if (at >= 0) views.splice(at, 1); if (!views.length) stop(); else draw(); };
  },
  // A view opened from elsewhere (the ··· menu, the command palette) is the one shown once its item is there.
  show(key) { tabs.pending = key; tabs.cur = key; draw(); },
  draw, stop,
};
})();
