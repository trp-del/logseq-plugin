#!/usr/bin/env node
/* node hostile-text.js   Goalpost line 1.7 (words in a note are only shown, never acted on), in the checks' own Logseq (9333).
   Writes bullets holding text that would run if any screen put it on the page as markup, then shows them where the plugin
   draws a note's words (its own page with the Outline, Linked, Find, Todo, the export window) and says whether anything ran.
   Works on a throwaway copy only (refuses a graph not named "ZZ ..."); the pages it makes go to the Recycle by their ids. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, graph } = await require('./kit').connect();   // refuses any graph but a copy made for the checks, and guards the Mac
  const frame = page.frames().find(f => f.url().includes('logseq-plugin'));
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  const BAD = [
    '<img src=x onerror="window.__ran=1;parent.__ran=1">',
    '<svg onload="window.__ran=1;parent.__ran=1"></svg>',
    '<script>window.__ran=1;parent.__ran=1</script>',
    '"><b onmouseover="window.__ran=1">bold</b>',
    '[press](javascript:window.__ran=1)',
    '<a href="javascript:window.__ran=1">link</a>',
    '<iframe srcdoc="<script>parent.__ran=1</script>"></iframe>',
  ];
  const made = await frame.evaluate(async bad => {
    const name = 'ZZ hostile ' + Date.now();
    const pg = await logseq.Editor.createPage(name, {}, { redirect: false });
    const notes = [];
    await logseq.Editor.appendBlockInPage(pg.uuid, '# ' + bad[0]);
    for (const b of bad) await logseq.Editor.appendBlockInPage(pg.uuid, b + ' about [[Dr. Mei Chen]] zzhostile');
    const task = await logseq.Editor.appendBlockInPage(pg.uuid, bad[0] + ' zzhostile task');
    try { const t = await logseq.Editor.getPage('Task'); await logseq.Editor.addBlockTag(task.uuid, t.uuid); await logseq.Editor.upsertBlockProperty(task.uuid, 'logseq.property/status', 'Todo'); } catch (e) { notes.push('task: ' + e.message); }
    const named = await logseq.Editor.createPage('ZZ <img src=x onerror="parent.__ran=1;window.__ran=1"> page', {}, { redirect: false });
    await logseq.Editor.appendBlockInPage(pg.uuid, 'see [[' + (named.title || named.name) + ']] and [[Dr. Mei Chen]]');
    return { name, page: pg.uuid, named: named.uuid, notes };
  }, BAD);
  const ran = async where => {
    const a = await page.evaluate(() => window.__ran || 0), b = await frame.evaluate(() => window.__ran || 0).catch(() => 0);
    const raw = await page.evaluate(() => [...document.querySelectorAll('img[onerror], svg[onload], [onmouseover], a[href^="javascript:"], iframe[srcdoc]')].filter(e => /__ran/.test(e.outerHTML)).map(e => e.outerHTML.slice(0, 80) + ' in ' + String(e.parentElement?.className || '').slice(0, 50)).slice(0, 4));
    return { where, ran: !!(a || b), drawnAsMarkup: raw };
  };
  const results = [];
  const go = async n => { await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), n); await sleep(3500); };
  await go(made.name); results.push(await ran('its own page, with the Outline'));
  await go('Dr. Mei Chen'); await sleep(1000);
  const row = await page.$('.th-two-way >> text=zzhostile');
  if (row) { await row.hover().catch(() => {}); await sleep(1500); }
  results.push({ ...(await ran('Linked on Dr. Mei Chen')), rowShown: !!row, linkedSays: await page.evaluate(() => (document.querySelector('.th-two-way')?.innerText.match(/[^\n]*zzhostile[^\n]*/g) || []).slice(0, 3)) });
  await page.keyboard.press('Meta+k'); await sleep(900); await page.keyboard.type('zzhostile', { delay: 40 }); await sleep(2500);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await sleep(1500);
  results.push({ ...(await ran('Find, typed, a row dug')), findSays: await page.evaluate(() => (document.body.innerText.match(/[^\n]*zzhostile[^\n]*/g) || []).slice(0, 3)) });
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await sleep(150); }
  await page.evaluate(() => document.querySelector('.lk-tool[title="Todo"]')?.click()); await sleep(3000);
  results.push({ ...(await ran('Todo')), listed: await page.evaluate(() => /zzhostile task/.test(document.body.innerText)) });
  await go(made.name);
  await frame.evaluate(() => { try { window.DbExport?.app?.exportWindow?.(); } catch (e) {} }); await sleep(3500);
  results.push(await ran('the export window'));
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(200); }
  const removed = await frame.evaluate(async m => [await window.PluginDoor.write.deletePage(m.named).catch(e => 'error ' + e.message), await window.PluginDoor.write.deletePage(m.page).catch(e => 'error ' + e.message)], made);
  console.log(JSON.stringify({ made: made.name, notes: made.notes, results, dialogs, removed }, null, 1));
  const ranOn = results.filter(r => r.ran).length;
  require('./kit').result({ '1.7': { ok: results.length >= 5 && !ranOn && !dialogs.length, said: ranOn || dialogs.length ? `text in a note was acted on, on ${ranOn} screen(s)` : `a note holding text that would run as code was shown on ${results.length} screens and only ever shown` } });
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(2); });
