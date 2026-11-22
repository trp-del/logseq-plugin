/* The owner, 21 November 2026, of the line under a Todo task: "can we added a breadcrumb instead of just the page?". Under a task
   written two bullets deep the line is the way down to it: its page, then each bullet it is under, the library's trail. */
module.exports = {
  parts: ['todo', 'shared'],
  name: 'Under a Todo task, the way down to it: its page, then each bullet it is written under',
  from: '21 Nov: "can we added a breadcrumb instead of just the page?"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDTRAIL")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    await clean();
    await f.evaluate(async () => {
      const pg = await logseq.Editor.getPage('Chase Checking');
      const a = await logseq.Editor.appendBlockInPage(pg.uuid, 'GUARDTRAIL called the bank');
      const b = await logseq.Editor.insertBlock(a.uuid, 'GUARDTRAIL they can waive it', { sibling: false });
      const c = await logseq.Editor.insertBlock(b.uuid, 'GUARDTRAIL ask for the fee back', { sibling: false });
      await logseq.Editor.addBlockTag(c.uuid, 'Task');
      const [[todo]] = await logseq.DB.datascriptQuery('[:find ?e :where [?e :db/ident :logseq.property/status.todo]]');
      await logseq.Editor.upsertBlockProperty(c.uuid, 'logseq.property/status', todo, { entityId: true });
    });
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(3000);
    const steps = await page.evaluate(() => { const r = [...document.querySelectorAll('#main-content-container .td-row')].find(e => /GUARDTRAIL ask for the fee back/.test(e.textContent)); return r ? [...r.querySelectorAll('.td-where .lk-step')].map(s => s.textContent.trim()) : null; });
    await clean();
    if (!steps) return { ok: false, said: 'the nested task is not listed in Todo' };
    const want = ['Chase Checking', 'GUARDTRAIL called the bank', 'GUARDTRAIL they can waive it'];
    if (steps.join(' › ') !== want.join(' › ')) return { ok: false, said: `the line under the task reads “${steps.join(' › ')}”` };
    return { ok: true, said: `“${steps.join(' › ')}”` };
  },
};
