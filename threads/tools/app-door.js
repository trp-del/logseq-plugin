/* The door to the real Logseq for the tests that drive it (2026-10-23): tools/app-frames.js and tools/app-stress.js.
   Logseq must have been started with its debugging port (open -a Logseq --args --remote-debugging-port=9222).
   - connect(): the main window, after checking the open graph is one of the three test graphs (nothing is touched
     otherwise); exits with code 2 and a plain line when Logseq cannot be reached;
   - setPlugin(page, on): the plugin off or on through Logseq's own plugin core (what its Plugins panel's toggle does),
     waiting until its stylesheets are there or gone;
   - go(page, stop): a page by name, a route (#/…), or Logseq's All pages;
   - plugin(page): the plugin's own frame, to read its kit (refinementShared) and core (refinementCore);
   - counts(page): the plugin's counts door (core.counts) with the marks it has on Logseq's screen and its stylesheets;
   - graphOk(page): the open graph is still a test graph (read before every step that acts).
   Every test using this puts the app back as it found it: see the restore of each. */
const PLUGIN = 'logseq-threads';
const GRAPHS = ['Illness Test Graph', 'Seed Check', 'Stress Check'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let chromium;
try { ({ chromium } = require('playwright')); } catch (error) { chromium = null; }

async function graphName(page) {
  return String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
}
async function graphOk(page) {
  const graph = await graphName(page);
  if (!GRAPHS.includes(graph)) throw new Error(`the open graph is “${graph}”, not one of the test graphs; stopped`);
  return graph;
}
async function connect(tool) {
  if (!chromium) { console.log(`${tool}: skipped (needs Playwright)`); process.exit(2); }
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) {
    console.log(`${tool}: Logseq is not reachable on its debugging port (start it with --remote-debugging-port=9222)`); process.exit(2);
  }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  if (!page || !(await page.evaluate(() => !!document.querySelector('#app-container')))) throw new Error('no Logseq main window');
  const graph = await graphOk(page);
  return { browser, page, graph };
}
async function setPlugin(page, on) {
  await page.evaluate(async ([id, want]) => {
    const core = window.LSPluginCore, pl = core.registeredPlugins.get(id);
    if (!pl) throw new Error('the plugin is not installed');
    if (want && pl.disabled) await core.enable(id);
    if (!want && !pl.disabled) await core.disable(id);
  }, [PLUGIN, on]);
  for (let i = 0; i < 100; i++) {
    const has = await page.evaluate(id => !!document.querySelector(`style[data-ref="${id}"]`), PLUGIN);
    if (has === on) break;
    await sleep(100);
  }
  await sleep(on ? 2500 : 800);
}
async function go(page, stop) {
  await page.evaluate(stop => {
    if (stop.startsWith('#')) location.hash = stop;
    else if (stop === 'all-pages') window.logseq.api.push_state('all-pages');
    else window.logseq.api.push_state('page', { name: stop.toLowerCase() });
  }, stop);
}
// The plugin's frame (same address as Logseq's window, so its kit and core can be read).
function plugin(page) {
  return page.frames().find(f => /logseq-threads_index\.html/.test(f.url())) || null;
}
// What the plugin has set going and on screen now.
async function counts(page) {
  const frame = plugin(page);
  const door = frame ? await frame.evaluate(() => window.refinementCore?.counts?.() || null).catch(() => null) : null;
  const screen = await page.evaluate(id => {
    const marks = {};
    const frame = [...document.querySelectorAll('iframe')].find(f => /logseq-threads_index/.test(f.src));
    const shared = frame?.contentWindow?.refinementShared;
    if (shared) for (const [k, v] of shared.ownMarks(document)) marks[k] = v;
    return { marks, styles: document.querySelectorAll(`style[data-ref="${id}"]`).length };
  }, PLUGIN);
  return { door, ...screen };
}
async function heap(session) {
  await session.send('HeapProfiler.collectGarbage');
  const { metrics } = await session.send('Performance.getMetrics');
  return metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
}
// The right sidebar as it is (its items' titles, whether it shows), and put back: items added since are closed (only
// those), and it is shown or hidden as it was. Turn into links opens a tag's page there to use Logseq's own box.
const sidebarNow = page => page.evaluate(() => ({ items: [...document.querySelectorAll('#right-sidebar .sidebar-item')].map(i => i.querySelector('.sidebar-item-header')?.textContent.trim() || ''),
  open: !!document.querySelector('#right-sidebar.open') }));
async function sidebarBack(page, was) {
  await page.evaluate(async was => {
    const keep = [...was.items];
    for (const item of [...document.querySelectorAll('#right-sidebar .sidebar-item')]) {
      const title = item.querySelector('.sidebar-item-header')?.textContent.trim() || '';
      const at = keep.indexOf(title);
      if (at >= 0) { keep.splice(at, 1); continue; }
      const close = [...item.querySelectorAll('.sidebar-item-header button, .sidebar-item-header a')].find(x => x.querySelector('.ti-x') || /close/i.test(x.getAttribute('title') || x.getAttribute('aria-label') || ''));
      close?.click();
      await new Promise(r => setTimeout(r, 150));
    }
    window.logseq.api.set_right_sidebar_visible(was.open);
  }, was);
}
module.exports = { sidebarNow, sidebarBack, PLUGIN, GRAPHS, sleep, connect, graphOk, graphName, setPlugin, go, plugin, counts, heap };
