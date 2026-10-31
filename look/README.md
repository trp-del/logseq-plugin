# Look

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

How things look, as the visual grammar agreed on 29 October 2026 says. It reads your graph and changes nothing else in it. **What it writes:** only what the × beside a title takes off, a tag from a page, or on a tag's own page the tag above it.

## What it draws

- **A link** to a page is the text colour with a faint underline, firmer under the pointer, never blue. A journal day is quiet grey words; in a property's value, where quiet grey would read as the name's grey, a day keeps the value's colour, no underline, quiet only under the pointer (the calendar icon and the name already say it is a date).
- **A small mark before a link** says what sort of thing it opens: ∃, the logical symbol, for Entity (a person, a hospital), a ring for Occurrence (a consultation), a wave for Phenomena (a symptom), three dots, ∴, for Information, which includes knowledge (a report, a finding). The sort comes from the page's tag: a tag under your own tag named Entity, Occurrence, Phenomena or Information (Phenomenon and Interpretation count too), at any depth. A link to an untagged page, a journal day, a tag, or a page under two of these has none.
- **A tag** reads as its name alone, as written, in mono a step smaller, grey, no #, where Logseq puts it: at the end of a bullet's words and at the right end of a page's title row. The × that removes it takes the #'s place under the pointer, so nothing moves.
- **A page's place in the tree**, at the right end of its title row: its tag and the tags that tag sits under, nearest first, "Doctor / Person / Entity" on Dr. Mei Chen; on a tag's own page, only the tags above it. Each name opens its page (Shift: in the right sidebar). Under the pointer an × before a tag the page holds takes it off. The same line sits under a page's name in the right sidebar.
- **The sort's mark where a page's icon would be**: left of the title, in the slot Logseq keeps there, until you set an icon of your own; and in the left sidebar's lists in place of the plain page icon; a page with no mark (untagged, a journal day) gets an empty slot there, so the column holds marks alone and a box is never read as a fifth kind. A tag's # and an icon you set stay. Nothing is written to the page for it.
- **In a page's list, an icon of what each property holds** before its name: three dots joined in a triangle for a link to nodes, a calendar for a date, letters for words, 123 for a number, a box for a choice. An icon you gave a property stays. Under a node, a property is plain text: no icon in its rows nor in the line of properties under its words, only Logseq's dot and the name. The name is a shade lighter than the value; the value keeps the text colour. No capsules: no edge, no fill, a faint dot between one property and the next; a property holding a pencilled value (Predictive's proposal) counts as filled, so the line does not re-space when the pencil turns solid.
- **What a folded node holds**, after its words, small and grey, led by ↳: a circle with the number of unfinished tasks under it, then its pictures, quotes, PDFs and files with how many of each, then up to three of the tags inside, a dot between one and the next as at the title row, no number on them, then the nearest due day, or "was due" once passed. Only while the node is folded.
- Logseq's "+ Add property" under a page's list is a faint word, not a filled button. Logseq's "Add icon" and "Set property" by a title are left out, their room kept. Empty properties stay faint. The pencil after a date is left out.
- **The right sidebar**: the bar on top of it takes the page's own ground with a fine line under it, where Logseq paints it blue grey; Contents, Page graph and Help read as quiet words; the "(Dev)" views that developer mode adds are left out. The pages and blocks in it lie flat, with no card, shadow or rounded corner, and a line between one and the next.

Every one of these is a switch in the plugin's settings, on by default, applied at once. They are in the plugin's one settings window, under Look (**Plugin settings** in the command palette, or the gear on the plugin's card). Each section is a heading and its rows, nothing between; each row is the thing itself drawn under its switch, a page's name in it heavier than the words, not larger, with the mark beside it sized to match. Logseq's gear on the plugin's card opens Logseq's own panel, which no plugin can replace.

## The shared names

Look owns one short list of class names, one per word of the grammar, and the stylesheet for them. Another module puts a name on what it draws and carries no look of its own for it; change how a tag looks once, in Look, and every module follows. Switch Look off and the others still work, only plainer.

| Name | On | Look gives it |
|---|---|---|
| `lk-row` | a row | the room for its fold arrow |
| `lk-fold` | the row's fold arrow | shown only while the pointer is on its row, or while open |
| `lk-list` | a list that can be picked from | the tick boxes appear when the pointer is on it |
| `lk-tick` | a tick box in such a list | invisible until then; a ticked one stays |
| `lk-node` | a node's name, with its `data-uuid` | the faint underline, and the sort's mark before it |
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
| `lk-accent` | the one action of a screen | a little heavier, its key faint beside it |
| `lk-close` | the way out, × | faint, the text colour under the pointer |

Threads and Predictive use them; DB Export's toolbar is built on the last six, the Pressing set, settled on 30 October 2026 and drawn in `buttons-mockup.html` beside the plugins: a control is a small name over its value, space does the separating, one accent per screen. Look's own settings window follows it.

## How it is built

The root `files.js` lists these in order, each adding to `window.Look`:

| File | What it is |
|---|---|
| `logseq/kit.js` | Logseq's window, one stylesheet door, one watcher of the screen, the greys, the four marks and the property icons drawn once |
| `logseq/db.js` | the one place that reads the graph: every tag with the tag it extends, every page's sort, every property's kind, what a folded node holds |
| `logseq/settings.js` | the switches, in sections |
| `logseq/style.js` | the rules that are only a stylesheet: links, days, tags, property names, capsules, the words by a title |
| `logseq/marks.js` | the marks before links, in the page's icon slot and in the sidebar's lists |
| `logseq/props.js` | the icon before each property's name in a page's list |
| `logseq/title.js` | the tag chain at the title row's right end and in the right sidebar |
| `logseq/folded.js` | the note after a folded node's words |
| `logseq/sidebar.js` | the right sidebar's bar and items, flat on the grammar |
| `main.js` | registers at the plugin's door; starts the parts, passes graph and settings changes on, stops them |

Nothing is kept on Logseq's page when the module stops: its elements carry `lk-own`, its attributes start with `data-lk-`, and both are swept.

## Checks

- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js`: loads the files against the stand-in of `test/stand-in.js` (a fake Logseq and a jsdom page drawn like a Logseq page) and asserts each drawing lands and is swept.
- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [page name]`: with Logseq running on a test graph with its debugging port, loads the module, opens the page, counts the drawings and writes a screenshot. Read-only; refuses to run while a block is being edited.

Checked in Logseq 2.0.2 on the Illness Test Graph on 29 October 2026; the sidebar on 30 October 2026.
