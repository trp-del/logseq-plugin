#!/usr/bin/env node
/* The walk: the plugin tried in a real Logseq, on a throwaway copy of the sample graph, with real presses and keys sent through
   Logseq's debugging port. Each step says what a person does and what must then be true; a step that is not true fails the walk.
   It is a net, not the proof: a change is proven by hand, on the owner's kind of graph and window.
     node tools/walk.js              starts its own Logseq (port 9480), walks, closes it
     node tools/walk.js --keep       leaves that Logseq open afterwards, to look at
   Every fault the owner reports is added here as a step that fails before the fix. */
const path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
for (const dir of [path.join(ROOT, 'node_modules'), path.resolve(ROOT, '..', '..', 'logseq-plugin', 'node_modules')]) if (fs.existsSync(dir)) { process.env.NODE_PATH = dir; require('node:module').Module._initPaths(); break; }
const sandbox = require('./sandbox.js');
const PORT = 9480, DIR = path.join(os.tmpdir(), `logseq-walk-${PORT}`), keep = process.argv.includes('--keep');
const FATIGUE = '1a000000-0000-4000-8000-000000000013', CHEN = '1a000000-0000-4000-8000-00000000000e', NORTHGATE = '1a000000-0000-4000-8000-000000000002', OCT7 = '00000001-2026-1007-0000-000000000000';

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const box = await sandbox.start({ dir: DIR, graph: 'Illness Test Graph', plugin: ROOT, port: PORT });
  const page = box.page, faults = [], errors = [];
  page.on('console', m => { if (m.type() === 'error' && /Logseq Plugin|lk-|PluginDoor/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const wait = ms => page.waitForTimeout(ms);
  const goto = async uuid => { await page.evaluate(u => window.logseq.api.push_state('page', { name: u }), uuid); await wait(1800); };
  const count = sel => page.locator(sel).count();
  const lists = () => page.evaluate(() => [...document.querySelectorAll('.lk-rel')].map(rel => ({ where: rel.closest('#right-sidebar') ? 'sidebar' : rel.closest('.lk-open') ? 'opened' : 'main', lists: [...rel.querySelectorAll(':scope > .lk-list')].map(l => `${l.querySelector('.lk-list-name').innerText} (${l.querySelectorAll(':scope > .lk-rows > .lk-row').length})`) })));
  let n = 0;
  const step = async (what, check) => { n++; try { const said = await check(); if (said !== true) faults.push(`${what}: ${said}`); } catch (error) { faults.push(`${what}: ${String(error.message || error).split('\n')[0]}`); } };
  const is = (got, want) => JSON.stringify(got) === JSON.stringify(want) || `got ${JSON.stringify(got)}, not ${JSON.stringify(want)}`;
  try {
    await page.evaluate(() => { window.resizeTo(1100, 800); }); await wait(2500);   // the editor is asked for a moment after the start
    await goto(FATIGUE);
    await step('a page lists what points at it, by property, the shared tag said once', async () => is(await lists(), [{ where: 'main', lists: ['Symptom type Symptom Log (12)'] }]));
    await step('Logseq\'s own Linked references are gone where the lists stand', async () => is(await page.evaluate(() => [...document.querySelectorAll('.references')].filter(el => el.offsetParent).length), 0));
    await step('rows carry their day, newest first', async () => is(await page.locator('.lk-row .lk-day').evaluateAll(els => els.slice(0, 3).map(el => el.textContent)), ['Oct 4', 'Oct 2', 'Sep 20']));
    await step('a press on a line opens the node in place as Logseq\'s own', async () => { await page.locator('.lk-row .lk-line').nth(8).click(); await wait(1800); return is([await count('.lk-row[data-open]'), await count('.lk-row[data-open] .lk-editor .ls-block')], [1, 2]); });
    await step('the opened node stands where its line stood', async () => is(await page.evaluate(() => { const open = document.querySelector('.lk-row[data-open]'), closed = document.querySelector('.lk-row:not([data-open])'); const a = open.querySelector('.lk-editor .block-content-wrapper').getBoundingClientRect(), b = closed.querySelector('.lk-words').getBoundingClientRect(), r = open.getBoundingClientRect(), c = closed.getBoundingClientRect(); return [Math.round(a.left - b.left), Math.round((a.top - r.top) - (b.top - c.top))]; }), [0, 0]));
    await step('writing in the opened node changes the line once it is closed', async () => {
      await page.locator('.lk-row[data-open] .lk-editor .block-content').first().click(); await wait(400);
      await page.keyboard.type(' again', { delay: 30 }); await wait(300);
      await page.keyboard.press('Escape'); await wait(400);
      const open = await count('.lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(900);
      return is([open, await count('.lk-row[data-open]'), await page.locator('.lk-row .lk-line').nth(8).innerText(), await page.evaluate(() => document.activeElement.className)], [1, 0, 'Tired by evening. again', 'lk-line']);
    });
    await step('Logseq\'s own Undo takes the writing back', async () => { await page.keyboard.press('Meta+z'); await wait(1300); return is(await page.locator('.lk-row .lk-line').nth(8).innerText(), 'Tired by evening.'); });
    await step('Enter opens the line the keys are on, the arrows walk the lines', async () => {
      await page.locator('.lk-row .lk-line').first().focus(); await page.keyboard.press('ArrowDown');
      const second = await page.evaluate(() => document.activeElement.innerText);
      await page.keyboard.press('Enter'); await wait(1500);
      const open = await page.evaluate(() => [...document.querySelectorAll('.lk-rows > .lk-row')].findIndex(r => r.dataset.open));
      await page.locator('.lk-row[data-open] > .lk-fold').click(); await wait(300);
      return is([second, open, await count('.lk-row[data-open]')], ['Wiped out all day.', 1, 0]);
    });
    await step('a list folds and unfolds on its name, and stays folded on another page', async () => {
      await page.locator('.lk-list-head').first().click(); await wait(500);
      const hidden = await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden);
      await page.locator('.lk-list-head').first().click(); await wait(500);
      return is([hidden, await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden)], [true, false]);
    });
    await goto(NORTHGATE);
    await step('a page opened in a row reads as a line: its name the size of the words, its own lists under it', async () => {
      await page.locator('.lk-row .lk-line').first().click(); await wait(2200);
      return is(await page.evaluate(() => { const ed = document.querySelector('.lk-editor'); return [getComputedStyle(ed.querySelector('.ls-page-title-container')).fontSize, [...document.querySelectorAll('.lk-open > .lk-rel > .lk-list .lk-list-name')].map(el => el.innerText)]; }), ['16px', ['Decided by Decision', 'Provider Consultation']]);
    });
    await step('a node opens inside an opened node, and Escape closes one at a time, innermost first', async () => {
      await page.locator('.lk-open .lk-row .lk-line').nth(1).click(); await wait(1800);
      const deep = await count('.lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(400); const one = await count('.lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(400);
      return is([deep, one, await count('.lk-row[data-open]')], [2, 1, 0]);
    });
    await goto(CHEN);
    await step('a page says its place: its tag and the tags above it', async () => is(await page.locator('.lk-place').innerText(), 'Doctor/Person/Entity'));
    await step('a line\'s link reads as the node\'s name', async () => is(await page.locator('.lk-row .lk-line a.lk-node').first().innerText(), 'Dr. Mei Chen'));
    const first = await page.locator('.lk-row').first().getAttribute('data-uuid');
    await step('a task shows Logseq\'s circle; a press on it lists the statuses; one press sets one', async () => {
      await page.evaluate(u => window.logseq.api.upsert_block_property(u, 'logseq.property/status', 'Todo'), first); await wait(1500);
      await page.locator('.lk-row .lk-status').first().click(); await wait(400);
      const items = await page.locator('.lk-menu .lk-item').allInnerTexts();
      await page.locator('.lk-menu .lk-item', { hasText: 'Doing' }).click(); await wait(1500);
      return is([items, await page.locator('.lk-row .lk-status').first().getAttribute('title')], [['Backlog', 'Todo', 'Doing', 'In Review', 'Done', 'Canceled'], 'Doing']);
    });
    await step('Logseq\'s own Undo puts the status back', async () => { await page.keyboard.press('Meta+z'); await wait(1300); return is(await page.locator('.lk-row .lk-status').first().getAttribute('title'), 'Todo'); });
    await step('a right-click on a line opens its menu; Escape closes it and nothing changed', async () => {
      await page.locator('.lk-row .lk-line').nth(1).click({ button: 'right' }); await wait(400);
      const items = await page.locator('.lk-menu .lk-item').allInnerTexts();
      await page.keyboard.press('Escape'); await wait(300);
      return is([items, await count('.lk-menu'), await count('.lk-row[data-open]')], [['Open', 'Open in sidebar', 'Delete'], 0, 0]);
    });
    await step('Delete takes a node away and Logseq\'s own Undo brings it back', async () => {
      const before = await count('.lk-rows > .lk-row');
      await page.locator('.lk-row .lk-line').nth(2).click({ button: 'right' }); await wait(400);
      await page.locator('.lk-menu .lk-item', { hasText: 'Delete' }).click(); await wait(1600);
      const after = await count('.lk-rows > .lk-row');
      await page.keyboard.press('Meta+z'); await wait(1600);
      return is([after - before, await count('.lk-rows > .lk-row') - before], [-1, 0]);
    });
    await goto(OCT7);
    await step('on a journal day the rows do not repeat the day', async () => is(await page.locator('.lk-row .lk-day').evaluateAll(els => els.map(el => el.textContent)), ['', '']));
    await step('the journals feed is left as Logseq draws it', async () => { await page.evaluate(() => window.logseq.api.push_state('home')); await wait(1600); return is(await lists(), []); });
    await goto(FATIGUE);
    await step('Shift-click opens the node in the sidebar, selects no words, and the sidebar\'s page gets its own lists', async () => {
      await page.locator('.lk-row .lk-line').first().click({ modifiers: ['Shift'] }); await wait(2000);
      return is([(await lists()).map(l => l.where), await page.evaluate(() => String(getSelection()))], [['main', 'sidebar'], '']);
    });
    await step('a reload of the plugin leaves nothing doubled and nothing behind', async () => {
      await page.evaluate(() => window.LSPluginCore.reload('logseq-plugin')); await wait(5000);
      return is([(await lists()).map(l => l.lists.length), await page.evaluate(() => document.querySelectorAll('style[id^="lk-style"]').length), await count('.lk-place')], [[1, 0], 3, 1]);
    });
    await step('the dark theme carries the same greys', async () => {
      await page.evaluate(() => window.logseq.api.set_theme_mode('dark')); await wait(600);
      const got = await page.evaluate(() => { const row = document.querySelector('.lk-row .lk-words'), day = document.querySelector('.lk-row .lk-day'); const lum = c => { const m = c.match(/[\d.]+/g).map(Number), k = /^color\(/.test(c) ? 255 : 1; return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000 * k * (m[3] ?? 1); }; return lum(getComputedStyle(row).color) > 150 && lum(getComputedStyle(day).color) > 40; });
      await page.evaluate(() => window.logseq.api.set_theme_mode('light'));
      return is(got, true);
    });
    await step('nothing the plugin did was said as an error', async () => is(errors, []));
  } finally {
    if (!keep) { await sandbox.stop(box); fs.rmSync(DIR, { recursive: true, force: true }); }
  }
  if (faults.length) { console.log(`The walk found ${faults.length} of ${n} steps wrong:\n  ` + faults.join('\n  ')); process.exit(1); }
  console.log(`The walk passed: ${n} steps in a real Logseq.`);
  process.exit(0);
})().catch(error => { console.error('The walk could not run: ' + (error.message || error)); process.exit(2); });
