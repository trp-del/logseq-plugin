/* The kit: the few things every part of Find uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), the module's base, one element builder. The look of a row, a
   tag, a node's name and a day is the shared class names' (lk-row, lk-node, lk-tag, lk-day, lk-count, lk-fold, plugin.js):
   Find puts those names on what it draws and carries no look of its own for them. Cut down from Look's kit. */
(function () {
const Find = (window.Find ||= {});
const { host, esc, el, notify } = window.PluginDoor;
// el(doc, 'span', { class: 'fd-x', click: fn }, child, 'words'): attributes by name, listeners by event name, html by 'html'.

const { kindIconHtml } = window.PluginDoor;

/* Find's base (plugin.js, Door.base): its stylesheet, sent only when its words changed, its listeners and Logseq's hooks taken
   off at stop, its settings read with their defaults, and what it may leave in Logseq's window, taken out when it stops. */
const base = window.PluginDoor.base('find', { prefix: 'Find: ', stylePrefix: 'find-', schema: () => Find.settings?.schema, leaves: { elements: '.fd-own' } });
const { style, sweep, listen, onStop } = base;
const openPage = (uuid, inSidebar) => { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); };
// Logseq's header is the frameless window's drag handle: a real click in that band moves the window and reaches nothing.
// Anything of ours with controls sits below it (measured, not assumed).
const dragBand = (doc = host()) => Math.ceil(doc.getElementById('head')?.getBoundingClientRect().bottom || 48);

Find.kit = { host, esc, el, kindIconHtml, style, sweep, listen, onStop, setting: base.setting, stopAll: base.stop, openPage, notify, dragBand };
})();
