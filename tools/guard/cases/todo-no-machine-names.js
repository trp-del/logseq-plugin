/* 18 November 2026, the owner's list: a Todo row headed ":logseq.property/empty-placeholder", its words squeezed one to a line beside
   the date; and a Todo section in the sidebar headed ":logseq-plugin/_sidebar.todo-side" with nothing in it. A task whose Status is
   there but empty (Logseq's empty value) is made on the guard's copy, Todo opened in the sidebar, and every word on screen read. */
module.exports = {
  parts: ['todo'],   // the parts of the plugin whose change this case is run for (every case runs before a release)
  name: 'Todo never shows a machine name, a task with an empty Status included',
  from: '18 Nov: ":logseq.property/empty-placeholder" on a Todo row, ":logseq-plugin/_sidebar.todo-side" over an empty Todo',
  graph: 'Personal Finance',
  async check(box, T) {
    await box.frame().evaluate(async () => {
      const q = s => logseq.DB.datascriptQuery(s);
      if ((await q('[:find ?b :where [?b :block/title "ZZ guard empty status"]]')).length) return;
      const [[empty]] = await q('[:find ?e :where [?e :db/ident :logseq.property/empty-placeholder]]');
      const pg = await logseq.Editor.createPage('ZZ guard page', {}, { redirect: false });
      const b = await logseq.Editor.appendBlockInPage(pg.uuid, 'ZZ guard empty status');
      await logseq.Editor.upsertBlockProperty(b.uuid, 'logseq.property/status', empty, { entityId: true });
    });
    await T.go(box.page, 'Organization'); await T.sleep(1500);
    await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('todo')); await T.sleep(3000);
    const seen = await box.page.evaluate(() => {
      const side = document.getElementById('right-sidebar'), words = side?.innerText || '';
      const row = [...side.querySelectorAll('.td-row')].find(r => /ZZ guard empty status/.test(r.innerText));
      return { names: [...new Set(words.match(/:?[a-z][\w.-]*\/[\w.-]+/g) || [])].filter(w => /logseq|_sidebar|user\./.test(w)), row: !!row, lines: row ? Math.round(row.querySelector('.td-words').getBoundingClientRect().height / parseFloat(getComputedStyle(row.querySelector('.td-words')).lineHeight)) : 0 };
    });
    if (seen.names.length) return { ok: false, said: 'shows ' + seen.names.join(', ') };
    if (!seen.row) return { ok: false, said: 'the task with an empty Status is not listed' };
    if (seen.lines > 1) return { ok: false, said: `its words take ${seen.lines} lines` };
    return { ok: true, said: 'plain words; the empty-Status task on one line' };
  },
};
