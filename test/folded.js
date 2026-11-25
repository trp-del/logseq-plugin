/* node test/folded.js
   The folded note says the same plain things in the same order wherever it stands (look/logseq/folded.js): the tasks under it, done
   of all; pictures, quotes, PDFs, files; up to three tags; the nearest due day last. The owner, 24 November 2026, of the note made
   to fit its place two days before: "does not seem to know what to show … return to original version of it showing todos, etc".
   So nothing here depends on where the bullet stands, and the bullet's own properties and the lines under it are never said. */
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { ROOT, doorWith } = require('./ground.js');

const door = doorWith({});
const frame = { PluginDoor: door, Look: { kit: {}, settings: {} } }; frame.window = frame;
const context = vm.createContext({ window: frame, console, setTimeout, clearTimeout, Promise, Date });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'look/logseq/folded.js'), 'utf8'), context, { filename: 'folded.js' });
const { wordsFor } = frame.Look.folded;
const soon = new Date(); soon.setDate(soon.getDate() + 3);
const due = door.dates.number(soon), dueWords = 'due ' + door.dates.words(due, { year: false });
const base = { task: 0, done: 0, files: [], quotes: 0, tags: [], due: 0 };
const held = more => ({ ...base, ...more });
let n = 0;
const check = (name, got, want) => { assert.deepEqual(JSON.parse(JSON.stringify(got)), JSON.parse(JSON.stringify(want)), name); n++; };

check('unfinished tasks, pictures, then three tags', wordsFor(held({ task: 1, files: [['image', 2]], tags: ['A', 'B', 'C', 'D'] })), ['1 unfinished task under it', '2 pictures', 'A', 'B', 'C']);
check('done of all once one is done', wordsFor(held({ task: 1, done: 1 })), ['1 of 2 tasks under it done']);
check('pictures, quotes, PDFs, files in that order', wordsFor(held({ quotes: 1, files: [['file', 1], ['pdf', 2], ['image', 3]] })), ['3 pictures', '1 quote', '2 PDFs', '1 file']);
check('the due day is last, a task waiting or not', wordsFor(held({ task: 1, due, tags: ['Bill'] })), ['1 unfinished task under it', 'Bill', dueWords]);
// Where the bullet stands changes nothing: a place handed in is not read, and a property or a line under the node is never said.
const full = held({ task: 2, tags: ['Insomnia', 'Fatigue'], due, facts: [{ name: 'Doctor', value: 'Dr. Mei Chen' }], lines: ['Fatigue after the long walk'], match: 'Fatigue after the long walk' });
check('the same words whatever the place', wordsFor(full, { says: ['Insomnia'], match: ['fatigue'], typed: 'mei' }), wordsFor(full));
check('no property and no line under it', wordsFor(full), ['2 unfinished tasks under it', 'Insomnia', 'Fatigue', dueWords]);
console.log(`  ok  the folded note says the same plain things everywhere (${n} cases)`);
