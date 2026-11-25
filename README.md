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
| 3 Arriving | `arrive/` | Not built yet: Find and Todo. |
| 4 Writing | `write/` | Not built yet: values pencilled in as you write, tags placed. |
| 5 Tending | `tend/` | Not built yet: the map of tags and properties. |

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

Everything inside an opened node is Logseq's own: its words, bullets, properties, menus and keys.

### A page's place (`page/place.js`)

Under a page's title: each of its tags with the tags it sits under, up to the top. Each name opens its tag.

## What it writes

Only what you do: a status set from a line, a node deleted from a line's menu. Each is one of Logseq's own editor calls, so
**Undo is Logseq's own Undo** (Cmd-Z), the same as on the node's own page. The plugin keeps a list of folded lists in the
window's local storage and nothing else.

## Checking

```
node tools/check.js          the deciding pieces, the stack's layering, then the walk in a real Logseq
node tools/check.js --quick  the first two only
```

`tools/walk.js` starts a test Logseq of its own on a copy of a sample graph and tries the plugin with real presses and keys.
It is a net, not the proof: a change is proven by hand.
