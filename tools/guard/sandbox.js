/* The guard's own Logseq (18 November 2026). A second Logseq on this Mac with its own home folder, profile and debugging port, on
   throwaway copies of the test graphs, so the guard can look at the plugin as it ships and never touches the owner's window,
   graphs, settings or plugin folder. One graph per start: Logseq opens the one graph it finds in its home.

     const box = await sandbox.start({ dir, graph: 'Illness Test Graph', plugin: '/abs/plugin/folder' })
     … box.page, box.frame() …
     await sandbox.stop(box)

   Ports from GUARD_PORT, 9340 by default, one more for each graph run at the same time (9340, 9341); the owner's Logseq keeps 9222,
   the audit 9333, other threads 9334–9336, 9444, 9555–9556.
   Graph copies come from GUARD_GRAPHS (folders of graphs, colon-separated), else ~/logseq-test-graphs/graphs and ~/logseq/graphs,
   newest backup first, which Logseq writes whole and never holds locked. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const PORT = Number(process.env.GUARD_PORT || 9340), APP = '/Applications/Logseq.app/Contents/MacOS/Logseq', ID = 'logseq-plugin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOTS = (process.env.GUARD_GRAPHS || [path.join(os.homedir(), 'logseq-test-graphs', 'graphs'), path.join(os.homedir(), 'logseq', 'graphs')].join(':')).split(':');

const up = (port = PORT) => new Promise(resolve => {
  const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 1500 }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b)); });
  req.on('error', () => resolve('')); req.on('timeout', () => { req.destroy(); resolve(''); });
});

function graphFile(name) {
  for (const root of ROOTS) {
    const base = path.join(root, name), backups = path.join(base, 'backup');
    if (fs.existsSync(backups)) {
      const newest = fs.readdirSync(backups).filter(n => fs.existsSync(path.join(backups, n, 'db.sqlite'))).sort().pop();
      if (newest) return path.join(backups, newest, 'db.sqlite');
    }
    if (fs.existsSync(path.join(base, 'db.sqlite'))) return path.join(base, 'db.sqlite');
  }
  throw new Error(`no copy of the test graph “${name}” in ${ROOTS.join(' or ')}`);
}

async function start({ dir, graph, plugin, settings = {}, port = PORT }) {
  if (await up(port)) throw new Error(`something already answers on port ${port}: stop it first (node tools/guard/guard.js stop)`);
  const home = path.join(dir, 'home'), profile = path.join(dir, 'profile');
  fs.mkdirSync(path.join(home, '.logseq', 'settings'), { recursive: true }); fs.mkdirSync(profile, { recursive: true });
  const to = path.join(home, 'logseq', 'graphs', graph); fs.mkdirSync(to, { recursive: true });
  fs.copyFileSync(graphFile(graph), path.join(to, 'db.sqlite'));
  // Apple's helper is one per Mac: a test copy must never teach it its notes (the audit, 16 Nov). The window is narrow-read as the owner's.
  fs.writeFileSync(path.join(home, '.logseq', 'settings', ID + '.json'), JSON.stringify({ proposalsModel: false, ...settings }));
  const log = fs.openSync(path.join(dir, 'logseq.log'), 'a');
  const child = spawn(APP, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-mock-keychain'],
    { detached: true, stdio: ['ignore', log, log], env: { ...process.env, HOME: home, CFFIXED_USER_HOME: home } });
  child.unref();
  for (let i = 0; i < 80 && !(await up(port)); i++) await sleep(500);
  if (!(await up(port))) throw new Error(`the guard's Logseq did not answer on ${port}; see ${path.join(dir, 'logseq.log')}`);
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 10000 });
  let page = null;
  for (let i = 0; i < 60 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url())); if (!page) await sleep(500); }
  if (!page) throw new Error('the guard\'s Logseq has no window');
  // The graph is open when Logseq answers a read about it.
  let g = null;
  for (let i = 0; i < 60 && !g; i++) { g = await page.evaluate(async () => { try { const g = await window.logseq.api.get_current_graph(); return g && g.path ? g : null; } catch (e) { return null; } }).catch(() => null); if (!g) await sleep(500); }
  if (!g || !String(g.path).startsWith(home)) throw new Error(`the guard's Logseq opened ${g ? g.path : 'no graph'}, not its copy`);
  const said = await page.evaluate(async url => { try { await window.LSPluginCore.register({ url }, true); return ''; } catch (e) { return String(e && e.message || e); } }, plugin);
  if (said) throw new Error('the plugin did not load: ' + said);
  const frame = () => page.frames().find(f => f.url().includes(ID));
  let parts = null;
  for (let i = 0; i < 60 && !parts; i++) { parts = await frame()?.evaluate(() => (window.PluginDoor?.started?.length ? window.PluginDoor.started.map(m => m.key) : null)).catch(() => null); if (!parts) await sleep(500); }
  if (!parts) throw new Error('the plugin loaded but none of its parts started');
  await sleep(2500);
  return { dir, home, graph, browser, page, frame, parts, pid: child.pid, port };
}

async function stop(box) {
  // Not awaited: the answer never comes once the window is gone, and a promise left waiting would end the guard's own process.
  try { const s = await box.browser.newBrowserCDPSession(); s.send('Browser.close').catch(() => {}); } catch (e) { /* ended below */ }
  const port = box.port || PORT;
  await sleep(1500);
  for (let i = 0; i < 20 && (await up(port)); i++) await sleep(400);
  if (await up(port)) { try { execFileSync('pkill', ['-9', '-f', `remote-debugging-port=${port} --user-data-dir=`]); } catch (e) { /* none */ } await sleep(1000); }
  // Logseq's graph workers outlive the window and keep the copy locked: end only the ones whose folder is this run's home.
  if (box && box.home) {
    try {
      for (const line of execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n')) {
        const m = line.match(/^\s*(\d+) .*db-worker-node\.js .*--root-dir (\S+)/);
        if (m && m[2].startsWith(box.home)) { try { process.kill(Number(m[1]), 'SIGKILL'); } catch (e) { /* gone */ } }
      }
    } catch (e) { /* no ps */ }
  }
}

// For `guard.js stop`: whatever answers on the guard's port, and only that.
async function stopAny() {
  const said = [];
  for (const port of [PORT, PORT + 1]) {
    if (!(await up(port))) { said.push('nothing ran on ' + port); continue; }
    const { chromium } = require('playwright');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8000 }).catch(() => null);
    await stop({ port, browser: browser || { newBrowserCDPSession: async () => { throw new Error('no'); } } });
    said.push((await up(port)) ? 'still answering on ' + port : 'stopped on ' + port);
  }
  return said.join('; ');
}

module.exports = { PORT, start, stop, stopAny, up, sleep };
