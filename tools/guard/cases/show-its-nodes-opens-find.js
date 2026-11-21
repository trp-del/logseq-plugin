/* The thirteen proposals, 9 (the owner's go, 19 November 2026: "good I like all"): "Show its nodes" leads to Find. In Ontology it
   swapped the map for a list of its own; now one press opens Find with that tag picked, its rows the one opened node as anywhere
   in Find. Right-click Bills in Ontology, press Show its nodes: Find is open, Bills picked, Bills' nodes listed. */
module.exports = {
  parts: ['structure', 'find', 'shared'],
  name: 'Ontology\'s "Show its nodes" opens Find with that tag picked',
  from: '19 Nov: the thirteen proposals, 9',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    const name = await page.evaluateHandle(() => [...document.querySelectorAll('#main-content-container .nm')].find(e => e.textContent.trim() === 'Bills') || null);
    if (!name.asElement()) return { ok: false, said: 'Bills is not in Ontology\'s map' };
    const r = await name.asElement().boundingBox();
    await page.mouse.click(r.x + 10, r.y + r.height / 2, { button: 'right' }); await T.sleep(800);
    const item = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-item, [data-act]')].find(e => /Show its nodes/.test(e.textContent) && e.getBoundingClientRect().width) || null);
    if (!item.asElement()) return { ok: false, said: 'no Show its nodes in the tag\'s menu' };
    const q = await item.asElement().boundingBox();
    await page.mouse.click(q.x + 20, q.y + q.height / 2); await T.sleep(2500);
    const seen = await page.evaluate(() => { const d = document.querySelector('dialog.fd[open]'); return { find: !!d, picked: d ? [...d.querySelectorAll('.fd-piece .lk-tag')].map(e => e.textContent) : [], rows: d ? d.querySelectorAll('.fd-r').length : 0, menu: !!document.querySelector('#main-content-container .st-menu, #main-content-container [data-st-menu]') }; });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); }
    if (!seen.find) return { ok: false, said: 'Show its nodes did not open Find' };
    if (!seen.picked.includes('Bills')) return { ok: false, said: `Find opened without Bills picked (${seen.picked.join(', ') || 'nothing picked'})` };
    if (!seen.rows) return { ok: false, said: 'Find opened on Bills with no rows' };
    return { ok: true, said: `Find opened on Bills, ${seen.rows} rows` };
  },
};
