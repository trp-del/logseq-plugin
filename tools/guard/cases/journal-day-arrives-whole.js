/* The thirteen proposals, 13 (the owner's go, 19 November 2026: "good I like all"): "A screen arrives once, whole". A journal day with
   nothing pointing at it held an empty Relations section in Logseq's page grid for two seconds, with the grid's 32px gap, then let it
   go: the day's own lists (DOING, Scheduled and Deadline) jumped up. They stand where they stay from the first frame. */
module.exports = {
  parts: ['threads', 'shared'],
  name: 'A journal day arrives once: its lists do not move after it opens',
  from: '19 Nov: the thirteen proposals, 13',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Chase Checking'); await T.sleep(1200);
    // Today's journal day (made by Logseq's own journal call when the copy has none yet; Logseq draws its DOING and Scheduled lists
    // on today's day only), with nothing pointing at it.
    const day = await box.frame().evaluate(async () => { const D = window.PluginDoor.dates; await D.page(D.today()); const p = await logseq.Editor.getPage(D.title(new Date(), await D.format())); return p?.title || p?.originalName || ''; });
    if (!day) return { ok: false, said: 'today\'s journal day could not be made on the guard\'s copy' };
    await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), day);
    const at = () => page.evaluate(() => { const q = document.querySelector('#main-content-container .custom-query, #main-content-container .ls-page-blocks'); return q ? Math.round(q.getBoundingClientRect().top) : null; });
    // Watched every tenth of a second for three seconds from the moment the day itself first shows (its title on screen).
    for (let i = 0; i < 40 && !(await page.evaluate(d => (document.querySelector('#main-content-container .page-title, #main-content-container h1.title')?.textContent || '').trim() === d, day)); i++) await T.sleep(25);
    const seen = [];
    for (let i = 0; i < 32; i++) { const y = await at(); if (y != null) seen.push(y); await T.sleep(100); }
    if (!seen.length) return { ok: false, said: `the journal day ${day} drew nothing to measure` };
    const moved = Math.max(...seen) - Math.min(...seen);
    if (moved > 1) return { ok: false, said: `the day's lists moved ${moved}px after it opened (from ${seen[0]} to ${seen[seen.length - 1]})` };
    return { ok: true, said: `${day}: nothing moved after it opened` };
  },
};
