/* The review of 24 November 2026, at the owner's window (700 px wide, where the right sidebar is 280): a page in the sidebar kept
   Logseq's 150 px column for its property names, its values were left 46 px, a balance read "-1 / 38 / 7.4 / 2" down four lines
   and a linked page ran past the window's edge. In a narrow sidebar each name stands over its value, which then has the sidebar's
   width, as a row's do in the row view. With the left sidebar open too, the page beside it is 174 px and its values had no width
   at all: the same holds for the page itself. */
module.exports = {
  parts: ['look', 'sidebar'],
  name: 'A page in the right sidebar of a 700 px window, and a page left little width beside it: each property value whole on its line, none past the window\'s edge',
  from: '24 Nov: the review, a balance broken two figures a line in the sidebar',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    await T.inSidebar(box, 'Amex Gold'); await T.sleep(1500);
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(page); await T.sleep(1200);
    const look = where => page.evaluate(where => {
      const side = document.querySelector(where === 'side' ? '#right-sidebar .sidebar-item.item-type-page' : '#main-content-container'); if (!side) return { none: 'no page in the right sidebar' };
      const pairs = [...side.querySelectorAll('.ls-page-properties .property-pair')];
      if (!pairs.length) return { none: where === 'side' ? 'the page in the sidebar shows no properties' : 'the page shows no properties' };
      const W = innerWidth, bad = [];
      for (const p of pairs) {
        const name = (p.querySelector('.property-key, .property-key-panel, .property-k')?.textContent || '').trim();
        const v = p.querySelector('.property-value-inner, .property-value'); if (!v) continue;
        const words = v.textContent.replace(/\s+/g, ' ').trim(); if (!words) continue;
        const line = parseFloat(getComputedStyle(v).lineHeight) || 24;
        // A value of one short word or number takes one line; more than that is a value broken inside itself.
        const r = v.getBoundingClientRect();
        if (r.width < 24) { bad.push(`${name}: “${words}” has ${Math.round(r.width)}px, no room to show`); continue; }
        if (!/\s/.test(words) && words.length <= 24 && r.height > line * 1.6) bad.push(`${name}: “${words}” down ${Math.round(r.height / line)} lines`);
        for (const el of v.querySelectorAll('a, span')) if (el.getBoundingClientRect().right > W + 1 && el.textContent.trim()) { bad.push(`${name}: “${el.textContent.trim().slice(0, 20)}” past the window's edge`); break; }
      }
      return { side: Math.round(document.querySelector('#right-sidebar').getBoundingClientRect().width), page: Math.round(document.querySelector('#main-content-container .ls-page-properties')?.getBoundingClientRect().width || 0), n: pairs.length, bad: [...new Set(bad)].slice(0, 4) };
    }, where);
    const got = await look('side');
    if (got.none) return { ok: false, said: got.none };
    if (got.side > 340) return { ok: false, said: `the sidebar is ${got.side}px wide here, not the narrow place this case is about` };
    if (got.bad.length) return { ok: false, said: `in a sidebar ${got.side}px wide: ${got.bad.join('; ')}` };
    // The page beside the sidebar, left as little as the owner's is with the left sidebar open.
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(page); await T.sleep(1200);
    const main = await look('main');
    if (main.none) return { ok: false, said: main.none };
    if (main.page > 340) return { ok: false, said: `the page's properties have ${main.page}px here, not the narrow place this case is about` };
    return main.bad.length ? { ok: false, said: `on a page left ${main.page}px: ${main.bad.join('; ')}` } : { ok: true, said: `${got.n} properties in a sidebar ${got.side}px wide and ${main.n} on a page left ${main.page}px, each value whole` };
  },
};
