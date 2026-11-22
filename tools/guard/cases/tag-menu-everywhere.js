/* The thirteen proposals, 8 (the owner's go, 19 November 2026: "good I like all"): "The same tag menu on a tag, wherever it stands".
   A bullet's tag had its menu (change to its parent, beside it, Go to, Remove tag); the tag after a row in Find and Relations had
   none. Right-clicked there now, the same menu opens, Show its nodes at its top. */
module.exports = {
  parts: ['structure', 'find', 'threads', 'shared'],
  name: 'A tag after a row in Relations and in Find opens the bullet tag\'s menu, Show its nodes at its top',
  from: '19 Nov: the thirteen proposals, 8',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const menu = () => page.evaluate(() => [...document.querySelectorAll('.lk-door-menu .lk-item, .lk-door-menu .lk-group')].map(e => e.textContent.trim()).filter(Boolean));
    const rclick = async sel => { const el = await page.$(sel); if (!el) return false; await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox(); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2, { button: 'right' }); await T.sleep(800); return true; };
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2000);
    if (!await rclick('#main-content-container .th-tw-tag[data-tag-page]')) return { ok: false, said: 'no tag after a row on Chase Checking' };
    const inRelations = await menu();
    await page.keyboard.press('Escape'); await T.sleep(300);
    await page.keyboard.press('Meta+k'); await T.sleep(900); await page.keyboard.type('gas', { delay: 40 }); await T.sleep(1500);
    const found = await rclick('dialog.fd[open] .fd-r .lk-tag[data-tag-title]');
    const inFind = found ? await menu() : [];
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); }
    const good = words => words[0] === 'Show its nodes' && words.some(w => /^Go to #/.test(w)) && words.includes('Remove tag');
    if (!good(inRelations)) return { ok: false, said: `Relations' tag opened: ${inRelations.slice(0, 4).join(', ') || 'nothing'}` };
    if (!found) return { ok: false, said: 'no tag after a row in Find for "gas"' };
    if (!good(inFind)) return { ok: false, said: `Find's tag opened: ${inFind.slice(0, 4).join(', ') || 'nothing'}` };
    return { ok: true, said: 'the tag menu, Show its nodes first, in Relations and in Find' };
  },
};
