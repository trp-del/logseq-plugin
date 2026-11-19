/* 18 November 2026, the owner's list: big blank gaps on a journal day around Scheduled and Deadline, and a tall empty band under a
   page shown in the right sidebar. Logseq keeps 64 px under a page's bullets for its Linked references, which Relations leaves out. */
module.exports = {
  name: 'A page ends at its bullets when nothing follows them, in the sidebar and in the journals',
  from: '18 Nov: blank gaps on a journal day, an empty band under a page in the sidebar',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Organization'); await T.sleep(1500);
    await T.inSidebar(box, 'SoCalGas'); await T.sleep(2500);
    const side = await box.page.evaluate(() => { const p = document.querySelector('#right-sidebar .sidebar-item.item-type-page .page-inner'); return p ? parseFloat(getComputedStyle(p).marginBottom) : -1; });
    await T.reset(box); await box.page.evaluate(() => { location.hash = '#/'; }); await T.sleep(3000);
    const days = await box.page.evaluate(() => [...document.querySelectorAll('#journals .journal-item')].slice(0, 3).map(i => { const r = i.getBoundingClientRect(), last = [...i.querySelectorAll('.ls-block, .custom-query, .scheduled-or-deadlines')].filter(e => e.getBoundingClientRect().height > 0).pop(); return Math.round(r.bottom - (last ? last.getBoundingClientRect().bottom : r.top)); }));
    const wide = days.filter(d => d > 120);
    if (side > 0) return { ok: false, said: `a page in the sidebar keeps ${side} px under its bullets` };
    if (wide.length) return { ok: false, said: `journal days keep ${wide.join(', ')} px after what they hold` };
    return { ok: true, said: `sidebar page ends at its bullets; days end ${days.join(', ')} px after them` };
  },
};
