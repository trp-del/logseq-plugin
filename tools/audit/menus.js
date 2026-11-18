#!/usr/bin/env node
/* node menus.js <out dir>   Goalpost line 3.3: menus and tabs use plain words, with an icon before every menu line.
   The plugin's menus are opened as a person opens them: a tag's row on the Ontology map by right-click; a property's row in
   Ontology's Properties by right-click; Todo's Group by; and the sidebar's tabs are read. Each line of each menu must carry an
   icon (the library's lk-i-* mark, or an icon drawn inside it) and plain words (no code names, no lone symbols). Nothing written. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, route, sleep, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'menus'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const menu = () => page.evaluate(() => { const m = [...document.querySelectorAll('.lk-menu, .st-menu')].filter(e => e.getBoundingClientRect().width > 0).pop(); if (!m) return null; return [...m.querySelectorAll('.lk-item')].filter(i => i.innerText.trim() && !i.classList.contains('gap') && !i.classList.contains('lk-group')).map(i => ({ words: i.innerText.trim().split('\n')[0], icon: [...i.classList].some(c => /^lk-i-/.test(c)) || !!i.querySelector('svg, [class*="lk-i-"], .lk-status, i, img') || !!i.dataset.lkMenuIcon })); });
  const faults = [], seen = [];
  const take = async (where, open) => { await open(); await sleep(700); const m = await menu(); await page.screenshot({ path: path.join(out, where.replace(/\W+/g, '-') + '.png') }); if (!m || !m.length) { faults.push(`${where}: no menu opened`); return; } for (const l of m) { seen.push(`${where}: ${l.words}`); if (!l.icon) faults.push(`${where}: “${l.words}” has no icon`); if (/[_{}]|^[a-z]+[A-Z]/.test(l.words)) faults.push(`${where}: “${l.words}” is not plain words`); } await page.keyboard.press('Escape'); await sleep(300); };
  await route(page, '#/structure', 3000);
  await take('a tag on the Ontology map', async () => { const r = page.locator('.st-row .nm', { hasText: /^Report$/ }).first(); await r.click({ button: 'right' }); });
  await take('a property in Ontology\'s Properties', async () => { await page.locator('[data-show="table"]').first().click(); await sleep(900); await page.locator('.st-tbl .tr .n, .st-tbl .tr').first().click({ button: 'right' }); });
  await route(page, '#/todo', 2500);
  await take('Todo\'s Group by', async () => { await page.locator('#main-content-container [data-by]').first().click({ timeout: 8000 }); });
  // Linked on Dr. Mei Chen: a list's name, and a node's line, by right-click.
  await require('./kit').go(page, 'Dr. Mei Chen', 3000);
  await take('a list\'s name in Linked', async () => { await page.locator('#main-content-container .th-tw-row .th-tw-name').first().click({ button: 'right' }); });
  await take('a node\'s line in Linked', async () => { await page.locator('#main-content-container .th-tw-line[data-uuid] .th-tw-record').first().click({ button: 'right' }); });
  // A list's ··· at its head: its View choices, then Move up and Move down among the page's lists.
  await take('the ··· of a list in Relations', async () => { await page.locator('#main-content-container .th-tw-groupby').first().click(); });
  // A property's own page: a line for each tag it is on, and that line's right-click menu (Split by its values… among them).
  await require('./kit').go(page, 'Provider', 3000);
  if (await page.locator('.ont[data-prop]').count()) await take('a tag\'s line on a property\'s page', async () => { await page.locator('.ont[data-prop]').first().click({ button: 'right' }); });
  else console.log('     (no line for a tag on Provider\'s page)');
  // The Recycle as a plain list, from Relations' troubleshooting (a list of tools; this one changes notes only on a press of its own).
  await take('the Recycle list (troubleshooting)', async () => { await page.evaluate(() => { const c = (window.logseq.api.get_state_from_store('command-palette/commands') || []).find(c => /^:?plugin\.logseq-plugin\//.test(String(c.id)) && /troubleshooting$/.test(String(c.desc))); c?.action?.(); }); await sleep(900); await page.locator('.th-pop .lk-item, .th-pop [role="menuitem"]', { hasText: /Recycle as a plain list/ }).first().click(); await sleep(1500); });
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(200); }
  // The Outline tab's ⋯, on a page with headings.
  { const heads = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?n :where [?b :logseq.property/heading _] [?b :block/page ?p] [?p :block/name ?n]]'))?.[0]?.[0]);
    if (heads) { await require('./kit').go(page, heads, 2500); await page.evaluate(() => window.logseq.api.set_right_sidebar_visible?.(true)); await sleep(700);
      const tab = page.locator('#right-sidebar .lk-tabs .lk-view', { hasText: /^Outline$/ }); if (await tab.count()) { await tab.first().click(); await sleep(800); }
      if (await page.locator('#right-sidebar .lk-contents-more').count()) await take('the Outline tab\'s ⋯', async () => { await page.locator('#right-sidebar .lk-contents-more').first().click(); });
      else console.log('     (the Outline tab showed no ⋯ on ' + heads + ')'); }
    else console.log('     (no page with headings in this graph: the Outline tab\'s menu was not opened)'); }
  // The map is left on its Tags view, as it was found (the view is kept between visits).
  await route(page, '#/structure', 2000); { const t = page.locator('[data-show="tree"]'); if (await t.count()) { await t.first().click(); await sleep(500); } }
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#right-sidebar .lk-tabs .lk-view')].map(t => t.innerText.trim()));
  for (const t of tabs) if (!t || /[_{}]/.test(t)) faults.push(`the sidebar's tab “${t}” is not a plain word`);
  const noise = ours(said); if (noise.length) faults.push('the console said: ' + noise[0].text.slice(0, 120));
  fs.writeFileSync(path.join(out, 'tried-menus.json'), JSON.stringify({ seen }, null, 1));
  console.log(`${seen.length} menu lines read in the plugin's menus; the sidebar's tabs: ${tabs.join(', ') || '(sidebar shut)'}`);
  for (const f of faults) console.log('FAIL ' + f);
  await finish(browser, { '3.3': { ok: !faults.length && seen.length >= 15, said: faults.length ? `${faults.length} menu line(s) without an icon or plain words: ${faults[0]}` : `${seen.length} lines in the plugin's menus, each with its icon and plain words` } });
})().catch(fail);
