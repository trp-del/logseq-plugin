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
     touch.key(combo, fn)     a key taken before Logseq sees it ('mod+k'), matched by its place on the keyboard; gives back what
                              lets it go. fn answers false to leave the press to Logseq after all
     touch.command(key, label, run)   a line in Logseq's command palette; touch.commands() the ones made, { name, label, run }
     touch.plugins           the plugins Logseq runs: those from a folder (reloaded) and those from its marketplace (updated
                              by Logseq's own updater)
     touch.section(key, title, draw, path)  a section of Logseq's right sidebar that is the plugin's own: Logseq hosts it and
                              hands draw(el) the element (draw gives back what clears it); path: its icon's line.
                              Answers { open(), off() }
     touch.page(key, title, draw)  a page of the plugin's own in Logseq's main view; draw(el) fills it. Answers { open(), at() }
     touch.toolbar(key, title, path, run)   a button in Logseq's toolbar, drawn as Logseq draws its own (path: the icon's line)
     touch.icon(id), touch.statusIcon(icon)   one of Logseq's own icons as markup
     touch.HIDES              the stylesheet that takes away Logseq's own lists where the plugin's stand */
(function () {
const G = window.PluginDoor;
const host = () => G.host();
const PAGE = '.cp__page-inner-wrap', PAGE_NODE = '.ls-page-title .ls-block[blockid]', FIRST_NODE = '.ls-page-blocks .ls-block[blockid]', FEED = '.journal-item';
const OURS = '.lk-open, .lk-rel';

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
  const block = el.querySelector(':scope > .page-inner .ls-page-title .ls-block') || (el.closest(SIDE_PAGE) ? el.querySelector(':scope > .page-inner .ls-sidebar-page-properties')?.parentElement : null);
  if (!block) return null;
  let under = [...block.children].find(child => child.classList.contains(name));
  if (!under) { under = host().createElement('div'); under.className = name; block.appendChild(under); }
  return under;
}
// Under the title's own row and above the page's properties, inside the title's block.
function pageHead(el, name, above = false) {
  const row = el.querySelector(':scope > .page-inner .ls-page-title .ls-block > .is-page-title-row');
  if (!row) {
    // A page in the sidebar: its name is in the section's head, so what stands by a title stands first in the page, above its properties.
    const props = el.closest(SIDE_PAGE) ? el.querySelector(':scope > .page-inner .ls-sidebar-page-properties') : null;
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
function key(combo, fn) {
  const parts = combo.toLowerCase().split('+'), code = parts.pop(), want = { mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') };
  const onKey = event => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.code !== (code.length === 1 ? 'Key' + code.toUpperCase() : code) || mod !== want.mod || event.shiftKey !== want.shift || event.altKey !== want.alt) return;
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
const commands = () => [...said.values()];
/* The plugins Logseq runs, each { id, title, version }. mine(): the ones it loads from a folder of the person's own. market():
   the ones it installed into its own plugin folder, from its marketplace or from a GitHub release. updates(list) asks Logseq's own updater (the one behind "Check for updates" on its
   plugins page) for each plugin of market() with a newer release on GitHub, one after another; Logseq downloads it and loads it
   again, as from its plugins page. It answers { updated: [{ title, version, to }], same, failed: [{ title, why }] }.
   reload(ids) has Logseq load the folder ones again, this plugin last: its own code ends there. What keep() is given outlives
   that reload for a minute, for took() to hand to the plugin's next run, once. */
const LOADED = 'lk.plugins-before', MARKET = 'https://raw.githubusercontent.com/logseq/marketplace/master/plugins.json';
// The GitHub repository a plugin names for itself ("owner/name"): Logseq's "Install plugin from GitHub release" keeps it as repo,
// and a plugin's package.json may give it as repository.
const ownRepo = options => {
  const said = options?.repo || options?.repository?.url || options?.repository || '';
  const found = typeof said === 'string' && said.match(/(?:github\.com[/:])?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  return found ? found[1] : '';
};
const listed = filter => {
  const core = host().defaultView.LSPluginCore;
  return core ? [...core.registeredPlugins.values()].filter(filter).map(one => ({ id: one.id, title: one.options?.title || one.options?.name || one.id, version: one.options?.version || '', repo: ownRepo(one.options) })) : [];
};
// Logseq's updater answers on its own channel; the answer for one plugin, or null after two minutes.
function asked(apis, pkg) {
  return new Promise(resolve => {
    let timer = null;
    const heard = (event, data) => {
      const said = data || event, payload = said?.payload || {};
      if (payload.id !== pkg.id) return;
      apis.removeListener('lsp-updates', heard); clearTimeout(timer); resolve(said);
    };
    apis.addListener('lsp-updates', heard);
    timer = setTimeout(() => { apis.removeListener('lsp-updates', heard); resolve(null); }, 120000);
    Promise.resolve(apis.doAction(['updateMarketPlugin', pkg, 'js-obj'])).catch(error => { apis.removeListener('lsp-updates', heard); clearTimeout(timer); resolve({ status: 'error', payload: { 'error-code': String(error?.message || error) } }); });
  });
}
const plugins = {
  mine: () => listed(one => !one.isInstalledInLocalDotRoot && !one.isWebPlugin),
  market: () => listed(one => one.isInstalledInLocalDotRoot && !one.isWebPlugin && !one.disabled),
  async updates(list) {
    const out = { updated: [], same: [], failed: [] }, apis = host().defaultView.apis;
    if (!list.length) return out;
    if (!apis?.doAction) { out.failed = list.map(one => ({ ...one, why: 'this Logseq lends plugins no updater' })); return out; }
    let packages;
    try { packages = (await (await fetch(MARKET)).json()).packages || []; } catch (error) { out.failed = list.map(one => ({ ...one, why: "Logseq's list of plugins could not be read" })); return out; }
    for (const one of list) {
      // One from Logseq's marketplace is updated from the repository its list names; one installed from its GitHub release, from its own.
      const listing = packages.find(pkg => pkg.id === one.id && pkg.repo) || (one.repo ? { id: one.id, repo: one.repo } : null);
      if (!listing) { out.failed.push({ ...one, why: 'it names no GitHub repository to update from' }); continue; }
      let latest = '';
      try { const answer = await fetch(`https://api.github.com/repos/${listing.repo}/releases/latest`); if (answer.ok) latest = (await answer.json()).tag_name || ''; } catch (error) { /* said below */ }
      if (!latest) { out.failed.push({ ...one, why: 'GitHub did not answer' }); continue; }
      if (!G.update.newer(latest, one.version)) { out.same.push(one); continue; }
      const said = await asked(apis, { ...listing, id: one.id, title: one.title, version: one.version, theme: Boolean(listing.theme), effect: Boolean(listing.effect) });
      const payload = said?.payload || {};
      if (said?.status === 'completed') out.updated.push({ ...one, to: payload['installed-version'] || payload.installedVersion || latest.replace(/^v/i, '') });
      else out.failed.push({ ...one, why: said ? String(payload['error-code'] || payload.errorCode || 'Logseq refused').replace(/^[\s:[]+|\]$/g, '') : 'no answer from Logseq' });
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
/* A task opened from its line keeps the line's start (the owner, 26 November 2026, fault 31-33): its status circle and words stay
   where they stood, no bullet before them and no priority mark added (the priority is set from the right-click, as on the line),
   the tag Task left out as the line leaves it out, and in a narrow place no line for "Show hidden properties". */
.lk-editor .ls-block > .block-main-container:has(.block-left.positioned-properties) > .block-control-wrap .bullet-container { visibility: hidden !important; }
.lk-editor .block-left.positioned-properties { margin-left: 2px !important; }
.lk-editor .block-left.positioned-properties :is(.ui__icon, .ui__icon svg) { width: 18px !important; height: 18px !important; }   /* the circle the line draws, 18 across, so the words stay where the line's stood */
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
.lk-row > .lk-open > .lk-editor .ls-page-blocks { margin-left: 12px !important; }
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
const PILLS = `${AREA} .ls-block .positioned-properties.block-below`;
const CALM = {
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
${SIDE_PAGE} .lk-relwrap { padding-left: 0; margin-left: -2px; }
${SIDE_PAGE} .ls-sidebar-page-properties .ls-new-property { margin-left: -20px; }
/* Where the sidebar is narrow a property has its name on one line and its values under it, as before 0.9: beside a name
   150 wide a value would be broken into pieces. Wider, a property reads as it does on the page. */
${SIDE_PAGE} .sidebar-panel-content { container: lk-side / inline-size; }
@container lk-side (max-width: 420px) {
  ${SIDE_PAGE} .ls-sidebar-page-properties .property-pair.property-panel-row { display: block !important; padding-right: 0 !important; }
  ${SIDE_PAGE} .ls-sidebar-page-properties .property-key-panel { width: auto !important; min-width: 0 !important; }
  ${SIDE_PAGE} .ls-sidebar-page-properties .property-value-container { margin-left: -22px; }
  ${SIDE_PAGE} .ls-sidebar-page-properties .properties-panel { overflow: visible !important; }   /* Logseq clips the panel at its edge, which would hide a value's bullet in the gutter */
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
function sidePages() {
  const doc = host(), pressed = new WeakMap();
  const shut = box => box.children.length === 1 ? box.querySelector(':scope > div:first-child > button:only-child') : null;
  const off = watch(() => {
    if (busy()) return;
    const now = Date.now();
    for (const box of doc.querySelectorAll(`${SIDE_PAGE} .ls-sidebar-page-properties`)) {
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
G.touch = { sidePages, here, MARKS, CALM, titleEnd, lessColumn, valued, valueTags, watch, changed, writing, edit, digs, seat, names, plugins, tableBar, pages, pageFoot, pageUnder, pageHead, editor, open, openUrl, busy, left, tagList, key, command, commands, section, page, toolbar, icon, statusIcon, HIDES, HIDES_TAGS, OPENED, PAGE };
})();
