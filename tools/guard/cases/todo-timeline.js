/* The thirteen proposals, 5 (the owner's go, 19 November 2026: "good I like all"): "The timeline over Todo". Find and Relations drew
   the library's timeline; Todo, whose whole order is days, had none. Under Todo's find line now: a dot a task with a day, the late
   ones red; a press on a dot narrows the list to its week, and Escape gives the whole list back. */
module.exports = {
  parts: ['todo', 'shared'],
  name: 'Todo has the timeline: a dot pressed narrows the list to its week, Escape gives it all back',
  from: '19 Nov: the thirteen proposals, 5',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const count = () => page.evaluate(() => document.querySelectorAll('#main-content-container .td-list .td-row').length);
    const all = await count();
    const dot = await page.$('#main-content-container .td-time .lk-time-dot');
    if (!dot) return { ok: false, said: 'no timeline with dots under Todo\'s find line' };
    const late = await page.evaluate(() => document.querySelectorAll('#main-content-container .td-time .lk-time-dot.late').length);
    await dot.click(); await T.sleep(900);
    const narrowed = await count();
    const said = await page.evaluate(() => document.querySelector('#main-content-container .td-showing')?.innerText.trim() || '');
    await page.mouse.click(5, 300); await page.keyboard.press('Escape'); await T.sleep(800);
    const back = await count();
    if (!(narrowed > 0 && narrowed < all)) return { ok: false, said: `a dot pressed left ${narrowed} of ${all} rows` };
    if (!/^Showing/.test(said)) return { ok: false, said: 'nothing says what the list is narrowed to' };
    if (back !== all) return { ok: false, said: `Escape gave back ${back} of ${all} rows` };
    return { ok: true, said: `${late} late dot(s); a dot narrowed ${all} rows to ${narrowed}, Escape gave all back` };
  },
};
