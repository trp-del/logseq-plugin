/* Found on 20 November 2026 in 0.4.7 by a sweep on the Illness Test Graph: a page opened in place in Relations showed a faint empty
   bullet and blank room where its bullets should stand (Dr. Mei Chen opened on Northgate Cancer Center lost "Consultant medical
   oncologist…"), and as soon as a node was opened in place the tag path beside the page's title went. Both came with Logseq's own
   editor in the opened node: a rule meant to leave out a bullet's own first line also matched a page's top bullets, and the editor
   for a page brought a second page title onto the page. */
module.exports = {
  parts: ['threads', 'look', 'shared'],
  name: 'A page opened in place keeps its bullets, and the page it is opened on keeps its tag path',
  from: '20 Nov: the error sweep on 0.4.7',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Northgate Cancer Center'); await T.still(page); await T.sleep(1200);
    const pathOf = () => page.evaluate(() => [...document.querySelectorAll('#main-content-container .lk-held')].filter(e => !e.closest('.th-two-way') && e.getBoundingClientRect().width > 0).map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)[0] || '');
    const before = await pathOf();
    const opened = await page.evaluate(() => { const line = document.querySelector('#main-content-container .th-tw-line'); const chev = line?.querySelector('.th-chev'); if (!chev) return false; chev.click(); return true; });
    if (!opened) return { ok: false, said: 'no row to open on Northgate Cancer Center' };
    await T.sleep(3500);
    const seen = await page.evaluate(() => { const own = document.querySelector('#main-content-container .th-ls-node'); const drawn = document.querySelector('#main-content-container .th-ol-kids'); return { own: !!own, words: ((own || drawn)?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200), tall: own ? Math.round(own.getBoundingClientRect().height) : 0 }; });
    const after = await pathOf();
    await page.evaluate(() => document.querySelector('#main-content-container .th-chev[aria-expanded="true"][data-dig]')?.click()); await T.sleep(600);
    if (!/Consultant medical oncologist/.test(seen.words)) return { ok: false, said: 'Dr. Mei Chen opened in place does not show her bullet: “' + seen.words.slice(0, 80) + '”' };
    if (before && after !== before) return { ok: false, said: `the tag path beside the title went from “${before}” to “${after}” when a node was opened in place` };
    return { ok: true, said: 'the opened page shows its bullet, and the tag path stays (“' + after.slice(0, 40) + '”)' };
  },
};
