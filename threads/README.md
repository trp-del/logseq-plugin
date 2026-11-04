# Threads

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

On a page, everything that points at it, named by the property it came through, to follow and dig along. A link made by a property reads from both ends: on the page it points to, each such property is a row under the title and the properties, above the page's own words, with the nodes that hold it, their tag and day. A node's name carries no underline there until the pointer is on it, and a page not read yet this session shows its rows and its words together, once the read has answered, so nothing moves after it opens. Rows under a head that names one kind carry no mark, and the find line stands from twenty rows up. A node's name runs to two lines and is then cut, never at a sentence; opened, or while finding, it reads whole. A list's head names three kinds, then "and 12 more" (a click shows them all), and its days; a head that wraps starts each line on its words, and the + and Group keep their place on the first line. The head folds its list; in a grouped list each group folds by its arrow, its words do not, and a group that is a tag opens the tag's page. Pointing at a name for a moment raises a card with only what the row does not say, the node's other properties and first lines, and its whole name if the row cut it; with nothing to add there is no card. The card stands to the right of the words beside it, else above the row. Rows fold, group, find, dig into nodes in place, and take a node's value changes with an Undo arrow.

The moments of use (the review of 31 October 2026): a node dug open at the page's width shows every property on one line, name then value, the chevron hanging before a value that opens; the names go on a line of their own only where the section is truly narrow (the sidebar). A line ends with its name and tag, nothing after them; Shift-click on a name opens it in the sidebar. The tick boxes of a list appear when the pointer is on that list alone, and the caret in the find line raises none. The mentions row's head is its days ("from Sep 30 to Oct 19"); while letters are typed, every head keeps the whole list's words and order and only the nodes narrow. A row's right-click menu is as wide as its longest words. A value being typed stays open when the rows are drawn again, its words and caret where they were.

Logseq's Linked references gives way to the rows only where the mentions were really read: with **Mentions come up to the rows** off, or a read that failed, it stays. A link to a page's alias counts as a link to the page, in the rows and in Mentioned in, as Logseq counts it. Under a mention, the line of where it sits ("Library › Oct 23rd, 2026") is steps: each place, with the faint underline of a step, opens its page or bullet, Shift in the right sidebar.

One Undo arrow stands, on the last change; a new change's arrow takes its place. An arrow on something made, a bullet, a node or a page, goes as soon as that thing is written in, renamed or given a bullet, and pressed after a change it takes nothing and says so: what was written is never taken with it. A date in a node's words reads as Predictive reads it: a past day stays past, and a weekday in words that tell of what has been proposes nothing.

As the graph grows: a list of values shows forty, then "show all 3000", and typing narrows it; a property that takes Person offers pages under the tags beneath Person too. A section reads again only when a change reaches it: words in one of its nodes, a line that links this page, or anything that is not writing. A node's day is the property titled Date, whatever its ident, else the earliest. The pencilled tag on an untagged mention stands where its tag would, on its own line, so nothing moves when it comes; it comes after a quiet moment the first time, since it rests on reading the graph's earlier lines, which a look at a page never starts; an opened node shows at once and its proposals follow.

It began as the two-way section of the old plugin, DB Refinements, and has since been reshaped here. Its code still uses the old `rf-` names beside Look's.

## What it writes

A value changed or cleared in a row, and a tag added to or taken off a node, each with its Undo. Several words or numbers in one property are changed one at a time: each is pressed alone and the box starts from it as written, a link in it whole and a line break kept; empty and Enter takes that one off; the property's name adds another. A bullet added to a node, and a page made from the **+** line, each with its Undo; the line empties on Enter, so Enter twice adds one. A page named like one in the Recycle brings that page back; a place in the Recycle takes nothing, and says so. The pick bar's **Select all** picks what is shown: what the find line found, of the kind in force, in lists that are open. Its **Delete** deletes the picked nodes or pages: it asks first, names pages apart from bullets ("2 pages with all their bullets and 3 bullets"), and says it cannot be undone from there. A dug node shows Logseq's own Deadline, Scheduled, Status and Priority as they are, and a day written into a Date-and-time is kept as a moment, as Logseq keeps it. Undo after clearing words or a number puts them back as they read. The Recycle list under troubleshooting restores a page, or deletes it for good after asking, which no Undo takes back. Every write goes through `parts/model.js`, but for those two, which are the Recycle list's own (`parts/diagnostics.js`).

## The look is the shared names'

How the section's pieces look (a tag in mono, the underline a node's name takes under the pointer, the chevron only under the pointer, the tick boxes of a list appearing when the pointer is on it, no counts) comes from the shared class names on what Threads draws, which stand whichever modules run; they are listed in Look's README. With Look switched off the section reads the same, but for the sort's mark before a name, which Look works out.

## What is here

`settings.js`, beside `parts/`, says how Threads' settings read in the plugin's one settings window. The rest is in `parts/`:

| Part | What it is | Needed by two-way? |
|---|---|---|
| `shared.js` | the kit: outline lines, pop-ups, fields, Undo, icons | yes |
| `model.js` | the one place that reads and writes the graph | yes |
| `diagnostics.js` | troubleshooting commands (what the plugin finds on this page, warnings, the tour) | yes (foundation) |
| `two-way.js` | the two-way section | the feature |
| `alike.js`, `shadow-rules.js` | the "looks like" engine and the proposals' rules, Threads' own copy for the **+** line, opened nodes and pick lists | optional; the grey predictions in the **+** line and the order of pick lists |

Each optional part can be left out and the module still starts, runs and unloads (`node tools/parts-apart-test.js`). A part that fails to start leaves the rest running, and one notice says which.

## What was removed

The tag and property map (and the tag list's tree), the proposals while a bullet is written (the bullet's own piece, Option-Enter, a page's own properties), search and sidebar looks, page looks, the words by a page's title, a tag's place in the title, PDF quotations, the folded-node note, palette icons, the pickers, link selected text, block commands, and six parts the original kept but never loaded (pages, links, search, inline-props, rich-copy, todos). `git log` has one commit per removal.

**What changes in the section itself:** the row's right-click menu no longer shows **Open in the map**. Its other items stay (**Group by…**, **Reads back as …**, **Hide on the pages it points to**), so the two settings the original edits in the tag map (`twoWayNames`, `twoWayOneEnd`) can still be set from the row. The sidebar icon at the end of a line went on 31 October 2026 (Shift-click does the same), with the other changes of that day listed at the top.

## Settings

Two-way: `twoWayRows` (the rows), `twoWayDays` (each node's day in the margin; off, the column goes and the rows move left into its place, as they do by themselves when no row has a day to show, on a day's own page usually), `twoWayNames`, `twoWayOneEnd`, `twoWayMentions`, `twoWayMentionsHidden`, `twoWayHideLinkedRefs`, `twoWayHideTagLists`. Others that remain: **Foundation only** under Troubleshooting. **Open troubleshooting** stands there only while Threads runs.

## Checks

```
sh tools/check.sh          # syntax, boot, the two-way rows (144 checks), Undo, the model, leaning, the real graph
sh tools/check.sh --full   # also: every optional part left out in turn, odd names drawn, frames, pictures
```

The frames and pictures are compared with approved ones, so a visual change to the section shows up there. `tools/two-way-check.js` compares the rows with the Illness Test Graph through Logseq's command line.
