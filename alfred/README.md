# Logseq for Alfred

Logseq from anywhere on the Mac, in Alfred's own panels (Alfred 6's Alfred UI): add a note with a tag you pick, see and
tick your tasks, search, see a node whole and change it, walk from it, and put files and selections into the graph seeing first
what will be written. Version 4.1.2.

Built for Logseq 2.0.2, Alfred 6.0, and the Logseq Plugin this folder comes with (the workflow is the plugin's `alfred/` folder).

## Setup

1. In Logseq, enable the HTTP APIs server in **Settings → Features**, create a token and start the server. The address is
   `127.0.0.1:12315` unless you changed it.
2. In Alfred, open the workflow, choose **Configure Workflow…** and paste the token into **Logseq API Token**. The token is
   not exported with the workflow.
3. Install the Logseq Plugin in Logseq: tags, Todo, Home, search, a node whole and files go through it. Without it, words still go in.
4. Keep Logseq running with the DB graph open.

## The panels

Each opens inside Alfred, at your theme's width. Esc closes a panel.

What a panel writes is written by the plugin, and a panel says added, done or changed only when the plugin answered that it
wrote. When it did not (Logseq refused, the plugin is off or does not answer), the panel says why in red and keeps what you typed.

- **Home**, `l`: Add to today (⌘1) and Todo with what is due (⌘2), your kinds with how many nodes each has, then the pages you
  opened last. Typing finds as Logseq's search does and lights a kind whose name starts with the letters: ⇥ or a press takes
  the kind, which then stands before the line with its nodes under it, newest first, narrowed by what you type; ⌘⌫ lets it go.
  ↩ reads the lit node here, ⌘↩ opens it in Logseq. The last row takes the words typed to Add. With a task lit, ⌘D is done, ⌘G
  doing, and ⌘Z takes that back.
- **Add**, `lt` (today) and `la` (the page open in Logseq): the tag line above the words reads none until you pick a tag: ⌘T
  lists all your tags in their tree, filtered as you type, and ↩ takes the lit one. No tag is guessed. ↩ writes the note with
  its tag, ⌥↩ the words alone. The destination is a menu at the foot. Once added: where it was written, Undo (⌘Z, which brings
  the words back to try again), Show in Logseq (⌘O), Add another (↩).
- **Todo**, `ltd`: the Todo page's list, grouped as it is there. Typing filters; ↩ with words adds a task ("by friday" is its
  Deadline); ⌘D done, ⌘G doing, ⌘Z takes back what the panel changed last, ⌘O shows the task in Logseq.
- **Search**, `ls`: Logseq's own search, each node with its kind and day. The lit one shows whole in the pane beside the
  list: its name and tags, what it holds, the start of its outline, how much points at it. ↩ opens it here, ⌘↩ opens it in
  Logseq, ⌘C copies it whole as Markdown.
- **A node whole** (from Search, and from Home): its name and tags, then one list of lines: each property with what it holds,
  each bullet in its place in the outline, then what points at the node (Provider of, Mentioned in). The arrows walk the
  lines, and the node is changed here as on its own page:

  | On | Press | What happens |
  |---|---|---|
  | a bullet | ↩ | The bullet becomes a field in its place, a link written as `[[its name]]`. ↩ writes the words, ⌥↩ is a new line, esc lets go. |
  | a property | ↩ | Set choices: the Mac's own list of them, hanging from the value, the present one ticked. Nodes: a list to pick from, filtered as you type, the present one ticked. Words, a number, a day ("nov 18", "2026-11-18", "tomorrow"): a field in place. A tick box turns over. |
  | a node that points here | ↩ | Goes to it here. ⌥↩ does the same on a property's value and on a bullet. ⌘[ steps back, at last to Search or Home. |
  | a bullet | ⌘N | A new bullet after it (after the bullets under it), written in place. With no bullet lit, last in the node. |
  | a bullet | ⇥, ⇧⇥ | Moves it in and out, as in Logseq, also while it is being written: what is typed is written, the bullet moves, and it is a field again. |
  | a bullet, or the node | ⌘T | Your tags in their tree, filtered as you type; ↩ puts the lit one on, or takes it off where it is on. |
  | a bullet, or the node | ⌘D, ⌘G | Done, doing. |
  | a bullet, a property | ⌘⌫ | Deletes the bullet with those under it; empties the property, whatever its kind (a tick box is emptied, never turned over). |
  | anywhere | ⌘Z | Takes back what the panel changed last, with Logseq's own Undo, in as many steps as the change took. With nothing changed in the panel it does nothing. If something else changed in the graph since, it says so and takes nothing back: use Undo in Logseq. |
  | a bullet, or anywhere | ⌘C, ⇧⌘C | Copies the lit bullet with those under it, or the whole node, as Markdown. |
  | anywhere | ⌘↩ | Opens the node in Logseq. |

  The foot says what was just done ("Provider is now Dr. Raj Patel"). No key is written on these two panels at rest: **hold
  Option** and the foot names what can be done to the lit line. Undo and Copy work and are never named.
- **Files**, the Universal Action **Add files to Logseq…**: each file with the name its node will have; a file already in the graph
  is said before anything is added and is linked, not copied again. ↩ adds them, with a progress bar; then one Undo for all.
  The plugin puts the files into the graph; one that cannot says so at the head of the tray, and nothing is said to be added.
- **A selection**, the Universal Action **Add to Logseq…** or the hotkey: a quote with its citation (web page, document, PDF in the
  graph, as Cite writes them), or a page's link, shown as it will read before it is written, with a line for your own words under
  it, and where it goes (today, the open page, a page named after the source). Undo takes the quote and your words back together.
  Files go to the files tray.
- `lp Name [#Tag]` lists the pages with that name as you type; ↩ shows the lit one in Logseq, and the last row makes a page of
  the words typed when no page has that very name. `lpic` adds the picture on the clipboard, and **Add to Logseq as a page** puts
  a selection on a page of its own.

The toast says what was added, or what went wrong, for the commands without a panel.

## How it works

`logseq.js` is run by osascript as JavaScript; Alfred runs it through executable copies of `runner.zsh` whose names are
the commands: `page`, `picture`, `page-selection` and `selection-prepare`. `lp` is a Script Filter that runs `logseq.js filter-page`
at each letter. Each panel is a folder `<name>.alfredui` with its `ui.json` (Alfred UI's JSON) and small scripts that run
`logseq.js panel-<command>`, which answers in Alfred UI's JSON actions.
A panel's ↩ that leads elsewhere closes it with where to go, and the workflow opens the next panel by its External Trigger.
Alfred UI reads braces in a launch argument as placeholders, so a selection travels to its panel as base64.

Everything is asked of the plugin through the API's `logseq.App.invokeExternalPluginCmd`, as
`["logseq-plugin", "models", "<name>", [request]]`, one way (`ask` in `logseq.js`): no answer, and an answer of
`{ ok: false, said }`, are both errors with words to show, so nothing is read as done that was not. Add and a selection ask
`note` (the words, where they go, the picked tag, your own words under them) and `tags`; Todo asks `todoList`, `todoAdd`,
`todoStatus` and `todoUndo`; Home asks `browse`; Show in Logseq asks `show`; files ask `check`, `add`, `progress` and `unadd`.
Words and links added without a panel go to `append`, which sets down a bullet being written in Logseq for the moment, so Logseq
makes no tag named by an id out of a #tag in it. Without the plugin, words and pages go through Logseq's HTTP API
(`appendBlockInPage`, `createPage`, `addBlockTag`).

Search and a node whole ask the plugin for everything (`find`, `node`, `candidates`, `tags`, `markdown`, and a name for each
change: `setWords`, `newBullet`, `move`, `remove`, `setValue`, `tag`, `status`, `undo`), so what Alfred shows and writes is what
Logseq shows and writes, with Logseq's own Undo. The plugin keeps what Alfred changed last and how many steps of Undo it took,
and takes back only that: a change made in Logseq since ends it. The node panel draws everything under the node's name anew at each step (the
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

copies `runner.zsh` to each command name, `toast-runner.zsh` to `toast`, makes them executable, packs `build.sh` and the two
runners themselves beside them, and zips the folder as `Logseq.alfredworkflow` in `dist/`. Put an `icon.png` beside `info.plist` first, if you want one. Double-click the
installer; Alfred keeps the token and keywords from the earlier version, since the bundle id is the same.

## Troubleshooting

- **Logseq is not answering**: start Logseq and its HTTP API server.
- **Logseq rejected the API token**: paste the current token into the workflow's configuration.
- **The Logseq Plugin in Logseq did not answer**: the plugin is off, reloading, or older than this workflow. Switch it on in
  Logseq, or install the plugin this workflow came with.
- **This Logseq Plugin cannot put files into the graph yet**: the plugin in Logseq has no way to take a file in. Words, links and
  selections still go in.
- **Not taken back: the graph has changed since**: something else was changed after the change you want back. Use Undo in Logseq.
- **No page is open in Logseq**: open a page before `la`, or add to Today.
- **Select some words first, or choose a file**: the hotkey found nothing selected and no saved document in front.
- **There is no tag named X**: make the tag in Logseq first.
