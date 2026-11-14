/* Todo: Logseq's own tasks as one short list, on a page of its own and in the right sidebar, drawn by the same code (view.js)
   from the one state kept here. Loaded after its graph reader and its drawing (files.js). The ways in: the command palette
   (Todo, and g then d outside a bullet, as Logseq's own g pairs), the ticked box in Logseq's toolbar, the sidebar's Todo tab. */
(function () {
const T = window.Todo;
const Door = window.PluginDoor;
const { dates, notify } = Door;
const ROUTE = '/todo', SIDE = 'todo-side', KEYS = 'g d';
const FOLD_AFTER = 600;   // a ticked row stays a moment, crossed out, then rolls away into Done

let changes = 0;
const app = T.app = {
  tasks: [], read: false, views: new Set(), doneOpen: false, byNow: '',
  ticking: new Map(),   // uuid → { timer, key }: ticked, crossed out, waiting to roll away
  status: new Map(),    // uuid → the status written here, until the graph is read again
  shown: t => app.status.get(t.uuid) || t.status,
  /* The list in groups, by the one grouping chosen (app.by): Day, as Today, Coming up and Any time; Page, A to Z, the journal
     days together as Journals after them; Tag, a task under each of its tags besides Task, No tag last; Priority, Urgent to Low,
     then No priority; Status, Doing, then Todo. Within a group the day order: late first, then by day, those without a day last.
     Done, at the foot, whatever the grouping. Each part: { key, head, rows, none (its nothing-here line, Day's only),
     today (Today's heading says the day, so its rows do not), where (the page line under each row; not where the heading names it) }. */
  groups() {
    const today = dates.today(), open = [], done = [];
    for (const t of app.tasks) {
      const s = app.shown(t), ticking = app.ticking.has(t.uuid);   // a task just ticked stays in its place, crossed out, until it rolls away
      if (s === 'done' && !ticking) done.push(t);
      else if (ticking || T.db.OPEN.has(s)) open.push(t);
    }
    const byDay = (a, b) => (a.day ? 0 : 1) - (b.day ? 0 : 1) || a.day - b.day || a.created - b.created;
    done.sort((a, b) => b.updated - a.updated);
    const by = app.by(), parts = [];
    const part = (key, head, rows, more = {}) => ({ key, head, rows: rows.sort(byDay), where: true, ...more });
    const sorted = (map, last) => [...map.keys()].filter(k => k !== last).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).concat(map.has(last) ? [last] : []);
    if (by === 'Day') {
      const g = { today: [], coming: [], any: [] };
      for (const t of open) (!t.day ? g.any : t.day <= today ? g.today : g.coming).push(t);
      parts.push(part('today', 'Today', g.today, { none: 'Nothing to do today.', today: true }), part('coming', 'Coming up', g.coming, { none: 'Nothing coming up.' }),
        { key: 'any', head: 'Any time', rows: g.any.sort((a, b) => a.created - b.created), where: true, none: 'Nothing without a day.' });
    } else if (by === 'Page' || by === 'Tag') {
      const map = new Map(), LAST = by === 'Page' ? 'Journals' : 'No tag';
      const put = (k, t) => { if (!map.has(k)) map.set(k, []); map.get(k).push(t); };
      for (const t of open) {
        if (by === 'Page') put(t.page.journal ? LAST : t.page.title || 'Untitled', t);
        else if (t.tags.length) for (const tag of t.tags) put(tag, t); else put(LAST, t);
      }
      for (const k of sorted(map, LAST)) parts.push(part(`${by}:${k}`, k, map.get(k), { where: by === 'Tag' || k === LAST, tag: by === 'Tag' && k !== LAST }));
    } else {
      const order = by === 'Priority' ? [['urgent', 'Urgent'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['', 'No priority']] : [['doing', 'Doing'], ['todo', 'Todo']];
      const of = t => by === 'Priority' ? (order.some(([k]) => k === t.priority) ? t.priority : '') : t.status === 'doing' ? 'doing' : 'todo';
      for (const [k, head] of order) { const rows = open.filter(t => of(t) === k); if (rows.length) parts.push(part(`${by}:${k}`, head, rows)); }
    }
    return { parts, done };
  },
  // The grouping in force, one for the page and the sidebar alike, kept in the plugin's settings (todoGroupBy).
  by: () => { const v = app.byNow || logseq.settings?.todoGroupBy; return T.db.GROUPINGS.includes(v) ? v : 'Day'; },
  setBy(v) {
    if (!T.db.GROUPINGS.includes(v) || v === app.by()) return;
    app.byNow = v;
    logseq.updateSettings({ todoGroupBy: v });
    app.draw();
  },
  draw() { for (const v of [...app.views]) { if (!v.root.isConnected) { app.views.delete(v); continue; } try { v.draw(); } catch (error) { console.error('Todo: a draw failed', error); } } },
  async reread() {
    try { app.tasks = await T.db.read(); app.read = true; app.status.clear(); }
    catch (error) { console.error('Todo: the tasks could not be read', error); if (!app.read) notify(`The tasks could not be read: ${Door.reason(error, 'Logseq did not answer. Open Todo again in a moment')}`, 'warning'); }
    app.draw();
  },
  // Every row of a task, in every view, for the Undo arrow to sit at.
  rowsOf: uuid => [...app.views].flatMap(v => v.rows(uuid)).map(r => r.querySelector('.td-line')).filter(Boolean),
  open(uuid, inSidebar) { if (inSidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); },
  foldDone() {
    const rows = [...app.views].flatMap(v => [...v.root.querySelectorAll('.td-done-rows')]);
    if (app.doneOpen) { Door.rollUp(rows).then(() => { app.doneOpen = false; app.draw(); }); return; }
    app.doneOpen = true; app.draw();
    Door.unroll([...app.views].flatMap(v => [...v.root.querySelectorAll('.td-done-rows')]));
  },
  /* A box pressed. An open task: ticked and crossed out, Done written, and after a moment the row rolls away into Done. Pressed
     again in that moment, it is the Undo. A task in Done: back to Todo. Each change offers the one Undo at its row. */
  async tick(uuid) {
    const t = app.tasks.find(x => x.uuid === uuid);
    if (!t) return;
    const waiting = app.ticking.get(uuid);
    if (waiting) { clearTimeout(waiting.timer); app.ticking.delete(uuid); app.draw(); if (Door.undo.has(waiting.key)) Door.undo.take(waiting.key); return; }
    const was = app.shown(t), to = was === 'done' ? 'todo' : 'done', key = `todo:${++changes}`;
    const entry = { timer: 0, key };
    if (to === 'done') app.ticking.set(uuid, entry);
    app.status.set(uuid, to);
    app.draw();
    let undo;
    try { undo = await T.db.setStatus(uuid, to, was); }
    catch (error) {
      console.error('Todo: the status could not be set', error);
      app.ticking.delete(uuid); app.status.set(uuid, was); app.draw();
      return notify(`Not changed: ${Door.reason(error, 'Logseq did not take the status')}`, 'warning');
    }
    const name = t.words.length > 40 ? t.words.slice(0, 38) + '…' : t.words;
    Door.undo.offer({ owner: 'todo', key, node: uuid, text: to === 'done' ? `Ticked “${name}”` : `Unticked “${name}”`, at: () => app.rowsOf(uuid),
      run: async () => {
        const w = app.ticking.get(uuid); if (w) { clearTimeout(w.timer); app.ticking.delete(uuid); }
        app.status.set(uuid, was); app.draw();
        if (await undo() === 'kept') { notify('It has changed since, so it stays', 'warning'); app.status.delete(uuid); }
        app.later();
      },
      onFail: error => { console.error('Todo: could not undo', error); notify('The status could not be put back', 'warning'); app.later(); } });
    if (to === 'done') entry.timer = setTimeout(async () => {
      if (app.ticking.get(uuid) !== entry) return;
      await Door.rollUp(app.rowsOf(uuid).map(line => line.closest('.td-row')));
      if (app.ticking.get(uuid) !== entry) return;
      app.ticking.delete(uuid); app.draw();
    }, FOLD_AFTER);
  },
  // A new task on today's journal, its day from the words.
  async add(text) {
    const found = T.db.dayIn(text), words = found ? found.words : text, day = found ? found.day : 0;
    let made;
    try { made = await T.db.add(words, day); }
    catch (error) { console.error('Todo: the task could not be added', error); return notify(`Not added: ${Door.reason(error, 'Logseq did not take the bullet')}`, 'warning'); }
    await app.reread();
    const name = words.length > 40 ? words.slice(0, 38) + '…' : words;
    Door.undo.offer({ owner: 'todo', key: `todo:${++changes}`, node: made.uuid, text: `Added “${name}”`, at: () => app.rowsOf(made.uuid),
      run: async () => { if (await T.db.unadd(made) === 'kept') notify('It has changed since, so it stays', 'warning'); await app.reread(); },
      onFail: error => { console.error('Todo: could not undo', error); notify('The task could not be taken back', 'warning'); } });
    Door.unroll(app.rowsOf(made.uuid).map(line => line.closest('.td-row')));
  },
  later() { clearTimeout(readTimer); readTimer = setTimeout(() => { if (app.views.size && !app.ticking.size) app.reread(); else if (app.ticking.size) app.later(); }, 300); },
};
let readTimer = 0;

function mount() {
  const React = logseq.Experiments?.React;
  if (!React?.createElement) { console.error('Todo: Logseq gives plugins no React here, so the list cannot be shown'); return; }
  const component = mode => function TodoView() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      let view = null;
      try { view = T.view.make(holder, mode); view.focus(); app.reread(); } catch (error) { console.error('Todo: the list could not be drawn', error); }
      if (mode === 'side') { const heading = holder.closest('.sidebar-item')?.querySelector('.page-title h3'); if (heading) heading.textContent = 'Todo'; }
      return () => view?.destroy();
    }, []);
    return React.createElement('div', { ref, className: `td-holder td-holder-${mode}` });
  };
  try { const Page = component('page'); logseq.Experiments.registerRouteRenderer('todo', { name: 'todo', path: ROUTE, render: () => React.createElement(Page) }); }
  catch (error) { console.error('Todo: the page could not be added', error); }
  try { const Side = component('side'); logseq.Experiments.registerSidebarRenderer(SIDE, { title: 'Todo', render: () => React.createElement(Side) }); }
  catch (error) { console.error('Todo: the sidebar tab could not be added', error); }
  // The Todo tab of the right sidebar (sidebar-tabs.js), after Links: picked, it opens if it is not open yet.
  T.base.onStop(Door.sideTabs?.add({ key: 'todo', word: 'Todo', order: 4,
    find: doc => doc.getElementById('_sidebar.' + SIDE)?.closest('.sidebar-item') || null,
    open: () => { logseq.Editor.openInRightSidebar('_sidebar.' + SIDE); } }));
}
const openPage = () => { const win = Door.host().defaultView; if (win.location.hash.split('?')[0] !== '#' + ROUTE) win.location.hash = '#' + ROUTE; else for (const v of app.views) if (v.mode === 'page') v.focus(); };

async function main() {
  mount();
  const { onStop } = T.base;
  logseq.App.registerCommandPalette({ key: 'todo-open', label: 'Todo', keybinding: { binding: KEYS } }, openPage);
  logseq.App.registerCommandPalette({ key: 'todo-side', label: 'Todo in the sidebar' }, async () => { Door.sideTabs?.show('todo'); await logseq.Editor.openInRightSidebar('_sidebar.' + SIDE); await logseq.App.setRightSidebarVisible?.(true); });
  // A button in Logseq's toolbar, beside Ontology's, before the ··· (the owner, 14 November 2026).
  logseq.provideModel({ todoOpen: openPage });
  Door.toolbarItem('todo-open', 'todoOpen', 'Todo', 'todo');
  // A change anywhere: read again after a quiet moment, so a task ticked, added or dated elsewhere shows here.
  onStop(logseq.DB.onChanged(() => { if (app.views.size) app.later(); }));
  // The grouping changed in the settings window: drawn at once in both places.
  onStop(logseq.onSettingsChanged((now, before) => { if (!Door.settingChanged(['todoGroupBy'], now, before)) return; app.byNow = ''; app.draw(); }));
  onStop(logseq.App.onCurrentGraphChanged(() => { Door.undo.clear('todo'); T.db.forget(); app.ticking.clear(); app.tasks = []; app.read = false; app.draw(); app.reread(); }));
  // A new day while the list is open: Today, Coming up and the late days move on.
  let day = dates.today();
  const tick = setInterval(() => { if (dates.today() !== day) { day = dates.today(); app.draw(); } }, 60000);
  onStop(() => clearInterval(tick));
  onStop(() => clearTimeout(readTimer));
}
function stop() {
  Door.menu.close();
  for (const v of [...app.views]) v.destroy();
  Door.undo.clear('todo');
  const done = T.base.stop();
  T.base.sweep();
  return done;
}
const schema = [
  { key: 'todoGroupBy', type: 'enum', default: 'Day', enumChoices: T.db.GROUPINGS, title: 'Group the Todo list by',
    description: 'How the Todo page and the Todo tab of the right sidebar group the tasks: by Day (Today, Coming up, Any time), by the Page each task is on, by its Tag, its Priority or its Status. Within a group the tasks stay in day order. The same choice is in the list itself, at the top right, “By day”.' },
];
const groupWords = { Day: ['Today', 'Coming up', 'Any time'], Page: ['Dr. Mei Chen', 'Report', 'Journals'], Tag: ['Consultation', 'Symptom', 'No tag'], Priority: ['Urgent', 'High', 'No priority'], Status: ['Doing', 'Todo'] };
Door.describe('todo', { schema: [{ type: 'heading', title: 'The Todo list', place: 'page' }, schema[0]],
  specimen: (item, value) => item.key === 'todoGroupBy' ? (groupWords[value] || groupWords.Day).map(w => `<span class="sw-k">${w}</span>`).join('<br>') : '',
  picture: on => `<span class="sw-faintw">The toolbar</span><br>${on ? 'Todo<br>' : ''}···` });
Door.register({
  key: 'todo', title: 'Todo', schema, about: 'Logseq’s tasks as one short list, on a page of its own and in the right sidebar: add one with a day in its words, tick it off.',
  start: main, stop,
});
})();
