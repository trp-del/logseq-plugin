/* The kit: the few things every part of Look uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), one stylesheet door, one watcher of the screen, one element builder. */
(function () {
const Look = (window.Look ||= {});
const host = () => window.parent.document;

// The marks and the property icons are the door's (plugin.js), as are the greys and the shared names.
const { WEB, kindIconHtml } = window.PluginDoor;
const iconHtml = name => `<i class="lk-icon ti ti-${name}" aria-hidden="true"></i>`;

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
// el(doc, 'span', { class: 'lk-x', click: fn }, child, 'words'): attributes by name, listeners by event name, html by 'html'.
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (typeof value === 'function') node.addEventListener(key, value);
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
}

// One stylesheet per key; sent again only when its text changed (every send makes Logseq lay the page out again).
const sent = new Map();
function style(key, css) {
  const text = css && css.trim() ? css : '/* no rules */';
  if (sent.get(key) === text) return;
  sent.set(key, text);
  logseq.provideStyle({ key: 'look-' + key, style: text });
}

/* The watcher of Logseq's screen is the door's (plugin.js, Door.watch), one for every module since 5 November 2026: every part
   that draws registers a pass, run once per frame after the screen changed, and may give a quick early pass, run at once when
   elements came, before the screen is drawn. The kit keeps the passes too, so a reading that landed (the marks, the links) can
   run them again on its own, and keeps what takes each off, so Look's stop takes off only Look's. */
const watch = { passes: new Set(), offs: [] };
function watchScreen(pass, early) {
  const Door = window.PluginDoor;
  watch.passes.add(pass);
  watch.offs.push(Door.watch(pass));
  if (early) watch.offs.push(Door.watch((doc, records) => { if (Door.addsElements(records)) early(doc); }, { early: true }));
}
function run(doc) { for (const pass of [...watch.passes]) { try { pass(doc); } catch (error) { console.error('Look: a pass failed', error); } } }
function stopWatching() { while (watch.offs.length) watch.offs.pop()(); watch.passes.clear(); }

// Graph changes, told once after a quiet moment: whether a tag or a page may have changed, and which pages were written on.
const dbHooks = [];
function onGraphChange(fn) { dbHooks.push(fn); }
const reachesPages = window.PluginDoor.structureWatch();
let dbTimer = 0, pagesChanged = false, written = new Set();
function graphChanged(change) {
  if (reachesPages(change)) pagesChanged = true;
  for (const block of change?.blocks || []) written.add(block.page?.id ?? block.id);
  clearTimeout(dbTimer);
  dbTimer = setTimeout(() => { const pages = pagesChanged, on = written; pagesChanged = false; written = new Set(); for (const fn of dbHooks) { try { fn(pages, on); } catch (error) { console.error('Look: a graph hook failed', error); } } }, 900);
}

// Everything the plugin leaves in Logseq's window, taken out when it stops: elements of its own, its attributes.
const LEAVES = { elements: '.lk-own', attributes: ['data-lk-sort', 'data-lk-kind', 'data-lk-icon', 'data-lk-dev', 'data-lk-line', 'data-lk-closed', 'data-lk-timed'] };
function sweep(doc = host()) {
  for (const node of doc.querySelectorAll(LEAVES.elements)) node.remove();
  for (const name of LEAVES.attributes) for (const node of doc.querySelectorAll(`[${name}]`)) node.removeAttribute(name);
  for (const node of doc.querySelectorAll('[data-lk-title]')) { node.removeAttribute('title'); node.removeAttribute('data-lk-title'); }
}
const openPage = (uuid, inSidebar) => { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); };
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);

Look.kit = { host, WEB, kindIconHtml, iconHtml, esc, el, style, watchScreen, run, stopWatching, onGraphChange, graphChanged, sweep, openPage, notify };
})();
