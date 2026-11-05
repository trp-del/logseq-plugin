/* node test/settings.js   (needs jsdom: NODE_PATH, see README)
   The one settings window, against a stand-in Logseq with every part's real description: the six down the left, a part's
   rows, a change written at once, default, a word added to a list, a letter typed finding through all six, a part switched
   off waiting for the reload, Escape letting go one step at a time, and the gear's Open settings taken for this plugin only, by its whole id. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const root = path.join(__dirname, '..');
const dom = new JSDOM('<html><head></head><body><div class="cp__plugins-item-card"><small>ID: logseq-plugin</small><div class="ctl"><ul class="menu-list"><li id="mine">Open settings</li></ul></div></div><div class="cp__plugins-item-card"><small>ID: logseq-plugin-another</small><div class="ctl"><ul class="menu-list"><li id="theirs">Open settings</li></ul></div></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const win = dom.window, doc = win.document;
win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
win.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new win.Event('close')); };
const settings = {}, written = [], palette = {};
const quiet = () => {};
const space = new Proxy({}, { get: (_, key) => key === 'registerCommandPalette' ? (o, run) => { palette[o.key] = run; } : (key === 'then' ? undefined : async () => null) });
const logseq = { settings, baseInfo: { id: 'logseq-plugin' }, updateSettings(values) { written.push(values); Object.assign(settings, values); }, showSettingsUI() { written.push('list'); }, provideStyle: quiet, provideModel: quiet, useSettingsSchema: quiet, ready: fn => Promise.resolve().then(fn), beforeunload(fn) { logseq._unload = fn; }, onSettingsChanged: quiet, App: space, Editor: space, DB: space, UI: space, Experiments: space };
const pluginWin = { document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: fn => setTimeout(fn, 0), navigator: { platform: 'Mac' }, location: { href: 'file:///plugin/index.html' } };
pluginWin.window = pluginWin; pluginWin.parent = { document: doc, defaultView: win };
const sandbox = vm.createContext({ window: pluginWin, parent: pluginWin.parent, logseq, document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: pluginWin.requestAnimationFrame, navigator: pluginWin.navigator, location: pluginWin.location, Date, Map, Set, URL, Promise, JSON, Math, Number, String, Array, Object, RegExp, encodeURIComponent, Intl });
const order = fs.readFileSync(path.join(root, 'files.js'), 'utf8').match(/'([a-z/-]+\.js)'/g).map(s => s.slice(1, -1));
const run = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
for (const file of order) if (file !== 'main.js') { try { run(file); } catch (error) { /* a part that needs the real page: its description is what counts here */ } }
const Door = pluginWin.PluginDoor;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (dlg, name, target = dlg.querySelector('.sw-tick')) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
(async () => {
  for (const part of ['look', 'find', 'predictive', 'structure', 'export']) assert.ok(Door.described[part], part + ' is described');
  Door.described.threads = Door.described.threads || { none: 'x' };
  Door.modules.length || assert.fail('no parts registered');
  Door.started = [...Door.modules];
  Door.settingsWays.start();
  assert.ok(palette['plugin-settings'], 'one command');
  assert.equal(Object.keys(palette).filter(k => /settings/.test(k)).join(), 'plugin-settings', 'no other settings command');
  const dlg = Door.settings.open();
  assert.ok(dlg.hasAttribute('open'), 'it opens');
  // Open troubleshooting stands only while Threads can open it
  const describedThreads = Door.described.threads;
  if (describedThreads.schema) {
    assert.ok(!describedThreads.schema.some(row => row.key === 'troubleshoot'), 'no Open troubleshooting while Threads is not running');
    (pluginWin.Threads ||= {}).core = { provided: { openTroubleshooting() {} } };
    assert.ok(describedThreads.schema.some(row => row.key === 'troubleshoot'), 'Open troubleshooting while Threads runs');
    delete pluginWin.Threads.core;
  }
  assert.equal([...dlg.querySelectorAll('.sw-mod .sw-name')].map(e => e.textContent).join(), 'Look,Find,Threads,Predictive,Structure,DB Export', 'the six in order');
  assert.equal(dlg.querySelectorAll('.sw-section').length, 8, 'Look’s eight sections');
  assert.equal(dlg.querySelectorAll('.sw-section > p, .sw-legend').length, 0, 'no paragraphs');
  assert.equal(dlg.querySelector('.sw-reload'), null, 'no reload until one waits');
  // a change is written at once, and the icon's row sets both keys
  const tick = dlg.querySelector('.sw-tick[data-key="propertyIcons"]'); tick.checked = false; tick.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify({ propertyIcons: false }), 'one row, one key');
  await sleep(80);
  assert.ok(dlg.querySelector('[data-reset="propertyIcons"]'), 'default shows on what differs');
  assert.ok(dlg.querySelector('#sw-changed'), 'Changed by you shows');
  dlg.querySelector('#sw-changed').click();
  assert.equal(dlg.querySelectorAll('.sw-body .sw-row').length, 1, 'only what differs');
  dlg.querySelector('[data-reset="propertyIcons"]').click(); await sleep(80);
  assert.equal(settings.propertyIcons, true, 'default puts it back');
  // a part's page: Structure has nothing to set
  dlg.querySelector('[data-part="structure"]').click();
  assert.equal(dlg.querySelector('.sw-none').textContent, 'Structure has nothing to set.');
  // switching a part off waits for the reload, and rests its rows
  dlg.querySelector('[data-part="predictive"]').click();
  const run1 = dlg.querySelector('#sw-run-predictive'); run1.checked = false; run1.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(settings.predictiveOn, false); await sleep(80);
  assert.ok(dlg.querySelector('[data-part="predictive"] .sw-name.lk-pencil'), 'pencilled while it waits');
  assert.ok(dlg.querySelector('#sw-reload'), 'Reload to apply');
  assert.ok(dlg.querySelector('.sw-body').classList.contains('sw-resting'), 'its rows rest, still there');
  const run2 = dlg.querySelector('#sw-run-predictive'); run2.checked = true; run2.dispatchEvent(new win.Event('change', { bubbles: true })); await sleep(80);
  assert.equal(dlg.querySelector('#sw-reload'), null, 'put back, nothing waits');
  // keys: the arrows walk the six; a letter goes to the find line; Escape lets go a step at a time
  dlg.querySelector('[data-part="look"]').click();
  key(dlg, 'ArrowDown'); assert.equal(dlg.querySelector('[aria-current="true"] .sw-name').textContent, 'Find', 'the arrow walks');
  const find = dlg.querySelector('.sw-find'); find.value = 'tag'; find.dispatchEvent(new win.Event('input', { bubbles: true }));
  assert.ok(dlg.querySelectorAll('.sw-part').length >= 2, 'found through more than one part');
  assert.ok(dlg.querySelector('.sw-nomatch'), 'a part with nothing goes faint');
  const esc = new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); find.dispatchEvent(esc);
  assert.ok(esc.defaultPrevented && find.value === '' && dlg.hasAttribute('open'), 'the first Escape clears the words');
  // A key reads as plain words and may be typed so; it is kept in Logseq's spelling. A field's line stands only with the keyboard.
  dlg.querySelector('[data-part="predictive"]').click();
  const keys = dlg.querySelector('#sw-proposalsAcceptKeys');
  assert.equal(keys.value, 'Cmd Option Enter', 'keys as plain words');
  keys.value = 'Cmd Shift K'; keys.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(settings.proposalsAcceptKeys, 'mod+shift+k', 'kept in Logseq\'s spelling');
  await sleep(80); assert.equal(dlg.querySelector('#sw-proposalsAcceptKeys').value, 'Cmd Shift K');
  const typed = dlg.querySelector('#sw-proposalsAcceptKeys'); typed.value = 'mod+alt+enter'; typed.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(settings.proposalsAcceptKeys, 'mod+alt+enter', 'Logseq\'s own spelling still taken');
  assert.equal(Door.settings.keyWords('mod+ctrl+alt+shift+space'), 'Cmd Ctrl Option Shift Space'); assert.equal(Door.settings.keySpelling('Cmd Ctrl Option Shift Space'), 'mod+ctrl+alt+shift+space');
  await sleep(80); assert.equal(dlg.querySelector('#sw-linkSuggestKeys').placeholder, 'none', 'an empty field still reads');
  const sheet = doc.getElementById('sw-style').textContent;
  assert.ok(/\.sw-field \{[^}]*border-bottom: 1px solid transparent/.test(sheet) && /\.sw-field:focus \{ border-bottom-color[^}]*box-shadow: none/.test(sheet), 'a field\'s line only while it has the keyboard');
  // Logseq's list stays a word away
  dlg.querySelector('#sw-plain').click();
  assert.equal(written.at(-1), 'list'); assert.equal(Door.settings.current, null, 'and the window closes');
  // the gear: this plugin's Open settings comes here, another's is left alone
  let reached = 0; doc.body.addEventListener('click', () => { reached++; });
  doc.getElementById('theirs').click(); assert.equal(reached, 1, 'another plugin’s gear untouched'); assert.equal(Door.settings.current, null);
  doc.getElementById('mine').click(); assert.equal(reached, 1, 'ours taken before Logseq sees it'); assert.ok(Door.settings.current, 'the window opens');
  Door.settingsWays.stop();
  assert.equal(doc.querySelector('.sw-dialog, #sw-style'), null, 'nothing left after the stop');
  doc.getElementById('mine').click(); assert.equal(reached, 2, 'after the stop the gear is Logseq’s again');
  console.log('ok: the window, a change, default, Changed by you, a part waiting, the keys, the gear');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
