/* Found by the actions walk, tried by hand on 21 November 2026: in Find, words changed in a node and left with Escape could not be
   undone (Cmd+Z took a letter off the find line and the node kept its new words); and in a node opened in Find, Enter at the end of a
   line made an empty line that did not show while the words typed next went into the search. The owner: "two find faults then
   right-click". Cmd+Z from the find line undoes the node's change; words typed at once after Enter land in the new line. */
module.exports = {
  parts: ['find', 'threads', 'shared'],
  name: 'In Find, Cmd+Z undoes a change to a node, and words typed right after Enter land in the new line',
  from: '21 Nov: the actions walk',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const title = uuid => f.evaluate(async u => (await logseq.Editor.getBlock(u))?.title ?? null, uuid);
    const kids = uuid => f.evaluate(async u => ((await logseq.Editor.getBlock(u, { includeChildren: true }))?.children || []).map(k => k.title), uuid);
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDUNDO")]]'); for (const [u] of rows) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    await clean();
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Dr. Mei Chen'); const b = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDUNDO node words'); await logseq.Editor.insertBlock(b.uuid, 'GUARDUNDO first line', { sibling: false }); return b.uuid; });
    await T.go(page, 'Northgate Cancer Center'); await T.sleep(1200);
    await page.keyboard.press('Meta+k'); await T.sleep(900);
    await page.keyboard.type('GUARDUNDO node', { delay: 40 }); await T.sleep(1500);
    const end = sel => page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.right + 3, y: r.top + r.height / 2 }; }, sel);
    // 1. The row's words, changed and left with Escape, then Cmd+Z from the find line.
    let at = await end(`dialog[open] .fd-r[data-uuid="${uuid}"] .fd-w > span:last-child`);
    if (!at) return done({ ok: false, said: 'the node was not listed in Find' });
    await page.mouse.click(at.x, at.y); await T.sleep(700);
    await page.keyboard.press('End'); await page.keyboard.type(' changed', { delay: 30 }); await page.keyboard.press('Escape'); await T.sleep(1500);
    if ((await title(uuid)) !== 'GUARDUNDO node words changed') return done({ ok: false, said: 'the words could not be changed in Find' });
    await page.keyboard.press('Meta+z'); await T.sleep(1800);
    const after = await title(uuid);
    const line = await page.evaluate(() => document.querySelector('dialog[open] .fd-input')?.value);
    if (after !== 'GUARDUNDO node words') return done({ ok: false, said: `Cmd+Z in Find did not undo the node's words (they read “${after}”, the find line “${line}”)` });
    // 2. The node opened in place; Enter at the end of its line, words typed at once.
    const fold = await end(`dialog[open] .fd-r[data-uuid="${uuid}"] .fd-fold`);
    if (!fold) return done({ ok: false, said: 'no fold arrow on the row' });
    await page.mouse.click(fold.x - 8, fold.y); await T.sleep(2200);
    at = await page.evaluate(() => { const el = [...document.querySelectorAll('dialog[open] [data-edit-bullet]')].find(e => e.textContent.includes('GUARDUNDO first line')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.right - 4, y: r.top + r.height / 2 }; });
    if (!at) return done({ ok: false, said: 'the opened node showed no line' });
    await page.mouse.click(at.x, at.y); await T.sleep(700);
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.keyboard.type('GUARDUNDO next', { delay: 30 }); await T.sleep(1500);
    await page.keyboard.press('Escape'); await T.sleep(1500);
    const lines = await kids(uuid);
    const search = await page.evaluate(() => document.querySelector('dialog[open] .fd-input')?.value);
    if (!lines.includes('GUARDUNDO next')) return done({ ok: false, said: `the words typed after Enter did not land in a new line (lines ${JSON.stringify(lines)}, find line “${search}”)` });
    if (search !== 'GUARDUNDO node') return done({ ok: false, said: `the find line changed to “${search}”` });
    return done({ ok: true, said: 'Cmd+Z undid the words; the next line took the words typed at once' });
  },
};
