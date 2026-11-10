/* node test/tidy.js
   What the cleanup of 10 November 2026 took out stays out (changes-to-make 46, 47): one name for the 70% grey (--lk-quiet; the
   three other names for the same value invited one to drift), no old Threads version numbers ("0.4.411") or pointers into the
   archive's docs/ folder in the plugin's comments, and none of the dead pieces the code review listed. Reads every file git keeps. */
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => /\.(js|css|sh|html)$/.test(f) && !f.startsWith('dist/') && f !== 'test/tidy.js');
const problems = [];
const look = (what, pattern, ok = () => false) => { for (const f of files) fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => { if (pattern.test(line) && !ok(f, line)) problems.push(`${what}: ${f}:${i + 1}  ${line.trim().slice(0, 100)}`); }); };
look('a second name for the 70% grey (use --lk-quiet)', /--lk-(?:faint|soft|dim)\b/);
// A test's own data may name a version (a pretend Logseq's baseInfo); comments and messages may not.
look('an old Threads version number', /\b0\.4\.\d+/, (f, line) => /version: '0\.4|recycleReport\(rows, 'Threads 0\.4/.test(line));
look('a pointer into the archive’s docs/ folder', /\bdocs\/[A-Z]/);
look('a dead piece of the code review', /\b(?:MOMENT_INSTRUCTIONS|shownAtOtherEnd|pickedBlocks|pdfSources|propHolders|th-ttreeval)\b|\bpropUse\b|\bcurrentBlock\b/);
if (problems.length) { console.log('FAIL\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`tidy: all checks passed (${files.length} files)`);
