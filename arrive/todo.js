/* ARRIVING: Todo. Your open tasks in one list, in a section of the right sidebar: Today (what is due today or was due before
   it), Coming up, Any time. A line at the top adds a task to today's journal. The rows are the one line (node/line.js): the
   circle sets a status, a press opens the task in place, and a task that is done leaves the list. */
(function () {
const G = window.PluginDoor;
const CHECK = 'M5 12l5 5l10 -10';   // a checkmark, as Logseq's own line icons are drawn
G.part({
  key: 'todo', title: 'Todo', about: 'Your open tasks in the right sidebar: Today, Coming up, Any time. The checkmark in the toolbar opens it.',
  start(base) {
    /* As before 0.9 (the owner, 25 November 2026): the words a size smaller than a page's, each group under a small bold word, a
       task's day at the right end and red once it has passed, the line on top with a + that adds a task and narrows the list
       to what is typed. */
    base.style('todo', `
.lk-todo { padding: 4px 4px 16px 22px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-todo .lk-list-name { font-size: var(--lk-small); font-weight: 600; }
.lk-todo .lk-list { margin-top: 14px; }
.lk-todo > .lk-time { margin: 0 0 2px; }
/* What is listed and how it is grouped: two quiet words at the right of the first group's line. */
.lk-todo-view { position: relative; height: 0; z-index: 1; }
.lk-todo-view > div { position: absolute; right: 0; top: 14px; display: flex; gap: 2px; }
.lk-todo-view button { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 6px; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; white-space: nowrap; }
.lk-todo-view button:hover, .lk-todo-view button:focus-visible { background: var(--lk-wash); color: var(--lk-text); outline: none; }
.lk-todo-view button.on { color: var(--lk-text); }
.lk-todo-view button::after { content: ""; width: 4px; height: 4px; margin-top: -3px; border: solid currentColor; border-width: 0 1.1px 1.1px 0; transform: rotate(45deg); opacity: .8; }
.lk-todo .lk-add .lk-field { padding-left: 22px; background: linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 3px 50% / 11px 1.2px, linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 8px 50% / 1.2px 11px; }`);
    const section = G.touch.section('lk-todo', 'Todo', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo', 'lk-day-end');
      holder.innerHTML = '<div class="lk-time" hidden></div><div class="lk-todo-view"><div><button type="button" data-of="show"></button><button type="button" data-of="by"></button></div></div><div class="lk-rel"></div>';
      const timeEl = holder.children[0], viewEl = holder.children[1], store = doc.defaultView.localStorage;
      const offAdd = G.node.adder(holder, 'Add or find a todo', words => G.write.addTask(words), 'The task could not be added');
      // What is typed in that line narrows the list to the tasks holding every word of it; Return still adds it as a new task.
      const field = holder.firstElementChild.firstElementChild; let typed = '';
      const holds = task => { const words = String(task.words).toLowerCase(); return typed.split(/\s+/).every(word => words.includes(word)); };
      // What is listed (the statuses left out) and how it is grouped are kept for the next time, on this Mac.
      const kept = (key, fallback) => { try { return JSON.parse(store.getItem(key)) ?? fallback; } catch (error) { return fallback; } };
      const keep = (key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch (error) { /* this sitting only */ } };
      const BY = { day: 'By day', status: 'By status', tag: 'By tag', page: 'By page' };
      let by = BY[kept('lk.todo-by', 'day')] ? kept('lk.todo-by', 'day') : 'day', out = new Set(kept('lk.todo-out', []));
      const read = async () => {
        const [all, statuses] = await Promise.all([G.read.tasks(), G.read.statuses()]), today = G.days.number(new Date());
        const titleOf = new Map(statuses.map(status => [status.id, status.title])), open = statuses.filter(status => all.some(task => task.status === status.id));
        const listed = all.filter(task => !out.has(titleOf.get(task.status) || ''));
        // The strip of time: every listed task that has a day, a late one in red; a press on a dot goes to its line.
        const dots = listed.filter(task => task.day).map(task => ({ day: task.day, title: String(task.words).replace(/\[\[|\]\]/g, ''), uuid: task.uuid, late: task.day < today }));
        timeEl.hidden = dots.length < 2;
        if (dots.length >= 2) G.timeline.strip(timeEl, dots, today, dot => { const line = holder.querySelector(`.lk-row[data-uuid="${dot.uuid}"] > .lk-line`); if (line) { line.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); line.focus({ preventScroll: true }); } });
        const left = open.filter(status => out.has(status.title)), shown = open.filter(status => !out.has(status.title));
        const [showEl, byEl] = viewEl.firstElementChild.children;
        showEl.textContent = left.length ? (shown.length <= 2 ? shown.map(status => status.title).join(', ') : `${shown.length} statuses`) : 'All open'; showEl.classList.toggle('on', !!left.length);
        byEl.textContent = BY[by]; byEl.classList.toggle('on', by !== 'day');
        showEl.lkOpen = open;
        const tasks = typed ? listed.filter(holds) : listed;
        if (by === 'day') return G.todo.groups(tasks, today);
        if (by === 'status') return G.todo.by('status', tasks, today, task => titleOf.get(task.status) || '', statuses.map(status => status.title));
        if (by === 'tag') return G.todo.by('tag', tasks, today, task => task.tag && task.tag !== 'Task' ? task.tag : '');
        const sits = await G.read.where(tasks.map(task => task.id));
        return G.todo.by('page', tasks, today, task => String(sits.get(task.id)?.[0]?.words || '').replace(/\[\[|\]\]/g, ''));
      };
      const list = G.node.listing(holder.lastElementChild, read, { few: 30, none: 'No open tasks' });
      const narrow = () => { const now = field.value.trim().toLowerCase(); if (now !== typed) { typed = now; list.again(); } };
      field.addEventListener('input', narrow); field.addEventListener('keyup', narrow);
      const onView = event => {
        const button = event.target.closest('button'); if (!button) return;
        if (button.dataset.of === 'by') return void G.menu(button, [{ group: 'Group by' }, ...Object.entries(BY).map(([key, word]) => ({ word: word.slice(3, 4).toUpperCase() + word.slice(4), on: key === by, take: () => { by = key; keep('lk.todo-by', by); list.again(); } }))]);
        const open = button.lkOpen || [], flip = title => { if (out.has(title)) out.delete(title); else if (open.filter(status => !out.has(status.title)).length > 1) out.add(title); keep('lk.todo-out', [...out]); list.again(); };   // the last one listed cannot be left out
        G.menu(button, [{ group: 'Show' }, ...open.map(status => ({ word: status.title, icon: G.touch.statusIcon(status.icon), on: !out.has(status.title), take: () => flip(status.title) })),
          ...(open.some(status => out.has(status.title)) ? [{ gap: true }, { word: 'Show all', take: () => { out = new Set(); keep('lk.todo-out', []); list.again(); } }] : [])]);
      };
      viewEl.addEventListener('click', onView);
      // The day turns over while the window stays open: read again when it does.
      let today = G.days.number(new Date());
      const tick = doc.defaultView.setInterval(() => { const now = G.days.number(new Date()); if (now !== today) { today = now; list.again(); } }, 60000);
      return () => { doc.defaultView.clearInterval(tick); viewEl.removeEventListener('click', onView); field.removeEventListener('input', narrow); field.removeEventListener('keyup', narrow); offAdd(); list.off(); };
    }, CHECK);
    base.onStop(section.off);
    G.touch.command('lk-todo', 'Todo', section.open);
    G.touch.toolbar('lk-todo', 'Todo', CHECK, section.open);
  },
});
})();
