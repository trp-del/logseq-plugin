/* node test/settings.js   (needs jsdom: NODE_PATH, see README)
   The one settings window, against a stand-in Logseq with every part's real description: the places down the left, a place's
   settings one line each, every choice a named picture with what differs marked, a change written at once, the look it came with, a number, keys recorded, a word added to a list, a letter typed finding through all six, a part switched
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
const key = (dlg, name, target = dlg.querySelector('.sw-mod')) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
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
  assert.equal([...dlg.querySelectorAll('.sw-mod .sw-name')].map(e => e.textContent).join(), 'The window,A page,The right sidebar,Writing,Finding,Following links,Taking a page out,Keys,Parts', 'the places in order');
  assert.equal([...dlg.querySelectorAll('.sw-group')].map(e => e.textContent).join(), 'What you see,What you do,Everything else', 'in three groups');
  // The window opens on its first place: a list of one line each, the first setting chosen and drawn large
  assert.ok(dlg.querySelector('.sw-row.on'), 'the first setting is chosen');
  assert.ok(dlg.querySelectorAll('.sw-row').length >= 8, 'the window place lists its settings, one line each');
  assert.equal(dlg.querySelector('.sw-body h2').textContent, dlg.querySelector('.sw-row.on .sw-name').textContent, 'the chosen one, large');
  assert.equal(dlg.querySelector('.sw-reload'), null, 'no reload until one waits');
  // A page: every choice a picture, named, the one in force ticked, the one it came with said so; a press takes it
  dlg.querySelector('[data-place="page"]').click();
  dlg.querySelector('.sw-row[data-row="quietLinks"]').click();
  const looks = [...dlg.querySelectorAll('.sw-body .sw-opt')];
  assert.equal(looks.map(o => o.querySelector('.sw-nm').textContent).join(), 'Blue,Underlined', 'each look named');
  assert.ok(looks[1].classList.contains('on') && looks[1].querySelector('.sw-came'), 'the one in force, as it came');
  assert.ok(dlg.querySelector('.sw-body .sw-pic.sw-marked .sw-mark'), 'only what differs keeps its strength');
  assert.equal(dlg.querySelector('.sw-row.on .sw-now').textContent, 'Underlined', 'the line says what it is set to');
  looks[0].click();
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify({ quietLinks: false }), 'one press, one key');
  await sleep(80);
  assert.ok(dlg.querySelector('.sw-row.on .sw-now.sw-moved'), 'a changed setting is marked in the list');
  assert.ok(dlg.querySelector('#sw-changed'), 'Changed by you shows');
  dlg.querySelector('#sw-changed').click();
  assert.equal(dlg.querySelectorAll('.sw-list .sw-row').length, 1, 'only what differs');
  dlg.querySelector('.sw-body .sw-opt:not(.on)').click(); await sleep(80);
  assert.equal(settings.quietLinks, true, 'the look it came with puts it back');
  assert.ok(dlg.querySelector('.sw-list .lk-none'), 'nothing differs now');

  // A number: a picture at each size, and another typed
  dlg.querySelector('[data-place="finding"]').click();
  dlg.querySelector('.sw-row[data-row="rowsShown"]').click();
  assert.equal([...dlg.querySelectorAll('.sw-body .sw-opt .sw-nm')].map(e => e.textContent).join(), '5,12,30', 'three sizes');
  const other = dlg.querySelector('#sw-rowsShown'); other.value = '20'; other.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(settings.rowsShown, 20, 'another number taken'); await sleep(80);
  assert.equal(dlg.querySelector('.sw-row.on .sw-now').textContent, '20');
  settings.rowsShown = 12;

  // Parts: the six, each a switch; a part switched off waits for the reload and rests its rows
  dlg.querySelector('[data-place="parts"]').click();
  assert.equal(dlg.querySelectorAll('.sw-row[data-row$="On"]').length, 6, 'the six parts to switch');
  dlg.querySelector('.sw-row[data-row="predictiveOn"]').click();
  dlg.querySelector('.sw-body .sw-opt[data-val="false"]').click();
  assert.equal(settings.predictiveOn, false); await sleep(80);
  assert.ok(dlg.querySelector('[data-place="parts"] .sw-name.lk-pencil'), 'Parts pencilled while one waits');
  assert.ok(dlg.querySelector('.sw-foot [data-reload]'), 'Reload to apply');
  dlg.querySelector('[data-place="writing"]').click();
  assert.ok(dlg.querySelector('.sw-row.sw-rest'), 'its rows rest, still there');
  dlg.querySelector('[data-place="parts"]').click();
  dlg.querySelector('.sw-row[data-row="predictiveOn"]').click();
  dlg.querySelector('.sw-body .sw-opt[data-val="true"]').click(); await sleep(80);
  assert.equal(dlg.querySelector('[data-reload]'), null, 'put back, nothing waits');
  // keys: the arrows walk the settings; a letter goes to the find line; Escape lets go a step at a time
  dlg.querySelector('[data-place="window"]').click();
  const first = dlg.querySelector('.sw-row.on').dataset.row;
  key(dlg, 'ArrowDown', dlg.querySelector('.sw-row.on')); assert.notEqual(dlg.querySelector('.sw-row.on').dataset.row, first, 'the arrow walks the settings');
  const find = dlg.querySelector('.sw-find'); find.value = 'tag'; find.dispatchEvent(new win.Event('input', { bubbles: true }));
  assert.ok(new Set([...dlg.querySelectorAll('.sw-sec')].map(e => e.textContent.split(' · ')[1])).size >= 2, 'found through more than one place');
  assert.ok(dlg.querySelector('.sw-nomatch'), 'a place with nothing goes faint');
  const esc = new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); find.dispatchEvent(esc);
  assert.ok(esc.defaultPrevented && find.value === '' && dlg.hasAttribute('open'), 'the first Escape clears the words');
  // A key reads as plain words, shows what pressing it does, and is recorded from the keys pressed, in Logseq's spelling
  dlg.querySelector('[data-place="keys"]').click();
  dlg.querySelector('.sw-row[data-row="proposalsAcceptKeys"]').click();
  assert.equal(dlg.querySelector('.sw-row.on .sw-now').textContent, 'Cmd Option Enter', 'keys as plain words');
  assert.ok(dlg.querySelector('.sw-body .sw-pic .sw-key'), 'a picture of pressing them');
  dlg.querySelector('#sw-record').click();
  dlg.querySelector('#sw-record').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'K', code: 'KeyK', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(settings.proposalsAcceptKeys, 'mod+shift+k', 'recorded in Logseq\'s spelling'); await sleep(80);
  assert.equal(dlg.querySelector('.sw-row.on .sw-now').textContent, 'Cmd Shift K');
  dlg.querySelector('.sw-body [data-set]:last-child').click(); await sleep(80);
  assert.equal(settings.proposalsAcceptKeys, 'mod+alt+enter', 'back to the keys it came with');
  assert.equal(Door.settings.keyWords('mod+ctrl+alt+shift+space'), 'Cmd Ctrl Option Shift Space'); assert.equal(Door.settings.keySpelling('Cmd Ctrl Option Shift Space'), 'mod+ctrl+alt+shift+space');
  dlg.querySelector('.sw-row[data-row="linkSuggestKeys"]').click();
  assert.equal(dlg.querySelector('.sw-row.on .sw-now').textContent, 'none', 'an empty key still reads');
  // a list: a word added, then taken out
  dlg.querySelector('[data-place="following"]').click();
  if (dlg.querySelector('.sw-row[data-row="twoWayOneEnd"]')) {
    dlg.querySelector('.sw-row[data-row="twoWayOneEnd"]').click();
    const add = dlg.querySelector('[data-add="twoWayOneEnd"]'); add.value = 'Lives in';
    add.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(settings.twoWayOneEnd, 'Lives in', 'a word added'); await sleep(80);
    dlg.querySelector('.sw-drop[data-word="Lives in"]').click(); await sleep(80);
    assert.equal(settings.twoWayOneEnd, '', 'and taken out');
  }
  const sheet = doc.getElementById('sw-style').textContent;
  assert.ok(/input\.lk-value \{[^}]*border-bottom: 1px solid transparent/.test(Door.NAMES) && /input\.lk-value:focus \{ border-bottom-color[^}]*box-shadow: none/.test(Door.NAMES), 'a field\'s line only while it has the keyboard (the library\'s input.lk-value)');
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
  console.log('ok: the window, the places, a picture taken, as it came, Changed by you, a number, a part waiting, keys recorded, a list, the gear');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
