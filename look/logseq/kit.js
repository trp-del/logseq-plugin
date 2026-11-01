/* The kit: the few things every part of Look uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), one stylesheet door, one watcher of the screen, one element builder, the greys, the
   four marks and the property icons, drawn once. */
(function () {
const Look = (window.Look ||= {});
const host = () => window.parent.document;

// The greys, mixed from Logseq's text colour so they follow any theme: quiet, faint, a hairline and a firmer line.
const TOKENS = `
:root { --lk-quiet: color-mix(in srgb, currentColor 70%, transparent); --lk-faint: color-mix(in srgb, currentColor 46%, transparent);
  --lk-hair: color-mix(in srgb, currentColor 12%, transparent); --lk-line: color-mix(in srgb, currentColor 26%, transparent);
  --lk-wash: color-mix(in srgb, currentColor 7%, transparent);
  --lk-mono: var(--ls-font-family-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace); }`;

/* The four sorts of thing and their marks, as the grammar page draws them: Entity (∃, the logical symbol), Occurrence
   (an open ring), Phenomena (a small wave), Information (three dots, ∴). One drawing, used before
   a link, in a page's icon slot and in lists. The shapes are 10 by 10. */
const MARKS = {
  entity: "<path d='M2 1.8H8V8.2H2M3.6 5H8' fill='none' stroke='currentColor' stroke-width='1.4'/>",
  occurrence: "<circle cx='5' cy='5' r='3.3' fill='none' stroke='currentColor' stroke-width='1.3'/>",
  phenomenon: "<path d='M1.3 6.2q1.85-3.4 3.7 0t3.7 0' fill='none' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/>",
  information: "<circle cx='5' cy='2.6' r='1.25' fill='currentColor'/><circle cx='2.3' cy='7.3' r='1.25' fill='currentColor'/><circle cx='7.7' cy='7.3' r='1.25' fill='currentColor'/>",
};
const markSvg = (sort, colour = 'currentColor') => `<svg viewBox="0 0 10 10" aria-hidden="true">${(MARKS[sort] || '').replace(/currentColor/g, colour)}</svg>`;
// A mark as a picture for a stylesheet (a background takes no currentColor, so the grey is given).
const markUrl = (sort, colour) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>${(MARKS[sort] || '').replace(/currentColor/g, colour)}</svg>`)}")`;

/* What a property holds, as an icon: the web (three dots joined) for a link to nodes, drawn here because no font has it;
   the rest from Logseq's own icon font (Tabler, loaded on every page). */
const WEB = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.6 2.4 9.2h7.2Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="2.6" r="1.7" fill="currentColor"/><circle cx="2.4" cy="9.2" r="1.7" fill="currentColor"/><circle cx="9.6" cy="9.2" r="1.7" fill="currentColor"/></svg>';
const KIND_ICONS = { node: null, date: 'calendar', datetime: 'calendar', text: 'letter-case', default: 'letter-case', number: '123', choice: 'select', checkbox: 'checkbox', url: 'world', page: null };
function kindIconHtml(kind) {
  const k = String(kind || 'text').replace(/^:/, '');
  if (KIND_ICONS[k] === null) return `<i class="lk-icon lk-web" aria-hidden="true">${WEB}</i>`;
  return `<i class="lk-icon ti ti-${KIND_ICONS[k] || 'letter-case'}" aria-hidden="true"></i>`;
}
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

/* One watcher of Logseq's screen: every part that draws registers a pass; the passes run once per frame after the screen
   changed, so many changes cost one pass. A change of class alone (pointing, selecting) runs nothing. */
const watch = { passes: new Set(), observer: null, frame: 0 };
function watchScreen(pass) {
  const doc = host();
  if (!watch.observer) {
    const win = doc.defaultView;
    watch.observer = new win.MutationObserver(records => {
      if (watch.frame || !records.some(r => r.type !== 'attributes')) return;
      watch.frame = win.requestAnimationFrame(() => { watch.frame = 0; run(doc); });
    });
    watch.observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-uuid', 'blockid', 'data-collapsed', 'data-page-tags'] });
  }
  watch.passes.add(pass);
  try { pass(doc); } catch (error) { console.error('Look: a pass failed', error); }
}
function run(doc) { for (const pass of [...watch.passes]) { try { pass(doc); } catch (error) { console.error('Look: a pass failed', error); } } }
function stopWatching() {
  watch.observer?.disconnect(); watch.observer = null;
  if (watch.frame) host().defaultView.cancelAnimationFrame(watch.frame);
  watch.frame = 0; watch.passes.clear();
}

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
const LEAVES = { elements: '.lk-own', attributes: ['data-lk-sort', 'data-lk-kind', 'data-lk-icon', 'data-lk-dev', 'data-lk-line'] };
function sweep(doc = host()) {
  for (const node of doc.querySelectorAll(LEAVES.elements)) node.remove();
  for (const name of LEAVES.attributes) for (const node of doc.querySelectorAll(`[${name}]`)) node.removeAttribute(name);
  for (const node of doc.querySelectorAll('[data-lk-title]')) { node.removeAttribute('title'); node.removeAttribute('data-lk-title'); }
}
const openPage = (uuid, inSidebar) => { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); };
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);

Look.kit = { host, TOKENS, MARKS, markSvg, markUrl, WEB, kindIconHtml, iconHtml, esc, el, style, watchScreen, run, stopWatching, onGraphChange, graphChanged, sweep, openPage, notify };
})();
