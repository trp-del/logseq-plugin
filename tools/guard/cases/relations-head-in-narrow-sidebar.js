/* The review of 24 November 2026, at the owner's window (700 px wide, where the right sidebar is 280): a Relations list in the
   sidebar kept its kinds, its +, its ··· and its days on one line, the kinds were left 26 px and broke a letter or two a line
   ("A", "ll 3", "Pur", "Bill"). In a cramped place the head wraps: each kind whole on a line, the days whole. */
module.exports = {
  parts: ['threads', 'sidebar'],
  name: 'A Relations list in the right sidebar of a 700 px window: each kind in its head whole on one line, the days whole',
  from: '24 Nov: the review, the kinds a letter a line in the sidebar',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    await T.inSidebar(box, 'Amex Gold'); await T.sleep(1500);
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(page); await T.sleep(1200);
    const got = await page.evaluate(() => {
      const side = document.querySelector('#right-sidebar'); if (!side) return { none: 'no right sidebar' };
      const heads = [...side.querySelectorAll('.th-two-way .th-tw-head')].filter(h => h.querySelector('.th-tw-chips .th-tw-chip, .th-tw-chips .th-tw-piece'));
      if (!heads.length) return { none: 'no Relations list with kinds in the sidebar' };
      const W = innerWidth, bad = [];
      for (const h of heads) {
        const line = parseFloat(getComputedStyle(h).lineHeight) || 24;
        for (const el of h.querySelectorAll('.th-tw-chips .th-tw-chip, .th-tw-chips .th-tw-piece, .th-tw-chips .lk-more, .th-tw-right')) {
          const r = el.getBoundingClientRect(); if (r.width < 1) continue;
          const words = el.textContent.replace(/\s+/g, ' ').trim();
          if (r.height > line * 1.6) bad.push(`“${words}” on ${Math.round(r.height / line)} lines`);
          if (r.right > W + 1) bad.push(`“${words}” past the window's edge`);
        }
      }
      return { side: Math.round(side.getBoundingClientRect().width), heads: heads.length, bad: [...new Set(bad)].slice(0, 4) };
    });
    if (got.none) return { ok: false, said: got.none };
    if (got.side > 340) return { ok: false, said: `the sidebar is ${got.side}px wide here, not the cramped place this case is about` };
    return got.bad.length ? { ok: false, said: `in a sidebar ${got.side}px wide: ${got.bad.join(', ')}` } : { ok: true, said: `${got.heads} list head(s) in a sidebar ${got.side}px wide, every kind and the days whole` };
  },
};
