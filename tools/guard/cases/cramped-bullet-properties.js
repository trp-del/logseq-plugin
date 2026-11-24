/* The review of 24 November 2026, at the owner's window with both sidebars open (the page about 174 px wide): under a bullet its
   properties could not be read. Logseq's Expand button took most of the line, each property kept its full width and was cut at
   the pane's edge, and the properties on later lines had lost their first letters ("Category" read "n"). In the right sidebar a
   task's "Deadline" stood under the same button. Where a bullet's properties have little width, each stands on its own line, its
   name whole from its first letter, and the button gives its room back (every property already shows). */
module.exports = {
  parts: ['look', 'sidebar'],
  name: 'A bullet left little width, on a page beside the open sidebar: each property name whole from its first letter, no Expand button over them',
  from: '24 Nov: the review, properties under a bullet cut to a letter or two on the squeezed page',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const done = verdict => verdict;
    await T.go(page, 'Nov 16th, 2026'); await T.sleep(1500);
    await T.inSidebar(box, 'Amex Gold'); await T.sleep(1500);
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 460, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(page); await T.sleep(1500);
    const got = await page.evaluate(() => {
      const strips = [...document.querySelectorAll('#main-content-container .ls-block .positioned-properties.block-below')].filter(s => s.getBoundingClientRect().width > 0);
      if (!strips.length) return { none: 'no bullet with properties on the page' };
      const bad = []; let narrow = 0;
      for (const s of strips) {
        const sr = s.getBoundingClientRect(); if (sr.width > 240) continue; narrow++;
        // Where the page cuts what runs past it (Logseq's own blocks area).
        const cut = Math.min(sr.right, s.closest('.ls-page-blocks, .sidebar-item')?.getBoundingClientRect().right ?? sr.right);
        const of = (s.closest('.ls-block')?.querySelector('.block-content')?.textContent || '').trim().slice(0, 20);
        const button = [...s.querySelectorAll('button')].find(b => /^(Expand|Collapse)$/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 0);
        if (button) bad.push(`“${of}”: Logseq's ${button.textContent.trim()} button stands in a line ${Math.round(sr.width)}px wide`);
        for (const k of s.querySelectorAll('.bottom-property-pill .property-k')) {
          const r = k.getBoundingClientRect(); if (!r.width) continue;
          if (r.left < sr.left - 1) { bad.push(`“${of}”: “${k.textContent.trim()}” starts ${Math.round(sr.left - r.left)}px before the line, its first letters cut`); break; }
          if (r.right > cut + 1) { bad.push(`“${of}”: “${k.textContent.trim()}” is cut ${Math.round(r.right - cut)}px short at the page's edge`); break; }
          if (r.right > sr.right + 1) { bad.push(`“${of}”: “${k.textContent.trim()}” runs ${Math.round(r.right - sr.right)}px past the line`); break; }
        }
      }
      return { narrow, bad: [...new Set(bad)].slice(0, 4), page: Math.round(document.querySelector('#main-content-container').getBoundingClientRect().width) };
    });
    if (got.none) return done({ ok: false, said: got.none });
    if (!got.narrow) return done({ ok: false, said: `no bullet's properties are under 240px wide here (the page is ${got.page}px), not the cramped place this case is about` });
    if (got.bad.length) return done({ ok: false, said: got.bad.join('; ') });
    return done({ ok: true, said: `${got.narrow} bullets with their properties in under 240px: every name whole, no Expand button` });
  },
};
