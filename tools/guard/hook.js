#!/usr/bin/env node
/* The guard's lock for Claude (18 November 2026). Claude Code runs this before every shell command in the logseq-value workspace
   (.claude/settings.json there). A command that saves, tags, pushes or releases the plugin goes ahead only when the guard passed
   on exactly what it would ship:
     git commit            the files staged (nothing that ships changed: no pass needed)
     sh tools/release.sh   the files in the folder it zips
     git tag / git push / gh release   what HEAD holds (the same as origin/main's shipped files: no pass needed)
   Anything else passes untouched. A refusal says why and what to run; it never asks the owner. */
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let cmd = '', cwd = process.cwd();
  try { const j = JSON.parse(input); cmd = String(j.tool_input?.command || ''); cwd = j.cwd || cwd; } catch (e) { process.exit(0); }
  // Words inside a heredoc or quotes (a commit message, an echo) are not commands: they are taken out before reading what runs.
  const bare = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(\n|$)/g, '\n').replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""');
  const GIT = String.raw`\bgit(?:\s+-[Cc]\s+(?:"[^"]+"|'[^']+'|\S+))*\s+`;
  const kind = /(?:(?:^|[\s;&|(])(?:sh|bash|zsh)\s+(?:-\w+\s+)*|(?:^|[;&|(]\s*)(?:\.\/)?)(?:\S*\/)?release\.sh\b/.test(bare) ? 'release'
    : new RegExp(GIT + 'commit\\b').test(bare) ? 'commit'
    : new RegExp(GIT + 'push\\b').test(bare) || new RegExp(GIT + 'tag\\s+(?!-l\\b|--list\\b|-d\\b|--delete\\b|-n\\b|-v\\b)[^-\\s|;&]').test(bare) || new RegExp(GIT + 'tag\\s+-[as]\\b').test(bare) || /\bgh\s+release\s+(create|upload|edit)\b/.test(bare) ? 'ship'
    : null;
  if (!kind) process.exit(0);
  // Where it acts: git -C <dir>, else a leading cd <dir>, else the session's folder.
  const m = cmd.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/) || cmd.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)/);
  let dir = m ? m[1].replace(/^["']|["']$/g, '') : cwd;
  dir = path.resolve(cwd, dir.replace(/^~(?=\/)/, process.env.HOME));
  let repo = null;
  try { repo = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { /* not a repository */ }
  if (kind === 'release' && !repo) repo = dir;
  if (!repo || !fs.existsSync(path.join(repo, 'files.js')) || !fs.existsSync(path.join(repo, 'plugin.js'))) process.exit(0);   // not the plugin
  const ship = require('./ship');
  const passes = path.join(process.env.GUARD_STORE || path.join(require('node:os').homedir(), '.logseq-guard'), 'passes.jsonl');
  const passed = hash => fs.existsSync(passes) && fs.readFileSync(passes, 'utf8').split('\n').some(l => { try { return JSON.parse(l).ship === hash; } catch (e) { return false; } });
  let hash, what, free = false;
  try {
    if (kind === 'commit') { hash = ship.fromGit(repo, ''); what = 'the files staged for this commit'; free = hash === ship.fromGit(repo, 'HEAD'); }
    else if (kind === 'release') { hash = ship.fromFolder(repo); what = 'the files release.sh would zip'; }
    else {
      hash = ship.fromGit(repo, 'HEAD'); what = 'what HEAD holds';
      // Already shipped: the same files as origin/main, or a commit origin/main already holds.
      try { free = hash === ship.fromGit(repo, 'origin/main'); } catch (e) { /* no origin */ }
      if (!free) try { execFileSync('git', ['-C', repo, 'merge-base', '--is-ancestor', 'HEAD', 'origin/main'], { stdio: 'ignore' }); free = true; } catch (e) { /* not in it */ }
      /* A clone's "origin" may be another folder on this Mac, behind GitHub (18 November: an Alfred-only commit was stopped because
         its clone's origin/main was four releases old). So the same comparison is made with GitHub's main itself, read through the
         workspace's own checkout, whose origin is GitHub. */
      if (!free) try {
        const home = path.resolve(__dirname, '../..');
        execFileSync('git', ['-C', home, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore', timeout: 20000 });
        free = hash === ship.fromGit(home, 'origin/main');
      } catch (e) { /* no network: the guard's pass is still asked */ }
    }
  } catch (e) { process.exit(0); }
  if (free || passed(hash)) process.exit(0);
  process.stderr.write(`The guard has not passed on ${what} in ${repo} (fingerprint ${hash}), so this ${kind} is stopped.
Run the guard on exactly these files, from a folder that holds only this change:
  node tools/guard/guard.js run --change ${repo} --expect "<the screens this change means to alter>"
then give a reason for each meant difference (guard.js why …), fix anything else it finds, and try again.
Read tools/guard/README.md. Do not work around this lock.\n`);
  process.exit(2);
});
