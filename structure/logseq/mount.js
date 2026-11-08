/* Where the screen lives in Logseq: a page of its own (the route #/structure, in the main view) and a panel in the
   right sidebar, both hosted by Logseq's own React through logseq.Experiments (as DB Refinements hosted its map).
   Each mount draws the view into the holder Logseq gives and takes it down when Logseq does. */
(function () {
const S = window.Structure;
const ROUTE = '/structure', SIDEBAR_KEY = 'structure';
const { host } = window.PluginDoor;

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
  const onPage = () => host().defaultView.location.hash.split('?')[0] === '#' + ROUTE;   // the address carries the place (view.js)
  return {
    ...hosted,
    openPage: () => { const win = host().defaultView; if (!onPage()) win.location.hash = '#' + ROUTE; },
    onPage,
    openInspector: async () => { await logseq.Editor.openInRightSidebar('_sidebar.' + S.inspector.KEY); await logseq.App.setRightSidebarVisible?.(true); },
    openSidebar: async () => { await logseq.Editor.openInRightSidebar('_sidebar.' + SIDEBAR_KEY); await logseq.App.setRightSidebarVisible?.(true); },
  };
}
S.mount = { mount, ROUTE, SIDEBAR_KEY };
})();
