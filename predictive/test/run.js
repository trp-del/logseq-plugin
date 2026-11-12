/* Run with: node test/run.js
   The core on pretend graphs. No Logseq needed. Each check says what it proves; the last section scores the proposals on
   graphs that share nothing with each other, which is the point: the plugin must work on any graph. */
const assert = require('node:assert/strict');
const engine = require('../core/engine.js');
const dates = require('../core/dates.js');
const link = require('../core/link.js');
const { propose } = require('../core/propose.js');
const { score, tune } = require('../core/score.js');
const { learnEntry, profileOf } = require('../core/context.js');
const { profileScores } = require('../core/profile.js');
const synthetic = require('./synthetic.js');

let passed = 0, failed = 0;
// Tests are queued and run in order, so a test may be async (tuning is).
const queue = [];
const test = (name, fn) => queue.push(async () => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (error) { failed++; console.log('FAIL  ' + name + '\n      ' + String(error.message).split('\n').join('\n      ')); } });
const section = name => queue.push(() => console.log('\n' + name));
const say = text => queue.push(() => console.log(text));

const bullet = (over = {}) => ({ id: -1, uuid: '', text: '', tags: [], values: new Map(), page: null, parent: null, ...over });
const journal = (g, day) => { const id = 9000 + day % 100; g.ctx.days.set(id, day); g.ctx.dayIds = null; return { id, uuid: synthetic.uuid(id), title: 'Oct', day, tags: [] }; };
const piece = (result, ident) => result.pieces.find(p => p.ident === ident);

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
test('an untagged line that reads like the meetings is offered the Meeting tag, with its properties as guesses', () => {
  const res = propose(work.ctx, bullet({ text: `Sync with [[${person.uuid}]] about database schema for the roadmap`, page: journal(work, 20261028) }));
  const tag = res.pieces.find(p => p.kind === 'tag');
  assert.equal(tag.tag.id, Meeting.id);
  assert.ok(res.pieces.filter(p => p.kind !== 'tag').every(p => p.guess && p.needsTag));
});
test('a lower tag threshold offers a tag that the strict one holds back, and a plain note still gets none', () => {
  const g = synthetic.work(), line = bullet({ text: 'Sync about the database', page: journal(g, 20261028) });
  const tagOf = () => propose(g.ctx, line).pieces.find(p => p.kind === 'tag');
  assert.equal(g.ctx.limits.tagNearLeast, .6);
  g.ctx.limits.tagGap = 0;   // the vote alone (the profile is tried below)
  const strict = tagOf();
  Object.assign(g.ctx.limits, { tagNearLeast: .25, tagLead: .6 });
  const loose = tagOf();
  assert.ok(!strict, 'the strict setting offered a tag');
  assert.ok(loose && loose.tag.id === g.tagPage.Meeting.id, 'the loose setting offered ' + (loose && loose.tag.title));
  assert.equal(propose(g.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(g, 20261028) })).pieces.length, 0);
});
test('the tags\' word profiles offer a tag the vote holds back, when the words lead clearly', () => {
  const g = synthetic.work();
  Object.assign(g.ctx.limits, { tagNearLeast: .99, tagGap: 3 });   // the vote cannot speak; only the profile can
  const p = profileOf(g.ctx);
  assert.deepEqual(p.classes.map(c => c === 0 ? 'plain' : g.ctx.byId.get(c).title).sort(), ['Action', 'Meeting', 'plain'], 'the tags bullets carry, and plain; not Person or Project (pages only)');
  const got = propose(g.ctx, bullet({ text: 'Sync about the roadmap and database', page: journal(g, 20261028) })).pieces.find(p => p.kind === 'tag');
  assert.ok(got && got.tag.id === g.tagPage.Meeting.id && got.tag.by === 'profile', 'offered ' + (got && got.tag.title));
  assert.equal(propose(g.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(g, 20261028) })).pieces.length, 0, 'a plain note');
  assert.equal(propose(g.ctx, bullet({ text: 'Zxqv flurm wibble', page: journal(g, 20261028) })).pieces.length, 0, 'words never seen');
  g.ctx.limits.tagGap = 0;
  assert.equal(propose(g.ctx, bullet({ text: 'Sync about the roadmap and database', page: journal(g, 20261028) })).pieces.length, 0, 'gap 0 turns the profile off');
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
  assert.equal(propose(work.ctx, bullet({ text: 'Coffee machine is broken again', page: journal(work, 20261028) })).pieces.length, 0);
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

section('lessons: what you do with a suggestion (core/lessons.js)');
test('a lesson is written as a plain line and read back the same', () => {
  const L = require('../core/lessons.js'), lessons = new Map();
  const tag = { kind: 'tag', tag: { title: 'Conversation' }, ids: [7], how: 'meaning', guess: true };
  for (let i = 0; i < 5; i++) L.note(lessons, tag, 'no');
  L.note(lessons, tag, 'taken');
  const line = L.lineOf(lessons.get(L.keyOf(tag)));
  assert.equal(line, 'Apple’s matcher · tag Conversation: taken 1, said no 5');
  const back = L.parseLine(line);
  assert.equal(back.taken, 1); assert.equal(back.no, 5); assert.equal(L.parseLine('What Predictive has learned.'), null);
  assert.equal(L.note(lessons, { ...tag, guess: false }, 'no'), null, 'a sure value teaches nothing');
});
test('said no to often enough, a guess is held back, with the guesses that rested on its tag; a sure value never', () => {
  const L = require('../core/lessons.js'), lessons = new Map();
  const tag = { kind: 'tag', ident: 'block/tags', tag: { title: 'Conversation' }, ids: [7], how: 'meaning', guess: true };
  const under = { kind: 'node', ident: 'p', prop: { title: 'Spoke with', type: 'node' }, ids: [9], how: 'meaning', guess: true, needsTag: true };
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

section('a tag waits for enough words');
test('a line of three words gets no tag, the same line of four does', () => {
  const g = synthetic.work(), loose = { ...g.ctx, limits: { ...g.ctx.limits, tagNearLeast: .2, tagLead: .5 } };
  const tagOf = t => propose(loose, bullet({ text: t, page: journal(g, 20261028) })).pieces.find(p => p.kind === 'tag');
  assert.equal(tagOf('Sync about database'), undefined);
  assert.ok(tagOf('Sync about the database'));
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
  assert.equal(choices[0].tag.title, 'Meeting'); assert.ok(choices.every(c => c.how === 'words'));
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

section('Apple\'s model: what it is asked and what is kept (core/model.js, with a pretend answer)');
const modelLib = require('../core/model.js');
const clinic = synthetic.build({
  tags: ['Consultation', 'Person', 'Place'],
  props: [
    { title: 'Provider', type: 'node', accepts: ['Person'], on: ['Consultation'] },
    { title: 'Spoke with', type: 'node', accepts: ['Person'], many: true, on: ['Consultation'] },
    { title: 'Where', type: 'node', accepts: ['Place'], on: ['Consultation'] },
    { title: 'Dose', type: 'number', on: ['Consultation'] },
    { title: 'Start', type: 'date', on: ['Consultation'] },
    { title: 'End', type: 'date', on: ['Consultation'] },
    { title: 'Topic', type: 'node', accepts: ['Person', 'Place'], on: ['Consultation'] },
  ],
  people: { Person: ['Dr. Mei Chen', 'Ruth Okoro', 'Lena Park'], Place: ['Northgate Clinic'] },
  lines({ tagPage, peoplePages, prop, add, link }) {
    for (const [i, person] of peoplePages.Person.entries()) add({ title: `Visit with ${link(person)} number ${i}`, tags: [tagPage.Consultation.id], values: new Map([[prop('Provider').ident, [person.id]]]) });
  },
  plain({ add }) { for (let i = 0; i < 20; i++) add(`Plain note number ${i} about the weather`); },
});
const visit = (text, over = {}) => bullet({ id: -5, text, tags: [clinic.tagPage.Consultation.id], page: { id: 9902, uuid: synthetic.uuid(9902), title: 'Nov 2', day: 20261102, tags: [] }, ...over });
const askAbout = b => { const result = propose(clinic.ctx, b); return { result, req: modelLib.request(clinic.ctx, b, result, 20261102) }; };
const said = 'Saw Dr. Mei Chen with Ruth Okoro about the fatigue, 5 mg from 9 Nov until 13 Nov';
const byTitle = req => new Map(req.fill.properties.map(p => [p.title, p]));
test('asked only what the rules left open or guessed from plain words: the pages the words name, and nothing where they name none', () => {
  const { result, req } = askAbout(visit(said));
  const asked = byTitle(req), rulesSaid = new Set(result.pieces.filter(p => !modelLib.byWordsAlone(p)).map(p => p.prop.title));
  for (const title of rulesSaid) assert.ok(!asked.has(title), `${title} was already proposed by the rules`);
  for (const title of ['Provider', 'Spoke with']) if (asked.has(title)) assert.ok(asked.get(title).choices.every(c => ['Dr. Mei Chen', 'Ruth Okoro'].includes(c)), 'named people only, where people are named');
  assert.ok(!asked.has('Where'), 'no place is named, so Where is not asked about (since 12 November 2026)');
  assert.ok(!asked.has('Topic'), 'a wide property is never asked about');
  assert.ok(asked.has('Dose') && asked.has('Start') && asked.has('End'));
  assert.ok(!JSON.stringify(req.fill).includes('Lena Park'), 'a page the words do not name is never sent');
});
test('a right answer is kept, as guesses', () => {
  const { req } = askAbout(visit(said));
  const key = Object.fromEntries(req.fill.properties.map(p => [p.title, p.key]));
  const values = {};
  if (key.Provider) values[key.Provider] = 'Dr. Mei Chen';
  if (key['Spoke with']) values[key['Spoke with']] = ['Ruth Okoro'];
  values[key.Dose] = 5; values[key.Start] = '2026-11-09'; values[key.End] = '2026-11-13';
  const kept = modelLib.pieces(clinic.ctx, req, { values });
  assert.ok(kept.every(p => p.guess && p.how === 'model'));
  const of = title => kept.find(p => p.prop.title === title);
  assert.equal(of('Dose').ids[0], 5);
  assert.equal(of('Start').day, 20261109); assert.equal(of('End').day, 20261113);
  if (key['Spoke with']) assert.deepEqual(of('Spoke with').shown, 'Ruth Okoro');
});
test('what the words do not hold is dropped: another page, another number, another day, one day for two', () => {
  const { req } = askAbout(visit(said));
  const key = Object.fromEntries(req.fill.properties.map(p => [p.title, p.key]));
  const page = req.fill.properties.find(p => p.kind === 'page');
  const values = { [key.Dose]: 7, [key.Start]: '2026-11-10' };
  if (page) values[page.key] = 'Lena Park';
  assert.deepEqual(modelLib.pieces(clinic.ctx, req, { values }), []);
  const same = modelLib.pieces(clinic.ctx, req, { values: { [key.Start]: '2026-11-09', [key.End]: '2026-11-09' } });
  assert.deepEqual(same, [], 'a start and an end on one day is one day named');
});
test('the model\'s reading of roles replaces the rules\' guess from plain words, and nothing else', () => {
  const b = visit(said), { result, req } = askAbout(b);
  const rule = title => result.pieces.find(p => p.prop.title === title);
  assert.equal(rule('Provider').shown, 'Ruth Okoro', 'the rules alone put the first person named second in Provider');
  const asked = byTitle(req);
  assert.deepEqual(asked.get('Provider').choices.sort(), ['Dr. Mei Chen', 'Ruth Okoro']);
  const kept = modelLib.pieces(clinic.ctx, req, { values: { [asked.get('Provider').key]: 'Dr. Mei Chen' } });
  const shown = modelLib.merge(result.pieces, kept);
  assert.equal(shown.find(p => p.prop.title === 'Provider').shown, 'Dr. Mei Chen');
  assert.ok(!shown.some(p => p.prop.title === 'Spoke with' && p.ids.includes(clinic.page.get('Dr. Mei Chen').id)), 'Dr. Mei Chen is not in two places');
  const linked = `Saw [[${clinic.page.get('Dr. Mei Chen').uuid}]] about the fatigue`, lr = propose(clinic.ctx, visit(linked));
  const sure = lr.pieces.find(p => p.prop.title === 'Provider');
  assert.ok(sure && !sure.guess, 'a linked page is sure');
  assert.deepEqual(modelLib.merge(lr.pieces, [{ ...sure, ids: [clinic.page.get('Ruth Okoro').id], shown: 'Ruth Okoro', how: 'model', guess: true }]).find(p => p.prop.title === 'Provider').shown, 'Dr. Mei Chen', 'a sure value is never replaced');
});
test('words that describe a page in other words: not asked while writing; for the measure, offered the pages the property can take', () => {
  const b = visit('Went to the hospital in the morning, they kept me waiting');
  assert.ok(!byTitle(askAbout(b).req || { fill: { properties: [] } }).has('Where'), 'while writing, a place the words do not name is not asked about');
  const req = modelLib.request(clinic.ctx, b, propose(clinic.ctx, b), 20261102, { range: true });
  const where = byTitle(req).get('Where');
  assert.ok(where, 'the measure\'s old way asks Where though no place is named');
  assert.match(where.about, /other words/);
  assert.ok(where.choices.every(c => clinic.ctx.pages.some(p => p.title === c && !p.isTag)), 'only pages of the graph');
  assert.ok(where.choices.length <= modelLib.MOST_RANGE);
  const kept = modelLib.pieces(clinic.ctx, req, { values: { [where.key]: 'Northgate Clinic' } });
  assert.equal(kept.find(p => p.prop.title === 'Where')?.shown, 'Northgate Clinic');
  assert.ok(kept.every(p => p.guess && p.how === 'model'), 'a guess, as every answer of the model');
  assert.deepEqual(modelLib.pieces(clinic.ctx, req, { values: { [where.key]: 'Lena Park' } }).filter(p => p.prop.title === 'Where'), [], 'a page it cannot take is never kept');
  assert.ok(req.fill.instructions && /other words/.test(req.fill.instructions), 'the plugin sends the instructions');
});
test('one person is not put in two places', () => {
  const b = visit('Saw Ruth Okoro about the fatigue');
  const { req } = askAbout(b);
  const pages = req ? req.fill.properties.filter(p => p.kind === 'page' && !p.many && p.choices.includes('Ruth Okoro')) : [];
  if (pages.length < 1) return;
  const many = req.fill.properties.find(p => p.many);
  const values = { [pages[0].key]: 'Ruth Okoro', ...(many ? { [many.key]: ['Ruth Okoro'] } : {}) };
  const kept = modelLib.pieces(clinic.ctx, req, { values });
  assert.equal(kept.filter(p => p.ids.includes(clinic.page.get('Ruth Okoro').id)).length, 1);
});
test('a bullet with no tag, where the rules found none: asked only which of the graph\'s tags it is', () => {
  const b = bullet({ id: -7, text: 'Talked through the scan with Dr. Mei Chen at length' });
  const { result, req } = askAbout(b);
  assert.ok(!result.pieces.some(p => p.kind === 'tag') || req === null, 'asked only when the rules pencilled no tag');
  assert.deepEqual(result.pieces, [], 'the rules pencil nothing for this line');
  assert.equal(req.fill.properties.length, 1);
  const [q] = req.fill.properties;
  assert.equal(q.kind, 'tag');
  assert.ok(q.choices.includes('Consultation'), q.choices.join(', '));
  assert.equal(q.choices[0], 'Consultation', 'the tag the named page could take comes first');
  assert.ok(q.choices.length <= modelLib.MOST_TAGS);
  const kept = modelLib.pieces(clinic.ctx, req, { values: { t: 'Consultation' } });
  assert.equal(kept[0].kind, 'tag'); assert.equal(kept[0].how, 'model'); assert.equal(kept[0].tag.title, 'Consultation');
  assert.ok(kept.slice(1).every(p => p.guess && p.needsTag), 'the properties it brings come as guesses');
  assert.deepEqual(modelLib.pieces(clinic.ctx, req, { values: { t: 'none' } }), [], 'none: a plain note');
  assert.deepEqual(modelLib.pieces(clinic.ctx, req, {}), [], 'nothing said: nothing kept');
  assert.deepEqual(modelLib.pieces(clinic.ctx, req, { values: { t: 'Recipe' } }), [], 'a tag not offered is never taken');
  assert.equal(modelLib.tagOf(req, { values: { t: 'consultation' } })?.title, 'Consultation', 'Option-T reads the same answer');
});
test('a tag read by the model: its properties are the second question, and come under the tag as guesses', () => {
  const b = bullet({ id: -7, text: 'Talked through the scan with Dr. Mei Chen at Northgate Clinic' });
  const { req } = askAbout(b);
  const reply = { values: { t: 'Consultation' } };
  const next = modelLib.followUp(clinic.ctx, req, reply, 20261102);
  assert.ok(next, 'the tag brings a second question');
  assert.ok(next.req.fill.tags.includes('Consultation'), 'asked as a Consultation');
  const asked = new Map(next.req.fill.properties.map(p => [p.title, p]));
  assert.ok(!asked.has('Provider'), 'Provider the rules already guess from earlier lines is not asked again');
  assert.deepEqual(asked.get('Where')?.choices, ['Northgate Clinic'], 'Where, which the rules left open, is asked');
  const first = modelLib.pieces(clinic.ctx, req, reply);
  const both = modelLib.withFollowUp(clinic.ctx, first, next.req, { values: { [asked.get('Where').key]: 'Northgate Clinic' } });
  assert.equal(both[0].kind, 'tag', 'the tag stays first');
  const where = both.find(p => p.prop.title === 'Where');
  assert.equal(where.shown, 'Northgate Clinic'); assert.ok(where.guess && where.needsTag && where.how === 'model');
  assert.equal(both.find(p => p.prop.title === 'Provider')?.shown, 'Dr. Mei Chen', 'the rules\' Provider stays beside it');
  assert.equal(modelLib.followUp(clinic.ctx, req, { values: { t: 'none' } }), null, 'no tag, no second question');
});
test('the tag question says what each tag holds, from the graph, and no earlier lines unless asked for', () => {
  const b = bullet({ id: -7, text: 'Talked through the scan with Dr. Mei Chen at length' });
  const { req } = askAbout(b);
  const context = req.fill.context;
  assert.match(context, /- Consultation: Provider, Spoke with, Where, Dose/, 'a tag with its properties (four at most)');
  assert.ok(!/Earlier notes/.test(context), 'no earlier lines: they are what Apple\'s filter refused (0.3.18)');
  const withLines = modelLib.tagRequest(clinic.ctx, b, 20261102, { examples: true }).fill.context;
  assert.match(withLines, /"Visit with Dr\. Mei Chen number 0" \(Consultation\)|"Visit with .+" \(Consultation\)/, 'asked for, an earlier Consultation, its link read as the name');
  assert.ok(!/\[\[/.test(context), 'no raw link in what is sent');
  assert.ok(context.length < 4000, 'kept short enough for the model on the Mac');
});
test('a tag the rules pencil: the model is asked about its properties, which wait for the tag', () => {
  const b = bullet({ id: -8, text: 'Visit with Dr. Mei Chen number 1 again' });
  const result = propose(clinic.ctx, b);
  assert.ok(result.assume, 'the rules pencil a tag for this line');
  const req = modelLib.request(clinic.ctx, b, result, 20261102);
  assert.ok(req?.needsTag, 'asked, as for a bullet with the tag');
  assert.ok(req.fill.tags.includes(result.assume.title));
  assert.ok(!req.fill.properties.some(p => p.title === 'Where'), 'no place is named, so Where is not asked');
  const dose = req.fill.properties.find(p => p.title === 'Dose');
  const kept = modelLib.pieces(clinic.ctx, req, { values: { [dose.key]: 1 } });
  assert.equal(kept[0].shown, '1'); assert.ok(kept[0].needsTag && kept[0].guess);
});
test('the pencilled tag waits while the setting is careful; Option-T still asks', () => {
  const b = bullet({ id: -7, text: 'Talked through the scan with Dr. Mei Chen at length' });
  const result = propose(clinic.ctx, b);
  assert.deepEqual(result.pieces, [], 'the rules pencil nothing for this line');
  const was = clinic.ctx.limits.modelTag;
  clinic.ctx.limits.modelTag = false;
  try {
    assert.equal(modelLib.request(clinic.ctx, b, result, 20261102), null);
    assert.ok(modelLib.tagRequest(clinic.ctx, b, 20261102), 'Option-T asks whatever the setting');
  } finally { clinic.ctx.limits.modelTag = was; }
});
test('not asked: a linked page the rules placed, a note under a record, plain words', () => {
  const linked = askAbout(visit(`Saw [[${clinic.page.get('Dr. Mei Chen').uuid}]] about the fatigue`)).req;
  assert.ok(!linked || !byTitle(linked).has('Provider'), 'the rules fill Provider from the link');
  const parent = { id: -9, uuid: synthetic.uuid(9909), tags: [clinic.tagPage.Consultation.id], values: new Map() };
  assert.equal(askAbout(bullet({ id: -6, text: 'Ruth Okoro came too, 5 mg', parent })).req, null);
  const plain = askAbout(visit('Felt tired all afternoon again')).req;
  assert.ok(!plain || plain.fill.properties.every(p => p.kind === 'page' && /other words/.test(p.about)), 'words that name nothing: only the pages each property can take');
  assert.equal(modelLib.tagRequest(clinic.ctx, bullet({ id: -6, text: 'Ruth Okoro came too, 5 mg', parent }), 20261102), null, 'no tag is asked for a note under a record');
});

section('A linked page and the property the graph shows it belongs in (core/propose.js, linkEvidence)');
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
  test('too little to go on: the first property that takes the page, written at once, as a linked page always was', () => {
    assert.deepEqual(ask(make(2, 1))[0], ['Referred by', 'Dr. Mei Chen', false]);
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

section('Matching by meaning (core/meaning.js, with pretend near notes)');
{
  const meaningLib = require('../core/meaning.js');
  const C = clinic.ctx, entries = C.index.entries, mei = clinic.page.get('Dr. Mei Chen'), ruth = clinic.page.get('Ruth Okoro');
  const ofMei = entries.find(e => (e.values.get('user.property/provider') || [])[0] === mei.id), ofRuth = entries.find(e => (e.values.get('user.property/provider') || [])[0] === ruth.id);
  const plain = entries.find(e => e.values.get('block/tags')?.[0] === 0);
  const WITH_PROPS = { ...C, limits: { ...C.limits, meaningProps: true } };   // as the harness can ask: page properties voted by meaning too
  const fresh = (text, over = {}) => bullet({ id: -7, text, page: { id: 9902, uuid: synthetic.uuid(9902), title: 'Nov 2', day: 20261102, tags: [] }, ...over });
  test('an untagged line the rules find nothing for: the tag of the near notes, with its properties as guesses under it', () => {
    const b = fresh('Talked things through with the oncologist this morning'), result = propose(C, b);
    assert.equal(result.pieces.length, 0, 'the rules say nothing: no shared word');
    assert.ok(meaningLib.wanted(C, b, result));
    const near = [{ entry: ofMei, sim: .58 }, { entry: ofMei, sim: .52 }, { entry: plain, sim: .3 }];
    const got = meaningLib.pieces(C, b, result, near);
    assert.equal(got[0].kind, 'tag'); assert.equal(got[0].tag.title, 'Consultation'); assert.equal(got[0].how, 'meaning');
    assert.ok(got.slice(1).every(p => p.needsTag), 'the rest wait for the tag');
    assert.ok(!got.some(p => p.how === 'meaning' && p.kind !== 'tag'), 'no page property is voted by meaning (since 12 November 2026)');
    assert.deepEqual(meaningLib.pieces(C, b, result, [{ entry: ofMei, sim: .58 }, { entry: ofMei, sim: .52 }, { entry: plain, sim: .45 }]), [], 'the tag must hold four fifths of the vote');
    const withProps = meaningLib.pieces(WITH_PROPS, b, result, near);
    assert.equal(withProps.find(p => p.prop.title === 'Provider')?.shown, 'Dr. Mei Chen', 'asked for (the harness), the near notes\' Provider comes under it');
  });
  test('too far, a tie between two values, or plain notes nearest: nothing', () => {
    const b = fresh('Talked things through with the oncologist this morning'), result = propose(C, b);
    assert.deepEqual(meaningLib.pieces(C, b, result, [{ entry: ofMei, sim: .3 }]), [], 'too far');
    const t = visit('Talked things through this morning'), rt = propose(C, t);
    assert.deepEqual(meaningLib.pieces(WITH_PROPS, t, rt, [{ entry: ofMei, sim: .55 }, { entry: ofRuth, sim: .54 }]), [], 'a tie between two values says nothing');
    assert.deepEqual(meaningLib.pieces(C, b, result, [{ entry: plain, sim: .7 }, { entry: ofMei, sim: .5 }]), [], 'a plain note nearest: no tag');
    assert.equal(meaningLib.whyNoTag(C, b, result, [{ entry: ofMei, sim: .3 }]), 'the nearest note is too far');
    assert.equal(meaningLib.whyNoTag(C, b, result, [{ entry: plain, sim: .7 }]), 'the near notes are plain notes');
    assert.equal(meaningLib.whyNoTag(C, b, result, [{ entry: ofMei, sim: .58 }, { entry: plain, sim: .5 }]), 'no value holds enough of the vote');
    assert.equal(meaningLib.whyNoTag(C, b, result, [{ entry: ofMei, sim: .58 }]), null, 'a tag would come: no reason');
    assert.equal(meaningLib.whyNoTag(C, { ...b, parent: { tags: [clinic.tagPage.Consultation.id], values: new Map() } }, result, []), 'it sits under a tagged bullet');
  });
  test('a graph where half the notes of a kind were never tagged: the bar is learned from it, and the tag is still offered', () => {
    const b = fresh('Talked things through with the oncologist this morning'), result = propose(C, b);
    const near = [{ entry: ofMei, sim: .6 }, { entry: plain, sim: .6 }, { entry: ofMei, sim: .55 }, { entry: plain, sim: .55 }];
    assert.deepEqual(meaningLib.pieces(C, b, result, near), [], 'as plain notes always voted: half the vote is "no tag", so nothing');
    assert.ok(Math.abs(meaningLib.taggedShare(near) - .5) < 1e-9);
    assert.equal(meaningLib.barFrom(Array(30).fill(.5)), .35, 'seven tenths of the usual share around the graph\'s own tagged notes');
    assert.equal(meaningLib.barFrom(Array(30).fill(1)), .7); assert.equal(meaningLib.barFrom(Array(30).fill(.1)), .15, 'never under .15');
    assert.equal(meaningLib.barFrom(Array(5).fill(.5)), null, 'too few tagged notes to go on: plain notes vote as before');
    const learned = { ...C, limits: { ...C.limits, meaningTagged: .35 } };
    assert.equal(meaningLib.pieces(learned, b, result, near)[0]?.tag.title, 'Consultation', 'the tagged notes hold enough, and one tag leads among them');
    assert.deepEqual(meaningLib.pieces(learned, b, result, [{ entry: plain, sim: .7 }, { entry: plain, sim: .65 }, { entry: plain, sim: .6 }, { entry: ofMei, sim: .5 }]), [], 'mostly plain notes near: the line stays plain');
    assert.equal(meaningLib.whyNoTag(learned, b, result, [{ entry: plain, sim: .7 }, { entry: plain, sim: .65 }, { entry: plain, sim: .6 }, { entry: ofMei, sim: .5 }]), 'the near notes are plain notes');
    assert.ok(meaningLib.sampleOf(C).length > 0 && meaningLib.sampleOf(C).every(e => e.values.get('block/tags')[0] > 0), 'sampled by its tagged bullets');
  });
  test('a tagged line: nothing by meaning; asked for, only the open page properties, never one the rules filled or held back', () => {
    const b = visit('Talked things through this morning'), result = propose(C, b);
    assert.deepEqual(meaningLib.pieces(C, b, result, [{ entry: ofRuth, sim: .6 }, { entry: ofRuth, sim: .5 }]), [], 'a page property is not voted by meaning');
    assert.equal(meaningLib.wanted(C, b, result), false, 'so the matcher is not asked about a tagged line');
    const got = meaningLib.pieces(WITH_PROPS, b, result, [{ entry: ofRuth, sim: .6 }, { entry: ofRuth, sim: .5 }]);
    assert.deepEqual(got.map(p => [p.prop.title, p.shown, p.how]), [['Provider', 'Ruth Okoro', 'meaning']]);
    const held = visit(`Saw [[${mei.uuid}]] this morning`), r2 = propose(C, held);
    assert.deepEqual(meaningLib.pieces(WITH_PROPS, held, r2, [{ entry: ofRuth, sim: .6 }]), [], 'Provider is filled by the link: not asked');
  });
  test('the words a note is learned by: a saved link as its name, tags left out', () => {
    assert.equal(meaningLib.textOf(C, `Saw [[${mei.uuid}]] about it #Consultation`), 'Saw Dr. Mei Chen about it');
  });
}

section('New people and places (core/people.js, with pretend names)');
{
  const peopleLib = require('../core/people.js');
  const C = clinic.ctx, Person = clinic.tagPage.Person, Place = clinic.tagPage.Place;
  const kinds = new Map([[Person.id, { kind: 'person', lead: 'dr.' }], [Place.id, { kind: 'place', lead: null }]]);
  test('a tag\'s kind and lead word from its pages\' titles', () => {
    assert.deepEqual(peopleLib.kindOfTitles([{ title: 'Dr. Mei Chen', kind: 'person' }, { title: 'Dr. Raj Patel', kind: 'person' }, { title: 'Dr. Ada Okafor', kind: 'person' }, { title: 'Nurse Ruth', kind: null }]), { kind: 'person', lead: 'dr.' });
    assert.deepEqual(peopleLib.kindOfTitles([{ title: 'Fatigue', kind: null }, { title: 'Nausea', kind: null }]), { kind: null, lead: null });
  });
  test('a person no page has, pencilled as a new page in the property that takes a person, with the lead word; a place likewise', () => {
    const b = visit('Saw Dr. Okafor at St Mary\'s about the scan'), result = propose(C, b);
    const found = [{ text: 'Okafor', kind: 'person', at: 8, to: 14 }, { text: 'St Mary\'s', kind: 'place', at: 18, to: 27 }];
    const got = peopleLib.pieces(C, b, result, found, kinds);
    assert.deepEqual(got.map(p => [p.prop.title, p.shown, p.newPage.tag.title, p.how]), [['Provider', 'Dr. Okafor', 'Person', 'names'], ['Where', 'St Mary\'s', 'Place', 'names']]);
    assert.ok(got.every(p => p.guess && p.ids.length === 0));
    const joined = peopleLib.pieces(C, b, result, [{ text: 'Saw Dr. Okafor', kind: 'person', at: 0, to: 14 }], kinds);
    assert.equal(joined[0]?.shown, 'Dr. Okafor', 'the tag\'s lead word inside the found name starts the title');
    const noLead = new Map([[Person.id, { kind: 'person', lead: null }]]);
    const v = visit('Visit Nadia Okafor about the scan'), verb = peopleLib.pieces(C, v, propose(C, v), [{ text: 'Visit Nadia Okafor', kind: 'person', at: 0, to: 18 }], noLead);
    assert.equal(verb[0]?.shown, 'Nadia Okafor', 'a first word the graph\'s lines use as a word, and no page holds, is dropped');
  });
  test('a name the graph has (whole, or a word of a name) is not a new page; two new people for one place say nothing', () => {
    const b = visit('Saw Dr. Chen about the scan'), result = propose(C, b);
    assert.deepEqual(peopleLib.pieces(C, b, result, [{ text: 'Chen', kind: 'person', at: 8, to: 12 }], kinds), [], 'Chen is a word of Dr. Mei Chen');
    const two = visit('Saw Dr. Okafor and Dr. Lindqvist'), r2 = propose(C, two);
    assert.deepEqual(peopleLib.pieces(C, two, r2, [{ text: 'Okafor', kind: 'person', at: 8, to: 14 }, { text: 'Lindqvist', kind: 'person', at: 23, to: 32 }], kinds).filter(p => p.prop.title === 'Provider'), []);
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
test('tuning picks limits that keep wrong guesses low on each graph', async () => {
  for (const g of [work, libros]) {
    const t = await tune(g.ctx, { sample: 500 });
    const after = t.after.properties;
    assert.ok(t.limits.nearLeast >= .2 && t.limits.lead >= .6);
    assert.ok(after.guessWrong <= Math.max(1, Math.ceil((after.guessRight + after.guessWrong) * .04)), JSON.stringify(after));
    console.log(`      tuned: nearLeast ${t.limits.nearLeast}, lead ${t.limits.lead}, tagNearLeast ${t.limits.tagNearLeast}`);
  }
});

section('Measuring Apple\'s model (core/measure.js, with pretend answers)');
const measureLib = require('../core/measure.js');
{
  const C = clinic.ctx, P = t => C.schema.props.find(p => p.title === t), mei = clinic.peoplePages.Person[0], ruth = clinic.peoplePages.Person[1];
  const note = {
    b: visit('Talked it over, she wants 5 mg from 9 Nov', { values: new Map([[P('Provider').ident, [mei.id]], [P('Dose').ident, [77001]]]) }),
    truth: new Map([[P('Provider').ident, { kind: 'ids', ids: [mei.id] }], [P('Dose').ident, { kind: 'number', number: 5 }]]),
    parent: 'Saw Dr. Mei Chen at the clinic', before: ['Slept badly'], pageTitle: '', day: 20261102,
  };
  const q = measureLib.questions(C, note);
  const full = q.props.find(x => x.way === 'range too'), named = q.props.find(x => x.way === 'named');
  const keyOf = (req, title) => req.fill.properties.find(p => p.title === title)?.key;
  test('asked as Predictive asks: each property described from the structure, the tag with the tags above it', () => {
    assert.deepEqual(q.props.map(x => x.way), ['named', 'range too']);
    const req = full.req, titles = req.fill.properties.map(p => p.title);
    assert.ok(titles.includes('Provider') && titles.includes('Dose'));
    assert.ok(!req.fill.context && !req.fill.model, 'from the note\'s words alone, Apple\'s model as it comes');
    const prov = req.fill.properties.find(p => p.title === 'Provider');
    assert.match(prov.about, /^Provider \(a Person\) of this Consultation note, from the choices/);
    assert.match(prov.about, /Its other properties are .*Dose/, 'says what else the note holds, so a name lands in its own place');
    assert.deepEqual(q.tags.map(x => x.way), ['all tags']);
    assert.ok(!/Earlier notes/.test(q.tags[0].req.fill.context) && /The kinds of note/.test(q.tags[0].req.fill.context), 'the tag question: the kinds and what each holds, no earlier lines');
    assert.ok(!JSON.stringify(req.fill).includes('77001'), 'what was written is never sent');
  });
  test('partly right is marked, and the values outside a property\'s range are counted from the whole graph', () => {
    const req = full.req, prov = keyOf(req, 'Provider');
    const many = { ...note, truth: new Map([[P('Provider').ident, { kind: 'ids', ids: [mei.id, ruth.id] }]]) };
    const [r] = measureLib.judge(C, many, req, { values: { [prov]: 'Dr. Mei Chen' } }).filter(x => x.key === prov);
    assert.equal(r.result, 'wrong'); assert.equal(r.partly, true);
    assert.deepEqual(measureLib.outsideRange(C), [], 'the clinic\'s values are all people and places as their properties take');
    const nurse = { id: 88002, uuid: synthetic.uuid(88002), title: 'Ward 4B', lower: 'ward 4b', tags: [{ id: 99, title: 'Ward' }], isTag: false };
    const entries = [...C.index.entries, { id: 88003, title: 'x', tokens: [], values: new Map([[P('Provider').ident, [nurse.id]]]) }];
    const O = { ...C, byId: new Map([...C.byId, [nurse.id, nurse]]), index: { ...C.index, entries } };
    const [o] = measureLib.outsideRange(O);
    assert.equal(o.name, 'Provider'); assert.equal(o.outside, 1); assert.deepEqual(o.byTag, [['Ward', 1]]);
    assert.match(measureLib.text(measureLib.tally([]), {}, null, [o]), /Provider takes Person: 1 of \d+ values are not, tagged Ward 1/);
  });
  test('answers judged against what was written: right, wrong, silent', () => {
    const req = full.req, prov = keyOf(req, 'Provider'), dose = keyOf(req, 'Dose');
    const by = r => Object.fromEntries(measureLib.judge(C, note, req, r).map(x => [req.fill.properties.find(p => p.key === x.key).title, x.result]));
    assert.equal(by({ values: { [prov]: 'Dr. Mei Chen', [dose]: 5 } }).Provider, 'right');
    assert.equal(by({ values: { [prov]: 'Dr. Mei Chen', [dose]: 5 } }).Dose, 'right');
    assert.equal(by({ values: { [prov]: 'Ruth Okoro' } }).Provider, 'wrong');
    assert.equal(by({ values: {} }).Provider, 'silent');
    assert.equal(by({ values: { [dose]: 50 } }).Dose, 'silent', 'a number the words do not hold is not kept, so it is silent');
    assert.ok(ruth);
  });
  test('a question with no answer is failed, not silent, and its reason is a name only', () => {
    const req = full.req;
    const said = 'exceededContextWindowSize(FoundationModels.LanguageModelSession.GenerationError.Context(debugDescription: "Talked it over, she wants"))';
    assert.ok(measureLib.judge(C, note, req, null, said).every(x => x.result === 'failed' || x.result === 'quiet'));
    assert.equal(measureLib.reason(said), 'exceededContextWindowSize');
    assert.equal(measureLib.reason('TimeoutError: signal timed out'), 'timed out');
    const rec = { tagTitle: 'Consultation', asked: q.asked, tags: [{ way: 'all tags', result: 'failed', size: 4100, error: said }],
      props: [full].map(({ way, req }) => ({ way, ms: 300, size: measureLib.size(req.fill), error: said, results: measureLib.judge(C, note, req, null, said) })) };
    const text = measureLib.text(measureLib.tally([rec]), {});
    assert.match(text, /failed \(no answer at all\)\s+0\s+2\n/);
    assert.match(text, /exceededContextWindowSize\s+0\s+1\s+1\s+0\s+0\n/);
    assert.ok(!text.includes('wants') && !text.includes('Talked'), 'nothing a reason carries after its name reaches the report');
    assert.ok(measureLib.size(req.fill) > 0);
  });
  test('a graph made for measuring, and only it, gets the details: the note\'s words, what was written and what was said', () => {
    assert.equal(measureLib.isTestGraph(C), false);
    assert.equal(measureLib.isTestGraph({ ...C, pages: [...C.pages, { title: 'Predictive test graph' }] }), true);
    const props = [full].map(({ way, req }) => ({ way, error: null, results: measureLib.judge(C, note, req, { values: { [keyOf(req, 'Provider')]: 'Ruth Okoro' } }) }));
    const d = measureLib.detailOf(C, note, q.asked, props, [{ result: 'silent', said: null }]);
    assert.equal(d.words, 'Talked it over, she wants 5 mg from 9 Nov');
    const prov = d.props.find(p => p.title === 'Provider');
    assert.equal(prov.wrote, 'Dr. Mei Chen');
    assert.deepEqual(prov.ways.map(w => [w.way, w.said, w.result]), [['range too', 'Ruth Okoro', 'wrong']]);
    const t = measureLib.tally([{ tagTitle: 'Consultation', asked: q.asked, props, tags: [] }]);
    assert.match(measureLib.text(t, {}, [d]), /"Talked it over, she wants 5 mg from 9 Nov" \(Consultation\)\n  Provider: wrote Dr\. Mei Chen · range too said Ruth Okoro \(wrong\)/);
    assert.ok(!measureLib.text(t, {}).includes('Talked'), 'without details, no words');
  });
  test('a second name (an alias) is offered and kept as its page', () => {
    const alias = { id: 88001, uuid: synthetic.uuid(88001), title: 'Dr. Chen', lower: 'dr. chen', tags: mei.tags, isTag: false, aliasOf: { id: mei.id, title: mei.title } };
    const A = { ...C, pages: [...C.pages, alias], byId: new Map([...C.byId, [alias.id, alias]]), byKey: new Map([...C.byKey, ['dr. chen', alias]]), aliases: [...(C.aliases || []), [mei.id, alias.id]] };
    delete A.names;
    const b = visit('Spoke with Dr. Chen about the sore mouth');
    const req = modelLib.request(A, b, propose(A, b), 20261102);
    const choices = req?.fill.properties.find(p => p.title === 'Provider')?.choices || [];
    assert.ok(!choices.includes('Dr. Chen'), 'the alias is never a choice of its own');
    assert.ok(!modelLib.rangePages(A, P('Provider'), new Set(P('Provider').classes.map(c => c.id)), new Set()).includes(alias));
    assert.deepEqual(modelLib.momentPages(A, 'Saw [[Dr. Chen]] yesterday', new Set(P('Provider').classes.map(c => c.id)), new Set()).map(p => p.title), ['Dr. Mei Chen']);
  });
  test('the report holds numbers and names, never a note\'s words', () => {
    const rec = { tagTitle: 'Consultation', asked: q.asked, tags: [], props: [full].map(({ way, req }) => ({ way, ms: 900, results: measureLib.judge(C, note, req, { values: { [keyOf(req, 'Provider')]: 'Dr. Mei Chen' } }) })) };
    rec.meaning = { tag: 'right', props: [{ title: 'Consultation · Provider', result: 'wrong' }], doubles: 1, named: 1 };
    const t = measureLib.tally([rec]);
    assert.equal(t.notes, 1);
    assert.equal(t.meaning.tag.right, 1); assert.equal(t.meaning.props.wrong, 1);
    assert.equal(t.ways['range too'].all.right, 1);
    const text = measureLib.text(t, { version: '0.3.13', helper: 2, date: '2026-11-05' });
    assert.match(text, /Consultation · Provider/);
    assert.match(text, /BY MEANING/); assert.match(text, /1 offered for a name/);
    for (const word of ['Talked', 'wants', 'Slept', 'clinic']) assert.ok(!text.includes(word), `no words of the note in the report: ${word}`);
  });
  test('named asks a page only when the words name it; what it does not ask is silent there, and both ways count the same properties', () => {
    const titles = named.req.fill.properties.map(p => p.title);
    assert.ok(!titles.includes('Provider') && titles.includes('Dose'), 'no doctor is named in the words, so Provider is not asked');
    assert.ok(full.req.fill.properties.some(p => p.title === 'Provider'), 'the old way still offers the pages Provider can take');
    const live = modelLib.request(C, { ...note.b, values: new Map() }, { pieces: [], record: null, quiet: [] }, 20261102);
    assert.equal(live, null, 'a result that is not the bullet\'s own asks nothing');
    const hidden = { ...note.b, values: new Map(), parent: null };
    const asLive = modelLib.request(C, hidden, { pieces: [], record: hidden, quiet: [] }, 20261102);
    assert.deepEqual(asLive.fill.properties.map(p => p.title), titles, 'the measure\'s named way is what Predictive asks');
    const dose = keyOf(named.req, 'Dose');
    const results = [...measureLib.judge(C, note, named.req, { values: { [dose]: 5 } }), ...measureLib.notAsked(note, full.req, named.req)];
    const prov = results.find(r => r.key === keyOf(full.req, 'Provider'));
    assert.equal(prov.result, 'silent'); assert.equal(prov.unasked, true);
    const rec = { tagTitle: 'Consultation', asked: q.asked, tags: [], props: [{ way: 'named', results }, { way: 'range too', results: measureLib.judge(C, note, full.req, { values: { [keyOf(full.req, 'Provider')]: 'Ruth Okoro', [keyOf(full.req, 'Dose')]: 5 } }) }] };
    const t = measureLib.tally([rec]);
    assert.deepEqual([t.ways.named.all.right, t.ways.named.all.wrong, t.ways.named.all.silent, t.ways.named.unasked], [1, 0, 1, 1]);
    assert.deepEqual([t.ways['range too'].all.right, t.ways['range too'].all.wrong], [1, 1]);
    assert.equal(t.questions, 2);
    assert.match(measureLib.text(t, {}), /PROPERTIES YOU FILLED\n\s+named\s+range too\nright\s+1 50%\s+1 50%\n  its 95% range\s+9–91%\s+9–91%/);
  });
  test('the share right comes with its range, and the tag is asked from the near notes\' tags both ways round', () => {
    assert.equal(measureLib.range(22, 40), '40–69%'); assert.equal(measureLib.range(0, 0), '–');
    const tags = [...C.knownTags].slice(0, 3), own = note.b.tags[0];
    const near = [{ entry: { values: new Map([['block/tags', [own]]]) }, sim: .9 }, { entry: { values: new Map([['block/tags', [tags.find(id => id !== own)]]]) }, sim: .5 }];
    const short = measureLib.nearTags(C, near);
    assert.equal(short[0], own, 'the nearest notes\' tag first');
    const three = measureLib.questions(C, note, { nearTags: short }).tags;
    assert.deepEqual(three.map(x => x.way), ['all tags', 'near tags', 'near, turned']);
    const a = three[1].req.fill.properties[0].choices, b = three[2].req.fill.properties[0].choices;
    assert.equal(a.length, 2); assert.deepEqual([...a].reverse(), b, 'the same short list, back to front');
    assert.equal(three[1].listed, true);
    const title = C.byId.get(own).title;
    const rec = { tagTitle: title, asked: [], props: [], tags: [{ way: 'all tags', result: 'wrong', said: 'x' }, { way: 'near tags', listed: true, result: 'right', said: title }, { way: 'near, turned', listed: true, result: 'right', said: title }] };
    const text = measureLib.text(measureLib.tally([rec]), {});
    assert.match(text, /The right tag was among them in 1 of 1 notes/);
    assert.match(text, /the same tag 1 times \(1 right, 0 wrong\), two different tags 0 times/);
  });
  test('what you would see while writing: every proposal together against what was written, sure and pencilled apart', () => {
    const provider = P('Provider'), dose = P('Dose');
    const seen = measureLib.judgeSeen(C, note, [
      { ident: provider.ident, kind: 'node', ids: [ruth.id], guess: true, how: 'model' },
      { ident: dose.ident, kind: 'number', ids: [5], how: 'words-number' },
    ]);
    const by = Object.fromEntries(seen.map(r => [r.title, r]));
    assert.deepEqual([by.Provider.result, by.Provider.sure, by.Provider.source], ['wrong', false, 'Apple’s model']);
    assert.deepEqual([by.Dose.result, by.Dose.sure, by.Dose.source], ['right', true, 'your words']);
    assert.ok(seen.some(r => r.result === 'quiet'), 'a property left empty and not proposed is counted as left empty');
    const text = measureLib.text(measureLib.tally([{ tagTitle: 'Consultation', asked: [], props: [], tags: [], seen }]), {});
    assert.match(text, /WHAT YOU WOULD SEE WHILE WRITING/);
    assert.match(text, /written when you leave\s+1\s+0\npencilled, a guess\s+0\s+1/);
    assert.match(text, /Apple’s model\s+0\s+1\s+0/);
    assert.match(text, /Consultation · Provider\s+0\/0\s+0\/1\s+0\s+0/, 'by property: written right/wrong, pencilled right/wrong, nothing, empty filled');
  });
}

(async () => {
  for (const task of queue) await task();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
