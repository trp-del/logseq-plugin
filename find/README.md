# Find

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

The search window as the first step of a walk. You find things the way you think about them: the kind of thing, who it was with, roughly when, and then the thread from what you found, without leaving the window. Begun on 30 October 2026; version 0.1.0 is the window as designed in `logseq-find/docs/ALTERNATIVES.html` in the workspace (way B, with narrowing by choice and the keys), checked in Logseq 2.0.2 on the Illness Test Graph.

## What it does

**Open it** with Cmd+K (Ctrl+K elsewhere); Logseq's own search moves to Cmd+Shift+K. Or the route icon in the toolbar's plugin menu (the puzzle piece at the top right; pin it from there), or **Find** in the command palette. A setting turns the key the other way round.

**Nothing typed:** the kinds in your graph (your tags, and Task), most used first, with how many nodes each holds, counting the tags under it; then the pages you opened last. Pick a kind with Up, Down and Enter, or a click. "more" opens every kind, laid out as Structure's tree: a column under each of the four kinds (then any other top-level tag), each tag beneath its parent and stepped in, Task under a head "Logseq" at the foot of the last column. Up and Down run down a column and on to the next, Left and Right go to the column beside.

**A kind picked:** its nodes as rows, newest first, and above them the choices the graph holds for them: each property with the values that occur and how many rows hold each (Provider: Dr. Mei Chen 13 · Dr. Helen Brooks 10 …), then the months. A choice that would narrow nothing is not offered: a property with one value, a value on every row, a property of free words with more than about twenty. Three values show on a line, then "more"; a number stands only on the choice that is lit or under the pointer. No word stands over the choices or over the rows: a gap of one line tells them apart, and "show all 53" under the rows is the only count of what was found. A kind of more than 3,000 nodes keeps its newest 3,000 and says so where the list ends ("the newest of 12431"); letters find within those.

**A pick** sits in the find line as the thing it is: a tag in mono, a node with Look's mark and underline, a month in grey. Point at it and an × takes it off; Backspace on an empty line takes the last one off, and the list widens again.

**Typing** finds within what is left. The letters match the choices first: "mei" lights Dr. Mei Chen under Provider, and Tab makes her the filter; "oct" lights October; with no kind picked, "cons" lights Consultation. Meanwhile the rows narrow to the letters, with the letters in bold. Enter always opens the row the cursor is on: Tab narrows, Enter opens.

**Words without a kind:** Logseq's own search answers (its index, its order, up to 80), each row read in full, and the kinds among the results are the choices, with counts. Two words work as one: "mei chen" shows the kinds she is found under.

**A row** is the grammar's row: the day in the margin (when it happened, not when it was written: its date property, the one titled Date first, else the earliest, as Threads reads it; else the journal day it is written on; an Entity none, wherever it is written), the chevron, the bullet or, where the row is not a bullet, what it is (a page Logseq's page sign, a tag its #, a property the icon of what it holds, as in a page's list of properties), the words with links to pages as names (each a link of its own, with Look's mark), the kind in mono after the words, and at the right end the page a block sits on when that is not a journal day. The kind is left off the rows when it is the one picked, and so is the mark before a page's name: the kind has been said. Under a line naming a kind, the same.

**Digging:** Right arrow, or the chevron, opens the row's node in place: its properties with their values, then what points at it, by property and by the kind of the pointing node ("Provider Consultation 24"), then "mentioned in". Each of those is a line that opens, and looks it: the grammar's row with its dot ringed while closed, the number after the words as faint as on a lit choice; Right opens it to its nodes, three, then "show all 24" under them. Left closes. One level deep in this version: a node under a group opens with Enter but is not dug further.

**Opening:** Enter opens the node in the main view, Shift+Enter in the right sidebar, a click on its words the same; a click on a name inside the words opens that page. A line of what points at a node has no page to open: the chevron or Right opens it, and a click on its words only moves the cursor there.

**Commands:** a `>` as the first letter lists Logseq's commands in place of the nodes: every one its own palette lists, read from the running app (the global shortcuts and the commands plugins register, about a hundred and ten), each with the key it has right now as faint mono words at the right, in Logseq's order (the ones of a kind together: editor, go, graph, ui); no picture before a command, the words start where every row's words start. The words after the `>` narrow them by name. Enter runs one, as the palette would.

**Make a page:** with words typed and no kind picked, "make a page “…”" at the foot's right makes a page with those words as its name and opens it. Cmd Enter (Ctrl Enter elsewhere) does it whatever is listed, and the key stands faint beside it. With no rows at all it is the one thing offered, so plain Enter does it too, and "Enter" stands there instead. Enter pressed while the letters are read waits for what they find.

**Keys:** type to find; Tab takes the lit choice, or with none lit steps into the choices (Left and Right along a line, Up and Down between lines, Tab or Enter takes one, Escape or Shift+Tab steps back); Enter opens the row the cursor is on, Shift+Enter in the sidebar, Cmd+Enter makes a page of the words typed; Up and Down along the rows, Down past the last row shows the rest of that list, Up from the first row into the choices; "more" stands among the choices, reached by the arrows and taken by Tab or Enter; Right and Left dig and close (in the letters they move the caret until its end); Backspace on an empty line takes the last pick off; Escape closes the deepest thing open (a dug row, the choices, then the window). The foot names what Tab and Enter do right now ("narrow to Consultation", "open Look test", "in the sidebar"), not a legend of keys. The window keeps one height from the opening, room for the rows shown before "show all"; a longer list scrolls inside it, so the foot never moves. Logseq's own shortcuts sleep while the window is open, and a press of the mouse anywhere in it leaves the keyboard in the find line. A change in the graph leaves an open window as it is; the next letter or the next opening reads it afresh.

## What it writes

One thing: "make a page" makes the page with the words typed. Everything else is a read.

## Settings

In the plugin's one settings window (**Plugin settings** in the command palette, or the command list's last row), under Find: whether Find takes Logseq's search key (on), where the window sits (high, with the page in view under it, or centred), and how many rows show before "show all" (12). Three rows under the window's name, no section head and no explanation; the keys are drawn under their switch as they stand (Cmd K Find · Cmd Shift K Logseq's search), the other two settings are their own specimen.

## The look is Look's

What Find draws carries the shared class names (`lk-row`, `lk-node`, `lk-tag`, `lk-day`, `lk-fold`, `lk-prop`, listed in Look's README) and no look of its own for those pieces, so with Look switched off it reads the same, but for the sort's mark before a node, which Look works out.

## Where it comes from

The four ways drawn in `logseq-find/docs/ALTERNATIVES.html` in the workspace (published at https://claude.ai/artifact/SfMxyXrqWFWQoHq246Hkz4): Logseq's own window as it is today, A (Logseq's window calmed), B (find, then walk: this plugin), C (the old plugin's preview panel on the grammar) and D (a list that stays in the sidebar). The search part of DB Refinements (`../logseq-plugin-old/parts/search.js`, resting since 0.4.356) had details on each row, grouping, a preview panel, typed codes and search in the right sidebar; each idea carries into B in a simpler form, as the page's last section says.

## How it is built

The root `files.js` lists these in order, each adding to `window.Find`:

| File | What it is |
|---|---|
| `logseq/kit.js` | Logseq's window, one stylesheet door, one element builder, the greys, the property icons, the sweep |
| `logseq/db.js` | the one place that reads the graph: the kinds with their counts, the kinds as a tree, the nodes under a kind, what they hold as choices, the months, Logseq's search, a node's properties and what points at it, the recent pages |
| `logseq/settings.js` | the switches |
| `logseq/commands.js` | Logseq's commands as the app lists them, with their keys; their English names from Logseq's dictionary |
| `logseq/find.js` | the window: the find line of pieces, the choices, the rows, digging, the keys |
| `main.js` | registers at the plugin's door, listens for the key, registers the command and the toolbar icon, forgets what it read when the graph changes, stops |

Nothing is kept on Logseq's page when the module stops: its elements carry `fd-own` and are swept.

## Checks

- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js`: loads the files against a stand-in Logseq in jsdom with a small graph and walks the window from the keyboard: the kinds, "cons" lighting Consultation, the choices, "mei" lighting Dr. Mei Chen, digging, widening, opening a row, the commands (every one the app holds, narrowed by words, run by id), the stop.
- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [steps]`: with Logseq running on a test graph with its debugging port, opens the window and walks it through the steps (type, keys, screenshots), writing a screenshot and the window's words after each. Read-only; refuses to run while a block is being edited; closes the window at the end.
