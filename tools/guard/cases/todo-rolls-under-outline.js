/* 18–19 November 2026, the release check's hands-on fault, "Heading and fold (light): sidebar-item 16→32": Todo in the right sidebar
   moved when Outline came above it, as a heading was written on the page. Before 0.3.169 Todo stood 10 px lower at once and Outline
   grew a second time after opening. The owner: motion must be smooth, no flashes or jumps. Outline coming is the grammar's roll, so
   Todo may go down with it, but only as one smooth glide: always the same way, no step much larger than the roll's, and done once. */
module.exports = {
  parts: ['sidebar', 'look', 'todo'],
  name: 'Todo in the right sidebar glides down once, smoothly, when Outline comes above it',
  from: '18–19 Nov: Todo moves when Outline appears in the sidebar',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const name = `ZZ guard outline ${Date.now()}`;
    const api = (fn, ...a) => box.page.evaluate(([fn, a]) => window.logseq.api[fn](...a), [fn, a]);
    await api('create_page', name, {}, { redirect: false });
    const block = await api('append_block_in_page', name, 'Plan for next visit');
    try {
      await T.go(box.page, name); await T.sleep(1200);
      await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('todo')); await T.sleep(2500);
      const got = box.page.evaluate(() => new Promise(res => {
        const t0 = performance.now(), tops = [];
        const todo = () => [...document.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].find(i => /todo/i.test(i.querySelector('.sidebar-item-header')?.innerText || ''));
        const tick = () => {
          const el = todo(); if (el) tops.push([Math.round(performance.now() - t0), Math.round(el.getBoundingClientRect().top * 10) / 10]);
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(tops);
        };
        requestAnimationFrame(tick);
      }));
      await T.sleep(100);
      await api('upsert_block_property', block.uuid, 'logseq.property/heading', 2);
      const tops = await got;
      if (!tops.length) return { ok: false, said: 'no Todo section in the sidebar' };
      const steps = []; for (let i = 1; i < tops.length; i++) { const d = tops[i][1] - tops[i - 1][1]; if (Math.abs(d) > 0.5) steps.push([tops[i][0], d]); }
      const total = tops.at(-1)[1] - tops[0][1];
      if (!steps.length) return { ok: true, said: 'Todo stayed where it was' };
      const said = [];
      if (steps.some(([, d]) => Math.sign(d) !== Math.sign(total))) said.push('Todo went back the other way');
      const big = steps.filter(([, d]) => Math.abs(d) > Math.max(24, Math.abs(total) * 0.25));
      if (big.length) said.push(`a step of ${big.map(([t, d]) => `${Math.round(d)} px at ${t} ms`).join(', ')} out of ${Math.round(total)} px`);
      const span = steps.at(-1)[0] - steps[0][0];
      if (span > 450) said.push(`still moving ${span} ms after it began (moving twice?)`);
      return said.length ? { ok: false, said: said.join('; ') } : { ok: true, said: `one glide of ${Math.round(total)} px over ${span} ms` };
    } finally {
      await api('delete_page', name).catch(() => {});
    }
  },
};
