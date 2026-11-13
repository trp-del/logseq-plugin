/* node test/screen.js   (needs jsdom: NODE_PATH, see README)
   The one way the plugin works Logseq's own menus and boxes (PluginDoor.screen in plugin.js, 10 November 2026; it was Threads'
   screen door, with copies in Predictive and the settings' menu). A made-up press, key, paste or input sent from anywhere else
   in the running code fails this run and is named with its line, so a Logseq update that changes what it listens for is mended
   in one place. Then the screen door itself, against a pretend page. */
const assert = require('node:assert/strict');
const { files, strays, fail, doorWith, jsdom } = require('./ground.js');

let found = strays(/\.dispatchEvent\(|\bexecCommand\(\s*['"]insertText|new [\w.()]*(?:Keyboard|Mouse|Pointer|Input|Clipboard)Event\b/, { allow: {
  'export/logseq/ui.js': 1,   // a "change" told to the export window's own select, not to Logseq
} });
if (found.length) fail('a made-up press, key or input not sent through PluginDoor.screen', found);
// A plain .click() on an element. Those let be are the plugin's own buttons, counted, so one on Logseq's cannot come in unseen.
found = strays(/[\w\])]\??\.click\(\)/, { allow: {
  'threads/parts/two-way/more.js': 3,     // a row's own fold arrow, from the arrow keys
  'threads/parts/diagnostics.js': 2,      // the Recycle list's own two presses, from Enter
  'threads/parts/shared.js': 1,           // the kit's own dialog button, from Enter
  'structure/logseq/view.js': 1,          // a group's own menu press, from Enter
  'export/logseq/files.js': 1,            // the export's own download link
} });
if (found.length) fail('a click made on an element by hand (one of Logseq’s goes through PluginDoor.screen.click)', found);
found = strays(/\.cp__select, \.ui__popover-content|#ui__ac, \.absolute-modal/);
if (found.length) fail('Logseq’s pop-ups are named in a list of its own (ask PluginDoor.screen.popupOpen or editorPopupOpen)', found);
console.log(`  ok  in ${files.length} files every made-up press, key and input goes through the one screen door`);

(async () => {
  const win = jsdom('<html><body><div id="main-content-container"><textarea id="box"></textarea><input id="field"></div><div role="menu" id="menu"><div role="menuitem" id="item">Node embed</div></div><div class="lk-pop" id="own"><div role="menu" id="ownmenu"></div></div></body></html>');
  const doc = win.document, S = doorWith({ UI: { showMsg() {} } }, win).screen;
  win.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };   // jsdom lays nothing out: what is in the page counts as shown
  const box = doc.getElementById('box'), field = doc.getElementById('field'), menu = doc.getElementById('menu');

  // A press is the whole run a mouse makes, in its order; what the caller adds is said with each.
  const heard = []; const item = doc.getElementById('item');
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) item.addEventListener(type, event => heard.push([event.type, event.buttons, event.clientX]));
  S.press(item, { clientX: 7 });
  assert.deepEqual(heard, [['pointerdown', 1, 7], ['mousedown', 1, 7], ['pointerup', 0, 7], ['mouseup', 0, 7], ['click', 0, 7]]);
  let clicks = 0; item.addEventListener('click', () => clicks++); assert.equal(S.click(item), true); assert.equal(S.click(null), false); assert.equal(clicks, 1);
  console.log('  ok  a press is pointer down, mouse down, pointer up, mouse up, click');

  // Typing into a box sets its words as typing would and tells Logseq with an input.
  const inputs = []; win.addEventListener('input', event => inputs.push([event.target.id, event.inputType ?? null, event.data ?? null]), true);
  S.typeInto(field, 'next fri', { select: true }); assert.equal(field.value, 'next fri'); assert.equal(field.selectionEnd, 8);
  S.typeInto(box, '[[dr. mei chen]]', { inputType: 'insertReplacementText' }); assert.equal(box.value, '[[dr. mei chen]]');
  box.value = 'seen Dr. Chen today'; S.insert(box, '[[Dr. Mei Chen]]', 5, 13); assert.equal(box.value, 'seen [[Dr. Mei Chen]] today');
  S.typed(box);
  assert.deepEqual(inputs, [['field', null, null], ['box', 'insertReplacementText', null], ['box', 'insertText', '[[Dr. Mei Chen]]'], ['box', 'insertText', null]]);
  console.log('  ok  words typed, replaced or put in reach the box and Logseq hears an input each time');

  // A key and a paste arrive as Logseq listens for them.
  let key = null, pasted = null;
  menu.addEventListener('keydown', event => { key = [event.key, event.code, event.bubbles, event.cancelable]; });
  assert.equal(S.key(menu, 'Escape'), true); assert.deepEqual(key, ['Escape', 'Escape', true, true]); assert.equal(S.key(null, 'Escape'), false);
  win.ClipboardEvent ||= class extends win.Event {};   // jsdom has none
  box.addEventListener('paste', event => { pasted = event.type; }); S.paste(box, null); assert.equal(pasted, 'paste');
  console.log('  ok  a key and a paste arrive as real ones do');

  // What floats: Logseq's menu counts, the page's own boxes do not, the plugin's own pop-up only when asked.
  assert.equal(S.floating(menu), true); assert.equal(S.floating(box), false);
  assert.equal(S.floating(doc.getElementById('ownmenu')), false); assert.equal(S.floating(doc.getElementById('ownmenu'), { own: true }), true);
  assert.equal(S.popupOpen(), true); assert.equal(S.popupOpen(item), true); assert.equal(S.popupOpen(box), false);
  menu.remove(); assert.equal(S.popupOpen(), false, 'only the plugin’s own is left'); assert.equal(S.popupOpen(null, doc, { own: true }), true);
  assert.equal(S.editorPopupOpen(), false); doc.body.insertAdjacentHTML('beforeend', '<div id="ui__ac"></div>'); assert.equal(S.editorPopupOpen(), true);
  console.log('  ok  Logseq’s pop-ups are told from the page and from the plugin’s own');

  // Waiting: what is there is given at once, what never comes is null when the time is up, by time or by frames.
  assert.equal(await S.waitFor(() => box), box);
  setTimeout(() => doc.body.insertAdjacentHTML('beforeend', '<i id="late"></i>'), 60);
  assert.equal((await S.waitFor(() => doc.getElementById('late'), 1000)).id, 'late');
  assert.equal(await S.waitFor(() => null, 120), null);
  win.requestAnimationFrame = fn => setTimeout(fn, 5);
  assert.equal(await S.waitFor(() => doc.getElementById('late'), 300, { frames: true }), doc.getElementById('late')); assert.equal(await S.waitFor(() => null, 60, { frames: true }), null);
  console.log('  ok  a wait gives what came, or nothing when its time is up');
  console.log('screen: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.stack || error)); process.exit(1); });
