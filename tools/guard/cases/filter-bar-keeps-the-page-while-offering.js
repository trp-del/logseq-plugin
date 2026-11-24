/* Found by hand, 24 November 2026, in the filter bar (Option-F, picture 3D): typing letters that lead to a tag, a property value or a
   page in the short list but stand in no bullet's words ("pur" for the tag Purchase on the page Household budget) blanked the page
   with "No bullet on this page holds that." before Enter was pressed. While the short list offers a piece and the letters match no
   bullet, the page stays as it was (narrowed only by the pieces already set) and the nothing-here line waits; it shows only when
   nothing is offered and nothing matches. */
module.exports = {
  parts: ['find', 'look', 'shared'],
  name: 'The filter bar keeps the page while the short list offers what the letters lead to: no blank page, no nothing-here line until nothing is offered and nothing matches',
  from: '24 Nov, hand test: typing “pur” for the tag Purchase blanked the page with “No bullet on this page holds that.” before Enter',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDOFFER top")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    await f.evaluate(async () => {
      const p = await logseq.Editor.getPage('Chase Checking');
      const t = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDOFFER top');
      const a = await logseq.Editor.insertBlock(t.uuid, 'GUARDOFFER groceries bought with [[Amex Gold]]', { sibling: false });
      await logseq.Editor.insertBlock(a.uuid, 'GUARDOFFER receipt kept in the drawer', { sibling: false });
      const c = await logseq.Editor.insertBlock(t.uuid, 'GUARDOFFER rent paid from [[Mortgage]] account', { sibling: false });
      await logseq.Editor.insertBlock(c.uuid, 'GUARDOFFER a deeper note about groceries', { sibling: false });
      await logseq.Editor.insertBlock(t.uuid, 'GUARDOFFER nothing to see', { sibling: false });
      await logseq.Editor.addBlockTag(a.uuid, 'Purchase').catch(() => {});
    });
    await T.sleep(2500);
    await page.evaluate(() => { const m = document.getElementById('main-content-container'); const row = [...m.querySelectorAll('.ls-page-blocks .block-title-wrap')].find(e => e.textContent.trim() === 'GUARDOFFER top'); if (row) m.scrollTop += row.getBoundingClientRect().top - m.getBoundingClientRect().top - 80; }); await T.sleep(700);
    const st = () => page.evaluate(() => {
      const m = document.getElementById('main-content-container'), bar = document.querySelector('.fd-within-bar');
      const rows = [...m.querySelectorAll('.ls-page-blocks .ls-block[blockid] > .block-main-container')].filter(r => /GUARDOFFER/.test(r.querySelector('.block-title-wrap')?.textContent || ''));
      const say = r => { const w = r.querySelector('.block-title-wrap'), words = w.textContent.replace('GUARDOFFER ', '').slice(0, 9).trim(); const seen = r.getClientRects().length > 0 && r.getBoundingClientRect().height > 2; return words + ':' + (!seen ? 'hidden' : r.parentElement.getAttribute('data-fd-w') === 'way' ? 'grey' : r.parentElement.getAttribute('data-fd-w') === 'out' ? 'greyed' : 'shown'); };
      const br = bar?.getBoundingClientRect(), mr = m.getBoundingClientRect();
      return { bar: !!bar, atFoot: !!br && br.bottom <= mr.bottom && br.bottom > mr.bottom - 40 && br.left >= mr.left && br.right <= mr.right, glass: bar ? getComputedStyle(bar).backdropFilter : '', rows: rows.map(say).join(' | '), list: [...document.querySelectorAll('.fd-within-list .lk-item')].map(i => i.firstElementChild.textContent + '/' + i.lastElementChild.textContent), pieces: [...document.querySelectorAll('.fd-within-bar .lk-piece')].map(p => p.firstElementChild.textContent), none: !!document.querySelector('.fd-within-none'), marks: document.querySelectorAll('[data-fd-w], [data-fd-within]').length, scroll: Math.round(m.scrollTop), colTop: Math.round(m.firstElementChild.getBoundingClientRect().top + m.scrollTop), focus: document.activeElement?.className || document.activeElement?.tagName };
    });
    const before = await st();
    if (!/top:shown/.test(before.rows) || before.rows.split('|').length !== 6) return no(`the page for the trial could not be made (${before.rows})`);
    await page.keyboard.press('Alt+KeyF'); await T.sleep(1800);
    let s = await st();
    if (!s.bar) return no('the key brought up no bar to filter the page with');
    if (!s.atFoot || !/blur/.test(s.glass)) return no('the bar is not on glass at the foot of the main pane');
    if (s.colTop !== before.colTop || s.rows !== before.rows) return no('the page moved or changed when the bar came up');
    await page.keyboard.type('pur', { delay: 80 }); await T.sleep(700); s = await st();
    if (!s.list.includes('Purchase/tag')) return no(`typing “pur” did not offer the tag Purchase (${JSON.stringify(s.list)})`);
    if (s.none || s.rows !== before.rows) return no(`while “pur” offers the tag Purchase, the page did not stay as it was (${s.none ? 'the nothing-here line shows; ' : ''}${s.rows})`);
    await page.keyboard.press('Enter'); await T.sleep(700); s = await st();
    if (s.pieces.join(',') !== 'Purchase' || s.none) return no(`Enter did not set Purchase as a piece (${s.pieces}${s.none ? ', the nothing-here line shows' : ''})`);
    const narrowed = s.rows;
    if (narrowed === before.rows) return no(`the piece Purchase did not narrow the page (${s.rows})`);
    await page.keyboard.type('am', { delay: 80 }); await T.sleep(700); s = await st();
    if (!s.list.includes('Amex Gold/page')) return no(`typing “am” did not offer the linked page Amex Gold (${JSON.stringify(s.list)})`);
    if (s.none || s.rows !== narrowed) return no(`while “am” offers Amex Gold, the page did not stay narrowed by Purchase alone (${s.none ? 'the nothing-here line shows; ' : ''}${s.rows})`);
    await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.type('zzqq', { delay: 50 }); await T.sleep(700); s = await st();
    if (s.list.length || !s.none) return no(`with nothing offered and nothing matching there is no nothing-here line (${JSON.stringify(s.list)})`);
    await page.keyboard.press('Escape'); await T.sleep(1000); s = await st();
    if (s.bar || s.marks || s.none || s.rows !== before.rows) return no('Escape did not close the bar and put the page back');
    return done({ ok: true, said: 'while “pur” and then “am” offered a tag and a page, the page stayed as it was (then narrowed by the piece alone) with no nothing-here line; with nothing offered and nothing matching the line showed' });
  },
};
