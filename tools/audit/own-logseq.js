#!/usr/bin/env node
/* A Logseq of the checks' own (16 November 2026, goalpost line 7.7): a second Logseq on this Mac with its own home folder, its
   own profile and its own debugging port, so a check can try even the deletes on a throwaway copy of a test graph and never
   touches the owner's window, graphs, settings or plugin folder.
     node own-logseq.js start <dir>     start it (home and profile under <dir>), wait for the port
     node own-logseq.js info            what runs there: Logseq's version, the open graph, the plugins
     node own-logseq.js stop <dir>      quit the Logseq started from <dir> (on the port written there), and its graph workers
   Needs Playwright on NODE_PATH. The port is LOGSEQ_PORT (default 9555); never the owner's Logseq's port. */
const { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const PORT = Number(process.env.LOGSEQ_PORT || 9555), APP = '/Applications/Logseq.app/Contents/MacOS/Logseq';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(resolve => { const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/version', timeout: 1500 }, res => { let body = ''; res.on('data', d => body += d); res.on('end', () => resolve(body)); }); req.on('error', () => resolve('')); req.on('timeout', () => { req.destroy(); resolve(''); }); });
async function connect() {
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 8000 });
  const pages = browser.contexts().flatMap(c => c.pages());
  return { browser, pages, page: pages.find(p => /index\.html/.test(p.url())) || pages[0] };
}
(async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'start') {
    if (!dir) throw new Error('start needs a folder');
    if (await up()) { console.log('already up on ' + PORT); return; }
    const home = path.join(dir, 'home'), profile = path.join(dir, 'profile');
    for (const d of [home, profile]) fs.mkdirSync(d, { recursive: true });
    const log = fs.openSync(path.join(dir, 'logseq.log'), 'a');
    const child = spawn(APP, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--use-mock-keychain'], { detached: true, stdio: ['ignore', log, log], env: { ...process.env, HOME: home, CFFIXED_USER_HOME: home } });
    child.unref();
    fs.writeFileSync(path.join(dir, 'pid'), String(child.pid)); fs.writeFileSync(path.join(dir, 'port'), String(PORT));
    fs.writeFileSync(path.join(require('node:os').tmpdir(), `own-logseq-${PORT}.dir`), path.resolve(dir));
    for (let i = 0; i < 60; i++) { if (await up()) { console.log('up on ' + PORT + ', pid ' + child.pid); return; } await sleep(500); }
    throw new Error('it did not answer on ' + PORT + ' within 30 s; see logseq.log');
  }
  if (cmd === 'info') {
    const said = await up(); if (!said) { console.log('not running'); return; }
    console.log(JSON.parse(said)['User-Agent']);
    const { browser, pages, page } = await connect();
    console.log('pages:', pages.map(p => p.url()).join(' | '));
    if (page) console.log(JSON.stringify(await page.evaluate(async () => {
      const out = { title: document.title, hash: location.hash };
      try { out.graph = (await window.logseq.api.get_current_graph())?.name || null; } catch (e) { out.graph = 'error: ' + e.message; }
      try { const map = window.LSPluginCore?.registeredPlugins; out.plugins = map ? [...(map.keys ? map.keys() : Object.keys(map))] : null; } catch (e) { out.plugins = 'error: ' + e.message; }
      out.text = document.body.innerText.slice(0, 400);
      return out;
    }), null, 1));
    await browser.close();
    return;
  }
  if (cmd === 'stop') {
    /* Stopped only by its own folder, and on the port written there at start (18 November 2026: a stop with no port given took the
       default and closed another run's Logseq). */
    if (!dir) throw new Error('stop needs the folder its Logseq was started from');
    const said = (() => { try { return Number(fs.readFileSync(path.join(dir, 'port'), 'utf8')); } catch (e) { return 0; } })();
    if (!said) throw new Error('no Logseq was started from ' + dir + ' (no port written there); nothing stopped');
    if (said !== PORT) { process.env.LOGSEQ_PORT = String(said); const r = require('node:child_process').spawnSync(process.execPath, [__filename, 'stop', dir], { env: process.env, stdio: 'inherit' }); process.exit(r.status || 0); }
    // Logseq's graph workers outlive a window that is ended by force and keep the graph locked; only the workers whose folder is a
    // home made for the checks (under this session's scratchpad or a proof run's folder) are ended, never the owner's.
    // Only the workers whose graph folder lies under the home of THIS run's folder (stop <dir>, or the folder written at start) are
    // ended, never the owner's or another thread's.
    const runDir = dir ? path.resolve(dir) : (() => { try { return fs.readFileSync(path.join(require('node:os').tmpdir(), `own-logseq-${PORT}.dir`), 'utf8').trim(); } catch (e) { return ''; } })();
    const ownWorker = line => { const m = line.match(/db-worker-node\.js .*--root-dir (\S+)/); return !!(m && runDir && path.resolve(m[1]).startsWith(path.join(runDir, 'home') + path.sep)); };
    const workersLeft = () => { try { return require('node:child_process').execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n').filter(ownWorker).length; } catch (e) { return 0; } };
    const endWorkers = () => { try { const out = require('node:child_process').execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }); for (const line of out.split('\n')) { const m = line.match(/^\s*(\d+) /); if (m && ownWorker(line)) { try { process.kill(Number(m[1])); setTimeout(() => { try { process.kill(Number(m[1]), 'SIGKILL'); } catch (e) { /* gone */ } }, 3000); } catch (e) { /* gone */ } } } } catch (e) { /* ps not there */ } };
    if (!(await up())) { endWorkers(); for (let i = 0; i < 20 && workersLeft(); i++) await sleep(500); console.log('not running'); return; }
    try { const { browser } = await connect(); const session = await browser.newBrowserCDPSession(); await session.send('Browser.close').catch(() => {}); } catch (e) { /* it does not answer: ended by force below */ }
    for (let i = 0; i < 20; i++) { if (!(await up())) { await sleep(800); endWorkers(); for (let i = 0; i < 20 && workersLeft(); i++) await sleep(500); console.log('stopped'); return; } await sleep(300); }
    // It can stand still on a window of the Mac's own (a print or save window): then it is ended by force. The port is only ever the
    // checks' own Logseq.
    try { require('node:child_process').execFileSync('pkill', ['-9', '-f', `remote-debugging-port=${PORT} --user-data-dir=`]); } catch (e) { /* none left */ }
    await sleep(1500);
    endWorkers();
    console.log(await up() ? 'still answering; stop it by its pid' : 'stopped by force');
    return;
  }
  console.log('start <dir> | info | stop');
})().catch(error => { console.error(String(error && error.message || error)); process.exit(1); });
