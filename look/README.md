# Look

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

How things look, as the visual grammar agreed on 29 October 2026 says. It reads your graph and changes nothing else in it. **What it writes:** only what the × beside a title takes off, a tag from a page. On a tag's own page the × reaches every node under the tag, so it opens Structure's ask on the tag's card, and with Structure off it is not there.

## What it draws

- **A link** to a page is the text colour with a faint underline, firmer under the pointer, never blue. A journal day is quiet grey words; in a property's value, where quiet grey would read as the name's grey, a day keeps the value's colour, no underline, quiet only under the pointer (the calendar icon and the name already say it is a date).
- **A bullet that is a page, or shows one** reads as a link: the text colour with the faint underline. A press on its words opens the page (Predictive).
- **A tag** reads as its name alone, as written, in mono a step smaller, grey, no #, where Logseq puts it: at the end of a bullet's words and at the right end of a page's title row, the size of any other tag there too. Tags keep one right edge at any width: beside the words while they have 20em, under them on that same edge when the pane is too narrow for that. The × that removes it takes the #'s place under the pointer, so nothing moves.
- **A page's place in the tree**, at the right end of its title row: its tag and the tags that tag sits under, nearest first, "Doctor / Person / Entity" on Dr. Mei Chen; on a tag's own page, only the tags above it. Each name opens its page (Shift: in the right sidebar). Under the pointer an × before a tag the page holds takes it off. Too long for the row, the line gives way from the middle, then the nearest tag if it alone is too long; the kind stays whole. The same line sits under a page's name in the right sidebar.
- **A page in a property opens it.** A click on a page named in a property's value opens the page, as its underline says (Shift-click: the right sidebar), where Logseq would open its list to set the property. Pointing at the property brings one press after its value, taking no room: + to add another page where the property holds several, a chevron to set another in its place where it holds one, for a date the date picker. Under a bullet and in a page's list alike. An empty property, words, a number or a choice keep Logseq's click.
- **In a page's list, an icon of what each property holds** before its name: three dots joined in a triangle for a link to nodes, a calendar for a date, letters for words, 123 for a number, a box for a choice. An icon you gave a property stays. Under a node, a property is plain text: no icon in its rows nor in the line of properties under its words, only Logseq's dot and the name. The name is a shade lighter than the value; the value keeps the text colour. No capsules: no edge, no fill, a faint dot between one property and the next; a property holding a pencilled value (Predictive's proposal) counts as filled, so the line does not re-space when the pencil turns solid. Under a bullet the properties run as plain words, and a long line wraps inside its pane, as words do.
- **A PDF quote's bullet** is an opening quotation mark, “, where the dot would be, centred in the grey circle while the quote is folded: on a highlight, and on a bullet that is nothing but a highlight cited. A note with words of its own beside the citation keeps its dot. With nothing under the quote, Logseq's fold arrow is left out, its room kept.
- **What a folded node holds**, after its words, small and grey, led by ↳: a circle with the number of unfinished tasks under it, then its pictures, quotes, PDFs and files with how many of each, then up to three of the tags inside, a dot between one and the next as at the title row, no number on them, then the nearest due day, or "was due" once passed. Only while the node is folded.
- Logseq's "+ Add property" under a page's list is a faint word, not a filled button. Logseq's "Add icon" and "Set property" by a title are left out, their room kept. A property with no value is faint wherever it shows; whether it shows at rest is Predictive's one row, **Hide empty properties until something is proposed**. The pencil after a date is left out. A property's name that Logseq has cut short shows whole as a tooltip under the pointer.
- **The right sidebar**: the bar on top of it takes the page's own ground with a fine line under it, where Logseq paints it blue grey; Contents, Page graph and Help read as quiet words; the "(Dev)" views that developer mode adds are left out. The pages and blocks in it lie flat, with no card, shadow or rounded corner, and a line between one and the next.
- **A citation reads as its endnote**: in a bullet on its own page, a raised number stands where "(MRI report, Oct 14, p. 3)" would, the number it has in Endnotes, the same source at the same page keeping its number. Under the pointer it says its source; a press goes there, and a PDF opens at the page; a press on a number in Endnotes goes back to the bullet. The graph keeps the words, and you see them while you edit the bullet, or where it shows away from its page: in Threads, Linked references, Find, an embed or the sidebar. Numbers follow the order on the page.
- **Links and Endnotes**, two words beside Contents in the right sidebar's bar, each open a section of the sidebar above its items, as Logseq builds one: it folds by its head and goes by its ×. Both follow you from page to page. With one open, the × of the sidebar's last item hides that item and leaves the sidebar open, where Logseq would shut it; a section stays open while the sidebar is shut. **Links** lists the links in the page's words, each once, in two orders, the words at its top: **By kind**, four groups (Entity, Occurrence, Phenomena, Information, then No kind) with a head naming the kind, so the rows carry no mark, a few of each then "show all"; or **Order on page**, each with its mark. A tag, a citation, a cited highlight and a file are not listed. **Endnotes** lists the page's citations, to a node, a web address or plain words, numbered in the order they come, the same source at the same page once; a press goes to the source, and a PDF opens at that page. A name opens its page, with Shift in the right sidebar.

- **A notice**, Logseq's own or the plugin's, is one line of small words at the bottom centre of the window, where Logseq draws a large card under the toolbar at the top right; more than one peek above it. Every notice goes after four seconds, a failure too, and stays while you point at it; its × closes it at once.

Every one of these is a switch in the plugin's settings, on by default, applied at once. They are in the plugin's one settings window, under Look (**Plugin settings** in the command palette, or the gear on the plugin's card). Each section is a heading and its rows, nothing between; each row is the thing itself drawn under its switch, a page's name in it heavier than the words, not larger, with the mark beside it sized to match.

## The shared names

There is one short list of class names, one per word of the grammar. They and their stylesheet are the plugin's, in `plugin.js`, with the greys and the property icons, so they stand whichever modules run. A module puts a name on what it draws and carries no look of its own for it; change how a tag looks once, there, and every module follows. Switch Look off and it takes off only what it draws on Logseq's own page (links, tags, capsules, marks, the icons in a page's list, the title row, the sidebar); what the other modules draw keeps its grammar.

| Name | On | What it gives |
|---|---|---|
| `lk-row` | a row | the room for its fold arrow |
| `lk-fold` | the row's fold arrow | shown only while the pointer is on its row, or while open |
| `lk-list` | a list that can be picked from | the tick boxes appear when the pointer is on it |
| `lk-tick` | a tick box in such a list | invisible until then; a ticked one stays |
| `lk-node` | a node's name, with its `data-uuid` | the faint underline |
| `lk-bare` | a node's name under a head that names its kind | the underline, no mark: the head has said it |
| `lk-tag` | a tag's name | mono, a step smaller, grey, no # |
| `lk-prop` | a property's name | a shade lighter than the value |
| `lk-day` | a day in the margin | faint, small, figures lined up |
| `lk-count` | a number of things | never shown |
| `lk-pencil` | a pencilled value | italic, grey, a dotted line, no background; a tag inside it keeps its mono and fades once, to the pencil's grey |
| `lk-undo` | the Undo arrow | faded |
| `lk-name` | the small name above a value | faint, small, never pressed |
| `lk-value` | a value, the thing pressed | the text colour; quiet under the pointer; faint when off (`off`) or unwritten |
| `lk-pick` | a value that unfolds | a hairline standing before it; its chevron, drawn by the plugin, faint |
| `lk-alts` | what a value can become | faint words, the one in force (`on`) in the text colour |
| `lk-accent` | the one action of a screen | a press; a key other than Enter faint beside it |
| `lk-close` | the way out, × | faint, the text colour under the pointer |

The buttons have a library of their own: `button-library.html` beside the plugin shows every kind, one per job, and the names (`lk-strip`, `lk-btn`, `lk-bar`, `lk-answers`, `lk-lone`, `lk-add`, `lk-more`, `lk-fix`, `lk-x`, `lk-plus`, `lk-views`, `lk-trail`, `lk-head`, `lk-menu`) are drawn in `plugin.js` with the others. `test/library.js` fails on a button drawn by hand.

Threads and Predictive use them; DB Export's toolbar is built on the last six, the Pressing set, settled on 30 October 2026 and drawn in `buttons-mockup.html` beside the plugins: a control is a small name over its value, space does the separating, one accent per screen. Look's own settings window follows it.

## How it is built

The root `files.js` lists these in order, each adding to `window.Look`:

| File | What it is |
|---|---|
| `logseq/kit.js` | Logseq's window, one stylesheet door, one watcher of the screen |
| `logseq/db.js` | the one place that reads the graph: every tag with the tag it extends, every page's sort, every property's kind, what a folded node holds |
| `logseq/settings.js` | the switches, in sections |
| `logseq/style.js` | the rules that are only a stylesheet: links, days, tags, property names, capsules, the words by a title, a PDF quote's bullet |
| `logseq/marks.js` | the index of every page's sort, for the parts that group or name pages by kind (no mark is drawn) |
| `logseq/values.js` | a page in a property opens it; the + or chevron after the value opens Logseq's list |
| `logseq/props.js` | the icon before each property's name in a page's list, and a cut name's tooltip |
| `logseq/title.js` | the tag chain at the title row's right end and in the right sidebar |
| `logseq/folded.js` | the note after a folded node's words |
| `logseq/sidebar.js` | the right sidebar's bar and items, flat on the grammar |
| `logseq/links.js` | the Links and Endnotes sections of the right sidebar |
| `logseq/cites.js` | a citation in a bullet drawn as its endnote's number |
| `main.js` | registers at the plugin's door; starts the parts, passes graph and settings changes on, stops them |

Nothing is kept on Logseq's page when the module stops: its elements carry `lk-own`, its attributes start with `data-lk-`, and both are swept.

## Checks

- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js`: loads the files against the stand-in of `test/stand-in.js` (a fake Logseq and a jsdom page drawn like a Logseq page) and asserts each drawing lands and is swept.
- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [page name]`: with Logseq running on a test graph with its debugging port, loads the module, opens the page, counts the drawings and writes a screenshot. Read-only; refuses to run while a block is being edited.

Checked in Logseq 2.0.2 on the Illness Test Graph on 29 October 2026; the sidebar on 30 October 2026.
