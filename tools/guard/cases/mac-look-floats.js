/* The Mac look for whatever floats (the owner picked it of three drawn directions: "try c", then "Yes, build C"). It was then
   reported as checked while it lived only in a trial stylesheet laid over a test Logseq (the owner, 23 November 2026: "this is
   done?", then "you didn't write the cpde"). So, with nothing but the plugin loaded: Logseq's menu on a bullet, its ask before a
   page is deleted, a yes or no on a property, and the plugin's own menu carry the look: glass with a 10-point corner, every line
   24 px, the line you are on filled in the text colour with its words reversed, the ask a small alert that names the page, the
   yes or no a switch. */
module.exports = {
  parts: ['look', 'shared'],
  name: 'The Mac look is in the plugin: glass menus with a filled line, the delete ask as a small alert, a yes or no as a switch',
  from: '23 Nov: "this is done?" … "you didn\'t write the cpde"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const esc = async (n = 3) => { for (let i = 0; i < n; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } };
    const no = async said => { await esc(); return { ok: false, said }; };
    const rclick = async sel => { const el = await page.$(sel); if (!el) return false; await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox(); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2, { button: 'right' }); await T.sleep(900); return true; };
    const glass = sel => page.evaluate(sel => { const m = document.querySelector(sel); if (!m) return null; const c = getComputedStyle(m); return { corner: c.borderTopLeftRadius, blur: /blur/.test(c.backdropFilter || c.webkitBackdropFilter || '') }; }, sel);

    // 1. Logseq's menu on a bullet.
    await T.go(page, 'Sep 15th, 2026'); await T.sleep(2000);
    if (!await rclick('#main-content-container .ls-block .bullet-container')) return no('no bullet on Sep 15th, 2026');
    const menu = await glass('.ui__dropdown-menu-content');
    if (!menu) return no('Logseq\'s menu on a bullet did not open');
    if (menu.corner !== '10px' || !menu.blur) return no(`Logseq's menu on a bullet: corner ${menu.corner}, ${menu.blur ? 'glass' : 'no glass'}`);
    const heights = await page.evaluate(() => [...new Set([...document.querySelectorAll('.ui__dropdown-menu-content [role=menuitem]')].map(e => Math.round(e.getBoundingClientRect().height)))]);
    if (heights.length !== 1 || heights[0] !== 24) return no(`the bullet menu's lines are ${heights.join(' and ')} px high, not all 24`);
    const cut = await page.evaluateHandle(() => [...document.querySelectorAll('.ui__dropdown-menu-content [role=menuitem]')].find(e => /^Cut/.test(e.textContent)));
    if (!cut.asElement()) return no('the bullet menu has no Cut line');
    const rest = await cut.asElement().evaluate(e => getComputedStyle(e).color);
    await cut.asElement().hover(); await T.sleep(300);
    const lit = await cut.asElement().evaluate(e => { const c = getComputedStyle(e); return { ground: c.backgroundColor, words: c.color }; });
    if (lit.ground !== rest || lit.words === rest) return no(`the line under the pointer is ${lit.ground} with words ${lit.words}; the text colour is ${rest}`);
    await esc();

    // 2. The plugin's own menu, the line lit by the arrow keys.
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(2000);
    if (!await rclick('#main-content-container .th-tw-tag[data-tag-page]')) return no('no tag after a row on Chase Checking');
    const own = await glass('.lk-door-menu');
    if (!own) return no('the plugin\'s menu on a tag did not open');
    if (own.corner !== '10px' || !own.blur) return no(`the plugin's menu: corner ${own.corner}, ${own.blur ? 'glass' : 'no glass'}`);
    await page.mouse.move(5, 300); await page.keyboard.press('ArrowDown'); await T.sleep(300);
    const mine = await page.evaluate(() => { const m = document.querySelector('.lk-door-menu'), on = m.querySelector('.lk-item.on'), other = [...m.querySelectorAll('.lk-item:not(.gap):not(.on):not(.off)')][0]; const c = on && getComputedStyle(on); return { ground: c?.backgroundColor, words: c?.color, rest: other && getComputedStyle(other).color, heights: [...new Set([...m.querySelectorAll('.lk-item:not(.gap)')].map(e => Math.round(e.getBoundingClientRect().height)))] }; });
    if (!mine.ground || mine.ground !== mine.rest || mine.words === mine.rest) return no(`the plugin's menu line lit by the arrow keys is ${mine.ground} with words ${mine.words}; the text colour is ${mine.rest}`);
    if (mine.heights.length !== 1 || mine.heights[0] !== 24) return no(`the plugin's menu lines are ${mine.heights.join(' and ')} px high, not all 24`);
    await esc();

    // 3. A yes or no on a property, and the ask before a page is deleted (answered with Escape: nothing is deleted).
    await T.go(page, 'Mortgage'); await T.sleep(2000);
    const sw = await page.evaluate(() => { const e = document.querySelector('#main-content-container .property-value-inner .ui__checkbox'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), knob: getComputedStyle(e, '::after').content !== 'none' }; });
    if (!sw) return no('no yes or no property on Mortgage');
    if (sw.w !== 28 || sw.h !== 16 || !sw.knob) return no(`the yes or no on Mortgage is ${sw.w} by ${sw.h}${sw.knob ? '' : ', with no knob'}: a tick box, not a switch`);
    const more = await page.$('button.toolbar-dots-btn');
    if (!more) return no('no ··· button in the header');
    await more.click(); await T.sleep(700);
    const del = await page.evaluateHandle(() => [...document.querySelectorAll('[role=menu] [role=menuitem]')].find(e => /Delete page/.test(e.textContent)));
    if (!del.asElement()) return no('the page menu has no Delete page');
    await del.asElement().click(); await T.sleep(900);
    const ask = await page.evaluate(() => { const b = document.querySelector('.ui__alert-dialog-content'); if (!b) return null; const c = getComputedStyle(b), yes = b.querySelector('.ui__alert-dialog-footer .as-solid'), nay = b.querySelector('.ui__alert-dialog-footer .as-outline'), t = b.querySelector('.ui__alert-dialog-title > span'); return { w: Math.round(b.getBoundingClientRect().width), corner: c.borderTopLeftRadius, blur: /blur/.test(c.backdropFilter || ''), stacked: yes && nay && yes.getBoundingClientRect().bottom <= nay.getBoundingClientRect().top, words: t ? getComputedStyle(t, '::after').content : '', yes: yes ? getComputedStyle(yes, '::after').content : '' }; });
    await page.keyboard.press('Escape'); await T.sleep(600);
    const gone = await page.evaluate(() => !document.querySelector('.ui__alert-dialog-content'));
    const kept = await box.frame().evaluate(async () => { const p = await logseq.Editor.getPage('Mortgage'); return !!p && !p[':logseq.property/deleted-at']; });
    if (!ask) return no('the ask before deleting Mortgage did not open');
    if (!gone) return no('Escape did not close the ask');
    if (!kept) return no('Mortgage was deleted though the ask was answered with Escape');
    if (ask.w !== 260 || ask.corner !== '14px' || !ask.blur || !ask.stacked) return no(`the ask is ${ask.w} px wide, corner ${ask.corner}, ${ask.blur ? 'glass' : 'no glass'}, its answers ${ask.stacked ? 'one over the other' : 'side by side'}`);
    if (!/Delete “Mortgage”\?/.test(ask.words) || !/Delete/.test(ask.yes)) return no(`the ask reads ${ask.words || 'Logseq\'s words'} / ${ask.yes || 'Confirm'}, not Delete “Mortgage”? / Delete`);
    return { ok: true, said: 'glass menus with every line 24 px and the lit line filled, Logseq\'s and the plugin\'s; the ask a small alert naming the page, Escape cancels; the yes or no a switch' };
  },
};
