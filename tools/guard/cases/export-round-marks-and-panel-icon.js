/* The owner, 22 November 2026, of DB Export: "the main document is ugly especially with square to do boces. should be atleast
   circles of `[ ]`", and "adjust buttons style doesn't work for something that is a sidebat". On the sheet a task carries a round
   mark the print draws (or typed [ ] in the typewriter look), never a square box; and what shows and hides the window's column
   is the library's panel icon, not the word Adjust on a pill. */
module.exports = {
  parts: ['export', 'shared'],
  name: 'An exported sheet draws a task as a circle, and the export window’s column is shown by a panel icon',
  from: '22 Nov: “square to do boces. should be atleast circles”, “adjust buttons style doesn’t work for something that is a sidebat”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Jul 20th, 2026'); await T.still(page); await T.sleep(600);
    await box.frame().evaluate(() => { window.DbExport.app.exportWindow(); });
    let seen = null;
    for (let i = 0; i < 40 && !seen?.marks; i++) {
      await T.sleep(250);
      seen = await page.evaluate(() => {
        const d = document.querySelector('.xp iframe')?.contentDocument, marks = d ? [...d.querySelectorAll('.x-task')] : [];
        const round = marks.filter(m => { const s = d.defaultView.getComputedStyle(m), w = parseFloat(s.width); return parseFloat(s.borderTopLeftRadius) >= w / 2 - 1 && w > 4 && Math.abs(w - parseFloat(s.height)) < 1; }).length;
        const b = document.querySelector('.xp .xp-adjust');
        return { marks: marks.length, round, squares: /[☐☑]/.test(d?.body?.textContent || ''), word: (b?.textContent || '').trim(), icon: !!b && b.classList.contains('lk-i-sidel') && !b.classList.contains('lk-btn') };
      }).catch(() => null);
    }
    await box.frame().evaluate(() => window.DbExport.ui.sweep());
    if (!seen?.marks) return { ok: false, said: 'the export window drew no task on its sheet' };
    if (seen.squares) return { ok: false, said: 'a square box (☐ or ☑) is on the sheet' };
    if (seen.round !== seen.marks) return { ok: false, said: `${seen.marks - seen.round} of ${seen.marks} task marks are not drawn as circles` };
    if (seen.word || !seen.icon) return { ok: false, said: seen.word ? `the column is shown by the word “${seen.word}”` : 'the column’s press is not the library’s panel icon' };
    return { ok: true, said: `${seen.marks} tasks, each a circle; the column is shown by the panel icon` };
  },
};
