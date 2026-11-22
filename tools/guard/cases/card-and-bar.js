/* The thirteen proposals, 10 and 11 (the owner's go, 19 November 2026: "good I like all"). 10, one card for a link under the
   pointer: a link in a Todo task's words raises Relations' page card, as a link in a Relations line does. 11, one bar for several
   picked things: the bar reads N picked ×, Open in sidebar, Set tag, Set property, More, Delete, in that order. */
module.exports = {
  parts: ['threads', 'todo', 'shared'],
  name: 'A link in a Todo task raises the page card; the picked bar reads Open in sidebar, Set tag, Set property, More, Delete',
  from: '19 Nov: the thirteen proposals, 10 and 11',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const link = await page.$('#main-content-container .td-words [data-open-page]');
    let card = false;
    if (link) { await link.scrollIntoViewIfNeeded(); const r = await link.boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 4 }); await T.sleep(1400); card = await page.evaluate(() => !!document.querySelector('.th-two-way-peek')); await page.mouse.move(5, 5); await T.sleep(400); }
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2000);
    await page.evaluate(() => { const a = document.querySelector('#main-content-container .th-tw-line a.th-tw-record'); a.scrollIntoView({ block: 'center' }); a.focus(); });
    await page.keyboard.press(' '); await T.sleep(800);
    const bar = await page.evaluate(() => [...document.querySelectorAll('#main-content-container .th-tw-bar:not([data-idle]) [data-act]')].map(b => b.textContent.trim()).filter(Boolean));
    await page.keyboard.press('Escape'); await T.sleep(400);
    if (!link) return { ok: false, said: 'no link in a Todo task\'s words' };
    if (!card) return { ok: false, said: 'resting on a link in a Todo task raised no card' };
    const want = ['×', 'Open in sidebar', 'Set tag', 'Set property', 'More', 'Delete'];
    if (bar.join('|') !== want.join('|')) return { ok: false, said: `the picked bar reads ${bar.join(', ')}` };
    return { ok: true, said: 'the card over a Todo link; the bar in the drawn order' };
  },
};
