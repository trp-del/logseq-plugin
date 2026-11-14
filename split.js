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

   Between the halves stands one hairline: dragging it makes one half wider, never narrower than 320 px; a double press on it
   gives equal halves again. While the split is on, two icons stand in the window's top right corner, in the empty band of
   Logseq's header over the right page, always shown and drawn as Logseq's own toolbar icons (the owner, 14 November 2026: "just
   put icons in right hand corner visible"): ⇄ swaps the two pages, × closes the right page. To close the left page instead, ⇄
   then ×. The page that stays takes the whole width, and the sidebar is as it was before the split (open on the tab it was on,
   or closed). The right page rolls out as it opens and rolls back up as it closes, the door's one motion,
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
  leaves: { elements: '.lk-split-own', attributes: ['data-lk-split', 'data-lk-split-item'], reset: doc => doc.documentElement.style.removeProperty('--lk-split-w') } });

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
/* The hairline between the halves: a strip the hand can hold, unseen, the 1px line at its left edge (firmer under the pointer and
   while dragged). The strip reaches only into the right page, so the left page's scroll bar, at the left page's edge and 11 pt
   wide under the pointer, is never under it. body > raises it over the library's rule that paints Logseq's separators as a grey
   band. */
body > .lk-split-line { position: fixed; top: 0; bottom: 0; left: calc(100vw - var(--lk-split-w, 50vw)); width: 10px; z-index: 11; cursor: col-resize; touch-action: none; background: none !important; border: 0 !important; -webkit-app-region: no-drag; }
body > .lk-split-line::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 1px; background: var(--lk-hair); }
body > .lk-split-line:hover::before, body > .lk-split-line.lk-held::before { background: var(--lk-line); }
/* ⇄ and ×, in the window's top right corner, in the band of Logseq's header over the right page, so nothing covers the right
   page's title. They are drawn as Logseq's toolbar icons (the library's toolbar button, Tabler's line icons at 20 px), and take
   their size, grey, stroke and spacing from Logseq's own icons on the left page's header (read by layout()). The band moves the
   window under a mouse press, so the icons are cut out of it (no-drag), as Logseq's are. */
body > .lk-split-tools { position: fixed; top: var(--lk-split-top, 8px); right: var(--lk-split-edge, 12px); z-index: 11; display: flex; align-items: center; gap: var(--lk-split-gap, 4px); -webkit-app-region: no-drag; }
body > .lk-split-tools > .lk-tool { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; -webkit-app-region: no-drag; }
body > .lk-split-tools > .lk-tool:is(:hover, :focus-visible) { opacity: 1 !important; }`;

// The width of the right half, from the share and the main area as it is now (the left sidebar open or not, the window's width).
function layout(doc = host()) {
  if (!split.id) return;
  const main = doc.getElementById('main-content-container'), win = doc.defaultView;
  const left = main ? main.getBoundingClientRect().left : 0, whole = Math.max(0, win.innerWidth - left);
  const share = whole < MIN * 2 ? .5 : Math.min(1 - MIN / whole, Math.max(MIN / whole, split.ratio));
  const width = Math.round(whole * share) + 'px';
  if (doc.documentElement.style.getPropertyValue('--lk-split-w') !== width) doc.documentElement.style.setProperty('--lk-split-w', width);
  // ⇄ and × drawn as Logseq's icons on the left page's header (··· and the sidebar's): their size, grey and stroke, the space
  // between them, their height in the band, and the space Logseq leaves after its last icon, read from the icons themselves.
  const box = doc.body.querySelector(':scope > .lk-split-tools'), own = [...(doc.querySelector('#head > .r > :last-child')?.children || [])]
    .map(el => el.matches('a.button, button') ? el : el.querySelector('a.button, button')).filter(el => el && el.getBoundingClientRect().width);
  if (box && own.length) {
    const last = own[own.length - 1], r = last.getBoundingClientRect(), cs = doc.defaultView.getComputedStyle(last);
    const head = doc.querySelector('#head > .r')?.getBoundingClientRect(), prev = own[own.length - 2]?.getBoundingClientRect();
    const set = (name, value) => { if (doc.documentElement.style.getPropertyValue(name) !== value) doc.documentElement.style.setProperty(name, value); };
    set('--lk-split-top', Math.round(r.top) + 'px');
    if (head) set('--lk-split-edge', Math.max(0, Math.round(head.right - r.right)) + 'px');
    if (prev) set('--lk-split-gap', Math.max(0, Math.round(r.left - prev.right)) + 'px');
    const stroke = last.querySelector('svg') && doc.defaultView.getComputedStyle(last.querySelector('svg')).strokeWidth;
    for (const icon of box.children) {
      Object.assign(icon.style, { width: r.width + 'px', height: r.height + 'px', padding: cs.padding, borderRadius: cs.borderRadius, color: cs.color, opacity: cs.opacity });
      if (stroke) icon.querySelector('svg')?.setAttribute('stroke-width', parseFloat(stroke) || 2);
    }
  }
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
  if (!doc.body.querySelector(':scope > .lk-split-tools')) doc.body.appendChild(tools(doc));
  if (!doc.body.querySelector(':scope > .lk-split-line')) doc.body.appendChild(line(doc));
  layout(doc);
}
// ⇄ and ×: the library's toolbar button (Door.toolbarButton) with its icons swap and close (Door.TOOLBAR_ICONS).
function tools(doc) {
  const box = Door.el(doc, 'div', { class: 'lk-split-tools lk-split-own' });
  box.innerHTML = Door.toolbarButton('', 'Swap pages', 'swap') + Door.toolbarButton('', 'Close the right page', 'close');
  const [swap, x] = box.children;
  for (const [icon, run] of [[swap, swapPages], [x, () => close('right')]]) {
    icon.removeAttribute('data-on-click');
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); run(); });
    icon.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run(); } });
  }
  swap.classList.add('lk-split-swap'); x.classList.add('lk-split-x');
  return box;
}
// The hairline: dragged, it moves; pressed twice, equal halves.
function line(doc) {
  const strip = Door.el(doc, 'div', { class: 'lk-split-line lk-split-own', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Between the two pages: drag to make one wider, double-click for equal halves' });
  strip.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    strip.setPointerCapture?.(event.pointerId);
    strip.classList.add('lk-held');
    const win = doc.defaultView, main = doc.getElementById('main-content-container');
    // Where in the strip it was taken: the line keeps that distance from the hand, so it does not jump to the pointer.
    const at = Math.min(10, Math.max(0, event.clientX - (win.innerWidth - (parseFloat(doc.documentElement.style.getPropertyValue('--lk-split-w')) || win.innerWidth / 2))));
    const move = e => { const left = main ? main.getBoundingClientRect().left : 0, whole = win.innerWidth - left; if (whole > 0) { split.ratio = (win.innerWidth - e.clientX + at) / whole; layout(doc); } };
    const up = () => { strip.classList.remove('lk-held'); strip.removeEventListener('pointermove', move); strip.removeEventListener('pointerup', up); strip.removeEventListener('pointercancel', up); };
    strip.addEventListener('pointermove', move); strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  });
  strip.addEventListener('dblclick', () => { split.ratio = .5; layout(doc); });
  return strip;
}

// Takes the split's marks and pieces off the screen; the sidebar is then drawn as Logseq draws it.
function unmark(doc = host()) {
  for (const el of doc.querySelectorAll('.lk-split-own')) el.remove();
  for (const el of doc.querySelectorAll('[data-lk-split-item]')) el.removeAttribute('data-lk-split-item');
  sidebar(doc)?.removeAttribute('data-lk-split');
  doc.documentElement.style.removeProperty('--lk-split-w');
  for (const name of ['--lk-split-top', '--lk-split-edge', '--lk-split-gap']) doc.documentElement.style.removeProperty(name);
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
    if (first) { const list = sideList().map(entry => entry?.[1]); split.before = { open: sideOpen(), tab: sidebar(doc)?.getAttribute('data-lk-tab') || '', had: new Set(list), list }; }
    split.id = node.id; split.uuid = String(node.uuid); split.page = !node.page; split.title = node.title || node.originalName || node.name || '';
    if (first) { layout(doc); sidebar(doc)?.setAttribute('data-lk-split', ''); }   // the half is there, empty, before the page comes, so nothing shows at the sidebar's own width
    await logseq.Editor.openInRightSidebar(split.uuid);
    if (!sideOpen()) logseq.App.setRightSidebarVisible?.(true);
    const item = await drawnOnTop(doc, node.id);
    if (!item) { base.warnOnce('the page did not come into the sidebar'); unmark(doc); if (first) forget(); else split.id = was; return; }
    draw(doc);
    Door.unroll(content(item));
    if (was && !split.before.had.has(was)) await takeOut(doc, was);   // a page that was in the sidebar before the split stays in it
  } finally { split.busy = false; }
}

/* Closes one half. The right (×): its page rolls up and leaves the sidebar's list (unless it was there before the split). The
   left (kept for the checks; ⇄ then × does it on screen): the right page goes to the main view and the right half closes. Then the sidebar is as it was before the split: the same items in the same order, open or closed, on its tab. */
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
  if (out && before) await reorder(doc, before.list);
  if (out && before && !before.open) logseq.App.setRightSidebarVisible?.(false);
  unmark(doc);
  forget();
  if (out && before?.open && before.tab) doc.defaultView.requestAnimationFrame(() => Door.sideTabs?.pick(before.tab));
}

/* The sidebar's list put back in the order it had before the split. Opening a page that was already in the list (on the right,
   or by ⇄) moved it to the top, as Logseq moves anything opened again, so the items that stood above it are opened again too,
   lowest first, each going to the top in turn; nothing is added or taken out. Logseq's list can only be changed this way, so an
   item the plugin cannot open again (another plugin's view) leaves the order as it is. */
async function reorder(doc, before = []) {
  const now = () => sideList().map(entry => entry?.[1]);
  const want = before.filter(id => now().includes(id));
  const cur = now().filter(id => want.includes(id));
  // The longest tail of the old order that still stands in that order at the bottom: only what is above it has to move.
  let k = want.length, j = cur.length - 1;
  while (k > 0 && j >= 0) { if (cur[j] === want[k - 1]) k--; j--; }
  const move = want.slice(0, k).reverse();
  if (!move.length) return;
  const OWN = ':logseq-plugin/';
  const opener = async id => typeof id === 'number' ? (await logseq.Editor.getBlock(id).catch(() => null) || await logseq.Editor.getPage(id).catch(() => null))?.uuid
    : typeof id === 'string' && id.startsWith(OWN) ? id.slice(OWN.length) : null;
  const ways = await Promise.all(move.map(opener));
  if (ways.some(way => !way)) return base.warnOnce('the sidebar\'s order could not be put back');
  for (let i = 0; i < move.length; i++) {
    await logseq.Editor.openInRightSidebar(String(ways[i]));
    await Door.screen.waitFor(() => sideList()[0]?.[1] === move[i] || null, 1500, { frames: true });
  }
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
    // Light and dark: when the theme changes, Logseq's own header icons fade to their new grey (a colour transition); when that fade
    // ends, the corner icons take the grey again.
    base.listen(doc, 'transitionend', event => { if (split.id && event.propertyName === 'color' && event.target.closest?.('#head')) layout(doc); }, true);
    base.watch(watch);
    base.onStop(() => split.id ? end(doc, { takeOut: true }) : undefined);   // the plugin stopping or reloading closes the split as its × would
    Door.root.onStop(() => base.stop());
  },
  stop: () => base.stop(),
  // For the checks: the state, and the ways in, as a press would call them.
  state: () => ({ ...split, before: split.before && { ...split.before, had: [...split.before.had], list: [...split.before.list] } }),
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
