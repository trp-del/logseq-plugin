/* Checks the plugin in the real Logseq, read-only. Logseq must be running with its debugging port
   (open -a Logseq --args --remote-debugging-port=9222) on one of the test graphs, and Playwright reachable (NODE_PATH).
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [tag name]
   Loads the plugin unpacked from this folder if Logseq does not have it yet (what Load unpacked plugin does), reloads it,
   opens the map on the tag named (or the first kind), reads what is drawn (the rows with their counts, the card's lines,
   the issues) and writes a screenshot into <out dir>. Nothing is typed into the app and nothing is written to the graph:
   the tray is never applied here. It refuses to run while a block is being edited. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
const PLUGIN = 'logseq-plugin', DIR = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || path.join(DIR, 'dist', 'app-check');
const TAG = process.argv[3] || null;
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
  const up = () => frame()?.evaluate(() => !!window.Structure?.app?.readAt).catch(() => false);
  for (let i = 0; i < 80 && !(await up()); i++) await sleep(250);
  if (!(await up())) throw new Error('the plugin did not start (or could not read the graph)');
  console.log('the plugin runs in Logseq:', frame().url());
  await frame().evaluate(name => { const S = window.Structure; const id = name ? [...S.app.tray.model.tags.values()].find(t => t.title === name)?.id : null; S.app.openMain(id ?? undefined); }, TAG);
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!document.querySelector('.st-page .st-row'))); i++) await sleep(250);
  await sleep(600);
  const seen = await page.evaluate(() => {
    const text = el => el.textContent.replace(/\s+/g, ' ').trim();
    return {
      route: location.hash,
      rows: [...document.querySelectorAll('.st-page .st-row[data-row]')].map(r => `${'  '.repeat(Number(r.className.match(/\bd(\d)/)?.[1] || 0))}${text(r.querySelector('.nm'))} ${text(r.querySelector('.ct'))}${r.querySelector('.iss.own') ? ' !' : r.querySelector('.iss.on') ? ' ·' : ''}`),
      card: { title: text(document.querySelector('.st-card h2') || document.createElement('i')), path: text(document.querySelector('.st-card .path') || document.createElement('i')), sum: text(document.querySelector('.st-card .sum') || document.createElement('i')),
        lines: [...document.querySelectorAll('.st-card .st-ln')].map(text) },
      tray: text(document.querySelector('.st-tray') || document.createElement('i')),
      issues: window.frames.length,
      lookRuns: !!document.getElementById('look-shared') || [...document.querySelectorAll('style')].some(s => s.textContent.includes('.lk-tag')),
    };
  });
  const issues = await frame().evaluate(() => window.Structure.app.issues().map(i => `${i.rule}: ${i.text} → ${i.fix} [${i.key}]`));
  fs.mkdirSync(out, { recursive: true });
  const name = (TAG || 'map').replace(/[^\w-]+/g, '_');
  await page.screenshot({ path: path.join(out, name + '.png') });
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ ...seen, issues }, null, 2));
  console.log(seen.rows.join('\n'));
  console.log('card:', seen.card.title, '|', seen.card.path, '|', seen.card.sum); for (const l of seen.card.lines) console.log('  ', l);
  console.log('issues:'); for (const i of issues) console.log('  ', i);
  console.log('tray:', seen.tray || '(empty)', '| Look runs:', seen.lookRuns);
  console.log('wrote', path.join(out, name + '.png'));
  await browser.close().catch(() => {});
})().catch(error => { console.error('check failed:', error.message); process.exit(1); });
