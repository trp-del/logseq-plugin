# Logseq for Alfred

Logseq from anywhere on the Mac, in Alfred's own panels (Alfred 6's Alfred UI): add a note with its tag guessed as you write,
and put files and selections into the graph seeing first what will be written. Version 4.0.

Built for Logseq 2.0.2, Alfred 6.0, and a Logseq Plugin from 18 November 2026 or later.

## Setup

1. In Logseq, enable the HTTP APIs server in **Settings → Features**, create a token and start the server. The address is
   `127.0.0.1:12315` unless you changed it.
2. In Alfred, open the workflow, choose **Configure Workflow…** and paste the token into **Logseq API Token**. The token is
   not exported with the workflow.
3. Install the Logseq Plugin in Logseq: the guesses and files go through it. Without it, words still go in.
4. Keep Logseq running with the DB graph open.

## The panels

Each opens inside Alfred, 900 wide, with room around its parts and no text smaller than 14; the keys stand along its foot.
Esc closes a panel.

- **Add**, `lt` (today) and `la` (the page open in Logseq): the tag line above the words. After four words Predictive pencils the
  tag it would pencil in Logseq, with the properties it brings (guessed values lighter); ↩ writes all of it, ⌥↩ the words alone.
  With no sure guess, the three likeliest tags stand on ⌘1–⌘3 with their reasons; ⌘T lists all your tags in their tree, filtered
  as you type. The destination is a menu at the foot. Once added: what was written, Undo (⌘Z, which brings the words back to try
  again), Show in Logseq (⌘O), Add another (↩).
- **Files**, the Universal Action **Add files to Logseq…**: each file with the name its node will have; a file already in the graph
  is said before anything is added and is linked, not copied again. ↩ adds them, with a progress bar; then one Undo for all.
- **A selection**, the Universal Action **Add to Logseq…** or the hotkey: a quote with its citation (web page, document, PDF in the
  graph, as Cite writes them), or a page's link, shown as it will read before it is written, with the tag it could be, a line for
  your own words under it, and where it goes (today, the open page, a page named after the source). Files go to the files tray.

The workflow's keywords are `lt` and `la`; its Universal Actions are **Add files to Logseq…** and **Add to Logseq…**.

Removed on 24 November 2026: `lp Name [#Tag]` (make or find a page), `lpic` (the clipboard's picture), the Universal Action
**Add to Logseq as a page**, and the panels Home (`l`), Todo (`ltd`), Search (`ls`) and a page read inside Alfred. The toast
is still in the workflow, but with those commands gone nothing runs it: every way in now ends in a panel.

## How it works

`logseq.js` is run by osascript as JavaScript; Alfred runs it through executable copies of `runner.zsh` whose names are
the commands: now one, `selection-prepare`. Each panel is a folder `<name>.alfredui` with its
`ui.json` (Alfred UI's JSON) and small scripts that run `logseq.js panel-<command>`, which answers in Alfred UI's JSON actions.
A panel's ↩ that leads elsewhere closes it with where to go, and the workflow opens the next panel by its External Trigger
(a selection of files goes to the files panel).
The panels draw in macOS 27's glass, on Alfred's own window: the button ↩ presses is a glass capsule (Alfred UI's
`effect: glass`, the default button's blue), other keys stay grey words, a lit row is a soft see-through wash
(`quaternaryLabelColor`) the words keep their colours on, and headings are in sentence case.
Alfred UI reads braces in a launch argument as placeholders, so a selection travels to its panel as base64. Words, links and pages go
through Logseq's HTTP API (`appendBlockInPage`, `createPage`, `addBlockTag`). Files go to the Logseq Plugin, through the
API's `logseq.App.invokeExternalPluginCmd`, as `["logseq-plugin", "models", "add", [{ files, where }]]`; the plugin pastes
each file into an empty bullet of the page, as Logseq's own paste handler takes a dropped file, because the API has no call
that makes an asset node.

The toast (run by nothing since 24 November 2026): `toast` is a copy of `toast-runner.zsh`, which on first use compiles `toast.swift` into Alfred's cache
with Apple's Swift compiler (Command Line Tools needed) and then reuses the binary. If that fails, a standard notification
is shown and the compiler's output is in the cache as `toast-build.log`.

## Building the installer

```
sh build.sh
```

copies `runner.zsh` to the command's name, `toast-runner.zsh` to `toast`, makes them executable, and zips the folder as
`Logseq.alfredworkflow` in `dist/`. Put an `icon.png` beside `info.plist` first, if you want one. Double-click the
installer; Alfred keeps the token and keywords from the earlier version, since the bundle id is the same.

## Troubleshooting

- **Logseq is not answering**: start Logseq and its HTTP API server.
- **Logseq rejected the API token**: paste the current token into the workflow's configuration.
- **Install Logseq Plugin 0.3.25 or newer**: files need the plugin running in Logseq.
- **No page is open in Logseq**: open a page before `la`, or add to Today.
- **Select some words first, or choose a file**: the hotkey found nothing selected and no saved document in front.
