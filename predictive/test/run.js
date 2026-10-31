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
  assert.deepEqual(r.daysInWords('Bloods on Friday next week', written), [20261030]);
  assert.deepEqual(r.daysInWords('Next scan on Oct 3', written), [20271003]);
  assert.deepEqual(r.daysInWords('Scan on Dec 28 showed a shadow', 20270103), [20261228], 'across the new year');
  assert.deepEqual(r.daysInWords('Bloods on Oct 23', written), [20261023], 'today is today');
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

test('the pencil shows the year when it is not this year', () => {
  const year = new Date().getFullYear(), g = synthetic.work(), Meeting = g.tagPage.Meeting;
  const res = day => propose(g.ctx, bullet({ text: 'Sync about roadmap', tags: [Meeting.id], page: journal(g, day) })).pieces.find(p => p.kind === 'day').shown;
  assert.equal(res(year * 10000 + 1028), 'Oct 28');
  assert.equal(res((year + 1) * 10000 + 1028), `Oct 28, ${year + 1}`);
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
test('quiet inside [[ ]], after #, and for short lower-case words', () => {
  assert.equal(link.suggestFor('see [[Dr. Me', 12, pages), null);
  assert.equal(link.suggestFor('tagged #Dr', 10, pages), null);
  assert.equal(link.suggestFor('the', 3, pages), null);
});
test('a name the graph writes plain is not offered unless it is typed whole', () => {
  const rates = new Map([['meeting notes', { linked: 0, plain: 9 }]]);
  assert.equal(link.suggestFor('Read the meeting no', 19, pages, { rates }), null);
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
  const g = synthetic.work(), line = bullet({ text: 'Sync about database', page: journal(g, 20261028) });
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

(async () => {
  for (const task of queue) await task();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
