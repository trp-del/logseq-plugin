#!/usr/bin/env node
/* The two-way rows' grouping, the + inside a group and writing into a node (parts/two-way.js, 0.4.369) in a pretend
   Logseq window: a page with six nodes pointing at it through one property ("about"), their tags, days and a
   property of their own (Confidence), behind a stand-in for the model's doors that records every write.
   Checks: the plain list when nothing is chosen; groups by a property's value (biggest first, none last, each group
   folding), by tag and by month; the + in a group (not in a month or a "none" group) opening its line in the group and
   making the node with the row's property, the group's tag or value and nothing else; a node's arrow opening its
   bullets, the links in them, a new bullet written into the node (and nothing before Enter), the faded Undo taking it
   away, and the arrow closing it; and nothing left on stop. Since 0.4.423 also the "mentioned in" row (the nodes whose
   words link the page, a node already in a property's row left out, no +, a mention with no tag offered to be made the
   node its words look like, with Undo, one with a tag offered nothing, the row hidden on the page from its right-click),
   and following a chain from an opened node (a chevron before a value that is another node, that node opened under the
   property with its properties and what points at it, no chevron for a node open above, none three deep, closing
   with the chevron or the node). Needs node and jsdom.
   Run from the repo root: node tools/two-way-rows-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
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
  { id: 106, title: 'What is the best first gap?', tag: 'Question', day: 0 },
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
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/two-way.js'), 'utf8'));
  const calls = [];
  const bullets = new Map([[U(101), [{ uuid: U(701), title: 'Cepeda reviewed 254 studies.' }, { uuid: U(702), title: 'See [[Testing effect]].' }]]]);
  let nextBlock = 800;
  const provided = {
    currentPage: async () => ({ id: 5, uuid: PAGE }),
    getPage: async () => ({ id: 5, uuid: PAGE }),
    linksInto: async () => ({
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
    ] }),
    propPages: async () => [{ id: 61, uuid: U(61), title: 'Cepeda 2006', lower: 'cepeda 2006', tags: [{ id: 60 }] }, { id: 62, uuid: U(62), title: 'Rohrer 2015', lower: 'rohrer 2015', tags: [{ id: 60 }] }, { id: 63, uuid: U(63), title: 'Memory techniques', lower: 'memory techniques', tags: [] }],
    pagesAmong: async () => 0,
    tagUuidNamed: async title => `tag-${title.toLowerCase()}`,
    journalTitleFor: async () => 'Oct 24th, 2026',
    journalIdFor: async () => 900,
    uuidById: async () => JOURNAL,
    titleNow: async () => 'Spaced repetition',
    idByUuid: async () => 5,
    nodeFields: async () => new Map(),
    // A node's own properties (0.4.410): the tag gives about, Confidence, Severity and Source (a link to a source page).
    fieldsOf: async () => (await provided.propSchema()).props,
    valuesOf: async (uuid, ident) => calls.filter(c => c[0] === 'setValue' && c[1] === uuid && c[2] === ident).slice(-1).map(c => JSON.parse(c[3])).flat().filter(v => typeof v === 'number').concat(ident === 'user.property/confidence' && !calls.some(c => c[1] === uuid && c[2] === ident) ? (NODES.find(n => U(n.id) === uuid)?.confidence ? [NODES.find(n => U(n.id) === uuid).confidence[1]] : []) : []),
    firstLines: async uuid => (bullets.get(uuid) || []).slice(0, 9),
    appendBlock: async (target, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['appendBlock', target, text, block.uuid]); return block; },
    addLineTo: async (uuid, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['addLineTo', uuid, text, block.uuid]); bullets.set(uuid, [...(bullets.get(uuid) || []), { uuid: block.uuid, title: text }]); return block; },
    removeBlock: async uuid => { calls.push(['removeBlock', uuid]); for (const [node, list] of bullets) bullets.set(node, list.filter(b => b.uuid !== uuid)); },
    addTag: async (uuid, tag) => { calls.push(['addTag', uuid, tag]); },
    setValue: async (uuid, ident, value, opts) => { calls.push(['setValue', uuid, ident, JSON.stringify(value), JSON.stringify(opts || null)]); },
    unsetValue: async () => {},
    removeTag: async () => {}, createPage: async () => ({ uuid: U(++nextBlock) }), deletePage: async () => {}, editBlock: async () => {},
  };
  const early = [], saved = [];
  window.refinementCore = {
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, isEntityId: n => Number.isSafeInteger(n) && n > 0,
    watchDomEarly: fn => early.push(fn), addsElements: () => true, sendStyle() {}, uuidsIn: () => '', saveSettings(changes) { saved.push(changes); Object.assign(window.logseq.settings, changes); },
    onPageChange() {}, onDatabaseChange() {}, onSettingsChange() {}, provided,
    provide(things) { Object.assign(provided, things); },
  };
  const part = window.refinementParts.find(p => p.name === 'two-way');
  part.provide(window.refinementCore);
  part.start();
  return { window, doc, calls, part, bullets, saved };
}
const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const type = (window, input, text) => { input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
const enter = (window, input) => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
// The outline (0.4.442): a node's chevron by its uuid (inside: under the node of that uuid), what an open node holds.
const parentOf = key => key.split('>').slice(0, -1).join('>');
const chevOf = (doc, uuid, inside) => [...doc.querySelectorAll(`.rf-chev[data-dig][data-uuid="${uuid}"]`)].find(c => !inside || parentOf(c.dataset.dig).endsWith(inside));
const kidsOf = (doc, uuid) => [...doc.querySelectorAll('.rf-ol-kids[data-key]')].find(k => k.dataset.key.endsWith('>' + uuid));
const isOpenChev = c => c?.getAttribute('aria-expanded') === 'true';
const names = doc => [...doc.querySelectorAll('.rf-tw-gname')].map(el => el.textContent.trim());
const counts = doc => [...doc.querySelectorAll('.rf-tw-gn')].map(el => el.textContent.trim());
const groupEl = (doc, name) => [...doc.querySelectorAll('.rf-tw-group')].find(g => g.querySelector('.rf-tw-gname')?.textContent.trim() === name);

(async () => {
  // 1. Nothing chosen: the list as it was, with the quiet word to group it by.
  {
    const { window, doc, part } = world('');
    await wait(120);
    check(!!doc.querySelector('.refinement-two-way .rf-tw-row'), 'the rows should be drawn');
    check(!doc.querySelector('.rf-tw-group'), 'with no grouping chosen the list should not be in groups');
    check(doc.querySelectorAll('.rf-tw-line').length === 5 && !!doc.querySelector('[data-more]'), 'the plain list should show five lines and "show all"');
    check(doc.querySelector('.rf-tw-groupby')?.textContent.trim() === 'Group' && !doc.querySelector('.rf-tw-groupby[data-on]'), 'the word to group by should read "Group"');
    check(doc.querySelectorAll('.rf-tw-line .rf-chev[data-dig]').length === 5, 'every line should have its chevron, right before its name');
    check([...doc.querySelectorAll('.rf-tw-line')].every(l => l.querySelector('.rf-chev + .rf-ol-body > .rf-ol-name')), 'the chevron should sit right before the name it opens');
    // The tags' words on the line by the chevron: All folds and unfolds; a tag shows only its nodes, without the tag on each line.
    const chip = tag => doc.querySelector(`.rf-tw-value .rf-tw-chip[data-tag="${tag}"]`);
    const row = () => doc.querySelector('.rf-tw-row[data-open], .rf-tw-row:has(.rf-tw-chip)');
    const tagsShown = () => [...doc.querySelectorAll('.rf-tw-line .rf-tw-tag')].map(el => el.textContent.trim()).filter(Boolean);
    check(!!chip('') && !!chip('Claim') && tagsShown().length === 5, 'with two tags, the words by the chevron and a tag on every line: ' + tagsShown());
    click(window, chip('')); await wait(20);
    check(!row()?.hasAttribute('data-open') && !doc.querySelector('.rf-tw-line'), 'a click on All should fold the list');
    click(window, chip('')); await wait(20);
    check(row()?.hasAttribute('data-open') && doc.querySelectorAll('.rf-tw-line').length === 5, 'a second click on All should open it again');
    click(window, chip('Claim')); await wait(20);
    check(doc.querySelectorAll('.rf-tw-line').length > 0 && tagsShown().length === 0, 'with one tag picked the lines should leave the tag out: ' + tagsShown());
    // 0.4.462: in the tag's place, the property telling them apart: Confidence (held by all four Claims, two values).
    const tells = () => [...doc.querySelectorAll('.rf-tw-line .rf-tw-tell')].map(el => el.textContent.trim());
    check(tells().length === 4 && tells().every(t => t === 'Confidence Strong' || t === 'Confidence Disputed'), 'with one tag picked each line should say its Confidence, named: ' + tells());
    click(window, chip('')); await wait(20);
    check(row()?.hasAttribute('data-open') && tagsShown().length === 5, 'All with a tag picked should show every node again, still open');
    check(tells().length === 0, 'with two tags on the lines no property should stand in for them: ' + tells());
    check([...doc.querySelectorAll('.rf-tw-line')].every(l => !l.querySelector('.rf-ol-name ~ .rf-ol-day, .rf-tw-after')), 'a day should never follow a name (0.4.462)');
    // The order is gone (0.4.462): the right-click offers no Date first or Name first.
    row().querySelector('.rf-tw-name').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const menu = [...doc.querySelectorAll('.rf-pop .rf-item')].map(el => el.textContent.trim());
    check(menu.length > 0 && !menu.some(t => /Date first|Name first/.test(t)), 'the right-click should offer no Date first or Name first: ' + menu);
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
    part.stop(); await wait(10);
    check(!doc.querySelector('.refinement-two-way'), 'nothing should be left on stop');
  }
  // 2. Grouped by Confidence: biggest first, the two with none last, the + in a group but not in "none".
  {
    const { window, doc, calls, part } = world('p:Confidence');
    await wait(150);
    check(doc.querySelector('.rf-tw-groupby[data-on]')?.textContent.trim() === 'By Confidence', 'the word should say what it is grouped by: ' + doc.querySelector('.rf-tw-groupby')?.textContent);
    check(names(doc).join() === 'Disputed,Strong,No Confidence', 'groups should be Disputed, Strong (two each, by name) then No Confidence: ' + names(doc));
    check(counts(doc).join() === '2,2,2', 'each group should say how many: ' + counts(doc));
    check(groupEl(doc, 'Strong')?.querySelectorAll('.rf-tw-line').length === 2, 'a group should list its nodes');
    check(!!groupEl(doc, 'Disputed')?.querySelector('.rf-tw-gadd') && !groupEl(doc, 'No Confidence')?.querySelector('.rf-tw-gadd'), 'a + in a group with a value, none in the group of those with none');
    // Folding.
    click(window, groupEl(doc, 'Strong').querySelector('.rf-tw-gtoggle'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.rf-tw-line').length === 0 && !groupEl(doc, 'Strong').hasAttribute('data-open'), 'a click on a group’s name should fold it');
    click(window, groupEl(doc, 'Strong').querySelector('.rf-tw-gtoggle'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.rf-tw-line').length === 2, 'and open it again');
    // The + in Disputed: the line opens in the group; Enter makes the node with the tag, about and Confidence.
    click(window, groupEl(doc, 'Disputed').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Disputed').querySelector('.rf-tw-draft-name');
    check(!!field && doc.querySelectorAll('.rf-tw-draft').length === 1, 'the line to type in should open inside the group');
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
    // The line stays open for the next one (0.4.413): empty, in the same group, with the keyboard in it; a second node
    // gets the group's value too.
    const next = groupEl(doc, 'Disputed')?.querySelector('.rf-tw-draft-name');
    check(!!next && next.value === '' && doc.activeElement === next && doc.querySelectorAll('.rf-tw-draft').length === 1, 'the line should stay open, empty, in the group, ready to type: ' + (next ? JSON.stringify(next.value) : 'none'));
    type(window, next, 'Spacing helps little with maths');
    enter(window, next);
    await wait(80);
    const second = calls.filter(c => c[0] === 'appendBlock')[1];
    check(second && second[2] === 'Spacing helps little with maths' && calls.some(c => c[0] === 'setValue' && c[1] === second[3] && c[2] === 'user.property/confidence' && c[3] === '302'), 'a second node from the line left open should get the group’s value too: ' + JSON.stringify(calls.filter(c => c[1] === second?.[3])));
    next.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(20);
    check(!doc.querySelector('.rf-tw-draft'), 'Escape on the empty line should close it');
    check(!!doc.querySelector('.rf-undo'), 'the faded Undo arrow should be offered');
    part.stop();
  }
  // 3. Grouped by tag: the + gives the group's tag and sets no other value.
  {
    const { window, doc, calls, part } = world('tag');
    await wait(120);
    check(names(doc).join() === 'Claim,Question', 'groups by tag, biggest first: ' + names(doc));
    check(!!doc.querySelector('.rf-tw-group .rf-tag.rf-tw-gname'), 'a tag should read as a tag in its group’s name');
    click(window, groupEl(doc, 'Question').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Question').querySelector('.rf-tw-draft-name');
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
    check(counts(doc).join() === '3,2,1' && !doc.querySelector('.rf-tw-gadd'), 'with their counts and no +: ' + counts(doc));
    part.stop();
  }
  // 4b. Grouped by a number: a scale in order (not biggest first), named with its property; the + writes the number itself.
  {
    const { window, doc, calls, part } = world('p:Severity');
    await wait(150);
    check(names(doc).join() === 'Severity 1,Severity 2,Severity 3,No Severity', 'numbers should be in order, named with their property: ' + names(doc));
    check(counts(doc).join() === '1,1,2,2', 'with their counts: ' + counts(doc));
    click(window, groupEl(doc, 'Severity 3').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Severity 3').querySelector('.rf-tw-draft-name');
    type(window, field, 'Spacing needs sleep');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(calls.some(c => c[0] === 'setValue' && c[1] === made?.[3] && c[2] === 'user.property/severity' && c[3] === '3' && c[4] === 'null'), 'a number should be written as the number: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
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
    const bulletWords = () => [...(kidsOf(doc, node)?.querySelectorAll('.rf-ol-bullet:not(.rf-ol-new) .rf-ol-words') || [])].map(el => el.textContent);
    check(!!box && bulletWords().join('|') === 'Cepeda reviewed 254 studies.|See Testing effect.', 'the node’s bullets should show under its line: ' + box?.textContent);
    check(!!box?.querySelector('.rf-tw-peek-open[data-open-page="Testing effect"]'), 'a link in a bullet should open its page');
    check(isOpenChev(arrow()), 'the chevron should show it is open');
    check(!!box?.closest('.rf-ol-unit.rf-ol-focus'), 'the node opened last should be the focus, its line and what it holds on the faint grey');
    check(!!box?.querySelector('.rf-ol-new .rf-ol-dot') && !box?.querySelector('.rf-field-inline'), 'a bullet should be written as a bullet: a faint dot, no field with a line under it');
    check(calls.length === 0, 'opening should write nothing');
    const field = doc.querySelector(`.rf-tw-node-field[data-uuid="${node}"]`);
    type(window, field, 'Check the anatomy course.');
    check(calls.length === 0, 'typing should write nothing until Enter');
    enter(window, field);
    await wait(100);
    check(calls.some(c => c[0] === 'addLineTo' && c[1] === node && c[2] === 'Check the anatomy course.'), 'Enter should write the bullet into the node: ' + JSON.stringify(calls));
    check(bulletWords().length === 3, 'the new bullet should show in the list');
    check(doc.querySelector(`.rf-tw-node-field[data-uuid="${node}"]`)?.value === '', 'the line to type in should be empty again');
    const arrowUndo = doc.querySelector('.rf-undo');
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
  // 6. The + line proposes the rest (0.4.406): under the line, the row's property on this page, then what the rules
  //    say for the words (through a pretend draftProposals); Escape clears them until typing again; a click on a guess
  //    keeps that one and the other guess fades; Enter sets the row's property, the kept guess and the sure day.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const asked = [];
    window.refinementCore.provided.draftProposals = async draft => {
      asked.push(draft);
      if (!/scan/.test(draft.text)) return [];
      return [
        { ident: 'user.property/topic', title: 'Topic', kind: 'node', ids: [77], shown: 'Colon cancer', names: null, guess: true, many: false, day: 0, journalId: null },
        { ident: 'user.property/with', title: 'with', kind: 'node', ids: [78], shown: 'Ruth Okoro', names: null, guess: true, many: true, day: 0, journalId: null },
        { ident: 'user.property/date', title: 'Date', kind: 'day', ids: [900], shown: 'Oct 24', names: null, guess: false, many: false, day: 20261024, journalId: 900 },
      ];
    };
    const esc = (window, input) => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    click(window, doc.querySelector('.rf-tw-add'));
    await wait(40);
    const field = () => doc.querySelector('.rf-tw-draft-name');
    const props = () => [...doc.querySelectorAll('.rf-tw-draft-props .rf-tw-dprop')].map(el => el.textContent.trim());
    check(!!field() && props().length === 1 && /^about/.test(props()[0]), 'the line should say what the row sets before anything is typed: ' + props());
    const first = props()[0];
    type(window, field(), 'Follow-up about the scan results');
    await wait(400);
    const last = asked[asked.length - 1];
    check(!!last && last.tag === 'Claim' && last.set.some(s => s.ident === 'user.property/about' && s.ids[0] === 5) && last.journalDay > 20260000, 'the rules should be asked with the tag, the row’s property set and today: ' + JSON.stringify(last));
    check(props().join('|') === `${first}|TopicColon cancer|withRuth Okoro|DateOct 24`, 'the proposals should show under the line: ' + props());
    check(doc.querySelectorAll('.rf-tw-dpick .rf-pencil').length === 3 && !doc.querySelector('.rf-tw-dghost, .rf-tw-dguess'), 'every value pencilled in should be the one pencilled look, sure and guessed alike (0.4.315)');
    check(calls.length === 0, 'nothing should be written while they show');
    esc(window, field());
    check(props().length === 1 && !!doc.querySelector('.rf-tw-draft'), 'Escape should clear the proposals and keep the line: ' + props());
    type(window, field(), 'Follow-up about the scan results.');
    await wait(400);
    check(props().length === 4, 'typing again should bring them back: ' + props());
    click(window, doc.querySelector('.rf-tw-dpick[data-pkey="user.property/topic|77"]'));
    check(!!doc.querySelector('.rf-tw-dpick[data-pkey="user.property/topic|77"] .rf-pencil-taken') && !!doc.querySelector('.rf-tw-dpick[data-pkey="user.property/with|78"] .rf-tw-dpassed'), 'the kept guess should read solid and the other faded');
    enter(window, field());
    await wait(40);
    check(!!doc.querySelector('.rf-tw-draft-where') && props().length === 4, 'the where step should keep the proposals under the line: ' + props());
    enter(window, doc.querySelector('.rf-tw-draft-where'));
    await wait(150);
    const uuid = calls.find(c => c[0] === 'appendBlock')?.[3];
    const sets = calls.filter(c => c[0] === 'setValue' && c[1] === uuid).map(c => c.slice(2).join(' '));
    check(sets.includes('user.property/about 5 {"entityId":true}') && sets.includes('user.property/topic 77 {"entityId":true}') && sets.includes('user.property/date 900 null') && !sets.some(x => x.startsWith('user.property/with')), 'Enter should set the row’s property, the kept guess and the sure day, not the guess let go: ' + JSON.stringify(sets));
    check(doc.querySelector('.rf-tw-draft-name')?.value === '' && !doc.querySelector('.rf-tw-dpick') && !!doc.querySelector('.rf-undo'), 'the line should be open again, empty, with nothing proposed, and the Undo arrow offered');
    part.stop();
  }
  // 6b. Nothing kept: Enter takes every proposal shown, several at once for a property that holds several; with a
  //     second Escape the line closes; without the rules nothing is asked.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    window.refinementCore.provided.draftProposals = async () => [{ ident: 'user.property/topic', title: 'Topic', kind: 'node', ids: [77], shown: 'Colon cancer', guess: true, many: false }, { ident: 'user.property/with', title: 'with', kind: 'node', ids: [78, 79], shown: 'Ruth Okoro, Tunde Okoro', guess: true, many: true }];
    click(window, doc.querySelector('.rf-tw-add'));
    await wait(40);
    const field = doc.querySelector('.rf-tw-draft-name');
    type(window, field, 'Spoke about the next cycle');
    await wait(400);
    enter(window, field);
    await wait(40);
    enter(window, doc.querySelector('.rf-tw-draft-where'));
    await wait(150);
    const uuid = calls.find(c => c[0] === 'appendBlock')?.[3];
    const sets = calls.filter(c => c[0] === 'setValue' && c[1] === uuid).map(c => c.slice(2).join(' '));
    check(sets.includes('user.property/topic 77 {"entityId":true}') && sets.includes('user.property/with [78,79] {"entityId":true,"reset":true}'), 'Enter with nothing kept should set every guess: ' + JSON.stringify(sets));
    // The line left open: a node put on this page (Down, Enter in the where step); the next one lights this page again.
    const again = doc.querySelector('.rf-tw-draft-name');
    check(!!again && !doc.querySelector('.rf-tw-add[data-field="about"]'), 'the line should be open again in place of the +');
    type(window, again, 'Put here');
    enter(window, again);
    await wait(40);
    const where1 = doc.querySelector('.rf-tw-draft-where');
    where1.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    enter(window, where1);
    await wait(150);
    check(calls.filter(c => c[0] === 'appendBlock').pop()?.[1] === PAGE, 'Down, Enter should put the node on this page');
    const again2 = doc.querySelector('.rf-tw-draft-name');
    type(window, again2, 'Put here too');
    enter(window, again2);
    await wait(40);
    enter(window, doc.querySelector('.rf-tw-draft-where'));
    await wait(150);
    check(calls.filter(c => c[0] === 'appendBlock').pop()?.[1] === PAGE, 'the next node should go where the last one went, its place lit: ' + JSON.stringify(calls.filter(c => c[0] === 'appendBlock').map(c => c[1])));
    const again3 = doc.querySelector('.rf-tw-draft-name');
    type(window, again3, 'Another');
    await wait(400);
    again3.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    again3.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!doc.querySelector('.rf-tw-draft'), 'a second Escape should close the line');
    part.stop();
  }
  // 7. A page's name in the words (0.4.406): the rest in grey after the cursor through the suggested links' own reading
  //    (a pretend one here), with whose name it is; the Right arrow writes [[the page]]; nothing without a name.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const seen = [];
    window.refinementCore.provided.linkSuggestInner = { suggestFor: (text, caret, pages, opts) => { seen.push([text, caret, opts]); return /Dr\. Pat$/.test(text) ? { start: text.length - 7, end: text.length, span: 'Dr. Pat', title: 'Dr. Raj Patel', ghost: 'el', name: 'Dr. Raj Patel' } : null; } };
    click(window, doc.querySelector('.rf-tw-add'));
    await wait(40);
    const field = doc.querySelector('.rf-tw-draft-name');
    type(window, field, 'Spoke with Dr. Pat');
    await wait(80);
    const rest = doc.querySelector('.rf-tw-ghost-rest');
    check(seen.length > 0 && rest?.textContent === 'el' && rest.getAttribute('data-name') === 'Dr. Raj Patel' && doc.querySelector('.rf-tw-ghost-typed')?.textContent === 'Spoke with Dr. Pat', 'the rest of the name should show in grey after the words: ' + rest?.textContent);
    field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    check(field.value === 'Spoke with [[Dr. Raj Patel]]' && !doc.querySelector('.rf-tw-ghost-over'), 'the Right arrow should write the link in the line: ' + field.value);
    type(window, field, 'Spoke with [[Dr. Raj Patel]] about');
    await wait(80);
    check(!doc.querySelector('.rf-tw-ghost-over'), 'with no name to complete, nothing grey should show');
    check(calls.length === 0, 'nothing should be written by the name');
    part.stop();
  }
  // 8. A page's name in the line that writes a bullet into a node (0.4.409): the same grey rest of the name, asked with
  //    the node's own tag; the Right arrow writes the link; Escape takes the grey away first and leaves the line;
  //    Enter writes the bullet with the link in it.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const seen = [];
    window.refinementCore.provided.linkSuggestInner = {
      suggestFor: (text, caret, pages, opts) => { seen.push([text, opts]); return /Dr\. Pat$/.test(text) ? { start: text.length - 7, end: text.length, span: 'Dr. Pat', title: 'Dr. Raj Patel', ghost: 'el', name: 'Dr. Raj Patel' } : null; },
      boostFor: (tagIds) => new Set(tagIds),
    };
    window.refinementCore.provided.propPages = async () => [{ id: 41, title: 'Claim', lower: 'claim', isTag: true, tags: [] }];
    window.refinementCore.provided.propSchema = async () => ({ props: [] });
    const node = U(101);
    click(window, chevOf(doc, node));
    await wait(80);
    const field = () => doc.querySelector(`.rf-tw-node-field[data-uuid="${node}"]`);
    field().focus(); // a click on the faint empty bullet
    type(window, field(), 'Ask Dr. Pat');
    await wait(80);
    check(kidsOf(doc, node)?.querySelector('.rf-tw-ghost-rest')?.textContent === 'el', 'the rest of the name should show in grey in the node’s line: ' + doc.querySelector('.rf-tw-ghost-rest')?.textContent);
    check(seen.length > 0 && seen[seen.length - 1][1]?.boost?.has(41), 'the name should be asked for with the node’s own tag');
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!doc.querySelector('.rf-tw-ghost-over') && doc.activeElement === field(), 'Escape should take the grey name away and keep the line');
    type(window, field(), 'Ask Dr. Pat');
    await wait(80);
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    check(field()?.value === 'Ask [[Dr. Raj Patel]]', 'the Right arrow should write the link in the node’s line: ' + field()?.value);
    enter(window, field());
    await wait(100);
    check(calls.some(c => c[0] === 'addLineTo' && c[1] === node && c[2] === 'Ask [[Dr. Raj Patel]]'), 'Enter should write the bullet with the link: ' + JSON.stringify(calls));
    part.stop();
  }
  // 9. A node's properties in its opened box (0.4.410): the tag's properties but the row's own ("about", pointing here),
  //    each with what it holds or "empty"; a click asks in the kit's list, the likely ones first for a link (a pretend
  //    pickerOrder); a pick sets it, Undo puts back what it held; a number is shown ready to change; Clear at the end of
  //    a list clears it (empty and Enter would take the lit row).
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const asked = [];
    window.refinementCore.provided.pickerOrder = async (uuid, title) => { asked.push([uuid, title]); return title === 'Source' ? [62] : []; };
    const node = U(103);
    click(window, chevOf(doc, node));
    await wait(120);
    const propLines = () => [...(kidsOf(doc, node)?.querySelectorAll('.rf-ol-prop:not(.rf-tw-back)') || [])].filter(l => l.querySelector('.rf-ol-pname').textContent.trim());
    const rows = () => propLines().map(l => l.querySelector('.rf-ol-pname').textContent.trim() + '=' + l.querySelector('.rf-ol-pv').textContent.trim());
    check(rows().join('|') === 'Confidence=Disputed|Severity=1|Source=empty', 'the node’s own properties should show above its bullets, the one pointing back at this page left out (0.4.451: the row it opened from names it): ' + rows());
    check(!!kidsOf(doc, node)?.querySelector('.rf-tw-npvalue.rf-faint'), 'an empty one should read "empty" in grey');
    // A node property carries the triangle of dots; a fact carries the icon of what it holds (0.4.477, the owner: "a
    // property always shows its icon, on pages too"), never the triangle.
    const marked = propLines().filter(l => l.querySelector('.rf-ol-pname .rf-kind .rf-drawn-joins')).map(l => l.querySelector('.rf-ol-pname').textContent.trim());
    const iconed = propLines().filter(l => l.querySelector('.rf-ol-pname .rf-kind i')).map(l => l.querySelector('.rf-ol-pname').textContent.trim());
    check(marked.join('|') === 'Source' && iconed.join('|') === 'Confidence|Severity|Source', 'every property should carry its icon, only the node property the triangle of dots: ' + marked + ' / ' + iconed);
    check(calls.length === 0, 'opening should write nothing');
    const value = name => propLines().find(l => l.querySelector('.rf-ol-pname').textContent.trim() === name)?.querySelector('.rf-ol-pv [data-edit]');
    // Since 1.0.3 a value is changed as Logseq does it: a link or a choice in Logseq's own picker (its classes), a
    // number typed where it sits.
    const popRows = () => [...doc.querySelectorAll('.rf-lsq-pop .menu-link')].map(el => el.textContent.trim());
    const popField = () => doc.querySelector('.rf-lsq-pop input');
    const inPlace = () => doc.querySelector('.rf-in-place');
    // A link: the likely one first.
    click(window, value('Source'));
    await wait(80);
    check(asked.some(a => a[0] === node && a[1] === 'Source') && popRows()[0] === 'Rohrer 2015' && popRows().includes('Cepeda 2006') && !popRows().includes('Memory techniques'), 'the list should put the likely page first and hold only pages the property takes: ' + popRows());
    popField().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.some(c => c[0] === 'setValue' && c[1] === node && c[2] === 'user.property/source' && c[3] === '[62]'), 'Enter should set the lit page, as a list for a property that holds several: ' + JSON.stringify(calls));
    const undo = [...doc.querySelectorAll('.rf-undo')].find(u => /Set “Source” on/.test(u.title || ''));
    check(!!undo, 'the faded Undo arrow should be offered: ' + [...doc.querySelectorAll('.rf-undo')].map(u => u.title));
    // A number: shown ready to change; the same words again change nothing; a new one is written as a number.
    click(window, value('Severity'));
    await wait(80);
    check(inPlace()?.value === '1' && !!inPlace()?.closest('.rf-ol-pv') && !doc.querySelector('.rf-lsq-pop, .rf-pop'), 'a number should be typed where it sits, ready to change, with no pop-up: ' + inPlace()?.value);
    inPlace().value = '3'; inPlace().dispatchEvent(new window.Event('input', { bubbles: true }));
    inPlace().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.some(c => c[0] === 'setValue' && c[1] === node && c[2] === 'user.property/severity' && c[3] === '3' && c[4] === 'null'), 'a number should be written as the number: ' + JSON.stringify(calls.filter(c => c[2] === 'user.property/severity')));
    // A choice: Clear at the list's end clears it.
    click(window, value('Confidence'));
    await wait(80);
    check(popRows().join('|') === 'Disputed|Strong|Clear', 'a choice should list what it holds first, then the other choices, then Clear (as Logseq lists them): ' + popRows());
    const unsets = calls.length;
    window.refinementCore.provided.unsetValue = async (uuid, ident) => { calls.push(['unsetValue', uuid, ident]); };
    click(window, [...doc.querySelectorAll('.rf-lsq-pop .menu-link')].find(el => el.textContent.trim() === 'Clear'));
    await wait(150);
    check(calls.slice(unsets).some(c => c[0] === 'unsetValue' && c[1] === node && c[2] === 'user.property/confidence') && !calls.slice(unsets).some(c => c[0] === 'setValue'), 'Clear should clear it and set nothing: ' + JSON.stringify(calls.slice(unsets)));
    // Undo of the Source pick puts back what it held (nothing): the arrow as it is drawn now.
    const undoNow = [...doc.querySelectorAll('.rf-undo')].find(u => /Set “Source” on/.test(u.title || ''));
    if (undoNow) { click(window, undoNow); await wait(150); }
    check(calls.some(c => c[0] === 'unsetValue' && c[1] === node && c[2] === 'user.property/source'), 'Undo should put back what Source held, nothing: ' + JSON.stringify(calls.filter(c => c[2] === 'user.property/source')));
    part.stop();
  }
  // 10. The picking bar's "Change … to…" (0.4.414): the pages the picked nodes' words name come first, the most named
  //     first, asked with the field's tags (a pretend namedPages); without the reader, the list as it was.
  {
    const { window, doc, calls, part } = world('');
    await wait(120);
    const asked = [];
    window.refinementCore.provided.namedPages = async (text, tagIds) => { asked.push([text, tagIds]); return /recall/.test(text) ? [62, 61] : /review/.test(text) ? [62] : []; };
    window.refinementCore.provided.propSchema = async () => ({ props: [{ ident: 'user.property/about', title: 'about', lower: 'about', type: 'node', many: false, choices: [], classes: [{ id: 60 }] }] });
    window.refinementCore.provided.valuesOf = async () => [5];
    const pick = uuid => click(window, doc.querySelector(`.rf-tw-pick[data-pick="${uuid}|about"]`));
    pick(U(101)); await wait(20); pick(U(102)); await wait(20);
    click(window, doc.querySelector('.rf-tw-bar [data-act="page-menu"]'));
    await wait(40);
    click(window, [...doc.querySelectorAll('.rf-pop .rf-item')].find(el => /^Change/.test(el.textContent.trim())));
    await wait(120);
    const listed = [...doc.querySelectorAll('.rf-lsq-pop .menu-link')].map(el => el.textContent.trim());
    const hint = doc.querySelector('.rf-lsq-pop input')?.placeholder || '';
    check(asked.length === 2 && asked.every(a => a[1].join() === '60'), 'each picked node’s words should be read, with the field’s tags: ' + JSON.stringify(asked));
    check(listed.join('|') === 'Rohrer 2015|Cepeda 2006', 'the page both nodes name should come first, then the one named once: ' + listed);
    check(/^Change “.+” to …$/.test(hint), 'the field should say what it asks, as Logseq’s does (“Set Works at”), with no hint: ' + hint);
    doc.querySelector('.rf-lsq-pop input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(150);
    check(calls.filter(c => c[0] === 'setValue' && c[2] === 'user.property/about').every(c => c[3] === '62') && calls.filter(c => c[0] === 'setValue').length === 2, 'Enter should point both at the first page: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // 11. Mentions come up to the rows (0.4.423): the nodes whose words link the page, one already pointing here through
  //     "about" left out; no + in the row; a mention with a tag gets no offer; one without is offered the tag its words
  //     look like (a pretend tagGuess) with the property that takes this page, shown under it before anything is
  //     written, made with a click and taken back with Undo; the row hidden on this page from its right-click.
  {
    const { window, doc, calls, part, saved } = world('');
    const p = window.refinementCore.provided;
    p.mentionsInto = async id => id === 5 ? [
      { id: 201, uuid: U(201), title: 'Called [[Spaced repetition]] about the scan', tag: '', day: 20260803 },
      { id: 202, uuid: U(202), title: 'Spaced repetition felt easier today', tag: 'Symptom Log', day: 20260909 },
      { id: 101, uuid: U(101), title: NODES[0].title, tag: 'Claim', day: 20260901 },
    ] : [];
    const spoke = { id: 81, ident: 'user.property/spoke-with', title: 'Spoke with', lower: 'spoke with', type: 'node', many: true, choices: [], classes: [{ id: 70 }] };
    const schema = await p.propSchema();
    p.propSchema = async () => ({ ...schema, props: [...schema.props, spoke], byId: new Map([[81, spoke]]), classProps: new Map([[71, [81]]]), parentsOf: new Map(), builtIn: new Set() });
    p.propPages = async () => [{ id: 5, uuid: PAGE, title: 'Spaced repetition', lower: 'spaced repetition', tags: [{ id: 70 }] }, { id: 71, uuid: U(71), title: 'Conversation', lower: 'conversation', isTag: true, tags: [] }, { id: 72, uuid: U(72), title: 'Claim', lower: 'claim', isTag: true, tags: [] }];
    p.tagGuess = async uuid => uuid === U(201) ? { id: 71, uuid: U(71), title: 'Conversation' } : null;
    p.hasTag = async () => false;
    p.valuesOf = async () => [];
    p.removeTag = async (uuid, tag) => { calls.push(['removeTag', uuid, tag]); };
    p.unsetValue = async (uuid, ident) => { calls.push(['unsetValue', uuid, ident]); };
    await wait(150);
    const row = () => doc.querySelector('.rf-tw-row[data-field=" mentioned in"]');
    check(!!row() && row().querySelector('.rf-tw-name')?.textContent.trim() === 'Mentioned in', 'a "Mentioned in" row should be drawn: ' + row()?.querySelector('.rf-tw-name')?.textContent);
    check(doc.querySelectorAll('.rf-tw-row')[doc.querySelectorAll('.rf-tw-row').length - 1] === row(), 'the mentions should come after the rows from properties');
    const listed = () => [...(row()?.querySelectorAll('.rf-tw-record') || [])].map(a => a.textContent.trim());
    check(listed().join('|') === 'Spaced repetition felt easier today|Called Spaced repetition about the scan', 'the two mentions, latest first, links read as words, the node already in "about" left out: ' + listed());
    check(!row()?.querySelector('.rf-tw-add'), 'the mentions row should have no +');
    const pick = uuid => click(window, doc.querySelector(`.rf-tw-pick[data-pick="${uuid}| mentioned in"]`));
    pick(U(202)); await wait(80);
    check(!doc.querySelector('.rf-tw-bar [data-act="raise"]') && !doc.querySelector('.rf-tw-bar [data-act="page-menu"]'), 'a mention with a tag should be offered nothing, and the page’s own actions should not show for a mention');
    pick(U(202)); pick(U(201)); await wait(120);
    const raiseBtn = () => doc.querySelector('.rf-tw-bar [data-act="raise"]');
    check(/Make it a Conversation/.test(raiseBtn()?.textContent || ''), 'a mention with no tag should be offered the tag its words look like: ' + raiseBtn()?.textContent);
    // On its line too (0.4.438): "could be a Conversation · …" in italic, a click opening Make it… for that mention alone.
    const could = doc.querySelector(`.rf-pencil[data-could="${U(201)}"]`);
    check(/could be a Conversation/.test(could?.textContent || ''), 'the untagged mention should say what it could be on its line: ' + could?.textContent);
    check(!doc.querySelector(`[data-could="${U(202)}"]`), 'a mention with a tag should not say what it could be');
    const preview = [...(doc.querySelector('.rf-tw-raise')?.querySelectorAll('.rf-tw-dprop') || [])].map(el => el.textContent.trim());
    check(preview.join('|') === 'TagsConversation|Spoke withSpaced repetition', 'what it would get should show under it in grey: ' + preview);
    check(calls.length === 0, 'picking should write nothing');
    click(window, raiseBtn()); await wait(80);
    const items = [...doc.querySelectorAll('.rf-pop .rf-item')];
    check(/Conversation · Spoke with/.test(items[0]?.textContent || '') && /look like/.test(items[0]?.textContent || ''), 'the menu should offer the guessed tag first: ' + items.map(i => i.textContent));
    click(window, items[0]); await wait(200);
    check(calls.some(c => c[0] === 'addTag' && c[1] === U(201) && c[2] === U(71)), 'the tag should be added: ' + JSON.stringify(calls));
    check(calls.some(c => c[0] === 'setValue' && c[1] === U(201) && c[2] === 'user.property/spoke-with' && c[3] === '[5]'), 'the property should point at this page: ' + JSON.stringify(calls));
    check(!calls.some(c => c[1] === U(202)), 'the mention with a tag should be left alone');
    const undo = [...doc.querySelectorAll('.rf-undo')].find(u => /Conversation/.test(u.title || ''));
    check(!!undo, 'the faded Undo arrow should be offered: ' + [...doc.querySelectorAll('.rf-undo')].map(u => u.title));
    if (undo) { click(window, undo); await wait(200); }
    check(calls.some(c => c[0] === 'unsetValue' && c[1] === U(201)) && calls.some(c => c[0] === 'removeTag' && c[1] === U(201) && c[2] === U(71)), 'Undo should take the property and the tag off again: ' + JSON.stringify(calls));
    // Hide the row on this page from its right-click.
    row().querySelector('.rf-tw-name').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const hide = [...doc.querySelectorAll('.rf-pop .rf-item')].find(el => /Hide mentions on this page/.test(el.textContent));
    check(!!hide && ![...doc.querySelectorAll('.rf-pop .rf-item')].some(el => /Rename/.test(el.textContent)), 'the right-click should offer to hide the row, not to rename it');
    if (hide) { click(window, hide); await wait(120); }
    check(saved.some(x => x.twoWayMentionsHidden === 'Spaced repetition'), 'the page should be added to the pages without the row: ' + JSON.stringify(saved));
    part.stop();
  }
  // 11b. Reads back as … (1.0.4): from a property row's right-click, the words are typed on the row's own name, as a page
  //      is renamed in Logseq (no pop-up); Enter keeps them and saves the setting, with the Undo arrow; Escape leaves it.
  {
    const { window, doc, part, saved } = world('');
    await wait(120);
    const prow = [...doc.querySelectorAll('.rf-tw-row')].find(r => r.querySelector('.rf-tw-field'));
    const nameEl = prow?.querySelector('.rf-tw-name');
    const label = nameEl?.textContent.trim();
    nameEl.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    const item = [...doc.querySelectorAll('.rf-pop .rf-item')].find(el => /Reads back as/.test(el.textContent));
    check(!!item, 'the right-click on a property row should offer Reads back as …');
    click(window, item); await wait(80);
    const field = () => nameEl.querySelector('.rf-in-place');
    check(!!field() && field().value === label && !doc.querySelector('.rf-pop:popover-open, .rf-lsq-pop'), 'the words should be typed on the row’s own name, holding its name, with no pop-up: ' + field()?.value);
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(40);
    check(!field() && nameEl.textContent.trim() === label && !saved.some(x => 'twoWayNames' in x), 'Escape should leave the name as it was and save nothing');
    nameEl.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(40);
    click(window, [...doc.querySelectorAll('.rf-pop .rf-item')].find(el => /Reads back as/.test(el.textContent))); await wait(80);
    field().value = 'doctor of';
    field().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(120);
    check(saved.some(x => /doctor of/.test(x.twoWayNames || '')), 'Enter should save the words for the property: ' + JSON.stringify(saved));
    check([...doc.querySelectorAll('.rf-undo')].some(u => /doctor of/.test(u.title || '')), 'the faded Undo arrow should be offered');
    part.stop();
  }
  // 12. Follow a chain (0.4.423): in an opened node a chevron before a value that is another node; a click opens that node
  //     under the property, with its properties and the rows that point at it; no chevron for a node open above, none
  //     three deep; the chevron and closing the node close it; nothing written.
  {
    const { window, doc, calls, part } = world('');
    const p = window.refinementCore.provided;
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
    check(!!box(U(103))?.querySelector('.rf-ol-prop .rf-tag'), 'a value that is a node should show its tag after its name');
    click(window, chev(U(103), U(61))); await wait(150);
    check(!!box(U(61)) && box(U(61)).parentElement.firstElementChild.contains(chev(U(103), U(61))), 'the chevron should open that node under its own line, which stays where it was');
    const own = el => el.closest('.rf-ol-kids') === box(U(61));
    const names61 = [...(box(U(61))?.querySelectorAll('.rf-ol-pname') || [])].filter(own).map(el => el.textContent.trim()).filter(Boolean);
    check(names61.filter(n => n === 'Source').length === 2, 'it should show its property and, named by that property itself, what points at it: ' + names61);
    check(!doc.querySelector('.rf-tw-name .rf-tw-arrow') && [...doc.querySelectorAll('.rf-tw-name')].every(n => !/ of$/.test(n.textContent.trim())), 'a row should be named by its property, nothing added, no arrow (0.4.444)');
    check([...box(U(61)).querySelectorAll('.rf-tw-back .rf-tw-record')].filter(own).length === 1, 'what points at it should be listed one name per line, the way back left out');
    // 0.4.462: the nodes that link to it under a line saying so, the arrow for the node above, after its own properties.
    const links = [...(box(U(61))?.querySelectorAll('.rf-tw-links') || [])].filter(own);
    check(links.length === 1 && links[0].textContent.trim() === '1 node links to ↑', 'the nodes linking to it should come under "1 node links to ↑": ' + links.map(l => l.textContent));
    check(!!links[0]?.nextElementSibling?.matches('.rf-tw-linked') && !!links[0].nextElementSibling.querySelector('.rf-tw-back'), 'the lines linking to it should sit under that line');
    check(![...(box(U(61))?.querySelectorAll('.rf-tw-linked .rf-ol-prop:not(.rf-tw-back)') || [])].filter(own).length, 'its own properties should not sit under that line');
    check(!chev(U(61), U(103)) && !!chev(U(61), U(104)), 'the node on the way should not be listed again, another node should');
    click(window, chev(U(61), U(104))); await wait(150);
    // A level whose lines would break (0.4.464; 0.4.463 at the fourth): the same chevron; opening it shifts the outline by
    // one level: the node opened from the row becomes the section's top, the page goes into the trail, the levels under
    // it stay open.
    const stepper = chev(U(104), U(62));
    check(!!box(U(104)) && !!stepper && stepper.matches('.rf-chev'), 'three nodes deep the next node should have the same chevron');
    if (stepper) {
      // The pretend window lays nothing out: a line four opened levels deep (five boxes, with the row's list) is made
      // wider than the section, as at the owner's width.
      const deep = el => { let n = 0; for (let k = el.closest('.rf-ol-kids'); k; k = k.parentElement?.closest('.rf-ol-kids')) n++; return n; };
      Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return this.matches('.rf-ol-line') && deep(this) >= 5 ? 999 : 0; } });
      click(window, stepper); await wait(400);
      const trail = doc.querySelector('.rf-tw-stepped .rf-ol-trail');
      check(!!trail && doc.querySelectorAll('.rf-tw-stepped .rf-ol-trail [data-step]').length === 1 && /Spacing does not help/.test(trail.textContent), 'a fourth level should shift by one: the page in the trail, the node opened from the row at the top: ' + trail?.textContent);
      check(!!box(U(61)) && !!box(U(104)) && !!box(U(62)), 'the three levels under the new top should stay open, the new one with them');
      check(!doc.querySelector('.rf-tw-findrow') && !doc.querySelector('.rf-tw-bar:not([data-idle])'), 'shifted, the page’s own find field and picking bar should be away: ' + [...doc.querySelector('.refinement-two-way').children].map(c => c.className).join(' / '));
      check(doc.querySelector('.refinement-two-way')?.hasAttribute('data-rf-rows'), 'shifted, the section should still stand for the page, so Logseq’s lists stay hidden');
      // Esc does one thing: it closes the deepest node, and the section stays shifted.
      doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(300);
      check(!box(U(62)) && !!box(U(104)) && !!doc.querySelector('.rf-tw-stepped'), 'Esc should close only the deepest node: ' + !!box(U(62)) + ' ' + !!doc.querySelector('.rf-tw-stepped'));
      // The trail's page goes back to the rows, what was open still open.
      click(window, doc.querySelector('.rf-tw-stepped .rf-ol-trail [data-step="-1"]')); await wait(100);
      check(!doc.querySelector('.rf-tw-stepped') && !!box(U(104)), 'the trail should go back to the rows, what was open still open');
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
  // The find field (0.4.436; on every page since 0.4.458): typing keeps the nodes whose words hold it, or one of their
  // own properties by its name or a value, that property said under the node.
  {
    const { doc, window, part } = world('');
    await wait(120);
    const small = doc.querySelector('.rf-tw-find');
    check(!small, 'six nodes get no find field: it stands from twenty rows up (the owner, 2026-10-31)');
    if (small) {
      small.focus(); small.value = 'severity'; small.dispatchEvent(new window.Event('input', { bubbles: true }));
      await wait(200);
      const lines = [...doc.querySelectorAll('.rf-tw-line, .rf-tw-item')];
      const opened = [...doc.querySelectorAll('.rf-chev[data-dig][aria-expanded="true"]')];
      const marked = [...doc.querySelectorAll('.rf-ol-prop.rf-tw-match .rf-ol-pname')].map(n => n.textContent.trim());
      check(lines.length > 0 && opened.length === lines.length && marked.length === lines.length && marked.every(n => n === 'Severity'), 'typing a property’s name should keep the nodes holding it, each opened as when dug, its “Severity” line marked: ' + lines.length + ' found, ' + opened.length + ' open, ' + marked);
      small.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(60);
      check(!doc.querySelector('.rf-chev[data-dig][aria-expanded="true"]'), 'emptying the field should close what it opened');
    }
    part.stop(); await wait(10);
    const extra = Array.from({ length: 20 }, (_, i) => ({ id: 120 + i, title: `Note ${i + 1} on review timing.`, tag: 'Claim', day: 20260801 + i }));
    NODES.push(...extra);
    const many = world('');
    await wait(150);
    const field = many.doc.querySelector('.rf-tw-find');
    check(!!field && many.doc.querySelector('.rf-tw-findrow .rf-field-count')?.textContent === '26' && !/26/.test(field.placeholder), 'twenty-six nodes should get the kit’s find field, the count at its end, not in the grey words');
    if (field) {
      field.focus(); field.value = 'gap'; field.dispatchEvent(new many.window.Event('input', { bubbles: true }));
      await wait(30);
      const names = [...many.doc.querySelectorAll('.rf-tw-line .rf-tw-record, .rf-tw-item .rf-tw-record')].map(a => a.textContent);
      check(names.length === 3 && names.every(n => /gap/i.test(n)), 'typing “gap” should keep the three nodes with it: ' + names);
      check(many.doc.activeElement?.matches('.rf-tw-find') && many.doc.activeElement.value === 'gap', 'the field should keep the keys and its words while the rows are drawn again');
      many.doc.activeElement.dispatchEvent(new many.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(30);
      check(many.doc.querySelectorAll('.rf-tw-line, .rf-tw-item').length > 3, 'Esc in the field should show every node again');
    }
    many.part.stop();
    NODES.splice(NODES.length - extra.length, extra.length);
  }
  console.log(problems.length ? `two-way-rows-test: ${problems.length} of ${cases} checks failed` : `two-way-rows-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
