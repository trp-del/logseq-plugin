#!/usr/bin/env node
/* node cold-shift.js [page]   In the checks' own Logseq, right after it started: opens a page as a link does and records every
   layout shift of the first 3 s with its moving elements named (tag, classes, the words they hold, their parents), and whether
   the plugin runs. Run once with the plugin on and once with it off to tell Logseq's own start-up from the plugin. Read-only. */
const { connect, sleep, fail } = require('./kit');
(async () => {
  const { browser, page } = await connect();
  const on = await page.evaluate(() => { const p = window.LSPluginCore.registeredPlugins.get('logseq-plugin'); return !!p && !p.disabled; });
  await page.evaluate(() => {
    window.__shifts = []; const t0 = performance.now();
    const name = n => { if (!n || n.nodeType !== 1) return String(n && n.nodeName); const path = []; for (let e = n, i = 0; e && i < 4; e = e.parentElement, i++) path.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '')); return path.join(' < ') + ' “' + (n.innerText || '').trim().slice(0, 40).replace(/\n/g, ' ') + '”'; };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__shifts.push({ t: Math.round(e.startTime - t0), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).map(s => `${name(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`) }); }).observe({ type: 'layout-shift', buffered: false });
  });
  await page.evaluate(n => window.logseq.api.push_state('page', { name: n }), (process.argv[2] || 'Dr. Mei Chen').toLowerCase());
  await sleep(3000);
  const shifts = await page.evaluate(() => window.__shifts);
  console.log(`plugin ${on ? 'on' : 'off'}: ${shifts.length} layout shift(s) in 3 s`);
  for (const s of shifts) console.log(`  ${s.t} ms  ${s.v}${s.input ? ' (after input)' : ''}\n    ${s.src.join('\n    ')}`);
  await browser.close();
})().catch(fail);
