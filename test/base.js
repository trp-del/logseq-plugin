/* node test/base.js   (needs jsdom: NODE_PATH, see README)
   The one base of a module (PluginDoor.base in plugin.js, 10 November 2026), checked as test/writes.js checks the one write path:
   a stylesheet, a setting's reader, a hook of Logseq's and a listener on Logseq's page go through a module's base, so each is
   taken off again when the module stops and none is built a second way. A stray anywhere in the running code fails this run and
   is named with its line. Then the base itself, against a pretend Logseq. */
const assert = require('node:assert/strict');
const { files, linesOf, strays, fail, doorWith, jsdom } = require('./ground.js');

// 1. A stylesheet is sent, or put into Logseq's page, by a base only.
let found = strays(/\bprovideStyle\b|createElement\(\s*['"]style['"]\s*\)/);
if (found.length) fail('a stylesheet that does not go through a base (base.style, base.sheet)', found);
// 2. A hook of Logseq's is handed to a base on the line that asks for it, so its "off" is called at stop.
found = strays(/^(?!.*\b(?:onStop|onUnload)\().*\blogseq\.(?:App\.|DB\.)?on(?:RouteChanged|Changed|CurrentGraphChanged|SettingsChanged)\b/);
if (found.length) fail('a hook of Logseq’s that no base takes off again (wrap it: onStop(logseq.App.onRouteChanged(...)))', found);
// 3. A setting is read through the base's reader: nobody compares a saved value's type with its default's for itself.
found = strays(/typeof \w+ === typeof \w+(?:\.default|Defaults\[)/, { allow: { 'settings/window.js': 1 /* the window shows a setting as saved, default or not, so it reads the item it draws */ } });
if (found.length) fail('a setting read with a rule of its own (use the base’s setting, or PluginDoor.settingReader)', found);
// 4. A listener set by hand on Logseq's window or page. The ones let be are counted, so a new one cannot come in unseen.
found = strays(/\b(?:win|doc|hostDoc|document)\.addEventListener\(|defaultView\.addEventListener\(|host\(\)\.addEventListener\(/, { allow: {
  'export/logseq/clipboard.js': 1,          // set and taken off inside one copy, in the same turn
  'threads/parts/shared.js': 3,             // the kit's own: the mouse buttons followed while Threads runs (its stop is a clean-up step), a pop-up waiting for the release
  'threads/parts/diagnostics.js': 3,        // the troubleshooting tools: a key for the length of a tour, two for the length of one check
} });
if (found.length) fail('a listener on Logseq’s window or page set by hand (use the base’s listen)', found);
// 4b. Threads' parts take their base from the door themselves: no forwarding kit in its shared file (10 November 2026).
found = strays(/\blifecycle\(/, { allow: {} });
if (found.length) fail('a base taken through a forwarding name (take PluginDoor.base)', found);
// 5. Every module has a base under its own key.
const MODULES = { look: 'look/logseq/kit.js', find: 'find/logseq/kit.js', predictive: 'predictive/logseq/app.js', structure: 'structure/logseq/db.js', export: 'export/logseq/db.js', threads: 'threads/main.js' };
for (const [key, file] of Object.entries(MODULES)) assert.ok(linesOf(file).some(line => new RegExp(`PluginDoor\\.base\\('${key}'`).test(line)), `${key} takes its base in ${file}`);
console.log(`  ok  in ${files.length} files every stylesheet, hook and setting goes through a base, and each module has one`);

(async () => {
  const win = jsdom(), doc = win.document, sent = [], warned = [];
  const settings = { size: 3, name: 7, gone: null, extra: 'kept' };
  const Door = doorWith({ settings, provideStyle: o => sent.push([o.key, o.style]), UI: { showMsg() {} } }, win, { console: { ...console, warn: (...a) => warned.push(a), error() {} } });
  const schema = [{ key: 'size', default: 1 }, { key: 'name', default: 'plain' }, { key: 'gone', default: true }, { key: 'heading', type: 'heading', default: null }];
  const base = Door.base('test', { prefix: 'Test: ', schema, stylePrefix: 't-', leaves: { elements: '.t-own', attributes: ['data-t'], reset: d => d.body.removeAttribute('data-reset') } });

  // A setting: the saved value, the default when it is missing or of another type, the saved value as is for a key the schema lacks.
  assert.equal(base.setting('size'), 3); assert.equal(base.setting('name'), 'plain', 'a number saved where words belong: the default');
  assert.equal(base.setting('gone'), true, 'nothing saved: the default'); assert.equal(base.setting('extra'), 'kept'); assert.equal(base.setting('never'), undefined);
  let list = [{ key: 'size', default: 1 }];
  const late = Door.settingReader(() => list); assert.equal(late('size'), 3); list = [{ key: 'name', default: 'x' }]; assert.equal(late('name'), 'x', 'a schema given late is read when asked');
  console.log('  ok  a setting is its saved value, or its default when missing or of another type');

  // A stylesheet is sent only when its words changed; empty words clear it.
  assert.equal(base.style('a', '.x{}'), true); assert.equal(base.style('a', '.x{}'), false); assert.equal(base.style('a', ''), true); assert.equal(base.style('a', '  '), false);
  assert.deepEqual(sent, [['t-a', '.x{}'], ['t-a', '/* no rules */']]); assert.equal(base.styles(), 1);
  const sheet = base.sheet('t-sheet', '.y{}', 't-cls'); assert.equal(doc.getElementById('t-sheet'), sheet); assert.equal(sheet.className, 't-cls');
  base.sheet('t-sheet', '.z{}'); assert.equal(doc.querySelectorAll('#t-sheet').length, 1); assert.equal(sheet.textContent, '.z{}');
  console.log('  ok  a stylesheet is sent only when changed, and one of its own stands once in Logseq’s page');

  // A warning is written once, counted after, and kept for the troubleshooting tools.
  base.warnOnce('it broke', 'why'); base.warnOnce('it broke'); base.warnOnce('another', undefined);
  assert.deepEqual(warned, [['Test: it broke', 'why'], ['Test: another']]);
  assert.equal(Door.warnings.find(w => w.message === 'Test: it broke').count, 2);
  console.log('  ok  a warning is written once and counted');

  // Listeners, hooks and passes: on while the module runs, all off at stop, the last set up first; a step may be taken off early.
  const order = []; let heard = 0, passes = 0, hooked = true;
  const onKey = () => heard++;
  base.listen(win, ['keydown', 'keyup'], onKey, true);
  const offClick = base.listen(doc, 'click', onKey);
  base.onStop(() => { hooked = false; order.push('hook'); }); base.onStop(null); base.onStop(undefined);   // what a stand-in's hook gives back is let go
  base.onStop(() => order.push('last'));
  base.watch(() => { passes++; });
  assert.equal(passes, 1, 'a pass runs once as it registers'); assert.equal(Door.watching(), 1); assert.equal(base.watching(), 1);
  win.dispatchEvent(new win.KeyboardEvent('keydown')); win.dispatchEvent(new win.KeyboardEvent('keyup')); doc.body.click(); assert.equal(heard, 3);
  offClick(); doc.body.click(); assert.equal(heard, 3, 'a listener taken off early is off'); offClick();
  assert.equal(base.waiting(), 4, 'a listener, a stylesheet and two steps wait');
  doc.body.innerHTML = '<i class="t-own"></i><b data-t="1"></b>'; doc.body.setAttribute('data-reset', '');
  await base.stop();
  assert.deepEqual(order, ['last', 'hook'], 'the last set up is the first undone'); assert.equal(hooked, false);
  win.dispatchEvent(new win.KeyboardEvent('keydown')); assert.equal(heard, 3, 'no listener is left'); assert.equal(Door.watching(), 0, 'no pass is left');
  assert.equal(doc.getElementById('t-sheet'), null, 'its own stylesheet is taken out'); assert.equal(base.waiting(), 0);
  base.sweep(doc); assert.equal(doc.querySelector('.t-own, [data-t]'), null); assert.equal(doc.body.hasAttribute('data-reset'), false);
  console.log('  ok  listeners, hooks, passes and its own stylesheet all go at stop, and the sweep takes out what was left');

  // A step that fails does not stop the others; a new copy runs the clean-up an earlier one left behind.
  const two = Door.base('test', { prefix: 'Two: ' }); let ran = 0;
  two.onStop(() => { throw new Error('no'); }); two.onStop(() => ran++); two.onStop(async () => { throw new Error('later'); });
  await two.stop(); assert.equal(ran, 1); assert.ok(warned.some(w => w[0] === 'Two: clean-up step failed'));
  const old = Door.base('test', { prefix: 'Old: ' }), fresh = Door.base('test', { prefix: 'New: ' }); let oldStopped = 0, swept = 0;
  old.onStop(() => oldStopped++); old.takeOver('__testStop');
  fresh.takeOver('__testStop', () => swept++); assert.equal(oldStopped, 1, 'the earlier copy is stopped'); assert.equal(swept, 1);
  await fresh.stop(); assert.equal(win.__testStop, undefined, 'nothing is left in Logseq’s window');
  assert.equal(Door.bases('test').length, 4); assert.equal(Door.bases('plugin').length, 1, 'the root’s own base');
  console.log('  ok  a failing step leaves the rest running, and a copy cut short is cleaned up by the next');
  console.log('base: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.stack || error)); process.exit(1); });
