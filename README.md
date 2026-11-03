# Logseq Plugin

Six tools for a Logseq DB graph, in one plugin, one look. Each does one job:

- **Look** draws how things look: a link in the text colour that opens its page, in a property's value too, a tag as its name in mono, a page's place in the tree beside its title, an icon of what each property holds.
- **Find** is the search window as the first step of a walk: a name, then the kinds and the time, then the thread from what you found, without leaving.
- **Predictive** fills in properties and predicts pages while you write, and stays out of the way.
- **Structure** is the map of the graph's tags and properties: one screen to see the whole shape, move things and change many at once, with one Undo.
- **DB Export** takes a page or some blocks out as a PDF, as Markdown or as rich text on the clipboard.
- **Threads** shows, on a page, everything that points at it, named by the property it came through, to follow and dig along.

Built for Logseq 2.0.2 DB graphs. It reads the graph and writes to it only here: Structure's Apply and its Undo; Predictive's values and tags while you write, on the bullet you leave or on its parent when only the parent's tags give the properties, with a tag on a page you linked and tagged in the words, and a journal page or a next bullet where one is needed; what Look's × takes off; Find's "make a page"; and in Threads a value or a tag changed in a row, a bullet or a page added, the pick bar's Delete, and the Recycle list under troubleshooting, which restores a page or deletes it for good. DB Export writes nothing to the graph. Each module's own README, in its folder, says what it draws, its keys and exactly what it writes.

## Install

In Logseq, open the command palette and run **Install plugin from GitHub release**. Paste this repository's address, tick the **effect** box, and press Install. Without the tick the plugin runs in a sealed frame and can draw nothing; uninstall and install again with it ticked. **Check update** on the plugin's card brings the next version.

Find and Structure each have a toolbar icon, off at first: pin them from the puzzle icon at the top right, where they are listed as `find-open` and `structure-open`.

Or download the zip from the latest release, unzip it, and load the folder with **Load unpacked plugin** (Developer mode, effect ticked).

## Settings

One window for the whole plugin: **Plugin settings**, from **g** then **,** outside a bullet (as Logseq's own g pairs), the gear on the plugin's card (Open settings), the command palette, or Logseq's three dots under Plugins. Down the left the six parts, each with a tick for whether it runs; on the right each setting drawn as the thing itself. A letter typed anywhere finds a setting through all six. A part switched on or off waits, pencilled, for **Reload to apply**, which brings you back to the window. Changed by you lists what differs from the start, and "default" puts one back. Logseq's plain list is one word away at the foot; it also holds what the export window remembers.

## How it is built

No build step: plain scripts, loaded in the order `files.js` lists. `plugin.js` is the door each module registers at as it loads, and where it describes its rows for the settings window (`settings/`), which belongs to no module, so it works whichever are switched off. The door also holds what every module draws with, each drawn once: the greys and the shared class names, the four marks, the icon of what a property holds and the Undo arrow. `main.js`, loaded last, gives Logseq every module's settings as one list, sends the shared names, keeps Logseq's frame in place (a focus that pushes it up is put back) and sets up the clean-up and the ways into the settings window before anything else; then it starts the modules one after another. One failing, or not answering, is said in a notice and leaves the rest running; every module that began is stopped; a file that did not load is named in a notice. Each module lives in its own folder (`look/`, `find/`, `predictive/`, `structure/`, `export/`, `threads/`) and keeps its code under a name of its own on the plugin's window, so the modules never touch each other's.

The six were written as six plugins and joined into one on 31 October 2026. This is now the only copy that changes; the six old folders are an archive.

## Checks

Each module keeps its own in its folder: `test/` for what runs without Logseq, `tools/app/` for driving the real app. Run all of them with

```
NODE_PATH=<a folder holding jsdom and Playwright> sh test/all.sh
```

`test/module.js` and `test/start.js` load one module the way `main.js` does, so a module can be checked alone. Threads' slow checks: `cd threads && sh tools/check.sh --full`. `node tools/app-check.js` checks the whole plugin in the real Logseq, read-only.

## Releasing

By hand, with no GitHub Actions. Raise the version in `package.json`, then:

```
sh tools/release.sh
```

That builds `dist/logseq-plugin-v<version>.zip`. Tag the commit `v<version>`, push, and on GitHub draft a release of that tag with the zip attached. Logseq's installer takes the latest release's zip.
