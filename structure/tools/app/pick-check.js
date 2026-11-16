/* Pick several, then Merge or Move, in the real Logseq (16 November 2026): ZZ tags ticked on the map, Merge… asks which to keep and
   shows notes now and after, its yes merges; Move up a level shows where the tag will sit and moves it; both undone from History after
   a plugin reload. Writes to the graph, so it runs only on the Illness Test Graph, on ZZ tags and a ZZ page of its own (named with the
   run's time), and takes them away at the end (the page to the Recycle, the tags for good), with this run's records and History lines.
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/pick-check.js <out dir>
   Refuses to start while a block is being edited. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLUGIN = 'logseq-plugin', GRAPH = 'Illness Test Graph', RUN = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const N = { page: `ZZ Pick Check ${RUN}`, top: `ZZ Top ${RUN}`, a: `ZZ Visit ${RUN}`, b: `ZZ Appointment ${RUN}`, c: `ZZ Consult ${RUN}`, kid: `ZZ Follow-up ${RUN}` };
const out = process.argv[2] || path.join(__dirname, '..', '..', '..', 'dist', 'pick-check');
fs.mkdirSync(out, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 });
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (graph !== GRAPH) throw new Error(`the open graph is “${graph}”, not ${GRAPH}; nothing was touched`);
  const editing = () => page.evaluate(() => !!window.logseq.api.check_editing());
  if (await editing()) throw new Error('a block is being edited in Logseq; try again later');
  const route = await page.evaluate(() => location.hash);
  const frame = () => page.frames().find(f => f.url().includes(PLUGIN));
  const F = (fn, arg) => frame().evaluate(fn, arg);
  const busy = async () => { for (let i = 0; i < 20 && !await F(() => !!window.Structure.app.st.busy); i++) await sleep(100); for (let i = 0; i < 80 && await F(() => !!window.Structure.app.st.busy); i++) await sleep(250); await sleep(1200); };
  const reload = async () => {
    if (await editing()) throw new Error('a block is being edited; the plugin was not reloaded');
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.clearBrowserCache').catch(() => {}); await cdp.detach().catch(() => {});
    await page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
    for (let i = 0; i < 80 && !(await frame()?.evaluate(() => !!window.Structure?.app?.readAt).catch(() => false)); i++) await sleep(250);
  };
  let k = 0; const shot = async (name, sel) => { await sleep(500); const el = sel && await page.$(sel); const file = path.join(out, `${String(++k).padStart(2, '0')}-${name}.png`); if (el) { await el.scrollIntoViewIfNeeded(); await sleep(300); await el.screenshot({ path: file }); } else await page.screenshot({ path: file }); };
  const where = () => F(n => { const m = window.Structure.app.tray.model, T = t => [...m.tags.values()].find(x => x.title === t); const up = t => { const x = T(t); return x ? (x.parents[0] != null ? m.tags.get(x.parents[0]).title : 'the top') : 'gone'; }; return Object.fromEntries([n.a, n.b, n.c, n.kid].map(t => [t.replace(/ \d{6}$/, ''), up(t)])); }, N);
  const tagsOfNotes = () => F(async n => { const rows = await logseq.DB.datascriptQuery(`[:find ?t ?g :where [?p :block/title "${n.page}"] [?b :block/page ?p] [?b :block/title ?t] [?b :block/tags ?x] [?x :block/title ?g] [(clojure.string/starts-with? ?g "ZZ ")]]`); const by = {}; for (const [t, g] of rows || []) (by[t] ||= []).push(g.replace(/ \d{6}$/, '')); return by; }, N);
  const seen = [], before = new Set(await F(async g => JSON.parse(await logseq.FileStorage.getItem(`st-rec-${g}`) || '[]').map(x => x.id), GRAPH.replace(/[^A-Za-z0-9_-]+/g, '_')));
  await reload();
  try {
    await F(async n => {
      const W = window.PluginDoor.write, db = window.Structure.db;
      const top = await db.makeTag(n.top), a = await db.makeTag(n.a), b = await db.makeTag(n.b), c = await db.makeTag(n.c), kid = await db.makeTag(n.kid);
      for (const t of [a, b, c]) await db.addExtends(t.uuid, top.uuid);
      await db.addExtends(kid.uuid, c.uuid);
      const pg = await W.createPage(n.page, {}, { redirect: false });
      let last = null;
      for (const [w, t] of [['ZZ second opinion', a], ['ZZ pre-op check', b], ['ZZ MRI results', c], ['ZZ call back', a]]) { const blk = last ? await W.insertBlock(last.uuid, w, { sibling: true }) : await W.appendBlock(pg.uuid, w); last = blk; await W.addTag(blk.uuid, t.uuid); }
    }, N);
    await F(async () => { await window.Structure.app.reread(); });
    seen.push('before: ' + JSON.stringify(await where()) + ' ' + JSON.stringify(await tagsOfNotes()));
    // Tick the three and press Merge… in the bar.
    await F(n => { const app = window.Structure.app, m = app.tray.model, T = t => [...m.tags.values()].find(x => x.title === t).id; app.openMain(); app.st.view = 'tree'; app.st.ticks = new Set([T(n.a), T(n.b), T(n.c)]); app.st.open.add(T(n.top)); app.draw(); }, N);
    await sleep(1200); await shot('bar', '.st-acts');
    await page.click('[data-tbar="merge"]'); await sleep(2000);
    seen.push('merge ask: ' + await page.evaluate(() => document.querySelector('.st-q')?.innerText.replace(/\n+/g, ' / ')));
    await shot('merge-ask', '.st-q');
    await page.click('.st-q [data-stage]'); await busy();
    seen.push('after merge: ' + JSON.stringify(await where()) + ' ' + JSON.stringify(await tagsOfNotes()));
    // Move up a level: the Follow-up tag, now under the kept tag.
    await F(n => { const app = window.Structure.app, m = app.tray.model, T = t => [...m.tags.values()].find(x => x.title === t)?.id; app.st.ticks = new Set([T(n.kid)]); app.draw(); }, N);
    await sleep(800); await page.click('[data-tbar="up"]'); await sleep(800);
    seen.push('up ask: ' + await page.evaluate(() => document.querySelector('.st-q')?.innerText.replace(/\n+/g, ' / ')));
    await shot('up-ask', '.st-q');
    await page.click('.st-q [data-stage]'); await busy();
    seen.push('after up: ' + JSON.stringify(await where()));
    // Reloaded, then both undone from History, the later first.
    await reload();
    await F(async () => { const app = window.Structure.app; app.openMain(); app.st.view = 'log'; await app.readRecords(); app.draw(); });
    await sleep(1200); await shot('history', '.st-log');
    for (let i = 0; i < 2; i++) { await page.click('.st-log [data-logundo]'); await busy(); }
    await F(async () => { await window.Structure.app.reread(); });
    seen.push('after both Undos: ' + JSON.stringify(await where()) + ' ' + JSON.stringify(await tagsOfNotes()));
  } finally {
    await F(async ({ n, before }) => {
      const W = window.PluginDoor.write, app = window.Structure.app, run = n.page.slice(-6);
      const pages = await logseq.DB.datascriptQuery(`[:find ?u :where [?p :block/title ?t] [(clojure.string/includes? ?t "${run}")] [(clojure.string/starts-with? ?t "ZZ ")] [?p :block/uuid ?u] [?p :block/name _] (not [?p :logseq.property/deleted-at _])]`);
      for (const [u] of pages) await W.deletePage(String(u)).catch(() => {});
      const key = `structure-log:${app.graph}`, list = `st-rec-${app.graph.replace(/^logseq_db_/, '').replace(/[^A-Za-z0-9_-]+/g, '_')}`;
      const heads = JSON.parse(await logseq.FileStorage.getItem(list) || '[]'), mine = heads.filter(h => !before.includes(h.id));
      for (const h of mine) { await logseq.FileStorage.removeItem(`${list}-${h.id}`); for (let i = 0; i < (h.chunks || 0); i++) await logseq.FileStorage.removeItem(`${list}-${h.id}-${i}`); }
      await logseq.FileStorage.setItem(list, JSON.stringify(heads.filter(h => before.includes(h.id))));
      const ids = new Set(mine.map(h => h.id));
      localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key) || '[]').filter(x => !ids.has(x.rec))));
      app.st.ticks.clear(); app.st.ask = null; app.st.view = 'tree'; await app.reread(); await app.readRecords();
    }, { n: N, before: [...before] }).catch(error => seen.push('cleanup failed: ' + error.message));
    await page.evaluate(r => { location.hash = r; }, route);
    seen.push('cleaned: this run\'s ZZ tags and page, records and History lines removed; back on the page that was open');
    console.log(seen.join('\n'));
    await browser.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exit(1); });
