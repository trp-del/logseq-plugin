# Logseq Plugin

A plugin for Logseq DB graphs, being rebuilt from the ground up toward 1.0.0.

**A note is a node. The plugin shows any node whole, and lets it be changed wherever it appears.**
Whole means four things: what the node is (its tags), what it says (its words and bullets), its facts (its properties), and
what points at it (the other nodes that name it).

## The stack

Each layer uses only the layers under it. `node tools/layers.js` fails if a file reaches upward.

| Layer | Folder | What it gives |
|---|---|---|
| 0 Ground | `core/`, `ground/` | One way to read the graph, one way to write, Logseq's own Undo, one fenced file for everything that touches Logseq's own screen. Nothing to see. |
| 1 The node | `node/` | One line for any node. A press opens the node in place as Logseq's own editor, with the lists of what points at it underneath, each row a line that opens in turn. |
| 2 The node's page | `page/` | Relations: under a page, one list for each property that points at it, then where it is mentioned. Under a page's title, its tags and the tags above them. |
| 3 Arriving | `arrive/` | Find: a window to reach any node by its kind, a value, a day or its words. Todo: your open tasks by day, in the right sidebar. |
| 4 Writing | `write/` | Sure values: on leaving a bullet, what its words say for certain is written into its empty properties. Where a tag sits: Logseq's own list of tags says the tags each one sits under. A new tag asks where it goes, and a new page asks what it is. Not built yet: guessed values. |
| 5 Tending | `tend/` | Ontology: your tags as an outline and your properties, in the right sidebar; each opens in place as Logseq's own page for it. |

`core/` holds the pieces that decide (how words read, how rows are grouped and ordered, how a tag's path runs). They know
nothing of Logseq and are checked without it (`node --test test/`).

`ground/touch.js` is the only file that names Logseq's own markup or uses anything outside its plugin API. A Logseq update is
checked against that one file.

## What is built

### Relations (`page/relations.js`)

On every page Logseq shows (the main page, a page in the right sidebar):

- one list for each of your properties that points at the page, named by the property; on a journal day, Logseq's Scheduled
  and Deadline; then **Mentioned in**;
- a tag every row of a list shares is said once, beside the list's name;
- rows carry their day (a Date property, else the journal day they were written on), newest first;
- a long list shows ten rows, then **Show all**;
- Logseq's own Linked references and two-way tabs are taken away where these lists stand.

A row:

| Do | Result |
|---|---|
| Click the line, or Enter on it | The node opens in place: Logseq's own editor for it, then what points at it |
| Click the arrow, or Escape once nothing is being written | The opened node closes; Escape closes the innermost first |
| Shift-click, or Shift-Enter | Opens the node in the right sidebar |
| Click a link in the line | Goes to that node |
| Click a task's circle | Lists Logseq's statuses; a press sets one |
| Right-click | Open, Open in sidebar, the statuses of a task, Delete |
| Arrow up and down | Walk the lines and list names |
| Click a list's name | Folds the list; it stays folded on every page |

Everything inside an opened node is Logseq's own: its words, bullets, properties, menus and keys. How it is laid out, and how
a node it points at is opened under it, is under "An opened node, and digging" below.

### A page's place (`page/place.js`)

Under a page's title: each of its tags with the tags it sits under, up to the top. Each name opens its tag.

### Find (`arrive/find.js`)

Cmd-K, or **Find** in the command palette (a setting gives Cmd-K back to Logseq's own search).

- Nothing typed: your tags as an outline, the kinds of things there are.
- Words typed: kinds whose name they spell, then what Logseq's own search finds.
- A kind taken (Enter or Tab on it) stands in the line. The list is every node of that kind and of the kinds under it, newest
  first. Words then narrow it by a node's own words, its tag, a value of one of its properties or its day (`chen oct`). A value
  that matched and is not in the node's words is said after them.

| Do | Result |
|---|---|
| Arrow up and down | Walk the list |
| Enter, or a click on a line | Goes to the node and closes Find; with Shift, opens it in the sidebar |
| Right arrow, or a click on the arrow | Opens the node in place, in the window |
| Backspace on an empty line | Lets the kind go |
| Escape | Back one step: the opened node, the words, the kind, the window |

A click on a line goes to the node here, where on a page it opens the node in place: Find is for arriving.

### Todo (`arrive/todo.js`)

The checkmark in the toolbar, or **Todo** in the command palette, opens a section of the right sidebar: your open tasks under
**Today** (due today, or overdue with its day), **Coming up** and **Any time**. The line at the top adds a task to today's
journal. A task set Done or Canceled leaves the list.

### Sure values (`write/sure.js`)

When you leave a bullet you wrote in, what its words already say for certain is written into its empty properties:

- a node you linked, under the one property of the bullet's tags that takes that kind of node;
- the page the bullet is on, under the one property that takes the page's kind, when no link fits it;
- the journal day it is written on, under a date property, when every earlier node of that tag was dated the day it was written
  (three at least).

Nothing is written where two things could be meant, into a property that already holds a value, or on a bullet you did not
change. Each value is one step of Logseq's own Undo.

### Where a tag sits (`write/where.js`)

In Logseq's own list of tags, the one that opens when you type `#`, each of your tags is followed by the tags it sits under, up
to the top ("Purchase  Payment Event / Occurrent"). The list, its order and its keys stay Logseq's. A name two of your tags
share gets no path.

### A new tag asks where it goes (`write/place.js`)

A tag made while you write (Logseq's "New tag …") stands at the top. A list of your tags opens next to your line, as an outline:
Down or Up lights a tag and Enter puts the new tag under it. Escape, or simply writing on, leaves it at the top; the keys never
leave your bullet. Logseq's own Undo takes the placing back. A tag made anywhere else is not asked about.

### A new page asks what it is (`write/place.js`)

A page made while you write (Logseq's "New page …" in its list on `[[`) is of no kind. The same list opens at your line, headed
"… is a new page. What is it?": Down or Up lights a tag and Enter gives the page that tag; Escape, or writing on, leaves the
page untagged. Linking a node that exists stays Logseq's own list on `[[`, which already says each page's tag.

### A new tag from Ontology, and tags from a line's menu

Ontology has a line at its top, "New tag": Enter makes a tag of your own at the top of the outline and the list moves to it; a
name that exists is shown instead of made twice. A closed line's right-click menu has "Tags…": your tags as an outline, the
node's own ticked; a press puts a tag on the node or takes it off. The same line that adds a task in Todo adds the tag here.

### An opened node, and digging

A node opened in place is Logseq's own editor for it, laid out one way whatever the node is. A tagged bullet's properties,
which Logseq draws as capsules in one clipped strip, and a page's, which it draws as rows, are one kind of row here: the names
in one column as wide as the longest of them, the values in the next. Every row stays Logseq's: a press on a value opens
Logseq's own list, date picker or field, and Cmd-Z takes a change back. A property with no value is not listed. What points at
the node stands under its rows, under the word Relations and a thin line.

A value that is a node has a small arrow before it. A press on the arrow digs: that node opens under its value, starting where
the value's words start, with a guide line down from the arrow. It reads the same way (its rows, its Relations) and its own
values are dug into in turn. A second press on the arrow closes it. A press on the value's name stays Logseq's: it goes to
that page, and with Shift, Cmd, Ctrl or Option it does what Logseq does (the sidebar, a new window).

| Do | Result |
|---|---|
| Click the arrow before a value | The node opens under its value; a second click closes it |
| Escape, once nothing is being written | Back one node: the deepest dug node first, then the opened row |
| Click the value's name | Goes to that node, as in Logseq |

A page opened from a row keeps Logseq's faint dot for a first bullet; a dug page has none, so no level ends in an empty line.

### A list's head, and + on it

In Relations the head of a property's list is two lines. The first is the property's mark and name. The second says how many
nodes the list holds and of what ("4 Transfers", or "53 nodes" where their tags differ) and, at its right end, from when to
when; a press on it folds the list. A list of one node has nothing to count: its head is the first line alone. Where every row
of a list has the same tag, a + stands on the head: a press makes one more node of that kind on today's journal, pointing here
through the list's property, opens it in place and puts the caret in it.

### Ontology: counts, moving a tag, the lines between tags

Each tag says at its right how many nodes stand under it, its own and those of the tags below it. With the keys on a tag, Tab
puts it under the tag above it at its level and Shift-Tab takes it out one level, as in any outline; its right-click menu has
Show its nodes (Find, with the tag taken), Put under… and Move to the top. A move is written at once and is two steps of
Logseq's Undo. The selected tag shows its lines to the tags it is joined with (and those of the tags under it): a tag is
joined to another when its nodes hold, under one of your properties, nodes of the other. The lines are drawn as the released
Ontology drew them: one hairline a pair, in the quiet grey, from the edge of an area at one row to the edge at the other,
turning on a corner of 6; a bracket just outside the area inside one area, one soft curve across the gap between neighbours,
and over the band above the areas when they are further apart.

### Ontology as a page of its own (`tend/ontology.js`)

The toolbar's tree opens Ontology as a page: every top tag is an area with the tags under it as an outline, as many areas side
by side as fit, then the properties. The lines of the selected tag run between the edges of the areas, in
the gaps and over the band above the areas, never over a name. At the top stand
the New tag line, **Move values…** (the box, with the property still to choose) and **In the sidebar**, which opens the same
outline as a section of the right sidebar, for use beside a page you are reading. Everything the outline does, it does in both
places. Nothing opens under a tag or a property: a press on its name goes to its page (Shift: in the sidebar; Enter too), and a
press beside the name, or the arrow keys, selects the row, which shows a tag's lines until another row is selected. Tab and
Shift-Tab move the selected tag (one move at a time: a second key waits for the first to show); the right-click menu is the
same in both places.

### Move values (`tend/move.js`, decided in `core/move.js`)

In Ontology, a tag's or a property's right-click menu has "Move values…". A box opens at the head of the section: the property
the values come out of, the property they go into (one there is of the same kind, or a new one, made as your own with the first
one's kind and node tags), and a tick, "Remove them from" the first. A tag takes its own nodes and those of the tags below it; a
property takes every node that holds it. Before anything is written the box shows four of the nodes as they will read, what
comes in green and what goes struck through in red, and the yes says how many: "Copy 16 values", or "Move 16 values" with the
tick. A property that takes one value is never given a second: those nodes are left as they are and the box says how many.
Afterwards one line says what was done, with one Undo that puts every value back and removes a property the move made; the
line stays, Logseq closed and opened again, until Done.

### The day in Find

In Find the words start each row and the day stands at the row's right end, right-aligned. In the lists of Relations and Todo
the day keeps its own place.

### In a narrow place

In the right sidebar a list gives its words the whole width: a line's day stands under its words, an outline steps in less, and
a node opened in place takes the width of the list.

### Ontology (`tend/ontology.js`)

The tree in the toolbar, or **Ontology** in the command palette, opens a section of the right sidebar: your tags as an outline,
each under the tag it sits under, then your properties by name. A tag and a property are nodes like any other, so a row opens
in place as Logseq's own page for it. There its name is renamed, and Logseq's own arrow beside the name unfolds what it keeps:
the tag it extends, its properties, a property's kind and what it takes. Ontology itself writes nothing.

## What it writes

Only what you do: a status set from a line, a node deleted from a line's menu, a task added in Todo, a sure value on leaving a bullet. Each is one of Logseq's own editor calls, so
**Undo is Logseq's own Undo** (Cmd-Z), the same as on the node's own page. The plugin keeps a list of folded lists in the
window's local storage and nothing else.

## Checking

```
node tools/check.js          the deciding pieces, the stack's layering, then the walk in a real Logseq
node tools/check.js --quick  the first two only
```

`tools/walk.js` starts a test Logseq of its own on a copy of a sample graph and tries the plugin with real presses and keys.
It is a net, not the proof: a change is proven by hand.
