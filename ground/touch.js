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
     touch.command(key, label, run)   a line in Logseq's command palette
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
  const at = editor.getBoundingClientRect(), r = row.getBoundingClientRect(), v = (link.closest('.property-value-container') || link).getBoundingClientRect();
  const kind = row.classList.contains('property-pair') ? '.property-pair' : '.bottom-property-pill', n = [...row.parentElement.children].indexOf(row) + 1;
  return { top: r.bottom - at.top, left: v.left - at.left, row: `${kind}:nth-child(${n}):has(a.page-ref[data-uuid="${uuid}"])`, mark: `:is(${ROW}) a.page-ref[data-uuid="${uuid}"]` };
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

function pages() {
  const out = [];
  for (const el of host().querySelectorAll(PAGE)) {
    if (el.closest(OURS)) continue;
    const uuid = (el.querySelector(PAGE_NODE) || (el.querySelector('.ls-page-title') ? null : el.querySelector(FIRST_NODE)))?.getAttribute('blockid');
    if (uuid) out.push({ el, uuid: uuid.toLowerCase(), feed: !!el.closest(FEED) });
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

// Under the title's own row and above the page's properties, inside the title's block.
function pageHead(el, name) {
  const row = el.querySelector(':scope > .page-inner .ls-page-title .ls-block > .is-page-title-row');
  if (!row) return null;
  let head = [...row.parentElement.children].find(child => child.classList.contains(name));
  if (!head) { head = host().createElement('div'); head.className = name; row.after(head); }
  return head;
}

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
// A command in Logseq's palette; with keys ('u p'), also a shortcut of Logseq's own kind, listed and changed in its settings.
const command = (name, label, run, keys) => logseq.App.registerCommandPalette(keys ? { key: name, label, keybinding: { binding: keys } } : { key: name, label }, run);
/* The plugins Logseq loads from a folder of the person's own, each { id, title, version }; the ones Logseq installed itself are
   Logseq's to update. reload(ids) has Logseq load them again from their folders, this plugin last: its own code ends there. What
   keep() is given outlives that reload for a minute, for took() to hand to the plugin's next run, once. */
const LOADED = 'lk.plugins-before';
const plugins = {
  mine() {
    const core = host().defaultView.LSPluginCore;
    return core ? [...core.registeredPlugins.values()].filter(one => !one.isInstalledInLocalDotRoot && !one.isWebPlugin).map(one => ({ id: one.id, title: one.options?.title || one.options?.name || one.id, version: one.options?.version || '' })) : [];
  },
  async reload(ids) {
    const core = host().defaultView.LSPluginCore, own = logseq.baseInfo.id;
    for (const id of ids.filter(one => one !== own)) { try { await core.reload(id); } catch (error) { console.error(`Logseq Plugin: ${id} could not be reloaded`, error); } }
    if (ids.includes(own)) await core.reload(own);
  },
  keep(list) { try { host().defaultView.localStorage.setItem(LOADED, JSON.stringify({ at: Date.now(), list })); } catch (error) { /* then nothing is said afterwards */ } },
  took() {
    try { const at = host().defaultView.localStorage, kept = JSON.parse(at.getItem(LOADED) || 'null'); at.removeItem(LOADED); return kept && Date.now() - kept.at < 60000 ? kept.list : null; } catch (error) { return null; }
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
      const ground = holder.ownerDocument.defaultView.getComputedStyle(head.closest('.sidebar-item')).backgroundColor;
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
const HIDES_TAGS = `.ls-page-title .ls-block:has(> .lk-place:not(:empty)) > .is-page-title-row .block-tags { display: none !important; }`;
const HIDES = `
${PAGE}:has(> .lk-rel) .references, ${PAGE}:has(> .lk-rel) .ls-bidirectional-properties { display: none !important; }
.lk-open ${PAGE} .references, .lk-open ${PAGE} .unlinked-references, .lk-open ${PAGE} .ls-bidirectional-properties { display: none !important; }`;

/* Logseq's editor draws a node as a whole page: a wide margin under it, the path to it above, a large title. Opened in a row it
   stands as the row's own line: no margins of a page, the path left out, a page's title at the size of the words around it.
   A bullet's own fold arrow is left out too: it would stand exactly where the row's arrow stands, and the row's arrow, which
   closes the node, is the one a person means there (the walk, 25 November 2026: a press on the row's arrow reached Logseq's).
   A page's own arrow stays, in the place the line's bullet had: it unfolds what the page keeps folded (a tag's Extends and
   properties), and nothing else opens those. */
const ARROW = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 512'%3E%3Cpath d='M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z'/%3E%3C/svg%3E\")";
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
.lk-editor :is(.bottom-property-pill, .property-pair) .property-k { display: block !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--lk-prop-face) !important; font-weight: var(--lk-prop-weight) !important; font-size: var(--lk-label) !important; line-height: 20px !important; letter-spacing: -.01em; color: var(--lk-quiet) !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-container { min-height: var(--lk-line-h) !important; display: flex !important; align-items: center !important; flex-wrap: wrap; overflow: visible !important; white-space: normal !important; min-width: 0; font-size: var(--lk-line-size) !important; line-height: 20px !important; padding: 0 !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner { background: none !important; }
.lk-editor .ls-properties-area, .lk-editor .properties-panel { margin: 0 !important; padding: 0 !important; overflow: visible !important; border-radius: 0 !important; }
.lk-editor .ls-properties-area { display: block !important; }   /* Logseq drops these rows in a place narrower than 430px (the sidebar, a deep level); the rows here fit, so they stay */
.lk-editor .ls-block-content-indent { padding-left: 42px !important; }   /* a bullet's other properties start where its first ones do */
/* A value that is words is a bullet of Logseq's: its words stand in the values' column, without the bullet. */
.lk-editor .property-pair .property-block-container { margin: 2px 0 0 !important; font-size: var(--lk-line-size) !important; }
.lk-editor .property-pair .property-block-container .block-control-wrap { display: none !important; }
.lk-editor .property-pair .property-block-container .block-main-container { gap: 0 !important; }
.lk-editor .property-pair .property-block-container .ls-block-content-indent { display: none !important; }
/* The arrow before a value that is a node: a press on it digs. The arrow stands in the gutter between the two columns, so the
   words of every value start on one line. */
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] { margin-left: -16px; overflow: visible !important; }
.lk-editor :is(.bottom-property-pill, .property-pair) .property-value-inner[data-type="node"] a.page-ref::before { content: ""; display: inline-block; width: 12px; height: 14px; margin: 0 4px 0 0; vertical-align: -2px; background: var(--lk-off); -webkit-mask: ${ARROW} center / 5px 13px no-repeat; mask: ${ARROW} center / 5px 13px no-repeat; transition: transform .14s ease; cursor: pointer; }
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
.lk-editor .lsp-hook-ui-slot { display: none !important; }`;

G.touch = { watch, changed, writing, edit, digs, seat, names, plugins, pages, pageFoot, pageHead, editor, open, openUrl, busy, left, tagList, key, command, section, page, toolbar, icon, statusIcon, HIDES, HIDES_TAGS, OPENED, PAGE };
})();
