/* Run with: node test/run.js
   The core on pretend graphs. No Logseq needed. Each check says what it proves; the last section scores the proposals on
   graphs that share nothing with each other, which is the point: the plugin must work on any graph. */
const assert = require('node:assert/strict');
const engine = require('../core/engine.js');
const dates = require('../core/dates.js');
const link = require('../core/link.js');
const { propose } = require('../core/propose.js');
const { score } = require('./score.js');
const { learnEntry, profileOf } = require('../core/context.js');
const { profileScores } = require('../core/profile.js');
const synthetic = require('./synthetic.js');

let passed = 0, failed = 0;
// Tests are queued and run in order, so a test may be async.
const queue = [];
const test = (name, fn) => queue.push(async () => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (error) { failed++; console.log('FAIL  ' + name + '\n      ' + String(error.message).split('\n').join('\n      ')); } });
const section = name => queue.push(() => console.log('\n' + name));
const say = text => queue.push(() => console.log(text));

const bullet = (over = {}) => ({ id: -1, uuid: '', text: '', tags: [], values: new Map(), page: null, parent: null, ...over });
const journal = (g, day) => { const id = 9000 + day % 100; g.ctx.days.set(id, day); g.ctx.dayIds = null; return { id, uuid: synthetic.uuid(id), title: 'Oct', day, tags: [] }; };
const piece = (result, ident) => result.pieces.find(p => p.ident === ident);
// A tag for a line that has none is offered only where it is asked for (the Alfred workflow's Add panel): the tests of that guess ask so.
const proposeTag = (ctx, b) => propose(ctx, b, null, { offerTag: true });

section('the engine');
test('a near line votes its value; a far one stays silent', () => {
  const entries = [
    { id: 1, tokens: engine.tokensOf('pricing invoice billing review'), values: new Map([['p', [10]]]) },
    { id: 2, tokens: engine.tokensOf('pricing tariff billing summary'), values: new Map([['p', [10]]]) },
    { id: 3, tokens: engine.tokensOf('database schema migration plan'), values: new Map([['p', [20]]]) },
  ];
  const index = engine.buildIndex(entries);
  const near = engine.neighbours(index, engine.tokensOf('pricing and billing'));
  assert.deepEqual(engine.vote(near, 'p').ids, [10]);
  assert.equal(engine.vote(engine.neighbours(index, engine.tokensOf('walk the dog quietly')), 'p'), null);
});
test('updateEntry learns a changed line at once', () => {
  const index = engine.buildIndex([{ id: 1, tokens: engine.tokensOf('alpha beta gamma'), values: new Map([['p', [1]]]) }]);
  engine.updateEntry(index, { id: 2, tokens: engine.tokensOf('zeta omega sigma'), values: new Map([['p', [2]]]) });
  assert.deepEqual(engine.vote(engine.neighbours(index, engine.tokensOf('zeta omega')), 'p').ids, [2]);
});

section('dates and numbers in words');
const r = dates.reader, base = 20261028;   // a Wednesday
test('a weekday, a relative span, a day and month', () => {
  assert.deepEqual(r.daysInWords('Appointment on Friday', base), [20261030]);
  assert.deepEqual(r.daysInWords('Scan in two weeks', base), [20261111]);
  assert.deepEqual(r.daysInWords('Flight 4 Aug', base), [20270804]);
  assert.deepEqual(r.daysInWords('Flight $400, 4 Aug$', base), [20270804]);   // Logseq's paired $ at the end
});
test('a day that just went stays past, today\'s weekday stays silent, and a word that points ahead wins', () => {
  const written = 20261023;   // a Friday
  assert.deepEqual(r.daysInWords('Scan on Oct 3 showed a shadow', written), [20261003]);
  assert.deepEqual(r.daysInWords('Saw her on 3 Oct about the rash', written), [20261003]);
  assert.deepEqual(r.daysInWords('Bloods on Friday were normal', written), []);
  assert.deepEqual(r.daysInWords('Bloods next Friday', written), [20261106]);
  assert.deepEqual(r.daysInWords('Bloods on Friday were normal', 20261031), [], 'a weekday told in the past, written on any day, is none');
  assert.deepEqual(r.daysInWords('Scan was moved to Friday', 20261031), [], 'it may be the Friday coming, so the words cannot say');
  assert.deepEqual(r.daysInWords('Scan was moved to next Friday', 20261031), [20261113], 'next still says');
  assert.deepEqual(r.daysInWords('Bloods on Friday next week', written), [20261030]);
  assert.deepEqual(r.daysInWords('Next scan on Oct 3', written), [20271003]);
  assert.deepEqual(r.daysInWords('Scan on Dec 28 showed a shadow', 20270103), [20261228], 'across the new year');
  assert.deepEqual(r.daysInWords('Bloods on Oct 23', written), [20261023], 'today is today');
});
test('dates told in phrases (8 November 2026)', () => {
  const sunday = 20261108, day = (t, b = sunday) => r.daysInWords(t, b);
  assert.deepEqual(day('Bloods the day after tomorrow'), [20261110], 'not also tomorrow');
  assert.deepEqual(day('Scan a week from Monday'), [20261116]);
  assert.deepEqual(day('Follow-up next week'), [20261115]);
  assert.deepEqual(day('Appointment next month'), [20261208]);
  assert.deepEqual(day('Results end of the month'), [20261130]);
  assert.deepEqual(day('Chemo restarts early December'), [20261201]);
  assert.deepEqual(day('Review mid-January'), [20270115]);
  assert.deepEqual(day('Follow-up in six months'), [20270508]);
  assert.deepEqual(day('Was there three weeks ago'), [20261018]);
  assert.deepEqual(day('Tonight the pain was worse'), [20261108]);
  assert.deepEqual(day('Recheck on Christmas Eve'), [20261224]);
  assert.deepEqual(day('Scan the first Monday of December'), [20261207]);
  assert.deepEqual(day('Bloods the last Friday of the month'), [20261127]);
  assert.deepEqual(day('MRI on 20/11'), [20261120], 'a number over 12 is the day');
  assert.deepEqual(day('MRI on 11/20/2026'), [20261120]);
  assert.deepEqual(day('MRI on 5/6'), [], 'two ways to read it: nothing');
  assert.deepEqual(day('Took 2/3 of the dose'), []);
  assert.deepEqual(day('Monday next week'), [20261109], 'the weekday says the day, next week does not add another');
  assert.deepEqual(day('Jan 31 then a month on', 20270131), [20270131]);
});
test('words that only look like dates are left alone', () => {
  assert.deepEqual(r.daysInWords('Ran 5 marathons', base), []);
  assert.deepEqual(r.daysInWords('Dose 4 may need lowering', base), []);
  assert.deepEqual(r.daysInWords('Lunch on the 2nd floor', base), []);
});
test('a number beside a property name, and never two', () => {
  assert.equal(r.numberInWords('Chemo cycle 5 done', 'Cycle'), 5);
  assert.equal(r.numberInWords('Did 3 rounds today', 'Round'), 3);
  assert.equal(r.numberInWords('cycles 3 and 4 done', 'Cycle'), null);
});
test('a sum beside a property name is read whole, and is never the next name\'s', () => {
  const names = ['Premium', 'Coverage', 'Deductible'], line = 'Home policy premium $1,240 coverage $350,000 deductible $1,000 renews Mar 3';
  assert.equal(r.numberInWords(line, 'Premium', names), 1240);
  assert.equal(r.numberInWords(line, 'Coverage', names), 350000);
  assert.equal(r.numberInWords(line, 'Deductible', names), 1000);
  assert.equal(r.numberInWords('Kitchen remodel target $25,000 saved $4,000.98', 'Saved', ['Target', 'Saved']), 4000.98);
  assert.equal(r.numberInWords('Switched to a $1,000 deductible', 'Deductible', names), 1000);
  assert.equal(r.numberInWords('2026 tax return refund €1.240,50', 'Refund'), 1240.5);
  assert.equal(r.moneyInWords('Paid €1.240,50 for the boiler'), 1240.5);
  assert.equal(r.moneyInWords('Desk chair $4,000.98'), 4000.98);
  assert.equal(r.moneyInWords('Desk chair $4,000.98$'), 4000.98);   // Logseq's paired $ at the end
  assert.equal(r.numberInWords('premium $1,240 renews Mar 3$', 'Premium'), 1240);
  assert.equal(r.moneyInWords('costs 5$'), 5);
  assert.equal(r.moneyInWords('Paycheck $3.9k'), 3900);
  assert.equal(r.moneyInWords('Groceries $84 and wine $22, $106 total'), 106);
  assert.equal(r.moneyInWords('Groceries $84 and wine $22 came to $106'), 106);
  assert.equal(r.moneyInWords('Groceries $84 and wine $22'), null);
});
test('a plain number is the sum only where it can be nothing else', () => {
  for (const [t, n] of [['Gas 64.28', 64.28], ['Paycheck 3850', 3850], ['Coffee at 8am 5.10', 5.1], ['Dinner for 2, 84.50', 84.5], ['Ride home 23.92 with 2 people', 23.92]]) assert.equal(r.plainSum(t), n, t);
  for (const t of ['2 lattes', 'Coffee Nov 20', 'Coffee on the 20th', 'Dinner for 2', 'Paycheck 2026', 'Cycle 5', 'Gym 3 times this week', 'Coffee 5.10 and 6.20', 'Flight 412.80 on 11/20']) assert.equal(r.plainSum(t), null, t);
});
test('a locale can replace the words (Spanish weekdays)', () => {
  const es = dates.makeReader({ ...dates.en, name: 'es', weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], weekdayPattern: '(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)', wholeWeekdaySuffix: '', before: ['el'], relative: { hoy: 0, 'mañana': 1, ayer: -1 } });
  assert.deepEqual(es.daysInWords('Cita el viernes', base), [20261030]);
});

test('the pencil writes a day as Logseq will: the journal page\'s title, else the graph\'s date format', () => {
  const g = synthetic.work(), Meeting = g.tagPage.Meeting, day = 20261028;
  const res = () => propose(g.ctx, bullet({ text: 'Sync about roadmap', tags: [Meeting.id], page: journal(g, day) })).pieces.find(p => p.kind === 'day').shown;
  assert.equal(res(), 'Oct 28th, 2026');
  g.ctx.dateFormat = 'yyyy-MM-dd';
  assert.equal(res(), '2026-10-28', 'a day with no title of its own is in the date format');
  g.ctx.dayTitles = new Map([[day, 'Oct 28th, 2026']]);
  assert.equal(res(), 'Oct 28th, 2026', 'a journal day keeps its own title when the format changes');
  const { formatDay } = require('../core/dates.js');
  assert.equal(formatDay(day), 'Oct 28th, 2026');
  assert.equal(formatDay(day, 'yyyy-MM-dd'), '2026-10-28');
  assert.equal(formatDay(day, 'EEEE, MMMM do yyyy'), 'Wednesday, October 28th 2026');
  assert.equal(formatDay(20261101, 'MMM do'), 'Nov 1st');
  assert.equal(formatDay(20261111, 'MMM do'), 'Nov 11th');
});

section('suggested links');
const pages = [
  { id: 1, title: 'Dr. Mei Chen', lower: 'dr. mei chen', tags: [], isTag: false },
  { id: 2, title: 'Meeting notes', lower: 'meeting notes', tags: [], isTag: false },
  { id: 3, title: 'Riverside General Hospital', lower: 'riverside general hospital', tags: [], isTag: false },
];
test('the rest of a name follows the words', () => {
  assert.equal(link.suggestFor('Spoke with Dr. Mei', 18, pages).ghost, ' Chen');
  assert.equal(link.suggestFor('Spoke with Mei', 14, pages).title, 'Dr. Mei Chen');
});
test('a word inside a name shows the whole name', () => {
  const hit = link.suggestFor('went to general hospital', 24, pages, { min: 5 });
  assert.equal(hit.title, 'Riverside General Hospital');
  assert.match(hit.name, /Riverside General Hospital/);
});
test('quiet inside [[ ]] for a name from its start (Logseq\'s own list has it), after #, and for short lower-case words', () => {
  assert.equal(link.suggestFor('see [[Dr. Me', 12, pages), null);
  assert.equal(link.suggestFor('tagged #Dr', 10, pages), null);
  assert.equal(link.suggestFor('the', 3, pages), null);
});
test('inside [[ ]] a near name offers the page you have: words of the name out of order or with gaps, a word one letter off', () => {
  const near = [...pages, { id: 4, title: 'Cisplatin', lower: 'cisplatin', tags: [], isTag: false }];
  const at = (t, c = t.indexOf(']]') > 0 ? t.indexOf(']]') : t.length) => link.suggestFor(t, c, near);
  assert.equal(at('see [[Dr Chen').title, 'Dr. Mei Chen');
  assert.equal(at('see [[Dr Chen').name, '→ Dr. Mei Chen');
  assert.equal(at('see [[Mei Chen]]').title, 'Dr. Mei Chen', 'with the ]] Logseq pairs after the cursor');
  assert.equal(at('see [[Cisplatine]]').title, 'Cisplatin');
  assert.equal(at('see [[Cisplatin]]'), null, 'typed whole: Logseq links it');
  assert.equal(at('see [[Mei Chen]] and', 'see [[Mei Chen]] and'.length), null, 'a closed link is left alone');
  assert.equal(at('see [[Dr. Mei Chen]] then [[Cisp'), null, 'from the start: Logseq\'s list');
  assert.equal(link.suggestFor('see [[Dr Chen]] again', 9, near), null, 'editing inside a name, not writing it');
});
test('a name the graph writes plain is not offered unless it is typed whole', () => {
  const rates = new Map([['meeting notes', { linked: 0, plain: 9 }]]);
  assert.equal(link.suggestFor('Read the meeting no', 19, pages, { rates }), null);
});

test('link rates count whole names outside links, the longest name, and a line taken back leaves nothing', () => {
  const named = [['Mei'], ['Dr. Mei Chen'], ['Mei Chen Clinic'], ['C++'], ['(Long) Covid'], ['??']].map(([title], i) => ({ id: i, uuid: `00000000-0000-4000-8000-00000000000${i}`, title, lower: title.toLowerCase() }));
  const lines = ['saw dr. mei chen about mei', 'Mei Chen Clinic, then meiji and Dr Mei Chen', 'C++ and c+ and (long) covid ??', '[[00000000-0000-4000-8000-000000000001]] with [[Mei]] and mei'];
  const counter = link.rateCounter(named);
  for (const line of lines) counter.add(line);
  const rates = name => { const r = counter.rates.get(name); return [r.linked, r.plain]; };
  assert.deepEqual(rates('mei'), [1, 3], 'Mei alone, not inside Meiji, not inside the longer names (the second Dr Mei Chen has no point, so it is Mei)');
  assert.deepEqual(rates('dr. mei chen'), [1, 1]);
  assert.deepEqual(rates('mei chen clinic'), [0, 1]);
  assert.deepEqual(rates('c++'), [0, 1]);
  assert.deepEqual(rates('(long) covid'), [0, 1]);
  assert.deepEqual(rates('??'), [0, 1]);
  for (const line of lines) counter.add(line, -1);
  for (const r of counter.rates.values()) assert.deepEqual([r.linked, r.plain], [0, 0]);
});

section('proposals on the "work" graph');
const work = synthetic.work();
const person = work.peoplePages.Person[0], proj = work.peoplePages.Project.find(p => p.title === 'Cobalt');
const { Meeting, Action } = work.tagPage;
test('a linked person fills the property that takes Person (sure)', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] on staffing`, tags: [Meeting.id], page: journal(work, 20261028) }));
  const p = piece(res, work.prop('Owner').ident);
  assert.deepEqual(p.ids, [person.id]); assert.ok(!p.guess);
});
test('the project is guessed from what the line is about', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] about the schema migration and index`, tags: [Meeting.id], page: journal(work, 20261028) }));
  const p = piece(res, work.prop('Project').ident);
  assert.deepEqual(p.ids, [proj.id]); assert.ok(p.guess);
});
test('a line about nothing the graph has seen proposes no project', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] about parking and kettles`, tags: [Meeting.id], page: journal(work, 20261028) }));
  assert.equal(piece(res, work.prop('Project').ident), undefined);
});
test('the journal day is sure for a date this graph always writes the same day (and the property is called "When")', () => {
  const res = propose(work.ctx, bullet({ text: 'Sync about roadmap', tags: [Meeting.id], page: journal(work, 20261028) }));
  const p = piece(res, work.prop('When').ident);
  assert.equal(p.kind, 'day'); assert.equal(p.day, 20261028); assert.ok(!p.guess);
});
test('a date in the words is proposed for a date the graph writes ahead (and the property is called "Due")', () => {
  const res = propose(work.ctx, bullet({ text: 'Send the pricing summary on Friday', tags: [Action.id], page: journal(work, 20261028) }));
  const p = piece(res, work.prop('Due').ident);
  assert.equal(p.day, 20261030); assert.equal(p.how, 'words-day'); assert.ok(p.guess);
});
test('without a date in the words, an ahead-dated property gets nothing', () => {
  const res = propose(work.ctx, bullet({ text: 'Send the pricing summary', tags: [Action.id], page: journal(work, 20261028) }));
  assert.equal(piece(res, work.prop('Due').ident), undefined);
});
test('a bullet with no tag is offered none by itself, however much it reads like the meetings (24 November 2026)', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] about database schema for the roadmap`, page: journal(work, 20261028) }));
  assert.deepEqual(res.pieces, []);
});
test('asked for a tag, an untagged line that reads like the meetings is offered the Meeting tag, with its properties as guesses', () => {
  const res = proposeTag(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] about database schema for the roadmap`, page: journal(work, 20261028) }));
  const tag = res.pieces.find(p => p.kind === 'tag');
  assert.equal(tag.tag.id, Meeting.id);
  assert.ok(res.pieces.filter(p => p.kind !== 'tag').every(p => p.guess && p.needsTag));
});
test('a lower tag threshold offers a tag that the strict one holds back, and a plain note still gets none', () => {
  const g = synthetic.work(), line = bullet({ text: 'Sync about the database', page: journal(g, 20261028) });
  const tagOf = () => proposeTag(g.ctx, line).pieces.find(p => p.kind === 'tag');
  assert.equal(g.ctx.limits.tagNearLeast, .6);
  Object.assign(g.ctx.limits, { tagGap: 0, twinLeast: 0 });   // the vote alone (the profile and the twins are tried below)
  const strict = tagOf();
  Object.assign(g.ctx.limits, { tagNearLeast: .25, tagLead: .6 });
  const loose = tagOf();
  assert.ok(!strict, 'the strict setting offered a tag');
  assert.ok(loose && loose.tag.id === g.tagPage.Meeting.id, 'the loose setting offered ' + (loose && loose.tag.title));
  assert.equal(proposeTag(g.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(g, 20261028) })).pieces.length, 0);
});
test('the tags\' word profiles offer a tag the vote holds back, when the words lead clearly', () => {
  const g = synthetic.work();
  Object.assign(g.ctx.limits, { tagNearLeast: .99, tagGap: 3, twinLeast: 0 });   // the vote and the twins cannot speak; only the profile can
  const p = profileOf(g.ctx);
  assert.deepEqual(p.classes.map(c => c === 0 ? 'plain' : g.ctx.byId.get(c).title).sort(), ['Action', 'Meeting', 'plain'], 'the tags bullets carry, and plain; not Person or Project (pages only)');
  const got = proposeTag(g.ctx, bullet({ text: 'Sync about the roadmap and database', page: journal(g, 20261028) })).pieces.find(p => p.kind === 'tag');
  assert.ok(got && got.tag.id === g.tagPage.Meeting.id && got.tag.by === 'profile', 'offered ' + (got && got.tag.title));
  assert.equal(proposeTag(g.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(g, 20261028) })).pieces.length, 0, 'a plain note');
  assert.equal(proposeTag(g.ctx, bullet({ text: 'Zxqv flurm wibble', page: journal(g, 20261028) })).pieces.length, 0, 'words never seen');
  g.ctx.limits.tagGap = 0;
  assert.equal(proposeTag(g.ctx, bullet({ text: 'Sync about the roadmap and database', page: journal(g, 20261028) })).pieces.length, 0, 'gap 0 turns the profile off');
});
test('a line asked about is left out of its own profile, so its own words are no proof', () => {
  const g = synthetic.work(), p = profileOf(g.ctx);
  const own = g.ctx.index.entries.find(e => (e.values.get('block/tags') || [])[0] === g.tagPage.Meeting.id);
  const withSelf = profileScores(p, own.tokens)[0], without = profileScores(p, own.tokens, { skip: own.id })[0];
  assert.equal(withSelf[0], g.tagPage.Meeting.id);
  assert.ok(without[1] < withSelf[1] || without[0] !== withSelf[0], 'leaving the line out lowered its own tag');
});
test('a line learned counts in the profile at once', () => {
  const g = synthetic.work();
  Object.assign(g.ctx.limits, { tagNearLeast: .99, tagGap: 2, profileLeast: 1 });
  const before = profileOf(g.ctx).lines.get(g.tagPage.Meeting.id);
  learnEntry(g.ctx, 777, { title: 'Sync about quarterly planning with the whole team', tags: [g.tagPage.Meeting.id], values: new Map() });
  assert.equal(profileOf(g.ctx).lines.get(g.tagPage.Meeting.id), before + 1);
});
test('a plain note gets no tag', () => {
  assert.equal(proposeTag(work.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(work, 20261028) })).pieces.length, 0);
});
test('a note under a tagged bullet proposes for the parent', () => {
  const res = propose(work.ctx, bullet({ text: `Agreed to meet [[${person.uuid}]] again`, parent: { id: 77, uuid: synthetic.uuid(77), tags: [Meeting.id], values: new Map() }, page: journal(work, 20261028) }));
  assert.equal(res.record.id, 77);
  assert.deepEqual(piece(res, work.prop('Owner').ident).ids, [person.id]);
});
test('two people named leave a one-value property quiet', () => {
  const other = work.peoplePages.Person[1];
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] and [[${other.uuid}]]`, tags: [Meeting.id] }));
  assert.equal(piece(res, work.prop('Owner').ident), undefined);
});
test('a value already there is never overwritten', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${work.peoplePages.Person[2].uuid}]]`, tags: [Meeting.id], values: new Map([[work.prop('Owner').ident, [person.id]]]) }));
  assert.equal(piece(res, work.prop('Owner').ident), undefined);
});
test('learning a new line changes the next answer at once', () => {
  const g = synthetic.work();
  const text = 'Rehearse the quarterly zeppelin demo';
  const ask = () => piece(propose(g.ctx, bullet({ text, tags: [g.tagPage.Meeting.id] })), g.prop('Project').ident);
  assert.equal(ask(), undefined);
  const delta = g.peoplePages.Project.find(p => p.title === 'Delta');
  learnEntry(g.ctx, 999001, { title: 'Rehearse the quarterly zeppelin demo run', tags: [g.tagPage.Meeting.id], values: new Map([[g.prop('Project').ident, [delta.id]]]) });
  assert.deepEqual(ask().ids, [delta.id]);
});

section('basic meanings: money is an amount, "due" is a deadline');
test('the reader finds a sum of money, and never a dose or two sums', () => {
  assert.equal(r.moneyInWords('Paid $84 for the scan'), 84);
  assert.equal(r.moneyInWords('Copay €12.50'), 12.5);
  assert.equal(r.moneyInWords('Taxi home, 40 dollars'), 40);
  assert.equal(r.moneyInWords('1,200 EUR deposit'), 1200);
  assert.equal(r.moneyInWords('Dose 5 mg'), null);
  assert.equal(r.moneyInWords('$5 and $6'), null);
});
test('the reader finds the day right after "due", "by" or "scheduled for", and not a cause or a person', () => {
  assert.equal(r.dayMeant('deadline', 'Electricity bill, due Friday', base), 20261030);
  assert.equal(r.dayMeant('deadline', 'Report due by the 4th', base), 20261104);
  assert.equal(r.dayMeant('deadline', 'Renew the passport by Nov 20', base), 20261120);
  assert.equal(r.dayMeant('deadline', 'Nausea due to the cisplatin on Friday', base), null);
  assert.equal(r.dayMeant('deadline', 'Diagnosed by Dr Chen on Friday', base), null);
  assert.equal(r.dayMeant('scheduled', 'Scan scheduled for Friday', base), 20261030);
  assert.ok(r.nameMeans('money', 'Total paid') && r.nameMeans('money', 'Cost') && !r.nameMeans('money', 'Severity'));
  assert.ok(r.nameMeans('deadline', 'Due date') && !r.nameMeans('deadline', 'Date'));
});
const bills = synthetic.build({
  tags: ['Bill', 'Task'],
  props: [
    { title: 'Amount', type: 'number', on: ['Bill'] }, { title: 'Severity', type: 'number', on: ['Bill'] },
    { title: 'Date', type: 'date', on: ['Bill'] }, { title: 'Due date', type: 'date', on: ['Bill'] },
    { title: 'Deadline', type: 'datetime', on: ['Task'] }, { title: 'Scheduled', type: 'datetime', on: ['Task'] },
  ],
  people: {}, lines() {}, plain() {},
});
for (const p of bills.schema.props) if (p.title === 'Deadline' || p.title === 'Scheduled') p.ident = 'logseq.property/' + p.title.toLowerCase();
test('a sum goes to the number named for money, a due day to the date named for it, and the other date stays out of it', () => {
  const res = propose(bills.ctx, bullet({ text: 'Electricity, $84.20 due Friday', tags: [bills.tagPage.Bill.id], page: journal(bills, base) }));
  assert.equal(piece(res, bills.prop('Amount').ident)?.ids[0], 84.2);
  assert.equal(piece(res, bills.prop('Severity').ident), undefined, 'a number not named for money is left alone');
  assert.equal(piece(res, bills.prop('Due date').ident)?.day, 20261030);
  assert.notEqual(piece(res, bills.prop('Date').ident)?.day, 20261030, 'the due day is not also the Date');
});
test('Logseq\'s own Deadline and Scheduled are filled from "due" and "scheduled for", and a plain day fills neither', () => {
  const task = t => propose(bills.ctx, bullet({ text: t, tags: [bills.tagPage.Task.id], page: journal(bills, base) }));
  assert.equal(piece(task('Send the tax form, due next Friday'), 'logseq.property/deadline')?.day, 20261106);
  assert.equal(piece(task('Bloods scheduled for the 4th'), 'logseq.property/scheduled')?.day, 20261104);
  const plain = task('Call the pharmacy on Friday');
  assert.equal(piece(plain, 'logseq.property/deadline'), undefined);
  assert.equal(piece(plain, 'logseq.property/scheduled'), undefined);
});

test('with two money properties, earlier bullets like this one say which takes the sum; with none like it, nothing is guessed', () => {
  const g = synthetic.build({
    tags: ['Expense'],
    props: [{ title: 'Amount', type: 'number', on: ['Expense'] }, { title: 'Payment', type: 'number', on: ['Expense'] }],
    people: {},
    lines({ tagPage, add, pick }) {
      for (let i = 0; i < 30; i++) add({ title: `${pick(['Electricity', 'Water', 'Gas', 'Phone'])} bill came in at $${40 + i}`, tags: [tagPage.Expense.id], values: new Map(), numbers: ['user.property/amount'] });
      for (let i = 0; i < 30; i++) add({ title: `Paid the ${pick(['plumber', 'cleaner', 'gardener', 'painter'])} $${20 + i} cash`, tags: [tagPage.Expense.id], values: new Map(), numbers: ['user.property/payment'] });
    },
    plain() {},
  });
  const ask = t => propose(g.ctx, bullet({ text: t, tags: [g.tagPage.Expense.id] }));
  const bill = ask('Gas bill came in at $61'), paid = ask('Paid the gardener $35 cash');
  assert.equal(piece(bill, 'user.property/amount')?.ids[0], 61); assert.equal(piece(bill, 'user.property/payment'), undefined);
  assert.equal(piece(paid, 'user.property/payment')?.ids[0], 35); assert.equal(piece(paid, 'user.property/amount'), undefined);
  assert.equal(piece(paid, 'user.property/payment').how, 'alike-money');
  const odd = ask('Zebra quilt $12');
  assert.equal(odd.pieces.filter(p => p.kind === 'number').length, 0, 'two money names and no bullet like it: nothing');
});

test('each day in the words goes to the date its words say: due, scheduled, start, end, completed', () => {
  const g = synthetic.build({
    tags: ['Job'],
    props: ['Due date', 'Scheduled for', 'Start date', 'End date', 'Completed on'].map(title => ({ title, type: 'date', on: ['Job'] })),
    people: {},
    lines() {},
    plain() {},
  });
  const days = t => Object.fromEntries(propose(g.ctx, bullet({ text: t, tags: [g.tagPage.Job.id], page: journal(g, 20261117) })).pieces.filter(p => p.kind === 'day').map(p => [p.prop.title, p.day]));
  assert.deepEqual(days('Fix the gutter, due Dec 5'), { 'Due date': 20261205 });
  assert.deepEqual(days('Plumber coming Friday'), { 'Scheduled for': 20261120 });
  assert.deepEqual(days('Kitchen remodel Jan 5–Jun 30'), { 'Start date': 20270105, 'End date': 20270630 });
  assert.deepEqual(days('Painting between Dec 1 and Dec 12'), { 'Start date': 20261201, 'End date': 20261212 });
  assert.deepEqual(days('Painting starting Dec 1, ends Dec 12'), { 'Start date': 20261201, 'End date': 20261212 });
  assert.deepEqual(days('Permit expires Mar 1'), { 'End date': 20270301 });
  assert.deepEqual(days('Paid the roofer Nov 14'), { 'Completed on': 20261114 });
  assert.deepEqual(days('Water heater swapped last Thursday'), { 'Completed on': 20261112 });
  assert.deepEqual(days('Window replaced Nov 9, invoice due Dec 9'), { 'Completed on': 20261109, 'Due date': 20261209 });
  assert.deepEqual(days('Deck stain from Nov 2 to Nov 6, paid Nov 7'), { 'Start date': 20261102, 'End date': 20261106, 'Completed on': 20261107 });
  assert.deepEqual(days('Due date Dec 5 for the quote'), { 'Due date': 20261205 }, "the property's own name is a cue");
  assert.deepEqual(days('Went to the dentist, then the bank'), {}, 'no day, nothing');
  assert.deepEqual(days('Call about Nov 20 or Nov 24'), {}, 'two days with nothing to tell them apart: nothing');
});

test('a wording you filled by hand teaches its date: "cutoff", "last day"; a day you put in no date teaches nothing (core/date-words.js)', () => {
  const g = synthetic.build({
    tags: ['Job'],
    props: ['Due date', 'Scheduled for', 'Start date', 'End date', 'Completed on'].map(title => ({ title, type: 'date', on: ['Job'] })),
    people: {}, lines() {}, plain() {},
  });
  const { learnEntry } = require('../core/context.js');
  const ident = t => g.ctx.schema.props.find(p => p.title === t).ident;
  const job = [g.tagPage.Job.id];
  const days = t => Object.fromEntries(propose(g.ctx, bullet({ text: t, tags: job, page: journal(g, 20261117) })).pieces.filter(p => p.kind === 'day').map(p => [p.prop.title, p.day]));
  assert.deepEqual(days('Fence cutoff Dec 10'), {}, 'not taught: nothing');
  // Days as journal pages, and nodes where those days were filled by hand.
  let id = 90000; const dayPage = d => { const pid = ++id; g.ctx.days.set(pid, d); return pid; };
  const page = dayPage(20261101);
  const teach = (title, filled) => learnEntry(g.ctx, ++id, { title, tags: job, page, values: new Map(), dates: new Map(Object.entries(filled).map(([t, d]) => [ident(t), [dayPage(d)]])) });
  teach('Roof repair cutoff Dec 4', { 'Due date': 20261204 });
  teach('Painting last day is Dec 12', { 'End date': 20261212 });
  teach('Plumber visit Nov 20', { 'Scheduled for': 20261120 });
  teach('Gutter cleaning Nov 24, invoice due Nov 30', { 'Due date': 20261130 });   // the cleaning day put in no date
  assert.deepEqual(days('Fence cutoff Dec 10'), { 'Due date': 20261210 });
  assert.deepEqual(days('Deck stain last day Dec 18'), { 'End date': 20261218 });
  assert.deepEqual(days('Electrician visit Dec 3'), { 'Scheduled for': 20261203 });
  assert.deepEqual(days('Electrician visit Nov 9'), {}, 'taught for a day ahead: a day gone by is not scheduled by it');
  assert.deepEqual(days('Gutter cleaning Dec 2'), {}, 'words before a day you left out name no date');
  assert.deepEqual(days('Fence due Dec 10'), { 'Due date': 20261210 }, 'the word lists still read');
  teach('Electrician visited Oct 28', { 'Completed on': 20261028 });
  assert.deepEqual(days('Painter visited Nov 12'), { 'Completed on': 20261112 }, 'one base form, taught both ways, read by the way of the day');
  assert.deepEqual(days('Painter visit Dec 8'), { 'Scheduled for': 20261208 });
  teach('Siding commenced Nov 2', { 'Start date': 20261102 });
  assert.deepEqual(days('Siding commences Nov 25'), { 'Start date': 20261125 }, 'another form of a taught word');
});

section('lessons: what you do with a suggestion (core/lessons.js)');
test('a lesson is written as a plain line and read back the same', () => {
  const L = require('../core/lessons.js'), lessons = new Map();
  const tag = { kind: 'tag', tag: { title: 'Conversation' }, ids: [7], how: 'alike-tag', guess: true };
  for (let i = 0; i < 5; i++) L.note(lessons, tag, 'no');
  L.note(lessons, tag, 'taken');
  const line = L.lineOf(lessons.get(L.keyOf(tag)));
  assert.equal(line, 'earlier lines · tag Conversation: taken 1, said no 5');
  const back = L.parseLine(line);
  assert.equal(back.taken, 1); assert.equal(back.no, 5); assert.equal(L.parseLine('What Predictive has learned.'), null);
  assert.equal(L.note(lessons, { ...tag, guess: false }, 'no'), null, 'a sure value teaches nothing');
});
test('said no to often enough, a guess is held back, with the guesses that rested on its tag; a sure value never', () => {
  const L = require('../core/lessons.js'), lessons = new Map();
  const tag = { kind: 'tag', ident: 'block/tags', tag: { title: 'Conversation' }, ids: [7], how: 'alike-tag', guess: true };
  const under = { kind: 'node', ident: 'p', prop: { title: 'Spoke with', type: 'node' }, ids: [9], how: 'alike', guess: true, needsTag: true };
  const sure = { kind: 'node', ident: 'q', prop: { title: 'Topic', type: 'node' }, ids: [3], how: 'linked' };
  L.note(lessons, tag, 'no'); L.note(lessons, tag, 'no');
  assert.equal(L.apply([tag, under], lessons).length, 2, 'twice is not yet a lesson');
  L.note(lessons, tag, 'no');
  assert.deepEqual(L.apply([tag, under, sure], lessons), [sure]);
  for (let i = 0; i < 2; i++) L.note(lessons, tag, 'taken');
  assert.equal(L.apply([tag], lessons).length, 1, 'taken often enough, it comes back');
});
test('a sum moved by hand to another property twice is proposed there, if that property is open', () => {
  const L = require('../core/lessons.js'), lessons = new Map();
  const amount = { ident: 'a', title: 'Amount', type: 'number' }, payment = { ident: 'b', title: 'Payment', type: 'number' }, deadline = { ident: 'd', title: 'Deadline', type: 'datetime' }, due = { ident: 'e', title: 'Due date', type: 'date' };
  const sum = { kind: 'number', ident: 'a', prop: amount, ids: [35], how: 'words-money', guess: true };
  L.note(lessons, sum, 'moved', 'Payment');
  assert.equal(L.apply([sum], lessons, { fields: [amount, payment] })[0].ident, 'a', 'once is not yet a lesson');
  L.note(lessons, sum, 'moved', 'Payment');
  const moved = L.apply([sum], lessons, { fields: [amount, payment] })[0];
  assert.equal(moved.ident, 'b'); assert.equal(moved.ids[0], 35); assert.equal(moved.how, 'words-money+lesson');
  assert.equal(L.apply([sum], lessons, { fields: [amount, payment], open: f => f !== payment })[0].ident, 'a', 'not over a filled one');
  const day = { kind: 'day', ident: 'd', prop: deadline, ids: [-20261113], day: 20261113, how: 'words-deadline', guess: true };
  L.note(lessons, day, 'moved', 'Due date'); L.note(lessons, day, 'moved', 'Due date');
  assert.equal(L.apply([day], lessons, { fields: [deadline, due] })[0].ident, 'e', 'a day moves between a date and Logseq\'s Deadline too');
});

section('a tag asked for waits for enough words');
test('a line of three words gets no tag from the vote, the same line of four does', () => {
  const g = synthetic.work(), loose = { ...g.ctx, limits: { ...g.ctx.limits, tagNearLeast: .2, tagLead: .5, twinLeast: 0 } };
  const tagOf = t => proposeTag(loose, bullet({ text: t, page: journal(g, 20261028) })).pieces.find(p => p.kind === 'tag');
  assert.equal(tagOf('Sync about database'), undefined);
  assert.ok(tagOf('Sync about the database'));
});

section('the same words as before (core/tag-score.js twinOf)');
const { buildContext } = require('../core/context.js');
const tagScore = require('../core/tag-score.js');
// A small graph of short notes: Purchase and Bill payment, some written without a tag.
function shortNotes(lines) {
  const pages = [{ id: 1, uuid: synthetic.uuid(1), title: 'Purchase', lower: 'purchase', tags: [], isTag: true }, { id: 2, uuid: synthetic.uuid(2), title: 'Bill payment', lower: 'bill payment', tags: [], isTag: true }];
  const entries = lines.map(([title, tag], i) => ({ id: 100 + i, title, tags: tag ? [tag] : [], values: new Map() }));
  return buildContext({ schema: { props: [], byId: new Map(), classProps: new Map(), parentsOf: new Map() }, pages, userTagIds: [1, 2], entries });
}
test('one word written before with a tag gets that tag at once, in any case and form', () => {
  const ctx = shortNotes([['Coffee', 1], ['coffee', 1], ['Gas bill', 2], ['Paid the bills', 2], ['Walked to the park', null]]);
  const tagOf = t => proposeTag(ctx, bullet({ text: t })).pieces.find(p => p.kind === 'tag');
  assert.equal(tagOf('coffee')?.tag.title, 'Purchase');
  assert.equal(tagOf('paid the bill')?.tag.title, 'Bill payment', 'bills and bill, paid and paid: the base forms meet');
  assert.match(tagOf('Coffee').why, /written like this 2 times before/);
  assert.equal(tagOf('Walked to the park'), undefined, 'a plain twin gives no tag');
  assert.equal(tagOf('tea'), undefined, 'words never written');
});
test('a sum in the words does not make them different words', () => {
  const ctx = shortNotes([['Gas', 1], ['gas $58.30', 1], ['Electricity bill', 2]]);
  const tagOf = t => proposeTag(ctx, bullet({ text: t })).pieces.find(p => p.kind === 'tag');
  assert.equal(tagOf('Gas 64.28')?.tag.title, 'Purchase');
  assert.equal(tagOf('gas $61')?.tag.title, 'Purchase');
  assert.equal(tagOf('Electricity bill $3.1k')?.tag.title, 'Bill payment');
});
test('untagged twins count against a tag only when they outnumber the tagged ones', () => {
  const some = shortNotes([['Gas', 1], ['Gas', 1], ['Gas', null]]), most = shortNotes([['Gas', 1], ['Gas', null], ['Gas', null]]);
  assert.equal(tagScore.twinOf(some, { id: -1 }, 'gas')?.id, 1);
  assert.equal(tagScore.twinOf(most, { id: -1 }, 'gas'), null);
});
test('near twins must name the same thing: "Phone case" is not "Phone"', () => {
  const ctx = shortNotes([['Car insurance paid', 2], ['car insurance', 2], ['Phone', 2], ['Phone paid', 2], ['Phone bill', 2]]);
  assert.equal(tagScore.twinOf(ctx, { id: -1 }, 'car insurance paid today')?.id, 2);
  assert.equal(tagScore.twinOf(ctx, { id: -1 }, 'Phone case'), null);
});
test('Option-T lists the tag the same words carried first, saying so', () => {
  const ctx = shortNotes([['Phone case', 1], ['Phone', 2], ['Phone', 2]]);
  const { tagChoices } = require('../core/propose.js');
  const first = tagChoices(ctx, bullet({ text: 'Phone case' }))[0];
  assert.equal(first?.tag.title, 'Purchase'); assert.equal(first.how, 'twin');
});
test('two tags among the twins with no clear lead: nothing', () => {
  const ctx = shortNotes([['Netflix', 1], ['Netflix', 2]]);
  assert.equal(tagScore.twinOf(ctx, { id: -1 }, 'Netflix'), null);
});

section('choosing a tag from the pages a line names');
const { tagChoices } = require('../core/propose.js');
const ana = work.peoplePages.Person[0];
test('a linked person narrows the tags to those with a property that takes a person, and the words put them in order', () => {
  const asMeeting = tagChoices(work.ctx, bullet({ text: `Sync with [[${ana.uuid}]] about the database schema for the roadmap` }));
  assert.deepEqual(asMeeting.map(c => c.tag.title), ['Meeting', 'Action']);
  assert.deepEqual(asMeeting[0].via, ['Ana Ruiz']); assert.equal(asMeeting[0].how, 'mentioned'); assert.ok(asMeeting[0].fields.includes('Owner'));
  const asAction = tagChoices(work.ctx, bullet({ text: `Send the pricing summary to [[${ana.uuid}]] before the review` }));
  assert.deepEqual(asAction.map(c => c.tag.title), ['Action', 'Meeting']);
});
test('a name typed in plain words, with no brackets, counts the same as a link', () => {
  const choices = tagChoices(work.ctx, bullet({ text: 'Send the pricing summary to Ana Ruiz before the review' }));
  assert.equal(choices[0].tag.title, 'Action'); assert.deepEqual(choices[0].via, ['Ana Ruiz']);
});
test('a line that names nothing is ordered by its words alone, and a plain note gets no list', () => {
  const choices = tagChoices(work.ctx, bullet({ text: 'Sync about the schema migration and index' }));
  assert.equal(choices[0].tag.title, 'Meeting'); assert.ok(choices.every(c => c.how === 'words' || c.how === 'twin'), 'from the words alone: by its words, or written like this before');
  assert.deepEqual(tagChoices(work.ctx, bullet({ text: 'Coffee machine is broken again' })), []);
});
test('a bullet that already has a tag, or one typed in its words, is not offered another', () => {
  assert.deepEqual(tagChoices(work.ctx, bullet({ text: `Sync with [[${ana.uuid}]]`, tags: [work.tagPage.Meeting.id] })), []);
  assert.deepEqual(tagChoices(work.ctx, bullet({ text: `Sync with [[${ana.uuid}]] #Meeting` })), []);
});
test('the choices are the graph\'s own tags and never more than asked for', () => {
  const choices = tagChoices(work.ctx, bullet({ text: `Sync with [[${ana.uuid}]] about the database` }), { max: 1 });
  assert.equal(choices.length, 1);
  assert.ok(choices.every(c => work.ctx.knownTags.has(c.tag.id)));
});
test('in another language and with other property names, the same: the Spanish graph', () => {
  const lucia = libros.peoplePages.Autor[2];
  const choices = tagChoices(libros.ctx, bullet({ text: `Terminé el poemario de [[${lucia.uuid}]], versos breves` }));
  assert.equal(choices[0].tag.title, 'Libro'); assert.deepEqual(choices[0].via, [lucia.title]);
});

section('proposals on the Spanish "libros" graph (nothing in common with "work")');
const libros = synthetic.libros();
const autor = libros.peoplePages.Autor[0], poesia = libros.peoplePages['Género'].find(p => p.title === 'Poesía');
test('the genre is guessed from Spanish words', () => {
  const res = propose(libros.ctx, bullet({ text: `Terminé el poemario de [[${autor.uuid}]], versos breves`, tags: [libros.tagPage.Libro.id] }));
  assert.deepEqual(piece(res, libros.prop('Género').ident).ids, [poesia.id]);
  assert.deepEqual(piece(res, libros.prop('Autor').ident).ids, [autor.id]);
});
test('an accented property name is read for numbers and dates like any other', () => {
  assert.equal(dates.reader.numberInWords('Terminé el libro 4 hoy', 'Libro'), 4);
});
test('a date property this graph writes ahead is not filled with the journal day', () => {
  const res = propose(libros.ctx, bullet({ text: `Terminé el poemario de [[${autor.uuid}]]`, tags: [libros.tagPage.Libro.id], page: journal(libros, 20261028) }));
  assert.equal(piece(res, libros.prop('Leído el').ident), undefined);
});

section('a graph with no tags, no properties, no history');
const empty = synthetic.empty();
test('nothing is proposed and nothing throws', () => {
  assert.deepEqual(propose(empty.ctx, bullet({ text: 'Any words at all [[nobody]] #nothing on Friday' })).pieces, []);
  assert.deepEqual(score(empty.ctx).properties, { sureRight: 0, sureWrong: 0, guessRight: 0, guessWrong: 0, silent: 0 });
});

section('A linked page and the property the graph shows it belongs in (core/propose.js, linkEvidence)');
{
  // Items 1–10, item 7 (21 November 2026): "Paid off the Amex Gold card", a Transfer, pencilled From account = Amex Gold.
  const g = synthetic.build({
    tags: ['Transfer', 'Account'],
    props: [{ title: 'From account', type: 'node', accepts: ['Account'], on: ['Transfer'] }, { title: 'To account', type: 'node', accepts: ['Account'], on: ['Transfer'] }],
    people: { Account: ['Amex Gold', 'Chase Checking', 'Ally Savings'] },
    lines() {}, plain() {},
  });
  const ask = text => propose(g.ctx, bullet({ id: -7, text, tags: [g.tagPage.Transfer.id] })).pieces.filter(p => p.kind === 'node').map(p => [p.prop.title, p.shown]);
  test('a card "paid off" goes to To account, not From account', () => {
    const got = ask('Paid off the Amex Gold card');
    assert.ok(!got.some(([t, v]) => t === 'From account' && v === 'Amex Gold'), JSON.stringify(got));
    assert.ok(got.some(([t, v]) => t === 'To account' && v === 'Amex Gold'), JSON.stringify(got));
  });
  test('"from" a named account goes to From account', () => {
    const got = ask('Moved 500 from Chase Checking for the trip');
    assert.ok(got.some(([t, v]) => t === 'From account' && v === 'Chase Checking'), JSON.stringify(got));
  });
}
{
  const make = (performed, referred) => synthetic.build({
    tags: ['Procedure Event', 'Doctor'],
    props: [{ title: 'Referred by', type: 'node', accepts: ['Doctor'], on: ['Procedure Event'] }, { title: 'Performed by', type: 'node', accepts: ['Doctor'], on: ['Procedure Event'] }],
    people: { Doctor: ['Dr. Mei Chen', 'Dr. Samuel Okafor', 'Dr. Priya Raman'] },
    lines({ tagPage, peoplePages, prop, add, link, pick }) {
      for (let i = 0; i < performed; i++) { const d = pick(peoplePages.Doctor); add({ title: `Biopsy number ${i} done by ${link(d)} under sedation`, tags: [tagPage['Procedure Event'].id], values: new Map([[prop('Performed by').ident, [d.id]]]) }); }
      for (let i = 0; i < referred; i++) { const d = pick(peoplePages.Doctor); add({ title: `Endoscopy number ${i} after ${link(d)} referred me`, tags: [tagPage['Procedure Event'].id], values: new Map([[prop('Referred by').ident, [d.id]]]) }); }
    },
    plain() {},
  });
  const ask = g => { const d = g.peoplePages.Doctor[0]; const b = bullet({ id: -3, text: `Port insertion with [[${d.uuid}]] this morning`, tags: [g.tagPage['Procedure Event'].id] }); return propose(g.ctx, b).pieces.filter(p => p.kind === 'node').map(p => [p.prop.title, p.shown, !!p.guess]); };
  test('too little to go on, and the words give the doctor no part: the first property that takes the page, as a guess, since the other could as well', () => {
    // Until 22 November 2026 this was written at once. "Port insertion with …" says neither who referred nor who performed.
    assert.deepEqual(ask(make(2, 1))[0], ['Referred by', 'Dr. Mei Chen', true]);
  });
  test('the graph mostly leaves linked doctors out of the first property: it is left alone, and the next one takes the page', () => {
    assert.deepEqual(ask(make(12, 1)), [['Performed by', 'Dr. Mei Chen', false]], 'Referred by took 1 linked doctor in 13, Performed by 12 in 13: sure');
    assert.deepEqual(ask(make(12, 3)), [['Performed by', 'Dr. Mei Chen', true]], 'Performed by took 12 in 15: a guess, not written at once');
  });
  test('a bullet already in the graph says nothing about itself', () => {
    const g = make(4, 0), own = g.ctx.index.entries.find(e => (e.values.get(g.prop('Performed by').ident) || []).length);
    const classIds = new Set(g.prop('Performed by').classes.map(c => c.id)), lib = require('../core/propose.js');
    const all = lib.linkEvidence(g.ctx, g.prop('Performed by'), [g.tagPage['Procedure Event'].id], classIds, -1), without = lib.linkEvidence(g.ctx, g.prop('Performed by'), [g.tagPage['Procedure Event'].id], classIds, own.id);
    assert.equal(all.taken, 4); assert.equal(without.taken, 3);
    assert.equal(lib.linkTrust({ taken: 9, left: 1 }), 'sure'); assert.equal(lib.linkTrust({ taken: 5, left: 5 }), 'guess'); assert.equal(lib.linkTrust({ taken: 1, left: 5 }), 'leave'); assert.equal(lib.linkTrust({ taken: 0, left: 3 }), 'sure');
  });
}

section('The kind a new page is likely to be, from how earlier lines were written (core/newkind.js)');
{
  const { kindsAfter } = require('../core/newkind.js');
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const M = { uuid: 'm', title: 'Merchant' }, P = { uuid: 'p', title: 'Person' }, A = { uuid: 'a', title: 'Bank Account' }, PAGE = { uuid: 'x', title: 'Page' };
  const tags = { [id(1)]: [M, PAGE], [id(2)]: [M], [id(3)]: [M], [id(4)]: [P], [id(5)]: [A], [id(6)]: [A], [id(7)]: [P] };
  const tagsOf = u => tags[u];
  const lines = [`Lunch at [[${id(1)}]] $24`, `Coffee at [[${id(2)}]]`, `Groceries at [[${id(3)}]] $82`, `Coffee with [[${id(4)}]] at [[${id(2)}]]`, `Paid the gas bill from [[${id(5)}]]`, `Rent paid from [[${id(6)}]]`, `Dinner with [[${id(7)}]]`];
  test('"at" was followed by merchants: Merchant first and lit', () => { const k = kindsAfter('Coffee with Dana at ', lines, tagsOf, { skip: ['Page'] }); assert.equal(k[0].title, 'Merchant'); assert.equal(k[0].lit, true); assert.ok(!k.some(x => x.title === 'Page')); });
  test('"with" was followed by people, twice only: offered, not lit', () => { const k = kindsAfter('Lunch with ', lines, tagsOf, { skip: ['Page'] }); assert.equal(k[0].title, 'Person'); assert.equal(k[0].lit, false); });
  test('the two last words the same count double', () => { const k = kindsAfter('Paid the water bill from ', lines, tagsOf); assert.equal(k[0].title, 'Bank Account'); assert.equal(k[0].count, 3); });
  test('words never followed by a link: no kind, nothing lit', () => { assert.deepEqual(kindsAfter('Thinking about ', lines, tagsOf), []); assert.deepEqual(kindsAfter('', lines, tagsOf), []); });
  test('a link earlier in the line is not read as a word', () => { const k = kindsAfter(`Coffee with [[${id(4)}]] at `, lines, tagsOf, { skip: ['Page'] }); assert.equal(k[0].title, 'Merchant'); });
}

section('The part a page, a sum and a day play in the sentence (core/roles.js)');
{
  // 22 November 2026, the owner: "I want the property filling to be very sophisticated and have very nuanced way of distinguishing
  // language". Two sets of sentences where only the words say which property a value belongs in (tools/nuance): 81 it was built
  // with, 70 written after and first run once (62 whole, 4 missed, 4 wrong; before the change 12, 33 and 25).
  const nuance = require('../tools/nuance/measure.js'), g = nuance.graph();
  for (const [name, file] of [['the 81 sentences it was built with', '../tools/nuance/sentences.js'], ['the 70 written after', '../tools/nuance/fresh.js']]) test(`${name}: each filled whole, nothing put where it does not belong`, () => {
    const bad = require(file).map(s => ({ s, j: nuance.judge(s, nuance.run(g, s)) })).filter(x => x.j.verdict !== 'whole');
    assert.deepEqual(bad.map(x => `${x.s.s} | wrong: ${x.j.wrong.join('; ')} | missed: ${x.j.missed.join(', ')}`), []);
  });
  const roles = require('../core/roles.js');
  const parts = text => roles.read(g.ctx, text).mentions.map(m => [m.page.title, m.aside ? 'aside' : [...m.keys].filter(k => /^side:|:agent$/.test(k)).sort().join(' ')]);
  test('a page set aside: denied, replaced, compared with, spoken about, absent', () => {
    for (const text of ['Did not see [[Dr. Mei Chen]]', 'instead of [[Dr. Mei Chen]]', 'cheaper than [[Starbucks]]', 'about [[Dr. Mei Chen]]\'s report', '[[Dr. Mei Chen]] was away', 'Saw her, who trained under [[Dr. Mei Chen]]'])
      assert.deepEqual(parts(text).map(p => p[1]), ['aside'], text);
    assert.notEqual(parts('Saw [[Dr. Mei Chen]] today')[0][1], 'aside');
  });
  test('the side a page is on: from, to, an arrow, the verb', () => {
    assert.deepEqual(parts('Moved 5 from [[Chase Checking]] to [[Ally Savings]]').map(p => p[1]), ['side:from', 'side:to']);
    assert.deepEqual(parts('[[Chase Checking]] → [[Ally Savings]]').map(p => p[1]), ['side:from', 'side:to']);
    assert.ok(parts('Paid off the [[Amex Gold]]')[0][1].includes('side:to'));
    assert.ok(parts('Topped up [[Ally Savings]]')[0][1].includes('side:to'));
  });
  test('one event said from two sides is one part: who lent is who was borrowed from', () => {
    const lender = roles.specOf(g.ctx, g.prop('Lender')), borrower = roles.specOf(g.ctx, g.prop('Borrower'));
    const m = text => roles.read(g.ctx, text).mentions[0];
    assert.equal(roles.standing(m('Borrowed 40 from [[Sam Ortiz]]'), lender), 'strong');
    assert.equal(roles.standing(m('Lent [[Sam Ortiz]] 40'), borrower), 'strong');
    assert.equal(roles.standing(m('[[Sam Ortiz]] owes me 40'), borrower), 'strong');
    assert.equal(roles.standing(m('Lunch with [[Sam Ortiz]]'), roles.specOf(g.ctx, g.prop('Bought for'))), 'against');
  });
  test('a sum named as a part is not the price; a sum compared with or replaced is set aside', () => {
    const numbers = g.schema.props.filter(p => p.type === 'number');
    const read = text => { const r = roles.sums(g.ctx, text, numbers); return [r.main, ...[...r.byProp].map(([ident, n]) => `${g.schema.props.find(p => p.ident === ident).title} ${n}`)]; };
    assert.deepEqual(read('Dinner $84 plus $15 tip'), [84, 'Tip 15']);
    assert.deepEqual(read('Jacket was $200, paid $150'), [150]);
    assert.deepEqual(read('Bill went from $80 to $95'), [95]);
    assert.deepEqual(read('Phone case $18, $7 less than online'), [18]);
    assert.deepEqual(read('Paid $50 of the $95 bill'), [50]);
    assert.deepEqual(read('$84 and wine $22, $106 total'), [106]);
    assert.deepEqual(read('Dinner $120 and drinks $40'), [null], 'two prices with nothing to tell them apart: nothing');
  });
  test('a day set aside for another is taken out of the words', () => {
    const say = text => roles.standingDays(dates.reader, text, 20261118);
    assert.equal(say('Due date moved from Dec 5 to Dec 12'), 'Due date moved Dec 12');
    assert.equal(say('Report was due Nov 20, pushed to Nov 27'), 'Report was due Nov 27');
    assert.equal(say('Send the draft by Dec 4, not Dec 1'), 'Send the draft by Dec 4');
    assert.equal(say('Originally due Dec 1, now due Dec 8'), 'now due Dec 8');
    assert.equal(say('Bill no longer due Dec 5'), 'Bill');
    assert.equal(say('Window replaced Nov 9, invoice due Dec 9'), 'Window replaced Nov 9, invoice due Dec 9', 'nothing set aside: the words as they were');
  });
  test('a page the words gave one property is not offered for another from look-alike bullets', () => {
    // By hand in Logseq, 22 November 2026: "Deposited $250 into [[Chase Checking]]" pencilled Chase Checking in From account too.
    const h = synthetic.build({
      tags: ['Transfer', 'Account'],
      props: [{ title: 'From account', type: 'node', accepts: ['Account'], on: ['Transfer'] }, { title: 'To account', type: 'node', accepts: ['Account'], on: ['Transfer'] }],
      people: { Account: ['Chase Checking', 'Ally Savings'] },
      lines({ tagPage, peoplePages, prop, add, link }) { const [chase, ally] = peoplePages.Account; for (let i = 0; i < 8; i++) add({ title: `Deposited ${100 + i} dollars out of ${link(chase)} to ${link(ally)}`, tags: [tagPage.Transfer.id], values: new Map([[prop('From account').ident, [chase.id]], [prop('To account').ident, [ally.id]]]) }); },
      plain() {},
    });
    const got = propose(h.ctx, bullet({ text: 'Deposited 250 dollars into [[Chase Checking]]', tags: [h.tagPage.Transfer.id] })).pieces.filter(p => p.kind === 'node').map(p => [p.prop.title, p.shown]);
    assert.deepEqual(got.filter(([, v]) => v === 'Chase Checking'), [['To account', 'Chase Checking']], JSON.stringify(got));
  });
  test('a date named for a day to come is not guessed as the day of writing', () => {
    const b = bullet({ text: 'Call the bank about the card', tags: [g.tagPage.Task.id], page: journal(g, 20261118) });
    assert.deepEqual(propose(g.ctx, b).pieces.map(p => p.prop.title), []);
  });
}

section('scoring each graph (leave-one-out on its own lines)');
for (const [name, g] of [['work', work], ['libros', libros]]) {
  const s = score(g.ctx, { sample: 800 });
  const spoken = s.properties.guessRight + s.properties.guessWrong;
  say(`      ${name}: ${s.lines} lines | sure ${s.properties.sureRight}/${s.properties.sureWrong} | guess ${s.properties.guessRight}/${s.properties.guessWrong} | silent ${s.properties.silent} | tag ${s.tags.right}/${s.tags.wrong}/${s.tags.silent} | plain spoke ${s.plain.spoke}`);
  test(`${name}: sure pieces are never wrong`, () => assert.equal(s.properties.sureWrong, 0));
  test(`${name}: guesses are right at least 95% of the time`, () => assert.ok(spoken === 0 || s.properties.guessWrong / spoken <= .05, `${s.properties.guessWrong} wrong of ${spoken}`));
  test(`${name}: plain notes are (almost) never given a tag`, () => assert.ok(s.plain.spoke <= Math.ceil((s.plain.spoke + s.plain.silent) * .02)));
}
// A property that takes any page is no reason to offer its tag (the owner's two lines, 14 November 2026).
test('a take-anything property is no reason for a tag; the reason names the property that takes the pages', () => {
  const { candidateTags } = require('../core/propose.js');
  const tagIds = { Person: 1, Doctor: 2, Symptom: 3, Conversation: 10, Consultation: 11 };
  const prop = (id, title, takes) => ({ id, ident: `user.property/p${id}`, title, type: 'node', classes: takes.map(n => ({ id: tagIds[n], title: n })) });
  const props = [prop(100, 'Spoke with', ['Person']), prop(101, 'Provider', ['Doctor']), prop(102, 'Topic', ['Person', 'Symptom'])];
  const schema = { props, byId: new Map(props.map(x => [x.id, x])), classProps: new Map([[10, [100, 102]], [11, [101, 102]]]), parentsOf: new Map([[2, [1]]]), builtIn: new Set() };
  const ctx = { knownTags: new Set([10, 11]), schema };
  const ruth = { id: 50, title: 'Ruth Okoro', tags: [{ id: 1 }] }, chen = { id: 51, title: 'Dr. Mei Chen', tags: [{ id: 2 }] }, tingling = { id: 52, title: 'Tingling fingers', tags: [{ id: 3 }] };
  const said = found => [...found].map(([id, by]) => [id, [...by].map(([title, pages]) => `${title}: ${[...pages].join(', ')}`)]);
  assert.deepEqual(said(candidateTags(ctx, [ruth])), [[10, ['Spoke with: Ruth Okoro']]], 'a person: a Conversation through Spoke with; not a Consultation, whose Provider takes a doctor and whose Topic takes anything');
  assert.deepEqual(said(candidateTags(ctx, [chen])), [[10, ['Spoke with: Dr. Mei Chen']], [11, ['Provider: Dr. Mei Chen']]], 'a doctor is a person too');
  assert.deepEqual(said(candidateTags(ctx, [tingling])), [], 'a symptom fits only Topic, which says nothing');
});

// The Option-T list by where each tag sits: groups by the top-level tag, in the order their best guess came.
test('guesses grouped under their top-level tags', () => {
  const { topOf, byTop } = require('../core/schema.js');
  const schema = { parentsOf: new Map([[2, [1]], [3, [2]], [5, [4]], [6, [4]], [1, [99]]]), builtIn: new Set([99]) };
  assert.equal(topOf(3, schema), 1); assert.equal(topOf(1, schema), 1, 'Logseq\'s own Root is not a top-level tag of yours'); assert.equal(topOf(7, schema), 7);
  const items = [{ tag: { id: 5 } }, { tag: { id: 3 } }, { tag: { id: 6 } }, { tag: { id: 7 } }, { tag: { id: 2 } }];
  assert.deepEqual(byTop(items, schema).map(i => [i.tag.id, i.top]), [[5, 4], [6, 4], [3, 1], [2, 1], [7, 7]], 'the best guess stays first; each group stands where its best guess came');
});

(async () => {
  for (const task of queue) await task();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
