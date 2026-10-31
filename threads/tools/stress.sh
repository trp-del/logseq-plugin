#!/bin/sh
# Every stress test in one command (docs/history/FINISHING-PROMPT-2026-10-23.md section 4), green before any version is tagged.
# Run from the repo root: sh tools/stress.sh            everything
#                         sh tools/stress.sh --no-app   only what needs no running Logseq
# Each is also runnable alone; each says in its header what it does, what fails it and why.
#   node tools/model-test.js --big    the model on 100,000 pages and 600 properties: every door about linear
#   node tools/shadow-stress.js       the proposals: tricky words, random text, odd names, a large pretend graph
#   node tools/odd-text-test.js       odd names through the kit, the two-way rows, the tag map and the model's readers
#   node tools/tags-stress.js         the tag map: 200 drags, Undo in rounds, renames, both views, 1000 holders, 200 keys, memory
#   node tools/app-stress.js          the real Logseq (over its debugging port): pages many and fast, a typing storm,
#                                     theme / sidebar / size, twenty reloads and Foundation only, every pop-up in dark
#   node tools/app-frames.js          every tour stop recorded off and on, light and dark (the frame test of the real app)
# The speed parts wait for a quiet Mac and are gated on its load (tools/quiet.js).
cd "$(dirname "$0")/.." || exit 1
fail=0
problem() { echo "PROBLEM: $1"; fail=1; }
node tools/model-test.js --big || problem "the model does not scale (see above)"
node tools/shadow-stress.js || problem "the proposals' stress test failed (see above)"
node tools/odd-text-test.js || problem "an odd name broke a drawing or a reader (see above)"
node tools/tags-stress.js || problem "the tag map's stress test failed (see above)"
if [ "$1" != "--no-app" ]; then
  if curl -s -m 3 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    node tools/app-stress.js || problem "the real app's stress test failed (see above; check.log/stress/)"
    node tools/app-frames.js || problem "the real app's frame test failed (see above; check.log/frames/app/)"
  else
    problem "Logseq is not reachable on its debugging port: the real-app stress tests did not run (start it with --remote-debugging-port=9222)"
  fi
fi
if [ $fail -ne 0 ]; then echo "stress.sh: FAILED"; exit 1; fi
echo "stress.sh: OK"
