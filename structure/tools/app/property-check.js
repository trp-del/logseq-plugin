/* Fixing messy properties in the real Logseq (16 November 2026): "Turn into dates…" and "Split into two properties…" from a
   property's right-click menu in Every property, each previewed on real notes, applied, the plugin reloaded, and undone from the
   Log. Writes to the graph, so it runs only on the Illness Test Graph, on tags, properties and a page of its own named "ZZ …",
   and takes them all away again at the end (the page to the Recycle; the ZZ tags and properties for good).
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/property-check.js <out dir>
   Refuses to start while a block is being edited. Screenshots in <out dir>, numbered in order. */
const fs = require('node:fs'), path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLUGIN = 'logseq-plugin', GRAPH = 'Illness Test Graph';
// --clean <run>: only takes away what an earlier run of that time left (a run stopped halfway).
const CLEAN = process.argv[3] === '--clean' ? process.argv[4] : null;
const RUN = CLEAN || new Date().toISOString().slice(11, 19).replace(/:/g, '');
const N = { page: `ZZ Prop Check ${RUN}`, visit: `ZZ Visit ${RUN}`, hosp: `ZZ Hospital ${RUN}`, doc: `ZZ Doctor ${RUN}`, date: `ZZ Date seen ${RUN}`, prov: `ZZ Provider ${RUN}`, place: `ZZ Place ${RUN}` };
const out = process.argv[2] || path.join(__dirname, '..', '..', '..', 'dist', 'property-check');
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
  const F = (fn, arg) => frame().evaluate(fn, arg);
  const reload = async () => {
    if (await editing()) throw new Error('a block is being edited; the plugin was not reloaded');
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.clearBrowserCache').catch(() => {}); await cdp.detach().catch(() => {});
    await page.evaluate(async id => { await window.LSPluginCore.reload(id); }, PLUGIN);
    const up = () => frame()?.evaluate(() => !!window.Structure?.app?.readAt).catch(() => false);
    for (let i = 0; i < 80 && !(await up()); i++) await sleep(250);
    if (!(await up())) throw new Error('the plugin did not start');
  };
  let shotN = 0;
  const shot = async (name, sel) => {
    await sleep(600); const file = path.join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    const box = sel ? await page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: r.width + 32, height: r.height + 32 }; }, sel) : null;
    if (box) await sleep(300);
    await page.screenshot({ path: file, ...(box ? { clip: box } : {}) });
  };
  // What each ZZ note holds now, its property names read back.
  const holds = () => F(async n => {
    const rows = await logseq.DB.datascriptQuery(`[:find ?t ?pn ?vt :where [?p :block/title "${n.page}"] [?b :block/page ?p] [?b :block/title ?t] [?b ?a ?v] [?pr :db/ident ?a] [?pr :block/title ?pn] [(clojure.string/starts-with? ?pn "ZZ ")] [(get-else $ ?v :block/title "") ?vt]]`);
    const by = {}; for (const [t, pn, vt] of rows || []) ((by[t] ||= {})[pn.replace(/ \d{6}/, '')] ||= []).push(vt); for (const t in by) for (const k in by[t]) by[t][k].sort(); return by;
  }, N);
  const seen = [];
  const recsBefore = new Set();
  await reload();
  if (!CLEAN) {
  // 1. Two tags for the values, a tag the notes carry, two properties and four notes.
  await F(async n => {
    const W = window.PluginDoor.write, S = window.Structure, db = S.db;
    const visit = await db.makeTag(n.visit), hosp = await db.makeTag(n.hosp), doc = await db.makeTag(n.doc);
    const city = await W.createPage(`ZZ City Hospital ${n.page.slice(-6)}`, {}, { redirect: false }), north = await W.createPage(`ZZ Northgate ${n.page.slice(-6)}`, {}, { redirect: false }), dr = await W.createPage(`ZZ Dr Okafor ${n.page.slice(-6)}`, {}, { redirect: false });
    await W.addTag(city.uuid, hosp.uuid); await W.addTag(north.uuid, hosp.uuid); await W.addTag(dr.uuid, doc.uuid);
    const date = await W.makeProperty(n.date, 'default'), prov = await W.makeProperty(n.prov, 'node', undefined, { many: true });
    await db.addClassProp(visit.uuid, date.id); await db.addClassProp(visit.uuid, prov.id);
    const pg = await W.createPage(n.page, {}, { redirect: false });
    const notes = [['ZZ second opinion', '14 Oct 2026', [dr, city]], ['ZZ pre-op check', 'last Tuesday', [north]], ['ZZ bloods', 'Oct 9, 2026', [north, dr]], ['ZZ scan review', '28 Sep 2026', [dr]]];
    let last = null;
    for (const [words, day, provs] of notes) {
      const b = last ? await W.insertBlock(last.uuid, words, { sibling: true }) : await W.appendBlock(pg.uuid, words);
      last = b;
      await W.addTag(b.uuid, visit.uuid);
      await W.setValue(b.uuid, date.ident, day);
      for (const v of provs) await W.setValue(b.uuid, prov.ident, v.id ?? (await logseq.Editor.getPage(v.uuid)).id, { entityId: true });
    }
  }, N);
  seen.push('before: ' + JSON.stringify(await holds()));
  for (const h of await F(async g => JSON.parse(await logseq.FileStorage.getItem(`st-rec-${g}`) || '[]').map(x => x.id), GRAPH.replace(/[^A-Za-z0-9_-]+/g, '_'))) recsBefore.add(h);
  // The map's Every property, the property's row right-clicked, a word of its menu pressed.
  const menuOn = async (prop, word) => {
    await F(async () => { const app = window.Structure.app; await app.reread(); app.openMain(); app.st.view = 'table'; app.draw(); });
    await F(name => { const app = window.Structure.app; app.st.find = name; app.draw(); }, prop);
    await sleep(1500);
    const sel = await page.evaluate(name => { const row = [...document.querySelectorAll('.st-tbl .tr')].find(r => r.textContent.includes(name)); if (!row) return null; row.scrollIntoView({ block: 'center' }); row.id = 'zz-row'; return '#zz-row'; }, prop);
    if (!sel) throw new Error(`no row for ${prop}`);
    await sleep(300);
    const box = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width * 0.6, y: r.y + r.height / 2 }; }, sel);
    await page.mouse.click(box.x, box.y, { button: 'right' }); await sleep(500);
    await page.click(`.lk-item[data-act]:has-text("${word}")`); await sleep(1500);
  };
  // 2. Turn into dates.
  await menuOn(N.date, 'Turn into dates');
  seen.push('dates preview: ' + await page.evaluate(() => document.querySelector('.st-q')?.innerText.replace(/\n+/g, ' / ')));
  await shot('dates-preview', '.st-q');
  await page.click('.st-q [data-stage]'); for (let i = 0; i < 60 && await F(() => !!window.Structure.app.st.busy); i++) await sleep(250); await sleep(800);
  seen.push('after dates: ' + JSON.stringify(await holds()));
  // 3. Split into two properties.
  await menuOn(N.prov, 'Split into two properties');
  await page.click(`.st-prompt [data-pick]:has-text("${N.hosp}")`); await sleep(1500);
  await page.fill('.st-q [data-pcname]', N.place);
  seen.push('split preview: ' + await page.evaluate(() => document.querySelector('.st-q')?.innerText.replace(/\n+/g, ' / ')));
  await shot('split-preview', '.st-q');
  await page.click('.st-q [data-stage]'); for (let i = 0; i < 60 && await F(() => !!window.Structure.app.st.busy); i++) await sleep(250); await sleep(800);
  seen.push('after split: ' + JSON.stringify(await holds()));
  await F(n => { const p = logseq.Editor.getPage(n.page); return p.then(x => logseq.App.pushState('page', { name: x.uuid })); }, N); await shot('page-after');
  // 4. Reloaded, then both undone from the Log, the later first.
  await reload();
  await F(async () => { const app = window.Structure.app; app.openMain(); app.st.view = 'log'; await app.readRecords(); app.draw(); });
  await sleep(1200); await shot('log', '.st-log');
  for (let k = 0; k < 2; k++) {
    // The Log's Undo reads the record from disk before it starts: wait for it to start, then to end.
    await page.click('.st-log [data-logundo]'); for (let i = 0; i < 20 && !await F(() => !!window.Structure.app.st.busy); i++) await sleep(100); for (let i = 0; i < 80 && await F(() => !!window.Structure.app.st.busy); i++) await sleep(250); await sleep(1200);
    seen.push(`undo ${k + 1}: notices ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.ui__toast, .notification, [class*=toast]')].map(x => x.innerText.trim()).filter(Boolean)))}; records ${JSON.stringify(await F(async () => [...window.Structure.app.records.values()].slice(0, 3).map(h => [h.text.slice(0, 40), h.state, h.left])))}`);
  }
  seen.push('after both Undos: ' + JSON.stringify(await holds()));
  seen.push('ZZ properties left: ' + JSON.stringify(await F(async () => (await logseq.DB.datascriptQuery('[:find ?t :where [?p :block/tags :logseq.class/Property] [?p :block/title ?t] [(clojure.string/starts-with? ?t "ZZ ")]]')).map(r => r[0]))));
  await F(n => logseq.Editor.getPage(n.page).then(x => logseq.App.pushState('page', { name: x.uuid })), N); await shot('page-after-undo');
  } else for (const h of await F(async g => JSON.parse(await logseq.FileStorage.getItem(`st-rec-${g}`) || '[]').filter(x => !/ZZ /.test(x.text)).map(x => x.id), GRAPH.replace(/[^A-Za-z0-9_-]+/g, '_'))) recsBefore.add(h);
  // Taken away: everything named ZZ … this run made, this run's Log lines and records.
  await F(() => { const app = window.Structure.app; app.st.find = ''; app.draw(); });
  await F(async ({ n, before }) => {
    const W = window.PluginDoor.write, app = window.Structure.app, run = n.page.slice(-6);
    const pages = await logseq.DB.datascriptQuery(`[:find ?u ?t :where [?p :block/title ?t] [(clojure.string/starts-with? ?t "ZZ ")] [(clojure.string/includes? ?t "${run}")] [?p :block/uuid ?u] [?p :block/name _]]`);
    for (const [u] of pages) await W.deletePage(String(u)).catch(() => {});
    const props = await logseq.DB.datascriptQuery(`[:find ?u :where [?p :block/tags :logseq.class/Property] [?p :block/title ?t] [(clojure.string/includes? ?t "${run}")] [?p :block/uuid ?u]]`);
    for (const [u] of props) await logseq.Editor.deletePage(String(u)).catch(() => {});
    const key = `structure-log:${app.graph}`, list = `st-rec-${app.graph.replace(/^logseq_db_/, '').replace(/[^A-Za-z0-9_-]+/g, '_')}`;
    const heads = JSON.parse(await logseq.FileStorage.getItem(list) || '[]'), mine = heads.filter(h => !before.includes(h.id));
    for (const h of mine) { await logseq.FileStorage.removeItem(`${list}-${h.id}`); for (let i = 0; i < (h.chunks || 0); i++) await logseq.FileStorage.removeItem(`${list}-${h.id}-${i}`); }
    await logseq.FileStorage.setItem(list, JSON.stringify(heads.filter(h => before.includes(h.id))));
    const ids = new Set(mine.map(h => h.id));
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key) || '[]').filter(x => !ids.has(x.rec))));
    await app.reread(); await app.readRecords();
  }, { n: N, before: [...recsBefore] });
  seen.push('cleaned: this run\'s ZZ pages, tags and properties, Log lines and records removed');
  console.log(seen.join('\n'));
  await browser.close().catch(() => {});
})().catch(error => { console.error(error); process.exit(1); });
