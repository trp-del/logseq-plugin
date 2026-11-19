/* 18 November 2026, the owner's list: in Find's foot the keys (Tab, Enter, Shift Enter) looked too much like the words for what they
   do. Each key stands in Logseq's key caps. */
module.exports = {
  parts: ['find'],   // the parts of the plugin whose change this case is run for (every case runs before a release)
  name: 'Find’s foot draws every key in a key cap',
  from: '18 Nov: the keys in the search footer looked like the action words',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Organization'); await T.sleep(1500);
    await box.page.keyboard.press('Meta+k'); await T.sleep(900); await box.page.keyboard.type('amex', { delay: 60 }); await T.sleep(1500);
    const r = await box.page.evaluate(() => { const ks = [...document.querySelectorAll('.fd-foot .fd-k')]; return { n: ks.length, bare: ks.filter(k => !k.querySelector('kbd')).map(k => k.textContent) }; });
    await box.page.keyboard.press('Escape'); await box.page.keyboard.press('Escape');
    if (!r.n) return { ok: false, said: 'no keys in the foot' };
    return r.bare.length ? { ok: false, said: 'keys as words: ' + r.bare.join(', ') } : { ok: true, said: `${r.n} keys, each in a cap` };
  },
};
