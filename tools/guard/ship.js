/* What ships, as one fingerprint (18 November 2026). The files tools/release.sh puts in the zip (package.json, loader.js, files.js,
   plugin.js, main.js and every file files.js names), each by git's own hash of its content, joined into one sha-256. The same
   fingerprint is read from a folder's files (what the guard tested, what release.sh is about to zip) or from a repository's index
   (what a commit is about to save), so "the guard passed on exactly what ships" is one comparison. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const FIXED = ['package.json', 'loader.js', 'files.js', 'plugin.js', 'main.js'];
const named = filesJs => (String(filesJs).match(/'[a-z0-9/_.-]*\.js'/gi) || []).map(s => s.slice(1, -1));

const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const join = pairs => crypto.createHash('sha256').update(pairs.sort((a, b) => a[0].localeCompare(b[0])).map(p => p.join(' ')).join('\n')).digest('hex').slice(0, 16);

// From a folder's files (a missing file counts as missing, so it cannot match a tested set that had it).
function fromFolder(dir) {
  const read = p => { try { return fs.readFileSync(path.join(dir, p)); } catch (e) { return null; } };
  const list = [...new Set([...FIXED, ...named(read('files.js') || '')])];
  return join(list.map(p => { const b = read(p); return [p, b ? blob(b) : 'missing']; }));
}

// From a repository's index: what `git commit` would save. Or from a commit (ref), what it holds.
function fromGit(repo, ref) {
  const show = p => { try { return execFileSync('git', ['-C', repo, 'show', (ref ? ref : '') + ':' + p], { maxBuffer: 1 << 26 }); } catch (e) { return null; } };
  const list = [...new Set([...FIXED, ...named(show('files.js') || '')])];
  return join(list.map(p => { const b = show(p); return [p, b ? blob(b) : 'missing']; }));
}

module.exports = { fromFolder, fromGit, FIXED, named };
