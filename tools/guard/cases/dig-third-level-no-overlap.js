/* Found by hand on 0.4.7 and again on 0.4.10 (20 November 2026): while a third level opened in Relations, "Relations" and "Charged"
   were drawn over the Oct 14 row for about four frames ("labels overlap for a frame while digging"). The node just opened moves as
   one piece now. Sampled during the glide: no two lines of the section stand over each other. */
module.exports = {
  parts: ['threads', 'shared'],
  name: 'Digging three levels in Relations draws no line over another while it glides',
  from: '20 Nov: the hand tests of 0.4.7 and 0.4.10',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.reset(box, { width: 700 });   // the owner's window, where the fault was seen
    await T.go(page, 'Chase Checking'); await T.still(page); await T.sleep(1200);
    const box_ = '#main-content-container .th-two-way';
    // The path the fault was seen on by hand: the Gas bill row, its Bill value (Gas bill), then that bill's Charged by (SoCalGas).
    const dig = async (label, last = false) => page.evaluate(([sel, label, last]) => {
      const root = document.querySelector(sel); if (!root) return false;
      const scope = last ? root.querySelector('.th-ol-kids[data-key]') : root;   // the Bill value inside the row just opened
      const chev = [...(scope?.querySelectorAll('.th-chev[data-dig][aria-expanded="false"]') || [])].find(c => c.getClientRects().length && c.getAttribute('aria-label') === label);
      if (!chev) return false;
      chev.scrollIntoView({ block: 'center' }); chev.click(); return true;
    }, [box_, label, last]);
    const close = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(500); } };
    if (!(await dig('Open Gas bill'))) { await T.reset(box); return { ok: false, said: 'no Gas bill row to open on Chase Checking' }; }
    await T.sleep(2000);
    if (!(await dig('Open Gas bill', true))) { await close(); await T.reset(box); return { ok: false, said: 'the Gas bill row has no Bill value to dig into' }; }
    await T.sleep(2000);
    // The third dig, watched frame by frame while it glides.
    const seen = await page.evaluate(async ([sel]) => {
      const root = document.querySelector(sel);
      const chev = [...root.querySelectorAll('.th-chev[data-dig][aria-expanded="false"]')].find(c => c.getClientRects().length && c.getAttribute('aria-label') === 'Open SoCalGas');
      if (!chev) return { none: true };
      chev.scrollIntoView({ block: 'center' }); chev.click();
      const worst = { n: 0, what: '' };
      for (let f = 0; f < 30; f++) {
        await new Promise(r => requestAnimationFrame(r));
        const lines = [...root.querySelectorAll('.th-ol-line, .th-ol-prop, .th-ol-bullet')].filter(el => el.getClientRects().length && +getComputedStyle(el).opacity > .2 && el.textContent.trim());   // an empty line (the one to write in) shows only a faint dot
        const rects = lines.map(el => [el, el.getBoundingClientRect()]).filter(([, r]) => r.height > 4 && r.height < 60 && r.bottom > 0 && r.top < innerHeight);   // what is on screen: rows far below may pass each other unseen
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const [a, ra] = rects[i], [b, rb] = rects[j];
          if (a.contains(b) || b.contains(a)) continue;
          const dy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top), dx = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          if (dy > 6 && dx > 20) { worst.n++; if (!worst.what) worst.what = `“${a.textContent.trim().slice(0, 20)}” over “${b.textContent.trim().slice(0, 20)}”`; }
        }
      }
      return worst;
    }, [box_]);
    await T.sleep(800); await close(); await T.reset(box);
    if (seen.none) return { ok: false, said: 'the Gas bill has no SoCalGas to dig into' };
    if (seen.n) return { ok: false, said: `while the third level opened, ${seen.what} (${seen.n} times in 30 frames)` };
    return { ok: true, said: 'the third level glides in with no line over another' };
  },
};
