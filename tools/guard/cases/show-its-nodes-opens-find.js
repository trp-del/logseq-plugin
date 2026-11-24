/* The thirteen proposals, 9 (the owner's go, 19 November 2026: "good I like all"): "Show its nodes" leads to Find. Until 24 November
   2026 this case pressed the item in Ontology's own tag menu; the owner took it out of that menu that day ("remove: tick, show its
   nodes"), so the case now presses it where it stays: the menu of a tag after a row (the same menu as a bullet's tag). Right-click
   the tag after a row on Chase Checking, press Show its nodes: Find is open, that tag picked, its nodes listed. */
module.exports = {
  parts: ['structure', 'find', 'threads', 'shared'],
  name: '"Show its nodes" in a tag\'s menu opens Find with that tag picked',
  from: '19 Nov: the thirteen proposals, 9',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2000);
    const el = await page.$('#main-content-container .th-tw-tag[data-tag-page]');
    if (!el) return { ok: false, said: 'no tag after a row on Chase Checking' };
    await el.scrollIntoViewIfNeeded(); const tag = (await el.textContent()).trim().replace(/^#/, ''); const r = await el.boundingBox();
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2, { button: 'right' }); await T.sleep(800);
    const item = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => /^Show its nodes/.test(e.textContent.trim()) && e.getBoundingClientRect().width) || null);
    if (!item.asElement()) { await page.keyboard.press('Escape'); return { ok: false, said: 'no Show its nodes in the tag\'s menu' }; }
    const q = await item.asElement().boundingBox();
    await page.mouse.click(q.x + 20, q.y + q.height / 2); await T.sleep(2500);
    const seen = await page.evaluate(() => { const d = document.querySelector('dialog.fd[open]'); return { find: !!d, picked: d ? [...d.querySelectorAll('.fd-piece .lk-tag')].map(e => e.textContent.trim().replace(/^#/, '')) : [], rows: d ? d.querySelectorAll('.fd-r').length : 0 }; });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); }
    if (!seen.find) return { ok: false, said: 'Show its nodes did not open Find' };
    if (!seen.picked.includes(tag)) return { ok: false, said: `Find opened without ${tag} picked (${seen.picked.join(', ') || 'nothing picked'})` };
    if (!seen.rows) return { ok: false, said: `Find opened on ${tag} with no rows` };
    return { ok: true, said: `Find opened on ${tag}, ${seen.rows} rows` };
  },
};
