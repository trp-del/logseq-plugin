# Structure

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

Structure tends the ontology. It has three places, all inside Logseq: a page of the whole, lines on each tag's own page, and the hierarchy in the list that opens on #. It reads the graph, and writes through Logseq's own calls. Rebuilt on 1 November 2026 from first principles (`structure-first-principles.html` in the workspace).

## What it draws

**Regions, the page of the whole.** Each top-level tag is an area, and its tags stand in it as a small outline, each row with its nodes at the right and a dot where something is suggested. Any tag can stand at the top, and top-level tags are ordinary tags: each can be ticked, dragged, moved under another, merged, renamed or removed when empty, the four kinds included, which keep their marks here while they carry those names. Relationships are drawn between the rows, thin for few nodes and thick for many. A line between neighbouring areas stays in the gap; a line that crosses an area rises to the band above the areas, so no line runs over words. Only the lines of the tag you pressed are drawn. Pressing a row lights its lines and shows its relationships and suggestions under the areas. Pressing twice, or Enter, opens the tag's page. Above the areas stand Regions, Every property and Log, a box that finds a tag, and New top-level tag, which asks for the name and then the first child tags. **Two panes**, beside them, splits the map into two trees side by side, each with its own find box, folds and scroll, so a tag can be dragged from one onto a row of the other when the two are far apart in a long tree; the row under the pointer says where the tag goes ("under Hospital"), "to the top" stands at each pane's foot while a tag is held, and the move waits in the tray like any other. **One pane** puts the areas back. With the right sidebar open the areas scroll sideways.

**A relationship** is written as Logseq stores it, by the property's name: "Conversation  Topic: Cancer  12", the tag that holds the property, the property and the tag it holds, and how many nodes. The number comes from the real values, not from how full the property is.

**A tag's page.** Above Logseq's table: Extends (a press changes it), Beside, Child tags with Add child tag, Relationships, then what Structure suggests with its fix. The table's columns are the tag's properties, so there is no list of them. Look's place at the title row stands aside, since Extends says it. A journal day never gets these lines, even where the graph holds the day as a tag.

**The # list.** Logseq's list and keys stay. Each tag gets its path on the empty line above its row; with letters typed, the first tag stands among the tags above and beside it, as rows the arrow keys pass over. Choosing "New tag" then asks where it goes, in the same way: arrows and Enter write Extends, Escape leaves it with no parent, and you are back in the bullet.

**The tray.** It stands on top of Regions and of a tag's page: how many wait, a plain count ("24 links kept, 0 lost"), Old and new, Discard, Apply, and the sentences under them, newest five then "show all". Old and new sets the areas touched as they stand beside what Apply leaves. All four ways of moving end here: Tab, Shift-Tab and drag on a row; ticks and the bar they open; a suggestion's fix; the prompt under the Extends line. A change made on a tag's page that touches one node or none is written at once, with the Undo arrow, unless Undo could not put it back. Everything else waits for Apply. **A change Undo cannot put back whole asks first**, with the blue yes. Apply reads the graph afresh, runs the lines in order and leaves one Undo.

**Moving and merging on Regions.** The areas are the choice. The bar says what goes ("Move Hospital and Doctor to: press a tag"), the lines leave, and tags that cannot take it go faint; a press or Enter answers, To the top and Leave it stand on the bar, Escape leaves it. A merge then shows the two tags side by side before it waits in the tray.

**The log.** Every Apply's lines, newest first, with the time and the nodes, kept per graph on this computer.

**A property's page.** Above what Logseq shows: Property type, Node tags (three, then "and 12 more", each with its ×), On tags with how filled and Move to…, Split by its values… and Delete property from tag, Relationships, then what Structure suggests. The title is the rename.

**Every property** opens in the place of the areas, in the shape of Logseq's table: one row per property, the tags it is on, what it holds, how filled, sortable; a row opens the property's page, and its right-click menu renames it (the name becomes a field in the row; the rename waits in the tray). **Groups**, for order only: New group at the foot makes one, its name renames it when pressed, its arrow folds it, its × takes it away (what it held goes up a level). A property dragged onto a group's name goes into it, a group dragged onto another goes inside it, onto No group back out. The groups are kept by the plugin on this computer, per graph; nothing is written to the graph and no property changes. **A tag's nodes** open from the row's menu, Its nodes: tick them and move them to another tag, or make a child tag from them.

**The right-click menu** on a tree row or a card line holds what can be done to the row, "Go to this tag" first, ordered by how far they reach with a gap between reaches, and what reaches many says how many nodes before you press (the grammar's menu); it acts on what was clicked and leaves the cursor where it is.

**The right sidebar**: the tree alone, opened on the page's tag, with a cursor and a find box of its own, so you see where a page sits while reading it and can move it from there (drag, Tab, the right-click menu) without moving the main view. Enter, or a double click, opens the map in the main view on that tag, as a jump Escape comes back from; a change staged from the sidebar opens the main view too, where the tray is. The tree takes the keyboard when it opens or is pressed, and never from a bullet being written. Command palette: **Structure: the tree in the right sidebar**.

## The five rules

None is enforced; each shows as a quiet dot, with its fix a word on the card and in Health.

1. **One place.** A tag under two parents: keep only under one. A tag under no parent is a top-level tag like any other, never an issue.
2. **A child earns its place.** A tag with no nodes and no children: remove. A sibling that declares nothing the other lacks (two or more properties, one of them a relation): merge into it.
3. **A relation has a range.** A property that links to nodes with no tag set as what it points at: set it, guessed from what its values are tagged.
4. **A property lives as high as it is filled.** On three or more siblings: pull up to the parent. Filled by one child only: push down to it. Filled by fewer than a tenth of the nodes (ten or more): drop.
5. **Names say what they are.** A tag whose name reads as a plural: when the singular is a tag, merge into it; otherwise a quiet "may be plural", since spelling cannot tell Notes from Diabetes, and "rename…" opens the name in the tree with the singular guessed, to change or leave. Two tags of one name: merge. A kind whose row stands empty, and a tag anywhere that reads like it (its name, or one slip from it, as Occurence for Occurrence): "make it the kind" renames the tag if it needs it and takes it to the top, one line in the tray.

## The keys

No single letter does anything: nothing else in Logseq or in its sibling plugins works that way, and a letter typed on the tree finds a tag, as in any outline. What a thing can take is written on its card and in its right-click menu. The keys are the ones every list has.

| Do | Key |
|---|---|
| Move the cursor; open and close a branch; open everything under | `↑` `↓` · `→` `←` · `⇧→` |
| One step in, under the row above; one step out, to the parent's level | Tab, Shift-Tab |
| Tick a row (a node in the nodes list) for a bulk change; the bar above the list then says what the ticked can take, in the place of the three words above the tree (of an empty line under the title in a nodes list), so the rows stay where they were; merging the ticked is on the card | space |
| Open the tag's nodes; from the sidebar, the map on that tag; from a list or a property's card, back to the row's card | Enter |
| In a prompt: the lit row; in an ask under an issue: stage it | Enter |
| Let go, nearest first: the menu, a prompt, an ask, a field, the find text, the ticks; then back the way you came; with nothing left, the keyboard goes back to Logseq, so a letter is Logseq's again and no longer finds a tag | Escape |
| Apply the tray; discard it. When Undo cannot put it back whole, Apply asks first: Enter says yes, Escape leaves it | Cmd Enter · Cmd Delete |
| Back to the card or list shown before, on out to the page before the map; forward | Cmd-[ · Cmd-] (Logseq's own, and its arrows at the top) |
| Take back the last thing done: a change still waiting, the newest first, then the last Apply, as the arrow | Cmd Z |
| Go to the page of the row, the property on screen or the node in the list; in the sidebar | Cmd O · Cmd Shift O or Shift Enter |
| To the find box | Cmd F |
| Open and fold the row's branch | Cmd ↓ · Cmd ↑ |

Moving a tag is the word on its card, Tab, or a drag of its row onto the new parent's row (the ticked tags together when the dragged one is ticked). Where you came from is kept: a link, a list, a property's card or the nodes is a jump, and Escape walks back along them one step at a time, and the trail line above the card shows the way (a click on a place in it goes back there).

Back and forward are Logseq's own. Every place the map shows is an entry in the window's history (`#/structure?at=…`), so Cmd-[ and Cmd-] and Logseq's arrows go through the cards as they go through pages, each press on the tree a step, the arrow keys down it one step together, and a place comes back with its trail. Logseq's other two-key shortcuts work on the map as anywhere (Cmd K, Cmd comma); the ones in the table are the map's, each doing here what Logseq's does on a page. In a field Cmd Z and the like are the field's. A letter alone never reaches Logseq, so its letter pairs (g j) do not run here. Shift-Cmd-Z does nothing: an Undo keeps no way forward. Under one of Logseq's windows every key is Logseq's.

The six bulk operations and their sentences: Rename ("Rename Visit to Consultation, 31 nodes"), Merge ("Merge Visit into Consultation, Visit removed"), Split ("Make Follow-up under Consultation with 19 nodes where Kind is follow-up"), Retag ("Move 12 nodes from Conversation to Consultation"), Pull up or push down ("Move Date from Consultation, Procedure and Stay to Medical event"), Add or drop ("Add Place to every tag under Medical event"; "Drop Notes from Stay, 12 values kept on the nodes").

## What Apply writes, and what Undo puts back

Through Logseq's own calls only: a tag's Extends, a node's tags, a tag's declared properties, a property's range, a page's name, a tag made or deleted. Before each step it asks which graph is open: another graph stops the run where it is, nothing is put back into the graph now open, and the Undo waits in the graph that was written to. If a step fails the run stops and every step made is put back at once: each inverse is run whether or not the one before it worked, and the notice says how many could not be. What could not stays on the arrow ("2 steps not put back"), and the next press runs only that, as a failed Undo does ("31 steps not undone"). The waiting lines stay, naming a tag put back under its new id, so pressing Apply again does the same thing. A merge retags every node, leaving alone a node that already holds the kept tag, moves the children and the declared properties to the kept tag, puts the kept tag in place of the old one in what properties point at, points the values that named the old tag's page at the kept one, looks once more for a node given the tag meanwhile, then deletes the old tag. A removal stops if the tag has nodes by then. Setting what a property points at keeps Logseq's own tags in it (Task, Page), which the map does not show, and Undo puts back exactly what was there. Logseq deletes a tag for good, so Undo makes a **new** tag of the same name in the same place with the same declared properties, child tags and range memberships, and retags its nodes: the same tag to read, under a new id. When another tag holds that name, the two tags of one name that a merge settles, it comes back as the next free name ("Visit 2"), since Logseq allows no rename onto a tag's name. The bullets on the old tag's page go, and the links to it in bullets become plain words. Undo brings neither back, so the merge's sentence says how many, in its ask and in the tray ("3 bullets on its page go · 12 links become words"). A new tag cannot take a name already in the graph, a tag's, a page's or a property's: Logseq would hand back what holds it, so the line stays open and a notice says so. A rename waits in the tray with the rest, as the design leaves open. A tag dropped on the root row loses its Extends and Logseq puts it under its Root tag. The order of tags among siblings is by name; Cmd-Shift-Up/Down from the design is not built, since Logseq keeps no order among the tags a tag extends.

## Left out on purpose

Groups of properties (order by hand with no meaning in the graph: the card orders by how filled, the table sorts by any column) and Option while dragging to keep a second parent (rule 1 treats a second parent as an issue). A drag moves the tag and everything under it, nothing else, and does exactly what "move under…" does: the row under the pointer shows a line where the tag will go, a row it cannot go under (itself, anything beneath it) takes no drop, and the move waits in the tray.

## Opening it

The tree icon in the toolbar's plugin menu (the puzzle piece; pin it from there), or the command palette: **Structure: the map of tags and properties**. The map is the page `#/structure`.

## The look

The map is drawn into Logseq's own window, so the plugin's shared stylesheet reaches it. The shared names sit on what they name and carry no look of their own here: `lk-row` on a tree row with `lk-fold` on its chevron, `lk-list` on the tree and the nodes list with `lk-tick` on their tick boxes (the shared names say when they show), `lk-node` on a node's name in the nodes list, `lk-pencil` on the name of anything a waiting change touches, `lk-undo` on the Undo arrow. A tag named in words (on a card, in a title row's place, in the table) is `lk-tag`, mono a step smaller; a node's day in the nodes list is `lk-day` in the left margin. The grammar's own elements are drawn as it draws them: a row as a Logseq block with bullet and chevron, the trail line, the pick bar above a list, a prompt rolling out under its row joined by a line from the margin (never a window), group heads as bold words with a gap, the menu with its reaches and counts, the two columns before a merge, the Undo arrow waiting at the right of the tray, keys told as plain words, never chips. A tag's row in the tree is its name in the words font, since the row's words are the tag. A tag named inside words carries Look's `lk-tag`; a long range (Topic points at fifteen tags) shows three and "and 12 more", since a run of fifteen mono names was hard to read (the owner, 30 October 2026). The counts are not `lk-count` (Look hides that), since here they are the point. Property names on the card are not `lk-prop`: that name is for a label beside a value, and here the name is the thing. The rest is the mockup's stylesheet on the grammar's tokens (`../grammar.html`): greys mixed from the text colour, hairlines and space instead of boxes, an icon for what a property holds, the four marks for the kinds, italic with a dotted line for what a waiting change touches. The marks, the icons and the Undo arrow are the plugin's one drawing of each. Switch Look off and the map reads the same, a waiting change still pencilled.

## How it is built

The root `files.js` lists these in order, each adding to `window.Structure`:

```
core/         pure: no Logseq, no screen. Runs in Node, so it is tested there.
  model.js      the graph as plain data: tags, kinds, parents, declared properties, nodes under a tag, fill counts, what points at a tag
  rules.js      the five rules as issues, each with its fix and the change the fix stages
  changes.js    the staged changes: the sentence, the change shown in the model before Apply, the steps the writer runs
logseq/       the only Logseq-facing code
  db.js         the one reading of the graph (a few datascript rounds) and the one place that writes it
  apply.js      Apply: the steps in order, each inverse kept before its write; the one Undo; a failed batch put back, what failed kept for the arrow
  view.js       the screen: tree, card with its words, tray on top of it, table, Health with the ask, menu, prompts, the trail; the same drawing for the sidebar
  mount.js      the page #/structure and the sidebar panel, hosted by Logseq's React
main.js       the one state every view shares, the commands, the reading, Apply and Undo
```

## Checks

- `node test/core.test.js`: the core on the mockup's made-up graph (`test/sample.js`): counts, the five rules, the tray's sentences, the steps and what Undo keeps.
- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js`: every file loaded against a stand-in Logseq in jsdom; the screen drawn and walked with the words and the keys, the trail walked back, a fix's ask answered; Apply and Undo against a recording editor.
- `NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js <out dir> [tag]`: with Logseq running on a test graph with its debugging port, loads the plugin unpacked, opens the map on the tag, reads the rows, the card and the issues, writes a screenshot. Read-only; it never applies the tray.

Checked in Logseq 2.0.2 on the Illness Test Graph on 30 October 2026: the tree with the real counts, Consultation's card, the properties table, Health, the sidebar panel; a move, a merge and a pull-up applied together and put back by one Undo; Symptom's row dragged onto Phenomena's with the mouse, the move landing in the tray.
