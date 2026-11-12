#!/usr/bin/env node
/* The two-way rows' grouping, the + inside a group and writing into a node (parts/two-way.js) in a pretend
   Logseq window: a page with six nodes pointing at it through one property ("about"), their tags, days and a
   property of their own (Confidence), behind a stand-in for the model's doors that records every write.
   Checks: the plain list when nothing is chosen; groups by a property's value (biggest first, none last, each group
   folding), by tag and by month; the + in a group (not in a month or a "none" group) opening its line in the group and
   making the node with the row's property, the group's tag or value and nothing else; a node's arrow opening its
   bullets, the links in them, a new bullet written into the node (and nothing before Enter), the faded Undo taking it
   away, and the arrow closing it; and nothing left on stop. Also the "mentioned in" row (the nodes whose
   words link the page, a node already in a property's row left out, no +, a mention with no tag offered to be made the
   node its words look like, with Undo, one with a tag offered nothing, the row hidden on the page from its right-click),
   and following a chain from an opened node (a chevron before a value that is another node, that node opened under the
   property with its properties and what points at it, no chevron for a node open above, none three deep, closing
   with the chevron or the node). Needs node and jsdom.
   Run from threads/: node tools/two-way-rows-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const twoWay = require('./two-way-files');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const U = n => `6a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAGE = U(1), JOURNAL = U(900);

// Six nodes point at the page. Confidence: two Strong, two Disputed, two with none (one is a Question).
const NODES = [
  { id: 101, title: 'Spacing beats cramming for recall a week later.', tag: 'Claim', day: 20260901, confidence: ['Strong', 301], severity: 3 },
  { id: 102, title: 'The gap should grow with each review.', tag: 'Claim', day: 20260915, confidence: ['Strong', 301], severity: 3 },
  { id: 103, title: 'Spacing does not help understanding, only recall.', tag: 'Claim', day: 20261001, confidence: ['Disputed', 302], severity: 1 },
  { id: 104, title: 'The best gap is a tenth of the time until the test.', tag: 'Claim', day: 20261010, confidence: ['Disputed', 302], severity: 2 },
  { id: 105, title: 'Does it work for skills?', tag: 'Question', day: 20261012 },
  { id: 106, title: 'What is the best first gap? Nobody knows.', tag: 'Question', day: 0 },
];

function world(grouping) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="main-content-container"><div class="ls-page-title"><div class="is-page-title-row"><h1 class="title">Spaced repetition</h1></div><div class="ls-block" blockid="${PAGE}"></div></div><div class="ls-page-properties"></div></div></body></html>`,
    { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.parent = window;
  const doc = window.document;
  if (!window.CSS) window.CSS = {};
  window.CSS.escape ||= s => String(s).replace(/[^\w-]/g, '\\$&');
  if (grouping) window.localStorage.setItem('refinementTwoWayGroup', JSON.stringify({ about: grouping }));
  window.logseq = { settings: {}, provideStyle() {}, onSettingsChanged: () => () => {}, UI: { showMsg() {} } };
  window.eval(fs.readFileSync(path.join(root, '../plugin.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, '../plugin.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  for (const source of twoWay.sources()) window.eval(source);
  const calls = [], reads = [], changed = [], graphHooks = [], madeNow = new Map(), stampNow = new Map(), recycled = new Set(), notices = [];
  window.logseq.UI.showMsg = text => notices.push(text);
  const bullets = new Map([[U(101), [{ uuid: U(701), title: 'Cepeda reviewed 254 studies.' }, { uuid: U(702), title: 'See [[Testing effect]].' }]]]);
  let nextBlock = 800;
  const provided = {
    currentPage: async () => ({ id: 5, uuid: PAGE }),
    getPage: async () => ({ id: 5, uuid: PAGE }),
    linksInto: async () => (reads.push('rows'), {
      pages: new Map([[5, { uuid: PAGE, byField: new Map([['about', new Set(NODES.map(n => n.id))]]) }]]),
      fields: new Map([['about', { uuid: U(50), ident: 'user.property/about' }]]),
      records: new Map(NODES.map(n => [n.id, { uuid: U(n.id), title: n.title, tag: n.tag, day: n.day }])),
    }),
    readableTitle: async text => text,
    nodeValues: async uuids => new Map(NODES.filter(n => uuids.includes(U(n.id)) && (n.confidence || n.severity)).map(n => [U(n.id), new Map([
      ['about', { ident: 'user.property/about', values: [{ text: 'Spaced repetition', id: 5, uuid: PAGE }] }],
      ...(n.confidence ? [['Confidence', { ident: 'user.property/confidence', values: [{ text: n.confidence[0], id: n.confidence[1], uuid: U(n.confidence[1]) }] }]] : []),
      ...(n.severity ? [['Severity', { ident: 'user.property/severity', values: [{ text: String(n.severity), number: n.severity }] }]] : []),
    ])])),
    propSchema: async () => ({ props: [
      { ident: 'user.property/about', title: 'about', lower: 'about', type: 'node', many: false, choices: [], classes: [] },
      { ident: 'user.property/confidence', title: 'Confidence', lower: 'confidence', type: 'default', many: false, choices: [{ id: 301, title: 'Strong' }, { id: 302, title: 'Disputed' }], classes: [] },
      { ident: 'user.property/severity', title: 'Severity', lower: 'severity', type: 'number', many: false, choices: [], classes: [] },
      { ident: 'user.property/source', title: 'Source', lower: 'source', type: 'node', many: true, choices: [], classes: [{ id: 60 }] },
    ], parentsOf: new Map([[64, [60]]]) }),
    propPages: async () => [{ id: 61, uuid: U(61), title: 'Cepeda 2006', lower: 'cepeda 2006', tags: [{ id: 60 }] }, { id: 64, uuid: U(64), title: 'A child tag’s page', lower: 'a child tag’s page', tags: [{ id: 64 }] }, { id: 62, uuid: U(62), title: 'Rohrer 2015', lower: 'rohrer 2015', tags: [{ id: 60 }] }, { id: 63, uuid: U(63), title: 'Memory techniques', lower: 'memory techniques', tags: [] }],
    aliasesOf: async () => [], madeState: async uuid => madeNow.get(uuid) || 'as made', pageUnlinked: async () => true, valueStamp: async (uuid, ident) => stampNow.get(`${uuid}|${ident}`) || 'as left', inRecycle: async uuid => recycled.has(uuid), restorePage: async uuid => { calls.push(['restorePage', uuid]); recycled.delete(uuid); }, storedWords: async text => text,
    fits: (page, ids, schema) => { const seen = new Set(), queue = page.tags.map(t => t.id); while (queue.length) { const c = queue.shift(); if (seen.has(c)) continue; seen.add(c); if (ids.has(c)) return true; queue.push(...(schema.parentsOf?.get(c) || [])); } return false; },
    pagesAmong: async () => 0,
    tagUuidNamed: async title => `tag-${title.toLowerCase()}`,
    journalIdFor: async () => 900,
    uuidById: async () => JOURNAL,
    // A bullet's own words (a node's first lines); anything else reads as the page's title.
    titleNow: async uuid => { for (const list of bullets.values()) { const b = list.find(line => line.uuid === uuid); if (b) return b.title; } return 'Spaced repetition'; },
    setWords: async (uuid, text) => { calls.push(['setWords', uuid, text]); for (const [node, list] of bullets) bullets.set(node, list.map(b => b.uuid === uuid ? { ...b, title: text } : b)); },
    idByUuid: async () => 5,
    nodeFields: async () => new Map(),
    // A node's own properties: the tag gives about, Confidence, Severity and Source (a link to a source page).
    fieldsOf: async () => (await provided.propSchema()).props,
    valuesOf: async (uuid, ident) => calls.filter(c => c[0] === 'setValue' && c[1] === uuid && c[2] === ident).slice(-1).map(c => JSON.parse(c[3])).flat().filter(v => typeof v === 'number').concat(ident === 'user.property/confidence' && !calls.some(c => c[1] === uuid && c[2] === ident) ? (NODES.find(n => U(n.id) === uuid)?.confidence ? [NODES.find(n => U(n.id) === uuid).confidence[1]] : []) : []),
    firstLines: async uuid => (bullets.get(uuid) || []).slice(0, 9),
    appendBlock: async (target, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['appendBlock', target, text, block.uuid]); return block; },
    addLineTo: async (uuid, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['addLineTo', uuid, text, block.uuid]); bullets.set(uuid, [...(bullets.get(uuid) || []), { uuid: block.uuid, title: text }]); return block; },
    insertBlock: async (uuid, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['insertBlock', uuid, text, block.uuid]); for (const [node, list] of bullets) { const i = list.findIndex(b => b.uuid === uuid); if (i >= 0) bullets.set(node, [...list.slice(0, i + 1), { uuid: block.uuid, title: text }, ...list.slice(i + 1)]); } return block; },
    removeBlock: async uuid => { calls.push(['removeBlock', uuid]); for (const [node, list] of bullets) bullets.set(node, list.filter(b => b.uuid !== uuid)); },
    addTag: async (uuid, tag) => { calls.push(['addTag', uuid, tag]); },
    setValue: async (uuid, ident, value, opts) => { calls.push(['setValue', uuid, ident, JSON.stringify(value), JSON.stringify(opts || null)]); },
    unsetValue: async () => {},
    STATUS_IDENT: 'logseq.property/status',
    removeTag: async () => {}, createPage: async () => ({ uuid: U(++nextBlock) }), deletePage: async () => {}, editBlock: async () => {},
  };
  const early = [], saved = [];
  window.Threads.core = {
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, isEntityId: n => Number.isSafeInteger(n) && n > 0,
    watchDomEarly: fn => early.push(fn), addsElements: () => true, sendStyle() {}, uuidsIn: () => '', saveSettings(changes) { saved.push(changes); Object.assign(window.logseq.settings, changes); },
    onPageChange() {}, onDatabaseChange(fn) { changed.push(fn); }, onSettingsChange() {}, onGraphChange(fn) { graphHooks.push(fn); }, provided,
    provide(things) { Object.assign(provided, things); },
  };
  const part = window.Threads.parts.find(p => p.name === 'two-way');
  part.start();
  return { window, doc, calls, part, bullets, saved, reads, changed, provided, graphHooks, madeNow, stampNow, recycled, notices };
}
const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
// The bar's More (5 November 2026): every action but Open in sidebar sits in it. Opens it and gives its items.
const moreItems = async (window, doc) => { doc.querySelectorAll('.th-pop').forEach(p => p.remove()); click(window, doc.querySelector('.th-tw-bar [data-act="more"]')); await new Promise(r => setTimeout(r, 40)); return [...doc.querySelectorAll('.th-pop .th-item')]; };
const moreItem = async (window, doc, re) => (await moreItems(window, doc)).find(el => re.test(el.textContent.trim()));
// A list's View (8 November 2026): a parent item in the list's right-click menu, its options to the side. field: the row's, else the first list of two or more.
const openView = async (window, doc, field) => {
  doc.querySelectorAll('.th-pop').forEach(p => p.remove());
  const row = field == null ? [...doc.querySelectorAll('.th-tw-row')].find(r => r.querySelector('.th-tw-head')) : doc.querySelector(`.th-tw-row[data-field="${field}"]`);
  row.querySelector('.th-tw-name').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 40));
  click(window, [...doc.querySelectorAll('.th-pop .th-item')].find(el => el.textContent.trim() === 'View'));
  await new Promise(r => setTimeout(r, 60));
  return [...doc.querySelectorAll('.th-pop.th-side .th-item')];
};
// Picking is turned on from a list's View (the owner, 7 November 2026): the tick boxes are drawn only then.
const startPicking = async (window, doc, field) => {
  click(window, (await openView(window, doc, field)).find(el => /Pick nodes/.test(el.textContent)));
  await new Promise(r => setTimeout(r, 40));
};
const type = (window, input, text) => { input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
const enter = (window, input) => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
// The outline: a node's chevron by its uuid (inside: under the node of that uuid), what an open node holds.
const parentOf = key => key.split('>').slice(0, -1).join('>');
// A node's empty properties draw nothing until something opens them (8 November 2026; a list's "no Topic?" does): opened here as that does.
const openEmpties = (window, doc, uuid) => { const tw = window.Threads.parts.find(p => p.name === 'two-way').inner; for (const c of doc.querySelectorAll(`.th-chev[data-dig][data-uuid="${uuid}"]`)) tw.state.emptyOpen.add(c.dataset.dig); tw.state.html = null; tw.draw(doc); };
const chevOf = (doc, uuid, inside) => [...doc.querySelectorAll(`.th-chev[data-dig][data-uuid="${uuid}"]`)].find(c => !inside || parentOf(c.dataset.dig).endsWith(inside));
const kidsOf = (doc, uuid) => [...doc.querySelectorAll('.th-ol-kids[data-key]')].find(k => k.dataset.key.endsWith('>' + uuid));
const isOpenChev = c => c?.getAttribute('aria-expanded') === 'true';
const names = doc => [...doc.querySelectorAll('.th-tw-gname')].map(el => el.textContent.trim());
const counts = doc => [...doc.querySelectorAll('.th-tw-gn')].map(el => el.textContent.trim());
const groupEl = (doc, name) => [...doc.querySelectorAll('.th-tw-group')].find(g => g.querySelector('.th-tw-gname')?.textContent.trim() === name);

(async () => {
  // Rules on names: a tag of any spelling, and a name that is not cut at an initial or an hour.
  {
    const source = twoWay.text();
    const { plural, shortName } = new Function(source.match(/^const plural = .*$/m)[0] + '\n' + source.match(/^const NAME_ROOM = .*$/m)[0] + '\n' + source.match(/^function shortName[\s\S]*?^}$/m)[0] + '\nreturn { plural, shortName };')();
    check(plural('Diagnosis', 2) === 'Diagnoses' && plural('Metastasis', 2) === 'Metastases', 'a word in -sis should turn to -ses: ' + plural('Diagnosis', 2));
    check(plural('Measles', 2) === 'Measles' && plural('Series', 2) === 'Series', 'a word that ends in s stays: ' + plural('Measles', 2));
    check(plural('Study', 2) === 'Studies' && plural('Doctor', 2) === 'Doctors' && plural('Virus', 2) === 'Viruses' && plural('Doctor', 1) === 'Doctor', 'regular plurals stay');
    check(shortName('Seen by J. Smith at noon') === 'Seen by J. Smith at noon', 'an initial is no end: ' + shortName('Seen by J. Smith at noon'));
    check(shortName('Clinic at 3 p.m. with Dr. Lee') === 'Clinic at 3 p.m. with Dr. Lee', 'an hour is no end: ' + shortName('Clinic at 3 p.m. with Dr. Lee'));
    check(shortName('Clinic. Blood pressure high, new tablets') === 'Clinic. Blood pressure high, new tablets', 'a full stop ends no name: ' + shortName('Clinic. Blood pressure high, new tablets'));
    const long = shortName('Clinic. ' + 'the words go on and on '.repeat(5));
    check(long.length <= 61 && long.endsWith('…') && !/\s…$/.test(long), 'a long name is cut at a width, between words: ' + long);
  }
  // Thousands of values: a few, then "show all"; the lit row moves without drawing a row again; typing narrows.
  {
    const { window, doc, part } = world('');
    await wait(100);
    const shared = window.Threads.shared;
    const options = Array.from({ length: 300 }, (_, i) => ({ label: `Page ${i + 1}` }));
    const picked = shared.pickValue({ at: doc.body, options, doc });
    await wait(10);
    const rows = () => [...doc.querySelectorAll('.th-lsq-pop .menu-link')], box = doc.querySelector('.th-lsq-pop input');
    const press = key => box.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    check(rows().length === 41 && rows().at(-1).textContent.trim() === 'show all 300', 'a long list should show a few, then show all: ' + rows().length);
    const first = rows()[0];
    press('ArrowDown');
    check(first.isConnected && !first.classList.contains('chosen') && rows()[1].classList.contains('chosen'), 'an arrow should move the lit mark and draw no row again');
    rows()[5].dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }));
    check(first.isConnected && rows()[5].classList.contains('chosen') && !rows()[1].classList.contains('chosen'), 'the pointer should too');
    rows().at(-1).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    check(rows().length === 300 && doc.querySelector('.th-lsq-pop'), '"show all" should list them all and keep the list open');
    box.value = 'page 29'; box.dispatchEvent(new window.Event('input', { bubbles: true }));
    check(rows().length === 11 && rows()[0].textContent.trim() === 'Page 29', 'typing should narrow it: ' + rows().length);
    press('Enter');
    check((await picked)?.label === 'Page 29', 'Enter takes the lit one');
    part.stop();
  }
  // Writing reads only what it reaches; a look reads none of the earlier lines.
  {
    const { window, doc, part, reads, changed, provided } = world('');
    let learned = 0;
    provided.nodeProposals = async () => { learned++; return []; };
    await wait(100);
    const fire = (blocks, op = 'save-block') => changed.forEach(fn => fn({ blocks, txMeta: { outlinerOp: op } }));
    reads.length = 0;
    fire([{ uuid: U(700), id: 700, title: 'Words elsewhere', page: { id: 9 } }]);
    await wait(1000);
    check(reads.length === 0, 'words written elsewhere should read nothing: ' + reads);
    fire([{ uuid: U(101), id: 101, title: 'A row’s own words', page: { id: 9 } }]);
    await wait(1000);
    check(reads.length > 0, 'words in a row’s node should read the rows');
    reads.length = 0;
    fire([{ uuid: U(701), id: 701, rawTitle: `Links [[${PAGE}]]`, page: { id: 9 } }]);
    await wait(1000);
    check(reads.length > 0, 'a new line that links this page should read the rows');
    reads.length = 0;
    fire([{ uuid: U(702), id: 702, title: 'A value set', page: { id: 9 } }], 'set-block-property');
    await wait(1000);
    check(reads.length > 0, 'anything but writing should read the rows');
    // An untagged mention asks what it looks like only once the earlier lines are read, or after a quiet moment.
    let guessed = 0;
    provided.tagGuess = async () => { guessed++; return null; };
    provided.mentionsInto = async () => [{ id: 201, uuid: U(201), title: 'Named here', tag: '', day: 20260803 }];
    fire([{ uuid: U(703), id: 703, title: 'x', page: { id: 9 } }], 'set-block-property');
    await wait(1000);
    check(guessed === 0, 'a look at a page should not read the earlier lines for its mentions');
    provided.earlierLinesRead = () => true;
    fire([{ uuid: U(703), id: 703, title: 'x', page: { id: 9 } }], 'set-block-property');
    await wait(1000);
    check(guessed === 1, 'once they are read, a mention asks at once: ' + guessed);
    const chev = doc.querySelector('.th-chev[data-dig]');
    chev.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
    await wait(30);
    check(learned === 0, 'the pointer passing over a fold arrow should not read the earlier lines');
    click(window, chev);
    await wait(60);
    check(doc.querySelector('.th-ol-kids[data-key]') && learned >= 0, 'a click opens the node');
    part.stop();
  }
  // The audit's two broken things (10 November 2026). A node with nothing more to show than its line (only the way back
  // here, nothing linking to it, no bullets) offers no fold arrow once read, and a press on its arrow before it is read
  // opens nothing; a node with bullets still opens. And "same as the next?" is gone: a doctor's page and a consultation
  // naming her, on one day, carry no offer to join.
  {
    const { window, doc, part, provided } = world('');
    const bare = U(105), blank = U(104), idBy = provided.idByUuid, fieldsBy = provided.fieldsOf;
    provided.idByUuid = async uuid => uuid === bare || uuid === blank ? 0 : idBy(uuid);
    const valuesBy = provided.nodeValues;
    provided.nodeValues = async (uuids, opts) => { const got = await valuesBy(uuids, opts); for (const u of [bare, blank]) if (uuids.includes(u)) got.set(u, new Map([['about', { ident: 'user.property/about', values: [{ text: 'Spaced repetition', id: 5, uuid: PAGE }] }]])); return got; };
    provided.fieldsOf = async (uuid, schema) => uuid === bare ? (await fieldsBy(uuid, schema)).filter(p => p.title === 'about') : uuid === blank ? (await fieldsBy(uuid, schema)).filter(p => p.title === 'about' || p.title === 'Source') : fieldsBy(uuid, schema);
    await wait(120);
    const tw = window.Threads.parts.find(p => p.name === 'two-way').inner;
    check(!!chevOf(doc, bare), 'an unread node should offer its arrow');
    click(window, chevOf(doc, bare));
    await wait(80);
    check(!kidsOf(doc, bare) && !chevOf(doc, bare), 'a press on a node with nothing more to show should open nothing, and its arrow go');
    check(!!doc.querySelector(`.th-tw-line[data-uuid="${bare}"] .th-chev-room`), 'the line keeps the arrow’s room, so its dot and name stay in place');
    tw.state.node.delete(bare); tw.state.html = null; tw.draw(doc);
    await wait(60);
    const c = chevOf(doc, bare);
    check(!!c, 'unread again, the node should offer its arrow again');
    c.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
    await wait(60);
    check(!c.isConnected && !chevOf(doc, bare), 'the pointer coming to the arrow of a node with nothing more should take the arrow away');
    // A node with an empty property, read by a look: a proposal might fill it, so its arrow stays; pressed, it is read whole
    // first, and no empty box is drawn on the way.
    const b = chevOf(doc, blank);
    b.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
    await wait(60);
    check(b.isConnected, 'a node whose empty property a proposal might fill keeps its arrow after a look');
    let boxes = 0;
    const seen = new window.MutationObserver(() => { if (kidsOf(doc, blank)) boxes++; });
    seen.observe(doc.body, { childList: true, subtree: true });
    click(window, chevOf(doc, blank));
    await wait(120);
    seen.disconnect();
    check(boxes === 0 && !kidsOf(doc, blank) && !chevOf(doc, blank), 'pressed, with nothing proposed, it opens nothing at any moment and its arrow goes: ' + boxes);
    click(window, chevOf(doc, U(101)));
    await wait(80);
    check(!!kidsOf(doc, U(101))?.querySelector('[data-bullet]'), 'a node with bullets should still open');
    const twins = { name: 'about', items: [{ uuid: U(101), title: 'Dr. Mei Chen', day: 20261023 }, { uuid: U(102), title: 'Spoke with Dr. Mei Chen about the fatigue', day: 20261023 }] };
    check(tw.tailHooks.every(h => !/same as the next/.test(String(h(twins, twins.items[0]) || ''))) && !doc.querySelector('[data-twin]'), '"same as the next?" should be gone');
    part.stop();
  }
  // 1. Nothing chosen: the list as it was, with the quiet word to group it by.
  {
    const { window, doc, part } = world('');
    await wait(120);
    check(!!doc.querySelector('.th-two-way .th-tw-row'), 'the rows should be drawn');
    check(!doc.querySelector('.th-tw-group'), 'with no grouping chosen the list should not be in groups');
    check(doc.querySelectorAll('.th-tw-line').length === 5 && !!doc.querySelector('[data-more]'), 'the plain list should show five lines and "show all"');
    check(!!doc.querySelector('.th-tw-head .th-tw-groupby .ti-dots') && !doc.querySelector('.th-tw-said'), 'the heading ends in one ⋯ and says nothing of the view while nothing is changed (the owner, 10 November 2026: 2 of heads.html)');
    { const head = doc.querySelector('.th-tw-head .th-ol-body'), kids = [...head.children]; check(kids.indexOf(head.querySelector('.th-tw-groupby')) === kids.length - 1, 'the ⋯ is the last thing on the heading, after the +'); }
    { const side = await openView(window, doc);
      check(side.some(el => /Pick nodes/.test(el.textContent)) && doc.querySelector('.th-pop.th-side')?.parentElement?.classList.contains('th-pop'), 'View in the right-click opens its options to the side, inside the menu: ' + side.map(el => el.textContent.trim()));
      doc.querySelector('.th-pop.th-side').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); await wait(20);
      check(!doc.querySelector('.th-pop.th-side') && !!doc.querySelector('.th-pop'), '← closes the options to the side and keeps the menu');
      doc.querySelector('.th-pop').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(20);
      check(!doc.querySelector('.th-pop'), 'Escape closes the menu'); }
    { doc.querySelector('.th-tw-head .th-tw-groupby').click(); await wait(40);
      const rows = [...doc.querySelectorAll('.th-pop .th-item')].map(el => el.textContent.trim());
      check(rows.some(t => /^Group by\s*Nothing$/.test(t)) && rows.some(t => /^Date\s*Date or journal$/.test(t)) && rows.some(t => /^Sort by\s*Day$/.test(t)) && rows.some(t => /Pick nodes/.test(t)), 'the ⋯ opens a short list, each setting with its value beside it: ' + rows.join(' | '));
      doc.querySelector('.th-pop').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(20); }
    // The whole section folds under its line (8 November 2026), kept for the page, and opens again.
    click(window, doc.querySelector('.th-tw-whole-name')); await wait(40);
    check(!doc.querySelector('.th-two-way .th-tw-row') && doc.querySelector('.th-tw-whole .th-chev')?.getAttribute('aria-expanded') === 'false', 'folded, only the section\'s line stands');
    click(window, doc.querySelector('.th-tw-whole .th-chev')); await wait(40);
    check(!!doc.querySelector('.th-two-way .th-tw-row') && doc.querySelector('.th-tw-whole .th-chev')?.getAttribute('aria-expanded') === 'true', 'its arrow opens it again');
    check(doc.querySelectorAll('.th-tw-line .th-chev[data-dig]').length === 5, 'every line should have its chevron, right before its name');
    // Each node a bullet, as Logseq draws one: the chevron, the dot, the day's column (where the list has days), the name.
    check([...doc.querySelectorAll('.th-tw-line')].every(l => l.querySelector(':is(.th-chev + .th-ol-dot + .th-ol-day + .th-ol-body, .th-chev + .th-ol-dot + .th-ol-body) > .th-ol-name')), 'each line should read chevron, dot, day, name');
    // The tags' words on the line by the chevron: All folds and unfolds; a tag shows only its nodes, without the tag on each line.
    const chip = tag => doc.querySelector(`.th-tw-value .th-tw-chip[data-tag="${tag}"]`);
    const row = () => doc.querySelector('.th-tw-row[data-open], .th-tw-row:has(.th-tw-chip)');
    const tagsShown = () => [...doc.querySelectorAll('.th-tw-line .th-tw-tag')].map(el => el.textContent.trim()).filter(Boolean);
    check(!!chip('') && !!chip('Claim') && tagsShown().length === 5, 'with two tags, the words by the chevron and a tag on every line: ' + tagsShown());
    click(window, chip('')); await wait(20);
    check(!row()?.hasAttribute('data-open') && !doc.querySelector('.th-tw-line'), 'a click on All should fold the list');
    click(window, chip('')); await wait(20);
    check(row()?.hasAttribute('data-open') && doc.querySelectorAll('.th-tw-line').length === 5, 'a second click on All should open it again');
    click(window, chip('Claim')); await wait(20);
    check(doc.querySelectorAll('.th-tw-line').length > 0 && tagsShown().length === 0, 'with one tag picked the lines should leave the tag out: ' + tagsShown());
    //: in the tag's place, the property telling them apart: Confidence (held by all four Claims, two values).
    const tells = () => [...doc.querySelectorAll('.th-tw-line .th-tw-tell')].map(el => el.textContent.trim());
    check(tells().length === 4 && tells().every(t => t === 'Confidence Strong' || t === 'Confidence Disputed'), 'with one tag picked each line should say its Confidence, named: ' + tells());
    click(window, chip('')); await wait(20);
    check(row()?.hasAttribute('data-open') && tagsShown().length === 5, 'All with a tag picked should show every node again, still open');
    check(tells().length === 0, 'with two tags on the lines no property should stand in for them: ' + tells());
    check([...doc.querySelectorAll('.th-tw-line')].every(l => !l.querySelector('.th-ol-name ~ .th-ol-day, .th-tw-after')), 'a day should never follow a name');
    // The order is gone: the right-click offers no Date first or Name first.
    row().querySelector('.th-tw-name').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const menu = [...doc.querySelectorAll('.th-pop .th-item')].map(el => el.textContent.trim());
    check(menu.length > 0 && !menu.some(t => /Date first|Name first/.test(t)), 'the right-click should offer no Date first or Name first: ' + menu);
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
    part.stop(); await wait(10);
    check(!doc.querySelector('.th-two-way'), 'nothing should be left on stop');
  }
  // 2. Grouped by Confidence: biggest first, the two with none last, the + in a group but not in "none".
  {
    const { window, doc, calls, part } = world('p:Confidence');
    await wait(150);
    check(doc.querySelector('.th-tw-said')?.textContent.trim() === 'By Confidence', 'the heading should say what it is grouped by, a setting not the default: ' + doc.querySelector('.th-tw-said')?.textContent);
    check(names(doc).join() === 'Disputed,Strong,No Confidence', 'groups should be Disputed, Strong (two each, by name) then No Confidence: ' + names(doc));
    check(counts(doc).join() === '2,2,2', 'each group should say how many: ' + counts(doc));
    check(groupEl(doc, 'Strong')?.querySelectorAll('.th-tw-line').length === 2, 'a group should list its nodes');
    check(!!groupEl(doc, 'Disputed')?.querySelector('.th-tw-gadd') && !groupEl(doc, 'No Confidence')?.querySelector('.th-tw-gadd'), 'a + in a group with a value, none in the group of those with none');
    // Folding: the arrow, never the words.
    click(window, groupEl(doc, 'Strong').querySelector('.th-tw-gname'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.th-tw-line').length === 2, 'a click on a group’s words should not fold it');
    check(!doc.querySelector('.th-tw-ghead a:not(.th-tag)'), 'a group’s words should not be a link');
    click(window, groupEl(doc, 'Strong').querySelector('.th-chev[data-gkey]'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.th-tw-line').length === 0 && !groupEl(doc, 'Strong').hasAttribute('data-open'), 'a click on a group’s arrow should fold it');
    click(window, groupEl(doc, 'Strong').querySelector('.th-chev[data-gkey]'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.th-tw-line').length === 2, 'and open it again');
    // The + in Disputed: the line opens in the group; Enter makes the node with the tag, about and Confidence.
    click(window, groupEl(doc, 'Disputed').querySelector('.th-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Disputed').querySelector('.th-tw-draft-name');
    check(!!field && doc.querySelectorAll('.th-tw-draft').length === 1, 'the line to type in should open inside the group');
    check(calls.length === 0, 'nothing should be written before Enter');
    type(window, field, 'Spacing fails when the items look alike');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(made && made[1] === JOURNAL && made[2] === 'Spacing fails when the items look alike', 'the node should be made in today’s journal with the typed words: ' + JSON.stringify(calls));
    const uuid = made?.[3];
    check(calls.some(c => c[0] === 'addTag' && c[1] === uuid && c[2] === 'tag-claim'), 'it should get the row’s commonest tag');
    check(calls.some(c => c[0] === 'setValue' && c[1] === uuid && c[2] === 'user.property/about' && c[3] === '5'), 'its property should point at this page');
    check(calls.some(c => c[0] === 'setValue' && c[1] === uuid && c[2] === 'user.property/confidence' && c[3] === '302' && /entityId/.test(c[4])), 'its Confidence should be the group’s value, Disputed: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    // The line stays open for the next one: empty, in the same group, with the keyboard in it; a second node
    // gets the group's value too.
    const next = groupEl(doc, 'Disputed')?.querySelector('.th-tw-draft-name');
    check(!!next && next.value === '' && doc.activeElement === next && doc.querySelectorAll('.th-tw-draft').length === 1, 'the line should stay open, empty, in the group, ready to type: ' + (next ? JSON.stringify(next.value) : 'none'));
    type(window, next, 'Spacing helps little with maths');
    enter(window, next);
    await wait(80);
    const second = calls.filter(c => c[0] === 'appendBlock')[1];
    check(second && second[2] === 'Spacing helps little with maths' && calls.some(c => c[0] === 'setValue' && c[1] === second[3] && c[2] === 'user.property/confidence' && c[3] === '302'), 'a second node from the line left open should get the group’s value too: ' + JSON.stringify(calls.filter(c => c[1] === second?.[3])));
    next.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(20);
    check(!doc.querySelector('.th-tw-draft'), 'Escape on the empty line should close it');
    check(!!doc.querySelector('.lk-undo[data-lk-undo]'), 'the faded Undo arrow should be offered');
    part.stop();
  }
  // 3. Grouped by tag: the + gives the group's tag and sets no other value.
  {
    const { window, doc, calls, part } = world('tag');
    await wait(120);
    check(names(doc).join() === 'Claim,Question', 'groups by tag, biggest first: ' + names(doc));
    check(!!doc.querySelector('.th-tw-group a.th-tag.th-tw-gname[data-tag-page="Question"]'), 'a tag should read as a tag in its group’s name, and open its page');
    click(window, groupEl(doc, 'Question').querySelector('.th-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Question').querySelector('.th-tw-draft-name');
    type(window, field, 'Does it need sleep?');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(calls.some(c => c[0] === 'addTag' && c[1] === made?.[3] && c[2] === 'tag-question'), 'a node made in the Question group should be tagged Question: ' + JSON.stringify(calls));
    check(calls.filter(c => c[0] === 'setValue').length === 1, 'and only the row’s property set: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // 4. Grouped by month: newest first, those with no day last, no + (a month is not a value to set).
  {
    const { doc, part } = world('month');
    await wait(120);
    check(names(doc).join() === 'October 2026,September 2026,No date', 'groups by month, newest first: ' + names(doc));
    check(counts(doc).join() === '3,2,1' && !doc.querySelector('.th-tw-gadd'), 'with their counts and no +: ' + counts(doc));
    part.stop();
  }
  // 4b. Grouped by a number: a scale in order (not biggest first), named with its property; the + writes the number itself.
  {
    const { window, doc, calls, part } = world('p:Severity');
    await wait(150);
    check(names(doc).join() === 'Severity 1,Severity 2,Severity 3,No Severity', 'numbers should be in order, named with their property: ' + names(doc));
    check(counts(doc).join() === '1,1,2,2', 'with their counts: ' + counts(doc));
    click(window, groupEl(doc, 'Severity 3').querySelector('.th-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Severity 3').querySelector('.th-tw-draft-name');
    type(window, field, 'Spacing needs sleep');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(calls.some(c => c[0] === 'setValue' && c[1] === made?.[3] && c[2] === 'user.property/severity' && c[3] === '3' && c[4] === 'null'), 'a number should be written as the number: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // The moves and the head (the review, 31 October): what comes late, the bar's room, the card, a head of fifteen kinds.
  {
    const source = twoWay.text(), kit = fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8');
    check(!/data-picking\] \.th-tw-bar \{[^}]*padding-top/.test(source), 'the bar takes no more room when something is ticked');
    check(/couldBeHtml\(item\)\}\$\{(tailHooks\.map\(hook => hook\(group, item\) \|\| ''\)\.join\(''\)\}\$\{)?(O\.from\(day\)\}\$\{)?tell/.test(source) && !/th-tw-crumb">[^`]*couldBeHtml/.test(source), 'what a mention could be stands on its own line, so coming late moves nothing');
    check(/\.th-tw-head \.th-tw-sep \{ display: none; \}/.test(source) && /\.th-tw-head \.th-tw-chips \{[^}]*overflow: hidden/.test(source), 'space alone between the head\'s pieces, no hairline (the audit\'s 33), a line\'s start clipped');
    check(/\.th-tw-head > \.th-ol-body \{ display: flex; align-items: baseline;/.test(source), 'the head does not wrap the + and Group onto a line of their own');
    check(/\.th-ol-body:has\(> \.th-tw-record\) \{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;/.test(source) && /\.th-ol-body > \.th-tw-record \{ display: inline; \}/.test(source), 'a name and its tag run as one text, two lines, then cut');
    check(!/title: item\.title/.test(source.slice(source.indexOf('async function showPeek'))) && !/\bday: item\.day/.test(source.slice(source.indexOf('async function showPeek'))), 'the card leaves out what the row says');
    check(/placePeek\(card\.el, link\)/.test(source), 'the card is placed clear of the rows');
    check(/fits && clear\(under\) \? under : aboveFits && clear\(above\) \? above/.test(source), 'the card goes under the row, or above where under would cover a list\'s head');
    check(/h\.values\.size \* 2 <= h\.nodes/.test(source), 'Group leaves out a property whose values are nearly all different');
    check(/settle\.stood = true; box\.removeAttribute\('data-th-waiting'\)/.test(source) && /!settle\.stood && \(!state\.mentionsOf\.has\(page\) \|\| \(!heights\.has\(page\)/.test(source), 'a first visit waits only until the place stands still and the page is read');
    check(/!listThere \|\| !state\.mentionsOf\.has\(page\) \|\| \(!noList && performance\.now\(\) - since < STILL_MS\)/.test(source), 'and until the property list is there: stillness alone can come before it');
    check(/:has\(\.th-two-way\[data-th-waiting\]\) \.ls-page-blocks \{ visibility: hidden; \}/.test(source), 'the page\'s words wait with the rows, so what comes with the reading pushes nothing');
    check(!/querySelectorAll\('\.ls-page-blocks'\)/.test(source), 'the rows stand under the title and the properties, above the page\'s words');
    check(/state\.box\?\.removeAttribute\('data-th-settling'\)/.test(source.slice(source.indexOf('function onRoute'))), 'leaving a page lets go of the easing, or every page after it slides');
    check(/a\.th-ol-name\.lk-node \{ text-decoration-color: transparent !important; \}/.test(source), 'a name in the section has no underline at rest');
    check(!/th-card-day/.test(kit), 'the card has no day of its own');
    const { window, doc, part } = world('');
    await wait(120);
    const line = doc.querySelector('.th-tw-line .th-tw-record');
    check(!line?.hasAttribute('title'), 'the name carries no tip saying the same words');
    { const row = line.closest('.th-tw-line'), blank = new window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 500 });
      row.dispatchEvent(blank);
      check(!blank.defaultPrevented, 'a click on the blank part of a row should do nothing, and the page stays'); }
    check(!/\.th-tw-line \{ cursor: pointer/.test(source), 'and the row should not offer it');
    part.stop();
    // Five kinds in a list: three, then how many more, the days still there; the more is a click, and a kind in force stays named.
    const tags = NODES.map(n => n.tag);
    NODES.forEach(n => { n.tag = ''; });
    { const plain = world(''); await wait(120);
      const lead = plain.doc.querySelector('.th-tw-lead')?.textContent.trim();
      check(/nodes$/.test(lead || ''), 'nodes with no tag should be called nodes: ' + lead);
      plain.part.stop(); }
    NODES.forEach((n, i) => { n.tag = 'Kind' + i; });
    const many = world('');
    await wait(120);
    const words = () => [...many.doc.querySelectorAll('.th-tw-head .th-tw-chip:not(.th-tw-lead)')].map(el => el.textContent.trim());
    const more = () => many.doc.querySelector('.th-tw-head [data-kinds]');
    const head = () => many.doc.querySelector('.th-tw-head').textContent;
    check(words().length === 3 && /^and \d+ more$/.test(more()?.textContent || '') && /(\w{3}\s\d+ to \w{3}\s\d+|on |next )/.test(head()), 'three kinds, "and N more", and the days: ' + head());
    click(many.window, more()); await wait(20);
    check(words().length === NODES.length && !more(), 'a click shows them all: ' + words());
    many.part.stop();
    NODES.forEach((n, i) => { n.tag = tags[i]; });
  }
  // 5. A node's bullets: opened, read, written into, undone, closed.
  {
    const { window, doc, calls, part, bullets } = world('');
    await wait(120);
    const node = U(101);
    const arrow = () => chevOf(doc, node);
    click(window, arrow());
    await wait(80);
    const box = kidsOf(doc, node);
    const bulletWords = () => [...(kidsOf(doc, node)?.querySelectorAll('.th-ol-bullet:not(.th-ol-new) .th-ol-words') || [])].map(el => el.textContent);
    check(!!box && bulletWords().join('|') === 'Cepeda reviewed 254 studies.|See Testing effect.', 'the node’s bullets should show under its line: ' + box?.textContent);
    check(!!box?.querySelector('.th-tw-peek-open.lk-node[data-open-page="Testing effect"]'), 'a link in a bullet should open its page, and read as a link (underlined, the library’s)');
    check(isOpenChev(arrow()), 'the chevron should show it is open');
    check(!!box?.closest('.th-ol-unit.th-ol-focus'), 'the node opened last should be the focus, its line and what it holds on the faint grey');
    check(!!box?.querySelector('.th-ol-new .th-ol-dot') && !box?.querySelector('.th-field-inline'), 'a bullet should be written as a bullet: a faint dot, no field with a line under it');
    check(calls.length === 0, 'opening should write nothing');
    const field = doc.querySelector(`.th-tw-node-field[data-uuid="${node}"]`);
    type(window, field, 'Check the anatomy course.');
    check(calls.length === 0, 'typing should write nothing until Enter');
    enter(window, field);
    await wait(100);
    check(calls.some(c => c[0] === 'addLineTo' && c[1] === node && c[2] === 'Check the anatomy course.'), 'Enter should write the bullet into the node: ' + JSON.stringify(calls));
    check(bulletWords().length === 3, 'the new bullet should show in the list');
    check(doc.querySelector(`.th-tw-node-field[data-uuid="${node}"]`)?.value === '', 'the line to type in should be empty again');
    const arrowUndo = doc.querySelector('.lk-undo[data-lk-undo]');
    check(!!arrowUndo, 'the faded Undo arrow should be offered');
    click(window, arrowUndo);
    await wait(100);
    check(calls.some(c => c[0] === 'removeBlock') && (bullets.get(node) || []).length === 2, 'Undo should take the bullet away again: ' + JSON.stringify(calls));
    check(bulletWords().length === 2, 'and the list should show two again');
    click(window, arrow());
    await wait(300);
    check(!kidsOf(doc, node) && !isOpenChev(arrow()), 'the chevron again should close it');
    part.stop();
  }
  // 5b. A bullet changed where it stands (7 November 2026, the owner: "Allow me to edit bullet in the thread"): a click on its
  //     words, or Enter on them, opens a box on the same place; Enter keeps, Escape leaves it, an emptied or unchanged box writes
  //     nothing; one Undo puts the old words back unless the bullet changed since; a link in the words and the dot still open.
  {
    const { window, doc, calls, part, bullets, notices } = world('');
    window.logseq.App = { pushState: (kind, args) => calls.push(['pushState', args.name]) };
    await wait(120);
    const node = U(101), first = U(701), second = U(702);
    click(window, chevOf(doc, node));
    await wait(80);
    const words = id => doc.querySelector(`[data-edit-bullet="${id}"]`);
    const box = () => words(first)?.querySelector('.th-in-place');
    const writes = () => calls.filter(c => c[0] === 'setWords');
    const key = (el, name) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    check(words(first)?.getAttribute('tabindex') === '0' && words(second)?.getAttribute('tabindex') === '0', 'a bullet’s words should be reachable by Tab');
    check(!words(first)?.closest('.th-ol-new') && !doc.querySelector('.th-ol-new [data-edit-bullet]'), 'the empty bullet to write in is not one to change');
    click(window, words(first));
    await wait(60);
    check(!!box() && box().value === 'Cepeda reviewed 254 studies.' && box().tagName === 'TEXTAREA' && !calls.some(c => c[0] === 'pushState'), 'a click on the words should open a box on the same place holding them, and not open the bullet: ' + words(first)?.innerHTML);
    type(window, box(), 'Changed but not kept');
    key(box(), 'Escape');
    await wait(60);
    check(!box() && words(first).textContent === 'Cepeda reviewed 254 studies.' && !writes().length, 'Escape should leave the bullet as it was');
    click(window, words(first));
    await wait(60);
    key(box(), 'Enter');
    await wait(200);
    const next = () => doc.querySelector('.th-in-place');
    check(!box() && !writes().length && !!next() && calls.some(c => c[0] === 'insertBlock' && c[1] === first), 'Enter on words not changed should write nothing, and start the next bullet under them, the caret in it (C12)');
    key(next(), 'Escape');
    await wait(200);
    check(!next() && calls.some(c => c[0] === 'removeBlock') && !writes().length, 'Escape in the new, empty bullet takes it away again');
    const leaveNext = async () => { await wait(200); if (next()) { key(next(), 'Escape'); await wait(200); } };
    click(window, words(first));
    await wait(60);
    type(window, box(), '   ');
    key(box(), 'Enter');
    await leaveNext();
    check(!writes().length && words(first).textContent === 'Cepeda reviewed 254 studies.', 'emptied words should write nothing');
    click(window, words(first));
    await wait(60);
    type(window, box(), 'Cepeda reviewed 254 studies. Checked in the library.');
    check(!writes().length, 'typing should write nothing while the keys come');
    await wait(500);
    check(writes().length === 1 && !!box(), 'a pause in typing should save the words, the box staying open: ' + JSON.stringify(writes()));
    key(box(), 'Enter');
    check(words(first).textContent === 'Cepeda reviewed 254 studies. Checked in the library.', 'Enter should show the new words at once, never the old ones: ' + words(first).textContent);
    await wait(150);
    check(writes().length === 1 && writes()[0][1] === first && writes()[0][2] === 'Cepeda reviewed 254 studies. Checked in the library.', 'Enter should write the new words into the bullet: ' + JSON.stringify(calls));
    check(words(first).textContent === 'Cepeda reviewed 254 studies. Checked in the library.' && !box(), 'the bullet should read the new words');
    check(!!next() && next().closest('[data-edit-bullet]') !== words(first), 'the caret goes on to the next bullet, under the changed one');
    await leaveNext();
    const undo = doc.querySelector('.lk-undo[data-lk-undo]');
    check(!!undo, 'the faded Undo arrow should be offered');
    click(window, undo);
    await wait(150);
    check(writes().length === 2 && writes()[1][2] === 'Cepeda reviewed 254 studies.' && words(first).textContent === 'Cepeda reviewed 254 studies.', 'Undo should put the old words back: ' + JSON.stringify(writes()));
    // The bullet changed in Logseq since: the arrow leaves it and says so.
    words(first).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(60);
    type(window, box(), 'Second change');
    key(box(), 'Enter');
    await wait(150);
    await leaveNext();
    bullets.get(node)[0].title = 'Changed in Logseq since';
    click(window, doc.querySelector('.lk-undo[data-lk-undo]'));
    await wait(150);
    check(writes().length === 3 && notices.some(t => t.includes('so it stays')), 'a bullet changed since should stay as it is, and Undo should say so: ' + JSON.stringify(writes()) + JSON.stringify(notices));
    // Escape after a pause saved some typing puts the words back as they were.
    click(window, words(first));
    await wait(60);
    type(window, box(), 'A typo');
    await wait(500);
    key(box(), 'Escape');
    await wait(150);
    check(writes().length === 5 && writes()[3][2] === 'A typo' && writes()[4][2] === 'Changed in Logseq since', 'Escape should put back the words the bullet had: ' + JSON.stringify(writes()));
    // The keyboard: Enter on words Tab has reached.
    key(words(second), 'Enter');
    await wait(60);
    check(!!words(second).querySelector('.th-in-place') && words(second).querySelector('.th-in-place').value === 'See [[Testing effect]].', 'Enter on the words should open the box with the link whole: ' + words(second).innerHTML);
    key(words(second).querySelector('.th-in-place'), 'Escape');
    await wait(60);
    // A link in the words opens its page; the dot opens the bullet; neither starts a change.
    click(window, words(second).querySelector('.th-tw-peek-open'));
    await wait(40);
    check(calls.some(c => c[0] === 'pushState' && c[1] === 'Testing effect') && !words(second).querySelector('.th-in-place'), 'a link in the words should open its page, not start a change');
    click(window, doc.querySelector(`.th-ol-bullet[data-bullet="${second}"] > .th-ol-dot`));
    await wait(40);
    check(calls.some(c => c[0] === 'pushState' && c[1] === second) && !words(second).querySelector('.th-in-place'), 'the dot should open the bullet');
    part.stop();
  }
  // 5c. A wikilink in a line's words (7 November 2026, the owner: "lines in threads should contain under for the wikilinks"): the
  //     link words are underlined, as the library draws a link, and open their page; the rest of the name opens the node.
  {
    const { window, doc, calls, part } = world('');
    window.logseq.App = { pushState: (kind, args) => calls.push(['pushState', args.name]) };
    await wait(120);
    const twoWay = part.inner, node = U(150);
    const row = doc.createElement('div');
    row.innerHTML = twoWay.nameHtml({ uuid: node, title: 'Spoke with Dr. Chen about Blood in stool', words: 'Spoke with [[Dr. Chen]] about [the scan]([[CT scan]]) and [[Blood in stool]]', tag: '' });
    doc.querySelector('.th-two-way').append(row);
    const name = row.querySelector('a.th-tw-record');
    const links = [...row.querySelectorAll('.th-tw-peek-open')];
    check(name?.textContent === 'Spoke with Dr. Chen about the scan and Blood in stool', 'the name should read as its words, the brackets off: ' + name?.textContent);
    check(links.length === 3 && links.every(a => a.classList.contains('lk-node')) && links.map(a => a.dataset.openPage).join('|') === 'Dr. Chen|CT scan|Blood in stool' && links[1].textContent === 'the scan', 'each wikilink should be a link of the library’s kind to its page: ' + row.innerHTML);
    check(!twoWay.nameHtml({ uuid: node, title: 'No links here', words: 'No links here', tag: '' }).includes('th-tw-peek-open'), 'a name with no wikilink should draw none');
    check(twoWay.nameHtml({ uuid: node, title: 'A <b>name</b>', tag: '' }).includes('A &lt;b&gt;name&lt;/b&gt;'), 'a name with no words kept should draw its title, escaped');
    click(window, links[0]);
    await wait(40);
    check(calls.some(c => c[0] === 'pushState' && c[1] === 'Dr. Chen') && !calls.some(c => c[0] === 'pushState' && c[1] === node), 'a click on a wikilink should open its page and not the node');
    calls.length = 0;
    click(window, name);
    await wait(40);
    check(calls.some(c => c[0] === 'pushState' && c[1] === node), 'a click on the rest of the name should open the node');
    part.stop();
  }
  // 5d. Threads Forty, the new things on a list (7 November 2026): since you last looked, pin, sort, what the list keeps saying,
  //     the year line, the lists' order, the day steps.
  {
    const { window, doc, calls, part, provided } = world('');
    await wait(150);
    const tw = part.inner, st = tw.state;
    const lines = () => [...doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-line a.th-tw-record')].map(a => a.textContent);
    const head = () => doc.querySelector('.th-tw-row[data-field="about"] .th-tw-head')?.textContent || '';
    // Open the list.
    const lead = doc.querySelector('.th-tw-row[data-field="about"] .th-tw-lead, .th-tw-row[data-field="about"] .th-tw-chip.th-tw-lead');
    if (!doc.querySelector('.th-tw-row[data-field="about"][data-open]')) { click(window, lead); await wait(80); }
    check(lines().length === 5 && /show 1 more/.test(doc.querySelector('.th-tw-row[data-field="about"] .th-ol-more')?.textContent || ''), '"show all" says how many more (C9): ' + doc.querySelector('.th-tw-row[data-field="about"] .th-ol-more')?.textContent);
    // N6: what the list keeps saying.
    const keeps = () => doc.querySelector('.th-tw-row[data-field="about"] .th-tw-keeps');
    check(!!keeps() && /Confidence/.test(keeps().textContent), 'an open list of five or more says what its nodes often share (N6): ' + keeps()?.textContent);
    const strong = [...(keeps()?.querySelectorAll('.th-tw-keep') || [])].find(b => /Strong/.test(b.textContent));
    click(window, strong); await wait(80);
    check(lines().length === 2 && /Only these 2/.test(keeps()?.textContent || ''), 'a click on a shared value narrows the list to its nodes: ' + lines());
    click(window, keeps().querySelector('.th-tw-keep')); await wait(80);
    check(lines().length === 5, 'a click again gives the whole list back');
    // N20: sort by name.
    const all = JSON.parse(window.localStorage.getItem('thTwoWaySort') || '{}'); all[`${PAGE}|about`] = 'name'; window.localStorage.setItem('thTwoWaySort', JSON.stringify(all));
    st.html = null; tw.draw(doc); await wait(40);
    check(lines()[0].startsWith('Does it work') && /by name/.test(head()), 'sorted by name, the list and its head say so (N20): ' + lines()[0]);
    window.localStorage.removeItem('thTwoWaySort'); st.html = null; tw.draw(doc); await wait(40);
    // N2: pin a line from its menu.
    const pinItem = tw.lineMenuHooks.flatMap(h => h(st.groups.find(g => g.name === 'about'), st.groups.find(g => g.name === 'about').items[3]) || []).find(i => /Pin/.test(i.label));
    pinItem.run(); await wait(40);
    check(lines()[0] === st.groups.find(g => g.name === 'about').items[3].title && !!doc.querySelector('.th-tw-pinned') && !!doc.querySelector('.th-tw-pingap'), 'a pinned node leads its list, with its pin and a gap under it (N2): ' + lines()[0]);
    click(window, doc.querySelector('.lk-undo[data-lk-undo]')); await wait(60);
    check(!doc.querySelector('.th-tw-pinned'), 'Undo lets the pin go');
    // N3: the year line from the head's days.
    click(window, doc.querySelector('.th-tw-row[data-field="about"] .th-tw-head a.th-tw-when')); await wait(60);
    const dots = [...doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-ydot')];
    check(dots.length === 5, 'the days open a year line, a dot for each dated node (N3): ' + dots.length);
    click(window, dots.find(d => d.dataset.yday === '20261012')); await wait(60);
    check(lines().join('|') === 'Does it work for skills?|The best gap is a tenth of the time until the test.' && /showing/i.test(head()), 'a dot narrows the list to its week: ' + lines());
    // Lanes and spans (10 November 2026): the line laid out by a property, a lane narrowing the list, a drag picking days, Escape letting go.
    click(window, doc.querySelector('.th-tw-row[data-field="about"] .th-tw-ydot[data-yday="20261012"]')); await wait(60);
    check(lines().length === 5 && !/showing/i.test(head()), 'a click inside the picked week gives the whole list back: ' + lines().length);
    const about = () => st.groups.find(g => g.name === 'about'), timeline = () => tw.viewMenuHooks.flatMap(h => h(about()) || []).filter((it, i, all) => i > all.findIndex(x => x.group === 'Timeline') && !it.group).filter((it, i, all) => !all.slice(0, i).some(x => x.sep) && !it.sep);
    const by = timeline().map(i => i.label);
    check(by.join('|') === 'Hidden|One line|By Confidence|By Severity' && timeline().find(i => i.label === 'One line').chosen, 'the View menu offers the timeline hidden, as one line or in lanes by the properties its nodes share: ' + by);
    timeline().find(i => i.label === 'By Confidence').run(); await wait(60);
    const laneNames = () => [...doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-ylane')].map(a => a.textContent.replace(/\s+\d+$/, ''));
    check(laneNames().slice().sort().join('|') === 'Disputed|Strong|others' && laneNames()[2] === 'others' && JSON.parse(window.localStorage.getItem('thTwoWayYearLanes') || '{}').about === 'Confidence', 'by Confidence: a lane a value, others last, kept for the row: ' + laneNames());
    check(new Set([...doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-ydot')].map(d => d.style.getPropertyValue('--lane'))).size === 3, 'each dot stands in its lane');
    check(/Timeline by Confidence/.test(doc.querySelector('.th-tw-row[data-field="about"] .th-tw-said')?.textContent || ''), 'the heading says the timeline in force: ' + doc.querySelector('.th-tw-row[data-field="about"] .th-tw-said')?.textContent);
    click(window, doc.querySelector('.th-tw-row[data-field="about"] .th-tw-groupby')); await wait(80);
    check([...doc.querySelectorAll('.th-pop .th-item')].some(el => /By Confidence/.test(el.textContent)), 'a click on the words opens the View menu, the timeline among its options');
    doc.querySelectorAll('.th-pop').forEach(p => p.remove());
    click(window, [...doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-ylane')].find(a => a.textContent.startsWith('Strong'))); await wait(60);
    check(lines().length === 2 && lines().every(l => /^Spacing beats|^The gap/.test(l)) && /showing Confidence Strong/i.test(head()), 'a lane\'s name narrows the list to it, the head says so: ' + lines() + ' | ' + head());
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(60);
    check(lines().length === 5 && !/showing/i.test(head()) && laneNames().length === 3, 'Escape lets go of the lane, the lanes stay: ' + lines().length);
    { const track = doc.querySelector('.th-tw-row[data-field="about"] .th-tw-ytrack'); track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 70, right: 100, bottom: 70 });
      const m = (type, x) => track.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }));
      m('mousedown', 0); m('mousemove', 20); m('mousemove', 50); m('mouseup', 50); await wait(60); }
    check(lines().length === 2 && /showing Sep 1 to/i.test(head()), 'a drag across the line picks the days under it: ' + lines() + ' | ' + head());
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(60);
    check(lines().length === 5 && !/showing/i.test(head()), 'Escape lets go of the span');
    { const track = doc.querySelector('.th-tw-row[data-field="about"] .th-tw-ytrack'); track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 70, right: 100, bottom: 70 });
      const m = (type, x) => track.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }));
      m('mousedown', 0); m('mousemove', 20); m('mousemove', 50); m('mouseup', 50); await wait(60); }
    check(!!doc.querySelector('.th-tw-row[data-field="about"] .th-tw-showing [data-yclear]'), 'the narrowing stands on its own line with a ×');
    click(window, doc.querySelector('.th-tw-row[data-field="about"] [data-yclear]')); await wait(60);
    check(lines().length === 5 && !/showing/i.test(head()), 'the × gives the whole list back');
    { const dots = () => doc.querySelectorAll('.th-tw-row[data-field="about"] .th-tw-ydot').length, before = dots();
      const tab = doc.querySelector('.th-tw-row[data-field="about"] .th-tw-chip[data-tag="Claim"]');
      click(window, tab); await wait(60);
      check(dots() > 0 && dots() < before, 'a tab narrows the timeline to its own nodes: ' + before + ' → ' + dots());
      click(window, doc.querySelector('.th-tw-row[data-field="about"] .th-tw-chip[data-tag="Claim"]')); await wait(60);
      check(dots() === before, 'the tab let go, every dot is back'); }
    timeline().find(i => i.label === 'One line').run(); await wait(60);
    check(!doc.querySelector('.th-tw-row[data-field="about"] .th-tw-ylane') && !window.localStorage.getItem('thTwoWayYearLanes')?.includes('about'), 'One line takes the lanes away');
    timeline().find(i => i.label === 'Hidden').run(); await wait(60);
    check(!doc.querySelector('.th-tw-row[data-field="about"] .th-tw-yearline'), 'Hidden folds the timeline away');
    timeline().find(i => i.label === 'One line').run(); await wait(60);
    click(window, doc.querySelector('.th-tw-row[data-field="about"] .th-tw-head a.th-tw-when')); await wait(60);
    check(!doc.querySelector('.th-tw-ydot') && lines().length === 5, 'the days again fold the line and give the list back');
    // N1: since you last looked.
    provided.createdAt = async uuids => new Map(uuids.map((u, i) => [u, { created: u === U(102) ? Date.now() : 1000, updated: 1000 }]));
    window.localStorage.setItem('thTwoWaySeen', JSON.stringify({ [PAGE]: 5000 }));
    st.visitPage = ''; tw.later(0); await wait(200);
    check(doc.querySelectorAll('.th-tw-new').length === 1 && /1 new/.test(head()), 'a node made since the last look carries a dot, the head says how many (N1): ' + head());
    click(window, doc.querySelector('.th-tw-newcount')); await wait(60);
    check(lines().join('|') === 'The gap should grow with each review.', 'the count narrows the list to the new: ' + lines());
    // C17: lists in your order; C15: the day steps.
    tw.moveList('about', ''); await wait(40);
    check([...doc.querySelectorAll('.th-tw-row')].map(r => r.dataset.field).pop() === 'about', 'a list moved to the end stays there (C17)');
    click(window, doc.querySelector('.lk-undo[data-lk-undo]')); await wait(200);
    st.find = 'on Oct 7'; st.html = null; tw.draw(doc); await wait(40);
    click(window, doc.querySelector('[data-daystep="-7"]')); await wait(40);
    check(st.find === 'on Sep 30', 'a week earlier steps the day (C15): ' + st.find);
    click(window, doc.querySelector('[data-daystep="0"]')); await wait(40);
    check(st.find === '', 'Today takes the day away');
    part.stop();
  }
  // 6. The + line proposes the rest: under the line, the row's property on this page, then what the rules
  //    say for the words (through a pretend draftProposals); Escape clears them until typing again; a click on a guess
  //    keeps that one and the other guess fades; Enter sets the row's property, the kept guess and the sure day.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const asked = [];
    window.Threads.core.provided.draftProposals = async draft => {
      asked.push(draft);
      if (!/scan/.test(draft.text)) return [];
      return [
        { ident: 'user.property/topic', title: 'Topic', kind: 'node', ids: [77], shown: 'Colon cancer', names: null, guess: true, many: false, day: 0, journalId: null },
        { ident: 'user.property/with', title: 'with', kind: 'node', ids: [78], shown: 'Ruth Okoro', names: null, guess: true, many: true, day: 0, journalId: null },
        { ident: 'user.property/date', title: 'Date', kind: 'day', ids: [900], shown: 'Oct 24', names: null, guess: false, many: false, day: 20261024, journalId: 900 },
      ];
    };
    const esc = (window, input) => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    click(window, doc.querySelector('.th-tw-add'));
    await wait(40);
    const field = () => doc.querySelector('.th-tw-draft-name');
    const props = () => [...doc.querySelectorAll('.th-tw-draft-props .th-tw-dprop')].map(el => el.textContent.trim());
    check(!!field() && props().length === 1 && /^about/.test(props()[0]), 'the line should say what the row sets before anything is typed: ' + props());
    const first = props()[0];
    type(window, field(), 'Follow-up about the scan results');
    await wait(400);
    const last = asked[asked.length - 1];
    check(!!last && last.tag === 'Claim' && last.set.some(s => s.ident === 'user.property/about' && s.ids[0] === 5) && last.journalDay > 20260000, 'the rules should be asked with the tag, the row’s property set and today: ' + JSON.stringify(last));
    check(props().join('|') === `${first}|TopicColon cancer|withRuth Okoro|DateOct 24`, 'the proposals should show under the line: ' + props());
    check(doc.querySelectorAll('.th-tw-dpick .th-pencil.lk-pencil').length === 3, 'a value pencilled in the + line should carry the shared pencil');
    check(doc.querySelectorAll('.th-tw-dpick .th-pencil').length === 3 && !doc.querySelector('.th-tw-dghost, .th-tw-dguess'), 'every value pencilled in should be the one pencilled look, sure and guessed alike');
    check(calls.length === 0, 'nothing should be written while they show');
    esc(window, field());
    check(props().length === 1 && !!doc.querySelector('.th-tw-draft'), 'Escape should clear the proposals and keep the line: ' + props());
    type(window, field(), 'Follow-up about the scan results.');
    await wait(400);
    check(props().length === 4, 'typing again should bring them back: ' + props());
    click(window, doc.querySelector('.th-tw-dpick[data-pkey="user.property/topic|77"]'));
    check(!!doc.querySelector('.th-tw-dpick[data-pkey="user.property/topic|77"] .th-pencil-taken:not(.lk-pencil)') && !!doc.querySelector('.th-tw-dpick[data-pkey="user.property/with|78"] .th-tw-dpassed'), 'the kept guess should read solid and the other faded');
    enter(window, field());
    await wait(40);
    check(!!doc.querySelector('.th-tw-draft-where') && props().length === 4, 'the where step should keep the proposals under the line: ' + props());
    enter(window, doc.querySelector('.th-tw-draft-where'));
    await wait(150);
    const uuid = calls.find(c => c[0] === 'appendBlock')?.[3];
    const sets = calls.filter(c => c[0] === 'setValue' && c[1] === uuid).map(c => c.slice(2).join(' '));
    check(sets.includes('user.property/about 5 {"entityId":true}') && sets.includes('user.property/topic 77 {"entityId":true}') && sets.includes('user.property/date 900 null') && !sets.some(x => x.startsWith('user.property/with')), 'Enter should set the row’s property, the kept guess and the sure day, not the guess let go: ' + JSON.stringify(sets));
    check(doc.querySelector('.th-tw-draft-name')?.value === '' && !doc.querySelector('.th-tw-dpick') && !!doc.querySelector('.lk-undo[data-lk-undo]'), 'the line should be open again, empty, with nothing proposed, and the Undo arrow offered');
    part.stop();
  }
  // 6b. Nothing kept: Enter takes every proposal shown, several at once for a property that holds several; with a
  //     second Escape the line closes; without the rules nothing is asked.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    window.Threads.core.provided.draftProposals = async () => [{ ident: 'user.property/topic', title: 'Topic', kind: 'node', ids: [77], shown: 'Colon cancer', guess: true, many: false }, { ident: 'user.property/with', title: 'with', kind: 'node', ids: [78, 79], shown: 'Ruth Okoro, Tunde Okoro', guess: true, many: true }];
    click(window, doc.querySelector('.th-tw-add'));
    await wait(40);
    const field = doc.querySelector('.th-tw-draft-name');
    type(window, field, 'Spoke about the next cycle');
    await wait(400);
    enter(window, field);
    await wait(40);
    enter(window, doc.querySelector('.th-tw-draft-where'));
    await wait(150);
    const uuid = calls.find(c => c[0] === 'appendBlock')?.[3];
    const sets = calls.filter(c => c[0] === 'setValue' && c[1] === uuid).map(c => c.slice(2).join(' '));
    check(sets.includes('user.property/topic 77 {"entityId":true}') && sets.includes('user.property/with [78,79] {"entityId":true,"reset":true}'), 'Enter with nothing kept should set every guess: ' + JSON.stringify(sets));
    // The line left open: a node put on this page (Down, Enter in the where step); the next one lights this page again.
    const again = doc.querySelector('.th-tw-draft-name');
    check(!!again && !doc.querySelector('.th-tw-add[data-field="about"]'), 'the line should be open again in place of the +');
    type(window, again, 'Put here');
    enter(window, again);
    await wait(40);
    const where1 = doc.querySelector('.th-tw-draft-where');
    where1.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    enter(window, where1);
    await wait(150);
    check(calls.filter(c => c[0] === 'appendBlock').pop()?.[1] === PAGE, 'Down, Enter should put the node on this page');
    const again2 = doc.querySelector('.th-tw-draft-name');
    type(window, again2, 'Put here too');
    enter(window, again2);
    await wait(40);
    enter(window, doc.querySelector('.th-tw-draft-where'));
    await wait(150);
    check(calls.filter(c => c[0] === 'appendBlock').pop()?.[1] === PAGE, 'the next node should go where the last one went, its place lit: ' + JSON.stringify(calls.filter(c => c[0] === 'appendBlock').map(c => c[1])));
    const again3 = doc.querySelector('.th-tw-draft-name');
    type(window, again3, 'Another');
    await wait(400);
    again3.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    again3.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!doc.querySelector('.th-tw-draft'), 'a second Escape should close the line');
    part.stop();
  }
  // 7. A page's name in the words: the rest in grey after the cursor through the suggested links' own reading
  //    (a pretend one here), with whose name it is; the Right arrow writes [[the page]]; nothing without a name.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const seen = [];
    window.Threads.core.provided.linkSuggestInner = { suggestFor: (text, caret, pages, opts) => { seen.push([text, caret, opts]); return /Dr\. Pat$/.test(text) ? { start: text.length - 7, end: text.length, span: 'Dr. Pat', title: 'Dr. Raj Patel', ghost: 'el', name: 'Dr. Raj Patel' } : null; } };
    click(window, doc.querySelector('.th-tw-add'));
    await wait(40);
    const field = doc.querySelector('.th-tw-draft-name');
    type(window, field, 'Spoke with Dr. Pat');
    await wait(80);
    const rest = doc.querySelector('.th-tw-ghost-rest');
    check(seen.length > 0 && rest?.textContent === 'el' && rest.getAttribute('data-name') === 'Dr. Raj Patel' && doc.querySelector('.th-tw-ghost-typed')?.textContent === 'Spoke with Dr. Pat', 'the rest of the name should show in grey after the words: ' + rest?.textContent);
    field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    check(field.value === 'Spoke with [[Dr. Raj Patel]]' && !doc.querySelector('.th-tw-ghost-over'), 'the Right arrow should write the link in the line: ' + field.value);
    type(window, field, 'Spoke with [[Dr. Raj Patel]] about');
    await wait(80);
    check(!doc.querySelector('.th-tw-ghost-over'), 'with no name to complete, nothing grey should show');
    check(calls.length === 0, 'nothing should be written by the name');
    part.stop();
  }
  // 8. A page's name in the line that writes a bullet into a node: the same grey rest of the name, asked with
  //    the node's own tag; the Right arrow writes the link; Escape takes the grey away first and leaves the line;
  //    Enter writes the bullet with the link in it.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const seen = [];
    window.Threads.core.provided.linkSuggestInner = {
      suggestFor: (text, caret, pages, opts) => { seen.push([text, opts]); return /Dr\. Pat$/.test(text) ? { start: text.length - 7, end: text.length, span: 'Dr. Pat', title: 'Dr. Raj Patel', ghost: 'el', name: 'Dr. Raj Patel' } : null; },
      boostFor: (tagIds) => new Set(tagIds),
    };
    window.Threads.core.provided.propPages = async () => [{ id: 41, title: 'Claim', lower: 'claim', isTag: true, tags: [] }];
    window.Threads.core.provided.propSchema = async () => ({ props: [] });
    const node = U(101);
    click(window, chevOf(doc, node));
    await wait(80);
    const field = () => doc.querySelector(`.th-tw-node-field[data-uuid="${node}"]`);
    field().focus(); // a click on the faint empty bullet
    type(window, field(), 'Ask Dr. Pat');
    await wait(80);
    check(kidsOf(doc, node)?.querySelector('.th-tw-ghost-rest')?.textContent === 'el', 'the rest of the name should show in grey in the node’s line: ' + doc.querySelector('.th-tw-ghost-rest')?.textContent);
    check(seen.length > 0 && seen[seen.length - 1][1]?.boost?.has(41), 'the name should be asked for with the node’s own tag');
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!doc.querySelector('.th-tw-ghost-over') && doc.activeElement === field(), 'Escape should take the grey name away and keep the line');
    type(window, field(), 'Ask Dr. Pat');
    await wait(80);
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    check(field()?.value === 'Ask [[Dr. Raj Patel]]', 'the Right arrow should write the link in the node’s line: ' + field()?.value);
    enter(window, field());
    await wait(100);
    check(calls.some(c => c[0] === 'addLineTo' && c[1] === node && c[2] === 'Ask [[Dr. Raj Patel]]'), 'Enter should write the bullet with the link: ' + JSON.stringify(calls));
    part.stop();
  }
  // 9. A node's properties in its opened box: the tag's properties but the row's own ("about", pointing here),
  //    each with what it holds or "empty"; a click asks in the kit's list, the likely ones first for a link (a pretend
  //    pickerOrder); a pick sets it, Undo puts back what it held; a number is shown ready to change; Clear at the end of
  //    a list clears it (empty and Enter would take the lit row).
  {
    const { window, doc, calls, part, stampNow, notices } = world('');
    await wait(120);
    const asked = [];
    window.Threads.core.provided.pickerOrder = async (uuid, title) => { asked.push([uuid, title]); return title === 'Source' ? [62] : []; };
    const node = U(103);
    click(window, chevOf(doc, node));
    await wait(120);
    const propLines = () => [...(kidsOf(doc, node)?.querySelectorAll('.th-ol-prop:not(.th-tw-back)') || [])].filter(l => l.querySelector('.th-ol-pname').textContent.trim());
    const rows = () => propLines().map(l => l.querySelector('.th-ol-pname').textContent.trim() + '=' + l.querySelector('.th-ol-pv').textContent.trim());
    check(rows().join('|') === 'Confidence=Disputed|Severity=1' && !/empty/.test(kidsOf(doc, node)?.textContent || ''), 'an empty property draws nothing, no "1 empty" line: ' + rows());
    openEmpties(window, doc, node);
    await wait(80);
    check(rows().join('|') === 'Confidence=Disputed|Severity=1|Source=empty', 'the node’s own properties should show above its bullets, the one pointing back at this page left out (the row it opened from names it): ' + rows());
    check(!!kidsOf(doc, node)?.querySelector('.th-tw-npvalue.th-faint'), 'an empty one should read "empty" in grey');
    // A node property carries the triangle of dots; a fact carries the icon of what it holds (the owner: "a
    // property always shows its icon, on pages too"), never the triangle.
    const marked = propLines().filter(l => l.querySelector('.th-ol-pname .th-kind .lk-web')).map(l => l.querySelector('.th-ol-pname').textContent.trim());
    const iconed = propLines().filter(l => l.querySelector('.th-ol-pname .th-kind i')).map(l => l.querySelector('.th-ol-pname').textContent.trim());
    check(marked.join('|') === 'Source' && iconed.join('|') === 'Confidence|Severity|Source', 'every property should carry its icon, only the node property the triangle of dots: ' + marked + ' / ' + iconed);
    check(calls.length === 0, 'opening should write nothing');
    const value = name => propLines().find(l => l.querySelector('.th-ol-pname').textContent.trim() === name)?.querySelector('.th-ol-pv [data-edit]');
    // Since 1.0.3 a value is changed as Logseq does it: a link or a choice in Logseq's own picker (its classes), a
    // number typed where it sits.
    const popRows = () => [...doc.querySelectorAll('.th-lsq-pop .menu-link')].map(el => el.textContent.trim());
    const popField = () => doc.querySelector('.th-lsq-pop input');
    const inPlace = () => doc.querySelector('.th-in-place');
    // A link: the likely one first.
    click(window, value('Source'));
    await wait(80);
    check(asked.some(a => a[0] === node && a[1] === 'Source') && popRows()[0] === 'Rohrer 2015' && popRows().includes('Cepeda 2006') && popRows().includes('A child tag’s page') && !popRows().includes('Memory techniques'), 'the list should put the likely page first and hold only pages the property takes, child tags’ too: ' + popRows());
    popField().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.some(c => c[0] === 'setValue' && c[1] === node && c[2] === 'user.property/source' && c[3] === '[62]'), 'Enter should set the lit page, as a list for a property that holds several: ' + JSON.stringify(calls));
    const undo = [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].find(u => /Set “Source” on/.test(u.title || ''));
    check(!!undo, 'the faded Undo arrow should be offered: ' + [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].map(u => u.title));
    // Undo of the Source pick puts back what it held (nothing).
    window.Threads.core.provided.unsetValue = async (uuid, ident) => { calls.push(['unsetValue', uuid, ident]); };
    click(window, undo); await wait(150);
    check(calls.some(c => c[0] === 'unsetValue' && c[1] === node && c[2] === 'user.property/source'), 'Undo should put back what Source held, nothing: ' + JSON.stringify(calls.filter(c => c[2] === 'user.property/source')));
    // A number: shown ready to change; the same words again change nothing; a new one is written as a number.
    click(window, value('Severity'));
    await wait(80);
    check(inPlace()?.value === '1' && !!inPlace()?.closest('.th-ol-pv') && !doc.querySelector('.th-lsq-pop, .th-pop'), 'a number should be typed where it sits, ready to change, with no pop-up: ' + inPlace()?.value);
    inPlace().value = '3'; inPlace().dispatchEvent(new window.Event('input', { bubbles: true }));
    inPlace().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.some(c => c[0] === 'setValue' && c[1] === node && c[2] === 'user.property/severity' && c[3] === '3' && c[4] === 'null'), 'a number should be written as the number: ' + JSON.stringify(calls.filter(c => c[2] === 'user.property/severity')));
    // A choice: Clear at the list's end clears it.
    click(window, value('Confidence'));
    await wait(80);
    check(popRows().join('|') === 'Disputed|Strong|Clear', 'a choice should list what it holds first, then the other choices, then Clear (as Logseq lists them): ' + popRows());
    const unsets = calls.length;
    click(window, [...doc.querySelectorAll('.th-lsq-pop .menu-link')].find(el => el.textContent.trim() === 'Clear'));
    await wait(150);
    check(calls.slice(unsets).some(c => c[0] === 'unsetValue' && c[1] === node && c[2] === 'user.property/confidence') && !calls.slice(unsets).some(c => c[0] === 'setValue'), 'Clear should clear it and set nothing: ' + JSON.stringify(calls.slice(unsets)));
    // A new change's arrow takes the last one's place: Severity's went when Confidence was cleared.
    check(doc.querySelectorAll('.lk-undo[data-lk-undo]').length === 1 && /Confidence/.test(doc.querySelector('.lk-undo[data-lk-undo]').title), 'one arrow stands, on the last change: ' + [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].map(u => u.title));
    // Confidence set again by hand in Logseq after the Clear (8 November 2026): the arrow leaves it, writes nothing and says so.
    stampNow.set(`${node}|user.property/confidence`, 'set by hand since');
    const before = calls.length;
    click(window, doc.querySelector('.lk-undo[data-lk-undo]')); await wait(150);
    check(!calls.slice(before).some(c => /Value$/.test(c[0])) && notices.some(t => t.includes('so it stays')), 'a value changed since the change should stay, and Undo should say so: ' + JSON.stringify(calls.slice(before)) + JSON.stringify(notices));
    part.stop();
  }
  // 10. The picking bar's "Change … to…": the pages the picked nodes' words name come first, the most named
  //     first, asked with the field's tags (a pretend namedPages); without the reader, the list as it was.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const asked = [];
    window.Threads.core.provided.namedPages = async (text, tagIds) => { asked.push([text, tagIds]); return /recall/.test(text) ? [62, 61] : /review/.test(text) ? [62] : []; };
    window.Threads.core.provided.propSchema = async () => ({ props: [{ ident: 'user.property/about', title: 'about', lower: 'about', type: 'node', many: false, choices: [], classes: [{ id: 60 }] }] });
    window.Threads.core.provided.valuesOf = async () => [5];
    check(!doc.querySelector('.th-tw-pick'), 'no tick box before picking is turned on');
    await startPicking(window, doc, 'about');
    const pick = uuid => click(window, doc.querySelector(`.th-tw-pick[data-pick="${uuid}|about"]`));
    pick(U(101)); await wait(20); pick(U(102)); await wait(20);
    click(window, await moreItem(window, doc, /^Change/));
    await wait(120);
    const listed = [...doc.querySelectorAll('.th-lsq-pop .menu-link')].map(el => el.textContent.trim());
    const hint = doc.querySelector('.th-lsq-pop input')?.placeholder || '';
    check(asked.length === 2 && asked.every(a => a[1].join() === '60'), 'each picked node’s words should be read, with the field’s tags: ' + JSON.stringify(asked));
    check(listed.join('|') === 'Rohrer 2015|Cepeda 2006', 'the page both nodes name should come first, then the one named once: ' + listed);
    check(/^Change “.+” to …$/.test(hint), 'the field should say what it asks, as Logseq’s does (“Set Works at”), with no hint: ' + hint);
    doc.querySelector('.th-lsq-pop input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.filter(c => c[0] === 'setValue' && c[2] === 'user.property/about').every(c => c[3] === '62') && calls.filter(c => c[0] === 'setValue').length === 2, 'Enter should point both at the first page: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // 11. Mentions come up to the rows: the nodes whose words link the page, one already pointing here through
  //     "about" left out; no + in the row; a mention with a tag gets no offer; one without is offered the tag its words
  //     look like (a pretend tagGuess) with the property that takes this page, shown under it before anything is
  //     written, made with a click and taken back with Undo; the row hidden on this page from its right-click.
  {
    const { window, doc, calls, part, saved } = world('');
    const p = window.Threads.core.provided;
    p.mentionsInto = async id => id === 5 ? [
      { id: 201, uuid: U(201), title: 'Called [[Spaced repetition]] about the scan', tag: '', day: 20260803 },
      { id: 202, uuid: U(202), title: 'Spaced repetition felt easier today', tag: 'Symptom Log', day: 20260909 },
      { id: 101, uuid: U(101), title: NODES[0].title, tag: 'Claim', day: 20260901 },
    ] : [];
    const spoke = { id: 81, ident: 'user.property/spoke-with', title: 'Spoke with', lower: 'spoke with', type: 'node', many: true, choices: [], classes: [{ id: 70 }] };
    const schema = await p.propSchema();
    p.propSchema = async () => ({ ...schema, props: [...schema.props, spoke], byId: new Map([[81, spoke]]), classProps: new Map([[71, [81]]]), parentsOf: new Map(), builtIn: new Set() });
    p.propPages = async () => [{ id: 5, uuid: PAGE, title: 'Spaced repetition', lower: 'spaced repetition', tags: [{ id: 70 }] }, { id: 71, uuid: U(71), title: 'Conversation', lower: 'conversation', isTag: true, tags: [] }, { id: 72, uuid: U(72), title: 'Claim', lower: 'claim', isTag: true, tags: [] }];
    p.earlierLinesRead = () => true;
    p.tagGuess = async uuid => uuid === U(201) ? { id: 71, uuid: U(71), title: 'Conversation' } : null;
    p.hasTag = async () => false;
    p.valuesOf = async () => [];
    p.removeTag = async (uuid, tag) => { calls.push(['removeTag', uuid, tag]); };
    p.unsetValue = async (uuid, ident) => { calls.push(['unsetValue', uuid, ident]); };
    await wait(150);
    const row = () => doc.querySelector('.th-tw-row[data-field=" mentioned in"]');
    check(!!row() && row().querySelector('.th-tw-name')?.textContent.trim() === 'Mentioned in', 'a "Mentioned in" row should be drawn: ' + row()?.querySelector('.th-tw-name')?.textContent);
    check(doc.querySelectorAll('.th-tw-row')[doc.querySelectorAll('.th-tw-row').length - 1] === row(), 'the mentions should come after the rows from properties');
    const listed = () => [...(row()?.querySelectorAll('.th-tw-record') || [])].map(a => a.textContent.trim());
    check(listed().join('|') === 'Spaced repetition felt easier today|Called Spaced repetition about the scan', 'the two mentions, latest first, links read as words, the node already in "about" left out: ' + listed());
    check(!row()?.querySelector('.th-tw-add'), 'the mentions row should have no +');
    { const heads = [...row().querySelectorAll('.th-tw-chip')].map(el => el.textContent.trim().replace(/\s*\d+$/, ''));
      check(heads.includes('No tag') && !heads.includes('note'), 'mentions of several kinds should read "No tag", never "note": ' + heads); }
    await startPicking(window, doc, ' mentioned in');
    const pick = uuid => click(window, doc.querySelector(`.th-tw-pick[data-pick="${uuid}| mentioned in"]`));
    pick(U(202)); await wait(80);
    { const offered = (await moreItems(window, doc)).map(el => el.textContent.trim()); doc.querySelectorAll('.th-pop').forEach(p => p.remove());
      check(!offered.some(t => /^(Make it|Change|Take out)/.test(t)), 'a mention with a tag should be offered nothing, and the page’s own actions should not show for a mention: ' + offered); }
    pick(U(202)); pick(U(201)); await wait(120);
    { const raise = await moreItem(window, doc, /^Make it/); doc.querySelectorAll('.th-pop').forEach(p => p.remove());
      check(/Make it a Conversation/.test(raise?.textContent || ''), 'a mention with no tag should be offered the tag its words look like: ' + raise?.textContent); }
    // On its line too: "could be a Conversation · …" in italic, a click opening Make it… for that mention alone.
    const could = doc.querySelector(`.th-pencil[data-could="${U(201)}"]`);
    check(/could be a Conversation/.test(could?.textContent || ''), 'the untagged mention should say what it could be on its line: ' + could?.textContent);
    check(!doc.querySelector(`[data-could="${U(202)}"]`), 'a mention with a tag should not say what it could be');
    const preview = [...(doc.querySelector('.th-tw-raise')?.querySelectorAll('.th-tw-dprop') || [])].map(el => el.textContent.trim());
    check(doc.querySelectorAll('.th-tw-raise .th-pencil.lk-pencil').length === 2, 'what a mention would get should carry the shared pencil');
    check(preview.join('|') === 'TagsConversation|Spoke withSpaced repetition', 'what it would get should show under it in grey: ' + preview);
    check(calls.length === 0, 'picking should write nothing');
    click(window, await moreItem(window, doc, /^Make it/)); await wait(80);
    const items = [...doc.querySelectorAll('.th-pop .th-item')];
    check(/Conversation · Spoke with/.test(items[0]?.textContent || '') && /look like/.test(items[0]?.textContent || ''), 'the menu should offer the guessed tag first: ' + items.map(i => i.textContent));
    click(window, items[0]); await wait(200);
    check(calls.some(c => c[0] === 'addTag' && c[1] === U(201) && c[2] === U(71)), 'the tag should be added: ' + JSON.stringify(calls));
    check(calls.some(c => c[0] === 'setValue' && c[1] === U(201) && c[2] === 'user.property/spoke-with' && c[3] === '[5]'), 'the property should point at this page: ' + JSON.stringify(calls));
    check(!calls.some(c => c[1] === U(202)), 'the mention with a tag should be left alone');
    const undo = [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].find(u => /Conversation/.test(u.title || ''));
    check(!!undo, 'the faded Undo arrow should be offered: ' + [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].map(u => u.title));
    if (undo) { click(window, undo); await wait(200); }
    check(calls.some(c => c[0] === 'unsetValue' && c[1] === U(201)) && calls.some(c => c[0] === 'removeTag' && c[1] === U(201) && c[2] === U(71)), 'Undo should take the property and the tag off again: ' + JSON.stringify(calls));
    // Hide the row on this page from its right-click.
    row().querySelector('.th-tw-name').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const hide = [...doc.querySelectorAll('.th-pop .th-item')].find(el => /Hide mentions on this page/.test(el.textContent));
    check(!!hide && ![...doc.querySelectorAll('.th-pop .th-item')].some(el => /Rename/.test(el.textContent)), 'the right-click should offer to hide the row, not to rename it');
    if (hide) { click(window, hide); await wait(120); }
    check(saved.some(x => x.twoWayMentionsHidden === 'Spaced repetition'), 'the page should be added to the pages without the row: ' + JSON.stringify(saved));
    part.stop();
  }
  // 11b. Reads back as… (1.0.4): from a property row's right-click, the words are typed on the row's own name, as a page
  //      is renamed in Logseq (no pop-up); Enter keeps them and saves the setting, with the Undo arrow; Escape leaves it.
  {
    const { window, doc, part, saved } = world('');
    await wait(120);
    const prow = [...doc.querySelectorAll('.th-tw-row')].find(r => r.querySelector('.th-tw-field'));
    const nameEl = prow?.querySelector('.th-tw-name');
    const label = nameEl?.textContent.trim();
    nameEl.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const item = [...doc.querySelectorAll('.th-pop .th-item')].find(el => /Reads back as/.test(el.textContent));
    check(!!item, 'the right-click on a property row should offer Reads back as…');
    // The audit's 25: every item has its icon, one "…" with no space before it, and the words stay short.
    { const items = [...doc.querySelectorAll('.th-pop .th-item')].filter(el => el.textContent.trim());
      const iconless = items.filter(el => !el.querySelector('.ti, svg, [class*="ti-"]') || /ti-export\b/.test(el.innerHTML)).map(el => el.textContent.trim());
      check(!iconless.length, 'every item of the row\'s right-click should have its icon: ' + iconless.join(', '));
      const odd = items.map(el => el.textContent.trim()).filter(t => / …|\.\.\./.test(t) || t.length > 24);
      check(!odd.length, 'no " …", no "...", no long words in the row\'s right-click: ' + odd.join(', ')); }
    click(window, item); await wait(80);
    const field = () => nameEl.querySelector('.th-in-place');
    check(!!field() && field().value === label && !doc.querySelector('.th-pop:popover-open, .th-lsq-pop'), 'the words should be typed on the row’s own name, holding its name, with no pop-up: ' + field()?.value);
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(40);
    check(!field() && nameEl.textContent.trim() === label && !saved.some(x => 'twoWayNames' in x), 'Escape should leave the name as it was and save nothing');
    nameEl.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    click(window, [...doc.querySelectorAll('.th-pop .th-item')].find(el => /Reads back as/.test(el.textContent))); await wait(80);
    field().value = 'doctor of';
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(120);
    check(saved.some(x => /doctor of/.test(x.twoWayNames || '')), 'Enter should save the words for the property: ' + JSON.stringify(saved));
    check([...doc.querySelectorAll('.lk-undo[data-lk-undo]')].some(u => /doctor of/.test(u.title || '')), 'the faded Undo arrow should be offered');
    part.stop();
  }
  // 12. Follow a chain: in an opened node a chevron before a value that is another node; a click opens that node
  //     under the property, with its properties and the rows that point at it; no chevron for a node open above, none
  //     three deep; the chevron and closing the node close it; nothing written.
  {
    const { window, doc, calls, part } = world('');
    const p = window.Threads.core.provided;
    const base = p.nodeValues, baseLinks = p.linksInto;
    const link = (uuid, title, id) => ({ text: title, id, uuid });
    const extra = new Map([
      [U(103), [link(U(61), 'Cepeda 2006', 61)]],
      [U(61), [link(U(103), 'Spacing does not help understanding, only recall.', 103), link(U(104), 'The best gap is a tenth of the time until the test.', 104)]],
      [U(104), [link(U(62), 'Rohrer 2015', 62)]],
    ]);
    p.nodeValues = async uuids => { const out = await base(uuids); for (const uuid of uuids) if (extra.has(uuid)) { if (!out.has(uuid)) out.set(uuid, new Map()); out.get(uuid).set('Source', { ident: 'user.property/source', values: extra.get(uuid) }); } return out; };
    p.linksInto = async id => id === 61 ? { pages: new Map([[61, { uuid: U(61), byField: new Map([['Source', new Set([103, 104])]]) }]]), fields: new Map([['Source', { uuid: U(55), ident: 'user.property/source' }]]), records: new Map([103, 104].map(n => [n, { uuid: U(n), title: NODES.find(x => x.id === n).title, tag: 'Claim', day: 0 }])) } : baseLinks(id);
    await wait(120);
    click(window, chevOf(doc, U(103)));
    await wait(150);
    const chev = (inside, uuid) => chevOf(doc, uuid, inside);
    const box = uuid => kidsOf(doc, uuid);
    check(!!chev(U(103), U(61)), 'a value that is another node should have the one chevron');
    check(!!box(U(103))?.querySelector('.th-ol-line .th-tag'), 'a node in an opened node should show its tag after its name');
    click(window, chev(U(103), U(61))); await wait(150);
    check(!!box(U(61)) && box(U(61)).parentElement.firstElementChild.contains(chev(U(103), U(61))), 'the chevron should open that node under its own line, which stays where it was');
    // One outline (10 November 2026): what links here hangs, a line per property, in its own step (th-tw-lkids) inside the node.
    const own = el => el.closest('.th-ol-kids:not(.th-tw-lkids):not(.th-tw-linkedkids)') === box(U(61));
    const names61 = [...(box(U(61))?.querySelectorAll('.th-ol-pname, .th-tw-lhead > .th-ol-body') || [])].filter(own).map(el => el.textContent.trim()).filter(Boolean);
    check(names61.filter(n => n === 'Source').length === 2, 'it should show its property and, named by that property itself, what points at it: ' + names61);
    check(!doc.querySelector('.th-tw-name .th-tw-arrow') && [...doc.querySelectorAll('.th-tw-name')].every(n => !/ of$/.test(n.textContent.trim())), 'a row should be named by its property, nothing added, no arrow');
    check([...box(U(61)).querySelectorAll('.th-tw-lkids .th-tw-record')].filter(own).length === 1, 'what points at it should be listed one name per line, the way back left out');
    //: the nodes that link to it under their property's line, a fold arrow before it, after its own properties; no "N link here" line.
    const heads = () => [...(box(U(61))?.querySelectorAll('.th-tw-lhead:not(.th-tw-linkedline)') || [])].filter(own);
    check(heads().length === 1 && !!box(U(61)).querySelector('.th-tw-linkedline') && !box(U(61)).querySelector('.th-tw-links'), 'the nodes linking to it should come under their property\'s line, with no "N link here" line: ' + heads().map(l => l.textContent));
    click(window, heads()[0].querySelector('.th-chev[data-links]')); await wait(80);
    check(!heads()[0]?.nextElementSibling?.matches('.th-tw-lkids'), 'the line\'s fold arrow folds what links here');
    click(window, heads()[0].querySelector('.th-chev[data-links]')); await wait(80);
    check(!!heads()[0]?.nextElementSibling?.matches('.th-tw-lkids') && !!heads()[0].nextElementSibling.querySelector('.th-tw-record'), 'the lines linking to it should sit one step in under that line');
    check(![...(box(U(61))?.querySelectorAll('.th-tw-lkids .th-ol-prop') || [])].filter(own).length, 'its own properties should not sit under that line');
    check(!chev(U(61), U(103)) && !!chev(U(61), U(104)), 'the node on the way should not be listed again, another node should');
    click(window, chev(U(61), U(104))); await wait(150);
    // A level whose lines would break (at the fourth): the same chevron; opening it shifts the outline by
    // one level: the node opened from the row becomes the section's top, the page goes into the trail, the levels under
    // it stay open.
    const stepper = chev(U(104), U(62));
    check(!!box(U(104)) && !!stepper && stepper.matches('.th-chev'), 'three nodes deep the next node should have the same chevron');
    if (stepper) {
      // The pretend window lays nothing out: a line four opened levels deep (five boxes, with the row's list) is made
      // wider than the section, as at the owner's width.
      const deep = el => { let n = 0; for (let k = el.closest('.th-ol-kids'); k; k = k.parentElement?.closest('.th-ol-kids')) n++; return n; };
      Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return this.matches('.th-ol-line') && deep(this) >= 5 ? 999 : 0; } });
      // Its only lines are its empty properties, drawn only once opened (8 November 2026): opened, as "no Topic?" does.
      openEmpties(window, doc, U(62));
      click(window, chev(U(104), U(62))); await wait(400);
      const trail = doc.querySelector('.th-tw-stepped .th-ol-trail');
      check(!!trail && doc.querySelectorAll('.th-tw-stepped .th-ol-trail [data-step]').length === 1 && /Spacing does not help/.test(trail.textContent), 'a fourth level should shift by one: the page in the trail, the node opened from the row at the top: ' + trail?.textContent);
      check(!!box(U(61)) && !!box(U(104)) && !!box(U(62)), 'the three levels under the new top should stay open, the new one with them');
      check(!doc.querySelector('.th-tw-findrow') && !doc.querySelector('.th-tw-bar:not([data-idle])'), 'shifted, the page’s own find field and picking bar should be away: ' + [...doc.querySelector('.th-two-way').children].map(c => c.className).join(' / '));
      check(doc.querySelector('.th-two-way')?.hasAttribute('data-th-rows'), 'shifted, the section should still stand for the page, so Logseq’s lists stay hidden');
      // Esc does one thing: it closes the deepest node, and the section stays shifted.
      doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(300);
      check(!box(U(62)) && !!box(U(104)) && !!doc.querySelector('.th-tw-stepped'), 'Esc should close only the deepest node: ' + !!box(U(62)) + ' ' + !!doc.querySelector('.th-tw-stepped'));
      // The trail's page goes back to the rows, what was open still open.
      click(window, doc.querySelector('.th-tw-stepped .th-ol-trail [data-step="-1"]')); await wait(100);
      check(!doc.querySelector('.th-tw-stepped') && !!box(U(104)), 'the trail should go back to the rows, what was open still open');
      doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(300);
      check(!box(U(104)) && !!box(U(61)), 'back by the trail, Esc should still close one level at a time');
      delete window.HTMLElement.prototype.scrollWidth;
      click(window, chev(U(61), U(104))); await wait(150);
    }
    check(calls.length === 0, 'following the chain should write nothing: ' + JSON.stringify(calls));
    click(window, chev(U(103), U(61))); await wait(300);
    check(!box(U(61)) && !box(U(104)), 'the chevron should close the node and everything under it');
    click(window, chev(U(103), U(61))); await wait(150);
    check(!!box(U(61)) && !box(U(104)), 'opened again it should come back without what was under it');
    click(window, chevOf(doc, U(103))); await wait(300);
    click(window, chevOf(doc, U(103))); await wait(150);
    check(!box(U(61)), 'closing the node opened from the row should close its chain too');
    part.stop();
  }
  // The find field: typing keeps the nodes whose words hold it, or one of their
  // own properties by its name or a value, that property said under the node.
  {
    const { doc, window, part } = world('');
    await wait(120);
    const small = doc.querySelector('.th-tw-find');
    check(!small, 'six nodes get no find field: it stands from twenty rows up (the owner, 2026-10-31)');
    if (small) {
      small.focus(); small.value = 'severity'; small.dispatchEvent(new window.Event('input', { bubbles: true }));
      await wait(200);
      const lines = [...doc.querySelectorAll('.th-tw-line, .th-tw-item')];
      const opened = [...doc.querySelectorAll('.th-chev[data-dig][aria-expanded="true"]')];
      const marked = [...doc.querySelectorAll('.th-ol-prop.th-tw-match .th-ol-pname')].map(n => n.textContent.trim());
      check(lines.length > 0 && opened.length === lines.length && marked.length === lines.length && marked.every(n => n === 'Severity'), 'typing a property’s name should keep the nodes holding it, each opened as when dug, its “Severity” line marked: ' + lines.length + ' found, ' + opened.length + ' open, ' + marked);
      small.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(60);
      check(!doc.querySelector('.th-chev[data-dig][aria-expanded="true"]'), 'emptying the field should close what it opened');
    }
    part.stop(); await wait(10);
    const extra = Array.from({ length: 20 }, (_, i) => ({ id: 120 + i, title: `Note ${i + 1} on review timing.`, tag: 'Claim', day: 20260801 + i }));
    NODES.push(...extra);
    const many = world('');
    await wait(150);
    const field = many.doc.querySelector('.th-tw-find');
    check(!!field && many.doc.querySelector('.th-tw-findrow .th-field-count')?.textContent === '26' && !/26/.test(field.placeholder), 'twenty-six nodes should get the kit’s find field, the count at its end, not in the grey words');
    if (field) {
      // The field finds a node's whole words, not only the name its line shows.
      field.focus(); field.value = 'knows'; field.dispatchEvent(new many.window.Event('input', { bubbles: true }));
      await wait(30);
      check(many.doc.querySelectorAll('.th-tw-line').length === 1, 'words after the first sentence should find their node');
      field.value = 'gap'; field.dispatchEvent(new many.window.Event('input', { bubbles: true }));
      await wait(30);
      const names = [...many.doc.querySelectorAll('.th-tw-line .th-tw-record, .th-tw-item .th-tw-record')].map(a => a.textContent);
      check(names.length === 3 && names.every(n => /gap/i.test(n)), 'typing “gap” should keep the three nodes with it: ' + names);
      check(many.doc.activeElement?.matches('.th-tw-find') && many.doc.activeElement.value === 'gap', 'the field should keep the keys and its words while the rows are drawn again');
      many.doc.activeElement.dispatchEvent(new many.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(30);
      check(many.doc.querySelectorAll('.th-tw-line, .th-tw-item').length > 3, 'Esc in the field should show every node again');
    }
    many.part.stop();
    NODES.splice(NODES.length - extra.length, extra.length);
  }
  // A Deadline in a dug node (a Date-and-time, a timestamp on the node), and words cleared then put back through the row's arrow.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const provided = window.Threads.core.provided, node = U(103), TIME = new Date(2026, 10, 3, 12).getTime(), schema = await provided.propSchema();
    let words = true;
    provided.propSchema = async () => ({ props: [...schema.props,
      { ident: 'logseq.property/deadline', title: 'Deadline', lower: 'deadline', type: 'datetime', many: false, choices: [], classes: [] },
      { ident: 'user.property/note', title: 'Note', lower: 'note', type: 'default', many: false, choices: [], classes: [] }] });
    provided.nodeValues = async (uuids, opts) => new Map(uuids.map(uuid => [uuid, new Map([...(opts?.logseqs ? [['Deadline', { ident: 'logseq.property/deadline', values: [{ day: 20261103, time: TIME }] }]] : []),
      ['Note', { ident: 'user.property/note', values: words ? [{ text: 'the words', id: 880, uuid: U(880) }] : [] }]])]));
    provided.valuesOf = async (uuid, ident) => ident === 'user.property/note' ? (words ? [880] : []) : [TIME];
    provided.unsetValue = async (uuid, ident) => { calls.push(['unsetValue', uuid, ident]); words = false; };
    provided.parseDay = () => new Date(2026, 10, 6);
    provided.dayNumber = () => 20261106;
    click(window, chevOf(doc, node));
    await wait(120);
    const lines = () => [...kidsOf(doc, node).querySelectorAll('.th-ol-prop:not(.th-tw-back)')];
    const line = name => lines().find(l => l.querySelector('.th-ol-pname').textContent.trim() === name);
    check(/Nov 3/.test(line('Deadline')?.querySelector('.th-ol-pv').textContent || ''), 'a Deadline should read its day, not "empty": ' + line('Deadline')?.textContent);
    const inPlace = () => doc.querySelector('.th-in-place');
    const write = async (name, typed) => { click(window, line(name).querySelector('.th-ol-pv [data-edit]')); await wait(80); inPlace().value = typed; inPlace().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(150); };
    const undo = async sentence => { click(window, [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].find(u => sentence.test(u.title || ''))); await wait(150); };
    const lastSet = () => calls.filter(c => c[0] === 'setValue').at(-1)?.slice(1);
    await write('Deadline', 'friday');
    check(lastSet()?.[2] === String(new Date(2026, 10, 6).getTime()) && !/entityId/.test(lastSet()[3]), 'a day written into a Date-and-time should be a moment, not an id: ' + lastSet());
    await undo(/Set “Deadline”/);
    check(lastSet()?.[2] === String(TIME) && !/entityId/.test(lastSet()[3]), 'Undo should put the moment back, not as an id: ' + lastSet());
    await write('Note', '');
    check(calls.some(c => c[0] === 'unsetValue' && c[2] === 'user.property/note'), 'the words should be cleared');
    await undo(/Cleared “Note”/);
    check(lastSet()?.[1] === 'user.property/note' && lastSet()?.[2] === '"the words"' && !/entityId/.test(lastSet()[3]), 'Undo after clearing words should put the words back, not the old value’s id: ' + lastSet());
    // Enter on one value, the next pressed at once: its box stays through the redraw the first write brings, words and caret kept.
    words = false;
    await wait(1100);
    // Note was just emptied, so it draws nothing until its node's empties are opened.
    if (!line('Note')) { openEmpties(window, doc, node); await wait(80); }
    click(window, line('Note').querySelector('.th-ol-pv [data-edit]')); await wait(20);
    inPlace().value = 'new words'; inPlace().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    words = true;
    click(window, line('Deadline').querySelector('.th-ol-pv [data-edit]')); await wait(1);
    const box = inPlace();
    box.value = 'friday'; box.setSelectionRange(3, 3);
    await wait(1200);
    check(/the words/.test(line('Note')?.querySelector('.th-ol-pv').textContent || ''), 'the row should show the first value meanwhile: ' + line('Note')?.textContent);
    check(inPlace() === box && line('Deadline').contains(box) && doc.activeElement === box, 'the box should stay through the redraw, in its row, with the keyboard');
    check(box.value === 'friday' && box.selectionStart === 3, 'and keep its words and caret: ' + box.value);
    box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(!inPlace() && lastSet()?.[2] === String(new Date(2026, 10, 6).getTime()), 'Enter should then write it whole: ' + lastSet());
    part.stop();
  }
  // Select all takes what is shown; the question names pages apart from bullets. Bullets are deleted for good (8 November 2026),
  // so the keyboard waits on Cancel and Enter anywhere in the question cancels; only the blue yes deletes. Pages alone go to the
  // Recycle, Enter deletes them as before, and the faded arrow brings them back.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const provided = window.Threads.core.provided;
    provided.getPage = async uuid => uuid === U(102) ? { id: 9, name: 'gap', title: 'gap', uuid: U(102) } : null;
    provided.kindOfPage = async () => ({ isTag: false });
    provided.deletePage = async name => { calls.push(['deletePage', name]); };
    await startPicking(window, doc);
    click(window, doc.querySelector('.th-tw-pick'));
    await wait(20);
    click(window, await moreItem(window, doc, /^Select all/));
    await wait(20);
    check(/5 picked/.test(doc.querySelector('.th-tw-bar .th-count').textContent) && !(await moreItems(window, doc)).some(el => /^Select all/.test(el.textContent.trim())), 'Select all should pick the five shown, not the one behind "show all": ' + doc.querySelector('.th-tw-bar .th-count').textContent);
    click(window, doc.querySelector('.th-tw-bar [data-act="delete"]'));
    await wait(60);
    check(doc.querySelector('.th-ask-words')?.textContent === 'Delete 1 page with all its bullets and 4 bullets?', 'the question should name the page apart from the bullets: ' + doc.querySelector('.th-ask-words')?.textContent);
    check(/4 bullets are deleted for good: nothing can bring them back\. The page goes to the Recycle\./.test(doc.querySelector('.th-ask')?.textContent || ''), 'the question should say the bullets cannot come back: ' + doc.querySelector('.th-ask')?.textContent);
    // The keyboard's place is seen in Logseq (8 November 2026: Cancel had it); a stand-in pop-up cannot take the keyboard.
    check(doc.querySelector('.th-ask .th-btns .lk-enter')?.textContent === 'Cancel' && !!doc.querySelector('.th-ask .lk-big') && !doc.querySelector('.th-ask .lk-accent'), 'Enter should belong to Cancel, the yes being the blue one for what Undo cannot put back');
    const press = el => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    press(doc.querySelector('.th-ask'));
    await wait(60);
    check(!doc.querySelector('.th-ask') && !calls.some(c => c[0] === 'removeBlock' || c[0] === 'deletePage'), 'Enter on the question should cancel and delete nothing');
    click(window, doc.querySelector('.th-tw-bar [data-act="delete"]'));
    await wait(60);
    click(window, doc.querySelector('.th-ask .lk-big'));
    await wait(120);
    check(calls.filter(c => c[0] === 'removeBlock').length === 4 && calls.some(c => c[0] === 'deletePage' && c[1] === U(102)), 'the blue Delete should delete what it names, a page by its id and never by its name: ' + JSON.stringify(calls));
    const arrow = doc.querySelector('.lk-undo[data-lk-undo]');
    check(!!arrow, 'the page deleted should have the faded arrow');
    click(window, arrow);
    await wait(120);
    check(calls.some(c => c[0] === 'restorePage' && c[1] === U(102)), 'the arrow should bring the page back from the Recycle: ' + JSON.stringify(calls.filter(c => c[0] === 'restorePage')));
    part.stop();
  }
  // Linked references goes only when the mentions were read; a node holding the page's alias is in the rows.
  {
    const { window, doc, part, provided, changed } = world('');
    const again = async () => { changed.forEach(fn => fn({ blocks: [], txMeta: { outlinerOp: 'x' } })); await wait(1050); return doc.querySelector('.th-two-way').hasAttribute('data-th-replaces'); };
    provided.mentionsInto = async () => []; provided.kindOfPage = async () => ({ isTag: false });
    check(await again(), 'with the mentions read, the rows replace Linked references');
    window.logseq.settings.twoWayMentions = false;
    check(!await again(), 'with mentions off, Linked references stays');
    window.logseq.settings.twoWayMentions = true; provided.mentionsInto = async () => { throw new Error('refused'); };
    check(!await again(), 'with a read that failed, Linked references stays');
    provided.mentionsInto = async () => []; provided.aliasesOf = async id => id === 5 ? [6] : [];
    const links = provided.linksInto;
    provided.linksInto = async id => id !== 6 ? links(id) : { pages: new Map([[6, { uuid: U(6), byField: new Map([['about', new Set([107])]]) }]]), fields: new Map([['about', { uuid: U(50), ident: 'user.property/about' }]]), records: new Map([[107, { uuid: U(107), title: 'Held through the alias', tag: 'Claim', day: 0 }]]) };
    await again();
    click(window, doc.querySelector('[data-more]') || doc.body);
    await wait(20);
    check(doc.querySelector('.th-two-way').textContent.includes('Held through the alias') && doc.querySelectorAll('.th-two-way .th-tw-row').length === 1, 'a node holding an alias is in the page’s row');
    part.stop();
  }
  // A task shows Logseq's circle for its status; the head says what its days are of, and a line dated otherwise says its own.
  {
    const { window, doc, part, provided, changed, calls } = world('');
    // The statuses as Logseq keeps them, each with its icon; a renamed one with an icon of the user's choosing too.
    const icon = id => ({ type: 'tabler-icon', id });
    provided.statusChoices = async () => [[76, 'Backlog', 'Backlog'], [77, 'Todo', 'Todo'], [78, 'Doing', 'InProgress50'], [79, 'In Review', 'InReview'], [80, 'Done', 'Done'], [81, 'Canceled', 'Cancelled'], [82, 'Waiting', 'hourglass']]
      .map(([id, title, i], n) => ({ id, title, order: 'b0' + n, icon: icon(i) }));
    provided.mentionsInto = async () => [
      { id: 211, uuid: U(211), title: 'Ring the pharmacy', tag: 'Task', day: 20260804, dayFrom: '', status: 77 },
      { id: 212, uuid: U(212), title: 'Clinic on Friday', tag: 'Task', day: 20260806, dayFrom: 'Date', status: 80 },
      { id: 213, uuid: U(213), title: 'Clinic next week', tag: 'Task', day: 20260812, dayFrom: 'Date', status: 0 },
      { id: 214, uuid: U(214), title: 'Wait for the letter', tag: 'Task', day: 20260813, dayFrom: 'Date', status: 82 },
    ];
    changed.forEach(fn => fn({ blocks: [], txMeta: { outlinerOp: 'x' } })); await wait(1050);
    const row = [...doc.querySelectorAll('.th-two-way .th-tw-row')].find(r => r.textContent.includes('Mentioned in'));
    const fold = row?.querySelector('.th-tw-head .th-chev');
    if (fold && fold.getAttribute('aria-expanded') !== 'true') { click(window, fold); await wait(30); }
    const box = [...doc.querySelectorAll('.th-two-way .th-tw-row')].find(r => r.textContent.includes('Mentioned in'));
    check(!!box?.querySelector('.th-task.ls-icon-Todo') && !!box?.querySelector('.th-task.ls-icon-Done'), 'a task shows Logseq’s circle for its status');
    check(!!box?.querySelector('.th-task.ls-icon-hourglass .ti.ti-hourglass'), 'a status with an icon chosen in Logseq shows that icon');
    check(box?.querySelectorAll('.th-task').length === 3, 'a node with no status shows no circle');
    { const when = box?.querySelector('.th-tw-when'); check(/^\w{3}\s\d+ to /.test(when?.textContent || '') && /Date/.test(when?.title || ''), 'the head says the days alone, and what they are of under the pointer (the audit\'s 26): ' + when?.textContent + ' | ' + when?.title); }
    const froms = [...box?.querySelectorAll('.th-ol-from') || []].map(e => e.textContent);
    check(froms.length === 1 && froms[0] === 'Journal', 'only the line dated otherwise says its own, after its words (the audit\'s 30): ' + JSON.stringify(froms));
    check(!box?.querySelector('.th-ol-day .th-ol-from, .th-ol-dfrom'), 'the day column holds the day alone');
    // A press on the circle opens Logseq's Set Status list; a pick writes the status, and the faded arrow puts the old one back.
    click(window, box.querySelector('.th-task.ls-icon-Todo')); await wait(30);
    const rowsOf = () => [...doc.querySelectorAll('.th-lsq-pop .menu-link')].map(a => a.textContent.trim());
    check(rowsOf().join('|') === 'Backlog|Todo|Doing|In Review|Done|Canceled|Waiting|Clear', 'the circle opens Logseq’s statuses and Clear, in Logseq’s order: ' + rowsOf());
    click(window, [...doc.querySelectorAll('.th-lsq-pop .menu-link')].find(a => a.textContent.trim() === 'Done')); await wait(120);
    check(calls.some(c => c[0] === 'setValue' && c[1] === U(211) && c[2] === 'logseq.property/status' && c[3] === '"Done"'), 'picking Done writes the status: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    check(!!doc.querySelector(`.th-task.ls-icon-Done[data-task="${U(211)}"]`), 'the line shows the new status at once');
    click(window, [...doc.querySelectorAll('.lk-undo[data-lk-undo]')].find(u => /Set “Ring the pharmacy” to Done/.test(u.title || ''))); await wait(150);
    check(calls.filter(c => c[0] === 'setValue' && c[2] === 'logseq.property/status').at(-1)?.[3] === '"Todo"', 'the faded arrow puts Todo back');
    part.stop();
  }
  // Words: one value at a time, as written; a link stays one; the box is never inside the button, where a space would press it.
  {
    const { window, doc, part, calls, provided } = world('');
    const many = { ident: 'user.property/words', title: 'Words', lower: 'words', type: 'default', many: true, choices: [], classes: [] }, one = { ident: 'user.property/note', title: 'Note', lower: 'note', type: 'default', many: false, choices: [], classes: [] };
    provided.fieldsOf = async () => [many, one];
    let held = ['a one', `see [[${U(40)}]] soon`];
    provided.readableTitle = async text => String(text).replace(`[[${U(40)}]]`, '[[Dr. X]]');
    provided.storedWords = async text => text.replace('[[Dr. X]]', `[[${U(40)}]]`);
    provided.nodeValues = async () => new Map([[U(101), new Map([['Words', { ident: many.ident, values: held.map(text => ({ text })) }], ['Note', { ident: one.ident, values: [{ text: `to [[${U(40)}]]` }] }]])]]);
    await wait(100);
    click(window, chevOf(doc, U(101))); await wait(120);
    const button = i => doc.querySelector(`.th-tw-npvalue[data-edit="${many.ident}"][data-value="${i}"]`), box = () => doc.querySelector('.th-in-place');
    check(button(0)?.textContent === 'a one' && button(1)?.textContent === 'see Dr. X soon', 'each value its own, as it reads: ' + button(1)?.textContent);
    const lineOf = b => b.closest('.th-ol-prop');
    check(lineOf(button(0)) !== lineOf(button(1)) && [0, 1].every(i => lineOf(button(i)).querySelector('.th-ol-pv > .th-ol-dot:not(.th-ol-dot-room)')) && !lineOf(button(1)).querySelector('.th-ol-pname').textContent, 'each value a bullet on a line of its own, the name on the first only (12 November 2026: "Where are bullets for values?")');
    click(window, button(1)); await wait(30);
    check(box()?.value === 'see [[Dr. X]] soon', 'the box starts from the words as written, one value: ' + box()?.value);
    check(!box().closest('button'), 'the box is not inside a button');
    box().value = 'see [[Dr. X]] later'; enter(window, box()); await wait(80);
    let set = calls.filter(c => c[0] === 'setValue' && c[2] === many.ident).at(-1);
    check(set?.[3] === JSON.stringify(['a one', `see [[${U(40)}]] later`]) && /reset/.test(set[4]), 'that value changed in its place, the other left, the link kept: ' + set?.[3]);
    held = JSON.parse(set[3]); await wait(1000);
    click(window, doc.querySelector(`.th-ol-pname[data-edit="${many.ident}"]`)); await wait(30);
    check(!box(), 'the name opens the property and changes nothing (12 November 2026)');
    click(window, doc.querySelector(`.th-ol-pname[data-edit="${many.ident}"]`).nextElementSibling); await wait(30);
    check(box()?.value === '', 'a press in the value’s area, beside what it holds, adds another: an empty box');
    box().value = 'c three'; enter(window, box()); await wait(80);
    set = calls.filter(c => c[0] === 'setValue' && c[2] === many.ident).at(-1);
    check(JSON.parse(set[3]).length === 3 && JSON.parse(set[3])[2] === 'c three', 'added, not folded into one: ' + set?.[3]);
    held = JSON.parse(set[3]); await wait(1000);
    click(window, button(0)); await wait(30); box().value = 'a two'; enter(window, box()); await wait(80);
    set = calls.filter(c => c[0] === 'setValue' && c[2] === many.ident).at(-1);
    check(JSON.parse(set[3])[0] === 'a two' && JSON.parse(set[3]).length === 3, 'a changed value keeps its place: ' + set?.[3]);
    click(window, doc.querySelector(`.th-tw-npvalue[data-edit="${one.ident}"]`)); await wait(30);
    check(box()?.value === 'to [[Dr. X]]', 'one value: as written too: ' + box()?.value);
    box().value = 'to [[Dr. X]] now'; enter(window, box()); await wait(80);
    set = calls.filter(c => c[0] === 'setValue' && c[2] === one.ident).at(-1);
    check(set?.[3] === JSON.stringify(`to [[${U(40)}]] now`), 'a link stays a link: ' + set?.[3]);
    await wait(1000);
    provided.nodeValues = async () => new Map([[U(101), new Map([['Note', { ident: one.ident, values: [{ text: 'two\nlines' }] }]])]]);
    click(window, chevOf(doc, U(101))); await wait(60); click(window, chevOf(doc, U(101))); await wait(120);
    click(window, doc.querySelector(`.th-tw-npvalue[data-edit="${one.ident}"]`)); await wait(30);
    check(box()?.tagName === 'TEXTAREA' && box().value === 'two\nlines', 'a line break stays in the box');
    part.stop();
  }
  // Enter twice makes one: a bullet, and a node from the line.
  {
    const { window, doc, part, calls } = world('p:Confidence');
    await wait(100);
    click(window, chevOf(doc, U(101))); await wait(120);
    const field = doc.querySelector(`.th-tw-node-field[data-uuid="${U(101)}"]`);
    field.value = 'Once'; field.dispatchEvent(new window.Event('input', { bubbles: true })); enter(window, field); check(field.value === '', 'the field empties on Enter'); enter(window, field); await wait(120);
    check(calls.filter(c => c[0] === 'addLineTo' && c[2] === 'Once').length === 1, 'Enter twice adds one bullet');
    await wait(1000);
    click(window, chevOf(doc, U(101))); await wait(60);
    click(window, doc.querySelector('.th-tw-gadd')); await wait(40);
    const line = doc.querySelector('.th-tw-draft-name');
    type(window, line, 'Twice over'); enter(window, line); enter(window, line); await wait(150);
    check(calls.filter(c => c[0] === 'appendBlock' && c[2] === 'Twice over').length === 1, 'Enter twice makes one node: ' + calls.filter(c => c[0] === 'appendBlock').length);
    part.stop();
  }
  // The arrow on something made: gone once it has changed, and never takes what was written. The Recycle is no page.
  {
    const { window, doc, part, calls, changed, madeNow, notices, recycled, provided } = world('');
    await wait(100);
    click(window, chevOf(doc, U(101))); await wait(120);
    const field = () => doc.querySelector(`.th-tw-node-field[data-uuid="${U(101)}"]`), arrow = () => doc.querySelector('.lk-undo[data-lk-undo]');
    field().value = 'Made'; enter(window, field()); await wait(150);
    const bullet = calls.find(c => c[0] === 'addLineTo')[3];
    check(!!arrow(), 'the arrow stands');
    madeNow.set(bullet, 'written in'); changed.forEach(fn => fn({ blocks: [{ uuid: bullet, id: 1, title: 'Made more', page: { id: 9 } }], txMeta: { outlinerOp: 'save-block' } })); await wait(450);
    check(!arrow(), 'written in, the arrow goes');
    field().value = 'Made too'; enter(window, field()); await wait(150);
    const other = calls.filter(c => c[0] === 'addLineTo').at(-1)[3];
    madeNow.set(other, 'written in'); click(window, arrow()); await wait(100);
    check(!calls.some(c => c[0] === 'removeBlock' && c[1] === other) && notices.some(t => t.includes('so it stays')), 'pressed after a change, nothing is taken, and it says so');
    field().value = 'Made last'; enter(window, field()); await wait(150);
    const last = calls.filter(c => c[0] === 'addLineTo').at(-1)[3];
    click(window, arrow()); await wait(100);
    check(calls.some(c => c[0] === 'removeBlock' && c[1] === last), 'unchanged, the arrow takes it away');
    let asked = 0; const state = provided.madeState; provided.madeState = async uuid => { asked++; return state(uuid); };
    changed.forEach(fn => fn({ blocks: [], txMeta: { outlinerOp: 'save-block' } })); await wait(400);
    check(asked === 0, 'with no arrow left, nothing is asked: ' + asked);
    part.stop();
  }
  // A page made stays once anything has come to link to it, as Predictive's and Structure's do (10 November 2026): its Undo
  // would leave the link pointing at nothing. Unlinked and unchanged, the arrow takes it away.
  {
    const { window, doc, part, notices, provided } = world('');
    await wait(100);
    const inner = part.inner, page = U(970), arrow = () => doc.querySelector('.lk-undo[data-lk-undo]');
    let linked = false, ran = 0;
    provided.pageUnlinked = async () => !linked;
    await inner.offerMade(page, 'Added “Dr. Lee” as a page', async () => { ran++; }, null, null, true);
    linked = true; click(window, arrow()); await wait(100);
    check(ran === 0 && notices.some(t => t.includes('linked to')), 'a made page something links to stays, and it says so: ' + JSON.stringify(notices));
    linked = false;
    await inner.offerMade(page, 'Added “Dr. Lee” as a page', async () => { ran++; }, null, null, true);
    click(window, arrow()); await wait(100);
    check(ran === 1, 'a made page nothing links to goes with its arrow');
    // A pick of several nodes is a change of many things: a change of one thing after it leaves its arrow standing.
    const door = window.PluginDoor.undo;
    inner.offerUndo('Tagged 3 nodes', async () => {}, undefined, undefined, true);
    inner.offerUndo('Pinned “Fatigue”', async () => {});
    check(door.size === 2, 'the pick of several keeps its Undo beside the Undo of one thing: ' + door.size);
    inner.offerUndo('Unpinned “Fatigue”', async () => {});
    check(door.size === 2, 'a second change of one thing takes the place of the first only');
    door.clear();
    part.stop();
  }
  {
    const { window, doc, part, calls, notices, recycled, provided } = world('');
    const gone = U(950), getPage = provided.getPage;
    provided.pagesAmong = async () => 6;
    provided.getPage = async key => key === 'In the bin' ? { id: 950, uuid: gone, name: 'in the bin' } : key === 'Standing' ? { id: 951, uuid: U(951), name: 'standing' } : getPage(key);
    recycled.add(gone);
    await wait(100);
    click(window, doc.querySelector('.th-tw-add')); await wait(60);
    const name = () => doc.querySelector('.th-tw-draft-name');
    type(window, name(), 'Standing'); enter(window, name()); await wait(120);
    check(notices.some(t => t.includes('already exists')), 'a page that stands refuses the name');
    click(window, doc.querySelector('.th-tw-add') || doc.body); await wait(60);
    type(window, name(), 'In the bin'); enter(window, name()); await wait(150);
    check(calls.some(c => c[0] === 'restorePage' && c[1] === gone) && notices.filter(t => t.includes('already exists')).length === 1, 'a name in the Recycle brings that page back, not a refusal: ' + JSON.stringify(notices));
    check(calls.some(c => c[0] === 'setValue' && c[1] === gone), 'and the row’s property is set on it');
    part.stop();
  }
  {
    const { window, doc, part, calls, notices, recycled, provided, graphHooks, reads } = world('');
    const bin = U(960);
    provided.propPages = async () => [{ id: 960, uuid: bin, title: 'Binned place', lower: 'binned place', tags: [] }];
    recycled.add(bin);
    const popup = window.Threads.shared.popup; window.Threads.shared.popup = options => { const pop = popup(options); doc.activeElement?.blur(); return pop; };   // as a list opening does in Logseq
    await wait(100);
    click(window, doc.querySelector('.th-tw-add')); await wait(60);
    const name = doc.querySelector('.th-tw-draft-name'); type(window, name, 'Into the bin'); enter(window, name); await wait(80);
    const where = doc.querySelector('.th-tw-draft-where');
    check(doc.activeElement === where, 'the keyboard stays in the where box');
    type(window, where, 'Binned'); await wait(60);
    where.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(150);
    check(!calls.some(c => c[0] === 'appendBlock') && notices.some(t => t.includes('There is no page named')), 'a place in the Recycle takes nothing, and says so: ' + JSON.stringify(notices));
    // Another graph: nothing read of this one holds there.
    check(graphHooks.length === 1, 'the rows listen for another graph');
    reads.length = 0; graphHooks.forEach(fn => fn()); await wait(120);
    check(reads.length >= 1, 'another graph reads the rows afresh: ' + reads.length);
    part.stop();
  }
  // The page on a day, two pages side by side, the walk kept (7 November 2026, the owner: "ok build each").
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const twoWay = window.Threads.parts.find(p => p.name === 'two-way').inner;
    twoWay.state.findShown = true; twoWay.state.html = null; twoWay.draw(doc);
    const field = doc.querySelector('.th-tw-find');
    check(!!field, 'the find line can be called up on a page with few rows');
    // On a day: the nodes up to it are the list, the later ones faint under "since", the head says how many today.
    type(window, field, 'on 2026-09-20'); await wait(200);
    const head = doc.querySelector('.th-tw-head')?.textContent.replace(/\s+/g, ' ') || '';
    check(/All 3/.test(head) && /6 today/.test(head) && /Sep 1 to Sep 15/.test(head), 'on a day the head counts the nodes up to it and says how many there are today: ' + head);
    const since = doc.querySelector('.th-tw-since');
    check(!!since && since.querySelectorAll('.th-tw-line').length === 3 && /since/.test(since.textContent), 'the later nodes stand under a "since" line: ' + since?.querySelectorAll('.th-tw-line').length);
    check(/3 of 6 up to Sep 20/.test(doc.querySelector('.th-tw-findrow .th-field-count')?.textContent || ''), 'the find line says the count up to the day: ' + doc.querySelector('.th-tw-findrow .th-field-count')?.textContent);
    check(twoWay.readFind().asOf === 20260920 && twoWay.readFind().q === '', 'the day is read out of the words, nothing left to find by');
    type(window, field, 'claim on Sep 20'); await wait(200);
    check(twoWay.readFind().q === 'claim' && twoWay.readFind().asOf === 20260920 && doc.querySelectorAll('.th-tw-since .th-tw-line').length === 2, 'words and a day together: the words narrow, the day parts: ' + doc.querySelectorAll('.th-tw-since .th-tw-line').length);
    // Esc in the line lets the words go: back to today.
    field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(150);
    check(!twoWay.state.find && !doc.querySelector('.th-tw-since'), 'Esc comes back to today');
    // Beside: "and <page>" draws two columns, the same property on one line, the other page's rows read.
    type(window, field, 'and Cepeda'); await wait(300);
    const beside = doc.querySelector('.th-tw-beside');
    check(!!beside, 'a page named after "and" stands beside this one');
    check(beside?.querySelectorAll('.th-tw-bhead').length === 2 && /Cepeda 2006/.test(beside?.textContent || ''), 'both pages head their columns');
    check(beside?.querySelectorAll('.th-tw-bcell').length === 2 && /none/.test(beside?.querySelector('.th-tw-bcell.th-tw-bnone')?.textContent || ''), 'a property only one page has reads "none", quiet, on the other side');
    check(/beside Cepeda 2006/.test(doc.querySelector('.th-tw-findrow .th-field-count')?.textContent || ''), 'the find line says which page stands beside');
    check(beside?.querySelectorAll('.th-tw-bside .th-tw-line').length === 3 && !!beside?.querySelector('[data-more]'), 'three nodes a side, then show all: ' + beside?.querySelectorAll('.th-tw-bside .th-tw-line').length);
    type(window, field, 'and Nobody'); await wait(200);
    check(!doc.querySelector('.th-tw-beside') && /no page/.test(doc.querySelector('.th-tw-findrow .th-field-count')?.textContent || ''), 'a name that is no page: the rows stay, the line says so');
    type(window, field, ''); await wait(150);
    part.stop();
  }
  console.log(problems.length ? `two-way-rows-test: ${problems.length} of ${cases} checks failed` : `two-way-rows-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
