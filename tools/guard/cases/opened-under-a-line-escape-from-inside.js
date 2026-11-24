/* Found by hand, 24 November 2026, on the node opened under a line (Option-L, picture 1A): after a press inside the opened node (on a
   property's row, on a value), Escape did not close it: three Escapes only selected the bullet, let it go, and the node stayed.
   Escape closes the opened node from inside it too, after first leaving any editing inside, as Logseq lets go one step at a time. */
module.exports = {
  parts: ['find', 'threads', 'look', 'shared'],
  name: 'A node opened under a line closes with Escape after a press inside it: one Escape after a press on its ground, two after editing a value',
  from: '24 Nov, hand test: "Three Escapes only select the bullet, deselect it, and the node stays"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDESCAPE")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const isOpen = () => page.evaluate(() => !!document.querySelector('[data-lk-under]'));
    const openIt = async () => {
      const words = 'GUARDESCAPE paid [[Amex Gold]] today';
      const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, words);
      await T.sleep(700);
      await page.evaluate(([u, at]) => { window.logseq.api.edit_block(u, { pos: at }); return 1; }, [uuid, words.indexOf(']]') + 2]); await T.sleep(900);
      await page.keyboard.press('Alt+KeyL'); await T.sleep(2500);
      return isOpen();
    };
    const center = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    if (!await openIt()) return no('the node did not open under the line');
    // A press on a property's row, beside its value, where nothing is to be pressed.
    await page.evaluate(() => { const h = document.querySelector('[data-lk-under]'), m = document.getElementById('main-content-container'); m.scrollTop += h.getBoundingClientRect().top - m.getBoundingClientRect().top - 60; }); await T.sleep(600);
    // A press inside the ground where nothing is to be pressed: its top line, between the node's place and the ×.
    const free = () => page.evaluate(() => { const l = document.querySelector('[data-lk-under] > .lk-ground-top'); if (!l) return null; const r = l.getBoundingClientRect(), y = r.top + r.height / 2;
      for (let x = r.right - 6; x > r.left + r.width / 2; x -= 8) { const e = document.elementFromPoint(x, y); if (e && l.contains(e) && !e.closest('button, a, input, [data-edit], .lk-value, .lk-path')) return [x, y]; } return null; });
    let row = await free();
    if (row) { await page.mouse.move(row[0], row[1]); await T.sleep(300); row = await free(); }
    if (!row) return no('the opened node has no free place on its top line to press');
    await page.mouse.click(row[0], row[1]); await T.sleep(500);
    if (!await isOpen()) return no('a press inside the opened node closed it');
    await page.keyboard.press('Escape'); await T.sleep(1200);
    if (await isOpen()) return no('after a press inside the opened node (on its top line), Escape did not close it');
    // Again, now editing a value inside: the first Escape leaves the value, the second closes the node.
    await clean(); await T.sleep(500);
    if (!await openIt()) return no('the node did not open under the line a second time');
    await page.evaluate(() => { const h = document.querySelector('[data-lk-under]'), m = document.getElementById('main-content-container'); m.scrollTop += h.getBoundingClientRect().top - m.getBoundingClientRect().top - 60; }); await T.sleep(600);
    const v = await center('[data-lk-under] .th-tw-npvalue, [data-lk-under] .lk-value');
    if (!v) return no('the opened node shows no value to edit');
    await page.mouse.click(v[0], v[1]); await T.sleep(800);
    // Editing: the value's box in place, or Logseq's list for picking a value, which hangs under it.
    const editing = await page.evaluate(() => { const a = document.activeElement; return !!a && (/INPUT|TEXTAREA/.test(a.tagName) || a.isContentEditable) && !a.closest('.ls-block > .block-main-container'); });
    await page.keyboard.press('Escape'); await T.sleep(800);
    if (editing && !await isOpen()) return no('the first Escape while editing a value closed the node instead of leaving the value');
    if (editing) { await page.keyboard.press('Escape'); await T.sleep(1200); }
    if (await isOpen()) return no(`after editing a value inside the opened node, Escape did not close it (${editing ? 'two Escapes' : 'one Escape'})`);
    return done({ ok: true, said: `after a press on its ground one Escape closed the node; after editing a value ${editing ? 'the first Escape left the value and the second closed the node' : 'one Escape closed the node'}` });
  },
};
