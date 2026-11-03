#!/bin/sh
# Puts Predictive's helper on this Mac and starts it at every login: sh install.sh. Run it again after an update.
# sh install.sh remove takes it off again.
# It listens on 127.0.0.1 only and answers Logseq only; Apple's model runs on the Mac, and nothing leaves it.
set -eu
cd "$(dirname "$0")"
label=com.logseq-value.predictive-helper
home="$HOME/Library/Application Support/Logseq Predictive"
agent="$HOME/Library/LaunchAgents/$label.plist"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
if [ "${1:-}" = remove ]; then rm -f "$agent"; rm -rf "$home"; echo "Predictive's helper is off this Mac."; exit 0; fi
# Built here when the tools are on this Mac; else the one that came in this folder.
sh build.sh >/dev/null 2>&1 || [ -f predictive-helper ] || { echo "No predictive-helper here and it could not be built: run xcode-select --install, then this again."; exit 1; }
mkdir -p "$home" "$HOME/Library/LaunchAgents"
cp predictive-helper "$home/predictive-helper"
chmod +x "$home/predictive-helper"
xattr -d com.apple.quarantine "$home/predictive-helper" 2>/dev/null || true
cat > "$agent" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>$home/predictive-helper</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>$home/helper.log</string>
  <key>StandardOutPath</key><string>$home/helper.log</string>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$agent"
sleep 1
curl -s http://127.0.0.1:47615/status && echo
echo "Predictive's helper is running and starts at every login."
