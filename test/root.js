/* node test/root.js   (needs jsdom: NODE_PATH, see README)
   main.js and what stands whichever modules run, against a stand-in Logseq: the clean-up and the ways in come before the first
   start; a module that fails or never answers is said and the next starts; every module that began is stopped; a file that did
   not load is said; the shared names reach Logseq with Look switched off; a scrolled frame goes back; and each module's icons,
   marks and Undo arrow come from the one place on the door. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const realTimeout = setTimeout;

async function run({ settings = {}, modules, before } = {}) {
  const dom = new JSDOM('<html><head></head><body><div id="outer" style="overflow:hidden"><div id="main-content-container"></div></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
  const win = dom.window, doc = win.document;
  const events = [], notes = [], styles = {};
  let unload = null, ready = null;
  const logseq = {
    settings, baseInfo: { id: 'logseq-plugin' }, useSettingsSchema() {}, ready: fn => { ready = fn; return Promise.resolve(); },
    beforeunload: fn => { events.push('clean-up registered'); unload = fn; }, onSettingsChanged() {}, provideStyle: o => { styles[o.key] = o.style; },
    UI: { showMsg: (text, level) => notes.push([text, level]) }, DB: { datascriptQuery: async () => [] },
  };
  const plugin = { parent: win, console: { error() {}, log() {} }, setTimeout: (fn, ms) => realTimeout(fn, ms > 1000 ? 30 : ms), clearTimeout, addEventListener: (type, fn) => { if (type === 'error') plugin.errorFn = fn; }, removeEventListener: (type, fn) => { if (plugin.errorFn === fn) plugin.errorFn = null; } };
  plugin.window = plugin;
  const context = vm.createContext({ window: plugin, parent: win, logseq, console: plugin.console, setTimeout: plugin.setTimeout, clearTimeout, Promise, navigator: { platform: 'Mac' } });
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  load('plugin.js');
  const Door = plugin.PluginDoor;
  Door.settings = { current: null };
  Door.settingsWays = { start() { events.push('ways in'); }, reopen() { events.push('reopen'); }, stop() { events.push('ways out'); } };
  for (const one of modules(events)) Door.register(one);
  load('files.js');
  before?.(plugin);
  load('main.js');
  ready();
  return { win, doc, events, notes, styles, Door, unload: () => unload(), plugin, ready };
}
const part = (key, start, stop) => ({ key, title: key, start, stop });
(async () => {
  // Update plugins: every other plugin switched on reloads, one switched off stays off, this plugin reloads last.
  {
    const reloaded = [], palette = {};
    const r = await run({ modules: () => [], before: plugin => {
      plugin.parent.LSPluginCore = { registeredPlugins: new Map([['logseq-plugin', { id: 'logseq-plugin', loaded: true }], ['quiet', { id: 'quiet', loaded: false }], ['other', { id: 'other', loaded: true }]]), reload: async id => { reloaded.push(id); } };
    } });
    await sleep(20);
    assert.ok(r.Door.updatePlugins, 'the command is on the door');
    await r.Door.updatePlugins(); await sleep(20);
    assert.deepEqual(reloaded, ['other', 'logseq-plugin'], 'the others first, the one switched off left, this plugin last');
    assert.equal(r.win.sessionStorage.getItem('logseq-plugin-updated'), '0', 'it leaves a note for the plugin once reloaded, which says it is done');
  }
  // A start that never answers: the clean-up and the ways in stand before it, it is said, the next module starts.
  let r = await run({ modules: ev => [part('hangs', () => { ev.push('hangs starts'); return new Promise(() => {}); }, () => ev.push('hangs stops')), part('next', () => { ev.push('next starts'); }, () => ev.push('next stops'))] });
  await sleep(120);
  assert.ok(r.events.includes('clean-up registered') && r.events.indexOf('clean-up registered') < r.events.indexOf('hangs starts'), 'the clean-up before the first start');
  assert.ok(r.events.includes('ways in') && r.events.indexOf('ways in') < r.events.indexOf('hangs starts'), 'the ways in before the first start');
  assert.ok(r.events.includes('next starts'), 'the next module starts'); assert.ok(r.events.includes('reopen'), 'the window comes back');
  assert.ok(r.notes.some(([t]) => /hangs has not finished starting/.test(t)), 'the one that hangs is said');
  // Stopped, whether or not it finished, in reverse; one that fails partway too.
  await r.unload();
  assert.deepEqual(r.events.filter(e => /stops/.test(e)), ['next stops', 'hangs stops'], 'every module that began is stopped');
  r = await run({ modules: ev => [part('fails', () => { ev.push('fails starts'); throw new Error('boom'); }, () => ev.push('fails stops')), part('runs', () => {}, () => ev.push('runs stops'))] });
  await sleep(40);
  assert.ok(r.notes.some(([t]) => t === 'fails could not start: boom'), 'a failure is said');
  assert.deepEqual([...r.Door.started].map(m => m.key), ['runs'], 'only what finished counts as running');
  await r.unload();
  assert.deepEqual(r.events.filter(e => /stops/.test(e)), ['runs stops', 'fails stops'], 'the one that failed partway is stopped too');
  // A file that did not load is said; one module switched off stays off, and its stop is not run.
  r = await run({ settings: { lookOn: false }, modules: ev => [part('look', () => ev.push('look starts'), () => ev.push('look stops')), part('runs', () => {})],
    before: plugin => { plugin.PluginFiles = ['plugin.js', 'look/main.js', 'main.js']; plugin.errorFn({ target: { src: 'lsp://x/look/main.js?t=1' } }); plugin.errorFn({ target: {}, filename: 'lsp://x/look/main.js?t=1' }); plugin.errorFn({ target: {}, filename: 'lsp://elsewhere/other.js' }); } });
  await sleep(40);
  assert.deepEqual(r.notes.filter(([t]) => /did not load/.test(t)).length, 1, 'said once');
  assert.ok(r.notes.some(([t]) => t.includes('look/main.js did not load')), 'the file is named');
  assert.equal(r.plugin.errorFn, null, 'the watch ends once the start has begun');
  assert.ok(!r.events.includes('look starts'), 'a module switched off does not start');
  await r.unload(); assert.ok(!r.events.includes('look stops'), 'and is not stopped');
  // With Look off the shared names still reach Logseq.
  for (const name of ['--lk-quiet', '.lk-count', '.lk-list .lk-tick', '.lk-pencil', '.lk-row .lk-fold', '.lk-day']) assert.ok(r.styles['plugin-names'].includes(name), name + ' stands with Look off');
  // The frame goes back when scrolled, with no module asked; a view that scrolls is left; the guard goes with the plugin.
  r = await run({ settings: { threadsOn: false }, modules: () => [] });
  await sleep(10);
  const outer = r.doc.getElementById('outer'), view = r.doc.getElementById('main-content-container');
  const scrolled = el => { el.scrollTop = 40; el.dispatchEvent(new r.win.Event('scroll')); };
  scrolled(outer); assert.equal(outer.scrollTop, 0, 'the frame goes back, with no module running');
  scrolled(view); assert.equal(view.scrollTop, 40, 'a view keeps its place');
  await r.unload(); scrolled(outer); assert.equal(outer.scrollTop, 40, 'the guard goes with the plugin');
  // One place for the shapes: no module keeps a drawing of its own.
  const code = file => fs.readFileSync(path.join(root, file), 'utf8');
  const files = code('files.js').match(/'([a-z/-]+\.js)'/g).map(s => s.slice(1, -1)).filter(file => file !== 'plugin.js');
  for (const file of files) {
    assert.ok(!/M6 2\.6 2\.4 9\.2/.test(code(file)), file + ' keeps no copy of the web');
    assert.ok(!/M2 1\.8H8V8\.2H2/.test(code(file)), file + ' keeps no copy of a mark');
    assert.ok(!/arrow-back-up|↶/.test(code(file)), file + ' keeps no Undo arrow of its own');
    assert.ok(!/currentColor 46%/.test(code(file)), file + ' keeps no copy of the greys');
  }
  // What the plugin writes is listed where its README says, the Recycle list and Predictive's three among it.
  const readme = file => code(file).replace(/\s+/g, ' ');
  assert.ok(/Recycle list/.test(readme('README.md')), 'the root README lists the Recycle list');
  assert.ok(/Recycle list[^.]*restores a page, or deletes it for good/.test(readme('threads/README.md')) && !/Every write goes through `parts\/model\.js`\./.test(readme('threads/README.md')), 'Threads’ README says the Recycle list writes, outside the model');
  for (const words of ['parent bullet', 'given that tag', 'leaves the page, empty']) assert.ok(readme('predictive/README.md').includes(words), 'Predictive’s README says ' + words);
  assert.ok(!/no plugin can replace/.test(readme('look/README.md')), 'Look’s README no longer says the gear cannot be replaced');
  // One row for empty properties, one faint: Predictive hides, the faint is Look's alone.
  assert.ok(!/opacity: \.45/.test(code('predictive/logseq/propose-ui.js')), 'no second faint for an empty property');
  assert.ok(/html\.flow-hide-empty \.ls-block[^{]*:has\(\.empty-value\)[^{]*\{ display: none/.test(code('predictive/logseq/propose-ui.js')) && /:has\(\.empty-value\):not\(:focus-within\) \{ opacity: \.5; \}/.test(code('look/logseq/style.js')), 'hidden by the one row, faint by Look');
  // One drawing of a property's icon, one engine and one set of rules: Threads' copies are gone (5 November 2026), the tooltip is Look's.
  assert.ok(!files.includes('threads/parts/property-kinds.js') && !files.includes('threads/parts/alike.js') && !files.includes('threads/parts/shadow-rules.js')
    && !/function (?:tokensOf|buildIndex|neighbours|vote|propose|guessesFor|piecesFor|daysInWords)\b/.test(code('threads/parts/proposals.js')), 'Threads keeps no second icon, engine or rules');
  assert.ok(/propertyNameTips/.test(code('look/logseq/props.js')), 'the tooltip is Look’s');
  // Logseq's help button stands over the corner at the foot of a card: what is written there scrolls clear of it.
  assert.ok(/\.st-right \{[^}]*padding: 0 22px 56px/.test(code('structure/logseq/view.js')), 'a card’s foot clears Logseq’s help button');
  console.log('ok: the start, the stop, a file not loaded, the names, the frame, one place for the shapes');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
