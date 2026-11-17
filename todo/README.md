# Todo

One module of Logseq Plugin (the root README says how the parts fit together; `grammar.html` in the workspace draws every rule).

Todo is Logseq's own tasks as one short list: what to do today, what is coming up, and what can wait. It reads the nodes that have a Status (Logseq's tasks, tagged Task), and the nodes tagged Task or a tag under Task (at any depth) whose Status is still empty: those are listed as Todo, with Todo's circle, and nothing is written to them until a status is picked. A bullet with no words is left out, with a Status or without, so the list never shows a blank row. It takes a task's day from its Deadline, else its Scheduled. It keeps nothing of its own: every task is a bullet in the graph, and the list is drawn from the graph each time it changes.

## Where it stands

The same list, drawn by the same code, in two places. A change in one shows in the other at once.

- **A page of its own**, in the middle of the window, titled Todo, at most 720 px wide and centred. Open it from the command palette (**Todo**) or with **g** then **d** outside a bullet, as Logseq's own g pairs. The key is set in Logseq's own keyboard shortcuts, where it is listed as Todo; the key sheet (hold Option) lists it among the keys of two letters.
- **Todo in the right sidebar**, a section there only once you open it, narrower and without the title: the checkmark in Logseq's toolbar opens it (the owner, 17 November 2026: "todo button should open up in sidebar"), and so does the command palette's **Todo in the sidebar**. Its × closes it; when it was the last thing you opened, the sidebar closes with it.

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

**A row**: the task's status circle, Logseq's own, the task's words (a web address in them a link with ↗ after it, opening the browser, as in Find and Threads), under them in grey the page the task is on (a journal's title for a journal day), and the day at the right in grey. The circle is the icon each status has in Logseq (an empty circle for Todo, a half one for Doing, a ticked one for Done by default), so a status given another icon in Logseq shows that icon here; it stands centred on the first line of the words. A link in the words reads as its page's name. Pointing at a row washes it faintly. Pressing the words opens the task, zoomed in to its bullet; with Shift, in the right sidebar.

**Setting the status.** Pressing the circle opens the status list under it, as Logseq's own circle does: the library's menu headed Set Status, every status the graph has in Logseq's order (Backlog, Todo, Doing, In Review, Done, Canceled by default), each with its own icon, a check mark on the one in force (none on a Task whose Status is empty). Up and Down walk it, Return takes one, Escape or a press elsewhere closes it. Done turns the circle to Done's and crosses the words out; after a moment the row rolls away (the plugin's one motion) and the task stands in Done. Todo or Doing changes the circle and the row stays. Backlog, In Review or Canceled takes the task out of the list: the row rolls away. The one Undo arrow stands faintly after the words while the row is on screen, and at the bottom right with its words once the row has gone; the Undo brings the row back.

**Done**, at the foot whatever the grouping, folded, with a faint count: the tasks done in the last seven days, newest first, crossed out. The fold arrow or the word opens it, rolling out. Its circle opens the same list, so a task there can be set back to Todo or to any status, with its Undo.

**Live.** A task added, ticked, dated or renamed anywhere in Logseq shows here a moment later, through Logseq's change hook; a new day moves Today and Coming up on by itself.

## Its keys

g then d outside a bullet opens the page (set in Logseq's keyboard shortcuts). In the add line: Return adds, Escape clears, then leaves. In the list: Tab reaches the grouping word, each circle and each task's words; Return or Space on a circle opens its status list, Return on the words opens the task, on the grouping word the menu.

## What it writes

Every write goes through the plugin's one write path (`PluginDoor.write`), and each offers the one Undo.

- **Adding** a task: a bullet with the words at the end of today's journal page (the page is made, by Logseq's own journal call, when the graph has none for today), the Task tag, Status Todo, and the Deadline when a day was read (that day's start, in this Mac's time, as Logseq's date picker writes it). Its Undo takes the bullet away while it is as it was added, and the day's page with it when the add made the page and nothing else is on it; a bullet written in since stays, with a notice.
- **A status picked**: Status set to it. Each Undo puts the status back while it is as the pick left it, and a Status that was empty before is emptied again, not set to Todo; changed since, it stays, with a notice.

Nothing else is written: no priority, no tag but Task, nothing outside the graph. Its one setting is the grouping (todoGroupBy); it is switched on and off under Parts in the settings window.
