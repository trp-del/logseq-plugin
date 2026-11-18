#!/usr/bin/env node
/* node resync.js <dir> [plugin folder]   Copies the plugin's working folder (or the folder given) over the copy the checks' own
   Logseq runs (<dir>/plugin) and reloads the plugin there, so an uncommitted change can be tried at once. Says which parts started. */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { connect, sleep, fail } = require('./kit');
(async () => {
  const dir = path.resolve(process.argv[2] || ''), from = path.resolve(process.argv[3] || path.join(__dirname, '../..'));
  execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', '--exclude', 'check.log', from + '/', path.join(dir, 'plugin') + '/']);
  const { browser, page, frame } = await connect();
  await page.evaluate(async () => { try { await window.caches?.keys().then(keys => Promise.all(keys.map(k => window.caches.delete(k)))); } catch (e) {} await window.LSPluginCore.reload('logseq-plugin'); });
  await sleep(7000);
  let inside = null;
  for (let i = 0; i < 20 && !inside; i++) { inside = await frame()?.evaluate(() => ({ parts: (window.PluginDoor?.modules || []).map(m => m.key), failed: window.PluginFilesFailed || [], version: window.logseq?.baseInfo?.version })).catch(() => null); if (!inside) await sleep(500); }
  console.log(inside ? `reloaded ${inside.version}: ${inside.parts.join(', ')}${inside.failed.length ? '; DID NOT LOAD: ' + inside.failed.join(', ') : ''}` : 'the plugin did not come back');
  await browser.close();
})().catch(fail);
