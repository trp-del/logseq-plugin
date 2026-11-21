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
   that is on its way in or out, panel? → the name its panel is registered under in Logseq's sidebar, revive(item)? → fills a section of that panel which
   Logseq drew before the module was there }) and gets back what takes it off. The name sideTabs is kept from the tabs, so the modules did not change their calls. */
(function () {
const Door = window.PluginDoor;
const { host } = Door;
const views = [];
const rowsHeard = new Set();   // who hears the row view go on or off
const st = { off: null, offClick: null, asked: new Map(), retry: 0, emptyTimer: 0, autoShut: false, rows: false, folded: false, width: 0, shownParts: new Set(), wasOpen: false, openAt: 0, byHand: false, selfOpenAt: 0, moreOpen: false };   // rows: the row view is on; folded: Ontology was folded by the row view   // autoShut: the sidebar was closed for standing blank, not by you   // asked: when an automatic section was last asked to open, by key

const CSS = `
/* Logseq's words in the bar on top (Contents, Page graph, Help, the cube with a +) stay left out, as with the tabs: the ? at the
   window's bottom right opens Logseq's help. */
#right-sidebar[data-lk-stack] .cp__right-sidebar-settings > div:not([class*="lk-"]) { display: none !important; }
/* The page's own parts first, in their order; what you opened after them, as Logseq stacks it. */
#right-sidebar[data-lk-stack] .sidebar-item-list { display: flex; flex-direction: column; }
/* The first section sits just under the bar (the owner, 17 November 2026: "why is there a big gap on the top?"): Logseq's 24 px above
   the list, under its own 48 px bar, made a band of 72 px with nothing in it. */
#right-sidebar[data-lk-stack] .sidebar-item-list { padding-top: 8px !important; }
/* In the row view the row's head stands on the toolbar's middle line, its arrow and its words level with the toolbar's buttons, each
   head of the view 32 px high with what it holds on its middle line (the owner, 18 November 2026: "the top row with the fold control
   and total is misaligned": it stood at the window's top edge, 14 px above them, the count higher and smaller than the arrow). Every
   section's head is that height in the stack too (B of table-sidebar-look.html, 18 November 2026): Ontology's stood 20 px, the others 32. */
#right-sidebar[data-lk-rows] .sidebar-item-list { padding-top: 16px !important; }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item .sidebar-item-header { box-sizing: border-box; min-height: 32px; align-items: center !important; }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item .sidebar-item-header > button { align-self: stretch; }
/* The three dots and the × stand right after the item's name, not at the sidebar's far edge (the owner, 20 November 2026: "can the 3
   dots and x be next to name of item on sidebar instead of right aligned"): Logseq gives the name's button the whole width and
   pushes the two to the right end; here the button is as wide as its name, a long name still giving way to them. */
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item .sidebar-item-header { justify-content: flex-start !important; }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item .sidebar-item-header > button:first-child { width: auto !important; flex: 0 1 auto; min-width: 0; }
#right-sidebar[data-lk-stack] .sidebar-item-list > .sidebar-item .sidebar-item-header > .item-actions { flex: none; }
/* Logseq's bar on top of the sidebar holds nothing here (its words are left out, below), so it goes, and the first section's head
   stands level with the toolbar (the owner, 17 November 2026: "there is still a massive gap above"). Two pages side by side keep it
   (split.js draws the right page's title there). */
#right-sidebar[data-lk-stack]:not([data-lk-split]) .cp__right-sidebar-topbar { display: none !important; }
/* Logseq sizes the list to the window less its bar (100vh - 48 px); with the bar gone the list stood 48 px short of the window's
   foot, a blank band there, and what scrolled was cut at that line (the owner, 18 November 2026: an empty chunk at the bottom of
   the sidebar, a task's page name cut off). The list reaches the window's foot (its 8 px pulled up under the toolbar's line). */
#right-sidebar[data-lk-stack]:not([data-lk-split]) .sidebar-item-list { height: calc(100vh + 8px) !important; }
/* Past the last section, room enough to scroll it clear of the ? at the window's corner, not Logseq's 150 px of blank. */
#right-sidebar[data-lk-stack]:not([data-lk-split]) .sidebar-item-list { padding-bottom: 56px !important; }
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
   "ontology part is folded. main focus is the row item"). The row pressed is the first section, and every other section stays in
   the stack, folded to its head (the owner, 19 November 2026, picking A of bullets-sidebar-rowview.html: before, they were hidden
   and nothing said they were there). The heads stand at the sidebar's foot and the row takes the room above them, scrolling in it
   when it is taller, so arrowing from a short row to a tall one moves no head ("won't the folded come up and down depending on
   height of row item view"). At most four heads: the page's own parts first, then the rest in Logseq's order; past four, a line
   "and 2 more" shows them all. */
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-lk-over] { display: none !important; }
/* Only the row and the heads the plugin has placed show: a section Logseq adds or a row's view going out is unseen until a pass places
   it, so no head stands for a frame where it does not belong (the view-change check, frame by frame). */
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item:not([data-st-item]):not([data-lk-foot]) { display: none !important; }
#right-sidebar[data-lk-rows] .sidebar-item-list { min-height: 100%; box-sizing: border-box; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-st-item] { order: 0 !important; flex: 1 1 0 !important; min-height: 40%; }   /* a head you open takes room from the row, down to 40% of the sidebar; past that the sidebar scrolls */
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-st-item] > div { min-height: 0; max-height: 100%; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-st-item] .sidebar-panel-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-lk-foot-first] { margin-top: auto !important; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .lk-side-more { order: 30; align-self: flex-start; margin: 4px 0 0 30px; font-size: var(--lk-small); }
#right-sidebar:not([data-lk-rows]) .sidebar-item-list > .lk-side-more { display: none; }
/* In the row view the room around the sections never changes: the row has none above it, each head its hairline, so the row coming,
   going or changing moves nothing (the owner, 18 November 2026: "things jump"). */
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-st-item] { border-top: 0 !important; margin-top: 0 !important; padding-top: 0 !important; }
#right-sidebar[data-lk-rows] .sidebar-item-list > .sidebar-item[data-lk-foot] { border-top: 1px solid var(--lk-line) !important; padding-top: 6px !important; }
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

const FOOT_MAX = 4;
function footOf(doc, partItems, parts) {
  const list = doc.querySelector('#right-sidebar .sidebar-item-list');
  if (!list) return;
  const items = [...list.querySelectorAll(':scope > .sidebar-item')];
  const owned = item => !item.hasAttribute('data-st-item') && views.some(v => v.owns?.(item));   // a row's view on its way in or out
  const standing = item => !owned(item) && !item.hasAttribute('data-st-item') && partItems.get(item)?.key !== 'item' && !item.hasAttribute('data-lk-aside') && !item.hasAttribute('data-lk-contents') && !item.hasAttribute('data-lk-wait') && !item.hasAttribute('data-lk-closed');
  const rank = item => partItems.has(item) ? parts.indexOf(partItems.get(item)) : parts.length + items.indexOf(item);
  const foot = st.rows ? items.filter(standing).sort((a, b) => rank(a) - rank(b)) : [];
  const cut = st.moreOpen || foot.length <= FOOT_MAX ? FOOT_MAX * 99 : FOOT_MAX - 1;   // the line "and 2 more" takes the fourth place
  for (const item of items) {
    const at = foot.indexOf(item);
    toggle(item, 'data-lk-foot', at >= 0);
    toggle(item, 'data-lk-foot-first', at === 0);
    toggle(item, 'data-lk-over', at >= cut || (st.rows && owned(item)));   // a row's view going or coming is never a head for a frame
  }
  // The order seen is the order counted: parts by their part order, the rest after them as Logseq keeps them.
  for (const item of foot) if (!partItems.has(item)) { const o = String(20 + foot.indexOf(item)); if (item.style.order !== o) item.style.order = o; }
  for (const item of items) if (!foot.includes(item) && !partItems.has(item) && item.style.order) item.style.order = '';
  let more = list.querySelector(':scope > .lk-side-more');
  const over = foot.length - Math.min(foot.length, cut);
  if (st.rows && over > 0) {
    if (!more) {
      more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-more lk-side-more';
      more.addEventListener('click', () => { st.moreOpen = true; draw(); });
      list.appendChild(more);
    }
    if (more.textContent !== `and ${over} more`) more.textContent = `and ${over} more`;
  } else more?.remove();
  /* The row's own section is never folded by the view: a section that was folded as the view came on and then became the row
     (a page already in the sidebar, pressed in the table) opens again. */
  /* What the view folded carries data-lk-rows-folded on Logseq's own element, kept through a reload of the plugin, so a section folded
     by a row view that a reload ended opens again too. */
  for (const item of items) if (item.hasAttribute('data-lk-rows-folded') && (item.hasAttribute('data-st-item') || !st.rows)) {
    item.removeAttribute('data-lk-rows-folded');
    const fold = item.querySelector('.sidebar-item-header > button[aria-expanded="false"]'); if (fold) Door.screen.click(fold);
  }
  // Folded once, as the view comes on (and Ontology when it comes a moment later).
  if (st.rows && st.foldDue) {
    for (const item of foot) {
      if (st.foldSeen.has(item) || !(st.foldFrom.has(item) || partItems.has(item))) continue;   // only what stood there as the view came on, and the page's own parts: a row's view on its way out is never folded (folding it kept the plugin from closing it)
      st.foldSeen.add(item);
      const fold = item.querySelector('.sidebar-item-header > button[aria-expanded="true"]');
      if (fold) { item.setAttribute('data-lk-rows-folded', ''); Door.screen.click(fold); }
    }
  }
}
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
  named(doc);
  toggle(side, 'data-lk-rows', st.rows);
  // The open width, taken only once it holds still for a pass, so a width on the way open or shut never sets it.
  const w = Math.round(side.getBoundingClientRect().width);
  if (w > 240 && w === st.width && side.style.getPropertyValue('--lk-side-w') !== w - 16 + 'px') side.style.setProperty('--lk-side-w', w - 16 + 'px');
  st.width = w;
  // The Row view button reads as pressed while the row view is on.
  for (const a of doc.querySelectorAll('.lk-tool[data-on-click="rowView"]')) if (a.getAttribute('aria-pressed') !== String(st.rows)) a.setAttribute('aria-pressed', String(st.rows));
  /* The row view's foot: every section but the row, folded to its head, at most four, parts first (see the stylesheet). Each section
     standing open as the view comes on is folded once by Logseq's own fold, so its head still opens it, and opened again as the view
     goes (rows(false)); a section you open or fold after that is yours (the owner, 18 November 2026: "how does ontology reveal
     itself?"). A section opened while the view is on stands as you opened it. */
  footOf(doc, partItems, parts);
  /* The first section seen: the first part shown, else the first item shown in Logseq's order. Marked before anything rolls out, so a
     section rolls out to the room it keeps: marked after, the first one rolled out to room for a hairline above it and then lost that
     room in a frame, a jump of 10 px (the owner, 18 November 2026: "things jump"). */
  const shown = item => !item.hasAttribute('data-lk-aside') && !item.hasAttribute('data-lk-contents') && !item.hasAttribute('data-lk-wait') && !item.hasAttribute('data-lk-closed') && !(st.rows && item.hasAttribute('data-lk-over'));
  const all = [...doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')];
  const first = [...partItems.keys()].filter(shown).sort((a, b) => parts.indexOf(partItems.get(a)) - parts.indexOf(partItems.get(b)))[0] || all.find(item => !partItems.has(item) && shown(item));
  /* A section that stops being the first, because another came above it, takes its room for the hairline over the same moment the
     new one rolls out, not in one frame: Todo stood 10 px lower at once when Outline came above it (the release check, 19 November 2026). */
  const was = all.find(item => item.hasAttribute('data-lk-first'));
  for (const item of all) toggle(item, 'data-lk-first', item === first);
  if (was && first && was !== first && shown(was) && !Door.still(was)) {
    const { ms, ease } = Door.MOTION.roll;
    was.animate([{ marginTop: '0px', paddingTop: '0px', borderTopColor: 'transparent' }, {}], { duration: ms, easing: ease });
  }
  // A part of the page that comes into view rolls out of where it stands, as every section that opens (the grammar).
  // Not while the sidebar itself slides open: that is motion enough.
  const nowOpen = sidebarOpen();
  if (nowOpen && !st.wasOpen) { st.openAt = Date.now(); st.byHand = Date.now() - st.selfOpenAt > 1500 && !opened(doc); }   // opened empty, not by the plugin and not with a page in it: the button or its keys
  if (!nowOpen) st.byHand = false;
  st.wasOpen = nowOpen;
  /* Known by the part, not by its element: Logseq hands a row's view a new element on every row, and the row's view changing is a
     fade of its own (inspector.js), never a roll. */
  for (const view of parts) {
    const item = view.find(doc);
    const seen = nowOpen && !!item && !item.hasAttribute('data-lk-aside') && !!item.getClientRects().length;
    if (seen && !st.shownParts.has(view.key)) { st.shownParts.add(view.key); if (Date.now() - st.openAt > 450) Door.unroll(item); }   // in the same pass, before it is painted whole
    else if (!seen && !(view.key === 'item' && view.owns && st.shownParts.has('item') && views.some(v => v.key === 'item' && !v.hidden?.(doc)))) st.shownParts.delete(view.key);
  }
  /* The sidebar never stands open and blank by itself (the owner, 17 November 2026: "the sidebar also shouldn't have a blank or be open to
     that"): open with nothing to show, and no part of the page on its way, it closes after a moment. Opened by a person (the sidebar
     button, its keys), it opens and stays open, as Logseq's does: closed again at once it was a flash (the owner, 20 November 2026,
     asked what the button should do on a page with nothing to show: "Open and stay open"). Closed that way, it opens again
     by itself on the next page where a part of the page applies (from Dr. Mei Chen back to Doctor, Ontology is back). Closed by you,
     it stays closed. */
  const open = sidebarOpen();
  const due = parts.some(view => view.key !== 'item' && !view.hidden?.(doc));
  if (open) st.autoShut = false;
  else if (st.autoShut && due) { st.autoShut = false; openSide(); return; }
  const empty = open && !st.byHand && !coming && !all.some(shown) && !parts.some(view => !view.hidden?.(doc) && !view.find(doc));
  if (empty && !st.emptyTimer) st.emptyTimer = doc.defaultView.setTimeout(() => {
    st.emptyTimer = 0;
    const d = host(), side = d.getElementById('right-sidebar');
    if (!sidebarOpen() || st.byHand || side?.hasAttribute('data-lk-split')) return;
    const still = ![...d.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].some(shown) && !views.filter(v => v.auto).some(v => !v.hidden?.(d) && !v.find(d));
    if (still) { logseq.App.setRightSidebarVisible(false); st.autoShut = true; }
  }, 700);
}

/* A section of the plugin's that Logseq drew before the plugin was there to fill it (Logseq starting with Todo in its sidebar,
   the plugin started after it): Logseq heads it with the panel's machine name, ":logseq-plugin/_sidebar.todo-side", and leaves it
   empty, and does not draw it again once the plugin is there (the owner, 18 November 2026, a journal day beside such a Todo). So
   the head takes the section's word, and a section with nothing in it is handed to its module to fill (revive(item)). */
// The plugin opening the sidebar itself (a section asked for, the row view, a part of the page coming back): told apart from a
// person opening it with the sidebar button or its keys, which keeps it open (byHand).
function openSide() { st.selfOpenAt = Date.now(); logseq.App.setRightSidebarVisible(true); }
function named(doc) {
  const id = logseq.baseInfo?.id || 'logseq-plugin';
  for (const view of views) {
    if (!view.panel) continue;
    const raw = `:${id}/_sidebar.${view.panel}`;
    for (const item of doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')) {
      const head = item.querySelector('.sidebar-item-header');
      if (!head || !(head.textContent || '').includes(raw)) continue;
      for (const n of head.querySelectorAll('*')) if (!n.children.length && n.textContent.trim() === raw) n.textContent = view.word;
      if (!item.querySelector('.lsp-host-renderer-container > *')) view.revive?.(item);
    }
  }
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

/* The open width the words keep while the sidebar slides is taken again at once when the window or the sidebar is made wider or
   narrower by hand (a window 900 px wide kept the width of one 1582 px wide, and Ontology's panel stood 245 px past the window's
   edge: the 0.4 audit, 17 November 2026). Not while it slides open or shut. */
function followWidth() {
  const side = host().getElementById('right-sidebar');
  if (!side?.hasAttribute('data-lk-stack')) return;
  const open = sidebarOpen();
  if (open !== st.rzOpen) { st.rzOpen = open; st.rzAt = Date.now(); }
  if (!open) return;
  if (Date.now() - st.rzAt < 700) { if (!st.rzTimer) st.rzTimer = host().defaultView.setTimeout(() => { st.rzTimer = 0; followWidth(); }, 750); return; }   // once it has stopped sliding, asked once
  const w = Math.round(side.getBoundingClientRect().width);
  if (w > 240 && side.style.getPropertyValue('--lk-side-w') !== w - 16 + 'px') { side.style.setProperty('--lk-side-w', w - 16 + 'px'); st.width = w; }
}
function start() {
  if (st.off) return;
  Door.root.style('sidebar-tabs', CSS);
  st.off = Door.root.watch(draw);
  st.rzOpen = sidebarOpen(); st.rzAt = 0;   // as it stands at the start, so the first resize is followed
  const offs = [Door.root.listen(host(), 'click', onClose, true), Door.root.listen(host().defaultView, 'resize', followWidth), Door.root.listen(host(), 'pointerup', () => host().defaultView.requestAnimationFrame(followWidth), true)];
  /* Whatever changes the sidebar's width (two pages side by side closing, a theme, Logseq itself), the width the words keep follows
     it once it holds still: Todo stood wider than the sidebar after two side-by-side pages closed, its ×, "By day" and days cut off
     (the release checks, 18 November 2026), since only a resize of the window or a drag of the edge was followed. */
  const Observer = host().defaultView.ResizeObserver, side = host().getElementById('right-sidebar');
  if (Observer && side) { const ro = new Observer(() => followWidth()); ro.observe(side); offs.push(() => ro.disconnect()); }
  st.offClick = () => { for (const off of offs) off?.(); };
}
function stop() {
  st.off?.(); st.off = null; st.offClick?.(); st.offClick = null; if (st.rzTimer) { host().defaultView.clearTimeout(st.rzTimer); st.rzTimer = 0; }
  Door.root.style('sidebar-tabs', '');
  const doc = host();
  doc.getElementById('right-sidebar')?.removeAttribute('data-lk-stack');
  doc.getElementById('right-sidebar')?.removeAttribute('data-lk-rows'); doc.getElementById('right-sidebar')?.style.removeProperty('--lk-side-w');
  for (const n of doc.querySelectorAll('#right-sidebar :is([data-lk-part], [data-lk-aside], [data-lk-contents], [data-lk-wait], [data-lk-first], [data-lk-row], [data-lk-foot], [data-lk-over])')) {
    for (const a of ['data-lk-part', 'data-lk-aside', 'data-lk-contents', 'data-lk-wait', 'data-lk-first', 'data-lk-row', 'data-lk-foot', 'data-lk-foot-first', 'data-lk-over']) n.removeAttribute(a);
    n.style.removeProperty('--lk-part-order'); n.style.removeProperty('order');
  }
  doc.querySelector('#right-sidebar .lk-side-more')?.remove();
}
Door.sideTabs = {
  add(view) {
    const i = views.findIndex(v => v.key === view.key); if (i >= 0) views.splice(i, 1);
    views.push(view); start(); draw();
    return () => { const at = views.indexOf(view); if (at >= 0) views.splice(at, 1); if (!views.length) stop(); else draw(); };
  },
  // A section asked for from elsewhere (the ··· menu, the command palette, a toolbar button): opened, and the sidebar with it.
  // A part of the page is only shown with the sidebar; it opens by itself where it applies.
  show(key) { const view = views.find(v => v.key === key); if (view && !view.auto && !view.find(host()) && !held(view)) view.open(); openSide(); draw(); },
  /* The row view, on or off (the toolbar's Row view button). On: the sidebar opens, showing the row pressed and Ontology folded. Off:
     Ontology unfolded again if the row view folded it, and the stack as it was; the module that draws the row lets it go (onRows). */
  rows(on) {
    if (on === undefined) return st.rows;
    st.rows = !!on;
    const doc = host();
    if (st.rows) { st.foldDue = true; st.foldSeen = new WeakSet(); st.foldFrom = new WeakSet(doc.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')); st.moreOpen = false; doc.defaultView.setTimeout(() => { st.foldDue = false; }, 2500); }   // what stands open as the view comes on, or a moment after (Ontology), is folded once
    else {
      st.foldDue = false; st.moreOpen = false;
    }
    for (const fn of rowsHeard) { try { fn(st.rows); } catch (error) { console.error('logseq-plugin: the row view could not be followed', error); } }
    if (st.rows) openSide();
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
