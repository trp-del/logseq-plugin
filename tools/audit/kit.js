/* What every check of the proof run shares (16 November 2026). A check is a small program that drives the checks' own Logseq
   (port 9333, a throwaway copy of a test graph: never the owner's Logseq, which keeps 9222), prints what it saw in plain lines,
   and ends with one line the runner reads:
     RESULT {"2.2": {"ok": true, "said": "three of three splits drew the page"}}
   one entry for each goalpost line it proves. */
const PORT = Number(process.env.LOGSEQ_PORT || 9555), PLUGIN = 'logseq-plugin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// The graph a check may touch: a copy in a home folder made by fresh.js (…/home/logseq/graphs/…), never one under the real home.
const REAL_HOME = require('node:os').userInfo().homedir;
const isCopy = dir => !!dir && /\/home\/logseq\/graphs\//.test(dir) && !dir.startsWith(REAL_HOME + '/logseq/') && !dir.startsWith(REAL_HOME + '/Documents/');
const SKIP = ['block/created-at', 'block/updated-at', 'block/tx-id'];

/* What would leave the checks' own Logseq is kept inside the run (17 November 2026, after a check put a test page on the Mac's
   clipboard and another stood still on the Mac's print window): the clipboard is a pretend one that remembers what was copied;
   Logseq's bridge to the Mac answers a folder question with the run's own folder, shows no file in the Finder, opens nothing in a
   browser and writes no file outside the run's folder; and DB Export's print step keeps the page it would print. Each is written
   down in window.__outside, so a check can say what a command would have copied, saved or printed. Put in once per window; the
   print step is put in again whenever the plugin's frame is new. */
const GUARD = dir => {
  if (window.__outside) return 'already';
  window.__outside = []; window.__clip = { text: '', html: '' };
  const note = (what, detail) => window.__outside.push({ what, detail: String(detail ?? '').slice(0, 300), at: Date.now() });
  const fake = {
    write: async items => { for (const it of items || []) for (const t of it.types || []) { const s = await (await it.getType(t)).text(); if (t === 'text/html') window.__clip.html = s; else window.__clip.text = s; } note('clipboard', window.__clip.text); },
    writeText: async t => { window.__clip.text = String(t); note('clipboard', window.__clip.text); }, readText: async () => window.__clip.text, read: async () => [],
  };
  try { Object.defineProperty(navigator, 'clipboard', { value: fake, configurable: true }); } catch (e) { note('the clipboard could not be guarded', e.message); }
  document.addEventListener('copy', e => { note('clipboard', 'a copy by key or command'); }, true);
  const apis = window.apis;
  if (apis && typeof apis.doAction === 'function') {
    const real = apis.doAction.bind(apis);
    apis.doAction = async args => {
      const what = args && args[0];
      if (what === 'showOpenDialog' || what === 'showSaveDialog') { note(what, args[1] && args[1].title); return { canceled: false, filePaths: [dir], filePath: dir + '/saved by the check' }; }
      if (what === 'openFileInFolder' || what === 'openPath' || what === 'openExternal') { note(what, args[1]); return null; }
      if (what === 'writeFile') { if (!String(args[2] || '').startsWith(dir)) { note('writeFile refused', args[2]); throw new Error('the checks write no file outside their own folder'); } note('writeFile', args[2]); }
      return real(args);
    };
    for (const name of ['openExternal', 'openPath', 'showItemInFolder']) if (typeof apis[name] === 'function') apis[name] = (...a) => { note(name, a[0]); return null; };
  } else note('Logseq’s bridge could not be guarded', '');
  window.print = () => note('print', 'the window itself');
  setInterval(() => { try { for (const f of document.querySelectorAll('iframe')) { const p = f.contentWindow && f.contentWindow.DbExport && f.contentWindow.DbExport.print; if (p && !p.__guarded) { p.print = async html => { window.__printed = String(html || ''); note('print', window.__printed.length + ' characters of page'); }; p.__guarded = true; } } } catch (e) { /* a frame of another origin */ } }, 250);
  return 'guarded';
};
const outside = page => page.evaluate(() => (window.__outside || []).slice());
async function connect({ write = false } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 8000 });
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  if (!page) throw new Error('the checks\' own Logseq has no window');
  const g = await page.evaluate(async () => { const g = await window.logseq.api.get_current_graph(); return { name: String(g?.name || ''), path: String(g?.path || '') }; });
  const graph = g.name;
  if (!isCopy(g.path)) throw new Error(`the open graph “${graph}” is at ${g.path || 'no folder'}, not a copy made for the checks; nothing was touched`);
  const frame = () => page.frames().find(f => f.url().includes(PLUGIN));
  // …/home/logseq/graphs/<name> → the run's folder beside home: what a check saves lands in <run>/saved.
  const saved = g.path.replace(/\/home\/logseq\/graphs\/.*$/, '/saved'); require('node:fs').mkdirSync(saved, { recursive: true });
  await page.evaluate(GUARD, saved); await sleep(300);
  const said = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') said.push({ type: m.type(), text: m.text().slice(0, 400) }); });
  page.on('pageerror', e => said.push({ type: 'uncaught', text: String(e).slice(0, 400) }));
  return { browser, page, frame, graph: graph.replace(/^logseq_db_/, ''), graphPath: g.path, said };
}
// What the console said that is the plugin's own: Logseq's own noise in a home with no network (a name that does not resolve) is left out.
const ours = said => said.filter(s => !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(s.text));
const go = async (page, name, wait = 3000) => { await page.evaluate(n => window.logseq.api.push_state('page', { name: String(n).toLowerCase() }), name); await sleep(wait); };
const route = async (page, hash, wait = 2500) => { await page.evaluate(h => { location.hash = h; }, hash); await sleep(wait); };
const setPlugin = async (page, on) => {
  await page.evaluate(async ([id, on]) => { const core = window.LSPluginCore, pl = core.registeredPlugins.get(id); if (on && pl.disabled) await core.enable(id); if (!on && !pl.disabled) await core.disable(id); }, [PLUGIN, on]);
  await sleep(on ? 6000 : 2500);
};
// Every fact about every page and bullet, links written as the id of what they point to, the times Logseq stamps on a save left out.
// Asked in Logseq's own window an attribute comes back as "uuid" for :block/uuid and ":logseq.property/status" for the rest:
// both are put back to the plain form (block/uuid, logseq.property/status) before anything is compared.
const fingerprint = page => page.evaluate(async skip => {
  const raw = await window.logseq.api.datascript_query('[:find ?e ?a ?v :where [?e :block/uuid] [?e ?a ?v]]');
  const norm = a => { a = String(a); return a.startsWith(':') ? a.slice(1) : a.includes('/') ? a : 'block/' + a; };
  const rows = raw.map(([e, a, v]) => [e, norm(a), v]);
  const uuid = new Map(); for (const [e, a, v] of rows) if (a === 'block/uuid') uuid.set(e, v);
  const out = {};
  for (const [e, a, v] of rows) { if (skip.includes(a)) continue; (out[uuid.get(e)] ||= []).push(a + ' ' + (typeof v === 'number' && uuid.has(v) ? '→' + uuid.get(v) : JSON.stringify(v))); }
  for (const k in out) out[k].sort();
  if (out.undefined || Object.keys(out).length < 2) throw new Error('the graph could not be read note by note');
  return out;
}, SKIP);
const title = facts => { const t = (facts || []).find(f => f.startsWith('block/title ')); return t ? JSON.parse(t.slice(12)).slice(0, 60) : '(no words)'; };
function differs(before, after) {
  const out = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
    const was = (before[k] || []).filter(f => !(after[k] || []).includes(f)), now = (after[k] || []).filter(f => !(before[k] || []).includes(f));
    out.push({ uuid: k, what: !before[k] ? 'new' : !after[k] ? 'gone' : 'changed', words: title(after[k] || before[k]), was: was.slice(0, 4), now: now.slice(0, 4) });
  }
  return out;
}
// How many changes are made to the page in ms with no input, and by what.
const changes = (page, ms = 2000) => page.evaluate(ms => new Promise(res => {
  let n = 0; const who = {};
  const mo = new MutationObserver(rs => { n += rs.length; for (const r of rs) { const t = r.target.nodeType === 1 ? r.target : r.target.parentElement; const k = (t?.tagName || '?').toLowerCase() + '.' + String(t?.className?.baseVal ?? t?.className ?? '').split(/\s+/).slice(0, 2).join('.'); who[k] = (who[k] || 0) + 1; } });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  setTimeout(() => { mo.disconnect(); res({ n, who: Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 3) }); }, ms);
}), ms);
// The one line the runner reads. lines: { '1.1': { ok, said } }.
function result(lines) { console.log('RESULT ' + JSON.stringify(lines)); }
const finish = async (browser, lines) => { result(lines); await browser.close(); process.exit(Object.values(lines).every(l => l.ok) ? 0 : 1); };
const fail = error => { console.error(String(error && error.stack || error).slice(0, 1500)); process.exit(2); };
module.exports = { PORT, PLUGIN, GUARD, outside, sleep, connect, ours, go, route, setPlugin, fingerprint, differs, changes, result, finish, fail };
