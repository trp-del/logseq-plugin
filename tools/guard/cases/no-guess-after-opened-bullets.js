/* The owner, 21 November 2026, with a picture of a node opened in place whose bullets were each followed by a wrapped
   "could be a Insurance Policy · Charged by" / "could be a Bill payment · Charged by" (added after Logseq's editor lines in 0.4.13):
   "Get rid of these." No bullet of a node opened in place carries a "could be a …" guess, whoever draws the bullet. */
module.exports = {
  parts: ['threads', 'predictive', 'shared'],
  name: 'No "could be a …" after the bullets of a node opened in place',
  from: '21 Nov: "Get rid of these."',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDGUESS")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    await clean();
    // Bullets whose words read like a kind, under a node that a page lists in its Relations.
    const made = await f.evaluate(async () => {
      const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?p :block/title "Charged by"] [?p :db/ident ?id] [?b ?id ?v] [?v :block/title "GEICO"] [?b :block/uuid ?u]]');
      const host = rows[0]?.[0]; if (!host) return null;
      const one = await logseq.Editor.insertBlock(host, 'GUARDGUESS Paid the GEICO car insurance bill for the month', { sibling: false });
      await logseq.Editor.insertBlock(one.uuid, 'GUARDGUESS GEICO auto insurance policy renewed for six months', { sibling: false });
      return String(host);
    });
    if (!made) { await clean(); return { ok: false, said: 'no node charged by GEICO to open' }; }
    await T.go(page, 'GEICO'); await T.still(page); await T.sleep(1500);
    const opened = await page.evaluate(u => { const line = document.querySelector(`#main-content-container .th-tw-line[data-uuid="${u}"]`) || document.querySelector('#main-content-container .th-tw-line'); const chev = line?.querySelector('.th-chev'); if (!chev) return false; chev.click(); return true; }, made);
    if (!opened) { await clean(); return { ok: false, said: 'no row to open on GEICO' }; }
    await T.sleep(12000);
    const seen = await page.evaluate(() => ({ words: (document.querySelector('#main-content-container .th-ls-node, #main-content-container .th-ol-kids')?.innerText || '').includes('GUARDGUESS'), guesses: [...document.querySelectorAll('#main-content-container .th-two-way .th-ls-tail, #main-content-container .th-two-way [data-bnode]')].map(e => e.textContent.trim()) }));
    await page.evaluate(() => document.querySelector('#main-content-container .th-chev[aria-expanded="true"][data-dig]')?.click()); await T.sleep(500);
    await clean();
    if (seen.guesses.length) return { ok: false, said: `an opened node's bullets carry ${seen.guesses.length} guess(es): “${seen.guesses[0]}”` };
    return { ok: true, said: seen.words ? 'the opened node shows its bullets with no "could be a …" after them' : 'no "could be a …" in the opened node (its bullets were not on screen)' };
  },
};
