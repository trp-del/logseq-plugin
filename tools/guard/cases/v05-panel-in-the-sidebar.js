/* 0.5, A6 (the panel in every state; found by script on 23 November 2026, the owner's window of 700 px): a bullet in the right sidebar
   starts near the window's right edge, and the panel opened under it ran past the edge, its rows and foot cut. The panel stays inside
   the window wherever its bullet stands. */
module.exports = {
  parts: ['find', 'shared'],
  name: '0.5: the panel under a bullet in the right sidebar stays inside the window at 700 px',
  from: '23 Nov: 0.5 leftovers, A6, the panel in the sidebar',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDSIDEPANEL")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    await clean();
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    await T.go(page, 'Amex Gold'); await T.sleep(1200);
    await T.inSidebar(box, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDSIDEPANEL paid from')).uuid; });
    await T.sleep(900);
    // The bullet put in writing where it stands in the sidebar, as a click there does.
    const at = await page.evaluate(u => { const b = document.querySelector(`.cp__right-sidebar .ls-block[blockid="${u}"] .block-content`); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + 4, r.top + r.height / 2]; }, uuid);
    if (!at) return done({ ok: false, said: 'the new bullet did not show in the right sidebar' });
    await page.mouse.click(at[0], at[1]); await T.sleep(600);
    await page.keyboard.press('End');
    const inSide = await page.evaluate(() => !!document.activeElement?.closest?.('.cp__right-sidebar') && document.activeElement.tagName === 'TEXTAREA');
    if (!inSide) return done({ ok: false, said: 'the sidebar bullet could not be put in writing' });
    await f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().activeElement }); }); await T.sleep(1500);
    await page.keyboard.type('chase', { delay: 60 }); await T.sleep(1500);
    const s = await page.evaluate(() => { const d = document.querySelector('dialog[open].fd.fd-panel'); if (!d) return null; const r = d.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), W: innerWidth, foot: d.querySelector('.fd-foot')?.getBoundingClientRect().right }; });
    if (!s) return done({ ok: false, said: 'the panel did not open under the sidebar bullet' });
    if (s.left < 0 || s.right > s.W) return done({ ok: false, said: `the panel runs past the window (from ${s.left} to ${s.right} in ${s.W})` });
    return done({ ok: true, said: `the panel stands inside the window (from ${s.left} to ${s.right} in ${s.W})` });
  },
};
