#!/usr/bin/env node
/* node look-only.js <out.json> [pages]   Goalpost lines 1.1, 1.7, 2.6 and 7.8, in the checks' own Logseq (port 9333).
   Opens many pages the way a link does, points at and scrolls each, and does nothing else. Then says:
   - whether the graph is the same, fact by fact, as before (1.1: looking changes nothing);
   - for each page, how many changes are made to the screen in 2 s with no input, once it has settled (2.6: at rest, nothing moves);
   - every console error or warning (7.8). Read-only: it presses nothing that writes. */
const fs = require('node:fs');
const { chromium } = require('playwright');
const SKIP = new Set(['block/created-at', 'block/updated-at', 'block/tx-id']);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555));
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const want = Number(process.argv[3] || 40);
  const light = process.argv[4] === 'light';   // a very large graph: the pages are looked at, the whole graph is not read twice
  const print = () => light ? Promise.resolve({}) : require('./kit').fingerprint(page);
  const errors = []; let at = '';
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ at, type: m.type(), text: m.text().slice(0, 240) }); });
  page.on('pageerror', e => errors.push({ at, type: 'uncaught', text: String(e).slice(0, 240) }));
  // Everything asked of the network while the pages are looked at, with the script that asked (1.7: nothing leaves this Mac).
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  const asked = [];
  cdp.on('Network.requestWillBeSent', e => { const u = e.request.url; if (!/^(https?|wss?):/.test(u) || /^(https?|wss?):\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(u)) return; asked.push({ url: u.slice(0, 140), from: (e.initiator?.stack?.callFrames || []).map(f => f.url).filter(Boolean).slice(0, 3).join(' < ') || e.initiator?.url || e.initiator?.type || '', frame: e.frameId }); });
  const before = await print();
  const names = await page.evaluate(async n => { const rows = await window.logseq.api.datascript_query('[:find ?t (count ?b) :where [?p :block/title ?t] [?p :block/name] [?b :block/refs ?p] (not [?p :logseq.property/deleted-at])]'); return rows.sort((a, b) => b[1] - a[1]).map(r => r[0]).filter(t => typeof t === 'string' && !/^zz|^\$\$\$/i.test(t)).slice(0, n); }, want);
  const pages = [];
  for (const name of names) {
    at = name;
    await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), name);
    await page.waitForTimeout(2500);
    await page.mouse.move(600, 400); await page.mouse.wheel(0, 600); await page.waitForTimeout(300); await page.mouse.move(700, 300); await page.mouse.wheel(0, -600); await page.mouse.move(5, 500);
    await page.waitForTimeout(1200);
    const rest = await page.evaluate(() => new Promise(res => { let m = 0; const who = {}; const mo = new MutationObserver(rs => { m += rs.length; for (const r of rs) { const t = r.target.nodeType === 1 ? r.target : r.target.parentElement; const k = (t?.tagName || '?').toLowerCase() + '.' + String(t?.className?.baseVal ?? t?.className ?? '').split(/\s+/).slice(0, 2).join('.'); who[k] = (who[k] || 0) + 1; } }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res({ changes: m, who: Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 3), title: document.title, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth, wrong: !!document.querySelector('.ui__error-boundary, .error-boundary') || /Something went wrong/.test(document.body.innerText) }); }, 2000); }));
    const again = rest.changes > 0 ? (await page.waitForTimeout(1500), await require('./kit').changes(page, 2000)) : { n: 0 };
    pages.push({ name, ...rest, again: again.n, whoAgain: again.who });
  }
  const after = await print();
  const diff = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diff.push({ uuid: k, was: (before[k] || []).filter(f => !(after[k] || []).includes(f)).slice(0, 6), now: (after[k] || []).filter(f => !(before[k] || []).includes(f)).slice(0, 6), title: ((after[k] || before[k] || []).find(f => f.startsWith('block/title ')) || '').slice(12, 80) });
  const mine = errors.filter(e => !/net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e.text));
  const out = { at: new Date().toISOString(), nodes: Object.keys(before).length, pages, restless: pages.filter(p => p.changes > 0 && p.again > 0).map(p => [p.name, p.changes, p.again, p.whoAgain]), late: pages.filter(p => p.changes > 0 && !p.again).map(p => [p.name, p.changes, p.who]), graphChanged: diff, errors };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(`${pages.length} pages looked at; graph facts changed: ${diff.length}; pages not at rest: ${out.restless.length}; console errors and warnings: ${mine.length}; page wider than window: ${pages.filter(p => p.wide).length}; "went wrong": ${pages.filter(p => p.wrong).length}`);
  for (const d of diff.slice(0, 12)) console.log('  changed:', JSON.stringify(d).slice(0, 300));
  for (const r of out.restless.slice(0, 15)) console.log('  not at rest:', JSON.stringify(r).slice(0, 220));
  const seen = {}; for (const e of mine) seen[e.type + ': ' + e.text.slice(0, 150)] = (seen[e.type + ': ' + e.text.slice(0, 150)] || 0) + 1;
  for (const [k, n] of Object.entries(seen).slice(0, 12)) console.log('  console x' + n + ':', k);
  for (const l of (out.late || []).slice(0, 6)) console.log('  settled late (still once after 3.7 s, then still):', JSON.stringify(l).slice(0, 200));
  const away = asked.filter(a => /logseq-plugin/.test(a.from));
  for (const a of asked.slice(0, 8)) console.log('  asked of the network:', a.url, '| by', a.from.slice(0, 160));
  const verdicts = { '1.7': { ok: away.length === 0, said: away.length ? `the plugin's code asked the network ${away.length} time(s): first ${away[0].url}` : `over ${pages.length} pages the plugin's code asked nothing of the network outside this Mac${asked.length ? ` (Logseq itself asked ${asked.length} time(s))` : ''}` }, '1.1': { ok: diff.length === 0 && pages.length >= 10, said: diff.length ? `${diff.length} notes changed while ${pages.length} pages were only looked at: first “${diff[0].title}”` : `${pages.length} pages opened, pointed at and scrolled: not one fact of ${out.nodes} notes changed` }, '2.6': { ok: out.restless.length === 0, said: out.restless.length ? `${out.restless.length} of ${pages.length} pages keep changing with no input: ${out.restless.slice(0, 3).map(r => r[0]).join(', ')}` : `all ${pages.length} pages are still once drawn (${out.late.length} settled a little late)` }, '7.8': { ok: mine.length === 0, said: mine.length ? `the console said ${mine.length} thing(s): ${mine[0].text.slice(0, 120)}` : `nothing from the plugin in the console over ${pages.length} pages` } };
  if (light) delete verdicts['1.1'];
  require('./kit').result(verdicts);
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(2); });
