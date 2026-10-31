/* The kit: the few things every part of Find uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), one stylesheet door, one element builder, the greys, the sweep. The look of a row, a
   tag, a node's name and a day is Look's (its shared class names lk-row, lk-node, lk-tag, lk-day, lk-count, lk-fold):
   Find puts those names on what it draws and carries no look of its own for them. Cut down from Look's kit. */
(function () {
const Find = (window.Find ||= {});
const host = () => window.parent.document;

// The greys, mixed from Logseq's text colour so they follow any theme: quiet, faint, a hairline, a firmer line, a wash.
const TOKENS = `
.fd { --fd-quiet: color-mix(in srgb, currentColor 70%, transparent); --fd-faint: color-mix(in srgb, currentColor 46%, transparent);
  --fd-hair: color-mix(in srgb, currentColor 12%, transparent); --fd-line: color-mix(in srgb, currentColor 26%, transparent);
  --fd-wash: color-mix(in srgb, currentColor 7%, transparent);
  --fd-mono: var(--ls-font-family-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace); }`;

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
// el(doc, 'span', { class: 'fd-x', click: fn }, child, 'words'): attributes by name, listeners by event name, html by 'html'.
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
const iconHtml = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
/* What a property holds, as an icon, the same drawing as Look's: the web (three dots joined) for a link to nodes, drawn
   here because no font has it; the rest from Logseq's own icon font (Tabler, loaded on every page). */
const WEB = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.6 2.4 9.2h7.2Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="2.6" r="1.7" fill="currentColor"/><circle cx="2.4" cy="9.2" r="1.7" fill="currentColor"/><circle cx="9.6" cy="9.2" r="1.7" fill="currentColor"/></svg>';
const KIND_ICONS = { node: null, page: null, date: 'calendar', datetime: 'calendar', text: 'letter-case', default: 'letter-case', number: '123', choice: 'select', checkbox: 'checkbox', url: 'world' };
function kindIconHtml(kind) {
  const k = String(kind || 'text').replace(/^:/, '');
  if (KIND_ICONS[k] === null) return WEB;
  return `<i class="ti ti-${KIND_ICONS[k] || 'letter-case'}" aria-hidden="true"></i>`;
}

// One stylesheet per key; sent again only when its text changed (every send makes Logseq lay the page out again).
const sent = new Map();
function style(key, css) {
  const text = css && css.trim() ? css : '/* no rules */';
  if (sent.get(key) === text) return;
  sent.set(key, text);
  logseq.provideStyle({ key: 'find-' + key, style: text });
}

// Everything the plugin leaves in Logseq's window, taken out when it stops: elements of its own, its attributes.
const LEAVES = { elements: '.fd-own', attributes: ['data-fd-uuid'] };
function sweep(doc = host()) {
  for (const node of doc.querySelectorAll(LEAVES.elements)) node.remove();
  for (const name of LEAVES.attributes) for (const node of doc.querySelectorAll(`[${name}]`)) node.removeAttribute(name);
}
const openPage = (uuid, inSidebar) => { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); };
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);
// Logseq's header is the frameless window's drag handle: a real click in that band moves the window and reaches nothing.
// Anything of ours with controls sits below it (measured, not assumed).
const dragBand = (doc = host()) => Math.ceil(doc.getElementById('head')?.getBoundingClientRect().bottom || 48);

Find.kit = { host, TOKENS, esc, el, iconHtml, kindIconHtml, WEB, style, sweep, openPage, notify, dragBand };
})();
