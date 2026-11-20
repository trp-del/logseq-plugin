/* The owner, 20 November 2026, of the breadcrumb in Relations' digging: "Where is the short line line that is supposed to be under
   Gas bill bullet?". Each breadcrumb line after the first has a short guide line hanging from the bullet above it; the band of the
   line cut it away, so it was never drawn. The case builds two breadcrumb lines in a Relations section and checks that the short
   line is drawn and that nothing cuts it away. */
module.exports = {
  parts: ['threads'],
  name: 'The breadcrumb shows a short line under each bullet but the last',
  from: '20 Nov: “Where is the short line line that is supposed to be under Gas bill bullet?”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box;
    await T.sleep(800);
    const seen = await page.evaluate(() => {
      const tw = document.createElement('div');
      tw.className = 'th-two-way';
      tw.innerHTML = '<div class="th-tw-bcwrap" style="--th-bcs: 2"><div class="th-tw-bcs">'
        + '<div class="th-tw-bc" style="--th-bc: 0"><span class="lk-bul"></span><span class="th-tw-bc-name">One</span></div>'
        + '<div class="th-tw-bc th-tw-bc-here" style="--th-bc: 1"><span class="lk-bul"></span><span class="th-tw-bc-name">Two</span></div>'
        + '</div></div>';
      (document.querySelector('#main-content-container') || document.body).appendChild(tw);
      const [a, b] = tw.querySelectorAll('.th-tw-bc');
      const line = getComputedStyle(b, '::before'), band = getComputedStyle(b);
      const bul = a.querySelector('.lk-bul').getBoundingClientRect(), r = b.getBoundingClientRect();
      const out = { drawn: line.content !== 'none' && parseFloat(line.borderLeftWidth) > 0 && parseFloat(line.height) > 0,
        cut: band.overflow !== 'visible' || band.overflowX !== 'visible',
        off: Math.abs(r.left + parseFloat(line.left) + parseFloat(line.borderLeftWidth) / 2 - (bul.left + bul.width / 2)) };
      tw.remove();
      return out;
    });
    if (!seen.drawn) return { ok: false, said: 'a breadcrumb line has no short line under the bullet above it' };
    if (seen.cut) return { ok: false, said: 'the breadcrumb line’s band cuts away the short line under the bullet above it' };
    if (seen.off > 1) return { ok: false, said: `the short line stands ${seen.off.toFixed(1)}px beside the bullet above it` };
    return { ok: true, said: 'each breadcrumb line hangs a short line from the bullet above it' };
  },
};
