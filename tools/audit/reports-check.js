#!/usr/bin/env node
/* node reports-check.js <plugin folder>   Goalpost line 7.6: nothing the owner has already reported can come back unseen.
   reports.json lists the faults the owner pointed at, each with the check that guards it: a file and words that must stand in
   it. A report with no check named, or whose words are no longer in its file, fails the line and is named. The list is kept by
   hand: a new report is a new entry, and it fails here until a check is written and named for it. */
const fs = require('node:fs'), path = require('node:path');
const plugin = path.resolve(process.argv[2] || '.'), HERE = __dirname;
const { reports } = JSON.parse(fs.readFileSync(path.join(HERE, 'reports.json'), 'utf8'));
const open = [];
for (const r of reports) {
  let why = '';
  if (!r.by) why = 'no check guards it yet';
  else { const file = r.by[0].startsWith('proof:') ? path.join(HERE, r.by[0].slice(6)) : path.join(plugin, r.by[0]); if (!fs.existsSync(file)) why = `${r.by[0]} is gone`; else if (!fs.readFileSync(file, 'utf8').toLowerCase().includes(r.by[1].toLowerCase())) why = `${r.by[0]} no longer holds “${r.by[1]}”`; }
  console.log(`${why ? 'FAIL' : 'ok  '} ${r.when}: ${r.said}${why ? '  ← ' + why : '  ← ' + r.by[0]}`);
  if (why) open.push(r);
}
console.log('RESULT ' + JSON.stringify({ '7.6': { ok: !open.length && reports.length >= 20, said: open.length ? `${open.length} of ${reports.length} faults you reported have no check of their own yet: ${open.slice(0, 5).map(r => r.said).join('; ')}` : `each of the ${reports.length} faults reported since 3 November has a check that would catch it coming back` } }));
process.exit(open.length ? 1 : 0);
