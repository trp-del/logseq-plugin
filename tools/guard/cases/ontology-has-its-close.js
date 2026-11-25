/* 22 November 2026, the owner: "you should be able to close ontology. Lets make row view just seem like any other stack". Ontology's
   section had no ×. (The second half of the case, the row view as a section of the stack, went with the row view itself, which the
   owner dropped on 24 November 2026; until then this file was row-view-is-a-stack.js.) */
module.exports = {
  parts: ['sidebar', 'structure'],
  name: 'Ontology has its × in the sidebar',
  from: '22 Nov: you should be able to close ontology',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Purchase'); await T.sleep(1500);
    await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await T.sleep(2500);
    const x = await box.page.evaluate(() => { const item = [...document.querySelectorAll('#right-sidebar .sidebar-item')].find(i => /Ontology/.test(i.querySelector('.sidebar-item-header')?.textContent || '')); const b = item?.querySelector('.sidebar-item-header .item-actions button:last-child'); return !!b && !!b.getClientRects().length; });
    return x ? { ok: true, said: 'Ontology stands in the sidebar beside a tag\'s page, with its ×' } : { ok: false, said: 'Ontology has no × to close it' };
  },
};
