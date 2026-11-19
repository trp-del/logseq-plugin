/* The owner, 18 November 2026: "relations should be at bottom of journal not first". */
module.exports = {
  parts: ['threads'],   // the parts of the plugin whose change this case is run for (every case runs before a release)
  name: 'On a journal day, Relations stands after the day’s bullets',
  from: '18 Nov: “relations should be at bottom of journal not first”',
  graph: 'Personal Finance',
  async check(box, T) {
    const day = await T.deadlineDay(box);
    await T.go(box.page, day); await T.still(box.page); await T.sleep(1500);
    const at = await box.page.evaluate(() => {
      const main = document.querySelector('#main-content-container') || document;
      const rel = main.querySelector('.th-two-way'), blocks = main.querySelector('.page.is-journals .ls-page-blocks, .ls-page-blocks');
      if (!rel) return 'no Relations section';
      if (!blocks) return 'no bullets';
      return rel.getBoundingClientRect().top >= blocks.getBoundingClientRect().bottom - 2 ? '' : 'Relations stands above the day’s bullets';
    });
    return at ? { ok: false, said: `${day}: ${at}` } : { ok: true, said: `${day}: Relations after the bullets` };
  },
};
