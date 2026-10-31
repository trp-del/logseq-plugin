/* The plugin's marks on Logseq's screen, for the tests that run outside the plugin: the two patterns of the kit's one
   finder (parts/shared.js, MARK_CLASS and MARK_ATTR), read from its source so there is one definition. Used by
   tools/boot-test.js (leftovers), tools/frames.js and tools/app-frames.js (what the ledger tracks). */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../parts/shared.js'), 'utf8');
const line = src.match(/const MARK_CLASS = (\/.*?\/), MARK_ATTR = (\/.*?\/);/);
if (!line) throw new Error('MARK_CLASS and MARK_ATTR not found in parts/shared.js');
const regex = text => new RegExp(text.slice(1, text.lastIndexOf('/')));
module.exports = { MARK_CLASS: regex(line[1]), MARK_ATTR: regex(line[2]) };
