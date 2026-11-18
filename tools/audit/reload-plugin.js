#!/usr/bin/env node
/* node reload-plugin.js   Reloads the plugin in the checks' own Logseq from the copy it already runs (after a file of that copy
   was changed), and says which parts started. */
const { connect, sleep, fail } = require('./kit');
(async () => {
  const { browser, page, frame } = await connect();
  await page.evaluate(async () => { try { await window.caches?.keys().then(keys => Promise.all(keys.map(k => window.caches.delete(k)))); } catch (e) {} await window.LSPluginCore.reload('logseq-plugin'); });
  await sleep(6000);
  let inside = null;
  for (let i = 0; i < 30 && !inside; i++) { inside = await frame()?.evaluate(() => (window.PluginDoor?.started ? { parts: window.PluginDoor.started.map(m => m.key), failed: window.PluginFilesFailed || [] } : null)).catch(() => null); if (!inside) await sleep(500); }
  console.log(inside ? `reloaded: ${inside.parts.join(', ')}${inside.failed.length ? '; DID NOT LOAD: ' + inside.failed.join(', ') : ''}` : 'the plugin did not come back');
  await browser.close();
})().catch(fail);
