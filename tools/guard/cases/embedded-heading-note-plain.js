/* The owner, 19 November 2026, of a folded heading shown as an embedded node, its note (↳ ○ 1 · Cancellation · Waiting) underlined
   to the end: "did you add these underlines here before. Why?" An embedded node's words read as a link, and a heading's words and
   its note are one flex row, so the link's line ran on under the note. The case makes such a node in the guard's copy and takes it away. */
module.exports = {
  parts: ['look'],
  name: 'A folded heading embedded on a page: its note carries no underline',
  from: '19 Nov: “did you add these underlines here before. Why?”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    await T.go(box.page, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(1500);
    const f = box.frame();
    const ids = await f.evaluate(async () => { const p = await logseq.Editor.getCurrentPage(); const b = await logseq.Editor.appendBlockInPage(p.uuid, '## Guard heading zq'); await logseq.Editor.insertBlock(b.uuid, 'TODO Guard task #Consultation', { sibling: false }); await logseq.Editor.setBlockCollapsed(b.uuid, true); const e = await logseq.Editor.appendBlockInPage(p.uuid, ''); return [b.uuid, e.uuid]; });
    try {
      await T.sleep(1500); await f.evaluate(id => logseq.Editor.editBlock(id), ids[1]); await T.sleep(800);
      await box.page.keyboard.type('/Node embed', { delay: 50 }); await T.sleep(1200); await box.page.keyboard.press('Enter'); await T.sleep(1500);
      await box.page.keyboard.type('Guard heading zq', { delay: 50 }); await T.sleep(2500); await box.page.keyboard.press('Enter'); await T.sleep(1500); await box.page.keyboard.press('Escape'); await T.sleep(3000);
      const said = await box.page.evaluate(() => {
        const note = [...document.querySelectorAll('.embed-block .lk-folded')].find(n => n.offsetParent && /zq/.test(n.parentElement.textContent));
        if (!note) return 'no note on the embedded heading';
        for (let e = note; e && !e.classList.contains('embed-block'); e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (/underline/.test(cs.textDecorationLine)) return /^(inline-block|inline-flex|inline-grid)$/.test(getComputedStyle(note).display) && e !== note ? '' : `the note stands under the underline of ${e.tagName.toLowerCase()}`;
        }
        return '';
      });
      return said ? { ok: false, said } : { ok: true, said: 'the note is plain' };
    } finally { await f.evaluate(async ids => { await logseq.Editor.removeBlock(ids[1]); await logseq.Editor.removeBlock(ids[0]); }, ids).catch(() => {}); }
  },
};
