// Loads the core files and the sample into one window, like the plugin does. Used by the core tests and by hand.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const window = {}; window.window = window;
const sandbox = { window, console, Date, Map, Set, URL, JSON, Math, Number, String, Array, Object, RegExp, encodeURI };
vm.createContext(sandbox);
for (const f of ['core/inline.js', 'core/dates.js', 'core/doc.js', 'core/markdown.js', 'core/html.js', 'core/themes.js', 'test/sample.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
module.exports = window.DbExport;
