#!/usr/bin/env node
/* The leaning-down check (docs/LAYERS.md section 4, step 3; 0.4.313). A layer may use the layers below it, never the ones
   above and never its neighbours: a feature (layer 3) talks to Logseq only through layer 1 (main.js, parts/shared.js's
   plumbing, parts/model.js, parts/diagnostics.js), draws only through the kit, and finds nothing by a name on the
   window. This counts, in every loaded part outside layer 1 (PART_FILES in main.js):
     logseq    direct calls to Logseq (`logseq.` in the code, comments left out);
     sideways  reads of a name on the window other than the engine's own three (window.refinementShared,
               window.refinementParts, window.refinementCore): a part reaching another part, or a shared bag such as
               window.refinementTagMap or window.refinementProposals;
   and, over main.js and every loaded part,
     names     publications on the window (`window.x = `) beyond the engine's own three.
   The counts must be exactly the baseline below: a count above it fails (a part leaned where it must not), and a count
   below it fails too, with the word to lower the baseline, so the baseline is always the truth and only ever goes
   down. It started at the true count when the first feature was moved (0.4.312).
   Run from the repo root: node tools/leaning-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const LAYER_1 = ['main.js', 'parts/shared.js', 'parts/model.js', 'parts/diagnostics.js'];
const OWN_NAMES = ['refinementShared', 'refinementParts', 'refinementCore'];
// The baseline: lower a number here when a part is moved onto the kit, never raise one.
const BASELINE = {
  logseq: {
    'parts/two-way.js': 0, 'parts/alike.js': 0,
    'parts/shadow-rules.js': 0,
  },
  sideways: {
    'parts/two-way.js': 0, 'parts/alike.js': 0,
    'parts/shadow-rules.js': 0,
  },
  names: 0,
};

const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const PART_FILES = fs.readFileSync(path.join(root, '..', 'files.js'), 'utf8').match(/threads\/parts\/[a-z-]+\.js/g).map(file => file.replace(/^threads\//, ''));
const features = PART_FILES.filter(file => !LAYER_1.includes(file));
// The code without its comments (a // inside a string, as in a web address, is kept: only a // after a space or at the start of a line counts).
const code = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const count = (text, re) => (text.match(re) || []).length;

const problems = [];
const lines = [];
const found = { logseq: {}, sideways: {}, names: 0 };
for (const file of features) {
  const text = code(file);
  found.logseq[file] = count(text, /\blogseq\./g);
  found.sideways[file] = (text.match(/window\.(refinement[A-Za-z]*)/g) || []).map(m => m.replace('window.', '')).filter(name => !OWN_NAMES.includes(name)).length;
}
const published = new Map(); // name → the files that publish it
for (const file of ['main.js', ...PART_FILES]) for (const m of code(file).matchAll(/window\.([A-Za-z_$][\w$]*)\s*(?:\|\||\?\?)?=[^=]/g)) if (!OWN_NAMES.includes(m[1])) published.set(m[1], [...(published.get(m[1]) || []), file.replace('parts/', '')]);
found.names = published.size;

for (const kind of ['logseq', 'sideways']) {
  for (const file of features) {
    const want = BASELINE[kind][file], got = found[kind][file];
    if (want === undefined) { problems.push(`${file} is loaded but has no baseline for ${kind}: add it`); continue; }
    if (got > want) problems.push(`${file} leans where it must not: ${got} ${kind === 'logseq' ? 'direct Logseq calls' : 'reads of a name on the window'} (the baseline is ${want})`);
    else if (got < want) problems.push(`${file} leans less than its baseline (${got} ${kind}, baseline ${want}): lower the baseline in tools/leaning-test.js`);
  }
  for (const file of Object.keys(BASELINE[kind])) if (!features.includes(file)) problems.push(`${file} has a baseline for ${kind} but is not loaded: remove it`);
}
if (found.names > BASELINE.names) problems.push(`${found.names} names on the window beyond the engine's own (the baseline is ${BASELINE.names}): ${[...published].map(([name, files]) => `${name} (${files.join(', ')})`).join(', ')}`);
else if (found.names < BASELINE.names) problems.push(`${found.names} names on the window, fewer than the baseline ${BASELINE.names}: lower it in tools/leaning-test.js`);

const total = kind => Object.values(found[kind]).reduce((a, b) => a + b, 0);
lines.push(`  direct Logseq calls outside layer 1: ${total('logseq')}` + (total('logseq') ? ` (${features.filter(f => found.logseq[f]).map(f => `${f.replace('parts/', '')} ${found.logseq[f]}`).join(', ')})` : ''));
lines.push(`  parts reaching sideways: ${total('sideways')}` + (total('sideways') ? ` (${features.filter(f => found.sideways[f]).map(f => `${f.replace('parts/', '')} ${found.sideways[f]}`).join(', ')})` : ''));
lines.push(`  names on the window beyond the engine's three: ${found.names}` + (found.names ? ` (${[...published.keys()].join(', ')})` : ''));
for (const line of lines) console.log(line);
for (const text of problems) console.log('PROBLEM: ' + text);
console.log(problems.length ? `leaning-test: FAILED (${problems.length})` : 'leaning-test: OK (every count at its baseline)');
process.exit(problems.length ? 1 : 0);
