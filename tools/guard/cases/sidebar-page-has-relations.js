/* The review of 19 November 2026, under rule 7 (act in place): a page opened in the right sidebar showed its properties and its
   bullets and nothing that points at it, since Logseq's Linked references are hidden everywhere and Relations stood only in the main
   view and on the right half of the split. The owner, the same day, of the proposal that puts Relations there: "ok this is good". */
module.exports = {
  parts: ['threads', 'look', 'sidebar'],
  name: 'A page opened in the right sidebar shows its Relations, as in the main view',
  from: '19 Nov: the review’s problem 5, and “ok this is good” of the proposal',
  graph: 'Illness Test Graph',
  async check(box, T) {
    await T.go(box.page, 'Consultation'); await T.sleep(1500);
    await T.inSidebar(box, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(1500);
    const seen = await box.page.evaluate(() => {
      const item = [...document.querySelectorAll('#right-sidebar .sidebar-item.item-type-page')].find(el => /Dr\. Mei Chen/.test(el.querySelector('.sidebar-item-header')?.textContent || ''));
      const rel = item?.querySelector('.th-two-way');
      const r = rel?.getBoundingClientRect();
      return { item: !!item, shown: !!rel && r.height > 20 && getComputedStyle(rel).visibility !== 'hidden', words: (rel?.innerText || '').replace(/\s+/g, ' ').slice(0, 80), stacked: !!item && [...item.querySelectorAll('.ls-sidebar-page-properties > hr')].some(hr => hr.getBoundingClientRect().height > 0 || getComputedStyle(hr).display !== 'none') };
    });
    if (!seen.item) return { ok: false, said: 'the page did not open in the sidebar' };
    if (!seen.shown) return { ok: false, said: 'the page in the sidebar shows no Relations' };
    if (!/Decided|Provider of/.test(seen.words)) return { ok: false, said: 'Relations in the sidebar does not name what points at the page: ' + seen.words };
    if (seen.stacked) return { ok: false, said: 'Logseq’s rule under the properties still stands above Relations’ own line' };
    return { ok: true, said: 'Relations stands under the properties: ' + seen.words };
  },
};
