/* 23 November 2026, the owner: "I built my ontology around 2 two umbrellas, continuant and occurrent. Because I group everything
   under 2, that mean everything in the ontology page is just 2 columns so it is getting uneven". Ontology's page drew one column per
   top-level tag, so a graph with two top-level tags, one far larger than the other, stood as one long column and one short one with
   the rest of the page empty. In a 1280 px window the rows now fill more columns than there are top-level tags, and no column holds
   most of the rows. The owner's window is in Logseq's wide mode, so the case lifts the reading width (Calm's capped max-width, set
   with !important) for the measurement only, to match, and puts it back after. */
module.exports = {
  parts: ['structure'],
  name: 'Ontology\'s page fills its columns evenly when there are only two top-level tags',
  from: '23 Nov: "everything in the ontology page is just 2 columns so it is getting uneven"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    const seen = await page.evaluate(async () => {
      const box = document.querySelector('#main-content-container .st-regions'); if (!box) return null;
      // Wide, as the owner has it: lift every cap between the page and the regions, then let the plugin redraw for the new width.
      const kept = [];
      for (let e = box.parentElement; e && e.id !== 'main-content-container'; e = e.parentElement) {
        if (getComputedStyle(e).maxWidth === 'none' && !e.classList.contains('cp__sidebar-main-content')) continue;
        kept.push([e, e.style.getPropertyValue('max-width'), e.style.getPropertyPriority('max-width')]);
        e.style.setProperty('max-width', 'none', 'important');
      }
      await new Promise(r => setTimeout(r, 800));
      const tops = box.querySelectorAll(':scope > .st-area').length, cols = new Map();
      for (const r of box.querySelectorAll('[data-row]')) { const x = Math.round(r.getBoundingClientRect().left / 4); cols.set(x, (cols.get(x) || 0) + 1); }
      const n = [...cols.values()], all = n.reduce((s, x) => s + x, 0), width = box.clientWidth;
      for (const [e, v, p] of kept) v ? e.style.setProperty('max-width', v, p) : e.style.removeProperty('max-width');
      return { tops, columns: n.length, tallest: Math.max(...n), all, width };
    });
    await box.cdp.send('Emulation.clearDeviceMetricsOverride');
    if (!seen) return { ok: false, said: 'no Ontology page' };
    const said = `${seen.tops} top-level tags in ${seen.columns} columns, the tallest ${seen.tallest} of ${seen.all} rows, the page ${seen.width} px wide`;
    return { ok: seen.columns > seen.tops && seen.tallest <= seen.all * 0.6, said };
  },
};
