/* Checks the plugin in the real Logseq, read-only. Logseq must be running with its debugging port
   (open -a Logseq --args --remote-debugging-port=9222) on a test graph, and Playwright reachable (NODE_PATH).
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [steps]
   Loads the plugin unpacked from this folder if Logseq does not have it yet (what Load unpacked plugin does), reloads it,
   opens the window and walks it from the keyboard through the steps given (default: the walk below), writing a screenshot
   and the window's words after each. Letters are set through the window's own box (never keystrokes to the page); every
   step is read back. It refuses to run while a block is being edited, and closes the window at the end. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
const PLUGIN = 'logseq-plugin', DIR = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || path.join(DIR, 'dist', 'app-check');
// A step: type:<letters> | key:<Key>[+shift] | wait:<ms> | shot:<name>
const STEPS = (process.argv[3] || 'shot:empty,type:cons,shot:typed-cons,key:Enter,shot:consultation,type:mei,shot:typed-mei,key:Enter,shot:chen,key:ArrowRight,wait:900,shot:dug,key:ArrowDown,key:ArrowRight,wait:600,shot:group,key:Escape,key:Escape,key:Backspace,shot:widened,key:Backspace,type:chen,shot:words-chen,type:>jour,shot:commands').split(',');
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
  const up = () => frame()?.evaluate(() => !!window.Find?.window).catch(() => false);
  for (let i = 0; i < 80 && !(await up()); i++) await sleep(250);
  if (!(await up())) throw new Error('the plugin did not start');
  console.log('the plugin runs in Logseq:', frame().url());
  fs.mkdirSync(out, { recursive: true });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && /Find/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  const inWindow = (fn, arg) => page.evaluate(fn, arg);
  await frame().evaluate(() => window.Find.window.open());
  await sleep(1200);
  const read = () => inWindow(() => {
    const d = document.querySelector('dialog.fd'); if (!d) return null;
    const t = sel => [...d.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const r = d.getBoundingClientRect();
    return { box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, line: t('.fd-find')[0], pieces: t('.fd-piece'), choices: t('.fd-ck, .fd-head'), choiceValues: t('.fd-cv').map(s => s.slice(0, 160)), lit: t('.fd-lit'), rows: t('.fd-r').slice(0, 14).map(s => s.slice(0, 140)), rowCount: d.querySelectorAll('.fd-r').length, marks: d.querySelectorAll('.lk-node[data-lk-sort]').length, kids: t('.fd-kids').map(s => s.slice(0, 200)), foot: t('.fd-foot')[0], count: t('.fd-n')[0], notes: t('.fd-none, .fd-wait') };
  });
  const report = {};
  for (const step of STEPS) {
    const [what, arg] = step.split(/:(.*)/s);
    // A step that needs the window opens it again when an earlier Escape closed it.
    if ((what === 'type' || what === 'key') && !(await inWindow(() => !!document.querySelector('dialog.fd')))) { await frame().evaluate(() => window.Find.window.open()); await sleep(900); }
    if (what === 'type') await inWindow(text => { const input = document.querySelector('dialog.fd .fd-input'); input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }, arg);
    else if (what === 'key') { const [k, mod] = arg.split('+'); await inWindow(([k, mod]) => { document.querySelector('dialog.fd')?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey: mod === 'shift' })); }, [k, mod]); }
    else if (what === 'wait') await sleep(Number(arg));
    if (what === 'shot') {
      await sleep(700);
      const state = await read();
      report[arg] = state;
      await page.screenshot({ path: path.join(out, arg + '.png') });
      console.log(arg + ':', JSON.stringify({ line: state?.line, pieces: state?.pieces, choices: state?.choices, values: state?.choiceValues?.map(v => v.slice(0, 90)), lit: state?.lit, rows: state?.rowCount, first: state?.rows?.slice(0, 3), marks: state?.marks, count: state?.count, notes: state?.notes, foot: state?.foot }));
    } else await sleep(500);
  }
  // Close, whatever is open.
  for (let i = 0; i < 4 && await inWindow(() => !!document.querySelector('dialog.fd')); i++) await inWindow(() => document.querySelector('dialog.fd')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  await frame().evaluate(() => window.Find.window.close());
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ report, errors }, null, 2));
  console.log('closed:', !(await inWindow(() => !!document.querySelector('dialog.fd'))), '| errors:', errors.length ? errors : 'none', '| wrote', out);
  await browser.close().catch(() => {});
})().catch(error => { console.error('check failed:', error.message); process.exit(1); });
