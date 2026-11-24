/* The owner, 23 November 2026: "also fingure out a way to filter bullets in view like based on properties, tags etc. I am not talking
   about in a query since this would only be atemporary thing. so it would be on top but not in the way of things since you have to
   see bullets", then "I was thinking more of an input bar, where you can type free text but also do the tag or property search. it
   is more flexible". Said yes to 3D: a key brings up a bar at the foot of the page; words narrow the page as they are typed; a tag, a
   property value or a linked page is picked from the short list above the bar and stands in it as a piece; a match keeps what is
   under it, the bullets it sits under stay in grey, the rest is hidden or greyed; Escape puts the page back as it was. */
module.exports = {
  parts: ['find', 'look', 'shared'],
  name: 'The filter bar: words narrow the page as typed, a linked page and a tag are picked as pieces, the rest hidden or greyed, Escape puts the page back',
  from: '23 Nov: "an input bar, where you can type free text but also do the tag or property search"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDFILTER top")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    await f.evaluate(async () => {
      const p = await logseq.Editor.getPage('Chase Checking');
      const t = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDFILTER top');
      const a = await logseq.Editor.insertBlock(t.uuid, 'GUARDFILTER groceries bought with [[Amex Gold]]', { sibling: false });
      await logseq.Editor.insertBlock(a.uuid, 'GUARDFILTER receipt kept in the drawer', { sibling: false });
      const c = await logseq.Editor.insertBlock(t.uuid, 'GUARDFILTER rent paid from [[Mortgage]] account', { sibling: false });
      await logseq.Editor.insertBlock(c.uuid, 'GUARDFILTER a deeper note about groceries', { sibling: false });
      await logseq.Editor.insertBlock(t.uuid, 'GUARDFILTER nothing to see', { sibling: false });
      await logseq.Editor.addBlockTag(a.uuid, 'Purchase').catch(() => {});
    });
    await T.sleep(2500);
    await page.evaluate(() => { const m = document.getElementById('main-content-container'); const row = [...m.querySelectorAll('.ls-page-blocks .block-title-wrap')].find(e => e.textContent.trim() === 'GUARDFILTER top'); if (row) m.scrollTop += row.getBoundingClientRect().top - m.getBoundingClientRect().top - 80; }); await T.sleep(700);
    const st = () => page.evaluate(() => {
      const m = document.getElementById('main-content-container'), bar = document.querySelector('.fd-within-bar');
      const rows = [...m.querySelectorAll('.ls-page-blocks .ls-block[blockid] > .block-main-container')].filter(r => /GUARDFILTER/.test(r.querySelector('.block-title-wrap')?.textContent || ''));
      const say = r => { const w = r.querySelector('.block-title-wrap'), words = w.textContent.replace('GUARDFILTER ', '').slice(0, 9).trim(); const seen = r.getClientRects().length > 0 && r.getBoundingClientRect().height > 2; return words + ':' + (!seen ? 'hidden' : r.parentElement.getAttribute('data-fd-w') === 'way' ? 'grey' : r.parentElement.getAttribute('data-fd-w') === 'out' ? 'greyed' : 'shown'); };
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
    await page.keyboard.type('groceries', { delay: 50 }); await T.sleep(700); s = await st();
    if (s.rows !== 'top:grey | groceries:shown | receipt k:shown | rent paid:grey | a deeper:shown | nothing t:hidden') return no(`“groceries” did not narrow the page to its matches, what is under them and the bullets they sit under (${s.rows})`);
    for (let i = 0; i < 9; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('am', { delay: 80 }); await T.sleep(700); s = await st();
    if (!s.list.includes('Amex Gold/page')) return no(`typing “am” did not offer the linked page Amex Gold (${JSON.stringify(s.list)})`);
    if (s.list.length > 6) return no('the list holds more than six lines');
    await page.keyboard.press('Enter'); await T.sleep(600);
    await page.keyboard.type('pur', { delay: 80 }); await T.sleep(600); s = await st();
    if (!s.list.includes('Purchase/tag')) return no(`typing “pur” did not offer the tag Purchase (${JSON.stringify(s.list)})`);
    await page.keyboard.press('Enter'); await T.sleep(700); s = await st();
    if (s.pieces.join(',') !== 'Amex Gold,Purchase') return no(`Enter did not set the picks in the bar as pieces (${s.pieces})`);
    if (s.rows !== 'top:grey | groceries:shown | receipt k:shown | rent paid:hidden | a deeper:hidden | nothing t:hidden') return no(`the two pieces together did not narrow the page (${s.rows})`);
    const xy = await page.evaluate(() => { const r = document.querySelector('.fd-within-bar .lk-value').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(xy[0], xy[1]); await T.sleep(600); s = await st();
    if (s.rows !== 'top:grey | groceries:shown | receipt k:shown | rent paid:greyed | a deeper:greyed | nothing t:greyed') return no(`the word at the bar’s end did not switch to greying the rest (${s.rows})`);
    await page.keyboard.press('Backspace'); await T.sleep(300); s = await st();
    if (s.pieces.join(',') !== 'Amex Gold') return no('Backspace in the empty line did not take the last piece off');
    await page.keyboard.type('zzqq', { delay: 50 }); await T.sleep(600); s = await st();
    if (!s.none || !s.bar) return no('with nothing matching there is no nothing-here line, or the bar closed');
    await page.keyboard.press('Escape'); await T.sleep(1000); s = await st();
    if (s.bar || s.marks || s.none) return no('Escape did not close the bar and clear the page');
    if (s.rows !== before.rows || s.scroll !== before.scroll) return no(`after Escape the page is not as it was (${s.rows}; scrolled ${s.scroll}, was ${before.scroll})`);
    return done({ ok: true, said: 'a bar on glass at the foot; words narrowed the page as typed; a page and a tag picked as pieces narrowed together; the rest hidden, then greyed; Backspace took a piece off; nothing matching said so; Escape put the page back' });
  },
};
