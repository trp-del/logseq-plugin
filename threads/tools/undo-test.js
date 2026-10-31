#!/usr/bin/env node
/* The plugin's one Undo (shared.undo in parts/shared.js, 0.4.258) in a pretend Logseq window: an arrow at the end of what
   changed, two changes keeping two arrows (the old bar lost the first), a change at the same place adding to its arrow,
   the arrow put back when Logseq draws the place again, waiting at the bottom right when nothing is left to sit beside,
   a click taking the change back, and nothing left after clear and stop.
   Needs node and jsdom. Run from the repo root: node tools/undo-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const dom = new JSDOM('<!doctype html><html><body><div id="a" class="line">Dr. Mei Chen</div><div id="b" class="line">Oxaliplatin</div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;
window.logseq = { settings: {}, UI: { showMsg() {} } };
window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
const { undo } = window.refinementShared;
const arrows = () => [...doc.querySelectorAll('.rf-undo')];
const ran = [];

(async () => {
  undo.offer({ key: 'one', at: () => doc.getElementById('a'), text: 'Provider: Dr. Mei Chen', run: () => ran.push('one') });
  undo.offer({ key: 'two', at: () => doc.getElementById('b'), text: 'Agent: Oxaliplatin', run: () => ran.push('two') });
  check(arrows().length === 2, 'two changes should keep two arrows: ' + arrows().length);
  check(doc.querySelector('#a > .rf-undo')?.title === 'Undo: Provider: Dr. Mei Chen', 'the arrow should sit at the end of what changed and say what it takes back');
  // A change at the same place adds to its arrow: one click takes both back, the later first.
  undo.offer({ key: 'one', at: () => doc.getElementById('a'), text: 'Date: Oct 21', run: () => ran.push('one-later') });
  check(doc.querySelectorAll('#a > .rf-undo').length === 1 && /Date: Oct 21 · Provider/.test(doc.querySelector('#a > .rf-undo').title), 'a second change at the same place adds to its arrow');
  // Logseq draws the place again: the arrow comes back on the new one.
  const fresh = doc.createElement('div'); fresh.id = 'b'; fresh.className = 'line'; fresh.textContent = 'Oxaliplatin';
  doc.getElementById('b').replaceWith(fresh);
  await wait(10);
  check(!!doc.querySelector('#b > .rf-undo'), 'the arrow should come back when the place is drawn again');
  // A click takes the change back, and only that one.
  doc.querySelector('#a > .rf-undo').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(10);
  check(ran.join() === 'one-later,one', 'the click should take back both changes made there, the later first: ' + ran.join());
  check(!doc.querySelector('#a > .rf-undo') && !!doc.querySelector('#b > .rf-undo'), 'the other arrow should stay');
  // Nothing on screen to sit beside: it waits at the bottom right, with its words.
  undo.offer({ key: 'gone', at: () => null, text: 'Deleted 3 records', run: () => ran.push('gone') });
  check(doc.querySelector('.rf-undo-dock .rf-undo')?.textContent.includes('Deleted 3 records'), 'with nothing to sit beside, the arrow waits at the bottom right with its words');
  undo.forget('two');
  check(!doc.querySelector('#b > .rf-undo') && undo.size === 1, 'forgetting one takes only its arrow');
  undo.clear();
  check(!arrows().length && !doc.querySelector('.rf-undo-dock') && undo.size === 0, 'clear (leaving the page) takes every arrow away');
  undo.offer({ key: 'last', at: () => doc.getElementById('a'), text: 'x', run: () => {} });
  undo.stop();
  check(!arrows().length && undo.size === 0, 'stop (the plugin unloading) leaves nothing');
  console.log(problems.length ? `undo-test: ${problems.length} of ${cases} checks failed` : `undo-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
