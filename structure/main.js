/* Structure: the map of a graph's tags and properties, drawn as one screen. Loaded last by loader.js; the core
   (core/*.js, pure) and the Logseq parts (logseq/*.js) are on window.Structure. This file holds the one state every
   view shares (the tray with its model, the cursor, what is open and ticked), the reading of the graph, Apply and the
   one Undo, and the commands that open the map. */
(function () {
const S = window.Structure;
const notify = (text, status = 'info') => logseq.UI.showMsg(text, status);   // no options: with a timeout the notice stays on screen (seen 2026-10-29)
const host = () => { try { return window.parent.document; } catch (error) { return document; } };

const tray = S.changes.makeTray();
tray.setBase({ tags: [], props: [] });
const app = {
  tray, views: new Set(), issuesCache: { model: null, list: [] }, reading: null, readAt: 0,
  st: { cur: null, open: new Set(), seen: new Set(), whole: new Set(), ticks: new Set(), find: '', view: 'tree', sort: 'filled', propCur: null, menu: null, prompt: null, edit: null, nodes: null, busy: '', trail: [], ask: null, side: { cur: null, find: '' } },
  issues() { if (app.issuesCache.model !== tray.model || app.issuesCache.at !== tray.version) app.issuesCache = { model: tray.model, at: tray.version, list: S.rules.issues(tray.model) }; return app.issuesCache.list; },
  // The tags and properties a change waiting in the tray touches: pencilled in wherever they are drawn.
  touched() {
    if (app.touchedCache && app.touchedCache.at === tray.version && app.touchedCache.model === tray.model) return app.touchedCache.set;
    const tags = new Set(), props = new Set();
    for (const c of tray.changes) { for (const k of ['tag', 'from', 'into', 'to', 'made', 'under', 'parent']) { const v = c[k]; if (Array.isArray(v)) v.forEach(x => tags.add(x)); else if (typeof v === 'number' && !(k === 'to' && c.kind === 'setRange')) tags.add(v); } if (c.tags) c.tags.forEach(x => tags.add(x)); if (c.prop != null) props.add(c.prop); }
    app.touchedCache = { at: tray.version, model: tray.model, set: { tags, props } };
    return app.touchedCache.set;
  },
  draw() { for (const v of [...app.views]) { if (!v.root.isConnected) { app.views.delete(v); continue; } try { v.draw(); } catch (error) { console.error('Structure: a draw failed', error); } } },
  stage(change) { const c = tray.stage(change); tray.note = ''; tray.version = (tray.version || 0) + 1; if (!mounts.onPage()) mounts.openPage(); return c; },
  dropChange(i) { tray.drop(i); tray.version = (tray.version || 0) + 1; if (!tray.changes.length) tray.note = '1 change dropped'; app.draw(); },
  discard() { const n = tray.changes.length; tray.discard(); tray.version = (tray.version || 0) + 1; if (n) tray.note = `${n === 1 ? '1 change' : n + ' changes'} dropped`; app.draw(); },
  async apply() {
    if (app.st.busy || !tray.changes.length) return;
    const n = tray.changes.length;
    app.st.busy = `Applying ${n === 1 ? 'the change' : n + ' changes'}…`; app.draw();
    try {
      const plan = tray.plan();
      const result = await S.apply.apply(plan);
      tray.done = { text: n === 1 ? '1 change' : `${n} changes`, undo: result.undo, steps: result.steps }; tray.note = '';
      tray.changes = [];
    } catch (error) { console.error('Structure: apply failed', error); notify(`Not applied: ${error.message}`, 'error'); }
    app.st.busy = '';
    await app.reread();
  },
  async undo() {
    if (app.st.busy || !tray.done) return;
    app.st.busy = 'Undoing…'; app.draw();
    try { await tray.done.undo(); tray.done = null; }
    catch (error) { console.error('Structure: undo failed', error); notify(`Could not undo: ${error.message}`, 'error'); }
    app.st.busy = '';
    await app.reread();
  },
  // The graph read again; the cursor kept by id, or by name when the id changed (a tag made or put back by Undo).
  async reread() {
    const was = app.st.cur != null && tray.model.tags.get(app.st.cur)?.title;
    try { const raw = await S.db.read(); tray.setBase(raw); tray.version = (tray.version || 0) + 1; app.readAt = Date.now(); }
    catch (error) { console.error('Structure: the graph could not be read', error); notify(`The graph could not be read: ${error.message}`, 'error'); }
    const m = tray.model;
    if (app.st.cur == null || !m.tags.has(app.st.cur)) { const byName = was && [...m.tags.values()].find(t => t.title === was && !t.missing); app.st.cur = byName ? byName.id : m.kinds[1]?.id ?? m.kinds[0]?.id; }
    if (app.st.side.cur == null) app.st.side.cur = app.st.cur;
    for (const id of [...app.st.ticks]) if (!m.tags.has(id)) app.st.ticks.delete(id);
    if (app.st.side.cur != null && !m.tags.has(app.st.side.cur)) app.st.side.cur = app.st.cur;
    app.st.ask = null;
    if (app.st.propCur && !m.props.has(Number(app.st.propCur.split('·')[1]))) app.st.propCur = null;
    app.draw();
  },
  mounted(view) { view.draw(); if (view.mode === 'side') app.followPage(); view.focus(); },
  // The map opened on a tag (from the sidebar, the toolbar): a jump, so Escape in the map comes back to where it was.
  openMain(id) { const st = app.st; if (id != null && (st.cur !== id || st.propCur || st.view !== 'tree')) { st.trail.push({ view: st.view, cur: st.cur, propCur: st.propCur, nodes: st.nodes }); st.cur = id; st.propCur = null; st.view = 'tree'; st.nodes = null; st.ask = null; S.model.pathOf(tray.model, id).slice(0, -1).forEach(a => st.open.add(a)); } mounts.openPage(); app.draw(); },
  openNode(uuid, inSidebar) { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); },
  readNodes: id => S.db.nodesOf(id), valuesOf: (id, ident) => S.db.valuesOf(id, ident), nodesWhere: (id, ident, v) => S.db.nodesWhere(id, ident, v),
  notify,
  nameTaken: name => S.db.nameTaken(name),
  // The sidebar's tree opens on the page's tag.
  async followPage() {
    if (![...app.views].some(v => v.mode === 'side')) return;
    try {
      const page = await logseq.Editor.getCurrentPage();
      const uuid = page?.uuid || page?.['block/uuid'];
      const id = uuid ? await S.db.tagOfPage(String(uuid)) : null;
      if (id != null && tray.model.tags.has(id)) { app.st.side.cur = id; S.model.pathOf(tray.model, id).slice(0, -1).forEach(a => app.st.open.add(a)); app.draw(); }
    } catch (error) { /* no page on screen: the tree stays as it was */ }
  },
};
S.app = app;
let mounts = { onPage: () => false, openPage() {}, openSidebar() {} };

let reReadTimer = 0;
const reachesMap = window.PluginDoor.structureWatch();
function graphChanged(change) {
  // A change from outside while the tray is empty: read again after a quiet moment, so the counts stay true. Words being
  // written leave the map as it is.
  if (!reachesMap(change) || tray.changes.length || app.st.busy) return;
  clearTimeout(reReadTimer);
  reReadTimer = setTimeout(() => { if (app.views.size) app.reread(); }, 1500);
}

async function main() {
  mounts = S.mount.mount(app);
  logseq.App.registerCommandPalette({ key: 'structure-open', label: 'Structure: the map of tags and properties' }, () => app.openMain());
  logseq.App.registerCommandPalette({ key: 'structure-sidebar', label: 'Structure: the tree in the right sidebar' }, () => mounts.openSidebar());
  logseq.provideModel({ structureOpen: () => app.openMain() });
  logseq.App.registerUIItem('toolbar', { key: 'structure-open', template: '<a class="button" data-on-click="structureOpen" title="Structure: the map of tags and properties"><i class="ti ti-hierarchy"></i></a>' });
  logseq.DB.onChanged(change => graphChanged(change));
  logseq.App.onCurrentGraphChanged(() => { tray.discard(); tray.done = null; tray.note = ''; app.st.trail = []; app.reread(); });
  logseq.App.onRouteChanged?.(() => { app.followPage(); });
  await app.reread();
  adopt();
}
const stop = () => { for (const v of [...app.views]) v.destroy(); host().getElementById('st-style')?.remove(); };
// A holder Logseq already shows (the map's page or the sidebar panel, left from before a reload of the plugin) gets its drawing.
function adopt() {
  for (const holder of host().querySelectorAll('.st-holder')) if (!holder.querySelector('.st')) { try { app.mounted(S.view.make(holder, holder.classList.contains('st-holder-side') ? 'side' : 'page', app)); } catch (error) { console.error('Structure: could not draw into a holder', error); } }
}
window.PluginDoor.describe('structure', { none: 'Structure has nothing to set.' });
window.PluginDoor.register({
  key: 'structure', title: 'Structure', about: 'The map of the graph’s tags and properties: one screen to see the whole shape, move things and change many at once, with one Undo.',
  start: main, stop,
});
})();
