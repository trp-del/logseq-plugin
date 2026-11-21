/* The thirteen proposals, 1 (the owner's go, 19 November 2026: "good I like all"): "One find line that understands the same things
   everywhere". Todo's find line read only letters, so "on nov 18" found nothing. Typed into the line, a day leaves the tasks due that
   day, and "when" is pencilled over it as in Find by sentence. */
module.exports = {
  parts: ['todo', 'find', 'shared'],
  name: 'Todo\'s find line reads a day: "on <day>" leaves the tasks due then, with "when" over it',
  from: '19 Nov: the thirteen proposals, 1, one find line',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    // A day some open task is due on, written with its year so the reading does not hang on today.
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const day = await box.frame().evaluate(() => (window.Todo?.app?.tasks || []).filter(t => t.day && t.status !== 'done').map(t => t.day).sort()[0] || 0);
    if (!day) return { ok: false, said: 'no open task with a Deadline day on the guard\'s copy' };
    const M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const words = `on ${M[Math.floor(day / 100) % 100 - 1]} ${day % 100} ${Math.floor(day / 10000)}`;
    const field = await page.$('#main-content-container .td-find input');
    if (!field) return { ok: false, said: 'no find line on Todo' };
    await field.click(); await page.keyboard.type(words, { delay: 30 }); await T.sleep(1200);
    const seen = await page.evaluate(() => ({ rows: document.querySelectorAll('#main-content-container .td-list .td-row').length, notes: [...document.querySelectorAll('#main-content-container .td-find .lk-say-note')].map(n => n.textContent) }));
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await T.sleep(300);
    if (!seen.rows) return { ok: false, said: `“${words}” left no task, though a task is due that day` };
    if (!seen.notes.includes('when')) return { ok: false, said: `“${words}” is not pencilled as a time (notes: ${seen.notes.join(', ') || 'none'})` };
    return { ok: true, said: `“${words}” leaves ${seen.rows} task(s), with “when” over the day` };
  },
};
