#!/usr/bin/env node
/* Tests the Logseq model (parts/model.js, layer 1b) without Logseq: the part is loaded on its own, with a small
   pretend graph behind a stand-in for Logseq's database. Each answer is given in the shape Logseq gives it (a
   pulled map with its keys shortened), so what is tested is what the model makes of an answer: titles, stored
   links, days typed in words, journal titles, the property schema, the pages, a record's fields, journal pages.

   What it cannot test is the query text itself: the stand-in recognises each query by its shape and answers from
   the pretend graph, so whether Logseq answers that query the same way is checked in the app (the measuring
   round in docs/history/NEXT-2026-10-19.md). A query the stand-in does not recognise fails the test, so a new query is noticed.

   It also times the model's own work on a large pretend graph (20,000 pages, 300 properties), Logseq's own
   query time left out, and prints it; it fails only when that is far beyond any reasonable figure.

   Needs node only. Run from the repo root: node tools/model-test.js (tools/check.sh runs it when node is there).
   Days are tested in a time zone with summer time (Europe/London) whatever the machine's own. */
process.env.TZ = 'Europe/London';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const problems = [];
let passed = 0;
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const same = (got, want, what) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passed++; else problem(`${what}: got ${g}, want ${w}`);
};
const ymd = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

/* The pretend graph. Entities by id, as Logseq stores them (only what the model reads). */
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function smallGraph() {
  const e = {};
  const add = (id, fields) => { e[id] = { id, uuid: U(id), ...fields }; return e[id]; };
  // Logseq's own classes.
  add(1, { title: 'Property', ident: 'logseq.class/Property', name: 'property' });
  add(2, { title: 'Tag', ident: 'logseq.class/Tag', name: 'tag' });
  add(3, { title: 'Page', ident: 'logseq.class/Page', tags: [2] });
  // Tags (classes) of the owner: Person, Doctor extends Person, Meeting, Project.
  add(10, { title: 'Person', name: 'person', tags: [2], ident: 'user.class/Person' });
  add(11, { title: 'Doctor', name: 'doctor', tags: [2], ident: 'user.class/Doctor', extends: [10] });
  add(12, { title: 'Meeting', name: 'meeting', tags: [2], ident: 'user.class/Meeting' });
  add(13, { title: 'Project', name: 'project', tags: [2], ident: 'user.class/Project' });
  // Properties: the owner's (user.property/...) and the four of Logseq's a record takes; created-at is left out.
  add(20, { title: 'Deadline', ident: 'logseq.property/deadline', tags: [1], type: 'datetime', cardinality: 'db.cardinality/one' });
  add(21, { title: 'Status', ident: 'logseq.property/status', tags: [1], type: 'default' });
  add(22, { title: 'attendees', ident: 'user.property/attendees', tags: [1], type: 'node', cardinality: 'db.cardinality/many', classes: [10] });
  add(23, { title: 'project', ident: 'user.property/project', tags: [1], type: 'node', classes: [13] });
  add(24, { title: 'email', ident: 'user.property/email', tags: [1], type: 'url' });
  add(25, { title: 'specialty', ident: 'user.property/specialty', tags: [1] });
  add(26, { title: 'Created at', ident: 'logseq.property/created-at', tags: [1], type: 'datetime' });
  add(27, { title: '', ident: 'user.property/untitled', tags: [1] });
  // Status choices, stored out of order.
  add(30, { title: 'Done', closedFor: 21, order: 'a2' });
  add(31, { title: 'Todo', closedFor: 21, order: 'a0' });
  add(32, { title: 'Doing', closedFor: 21, order: 'a1' });
  // Which tag has which fields.
  e[10].fields = [24];
  e[11].fields = [25];
  e[12].fields = [22, 23, 20];
  // Pages.
  add(40, { title: 'Mateo Ruiz', name: 'mateo ruiz', tags: [10] });
  add(41, { title: 'Dr. Joe', name: 'dr. joe', tags: [11] });
  add(42, { title: 'Atlas', name: 'atlas', tags: [13] });
  add(43, { title: '$$$ hidden', name: '$$$ hidden' });
  add(44, { title: 'Oct 19th, 2026', name: 'oct 19th, 2026', journalDay: 20261019 });
  add(45, { title: 'Holds a link to [[' + U(40) + ']]', name: 'holds a link' });
  add(46, { title: 'Plain', name: 'plain', tags: [3] });
  add(48, { title: 'Mat', name: 'mat', tags: [3] });
  add(49, { title: 'Old symptom', name: 'old symptom', deleted: true }); // in Logseq's Recycle (2026-10-23)
  e[40].alias = [48];
  // Blocks.
  add(50, { title: 'Budget review', page: 42 });
  add(51, { title: 'Kickoff call', tags: [12], page: 44 });
  add(52, { title: 'Check-up', tags: [11], page: 44 });
  add(53, { title: 'Loop', tags: [60] });
  add(60, { title: 'A', name: 'a', tags: [2], extends: [61] });
  add(61, { title: 'B', name: 'b', tags: [2], extends: [60] });
  e[60].fields = [24]; e[61].fields = [25];
  return e;
}
// A large graph for the timing: 300 properties with choices and fields, 20,000 pages with tags (with --big, also
// 600 properties and 100,000 pages: the stress run of docs/history/FINISHING-PROMPT-2026-10-23.md section 4).
function largeGraph(pages = 20000, propCount = 300) {
  const e = smallGraph();
  let id = 1000;
  const props = [];
  for (let i = 0; i < propCount; i++) { const p = id++; props.push(p); e[p] = { id: p, uuid: U(p), title: `prop ${i}`, ident: `user.property/p${i}`, tags: [1], type: i % 3 ? 'default' : 'node' }; }
  for (const p of props.slice(0, 100)) for (let c = 0; c < 5; c++) { const v = id++; e[v] = { id: v, uuid: U(v), title: `choice ${c}`, closedFor: p, order: 'a' + (5 - c) }; }
  const tags = [];
  for (let t = 0; t < 200; t++) { const c = id++; tags.push(c); e[c] = { id: c, uuid: U(c), title: `Tag ${t}`, name: `tag ${t}`, tags: [2], fields: props.slice(t % 290, t % 290 + 10), extends: t ? [tags[t - 1]] : [] }; }
  for (let n = 0; n < pages; n++) { const p = id++; e[p] = { id: p, uuid: U(p), title: `Page ${n}`, name: `page ${n}`, tags: [tags[n % 200]] }; }
  return e;
}

/* The stand-in for Logseq's datascriptQuery: it recognises each query the model sends by its shape and answers
   from the pretend graph, in Logseq's shape (pulled maps with shortened keys). */
// What nodeValues (0.4.369) reads: rows of what nodes hold under your properties, in the four shapes of its four queries.
let VALUE_ROWS = [];
// What structureUse (0.4.448) reads: every value, the tags on nodes, the words of text values, the links in the words.
let USE = { values: [], tagged: [], texts: [], refs: [], link: { links: [], titled: [], dated: [] } };
const askedUuids = query => [...query.matchAll(/#uuid "([^"]+)"/g)].map(m => m[1]);
function fakeDb(graph, log) {
  const all = () => Object.values(graph);
  const ref = id => ({ id });
  const isProperty = x => (x.tags || []).includes(1);
  const shapes = [
    [/:find \?o \?a :where \[\?o :block\/alias \?a\]/, () => USE.alias || []], [/^\[:find \?pu :where \[\(ground \[([\d ]+)\]/, m => m[1].split(' ').map(n => [U(Number(n))])],
    [/^\[:find \?b \?w \?at :where/, () => USE.madeRow || []], [/^\[:find \(count \?k\)/, () => [[USE.madeKids || 0]]],
    [/^\[:find \?page \?pu \?b \?attr \?name \?fu/, () => USE.link.links], [/^\[:find \?b \?uuid \?title/, () => USE.link.titled], [/^\[:find \?b \?tag :where/, () => []],
    [/^\[:find \?b \?dattr \?day \?dname/, () => USE.link.dated], [/^\[:find \?b \?day :where/, () => []],
    [/^\[:find \?u \?t \?n :where \[\(ground/, (m, query) => askedUuids(query).map(u => all().find(x => x.uuid === u)).filter(Boolean).map(x => [x.uuid, x.title, x.name || ''])],
    [/\(pull \?p \[:db\/id :db\/ident :block\/uuid :block\/title :logseq\.property\/type :db\/cardinality :logseq\.property\/icon[\s\S]*:where \[\?p :block\/tags :logseq\.class\/Property\] \[\?p :db\/ident _\]/,
      () => all().filter(x => isProperty(x) && x.ident).map(x => [{ id: x.id, ident: ':' + x.ident, uuid: x.uuid, title: x.title,
        ...(x.type ? { type: ':' + x.type } : {}), ...(x.cardinality ? { cardinality: ':' + x.cardinality } : {}),
        ...(x.classes ? { classes: x.classes.map(c => ({ id: c, uuid: graph[c].uuid, title: graph[c].title })) } : {}) }])],
    [/:where \[\?v :block\/closed-value-property \?p\]/, () => all().filter(x => x.closedFor).map(x => [x.closedFor, { id: x.id, title: x.title, order: x.order }])],
    [/:find \?c \?p :where \[\?c :logseq\.property\.class\/properties \?p\]/, () => all().flatMap(x => (x.fields || []).map(p => [x.id, p]))],
    [/:find \?child \?parent :where \[\?child :logseq\.property\.class\/extends \?parent\]/, () => all().flatMap(x => (x.extends || []).map(p => [x.id, p]))],
    // Where a tag sits (0.4.328, tagChain): every tag with its uuid, title and ident, and every Extends.
    [/:find \?t \?u \?title \?ident :where \[\?t :block\/tags :logseq\.class\/Tag\]/, () => all().filter(x => (x.tags || []).includes(2)).map(x => [x.id, x.uuid, x.title, ':' + (x.ident || 'user.class/' + x.title)])],
    [/:find \?c \?p :where \[\?c :logseq\.property\.class\/extends \?p\]/, () => all().flatMap(x => (x.extends || []).map(p => [x.id, p]))],
    // The tags and their idents (0.4.220: which are Logseq's own).
    [/:find \?t \?i :where \[\?t :block\/tags :logseq\.class\/Tag\] \[\?t :db\/ident \?i\]/, () => all().filter(x => (x.tags || []).includes(2) && x.ident).map(x => [x.id, ':' + x.ident])],
    [/:where \[\?p :block\/name _\] \(not \[\?p :block\/tags :logseq\.class\/Property\]\) \(not \[\?p :block\/journal-day _\]\)/,
      () => all().filter(x => x.name && !isProperty(x) && !x.journalDay && !x.deleted).map(x => [{ id: x.id, uuid: x.uuid, title: x.title,
        ...(x.tags ? { tags: x.tags.map(t => ({ id: t, title: graph[t].title, ...(graph[t].ident ? { ident: ':' + graph[t].ident } : {}) })) } : {}) }])],
    // A page's category (0.4.469): every page with its tags.
    [/:find \?u \?t :where \[\?p :block\/name\] \[\?p :block\/tags \?t\] \[\?p :block\/uuid \?u\]/, () => all().filter(x => x.name).flatMap(x => (x.tags || []).map(t => [x.uuid, t]))],
    [/:find \?t :where \[\?b :block\/uuid #uuid "([^"]+)"\] \[\?b :block\/tags \?t\]/, m => { const b = all().find(x => x.uuid === m[1]); return (b?.tags || []).map(t => [t]); }],
    [/:find \?t :where \[\?p :block\/journal-day (\d+)\] \[\?p :block\/title \?t\]/, m => all().filter(x => x.journalDay === Number(m[1])).map(x => [x.title])],
    [/:find \?ident\s+:where \[\(identity (\d+)\) \?p\] \[\?p :block\/tags \?c\] \[\?c :db\/ident \?ident\]/, m => (graph[m[1]]?.tags || []).filter(t => graph[t]?.ident).map(t => [':' + graph[t].ident])],
    [/:find \?uuid \?title\s+:where \[\(identity (\d+)\) \?p\] \[\?o :block\/alias \?p\] \[\?o :block\/uuid \?uuid\] \[\?o :block\/title \?title\]/, m => all().filter(x => (x.alias || []).includes(Number(m[1]))).map(x => [x.uuid, x.title])],
    // Is a page in the Recycle (inRecycle, 2026-10-23).
    [/:find \?d :where \[\?p :block\/uuid #uuid "([^"]+)"\] \[\?p :logseq\.property\/deleted-at \?d\]/, m => all().filter(x => x.uuid === m[1] && x.deleted).map(() => [1]),],
    [/:find \(pull \?p \[:db\/id\]\) :where \[\?p :block\/journal-day (\d+)\]\]/, m => all().filter(x => x.journalDay === Number(m[1])).map(x => [ref(x.id)])],
  ];
  // nodeValues: the four queries share their first clause, a ground list of the nodes asked about.
  const valueShape = find => new RegExp(`:find ${find} :where \\[\\(ground \\[[^\\]]*\\]\\) \\[\\?u \\.\\.\\.\\]\\]`);
  const heldBy = query => VALUE_ROWS.filter(r => askedUuids(query).includes(r.u));
  shapes.push(
    [valueShape('\\?u \\?name \\?attr \\?v'), (m, query) => heldBy(query).map(r => [r.u, r.name, ':' + r.attr, r.v])],
    [valueShape('\\?u \\?name \\?attr \\?v \\?t \\?vu'), (m, query) => heldBy(query).filter(r => r.title != null).map(r => [r.u, r.name, ':' + r.attr, r.v, r.title, r.vu])],
    [valueShape('\\?u \\?name \\?attr \\?v \\?d'), (m, query) => heldBy(query).filter(r => r.day != null).map(r => [r.u, r.name, ':' + r.attr, r.v, r.day])],
    [valueShape('\\?u \\?name \\?attr \\?v \\?n'), (m, query) => heldBy(query).filter(r => 'n' in r).map(r => [r.u, r.name, ':' + r.attr, r.v, r.n])],
  );
  shapes.push(
    [/^\[:find \?b \?a \?v :where \[\?p :db\/ident \?a\] \[\(namespace \?a\) \?ns\] \[\(= \?ns "user\.property"\)\] \[\?b \?a \?v\]/, () => USE.values],
    [/^\[:find \?b \?t :where \[\?b :block\/tags \?t\] \[\?t :db\/ident \?ti\]/, () => USE.tagged],
    [/^\[:find \?v \?w :where \[\?p :logseq\.property\/type :default\]/, () => USE.texts],
    [/^\[:find \?b \?pg :where \[\?b :block\/refs \?pg\]/, () => USE.refs],
  );
  return async query => {
    for (const [shape, answer] of shapes) { const m = query.match(shape); if (m) { log.push(shape.source.slice(0, 30)); return answer(m, query); } }
    problem('a query the stand-in does not know (add its shape, and check it in the app): ' + query.replace(/\s+/g, ' ').slice(0, 200));
    return [];
  };
}
function fakeLogseq(graph, made, config) {
  const byUuid = uuid => Object.values(graph).find(x => x.uuid === uuid) || null;
  const entity = x => x && { id: x.id, uuid: x.uuid, title: x.title, ...(x.name ? { name: x.name, originalName: x.title } : {}) };
  return {
    settings: {},
    Editor: {
      getPage: async key => { const x = byUuid(key) || Object.values(graph).find(p => p.name === String(key).toLowerCase()); return x?.name ? entity(x) : null; },
      getBlock: async key => entity(byUuid(key)),
      createPage: async (title, props, opts) => { made.push({ title, opts }); const id = 9000 + made.length; graph[id] = { id, uuid: U(id), title, name: title.toLowerCase(), ...(opts?.journal ? { journalDay: -id } : {}) }; return { id }; },
    },
    App: { getUserConfigs: async () => { if (config.fails) throw new Error('no configs'); return { preferredDateFormat: config.format }; } },
    UI: { showMsg() {} },
  };
}

// Loads parts/shared.js and parts/model.js into a window of their own and starts the model, as the core would.
function loadModel(graph, { made = [], config = { format: 'MMM do, yyyy' }, queries = [] } = {}) {
  const logseq = fakeLogseq(graph, made, config);
  const win = { console, setTimeout, clearTimeout, Promise, Date, Map, Set, URL };
  win.window = win;
  win.parent = { document: { querySelectorAll: () => [] } };
  const document = { currentScript: null };
  for (const file of ['parts/shared.js', 'parts/model.js']) {
    const run = new Function('logseq', 'window', 'document', 'location', 'console', fs.readFileSync(path.join(root, file), 'utf8'));
    run(logseq, win, document, { href: 'file:///plugin/main.js' }, console);
  }
  const cache = new Map(), graphHooks = [];
  const core = {
    provided: {}, provide: things => Object.assign(core.provided, things),
    dsQuery: fakeDb(graph, queries),
    onGraphChange: fn => { graphHooks.push(fn); },
    graphWide: (name, load) => { if (!cache.has(name)) cache.set(name, Promise.resolve().then(load)); return cache.get(name); },
  };
  win.refinementCore = core;
  const part = win.refinementParts.find(p => p.name === 'model');
  part.provide(core);
  part.start();
  return { model: core.provided, made, queries, logseq };
}

async function main() {
  const graph = smallGraph();
  const { model, made, queries, logseq } = loadModel(graph);

  // Titles and links.
  same(model.titleOf({ title: '  Kickoff  ' }), 'Kickoff', 'titleOf trims');
  same(model.titleOf({ content: 'old style' }), 'old style', 'titleOf falls back to content');
  same(model.titleOf(null), '', 'titleOf of nothing');
  same('Kickoff call #meeting #[[Long tag]]'.replace(model.trailingTags, ''), 'Kickoff call', 'trailingTags finds every tag at the end');
  same('#work is the topic'.replace(model.trailingTags, ''), '#work is the topic', 'trailingTags leaves a tag that is not at the end');
  same(model.cleanTitle, undefined, 'the page-name rule is the editor part\'s, not the model\'s');
  same(await model.readableTitle(`Met [[${U(40)}]] about ((${U(50)}))`), 'Met [[Mateo Ruiz]] about Budget review', 'readableTitle swaps pages and blocks');
  same(await model.readableTitle(`Met [[${U(40)}]] about ((${U(50)}))`, { pagesOnly: true }), `Met [[Mateo Ruiz]] about ((${U(50)}))`, 'readableTitle pagesOnly leaves block references');
  same(await model.readableTitle(`See [[${U(50)}]]`, { asShown: true }), `See [[${U(50)}]]`, 'readableTitle asShown leaves a [[link]] to a block');
  same(await model.readableTitle(`See [[${U(45)}]]`), 'See [[Holds a link to [[Mateo Ruiz]]]]', 'readableTitle reads a title that holds a link');
  same(await model.readableTitle(`Gone [[${U(999)}]]`), `Gone [[${U(999)}]]`, 'readableTitle keeps an id it cannot find');
  same(await model.readableTitle(`Odd [[${U(40)}))`), `Odd [[${U(40)}))`, 'readableTitle keeps mismatched brackets');
  same(await model.readableTitle(''), '', 'readableTitle of nothing');
  // Every title asked for in one moment is one question, however many links.
  queries.length = 0;
  const together = await Promise.all([`Met [[${U(40)}]]`, `About ((${U(50)}))`, `Again [[${U(40)}]] and [[${U(50)}]]`, `Gone [[${U(999)}]]`].map(text => model.readableTitle(text)));
  same(together.join('|'), `Met [[Mateo Ruiz]]|About Budget review|Again [[Mateo Ruiz]] and [[Budget review]]|Gone [[${U(999)}]]`, 'titles read together');
  same(queries.filter(entry => entry.startsWith('^\\[:find \\?u \\?t \\?n')).length, 1, 'titles asked for together are one question: ' + queries);
  // A node's day: the property titled Date, whatever its ident, before an earlier day under another name.
  USE.link = { links: [[5, U(5), 7, ':user.property/about', 'about', U(6)]], titled: [[7, U(7), 'A node']], dated: [[7, ':user.property/seen-q1', 20260105, 'Seen'], [7, ':user.property/date-x9', 20260301, 'Date']] };
  same([...(await model.linksInto(5)).records.values()][0].day, 20260301, 'a property titled Date comes first, its ident aside');
  // A date in a node's words, as the proposals read it: Threads keeps its own reader, so it is held to Predictive's rules.
  const rules = fs.readFileSync(path.join(__dirname, '../parts/shadow-rules.js'), 'utf8');
  const lineOf = name => rules.match(new RegExp(`^const ${name} = .*$`, 'm'))[0];
  const reader = new Function('parseDay', 'dayAfter', 'dayNumber', 'sameDay', [lineOf('WEEKDAY'), lineOf('MONTH'), lineOf('SMALL'), lineOf('AFTER_DAY'), lineOf('asDate'), lineOf('JUST_WENT'), lineOf('AHEAD'), lineOf('cleanWords'), rules.match(/^function daysInWords[\s\S]*?^}$/m)[0], 'return daysInWords;'].join('\n'))(model.parseDay, model.dayAfter, model.dayNumber, model.sameDay);
  const saturday = 20261031, friday = 20261023;
  same(reader('Scan on Oct 3 showed a shadow', saturday), [20261003], 'a day that just went stays this year');
  same(reader('Scan on Nov 20', saturday), [20261120], 'a day to come stays to come');
  same(reader('Bloods on Friday were normal', saturday), [], 'a weekday told in the past is none');
  same(reader('Bloods on Friday', friday), [], 'today\'s own weekday is none');
  same(reader('Scan was moved to next Friday', saturday), [20261113], 'next still says');
  same(reader('Appointment on Friday', saturday), [20261106], 'a plain weekday is the coming one');
  // A page fits a property through the tag it holds or any tag above that.
  const up = { parentsOf: new Map([[3, [2]], [2, [1]]]) };
  same(model.fits({ tags: [{ id: 3 }] }, new Set([1]), up), true, 'a tag two steps under the one taken fits');
  same(model.fits({ tags: [{ id: 2 }] }, new Set([3]), up), false, 'a tag above the one taken does not');

  // Readers of a pulled map.
  same(model.bare(':user.property/x'), 'user.property/x', 'bare drops the colon');
  same(model.pick({ ':block/title': 'a' }, 'block/title'), 'a', 'pick, full key with colon');
  same(model.pick({ 'block/title': 'b' }, 'block/title'), 'b', 'pick, full key');
  same(model.pick({ title: 'c' }, 'block/title'), 'c', 'pick, shortened key');
  same(model.idOf(7), 7, 'idOf of a number');
  same(model.idOf({ id: 8 }), 8, 'idOf of a map');

  // Days typed in words. Today is Monday 19 October 2026.
  const today = new Date(2026, 9, 19);
  const day = text => ymd(model.parseDay(text, today));
  const cases = [
    ['today', '2026-10-19'], ['tomorrow', '2026-10-20'], ['tmr', '2026-10-20'], ['yesterday', '2026-10-18'],
    ['+3', '2026-10-22'], ['-2', '2026-10-17'], ['+20', '2026-11-08'],
    ['friday', '2026-10-23'], ['fri', '2026-10-23'], ['fr', '2026-10-23'], ['monday', '2026-10-26'], ['next fri', '2026-10-30'], ['next monday', '2026-11-02'],
    ['2026-10-23', '2026-10-23'], ['2027-1-5', '2027-01-05'], ['23 oct', '2026-10-23'], ['oct 23', '2026-10-23'], ['oct. 23', '2026-10-23'], ['October 23, 2027', '2027-10-23'],
    ['19 oct', '2026-10-19'], ['1 jan', '2027-01-01'], ['18 oct', '2027-10-18'], ['  Friday  ', '2026-10-23'],
    ['', null], ['hello', null], ['13 foo', null], ['next', null], ['t', null], ['23', null],
    ['2026-02-30', null], ['31 sep', null], ['feb 29', null], ['2028-02-29', '2028-02-29'], ['2026-13-01', null],
  ];
  for (const [text, want] of cases) same(day(text), want, `parseDay("${text}")`);
  // Across the clocks going back (25 October 2026 in London): still whole days.
  same(ymd(model.dayAfter(new Date(2026, 9, 24), 1)), '2026-10-25', 'dayAfter over the clock change');
  same(ymd(model.dayAfter(new Date(2026, 9, 25), 1)), '2026-10-26', 'dayAfter the day the clocks change');
  same(ymd(model.dayAfter(new Date(2026, 9, 31), 1)), '2026-11-01', 'dayAfter over a month end');
  same(ymd(model.dayAfter(new Date(2026, 11, 31), 1)), '2027-01-01', 'dayAfter over a year end');
  same(model.dayNumber(today), 20261019, 'dayNumber');
  same(model.sameDay(new Date(2026, 9, 19, 23, 59), today), true, 'sameDay ignores the time');
  same(model.DAYS[today.getDay()], 'monday', 'DAYS starts on Sunday');

  // Journal titles.
  same(model.formatJournalTitle(today, 'MMM do, yyyy'), 'Oct 19th, 2026', 'format MMM do, yyyy');
  same(model.formatJournalTitle(today, 'E, dd.MM.yyyy'), 'Mon, 19.10.2026', 'format E, dd.MM.yyyy');
  same(model.formatJournalTitle(today, 'yyyyMMdd'), '20261019', 'format yyyyMMdd');
  same(model.formatJournalTitle(today, 'EEEE, MMMM do'), 'Monday, October 19th', 'format EEEE, MMMM do');
  same(model.formatJournalTitle(new Date(2026, 0, 5), 'dd-MM-yy'), '05-01-26', 'format dd-MM-yy');
  same(model.formatJournalTitle(new Date(2026, 0, 5), 'M/d/yyyy'), '1/5/2026', 'format M/d/yyyy');
  for (const [n, want] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st']])
    same(model.formatJournalTitle(new Date(2026, 0, n), 'do'), want, `ordinal ${n}`);
  same(await model.journalTitleFor(2026, 10, 19), 'Oct 19th, 2026', 'journalTitleFor, an existing journal');
  same(await model.journalTitleFor(2026, 10, 20), 'Oct 20th, 2026', 'journalTitleFor, a new day in the graph’s format');
  const other = loadModel(smallGraph(), { config: { format: 'yyyy-MM-dd' } }).model;
  same(await other.journalTitleFor(2026, 10, 20), '2026-10-20', 'journalTitleFor follows the graph’s date format');
  const noConfig = loadModel(smallGraph(), { config: { fails: true } }).model;
  same(await noConfig.journalTitleFor(2026, 10, 20), 'Oct 20th, 2026', 'journalTitleFor falls back when the configs cannot be read');

  // Journal pages.
  same(await model.journalIdFor(20261019, 'Oct 19th, 2026'), 44, 'journalIdFor finds the existing page');
  same(made.length, 0, 'journalIdFor made nothing for an existing day');
  const madeId = await model.journalIdFor(20261020, 'Oct 20th, 2026');
  same([madeId > 9000, made.length, made[0]?.title, made[0]?.opts?.journal, made[0]?.opts?.redirect], [true, 1, 'Oct 20th, 2026', true, false], 'journalIdFor makes a missing day as a journal, without leaving the page');

  // The schema.
  const before = queries.length;
  const schema = await model.propSchema();
  same(schema.props.map(p => p.title), ['attendees', 'Deadline', 'email', 'project', 'specialty', 'Status'], 'propSchema: own properties only, by name');
  const by = Object.fromEntries(schema.props.map(p => [p.title, p]));
  same([by.Deadline.type, by.Deadline.many, by.attendees.type, by.attendees.many, by.specialty.type], ['datetime', false, 'node', true, 'default'], 'propSchema: types and many');
  same(by.attendees.classes.map(c => c.title), ['Person'], 'propSchema: the class a field takes');
  same(by.Status.choices.map(c => c.title), ['Todo', 'Doing', 'Done'], 'propSchema: choices in their order');
  same(by.Deadline.ident, 'logseq.property/deadline', 'propSchema: the ident without its colon');
  same(schema.byId.get(22) === by.attendees, true, 'propSchema: by id');
  same(schema.parentsOf.get(11), [10], 'propSchema: Doctor extends Person');
  same([10, 11, 12, 13].some(id => schema.builtIn.has(id)), false, 'propSchema: the owner\'s tags are not counted as Logseq\'s own');
  await model.propSchema();
  same(queries.length - before, 5, 'propSchema asks the graph once (5 queries; the tag idents since 0.4.220), then remembers');

  // The pages.
  const pages = await model.propPages();
  same(pages.map(p => p.title), ['A', 'Atlas', 'B', 'Doctor', 'Dr. Joe', 'Holds a link to [[' + U(40) + ']]', 'Mat', 'Mateo Ruiz', 'Meeting', 'Person', 'Plain', 'Project', 'Property', 'Tag'], 'propPages: pages by name, no $$$ page, no journal, no property');
  // Logseq's own class pages (Property, Tag) pass the query when they have a name and are not tagged Property; whether
  // the real graph lists them in a page-valued field is one of the things to look at in the app.
  const page = Object.fromEntries(pages.map(p => [p.title, p]));
  same([page.Doctor.isTag, page['Dr. Joe'].isTag, page['Dr. Joe'].tags.map(t => t.title)], [true, false, ['Doctor']], 'propPages: tags and isTag');

  // A record's fields.
  same((await model.fieldsOf(U(51), schema)).map(p => p.title), ['attendees', 'project', 'Deadline'], 'fieldsOf a Meeting');
  same((await model.fieldsOf(U(52), schema)).map(p => p.title), ['specialty', 'email'], 'fieldsOf a Doctor: its own, then Person’s');
  same((await model.fieldsOf(U(53), schema)).map(p => p.title), ['email', 'specialty'], 'fieldsOf survives tags that extend each other');
  same(await model.fieldsOf('not-a-uuid', schema), [], 'fieldsOf of a bad id');
  same(await model.fieldsOf(U(50), schema), [], 'fieldsOf of a block with no tags');

  // What kind of page a page is.
  same(await model.tagChain(U(11)), { chain: [{ uuid: U(11), title: 'Doctor' }, { uuid: U(10), title: 'Person' }], others: [] }, 'tagChain: Doctor sits under Person');
  same((await model.tagChain(U(10)))?.chain.length, 1, 'tagChain: a top-level tag is its own chain');
  same(await model.tagChain(U(46)), null, 'tagChain: a page that is not a tag has none');
  same((await model.tagChain(U(60)))?.chain.map(t => t.title), ['A', 'B'], 'tagChain: a loop of two tags stops');
  same((await model.tagChains(U(41)))?.tags.map(t => t.chain.map(x => x.title)), [['Doctor', 'Person']], 'tagChains: a doctor\'s page reads Doctor / Person');
  same((await model.tagChains(U(11)))?.tags, [], 'tagChains: a tag page\'s own Tag is left out');
  const chains = await model.tagChainIndex();
  same(chains.byUuid(U(11))?.chain.map(t => t.title), ['Doctor', 'Person'], 'tagChainIndex: Doctor by uuid, no wait');
  same([chains.byUuid(U(46)), chains.isPageKind(U(3)), chains.isPageKind(U(11))], [null, true, false], 'tagChainIndex: a page is no tag; Page is a kind of page, Doctor is not');

  same(await model.kindOfPage(11), { isTag: true, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of a tag page');
  same(await model.kindOfPage(22), { isTag: false, isProperty: true, plain: false, aliasOf: [] }, 'kindOfPage of a property page');
  same(await model.kindOfPage(46), { isTag: false, isProperty: false, plain: true, aliasOf: [] }, 'kindOfPage of a plain page');
  same(await model.kindOfPage(41), { isTag: false, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of a page with a tag of its own');
  same((await model.kindOfPage(48)).aliasOf, [[U(40), 'Mateo Ruiz']], 'kindOfPage finds the page an alias stands for');
  same(await model.kindOfPage(0), { isTag: false, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of no page');

  // What a drawn page must hold, for the self-check.
  const { JSDOM } = (() => { try { return require('jsdom'); } catch { return {}; } })();
  if (JSDOM) {
    const doc = new JSDOM('<div id="main-content-container"><h1 class="title">Echo</h1></div>').window.document;
    for (const [what, has, needs, stops, min] of model.screenChecks()) {
      for (const selector of [has, needs]) { try { doc.querySelectorAll(selector); passed++; } catch (error) { problem(`screenChecks "${what}": ${selector} is not a selector`); } }
      same([typeof stops, Number.isInteger(min) && min > 0], ['string', true], `screenChecks "${what}" says what stops`);
    }
    same(doc.querySelectorAll(model.PAGE_TITLE).length, 1, 'PAGE_TITLE finds a page title');
  }
  same(/^\d+\.\d+\.\d+$/.test(model.CHECKED_WITH), true, 'CHECKED_WITH is a version');
  same([await model.inRecycle(U(49)), await model.inRecycle(U(40)), await model.inRecycle('not a uuid')], [true, false, false], 'inRecycle: a page in the Recycle, a live one, a bad uuid');

  // The model's own work on a large graph (Logseq's query time left out).
  const timings = async (pages, propCount, scale = 1) => {
    const big = loadModel(largeGraph(pages, propCount)).model;
    const took = {};
    const time = async (what, fn, limit) => {
      const t = process.hrtime.bigint();
      const result = await fn();
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      took[what] = ms;
      console.log(`  ${what}: ${ms.toFixed(1)} ms`);
      if (ms > limit * scale) problem(`${what} took ${ms.toFixed(0)} ms (limit ${limit * scale})`);
      return result;
    };
    console.log(`timings on a large pretend graph (${pages.toLocaleString('en')} pages, ${propCount} properties, 200 tags in one long chain):`);
    const bigSchema = await time('the property schema', () => big.propSchema(), 2000);
    const bigPages = await time('the page list', () => big.propPages(), 2000);
    same(bigPages.length > pages, true, 'the page list holds every page');
    await time('the page list again (remembered)', () => big.propPages(), 50);
    await time('fields of a record with the deepest tag', async () => { const deep = bigPages.find(p => p.title === 'Page 199'); return big.fieldsOf(deep.uuid, bigSchema); }, 500);
    await time('every tag\'s chain (tagChainIndex)', () => big.tagChainIndex(), 2000);
    await time('a page\'s tags read with their chains (tagChains)', () => big.tagChains(bigPages.find(p => p.title === 'Page 199').uuid), 500);
    await time('10,000 days read from words', () => { for (let i = 0; i < 10000; i++) big.parseDay(['next fri', '23 oct', '+3', 'tomorrow', '2026-12-01'][i % 5], today); }, 1000);
    return took;
  };
  const base = await timings(20000, 300);
  // The stress run (tools/stress.sh): five times the pages, twice the properties. A door may take up to ten times its
  // time on 20,000 pages (about linear; a door taking the square would take 25 to 50 times). Doors under 5 ms on the
  // small graph are left out of the ratio (their time is mostly noise).
  if (process.argv.includes('--big')) {
    const big = await timings(100000, 600, 10);
    for (const [what, ms] of Object.entries(big)) {
      const was = base[what];
      if (was >= 5 && ms > was * 10) problem(`${what}: ${ms.toFixed(0)} ms on 100,000 pages, more than ten times its ${was.toFixed(0)} ms on 20,000 (does not scale)`);
      else console.log(`  ${what}: ${(ms / Math.max(was, 0.001)).toFixed(1)}× its time on 20,000 pages`);
    }
  }

  // What many nodes hold (nodeValues, 0.4.369): a node, a choice, text, a day, a number and a yes/no, each as its own kind of value.
  VALUE_ROWS = [
    { u: U(60), name: 'Confidence', attr: 'user.property/confidence', v: 301, title: 'Strong', vu: U(301) },
    { u: U(60), name: 'Severity', attr: 'user.property/severity', v: 410, n: 3 },
    { u: U(60), name: 'Date', attr: 'user.property/date', v: 77, day: 20261001 },
    { u: U(60), name: 'Done', attr: 'user.property/done', v: 411, n: true },
    { u: U(60), name: 'Due', attr: 'user.property/due', v: new Date(2026, 10, 3, 12).getTime() },
    { u: U(60), name: 'Notes', attr: 'user.property/notes', v: 'plain words' },
    { u: U(60), name: 'Notes', attr: 'user.property/notes', v: 412, title: 'a text value is a node', vu: U(412) },
    { u: U(61), name: 'Confidence', attr: 'user.property/confidence', v: 302, title: 'Disputed', vu: U(302) },
    { u: U(61), name: 'Confidence', attr: 'user.property/confidence', v: 302, title: 'Disputed', vu: U(302) }, // the same row twice: one value
  ];
  const held = await model.nodeValues([U(60), U(61), U(62), 'not a uuid']);
  same([...held.keys()].sort(), [U(60), U(61)], 'nodeValues: a node holding nothing of yours has no entry, a bad uuid is left out');
  same(held.get(U(60)).get('Confidence'), { ident: 'user.property/confidence', values: [{ text: 'Strong', id: 301, uuid: U(301) }] }, 'nodeValues: a choice, with its id');
  same(held.get(U(60)).get('Severity').values, [{ text: '3', number: 3 }], 'nodeValues: a number from its value node');
  same(held.get(U(60)).get('Date').values, [{ day: 20261001, id: 77 }], 'nodeValues: a day');
  same(held.get(U(60)).get('Done').values, [{ text: 'yes', boolean: true }], 'nodeValues: a yes/no');
  same(held.get(U(60)).get('Due').values, [{ day: 20261103, time: new Date(2026, 10, 3, 12).getTime() }], 'nodeValues: a Date-and-time, a timestamp on the node itself');
  same(held.get(U(60)).get('Notes').values, [{ text: 'a text value is a node', id: 412, uuid: U(412) }, { text: 'plain words' }], 'nodeValues: text, whether a node or plain');
  same(held.get(U(61)).get('Confidence').values.length, 1, 'nodeValues: a value asked twice is one');
  same((await model.nodeValues([])).size, 0, 'nodeValues of no nodes');
  // What the structure is used for (structureUse, 0.4.448): values by property, tags by node, text words, and the pages a
  // node names in its words, less what its properties already point at.
  USE = { values: [[60, ':user.property/provider', 40], [61, ':user.property/provider', 40], [60, ':user.property/status', 412], [60, ':logseq.property/created-by', 7]],
    tagged: [[60, 20], [61, 20], [61, 21]], texts: [[412, 'Planned']], refs: [[60, 40], [60, 41], [62, 41]] };
  const use = await model.structureUse();
  same([...use.values.keys()].sort(), ['user.property/provider', 'user.property/status'], 'structureUse: values of your properties only, by ident');
  same(use.values.get('user.property/provider'), [[60, 40], [61, 40]], 'structureUse: each value with its node');
  same(use.tagsOf.get(61), [20, 21], 'structureUse: every tag of yours on a node');
  same(use.texts.get(412), 'Planned', 'structureUse: the words of a text value');
  same([...(use.named.get(60) || [])], [41], 'structureUse: a page a node points at through a property is not a page it names in its words');
  same([...(use.named.get(62) || [])], [41], 'structureUse: a page named in the words');
  // A link to a page's other name is a mention of the page: Logseq's Linked references counts it.
  USE.alias = [[40, 41], [42, 41]];
  USE.link = { ...USE.link, titled: [[60, U(60), `see [[${U(41)}]] now`], [61, U(61), `#[[${U(42)}]] a tag only`], [62, U(62), 'no link']], dated: [], links: [] };
  same((await model.aliasesOf(40)).sort(), [41, 42], 'aliasesOf: its aliases and theirs, either way round');
  same((await model.aliasesOf(99)), [], 'aliasesOf: a page with none');
  same((await model.mentionsInto(40)).map(m => m.uuid), [U(60)], 'mentionsInto: a link to an alias, not one as a tag');
  // Words typed with a link are stored by the page's uuid; a name of no page, or of a page in the Recycle, stays as typed.
  const named = { 'dr. x': { uuid: U(70) }, gone: { uuid: U(49) } };
  logseq.Editor.getPage = async name => named[String(name).toLowerCase()] || null;
  same(await model.storedWords('see [[Dr. X]] and [[Nobody]] and [[Gone]], [[Dr. X]]'), `see [[${U(70)}]] and [[Nobody]] and [[Gone]], [[${U(70)}]]`, 'storedWords');
  same(await model.storedWords(`kept [[${U(70)}]]`), `kept [[${U(70)}]]`, 'storedWords: a stored link stays');
  // What a thing just made holds: any change of its words, stamp or bullets shows, and a thing gone reads as nothing.
  USE.madeRow = [[60, 'words', 5]]; const was = await model.madeState(U(60)); USE.madeKids = 1; same(await model.madeState(U(60)) !== was, true, 'madeState: a bullet inside changes it');
  USE.madeKids = 0; same(await model.madeState(U(60)), was, 'madeState: unchanged reads the same'); USE.madeRow = []; same(await model.madeState(U(60)), '', 'madeState: gone');
  console.log(`model-test: ${passed} checks passed`);
  if (problems.length) { console.log(`model-test: FAILED (${problems.length})`); process.exit(1); }
  console.log('model-test: OK');
}
main().catch(error => { problem(error && error.stack || String(error)); process.exit(1); });
