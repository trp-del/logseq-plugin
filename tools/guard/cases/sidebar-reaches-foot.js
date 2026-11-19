/* 18 November 2026, the owner's list: an empty chunk at the bottom of the right sidebar, near the ?, a task's page name cut off at
   its edge. The sidebar's list stood 48 px short of the window's foot once Logseq's bar over it was taken away. */
module.exports = {
  parts: ['sidebar', 'look'],   // the parts of the plugin whose change this case is run for (every case runs before a release)
  name: 'The right sidebar reaches the window’s foot',
  from: '18 Nov: an empty chunk at the bottom of the sidebar, a task row cut off',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Organization'); await T.sleep(1500);
    await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('todo')); await T.sleep(2500);
    const r = await box.page.evaluate(() => { const l = document.querySelector('#right-sidebar .sidebar-item-list'); return { bottom: Math.round(l.getBoundingClientRect().bottom), h: innerHeight }; });
    return r.bottom >= r.h - 2 ? { ok: true, said: 'to the foot' } : { ok: false, said: `stops ${r.h - r.bottom} px above the foot` };
  },
};
