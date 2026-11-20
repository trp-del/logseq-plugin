/* The owner, 19 November 2026 (rule 7, act in place), and of the pictured proposal on 20 November: "good I like all". A task in Todo
   could be ticked and opened elsewhere, and nothing more; since 0.4.2 it opens under its row as Relations' opened node. */
module.exports = {
  parts: ['todo', 'threads', 'shared'],
  name: 'A task in Todo opens in place, with its properties to change',
  from: '20 Nov: the proposal “one node everywhere”, Todo: “good I like all”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(1800);
    const words = await page.$('.td-row .td-words');
    if (!words) return { ok: false, said: 'Todo shows no task' };
    await words.focus(); await page.keyboard.press('ArrowRight'); await T.sleep(2600);
    const seen = await page.evaluate(() => { const h = document.querySelector('.td-node[data-th-node]'); return { holder: !!h, props: h ? h.querySelectorAll('.th-ol-prop').length : 0, arrow: document.querySelector('.td-row.td-opened > .td-open')?.getAttribute('aria-expanded') }; });
    const w2 = await page.$('.td-row.td-opened .td-words'); if (w2) { await w2.focus(); await page.keyboard.press('ArrowLeft'); await T.sleep(900); }
    const closed = await page.evaluate(() => !document.querySelector('.td-node'));
    if (!seen.holder) return { ok: false, said: 'Right on a task’s words opens nothing' };
    if (!seen.props) return { ok: false, said: 'the opened task shows no property to change' };
    if (seen.arrow !== 'true') return { ok: false, said: 'the opened task’s fold arrow does not say it is open' };
    if (!closed) return { ok: false, said: 'Left on the task’s words does not close it' };
    return { ok: true, said: `opens with ${seen.props} properties to change, and closes again` };
  },
};
