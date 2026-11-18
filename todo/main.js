/* Todo: Logseq's own tasks as one short list, on a page of its own and in the right sidebar, drawn by the same code (view.js)
   from the one state kept here. Loaded after its graph reader and its drawing (files.js). The ways in: the command palette
   (Todo, and g then d outside a bullet, as Logseq's own g pairs), the checkmark in Logseq's toolbar, which opens Todo in the right sidebar as a section with its ×. */
(function () {
const T = window.Todo;
const Door = window.PluginDoor;
const { dates, notify } = Door;
const ROUTE = '/todo', SIDE = 'todo-side', KEYS = 'g d';
const FOLD_AFTER = 600;   // a ticked row stays a moment, crossed out, then rolls away into Done

let changes = 0;
const byDay = (a, b) => (a.day ? 0 : 1) - (b.day ? 0 : 1) || a.day - b.day || a.created - b.created;
const az = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
// One level of grouping (app.groups): the tasks given, in parts by one grouping. first: the list's own level, where Day keeps its
// three groups with their nothing-here lines; inside another group only the groups with tasks stand.
function split(open, by, today, first) {
  const parts = [];
  const part = (key, head, rows, more = {}) => ({ key, head, rows: rows.slice().sort(byDay), where: true, ...more });
  if (by === 'Day') {
    const g = { today: [], coming: [], any: [] };
    for (const t of open) (!t.day ? g.any : t.day <= today ? g.today : g.coming).push(t);
    const all = [part('today', 'Today', g.today, { none: 'Nothing to do today.', today: true }), part('coming', 'Coming up', g.coming, { none: 'Nothing coming up.' }),
      { key: 'any', head: 'Any time', rows: g.any.slice().sort((a, b) => a.created - b.created), where: true, none: 'Nothing without a day.' }];
    return first ? all : all.filter(p => p.rows.length);
  }
  if (by === 'Page' || by === 'Tag') {
    const map = new Map(), LAST = by === 'Page' ? 'Journals' : 'No tag';
    const put = (k, t) => { if (!map.has(k)) map.set(k, []); map.get(k).push(t); };
    for (const t of open) {
      if (by === 'Page') put(t.page.journal ? LAST : t.page.title || 'Untitled', t);
      else if (t.tags.length) for (const tag of t.tags) put(tag, t); else put(LAST, t);
    }
    const keys = [...map.keys()].filter(k => k !== LAST).sort(az).concat(map.has(LAST) ? [LAST] : []);
    for (const k of keys) parts.push(part(`${by}:${k}`, k, map.get(k), { where: by === 'Tag' || k === LAST, tag: by === 'Tag' && k !== LAST }));
    return parts;
  }
  let order, of;
  if (by === 'Priority') {
    order = [['urgent', 'Urgent'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['', 'No priority']];
    of = t => order.some(([k]) => k === t.priority) ? t.priority : '';
  } else {
    // Status: what is under way first, then what is next, waiting on a review, and what can wait: Doing, Todo, In Review, Backlog;
    // a status of the person's own after In Review. A task just ticked stays in the group it was in.
    const known = T.app.openStatuses().map(s => [s.name, s.title]);
    const titled = name => name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    for (const k of ['doing', 'todo', 'in-review', 'backlog']) if (!known.some(([n]) => n === k)) known.push([k, titled(k)]);
    for (const t of open) if (!known.some(([k]) => k === t.status)) known.push([t.status, titled(t.status)]);
    const RANK = { doing: 0, todo: 1, 'in-review': 2, backlog: 4 }, rank = k => RANK[k] ?? 3;
    order = known.map((x, i) => [x, i]).sort((a, b) => rank(a[0][0]) - rank(b[0][0]) || a[1] - b[1]).map(([x]) => x);
    of = t => T.app.ticking.has(t.uuid) ? t.status : T.app.shown(t);
  }
  for (const [k, head] of order) { const rows = open.filter(t => of(t) === k); if (rows.length) parts.push(part(`${by}:${k}`, head, rows)); }
  return parts;
}
const app = T.app = {
  tasks: [], read: false, failed: '', views: new Set(), doneOpen: false, byNow: '', thenNow: '', hiddenNow: null,
  ticking: new Map(),   // uuid → { timer, key }: ticked, crossed out, waiting to roll away
  status: new Map(),    // uuid → the status written here, until the graph is read again
  shown: t => app.status.get(t.uuid) || t.status,
  /* The list in groups (the owner, 18 November 2026: "nested grouping, for example by day and then by page"): by the grouping
     chosen (app.by), and inside each group, when one is chosen, by a second (app.then). One level: Day, as Today, Coming up
     and Any time; Page, A to Z, the journal days together as Journals after them; Tag, a task under each of its tags besides
     Task, No tag last; Priority, Urgent to Low, then No priority; Status, each open status in Logseq's order. Within a group the
     day order: late first, then by day, those without a day last. Only the statuses shown (app.hidden, the Show menu) are listed;
     Done, at the foot, whatever the grouping. Each part: { key, head, rows, none (its nothing-here line, Day's first level only),
     today (Today's heading says the day, so its rows do not), where (the page line under each row; not where a heading names the
     page), tag (the heading is a tag), subs (the second level's parts, when there is one) }. */
  groups() {
    const today = dates.today(), open = [], done = [], hidden = app.hidden();
    for (const t of app.tasks) {
      const s = app.shown(t), ticking = app.ticking.has(t.uuid);   // a task just ticked stays in its place, crossed out, until it rolls away
      if (s === 'done' && !ticking) done.push(t);
      else if (ticking || (T.db.isOpen(s) && !hidden.has(s))) open.push(t);
    }
    done.sort((a, b) => b.updated - a.updated);
    const by = app.by(), then = app.then();
    const parts = split(open, by, today, true);
    if (then) for (const p of parts) {
      p.subs = split(p.rows, then, today, false).map(q => ({ ...q, key: `${p.key}/${q.key}`, where: p.where && q.where, today: p.today || q.today }));
    }
    return { parts, done };
  },
  // The grouping in force, one for the page and the sidebar alike, kept in the plugin's settings (todoGroupBy), and the second
  // level inside it (todoThenBy, 'None' for none; never the same as the first).
  by: () => { const v = app.byNow || logseq.settings?.todoGroupBy; return T.db.GROUPINGS.includes(v) ? v : 'Day'; },
  then: () => { const v = app.thenNow || logseq.settings?.todoThenBy; return T.db.GROUPINGS.includes(v) && v !== app.by() ? v : ''; },
  setBy(v) {
    if (!T.db.GROUPINGS.includes(v) || v === app.by()) return;
    const clash = v === app.then();
    app.byNow = v;
    if (clash) app.thenNow = 'None';
    logseq.updateSettings(clash ? { todoGroupBy: v, todoThenBy: 'None' } : { todoGroupBy: v });
    app.draw();
  },
  setThen(v) {
    if (v !== 'None' && !T.db.GROUPINGS.includes(v)) return;
    if ((v === 'None' ? '' : v) === app.then() || v === app.by()) return;
    app.thenNow = v;
    logseq.updateSettings({ todoThenBy: v });
    app.draw();
  },
  /* Which statuses are left out (the Show menu): none at first, so every open status is listed, one of the person's own too;
     kept in the plugin's settings (todoHidden, the statuses' short names, comma between). */
  hidden: () => new Set(String(app.hiddenNow ?? logseq.settings?.todoHidden ?? '').split(',').map(x => x.trim()).filter(Boolean)),
  // A status shown or left out; answers whether it is shown now. The last one shown cannot be left out: the list is never empty by a filter.
  toggleShow(name) {
    const h = app.hidden(), open = app.openStatuses().map(s => s.name);
    if (h.has(name)) h.delete(name);
    else if (open.filter(n => !h.has(n)).length > 1) h.add(name);
    const next = [...h].join(',');
    app.softly(() => { app.hiddenNow = next; });
    logseq.updateSettings({ todoHidden: next });
    return !h.has(name);
  },
  showAll() { app.softly(() => { app.hiddenNow = ''; }); logseq.updateSettings({ todoHidden: '' }); },
  /* A change to which tasks are listed (Show): the rows and groups that go roll up where they stand, then the list is drawn
     again and those that come roll out; nothing else moves, nothing snaps away (the owner, 18 November 2026: "no flashes or jumps"). */
  async softly(apply) {
    const seen = () => { const { parts } = app.groups(); return { rows: new Set(parts.flatMap(p => p.rows.map(t => t.uuid))), groups: new Set(parts.flatMap(p => [p.key, ...(p.subs || []).map(q => q.key)])) }; };
    const was = seen();
    apply();
    const now = seen();
    const going = [...app.views].flatMap(v => [...v.root.querySelectorAll('.td-list [data-group]')].filter(g => g.dataset.group !== 'done' && !now.groups.has(g.dataset.group))
      .concat([...v.root.querySelectorAll('.td-list .td-row[data-uuid]')].filter(r => !r.classList.contains('td-done') && !now.rows.has(r.dataset.uuid))));
    if (going.some(el => el.getBoundingClientRect().height)) await Door.rollUp(going);   // nothing on screen to roll: drawn at once
    app.draw();
    const coming = [...app.views].flatMap(v => [...v.root.querySelectorAll('.td-list [data-group]')].filter(g => g.dataset.group !== 'done' && !was.groups.has(g.dataset.group))
      .concat([...v.root.querySelectorAll('.td-list .td-row[data-uuid]')].filter(r => !r.classList.contains('td-done') && !was.rows.has(r.dataset.uuid) && was.groups.has(r.closest('[data-group]')?.dataset.group))));   // a row in a group that is itself new rolls out with its group
    Door.unroll(coming);
  },
  // The open statuses, in Logseq's order: every status the graph has but Done and Canceled.
  openStatuses: () => [...T.db.statuses.values()].filter(s => T.db.isOpen(s.name)),
  draw() { for (const v of [...app.views]) { if (!v.root.isConnected) { app.views.delete(v); continue; } try { v.draw(); } catch (error) { console.error('Todo: a draw failed', error); } } },
  async reread() {
    try { app.tasks = await T.db.read(); app.read = true; app.failed = ''; app.status.clear(); }
    catch (error) { console.error('Todo: the tasks could not be read', error); if (!app.read) app.failed = Door.reason(error, 'Logseq did not answer. Open Todo again in a moment'); if (!app.read) notify(`The tasks could not be read: ${Door.reason(error, 'Logseq did not answer. Open Todo again in a moment')}`, 'warning'); }
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
  /* A status picked from the task's circle (its list, view.js): written at once, with the one Undo at the row. Done: the row is
     crossed out and after a moment rolls away into Done. Todo or Doing: the row stays, its circle changed. Backlog, In Review,
     Canceled (any status that is neither open nor Done): the row rolls away, and the Undo waits at the bottom right. The Undo puts
     back exactly what was there, an empty Status included (a Task whose Status was empty, shown as Todo). */
  async setTo(uuid, to) {
    const t = app.tasks.find(x => x.uuid === uuid);
    if (!t || !to) return;
    const waiting = app.ticking.get(uuid);
    if (waiting) { clearTimeout(waiting.timer); app.ticking.delete(uuid); }
    const wasEmpty = t.empty && !app.status.has(uuid);
    const was = app.shown(t);
    if (to === was && !wasEmpty) { if (waiting) app.draw(); return; }
    const key = `todo:${++changes}`, entry = { timer: 0, key };
    const rows = () => app.rowsOf(uuid).map(line => line.closest('.td-row')).filter(Boolean);
    const leaves = to !== 'done' && (!T.db.isOpen(to) || app.hidden().has(to));   // Canceled, or a status the Show menu leaves out
    let going = null;
    if (to === 'done') { app.ticking.set(uuid, entry); app.status.set(uuid, to); app.draw(); }
    else if (leaves) going = Door.rollUp(rows()).then(() => { app.status.set(uuid, to); app.draw(); });   // drawn away as the roll ends, so it never shows again
    else { const had = app.status.has(uuid), prev = app.status.get(uuid); await app.moving(uuid, () => app.status.set(uuid, to), () => { if (had) app.status.set(uuid, prev); else app.status.delete(uuid); }); }   // Todo, Doing and the rest: the row stays, or rolls to its new group (By status)
    let undo;
    try { undo = await T.db.setStatus(uuid, to, wasEmpty ? '' : was); }
    catch (error) {
      console.error('Todo: the status could not be set', error);
      await going;
      app.ticking.delete(uuid); if (wasEmpty) app.status.delete(uuid); else app.status.set(uuid, was); app.draw();
      return notify(`Not changed: ${Door.reason(error, 'Logseq did not take the status')}`, 'warning');
    }
    await going;
    const name = t.words.length > 40 ? t.words.slice(0, 38) + '…' : t.words, title = T.db.statuses.get(to)?.title || to;
    Door.undo.offer({ owner: 'todo', key, node: uuid, text: to === 'done' ? `Ticked “${name}”` : `Set “${name}” to ${title}`, at: () => app.rowsOf(uuid),
      run: async () => {
        const w = app.ticking.get(uuid); if (w) { clearTimeout(w.timer); app.ticking.delete(uuid); }
        const shown = new Set(rows());
        if (shown.size) await app.moving(uuid, () => { if (wasEmpty) app.status.delete(uuid); else app.status.set(uuid, was); }, () => app.status.set(uuid, to));
        else {
          if (wasEmpty) app.status.delete(uuid); else app.status.set(uuid, was);
          app.draw();
          Door.unroll(rows());   // a row that had gone comes back the way it went
        }
        if (await undo() === 'kept') { notify('It has changed since, so it stays', 'warning'); app.status.delete(uuid); }
        app.later();
      },
      onFail: error => { console.error('Todo: could not undo', error); notify('The status could not be put back', 'warning'); app.later(); } });
    if (to === 'done') entry.timer = setTimeout(async () => {
      if (app.ticking.get(uuid) !== entry) return;
      await Door.rollUp(rows());
      if (app.ticking.get(uuid) !== entry) return;
      app.ticking.delete(uuid); app.draw();
    }, FOLD_AFTER);
  },
  /* Where a task's rows stand: each group's key and the place in it, in every view's order. A change that moves a row (a new
     priority, deadline or status) rolls it up where it was and out where it lands (the plugin's one motion); one that leaves it
     where it was only draws again, so nothing jumps (the owner, 18 November 2026: "no flashes or jumps"). */
  placeOf(uuid) {
    const { parts } = app.groups(), at = [];
    for (const p of parts) for (const q of p.subs || [p]) { const i = q.rows.findIndex(t => t.uuid === uuid); if (i >= 0) at.push(`${q.key}#${i}`); }
    return at.join('|');
  },
  async moving(uuid, apply, undoApply) {
    const was = app.placeOf(uuid);
    apply();
    const now = app.placeOf(uuid);
    if (was === now) { app.draw(); return; }
    if (undoApply) undoApply(); else return app.draw();
    const old = app.rowsOf(uuid).map(line => line.closest('.td-row')).filter(Boolean);
    await Door.rollUp(old);
    apply(); app.draw();
    Door.unroll(app.rowsOf(uuid).map(line => line.closest('.td-row')).filter(Boolean));
  },
  /* A Priority or a Deadline from the right-click menu (view.js): drawn at once, written, with the one Undo at the row. fields: what
     the task holds after it (priority; or deadline with its day), write(): the write, giving its Undo; text: the Undo's words. */
  async change(uuid, fields, write, text) {
    const t0 = app.tasks.find(x => x.uuid === uuid);
    if (!t0) return;
    const keys = Object.keys(fields), before = Object.fromEntries(keys.map(k => [k, t0[k]]));
    const put = values => () => { const t = app.tasks.find(x => x.uuid === uuid); if (t) Object.assign(t, values); };
    await app.moving(uuid, put(fields), put(before));
    let undo;
    try { undo = await write(); }
    catch (error) {
      console.error('Todo: the change could not be written', error);
      await app.moving(uuid, put(before), put(fields));
      return notify(`Not changed: ${Door.reason(error, 'Logseq did not take it')}`, 'warning');
    }
    Door.undo.offer({ owner: 'todo', key: `todo:${++changes}`, node: uuid, text, at: () => app.rowsOf(uuid),
      run: async () => {
        await app.moving(uuid, put(before), put(fields));
        if (await undo() === 'kept') notify('It has changed since, so it stays', 'warning');
        app.later();
      },
      onFail: error => { console.error('Todo: could not undo', error); notify('It could not be put back', 'warning'); app.later(); } });
    app.later();
  },
  setPriority(uuid, name) {
    const t = app.tasks.find(x => x.uuid === uuid), p = T.db.priorities.find(x => x.name === name);
    if (!t || (name || '') === t.priority) return;
    const before = T.db.priorities.find(x => x.name === t.priority)?.title ?? null, short = app.short(t.words);
    return app.change(uuid, { priority: name || '' }, () => T.db.setPriority(uuid, p ? p.title : null, before),
      p ? `Priority of “${short}” set to ${p.title}` : `Priority taken off “${short}”`);
  },
  setDeadline(uuid, day) {
    const t = app.tasks.find(x => x.uuid === uuid);
    if (!t || (day || 0) === t.deadline) return;
    const short = app.short(t.words), beforeMs = t.deadlineMs;   // read now: the change draws the new one into the task before it writes
    return app.change(uuid, { deadline: day || 0, day: day || t.scheduled || 0, deadlineMs: day ? dates.date(day).getTime() : 0 }, () => T.db.setDeadline(uuid, day, beforeMs),
      day ? `Deadline of “${short}” set to ${T.view.dayWords(day)}` : `Deadline taken off “${short}”`);
  },
  short: words => words.length > 40 ? words.slice(0, 38) + '…' : words,
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

/* The list drawn into a holder Logseq gave: as Logseq mounts it, and again at start for a holder Logseq kept while the plugin
   stopped (the owner, 15 November 2026: "todo is blank on sidebar"; a plugin reload or update takes the list down, and Logseq
   keeps its sidebar panel without mounting it again, so the panel stood empty). A drawing that fails leaves a plain line, never
   a blank panel. */
function drawInto(holder, mode) {
  let view = null;
  try { view = T.view.make(holder, mode); view.focus(); app.reread(); }
  catch (error) {
    console.error('Todo: the list could not be drawn', error);
    holder.innerHTML = `<div class="td td-own td-${mode}"><div class="lk-none">The list could not be drawn: ${Door.esc(Door.reason(error, 'open Todo again in a moment'))}.</div></div>`;
  }
  if (mode === 'side') { const heading = holder.closest('.sidebar-item')?.querySelector('.page-title h3'); if (heading) heading.textContent = 'Todo'; }
  return view;
}
function adopt() {
  for (const holder of Door.host().querySelectorAll('.td-holder')) {
    if (holder.querySelector(':scope > .td')) continue;
    drawInto(holder, holder.classList.contains('td-holder-page') ? 'page' : 'side');
  }
}
T.adopt = adopt;

function mount() {
  const React = logseq.Experiments?.React;
  if (!React?.createElement) { console.error('Todo: Logseq gives plugins no React here, so the list cannot be shown'); return; }
  const component = mode => function TodoView() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      const view = drawInto(holder, mode);
      return () => view?.destroy();
    }, []);
    return React.createElement('div', { ref, className: `td-holder td-holder-${mode}` });
  };
  try { const Page = component('page'); logseq.Experiments.registerRouteRenderer('todo', { name: 'todo', path: ROUTE, render: () => React.createElement(Page) }); }
  catch (error) { console.error('Todo: the page could not be added', error); }
  try { const Side = component('side'); logseq.Experiments.registerSidebarRenderer(SIDE, { title: 'Todo', render: () => React.createElement(Side) }); }
  catch (error) { console.error('Todo: the sidebar tab could not be added', error); }
  // Todo in the right sidebar (sidebar-tabs.js): a section there only once you open it, closed by its ×.
  T.base.onStop(Door.sideTabs?.add({ key: 'todo', word: 'Todo', order: 4, panel: SIDE,
    find: doc => doc.getElementById('_sidebar.' + SIDE)?.closest('.sidebar-item') || null,
    open: () => { logseq.Editor.openInRightSidebar('_sidebar.' + SIDE); } }));
  adopt();
}
/* Logseq draws a plugin's panel with a puzzle, in the section's head and in the sidebar's add menu; Todo's takes its toolbar
   button's checkmark (the owner, 18 November 2026: "change icon of todo to match"), as Ontology's takes its own. Only the drawing's
   path changes, so Logseq's React keeps the icon as it drew it; Logseq draws the head again, so it is set on every pass of the screen. */
function checkmark(doc) {
  const d = Door.TOOLBAR_ICONS.todo, set = scope => { const path = scope?.querySelector('.ls-icon-puzzle svg path'); if (path && path.getAttribute('d') !== d) path.setAttribute('d', d); };
  set(doc.getElementById('_sidebar.' + SIDE)?.closest('.page-title'));
  for (const item of doc.querySelectorAll('.ui__dropdown-menu-item [title=":logseq-plugin"]')) if (item.textContent.trim() === 'Todo') set(item);
}
const openPage = () => { const win = Door.host().defaultView; if (win.location.hash.split('?')[0] !== '#' + ROUTE) win.location.hash = '#' + ROUTE; else for (const v of app.views) if (v.mode === 'page') v.focus(); };

async function main() {
  mount();
  const { onStop } = T.base;
  logseq.App.registerCommandPalette({ key: 'todo-open', label: 'Todo', keybinding: { binding: KEYS } }, openPage);
  const openSide = () => Door.sideTabs?.show('todo');
  logseq.App.registerCommandPalette({ key: 'todo-side', label: 'Todo in the sidebar' }, openSide);
  // A button in Logseq's toolbar, beside Ontology's, before the ··· (the owner, 14 November 2026); it opens Todo in the right sidebar
  // (the owner, 17 November 2026: "todo button should open up in sidebar"). The page of its own stays on the command palette and g d.
  logseq.provideModel({ todoOpen: openSide });
  Door.toolbarItem('todo-open', 'todoOpen', 'Todo', 'todo');
  // A change anywhere: read again after a quiet moment, so a task ticked, added or dated elsewhere shows here.
  T.base.watch(checkmark);
  onStop(logseq.DB.onChanged(() => { if (app.views.size) app.later(); }));
  // The grouping changed in the settings window: drawn at once in both places.
  onStop(logseq.onSettingsChanged((now, before) => { if (!Door.settingChanged(['todoGroupBy', 'todoThenBy', 'todoHidden'], now, before)) return; app.byNow = ''; app.thenNow = ''; app.hiddenNow = null; app.draw(); }));
  onStop(logseq.App.onCurrentGraphChanged(() => { Door.undo.clear('todo'); T.db.forget(); app.ticking.clear(); app.tasks = []; app.read = false; app.failed = ''; app.draw(); app.reread(); }));
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
  { key: 'todoThenBy', type: 'enum', default: 'None', enumChoices: ['None', ...T.db.GROUPINGS], title: 'Then group each group by',
    description: 'A second grouping inside each group: by Day, then by Page, for example. None keeps one level. The same choice is in the list’s “By day” menu, under Then by.' },
  { key: 'todoHidden', type: 'string', default: '', title: 'Statuses left out of the Todo list', description: 'Set from the list’s Show menu: the statuses it leaves out, by their short names, comma between. Empty lists every task that isn’t done or canceled.' },
];
const groupWords = { Day: ['Today', 'Coming up', 'Any time'], Page: ['Dr. Mei Chen', 'Report', 'Journals'], Tag: ['Consultation', 'Symptom', 'No tag'], Priority: ['Urgent', 'High', 'No priority'], Status: ['Doing', 'Todo'] };
Door.describe('todo', { schema: [{ type: 'heading', title: 'The Todo list', place: 'page' }, schema[0], schema[1]],
  specimen: (item, value) => item.key === 'todoGroupBy' ? (groupWords[value] || groupWords.Day).map(w => `<span class="sw-k">${w}</span>`).join('<br>')
    : item.key === 'todoThenBy' ? (value && value !== 'None' ? `<span class="sw-k">Today</span><br>${(groupWords[value] || []).slice(0, 2).map(w => `<span class="sw-faintw">&nbsp;&nbsp;${w}</span>`).join('<br>')}` : '<span class="sw-k">Today</span><br><span class="sw-k">Coming up</span>') : '',
  picture: on => `<span class="sw-faintw">The toolbar</span><br>${on ? 'Todo<br>' : ''}···` });
Door.register({
  key: 'todo', title: 'Todo', schema, about: 'Logseq’s tasks as one short list, on a page of its own and in the right sidebar: add one with a day in its words, tick it off.',
  start: main, stop,
});
})();
