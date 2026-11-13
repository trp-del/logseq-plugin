/* The kit: the few things every part of Look uses. Logseq's window (the plugin runs in a frame of its own; what it draws
   goes into the parent document), one stylesheet door, one watcher of the screen, one element builder. */
(function () {
const Look = (window.Look ||= {});
const { host, esc, el, notify } = window.PluginDoor;

// The marks and the property icons are the door's (plugin.js), as are the greys and the shared names.
const { kindIconHtml } = window.PluginDoor;
const iconHtml = name => `<i class="lk-icon ti ti-${name}" aria-hidden="true"></i>`;


/* Look's base (plugin.js, Door.base): its stylesheets, each sent only when its words changed, its listeners and passes taken off
   at stop, its settings read with their defaults, and what it may leave in Logseq's window, taken out when it stops: elements of
   its own, its attributes, and the titles it gave cut-off names. */
const LEAVES = { elements: '.lk-own', attributes: ['data-lk-kind', 'data-lk-dev', 'data-lk-line', 'data-lk-closed', 'data-lk-timed', 'data-lk-wide', 'data-lk-page'],
  reset: doc => { for (const node of doc.querySelectorAll('[data-lk-title]')) { node.removeAttribute('title'); node.removeAttribute('data-lk-title'); } } };
const base = window.PluginDoor.base('look', { prefix: 'Look: ', stylePrefix: 'look-', schema: () => Look.settings?.schema, leaves: LEAVES });
const { style, listen, sweep } = base;

/* The watcher of Logseq's screen is the door's (plugin.js, Door.watch), one for every module since 5 November 2026: every part
   that draws registers a pass, run once per frame after the screen changed, and may give a quick early pass, run at once when
   elements came, before the screen is drawn. The kit keeps the passes too, so a reading that landed (the marks, the links) can
   run them again on its own; the base takes each off at Look's stop, so only Look's go. */
const watch = { passes: new Set() };
function watchScreen(pass, early) {
  const Door = window.PluginDoor;
  watch.passes.add(pass);
  base.watch(pass);
  if (early) base.watch((doc, records) => { if (Door.addsElements(records)) early(doc); }, { early: true });
}
function run(doc) { for (const pass of [...watch.passes]) { try { pass(doc); } catch (error) { console.error('Look: a pass failed', error); } } }
const stopAll = () => { watch.passes.clear(); return base.stop(); };

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

const openPage = (uuid, inSidebar) => { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); };

Look.kit = { host, kindIconHtml, iconHtml, esc, el, style, listen, onStop: base.onStop, setting: base.setting, watchScreen, run, stopAll, onGraphChange, graphChanged, sweep, openPage, notify };
})();
