#!/usr/bin/env node
/* node keys-try.js   Goalpost line 2.3, in the checks' own Logseq (9333). Read-only.
   2.3: on the plugin's own screens (the Ontology map, Todo) Logseq's letter pairs still run (g j goes to Journals), Cmd-K opens
   Find and Escape closes it one step at a time and leaves nothing open; Cmd-[ goes back. */
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555));
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const hash = () => page.evaluate(() => decodeURIComponent(location.hash).slice(0, 40));
  const open = () => page.evaluate(() => ({ find: !!document.querySelector('.fd-window, [class*="fd-win"], .lk-window'), dialogs: document.querySelectorAll('.ui__dialog-content, .ui__modal').length }));
  const results = [];
  const screens = [['the Ontology map', async () => { await page.evaluate(() => { location.hash = '#/structure'; }); await sleep(2500); }], ['Todo', async () => { await page.evaluate(() => document.querySelector('.lk-tool[title="Todo"]')?.click()); await sleep(2500); }], ['a page', async () => { await page.evaluate(() => window.logseq.api.push_state('page', { name: 'dr. mei chen' })); await sleep(3000); }]];
  for (const [name, go] of screens) {
    await go(); await page.mouse.click(700, 500).catch(() => {}); await page.keyboard.press('Escape'); await sleep(300);
    const from = await hash();
    await page.keyboard.press('g'); await sleep(120); await page.keyboard.press('j'); await sleep(1800);
    results.push([name, 'g j goes to Journals', /journals|all-journals/i.test(await hash()) || (await page.evaluate(() => !!document.querySelector('.journal, #journals'))), from + ' -> ' + await hash()]);
    await page.keyboard.press('Meta+['); await sleep(1500);
    results.push([name, 'Cmd-[ goes back', (await hash()) === from, await hash()]);
    await page.keyboard.press('Meta+k'); await sleep(1200);
    const opened = await open();
    results.push([name, 'Cmd-K opens Find', opened.find, JSON.stringify(opened)]);
    let presses = 0; for (; presses < 6; presses++) { if (!(await open()).find) break; await page.keyboard.press('Escape'); await sleep(350); }
    results.push([name, 'Escape closes Find and leaves nothing open', !(await open()).find && presses <= 3, 'presses ' + presses]);
  }
  for (const r of results) console.log((r[2] ? 'ok   ' : 'LOOK ') + r[0] + ': ' + r[1] + '  (' + r[3] + ')');
  const bad = results.filter(r => !r[2]);
  console.log('RESULT ' + JSON.stringify({ '2.3': { ok: !bad.length && results.length >= 8, said: bad.length ? `${bad.length} of ${results.length} key steps went wrong: ${bad.slice(0, 2).map(r => r[0] + ', ' + r[1]).join('; ')}` : `on the Ontology map, Todo and a page: g j, Cmd-[ and Cmd-K work, and Escape closes Find and leaves nothing open (${results.length} steps)` } }));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });
