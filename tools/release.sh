#!/bin/sh
# Builds the zip Logseq installs, by hand, with no GitHub Actions: sh tools/release.sh. It runs every check first (test/all.sh)
# and builds nothing if one fails.
# The zip holds a folder logseq-plugin/ with exactly what Logseq needs: package.json, loader.js, files.js, plugin.js,
# main.js, every file files.js names, README.md and LICENSE. It is written to dist/logseq-plugin-v<version>.zip, the
# version read from package.json. Then: git tag v<version>, push, and attach the zip to a release of that tag on GitHub
# (Releases, Draft a new release). Logseq's "Install plugin from GitHub release" takes the latest release's zip.
set -eu
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
[ -n "$version" ] || { echo "no version in package.json"; exit 1; }
# Every module's checks first: a zip is built only from a plugin that passes them (10 November 2026).
# RELEASE_CHECK: nothing is skipped; a set that needs jsdom or Playwright fails without them (18 November 2026). The test tools live in
# this folder's node_modules (kept off GitHub) since the move to this Mac; logseq-plugin-old's are gone.
export NODE_PATH="${NODE_PATH:-$(pwd)/node_modules}" RELEASE_CHECK=1
sh test/all.sh || { echo "the checks failed: no zip built"; exit 1; }
# The guard must have passed on exactly these files: the whole plugin seen before and after in Logseq, every difference meant,
# every earlier complaint still fixed (18 November 2026, tools/guard/README.md).
node tools/guard/guard.js verify --folder . || { echo "the guard has not passed on these files: no zip built"; exit 1; }
# Then the checks in the real Logseq, in a Logseq of their own on a throwaway copy of the test graph (tools/release-app-check.js):
# a failure, or a Logseq that cannot be started, builds no zip.
node tools/release-app-check.js || { echo "the checks in Logseq failed or could not run: no zip built"; exit 1; }
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
zipfile="dist/logseq-plugin-v$version.zip"
rm -f "$zipfile"
(cd dist/stage && zip -q -r -X "../../$zipfile" logseq-plugin)
rm -rf dist/stage
echo "built $zipfile ($(du -h "$zipfile" | cut -f1)); tag it v$version"
