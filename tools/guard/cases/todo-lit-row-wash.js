/* The review of 24 November 2026: in Todo the task the arrow keys were on, and the task a right-click menu closed with Escape gave
   the keys back to, stood in the browser's orange box, one box round each line of a name that wrapped. A Relations row lit by the
   same keys (the library's list keys) shows the wash and no box. One look for one thing: Todo's lit task shows the wash too. */
module.exports = {
  parts: ['todo', 'shared'],
  name: 'Todo: the task the arrow keys are on shows the wash, as a Relations row does, not the browser\'s box',
  from: '24 Nov: the review, an orange box round a task after its menu closed',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const field = await page.$('#main-content-container .td-find input');
    if (!field) return { ok: false, said: 'no find line on Todo' };
    await field.click(); await page.keyboard.press('ArrowDown'); await T.sleep(300);
    const lit = await page.evaluate(() => { const a = document.activeElement; if (!a?.classList?.contains('td-words')) return null; const cs = getComputedStyle(a); return { outline: cs.outlineStyle, width: cs.outlineWidth, back: cs.backgroundColor }; });
    await page.keyboard.press('ArrowUp'); await T.sleep(150); await page.keyboard.press('Escape');
    if (!lit) return { ok: false, said: 'Down from the find line did not reach a task' };
    const clear = /rgba\(0, 0, 0, 0\)|transparent/.test(lit.back);
    if (lit.outline !== 'none') return { ok: false, said: `the lit task carries the browser's box (outline ${lit.outline} ${lit.width})` };
    if (clear) return { ok: false, said: 'the lit task shows no wash, so nothing says which task the keys are on' };
    return { ok: true, said: 'the lit task shows the wash and no box' };
  },
};
