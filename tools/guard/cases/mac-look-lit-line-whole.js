/* The Mac look, found by hand on 23 November 2026: in Relations' "View and more" menu the line lit by the arrow keys ("Timeline")
   was filled in the text colour, but its value at the right ("Hidden") and its chevron kept their grey and could not be seen on
   the fill. Whatever stands on a lit line of a plugin menu (a value, a chevron, a key, an icon, a tick) is reversed with the
   line, under the arrow keys and under the pointer. */
module.exports = {
  parts: ['look', 'threads', 'shared'],
  name: 'On a lit line of the plugin\'s menu, the value and the chevron at its end are reversed with its words (View and more, Timeline)',
  from: '23 Nov: the hand test of the Mac look',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const esc = async () => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } };
    const no = async said => { await esc(); return { ok: false, said }; };
    // The words of the lit line, its ground, and every piece on it whose colour is not the words'.
    const lit = sel => page.evaluate(sel => {
      const line = document.querySelector(sel); if (!line) return null;
      const c = getComputedStyle(line), words = c.color;
      const off = [...line.querySelectorAll('*')].filter(e => e.getClientRects().length && getComputedStyle(e).color !== words).map(e => (e.textContent.trim() || e.className.toString()).slice(0, 24));
      return { text: line.textContent.trim(), ground: c.backgroundColor, words, off };
    }, sel);
    await T.go(page, 'Mortgage'); await T.still(page); await T.sleep(2000);
    const more = await page.$('#main-content-container .th-tw-groupby');
    if (!more) return no('no View and more button on Mortgage');
    await more.click(); await T.sleep(700);
    await page.mouse.move(5, 300); await T.sleep(150);
    let key = null;
    for (let i = 0; i < 8; i++) { key = await lit('.th-pop.lk-menu .lk-item.on'); if (key && /^Timeline/.test(key.text)) break; await page.keyboard.press('ArrowDown'); await T.sleep(180); }
    if (!key || !/^Timeline/.test(key.text)) return no(`the arrow keys did not reach Timeline in View and more (on: ${key ? key.text : 'no line'})`);
    if (key.ground === 'rgba(0, 0, 0, 0)' || key.ground === key.words) return no(`the line lit by the arrow keys is not filled (${key.ground}, words ${key.words})`);
    if (key.off.length) return no(`on the line lit by the arrow keys, not reversed with the words: ${key.off.join(', ')}`);
    const first = await page.$('.th-pop.lk-menu .lk-item:not(.on)');
    if (!first) return no('View and more has no second line');
    await first.hover(); await T.sleep(300);
    const ptr = await lit('.th-pop.lk-menu .lk-item:hover');
    if (!ptr || ptr.ground === 'rgba(0, 0, 0, 0)') return no('the line under the pointer is not filled');
    if (ptr.off.length) return no(`on the line under the pointer, not reversed with the words: ${ptr.off.join(', ')}`);
    await esc();
    return { ok: true, said: 'Timeline lit by the arrow keys and Sort by under the pointer: the value and the chevron are reversed with the words' };
  },
};
