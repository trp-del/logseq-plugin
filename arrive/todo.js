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
.lk-todo .lk-add { display: flex; margin: -4px 0 12px -22px; padding: 4px 0 0 22px; position: sticky; top: 0; z-index: 2; background: var(--lk-ground, transparent); }   /* stays in view while the list moves to a new task */
.lk-todo .lk-row { scroll-margin: 44px 0 8px; }
.lk-todo .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-todo .lk-field:focus { border-bottom-color: var(--lk-line); }
.lk-todo .lk-field::placeholder { color: var(--lk-off); }
.lk-todo .lk-row > .lk-line { transition: background-color .6s ease; }
.lk-todo .lk-row.lk-new > .lk-line { background: var(--lk-lit); transition: none; }`);
    const section = G.touch.section('lk-todo', 'Todo', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-todo');
      holder.innerHTML = '<div class="lk-add"><input class="lk-field" type="text" placeholder="New task" aria-label="New task" spellcheck="true" autocomplete="off"></div><div class="lk-rel"></div>';
      const field = holder.querySelector('.lk-field');
      // The new task lands where its day puts it, often far down: the list moves to it and it is lit for a moment.
      const show = (uuid, tries = 0) => {
        const row = uuid && holder.querySelector(`.lk-row[data-uuid="${uuid}"]`);
        if (!row) { if (tries < 20 && holder.isConnected) doc.defaultView.setTimeout(() => show(uuid, tries + 1), 150); return; }
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        row.classList.add('lk-new'); doc.defaultView.setTimeout(() => row.classList.remove('lk-new'), 1800);
      };
      const onKey = async event => {
        if (event.key === 'Escape') { field.value = ''; field.blur(); return; }
        if (event.key !== 'Enter' || !field.value.trim() || field.disabled) return;
        event.preventDefault(); event.stopPropagation();
        field.disabled = true;
        try { const uuid = await G.write.addTask(field.value); field.value = ''; show(uuid); }
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
