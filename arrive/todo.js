/* ARRIVING: Todo. Your open tasks in one list, in a section of the right sidebar: Today (what is due today or was due before
   it), Coming up, Any time. A line at the top adds a task to today's journal. The rows are the one line (node/line.js): the
   circle sets a status, a press opens the task in place, and a task that is done leaves the list. */
(function () {
const G = window.PluginDoor;
const CHECK = 'M5 12l5 5l10 -10';   // a checkmark, as Logseq's own line icons are drawn
G.part({
  key: 'todo', title: 'Todo', about: 'Your open tasks in the right sidebar: Today, Coming up, Any time. The checkmark in the toolbar opens it.',
  start(base) {
    base.style('todo', `
.lk-todo { padding: 4px 4px 16px 22px; }
.lk-todo .lk-add { display: flex; margin: 0 0 12px; }
.lk-todo .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-todo .lk-field:focus { border-bottom-color: var(--lk-line); }
.lk-todo .lk-field::placeholder { color: var(--lk-off); }`);
    const section = G.touch.section('lk-todo', 'Todo', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo');
      holder.innerHTML = '<div class="lk-add"><input class="lk-field" type="text" placeholder="New task" aria-label="New task" spellcheck="true" autocomplete="off"></div><div class="lk-rel"></div>';
      const field = holder.querySelector('.lk-field');
      const onKey = async event => {
        if (event.key === 'Escape') { field.value = ''; field.blur(); return; }
        if (event.key !== 'Enter' || !field.value.trim() || field.disabled) return;
        event.preventDefault(); event.stopPropagation();
        field.disabled = true;
        try { await G.write.addTask(field.value); field.value = ''; }
        catch (error) { G.say(`The task could not be added: ${error?.message || 'Logseq refused'}`, 'warning'); }
        field.disabled = false; field.focus();
      };
      field.addEventListener('keydown', onKey);
      const list = G.node.listing(holder.lastElementChild, async () => G.todo.groups(await G.read.tasks(), G.days.number(new Date())), { few: 30, none: 'No open tasks' });
      // The day turns over while the window stays open: read again when it does.
      let today = G.days.number(new Date());
      const tick = doc.defaultView.setInterval(() => { const now = G.days.number(new Date()); if (now !== today) { today = now; list.again(); } }, 60000);
      return () => { doc.defaultView.clearInterval(tick); field.removeEventListener('keydown', onKey); list.off(); };
    }, CHECK);
    base.onStop(section.off);
    G.touch.command('lk-todo', 'Todo', section.open);
    G.touch.toolbar('lk-todo', 'Todo', CHECK, section.open);
  },
});
})();
