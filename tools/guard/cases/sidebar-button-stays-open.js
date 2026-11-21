/* Seen on 0.4.7, 0.4.8 and by hand on 0.4.10 (20 November 2026): on a page with nothing for the sidebar to show (Mortgage, a journal
   day), the sidebar button opened an empty sidebar and the plugin shut it again a moment later, a flash. The owner, asked what the
   button should do there: "Open and stay open". */
module.exports = {
  parts: ['shared'],
  name: 'The sidebar button opens the sidebar and it stays open, on a page with nothing for it to show',
  from: '20 Nov: “Open and stay open”',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const open = () => page.evaluate(() => { const s = document.getElementById('right-sidebar'); return !!s && !s.classList.contains('closed') && s.getBoundingClientRect().width > 40; });
    const press = async () => { const at = await page.evaluate(() => { const b = document.querySelector('#head .toggle-right-sidebar'); const r = b?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }); if (at) await page.mouse.click(at.x, at.y); return !!at; };
    if (await open()) { await press(); await T.sleep(800); }
    await T.go(page, 'Mortgage'); await T.still(page); await T.sleep(800);
    if (!(await press())) return { ok: false, said: 'no sidebar button in the toolbar' };
    await T.sleep(400);
    const soon = await open();
    await T.sleep(1600);
    const later = await open();
    if (later) { await press(); await T.sleep(800); }
    await page.evaluate(() => document.activeElement?.blur?.());   // the button let go, so no ring is left on it for the next screen
    if (!soon) return { ok: false, said: 'the press did not open the sidebar' };
    if (!later) return { ok: false, said: 'the sidebar opened and closed again by itself (a flash)' };
    return { ok: true, said: 'opened and still open two seconds later' };
  },
};
