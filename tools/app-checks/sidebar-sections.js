#!/usr/bin/env node
/* The right sidebar as Logseq's own stacked sections (0.3.154), Logseq's Linked references hidden and Relations at the foot of a
   journal day (0.3.166), proved in the real app (18 November 2026). Drives the checks' own Logseq (tools/audit/fresh.js, a throwaway
   copy of the Illness Test Graph) by real presses where a person presses: the toolbar's sidebar button, the ··· menu's View links,
   the toolbar's Todo button, a section's ×.
     LOGSEQ_PORT=<port> NODE_PATH=<…/node_modules> node tools/app-checks/sidebar-sections.js [folder for screenshots]
   What it proves:
     1. With the sidebar open, the page's own parts appear by themselves only where they apply: Ontology on a tag's page and on a
        property's page, Outline on a page with headings, neither on a plain page, where the sidebar then closes by itself rather
        than standing open and blank; back on a tag's page Ontology and the sidebar come back.
     2. Links and Todo are there only once asked for (View links in the ··· menu, Todo's toolbar button), each with its ×; neither
        appears by itself on the pages of 1; the × of the last one you opened closes the sidebar.
     3. Logseq's Linked references is not shown on a page that has references, while Relations is; on a journal day with relations,
        Relations stands at the foot of the day, below its bullets.
     4. Nothing in the console from the plugin; the graph as it was; the sidebar and the page put back as found.
   The test graph has no heading anywhere, so for Outline the check makes the first bullet of one plain page a heading through
   Logseq's API, and takes the heading off again before the graph is compared (the comparison is what says it was put back).
   Prints "ok  …" or "PROBLEM: …" per line, then "sidebar-sections: OK" or "sidebar-sections: FAILED (n)"; exits 0, 1, or 2 when
   Logseq cannot be reached. */
const path = require('node:path'), fs = require('node:fs');
const kit = require('../audit/kit.js');
const { sleep } = kit;
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
const lines = [];
const say = (ok, words) => { lines.push({ ok, words }); console.log(ok ? `ok  ${words}` : `PROBLEM: ${words}`); };

// What the sidebar holds that a person can see: each section by the word of its head.
const sidebar = page => page.evaluate(() => {
  const open = !!window.logseq.api.get_state_from_store('ui/sidebar-open?');
  const side = document.getElementById('right-sidebar');
  const seen = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const items = [...document.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')];
  const word = item => (item.querySelector('.sidebar-item-header h3, .sidebar-item-header .page-title, .sidebar-item-header')?.textContent || '').trim();
  const shown = open && seen(side) && side.getBoundingClientRect().width > 40 ? items.filter(seen) : [];
  return {
    open,
    shown: shown.map(word),
    // a × a person can press, on each section shown
    closers: shown.filter(item => [...item.querySelectorAll('.item-actions .lk-close, .item-actions button:has(.ls-icon-x)')].some(seen)).map(word),
  };
});
const until = async (page, test, ms = 4000, step = 150) => {
  const t0 = Date.now(); let s;
  for (;;) { s = await sidebar(page); if (test(s) || Date.now() - t0 > ms) return { s, ms: Date.now() - t0 }; await sleep(step); }
};
const has = (s, word) => s.shown.some(w => w === word || w.startsWith(word));
const list = s => s.open ? (s.shown.length ? s.shown.join(', ') : 'nothing') : 'the sidebar closed';
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `sidebar-sections-${name}.png`) }); };
// The page the main view shows, by Logseq's own word for it.
const here = page => page.evaluate(async () => String((await window.logseq.api.get_current_page())?.title || '').toLowerCase()).catch(() => '');
const goTo = async (page, name) => { await kit.go(page, name, 300); for (let i = 0; i < 30 && await here(page) !== name.toLowerCase(); i++) await sleep(150); await sleep(900); };

(async () => {
  let k;
  try { k = await kit.connect(); } catch (error) { console.log(`sidebar-sections: Logseq cannot be reached on port ${kit.PORT}: ${error.message}`); process.exit(2); }
  const { browser, page, said } = k;
  const t0 = Date.now();
  const q = s => page.evaluate(s => window.logseq.api.datascript_query(s), s);
  const found = await page.evaluate(() => ({ route: location.hash, open: !!window.logseq.api.get_state_from_store('ui/sidebar-open?'), list: JSON.stringify(window.logseq.api.get_state_from_store('sidebar/blocks') || []) }));
  const before = await kit.fingerprint(page);
  const pressSidebar = async () => { await page.click('#head .toggle-right-sidebar'); await sleep(400); };
  const neverAsked = (s, where) => { const extra = s.shown.filter(w => /^(Links|Todo)\b/.test(w)); return extra.length ? `${extra.join(' and ')} stood in the sidebar on ${where} without being asked for` : ''; };
  const unasked = [];
  let heading = null;
  // The pages, found in the graph: a tag's, a property's, a plain one, one with references, a journal day with relations.
  const tag = 'Consultation', prop = 'Provider', plain = 'Dr. Mei Chen';
  const headsOn = async name => (await q(`[:find ?b :where [?p :block/title "${name}"] [?b :block/page ?p] [?b :logseq.property/heading _]]`)).length;
  const plainPages = (await q('[:find ?t ?u :where [?p :block/name] [?p :block/title ?t] [?b :block/page ?p] [?b :block/parent ?p] [?b :block/uuid ?u] [(missing? $ ?p :block/journal-day)] [(missing? $ ?p :logseq.property/built-in?)] (not [?p :block/tags :logseq.class/Tag]) (not [?p :block/tags :logseq.class/Property]) (not [?x :block/refs ?p])]'))
    .filter(([t]) => !/test/i.test(t) && t !== plain).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const refPages = (await q('[:find ?t (count ?b) :where [?p :block/name] [?p :block/title ?t] [?c :block/page ?p] [?b :block/refs ?p] [?b :block/page ?o] [(not= ?o ?p)] [(missing? $ ?p :block/journal-day)] [(missing? $ ?p :logseq.property/built-in?)] (not [?p :block/tags :logseq.class/Tag]) (not [?p :block/tags :logseq.class/Property])]'))
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const days = (await q('[:find ?t ?d :where [?p :block/journal-day ?d] [?p :block/title ?t] [?c :block/page ?p] [?b :block/refs ?p] [?b :block/page ?o] [(not= ?o ?p)]]'))
    .sort((a, b) => a[1] - b[1]);
  if (!plainPages.length || !refPages.length || !days.length) throw new Error('the graph has no plain page, no page with references or no journal day with relations to try');

  try {
    // 1. The page's own parts, with the sidebar open.
    await goTo(page, tag);
    let s = await sidebar(page);
    if (!s.open) { await pressSidebar(); }
    ({ s } = await until(page, s => has(s, 'Ontology')));
    unasked.push(neverAsked(s, tag));
    const tagHeads = await headsOn(tag);
    say(has(s, 'Ontology') && (tagHeads || !has(s, 'Outline')), `on the tag's page ${tag}, the sidebar opened by its toolbar button shows Ontology${tagHeads ? '' : ' and no Outline'} (shows: ${list(s)})`);
    await shot(page, '1-ontology-on-a-tag-page');

    await goTo(page, prop);
    ({ s } = await until(page, s => has(s, 'Ontology')));
    unasked.push(neverAsked(s, prop));
    say(has(s, 'Ontology'), `on the property's page ${prop}, Ontology shows (shows: ${list(s)})`);

    const [outlineName, outlineUuid] = plainPages[0];
    heading = String(outlineUuid);
    await page.evaluate(u => window.logseq.api.upsert_block_property(u, ':logseq.property/heading', 2), heading);
    await goTo(page, outlineName);
    ({ s } = await until(page, s => has(s, 'Outline') && !has(s, 'Ontology')));
    unasked.push(neverAsked(s, outlineName));
    say(has(s, 'Outline') && !has(s, 'Ontology'), `on ${outlineName}, a page with a heading and no tag, Outline shows and Ontology does not (shows: ${list(s)})`);
    await page.evaluate(u => window.logseq.api.remove_block_property(u, ':logseq.property/heading'), heading);
    heading = null;

    /* The plain page: neither part; the sidebar closes by itself, never standing open and blank. While the page is still being read
       a part keeps the previous page's answer (sidebar-tabs.js, inspector.js and links.js say so: walking from tag to tag never takes
       Ontology away for a moment), so a part seen in the first READ ms on the page is left aside; seen after that, it is shown there. */
    const READ = 900;
    await kit.go(page, plain, 0);
    const late = [];
    const t1 = Date.now(); let arrived = null, closedAt = null;
    while (Date.now() - t1 < 4000) {
      s = await sidebar(page);
      unasked.push(neverAsked(s, plain));
      if (arrived === null && await here(page) === plain.toLowerCase()) arrived = Date.now();
      if (arrived !== null) {
        if (!s.open) { closedAt = Date.now() - arrived; break; }
        if (Date.now() - arrived > READ && s.shown.some(w => /^(Ontology|Outline)/.test(w))) late.push(s.shown.join(', '));
      }
      await sleep(120);
    }
    await sleep(600);
    s = await sidebar(page);
    const stayedShut = !s.open;
    say(!late.length, late.length ? `on the plain page ${plain}, ${[...new Set(late)].join(' / ')} still stood in the sidebar after the page was read` : `on the plain page ${plain}, neither Ontology nor Outline shows`);
    say(closedAt !== null && closedAt < 2500 && stayedShut, closedAt !== null && stayedShut ? `on ${plain}, with nothing you opened, the sidebar closed by itself (after about ${Math.round(closedAt / 100) / 10} s) instead of standing blank` : `on ${plain} the sidebar stood open (shows: ${list(s)}) instead of closing by itself`);
    await shot(page, '2-plain-page-sidebar-closed');

    await goTo(page, tag);
    ({ s } = await until(page, s => s.open && has(s, 'Ontology')));
    unasked.push(neverAsked(s, tag + ' again'));
    say(s.open && has(s, 'Ontology'), `back on ${tag}, the sidebar opened again by itself with Ontology (shows: ${list(s)})`);

    const stray = [...new Set(unasked.filter(Boolean))];
    say(!stray.length, stray.length ? stray.join('; ') : 'Links and Todo never appeared by themselves on any of those pages');

  } catch (error) {
    say(false, `the check stopped in the parts of the page: ${String(error.message || error).split('\n')[0].slice(0, 300)}`);
  } finally {
    if (heading) { await page.evaluate(u => window.logseq.api.remove_block_property(u, ':logseq.property/heading'), heading).catch(() => {}); heading = null; }
  }

  try {
    // 2. Links and Todo, only when asked for, each with its ×; the × of the last one closes the sidebar.
    const press = { timeout: 4000 };
    let s;
    await page.click('#head button:has(.ls-icon-dots)', press); await sleep(500);
    await page.locator('[role="menuitem"]', { hasText: 'View links' }).first().click(press);
    ({ s } = await until(page, s => has(s, 'Links')));
    say(has(s, 'Links') && s.closers.some(w => w.startsWith('Links')) && !has(s, 'Todo'), `View links in the ··· menu opens Links with its ×, and Todo stays out (shows: ${list(s)}; with a ×: ${s.closers.join(', ') || 'none'})`);
    await page.click('#head a.lk-tool[title="Todo"]', press);
    ({ s } = await until(page, s => has(s, 'Todo')));
    say(has(s, 'Todo') && s.closers.some(w => w.startsWith('Todo')), `the toolbar's Todo button opens Todo with its × (shows: ${list(s)}; with a ×: ${s.closers.join(', ') || 'none'})`);
    const todoX = page.locator('#right-sidebar .sidebar-item:has(#_sidebar\\.todo-side) .item-actions button:has(.ls-icon-x)').first();
    await todoX.hover(press); await todoX.click(press);
    ({ s } = await until(page, s => !has(s, 'Todo'), 2500));
    say(s.open && !has(s, 'Todo') && has(s, 'Links'), `Todo's × takes Todo away and the sidebar stays for Links, still open (shows: ${list(s)})`);
    await page.locator('#right-sidebar .sidebar-item .lk-close[aria-label="Close Links"]').first().click(press);
    ({ s } = await until(page, s => !s.open, 2500));
    say(!s.open, s.open ? `after the × of Links, the last thing opened, the sidebar stood open (shows: ${list(s)})` : 'the × of Links, the last thing opened, closes the sidebar, though Ontology applies on the page');

  } catch (error) {
    say(false, `the check stopped in Links and Todo: ${String(error.message || error).split('\n')[0].slice(0, 300)}`);
  }

  try {
    // 3. Logseq's Linked references hidden where Relations stands; Relations at the foot of a journal day.
    const refsLook = () => page.evaluate(() => {
      const main = document.querySelector('#main-content-container');
      const seen = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
      const refs = [...main.querySelectorAll('.references')];
      const box = [...main.querySelectorAll('.th-two-way')].find(seen);
      const blocks = [...main.querySelectorAll('.page .ls-page-blocks')].find(b => !b.closest('.references, .th-two-way'));
      const bullets = blocks ? [...blocks.querySelectorAll('.ls-block')].filter(seen) : [];
      const lastBottom = bullets.length ? Math.max(...bullets.map(b => b.getBoundingClientRect().bottom)) : null;
      return {
        refs: refs.length, refsShown: refs.filter(seen).length,
        box: !!box, boxWords: (box?.innerText || '').trim().split('\n')[0],
        boxTop: box ? Math.round(box.getBoundingClientRect().top) : null, lastBottom: lastBottom === null ? null : Math.round(lastBottom),
        bullets: bullets.length, afterBlocks: !!box && !!blocks && !!(blocks.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING) && !blocks.contains(box),
        journal: !!main.querySelector('.page.is-journals'),
      };
    });
    const refPage = refPages[0][0];
    await goTo(page, refPage); await sleep(1200);
    let r = await refsLook();
    say(r.refs > 0 && r.refsShown === 0, r.refs ? (r.refsShown ? `Logseq's Linked references shows on ${refPage}, a page with ${refPages[0][1]} references` : `Logseq's Linked references is drawn but not shown on ${refPage}, a page with ${refPages[0][1]} references`) : `Logseq drew no Linked references on ${refPage} to hide; the check could not tell`);
    say(r.box && /^Relations/.test(r.boxWords), r.box ? `Relations stands on ${refPage} in their place (its head reads “${r.boxWords}”)` : `no Relations section on ${refPage}`);

    let day = null;
    for (const [title] of days.slice(0, 4)) { await goTo(page, title); await sleep(1200); r = await refsLook(); if (r.box) { day = title; break; } }
    if (!day) say(false, `no journal day with relations showed Relations (tried ${days.slice(0, 4).map(d => d[0]).join(', ')})`);
    else {
      say(r.journal && r.bullets > 0 && r.afterBlocks && r.boxTop >= r.lastBottom - 1, r.afterBlocks && r.boxTop >= r.lastBottom - 1 ? `on the journal day ${day}, Relations stands at the foot of the day, below its ${r.bullets} bullets (${r.boxTop - r.lastBottom} px under the last)` : `on the journal day ${day}, Relations stands above the day's bullets (its top at ${r.boxTop} px, the last bullet ends at ${r.lastBottom} px)`);
      say(r.refsShown === 0, r.refsShown ? `Logseq's Linked references shows on the journal day ${day}` : `Logseq's Linked references is not shown on the journal day ${day}`);
      await shot(page, '3-relations-at-a-journal-days-foot');
    }
  } catch (error) {
    say(false, `the check stopped in Linked references and Relations: ${String(error.message || error).split('\n')[0].slice(0, 300)}`);
  }

  // 4. Put back as found; nothing said; the graph unchanged.
  // A step that stopped midway may leave Links or Todo open: each is closed by its ×, as a person would.
  for (const sel of ['#right-sidebar .sidebar-item .lk-close[aria-label="Close Links"]', '#right-sidebar .sidebar-item:has(#_sidebar\\.todo-side) .item-actions button:has(.ls-icon-x)']) {
    const x = page.locator(sel).first();
    if (await x.isVisible().catch(() => false)) { await x.hover({ timeout: 2000 }).catch(() => {}); await x.click({ timeout: 2000 }).catch(() => {}); await sleep(600); }
  }
  await page.evaluate(h => { location.hash = h; }, found.route); await sleep(1500);
  let now = await sidebar(page);
  if (now.open !== found.open) { await page.click('#head .toggle-right-sidebar').catch(() => {}); await sleep(1200); now = await sidebar(page); }
  const listNow = await page.evaluate(() => JSON.stringify(window.logseq.api.get_state_from_store('sidebar/blocks') || []));
  say(now.open === found.open && (!found.open || listNow === found.list), `the sidebar put back as found (${found.open ? 'open' : 'closed'}) and the page back where it was`);
  await sleep(500);
  const after = await kit.fingerprint(page);
  const diff = kit.differs(before, after);
  say(!diff.length, diff.length ? `the graph changed: ${diff.slice(0, 3).map(d => `${d.what} “${d.words}” ${d.now.join(' ')}`).join('; ')}` : 'the graph is as it was');
  const ours = kit.ours(said);
  say(!ours.length, ours.length ? `the console said: ${ours.slice(0, 3).map(m => m.text.slice(0, 160)).join(' | ')}` : 'nothing in the console');
  const bad = lines.filter(l => !l.ok).length;
  console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`);
  console.log(bad ? `sidebar-sections: FAILED (${bad})` : 'sidebar-sections: OK');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(error => { console.log(`sidebar-sections: the check could not run: ${String(error && error.message || error).slice(0, 400)}`); process.exit(2); });
