// Loads the core files into one window, as loader.js does in Logseq, with no Logseq and no screen. Used by the core
// tests and by hand: node -e "const S = require('./test/run-core.js'); ..."
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const window = {}; window.window = window;
const sandbox = { window, console, Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp };
vm.createContext(sandbox);
const { root, order } = require('../../test/module.js')('structure');
const files = order.filter(file => file.startsWith('structure/core/'));
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
module.exports = window.Structure;
