/* The owner, 19 November 2026, asking for the review that found it: "like I can go in find real quick to check something but also
   change a property". A node opened in Find showed its properties to read and nothing to change. Since 0.4.1 it is Relations' own
   opened node there (the owner, of that proposal: "ok this is good"; "the relations part is the non-negotiable part"). */
module.exports = {
  parts: ['find', 'threads', 'shared'],
  name: 'A node opened in Find can be changed there: a press beside a value opens its list inside the window',
  from: '19 Nov: “I can go in find real quick to check something but also change a property”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Dr. Mei Chen'); await T.sleep(1200);
    await page.keyboard.press('Meta+k'); await T.sleep(900);
    await page.keyboard.type('cons', { delay: 50 }); await T.sleep(700);
    await page.keyboard.press('Tab'); await T.sleep(1200);
    await page.keyboard.press('ArrowRight'); await T.sleep(2800);
    const drawn = await page.evaluate(() => { const h = document.querySelector('dialog[open] [data-th-node]'); return { holder: !!h, props: h ? h.querySelectorAll('.th-ol-prop').length : 0, bullets: h ? h.querySelectorAll('.th-ol-bullet').length : 0 }; });
    const done = async verdict => { for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } return verdict; };
    if (!drawn.holder) return done({ ok: false, said: 'the opened row has no place for Relations’ node' });
    if (!drawn.props) return done({ ok: false, said: 'the node opened in Find shows no property to change' });
    // A press in the value's area, beside what it holds, as on a page.
    const at = await page.evaluate(() => { const pv = [...document.querySelectorAll('dialog[open] [data-th-node] .th-ol-prop > .th-ol-pv')].find(el => el.querySelector('.th-tw-record')); const r = pv?.getBoundingClientRect(); return r ? { x: r.right - 14, y: r.top + r.height / 2 } : null; });
    if (!at) return done({ ok: false, said: 'no value that points at a page stands in the opened node' });
    await page.mouse.click(at.x, at.y); await T.sleep(1000);
    const list = await page.evaluate(() => { const pop = [...document.querySelectorAll('[popover]')].find(p => p.matches(':popover-open')); return pop ? { inside: !!pop.closest('dialog[open]'), rows: pop.querySelectorAll('.th-lsq-list > *').length, keyboard: pop.contains(document.activeElement) } : null; });
    await page.keyboard.press('Escape'); await T.sleep(300);
    const still = await page.evaluate(() => !!document.querySelector('dialog[open].fd'));
    if (!list) return done({ ok: false, said: 'a press beside a value in Find opens no list' });
    if (!list.inside) return done({ ok: false, said: 'the list of values opens outside Find’s window, where it cannot be pressed' });
    if (!list.keyboard) return done({ ok: false, said: 'the list of values does not take the keyboard' });
    if (!still) return done({ ok: false, said: 'Escape in the list closed Find as well' });
    return done({ ok: true, said: `${drawn.props} properties and ${drawn.bullets} bullets to change; the list of values opens inside the window` });
  },
};
