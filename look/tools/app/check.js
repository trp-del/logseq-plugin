/* Checks the plugin in the real Logseq, read-only. Logseq must be running with its debugging port
   (open -a Logseq --args --remote-debugging-port=9222) on a test graph, and Playwright reachable (NODE_PATH).
     NODE_PATH=/Users/admin/logseq-plugin/node_modules node tools/app/check.js <out dir> [page name]
   Loads the plugin unpacked from this folder if Logseq does not have it yet (what Load unpacked plugin does), reloads it,
   opens the page named (or stays where it is), waits for the drawings, counts them and writes a screenshot into <out dir>.
   Nothing is typed into the app and no note is changed. It refuses to run while a block is being edited. DB Refinements
   draws the same things: while it is on, both draw, so the counts say which copy drew what. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
const PLUGIN = 'logseq-plugin', DIR = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || path.join(DIR, 'dist', 'app-check');
const PAGE = process.argv[3] || null;
let chromium; try { ({ chromium } = require('playwright')); } catch (error) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }
(async () => {
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) { console.log('skipped: Logseq is not reachable on its debugging port'); process.exit(2); }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  if (!page) throw new Error('no Logseq main window');
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (!TEST_GRAPHS.includes(graph)) throw new Error(`the open graph is “${graph}”, not one of ${TEST_GRAPHS.join(', ')}; nothing was touched`);
  if (await page.evaluate(() => !!window.logseq.api.check_editing())) throw new Error('a block is being edited in Logseq; try again later');
  const frame = () => page.frames().find(f => f.url().includes(PLUGIN));
  const have = await page.evaluate(id => { const map = window.LSPluginCore?.registeredPlugins; return !!(map && (map.get ? map.get(id) : map[id])); }, PLUGIN);
  if (!have) {
    console.log('loading the plugin unpacked from', DIR);
    await page.evaluate(async dir => {
      const core = window.LSPluginCore;
      await core.register({ url: dir }, true);
      const prefs = (await core.loadUserPreferences?.()) || core._userPreferences || {};
      await core.saveUserPreferences?.({ externals: [...new Set([...(prefs.externals || []), dir])] });
    }, DIR);
  } else {
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.clearBrowserCache').catch(() => {}); await cdp.detach().catch(() => {});
    await page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
  }
  const up = () => frame()?.evaluate(() => !!window.Look?.index).catch(() => false);
  for (let i = 0; i < 80 && !(await up()); i++) await sleep(250);
  if (!(await up())) throw new Error('the plugin did not start (or could not read the graph)');
  console.log('the plugin runs in Logseq:', frame().url());
  if (PAGE) { await frame().evaluate(name => logseq.App.pushState('page', { name }), PAGE); await sleep(1500); }
  await sleep(800);
  const counts = await page.evaluate(() => ({
    route: location.hash,
    chain: [...document.querySelectorAll('.lk-path')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    propertyIcons: document.querySelectorAll('.lk-kind').length,
    foldedNotes: [...document.querySelectorAll('.lk-folded')].map(n => n.getAttribute('title')),
    refinements: { chain: document.querySelectorAll('.rf-tag-path').length, notes: document.querySelectorAll('.rf-folded').length, kinds: document.querySelectorAll('.rf-kind, .rf-pill-kind').length, marks: document.querySelectorAll('[data-rf-cat]').length },
    tagsOnScreen: [...document.querySelectorAll('#main-content-container a.tag')].slice(0, 6).map(a => a.textContent),
    titleRowHtml: document.querySelector('#main-content-container .ls-page-title .is-page-title-row')?.outerHTML.slice(0, 1200) || null,
  }));
  fs.mkdirSync(out, { recursive: true });
  const name = (PAGE || 'page').replace(/[^\w-]+/g, '_');
  await page.screenshot({ path: path.join(out, name + '.png') });
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(counts, null, 2));
  console.log(JSON.stringify({ ...counts, titleRowHtml: undefined }, null, 1));
  console.log('wrote', path.join(out, name + '.png'));
  await browser.close().catch(() => {});
})().catch(error => { console.error('check failed:', error.message); process.exit(1); });
