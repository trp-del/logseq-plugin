/* The owner, 24 November 2026, of the list a row's "Add tag…" opens: "Why don't you use the tag hierarchy anytime a tag is chosen?"
   (it was every tag's name in one flat list) and, with a picture of it, "There is a weird extra space to the right" (its field's
   line and its lit line ended 27 pt short of the box's right edge). The list is the tag tree, each tag stepped in under its
   parent, in the tag's serif; its lines reach both edges of the box alike; and its last line is whole. */
module.exports = {
  parts: ['shared', 'structure', 'threads', 'todo', 'look'],
  name: 'A row’s “Add tag…” opens the tag tree, in the tag’s serif, its lines from edge to edge of the box',
  from: '24 Nov: "Why don\'t you use the tag hierarchy anytime a tag is chosen?"; "There is a weird extra space to the right"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box, out = [];
    const esc = async () => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } };
    await esc();
    await page.keyboard.press('g'); await page.keyboard.press('d'); await T.sleep(2500);
    const row = page.locator('#main-content-container .td-row').first();
    if (!(await row.count())) return { ok: false, said: 'Todo shows no task to press' };
    await row.click({ button: 'right' }); await T.sleep(700);
    const add = page.getByText('Add tag…', { exact: true });
    if (!(await add.count())) { await esc(); return { ok: false, said: 'the task\'s menu has no “Add tag…”' }; }
    await add.click(); await T.sleep(1300);
    const got = await page.evaluate(() => {
      const pop = document.querySelector('.th-lsq-pop'); if (!pop) return null;
      const p = pop.getBoundingClientRect(), list = pop.querySelector('.th-lsq-list'), l = list.getBoundingClientRect(), rows = [...pop.querySelectorAll('.menu-link-wrap')];
      const first = rows[0]?.querySelector('.menu-link').getBoundingClientRect(), cut = rows.filter(r => { const b = r.getBoundingClientRect(); return b.top < l.bottom - 1 && b.bottom > l.bottom + 1 && list.scrollTop === 0; }).length;
      return { left: first ? first.left - p.left : null, right: first ? p.right - first.right : null, stepped: rows.filter(r => parseFloat(getComputedStyle(r).paddingLeft) >= 16).length, n: rows.length, face: rows[1] ? getComputedStyle(rows[1].querySelector('.menu-link')).fontFamily : '', cut };
    });
    await esc();
    if (!got) return { ok: false, said: '“Add tag…” opened no list' };
    if (got.n > 3 && !got.stepped) out.push('the list of tags is flat: no tag is stepped in under its parent');
    if (!/new york|georgia|serif/i.test(got.face) || /^-apple-system/i.test(got.face)) out.push('the tags are not in the tag’s serif');
    if (got.left != null && Math.abs(got.right - got.left) > 2) out.push(`the lit line stands ${Math.round(got.left)} pt from the box's left edge and ${Math.round(got.right)} from its right`);
    if (got.cut) out.push('the list cuts its last line in half');
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'the tag tree, in the serif, its lines from edge to edge, the last line whole' };
  },
};
