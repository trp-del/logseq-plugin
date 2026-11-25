/* Structure: the map of a graph's tags and properties, drawn as one screen. Loaded last by loader.js; the core
   (core/*.js, pure) and the Logseq parts (logseq/*.js) are on window.Structure. This file holds the one state every
   view shares (the tray with its model, the cursor, what is open and ticked), the reading of the graph, Apply and the
   one Undo, and the commands that open the map. */
(function () {
const S = window.Structure;
const Mo = S.model;
const { notify, host } = window.PluginDoor;

const tray = S.changes.makeTray();
tray.setBase({ tags: [], props: [] });
const AT_ONCE = new Set(['move', 'takeOut', 'rename', 'renameProp', 'moveProp', 'addProp', 'make', 'setRange', 'retag']);   // Undo puts each back whole; nothing is lost
const startState = () => ({ cur: null, open: new Set(), seen: new Set(), whole: new Set(), ticks: new Set(), pticks: new Set(), popen: new Set(), paim: false, find: '', view: 'tree', sort: 'filled', propCur: null, menu: null, prompt: null, edit: null, nodes: null, busy: '', trail: [], ask: null, places: new Map(), at: null, walking: false, split: false, pane2: { find: '', open: new Set(), seen: new Set() } });
const changesWord = n => n === 1 ? '1 change' : `${n} changes`;
const stepsWord = n => n === 1 ? '1 step' : `${n} steps`;
// The Undo of another graph, kept for when that graph is open again: it is the only record of what was written there.
const dones = new Map();
// The records this session is writing or undoing now (not cut off), and the cut-off ones already said.
const running = new Set(), saidCut = new Set();
let placeNumber = Date.now();   // a place of the map in the window's history; from the clock, so a reload never reuses one
// A line in the tray that only says what happened leaves by itself; the Undo arrow stays.
let saidTimer = 0;
const SAID_FOR = 6000;
function say(text) { tray.note = text; clearTimeout(saidTimer); saidTimer = setTimeout(() => { if (tray.note === text) { tray.note = ''; app.draw(); } }, SAID_FOR); }
const app = {
  tray, views: new Set(), reading: null, readAt: 0, graph: '',
  st: startState(),
  // The tags and properties a change waiting in the tray touches: in green text (lk-coming) wherever they are drawn.
  touched() {
    if (app.touchedCache && app.touchedCache.at === tray.version && app.touchedCache.model === tray.model) return app.touchedCache.set;
    const tags = new Set(), props = new Set();
    for (const c of tray.changes) { for (const k of ['tag', 'from', 'into', 'to', 'made', 'under']) { const v = c[k]; if (Array.isArray(v)) v.forEach(x => tags.add(x)); else if (typeof v === 'number' && !(k === 'to' && c.kind === 'setRange')) tags.add(v); } if (c.tags) c.tags.forEach(x => tags.add(x)); if (c.prop != null) props.add(c.prop); if (c.intoProp != null) props.add(c.intoProp); }
    app.touchedCache = { at: tray.version, model: tray.model, set: { tags, props } };
    return app.touchedCache.set;
  },
  draw() { for (const v of [...app.views]) { if (!v.root.isConnected) { app.views.delete(v); continue; } try { v.draw(); } catch (error) { console.error('Structure: a draw failed', error); } } },
  // A change while Apply or Undo runs would be lost when they end: it is refused, and null says so.
  // Written at once, with the one Undo: a change that can lose nothing (the owner, 5 November 2026: "I don't want to have to accept
  // every minor change"), standing alone in the tray. What can lose links or values (a merge, a removal, a property deleted from a
  // tag, properties merged, a split) waits for Apply with its plain count, and so do changes staged together (ticked rows, a new
  // top-level tag with its first child tags: `wait`), since several at once are what Apply is for.
  // here: the change is made where the person stands (a table's ticked rows), so the map is not opened for it.
  stage(change, { wait = false, here = false } = {}) {
    if (app.st.busy) { notify('Wait for this to finish, then try again', 'warning'); return null; }
    const c = tray.stage(change); tray.note = ''; tray.version = (tray.version || 0) + 1;
    const onTag = [...app.views].some(v => v.mode === 'tag' || v.mode === 'line');
    if (!here && !onTag && !mounts.onPage()) mounts.openPage();
    if (!wait && AT_ONCE.has(c.kind) && !c.lasting && tray.changes.length === 1) setTimeout(() => { if (tray.changes.length === 1 && tray.changes[0] === c && !app.st.busy) app.apply(); });
    return c;
  },
  dropChange(i) { if (app.st.busy) return; const up = Mo.parentOf(tray.model, app.st.cur); tray.drop(i); tray.version = (tray.version || 0) + 1; sayLost('it needed the change taken out'); if (!tray.changes.length) say('1 change dropped'); settle(null, up); app.draw(); },
  discard() { if (app.st.busy) return; const n = tray.changes.length, up = Mo.parentOf(tray.model, app.st.cur); tray.discard(); tray.lost = []; tray.version = (tray.version || 0) + 1; if (n) say(`${changesWord(n)} dropped`); settle(null, up); app.draw(); },
  // Cmd-Z: the last thing done, a change still waiting first, else the last Apply, as the arrow.
  takeBack() { if (tray.changes.length) app.dropChange(tray.lines().length - 1); else app.undo(); },
  nextPlace: () => ++placeNumber,
  // The log of changes: each Apply's lines, kept with the graph's name on this computer, the newest first.
  logged() { try { return JSON.parse(localStorage.getItem(`structure-log:${app.graph}`) || '[]'); } catch (error) { return []; } },
  log(graph, lines, rec) { try { const at = Date.now(), all = [...lines.map(l => ({ at, text: l.text, nodes: l.nodes, rec })), ...app.logged()].slice(0, 500); localStorage.setItem(`structure-log:${graph}`, JSON.stringify(all)); } catch (error) { console.error('Structure: the log could not be kept', error); } },
  // The groups of Every property: for order only, kept with the graph's name on this computer, nothing written to the graph.
  // { list: [{ id, name, under: id or null, open }], of: { property ident: group id } }.
  groups() { try { const g = JSON.parse(localStorage.getItem(`structure-groups:${app.graph}`) || 'null'); return g && Array.isArray(g.list) ? { list: g.list, of: g.of || {} } : { list: [], of: {} }; } catch (error) { return { list: [], of: {} }; } },
  saveGroups(g) { try { localStorage.setItem(`structure-groups:${app.graph}`, JSON.stringify(g)); } catch (error) { console.error('Structure: the groups could not be kept', error); } },
  /* Every change to the groups, by any way in (the name field, the ×, a drag, New group), goes through here and leaves the faded
     Undo arrow at the group's row, as every other change does (10 November 2026, the audit's 16). A group folding is the view, as
     a bullet folding is, and leaves none. The groups are this computer's, so the Undo puts back what was kept, nothing in the graph. */
  changeGroups(text, change, at) {   // each its own arrow, taking the place of the last change of one thing, as anywhere
    const graph = app.graph, before = JSON.stringify(app.groups()), G = app.groups();
    if (change(G) === false) return;
    app.saveGroups(G);
    window.PluginDoor.undo.offer({ owner: 'structure', key: `structure:groups:${++groupChanges}`, text, at: () => (at && host().querySelector(`.st-tbl .st-grp[data-group="${String(at).replace(/["\\]/g, '')}"] .gn`)) || host().querySelector('.st-tbl .st-gnew'),
      run: async () => { if (graph !== app.graph) return; localStorage.setItem(`structure-groups:${graph}`, before); app.draw(); },
      onFail: error => { console.error('Structure: the groups could not be put back', error); notify("The groups could not be put back", "warning"); } });
  },
  async apply({ docks = false } = {}) {
    if (app.st.busy || !tray.changes.length) return;
    const n = tray.changes.length;
    // hush: a change made from a table's ticked rows is written without a line on the tag's page above the table, which would
    // push the table down under the hand and back again; the map says it as ever.
    app.st.hush = !!docks; app.st.busy = `Applying ${n === 1 ? 'the change' : n + ' changes'}…`; app.draw();
    let plan = null, graph = app.graph;
    try {
      // Read now, not when the map last looked: a merge moves the nodes the tag holds this moment.
      graph = await S.db.graph();
      tray.setBase(await S.db.read()); tray.version = (tray.version || 0) + 1;
      if (tray.lost.length) sayLost('what it names is no longer in the graph');   // nothing is written: the tray is not what was pressed
      else {
        plan = tray.plan();
        const here = async () => await S.db.graph() === graph;
        // The record of this Apply, on this Mac before the first write: its Undo outlives Logseq (records.js).
        const lines = tray.lines(), rec = S.records.make({ graph, text: n === 1 && lines[0] ? lines[0].text : `${changesWord(n)} applied` });
        running.add(rec.id);
        // A change that rewrites many nodes (a merge, a removal, a split, properties merged) first has Logseq copy the whole graph.
        const big = plan.some(x => x.op === 'deleteTag' || x.op === 'moveValues') || plan.length > 20;
        const uncopied = big && !await S.db.safetyCopy(graph);
        try {
          const result = await S.apply.apply(plan, here, rec);
          keepDone(graph, { text: `${changesWord(n)} applied`, undo: result.undo, left: result.left, graph, rec, docks });
          if (uncopied) notify('Applied, with its Undo, but Logseq’s copy of the graph could not be made first', 'warning');
          if (rec.lost) notify('Applied, but its Undo could not be kept on this Mac: it works until Logseq closes', 'warning');
          app.log(graph, lines, rec.id);
        } catch (error) { if (error.left?.()) app.log(graph, lines, rec.id); throw error; }   // what could not be put back stays on the Log's arrow too
        finally { running.delete(rec.id); }
        tray.note = ''; tray.changes = [];
      }
    } catch (error) {
      console.error('Structure: apply failed', error); notify(`Not applied: ${window.PluginDoor.reason(error, 'Logseq did not take a change. Nothing else was changed')}`, 'error');
      if (error.left?.()) keepDone(graph, { text: `${stepsWord(error.left())} not put back`, undo: error.undo, left: error.left, graph, rec: error.rec });
      // A tag deleted and put back has a new id: the waiting lines that name it follow, so pressing Apply again does the same thing.
      if (plan) tray.renumber(new Map([...plan.handles.values()].filter(h => h.realId != null && h.id > 0).map(h => [h.id, h.realId])));
    } finally { app.st.busy = ''; app.st.hush = false; }
    await app.reread();
    await app.readRecords();
  },
  // The door takes the arrow away as it is pressed; it is offered again at once, so an Undo asked about and not taken stays.
  async undo() { if (app.st.busy || !tray.done) return; undoOffered = false; syncUndo(); app.askUndo(tray.done.rec?.id, tray.done.text, () => { const done = tray.done; if (done) app.undoRun(done); }); },
  /* Undo says first what it will take back, and waits for a yes (the owner, 18 November 2026: Undo was too easy to press, with no
     confirmation or clarity about what would be undone): the library's menu under the arrow lists each change of that Apply as it was
     logged, with its nodes, then one line that undoes them all; Escape or a press elsewhere leaves everything as it is. */
  askUndo(rec, text, run) {
    const doc = host();
    const from = (rec && doc.querySelector(`[data-logundo="${String(rec).replace(/["\\]/g, '')}"]`)) || doc.querySelector('.st-tray .st-done .lk-undo, .st-tray .st-done') || doc.querySelector('.lk-undo-dock [data-lk-undo="structure"]') || doc.querySelector('.st-tray') || doc.body;
    const lines = (rec ? app.logged().filter(x => x.rec === rec) : []).map(x => ({ note: x.text, count: x.nodes ? `${x.nodes} ${x.nodes === 1 ? 'node' : 'nodes'}` : '' }));
    const all = lines.length ? lines : [{ note: text }];
    window.PluginDoor.menu(from, [{ group: all.length === 1 ? 'Undo will take back' : `Undo will take back these ${all.length} changes` }, ...all, { gap: true },
      { word: all.length === 1 ? 'Undo it' : `Undo all ${all.length}`, take: () => run() }], { align: 'left' });
  },
  /* The Log's arrow: the Undo of an Apply of any day in the last 30, read back from this Mac (records.js). The same run as the
     tray's arrow, so both ways in put back the same way; a record the tray's arrow also holds is undone through that one. A later
     change to the same tags is undone first, or this Undo would put a tag back under what came after it. */
  async undoLogged(id) {
    if (app.st.busy) return;
    if (tray.done?.rec?.id === id) return app.undo();
    const graph = app.graph, all = await S.records.list(graph, running), head = all.find(h => h.id === id);
    if (!head || !head.left) { await app.readRecords(); return; }
    const later = S.records.laterOver(all, head);
    if (later) return notify(`Undo “${later.text}” first: it changed the same tags later`, 'warning');
    const rec = await S.records.load(graph, head).catch(() => null);
    if (!rec) return notify('This change’s record could not be read, so it cannot be undone from here', 'warning');
    const here = async () => await S.db.graph() === graph;
    app.askUndo(id, head.text, () => app.undoRun({ text: head.text, graph, rec, undo: () => S.apply.putBack(rec, here), left: () => rec.left() }));
  },
  async undoRun(done) {
    const of = done.left();
    app.st.hush = !!done.docks; app.st.busy = 'Undoing…'; app.draw();
    try {
      const failures = await done.undo();
      if (failures.kept) notify(`${failures.kept === 1 ? 'One node or page' : `${failures.kept} nodes or pages`} changed after Apply, so Undo left ${failures.kept === 1 ? 'it' : 'them'} as ${failures.kept === 1 ? 'it is' : 'they are'}`, 'warning');
      if (failures.length) { done.text = `${stepsWord(done.left())} not undone`; syncUndo(); notify(`Could not undo ${failures.length} of ${stepsWord(of)}: ${window.PluginDoor.reason(failures[0], 'Logseq did not take them')}. The arrow tries again`, 'error'); }
      else { if (tray.done === done) tray.done = null; else if (dones.get(done.graph) === done) dones.delete(done.graph); tray.note = ''; }
      syncUndo();
    } catch (error) {
      console.error('Structure: undo failed', error);
      if (done.left()) done.text = `${stepsWord(done.left())} not undone`;
      syncUndo();
      notify(error.elsewhere ? `Another graph was opened: the Undo waits in ${done.graph.replace(/^logseq_db_/, '')}` : `Could not undo: ${window.PluginDoor.reason(error, 'Logseq did not take a step back')}`, 'error');
    } finally { app.st.busy = ''; app.st.hush = false; }
    await app.reread();
    await app.readRecords();
  },
  // The records of the graph open, for the Log's arrows: id -> head. A record a Logseq that closed left halfway is said once.
  records: new Map(),
  async readRecords() {
    const graph = app.graph;
    try {
      const all = await S.records.list(graph, running);
      if (graph !== app.graph) return;
      const cut = all.filter(h => h.state === 'cut' && !saidCut.has(h.id));
      cut.forEach(h => saidCut.add(h.id));
      if (cut.length) notify(`Logseq closed while Ontology was changing tags (${cut[0].text}). What was written can be put back from the Log in Ontology`, 'warning');
      app.records = new Map(all.map(h => [h.id, h]));
    } catch (error) { console.error('Structure: the records could not be read', error); app.records = new Map(); }
    app.draw();
  },
  // The graph read again; the cursor kept by id, or by name when the id changed (a tag made or put back by Undo).
  async reread() {
    const was = app.st.cur != null && tray.model.tags.get(app.st.cur)?.title;
    try { const raw = await S.db.read(); tray.setBase(raw); tray.version = (tray.version || 0) + 1; app.readAt = Date.now(); }
    catch (error) { console.error('Structure: the graph could not be read', error); notify(`The graph could not be read: ${window.PluginDoor.reason(error, 'Logseq did not answer. Open Ontology again in a moment')}`, 'error'); }
    sayLost('what it names is no longer in the graph');
    settle(was);
    if (!app.st.ask?.change && !app.st.ask?.apply) app.st.ask = null;   // an ask of a merge names what this reading may have moved
    app.draw();
  },
  mounted(view) { view.draw(); view.focus(); if (!app.st.busy) app.reread(); },   // the graph as it is now, not as it was last read
  // The map opened on a tag (from the sidebar, the toolbar): a jump, so Escape in the map comes back to where it was.
  openMain(id) { const st = app.st; if (id != null && (st.cur !== id || st.propCur || st.view !== 'tree')) { if (st.cur != null) st.trail.push({ view: st.view, cur: st.cur, propCur: st.propCur, nodes: st.nodes }); st.cur = id; st.propCur = null; st.view = 'tree'; st.nodes = null; st.ask = null; S.model.pathOf(tray.model, id).slice(0, -1).forEach(a => st.open.add(a)); } mounts.openPage(); app.draw(); },
  openNode(uuid, inSidebar) { if (!uuid) return; if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); },
  // What a tag's count counts: its own nodes and those beneath, each with the tag it carries.
  async readNodes(id) {
    const m = tray.model;
    const list = await S.db.nodesOf([...Mo.nodesUnder(m, id)]);
    return list.map(x => ({ ...x, tag: Mo.carrier(m, id, x.id) })).sort((a, b) => b.day - a.day || b.created - a.created);
  },
  // The × on a tag's own page: the tag leaves its place and every node under it what it inherited, so the map asks first, on the tag's card.
  async askTakeOut(tagUuid, parentUuid) {
    await app.reread();
    const of = uuid => [...tray.model.tags.values()].find(t => t.uuid === uuid), t = of(tagUuid), p = of(parentUuid);
    if (!t || !p || !t.parents.includes(p.id)) return notify('Ontology does not list this tag, so it stays where it is', 'warning');
    app.openMain(t.id);
    app.st.ask = { change: { kind: 'takeOut', tag: t.id, from: p.id }, owner: 'page' };
    app.draw();
  },
  /* What merging properties into one would do, read from the values as they are: for each property merged away, the values that
     move, those that stay and the nodes that would hold two values where the kept property takes one (core/values.js). */
  async mergePreview(fromIds, intoId) {
    const m = tray.model, P = id => m.props.get(id), all = [...fromIds, intoId].map(P);
    const values = new Map(await Promise.all(all.map(async p => [p.ident, await S.db.propValues(p.ident, p.type)])));
    const into = { ...P(intoId), choices: P(intoId).choice ? await S.db.choicesOf(intoId) : null };
    return S.values.preview(fromIds.map(P), into, values);
  },
  /* A property change before it is made, shown on real notes (16 November 2026, the owner: "make sure you design it in a way where
     it is obvious what the outcome will be"): the counts, and up to three notes as they are now and as they will be. A note the
     change leaves as it is comes first, when there is one. kind: 'merge' { prop, into }, 'retype' { prop, type }, 'forTag'
     { prop, tag, into or name }, 'forNodes' { prop, nodes, into or name, keep }. Each note: { title, tags, now: [{ name, vals }], after: [{ name, vals: [{ w, mark }], mark }], same }. */
  async propPreview(kind, a) {
    const m = tray.model, P = id => m.props.get(id), from = P(a.prop), V = S.values;
    const fromVals = await S.db.propValues(from.ident, from.type);
    const word = v => v.title ?? (v.raw == null ? '' : String(v.raw));
    // A day as its journal page will be named, in the graph's own date format (the door's dates).
    const D = window.PluginDoor.dates, fmt = await D.format() || 'MMM do, yyyy', dayWord = d => D.title(D.date(d), fmt);
    const shown = w => w.day ? dayWord(w.day) : w.page ?? w.text ?? (w.num != null ? String(w.num) : w.raw != null ? (w.raw ? 'yes' : 'no') : '');
    const gave = [], left = [], after = new Map();   // after: node -> { into: [words new], stay: [words] }
    let moved = 0, kept = 0, intoName = '', intoVals = new Map(), stayName = from.title;
    if (kind === 'merge') { const into = P(a.into); intoName = into.title; intoVals = await S.db.propValues(into.ident, into.type); var target = { ...into, choices: into.choice ? await S.db.choicesOf(into.id) : null }; }
    else if (kind === 'retype') { intoName = from.title; stayName = `${from.title}, as written`; var target = { type: a.type, many: from.many }; }
    else {
      // One tag's nodes (and those of the tags beneath it, which inherit the property from it); the other tags' nodes stay as they are.
      // forNodes (24 November 2026): the nodes picked, whatever their tags; keep: a copy, the first property left as it is.
      var mine = kind === 'forTag' ? Mo.nodesUnder(m, a.tag) : new Set(a.nodes), into = a.into != null ? P(a.into) : null;
      intoName = into ? into.title : a.name;
      if (into) { intoVals = await S.db.propValues(into.ident, into.type); var target = { ...into, choices: into.choice ? await S.db.choicesOf(into.id) : null }; }
      else var target = { type: from.choice ? 'default' : from.type, many: from.many };
    }
    const clash = [];
    for (const [n, list] of fromVals) {
      if (mine && !mine.has(n)) continue;
      const go = [], stay = [];
      for (const v of list) { if (!word(v).trim()) continue;   // an empty value says nothing on a note: neither shown nor counted
        const w = V.convert(from, target, v); if (w) go.push(shown(w) || word(v)); else stay.push(word(v)); }
      moved += go.length; kept += stay.length;
      if (!go.length && !stay.length) continue;
      if (go.length) gave.push(n); if (stay.length) left.push(n);
      if ((kind === 'forTag' || kind === 'forNodes') && !target.many && go.length + (intoVals.get(n) || []).length > 1) clash.push(n);
      after.set(n, { go, stay });
    }
    // Which notes to show: one left as it is (or partly) first, then ones that change.
    // For one tag, the note left as it is is one of another tag's (Bill payment's, beside Bills'), so it shows that tag is untouched.
    const unchanged = kind === 'forNodes' ? [] : kind === 'forTag' ? [...fromVals.keys()].filter(n => !gave.includes(n) && !(mine && mine.has(n))) : left.filter(n => !gave.includes(n));
    const picks = [...unchanged.slice(0, 1), ...gave.filter(n => !unchanged.includes(n)).slice(0, unchanged.length ? 2 : 3)];
    const notes = (await S.db.notesFor(picks)).sort((x, y) => picks.indexOf(x.id) - picks.indexOf(y.id));
    const out = notes.map(note => {
      const n = note.id, x = after.get(n) || { go: [], stay: [] }, had = (fromVals.get(n) || []).map(word), hadInto = (intoVals.get(n) || []).map(word);
      const now = [{ name: from.title, vals: had }]; if (kind === 'merge' && hadInto.length) now.push({ name: intoName, vals: hadInto });
      const aft = [];
      if (kind === 'merge') {
        if (hadInto.length || x.go.length) aft.push({ name: intoName, vals: [...hadInto.map(w => ({ w })), ...x.go.filter(w => !hadInto.includes(w)).map(w => ({ w, mark: 'new' }))], mark: hadInto.length ? '' : 'new' });
        aft.push(x.stay.length ? { name: from.title, vals: x.stay.map(w => ({ w })) } : { name: from.title, vals: had.map(w => ({ w })), mark: 'gone' });
      } else if (kind === 'retype') {
        if (x.go.length) aft.push({ name: intoName, vals: x.go.map(w => ({ w, mark: 'new' })) });
        if (x.stay.length) aft.push({ name: stayName, vals: x.stay.map(w => ({ w })), mark: 'new' });
      } else if (kind === 'forNodes') {
        if (hadInto.length) now.push({ name: intoName, vals: hadInto });
        if (a.keep || x.stay.length) aft.push({ name: from.title, vals: (a.keep ? had : x.stay).map(w => ({ w })) }); else if (x.go.length) aft.push({ name: from.title, vals: had.map(w => ({ w })), mark: 'gone' });
        if (x.go.length || hadInto.length) aft.push({ name: intoName, vals: [...hadInto.map(w => ({ w })), ...x.go.filter(w => !hadInto.includes(w)).map(w => ({ w, mark: 'new' }))], mark: hadInto.length ? '' : 'new' });
      } else {   // forTag
        if (hadInto.length) now.push({ name: intoName, vals: hadInto });
        if (x.stay.length) aft.push({ name: from.title, vals: x.stay.map(w => ({ w })) }); else if (x.go.length) aft.push({ name: from.title, vals: had.map(w => ({ w })), mark: 'gone' }); else aft.push({ name: from.title, vals: had.map(w => ({ w })) });
        if (x.go.length || hadInto.length) aft.push({ name: intoName, vals: [...hadInto.map(w => ({ w })), ...x.go.filter(w => !hadInto.includes(w)).map(w => ({ w, mark: 'new' }))], mark: hadInto.length ? '' : 'new' });
      }
      return { title: note.title, tags: note.tags, now, after: aft, same: !x.go.length };
    });
    // For one tag: the other tags that ask for the property and keep it, and the nodes that keep it there.
    const others = kind === 'forTag' ? [...m.tags.values()].filter(t => t.id !== a.tag && t.props.includes(a.prop) && !Mo.under(m, t.id, a.tag)).map(t => ({ title: t.title, kids: S.changes.everyUnder(m, t.id).length })) : [];
    const elsewhere = kind === 'forTag' ? [...fromVals.keys()].filter(n => !mine.has(n)).length : 0;
    // A node of the tag that also holds another tag asking for the property: its value moves all the same, so the other tag's note loses it.
    const also = kind === 'forTag' ? gave.filter(n => [...m.tags.values()].some(t => t.props.includes(a.prop) && !Mo.under(m, t.id, a.tag) && !Mo.under(m, a.tag, t.id) && Mo.nodesUnder(m, t.id).has(n))) : [];
    return { notes: out, gave, left, moved, kept, nodes: fromVals.size, clash, others, elsewhere, also, inMine: mine ? mine.size : 0 };
  },
  notify,
  nameTaken: name => S.db.nameTaken(name),
};
S.app = app;
// Lines that left the tray without being pressed: said, never silent. An emptied tray keeps a line of its own.
function sayLost(why) {
  const lost = tray.lost; tray.lost = [];
  if (!lost.length) return;
  notify(lost.length === 1 ? `“${lost[0].text}” left the tray: ${why}` : `${lost.length} changes left the tray: ${why}`, 'warning');
  if (!tray.changes.length) say(`${changesWord(lost.length)} dropped`);
}
// The cursor and the ticks kept on what is there: by id, or by name when the id changed (a tag made or put back by Undo), else the tag above.
function settle(was, up) {
  const m = tray.model;
  if (app.st.cur !== Mo.LOOSE && (app.st.cur == null || !m.tags.has(app.st.cur))) { const byName = was && [...m.tags.values()].find(t => t.title === was); app.st.cur = byName ? byName.id : m.tags.has(up) ? up : Mo.tops(m)[0] ?? null; }
  for (const id of [...app.st.ticks]) if (!m.tags.has(id)) app.st.ticks.delete(id);
  if (app.st.propCur && !m.props.has(Number(app.st.propCur.split('·')[1]))) app.st.propCur = null;
}
function keepDone(graph, done) { if (graph === app.graph) tray.done = done; else dones.set(graph, done); syncUndo(); }
/* The arrow is the door's one Undo (PluginDoor.undo): offered at the end of the tray's done line whenever the tray has a done, taken
   away when it has none. An Apply is a change of many things, so it keeps its arrow until the next change of many things (the owner, 9 November
   2026): a value filled in elsewhere no longer takes it. When such a change has taken its place the done line goes too. The arrow lives at
   the end of the done line only, so it never waits at the bottom right while the map is out of sight. */
let undoOffered = false, groupChanges = 0;
function syncUndo() {
  const door = window.PluginDoor.undo;
  if (tray.done) {
    if (undoOffered && !door.has('structure')) { tray.done = null; undoOffered = false; return; }
    door.forget('structure');
    // docks: a change made away from the map (the ticked rows of a table) keeps its arrow at the bottom right where no tray stands.
    door.offer({ owner: 'structure', key: 'structure', at: () => host().querySelector('.st-tray .st-done'), text: tray.done.text, run: () => app.undo(), many: true, docks: !!tray.done.docks });
    undoOffered = true;
  } else if (undoOffered) { door.forget('structure'); undoOffered = false; }
}
// Another graph: its ids mean other tags, so nothing of the map's state carries over. What waited in the tray was never written, and goes with a word;
// the last Undo waits for its graph. The new graph may not answer at once.
async function otherGraph() {
  const waiting = tray.changes.length;
  if (tray.done) dones.set(tray.done.graph, tray.done);
  tray.discard(); tray.lost = [];
  app.graph = await S.db.graph().catch(() => '');
  tray.done = dones.get(app.graph) || null; dones.delete(app.graph); syncUndo();
  app.records = new Map(); app.readRecords();
  say(waiting ? `${changesWord(waiting)} dropped: another graph opened` : '');
  if (waiting && !mounts.onPage()) notify(tray.note, 'warning');
  Object.assign(app.st, startState(), { busy: app.st.busy });
  for (let tries = 0; tries < 25; tries++) {
    try { await S.db.graph(); await S.db.query('[:find ?t :where [?t :db/ident :logseq.class/Tag]]'); break; }   // a small question: the whole reading comes once, below
    catch (error) { await new Promise(resolve => setTimeout(resolve, 200)); }   // a read that fails here is the graph still opening, nothing to say yet
  }
  await app.reread();
}
let mounts = { onPage: () => false, openPage() {}, openInspector() {} };
let reReadTimer = 0;
const reachesMap = window.PluginDoor.structureWatch();
function graphChanged(change) {
  // A change from outside: read again after a quiet moment, so the counts and a waiting tray stay true. Words being written
  // leave the map as it is.
  if (!reachesMap(change) || app.st.busy) return;
  clearTimeout(reReadTimer);
  // Read again even with no map or line open: the # list, the tag lists and the menus draw from this reading, and a tag made or
  // moved in Logseq itself must show in its place there (18 November 2026: a tag made outside the map stood in the # list
  // without its path until the plugin was reloaded).
  reReadTimer = setTimeout(() => { if (!app.st.busy) app.reread(); }, 1500);
}

async function main() {
  S.inspector.model = () => tray.model;
  S.inspector.changed = () => tagPage();   // the Ontology section opened, closed or folded: a tag's lines go into it or out
  S.inspector.start();
  mounts = S.mount.mount(app);
  logseq.App.registerCommandPalette({ key: 'structure-open', label: 'Ontology: the map of tags and properties' }, () => app.openMain());
  logseq.App.registerCommandPalette({ key: 'structure-inspector', label: 'Ontology: this page’s part, in the right sidebar' }, () => mounts.openInspector());
  logseq.provideModel({ structureOpen: () => app.openMain() });
  // The map is a button in Logseq's toolbar (the owner, 14 November 2026); the Ontology section stays in Logseq's ··· menu.
  const { onStop } = S.base;
  // Look's × on a tag's own page asks for the tag to leave its place: the map asks first (askTakeOut).
  onStop(window.PluginDoor.offerAsk('structure.takeOut', (tagUuid, parentUuid) => app.askTakeOut(tagUuid, parentUuid)));
  onStop(window.PluginDoor.addMenuItem({ key: 'inspector', label: 'Ontology in the sidebar', icon: 'info-circle', run: () => mounts.openInspector() }));
  window.PluginDoor.toolbarItem('structure-open', 'structureOpen', 'Ontology: the map of tags and properties', 'structure');
  onStop(logseq.DB.onChanged(change => graphChanged(change)));
  onStop(logseq.App.onCurrentGraphChanged(() => otherGraph()));
  onStop(logseq.App.onRouteChanged?.(() => { tagPage(); }));
  app.graph = await S.db.graph().catch(() => '');
  await app.reread();
  app.readRecords();
  adopt();
  tagPage();
  const doc = host();
  // An early pass on the one screen watcher (plugin.js): called in the same turn as Logseq's own drawing, before the browser paints, so the lines stand
  // above Logseq's table in its first frame and nothing below them is pushed down a moment later (motion-check, 6 November 2026).
  // Only elements coming or going in the main view count, as when Structure kept a watcher of its own there.
  const main = doc.querySelector('#main-content-container') || doc.body;
  S.base.watch(function tagPagePass(page, records) { if (records.some(r => r.type === 'childList' && main.contains(r.target))) tagPage(); if (records.some(r => r.type === 'childList' && r.target.closest?.('#right-sidebar'))) splitPage(); }, { early: true });
  // The page on the right half of two pages side by side (split.js) gets its lines as the main page does.
  onStop(window.PluginDoor.split?.onChange?.(() => splitPage()));
  splitPage();
  where = S.where.start(app, doc);
  app.where = where.ask;
  S.whereTool = where;   // the tag tree picker, for the tag menu's "Change to another tag…"   // a new tag asks where it goes: the # list and Logseq's Set Tags list ask the same question
  stopHash = S.hash.start(app, doc);
  stopValues = S.valueList.start(app, doc);
  stopTagMenu = S.tagMenu.start(app, doc);
  stopTableValues = S.tableValues.start(app, doc);
}
const stop = () => { S.inspector.stop(); mounts.stop?.(); where?.stop(); stopHash?.(); stopValues?.(); stopTagMenu?.(); stopTableValues?.(); for (const v of [...app.views]) v.destroy(); host().querySelectorAll('.st-tagholder').forEach(n => n.remove()); return S.base.stop(); };   // the base: the passes, the hooks, the menu's lines and the stylesheets
/* The lines on a tag's own page: set above Logseq's table, in the page's own column, each time Logseq draws a tag's page. */
let where = null, stopHash = null, stopValues = null, stopTagMenu = null, stopTableValues = null, tagTimer = 0, tagAsking = 0;
const days = new Set();   // pages found to be journal days, which a tag's lines never stand on
const lookup = uuid => [...tray.model.tags.values()].find(t => t.uuid === uuid)?.id ?? null;   // the tag whose page this is, or null
const SPLIT = '#right-sidebar[data-lk-split] .sidebar-item[data-lk-split-item]';
const onRight = v => !!v.root.closest(SPLIT);
function place(doc, inner, here, id) {
  const views = [...app.views].filter(v => (v.mode === 'tag' || v.mode === 'line') && v.root.parentElement?.classList.contains('st-tagholder') && !onRight(v));
  const clear = () => { for (const v of views) v.destroy(); doc.querySelectorAll('.st-tagholder').forEach(n => { if (!n.closest(SPLIT)) n.remove(); }); };
  S.inspector.pageKnown?.(id == null);   // a page that is no tag's: the Ontology section stands aside, and may say so at once
  if (id == null) { clear(); return; }
  /* A tag's page: Parent on one line above its title, always; its other lines (Child tags first) in the Ontology section while that
     stands in the right sidebar. A property's page: nothing of the plugin's, above Logseq's table (the owner, 24 November 2026: "the
     things that appear on a property page are also either unnecessary or getting ahead of itself") or in the sidebar, where the
     Ontology section stands aside as on any page that is no tag's (the same day: the lines that still stood there were dropped). */
  const box = S.inspector.top(), title = [...inner.children].find(c => !c.classList.contains('st-tagholder')) || null;
  const want = [{ mode: 'line', parent: inner, before: title, cls: 'st-holder-line' }, ...(box ? [{ mode: 'tag', parent: box, before: null, cls: '' }] : [])];
  const same = want.length === views.length && want.every(w => views.some(v => v.mode === w.mode && v.tag === id && v.root.isConnected && v.root.parentElement.parentElement === w.parent));
  if (same) {
    for (const w of want) { const holder = views.find(v => v.mode === w.mode).root.parentElement; if (w.parent === inner && w.before !== holder && holder.nextElementSibling !== w.before) inner.insertBefore(holder, w.before); }
    return false;
  }
  clear();
  app.st.cur = id;
  for (const w of want) {
    const holder = doc.createElement('div'); holder.className = `st-tagholder st-holder-tag ${w.cls}`;
    w.parent.insertBefore(holder, w.before);
    app.mounted(S.view.make(holder, w.mode, app, { tag: id }));
  }
  return true;
}
function tagPage() {
  setTimeout(() => S.inspector.idle());   // after the lines are placed: the faint line under them says what the panel waits for
  const doc = host(), inner = doc.querySelector('#main-content-container .page-inner'), ask = ++tagAsking;
  const here = inner && (inner.querySelector(':scope > .page-tabs') || inner.querySelector(':scope > .ls-page-blocks'));
  if (!here) return place(doc, null, null, null);
  /* A journal day is never a tag's page, even where the graph holds the day as a tag, or a tag shares the day's name: nothing is
     set above it. The page is the one drawn on screen (its title's block), since Logseq's answer to which page is current can
     still name the last one; the day is told three ways: Logseq's mark on the page, its journal date, a journal day of its name.
     With the title's block on screen everything is known at once and the lines are placed in the same turn; only a journal day
     that is also a tag needs the graph's answer, which takes them away again. */
  const shown = doc.querySelector('#main-content-container .ls-page-title .ls-block[blockid]')?.getAttribute('blockid') || '';
  if (shown) {
    if (inner.closest('.page')?.classList.contains('is-journals')) return place(doc, inner, here, null);
    if (days.has(shown)) return place(doc, inner, here, null);
    if (place(doc, inner, here, lookup(shown))) S.db.isDay(shown).then(day => { if (!day) return; days.add(shown); tagPage(); }).catch(() => {});
    return;
  }
  if (!tagTimer) tagTimer = setTimeout(() => { tagTimer = 0; tagPageAsked(); }, 150);
}
/* The right half of two pages side by side: a tag's page gets its Parent line over the split's title; a property's page gets
   nothing, as on the main page (24 November 2026); the inspector stays the main page's. */
function splitPage() {
  const doc = host(), panel = doc.querySelector(`${SPLIT} .sidebar-panel-content`), now = window.PluginDoor.split?.page?.();
  const views = [...app.views].filter(v => (v.mode === 'tag' || v.mode === 'line') && v.root.parentElement?.classList.contains('st-tagholder') && onRight(v));
  const clear = () => { for (const v of views) v.destroy(); doc.querySelectorAll(`${SPLIT} .st-tagholder`).forEach(n => n.remove()); };
  const inner = panel?.querySelector(':scope > .page > .grid'), here = inner && (inner.querySelector(':scope > .page-tabs') || inner.querySelector(':scope > .ls-page-blocks'));
  if (!now?.page || !here || days.has(now.uuid)) return clear();
  const id = lookup(now.uuid);
  if (id == null) return clear();
  const want = { mode: 'line', parent: panel, before: panel.firstElementChild, cls: 'st-holder-line' };
  const view = views.length === 1 && views[0].mode === want.mode && views[0].tag === id && views[0].root.isConnected ? views[0] : null;
  if (view) { const holder = view.root.parentElement; if (holder.parentElement !== want.parent || (want.mode === 'line' ? want.parent.firstElementChild !== holder : holder.nextElementSibling !== want.before)) want.parent.insertBefore(holder, want.mode === 'line' ? want.parent.firstElementChild : want.before); return; }
  clear();
  const holder = doc.createElement('div'); holder.className = `st-tagholder st-holder-tag ${want.cls}`;
  want.parent.insertBefore(holder, want.mode === 'line' ? want.parent.firstElementChild : want.before);
  app.mounted(S.view.make(holder, want.mode, app, { tag: id }));
  S.db.isDay(now.uuid).then(day => { if (!day) return; days.add(now.uuid); splitPage(); }).catch(() => {});
}
// No title's block on screen yet: Logseq is asked which page is current.
async function tagPageAsked() {
  const doc = host(), inner = doc.querySelector('#main-content-container .page-inner'), ask = ++tagAsking;
  const here = inner && (inner.querySelector(':scope > .page-tabs') || inner.querySelector(':scope > .ls-page-blocks'));
  if (!here) return place(doc, null, null, null);
  let id = null;
  try {
    const page = await logseq.Editor.getCurrentPage();
    const uuid = String(page?.uuid || '');
    const day = !!inner.closest('.page')?.classList.contains('is-journals') || !!page?.journalDay || await S.db.isDay(uuid);
    if (uuid && !day) id = lookup(uuid);
  } catch (error) { /* no page on screen */ }
  if (ask !== tagAsking) return;
  place(doc, inner, here, id);
}
// A holder Logseq already shows (the map's page or the sidebar panel, left from before a reload of the plugin) gets its drawing.
function adopt() {
  for (const holder of host().querySelectorAll('.st-holder-insp')) if (!holder.firstChild) S.inspector.mounted(holder);
  for (const holder of host().querySelectorAll('.st-holder')) if (!holder.querySelector('.st')) { try { app.mounted(S.view.make(holder, 'page', app)); } catch (error) { console.error('Structure: could not draw into a holder', error); } }
}
window.PluginDoor.describe('structure', { none: 'Ontology has nothing to set.', picture: on => `<span class="sw-faintw">The toolbar</span><br>${on ? 'Ontology<br>' : ''}···` });
window.PluginDoor.register({
  key: 'structure', title: 'Ontology',   /* the owner, 12 November 2026: "Why don't we call it Ontology. Lets change name of Structure too to that"; the folder, the key and the names in the code stay */ about: 'The map of the graph’s tags and properties: one screen to see the whole shape, move things and change many at once, with one Undo.',
  start: main, stop,
});
})();
