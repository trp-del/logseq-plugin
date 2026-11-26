/* PAGE: the Recycle list. Logseq's Recycle as a plain list on a page of the plugin's own (Relations: the Recycle list, in
   Logseq's command list): what was deleted, newest first, a bullet with the page it came from. Each line has Restore, which
   is Logseq's own restore, and Delete, which asks under the line first and then deletes for good: nothing brings that back,
   so the keyboard waits on Leave it. Delete all asks once for every line. */
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
.lk-recycle-ask { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 6px 0 10px 24px; font-size: var(--lk-line-size); }
.lk-recycle-ask span { flex: 1; min-width: 12rem; }
.lk-recycle .lk-going-btn { color: var(--lk-going); }`);
    const draw = async el => {
      const doc = el.ownerDocument, rows = await G.read.recycled().catch(() => []);
      el.innerHTML = `<div class="lk-recycle"><div class="lk-recycle-top"><span>${rows.length ? `${rows.length} deleted ${rows.length === 1 ? 'thing' : 'things'} Logseq still keeps` : 'Logseq’s Recycle is empty'}</span>${rows.length > 1 ? '<button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="all">Delete all</button>' : ''}</div><div class="lk-recycle-rows">${rows.map(row =>
        `<div class="lk-recycle-row" data-uuid="${G.esc(row.uuid)}"><span class="lk-bul" aria-hidden="true"></span><span class="lk-recycle-words">${G.esc(row.words || (row.isPage ? 'A page with no name' : 'A bullet with no words'))}<span class="lk-recycle-from">${row.isPage ? 'page' : row.from ? `from ${G.esc(row.from)}` : 'bullet'}</span></span><button type="button" class="lk-btn lk-low lk-i-undo" data-do="restore">Restore</button><button type="button" class="lk-btn lk-low lk-going-btn lk-i-bin" data-do="delete">Delete</button></div>`).join('')}</div></div>`;
      const ask = (after, words, yes) => {
        el.querySelector('.lk-recycle-ask')?.remove();
        const box = doc.createElement('div'); box.className = 'lk-recycle-ask';
        box.innerHTML = `<span><b>${G.esc(words)}</b> Nothing brings it back.</span><button type="button" class="lk-big" data-do="yes">Delete for good</button><button type="button" class="lk-btn" data-do="no">Leave it</button>`;
        after.after(box); box.querySelector('[data-do="no"]').focus();
        box.onclick = async event => { const what = event.target.closest('[data-do]')?.dataset.do; if (!what) return; event.stopPropagation(); box.remove(); if (what === 'yes') { await yes(); draw(el); } };
        box.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); box.remove(); } };
      };
      el.onclick = async event => {
        const press = event.target.closest('[data-do]'), row = press?.closest('.lk-recycle-row'), what = press?.dataset.do;
        if (!what || press.closest('.lk-recycle-ask')) return;
        const name = row?.querySelector('.lk-recycle-words')?.firstChild?.textContent || '';
        try {
          if (what === 'restore') { await G.write.restore(row.dataset.uuid); G.say(`“${name}” is back.`); draw(el); }
          else if (what === 'delete') ask(row, `Delete “${name}” for good?`, () => G.write.deleteForGood(row.dataset.uuid));
          else if (what === 'all') ask(press.parentElement, `Delete all ${rows.length} for good?`, async () => { for (const one of rows) await G.write.deleteForGood(one.uuid); });
        } catch (error) { G.say(`Logseq did not take it: ${error?.message || 'it is still in the Recycle'}`, 'warning'); }
      };
    };
    const page = G.touch.page('lk-recycle', 'The Recycle list', el => { draw(el); });
    G.touch.command('lk-recycle', 'Relations: the Recycle list', page.open);
  },
});
})();
