#!/usr/bin/env node
/* The Recycle as a plain list (parts/diagnostics.js, 0.4.407) in a pretend Logseq window, on the answer Logseq 2.0.2
   gives a plugin for the Recycle's nodes (copied from the Illness Test Graph, 2026-10-25): newest first, a page and a
   bullet named in words, the damaged ones marked, the report, and Restore asking Logseq once for that node only.
   Needs node and jsdom. Run from the repo root: node tools/recycle-list-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const AT = ':logseq.property/deleted-at', FROM = ':logseq.property.recycle/original-page';
const PAGE = '6add41cd-c566-4e21-9512-3949c5dcd1e6', BULLET = '6ad960fe-f45f-4d59-b609-b7a2ba15318f', LOST = '6ad960fe-f45f-4d59-b609-b7a2ba153100';
const answer = [
  [{ [AT]: 1792770322346, parent: { title: 'Recycle' }, name: '1 river lane, eastbridge', uuid: PAGE, title: '1 River Lane, Eastbridge', [FROM]: { title: '1 River Lane, Eastbridge', [AT]: 1792770322346 } }],
  [{ [AT]: 1792885210651, parent: { title: 'Recycle' }, uuid: BULLET, title: 'Asked about the second cycle', [FROM]: { title: 'Oct 19th, 2026' } }],
  [{ [AT]: 1792631054016, parent: { title: 'Recycle' }, uuid: LOST, title: '' }],
];

const dom = new JSDOM('<!doctype html><html><body><div id="app-container"></div></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;
const restored = [], removed = [], notices = [];
let answerYes = true;
window.logseq = { settings: {}, baseInfo: { version: '0.4.407' },
  App: { getInfo: async () => '2.0.2', registerCommand: () => {}, showMsg: (text, kind) => notices.push([text, kind]) },
  UI: { showMsg: (text, kind) => notices.push([text, kind]) },
  DB: { datascriptQuery: async () => answer },
  Editor: { restorePage: async uuid => { restored.push(uuid); }, deleteRecycledPagePermanently: async uuid => { removed.push(uuid); } } };
// The browser's question is never asked any more: the plugin asks under the line. A call to it is a fault.
let confirmed = 0;
window.confirm = () => { confirmed++; return answerYes; };
// The ask's answers: Leave it (No) or the blue Delete for good (Yes), pressed under the line.
const answerAsk = async (pop, yes) => { const ask = pop.body.querySelector('.th-recycle-ask'); (yes ? ask?.querySelector('.lk-big') : ask?.querySelector('.lk-btn'))?.click(); await new Promise(r => setTimeout(r, 20)); return ask; };
window.HTMLElement.prototype.showPopover = function () {};
window.HTMLElement.prototype.hidePopover = function () {};
for (const file of ['../plugin.js', 'parts/shared.js', 'parts/diagnostics.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
const core = window.Threads.core = { provided: { CHECKED_WITH: '2.0.2' }, sendStyle: () => {}, watchDom: () => {}, onDatabaseChange: () => {}, onSettingsChange: () => {} };
core.provide = things => Object.assign(core.provided, things);
const part = window.Threads.parts.find(p => p.name === 'diagnostics');
part.provide(core);
const d = core.provided.diagnostics;

(async () => {
  // The rows.
  const rows = d.recycleRows(answer);
  check(rows.map(r => r.uuid).join() === [BULLET, PAGE, LOST].join(), 'newest first: ' + rows.map(r => r.title).join(' | '));
  check(rows[1].page && !rows[1].damage.length && rows[1].from === '', 'a page, sound: ' + JSON.stringify(rows[1]));
  check(!rows[0].page && rows[0].from === 'Oct 19th, 2026' && !rows[0].damage.length, 'a bullet, with its page: ' + JSON.stringify(rows[0]));
  check(rows[2].damage.includes('no words') && rows[2].damage.includes('the page it came from is gone'), 'a damaged bullet: ' + rows[2].damage.join('; '));
  const outside = d.recycleRows([[{ [AT]: 5, parent: { title: 'Oct 19th, 2026' }, uuid: BULLET, title: 'x', [FROM]: { title: 'Gone page', [AT]: 3 } }]])[0];
  check(outside.damage.includes('not under the Recycle') && outside.damage.includes('the page it came from is deleted too'), 'outside the Recycle: ' + outside.damage.join('; '));
  check(d.recycleRows(null).length === 0 && d.recycleRows([[null]]).length === 0, 'no answer, no rows');
  const report = d.recycleReport(rows, 'Threads 0.4.407');
  check(/3 nodes in the Recycle/.test(report) && report.includes(`page · 1 River Lane, Eastbridge · ${PAGE}`) && report.includes('a bullet with no words · ' + LOST + ' · no words'), 'the report:\n' + report);
  check(/Oct 2\d, 2026/.test(report), 'days in words: ' + report);

  // The list.
  const tool = d.tools.find(t => t.key === 'recycle-list');
  check(tool && tool.icon, 'the tool is in the troubleshooting box');
  const pop = await d.openRecycleList();
  const buttons = () => [...pop.body.querySelectorAll('.th-item')];
  check(buttons().length === 6, 'a line for the report, one to watch Logseq’s Recycle, Delete all, and one per node: ' + buttons().length);
  check(/3 deleted nodes/.test(pop.el.textContent) && /1 looks damaged/.test(pop.el.textContent), 'head and note: ' + pop.el.textContent.slice(0, 160));
  const page = buttons().find(b => b.textContent.includes('1 River Lane'));
  check(page.querySelector('.th-end .lk-fix.lk-i-undo')?.textContent === 'Restore' && page.querySelector('.th-end .lk-fix.lk-del')?.textContent === 'Delete', 'Restore and a red Delete on the line, the library\'s presses: ' + page.querySelector('.th-end')?.innerHTML);
  page.click();
  await wait(20);
  check(restored.join() === PAGE, 'Restore asks Logseq for that node only: ' + restored.join());
  check(page.disabled && page.querySelector('.th-end').textContent === 'Restored' && !pop.isClosed, 'the line says Restored, the list stays open');
  page.click();
  await wait(20);
  check(restored.length === 1, 'a second click restores nothing more');
  // Delete for good: asked first, under the line; Leave it leaves it, the blue yes asks Logseq for that node only; the list stays open.
  const bullet = buttons().find(b => b.textContent.includes('Asked about the second cycle'));
  bullet.querySelector('.lk-del').click();
  await wait(20);
  const ask = pop.body.querySelector('.th-recycle-ask');
  check(ask && ask.previousElementSibling === bullet && /for good/.test(ask.querySelector('.th-recycle-ask-h')?.textContent) && ask.querySelector('.lk-big')?.textContent === 'Delete for good' && /Leave it/.test(ask.querySelector('.lk-btn')?.textContent), 'the ask stands under the line: a bold line, the blue yes, Leave it: ' + ask?.textContent);
  check(!removed.length && !restored.includes(BULLET), 'asking deletes nothing, restores nothing');
  await answerAsk(pop, false);
  check(!removed.length && !restored.includes(BULLET) && !bullet.disabled && !pop.body.querySelector('.th-recycle-ask'), 'Leave it deletes nothing and the ask goes');
  bullet.querySelector('.lk-del').click();
  await wait(20);
  await answerAsk(pop, true);
  check(removed.join() === BULLET && !restored.includes(BULLET), 'Delete asks Logseq to delete that node for good, and does not restore it: ' + removed.join());
  check(bullet.disabled && bullet.querySelector('.th-end').textContent === 'Deleted' && !pop.isClosed, 'the line says Deleted, the list stays open');
  pop.close();

  // Delete all: one question; No deletes nothing; Yes deletes every node not yet done, the list stays open.
  removed.length = 0; restored.length = 0;
  const pop2 = await d.openRecycleList();
  const lines2 = () => [...pop2.body.querySelectorAll('.th-item')];
  check(pop2.el.classList.contains('th-recycle'), 'the list is the tall one');
  lines2().find(b => b.textContent.includes('1 River Lane')).click();
  await wait(20);
  const all = lines2().find(b => /Delete all 3 for good/.test(b.textContent));
  check(all, 'Delete all, with the count: ' + lines2().map(b => b.textContent).join(' | '));
  all.click();
  await wait(20);
  check(pop2.body.querySelector('.th-recycle-ask')?.previousElementSibling === all && /Delete all 2 for good/.test(pop2.body.querySelector('.th-recycle-ask-h')?.textContent), 'Delete all asks under its own line, with how many are left');
  await answerAsk(pop2, false);
  check(!removed.length && !pop2.isClosed, 'Leave it to Delete all deletes nothing');
  all.click();
  await wait(20);
  await answerAsk(pop2, true);
  await wait(40);
  check(removed.sort().join() === [BULLET, LOST].sort().join(), 'Delete all deletes every node not restored: ' + removed.join());
  check(lines2().filter(b => b.querySelector('.th-end')?.textContent === 'Deleted').length === 2 && !pop2.isClosed, 'each line reads Deleted, the list stays open');
  check(all.disabled && all.querySelector('.th-end')?.textContent === 'Done', 'Delete all reads Done: ' + all.textContent);
  check(notices.some(([text]) => /Deleted all 2 from the Recycle/.test(text)), 'a notice says how many: ' + JSON.stringify(notices));
  pop2.close();
  check(confirmed === 0, 'the browser\'s question was never asked');

  console.log(`\nrecycle-list-test: ${cases - problems.length} of ${cases} checks passed`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
