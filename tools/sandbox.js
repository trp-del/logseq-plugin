/* The guard's own Logseq (18 November 2026). A second Logseq on this Mac with its own home folder, profile and debugging port, on
   throwaway copies of the test graphs, so the guard can look at the plugin as it ships and never touches the owner's window,
   graphs, settings or plugin folder. One graph per start: Logseq opens the one graph it finds in its home.

     const box = await sandbox.start({ dir, graph: 'Illness Test Graph', plugin: '/abs/plugin/folder' })
     … box.page, box.frame() …
     await sandbox.stop(box)

   Ports from GUARD_PORT, 9340 by default: one for each test graph (9340, 9341), then one for each further Logseq a side shares its
   work among (9342 to 9347; guard.js); the owner's Logseq keeps 9222,
   the audit 9333, other threads 9334–9336, 9444, 9555–9556.
   Graph copies come from GUARD_GRAPHS (folders of graphs, colon-separated), else ~/logseq-test-graphs/graphs and ~/logseq/graphs,
   newest backup first, which Logseq writes whole and never holds locked. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const COLOUR = '--force-color-profile=srgb';
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
  // The window is narrow-read as the owner's.
  fs.writeFileSync(path.join(home, '.logseq', 'settings', ID + '.json'), JSON.stringify(settings));
  const log = fs.openSync(path.join(dir, 'logseq.log'), 'a');
  /* Colours are drawn in sRGB whatever the Mac's display is (23 November 2026). Logseq writes its yellow (the Doing circle, an
     overdue Deadline) as a colour outside sRGB, and a picture followed the display of the moment: the same plugin came out with
     that yellow as 228,190,64 on a wide-colour display and 235,188,0 on a plain one, and the display changes when a screen-sharing
     session comes or goes. Two screens then "changed" in every run. */
  const child = spawn(APP, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-mock-keychain', COLOUR],
    { detached: true, stdio: ['ignore', log, log], env: { ...process.env, HOME: home, CFFIXED_USER_HOME: home } });
  child.unref();
  // Once it has answered it is up: a second ask could time out while four Logseqs start at once, and a Logseq that had started was given up on.
  let answered = false;
  for (let i = 0; i < 80 && !(answered = !!(await up(port))); i++) await sleep(500);
  if (!answered) throw new Error(`the guard's Logseq did not answer on ${port}; see ${path.join(dir, 'logseq.log')}`);
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
  if (box && box.home) endWorkers(box.home);
}
/* Logseq's graph worker (db-worker-node.js) is a process of its own, named by the folder of the graph it holds (--root-dir). It
   outlives its window and keeps the graph's copy locked, so the next Logseq started on that folder opens no graph ("the guard's
   Logseq opened no graph, not its copy": three checks in a row on 22 November 2026, each time until the worker was ended by
   hand). Ended here are only workers whose folder lies under `under`, one of the guard's own folders: never the owner's Logseq's,
   never a hand test's. Gives back how many it ended. */
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

/* One Logseq kept running between checks (19 November 2026, the owner: three minutes a check "was the exact problem"). Starting
   Logseq and opening a graph is the slowest step of a check, so the first check starts it and the next ones find it running: the
   plugin's files are copied into its plugin folder and the plugin is reloaded there, a few seconds. It keeps its own home, profile
   and port like any sandbox, and a small watcher ends it once no check has used it for twenty minutes. A new copy of the test
   graph, or a Logseq that no longer answers, starts it afresh. */
const slug = s => s.replace(/\W+/g, '-').toLowerCase();
const graphHash = graph => require('node:crypto').createHash('sha256').update(fs.readFileSync(graphFile(graph))).digest('hex').slice(0, 16);
function copyPlugin(from, to) { fs.mkdirSync(to, { recursive: true }); execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', from.replace(/\/?$/, '/'), to + '/']); }
async function started(page) {
  const frame = () => page.frames().find(f => f.url().includes(ID));
  let parts = null;
  for (let i = 0; i < 80 && !parts; i++) { parts = await frame()?.evaluate(() => (!window.__guardOld && window.PluginDoor?.started?.length ? window.PluginDoor.started.map(m => m.key) : null)).catch(() => null); if (!parts) await sleep(250); }
  if (!parts) throw new Error('the plugin loaded but none of its parts started');
  return { frame, parts };
}
async function warm({ store, graph, plugin, port = PORT, index = 0 }) {
  // A graph may have several Logseqs at once (guard.js shares the screens and cases out): each its own folder and port.
  const dir = path.join(store, 'warm', slug(graph) + (index ? '-' + (index + 1) : '')), own = path.join(dir, 'plugin'), meta = path.join(dir, 'meta.json'), stamp = path.join(dir, 'used');
  const want = graphHash(graph);
  let had = null; try { had = JSON.parse(fs.readFileSync(meta, 'utf8')); } catch (e) { /* first time */ }
  copyPlugin(plugin, own);
  fs.writeFileSync(stamp, String(Date.now()));
  if (had && had.graph === want && had.port === port && had.colour === COLOUR && (await up(port))) {   // one started before the colours were fixed is started afresh
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8000 });
      const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
      if (!page) throw new Error('no window');
      // The plugin as it now stands in the folder: Logseq's own reload, the frame's files read afresh.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.clearBrowserCache').catch(() => {});
      await page.frames().find(f => f.url().includes(ID))?.evaluate(() => { window.__guardOld = true; }).catch(() => {});
      await page.evaluate(id => window.LSPluginCore.reload(id), ID);
      await sleep(600);
      const { frame, parts } = await started(page);
      await sleep(1200);
      return { dir, home: had.home, graph, browser, page, frame, parts, port, warm: true, cdp };
    } catch (e) { console.log(`the running test Logseq on ${port} did not take the plugin (${String(e && e.message || e).slice(0, 80)}): starting it afresh`); }
  }
  if (await up(port)) await stop({ port, home: had && had.home, browser: { newBrowserCDPSession: async () => { throw new Error('none'); } } });
  /* A Logseq this folder started earlier on another port (24 November 2026: the plan of who takes which port changed between two
     checks, the folder was emptied under a Logseq still running in it, and the check stopped): ended by its own profile folder. */
  try { execFileSync('pkill', ['-9', '-f', '--', `--user-data-dir=${path.join(dir, 'profile')}`], { stdio: 'ignore' }); await sleep(800); } catch (e) { /* none ran */ }
  // A worker left by a Logseq that is gone (its window closed, the check stopped halfway) still holds this folder: ended before the folder is made anew.
  if (endWorkers(path.join(dir, 'home'))) await sleep(500);
  for (const f of ['home', 'profile']) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  const box = await start({ dir, graph, plugin: own, port });
  fs.writeFileSync(meta, JSON.stringify({ graph: want, port, home: box.home, pid: box.pid, colour: COLOUR }));
  // The watcher: ends this Logseq and its graph workers after twenty minutes with no check.
  const watcher = `const fs=require('fs'),{execFileSync}=require('child_process');setInterval(()=>{let used=0;try{used=Number(fs.readFileSync(${JSON.stringify(stamp)},'utf8'))}catch(e){}if(Date.now()-used<20*60*1000)return;try{execFileSync('pkill',['-9','-f','remote-debugging-port=${port} --user-data-dir='])}catch(e){}try{for(const l of execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\\n')){const m=l.match(/^\\s*(\\d+) .*db-worker-node\\.js .*--root-dir (\\S+)/);if(m&&m[2].startsWith(${JSON.stringify(box.home)}))try{process.kill(Number(m[1]),'SIGKILL')}catch(e){}}}catch(e){}process.exit(0)},60000)`;
  spawn(process.execPath, ['-e', watcher], { detached: true, stdio: 'ignore' }).unref();
  return { ...box, warm: true };
}
// Lets go of a running Logseq without ending it.
async function leave(box) { fs.writeFileSync(path.join(box.dir, 'used'), String(Date.now())); try { await box.browser.close(); } catch (e) { /* gone */ } }

// For `guard.js stop`: whatever answers on the guard's port, and only that.
async function stopAny(store) {
  const said = [];
  // The guard's ports: one for each test graph, then the further Logseqs a side shares its work among (eight at most).
  for (const port of Array.from({ length: 8 }, (_, i) => PORT + i)) {
    if (!(await up(port))) { if (port < PORT + 2) said.push('nothing ran on ' + port); continue; }
    const { chromium } = require('playwright');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8000 }).catch(() => null);
    await stop({ port, browser: browser || { newBrowserCDPSession: async () => { throw new Error('no'); } } });
    said.push((await up(port)) ? 'still answering on ' + port : 'stopped on ' + port);
  }
  // And the graph workers those Logseqs left, whether or not a window still answered: only the ones in the guard's own folder.
  const ended = store ? endWorkers(path.join(store, 'warm') + path.sep) + endWorkers(path.join(store, 'runs') + path.sep) + endWorkers(path.join(store, 'kept') + path.sep) : 0;
  if (ended) said.push(`ended ${ended} graph worker${ended > 1 ? 's' : ''} left behind`);
  return said.join('; ');
}

module.exports = { PORT, graphFile, start, stop, stopAny, endWorkers, up, sleep, warm, leave };
