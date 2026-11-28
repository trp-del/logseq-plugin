#!/usr/bin/env node
/* The walk: the plugin tried in a real Logseq, on a throwaway copy of the sample graph, with real presses and keys sent through
   Logseq's debugging port. Each step says what a person does and what must then be true; a step that is not true fails the walk.
   It is a net, not the proof: a change is proven by hand, on the owner's kind of graph and window.
     node tools/walk.js              starts its own Logseq (port 9480), walks, closes it
     node tools/walk.js --keep       leaves that Logseq open afterwards, to look at
     node tools/walk.js --stop       closes a Logseq a walk left open (--keep, or a walk that was cut short), and walks nothing
   A walk that cannot start closes the Logseq it began (tools/sandbox.js), so the next one finds its port free.
   Every fault the owner reports is added here as a step that fails before the fix. */
const path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
for (const dir of [path.join(ROOT, 'node_modules'), path.resolve(ROOT, '..', '..', 'logseq-plugin', 'node_modules')]) if (fs.existsSync(dir)) { process.env.NODE_PATH = dir; require('node:module').Module._initPaths(); break; }
const sandbox = require('./sandbox.js');
const PORT = 9480, DIR = path.join(os.tmpdir(), `logseq-walk-${PORT}`), keep = process.argv.includes('--keep'), stopOnly = process.argv.includes('--stop');
const FATIGUE = '1a000000-0000-4000-8000-000000000013', CHEN = '1a000000-0000-4000-8000-00000000000e', NORTHGATE = '1a000000-0000-4000-8000-000000000002', OCT7 = '00000001-2026-1007-0000-000000000000';

(async () => {
  if (stopOnly) {
    const was = !!(await sandbox.up(PORT));
    await sandbox.stop({ port: PORT, home: path.join(DIR, 'home') });   // ends only a Logseq started with this port and a profile folder of its own
    const still = !!(await sandbox.up(PORT));
    if (!still) fs.rmSync(DIR, { recursive: true, force: true });
    console.log(still ? `Something still answers on port ${PORT} and it is not a walk's Logseq: it was left alone.` : was ? `The walk's Logseq on port ${PORT} is closed and its copy removed.` : `No walk's Logseq was open on port ${PORT}.`);
    process.exit(still ? 1 : 0);
  }
  // Asked before the folder is emptied: a Logseq still running there would lose its graph under it.
  if (await sandbox.up(PORT)) throw new Error(`something already answers on port ${PORT}. If it is a Logseq a walk left open (--keep, or a walk that was cut short), close it with: node tools/walk.js --stop`);
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const box = await sandbox.start({ dir: DIR, graph: 'Illness Test Graph', plugin: ROOT, port: PORT });
  const page = box.page, faults = [], errors = [];
  page.on('console', m => { if (m.type() === 'error' && /Logseq Plugin|lk-|PluginDoor/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const wait = ms => page.waitForTimeout(ms);
  const goto = async uuid => { await page.evaluate(u => window.logseq.api.push_state('page', { name: u }), uuid); await wait(1800); };
  const count = sel => page.locator(sel).count();
  const lists = () => page.evaluate(() => [...document.querySelectorAll('.lk-rel')].map(rel => ({ where: rel.closest('#right-sidebar') ? 'sidebar' : rel.closest('.lk-open') ? 'opened' : 'main', lists: [...rel.querySelectorAll(':scope > .lk-list')].map(l => `${[l.querySelector('.lk-list-via').innerText, l.querySelector('.lk-list-name').innerText.replace(/\n?[A-Z][a-z]{2} \d+(, \d{4})? to [A-Z][a-z]{2} \d+(, \d{4})?$/, '')].filter(Boolean).join('\n')} (${l.querySelectorAll(':scope > .lk-rows > .lk-row').length})`) })));
  let n = 0;
  const step = async (what, check) => { n++; try { const said = await check(); if (said !== true) faults.push(`${what}: ${said}`); } catch (error) { faults.push(`${what}: ${String(error.message || error).split('\n')[0]}`); } };
  // A line's own words, without what Relations says after them (the value that tells nodes apart, what it lacks, where it sits).
  const lineWords = i => page.locator('.lk-row .lk-line').nth(i).evaluate(el => { const words = el.querySelector('.lk-words').cloneNode(true); words.querySelectorAll('.lk-tell, .lk-lacks, .lk-sits').forEach(one => one.remove()); return words.innerText.trim(); });
  const is = (got, want) => JSON.stringify(got) === JSON.stringify(want) || `got ${JSON.stringify(got)}, not ${JSON.stringify(want)}`;
  try {
    await page.evaluate(() => { window.resizeTo(1100, 800); }); await wait(2500);   // the editor is asked for a moment after the start
    await goto(FATIGUE);
    await step('a page lists what points at it, by property, the shared tag said once', async () => is(await lists(), [{ where: 'main', lists: ['Symptom type\nSymptom Log 12 (10)'] }]));   // one head for every list: the kind and its count, no span of days (the owner's marked page, 26 November 2026)
    await step('a list shows ten nodes, then "Show 2 more" shows them all', async () => { const more = page.locator('#main-content-container .lk-relpage .lk-more').first(), said = await more.innerText(); await more.click(); await wait(500); return is([said, await count('#main-content-container .lk-relpage > .lk-list > .lk-rows > .lk-row')], ['Show 2 more', 12]); });   // ten, the owner, 25 November 2026
    await step('Logseq\'s own Linked references are gone where the lists stand', async () => is(await page.evaluate(() => [...document.querySelectorAll('.references')].filter(el => el.offsetParent).length), 0));
    await step('a right-click on the word Relations is the plugin\'s own: Logseq\'s menu for the page, with Delete page, does not open', async () => {   // F135 of the rundown, 27 November 2026
      await page.locator('#main-content-container .lk-relhead').first().click({ button: 'right' }); await wait(900);
      const seen = text => page.evaluate(words => [...document.querySelectorAll('body *')].filter(el => el.children.length === 0 && el.textContent.trim() === words && el.offsetParent).length, text);
      const logseqs = await seen('Delete page'), mine = await count('.lk-menu') + await page.locator('.ui__toast', { hasText: 'No list is hidden' }).count();
      if (logseqs || await count('.lk-menu')) { await page.keyboard.press('Escape'); await wait(400); }
      return is([logseqs, mine > 0], [0, true]);
    });
    await step('rows carry their day, newest first', async () => is(await page.locator('.lk-row > .lk-day').evaluateAll(els => els.slice(0, 3).map(el => el.textContent)), ['Oct 4', 'Oct 2', 'Sep 20']));
    await step('a press on a line opens the node in place as Logseq\'s own', async () => { await page.locator('.lk-row .lk-line').nth(8).click(); await wait(1800); return is([await count('.lk-row[data-open]'), await count('.lk-row[data-open] .lk-editor .ls-block')], [1, 2]); });
    await step('the opened node stands where its line stood', async () => is(await page.evaluate(() => { const open = document.querySelector('.lk-row[data-open]'), closed = document.querySelector('.lk-row:not([data-open])'); const a = open.querySelector('.lk-editor .block-content-wrapper').getBoundingClientRect(), b = closed.querySelector('.lk-words').getBoundingClientRect(), r = open.getBoundingClientRect(), c = closed.getBoundingClientRect(); return [Math.round(a.left - b.left), Math.round((a.top - r.top) - (b.top - c.top))]; }), [0, 0]));
    await step('writing in the opened node changes the line once it is closed', async () => {
      await page.locator('.lk-row[data-open] .lk-editor .block-content').first().click(); await wait(400);
      await page.keyboard.type(' again', { delay: 30 }); await wait(300);
      await page.keyboard.press('Escape'); await wait(400);
      const open = await count('.lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(900);
      return is([open, await count('.lk-row[data-open]'), await lineWords(8), await page.evaluate(() => document.activeElement.className)], [1, 0, 'Tired by evening. again', 'lk-line']);
    });
    await step('Logseq\'s own Undo takes the writing back', async () => { await page.keyboard.press('Meta+z'); await wait(1300); return is(await lineWords(8), 'Tired by evening.'); });
    await step('Enter opens the line the keys are on, the arrows walk the lines', async () => {
      await page.locator('.lk-row .lk-line').first().focus(); await page.keyboard.press('ArrowDown');
      const second = await page.evaluate(() => { const words = document.activeElement.querySelector('.lk-words').cloneNode(true); words.querySelectorAll('.lk-lacks, .lk-sits, .lk-tell').forEach(el => el.remove()); return words.innerText.trim(); });
      await page.keyboard.press('Enter'); await wait(1500);
      const open = await page.evaluate(() => [...document.querySelectorAll('.lk-rows > .lk-row')].findIndex(r => r.dataset.open));
      await page.locator('.lk-row[data-open] > .lk-fold').click(); await wait(300);
      return is([second, open, await count('.lk-row[data-open]')], ['Wiped out all day.', 1, 0]);
    });
    await step('a list folds and unfolds on its arrow only, not on a press on its name', async () => {
      await page.locator('.lk-list-head .lk-list-via, .lk-list-head .lk-list-name').first().click(); await wait(500);
      const kept = await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden);
      await page.locator('.lk-list-head > .lk-fold').first().click(); await wait(500);
      const hidden = await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden);
      await page.locator('.lk-list-head > .lk-fold').first().click(); await wait(500);
      return is([kept, hidden, await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden)], [false, true, false]);
    });
    await goto(NORTHGATE);
    await step('a page opened in a row reads as a line: its name the size of the words, its own lists under it', async () => {
      await page.locator('.lk-row .lk-line').first().click(); await wait(2200);
      return is(await page.evaluate(() => { const ed = document.querySelector('.lk-editor'); return [getComputedStyle(ed.querySelector('.ls-page-title-container')).fontSize, [...document.querySelectorAll('.lk-open > .lk-rel > .lk-list > .lk-list-head')].map(el => [el.querySelector('.lk-list-via').innerText, el.querySelector('.lk-list-name').innerText.replace(/\n?[A-Z][a-z]{2} \d+(, \d{4})? to [A-Z][a-z]{2} \d+(, \d{4})?$/, '')].filter(Boolean).join('\n'))]; }), ['16px', ['Decided\nDecision 3', 'Provider of\nConsultation 2']]);
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
      return is([items, await count('.lk-menu'), await count('.lk-row[data-open]')], [['Open', 'Open in sidebar', 'Tags…', 'Delete'], 0, 0]);
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
    await step('a day in the journals feed has what points at it at its foot, and a day nothing points at shows nothing', async () => { await page.evaluate(() => window.logseq.api.push_state('home')); await wait(2500);
      const days = await page.evaluate(() => [...document.querySelectorAll('#main-content-container .lk-rel')].map(rel => [rel.querySelectorAll(':scope > .lk-list').length, rel.offsetHeight > 0]));
      return is([days.length > 0, days.every(([n, shown]) => (n > 0) === shown)], [true, true]); });
    await goto(FATIGUE);
    await step('Shift-click opens the node in the sidebar, selects no words, and the sidebar\'s page gets its own lists', async () => {
      await page.locator('.lk-row .lk-line').first().click({ modifiers: ['Shift'] }); await wait(2000);
      return is([(await lists()).map(l => l.where), await page.evaluate(() => String(getSelection()))], [['main', 'sidebar'], '']);
    });
    await step('a page in the sidebar lies flat on the page\'s ground and shows its place, its properties open and its Relations', async () => {   // the owner, 25 November 2026: "the sidebar is not correctlt styled like pre 0.9 version", "it should have full info like before too"
      const before = await count('#right-sidebar .sidebar-item');
      await page.evaluate(u => window.logseq.api.open_in_right_sidebar(u), CHEN); await wait(4000);
      const got = await page.evaluate(() => {
        const item = document.querySelector('#right-sidebar .sidebar-item.item-type-page'), look = getComputedStyle(item), box = item.querySelector('.ls-sidebar-page-properties'), clear = c => /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(c);
        return [look.boxShadow === 'none' && clear(look.backgroundColor) && clear(getComputedStyle(item.querySelector('.sidebar-item-header')).backgroundColor), clear(getComputedStyle(document.querySelector('#right-sidebar .cp__right-sidebar-inner')).backgroundColor) && clear(getComputedStyle(document.querySelector('#right-sidebar')).backgroundColor),
          !!item.querySelector('.lk-place')?.innerText.trim(), !(box.children.length === 1 && box.querySelector(':scope > div:first-child > button:only-child')), item.querySelectorAll('.lk-relwrap .lk-list').length > 0];
      });
      await page.locator('#right-sidebar .sidebar-item.item-type-page').first().locator('.item-actions button').last().click(); await wait(800);
      return is([got, await count('#right-sidebar .sidebar-item')], [[true, true, true, true, true], before]);
    });
    await step('a reload of the plugin leaves nothing doubled and nothing behind', async () => {
      await page.evaluate(() => window.LSPluginCore.reload('logseq-plugin')); await wait(5000);
      return is([(await lists()).map(l => l.lists.length), await page.evaluate(() => { const ids = [...document.querySelectorAll('style[id^="lk-style"]')].map(el => el.id); return ids.length - new Set(ids).size; }), await count('.lk-place')], [[1, 0], 0, 1]);
    });
    await step('the dark theme carries the same greys', async () => {
      await page.evaluate(() => window.logseq.api.set_theme_mode('dark')); await wait(600);
      const got = await page.evaluate(() => { const row = document.querySelector('.lk-row .lk-words'), day = document.querySelector('.lk-row .lk-day'); const lum = c => { const m = c.match(/[\d.]+/g).map(Number), k = /^color\(/.test(c) ? 255 : 1; return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000 * k * (m[3] ?? 1); }; return lum(getComputedStyle(row).color) > 150 && lum(getComputedStyle(day).color) > 40; });
      await page.evaluate(() => window.logseq.api.set_theme_mode('light'));
      return is(got, true);
    });
    // ---- Arriving: Search (the right sidebar, in place of Find; the owner, 26 November 2026)
    await goto(FATIGUE);
    await step('Cmd-K opens Search in the right sidebar with the keys in its line', async () => {
      await page.keyboard.press('Meta+k'); await wait(1500);
      return is(await page.evaluate(() => [document.getElementById('_sidebar.lk-search')?.textContent, document.activeElement?.closest('.lk-search') != null]), ['Search', true]);
    });
    await step('Search shows what holds every word first, each node once, grouped by kind, the typed letters marked', async () => {   // the owner's marked page, then their choice of Logseq's own answers after (26 November 2026)
      await page.keyboard.type('chen', { delay: 30 }); await wait(1500);
      const got = await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-search .lk-row')], holds = rows.map(r => /chen/i.test(r.querySelector('.lk-words').textContent)); return [rows.length > 0, holds[0], new Set(rows.map(r => r.dataset.uuid)).size === rows.length, document.querySelectorAll('.lk-search .lk-list-name').length > 1, rows.filter(r => { const w = r.querySelector('.lk-words').cloneNode(true); for (const el of w.querySelectorAll('.lk-sits')) el.remove(); return /chen/i.test(w.textContent); }).every(r => r.querySelector('mark.lk-hit'))]; });
      return is(got, [true, true, true, true, true]);
    });
    await step('a press on a found line goes to it in the main view; Escape empties the line', async () => {
      await page.locator('.lk-search .lk-row', { hasText: 'Dr. Mei Chen' }).first().locator('.lk-words').click(); await wait(1500);
      const went = await page.evaluate(() => location.hash.includes('1a000000-0000-4000-8000-00000000000e'));
      await page.locator('.lk-search .lk-field').focus(); await page.keyboard.press('Escape'); await wait(500);
      return is([went, await page.locator('.lk-search .lk-field').inputValue()], [true, '']);
    });
    // ---- The marked pictures of 25 and 26 November 2026, as steps
    await goto(CHEN);
    await step('Search as Find: nothing typed shows the kinds with counts and the pages opened last; letters light a kind, Tab takes it and its values show with counts; a value taken narrows', async () => {   // the owner's choices, 26 November 2026
      await page.locator('.lk-search .lk-field').focus(); await wait(1200);
      const bare = await page.evaluate(() => [/\d/.test(document.querySelector('.lk-search .lk-choice')?.textContent || ''), document.querySelector('.lk-search .lk-list-name')?.textContent]);
      await page.keyboard.type('cons', { delay: 30 }); await wait(1500);
      const lit = await page.evaluate(() => document.querySelector('.lk-search .lk-choice.lit')?.firstChild?.textContent);
      await page.keyboard.press('Tab'); await wait(1500);
      const lines = await page.evaluate(() => [...document.querySelectorAll('.lk-search .lk-choice-name')].map(el => el.textContent));
      await page.keyboard.type('mei', { delay: 30 }); await wait(1200);
      await page.keyboard.press('Tab'); await wait(1500);
      const after = await page.evaluate(() => [[...document.querySelectorAll('.lk-search-piece')].map(el => el.textContent), [...document.querySelectorAll('.lk-search .lk-row')].every(r => /Mei Chen/.test(r.textContent))]);
      for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await wait(400); }
      return is([...bare, lit, lines.includes('Provider') && lines.includes('When'), ...after], [true, 'Recently opened', 'Consultation', true, ['Consultation', 'ProviderDr. Mei Chen'], true]);
    });
    await step('a sentence typed in the one Search line reads a kind, a value and a time, and puts the near ones under Near', async () => {
      await page.locator('.lk-search .lk-field').focus(); await wait(300);
      await page.keyboard.type('Consultation with mei chen around Aug 2026', { delay: 20 }); await wait(2500);
      const got = await page.evaluate(() => [[...document.querySelectorAll('.lk-search-read small')].map(el => el.textContent), [...document.querySelectorAll('.lk-search .lk-list-name')].map(el => el.textContent).filter(Boolean), !document.querySelector('.lk-search .lk-time').hidden]);
      await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace'); await wait(800);
      // Search closed again, so the steps after it find their own rows (Search shows the pages opened last when empty).
      await page.locator('#right-sidebar .sidebar-item', { has: page.locator('.lk-search') }).first().locator('.item-actions button').last().click().catch(() => {}); await wait(800);
      return is(got, [['kind', 'Provider', 'when'], ['Near'], true]);
    });
    await step('a node dug into is named once, on its value, and never lists the node it was dug from', async () => {
      const row = page.locator('#main-content-container .lk-row', { hasText: 'Video call' }).first(), uuid = await row.getAttribute('data-uuid');
      await row.locator('.lk-words').click(); await wait(2200);
      await page.evaluate(() => { const a = [...document.querySelectorAll('#main-content-container .lk-editor .property-value-inner[data-type=node] a.page-ref')].pop(); const r = a.getBoundingClientRect(); a.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 3, clientY: r.top + 8 })); });
      await wait(2200);
      const got = await page.evaluate(u => [!document.querySelector('.lk-dugname'), document.querySelectorAll(`.lk-dugopen .lk-row[data-uuid="${u}"]`).length], uuid);
      await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(300);
      return is(got, [true, 0]);
    });
    await goto(CHEN);
    await step('the kinds at a list\'s head answer a press inside an opened node, a row\'s arrow goes again once it is closed, and its bullet goes to it', async () => {   // the owner, 26 November 2026: "this is not working. I'm clicking on these."
      const row = page.locator('#main-content-container .lk-relpage .lk-row').first(); await row.locator('.lk-words').click(); await wait(2200);
      await row.locator(':scope > .lk-fold').click(); await wait(500); await page.mouse.move(2, 2); await wait(300);
      const shown = await row.locator(':scope > .lk-fold').evaluate(el => getComputedStyle(el).opacity);
      await goto(NORTHGATE);
      await page.locator('#main-content-container .lk-relpage .lk-row .lk-words').first().click(); await wait(2500);
      const tab = page.locator('.lk-row > .lk-open .lk-tab[data-kind]:not([data-kind=""])').first(); let on = 'no kinds inside';
      if (await tab.count()) { await tab.click(); await wait(900); on = await page.locator('.lk-row > .lk-open .lk-tab.on[data-kind]:not([data-kind=""])').count() > 0; }
      await page.keyboard.press('Escape'); await wait(500);
      const target = page.locator('#main-content-container .lk-relpage .lk-row').first(), uuid = await target.getAttribute('data-uuid');
      await target.locator(':scope > .lk-line > .lk-bul').click(); await wait(1500);
      return is([shown, on === true || on, await page.evaluate(u => location.hash.includes(u), uuid)], ['0', true, true]);
    });
    await goto(FATIGUE);
    await step('a list folded lets go of the kind it was narrowed to', async () => {
      const list = page.locator('#main-content-container .lk-list:has(.lk-tab[data-kind]:not([data-kind=""]))').first();
      if (!(await list.count())) return is('no list with kinds on this page', 'a list with kinds');
      await list.locator('.lk-tab[data-kind]:not([data-kind=""])').first().click(); await wait(500);
      const on = await list.locator('.lk-tab.on').count();
      await list.locator('.lk-list-head .lk-fold').click(); await wait(400); await list.locator('.lk-list-head .lk-fold').click(); await wait(600);
      return is([on, await list.locator('.lk-tab.on').count()], [1, 0]);
    });
    await step('a notice is a capsule at the bottom centre, goes after four seconds and stays while pointed at', async () => {   // the owner, 27 November 2026: "can you add the capsule notification ... back instead of rectangle in corner"
      const say = () => box.frame().evaluate(() => { window.logseq.UI.showMsg('A notice for the check', 'warning'); }), toast = page.locator('.ui__toast', { hasText: 'A notice for the check' });
      await page.mouse.move(5, 300); await say(); await wait(900);
      const at = await toast.evaluate(el => { const r = el.getBoundingClientRect(); return [Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2, Math.round(innerHeight - r.bottom), r.width < 360, parseFloat(getComputedStyle(el).borderTopLeftRadius) > r.height / 2]; });
      await wait(4500); const gone = await toast.count();
      await say(); await wait(900); await toast.hover(); await wait(4800); const held = await toast.count();
      await page.mouse.move(5, 300); await wait(5000);
      return is([at, gone, held, await toast.count()], [[true, 48, true, true], 0, 1, 0]);
    });
    // ---- Arriving: Todo
    await step('Cmd-Shift-P opens the corner\'s commands, in the corner at one size while words narrow them, and again lets go', async () => {   // the owner, 26 November 2026: "make it have a set height and not shrink"
      const box = () => page.evaluate(() => { const m = document.querySelector('.lk-menu'); if (!m) return null; const r = m.getBoundingClientRect(); return [Math.round(innerWidth - r.right), Math.round(innerHeight - r.bottom), Math.round(r.height), !!document.querySelector('.cp__cmdk')]; });
      await page.keyboard.press('Meta+Shift+p'); await wait(700); const open = await box();
      await page.keyboard.type('show', { delay: 30 }); await wait(400); const narrowed = await box();
      await page.keyboard.press('Meta+Shift+p'); await wait(400);
      return is([open?.slice(0, 2), open?.[3], narrowed, await box()], [[12, 12], false, open, null]);
    });
    await step('every command of the plugin has a line in Logseq\'s keyboard settings, those without a key too', async () => {   // 27 November 2026: "add plugin features to that keyboard shortcuts"
      const want = await box.frame().evaluate(() => window.PluginDoor.touch.commands().map(one => one.name).sort());
      const got = await page.evaluate(() => (window.logseq.api.get_state_from_store('command-palette/commands') || []).filter(one => /\/lk-/.test(one.id) && one.shortcut != null).map(one => String(one.id).split('/').pop()).sort());
      return is([want.length > 10, got], [true, want]);
    });
    await step('words no command has light the first note found, said with its icon, its tag at the right and the page it is on underneath, each to be pressed', async () => {   // 27 November 2026: Enter offered a new page though notes were found
      await page.keyboard.press('Meta+Shift+p'); await wait(600); await page.keyboard.type('chen', { delay: 60 }); await wait(1200);
      return is(await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-menu .lk-found-line.lk-item')], bullet = rows.find(r => r.querySelector('.lk-bul') && r.querySelector('.lk-sits'));
        return [rows[0].classList.contains('lit'), document.querySelectorAll('.lk-menu .lk-item.lit').length, rows.some(r => r.querySelector('.lk-found-first > a.lk-tag[data-to]')?.textContent === 'Doctor' && !r.querySelector('.lk-sits')), !!bullet?.querySelector('.lk-sits a.lk-step[data-to]') && !/^on /.test(bullet.querySelector('.lk-sits').textContent)]; }), [true, 1, true, true]);
    });
    await step('a tap on Shift looks at the lit line beside the list, the arrows move the look, a capital does not open it, Escape closes it first', async () => {   // 27 November 2026: "hit shift when something is highlighted ... like a quicklooks"
      const look = () => page.evaluate(() => { const p = document.querySelector('.lk-peek'), m = document.querySelector('.lk-menu'); if (!p || p.hidden) return null; const node = p.querySelector('.lk-peeked.whole'); return [node?.dataset.node, !!node?.querySelector('.ls-block') && !p.querySelector('.lk-relhead, .lk-rel'), p.getBoundingClientRect().right <= m.getBoundingClientRect().left]; });
      await page.keyboard.press('Shift'); await wait(1800); const one = await look();
      await page.keyboard.press('ArrowDown'); await wait(1800); const two = await look();
      await page.keyboard.press('Escape'); await wait(400); const shut = [await look(), await count('.lk-menu')];
      await page.keyboard.type('X', { delay: 30 }); await wait(900); const capital = await look();
      await page.keyboard.press('Escape'); await wait(400);
      return is([one?.slice(1), two?.slice(1), !!one && one[0] !== two?.[0], shut, capital, await count('.lk-menu')], [[true, true], [true, true], true, [null, 1], null, 0]);
    });
    await step('a right-click on a line of Logseq\'s menu offers Hide and takes nothing; Plugin settings brings the line back', async () => {   // the owner, 26 November 2026: "bring back a simple settings and a hide menu items"
      const dots = async () => { await page.locator('.toolbar-dots-btn').first().click(); await wait(800); }, line = () => page.locator('.ui__dropdown-menu-content [role=menuitem]', { hasText: 'Import' });
      await dots(); await line().click({ button: 'right' }); await wait(500); await page.locator('.lk-menu .lk-item', { hasText: 'Hide' }).click(); await wait(700);
      await page.keyboard.press('Escape'); await wait(400); await dots(); const hidden = await line().filter({ visible: true }).count(); await page.keyboard.press('Escape'); await wait(400);
      const hash = await page.evaluate(() => location.hash);
      await page.keyboard.press('Meta+Shift+p'); await wait(600); await page.keyboard.type('plugin settings', { delay: 20 }); await wait(500); await page.keyboard.press('Enter'); await wait(1500);
      await page.locator('.lk-set-line', { hasText: 'Import' }).locator('[data-back]').click(); await wait(900); const left = await count('.lk-set-page [data-back]');
      await page.evaluate(h => { location.hash = h; }, hash); await wait(1500); await dots(); const back = await line().filter({ visible: true }).count(); await page.keyboard.press('Escape'); await wait(400);
      return is([hidden, left, back], [0, 0, 1]);
    });
    await step('the corner opens Todo in the sidebar, under its own name', async () => {
      await page.locator('.lk-corner > button').click({ force: true }); await wait(400);
      await page.locator('.lk-menu .lk-item', { hasText: /^Todo$/ }).click(); await wait(2200);
      return is([await page.evaluate(() => document.getElementById('_sidebar.lk-todo')?.textContent), await count('.lk-todo .lk-field')], ['Todo', 1]);
    });
    await step('a task past its day stands under Overdue, its day red, and Today holds only today', async () => {   // the owner's marked page, 26 November 2026
      return is(await page.evaluate(() => { const lists = [...document.querySelectorAll('.lk-todo .lk-list')], named = n => lists.find(l => l.querySelector('.lk-list-name')?.innerText === n);
        const late = named('Overdue'), today = named('Today');
        return [!!late, !!late && [...late.querySelectorAll('.lk-row')].every(r => r.querySelector(':scope > .lk-day.lk-late')), !today || ![...today.querySelectorAll('.lk-day.lk-late')].length]; }), [true, true, true]);
    });
    await step('a task typed in its line lands on today\'s journal as a Todo and shows under Any time', async () => {
      await page.locator('.lk-todo .lk-field').click(); await page.keyboard.type('Ring the pharmacy', { delay: 20 }); await page.keyboard.press('Enter'); await wait(2200);
      return is(await page.evaluate(() => [...document.querySelectorAll('.lk-todo .lk-list')].filter(l => l.querySelector('.lk-list-name').innerText === 'Any time').map(l => [...l.querySelectorAll('.lk-line')].map(el => el.innerText.split('\n')[0]).filter(t => t === 'Ring the pharmacy').length)), [1]);   // the line's first row: under it the task says where it sits
    });
    await step('once a task is added the list is whole again, and the task carries one day: no journal under its words', async () => {   // typing narrows the list; adding must not leave it narrowed
      return is(await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-todo .lk-row')], mine = rows.find(r => r.querySelector('.lk-words')?.firstChild?.textContent.trim() === 'Ring the pharmacy'); return [rows.length > 1, !!mine?.querySelector('.lk-sits')?.textContent.trim(), document.querySelector('.lk-todo .lk-field').value]; }), [true, false, '']);
    });
    await step('a day said in a new task\'s words becomes its deadline and leaves the words', async () => {   // the owner chose this old part, 26 November 2026
      await page.locator('.lk-todo .lk-field').click(); await page.keyboard.type('Water the ferns tomorrow', { delay: 20 }); await wait(300);
      const hint = await page.locator('.lk-todo .lk-todo-hint').innerText();
      await page.keyboard.press('Enter'); await wait(2400);
      const got = await page.evaluate(() => [...document.querySelectorAll('.lk-todo .lk-list')].filter(l => l.querySelector('.lk-list-name').innerText === 'Coming up').map(l => [...l.querySelectorAll('.lk-row')].filter(r => r.querySelector('.lk-line').innerText.split('\n')[0] === 'Water the ferns').map(r => !!r.querySelector(':scope > .lk-day').textContent.trim())).flat());
      return is([hint.length > 5, got], [true, [true]]);
    });
    await step('a task opened from its line keeps its bullet, status circle and words where they stood', async () => {   // the owner, 27 November 2026: "the status icon shifts"
      const row = page.locator('.lk-todo .lk-row', { hasText: 'Ring the pharmacy' });
      const stand = () => row.evaluate(el => { const root = el.querySelector(el.dataset.open ? ':scope > .lk-open > .lk-editor .block-main-container' : ':scope > .lk-line'), base = el.getBoundingClientRect();
        const at = r => [Math.round(r.x + r.width / 2 - base.x), Math.round(r.y + r.height / 2 - base.y)];
        const walk = document.createTreeWalker(root.querySelector(el.dataset.open ? '.block-title-wrap' : '.lk-words'), NodeFilter.SHOW_TEXT); let words; while ((words = walk.nextNode()) && !words.textContent.trim()); const range = document.createRange(); range.setStart(words, 0); range.setEnd(words, 4);
        return [at(root.querySelector(el.dataset.open ? '.bullet-container .bullet' : '.lk-bul').getBoundingClientRect()), at(root.querySelector(el.dataset.open ? '.block-left.positioned-properties svg' : '.lk-status svg').getBoundingClientRect()), at(range.getBoundingClientRect())]; });
      const closed = await stand();
      await row.locator(':scope > .lk-line').focus(); await page.keyboard.press('ArrowRight'); await wait(3000);
      const open = await stand();
      await row.locator(':scope > .lk-line').focus(); await page.keyboard.press('Escape'); await wait(700);
      return is(open, closed);
    });
    await step('a status with an icon picked in Logseq stands at the circles\' size on the line, and the bullet keeps its size opened', async () => {   // the owner, 27 November 2026: "Errorrs with size. also when unfolded, bullet that gets unfolded jumps"
      const pick = icon => page.evaluate(async icon => { const [[picked]] = await window.logseq.api.datascript_query('[:find (pull ?s [:block/uuid]) :where [?s :block/title "In Review"] [?s :block/closed-value-property ?p] [?p :db/ident :logseq.property/status]]'); await window.logseq.api.upsert_block_property(picked.uuid, 'logseq.property/icon', icon); }, icon);
      const row = page.locator('.lk-todo .lk-row', { hasText: 'Ring the pharmacy' });
      const give = async status => { await row.locator('.lk-status').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: status }).click(); await wait(1800); };
      await pick({ type: 'tabler-icon', id: 'CircleArrowUpRight', name: 'CircleArrowUpRight', color: 'inherit' }); await wait(2500);
      await give('In Review');
      const looks = () => row.evaluate(el => { const open = el.dataset.open, root = el.querySelector(open ? ':scope > .lk-open > .lk-editor .block-main-container' : ':scope > .lk-line');
        const icon = root.querySelector(open ? '.block-left.positioned-properties :is(svg, i.ti):not(.iconTablerExtPriorityLvlHigh)' : '.lk-status :is(svg, i.ti)'), box = icon?.getBoundingClientRect(), bul = root.querySelector(open ? '.bullet-container .bullet' : '.lk-bul');
        return [box && Math.round(box.width), box && Math.round(box.height), icon && getComputedStyle(icon).color, parseFloat(getComputedStyle(bul, open ? null : '::before').width).toFixed(1)]; });
      const closed = await looks();
      await row.locator(':scope > .lk-line').focus(); await page.keyboard.press('ArrowRight'); await wait(3000);
      const open = await looks();
      await row.locator(':scope > .lk-line').focus(); await page.keyboard.press('Escape'); await wait(700);
      await give('Todo');
      return is([closed.slice(0, 2), open[3]], [[18, 18], closed[3]]);   // Logseq draws nothing in an opened node for an icon set by a script: its colour opened is tried by hand
    });
    await step('a task set Done from its circle leaves the list', async () => {
      const row = page.locator('.lk-todo .lk-row', { hasText: 'Ring the pharmacy' });
      await row.locator('.lk-status').click(); await wait(400);
      await page.locator('.lk-menu .lk-item', { hasText: 'Done' }).click(); await wait(2000);
      return is(await page.locator('.lk-todo .lk-row', { hasText: 'Ring the pharmacy' }).count(), 0);
    });
    await step('Todo does not say Task on every row, and still lists the tasks after the plugin is loaded again', async () => {
      const tags = await page.locator('.lk-todo .lk-row .lk-tag').allInnerTexts();
      await page.evaluate(() => window.LSPluginCore.reload('logseq-plugin')); await wait(5500);
      const rows = await count('.lk-todo .lk-row');
      await page.locator('.lk-todo .lk-row .lk-line').first().click(); await wait(1800);   // it still answers a press: the row opens
      const open = await count('.lk-todo .lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(400);
      return is([tags.includes('Task'), await page.evaluate(() => document.getElementById('_sidebar.lk-todo')?.textContent), rows > 0, open, await count('.lk-todo .lk-row[data-open]')], [false, 'Todo', true, 1, 0]);
    });
    // ---- Tending: Ontology
    await step('the corner opens Ontology as a page of its own: each top tag an area, side by side', async () => {
      await page.locator('.lk-corner > button').click({ force: true }); await wait(400);
      await page.locator('.lk-menu .lk-item', { hasText: /^Ontology$/ }).click(); await wait(3000);
      const areas = await page.evaluate(() => [...document.querySelectorAll('.lk-map > .lk-rel > .lk-list[data-face="tag"]')].map(l => [l.querySelector('.lk-row .lk-words').innerText, Math.round(l.getBoundingClientRect().top)]));
      await page.locator('.lk-map .lk-row', { hasText: /^Consultation/ }).first().locator('.lk-num').click(); await wait(500);   // a press beside the name selects the tag
      const joined = await page.evaluate(() => { const paths = [...document.querySelectorAll('.lk-map .lk-joins path')]; return [paths.length > 0, paths.every(p => getComputedStyle(p).strokeOpacity === '0.5' && getComputedStyle(p).fill === 'none' && !/L/.test(p.getAttribute('d')))]; });   // the old Ontology's hairlines: one a pair, quiet grey, no heads (the owner, 25 November 2026)
      return is([await page.evaluate(() => location.hash.split('?')[0]), await page.locator('.lk-page-title').innerText(), areas.length > 1, areas[0][0], areas.length > 1 && areas[0][1] === areas[1][1], joined], ['#/lk-ontology', 'Ontology', true, 'Entity', true, [true, true]]);
    });
    await step('Properties is the table it was before the rebuild: Property, On tags, Holds, Filled, least filled first; a press on a column\'s name sorts by it', async () => {   // the owner, 26 November 2026: "I like before version"
      await page.locator('.lk-map .lk-onto-tabs [data-tab="props"]').click(); await wait(2000);
      const table = () => page.evaluate(() => [[...document.querySelectorAll('.lk-map .lk-th')].map(th => th.innerText.replace(/\n/g, ' ')), [...document.querySelectorAll('.lk-map .lk-trow')].slice(0, 2).map(row => [...row.querySelectorAll('.lk-td')].map(td => td.innerText.trim()))]);
      const first = await table();
      await page.locator('.lk-map .lk-th', { hasText: 'Property' }).click(); await wait(300);
      const byName = await table();
      await page.locator('.lk-map .lk-th', { hasText: 'Property' }).click(); await wait(300);
      const back = (await table())[0];
      await page.locator('.lk-map .lk-onto-tabs [data-tab="tags"]').click(); await wait(1500);
      return is([first, byName, back], [[['Property', 'On tags', 'Holds', 'Filled ↑'], [['Side Effects', 'Pharmacological Agent', 'Symptom', '2 of 6'], ['Notes', 'Person', 'words', '6 of 12']]],
        [['Property ↑', 'On tags', 'Holds', 'Filled'], [['Agent', 'Treatment', 'Pharmacological Agent', '3 of 3'], ['Confirmation Status', 'Cancer', 'a choice', '1 of 1']]], ['Property ↓', 'On tags', 'Holds', 'Filled']]);
    });
    await step('In the sidebar, on that page, opens the outline beside whatever you read: the tabs, then the tags in their own face', async () => {
      await page.locator('.lk-map > .lk-side').click(); await wait(2500); await goto(CHEN);   // the outline beside a page, the page of its own left behind
      
      return is(await page.evaluate(() => { const lists = [...document.querySelectorAll('.lk-ontology > .lk-rel > .lk-list')]; const first = lists[0]?.querySelectorAll('.lk-row'); return [[...document.querySelectorAll('.lk-ontology > .lk-onto-tabs > .lk-tab')].map(t => t.innerText.trim()), lists.length, [...(first || [])].slice(0, 3).map(r => [r.querySelector('.lk-line').innerText, r.style.getPropertyValue('--lk-depth')]), /New York|serif/.test(getComputedStyle(first[0].querySelector('.lk-words')).fontFamily)]; }),
        [['Tags', 'Properties', 'History'], 1, [['Entity\n24', '0'], ['Organization\n5', '1'], ['Hospital\n3', '2']], true]);
    });
    await step('nothing opens under a tag in Ontology: a press beside its name selects it, a press on the name goes to its page', async () => {   // the owner, 25 November 2026
      const row = page.locator('.lk-ontology .lk-row', { hasText: /^Hospital/ }).first();
      await row.locator('.lk-num').click(); await wait(600);
      const chosen = [await page.locator('.lk-ontology .lk-row.lk-chosen .lk-words').allInnerTexts(), await count('.lk-ontology .lk-row[data-open]'), await count('.lk-ontology .lk-editor')];
      await row.locator('.lk-words').click(); await wait(2500);
      const title = await page.evaluate(() => document.querySelector('#main-content-container .ls-page-title')?.innerText || '');
      return is([chosen, /Hospital/.test(title), await count('.lk-ontology .lk-row[data-open]')], [[['Hospital'], 0, 0], true, 0]);
    });
    await step('Ontology\'s New tag line makes one of your own tags, and the list shows it', async () => {
      await page.locator('.lk-ontology .lk-field').click(); await page.keyboard.type('Zzontag', { delay: 20 }); await page.keyboard.press('Enter'); await wait(2500);
      const ident = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?i :where [?b :block/title "Zzontag"] [?b :block/tags :logseq.class/Tag] [?b :db/ident ?i]]')).flat().map(String));
      return is([ident.length === 1 && /user\.class\//.test(ident[0]), await page.locator('.lk-ontology .lk-row', { hasText: 'Zzontag' }).count(), await page.locator('.lk-ontology .lk-field').inputValue()], [true, 1, '']);
    });
    await step('a closed line\'s menu puts a tag on the node and takes it off again', async () => {
      const row = page.locator('.lk-todo .lk-row').first(), uuid = await row.getAttribute('data-uuid');
      const tags = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?tt :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?t] [?t :block/title ?tt]]`)).flat().sort(), uuid);
      const before = await tags();
      const pick = async () => { await page.locator(`.lk-todo .lk-row[data-uuid="${uuid}"] > .lk-line`).click({ button: 'right' }); await wait(500); await page.locator('.lk-menu .lk-item', { hasText: 'Tags…' }).click(); await wait(700); };
      await pick(); const head = await page.locator('.lk-menu .lk-group').innerText(); await page.locator('.lk-menu .lk-item', { hasText: /^Hospital$/ }).click(); await wait(1800);
      const set = await tags();
      await pick(); const on = await page.locator('.lk-menu .lk-item.on', { hasText: /^Hospital$/ }).count(); await page.locator('.lk-menu .lk-item', { hasText: /^Hospital$/ }).click(); await wait(1800);
      return is([head, set.includes('Hospital') && !before.includes('Hospital'), on, await tags()], ['Tags', true, 1, before]);
    });
    // ---- Writing: sure values
    await goto(OCT7);
    const typed = await box.frame().evaluate(async u => (await logseq.Editor.appendBlockInPage(u, '')).uuid, OCT7);
    const holds = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?pn ?vt :where [?b :block/uuid #uuid "${u}"] [?b ?a ?v] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :block/title ?pn] [?v :block/title ?vt]]`)).map(r => r.join(': ')).sort(), typed);
    await step('a bullet typed with a link and a tag gets, on leaving it, what its words say for certain', async () => {
      await wait(600); await box.frame().evaluate(u => logseq.Editor.editBlock(u), typed); await wait(700);
      await page.keyboard.type('Quick word with [[Dr. Mei Ch', { delay: 50 }); await wait(700); await page.keyboard.press('Enter'); await wait(500);
      await page.keyboard.type(' #Consult', { delay: 50 }); await wait(700); await page.keyboard.press('Enter'); await wait(700);
      const before = await holds();
      await page.keyboard.press('Escape'); await wait(2500);
      return is([before, await holds()], [[], ['Date: Oct 7th, 2026', 'Provider: Dr. Mei Chen']]);
    });
    await step('Logseq\'s own Undo takes each value back, and a bullet left unchanged gets nothing', async () => {
      await page.keyboard.press('Meta+z'); await wait(700); await page.keyboard.press('Meta+z'); await wait(900);
      const undone = await holds();
      await box.frame().evaluate(u => logseq.Editor.editBlock(u), typed); await wait(700); await page.keyboard.press('Escape'); await wait(2200);
      return is([undone, await holds()], [[], []]);
    });
    await step('a web address typed without http:// is a link once its bullet is left, and Logseq\'s Undo takes that back', async () => {   // the owner, 26 November 2026
      const at = await box.frame().evaluate(async u => (await logseq.Editor.appendBlockInPage(u, '')).uuid, OCT7);
      const words = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?w :where [?b :block/uuid #uuid "${u}"] [?b :block/title ?w]]`)).flat()[0], at);
      await wait(600); await box.frame().evaluate(u => logseq.Editor.editBlock(u), at); await wait(700);
      await page.keyboard.type('Rates at vanguard.com, see notes.md', { delay: 40 });
      await page.keyboard.press('Enter'); await wait(900); await page.keyboard.press('Escape'); await wait(2000);   // left by Enter at once, as one types
      const made = await words(), links = await page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] a.external-link`)].map(a => [a.textContent, a.getAttribute('href')]), at);
      await page.keyboard.press('Meta+z'); await wait(1200);
      return is([made, links, await words()], ['Rates at [vanguard.com](https://vanguard.com), see notes.md', [['vanguard.com', 'https://vanguard.com']], 'Rates at vanguard.com, see notes.md']);
    });
    await step('a bullet with an address, gone back into at once and written on, keeps every letter and gets its link when it is next left', async () => {   // rundown-070, F67: the link was written over the letters typed since
      const at = await box.frame().evaluate(async u => (await logseq.Editor.appendBlockInPage(u, '')).uuid, OCT7);
      const words = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?w :where [?b :block/uuid #uuid "${u}"] [?b :block/title ?w]]`)).flat()[0], at);
      await wait(600); await box.frame().evaluate(u => logseq.Editor.editBlock(u), at); await wait(700);
      await page.keyboard.type('Fees at vanguard.com are', { delay: 40 });
      await page.keyboard.press('Escape'); await wait(80); await page.keyboard.press('Enter');   // out, and straight back in
      await page.keyboard.type(' lower now than last spring', { delay: 50 });   // written across the moment the link used to be made
      await wait(1500);
      const open = await page.evaluate(() => { const el = document.activeElement; return el?.tagName === 'TEXTAREA' ? el.value : null; });
      await page.keyboard.press('Escape'); await wait(2200);
      return is([open, await words()], ['Fees at vanguard.com are lower now than last spring', 'Fees at [vanguard.com](https://vanguard.com) are lower now than last spring']);
    });
    await step('a list of tags folds: its arrow hides the tags under a tag, and the next list keeps it folded', async () => {   // the owner, 26 November 2026
      const row = () => page.locator('.lk-menu .lk-item', { hasText: /^Organization$/ }), seen = () => page.locator('.lk-menu .lk-item:visible', { hasText: /^Hospital$/ }).count();
      const open = async () => { await box.frame().evaluate(async u => window.PluginDoor.line.pickTags({ x: 200, y: 120, from: window.PluginDoor.host().body }, u, true), typed); await wait(700); };
      await open(); const before = await seen(); await row().hover(); await row().locator('.lk-item-fold').click(); await wait(300);
      const folded = [await seen(), await row().getAttribute('aria-expanded')]; await page.keyboard.press('Escape'); await wait(300);
      await open(); const again = await seen(); await row().locator('.lk-item-fold').click(); await wait(300); const back = await seen(); await page.keyboard.press('Escape'); await wait(300);
      return is([before, folded, again, back], [1, [0, 'false'], 0, 1]);
    });
    await step('a node named exactly the words typed is found even when Logseq\'s own search misses it', async () => {   // the owner, 27 November 2026: "quick search could not even find a page with exact same name"
      const got = await box.frame().evaluate(async () => {
        const was = logseq.App.search; logseq.App.search = async () => ({ blocks: [] });
        try { return (await window.PluginDoor.read.search('HOSPITAL', 12)).map(node => node.words); } finally { logseq.App.search = was; }
      });
      return is([...new Set(got)], ['Hospital']);
    });
    await step('words typed in a list of tags keep each match under the tags it sits under, with the typed letters marked', async () => {   // the owner, 27 November 2026: "results in context and why results are even appearing"
      await box.frame().evaluate(async u => window.PluginDoor.line.pickTags({ x: 200, y: 120, from: window.PluginDoor.host().body }, u, true), typed); await wait(700);
      await page.keyboard.type('hosp', { delay: 60 }); await wait(500);
      const got = await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-menu .lk-item:not(.lk-item-make)')].filter(r => r.offsetParent);
        const row = name => rows.find(r => r.textContent.trim() === name);
        return [!!row('Organization'), row('Organization')?.classList.contains('lk-path'), [...(row('Hospital')?.querySelectorAll('mark.lk-hit') || [])].map(m => m.textContent), [...document.querySelectorAll('.lk-menu .lk-item.lit')].map(r => r.textContent.trim())]; });
      await page.keyboard.press('Escape'); await wait(300);
      return is(got, [true, true, ['Hosp'], ['Hospital']]);
    });
    await step('in a list of tags one highlight starts at the line a tag hangs from, and glides with the pointer to the next', async () => {   // the owner, 27 November 2026: "only extend to its vertical line"
      await box.frame().evaluate(async u => window.PluginDoor.line.pickTags({ x: 200, y: 120, from: window.PluginDoor.host().body }, u, true), typed); await wait(700);
      const read = name => page.evaluate(n => { const rows = [...document.querySelectorAll('.lk-menu .lk-item')], row = rows.find(r => r.textContent.trim() === n), glow = document.querySelector('.lk-menu .lk-glow').getBoundingClientRect(), at = row.getBoundingClientRect(), s = getComputedStyle(row);
        return [Math.round(glow.left - at.left) === Number(row.style.getPropertyValue('--lk-d')) * 29, Math.abs(glow.top - at.top) < 1, s.backgroundColor === 'rgba(0, 0, 0, 0)', document.querySelectorAll('.lk-menu .lk-item.lit').length]; }, name);
      const got = [];
      for (const name of ['Hospital', 'Organization']) { await page.locator('.lk-menu .lk-item', { hasText: new RegExp(`^${name}$`) }).hover(); await wait(400); got.push(await read(name)); }
      await page.keyboard.press('Escape'); await wait(300);
      // And with the arrows, in a list with no line to type in.
      await box.frame().evaluate(async u => window.PluginDoor.line.pickTags({ x: 200, y: 120, from: window.PluginDoor.host().body }, u), typed); await wait(700);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await wait(400);
      const keyed = await page.evaluate(() => { const glow = document.querySelector('.lk-menu .lk-glow'), at = document.activeElement.getBoundingClientRect(); return [glow.classList.contains('on'), Math.abs(glow.getBoundingClientRect().top - at.top) < 1]; });
      await page.keyboard.press('Escape'); await wait(300);
      return is([...got, keyed], [[true, true, true, 1], [true, true, true, 1], [true, true]]);
    });
    await step('a press under Tags in a table opens the tags as an outline, and a tag taken is on the node', async () => {   // the owner, 26 November 2026: "any table where the tag column is"
      const uuid = await box.frame().evaluate(async () => String((await logseq.DB.datascriptQuery('[:find ?u :where [?g :block/title "Provider"] [?g :block/tags :logseq.class/Property] [?g :block/uuid ?u]]'))[0][0]));
      await goto(uuid); await wait(2500);
      const at = await page.evaluate(() => { const t = [...document.querySelectorAll('.ls-table')].find(t => t.offsetParent); const i = [...t.querySelector('.ls-table-header > .flex-row:not(.sticky-columns)').children].findIndex(h => h.textContent.trim() === 'Tags'); const row = t.querySelector('.ls-table-row'), cell = row.querySelector(':scope > .flex-row:not(.sticky-columns)').children[i]; cell.scrollIntoView({ inline: 'center', block: 'center' }); const r = cell.getBoundingClientRect(); return { x: r.x + r.width - 12, y: r.y + r.height / 2, uuid: row.getAttribute('blockid') }; });
      const has = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?g] [?g :block/title ?t]]`)).flat().includes('Hospital'), at.uuid);
      await page.mouse.click(at.x, at.y); await wait(900);
      const shown = [await page.locator('.lk-menu.lk-menu-tree').count(), await page.locator('.cp__select').count()];
      await page.locator('.lk-menu .lk-item', { hasText: /^Hospital$/ }).click(); await wait(1500);
      const on = await has(); await page.keyboard.press('Meta+z'); await wait(1200);
      const got = [shown, on, await has()]; await goto(OCT7);   // back where the next steps write
      return is(got, [[1, 0], true, false]);
    });
    // ---- Writing: where a tag sits, and where a new tag goes
    const tagged = await box.frame().evaluate(async u => (await logseq.Editor.appendBlockInPage(u, '')).uuid, OCT7);
    await step('Logseq\'s own list of tags says where each tag sits', async () => {
      await wait(600); await box.frame().evaluate(u => logseq.Editor.editBlock(u), tagged); await wait(700);
      await page.keyboard.type('Scan #Hosp', { delay: 50 }); await wait(900);
      const where = await page.evaluate(() => [...document.querySelectorAll('.ui__popover-content a.menu-link')].filter(a => /^Hospital/.test(a.innerText)).map(a => a.querySelector('.lk-where')?.innerText));
      for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
      await wait(500);
      return is(where, ['Organization / Entity', 'Occurrence']);   // Hospital, and Hospitalization
    });
    await step('a tag made while writing asks where it goes: an arrow and Enter put it there, and the keys stay in the bullet', async () => {
      await page.keyboard.type('Zzward', { delay: 50 }); await wait(900); await page.keyboard.press('Enter'); await wait(1500);
      const head = await page.locator('.lk-menu .lk-group').innerText().catch(() => '');
      await page.keyboard.press('ArrowDown'); await wait(200);
      const lit = await page.locator('.lk-menu .lk-item.lit').innerText().catch(() => '');
      await page.keyboard.press('Enter'); await wait(1500);
      const placed = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?pt :where [?b :block/title "Zzward"] [?b :logseq.property.class/extends ?p] [?p :block/title ?pt]]')).flat());
      return is([head, lit !== '', placed.length === 1 && placed[0] === lit, await page.evaluate(() => document.activeElement?.tagName), await count('.lk-menu')], ['Zzward is a new tag. Put it under:', true, true, 'TEXTAREA', 0]);
    });
    await step('writing on is the answer no: the list goes and the letters land in the bullet', async () => {
      await page.keyboard.type(' #Zzbay', { delay: 50 }); await wait(900); await page.keyboard.press('Enter'); await wait(1500);
      const asked = await count('.lk-menu');
      await page.keyboard.type(' on', { delay: 50 }); await wait(400);
      const text = await page.evaluate(() => document.activeElement?.value || '');
      await page.keyboard.press('Escape'); await wait(800);
      return is([asked, await count('.lk-menu'), / on$/.test(text)], [1, 0, true]);
    });
    await step('plain words written with pauses are saved, and the graph is read neither for new pages nor for new tags at any of the saves', async () => {   // rundown-070, F75 and F148: every node, and every tag, read at every save
      const readings = () => box.frame().evaluate(() => { const R = window.PluginDoor.read; if (!R.lkWas) { R.lkWas = [R.newPages, R.tagIds]; R.lkCount = [0, 0]; R.newPages = (...all) => { R.lkCount[0]++; return R.lkWas[0](...all); }; R.tagIds = (...all) => { R.lkCount[1]++; return R.lkWas[1](...all); }; } const n = R.lkCount; R.lkCount = [0, 0]; return n; });
      await box.frame().evaluate(u => logseq.Editor.editBlock(u), tagged); await wait(700); await readings();
      for (const part of [' and the ward', ' was quiet', ' all night']) { await page.keyboard.type(part, { delay: 50 }); await wait(900); }
      const kept = await box.frame().evaluate(async u => String((await logseq.DB.datascriptQuery(`[:find ?w :where [?b :block/uuid #uuid "${u}"] [?b :block/title ?w]]`)).flat()[0]), tagged);
      const got = [await page.evaluate(() => document.activeElement?.tagName), / was quiet/.test(kept), await readings()];
      await box.frame().evaluate(() => { const R = window.PluginDoor.read; [R.newPages, R.tagIds] = R.lkWas; delete R.lkWas; delete R.lkCount; });
      await page.keyboard.press('Escape'); await wait(800);
      return is(got, ['TEXTAREA', true, [0, 0]]);
    });
    await step('a page made while writing asks what it is: an arrow and Enter give it its tag, and the keys stay in the bullet', async () => {
      await box.frame().evaluate(u => logseq.Editor.editBlock(u), tagged); await wait(700);
      await page.keyboard.type(' [[Zzdoc Quill', { delay: 50 }); await wait(900); await page.keyboard.press('Enter'); await wait(1800);
      const head = await page.locator('.lk-menu .lk-group').innerText().catch(() => '');
      await page.keyboard.press('ArrowDown'); await wait(200);
      const lit = await page.locator('.lk-menu .lk-item.lit').innerText().catch(() => '');
      await page.keyboard.press('Enter'); await wait(1500);
      const tags = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?tt :where [?p :block/title "Zzdoc Quill"] [?p :block/tags ?t] [?t :block/title ?tt]]')).flat());
      const writing = await page.evaluate(() => document.activeElement?.tagName);
      await page.keyboard.press('Escape'); await wait(800);
      return is([head, lit !== '' && tags.includes(lit), writing, await count('.lk-menu')], ['Zzdoc Quill is a new page. What is it?', true, 'TEXTAREA', 0]);
    });
    // ---- Relations: what a list's head says, and + on it
    await goto(CHEN);
    const MAIN = '#main-content-container .lk-relpage > .lk-list';
    await step('every list\'s head is one look: the property\'s name with the arrow, under it its kinds with their counts and, at its right end, the span of its days', async () => {   // the owner's marked page, 26 November 2026, then "before for list head" the same day
      const heads = await page.evaluate(sel => { const box = el => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect(); };
        return [...document.querySelectorAll(sel)].filter(l => l.dataset.kind === 'property' && l.querySelector('.lk-tab')).map(l => { const name = box(l.querySelector('.lk-list-via .lk-prop')), arrow = l.querySelector('.lk-list-head > .lk-fold').getBoundingClientRect(), tab = box(l.querySelector('.lk-tab'));
          return [Math.abs((arrow.top + arrow.bottom) / 2 - (name.top + name.bottom) / 2) < 6, name.bottom <= tab.top + 1, l.querySelectorAll(':scope > .lk-rows > .lk-row').length < 2 || !!l.querySelector('.lk-list-head .lk-span'), /\d/.test(l.querySelector('.lk-tab').innerText)]; }); }, MAIN);
      return is([heads.length > 0, heads.every(h => h.every(Boolean))], [true, true]);
    });
    await step('+ on a list\'s head opens a line to type a new node in at the list\'s end; Enter makes it pointing here, the Undo arrow takes it back', async () => {   // the owner, 25 November 2026: "the actual feature were well developed"
      const list = page.locator(MAIN, { has: page.locator('.lk-list-head .lk-plus') }).first(), name = await list.evaluate(el => el.lkList.prop.title);
      await list.locator('.lk-list-head .lk-plus').click(); await wait(700);
      const line = await page.evaluate(() => { const d = document.querySelector('.lk-draft'), f = d?.querySelector('input'); return d ? [d === d.parentElement.lastElementChild, document.activeElement === f, /^Add an? /.test(f.placeholder), d.querySelector('.lk-draft-props .lk-prop').innerText] : null; });
      await page.keyboard.type('Zzadded here', { delay: 20 }); await page.keyboard.press('Enter'); await wait(900);
      if (await page.evaluate(() => document.querySelector('.lk-draft input')?.dataset.step === 'where')) { await page.keyboard.press('Enter'); await wait(600); }   // where it goes: Enter is today's journal
      await wait(2500);
      const held = await box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?pn :where [?b :block/title "Zzadded here"] [?b ?a ?v] [?v :block/uuid #uuid "${u}"] [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :block/title ?pn]]`)).flat(), CHEN);
      const stays = await page.evaluate(() => { const f = document.querySelector('.lk-draft input'); return [!!f, f?.value]; });
      await page.keyboard.press('Escape'); await wait(400);
      const gone = await page.evaluate(() => document.querySelectorAll('.lk-draft').length);
      await list.locator('.lk-row .lk-undo').first().click(); await wait(3500);
      const left = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?b :where [?b :block/title "Zzadded here"] (not [?b :logseq.property/deleted-at])]')).length);   // a page made goes to Logseq's Recycle
      return is([line, held, stays, gone, left], [[true, true, true, name], [name], [true, ''], 0, 0]);
    });
    await step('the arrow before a value that is a node opens that node under its value, in the same rows; Escape closes the deepest first', async () => {   // the owner, 25 November 2026: "does not allow me to dig", "this does not look like a coherent system to dig"
      const hash = await page.evaluate(() => location.hash);
      const row = page.locator(MAIN + ' > .lk-rows > .lk-row', { has: page.locator('.lk-line') }).nth(1);
      await row.locator(':scope > .lk-line').click(); await wait(2500);
      const link = row.locator(':scope > .lk-open > .lk-editor .property-value-inner[data-type="node"] a.page-ref').first(), uuid = (await link.getAttribute('data-uuid')).toLowerCase();
      await link.click({ position: { x: 5, y: 10 } }); await wait(3000);
      const dug = await row.evaluate(el => { const holder = el.querySelector(':scope > .lk-open'), box = holder.querySelector(':scope > .lk-dugopen'), value = holder.querySelector(':scope > .lk-editor .property-value-inner[data-type="node"] a.page-ref');
        const left = one => { const walk = document.createTreeWalker(one, NodeFilter.SHOW_TEXT); let text; while ((text = walk.nextNode())) { const range = document.createRange(); range.selectNodeContents(text); const at = range.getBoundingClientRect(); if (text.textContent.trim() && at.width) return at.left; } return null; };
        const under = box.getBoundingClientRect(), valueRow = value.closest('.bottom-property-pill, .property-pair'), next = valueRow.nextElementSibling;
        return [box.dataset.node, Math.round(under.top - valueRow.getBoundingClientRect().bottom), next ? next.getBoundingClientRect().top >= under.bottom - 1 : true, Math.abs(left(box) - left(value) - 14) < 1.5]; });   // a step in, so its rows' arrows stand clear of its line (the owner, 26 November 2026)
      const stayed = (await page.evaluate(() => location.hash)) === hash;
      await page.keyboard.press('Escape'); await wait(700);
      const afterOne = [await row.locator('.lk-dugopen').count(), await row.getAttribute('data-open')];
      await page.keyboard.press('Escape'); await wait(700);
      return is([dug[0] === uuid, dug[1], dug[2], dug[3], stayed, afterOne, await count(MAIN + ' .lk-row[data-open]')], [true, 0, true, true, true, [0, '1'], 0]);
    });
    await step('in an opened node every property is one kind of row: names in one column, values in the next, no capsule', async () => {
      const row = page.locator(MAIN + ' > .lk-rows > .lk-row', { has: page.locator('.lk-line') }).nth(1);
      await row.locator(':scope > .lk-line').click(); await wait(2500);
      const rows = await row.evaluate(el => { // where the first thing drawn in a piece starts: its words, or the icon Logseq draws before them (a status circle)
        const left = one => { const walk = document.createTreeWalker(one, NodeFilter.SHOW_ALL); let at; while ((at = walk.nextNode())) { if (at.nodeType === 1 && at.tagName.toLowerCase() !== 'svg') continue; if (at.nodeType === 3 && !at.textContent.trim()) continue; const range = document.createRange(); at.nodeType === 3 ? range.selectNodeContents(at) : range.selectNode(at); const box = range.getBoundingClientRect(); if (box.width) return Math.round(box.left); } return null; };
        return [...el.querySelectorAll(':scope > .lk-open > .lk-editor :is(.bottom-property-pill, .property-pair)')].filter(one => one.offsetParent).map(one => [left(one.querySelector('.property-k')), left(one.querySelector('.property-value-container')), getComputedStyle(one, '::after').content]); });
      await page.keyboard.press('Escape'); await wait(700);
      return is([rows.length > 1, new Set(rows.map(r => r[0])).size, new Set(rows.map(r => r[1])).size, rows.every(r => r[2] === 'none')], [true, 1, 1, true]);
    });
    // ---- Ontology: counts, moving a tag with the keys, its lines, its menu
    await step('a tag with tags under it folds as a bullet does: its arrow hides them and shows them again, Cmd-Up and Cmd-Down too', async () => {   // the owner, 26 November 2026: "you should be able to fold things just like a normal bullet"
      const names = () => page.evaluate(() => [...document.querySelectorAll('.lk-ontology .lk-list[data-face="tag"] .lk-row .lk-words')].map(w => w.textContent));
      const row = page.locator('.lk-ontology .lk-row', { hasText: /^Organization/ }).first();
      await row.hover(); await row.locator('.lk-fold').click(); await wait(1200);
      const shut = !(await names()).includes('Hospital');
      await page.keyboard.press('Meta+ArrowDown'); await wait(1200);
      const open = (await names()).includes('Hospital');
      await page.keyboard.press('Meta+ArrowUp'); await wait(1200);
      const again = !(await names()).includes('Hospital');
      await row.hover(); await row.locator('.lk-fold').click(); await wait(1200);
      return is([shut, open, again, (await names()).includes('Hospital')], [true, true, true, true]);
    });
    await step('each tag says how many nodes stand under it', async () => is(await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-ontology .lk-list[data-face="tag"] .lk-row')]; const n = r => Number(r.querySelector('.lk-num')?.innerText || 0); return [n(rows[0]) > 0, n(rows[0]) >= n(rows[1])]; }), [true, true]));
    const shape = () => page.evaluate(() => [...document.querySelectorAll('.lk-ontology .lk-list[data-face="tag"] .lk-row')].slice(0, 5).map(r => [r.querySelector('.lk-words').innerText, Number(r.style.getPropertyValue('--lk-depth')) || 0]));
    await step('Tab puts a tag under the tag above it at its level, Shift-Tab takes it out again, and the keys stay on its row', async () => {
      const before = await shape();
      await page.locator('.lk-ontology .lk-row', { hasText: /^Person/ }).first().locator('.lk-line').focus(); await wait(200);
      await page.keyboard.press('Tab'); await wait(2500);
      const moved = await shape(), focus = await page.evaluate(() => document.activeElement?.querySelector?.('.lk-words')?.innerText);
      await page.keyboard.press('Shift+Tab'); await wait(2500);
      return is([before.find(r => r[0] === 'Person')?.[1], moved.find(r => r[0] === 'Person')?.[1], focus, await shape()], [1, 2, 'Person', before]);
    });
    await step('Tab and Shift-Tab pressed one right after the other end where they should: the second waits for the first', async () => {   // found by hand, 25 November 2026
      const before = await shape();
      await page.locator('.lk-ontology .lk-row', { hasText: /^Person/ }).first().locator('.lk-line').focus(); await wait(200);
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await wait(5000);
      const parents = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?pt :where [?b :block/title "Person"] [?b :block/tags :logseq.class/Tag] [?b :logseq.property.class/extends ?p] [?p :block/title ?pt]]')).flat());
      return is([await shape(), parents], [before, ['Entity']]);
    });
    await step('the selected tag shows its lines to the tags it is joined with, and they stay while the pointer is elsewhere', async () => {
      await page.locator('.lk-ontology .lk-row', { hasText: /^Consultation/ }).first().locator('.lk-num').click(); await wait(500);
      const one = [await count('.lk-joins path') > 0, await page.evaluate(() => { const box = document.querySelector('.lk-ontology:not(.lk-map) .lk-list[data-face="tag"] > .lk-rows').getBoundingClientRect(), svg = document.querySelector('.lk-ontology:not(.lk-map) .lk-joins path').getBoundingClientRect(); return svg.right > box.right && svg.right < box.right + 20; }), await count('.lk-joins')];   // a bracket just outside the outline's right edge
      await page.locator('.lk-ontology .lk-field').hover(); await wait(400);
      return is([one, await count('.lk-joins')], [[true, true, 1], 1]);
    });
    await step('a tag\'s menu offers to put it under another tag, and has no line "Show its nodes"', async () => {   // the owner, 24 November 2026, of this menu: "remove: tick, show its nodes"
      await page.locator('.lk-ontology .lk-row', { hasText: /^Consultation/ }).first().locator('.lk-line').click({ button: 'right' }); await wait(500);
      const items = await page.locator('.lk-menu .lk-item').allInnerTexts();
      await page.keyboard.press('Escape'); await wait(300);
      return is([items.includes('Show its nodes'), items.includes('Move under…'), await count('.lk-menu')], [false, true, 0]);
    });
    /* Found by hand, 26 November 2026: a merge is many writes, and its one Undo is that many steps of Logseq's own; a step
       miscounted leaves part of the merge, or takes back an earlier change. Tick two tags, merge, Undo: all of it is back. */
    await step('two tags ticked and merged with the row of actions: the nodes go to the kept tag, and one Undo puts every one back', async () => {
      const state = () => box.frame().evaluate(async () => { const q = s => logseq.DB.datascriptQuery(s); return [(await q('[:find ?a ?w :where [?t :block/tags :logseq.class/Tag] [?t :block/title ?a] [(contains? #{"research" "Report"} ?a)] [?b :block/tags ?t] [?b :block/title ?w]]')).map(r => r.join('>')).sort(), (await q('[:find ?a ?b :where [?t :block/tags :logseq.class/Tag] [?t :block/title ?a] [?t :logseq.property.class/properties ?p] [?p :block/title ?b]]')).map(r => r.join('>')).sort(), (await q('[:find ?a ?b :where [?p :logseq.property/classes ?c] [?p :block/title ?a] [?c :block/title ?b]]')).map(r => r.join('>')).sort()]; });
      const row = name => page.locator('.lk-ontology .lk-row').filter({ has: page.locator('.lk-words', { hasText: new RegExp(`^${name}$`) }) }).first();
      const before = await state();
      await row('research').locator('.lk-tick').click(); await row('Report').locator('.lk-tick').click(); await wait(300);
      const said = await page.locator('.lk-ontology .lk-onto-acts .lk-said').innerText();
      await page.locator('.lk-ontology .lk-onto-acts [data-act="merge"]').click(); await wait(1500);
      const head = await page.locator('.lk-ontology .lk-merge .lk-ask-head').innerText();
      await page.locator('.lk-ontology .lk-merge [data-do="yes"]').click(); await wait(5000);
      const merged = [await row('research').count(), (await state())[0].filter(one => one.startsWith('research>')).length];
      await page.locator('.lk-undo').first().click(); await wait(6000);
      return is([said, head, merged, await state(), await row('research').count()], ['2 tags picked', 'Merge research into Report', [0, 0], before, 1]);
    });
    await step('a tag\'s values are moved into a new property: shown first, written on the yes, and one Undo puts all of it back', async () => {
      const held = title => box.frame().evaluate(async t => { const G = window.PluginDoor; G.read.forget(); const prop = [...(await G.read.properties()).values()].find(p => p.title === t); return prop ? (await G.read.holders(prop.ident)).length : -1; }, title);
      const before = await held('Provider');
      await page.locator('.lk-ontology .lk-row', { hasText: /^Consultation/ }).first().locator('.lk-line').click({ button: 'right' }); await wait(500);
      await page.locator('.lk-menu .lk-item', { hasText: 'Move values…' }).click(); await wait(1500);
      await page.locator('.lk-ask [data-do="from"]').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: /^Provider$/ }).click(); await wait(1200);
      await page.locator('.lk-ask [data-do="into"]').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: 'A new property…' }).click(); await wait(400);
      await page.keyboard.type('Zzseen by', { delay: 20 }); await page.keyboard.press('Enter'); await wait(1200);
      await page.locator('.lk-ask .lk-tick').click(); await wait(500);
      const yes = await page.locator('.lk-ask .lk-accent').innerText(), n = parseInt(yes.replace(/\D+/g, ''), 10), shown = [await count('.lk-ask-row .lk-going') > 0, await count('.lk-ask-row .lk-coming') > 0];
      await page.locator('.lk-ask .lk-accent').click(); await wait(2500 + n * 400);
      const said = await page.locator('.lk-ask-said').innerText().catch(() => ''), after = [await held('Provider'), await held('Zzseen by')];
      await page.locator('.lk-ask [data-do="undo"]').click(); await wait(2500 + n * 500);
      return is([/^Move \d+ values?$/.test(yes), shown, said.startsWith(`Moved ${n} value`), after, await held('Provider'), await held('Zzseen by'), await count('.lk-ask')], [true, [true, true], true, [before - n, n], before, -1, 0]);
    });
    await step('u p has Logseq load the plugin again from its folder and says in one line what that brought; typed in a bullet it is letters', async () => {   // the owner, 25 November 2026: "can you add update plugins with `u p`?"
      const run = () => box.frame().evaluate(() => (window.lkRun = (window.lkRun || 0) + 1));   // 1 in a plugin just loaded
      const toast = async () => { for (let i = 0; i < 40; i++) { const text = await page.evaluate(() => [...document.querySelectorAll('.ui__toast-description')].map(el => el.innerText.trim()).find(t => /^Plugins /.test(t)) || ''); if (text) return text; await wait(250); } return ''; };
      /* It says at once that it has begun (the rundown of 27 November 2026: nothing was said until the end, up to a minute a
         plugin), and what it brought then takes that notice's place: the two never stand together. Every notice is noted as it comes. */
      await page.evaluate(() => { const seen = window.lkNotices = { begun: false, together: false }; const look = () => { const all = [...document.querySelectorAll('.ui__toast-description')].map(el => el.innerText.trim()), begun = all.includes('Updating plugins…'); if (begun) seen.begun = true; if (begun && all.some(t => /^Plugins /.test(t))) seen.together = true; };
        (window.lkNoticesWatch = new MutationObserver(look)).observe(document.body, { childList: true, subtree: true, characterData: true }); });
      await goto(CHEN); await run();
      await page.locator('#main-content-container .block-add-button').first().click(); await wait(900);
      await page.keyboard.type('up', { delay: 150 }); await wait(2500);
      const typed = [await page.evaluate(() => document.activeElement?.value), await run()];
      await page.keyboard.press('Meta+z'); await page.keyboard.press('Escape'); await wait(700);
      await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('u'); await wait(150); await page.keyboard.press('p');
      const said = await toast(); await wait(4500);
      const notices = await page.evaluate(() => { window.lkNoticesWatch.disconnect(); return [window.lkNotices.begun, window.lkNotices.together]; });
      return is([typed, notices, /^Plugins up to date: Logseq Plugin \d/.test(said), await run()], [['up', 2], [true, false], true, 1]);
    });
    // ---- Relations as it was: kinds, View, picking, the find line, the timeline
    await step('a list of several kinds names them with their counts; a kind pressed narrows the list, All gives it back', async () => {   // the owner, 25 November 2026: "relations from original was quite developed. take all the features from it"
      let list = null;
      for (const where of [OCT7, NORTHGATE, FATIGUE, CHEN]) { await goto(where); list = page.locator(MAIN, { has: page.locator('.lk-tab') }).first(); if (await list.count()) break; }
      if (!(await list.count())) return is('no list of several kinds on these pages', 'one');
      const tabs = await list.locator('.lk-tab:not(.lk-tabmore):not(.lk-newtab)').evaluateAll(els => els.map(el => [el.dataset.kind, parseInt(el.querySelector('.lk-n').innerText, 10)]));
      const all = tabs[0][1], kind = tabs[1];
      await list.locator('.lk-tab').nth(1).click(); await wait(500);
      const narrowed = await list.locator(':scope > .lk-rows > .lk-row').count(), more = await list.locator(':scope > .lk-more').count();
      await list.locator('.lk-tab').first().click(); await wait(500);
      return is([tabs[0][0], all === tabs.slice(1).reduce((n, t) => n + t[1], 0) || all > kind[1], more ? narrowed <= kind[1] : narrowed === kind[1], await list.locator('.lk-tab.on').first().innerText().then(t => t.startsWith('All'))], ['', true, true, true]);
    });
    await step('View groups a list by month and sorts it by name; what is set is said on the head and kept', async () => {
      await goto(CHEN);
      const list = page.locator(MAIN, { has: page.locator('.lk-dots') }).first(), key = await list.getAttribute('data-key');
      const view = async (line, choice) => { await list.locator('.lk-dots').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: line }).first().click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: choice }).first().click(); await wait(600); };
      await view('Group by', 'Month');
      const groups = await list.locator('.lk-group-head').count(), said = await list.locator('.lk-set').innerText();
      await view('Group by', 'None'); await view('Sort by', 'Name');
      const words = await list.locator(':scope > .lk-rows > .lk-row .lk-words').evaluateAll(els => els.map(el => el.innerText.trim().toLowerCase()));
      const kept = await page.evaluate(k => JSON.parse(localStorage.getItem('lk.views') || '{}')[k], key);
      await view('Sort by', 'Day');
      return is([groups > 0, said, words.join('|') === [...words].sort((a, b) => a.localeCompare(b)).join('|'), kept, await page.evaluate(k => JSON.parse(localStorage.getItem('lk.views') || '{}')[k] ?? null, key)], [true, 'By month', true, { sort: 'name' }, null]);
    });
    await step('Pick nodes draws tick boxes; a tag put on the picked nodes is said with an Undo that takes it back', async () => {
      const list = page.locator(MAIN, { has: page.locator('.lk-dots') }).first();
      const tagsOf = () => list.locator(':scope > .lk-rows > .lk-row .lk-line').evaluateAll(els => els.slice(0, 2).map(el => el.querySelector('.lk-tag')?.innerText || ''));
      await list.locator('.lk-dots').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: 'Pick nodes' }).click(); await wait(500);
      const astray = await list.locator(':scope > .lk-rows > .lk-row').evaluateAll(rows => rows.filter(row => { const box = row.querySelector(':scope > .lk-tick').getBoundingClientRect(), line = row.querySelector(':scope > .lk-line').getBoundingClientRect(); return Math.abs((box.top + box.height / 2) - (line.top + 14)) > 4 || box.right > line.left + 4; }).length);
      if (astray) throw new Error(`${astray} tick boxes stand off their line's first line`);
      await list.locator('.lk-row > .lk-tick').nth(0).click(); await wait(200); await list.locator('.lk-row > .lk-tick').nth(1).click(); await wait(400);
      const bar = await list.locator('.lk-pickbar').innerText();
      await list.locator('.lk-pickbar [data-do="tag"]').click(); await wait(600); await page.keyboard.type('Zzontag', { delay: 30 }); await wait(500);
      const offered = await page.locator('.lk-menu .lk-item:not([hidden])').count();
      if (!offered) { await page.keyboard.press('Escape'); await wait(200); await list.locator('.lk-pickbar [data-do="clear"]').click(); return is('the tag made earlier in the walk is not offered', 'offered'); }
      await page.keyboard.press('Enter'); await wait(3500);
      const did = await list.locator('.lk-pickbar .lk-did').innerText().catch(() => ''), held = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?b :where [?t :block/title "Zzontag"] [?b :block/tags ?t]]')).length);
      await list.locator('.lk-pickbar [data-do="undo"]').click(); await wait(4000);
      const after = await box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?b :where [?t :block/title "Zzontag"] [?b :block/tags ?t]]')).length);
      return is([bar.startsWith('2'), did, held, after, await list.locator('.lk-row > .lk-tick').count()], [true, 'Zzontag put on 2 nodes', 2, 0, 0]);
    });
    await step('the find line narrows every list to typed words and turns the lists back to a day; Escape gives them back', async () => {
      const rows = () => page.locator(MAIN + ' > .lk-rows > .lk-row:not(.lk-faint)').count();
      await page.keyboard.press('Meta+Shift+p'); await wait(700); await page.keyboard.type('Relations: find', { delay: 20 }); await wait(700); await page.keyboard.press('Enter'); await wait(700);
      const field = page.locator('#main-content-container .lk-relfind .lk-field'), focused = await field.evaluate(el => el === document.activeElement);
      const before = await rows();
      await page.keyboard.type('on Sep 1', { delay: 30 }); await wait(700);
      const back = [await rows(), await page.locator(MAIN + ' .lk-since').count(), await page.locator('#main-content-container .lk-relday').isVisible()];
      await page.keyboard.press('Escape'); await wait(500);
      return is([focused, back[0] < before, back[1] > 0, back[2], await rows(), await field.inputValue()], [true, true, true, true, before, '']);
    });
    await step('a list\'s timeline has a dot for each dated node; a dot pressed narrows the list to its week, Escape lets go', async () => {
      const list = page.locator(MAIN, { has: page.locator('.lk-dots') }).first();
      const view = async (line, choice) => { await list.locator('.lk-dots').click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: line }).first().click(); await wait(400); await page.locator('.lk-menu .lk-item', { hasText: choice }).first().click(); await wait(700); };
      await view('Timeline', 'One line');
      const dots = await list.locator('.lk-time-dot').count(), all = await list.evaluate(el => el.lkList.rows.filter(row => row.day).length);
      await list.locator('.lk-time-dot').first().click({ force: true }); await wait(600);
      const said = await list.locator('.lk-set').innerText().catch(() => '');
      await page.keyboard.press('Escape'); await wait(500);
      const free = await list.locator('.lk-set').count();
      await view('Timeline', 'Hidden');
      return is([dots, /^showing /.test(said), free, await list.locator('.lk-time').count()], [all, true, 0, 0]);
    });
    await step('the Recycle list shows what Logseq keeps deleted, and Delete asks first as every delete does: a red yes, and the keyboard on Cancel', async () => {   // the owner, 25 November 2026: "that color should be red and leave it should be cancel"
      await page.keyboard.press('Meta+Shift+p'); await wait(700); await page.keyboard.type('the Recycle list', { delay: 20 }); await wait(700); await page.keyboard.press('Enter'); await wait(2000);
      const rows = await page.locator('.lk-recycle-row').count(), told = await page.locator('.lk-recycle-top').innerText().catch(() => '');
      let asked = 'nothing to delete';
      if (rows) { await page.locator('.lk-recycle-row [data-do="delete"]').first().click(); await wait(400); asked = await page.evaluate(() => [document.activeElement?.innerText || '', document.querySelector('.lk-recycle .lk-ask-gone [data-do="yes"]')?.className || '']); await page.keyboard.press('Enter'); await wait(400); asked.push(await page.evaluate(() => document.activeElement?.dataset?.do || 'the keys rest on nothing')); }
      const after = await page.locator('.lk-recycle-row').count();
      return is([told.length > 0, asked, after, await count('.lk-recycle .lk-ask-gone')], [true, rows ? ['Cancel', 'lk-del', 'delete'] : 'nothing to delete', rows, 0]);   // left by Cancel, the keys are back on the Delete press
    });
    await step('the Recycle list says a page is back, or gone, only when Logseq did it, and says a refusal', async () => {   // F70 of the rundown, 27 November 2026: “…” is back was said whatever Logseq answered. In Logseq 2.0.2 only a deleted page lies in the Recycle (a deleted bullet is gone from the graph)
      await box.frame().evaluate(async () => { for (const name of ['Zzrecycle one', 'Zzrecycle two']) { await logseq.Editor.createPage(name, {}, { redirect: false }); await logseq.Editor.deletePage(name); } });
      await wait(1500);
      const held = () => box.frame().evaluate(async () => { const q = text => logseq.DB.datascriptQuery(text), these = '[(contains? #{"Zzrecycle one" "Zzrecycle two"} ?t)]'; return [(await q(`[:find ?t :where [?b :block/title ?t] ${these} (not [?b :logseq.property/deleted-at])]`)).flat().sort(), (await q(`[:find ?t :where [?b :block/title ?t] ${these} [?b :logseq.property/deleted-at]]`)).flat().sort()]; });   // [the live ones, the ones in the Recycle]
      const line = words => page.locator('.lk-recycle-row', { hasText: words }).first();
      const said = words => page.locator('.ui__toast', { hasText: words }).count();
      // Logseq refusing once: the call answers nothing and does nothing, as Logseq's own answer for a restore it did not make.
      const refuseOnce = call => box.frame().evaluate(name => { const write = window.PluginDoor.write, was = write[name]; write[name] = async () => { write[name] = was; return null; }; }, call);
      await goto(CHEN); await page.keyboard.press('Meta+Shift+p'); await wait(700); await page.keyboard.type('the Recycle list', { delay: 20 }); await wait(700); await page.keyboard.press('Enter'); await wait(2000);
      const named = [await line('Zzrecycle one').locator('.lk-recycle-words').innerText(), /^\d+ deleted pages? Logseq still keeps$/.test((await page.locator('.lk-recycle-top > span').innerText()).trim())];   // every line is a page: said once above them, not after every name
      await refuseOnce('restore'); await line('Zzrecycle one').locator('[data-do="restore"]').click(); await wait(1500);
      const refused = [await said('“Zzrecycle one” was not brought back') > 0, await said('“Zzrecycle one” is back'), await line('Zzrecycle one').count(), await held()];
      await line('Zzrecycle one').locator('[data-do="restore"]').click(); await wait(1500);
      const back = [await said('“Zzrecycle one” is back') > 0, await line('Zzrecycle one').count(), await held()];
      await refuseOnce('deleteForGood'); await line('Zzrecycle two').locator('[data-do="delete"]').click(); await wait(400); await page.locator('.lk-recycle .lk-ask-gone [data-do="yes"]').click(); await wait(1500);
      const kept = [await said('“Zzrecycle two” was not deleted') > 0, await line('Zzrecycle two').count(), await held()];
      await line('Zzrecycle two').locator('[data-do="delete"]').click(); await wait(400); await page.locator('.lk-recycle .lk-ask-gone [data-do="yes"]').click(); await wait(1500);
      const gone = [await line('Zzrecycle two').count(), await held()];
      await box.frame().evaluate(async () => { const page = await logseq.Editor.getPage('Zzrecycle one'); await logseq.Editor.deletePage('Zzrecycle one'); if (page?.uuid) await logseq.Editor.deleteRecycledPagePermanently(page.uuid); }); await wait(800);   // the graph as it was
      await goto(CHEN);
      return is([named, refused, back, kept, gone], [['Zzrecycle one', true], [true, 0, 1, [[], ['Zzrecycle one', 'Zzrecycle two']]], [true, 0, [['Zzrecycle one'], ['Zzrecycle two']]], [true, 1, [['Zzrecycle one'], ['Zzrecycle two']]], [0, [['Zzrecycle one'], []]]]);
    });
    {
    // ---- Beside: two pages side by side (the owner chose the old feature, 26 November 2026)
    await goto(CHEN);
    const sideNow = () => page.evaluate(() => ({ list: window.logseq.api.get_state_from_store('sidebar/blocks').map(e => e[1]), open: !!window.logseq.api.get_state_from_store('ui/sidebar-open?') }));
    const halves = () => page.evaluate(() => { const side = document.querySelector('#right-sidebar'), main = document.querySelector('#main-content-container'); return [Math.round(main.getBoundingClientRect().left), Math.round(side.getBoundingClientRect().width), window.innerWidth]; });
    const split = () => page.evaluate(() => { const side = document.querySelector('#right-sidebar'), shown = [...side.querySelectorAll('.sidebar-item')].filter(el => el.offsetParent);
      return { on: side.hasAttribute('data-lk-split'), title: side.querySelector('.lk-split-title')?.innerText.trim() || '', shown: shown.length, head: !!shown[0]?.querySelector('.sidebar-item-header')?.offsetParent, own: document.querySelectorAll('.lk-split-line, .lk-split-tools, .lk-split-title').length }; });
    const hospital = () => page.locator('#main-content-container .ls-page-properties a.page-ref', { hasText: 'Northgate' }).first();
    const beside = async locator => { await locator.click({ modifiers: ['Meta'] }); await wait(3000); };
    const press = async what => { await page.locator(`.lk-split-tools [data-do="${what}"]`).click(); await wait(3000); };
    if (!(await sideNow()).open) { await page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await wait(800); }
    if (!(await page.evaluate(() => !!document.getElementById('_sidebar.lk-search')?.offsetParent))) { await page.keyboard.press('Meta+k'); await wait(1200); }   // the sidebar holds Search, and what the walk left there (Cmd-K on a shown Search takes it away)
    await page.evaluate(() => window.logseq.api.set_right_sidebar_visible(false)); await wait(800);
    const before = await sideNow();
    await step('Cmd-click on a link in the main view opens its page beside: equal halves, one page with its title, no head, the main view where it was', async () => {
      const hash = await page.evaluate(() => location.hash);
      await beside(hospital());
      const [left, width, whole] = await halves(), got = await split();
      return is([got, Math.abs(width - (whole - left) / 2) <= 1, (await page.evaluate(() => location.hash)) === hash], [{ on: true, title: 'Northgate Cancer Center', shown: 1, head: false, own: 3 }, true, true]);
    });
    await step('the page beside shows its place, its properties and its Relations, and its title stands level with the main title', async () => is(await page.evaluate(() => { const item = document.querySelector('[data-lk-split-item]');
      return [!!item.querySelector('.lk-place')?.innerText.trim(), item.querySelectorAll('.property-pair').length > 0, item.querySelectorAll('.lk-relwrap .lk-list').length > 0,
        Math.abs(item.querySelector('.lk-split-title').getBoundingClientRect().top - document.querySelector('#main-content-container .ls-page-title-container .block-title-wrap').getBoundingClientRect().top) <= 8]; }), [true, true, true, true]));
    await step('a line opened in the page beside leaves that page its own title and place where they were', async () => {
      const at = () => page.evaluate(() => { const item = document.querySelector('[data-lk-split-item]'), title = item.querySelector('.lk-split-title').getBoundingClientRect(), place = item.querySelector('.lk-place'); return [Math.round(title.left), Math.round(title.top), !!place.closest('.lk-open'), place.innerText.trim()]; });
      const was = await at();
      await page.locator('[data-lk-split-item] .lk-row .lk-line').first().click(); await wait(2500);
      const open = await count('[data-lk-split-item] .lk-row[data-open]'), now = await at();
      await page.keyboard.press('Escape'); await wait(700);
      return is([open, now, await count('[data-lk-split-item] .lk-row[data-open]')], [1, was, 0]);
    });
    await step('the line between the halves drags, stops at 320, and a double-click gives equal halves', async () => {
      const line = page.locator('.lk-split-line'), box = await line.boundingBox();
      const drag = async to => { const at = await line.boundingBox(); await page.mouse.move(at.x + 4, 400); await page.mouse.down(); await page.mouse.move(to, 400, { steps: 8 }); await page.mouse.up(); await wait(500); return halves(); };
      const wider = await drag(box.x - 60), narrow = await drag(2000), wide = await drag(0);
      await line.dblclick({ position: { x: 4, y: 400 } }); await wait(500);
      const [left, width, whole] = await halves();
      return is([wider[1] > box.x / 2 && Math.abs(wider[1] - (whole - box.x + 60)) <= 6, narrow[1], whole - left - wide[1], Math.abs(width - (whole - left) / 2) <= 1], [true, 320, 320, true]);
    });
    await step('another Cmd-click puts that page on the right instead, and the one before leaves the sidebar', async () => {
      await beside(page.locator('#main-content-container .lk-place a', { hasText: 'Doctor' }));
      const got = await split(), now = await sideNow();
      return is([got.title, got.shown, now.list.length - before.list.length, await page.evaluate(() => !!document.querySelector('[data-lk-split-item] .lk-split-sign') && !document.querySelector('[data-lk-split-item] .ls-sidebar-page-properties')?.offsetParent)], ['Doctor', 1, 1, true]);
    });
    await step('swap puts the right page on the left and the left page on the right', async () => {
      await press('swap');
      return is([(await split()).title, await page.evaluate(() => document.querySelector('#main-content-container .ls-page-title-container .block-title-wrap')?.innerText.trim())], ['Dr. Mei Chen', 'Doctor']);
    });
    await step('the close icon ends the split: the sidebar shut as before, holding what it held, nothing of the split left', async () => {
      await press('close');
      return is([await sideNow(), await split()], [before, { on: false, title: '', shown: 0, head: false, own: 0 }]);
    });
    await goto(CHEN);
    await step('Cmd-click on a line of Relations opens its node beside and does not open the line', async () => {
      const line = page.locator('#main-content-container .lk-relpage > .lk-list > .lk-rows > .lk-row > .lk-line').first(), uuid = await line.evaluate(el => el.parentElement.dataset.uuid);
      await beside(line);
      const got = await split(), opened = await count('#main-content-container .lk-row[data-open]');
      await press('close');
      return is([got.on, got.shown, opened, await sideNow()], [true, 1, 0, before]);
    });
    await step('with the sidebar open, Cmd-K during the split ends it and shows Search with the keys in its line', async () => {
      await page.evaluate(() => window.logseq.api.set_right_sidebar_visible(true)); await wait(800);
      await beside(hospital()); const on = (await split()).on;
      await page.keyboard.press('Meta+k'); await wait(2000);
      return is([on, (await split()).own, await page.evaluate(() => document.activeElement?.closest('.lk-search') != null), (await sideNow()).list.length - before.list.length], [true, 0, true, 1]);
    });
    await step('Shift-click during the split ends it and the page from the right stays in the sidebar; shutting the sidebar ends it too', async () => {
      await beside(hospital()); const title = (await split()).title;
      await hospital().click({ modifiers: ['Shift'] }); await wait(2500);
      const shifted = [await split().then(s => [s.on, s.own]), (await sideNow()).open];
      await beside(hospital());
      await page.evaluate(() => window.logseq.api.set_right_sidebar_visible(false)); await wait(2000);
      return is([title, ...shifted, (await split()).own, (await sideNow()).list.length >= before.list.length + 1], ['Northgate Cancer Center', [false, 0], true, 0, true]);
    });
    await step('a reload of the plugin during the split closes it and leaves the sidebar as it was', async () => {
      const was = await sideNow();
      await page.locator('#main-content-container .lk-row .lk-line').first().click({ modifiers: ['Meta'] }); await wait(3000);
      const on = (await split()).on;
      await page.evaluate(() => window.LSPluginCore.reload('logseq-plugin')); await wait(6000);
      return is([on, (await split()).own, (await split()).on, await sideNow()], [true, 0, false, was]);
    });
    }
    {
    // ---- Focusing into a bullet and out (the owner, 26 November 2026)
    const focus = await box.frame().evaluate(async () => { const p = await logseq.Editor.createPage('Zzfocus walk', {}, { redirect: false }); const first = await logseq.Editor.appendBlockInPage(p.uuid, 'Above one');
      await logseq.Editor.insertBatchBlock(first.uuid, [{ content: 'Above two' }, { content: 'Above three' }, { content: 'Go in here', children: [{ content: 'Under it' }] }, { content: 'Below' }], { sibling: true });
      return { page: p.uuid, bullet: (await logseq.Editor.getPageBlocksTree(p.uuid))[3].uuid }; });
    const dot = page.locator(`#main-content-container .ls-block[blockid="${focus.bullet}"] > .block-main-container .bullet-container`).first();
    /* What the glide does from a press on, read at each frame: how far the bullet moved by it, whether it moved the whole way
       smoothly, whether the old view faded; then how things stand at rest. */
    const glided = async act => {
      const seen = page.evaluate(uuid => new Promise(done => { const tops = []; let ghost = false; const t0 = performance.now(); const frame = () => {
        const main = document.getElementById('main-content-container'), block = [...main.querySelectorAll(`.ls-block[blockid="${uuid}"]`)].find(b => !b.closest('.lk-ghost'));
        if (main.querySelector('.lk-ghost')) ghost = true;
        if (block?.getAnimations().some(a => a.id === 'lk-glide')) tops.push(Math.round(block.querySelector(':scope > .block-main-container').getBoundingClientRect().top));
        if (performance.now() - t0 < 1400) requestAnimationFrame(frame); else done({ moved: new Set(tops).size > 4 && Math.abs(tops[0] - tops[tops.length - 1]) > 40, ghost }); }; frame(); }), focus.bullet);
      await wait(60); await act(); const got = await seen; await wait(500);
      return [got.moved, got.ghost, ...await page.evaluate(uuid => [location.hash.includes(uuid), !!document.querySelector(`#main-content-container .ls-block.selected[blockid="${uuid}"]`), document.querySelectorAll('#main-content-container .lk-out').length, document.querySelectorAll('.lk-ghost').length, !!document.querySelector('.ui__dialog-content')], focus.bullet)];
    };
    // moved, old view faded, in the bullet, selected, arrows, copies left, a window of Logseq's open
    const IN = [true, true, true, false, 1, 0, false], OUT = [true, true, false, true, 0, 0, false];
    await goto(focus.page);
    await step('a press on a bullet glides it to the top, the old view fading, an up arrow after the line of steps', async () => is(await glided(() => dot.click()), IN));
    await step('the up arrow steps out with the same glide back, and the bullet comes back selected', async () => is(await glided(() => page.locator('#main-content-container .lk-out').click()), OUT));
    await step('Cmd-. goes back into the selected bullet and Cmd-, steps out again, Logseq\'s settings staying shut', async () => is([await glided(() => page.keyboard.press('Meta+.')), await glided(() => page.keyboard.press('Meta+,'))], [IN, OUT]));
    await step('Back and Forward glide too', async () => is([await glided(() => page.evaluate(() => history.back())), (await glided(() => page.evaluate(() => history.forward()))).slice(0, 4)], [IN, [true, true, false, true]]));
    await step('Cmd-, while writing in the focused bullet keeps the cursor and selects nothing', async () => {
      await dot.click(); await wait(1200);
      await page.locator(`#main-content-container .ls-block[blockid="${focus.bullet}"] > .block-main-container .block-content`).first().click(); await wait(500);
      const got = await glided(() => page.keyboard.press('Meta+,')), writing = await page.evaluate(() => document.activeElement?.tagName);
      await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(300);
      return is([got, writing], [[true, true, false, false, 0, 0, false], 'TEXTAREA']);
    });
    await step('with Reduce motion on nothing moves: the old view only fades, and the bullet still comes back selected', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' }); await goto(focus.page);
      const got = [await glided(() => dot.click()), await glided(() => page.locator('#main-content-container .lk-out').click())];
      await page.emulateMedia({ reducedMotion: null });
      return is(got, [[false, ...IN.slice(1)], [false, ...OUT.slice(1)]]);
    });
    // ---- Moving (the owner's choices of 27 November 2026)
    // How many places in between a number passed through, read at every frame while something is done.
    const between = async (read, act, ms = 900) => { const seen = page.evaluate(([src, ms]) => new Promise(done => { const f = eval(src), got = [], t0 = performance.now(); const frame = () => { got.push(f()); performance.now() - t0 < ms ? requestAnimationFrame(frame) : done(got); }; frame(); }), [read, ms]);
      await wait(60); await act(); const got = (await seen).filter(x => x != null).map(Math.round), a = got[0], z = got[got.length - 1]; await wait(300);
      return new Set(got.filter(x => x > Math.min(a, z) + 2 && x < Math.max(a, z) - 2)).size; };
    await step('a bullet zoomed into from the journal: Cmd-, , the up arrow and Back return to the journal at the same spot, never blank', async () => {
      const day = await box.frame().evaluate(async () => { const p = await logseq.Editor.createJournalPage(new Date().toLocaleDateString('en-CA')), ids = [];
        for (let k = 0; k < 14; k++) ids.push((await logseq.Editor.appendBlockInPage(p.uuid, `Zz day note ${k}`)).uuid);
        await logseq.Editor.insertBlock(ids[8], 'Zz under it', { sibling: false }); return ids; });
      const row = `#main-content-container .ls-block[blockid="${day[8]}"] > .block-main-container`, got = [];
      const at = () => page.evaluate(sel => [location.hash, Math.round(document.querySelector(sel)?.getBoundingClientRect().top)], row);
      for (const way of ['key', 'arrow', 'back']) {
        await page.evaluate(() => window.logseq.api.push_state('home')); await wait(1800);
        await page.evaluate(sel => { const main = document.getElementById('main-content-container'); main.scrollTop += document.querySelector(sel).getBoundingClientRect().top - 350; }, row); await wait(600);
        const was = await at(); await page.locator(`${row} .bullet-container`).first().click(); await wait(1300);
        const seen = page.evaluate(() => new Promise(done => { let blank = 0; const t0 = performance.now(); const frame = () => { const main = document.getElementById('main-content-container'); if (!main.querySelector('.block-main-container')) blank++; performance.now() - t0 < 2000 ? requestAnimationFrame(frame) : done(blank); }; frame(); }));
        await wait(60); if (way === 'key') await page.keyboard.press('Meta+,'); else if (way === 'arrow') await page.locator('#main-content-container .lk-out').click(); else await page.evaluate(() => history.back());
        const blank = await seen; await wait(500); const now = await at(); got.push([now[0] === was[0], Math.abs(now[1] - was[1]) <= 2, blank]);
      }
      return is(got, [[true, true, 0], [true, true, 0], [true, true, 0]]);
    });
    await step('a bullet folded or opened rolls', async () => {
      const row = page.locator('#main-content-container .ls-block[haschild="true"] > .block-main-container', { hasText: 'Zz day note 8' }).first();
      const read = `() => document.querySelector('#main-content-container .journal-item .page-blocks-inner')?.offsetHeight`;
      const press = async () => { await row.hover(); await row.locator('.block-control').click(); };
      const shut = await between(read, press), open = await between(read, press);
      return is([shut > 2, open > 2, await count('.lk-rolling')], [true, true, 0]);
    });
    await step('"Show more" and a list\'s fold roll, nothing left behind', async () => {
      await goto(FATIGUE);
      const read = `() => document.querySelector('#main-content-container .lk-relpage .lk-list').offsetHeight`, fold = page.locator('#main-content-container .lk-list-head > .lk-fold').first();
      const more = await between(read, () => page.locator('#main-content-container .lk-relpage .lk-more').first().click());
      await fold.hover(); const shut = await between(read, () => fold.click()), open = await between(read, () => fold.click());
      return is([more > 1, shut > 2, open > 2, await count('.lk-gone')], [true, true, true, 0]);
    });
    await step('a task finished in Todo shows its tick, waits, rolls up; Undo rolls it back', async () => {
      const uuid = await box.frame().evaluate(async () => { const p = await logseq.Editor.createJournalPage(new Date().toLocaleDateString('en-CA')), b = await logseq.Editor.appendBlockInPage(p.uuid, 'Zz finish me'); await window.PluginDoor.write.setStatus(b.uuid, 'Todo'); return b.uuid; });
      await page.evaluate(() => window.logseq.api.push_state('home')); await wait(800); await page.keyboard.press('g'); await page.keyboard.press('d'); await wait(2000);
      const read = `() => { const row = document.querySelector('#main-content-container .lk-todo .lk-row[data-uuid="${uuid}"]'); return row ? [row.offsetHeight, row.querySelector('.lk-status').title] : []; }`;
      const watch = async act => { const seen = page.evaluate(src => new Promise(done => { const f = eval(src), got = [], t0 = performance.now(); const frame = () => { got.push(f()); performance.now() - t0 < 2600 ? requestAnimationFrame(frame) : done(got); }; frame(); }), read); await wait(60); await act(); return seen; };
      await page.locator(`#main-content-container .lk-todo .lk-row[data-uuid="${uuid}"] .lk-status`).click(); await wait(500);
      const went = await watch(() => page.locator('.lk-menu .lk-item', { hasText: /^Done$/ }).click()), back = await watch(() => page.keyboard.press('Meta+z'));
      const part = got => new Set(got.filter(one => one[0] > 1 && one[0] < 22).map(one => one[0])).size;
      return is([went.filter(one => one[1] === 'Done' && one[0] > 20).length > 25, part(went) > 2, went[went.length - 1].length, part(back) > 1, back[back.length - 1][1]], [true, true, 0, true, 'Todo']);
    });
    await step('the page beside slides in from the right and out again', async () => {
      await goto(FATIGUE);
      const read = `() => { const side = document.getElementById('right-sidebar'); return side.hasAttribute('data-lk-split') ? side.getBoundingClientRect().left : null; }`;
      const came = await between(read, () => page.locator('#main-content-container .lk-row .lk-line').first().click({ modifiers: ['Meta'] }), 3500);
      await wait(500); const left = await between(read, () => page.locator('.lk-split-tools [data-do="close"]').click(), 2500); await wait(800);
      return is([came > 3, left > 3, await page.evaluate(() => document.getElementById('right-sidebar').getAnimations().length)], [true, true, 0]);
    });
    }
    {
    // ---- Beside: the key sheet (the owner chose it again, 26 November 2026)
    const sheet = () => page.evaluate(() => { const box = document.querySelector('.lk-sheet.on'); return box ? { stays: box.classList.contains('stays'), presses: getComputedStyle(box).pointerEvents, keys: document.activeElement === box.querySelector('.lk-field'), heads: [...box.querySelectorAll('.lk-sheet-group:not([hidden]) > .lk-sheet-head')].map(el => el.textContent) } : null; });
    const lines = () => page.evaluate(() => [...document.querySelectorAll('.lk-sheet .lk-sheet-line:not([hidden])')].map(el => `${el.querySelector('.lk-sheet-words').textContent} = ${[...el.querySelectorAll('.lk-keycap')].map(key => key.textContent).join(' ')}`));
    const holdOption = async () => { await page.keyboard.down('Alt'); await wait(1100); await page.keyboard.up('Alt'); await wait(300); };
    await goto(CHEN);
    await step('Option held on its own brings the key sheet after a moment, which takes nothing while held and stays once let go', async () => {
      await page.keyboard.down('Alt'); await wait(300); const early = await sheet(); await wait(800); const held = await sheet(), size = await page.evaluate(() => document.querySelector('.lk-sheet').offsetHeight);
      await page.keyboard.up('Alt'); await wait(300); const stayed = await sheet();
      return is([early, held?.stays, held?.presses, held?.heads, stayed?.stays, stayed?.keys, await page.evaluate(() => document.querySelector('.lk-sheet').offsetHeight) - size], [null, false, 'none', ['Writing', 'Arranging bullets', 'Finding', 'Moving around', 'Two letters, outside a bullet'], true, true, 0]);
    });
    await step('the sheet says each key as it is: Logseq\'s and the plugin\'s, and no Cmd-K for Logseq\'s search while Search takes it', async () => { const got = await lines(); return is(['Undo, redo = ⌘Z ⌘⇧Z', 'Indent, outdent = ⇥ ⇧⇥', 'Search = ⌘K', 'Todo = g d', 'Update plugins = u p'].filter(want => !got.includes(want)).concat(got.filter(line => line.startsWith('Logseq’s search'))), []); });
    await step('letters typed find among the keys and reach nothing else; Up and Down light a line; Escape clears, then closes', async () => {
      const theme = () => page.evaluate(() => document.documentElement.className + document.documentElement.dataset.theme), before = await theme();
      await page.keyboard.type('t t', { delay: 60 }); await wait(500); const same = await theme() === before;
      await page.keyboard.press('Meta+a'); await page.keyboard.type('go', { delay: 40 }); await wait(300);
      const found = (await lines()).every(line => /go/i.test(line.split(' = ')[0])), marked = await page.locator('.lk-sheet mark.lk-hit').first().innerText();
      const lit = () => page.evaluate(() => [...document.querySelectorAll('.lk-sheet-line:not([hidden])')].findIndex(el => el.classList.contains('lit')));
      const first = await lit(); await page.keyboard.press('ArrowDown'); const second = await lit(); await page.keyboard.press('ArrowUp'); const back = await lit();
      await page.keyboard.type('zzzz'); await wait(200); const none = await page.locator('.lk-sheet-none').innerText();
      await page.keyboard.press('Escape'); await wait(300); const cleared = [await page.locator('.lk-sheet .lk-field').inputValue(), (await lines()).length > 20];
      await page.keyboard.press('Escape'); await wait(300);
      return is([same, found, marked.toLowerCase(), first, second, back, none, cleared, await sheet()], [true, true, 'go', 0, 1, 0, 'No key does that.', ['', true], null]);
    });
    await step('a quick Option and a letter, Option with Shift, and any other key while held bring or keep no sheet', async () => {
      await page.keyboard.press('Alt+e'); await wait(1000); const quick = await sheet();
      await page.keyboard.down('Alt'); await page.keyboard.down('Shift'); await wait(1000); const shifted = await sheet(); await page.keyboard.up('Shift'); await page.keyboard.up('Alt'); await wait(200);
      await page.keyboard.down('Alt'); await wait(1100); const up = !!(await sheet()); await page.keyboard.press('ArrowDown'); await wait(300); const gone = await sheet(); await page.keyboard.up('Alt'); await wait(300);
      return is([quick, shifted, up, gone, await sheet()], [null, null, true, null, null]);
    });
    await step('a press puts the sheet away while Option is held and, once it stays, only a press outside it', async () => {
      await page.keyboard.down('Alt'); await wait(1100); await page.mouse.click(8, 400); await wait(300); const held = await sheet(); await page.keyboard.up('Alt'); await wait(300);
      await holdOption(); await page.locator('.lk-sheet-head').first().click(); await wait(300); const inside = await sheet();
      await page.mouse.click(8, 400); await wait(300);
      return is([held, inside?.keys, await sheet()], [null, true, null]);
    });
    await step('Escape gives the keys back to the bullet being written, the caret where it was and its words untouched', async () => {
      const own = await page.evaluate(async u => (await window.logseq.api.append_block_in_page(u, 'Words being written')).uuid, CHEN); await wait(1200);
      await page.evaluate(u => window.logseq.api.edit_block(u), own); await wait(900);
      await page.evaluate(() => document.activeElement.setSelectionRange(3, 3)); const was = await page.evaluate(() => document.activeElement.value);
      await holdOption(); const up = (await sheet())?.keys; await page.keyboard.press('Escape'); await wait(700);
      const got = await page.evaluate(() => [document.activeElement.tagName, document.activeElement.selectionStart, document.activeElement.value]);
      await page.keyboard.press('Escape'); await wait(500);
      return is([up, got], [true, ['TEXTAREA', 3, was]]);
    });
    await step('a key changed in Logseq\'s own settings shows on the sheet as it now is', async () => {
      const set = keys => box.frame().evaluate(shortcuts => logseq.App.setCurrentGraphConfigs({ shortcuts }), keys);
      await set({ 'editor/undo': ['mod+shift+9'], 'editor/redo': [] }); await wait(1500);
      await holdOption(); const got = (await lines()).filter(line => line.startsWith('Undo, redo')); await page.keyboard.press('Escape'); await wait(300);
      await set({}); await wait(1000);
      return is(got, ['Undo, redo = ⌘⇧9']);
    });
    await step('Show the keys in the command palette opens the sheet staying; Option brings none over that palette', async () => {
      await page.keyboard.press('Meta+Shift+p'); await wait(700); await holdOption(); const over = await sheet();
      await page.keyboard.type('Show the keys', { delay: 20 }); await wait(700); await page.keyboard.press('Enter'); await wait(900);
      const got = await sheet(); await page.keyboard.press('Escape'); await wait(300);
      return is([over, got?.stays, got?.keys, await sheet()], [null, true, true, null]);
    });
    }
    {
    await step('a read that fails behind a folded bullet is said once, and asked again only when the screen next changes', async () => {   // the rundown of 27 November 2026: it was asked again at once, without end
      /* Counted against the changes of the screen, not against time: Logseq's own page can change in every frame (the walk of
         27 November 2026 met that here), and the part may ask once at each change. The fault asked far more often than that. */
      const asks = await box.frame().evaluate(async () => {
        const G = window.PluginDoor, read = G.read.folded, spots = G.touch.foldedSpots; let asked = 0, looked = 0;
        G.read.folded = () => new Promise((_, fail) => { asked += 1; setTimeout(() => fail(new Error('the walk made this read fail')), 1); });
        G.touch.foldedSpots = () => [{ uuid: '00000000-0000-4000-8000-00000000f01d', at: null, put() {} }];
        const off = G.touch.watch(() => { looked += 1; });   // runs whenever the part looks at the screen again
        const stir = () => { const el = G.host().createElement('i'); G.host().body.appendChild(el); el.remove(); };   // the screen changes
        const pause = ms => new Promise(done => setTimeout(done, ms));
        stir(); await pause(700); const first = [asked, looked];
        stir(); await pause(400); const second = [asked, looked];
        G.read.folded = read; G.touch.foldedSpots = spots; off(); stir(); await pause(200);
        // asked at all; never more often than the screen changed (two to spare for a change of the graph meanwhile); asked again after the next change
        return [first[0] > 0, first[0] <= first[1] + 2 && second[0] <= second[1] + 2, second[0] > first[0]];
      });
      await wait(200);
      const mine = line => line.includes('what a folded bullet holds could not be read'), said = errors.filter(mine).length;
      for (let i = errors.length - 1; i >= 0; i--) if (mine(errors[i])) errors.splice(i, 1);   // this step's own, made on purpose
      return is([asks, said], [[true, true, true], 1]);
    });
    // ---- Export: the window the owner chose again (26 November 2026), Markdown and the one paper template
    const written = () => page.evaluate(async () => JSON.stringify(await window.logseq.api.datascript_query('[:find (count ?b) (max ?u) :where [?b :block/uuid _] [?b :block/updated-at ?u]]')));
    const preview = () => page.evaluate(() => document.querySelector('.lk-xp iframe:not(.lk-xp-coming)')?.contentDocument.body.innerText || '');
    // A real press on words in the preview. The preview is drawn smaller or larger (zoom), so the point is worked out here.
    const pressWords = async words => { const at = await page.evaluate(w => { const frame = document.querySelector('.lk-xp iframe:not(.lk-xp-coming)'), zoom = Number(frame.style.zoom) || 1, piece = [...frame.contentDocument.querySelectorAll('p.x-p, pre')].find(el => el.textContent.includes(w)), a = frame.getBoundingClientRect(), r = piece.getBoundingClientRect(); return { x: a.left + (r.left + 30) * zoom, y: a.top + (r.top + 7) * zoom }; }, words); await page.mouse.click(at.x, at.y); await wait(200); };
    let untouched = '';
    await step('the corner opens the export window on this page, the preview the sheet as it will print', async () => {
      await goto(CHEN); untouched = await written();
      await page.locator('.lk-corner > button').click({ force: true }); await wait(400);
      await page.keyboard.type('Export: this page', { delay: 20 }); await wait(300); await page.keyboard.press('Enter'); await wait(2500);
      const said = await preview();
      return is([await page.locator('.lk-xp-what').innerText(), await page.locator('.lk-xp-tabs button').allInnerTexts(), ['Dr. Mei Chen', 'Specialty', 'Oncology', 'Consultant medical oncologist'].every(w => said.includes(w)), await page.evaluate(() => document.querySelector('.lk-xp iframe').contentDocument.querySelectorAll('.sheet').length)], ['Export this page', ['PDF', 'Markdown'], true, 1]);
    });
    await step('the column unfolds; a property left out leaves the preview, and comes back ticked', async () => {
      if (!(await page.locator('.lk-xp-side').isVisible())) await page.locator('.lk-xp-column').click();
      await wait(400);
      const box = page.locator('.lk-xp-prop', { hasText: 'Specialty' }).locator('input');
      await box.click(); await wait(1200); const without = (await preview()).includes('Oncology');
      await box.click(); await wait(1200);
      return is([without, (await preview()).includes('Oncology')], [false, true]);
    });
    await step('words changed in the preview stay through a change of paper, and go, said, when what is written changes', async () => {
      await pressWords('Consultant'); await page.keyboard.press('End'); await page.keyboard.type(' Walked.', { delay: 20 }); await wait(1200);
      await page.locator('.lk-xp [data-pick="paper"]').click(); await wait(300); await page.locator('.lk-menu .lk-item', { hasText: 'Letter' }).click(); await wait(1300);
      const kept = [(await preview()).includes('Walked.'), await page.evaluate(() => document.querySelector('.lk-xp iframe').style.width)];
      await page.locator('.lk-xp [data-switch="tasks"]').click(); await wait(1300);
      const gone = [(await preview()).includes('Walked.'), await page.getByText('the words changed in it went').count() > 0];
      await page.locator('.lk-xp [data-switch="tasks"]').click(); await wait(1200);
      return is([...kept, ...gone], [true, '856px', false, true]);
    });
    await step('a table row and a picture higher than a sheet go on over the next sheets as they print, and a heading that begins a sheet stands at its top', async () => {   // the rundown of 27 November 2026: both were cut at the sheet's foot, and the heading kept a gap the print drops
      const got = await box.frame().evaluate(async () => {
        const G = window.PluginDoor, doc = G.host(), look = { paper: 'A4', margins: 'wide', size: 'normal', footer: '', pageNumbers: true };
        const dealt = async (body, read) => {
          const frame = doc.createElement('iframe'); frame.style.cssText = 'position:absolute;left:-10000px;top:0;width:834px;height:600px;border:0;visibility:hidden';
          const loaded = new Promise(done => { frame.onload = () => { if (frame.contentDocument.querySelector('.x-doc')) done(); }; });
          frame.srcdoc = G.paper.page(body, look, 'A long page'); doc.body.appendChild(frame); await loaded;
          const inner = frame.contentDocument; await Promise.all([...inner.images].map(img => img.decode().catch(() => {})));
          const sheets = G.sheets.paginate(inner, look), range = inner.createRange(), bodies = [...inner.querySelectorAll('.sheet-body')];
          let under = 0;   // lines of words that end under their sheet's foot
          for (const one of bodies) { const foot = one.getBoundingClientRect().bottom, texts = inner.createTreeWalker(one, 4); for (let text; (text = texts.nextNode());) { range.selectNodeContents(text); for (const line of range.getClientRects()) if (line.height && line.bottom > foot + 1) under += 1; } }
          const answer = [sheets, under, ...read(inner, bodies)]; frame.remove(); return answer;
        };
        const stripes = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="2400"><rect width="300" height="2400" fill="#ccc"/></svg>');
        const row = await dealt(`<p class="x-p">Before the table.</p><table class="x-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td class="x-name">Short row</td><td>one</td></tr><tr><td class="x-name">${Array.from({ length: 150 }, (_, i) => `Cell line ${i + 1}`).join('<br>')}</td><td>beside it</td></tr><tr><td class="x-name">Last row</td><td>three</td></tr></tbody></table><p class="x-p">After the table.</p>`,
          (inner, bodies) => { const whole = G.sheets.gather(inner); return [bodies.map(one => one.querySelectorAll('thead').length).join(''), whole.querySelectorAll('tbody > tr').length, (whole.textContent.match(/Cell line \d+/g) || []).length, (whole.textContent.match(/beside it/g) || []).length]; });
        const picture = await dealt(`<p class="x-p">Before the picture.</p><figure class="x-figure"><img class="x-img" src="${stripes}" width="300"><figcaption class="x-caption">The caption</figcaption></figure><p class="x-p">After the picture.</p>`,
          (inner, bodies) => { const shown = bodies.map(one => { const box = one.getBoundingClientRect(); return [...one.querySelectorAll('img')].reduce((sum, img) => { const r = img.getBoundingClientRect(); return sum + Math.max(0, Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top)); }, 0); });
            const whole = G.sheets.gather(inner); return [Math.round(shown.reduce((a, b) => a + b, 0)), bodies.findIndex(one => /The caption/.test(one.textContent)) + 1, whole.querySelectorAll('img').length]; });
        const heading = await dealt('<p class="x-p" style="height:880px">A first paragraph, as high as most of a sheet.</p><h2 class="x-h2">A heading</h2><p class="x-p">The paragraph under it.</p>',
          (inner, bodies) => { const head = inner.querySelector('h2'), on = bodies.findIndex(one => one.contains(head)); return [on + 1, Math.round(head.getBoundingClientRect().top - bodies[on].getBoundingClientRect().top)]; });
        return { row, picture, heading };
      });
      // As Chromium prints them: the row over 5 pages with the table's head on each of its four, the picture over 4 pages in slices that add up to its 2400, the heading at the second page's top.
      return is(got, { row: [5, 0, '11111', 3, 150, 1], picture: [4, 0, 2400, 4, 1], heading: [2, 0, 2, 0] });
    });
    await step('a key typed in the preview does not write the whole page out; the changed words are read when the preview is drawn again', async () => {   // the rundown of 27 November 2026: at every key the page was copied and written out as text, pictures and all
      await box.frame().evaluate(() => { const S = window.PluginDoor.sheets, own = S.gather; window.lkWrittenOut = 0; S.gather = (...given) => { window.lkWrittenOut += 1; return own(...given); }; window.lkGatherBack = () => { S.gather = own; }; });
      await pressWords('Consultant'); await page.keyboard.type('Typed ', { delay: 20 }); await wait(1000);
      const atKeys = await box.frame().evaluate(() => window.lkWrittenOut);
      await page.locator('.lk-xp [data-switch="pageNumbers"]').click(); await wait(1300);
      const kept = (await preview()).includes('Typed '), read = await box.frame().evaluate(() => { window.lkGatherBack(); return window.lkWrittenOut; });
      await page.locator('.lk-xp [data-switch="pageNumbers"]').click(); await wait(1300);
      return is([atKeys, kept, read > 0, (await preview()).includes('Typed ')], [0, true, true, true]);
    });
    await step('Enter takes the line the arrows are on, in a list of the export window', async () => {   // seen by hand, 26 November 2026: Enter did nothing
      await page.locator('.lk-xp [data-pick="paper"]').click(); await wait(300);
      await page.locator('.lk-menu .lk-item', { hasText: 'A4' }).focus(); await page.keyboard.press('Enter'); await wait(1300);
      const took = [await count('.lk-menu'), await page.locator('.lk-xp [data-pick="paper"]').innerText().then(t => /A4/.test(t))];
      await page.locator('.lk-xp [data-pick="paper"]').click(); await wait(300);   // back to Letter, which the steps after this expect
      await page.locator('.lk-menu .lk-item', { hasText: 'Letter' }).focus(); await page.keyboard.press('Enter'); await wait(1300);
      return is(took, [0, true]);
    });
    await step('Layout turns the page into bullets and back to paragraphs', async () => {
      const bullets = () => page.evaluate(() => document.querySelector('.lk-xp iframe').contentDocument.querySelectorAll('li.x-li').length);
      const pickLayout = async word => { await page.locator('.lk-xp [data-pick="text"]').click(); await wait(300); await page.locator('.lk-menu .lk-item', { hasText: word }).click(); await wait(1300); };
      const before = await bullets(); await pickLayout('Bullets'); const as = await bullets(); await pickLayout('Paragraphs');
      return is([as > before, await bullets()], [true, before]);
    });
    await step('Escape closes an open list first, then the export window', async () => {
      await page.locator('.lk-xp [data-pick="margins"]').click(); await wait(300); await page.keyboard.press('Escape'); await wait(300);
      const first = [await count('.lk-menu'), await count('.lk-xp')];
      await page.keyboard.press('Escape'); await wait(400);
      return is([...first, await count('.lk-xp')], [0, 1, 0]);
    });
    await step('a bullet that holds more lines than a sheet goes on over the next sheets, every line on one, as bullets and as paragraphs', async () => {   // the rundown of 27 November 2026: of 120 lines under one bullet 85 stood on no sheet
      const dealt = layout => box.frame().evaluate(async layout => {
        const G = window.PluginDoor, E = G.export, doc = G.host();
        let n = 0; const node = (words, children = []) => Object.assign(E.node({ uuid: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, words }), { children });
        const under = Array.from({ length: 120 }, (_, i) => node(`Line ${i + 1} under the first bullet, with a few more words so it reads as a line`));
        const sheet = { kind: 'page', title: 'A long outline', tags: [], properties: [], nodes: [node('The first bullet holds everything', under), node('The second bullet')], tagged: [], names: {} };
        const chosen = { ...E.choices(''), text: layout }, look = { paper: 'A4', margins: 'wide', size: 'normal', footer: '', pageNumbers: true };
        const frame = doc.createElement('iframe'); frame.style.cssText = 'position:absolute;left:-10000px;top:0;width:834px;height:600px;border:0;visibility:hidden';
        const loaded = new Promise(done => { frame.onload = () => { if (frame.contentDocument.querySelector('.x-doc')) done(); }; });
        frame.srcdoc = G.paper.page(G.paper.html(sheet, { ...E.options(sheet, chosen, 20261127), picture: () => '' }), look, 'A long outline'); doc.body.appendChild(frame); await loaded;
        const inner = frame.contentDocument, said = el => el.textContent.replace(/\s+/g, ''), before = said(inner.querySelector('.x-doc'));
        const sheets = G.sheets.paginate(inner, look), range = inner.createRange();
        let under_the_foot = 0;   // lines of words that end under their sheet's foot, where the sheet hides them
        for (const body of inner.querySelectorAll('.sheet-body')) { const foot = body.getBoundingClientRect().bottom, texts = inner.createTreeWalker(body, 4);
          for (let text; (text = texts.nextNode());) { range.selectNodeContents(text); for (const line of range.getClientRects()) if (line.height && line.bottom > foot + 1) under_the_foot += 1; } }
        const got = [sheets, under_the_foot, said(G.sheets.gather(inner)) === before]; frame.remove(); return got;
      }, layout);
      return is([await dealt('outline'), await dealt('prose')], [[4, 0, true], [3, 0, true]]);   // four and three sheets: the pages Chromium prints of it
    });
    await step('Save PDF hands the sheet, with the words changed in it, to the print window; the export window stays', async () => {
      await page.locator('.lk-corner > button').click({ force: true }); await wait(400);
      await page.keyboard.type('Export: this page', { delay: 20 }); await wait(300); await page.keyboard.press('Enter'); await wait(2500);
      await pressWords('Consultant'); await page.keyboard.press('End'); await page.keyboard.type(' Printed.', { delay: 20 }); await wait(1200);
      // The Mac's print window is not opened by the walk: the page's print is taken over as the frame appears.
      await page.evaluate(() => { window.__printed = ''; new MutationObserver((list, watch) => { for (const r of list) for (const n of r.addedNodes) if (n.classList?.contains('lk-print')) { n.contentWindow.print = () => { window.__printed = n.contentDocument.documentElement.outerHTML; }; watch.disconnect(); } }).observe(document.body, { childList: true }); });
      await page.locator('.lk-xp [data-do="pdf"]').click(); await wait(2500);
      const got = await page.evaluate(() => [window.__printed.includes('Printed.'), window.__printed.includes('size: Letter'), window.__printed.includes('class="sheet'), document.querySelectorAll('.lk-print').length, !!document.querySelector('.lk-xp:not([hidden])')]);
      return is(got, [true, true, false, 0, true]);
    });
    await step('Copy Markdown copies the text as changed in the preview, and closes the window', async () => {
      await page.locator('.lk-xp-tabs [data-target="md"]').click(); await wait(1300);
      const shown = await preview();
      await pressWords('# Dr. Mei Chen'); await page.keyboard.press('Meta+ArrowDown'); await page.keyboard.type('Added by hand', { delay: 20 }); await wait(400);
      // The Mac's own clipboard is left alone.
      await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = async text => { window.__copied = text; }; });
      await page.keyboard.press('Meta+Enter'); await wait(900);
      const copied = await page.evaluate(() => { delete navigator.clipboard.writeText; return window.__copied; });
      await page.locator('.lk-corner > button').click({ force: true }); await wait(400);
      await page.keyboard.type('Export: this page', { delay: 20 }); await wait(300); await page.keyboard.press('Enter'); await wait(2200);
      const remembered = await page.locator('.lk-xp-tabs .on').innerText();
      await page.locator('.lk-xp-tabs [data-target="pdf"]').click(); await wait(400); await page.locator('.lk-xp [data-do="close"]').click(); await wait(400);
      return is([shown.startsWith('# Dr. Mei Chen'), copied.startsWith('# Dr. Mei Chen'), copied.includes('Added by hand'), remembered, await count('.lk-xp')], [true, true, true, 'Markdown', 0]);
    });
    await step('a bullet\'s right-click menu exports that bullet alone', async () => {
      await page.locator('#main-content-container .ls-page-blocks .bullet-container').first().click({ button: 'right' }); await wait(700);
      await page.getByText('PDF or Markdown…').first().click(); await wait(2500);
      const got = [await page.locator('.lk-xp-what').innerText().catch(() => ''), (await preview()).includes('Consultant medical oncologist'), (await preview()).includes('Specialty')];
      await page.keyboard.press('Escape'); await wait(400);
      return is(got, ['Export this bullet', true, false]);
    });
    await step('exporting wrote nothing to the graph', async () => is(await written(), untouched));
    }
    // ---- Logseq's own property rows
    await page.keyboard.press('Escape'); await goto(NORTHGATE);
    await step('a value in words starts where its box starts, on the page and in the sidebar, as every other value does', async () => {   // seen 26 November 2026: it stuck out 20 to the left
      await page.evaluate(u => window.logseq.api.open_in_right_sidebar(u), NORTHGATE); await wait(3500);
      const got = await page.evaluate(() => ['#main-content-container', '#right-sidebar'].map(at => [...document.querySelectorAll(`${at} .property-pair:not(.lk-editor *) .property-block-container`)].map(box => Math.round(box.querySelector('.block-title-wrap').getBoundingClientRect().left - box.closest('.property-value-container').getBoundingClientRect().left))));
      await page.locator('#right-sidebar .sidebar-item.item-type-page').first().locator('.item-actions button').last().click(); await wait(800);
      return is(got, [[0], [0]]);
    });
    await step('a mouse press on a place in Logseq\'s "UI position" list saves it', async () => {   // the owner, 26 November 2026: "this doesn't seem to work or actually change things when you use it"
      await goto('6a000000-0000-4000-8000-00000000001b');   // a bullet with its own properties: only there does Logseq offer the list
      const where = () => box.frame().evaluate(async () => (await logseq.DB.datascriptQuery('[:find ?v :where [?p :block/title "Date"] [?p :logseq.property/ui-position ?v]]')).flat());
      const before = await where();
      await page.locator('#main-content-container a.property-k:not(.lk-editor a)', { hasText: 'Date' }).first().click(); await wait(900);
      const opener = page.getByRole('menuitem', { name: /UI position/ }).first(); await opener.hover(); await wait(800);
      const from = await opener.boundingBox(), line = await page.getByRole('menuitem', { name: /End of the block/ }).first().boundingBox();
      await page.mouse.move(line.x + 75, from.y + from.height / 2, { steps: 4 }); await page.mouse.move(line.x + 75, line.y + line.height / 2, { steps: 4 }); await wait(300);
      await page.mouse.down(); await page.mouse.up(); await wait(1500);
      const after = await where();
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(500);
      if (after.join() !== before.join()) { await page.keyboard.press('Meta+z'); await wait(1300); }
      return is([before, after, await where()], [[], ['block-right'], []]);
    });
    await step('a + under the pointer reaches an empty property, on a bullet and in an opened line, and takes no room at rest', async () => {   // 26 November 2026: nothing reached an empty property of an opened node
      const BULLET = '6a000000-0000-4000-8000-000000000005', ROW = `#main-content-container .lk-row[data-uuid="${BULLET}"]`;
      const topic = scope => page.locator(`${scope} .bottom-property-pill:not(.lk-menu *)`, { hasText: 'Topic' }).first();
      const set = () => box.frame().evaluate(async u => (await logseq.DB.datascriptQuery(`[:find ?v :where [?b :block/uuid #uuid "${u}"] [?b :user.property/topic ?v]]`)).length, BULLET);
      const got = [];
      for (const [where, scope] of [[BULLET, '#main-content-container'], ['1a000000-0000-4000-8000-000000000010', `${ROW} .lk-editor`]]) {
        await page.mouse.move(2, 2); await goto(where);
        if (scope.startsWith(ROW)) { await page.locator(`${ROW} .lk-words`).click(); await wait(2200); await page.mouse.move(2, 2); await wait(500); }
        const rest = await page.locator('.lk-empty-plus:visible').count();
        await page.locator(`${scope} .ls-block .block-title-wrap`).first().hover({ position: { x: 30, y: 8 } }); await wait(500);
        const shown = await page.locator('.lk-empty-plus:visible').count(), hidden = await topic(scope).isVisible();
        await page.locator('.lk-empty-plus').click(); await wait(500);
        const lines = await page.locator('.lk-menu .lk-item').allInnerTexts();
        await page.keyboard.press('Enter'); await wait(1500);
        const asked = [await topic(scope).isVisible(), await page.locator('.ui__popover-content .cp__select-input').count()];
        await page.keyboard.press('Escape'); await page.mouse.move(2, 2); await wait(1800);
        got.push([rest, shown, hidden, lines, asked, await topic(scope).isVisible(), await set()]);
        await page.keyboard.press('Escape'); await wait(400);
      }
      return is(got, [[0, 1, false, ['Topic'], [true, 1], false, 0], [0, 1, false, ['Topic'], [true, 1], false, 0]]);
    });
    await step('a property set to "Hide by default" is not said after a list\'s lines, and starts unticked in the export', async () => {   // 26 November 2026: lists and the export showed what Logseq was told to hide
      const hide = on => box.frame().evaluate(async on => { for (const name of ['Severity', 'Specialty']) { const [uuid] = (await logseq.DB.datascriptQuery(`[:find ?u :where [?p :block/title "${name}"] [?p :db/ident ?i] [(namespace ?i) ?n] [(= ?n "user.property")] [?p :block/uuid ?u]]`))[0]; await logseq.Editor.upsertBlockProperty(uuid, 'logseq.property/hide?', on); } }, on);
      const after = () => page.locator('#main-content-container .lk-relpage .lk-tell').count();
      const sheet = () => page.evaluate(() => document.querySelector('.lk-xp iframe:not(.lk-xp-coming)')?.contentDocument.body.innerText || '');
      const open = async () => { await page.locator('.lk-corner > button').click({ force: true }); await wait(400); await page.keyboard.type('Export: this page', { delay: 20 }); await wait(300); await page.keyboard.press('Enter'); await wait(2500); if (!(await page.locator('.lk-xp-side').isVisible())) { await page.locator('.lk-xp-column').click(); await wait(400); } };
      const tick = () => page.locator('.lk-xp-prop', { hasText: 'Specialty' }).locator('input');
      const leave = async () => { await page.locator('.lk-xp [data-do="close"]').click(); await wait(500); };
      await goto(FATIGUE); const before = await after() > 0;
      await hide(true); await wait(1500); await goto(CHEN);
      await open(); const first = [await tick().isChecked(), await page.locator('.lk-xp-prop', { hasText: 'Works at' }).locator('input').isChecked(), (await sheet()).includes('Oncology')];
      await tick().click(); await wait(1200); const asked = (await sheet()).includes('Specialty'); await leave();
      await open(); const kept = await tick().isChecked(); await tick().click(); await wait(1000); await leave();
      await goto(FATIGUE); const hidden = await after();
      await hide(false); await wait(1500);
      return is([before, first, asked, kept, hidden, await after() > 0], [true, [false, true, false], true, true, 0, true]);
    });
    await step('with every property shown, an opened task says each property once', async () => {   // the owner, 27 November 2026: "why are properties being repeated?"
      const ROW = '.lk-todo .lk-row[data-uuid="8a000000-0000-4000-8000-000000000090"]';   // a task with a priority and a deadline
      await goto(CHEN);
      if (!(await page.locator('.lk-todo').first().isVisible().catch(() => false))) { await page.locator('.lk-corner > button').click({ force: true }); await wait(500); await page.keyboard.type('Todo', { delay: 30 }); await wait(400); await page.keyboard.press('Enter'); await wait(2500); }
      // Of the opened node: whether Logseq lists under it what already stands in its own place (the status circle, the day under the
      // words), and the names that are nevertheless seen twice.
      const read = () => page.evaluate(sel => { const block = document.querySelector(`${sel} .lk-editor .ls-block[blockid="${document.querySelector(sel).dataset.uuid}"]`);
        const own = selector => [...block.querySelectorAll(selector)].filter(el => el.closest('.ls-block[blockid]') === block), name = row => row.querySelector('.property-k')?.textContent.trim();
        const seen = el => el.getClientRects().length > 0, under = own('.bottom-property-pill'), pairs = own('.property-pair');
        const placed = [...under.map(name), ...(own('.positioned-properties.block-left [class*="ls-icon-"]').some(seen) ? ['Status'] : [])];
        const shown = [...placed, ...pairs.filter(seen).map(name)];
        return [pairs.filter(pair => placed.includes(name(pair))).length, shown.filter((one, i) => shown.indexOf(one) !== i)]; }, ROW);
      const all = async () => { await page.keyboard.press('p'); await wait(150); await page.keyboard.press('a'); await wait(2000); };
      await page.locator(`${ROW} > .lk-fold`).click({ force: true }); await wait(2500);
      await page.locator(`${ROW} .lk-editor .block-title-wrap`).first().click({ position: { x: 20, y: 8 } }); await wait(700); await page.keyboard.press('Escape'); await wait(700);
      await all(); const on = await read();
      await all(); const off = await read();
      await page.keyboard.press('Escape'); await wait(500); await page.keyboard.press('Escape'); await wait(500);
      return is([on, off], [[2, []], [0, []]]);
    });
    await step('a value says where it is changed: a mark opens Logseq’s list or calendar, a name leads to its node, an empty one holds a faint mark', async () => {   // the owner, 27 November 2026: "it is not visually clear where I would click to edit"; "there should be some mark when property is empty to click on"
      const BOX = '#main-content-container .lk-row[data-uuid="6a000000-0000-4000-8000-000000000013"]', CALL = '#main-content-container .lk-row[data-uuid="6a000000-0000-4000-8000-000000000006"]';
      const open = async (at, box) => { await goto('home'); await goto(at); if (!(await page.locator(`${box} .lk-editor`).count())) { await page.locator(`${box} > .lk-fold`).click({ force: true }); await wait(2500); } };
      const row = (box, name) => page.locator(`${box} .lk-editor :is(.property-pair, .bottom-property-pill)`).filter({ has: page.locator('.property-k', { hasText: new RegExp(`^${name}$`) }) }).first();
      const asked = () => page.evaluate(() => { const up = [...document.querySelectorAll('.ui__dropdown-menu-content, [class*="popover-content"]')].find(el => el.getClientRects().length); return up ? (up.querySelector('table') ? 'calendar' : 'list') : 'nothing'; });
      // A day's mark and several values' stand as the last piece of Logseq's own row round them.
      const mark = async name => {
        await open('1a000000-0000-4000-8000-000000000020', BOX); await row(BOX, name).scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await wait(300);
        const read = () => row(BOX, name).evaluate(r => { const holder = r.querySelector('.property-value-inner > .jtrigger, .property-value-inner [class*="multi-value"]'), last = holder.lastElementChild.getBoundingClientRect(); return { seen: getComputedStyle(holder, '::after').opacity, x: last.right + 16, y: last.y + last.height / 2 }; });
        const rest = await read(); await page.mouse.move(rest.x, rest.y); await wait(300); const near = await read();
        await page.mouse.click(near.x, near.y); await wait(1200); const said = await asked(); await page.keyboard.press('Escape'); await wait(500);
        return [rest.seen, near.seen, said];
      };
      const day = await mark('Date'), several = await mark('Agent');
      await open('dr. sofia alvarez', CALL); await row(CALL, 'Topic').locator('a.page-ref span').first().click(); await wait(1500);
      const led = await page.evaluate(() => window.logseq.api.get_current_page().then(p => p && p.title));
      await goto('home'); await goto('ferrous sulphate');
      const empty = await page.locator('#main-content-container .property-pair .property-value-inner.empty-value').first().evaluate(el => getComputedStyle(el, '::after').opacity);
      return is([day, several, led, empty], [['0', '1', 'calendar'], ['0', '1', 'list'], 'Colon cancer', '0.6']);
    });
    await step('a page folded and unfolded by its title\'s arrow keeps its properties above Relations', async () => {   // the owner, 27 November 2026: "trouble shoot wrong placement fo sections"
      await goto('home'); await goto(CHEN);
      const arrow = page.locator('#main-content-container .ls-page-title .is-page-title-row a.block-control').first();
      await arrow.click({ force: true }); await wait(900); await arrow.click({ force: true }); await wait(900);
      return is(await page.evaluate(() => { const block = document.querySelector('#main-content-container .ls-page-title .ls-block'), all = [...block.children];
        const props = all.findIndex(one => one.querySelector(':scope > .ls-page-properties')), rel = all.findIndex(one => one.classList.contains('lk-relwrap'));
        return [props > -1, rel > props, rel === all.length - 1]; }), [true, true, true]);
    });
    await step('an addition that lands by the bullet being written leaves it its own tag and the caret where it was', async () => {   // found on 27 November 2026 adding from the corner: Logseq made a tag named by an id
      const today = await box.frame().evaluate(async () => (await logseq.Editor.createJournalPage(new Date().toLocaleDateString('en-CA'))).uuid);
      const tagsOf = uuid => page.evaluate(async u => (await window.logseq.api.datascript_query(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?g] [?g :block/title ?t]]`)).map(r => r[0]).sort(), uuid);
      const model = (name, request) => page.evaluate(([name, request]) => window.logseq.api.invoke_external_plugin_cmd('logseq-plugin', 'models', name, [request]), [name, request]);
      const ways = {
        'Todo’s add': () => box.frame().evaluate(() => window.PluginDoor.write.addTask('Zz a task')),
        'a bullet at the end of a page': () => box.frame().evaluate(u => window.PluginDoor.write.addBullet(u, 'Zz at the end', { page: true }), today),
        'a bullet after it': (at) => box.frame().evaluate(u => window.PluginDoor.write.addBullet(u, 'Zz after'), at),
        'a new line under it': (at) => box.frame().evaluate(u => window.PluginDoor.write.addLine(u), at),
        'a list’s + line': () => box.frame().evaluate(async () => { const G = window.PluginDoor, prop = [...(await G.read.schema()).props.values()].find(one => one.type === 'node'), [to] = await G.read.byUuids(['1a000000-0000-4000-8000-00000000000e']); return G.write.addNode('', prop.ident, to.id, { words: 'Zz pointing' }); }),
        'Alfred’s add to a page': () => model('append', { page: today, words: 'Zz from Alfred' }),
        'Alfred’s Todo': () => model('todoAdd', { words: 'Zz Alfred task' }),
      };
      // Only these bullets on today: a long journal in the feed draws its last bullets late, and the step presses the last one.
      await box.frame().evaluate(async u => { for (const one of await logseq.Editor.getPageBlocksTree(u)) await logseq.Editor.removeBlock(one.uuid); }, today);
      const got = [];
      for (const [way, add] of Object.entries(ways)) {
        const uuid = await box.frame().evaluate(async u => (await logseq.Editor.appendBlockInPage(u, 'Zz seen #Person here')).uuid, today);
        await page.evaluate(() => window.logseq.api.push_state('home')); await wait(1200);
        await page.locator(`#main-content-container .ls-block[blockid="${uuid}"] .block-content`).first().click({ position: { x: 4, y: 8 } }); await wait(900);
        const before = await page.evaluate(() => [document.activeElement.value, document.activeElement.selectionStart]);
        const held = () => page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?b ?t :where [?b :block/title ?t] [(clojure.string/starts-with? ?t "Zz ")]]')).length);
        const was = await held(), line = way === 'a new line under it' ? 1 : 0;   // an empty line has no words to count
        await add(uuid); await wait(1600);
        if (!line && await held() <= was) got.push(`${way}: added nothing`);
        const after = await page.evaluate(() => [document.activeElement.value, document.activeElement.selectionStart]);
        await page.keyboard.press('Escape'); await wait(800);
        const tags = await tagsOf(uuid);
        if (way !== 'a new line under it' && JSON.stringify(after) !== JSON.stringify(before)) got.push(`${way}: the caret went from ${JSON.stringify(before)} to ${JSON.stringify(after)}`);
        if (JSON.stringify(tags) !== '["Person"]') got.push(`${way}: tagged ${tags.join(', ') || 'nothing'}`);
        await box.frame().evaluate(async ([today, junk]) => { for (const one of await logseq.Editor.getPageBlocksTree(today)) if (/^Zz /.test(one.title || one.content || '')) await logseq.Editor.removeBlock(one.uuid); for (const name of junk) await logseq.Editor.deletePage(name); }, [today, tags.filter(tag => /^[0-9a-f]{8}-/.test(tag))]); await wait(900);
      }
      return is(got, []);
    });
    /* The ground's writes, each asked of the plugin as a part asks it (27 November 2026: six faults found by reading, mended
       in ground/, each a step here that fails on the plugin as it was). What a step makes is named Zzg… and taken away at
       the end. A refusal is asked for on purpose in three of them: what Logseq itself says of it then is not counted
       against the plugin (quiet), what the plugin says still is. */
    await page.keyboard.press('Escape'); await wait(600);
    const quiet = async run => { const seen = errors.length; try { return await run(); } finally { await wait(700); errors.splice(seen, errors.length - seen, ...errors.slice(seen).filter(text => /Logseq Plugin|PluginDoor/.test(text))); } };
    await step('several values under a property are written in one step of Undo, and a write Logseq refuses leaves the node what it held', async () => {   // F23
      const got = await quiet(() => box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), q = text => logseq.DB.datascriptQuery(text);
        const prop = await G.write.newProperty('Zzg seen by', 'node', true), pg = await logseq.Editor.createPage('Zzg values', {}, { redirect: false });
        const made = {}; for (const name of ['P', 'Q', 'A', 'B']) made[name] = await logseq.Editor.appendBlockInPage(pg.uuid, `Zzg ${name}`);
        const id = async one => (await q(`[:find ?b :where [?b :block/uuid #uuid "${one.uuid}"]]`))[0][0];
        const holds = async one => (await q(`[:find ?vt :where [?b :block/uuid #uuid "${one.uuid}"] [?b ?a ?v] [?p :db/ident ?a] [?p :block/title "Zzg seen by"] [?v :block/title ?vt]]`)).flat().sort().join(', ');
        const [p, qq, b] = [await id(made.P), await id(made.Q), await id(made.B)];
        await pause(900); G.read.forget();
        for (const one of [made.A, made.B]) await G.write.setValues(one.uuid, prop.ident, [p, qq], { ref: true, many: true, fresh: true });
        await pause(700);
        const first = await holds(made.A);
        // One value fewer: one write, so one Undo puts back both.
        const steps = await G.write.setValues(made.A.uuid, prop.ident, [qq], { ref: true, many: true });
        await pause(700); const fewer = await holds(made.A);
        await G.write.undo(); await pause(1000); const undone = await holds(made.A);
        // A node cannot be a value of its own: Logseq refuses the list, and B must still hold what it held.
        let said = 'written';
        try { await G.write.setValues(made.B.uuid, prop.ident, [qq, b], { ref: true, many: true }); } catch (error) { said = 'refused'; }
        await pause(700);
        return [first, steps, fewer, undone, said, await holds(made.B)];
      }));
      return is(got, ['Zzg P, Zzg Q', 1, 'Zzg Q', 'Zzg P, Zzg Q', 'refused', 'Zzg P, Zzg Q']);
    });
    await step('a value in words keeps the bullets written under it: words written over it change its own words, and taking it away is refused', async () => {   // F28
      const got = await quiet(() => box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), q = text => logseq.DB.datascriptQuery(text);
        const prop = await G.write.newProperty('Zzg notes', 'default', false), pg = await logseq.Editor.createPage('Zzg words', {}, { redirect: false });
        const x = await logseq.Editor.appendBlockInPage(pg.uuid, 'Zzg X');
        await pause(900); G.read.forget();
        await G.write.setText(x.uuid, prop.ident, 'Zzg first line'); await pause(700);
        const value = String(((await q(`[:find ?u :where [?b :block/uuid #uuid "${x.uuid}"] [?b ?a ?v] [?p :db/ident ?a] [?p :block/title "Zzg notes"] [?v :block/uuid ?u]]`))[0] || [])[0] || '');
        if (!value) return 'the value in words was not found to write under';
        for (const words of ['Zzg under one', 'Zzg under two']) await logseq.Editor.insertBlock(value, words, { sibling: false });
        await pause(700);
        // What X holds under the property, and the bullets under that value: read through the property, so a value left behind and out of reach does not count.
        const holds = async () => [(await q(`[:find ?vt :where [?b :block/uuid #uuid "${x.uuid}"] [?b ?a ?v] [?p :db/ident ?a] [?p :block/title "Zzg notes"] [?v :block/title ?vt]]`)).flat().join(', '),
          (await q(`[:find ?ct :where [?b :block/uuid #uuid "${x.uuid}"] [?b ?a ?v] [?p :db/ident ?a] [?p :block/title "Zzg notes"] [?c :block/parent ?v] [?c :block/title ?ct]]`)).flat().sort().join(', ')].join(' > ');
        const before = await holds();
        await G.write.setText(x.uuid, prop.ident, 'Zzg second line'); await pause(700);
        const over = await holds();
        let said = 'taken away';
        try { await G.write.setValues(x.uuid, prop.ident, [], {}); } catch (error) { said = 'refused'; }
        await pause(700);
        return [before, over, said, await holds()];
      }));
      return is(got, ['Zzg first line > Zzg under one, Zzg under two', 'Zzg second line > Zzg under one, Zzg under two', 'refused', 'Zzg second line > Zzg under one, Zzg under two']);
    });
    await step('a property taken off a tag is no longer among the properties the tag gives, in one step of Undo', async () => {   // F39
      const got = await box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), q = text => logseq.DB.datascriptQuery(text);
        const tag = await G.write.newTag('Zzg gives'), one = await G.write.newProperty('Zzg given one', 'default', false), two = await G.write.newProperty('Zzg given two', 'default', false);
        const id = async uuid => (await q(`[:find ?b :where [?b :block/uuid #uuid "${uuid}"]]`))[0][0];
        const gives = async () => (await q(`[:find ?pt :where [?t :block/uuid #uuid "${tag}"] [?t :logseq.property.class/properties ?p] [?p :block/title ?pt]]`)).flat().sort().join(', ');
        const [a, b] = [await id(one.uuid), await id(two.uuid)];
        await pause(900);
        await G.write.tagProperties(tag, [a, b]); await pause(700); const both = await gives();
        await G.write.tagProperties(tag, [a]); await pause(700); const off = await gives();
        await G.write.undo(); await pause(1000);
        return [both, off, await gives()];
      });
      return is(got, ['Zzg given one, Zzg given two', 'Zzg given one', 'Zzg given one, Zzg given two']);
    });
    await step('a new node whose tag Logseq refuses is taken away again, twice over, and the change made just before it stands', async () => {   // F102
      const got = await quiet(() => box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), q = text => logseq.DB.datascriptQuery(text);
        const prop = await G.write.newProperty('Zzg points at', 'node', false), pg = await logseq.Editor.createPage('Zzg half', {}, { redirect: false });
        const plain = await logseq.Editor.appendBlockInPage(pg.uuid, 'Zzg no tag'), target = (await q(`[:find ?b :where [?b :block/uuid #uuid "${plain.uuid}"]]`))[0][0];
        await pause(900); G.read.forget();
        await logseq.Editor.appendBlockInPage(pg.uuid, 'Zzg stands before'); await pause(900);
        // The bullet "Zzg no tag" is given as the tag: Logseq makes the new bullet, then refuses the tag ("Not a tag").
        const said = [];
        for (let i = 0; i < 2; i++) { try { await G.write.addNode(plain.uuid, prop.ident, target, { words: 'Zzg half made', page: pg.uuid }); said.push('made'); } catch (error) { said.push('refused'); } await pause(1200); }
        const count = async words => (await q(`[:find ?b :where [?b :block/title "${words}"]]`)).length;
        return [said.join(', '), await count('Zzg half made'), await count('Zzg stands before')];
      }));
      return is(got, ['refused, refused', 0, 1]);
    });
    await step('a bullet\'s words read and written back keep a link to a bullet as that link, and no page is made of its name', async () => {   // F117
      const got = await box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), q = text => logseq.DB.datascriptQuery(text);
        const pg = await logseq.Editor.createPage('Zzg links', {}, { redirect: false });
        const linked = await logseq.Editor.appendBlockInPage(pg.uuid, 'Zzg the linked bullet'), line = await logseq.Editor.appendBlockInPage(pg.uuid, `Zzg see [[${linked.uuid}]]`);
        await pause(900);
        const points = async () => (await q(`[:find ?u :where [?l :block/uuid #uuid "${line.uuid}"] [?l :block/refs ?r] [?r :block/uuid ?u]]`)).flat().map(u => String(u).toLowerCase()).includes(String(linked.uuid).toLowerCase());
        if (!(await points())) return 'the bullet was not made with its link to the other bullet';
        // As a person reads the bullet and changes it: the link by the name of what it points at, one word added.
        await G.write.setWords(line.uuid, 'Zzg see [[Zzg the linked bullet]] again', { asRead: true }); await pause(900);
        const kept = String(((await q(`[:find ?w :where [?b :block/uuid #uuid "${line.uuid}"] [?b :block/title ?w]]`))[0] || [])[0] || '');
        return [await points(), kept.endsWith(' again'), (await q('[:find ?b :where [?b :block/title "Zzg the linked bullet"]]')).length];
      });
      return is(got, [true, true, 1]);
    });
    await step('told that another graph is open, the plugin asks the graph afresh and the Undo arrow goes', async () => {   // F76
      /* The walk has one graph. Logseq does not load a plugin again when another graph opens, it only tells it; that telling is
         sent here as Logseq sends it, to the plugin's own side. Two graphs in one Logseq are tried by hand. */
      await wait(1500);
      const got = await box.frame().evaluate(async () => {
        const G = window.PluginDoor, pause = ms => new Promise(done => setTimeout(done, ms)), arrows = () => G.host().querySelectorAll('.lk-undo').length;
        if (typeof logseq.caller?.emit !== 'function') return 'the plugin\'s side has no way to be told';
        const first = await G.read.tags(), again = await G.read.tags();
        if (first !== again) return 'the plugin keeps nothing of the graph to begin with';
        G.undo.mark('00000000-0000-4000-8000-000000000000');   // no line shows this node: the arrow waits at the window's bottom right
        await pause(2300);
        const stood = arrows();
        logseq.caller.emit('hook:app:current_graph_changed', {});
        await pause(300);
        const got = [stood, (await G.read.tags()) !== first, arrows()];
        G.undo.clear();
        return got;
      });
      return is(got, [1, true, 0]);
    });
    // What these steps made is taken away: the pages to Logseq's Recycle, the properties and the tag deleted.
    await box.frame().evaluate(async () => {
      for (const name of ['Zzg values', 'Zzg words', 'Zzg half', 'Zzg links']) { try { await logseq.Editor.deletePage(name); } catch (error) { /* it stays in the throwaway copy */ } }
      for (const title of ['Zzg seen by', 'Zzg notes', 'Zzg given one', 'Zzg given two', 'Zzg points at', 'Zzg gives']) {
        try { for (const [uuid] of await logseq.DB.datascriptQuery(`[:find ?u :where [?b :block/title "${title}"] [?b :db/ident _] [?b :block/uuid ?u]]`)) await logseq.Editor.deletePage(String(uuid)); } catch (error) { /* it stays in the throwaway copy */ }
      }
    }).catch(() => {});
    await wait(800);
    await step('nothing the plugin did was said as an error', async () => is(errors, []));
  } finally {
    if (!keep) { await sandbox.stop(box); fs.rmSync(DIR, { recursive: true, force: true }); }
  }
  if (faults.length) { console.log(`The walk found ${faults.length} of ${n} steps wrong:\n  ` + faults.join('\n  ')); process.exit(1); }
  console.log(`The walk passed: ${n} steps in a real Logseq.`);
  process.exit(0);
})().catch(error => { console.error('The walk could not run: ' + (error.message || error)); process.exit(2); });
