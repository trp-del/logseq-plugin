#!/bin/sh
# Builds dist/Logseq.alfredworkflow from this folder: the command scripts as copies of runner.zsh, the toast launcher as a
# copy of toast-runner.zsh, then a zip with the .alfredworkflow extension.   sh build.sh
set -e
cd "$(dirname "$0")"
plutil -lint info.plist >/dev/null
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp info.plist logseq.js toast.swift README.md "$stage/"
[ -f icon.png ] && cp icon.png "$stage/" || echo "note: no icon.png here, so the workflow has no icon"
for command in today active page picture today-selection page-selection; do
  cp runner.zsh "$stage/$command"; chmod +x "$stage/$command"
done
cp toast-runner.zsh "$stage/toast"; chmod +x "$stage/toast"
mkdir -p dist
rm -f dist/Logseq.alfredworkflow
(cd "$stage" && zip -q -r -X "$OLDPWD/dist/Logseq.alfredworkflow" .)
echo "built dist/Logseq.alfredworkflow"
