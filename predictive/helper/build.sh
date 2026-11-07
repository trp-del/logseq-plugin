#!/bin/sh
# Builds Predictive's helper: sh build.sh. The program lands in this folder as predictive-helper.
# It needs Apple's command line tools (xcode-select --install). It is built for macOS 26 and later, so it runs on 26 and 27.
# sh build.sh test asks the model one example fill and prints the answer.
set -eu
cd "$(dirname "$0")"
try() { swiftc -O -parse-as-library -target arm64-apple-macos26.0 "$@" main.swift -o predictive-helper 2>/tmp/predictive-helper-build.log; }
if ! try; then
  # A compiler older than the newest SDK on this Mac (as after an update of macOS before the tools): the newest SDK it can read.
  built=no
  for sdk in $(ls -d /Library/Developer/CommandLineTools/SDKs/MacOSX2[6-9].[0-9]*.sdk 2>/dev/null | sort -r); do
    if try -sdk "$sdk"; then built=yes; break; fi
  done
  [ "$built" = yes ] || { cat /tmp/predictive-helper-build.log; exit 1; }
fi
echo "built predictive-helper"
if [ "${1:-}" = test ]; then
  ./predictive-helper --status
  ./predictive-helper --meaning
  printf '%s' '{"text":"Saw Dr. Mei Chen with Ruth about the fatigue, 5 mg from Monday until Friday","tags":["Consultation"],"today":"2026-11-02","properties":[{"key":"a","title":"Provider","kind":"page","choices":["Dr. Mei Chen","Ruth Okoro"]},{"key":"b","title":"Spoke with","kind":"page","many":true,"choices":["Dr. Mei Chen","Ruth Okoro"]},{"key":"c","title":"Dose","kind":"number"},{"key":"d","title":"Start","kind":"date"},{"key":"e","title":"End","kind":"date"}]}' | ./predictive-helper --fill
fi
