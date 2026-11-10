# DB Export

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

A page, or some blocks, out of Logseq as a **PDF** in a minimal look, as **Markdown**, or as **rich text** on the clipboard for Pages, Word, Mail or Google Docs. It reads your notes and never changes them.

## What comes out

**Everything a DB graph holds**, read straight from the database: the words with their bold, italics, code, links and highlights; links to pages as the page's name; tags; every property with its value as words (a page, a choice, a date, a number, yes/no, a URL), the page's Alias among them; tasks with their status, priority, deadline and scheduled day (a task row shows its box and leaves off the tag Task, which the box already says; with no task boxes the tag stays, then the only sign); headings; numbered lists; code blocks with their language; quotations; maths; pictures from the graph's assets folder; PDFs by name, with their highlights as quotations ("…", *Paper, p. 2*) and area highlights as pictures; queries with the rows they showed, as the table of their view or a list; embedded nodes in place; block references as the words they point at. On a tag's page, the nodes carrying the tag come after the page's own. Property values kept as blocks and templates are left out.

**Four styles.** *Document*: paragraphs, like a report; a short line with lines under it becomes a heading, and bullets start one level deeper. *Outline*: bullets, nested as in Logseq. *Timeline*: every dated node under its date, earliest or newest first, months as headings, a stay with an End date as a span ("9 – 12 Sept"). *Calendar*: one row per day. The dated styles take the date from your Date properties, then Deadline and Scheduled, then the journal day; or from one you pick.

**Four looks for the PDF**, all black on white with greys, hairlines and no colour: *Plain* (Helvetica Neue, headings by weight), *Book* (a serif in a narrow measure, centred title), *Compact* (smaller and tighter, for long notes), *Typewriter* (one monospaced face). Paper A4 or Letter, narrow, normal or wide margins, three text sizes, a footer and page numbers in the page's margin. A **title block**: a line above the title, a subtitle, today's date, "Prepared by". Your own CSS can be added in the settings (the classes are named in `core/html.js`). The looks name static fonts only: the Mac's system font is a variable font, which prints as outlines, and the words of such a PDF cannot be selected or searched.

**Markdown** is CommonMark with GitHub's extras: `- [ ]` task boxes (and then no `#Task` after the words), tables for query views, `~~struck~~`, fenced code. Page links come out as plain words, as `[[wikilinks]]` (Obsidian) or as `[Page](Page.md)`; a page's properties as lines under the title or as YAML front matter. Pictures and PDFs are linked by their path in the graph's `assets` folder, so a copy of that folder beside the file keeps them.

**Rich text** is the same page with the look's styles written inline, so a pasting app keeps them; its plain-text form is the Markdown.

## How to use it

- Command palette: **Export: this page…**, **Export: the selected blocks…**. Quick, with the remembered choices and no window: **Export: copy this page as Markdown**, **Export: save this page as PDF**.
- A bullet's right-click menu: **Export as PDF or Markdown…** (that bullet with everything under it). Select several bullets first to export them together. The page's **…** menu and the menu under its title: the same item (Logseq's own *Export page* is a different thing: its JSON, EDN and text forms).

The export window is drawn in Logseq's own window, in the look **Look** gives everything (the visual grammar in `grammar.html` in the workspace): where the export goes as three quiet words with the one in force in the text colour, choices as quiet words that drop a list, groups told apart by a gap and never a line, a field as one line under the words, and the properties to show as the grammar's rows, each with the icon of what it holds; their tick boxes appear when the pointer is on the list, and a ticked one stays. The window is built from Look's shared names (`lk-row`, `lk-list`, `lk-tick`, `lk-prop`, `lk-count`) and carries no look of its own for them; with Look switched off it still works, only plainer (the ticks always showing, a count after each property).

The export window is a toolbar over the page, like a document editor: for the PDF, the sheets as they will print, A4 or Letter with the margins, footer and page numbers chosen, broken where the print breaks; for rich text, the page at its width; for Markdown, the text itself. All redraw as you choose. Over them, at the right of the desk and alone, how large they are drawn: to fit the window, or 75 to 150 percent. The toolbar is a row of controls, each a small name over its value, the value being what you press: first where the export goes, **PDF**, **Markdown** or **Rich text**; then only the choices that apply: the style for all three; the look, *page* (paper, margins, text size, footer, page numbers) and *title block* for the PDF and rich text; links and front matter for Markdown; *show* for all: *Tags* and *Task boxes* as switches that read their state, and two tick-lists of properties, each headed by whose they are, *of the page* and *of the nodes* (for blocks, the chosen blocks' and those under them), over *all* and *none*; one column each, two only when a list is longer than ten. A value with a small chevron unfolds what it can become as a line of words under the bar, from its own left edge, so nothing else in the bar moves; *page*, *title block* and *show* unfold their own row of controls under the bar, and every row stays folded until its value is pressed. Click any words in the page to change them for this export (your notes do not change); they stay through a change of look, paper or footer, and when something changes what is on the sheet (a property, the tags, the style) the sheet is drawn again from the page and a notice says they went. Then the one button that matches: **Save PDF…** (the system's print window: on the Mac, choose *Save as PDF* in its PDF menu; the page's title is the file name), **Copy Markdown** or **Save as file…** (choose a folder; the file is named after the page and shown in the Finder; a file of that name is left alone and the new one gets the next number, "Notes 2.md"), **Copy rich text**. Cancelling the folder window leaves the export window as it was. So does the print window, whatever was done in it, since it does not say whether it saved: the export window comes back, and Escape closes it. Cmd Enter presses that button; Escape folds what is open, then closes the window, as does the × at the right. Every choice is remembered. A property left out stays left out on later exports, on pages that do not list it too, until it is ticked again.

## How it is built

```
core/        pure: no Logseq, no screen. Runs in Node, so it is tested there.
  inline.js    the words' markup read into tokens, written as HTML, Markdown or plain text
  dates.js     days and times as Logseq keeps them, written one way
  doc.js       the document: nodes, properties, tasks, the dated entries, the layouts
  markdown.js  the document as Markdown
  html.js      the document as HTML, every element with a named class
  themes.js    the four looks and the page: a stylesheet for printing, the same rules inline for the clipboard
logseq/      the only code that knows Logseq
  db.js        reads a page or blocks into the document (three queries, however many nodes)
  files.js     pictures from the graph's assets folder (assets://, or baked in as data URLs); saving a file through Logseq's folder dialog and write bridge (a plugin's download goes nowhere in Logseq's window)
  clipboard.js rich text or Markdown onto the clipboard
  print.js     the printed page and the print window (its frame in Logseq's document, beside the export window)
  preview.js   the printed page previewed as sheets: the blocks dealt onto pages of the paper's size, as the print will break them
  ui.js        the export window with its live preview, drawn into Logseq's document from the grammar's shared names
main.js      registers at the plugin's door
test/        core.test.js (the core on a hand-made document), load.js (every file against a pretend Logseq), window.js (the export window in a jsdom stand-in for Logseq's document; skipped without jsdom), graph.js, sample.js
tools/       preview.js (every look and layout as pictures and PDFs, with Playwright), app/check.js (the real Logseq, read-only)
```

```
node test/core.test.js    # the core
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js      # against a pretend Logseq
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/window.js    # the window in jsdom
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/preview.js dist/preview
```

## Checked in Logseq 2.0.2 (2026-10-29)

Loaded unpacked on the Illness Test Graph: the page on screen, a journal with PDFs, highlights and a picture, a page of queries and a tag page read into documents (under 0.4 s each); the export window and its preview drawn; the folder dialog and the print window opened from the plugin. `tools/app/check.js` repeats the reading part.

## What is not done

- Markdown names pictures by their path in the graph's assets folder; it does not copy the files beside it.
- A query is read as Logseq's own query API returns it; its table's columns and row order are read from the page when the query is drawn on screen, else the rows come in the API's order with no columns.
- Dates are written in the system's language and order.
