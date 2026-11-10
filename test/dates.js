/* node test/dates.js
   The one date service (PluginDoor.dates in plugin.js, 10 November 2026; Predictive and Threads each named a journal's title,
   and Find, Threads, Structure and Look each put a day in words by a rule of their own). A date rule kept anywhere else in the
   running code fails this run and is named with its line. Then the service itself: a day in words, a journal's title in each of
   Logseq's formats, the title and the page of a day, against a pretend Logseq. */
const assert = require('node:assert/strict');
const { files, strays, fail, doorWith } = require('./ground.js');
// Pure code that runs in Node without the door keeps what it needs: Predictive's reader of typed days in any language, and the
// export's document formats, which follow the reader's locale and are part of the page it makes.
const pure = file => !/^(?:predictive|export|structure)\/core\//.test(file);

let found = strays(/'[Jj]an(?:uary)?',\s*'[Ff]eb|'[Ss]un(?:day)?',\s*'[Mm]on/, { only: pure });
if (found.length) fail('month or weekday names listed outside the door (take them from PluginDoor.dates)', found);
found = strays(/preferredDateFormat|getUserConfigs/, { only: pure });
if (found.length) fail('the graph’s date format read outside the door (ask PluginDoor.dates.format, titleFor or pageFor)', found);
found = strays(/toLocaleDateString|Intl\.DateTimeFormat/, { only: pure });
if (found.length) fail('a day put in words by a rule of its own (use PluginDoor.dates.words)', found);
found = strays(/getFullYear\(\) \* 10000/, { only: pure });
if (found.length) fail('a day’s number worked out outside the door (use PluginDoor.dates.number or today)', found);
found = strays(/:block\/journal-day \$\{/, { only: pure, allow: {
  // Structure's Apply makes a day's page by Logseq's own journal call and keeps the page's id, which its Undo needs to take the page
  // back. Its two look-ups stay with it.
  'structure/logseq/db.js': 2,
} });
if (found.length) fail('a journal page looked up by its day outside the door (use PluginDoor.dates.titleFor or pageFor)', found);
console.log(`  ok  no file of ${files.length} keeps a date rule of its own`);

(async () => {
  let format = 'MMM do, yyyy', asked = 0; const made = [], journals = new Map([[20261019, [44, 'Oct 19th, 2026']]]);
  const logseq = { App: { getUserConfigs: async () => { asked++; if (format === 'fail') throw new Error('no configs'); return { preferredDateFormat: format }; } },
    Editor: { createPage: async (title, props, opts) => { made.push({ title, opts }); return { id: 9000 + made.length }; } },
    DB: { datascriptQuery: async q => { const day = Number(/journal-day (\d+)/.exec(q)?.[1]), hit = journals.get(day); return !hit ? [] : /pull/.test(q) ? [[{ id: hit[0] }]] : [[hit[1]]]; } } };
  const D = doorWith(logseq).dates, year = new Date().getFullYear();

  // A day in words: one rule. This year's has no year; another year's says it after a comma.
  const thisYear = year * 10000 + 1023, lastYear = (year - 1) * 10000 + 805;
  assert.equal(D.words(thisYear), 'Oct 23'); assert.equal(D.words(lastYear), `Aug 5, ${year - 1}`); assert.equal(D.words(lastYear, { year: false }), 'Aug 5');
  assert.equal(D.words(thisYear, { year: 'always' }), `Oct 23, ${year}`); assert.equal(D.words(0), ''); assert.equal(D.words(null), '');
  assert.equal(D.month(year * 100 + 10), 'Oct'); assert.equal(D.month((year - 1) * 100 + 1), `Jan ${year - 1}`);
  assert.equal(D.number(new Date(2026, 9, 23)), 20261023); assert.equal(D.date(20261023).getMonth(), 9); assert.equal(D.today(), D.number(new Date()));
  assert.equal(D.MONTHS.length, 12); assert.equal(D.WEEKDAYS[0], 'Sunday');
  console.log('  ok  a day in words: "Oct 23", and "Aug 5, ' + (year - 1) + '" for another year');

  // A journal's title in Logseq's formats.
  const d = new Date(2026, 9, 19);
  for (const [f, want] of [['MMM do, yyyy', 'Oct 19th, 2026'], ['E, dd.MM.yyyy', 'Mon, 19.10.2026'], ['yyyyMMdd', '20261019'], ['EEEE, MMMM do', 'Monday, October 19th'], ['yyyy-MM-dd', '2026-10-19']]) assert.equal(D.title(d, f), want, f);
  assert.equal(D.title(new Date(2026, 0, 5), 'dd-MM-yy'), '05-01-26'); assert.equal(D.title(new Date(2026, 0, 5), 'M/d/yyyy'), '1/5/2026'); assert.equal(D.title(d), 'Oct 19th, 2026');
  for (const [n, want] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st']]) assert.equal(D.title(new Date(2026, 0, n), 'do'), want);
  console.log('  ok  a journal’s title in each of Logseq’s date formats');

  // The title of a day: the page's own when the graph has it, else as the graph's format will name it; read afresh for another graph.
  journals.set(20261018, [43, 'Sunday the 18th']);
  assert.equal(await D.titleFor(20261018), 'Sunday the 18th', 'an existing journal keeps the title it has');
  assert.equal(await D.titleFor(20261020), 'Oct 20th, 2026');
  assert.equal(await D.titleFor(20261021), 'Oct 21st, 2026'); assert.equal(asked, 1, 'the format is not asked for again within the second');
  format = 'yyyy-MM-dd'; D.forget(); assert.equal(await D.titleFor(20261020), '2026-10-20', 'another graph, another format');
  format = 'fail'; D.forget(); assert.equal(await D.titleFor(20261020), 'Oct 20th, 2026', 'the configs cannot be read: Logseq’s own default');
  const mine = async q => /20261101/.test(q) ? [['From the caller']] : [];
  assert.equal(await D.titleFor(20261101, mine), 'From the caller', 'a module’s own query call is used when given');
  console.log('  ok  a day’s title is its page’s own, else the graph’s format');

  // The page of a day: found when it is there, made once when it is not, as a journal and without leaving the page.
  format = 'MMM do, yyyy'; D.forget();
  assert.equal(await D.pageFor(20261019), 44); assert.equal(made.length, 0, 'nothing is made for a day the graph has');
  const id = await D.pageFor(20261020); assert.ok(id > 9000);
  assert.equal(JSON.stringify(made), JSON.stringify([{ title: 'Oct 20th, 2026', opts: { redirect: false, createFirstBlock: false, journal: true } }]));   // by what it holds: the door's context made it
  await D.pageFor(20261022, undefined, 'Given by the caller'); assert.equal(made[1].title, 'Given by the caller');
  console.log('  ok  a day’s journal page is found, or made once in the graph’s format');
  console.log('dates: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.stack || error)); process.exit(1); });
