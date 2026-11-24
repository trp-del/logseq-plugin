# Logseq Plugin

Seven tools for a Logseq DB graph, in one plugin, one look. Each does one job:

- **Look** draws how things look: a link in the text colour that opens its page, in a property's value too, a tag as its name in serif, a page's place in the tree beside its title, an icon of what each property holds.
- **Find** is the search window as the first step of a walk: a name, then the kinds and the time, then the thread from what you found, without leaving.
- **Predictive** fills in properties and predicts pages while you write, and stays out of the way.
- **Ontology** is the map of the graph's tags and properties: one screen to see the whole shape, move things and change many at once, with one Undo. While you write it shows where a tag sits in the lists Logseq already opens: the list on #, a property's list of values, and the menu on a bullet's tag.
- **DB Export** takes a page or some bullets out as a PDF, as Markdown or as rich text on the clipboard.
- **Relations** (its folder is `threads/`; named Threads until 17 November 2026, the section on a page Linked) shows, on a page, everything that points at it, named by the property it came through, to follow and dig along.
- **Todo** is Logseq's own tasks as one short list, on a page of its own and in the right sidebar: today, coming up, any time; add one with a day in its words, tick it off.

Built for Logseq 2.0.2 DB graphs. It reads the graph and writes to it only here: Ontology's Apply and its Undo; a bullet's tag changed or removed from its right-click menu, with its Undo (a tag taken from Ontology's rows in the list on # is given by Logseq itself); Predictive's values and tags while you write, on the bullet you leave or on its parent when only the parent's tags give the properties, with a tag on a page you linked and tagged in the words, and a journal page or a next bullet where one is needed; what Look's × takes off; Find's "make a page"; and in Threads a value or a tag changed in a row, a bullet or a page added, the pick bar's Delete, and the Recycle list under troubleshooting, which restores a page or deletes it for good; in Todo a task added to today's journal and a task's status ticked or unticked; and a file handed in from outside (the Alfred workflow), pasted into an empty bullet so it becomes a node of its own. DB Export writes nothing to the graph. One thing is written outside the graph's notes: a key of Logseq's own set on Look's key sheet goes into the graph's config (its `:shortcuts`), by `PluginDoor.setLogseqKey`, which writes the whole list back with the one key changed and writes nothing when the list could not be read. Every one of these writes goes through one place, `PluginDoor.write` in `plugin.js`, which also holds the checks an Undo makes before it takes anything back (a value only while it is as the change left it; a page the plugin made only while nothing is written on it or links to it, and always by its id, never by a name another page could share); `node test/writes.js` fails on a write anywhere else. Each module's own README, in its folder, says what it draws, its keys and exactly what it writes.

## Install

In Logseq, open the command palette and run **Install plugin from GitHub release**. Paste this repository's address, tick the **effect** box, and press Install. Without the tick the plugin runs in a sealed frame and can draw nothing; uninstall and install again with it ticked. **Check update** on the plugin's card brings the next version.

Ontology (a tree on its side) and Todo (a checkmark) are buttons in Logseq's toolbar at the top right, before the ··· menu; Find and Ontology in the sidebar head that ··· menu; Logseq's magnifier at the top left opens Find too. With Look's calm toolbar off, Logseq may tuck the two buttons into its puzzle icon's menu (listed as `structure-open` and `todo-open`), from where they can be pinned.

Or download the zip from the latest release, unzip it, and load the folder with **Load unpacked plugin** (Developer mode, effect ticked).

## Two pages side by side

⌘-click a link to a page in the main view (a link in the words or in a property's value, a tag, or a row Relations draws) and that page opens beside the one you are on: the main area splits into two equal halves, your page on the left, the one you ⌘-clicked on the right, both whole Logseq pages you write in. A plain click still goes to the page and Shift-click still opens it in the right sidebar; without the plugin Logseq treats ⌘-click as a plain click. One hairline stands between the halves; drag it to make one half wider (neither gets narrower than 320 px), double-click it for equal halves again. It is held just right of the line, so the left page's scroll bar stays free to grab. While the split is on, two icons stand in the window's top right corner, drawn as Logseq's own toolbar icons: ⇄ swaps the two pages, × closes the right page and the left one takes the whole width. To close the left page instead, press ⇄ then ×. Another ⌘-click while the split is on puts that page on the right instead. The right half is Logseq's own right sidebar drawn as a page, so after the split the sidebar is as it was, open on its tab or closed. Opening anything in the sidebar while the split is on (Shift-click, a view from the ··· menu) ends the split and shows the sidebar as always, the page from the right half among Opened; closing the sidebar closes the right half the same way. The right page reads as the same page does on the left: the tag path at the right end under its title, Threads' Linked section in place of Logseq's Linked references (folding, kinds, opening a node, picking, the + and its Undo all work there, and Escape goes to the page you last pressed in), a tag's page with its # and Ontology's Parent line, a property's page with its P and Ontology's lines, the same spacing, and no rule or empty Add property that Logseq's sidebar would add. Two things still differ: Logseq draws no Unlinked references for a page in its sidebar, and citation numbers stay as words there. If the page can't be shown on the right within a couple of seconds, the split closes, the sidebar goes back to how it was, and a notice says so, so a half never stands blank. The split writes nothing to the graph. It stands whichever parts run (`split.js`); switch it off with **⌘-click opens a page beside** under Following links.

## Settings

One window for the whole plugin: **Plugin settings**, from **g** then **,** outside a bullet (as Logseq's own g pairs), the gear on the plugin's card (Open settings), the command palette, or Logseq's three dots under Plugins. Down the left, the places where you meet things rather than the six parts that draw them: under *What you see* the window, a page and the right sidebar; under *What you do* writing, finding, following links (with what a ⌘-click on a link does) and taking a page out; under *Everything else* every keyboard shortcut in one list, and the parts (switch one on or off, and find a fault). A place lists its settings in the middle, one line each, with what each is set to at its right end and a dot before it when you changed it. The setting you pick shows on the right, large: its name, one plain line, then every choice as a picture of the thing itself, side by side, each named under it ("Blue", "Underlined"). The choice in force has a firmer edge and a ✓, the one the plugin came with says "as it came", and in each picture only what differs from the other choice keeps its full strength. A press on a picture takes it; Up and Down walk the settings, Left and Right the pictures. A number shows a picture at a few sizes and takes another typed; keys show what pressing them does, and Press new keys records the next keys you press; a list shows its words, each with its ×; your CSS for the PDF changes its picture as you type. A letter typed anywhere finds a setting through every place. A part switched on or off under Parts waits, washed in yellow (the look of a change about to be made; the dotted pencil is Predictive's alone), for **Reload to apply**, which brings you back to the window. Changed by you lists what differs from the start. Logseq's plain list is one word away at the foot; it also holds what the export window remembers.

**Update plugins**, from **u** then **p** outside a bullet, or the command palette: every plugin that is switched on comes to its newest; one switched off stays off. One loaded from a folder loads again, so it runs what changed there, and a notice says when it is done. One installed from a GitHub release or the Marketplace is fetched by Logseq's own updater, as Check update on its card does: a newer release is put in and the plugin reloads, and Logseq's notice says it was updated, or that it is up to date. This plugin goes last.

## The Mac's symbols

On a Mac, the icons can be the Mac's own symbols (SF Symbols): Logseq's top bar, left sidebar and menus, the icon of what a property holds, the plugin's toolbar buttons, and the icons of its own buttons and menus. Apple's symbols may be drawn by a Mac and shown on it, never copied, so the plugin holds only their names (the `SYMBOLS` list in `plugin.js`, the whole list the owner approved on 23 November 2026). `sh tools/mac-symbols.sh` has the Mac draw each one, once, into the plugin's storage in Logseq, `~/.logseq/storages/logseq-plugin/mac-symbols.json`, outside the plugin's folder, so an update never removes the file and nothing of Apple's is ever in this repository. Run it again after an update that adds symbols; then reload the plugin, or flip the switch off and on.

`Door.symbols` in `plugin.js` reads the file as the plugin starts, before any of the plugin's own icons are drawn, and lays each picture over its icon as a mask in the icon's own box and colour: the size, the place, light and dark, the pointer and a lit menu line stay the icon's. Logseq's own icons are on screen before any plugin starts, so at Logseq's start they are Logseq's for the moment until the plugin is up. With no file, a file that cannot be read, a symbol this macOS lacks, another system, or **Mac symbols** switched off (settings, The window, Icons; it applies at once), every icon is the drawing it always was, and nothing is said in the console.

Left as they are: the three joined dots of a property that points at a node (Apple's dotted triangle read fainter at that size), a task's status circle, the Ontology toolbar button, Add a child, an icon you gave a page or a tag, the bullet, its fold arrow, the tick box, and the mark of the graph beside its name. An icon not on the list (Remove from Favorites, the lines of a node's right-click menu) also stays as it is.

## From outside

The Alfred workflow in the workspace's `alfred/` folder adds things from anywhere on the Mac: words to today's journal, to the open page or to a page by name, and files and pictures into the graph. Words and pages go through Logseq's HTTP API; a file comes to the plugin (`outside.js`, which stands whichever modules run), because the API has no call that makes an asset node: the plugin pastes the file into an empty bullet of the page, as Logseq takes a dropped file, so it becomes a node of its own that Cite finds and Threads lists. The page is shown for a moment while the file goes in and the screen is put back, with the bullet that was being written in; a page named by the caller stays on screen. The call is `logseq.App.invokeExternalPluginCmd` with `["logseq-plugin", "models", "add", [{ files: [paths], where: "today" | "open" | { page: name } }]]`, answered with what was added or an error saying why.

## How it is built

No build step: plain scripts, loaded in the order `files.js` lists. `plugin.js` is the door each module registers at as it loads, and where it describes its rows for the settings window (`settings/`), which belongs to no module, so it works whichever are switched off. The door also holds what every module draws with, each drawn once: the greys and the shared class names, the buttons, the window and the pop-up frames, the tick box, the fold arrow, the bullet, the field, the nothing-here line, the icon of what a property holds, the one Undo (a faded arrow at the end of what changed, or waiting at the bottom right; a new change's arrow takes the last one's place, except that a change of many things, Ontology's Apply or a pick of several nodes in Threads, keeps its own arrow until the next change of many things, so filling in one value never takes it away), the one watcher of Logseq's screen (no module keeps a watcher of its own), and the one motion of what opens: it rolls out from nothing so what is below glides down, rolls back up when it closes, and stands still under reduced motion. Every motion's length and curve, the library's and each module's own (the focus glide, the key sheet, the notices, the pencilled values, Ontology's tray, Threads' folds), is named once there (`PluginDoor.MOTION`, with one Reduce motion check, `PluginDoor.still`), so each is changed in one place; `test/library.js` fails on a module timing a motion with a number of its own. Since 10 November 2026 the door also holds the groundwork every module stands on, each kept once: the module's base (`PluginDoor.base`: its stylesheets sent only when changed, its settings read with their defaults, its listeners on Logseq's window, Logseq's hooks and its passes on the screen watcher, all taken off again when the module stops), the one way to work Logseq's own menus and boxes (`PluginDoor.screen`: a press, a key, words typed into a box, whether a pop-up of Logseq's is open), the one date service (`PluginDoor.dates`: a day in words, "Oct 23" and "Oct 23, 2025" for another year, a journal's title in the graph's date format, the journal page of a day) and the small readers of the graph (the id pattern, `bare`, `pick`, `idOf`, `query`, the Apple helper's address). `main.js`, loaded last, gives Logseq every module's settings as one list, sends the shared names, keeps Logseq's frame in place (a focus that pushes it up is put back) and sets up the clean-up and the ways into the settings window before anything else; then it starts the modules one after another. One failing, or not answering, is said in a notice and leaves the rest running; every module that began is stopped; a file that did not load is named in a notice. Each module lives in its own folder (`look/`, `find/`, `predictive/`, `structure/`, `export/`, `threads/`, `todo/`) and keeps its code under a name of its own on the plugin's window, so the modules never touch each other's.

The six were written as six plugins and joined into one on 31 October 2026. This is now the only copy that changes; the six old folders are an archive.

## Checks

One command, from your own copy of the plugin (`logseq-workspace/work/<name>/`):

```
node tools/check.js                      # the change in this folder against GitHub's main: seconds
node tools/check.js --expect "Todo"      # the same, naming the screens the change means to alter
node tools/check.js --release            # everything, before a release: under two minutes
```

It checks six things, each for something that really went wrong here (19 November 2026; the checks before that day took a
quarter of an hour and two of them failed on an unchanged plugin):

| | What it guards | Where |
|---|---|---|
| safe | every write to the graph goes through the one door; an Undo never takes away later work; before a release, every kind of write made in a real Logseq, read back and taken back | `test/writes.js`, `undo.js`, `risks.js`, `tools/write-check.js` |
| library | no part draws a look of its own: a button, colour, size, shadow or motion, a library piece restyled, a grey mixed. What stood on 19 November is counted in `test/library-debts.json`: one more fails, one fewer is recorded with `node test/library.js --debts` | `test/library.js` |
| logic | Predictive's guesses, Ontology's changes, the export, Linked's reading of the graph, dates, keys | each part's `test/` |
| same | the screens a change can reach, photographed before and after; a difference on a screen not named in `--expect` stops it; the owner's earlier complaints stay as cases | `tools/guard/` |
| reads | on those screens: nothing cut off, too faint, out of line, empty, over other words, past the edge, at an odd size | `tools/guard/reads.js` |
| logseq | what the plugin relies on in Logseq is still there; its lines of words measure as Logseq's bullets do | `test/logseq-contract.js`, `tools/logseq-contract-app.js`, `reads.js` |

A change is checked only where it can reach: the parts whose files changed pick the logic checks, the screens and the cases
(`tools/check.js` holds the list). The guard's own Logseq (ports 9340 and 9341, its own home and copies of the test graphs) stays
running between checks and ends by itself after twenty idle minutes; `node tools/guard/guard.js stop` ends it at once.

**After a Logseq update**, before using the plugin: `node test/logseq-contract.js` fails as soon as Logseq's version is not the one
last checked. Run `node tools/check.js --release`, look at the plugin in Logseq, then `node test/logseq-contract.js --accept`.

## Releasing

By hand, with no GitHub Actions. Raise the version in `package.json`, then:

```
sh tools/release.sh
```

It runs `node tools/check.js --release` first and builds no zip unless it passes. Name the screens the release means to change (`sh tools/release.sh --expect "Todo"`); a difference on a named screen needs its reason, which the check says how to give.
