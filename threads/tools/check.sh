#!/bin/sh
# Checks the plugin before a commit. Run from threads/: sh tools/check.sh   (sh tools/check.sh --full for the slow ones)
# Exits non-zero on any problem, with a plain message.
# Trimmed from DB Refinements' check.sh to what the two-way links plugin still has: the kit, the model, the two-way section
# and the part that asks Predictive's core what the + line proposes.
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
fail=0
problem() { echo "PROBLEM: $1"; fail=1; }
full=0; [ "$1" = "--full" ] && full=1

# 1. Syntax of every script file: JavaScriptCore on a Mac, node elsewhere.
for f in main.js parts/*.js parts/*/*.js; do
  if [ -x "$JSC" ]; then "$JSC" tools/check.js -- "$f" || fail=1
  elif command -v node >/dev/null 2>&1; then node --check "$f" >/dev/null 2>&1 && echo "OK $f" || { echo "ERROR $f: syntax"; fail=1; }
  else problem "no JavaScriptCore and no node to check the syntax of $f"; fi
done

# 2. No leftover TEMP-DEV block.
found=$(grep -l TEMP-DEV main.js parts/*.js parts/*/*.js tools/*.js 2>/dev/null | tr '\n' ' ')
if [ -n "$found" ]; then problem "TEMP-DEV found in: $found"; fi

# 3. Counts that should stay the same unless a setting or a publication was added on purpose.
settings=$(cat main.js parts/*.js parts/*/*.js | grep -c "key: '")
windows=$(cat main.js parts/*.js parts/*/*.js | grep -c "window\.[a-zA-Z]* = ")
echo "settings keys (grep \"key: '\"): $settings; window.* publications: $windows"

# 4. Every file in parts/ is in the plugin's files.js, and the reverse.
listed=$(grep -o "threads/parts/[a-z/-]*\.js" ../files.js | sed 's#^threads/parts/##' | sort)
present=$(cd parts && ls *.js */*.js | sort)
if [ "$listed" != "$present" ]; then
  problem "parts/ and files.js differ. In files.js: $(echo $listed). In parts/: $(echo $present)"
fi

# 5. The pretend-window checks, where node and jsdom are installed.
if command -v node >/dev/null 2>&1 && node -e "require('jsdom')" 2>/dev/null; then
  node tools/boot-test.js || problem "the boot test failed (see above)"
  BOOT_FAIL=two-way node tools/boot-test.js || problem "a part that fails to start was not said (see above)"
  node tools/undo-test.js || problem "the plugin's one Undo failed its checks (see above)"
  node tools/recycle-list-test.js || problem "the Recycle list failed its checks (see above)"
  node tools/two-way-rows-test.js || problem "the two-way rows' grouping, + in a group or writing into a node failed its checks (see above)"
  if [ $full -eq 1 ]; then node tools/parts-apart-test.js || problem "a part could not be left out without the others failing (see above)"
  else echo "SKIPPED parts-apart: it runs with --full"; fi
  node tools/leaning-test.js || problem "a part leans where it must not: a direct Logseq call, a name on the window (see above)"
else
  echo "boot test skipped (needs node and: npm install --no-save --no-package-lock jsdom)"
fi

# 6. The model test (tools/model-test.js): parts/model.js against a small pretend graph.
if command -v node >/dev/null 2>&1; then
  node tools/model-test.js || problem "the model test failed (see above)"
else
  echo "model test skipped (needs node)"
fi

# 7. The odd names, drawn (tools/odd-text-test.js), in a real browser where Playwright and Chromium are installed; skipped quietly elsewhere.
if command -v node >/dev/null 2>&1; then
  node tools/odd-text-test.js || problem "odd names broke a drawing (see above)"
fi

# 8. Frames of what the plugin draws, recorded moving (tools/frames.js): plugin off and on, no jump, no flash.
#    Run with --full: it records in a real browser and takes a minute.
if command -v node >/dev/null 2>&1 && [ $full -eq 1 ]; then
  node tools/frames.js || problem "a frame test failed: something the plugin draws jumped, flashed or changed (see check.log/frames/; approve a meant change with node tools/frames.js --approve after looking)"
fi
# 8b. Pictures of what the plugin draws (tools/pictures.js), light and dark, compared with the approved ones in test/pictures/.
#     Three seconds, so every run (9 November 2026: run only with --full, they had gone two days out of date unnoticed).
if command -v node >/dev/null 2>&1; then
  node tools/pictures.js || problem "a picture changed (see above); look at check.log/pictures/, and approve it with node tools/pictures.js --approve only if the change was meant"
fi

# 9. The two-way rows against the real Illness Test Graph (tools/two-way-check.js), through Logseq's command line;
#    skipped quietly where the command line or the graph cannot be read. With --full only (9 November 2026): it fails
#    whenever anyone is editing the test graph, so it belongs with the rounds in the app, not the routine run.
if [ $full -eq 1 ] && command -v node >/dev/null 2>&1 && node -e "require('jsdom')" 2>/dev/null; then
  node tools/two-way-check.js || problem "the two-way rows differ from the graph (see above)"
fi

if [ $fail -ne 0 ]; then echo "check.sh: FAILED"; exit 1; fi
if [ $full -eq 1 ]; then echo "check.sh: OK, in full"; else echo "check.sh: OK (the slow tests run with --full)"; fi
