# Logseq Plugin

Six tools for a Logseq DB graph, in one plugin, one look. Each does one job:

- **Look** draws how things look: a link in the text colour, a small mark before it saying what sort of thing it opens, a tag as its name in mono, a page's place in the tree beside its title, an icon of what each property holds.
- **Find** is the search window as the first step of a walk: a name, then the kinds and the time, then the thread from what you found, without leaving.
- **Predictive** fills in properties and predicts pages while you write, and stays out of the way.
- **Structure** is the map of the graph's tags and properties: one screen to see the whole shape, move things and change many at once, with one Undo.
- **DB Export** takes a page or some blocks out as a PDF, as Markdown or as rich text on the clipboard.
- **Threads** shows, on a page, everything that points at it, named by the property it came through, to follow and dig along.

Built for Logseq 2.0.2 DB graphs. It reads the graph and writes to it only where it says so (Structure's Apply, Predictive's filled-in values, a tag taken off a page with Look's ×, a value changed in a Threads row).

## Install

In Logseq, open the command palette and run **Install plugin from GitHub release**. Paste this repository's address, tick the **effect** box, and press Install. Without the tick the plugin runs in a sealed frame and can draw nothing; uninstall and install again with it ticked. **Check update** on the plugin's card brings the next version.

Or download the zip from the latest release, unzip it, and load the folder with **Load unpacked plugin** (Developer mode, effect ticked).

## Settings

Logseq's settings for the plugin (the gear on its card) start with **What runs**: a switch for each of the six. A switch takes effect after the plugin is reloaded. Below the switches come each module's own settings. Look, Find and Predictive also have a settings window of their own, drawn with the thing itself as each setting changes it: **Look: settings**, **Find: settings**, **Predictive: settings** in the command palette.

## How it is built

No build step: plain scripts, loaded in the order `files.js` lists. `plugin.js` is the door each module registers at as it loads; `main.js`, loaded last, gives Logseq every module's settings as one list and starts the modules one after another, one failing leaving the rest running. Each module lives in its own folder (`look/`, `find/`, `predictive/`, `structure/`, `export/`, `threads/`) and keeps its code under a name of its own on the plugin's window, so the modules never touch each other's.

The six were written as six plugins and joined into one on 31 October 2026.

## Releasing

By hand, with no GitHub Actions. Raise the version in `package.json`, then:

```
sh tools/release.sh
```

That builds `dist/logseq-plugin-v<version>.zip`. Tag the commit `v<version>`, push, and on GitHub draft a release of that tag with the zip attached. Logseq's installer takes the latest release's zip.

Coming from the six separate plugins: `node tools/merge-settings.js` once, before the first start, copies their settings across; then uninstall the six, so nothing draws twice.
