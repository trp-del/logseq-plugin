#!/usr/bin/env node
/* node todo-twice.js   Goalpost lines 1.2, 1.6 and 5.3 on Todo, in the checks' own Logseq (9333), on a throwaway copy only.
   By real keys and clicks: a todo is added with Enter pressed twice in a row (one must be added, not two); its circle is set to
   Done by the menu; the Undo arrow puts it back; the add itself is undone. The graph is compared before and after, fact by fact. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SKIP = ['block/created-at', 'block/updated-at', 'block/tx-id'];
(async () => {
  const { browser, page, graph } = await require('./kit').connect();   // refuses any graph but a copy made for the checks, and guards the Mac
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const print = () => require('./kit').fingerprint(page);
  const count = words => page.evaluate(async w => (await window.logseq.api.datascript_query(`[:find ?b :where [?b :block/title ?t] [(= ?t "${w}")] (not [?b :logseq.property/deleted-at])]`)).length, words);
  const before = await print();
  // The Todo page (its route; since 17 November 2026 the toolbar button opens Todo in the right sidebar, and the page stays on the command palette).
  await page.evaluate(() => { location.hash = '#/todo'; }); await sleep(2500);
  const WORDS = 'ZZ twice check ' + Date.now();
  const out = [];
  const box = await page.$('#main-content-container input[placeholder*="todo" i], #main-content-container .td-add input, #main-content-container input');
  if (!box) throw new Error('no add line found on the Todo page');
  await box.click(); await page.keyboard.type(WORDS, { delay: 15 });
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(2500);
  out.push(['Enter twice adds one todo', await count(WORDS), 'expected 1']);
  const row = page.locator('#main-content-container').getByText(WORDS).first();
  out.push(['the new todo is listed', await row.count() > 0, 'expected true']);
  const undoShown = await page.evaluate(() => !!document.querySelector('.lk-undo'));
  out.push(['an Undo arrow shows after the add', undoShown, 'expected true']);
  // set it Done by its circle, then Undo that
  const circle = await page.evaluateHandle(w => { const r = [...document.querySelectorAll('#main-content-container *')].find(e => e.children.length === 0 && e.textContent.trim() === w); let row = r; for (let i = 0; i < 6 && row; i++) { const c = row.querySelector?.('.lk-status, [data-status]'); if (c && !c.contains(r)) return c; row = row.parentElement; } return null; }, WORDS);
  const el = circle.asElement();
  if (el) {
    await el.click(); await sleep(700);
    const done = page.locator('.lk-menu').getByText('Done', { exact: true }).first();
    if (await done.count()) { await done.click(); await sleep(1800); }
    const status = () => page.evaluate(async w => { const r = await window.logseq.api.datascript_query(`[:find ?s :where [?b :block/title ?t] [(= ?t "${w}")] [?b :logseq.property/status ?st] [?st :block/title ?s]]`); return r.flat().join(','); }, WORDS);
    out.push(['Done picked from the circle\'s list', await status(), 'expected Done']);
    const arrow = page.locator('.lk-undo').first();
    if (await arrow.count()) { await arrow.click(); await sleep(1500); out.push(['its Undo puts the status back', await status(), 'expected Todo']); } else out.push(['its Undo arrow', 'none shown', 'expected an arrow']);
  } else out.push(['the status circle', 'not found', '']);
  // take the test todo away again by its id, whatever the Undo left
  const left = await page.evaluate(async w => { const r = await window.logseq.api.datascript_query(`[:find ?u :where [?b :block/title ?t] [(= ?t "${w}")] [?b :block/uuid ?u]]`); for (const [u] of r) await window.logseq.api.remove_block(String(u)); return r.length; }, WORDS);
  await sleep(1200);
  const after = await print();
  const diff = []; for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diff.push(((after[k] || before[k]).find(f => f.startsWith('block/title ')) || k).slice(0, 70) + ' | now: ' + (after[k] || []).filter(f => !(before[k] || []).includes(f)).slice(0, 3).join('; ').slice(0, 120));
  for (const o of out) console.log((String(o[1]) === String(o[2]).replace('expected ', '') ? 'ok   ' : 'LOOK ') + o[0] + ': ' + o[1] + ' (' + o[2] + ')');
  console.log('removed ' + left + ' test bullet(s); graph differs in ' + diff.length + ' node(s) from before' + (diff.length ? ':\n  ' + diff.slice(0, 6).join('\n  ') : ''));
  console.log('console errors: ' + errors.length + (errors.length ? ' ' + errors[0] : ''));
  const good = out.every(o => String(o[1]) === String(o[2]).replace('expected ', '')), mine = errors.filter(e => !/net::ERR_/.test(String(e)));
  require('./kit').result({ '1.6': { ok: good && !diff.length && !mine.length, said: good && !diff.length ? 'Enter pressed twice adds one todo, a circle pressed twice ends where one press does, and Undo leaves the graph as it was' : `a repeated press doubled or lost a change: ${out.filter(o => String(o[1]) !== String(o[2]).replace('expected ', '')).map(o => o[0]).join('; ') || diff.length + ' notes differ after Undo'}` } });
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(2); });
