# Logseq for Alfred

Logseq from anywhere on the Mac, in Alfred's own panels (Alfred 6's Alfred UI): add a note with its tag guessed as you write,
tag what came in, see and tick your tasks, search, read a page and walk from it, and put files and selections into the graph
seeing first what will be written. Version 4.0.

Built for Logseq 2.0.2, Alfred 6.0, and a Logseq Plugin from 18 November 2026 or later.

## Setup

1. In Logseq, enable the HTTP APIs server in **Settings → Features**, create a token and start the server. The address is
   `127.0.0.1:12315` unless you changed it.
2. In Alfred, open the workflow, choose **Configure Workflow…** and paste the token into **Logseq API Token**. The token is
   not exported with the workflow.
3. Install the Logseq Plugin in Logseq: the guesses, Todo, search, reading and files go through it. Without it, words still go in.
4. Keep Logseq running with the DB graph open.

## The panels

Each opens inside Alfred, 900 wide, with room around its parts and no text smaller than 14; the keys stand along its foot.
Esc closes a panel.

- **Home**, `l`: Add to today (⌘1), Tag what came in with how many wait (⌘2), Todo with what is due (⌘3), then the pages you
  came back to under their own heading. When a page is lit, a pane beside the list shows its tags, its properties and where it
  leads; an action has no pane. Typing finds pages by name at once; ↩ reads the lit page here, ⌘↩ opens it in Logseq, ⌘F searches the words of
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
- **Search**, `ls`: Logseq's own search, each note with its kind and day; a pane beside the list shows the lit note's words in
  full with its properties, or a page's tags and where it leads. ↩ reads it here, ⌘↩ opens it in Logseq.
- **A page read here**: its tags beside its title, its bullets, then its relations under them: its properties, and where it leads: its properties' pages, what points at it by
  property (Provider of · 4 Consultations), what mentions it. ↩ walks into the lit one, ⌘[ steps back, ⌘↩ opens it in Logseq.
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
The panels draw in macOS 27's glass, on Alfred's own window: the button ↩ presses is a glass capsule (Alfred UI's
`effect: glass`, the default button's blue), other keys stay grey words, a lit row is a soft see-through wash
(`quaternaryLabelColor`) the words keep their colours on, and headings are in sentence case.
The pane (Home and Search) is filled when the lit row changes: the list's `changed` event runs `pane`, which asks the plugin's
`read` and replaces the pane's view; a heading row is stepped past the way the arrows were going.
Alfred UI reads braces in a launch argument as placeholders, so a selection travels to its panel as base64. Words, links and pages go
through Logseq's HTTP API (`appendBlockInPage`, `createPage`, `addBlockTag`). Files go to the Logseq Plugin, through the
API's `logseq.App.invokeExternalPluginCmd`, as `["logseq-plugin", "models", "add", [{ files, where }]]`; the plugin pastes
each file into an empty bullet of the page, as Logseq's own paste handler takes a dropped file, because the API has no call
that makes an asset node.

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
