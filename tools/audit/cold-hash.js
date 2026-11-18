#!/usr/bin/env node
/* node cold-hash.js   In the checks' own Logseq right after it started: in a new bullet on a throwaway page, words then “#” are typed,
   and the time from the “#” key to the screen being still for 120 ms is measured, three times. Plugin on or off as it is. The
   page goes again by its id. */
const { connect, sleep, fail } = require('./kit');
(async () => {
  const { browser, page, frame } = await connect();
  const on = await page.evaluate(() => { const p = window.LSPluginCore.registeredPlugins.get('logseq-plugin'); return !!p && !p.disabled; });
  const made = await page.evaluate(async () => { const p = await window.logseq.api.create_page('ZZ cold hash ' + Date.now(), {}, { redirect: true }); return String(p.uuid); });
  await sleep(2500);
  const times = [];
  for (let i = 0; i < 3; i++) {
    const b = await page.evaluate(async u => { const b = await window.logseq.api.append_block_in_page(u, ''); await window.logseq.api.edit_block(String(b.uuid)); return String(b.uuid); }, made);
    await sleep(800);
    await page.keyboard.type('saw the doctor ', { delay: 40 }); await sleep(600);
    const t0 = Date.now(); await page.keyboard.type('#');
    const settled = await page.evaluate(() => new Promise(res => { let last = performance.now(); const start = last; const mo = new MutationObserver(() => { last = performance.now(); }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); const wait = () => { if (performance.now() - last > 120) { mo.disconnect(); res(Math.round(last - start)); } else requestAnimationFrame(wait); }; requestAnimationFrame(wait); }));
    times.push(Date.now() - t0 - 120);
    await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500);
  }
  await page.evaluate(async u => { await window.logseq.api.delete_page(u).catch(() => {}); }, made);
  console.log(`plugin ${on ? 'on' : 'off'}: “#” to a still screen, three times: ${times.join(', ')} ms`);
  await browser.close();
})().catch(fail);
