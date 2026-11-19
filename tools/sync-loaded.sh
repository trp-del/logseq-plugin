#!/bin/sh
# Brings the folder the owner's Logseq loads (logseq-value/logseq-plugin) to GitHub's latest, then reloads the plugin in that
# Logseq when it runs with its debugging port (9222). The last step of every release (logseq-value/CLAUDE.md, 19 November 2026):
#   sh /Users/massimo/logseq-value/logseq-plugin/tools/sync-loaded.sh
# It changes nothing when the folder holds edits of its own or saved changes GitHub lacks: it lists them and stops, because that
# folder is never edited by hand and anything there may be another thread's work.
# Everything runs inside main(), read in full before it starts, so the script may update its own file safely.
main() {
  set -eu
  cd "$(dirname "$0")/.."
  folder=$(pwd)
  if [ -n "$(git status --porcelain)" ]; then
    echo "Stopped: the folder Logseq loads ($folder) holds edits that are not on GitHub:"
    git status --short
    echo "Nothing was changed. Find whose edits these are before going on."
    exit 1
  fi
  git fetch --quiet --tags origin
  ahead=$(git rev-list --count origin/main..HEAD)
  if [ "$ahead" != "0" ]; then
    echo "Stopped: the folder Logseq loads has $ahead saved change(s) that GitHub does not have:"
    git log --oneline origin/main..HEAD
    echo "Nothing was changed."
    exit 1
  fi
  before=$(git log -1 --format=%s | cut -c1-90)
  git merge --quiet --ff-only origin/main
  version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
  if [ "$before" = "$(git log -1 --format=%s | cut -c1-90)" ]; then echo "The folder Logseq loads was already at GitHub's latest: $version."
  else echo "The folder Logseq loads is now at GitHub's latest: $version ($(git log -1 --format=%h))."; fi
  if ! curl -s -m 2 http://localhost:9222/json/version >/dev/null; then
    echo "Logseq is not running with its debugging port: the plugin reloads the next time Logseq starts."
    exit 0
  fi
  NODE_PATH="$folder/node_modules" EXPECT="$version" node -e '
    const { chromium } = require("playwright");
    (async () => {
      const browser = await chromium.connectOverCDP("http://localhost:9222");
      const main = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("index.html"));
      if (!main) { console.log("Logseq'"'"'s window was not found: reload the plugin by hand."); process.exit(0); }
      const said = await main.evaluate(async expect => {
        if (await logseq.api.check_editing()) return "The owner is writing in Logseq: the plugin was not reloaded. It takes the new version at its next reload.";
        const plugin = LSPluginCore.registeredPlugins.get("logseq-plugin");
        if (!plugin) return "Logseq has no plugin called logseq-plugin loaded.";
        await LSPluginCore.reload("logseq-plugin");
        await new Promise(r => setTimeout(r, 3000));
        const now = LSPluginCore.registeredPlugins.get("logseq-plugin")?.options?.version;
        return now === expect ? "Logseq reloaded the plugin and runs " + now + "." : "Logseq reloaded the plugin but reports " + now + ", not " + expect + ".";
      }, process.env.EXPECT);
      console.log(said);
      process.exit(0);
    })().catch(e => { console.log("Reloading the plugin in Logseq failed: " + e.message); process.exit(0); });
  '
}
main "$@"
