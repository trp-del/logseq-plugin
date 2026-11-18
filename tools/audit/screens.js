#!/usr/bin/env node
/* node screens.js <out dir>   Goalpost lines 4.1, 4.2, 4.4 and 4.7, in the checks' own Logseq (9333).
   Shows each screen of the plugin in light and dark at two window sizes, photographs it (the gallery), and reads from the screen:
   what stands past the window's edge, words cut off, words too faint to read, strong blue in words, and the text sizes in use.
   Read-only: opens, types into Find's box only, closes what it opened. */
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OWN = '[class*="lk-"],[class*="th-"],[class*="st-"],[class*="fd-"],[class*="td-"],[class*="xp-"],[class*="sw-"],[class*="sp-"]';
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555));
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const frame = page.frames().find(f => f.url().includes('logseq-plugin'));
  const cdp = await page.context().newCDPSession(page);
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const go = async n => { await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), n); await sleep(3000); };
  const esc = async () => { for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await sleep(120); } };
  const SCREENS = [
    ['page-person', async () => go('Dr. Mei Chen'), null],
    ['page-tag', async () => go('Consultation'), null],
    ['page-property', async () => go('Provider'), null],
    ['page-journal', async () => go('Oct 23rd, 2026'), null],
    ['ontology-map', async () => { await page.evaluate(() => { location.hash = '#/structure'; }); await sleep(3000); }, null],
    ['todo', async () => { await page.evaluate(() => document.querySelector('.lk-tool[title="Todo"]')?.click()); await sleep(2500); }, null],
    ['find-open', async () => { await go('Dr. Mei Chen'); await page.keyboard.press('Meta+k'); await sleep(1500); }, esc],
    ['find-typed', async () => { await page.keyboard.press('Meta+k'); await sleep(900); await page.keyboard.type('cons', { delay: 60 }); await sleep(1500); }, esc],
    ['settings', async () => { await frame.evaluate(() => { const w = window.PluginSettings || window.SettingsWindow; try { (w?.open || window.PluginDoor?.openSettings)?.(); } catch (e) {} }); await sleep(600); if (!(await page.$('.sw-window, .lk-window'))) { await page.keyboard.press('g'); await page.keyboard.press(','); } await sleep(2000); }, esc],
    ['export', async () => { await go('Dr. Mei Chen'); await frame.evaluate(() => { try { window.DbExport?.app?.exportWindow?.(); } catch (e) {} }); await sleep(3500); }, esc],
    ['key-sheet', async () => { await page.keyboard.down('Alt'); await sleep(1100); await page.keyboard.up('Alt'); await sleep(700); }, esc],
  ];
  const read = () => page.evaluate(OWN => {
    const W = innerWidth, H = innerHeight, vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && r.bottom > 0 && r.top < H; };
    const rgb = c => { let m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[, /]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; } m = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/); return m ? { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : Number(m[4]) } : null; };   // color-mix() computes to color(srgb …)
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bgOf = el => { let over = []; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { over.push(c); if (c.a >= .99) break; } } let base = { r: 255, g: 255, b: 255 }; const rootBg = rgb(getComputedStyle(document.body).backgroundColor); if (rootBg && rootBg.a > 0) base = rootBg; for (const c of over.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
    const name = el => (el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className).trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70);
    const past = [], cut = [], faint = [], blue = [], sizes = {}; let own = 0;
    for (const el of document.querySelectorAll(OWN)) {
      if (!vis(el)) continue; own++;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (r.right > W + 1 || r.left < -1) past.push(name(el) + ' right ' + Math.round(r.right) + ' of ' + W);
      const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      if (!text) continue;
      // A button that cannot be pressed yet keeps its faint look (the owner, 17 November 2026, shown three readable ways: “Now”).
      if (el.closest('.waits, .off, :disabled, [aria-disabled="true"]')) continue;
      sizes[s.fontSize] = (sizes[s.fontSize] || 0) + 1;
      if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') cut.push(name(el) + ' “' + text.slice(0, 30) + '”');
      const fg = rgb(s.color); if (!fg) continue;
      const bg = bgOf(el), mix = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
      const eff = Number(s.opacity) < 1 ? { r: mix.r * s.opacity + bg.r * (1 - s.opacity), g: mix.g * s.opacity + bg.g * (1 - s.opacity), b: mix.b * s.opacity + bg.b * (1 - s.opacity) } : mix;
      const L1 = lum(eff), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (ratio < 3) faint.push(ratio.toFixed(1) + ' ' + name(el) + ' “' + text.slice(0, 30) + '”');
      if (mix.b > mix.r + 50 && mix.b > mix.g + 25) blue.push(name(el) + ' “' + text.slice(0, 24) + '”');
    }
    const uniq = a => [...new Set(a)];
    return { own, past: uniq(past).slice(0, 8), cut: uniq(cut).slice(0, 8), faint: uniq(faint).slice(0, 10), blue: uniq(blue).slice(0, 8), sizes, sideways: document.documentElement.scrollWidth > W, wrong: /Something went wrong/.test(document.body.innerText) };
  }, OWN);
  const results = [];
  for (const mode of ['light', 'dark']) {
    await page.evaluate(m => window.logseq.api.set_theme_mode(m), mode); await sleep(1200);
    for (const [w, h] of [[1582, 978], [900, 650]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(700);
      for (const [name, open, close] of SCREENS) {
        try { await open(); } catch (e) { results.push({ mode, w, name, error: String(e).slice(0, 120) }); continue; }
        const got = await read().catch(e => ({ error: String(e).slice(0, 120) }));
        const file = `${mode}-${w}-${name}.png`;
        await page.screenshot({ path: path.join(out, file) }).catch(() => {});
        results.push({ mode, w, name, file, ...got });
        if (close) await close();
      }
    }
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride'); await page.evaluate(() => window.logseq.api.set_theme_mode('light'));
  fs.writeFileSync(path.join(out, 'screens.json'), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 1));
  const bad = k => results.filter(r => (r[k] || []).length).length;
  console.log(`${results.length} screens photographed; past the edge on ${bad('past')}, words cut on ${bad('cut')}, faint words on ${bad('faint')}, blue words on ${bad('blue')}, page scrolls sideways on ${results.filter(r => r.sideways).length}, errors opening ${results.filter(r => r.error).length}, console errors ${errors.length}`);
  for (const r of results) if (r.mode === 'light') console.log(` ${r.w} ${r.name.padEnd(14)} own ${String(r.own ?? '-').padStart(4)} past ${(r.past || []).length} cut ${(r.cut || []).length} faint ${(r.faint || []).length} blue ${(r.blue || []).length} sizes ${Object.keys(r.sizes || {}).join(' ')}`);
  const mine = errors.filter(e => !/net::ERR_/.test(e)), first = k => { const r = results.find(r => (r[k] || []).length); return r ? `${r.name} (${r.mode}, ${r.w} wide): ${r[k][0]}` : ''; };
  const n = results.length, opened = results.filter(r => !r.error).length;
  require('./kit').result({
    '4.1': { ok: opened === n && !bad('past') && !bad('cut'), said: bad('past') || bad('cut') ? `something stands past the window's edge on ${bad('past')} of ${n} screens and words are cut off on ${bad('cut')}: ${first('past') || first('cut')}` : `${n} screens: nothing past the window's edge, no words cut off` },
    '4.2': { ok: opened === n && !results.some(r => r.sideways || r.wrong) && !mine.length, said: opened < n ? `${n - opened} screens did not open` : results.some(r => r.sideways) ? `the page scrolls sideways on ${results.filter(r => r.sideways).length} screens: first ${results.find(r => r.sideways).name} at ${results.find(r => r.sideways).w} wide` : `${n} screens open in light and dark at 1582 and 900 wide, none scrolls sideways` },
    '4.4': { ok: opened === n && !bad('faint') && !bad('blue'), said: bad('faint') || bad('blue') ? `words too faint to read on ${bad('faint')} of ${n} screens, strong blue words on ${bad('blue')}: ${first('faint') || first('blue')}` : `${n} screens: no word under 3 to 1 against its ground, no stray blue` },
  });
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(2); });
