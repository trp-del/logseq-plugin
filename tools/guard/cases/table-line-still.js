/* 19 November 2026, found while fixing the columns that slid on Consultation (table-columns-still.js): with Doctor open in the right
   sidebar, every change in the graph (a key typed on any page) emptied the line under its table's bar for a frame, the line stood
   6 px shorter, and the table under it went up and back down. The owner: motion must be smooth, no flashes or jumps. */
module.exports = {
  parts: ['look'],
  name: 'A table’s line under its bar holds still when the graph changes (Doctor in the right sidebar)',
  from: '19 Nov: the table in the sidebar jumping 6 px up and down while you type',
  graph: 'Illness Test Graph',
  async check(box, T) {
    await T.go(box.page, 'Dr. Mei Chen'); await T.sleep(1000);
    await T.inSidebar(box, 'Doctor'); await T.sleep(2500);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const got = box.page.evaluate(() => new Promise(res => {
        const t0 = performance.now(), seen = new Map(), moved = [];
        const tick = () => {
          for (const el of document.querySelectorAll('#right-sidebar .lk-tstate, #right-sidebar .ls-table')) {
            const r = el.getBoundingClientRect(), k = el.className.includes('lk-tstate') ? 'the line' : 'the table', v = `${Math.round(r.top)}/${Math.round(r.height)}`;
            if (seen.has(el) && seen.get(el) !== v) moved.push(`${k} ${seen.get(el)}→${v} px (top/height)`);
            seen.set(el, v);
          }
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(moved);
        };
        requestAnimationFrame(tick);
      }));
      // A change in the graph: a page made and taken away again.
      const name = `ZZ guard line ${Date.now()}`;
      await box.page.evaluate(n => window.logseq.api.create_page(n, {}, { redirect: false }), name);
      await T.sleep(400);
      await box.page.evaluate(n => window.logseq.api.delete_page(n), name);
      const moved = await got;
      if (moved.length) out.push(moved.slice(0, 3).join(', '));
    }
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'the line and the table stay where they are' };
  },
};
