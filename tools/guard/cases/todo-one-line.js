/* The owner, 21 November 2026, of Todo in the sidebar: "the top is crowded. will search and add always be on top of one another like
   that?", then picked A: one line that adds and finds. Todo has one line, "Add or find a todo": typing narrows the list, Return adds
   the words as a task. (The timeline, taken out of the sidebar with it, came back there the same evening at the owner's word.) */
module.exports = {
  parts: ['todo', 'shared'],
  name: 'Todo has one line that adds and finds: typing narrows the list, Return adds the task',
  from: '21 Nov: "the top is crowded"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDONELINE")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    await clean();
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    const fields = await page.evaluate(() => [...document.querySelectorAll('#main-content-container .td input[type="text"]')].filter(i => !i.closest('[data-th-node]')).map(i => i.placeholder));
    if (fields.length !== 1 || fields[0] !== 'Add or find a todo') return { ok: false, said: `Todo's top has ${fields.length} line(s): ${fields.join(', ')}` };
    const all = await page.evaluate(() => document.querySelectorAll('#main-content-container .td-list .td-row').length);
    const field = await page.$('#main-content-container .td-add input');
    await field.click(); await page.keyboard.type('GUARDONELINE dispute', { delay: 20 }); await T.sleep(900);
    const narrowed = await page.evaluate(() => document.querySelectorAll('#main-content-container .td-list .td-row').length);
    await page.keyboard.press('Enter'); await T.sleep(3000);
    const added = await page.evaluate(() => [...document.querySelectorAll('#main-content-container .td-row')].some(r => /GUARDONELINE dispute/.test(r.textContent)));
    const left = await page.evaluate(() => document.querySelector('#main-content-container .td-add input').value);
    await clean();
    if (!(narrowed < all)) return { ok: false, said: `typing left ${narrowed} of ${all} rows` };
    if (left) return { ok: false, said: 'Return left the words in the line' };
    if (!added) return { ok: false, said: 'Return did not add the task' };
    return { ok: true, said: `one line; typing narrowed ${all} rows to ${narrowed}; Return added the task` };
  },
};
