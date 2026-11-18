#!/usr/bin/env node
/* node cold-profile.js   Right after a cold start: types words then “#” in a new bullet with the CPU profiler on, and lists the
   plugin's functions that took the most time in the 600 ms after the “#”, with their files. Read-only but for a throwaway page. */
const { connect, sleep, fail } = require('./kit');
(async () => {
  const { browser, page } = await connect();
  const made = await page.evaluate(async () => String((await window.logseq.api.create_page('ZZ cold profile ' + Date.now(), {}, { redirect: true })).uuid));
  await sleep(2500);
  await page.evaluate(async u => { const b = await window.logseq.api.append_block_in_page(u, ''); await window.logseq.api.edit_block(String(b.uuid)); }, made);
  await sleep(800); await page.keyboard.type('saw the doctor ', { delay: 40 }); await sleep(600);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.keyboard.type('#'); await sleep(600);
  const { profile } = await cdp.send('Profiler.stop');
  // self time per function, from the samples
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (dt[i] || 0)));
  const total = new Map();
  for (const [id, t] of self) { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || '(anonymous)'}  ${String(f.url).replace(/^.*?(logseq-plugin|js)\//, '$1/')}:${f.lineNumber + 1}`; total.set(k, (total.get(k) || 0) + t); }
  const rows = [...total].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [k, t] of rows) console.log(String(Math.round(t / 1000)).padStart(5) + ' ms  ' + k.slice(0, 160));
  // the plugin's share
  const plugin = [...total].filter(([k]) => /logseq-plugin/.test(k)).reduce((s, [, t]) => s + t, 0);
  console.log(`plugin's own code: ${Math.round(plugin / 1000)} ms of ${Math.round([...total.values()].reduce((a, b) => a + b, 0) / 1000)} ms sampled`);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(async u => { await window.logseq.api.delete_page(u).catch(() => {}); }, made);
  await browser.close();
})().catch(fail);
