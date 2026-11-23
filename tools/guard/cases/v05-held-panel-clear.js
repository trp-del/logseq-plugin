/* 0.5, D (found by script on 23 November 2026, in the owner's window of 700 px): with three bullets held low in the window, the panel
   stood above the last of them, over the two held above it, and Logseq's selection bar stood over the panel's foot, the words of what
   Enter does. The panel takes the span of the held bullets (under the last or above the first), Logseq's selection bar steps back while
   the panel is open, and comes back when the panel closes with the bullets still held. */
module.exports = {
  parts: ['find', 'predictive', 'shared'],
  name: '0.5: the panel over held bullets covers none of them, and Logseq’s selection bar does not cover the panel',
  from: '23 Nov: 0.5 leftovers, the selection bar over the panel',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDHELD")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    await clean();
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    await T.go(page, 'Chase Checking'); await T.sleep(1200);
    const ids = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Chase Checking'); const out = []; for (const t of ['GUARDHELD lunch', 'GUARDHELD coffee', 'GUARDHELD taxi']) out.push((await logseq.Editor.appendBlockInPage(p.uuid, t)).uuid); return out; });
    await T.sleep(900);
    await page.evaluate(u => window.logseq.api.edit_block(u), ids[2]); await T.sleep(600);
    // Low in the window, as the owner's last lines of a page are.
    await page.evaluate(u => { const b = document.querySelector(`.ls-block[blockid="${u}"]`); const s = document.querySelector('#main-content-container'); if (b && s) s.scrollTop += b.getBoundingClientRect().bottom - (innerHeight - 30); }, ids[2]); await T.sleep(500);
    await page.keyboard.press('Escape'); await T.sleep(400);
    await page.keyboard.press('Shift+ArrowUp'); await T.sleep(250); await page.keyboard.press('Shift+ArrowUp'); await T.sleep(600);
    const held = await page.evaluate(() => document.querySelectorAll('.ls-block.selected').length);
    if (held !== 3) return done({ ok: false, said: `three bullets could not be held (${held})` });
    await f.evaluate(() => window.PluginDoor.ask('find:held')); await T.sleep(1500);
    const s = await page.evaluate(ids => {
      const d = document.querySelector('dialog[open].fd.fd-panel'); if (!d) return null;
      const r = d.getBoundingClientRect(), over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const covered = ids.filter(u => { const b = document.querySelector(`.ls-block[blockid="${u}"] > .block-main-container`); return b && over(r, b.getBoundingClientRect()); }).length;
      const bar = [...document.querySelectorAll('.selection-action-bar')].find(e => { const b = e.getBoundingClientRect(); return b.width > 10 && getComputedStyle(e).visibility !== 'hidden'; });
      const foot = d.querySelector('.fd-foot')?.getBoundingClientRect();
      return { covered, barOver: !!(bar && foot && over(bar.getBoundingClientRect(), foot)), barShown: !!bar };
    }, ids);
    if (!s) return done({ ok: false, said: 'the panel did not open over the held bullets' });
    if (s.covered) return done({ ok: false, said: `the panel stands over ${s.covered} of the held bullets` });
    if (s.barOver) return done({ ok: false, said: 'Logseq’s selection bar stands over the panel’s foot' });
    await page.keyboard.press('Escape'); await T.sleep(700);
    const after = await page.evaluate(() => ({ panel: !!document.querySelector('dialog[open].fd'), held: document.querySelectorAll('.ls-block.selected').length, bar: [...document.querySelectorAll('.selection-action-bar')].some(e => e.getBoundingClientRect().width > 10 && getComputedStyle(e).visibility !== 'hidden') }));
    if (after.panel || after.held !== 3) return done({ ok: false, said: `Escape did not leave the three bullets held (panel ${after.panel}, held ${after.held})` });
    if (!after.bar) return done({ ok: false, said: 'Logseq’s selection bar did not come back when the panel closed' });
    return done({ ok: true, said: 'the panel stands clear of the held bullets, the selection bar steps back while it is open and comes back after' });
  },
};
