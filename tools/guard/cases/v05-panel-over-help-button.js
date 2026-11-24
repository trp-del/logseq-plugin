/* The review of 24 November 2026, at the owner's window (700 x 560): the small Find under a line in the middle of the page reaches
   the window's lower right corner, where Logseq keeps its round help button. The button stood on top of the panel, on the foot's
   keys, and read as one of them ("dig → ?"). The panel stands over the button, as the Find window does. */
module.exports = {
  parts: ['find', 'shared'],
  name: '0.5: the small Find stands over Logseq\'s help button where the two meet, so the button is not read as one of the foot\'s keys',
  from: '24 Nov: the review, Logseq\'s “?” on the small Find\'s foot',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDHELPCORNER")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    await clean();
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    await T.go(page, 'Amex Gold'); await T.sleep(1200);
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Amex Gold'); const b = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDHELPCORNER paid the card at the bank on the corner, a line long enough to take the page\'s width'); for (let i = 1; i <= 10; i++) await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDHELPCORNER after ' + i); return b.uuid; });
    await T.sleep(900);
    // The bullet about 230 px from the window's top, so the panel opens under it and reaches the window's foot.
    const at = await page.evaluate(u => { const b = document.querySelector(`#main-content-container .ls-block[blockid="${u}"] .block-content`); if (!b) return null; const sc = document.querySelector('#main-content-container'); sc.scrollTop += b.getBoundingClientRect().top - 230; const r = b.getBoundingClientRect(); return [r.left + 30, r.top + Math.min(r.height / 2, 12)]; }, uuid);
    if (!at) return done({ ok: false, said: 'the new bullet did not show on the page' });
    await T.sleep(500); await page.mouse.click(at[0], at[1]); await T.sleep(700);
    await page.evaluate(() => { const t = document.activeElement; if (t && t.tagName === 'TEXTAREA') t.setSelectionRange(t.value.length, t.value.length); });
    if (!(await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'))) return done({ ok: false, said: 'the bullet could not be put in writing' });
    await f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().activeElement }); }); await T.sleep(1800);
    const got = await page.evaluate(() => {
      const d = document.querySelector('dialog[open].fd.fd-panel'); if (!d) return { none: 'the small Find did not open' };
      const help = document.querySelector('.cp__sidebar-help-btn'); if (!help || !help.getBoundingClientRect().width) return { none: 'Logseq shows no help button here' };
      const p = d.getBoundingClientRect(), h = help.getBoundingClientRect(), x = h.left + h.width / 2, y = h.top + h.height / 2;
      if (!(x > p.left && x < p.right && y > p.top && y < p.bottom)) return { apart: `the panel (${Math.round(p.left)}–${Math.round(p.right)} by ${Math.round(p.top)}–${Math.round(p.bottom)}) does not reach the help button at ${Math.round(x)}, ${Math.round(y)}` };
      const top = document.elementFromPoint(x, y);
      return { over: !!top?.closest?.('.fd-panel'), top: (top?.className || top?.tagName || '').toString().slice(0, 40) };
    });
    if (got.none) return done({ ok: false, said: got.none });
    if (got.apart) return done({ ok: false, said: got.apart + ', not the place this case is about' });
    if (!got.over) return done({ ok: false, said: `Logseq's help button stands on top of the small Find (${got.top})` });
    return done({ ok: true, said: 'where they meet, the small Find stands over Logseq\'s help button' });
  },
};
