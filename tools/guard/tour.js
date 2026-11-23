/* The guard's tour (18 November 2026): the same screens, in the same states, set up the same way, on whichever copy of the plugin
   the guard's Logseq runs. Each screen starts from one known state (light, 1440 × 900, nothing open, right sidebar shut, row view
   off), is set up, waits until the screen is still, and is then recorded:
     - two pictures 700 ms apart (what differs between them is the screen's own restlessness, a blinking caret, and is not
       counted as a change),
     - where the plugin's own pieces and Logseq's main pieces stand (to name what moved),
     - how many changes the page makes by itself in 1.5 s once still (an endless redraw shows here),
     - what the console said.
   The screens were chosen from what broke before: a person page, its bullets under the pointer and in writing, a tag's table, the
   row view in the sidebar, a page in the sidebar, a journal day, Find, Todo, Ontology, settings, the key sheet, dark, narrow.
   A screen whose set-up fails is recorded as failed, with why, and the tour goes on. Read-only: it opens, points, presses into a
   bullet and lets go; it types only into Find's box. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OWN = '[class*="lk-"],[class*="th-"],[class*="st-"],[class*="fd-"],[class*="td-"],[class*="xp-"],[class*="sw-"],[class*="sp-"]';
const MAIN = '.ls-page-title,.ls-block,.references,.ls-table-header,.ls-view-head,.sidebar-item,.property-k,.ls-page-blocks,.cp__right-sidebar';

const go = async (page, name) => { await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), name); };
const route = async (page, hash) => { await page.evaluate(h => { location.hash = h; }, hash); };
const pageUuid = (box, name) => box.frame().evaluate(async n => (await logseq.Editor.getPage(n))?.uuid, name);
const inSidebar = async (box, name) => { const id = await pageUuid(box, name); if (!id) throw new Error(`no page “${name}”`); await box.frame().evaluate(id => logseq.Editor.openInRightSidebar(id), id); };
const rowView = (box, on) => box.frame().evaluate(on => window.PluginDoor?.sideTabs?.rows?.(on), on);
// The journal day most pointed at in the graph (the same day on both sides of a comparison, whatever the graph's dates).
const busiestDay = async box => {
  if (box.day) return box.day;
  const rows = await box.frame().evaluate(() => logseq.DB.datascriptQuery('[:find ?t (count ?r) :where [?p :block/journal-day] [?p :block/title ?t] [?r :block/refs ?p]]'));
  const best = (rows || []).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
  if (!best) throw new Error('the graph has no journal day that anything points at');
  return (box.day = best[0]);
};
// The journal day most Deadlines fall on: a day Relations lists (the owner checked Relations on such a day, 18 Nov). Logseq keeps a
// Deadline as a time, so the day's title is made from it as Logseq writes journal titles ("Nov 16th, 2026").
const deadlineDay = async box => {
  const rows = await box.frame().evaluate(() => logseq.DB.datascriptQuery('[:find ?b ?d :where [?b :logseq.property/deadline ?d]]'));
  const count = {};
  for (const [, d] of rows || []) { const t = new Date(Number(d)); if (!isNaN(t)) { const k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); count[k] = (count[k] || 0) + 1; } }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!best) throw new Error('the graph has no Deadline');
  const [y, m, d] = best[0].split('-').map(Number), n = d % 10, th = d >= 11 && d <= 13 ? 'th' : n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}${th}, ${y}`;
};
const firstRow = async page => {
  const cell = await page.$('.ls-table-rows .ls-table-cell:not(.ls-table-cell-checkbox), .ls-table-row .ls-table-cell');
  if (!cell) throw new Error('the page shows no table row');
  await cell.click();
};

// Find's window by its key. On a Logseq started a moment ago the plugin's keys are not yet taken, and the first press does nothing
// (22 November 2026: every Find screen came out as the bare page); so the press is tried until the window stands.
const openFind = async (b, key = 'Meta+k') => {
  const up = () => b.page.evaluate(() => !!document.querySelector('dialog[open].fd'));
  for (let i = 0; i < 4; i++) { await b.page.keyboard.press(key); for (let t = 0; t < 8; t++) { await sleep(150); if (await up()) { await sleep(700); return; } } await sleep(1500); }
  throw new Error('Find did not open on ' + key);
};

// [name, graph, set-up(box), { dark, width }]. Names are the guard's words for the screen; they stay the same across versions.
const SCREENS = [
  ['person', 'Illness Test Graph', async b => go(b.page, 'Dr. Mei Chen')],
  ['person, a bullet under the pointer', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(2000); const el = await b.page.$('.ls-page-blocks .ls-block .block-content'); if (!el) throw new Error('no bullet'); await el.hover(); }, { pointer: true }],
  ['person, writing in a bullet', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(2000); const el = await b.page.$('.ls-page-blocks .ls-block .block-content'); if (!el) throw new Error('no bullet'); await el.click(); }],
  ['person, dark', 'Illness Test Graph', async b => go(b.page, 'Dr. Mei Chen'), { dark: true }],
  ['person, narrow window', 'Illness Test Graph', async b => go(b.page, 'Dr. Mei Chen'), { width: 900 }],
  ['tag with a table', 'Illness Test Graph', async b => go(b.page, 'Consultation')],
  ['tag with a table, dark', 'Illness Test Graph', async b => go(b.page, 'Consultation'), { dark: true }],
  ['property', 'Illness Test Graph', async b => go(b.page, 'Provider')],
  ['journal day', 'Illness Test Graph', async b => go(b.page, await busiestDay(b))],
  ['a page in the right sidebar', 'Illness Test Graph', async b => { await go(b.page, 'Consultation'); await sleep(1500); await inSidebar(b, 'Dr. Mei Chen'); }],
  ['a page in the right sidebar, dark', 'Illness Test Graph', async b => { await go(b.page, 'Consultation'); await sleep(1500); await inSidebar(b, 'Dr. Mei Chen'); }, { dark: true }],
  ['Ontology', 'Illness Test Graph', async b => route(b.page, '#/structure')],
  // On a Logseq started a moment ago the plugin's route is not yet there, and the page before stays (22 November 2026: the picture
  // kept for main showed the Consultation table under the name Todo): the route is asked until Todo's rows stand.
  ['Todo', 'Illness Test Graph', async b => { for (let i = 0; i < 6; i++) { await route(b.page, '#/todo'); for (let t = 0; t < 10; t++) { await sleep(200); if (await b.page.evaluate(() => !!document.querySelector('.td-row, .td-add, [class*="td-head"]'))) return; } await route(b.page, '#/'); await sleep(1200); } throw new Error('Todo did not open'); }],
  ['Find, typed', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b); await b.page.keyboard.type('cons', { delay: 60 }); }],
  // The Find window in every state its keys reach (22 November 2026, before 0.5 gives Find a second host: the window must not move).
  ['Find, in the choices', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b); await b.page.keyboard.type('cons', { delay: 60 }); await sleep(900); await b.page.keyboard.press('Tab'); }],
  ['Find, a row opened', 'Illness Test Graph', async b => { await go(b.page, 'Consultation'); await sleep(1500); await openFind(b); await b.page.keyboard.type('mei chen', { delay: 60 }); await sleep(1500); await b.page.keyboard.press('ArrowRight'); await sleep(1500); }],
  ['Find, a new page offered', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b); await b.page.keyboard.type('zqx wvk', { delay: 60 }); }],
  ['Find, by sentence', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b, 'Meta+Alt+k'); await b.page.keyboard.type('consultation with chen in october', { delay: 40 }); }],
  ['Find, typed, dark', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b); await b.page.keyboard.type('cons', { delay: 60 }); }, { dark: true }],
  ['Find, typed, narrow window', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await openFind(b); await b.page.keyboard.type('cons', { delay: 60 }); }, { width: 700 }],
  ['Find, a row opened, narrow window', 'Illness Test Graph', async b => { await go(b.page, 'Consultation'); await sleep(1500); await openFind(b); await b.page.keyboard.type('mei chen', { delay: 60 }); await sleep(1500); await b.page.keyboard.press('ArrowRight'); await sleep(1500); }, { width: 700 }],
  ['settings window', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await b.page.keyboard.press('g'); await b.page.keyboard.press(','); }],
  ['key sheet', 'Illness Test Graph', async b => { await go(b.page, 'Dr. Mei Chen'); await sleep(1500); await b.page.keyboard.down('Alt'); await sleep(1200); await b.page.keyboard.up('Alt'); }],
  ['table of purchases', 'Personal Finance', async b => go(b.page, 'Purchase')],
  ['row view, a row pressed', 'Personal Finance', async b => { await go(b.page, 'Purchase'); await sleep(2000); await rowView(b, true); await sleep(800); await firstRow(b.page); }],
  ['row view, a row pressed, dark', 'Personal Finance', async b => { await go(b.page, 'Purchase'); await sleep(2000); await rowView(b, true); await sleep(800); await firstRow(b.page); }, { dark: true }],
  ['journal day with Relations', 'Personal Finance', async b => go(b.page, await deadlineDay(b))],
];

// Back to the one known state before every screen.
async function reset(box, { dark = false, width = 1440 } = {}) {
  const { page } = box;
  await page.evaluate(() => document.getElementById('guard-still')?.remove()).catch(() => {});
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(80); }
  await page.mouse.move(720, 6).catch(() => {});   // Logseq's top strip, the window's drag handle: nothing there lights or opens a card
  await rowView(box, false).catch(() => {});
  await box.frame().evaluate(() => logseq.App.setRightSidebarVisible(false)).catch(() => {});
  await page.evaluate(() => window.logseq.api.clear_right_sidebar_blocks?.()).catch(() => {});
  await page.evaluate(m => window.logseq.api.set_theme_mode(m), dark ? 'dark' : 'light');
  await box.cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(200);
}

// Still: nothing on the page changed for 700 ms (at most 8 s of waiting).
const still = page => page.evaluate(() => new Promise(res => {
  let last = performance.now(); const t0 = last;
  const mo = new MutationObserver(() => { last = performance.now(); });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => { const now = performance.now(); if (now - last > 900 || now - t0 > 8000) { mo.disconnect(); res(Math.round(now - t0)); } else setTimeout(tick, 100); };
  setTimeout(tick, 100);
}));

// Changes the page makes by itself in ms, and by what (the three busiest places).
const churn = (page, ms = 600) => page.evaluate(ms => new Promise(res => {
  let n = 0; const who = {};
  const mo = new MutationObserver(rs => { n += rs.length; for (const r of rs) { const t = r.target.nodeType === 1 ? r.target : r.target.parentElement; const k = (t?.tagName || '?').toLowerCase() + '.' + String(t?.className?.baseVal ?? t?.className ?? '').trim().split(/\s+/).slice(0, 2).join('.'); who[k] = (who[k] || 0) + 1; } });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  setTimeout(() => { mo.disconnect(); res({ n, who: Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 3) }); }, ms);
}), ms);

// Where things stand: each visible piece by its name and its place among pieces of that name, its box and its first words.
const layout = page => page.evaluate(([OWN, MAIN]) => {
  const out = {}, seen = {};
  for (const el of document.querySelectorAll(OWN + ',' + MAIN)) {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || s.visibility === 'hidden' || s.display === 'none' || r.bottom < 0 || r.top > innerHeight) continue;
    const cls = String(el.className?.baseVal ?? el.className).trim().split(/\s+/).filter(c => !/^(is-|hover|active|selected|focus)/.test(c)).slice(0, 2).join('.');
    const key = el.tagName.toLowerCase() + '.' + cls; seen[key] = (seen[key] || 0) + 1;
    out[key + '#' + seen[key]] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), words: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
  }
  return out;
}, [OWN, MAIN]);

/* Runs the tour on one graph in a started sandbox (sandbox.js) and writes into dir/<file>.png and returns the records. */
async function tour(box, outDir, only) {
  fs.mkdirSync(outDir, { recursive: true });
  box.cdp = box.cdp || await box.page.context().newCDPSession(box.page);
  const said = []; box.page.on('console', m => { if (m.type() === 'error') said.push(m.text().slice(0, 300)); });
  box.page.on('pageerror', e => said.push('uncaught: ' + String(e).slice(0, 300)));
  const records = [];
  for (const [name, graph, setup, opts = {}] of SCREENS) {
    if (graph !== box.graph || (only && !only.includes(name))) continue;
    const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const rec = { name, graph, file, width: opts.width || 1440, dark: !!opts.dark };
    const from = said.length; const t0 = Date.now(), T = {};
    try {
      await reset(box, opts); T.reset = Date.now() - t0;
      await setup(box); T.setup = Date.now() - t0;
      // The pointer rests out of the way unless the screen is about what lies under it.
      if (!opts.pointer) await box.page.mouse.move(720, 6).catch(() => {});
      // Logseq draws some parts late (Linked references came a second after the page went still): a moment after the set-up, then
      // 1.2 s with nothing changing, before anything is recorded; the pictures below are taken again if a piece arrives during them.
      // (2.5 s of fixed waiting on every screen until 19 November 2026: twenty screens made that most of a minute.)
      await sleep(400);
      rec.waited = await still(box.page); T.still = Date.now() - t0;
      rec.churn = await churn(box.page); T.churn = Date.now() - t0;
      // Logseq's own running animations (the Doing circle, CSS or SVG) and the caret are settled for the pictures, the same on both
      // sides, so they never read as a difference; motion is not what the pictures judge.
      await box.page.evaluate(() => {
        const st = document.createElement('style'); st.id = 'guard-still';
        st.textContent = '*{caret-color:transparent!important}';
        document.head.appendChild(st);
        // Each running animation is brought to its end (a fade-in shows what it fades in); one that never ends (the Doing circle
        // turning) is held at its start. Taking animations away instead left Logseq's faded-in parts unseen.
        for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { try { a.pause(); a.currentTime = 0; } catch (x) { /* gone */ } } }
        for (const svg of document.querySelectorAll('svg')) { try { svg.pauseAnimations(); svg.setCurrentTime(0); } catch (e) { /* not animated */ } }
      });
      await sleep(200);
      // The pictures count only when the pieces on screen are the same just before and just after them: Logseq can draw a part
      // late with no change the watcher sees first (the sidebar's Linked references did). Up to four tries, 1.5 s apart.
      const R = require('./reads'); let readsFirst = null, readsLast = null;
      for (let i = 0; i < 4; i++) {
        const first = await layout(box.page);
        readsFirst = await R.once(box.page).catch(e => { rec.readsFailed = String(e && e.message || e).slice(0, 160); return null; });
        await box.page.screenshot({ path: path.join(outDir, file + '.png'), scale: 'css' });
        await sleep(700);
        await box.page.screenshot({ path: path.join(outDir, file + '.again.png'), scale: 'css' });
        rec.layout = await layout(box.page);
        readsLast = await R.once(box.page).catch(() => null);
        const same = JSON.stringify(Object.keys(first).sort()) === JSON.stringify(Object.keys(rec.layout).sort());
        if (same) break;
        rec.unsettled = (rec.unsettled || 0) + 1;
        await sleep(1500);
      }
      // How the screen reads, and whether it is like Logseq (reads.js): what the pictures cannot say. Measured just before the
      // first picture and just after the second; only what is found both times counts.
      if (readsFirst && readsLast) { const keys = new Set(readsLast.map(f => f.key)); rec.reads = readsFirst.filter(f => keys.has(f.key)); }
      rec.wrong = await box.page.evaluate(() => /Something went wrong/.test(document.body.innerText));
      await box.page.evaluate(() => document.getElementById('guard-still')?.remove());
    } catch (e) { rec.failed = String(e && e.message || e).slice(0, 200); }
    rec.console = said.slice(from).filter(t => !/net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(t));
    T.all = Date.now() - t0; if (process.env.GUARD_TIME) console.log('    ' + JSON.stringify(T));
    records.push(rec);
    console.log(`  ${rec.failed ? 'FAILED ' : ''}${name}${rec.failed ? ': ' + rec.failed : ''}`);
  }
  await reset(box).catch(() => {});
  return records;
}

module.exports = { deadlineDay, SCREENS, tour, reset, still, churn, go, route, inSidebar, rowView, firstRow, pageUuid, sleep };
