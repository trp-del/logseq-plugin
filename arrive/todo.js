/* ARRIVING: Todo. Your open tasks in one list, in a section of the right sidebar: Today (what is due today or was due before
   it), Coming up, Any time. A line at the top adds a task to today's journal. The rows are the one line (node/line.js): the
   circle sets a status, a press opens the task in place, and a task that is done leaves the list. */
(function () {
const G = window.PluginDoor;
const CHECK = 'M5 12l5 5l10 -10';   // a checkmark, as Logseq's own line icons are drawn
G.part({
  key: 'todo', title: 'Todo', about: 'Your open tasks in the right sidebar: Today, Coming up, Any time. The checkmark in the toolbar opens it.',
  start(base) {
    base.style('todo', '.lk-todo { padding: 4px 4px 16px 22px; }');
    const section = G.touch.section('lk-todo', 'Todo', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo');
      holder.innerHTML = '<div class="lk-rel"></div>';
      const offAdd = G.node.adder(holder, 'New task', words => G.write.addTask(words), 'The task could not be added');
      const list = G.node.listing(holder.lastElementChild, async () => G.todo.groups(await G.read.tasks(), G.days.number(new Date())), { few: 30, none: 'No open tasks' });
      // The day turns over while the window stays open: read again when it does.
      let today = G.days.number(new Date());
      const tick = doc.defaultView.setInterval(() => { const now = G.days.number(new Date()); if (now !== today) { today = now; list.again(); } }, 60000);
      return () => { doc.defaultView.clearInterval(tick); offAdd(); list.off(); };
    }, CHECK);
    base.onStop(section.off);
    G.touch.command('lk-todo', 'Todo', section.open);
    G.touch.toolbar('lk-todo', 'Todo', CHECK, section.open);
  },
});
})();
