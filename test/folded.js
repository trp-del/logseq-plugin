/* node test/folded.js
   The folded note's four rules (0.5, E; look/logseq/folded.js): what the note says of a folded node, given what it holds and the place
   it is shown in. 1 nothing the place already says; 2 what waits comes first; 3 the tag picks the facts (the node's own filled
   properties, the first two, where the place does not show them); 4 after Find, the line beneath that holds the words. */
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { ROOT, doorWith } = require('./ground.js');

const door = doorWith({});
const frame = { PluginDoor: door, Look: { kit: {}, settings: {} } }; frame.window = frame;
const context = vm.createContext({ window: frame, console, setTimeout, clearTimeout, Promise, Date });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'look/logseq/folded.js'), 'utf8'), context, { filename: 'folded.js' });
const { wordsFor } = frame.Look.folded;
const day = d => door.dates.number(d);
const soon = new Date(); soon.setDate(soon.getDate() + 3);
const base = { task: 0, done: 0, files: [], quotes: 0, tags: [], due: 0, facts: [], lines: [] };
const held = more => ({ ...base, ...more });
let n = 0;
const check = (name, got, want) => { assert.deepEqual(JSON.parse(JSON.stringify(got)), want, name); n++; };

// 1. Nothing the place already says: a tag that is the page's own name, or the list's kind.
check('a tag the page is named by is left out', wordsFor(held({ tags: ['Insomnia', 'Fatigue'] }), { says: ['Insomnia'] }), ['Fatigue']);
check('a fact whose value the page is named by is left out', wordsFor(held({ facts: [{ name: 'Doctor', value: 'Dr. Mei Chen' }, { name: 'Date', value: 'Nov 10' }] }), { says: ['dr. mei chen'] }), ['Date Nov 10']);
check('a fact the node\u2019s own words hold is left out', wordsFor(held({ facts: [{ name: 'From', value: 'Chase Checking' }, { name: 'To', value: 'Amex Gold' }] }), { says: [], words: 'Paid off the Amex Gold card' }), ['From Chase Checking']);
check('a fact holding what is typed in Find is left out', wordsFor(held({ facts: [{ name: 'Provider', value: 'Dr. Mei Chen' }, { name: 'Date', value: 'Oct 14' }] }), { says: [], typed: 'mei chen', words: 'Cycle 4 delayed a week' }), ['Date Oct 14']);
check('a fact the row\u2019s day says is left out', wordsFor(held({ facts: [{ name: 'Date', value: 'Oct 14' }] }), { says: [], words: 'Oct 14 Cycle 4 delayed a week' }), []);
check('a fact the page title holds is left out (the title runs on into its tag)', wordsFor(held({ facts: [{ name: 'Provider', value: 'Dr. Mei Chen' }, { name: 'Date', value: 'Oct 14' }] }), { says: ['Dr. Mei ChenDoctor'], words: 'Cycle 4 delayed a week' }), ['Date Oct 14']);
// 2. What waits comes first: the due day of an unfinished task leads; with nothing unfinished it stays last.
const due = day(soon), dueWords = 'due ' + door.dates.words(due, { year: false });
check('the due day leads while a task waits', wordsFor(held({ task: 1, due, tags: ['Bill'] }), { says: [] })[0], dueWords);
check('the due day is last when no task waits', wordsFor(held({ due, tags: ['Bill'] }), { says: [] }), ['Bill', dueWords]);
// 3. The tag picks the facts: the node's own properties, in the order given (its tag's), the first two; none where the place shows them.
const facts = [{ name: 'Doctor', value: 'Dr. Mei Chen' }, { name: 'Date', value: 'Nov 10' }, { name: 'Place', value: 'Clinic' }];
check('the first two facts, in the tag’s order', wordsFor(held({ facts, task: 2 }), { says: [] }), ['Doctor Dr. Mei Chen', 'Date Nov 10', '2 unfinished tasks under it']);
check('no facts where the place shows the properties', wordsFor(held({ facts, task: 2 }), { says: [], facts: true }), ['2 unfinished tasks under it']);
// 4. After Find: the first line beneath that holds every word given, in quotes, after what waits and before the facts.
const lines = ['Slept badly again', 'Fatigue after the long walk', 'Fatigue and headache'];
check('the line holding the words', wordsFor(held({ lines, facts }), { says: [], match: ['fatigue', 'walk'] }).slice(0, 2), ['“Fatigue after the long walk”', 'Doctor Dr. Mei Chen']);
check('no line when none holds every word', wordsFor(held({ lines }), { says: [], match: ['fatigue', 'swim'] }), []);
check('no line without words', wordsFor(held({ lines }), { says: [] }), []);
// Unchanged: what the note said before 0.5 for a node with no facts or words.
check('as before: tasks, pictures, tags', wordsFor(held({ task: 1, files: [['image', 2]], tags: ['A', 'B', 'C', 'D'] }), { says: [] }), ['1 unfinished task under it', '2 pictures', 'A', 'B', 'C']);
console.log(`  ok  the folded note's four rules (${n} cases)`);
