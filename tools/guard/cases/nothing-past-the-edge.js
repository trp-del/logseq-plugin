/* 17 November 2026, found by the 0.4 audit after the sidebar releases: at 900 px the right sidebar's contents kept the width they
   had in a wider window and ran past the window's right edge. */
module.exports = {
  name: 'Nothing runs past the window’s edge at 900 px, with a page in the right sidebar',
  from: '17 Nov: the sidebar ran past the window’s edge in a narrower window',
  graph: 'Illness Test Graph',
  async check(box, T) {
    await T.go(box.page, 'Dr. Mei Chen'); await T.sleep(1500);
    await T.inSidebar(box, 'Consultation'); await T.sleep(1500);
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(box.page); await T.sleep(800);
    const past = await box.page.evaluate(() => {
      const W = innerWidth, out = [];
      for (const el of document.querySelectorAll('.cp__right-sidebar *, #main-content-container *')) {
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        if (r.right > W + 2 && getComputedStyle(el).visibility !== 'hidden') out.push((el.className?.baseVal ?? el.className ?? el.tagName).toString().split(' ')[0] + ' to ' + Math.round(r.right));
      }
      return { out: [...new Set(out)].slice(0, 3), sideways: document.documentElement.scrollWidth > W + 1 };
    });
    return past.out.length || past.sideways ? { ok: false, said: (past.sideways ? 'the window scrolls sideways; ' : '') + past.out.join(', ') } : { ok: true, said: 'all inside 900 px' };
  },
};
