/* Is the Mac quiet enough to measure speed? (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 4, "Load"; the loose end of
   CLAUDE.md section 7: the tag map's speed limits failed whenever the Mac's load was above about 2, as it is while the
   Claude app renders a long session.)
   - load():  the one-minute load average (sysctl vm.loadavg on a Mac, os.loadavg() elsewhere);
   - idle():  seconds since the last key or mouse input (ioreg on a Mac; Infinity elsewhere);
   - quiet(): load under 2, over the last minute and over the last five (a run once began in a moment's dip under 2
     while the Mac had been at 3 for minutes, and its times were judged as a quiet Mac's, 2026-10-23);
   - waitQuiet({ minutes, needIdle }): waits, a reading every 30 s, until quiet (and, with needIdle, no input for 120 s),
     at most `minutes`; returns { quiet, load, idle, waited }.
   The speed tests use it as a gate: on a quiet Mac a speed limit is the limit; on a busy one (still busy after the
   wait) the same measure is taken of the previous version (HEAD) in the same run, and a change fails only when it is
   more than 25% slower than that under the same load. A limit is never raised. */
const os = require('os');
const { execSync } = require('child_process');
const QUIET_LOAD = 2;
// The load averages: [one minute, five minutes].
function loads() {
  try { return execSync('sysctl -n vm.loadavg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().replace(/[{}]/g, '').trim().split(/\s+/).slice(0, 2).map(Number); }
  catch (error) { return os.loadavg().slice(0, 2); }
}
const load = () => loads()[0];
function idle() {
  try { return Number(execSync(`ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString()) || 0; }
  catch (error) { return Infinity; }
}
const quiet = () => loads().every(l => l < QUIET_LOAD);
async function waitQuiet({ minutes = 0, needIdle = false } = {}) {
  const begun = Date.now();
  for (;;) {
    const [l, l5] = loads(), i = idle();
    const ok = l < QUIET_LOAD && l5 < QUIET_LOAD && (!needIdle || i > 120);
    if (ok || Date.now() - begun >= minutes * 60000) return { quiet: ok, load: l, idle: i, waited: Math.round((Date.now() - begun) / 1000) };
    await new Promise(r => setTimeout(r, 30000));
  }
}
module.exports = { load, loads, idle, quiet, waitQuiet, QUIET_LOAD };
