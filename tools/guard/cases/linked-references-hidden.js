/* The owner, 18 November 2026: "hide linked references everywhere including journal days but have relations". Seen broken the same
   day: the table bar's new style dressed Logseq's Linked references heading, and it showed again in the right sidebar. */
module.exports = {
  name: 'Logseq’s Linked references stay hidden, on a page and in the right sidebar',
  from: '18 Nov: “hide linked references everywhere including journal days but have relations”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    // A person page, then the same page in the sidebar beside a tag's page: where the slip of 18 November showed it again.
    await T.go(box.page, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(1000);
    let shownMain = await box.page.evaluate(() => [...document.querySelectorAll('#main-content-container .references')].some(el => el.getBoundingClientRect().height > 4 && getComputedStyle(el).display !== 'none'));
    await T.go(box.page, 'Consultation'); await T.sleep(1500);
    await T.inSidebar(box, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(1000);
    const shown = await box.page.evaluate(() => [...document.querySelectorAll('.references')].filter(el => { const r = el.getBoundingClientRect(); return r.height > 4 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; }).map(el => el.closest('.cp__right-sidebar') ? 'in the right sidebar' : 'on the page'));
    if (shownMain) shown.push('on the page');
    return shown.length ? { ok: false, said: 'Linked references shows ' + [...new Set(shown)].join(' and ') } : { ok: true, said: 'hidden on the page and in the sidebar' };
  },
};
