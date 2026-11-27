/* A test Logseq: a second Logseq on this Mac with its own home folder, profile and debugging port, on a throwaway copy of a
   test graph, with the plugin loaded from a folder. Nothing of the owner's is touched: their window, graphs, settings and plugin
   folder stay as they are, and their Logseq keeps port 9222. One graph per start: Logseq opens the one graph it finds in its home.

     const box = await sandbox.start({ dir, graph: 'Illness Test Graph', plugin: '/abs/plugin/folder', port })
     … box.page, box.frame() …
     await sandbox.stop(box)

   Used by the walk (tools/walk.js, port 9480) and by the hand test's opener, which asks for it as tools/guard/sandbox.js.
   A start that fails ends the Logseq it started, so nothing is left answering on the port.
   stop({ port, home }) also ends a test Logseq nothing is joined to any more: only one started with that debugging port and a
   profile folder of its own, never the owner's.
   The graph's copy comes from ~/logseq-test-graphs/graphs or ~/logseq/graphs, the newest backup first, which Logseq writes whole
   and never holds locked. LOGSEQ_APP names another copy of Logseq to start (the hand test's own app). */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const COLOUR = '--force-color-profile=srgb';
const APP = process.env.LOGSEQ_APP || '/Applications/Logseq.app/Contents/MacOS/Logseq', ID = 'logseq-plugin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOTS = [path.join(os.homedir(), 'logseq-test-graphs', 'graphs'), path.join(os.homedir(), 'logseq', 'graphs')];

const up = port => new Promise(resolve => {
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

async function start({ dir, graph, plugin, settings = {}, port }) {
  if (!port) throw new Error('a test Logseq needs a debugging port of its own');
  if (await up(port)) throw new Error(`something already answers on port ${port}: close that Logseq first`);
  const home = path.join(dir, 'home'), profile = path.join(dir, 'profile');
  fs.mkdirSync(path.join(home, '.logseq', 'settings'), { recursive: true }); fs.mkdirSync(profile, { recursive: true });
  const to = path.join(home, 'logseq', 'graphs', graph); fs.mkdirSync(to, { recursive: true });
  fs.copyFileSync(graphFile(graph), path.join(to, 'db.sqlite'));
  fs.writeFileSync(path.join(home, '.logseq', 'settings', ID + '.json'), JSON.stringify(settings));
  const log = fs.openSync(path.join(dir, 'logseq.log'), 'a');
  /* Colours are drawn in sRGB whatever the Mac's display is (23 November 2026). Logseq writes its yellow (the Doing circle, an
     overdue Deadline) as a colour outside sRGB, and a picture followed the display of the moment: the same plugin came out with
     that yellow as 228,190,64 on a wide-colour display and 235,188,0 on a plain one, and the display changes when a screen-sharing
     session comes or goes. */
  const child = spawn(APP, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-mock-keychain', COLOUR],
    { detached: true, stdio: ['ignore', log, log], env: { ...process.env, HOME: home, CFFIXED_USER_HOME: home } });
  child.unref();
  // From here a Logseq of ours is running: whatever goes wrong, it is ended before the fault is said, so its port is free again.
  let browser = null;
  try {
    // Once it has answered it is up: a second ask could time out while several Logseqs start at once, and a Logseq that had started was given up on.
    let answered = false;
    for (let i = 0; i < 80 && !(answered = !!(await up(port))); i++) await sleep(500);
    if (!answered) throw new Error(`the test Logseq did not answer on ${port}; see ${path.join(dir, 'logseq.log')}`);
    const { chromium } = require('playwright');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 10000 });
    let page = null;
    for (let i = 0; i < 60 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url())); if (!page) await sleep(500); }
    if (!page) throw new Error('the test Logseq has no window');
    // The graph is open when Logseq answers a read about it.
    let g = null;
    for (let i = 0; i < 60 && !g; i++) { g = await page.evaluate(async () => { try { const g = await window.logseq.api.get_current_graph(); return g && g.path ? g : null; } catch (e) { return null; } }).catch(() => null); if (!g) await sleep(500); }
    if (!g || !String(g.path).startsWith(home)) throw new Error(`the test Logseq opened ${g ? g.path : 'no graph'}, not its copy`);
    const said = await page.evaluate(async url => { try { await window.LSPluginCore.register({ url }, true); return ''; } catch (e) { return String(e && e.message || e); } }, plugin);
    if (said) throw new Error('the plugin did not load: ' + said);
    const frame = () => page.frames().find(f => f.url().includes(ID));
    let parts = null;
    for (let i = 0; i < 60 && !parts; i++) { parts = await frame()?.evaluate(() => (window.PluginDoor?.started?.length ? window.PluginDoor.started.map(m => m.key) : null)).catch(() => null); if (!parts) await sleep(500); }
    if (!parts) throw new Error('the plugin loaded but none of its parts started');
    await sleep(2500);
    return { dir, home, graph, browser, page, frame, parts, pid: child.pid, port };
  } catch (error) {
    await stop({ browser, port, home, pid: child.pid });
    throw error;
  }
}

async function stop(box) {
  const port = box.port;
  // Asked to close as its own Quit would. Not awaited: the answer never comes once the window is gone, and a promise left waiting would end the caller's own process.
  let asked = false;
  try { const s = await box.browser.newBrowserCDPSession(); s.send('Browser.close').catch(() => {}); asked = true; } catch (e) { /* ended below */ }
  if (asked) { await sleep(1500); for (let i = 0; i < 20 && (await up(port)); i++) await sleep(400); }
  // One that could not be asked, or did not go, is ended: only a Logseq started with this debugging port and a profile folder of its own.
  if (await up(port)) { try { execFileSync('pkill', ['-9', '-f', `remote-debugging-port=${port} --user-data-dir=`]); } catch (e) { /* none */ } await sleep(1000); }
  if (!asked && box.pid) { try { process.kill(box.pid, 'SIGKILL'); } catch (e) { /* gone */ } }   // one that never came to answer on its port
  // Logseq's graph workers outlive the window and keep the copy locked: end only the ones whose folder is this run's home.
  if (box && box.home) endWorkers(box.home);
}
/* Logseq's graph worker (db-worker-node.js) is a process of its own, named by the folder of the graph it holds (--root-dir). It
   outlives its window and keeps the graph's copy locked, so the next Logseq started on that folder opens no graph (three checks
   in a row on 22 November 2026, each time until the worker was ended by hand). Ended here are only workers whose folder lies
   under `under`, the home folder of the test Logseq being stopped: never the owner's Logseq's. Gives back how many it ended. */
function endWorkers(under) {
  let ended = 0;
  if (!under) return ended;
  try {
    for (const line of execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n')) {
      const m = line.match(/^\s*(\d+) .*db-worker-node\.js .*--root-dir (\S+)/);
      if (m && m[2].startsWith(under)) { try { process.kill(Number(m[1]), 'SIGKILL'); ended += 1; } catch (e) { /* gone */ } }
    }
  } catch (e) { /* no ps */ }
  return ended;
}

module.exports = { graphFile, start, stop, endWorkers, up, sleep };
