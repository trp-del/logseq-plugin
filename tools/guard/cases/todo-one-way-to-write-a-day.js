/* The thirteen proposals, 4 (the owner's go, 19 November 2026: "good I like all"): "One way to write a day". Under a task written on
   a journal day, Todo showed the journal page's long name ("Jul 20th, 2026") beside the row's short day ("Jul 31"); now every day
   in the row is the short one, the page line "added Jul 20". */
module.exports = {
  parts: ['todo', 'shared'],
  name: 'Todo says a journal day under a task as "added <short day>", never the journal page\'s long name',
  from: '19 Nov: the thirteen proposals, 4',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const lines = await page.evaluate(() => [...document.querySelectorAll('#main-content-container .td-where')].map(e => e.textContent.trim()));
    if (!lines.length) return { ok: false, said: 'no page line under any task' };
    const long = lines.filter(l => /\d(st|nd|rd|th),\s*\d{4}/.test(l));
    if (long.length) return { ok: false, said: `a journal page's long name under a task: “${long[0]}”` };
    const written = lines.filter(l => /^added [A-Z][a-z]{2} \d{1,2}(, \d{4})?$/.test(l));
    if (!written.length) return { ok: false, said: 'no task written on a journal day says "added …"' };
    return { ok: true, said: `${written.length} task(s) say “${written[0]}”` };
  },
};
