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
.lk-todo .lk-add .lk-field { padding-left: 22px; background: linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 3px 50% / 11px 1.2px, linear-gradient(var(--lk-off), var(--lk-off)) no-repeat 8px 50% / 1.2px 11px; }`);
    const section = G.touch.section('lk-todo', 'Todo', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo', 'lk-day-end');
      holder.innerHTML = '<div class="lk-rel"></div>';
      const offAdd = G.node.adder(holder, 'Add or find a todo', words => G.write.addTask(words), 'The task could not be added');
      // What is typed in that line narrows the list to the tasks holding every word of it; Return still adds it as a new task.
      const field = holder.firstElementChild.firstElementChild; let typed = '';
      const holds = task => { const words = String(task.words).toLowerCase(); return typed.split(/\s+/).every(word => words.includes(word)); };
      const list = G.node.listing(holder.lastElementChild, async () => { const tasks = await G.read.tasks(); return G.todo.groups(typed ? tasks.filter(holds) : tasks, G.days.number(new Date())); }, { few: 30, none: 'No open tasks' });
      const narrow = () => { const now = field.value.trim().toLowerCase(); if (now !== typed) { typed = now; list.again(); } };
      field.addEventListener('input', narrow); field.addEventListener('keyup', narrow);
      // The day turns over while the window stays open: read again when it does.
      let today = G.days.number(new Date());
      const tick = doc.defaultView.setInterval(() => { const now = G.days.number(new Date()); if (now !== today) { today = now; list.again(); } }, 60000);
      return () => { doc.defaultView.clearInterval(tick); field.removeEventListener('input', narrow); field.removeEventListener('keyup', narrow); offAdd(); list.off(); };
    }, CHECK);
    base.onStop(section.off);
    G.touch.command('lk-todo', 'Todo', section.open);
    G.touch.toolbar('lk-todo', 'Todo', CHECK, section.open);
  },
});
})();
