#!/usr/bin/env node
/* The hands-on walk (15 November 2026): the plugin used in the real Logseq as a person uses it, with real clicks and keys, while
   the page itself measures what each step cost. Run it again after any change and it compares with the run before.

   What it does, in order (light, then the first five again in dark):
     1  Open a page           Dr. Mei Chen opened as a link would open it
     2  Walk a link           a real click on the first page link in its properties (Works at)
     3  Find                  Cmd K, "fatigue" typed letter by letter, two arrows down, Escape (never Enter in Find)
     4  Todo                  the Todo button in the toolbar
     5  Ontology              the Ontology button in the toolbar
     6  Split                 a ⌘-click on a page link in Dr. Mei Chen, then the × in the corner
     7  Write and tag         on a throwaway page "ZZ hands-on …": words typed into a bullet, then # and a tag's name, Enter on it
     8  Heading and fold      a heading bullet with two children typed, its arrow clicked to fold and again to open
     9  Settings              g then , (the plugin's settings window), Escape
    10  Dark mode             t t, then steps 1 and 3 to 5 and 9 again in dark, then t t back
   Then it cleans up: the ZZ page and any page that appeared during the run go to Logseq's Recycle (they are listed), the theme,
   the right sidebar and the page are put back as they were.

   What it measures for each step, inside Logseq's window (the DevTools console's own sources):
   - RESPONSE: from the click or key to the first change on screen; SETTLED: from the last key to the moment the screen is still
     (nothing changed for 300 ms). For typing, the same per letter (each letter's time to the screen being still for 120 ms).
   - LAYOUT SHIFTS: the browser's own layout-shift entries, how much moved and which element; those right after an input are
     counted apart, as the browser does.
   - LONG FRAMES: frames over 50 ms (the browser's long-animation-frame entries), and whether the plugin's code was in them.
   - ERRORS: console errors and warnings from Logseq and the plugin, uncaught errors, Logseq's "Something went wrong".
   - STRAY STYLES: strong colours in text (a stray blue is Logseq leaking through), how many fonts and sizes the screen uses, a
     page wider than the window, a window or list left open after its step closed it, the plugin's stylesheets growing.
   - MEMORY: the window's memory before and after the run.
   A screenshot of the whole window after each step, and a short recording (GIF) of the steps that move: Find, tagging, folding.

   It touches only the three test graphs named in PROFILES below (read first; stopped otherwise) and stops if you are typing in Logseq. Needs Logseq with
   its debugging port and Playwright (NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules).

     node tools/hands-on.js              the whole walk
     node tools/hands-on.js --no-dark    light only
   Results: dist/hands-on/<date-time>/ (results.json, summary.md, pictures); summary.md compares with the run before. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const D = require('../threads/tools/app-door');

/* The three test graphs it walks, each with its own page, tag and word: the Illness Test Graph (the sample, to see things look
   right), Stress Check (the same notes over six and a half years: 25,000 bullets, 3,000 pages, few tags) and Scale Check
   (a research graph: 400 tags six levels deep, 300 properties). The open graph decides which. */
const PROFILES = {
  'Illness Test Graph': { home: 'Dr. Mei Chen', tags: ['Symptom', 'Consultation'], word: 'fatigue' },
  'Stress Check': { home: 'Dr. Mei Chen', tags: ['Symptom', 'Consultation'], word: 'fatigue' },
  'Scale Check': { home: 'Ingrid Becker', tags: ['Hypothesis', 'Finding'], word: 'coupling' },
};
let GRAPH = '', HOME = '', TAGS = [], WORD = '';
for (const g of Object.keys(PROFILES)) if (!D.GRAPHS.includes(g)) D.GRAPHS.push(g);   // the door's own list of test graphs lacks Scale Check
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const root = path.resolve(__dirname, '..');
const outRoot = path.join(root, 'dist', 'hands-on');
const out = path.join(outRoot, stamp);
const ZZ = `ZZ hands-on ${stamp}`;
const flag = name => process.argv.includes(name);
const sleep = D.sleep;
fs.mkdirSync(out, { recursive: true });

/* ---- in Logseq's window: the instruments ---- */
function install() {
  if (window.__ho) return true;
  const ho = window.__ho = { shifts: [], loafs: [], errors: [], muts: 0, last: performance.now(), first: null, mark: 0 };
  const describe = el => { if (!el || el.nodeType !== 1) return el?.nodeName || '?'; const c = [...el.classList].slice(0, 3).join('.'); return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : ''); };
  ho.describe = describe;
  ho.obs = [];
  try { const o = new PerformanceObserver(list => { for (const e of list.getEntries()) ho.shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput,
    src: (e.sources || []).slice(0, 3).map(s => `${describe(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}, ${Math.round(s.previousRect.x)}→${Math.round(s.currentRect.x)}`) }); });
    o.observe({ type: 'layout-shift' }); ho.obs.push(o); } catch (e) {}
  try { const o = new PerformanceObserver(list => { for (const e of list.getEntries()) ho.loafs.push({ t: e.startTime, d: e.duration, block: e.blockingDuration,
    scripts: (e.scripts || []).map(s => ({ url: s.sourceURL, fn: s.sourceFunctionName, inv: s.invoker, d: Math.round(s.duration) })) }); });
    o.observe({ type: 'long-animation-frame' }); ho.obs.push(o); } catch (e) {}
  const mo = new MutationObserver(recs => { const t = performance.now(); ho.muts += recs.length; ho.last = t; if (ho.first === null && t >= ho.mark) ho.first = t; });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  ho.mo = mo;
  const onError = where => e => { const stack = String(e.error?.stack || e.reason?.stack || ''); ho.errors.push({ t: performance.now(), where: /logseq-plugin/.test(stack) ? 'plugin' : where, msg: String(e.message || e.reason?.message || e.reason || e),
    at: (stack.match(/logseq-plugin\/([^?:)]+)[^:]*:(\d+)/) || []).slice(1).join(':') }); };
  ho.listeners = [];
  const listen = (w, where) => { for (const kind of ['error', 'unhandledrejection']) { const f = onError(where); w.addEventListener(kind, f); ho.listeners.push([w, kind, f]); } };
  listen(window, 'Logseq');
  const frame = [...document.querySelectorAll('iframe')].find(f => /logseq-plugin_index/.test(f.src));
  if (frame?.contentWindow) listen(frame.contentWindow, 'plugin');
  ho.stop = () => { mo.disconnect(); for (const o of ho.obs) o.disconnect(); for (const [w, k, f] of ho.listeners) w.removeEventListener(k, f); delete window.__ho; };
  return true;
}
// What changed since a mark, read back.
function collect(t0) {
  const ho = window.__ho;
  const plugin = s => /logseq-plugin/.test(s.url || '');
  return {
    shifts: ho.shifts.filter(s => s.t >= t0),
    loafs: ho.loafs.filter(l => l.t >= t0).map(l => ({ d: Math.round(l.d), block: Math.round(l.block || 0), plugin: l.scripts.some(plugin),
      top: l.scripts.slice().sort((a, b) => b.d - a.d).slice(0, 2).map(s => `${(s.url || '').split('/').slice(-2).join('/')} ${s.fn || s.inv || ''} ${s.d}ms`) })),
    errors: ho.errors.filter(e => e.t >= t0),
    muts: ho.muts,
    crashed: /Something went wrong/.test(document.querySelector('#main-content-container')?.innerText?.slice(0, 2000) || ''),
  };
}
// The screen's looks, once it is still.
function looks() {
  const vw = innerWidth, vh = innerHeight;
  const plugin = '[class*="lk-"],[class^="fd"],[class*=" fd"],[class*="th-"],[class*="st-"],[class*="flow-"],[class*="td-"],[class*="sw-"],[class*="xp"]';
  const res = { overflowX: document.scrollingElement.scrollWidth > vw + 1, strong: {}, fonts: {}, sizes: {}, open: [], pluginStyles: 0, offRight: [] };
  const parse = c => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const sat = ([r, g, b]) => { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
  for (const el of document.querySelectorAll('#app-container *, dialog *, body > div *')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    res.fonts[fam] = (res.fonts[fam] || 0) + 1;
    res.sizes[cs.fontSize] = (res.sizes[cs.fontSize] || 0) + 1;
    const c = parse(cs.color);
    // a button that waits for a tick stands at 45% (the owner's ruling, 17 Nov): its red Delete is not a strong colour at rest
    if (c && c[3] > .5 && sat(c) > .45 && !el.closest('.waits')) {
      const mine = [el, el.parentElement].some(x => x?.matches?.(plugin));
      const key = cs.color + (mine ? ' (plugin)' : ' (Logseq)');
      const e = res.strong[key] || (res.strong[key] = { n: 0, sample: [] });
      e.n++; if (e.sample.length < 3) e.sample.push(`${window.__ho?.describe(el) || el.tagName} “${el.textContent.trim().slice(0, 30)}”`);
    }
    if (el.closest(plugin) && r.right > vw + 1) res.offRight.push(`${window.__ho?.describe(el)} “${el.textContent.trim().slice(0, 30)}”`);
  }
  for (const el of document.querySelectorAll('dialog[open], #ui__ac, .ui__modal-panel, [role="menu"], [role="listbox"]')) {
    const r = el.getBoundingClientRect(); if (r.width && r.height) res.open.push(window.__ho?.describe(el) || el.tagName);
  }
  res.pluginStyles = document.querySelectorAll('style[data-ref="logseq-plugin"]').length + [...document.querySelectorAll('style')].filter(s => /lk-|fd-|th-/.test(s.textContent.slice(0, 400))).length;
  res.offRight = res.offRight.slice(0, 5);
  return res;
}

/* ---- the walk ---- */
(async () => {
  const { browser, page, graph } = await D.connect('hands-on');
  if (!PROFILES[graph]) { console.log(`hands-on: the open graph is “${graph}”, not one of ${Object.keys(PROFILES).join(', ')}; stopped`); process.exit(2); }
  GRAPH = graph; ({ home: HOME, tags: TAGS, word: WORD } = PROFILES[graph]);
  if (await page.evaluate(() => !!window.logseq.api.check_editing())) { console.log('hands-on: someone is typing in Logseq; stopped'); process.exit(2); }
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const consoleLog = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) consoleLog.push({ at: Date.now(), type: m.type(), text: m.text().slice(0, 300), where: /logseq-plugin/.test(m.location()?.url || '') ? 'plugin' : 'Logseq' }); });
  page.on('pageerror', e => { const st = String(e.stack || ''); const at = (st.match(/logseq-plugin\/([^?:)]+)[^:]*:(\d+)/) || []).slice(1).join(':');
    consoleLog.push({ at: Date.now(), type: 'uncaught', text: String(e.message).slice(0, 300) + (at ? ` (${at})` : ''), where: at ? 'plugin' : 'Logseq' }); });

  const was = { theme: await page.evaluate(() => document.documentElement.dataset.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')),
    hash: await page.evaluate(() => location.hash), sidebar: await D.sidebarNow(page) };
  // Read again on a failed fetch: right after a graph is opened Logseq's database server may not answer yet.
  const pagesNow = async () => { for (let i = 0; ; i++) { try { return await page.evaluate(async () => (await window.logseq.api.get_all_pages()).map(p => ({ uuid: p.uuid, name: p.title || p.originalName || p.name }))); } catch (e) { if (i >= 5) throw e; await sleep(2000); } } };
  const before = new Set((await pagesNow()).map(p => p.uuid));
  const heap0 = await D.heap(session);
  await page.evaluate(install);
  const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));

  const steps = [];
  let shotNo = 0;
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const mark = () => page.evaluate(() => { window.__ho.mark = performance.now(); window.__ho.first = null; return performance.now(); });
  const nowIn = () => page.evaluate(() => performance.now());
  // Still: nothing changed for `quiet` ms, once something has changed since `since` (or a second has passed with nothing changing,
  // when the action changed nothing).
  async function settle(quiet = 300, max = 6000, since = null) {
    const start = await nowIn();
    if (since === null) since = start;
    for (;;) {
      const [t, last] = await page.evaluate(() => [performance.now(), window.__ho.last]);
      const answered = last >= since || t - start > 1000;
      if (answered && t - last >= quiet) return { last: Math.max(last, since), still: true };
      if (t - start > max) return { last, still: false };
      await sleep(40);
    }
  }
  // A recording of what moves: the screencast's frames, joined into a GIF by Python's PIL.
  async function record(name, fn) {
    const dir = path.join(out, 'frames-' + name); fs.mkdirSync(dir, { recursive: true });
    let n = 0; const times = [];
    const onFrame = async f => { fs.writeFileSync(path.join(dir, String(n).padStart(4, '0') + '.jpg'), Buffer.from(f.data, 'base64')); times.push(f.metadata.timestamp); n++; session.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); };
    session.on('Page.screencastFrame', onFrame);
    await session.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1280, everyNthFrame: 1 });
    try { return await fn(); } finally {
      await sleep(400);
      await session.send('Page.stopScreencast').catch(() => {});
      session.off('Page.screencastFrame', onFrame);
      fs.writeFileSync(path.join(dir, 'times.json'), JSON.stringify(times));
      try { execFileSync('python3', ['-c', GIF_PY, dir, path.join(out, name + '.gif')]); } catch (e) { console.log('  (no GIF:', String(e.message).split('\n')[0], ')'); }
    }
  }
  // Letters typed one by one, each timed to the screen being still again.
  async function typeTimed(text, delay = 90) {
    const per = [];
    for (const ch of text) {
      const t0 = await nowIn();
      await page.keyboard.type(ch);
      const s = await settle(120, 2000, t0);
      per.push({ ch, ms: Math.round(s.last - t0) < 0 ? 0 : Math.round(s.last - t0) });
      await sleep(delay);
    }
    return per;
  }
  async function step(name, what, act, { closes = false, quiet = 300, max = 6000 } = {}) {
    const wall = Date.now();
    const t0 = await mark();
    let error = null, detail = null;
    try { detail = await act(); } catch (e) { error = String(e.message || e).split('\n')[0]; }
    const tEnd = await nowIn();
    const s = await settle(quiet, max, t0);
    const first = await page.evaluate(() => window.__ho.first);
    const m = await page.evaluate(collect, t0);
    const l = await page.evaluate(looks);
    const shot = `${String(++shotNo).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    await page.screenshot({ path: path.join(out, shot) });
    const cons = consoleLog.filter(c => c.at >= wall);
    const unexpected = m.shifts.filter(x => !x.input);
    const rec = {
      name, what, theme: await theme(), error, detail,
      responseMs: first === null ? null : Math.round(first - t0),
      settledMs: Math.max(0, Math.round(s.last - tEnd)), totalMs: Math.round(Math.max(s.last, tEnd) - t0), still: s.still,
      shifts: { all: +m.shifts.reduce((a, x) => a + x.v, 0).toFixed(4), unexpected: +unexpected.reduce((a, x) => a + x.v, 0).toFixed(4), worst: m.shifts.sort((a, b) => b.v - a.v).slice(0, 3) },
      longFrames: { n: m.loafs.length, worst: Math.max(0, ...m.loafs.map(x => x.d)), plugin: m.loafs.filter(x => x.plugin).length, list: m.loafs.sort((a, b) => b.d - a.d).slice(0, 3) },
      errors: [...m.errors.filter(e => !cons.some(c => c.type === 'uncaught' && c.text.startsWith(e.msg.replace(/^Uncaught \w+: /, '')))), ...cons], crashed: m.crashed,
      looks: l, leftOpen: closes ? l.open : [], shot,
    };
    steps.push(rec);
    const flags = [rec.error && 'FAILED: ' + rec.error, !rec.still && 'never still', rec.errors.length && `${rec.errors.length} console errors/warnings`, rec.shifts.unexpected > 0.01 && `shift ${rec.shifts.unexpected}`,
      rec.longFrames.worst > 200 && `long frame ${rec.longFrames.worst}ms`, rec.leftOpen.length && `left open: ${rec.leftOpen.join(', ')}`, rec.crashed && 'Logseq crashed'].filter(Boolean);
    console.log(`${String(steps.length).padStart(2)} ${rec.theme.padEnd(5)} ${name.padEnd(22)} response ${String(rec.responseMs ?? '–').padStart(5)}ms  whole ${String(rec.totalMs).padStart(5)}ms  ${flags.join('; ')}`);
    return rec;
  }
  const escape = async (n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press('Escape'); await sleep(120); } };
  const leaveEditing = async () => { for (let i = 0; i < 4 && await page.evaluate(() => !!window.logseq.api.check_editing()); i++) await escape(); };
  const center = async sel => { const box = await page.locator(sel).first().boundingBox(); if (!box) throw new Error('not on screen: ' + sel); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const goHome = async () => { await D.go(page, HOME); await settle(300, 6000); await page.waitForSelector('#main-content-container .th-two-way:not([data-th-waiting]) .th-tw-row', { timeout: 20000 }).catch(() => {}); await settle(300, 6000); };
  // The first link in the page's properties; on a page with none, the first link anywhere in the main view.
  const firstLink = '#main-content-container .ls-page-properties a.page-ref[data-uuid]';
  const anyLink = '#main-content-container a.page-ref[data-uuid], #main-content-container .lk-node[data-uuid]';
  const linkSel = async () => (await page.locator(firstLink).count()) ? firstLink : anyLink;

  const openPage = async () => { await D.go(page, 'all-pages'); await settle(300, 5000); return step('Open a page', `${HOME} opened as a link opens it (from All pages)`, async () => {
    const t0 = await nowIn();
    await D.go(page, HOME);
    // The Linked section (the nodes pointing at the page) comes after the page itself: timed to its first row, up to 20 s.
    const shown = await page.waitForSelector('#main-content-container .th-two-way:not([data-th-waiting]) .th-tw-row', { timeout: 20000 }).then(() => true).catch(() => false);
    return { linkedMs: shown ? Math.round((await nowIn()) - t0) : null };
  }); };
  const find = (suffix = '') => step('Find' + suffix, `Cmd K, “${WORD}” typed letter by letter, two arrows down, Escape`, async () => {
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('dialog[open], .fd', { timeout: 3000 }).catch(() => {});
    await sleep(250);
    const letters = await typeTimed(WORD);
    const tl = await nowIn(); const sl = await settle(300, 4000, tl); const listMs = Math.round(sl.last - tl);
    await page.keyboard.press('ArrowDown'); await sleep(150); await page.keyboard.press('ArrowDown'); await sleep(300);
    await page.screenshot({ path: path.join(out, `${String(shotNo + 1).padStart(2, '0')}a-find-list${suffix ? '-dark' : ''}.png`) });
    await escape(); await sleep(200);
    if (await page.evaluate(() => !!document.querySelector('dialog[open]'))) await escape();
    return { letters, listMs, worstLetterMs: Math.max(...letters.map(l => l.ms)), meanLetterMs: Math.round(letters.reduce((a, l) => a + l.ms, 0) / letters.length) };
  }, { closes: true });
  const toolbar = (name, title) => step(name, `the ${name} button in the toolbar`, async () => {
    const sel = `a.lk-tool[title^="${title}"]`;
    if (!(await page.locator(sel).count())) throw new Error(`no ${name} button in the toolbar`);
    await page.locator(sel).first().click();
  });
  const settings = (suffix = '') => step('Settings' + suffix, 'g then , outside a bullet, then Escape', async () => {
    await leaveEditing();
    await page.keyboard.press('g'); await sleep(80); await page.keyboard.press(',');
    const opened = await page.waitForSelector('dialog.sw-dialog[open], .sw-dialog[open]', { timeout: 3000 }).then(() => true).catch(() => false);
    await sleep(500);
    await page.screenshot({ path: path.join(out, `${String(shotNo + 1).padStart(2, '0')}a-settings-open${suffix ? '-dark' : ''}.png`) });
    await escape(); await sleep(200);
    if (!opened) throw new Error('the settings window did not open on g ,');
  }, { closes: true });

  let zzMade = false;
  try {
    await escape();
    // 1 and 2
    await openPage();
    await step('Walk a link', 'a real click on the first page link in the bullets', async () => {
      const sel = await linkSel(); const [x, y] = await center(sel);
      const name = await page.locator(sel).first().innerText();
      await page.mouse.move(x, y); await sleep(150); await page.mouse.click(x, y);
      return { link: name };
    });
    await goHome();
    // 3
    await record('find', () => find());
    // 4 and 5
    await toolbar('Todo', 'Todo');
    await toolbar('Ontology', 'Ontology');
    // 6
    await goHome();
    await step('Split', 'a ⌘-click on a page link, then the × in the corner', async () => {
      const [x, y] = await center(await linkSel());
      await page.keyboard.down('Meta'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
      const on = await page.waitForSelector('[data-lk-split]', { timeout: 3000 }).then(() => true).catch(() => false);
      await settle(300, 4000);
      await page.screenshot({ path: path.join(out, `${String(shotNo + 1).padStart(2, '0')}a-split-open.png`) });
      if (!on) throw new Error('no split after ⌘-click');
      const close = page.locator('.lk-split-own [title*="lose"], .lk-split-own [aria-label*="lose"]');
      if (await close.count()) await close.first().click(); else throw new Error('no × in the corner');
      return { split: on };
    }, { closes: true });
    // 7 and 8, on a throwaway page
    const tag = await page.evaluate(async names => { for (const n of names) if (await window.logseq.api.get_page(n)) return n; return null; }, TAGS);
    await page.evaluate(async name => { await window.logseq.api.create_page(name, {}, { redirect: false }); }, ZZ);
    zzMade = true;
    await D.go(page, ZZ); await settle(300, 5000);
    await page.evaluate(async name => { const blocks = await window.logseq.api.get_page_blocks_tree(name); if (!blocks?.length) await window.logseq.api.append_block_in_page(name, ''); }, ZZ);
    await settle(300, 3000);
    await record('tag', () => step('Write and tag', `words typed into a bullet, then #${tag} and Enter on it in the list`, async () => {
      const [x, y] = await center('#main-content-container .ls-page-blocks .ls-block .block-content');
      await page.mouse.click(x, y); await sleep(300);
      if (!(await page.evaluate(() => !!window.logseq.api.check_editing()))) throw new Error('the click did not start editing the bullet');
      const words = await typeTimed('Tired after the walk ', 40);
      const t0 = await nowIn();
      const typed = await typeTimed('#' + (tag || 'Symptom'), 90);
      const list = await page.waitForSelector('#ui__ac, .cp__autocomplete, [role="listbox"]', { timeout: 2000 }).then(() => true).catch(() => false);
      const listMs = Math.round((await nowIn()) - t0);
      await sleep(300);
      const chosen = await page.evaluate(() => (document.querySelector('#ui__ac .chosen .flex-row > span:first-child')?.innerText || document.querySelector('#ui__ac .chosen')?.innerText || '').trim());
      await page.screenshot({ path: path.join(out, `${String(shotNo + 1).padStart(2, '0')}a-tag-list.png`) });
      const exact = chosen && chosen.split('\n')[0].trim().toLowerCase() === String(tag).toLowerCase();
      if (exact) await page.keyboard.press('Enter'); else await escape();
      await sleep(400);
      return { tag, list, chosen, picked: !!exact, wordsMeanMs: Math.round(words.reduce((a, l) => a + l.ms, 0) / words.length), tagLetters: typed };
    }));
    await step('Heading and fold', 'a heading bullet with two children typed, its arrow clicked to fold, then again to open', async () => {
      await page.keyboard.press('End'); await page.keyboard.press('Enter'); await sleep(200);
      await page.keyboard.type('# Plan for next visit', { delay: 40 });
      await page.keyboard.press('Enter'); await sleep(200); await page.keyboard.press('Tab'); await sleep(150);
      await page.keyboard.type('Ask about iron levels', { delay: 30 }); await page.keyboard.press('Enter'); await sleep(150);
      await page.keyboard.type('Book the blood test', { delay: 30 });
      await leaveEditing(); await settle(300, 3000);
      const heading = await page.evaluate(() => { const b = [...document.querySelectorAll('#main-content-container .ls-block')].find(b => /Plan for next visit/.test(b.querySelector('.block-content')?.innerText || '')); return b ? { id: b.getAttribute('blockid'), h: !!b.querySelector('.block-content h1, .block-content h2, [data-heading]') || /^h\d$/i.test(b.querySelector('.block-content')?.firstElementChild?.tagName || '') } : null; });
      if (!heading) throw new Error('the heading bullet is not on screen');
      const blockSel = `#main-content-container .ls-block[blockid="${heading.id}"]`;
      const [x, y] = await center(`${blockSel} > div .block-content`);
      await page.mouse.move(x, y); await sleep(300);
      const arrow = page.locator(`${blockSel} > div .block-control`).first();
      return record('fold', async () => {
        await page.mouse.move(x + 1, y); await sleep(200);
        const t0 = await nowIn();
        if (await arrow.count() && await arrow.isVisible()) await arrow.click(); else throw new Error('no fold arrow under the pointer');
        await settle(300, 3000);
        const foldMs = Math.round((await page.evaluate(() => window.__ho.last)) - t0);
        const folded = await page.evaluate(sel => document.querySelector(sel)?.querySelector('.block-children-container') === null || document.querySelector(sel)?.getAttribute('data-collapsed') === 'true', blockSel);
        await page.screenshot({ path: path.join(out, `${String(shotNo + 1).padStart(2, '0')}a-folded.png`) });
        await page.mouse.move(x, y); await sleep(250);
        await arrow.click(); await sleep(200);
        return { heading: heading.h, folded, foldMs };
      });
    });
    // 9
    await settings();
    // 10: dark
    if (!flag('--no-dark')) {
      await leaveEditing(); await goHome();
      await step('Dark mode', 't t outside a bullet', async () => { await page.keyboard.press('t'); await sleep(60); await page.keyboard.press('t'); await sleep(300); return { theme: await theme() }; });
      await openPage();
      await find(' (dark)');
      await toolbar('Todo', 'Todo');
      await toolbar('Ontology', 'Ontology');
      await settings(' (dark)');
    }
  } catch (e) {
    console.log('hands-on: stopped:', e.message);
  } finally {
    // Clean-up: back as it was.
    try { await leaveEditing(); await escape(); } catch (e) {}
    try { if ((await theme()) !== was.theme) { await goHome(); await page.keyboard.press('t'); await sleep(60); await page.keyboard.press('t'); await sleep(400); } } catch (e) {}
    const removed = [];
    try {
      await D.graphOk(page);
      const after = await pagesNow();
      for (const p of after.filter(p => !before.has(p.uuid))) {
        // Through the plugin's own write door, which deletes a page by its id (to Logseq's Recycle) and says whether it went.
        const gone = await D.plugin(page).evaluate(uuid => window.PluginDoor.write.deletePage(uuid), p.uuid).catch(e => 'failed: ' + e.message);
        removed.push(gone === true ? p.name : `${p.name} (not removed: ${gone})`);
      }
    } catch (e) { removed.push('(clean-up failed: ' + e.message + ')'); }
    try { await D.sidebarBack(page, was.sidebar); } catch (e) {}
    try { await page.evaluate(h => { location.hash = h; }, was.hash); await sleep(800); } catch (e) {}
    const heap1 = await D.heap(session).catch(() => 0);
    try { await page.evaluate(() => window.__ho?.stop()); } catch (e) {}
    const result = { stamp, graph, viewport, themeAtStart: was.theme, memoryMB: { start: Math.round(heap0 / 1e6), end: Math.round(heap1 / 1e6) }, removed, steps };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(out, 'summary.md'), summary(result, previous()));
    for (const d of fs.readdirSync(out)) if (d.startsWith('frames-')) fs.rmSync(path.join(out, d), { recursive: true });
    console.log(`\nremoved to Recycle: ${removed.join(', ') || 'nothing'}\nmemory ${result.memoryMB.start} → ${result.memoryMB.end} MB\n${out}`);
    await browser.close().catch(() => {});
  }
})();

// The run before this one, for the comparison.
function previous() {
  const runs = fs.readdirSync(outRoot).filter(d => d < stamp && fs.existsSync(path.join(outRoot, d, 'results.json')) && JSON.parse(fs.readFileSync(path.join(outRoot, d, 'results.json'), 'utf8')).graph === GRAPH).sort();
  return runs.length ? JSON.parse(fs.readFileSync(path.join(outRoot, runs[runs.length - 1], 'results.json'), 'utf8')) : null;
}
function summary(r, prev) {
  const key = s => `${s.name}|${s.theme}`;
  const old = new Map((prev?.steps || []).map(s => [key(s), s]));
  const ms = v => v === null || v === undefined ? '–' : `${v} ms`;
  const lines = [`# Hands-on walk ${r.stamp}`, '', `Graph ${r.graph}, window ${r.viewport.w}×${r.viewport.h}, memory ${r.memoryMB.start} → ${r.memoryMB.end} MB.` + (prev ? ` Compared with ${prev.stamp}.` : ' First run, nothing to compare with.'), '',
    '| # | Step | Theme | Response | Whole step | Before | Shift | Long frames | Errors | Notes |', '|---|---|---|---|---|---|---|---|---|---|'];
  r.steps.forEach((s, i) => {
    const o = old.get(key(s));
    const notes = [s.error && 'FAILED: ' + s.error, !s.still && 'never still', s.leftOpen.length && 'left open: ' + s.leftOpen.join(', '), s.crashed && 'Logseq crashed',
      s.detail?.worstLetterMs !== undefined && `each letter on screen in ${s.detail.meanLetterMs} ms on average, worst ${s.detail.worstLetterMs} ms` + (s.detail.listMs !== undefined ? `; list still ${s.detail.listMs} ms after the last letter` : ''),
      s.detail?.linkedMs !== undefined && (s.detail.linkedMs === null ? 'Linked section not shown within 20 s' : `Linked section shown at ${s.detail.linkedMs} ms`),
      s.detail?.picked === false && `tag not picked (list showed “${s.detail.chosen}”)`, s.detail?.foldMs !== undefined && `fold ${s.detail.foldMs} ms, heading ${s.detail.heading ? 'yes' : 'no'}`,
      Object.keys(s.looks.strong).length && 'strong colours: ' + Object.entries(s.looks.strong).map(([c, v]) => `${c} ×${v.n}`).join(', '),
      s.looks.overflowX && 'page wider than the window', s.looks.offRight.length && 'plugin past the right edge'].filter(Boolean).join('; ');
    lines.push(`| ${i + 1} | ${s.name} | ${s.theme} | ${ms(s.responseMs)} | ${ms(s.totalMs)} | ${o ? ms(o.totalMs) : '–'} | ${s.shifts.unexpected} | ${s.longFrames.n} (worst ${s.longFrames.worst} ms, plugin ${s.longFrames.plugin}) | ${s.errors.length} | ${notes} |`);
  });
  lines.push('', '## Errors and warnings', '');
  for (const s of r.steps) for (const e of s.errors) lines.push(`- ${s.name} (${s.theme}): ${e.where || ''} ${e.type || ''} ${e.text || e.msg}`);
  lines.push('', `Removed to Recycle: ${r.removed.join(', ') || 'nothing'}.`);
  return lines.join('\n') + '\n';
}

const GIF_PY = `
import sys, os, json
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
if not files: sys.exit(0)
times = json.load(open(os.path.join(d, 'times.json')))
frames = [Image.open(os.path.join(d, f)).convert('RGB') for f in files]
w = 900
frames = [f.resize((w, int(f.height * w / f.width))) for f in frames]
durs = [max(20, int((times[i + 1] - times[i]) * 1000)) if i + 1 < len(times) else 800 for i in range(len(frames))]
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True)
`;
