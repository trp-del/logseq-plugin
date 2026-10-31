#!/usr/bin/env node
/* Every part stands on its own (0.4.269): the plugin is booted (tools/boot-test.js) with each part left out in turn, and
   must start, run and unload with no warning but the one that says what is missing. In this plugin the parts that can be
   left out are two-way itself, the property marks (property-kinds), and the two that
   feed the + line (alike, shadow-rules). The foundation (shared, model, diagnostics) is not left out:
   everything stands on it.
   Needs node and jsdom. Run from the repo root: node tools/parts-apart-test.js */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const problems = [];
const run = (script, env) => spawnSync(process.execPath, [path.join(root, 'tools', script)], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });

// [left out, the warning that should say so (none: nothing to say), parts that then stay out by themselves]
const CASES = [
  ['two-way'], ['property-kinds'], ['shadow-rules'],
  ['alike', 'alike is missing from the core'],
  ['alike,shadow-rules'],
];
for (const [leave, warn, quiet] of CASES) {
  const out = run('boot-test.js', { LEAVE_OUT: leave, ALLOW_WARN: warn || '', QUIET_PARTS: String(quiet || 0) });
  const ok = out.status === 0;
  console.log(`  without ${leave.split(',').join(', ')}: ${ok ? 'starts, runs and unloads' : 'FAILED'}${warn && ok ? ' (says what is missing)' : ''}`);
  if (!ok) problems.push(`without ${leave}:\n` + (out.stdout + out.stderr).split('\n').filter(line => /PROBLEM/.test(line)).join('\n'));
}
for (const text of problems) console.log('PROBLEM: ' + text);
console.log(problems.length ? `parts-apart-test: FAILED (${problems.length})` : `parts-apart-test: OK (${CASES.length} ways)`);
process.exit(problems.length ? 1 : 0);
