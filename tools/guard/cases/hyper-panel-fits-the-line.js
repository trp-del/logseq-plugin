/* The owner, 22 November 2026, of the panel a tap of Hyper opens under the line: "look at the current find window that appears with
   hyper key. it is not well suited". It stood as wide as the page, far from the caret, with a kind line counting the whole graph and
   a day column half empty. The panel hangs from the caret at the width of its rows; before a letter is typed it counts no kinds and
   lists the pages linked in the lines around the one being written first; its rows have no day column. */
module.exports = {
  parts: ['find', 'shared'],
  name: 'The Hyper panel fits the line: at the caret, no wider than its rows, near pages first, no kind counts or day column at rest',
  from: '22 Nov: "it is not well suited"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDFIT")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const hyper = async () => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await page.keyboard.down(k); await T.sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await page.keyboard.up(k); };
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async () => {
      const p = await logseq.Editor.getPage('Chase Checking');
      await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDFIT sent the statement to [[Amex Gold]]');
      return (await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDFIT test for ')).uuid;
    });
    await T.sleep(900);
    await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 18 }), uuid); await T.sleep(800);
    await hyper(); await T.sleep(2200);
    const s = await page.evaluate(() => {
      const d = document.querySelector('dialog[open].fd.fd-panel'), t = document.querySelector('.ls-block textarea');
      if (!d || !t) return null;
      const r = d.getBoundingClientRect(), tr = t.getBoundingClientRect();
      const rows = [...d.querySelectorAll('.fd-r[data-uuid]')];
      const day = rows[0]?.querySelector('.fd-day')?.getBoundingClientRect().width ?? -1;
      return { left: r.left, width: r.width, boxLeft: tr.left, boxWidth: tr.width, win: window.innerWidth, head: d.querySelector('.fd-head-rows')?.textContent || '', first: rows[0]?.querySelector('.fd-w')?.textContent || '',
        counts: [...d.querySelectorAll('.fd-choices, .fd-lines')].map(e => e.innerText).join(' ').replace(/\s+/g, ' '), day };
    });
    if (!s) return no('a tap of Hyper did not open the panel');
    if (s.width > 560) return no(`the panel is ${Math.round(s.width)} px wide, as wide as the page's words (${Math.round(s.boxWidth)} px)`);
    if (s.left < s.boxLeft + 40 && s.left + s.width < s.win - 14) return no(`the panel starts at the line's left edge (${Math.round(s.left)} px), not under the caret`);
    if (!/^near this line/.test(s.head)) return no(`the rows' head reads “${s.head}”, not the pages near the line`);
    if (s.first !== 'Amex Gold') return no(`the first row is “${s.first}”, not the page linked in the line above`);
    if (/\b(Task|Transaction|Account)\s*\d+/.test(s.counts)) return no(`kinds of the whole graph are counted before a letter is typed (“${s.counts.slice(0, 60)}”)`);
    if (s.day > 1) return no(`the rows keep a day column ${Math.round(s.day)} px wide`);
    await page.keyboard.type('am', { delay: 100 }); await T.sleep(1600);
    await page.keyboard.press('ArrowRight'); await T.sleep(1800);
    const foot = await page.evaluate(() => { const items = [...(document.querySelector('dialog[open].fd.fd-panel .fd-foot')?.children || [])].map(e => Math.round(e.getBoundingClientRect().top)); return { lines: new Set(items).size, n: items.length }; });
    if (foot.lines > 1) return no(`with a row opened the panel's foot breaks into ${foot.lines} lines`);
    return done({ ok: true, said: `at the caret, ${Math.round(s.width)} px wide, “${s.head}”, ${s.first} first, no kind counts, no day column` });
  },
};
