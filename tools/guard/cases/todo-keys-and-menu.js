/* The thirteen proposals, 12, 3 and 6 (the owner's go, 19 November 2026: "good I like all"). 12, the same keys on every list: Todo
   walked by Tab only; now Down from the find line goes to the first task and Down and Up walk the tasks, as in Find and Relations.
   3, one menu for grouping and sorting: Todo's menu reads Group by, Then by, Sort by, Timeline, as a Relations list's menu reads
   Group by, Sort by, Timeline. 6, Todo grouped by what a task belongs to: Group by Parent puts each task under the node it is
   written under. */
module.exports = {
  parts: ['todo', 'threads', 'shared'],
  name: 'Todo: Down and Up walk the tasks; its menu has Sort by and Timeline; Group by Parent puts tasks under their node',
  from: '19 Nov: the thirteen proposals, 12, 3 and 6',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const field = await page.$('#main-content-container .td-find input');
    if (!field) return { ok: false, said: 'no find line on Todo' };
    await field.click(); await page.keyboard.press('ArrowDown'); await T.sleep(200); await page.keyboard.press('ArrowDown'); await T.sleep(200);
    const walked = await page.evaluate(() => { const all = [...document.querySelectorAll('#main-content-container .td-row .td-words')]; return { at: all.indexOf(document.activeElement), of: all.length }; });
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await T.sleep(200);
    const back = await page.evaluate(() => document.activeElement?.closest?.('.td-find') ? 'find line' : document.activeElement?.className || '');
    // The menu's words.
    await page.evaluate(() => document.querySelector('#main-content-container [data-by]')?.click()); await T.sleep(600);
    const menu = await page.evaluate(() => [...document.querySelectorAll('.lk-door-menu .lk-group, .lk-door-menu .lk-head, .lk-door-menu [role="presentation"]')].map(e => e.textContent.trim()).filter(Boolean));
    const words = await page.evaluate(() => document.querySelector('.lk-door-menu')?.innerText || '');
    // Group by Parent.
    const parent = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => e.textContent.trim() === 'Parent') || null);
    if (parent.asElement()) { await parent.asElement().click(); await T.sleep(900); }
    const heads = await page.evaluate(() => document.querySelectorAll('#main-content-container .td-head .td-head-node').length);
    // Back to Day for the cases after this one.
    await page.evaluate(() => document.querySelector('#main-content-container [data-by]')?.click()); await T.sleep(500);
    const day = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => e.textContent.trim() === 'Day') || null);
    if (day.asElement()) { await day.asElement().click(); await T.sleep(600); }
    await page.keyboard.press('Escape');
    if (walked.at !== 1) return { ok: false, said: `Down twice from the find line landed on task ${walked.at + 1} of ${walked.of}` };
    if (back !== 'find line') return { ok: false, said: 'Up twice did not come back to the find line' };
    for (const w of ['Group by', 'Sort by', 'Timeline']) if (!words.includes(w)) return { ok: false, said: `Todo's menu has no “${w}” (${menu.join(', ')})` };
    if (!parent.asElement()) return { ok: false, said: 'no Parent under Group by' };
    if (!heads) return { ok: false, said: 'grouped by Parent, no heading names a node' };
    return { ok: true, said: `Down and Up walk the tasks; the menu has Group by, Sort by, Timeline; by Parent, ${heads} node headings` };
  },
};
