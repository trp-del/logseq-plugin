// node --test test/     The deciding pieces, checked without Logseq.
const test = require('node:test'), assert = require('node:assert/strict');
const { path } = require('../core/tags.js');
const words = require('../core/words.js'), days = require('../core/days.js'), { lists, shown } = require('../core/lists.js');
const A = '1a000000-0000-4000-8000-00000000000e', B = '1a000000-0000-4000-8000-000000000013';
const names = new Map([[A, 'Dr. Mei Chen'], [B, 'Fatigue']]);

test('a link reads as the node\'s name, a tag as a tag', () => {
  assert.deepEqual(words.parts(`Saw [[${A}]] about #[[${B}]]`, names), [
    { kind: 'text', text: 'Saw ' }, { kind: 'link', uuid: A, text: 'Dr. Mei Chen' }, { kind: 'text', text: ' about ' }, { kind: 'tag', uuid: B, text: 'Fatigue' }]);
});
test('a link with words of its own keeps them', () => {
  assert.deepEqual(words.parts(`Paid [the bill]([[${A}]]) today`, names)[1], { kind: 'link', uuid: A, text: 'the bill' });
  assert.deepEqual(words.parts('See [the site](https://example.org/a) now', names)[1], { kind: 'url', href: 'https://example.org/a', text: 'the site' });
});
test('a page named outright in the words is a link by its name', () => {
  assert.deepEqual(words.parts('Saw [[Dr. Helen Brooks]] #[[Visit]]', names), [
    { kind: 'text', text: 'Saw ' }, { kind: 'link', name: 'Dr. Helen Brooks', text: 'Dr. Helen Brooks' }, { kind: 'text', text: ' ' }, { kind: 'tag', name: 'Visit', text: 'Visit' }]);
  assert.deepEqual(words.named('Saw [[Dr. Helen Brooks]]'), []);
});
test('a node no name is known for never shows its id', () => {
  assert.equal(words.plain('About [[2a000000-0000-4000-8000-000000000001]].', names), 'About ….');
});
test('marks hold what stands inside them', () => {
  const got = words.parts(`**Saw [[${A}]]** and *left* with \`code\` ~~gone~~ ==lit==`, names);
  assert.deepEqual(got[0], { kind: 'text', text: 'Saw ', marks: ['b'] });
  assert.deepEqual(got[1], { kind: 'link', uuid: A, text: 'Dr. Mei Chen', marks: ['b'] });
  assert.deepEqual(got.filter(p => p.marks).map(p => p.marks.join('')), ['b', 'b', 'i', 'code', 'del', 'mark']);
});
test('a bare address is a link out and leaves its full stop behind', () => {
  const got = words.parts('Read https://example.org/x. Then stop', names);
  assert.deepEqual(got[1], { kind: 'url', href: 'https://example.org/x', text: 'https://example.org/x' });
  assert.equal(got[2].text, '. Then stop');
});
test('a star that is no mark stays a star', () => {
  assert.equal(words.plain('2 * 3 * 4 and snake_case_name', names), '2 * 3 * 4 and snake_case_name');
});
test('the nodes words name are listed once', () => {
  assert.deepEqual(words.named(`[[${A}]] ((${B})) #[[${A}]]`), [A, B]);
});
test('the first line, and whether more follow', () => {
  assert.deepEqual(words.firstLine('one\ntwo'), { line: 'one', more: true });
  assert.deepEqual(words.firstLine('one\n  '), { line: 'one', more: false });
  assert.deepEqual(words.firstLine(null), { line: '', more: false });
});
test('a day is said short, with its year only in another year', () => {
  assert.equal(days.short(20261004, 20261125), 'Oct 4');
  assert.equal(days.short(20251004, 20261125), 'Oct 4, 2025');
  assert.equal(days.short(0, 20261125), '');
  assert.equal(days.short(20261340, 20261125), '');
});
const node = (uuid, wordsOf, day = 0, tag = '') => ({ uuid, words: wordsOf, day, tag });
test('one list for each property, by name, mentions last', () => {
  const provider = { ident: 'user.property/provider', title: 'Provider', uuid: 'p1' }, agent = { ident: 'user.property/agent', title: 'Agent', uuid: 'p2' };
  const got = lists({ links: [{ prop: provider, node: node('n1', 'First visit', 20260902, 'Consultation') }, { prop: agent, node: node('n2', 'Chemo') }, { prop: provider, node: node('n3', 'Video call', 20260930, 'Consultation') }],
    mentions: [node('n1', 'First visit'), node('n4', 'A note')] });
  assert.deepEqual(got.map(l => l.name), ['Agent', 'Provider', 'Mentioned in']);
  assert.deepEqual(got[1].rows.map(r => r.uuid), ['n3', 'n1']);          // newest first
  assert.deepEqual(got[2].rows.map(r => r.uuid), ['n4']);                // n1 is said under Provider already
});
test('a tag every row shares is said once, on the list', () => {
  const p = { ident: 'user.property/p', title: 'P', uuid: 'p' };
  const same = lists({ links: [{ prop: p, node: node('a', 'x', 0, 'Log') }, { prop: p, node: node('b', 'y', 0, 'Log') }] })[0];
  assert.equal(same.tag, 'Log'); assert.deepEqual(same.rows.map(r => r.tagShown), [false, false]);
  const mixed = lists({ links: [{ prop: p, node: node('a', 'x', 0, 'Log') }, { prop: p, node: node('b', 'y', 0, '') }] })[0];
  assert.equal(mixed.tag, ''); assert.deepEqual(mixed.rows.map(r => r.tagShown), [true, false]);
  const one = lists({ links: [{ prop: p, node: node('a', 'x', 0, 'Log') }] })[0];
  assert.equal(one.tag, ''); assert.equal(one.rows[0].tagShown, true);
});
test('the same node twice in a list is one row; undated rows follow dated ones by their words', () => {
  const p = { ident: 'user.property/p', title: 'P', uuid: 'p' };
  const got = lists({ links: [{ prop: p, node: node('b', 'beta') }, { prop: p, node: node('a', 'alpha') }, { prop: p, node: node('a', 'alpha') }, { prop: p, node: node('c', 'gamma', 20260101) }] })[0];
  assert.deepEqual(got.rows.map(r => r.uuid), ['c', 'a', 'b']);
});
test('a journal day\'s Scheduled and Deadline stand before Mentioned in', () => {
  const got = lists({ dues: [{ which: 'Deadline', node: node('d', 'Pay') }, { which: 'Scheduled', node: node('s', 'Call') }], mentions: [node('m', 'Note')] });
  assert.deepEqual(got.map(l => l.name), ['Scheduled', 'Deadline', 'Mentioned in']);
});
test('on a journal day a row does not repeat the day', () => {
  const p = { ident: 'user.property/date', title: 'Date', uuid: 'p' };
  const got = lists({ own: 20261007, links: [{ prop: p, node: node('a', 'x', 20261007) }, { prop: p, node: node('b', 'y', 20261001) }] })[0];
  assert.deepEqual(got.rows.map(r => r.dayShown), [0, 20261001]);
});
test('a long list shows a few until asked, and never hides only one or two', () => {
  const rows = n => Array.from({ length: n }, (_, i) => i);
  assert.equal(shown(rows(40), false).length, 10);
  assert.equal(shown(rows(40), true).length, 40);
  assert.equal(shown(rows(12), false).length, 12);
});
test('a tag\'s path runs up to the top, and a loop ends it', () => {
  const tags = new Map([[1, { id: 1, title: 'Doctor', parents: [2] }], [2, { id: 2, title: 'Person', parents: [3] }], [3, { id: 3, title: 'Entity', parents: [] }],
    [4, { id: 4, title: 'A', parents: [5] }], [5, { id: 5, title: 'B', parents: [4] }], [6, { id: 6, title: 'Two', parents: [3, 2] }]]);
  assert.deepEqual(path(1, tags).map(t => t.title), ['Doctor', 'Person', 'Entity']);
  assert.deepEqual(path(4, tags).map(t => t.title), ['A', 'B']);
  assert.deepEqual(path(6, tags).map(t => t.title), ['Two', 'Entity']);
  assert.deepEqual(path(9, tags), []);
});
const find = require('../core/find.js'), todo = require('../core/todo.js');
const TAGS = new Map([[1, { id: 1, title: 'Doctor', parents: [2] }], [2, { id: 2, title: 'Person', parents: [3] }], [3, { id: 3, title: 'Entity', parents: [] }], [4, { id: 4, title: 'Consultation', parents: [5] }], [5, { id: 5, title: 'Occurrence', parents: [] }], [6, { id: 6, title: 'Patient', parents: [2] }]]);
test('the tags read as an outline, tops and children by name', () => {
  assert.deepEqual(find.tree(TAGS).map(r => '  '.repeat(r.depth) + r.tag.title), ['Entity', '  Person', '    Doctor', '    Patient', 'Occurrence', '  Consultation']);
});
test('a tag holds every tag below it', () => {
  assert.deepEqual([...find.under(3, TAGS)].sort(), [1, 2, 3, 6]);
  assert.deepEqual([...find.under(4, TAGS)], [4]);
});
test('typed words find kinds, the one that starts with them first', () => {
  assert.deepEqual(find.kinds(TAGS, 'p').map(t => t.title), ['Person', 'Patient']);
  assert.deepEqual(find.kinds(TAGS, 'on').map(t => t.title), ['Person', 'Consultation']);
  assert.deepEqual(find.kinds(TAGS, ''), []);
});
test('words narrow by a node\'s words, its tag, a value of its, or its day, and say which value', () => {
  const nodes = [{ uuid: 'a', words: 'Video call about the tingling', tag: 'Consultation', day: 20261007, values: ['Dr. Mei Chen', 'Peripheral neuropathy'] },
    { uuid: 'b', words: 'First appointment', tag: 'Consultation', day: 20260820, values: ['Dr. Mei Chen'] }, { uuid: 'c', words: 'Chen family dinner', tag: '', day: 0, values: [] }];
  assert.deepEqual(find.narrow(nodes, 'chen oct').map(n => [n.uuid, n.why]), [['a', ['Dr. Mei Chen']]]);
  assert.deepEqual(find.narrow(nodes, 'chen').map(n => n.uuid), ['c', 'a', 'b']);          // the one whose own words start with it first
  assert.deepEqual(find.narrow(nodes, 'consult 2026').map(n => n.uuid), ['a', 'b']);
  assert.deepEqual(find.narrow(nodes, '').length, 3);
  assert.deepEqual(find.narrow(nodes, 'nothing'), []);
});
test('tasks stand under Today, Coming up and Any time; an overdue one says its day', () => {
  const got = todo.groups([{ uuid: 'a', words: 'Pay', day: 20261125 }, { uuid: 'b', words: 'Dispute', day: 20261118 }, { uuid: 'c', words: 'Move', day: 20261130 }, { uuid: 'd', words: 'Call', day: 0 }], 20261125);
  assert.deepEqual(got.map(l => [l.name, l.rows.map(r => r.uuid)]), [['Today', ['b', 'a']], ['Coming up', ['c']], ['Any time', ['d']]]);
  assert.deepEqual(got[0].rows.map(r => r.dayShown), [20261118, 0]);
  assert.deepEqual(todo.groups([], 20261125), []);
  assert.deepEqual(todo.groups([{ uuid: 'a', words: 'x', day: 0, tag: 'Task' }, { uuid: 'b', words: 'y', day: 0, tag: 'Bill' }], 20261125)[0].rows.map(r => r.tagShown), [false, true]);
});
const { sure } = require('../core/sure.js'), { above } = require('../core/tags.js');
// Doctor(1) < Person(2) < Entity(3); Consultation(4) < Occurrence(5); Hospital(7) < Entity(3)
const INDEX = new Map([[1, { id: 1, parents: [2] }], [2, { id: 2, parents: [3] }], [3, { id: 3, parents: [] }], [4, { id: 4, parents: [5] }], [5, { id: 5, parents: [] }], [7, { id: 7, parents: [3] }]]);
const provider = { ident: 'p/provider', type: 'node', range: [2] }, place = { ident: 'p/place', type: 'node', range: [7] }, date = { ident: 'p/date', type: 'date', range: [] };
const chen = { id: 100, tags: [1] }, northgate = { id: 200, tags: [7] }, alvarez = { id: 101, tags: [1] };
const facts = more => ({ tags: [4], tagIndex: INDEX, props: [provider, place, date], held: new Set(), linked: [], page: { id: 900, tags: [], day: 20261007 }, dated: new Map(), ...more });
test('a tag is under every tag above it', () => { assert.deepEqual([...above(1, INDEX)].sort(), [1, 2, 3]); });
test('a linked node that fits one empty property is written under it', () => {
  assert.deepEqual(sure(facts({ linked: [chen, northgate] })).map(v => [v.ident, v.value]), [['p/provider', 100], ['p/place', 200]]);
});
test('two nodes that fit one property, or a property already filled, are left alone', () => {
  assert.deepEqual(sure(facts({ linked: [chen, alvarez] })), []);
  assert.deepEqual(sure(facts({ linked: [chen], held: new Set(['p/provider']) })), []);
});
test('a node that fits two empty properties is not sure for either', () => {
  const from = { ident: 'p/from', type: 'node', range: [2] }, to = { ident: 'p/to', type: 'node', range: [3] };
  assert.deepEqual(sure(facts({ props: [from, to], linked: [chen] })), []);
});
test('the page a bullet is written on fills the one property it fits, when no link does', () => {
  assert.deepEqual(sure(facts({ page: { id: 100, tags: [1], day: 0 } })).map(v => [v.ident, v.value, v.why]), [['p/provider', 100, 'page']]);
  assert.deepEqual(sure(facts({ page: { id: 100, tags: [1], day: 0 }, linked: [alvarez] })).map(v => v.value), [101]);
});
test('a date takes the journal day only where every earlier node was dated that way', () => {
  assert.deepEqual(sure(facts({ dated: new Map([['p/date', { same: 5, other: 0 }]]) })).map(v => [v.ident, v.value]), [['p/date', 900]]);
  assert.deepEqual(sure(facts({ dated: new Map([['p/date', { same: 5, other: 1 }]]) })), []);
  assert.deepEqual(sure(facts({ dated: new Map([['p/date', { same: 2, other: 0 }]]) })), []);
});
test('a property with no range takes nothing', () => {
  assert.deepEqual(sure(facts({ props: [{ ident: 'p/any', type: 'node', range: [] }], linked: [chen] })), []);
});
