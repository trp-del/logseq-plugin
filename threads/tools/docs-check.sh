#!/bin/sh
# Checks that the written record keeps up with the plugin (the owner, 2026-10-20: "make sure things are updated as
# things go"). Run from the repo root: sh tools/docs-check.sh. tools/check.sh runs it; the commit hook
# (tools/hooks/pre-commit) runs it with --staged, which also looks at what the commit holds.
# Exits non-zero with a plain message saying what to update.
cd "$(dirname "$0")/.." || exit 1
fail=0
problem() { echo "PROBLEM (documents): $1"; fail=1; }
pkg=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)

# 1. The last line of CHANGELOG.md is this version's.
last=$(grep -E '^[0-9]+\.[0-9]+\.[0-9]+:' CHANGELOG.md | tail -1 | cut -d: -f1)
[ "$last" = "$pkg" ] || problem "the last line of CHANGELOG.md is for '$last', not $pkg: add '$pkg: …' saying what was seen on screen and what was only read"
# 2. CLAUDE.md's State line names this version (the next session starts from it).
grep -q "State (.*\*\*$pkg\*\*" CLAUDE.md || problem "CLAUDE.md's State line does not name **$pkg**: update it, and sections 3, 6 and 7 if what the plugin does or what comes next changed"
# 3. The logbook has an entry for this version.
grep -q "^## .*($pkg)" docs/LOGBOOK.md || problem "docs/LOGBOOK.md has no entry '## … ($pkg)' (newest first, in the shape docs/PROCESS.md gives)"

# 4. With --staged: a change to the plugin's code comes with a new version, its CHANGELOG line and logbook entry, and a
#    changed setting with the README.
if [ "$1" = "--staged" ]; then
  staged=$(git diff --cached --name-only)
  code=$(echo "$staged" | grep -E '^(main\.js|loader\.js|parts/.*\.js)$')
  if [ -n "$code" ]; then
    for f in package.json CHANGELOG.md docs/LOGBOOK.md CLAUDE.md; do
      echo "$staged" | grep -qx "$f" || problem "the plugin's code changed ($(echo $code)) but $f is not in the commit (version: sh tools/bump.sh 0.4.N)"
    done
    if git diff --cached -U0 -- $code | grep -E "^[+-][[:space:]]*(\{ key: '|description: ')" >/dev/null; then
      echo "$staged" | grep -qx README.md || problem "a setting changed but README.md is not in the commit"
    fi
  fi
fi

if [ $fail -ne 0 ]; then echo "docs-check: FAILED"; exit 1; fi
echo "docs-check: OK (version $pkg; the feature map page is not checked here: update it when a layer changes)"
