/* The stylesheets of the rows: how the section sits under the page's properties, its outline, days, groups, picks and
   the + line; and the three that leave out what of Logseq's own the rows replace (Linked references, the tag lists) or
   take the days' column away.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs

const twoWayCss = `
/* Under the page's own properties, as more property rows (the light field around them went at the design audit,
   0.4.286, docs/history/DESIGN-AUDIT-2026-10-22.md: a box around rows meant to read as rows): these rows are the far end of a field held by other
   records, so they read like properties but are not this page's own; the → after the name, pointing at the records that hold the field, says so (a ← before the name until 0.4.186). The names are
   the grey of every property name and the days plain grey words (0.4.141, the owner's pick: no blue, no date box).
   Sizes and columns are Logseq's own property rows above, as measured in 2.0.2 (0.4.144): the text at the page's
   size (the names .94 of it, as theirs), a 150px name column, a 12px gap, the values 22px in where theirs start
   after their bullet, 28px rows; the name starts where theirs does, after the room of their property icon (15px and a 4px gap), and the → follows it.
   Only the rows' own layout is here (0.4.318): the tag, the tick box, the filter words, the icons, the field, the card
   and the pop-ups are the kit's, the bar and the buttons the library's (plugin.js).
   The gaps say what belongs together (7 November 2026, the owner: "make the spacing among everything more logical
   groupings"), the same at every depth: nothing between a head and its list or between the lines of one list; 4px
   between rows, as between property rows; a line's gap, 14px (the grammar's gap between groups), after whatever opened
   (a list, a node's box, a list inside a node) and between groups (the page's own properties and these rows; a node's
   properties, what links to it, its bullets; the groups under Group; the nodes since a day); every line 30px, "show all"
   and a bullet too. */
.th-two-way {
  /* The section stands well apart from the page's properties above and its words below (8 November 2026). */
  margin: calc(56px + var(--th-tw-hold, 0px)) 0 24px; padding: 0;
  line-height: 1.5; user-select: text;
  /* One column (the owner, 7 November 2026: one column, not two): each property's name stands on a line of its own,
     its list under it at the section's full width, so a long name never pushes the lists right and the words have room. */
  display: block;
}
/* Waiting unseen in its place for Logseq's property list on a first visit (0.4.333), the page's words below it with it. */
.th-two-way[data-th-waiting] { visibility: hidden; }
#main-content-container:has(.th-two-way[data-th-waiting]) .ls-page-blocks { visibility: hidden; }
/* Only holding room while the page settles: no field, no rows. */
.th-two-way:not(:has(.th-tw-row, .th-tw-beside)) { margin: var(--th-tw-hold, 0px) 0 0; }
/* The room held while the page settled eases away (0.4.283), only then: while the page settles the held room shrinks in the same frame Logseq's list grows, and must not lag. */
.th-two-way[data-th-settling] { transition: margin-top .25s ease; }
.th-two-way .th-tw-row { display: block; padding: 0; }
/* Each property's group stands apart (the owner, 7 November 2026: "generous spacing between sections so it doesn't feel
   packed"; 8 November 2026: "better spacing both in terms of readability and logical groups"): a gap of about two
   lines between one group and the next, open or closed, many times the gap inside a group, so the groups read as
   separate sections at a glance. The name sits right on its list: its line is cut to the words' own height, so the
   space over the head is less than the space between two nodes, and the name reads as the list's caption, not a line
   of its own. */
.th-two-way .th-tw-row + .th-tw-row { margin-top: 64px; }
/* The first group stands a line's gap under the find line, so the name does not sit on its hairline. */
.th-two-way .th-tw-findrow + .th-tw-row { margin-top: 36px; }
.th-two-way .th-tw-row > .th-tw-name { padding-bottom: 0; line-height: 1.2; margin-bottom: -4px; }
/* A property's name starts with its icon (0.4.477), hung in the room left of the name so the names stay on one edge
   with the row's own words ("Mentioned in"), which have none. The section has two edges (the owner, 7 November 2026: the
   cough page's lines started at five places): the icons, chevrons and the + stand on the section's edge; every name,
   list head, new node and its properties start one step in (--th-tw-in), where the nodes' chevrons stand. */
.th-two-way .th-tw-name > .th-kind { font-size: 15px; width: 15px; justify-content: center; margin-left: calc(-1 * var(--th-tw-in)); margin-right: calc(var(--th-tw-in) - 15px); opacity: .5; vertical-align: -1px; }
/* The names stand in one column you can scan down, lined up with the page's properties, in the quiet strength; only the head is bold (the owner, 1 November). */
.th-two-way .th-tw-name { color: var(--lk-quiet); font-size: var(--th-name, 1em); cursor: default; padding-left: var(--th-tw-in); position: relative; }
.th-two-way .th-tw-sep { visibility: hidden; }
.th-two-way .th-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; row-gap: 4px; position: relative; }
.th-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
/* The underline under the words, on every line of a name that wraps (0.4.377, the owner: "you can underline the words of a whole
   sentence not just the bottom part of wrapped line"). */
/* In an open list the name keeps the pixel the old underline (a border) took, so the lines stay where they were. */
/* A little more room between records (0.4.230, the owner: "just increase line spacing of items", in place of taking the line away). */
.th-two-way .th-tw-tag { margin-left: .5em; }
.th-two-way .th-tw-toggle:hover { color: inherit; }
/* The list a count opens into: date, record, tag, one per line, under the value. */
/* The line drops from under the fold arrow (centred 11px in, 0.4.196), as Logseq's own guide lines drop from theirs; the words stay where they were. */
/* Moving around (0.4.184): a record's line lit under the pointer, the field's name
   and the kinds as quiet words, the kinds row above an open list, "earlier" before what is past. */
/* The field's name and the count that opens a list get the same soft patch under the pointer (0.4.185), drawn in the
   padding a negative margin gives back, so nothing moves. */
.th-two-way :is(.th-tw-field, .th-tw-toggle) { border-radius: 4px; padding: 0 .25em; margin-left: -.25em; margin-right: -.25em; transition: background-color .1s ease, color .1s ease; }
.th-two-way :is(.th-tw-field, .th-tw-toggle):hover { color: inherit; background: var(--lk-wash); }
.th-two-way a.th-tw-field { color: inherit; }
.th-two-way .th-tw-chips { display: inline-flex; flex-wrap: wrap; gap: .3rem .9rem; }
/* The days after the kinds, quiet and in the kinds' own size, so the line reads as one summary. */
.th-two-way .th-tw-toggle.th-tw-when { color: var(--lk-quiet); font-size: 14px; }
.th-two-way .th-tw-earlier { display: flex; align-items: center; gap: .5em; margin: 14px 0 2px 0; padding: 0; } /* a line's gap before it; at the chevrons of the nodes it parts (the owner: "start it at chevron") */
.th-two-way .th-tw-earlier::after { content: ''; flex: 1; border-top: 1px solid var(--lk-hair); }
/* The line for adding a node (0.4.303): under the row's values, in the value column; a + at its left, the kit's
   field inline, the tag right after it. */
/* A node's tag sits right after its name (0.4.320, the owner: "move tags for two-way
   link next to item, not right aligned"); the last column takes the rest of the row. */
.th-two-way .th-tw-draft { position: relative; display: grid; grid-template-columns: minmax(0, max-content) auto 1.4em 1fr; column-gap: .5em; align-items: baseline; margin: 0 -.35rem; padding: 0 .35rem 0 calc(var(--th-tw-in) + .35rem); cursor: text; }
.th-two-way .th-tw-row { position: relative; }
.th-two-way .th-tw-add { margin-left: .6em; }
/* The + says what it adds under the pointer, in place, over what follows it (C20, 7 November 2026); nothing moves. */
.th-two-way .th-tw-add { position: relative; }
.th-two-way .th-tw-add::after { content: attr(data-what); position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 4px; padding: 0 6px 0 2px; white-space: nowrap; font-size: var(--lk-small); font-weight: 400; color: var(--lk-quiet); background: var(--ls-primary-background-color, var(--lk-paper, #fff)); opacity: 0; pointer-events: none; transition: opacity .12s; z-index: 2; }
.th-two-way .th-tw-add:is(:hover, :focus-visible)::after { opacity: 1; }
/* The quiet lines inside a list (earlier, since, a year, a gap) start at the nodes' dots, so they read as the list's own. */
.th-two-way .th-tw-list .th-tw-earlier { margin-left: calc(2 * var(--th-tw-in)); }
/* Since you last looked (N1): a small dot before a new node's name, in the link colour of Logseq, quiet. */
.th-two-way .th-tw-new { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--rx-blue-09, #3b82f6); margin: 0 6px 0 0; vertical-align: 2px; }
.th-two-way .th-tw-newcount { font-weight: 400; font-size: inherit; }
.th-two-way .th-tw-newcount[aria-pressed="true"] { color: var(--lk-text, currentColor) !important; }
/* A pinned node (N2): its pin before the name, faint; a gap of a line under the last pinned one. */
.th-two-way .th-tw-pinned { color: var(--lk-faint); font-size: var(--lk-label); margin-right: 4px; }
.th-two-way .th-tw-pingap { height: 10px; }
/* What the list keeps saying (N6): one quiet line under the head; a value in force reads in the text colour. */
.th-two-way .th-tw-keeps { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; margin: 0 0 4px calc(16px + var(--th-ol-gap)); font-size: var(--lk-small); color: var(--lk-quiet); }
.th-two-way .th-tw-keepsword { color: var(--lk-faint); }
.th-two-way .th-tw-keep { all: unset; cursor: pointer; color: var(--lk-quiet); text-decoration: underline; text-decoration-color: var(--lk-line); text-underline-offset: 3px; }
.th-two-way .th-tw-keep:hover, .th-two-way .th-tw-keep[aria-pressed="true"] { color: var(--lk-text, currentColor); text-decoration-color: currentColor; }
.th-two-way .th-tw-kname { color: var(--lk-faint); }
.th-two-way .th-tw-sorted { color: var(--lk-quiet); font-weight: 400; }
/* The year line (N3): a hairline-framed strip under the head, a dot per node at its day, the months under it; a picked week a wash. */
.th-two-way .th-tw-yearline { position: relative; height: 34px; margin: 2px 0 8px calc(2 * var(--th-tw-in)); border-top: 1px solid var(--lk-hair); border-bottom: 1px solid var(--lk-hair); }
.th-two-way .th-tw-ydot { all: unset; position: absolute; top: 8px; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: var(--lk-quiet); cursor: pointer; }
.th-two-way .th-tw-ydot:hover, .th-two-way .th-tw-ydot:focus-visible { background: var(--lk-text, currentColor); box-shadow: 0 0 0 3px var(--lk-wash); }
.th-two-way .th-tw-ydot.th-tw-yoff { opacity: .3; }
.th-two-way .th-tw-ymonth { position: absolute; bottom: 1px; font-size: var(--lk-label); color: var(--lk-faint); transform: translateX(-2px); pointer-events: none; }
.th-two-way .th-tw-yband { position: absolute; top: 0; bottom: 0; background: var(--lk-wash); pointer-events: none; }
/* Saved views (N9): a quiet line under the find line. */
.th-two-way .th-tw-views { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; margin-top: 4px; font-size: var(--lk-small); }
.th-two-way .th-tw-viewname { all: unset; cursor: pointer; color: var(--lk-quiet); text-decoration: underline; text-decoration-color: var(--lk-line); text-underline-offset: 3px; }
.th-two-way .th-tw-viewname:hover { color: var(--lk-text, currentColor); }
/* The keyboard walk (N14): the name the keyboard is on reads with its underline and the line's wash. */
.th-two-way a.th-tw-record:focus-visible { outline: none; text-decoration-color: currentColor !important; background: var(--lk-wash); border-radius: 3px; }
/* Compare (N4): the two in a card, one property to a line; what differs in the text colour, what is the same quiet. */
.th-tw-cmp { display: grid; grid-template-columns: max-content minmax(0, 1fr) minmax(0, 1fr); gap: 4px 14px; padding: 6px 12px 10px; font-size: var(--lk-small); line-height: 1.45; }
.th-tw-cmph { font-weight: 600; padding-bottom: 4px; }
.th-tw-cmpk { color: var(--lk-quiet); }
.th-tw-cmpv.th-tw-cmpsame { color: var(--lk-quiet); }
.th-tw-cmpnone { color: var(--lk-faint); }
.th-tw-cmpline { padding-bottom: 2px; }
/* A line dragged onto another list (N5): that list's head reads in the wash where it would land. */
.th-two-way .th-tw-row[data-dropnode] > .th-tw-value > .th-tw-head { background: var(--lk-wash); border-radius: 4px; }
.th-two-way .th-tw-line.th-tw-dragging { opacity: .45; }
/* A list kept beside you (N15): a small panel at the window's right edge, Logseq's own paper and hairline. */
.th-tw-dock { position: fixed; right: 16px; bottom: 56px; width: 280px; max-height: 46vh; overflow: auto; z-index: 9; padding: 8px 10px 10px; }   /* its frame is the library's lk-pop */
.th-tw-dockhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding-bottom: 6px; }
.th-tw-dockpage { color: var(--lk-quiet); }
.th-tw-dockline { display: grid; grid-template-columns: 3.4em 1fr; gap: 6px; padding: 2px 4px; margin: 0 -4px; border-radius: 4px; color: inherit; text-decoration: none; }
.th-tw-dockline:hover { background: var(--lk-wash); }
.th-tw-dockday { color: var(--lk-faint); font-variant-numeric: tabular-nums; text-align: right; }
/* A list dragged by its name (C17): where it would land, a hairline above or below the list it is over. */
.th-two-way .th-tw-name[draggable="true"] { cursor: grab; }
.th-two-way .th-tw-row.th-tw-dragging { opacity: .45; }
.th-two-way .th-tw-row[data-drop="above"] { box-shadow: inset 0 2px 0 var(--lk-line); }
.th-two-way .th-tw-row[data-drop="below"] { box-shadow: inset 0 -2px 0 var(--lk-line); }
/* A week back, a week on, Today, under the find line while it holds a day (C15). */
.th-two-way .th-tw-daysteps { margin-top: 4px; }
/* The empty bullet at a node's end draws nothing until it is written in (8 November 2026, the owner: "remove the place holder
   for empty bullet"): no dot, no words, no room, at rest or under the pointer. It is there for the caret, as Logseq's next
   bullet is: Enter after a bullet's words, or Tab, brings it, and it shows while it has the caret or words. */
.th-two-way .th-ol-new:not(:focus-within):not(:has(input:not(:placeholder-shown))) { height: 0; min-height: 0; margin: 0; padding: 0; overflow: hidden; opacity: 0; }
/* Date first in a short row, name first in a list (0.4.304): the same columns as the other kind, the other way round. */
.th-two-way .th-tw-draft-plus { position: absolute; left: .35rem; width: 16px; height: 1.8em; display: inline-flex; align-items: center; justify-content: center; }   /* as tall as the words beside it */
.th-two-way .th-tw-draft-plus::before { margin-right: 0; width: .75em; height: .75em; vertical-align: 0; }   /* the library's + mark, alone, centred in the line */
.th-two-way .th-tw-draft-main { display: flex; align-items: baseline; gap: .5em; min-width: 0; }
.th-two-way .th-tw-draft-main .th-field { flex: none; min-width: 0; max-width: 100%; }
/* The box is as wide as its words (or the "Add a …" in it), so the tag sits right after them as on a node's line. */
.th-two-way .th-tw-draft-field { field-sizing: content; min-width: 3ch; max-width: 100%; }
/* No line under the box for a new node (0.4.400, the owner: it read as a link or a filled value beside the real links); its
   pixel is kept so nothing moves. */
.th-two-way .th-tw-draft .th-field { border-bottom-color: transparent; }
.th-two-way .th-tw-draft-typed { flex: none; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-two-way .th-tw-draft .th-tw-draft-tag { margin-left: 0; white-space: nowrap; }
/* The rest of the new node under the line (0.4.406): the proposals' look (parts/proposals.js), the row's height kept. */
.th-two-way .th-tw-draft-props { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1.1em; row-gap: .1em; min-height: 1.5em; font-size: 14px; line-height: 1.5; }
.th-two-way .th-tw-dprop { display: inline-flex; align-items: baseline; gap: .35em; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: default; text-align: left; }
.th-two-way button.th-tw-dpick { cursor: pointer; }
.th-two-way .th-tw-dname { color: var(--lk-faint); }
.th-two-way .th-tw-dpassed { opacity: .45; }
/* A page's name completed in grey after the cursor (0.4.406): a copy of the words laid over the box, the typed part clear. */
.th-two-way .th-tw-draft .th-field { position: relative; }
.th-two-way .th-tw-ghost-over { position: absolute; box-sizing: border-box; pointer-events: none; white-space: pre; overflow: hidden; }
.th-two-way .th-tw-ghost-typed { color: transparent; }
.th-two-way .th-tw-ghost-rest { color: var(--lk-faint); }
.th-two-way .th-tw-ghost-rest[data-name]::after { content: "  " attr(data-name); font-size: var(--lk-small); }
/* Group a row by anything (0.4.369): the word after the count, a group's name with its count and its +, the lines
   under it. Write into a node (0.4.369): the small arrow before a node, its bullets under its line. */
/* Group shows all along (0.4.403, the owner: "can keep Group there all along, capitalize G"); before it showed only with
   the pointer on the row. */
.th-two-way .th-tw-groupby { margin-left: .6em; }
.th-two-way .th-tw-groupby .ti { font-size: 12px; }
.th-two-way .th-tw-ghead { display: flex; align-items: baseline; gap: var(--th-ol-gap); margin: 14px 0 2px; }
.th-two-way .th-tw-group:first-child .th-tw-ghead { margin-top: 2px; }
.th-two-way .th-tw-gwords { display: inline-flex; align-items: baseline; gap: .35em; padding-right: .25em; color: var(--lk-quiet); }
.th-two-way .th-tw-gn { font-size: 14px; }
/* A group's + is the library's lk-reveal. */
.th-two-way .th-tw-group .th-tw-draft { padding-left: .35rem; }
.th-two-way .th-tw-group .th-tw-draft-plus { display: none; }
/* The chevron before a node's name (0.4.435): always there, faint; full under the pointer or while the node is open. */
/* A node's properties in its opened box (0.4.410): two columns as Logseq's own property list, the name lighter than the
   value, a node property's mark before the name (a fact none); a value a quiet button, a wash under the pointer; "empty" in grey. */
/* Follow a chain (0.4.423): a value that is another node has a small chevron before it, turning down when it is open;
   the node opened through it sits under the property, across both columns, with its properties, the rows that point at
   it and its bullets, a line down its left like an opened node's. Its size is the row's again, not the properties'. */
/* A mention made a node (0.4.423): what it would get, under the one picked, in the proposals' grey. */
/* Picking (0.4.228): the kit's tick box before each record, in the room left of it; shown under the pointer and on
   every record while any is picked. The bar is the library's, above the rows. */
/* The box answers 6px round it as well (0.4.297); the room left of the record ticks it too (onClick). */
/* In an open list the box sits left of the outline's line (0.4.229, the owner: "to the left of the outline, not within it"). */
/* Records not in a list too, one to a line so their boxes share that column (0.4.230, the owner: "even those not in a outline"). */
/* Each record on a line of its own, as in an open list (0.4.297); its tag right after its name since 0.4.320 (it was at
   the right edge from 0.4.297, the owner then: "the tags under decided should be right aligned"). */
/* In the wrapping row a negative margin shifts a node instead of widening it (measured in the app, 0.4.299: its right edge
   5 px and its tag 10 px short of an open list's): so it is widened by the margins themselves, the open list's .35rem. */
/* The same room as in an open list: half a letter before the day, a letter before the tag. */
/* The room between the words and the day, and before the tag: a space, widened, which a line may break at and which
   leaves no gap at the start of a line. */
/* a long name wraps, never cut (0.4.263) */
/* The room left of a record, where its box sits, counts as the record under the pointer, so the box shows there too. */
.th-two-way { position: relative; }
/* Drawn again whole on each change, so the browser's scroll anchoring would pick a new line to hold the page by and move
   it (frame by frame: 26 px up at the first letter typed, nothing having changed in height). The page keeps its place. */
.th-two-way, .th-two-way * { overflow-anchor: none; }
/* While finding, a list heading's + and Group are away: they rode on the end of its words, which change with each letter. */
.th-two-way[data-finding] :is(.th-tw-add, .th-tw-groupby) { display: none; }
/* The bar is the library's lk-picked. Above the first picked node it reaches as far left as the tick boxes and as far right as the
   picked nodes' grey, its top corners round, so the bar and the nodes under it are one block. No room is kept for it at rest. */
.th-two-way .th-tw-bar[data-idle] { display: none; }
.th-two-way .th-ol .th-tw-bar { margin: 4px -12px 0 -34px; padding-left: 18px; border-radius: 8px 8px 0 0; }
.th-two-way > .th-tw-bar { margin: 0 0 6px; border-radius: 8px; }
.th-two-way .th-tw-chev::before { margin: 0 0 0 .1em !important; opacity: .75; }
/* The fold arrows as Logseq's (the owner, 7 November 2026: "arrows should hide too", after "faint, always there" that morning):
   unseen at rest, open or closed, and there under the line's pointer, full under the arrow itself; the dot and its ring say
   what is folded. A keyed arrow shows while it has the focus. */
.th-two-way .lk-row .lk-fold { opacity: 0 !important; }
.th-two-way .lk-row:hover .lk-fold, .th-two-way .lk-fold:focus-visible { opacity: .6 !important; }
.th-two-way .lk-row:hover .lk-fold:hover, .th-two-way .lk-fold:hover { opacity: 1 !important; }
/* A list's head keeps its fold arrow in sight, faint, open or closed (7 November 2026, the owner: "make sure these chevrons are
   always visible", beside "All 6"): the head is what folds the list, so its arrow is there to be seen; a node's arrow still waits for the pointer. */
.th-two-way .lk-row.th-tw-head .lk-fold, .th-two-way .th-tw-ghead .lk-fold, .th-two-way .th-tw-whole-line .lk-fold { opacity: .45 !important; }
.th-two-way .lk-row.th-tw-head:hover .lk-fold, .th-two-way .th-tw-ghead:hover .lk-fold, .th-two-way .th-tw-whole-line:hover .lk-fold { opacity: .7 !important; }
.th-two-way .lk-row.th-tw-head .lk-fold:hover, .th-two-way .th-tw-ghead .lk-fold:hover, .th-two-way .th-tw-whole-line .lk-fold:hover { opacity: 1 !important; }
/* No grey under the pointer on a line (the owner, 7 November 2026: "lets remove the highlight as the cursor"); a line lit from the
   keyboard (.on) keeps it, and the picked lines keep theirs. */
.th-two-way .lk-row:hover:not(.on) { background: transparent; }
/* On a list where picking is on, its boxes stand at rest; elsewhere none is drawn. */
.th-two-way .lk-list[data-picking] .lk-tick { opacity: .55 !important; }
/* The picked nodes on one grey ground, so the eye sees which they are. */
.th-two-way .th-tw-line:has(> input.th-tw-pick:checked) { background: var(--lk-wash); box-shadow: -40px 0 0 var(--lk-wash), 12px 0 0 var(--lk-wash); border-radius: 0; }

/* The rows on the kit's outline (0.4.442): each node a line, the tick box in the margin, the day in its column, the one
   chevron right before the name; a list opens under its count with no line of its own; what a node holds opens under
   its name (the kit's kids). The section keeps Logseq's value column: the outline starts where Logseq's values do. */
.th-two-way .th-tw-value { display: block; font-size: inherit; }
.th-two-way .th-tw-value.th-ol { --th-ol-day: calc(var(--lk-day, 48px) + 6px); font-size: inherit; line-height: 1.5; }
/* Every line 32px (8 November 2026: 36px was tried, the owner: "line can be tighter, but group spacing is good"). */
.th-two-way .th-ol-line { min-height: 32px; padding-top: 4px; padding-bottom: 4px; }
/* "show all" and a bullet stand on the lines' 30px too (the library's lk-more carries its own 3px; the kit's bullet 1px). */
.th-two-way .th-ol-line.th-ol-moreline { padding-top: 4px; padding-bottom: 0; }
/* The list's head is its title: a little more room under it than between its nodes. */
.th-two-way .th-ol-line.th-tw-head { padding-bottom: 8px; }
.th-two-way .th-ol-bullet { min-height: 32px; padding-top: 4px; padding-bottom: 4px; }
/* What opened ends with a line's gap, inside its box: the next line of the list stands clear of it. */
.th-two-way .th-ol-kids:not(.th-ol-bare) > .th-ol-in { padding-bottom: 20px; }
/* Inside an opened node, a line's gap parts its groups: its properties, what links to it, its bullets; and each list of
   what links to it (its first line carries the name) from the one before. */
.th-two-way .th-ol-in > .th-tw-links:first-child { margin-top: 0; }
.th-two-way .th-ol-in > :not(.th-ol-bullet) + .th-ol-bullet { margin-top: 14px; }
.th-two-way .th-tw-linked > :is(.th-ol-prop, .th-ol-unit):not(:first-child):has(> .th-ol-pname:not(:empty), > .th-ol-prop > .th-ol-pname:not(:empty)) { margin-top: 14px; }
/* A bullet's words are written in where they stand (the owner, 7 November 2026): the text cursor says so, as in Logseq; the
   dot, which opens the bullet, is the one thing there to press. Tab reaches the words, Enter changes them. */
.th-two-way .th-ol-words[data-edit-bullet] { cursor: text; border-radius: 4px; padding: 0 4px; margin: 0 -4px; }
.th-two-way .th-ol-words[data-edit-bullet]:focus-visible { background: var(--lk-wash); }
.th-two-way .th-ol-bullet[data-bullet] > .th-ol-dot { cursor: pointer; }
.th-two-way .th-ol-line > input.lk-tick[type=checkbox] { top: 9px; }
.th-two-way .th-tw-head { cursor: default; }
.th-two-way .th-tw-head:hover { background: transparent; }
/* An outline (the owner, 2026-10-27: "have [date] [chevron] [bullet]"; "13 symptom logs chevron should be aligned with
   having fatigue and spoke with"): a list's line starts on the edge where a line with no day starts its chevron; its
   nodes show [day] [chevron] [node] to its right; under Group by a group's line is one step in from it. The list's line
   reads as a heading, a little heavier than a node. --th-tw-in is the step. */
.th-two-way { --th-tw-in: 22px; } /* the chevron and its gap (16px + 6px, --th-ol-gap is set further in) */
.th-two-way .th-tw-head .th-tw-toggle, .th-two-way .th-tw-head .th-tw-chips { font-weight: 500; }
.th-two-way .th-tw-head .th-tw-chips { gap: .3rem 1.05rem; align-items: baseline; min-width: 0; overflow: hidden; }
/* The words' wash reaches .25em past them (padding given back by margin): the clip edge stands that far out too, so the first letter is never cut. */
.th-two-way .th-tw-head .th-tw-chips { padding-inline: .25em; margin-inline: -.25em; }
.th-two-way .th-tw-head .th-tw-toggle.th-tw-lead, .th-two-way .th-tw-head .th-chip.th-tw-lead[aria-pressed="true"] { color: inherit; font-weight: 500; font-size: inherit; }
.th-two-way .th-tw-head :is(.th-tw-chip:not(.th-tw-lead), .th-tw-when) { font-weight: 400; color: var(--lk-quiet); font-size: inherit; }
.th-two-way .th-tw-head .th-tw-chip[aria-pressed="true"] { color: inherit; font-weight: 600; }
.th-two-way .th-tw-head .th-chip.th-tw-lead[aria-pressed="false"] { color: var(--lk-quiet); font-weight: 400; font-size: inherit; }
.th-two-way .th-tw-head .th-tw-sep { position: absolute; right: 100%; margin-right: .42rem; color: var(--lk-faint); font-weight: 400; }
.th-two-way .th-tw-head .lk-more { padding: 0; font-weight: 400; }
.th-two-way .th-tw-head .th-tw-piece { position: relative; display: inline-flex; align-items: baseline; white-space: nowrap; }
/* The days' words wrap as words do where the kinds' room is shorter than they are, never cut through a letter. */
.th-two-way .th-tw-head .th-tw-piece:has(> .th-tw-when) { white-space: normal; min-width: 0; }
/* A list's days hang in the margin left of the outline (the owner, 2026-10-27: "dates … should not be in the way"): a
   node's chevron sits under its heading's words, one step in, and its day ends 4px short of the heading's chevron; under
   Group by the nodes step in once more under their group. */
/* The margin is the section's: room for a tick box and a day before the outline's edge, on every row, so a day never
   reaches the property names. *
/* Each node a bullet, as Logseq draws one (the owner, 7 November 2026): its chevron, its dot, then its day in a column of
   one width, so the words of a list's lines start at one place; a list with no day has no column. The list's head stands
   on the property's edge, its chevron under the property's mark, and its nodes one step in, their chevrons under its words. */
.th-two-way .th-tw-value { padding-left: 0; }
/* A list with no head (a single node, "Mentioned in") steps in as one with a head does, so every node's chevron stands
   one step in, its dot after it, at one place down the whole section; its line for a new node stays on the edge. */
.th-two-way .th-tw-value:not(:has(> .th-tw-head)) { padding-left: var(--th-tw-in); }
.th-two-way .th-tw-value:not(:has(> .th-tw-head)) > .th-tw-draft { margin-left: calc(-.35rem - var(--th-tw-in)); }
/* A heading's chevron is never over its nodes' chevrons (the owner, 2026-10-27: "the heading chevron cannot be over other
   chevrons"): everything a list holds steps in one step, dated or not, and a group's nodes once more under the group;
   a day stays in the margin left of its node's chevron. */
.th-two-way .th-tw-list > .th-ol-in { padding-left: var(--th-tw-in); --th-tw-back: var(--th-tw-in); }
.th-two-way .th-tw-group > .th-tw-gitems { --th-tw-back: calc(2 * var(--th-tw-in)); }
/* Every day of the section ends on one edge, 12px short of the outline's edge, however far in its node's chevron is
   (--th-tw-back: how far the room it sits in starts right of that edge), so the margin reads as one column of time. */
.th-two-way .th-ol-day { text-align: left; }
/* What a node opens hangs from its dot, as Logseq's guide line drops from a bullet. */
.th-two-way .th-ol-from-in { --th-ol-cx: calc(16px + var(--th-ol-gap) + 8px); }
.th-two-way .th-tw-back + .th-ol-kids { --th-ol-cx: calc(var(--th-ol-name) + 8px); }
/* Digging steps the same 22px as a list under its heading: a node's lines start under its words (8px to the hairline,
   1px of it, 13px after). The faint grey of an opened node stops at the section's right edge. */
.th-two-way .th-ol-kids:not(.th-ol-bare) { padding-left: 13px; }
.th-two-way .th-ol-unit { margin-right: 0; }
.th-two-way .th-tw-group > .th-tw-gitems { padding-left: var(--th-tw-in); }

/* The tick boxes show when the pointer is on their row, and all of them while anything is ticked (the owner, 2026-10-27:
   "checkboxes can be revealed on hover", in place of the faint box of 2026-10-25 for these). */
/* When the tick boxes show is Look's (the shared names lk-list and lk-tick). Each property's row is the list (the
   review, 31 October: the pointer on one row lit eleven boxes down the section, and the caret in the find line six),
   so only its boxes appear; the find line stands outside the rows and raises none. */
.th-two-way .th-tw-head > .th-ol-body { display: flex; align-items: baseline; column-gap: .9rem; }
.th-two-way .th-tw-head > .th-ol-body > :is(.th-tw-add, .th-tw-groupby) { margin-left: 0; flex: none; }
/* A name is one line, cut at the width the row leaves; its tag and what follows keep theirs. */
.th-two-way .th-ol-body:has(> .th-tw-record) { display: flex; align-items: baseline; }
/* A node's words run to two lines, then are cut (the owner, 1 November: a short note reads whole, a long one cannot run away). Opened or found, they read whole. */
.th-two-way .th-ol-body > .th-tw-record { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
/* The mark stays on the first line of a name that wraps (an opened node's), not in the middle of the words. */
.th-two-way .th-ol-body > .th-tw-record.th-ol-open, .th-two-way[data-finding] .th-ol-body > .th-tw-record { display: block; -webkit-line-clamp: none; }
.th-two-way .th-ol-body > .th-tw-record ~ * { flex: none; }
/* A task's circle, Logseq's own, before its words as in Logseq (8 November 2026): its size beside 16px words, the gap after
   it the gap Logseq leaves; the colour is Logseq's (its ls-icon- class). On the first line of words that wrap. */
.th-two-way .th-task { flex: none; align-self: flex-start; display: inline-flex; align-items: center; height: 1.5em; margin-right: 6px; }
.th-two-way .th-task svg { width: 1.05em; height: 1.05em; display: block; }
.th-two-way .th-ol-body > .th-pencil, .th-two-way .th-ol-body > .th-tw-could { margin-left: 8px; }
.th-two-way .th-tw-could { display: inline-flex; align-items: baseline; }
/* No underline at rest in this section, under the pointer the firm one (the owner, 1 November 2026: long names, each underlined in full, striped it). */
.th-two-way a.th-ol-name.lk-node { text-decoration-color: transparent !important; }
.th-two-way a.th-ol-name.lk-node:is(:hover, :focus-visible) { text-decoration-color: currentColor !important; }
.th-two-way .th-ol-body { display: inline; }
.th-two-way .th-ol-body > :is(.th-tw-add, .th-tw-groupby) { margin-left: .5em; }
.th-two-way .th-tw-tell { margin-left: 6px; color: var(--lk-faint); font-size: var(--lk-small); white-space: nowrap; }
/* Inside an opened node, the nodes that link to it (0.4.462): their line in words, then their rows one step in, each a dot and its day as on the rows. */
.th-two-way .th-tw-links { margin-top: 14px; align-items: baseline; gap: 6px; }
/* What links to an opened node, as a head (C4): its words in the head's weight, the kinds quiet after them. */
.th-two-way .th-tw-linkword { all: unset; cursor: pointer; }
.th-two-way .th-tw-linkword { font-weight: 500; }
.th-two-way .th-tw-linkkinds { color: var(--lk-quiet); font-size: var(--lk-small); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The empty properties of an opened node, folded into one quiet line (C5). */
/* The names' column of an opened node fits its longest name (C6). */
.th-two-way .th-ol-kids[style*="--th-tw-name"] > .th-ol-in { --th-ol-name: var(--th-tw-name); }
/* Inside an opened node a name is never cut (C8): at any width it wraps whole. */
.th-two-way .th-ol-kids .th-ol-body > .th-tw-record { display: block; -webkit-line-clamp: none; overflow: visible; }
.th-two-way .th-tw-linked { padding-left: var(--th-tw-in); }

/* A shifted section's top (0.4.463): the trail ends on it in bold; its properties; then "N nodes link here" on the
   find field's hairline, and its rows as the page's. */
.th-two-way .th-tw-toplinks { grid-column: 1 / -1; color: var(--lk-quiet); font-size: var(--lk-small); padding: 0 0 5px; margin: 14px 0 4px; border-bottom: 1px solid var(--lk-hair); }
::highlight(th-find) { background-color: var(--rx-blue-04, #e1f0ff); } /* a very subtle blue, Logseq's own (the owner: "I don't like a yellow highlight, do very subtle blue") */
/* The grey line under a node (where it sits) keeps its whole words and runs the width of the line (the owner, 7 November
   2026: "the subtitle should get full width"), to two lines, then is cut, as a node's own words are. */
.th-two-way .th-tw-crumb { color: var(--lk-faint); font-size: var(--lk-small); line-height: 1.3; margin: 0 0 3px var(--th-tw-words); overflow-wrap: anywhere; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
/* Where a node's words start: after its chevron and its dot, and the day's column in a list that has days. */
.th-two-way .th-tw-value { --th-tw-words: calc(32px + 2 * var(--th-ol-gap)); }
/* A list where a line says what its day is of: the day column widens by the longest name, for every line of it. */
.th-two-way :is(.th-tw-value.th-ol, .th-tw-bside, .th-ol-prop)[style*="--th-tw-from"] { --th-ol-day: calc(var(--lk-day, 48px) + 8px + var(--th-tw-from) * 1ch); }
.th-two-way .th-tw-value[data-dated] { --th-tw-words: calc(32px + 3 * var(--th-ol-gap) + var(--th-ol-day)); }
.th-two-way .th-tw-crumb .lk-step { font-size: inherit; }
.th-two-way .th-tw-raise { display: flex; flex-wrap: wrap; column-gap: 1.1em; align-items: baseline; margin: 0 0 .2rem var(--th-tw-words); font-size: 14px; line-height: 1.5; }
.th-two-way .th-tw-npvalue { all: unset; cursor: pointer; border-radius: 3px; }
.th-two-way .th-tw-npvalue.th-faint { color: var(--lk-faint); }
.th-two-way .th-tw-npvalue:hover, .th-two-way .th-tw-npvalue:focus-visible { text-decoration: underline; text-decoration-color: var(--lk-line); text-underline-offset: 3px; }
.th-two-way .th-ol-pname[data-edit] { cursor: pointer; }
.th-two-way .th-ol-pname[data-edit]:hover { color: inherit; }
.th-two-way .th-tw-findrow { grid-column: 1 / -1; padding: 0; }
/* The section's own line, the whole of it folding under it, as Logseq's Linked references head does. */
.th-two-way .th-tw-whole { grid-column: 1 / -1; padding: 0 0 8px; }
.th-two-way .th-tw-whole-name { color: inherit; font-weight: 500; text-decoration: none; cursor: pointer; }
.th-two-way .th-tw-whole-name:hover { text-decoration: none; }
/* The whole width of the section, its line a hairline even while typing (the owner: "weirdly short", "bottom of it can be
   hairline"). */
.th-two-way .th-tw-findrow > .th-field, .th-two-way .th-tw-findrow > .th-field:focus-within { border-bottom-color: var(--lk-hair); }
.th-two-way .th-tw-stepped { grid-column: 1 / -1; }
.th-two-way .th-tw-stepped > .th-ol-trail { padding: 2px 0 8px; }
.th-two-way .th-tw-ghead .th-chev { align-self: center; }
/* The tick box of a node sits in the margin left of the outline (0.4.229, the owner: "to the left of the outline"). */
.th-two-way .th-tw-line > input.lk-tick.th-tw-pick { left: -22px; }
/* Where you are (0.4.442): the names opened on the way, pinned at the top of the section once they scroll off; no room. */
.th-two-way .th-tw-pin { grid-column: 1 / -1; position: sticky; top: var(--th-tw-pin-top, 0px); height: 0; z-index: 3; }
.th-two-way .th-tw-pin > .th-ol-trail { position: absolute; left: -12px; right: -12px; top: 0; padding: 5px 12px; background: var(--lk-paper, var(--lk-paper, #fff)); border-bottom: 1px solid var(--lk-hair); }
/* On a day (7 November 2026): the nodes after it stand faint under a "since" line; the head says how many there are today. */
.th-two-way .th-tw-since { opacity: .55; }
.th-two-way .th-tw-since .th-tw-earlier { opacity: 1; }
.th-two-way .th-tw-was { margin-left: .2em; }
/* Two pages side by side (7 November 2026): the property names in the rows' name column, each page a column. */
.th-two-way .th-tw-beside { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(150px, max-content) minmax(0, 1fr) minmax(0, 1fr); column-gap: 12px; row-gap: 4px; align-items: first baseline; padding: 2px 0; }
.th-two-way .th-tw-bhead { font-weight: 600; padding-bottom: 10px; min-width: 0; overflow-wrap: anywhere; }   /* a line's gap under the titles, and under each list, with the grid's 4px */
.th-two-way .th-tw-bhead .th-tw-bpage { text-decoration-color: transparent; }
.th-two-way .th-tw-bhead .th-tw-bpage:hover { text-decoration-color: var(--lk-line); }
.th-two-way .th-tw-bown, .th-two-way .th-tw-bcell { min-width: 0; overflow-wrap: anywhere; }
.th-two-way .th-tw-bcell { padding-bottom: 10px; }
.th-two-way .th-tw-bcell .th-tw-chips { display: inline; }
.th-two-way .th-tw-bnone { color: var(--lk-faint); }
.th-two-way .th-tw-bside { margin-top: 2px; }
.th-two-way .th-tw-bside :is(.th-tw-bline, .th-ol-moreline) { padding-left: 0; }
.th-two-way .th-tw-bside .th-ol-body > .th-tag { white-space: normal; }
`;
/* Logseq's own far end (0.4.146, the owner's pick): the tag-named tabs below a page's blocks list the same records
   as the rows, without the field that links them. Left out in the main view while the rows are drawn there, so a page
   with none keeps Logseq's list; and in the right sidebar always (0.4.421, the owner: "hide that bi-directional section
   that is already hidden in main views"), though it gets no rows: the same records are in its Linked references. */
// Logseq's Linked references (only that: Unlinked references sits outside .references) where the rows replace it (0.4.437).
const hideLinkedRefsCss = `
#main-content-container:has(.th-two-way[data-th-replaces][data-th-rows]) .references { display: none !important; }
`;
// The days' column taken away (twoWayDays off): its width to nothing, so the rows move left into it, and the days unseen.
const noDaysCss = `
.th-two-way, .th-two-way * { --th-ol-day: 0px !important; }
.th-two-way .th-ol-day { visibility: hidden !important; }
`;
const hideTagListsCss = `
#main-content-container:has(.th-two-way[data-th-rows]) :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }
#right-sidebar :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }
`;

Object.assign(twoWay, { hideLinkedRefsCss, hideTagListsCss, noDaysCss, twoWayCss });
})();
