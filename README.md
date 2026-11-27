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
| 0 Ground | `core/`, `ground/` | One way to read the graph, one way to write, Logseq's own Undo, one fenced file for everything that touches Logseq's own screen, and the look's ground: the greys, the sizes and the faces (a tag in Commissioner, a property's name in Fragment Mono, both carried in `fonts/`). |
| 1 The node | `node/` | One line for any node. A press opens the node in place as Logseq's own editor, with the lists of what points at it underneath, each row a line that opens in turn. What the plugin changes carries a small faint Undo arrow right after its words. One table, its rows sorted by a press on a column's name (Ontology's properties). |
| 2 The node's page | `page/` | Relations: under a page, one list for each property that points at it, then where it is mentioned. At the right end of a page's title, its tags and the tags above them; on a tag's page, its parent above the title. |
| 3 Arriving | `arrive/` | Search: a section of the right sidebar to reach any node by its words, a kind or a value, opening in the main view. Todo: your open tasks by day, in the right sidebar. |
| 4 Writing | `write/` | Sure values: on leaving a bullet, what its words say for certain is written into its empty properties. Where a tag sits: Logseq's own list of tags says the tags each one sits under. A new tag asks where it goes, and a new page asks what it is. Not built yet: guessed values. |
| 5 Tending | `tend/` | Ontology: your tags as an outline and your properties, in the right sidebar; each opens in place as Logseq's own page for it. |
| Beside the stack | `beside/` | Two pages side by side: ⌘-click a link and its page opens beside the one you are on. Focusing into a bullet and out glides. The key sheet: Option held alone shows the keys. Export: a page or some bullets out as a printed page (PDF) or as Markdown, with a preview whose words can be changed first. Update plugins: two keys bring every plugin to its newest: Logseq's own updater for those it installed (from its marketplace or a GitHub release), a reload for those from a folder. Alfred: the plugin answers the Alfred workflow (`alfred/`), so a node is found, seen whole and changed from Alfred as on its own page. |

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
- the lists stand under the quiet word **Relations** and a hairline, each list's name on that word's edge; its fold arrow, as
  a bullet's, shows under the pointer; the find line under it says **Search**;
- a second hairline closes the section under its last row, running on under the word. A press on the word rolls the lists up
  and the line draws up and fades with them, leaving the one line; pressed again, they roll out (no motion where less motion
  is asked for);
- rows carry their day at the line's right end (a Date property, else the journal day they were written on), newest first; View, then Date, puts it at the **Beginning of the line** instead, right after the bullet in a column of its own (in a narrow place too), kept for the property on every page;
- a long list shows ten rows, then **Show 43 more**, saying how many wait;
- what a list's head says of its nodes ("4 Transfers", the kinds with their counts) is a size under the lines it heads; the
  chosen kind is underlined across its word and count, and the span of the list's days ("Jul 8 to Aug 20") stands at the head's
  right end, as before the rebuild;
- Logseq's own Linked references and two-way tabs are taken away where these lists stand.

A row:

| Do | Result |
|---|---|
| Click the line, or Enter on it | The node opens in place: Logseq's own editor for it, then what points at it |
| Click the arrow, or Escape once nothing is being written | The opened node closes; Escape closes the innermost first. The arrow then fades again |
| Click the bullet | Goes to that node, as Logseq's bullet does (in Search, Todo and Relations alike) |
| Shift-click, or Shift-Enter | Opens the node in the right sidebar |
| ⌘-click | In the main view, opens the node beside the page you are on (Two pages side by side) |
| Click a link in the line | Goes to that node |
| Click a task's circle | Lists Logseq's statuses; a press sets one |
| Right-click | Open, Open in sidebar, Tags…, the statuses of a task, Delete (in red): words alone, a status with its circle |
| Arrow up and down | Walk the lines and list names |
| Space | Picks the node, for the bar of what is done to several |
| Click a list's name | Folds the list; it stays folded on every page |

A property set to "Hide by default" in Logseq is not said after a line, and no line is asked for lacking it. A list named by
it still stands, since it is what points at the page; Search and a list's find line still find nodes by it; View can still
group or sort by it; and the day at a line's end stays, though it comes from a hidden date.

### What a list of Relations can do

Everything the plugin's Relations did before the rebuild, built again on the rebuild's pieces (`core/view.js`, `core/time.js`,
`core/reads.js` decide; `node/view.js`, `node/pick.js`, `node/time.js` draw).

| On | Do | Result |
|---|---|---|
| The word Relations | Click | Folds the whole section, kept for the page. Right-click: the lists hidden where they point, to show again |
| The find line (from twenty nodes up, or **Relations: find in them**) | Type words | Every list narrows to them, ten nodes and then **Show more**, as any list. A node found by what it holds under a property says so under its line: the property, its values with the words marked, and **Show the rest**, which opens the node (from three letters; twenty nodes at most). "on Oct 7", "up to 7 Oct", "until 2026-10-07" turn the lists back to that day, the later nodes faint under a "since" line; a week earlier, a week later and Today step the day. Enter opens the first node found, Down goes to it, Escape empties the line |
| A list's head | Click a kind | A list whose nodes hold different tags names its three most held kinds, each with its count, All first; a kind narrows the list to it, "and 2 more" lists the rest. "2 new" narrows to the nodes made since the page was last open, which also carry a darker dot |
| The ⋯ on a head, or a right-click on it | View | Group by (tag, month, or a property whose groups hold two nodes each on the whole; a group shows twelve nodes, then **Show more**), Date (which day the list goes by: its own, the day written, any date its nodes hold, Deadline, Scheduled, or none; and **Date position**, the beginning or the end of the line), Timeline, Sort by (day, last changed, name, tag). What is not the default is said quietly on the head. Kept for the property on every page |
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
- A tag is written in Commissioner, quiet grey, with no # and no box. A property's name is written in Fragment Mono, quiet grey,
  with no small picture before it. A link to a node is the ink with a faint underline, never blue, never in brackets. A web
  link is the same with a small grey arrow ↗ after it, wherever it stands. This
  holds on Logseq's own pages, in the sidebar and inside an opened node, as in the plugin's lists. On Logseq's own pages a
  property with nothing in it is its name, fainter, and where its value would be stands a very faint dash to press.
- A value in words starts on the same edge as every other value: no bullet stands before it, and no room is left for one.
- Logseq's own list of places for a bullet's property (its name, "UI position") answers a mouse press: the place pressed is
  saved, as Return saves it.
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
- Where tags are chosen from a menu, they stand as an outline as in Logseq: a bullet before each, and a hairline down from
  each tag through the tags under it. Words typed keep each tag found under the tags it sits under, those greyed and passed over
  by the arrows, with the typed letters heavier. One highlight, from the line a tag hangs from to the menu's edge, glides from tag to tag
  under the pointer and the arrows.
- What floats (a menu, a list to choose from) stands on the Mac's glass: the page shows through, a 10-point corner, a hair-thin
  edge, one shadow; a window in the middle of the screen is on the page's paper with a hairline.
- A key is told only where it is not a common one, as the Mac writes it, with no box. The one exception is the key sheet,
  where keys are what is read: there each stands in a small box.
- An opened node rolls out of its line in one short move, and so do a list's fold, a group's fold, **Show more** and
  **Show fewer**. A tick box on a line shows under the pointer and stays once ticked (no list has tick boxes yet).
- Three corners (a small one, one for what floats, the round of a press), the sizes of text, and the box a mark stands in
  with the gap after it (16 and 4) are named once in `ground/look.js`.

### Logseq's own screens, quieted (`beside/calm.js`, written in `ground/touch.js`)

As the plugin drew them before 0.9; each can be switched off on its own in the plugin's settings.

- The top bar keeps Logseq's own menu and the sidebar button. Home, back, forward, the plugins button and Logseq's search go;
  Ontology and Todo are in the corner.
- The left sidebar is words alone: no picture before Journals, Pages, a favourite or a recent page, no section words
  (Navigations, Favorites, Recent), a gap between the groups, the graph's name alone. Recent stands in three groups, Pages
  (journal days among them), Properties and Tags, each under a small grey word, the one opened last first in each; a group
  with nothing in it has no word. Logseq's ? at the bottom right goes.
- A page's title is a step smaller and tighter.
- Logseq's own menus, pop-ups and lists to choose from stand on the plugin's glass, their lines the menu's size and their keys
  faint marks; the question before a page is deleted is small and in the middle, as the Mac asks; Logseq's windows and its
  settings are on the page's paper with a hairline.
- A folded bullet says after its words, small and grey, what waits under it (a part of its own, `beside/folded.js`): a ↳, an
  open circle with the number of unfinished tasks at any depth (done of all, "1/3", once some are done, the circle ticked when
  all are), the pictures, PDFs and files right under it, each an icon with its number, and the nearest day a task is due ("due
  Oct 19", "was due Oct 12"). Only while it is folded.
- **Add property** is quiet words, a little apart from the rows.
- A journal day has no **DOING** list and no **Scheduled and Deadline** list of Logseq's under it.
- A bullet's properties under its words are one quiet line of names and values, wrapping, with no outline; the one being
  written has a capsule round it; one with nothing in it stays out of the line.
- The right sidebar is flat, as before 0.9: no row of Logseq's own on top (Contents, Page graph, Help), no grey ground, no
  card round a section (no shadow, rounded corner or band behind its head). It stands on the page's own ground with a
  hairline at its edge (still the handle for its width) and a thin line between one section and the next. What a section
  holds is Logseq's own. A page in it reads as a page: its place first, its properties open ("Open properties" is pressed
  for you and left out), then its Relations; its name in the section's head is a link that opens the page. Every line of
  it starts on one edge, about as far from the sidebar's left edge as the right ends are from its right, and the marks (a fold arrow, a list's mark, the + of Add property, a
  value's bullet) stand in the gutter before that edge.
- Logseq's tables: no ground under the column names, no lines between columns, a hairline under each row; each tool says what
  it does in a word beside its icon; a tag's own table leaves out its Tags column.
- A notice, Logseq's own or the plugin's, is a small capsule of words at the bottom centre of the window, where Logseq draws
  a large card under the toolbar at the top right; more than one peek above it. Every notice goes after four seconds, a
  failure too, and stays while the pointer or the keys are on it; its × closes it at once.

### Focusing into a bullet and out (`beside/glide.js`, drawn in `ground/touch.js`, timed in `ground/look.js`)

Where Logseq swaps the whole view at once, the bullet you focus into glides from where it stood to the top in about a
quarter of a second, its children with it, and the rest of the old view fades where it stood. Stepping out runs the same
glide back, the page fading in round the bullet; the bullet comes back selected with Logseq's own selection, until the view
changes again. A bullet that lands out of sight is brought to the middle first. Leaving a focused bullet, the old view
stands until Logseq has drawn the next one, so nothing shows blank or half drawn on the way.

A bullet focused into from the journal's list of days steps out (the arrow, Cmd-,, writing in it or not) back to that list,
not to its day's page: the bullet stands where it stood, and where you were writing, the caret is put back. Back does the
same. A press on the day in the line of steps still opens the day's page.

A bullet folded or opened rolls: what is under it rolls shut or out, and the page below moves with it (a press on its fold
arrow, Cmd-Up and Cmd-Down, t o).

| Do | Result |
|---|---|
| Press a bullet's dot, a step of the line above a focused bullet, Back or Forward, or Logseq's keys for focusing | The glide |
| The faint up arrow after the last step of that line (a press, or Enter or Space on it) | Steps out one level, as pressing that step does |
| Cmd-. on the bullet that came back selected | Focuses into it again |
| Cmd-, in a focused bullet, outside the editor | Steps out one level (Logseq alone opens its settings there; everywhere else Cmd-, is still Logseq's) |
| Cmd-. or Cmd-, while you write in the bullet | Logseq's own; the cursor stays in it and nothing is selected. In a bullet focused into from the journal, Cmd-, goes back to the journal, the caret where it was |

A node of an embed, focused into from the outline it is shown in, steps out (the arrow, Cmd-,) back to that outline, not to
the page it was written on; inside the embed each step goes up one embedded node until then. With the Mac's Reduce motion
on, nothing moves: the old view only fades. Only the main view moves, not the right sidebar. A view with more than 600
bullets is not faded, only the bullet glides; a bullet so far down that Logseq has not drawn it gets no glide. Nothing is
written to the graph. The part has its own switch in the plugin's settings (**Focusing into a bullet and out**).

### A page's place (`page/place.js`)

On the main page, at the right end of the title's line: each of the page's tags with the tags it sits under, up to the top, on
one line that gives way with an ellipsis, its middle level with the title's. Where the title and the line do not both fit,
the line drops under the title and starts on its edge. In the sidebar and in a page opened in a row, the same line stands under the title.
Each name opens its tag. On a tag's own page a line above the title says **Parent** and the tag it stands under; a press lists
your tags as an outline (not the tag itself, nor a tag under it) and **None (at the top)**, and the one taken is where the tag
goes, with the Undo arrow at the bottom right.

### Search (`arrive/search.js`, decided in `core/search.js` and `core/sentence.js`)

Cmd-K, the corner, or **Search** in the command palette opens a section of the right sidebar with the keys in its line (a
setting gives Cmd-K back to Logseq's own search). Cmd-K pressed while Search is on screen takes it out of the sidebar
again: a sidebar the key had opened is shut, and the keys go back to the bullet they were in. It does what Find did (the owner's choices of 26 November 2026).

- Nothing typed: the kinds in the graph, most held first, each with how many nodes it holds (the kinds under it counted in);
  **more** shows all of them as an outline. Under them the pages opened last.
- Letters typed light the choice they begin: a kind ("cons" lights Consultation, with its count), or with a kind taken a value
  its nodes hold ("mei" lights Dr. Mei Chen under Provider). Tab takes the lit choice as a piece of the line.
- A node named exactly the words typed is found even when Logseq's own search misses it (its index can lack older notes;
  "Rebuild search index" among Logseq's commands mends it). The corner's search finds it the same way.
- Plain words: Logseq's own search answers: what holds the words first, then what holds them in a value (said after the words),
  then the rest Logseq found; grouped by kind, the kinds among them offered above. The typed letters are marked a step heavier.
- A kind taken: its nodes (and those of the kinds under it), newest first, and above them what they hold to narrow by, each
  value with how many hold it, then the months. A value or month pressed becomes a piece; words narrow further.
- One line does it all; there are no ways of searching to switch between. "Consultation with Mei Chen around Aug 2026" typed
  there is read as a kind, a value and a time, each said under the line with what it was read as; the time is a strip of months,
  and the nodes just outside it follow under **Near**. Words that name no time, and no kind with something else, are plain
  words, and so is a sentence that finds nothing. Tab puts the lit choice's name in place of the letters that lit it.

| Do | Result |
|---|---|
| A click on a line, or Enter | Goes to the node in the main view; with Shift, opens it in the sidebar |
| The fold arrow, or Right on a line | Opens the node in place under its line; Left closes it |
| Down from the line | Walks the lines |
| Tab | Takes the lit choice; with none lit, steps into the choices (arrows walk them, Escape goes back) |
| A click on a piece, or Backspace on an empty line | Takes that piece, or the last, off |
| Right-click | The line's own menu, and under it **Date position**: a result's day at the beginning or the end of its line (the end as it comes), kept for Search on this Mac |
| Cmd-Enter | Makes a page of the words typed and goes to it |
| Escape | Empties the words, then lets go of the pieces |

### The corner (`beside/corner.js`)

The bottom right corner holds commands, out of the way of what you read and write. **Cmd-Shift-P** opens them, in place of
Logseq's palette (a setting gives the key back), and the same key or Escape lets go. Nothing shows in the corner until the
pointer comes near; then a quiet ···, and a press opens the same list. The list stands in the corner at one size, which does
not change while the words narrow it. Ontology and Todo stand in Logseq's own top right menu too, over Settings (pressed with the pointer). It
is a list to type into, as Logseq's own command palette, and a quick search of everything: under the commands, **In your
notes** lists up to eight pages, bullets, files, tags and properties the words find, each going there. A found line's icon
says what it is (a page, a bullet, a task's status, a tag, a property, a picture, a PDF, another file); its tag stands at the
right end, and under its words, for what is not a page, the page it is on. A click on the tag or the page goes there. **A tap on Shift** looks at the lit line, or the one the pointer was
last moved over: the node stands beside the list as an opened node does (its words, bullets and properties, all Logseq's
own, so it can be written in; no Relations). The arrows move the look along; Shift or Escape closes it. Shift held for a
capital does nothing. The commands: the plugin's commands
first (Search, Todo, Ontology, New page…, Recycle, Update plugins and the rest), then every command of Logseq's own with its
key. Letters narrow it, the closest line first; Enter does the lit line; words no command has offer a new page of that name.
**Option-Enter** adds the words typed as a new bullet at the end of today's journal, whichever line is lit. While words are
typed, a last line **Add to Today ⌥↩**, with a calendar mark and a hairline above it, says so and stays in view; a press on it does the same. The list
closes, you stay where you were, a notice says **Added to Today**, and Cmd-Z takes the bullet back. With nothing typed the
list closes and nothing is added.
What is done to a node stays on its right-click.

**Keys of your own.** Every command of the plugin has a line in Logseq's **Settings → Keymap** (g then s outside a bullet),
marked with the plugin's name, where a key can be given to it or changed: Search, Todo, Todo in the sidebar, Ontology, the
corner, Show the keys, the exports and the rest. Those that come with no key read **Unset**. Cmd-K for Search and
Cmd-Shift-P for the corner are not those lines: they are ticks in Plugin settings, and a key given in the Keymap comes on
top of them. A key given there shows beside the command in the corner's list.

### Hidden menu items and Plugin settings (`beside/hidden.js`, `beside/settings.js`)

A right-click on a line of one of Logseq's menus (a bullet's or a page's right-click menu, a ··· menu, the / menu) offers
**Hide**: the line is left out from then on. Only the screen changes; a hidden line's key still works. **Plugin settings** (in
the corner's commands, Logseq's top right menu, or g then , outside a bullet) is one short page: the hidden items, each with
**Bring back**; a tick for each of the two keys the plugin takes; and a tick for each part, a change taking effect the next
time the plugin is loaded.

### Two pages side by side (`beside/split.js`, Logseq's markup in `ground/touch.js`)

⌘-click (Ctrl-click away from the Mac) a link to a page in the main view: a link in the words or in a property's value, a
tag, a tag in a page's place, or a line of the plugin's lists. That page opens beside the one you are on: the main area splits
into two equal halves, your page on the left, the one you ⌘-clicked on the right, both whole Logseq pages you write in. A
plain click and a Shift-click do what they did before; without the plugin Logseq treats ⌘-click as a plain click.

| Do | Result |
|---|---|
| ⌘-click another link in the left page | That page takes the right half; the one before leaves the sidebar, unless it was there before the split |
| Drag the hairline between the halves | One half grows; neither gets narrower than 320 px. It is held just right of the line, so the left page's scroll bar stays free |
| Double-click the hairline | Equal halves again |
| The two arrows, top right | The two pages change places (where the left shows no page, as on the journals, a notice says so) |
| The ×, top right | The right page leaves by the right edge, then the left one takes the whole width; the sidebar holds what it held, open or shut, as before. To close the left page, swap first |
| Open anything in the sidebar (Shift-click, Cmd-K, Todo) | The split ends and the sidebar is shown as always, the page from the right among what it holds |
| Shut the sidebar (its button, t r) | The split ends; the page stays in the sidebar for the next time |

The two icons are drawn as Logseq's own at the top of the window. The right half is Logseq's own right sidebar drawn as a page
(its other sections wait unseen), so the page there reads as it does on the left: its name as a title over it (a tag's with
Logseq's #, a property's with its P), a tag's Parent line, its place under the title, its properties, Relations and bullets,
with no rule or empty Add property that Logseq's sidebar would add, and no list of a tag's or a property's own settings. Two
things differ: its place stands under the title rather than at its end, and Logseq draws no Unlinked references for a page in
its sidebar. The right half comes in from the right as it opens, and another page taking it rolls out (no motion where less
motion is asked for). If it cannot be shown within a
couple of seconds, the split closes, the sidebar goes back to how it was, and a notice says so: a half never stands blank.
Loading the plugin again closes the split. Nothing is written to the graph. Switch it off with **Two pages side by side** in
the plugin's settings.

### The key sheet (`beside/keys.js`, its lines in `core/sheet.js`)

Hold Option on its own for a moment (0.7 seconds) and a sheet of keys fills most of the window: **Writing**, **Arranging
bullets**, **Finding**, **Moving around** and **Two letters, outside a bullet** (Logseq's and the plugin's, such as g j and
g d). Each line is its words, then each key in a small box in mono, the Mac's marks (⌘⇧P). Every key is read as it is when
the sheet comes, a key changed in Logseq's keyboard settings included; a line with no key is left out, and so are Search's
lines while Search is switched off. While Cmd-K opens Search, Logseq's own search is not listed with it. The page is not
dimmed.

| Do | Result |
|---|---|
| Hold Option alone | The sheet comes; while Option is still down it takes nothing |
| Any other key, a press, the wheel or leaving the window, Option still down | The sheet goes, and the key or press does its own job |
| Let go of Option | The sheet stays, the keys in its line **Find a key** |
| Type | Only the lines that hold every word typed stay, those letters a step heavier; the sheet keeps its size |
| Up, Down | Light a line |
| Escape | Clears what was typed, then closes; the keys go back where they were, into the bullet being written with its caret |
| A press outside | Closes it, and the press lands |
| **Show the keys**, in the command palette or the corner | Opens it staying |

A quick Option with a letter, as in typing é, is over before the sheet would come. Option with Cmd, Shift or Ctrl never
brings it, nor does it come over one of Logseq's windows, menus or lists, or one of the plugin's. Keys are told here, not
set: Logseq's keyboard settings set them. The part can be switched off in the plugin's settings.

### Todo (`arrive/todo.js`)

The corner, or **Todo** in the command palette, opens a section of the right sidebar: your open tasks under **Overdue** (past
its day), **Today**, **Coming up** and **Any time**, each under a small bold word, the words a size smaller
than a page's. A task's day stands at the right end of its line, red once it has passed; **Date position** in the grouping's menu (the second word on the top line) puts it at the beginning of the line instead. The line at the top, **Add or find a
todo**, narrows the list to the tasks holding every word typed, and Return adds what is typed as a task on today's journal. A task set Done or Canceled shows its circle ticked, waits a
moment, then leaves the list, the lines under it closing up; Undo rolls it back.

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

A web address typed without http:// in front is made a link when you leave its bullet: `vanguard.com` is written as
`[vanguard.com](https://vanguard.com)`, so it reads as typed, with the arrow after it, and one step of Undo takes it back.
An address starts with www. or ends in a common ending (.com, .org, .gov …); .in, .me, .app and the like need www. before
or a / after. Mail addresses, file names, code, page names and a property's value are left as typed. Only bullets you write
in are touched.

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
node's own ticked; a press puts a tag on the node or takes it off.

A press on a node's cell under **Tags** in one of Logseq's tables (or Enter on the cell) opens the same outline in place of
Logseq's flat list, with a line to type in; words no tag has make a new tag. A press on a tag in the cell still goes to it.

Every list of tags as an outline folds, as Logseq's outline does: an arrow before a tag with tags under it (under the pointer,
and always once folded, its bullet ringed), Right and Left on its line, Cmd-Up and Cmd-Down. What you fold stays folded in
these lists and in Search's list of all kinds, on this Mac. Typing looks through folded tags too. While a bullet is being
written (the question for a new tag or page) only the arrow folds: the keys stay the bullet's. Ontology keeps its own folds. The same line that adds a task in Todo adds the tag here.

### An empty property (`node/empty.js`)

A bullet's empty properties stay out of its line of properties, and a node opened in a row shows none. While the pointer is
on such a node, a faint + stands after its last property (after its words where it shows none). A press lists the empty
ones under "Empty here"; the one chosen appears in its place with Logseq's own list, calendar or box open. Left empty, it
goes again. At rest, and while keys are typed, there is nothing, and the + takes no room. A page's own properties already
show their empty ones as faint names, so they have no +.

### An opened node, and digging

A node opened in place is Logseq's own editor for it, laid out one way whatever the node is. A tagged bullet's properties,
which Logseq draws as capsules in one clipped strip, and a page's, which it draws as rows, are one kind of row here: the names
in one column as wide as the longest of them, the values in the next. Every row stays Logseq's: what changes a value
is Logseq's own list, date picker or field, and Cmd-Z takes a change back. Under the pointer one mark stands after a value,
taking no room: a small arrow down after a node or a choice from a set list, a + where a property holds several, a calendar
after a day. A press on the mark opens Logseq's list or calendar (several values go on to a second line, never past the edge). A press on a node's name or on a day goes there (Shift: the
right sidebar), under a bullet as on a page; a press on a number or on words writes in place. The same marks stand after the
properties on Logseq's own pages. A property with no value is not listed (where Logseq is asked to show it, a faint dash stands in its value's place). A property is
said once: where Logseq is set to show all of a node's properties (P then A), one that already stands under its words, at its
line's start or end or as its status circle is not listed a second time. What points at the node stands under its rows, under
the word Relations and a thin line.

A value that is a node has a small arrow before it. A press on the arrow digs: that node opens under its value (its name is not
said again), starting a step in from where
the value's words start, with a guide line down from the arrow. It reads the same way (its rows, its Relations) and its own
values are dug into in turn. A second press on the arrow closes it. A press on the value's name goes to
that page, with Shift in the sidebar; with Cmd, Ctrl or Option it stays Logseq's.

| Do | Result |
|---|---|
| Click the arrow before a value | The node opens under its value; a second click closes it |
| Escape, once nothing is being written | Back one node: the deepest dug node first, then the opened row |
| Click the value's name | Goes to that node, as in Logseq |
| Click the mark after a value | Logseq's list or calendar to change it |

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

A tag with tags under it folds as a bullet does: a press on its arrow, or Cmd-Up and Cmd-Down on its row, hides and shows
the tags under it, its bullet carrying Logseq's ring while folded; what is folded is kept on this Mac, and a line to a tag folded
away stops at the nearest tag that shows. Each tag is a row as before the rebuild: its name at the small size, no tag in bold, the rows close, and a hairline from each
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

In the right sidebar a list gives its words the whole width: a line's day stays at the end (or the beginning) of its line, an outline steps in less, and
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

### Export (`beside/export.js`, decided in `core/export.js`, written by `core/markdown.js` and `core/paper.js`)

A page, or some bullets, out of Logseq as a printed page (PDF) or as Markdown. It reads your notes and never changes them.

**The ways in:** in the command palette and in the corner's list, **Export: this page…**, **Export: the selected bullets…**,
and, with the choices as they were left and no window, **Export: copy this page as Markdown** and **Export: save this page as
PDF**; **PDF or Markdown…** on a bullet's right-click menu (that bullet with everything under it) and on a page's menu. With
bullets picked, "this page" means the bullets picked.

**The export window** lies over Logseq. Its bar has the column's icon, **PDF** and **Markdown** as two tabs, and at the right
the button that does the export (**Save PDF…**, or **Copy Markdown** beside **Save as file…**), then ×. Under it is the
preview: for PDF the sheets as they will print, with the margins, footer and page numbers chosen, broken where the print
breaks; for Markdown the text. Over the preview, at the right, how large it is drawn. **Press into the words of the preview
to change them for this export**; your notes do not change. The changed words stay through a change of paper, margins, text
size or footer, and while you look at the other tab; when something changes what is written (a property, the tags, a title
line, the links) the preview is drawn again from the page and a notice says the changed words went. Cmd-Enter presses the
button; Escape closes an open list, then the window.

**The column**, put away until asked for, holds the choices: **Page** (paragraphs or bullets, paper A4 or Letter, margins, text size, page numbers, a
footer) or **Markdown** (page links as words, as `[[wikilinks]]` or as links to `.md` files; the page's properties as front
matter), **Title** (today's date, a line above, a subtitle, "Prepared by"; the two lines are kept for each page), and **Show**
(tags, task marks, and the page's properties and the nodes' own, each ticked or left out, with all and none). A row that holds
one of several opens the plugin's menu; Up and Down walk the rows. Every choice is remembered; a property left out stays left
out on later exports. A property set to "Hide by default" in Logseq starts unticked; ticked on purpose, it stays ticked.

**What is written:** the title, the page's properties and tags, then its words: headings, bold, italics, code, highlights,
links, tags, tasks (Logseq's four states as a circle, `- [ ]` in Markdown) with their deadline, scheduled day and priority,
code blocks, quotations, mathematics, pictures, files, PDF highlights as quotations, embedded nodes in place, references as the
words they point at, and a query with the rows it showed (a table where its table is on screen). On a tag's page the nodes
carrying the tag follow. A property's words kept as a bullet of their own, and templates, are left out. Markdown keeps the
page's shape: a short line with lines under it reads as a heading, and bullets begin one level further in.

There is one paper template, the old **Paper**: black on white with greys and hairlines, a serif, a centred title, the page's
properties on one line, wide margins unless another is chosen. It writes the page as running text: only a bullet started with
`#`, `##` or `###` is a heading; every other line is a paragraph, and the lines under it become its further sentences (a full
stop added where one is missing); numbered lines, tasks, pictures, code, quotations and tables stand by themselves. A citation
in the words, `([[Page]], p. 3)`, `([title](address))` or `(*words*, p. 2)`, becomes a raised number with its note at the end
under **Notes**. **Layout** in the column turns it into **Bullets** instead of **Paragraphs**: every line a bullet, nested as
in Logseq, a heading bold, citations as written. Markdown keeps the words and bullets as they are. **Save PDF…** opens
the Mac's print window (choose *Save as PDF* there; the page's name is the file's name), and the export window comes back
afterwards. **Save as file…** asks for a folder, names the file after the page, leaves a file of that name alone ("Notes
2.md") and shows it in the Finder. In Markdown, pictures and files are named by their path in the graph's `assets` folder and
are not copied.

### Alfred (`beside/outside.js`, `ground/outside.js`, `alfred/`)

The Alfred workflow in `alfred/` (its own README says what its panels do) asks the plugin through Logseq's HTTP APIs server,
which must be switched on in Logseq's settings. The plugin answers by name: `find` (Logseq's own search), `node` (a node
whole: its name and tags, each property its tags give it with what it holds and its set choices, its bullets as an outline,
and what points at it, as Relations lists it), `candidates` (what a node property can hold), `tags`, `markdown` (a bullet
with those under it, or a node whole, written by `core/markdown.js`), and one name for each change: `setWords`, `newBullet`,
`move`, `remove`, `setValue`, `tag`, `status`, `undo`. A property set to "Hide by default" in Logseq is not among a node's
properties, as it is not on the node's own page. Every change answers the node read afresh and how many steps of
Logseq's Undo it took. A day typed as words ("nov 18", "2026-11-18", "tomorrow") is read by `core/days.js`; what it cannot
read is refused, never guessed. The part can be switched off in the plugin's settings like any other.

## What it writes

Only what you do: in Ontology a tag moved, merged, renamed or deleted, properties merged or renamed, a property put on a tag or taken off, the tags a property's values must have, and values moved; a status set from a line, a node deleted from a line's menu, a task added in Todo, a sure value on leaving a bullet, and what is changed from Alfred (a bullet's words, a new bullet, a bullet moved or deleted, a property's value, a tag, a status). Each is one of Logseq's own editor calls, so
**Undo is Logseq's own Undo** (Cmd-Z), the same as on the node's own page. The plugin keeps a list of folded lists in the
window's local storage, and the export window's choices in the plugin's settings. Export writes nothing to the graph; the only
file it writes is the one you save.

## Checking

```
node tools/check.js          the deciding pieces, the stack's layering, then the walk in a real Logseq
node tools/check.js --quick  the first two only
```

`tools/walk.js` starts a test Logseq of its own on a copy of a sample graph and tries the plugin with real presses and keys.
It is a net, not the proof: a change is proven by hand.
