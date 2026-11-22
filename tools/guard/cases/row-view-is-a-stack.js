/* 22 November 2026, the owner: "you should be able to close ontology. Lets make row view just seem like any other stack". Ontology's
   section had no ×, and in the row view every other section was folded to a head pinned at the sidebar's foot, a blank band between. */
module.exports = {
  parts: ['sidebar', 'structure'],
  name: 'Ontology has its ×, and the row view is a section of the stack like any other',
  from: '22 Nov: you should be able to close ontology; row view like any other stack',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Purchase'); await T.sleep(1500);
    await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await T.sleep(2500);
    const x = await box.page.evaluate(() => { const item = [...document.querySelectorAll('#right-sidebar .sidebar-item')].find(i => /Ontology/.test(i.querySelector('.sidebar-item-header')?.textContent || '')); const b = item?.querySelector('.sidebar-item-header .item-actions button:last-child'); return !!b && !!b.getClientRects().length; });
    if (!x) return { ok: false, said: 'Ontology has no × to close it' };
    await box.frame().evaluate(() => window.PluginDoor.sideTabs.rows(true)); await T.sleep(1200);
    await box.page.evaluate(() => { const row = [...document.querySelectorAll('#main-content-container .ls-table-row[blockid]')][2]; const cell = row?.querySelector('.ls-table-cell:nth-child(3)') || row; cell?.click(); });
    await T.sleep(3000);
    const r = await box.page.evaluate(() => {
      const row = document.querySelector('#right-sidebar .sidebar-item[data-st-item]'), ont = [...document.querySelectorAll('#right-sidebar .sidebar-item')].find(i => /Ontology/.test(i.querySelector('.sidebar-item-header')?.textContent || ''));
      if (!row || !ont) return { ok: false, said: !row ? 'no row in the sidebar' : 'no Ontology in the sidebar' };
      const open = ont.querySelector('.sidebar-item-header > button')?.getAttribute('aria-expanded') === 'true';
      const gap = Math.round(ont.getBoundingClientRect().top - row.getBoundingClientRect().bottom);
      const close = row.querySelector('.sidebar-item-header .item-actions button:last-child');
      return { open, gap, rowX: !!close && !!close.getClientRects().length };
    });
    await box.frame().evaluate(() => window.PluginDoor.sideTabs.rows(false)); await T.sleep(800);
    if (r.said) return r;
    const bad = [!r.open && 'Ontology folded by the row view', r.gap > 24 && `a ${r.gap} px band between the row and Ontology`, !r.rowX && 'the row has no ×'].filter(Boolean);
    return bad.length ? { ok: false, said: bad.join('; ') } : { ok: true, said: `Ontology open right under the row (${r.gap} px), both with their ×` };
  },
};
