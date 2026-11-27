/* ARRIVING: Todo. Your open tasks in one list, in a section of the right sidebar and on a page of its own: Today (what is due today or was due before
   it), Coming up, Any time. A line at the top adds a task to today's journal. The rows are the one line (node/line.js): the
   circle sets a status, a press opens the task in place, and a task that is done leaves the list. */
(function () {
const G = window.PluginDoor;
const CHECK = 'M5 12l5 5l10 -10';   // a checkmark, as Logseq's own line icons are drawn
G.part({
  key: 'todo', title: 'Todo', about: 'Your open tasks, in the right sidebar and on a page of their own. The corner (bottom right) opens the sidebar’s; g then d opens the page.',
  start(base) {
    /* As before 0.9 (the owner, 25 November 2026): the words a size smaller than a page's, each group under a small bold word, a
       task's day at the right end and red once it has passed, the line on top with a + that adds a task and narrows the list
       to what is typed. */
    base.style('todo', `
.lk-todo { padding: 4px 4px 16px 10px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-todo .lk-list-name { font-size: var(--lk-small); font-weight: 600; }
.lk-todo .lk-list { margin-top: 14px; }
.lk-todo > .lk-time { margin: 0 0 2px; }
.lk-todo .lk-add { align-items: baseline; }
.lk-todo-hint { flex: none; margin-left: 8px; color: var(--lk-off); font-size: var(--lk-small); white-space: nowrap; }
.lk-todo-hint:empty { display: none; }
/* On its own page the list keeps a reading width and stands in the middle. */
.lk-page[data-page="lk-todo-page"] { max-width: 720px; margin-inline: auto; }
/* What is listed and how it is grouped: two quiet words at the end of the line on top, since they change every group. */
.lk-todo-view { flex: none; margin-left: auto; }
.lk-todo-view > div { display: flex; gap: 2px; }
.lk-todo-view button { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 6px; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; white-space: nowrap; }
.lk-todo-view button:hover, .lk-todo-view button:focus-visible { background: var(--lk-wash); color: var(--lk-text); outline: none; }
.lk-todo-view button.on { color: var(--lk-text); }
.lk-todo-view button::after { content: ""; width: 4px; height: 4px; margin-top: -3px; border: solid currentColor; border-width: 0 1.1px 1.1px 0; transform: rotate(45deg); opacity: .8; }
.lk-todo .lk-add .lk-field { padding-left: 22px; background: linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 3px 50% / 11px 1.2px, linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 8px 50% / 1.2px 11px; }`);
    const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
    const refused = what => error => G.say(`${what}: ${error?.message || 'Logseq refused'}`, 'warning');
    // The one list, drawn the same in the sidebar's section and on the page of its own.
    const draw = holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo', 'lk-day-end');
      holder.innerHTML = '<div class="lk-time" hidden></div><div class="lk-todo-view"><div><button type="button" data-of="show"></button><button type="button" data-of="by"></button></div></div><div class="lk-rel"></div>';
      const timeEl = holder.children[0], viewEl = holder.children[1], store = doc.defaultView.localStorage;
      // A day said in the words ("by friday") becomes the task's Deadline and leaves the words; it is said at the line's right before Return.
      const offAdd = G.node.adder(holder, 'Add or find a todo', async words => {
        const read = G.todo.dayIn(words, G.days.number(new Date())), made = await G.write.addTask(read ? read.words : words, read ? read.day : 0);
        doc.defaultView.setTimeout(() => narrow(), 0);   // the line empties without a key: the list is whole again, and the day said at its right goes
        return made;
      }, 'The task could not be added');
      const field = holder.firstElementChild.firstElementChild, hint = doc.createElement('span'); hint.className = 'lk-todo-hint'; field.after(hint); hint.after(viewEl);
      // What is typed in that line narrows the list to the tasks holding every word of it; Return still adds it as a new task.
      let typed = '';
      const holds = task => { const words = String(task.words).toLowerCase(); return typed.split(/\s+/).every(word => words.includes(word)); };
      // What is listed (the statuses left out), how it is grouped and how it is sorted are kept for the next time, on this Mac.
      const kept = (key, fallback) => { try { return JSON.parse(store.getItem(key)) ?? fallback; } catch (error) { return fallback; } };
      const keep = (key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch (error) { /* this sitting only */ } };
      const BY = { day: 'By day', page: 'By page', parent: 'By parent', tag: 'By tag', priority: 'By priority', status: 'By status' };
      let by = BY[kept('lk.todo-by', 'day')] ? kept('lk.todo-by', 'day') : 'day', sort = kept('lk.todo-sort', 'day') === 'name' ? 'name' : 'day', out = new Set(kept('lk.todo-out', []));
      const plain = words => String(words || '').replace(/\[\[|\]\]/g, '');
      const read = async () => {
        const [all, statuses] = await Promise.all([G.read.tasks(), G.read.statuses()]), today = G.days.number(new Date());
        const titleOf = new Map(statuses.map(status => [status.id, status.title])), open = statuses.filter(status => all.some(task => task.status === status.id));
        const listed = all.filter(task => !out.has(titleOf.get(task.status) || ''));
        // The strip of time: every listed task that has a day, a late one in red; a press on a dot goes to its line.
        const dots = listed.filter(task => task.day).map(task => ({ day: task.day, title: plain(task.words), uuid: task.uuid, late: task.day < today }));
        timeEl.hidden = dots.length < 5;   // a strip of two or three dots says less than the lines under it
        if (dots.length >= 5) G.timeline.strip(timeEl, dots, today, dot => { const line = holder.querySelector(`.lk-row[data-uuid="${dot.uuid}"] > .lk-line`); if (line) { line.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); line.focus({ preventScroll: true }); } });
        const left = open.filter(status => out.has(status.title)), shown = open.filter(status => !out.has(status.title));
        const [showEl, byEl] = viewEl.firstElementChild.children;
        showEl.textContent = left.length ? (shown.length <= 2 ? shown.map(status => status.title).join(', ') : `${shown.length} statuses`) : 'All open'; showEl.classList.toggle('on', !!left.length);
        byEl.textContent = BY[by]; byEl.classList.toggle('on', by !== 'day' || sort !== 'day');
        showEl.lkOpen = open;
        // Where each task sits: its page, then the bullet it is under. Said under a task's words, except what the group's own heading says.
        const sits = await G.read.where(listed.map(task => task.id));
        const tasks = (typed ? listed.filter(holds) : listed).map(task => { const at = sits.get(task.id) || []; return { ...task, at, where: by === 'page' ? at.slice(1) : by === 'parent' ? [] : at.slice(0, 1).filter(step => !step.day) }; });   // a journal is only a day, and a task says one day: its own
        if (by === 'day') return G.todo.groups(tasks, today, sort);
        if (by === 'status') return G.todo.by('status', tasks, today, task => titleOf.get(task.status) || '', statuses.map(status => status.title), sort);
        if (by === 'tag') return G.todo.by('tag', tasks, today, task => task.tag && task.tag !== 'Task' ? task.tag : '', [], sort);
        if (by === 'priority') return G.todo.by('priority', tasks, today, task => task.priority, PRIORITIES, sort);
        if (by === 'parent') return G.todo.by('parent', tasks, today, task => plain(task.at[task.at.length - 1]?.words), [], sort);
        return G.todo.by('page', tasks, today, task => task.at[0]?.day ? G.days.short(task.at[0].day) : plain(task.at[0]?.words), [], sort);
      };
      // A task's right-click: its priority and its deadline, each from a short list, with the way back at the task's line.
      const more = (row, at) => {
        const uuid = row.dataset.uuid, change = write => G.undo.after(uuid, write);
        const task = async () => (await G.read.tasks()).find(one => one.uuid === uuid) || {};
        const day = n => { const d = new Date(); return G.days.number(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
        return [{ gap: true },
          { word: 'Priority…', take: async () => { const now = (await task()).priority; G.menu(at, [...PRIORITIES.map(word => ({ word, on: word === now, take: () => change(G.write.setPriority(uuid, word)).catch(refused('The priority could not be set')) })),
            ...(now ? [{ gap: true }, { word: 'Remove priority', take: () => change(G.write.setPriority(uuid, '')).catch(refused('The priority could not be taken off')) }] : [])]); } },
          { word: 'Deadline…', take: async () => { const now = await task(), has = now.dayFrom === 'Deadline' ? now.day : 0, monday = ((8 - new Date().getDay()) % 7) || 7;
            G.menu(at, [...[['Today', day(0)], ['Tomorrow', day(1)], ['Next week', day(monday)]].map(([word, to]) => ({ word, value: G.days.short(to, day(0)) || '', on: has === to, take: () => change(G.write.setDeadline(uuid, to)).catch(refused('The deadline could not be set')) })),
              ...(has ? [{ gap: true }, { word: 'Remove deadline', take: () => change(G.write.setDeadline(uuid, 0)).catch(refused('The deadline could not be taken off')) }] : [])]); } }];
      };
      const list = G.node.listing(holder.lastElementChild, read, { few: 30, none: 'No open tasks', more });
      const narrow = () => {
        const now = field.value.trim().toLowerCase(), said = G.todo.dayIn(field.value, G.days.number(new Date()));
        hint.textContent = said ? G.days.short(said.day) : '';   // a day is written one way everywhere
        if (now !== typed) { typed = now; list.again(); }
      };
      field.addEventListener('input', narrow); field.addEventListener('keyup', narrow);
      const onView = event => {
        const button = event.target.closest('button'); if (!button) return;
        if (button.dataset.of === 'by') return void G.menu(button, [{ group: 'Group by' }, ...Object.entries(BY).map(([key, word]) => ({ word: word.slice(3, 4).toUpperCase() + word.slice(4), on: key === by, take: () => { by = key; keep('lk.todo-by', by); list.again(); } })),
          { gap: true }, { group: 'Sort by' }, ...[['day', 'Day'], ['name', 'Name']].map(([key, word]) => ({ word, on: key === sort, take: () => { sort = key; keep('lk.todo-sort', sort); list.again(); } }))]);
        const open = button.lkOpen || [], flip = title => { if (out.has(title)) out.delete(title); else if (open.filter(status => !out.has(status.title)).length > 1) out.add(title); keep('lk.todo-out', [...out]); list.again(); };   // the last one listed cannot be left out
        G.menu(button, [{ group: 'Show' }, ...open.map(status => ({ word: status.title, icon: G.touch.statusIcon(status.icon), on: !out.has(status.title), take: () => flip(status.title) })),
          ...(open.some(status => out.has(status.title)) ? [{ gap: true }, { word: 'Show all', take: () => { out = new Set(); keep('lk.todo-out', []); list.again(); } }] : [])]);
      };
      viewEl.addEventListener('click', onView);
      // The day turns over while the window stays open: read again when it does.
      let today = G.days.number(new Date());
      const tick = doc.defaultView.setInterval(() => { const now = G.days.number(new Date()); if (now !== today) { today = now; list.again(); } }, 60000);
      return () => { doc.defaultView.clearInterval(tick); viewEl.removeEventListener('click', onView); field.removeEventListener('input', narrow); field.removeEventListener('keyup', narrow); offAdd(); list.off(); };
    };
    // In the sidebar from the corner; in the middle of the window, a page of its own, from the command or g then d.
    const section = G.touch.section('lk-todo', 'Todo', draw, CHECK), page = G.touch.page('lk-todo-page', 'Todo', draw);
    base.onStop(section.off); base.onStop(page.off);
    G.touch.command('lk-todo', 'Todo', page.open, 'g d');
    G.touch.command('lk-todo-side', 'Todo in the sidebar', section.open);
  },
});
})();
