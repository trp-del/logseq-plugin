/* What the checks of the shared groundwork have in common (test/base.js, watcher.js, screen.js, dates.js, helpers.js, 10 November
   2026): the plugin's running files, their lines with the comments left out, a search for strays, and the door loaded against a
   pretend Logseq. Not a check itself. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const listed = fs.readFileSync(path.join(ROOT, 'files.js'), 'utf8').match(/'[a-z/-]+\.js'/g).map(s => s.slice(1, -1));
// Every file Logseq loads, the door itself left out: the door is where each of these things may be.
const files = [...new Set(['main.js', 'loader.js', ...listed])].filter(f => f !== 'plugin.js' && fs.existsSync(path.join(ROOT, f)));
// A file's lines with its comments blanked, so a thing named only in a comment is not found.
const linesOf = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n').map(line => line.replace(/(^|[\s;{}])\/\/.*$/, '$1'));
// Every line of the running code that matches, as "file:line  what"; allow: { file: how many are let be }, each with its reason beside it.
function strays(pattern, { allow = {}, only = () => true } = {}) {
  const found = [], counts = {};
  for (const file of files.filter(only)) linesOf(file).forEach((line, i) => { const m = pattern.exec(line); if (m) { counts[file] = (counts[file] || 0) + 1; found.push(`${file}:${i + 1}  ${m[0]}`); } });
  const over = found.filter(hit => { const file = hit.split(':')[0]; return (counts[file] || 0) > (allow[file] || 0); });
  const gone = Object.keys(allow).filter(file => (counts[file] || 0) < allow[file]).map(file => `${file}: ${counts[file] || 0} found where ${allow[file]} are let be: lower the number`);
  return [...over, ...gone];
}
function fail(what, list) { console.log(`FAIL  ${what}:\n  ` + list.join('\n  ')); process.exit(1); }
// The door, run in a context of its own. With a window (jsdom's), it is Logseq's page and the plugin's frame's parent.
function doorWith(logseq, win = null, extra = {}) {
  const frame = { parent: win || undefined }; frame.window = frame;
  const context = vm.createContext({ window: frame, logseq, console: extra.console || console, setTimeout, clearTimeout, encodeURIComponent, Promise, Date, ...extra });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plugin.js'), 'utf8'), context, { filename: 'plugin.js' });
  return frame.PluginDoor;
}
function jsdom(html = '<html><head></head><body></body></html>') {
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
  return new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' }).window;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = { ROOT, files, linesOf, strays, fail, doorWith, jsdom, sleep };
