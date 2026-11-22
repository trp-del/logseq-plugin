/* 21 November 2026, the owner, of a Relations list with two nodes picked: "Why is the selector appear not on top of table. move plus
   and dots to right of items, not far right", then "add select all checkbox too". The picked bar stands at the top of the list
   holding the picks, its heading's tick box picks every node of that list; the heading's + and ⋯ follow its words. */
module.exports = {
  parts: ['threads', 'shared'],
  name: 'The picked bar stands at the top of its list its heading with a pick-all box; a list heading\'s + and ⋯ follow its words',
  from: '21 Nov: "Why is the selector appear not on top of table"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2000);
    const head = await page.evaluate(() => {
      const h = document.querySelector('#main-content-container .th-two-way .th-tw-head'); if (!h) return null;
      const words = h.querySelector('.th-tw-chips').getBoundingClientRect(), dots = h.querySelector('.th-tw-groupby')?.getBoundingClientRect();
      return { gap: dots ? Math.round(dots.left - words.right) : null, room: Math.round(h.getBoundingClientRect().right - (dots?.right || 0)) };
    });
    await page.evaluate(() => { const lines = [...document.querySelectorAll('#main-content-container .th-tw-row .th-tw-line a.th-tw-record')]; const a = lines[2] || lines[0]; a.scrollIntoView({ block: 'center' }); a.focus(); });
    await page.keyboard.press(' '); await T.sleep(800);
    const placed = await page.evaluate(() => {
      const bar = document.querySelector('#main-content-container .th-tw-bar:not([data-idle])'); if (!bar) return null;
      return { top: bar.parentElement?.matches('.th-tw-list > .th-ol-in') && bar.parentElement.firstElementChild === bar, all: !!bar.closest('.th-tw-row')?.querySelector('.th-tw-head > .th-tw-pickall') };
    });
    let every = null;
    if (placed?.all) {
      await page.evaluate(() => document.querySelector('#main-content-container .th-tw-bar').closest('.th-tw-row').querySelector('.th-tw-head > .th-tw-pickall').scrollIntoView({ block: 'center' })); await page.click('#main-content-container .th-tw-row:has(.th-tw-bar) .th-tw-head > .th-tw-pickall'); await T.sleep(800);
      every = await page.evaluate(() => { const row = document.querySelector('#main-content-container .th-tw-bar')?.closest('.th-tw-row'); const b = [...(row?.querySelectorAll('.th-tw-line > input.th-tw-pick') || [])]; return { n: b.length, on: b.filter(x => x.checked).length }; });
    }
    await page.keyboard.press('Escape'); await T.sleep(400);
    if (!head || head.gap == null) return { ok: false, said: 'no list heading with its ⋯' };
    if (head.gap > 60) return { ok: false, said: `the heading's ⋯ stands ${head.gap}px after its words` };
    if (!placed) return { ok: false, said: 'no bar after a pick' };
    if (!placed.top) return { ok: false, said: 'the bar is not at the top of its list' };
    if (!placed.all) return { ok: false, said: 'the list\'s heading has no pick-all box' };
    if (!every || every.on !== every.n) return { ok: false, said: `the pick-all box picked ${every?.on} of ${every?.n}` };
    return { ok: true, said: `the bar on top, all ${every.n} picked from its box, the ⋯ ${head.gap}px after the words` };
  },
};
