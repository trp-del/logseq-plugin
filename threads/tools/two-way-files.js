/* The two-way part's files for the tests that load it apart from the plugin: parts/two-way.js (the part) and its pieces in
   parts/two-way/, in the order the plugin's files.js loads them, so a piece added there is loaded here too.
     sources(changeEntry)   the files' words, the part's own first (changeEntry, if given, rewrites it: a test reaching inside)
     text()                 all of them as one text, for the checks that read the code
     reach(names)           a script that puts twoWay's names on the window as window.__name, once the files have run */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = fs.readFileSync(path.join(root, '..', 'files.js'), 'utf8').match(/threads\/parts\/two-way(\/[a-z-]+)?\.js/g).map(file => file.replace(/^threads\//, ''));
if (files[0] !== 'parts/two-way.js' || files.length < 2) throw new Error('files.js does not list parts/two-way.js before its pieces');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sources = (changeEntry = text => text) => files.map((file, i) => i === 0 ? changeEntry(read(file)) : read(file));
const text = () => sources().join('\n');
const reach = names => `{ const twoWay = window.Threads.parts.find(part => part.name === 'two-way').inner; ${names.map(n => `window.__${n} = twoWay.${n};`).join(' ')} }`;
module.exports = { files, sources, text, reach };
