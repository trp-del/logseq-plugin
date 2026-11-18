#!/usr/bin/env node
/* node split-try.js <out dir>   Goalpost lines 2.2 and 5.6: two pages side by side never leaves a blank half.
   In the checks' own Logseq, a ⌘-click on a page's name in a property's value on Dr. Mei Chen, from each state the right sidebar
   can be in when you press: never opened; shut on the Ontology tab (as a split leaves it); shut on the Todo tab; open on the
   Ontology tab. Each time the right half must show the page within a second and a half and still show it at six, with ⇄ and × in
   the corner and nothing said in the console. Then × must put the sidebar back. Read-only: nothing is written to the graph. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'split-try'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const side = () => page.evaluate(() => { const s = document.querySelector('#right-sidebar'); const r = s?.getBoundingClientRect(); return { split: !!document.querySelector('[data-lk-split]'), corner: document.querySelectorAll('.lk-split-tools .lk-tool').length, width: Math.round(r?.width || 0), words: (s?.innerText || '').trim().slice(0, 50).replace(/\n/g, ' | '), tab: s?.getAttribute('data-lk-tab') || '', list: JSON.stringify((window.logseq.api.get_state_from_store('sidebar/blocks') || []).map(e => [e?.[1], e?.[2]])), open: !!window.logseq.api.get_state_from_store('ui/sidebar-open?') }; });
  const press = async () => {
    const spot = await page.evaluate(() => { const a = [...document.querySelectorAll('#main-content-container a, #main-content-container .page-ref')].filter(e => /Northgate Cancer Center/.test(e.innerText) && e.innerText.length < 40).find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top > 60 && r.top < innerHeight - 40; }); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!spot) throw new Error('no link to Northgate Cancer Center on Dr. Mei Chen');
    await page.keyboard.down('Meta'); await page.mouse.click(spot.x, spot.y); await page.keyboard.up('Meta');
  };
  const closeSplit = async () => { const x = page.locator('.lk-split-tools .lk-split-x'); if (await x.count()) await x.first().click().catch(() => {}); await sleep(1800); };
  const visible = async on => { await frame().evaluate(on => logseq.App.setRightSidebarVisible(on), on); await sleep(900); };
  const shut = () => visible(false);
  // Since 17 November 2026 the sidebar is Logseq's stacked sections: Todo is opened in it by its toolbar button, Ontology comes by itself on a tag's page.
  const todoOpen = () => page.evaluate(() => (window.logseq.api.get_state_from_store('sidebar/blocks') || []).some(e => String(e?.[1]).includes('todo')));
  const openTodo = async () => { await visible(true); if (await todoOpen()) return true; const b = page.locator('.lk-tool[title="Todo"]'); if (await b.count()) { await b.first().click(); await sleep(1200); return true; } console.log('     (no Todo button)'); return false; };
  const STATES = [
    ['the sidebar as this Logseq left it', async () => {}],
    ['shut, as the split before left it', async () => {}],
    ['shut, with Todo opened in it', async () => { await openTodo(); await shut(); }],
    ['open, with nothing opened', async () => { await visible(true); }],
    ['open, with Todo opened in it', async () => { await openTodo(); }],
    // The page split to already in the sidebar, under Todo: the split moves it to the top, and closing it must put the order back.
    ['open, with the page and then Todo opened in it', async () => { await visible(true); const closeTodo = page.locator('#right-sidebar .sidebar-item', { hasText: 'Todo' }).locator('.item-actions button').last(); if (await todoOpen() && await closeTodo.count()) { await closeTodo.click(); await sleep(900); await visible(true); } await frame().evaluate(async () => { const p = await logseq.Editor.getPage('Northgate Cancer Center'); if (p) await logseq.Editor.openInRightSidebar(p.uuid); }); await sleep(1200); await openTodo(); }],
  ];
  const rounds = [];
  for (const [name, prepare] of STATES) {
    await go(page, 'Dr. Mei Chen');
    await prepare();
    const before = await side();
    await press();
    await sleep(1500); const early = await side();
    await page.screenshot({ path: path.join(out, `split-${rounds.length + 1}.png`) });
    await sleep(4500); const late = await side();
    const good = s => s.split && s.corner === 2 && s.words.length > 12 && /Northgate Cancer Center/.test(s.words);
    await closeSplit();
    const after = await side();
    // Back as it was: no split, open or shut as before, and the same sections in the sidebar's list in the same order.
    const back = !after.split && after.open === before.open && after.list === before.list;
    const ok = good(early) && good(late) && back;
    rounds.push({ name, ok, before: before.tab + (before.open ? ' open' : ' shut'), early: good(early), late: good(late), back, words: late.words });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: page shown at 1.5 s ${good(early)}, at 6 s ${good(late)}, sidebar back as it was ${back} (was ${before.tab || 'no tab'}${before.open ? ', open' : ', shut'}; now ${after.tab || 'no tab'}${after.open ? ', open' : ', shut'})`);
  }
  await shut();
  const noise = ours(said);
  for (const s of [...new Set(noise.map(s => s.type + ': ' + s.text.slice(0, 200)))]) console.log('console ' + s);
  const good = rounds.filter(r => r.ok).length, ok = good === rounds.length && !noise.length;
  const words = `${good} of ${rounds.length} splits drew the page and put the sidebar back${noise.length ? `; the console said ${noise.length} thing(s)` : ''}`;
  await finish(browser, { '2.2': { ok, said: words }, '5.6': { ok, said: words } });
})().catch(fail);
