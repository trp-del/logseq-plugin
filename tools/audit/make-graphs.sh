#!/bin/sh
# Rebuilds the three test graphs the checks copy (17 November 2026, after the move to the new Mac: none came over).
#   sh make-graphs.sh [Illness|Stress|Scale ...]      (default: all three)
# The seeds are written by logseq-plugin/threads/test/*.py into a scratch copy (the repo's files stay as they are), then
# imported with Logseq's command line into a root of their own, $TEST_GRAPHS_ROOT (default ~/logseq-test-graphs), never
# ~/logseq, where the owner's graphs live. fresh.js copies them from there.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
SRC="$HERE/../../threads/test"
ROOT="${TEST_GRAPHS_ROOT:-$HOME/logseq-test-graphs}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/seeds.XXXXXX")
cp "$SRC"/illness-test-graph.py "$SRC"/stress-graph.py "$SRC"/scale-graph.py "$WORK"/
mkdir -p "$ROOT"
WHICH="${*:-Illness Stress Scale}"
imp() {  # graph name, then files in order; stops on the first failure
  g="$1"; shift
  logseq graph create --root-dir "$ROOT" --graph "$g" >/dev/null 2>&1 || true
  for f in "$@"; do
    out=$(logseq graph import --root-dir "$ROOT" --graph "$g" --type edn --input "$f" --timeout-ms 600000 2>&1) || { echo "$g: $f failed: $out"; exit 1; }
    case "$out" in *Failure*|*rror*) echo "$g: $f: $out"; exit 1;; esac
    echo "$g: $(basename "$f") in"
  done
  logseq server stop --root-dir "$ROOT" --graph "$g" >/dev/null 2>&1 || true
}
(cd "$WORK" && python3 illness-test-graph.py >/dev/null)
SEED="$WORK/illness-test-graph-1.edn $WORK/illness-test-graph-2.edn $WORK/illness-test-graph-3.edn"
for w in $WHICH; do case "$w" in
  Illness) imp "Illness Test Graph" $SEED "$HERE/fixtures.edn" ;;
  Stress)  (cd "$WORK" && python3 stress-graph.py >/dev/null); imp "Stress Check" $SEED $(ls "$WORK"/stress-graph-*.edn | sort -t- -k3 -n) ;;
  Scale)   (cd "$WORK" && python3 scale-graph.py >/dev/null); imp "Scale Check" $(ls "$WORK"/scale-graph-*.edn | sort -t- -k3 -n) ;;
esac; done
rm -rf "$WORK"
logseq graph list --root-dir "$ROOT"
