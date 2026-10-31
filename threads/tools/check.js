// Syntax check for one plugin file, run by tools/check.sh with JavaScriptCore:
//   jsc tools/check.js -- <file>
// The file is wrapped in a function so that its top-level declarations and the `logseq` and
// `window` globals resolve; nothing in it is run.
const file = arguments[0];
let src;
try { src = readFile(file); } catch (e) { print('ERROR ' + file + ': cannot read'); quit(1); }
try { new Function('logseq', 'window', src); print('OK ' + file); } catch (e) { print('ERROR ' + file + ': ' + e); quit(1); }
