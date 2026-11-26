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
  const lists = () => page.evaluate(() => [...document.querySelectorAll('.lk-rel')].map(rel => ({ where: rel.closest('#right-sidebar') ? 'sidebar' : rel.closest('.lk-open') ? 'opened' : 'main', lists: [...rel.querySelectorAll(':scope > .lk-list')].map(l => `${[l.querySelector('.lk-list-via').innerText, l.querySelector('.lk-list-name').innerText].filter(Boolean).join('\n')} (${l.querySelectorAll(':scope > .lk-rows > .lk-row').length})`) })));
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
    await step('a list folds and unfolds on its name, and stays folded on another page', async () => {
      await page.locator('.lk-list-head').first().click(); await wait(500);
      const hidden = await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden);
      await page.locator('.lk-list-head').first().click(); await wait(500);
      return is([hidden, await page.evaluate(() => document.querySelector('.lk-list .lk-rows').hidden)], [true, false]);
    });
    await goto(NORTHGATE);
    await step('a page opened in a row reads as a line: its name the size of the words, its own lists under it', async () => {
      await page.locator('.lk-row .lk-line').first().click(); await wait(2200);
      return is(await page.evaluate(() => { const ed = document.querySelector('.lk-editor'); return [getComputedStyle(ed.querySelector('.ls-page-title-container')).fontSize, [...document.querySelectorAll('.lk-open > .lk-rel > .lk-list > .lk-list-head')].map(el => [el.querySelector('.lk-list-via').innerText, el.querySelector('.lk-list-name').innerText].filter(Boolean).join('\n'))]; }), ['16px', ['Decided\nDecision 3', 'Provider of\nConsultation 2']]);
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
    await step('Search shows only what holds every word, each node once, grouped by kind, the typed letters marked', async () => {   // the owner's marked page, 26 November 2026
      await page.keyboard.type('chen', { delay: 30 }); await wait(1500);
      const got = await page.evaluate(() => { const rows = [...document.querySelectorAll('.lk-search .lk-row')]; return [rows.length > 0, rows.every(r => /chen/i.test(r.querySelector('.lk-words').textContent)), new Set(rows.map(r => r.dataset.uuid)).size === rows.length, document.querySelectorAll('.lk-search .lk-list-name').length > 1, rows.every(r => r.querySelector('mark.lk-hit'))]; });
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
    await step('a node dug into names itself and never lists the node it was dug from', async () => {
      const row = page.locator('#main-content-container .lk-row', { hasText: 'Video call' }).first(), uuid = await row.getAttribute('data-uuid');
      await row.locator('.lk-words').click(); await wait(2200);
      await page.evaluate(() => { const a = [...document.querySelectorAll('#main-content-container .lk-editor .property-value-inner[data-type=node] a.page-ref')].pop(); const r = a.getBoundingClientRect(); a.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 3, clientY: r.top + 8 })); });
      await wait(2200);
      const got = await page.evaluate(u => [!!document.querySelector('.lk-dugopen > .lk-dugname')?.textContent.trim(), document.querySelectorAll(`.lk-dugopen .lk-row[data-uuid="${u}"]`).length], uuid);
      await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(300);
      return is(got, [true, 0]);
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
    // ---- Arriving: Todo
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
    await step('In the sidebar, on that page, opens the outline beside whatever you read: the tags in their own face, then the properties', async () => {
      await page.locator('.lk-map > .lk-side').click(); await wait(2500); await goto(CHEN);   // the outline beside a page, the page of its own left behind
      
      return is(await page.evaluate(() => { const lists = [...document.querySelectorAll('.lk-ontology > .lk-rel > .lk-list')]; const first = lists[0]?.querySelectorAll('.lk-row'); return [lists.map(l => l.querySelector('.lk-list-name').innerText), [...(first || [])].slice(0, 3).map(r => [r.querySelector('.lk-line').innerText, r.style.getPropertyValue('--lk-depth')]), /New York|serif/.test(getComputedStyle(first[0].querySelector('.lk-words')).fontFamily)]; }),
        [['Tags', 'Properties'], [['Entity\n24', '0'], ['Organization\n5', '1'], ['Hospital\n3', '2']], true]);
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
    await step('every list\'s head is one look: the property\'s name with the arrow, under it its kinds with their counts; the days only on the rows', async () => {   // the owner's marked page, 26 November 2026
      const heads = await page.evaluate(sel => { const box = el => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect(); };
        return [...document.querySelectorAll(sel)].filter(l => l.dataset.kind === 'property' && l.querySelector('.lk-tab')).map(l => { const name = box(l.querySelector('.lk-list-via .lk-prop')), arrow = l.querySelector('.lk-list-head > .lk-fold').getBoundingClientRect(), tab = box(l.querySelector('.lk-tab'));
          return [Math.abs((arrow.top + arrow.bottom) / 2 - (name.top + name.bottom) / 2) < 6, name.bottom <= tab.top + 1, !l.querySelector('.lk-list-head .lk-span'), /\d/.test(l.querySelector('.lk-tab').innerText)]; }); }, MAIN);
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
        return [box.dataset.node, Math.round(under.top - valueRow.getBoundingClientRect().bottom), next ? next.getBoundingClientRect().top >= under.bottom - 1 : true, Math.abs(left(box) - left(value)) < 1.5]; });
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
    await step('a tag\'s menu shows its nodes in Search and offers to put it under another tag', async () => {
      await page.locator('.lk-ontology .lk-row', { hasText: /^Consultation/ }).first().locator('.lk-line').click({ button: 'right' }); await wait(500);
      const items = await page.locator('.lk-menu .lk-item').allInnerTexts();
      await page.locator('.lk-menu .lk-item', { hasText: 'Show its nodes' }).click(); await wait(1500);
      const piece = await page.locator('.lk-search .lk-piece').innerText().catch(() => '');
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await wait(250); }
      return is([items.includes('Show its nodes'), items.includes('Put under…'), piece], [true, true, 'Consultation']);
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
      await goto(CHEN); await run();
      await page.locator('#main-content-container .block-add-button').first().click(); await wait(900);
      await page.keyboard.type('up', { delay: 150 }); await wait(2500);
      const typed = [await page.evaluate(() => document.activeElement?.value), await run()];
      await page.keyboard.press('Meta+z'); await page.keyboard.press('Escape'); await wait(700);
      await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('u'); await wait(150); await page.keyboard.press('p');
      const said = await toast(); await wait(4500);
      return is([typed, /^Plugins up to date: Logseq Plugin \d/.test(said), await run()], [['up', 2], true, 1]);
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
    await step('the Recycle list shows what Logseq keeps deleted, and Delete asks first with the keyboard on Leave it', async () => {
      await page.keyboard.press('Meta+Shift+p'); await wait(700); await page.keyboard.type('the Recycle list', { delay: 20 }); await wait(700); await page.keyboard.press('Enter'); await wait(2000);
      const rows = await page.locator('.lk-recycle-row').count(), told = await page.locator('.lk-recycle-top').innerText().catch(() => '');
      let asked = 'nothing to delete';
      if (rows) { await page.locator('.lk-recycle-row [data-do="delete"]').first().click(); await wait(400); asked = await page.evaluate(() => document.activeElement?.innerText || ''); await page.keyboard.press('Enter'); await wait(400); }
      const after = await page.locator('.lk-recycle-row').count();
      await goto(CHEN);
      return is([told.length > 0, rows ? asked : 'nothing to delete', after], [true, rows ? 'Leave it' : 'nothing to delete', rows]);
    });
    await step('nothing the plugin did was said as an error', async () => is(errors, []));
  } finally {
    if (!keep) { await sandbox.stop(box); fs.rmSync(DIR, { recursive: true, force: true }); }
  }
  if (faults.length) { console.log(`The walk found ${faults.length} of ${n} steps wrong:\n  ` + faults.join('\n  ')); process.exit(1); }
  console.log(`The walk passed: ${n} steps in a real Logseq.`);
  process.exit(0);
})().catch(error => { console.error('The walk could not run: ' + (error.message || error)); process.exit(2); });
