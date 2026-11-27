# Logseq Plugin

A plugin for Logseq DB graphs (Logseq 2.0 and later, a DB graph open).

**Install.** In Logseq, Settings, Plugins: turn on developer mode, then **Load unpacked plugin** and pick this folder (or
**Install plugin from GitHub release** with this repository). The plugin needs Logseq's "effect" access to draw on Logseq's
own page; each part can be switched off in the plugin's settings, and a change there takes effect when the plugin is reloaded.

**A note is a node. The plugin shows any node whole, and lets it be changed wherever it appears.**
Whole means four things: what the node is (its tags), what it says (its words and bullets), its facts (its properties), and
what points at it (the other nodes that name it).

## The stack

Each layer uses only the layers under it. `node tools/layers.js` fails if a file reaches upward.

| Layer | Folder | What it gives |
|---|---|---|
| 0 Ground | `core/`, `ground/` | One way to read the graph, one way to write, Logseq's own Undo, one fenced file for everything that touches Logseq's own screen, and the look's ground: the greys, the sizes and the faces (a tag in Literata, a property's name in Fragment Mono, both carried in `fonts/`). |
| 1 The node | `node/` | One line for any node. A press opens the node in place as Logseq's own editor, with the lists of what points at it underneath, each row a line that opens in turn. What the plugin changes carries a small faint Undo arrow right after its words. One table, its rows sorted by a press on a column's name (Ontology's properties). |
| 2 The node's page | `page/` | Relations: under a page, one list for each property that points at it, then where it is mentioned. At the right end of a page's title, its tags and the tags above them; on a tag's page, its parent above the title. |
| 3 Arriving | `arrive/` | Search: a section of the right sidebar to reach any node by its words, a kind or a value, opening in the main view. Todo: your open tasks by day, in the right sidebar. |
| 4 Writing | `write/` | Sure values: on leaving a bullet, what its words say for certain is written into its empty properties. Where a tag sits: Logseq's own list of tags says the tags each one sits under. A new tag asks where it goes, and a new page asks what it is. Not built yet: guessed values. |
| 5 Tending | `tend/` | Ontology: your tags as an outline and your properties, in the right sidebar; each opens in place as Logseq's own page for it. |
| Beside the stack | `beside/` | Update plugins: two keys bring every plugin to its newest: Logseq's own updater for those it installed (from its marketplace or a GitHub release), a reload for those from a folder. Alfred: the plugin answers the Alfred workflow (`alfred/`), so a node is found, seen whole and changed from Alfred as on its own page. |

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
- the lists stand under the quiet word **Relations** and a hairline;
- rows carry their day right after the bullet, in a column of its own before the words (a Date property, else the journal day they were written on), newest first; in a narrow place the day stands under the words;
- a long list shows ten rows, then **Show 43 more**, saying how many wait;
- what a list's head says of its nodes ("4 Transfers", the kinds with their counts) is a size under the lines it heads; the
  chosen kind is underlined across its word and count, and the span of the list's days ("Jul 8 to Aug 20") stands at the head's
  right end, as before the rebuild;
- Logseq's own Linked references and two-way tabs are taken away where these lists stand.

A row:

| Do | Result |
|---|---|
| Click the line, or Enter on it | The node opens in place: Logseq's own editor for it, then what points at it |
| Click the arrow, or Escape once nothing is being written | The opened node closes; Escape closes the innermost first |
| Shift-click, or Shift-Enter | Opens the node in the right sidebar |
| Click a link in the line | Goes to that node |
| Click a task's circle | Lists Logseq's statuses; a press sets one |
| Right-click | Open, Open in sidebar, Tags…, the statuses of a task, Delete (in red): words alone, a status with its circle |
| Arrow up and down | Walk the lines and list names |
| Space | Picks the node, for the bar of what is done to several |
| Click a list's name | Folds the list; it stays folded on every page |

### What a list of Relations can do

Everything the plugin's Relations did before the rebuild, built again on the rebuild's pieces (`core/view.js`, `core/time.js`,
`core/reads.js` decide; `node/view.js`, `node/pick.js`, `node/time.js` draw).

| On | Do | Result |
|---|---|---|
| The word Relations | Click | Folds the whole section, kept for the page. Right-click: the lists hidden where they point, to show again |
| The find line (from twenty nodes up, or **Relations: find in them**) | Type words | Every list narrows to them, ten nodes and then **Show more**, as any list. A node found by what it holds under a property says so under its line: the property, its values with the words marked, and **Show the rest**, which opens the node (from three letters; twenty nodes at most). "on Oct 7", "up to 7 Oct", "until 2026-10-07" turn the lists back to that day, the later nodes faint under a "since" line; a week earlier, a week later and Today step the day. Enter opens the first node found, Down goes to it, Escape empties the line |
| A list's head | Click a kind | A list whose nodes hold different tags names its three most held kinds, each with its count, All first; a kind narrows the list to it, "and 2 more" lists the rest. "2 new" narrows to the nodes made since the page was last open, which also carry a darker dot |
| The ⋯ on a head, or a right-click on it | View | Group by (tag, month, or a property whose groups hold two nodes each on the whole; a group shows twelve nodes, then **Show more**), Date (which day the list goes by: its own, the day written, any date its nodes hold, Deadline, Scheduled, or none), Timeline, Sort by (day, last changed, name, tag). What is not the default is said quietly on the head. Kept for the property on every page |
| | Reads back as… | How the property reads on the pages it points to. By grammar unless you type a name: "Prescribed by" reads "Prescribed", "Symptom of" reads "Symptoms", "Provider" reads "Provider of", a plain noun keeps its name |
| | Hide where it points | The list is no longer shown on the pages the property points to |
| | Pick nodes | A tick box before each node and one on the head for all; Space picks the node the keys are on. The bar: Open in sidebar, Set tag, Set property, More (Select all, Clear a property, Take out this page, Change this page, and Make it… for mentions), Delete, which asks first. One line then says what was done, with an Undo |
| | Move up, Move down | The list's place among the page's lists, kept for the page. A list's name can also be dragged above or below another |
| The timeline | Click a dot, or drag across | A dot for each dated node from the first node's month to today. A dot narrows the list to its week; Left and Right walk the dots, Enter opens the node; a drag narrows to any span. By a property: a lane for each of its three most held values and one for the others; a lane's name narrows to it. Taller piles a week's dots. Escape lets go of the lane, then of the span |
| A node's line | Right-click | Open, Open in sidebar, Tags…, the statuses of a task, what the place itself offers, Delete. Words alone, Delete in red (the owner chose the short menu, 25 November 2026) |
| | Right, Left | Opens the node in place, closes it |
| | Drag onto another list's head | The node gets that list's property, pointing here |
| "no Topic?" after a node | Click | A property four in five of the list hold and this node lacks: asks its value there |
| A mention | Click a step of where it sits | Under a mention stands the page it is on, and the bullet it is under: each opens |

A day in the journals feed has its lists at the foot of the day. **Relations: the Recycle list** opens Logseq's Recycle as a
plain list: Restore brings a page or a bullet back; Delete asks under the line and deletes for good, the keyboard waiting on
Leave it.

Everything inside an opened node is Logseq's own: its words, bullets, properties, menus and keys. How it is laid out, and how
a node it points at is opened under it, is under "An opened node, and digging" below.

### The marks, and what has just changed (`ground/look.js`, `ground/touch.js`, `node/undo.js`)

- A node's bullet is Logseq's own, with Logseq's ring round it where the node holds lines that are folded away. A tick box
  is a small rounded square with a short check.
- A tag is written in Literata, quiet grey, with no # and no box. A property's name is written in Fragment Mono, quiet grey,
  with no small picture before it. A link to a node is the ink with a faint underline, never blue, never in brackets. This
  holds on Logseq's own pages, in the sidebar and inside an opened node, as in the plugin's lists. On Logseq's own pages a
  property with nothing in it is its name, fainter.
- Colour is kept for a change: green for what comes, red struck through for what goes; Delete in a menu is red.
- After the plugin changes a node shown as a line (a status, a tag, a new task, a tag moved in Ontology), a small faint arrow
  stands right after the line's words: a press takes the change back with Logseq's own Undo, in as many steps as the change
  took. Nothing lights. Where the node is no longer shown (it was deleted), the arrow waits at the bottom right. The arrow goes at
  the next change to the graph. Move values keeps its own way back.
- Delete on a tag or a property asks first, in a box under its line: what goes, how many nodes hold it, a red yes and
  Cancel. The keys wait on Cancel; only a press on the red yes deletes.
- The presses are drawn as before the rebuild: the yes that decides filled in the ink, a plain press a quiet capsule, a
  third-level press with no ground, Delete in red on no ground with its bin, the one yes Undo cannot take back ("Delete for
  good") filled in blue; a small picture before a press's word where its job has one (Open in sidebar, Set tag, Set property,
  Undo, Restore, Move values).
- What floats (a menu, a list to choose from) stands on the Mac's glass: the page shows through, a 10-point corner, a hair-thin
  edge, one shadow; a window in the middle of the screen is on the page's paper with a hairline.
- A key is told only where it is not a common one, as the Mac writes it, with no box.
- An opened node rolls out of its line in one short move. A tick box on a line shows under the pointer and stays once
  ticked (no list has tick boxes yet).
- Three corners (a small one, one for what floats, the round of a press), the sizes of text, and the box a mark stands in
  with the gap after it (16 and 4) are named once in `ground/look.js`.

### Logseq's own screens, quieted (`beside/calm.js`, written in `ground/touch.js`)

As the plugin drew them before 0.9; each can be switched off on its own in the plugin's settings.

- The top bar keeps Logseq's own menu and the sidebar button. Home, back, forward, the plugins button and Logseq's search go;
  Ontology and Todo are in the corner.
- The left sidebar is words alone: no picture before Journals, Pages, a favourite or a recent page, no section words
  (Navigations, Favorites, Recent), a gap between the groups, the graph's name alone. Logseq's ? at the bottom right goes.
- A page's title is a step smaller and tighter.
- Logseq's own menus, pop-ups and lists to choose from stand on the plugin's glass, their lines the menu's size and their keys
  faint marks; the question before a page is deleted is small and in the middle, as the Mac asks; Logseq's windows and its
  settings are on the page's paper with a hairline.
- A folded bullet says after its words, small and grey, what waits under it (a part of its own, `beside/folded.js`): a ↳, an
  open circle with the number of unfinished tasks at any depth (done of all, "1/3", once some are done, the circle ticked when
  all are), the pictures, PDFs and files right under it, each an icon with its number, and the nearest day a task is due ("due
  Oct 19", "was due Oct 12"). Only while it is folded.
- **Add property** is quiet words, a little apart from the rows.
- A bullet's properties under its words are one quiet line of names and values, wrapping, with no outline; the one being
  written has a capsule round it; one with nothing in it stays out of the line.
- The right sidebar is flat, as before 0.9: no row of Logseq's own on top (Contents, Page graph, Help), no grey ground, no
  card round a section (no shadow, rounded corner or band behind its head). It stands on the page's own ground with a
  hairline at its edge (still the handle for its width) and a thin line between one section and the next. What a section
  holds is Logseq's own. A page in it reads as a page: its place first, its properties open ("Open properties" is pressed
  for you and left out), then its Relations; its name in the section's head is a link that opens the page. Every line of
  it starts on one edge, 32 from the sidebar's edge, and the marks (a fold arrow, a list's mark, the + of Add property, a
  value's bullet) stand in the gutter before that edge.
- Logseq's tables: no ground under the column names, no lines between columns, a hairline under each row; each tool says what
  it does in a word beside its icon; a tag's own table leaves out its Tags column.

### A page's place (`page/place.js`)

On the main page, at the right end of the title's line: each of the page's tags with the tags it sits under, up to the top, on
one line that gives way with an ellipsis. In the sidebar and in a page opened in a row, the same line stands under the title.
Each name opens its tag. On a tag's own page a line above the title says **Parent** and the tag it stands under; a press lists
your tags as an outline (not the tag itself, nor a tag under it) and **None (at the top)**, and the one taken is where the tag
goes, with the Undo arrow at the bottom right.

### Search (`arrive/search.js`, decided in `core/search.js` and `core/sentence.js`)

Cmd-K, the corner, or **Search** in the command palette opens a section of the right sidebar with the keys in its line (a
setting gives Cmd-K back to Logseq's own search). It does what Find did (the owner's choices of 26 November 2026).

- Nothing typed: the kinds in the graph, most held first, each with how many nodes it holds (the kinds under it counted in);
  **more** shows all of them as an outline. Under them the pages opened last.
- Letters typed light the choice they begin: a kind ("cons" lights Consultation, with its count), or with a kind taken a value
  its nodes hold ("mei" lights Dr. Mei Chen under Provider). Tab takes the lit choice as a piece of the line.
- Plain words: Logseq's own search answers: what holds the words first, then what holds them in a value (said after the words),
  then the rest Logseq found; grouped by kind, the kinds among them offered above. The typed letters are marked a step heavier.
- A kind taken: its nodes (and those of the kinds under it), newest first, and above them what they hold to narrow by, each
  value with how many hold it, then the months. A value or month pressed becomes a piece; words narrow further.
- **By sentence** (the press at the line's end, or Option-Cmd-K): "Consultation with Mei Chen around Aug 2026" is read as a
  kind, a value and a time, each said under the line with what it was read as; the time is a strip of months, and the nodes
  just outside it follow under **Near**. A page named alone gives what points at it. Tab puts the lit choice's name in place of
  the letters that lit it.

| Do | Result |
|---|---|
| A click on a line, or Enter | Goes to the node in the main view; with Shift, opens it in the sidebar |
| The fold arrow, or Right on a line | Opens the node in place under its line; Left closes it |
| Down from the line | Walks the lines |
| Tab | Takes the lit choice; with none lit, steps into the choices (arrows walk them, Escape goes back) |
| A click on a piece, or Backspace on an empty line | Takes that piece, or the last, off |
| Right-click | The line's own menu, as everywhere |
| Cmd-Enter | Makes a page of the words typed and goes to it |
| Escape | Empties the words, then lets go of the pieces |

### The corner (`beside/corner.js`)

The bottom right corner holds commands, out of the way of what you read and write. Nothing shows there until the pointer
comes near; then a quiet ···, and a press opens a list to type into, as Logseq's own command palette: the plugin's commands
first (Search, Todo, Ontology, New page…, Recycle, Update plugins and the rest), then every command of Logseq's own with its
key. Letters narrow it, the closest line first; Enter does the lit line; words no command has offer a new page of that name.
What is done to a node stays on its right-click.

### Todo (`arrive/todo.js`)

The corner, or **Todo** in the command palette, opens a section of the right sidebar: your open tasks under **Overdue** (past
its day), **Today**, **Coming up** and **Any time**, each under a small bold word, the words a size smaller
than a page's. A task's day stands at the right end of its line, red once it has passed. The line at the top, **Add or find a
todo**, narrows the list to the tasks holding every word typed, and Return adds what is typed as a task on today's journal. A task set Done or Canceled leaves the list.

Under that line, from five tasks with a day, stands a strip of time: a hairline from the first task's month to today, a dot for
each listed task that has a day, a late one in red, today a short upright line. A press on a dot goes to its task. At the end
of the line on top, two quiet words: **All open** lists the open statuses, each ticked or left out (the last one listed cannot be left out; Show
all brings them back), and **By day** groups the tasks by day, page, parent (the node a task is written under), tag, priority
or status, and sorts each group by day or by name. All of it is kept for the next time, on this Mac. A second level of
grouping is not built.

The same list stands on a page of its own, in the middle of the window, at a reading width: **Todo** in the command palette,
or g then d outside a bullet. **Todo in the sidebar** and the corner open the section.

A day said in the words of a new task becomes its Deadline and leaves the words: today, tomorrow, a weekday ("friday", "by
friday", "next friday"), "next week" (its Monday), "nov 20", "20 november". It is said at the line's right before Return
("Nov 27"). A short weekday ("fri", "sun") counts only after by, on, due or next.

A task carries its bullet and its status circle before its words, and one day, its own. Under its words stands the page it sits on
when that page is not a journal day; a press goes there. Under a page's or a
parent's heading the row does not say it again.

A task's right-click has **Priority…** (Urgent, High, Medium, Low, and Remove priority when it has one) and **Deadline…**
(Today, Tomorrow, Next week, and Remove deadline when it has one), each with the Undo arrow at the task's line.

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

In an opened node a property's name is a size under the words; a value that is a node says after its name what that node is
(its tag); and the node opened from a row lies on a soft grey band with a line
down its left side.

### A list's head, and + on it

In Relations the head of a property's list is two lines. The first is the property's mark and name. The second says how many
nodes the list holds and of what ("4 Transfers", or "53 nodes" where their tags differ) and, at its right end, from when to
when; a press on it folds the list. A list of one node has nothing to count: its head is the first line alone.

A + stands on the head. A press opens a line to type in at the list's end, laid out as a row is: the + where a row has its
bullet, then the new node's name, then the tag it will get (the kind most of the list's nodes are; a press on it lists the
others, and "no tag"). Under the name stands what the node will hold: the list's property with this page. Enter makes the
node. Where most of the list's nodes are pages, a page is made at once; otherwise the line first asks where the node goes:
today's journal, this page, or a page found by what is typed there, the place chosen last lit. Cmd-Enter also opens what was
made in the sidebar. What was made gets the Undo arrow, and the line stays open, empty, for the next one. Escape steps back,
then lets the line go; a press elsewhere lets an empty line go. In a grouped list each group's line has its own + under the
pointer: the node gets the group's tag, or the group's value under the property the list is grouped by, and goes to today's
journal without a question.

### Ontology: counts, moving a tag, the lines between tags

Each tag is a row as before the rebuild: its name at the small size, no tag in bold, the rows close, and a hairline from each
tag's bullet down along the tags under it, as Logseq's own outline has. Each tag says in a column at its area's right edge how
many nodes stand under it, its own and those of the tags below it. With the keys on a tag, Tab
puts it under the tag above it at its level and Shift-Tab takes it out one level, as in any outline; its right-click menu has
Show its nodes (Search, with the tag taken), Move under… (the same list as the row of actions) and Move to the top. A move is written at once and is two steps of
Logseq's Undo. The selected tag shows its lines to the tags it is joined with (and those of the tags under it): a tag is
joined to another when its nodes hold, under one of your properties, nodes of the other. The lines are drawn as the released
Ontology drew them: one hairline a pair, in the quiet grey, from the edge of an area at one row to the edge at the other,
turning on a corner of 6; a bracket just outside the area inside one area, one soft curve across the gap between neighbours,
and over the band above the areas when they are further apart.

### Ontology as a page of its own (`tend/ontology.js`)

The corner opens Ontology as a page. Under its title stand three tabs, as before the rebuild, each an icon and a word, the one
in force in the ink with a line under it: **Tags**, **Properties** and **History**. Tags shows every top tag as an area with the
tags under it as an outline, as many areas side by side as fit. The lines of the selected tag run between the edges of the
areas, in the gaps and over the band above the areas, never over a name. Properties shows your properties as the table they
were before the rebuild (below). History lists what was changed from Ontology (a move, a merge, a rename, a deletion, a move of values),
newest first, each with its day and time, kept on this computer for 30 days; "Nothing has been changed yet." when there is
nothing. Under the tabs stand the New tag line (on Tags), **Move values…** (the box, with the property still to choose) and
**In the sidebar**, which opens the same outline as a section of the right sidebar, for use beside a page you are reading.
Everything the outline does, it does in both places, the tabs, the tick boxes and the row of actions included; each place keeps
its own tab and its own ticks.

**The table of properties.** One row a property, under four columns: **Property** (its name in the property's face, a link to
its page), **On tags** (the tags that give it, the one with the most nodes first, three at most and then "and 2 more", or "No
tag"), **Holds** (what it takes: the tags its node values must have, "any node", or "words", "a date", "a number", "a choice",
"yes or no", "a link") and **Filled** ("2 of 6": how many of the nodes of those tags, and of the tags under them, hold a value,
of how many; for a property no tag gives, how many nodes hold it). A press on a column's name sorts the rows by it, an arrow
after the name saying which way; a second press turns the order round. It opens sorted by Filled, the least filled first, and
each place keeps its own order while Logseq runs. The ▾ after the tags in On tags opens your tags as an outline with a find
line, a tick at each tag that gives the property: a press puts the property on that tag or takes it off. The ▾ in Holds (only
where it holds nodes) opens "Any node" and your tags, a tick at each one its values must have: a press adds the tag or takes it
out, "Any node" takes them all out. Each is written at once, said in History, and Logseq's own Undo takes it back, the faded
arrow standing after the property's name. A press on a tag's name goes to its page, Shift in the sidebar; the keys: Up and Down
walk the rows (Up from the first goes to the column names), Enter goes to the property's page, Space ticks, Escape lets the
ticks go, and on a column's name Enter or Space sorts. A row's right-click menu has Open, Open in sidebar, Move values… and
Delete…. In the sidebar the columns narrow, a long name cut with "…", and the table scrolls sideways inside its own box where
there is no room for them.

**Tick boxes and the row of actions.** Every tag and every property has a tick box before it, in one column at the area's left
edge whatever its depth, faint until it is ticked or pointed at; Space ticks the row the keys are on, Escape lets every tick
go, and a ticked row is lit. Above the rows stands the row of actions, its presses waiting faintly until they can be pressed:
"Tick tags, then" (with ticks, "2 tags picked"), **Merge…** (two or more), **Move up a level** (not at the top), **Move
under…**, **Rename** (one), **Delete** (in red; only tags with no nodes and no child tags) and a × that lets the ticks go. On
Properties: "Tick properties, then", **Merge…** and **Rename**. Each is written at once and Logseq's own Undo takes it back,
the faded arrow standing after the row it changed (at the bottom right where the row is gone):
- Move up a level puts each ticked tag under the tag above its own, or at the top; Move under… opens your tags as an outline
  with a find line, the ticked tags and those under them left out, and "The top" at its end.
- Rename turns the row's name into a field, underlined, the name selected: Enter writes it (Logseq refuses a name another tag
  or property has, and says so), Escape or a press elsewhere leaves it.
- Delete asks under the row, with a red Delete and Cancel.
- Merge… opens a box under the row of actions that says the change once: "Merge test into Hospital", the tags as tags, then up
  to four of the nodes as they will read, the tag that goes struck through in red and the kept one in green, then "1 node ·
  links to the tag follow". The tag with the most nodes is kept; "Keep the other name" (with more than two, "Keep another
  name…") keeps another. Merge (or Enter) writes it, Cancel (or Escape) leaves it. Every node of the merged tag gets the kept
  tag, its child tags go under the kept tag, its properties are given by the kept tag, the properties whose values had to be it
  take the kept tag instead, values and links in the words that pointed at it point at the kept tag, the bullets on its page
  move to the kept tag's page, and then it is deleted. Merging properties moves the values of the others into the kept one (the
  one most nodes hold) and has the tags that gave them give it, shown first as Move values shows a move; where the kept property
  takes one value and a node would get a second, that node keeps its own and the box says how many. The merged property stays,
  empty, as before the rebuild. One Undo takes the whole merge back. A tag that Logseq deletes and its Undo brings back comes back
  also under Logseq's own Root Tag.

Nothing opens under a tag or a property: a press on its name goes to its page (Shift: in the sidebar; Enter too), and a
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

### The day at a line's end

In Search and in Todo the words start each row and the day stands at the row's right end, right-aligned. In the lists of
Relations the day stands after the bullet, before the words.

### In a narrow place

In the right sidebar a list gives its words the whole width: a line's day stands under its words, an outline steps in less, and
a node opened in place takes the width of the list. A list of Relations does the same wherever it is narrower than 300: a
row's arrow stands in the gutter, its bullet on the edge its head's words start on, its day under its words; a property of a
node opened there, and of a page in a narrow sidebar, has its name on one line and its values under it. Where a list is
narrower than 420 the days of its head have a line of their own under the head's words.

One rule for the gaps, measured: a mark stands in a box 16 wide that ends 4 before its words; from the middle of one line to
the middle of the next it is 26 inside a head, 32 from a head to what it heads, and 54 from one section to the next. A head's
kinds, its + and ⋯ and its days are one run of words that wraps where it must; the bar under the kind in force stays inside
that kind's own line.

### Ontology (`tend/ontology.js`)

**Ontology in the sidebar** in the command palette, or **In the sidebar** on Ontology's page, opens a section of the right sidebar
with the same three tabs: your tags as an outline, each under the tag it sits under; your properties as a table; History. A tag and a property are nodes like any other, so a row opens
in place as Logseq's own page for it. There its name is renamed, and Logseq's own arrow beside the name unfolds what it keeps:
the tag it extends, its properties, a property's kind and what it takes. What Ontology itself writes is its row of actions, its moves, the two ▾ of its table of properties and Move values.

### Update plugins (`beside/update.js`, its words in `core/update.js`)

**u p** (two keys one after the other, as Logseq's own **t p** for its plugins page), or **Update plugins** in the command
palette, brings every plugin Logseq runs to its newest:

- A plugin Logseq installed from its marketplace or from a GitHub release, with a newer release on GitHub, is updated by Logseq's own updater (the one
  behind **Check for updates** on its plugins page), one after another. Logseq says each one it updated, as it does there.
- A plugin Logseq loads from a folder is loaded again: Logseq loads such a plugin once, when it starts, so what was put into
  the folder afterwards waits for the next start. This plugin is loaded last.

One line then says what that brought: "Plugins updated: Logseq Plugin 0.9.0 to 0.9.1. Up to date: Calendar 1.2.0", that every
plugin was up to date, or which could not be updated and why (GitHub did not answer, or the plugin is not in Logseq's list).
The keys do nothing while you write in a bullet, and can be changed in Logseq's own keyboard settings. A folder is not fetched
from anywhere: the key loads what the folder holds.

### Alfred (`beside/outside.js`, `ground/outside.js`, `alfred/`)

The Alfred workflow in `alfred/` (its own README says what its panels do) asks the plugin through Logseq's HTTP APIs server,
which must be switched on in Logseq's settings. The plugin answers by name: `find` (Logseq's own search), `node` (a node
whole: its name and tags, each property its tags give it with what it holds and its set choices, its bullets as an outline,
and what points at it, as Relations lists it), `candidates` (what a node property can hold), `tags`, `markdown` (a bullet
with those under it, or a node whole, written by `core/markdown.js`), and one name for each change: `setWords`, `newBullet`,
`move`, `remove`, `setValue`, `tag`, `status`, `undo`. Every change answers the node read afresh and how many steps of
Logseq's Undo it took. A day typed as words ("nov 18", "2026-11-18", "tomorrow") is read by `core/days.js`; what it cannot
read is refused, never guessed. The part can be switched off in the plugin's settings like any other.

## What it writes

Only what you do: in Ontology a tag moved, merged, renamed or deleted, properties merged or renamed, a property put on a tag or taken off, the tags a property's values must have, and values moved; a status set from a line, a node deleted from a line's menu, a task added in Todo, a sure value on leaving a bullet, and what is changed from Alfred (a bullet's words, a new bullet, a bullet moved or deleted, a property's value, a tag, a status). Each is one of Logseq's own editor calls, so
**Undo is Logseq's own Undo** (Cmd-Z), the same as on the node's own page. The plugin keeps a list of folded lists in the
window's local storage and nothing else.

## Checking

```
node tools/check.js          the deciding pieces, the stack's layering, then the walk in a real Logseq
node tools/check.js --quick  the first two only
```

`tools/walk.js` starts a test Logseq of its own on a copy of a sample graph and tries the plugin with real presses and keys.
It is a net, not the proof: a change is proven by hand.
