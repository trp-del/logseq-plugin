/* The owner said "good" on 24 November 2026 to the drawing "Emptiness, Applied": "Cover nothing you are acting on. The table is its
   own preview." Until then the bar for ticked rows lay over the column names (Name and Payment Source gone, Automatic cut) at the
   moment a property in one of those columns was about to be set, in a box with a line round it. Now it is a flat capsule (the
   library's: the wash, round ends, no line, no shadow) in the line above the names; its words start on the names' edge; no row
   moves when it comes or goes; and "Move values…" is still one of its words. */
module.exports = {
  parts: ['look', 'structure', 'shared'],
  name: 'The bar for ticked rows is a flat capsule in the line above the column names: it covers no name and no row moves',
  from: '24 Nov: "Emptiness, Applied", the owner’s “good”: cover nothing you are acting on',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box, out = [];
    const untick = async () => { const all = page.locator('.ls-table-header label[for="header-checkbox"]').first(); for (let i = 0; i < 2 && await page.locator('.ls-table-actions').count(); i++) { await all.click({ force: true }).catch(() => {}); await T.sleep(300); } };
    const tops = () => page.evaluate(() => [...document.querySelectorAll('#main-content-container .ls-table-row')].slice(0, 5).map(r => Math.round(r.getBoundingClientRect().top * 2) / 2));
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(120); }
    await T.go(page, 'Bills'); await T.sleep(2600);
    await untick(); await T.sleep(300);
    if (!(await page.locator('#main-content-container .ls-table-row').count())) return { ok: false, said: 'Bills shows no table rows' };
    const before = await tops();
    for (let i = 0; i < 3; i++) { const row = page.locator('#main-content-container .ls-table-row').nth(i); await row.hover(); await T.sleep(150); await row.locator('label[data-table-row-select]').click({ force: true }); await T.sleep(250); }
    await T.sleep(600); await page.mouse.move(690, 550);
    const got = await page.evaluate(() => {
      const bar = document.querySelector('#main-content-container .ls-table-actions'); if (!bar) return null;
      const b = bar.getBoundingClientRect(), c = getComputedStyle(bar), over = (a, r) => Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) * Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
      const names = [...document.querySelectorAll('#main-content-container .ls-table-header-cell')].filter(e => e.textContent.trim()).map(e => { const g = document.createRange(); g.selectNodeContents(e.querySelector('span') || e); return [e.textContent.trim().slice(0, 20), g.getBoundingClientRect()]; });
      const count = bar.querySelector('.selection-count'), g = document.createRange(); if (count) g.selectNodeContents(count);
      return { covered: names.filter(([, r]) => over(b, r) > 1).map(([n]) => n), line: c.borderTopWidth !== '0px' && c.borderTopStyle !== 'none', shadow: c.boxShadow !== 'none', radius: parseFloat(c.borderTopLeftRadius), h: b.height, ground: c.backgroundColor,
        edge: count && names[0] ? Math.abs(g.getBoundingClientRect().left - names[0][1].left) : null, move: !!bar.querySelector('[data-st-values]'), words: [...bar.querySelectorAll('button')].map(x => x.textContent.trim()).filter(Boolean) };
    });
    if (!got) out.push('no bar showed for the ticked rows');
    else {
      if (got.covered.length) out.push(`the bar lies over the column name${got.covered.length > 1 ? 's' : ''} ${got.covered.map(n => `“${n}”`).join(', ')}`);
      if (got.line || got.shadow) out.push(`the bar has ${got.line ? 'a line round it' : 'a shadow'} (flat: none)`);
      if (got.radius < Math.min(got.h, 28) / 2 - 0.5) out.push(`the bar's corners are ${got.radius} pt (round ends)`);
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(got.ground)) out.push('the bar has no ground of its own (the wash)');
      if (got.edge != null && got.edge > 1.5) out.push(`the bar's words start ${got.edge.toFixed(1)} pt off the names' edge`);
      if (!got.move) out.push('“Move values…” is not among the bar\'s words');
    }
    const during = await tops();
    if (during.join() !== before.join()) out.push(`the rows moved when the bar came (${before[0]} to ${during[0]})`);
    await untick(); await T.sleep(500);
    const after = await tops();
    if (after.join() !== before.join()) out.push(`the rows did not come back when the bar went (${before[0]} to ${after[0]})`);
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'the bar is a flat capsule above the names, its words on their edge, and no row moves' };
  },
};
