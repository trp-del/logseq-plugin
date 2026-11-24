#!/bin/sh
# Builds the zip Logseq installs, by hand, with no GitHub Actions: sh tools/release.sh. It runs the check first (tools/check.js
# --release) and builds nothing if it fails.
# The zip holds a folder logseq-plugin/ with exactly what Logseq needs: package.json, loader.js, files.js, plugin.js,
# main.js, every file files.js names, README.md and LICENSE. It is written to dist/logseq-plugin-v<version>.zip, the
# version read from package.json. Then: git tag v<version>, push, and attach the zip to a release of that tag on GitHub
# (Releases, Draft a new release). Logseq's "Install plugin from GitHub release" takes the latest release's zip.
set -eu
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
[ -n "$version" ] || { echo "no version in package.json"; exit 1; }
# The one check first, with nothing left out (tools/check.js --release, 19 November 2026): the checks that need no Logseq, then,
# in the guard's own Logseq, every screen before and after with how it reads, every earlier complaint, and every kind of write
# read back. No zip is built unless it passes. Name the screens the release means to change: sh tools/release.sh --expect "Todo".
# A difference on a named screen needs its reason (the check says how); then run this again.
node tools/check.js --release "$@" || { echo "the check did not pass: no zip built"; exit 1; }
# And the guard's own record that it passed on exactly these files.
node tools/guard/guard.js verify --folder . || { echo "the guard has not passed on these files: no zip built"; exit 1; }
stage=dist/stage/logseq-plugin
rm -rf dist/stage && mkdir -p "$stage"
cp package.json loader.js files.js plugin.js main.js README.md LICENSE "$stage/"
for file in $(grep -o "'[a-z/-]*\.js'" files.js | tr -d "'"); do
  [ -f "$file" ] || { echo "files.js names $file, which is not here"; exit 1; }
  mkdir -p "$stage/$(dirname "$file")" && cp "$file" "$stage/$file"
done
# Predictive's helper for Apple's model: its source and scripts, and the program built here, so a Mac without the developer
# tools can install it (predictive/helper/install.sh).
mkdir -p "$stage/predictive/helper"
cp predictive/helper/main.swift predictive/helper/build.sh predictive/helper/install.sh "$stage/predictive/helper/"
if sh predictive/helper/build.sh >/dev/null; then cp predictive/helper/predictive-helper "$stage/predictive/helper/"; else echo "the helper could not be built here: the zip holds its source only"; fi
# The script that has a Mac draw its own symbols for the icons (tools/mac-symbols.sh; it reads the names from plugin.js beside it),
# so a Mac that installs this zip can draw them: the settings say the line to run (24 November 2026).
mkdir -p "$stage/tools" && cp tools/mac-symbols.sh "$stage/tools/"
zipfile="dist/logseq-plugin-v$version.zip"
rm -f "$zipfile"
(cd dist/stage && zip -q -r -X "../../$zipfile" logseq-plugin)
rm -rf dist/stage
echo "built $zipfile ($(du -h "$zipfile" | cut -f1)); tag it v$version"
