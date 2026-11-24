/* The owner, 24 November 2026, of the lists that open on the line being written: "the window that appears is much too massive".
   Measured that day on a long line: Logseq's list of pages stood 512 by 288 round names 150 wide, pushed by its own width 527 pt
   left of the caret and over the line being written, 5 pt from the window's edge, and took eight sizes on its way open; the tag
   list was drawn empty for a frame, then set past the window's edge for another. Each list is now as big as what it holds, starts
   (or, with no room to the right, ends) where the typed sign stands, clear of the line, inside the window, at one size from its
   first frame. tools/measure reads the same numbers frame by frame. */
module.exports = {
  parts: ['look', 'structure', 'shared'],
  name: 'The lists on the line being written are as big as what they hold, at the caret, clear of the line, one size from the first frame',
  from: '24 Nov: "the window that appears is much too massive"',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box, f = box.frame(), PAGE = 'FOLFOX side effects, what to expect', out = [];
    await T.go(page, PAGE); await T.sleep(1800);
    const got = await page.evaluate(async () => { const el = [...document.querySelectorAll('#main-content-container .page-blocks-inner .ls-block[blockid]')][2]; if (!el) return null; const uuid = el.getAttribute('blockid'), b = await window.logseq.api.get_block(uuid); return { uuid, text: b?.title ?? '' }; });
    if (!got) return { ok: false, said: `${PAGE} shows no third bullet to write in` };
    const back = async () => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await f.evaluate(([u, t]) => logseq.Editor.updateBlock(u, t), [got.uuid, got.text]).catch(() => {}); await T.sleep(300); };
    // Every frame from the typing: the list's box while it can be seen; then where it stands against the line and the window.
    const watch = () => new Promise(res => {
      const sizes = new Set(), t0 = performance.now();
      const tick = () => {
        const el = document.querySelector('.ui__popover-content[data-editor-popup-ref]');
        if (el && el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) { const r = el.getBoundingClientRect(); if (r.width > 1) sizes.add(`${Math.round(r.width)}×${Math.round(r.height)}`); }
        if (performance.now() - t0 < 1300) return requestAnimationFrame(tick);
        const ta = document.querySelector('.ls-block textarea');
        if (!el || !ta) return res({ none: true });
        const r = el.getBoundingClientRect(), line = ta.getBoundingClientRect(), words = [...el.querySelectorAll('.menu-link')].map(a => { const g = document.createRange(); g.selectNodeContents(a); return g.getBoundingClientRect().width; });
        res({ sizes: [...sizes], w: r.width, h: r.height, left: r.left, right: innerWidth - r.right, bottom: innerHeight - r.bottom,
          over: Math.max(0, Math.min(r.bottom, line.bottom) - Math.max(r.top, line.top)) > 0.5 && Math.min(r.right, line.right) - Math.max(r.left, line.left) > 0.5,
          gap: r.top >= line.bottom - 1 ? r.top - line.bottom : line.top - r.bottom, rows: [...new Set([...el.querySelectorAll('.menu-link')].filter(a => a.checkVisibility()).map(a => Math.round(a.getBoundingClientRect().height)))], lines: words.length, stepped: [...el.querySelectorAll('.menu-link-wrap')].filter(w => w.checkVisibility() && parseFloat(getComputedStyle(w).paddingLeft) >= 16).length });
      };
      requestAnimationFrame(tick);
    });
    for (const [sign, name, widest] of [[' [[', 'the list of pages', 352], [' #', 'the list of tags', 300]]) {
      await page.evaluate(([u, pos]) => window.logseq.api.edit_block(u, { pos }), [got.uuid, got.text.length]); await T.sleep(700);
      const reading = page.evaluate(watch); await T.sleep(100);
      await page.keyboard.type(sign);
      const r = await reading;
      if (r.none) out.push(`${name} did not open`);
      else {
        if (r.w > widest + 1) out.push(`${name} is ${Math.round(r.w)} pt wide (at most ${widest})`);
        if (r.h > 8 * 28 + 12) out.push(`${name} is ${Math.round(r.h)} pt high (eight lines at most)`);
        if (r.over) out.push(`${name} lies over the line being written`);
        if (r.gap < 3.5 || r.gap > 8.5) out.push(`${name} stands ${r.gap.toFixed(1)} pt from the line (4 to 8)`);
        if (Math.min(r.left, r.right, r.bottom) < 8) out.push(`${name} is ${Math.min(r.left, r.right, r.bottom).toFixed(1)} pt from the window's edge (8 at least)`);
        if (r.sizes.length !== 1) out.push(`${name} took ${r.sizes.length} sizes on its way open (${r.sizes.slice(0, 4).join(', ')})`);
        // The owner, 24 November 2026: "Why don't you use the tag hierarchy anytime a tag is chosen?" (the list after # had lost the tree's steps).
        if (sign.trim() === '#' && !r.stepped) out.push('the list of tags is flat: no tag is stepped in under its parent');
        if (r.rows.length !== 1 || r.rows[0] !== 28) out.push(`${name}'s lines are ${r.rows.join(' and ')} pt high (28)`);
      }
      await back();
    }
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'both lists as big as what they hold, at the caret, one size from the first frame' };
  },
};
