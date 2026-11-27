#!/bin/sh
# Brings the folder the owner's Logseq loads (logseq-workspace/logseq-plugin) to GitHub's latest, then reloads the plugin in that
# Logseq when it runs with its debugging port (9222). The last step of every release (logseq-workspace/CLAUDE.md, 19 November 2026):
#   sh tools/sync-loaded.sh   (from any copy: it finds the folder in Logseq's preferences)
# It changes nothing when the folder holds edits of its own or saved changes GitHub lacks: it lists them and stops, because that
# folder is never edited by hand and anything there may be another thread's work.
# It ends as failed (not 0) whenever Logseq is running and does not run the new version at the end: the release is then not
# finished, and the last line says why. 1: the reload went wrong or could not be made. 2: the owner was writing, so the plugin
# was left alone; run this again later. Only a Logseq that is not running with its debugging port ends as done: it loads the new
# version when it starts.
# Everything runs inside main(), read in full before it starts, so the script may update its own file safely.
main() {
  set -eu
  # The folder Logseq loads, from Logseq's own list of plugins loaded from a folder; this script's own repository otherwise.
  # So it acts on that folder whichever copy it is run from.
  folder=$(grep -o '"[^"]*/logseq-plugin"' "$HOME/.logseq/preferences.json" 2>/dev/null | head -1 | tr -d '"')
  [ -n "$folder" ] && [ -d "$folder/.git" ] || folder=$(cd "$(dirname "$0")/.." && pwd)
  cd "$folder"
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
      if (!main) { console.log("Not finished: Logseq'"'"'s window was not found, so the plugin was not reloaded. Reload it by hand, or run this again."); process.exit(1); }
      const said = await main.evaluate(async expect => {
        if (await logseq.api.check_editing()) return [2, "Not finished: the owner is writing in Logseq, so the plugin was not reloaded and Logseq still runs the version before. Run this again later."];
        const plugin = LSPluginCore.registeredPlugins.get("logseq-plugin");
        if (!plugin) return [1, "Not finished: Logseq has no plugin called logseq-plugin loaded, so nothing was reloaded."];
        await LSPluginCore.reload("logseq-plugin");
        await new Promise(r => setTimeout(r, 3000));
        const now = LSPluginCore.registeredPlugins.get("logseq-plugin")?.options?.version;
        return now === expect ? [0, "Logseq reloaded the plugin and runs " + now + "."] : [1, "Not finished: Logseq reloaded the plugin but reports " + now + ", not " + expect + "."];
      }, process.env.EXPECT);
      console.log(said[1]);
      process.exit(said[0]);
    })().catch(e => { console.log("Not finished: reloading the plugin in Logseq failed: " + e.message); process.exit(1); });
  '
}
main "$@"
