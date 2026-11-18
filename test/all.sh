#!/bin/sh
# Every module's own checks, one after another: sh test/all.sh   (needs jsdom and Playwright: NODE_PATH, see README)
# Exits non-zero if any fails. Threads' slow ones: cd threads && sh tools/check.sh --full
# In the real Logseq (a test graph open, debugging port, NODE_PATH): node tools/logseq-contract-app.js, then node tools/write-check.js
cd "$(dirname "$0")/.." || exit 1
fail=0
# A release run (RELEASE_CHECK, set by tools/release.sh) skips nothing: without jsdom or Playwright the sets that need them would print
# ok while leaving parts out (18 November 2026), so here they are a failure before anything runs.
if [ -n "${RELEASE_CHECK:-}" ]; then
  for need in jsdom playwright; do node -e "require('$need')" 2>/dev/null || { echo "FAILED  a release run needs $need: set NODE_PATH to the folder holding it"; fail=1; }; done
fi
run() { (cd "$1" && shift && "$@" >"${TMPDIR:-/tmp}/logseq-plugin-check.$$" 2>&1) && echo "ok  $*" || { echo "FAILED  $*"; tail -8 "${TMPDIR:-/tmp}/logseq-plugin-check.$$"; fail=1; }; rm -f "${TMPDIR:-/tmp}/logseq-plugin-check.$$"; }
for file in plugin.js main.js loader.js files.js outside.js sidebar-tabs.js split.js settings/window.js settings/ways-in.js; do node --check "$file" || fail=1; done
run . node test/settings.js
run . node test/root.js
run . node test/outside.js
run . node test/library.js
run . node test/logseq-contract.js
run . node test/writes.js
run . node test/guard.js
run . node test/risks.js
run . node test/undo.js
run . node test/base.js
run . node test/watcher.js
run . node test/screen.js
run . node test/dates.js
run . node test/helpers.js
run . node test/keys.js
run . node test/one-look.js
run . node test/leftovers.js
run . node test/tidy.js
run . node test/review.js
run . node test/split.js
run look node test/load.js
run look node test/contents.js
run look node test/tables.js
run find node test/load.js
run todo node test/group.js
run todo node test/status.js
run todo node test/words.js
run predictive node test/run.js
run predictive node test/load.js
run structure node test/core.test.js
run structure node test/apply.test.js
run structure node test/load.js
run export node test/core.test.js
run export node test/load.js
run export node test/window.js
run threads sh tools/check.sh
[ $fail -eq 0 ] && echo "all checks passed" || { echo "some checks failed"; exit 1; }
