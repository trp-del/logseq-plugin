/* node test/keys.js
   The keys of the plugin, kept once on the door (plugin.js, Door.keys, 12 November 2026; until then the settings window, the key
   sheet and Predictive each read a pressed key by a rule of their own, and an arrow recorded in the settings window never fired).
   A copy anywhere else in the running code fails this run and is named with its line. Then the door's own: a key recorded is a
   key matched, a part's fixed keys told and read, and Logseq's keys never written when they could not be read. */
const assert = require('node:assert/strict');
const { files, strays, fail, doorWith } = require('./ground.js');

const RULES = [
  [/navigator\??\.platform/, 'whether this is a Mac asked again (use PluginDoor.keys.mac)'],
  [/code\??\.(?:slice\(3\)|startsWith\('Key'\))|\/\^Key\[A-Z\]\$\//, 'a pressed key named by a rule of its own (use PluginDoor.keys.name or .pressed)'],
  [/mods\.has\('mod'\)/, 'a setting’s keys matched by a rule of its own (use PluginDoor.keys.matches)'],
  [/set_current_graph_configs|get_current_graph_configs/, 'Logseq’s config reached outside the door (use PluginDoor.setLogseqKey, readLogseqConfigKeys)'],
];
for (const [pattern, what] of RULES) { const found = strays(pattern); if (found.length) fail(what, found); }
console.log(`  ok  no file of ${files.length} reads a key, or Logseq's keys, by a rule of its own`);

const D = doorWith({});
const K = D.keys, ev = o => ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o });
assert.equal(K.mac, true, 'with no navigator, a Mac');
// What each of the three recorded before, and one spelling for all of them.
assert.equal(K.pressed(ev({ code: 'KeyT', key: '†', altKey: true })), 'alt+t', 'Option changes what a letter types: by its place');
assert.equal(K.pressed(ev({ code: 'Semicolon', key: '…', altKey: true, shiftKey: true })), 'alt+shift+;');
assert.equal(K.pressed(ev({ code: 'KeyK', key: 'K', metaKey: true, shiftKey: true })), 'mod+shift+k');
assert.equal(K.pressed(ev({ code: 'ArrowUp', key: 'ArrowUp', metaKey: true })), 'mod+up', 'an arrow by its name');
assert.equal(K.pressed(ev({ code: 'Enter', key: 'Enter', metaKey: true, altKey: true })), 'mod+alt+enter');
assert.equal(K.pressed(ev({ code: 'Space', key: ' ', ctrlKey: true })), 'ctrl+space');
assert.equal(K.logseq(ev({ code: 'KeyP', key: 'p', metaKey: true, shiftKey: true })), 'shift+meta+p'); assert.equal(K.logseq(ev({ code: 'ArrowUp', key: 'ArrowUp', altKey: true })), 'alt+up');
// Every key that can be recorded is matched when pressed again: the two that never fired, among them.
for (const e of [{ code: 'ArrowUp', key: 'ArrowUp', metaKey: true }, { code: 'Semicolon', key: '…', altKey: true }, { code: 'KeyT', key: '†', altKey: true }, { code: 'Enter', key: 'Enter', metaKey: true, altKey: true },
  { code: 'Space', key: ' ', metaKey: true, shiftKey: true }, { code: 'Period', key: '>', metaKey: true, shiftKey: true }, { code: 'Digit5', key: '%', ctrlKey: true, shiftKey: true }, { code: 'F5', key: 'F5' }, { code: 'Tab', key: 'Tab', altKey: true }])
  assert.ok(K.matches(ev(e), K.pressed(ev(e))), `${K.pressed(ev(e))} recorded, then pressed`);
// The older spellings a saved setting may hold.
assert.ok(K.matches(ev({ code: 'ArrowUp', key: 'ArrowUp', metaKey: true }), 'mod+arrowup')); assert.ok(K.matches(ev({ code: 'KeyT', key: 't', altKey: true }), 'opt+t')); assert.ok(K.matches(ev({ code: 'KeyK', key: 'k', metaKey: true }), 'meta+k'));
assert.ok(K.matches(ev({ key: ';', metaKey: true }), 'mod+;'), 'with no place given, by what the key reads');
assert.ok(!K.matches(ev({ code: 'KeyK', key: 'k', metaKey: true, shiftKey: true }), 'mod+k'), 'a modifier more is another key');
assert.ok(!K.matches(ev({ code: 'KeyK', key: 'k' }), 'mod+k')); assert.ok(!K.matches(ev({ code: 'KeyK', key: 'k', metaKey: true }), ''), 'no key set: never'); assert.ok(!K.matches(ev({ code: 'KeyK', key: 'k', metaKey: true }), null));
console.log('  ok  a key recorded is the key matched, arrows and Option with a punctuation mark among them');

// A part's fixed keys: told once, read by the key sheet, gone when the part stops.
const off = K.tell('find', () => ({ find: 'mod+k' }));
assert.equal(K.told('find').find, 'mod+k'); assert.equal(JSON.stringify(K.told('nobody')), '{}'); off(); assert.equal(JSON.stringify(K.told('find')), '{}');
K.tell('broken', () => { throw new Error('x'); }); assert.equal(JSON.stringify(K.told('broken')), '{}');
console.log('  ok  a part tells its fixed keys once and the sheet reads them');

// Logseq's keys: one command's key written with every other kept; nothing written when they could not be read.
const hostWith = api => { const written = []; const win = { JSON, logseq: { api: { set_current_graph_configs: v => written.push(v), ...api } } }; return { door: doorWith({}, win), written }; };
{ const { door, written } = hostWith({ get_current_graph_configs: () => ({ 'editor/undo': ['meta+u'], 'go/home': [] }) });
  assert.equal(door.setLogseqKey('go/search', 'meta+j'), true);
  assert.equal(JSON.stringify(written), JSON.stringify([{ shortcuts: { 'editor/undo': ['meta+u'], 'go/home': [], 'go/search': ['meta+j'] } }]), 'the other keys are kept');
  assert.equal(door.setLogseqKey('go/home', ''), true); assert.equal(JSON.stringify(written[1].shortcuts['go/home']), '[]', 'none is an empty list'); }
{ const { door, written } = hostWith({ get_current_graph_configs: () => null });
  assert.equal(door.setLogseqKey('go/search', 'meta+j'), true); assert.equal(JSON.stringify(written[0]), '{"shortcuts":{"go/search":["meta+j"]}}', 'no key changed yet: the first'); }
for (const [why, api] of [['a read that throws', { get_current_graph_configs: () => { throw new Error('no'); } }], ['no way to read', { get_current_graph_configs: undefined }], ['an answer that is no list of keys', { get_current_graph_configs: () => 'x' }], ['a list in place of a map', { get_current_graph_configs: () => [] }]]) {
  const { door, written } = hostWith(api);
  assert.equal(door.setLogseqKey('go/search', 'meta+j'), false, why); assert.equal(written.length, 0, `${why}: nothing is written`);
  assert.equal(JSON.stringify(door.logseqConfigKeys()), '{}'); assert.equal(door.readLogseqConfigKeys(), null);
}
console.log('  ok  Logseq’s keys are written whole or not at all');
