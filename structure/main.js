/* Structure: the map of a graph's tags and properties, drawn as one screen. Loaded last by loader.js; the core
   (core/*.js, pure) and the Logseq parts (logseq/*.js) are on window.Structure. This file holds the one state every
   view shares (the tray with its model, the cursor, what is open and ticked), the reading of the graph, Apply and the
   one Undo, and the commands that open the map. */
(function () {
const S = window.Structure;
const Mo = S.model;
const notify = (text, status = 'info') => logseq.UI.showMsg(text, status);   // no options: with a timeout the notice stays on screen (seen 2026-10-29)
const host = () => { try { return window.parent.document; } catch (error) { return document; } };

const tray = S.changes.makeTray();
tray.setBase({ tags: [], props: [] });
const startState = () => ({ cur: null, open: new Set(), seen: new Set(), whole: new Set(), ticks: new Set(), find: '', view: 'tree', sort: 'filled', propCur: null, menu: null, prompt: null, edit: null, nodes: null, busy: '', trail: [], ask: null, side: { cur: null, find: '' } });
const changesWord = n => n === 1 ? '1 change' : `${n} changes`;
const stepsWord = n => n === 1 ? '1 step' : `${n} steps`;
// The Undo of another graph, kept for when that graph is open again: it is the only record of what was written there.
const dones = new Map();
const app = {
  tray, views: new Set(), issuesCache: { model: null, list: [] }, reading: null, readAt: 0, graph: '',
  st: startState(),
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
  // A change while Apply or Undo runs would be lost when they end: it is refused, and null says so.
  stage(change) {
    if (app.st.busy) { notify('Wait for this to finish, then try again', 'warning'); return null; }
    const c = tray.stage(change); tray.note = ''; tray.version = (tray.version || 0) + 1; if (!mounts.onPage()) mounts.openPage(); return c;
  },
  dropChange(i) { if (app.st.busy) return; const up = Mo.parentOf(tray.model, app.st.cur); tray.drop(i); tray.version = (tray.version || 0) + 1; sayLost('it needed the change taken out'); if (!tray.changes.length) tray.note = '1 change dropped'; settle(null, up); app.draw(); },
  discard() { if (app.st.busy) return; const n = tray.changes.length, up = Mo.parentOf(tray.model, app.st.cur); tray.discard(); tray.lost = []; tray.version = (tray.version || 0) + 1; if (n) tray.note = `${changesWord(n)} dropped`; settle(null, up); app.draw(); },
  async apply() {
    if (app.st.busy || !tray.changes.length) return;
    const n = tray.changes.length;
    app.st.busy = `Applying ${n === 1 ? 'the change' : n + ' changes'}…`; app.draw();
    let plan = null, graph = app.graph;
    try {
      // Read now, not when the map last looked: a merge moves the nodes the tag holds this moment.
      graph = await S.db.graph();
      tray.setBase(await S.db.read()); tray.version = (tray.version || 0) + 1;
      if (tray.lost.length) sayLost('what it names is no longer in the graph');   // nothing is written: the tray is not what was pressed
      else {
        plan = tray.plan();
        const here = async () => await S.db.graph() === graph;
        const result = await S.apply.apply(plan, here);
        keepDone(graph, { text: `${changesWord(n)} applied`, undo: result.undo, left: result.left, graph });
        tray.note = ''; tray.changes = [];
      }
    } catch (error) {
      console.error('Structure: apply failed', error); notify(`Not applied: ${error.message}`, 'error');
      if (error.left?.()) keepDone(graph, { text: `${stepsWord(error.left())} not put back`, undo: error.undo, left: error.left, graph });
      // A tag deleted and put back has a new id: the waiting lines that name it follow, so pressing Apply again does the same thing.
      if (plan) tray.renumber(new Map([...plan.handles.values()].filter(h => h.realId != null && h.id > 0).map(h => [h.id, h.realId])));
    } finally { app.st.busy = ''; }
    await app.reread();
  },
  async undo() {
    if (app.st.busy || !tray.done) return;
    const done = tray.done, of = done.left();
    app.st.busy = 'Undoing…'; app.draw();
    try {
      const failures = await done.undo();
      if (failures.length) { done.text = `${stepsWord(done.left())} not undone`; notify(`Could not undo ${failures.length} of ${stepsWord(of)}: ${failures[0].message}. The arrow tries again.`, 'error'); }
      else { if (tray.done === done) tray.done = null; else dones.delete(done.graph); tray.note = ''; }
    } catch (error) {
      console.error('Structure: undo failed', error);
      if (done.left()) done.text = `${stepsWord(done.left())} not undone`;
      notify(error.elsewhere ? `Another graph was opened: the Undo waits in ${done.graph.replace(/^logseq_db_/, '')}` : `Could not undo: ${error.message}`, 'error');
    } finally { app.st.busy = ''; }
    await app.reread();
  },
  // The graph read again; the cursor kept by id, or by name when the id changed (a tag made or put back by Undo).
  async reread() {
    const was = app.st.cur != null && tray.model.tags.get(app.st.cur)?.title;
    try { const raw = await S.db.read(); tray.setBase(raw); tray.version = (tray.version || 0) + 1; app.readAt = Date.now(); }
    catch (error) { console.error('Structure: the graph could not be read', error); notify(`The graph could not be read: ${error.message}`, 'error'); }
    sayLost('what it names is no longer in the graph');
    settle(was);
    app.st.ask = null;
    app.draw();
  },
  mounted(view) { view.draw(); if (view.mode === 'side') app.followPage(); view.focus(); if (!app.st.busy) app.reread(); },   // the graph as it is now, not as it was last read
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
// Lines that left the tray without being pressed: said, never silent. An emptied tray keeps a line of its own.
function sayLost(why) {
  const lost = tray.lost; tray.lost = [];
  if (!lost.length) return;
  notify(lost.length === 1 ? `“${lost[0].text}” left the tray: ${why}` : `${lost.length} changes left the tray: ${why}`, 'warning');
  if (!tray.changes.length) tray.note = `${changesWord(lost.length)} dropped`;
}
// The cursor and the ticks kept on what is there: by id, or by name when the id changed (a tag made or put back by Undo), else the tag above.
function settle(was, up) {
  const m = tray.model;
  if (app.st.cur !== Mo.LOOSE && (app.st.cur == null || !m.tags.has(app.st.cur))) { const byName = was && [...m.tags.values()].find(t => t.title === was && !t.missing); app.st.cur = byName ? byName.id : m.tags.has(up) ? up : m.kinds[1]?.id ?? m.kinds[0]?.id; }
  if (app.st.side.cur == null) app.st.side.cur = app.st.cur;
  for (const id of [...app.st.ticks]) if (!m.tags.has(id)) app.st.ticks.delete(id);
  if (app.st.side.cur != null && app.st.side.cur !== Mo.LOOSE && !m.tags.has(app.st.side.cur)) app.st.side.cur = app.st.cur;
  if (app.st.propCur && !m.props.has(Number(app.st.propCur.split('·')[1]))) app.st.propCur = null;
}
function keepDone(graph, done) { if (graph === app.graph) tray.done = done; else dones.set(graph, done); }
// Another graph: its ids mean other tags, so nothing of the map's state carries over. What waited in the tray was never written, and goes with a word;
// the last Undo waits for its graph. The new graph may not answer at once.
async function otherGraph() {
  const waiting = tray.changes.length;
  if (tray.done) dones.set(tray.done.graph, tray.done);
  tray.discard(); tray.lost = [];
  app.graph = await S.db.graph().catch(() => '');
  tray.done = dones.get(app.graph) || null; dones.delete(app.graph);
  tray.note = waiting ? `${changesWord(waiting)} dropped: another graph opened` : '';
  if (waiting && !mounts.onPage()) notify(tray.note, 'warning');
  const { side, ...rest } = startState();
  Object.assign(app.st, rest, { busy: app.st.busy }); Object.assign(app.st.side, side);
  for (let tries = 0; tries < 25; tries++) {
    try { await S.db.read(); break; }
    catch (error) { await new Promise(resolve => setTimeout(resolve, 200)); }   // a read that fails here is the graph still opening, nothing to say yet
  }
  await app.reread();
}
let mounts = { onPage: () => false, openPage() {}, openSidebar() {} };

let reReadTimer = 0;
const reachesMap = window.PluginDoor.structureWatch();
function graphChanged(change) {
  // A change from outside: read again after a quiet moment, so the counts and a waiting tray stay true. Words being written
  // leave the map as it is.
  if (!reachesMap(change) || app.st.busy) return;
  clearTimeout(reReadTimer);
  reReadTimer = setTimeout(() => { if (app.views.size && !app.st.busy) app.reread(); }, 1500);
}

async function main() {
  mounts = S.mount.mount(app);
  logseq.App.registerCommandPalette({ key: 'structure-open', label: 'Structure: the map of tags and properties' }, () => app.openMain());
  logseq.App.registerCommandPalette({ key: 'structure-sidebar', label: 'Structure: the tree in the right sidebar' }, () => mounts.openSidebar());
  logseq.provideModel({ structureOpen: () => app.openMain() });
  logseq.App.registerUIItem('toolbar', { key: 'structure-open', template: '<a class="button" data-on-click="structureOpen" title="Structure: the map of tags and properties"><i class="ti ti-hierarchy"></i></a>' });
  logseq.DB.onChanged(change => graphChanged(change));
  logseq.App.onCurrentGraphChanged(() => otherGraph());
  logseq.App.onRouteChanged?.(() => { app.followPage(); });
  app.graph = await S.db.graph().catch(() => '');
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
