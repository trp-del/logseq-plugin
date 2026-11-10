/* node test/load.js
   Loads the plugin's browser files, in files.js's order, against a stand-in for Logseq (a fake `logseq`, a fake window).
   It cannot show that the plugin works inside Logseq 2.0.2 (only running it there can), but it does show that every file
   parses, that they find each other in order, that the adapter turns Logseq-shaped query rows into the core's data, and that
   the whole path from "read the graph" to "propose" works on those rows. The rows have the shapes the original plugin's
   readers (parts/model.js) were written against. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { root, order } = require('../../test/module.js')('predictive');
// The Option-T list: Enter and the arrows only. A digit is something you might be typing: it closes the list and goes on as typing.
{ const pick = fs.readFileSync(path.join(root, 'predictive/logseq/tag-pick.js'), 'utf8');
  assert.ok(!/Number\(event\.key\)/.test(pick) && !/\[1-9\]/.test(pick) && !/flow-pick-n\b/.test(pick), 'no digit picks, and no number is shown beside a row'); }
const listeners = [], styles = {}, commands = [], shown = [], palette = {}, slash = [];

// A tiny graph in the shapes Logseq's datascript queries return.
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tag = (id, name) => ({ 'db/id': id, 'block/uuid': U(id), 'block/title': name, 'db/ident': `user.class/${name}`, 'block/tags': [{ 'db/id': 1, 'block/title': 'Tag', 'db/ident': 'logseq.class/Tag' }] });
const person = (id, name) => ({ 'db/id': id, 'block/uuid': U(id), 'block/title': name, 'block/tags': [{ 'db/id': 10, 'block/title': 'Person', 'db/ident': 'user.class/Person' }] });
const pages = [tag(10, 'Person'), tag(11, 'Visit'), person(20, 'Dr. Mei Chen'), person(21, 'Ruth Okoro')];
const doctorProp = { 'db/id': 100, 'db/ident': 'user.property/doctor', 'block/uuid': U(100), 'block/title': 'Doctor', 'logseq.property/type': 'node', 'db/cardinality': 'db.cardinality/one', 'logseq.property/classes': [{ 'db/id': 10, 'block/uuid': U(10), 'block/title': 'Person' }] };
const visits = [
  { 'db/id': 300, 'block/title': `Saw [[${U(20)}]] about the tingling in my fingers`, 'block/tags': [{ 'db/id': 11 }], 'block/page': { 'db/id': 500 }, 'user.property/doctor': [{ 'db/id': 20 }] },
  { 'db/id': 301, 'block/title': `Saw [[${U(20)}]] about the tingling again`, 'block/tags': [{ 'db/id': 11 }], 'block/page': { 'db/id': 500 }, 'user.property/doctor': [{ 'db/id': 20 }] },
  { 'db/id': 302, 'block/title': `Saw [[${U(21)}]] about a sprained ankle`, 'block/tags': [{ 'db/id': 11 }], 'block/page': { 'db/id': 500 }, 'user.property/doctor': [{ 'db/id': 21 }] },
];
const block = (text, over = {}) => ({ 'db/id': 400, 'block/uuid': U(400), 'block/title': text, 'block/tags': [{ 'db/id': 11 }],
  'block/page': { 'db/id': 500, 'block/uuid': U(500), 'block/title': 'Oct 28th, 2026', 'block/journal-day': 20261028, 'block/tags': [] }, ...over });

const saved = new Map();   // the bullets of the writing check, by uuid, as Logseq holds them
const log = [];
function fakeQuery(query) {
  log.push(query);
  const has = (...parts) => parts.every(p => query.includes(p));
  if (has('logseq.property/classes', 'logseq.class/Property')) return [[doctorProp]];
  if (has('closed-value-property')) return [];
  if (has('[?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]')) return [[10, ':user.class/Person'], [11, ':user.class/Visit'], [1, ':logseq.class/Root']];
  if (has('logseq.property.class/properties')) return [[11, 100]];
  if (has('logseq.property.class/extends')) return [];
  if (has(':block/name _')) return pages.map(p => [p]);
  if (has('[?p :block/name ?n]')) return pages.filter(p => query.includes(JSON.stringify(p['block/title'].toLowerCase()))).map(p => [p]);
  if (has('ground #{')) return visits.map(n => [n]);
  if (has('[?b :block/page _] [?b :block/title ?t]') && !has('not [?b :block/tags _]')) return visits.map(n => [n['db/id'], n['block/title']]);
  if (has('not [?b :block/tags _]')) return [[600, 'Bought bread and milk on the way home']];
  if (has('?o :block/alias ?a')) return [];
  if (has('[?p :block/journal-day ?d]')) return [[500, 20261028]];
  if (has('#uuid')) return [[saved.get(query.match(/#uuid "([^"]+)"/)[1]) || block(`Saw [[${U(21)}]] today`)]];
  return [];
}
const doc = { activeElement: null, body: { append() {} }, documentElement: { classList: { toggle() {}, remove() {} } }, querySelectorAll: () => [], querySelector: () => null, defaultView: {
  addEventListener: (type, fn) => listeners.push(type), removeEventListener() {}, requestAnimationFrame: fn => 0, cancelAnimationFrame() {},
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } } } };
const window = { parent: { document: doc }, Flow: undefined };
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, updateSettings() {}, provideStyle: ({ key, style }) => { styles[key] = style; }, useSettingsSchema() {}, beforeunload() {},
  provideModel() {}, App: { registerCommandPalette: ({ key }, fn) => { commands.push(key); palette[key] = fn; }, registerUIItem() {}, onCurrentGraphChanged() {}, onRouteChanged() {}, getCurrentGraph: async () => ({ name: 'logseq_db_pretend' }), getUserConfigs: async () => ({ preferredDateFormat: 'MMM do, yyyy' }) },
  DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) },
  UI: { showMsg: m => shown.push(m) }, Editor: { registerSlashCommand: name => slash.push(name) },
};
const errors = [];
const quietConsole = { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); console.error(...a); } };
const sandbox = { window, logseq, document: { currentScript: null }, console: quietConsole, setTimeout, clearTimeout, Promise, URL, performance, Date, Map, Set, WeakMap, WeakSet };
window.window = window;
vm.createContext(sandbox);
for (const file of order) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });

(async () => {
  await new Promise(r => setTimeout(r, 50));   // main() runs after logseq.ready
  const Flow = window.Flow;
  assert.deepEqual(errors, [], 'main() started without an error');
  assert.ok(Flow.propose && Flow.profile && Flow.db && Flow.app && Flow.linkUi && Flow.proposeUi && Flow.steps, 'every part registered');
  assert.deepEqual(commands.sort(), ['flow-choose-tag', 'flow-model-measure', 'flow-model-speed', 'flow-reread', 'flow-score', 'flow-tune'], 'commands registered');
  assert.ok(listeners.includes('input') && listeners.includes('focusout'), 'listeners attached to Logseq\'s window');
  assert.ok(styles['flow-proposals'] && styles['flow-link-suggest'], 'styles sent');
  console.log('  ok  every file loads in order and main() starts');

  const ctx = await Flow.app.context();
  assert.equal(ctx.schema.props.length, 1);
  assert.equal(ctx.schema.props[0].title, 'Doctor');
  assert.deepEqual([...ctx.schema.classProps.get(11)], [100]);
  assert.equal(ctx.pages.length, 4);
  assert.equal(ctx.index.entries.length, 4, 'three visits and one plain line learned from');
  console.log('  ok  Logseq-shaped rows become a schema, pages and a learned index');

  const bullet = Flow.db.bulletOf(block(`Saw [[${U(21)}]] today`), `Saw [[Ruth Okoro]] today`, ctx.schema);
  assert.equal(bullet.page.day, 20261028); assert.deepEqual([...bullet.tags], [11]); assert.equal(bullet.parent, null);
  const linked = Flow.propose.propose(ctx, bullet).pieces.find(p => p.ident === 'user.property/doctor');
  assert.deepEqual([...linked.ids], [21]); assert.ok(!linked.guess);
  console.log('  ok  a pulled block becomes a bullet and a linked person fills Doctor');

  const words = Flow.db.bulletOf(block('Back to the doctor about the tingling in my fingers'), 'Back to the doctor about the tingling in my fingers', ctx.schema);
  const guess = Flow.propose.propose(ctx, words).pieces.find(p => p.ident === 'user.property/doctor');
  assert.deepEqual([...guess.ids], [20]); assert.ok(guess.guess);
  console.log('  ok  the doctor is guessed from what the earlier lines were about');

  // Another graph: a reading in flight is dropped and read afresh, and a list of pages the same; each graph has its own date format.
  { const real = Flow.db.readContext, pagesReal = Flow.db.loadPages; let release, releasePages;
    Flow.db.readContext = () => new Promise(resolve => { release = () => resolve({ from: 'old graph', readAt: Date.now() }); });
    Flow.db.loadPages = () => new Promise(resolve => { releasePages = () => resolve(['old page']); });
    Flow.app.forget(); const asked = Flow.app.context(), listed = Flow.app.pages();
    await new Promise(r => setTimeout(r, 10));
    Flow.db.readContext = async () => ({ from: 'new graph', readAt: Date.now() }); Flow.db.loadPages = async () => ['new page'];
    Flow.app.forget(); assert.equal(Flow.app.state.loading, null, 'the next asks afresh');
    release(); releasePages();
    assert.equal((await asked).from, 'new graph', 'who asked gets the new graph'); assert.equal(Flow.app.state.ctx.from, 'new graph', 'never the old'); assert.deepEqual(await listed, ['new page']);
    Flow.db.readContext = real; Flow.db.loadPages = pagesReal; Flow.app.forget(); await Flow.app.context(); }
  console.log('  ok  a reading in flight never lands as another graph\'s');

  // The settings window: no language row, and the eagerness specimen shows the choice by placement.
  assert.ok(!Flow.settingsSchema.some(s => s.key === 'locale'), 'no row for one language');
  assert.equal(Flow.app.state.ctx.reader.locale, Flow.dates.en, 'dates in words still read in English');
  const opened = sandbox.window.PluginDoor.described.predictive;
  const pencils = value => (opened.specimen({ key: 'tagEagerness' }, value).match(/lk-pencil/g) || []).length;
  assert.deepEqual(['careful', 'balanced', 'eager'].map(pencils), [0, 1, 2]);
  const lines = opened.specimen({ key: 'tagEagerness' }, 'eager').split('<br>');
  assert.ok(lines[0].includes('sandpaper') && lines[0].includes('lk-pencil') && lines[1].includes('bread') && lines[1].includes('lk-pencil'));
  assert.ok(!opened.specimen({ key: 'tagEagerness' }, 'balanced').split('<br>')[1].includes('lk-pencil'), 'balanced leaves the plain note alone');
  assert.ok(!opened.specimen({ key: 'proposals' }, false).includes('lk-pencil') && opened.specimen({ key: 'proposals' }, true).includes('lk-pencil'), 'the switches still read as on and off');
  console.log('  ok  the settings window: no language row, three eagerness specimens');

  // Option-Enter: the pencil stays while the list is open and Logseq's empty value is back, unseen, for the list to sit under.
  const css = styles['flow-proposals'];
  assert.ok(!css.includes('${'), 'the stylesheet is written out in full');
  assert.ok(/\.bottom-property-pill\.bottom-property-pill\[data-flow-at\]::after \{ inset: -2px 0 !important;/.test(css), 'the ring while the list has the keyboard');
  assert.ok(/ ~ \.bottom-property-pill\.bottom-property-pill\[data-flow-at\]::after \{ left: 16px/.test(css), 'the ring leaves the dot outside');
  assert.ok(!/\[data-flow-at\] \.flow-ghost \{ display: none/.test(css), 'the guess no longer steps aside for the list');
  assert.ok(/\[data-flow-at\]:not\(:has\(input, textarea\)\) \.empty-value \{ position: absolute; opacity: 0;/.test(css));
  console.log('  ok  the pencil stays under an open list');

  const same = await Flow.db.pagesNamed(['dr. mei chen']);
  assert.equal(same.length, 1);
  assert.equal(await Flow.app.allowed(), true);
  console.log('  ok  fresh page lookup and the per-graph switch');

  // Writing, on a page of real elements (jsdom): passing through a bullet, writing in one, and the Undo arrow.
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('  skipped writing on a page: needs jsdom (set NODE_PATH)'); process.exit(0); }
  const A = U(400), B = U(401), C = U(402), rowHtml = uuid => `<div class="ls-block" blockid="${uuid}"><div class="block-main-container"><div class="block-title-wrap"><textarea></textarea></div></div></div>`;
  const page = new JSDOM(`<html><body><div id="main-content-container">${[A, B, C].map(rowHtml).join('')}</div></body></html>`, { pretendToBeVisual: true }), hostDoc = page.window.document;
  window.parent = { document: hostDoc };
  logseq.DB.datascriptQuery = async q => fakeQuery(q);
  logseq.DB.onChanged = () => {};
  const writes = [], ident = 'user.property/doctor', box = uuid => hostDoc.querySelector(`[blockid="${uuid}"] textarea`), line = n => `Saw [[${U(21)}]] today${n}`;
  for (const [uuid, id] of [[A, 410], [B, 411], [C, 412]]) { saved.set(uuid, block(line(''), { 'db/id': id, 'block/uuid': uuid })); box(uuid).value = 'Saw [[Ruth Okoro]] today'; }
  logseq.Editor.upsertBlockProperty = async (uuid, key, value) => { writes.push(['set', uuid]); saved.get(uuid)[key] = [{ 'db/id': value }]; };
  logseq.Editor.removeBlockProperty = async (uuid, key) => { writes.push(['unset', uuid]); delete saved.get(uuid)[key]; };
  logseq.Editor.addBlockTag = async () => {}; logseq.Editor.removeBlockTag = async () => {};
  const wait = ms => new Promise(r => setTimeout(r, ms)), P = Flow.proposeUi;
  P.start();
  const enter = async uuid => { box(uuid).focus(); await wait(320); };
  const leave = async () => { hostDoc.activeElement.blur(); await wait(350); };
  const type = async (uuid, more) => { box(uuid).value += more; saved.get(uuid)['block/title'] = line(more); box(uuid).dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(320); };
  const arrows = () => [...hostDoc.querySelectorAll('.lk-undo[data-lk-undo]')];

  // How often names are linked is counted with the graph's reading, and one changed line changes only its own count.
  const read = await Flow.app.context(), rate = () => read.linkLines.counter.rates.get('ruth okoro').linked;
  assert.equal(rate(), 1, 'the rates come with the graph');
  const was = visits[2]['block/title'];
  visits[2]['block/title'] = 'Saw nobody about a sprained ankle';
  await Flow.db.learnNodes(read, [302]);
  assert.equal(rate(), 0, 'a changed line takes its link back');
  visits[2]['block/title'] = was; await Flow.db.learnNodes(read, [302]);
  assert.equal(rate(), 1, 'and gives it again');
  console.log('  ok  link rates come with the graph and follow one changed line');

  await enter(A);
  assert.ok(!hostDoc.querySelector('.flow-ghost'), 'an old bullet entered with its words unchanged shows nothing (8 November 2026)');
  await leave();
  assert.deepEqual(writes, [], 'a bullet only passed through is not written to');
  console.log('  ok  passing through a bullet shows and writes nothing');

  // Nothing is worked out while letters keep coming; a bullet left within the pause keeps what was shown.
  await enter(A);
  const asked = () => log.filter(q => q.includes('#uuid')).length, before = asked();
  for (const letter of ' ag') { box(A).value += letter; box(A).dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(60); }
  await wait(60); assert.equal(asked(), before, 'three quick letters start no proposal');
  box(A).value = 'Saw [[Ruth Okoro]] today again'; saved.get(A)['block/title'] = line(' again');
  box(A).dispatchEvent(new page.window.Event('input', { bubbles: true }));
  await leave();
  assert.deepEqual(writes, [['set', A]], 'a bullet left right after the last letter still gets its sure value');
  assert.equal(arrows().length, 1);
  // A link typed and the bullet left at once: the proposal never showed, and its sure value is written all the same.
  const plain = U(403), plainRow = hostDoc.createElement('div'); plainRow.innerHTML = rowHtml(plain);
  hostDoc.querySelector('#main-content-container').append(plainRow.firstElementChild);
  saved.set(plain, block('Plain words', { 'db/id': 413, 'block/uuid': plain })); box(plain).value = 'Plain words';
  await enter(plain); const gone = writes.length;
  assert.ok(!hostDoc.querySelector(`[blockid="${plain}"] .flow-ghost`), 'nothing pencilled yet');
  box(plain).value = 'Plain words [[Ruth Okoro]]'; saved.get(plain)['block/title'] = `Plain words [[${U(21)}]]`;
  box(plain).dispatchEvent(new page.window.Event('input', { bubbles: true }));
  await leave();
  assert.deepEqual(writes.slice(gone), [['set', plain]], 'a sure value never shown is written on leaving');
  // Passing through at once writes nothing, even within the pause.
  box(B).focus(); box(B).blur(); await wait(350);
  assert.deepEqual(writes.slice(gone), [['set', plain]], 'a bullet passed through within the pause is left alone');
  writes.splice(gone);
  console.log('  ok  a proposal waits for a pause, and leaving within it loses nothing');
  await enter(B); await type(B, ' again'); await leave();
  assert.deepEqual(writes, [['set', A], ['set', B]]);
  assert.equal(arrows().length, 1, 'a new change’s arrow takes the last one’s place');
  assert.equal(arrows()[0].closest('.ls-block').getAttribute('blockid'), B, 'and stands on the new bullet');
  arrows()[0].click(); await wait(50);
  assert.deepEqual(writes.at(-1), ['unset', B], 'the arrow takes off its own change');
  assert.ok(saved.get(A)[ident], 'and leaves the other bullet as it was');
  console.log('  ok  one arrow, on the last change, undoing only that change');

  writes.length = 0;
  await enter(B); await type(B, ' more'); await leave();
  assert.deepEqual(writes, [], 'what an Undo took off stays off, even after more words');
  assert.ok(!hostDoc.querySelector(`[blockid="${B}"] .flow-ghost`), 'and its pencil with it');
  console.log('  ok  an Undo keeps that bullet quiet');

  await enter(C);
  assert.ok(!hostDoc.querySelector(`[blockid="${C}"] .flow-ghost`), 'back in a bullet whose words are as they were: nothing comes back');
  await type(C, ' again');
  assert.ok(hostDoc.querySelector(`[blockid="${C}"] .flow-ghost`), 'its words changed: the proposals come');
  box(C).dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await leave();
  assert.deepEqual(writes, [['set', C]], 'Enter takes what is shown');
  console.log('  ok  nothing comes back on an unchanged bullet; Enter still takes everything shown');
  // A value set by hand while the guess was on screen is the person's (8 November 2026): taken or not, the guess writes nothing over it.
  { writes.length = 0;
    const own = U(404), ownRow = hostDoc.createElement('div'); ownRow.innerHTML = rowHtml(own);
    hostDoc.querySelector('#main-content-container').append(ownRow.firstElementChild);
    saved.set(own, block('Saw nobody', { 'db/id': 414, 'block/uuid': own })); box(own).value = 'Saw nobody';
    await enter(own);
    box(own).value = 'Saw nobody [[Ruth Okoro]]'; saved.get(own)['block/title'] = `Saw nobody [[${U(21)}]]`;
    box(own).dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(320);
    assert.ok(hostDoc.querySelector(`[blockid="${own}"] .flow-ghost`), 'the guess is on screen');
    saved.get(own)[ident] = [{ 'db/id': 20 }];   // Doctor set by hand meanwhile, in Logseq's own property row
    box(own).dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await leave();
    assert.deepEqual(writes, [], 'a value set by hand is not written over: ' + JSON.stringify(writes));
    assert.deepEqual(saved.get(own)[ident], [{ 'db/id': 20 }]);
    console.log('  ok  a guess never writes over a value set by hand'); }

  // Down is Logseq's, also at the very end of a bullet that has properties.
  const row = hostDoc.querySelector(`[blockid="${A}"]`), under = hostDoc.createElement('div');
  under.className = 'positioned-properties block-below';
  under.innerHTML = '<div class="bottom-property-pill"><span>Doctor:</span><button class="empty-value">Empty</button></div>';
  row.append(under);
  box(A).focus(); box(A).setSelectionRange(box(A).value.length, box(A).value.length);
  const down = new page.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  box(A).addEventListener('keydown', Flow.steps.onPickKey);
  box(A).dispatchEvent(down);
  assert.ok(!down.defaultPrevented && !Flow.steps.picking.uuid, 'Down at the end of the words is left to Logseq');
  console.log('  ok  Down is left to Logseq');

  // A suggestion passed over saves nothing while writing: the link memory waits for the bullet to be left, once a minute at most.
  await Flow.linkUi.start();
  const saves = [];
  logseq.updateSettings = values => saves.push(Object.keys(values));
  logseq.settings.linkSuggestPause = 0;
  const offer = async uuid => { const b = box(uuid); b.value = 'Dr. Mei'; b.focus(); b.setSelectionRange(7, 7); b.dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(60); assert.ok(Flow.linkUi.suggestState(), 'the rest of the name is offered'); b.value = 'Dr. Meiz'; b.setSelectionRange(8, 8); b.dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(700); };
  // Escape lets go one step at a time: the grey words alone; the next listeners (the proposals, Logseq) see the next press.
  { const pressed = () => { const down = new page.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); box(A).dispatchEvent(down); return down; };
    let after = 0; const count = () => { after++; }; page.window.addEventListener('keydown', count, true);
    { const b = box(A); b.value = 'Dr. Mei'; b.focus(); b.setSelectionRange(7, 7); b.dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(60); assert.ok(Flow.linkUi.suggestState(), 'grey words offered'); }
    assert.ok(pressed().defaultPrevented && !Flow.linkUi.suggestState(), 'the first Escape takes the grey words'); assert.equal(after, 0, 'and nothing else');
    pressed(); assert.equal(after, 1, 'the second is the next listener\'s'); page.window.removeEventListener('keydown', count, true);
    box(A).value = ''; box(A).dispatchEvent(new page.window.Event('input', { bubbles: true })); await wait(20); const main = fs.readFileSync(path.join(root, 'predictive/main.js'), 'utf8');
    assert.ok(main.indexOf('Flow.linkUi.start()') < main.indexOf('Flow.proposeUi.start()'), 'the grey words look at the key before the proposals'); }
  await offer(A);
  assert.deepEqual(saves.filter(k => k.includes('linkSuggestMemory')), [], 'passing a suggestion over saves no setting while writing');
  box(A).blur(); await wait(20);
  assert.deepEqual(saves, [['linkSuggestMemory']], 'leaving the bullet saves it');
  await offer(B); box(B).blur(); await wait(20);
  assert.equal(saves.length, 1, 'and the next bullet left within the minute does not');
  console.log('  ok  the link memory is saved on leaving a bullet, once a minute at most');
  { const { finds, citation } = Flow.cite, source = (title, pdf) => ({ uuid: title, title, lower: title.toLowerCase(), pdf });
    const all = [source('A CT report', false), source('CT report', false), source('Report on CT', true), source('CT scan (pdf)', true), source('Fatigue', false)];
    assert.equal(finds(all, 'ct').map(s => s.title).join(' | '), 'CT scan (pdf) | CT report | Report on CT | A CT report', 'a name that starts with the words first, a PDF before a page');
    assert.equal(finds(all, '').length, 0, 'nothing typed finds nothing');
    assert.equal(finds(all, 'report ct').map(s => s.title).sort().join(' | '), 'A CT report | CT report | Report on CT', 'every word typed must be in the name');
    assert.equal(citation('u', '3'), '([[u]], p. 3)'); assert.equal(citation('u', ''), '([[u]])');
    { const { offer, wording } = Flow.cite;
      assert.equal(wording(offer('https://www.nih.gov/news', []), ''), '([nih.gov](https://www.nih.gov/news))', 'a web address, named by its site');
      assert.equal(wording(offer('www.nih.gov', []), ''), '([nih.gov](https://www.nih.gov))');
      assert.equal(wording(offer('Smith 2023', []), '6'), '(*Smith 2023*, p. 6)', 'plain words, with a page');
      assert.equal(offer('  ', []), null); assert.equal(offer('fatigue', [{ lower: 'fatigue' }]), null, 'a name that is listed is not offered again'); }
    assert.ok(slash.includes('Cite'), '/Cite is registered once'); assert.equal(slash.length, 1);
    console.log('  ok  /Cite finds a source and words the citation'); }
  { const { nameIn, canName } = Flow.pageHere;
    assert.equal(nameIn('  Cycle 4 plan '), 'Cycle 4 plan'); assert.equal(nameIn('[[Cycle 4 plan]]'), 'Cycle 4 plan', 'the brackets are not part of the name');
    assert.ok(canName('Cycle 4 plan') && !canName('') && !canName('Saw [[Dr. Mei Chen]] today'), 'a name holds no link');
    console.log('  ok  Cmd-; reads a page\'s name from the bullet');
    // The bullet shows the page by one write, its link to the page, and its words are never written (10 November 2026).
    const wrote = [], E = logseq.Editor, was = { ...E }, ask = Flow.db.dsQuery;
    let link = null;
    Object.assign(E, { exitEditingMode: async () => {}, updateBlock: async (uuid, words) => { wrote.push(['words', uuid, words]); },
      upsertBlockProperty: async (uuid, ident, value) => { wrote.push([ident, uuid, value]); link = value; }, removeBlockProperty: async (uuid, ident) => { wrote.push(['off ' + ident, uuid]); link = null; } });
    Flow.db.dsQuery = async q => /:block\/link/.test(q) ? (link == null ? [] : [[link]]) : ask(q);
    await Flow.pageHere.showPage('u1', { id: 77, title: 'Cycle 4 plan' });
    assert.deepEqual(wrote, [['block/link', 'u1', 77]], 'one write, the link to the page; the words are never touched: ' + JSON.stringify(wrote));
    assert.ok(window.PluginDoor.undo.has('predictive:here:u1'), 'and the faded Undo arrow is offered');
    await window.PluginDoor.undo.take('predictive:here:u1');
    assert.deepEqual(wrote.at(-1), ['off block/link', 'u1'], 'Undo takes the page off the bullet again');
    Object.keys(E).forEach(k => delete E[k]); Object.assign(E, was); Flow.db.dsQuery = ask;
    console.log('  ok  Cmd-; shows a page in the bullet with one write and never touches its words'); }
  { const { plainLinks, carry, keepCase } = Flow.typedCase, M = '1a000000-0000-4000-8000-00000000000e', T = id => id === M ? 'Dr. Mei Chen' : id === U(21) ? 'Ruth Okoro' : '';
    assert.equal(plainLinks('a [[x]] #[[Two Words]] [w]([[y]]) [[z]]').map(l => l.name).join('|'), 'x|z', 'a tag and a link with its own words are not plain links');
    assert.equal(carry(['dr. mei chen'], ['dr. mei chen'], ['Dr. Mei Chen']).join('|'), 'dr. mei chen', 'Logseq\'s list putting in the page\'s capitals keeps what was typed');
    assert.equal(carry(['mei'], ['mei'], ['Dr. Mei Chen']).join('|'), 'Dr. Mei Chen', 'a few letters and a page picked: the page\'s name');
    assert.equal(carry(['a', 'dr. mei chen'], ['a', 'dr. mei chen'], ['', 'a', 'Dr. Mei Chen']).join('|'), '|a|dr. mei chen', 'a link added before keeps the others\' typing');
    assert.equal(keepCase(`Saw [[${M}]] and [[${U(21)}]]`, ['dr. mei chen', 'Ruth Okoro'], T), `Saw [dr. mei chen]([[${M}]]) and [[${U(21)}]]`, 'only the link typed in other capitals gets the words');
    assert.equal(keepCase(`Saw [[${M}]]`, ['DR. MEI CHEN'], T), `Saw [DR. MEI CHEN]([[${M}]])`, 'capitals too');
    assert.equal(keepCase(`Saw [[${M}]]`, ['Dr. Mei Chen'], T), null, 'the page\'s own capitals: nothing changes');
    assert.equal(keepCase(`Saw [[${M}]]`, ['mei'], T), null, 'other letters: nothing changes');
    assert.equal(keepCase(`Saw [[${M}]] #[[${U(21)}]]`, ['dr. mei chen', 'x'], T), null, 'links that do not line up: nothing is guessed');
    assert.equal(keepCase(`Saw [dr. mei chen]([[${M}]]) with [[${M}]]`, ['dr. mei chen'], T), `Saw [dr. mei chen]([[${M}]]) with [dr. mei chen]([[${M}]])`, 'a link with its words already is left as it is');
    const { tagsByName } = Flow.typedCase, names = id => ({ a: 'Consultation', b: 'Symptom Log', c: 'Dr. Who' })[id[0]];
    assert.equal(tagsByName(`x #[[${'a'.repeat(8)}-0000-4000-8000-000000000000]] #[[${'b'.repeat(8)}-0000-4000-8000-000000000000]] #[[${'c'.repeat(8)}-0000-4000-8000-000000000000]] [[${M}]]`, names),
      `x #Consultation #[[Symptom Log]] #[[Dr. Who]] [[${M}]]`, 'tags handed to Logseq by name, as the text box shows them; a plain link stays by id');
    assert.equal(tagsByName(`x #[[${'d'.repeat(8)}-0000-4000-8000-000000000000]]`, names), null, 'a tag whose name is not known: nothing written');
    const { written } = Flow.typedCase;
    assert.equal(written('dr. mei', 'Dr. Mei Chen'), 'dr. mei chen', 'a suggested link taken after small letters: small letters');
    assert.equal(written('DR. MEI', 'Dr. Mei Chen'), 'DR. MEI CHEN', 'after capitals: capitals');
    assert.equal(written('dr. Mei', 'Dr. Mei Chen'), 'dr. Mei Chen', 'after a mix: what was typed, then the page\'s own');
    assert.equal(written('mei', 'Dr. Mei Chen'), 'dr. mei chen', 'words inside the name: the whole name follows them');
    assert.equal(written('Fatig', 'Fatigue'), 'Fatigue', 'the page\'s own capitals typed: the page\'s name');
    const { asTyped } = Flow.typedCase, kept = 'Saw [dr. mei chen]([[Dr. Mei Chen]]) and [my doc]([[Dr. Mei Chen]])', shown = asTyped(kept);
    assert.equal(shown.text, 'Saw [[dr. mei chen]] and [my doc]([[Dr. Mei Chen]])', 'back in the bullet: as typed; a link with other words left as it is');
    assert.equal(shown.at(kept.length), shown.text.length, 'the cursor at the end stays at the end');
    assert.equal(shown.at(6), 7, 'the cursor on a letter of the words stays on it');
    assert.equal(asTyped('Saw [[Dr. Mei Chen]]'), null, 'nothing to show differently');
    console.log('  ok  a link typed in other capitals keeps them'); }
  process.exit(0);
})().catch(error => { console.error('FAIL ', error); process.exit(1); });
