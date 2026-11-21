/* The thirteen proposals, 2 (the owner's go, 19 November 2026: "good I like all"): "Find's lines of choices on any long list". A
   Relations list offered "Often" and nothing to narrow by; now the library's choice line stands over a long list, as over Find's
   rows: a property's small name over its values and their counts, and a press narrows the list to the nodes holding the value. */
module.exports = {
  parts: ['threads', 'find', 'shared'],
  name: 'A long Relations list has Find\'s line of choices: a value pressed narrows the list to its count',
  from: '19 Nov: the thirteen proposals, 2',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2500);
    const first = await page.evaluate(() => {
      const line = document.querySelector('#main-content-container .th-two-way .th-tw-choices');
      const v = line?.querySelector('.lk-cv .lk-view');
      if (!v) return null;
      v.scrollIntoView({ block: 'center' });
      return { label: v.childNodes[0].textContent, count: Number(v.querySelector('.lk-nb')?.textContent), often: !!document.querySelector('#main-content-container .th-tw-keeps') };
    });
    if (!first) return { ok: false, said: 'no line of choices over Chase Checking\'s long list' };
    if (first.often) return { ok: false, said: 'the old "Often" line still stands beside it' };
    await T.sleep(400);
    const at = await page.evaluate(() => { const r = document.querySelector('#main-content-container .th-tw-choices .lk-cv .lk-view').getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }; });
    await page.mouse.click(at.x, at.y); await T.sleep(1200);
    const after = await page.evaluate(() => { const box = document.querySelector('#main-content-container .th-tw-choices')?.closest('.th-tw-row, .th-tw-group, [data-field]'); return { rows: box ? box.querySelectorAll('.th-tw-line[data-uuid]').length : -1, lit: !!document.querySelector('#main-content-container .th-tw-choices .lk-lit') }; });
    // Pressed again: the whole list back.
    const again = await page.evaluate(() => { const r = document.querySelector('#main-content-container .th-tw-choices .lk-lit')?.getBoundingClientRect(); return r ? { x: r.x + 8, y: r.y + r.height / 2 } : null; });
    if (again) { await page.mouse.click(again.x, again.y); await T.sleep(800); }
    if (!after.lit) return { ok: false, said: `pressing “${first.label}” lit nothing` };
    if (after.rows !== first.count) return { ok: false, said: `“${first.label} ${first.count}” pressed left ${after.rows} rows` };
    return { ok: true, said: `“${first.label} ${first.count}” pressed left ${after.rows} rows` };
  },
};
