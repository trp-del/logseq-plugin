#!/usr/bin/env node
/* The stack, checked. Run from the plugin's folder: node tools/layers.js
   1. files.js lists every file of the stack, each once, lower layers first.
   2. A file uses only what its own layer or a layer under it gives (G.<name>).
   3. The deciding pieces (core/) know nothing of Logseq or of a screen.
   4. Only the ground and the frame call Logseq's plugin API.
   5. Only ground/touch.js names Logseq's own markup.
   6. The one list of writes (G.write in ground/write.js) gives each name once: a name given twice is not an error to
      JavaScript, the second silently takes the place of the first (newPage stood there twice, 27 November 2026). */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const LAYERS = ['plugin.js', 'core/', 'ground/', 'node/', 'page/', 'arrive/', 'write/', 'tend/', 'beside/', 'main.js'];
const layerOf = file => LAYERS.findIndex(l => l.endsWith('/') ? file.startsWith(l) : file === l);
const listed = (() => { const window = {}; new Function('window', fs.readFileSync(path.join(root, 'files.js'), 'utf8'))(window); return window.PluginFiles; })();
const faults = [];
const onDisk = LAYERS.flatMap(l => l.endsWith('/') ? (fs.existsSync(path.join(root, l)) ? fs.readdirSync(path.join(root, l)).filter(f => f.endsWith('.js')).map(f => l + f) : []) : [l]);
for (const file of onDisk) if (!listed.includes(file)) faults.push(`${file} is not in files.js`);
for (const file of listed) if (!onDisk.includes(file)) faults.push(`files.js lists ${file}, which is not there`);
if (new Set(listed).size !== listed.length) faults.push('files.js lists a file twice');
// Every file reads as code: a slip that would stop a part from starting is caught here, in a second, not in Logseq.
for (const file of listed.filter(one => onDisk.includes(one))) { try { new Function(fs.readFileSync(path.join(root, file), 'utf8')); } catch (error) { faults.push(`${file} does not read as code: ${error.message}`); } }
let high = -1;
for (const file of listed) { const l = layerOf(file); if (l < 0) faults.push(`${file} stands in no layer`); if (l < high) faults.push(`${file} loads after a file of a higher layer`); high = Math.max(high, l); }
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const gives = new Map();   // name -> lowest layer giving it
const sources = new Map(listed.filter(f => fs.existsSync(path.join(root, f))).map(f => [f, strip(fs.readFileSync(path.join(root, f), 'utf8'))]));
for (const [file, text] of sources) {
  for (const m of text.matchAll(/\bG\.(\w+)\s*=[^=]/g)) gives.set(m[1], Math.min(gives.get(m[1]) ?? 99, layerOf(file)));
  for (const m of text.matchAll(/PluginDoor \|\|= \{\}\)\.(\w+) =/g)) gives.set(m[1], Math.min(gives.get(m[1]) ?? 99, layerOf(file)));
}
for (const [file, text] of sources) {
  const mine = layerOf(file);
  for (const m of text.matchAll(/\bG\.(\w+)/g)) { const from = gives.get(m[1]); if (from == null) faults.push(`${file} uses G.${m[1]}, which nothing gives`); else if (from > mine) faults.push(`${file} uses G.${m[1]}, which comes from a layer above it`); }
  if (file.startsWith('core/') && /\blogseq\b|window\.parent|\bdocument\b|G\.host/.test(text)) faults.push(`${file} is a deciding piece and must not know Logseq or a screen`);
  if (!/^(ground\/|plugin\.js$|main\.js$)/.test(file) && /\blogseq\.\w/.test(text)) faults.push(`${file} calls Logseq's API; only the ground may`);
  if (file !== 'ground/touch.js' && /['"`.#\s](ls-[a-z]|cp__|ui__|blockid|block-content|block-control|right-sidebar|main-content-container|journal-item|breadcrumb)/.test(text)) faults.push(`${file} names Logseq's own markup; only ground/touch.js may`);
}
// Each write stands at the start of a line of the list, two spaces in: its name, then ( or :.
{ const lines = fs.readFileSync(path.join(root, 'ground/write.js'), 'utf8').split('\n'), from = lines.findIndex(line => /^G\.write = \{/.test(line)), to = lines.findIndex((line, i) => i > from && /^\};/.test(line)), at = new Map();
  if (from < 0 || to < 0) faults.push('ground/write.js: the list of writes (G.write = { … };) was not found, so its names could not be checked');
  for (let i = from + 1; i < to; i++) { const name = (lines[i].match(/^  (?:async\s+)?([A-Za-z_$][\w$]*)\s*[(:]/) || [])[1]; if (name && !/^(if|for|while|switch|return|catch|function)$/.test(name)) at.set(name, [...(at.get(name) || []), i + 1]); }
  if (from >= 0 && to >= 0 && !at.size) faults.push('ground/write.js: no write was found in the list of writes, so its names could not be checked');
  for (const [name, where] of at) if (where.length > 1) faults.push(`ground/write.js gives the write ${name} ${where.length} times (lines ${where.join(' and ')}): the last one silently takes the place of the others`); }
if (faults.length) { console.log('The stack does not hold:\n  ' + [...new Set(faults)].join('\n  ')); process.exit(1); }
console.log(`The stack holds: ${listed.length} files, each using only what stands under it.`);
