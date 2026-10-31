/* The door to the real Logseq for tools/app/check.js. Logseq must have been started with its debugging port:
     open -a Logseq --args --remote-debugging-port=9222
   and the plugin loaded unpacked. Playwright is needed (it is not a dependency of the plugin): install it somewhere and point
   NODE_PATH at its node_modules. Everything here works in a scratch page called "flow test" and refuses to touch a graph that
   is not named in TEST_GRAPHS (a comma-separated list; the default is the test graphs of logseq-db-refinements). */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let chromium;
try { ({ chromium } = require('playwright')); } catch (error) { chromium = null; }
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
const PLUGIN = 'logseq-plugin', PAGE = 'flow test';

async function connect() {
  if (!chromium) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); }
  catch (error) { console.log('skipped: Logseq is not reachable on its debugging port'); process.exit(2); }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  if (!page) throw new Error('no Logseq main window');
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (!TEST_GRAPHS.includes(graph)) throw new Error(`the open graph is “${graph}”, not one of ${TEST_GRAPHS.join(', ')}; nothing was touched`);
  return { browser, page, graph, frame: () => page.frames().find(f => f.url().includes(PLUGIN)), close: () => browser.close().catch(() => {}) };
}
// Reload the plugin from disk (what the Plugins panel's Reload does) and wait until it has read the graph.
async function reload(c) {
  // Logseq caches the plugin's entry script (loader.js); cleared first, so what is on disk is what runs.
  const cdp = await c.page.context().newCDPSession(c.page);
  await cdp.send('Network.clearBrowserCache').catch(() => {});
  await cdp.detach().catch(() => {});
  await c.page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    const ok = await c.frame()?.evaluate(async () => !!(window.Flow?.steps && await window.Flow.app.context({ wait: false }))).catch(() => false);
    if (ok) return;
  }
  throw new Error('the plugin did not come back');
}
// The scratch page, emptied (Logseq keeps a deleted page in its Recycle, so the page is kept and its blocks removed), with one
// empty block, tagged when asked. Returns the block's uuid.
async function scratch(c, tagTitle) {
  const uuid = await c.frame().evaluate(async ([tagTitle, name]) => {
    const ctx = await window.Flow.app.context();
    if (!(await logseq.Editor.getPage(name))) await logseq.Editor.createPage(name, {}, { redirect: false, createFirstBlock: false });
    for (const b of (await logseq.Editor.getPageBlocksTree(name)) || []) { try { await logseq.Editor.removeBlock(b.uuid); } catch (e) { /* gone already */ } }
    const block = await logseq.Editor.appendBlockInPage(name, '');
    if (tagTitle) await logseq.Editor.addBlockTag(block.uuid, ctx.pages.find(p => p.isTag && p.title === tagTitle).uuid);
    return block.uuid;
  }, [tagTitle, PAGE]);
  await c.page.evaluate(n => window.logseq.api.push_state('page', { name: n }), PAGE);
  await sleep(1500);
  await c.frame().evaluate(u => logseq.Editor.editBlock(u), uuid);
  await sleep(500);
  return uuid;
}
const cleanup = c => c.frame().evaluate(async n => { for (const b of (await logseq.Editor.getPageBlocksTree(n)) || []) await logseq.Editor.removeBlock(b.uuid); }, PAGE).catch(() => {});
// What a block holds now, by property title (links shown as page titles, dates as day numbers).
const held = (c, uuid) => c.frame().evaluate(async u => {
  const F = window.Flow, ctx = await F.app.context(), b = await F.db.pullBlock(u);
  const out = { tags: (F.db.pick(b, 'block/tags') || []).map(t => ctx.byId.get(F.db.idOf(t))?.title) };
  for (const p of ctx.schema.props) { const ids = F.db.valuesOf(b, p.ident); if (ids.length) out[p.title] = ids.map(id => ctx.byId.get(id)?.title ?? (ctx.days.get(id) ?? id)); }
  return out;
}, uuid);
// The proposals drawn on a block, as "Property=value (guess|sure)".
const ghosts = (c, uuid) => c.page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .flow-ghost`)].map(g => `${g.dataset.flowIdent.split('/')[1]}=${g.textContent} (${g.classList.contains('flow-guess') ? 'guess' : 'sure'})`), uuid);
module.exports = { connect, reload, scratch, cleanup, held, ghosts, sleep, TEST_GRAPHS };
