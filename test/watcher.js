/* node test/watcher.js   (needs jsdom: NODE_PATH, see README)
   The one watcher of Logseq's screen (PluginDoor.watch in plugin.js; 10 November 2026: Structure's two, Predictive's and Threads'
   measuring one moved onto it). A watcher made anywhere else in the running code fails this run and is named with its line. Then
   the watcher itself: one observer however many passes, an early pass before the screen is drawn, what the passes draw set
   aside so the watcher never answers itself, a witness shown everything, and nothing left when the last pass goes. */
const assert = require('node:assert/strict');
const { files, strays, fail, doorWith, jsdom, sleep } = require('./ground.js');

const found = strays(/\bMutationObserver\b/);
if (found.length) fail('a watcher of Logseq’s screen outside the door (register a pass: base.watch, PluginDoor.watch)', found);
console.log(`  ok  no file of ${files.length} keeps a screen watcher of its own`);

(async () => {
  const win = jsdom(), doc = win.document;
  let made = 0;
  const Real = win.MutationObserver;
  win.MutationObserver = class extends Real { constructor(fn) { super(fn); made++; } };
  win.requestAnimationFrame = fn => setTimeout(fn, 5); win.cancelAnimationFrame = id => clearTimeout(id);
  const Door = doorWith({ UI: { showMsg() {} } }, win, { console: { ...console, error() {} } });
  const add = (cls = 'theirs') => { const el = doc.createElement('div'); el.className = cls; doc.body.appendChild(el); return el; };

  // Many passes, one observer; a frame pass runs once as it registers and once per frame after a change, however many changes.
  const seen = { frame: 0, early: [], witness: [] };
  const offFrame = Door.watch(() => { seen.frame++; });
  const offEarly = Door.watch((page, records) => { seen.early.push(records.length); if (Door.addsElements(records) && !doc.querySelector('.ours')) add('ours'); }, { early: true });
  const offWitness = Door.watch((page, records) => { seen.witness.push([...records].filter(r => r.type === 'childList').flatMap(r => [...r.addedNodes].map(n => n.className))); }, { witness: true });
  assert.equal(made, 1, 'one observer for three passes'); assert.equal(Door.watching(), 3); assert.equal(seen.frame, 1);
  add(); add(); add();
  await sleep(30);
  assert.equal(seen.early.length, 1, 'the early pass ran once for the changes of one turn, at once');
  assert.equal(seen.frame, 2, 'the frame pass ran once for them');
  assert.deepEqual(seen.witness[0], ['theirs', 'theirs', 'theirs', 'ours'], 'the witness is shown what the early pass drew too');
  assert.equal(doc.querySelectorAll('.ours').length, 1, 'what the early pass drew did not call it again');
  console.log('  ok  one observer; an early pass runs at once, a frame pass once a frame, and what a pass draws does not wake the watcher');

  // A change of class alone (pointing, selecting) runs no frame pass; the early passes still see it.
  const before = { ...seen, early: seen.early.length };
  doc.body.firstChild.className = 'pointed';
  await sleep(30);
  assert.equal(seen.frame, before.frame, 'no frame pass for a class alone'); assert.equal(seen.early.length, before.early + 1);
  console.log('  ok  a change of class alone runs no frame pass');

  // A pass that throws five times is retired; the others go on.
  let threw = 0;
  Door.watch(() => { threw++; throw new Error('broken'); }, { early: true });
  for (let i = 0; i < 7; i++) { add(); await sleep(10); }
  assert.equal(threw, 5, 'retired after five errors'); assert.ok(seen.early.length > before.early + 5, 'the other early pass kept running');
  console.log('  ok  a pass that keeps failing is retired, the rest go on');

  // The observer stands while any pass is registered and goes with the last.
  offFrame(); offEarly(); assert.equal(Door.watching(), 1); offWitness(); assert.equal(Door.watching(), 0);
  const frames = seen.frame; add(); await sleep(30); assert.equal(seen.frame, frames, 'nothing runs once the last pass is off');
  Door.watch(() => {}); assert.equal(made, 2, 'a pass registered later starts the watcher again'); Door.stopWatching();
  console.log('  ok  the watcher goes with its last pass and comes back with the next');
  console.log('watcher: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.stack || error)); process.exit(1); });
