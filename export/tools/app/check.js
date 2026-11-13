/* Checks the plugin in the real Logseq, read-only. Logseq must be running with its debugging port
   (open -a Logseq --args --remote-debugging-port=9222) on one of the test graphs, and Playwright reachable (NODE_PATH).
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir>
   Loads the plugin unpacked from this folder if Logseq does not have it yet (what Load unpacked plugin does), reloads it,
   reads the page on screen through the plugin and writes its Markdown and printed page into <out dir>. Nothing is
   typed into the app and no note is changed. It refuses to run while a block is being edited. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
const PLUGIN = 'logseq-plugin', DIR = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || path.join(DIR, 'dist', 'app-check');
const PAGE = process.argv[3] || null;   // a page to read by name, else the page on screen
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
  const have = await page.evaluate(id => { const core = window.LSPluginCore; const map = core?.registeredPlugins || core?._registeredPlugins; return !!(map && (map.get ? map.get(id) : map[id])); }, PLUGIN);
  if (!have) {
    console.log('loading the plugin unpacked from', DIR);
    // What Logseq's Load unpacked plugin does: register the folder (package.json names the plugin) and remember it in the externals.
    await page.evaluate(async dir => {
      const core = window.LSPluginCore;
      await core.register({ url: dir }, true);
      const prefs = (await core.loadUserPreferences?.()) || core._userPreferences || {};
      const externals = [...new Set([...(prefs.externals || []), dir])];
      await core.saveUserPreferences?.({ externals });
    }, DIR);
  } else {
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.clearBrowserCache').catch(() => {}); await cdp.detach().catch(() => {});
    await page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
  }
  for (let i = 0; i < 60 && !(await frame()?.evaluate(() => !!window.DbExport?.app).catch(() => false)); i++) await sleep(250);
  if (!(await frame()?.evaluate(() => !!window.DbExport?.app).catch(() => false))) throw new Error('the plugin did not start');
  console.log('the plugin runs in Logseq:', frame().url());
  const result = await frame().evaluate(async pageName => {
    const E = window.DbExport;
    const t0 = performance.now();
    const found = pageName ? { what: 'the page', doc: await E.db.readPage(pageName) } : await E.app.readWhat();
    if (!found?.doc) throw new Error(pageName ? 'no page named ' + pageName : 'Logseq stands on no page (the map, All pages): open a page, or name one: node tools/app/check.js <out dir> "Dr. Mei Chen"');
    const read = performance.now() - t0;
    const c = E.ui.read();
    const md = E.app.markdown(found.doc, c);
    const html = await E.app.pageHtml(found.doc, c);
    const rich = await E.app.richText(found.doc, c);
    const pics = [];
    for (const n of E.doc.collect(found.doc.nodes)) { if (n.image) pics.push(n.image.file); if (n.highlight?.area) pics.push(n.highlight.area.file); }
    const dataOk = pics.length ? (await E.files.dataUrl(pics[0])).startsWith('data:') : null;
    const graph = await logseq.App.getCurrentGraph();
    return { what: found.what, title: found.doc.title, nodes: E.doc.collect(found.doc.nodes).length, tagged: found.doc.tagged.length, read: Math.round(read), md, html, richLength: rich.html.length, pics, dataOk, graphPath: graph?.path };
  }, PAGE);
  fs.mkdirSync(out, { recursive: true });
  const name = (PAGE || 'page').replace(/[^\w-]+/g, '_');
  fs.writeFileSync(path.join(out, name + '.md'), result.md);
  fs.writeFileSync(path.join(out, name + '.html'), result.html);
  console.log(`read ${result.what} “${result.title}”: ${result.nodes} nodes (${result.tagged} tagged) in ${result.read} ms; graph path ${result.graphPath}`);
  console.log(`pictures: ${result.pics.length}${result.dataOk == null ? '' : result.dataOk ? ', the first read as a data URL' : ', the first could NOT be read'}; rich text ${result.richLength} chars`);
  console.log('wrote', path.join(out, name + '.md'), 'and .html');
  await browser.close().catch(() => {});
})().catch(error => { console.error('check failed:', error.message); process.exit(1); });
