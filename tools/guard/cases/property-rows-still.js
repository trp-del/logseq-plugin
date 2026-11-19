/* 16 November 2026: a bullet's property row redrew about a hundred times a second (Look's chevron hung past the strip Logseq
   measures, so Logseq's Expand button came and went). It depended on the window's width: 39 of 460 rows looped at 980 px. */
module.exports = {
  parts: ['look'],   // the parts of the plugin whose change this case is run for (every case runs before a release)
  name: 'A page with property rows stays still once drawn, at 980 and 1440 px',
  from: '16 Nov: Logseq’s Expand button flickering without end on a bullet’s property row',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const out = [];
    for (const width of [980, 1440]) {
      await box.cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await T.go(box.page, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(500);
      const c = await T.churn(box.page, 2000);
      if (c.n > 30) out.push(`${c.n} changes in 2 s at ${width} px, most in ${(c.who[0] || [])[0]}`);
    }
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'no changes once drawn' };
  },
};
