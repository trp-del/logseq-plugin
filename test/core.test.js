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
test('an address that is a whole value is said very short', () => {
  assert.equal(words.shortAddress('https://theirc.wd1.myworkdayjobs.com/en-US/External_Careers/job/x_REQ1'), 'myworkdayjobs.com/…');
  assert.equal(words.shortAddress('https://www.bbc.co.uk/news?id=1'), 'bbc.co.uk/…');
  assert.equal(words.shortAddress('https://vanguard.com/'), 'vanguard.com');
  assert.equal(words.shortAddress('http://127.0.0.1:8080/a'), '127.0.0.1/…');
  for (const other of ['vanguard.com', 'See https://vanguard.com', 'https://a.com and more', '']) assert.equal(words.shortAddress(other), '');
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
test('one list for each property, the fullest first, mentions last', () => {
  const provider = { ident: 'user.property/provider', title: 'Provider', uuid: 'p1' }, agent = { ident: 'user.property/agent', title: 'Agent', uuid: 'p2' };
  const got = lists({ links: [{ prop: provider, node: node('n1', 'First visit', 20260902, 'Consultation') }, { prop: agent, node: node('n2', 'Chemo') }, { prop: provider, node: node('n3', 'Video call', 20260930, 'Consultation') }],
    mentions: [node('n1', 'First visit'), node('n4', 'A note')] });
  assert.deepEqual(got.map(l => l.name), ['Provider', 'Agent', 'Mentioned in']);
  assert.deepEqual(got[0].rows.map(r => r.uuid), ['n3', 'n1']);          // newest first
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
const search = require('../core/search.js'), tagTree = require('../core/tags.js'), todo = require('../core/todo.js');
const TAGS = new Map([[1, { id: 1, title: 'Doctor', parents: [2] }], [2, { id: 2, title: 'Person', parents: [3] }], [3, { id: 3, title: 'Entity', parents: [] }], [4, { id: 4, title: 'Consultation', parents: [5] }], [5, { id: 5, title: 'Occurrence', parents: [] }], [6, { id: 6, title: 'Patient', parents: [2] }]]);
test('the tags read as an outline, tops and children by name', () => {
  assert.deepEqual(tagTree.tree(TAGS).map(r => '  '.repeat(r.depth) + r.tag.title), ['Entity', '  Person', '    Doctor', '    Patient', 'Occurrence', '  Consultation']);
});
test('a tag holds every tag below it', () => {
  assert.deepEqual([...tagTree.under(3, TAGS)].sort(), [1, 2, 3, 6]);
  assert.deepEqual([...tagTree.under(4, TAGS)], [4]);
});
test('typed words find kinds, the one that starts with them first', () => {
  assert.deepEqual(search.kinds(TAGS, 'p').map(t => t.title), ['Person', 'Patient']);
  assert.deepEqual(search.kinds(TAGS, 'on').map(t => t.title), ['Person', 'Consultation']);
  assert.deepEqual(search.kinds(TAGS, ''), []);
});
test('a search shows only what holds the words, each node once, pages first, the name itself before the rest', () => {
  const found = [{ uuid: 'a', words: 'targeted therapies' }, { uuid: 'b', words: 'Ravikanth R Tadi agreed with Nutritionist' }, { uuid: 'c', words: 'Ravikanth R Tadi', isPage: true },
    { uuid: 'c', words: 'Ravikanth R Tadi', isPage: true }, { uuid: 'd', words: 'Tadi', isPage: true }, { uuid: 'e', words: 'medical device', isPage: true }];
  assert.deepEqual(search.rank(found, 'tadi').map(n => n.uuid), ['d', 'c', 'b']);
  assert.deepEqual(search.rank(found, ''), []);
});
test('words narrow by a node\'s words, its tag, a value of its, or its day, and say which value', () => {
  const nodes = [{ uuid: 'a', words: 'Video call about the tingling', tag: 'Consultation', day: 20261007, values: ['Dr. Mei Chen', 'Peripheral neuropathy'] },
    { uuid: 'b', words: 'First appointment', tag: 'Consultation', day: 20260820, values: ['Dr. Mei Chen'] }, { uuid: 'c', words: 'Chen family dinner', tag: '', day: 0, values: [] }];
  assert.deepEqual(search.narrow(nodes, 'chen oct').map(n => [n.uuid, n.why]), [['a', ['Dr. Mei Chen']]]);
  assert.deepEqual(search.narrow(nodes, 'chen').map(n => n.uuid), ['c', 'a', 'b']);          // the one whose own words start with it first
  assert.deepEqual(search.narrow(nodes, 'consult 2026').map(n => n.uuid), ['a', 'b']);
  assert.deepEqual(search.narrow(nodes, '').length, 3);
  assert.deepEqual(search.narrow(nodes, 'nothing'), []);
});
test('tasks stand under Overdue, Today, Coming up and Any time; an overdue one says its day', () => {
  const got = todo.groups([{ uuid: 'a', words: 'Pay', day: 20261125 }, { uuid: 'b', words: 'Dispute', day: 20261118 }, { uuid: 'c', words: 'Move', day: 20261130 }, { uuid: 'd', words: 'Call', day: 0 }], 20261125);
  assert.deepEqual(got.map(l => [l.name, l.rows.map(r => r.uuid)]), [['Overdue', ['b']], ['Today', ['a']], ['Coming up', ['c']], ['Any time', ['d']]]);
  assert.deepEqual([got[0].rows.map(r => r.dayShown), got[1].rows.map(r => r.dayShown)], [[20261118], [0]]);
  assert.deepEqual(todo.groups([], 20261125), []);
  // 25 November 2026 is a Wednesday.
  const dayIn = words => todo.dayIn(words, 20261125);
  assert.deepEqual(dayIn('Call Sam by friday'), { day: 20261127, words: 'Call Sam' });
  assert.deepEqual(dayIn('Pay rent tomorrow'), { day: 20261126, words: 'Pay rent' });
  assert.deepEqual(dayIn('Book the dentist next week'), { day: 20261130, words: 'Book the dentist' });
  assert.deepEqual(dayIn('File taxes on nov 20'), { day: 20271120, words: 'File taxes' });
  assert.deepEqual(dayIn('Renew passport 3 december'), { day: 20261203, words: 'Renew passport' });
  assert.deepEqual(dayIn('Lunch next friday'), { day: 20261204, words: 'Lunch' });
  assert.equal(dayIn('Sit in the sun'), null);
  assert.deepEqual(dayIn('Walk on sun'), { day: 20261129, words: 'Walk' });
  assert.equal(dayIn('tomorrow'), null);
  assert.equal(dayIn('Buy milk'), null);
  const sorted = todo.by('status', [{ uuid: 'a', words: 'Pay', day: 20261125, s: 'Todo' }, { uuid: 'b', words: 'Call', day: 0, s: 'Doing' }, { uuid: 'c', words: 'Old', day: 20261101, s: 'Todo' }, { uuid: 'd', words: 'Odd', day: 0, s: '' }], 20261120, task => task.s, ['Backlog', 'Todo', 'Doing']);
  assert.deepEqual(sorted.map(list => [list.name, list.rows.map(row => row.uuid), list.rows.map(row => row.late)]), [['Todo', ['c', 'a'], [true, false]], ['Doing', ['b'], [false]], ['No status', ['d'], [false]]]);
  assert.deepEqual([got[0].rows.map(r => r.late), got[1].rows.map(r => r.late)], [[true], [false]], 'a task past its day is late, one due today is not');
  assert.deepEqual(todo.groups([{ uuid: 'a', words: 'x', day: 0, tag: 'Task' }, { uuid: 'b', words: 'y', day: 0, tag: 'Bill' }], 20261125)[0].rows.map(r => r.tagShown), [false, true]);
});
const { sure, addresses, links, linking } = require('../core/sure.js'), { above, folds, found } = require('../core/tags.js');
test('a folded tag hides the tags under it, and only those', () => {
  const list = [{ depth: 0, name: 'a' }, { depth: 1, name: 'b' }, { depth: 2, name: 'c' }, { depth: 1, name: 'd' }, { depth: 0, name: 'e' }];
  const at = shut => folds(list, name => shut.includes(name)).map(one => (one.hidden ? 'h' : '') + (one.kids ? 'k' : '') + (one.shut ? 's' : ''));
  assert.deepEqual(at([]), ['k', 'k', '', '', '']);
  assert.deepEqual(at(['b', 'e']), ['k', 'ks', 'h', '', '']);
  assert.deepEqual(at(['a', 'b']), ['ks', 'hks', 'h', 'h', '']);
});
test('words narrowing an outline of tags keep each match under the tags it sits under', () => {
  const list = [{ depth: 0, name: 'Home' }, { depth: 1, name: 'Event' }, { depth: 2, name: 'Income' }, { depth: 2, name: 'Fee' }, { depth: 0, name: 'Org' }, { depth: 1, name: 'Merchant' }, { depth: 0, name: 'Day' }];
  assert.deepEqual(found(list, name => name.toLowerCase().includes('m')), ['hit', 'path', 'hit', '', 'path', 'hit', '']);
  assert.deepEqual(found(list, name => name === 'Fee'), ['path', 'path', '', 'hit', '', '', '']);
});
test('an address typed without http:// is made a link', () => {
  const link = (typed) => `[${typed}](https://${typed})`;
  assert.equal(addresses('see vanguard.com for the IRA'), `see ${link('vanguard.com')} for the IRA`);
  assert.equal(addresses('www.irs.gov/forms?x=1, then Google.com.'), `${link('www.irs.gov/forms?x=1')}, then ${link('Google.com')}.`);
  assert.equal(addresses('(bbc.co.uk/news) and youtu.be/abc'), `(${link('bbc.co.uk/news')}) and ${link('youtu.be/abc')}`);
  assert.equal(addresses('goo.gl/x and t.me/y and shop.example.in/a'), `${link('goo.gl/x')} and ${link('t.me/y')} and ${link('shop.example.in/a')}`);
});
test('what only looks like an address is left alone', () => {
  for (const words of ['notes.md and node.js and run.sh', 'e.g. 3.14 and $1.5k', 'mail me@chen.com or first.last@x.org', 'done.It was fine', 'open Logseq.app',
    'https://vanguard.com and http://a.org/b', '[the site](https://vanguard.com)', '[vanguard.com](https://vanguard.com)', 'in `vanguard.com` code', '```\nvanguard.com\n```',
    '[[vanguard.com]] page', '{{video youtube.com/x}}', 'file:///Users/a/b.com', 'no address here']) assert.equal(addresses(words), null, words);
});
test('a link is written only into a bullet nobody is writing in, and only while the graph still holds the words that were left', () => {   // rundown-070, F67: letters typed after Escape and Enter were written over
  const left = 'Rates at vanguard.com are', linked = 'Rates at [vanguard.com](https://vanguard.com) are';
  assert.equal(linking({ kept: left, left, writing: false }), linked);
  assert.equal(linking({ kept: left, left, writing: true }), null, 'the bullet is being written in again');
  assert.equal(linking({ kept: 'Rates at vanguard.com', left, writing: false }), null, 'Logseq has not saved the last letters yet');
  assert.equal(linking({ kept: left + ' lower now', left, writing: false }), null, 'the bullet was written on since');
  assert.equal(linking({ kept: left, left: left + ' \n', writing: false }), linked, 'Logseq keeps the words without the spaces round them');
  assert.equal(linking({ kept: 'no address here', left: 'no address here', writing: false }), null);
  assert.equal(linking({ kept: null, left, writing: false }), null);
  assert.equal(linking({ kept: left, writing: false }), null, 'what was left is not known');
});
test('the pages a bullet\'s words link by name are told from its box, each once, so a save of plain words asks the graph nothing', () => {   // rundown-070, F75
  assert.deepEqual(links('The rates were lower than in the spring'), []);
  assert.deepEqual(links('Seen by [[Dr. Mei Chen]] at [[ Northgate ]], then [[Dr. Mei Chen]] again'), ['Dr. Mei Chen', 'Northgate']);
  assert.deepEqual(links('a link being typed [[]] and one not closed [[Zzdoc'), []);
  assert.deepEqual(links(null), []);
});
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

// ---- what a list's head says, and how many stand under a tag
const { plural } = require('../core/lists.js');
test('a tag\'s name for several of its kind', () => {
  assert.deepEqual(['Transfer', 'Category', 'Bills', 'Tax', 'Bill payment', ''].map(plural), ['Transfers', 'Categories', 'Bills', 'Taxes', 'Bill payments', '']);
});
test('a list of several says how many, of what, and from when to when; a list of one says neither', () => {
  const node = (uuid, day, tag) => ({ uuid, words: uuid, day, tag });
  const prop = { ident: 'p/by', title: 'By', uuid: 'u' };
  const [many] = lists({ links: [{ prop, node: node('a', 20261004, 'Visit') }, { prop, node: node('b', 20260920, 'Visit') }, { prop, node: node('c', 0, 'Visit') }] });
  assert.deepEqual([many.said, many.one, many.from, many.to], ['3 Visits', 'Visit', 20260920, 20261004]);
  const [mixed] = lists({ links: [{ prop, node: node('a', 20261004, 'Visit') }, { prop, node: node('b', 20261004, 'Call') }] });
  assert.deepEqual([mixed.said, mixed.one, mixed.from, mixed.to], ['2', '', 0, 0]);
  const [single] = lists({ links: [{ prop, node: node('a', 20261004, 'Visit') }] });
  assert.deepEqual([single.said, single.one, single.tag], ['', 'Visit', '']);
});
test('the nodes under a tag are its own and those of the tags below it, each counted once', () => {
  const tags = new Map([[1, { id: 1, title: 'Entity', parents: [] }], [2, { id: 2, title: 'Person', parents: [1] }], [3, { id: 3, title: 'Doctor', parents: [2] }], [4, { id: 4, title: 'Place', parents: [] }]]);
  const counts = tagTree.counts(tags, [[1, 10], [2, 11], [3, 11], [3, 12], [4, 13], [9, 14]]);
  assert.deepEqual([counts.get(1), counts.get(2), counts.get(3), counts.get(4)], [3, 2, 2, 1]);
});
test('a property says how many of the nodes of the tags that give it hold a value, of how many, the biggest tag first', () => {
  const tags = new Map([[1, { id: 1, title: 'Entity', parents: [] }], [2, { id: 2, title: 'Person', parents: [1] }], [3, { id: 3, title: 'Doctor', parents: [2] }], [4, { id: 4, title: 'Place', parents: [] }]]);
  const pairs = [[2, 11], [3, 12], [3, 13], [4, 14]], byTag = new Map([[4, ['notes']], [2, ['notes', 'spoke']], [9, ['gone']]]);
  const got = tagTree.filled(tags, pairs, byTag, new Map([['notes', [12, 14, 14, 99]], ['loose', [11, 12]]]));
  assert.deepEqual(got.get('notes'), { on: [2, 4], filled: 2, of: 4 });   // Person's 3 nodes (Doctor's with it) and Place's 1
  assert.deepEqual(got.get('spoke'), { on: [2], filled: 0, of: 3 });
  assert.deepEqual(got.get('loose'), { on: [], filled: 2, of: 0 });   // on no tag: the nodes that hold it
  assert.equal(got.has('gone'), false);   // a tag that is not the person's gives nothing
});

// ---- values moved from one property into another
const move = require('../core/move.js');
const v = text => ({ raw: text, text });
const P = (title, more = {}) => ({ ident: 'p/' + title.toLowerCase(), title, type: 'node', many: false, ...more });
test('a value is copied into the other property, and taken off the first only when asked', () => {
  const nodes = [{ uuid: 'a', words: 'Gas bill', from: [v('SoCalGas')], into: [] }, { uuid: 'b', words: 'No value', from: [], into: [] }];
  const copy = move.plan({ nodes, from: P('Charged by'), into: P('Provider') });
  assert.deepEqual([copy.rows.length, copy.rows[0].comes, copy.rows[0].goes, copy.values, move.yes(copy, false)], [1, [v('SoCalGas')], [], 1, 'Copy 1 value']);
  const moved = move.plan({ nodes, from: P('Charged by'), into: P('Provider'), remove: true });
  assert.deepEqual([moved.rows[0].goes, move.yes(moved, true)], [[v('SoCalGas')], 'Move 1 value']);
});
test('a value already held is not written twice; a property that takes one value is not given a second', () => {
  const nodes = [{ uuid: 'a', words: 'Same', from: [v('X')], into: [v('X')] }, { uuid: 'b', words: 'Other', from: [v('X')], into: [v('Y')] }, { uuid: 'c', words: 'Two', from: [v('X'), v('Y')], into: [] }];
  const one = move.plan({ nodes, from: P('From', { many: true }), into: P('Into'), remove: true });
  assert.deepEqual(one.rows.map(row => [row.comes.length, row.goes.length, !!row.skip]), [[0, 1, false], [0, 0, true], [0, 0, true]]);
  assert.deepEqual([one.values, one.kept, move.yes(one, true)], [0, 2, 'Remove 1 value']);
  const many = move.plan({ nodes, from: P('From', { many: true }), into: P('Into', { many: true }) });
  assert.deepEqual([many.rows.map(row => row.comes.length), many.kept, move.yes(many, false)], [[0, 1, 2], 0, 'Copy 3 values']);
});
test('different kinds of value, the same property, or nothing to move are refused in words', () => {
  const nodes = [{ uuid: 'a', words: 'A', from: [v('X')], into: [] }];
  assert.match(move.plan({ nodes, from: P('From'), into: P('When', { type: 'date' }) }).refused, /different kinds/);
  assert.match(move.plan({ nodes, from: P('From'), into: P('From') }).refused, /already under From/);
  assert.match(move.plan({ nodes: [], from: P('From'), into: P('Into') }).refused, /No node here/);
  assert.equal(move.plan({ nodes, from: P('From'), into: { title: 'Brand new', isNew: true, many: false } }).refused, '');
});

// ---- what a reload of the plugins brought
const update = require('../core/update.js');
test('Update plugins says which plugin now runs another version, which are up to date, which could not be updated', () => {
  const was = [{ id: 'a', title: 'Logseq Plugin', version: '0.9.0' }, { id: 'b', title: 'Other', version: '1.0.0' }];
  assert.equal(update.said(was, [{ id: 'a', title: 'Logseq Plugin', version: '0.9.1' }, { id: 'b', title: 'Other', version: '1.0.0' }]), 'Plugins updated: Logseq Plugin 0.9.0 to 0.9.1. Up to date: Other 1.0.0');
  assert.equal(update.said(was, was), 'Plugins up to date: Logseq Plugin 0.9.0, Other 1.0.0');
  assert.equal(update.said([], [was[0]]), '');
  const market = { updated: [{ title: 'Calendar', version: '1.0.0', to: '1.2.0' }], same: [{ title: 'Tabs', version: '2.0.0' }], failed: [{ title: 'Heatmap', why: 'GitHub did not answer' }] };
  assert.equal(update.said([was[0]], [was[0]], market), 'Plugins updated: Calendar 1.0.0 to 1.2.0. Up to date: Logseq Plugin 0.9.0, Tabs 2.0.0. Could not be updated: Heatmap (GitHub did not answer)');
  assert.equal(update.said([], [], { same: [{ title: 'Tabs', version: '2.0.0' }] }), 'Plugins up to date: Tabs 2.0.0');
});
test('a plugin that could not be updated is said in plain words, never in Logseq\'s own error words', () => {   // the owner, 24 November 2026, of Logseq's own words in a notice: "what is this"
  const failed = why => update.said([], [], { failed: [{ title: 'Tabs', why }] });
  assert.equal(failed('release-asset-not-found {"url":"https://api.github.com/repos/someone/tabs/releases/latest","assets":[]}'), 'Could not be updated: Tabs (its newest release holds no file to install)');
  assert.equal(failed('getaddrinfo ENOTFOUND api.github.com'), 'Could not be updated: Tabs (GitHub did not answer)');
  assert.equal(failed('Cannot read properties of undefined (reading \'tag_name\')'), 'Could not be updated: Tabs (Logseq could not update it)');
  for (const plain of ['no answer from Logseq', 'it names no GitHub repository to update from', 'this Logseq lends plugins no updater', 'GitHub did not answer']) assert.equal(failed(plain), `Could not be updated: Tabs (${plain})`);
  assert.equal(failed(''), 'Could not be updated: Tabs');
});
test('a release is newer only when its version is higher', () => {
  assert.equal(update.newer('v1.2.0', '1.1.9'), true);
  assert.equal(update.newer('1.2.0', '1.2.0'), false);
  assert.equal(update.newer('1.10.0', '1.9.3'), true);
  assert.equal(update.newer('0.9.0', '1.0.0'), false);
  assert.equal(update.newer('', '1.0.0'), false);
});

// ---- how one list of Relations is shown
const view = require('../core/view.js');
const R = (uuid, words, tag, day, more = {}) => ({ uuid, words, tag, day, written: day, dates: {}, held: {}, changed: 0, made: 0, ...more });
const some = { key: 'prop:x', rows: [R('a', 'Gas bill', 'Bill payment', 20261114, { held: { Category: ['Utilities'] }, changed: 5 }), R('b', 'Paycheck', 'Income', 20261115, { changed: 9 }),
  R('c', 'Water bill', 'Bill payment', 20261005, { held: { Category: ['Utilities'] }, dates: { Due: 20261020 } }), R('d', 'Rent', 'Bill payment', 20260901, { held: { Category: ['Housing'] } }), R('e', 'Mortgage', 'Bill payment', 20260902, { held: { Category: ['Housing'] } }), R('f', 'A note', '', 0)] };
test('a list names its kinds with their counts, All first, and a kind pressed narrows it', () => {
  const made = view.shape(some, {}, {}, 20261125);
  assert.deepEqual(made.tabs.map(t => [t.word, t.n, t.on]), [['All', 6, true], ['Bill payment', 4, false], ['Income', 1, false], ['No tag', 1, false]]);
  assert.deepEqual([made.count, made.of, made.rows.map(r => r.uuid).join('')], [6, 'nodes', 'bacedf']);
  const bills = view.shape(some, { kind: 'Bill payment' }, {}, 20261125);
  assert.deepEqual([bills.count, bills.of, bills.rows.every(r => !r.tagShown), bills.from, bills.to], [4, 'Bill payments', true, 20260901, 20261114]);
});
test('a list sorts by last change, name or tag, and groups by tag, month or a property that groups well', () => {
  assert.equal(view.shape(some, { sort: 'changed' }, {}, 20261125).rows.map(r => r.uuid).slice(0, 2).join(''), 'ba');
  assert.equal(view.shape(some, { sort: 'name' }, {}, 20261125).rows[0].uuid, 'f');
  assert.deepEqual(view.offers(some.rows), { groups: ['Tag', 'Month', 'Category'], dates: ['Journal', 'Due'], sorts: ['changed', 'name', 'tag'] });
  const months = view.shape(some, { group: 'Month' }, {}, 20261125).groups.map(g => [g.name, g.rows.length]);
  assert.deepEqual(months, [['November', 2], ['October', 1], ['September', 2], ['No day', 1]]);
  const by = view.shape(some, { group: 'Category' }, {}, 20261125);
  assert.deepEqual([by.groups.map(g => [g.name, g.rows.length]), by.said], [[['Housing', 2], ['Utilities', 2], ['No Category', 2]], ['By Category']]);
});
test('another date can be what a list goes by, or none', () => {
  const due = view.shape(some, { date: 'Due' }, {}, 20261125);
  assert.deepEqual([due.rows[0].uuid, due.rows[0].dayShown, due.rows[1].dayShown, due.said], ['c', 20261020, 0, ['Due']]);
  assert.equal(view.shape(some, { date: 'none' }, {}, 20261125).rows.every(r => !r.dayShown), true);
});
test('words narrow a list, and a day turns it back to what was there up to that day', () => {
  assert.deepEqual(view.shape(some, {}, { words: 'bill util' }, 20261125).rows.map(r => r.uuid), ['a', 'c']);
  assert.deepEqual(view.parse('water on Oct 7', 20261125), { words: 'water', upTo: 20261007 });
  assert.deepEqual([view.parse('up to 7 Oct', 20261125).upTo, view.parse('until 2026-10-07', 20261125).upTo, view.parse('on Dec 3', 20261125).upTo, view.parse('carry on', 20261125).upTo], [20261007, 20261007, 20251203, 0]);
  const back = view.shape(some, {}, { upTo: 20261007 }, 20261125);
  assert.deepEqual([back.rows.map(r => r.uuid).join(''), back.since.map(r => r.uuid).join(''), back.total], ['cedf', 'ba', 6]);
});
test('a node made since the page was last open is new, and the lists keep the order they were given', () => {
  const made = view.shape({ rows: [R('a', 'A', 'T', 1, { made: 50 }), R('b', 'B', 'T', 2, { made: 5 })] }, { since: 10 }, {}, 20261125);
  assert.deepEqual([made.fresh, view.shape({ rows: [R('a', 'A', 'T', 1, { made: 50 }), R('b', 'B', 'T', 2, { made: 5 })] }, { since: 10, kind: '@new' }, {}, 20261125).rows.map(r => r.uuid)], [1, ['a']]);
  const lists = [{ key: 'x' }, { key: 'y' }, { key: 'z' }];
  assert.deepEqual([view.ordered(lists, ['z', 'x']).map(l => l.key), view.moved(['x', 'y', 'z'], 'y', -1), view.moved(['x', 'y', 'z'], 'z', 1)], [['z', 'x', 'y'], ['y', 'x', 'z'], ['x', 'y', 'z']]);
});

// ---- how a property reads from the page it points to
const reads = require('../core/reads.js');
test('a property reads back by grammar, a plain noun keeps its name, and a name the person gave wins', () => {
  assert.deepEqual(['Prescribed by', 'Symptom of', 'Child of', 'Located in', 'Diagnosed with', 'Works at', 'Lives in', 'Treats', 'Mentions', 'Provider', 'Topic', 'From account', 'Spoke with', 'Notes'].map(t => reads.back(t)),
    ['Prescribed', 'Symptoms', 'Children', 'Location of', 'Diagnosis of', 'Employer of', 'Home of', 'Treated by', 'Mentioned in', 'Provider of', 'Topic', 'From account', 'Spoke with', 'Notes']);
  assert.equal(reads.back('Provider', { Provider: 'Seen by me' }), 'Seen by me');
});
test('a node without a property four in five of its list hold is marked', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((u, i) => R(u, u, 'T', 20261001 + i, { held: i ? { Topic: ['x'] } : {} }));
  assert.deepEqual(view.shape({ rows }, {}, {}, 20261125).rows.map(r => r.lacks).sort(), ['', '', '', '', 'Topic']);
});

test('a property set to "Hide by default" is not said after a line, nor asked for where it lacks, and words still find it', () => {
  const lacking = ['a', 'b', 'c', 'd', 'e'].map((u, i) => R(u, u, 'T', 20261001 + i, { held: i ? { Topic: ['x'] } : {} }));
  assert.deepEqual(view.shape({ rows: lacking, hidden: ['Topic'] }, {}, {}, 20261125).rows.map(r => r.lacks), ['', '', '', '', '']);
  const rows = ['a', 'b', 'c'].map((u, i) => R(u, u, 'T', 20261001 + i, { held: { Amount: [String(10 + i)] } }));
  assert.equal(view.shape({ rows }, {}, {}, 20261125).rows.every(r => r.tell), true);
  assert.equal(view.shape({ rows, hidden: ['Amount'] }, {}, {}, 20261125).rows.some(r => r.tell), false);
  assert.deepEqual(view.shape({ rows, hidden: ['Amount'] }, {}, { words: '11', upTo: 0 }, 20261125).rows.map(r => r.hits.map(h => h.name)), [['Amount']]);
});

// ---- where nodes fall in time
const time = require('../core/time.js');
test('a timeline runs from the first node\'s month to today, a dot on each node\'s day, months ticked', () => {
  const made = time.layout({ dots: [{ day: 20260915 }, { day: 20261101 }, { day: 20261103, off: true }], today: 20261125 });
  assert.deepEqual([made.year, made.months.map(m => m.name), made.dots.map(d => d.left > 0 && d.left < 100), made.dots[2].off, made.today > made.dots[2].left], [2026, ['Sep', 'Oct', 'Nov'], [true, true, true], true, true]);
  assert.deepEqual([time.week(20261007), time.words(20261007)], [[20261004, 20261010], 'Oct 7, 2026']);
  const tall = time.layout({ dots: Array.from({ length: 7 }, () => ({ day: 20261103 })), tall: true, today: 20261125 });
  assert.deepEqual([tall.dots.length, tall.dots.map(d => d.pile), tall.more[0].n], [5, [0, 1, 2, 3, 4], 2]);
  const lanes = time.lanesBy([{ held: { Topic: ['A'] } }, { held: { Topic: ['A'] } }, { held: { Topic: ['B'] } }, { held: {} }], 'Topic');
  assert.deepEqual([lanes.names, lanes.counts], [['A', 'B', 'others'], [2, 1, 1]]);
});

test('a node found by what it holds under a property says which property, from three letters; never the list\'s own', () => {
  const list = { key: 'k', kind: 'property', own_name: 'Paid from', rows: [
    { uuid: 'a', words: 'Gas', tag: 'Purchase', held: { 'Charged by': ['Shell'], 'Paid from': ['Shell account'] } },
    { uuid: 'b', words: 'Shelves', tag: 'Purchase', held: { 'Charged by': ['Ikea'] } }] };
  const found = view.shape(list, {}, { words: 'she', upTo: 0 }, 20261125).rows;
  assert.deepEqual(found.map(row => [row.uuid, row.hits.map(hit => hit.name)]).sort(), [['a', ['Charged by']], ['b', []]]);
  assert.equal(view.shape(list, {}, { words: 'sh', upTo: 0 }, 20261125).rows.some(row => row.hits), false);
});

test('a day as it is typed is read into Logseq\'s number, and nothing is guessed', () => {
  const today = 20261125;
  assert.equal(days.typed('today', today), 20261125);
  assert.equal(days.typed('Tomorrow', today), 20261126);
  assert.equal(days.typed('2026-11-18', today), 20261118);
  assert.equal(days.typed('nov 18', today), 20261118);
  assert.equal(days.typed('18 November', today), 20261118);
  assert.equal(days.typed('November 18th, 2025', today), 20251118);
  assert.equal(days.typed('feb 30', today), 0);
  assert.equal(days.typed('next week', today), 0);
  assert.equal(days.typed('ma 3', today), 0);
});
test('a node is written as Markdown: its name, its tags, what it holds, then its bullets', () => {
  const markdown = require('../core/markdown.js');
  const lines = [{ depth: 0, words: 'Fatigue worse, ask [[Dr. Mei Chen]]' }, { depth: 1, words: 'Sleeping ten hours\nstill tired' }, { depth: 0, words: 'Book the test', task: 'open' }, { depth: 0, words: 'Paid #[[Side effect]]', task: 'done' }];
  assert.equal(markdown.page({ title: 'Saw [[Dr. Mei Chen]]', tags: ['Consultation'], properties: [{ name: 'Provider', values: ['Dr. Mei Chen'] }, { name: 'Follow-up', values: [] }], lines }),
    '# Saw Dr. Mei Chen\n#Consultation\n\nProvider: Dr. Mei Chen\n\n- Fatigue worse, ask Dr. Mei Chen\n  - Sleeping ten hours\n    still tired\n- [ ] Book the test\n- [x] Paid #Side-effect');
  // A bullet copied from deep in an outline starts at the margin.
  assert.equal(markdown.outline([{ depth: 2, words: 'deep one' }, { depth: 3, words: 'under it' }]), '- deep one\n  - under it');
  assert.equal(markdown.page({ title: 'Empty' }), '# Empty');
});

const S = require('../core/search.js'), sentence = require('../core/sentence.js');
test('a kind\'s choices: what narrows, with counts, and the months newest first', () => {
  const nodes = [
    { held: { Provider: ['Dr. Mei Chen'], Topic: ['Colon cancer'] }, day: 20261007 },
    { held: { Provider: ['Dr. Mei Chen'], Topic: ['Colon cancer'] }, day: 20260820 },
    { held: { Provider: ['Dr. Raj Patel'], Topic: ['Colon cancer'] }, day: 20260709 },
  ];
  const got = S.choices(nodes);
  assert.deepEqual(got.props, [{ prop: 'Provider', values: [{ label: 'Dr. Mei Chen', count: 2 }, { label: 'Dr. Raj Patel', count: 1 }] }]);   // Topic: one value on every node narrows nothing
  assert.deepEqual(got.months.map(m => m.label), ['Oct 2026', 'Aug 2026', 'Jul 2026']);
  assert.equal(S.holds(nodes[0], [{ kind: 'value', prop: 'Provider', label: 'Dr. Mei Chen' }, { kind: 'month', key: 202610 }]), true);
  assert.equal(S.holds(nodes[2], [{ kind: 'value', prop: 'Provider', label: 'Dr. Mei Chen' }]), false);
});
// F73 (rundown-070): with Person taken, "may" emptied the list while Maya Lin stood in the graph, and "marc" hid Marco.
test('with a kind taken, letters that read as a month but hold none of its nodes are plain words', () => {
  const today = new Date(2026, 10, 27), people = [{ uuid: 'a', words: 'Maya Lin' }, { uuid: 'b', words: 'Marco Rossi' }, { uuid: 'c', words: 'Otto Mayer' }, { uuid: 'd', words: 'Ann Lee' }];
  const find = (nodes, text) => S.taken(nodes, text, sentence.read(text, {}, today));
  assert.deepEqual(find(people, 'may').rows.map(n => n.uuid), ['a', 'c']);
  assert.equal(find(people, 'may').time, null);
  assert.deepEqual(find(people, 'marc').rows.map(n => n.uuid), ['b']);
  assert.deepEqual(find(people, 'maya').rows.map(n => n.uuid), ['a']);
  // A month that does hold nodes of the kind is still a month: those inside it, and those just outside as near.
  const visits = [{ uuid: 'v1', words: 'Check-up', day: 20260512 }, { uuid: 'v2', words: 'Follow-up', day: 20260703 }, { uuid: 'v3', words: 'First visit', day: 20250110 }];
  const may = find(visits, 'may');
  assert.deepEqual([may.rows.map(n => n.uuid), may.near.map(n => n.uuid), may.time.label], [['v1'], ['v2'], 'May 2026']);
  assert.equal(S.within(people, may.time), null);
});
test('a sentence reads a kind, a value of its nodes, a page and a time', () => {
  const today = new Date(2026, 10, 26);
  const names = { kinds: new Map([['consultation', { id: 1, title: 'Consultation' }]]), values: new Map([['dr. mei chen', { prop: 'Provider', label: 'Dr. Mei Chen' }]]), pages: new Map([['fatigue', { uuid: 'u', title: 'Fatigue' }]]) };
  const got = sentence.read('consultations with mei chen around Aug 2026 tingling', names, today);
  assert.deepEqual(got.picks.map(p => p.kind), ['tag', 'value', 'when']);
  assert.equal(got.picks[2].label, 'around Aug 2026');
  assert.equal(got.picks[2].from, 20260701); assert.equal(got.picks[2].to, 20260930);
  assert.deepEqual(got.words, ['tingling']);
  assert.deepEqual(sentence.read('fatigue since march', names, today).picks.map(p => p.kind), ['page', 'when']);
  assert.equal(sentence.when('may to august', today).label, 'May–Aug 2026');
  const like = text => sentence.sentenceLike(sentence.read(text, names, today));
  assert.deepEqual(['consultations with mei chen', 'fatigue since march', 'consultation', 'fatigue', '2026'].map(like), [true, true, false, false, false]);
});

const sheet = require('../core/sheet.js');
const cmd = (id, key, label = id) => ({ id, key, label });
test('hidden menu lines are kept in one setting, once each, and brought back by name', () => {
  const H = require('../core/hidden.js');
  const words = H.add(H.add('', '··· menus', 'Publish page'), '··· menus', 'publish page');
  assert.equal(words, '··· menus: Publish page');
  assert.deepEqual([H.has(H.list(words), '··· menus', 'Publish Page'), H.has(H.list(words), 'The / menu', 'Publish page'), H.has(H.list('Import'), 'The / menu', 'import')], [true, false, true]);
  assert.equal(H.drop(words, '··· menus: Publish page'), '');
});
test('the key sheet lists each key as it is now, and leaves out a line with none', () => {
  const got = sheet.groups([cmd('editor/undo', '⌘Z'), cmd('editor/redo', ''), cmd('editor/indent', ''), cmd('go/search', '⌘K'), cmd('go/journals', 'g j', 'Go to journals'), cmd('lk-todo', 'g d', 'Todo'), cmd('go/all-graphs', 'g ⇧G', 'Go to all graphs'), cmd('sidebar/clear', '⌘C ⌘C')], { takesKey: true });
  assert.deepEqual(got.map(g => g.head), ['Writing', 'Finding', 'Two letters, outside a bullet']);
  assert.deepEqual(got[0].lines, [{ words: 'Undo, redo', keys: ['⌘Z'] }]);
  assert.deepEqual(got[1].lines, [{ words: 'Search', keys: ['⌘K'] }]);   // Logseq's search never hears Cmd-K while Search takes it
  assert.deepEqual(got[2].lines.map(l => l.words), ['Todo', 'Go to all graphs', 'Go to journals']);   // by their letters
});
test('the key sheet gives Cmd-K back to Logseq\'s search when Search does not take it', () => {
  const finding = search => sheet.groups([cmd('go/search', '⌘K')], search)[0].lines.map(l => `${l.words} ${l.keys.join()}`);
  assert.deepEqual(finding({ takesKey: false }), ['Logseq’s search ⌘K']);
  assert.deepEqual(finding(null), ['Logseq’s search ⌘K']);
});
test('the key sheet gives Cmd-Shift-P to the corner\'s commands while the corner takes it', () => {
  const got = sheet.groups([cmd('command-palette/toggle', '⌘⇧P')], null, { takesKey: true })[0].lines.map(l => `${l.words} ${l.keys.join()}`);
  assert.deepEqual(got, ['Commands ⌘⇧P']);
});
test('typed words find a line that holds every one, and say where', () => {
  assert.deepEqual(sheet.found('Undo, redo', 'RE un'), [{ text: 'Un', hit: true }, { text: 'do, ', hit: false }, { text: 're', hit: true }, { text: 'do', hit: false }]);
  assert.equal(sheet.found('Undo, redo', 'undo indent'), null);
  assert.deepEqual(sheet.found('Fold', ''), [{ text: 'Fold', hit: false }]);
});
const X = require('../core/export.js'), paper = require('../core/paper.js'), MD = require('../core/markdown.js');
const held = (ident, name, type, ...values) => ({ ident: `user.property/${ident}`, name, type, values });
// A page as the ground hands it to an export.
const nodeOf = (words, facts = {}, children = []) => ({ ...X.node({ words, ...facts }), children });
const sheetOf = over => ({ kind: 'page', title: 'Fatigue', tags: ['Symptom'], properties: [held('provider', 'Provider', 'node', { text: 'Dr. Mei Chen' }), held('since', 'Since', 'date', { day: 20261004 })], tagged: [], names,
  nodes: [
    nodeOf('How it went', {}, [nodeOf(`Worse after [[${A}]], **very** _much_ #[[Symptom]]`), nodeOf('Sleeping ten hours', {}, [nodeOf('naps too')])]),
    nodeOf('Book the test', { task: { status: 'todo', priority: 'High', deadline: { day: 20261010 }, scheduled: null }, tags: [] }),
    nodeOf('Old plan', { task: { status: 'canceled', priority: '' } }),
    nodeOf('## Tried', {}, [nodeOf('Iron', { numbered: true }), nodeOf('Rest', { numbered: true })]),
    nodeOf('a < b', { display: 'code', lang: 'js' }),
    nodeOf('a value', { value: true }),
  ], ...over });
const chosen = over => ({ ...X.choices(), titleDate: false, ...over });
const asMd = (sheet, over) => MD.sheet(sheet, { ...X.options(sheet, chosen(over), 20261126, 'en-GB'), });
test('an export as Markdown: the title, what the page holds, a short line with lines under it a heading, bullets one level in', () => {
  assert.equal(asMd(sheetOf()), `# Fatigue

Provider: Dr. Mei Chen  
Since: 4 Oct 2026  
#Symptom

## How it went

Worse after Dr. Mei Chen, **very** *much* #Symptom

Sleeping ten hours

- naps too

- [ ] Book the test  
  *Deadline: 10 Oct 2026 · Priority: High*
- [x] ~~Old plan~~

### Tried

1. Iron
2. Rest

\`\`\`js
a < b
\`\`\`
`);
});
test('what is left out is left out: a property, the tags, the task marks; links and front matter as chosen', () => {
  const got = asMd(sheetOf(), { tags: false, tasks: false, hiddenHead: ['user.property/since'], links: 'wiki', frontMatter: true });
  assert.ok(got.startsWith('---\ntitle: Fatigue\nprovider: Dr. Mei Chen\n---\n\n# Fatigue\n'), got);
  assert.ok(!got.includes('Since') && !got.includes('#Symptom') && !got.includes('[ ]') && got.includes('[[Dr. Mei Chen]]'), got);
  assert.ok(asMd(sheetOf(), { frontMatter: true }).startsWith('---\ntitle: Fatigue\ntags: [Symptom]\n'));
  assert.ok(asMd(sheetOf(), { links: 'file' }).includes('[Dr. Mei Chen](Dr.%20Mei%20Chen.md)'));
});
test('the words of an export: Markdown\'s signs told apart, mathematics and pictures kept, a bullet reference as its words', () => {
  const one = words => MD.sheet({ kind: 'blocks', title: '', tags: [], properties: [], tagged: [], names, nodes: [nodeOf(words)] }).trim();
  assert.equal(one('2*3 [a] # not a heading'), '2\\*3 \\[a\\] # not a heading');
  assert.equal(one('# '), '');
  assert.equal(one('- dash first'), '\\- dash first');
  assert.equal(one('Area $a_1 * b$ here'), 'Area $a_1 * b$ here');
  assert.equal(one('![scan](https://example.org/a.png)'), '![scan](https://example.org/a.png)');
  assert.equal(one(`As ((${B})) and [said so](((${B})))`), 'As Fatigue and said so');
  assert.equal(one('[the site](https://example.org/a) and https://example.org/b'), '[the site](https://example.org/a) and <https://example.org/b>');
});
test('a bullet\'s kind is told from its facts; an embedded node stands for what it holds', () => {
  assert.equal(X.node({ uuid: 'u', words: 'scan', asset: 'png' }).image.file, 'assets/u.png');
  assert.equal(X.node({ uuid: 'u', words: 'report', asset: 'pdf' }).kind, 'file');
  assert.equal(X.node({ words: 'x', value: true }).kind, 'value');
  assert.equal(X.node({ words: '### Deep' }).heading, 3);
  const sheet = { kind: 'blocks', title: '', tags: [], properties: [], tagged: [], names, nodes: [nodeOf('', { embed: true }, [nodeOf('inside')]), nodeOf('')] };
  assert.equal(MD.sheet(sheet), 'inside\n');
});
test('the paper writes running text: lines under a line join its paragraph, a # makes the heading, a citation is a numbered note', () => {
  const sheet = { kind: 'page', title: 'Care', tags: [], properties: [], tagged: [], names, nodes: [
    nodeOf('## Side effects', {}, [
      nodeOf(`Tingling began after cycle 2 ([[${A}]], p. 2).`, {}, [nodeOf('The dose was cut ([Letter](https://example.org/l))')]),
      nodeOf(`Again later ([[${A}]], p. 2)`),
      nodeOf('A short line', {}, [nodeOf('and its detail')])])] };
  const got = paper.html(sheet, X.options(sheet, chosen(), 20261126, 'en-GB'));
  for (const piece of ['<h2 class="x-h2">Side effects</h2>', 'cycle 2.<sup class="x-ref">1</sup> The dose was cut.<sup class="x-ref">2</sup></p>', '<p class="x-p">Again later<sup class="x-ref">1</sup></p>', '<p class="x-p">A short line. and its detail.</p>',
    '<h2 class="x-notes-head">Notes</h2>', '<span class="x-note-n">1</span>Dr. Mei Chen, p. 2.</p>', 'https://example.org/l.</p>']) assert.ok(got.includes(piece), `${piece} not in\n${got}`);
});
test('the paper as bullets: every line a bullet, nested as in Logseq, a citation left as written', () => {
  const sheet = { kind: 'page', title: 'Care', tags: [], properties: [], tagged: [], names, nodes: [
    nodeOf('## Side effects', {}, [nodeOf(`Tingling ([[${A}]], p. 2)`, {}, [nodeOf('The dose was cut')])])] };
  const got = paper.html(sheet, X.options(sheet, chosen({ text: 'outline' }), 20261126, 'en-GB'));
  assert.ok(/<ul class="x-ul">\n<li class="x-li"><strong>Side effects<\/strong>\n<ul class="x-ul">\n<li class="x-li">Tingling \(Dr\. Mei Chen, p\. 2\)\n<ul class="x-ul">\n<li class="x-li">The dose was cut/.test(got), got);
  assert.ok(!got.includes('x-ref') && !got.includes('x-notes-head'));
  assert.equal(X.choices('{"text":"nonsense"}').text, 'prose');
});
test('the paper: properties on one line, a tag, a heading, task circles, numbered lines, nothing unescaped', () => {
  const sheet = sheetOf(), got = paper.html(sheet, X.options(sheet, chosen({ kicker: '' }), 20261126, 'en-GB'));
  for (const piece of ['<h1 class="x-title">Fatigue</h1>', '<span class="x-prop">Provider: Dr. Mei Chen</span>', '<span class="x-prop"><span class="x-tag">Symptom</span></span>', '<p class="x-p">How it went. Worse after Dr. Mei Chen,', 'x-task x-todo', 'x-task x-off', '<ol class="x-ol">', 'a &lt; b']) assert.ok(got.includes(piece), `${piece} not in\n${got}`);
  const look = { paper: 'Letter', margins: 'wide', footer: 'My "notes"', pageNumbers: false };
  assert.ok(paper.css(look).includes('size: Letter; margin: 26mm 30mm 28mm; @bottom-left { content: "My \\"notes\\""'));
  assert.ok(!paper.css(look).includes('counter(page)'));
  assert.ok(!/-apple-system|system-ui|Literata/.test(paper.css({})));   // a variable face prints as outlines
  assert.deepEqual([paper.sizes({ paper: 'A4' }).width, paper.sizes({ paper: 'Letter' }).width], [794, 816]);
});
test('the export\'s choices come back only as the window offers them, and lines are kept for each page', () => {
  assert.equal(X.choices('not json').paper, 'A4');
  const got = X.choices(JSON.stringify({ target: 'rich', paper: 'Letter', pageNumbers: 'no', hiddenHead: ['a', 3] }));
  assert.deepEqual([got.target, got.paper, got.pageNumbers, got.hiddenHead], ['pdf', 'Letter', true, ['a']]);
  const kept = X.withLines(got, { title: 'Fatigue' }, { kicker: 'Notes', subtitle: '' });
  assert.deepEqual(X.lines(kept, { title: 'Fatigue' }), { kicker: 'Notes', subtitle: '' });
  assert.deepEqual(X.lines(kept, { title: 'Other' }), { kicker: '', subtitle: '' });
  assert.deepEqual(X.withLines(kept, { title: 'Fatigue' }, { kicker: '', subtitle: '' }).titles, {});
});
test('a property set to "Hide by default" starts unticked in the export, and one ticked on purpose stays ticked', () => {
  const sheet = { kind: 'page', title: 'Chen', tags: [], tagged: [], names, nodes: [], properties: [{ ident: 'open', name: 'Works at', type: 'default', values: [{ text: 'Northgate' }] }, { ident: 'shy', name: 'Specialty', type: 'default', hidden: true, values: [{ text: 'Oncology' }] }] };
  const shown = chosenNow => [...(X.options(sheet, chosenNow, 20261126, 'en-GB').shownHead || ['open', 'shy'])];
  assert.deepEqual([X.leftOut(sheet, 'head', X.choices('')), shown(X.choices(''))], [['shy'], ['open']]);
  const ticked = { ...X.choices(''), ...X.ticks(sheet, 'head', X.choices(''), ['open', 'shy']) };
  assert.deepEqual([X.leftOut(sheet, 'head', ticked), shown(X.choices(JSON.stringify(ticked)))], [[], ['open', 'shy']]);
  const none = { ...ticked, ...X.ticks(sheet, 'head', ticked, []) };
  assert.deepEqual([X.leftOut(sheet, 'head', none).sort(), shown(none)], [['open', 'shy'], []]);
  // What another page left out is kept.
  const other = { ...X.choices(''), hiddenHead: ['elsewhere'], askedHead: ['gone'] };
  const kept = X.ticks(sheet, 'head', other, ['open']);
  assert.deepEqual([kept.hiddenHead, kept.askedHead], [['elsewhere'], ['gone']]);
  // Never recorded as left out by the person: set to show again, it is ticked again.
  const shownAgain = { ...sheet, properties: sheet.properties.map(p => ({ ...p, hidden: false })) };
  assert.deepEqual(X.leftOut(shownAgain, 'head', { ...X.choices(''), ...X.ticks(sheet, 'head', X.choices(''), ['open']) }), []);
});
test('a file\'s name is the page\'s, and one that is there is left alone', async () => {
  assert.equal(X.fileName({ title: 'A/B: notes?', nodes: [], names }), 'A B notes');
  assert.equal(X.fileName({ title: '', names, nodes: [nodeOf(`Saw [[${A}]]`)] }), 'Saw Dr. Mei Chen');
  const there = new Set(['Notes.md', 'Notes 2.md']);
  assert.equal(await X.freeName('Notes.md', async name => there.has(name)), 'Notes 3.md');
});

test('the graph switcher puts the graphs opened last first, the rest by name, and steps round past either end', () => {
  const graphs = require('../core/graphs.js'), all = ['logseq_db_Beta', 'logseq_db_Delta', 'logseq_db_Alpha', 'logseq_db_Gamma'];
  assert.deepEqual(graphs.order(all, graphs.opened(graphs.opened([], 'logseq_db_Gone'), 'logseq_db_Gamma')).map(graphs.name), ['Gamma', 'Alpha', 'Beta', 'Delta']);
  assert.deepEqual(graphs.opened(['a', 'b'], 'b'), ['b', 'a']);
  assert.deepEqual([graphs.step(3, 1, 4), graphs.step(0, -1, 4), graphs.step(0, 1, 1)], [0, 3, 0]);
});

// ---- one reader of a day said in words, and one plural, for every part (a round of faults, 27 November 2026)
test('a dose or a count is no day: only a month\'s own name, whole or cut short, is read as a month', () => {
  // 27 November 2026 is a Friday.
  const dayIn = words => todo.dayIn(words, 20261127);
  for (const words of ['Take Decadron 4 mg with food', 'Octreotide 20 mg injection', 'Call Mark 2 times', 'Ask Maya 3 questions', 'Refill Augmentin 2 boxes', 'Novolog 10 units before dinner', 'Take 4 decadron', 'Give 2 marks'])
    assert.equal(dayIn(words), null, words);
  assert.deepEqual(dayIn('Call Sam on nov 20'), { day: 20271120, words: 'Call Sam' });
  assert.deepEqual(dayIn('Refill on Dec. 4th'), { day: 20261204, words: 'Refill' });
  assert.deepEqual(dayIn('Scan 3 december, then call'), { day: 20261203, words: 'Scan, then call' });
  assert.deepEqual(dayIn('Pay the rent by sept 1'), { day: 20270901, words: 'Pay the rent' });
  assert.equal(dayIn('Remember feb 30'), null);
  // A short weekday that is only a word does not stop a real one later in the words from being read.
  assert.deepEqual(dayIn('Mom sat with nurse, call back friday'), { day: 20261204, words: 'Mom sat with nurse, call back' });
});
test('a year said with the day in a new task is the day\'s year and leaves the words with it', () => {
  // 27 November 2026 is a Friday.
  const dayIn = words => todo.dayIn(words, 20261127);
  assert.deepEqual(dayIn('Renew passport 3 december 2027'), { day: 20271203, words: 'Renew passport' });
  assert.deepEqual(dayIn('File taxes on apr 15 2028'), { day: 20280415, words: 'File taxes' });
  assert.deepEqual(dayIn('Call Sam by nov 20, 2026'), { day: 20261120, words: 'Call Sam' });   // this year said: the day that has just passed, not next year's
  assert.deepEqual(dayIn('Book the scan dec 4 2026, then call'), { day: 20261204, words: 'Book the scan, then call' });
  assert.deepEqual(dayIn('Scan on 3 dec. 2027'), { day: 20271203, words: 'Scan' });
  // With no year the words are left as they were: this year, or the next when the day has passed.
  assert.deepEqual(dayIn('Renew passport 3 december'), { day: 20261203, words: 'Renew passport' });
  assert.deepEqual(dayIn('Call Sam on nov 20'), { day: 20271120, words: 'Call Sam' });
  // A number that would put a task's day in a year gone by is not taken for its year: it stays in the words.
  assert.deepEqual(dayIn('Order masks nov 20 2000'), { day: 20271120, words: 'Order masks 2000' });
  assert.deepEqual(dayIn('Summarise the visit of 3 december 2024'), { day: 20261203, words: 'Summarise the visit of 2024' });
  assert.deepEqual(dayIn('Order nov 20 5000 masks'), { day: 20271120, words: 'Order 5000 masks' });
  assert.equal(dayIn('Leap day feb 29 2027'), null);
});
test('every reader of a typed day asks the one piece: the same words are a day, or no day, wherever they are typed', () => {
  const today = 20261127;
  for (const words of ['decadron 4', 'mark 2', 'octreotide 20', '4 decadron', '2026-13-45', '2026-02-31', 'feb 30'])
    assert.deepEqual([days.typed(words, today), view.dayIn(words, today), todo.dayIn(`Call ${words}`, today), sentence.read(words, {}, new Date(2026, 10, 27)).picks.length], [0, 0, null, 0], words);
  assert.equal(view.parse('chen until 2026-02-31', today).upTo, 0);
  assert.deepEqual([days.valid(20260231), days.valid(20261345), days.valid(20260228), days.valid(20240229)], [false, false, true, true]);
  // What a month is, said once.
  assert.deepEqual(['nov', 'Nov.', 'november', 'sept', 'no', 'decadron', 'mark', 'maya', 'augmentin', 'novolog'].map(days.monthOf), [11, 11, 11, 9, 0, 0, 0, 0, 0, 0]);
  // The year of a day said without one is the one difference between the places, and it is decided in the one piece:
  // a date asked for is this year's, a task's day is coming, a list is turned back to a day that has been.
  assert.deepEqual([days.typed('dec 4', today), todo.dayIn('Call dec 4', today).day, view.dayIn('dec 4', today)], [20261204, 20261204, 20251204]);
  assert.deepEqual([days.typed('nov 20', today), todo.dayIn('Call nov 20', today).day, view.dayIn('nov 20', today)], [20261120, 20271120, 20261120]);
  assert.deepEqual(['this', 'coming', 'past'].map(lean => days.yearFor(12, 4, today, lean)), [2026, 2026, 2025]);
  assert.equal(sentence.when('7 may', new Date(2026, 10, 27)).label, 'May 7, 2026');
  assert.equal(sentence.when('aug 5th 2025', new Date(2026, 10, 27)).label, 'Aug 5, 2025');
  assert.equal(days.typed('November 18th, 1850', today), 18501118);
});
test('several of a kind are said one way: the list\'s head, its count and its name agree', () => {
  assert.deepEqual(['Person', 'Child', 'Contact person', 'person', 'Woman', 'Human', 'Transfer'].map(plural), ['People', 'Children', 'Contact people', 'people', 'Women', 'Humans', 'Transfers']);
  const node = (uuid, tag) => ({ uuid, words: uuid, day: 0, tag }), prop = { ident: 'p/by', title: 'Attended by', uuid: 'u' };
  const [people] = lists({ links: [{ prop, node: node('a', 'Person') }, { prop, node: node('b', 'Person') }] });
  assert.equal(people.said, '2 People');
  assert.equal(view.shape({ rows: [node('a', 'Child'), node('b', 'Child')] }, {}, {}, 20261127).of, 'Children');
  assert.deepEqual(['Person of', 'Child of', 'Symptom of'].map(title => reads.back(title)), ['People', 'Children', 'Symptoms']);
});

// ---- the round of 27 November 2026: what a merge, a move and a delete in Ontology must never lose
test('three properties merged at once: no value is left under no property, and a node that keeps its own is counted', () => {
  const kept = many => ({ ident: 'p/provider', title: 'Provider', type: 'node', many }), id = (raw, text) => ({ raw, text });
  const gone = [{ prop: P('Doctor'), nodes: [{ uuid: 'n', words: 'Visit', values: [id(11, 'Dr. Mei Chen')] }] }, { prop: P('Physician'), nodes: [{ uuid: 'n', words: 'Visit', values: [id(12, 'Dr. Paul Okafor')] }] }];
  const many = move.merge({ kept: kept(true), held: [], gone });
  assert.deepEqual(many.map(({ made }) => made.rows.map(row => [row.stays.map(one => one.raw), row.comes.map(one => one.raw), row.goes.length])), [[[[], [11], 1]], [[[11], [12], 1]]]);   // the second is written on top of the first
  const one = move.merge({ kept: kept(false), held: [], gone });
  assert.deepEqual(one.map(({ made }) => [made.rows[0].comes.length, made.rows[0].goes.length, made.kept]), [[1, 1, 0], [0, 0, 1]]);   // the second value stays under Physician
  assert.match(one[1].made.rows[0].skip, /Provider takes one value/);
});
test('a value that has bullets written under it is left where it is, and the plan says how many nodes and why', () => {
  const nodes = [{ uuid: 'a', words: 'X', from: [{ raw: 'first line', text: 'first line', under: 2 }], into: [] }, { uuid: 'b', words: 'Y', from: [v('plain')], into: [] }];
  const moved = move.plan({ nodes, from: P('Notes', { type: 'default' }), into: P('Remarks', { type: 'default' }), remove: true });
  assert.deepEqual(moved.rows.map(row => [row.comes.length, row.goes.length, row.why]), [[0, 0, 'under'], [1, 1, '']]);
  assert.deepEqual([moved.kept, moved.left.map(one => [one.why, one.n]), move.yes(moved, true)], [1, [['under', 1]], 'Move 1 value']);
  assert.match(moved.left[0].words, /bullets written under it/);
  assert.equal(move.plan({ nodes, from: P('Notes', { type: 'default' }), into: P('Remarks', { type: 'default' }) }).rows[0].why, 'under');   // a copy would arrive without them
});
test('two times are two values: a property that takes one time is not given a second, and the box can say so', () => {
  const at = (raw, text) => ({ raw, text }), nodes = [{ uuid: 'a', words: 'Consultation', from: [at(1795798800000, 'Nov 27, 09:00')], into: [at(1795802400000, 'Nov 27, 10:00')] }];
  const made = move.plan({ nodes, from: P('Start', { type: 'datetime' }), into: P('Time', { type: 'datetime' }), remove: true });
  assert.deepEqual([made.rows[0].skip, made.rows[0].goes, made.kept, move.yes(made, true)], ['Time takes one value and this would hold 2', [], 1, '']);
  assert.deepEqual(move.left(made), ['1 node is left as it is: Time takes one value and this would hold 2']);
});
test('the Undo of a move puts back only the nodes that still hold what the move left', () => {
  const rows = [
    { uuid: 'a', was: { from: [11], into: [] }, wrote: { into: [11], from: true } },      // as the move left it
    { uuid: 'b', was: { from: [12], into: [] }, wrote: { into: [12], from: true } },      // set by hand to another node since
    { uuid: 'c', was: { from: [13], into: [9] }, wrote: { into: [9, 13], from: false } }, // a copy; the first property untouched
    { uuid: 'd', was: { from: [14], into: [] }, wrote: { into: [14], from: true } },      // deleted since: it holds nothing
  ];
  const now = { into: new Map([['a', [11]], ['b', [99]], ['c', [13, 9]]]), from: new Map([['c', [13]]]) };
  const made = move.back(rows, now);
  assert.deepEqual([made.back.map(row => row.uuid), made.left.map(row => row.uuid)], [['a', 'c'], ['b', 'd']]);
});
test('Tab and Shift-Tab on a tag are worked out from the tags, the same on the page and in the sidebar', () => {
  const tags = new Map([[1, { id: 1, title: 'Entity', uuid: 'e', parents: [] }], [2, { id: 2, title: 'Occurrence', uuid: 'o', parents: [] }], [3, { id: 3, title: 'Consultation', uuid: 'c', parents: [2] }], [4, { id: 4, title: 'Call', uuid: 'k', parents: [3] }], [5, { id: 5, title: 'Visit', uuid: 'v', parents: [2] }]]);
  assert.equal(tagTree.step(2, tags, false), 1);      // a top tag goes under the top tag above it, though on the page it heads an area of its own
  assert.equal(tagTree.step(1, tags, false), null);   // the first has none above it
  assert.equal(tagTree.step(5, tags, false), 3);      // under the tag above it at its level
  assert.equal(tagTree.step(4, tags, true), 2);       // out one level: under the tag its own sits under
  assert.equal(tagTree.step(3, tags, true), 0);       // out of a top tag: to the top
  assert.equal(tagTree.step(1, tags, true), null);    // already at the top
});
test('the question before a delete counts what truly goes, and never calls a tag empty whose page holds bullets', () => {
  const scratch = tagTree.going([{ kind: 'tag', title: 'Scratch', nodes: 0, kids: 0, bullets: 2 }]);
  assert.equal(scratch.words, 'Delete the tag “Scratch”? This cannot be undone.');
  assert.match(scratch.note, /2 bullets written on its page are deleted with it, for good/);
  assert.doesNotMatch(scratch.note, /no nodes|No node holds it, it has no child tags and nothing/);
  assert.equal(scratch.whole, false);
  const empty = tagTree.going([{ kind: 'tag', title: 'Empty', nodes: 0, kids: 0, bullets: 0 }]);
  assert.deepEqual([empty.words, empty.whole, empty.yes], ['Delete the tag “Empty”?', true, 'Delete the tag']);
  const full = tagTree.going([{ kind: 'tag', title: 'Doctor', nodes: 12, kids: 2, bullets: 1 }]);
  assert.match(full.note, /^12 nodes hold it\. It is taken off every one of them\. Its 2 child tags stay, without it as their parent\. The bullet written on its page is deleted with it, for good\.$/);
  const prop = tagTree.going([{ kind: 'property', title: 'Provider', nodes: 3, bullets: 0 }]);
  assert.deepEqual([prop.words, prop.whole, prop.yes], ['Delete the property “Provider”? This cannot be undone.', false, 'Delete the property']);
  assert.match(prop.note, /3 nodes hold a value under it\. Those values are deleted with it, for good/);
  assert.equal(tagTree.going([{ kind: 'tag', title: 'A', nodes: 1, kids: 0, bullets: 0 }, { kind: 'tag', title: 'B', nodes: 0, kids: 0, bullets: 0 }]).words, 'Delete 2 tags? This cannot be undone.');
});
// F74 of the round rundown-070 (27 November 2026): "chen" typed in Todo's line took "Call [[Dr. Mei Chen]] back" out of the
// list, and grouped by parent its heading read the linked node's id in place of its name.
test('Todo finds a task by a linked name, and a heading says a name, never an id', () => {
  const CHEN = '6502f1c3-0b1c-4e7e-9a55-3b1f1d0c9a11', names = new Map([[CHEN, 'Dr. Mei Chen']]);
  const call = { uuid: 'a', words: `Call [[${CHEN}]] back`, day: 0, at: [{ uuid: 'j', words: 'Nov 27th, 2026', day: 20261127 }, { uuid: 'v', words: `Visit with [[${CHEN}]] about the scan` }] };
  const mail = { uuid: 'b', words: 'Sort the **mail**', day: 0, at: [{ uuid: 'p', words: 'Clinic', day: 0 }] };
  const found = typed => todo.holding([call, mail], typed, names).map(task => task.uuid);
  assert.deepEqual(found('chen'), ['a']);
  assert.deepEqual(found('MEI back'), ['a'], 'every word typed, in any case and any order');
  assert.deepEqual(found('mail'), ['b']);
  assert.deepEqual(found('chen mail'), []);
  assert.deepEqual(found('6502f1c3'), [], 'an id is no word of the task');
  assert.deepEqual(found('  '), ['a', 'b'], 'nothing typed narrows nothing');
  assert.equal(todo.under('parent', call, names), 'Visit with Dr. Mei Chen about the scan');
  assert.equal(todo.under('parent', mail, names), 'Clinic');
  assert.equal(todo.under('page', call, names, 20261127), 'Nov 27');
  assert.equal(todo.under('page', mail, names), 'Clinic');
  assert.equal(todo.under('parent', { uuid: 'c', words: 'x', at: [{ uuid: 'p', words: `About [[${CHEN.replace('65', '66')}]]`, day: 0 }] }, names), 'About …', 'a node no name is known for reads as …');
  assert.equal(todo.under('page', { uuid: 'd', words: 'x' }, names), '');
});
// F95 of the round rundown-070: Todo's menu worked out next week's Monday by itself, beside the reader of "next week".
test('next week is its Monday, one answer for the words typed and for the menu', () => {
  assert.deepEqual([20261125, 20261129, 20261130, 20261231].map(day => todo.nextWeek(day)), [20261130, 20261130, 20261207, 20270104]);   // a Wednesday, a Sunday, a Monday, the year's last Thursday
  assert.equal(todo.dayIn('Book the dentist next week', 20261231).day, todo.nextWeek(20261231));
});

// ---- a tag every row of a list holds is said once, on the list's head (F124, 27 November 2026)
test('a list answers the tags all its rows hold, beside the kinds its head counts, and never Task for a row with a status', () => {
  const row = (uuid, tag, tags, more = {}) => ({ uuid, words: uuid, tag, tags: tags.map((title, id) => ({ id, title })), day: 0, ...more });
  const shared = rows => view.shape({ rows }, {}, {}, 20261127).shared;
  // Three Bill payments, all Urgent: Urgent once; Bill payment is the kind the head counts already.
  assert.deepEqual(shared([row('a', 'Bill payment', ['Bill payment', 'Urgent']), row('b', 'Bill payment', ['Urgent', 'Bill payment']), row('c', 'Bill payment', ['Bill payment', 'Urgent', 'Shared account'])]), ['Urgent']);
  // One of the three is not Urgent: it stays on the rows that hold it.
  assert.deepEqual(shared([row('a', 'Bill payment', ['Bill payment', 'Urgent']), row('b', 'Bill payment', ['Bill payment']), row('c', 'Bill payment', ['Bill payment', 'Urgent'])]), []);
  // Two kinds, both Urgent: neither kind is said again, Urgent is.
  assert.deepEqual(shared([row('a', 'Bill payment', ['Bill payment', 'Urgent']), row('b', 'Income', ['Income', 'Urgent'])]), ['Urgent']);
  // A tag that is some row's own kind is one the head counts: not said a second time, though every row holds it.
  assert.deepEqual(shared([row('a', 'Urgent', ['Urgent']), row('b', 'Bill payment', ['Bill payment', 'Urgent'])]), []);
  // Tasks with their status circle: Task is not said; a task without a status does not make it shared either.
  assert.deepEqual(shared([row('a', 'Project', ['Task', 'Project', 'Home'], { status: 'Todo' }), row('b', 'Project', ['Project', 'Task', 'Home'], { status: 'Doing' })]), ['Home']);
  assert.deepEqual(shared([row('a', 'Project', ['Task', 'Project'], { status: 'Todo' }), row('b', 'Project', ['Project', 'Task'])]), []);
  assert.deepEqual(shared([row('a', 'Project', ['Project', 'Task']), row('b', 'Project', ['Project', 'Task'])]), ['Task']);
  // A list of one node says its tags on the row; rows with no tags read, or none at all, share nothing.
  assert.deepEqual(shared([row('a', 'Bill payment', ['Bill payment', 'Urgent'])]), []);
  assert.deepEqual([shared([{ uuid: 'a', words: 'a', tag: 'Visit' }, { uuid: 'b', words: 'b', tag: 'Visit' }]), shared([])], [[], []]);
  // Narrowing the list to a kind or to words does not change what all its rows hold.
  assert.deepEqual(view.shape({ rows: [row('a', 'Bill payment', ['Bill payment', 'Urgent']), row('b', 'Income', ['Income', 'Urgent'])] }, { kind: 'Income' }, { words: 'b' }, 20261127).shared, ['Urgent']);
});
