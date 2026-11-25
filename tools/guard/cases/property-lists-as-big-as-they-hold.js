/* The owner's five pictures of making a property, 24 November 2026: the box for a new name stood 235 by 286 round one line
   (Logseq gives the list one height whatever it holds), the list of tags ran 42 lines down the window as a flat list ("shouldn't
   this be the structured tag selected with hirearchy that we use elsewhere"), and Logseq's lists took several sizes on their way
   open. Under its line the list is as high as its lines, eight at most, each 28 pt; it is there at one size; and "Choose tag" is
   the tag tree, your own tags stepped in under their parents, "Skip choosing tag" first. */
const NAME = 'Guard Calm Probe';
module.exports = {
  parts: ['look', 'structure', 'shared'],
  name: 'Making a property: the list as high as its lines, eight at most, one size; a new name in a box of one line; Choose tag as the tag tree',
  from: '24 Nov: the five pictures of making a property; "shouldn\'t this be the structured tag selected with hirearchy"',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box, f = box.frame(), out = [];
    const clean = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await f.evaluate(async n => { const p = await logseq.Editor.getPage(n); if (p) await logseq.Editor.deletePage(n); }, NAME).catch(() => {}); };
    await clean();
    await T.go(page, 'Dr. Mei Chen'); await T.sleep(2000);
    const add = page.getByText('Add property', { exact: true }).first();
    if (!await add.count()) return { ok: false, said: 'Dr. Mei Chen shows no “Add property”' };
    const read = () => page.evaluate(() => { const e = document.querySelector('.ui__popover-content:has(.ls-property-dialog)'); if (!e) return null; const r = e.getBoundingClientRect(), rows = [...e.querySelectorAll('.menu-link')].filter(a => a.checkVisibility()); return { side: e.dataset.side, w: Math.round(r.width), h: Math.round(r.height), rows: rows.length, heights: [...new Set(rows.slice(0, 8).map(a => Math.round(a.getBoundingClientRect().height)))], anim: getComputedStyle(e).animationName, pads: rows.map(a => Math.round(parseFloat(getComputedStyle(a.closest('.menu-link-wrap')).paddingLeft))), first: rows[0]?.textContent.trim(), cut: (() => { const box = e.querySelector('.cp__select-main > :not(.input-wrap)'); if (!box || box.scrollTop) return 0; const b = box.getBoundingClientRect(); return rows.filter(a => { const r = a.getBoundingClientRect(); return r.top < b.bottom - 2 && r.bottom > b.bottom + 2; }).length; })() }; });
    await add.click(); await T.sleep(900);
    let r = await read();
    if (!r) { await clean(); return { ok: false, said: 'the list of properties did not open' }; }
    if (r.anim !== 'none') out.push(`the list comes in by a motion (${r.anim}), so it takes several sizes`);
    if (r.h > 35 + 8 * 28 + 16) out.push(`the list of properties is ${r.h} pt high (eight lines and its field at most)`);
    if (r.heights.length !== 1 || r.heights[0] !== 28) out.push(`its lines are ${r.heights.join(' and ')} pt high (28)`);
    await page.keyboard.type(NAME, { delay: 30 }); await T.sleep(900);
    r = await read();
    if (r && r.side === 'bottom' && r.h > 90) out.push(`the box for a new name is ${r.h} pt high round one line`);
    await page.keyboard.press('Enter'); await T.sleep(1000);
    const node = page.locator('.ui__select-content').getByText('Node', { exact: true });
    if (await node.count()) {
      await node.click(); await T.sleep(1100);
      r = await read();
      if (!r || !/Skip choosing tag/.test(r.first || '')) out.push('“Choose tag” did not open with “Skip choosing tag” first');
      else if (r.cut) out.push('“Choose tag” cuts its last line in half');   // seen in the hand test, 24 November 2026
      else if (!r.pads.some(p => p >= 16)) out.push('“Choose tag” is a flat list: no tag is stepped in under its parent');
      else if (r.h > 40 + 8 * 28 + 16) out.push(`“Choose tag” is ${r.h} pt high (eight lines and its field at most)`);
    } else out.push('the list of types did not offer Node');
    await clean();
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'the lists as high as their lines, one size, the tag tree in Choose tag' };
  },
};
