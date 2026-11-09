/* Where the screen lives in Logseq: a page of its own (the route #/structure, in the main view) and a panel in the
   right sidebar, both hosted by Logseq's own React through logseq.Experiments (as DB Refinements hosted its map).
   Each mount draws the view into the holder Logseq gives and takes it down when Logseq does. */
(function () {
const S = window.Structure;
const ROUTE = '/structure', SIDEBAR_KEY = 'structure';
const Door = window.PluginDoor, { host } = Door;
/* Logseq draws a plugin's panel with a puzzle, in its head and in the sidebar's add menu (the cube with a +), the same puzzle for
   both: each takes the drawing of what it is, the one Structure's toolbar button has and the inspector's i in a circle, in
   Logseq's own stroke (9 November 2026). Only the drawing's path changes, so Logseq's React keeps the icon as it drew it. */
const ICONS = { Structure: 'structure', Inspector: 'inspector' };
function drawIcon(scope, word) {
  const path = scope?.querySelector('.ls-icon-puzzle svg path');
  const d = Door.TOOLBAR_ICONS[ICONS[word]];
  if (path && d && path.getAttribute('d') !== d) path.setAttribute('d', d);
}
// Logseq draws a panel's head again after the panel is in, so the drawing is set on every pass of the screen, not once.
function icons(doc) {
  S.view.ensureStyle(doc);
  for (const item of doc.querySelectorAll('.ui__dropdown-menu-item [title=":logseq-plugin"]')) drawIcon(item, item.textContent.trim());
  for (const [id, word] of [['_sidebar.' + SIDEBAR_KEY, 'Structure'], ['_sidebar.structure-inspector', 'Inspector']]) drawIcon(doc.getElementById(id)?.closest('.page-title'), word);
}

function mount(app) {
  const React = logseq.Experiments?.React;
  const hosted = { page: false, sidebar: false, inspector: false };
  const component = mode => function StructureView() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      let view = null;
      try { view = S.view.make(holder, mode, app); app.mounted(view); } catch (error) { console.error('Structure: the view could not be drawn', error); }
      const heading = mode === 'side' && holder.closest('.sidebar-item')?.querySelector('.page-title h3');
      if (heading) heading.textContent = 'Structure';
      return () => view?.destroy?.();
    }, []);
    return React.createElement('div', { ref, className: `st-holder st-holder-${mode}` });
  };
  // The inspector (inspector.js): its holder is handed over as Logseq draws it and taken back as Logseq takes it down.
  const Inspector = function StructureInspector() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current; if (!holder) return undefined;
      try { S.inspector.mounted(holder); } catch (error) { console.error('Structure: the inspector could not be drawn', error); }
      const heading = holder.closest('.sidebar-item')?.querySelector('.page-title h3');
      if (heading) heading.textContent = 'Inspector';
      return () => S.inspector.gone(holder);
    }, []);
    return React.createElement('div', { ref, className: 'st-holder-insp' });
  };
  if (!React?.createElement) console.error('Structure: Logseq gives plugins no React here, so the map cannot be shown');
  else {
    try { const Page = component('page'); logseq.Experiments.registerRouteRenderer('structure', { name: 'structure', path: ROUTE, render: () => React.createElement(Page) }); hosted.page = true; }
    catch (error) { console.error('Structure: the page could not be added', error); }
    try { const Side = component('side'); logseq.Experiments.registerSidebarRenderer(SIDEBAR_KEY, { title: 'Structure', render: () => React.createElement(Side) }); hosted.sidebar = true; }
    catch (error) { console.error('Structure: the sidebar panel could not be added', error); }
    try { logseq.Experiments.registerSidebarRenderer(S.inspector.KEY, { title: 'Inspector', render: () => React.createElement(Inspector) }); hosted.inspector = true; }
    catch (error) { console.error('Structure: the inspector could not be added', error); }
  }
  // The inspector is the first tab of the right sidebar (sidebar-tabs.js): picked, it opens if it is not open yet.
  const offTab = Door.sideTabs?.add({ key: 'inspector', word: 'Inspector', order: 1,
    find: doc => doc.getElementById('_sidebar.' + S.inspector.KEY)?.closest('.sidebar-item') || null,
    open: () => { logseq.Editor.openInRightSidebar('_sidebar.' + S.inspector.KEY); } });
  const offMenu = Door.watch(icons);
  const onPage = () => host().defaultView.location.hash.split('?')[0] === '#' + ROUTE;   // the address carries the place (view.js)
  return {
    ...hosted,
    stop: () => { offMenu(); offTab?.(); },
    openPage: () => { const win = host().defaultView; if (!onPage()) win.location.hash = '#' + ROUTE; },
    onPage,
    openInspector: async () => { Door.sideTabs?.show('inspector'); await logseq.Editor.openInRightSidebar('_sidebar.' + S.inspector.KEY); await logseq.App.setRightSidebarVisible?.(true); },
    openSidebar: async () => { await logseq.Editor.openInRightSidebar('_sidebar.' + SIDEBAR_KEY); await logseq.App.setRightSidebarVisible?.(true); },
  };
}
S.mount = { mount, ROUTE, SIDEBAR_KEY };
})();
