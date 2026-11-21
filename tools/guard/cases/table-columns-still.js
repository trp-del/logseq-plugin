/* 18–19 November 2026, the release check's motion fault, released past several times and then fixed at the owner's "ok go ahead":
   on Consultation, and on Doctor opened in the right sidebar, the table's columns slid right 20–40 px as the page drew. Logseq draws
   a tag's table in steps (the built-in columns first, the tag's own Provider, Topic and Date a moment later, before Created), so
   whatever stood after them moved. The owner: motion must be smooth, no flashes or jumps. */
const PAGE = 'Consultation', SIDE = 'Doctor';
// Every column's place in the table, each frame the table can be seen, from the moment the page is asked for.
const watch = sel => new Promise(res => {
  const t0 = performance.now(), seen = new Map(), moved = [];
  const tick = () => {
    const t = Math.round(performance.now() - t0);
    // The page before (All pages, a table too, still shown a moment after the route changes) is not counted: only a page's own table.
    for (const table of [...document.querySelectorAll(sel)].filter(t => !t.closest('.ls-all-pages'))) {
      if (!table.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const left = table.getBoundingClientRect().left;
      for (const cell of table.querySelectorAll('.ls-table-header .ls-table-header-cell')) {
        const r = cell.getBoundingClientRect(), name = cell.querySelector('[title]')?.getAttribute('title');
        if (!name || r.width < 1 || !cell.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const x = Math.round(r.left - left), was = seen.get(name);
        if (was !== undefined && Math.abs(was - x) > 2) moved.push(`${name} ${was}→${x} px at ${t} ms`);
        seen.set(name, x);
      }
    }
    if (t < 2500) requestAnimationFrame(tick); else res({ moved, columns: seen.size });
  };
  requestAnimationFrame(tick);
});
module.exports = {
  parts: ['look'],
  name: 'A tag’s table draws its columns in place: Consultation, and Doctor in the right sidebar',
  from: '18–19 Nov: columns slide right 20–40 px as Consultation’s table draws',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      await box.page.evaluate(() => window.logseq.api.push_state('all-pages')); await T.sleep(1200);
      const got = box.page.evaluate(watch, '#main-content-container .ls-table');
      await T.go(box.page, PAGE);
      const r = await got;
      if (!r.columns) out.push(`${PAGE}: no table seen`);
      if (r.moved.length) out.push(`${PAGE}: ${r.moved.slice(0, 3).join(', ')}`);
    }
    for (let i = 0; i < 2; i++) {
      await box.frame().evaluate(() => logseq.App.setRightSidebarVisible(false)); await box.page.evaluate(() => window.logseq.api.clear_right_sidebar_blocks?.());
      await T.sleep(800);
      const got = box.page.evaluate(watch, '#right-sidebar .ls-table');
      await T.inSidebar(box, SIDE);
      const r = await got;
      if (!r.columns) out.push(`${SIDE} in the sidebar: no table seen`);
      if (r.moved.length) out.push(`${SIDE} in the sidebar: ${r.moved.slice(0, 3).join(', ')}`);
    }
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'every column drawn where it stays' };
  },
};
