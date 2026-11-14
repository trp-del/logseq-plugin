#!/usr/bin/env node
/* node tools/view-change-check.js [part of a name]   (Logseq with its debugging port on the Illness Test Graph, Playwright on NODE_PATH)
   Every view or panel that redraws, recorded frame by frame while it changes, read-only (12 November 2026, after the Item tab
   was found to go blank for a tenth of a second on every row change). For each change the screencast's pictures are read and the
   share of the changing area that holds anything drawn (its "ink") is taken on every frame. A change FAILS when a frame after it
   began holds less than 45% of the ink of both its first and its last frame: the area stood blank, or half drawn, in between.
   The changes: the Item tab from row to row by a press and by the arrow keys; the sidebar's tabs; the Ontology tab from tag to tag
   and tag to property; a page to a page with Links and with Outline open; Linked folding, opening and its kinds; the map's three
   views; Find opening and typing; the settings window's places; the export window's three targets.
   One change is Logseq's own and only reported: a tag's page opening in the main view, which Logseq draws empty first.
   It types only into Find's box, writes nothing to the graph and leaves Logseq on Dr. Mei Chen with every window closed. */
const path = require('node:path'), fs = require('node:fs');
let chromium; try { ({ chromium } = require('playwright')); } catch (error) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }
const K = require('./frame-kit');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '../dist/view-change-check');
const LOGSEQS_OWN = new Set(['main-tag-page-open']);
async function connect({ allowEditing = false } = {}) {
  let browser; try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) { console.log('skipped: Logseq is not reachable on its debugging port'); process.exit(2); }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const graph = String(await page.evaluate(async () => (await logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (graph !== 'Illness Test Graph') throw new Error('open graph is "' + graph + '": nothing touched');
  if (!allowEditing && await page.evaluate(() => !!logseq.api.check_editing())) throw new Error('a block is being edited');
  const rv = { browser, page, sleep, K, console: [] };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) rv.console.push({ type: m.type(), text: m.text().slice(0, 400), at: Date.now() }); });
  page.on('pageerror', e => rv.console.push({ type: 'pageerror', text: String(e.message).slice(0, 400), at: Date.now() }));
  rv.frame = () => page.frames().find(f => f.url().includes('/logseq-plugin_index'));
  rv.go = async (name, wait = 1800) => { await rv.frame().evaluate(n => logseq.App.pushState('page', { name: n }), name); await sleep(wait); };
  rv.hash = async (h, wait = 1500) => { await page.evaluate(x => { location.hash = x; }, h); await sleep(wait); };
  rv.shot = async (name, clip) => { fs.mkdirSync(OUT, { recursive: true }); const file = path.join(OUT, name + '.png'); await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
  rv.theme = () => page.evaluate(() => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  // rects of elements: [{sel, i, text, x, y, w, h, cy, font, size, weight, color, bg}]
  rv.measure = (sels, root) => page.evaluate(([sels, root]) => {
    const base = root ? document.querySelector(root) : document; const out = [];
    for (const sel of sels) [...(base?.querySelectorAll(sel) || [])].slice(0, 40).forEach((el, i) => { const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; const s = getComputedStyle(el);
      out.push({ sel, i, text: (el.textContent || '').trim().slice(0, 30), x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cy: +(r.top + r.height / 2).toFixed(1), right: +r.right.toFixed(1), font: s.fontFamily.slice(0, 30), size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, op: s.opacity }); });
    return out; }, [sels, root || null]);
  // record frames while fn runs; returns frames [{t,png}] and writes a GIF when name is given
  rv.record = async (fn, { after = 900, name = null, clip = null, slow = 1 } = {}) => {
    const session = await page.context().newCDPSession(page);
    const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const cast = await K.screencast(session, { ...vp, offset: await K.wallOffset(page) });
    await sleep(250); const t0 = await page.evaluate(() => performance.now());
    await fn(); await sleep(after);
    const frames = await cast.stop(); await session.detach().catch(() => {});
    const out = { t0, frames };
    if (name) { const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      frames.forEach((f, i) => fs.writeFileSync(path.join(dir, String(i).padStart(3, '0') + '_' + Math.round(f.t - t0) + '.png'), f.png));
      out.dir = dir; }
    return out;
  };
  // share of pixels in a region that differ from the region's ground (corner pixel), per frame: a blank frame has ~0 ink
  rv.ink = (frames, t0, region, scale = 2) => frames.map(f => { const img = K.decodePng(f.png); const sx = img.width / region.vw;
    const x0 = Math.round(region.x * sx), y0 = Math.round(region.y * sx), w = Math.round(region.w * sx), h = Math.round(region.h * sx);
    const at = (x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
    const g = at(x0 + 2, y0 + 2); let n = 0, tot = 0;
    for (let y = y0; y < y0 + h && y < img.height; y += 2) for (let x = x0; x < x0 + w && x < img.width; x += 2) { tot++; const p = at(x, y); if (Math.abs(p[0] - g[0]) + Math.abs(p[1] - g[1]) + Math.abs(p[2] - g[2]) > 60) n++; }
    return { t: Math.round(f.t - t0), ink: +(100 * n / Math.max(1, tot)).toFixed(2) }; });
  rv.close = async () => { await browser.close(); };
  return rv;
}
(async () => { const rv = await connect(); const { page } = rv; const f = rv.frame(); const only = process.argv[2]; const failed = [];
  const vw = await page.evaluate(() => innerWidth);
  const rect = sel => page.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, sel);
  const tab = k => page.evaluate(k => [...document.querySelectorAll('#right-sidebar .lk-tabs .lk-view')].find(b => b.textContent.trim() === k)?.click(), k);
  const rowAt = async i => { const r = await page.evaluate(i => { const c = document.querySelectorAll('#main-content-container .ls-table-row[blockid]')[i]?.querySelector('.ls-table-cell:nth-child(3), .ls-table-cell:last-child'); const b = c?.getBoundingClientRect(); return b ? { x: b.left + b.width - 12, y: b.top + b.height / 2 } : null; }, i); return r; };
  const results = {};
  const openedItems = () => page.evaluate(() => [...document.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].filter(i => !i.classList.contains('item-type-plugin') && !i.classList.contains('lk-side')).length);
  await rv.go('Dr. Mei Chen', 2000);   // a page with no table: a row's view left by an earlier round is closed before the count
  const itemsAtStart = await openedItems();
  const run = async (name, region, act, after = 1200) => {
    if (only && !name.includes(only)) return;
    const reg = typeof region === 'string' ? await rect(region) : region; if (!reg) { console.log(name, 'NO REGION'); return; }
    const rec = await rv.record(act, { after, name });
    const series = rv.ink(rec.frames, rec.t0, { ...reg, vw });
    const inks = series.map(s => s.ink), first = inks[0] ?? 0, last = inks.at(-1) ?? 0, floor = Math.min(first, last);
    const dips = series.filter(s => s.t > 0 && s.ink < floor * 0.45 && floor > 0.3);
    results[name] = { frames: series.length, first, last, min: Math.min(...inks), dips: dips.map(d => d.t + 'ms:' + d.ink), series: series.filter(s => s.t > -50).map(s => s.t + ':' + s.ink).join(' ') };
    if (dips.length && !LOGSEQS_OWN.has(name)) failed.push(name);
    // A row's view that comes late is a fault too (13 November 2026: a wait added to the swap made it take 0.74 s and nothing here said so).
    const changedAt = series.filter((x, i) => i > 0 && x.ink !== series[i - 1].ink).map(x => x.t).pop() ?? 0;
    if (name.startsWith('item-row') && changedAt > 1000) failed.push(name + ' (the new row showed only after ' + changedAt + ' ms)');
    console.log('\n## ' + name + '  frames ' + series.length + '  ink first ' + first + ' last ' + last + ' min ' + Math.min(...inks) + (dips.length ? '  DIPS ' + dips.map(d => d.t + 'ms=' + d.ink).join(',') : ''));
    console.log('   ' + results[name].series.slice(0, 700));
  };
  const SIDE = { x: (await rect('#right-sidebar')).x + 8, y: 56, w: (await rect('#right-sidebar')).w - 16, h: 560 };
  const MAIN = async () => { const m = await rect('#main-content-container'); return { x: m.x + 20, y: 60, w: m.w - 40, h: 700 }; };
  // 1. Item pane: row to row by press, then by arrow key
  await rv.go('Consultation', 3000); await tab('Ontology'); await sleep(600);
  // The tab row and what the sidebar shows, read on every frame of the Item tab's changes: never an "Opened" tab for a moment, never nothing shown.
  await page.evaluate(() => { window.__seen = []; const step = () => { const row = [...document.querySelectorAll('#right-sidebar .lk-tabs .lk-view')].map(b => b.textContent.trim()).join(','); const shown = [...document.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].filter(i => i.getClientRects().length && getComputedStyle(i).visibility !== 'hidden').length; const k = row + ' | items shown ' + shown; if (window.__seen.at(-1) !== k) window.__seen.push(k); window.__raf = requestAnimationFrame(step); }; step(); });
  let p = await rowAt(3); await page.mouse.click(p.x, p.y); await sleep(1800);
    p = await rowAt(6); await run('item-row-to-row-press', SIDE, () => page.mouse.click(p.x, p.y), 1800);
  await run('item-row-arrow-down', SIDE, () => page.keyboard.press('ArrowDown'), 1800);
  await run('item-row-arrow-down-2', SIDE, () => page.keyboard.press('ArrowDown'), 1800);
  { const seen = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__seen; }); // The tabs the person had before the rows were pressed stay as they were (their own opened pages keep "Opened"); only Item may come.
    const tabsOf = k => k.split(' | ')[0].split(',').filter(t => t !== 'Item').join(','), first = tabsOf(seen[0] || '');
    const bad = seen.filter(k => tabsOf(k) !== first || !/items shown 1$/.test(k));
    if (!only || 'item'.includes(only)) { console.log('   tab row while rows change: ' + seen.join('  →  ')); if (bad.length) failed.push('item-tab-row (' + bad.join('; ') + ')'); } }
  // 2. sidebar tabs
  await run('tab-item-to-ontology', SIDE, () => tab('Ontology'));
  await run('tab-ontology-to-links', SIDE, () => tab('Links'));
  await run('tab-links-to-item', SIDE, () => tab('Item'));
  await run('tab-item-to-ontology-2', SIDE, () => tab('Ontology'));
  // 3. Ontology tab: tag to tag (page change), tag to property
  await run('ontology-tag-to-tag', SIDE, () => f.evaluate(() => logseq.App.pushState('page', { name: 'Conversation' })), 2500);
  await run('ontology-tag-to-property', SIDE, () => f.evaluate(() => logseq.App.pushState('page', { name: 'Provider' })), 2500);
  await run('main-tag-page-open', await MAIN(), () => f.evaluate(() => logseq.App.pushState('page', { name: 'Consultation' })), 2500);
  // 4. page to page with the sidebar on Links
  await rv.go('Dr. Mei Chen', 2500); await tab('Links'); await sleep(800);
  await run('links-tab-page-to-page', SIDE, () => f.evaluate(() => logseq.App.pushState('page', { name: 'Fatigue' })), 2500);
  await run('main-page-to-page', await MAIN(), () => f.evaluate(() => logseq.App.pushState('page', { name: 'Dr. Mei Chen' })), 2500);
  await rv.go('ZZ Review 2026-11-12', 2500); await tab('Outline'); await sleep(800);
  await run('outline-tab-page-to-page', SIDE, () => f.evaluate(() => logseq.App.pushState('page', { name: 'Dr. Mei Chen' })), 2500);
  // 5. Linked: fold and open, kind tabs
  await rv.go('Fatigue', 3000);
  const fold = () => page.evaluate(() => (document.querySelector('.th-two-way .th-tw-rule .lk-fold, .th-two-way .th-tw-rule button, .th-two-way .th-tw-rule'))?.click());
  await run('linked-fold', await MAIN(), fold, 1500);
  await run('linked-open', await MAIN(), fold, 1500);
  await run('linked-kind-tab', await MAIN(), () => page.evaluate(() => document.querySelectorAll('.th-two-way .lk-view')[1]?.click()), 1500);
  await run('linked-kind-tab-back', await MAIN(), () => page.evaluate(() => document.querySelectorAll('.th-two-way .lk-view')[0]?.click()), 1500);
  // 6. the map's views
  await rv.hash('#/structure', 2500);
  const view = w => page.evaluate(w => [...document.querySelectorAll('.st .lk-view')].find(b => b.textContent.trim().startsWith(w))?.click(), w);
  await run('map-to-every-property', await MAIN(), () => view('Every property'), 1600);
  await run('map-to-log', await MAIN(), () => view('Log'), 1600);
  await run('map-to-regions', await MAIN(), () => view('Regions'), 1600);
  // 7. Find: open, type
  await rv.go('Dr. Mei Chen', 2500);
  await run('find-open', { x: 300, y: 100, w: 890, h: 600 }, () => page.evaluate(() => document.getElementById('search-button').click()), 3200);
  await run('find-type', { x: 300, y: 160, w: 890, h: 500 }, async () => { for (const ch of 'mei chen') { await page.keyboard.press(ch === ' ' ? 'Space' : ch); await sleep(90); } }, 1500);
  await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape'); await sleep(400);
  // 8. settings: place to place
  await f.evaluate(() => window.PluginDoor.settings.open()); await sleep(1500);
  const place = w => page.evaluate(w => [...document.querySelectorAll('.sw-side button, .sw-side a, .sw-side [role=button], .sw-side *')].find(b => b.children.length === 0 && b.textContent.trim() === w)?.click(), w);
  await run('settings-place', { x: 260, y: 105, w: 1160, h: 800 }, () => place('A page'), 1300);
  await run('settings-place-2', { x: 260, y: 105, w: 1160, h: 800 }, () => place('Keys'), 1300);
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500);
  // 9. export: targets
  f.evaluate(() => window.DbExport.app.exportWindow()).catch(() => {}); await sleep(3500);
  const xt = w => page.evaluate(w => [...document.querySelectorAll('.lk-view')].find(b => b.textContent.trim() === w)?.click(), w);
  await run('export-to-pdf', { x: 200, y: 120, w: 1100, h: 800 }, () => xt('PDF'), 2500);
  await run('export-to-rich', { x: 200, y: 120, w: 1100, h: 800 }, () => xt('Rich text'), 2500);
  await run('export-to-markdown', { x: 200, y: 120, w: 1100, h: 800 }, () => xt('Markdown'), 2500);
  await page.keyboard.press('Escape'); await sleep(600);
  await rv.go('Dr. Mei Chen', 1500);
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  console.log('\nconsole:', JSON.stringify(rv.console.slice(0, 20)));
  console.log(JSON.stringify(await page.evaluate(() => ({ dialogs: document.querySelectorAll('dialog[open]').length, editing: logseq.api.check_editing(), hash: decodeURIComponent(location.hash).slice(0, 60) }))));
  { const left = await openedItems(); if (left !== itemsAtStart) failed.push('the sidebar holds ' + left + ' opened items at the end, ' + itemsAtStart + ' at the start: a row\'s view was left behind'); }
  await rv.close();
  if (failed.length) { for (const name of failed) console.log('PROBLEM: ' + (name.includes(' ') ? name : name + ' stood blank or half drawn while it changed (frames in dist/view-change-check/' + name + '/)')); console.log('view-change-check: FAILED (' + failed.length + ')'); process.exit(1); }
  console.log('view-change-check: OK (' + Object.keys(results).length + ' changes, none blank)'); })().catch(e => { console.log('PROBLEM: ' + (e.stack || e)); process.exit(1); });
