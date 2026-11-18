#!/usr/bin/env node
/* node warm.js <dir> "<graph name>"   (17 November 2026)
   A graph fresh from make-graphs.sh has never been opened: on the first visit to a tag's or a property's page Logseq itself
   writes that page's views ("All", "Linked references"), and look-only.js then counts those writes as notes changed by looking.
   On the old Mac the test graphs had been opened for weeks. This opens the graph in the checks' own Logseq WITHOUT the plugin,
   hides Logseq's [[ ]] around links as the owner's graphs do, visits every page once, quits, and puts the warmed copy back in ~/logseq-test-graphs (TEST_GRAPHS_ROOT). */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const [dir, graph] = process.argv.slice(2);
if (!dir || !graph) { console.error('warm.js <new folder> "<graph name>"'); process.exit(2); }
const ROOT = process.env.TEST_GRAPHS_ROOT || path.join(os.homedir(), 'logseq-test-graphs');
const from = path.join(ROOT, 'graphs', graph, 'db.sqlite');
const to = path.join(path.resolve(dir), 'home', 'logseq', 'graphs', graph);
if (fs.existsSync(to)) { console.error('give a new folder'); process.exit(2); }
fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(from, path.join(to, 'db.sqlite'));
const own = args => { const r = spawnSync('node', [path.join(__dirname, 'own-logseq.js'), ...args], { env: process.env, encoding: 'utf8', timeout: 180000 }); return ((r.stdout || '') + (r.stderr || '')).trim(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  console.log(own(['start', dir])); await sleep(9000);
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555));
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const name = await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name);
  if (!name || !name.endsWith(graph)) throw new Error('the own Logseq opened ' + name + ', not ' + graph);
  // The owner's graphs hide Logseq's [[ ]] around links (off-on.js reads brackets as raw links): a fresh graph shows them.
  const shown = await page.evaluate(async () => (await window.logseq.api.get_current_graph_configs())['ui/show-brackets?'] !== false);
  if (shown) { await page.evaluate(() => (window.logseq.api.get_state_from_store('command-palette/commands') || []).find(c => String(c.id) === ':ui/toggle-brackets')?.action()); await sleep(1500); }
  console.log('brackets shown: ' + await page.evaluate(async () => (await window.logseq.api.get_current_graph_configs())['ui/show-brackets?']));
  const names = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?n :where [?p :block/name ?n] (not [?p :block/journal-day])]')).map(r => r[0]));
  console.log(names.length + ' pages to visit');
  let i = 0;
  for (const n of names) {
    await page.evaluate(n => window.logseq.api.push_state('page', { name: n }), n).catch(() => {});
    await sleep(350); if (++i % 200 === 0) console.log(i + ' visited');
  }
  await page.evaluate(() => window.logseq.api.push_state('home')).catch(() => {}); await sleep(5000);
  await browser.close();
  console.log(own(['stop']));
  await sleep(3000);
  fs.copyFileSync(path.join(to, 'db.sqlite'), from);
  console.log('warmed copy put back: ' + from);
})().catch(e => { console.error(e); own(['stop']); process.exit(1); });
