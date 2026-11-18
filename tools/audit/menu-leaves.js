#!/usr/bin/env node
/* node menu-leaves.js <out dir> [label]   Goalpost lines 4.1 and 2.2 (the 0.4 gallery check's find, 17 November 2026).
   An Ontology right-click menu, opened on a tag's line on Provider's page, is let go when you go to another page, by a press
   outside it, and by Escape wherever the keyboard is; and it never stands past the window's edge, at a small window too.
   Read-only: nothing in the menu is pressed. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'menu-leaves'), label = process.argv[3] || 'now'; fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const lines = []; const say = (ok, w) => lines.push(`${ok ? 'ok  ' : 'FAIL'} ${w}`);
  const menu = () => page.evaluate(() => { const m = [...document.querySelectorAll('.st-menu')].find(e => e.getBoundingClientRect().width > 0); if (!m) return null; const r = m.getBoundingClientRect(); return { right: Math.round(r.right), bottom: Math.round(r.bottom), vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight }; });
  const open = async () => { const line = page.locator('.ont[data-prop]').first(); await line.scrollIntoViewIfNeeded(); const b = await line.boundingBox(); await page.mouse.click(b.x + b.width - 10, b.y + b.height / 2, { button: 'right' }); await sleep(600); return menu(); };
  for (const [w, h] of [[1582, 978], [900, 650]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(500);
    await go(page, 'Provider', 3000);
    if (!await page.locator('.ont[data-prop]').count()) { say(false, `no line for a tag on Provider's page at ${w} wide`); continue; }
    let m = await open();
    say(!!m && m.right <= m.vw && m.bottom <= m.vh, m ? `${w} wide: the menu stands inside the window (its right edge at ${m.right} of ${m.vw}, its foot at ${m.bottom} of ${m.vh})` : `${w} wide: no menu opened`);
    await page.screenshot({ path: path.join(out, `menu-${w}-${label}.png`) });
    await page.mouse.click(5, h - 5); await sleep(500);
    say(!(await menu()), `${w} wide: a press outside the menu closes it`);
    await open(); await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Escape'); await sleep(500);
    say(!(await menu()), `${w} wide: Escape closes it, with the keyboard outside Ontology`);
    await open(); await go(page, 'Consultation', 3000);
    await page.screenshot({ path: path.join(out, `next-page-${w}-${label}.png`) });
    say(!(await menu()), `${w} wide: on the next page (Consultation) the menu is not there`);
  }
  await page.setViewportSize({ width: 1582, height: 978 });
  const noise = ours(said); if (noise.length) say(false, 'the console said ' + noise[0].text.slice(0, 140));
  for (const l of lines) console.log(l);
  const ok = lines.every(l => l.startsWith('ok'));
  const first = (lines.find(l => l.startsWith('FAIL')) || '').slice(5);
  const verdict = ok ? 'Ontology\'s right-click menu stays inside the window at both sizes, and goes with a press outside, with Escape, and on the next page' : first;
  await finish(browser, { '4.1': { ok, said: verdict }, '2.2': { ok, said: verdict } });   // 2.2: nothing left open on the next page
})().catch(fail);
