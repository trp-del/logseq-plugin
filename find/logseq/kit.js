/* The kit: the few things every part of Find uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), one stylesheet door, one element builder, the sweep. The look of a row, a
   tag, a node's name and a day is the shared class names' (lk-row, lk-node, lk-tag, lk-day, lk-count, lk-fold, plugin.js):
   Find puts those names on what it draws and carries no look of its own for them. Cut down from Look's kit. */
(function () {
const Find = (window.Find ||= {});
const { host, esc, el, notify } = window.PluginDoor;

// el(doc, 'span', { class: 'fd-x', click: fn }, child, 'words'): attributes by name, listeners by event name, html by 'html'.
const iconHtml = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const { kindIconHtml } = window.PluginDoor;

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
// Logseq's header is the frameless window's drag handle: a real click in that band moves the window and reaches nothing.
// Anything of ours with controls sits below it (measured, not assumed).
const dragBand = (doc = host()) => Math.ceil(doc.getElementById('head')?.getBoundingClientRect().bottom || 48);

Find.kit = { host, esc, el, iconHtml, kindIconHtml, style, sweep, openPage, notify, dragBand };
})();
