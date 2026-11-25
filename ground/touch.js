/* GROUND: the one fenced place where the plugin touches Logseq's own screen. Every name of Logseq's markup, every call that is
   not in its plugin API, and every piece of Logseq lent to the plugin stands here and nowhere else, so a Logseq update is
   checked against this one file. Seen in Logseq 2.0.2.
     touch.watch(fn)          fn runs once a frame after Logseq's page changed; gives back what stops it
     touch.changed(fn)        fn runs a moment after the graph changed; gives back what stops it
     touch.pages()            Logseq's own pages on screen, each { el, uuid, feed }: the main page, a page in the sidebar,
                              a day in the journals feed (feed: true)
     touch.pageFoot(el)       where, in one of those pages, something of the plugin's may stand under the page's bullets
     touch.editor             Logseq's own editor for a node, placed in an element of the plugin's:
                              start(), can(), show(el, uuid) -> what takes it out again
     touch.open(uuid, side)   go to a node's page, or open it in the sidebar
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
  if (!observer) { observer = new (host().defaultView.MutationObserver)(() => { if (!queued) { queued = true; host().defaultView.requestAnimationFrame(run); } }); observer.observe(host().body, { childList: true, subtree: true }); }
  host().defaultView.requestAnimationFrame(() => { if (passes.has(fn)) fn(); });
  return () => { passes.delete(fn); if (!passes.size && observer) { observer.disconnect(); observer = null; } };
}

// The graph changed: said once, a moment after the last change of a burst (typing saves every few letters).
const heard = new Set(); let offChanged = null, timer = 0;
function changed(fn) {
  heard.add(fn);
  if (!offChanged) offChanged = logseq.DB.onChanged(() => { clearTimeout(timer); timer = setTimeout(() => { G.read.forget(); for (const one of [...heard]) { try { one(); } catch (error) { console.error('Logseq Plugin: a part could not follow a change', error); } } }, 500); });
  return () => { heard.delete(fn); if (!heard.size && typeof offChanged === 'function') { offChanged(); offChanged = null; clearTimeout(timer); } };
}

function pages() {
  const out = [];
  for (const el of host().querySelectorAll(PAGE)) {
    if (el.closest(OURS)) continue;
    const uuid = (el.querySelector(PAGE_NODE) || (el.querySelector('.ls-page-title') ? null : el.querySelector(FIRST_NODE)))?.getAttribute('blockid');
    if (uuid) out.push({ el, uuid: uuid.toLowerCase(), feed: !!el.closest(FEED) && host().querySelectorAll(FEED).length > 1 });
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
    stop() { spots.clear(); try { bump?.(); if (typeof off === 'function') off(); } catch (error) { /* gone with the plugin */ } off = null; },
  };
})();

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
const statusIcon = found => !found?.id ? '' : found.type === 'emoji' ? `<em-emoji id="${G.esc(found.id)}" size="1em"></em-emoji>` : icon(found.id);

/* Where the plugin's lists stand, Logseq's own for the same thing are taken away: its Linked references and its two-way
   property tabs. Only where the plugin's stand (:has), so a plugin that failed to draw leaves Logseq's in place. */
const HIDES = `
${PAGE}:has(> .lk-rel) .references, ${PAGE}:has(> .lk-rel) .ls-bidirectional-properties { display: none !important; }
.lk-open ${PAGE} .references, .lk-open ${PAGE} .unlinked-references, .lk-open ${PAGE} .ls-bidirectional-properties { display: none !important; }`;

/* Logseq's editor draws a node as a whole page: a wide margin under it, the path to it above, a large title. Opened in a row it
   stands as the row's own line: no margins of a page, the path left out, a page's title at the size of the words around it. */
const OPENED = `
.lk-editor ${PAGE} > .page-inner { display: block !important; margin: 0 !important; }
.lk-editor ${PAGE} > :not(.page-inner) { display: none !important; }
.lk-editor .breadcrumb { display: none !important; }
.lk-editor .ls-page-blocks { margin-top: 0 !important; }
.lk-editor .ls-page-title-container, .lk-editor .ls-page-title-container :is(h1, .block-title-wrap, .ls-page-title-actions) { font-size: inherit !important; line-height: 24px !important; font-weight: 600 !important; min-height: 0 !important; margin: 0 !important; }
.lk-editor .ls-page-properties { margin-top: 4px !important; }
.lk-editor .ls-page-title-actions { display: none !important; }
.lk-editor .is-page-title-row > .block-control-wrap { visibility: hidden !important; }
.lk-editor:has(.ls-page-title) { margin-left: 20px; }
.lk-editor .lsp-hook-ui-slot { display: none !important; }`;

G.touch = { watch, changed, pages, pageFoot, editor, open, icon, statusIcon, HIDES, OPENED, PAGE };
})();
