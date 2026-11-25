// node --test test/     The deciding pieces, checked without Logseq.
const test = require('node:test'), assert = require('node:assert/strict');
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
test('a long list shows a few until asked, and never hides only one or two', () => {
  const rows = n => Array.from({ length: n }, (_, i) => i);
  assert.equal(shown(rows(40), false).length, 10);
  assert.equal(shown(rows(40), true).length, 40);
  assert.equal(shown(rows(12), false).length, 12);
});
