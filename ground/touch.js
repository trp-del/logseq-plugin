/* GROUND: the one fenced place where the plugin touches Logseq's own screen. Every name of Logseq's markup, every call that is
   not in its plugin API, and every piece of Logseq lent to the plugin stands here and nowhere else, so a Logseq update is
   checked against this one file. Seen in Logseq 2.0.2.
     touch.watch(fn)          fn runs once a frame after Logseq's page changed; gives back what stops it
     touch.changed(fn, atOnce) fn runs a moment after the graph changed (atOnce: at every change, so it must be light); gives
                              back what stops it
     touch.writing()          the text box of the bullet being written in, or null
     touch.edit(uuid)         the caret put into a node's words
     touch.digs(fn)           fn(editor, uuid) -> true takes a plain press on the arrow before a value that is a node
     touch.seat(editor, uuid) where a node dug into stands under its value's row: { top, left, row, mark } or null
     touch.pages()            Logseq's own pages on screen, each { el, uuid, feed }: the main page, a page in the sidebar,
                              a day in the journals feed (feed: true)
     touch.pageFoot(el, name) where, in one of those pages, something of the plugin's may stand under the page's bullets
     touch.pageHead(el, name) and where something may stand right under the page's title
     touch.editor             Logseq's own editor for a node, placed in an element of the plugin's:
                              start(), can(), show(el, uuid) -> what takes it out again
     touch.open(uuid, side)   go to a node's page, or open it in the sidebar
     touch.openUrl(url)       a web address, in the browser
     touch.busy()             whether one of Logseq's own menus, lists or windows is open
     touch.left(fn)           fn(uuid) runs a moment after a bullet whose words changed stops being written in; gives back what
                              stops it. Only looks on: nothing of Logseq's editor is touched while it is written in
     touch.tagList(say)       words after each tag's name in Logseq's own list of tags (the one on "#"): say(name) -> words
     touch.key(combo, fn)     a key taken before Logseq sees it ('mod+k', 'mod+.'), matched by its place on the keyboard; gives
                              back what lets it go. fn answers false to leave the press to Logseq after all
     touch.glide              focusing into a bullet and out, in the main view (beside/glide.js decides, this draws):
                              moves(leaving, arrived) hears each change of view, before and after; view() what the view shows
                              now; replaced(view) whether another stands; play(view, uuid, out) the motion; soon(fn) calls fn at
                              each change of the screen until stopped; wayOut(press) the arrow after the line of steps;
                              route(), address(), has(uuid), top(uuid), focused(), into(uuid), stepUp(), parent(uuid), go(uuid), back(address),
                              and the embed and selection pieces
     touch.command(key, label, run)   a line in Logseq's command palette; touch.commands() the ones made, { name, label, run };
                              touch.logseqCommands() Logseq's own, { id, label, key, run }; each key is the one in force
                              once touch.keysRead() has read the graph's config
     touch.keepPlace()        where the keys are now; gives back what returns them there
     touch.plugins           the plugins Logseq runs: those from a folder (reloaded) and those from its marketplace (updated
                              by Logseq's own updater)
     touch.section(key, title, draw, path)  a section of Logseq's right sidebar that is the plugin's own: Logseq hosts it and
                              hands draw(el) the element (draw gives back what clears it); path: its icon's line.
                              Answers { open(), off() }
     touch.page(key, title, draw)  a page of the plugin's own in Logseq's main view; draw(el) fills it. Answers { open(), at() }
     touch.toolbar(key, title, path, run)   a button in Logseq's toolbar, drawn as Logseq draws its own (path: the icon's line)
     touch.icon(id), touch.statusIcon(icon)   one of Logseq's own icons as markup
     touch.foldedSpots()      Logseq's folded bullets on screen, each { uuid, at, put(el) }: at, what the plugin put after its
                              words before; put(el) places el right after its words. touch.FOLDED the stylesheet that shows
                              it only while the bullet is folded
     touch.beside             Logseq's right sidebar shown as the right half of two pages (beside/split.js):
                              presses(fn) fn(to, 'beside' | 'sidebar', click) on a Cmd- or Shift-press on a link in the main
                              view ('beside' answering true takes the press); list(), isOpen(), setOpen(on), put(uuid) the
                              sidebar's list and what changes it; mark(id, head) draws the node as the right half, unmark()
                              takes that off; shown(id) whether it is really on screen; body(id) what it holds; takeOut(id),
                              reorder(ids); openProps(); until(fn, ms), mainLeft(), mainSized(fn), headIcons(), mainPage()
     touch.SPLIT              the stylesheet for the sidebar as the right half
     touch.menuItem(label, run)       an item in a bullet's right-click menu and in a page's: run({ uuid }) or run({ page })
     touch.keep(settings)     settings of the plugin's own, kept by Logseq
     touch.copy(text)         words put on the clipboard; answers whether they are there
     touch.save(name, text, folder)   a file written where the person picks, in Logseq's folder window (opened at folder); a file
                              of that name is left alone and the next number taken. Answers { path, folder }, or null
     touch.print(html)        a page of the plugin's own handed to the Mac's print window; settles when that closes
     touch.settled(doc)       settles once a page's pictures have loaded
     touch.pictures(files)    files of the graph's assets folder as a page can load them: a function file -> address
     touch.queryShown(uuid)   a query's table as it is drawn on screen: { columns, order } or null
     touch.dragBand()         how tall the band at the window's top is that moves the window, where no press reaches the page
     touch.graphChanged(fn)   fn runs when another graph is opened; gives back what stops it
     touch.HIDES              the stylesheet that takes away Logseq's own lists where the plugin's stand */
(function () {
const G = window.PluginDoor;
const host = () => G.host();
const PAGE = '.cp__page-inner-wrap', PAGE_NODE = '.ls-page-title .ls-block[blockid]', FIRST_NODE = '.ls-page-blocks .ls-block[blockid]', FEED = '.journal-item';
const OURS = '.lk-open, .lk-rel, .lk-ghost';   // what is the plugin's own on Logseq's screen, never read as a page of Logseq's

// One watcher of Logseq's page for every part: passes run once a frame, whatever changed and however often.
const passes = new Set(); let observer = null, queued = false;
function run() { queued = false; for (const fn of [...passes]) { try { fn(); } catch (error) { console.error('Logseq Plugin: a pass over the page failed', error); } } }
function watch(fn) {
  passes.add(fn);
  if (!observer) { observer = new (host().defaultView.MutationObserver)(() => { if (!queued) { queued = true; host().defaultView.requestAnimationFrame(run); } }); observer.observe(host().body, { childList: true, subtree: true }); observer.observe(host().documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color'] }); }
  host().defaultView.requestAnimationFrame(() => { if (passes.has(fn)) fn(); });
  return () => { passes.delete(fn); if (!passes.size && observer) { observer.disconnect(); observer = null; } };
}

// The graph changed: said once, a moment after the last change of a burst (typing saves every few letters).
const heard = new Set(), heardAtOnce = new Set(); let offChanged = null, timer = 0;
function changed(fn, atOnce = false) {
  (atOnce ? heardAtOnce : heard).add(fn);
  const tell = (all) => { for (const one of [...all]) { try { one(); } catch (error) { console.error('Logseq Plugin: a part could not follow a change', error); } } };
  if (!offChanged) offChanged = logseq.DB.onChanged(() => { tell(heardAtOnce); clearTimeout(timer); timer = setTimeout(() => { G.read.forget(); tell(heard); }, 500); });
  return () => { heard.delete(fn); heardAtOnce.delete(fn); if (!heard.size && !heardAtOnce.size && typeof offChanged === 'function') { offChanged(); offChanged = null; clearTimeout(timer); } };
}
/* Digging, where it meets Logseq's screen. Inside an opened node a value that is a node carries a small arrow before its name
   (drawn by the stylesheet, so nothing is added to Logseq's rows). A plain press on the arrow is the plugin's: fn(editor, uuid)
   answers true when the place takes it. A press on the name itself, and any press with Shift, Cmd, Ctrl or Option, stays
   Logseq's own and goes to that page. Gives back what stops it. */
const ROW = '.bottom-property-pill, .property-pair', VALUE = '.property-value-inner[data-type="node"] a.page-ref[data-uuid]';
function digs(fn) {
  const doc = host(), types = ['pointerdown', 'mousedown', 'click'];
  const on = event => {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    const link = event.target.closest?.(VALUE), editor = link?.closest('.lk-editor');
    if (!link || !editor || !link.closest(ROW) || event.clientX - link.getBoundingClientRect().left > 18) return;   // only the arrow
    if (event.type === 'click' && !fn(editor, String(link.getAttribute('data-uuid')).toLowerCase())) return;
    event.preventDefault(); event.stopPropagation();
  };
  for (const type of types) doc.addEventListener(type, on, true);
  return () => { for (const type of types) doc.removeEventListener(type, on, true); };
}
/* Where a node dug into stands: under the row of the value it was reached through. Answers null when the value has no row in
   this editor, else { top, left } (from the editor's own corner: the row's foot, the value's left edge) and two selectors for
   the style rule that opens the room: row (that row) and mark (the value's own link, whose arrow turns). */
function seat(editor, uuid) {
  const link = [...editor.querySelectorAll(VALUE)].find(one => String(one.getAttribute('data-uuid')).toLowerCase() === uuid && one.closest(ROW) && one.closest('.lk-editor') === editor);
  const row = link?.closest(ROW);
  if (!row) return null;
  const box = link.closest('.property-value-container') || link, at = editor.getBoundingClientRect(), r = row.getBoundingClientRect(), v = box.getBoundingClientRect();
  const inset = parseFloat(editor.ownerDocument.defaultView.getComputedStyle(box).paddingLeft) || 0;   // where the value's words start: past the values' own step in a narrow node
  const kind = row.classList.contains('property-pair') ? '.property-pair' : '.bottom-property-pill', n = [...row.parentElement.children].indexOf(row) + 1;
  /* Under the value pressed, not the first of the row's values (the owner's marked page, 26 November 2026: "You opened low blood
     oxygen, but its details start under cough"), while that leaves the node room to be read; else under the first. */
  const own = (link.closest('.property-value-inner') || link).getBoundingClientRect(), mine = own.left > v.left + 1 && at.right - own.left >= 240;
  return { top: r.bottom - at.top, left: (mine ? own.left : v.left + inset) - at.left, row: `${kind}:nth-child(${n}):has(a.page-ref[data-uuid="${uuid}"])`, mark: `:is(${ROW}) a.page-ref[data-uuid="${uuid}"]` };
}
// How wide the longest property name of an opened node is drawn, so its holder can set the names' column to it.
function names(editor) {
  const range = editor.ownerDocument.createRange();
  let wide = 0;
  for (const key of editor.querySelectorAll(':is(.bottom-property-pill, .property-pair) .property-k')) {
    if (key.closest('.lk-editor') !== editor || !key.offsetParent) continue;
    range.selectNodeContents(key); wide = Math.max(wide, range.getBoundingClientRect().width);
  }
  return Math.ceil(wide);
}
// The caret put into a node's words, wherever Logseq shows the node.
const edit = uuid => logseq.Editor.editBlock(String(uuid));
// The text box of the bullet being written in, or null.
const writing = () => { const el = host().activeElement; return el?.tagName === 'TEXTAREA' && el.closest('.ls-block[blockid]') ? el : null; };

/* A page in Logseq's right sidebar. Logseq draws it with no title of its own (its name stands in the section's head), so which
   page a section shows is read from Logseq's own list of what the sidebar holds, in the sections' order. Answers the page's
   uuid, '' while it is being read (the pass over the screen runs again once it is), or null for what is no sidebar page. */
const SIDE_PAGE = '#right-sidebar .sidebar-item.item-type-page';
const sideUuids = new Map();   // a page's id in the graph -> its uuid, once read
function sidePage(el) {
  const item = el.closest(SIDE_PAGE);
  if (!item) return null;
  let held = [];
  try { held = (host().defaultView.logseq.api.get_state_from_store('sidebar/blocks') || []).filter(one => one?.[2] === 'page'); } catch (error) { held = []; }
  const id = held[[...host().querySelectorAll(SIDE_PAGE)].indexOf(item)]?.[1];
  if (id == null) return '';
  if (!sideUuids.has(id)) {
    sideUuids.set(id, '');
    Promise.resolve(logseq.Editor.getPage(id)).then(page => { if (page?.uuid) { sideUuids.set(id, String(page.uuid).toLowerCase()); run(); } else sideUuids.delete(id); }).catch(() => sideUuids.delete(id));
  }
  return sideUuids.get(id);
}
function pages() {
  const out = [];
  for (const el of host().querySelectorAll(PAGE)) {
    if (el.closest(OURS)) continue;
    const side = sidePage(el);
    const uuid = side != null ? side : (el.querySelector(PAGE_NODE) || (el.querySelector('.ls-page-title') ? null : el.querySelector(FIRST_NODE)))?.getAttribute('blockid');
    if (uuid) out.push({ el, uuid: uuid.toLowerCase(), feed: !!el.closest(FEED), side: !!el.closest('#right-sidebar') });
  }
  return out;
}
// The first of a page's own: a node opened in one of its lists is a whole page of Logseq's inside it, with a title and
// properties of its own, which are not this page's.
const own = (el, selector) => [...el.querySelectorAll(selector)].find(one => !one.closest('.lk-open')) || null;
// Logseq draws a page as two boxes: the page itself, then its references. The plugin's own stands between them, a child of the
// page's box that Logseq does not draw and so does not take away while the page stays.
function pageFoot(el, name) {
  let foot = [...el.children].find(child => child.classList.contains(name));
  if (!foot) { foot = host().createElement('div'); foot.className = name; const first = el.firstElementChild; if (first) first.after(foot); else el.appendChild(foot); }
  return foot;
}

// Under the title and the page's properties, above the page's own bullets: the last thing inside the title's block. null where
// the page has no title of its own (a bullet shown as a page).
function pageUnder(el, name) {
  // A page in the sidebar has no title block: there it is the box that holds the page's properties, above its bullets.
  const block = own(el, ':scope > .page-inner .ls-page-title .ls-block') || (el.closest(SIDE_PAGE) ? own(el, ':scope > .page-inner .ls-sidebar-page-properties')?.parentElement : null);
  if (!block) return null;
  let under = [...block.children].find(child => child.classList.contains(name));
  if (!under) { under = host().createElement('div'); under.className = name; block.appendChild(under); }
  return under;
}
// Under the title's own row and above the page's properties, inside the title's block.
function pageHead(el, name, above = false) {
  const row = own(el, ':scope > .page-inner .ls-page-title .ls-block > .is-page-title-row');
  if (!row) {
    // A page in the sidebar: its name is in the section's head, so what stands by a title stands first in the page, above its properties.
    const props = el.closest(SIDE_PAGE) ? own(el, ':scope > .page-inner .ls-sidebar-page-properties') : null;
    if (!props) return null;
    let line = [...props.parentElement.children].find(child => child.classList.contains(name));
    if (!line) { line = host().createElement('div'); line.className = name; if (above) props.parentElement.prepend(line); else props.before(line); }
    return line;
  }
  let head = [...row.parentElement.children].find(child => child.classList.contains(name));
  if (!head) { head = host().createElement('div'); head.className = name; if (above) row.before(head); else row.after(head); }
  return head;
}
// A column of the tables on a page left out by its name (a tag's own table says the tag on every row): the table is marked
// with the column's place, and the sheet (CALM.table) hides that place in the head and in every row as it comes.
function lessColumn(el, title) {
  for (const table of el.querySelectorAll('.ls-table')) {
    const cells = [...(table.querySelector('.ls-table-header > .flex-row:not(.sticky-columns)')?.children || [])];
    const at = title ? cells.findIndex(cell => cell.textContent.trim() === title) + 1 : 0;
    if ((table.dataset.lkLess || '0') !== String(at)) { if (at) table.dataset.lkLess = String(at); else delete table.dataset.lkLess; }
  }
}
// The nodes an opened node's values name; and the sheet that says, after each of them, what that node is.
const valued = editor => [...new Set([...editor.querySelectorAll(VALUE)].filter(a => a.closest('.lk-editor') === editor).map(a => a.dataset.uuid.toLowerCase()))];
const valueTags = said => [...said].map(([uuid, tag]) => `.lk-editor ${VALUE.replace('[data-uuid]', `[data-uuid="${uuid}" i]`)}::after { content: "${String(tag).replace(/[\\"\n]/g, ' ')}"; display: inline-block; margin-left: .5em; font-family: var(--lk-tag-face); font-size: var(--lk-tag-size); color: var(--lk-quiet); }`).join('\n');

/* Logseq lends its editor (Experiments.Components.Editor: any node by its uuid) only inside a tree it hosts itself. One piece
   is kept there (registerDaemonRenderer) and puts an editor into each element asked for (createPortal). Logseq shows a piece
   added to its tree only when it next draws its window anew, so the window's address is marked and unmarked once after the
   start: drawn anew in place, no page change, no step added to Back, and never while a bullet is being written. */
const editor = (() => {
  const spots = new Map(); let bump = null, off = null, count = 0;
  const kit = () => { try { const E = logseq.Experiments; return E?.Components?.Editor && E.React && E.ReactDOM?.createPortal ? E : null; } catch (error) { return null; } };
  function ensure() {
    if (off || !kit()) return;
    const { React, ReactDOM, Components } = kit();
    const Host = () => {
      const [, set] = React.useState(0);
      React.useEffect(() => { bump = () => set(n => n + 1); return () => { bump = null; }; }, []);
      for (const el of [...spots.keys()]) if (!el.isConnected) spots.delete(el);
      return React.createElement(React.Fragment, null, ...[...spots].map(([el, spot]) => ReactDOM.createPortal(React.createElement(Components.Editor, { page: spot.uuid }), el, spot.key)));
    };
    off = logseq.Experiments.registerDaemonRenderer('lk-node-editor', { render: () => React.createElement(Host) }) || (() => {});
  }
  function start() {
    if (!kit()) return;
    ensure();
    let tries = 0;
    const mount = async () => {
      if (bump || ++tries > 20) return;
      let writing = false; try { writing = !!(await logseq.Editor.checkEditing()); } catch (error) { /* not known: go on */ }
      const win = host().defaultView;
      if (writing) { setTimeout(mount, 3000); return; }
      const base = win.location.href.split('#')[0], was = win.location.hash || '#/', marked = was + (was.includes('?') ? '&' : '?') + 'lk-editor=1';
      win.location.replace(base + marked);
      setTimeout(() => { if (win.location.hash === marked) win.location.replace(base + was); setTimeout(mount, 1500); }, 600);
    };
    setTimeout(mount, 1200);
  }
  return {
    start,
    can: () => !!kit() && !!bump,
    show(el, uuid) {
      if (!el || !kit() || !G.read.UUID.test(String(uuid || ''))) return () => {};
      spots.set(el, { uuid: String(uuid), key: `${uuid}:${++count}` });
      ensure(); bump?.();
      return () => { if (spots.delete(el)) bump?.(); };
    },
    // fn runs once, when Logseq has drawn the node into el and it has come to rest. Gives back what runs it now.
    whole(el, fn) {
      const view = el.ownerDocument.defaultView; let rest = 0, done = false;
      const now = () => { if (done) return; done = true; watcher.disconnect(); view.clearTimeout(rest); view.clearTimeout(cap); fn(); };
      const watcher = new view.MutationObserver(() => { view.clearTimeout(rest); if (el.querySelector('.ls-block')) rest = view.setTimeout(now, 70); });
      watcher.observe(el, { childList: true, subtree: true, characterData: true });
      const cap = view.setTimeout(now, 900);
      return now;
    },
    stop() { spots.clear(); try { bump?.(); if (typeof off === 'function') off(); } catch (error) { /* gone with the plugin */ } off = null; },
  };
})();

/* Where the keys are now, for what takes them for a while: gives back what returns them there. A bullet being written that
   Logseq has closed meanwhile is opened again, the caret where it was. */
function keepPlace() {
  const el = host().activeElement, block = el?.tagName === 'TEXTAREA' ? el.closest('.ls-block[blockid]') : null;
  const uuid = block?.getAttribute('blockid'), at = el?.selectionStart;
  return () => { if (el?.isConnected && el !== host().body) el.focus({ preventScroll: true }); else if (uuid) logseq.Editor.editBlock(uuid, { pos: at }); };
}
/* FOCUSING INTO A BULLET AND OUT, where it meets Logseq's screen (beside/glide.js decides which bullet moves, and when). Only
   the main view. Logseq swaps the whole view in one frame, and every way in and out goes through the app's history, so the view
   is read just before the history changes (pushState, and popstate for Back and Forward, both while the old view is still
   drawn) and the motion is played once the new view stands. Nothing is written to the graph. */
const glide = (() => {
  const MOST = 600;   // a view with more blocks than this is not copied for the fade: only the bullet glides
  const ROW = ':scope > .block-main-container', STEPS = '.breadcrumb--block-page', STEP = ':scope > a:not(.lk-out)';
  const ASIDE = `.references, ${OURS}`;   // a bullet there is not the view's own
  const win = () => host().defaultView;
  const main = () => host().getElementById('main-content-container');
  const timing = () => G.look.MOTION.glide;
  const still = () => win().matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rowOf = block => block.querySelector(ROW);
  const inView = (rect, box) => rect.bottom > box.top && rect.top < box.bottom && rect.height > 0;
  const blocks = () => [...(main()?.querySelectorAll('.ls-block[blockid]') || [])].filter(block => !block.closest('.lk-ghost'));
  const blockIn = uuid => [...(main()?.querySelectorAll(`.ls-block[blockid="${uuid}"]`) || [])].find(block => !block.closest(ASIDE) && rowOf(block)) || null;
  // The line of steps above a focused bullet in the main view (never one inside a node opened in a list).
  const line = () => [...(main()?.querySelectorAll(STEPS) || [])].find(one => !one.closest(OURS)) || null;
  // What view stands: whether a bullet is focused, and the view's first bullet.
  const sign = () => `${!!line()}|${blocks().find(block => !block.closest(ASIDE) && rowOf(block))?.getAttribute('blockid') || ''}`;
  const route = () => /#\/page\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(win().location.hash)?.[1].toLowerCase() || null;

  // The view as it stands: where each block's row is on screen, and a still copy of the view for the fade.
  function view() {
    const scroller = main(), rows = new Map();
    if (!scroller) return null;
    const box = scroller.getBoundingClientRect(), all = blocks();
    for (const block of all) {
      const uuid = block.getAttribute('blockid'), row = rows.has(uuid) ? null : rowOf(block);
      if (!row) continue;
      const rect = row.getBoundingClientRect();
      if (inView(rect, box)) rows.set(uuid, { x: rect.left, y: rect.top });
    }
    let copy = null;
    const body = [...scroller.children].find(child => !child.classList.contains('lk-ghost'));
    if (all.length <= MOST && body) {
      copy = body.cloneNode(true);
      for (const node of copy.querySelectorAll('[id]')) node.removeAttribute('id');
      copy.removeAttribute('id');
      const at = body.getBoundingClientRect();   // the copy stands exactly where the view stood
      Object.assign(copy.style, { top: (at.top - box.top) + 'px', left: (at.left - box.left) + 'px', width: at.width + 'px', right: 'auto', margin: '0' });
    }
    return { sign: sign(), focused: !!line(), rows, copy, box: { width: box.width, height: box.height } };
  }
  // The old view, a copy laid over the new one, fading where it stood; the bullet that moves is left out of it.
  function fadeOld({ copy, box, rows }, uuid) {
    const scroller = main(), { ms, fade, away, awayStill, cap } = timing();
    if (!copy) return;
    const ghost = host().createElement('div');
    ghost.className = 'lk-ghost'; ghost.inert = true; ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: scroller.scrollLeft + 'px', top: scroller.scrollTop + 'px', width: box.width + 'px', height: box.height + 'px' });
    for (const block of copy.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) block.style.visibility = 'hidden';
    // The line of steps never fades (the owner, 12 November 2026: it flashed): it stands where it is and only its words change.
    for (const one of copy.querySelectorAll(STEPS)) one.style.visibility = 'hidden';
    ghost.append(copy);
    scroller.append(ghost);   // inside Logseq's view, so its rules for what stands in the view still hold for the copy
    for (const played of ghost.getAnimations({ subtree: true })) { try { played.finish(); } catch (error) { /* one that never ends */ } }   // Logseq's own fade-ins shown as they ended
    // Margins fold differently in a copy that stands on its own, so it is put right by one bullet it holds.
    for (const [id, at] of rows) {
      const row = copy.querySelector(`.ls-block[blockid="${id}"] > .block-main-container`); if (!row) continue;
      const now = row.getBoundingClientRect();
      copy.style.top = (parseFloat(copy.style.top) + at.y - now.top) + 'px'; copy.style.left = (parseFloat(copy.style.left) + at.x - now.left) + 'px';
      break;
    }
    const going = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms * (still() ? awayStill : away), easing: fade, fill: 'forwards' });
    going.onfinish = () => ghost.remove();
    win().setTimeout(() => ghost.remove(), cap);
  }
  /* The motion: the bullet glides from where it stood in the old view to where it stands now, its children with it, the old
     view fades where it stood and the rest of the new one fades in. Stepping out, a bullet that landed off screen is brought
     to the middle first. Where the Mac asks for less motion, only the old view fades. */
  function play(was, uuid, out) {
    const scroller = main(), block = blockIn(uuid), row = block && rowOf(block);
    if (!row) return;
    const box = scroller.getBoundingClientRect();
    // Only the main view is scrolled: scrollIntoView would also move Logseq's whole window.
    const at = row.getBoundingClientRect();
    if (out && !inView(at, box)) scroller.scrollTop += at.top + at.height / 2 - (box.top + box.height / 2);
    fadeOld(was, uuid);
    if (still()) return;
    const { ms, ease, fade, in: part, inDelay, outDelay, cap } = timing(), from = was.rows.get(uuid), to = row.getBoundingClientRect();
    if (from) {
      // Logseq's list of a page's bullets cuts off what stands outside it (overflow hidden), so a bullet gliding in from
      // above would be hidden for the first part of the way: the cut is lifted for the glide alone.
      const cut = [];
      for (let node = block.parentElement; node && node !== scroller; node = node.parentElement)
        if (win().getComputedStyle(node).overflow !== 'visible') { cut.push([node, node.style.overflow]); node.style.overflow = 'visible'; }
      const back = () => { for (const [node, had] of cut.splice(0)) node.style.overflow = had; };
      const moving = block.animate([{ transform: `translate(${from.x - to.left}px, ${from.y - to.top}px)` }, { transform: 'none' }], { id: 'lk-glide', duration: ms, easing: ease });
      moving.onfinish = moving.oncancel = back;
      win().setTimeout(back, cap);
    }
    const others = [...scroller.querySelectorAll('.block-main-container, .block-children-left-border, .ls-page-title, .page-title, .ls-page-properties')]
      .filter(node => !node.closest('.lk-ghost') && !block.contains(node) && !node.contains(block) && inView(node.getBoundingClientRect(), box));
    for (const node of others) node.animate([{ opacity: 0 }, { opacity: 1 }], { id: 'lk-glide-in', duration: ms * part, delay: ms * (out ? outDelay : inDelay), easing: fade, fill: 'backwards' });
  }
  // Each change of the view in the main window, said before it is drawn (leaving; pushed: a new step, not Back or Forward) and after.
  function moves(leaving, arrived) {
    const history = win().history, own = history.pushState; let on = true;
    const tell = (fn, arg) => { if (!on) return; try { fn(arg); } catch (error) { console.error('Logseq Plugin: the glide could not follow a change of view', error); } };
    const wrapped = function (...args) { tell(leaving, true); const done = own.apply(this, args); tell(arrived); return done; };
    const popped = () => { tell(leaving, false); tell(arrived); };
    history.pushState = wrapped;
    win().addEventListener('popstate', popped, true);
    return () => { on = false; if (history.pushState === wrapped) history.pushState = own; win().removeEventListener('popstate', popped, true); };
  }
  /* fn the moment Logseq puts something in (before it is first painted, so the new view never shows standing still), and once a
     frame in case that was missed, until what is given back is called. */
  function soon(fn) {
    const view = win(); let on = true;
    const watcher = new view.MutationObserver(() => { if (on) fn(); });
    watcher.observe(view.document.body, { childList: true, subtree: true });
    const frame = () => { if (!on) return; fn(); if (on) view.requestAnimationFrame(frame); };
    view.requestAnimationFrame(frame);
    return () => { on = false; watcher.disconnect(); };
  }
  // Logseq's step of the line goes on the press (its pointerdown and pointerup), not on a click alone.
  function press(el) {
    const view = win();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new (type.startsWith('pointer') ? view.PointerEvent : view.MouseEvent)(type, { bubbles: true, cancelable: true, view, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }));
  }
  // One level out by a press on the last step of the line; false when no line stands.
  function stepUp() {
    const last = [...(line()?.querySelectorAll(STEP) || [])].pop();
    if (last) press(last);
    return !!last;
  }
  // The way out: an up arrow after the last step of the line, kept there; press is what it does. null takes it away.
  function wayOut(act) {
    if (!act) { for (const one of host().querySelectorAll('.lk-out')) one.remove(); return; }
    const at = line(), last = [...(at?.querySelectorAll(STEP) || [])].pop();
    if (!last) return;
    const had = at.querySelector(':scope > .lk-out');
    if (had && had.previousElementSibling === last) return;
    had?.remove();
    const arrow = host().createElement('a');
    arrow.className = 'lk-out'; arrow.tabIndex = 0; arrow.title = 'Step out one level';
    arrow.setAttribute('role', 'button'); arrow.setAttribute('aria-label', 'Step out one level');
    arrow.innerHTML = icon('arrow-up', 14);
    const go = event => { event.preventDefault(); event.stopPropagation(); act(); };
    arrow.addEventListener('click', go);
    arrow.addEventListener('pointerdown', event => event.stopPropagation());
    arrow.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') go(event); });
    last.after(arrow);
  }
  /* Focused as a press on its dot focuses, Logseq's own way in, which also starts the new view at its top (a bare change of
     address would keep how far the page was scrolled). */
  function into(uuid) { const dot = rowOf(blockIn(uuid) || host().body)?.querySelector('.bullet-container'); if (dot) press(dot); }
  // Where a bullet's row stands now.
  const top = uuid => { const block = blockIn(uuid); return block ? Math.round(rowOf(block).getBoundingClientRect().top) : null; };
  // Whether a press fell on a bullet's dot; and the node of the embed a bullet stands in (the target given, else the one written in or selected).
  const onBullet = target => !!target?.closest?.('.bullet-container, .bullet');
  const embedOf = target => (target || host().activeElement?.closest?.('.ls-block') || host().querySelector('#main-content-container .ls-block.selected'))
    ?.closest?.('#main-content-container .embed-block[blockid]')?.getAttribute('blockid') || null;
  // What a node sits under: the bullet above it, or its page.
  async function parent(uuid) {
    const node = await logseq.Editor.getBlock(uuid);
    if (!node?.parent) return null;
    const up = node.parent.id === node.page?.id ? await logseq.Editor.getPage(node.page.id) : await logseq.Editor.getBlock(node.parent.id);
    return up?.uuid || null;
  }
  return {
    CSS: `
.lk-ghost { position: absolute; overflow: hidden; pointer-events: none; z-index: 9; }
.lk-ghost > * { position: absolute; }
.lk-ghost * { transition: none !important; }
${STEPS} > a.lk-out { display: inline-flex; align-items: center; margin-left: 4px; padding: 0; border-radius: var(--lk-corner); color: var(--lk-quiet) !important; cursor: pointer; text-decoration: none; }
${STEPS} > a.lk-out:hover, ${STEPS} > a.lk-out:focus-visible { color: var(--lk-text) !important; outline: none; }
${STEPS} > a.lk-out:focus-visible { background: var(--lk-wash); }`,
    route, view, play, moves, soon, stepUp, wayOut, into, top, onBullet, embedOf, parent, still,
    clear() { for (const one of host().querySelectorAll('.lk-ghost, .lk-out')) one.remove(); },
    address: () => win().location.hash,
    back(address) { win().location.hash = address; },
    go: uuid => logseq.App.pushState('page', { name: uuid }),
    replaced: was => !!main() && sign() !== was.sign,
    has: uuid => !!blockIn(uuid),
    focused: () => !!line(),
    isBullet: async uuid => !!(await logseq.Editor.getBlock(uuid).catch(() => null))?.parent,
    typing: () => !!host().activeElement?.matches('textarea, input, [contenteditable="true"]'),
    editing: async () => !!(await logseq.Editor.checkEditing?.()),
    select: uuid => logseq.Editor.selectBlock?.(uuid),
    unselect: () => logseq.Editor.clearSelectedBlocks?.(),
    selected: uuid => !!host().querySelector(`#main-content-container .ls-block.selected[blockid="${uuid}"]`),
  };
})();

// Whether one of Logseq's own floats is open (a menu, a list to pick from, a window): a key pressed then is Logseq's.
const busy = () => !!host().querySelector('.ui__popover-content, .ui__dropdown-menu-content, .ui__context-menu-content, .ui__dialog-content, .ui__modal, #ui__ac');
// The bullet being written in is the one whose text box has the keys. It is "left" when another one has them, or none.
function left(fn) {
  const doc = host();
  let at = null, timer = 0;   // at: { uuid, was, now }
  const boxNow = () => { const el = doc.activeElement; const block = el?.tagName === 'TEXTAREA' ? el.closest('.ls-block[blockid]') : null; return block ? { el, uuid: block.getAttribute('blockid').toLowerCase() } : null; };
  const look = () => {
    const box = boxNow();
    if (at && (!box || box.uuid !== at.uuid)) { const gone = at; at = null; if (gone.now !== gone.was) setTimeout(() => { try { fn(gone.uuid); } catch (error) { console.error('Logseq Plugin: a bullet just left could not be read', error); } }, 250); }
    if (box && !at) at = { uuid: box.uuid, was: box.el.value, now: box.el.value };
    else if (box && at) at.now = box.el.value;
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(look, 120); };
  const types = ['focusin', 'focusout', 'keyup', 'pointerup', 'input'];
  for (const type of types) doc.addEventListener(type, soon, true);
  return () => { clearTimeout(timer); for (const type of types) doc.removeEventListener(type, soon, true); };
}
const KEY_CODES = { '.': 'Period', ',': 'Comma' };
function key(combo, fn) {
  const parts = combo.toLowerCase().split('+'), code = parts.pop(), want = { mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') };
  const onKey = event => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.code !== (KEY_CODES[code] || (code.length === 1 ? 'Key' + code.toUpperCase() : code)) || mod !== want.mod || event.shiftKey !== want.shift || event.altKey !== want.alt) return;
    if (fn(event) === false) return;
    event.preventDefault(); event.stopPropagation();
  };
  host().addEventListener('keydown', onKey, true);
  return () => host().removeEventListener('keydown', onKey, true);
}
/* Logseq's own list of tags, the one that opens on "#" in a bullet. say(name) answers the words to stand after a tag's name
   there, or ''. Logseq draws the rows again at every letter, so each pass sets the words anew. Gives back what takes them out. */
function tagList(say) {
  const LIST = '.ui__popover-content[data-editor-popup-ref="page-search-hashtag"]';
  const off = watch(() => {
    const list = host().querySelector(LIST);
    if (!list) return;
    for (const row of list.querySelectorAll('a.menu-link')) {
      const line = row.querySelector('.flex-row.items-start');
      if (!line) continue;
      let note = [...line.children].find(child => child.classList.contains('lk-where')) || null;
      const name = [...line.childNodes].filter(node => node !== note).map(node => node.textContent).join('').trim();
      let words = ''; try { words = String(say(name) || ''); } catch (error) { words = ''; }
      if (!words) { note?.remove(); continue; }
      if (!note) { note = host().createElement('span'); note.className = 'lk-where'; line.appendChild(note); }
      if (note.textContent !== words) note.textContent = words;
    }
  });
  return () => { off(); for (const note of host().querySelectorAll(`${LIST} .lk-where`)) note.remove(); };
}
/* Logseq's own bar for the rows ticked in one of its tables (a tag's page, a property's page: "Selected: 3", Copy, Set property…)
   gets one more word. A press hands run({ ids, bar }) the ids of the ticked nodes. Logseq draws only the rows on screen, so each
   row's tick is kept as it passes; when the count kept differs from the bar's own "Selected: N" (every row ticked at once in a
   long table) the table is walked once from top to bottom to read the rest and put back where it stood. A count that still
   differs changes nothing and says so. Gives back what takes the word away. */
function tableBar(word, run) {
  const BAR = '.ls-table-actions', TABLE = '.ls-table', ROW = '.ls-table-row', TICK = 'label[data-table-row-select]', doc = host(), win = doc.defaultView;
  const known = new WeakMap();
  const idOf = label => { const n = parseInt(label.getAttribute('for') || '', 10); return Number.isFinite(n) ? n : null; };
  const ticked = label => !!label.querySelector('[aria-checked="true"], [data-state="checked"]');
  const read = table => { const map = known.get(table) || known.set(table, new Map()).get(table); for (const label of table.querySelectorAll(`${ROW} ${TICK}`)) { const id = idOf(label); if (id != null) map.set(id, ticked(label)); } return map; };
  const picked = table => [...read(table)].filter(([, on]) => on).map(([id]) => id);
  const said = bar => { const n = parseInt((bar.querySelector('.selection-count')?.textContent || '').replace(/\D+/g, ''), 10); return Number.isFinite(n) ? n : null; };
  async function walk(table) {
    let scroller = table; while (scroller && scroller !== doc.body && !(/(auto|scroll)/.test(win.getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 4)) scroller = scroller.parentElement;
    if (!scroller || scroller === doc.body) return;
    const was = scroller.scrollTop, step = Math.max(120, Math.round(scroller.clientHeight * 0.7)), frame = () => new Promise(done => win.requestAnimationFrame(() => win.setTimeout(done, 30)));
    const top = () => table.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    for (let y = Math.max(0, top() - 40), end = top() + table.scrollHeight; y <= end; y += step) { scroller.scrollTop = y; await frame(); read(table); if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) break; }
    scroller.scrollTop = was; await frame();
  }
  const press = async bar => {
    const table = bar.closest(TABLE); if (!table) return;
    const want = said(bar); let ids = picked(table);
    if (want != null && ids.length !== want) { await walk(table); ids = picked(table); }
    if (want != null && ids.length !== want) { G.say(`${word.replace(/…$/, '')} could not tell which ${want} rows are ticked (it read ${ids.length}). Nothing was changed.`, 'warning'); return; }
    if (ids.length) run({ ids, bar });
  };
  const off = watch(() => {
    for (const table of doc.querySelectorAll(TABLE)) read(table);
    for (const bar of doc.querySelectorAll(BAR)) {
      if (bar.querySelector('.lk-table-word')) continue;
      const like = [...bar.querySelectorAll('button')].find(button => button.textContent.trim().length > 1), button = doc.createElement('button');
      button.type = 'button'; button.className = `${like?.className || ''} lk-table-word`; button.textContent = word;
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); press(bar); });
      (like?.parentElement || bar).appendChild(button);
    }
  });
  return () => { off(); for (const button of doc.querySelectorAll('.lk-table-word')) button.remove(); };
}
// A command in Logseq's palette; with keys ('u p'), also a shortcut of Logseq's own kind, listed and changed in its settings.
const said = new Map();   // the plugin's own commands, for a place that lists them (the corner)
const command = (name, label, run, keys) => { said.set(name, { name, label, run }); return logseq.App.registerCommandPalette(keys ? { key: name, label, keybinding: { binding: keys } } : { key: name, label }, run); };
const commands = () => { const keys = new Map(palette().map(one => [one.id.split('/').pop(), one.key])); return [...said.values()].map(one => ({ ...one, key: keys.get(one.name) || '' })); };
/* Logseq's own commands, as its palette lists them, each { id, label, key, run }: the key it has (as the Mac's marks, "⌘⇧K",
   or two letters one after another, "g j"); run as its palette runs it, by its id (a plugin's own by its action). The plugin's
   own lines are left out: commands() has them. Read from the app's state, which it hands to a plugin in the same window.
   The palette's state keeps each command's first key: a key changed in Logseq's keyboard settings is in the graph's config
   (:shortcuts), where an empty one means none. keysRead() reads that; what it last read stands over the state's. */
const LOGSEQ_NAMES = {   // the English name of each of Logseq's commands: the app hands its commands to a plugin, not its dictionary
  'auto-complete/complete': 'Auto-complete: Choose selected item',
  'auto-complete/meta-complete': 'Auto-complete: Cmd + Enter to choose selected item',
  'auto-complete/next': 'Auto-complete: Select next item',
  'auto-complete/prev': 'Auto-complete: Select previous item',
  'auto-complete/shift-complete': 'Auto-complete: Open selected item in sidebar',
  'command-palette/toggle': 'Search commands',
  'editor/add-comment': 'Add comment',
  'editor/add-property': 'Add property',
  'editor/add-property-deadline': 'Add task deadline to selected block',
  'editor/add-property-icon': 'Add icon',
  'editor/add-property-priority': 'Add task priority to selected block',
  'editor/add-property-status': 'Add task status to selected block',
  'editor/add-reaction': 'Add reaction',
  'editor/backspace': 'Backspace / Delete backwards',
  'editor/backward-kill-word': 'Delete a word backwards',
  'editor/backward-word': 'Move cursor backward a word',
  'editor/beginning-of-block': 'Move cursor to the beginning of a block',
  'editor/bold': 'Bold',
  'editor/clear-block': 'Delete entire block content',
  'editor/collapse-block-children': 'Collapse',
  'editor/copy': 'Copy (copies either selection, or block reference)',
  'editor/copy-embed': 'Copy a block embed pointing to the current block',
  'editor/copy-page-url': 'Copy page url',
  'editor/copy-text': 'Copy selections as text',
  'editor/cut': 'Cut',
  'editor/cycle-todo': 'Rotate the TODO state',
  'editor/delete': 'Delete / Delete forwards',
  'editor/delete-selection': 'Delete selected blocks',
  'editor/down': 'Move cursor down / Select down',
  'editor/end-of-block': 'Move cursor to the end of a block',
  'editor/escape-editing': 'Escape editing',
  'editor/expand-block-children': 'Expand',
  'editor/follow-link': 'Follow link under cursor',
  'editor/forward-kill-word': 'Delete a word forwards',
  'editor/forward-word': 'Move cursor forward a word',
  'editor/highlight': 'Highlight',
  'editor/indent': 'Indent block',
  'editor/insert-link': 'HTML Link',
  'editor/insert-youtube-timestamp': 'Insert youtube timestamp',
  'editor/italics': 'Italics',
  'editor/jump': 'Jump to a property key or value',
  'editor/kill-line-after': 'Delete line after cursor position',
  'editor/kill-line-before': 'Delete line before cursor position',
  'editor/left': 'Move cursor left / Open selected block at beginning',
  'editor/move-block-down': 'Move block down',
  'editor/move-block-up': 'Move block up',
  'editor/move-blocks': 'Move blocks to',
  'editor/new-block': 'Create new block',
  'editor/new-line': 'New line in current block',
  'editor/open-edit': 'Edit selected block',
  'editor/open-link-in-sidebar': 'Open link in sidebar',
  'editor/open-selected-blocks-in-sidebar': 'Open selected block(s) in sidebar',
  'editor/outdent': 'Outdent block',
  'editor/paste-text-in-one-block-at-point': 'Paste text into one block at point',
  'editor/quick-add': 'Quick add',
  'editor/redo': 'Redo',
  'editor/right': 'Move cursor right / Open selected block at end',
  'editor/select-all-blocks': 'Select all blocks',
  'editor/select-block-down': 'Select block below',
  'editor/select-block-up': 'Select block above',
  'editor/select-down': 'Select content below',
  'editor/select-parent': 'Select parent block',
  'editor/select-up': 'Select content above',
  'editor/set-tags': 'Set tags for selected block(s)',
  'editor/strike-through': 'Strikethrough',
  'editor/toggle-block-children': 'Toggle expand/collapse',
  'editor/toggle-display-hidden-properties': 'Toggle display hidden properties',
  'editor/toggle-number-list': 'Toggle number list',
  'editor/toggle-open-blocks': 'Toggle open blocks (collapse or expand all blocks)',
  'editor/undo': 'Undo',
  'editor/up': 'Move cursor up / Select up',
  'editor/zoom-in': 'Zoom in editing block / Forwards otherwise',
  'editor/zoom-out': 'Zoom out editing block / Backwards otherwise',
  'go/all-graphs': 'Go to all graphs',
  'go/all-pages': 'Go to all pages',
  'go/backward': 'Backwards',
  'go/electron-find-in-page': 'Find text in page',
  'go/electron-jump-to-the-next': 'Jump to the next match to your Find bar search',
  'go/electron-jump-to-the-previous': 'Jump to the previous match to your Find bar search',
  'go/flashcards': 'Toggle flashcards',
  'go/forward': 'Forwards',
  'go/graph-view': 'Go to graph view',
  'go/home': 'Go to home',
  'go/journals': 'Go to journals',
  'go/keyboard-shortcuts': 'Go to keyboard shortcuts',
  'go/next-journal': 'Go to next journal',
  'go/prev-journal': 'Go to previous journal',
  'go/search': 'Search pages and blocks',
  'go/search-in-page': 'Search blocks in page',
  'go/search-themes': 'Search themes',
  'go/tomorrow': 'Go to tomorrow',
  'graph/add': 'Add a graph',
  'graph/db-add': 'Add a DB graph',
  'graph/db-save': 'Save the current db to the disk (~/logseq/graphs/your-current-graph)',
  'graph/export-as-html': 'Export public graph pages as HTML',
  'graph/open': 'Select graph to open',
  'graph/remove': 'Remove a graph',
  'misc/copy': 'Copy',
  'misc/export-block-data': 'Export block EDN data',
  'misc/export-graph-ontology-data': 'Export graph\'s tags and properties EDN data',
  'misc/export-page-data': 'Export page EDN data',
  'misc/import-edn-data': 'Import EDN data',
  'page/toggle-favorite': 'Add to/remove from favorites',
  'pdf/close': 'PDF: Close current pdf doc',
  'pdf/find': 'PDF: Search text of current pdf doc',
  'pdf/next-page': 'PDF: Next page of current pdf doc',
  'pdf/previous-page': 'PDF: Previous page of current pdf doc',
  'publish/open-dialog': 'Open publish dialog for current page',
  'search/re-index': 'Rebuild search index',
  'shell/run': 'Run git command',
  'sidebar/clear': 'Clear all in the right sidebar',
  'sidebar/close-top': 'Closes the top item in the right sidebar',
  'sidebar/open-today-page': 'Open today\'s page in the right sidebar',
  'ui/clear-all-notifications': 'Clear all notifications',
  'ui/customize-appearance': 'Customize appearance',
  'ui/goto-plugins': 'Go to plugins dashboard',
  'ui/highlight-recent-blocks': 'Toggle highlight recent blocks',
  'ui/install-plugin-from-github': 'Install plugin from GitHub release',
  'ui/install-plugins-from-file': 'Install plugins from plugins.edn',
  'ui/select-theme-color': 'Select available theme colors',
  'ui/toggle-brackets': 'Toggle whether to display brackets',
  'ui/toggle-contents': 'Toggle Contents in sidebar',
  'ui/toggle-document-mode': 'Toggle document mode',
  'ui/toggle-help': 'Toggle help',
  'ui/toggle-left-sidebar': 'Toggle left sidebar',
  'ui/toggle-right-sidebar': 'Toggle right sidebar',
  'ui/toggle-settings': 'Toggle settings',
  'ui/toggle-theme': 'Toggle between dark/light theme',
  'ui/toggle-wide-mode': 'Toggle wide mode',
  'window/close': 'Close window'
};
const MARK = { mod: '⌘', meta: '⌘', cmd: '⌘', shift: '⇧', alt: '⌥', opt: '⌥', option: '⌥', ctrl: '⌃', control: '⌃', enter: '↩', return: '↩', tab: '⇥', escape: '⎋', esc: '⎋', backspace: '⌫', delete: '⌦', space: 'Space', up: '↑', down: '↓', left: '←', right: '→' };
const keyMarks = spelling => {
  if (typeof spelling !== 'string' || !spelling.trim() || /disabled/i.test(spelling)) return '';
  return spelling.split('|')[0].trim().split(/\s+/).map(step => { const parts = step.split('+').filter(Boolean); if (parts.length < 2 && step.length === 1) return step;
    return parts.map(part => MARK[part.toLowerCase()] || (part.length === 1 ? part.toUpperCase() : part)).join(''); }).join(' ');
};
const nameOf = id => { const words = id.split('/').pop().replace(/-/g, ' '); return words.charAt(0).toUpperCase() + words.slice(1); };
let changedKeys = {};
async function keysRead() {
  try { const all = await logseq.App.getCurrentGraphConfigs('shortcuts'); changedKeys = all && typeof all === 'object' && !Array.isArray(all) ? all : {}; }
  catch (error) { changedKeys = {}; }
}
// Every line of the palette once, the plugin's among them, with the key in force.
function palette() {
  let all = [];
  try { all = host().defaultView.logseq.api.get_state_from_store('command-palette/commands') || []; } catch (error) { all = []; }
  const seen = new Set(), out = [];
  for (const one of Array.isArray(all) ? all : []) {
    const id = String(one?.id ?? '').replace(/^:/, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const set = Object.hasOwn(changedKeys, id) ? [].concat(changedKeys[id])[0] : one.shortcut;
    out.push({ id, one, key: keyMarks(set) });
  }
  return out;
}
const logseqCommands = () => palette().filter(({ id }) => !/(^|[/.])lk-/.test(id)).map(({ id, one, key }) => {
  const action = typeof one.action === 'function' ? one.action : null;
  return { id, label: LOGSEQ_NAMES[id] || (typeof one.desc === 'string' && one.desc) || nameOf(id), key,
    run: () => (/[A-Z]/.test(id) && action) ? action() : logseq.App.invokeExternalCommand('logseq.' + id) };
});
/* The plugins Logseq runs, each { id, title, version }, as Update plugins took them before the rebuild (0.5.17, the owner,
   26 November 2026: "u p is still not working. look to pre 0.6.0 to find it correctly used").
   market() (async): the ones Logseq installed itself, from its marketplace or a GitHub release, read from Logseq's own list of
   installed plugins (iir), each with the repository its releases come from. mine(): the ones it loads from a folder.
   updates(list) hands each plugin of market() to Logseq's own updater, the one "Check update" on its card uses, one after
   another, this plugin last; Logseq fetches the newest release and, if it is newer, puts it in and loads the plugin again.
   It answers { updated: [{ title, version, to }], same, failed: [{ title, why }] }.
   reload(ids) has Logseq load the folder ones again, this plugin last: its own code ends there. What keep() is given outlives
   that reload for a minute, for took() to hand to the plugin's next run, once. */
const LOADED = 'lk.plugins-before';
const repoOf = entry => {
  const address = typeof entry?.repository === 'string' ? entry.repository : entry?.repository?.url;
  return entry?.repo || /github\.com[/:]([^/]+\/[^/]+?)(\.git)?\/?$/.exec(address || '')?.[1] || '';
};
const listed = filter => {
  const core = host().defaultView.LSPluginCore;
  return core ? [...core.registeredPlugins.values()].filter(filter).map(one => ({ id: one.id, title: one.options?.title || one.options?.name || one.id, version: one.options?.version || '' })) : [];
};
async function fromRelease() {
  let installed = {};
  try { installed = await logseq.App.getStateFromStore('plugin/installed-plugins') || {}; } catch (error) { return new Map(); }
  return new Map(Object.values(installed).filter(entry => entry?.iir && entry.id).map(entry => [entry.id, entry]));
}
// Logseq's updater answers on its own channel and says the outcome itself; the answer for one plugin, or null after a minute.
function asked(apis, pkg) {
  return new Promise(resolve => {
    let timer = null;
    const done = said => { apis.removeListener('lsp-updates', heard); clearTimeout(timer); resolve(said); };
    const heard = (a, b) => { const said = b || a; if (said?.payload?.id === pkg.id && !said['only-check']) done(said); };
    apis.addListener('lsp-updates', heard);
    timer = setTimeout(() => done(null), 60000);
    Promise.resolve(apis.doAction(['updateMarketPlugin', { ...pkg, 'only-check': false }])).catch(error => done({ status: 'error', payload: { id: pkg.id, 'error-code': String(error?.message || error) } }));
  });
}
const plugins = {
  async market() {
    const release = await fromRelease();
    return listed(one => release.has(one.id) && !one.disabled).map(one => { const entry = release.get(one.id); return { ...one, repo: repoOf(entry), name: entry.name, theme: !!entry.theme, effect: !!entry.effect }; });
  },
  mine: () => listed(one => !one.isInstalledInLocalDotRoot && !one.isWebPlugin),
  now: id => listed(one => one.id === id)[0] || null,
  async updates(list) {
    const out = { updated: [], same: [], failed: [] }, apis = host().defaultView.apis, own = logseq.baseInfo.id;
    if (!list.length) return out;
    if (!apis?.doAction) { out.failed = list.map(one => ({ ...one, why: 'this Logseq lends plugins no updater' })); return out; }
    for (const one of [...list.filter(p => p.id !== own), ...list.filter(p => p.id === own)]) {
      if (!one.repo) { out.failed.push({ ...one, why: 'it names no GitHub repository to update from' }); continue; }
      if (one.id === own) plugins.keep({ list: [], market: out, own: one });   // a newer copy of this plugin ends this code: the next run says it
      const said = await asked(apis, { id: one.id, repo: one.repo, version: one.version, title: one.title, name: one.name, theme: one.theme, effect: one.effect });
      const payload = said?.payload || {}, code = String(payload['error-code'] || payload.errorCode || '');
      if (one.id === own && said?.status !== 'completed') plugins.took();   // no newer copy came: nothing waits to be said
      if (said?.status === 'completed') out.updated.push({ ...one, to: payload['installed-version'] || payload.installedVersion || '' });
      else if (/no-new-version|up.to.date|latest/i.test(code)) out.same.push(one);
      else out.failed.push({ ...one, why: said ? code.replace(/^[\s:[]+|\]$/g, '') || 'Logseq refused' : 'no answer from Logseq' });
    }
    return out;
  },
  async reload(ids) {
    const core = host().defaultView.LSPluginCore, own = logseq.baseInfo.id;
    for (const id of ids.filter(one => one !== own)) { try { await core.reload(id); } catch (error) { console.error(`Logseq Plugin: ${id} could not be reloaded`, error); } }
    if (ids.includes(own)) await core.reload(own);
  },
  keep(kept) { try { host().defaultView.localStorage.setItem(LOADED, JSON.stringify({ at: Date.now(), ...kept })); } catch (error) { /* then nothing is said afterwards */ } },
  took() {
    try { const at = host().defaultView.localStorage, kept = JSON.parse(at.getItem(LOADED) || 'null'); at.removeItem(LOADED); return kept && Date.now() - kept.at < 60000 ? kept : null; } catch (error) { return null; }
  },
};
function section(name, title, draw, path) {
  const E = logseq.Experiments, React = E?.React;
  if (!React?.createElement || !E.registerSidebarRenderer) return { open() { G.say(`${title} cannot be shown: this Logseq lends plugins no sidebar section`, 'warning'); }, off() {} };
  const drawn = new Map();   // the element Logseq gave -> what clears it
  const fill = holder => {
    if (drawn.has(holder)) return;
    holder.replaceChildren(); holder.className = 'lk-section';
    try { drawn.set(holder, draw(holder) || (() => {})); } catch (error) { console.error(`Logseq Plugin: ${title} could not be drawn`, error); }
  };
  const clear = holder => { const off = drawn.get(holder); drawn.delete(holder); try { off?.(); } catch (error) { /* gone with its element */ } };
  /* Logseq heads a plugin's section with the section's own address and a puzzle: its name and its own drawing are put there, and
     put back whenever Logseq draws the head again. And a section left open while the plugin is loaded again keeps the element
     Logseq gave the plugin's earlier copy, with nothing behind it that answers a press (the walk, 25 November 2026): it is taken
     over and drawn afresh. */
  const offWatch = watch(() => {
    const head = host().getElementById('_sidebar.' + name);
    if (!head) return;
    if (head.textContent !== title) head.textContent = title;
    const lines = path ? [...(head.parentElement?.querySelectorAll('.ui__icon svg path') || [])] : [];
    lines.forEach((line, i) => { const d = i ? '' : path; if (line.getAttribute('d') !== d) line.setAttribute('d', d); });
    const holder = head.closest('.sidebar-item')?.querySelector('.lk-section');
    if (holder) {
      fill(holder);
      // The ground the section stands on, for a piece of it that stays in view while the rest scrolls under it.
      // A section lies flat on the sidebar, so its own ground may be none: the first ground painted under it is the one.
      let ground = 'rgba(0, 0, 0, 0)';
      for (let at = head.closest('.sidebar-item'); at && /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(ground); at = at.parentElement) ground = holder.ownerDocument.defaultView.getComputedStyle(at).backgroundColor;
      if (holder.style.getPropertyValue('--lk-ground') !== ground) holder.style.setProperty('--lk-ground', ground);
    }
    for (const one of [...drawn.keys()]) if (!one.isConnected) clear(one);
  });
  const View = () => {
    const ref = React.useRef(null);
    React.useEffect(() => { const holder = ref.current; if (holder) fill(holder); return () => { if (holder) clear(holder); }; }, []);
    return React.createElement('div', { ref, className: 'lk-section' });
  };
  E.registerSidebarRenderer(name, { title, render: () => React.createElement(View) });
  return { open: () => logseq.Editor.openInRightSidebar('_sidebar.' + name), off() { offWatch(); for (const holder of [...drawn.keys()]) { clear(holder); holder.replaceChildren(); } } };
}
/* A page of the plugin's own in Logseq's main view, at its own address: Logseq hosts it and draw(el) fills it (and gives back
   what clears it). A page left on screen while the plugin is loaded again keeps the element given to the earlier copy: it is
   taken over and drawn afresh, as a sidebar section is. Answers { open(), at() }. */
function page(name, title, draw) {
  const E = logseq.Experiments, React = E?.React, path = '/' + name;
  if (!React?.createElement || !E.registerRouteRenderer) return { open() { G.say(`${title} cannot be shown: this Logseq lends plugins no page`, 'warning'); }, at: () => false, off() {} };
  const drawn = new Map();
  const fill = holder => { if (drawn.has(holder)) return; holder.replaceChildren(); holder.className = 'lk-section'; try { drawn.set(holder, draw(holder) || (() => {})); } catch (error) { console.error(`Logseq Plugin: ${title} could not be drawn`, error); } };
  const clear = holder => { const off = drawn.get(holder); drawn.delete(holder); try { off?.(); } catch (error) { /* gone with its element */ } };
  const offWatch = watch(() => {
    const holder = host().querySelector(`.lk-page[data-page="${name}"] > .lk-section`);
    if (holder) fill(holder);
    for (const one of [...drawn.keys()]) if (!one.isConnected) clear(one);
  });
  const View = () => {
    const ref = React.useRef(null);
    React.useEffect(() => { const holder = ref.current; if (holder) fill(holder); return () => { if (holder) clear(holder); }; }, []);
    return React.createElement('div', { className: 'lk-page', 'data-page': name }, React.createElement('h1', { className: 'lk-page-title' }, title), React.createElement('div', { ref, className: 'lk-section' }));
  };
  E.registerRouteRenderer(name, { name, path, render: () => React.createElement(View) });
  const at = () => host().defaultView.location.hash.split('?')[0] === '#' + path;
  return { at, open() { if (!at()) host().defaultView.location.hash = '#' + path; }, off() { offWatch(); for (const holder of [...drawn.keys()]) { clear(holder); holder.replaceChildren(); } } };
}
/* Logseq 2.0.2 draws a plugin's toolbar button only when it is in its list of pinned ones, otherwise set from the puzzle icon's
   menu. So the button pins itself: into Logseq's state (which redraws the toolbar) and its preferences file. One at a time. */
let pinning = Promise.resolve();
function toolbar(name, title, path, run) {
  const model = `lk_${name.replace(/\W/g, '_')}`;
  logseq.provideModel({ [model]: run });
  logseq.App.registerUIItem('toolbar', { key: name, template: `<a class="button" data-on-click="${model}" title="${G.esc(title)}" aria-label="${G.esc(title)}"><svg class="tabler-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${G.esc(path)}"/></svg></a>` });
  pinning = pinning.then(async () => {
    const id = `${logseq.baseInfo?.id || 'logseq-plugin'}:${name}`, where = ['plugin/preferences', 'pinnedToolbarItems'];
    const pinned = await logseq.App.getStateFromStore?.(where);
    if (!Array.isArray(pinned) || pinned.includes(id)) return;
    await logseq.App.setStateFromStore?.(where, [...pinned, id]);
    await host().defaultView.LSPluginCore?.saveUserPreferences?.({ pinnedToolbarItems: [...pinned, id] });
  }).catch(error => console.warn('Logseq Plugin: a toolbar button could not be pinned', error));
}
// to: a node's uuid, or a page's name where the words gave only a name.
async function open(to, side = false) {
  if (!side) return logseq.App.pushState('page', { name: to });
  const uuid = G.read.UUID.test(to) ? to : (await logseq.Editor.getPage(to).catch(() => null))?.uuid;
  if (uuid) return logseq.Editor.openInRightSidebar(uuid);
}

/* Out of Logseq: the right-click items, the clipboard, a file, the print window, the graph's pictures. */
function menuItem(label, run) {
  logseq.Editor.registerBlockContextMenuItem(label, event => run({ uuid: event?.uuid }));
  logseq.App.registerPageMenuItem?.(label, event => run({ page: event?.page }));
}
const keep = settings => logseq.updateSettings(settings);
async function copy(text) {
  try { await host().defaultView.navigator.clipboard.writeText(text); return true; } catch (error) { console.warn('Logseq Plugin: the clipboard could not be reached', error); return false; }
}
/* In Logseq's desktop window a download from a plugin goes nowhere (seen 29 October 2026), so a file is written through the
   bridge Logseq's own exports use: its folder window, then writeFile, then the file shown in the Finder. */
async function save(name, text, folder = '') {
  const apis = host().defaultView.apis;
  if (!apis?.doAction) throw new Error('this Logseq lends plugins no way to save a file');
  const picked = await apis.doAction(['showOpenDialog', { title: `Save ${name}`, message: `Choose the folder for ${name}`, buttonLabel: 'Save here', properties: ['openDirectory', 'createDirectory'], ...(folder ? { defaultPath: folder } : {}) }]);
  const dir = picked && !picked.canceled && picked.filePaths?.[0];
  if (!dir) return null;
  const at = one => `${String(dir).replace(/\/$/, '')}/${one}`;
  const free = await G.export.freeName(name, async one => { try { return !!await apis.doAction(['stat', at(one)]); } catch (error) { return false; } });
  await apis.doAction(['writeFile', null, at(free), text]);
  try { apis.doAction(['openFileInFolder', at(free)]); } catch (error) { /* the file is saved all the same */ }
  return { path: at(free), folder: String(dir) };
}
const settled = (doc, ms = 4000) => new Promise(resolve => {
  const loading = [...doc.images].filter(image => !image.complete);
  let left = loading.length;
  if (!left) return resolve();
  const one = () => { if (--left <= 0) resolve(); };
  for (const image of loading) { image.addEventListener('load', one); image.addEventListener('error', one); }
  setTimeout(resolve, ms);
});
// The page stands in a frame of Logseq's own page, off the screen: the plugin's own frame is hidden and prints nothing.
function print(html) {
  return new Promise((resolve, reject) => {
    const doc = host(), frame = doc.createElement('iframe');
    frame.className = 'lk-print'; frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0;';
    doc.body.appendChild(frame);
    const page = frame.contentDocument;
    page.open(); page.write(html); page.close();
    settled(page).then(() => setTimeout(() => {
      let failed = null;
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (error) { failed = error; }   // answers when the print window closes
      setTimeout(() => { frame.remove(); if (failed) reject(failed); else resolve(); }, 500);
    }, 150));
  });
}
/* Logseq serves a graph's files on its assets:// address. Each picture is read once into the page itself, so the preview and
   the printed page both carry it. A file that cannot be read keeps its address. */
const read = new Map();
async function pictures(files) {
  let folder = '';
  try { folder = String((await logseq.App.getCurrentGraph())?.path || ''); } catch (error) { folder = ''; }
  const at = file => folder ? `assets://${encodeURI(folder.replace(/\/$/, ''))}/${file}` : file, out = new Map();
  await Promise.all([...new Set(files)].map(async file => {
    const address = at(file);
    if (!read.has(address)) {
      try {
        const blob = await (await fetch(address)).blob();
        read.set(address, await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }));
      } catch (error) { console.warn('Logseq Plugin: a picture could not be read', file, String(error?.message || error)); }
    }
    out.set(file, read.get(address) || address);
  }));
  return file => out.get(file) || at(file);
}
// Logseq draws a query as a table: its columns, and the rows' order, are read from the screen when it is drawn there.
function queryShown(uuid) {
  const block = host().querySelector(`.ls-block[blockid="${uuid}"]`), table = block?.querySelector('.ls-table');
  if (!table) return null;
  const columns = [...table.querySelectorAll('.ls-table-header .ls-table-header-cell [title]')].map(cell => cell.getAttribute('title')).filter(Boolean);
  const ids = [...new Set([...table.querySelectorAll('[blockid]')].map(row => row.getAttribute('blockid').toLowerCase()))], count = Number(block.querySelector('.ls-view-head')?.textContent.match(/\((\d+)\)/)?.[1]);
  return { columns: columns.length ? columns : null, order: ids.length && ids.length === count ? ids : null };   // only when every row is drawn
}
// Logseq's header moves the window when pressed: a real press there never reaches the page, whatever is drawn over it.
function dragBand() {
  const doc = host();
  let bottom = 0;
  for (const el of doc.querySelectorAll('.drag-region, #head')) if (doc.defaultView.getComputedStyle(el).webkitAppRegion === 'drag') { const box = el.getBoundingClientRect(); if (box.top < 100 && box.width > 300) bottom = Math.max(bottom, box.bottom); }
  return Math.round(bottom) || 48;
}
function graphChanged(fn) {
  const off = logseq.App.onCurrentGraphChanged(() => { read.clear(); fn(); });
  return () => { if (typeof off === 'function') off(); };
}

// One of Logseq's own icons, drawn as Logseq draws it (its tablerIcons hand back a React element), else from the icon font it loads.
const pascal = id => String(id).replace(/(^|[-_ ])(\w)/g, (m, s, c) => c.toUpperCase());
function markup(el) {
  if (el == null || el === false) return '';
  if (Array.isArray(el)) return el.map(markup).join('');
  if (typeof el !== 'object') return G.esc(String(el));
  if (typeof el.type === 'function') return markup(el.type(el.props || {}));
  const { children, ...props } = el.props || {};
  const attrs = Object.entries(props).filter(([, v]) => v != null && v !== false && typeof v !== 'function' && typeof v !== 'object')
    .map(([k, v]) => ` ${k === 'className' ? 'class' : /^(viewBox|xmlns)$/.test(k) ? k : k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${G.esc(String(v))}"`).join('');
  return `<${el.type}${attrs}>${markup(children)}</${el.type}>`;
}
function icon(id, size = 18) {
  const drawn = host().defaultView?.tablerIcons?.['Icon' + pascal(id)];
  if (drawn) { try { return markup(drawn({ size })); } catch (error) { /* the font below */ } }
  return `<i class="ti ti-${G.esc(String(id).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])([0-9])/g, '$1-$2').toLowerCase())}" aria-hidden="true"></i>`;
}
// A status's icon in Logseq's own colour for it (its class for the icon carries the colour; an icon's own colour wins).
function statusIcon(found) {
  if (!found?.id) return '';
  const drawn = found.type === 'emoji' ? `<em-emoji id="${G.esc(found.id)}" size="1em"></em-emoji>` : icon(found.id);
  return `<span class="lk-status-icon ls-icon-${G.esc(found.id)}"${found.color ? ` style="color: ${G.esc(found.color)}"` : ''}>${drawn}</span>`;
}

// Logseq's folded bullets: the words of each (its own, not a child's), where a note after them stands.
function foldedSpots() {
  const own = (block, selector) => [...block.querySelectorAll(selector)].find(el => el.closest('.ls-block[blockid]') === block);
  return [...host().querySelectorAll('.ls-block[blockid][data-collapsed="true"]')].map(block => {
    const words = own(block, '.block-title-wrap'), file = !words && own(block, '.block-head-wrap a.asset-ref');
    if (!words && !file) return null;
    return { uuid: block.getAttribute('blockid').toLowerCase(), at: own(block, '.lk-held-note'), put: el => words ? words.append(el) : file.after(el) };
  }).filter(Boolean);
}
const FOLDED = `.ls-block:not([data-collapsed="true"]) > .block-main-container .lk-held-note { display: none; }
.block-head-wrap > a.asset-ref + .lk-held-note { margin-right: auto; align-self: center; flex: none; }`;
const openUrl = url => logseq.App.openExternalLink(url);

/* Where the plugin's lists stand, Logseq's own for the same thing are taken away: its Linked references and its two-way
   property tabs. Only where the plugin's stand (:has), so a plugin that failed to draw leaves Logseq's in place. */
const HIDES_TAGS = `.ls-page-title .ls-block:has(> .lk-place:not(:empty)) > .is-page-title-row .block-tags, .ls-block-right:has(> .lk-place:not(:empty)) > .block-tags { display: none !important; }
.ls-block-right > .lk-place { align-self: flex-start; }
.ls-page-title-container:has(.lk-place-end) { column-gap: 14px !important; }   /* the space before the path is the row's gap: when the path drops under the title it starts on the title's edge */`;
const HIDES = `
${PAGE}:has(.lk-relpage) .references, ${PAGE}:has(.lk-relpage) .ls-bidirectional-properties { display: none !important; }
.lk-open ${PAGE} .references, .lk-open ${PAGE} .unlinked-references, .lk-open ${PAGE} .ls-bidirectional-properties { display: none !important; }`;

/* Logseq's editor draws a node as a whole page: a wide margin under it, the path to it above, a large title. Opened in a row it
   stands as the row's own line: no margins of a page, the path left out, a page's title at the size of the words around it.
   A bullet's own fold arrow is left out too: it would stand exactly where the row's arrow stands, and the row's arrow, which
   closes the node, is the one a person means there (the walk, 25 November 2026: a press on the row's arrow reached Logseq's).
   A page's own arrow stays, in the place the line's bullet had: it unfolds what the page keeps folded (a tag's Extends and
   properties), and nothing else opens those. */
const ARROW = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='6 4 12 16'%3E%3Cpath d='M9 6l6 6l-6 6' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";   // the one fold arrow, thin, as every list's (the owner's marked pages, 26 November 2026)
const OPENED = `
/* One form for every node (25 November 2026: "this does not look like a coherent system to dig"). Logseq draws a page's
   properties as rows, name then value, and a tagged bullet's as capsules in one clipped strip. Inside an opened node both are
   laid out as one kind of row: the names in one column as wide as the longest of them (--lk-keycol, set by the node's holder),
   the values in the next. Every row stays Logseq's own, so a press on a value opens Logseq's own list. A property with no
   value draws nothing. */
.lk-editor { --lk-keycol: 104px; --lk-gutter: 22px; }
.lk-editor .positioned-properties.block-below { overflow: visible !important; height: auto !important; max-height: none !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; }
.lk-editor .bottom-properties-row { display: block !important; height: auto !important; max-height: none !important; overflow: visible !important; padding: 0 !important; transition: none !important; }
.lk-editor .bottom-properties-row > button { display: none !important; }
.lk-editor .bottom-properties-pills-strip { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 0 !important; overflow: visible !important; width: 100% !important; }
.lk-editor :is(.bottom-property-pill, .property-pair.property-panel-row) { display: grid !important; grid-template-columns: calc(var(--lk-keycol) + var(--lk-gutter)) minmax(0, 1fr) !important; gap: 0 !important; align-items: start !important; min-height: var(--lk-line-h); height: auto !important; width: 100% !important; max-width: none !important; margin: 0; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: none !important; box-shadow: none !important; outline: 0 !important; overflow: visible !important; font-size: var(--lk-line-size) !important; line-height: 20px !important; transition: margin-bottom .14s ease; }
.lk-editor .bottom-property-pill::after { content: none !important; }
/* Logseq's own "Show hidden properties" is a capsule too: here one quiet line under the rows, not a row. */
.lk-editor button.bottom-property-pill.bottom-property-hidden-toggle-btn { display: inline-flex !important; align-self: flex-start; align-items: center !important; gap: 4px !important; width: auto !important; min-height: 24px; font-size: var(--lk-small) !important; color: var(--lk-off) !important; cursor: pointer; text-align: left; justify-content: flex-start; }
.lk-editor button.bottom-property-pill.bottom-property-hidden-toggle-btn:is(:hover, :focus-visible) { color: var(--lk-text) !important; }
.lk-editor .bottom-property-hidden-toggle-btn .bottom-property-action-icon { width: 14px !important; height: 14px !important; color: inherit !important; }
.lk-editor .bottom-property-pill > div:first-child { min-height: var(--lk-line-h); align-items: center; min-width: 0; }
.lk-editor .bottom-property-pill > div:first-child > .select-none { display: none !important; }
.lk-editor .bottom-property-pill .bottom-property-edit-icon, .lk-editor .property-panel-edit-btn { display: none !important; }
.lk-editor .bottom-property-pill:has(.empty-value), .lk-editor .property-pair.property-panel-row.property-panel-row-empty, .lk-editor .ls-new-property { display: none !important; }
/* Pressed, Logseq's "Show hidden properties" brings the node's other properties: the person asked for all of them, so the ones
   with no value are listed too, to be filled here. */
.lk-editor:has(.bottom-property-hidden-toggle-btn > .ls-icon-chevron-up) :is(.bottom-property-pill:has(.empty-value), .property-pair.property-panel-row.property-panel-row-empty) { display: grid !important; }
.lk-editor .property-key-panel { width: auto !important; min-width: 0 !important; min-height: var(--lk-line-h) !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-key-inner { min-width: 0; max-width: var(--lk-keycol); min-height: 0 !important; }
.lk-editor .property-pair .property-icon, .lk-editor .property-pair .property-panel-bullet { display: none !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-k { display: block !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--lk-prop-face) !important; font-weight: var(--lk-prop-weight) !important; font-size: var(--lk-small) !important; line-height: 20px !important; letter-spacing: -.01em; color: var(--lk-quiet) !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-container { min-height: var(--lk-line-h) !important; display: flex !important; align-items: center !important; flex-wrap: wrap; overflow: visible !important; white-space: normal !important; min-width: 0; font-size: var(--lk-line-size) !important; line-height: 20px !important; padding: 0 !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner { background: none !important; }
.lk-editor .ls-properties-area, .lk-editor .properties-panel { margin: 0 !important; padding: 0 !important; overflow: visible !important; border-radius: 0 !important; }
.lk-editor .ls-properties-area { display: block !important; }   /* Logseq drops these rows in a place narrower than 430px (the sidebar, a deep level); the rows here fit, so they stay */
.lk-editor .ls-block-content-indent { padding-left: 42px !important; }   /* a bullet's other properties start where its first ones do */
/* In a narrow place (a node opened in the sidebar's lists) there is no room for a column of names beside the values: a
   property's name stands on a line of its own and its values under it, each whole (the owner, 25 November 2026: "This is a
   sidebar and you need to account for that"). */
@container lk-list (max-width: 300px) {
  .lk-editor :is(.bottom-property-pill, .property-pair.property-panel-row) { grid-template-columns: minmax(0, 1fr) !important; }
  .lk-editor :is(.bottom-property-pill, .property-pair) .property-key-inner { max-width: none; }
  .lk-editor :is(.bottom-property-pill, .property-pair.property-panel-row) > :last-child { padding-left: 16px !important; }   /* the values one step in under their name, so a value's arrow stands inside the node, clear of the guide line it was dug from (the reset of the value's padding above had cancelled it) */
}
/* A task opened from its line keeps the line's start (the owner, 26 November 2026, fault 31-33): its bullet, status circle and words
   stay where they stood ("there should be bullets before tasks circles", 26 November 2026), no priority mark added (the priority is set from the right-click, as on the line),
   the tag Task left out as the line leaves it out, and in a narrow place no line for "Show hidden properties". */
.lk-editor .block-left.positioned-properties { margin-left: 2px !important; }
.lk-editor .block-left.positioned-properties :is(.ui__icon, .ui__icon svg) { width: 18px !important; height: 18px !important; }   /* the circle the line draws, 18 across, so the words stay where the line's stood */
.lk-list:not([data-viewed]) > .lk-rows > .lk-row > .lk-open > .lk-editor .block-left.positioned-properties { margin-left: 4px !important; }   /* where Logseq's own bullet stands before it (Todo), measured to the line's */
.lk-editor .block-left.positioned-properties > .property-value-inner:has([class*="ls-icon-priority"]) { display: none !important; }
.lk-editor .block-tag:has(> div > a.tag[data-ref="task"]), .lk-editor .block-tag:has(a.tag[data-ref="task"]):not(:has(a.tag:not([data-ref="task"]))) { display: none !important; }
.lk-editor .ls-block-right:has(.block-tags):not(:has(a.tag:not([data-ref="task"]))) { display: none !important; }
.lk-editor .block-main-container:has(> div > div > .block-main-content .block-left.positioned-properties) .positioned-properties.block-below { margin-left: 25px !important; width: auto !important; }   /* a task's properties start under its words */
.lk-editor .ls-block:has(> .block-main-container > div > div > .block-main-content .block-left.positioned-properties) > .ls-block-content-indent > .ls-properties-area { margin-left: 25px !important; }   /* and the hidden ones, when shown, on the same edge (the owner's pictures of a consultation in Relations, 26 November 2026) */
@container lk-list (max-width: 520px) {
  .lk-editor button.bottom-property-pill.bottom-property-hidden-toggle-btn:has(> .ls-icon-chevron-down) { display: none !important; }
}
/* A value that is words is a bullet of Logseq's: its words stand in the values' column, without the bullet. */
.lk-editor .property-pair .property-block-container { margin: 2px 0 0 !important; font-size: var(--lk-line-size) !important; }
.lk-editor .property-pair .property-block-container .block-control-wrap { display: none !important; }
.lk-editor .property-pair .property-block-container .block-main-container { gap: 0 !important; }
.lk-editor .property-pair .property-block-container .ls-block-content-indent { display: none !important; }
/* The arrow before a value that is a node: a press on it digs. The arrow stands in the gutter between the two columns, so the
   words of every value start on one line. */
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] { margin-left: -16px; overflow: visible !important; }
/* A value that is a node, with the tag said after it, keeps to the values' column: what does not fit ends in an ellipsis
   instead of being cut at the edge of the node. */
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] { min-width: 0; max-width: calc(100% + 16px); }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] :is(.jtrigger, .select-item) { min-width: 0; max-width: 100% !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] a.page-ref { overflow: hidden; text-overflow: ellipsis; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] a.page-ref::before { content: ""; display: inline-block; width: 12px; height: 14px; margin: 0 4px 0 0; vertical-align: -2px; background: var(--lk-off); -webkit-mask: ${ARROW} center / 8px 11px no-repeat; mask: ${ARROW} center / 8px 11px no-repeat; transition: transform .14s ease; cursor: pointer; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] a.page-ref:hover::before { background: var(--lk-text); }
/* A node dug into: its name already stands on the value's line, so only what it holds is shown under it. */
.lk-dugopen > .lk-editor .is-page-title-row { display: none !important; }
.lk-dugopen > .lk-editor .ls-page-title, .lk-dugopen > .lk-editor .ls-page-title .ls-block > div { margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
.lk-editor ${PAGE} { padding: 0 !important; margin: 0 !important; }   /* Logseq pads it in the main page and insets it in the sidebar */
.lk-editor ${PAGE} > .page-inner { display: block !important; margin: 0 !important; }
.lk-editor ${PAGE} > :not(.page-inner) { display: none !important; }
.lk-editor .breadcrumb { display: none !important; }
.lk-editor:not(:has(.ls-page-title)) .ls-page-blocks .blocks-list-wrap[data-level="0"] > .ls-block > .block-main-container > .block-control-wrap > .block-control { visibility: hidden !important; pointer-events: none !important; }
.lk-editor .ls-page-blocks { margin-top: 0 !important; min-height: 0 !important; }
/* A page opened from a line (Search, Relations, Todo): its name is one line, its bullets come straight under it, one step in,
   their dots clear of the line down the opened node's side; a bullet being typed keeps the size of the words around it (the
   owner's picture of "Doctors" opened in Search, 26 November 2026). */
.lk-editor .ls-page-title .is-page-title-row { min-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
.lk-editor .ls-page-title .ls-block-right:not(:has(* > *)) { display: none !important; }   /* Logseq's empty place for the page's tags, which stood as a blank second line */
.lk-row > .lk-open > .lk-editor:has(.ls-page-title) .ls-page-blocks { margin-left: 12px !important; }
.lk-editor textarea { font-size: inherit !important; }
.lk-editor .ls-page-blocks:has(.ls-block[blockid]) .block-add-button { display: none !important; }   /* Logseq's dot for a first bullet, only where there is none yet */
.lk-editor .ls-page-title-container, .lk-editor .ls-page-title-container :is(h1, .block-title-wrap, .ls-page-title-actions) { font-size: inherit !important; line-height: 24px !important; font-weight: 600 !important; min-height: 0 !important; margin: 0 !important; }
.lk-editor .ls-page-properties { margin: 2px 0 0 24px !important; }   /* a page's rows start where its title's words do */
.lk-dugopen > .lk-editor .ls-page-properties { margin: 0 !important; }
.lk-dugopen > .lk-editor .ls-page-blocks:not(:has(.ls-block[blockid])) { display: none !important; }   /* no empty line at every level: a first bullet is added in the node opened from a row */
.lk-editor ${PAGE} > .page-inner { margin-bottom: 0 !important; gap: 0 !important; }
.lk-editor .is-page-title-row > .block-control-wrap > .block-control { visibility: hidden !important; pointer-events: none !important; }   /* the row's own arrow closes it: one arrow, not two */
.lk-editor .ls-page-title-actions { display: none !important; }
.lk-editor .is-page-title-row .ls-block-right { height: 24px !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; align-self: flex-start !important; }
.lk-editor .is-page-title-row .ls-block-right .block-tags { margin: 0 !important; padding-block: 0 !important; }
.lk-editor .is-page-title-row .block-row { min-height: 0 !important; align-items: flex-start !important; }
.lk-editor .is-page-title-row { margin-left: 0 !important; gap: 0 !important; }   /* the title's words stand where the line's words stood */
.lk-editor:has(.ls-page-title) { margin-left: -2px; }
.lk-dugopen > .lk-editor:has(.ls-page-title) { margin-left: 0; }
/* A page opened from a line of Relations: its name stays where the line's words stood (26 November 2026). */
.lk-list[data-viewed] > .lk-rows > .lk-row > .lk-open > .lk-editor:has(.ls-page-title) { margin-left: -6px; }
.lk-editor .ls-page-icon { align-self: flex-start !important; height: 24px !important; padding: 0 !important; margin: 0 !important; align-items: center !important; }
.lk-editor .ls-page-icon button { width: 20px !important; height: 24px !important; min-width: 0 !important; padding: 0 !important; }
.lk-editor .ls-page-icon :is(.ui__icon, svg) { width: 18px !important; height: 18px !important; font-size: 18px !important; }
.lk-editor .lsp-hook-ui-slot { display: none !important; }
/* The page's Relations stand inside Logseq's title block, whose own rules for a title's tags, properties and bullets would reach
   a node opened there: they are put back to a plain bullet's. */
.ls-page-title .lk-editor :is(.positioned-properties, .time-spent) { margin-top: 0 !important; }
.ls-page-title .lk-editor .block-tags { margin-top: 0 !important; min-height: 0 !important; }
.ls-page-title .lk-editor .block-main-container { gap: 4px !important; }
.ls-page-title .lk-editor .ls-block-right { margin-left: 0 !important; }
/* In a list of Relations the row's own dot stays where it was while the node is open, before its day: Logseq's bullet for the
   node's first line is left out there. */
.lk-list[data-viewed] > .lk-rows > .lk-row[data-open="1"] > .lk-open > .lk-editor:not(:has(.ls-page-title)) .ls-page-blocks .blocks-list-wrap[data-level="0"] > .ls-block > .block-main-container > .block-control-wrap .bullet-container { visibility: hidden !important; }`;

/* The marks, on what Logseq itself draws. A property's name, a link to a node and a tag are written the one way the plugin
   writes them, on a page and in the sidebar (the owner, 25 November 2026: one way for each, in every place; no small picture
   before a property's name; an empty property is its name, fainter). A link and a tag are written so inside a node opened in
   place too; how that node's rows are laid out, and its property names, is OPENED's, above. Looks only: nothing of Logseq's
   is moved or taken away. */
const IN = ':is(#main-content-container, #right-sidebar, .lk-editor)', OWN = ':is(#main-content-container, #right-sidebar)';
const MARKS = `
/* A task says it is one by its status circle: the word Task after it is left out (the owner, 26 November 2026). */
${IN} .ls-block:has(> .block-main-container .block-left.positioned-properties [class*="ls-icon-"]) > .block-main-container .block-tag:has(a.tag[data-ref="task"]) { display: none !important; }
${IN} .ls-block:has(> .block-main-container .block-left.positioned-properties [class*="ls-icon-"]) > .block-main-container .ls-block-right:has(a.tag[data-ref="task"]):not(:has(a.tag:not([data-ref="task"]))) { display: none !important; }   /* no empty line where it stood */
${OWN} a.property-k:not(.lk-editor a) { font-family: var(--lk-prop-face) !important; font-weight: var(--lk-prop-weight) !important; font-size: var(--lk-prop-size) !important; letter-spacing: -.01em; color: var(--lk-quiet) !important; }
${OWN} .property-key-inner > .property-icon { display: none !important; }
${IN} :is(.property-panel-row-empty, .bottom-property-pill:has(.empty-value)) a.property-k { color: var(--lk-off) !important; }
${OWN} .empty-value :is(.empty-text-btn, .ui__button):not(.lk-editor *) { opacity: 0; }
${OWN} :is(.property-pair, .bottom-property-pill):is(:hover, :focus-within) .empty-value :is(.empty-text-btn, .ui__button):not(.lk-editor *) { opacity: .5; }
${IN} a.page-ref { color: var(--lk-text) !important; text-decoration: underline !important; text-decoration-color: var(--lk-link) !important; text-decoration-thickness: var(--lk-link-width) !important; text-underline-offset: 3px; }
${IN} a.page-ref:hover { text-decoration-color: currentColor !important; }
${IN} .page-reference > .bracket { display: none !important; }
${IN} a.tag { font-family: var(--lk-tag-face) !important; font-size: var(--lk-tag-size); color: var(--lk-quiet) !important; text-decoration: none !important; }
${IN} a.tag:hover { color: var(--lk-text) !important; }
${IN} .block-tag a.hash-symbol { opacity: 0; }
${IN} .block-tag:hover a.hash-symbol { opacity: .6; }
${IN} a.external-link { color: var(--lk-text) !important; text-decoration: underline !important; text-decoration-color: var(--lk-link) !important; text-decoration-thickness: var(--lk-link-width) !important; text-underline-offset: 3px; }   /* a web link is a link: the ink, underlined, never Logseq's blue */
${IN} a.external-link:hover { text-decoration-color: currentColor !important; }
${OWN} .ls-page-properties:not(.lk-editor *) { margin-left: 10px; }   /* a page's property names and Add property on the edge its title and its bullets stand on */
${OWN} .property-pair .property-panel-bullet:not(.lk-editor *), ${OWN} .property-pair .property-block-container .block-control-wrap:not(.lk-editor *) { display: none !important; }   /* no bullet before a value: the row says it is one */
`;
/* On a page, a link to that same page is its words alone: it leads nowhere (the owner's marked page, 26 November 2026). */
function here() {
  const doc = host(), el = doc.createElement('style'); el.id = 'lk-here'; doc.head.appendChild(el);
  const quote = text => String(text).replace(/["\\]/g, '\\$&');
  const set = async () => {
    try {
      const page = await logseq.Editor.getCurrentPage(), names = new Set();
      if (page && !page.page) for (const name of [page.title, page.name, page.originalName]) if (name) names.add(String(name).toLowerCase());
      const plain = `{ text-decoration: none !important; }`;
      el.textContent = [...[...names].flatMap(name => [`#main-content-container a.page-ref[data-ref="${quote(name)}"]:not(.lk-editor *) ${plain}`, `#main-content-container a.lk-node[data-to="${quote(name)}" i]:not(.lk-editor *) ${plain}`]),
        ...(page && !page.page && page.uuid ? [`#main-content-container a.lk-node[data-to="${quote(String(page.uuid).toLowerCase())}"]:not(.lk-editor *) ${plain}`] : [])].join('\n');
    } catch (error) { el.textContent = ''; }
  };
  set();
  const off = logseq.App.onRouteChanged(() => set());
  return () => { try { off?.(); } catch (error) { /* gone with the plugin */ } el.remove(); };
}
/* Logseq's own screens, quieted, as the plugin drew them before 0.9 (the owner, 25 November 2026, choosing each from a
   picture of both). One sheet for each thing, so each can be switched off on its own. Nothing here is inside an opened node:
   those rows are laid out by OPENED. */
const AREA = ':is(#main-content-container, #right-sidebar)', OUT = ':not(.lk-editor *)';
const PLAIN_SIDE = '#right-sidebar:not([data-lk-split]) .sidebar-item.item-type-page';   // a page in the sidebar, not one shown as the right half
const PILLS = `${AREA} .ls-block .positioned-properties.block-below`;
const CALM = {
  /* What floats over Logseq's own screens (its menus, pop-ups, lists to choose from, the question before a delete, its windows
     and settings) on the plugin's own surface, as before the rebuild (the owner chose the old floating surface and window back,
     26 November 2026): the Mac's glass with a 10-point corner, a hair-thin edge and one shadow; lines of the menu's size; keys
     as faint marks; the question small and in the middle, as the Mac asks; a window on the page's paper with a hairline. */
  floats: `
.ui__dialog-content:has(.cp__cmdk__modal), .cp__cmdk__modal { background: var(--lk-paper) !important; }
.ui__dialog-content:has(.cp__cmdk__modal) { overflow: hidden; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__popover-content, .ui__select-content, .ui__multi-select-content) { background: var(--lk-glass) !important; -webkit-backdrop-filter: var(--lk-glass-blur) !important; backdrop-filter: var(--lk-glass-blur) !important; color: var(--lk-text) !important; border: .5px solid var(--lk-line) !important; border-radius: 10px !important; box-shadow: var(--lk-float-shadow) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__select-content) { padding: 5px !important; }
:is(.ui__dropdown-menu-item, .ui__dropdown-menu-sub-trigger, .ui__select-item, .ui__context-menu-content [role=menuitem]) { font-weight: 400 !important; font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; padding: 3px 9px 4px !important; box-sizing: border-box !important; height: var(--lk-line-h) !important; min-height: 0 !important; border-radius: 6px !important; color: var(--lk-text) !important; gap: 8px !important; }
.ui__dropdown-menu-sub-trigger[data-open]:not([data-highlighted], :hover) { background: var(--lk-wash) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) :is(.ui__icon, i.ti) { font-size: 14px !important; width: 14px; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) svg.tabler-icon { width: 14px !important; height: 14px !important; stroke-width: 1.4 !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content) :is(.ui__icon, i.ti) { color: var(--lk-quiet) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content, .ui__select-content) :focus-visible { outline: none !important; box-shadow: none !important; }
:is(.ui__dropdown-menu-separator, .ui__context-menu-separator, .ui__dropdown-menu-content [role=separator], .ui__context-menu-content [role=separator]) { background: var(--lk-hair) !important; height: 1px !important; margin: 5px 9px !important; }
:is(.ui__dropdown-menu-label, .ui__context-menu-label) { font-weight: 400 !important; color: var(--lk-quiet) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) :is(.shui-shortcut-combo, .shui-shortcut-separate, .shui-shortcut-key) { background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; min-width: 0 !important; font: inherit !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-combo { gap: 1px !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-key { color: var(--lk-off) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-separator { display: none !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-key { display: inline-flex !important; align-items: center; height: var(--lk-line-lead) !important; line-height: 18px !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key { color: transparent !important; position: relative; width: 16px; overflow: hidden; white-space: nowrap; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] > span:has(.shui-shortcut-key) { display: flex !important; align-items: center; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key::after { content: "⌫"; position: absolute; inset: 0; text-align: right; color: var(--lk-off); }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem]:is([data-highlighted], :hover) :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key::after { color: var(--lk-paper); }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [data-shortcut-binding$="+click"] .shui-shortcut-key:last-child { text-transform: lowercase; margin-left: 3px; }
.ui__popover-content .cp__select { font-size: var(--lk-line-size) !important; }
.ui__popover-content .cp__select .input-wrap { background: transparent !important; padding: 4px 5px 0 !important; }
.ui__popover-content .cp__select-input { background: transparent !important; font-size: var(--lk-line-size) !important; padding: 4px 9px !important; border: 0 !important; box-shadow: inset 0 -1px 0 var(--lk-hair) !important; border-radius: 0 !important; }
.ui__popover-content .cp__select .menu-link-wrap { padding: 0 5px !important; }
.ui__popover-content .cp__select .menu-link { display: flex !important; padding: 3px 9px 4px !important; border-radius: 6px !important; }
.ui__popover-content .cp__select .menu-link, .ui__popover-content .cp__select .menu-link * { font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; }
.ui__popover-content .cp__select .menu-link svg { width: 14px !important; height: 14px !important; }
.ui__alert-dialog-content { width: 260px !important; max-width: 260px !important; padding: 18px 14px 14px !important; gap: 4px !important; text-align: center !important; background: var(--lk-glass) !important; -webkit-backdrop-filter: var(--lk-glass-blur) !important; backdrop-filter: var(--lk-glass-blur) !important; border: .5px solid var(--lk-line) !important; border-radius: 14px !important; box-shadow: var(--lk-float-shadow) !important; }
.ui__alert-dialog-header { text-align: center !important; }
.ui__alert-dialog-title { font-size: 13px !important; line-height: 18px !important; font-weight: 600 !important; }
.ui__alert-dialog-title > span { flex-direction: column !important; gap: 6px !important; }
.ui__alert-dialog-title .ui__icon svg { width: 30px !important; height: 30px !important; stroke-width: 1.2 !important; color: var(--lk-quiet) !important; }
.ui__alert-dialog-main-content, .ui__alert-dialog-main-content p { font-size: 12px !important; opacity: 1 !important; color: var(--lk-quiet) !important; }
.ui__alert-dialog-main-content p { margin: 0 0 8px !important; }
.ui__alert-dialog-footer { display: block !important; }
.ui__alert-dialog-footer > span:first-child:empty { display: none !important; }
.ui__alert-dialog-footer > span:last-child { display: flex !important; flex-direction: column-reverse !important; gap: 6px !important; width: 100% !important; }
.ui__alert-dialog-footer .ui__button { width: 100% !important; height: 28px !important; border-radius: 7px !important; border: 0 !important; font-size: 13px !important; font-weight: 500 !important; box-shadow: none !important; }
.ui__alert-dialog-footer .ui__button.as-outline { background: var(--lk-wash) !important; color: var(--lk-text) !important; }
.ui__alert-dialog-footer .ui__button.as-solid { background: var(--lk-text) !important; color: var(--lk-paper) !important; }
.ui__alert-dialog-overlay { background: rgba(0,0,0,.14) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
.ui__dialog-content { background: var(--lk-paper) !important; border: 1px solid var(--lk-hair) !important; border-radius: 8px !important; box-shadow: 0 10px 30px rgba(0,0,0,.14) !important; }
.cp__settings-inner > aside { background: transparent !important; box-shadow: inset -1px 0 0 var(--lk-hair) !important; }
.cp__settings-inner .settings-menu-item { background: transparent !important; border-radius: 6px; }
.cp__settings-inner .settings-menu-item:is(.active, :hover) { background: var(--lk-wash) !important; }
.cp__settings-inner .settings-menu-link strong { font-weight: 400 !important; }
.cp__settings-inner .settings-menu-link .ui__icon { color: var(--lk-quiet) !important; }
.cp__settings-inner .cp__settings-modal-title { font-size: 20px !important; font-weight: 600 !important; }
.cp__settings-inner .cp__settings-category-title { font-weight: 600 !important; }
.cp__settings-inner .panel-wrap .ui__button[class~="bg-primary/90"] { background: color-mix(in srgb, var(--lk-text) 9%, transparent) !important; color: var(--lk-text) !important; box-shadow: none !important; border: 0 !important; border-radius: 6px !important; font-weight: 500 !important; }
.cp__settings-inner .panel-wrap .ui__button[class~="bg-primary/90"]:hover { background: color-mix(in srgb, var(--lk-text) 15%, transparent) !important; }
.cp__settings-inner .panel-wrap :is(select, [role=combobox], input:not([type=checkbox]):not([type=radio])) { background: transparent !important; border-color: var(--lk-hair) !important; box-shadow: none !important; }
.ui__popover-content .cp__select .menu-link { box-sizing: border-box !important; min-height: var(--lk-line-h) !important; align-items: center !important; }
.ui__popover-content .cp__select .menu-link .pt-1 { padding-top: 0 !important; display: inline-flex !important; align-items: center !important; }
.ui__popover-content .cp__select #ui__ac-inner > .menu-link-wrap { padding-left: calc(5px + var(--st-pad, 0px)) !important; }`,
  /* The top bar: Ontology, Todo, Logseq's own menu and the sidebar button. Home, back, forward and the plugins button go
     (Journals heads the left sidebar, Cmd [ and Cmd ] go back and forward, Plugins is in the menu). Icons a little finer. */
  bar: `
#head .r > .flex.items-center > button:has(.ls-icon-home), #head .r .toolbar-plugins-manager, #head .r .nav-left, #head .r .nav-right { display: none !important; }
#head svg.tabler-icon, #head .ui__icon svg { stroke-width: 1.75 !important; }
#head :is(button, a.button) { opacity: .7 !important; }
#head :is(button, a.button):hover { opacity: 1 !important; }`,
  /* A page's title a step smaller and tighter, so it heads the page without shouting over it. */
  title: `
${AREA} .ls-page-title-container${OUT} { font-size: 30px !important; line-height: 1.3 !important; }
${AREA} .ls-page-title-container${OUT} .block-content-or-editor-inner { font-size: inherit !important; line-height: inherit !important; }
${AREA} .ls-page-title-container${OUT} :is(.block-title-wrap, .editor-inner textarea) { font-weight: 600 !important; letter-spacing: -.015em; }
/* The plugin's own pages (Ontology, Todo, the Recycle list) title the same way as Logseq's. */
.lk-page > .lk-page-title { font-size: 30px; line-height: 1.3; letter-spacing: -.015em; }
#journals .journal-item { border-bottom-color: transparent !important; }`,
  /* "Add property" under a page's properties: quiet words, a little apart from the rows, not a filled press. */
  add: `
${AREA} .ls-new-property${OUT} { margin-top: 10px !important; }
${AREA} .ls-new-property${OUT} button { background: none !important; box-shadow: none !important; border: 0 !important; color: var(--lk-quiet) !important; font-weight: 400 !important; padding-left: 0 !important; }
${AREA} .ls-new-property${OUT} button:hover { color: var(--lk-text) !important; }`,
  /* A bullet's properties under its words: one quiet line of names and values, wrapping, with space between them and no
     outline; the one being written has a capsule round it. Every one that holds something shows, so Logseq's Expand press
     goes; an empty one stays out of the line, as before 0.9. */
  pills: `
${PILLS}${OUT}, ${PILLS}${OUT} .bottom-properties-row { height: auto !important; max-height: none !important; overflow: visible !important; }
${PILLS}${OUT} .bottom-properties-row > :not(.bottom-properties-pills-strip) { display: none !important; }
${PILLS}${OUT} .bottom-properties-pills-strip { flex-wrap: wrap !important; gap: 0 24px !important; max-width: none !important; overflow: visible !important; }
${PILLS}${OUT} .bottom-property-pill { background: transparent !important; padding-inline: 0 !important; overflow: visible !important; }
${PILLS}${OUT} .bottom-property-pill:not(:focus-within)::after { box-shadow: none !important; border: 0 !important; }
${PILLS}${OUT} .bottom-property-pill:focus-within::after { inset: 1px -6px !important; border-radius: var(--lk-corner-round) !important; box-shadow: inset 0 0 0 1px var(--lk-line) !important; }
${PILLS}${OUT} .bottom-property-pill > div:first-child { color: var(--lk-quiet) !important; }
${PILLS}${OUT} .bottom-property-pill:has(.empty-value):not(:focus-within) { display: none !important; }
${PILLS}${OUT} .bottom-property-pill input.ui__input { field-sizing: content; width: auto !important; min-width: 3ch; max-width: 40ch; height: 24px !important; padding: 0 2px !important; border: 0 !important; box-shadow: none !important; outline: none !important; background: transparent !important; }
${AREA} .ls-block .bottom-property-edit-icon${OUT} { display: none !important; }`,
  /* The right sidebar, as it was before 0.9 (the owner, 25 November 2026: "the sidebar is not correctlt styled like pre 0.9
     version"; "you can keep same content of section in sidebar but remove asthetic stuff like shadow spacing lines, etc").
     What a section holds is Logseq's own, untouched. What goes is the dress: Logseq's row on top (Contents, Page graph, Help),
     the grey ground, each section's card (its shadow, its rounded corners, the band behind its head) and the room Logseq
     keeps round it. The sidebar stands on the page's own ground; a hairline parts it from the page (still Logseq's handle
     for its width: seven pixels to catch, the line darker under the pointer), and a thin line parts one section from the next. */
  side: `
#right-sidebar .cp__right-sidebar-topbar { display: none !important; }
#right-sidebar, #right-sidebar .cp__right-sidebar-inner, #right-sidebar .cp__right-sidebar-scrollable { background-color: transparent !important; }   /* the page's own ground shows through: the very same, not one a shade off */
#right-sidebar .sidebar-item-list > .sidebar-item, #right-sidebar .sidebar-item-list > .sidebar-item .sidebar-item-header { box-shadow: none !important; background: transparent !important; border-radius: 0 !important; }
#right-sidebar .sidebar-item-list > .sidebar-item .sidebar-item-header { box-sizing: border-box; min-height: 32px; }
#right-sidebar .sidebar-item-list > .sidebar-item ~ .sidebar-item { border-top: 1px solid var(--lk-line) !important; margin-top: 10px; padding-top: 6px; }
#right-sidebar .sidebar-item-list { padding-top: 8px !important; padding-bottom: 56px !important; }
#right-sidebar .resizer { left: -3px !important; width: 7px !important; background: none !important; }
#right-sidebar .resizer::after { content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px; background: var(--lk-hair); transition: background-color .12s ease; }
#right-sidebar .resizer:is(:hover, :active, :focus)::after { background: var(--lk-line); }
/* A page in it: its name reads as the link it is; "Open properties" is pressed for the person and left out; no room is held
   under its bullets (Logseq keeps 60px for them even when there is one). */
${SIDE_PAGE} .sidebar-item-header .page-title > span:last-child { cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
${SIDE_PAGE} .sidebar-item-header .page-title > span:last-child:hover { text-decoration-color: currentColor; }
${SIDE_PAGE} .ls-sidebar-page-properties > div:first-child:has(> button:only-child) { display: none !important; }
${SIDE_PAGE} .sidebar-panel-content .ls-page-blocks { min-height: 0 !important; }
${SIDE_PAGE} .sidebar-panel-content > .cp__page-inner-wrap { margin-bottom: 8px !important; }
${SIDE_PAGE} .ls-sidebar-page-properties > hr { display: none !important; }
/* One edge in the sidebar: the words of every line of a page start where its properties' names start, and the marks (a fold
   arrow, a list's mark, the + of "Add property", a value's bullet) stand in the gutter before that edge (the owner, 25
   November 2026: "I see a lot of problems with alignment of elements"). */
${PLAIN_SIDE} .lk-relwrap { padding-left: 0; margin-left: -2px; }
${PLAIN_SIDE} .ls-sidebar-page-properties .ls-new-property { margin-left: -20px; }
/* Where the sidebar is narrow a property has its name on one line and its values under it, as before 0.9: beside a name
   150 wide a value would be broken into pieces. Wider, a property reads as it does on the page. */
${SIDE_PAGE} .sidebar-panel-content { container: lk-side / inline-size; }
@container lk-side (max-width: 420px) {
  ${SIDE_PAGE} .ls-sidebar-page-properties .property-pair.property-panel-row { display: block !important; padding-right: 0 !important; }
  ${SIDE_PAGE} .ls-sidebar-page-properties .property-key-panel { width: auto !important; min-width: 0 !important; }
  ${PLAIN_SIDE} .ls-sidebar-page-properties .property-value-container { margin-left: -22px; }
  ${PLAIN_SIDE} .ls-sidebar-page-properties .properties-panel { overflow: visible !important; }   /* Logseq clips the panel at its edge, which would hide a value's bullet in the gutter */
}`,
  /* Logseq's tables: the page's own ground under the column names, no lines between columns, a hairline under each row, the
     wash under the pointer; the words in the plugin's greys; a link as a link is everywhere; what each tool does said in a
     word beside its icon; the view's name a word with a short bar under the one in force. */
  table: `
${AREA} .ls-table-header { background: var(--lk-paper) !important; border-top-color: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-header-cell, ${AREA} .ls-table-rows .border-r { border-right-color: transparent !important; }
${AREA} .ls-table-header-cell { font-weight: 400 !important; font-family: var(--lk-prop-face); }
${AREA} .ls-table-header-cell button { color: var(--lk-quiet) !important; font-size: var(--lk-small); }
${AREA} .ls-table-header-cell:has(.ls-icon-arrow-up, .ls-icon-arrow-down) button { color: var(--lk-text) !important; }
${AREA} .ls-table-row { background: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-row:hover { background: var(--lk-wash) !important; }
${AREA} :is(.ls-table-row, .ls-table-header) .sticky-columns { background: var(--lk-paper) !important; }
${AREA} .ls-table-row:hover .sticky-columns { background: color-mix(in srgb, var(--lk-text) 7%, var(--lk-paper)) !important; }
${AREA} .ls-table :is(.text-muted-foreground, .text-gray-500) { color: var(--lk-quiet) !important; }
${AREA} .ls-table-cell .page-reference > .bracket { display: none; }
${AREA} .table-block-title > .absolute button { background: transparent !important; border-radius: var(--lk-corner-round) !important; }
${AREA} .table-block-title > .absolute button:hover { background: var(--lk-wash) !important; }
${AREA} .table-block-title > .absolute button:first-child { width: auto !important; padding: 0 6px !important; font-size: var(--lk-small); font-weight: 400; color: var(--lk-quiet); }
${AREA} .table-block-title > .absolute button:first-child svg { display: none; }
${AREA} .table-block-title > .absolute button:first-child::before { content: "Open"; }
${AREA} .ls-view-head .views button[data-view-tab-id] { position: relative; height: auto !important; padding: 3px 8px 6px !important; font-weight: 400 !important; color: var(--lk-quiet) !important; }
${AREA} .ls-view-head .views button[data-view-tab-id]:not(.text-muted-foreground) { color: var(--lk-text) !important; }
${AREA} .ls-view-head .views button[data-view-tab-id]:not(.text-muted-foreground)::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: 0; height: 1px; background: currentColor; }
${AREA} .ls-view-head .views button[data-view-tab-id] > :is(.ls-icon-color-wrap, .text-xs) { display: none !important; }
${AREA} .ls-view-head .views button[title="Add new view"] { width: auto !important; height: auto !important; padding: 3px 8px 6px !important; opacity: 1 !important; color: var(--lk-quiet) !important; font-size: var(--lk-small); font-weight: 400; }
${AREA} .ls-view-head .views button[title="Add new view"] > :is(.ui__icon, svg) { display: none !important; }
${AREA} .ls-view-head .views button[title="Add new view"]::after { content: "+ New view"; }
${AREA} .ls-view-head .view-actions :is(button.as-ghost, .view-action-type .select-item) { width: auto !important; height: 24px !important; padding: 0 6px !important; gap: 4px; border-radius: var(--lk-corner-round) !important; font-size: var(--lk-small); font-weight: 400; color: var(--lk-text) !important; opacity: 1 !important; }
${AREA} .ls-view-head .view-actions :is(button.as-ghost, .view-action-type .select-item):hover { background: var(--lk-wash) !important; }
${AREA} .ls-view-head .view-actions :is(.ui__icon, svg) { width: 15px; height: 15px; }
${AREA} .ls-view-head .view-actions { gap: 2px !important; flex-wrap: nowrap; }
${AREA} .ls-view-head .view-action-type, ${AREA} .ls-view-head .view-action-type :is(.property-value-inner, .jtrigger) { width: auto !important; flex: none !important; }
${AREA} .ls-view-head .view-action-type .select-item { display: inline-flex; align-items: center; white-space: nowrap; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-arrows-up-down)::after { content: "Sort"; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-filter)::after { content: "Filter"; }
${AREA} .ls-view-head .view-action-search > div > button:first-child::after { content: "Find"; }
${AREA} .ls-view-head .view-action-search:has(input) > div > button:first-child::after { content: none; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-table) .select-item::after { content: "Table"; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-list) .select-item::after { content: "List"; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-layout-grid) .select-item::after { content: "Gallery"; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-plus)::after { content: "New"; }
${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `${AREA} .ls-table[data-lk-less="${n}"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(${n})`).join(', ')} { display: none !important; }`,
  /* The left sidebar as words alone (the owner, on "A Leaner Logseq", 26 November 2026): no picture before Journals, Pages, a
     favourite or a recent page; no section words (Navigations, Favorites, Recent), a gap between the groups instead; the graph's
     name alone, its up-down mark under the pointer. The words stand on one edge. */
  left: `
.left-sidebar-inner :is(.sidebar-navigations .item, .recent-item, .favorite-item) :is(.ui__icon, svg, .page-icon) { display: none !important; }
.left-sidebar-inner .sidebar-navigations .item { margin-left: 2px !important; }
.left-sidebar-inner :is(.recent-item, .favorite-item) > a { margin-left: -4px !important; }
.left-sidebar-inner .sidebar-content-group > .sidebar-content-group-inner > .hd { display: none !important; }
.left-sidebar-inner .sidebar-content-group { margin-top: 14px; }
.left-sidebar-inner .cp__graphs-selector .thumb { display: none !important; }
.left-sidebar-inner .cp__graphs-selector .ls-icon-selector { opacity: 0; }
.left-sidebar-inner .cp__graphs-selector:hover .ls-icon-selector { opacity: 1; }
`,
  /* Logseq's search button at the top left (Cmd-K opens the plugin's Search) and its ? at the bottom right (the corner holds the
     plugin's commands there) go (the owner, on "A Leaner Logseq", 26 November 2026). */
  chrome: `
#head button:has(.ls-icon-search) { display: none !important; }
.cp__sidebar-help-btn { display: none !important; }
`,
};
/* On the main page the path of a page's tags stands at the right end of its title's line, where Logseq keeps a page's own
   tags; anywhere else (the sidebar, a page opened in a row) there is no such room and it stands under the title (pageHead).
   A press in it is not a press on the title, which would start writing there. */
function titleEnd(el, name) {
  if (!el.closest('#main-content-container') || el.closest('.lk-open')) return null;
  const row = el.querySelector(':scope > .page-inner .ls-page-title .ls-block > .is-page-title-row');
  const spot = row?.querySelector('.ls-block-right');
  if (!spot) return null;
  let end = [...spot.children].find(child => child.classList.contains(name));
  if (!end) { end = host().createElement('div'); end.className = name; for (const type of ['mousedown', 'pointerdown']) end.addEventListener(type, event => event.stopPropagation()); spot.append(end); }
  return end;
}
/* A page in the sidebar as before 0.9: its properties stand open, and its name in the section's head opens the page. Logseq
   draws the properties shut behind "Open properties", and shut again after the section is folded, opened or redrawn, so the
   press is made for the person whenever they are shut: never while one of Logseq's own lists or menus is open (a press would
   close the list under a bullet being written), and at most twice a minute for one section. Gives back what stops it. */
function sidePages(within = SIDE_PAGE) {
  const doc = host(), pressed = new WeakMap();
  const shut = box => box.children.length === 1 ? box.querySelector(':scope > div:first-child > button:only-child') : null;
  const off = watch(() => {
    if (busy()) return;
    const now = Date.now();
    for (const box of doc.querySelectorAll(`${within} .ls-sidebar-page-properties`)) {
      const press = shut(box), times = (pressed.get(box) || []).filter(at => now - at < 60000);
      if (!press || times.length >= 2) continue;
      pressed.set(box, [...times, now]); press.click();
    }
  });
  // Before Logseq takes the press to fold the section; the arrow beside the name still folds it.
  const onName = event => {
    const name = event.button ? null : event.target.closest?.(`${SIDE_PAGE} .sidebar-item-header .page-title > span:last-child`);
    const uuid = name && sidePage(name);
    if (!uuid) return;
    event.preventDefault(); event.stopPropagation(); open(uuid, event.shiftKey);
  };
  doc.addEventListener('click', onName, true);
  return () => { off(); doc.removeEventListener('click', onName, true); };
}
/* Two pages side by side: Logseq's right sidebar shown as the right half of the main area, so the page there is a whole page of
   Logseq's own, written in as anywhere. While it is shown so (data-lk-split on the sidebar, data-lk-split-item on the one
   section), the other sections wait unseen, the section has no head or card, a band as tall as Logseq's header stands over it,
   and the page's name stands over it as a title. Logseq's list of what its sidebar holds is changed only by Logseq's own calls
   and its own ×. Seen in Logseq 2.0.2: anything opened in the sidebar, there already or not, goes to the top of that list. */
const RIGHT = '#right-sidebar', HALF = `${RIGHT}[data-lk-split]`, MINE = `${HALF} [data-lk-split-item]`, PROPS = '.ls-sidebar-page-properties';
const SPLIT = `
${HALF} { width: var(--lk-split-w, 50vw) !important; min-width: 0 !important; max-width: none !important; transition: none !important; background: var(--lk-split-ground, var(--lk-paper)) !important; border-left: 0 !important; }
${HALF} .resizer { display: none !important; }
/* The band over the right page, the header's height: the page scrolls under it, so nothing runs behind the two icons. */
${HALF}${HALF} .cp__right-sidebar-topbar { display: block !important; position: sticky; top: 0; z-index: 8; height: 48px; min-height: 48px; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: var(--lk-split-ground, var(--lk-paper)) !important; }
${HALF} .cp__right-sidebar-topbar > * { visibility: hidden !important; }
${HALF} .cp__right-sidebar-inner, ${HALF} .cp__right-sidebar-scrollable { background: transparent !important; }
${HALF}${HALF} .cp__right-sidebar-topbar::before, ${HALF}${HALF} .cp__right-sidebar-topbar::after { display: none !important; }
/* Every other section and the places to drop one: unseen, by a rule weightier than any that shows a section. */
${HALF}${HALF} .sidebar-item-list > :not([data-lk-split-item]):not([data-lk-split-item]) { display: none !important; }
${HALF}${HALF} .sidebar-item-list { margin: 0 !important; padding: 0 0 96px !important; }
${HALF}${HALF} .sidebar-item-list > [data-lk-split-item] { display: flex !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
${MINE} .sidebar-item-header { display: none !important; }
${MINE} .sidebar-panel-content { display: block !important; padding: 0 clamp(16px, 4%, 40px) !important; }
${MINE} .sidebar-panel-content > .cp__page-inner-wrap { margin: 0 !important; }
/* The page's name over it, as a title stands on the main view (its size and weight are read from there). A tag's page has
   Logseq's # before its name and a property's its P, as on the main view. */
.lk-split-title { display: flex; align-items: flex-start; gap: 10px; margin: 32px 0 6px var(--lk-split-col, 20px); color: var(--lk-text); overflow-wrap: anywhere; }
.lk-split-title > span:last-child { min-width: 0; }
.lk-split-title > .lk-split-sign { flex: none; display: inline-flex; align-items: center; height: 1.3em; color: var(--lk-quiet); }
.lk-parent:not([hidden]) + .lk-split-title { margin-top: 0; }
${MINE} .sidebar-panel-content > .lk-split-title:first-child + * { margin-top: 0; }
${HALF} .sidebar-item-list .lk-parent:not([hidden]) { margin-top: 12px; margin-left: var(--lk-split-col, 20px); }
/* As on the main view: no rule under the properties; no empty "Add property" on a page with no property; and no list of a tag's
   or a property's own settings, which the main view keeps in Logseq's windows and in Ontology's lines. */
${MINE} ${PROPS} > hr, ${MINE} ${PROPS} > div:first-child:has(> button:only-child) { display: none !important; }   /* nor Logseq's press to hide them */
${MINE} ${PROPS}:not(:has(.property-pair)), ${HALF} [data-lk-split-item][data-lk-split-kind] ${PROPS} { display: none !important; }
${MINE} .sidebar-panel-content .page-inner > .-mb-8 { margin-bottom: 0 !important; }
${MINE} .sidebar-panel-content .ls-page-blocks { margin-top: 8px; }
/* The place under the title and the air round it, as where it stands under the main view's title in a window this narrow. */
${HALF} [data-lk-split-item] .lk-place { margin: 13px 0 14px calc(var(--lk-split-col, 0px) + 8px); }
/* In a narrow half a property's words stand under its name (as in a narrow sidebar), not drawn back past the edge and cut. */
@container lk-side (max-width: 420px) { ${MINE} ${PROPS} .property-block-container { margin-left: 0 !important; } }`;
const state = id => { try { return host().defaultView.logseq.api.get_state_from_store(id); } catch (error) { return null; } };
const sideList = () => (state('sidebar/blocks') || []).map(entry => entry?.[1]);
const sideOpen = () => !!state('ui/sidebar-open?');
const sections = () => [...host().querySelectorAll(`${RIGHT} .sidebar-item-list > .sidebar-item`)];
/* The section Logseq drew for an entry of its list, by its place there. Where the list and the screen disagree (Logseq has not
   drawn it yet, or cannot draw an entry further down), only the top one is sure. */
const sectionOf = id => {
  const list = sideList(), all = sections(), i = list.indexOf(id);
  if (i < 0) return null;
  return all.length === list.length ? all[i] : i === 0 && all[0]?.querySelector('.sidebar-panel-content') ? all[0] : null;
};
const body = id => sectionOf(id)?.querySelector('.sidebar-panel-content') || null;
/* fn() asked once a frame until it answers something, or until ms have passed. The first asking waits two frames: Logseq draws
   its sidebar a frame after its list changes, and until then a section's place in the list is not its place on screen. */
const until = (fn, ms) => new Promise(done => {
  const view = host().defaultView, end = Date.now() + ms;
  const next = then => view.requestAnimationFrame(() => view.setTimeout(then, 16));
  const look = () => { const got = fn(); if (got || Date.now() > end) return done(got || null); next(look); };
  next(() => next(look));
});
const unfolded = new WeakSet();
/* Draws the section of a node as the right half. head: { page, title, kind: 'tag' | 'property' | '' }. Put there again at every
   pass, since Logseq draws its sidebar anew when it likes. Answers whether the section stands on screen. */
function mark(id, head) {
  const doc = host(), side = doc.querySelector(RIGHT), item = sectionOf(id);
  if (!side) return false;
  if (!side.hasAttribute('data-lk-split')) side.setAttribute('data-lk-split', '');
  if (!item) return false;
  for (const other of side.querySelectorAll('[data-lk-split-item]')) if (other !== item) { other.removeAttribute('data-lk-split-item'); other.removeAttribute('data-lk-split-kind'); }
  for (const stray of side.querySelectorAll('.lk-split-title')) if (!item.contains(stray)) stray.remove();   // Logseq may hand a section's box to another node
  if (!item.hasAttribute('data-lk-split-item')) item.setAttribute('data-lk-split-item', '');
  if ((item.getAttribute('data-lk-split-kind') || '') !== head.kind) { if (head.kind) item.setAttribute('data-lk-split-kind', head.kind); else item.removeAttribute('data-lk-split-kind'); }
  // The right half on the very ground the main view stands on: the first ground painted under it, read as it is now.
  let ground = '';
  for (let at = doc.getElementById('main-content-container'); at && !ground; at = at.parentElement) { const painted = doc.defaultView.getComputedStyle(at).backgroundColor; if (!/^(rgba\(0, 0, 0, 0\)|transparent)$/.test(painted)) ground = painted; }
  if (side.style.getPropertyValue('--lk-split-ground') !== ground) side.style.setProperty('--lk-split-ground', ground);
  const panel = item.querySelector('.sidebar-panel-content');
  // A section left folded in the sidebar is unfolded, once: its head, which does that, is unseen here.
  if (panel && !panel.firstElementChild?.getBoundingClientRect().height && /(^| )hidden( |$)/.test(panel.className) && !unfolded.has(item)) { unfolded.add(item); item.querySelector('.sidebar-item-header button')?.click(); }
  if (!panel) return false;
  if (!head.page) { panel.querySelector('.lk-split-title')?.remove(); return true; }
  let title = panel.querySelector('.lk-split-title');
  // Where it stands: first in the page, after the tag's Parent line, which stands over the title on the main view too.
  const box = own(panel, PROPS)?.parentElement || panel;
  if (!title) { title = doc.createElement('div'); title.className = 'lk-split-title'; title.setAttribute('role', 'heading'); title.setAttribute('aria-level', '1'); }
  const parent = [...box.children].find(child => child.classList.contains('lk-parent')), after = parent ? parent.nextElementSibling : box.firstElementChild;
  if (title.parentElement !== box || (after !== title && !(parent && title.previousElementSibling === parent))) { if (parent) parent.after(title); else box.prepend(title); }
  const said = `${head.kind}\n${head.title}`;
  if (title.lkSaid !== said) {
    title.lkSaid = said;
    title.innerHTML = `${head.kind ? `<span class="lk-split-sign">${icon(head.kind === 'tag' ? 'hash' : 'letterP', 36)}</span>` : ''}<span>${G.esc(head.title)}</span>`;
  }
  const main = doc.querySelector('#main-content-container .ls-page-title-container .block-title-wrap'), like = main ? doc.defaultView.getComputedStyle(main) : null;
  const font = { fontSize: like?.fontSize || '30px', fontWeight: like?.fontWeight || '600', lineHeight: like?.lineHeight || '39px', letterSpacing: like?.letterSpacing || '-.45px', color: like?.color || '' };
  for (const [name, value] of Object.entries(font)) if (title.style[name] !== value) title.style[name] = value;
  // The title's left edge on the column of the page's bullets, as the main title stands over the main page's (once they are drawn).
  const dot = own(panel, '.ls-page-blocks .bullet-container'), at = dot?.getBoundingClientRect();
  if (at?.width) {
    const now = parseFloat(doc.defaultView.getComputedStyle(title).marginLeft) || 0, shift = at.left - title.getBoundingClientRect().left;
    if (Math.abs(shift) > 1) side.style.setProperty('--lk-split-col', `${Math.max(0, Math.round(now + shift))}px`);
  }
  return true;
}
function unmark() {
  const doc = host(), side = doc.querySelector(RIGHT);
  for (const el of doc.querySelectorAll('.lk-split-title')) el.remove();
  for (const el of doc.querySelectorAll('[data-lk-split-item]')) { el.removeAttribute('data-lk-split-item'); el.removeAttribute('data-lk-split-kind'); }
  side?.removeAttribute('data-lk-split'); side?.style.removeProperty('--lk-split-col'); side?.style.removeProperty('--lk-split-ground');
}
// Whether the right half really shows the page: its section marked, nothing hiding it, and something of Logseq's drawn in it.
function shown(id) {
  const item = sectionOf(id), panel = item?.querySelector('.sidebar-panel-content'), view = host().defaultView;
  if (!item?.hasAttribute('data-lk-split-item') || !panel || !panel.querySelector('.cp__page-inner-wrap, .ls-block')) return false;
  for (let el = panel; el && el !== host().body; el = el.parentElement) if (view.getComputedStyle(el).display === 'none') return false;
  return panel.getBoundingClientRect().height > 0;
}
// A node's section opened at the top of Logseq's sidebar, the sidebar shown.
async function put(uuid) { await logseq.Editor.openInRightSidebar(String(uuid)); if (!sideOpen()) logseq.App.setRightSidebarVisible(true); }
const setOpen = on => logseq.App.setRightSidebarVisible(!!on);
// An entry taken out of the sidebar by its own ×, once Logseq has drawn the list as it holds it. Answers whether it went.
async function takeOut(id) {
  if (!sideList().includes(id)) return true;
  const item = await until(() => sectionOf(id), 1500);
  const press = item?.querySelector('.item-actions .ls-icon-x')?.closest('button');
  if (!press) return false;
  press.click();
  return !!(await until(() => !sideList().includes(id), 1500));
}
/* The sidebar's list put back in an order it had. Opening what was already there moved it to the top, so what stood above it is
   opened again too, lowest first; nothing is added or taken out. Logseq's list can be changed only this way, so where it holds
   something that cannot be opened again (Contents, a graph, another plugin's piece) the order is left as it is. */
async function reorder(before = []) {
  const want = before.filter(id => sideList().includes(id)), now = sideList().filter(id => want.includes(id));
  let k = want.length;   // what already stands in the old order at the bottom stays
  for (let j = now.length - 1; k > 0 && j >= 0; j--) if (now[j] === want[k - 1]) k--;
  const move = want.slice(0, k).reverse(), OWN_ID = `:${logseq.baseInfo?.id}/`;
  if (!move.length) return;
  const ways = await Promise.all(move.map(async id => typeof id === 'number' ? (await logseq.Editor.getBlock(id).catch(() => null) || await logseq.Editor.getPage(id).catch(() => null))?.uuid
    : typeof id === 'string' && id.startsWith(OWN_ID) ? id.slice(OWN_ID.length) : null));
  if (ways.some(way => !way)) return;
  for (let i = 0; i < move.length; i++) { await logseq.Editor.openInRightSidebar(String(ways[i])); await until(() => sideList()[0] === move[i], 1500); }
}
const mainLeft = () => host().getElementById('main-content-container')?.getBoundingClientRect().left || 0;
// fn runs when the main view changes its width (the left sidebar opened or shut, the window). Gives back what stops it.
function mainSized(fn) {
  const main = host().getElementById('main-content-container'), Sized = host().defaultView.ResizeObserver;
  if (!main || !Sized) return () => {};
  const watcher = new Sized(() => fn()); watcher.observe(main);
  return () => watcher.disconnect();
}
// The properties of the page shown as the right half opened, where the quiet sidebar is not there to open them.
const openProps = () => sidePages(MINE);
// Logseq's own icons at the right of its header, as drawn: where they stand and how they look, for icons drawn the same.
function headIcons() {
  const doc = host(), head = doc.querySelector('#head > .r'), view = doc.defaultView;
  const all = [...(head?.querySelectorAll('button, a.button') || [])].filter(el => el.getBoundingClientRect().width);
  const last = all[all.length - 1];
  if (!last) return null;
  const r = last.getBoundingClientRect(), look = view.getComputedStyle(last), svg = last.querySelector('svg'), before = all[all.length - 2]?.getBoundingClientRect();
  return { top: r.top, edge: Math.max(0, head.getBoundingClientRect().right - r.right), gap: before ? Math.max(0, r.left - before.right) : 0,
    width: r.width, height: r.height, padding: look.padding, radius: look.borderRadius, color: look.color, opacity: look.opacity, stroke: svg ? view.getComputedStyle(svg).strokeWidth : '' };
}
// The uuid of the page (or bullet) the main view shows; '' where it shows none (the journals, a page of the plugin's own).
async function mainPage() {
  if (!/#\/page\//.test(host().defaultView.location.hash)) return '';
  const page = await logseq.Editor.getCurrentPage().catch(() => null);
  return String(page?.uuid || '').toLowerCase();
}
/* A link, or a line of the plugin's lists, pressed in the main view with Cmd (Ctrl away from the Mac) or with Shift. A Cmd-press
   the plugin takes is held back from its first event, so that Logseq does not also go to the page. */
const LINK = 'a.page-ref[data-uuid], a.tag[data-uuid], a[data-to], .lk-row > .lk-line';
function presses(fn) {
  const view = host().defaultView, types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  const mac = /Mac|iPhone|iPad/.test(view.navigator.platform);
  const on = event => {
    const cmd = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (event.button !== 0 || event.altKey || cmd === event.shiftKey) return;
    const at = event.target.closest?.(`${LINK}, button, input, .lk-url`);
    if (!at?.matches(LINK) || !at.closest('#main-content-container')) return;
    const to = at.getAttribute('data-uuid') || at.getAttribute('data-to') || at.parentElement.dataset.uuid;
    if (!to) return;
    if (!cmd) { if (event.type === 'click') fn(to, 'sidebar'); return; }
    if (fn(to, 'beside', event.type === 'click') !== true) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  for (const type of types) view.addEventListener(type, on, true);
  return () => { for (const type of types) view.removeEventListener(type, on, true); };
}
const beside = { mainSized, openProps, presses, list: sideList, isOpen: sideOpen, setOpen, put, mark, unmark, shown, body, takeOut, reorder, until, mainLeft, headIcons, mainPage };
G.touch = { menuItem, keep, copy, save, print, settled, pictures, queryShown, dragBand, graphChanged, beside, SPLIT, glide, sidePages, here, MARKS, CALM, titleEnd, lessColumn, valued, valueTags, watch, changed, writing, edit, digs, seat, names, plugins, tableBar, pages, pageFoot, pageUnder, pageHead, editor, open, openUrl, busy, left, tagList, key, command, commands, logseqCommands, keysRead, keepPlace, section, page, toolbar, icon, statusIcon, HIDES, HIDES_TAGS, OPENED, PAGE, foldedSpots, FOLDED };
})();
