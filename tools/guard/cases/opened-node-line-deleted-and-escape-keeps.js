/* Found by hand on the owner's screen on 20 November 2026, in 0.4.8, and again by hand on 0.4.10 the same day, in Find and in
   Relations on a page: in a node opened in place, a line whose words were all deleted came back after Escape ("deleting a line isn't
   saved, the words come back on Escape, and an empty line can't be removed"), and words changed and left with Escape were put back
   as they had been. A line emptied is deleted; what is typed is kept however it is left; Backspace in an empty line goes up into the
   line above, as in Logseq. Tried in Find, where an opened node always draws Relations' own bullets (since 0.4.9 a page may hand
   them to Logseq's editor). */
module.exports = {
  parts: ['find', 'threads', 'shared'],
  name: 'In a node opened in Find a line emptied is deleted, Escape keeps what was typed, Backspace in an empty line goes up',
  from: '20 Nov: the hand tests of 0.4.8 and 0.4.10',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const has = text => f.evaluate(async text => (await logseq.DB.datascriptQuery(`[:find ?t :where [?b :block/title ?t] [(clojure.string/includes? ?t "${text}")]]`)).flat(), text);
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDLINE")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    await clean();
    await f.evaluate(async () => { const p = await logseq.Editor.getPage('Dr. Mei Chen'); await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDLINE to change'); await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDLINE to delete'); });
    await T.go(page, 'Northgate Cancer Center'); await T.sleep(1200);
    await page.keyboard.press('Meta+k'); await T.sleep(900);
    await page.keyboard.type('Dr. Mei Chen', { delay: 40 }); await T.sleep(900);
    await page.keyboard.press('ArrowRight'); await T.sleep(3000);
    const spot = text => page.evaluate(text => { const el = [...document.querySelectorAll('dialog[open] [data-edit-bullet]')].find(e => e.textContent.includes(text)); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.right - 6, y: r.top + r.height / 2 }; }, text);
    const press = async text => {
      if (!(await spot(text))) return false;
      await T.sleep(300);
      const at = await spot(text);
      await page.mouse.click(at.x, at.y); await T.sleep(700);
      return page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA');
    };
    if (!(await press('GUARDLINE to change'))) return done({ ok: false, said: 'a line of the node opened in Find could not be written in' });
    await page.keyboard.press('End'); await page.keyboard.type(' and kept', { delay: 20 }); await page.keyboard.press('Escape'); await T.sleep(1500);
    if (!(await has('GUARDLINE to change and kept')).length) return done({ ok: false, said: 'words typed in a line and left with Escape were not kept' });
    if (!(await press('GUARDLINE to delete'))) return done({ ok: false, said: 'the second line could not be written in' });
    await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace'); await T.sleep(300); await page.keyboard.press('Escape'); await T.sleep(1800);
    const still = await has('GUARDLINE to delete');
    const shown = await page.evaluate(() => [...document.querySelectorAll('dialog[open] [data-edit-bullet]')].some(e => e.textContent.includes('GUARDLINE to delete')));
    if (still.length || shown) return done({ ok: false, said: 'a line whose words were all deleted came back after Escape' });
    // Enter at the end of a line starts an empty one under it; Backspace there takes it away and goes back up, as in Logseq.
    if (!(await press('GUARDLINE to change and kept'))) return done({ ok: false, said: 'the kept line could not be written in again' });
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await T.sleep(1500);
    await page.keyboard.press('Backspace'); await T.sleep(1500);
    const up = await page.evaluate(() => { const a = document.activeElement; return a?.tagName === 'TEXTAREA' ? a.value : null; });
    if (up == null || !up.includes('GUARDLINE to change and kept')) return done({ ok: false, said: 'Backspace in the empty line did not go up into the line above' });
    return done({ ok: true, said: `Escape kept the typed words, the emptied line was deleted, and Backspace went up into “${up.slice(0, 30)}”` });
  },
};
