/* Two pages side by side (the owner, 14 November 2026, layout A of the split mockups: "⌘-click"). A ⌘-click on a link to a page in
   the main view (a page's link in the words or a property's value, a tag, a node's row that Threads or another module draws) opens
   that page beside the one shown: the main area is cut into two equal halves, the page you were on on the left, the one you
   ⌘-clicked on the right. A plain click still goes to the page and Shift-click still opens it in the right sidebar. Logseq 2.0.2
   does nothing of its own on ⌘ with a link: a ⌘-click went to the page as a plain click does (seen in the app, 14 November 2026).

   The right half is Logseq's own right sidebar holding that page, so it is a whole Logseq page you write in, with its links, Look
   and Threads, and Logseq keeps it as it keeps anything opened there. While the split is on the sidebar is redrawn as a page: half
   the main area wide, no tab row, no head on the item, the main view's ground, and the page's title over it at the main title's
   size (a page opened in the sidebar has no title of its own). A second page, or a two-page main view, would have to be drawn by
   the plugin and would not be Logseq's page; this is the one way that keeps both halves Logseq's.

   Between the halves stands one hairline. Pointing at it shows ⇄ at its top (the library's lk-reveal), which swaps the two pages;
   dragging it makes one half wider, never narrower than 320 px; a double press on it gives equal halves again. Pointing at a page
   shows × at its top right (lk-reveal too): on the right it closes the right page, on the left it closes the left page and the
   right one takes the main area. The page that stays takes the whole width, and the sidebar is as it was before the split (open
   on the tab it was on, or closed). The right page rolls out as it opens and rolls back up as it closes, the door's one motion,
   standing still under reduced motion.

   The real sidebar stays yours: opening anything in it while the split is on (Shift-click, a view from the ··· menu) ends the
   split, and the sidebar is shown as always, the page that was on the right among Opened. Closing the sidebar (its button, t r)
   closes the right page, which stays among Opened for the next time it is shown. Nothing is written to the graph: the split only
   changes what is shown. Off with the setting "⌘-click opens a page beside" (Following links). */
(function () {
const Door = window.PluginDoor;
const { host } = Door;
const SCHEMA = [{ key: 'splitOnCmdClick', type: 'boolean', default: true, title: '⌘-click opens a page beside',
  description: 'A ⌘-click on a link opens its page beside the one shown, the main area in two halves; off, a ⌘-click goes to the page as a click does.' }];
const MIN = 320;   // px: the narrowest a half is dragged to
const LINK = 'a.page-ref[data-uuid], a.tag[data-uuid], .lk-node[data-uuid]';
const base = Door.base('split', { prefix: 'Logseq Plugin (split): ', schema: SCHEMA,
  leaves: { elements: '.lk-split-own', attributes: ['data-lk-split', 'data-lk-split-item'], reset: doc => { doc.documentElement.style.removeProperty('--lk-split-w'); } } });

/* The one state of the split: the node on the right (its number in Logseq's sidebar list and its id), the share of the main area
   the right half takes, what the sidebar was before, and whether a change of the split's own is under way (then the screen's
   pass leaves the sidebar's list alone, since the split itself is changing it). */
const split = { id: null, uuid: null, page: false, title: '', ratio: .5, before: null, busy: false };

const api = () => host().defaultView.logseq?.api;
const sideList = () => { try { return api()?.get_state_from_store('sidebar/blocks') || []; } catch (error) { return []; } };
const sideOpen = () => { try { return !!api()?.get_state_from_store('ui/sidebar-open?'); } catch (error) { return false; } };
const items = doc => [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')];   // in the order of Logseq's list
const sidebar = doc => doc.getElementById('right-sidebar');
// The item Logseq drew for a node, by its place in Logseq's list; none while the list and the screen disagree (Logseq has the
// node in its list and has not drawn it yet).
const at = (doc, id) => { const list = sideList(), all = items(doc), i = list.findIndex(entry => entry?.[1] === id); return i < 0 || all.length !== list.length ? null : all[i] || null; };
const content = item => item?.querySelector('.sidebar-panel-content') || item;

const CSS = `
/* The sidebar as the right half: its width from the split's share (--lk-split-w, set by layout()), no tab row (its band kept, so
   the title stands level with the main title), no handle of Logseq's, only the split's item, without its head or its card. */
#right-sidebar[data-lk-split] { width: var(--lk-split-w, 50vw) !important; min-width: 0 !important; max-width: none !important; transition: none !important; background: var(--lk-paper) !important; border-left: 0 !important; }
#right-sidebar[data-lk-split] > .resizer { display: none !important; }
#right-sidebar[data-lk-split] .cp__right-sidebar-topbar > * { visibility: hidden !important; }
#right-sidebar[data-lk-split] .sidebar-item-list > :not([data-lk-split-item]) { display: none !important; }
#right-sidebar[data-lk-split][data-lk-split] .sidebar-item-list { padding-top: 40px !important; }   /* the title level with the main title */
#right-sidebar[data-lk-split] .cp__right-sidebar-topbar { border: 0 !important; box-shadow: none !important; background: none !important; }
#right-sidebar[data-lk-split] .cp__right-sidebar-topbar::before, #right-sidebar[data-lk-split] .cp__right-sidebar-topbar::after { display: none !important; }
#right-sidebar[data-lk-split] .sidebar-item-list > .sidebar-item[data-lk-split-item] { display: flex !important; background: var(--lk-paper) !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; margin: 0 !important; }
#right-sidebar[data-lk-split] .sidebar-item[data-lk-split-item] .sidebar-item-header { display: none !important; }
#right-sidebar[data-lk-split] .sidebar-item[data-lk-split-item] .sidebar-panel-content { padding: 0 clamp(16px, 4%, 44px) 96px !important; }
/* The page's title, at the main title's size and weight (read from it as the split opens). */
.lk-split-title { margin: 0 0 12px; overflow-wrap: anywhere; color: var(--lk-text); }
/* The hairline between the halves: a strip the hand can hold, the line in its middle, ⇄ at its top. */
.lk-split-line { position: fixed; top: 0; bottom: 0; left: calc(100vw - var(--lk-split-w, 50vw) - 5px); width: 11px; z-index: 9; cursor: col-resize; touch-action: none; background: none !important; border: 0 !important; }   /* Logseq draws its own separators as a grey band */
.lk-split-line::before { content: ''; position: absolute; top: 0; bottom: 0; left: 5px; width: 1px; background: var(--lk-hair); }
.lk-split-line.lk-held::before { background: var(--lk-line); }
.lk-split-swap, .lk-split-x { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0 !important; border-radius: 50% !important; line-height: 1; cursor: pointer; }
.lk-split-line > .lk-split-swap.lk-reveal { position: absolute; top: 56px; left: 50%; transform: translateX(-50%); }
/* A page's ×, at its top right, below Logseq's header band (a mouse press in that band moves the window and reaches nothing).
   It stands over the page, not in it: the page scrolls, and it holds presses of its own that showing the × must not show.
   It shows while the page or the × is pointed at (lk-near, put on by near()). */
body > .lk-split-x.lk-reveal { position: fixed; top: 56px; z-index: 9; }   /* over the library's own place for a press (lk-reveal) */
body > .lk-split-x[data-side="left"] { right: calc(var(--lk-split-w, 50vw) + 14px); }
body > .lk-split-x[data-side="right"] { right: 14px; }`;

// The width of the right half, from the share and the main area as it is now (the left sidebar open or not, the window's width).
function layout(doc = host()) {
  if (!split.id) return;
  const main = doc.getElementById('main-content-container'), win = doc.defaultView;
  const left = main ? main.getBoundingClientRect().left : 0, whole = Math.max(0, win.innerWidth - left);
  const share = whole < MIN * 2 ? .5 : Math.min(1 - MIN / whole, Math.max(MIN / whole, split.ratio));
  const width = Math.round(whole * share) + 'px';
  if (doc.documentElement.style.getPropertyValue('--lk-split-w') !== width) doc.documentElement.style.setProperty('--lk-split-w', width);
}

// The split's own pieces on the screen, put there again whenever Logseq draws the sidebar or the main view anew.
function draw(doc = host()) {
  if (!split.id) return;
  const side = sidebar(doc), item = at(doc, split.id);
  if (!side || !item) return;
  if (!side.hasAttribute('data-lk-split')) side.setAttribute('data-lk-split', '');
  for (const other of side.querySelectorAll('[data-lk-split-item]')) if (other !== item) other.removeAttribute('data-lk-split-item');
  for (const stray of side.querySelectorAll('.lk-split-own')) if (!item.contains(stray)) stray.remove();   // Logseq may hand an item's box to another node
  if (!item.hasAttribute('data-lk-split-item')) item.setAttribute('data-lk-split-item', '');
  const panel = content(item);
  if (split.page && panel && panel.firstElementChild?.dataset?.splitFor !== String(split.id)) {
    panel.querySelector(':scope > .lk-split-title')?.remove();
    const title = Door.el(doc, 'div', { class: 'lk-split-title lk-split-own', 'data-split-for': split.id }, split.title);
    const main = doc.querySelector('#main-content-container .ls-page-title .block-content') || doc.querySelector('#main-content-container .ls-page-title');
    const cs = main ? doc.defaultView.getComputedStyle(main) : null;
    Object.assign(title.style, { fontSize: cs?.fontSize || '30px', fontWeight: cs?.fontWeight || '600', lineHeight: cs?.lineHeight || '1.3', letterSpacing: cs?.letterSpacing || 'normal', fontFamily: cs?.fontFamily || 'inherit' });
    panel.prepend(title);
  }
  // The title's left edge on the bullets' column, as the main title stands over the main page's bullets (once Logseq drew them).
  // Measured on every pass until it holds, since Logseq may draw the bullets after the title.
  const title = split.page && panel?.querySelector(':scope > .lk-split-title'), dot = title && panel.querySelector('.ls-page-blocks .bullet-container');
  if (dot && dot.getBoundingClientRect().width) {
    const shift = Math.round(dot.getBoundingClientRect().left - 2 - title.getBoundingClientRect().left);
    if (Math.abs(shift) > 1) title.style.marginLeft = Math.max(0, (parseFloat(title.style.marginLeft) || 0) + shift) + 'px';
  }
  if (!split.page) panel?.querySelector(':scope > .lk-split-title')?.remove();
  for (const side of ['left', 'right']) if (!doc.body.querySelector(`:scope > .lk-split-x[data-side="${side}"]`)) doc.body.appendChild(press(doc, side));
  if (!doc.body.querySelector(':scope > .lk-split-line')) doc.body.appendChild(line(doc));
  layout(doc);
}
// A page's ×: the library's lk-x, shown while the page is pointed at (lk-reveal).
function press(doc, side) {
  const words = side === 'right' ? 'Close this page' : 'Close this page; the page on the right takes its place';
  return Door.el(doc, 'button', { type: 'button', class: 'lk-x lk-reveal lk-split-x lk-split-own', 'data-side': side, title: words, 'aria-label': words, click: event => { event.preventDefault(); event.stopPropagation(); close(side); } }, '×');
}
// The hairline: dragged, it moves; pressed twice, equal halves; ⇄ at its top swaps the pages.
function line(doc) {
  const swap = Door.el(doc, 'button', { type: 'button', class: 'lk-change lk-reveal lk-split-swap', title: 'Swap the two pages', 'aria-label': 'Swap the two pages', click: event => { event.preventDefault(); event.stopPropagation(); swapPages(); } }, '⇄');
  const strip = Door.el(doc, 'div', { class: 'lk-split-line lk-reveals lk-split-own', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Between the two pages: drag to make one wider, double-click for equal halves' }, swap);
  strip.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.lk-split-swap')) return;
    event.preventDefault();
    strip.setPointerCapture?.(event.pointerId);
    strip.classList.add('lk-held');
    const win = doc.defaultView, main = doc.getElementById('main-content-container');
    const move = e => { const left = main ? main.getBoundingClientRect().left : 0, whole = win.innerWidth - left; if (whole > 0) { split.ratio = (win.innerWidth - e.clientX) / whole; layout(doc); } };
    const up = () => { strip.classList.remove('lk-held'); strip.removeEventListener('pointermove', move); strip.removeEventListener('pointerup', up); strip.removeEventListener('pointercancel', up); };
    strip.addEventListener('pointermove', move); strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  });
  strip.addEventListener('dblclick', event => { if (event.target.closest('.lk-split-swap')) return; split.ratio = .5; layout(doc); });
  return strip;
}

// The pointer on a page, or on its ×, shows that page's ×.
function near(event) {
  if (!split.id) return;
  const doc = host(), at = event.type === 'pointerout' && !event.relatedTarget ? null : event.target;
  const on = side => !!at?.closest?.(side === 'left' ? '#main-content-container, .lk-split-x[data-side="left"]' : '#right-sidebar[data-lk-split], .lk-split-x[data-side="right"]');
  for (const x of doc.querySelectorAll('body > .lk-split-x')) { const lit = on(x.dataset.side); if (lit !== x.classList.contains('lk-near')) x.classList.toggle('lk-near', lit); }
}

// Takes the split's marks and pieces off the screen; the sidebar is then drawn as Logseq draws it.
function unmark(doc = host()) {
  for (const el of doc.querySelectorAll('.lk-split-own')) el.remove();
  for (const el of doc.querySelectorAll('[data-lk-split-item]')) el.removeAttribute('data-lk-split-item');
  sidebar(doc)?.removeAttribute('data-lk-split');
  doc.documentElement.style.removeProperty('--lk-split-w');
}
function forget() { split.id = null; split.uuid = null; split.page = false; split.title = ''; split.before = null; }

// Waits until Logseq's sidebar list holds the node at its top and has drawn it; then marks it in the same frame.
const drawnOnTop = (doc, id) => Door.screen.waitFor(() => sideList()[0]?.[1] === id && items(doc)[0]?.querySelector('.sidebar-panel-content') ? items(doc)[0] : null, 4000, { frames: true });
// Takes an item out of Logseq's sidebar list by its own ×, once Logseq has drawn the list as it holds it (a moment after a change).
const takeOut = async (doc, id) => {
  const item = at(doc, id) || await Door.screen.waitFor(() => at(doc, id), 1500, { frames: true });
  if (!Door.screen.click(item?.querySelector('.item-actions .ls-icon-x')?.closest('button'))) base.warnOnce('a page could not be taken out of the sidebar');
};

/* Opens a node on the right: the split begins, or the page already on the right gives way to it. */
async function open(uuid) {
  if (split.busy || !uuid) return;
  const doc = host();
  const node = await logseq.Editor.getPage(uuid).catch(() => null) || await logseq.Editor.getBlock(uuid).catch(() => null);
  if (!node?.id) return;
  if (node.id === split.id) return;
  split.busy = true;
  const was = split.id, first = !was;
  try {
    if (first) split.before = { open: sideOpen(), tab: sidebar(doc)?.getAttribute('data-lk-tab') || '', had: new Set(sideList().map(entry => entry?.[1])) };
    const had = split.before.had.has(node.id);
    split.id = node.id; split.uuid = String(node.uuid); split.page = !node.page; split.title = node.title || node.originalName || node.name || '';
    if (first) { layout(doc); sidebar(doc)?.setAttribute('data-lk-split', ''); }   // the half is there, empty, before the page comes, so nothing shows at the sidebar's own width
    await logseq.Editor.openInRightSidebar(split.uuid);
    if (!sideOpen()) logseq.App.setRightSidebarVisible?.(true);
    const item = await drawnOnTop(doc, node.id);
    if (!item) { base.warnOnce('the page did not come into the sidebar'); unmark(doc); if (first) forget(); else split.id = was; return; }
    draw(doc);
    Door.unroll(content(item));
    if (was && !split.before.had.has(was)) await takeOut(doc, was);
    if (had) split.before.had.delete(node.id);
  } finally { split.busy = false; }
}

/* Closes one half. The right: its page rolls up and leaves the sidebar's list (unless it was there before the split). The left:
   the right page goes to the main view and the right half closes. Then the sidebar is as it was before the split. */
async function close(side) {
  if (!split.id || split.busy) return;
  const doc = host(), item = at(doc, split.id);
  split.busy = true;
  try {
    if (side === 'left') logseq.App.pushState('page', { name: split.uuid });
    if (item) await Door.rollUp(content(item));
    await end(doc, { takeOut: true });
  } finally { split.busy = false; }
}
// The split's end, by the split's own × or because the sidebar was changed by hand (then nothing is taken out of its list).
async function end(doc = host(), { takeOut: out = false } = {}) {
  const { before, id } = split;
  if (out && id != null && !before?.had.has(id)) await takeOut(doc, id);
  if (out && before && !before.open) logseq.App.setRightSidebarVisible?.(false);
  unmark(doc);
  forget();
  if (out && before?.open && before.tab) doc.defaultView.requestAnimationFrame(() => Door.sideTabs?.pick(before.tab));
}

/* ⇄: the page on the left goes to the right half and the right page to the main view. The left must be a page or a node. */
async function swapPages() {
  if (!split.id || split.busy) return;
  const left = await logseq.Editor.getCurrentPage().catch(() => null);
  if (!left?.uuid) return Door.notify('The left shows no page to swap');
  const right = split.uuid;
  if (String(left.uuid) === right) return;
  await open(String(left.uuid));
  logseq.App.pushState('page', { name: right });
}

// A ⌘-click on a link in the main view opens its page beside; the presses before it are held back, so Logseq does not go to it.
const LINK_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
function onLink(event) {
  if (event.button !== 0 || !(Door.keys.mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey) return;
  const link = event.target?.closest?.(LINK);
  if (!link || !link.closest('#main-content-container') || link.closest('.lk-split-own') || !base.setting('splitOnCmdClick')) return;
  const uuid = link.getAttribute('data-uuid');
  if (!Door.UUID.test(uuid || '')) return;
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  if (event.type === 'click') open(uuid);
}

// Logseq's sidebar changed by hand: anything else opened in it, or it closed, ends the split. Otherwise the split's pieces stay drawn.
function watch(doc) {
  if (!split.id || split.busy) return;
  const list = sideList();
  if (!sideOpen() || !list.length || list[0]?.[1] !== split.id) return end(doc);
  draw(doc);
}

Door.split = {
  schema: SCHEMA,
  start() {
    base.takeOver('__logseqPluginSplitStop', doc => base.sweep(doc));
    const doc = host(), win = doc.defaultView;
    base.sheet('lk-split-style', CSS);
    base.listen(win, LINK_EVENTS, onLink, true);
    base.listen(win, 'resize', () => layout(doc));
    base.listen(win, ['pointerover', 'pointerout'], near, { passive: true });
    base.watch(watch);
    base.onStop(() => split.id ? end(doc, { takeOut: true }) : undefined);   // the plugin stopping or reloading closes the split as its × would
    Door.root.onStop(() => base.stop());
  },
  stop: () => base.stop(),
  // For the checks: the state, and the ways in, as a press would call them.
  state: () => ({ ...split, before: split.before && { ...split.before, had: [...split.before.had] } }),
  open, close, swap: swapPages, layout,
};
Door.rootSchema = [...(Door.rootSchema || []), { key: 'splitHeading', type: 'heading', default: null, title: 'Two pages side by side', description: '' }, ...SCHEMA];
Door.describe('plugin', {
  schema: [{ type: 'heading', title: 'Two pages side by side', place: 'following' }, { ...SCHEMA[0], looks: ['Goes to the page', 'Opens beside'] }],
  specimen: (item, on) => on
    ? '<span style="display:grid;grid-template-columns:1fr 1fr"><span style="padding-right:12px;border-right:1px solid var(--lk-hair)"><span class="sw-big">Fatigue</span><br><span class="lk-node">Dr. Mei Chen</span></span><span style="padding-left:12px"><span class="sw-big">Dr. Mei Chen</span><br><span class="sw-faintw">opened beside</span></span></span>'
    : '<span class="sw-big">Dr. Mei Chen</span><br><span class="sw-faintw">Fatigue gave way to it, as a click does</span>',
});
})();
