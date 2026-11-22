/* 22 November 2026, the owner: "add an X or close button to outline. everything can be removed from sidebar". Outline, a part of
   the page that comes by itself on a page with headings, had no ×. It has one now: pressed, Outline goes (and the sidebar with it,
   when nothing else is in it), it stays gone while the page is read on, and "View outline" brings it back. */
module.exports = {
  parts: ['sidebar', 'look'],
  name: 'Outline in the right sidebar has a ×; closed it stays closed, and the sidebar does not stand open and blank',
  from: '22 Nov: “add an X or close button to outline. everything can be removed from sidebar”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const name = `ZZ guard outline close ${Date.now()}`;
    const api = (fn, ...a) => box.page.evaluate(([fn, a]) => window.logseq.api[fn](...a), [fn, a]);
    await api('create_page', name, {}, { redirect: false });
    const block = await api('append_block_in_page', name, 'Plan for next visit');
    const outline = () => box.page.evaluate(() => { const i = [...document.querySelectorAll('#right-sidebar .sidebar-item')].find(x => /outline/i.test(x.querySelector('.sidebar-item-header')?.innerText || '')); const b = i?.querySelector('.sidebar-item-header .item-actions button:last-child'); const r = b?.getBoundingClientRect(); return { there: !!i && !!i.getClientRects().length, x: r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null }; });
    const side = () => box.page.evaluate(() => { const s = document.getElementById('right-sidebar'); return !!s && !s.classList.contains('closed') && s.getBoundingClientRect().width > 40; });
    try {
      await api('upsert_block_property', block.uuid, 'logseq.property/heading', 2);
      await T.go(box.page, name); await T.sleep(1200);
      await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await T.sleep(2500);
      let o = await outline();
      if (!o.there) return { ok: false, said: 'no Outline in the sidebar on a page with a heading' };
      if (!o.x) return { ok: false, said: 'Outline has no × to close it' };
      await box.page.mouse.click(o.x.x, o.x.y); await T.sleep(2800);
      o = await outline();
      if (o.there) return { ok: false, said: 'Outline is still in the sidebar after its ×' };
      if (await side()) return { ok: false, said: 'the sidebar stands open and blank after Outline, the last thing in it, was closed' };
      await T.go(box.page, name); await T.sleep(1500);
      await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await T.sleep(2500);
      if ((await outline()).there) return { ok: false, said: 'Outline came back by itself after being closed' };
      await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('contents')); await T.sleep(2500);
      if (!(await outline()).there) return { ok: false, said: 'asked for again, Outline did not come back' };
      return { ok: true, said: 'a × on Outline; closed it goes, with the sidebar when it was alone; asked for, it returns' };
    } finally {
      await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('contents')).catch(() => {});
      await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible(false)).catch(() => {});
      await api('delete_page', name).catch(() => {});
    }
  },
};
