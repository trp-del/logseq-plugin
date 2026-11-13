# Logseq for Alfred

Adding things to a Logseq DB graph quickly, from anywhere on the Mac, in the shape the Logseq Plugin gives them. Version 3.0
does one job: adding. Searching and walking happen inside Logseq, in Find.

Built for Logseq 2.0.2, Alfred 5.7 and Logseq Plugin 0.3.25.

## Setup

1. In Logseq, enable the HTTP APIs server in **Settings → Features**, create a token and start the server. The address is
   `127.0.0.1:12315` unless you changed it.
2. In Alfred, open the workflow, choose **Configure Workflow…** and paste the token into **Logseq API Token**. The token is
   not exported with the workflow.
3. Install the Logseq Plugin (0.3.25 or newer) in Logseq: files and pictures go through it.
4. Keep Logseq running with the DB graph open.

macOS may ask for Alfred to automate Safari, Google Chrome, Orion or System Events, for where a selection came from.

## Ways in

Three keywords for words typed into Alfred, one for the clipboard, and two Universal Actions (with a hotkey) for what is
selected or chosen elsewhere. Each goes straight to its place; nothing asks.

- `lt words` — a bullet on today's journal.
- `la words` — a bullet on the page open in Logseq.
- `lp Name` — a page named so, made if there is none, shown in Logseq. `lp Name #Tag` tags it with an existing tag (a tag
  that does not exist is refused: tags are made in Logseq, in Ontology).
- `lpic` — the picture on the clipboard, into the graph on today's journal. `lpic Name` puts it on a page named so.
- **Add to Logseq Today** (a Universal Action, or the hotkey, which you set after installing):
  - files chosen in Finder, or anywhere Alfred takes files: each into the graph on today's journal;
  - words selected in Safari, Chrome or Orion: a quote, then a citation to the page;
  - a web page with nothing selected: its link;
  - words selected in a document (a PDF in Preview): a quote, then a citation to the document, with its page when the
    window says it; a PDF that is already in the graph is cited as that PDF;
  - a saved document in front with nothing selected: the document itself into the graph.
- **Add to Logseq as a page**: the same, each on a page of its own, made if there is none: a file on a page named after it
  (without its extension), words on a page named after the web page or document they came from.

A file put into the graph is what Logseq makes when a file is dropped into it: a node of its own, titled by the file's
name, the file copied into the graph's assets folder. So a PDF added here is found by the plugin's Cite, listed by
Threads, and opens inside Logseq. A citation is written as Cite writes one: `([Title](url))` for the web, `(*Name*, p. 3)`
for a document, `([[the PDF]], p. 3)` for a PDF in the graph. No date is written: on a journal the day is the journal's.

Logseq stays where it is: an add to today's journal or to the open page shows the page for a moment while the file goes in
and puts the screen back, with the bullet you were writing in; an add to a page by name leaves that page on screen.
Logseq does not come to the front.

A large file Logseq is slow to take keeps its bullet on the page, so the file shows there once Logseq has it; the toast then says Logseq has not taken it yet.

The toast says what was added, or what went wrong: `Added Scan.pdf to Today`, `Made the page “Letters”`, `Error: No page
is open in Logseq`.

## How it works

`logseq.js` is run by osascript as JavaScript; Alfred runs it through executable copies of `runner.zsh` whose names are
the commands: `today`, `active`, `page`, `picture`, `today-selection` and `page-selection`. Words, links and pages go
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
