/* The guard's lock, without the app (18 November 2026): which shell commands it stops, and that the fingerprint of what ships
   changes when a shipped file changes and not when a test or a README does. node test/guard.js */
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..'), ship = require('../tools/guard/ship');

// A throwaway repository shaped like the plugin, with one commit.
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-test-'));
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const put = (p, t) => { fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true }); fs.writeFileSync(path.join(repo, p), t); };
for (const f of ['package.json', 'loader.js', 'plugin.js', 'main.js', 'README.md']) put(f, f + '\n');
put('files.js', "window.FILES = ['look/a.js'];\n"); put('look/a.js', 'a\n'); put('test/x.js', 'x\n');
git('init', '-q'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one');

const head = ship.fromGit(repo, 'HEAD');
assert.strictEqual(ship.fromFolder(repo), head, 'the folder and its commit ship the same');
put('test/x.js', 'y\n'); put('README.md', 'other\n');
assert.strictEqual(ship.fromFolder(repo), head, 'a test or a README does not change what ships');
put('look/a.js', 'b\n');
assert.notStrictEqual(ship.fromFolder(repo), head, 'a file files.js names changes what ships');
git('add', 'look/a.js');
assert.notStrictEqual(ship.fromGit(repo, ''), head, 'staged, it changes what the commit ships');

// The hook: what it stops, with no pass on record.
const hook = (command, cwd = repo) => spawnSync('node', [path.join(ROOT, 'tools/guard/hook.js')], { input: JSON.stringify({ tool_input: { command }, cwd }), env: { ...process.env, GUARD_STORE: path.join(repo, '.no-store') }, encoding: 'utf8' }).status;
assert.strictEqual(hook('git commit -m change'), 2, 'a commit of a shipped change is stopped');
assert.strictEqual(hook('sh tools/release.sh'), 2, 'a release is stopped');
assert.strictEqual(hook('git push origin main'), 2, 'a push of a commit GitHub does not ship is stopped');
assert.strictEqual(hook('NODE_PATH=x sh tools/release.sh'), 2, 'a release with a variable before it is stopped');
assert.strictEqual(hook(`git -C ${repo} commit -m change`, os.tmpdir()), 2, 'git -C finds the repository');
for (const harmless of ['echo "sh tools/release.sh"', 'git status', 'git log --grep commit', 'git tag -l', 'cat tools/release.sh', 'grep release.sh README.md', 'ls'])
  assert.strictEqual(hook(harmless), 0, `“${harmless}” goes ahead`);
git('reset', '-q', 'look/a.js');
assert.strictEqual(hook('git add test/all.sh tools/release.sh'), 0, 'naming release.sh after another .sh file is not a release');
assert.strictEqual(hook('git commit -m tests'), 0, 'a commit with nothing that ships staged goes ahead');
assert.strictEqual(hook("git commit -F - <<'EOF'\nwhat release.sh zips; release.sh refuses\nEOF"), 0, 'words about release.sh in a commit message are not a release');
assert.strictEqual(hook('git commit -m x', os.tmpdir()), 0, 'outside the plugin nothing is stopped');

// A pass on record for exactly these files lets the release through.
fs.mkdirSync(path.join(repo, '.no-store'), { recursive: true });
fs.writeFileSync(path.join(repo, '.no-store', 'passes.jsonl'), JSON.stringify({ ship: ship.fromFolder(repo) }) + '\n');
assert.strictEqual(hook('sh tools/release.sh'), 0, 'with a pass on these files the release goes ahead');
put('look/a.js', 'c\n');
assert.strictEqual(hook('sh tools/release.sh'), 2, 'one more edit after the pass and it is stopped again');

fs.rmSync(repo, { recursive: true, force: true });
console.log('guard: the lock stops what ships untested and lets the rest through');
