/* The hand test of 24 November 2026, at the owner's window with both sidebars open (the page about 174 px wide): a day's title read
   a letter a line ("1 / 6 / t / h / , / 2 / 0 / 2 / 6"). Look keeps a day's own tag, which shows only under the pointer, beside the
   title so it holds no line of its own; in a pane that narrow the unseen tag kept its width and left the title 26 px. Logseq itself
   breaks the title between its words there. Where the two do not fit side by side the tag goes under the title, and the title
   keeps the row. */
module.exports = {
  parts: ['look', 'sidebar'],
  name: 'A day\'s page left little width beside the open sidebar: its title keeps the row and breaks between words, not a letter a line',
  from: '24 Nov: the hand test, a day\'s title a letter a line on the squeezed page',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Nov 16th, 2026'); await T.sleep(1500);
    await T.inSidebar(box, 'Amex Gold'); await T.sleep(1500);
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 700, deviceScaleFactor: 1, mobile: false });
    await T.still(page); await T.sleep(1500);
    const got = await page.evaluate(() => {
      const row = document.querySelector('#main-content-container .ls-page-title-container .block-row'); if (!row) return { none: 'no title row on the day\'s page' };
      const words = row.querySelector('.block-content-wrapper'); if (!words) return { none: 'no title in the row' };
      const r = row.getBoundingClientRect(), w = words.getBoundingClientRect(), text = (words.querySelector('.block-content') || words).textContent.trim();
      const size = parseFloat(getComputedStyle(words.querySelector('.block-content') || words).fontSize) || 30;
      return { row: Math.round(r.width), words: Math.round(w.width), lines: Math.round(w.height / (size * 1.2)), text, parts: text.split(/\s+/).length };
    });
    if (got.none) return { ok: false, said: got.none };
    if (got.row > 220) return { ok: false, said: `the title's row is ${got.row}px wide here, not the cramped place this case is about` };
    if (got.words < got.row * 0.8) return { ok: false, said: `“${got.text}” has ${got.words}px of a row ${got.row}px wide, and runs down ${got.lines} lines` };
    if (got.lines > got.parts + 2) return { ok: false, said: `“${got.text}” runs down ${got.lines} lines for ${got.parts} words` };
    return { ok: true, said: `“${got.text}” keeps its row (${got.words} of ${got.row}px), ${got.lines} lines` };
  },
};
