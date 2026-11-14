# Todo

One module of Logseq Plugin (the root README says how the parts fit together; `grammar.html` in the workspace draws every rule).

Todo is Logseq's own tasks as one short list: what to do today, what is coming up, and what can wait. It reads the nodes that have a Status (Logseq's tasks, tagged Task) and takes a task's day from its Deadline, else its Scheduled. It keeps nothing of its own: every task is a bullet in the graph, and the list is drawn from the graph each time it changes.

## Where it stands

The same list, drawn by the same code, in two places. A change in one shows in the other at once.

- **A page of its own**, in the middle of the window, titled Todo, at most 720 px wide and centred. Open it from the command palette (**Todo**), from Logseq's ··· menu at the top right (Todo, with Find and Ontology), or with **g** then **d** outside a bullet, as Logseq's own g pairs. The key is set in Logseq's own keyboard shortcuts, where it is listed as Todo; the key sheet (hold Option) lists it among the keys of two letters.
- **The Todo tab of the right sidebar**, after Links, narrower and without the title. Picked, it opens if it is not open yet; the command palette's **Todo in the sidebar** opens it too.

## What it draws

**The add line** at the top: a + and "Add a todo" on a hairline. Type the task and press Return. A day in the words ("today", "tomorrow", "friday", "by friday", "next friday", "next week", "nov 20", "20 november") is read before you press Return and said faintly at the right of the line ("Friday, Nov 20"); it becomes the task's Deadline and is taken out of the words. A short weekday ("fri") counts only after "on", "by", "due" or "next", so "the sun" stays words. Escape clears what was typed, then leaves the line.

**The groups**, each under a small grey heading. How the list is grouped is chosen at the top right of the list, on the first heading's line: a small grey word with a chevron, "By day", which opens the library's menu (Group by: Day, Page, Tag, Priority, Status, a check mark on the one in force). Up and Down walk the menu, Return takes a line, Escape or a press elsewhere closes it. The choice is one for the page and the sidebar tab alike, kept in the plugin's settings (and in the settings window, under A page, "Group the Todo list by").

- **By day** (the first choice): **Today**, due today or late, the late ones first; a late task says its day in a muted red at the right ("Yesterday", "Nov 10"), one due today says nothing there, the heading says it. **Coming up**, a day after today, soonest first, the day at the right ("Tomorrow", "Mon" within a week, else "Nov 23"). **Any time**, no day, oldest first. Each has the library's nothing-here line when empty ("Nothing to do today.", "Nothing coming up.", "Nothing without a day.").
- **By page**: a group for each page with tasks on it, A to Z, and the journal days together under **Journals** after them. A page's group does not repeat the page under each row; in Journals each row says its day.
- **By tag**: a group for each of the tasks' tags besides Task, A to Z, the heading in the tag's look; a task with two tags stands in both. **No tag** last.
- **By priority**: Urgent, High, Medium, Low, then **No priority**.
- **By status**: Doing, then Todo.

Outside By day, a group with no task is left out, and the day stands at every row's right ("Today" too, since no heading says it); within every group the tasks are in day order: late first, then by day, those without a day last. With no open task at all, one line says "Nothing to do."

Only Todo and Doing are listed; Backlog, In Review and Canceled are left out. Nothing is coloured but a late day; there are no filters or sort menus.

**A row**: the library's tick box, the task's words, under them in grey the page the task is on (a journal's title for a journal day), and the day at the right in grey. A task that is Doing has a small filled grey square in its box. A link in the words reads as its page's name. Pointing at a row washes it faintly. Pressing the words opens the task, zoomed in to its bullet; with Shift, in the right sidebar.

**Ticking.** The box ticks and the words are crossed out; after a moment the row rolls away (the plugin's one motion) and the task stands in Done. Pressed again in that moment, the tick is taken back. The one Undo arrow stands faintly after the words while the row is on screen, and at the bottom right with its words once the row has gone.

**Done**, at the foot whatever the grouping, folded, with a faint count: the tasks done in the last seven days, newest first, crossed out. The fold arrow or the word opens it, rolling out. Unticking a task there sets it back to Todo, with its Undo.

**Live.** A task added, ticked, dated or renamed anywhere in Logseq shows here a moment later, through Logseq's change hook; a new day moves Today and Coming up on by itself.

## Its keys

g then d outside a bullet opens the page (set in Logseq's keyboard shortcuts). In the add line: Return adds, Escape clears, then leaves. In the list: Tab reaches the grouping word, each box and each task's words; Space ticks, Return opens (on the grouping word, the menu).

## What it writes

Every write goes through the plugin's one write path (`PluginDoor.write`), and each offers the one Undo.

- **Adding** a task: a bullet with the words at the end of today's journal page (the page is made, by Logseq's own journal call, when the graph has none for today), the Task tag, Status Todo, and the Deadline when a day was read (that day's start, in this Mac's time, as Logseq's date picker writes it). Its Undo takes the bullet away while it is as it was added, and the day's page with it when the add made the page and nothing else is on it; a bullet written in since stays, with a notice.
- **Ticking**: Status set to Done. **Unticking** in Done: Status set to Todo. Each Undo puts the status back while it is as the tick left it; changed since, it stays, with a notice.

Nothing else is written: no priority, no tag but Task, nothing outside the graph. Its one setting is the grouping (todoGroupBy); it is switched on and off under Parts in the settings window.
