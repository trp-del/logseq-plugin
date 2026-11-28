/* PAGE: the Recycle list. Logseq's Recycle as a plain list on a page of the plugin's own (Relations: the Recycle list, in
   Logseq's command list): the deleted pages, newest first. In Logseq 2.0.2 only a page lies in the Recycle (a deleted bullet is
   gone from the graph); should a later Logseq keep a bullet there, its line is marked "bullet", with the page it came from, and
   is handled as a page is. Each line has Restore, which
   is Logseq's own restore, and Delete, which asks under the line first, with the shared question (node/ask.js: a red yes and
   Cancel, the keyboard waiting on Cancel), and then deletes for good: nothing brings that back. Delete all asks once for every
   line. A line is said to be back, or gone, only when it is: by Logseq's answer, and where Logseq answers nothing, by the
   Recycle read afresh. What Logseq refused is said in words and stays in the list. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'recycle', title: 'The Recycle list', about: 'Logseq’s Recycle as a plain list: bring a deleted page back, or delete it for good.',
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
      const kind = rows.every(row => row.isPage) ? 'page' : 'thing';   // every line is a page, said once above them; a bullet is the exception, marked on its line
      el.innerHTML = `<div class="lk-recycle"><div class="lk-row"><div class="lk-recycle-top"><span>${rows.length ? `${rows.length} deleted ${kind}${rows.length === 1 ? '' : 's'} Logseq still keeps` : 'Logseq’s Recycle is empty'}</span>${rows.length > 1 ? '<button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="all">Delete all</button>' : ''}</div></div><div class="lk-recycle-rows">${rows.map(row =>
        `<div class="lk-row"><div class="lk-recycle-row" data-uuid="${G.esc(row.uuid)}"><span class="lk-bul" aria-hidden="true"></span><span class="lk-recycle-words">${G.esc(said(row))}${row.isPage ? '' : `<span class="lk-recycle-from">bullet${row.from ? ` from ${G.esc(row.from)}` : ''}</span>`}</span><button type="button" class="lk-btn lk-low lk-i-undo" data-do="restore">Restore</button><button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="delete">Delete</button></div></div>`).join('')}</div></div>`;
      // Whether Logseq did it is read from its answer, and where it answers nothing from the Recycle itself, read afresh: what is
      // no longer kept there is back, or gone.
      const still = async list => { const now = await G.read.recycled().catch(() => null); return now ? list.filter(row => now.some(one => one.uuid === row.uuid)) : list; };
      // Restore: said only when the bullet or page is back. Logseq brings nothing back when the page a bullet was on is itself in
      // the Recycle.
      const restore = async row => {
        let back = false, failed;
        try { back = !!(await G.write.restore(row.uuid)); } catch (error) { failed = error; }
        if (!back) back = !(await still([row])).length;
        if (back) G.say(`“${said(row)}” is back.`);
        else if (!row.isPage && row.from && rows.some(one => one.isPage && one.words === row.from)) G.say(`“${said(row)}” was not brought back: the page it was on, “${row.from}”, is in the Recycle too. Restore that page first, then this bullet.`, 'warning');
        else G.write.refused(`“${said(row)}” was not brought back`, failed, 'It is still in the Recycle.');
        draw(el);
      };
      // Delete for good, one by one: what Logseq refused stays in the list and is said.
      const forGood = async list => {
        let kept = [], failed;
        for (const row of list) { try { if (!(await G.write.deleteForGood(row.uuid))) kept.push(row); } catch (error) { kept.push(row); failed ||= error; } }
        if (kept.length) kept = await still(kept);
        if (kept.length) G.write.refused(`${kept.length === 1 ? `“${said(kept[0])}” was` : `${kept.length} of ${list.length} were`} not deleted`, failed, `${kept.length === 1 ? 'It is' : 'They are'} still in the Recycle; press Delete again to try once more.`);
        draw(el);
      };
      // The shared question under a line. Left by Cancel or Escape, the keys go back to the press it was opened from (the shared
      // question hands them to a shared line, which this list has not).
      const ask = (holder, press, what) => {
        G.ask.gone(holder, what);
        const box = holder.querySelector(':scope > .lk-ask-gone'), view = el.ownerDocument.defaultView;
        const left = event => { if (event.type === 'keydown' ? event.key === 'Escape' : !!event.target.closest('[data-do="no"]')) view.setTimeout(() => { if (!box.isConnected && press.isConnected) press.focus({ preventScroll: true }); }, 0); };
        box?.addEventListener('keydown', left, true); box?.addEventListener('click', left, true);
      };
      el.onclick = event => {
        const press = event.target.closest('[data-do]'), line = press?.closest('.lk-recycle-row'), what = press?.dataset.do;
        if (!what) return;
        const row = line && rows.find(one => one.uuid === line.dataset.uuid);
        if (what === 'restore' && row) { press.disabled = true; restore(row); }   // one press, one restore: the list is drawn again when Logseq has answered
        else if (what === 'delete' && row) ask(line.parentElement, press, { words: `Delete “${said(row)}” for good?`, note: 'Nothing brings it back.', yes: 'Delete for good', take: () => forGood([row]) });
        else if (what === 'all') ask(press.closest('.lk-row'), press, { words: `Delete all ${rows.length} for good?`, note: 'Nothing brings them back.', yes: 'Delete for good', take: () => forGood(rows) });
      };
    };
    const page = G.touch.page('lk-recycle', 'The Recycle list', el => { draw(el); });
    base.onStop(page.off);
    G.touch.command('lk-recycle', 'Relations: the Recycle list', page.open);
  },
});
})();
