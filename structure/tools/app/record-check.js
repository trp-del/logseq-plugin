/* The record in the real Logseq (16 November 2026): a merge applied, the plugin reloaded so nothing of it is left in memory, and
   the merge undone from the Log's arrow, as after a restart. Writes to the graph, so it runs only on the Illness Test Graph, on
   tags and a page of its own named "ZZ …", and takes them all away again at the end (the page to the Recycle).
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/record-check.js <out dir>
   Refuses to start while a block is being edited. Screenshots: 1 before, 2 after the merge with the Log, 3 the Log after a
   reload, 4 after the Log's Undo. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLUGIN = 'logseq-plugin', GRAPH = 'Illness Test Graph';
const out = process.argv[2] || path.join(__dirname, '..', '..', '..', 'dist', 'record-check');
fs.mkdirSync(out, { recursive: true });
let chromium; try { ({ chromium } = require('playwright')); } catch (error) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 });
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (graph !== GRAPH) throw new Error(`the open graph is “${graph}”, not ${GRAPH}; nothing was touched`);
  const editing = () => page.evaluate(() => !!window.logseq.api.check_editing());
  if (await editing()) throw new Error('a block is being edited in Logseq; try again later');
  const frame = () => page.frames().find(f => f.url().includes(PLUGIN));
  const reload = async () => {
    if (await editing()) throw new Error('a block is being edited; the plugin was not reloaded');
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.clearBrowserCache').catch(() => {}); await cdp.detach().catch(() => {});
    await page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
    const up = () => frame()?.evaluate(() => !!window.Structure?.app?.readAt && !!window.Structure?.records).catch(() => false);
    for (let i = 0; i < 80 && !(await up()); i++) await sleep(250);
    if (!(await up())) throw new Error('the plugin did not start');
  };
  const shot = async (n, name) => { await sleep(700); await page.screenshot({ path: path.join(out, `${n}-${name}.png`) }); };
  const F = (fn, arg) => frame().evaluate(fn, arg);
  const tagsOf = () => F(async () => {
    const q = '[:find ?nt ?t :where [?p :block/title "ZZ Record Check"] [?b :block/page ?p] [?b :block/title ?nt] [?b :block/tags ?tg] [?tg :block/title ?t] [(clojure.string/starts-with? ?t "ZZ ")]]';
    const rows = await logseq.DB.datascriptQuery(q);
    const by = {}; for (const [n, t] of rows || []) (by[n] ||= []).push(t); for (const k in by) by[k].sort(); return by;
  });
  const seen = [];
  await reload();
  // 0. FileStorage answers in this Logseq.
  const store = await F(async () => { const S = logseq.FileStorage; await S.setItem('st-probe', 'yes'); const v = await S.getItem('st-probe'); await S.removeItem('st-probe'); return v; });
  seen.push(`FileStorage round trip: ${store}`);
  // 1. Two throwaway tags and three notes.
  await F(async () => {
    const S = window.Structure, db = S.db;
    const page = await logseq.Editor.createPage('ZZ Record Check', {}, { redirect: false });
    const visit = await db.makeTag('ZZ Visit'), consult = await db.makeTag('ZZ Consult');
    const words = ['ZZ note one', 'ZZ note two', 'ZZ note three'];
    let last = null;
    for (const w of words) { last = last ? await logseq.Editor.insertBlock(last.uuid, w, { sibling: true }) : await logseq.Editor.appendBlockInPage(page.uuid, w); }
    const blocks = await logseq.Editor.getPageBlocksTree(page.uuid);
    for (const b of blocks) await db.addTag(b.uuid, visit.uuid);
    await db.addTag(blocks[2].uuid, consult.uuid);
  });
  await page.evaluate(() => window.logseq.api.push_state('page', { name: 'zz record check' }));
  const before = await tagsOf(); seen.push('before: ' + JSON.stringify(before)); await shot(1, 'before');
  // 2. The merge, applied as the tray applies it.
  await F(async () => {
    const S = window.Structure, app = S.app; await app.reread();
    const T = name => [...app.tray.model.tags.values()].find(t => t.title === name).id;
    app.stage({ kind: 'merge', from: T('ZZ Visit'), into: T('ZZ Consult') });
    await app.apply();
  });
  const merged = await tagsOf(); seen.push('after merge: ' + JSON.stringify(merged));
  await shot(2, 'merged');
  // 3. Reloaded: the Undo in memory is gone; the Log's arrow is read from disk.
  await reload();
  await F(async () => { const app = window.Structure.app; app.openMain(); app.st.view = 'log'; await app.readRecords(); app.draw(); });
  for (let i = 0; i < 20 && !(await page.evaluate(() => !!document.querySelector('.st-log [data-logundo]'))); i++) await sleep(250);
  const arrow = await page.evaluate(() => !!document.querySelector('.st-log [data-logundo]'));
  seen.push(`after reload, the Log has an Undo arrow: ${arrow}`);
  await page.hover('.st-log [data-logundo]').catch(() => {});
  await shot(3, 'log-after-reload');
  // 4. The arrow pressed.
  await page.click('.st-log [data-logundo]');
  for (let i = 0; i < 40 && await F(() => !!window.Structure.app.st.busy); i++) await sleep(250);
  await sleep(800);
  const undone = await tagsOf(); seen.push('after the Log\'s Undo: ' + JSON.stringify(undone));
  seen.push('the Log line: ' + await page.evaluate(() => document.querySelector('.st-log .ln')?.textContent.replace(/\s+/g, ' ').trim()));
  await shot(4, 'undone');
  await page.evaluate(() => window.logseq.api.push_state('page', { name: 'zz record check' }));
  await shot(5, 'page-after-undo');
  // Taken away: the ZZ tags (for good), the page (Recycle), their Log lines and records.
  await F(async () => {
    const S = window.Structure, app = S.app;
    for (const name of ['ZZ Visit', 'ZZ Consult']) { const p = await logseq.Editor.getPage(name); if (p) await logseq.Editor.deletePage(p.uuid); }
    const p = await logseq.Editor.getPage('ZZ Record Check'); if (p) await logseq.Editor.deletePage(p.uuid);
    const key = `structure-log:${app.graph}`, ids = new Set();
    const kept = JSON.parse(localStorage.getItem(key) || '[]').filter(x => { if (x.rec && /^Merge ZZ Visit into ZZ Consult/.test(x.text)) {   // only this check's own lines: older ZZ lines are other checks' history if (x.rec) ids.add(x.rec); return false; } return true; });
    localStorage.setItem(key, JSON.stringify(kept));
    const list = `st-rec-${app.graph.replace(/^logseq_db_/, '').replace(/[^A-Za-z0-9_-]+/g, '_')}`;
    const heads = JSON.parse(await logseq.FileStorage.getItem(list) || '[]');
    for (const h of heads.filter(h => ids.has(h.id))) { await logseq.FileStorage.removeItem(`${list}-${h.id}`); for (let n = 0; n < (h.chunks || 0); n++) await logseq.FileStorage.removeItem(`${list}-${h.id}-${n}`); }
    await logseq.FileStorage.setItem(list, JSON.stringify(heads.filter(h => !ids.has(h.id))));
    await app.reread(); await app.readRecords();
  });
  seen.push('cleaned: ZZ tags deleted, page to the Recycle, Log lines and records removed');
  console.log(seen.join('\n'));
  await browser.close().catch(() => {});
})().catch(error => { console.error(error); process.exit(1); });
