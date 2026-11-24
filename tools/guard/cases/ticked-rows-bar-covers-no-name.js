/* The owner said "good" on 24 November 2026 to the drawing "Emptiness, Applied": "Cover nothing you are acting on. The table is its
   own preview." Until then the bar for ticked rows lay over the column names (Name and Payment Source gone, Automatic cut) at the
   moment a property in one of those columns was about to be set, in a box with a line round it. Now it is a flat capsule (the
   library's: the wash, round ends, no line, no shadow) in the line above the names; its words start on the names' edge; no row
   moves when it comes or goes; and "Move values…" is still one of its words. With "Set property" pressed the bar stays whole and
   that word is lit ("so the screen still says where you are"), where Logseq left only the count. The bin's question is asked in
   the bar ("Delete 3 pages?", the keyboard on "Leave it"), the ticked names struck red, with Logseq's own window unseen behind
   it; Escape leaves and keeps the ticks. The case never answers yes. */
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
    if (got) {
      // Set property pressed: the bar keeps its words, the pressed one lit.
      await page.locator('#main-content-container .ls-table-actions').getByText('Set property', { exact: true }).click(); await T.sleep(900);
      const set = await page.evaluate(() => { const bar = document.querySelector('#main-content-container .ls-table-actions'); if (!bar) return null; const shown = [...bar.querySelectorAll('button')].filter(b => b.checkVisibility()); return { words: shown.map(b => b.textContent.trim()).filter(Boolean), lit: shown.filter(b => b.matches('[data-lk-on], [aria-expanded="true"]')).map(b => b.textContent.trim()), list: !!document.querySelector('.ui__popover-content') }; });
      if (!set || !set.list) out.push('“Set property” opened no list');
      else { if (set.words.length < got.words.length) out.push(`with “Set property” pressed the bar shows ${set.words.length ? 'only ' + set.words.join(', ') : 'only its count'}`); if (set.lit.join() !== 'Set property') out.push('with “Set property” pressed, that word is not lit'); }
      for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await T.sleep(250); }
      // The bin: asked in the bar, Logseq's window unseen, the keyboard on Leave it, the names struck; Escape leaves.
      const bin = page.locator('#main-content-container .ls-table-actions button:has(.ls-icon-trash)').first();
      if (await bin.count() && await bin.isVisible()) {
        await bin.click(); await T.sleep(900);
        const ask = await page.evaluate(() => { const a = document.querySelector('.st-bar-ask'), d = document.querySelector('.ui__dialog-content'); const struck = [...document.querySelectorAll('#main-content-container .ls-table-row')].filter(r => r.querySelector('label[data-table-row-select] :is([aria-checked="true"], [data-state="checked"], [data-checked])')).map(r => getComputedStyle(r.querySelector('.table-block-title') || r).textDecorationLine);
          return { words: a?.textContent || '', window: d ? getComputedStyle(d).opacity : null, on: document.activeElement?.textContent.trim(), enter: a?.querySelector('.lk-enter')?.textContent.trim(), struck }; });
        if (!ask.words) out.push(`the bin's question is not asked in the bar${ask.window === '1' ? ': Logseq’s window lies over the table' : ''}`);
        else {
          if (!/^Delete \d+ \w+\?/.test(ask.words)) out.push(`the question reads “${ask.words.slice(0, 40)}”`);
          if (ask.window !== null && ask.window !== '0') out.push('Logseq’s own window shows behind the question');
          if (ask.on !== 'Cancel' || ask.enter !== 'Leave it') out.push(`the keyboard waits on “${ask.enter || ask.on}” (Leave it)`);
          if (!ask.struck.length || ask.struck.some(t => !/line-through/.test(t))) out.push('the ticked names are not struck through');
        }
        await page.keyboard.press('Escape'); await T.sleep(700);
        const left = await page.evaluate(() => ({ ask: !!document.querySelector('.st-bar-ask'), window: !!document.querySelector('.ui__dialog-content'), bar: !!document.querySelector('#main-content-container .ls-table-actions') }));
        if (left.window) { const no = page.locator('.ui__dialog-content button', { hasText: /^Cancel$/ }); if (await no.count()) await no.click({ force: true }).catch(() => {}); await T.sleep(400); }
        if (ask.words && (left.ask || left.window)) out.push('Escape did not leave the bin’s question');
        if (!left.bar) out.push('leaving the bin’s question took the ticks off');
      } else out.push('the bar shows no bin');
    }
    const during = await tops();
    if (during.join() !== before.join()) out.push(`the rows moved when the bar came (${before[0]} to ${during[0]})`);
    await untick(); await T.sleep(500);
    const after = await tops();
    if (after.join() !== before.join()) out.push(`the rows did not come back when the bar went (${before[0]} to ${after[0]})`);
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'the bar is a flat capsule above the names, its words on their edge, and no row moves' };
  },
};
