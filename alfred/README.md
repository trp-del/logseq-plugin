# Logseq for Alfred

Logseq from anywhere on the Mac, in Alfred's own panels (Alfred 6's Alfred UI): add a note with its tag guessed as you write,
tag what came in, see and tick your tasks, search, see a node whole and change it, walk from it, and put files and selections into the graph
seeing first what will be written. Version 4.1.

Built for Logseq 2.0.2, Alfred 6.0, and a Logseq Plugin from 18 November 2026 or later.

## Setup

1. In Logseq, enable the HTTP APIs server in **Settings → Features**, create a token and start the server. The address is
   `127.0.0.1:12315` unless you changed it.
2. In Alfred, open the workflow, choose **Configure Workflow…** and paste the token into **Logseq API Token**. The token is
   not exported with the workflow.
3. Install the Logseq Plugin in Logseq: the guesses, Todo, search, reading and files go through it. Without it, words still go in.
4. Keep Logseq running with the DB graph open.

## The panels

Each opens inside Alfred, at your theme's width. Esc closes a panel.

With the plugin rebuilt (0.9), Search and a node whole are answered by it again, and Home's typing and pane with them. Add's
guessed tag, Tag what came in, Todo and the files tray ask for parts of the plugin that are not rebuilt yet; until they are,
those panels say that the plugin did not answer. Their keys still stand along their foot.

- **Home**, `l`: Add to today (⌘1), Tag what came in with how many wait (⌘2), Todo with what is due (⌘3), then the pages you
  came back to. Typing finds pages by name at once; ↩ reads the lit page here, ⌘↩ opens it in Logseq, ⌘F searches the words of
  your notes, ⇥ adds the words as a note.
- **Add**, `lt` (today) and `la` (the page open in Logseq): the tag line above the words. After four words Predictive pencils the
  tag it would pencil in Logseq, with the properties it brings (guessed values lighter); ↩ writes all of it, ⌥↩ the words alone.
  With no sure guess, the three likeliest tags stand on ⌘1–⌘3 with their reasons; ⌘T lists all your tags in their tree, filtered
  as you type. The destination is a menu at the foot. Once added: what was written, Undo (⌘Z, which brings the words back to try
  again), Show in Logseq (⌘O), Add another (↩).
- **Tag what came in**, `ltag`: the notes added from Alfred with no tag, one at a time, with the tags each could be on ⌘1–⌘3 and
  ⌘T for any; ⇥ passes one by, ⌘⌫ leaves it untagged. At the end, what was tagged, and one Undo for all of it.
- **Todo**, `ltd`: the Todo page's list, grouped as it is there. Typing filters; ↩ with words adds a task ("by friday" is its
  Deadline); ⌘D done, ⌘G doing, ⌘Z takes the last change back, ⌘O shows the task in Logseq.
- **Search**, `ls`: Logseq's own search, each node with its kind and day. The lit one shows whole in the pane beside the
  list: its name and tags, what it holds, the start of its outline, how much points at it. ↩ opens it here, ⌘↩ opens it in
  Logseq, ⌘C copies it whole as Markdown.
- **A node whole** (from Search, and from Home): its name and tags, then one list of lines: each property with what it holds,
  each bullet in its place in the outline, then what points at the node (Provider of, Mentioned in). The arrows walk the
  lines, and the node is changed here as on its own page:

  | On | Press | What happens |
  |---|---|---|
  | a bullet | ↩ | The bullet becomes a field in its place, a link written as `[[its name]]`. ↩ writes the words, ⌥↩ is a new line, esc lets go. |
  | a property | ↩ | Set choices and nodes: a list to pick from, filtered as you type, the present one ticked. Words, a number, a day ("nov 18", "2026-11-18", "tomorrow"): a field in place. A tick box turns over. |
  | a node that points here | ↩ | Goes to it here. ⌥↩ does the same on a property's value and on a bullet. ⌘[ steps back, at last to Search or Home. |
  | a bullet | ⌘N | A new bullet after it (after the bullets under it), written in place. With no bullet lit, last in the node. |
  | a bullet | ⇥, ⇧⇥ | Moves it in and out, as in Logseq. |
  | a bullet, or the node | ⌘T | Your tags in their tree, filtered as you type; ↩ puts the lit one on, or takes it off where it is on. |
  | a bullet, or the node | ⌘D, ⌘G | Done, doing. |
  | a bullet, a property | ⌘⌫ | Deletes the bullet with those under it; clears the property. |
  | anywhere | ⌘Z | Takes the last change back: Logseq's own Undo, so ⌘Z in Logseq does the same. |
  | a bullet, or anywhere | ⌘C, ⇧⌘C | Copies the lit bullet with those under it, or the whole node, as Markdown. |
  | anywhere | ⌘↩ | Opens the node in Logseq. |

  The foot says what was just done ("Provider is now Dr. Raj Patel"). No key is written on these two panels at rest: **hold
  Option** and the foot names what can be done to the lit line. Undo and Copy work and are never named.
- **Files**, the Universal Action **Add files to Logseq…**: each file with the name its node will have; a file already in the graph
  is said before anything is added and is linked, not copied again. ↩ adds them, with a progress bar; then one Undo for all.
- **A selection**, the Universal Action **Add to Logseq…** or the hotkey: a quote with its citation (web page, document, PDF in the
  graph, as Cite writes them), or a page's link, shown as it will read before it is written, with the tag it could be, a line for
  your own words under it, and where it goes (today, the open page, a page named after the source). Files go to the files tray.
- `lp Name [#Tag]` makes or finds a page, `lpic` adds the picture on the clipboard, and **Add to Logseq as a page** puts a
  selection on a page of its own, as before.

The toast says what was added, or what went wrong, for the commands without a panel.

## How it works

`logseq.js` is run by osascript as JavaScript; Alfred runs it through executable copies of `runner.zsh` whose names are
the commands: `page`, `picture`, `page-selection` and `selection-prepare`. Each panel is a folder `<name>.alfredui` with its
`ui.json` (Alfred UI's JSON) and small scripts that run `logseq.js panel-<command>`, which answers in Alfred UI's JSON actions.
A panel's ↩ that leads elsewhere closes it with where to go, and the workflow opens the next panel by its External Trigger.
Alfred UI reads braces in a launch argument as placeholders, so a selection travels to its panel as base64. Words, links and pages go
through Logseq's HTTP API (`appendBlockInPage`, `createPage`, `addBlockTag`). Files go to the Logseq Plugin, through the
API's `logseq.App.invokeExternalPluginCmd`, as `["logseq-plugin", "models", "add", [{ files, where }]]`; the plugin pastes
each file into an empty bullet of the page, as Logseq's own paste handler takes a dropped file, because the API has no call
that makes an asset node.

Search and a node whole ask the plugin for everything (`find`, `node`, `candidates`, `tags`, `markdown`, and a name for each
change: `setWords`, `newBullet`, `move`, `remove`, `setValue`, `tag`, `status`, `undo`), so what Alfred shows and writes is what
Logseq shows and writes, with Logseq's own Undo. The node panel draws everything under the node's name anew at each step (the
list while walking, a field between two lists while writing), and keeps its state in the panel's variables. Alfred UI has no
event for a held key, so the two panels' pulse runs `read.alfredui/keys` a few times a second: it asks the keyboard whether
Option is down through `optionheld.swift`, built into Alfred's cache on first use like the toast (AppleScript answers until it
is built), and shows or hides the foot's guide only when the answer changes.

The toast: Alfred runs `toast`, a copy of `toast-runner.zsh`, which on first use compiles `toast.swift` into Alfred's cache
with Apple's Swift compiler (Command Line Tools needed) and then reuses the binary. If that fails, a standard notification
is shown and the compiler's output is in the cache as `toast-build.log`.

## Building the installer

```
sh build.sh
```

copies `runner.zsh` to each command name, `toast-runner.zsh` to `toast`, makes them executable, and zips the folder as
`Logseq.alfredworkflow` in `dist/`. Put an `icon.png` beside `info.plist` first, if you want one. Double-click the
installer; Alfred keeps the token and keywords from the earlier version, since the bundle id is the same.

## Troubleshooting

- **Logseq is not answering**: start Logseq and its HTTP API server.
- **Logseq rejected the API token**: paste the current token into the workflow's configuration.
- **Install Logseq Plugin 0.3.25 or newer**: files and pictures need the plugin running in Logseq.
- **No page is open in Logseq**: open a page before `la`, or add to Today.
- **Select some words first, or choose a file**: the hotkey found nothing selected and no saved document in front.
- **There is no tag named X**: make the tag in Logseq first.
