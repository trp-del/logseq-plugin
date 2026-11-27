/* PAGE: the Recycle list. Logseq's Recycle as a plain list on a page of the plugin's own (Relations: the Recycle list, in
   Logseq's command list): what was deleted, newest first, a bullet with the page it came from. Each line has Restore, which
   is Logseq's own restore, and Delete, which asks under the line first, with the shared question (node/ask.js: a red yes and
   Cancel, the keyboard waiting on Cancel), and then deletes for good: nothing brings that back. Delete all asks once for every
   line. A line is said to be back, or gone, only when it is: by Logseq's answer, and where Logseq answers nothing, by the
   Recycle read afresh. What Logseq refused is said in words and stays in the list. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'recycle', title: 'The Recycle list', about: 'Logseq’s Recycle as a plain list: bring a page or a bullet back, or delete it for good.',
  start(base) {
    base.style('recycle', `
.lk-recycle { max-width: 46rem; margin: 0 auto; padding: 24px 16px 64px; }
.lk-recycle-top { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; color: var(--lk-quiet); font-size: var(--lk-line-size); }
.lk-recycle-top .lk-btn { margin-left: auto; }
.lk-recycle-row { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 2px 0; border-top: 1px solid var(--lk-hair); }
.lk-recycle-row .lk-bul { flex: none; }
.lk-recycle-words { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-recycle-from { color: var(--lk-off); font-size: var(--lk-small); margin-left: .5em; }
.lk-recycle .lk-row > :is(.lk-recycle-top, .lk-recycle-row) { grid-column: 1 / -1; }   /* the question (G.ask.gone) stands under its line */
.lk-recycle .lk-going-btn { color: var(--lk-going); }`);
    const draw = async el => {
      const rows = await G.read.recycled().catch(() => []);
      const said = row => row.words || (row.isPage ? 'A page with no name' : 'A bullet with no words');
      el.innerHTML = `<div class="lk-recycle"><div class="lk-row"><div class="lk-recycle-top"><span>${rows.length ? `${rows.length} deleted ${rows.length === 1 ? 'thing' : 'things'} Logseq still keeps` : 'Logseq’s Recycle is empty'}</span>${rows.length > 1 ? '<button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="all">Delete all</button>' : ''}</div></div><div class="lk-recycle-rows">${rows.map(row =>
        `<div class="lk-row"><div class="lk-recycle-row" data-uuid="${G.esc(row.uuid)}"><span class="lk-bul" aria-hidden="true"></span><span class="lk-recycle-words">${G.esc(said(row))}<span class="lk-recycle-from">${row.isPage ? 'page' : row.from ? `from ${G.esc(row.from)}` : 'bullet'}</span></span><button type="button" class="lk-btn lk-low lk-i-undo" data-do="restore">Restore</button><button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="delete">Delete</button></div></div>`).join('')}</div></div>`;
      // Whether Logseq did it is read from its answer, and where it answers nothing from the Recycle itself, read afresh: what is
      // no longer kept there is back, or gone.
      const still = async list => { const now = await G.read.recycled().catch(() => null); return now ? list.filter(row => now.some(one => one.uuid === row.uuid)) : list; };
      // Restore: said only when the bullet or page is back. Logseq brings nothing back when the page a bullet was on is itself in
      // the Recycle.
      const restore = async row => {
        let back = false, why = '';
        try { back = !!(await G.write.restore(row.uuid)); } catch (error) { why = error?.message || ''; }
        if (!back) back = !(await still([row])).length;
        if (back) G.say(`“${said(row)}” is back.`);
        else if (!row.isPage && row.from && rows.some(one => one.isPage && one.words === row.from)) G.say(`“${said(row)}” was not brought back: the page it was on, “${row.from}”, is in the Recycle too. Restore that page first, then this bullet.`, 'warning');
        else G.say(`“${said(row)}” was not brought back: ${why || 'Logseq found no place to put it'}. It is still in the Recycle.`, 'warning');
        draw(el);
      };
      // Delete for good, one by one: what Logseq refused stays in the list and is said.
      const forGood = async list => {
        let kept = [], why = '';
        for (const row of list) { try { if (!(await G.write.deleteForGood(row.uuid))) kept.push(row); } catch (error) { kept.push(row); why ||= error?.message || ''; } }
        if (kept.length) kept = await still(kept);
        if (kept.length) G.say(`${kept.length === 1 ? `“${said(kept[0])}” was` : `${kept.length} of ${list.length} were`} not deleted: ${why || 'Logseq refused'}. ${kept.length === 1 ? 'It is' : 'They are'} still in the Recycle; press Delete again to try once more.`, 'warning');
        draw(el);
      };
      el.onclick = event => {
        const press = event.target.closest('[data-do]'), line = press?.closest('.lk-recycle-row'), what = press?.dataset.do;
        if (!what) return;
        const row = line && rows.find(one => one.uuid === line.dataset.uuid);
        if (what === 'restore' && row) { press.disabled = true; restore(row); }   // one press, one restore: the list is drawn again when Logseq has answered
        else if (what === 'delete' && row) G.ask.gone(line.parentElement, { words: `Delete “${said(row)}” for good?`, note: 'Nothing brings it back.', yes: 'Delete for good', take: () => forGood([row]) });
        else if (what === 'all') G.ask.gone(press.closest('.lk-row'), { words: `Delete all ${rows.length} for good?`, note: 'Nothing brings them back.', yes: 'Delete for good', take: () => forGood(rows) });
      };
    };
    const page = G.touch.page('lk-recycle', 'The Recycle list', el => { draw(el); });
    base.onStop(page.off);
    G.touch.command('lk-recycle', 'Relations: the Recycle list', page.open);
  },
});
})();
