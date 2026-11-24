/* The review of 24 November 2026, by hand at the owner's window (700 px, the left sidebar open): on Chase Checking, "Mortgage 3" pressed
   in the line of choices under "Payment Source" narrowed the list from 53 nodes to 3, and the only sign was "Mortgage" a shade
   darker than the five values beside it, under a head still reading "All 53". The grammar's narrowing words: the one in force is in
   the text colour with the view's short bar. A value the list is narrowed to carries that bar, as "All" does in the line above it. */
module.exports = {
  parts: ['threads', 'shared'],
  name: 'In a Relations line of choices, the value the list is narrowed to carries the short bar of a view in force',
  from: '24 Nov: the review, a narrowed list told by a darker grey alone',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2500);
    const at = await page.evaluate(() => { const v = document.querySelector('#main-content-container .th-two-way .th-tw-choices .lk-cv .lk-view'); if (!v) return null; v.scrollIntoView({ block: 'center' }); const r = v.getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }; });
    if (!at) return { ok: false, said: 'no line of choices over Chase Checking\'s long list' };
    await T.sleep(400);
    const where = await page.evaluate(() => { const r = document.querySelector('#main-content-container .th-two-way .th-tw-choices .lk-cv .lk-view').getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }; });
    // The bar of a view: the hairline the library draws under a word in force (its ::after), as wide as the word and its number.
    const bar = sel => page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const a = getComputedStyle(el, '::after'), r = el.getBoundingClientRect(); return { words: el.textContent.trim(), drawn: a.content !== 'none' && parseFloat(a.height) >= 1 && parseFloat(a.width) >= 8 && !/rgba\(0, 0, 0, 0\)|transparent/.test(a.backgroundColor), under: parseFloat(a.bottom), h: Math.round(r.height) }; }, sel);
    const rest = await bar('#main-content-container .th-two-way .th-tw-choices .lk-cv .lk-view');
    await page.mouse.click(where.x, where.y); await T.sleep(1200);
    await page.mouse.move(8, 400);   // away, so the look under the pointer is not taken for the look in force
    await T.sleep(300);
    const taken = await bar('#main-content-container .th-two-way .th-tw-choices .lk-cv .lk-view[aria-pressed="true"]');
    const kinds = await bar('#main-content-container .th-two-way .th-tw-head .th-tw-chip.lk-view.on');
    // Pressed again: the whole list back, and no bar left.
    const again = await page.evaluate(() => { const r = document.querySelector('#main-content-container .th-tw-choices .lk-cv .lk-view[aria-pressed="true"]')?.getBoundingClientRect(); return r ? { x: r.x + 8, y: r.y + r.height / 2 } : null; });
    if (again) { await page.mouse.click(again.x, again.y); await T.sleep(800); await page.mouse.move(8, 400); await T.sleep(200); }
    const after = await page.evaluate(() => !!document.querySelector('#main-content-container .th-tw-choices .lk-cv .lk-view.on, #main-content-container .th-tw-choices .lk-cv .lk-view[aria-pressed="true"]'));
    if (rest?.drawn) return { ok: false, said: `“${rest.words}” carries a bar before anything is pressed` };
    if (!taken) return { ok: false, said: 'the value pressed is not marked as taken' };
    if (!taken.drawn) return { ok: false, said: `“${taken.words}” pressed narrows the list and carries no bar: only its grey says so${kinds?.drawn ? ', where “' + kinds.words + '” in the line of kinds has its bar' : ''}` };
    if (taken.h > 30) return { ok: false, said: `the value in force stands ${taken.h}px high, not on one line` };
    if (after) return { ok: false, said: 'pressed again, a value still shows as in force' };
    return { ok: true, said: `“${taken.words}” in force carries the bar; pressed again, none does` };
  },
};
