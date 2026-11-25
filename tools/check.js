#!/usr/bin/env node
/* The one check. Run from your copy of the plugin:
     node tools/check.js            the pieces that decide (no Logseq), the stack's layering, then the walk in a real Logseq
     node tools/check.js --quick    the first two only: a second or two, while working
   It passes on an unchanged plugin, so a failure is about the change: mend the plugin, never the check. */
const { spawnSync } = require('node:child_process'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..'), quick = process.argv.includes('--quick'), t0 = Date.now();
const run = (name, args) => { const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }); const out = (r.stdout + r.stderr).trim(); return { name, ok: r.status === 0, out }; };
const results = [run('pieces', ['--test', 'test/']), run('stack', ['tools/layers.js'])];
if (!quick && results.every(r => r.ok)) results.push(run('walk', ['tools/walk.js']));
for (const r of results) {
  if (r.ok) console.log(`ok    ${r.name}: ${r.name === 'pieces' ? (r.out.match(/ℹ pass (\d+)/) || [])[1] + ' checks of the deciding pieces' : r.out.split('\n').pop()}`);
  else console.log(`FAIL  ${r.name}\n${r.out.split('\n').filter(line => !/^ℹ|^✔/.test(line)).join('\n')}`);
}
const failed = results.filter(r => !r.ok).length;
console.log(`${failed ? 'The check failed' : 'The check passed'} in ${Math.round((Date.now() - t0) / 1000)} s${quick ? ' (quick: the walk in Logseq was not run)' : ''}.`);
process.exit(failed ? 1 : 0);
