#!/bin/sh
# Every module's own checks, one after another: sh test/all.sh   (needs jsdom and Playwright: NODE_PATH, see README)
# Exits non-zero if any fails. Threads' slow ones: cd threads && sh tools/check.sh --full
# In the real Logseq (a test graph open, debugging port, NODE_PATH): node tools/logseq-contract-app.js, then node tools/write-check.js
cd "$(dirname "$0")/.." || exit 1
fail=0
run() { (cd "$1" && shift && "$@" >"${TMPDIR:-/tmp}/logseq-plugin-check.$$" 2>&1) && echo "ok  $*" || { echo "FAILED  $*"; tail -8 "${TMPDIR:-/tmp}/logseq-plugin-check.$$"; fail=1; }; rm -f "${TMPDIR:-/tmp}/logseq-plugin-check.$$"; }
for file in plugin.js main.js files.js outside.js; do node --check "$file" || fail=1; done
run . node test/settings.js
run . node test/root.js
run . node test/outside.js
run . node test/library.js
run . node test/logseq-contract.js
run . node test/writes.js
run . node test/risks.js
run look node test/load.js
run find node test/load.js
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
