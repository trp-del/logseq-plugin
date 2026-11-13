# DB Export

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

A page, or some blocks, out of Logseq as a **PDF** in a minimal look, as **Markdown**, or as **rich text** on the clipboard for Pages, Word, Mail or Google Docs. It reads your notes and never changes them.

## What comes out

**Everything a DB graph holds**, read straight from the database: the words with their bold, italics, code, links and highlights; links to pages as the page's name; tags; every property with its value as words (a page, a choice, a date, a number, yes/no, a URL), the page's Alias among them; tasks with their status, priority, deadline and scheduled day (a task row shows its box and leaves off the tag Task, which the box already says; with no task boxes the tag stays, then the only sign); headings; numbered lists; code blocks with their language; quotations; maths; pictures from the graph's assets folder; PDFs by name, with their highlights as quotations ("…", *Paper, p. 2*) and area highlights as pictures; queries with the rows they showed, as the table of their view or a list; embedded nodes in place; block references as the words they point at. On a tag's page, the nodes carrying the tag come after the page's own. Property values kept as blocks and templates are left out.

**Five styles.** *Document*: paragraphs, like a report; a short line with lines under it becomes a heading, and bullets start one level deeper. *Outline*: bullets, nested as in Logseq. *Prose*: flowing paragraphs (below). *Timeline*: every dated node under its date, earliest or newest first, months as headings, a stay with an End date as a span ("9 – 12 Sept"). *Calendar*: one row per day. The dated styles take the date from your Date properties, then Deadline and Scheduled, then the journal day; or from one you pick.

**Prose** (12 November 2026) is the page as written text. Only a bullet started with #, ## or ### is a heading, one step in from the heading it sits under, as in the sidebar's Outline; every other line of words is a paragraph. The bullets under a line become, by a choice in the window, sentences of its paragraph (the start; a full stop is added where one is missing), a paragraph each, or stay bullets. A numbered list, a task with its box, a table, a quotation, code and a picture stay as they are, and a line that shows properties starts a paragraph of its own. Each citation (what /Cite writes: a page, a web address or plain words in brackets, with a page number or none) becomes a raised number, after the full stop or comma that followed it, and the notes close the document under "Notes": the same source at the same page once, numbered in the order of the page, as Endnotes numbers them in the sidebar; a web address is written out. In the other styles a citation stays as written. Under the style, in the column's *Text* group: the bullets under a line; headings numbered (1, 1.1) or not; headings under a # on their own line or leading their paragraph in bold; the words over the notes (empty: none, a hairline instead); a contents list of the headings under the title (PDF and rich text; no page numbers in it, which the print cannot know); the title on its own sheet; each # on a new sheet (PDF). In Markdown the citations are footnotes, `[^1]` with `[^1]: Blood panel, p. 3.` at the end, and there is no contents list.

**Templates.** A template is a named set of the window's choices: where the export goes, the style and its row, the look, the page, the date and "prepared by", tags, task boxes, the properties left out, the Markdown choices and your own CSS. Three come with the plugin, all Prose: *Report* (Plain, numbered headings, a contents list), *Paper* (Book, wide margins, no numbers), *Brief* (Compact, small, narrow margins, headings under a # leading their paragraph, no heading over the notes). *template* is on the bar: its value is the one in force, with "· changed" once a choice differs from it; pressed, it lists the templates, then **Save changes to …**, **Save as new…** (the name is typed in the same line; Enter takes it, a name in use is refused), **Rename…** and **Delete…** for your own (a delete is asked about in the line: Delete or Keep). One of the plugin's saved under its own name is yours from then on, and *Back to the plugin's …* drops your changes. A pick changes only what the template holds. Rules of your own that no template holds are saved as the template *Earlier CSS* before a pick replaces them.

**Your CSS**, the column's last group for the PDF and rich text: a box of rules added after the look's, and under it the parts of the sheet on screen in plain words (Title, Heading, Paragraph, Citation number, Note…). A word pointed at lights its part on the sheet; pressed, the part's rule in the look in force is written into the box, each declaration on a line, to change from there. The same box is in the plugin's settings.

**Four looks for the PDF**, all black on white with greys, hairlines and no colour: *Plain* (Helvetica Neue, headings by weight), *Book* (a serif in a narrow measure, centred title), *Compact* (smaller and tighter, for long notes), *Typewriter* (one monospaced face). Paper A4 or Letter, narrow, normal or wide margins, three text sizes, a footer and page numbers in the page's margin. A **title block**: a line above the title, a subtitle, today's date, "Prepared by". Your own CSS can be added in the settings (the classes are named in `core/html.js`). The looks name static fonts only: the Mac's system font is a variable font, which prints as outlines, and the words of such a PDF cannot be selected or searched.

**Markdown** is CommonMark with GitHub's extras: `- [ ]` task boxes (and then no `#Task` after the words), tables for query views, `~~struck~~`, fenced code. Page links come out as plain words, as `[[wikilinks]]` (Obsidian) or as `[Page](Page.md)`; a page's properties as lines under the title or as YAML front matter. Pictures and PDFs are linked by their path in the graph's `assets` folder, so a copy of that folder beside the file keeps them.

**Rich text** is the same page with the look's styles written inline, so a pasting app keeps them; its plain-text form is the Markdown.

The preview never stands empty between two drawings: a change of target, look or paper is drawn in a frame of its own, unseen, and takes the old one's place once it is laid out.

## How to use it

- Command palette: **Export: this page…**, **Export: the selected blocks…**. Quick, with the remembered choices and no window: **Export: copy this page as Markdown**, **Export: save this page as PDF**.
- A bullet's right-click menu: **PDF or Markdown, your styles…** (that bullet with everything under it). Select several bullets first to export them together. The page's **…** menu and the menu under its title: the same item (Logseq's own *Export page* is a different thing: its JSON, EDN and text forms).

The export window is drawn in Logseq's own window, in the look **Look** gives everything (the visual grammar in `grammar.html` in the workspace): where the export goes as three quiet words with the one in force in the text colour, choices as quiet words that drop a list, groups told apart by a gap and never a line, a field as one line under the words, and the properties to show as the grammar's rows, each with the icon of what it holds; their tick boxes appear when the pointer is on the list, and a ticked one stays. The window is built from Look's shared names (`lk-row`, `lk-list`, `lk-tick`, `lk-prop`, `lk-count`) and carries no look of its own for them; with Look switched off it still works, only plainer (the ticks always showing, a count after each property).

The export window is a quiet bar over the page, with a column of choices beside the sheet (the owner, 12 November 2026, in place of rows that unfolded under the bar). On the desk: for the PDF, the sheets as they will print, A4 or Letter with the margins, footer and page numbers chosen, broken where the print breaks; for rich text, the page at its width; for Markdown, the text itself. All redraw as you choose. Over them, at the right of the desk and alone, how large they are drawn: to fit the window, or 75 to 150 percent. The bar holds four things: **Adjust**, which shows the column or puts it away (remembered); where the export goes, **PDF**, **Markdown** or **Rich text**, as tabs with a bar under the one in force; the **template**, whose list is a pop-up under it (it stands last on the left, so its changing words push nothing); and at the right the one button that does the export. The column, on the left of the sheet, holds every other choice, drawn as the library's menu laid open (the owner, 13 November 2026, of the first column: "it has no structure, doesn't pull from library ui elements"): parts under a heading in the text colour, a hairline between one part and the next, and under each its rows, a row being one line pressed as a whole with what it holds at its right in the quiet grey. The parts: *Text* (the style), *Prose* and *Timeline and Calendar* (the rows of those styles), *Look* (type, text size, paper, margins, page numbers, footer), *Title* (today's date, the line above, the subtitle, prepared by), *Markdown* (links, front matter), *Show* (tags, task boxes, and two tick-lists of properties, each headed by whose they are over *all* and *none*) and *Your CSS*. The column is anchored (the owner, 13 November 2026: "the sidebar just jumps based on menu selection. it should be anchored"): every part and row keeps its place whatever is chosen, and what belongs to another style or destination is faint and out of reach of the pointer and the keys, never taken away. There are three kinds of row. One that holds one of several (Style, Paper) brings them as a pop-up menu at the row when pressed, over the rows below so that nothing in the column moves (the owner, 13 November 2026: "pushes everything down"), the one in force ticked; it goes once one is taken, at Escape (the keys go back to its row), or at a press elsewhere. One that is on or off (Contents list, Page numbers) shows a tick while on, and a press on the row, Enter or Space turns it. One that is written in (Footer, Subtitle) has a field on a hairline at its right. Up and Down walk the rows. Click any words in the page to change them for this export (your notes do not change); they stay through a change of look, paper or footer, and when something changes what is on the sheet (a property, the tags, the style) the sheet is drawn again from the page and a notice says they went. Then the one button that matches: **Save PDF…** (the system's print window: on the Mac, choose *Save as PDF* in its PDF menu; the page's title is the file name), **Copy Markdown** or **Save as file…** (choose a folder; the file is named after the page and shown in the Finder; a file of that name is left alone and the new one gets the next number, "Notes 2.md"), **Copy rich text**. Cancelling the folder window leaves the export window as it was. So does the print window, whatever was done in it, since it does not say whether it saved: the export window comes back, and Escape closes it. Cmd Enter presses that button; Escape folds an open pick, then closes the window, as does the × at the right. Every choice is remembered. A property left out stays left out on later exports, on pages that do not list it too, until it is ticked again.

## How it is built

```
core/        pure: no Logseq, no screen. Runs in Node, so it is tested there.
  inline.js    the words' markup read into tokens, a citation among them, written as HTML, Markdown or plain text
  dates.js     days and times as Logseq keeps them, written one way
  doc.js       the document: nodes, properties, tasks, the dated entries, the layouts; Prose's pieces and its notes
  markdown.js  the document as Markdown
  html.js      the document as HTML, every element with a named class
  themes.js    the four looks and the page: a stylesheet for printing, the same rules inline for the clipboard; the parts of a sheet by name
  templates.js the plugin's three templates and the person's own: a set of choices held, compared, saved, renamed, removed
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

- Prose's contents list has no page numbers, and a note is not a link back to its number.
- A template's name is its key: two computers that each save a template of one name keep whichever was saved last.

- Markdown names pictures by their path in the graph's assets folder; it does not copy the files beside it.
- A query is read as Logseq's own query API returns it; its table's columns and row order are read from the page when the query is drawn on screen, else the rows come in the API's order with no columns.
- Dates are written in the system's language and order.
