/* The owner, 23 November 2026: "can you mockup how you can show the node, which is a link, different underneath than just the outline,
   like add a background or something to make it distinct. it is unclear". Picked 1A: the node opened under a line (the looking key)
   stands on a ground of the wash with no guide line from the margin, its top line holds its place and a close ×, the link that was
   opened is lit, and the × closes it as Escape does, the caret still in the line. */
module.exports = {
  parts: ['find', 'threads', 'look', 'shared'],
  name: 'A node opened under a line stands on its ground: the link lit, its place and a × on top, no guide line; the × closes it and the writing goes on',
  from: '23 Nov: "show the node, which is a link, different underneath than just the outline"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDGROUND")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const words = 'GUARDGROUND paid [[Amex Gold]] and then [[Mortgage]] from here';
    const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, words);
    await T.sleep(700);
    const pos = words.indexOf(']]') + 2;
    await page.evaluate(([u, at]) => window.logseq.api.edit_block(u, { pos: at }), [uuid, pos]); await T.sleep(900);
    await page.keyboard.press('Alt+KeyL'); await T.sleep(2500);
    const st = () => page.evaluate(() => {
      const h = document.querySelector('[data-lk-under]'), t = document.activeElement;
      if (!h) return { open: false, focus: t?.tagName, val: t?.value ?? null, pos: t?.selectionStart ?? null };
      const cs = getComputedStyle(h), first = h.querySelector('.th-tw-nodetop > .th-ol-kids'), x = h.querySelector('.lk-ground-top .lk-close');
      const lit = [...(h.previousElementSibling?.querySelectorAll('.lk-opened-at') || [])].map(e => e.getBoundingClientRect());
      const ta = h.closest('.ls-block').querySelector(':scope > .block-main-container textarea')?.getBoundingClientRect();
      return { open: true, ground: cs.backgroundColor, corner: cs.borderTopLeftRadius, shadow: cs.boxShadow, drawn: !!first, guide: first ? getComputedStyle(first).borderLeftWidth : null, indent: first ? Math.round(first.getBoundingClientRect().left - h.getBoundingClientRect().left) : null,
        x: !!x, place: h.querySelector('.lk-ground-top .lk-path')?.textContent || '', lit: lit.length, litWide: Math.round(lit[0]?.width || 0), litIn: !!ta && !!lit[0] && lit[0].top >= ta.top - 4 && lit[0].bottom <= ta.bottom + 4,
        focus: t?.tagName, val: t?.value ?? null, pos: t?.selectionStart ?? null };
    });
    let s = await st();
    if (!s.open || !s.drawn) return no('the node did not open under the line');
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(s.ground)) return no('the opened node has no ground: it reads as more of the outline');
    if (s.corner !== '10px' || s.shadow !== 'none') return no(`the ground is not the plain rounded wash (corner ${s.corner}, shadow ${s.shadow})`);
    if (s.guide !== '0px') return no(`the first level still has its guide line from the margin (${s.guide})`);
    if (!s.x) return no('there is no × on the top line of the ground');
    if (!/Credit Card|Account|Continuant/i.test(s.place)) return no(`the top line does not say the node’s place (“${s.place}”)`);
    if (s.lit < 1 || s.litWide < 40 || !s.litIn) return no(`the link that was opened is not lit in the line (${s.lit} wash, ${s.litWide}px wide, inside the line: ${s.litIn})`);
    if (s.focus !== 'TEXTAREA' || s.val !== words) return no('the caret left the line when the node opened');
    await page.keyboard.type(' ok', { delay: 60 }); await T.sleep(500); s = await st();
    if (!s.open || s.val !== words.slice(0, pos) + ' ok' + words.slice(pos)) return no('typing did not go on in the line with the node open');
    const xy = await page.evaluate(() => { const r = document.querySelector('[data-lk-under] .lk-ground-top .lk-close').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(xy[0], xy[1]); await T.sleep(1200); s = await st();
    if (s.open) return no('the × did not close the node');
    if (s.focus !== 'TEXTAREA' || !String(s.val).startsWith('GUARDGROUND')) return no(`after the ×, the writing did not go on in the line (focus ${s.focus})`);
    return done({ ok: true, said: 'on a ground with a 10px corner and no guide line, the link lit, its place and a × on top; typing went on, the × closed it and the caret stayed in the line' });
  },
};
