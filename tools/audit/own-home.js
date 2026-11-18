#!/usr/bin/env node
/* node own-home.js   Goalpost line 7.7: the checks run in a Logseq of their own, on a throwaway copy, and the owner's window and
   graphs are never touched.
   Read from the running Logseq of the checks: the graph open there lies in a home folder made for the run (kit.js refuses to
   go on otherwise), the plugin it runs is a copy inside that same folder, and what would leave the app (clipboard, Finder,
   browser, print window) is kept in the run. Read from this folder: no check names the owner's port, 9222. */
const fs = require('node:fs'), path = require('node:path');
const { connect, finish, fail } = require('./kit');
(async () => {
  const { browser, page, graph, graphPath } = await connect();
  const run = graphPath.replace(/\/home\/logseq\/graphs\/.*$/, '');
  const at = await page.evaluate(() => { const p = window.LSPluginCore.registeredPlugins.get('logseq-plugin'); return { url: String(p?.options?.url || p?.url || ''), guarded: Array.isArray(window.__outside), port: location.port }; });
  const real = require('node:os').userInfo().homedir;
  const mine = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'own-home.js');
  const named = mine.filter(f => /\b9222\b/.test(fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')));
  const lines = [
    [graphPath.startsWith(run) && !graphPath.startsWith(real + '/logseq/'), `the graph “${graph}” open there is the copy at ${graphPath}`],
    [at.url.replace(/^file:\/\//, '').startsWith(run), `the plugin it runs is the copy at ${at.url}`],
    [at.guarded, 'the clipboard, the Finder, the browser and the print window of the Mac are out of its reach'],
    [!named.length, named.length ? `these checks name the owner's port 9222 in their code: ${named.join(', ')}` : 'no check of the proof run names the owner\'s port'],
  ];
  for (const [ok, words] of lines) console.log(`${ok ? 'ok  ' : 'FAIL'} ${words}`);
  const ok = lines.every(l => l[0]);
  await finish(browser, { '7.7': { ok, said: ok ? 'the checks\' Logseq runs a copy of the graph and a copy of the plugin, both inside the run\'s own folder, with the Mac\'s clipboard, Finder, browser and print window out of reach' : (lines.find(l => !l[0]) || ['', ''])[1] } });
})().catch(fail);
