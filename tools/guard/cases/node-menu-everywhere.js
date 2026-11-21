/* The actions walk, 21 November 2026: a node's tag could be set and the node deleted only on its own page, in an embed and in a
   table; Find's rows had no right-click menu, and Todo's and Relations' each had a menu of their own. The owner: "two find faults
   then right-click". A right-click on a node's row opens the one node menu (Set status…, Add tag…, Delete) in Find, in Todo and in
   Relations; Add tag… from Find's menu tags the node. */
module.exports = {
  parts: ['find', 'todo', 'threads', 'shared'],
  name: 'A right-click on a node opens the same node menu in Find, Todo and Relations (Add property…, Add a line among its lines), and Add tag… there tags it',
  from: '21 Nov: the actions walk',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDMENU")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    await clean();
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Dr. Mei Chen'); const b = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDMENU check the bill'); await logseq.Editor.upsertBlockProperty(b.uuid, 'logseq.property/status', 'Todo'); return b.uuid; });
    const menuWords = () => page.evaluate(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].map(e => e.textContent.trim()));
    const rightClick = async sel => { const at = await page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + Math.min(30, r.width / 2), y: r.top + r.height / 2 }; }, sel); if (!at) return null; await page.mouse.click(at.x, at.y, { button: 'right' }); await T.sleep(900); return menuWords(); };
    const needs = ['Set status…', 'Add tag…', 'Add property…', 'Add a line', 'Delete'];   // Add property… and Add a line: items 1 and 2 (21 Nov)
    const lacks = words => needs.filter(n => !words?.includes(n));
    // Find.
    await T.go(page, 'Northgate Cancer Center'); await T.sleep(1200);
    await page.keyboard.press('Meta+k'); await T.sleep(900); await page.keyboard.type('GUARDMENU check', { delay: 30 }); await T.sleep(1500);
    let words = await rightClick(`dialog[open] .fd-r[data-uuid="${uuid}"] .fd-w`);
    if (lacks(words).length) return done({ ok: false, said: `Find's row: no node menu (${words ? words.join(', ') || 'nothing' : 'no row'})` });
    // Add tag… from it.
    const add = await page.$('.lk-door-menu .lk-item:has-text("Add tag")'); const r = await add.boundingBox(); await page.mouse.click(r.x + 20, r.y + r.height / 2); await T.sleep(1200);
    await page.keyboard.type('Consultation', { delay: 30 }); await T.sleep(600); await page.keyboard.press('Enter'); await T.sleep(1500);
    const tagged = await f.evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?g] [?g :block/title ?t]]`)).flat(), uuid);
    if (!tagged.includes('Consultation')) return done({ ok: false, said: `Add tag… from Find's menu did not tag the node (tags: ${tagged.join(', ') || 'none'})` });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(200); }
    // Todo.
    await page.evaluate(() => { location.hash = '#/todo'; }); await T.sleep(2500);
    words = await rightClick(`#main-content-container .td-row[data-uuid="${uuid}"] .td-words`);
    if (lacks(words).length) return done({ ok: false, said: `Todo's row: no node menu (${words ? words.join(', ') || 'nothing' : 'no row'})` });
    await page.keyboard.press('Escape'); await T.sleep(300);
    return done({ ok: true, said: 'the node menu in Find and Todo; Add tag… tagged the node' });
  },
};
