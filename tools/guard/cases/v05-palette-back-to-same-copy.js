/* The Option-K hand test of 24 November 2026: the same page on the left and in the right sidebar, the caret in the sidebar's copy of a
   bullet. The command "Find: link from here" from Logseq's command list opened the small Find at the left copy of the bullet, and
   Escape left the caret there. The command goes back to the very copy that was being written, at its caret, and Escape puts the
   caret back in that copy. */
module.exports = {
  parts: ['find', 'shared'],
  name: '0.5: the palette command opens the small Find on the copy of the bullet being written, and Escape returns there',
  from: '24 Nov: Option-K hand test, the palette command went to the left copy',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDSAMECOPY")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const st = () => page.evaluate(() => { const d = document.querySelector('dialog[open].fd'); const a = document.activeElement; const t = document.querySelector('.ls-block textarea');
      return { panel: !!d && d.classList.contains('fd-panel'), editing: !!t, val: t?.value ?? null, pos: t?.selectionStart ?? null, focus: a?.tagName, side: !!t?.closest('#right-sidebar, .cp__right-sidebar'), block: t?.closest('.ls-block')?.getAttribute('blockid') || null }; });
    await clean();
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    const WORDS = 'GUARDSAMECOPY paid the gas bill';
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, WORDS);
    await T.sleep(700);
    // The same page in the sidebar: the bullet drawn twice.
    await T.inSidebar(box, 'Chase Checking'); await T.sleep(1500);
    const copies = await page.evaluate(u => document.querySelectorAll(`.ls-block[blockid="${u}"]`).length, uuid);
    if (copies < 2) return no('the bullet was not drawn both on the left and in the sidebar');
    const SIDE_BULLET = `#right-sidebar .ls-block[blockid="${uuid}"] .block-content, .cp__right-sidebar .ls-block[blockid="${uuid}"] .block-content`;
    await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), SIDE_BULLET);
    let s;
    for (let tries = 0; tries < 2; tries++) {
      await T.sleep(500);
      const at = await page.evaluate(sel => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + 30, r.top + Math.min(r.height / 2, 12)]; }, SIDE_BULLET);
      if (!at) return no('the bullet did not show in the right sidebar');
      await page.mouse.click(at[0], at[1]); await T.sleep(700);
      s = await st(); if (s.editing && s.side) break;
    }
    await page.keyboard.press('End'); await T.sleep(150);
    await page.keyboard.press('ArrowLeft'); await T.sleep(200);   // the caret one letter before the end, by the hand
    s = await st();
    if (!s.editing || !s.side || s.block !== uuid) return no('the sidebar copy of the bullet could not be put in writing');
    const pos = s.pos;
    await page.keyboard.press('Meta+Shift+p'); await T.sleep(900);
    await page.keyboard.type('Find: link from here', { delay: 30 }); await T.sleep(1200);
    await page.keyboard.press('Enter'); await T.sleep(2400); s = await st();
    if (!s.panel) return no('the command “Find: link from here” did not open the small Find');
    if (s.block !== uuid) return no('the command opened the small Find on another bullet');
    if (!s.side) return no('the command opened the small Find at the left copy of the bullet, not the sidebar’s copy being written');
    if (s.val !== WORDS) return no(`the bullet changed when the command ran (it reads “${s.val}”)`);
    await page.keyboard.press('Escape'); await T.sleep(900); s = await st();
    if (s.panel || !s.editing || s.focus !== 'TEXTAREA') return no('Escape did not put the caret back in the bullet');
    if (!s.side) return no('after Escape the caret is in the left copy of the bullet, not the sidebar’s');
    if (s.pos !== pos) return no(`after Escape the caret is at ${s.pos}, not at ${pos} where the hand left it`);
    return done({ ok: true, said: `the command opened the small Find on the sidebar’s copy, and Escape put the caret back there at ${pos}` });
  },
};
