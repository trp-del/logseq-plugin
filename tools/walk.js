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
      return is([(await lists()).map(l => l.lists.length), await page.evaluate(() => { const ids = [...document.querySelectorAll('style[id^="lk-style"]')].map(el => el.id); return ids.length - new Set(ids).size; }), await count('.lk-place')], [[1, 0], 0, 1]);
    });
    await step('the dark theme carries the same greys', async () => {
      await page.evaluate(() => window.logseq.api.set_theme_mode('dark')); await wait(600);
      const got = await page.evaluate(() => { const row = document.querySelector('.lk-row .lk-words'), day = document.querySelector('.lk-row .lk-day'); const lum = c => { const m = c.match(/[\d.]+/g).map(Number), k = /^color\(/.test(c) ? 255 : 1; return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000 * k * (m[3] ?? 1); }; return lum(getComputedStyle(row).color) > 150 && lum(getComputedStyle(day).color) > 40; });
      await page.evaluate(() => window.logseq.api.set_theme_mode('light'));
      return is(got, true);
    });
    // ---- Arriving: Find
    await goto(FATIGUE);
    await step('Cmd-K opens Find on the kinds of things, as an outline', async () => {
      await page.keyboard.press('Meta+k'); await wait(700);
      return is(await page.locator('.lk-find .lk-kind').evaluateAll(els => els.slice(0, 4).map(el => [el.innerText, el.style.paddingLeft])), [['Entity', '8px'], ['Organization', '26px'], ['Hospital', '44px'], ['Person', '26px']]);
    });
    await step('typed words find kinds by name and nodes through Logseq\'s own search', async () => {
      await page.keyboard.type('consul', { delay: 30 }); await wait(900);
      return is([await page.locator('.lk-find .lk-kind').allInnerTexts(), (await count('.lk-find .lk-row')) > 0], [['Consultation'], true]);
    });
    await step('a kind taken stands in the line; words then narrow by a value and a month, and say the value', async () => {
      await page.keyboard.press('Enter'); await wait(900);
      const all = await count('.lk-find .lk-row');
      await page.keyboard.type('neuro oct', { delay: 30 }); await wait(700);
      return is([await page.locator('.lk-find .lk-piece').innerText(), all > 2, await page.locator('.lk-find .lk-row .lk-day').allInnerTexts(), await page.locator('.lk-find .lk-row .lk-why').first().innerText()], ['Consultation', true, ['Oct 7'], 'Peripheral neuropathy']);
    });
    await step('in Find the day stands at the right end of its row, right-aligned, after the words', async () => {   // the owner, 25 November 2026
      const at = await page.evaluate(() => { const list = document.querySelector('.lk-find-rows').getBoundingClientRect();
        return [...document.querySelectorAll('.lk-find .lk-row')].filter(r => r.querySelector(':scope > .lk-day')?.textContent).map(r => { const range = document.createRange(); range.selectNodeContents(r.querySelector(':scope > .lk-day')); const day = range.getBoundingClientRect(), words = r.querySelector('.lk-words').getBoundingClientRect(); return [day.left > words.right, Math.round(list.right - day.right)]; }); });
      return is([at.length > 0, at.every(one => one[0]), [...new Set(at.map(one => one[1]))].length], [true, true, 1]);
    });
    await step('Right arrow opens the found node in place, where its line stood; Escape goes back a step at a time', async () => {
      await page.keyboard.press('Meta+a'); await page.keyboard.type('chen', { delay: 30 }); await wait(700);   // two rows, so one stays closed to measure against
      await page.keyboard.press('ArrowRight'); await wait(1800);
      const at = await page.evaluate(() => { const open = document.querySelector('.lk-find .lk-row[data-open]'), closed = document.querySelector('.lk-find .lk-row:not([data-open])'); return open && closed ? Math.round(open.querySelector('.lk-editor .block-content-wrapper').getBoundingClientRect().left - closed.querySelector('.lk-words').getBoundingClientRect().left) : 'no row'; });
      await page.keyboard.press('Escape'); await wait(300); const open = await count('.lk-find .lk-row[data-open]');
      await page.keyboard.press('Escape'); await wait(300); const text = await page.locator('.lk-find .lk-field').inputValue();
      await page.keyboard.press('Escape'); await wait(300); const kind = await page.locator('.lk-find .lk-piece').isHidden();
      await page.keyboard.press('Escape'); await wait(300);
      return is([at, open, text, kind, await count('.lk-find')], [0, 0, '', true, 0]);
    });
    await step('Enter goes to the node and closes Find', async () => {
      await page.keyboard.press('Meta+k'); await wait(500); await page.keyboard.type('northgate', { delay: 30 }); await wait(1000);
      await page.keyboard.press('Enter'); await wait(1800);
      return is([await count('.lk-find'), await page.evaluate(() => location.hash.includes('1a000000-0000-4000-8000-000000000002'))], [0, true]);
    });
    // ---- Arriving: Todo
    await step('the toolbar\'s checkmark opens Todo in the sidebar, under its own name', async () => {
      await page.locator('#head a[title="Todo"]').first().click(); await wait(2200);
      return is([await page.evaluate(() => document.getElementById('_sidebar.lk-todo')?.textContent), await count('.lk-todo .lk-field')], ['Todo', 1]);
    });
    await step('a task typed in its line lands on today\'s journal as a Todo and shows under Any time', async () => {
      await page.locator('.lk-todo .lk-field').click(); await page.keyboard.type('Ring the pharmacy', { delay: 20 }); await page.keyboard.press('Enter'); await wait(2200);
      return is(await page.evaluate(() => [...document.querySelectorAll('.lk-todo .lk-list')].filter(l => l.querySelector('.lk-list-name').innerText === 'Any time').map(l => [...l.querySelectorAll('.lk-line')].map(el => el.innerText).filter(t => t === 'Ring the pharmacy').length)), [1]);
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
    await step('the toolbar\'s tree opens Ontology: the tags as an outline in their own face, then the properties', async () => {
      await page.locator('#head a[title="Ontology"]').first().click(); await wait(2500);
      return is(await page.evaluate(() => { const lists = [...document.querySelectorAll('.lk-ontology > .lk-list')]; const first = lists[0]?.querySelectorAll('.lk-row'); return [lists.map(l => l.querySelector('.lk-list-name').innerText), [...(first || [])].slice(0, 3).map(r => [r.querySelector('.lk-line').innerText, r.style.getPropertyValue('--lk-depth')]), /New York|serif/.test(getComputedStyle(first[0].querySelector('.lk-words')).fontFamily)]; }),
        [['Tags', 'Properties'], [['Entity', '0'], ['Organization', '1'], ['Hospital', '2']], true]);
    });
    await step('a tag opens in place as Logseq\'s own page for it, where it is renamed and moved', async () => {
      await page.locator('.lk-ontology .lk-row .lk-line', { hasText: 'Hospital' }).first().click(); await wait(2500);
      const name = await page.evaluate(() => document.querySelector('.lk-ontology .lk-row[data-open] .lk-editor .ls-page-title-container')?.innerText.trim().split('\n')[0]);
      await page.locator('.lk-ontology .lk-row[data-open] .lk-editor .is-page-title-row .block-control').click(); await wait(900);   // Logseq's own arrow unfolds what the tag keeps
      const extends_ = await page.evaluate(() => /Extends/.test(document.querySelector('.lk-ontology .lk-row[data-open] .lk-editor').innerText));
      await page.locator('.lk-ontology .lk-row[data-open] .lk-editor .is-page-title-row .block-control').click(); await wait(500);
      await page.locator('.lk-ontology .lk-row[data-open] > .lk-fold').click(); await wait(400);
      return is([name, extends_, await count('.lk-ontology .lk-row[data-open]')], ['Hospital', true, 0]);
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
    await step('nothing the plugin did was said as an error', async () => is(errors, []));
  } finally {
    if (!keep) { await sandbox.stop(box); fs.rmSync(DIR, { recursive: true, force: true }); }
  }
  if (faults.length) { console.log(`The walk found ${faults.length} of ${n} steps wrong:\n  ` + faults.join('\n  ')); process.exit(1); }
  console.log(`The walk passed: ${n} steps in a real Logseq.`);
  process.exit(0);
})().catch(error => { console.error('The walk could not run: ' + (error.message || error)); process.exit(2); });
