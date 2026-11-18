#!/usr/bin/env node
/* node load-plugin.js <plugin folder>   Loads the plugin unpacked into the checks' own Logseq (9333), as Load unpacked plugin
   does, waits until its parts have started, and says which did. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555), { timeout: 8000 });
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const has = await page.evaluate(() => !!window.LSPluginCore.registeredPlugins.get('logseq-plugin'));
  if (!has) { const said = await page.evaluate(async url => { try { await window.LSPluginCore.register({ url }, true); return ''; } catch (e) { return String(e && e.message || e); } }, process.argv[2]); if (said) throw new Error('the plugin did not load: ' + said); }
  let frame = null;
  for (let i = 0; i < 80 && !frame; i++) { frame = page.frames().find(f => f.url().includes('logseq-plugin')); if (!frame) await sleep(250); }
  if (!frame) throw new Error('the plugin has no frame');
  await sleep(6000);
  const inside = await frame.evaluate(() => ({ parts: (window.PluginDoor?.modules || []).map(m => m.key), failed: window.PluginFilesFailed || [], version: window.logseq?.baseInfo?.version }));
  if (inside.failed.length) throw new Error('files did not load: ' + inside.failed.join(', '));
  console.log(`plugin ${inside.version} loaded: ${inside.parts.join(', ')}`);
  await browser.close();
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
