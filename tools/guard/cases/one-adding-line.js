/* The thirteen proposals, 7 (the owner's go, 19 November 2026: "good I like all"): "One line for adding, wherever you add". Todo's
   add line said the day its words name; Relations' + line did not. Now both say it whole at the line's end through one reader. And
   the owner, 21 November 2026: "yes put it back in sidebar": Todo's timeline stands in the sidebar too. */
module.exports = {
  parts: ['threads', 'todo', 'shared'],
  name: 'Relations\' + line says the day its words name, as Todo\'s does; Todo\'s timeline stands in the sidebar',
  from: '19 Nov: the thirteen proposals, 7; 21 Nov: "yes put it back in sidebar"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    await T.go(page, 'SoCalGas'); await T.still(page); await T.sleep(1500);
    const plus = await page.$('#main-content-container .th-tw-add');
    if (!plus) return { ok: false, said: 'no + on SoCalGas\'s list' };
    await plus.click(); await T.sleep(700);
    await page.keyboard.type('Gas bill due friday', { delay: 25 }); await T.sleep(900);
    const said = await page.evaluate(() => document.querySelector('#main-content-container .th-tw-draft-when')?.textContent.trim() || '');
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); }
    await f.evaluate(() => window.PluginDoor.sideTabs.show('todo')); await T.sleep(2500);
    const side = await page.evaluate(() => !!document.querySelector('#right-sidebar .td-time .lk-time'));
    if (!/^Friday, [A-Z][a-z]{2} \d{1,2}/.test(said)) return { ok: false, said: `the + line says “${said}” for “due friday”` };
    if (!side) return { ok: false, said: 'no timeline in Todo\'s sidebar' };
    return { ok: true, said: `the + line says “${said}”; the sidebar has the timeline` };
  },
};
