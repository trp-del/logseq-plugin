/* Structure's screens, drawn in three places. The page of the whole (mode 'page'): each top-level tag an area, its tags a small
   outline, the relationships as lines between them, the tray on top. A tag's own page in Logseq (mode 'tag'): five short lines above
   Logseq's table saying what surrounds the tag, then what Structure suggests.
   Every property, a property's card, a tag's nodes and the log open in the place of the areas. Nothing a single letter does: letters
   typed on the outline find a tag; what a thing can take is in its right-click menu. A fix first says what it would do, with the nodes
   it touches, and is staged only on a second yes. A change waiting is pencilled in where it will happen. It is drawn into Logseq's own
   document, so the shared names (lk-row, lk-fold, lk-bul, lk-list, lk-tick, lk-field, lk-pop, lk-none, lk-node, lk-undo) sit on what they name and carry no look here. */
(function () {
const S = window.Structure;
const Mo = S.model, R = S.rules;
const { LOOSE } = Mo;
const { esc } = window.PluginDoor;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Logseq's fold chevron, as it draws it: a small right-pointing angle that turns down when open.
// The icon of what a property holds is the door's, as for every module.
const Door = window.PluginDoor;
const KIND_OF = { rel: 'node', num: 'number', date: 'date', choice: 'choice', text: 'text' };
const pi = p => `<i class="st-pi" aria-hidden="true">${Door.kindIconHtml(KIND_OF[Mo.propKind(p)])}</i>`;
// A day in words by the door's one rule (plugin.js, Door.dates), with no year: from a time, and from a journal day, 20261023.
const day = ms => ms ? Door.dates.words(Door.dates.number(new Date(ms)), { year: false }) : '';
const dayWords = d => d ? Door.dates.words(d, { year: false }) : '';

// The icon of a press: by what it does, and for a fix by its first word.
const ACT_ICON = { page: 'go', ppage: 'go', rename: 'rename', prename: 'rename', move: 'move', pmove: 'move', new: 'child', addprop: 'plus', addpropall: 'plus', merge: 'merge', remove: 'bin', pullup: 'up', split: 'split', pdrop: 'minus' };
const fixIcon = word => [[/^(remove|delete)/i, 'bin'], [/^drop/i, 'minus'], [/^(pull|lift)/i, 'up'], [/^(move|place|put)/i, 'move'], [/^merge/i, 'merge'], [/^rename/i, 'rename'], [/^(add|new)/i, 'plus']].find(([re]) => re.test(word))?.[1] || 'tick';
const CSS = `
.st { color: var(--lk-text, #222); font-size: 14px; line-height: 1.5; outline: none; position: relative; }
.st * { box-sizing: border-box; }
.st-page { display: flex; flex-direction: column; min-height: 360px; }
.st-page:not(.st-fill) .st-right { overflow: visible; }
/* With the page scrolling, the tray stays at the top of Logseq's page while it scrolls, so Apply is always in reach. */
.st-page:not(.st-fill) .st-tray:not(:empty) { position: sticky; top: 0; z-index: 3; background: var(--lk-paper, #fff); }
.st-top { display: flex; align-items: center; gap: 18px; padding: 0 22px 8px 6px; min-height: 37px; }
.st-acts { display: flex; align-items: center; gap: 8px; padding: 0 22px 10px 6px; min-height: 38px; }
.st-acts .lk-said { font-weight: 600; margin-right: 8px; } .st-acts .say { margin-right: 8px; }
.st-acts .waits { opacity: .45; pointer-events: none; }
.st-top .st-views, .st-top .st-pick { margin: 0; flex: none; } .st-top .st-pick { gap: 8px; } .st-top .lk-said { margin-right: 8px; } .st-top .st-find { margin: 0; flex: 0 1 200px; min-width: 80px; }
.st-top .st-new { margin-left: auto; white-space: nowrap; flex: none; }
/* The areas: columns sharing the page's width, onto a second row when they cannot fit, never past the edge; a band above each row for
   the lines that cross, gaps wide enough for the lines between neighbours. */
.st-regions { position: relative; display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); align-items: start; gap: 40px 40px; padding: 30px 30px 12px 6px; min-width: 0; }
/* Every area the same width (12 November 2026): as flex items, an area alone on the last row grew wider than the others and its counts
   stood far from its names, and three areas squeezed into 202 px each broke "Pharmacological" inside the word. 232 px holds a 15-letter
   name two steps in. */
.st-area { min-width: 0; position: relative; z-index: 1; }
.st-regions .st-lines { position: absolute; left: 0; top: 0; pointer-events: none; color: var(--lk-text, #222); }
.st-regions .st-row { grid-template-columns: 14px 14px 12px minmax(0, 1fr) 40px 8px; }
.st-regions .st-row.kind .nm { font-weight: 600; }
.st-regions .st-row .nm { word-break: normal; overflow-wrap: break-word; }   /* whole words first; a word breaks only when it alone is wider than the line (Logseq's page-wide word-break: break-word broke it anywhere) */
.st-regions .st-row.cur { font-weight: 600; } .st-regions .st-row.cur::before { display: none; }
/* The tag you are on, under the areas: its name opens its page; its relationships; what Structure suggests. */
.st-focus { padding: 16px 6px 24px; border-top: 1px solid var(--lk-hair); margin-top: 6px; max-width: 760px; }
.st-focus .f-h { font-weight: 600; margin-bottom: 8px; }
.st-rel { display: grid; grid-template-columns: auto auto auto; gap: 3px 14px; justify-content: start; align-items: baseline; font-size: 14px; }
.st-rel .self { font-weight: 700; color: inherit; } .st-rel .gap { grid-column: 1 / -1; height: 6px; } .st-rel .all { grid-column: 1 / -1; }
.st-rel .num, .st-lines-t .num { font-variant-numeric: tabular-nums; }
.st-rel:not(:has(> .lk-tag)) { grid-template-columns: auto auto; } .st-rel:not(:has(> .lk-tag)) > span:empty { display: none; }   /* only roads out: no column for the tag itself */
/* A tag's own page: the lines above Logseq's table. */
.st-tagholder { min-width: 0; }
.page-inner:has(> .st-tagholder) .lk-path { display: none; }   /* the Parent line says it */
/* The one line stands in the band above the title, which the page leaves empty, so the title stays where Logseq puts it: the
   holder is pulled up by the band and gives the same back below. Only what opens under the line (a name being typed, an ask)
   moves the title down, and back. */
/* The page's grid keeps its gap after any holder, so the line stands out of the flow, in the band; once the tray or an ask stands
   with it, it joins the flow and the title moves down for as long as they stand. */
.page-inner:has(> .st-holder-line) { position: relative; }
.st-holder-line { position: absolute; top: -30px; left: 0; right: 0; }
.st-holder-line:has(.st-tray:not(:empty)), .st-holder-line:has(.st-line1 ~ :not(.st-prompt)), .st-holder-line:has([data-edit]) { position: static; margin-top: -30px; }
.st-lines-t.st-line1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 14px; min-height: 24px; }
.st-line1 dt { font-weight: 600; } .st-lines-t.st-line1 dd { margin: 0 18px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
.st-tag { font-size: 14px; }
.st-page .st-tray { padding-left: 6px; }
.st-tag .st-tray { padding: 0 0 10px; margin-bottom: 12px; }
.st-lines-t { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 8px 14px; margin: 0; align-items: baseline; }   /* a label and its value's first line on one baseline: stretched, a value holding a press stood 3 to 7 px lower than its label (measured 12 November 2026) */
.st-lines-t dt { font-weight: 600; } .st-lines-t dd { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; min-width: 0; }
.st-lines-t .chev { margin-left: 2px; padding: 0 2px; }   /* the library's chevron (lk-change), centred on the name it changes */
.st-tag .sug { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; padding-top: 12px; }
.st-lines-t dd.col { display: grid; gap: 3px; justify-items: start; }
.st-lines-t .ont { display: grid; grid-template-columns: 170px 70px auto; gap: 0 14px; align-items: baseline; }
.st-lines-t .ont.kid { padding-left: 16px; } .st-lines-t .ont.kid .lk-tag { margin-right: -16px; }
.st-lines-t .ont .num { font-variant-numeric: tabular-nums; text-align: right; }
.st-lines-t .ont .acts-r { display: flex; gap: 2px; }
.st-lines-t .ont { padding-block: 2px; }
.st-lines-t dd.kids { gap: 0; } .st-lines-t dd.kids .ont { padding-block: 0; }   /* child tags: plain lines at the lines' own pitch, the first on its name's baseline */
.st-tag .sug { align-items: center; } .st-rel .lk-more { margin-top: 2px; }
/* Words stay whole in Ontology's lines and tables: Logseq sets word-break: break-word page-wide, which let a line break inside "and",
   and before a comma. A word breaks only when it alone is wider than its line; "and 12 more" goes to the next line whole, from the
   line's own edge (13 November 2026: with a margin for its space it stood 5 px in, and a comma could start a line). */
.st-tbl td, .st-lines-t dd, .st-rel, .st-ln { word-break: normal; overflow-wrap: break-word; }
.st .lk-more, .st .all, .st .to.and { white-space: nowrap; }
.st .to.and { margin: 0 !important; }
/* A press with an icon stands on its words' baseline, not its icon's: as a centred flex box its baseline was the icon's foot, and
   "Merge into…" stood 2.3 px above "nodes" beside it (measured by the words' own boxes, 13 November 2026). */
.st-lines-t dd .lk-btn { align-items: baseline; } .st-lines-t dd .lk-btn::before { align-self: center; }
.st-lines-t .rg { display: inline-flex; gap: 4px; align-items: baseline; }
.st-tag .st-in { max-width: 240px; }
/* The inspector: two parts, each under its head, a hairline and space between them. The heads in the heading weight; the names
   of the lines in the quiet grey at the body weight, as Logseq writes a property's name, so what you read is the values. */
.st-holder-insp { display: grid; gap: 24px; padding: 4px 2px 12px; }
.st-holder-insp .st-lines-t { grid-template-columns: 112px minmax(0, 1fr); gap: 10px 14px; }
.st-holder-insp { container-type: inline-size; }
/* A narrow sidebar: each label stands over its value, which then has the pane's whole width (12 November 2026: at 270 px the count lay
   over the tag's name, Relationships was squeezed to three letters a line and the pane scrolled sideways). */
@container (max-width: 360px) {
  .st-holder-insp .st-lines-t { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .st-holder-insp .st-lines-t dt:not(:first-child) { margin-top: 10px; }
  .st-holder-insp .st-rel { grid-template-columns: minmax(0, auto) minmax(0, auto) auto; }
}
.st-holder-insp .st-lines-t dt { font-weight: 400; color: var(--lk-quiet); display: flex; gap: 6px; align-items: baseline; min-width: 0; }
.st-insp-h { display: none; }
/* The sidebar's views as words only: the cube with a + listed the plugin's panels in a menu; the inspector is a word in the row now
   (mount.js), and the plugin's panel heads keep their fold and their ×, without Logseq's ··· menu, as Links and Endnotes have them. */
#right-sidebar .cp__right-sidebar-settings > div:has(> button .ls-icon-cube-plus) { display: none !important; }
#right-sidebar .sidebar-item:has(h3[id^="_sidebar.structure"]) [data-testid="sidebar-item-more"] { display: none !important; }
.st-holder-insp .st-insp-h { display: flex; gap: 8px; align-items: baseline; font-weight: 600; font-size: 16px; line-height: 1.4; margin: 0 0 12px; overflow-wrap: anywhere; }
.st-holder-insp .st-insp-h .lk-tag { font-weight: 600; }
.st-holder-insp .st-insp-h .st-pi { width: 13px; height: 13px; color: var(--lk-quiet); }
.st-holder-insp dt .st-pi, .st-holder-insp dt .ti { flex: none; width: 13px; font-size: 13px; color: var(--lk-quiet); position: relative; top: 1px; }
.st-insp-top:not(:has(.st-insp-h, .st-lines-t)) { display: none; }
/* No row pressed: the lines at the top, the faint waiting line under them. A row pressed (data-row): the row first, the lines
   folded under the foot line "About Consultation" until it is opened (data-about); the tag's name is said by that line. */
.st-holder-insp:not([data-row]) .st-insp-top { order: -1; }
/* A row pressed: it stands in the Item tab, Logseq's own view of its node (inspector.js), so the line that says what the panel waits for goes. */
.st-holder-insp[data-row] .st-insp-node { display: none; }
/* The quiet line on top of the Item tab: where the row stands in the table. */
/* A page's row: the page's name is in its item's head, so the head stays for it, without its fold arrow, its menu and its ×
   (a bullet's item starts with the bullet's own words, and its head, the page it is on, stays away as for every tab). */
#right-sidebar[data-lk-tabs] .sidebar-item-list > .sidebar-item.item-type-page[data-st-item] .sidebar-item-header { display: flex !important; }
#right-sidebar .sidebar-item.item-type-page[data-st-item] .sidebar-item-header :is(.item-actions, .rotating-arrow) { display: none !important; }
/* Where the row stands, "Consultation · 12 of 53": words the list carries (inspector.js), drawn above the row's view. */
#right-sidebar[data-lk-tab="item"] .sidebar-item-list[data-st-where]::before { content: attr(data-st-where); display: block; color: var(--lk-quiet); font-size: var(--lk-small); font-variant-numeric: tabular-nums; padding: 8px 0 0 16px; margin-bottom: -8px; }
/* A tag the property is on: its name and count on one line, what you can do with it under them, so the narrow panel never
   squeezes the count into a column of single letters. */
.st-holder-insp .st-lines-t .ont { grid-template-columns: minmax(0, 1fr) auto; }
.st-holder-insp .st-lines-t .ont .acts-r { grid-column: 1 / -1; flex-wrap: wrap; gap: 2px 8px; margin-left: -6px; }
.st-holder-insp .st-lines-t .ont .acts-r:empty { display: none; }
.st-holder-insp:not([data-row]):has(.st-insp-top :is(.st-insp-h, .st-lines-t)) .st-insp-node { border-top: 1px solid var(--lk-hair); padding-top: 16px; }
.st-insp-node:empty { display: none; }
.st-insp-none { margin: 0; } .st-insp-none.lk-none { padding: 0; }   /* the library's nothing-here line, at the top of the tab, as Links' and Endnotes' (the audit's 32) */
/* Two marks in a table beside the Item tab (the owner, 12 November 2026): the row Item shows keeps a blue outline for as long as it is
   the one shown; the row under the pointer keeps Logseq's own wash.
   The outline is a frame laid over the row, since the row's cells paint over an outline of its own. */
.ls-table-row[data-st-picked] { position: relative; }
.ls-table-row[data-st-picked]::after { content: ""; position: absolute; inset: 0; border: 1.5px solid var(--lk-picked); border-radius: 3px; pointer-events: none; z-index: 20; }
.st-lines-t .to { margin: 0 .35em; }
.st-sb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; font-size: 14px; margin: 10px 0 2px; }
.st-sb .h { font-weight: 600; margin-bottom: 4px; } .st-sb .o { padding-left: calc(var(--d, 0) * 16px); }
.st-tray .links { font-variant-numeric: tabular-nums; }
.st-log .ln { display: grid; grid-template-columns: 120px minmax(0, 1fr) 110px; gap: 0 12px; padding: 4px 0; border-bottom: 1px solid var(--lk-hair); font-size: 14px; }
.st-left { grid-row: 1 / -1; border-right: 1px solid var(--lk-hair); padding: 12px 10px 12px 14px; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.st-right { flex: 1; padding: 0 22px 56px 6px; min-width: 0; min-height: 0; overflow: auto; container-type: inline-size; }
/* The tray stands on top of the card, where a change is made, above what scrolls, so Apply is always in reach. The card's foot keeps clear of Logseq's help button, which stands over that corner. */
.st-tray { border-bottom: 1px solid var(--lk-hair); padding: 10px 22px 10px 26px; font-size: 14px; min-width: 0; }
.st-tray:empty { display: none; }
.st-tray .st-wait { overflow: visible; } .st-tray .st-wait .links + .lk-low, .st-tray .st-wait .links + .lk-accent { margin-left: auto !important; } .st-tray .st-wait { gap: 6px 8px; } 
.st-tray .tl { display: grid; gap: 1px; min-width: 0; margin-bottom: 8px; }
/* A line of the tray: the sentence, then in a column of its own how many nodes it affects, so the two are never read as one. */
.st-tray .tl > span { display: grid; grid-template-columns: minmax(0, 1fr) max-content 16px; gap: 0 12px; align-items: baseline; color: var(--lk-text, #222); font-size: 14px; }
.st-tray .tl span i { color: var(--lk-quiet); font-style: normal; font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-tray .tl .lk-x { justify-self: end; padding: 0 2px; }
.st-tray .st-wait .lk-accent { padding: 2px 6px; margin: 0 -6px; }
.st-tray .ky { font-weight: 400; font-size: var(--lk-small); margin-left: 6px; }
/* The yes to what Undo cannot put back whole (the library's), under the lines it answers for. */
/* A count that opens its nodes: what opens has an underline. */
.st-card .sum .lk-lone { padding: 0; margin: 0; text-decoration: underline; text-decoration-color: var(--st-line, var(--lk-line)); text-underline-offset: 3px; }
.st-card .sum .lk-lone:hover { background: none; text-decoration-color: currentColor; }
/* A question, wherever it opens (the library's): what it asks, what follows from it, the answers; joined by a line from the margin. */
.st-q { margin: 6px 0 16px; padding-left: 12px; border-left: 2px solid var(--lk-hair); max-width: 640px; }
.st-tray .st-q { margin: 8px 0 2px; max-width: none; }
.st-q .h { font-weight: 600; } .st-q .l { color: var(--lk-quiet); font-size: 14px; }
.st-q .lk-answers { margin-top: 6px; } .st-q .lk-hint { white-space: normal; }
/* st-done, not done: Logseq strikes through its own .done (a finished task). */
.st-tray .st-saying { display: flex; gap: 16px; justify-content: flex-end; }
.st-tray .st-done, .st-tray .note { color: var(--lk-quiet); white-space: nowrap; font-size: 14px; }   /* the Undo arrow waits at the right, at the top of the card (the grammar) */
.st-tray .st-wait + .tl + .st-saying, .st-tray .st-wait + .tl + .more + .st-saying { margin-top: 4px; }
.st-tray .st-done .lk-undo { margin-left: 6px; font-size: 16px; }   /* the door's one Undo sits at the end of this line */
.st-tray .busy { color: var(--lk-quiet); }
/* The find line and a name typed in place are the library's field (lk-field); here their room. */
.st-find { color: var(--lk-quiet); font-size: 14px; min-height: 24px; padding: 0 2px; margin: 0 0 10px; }
.st-find .n { font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; }
.st-in { width: 100%; }
.st-tree { flex: 1; min-height: 0; overflow: auto; }
/* A row is built as Logseq builds a block (the grammar): the tick in the margin, the fold arrow shown under the pointer, the
   bullet ringed while folded, then the name; at the right edge only what tells the rows apart (here the count). */
/* A long name wraps like text, so the row's pieces stand at its first line. Each level is one step in, as deep as the tree goes. */
.st-row { display: grid; grid-template-columns: 14px 14px 16px minmax(0, 1fr) 46px 12px; align-items: start; min-height: 26px; padding-left: calc(var(--d, 0) * 12px); border-radius: 3px; position: relative; }
/* The bullet is the library's (lk-bul); here its place on the row. A row's wash under the pointer is the library's (lk-row). */
.st-bul { margin-top: 5px; justify-self: center; }
.st-row.kind .st-bul::before { opacity: .8; }
.st-row.cur { background: var(--lk-wash); }
.st-row.cur::before { content: ""; position: absolute; left: -8px; top: 5px; bottom: 5px; width: 2px; background: var(--lk-line); border-radius: 1px; }
/* The tick box is the library's (lk-tick); when it shows is Look's word (on the list under the pointer, or while picking). */
/* Every box at the middle of its row's first line, in one straight column at the left edge whatever the row's depth, so a
   top-level row, which can be ticked like any (the top is open), keeps its fold arrow beside its box. */
.st .st-row > input.lk-tick[type=checkbox] { margin-top: 6.5px !important; margin-left: calc(0px - var(--d, 0) * 12px - var(--st-in, 0px)) !important; }
/* Under a top-level tag a name starts a step right of the top-level name. */
.st-tree .st-row:not(.kind):not(.loose) { --st-in: 9px; padding-left: calc(var(--d, 0) * 12px + var(--st-in)); }
/* The fold arrow is the library's (lk-fold); here its place in the row's 14 px column. */
.st-row .lk-fold { width: 14px; margin-top: 3px; }
.st-row .nm { min-width: 0; padding: 3px 0; line-height: 20px; overflow-wrap: anywhere; display: flex; gap: 7px; align-items: baseline; }
.st-row.kind .nm { font-weight: 500; }
.st-row.dim .nm, .st-row.dim .ct, .st-row.loose .nm { color: var(--lk-off); }
.st-row .ct { text-align: right; line-height: 26px; color: var(--lk-quiet); font-size: var(--lk-small); font-variant-numeric: tabular-nums; }
.st-row .iss { width: 5px; height: 5px; margin-top: 10.5px; border-radius: 50%; background: currentColor; opacity: 0; justify-self: center; }
.st-row .iss.on { opacity: .35; } .st-row .iss.own { opacity: .7; }
/* Everything that presses shows it under the pointer, and nothing else does: a line or a row that opens a card, a number, the rest of a list. */
.st [data-row], .st [data-prop], .st [data-nodes], .st [data-node], .st [data-pick], .st [data-all], .st [data-more], .st [data-go], .st [data-open] { cursor: pointer; }
.st .lk-view.on { cursor: default; } .st-row.off[data-pick] { cursor: default; }
.st-row.dragging { opacity: .4; }
.st-row.over { background: var(--lk-wash); box-shadow: inset 0 2px 0 var(--lk-line); }
.st-row.over[data-word]:not([data-word=""])::after { content: attr(data-word); position: absolute; right: 64px; top: 4px; font-size: var(--lk-small); color: var(--lk-quiet); pointer-events: none; }
/* Two panes: each finds and scrolls on its own; "to the top" stands at each foot only while a tag is held. */
.st-panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 8px 0 12px; }
.st-pane { min-width: 0; padding: 4px 14px 0 6px; display: flex; flex-direction: column; }
.st-pane + .st-pane { border-left: 1px solid var(--lk-hair); padding-left: 14px; }
.st-pane .st-tree { max-height: calc(100vh - 300px); min-height: 160px; overflow-y: auto; }
.st-topdrop { display: none; } .st[data-dragging] .st-topdrop { display: grid; } .st-topdrop .nm { color: var(--lk-quiet); }
.st-top .st-split { flex: none; }

/* Pencilled in (Look's lk-pencil on the name): what a change waiting in the tray touches. */
/* The pick bar, as the grammar draws it: above the list, how many and what can be done as quiet words, Esc clears. */
.st-pick { margin: 0 0 8px; min-height: 27px; flex-wrap: nowrap; }
.st-nodes .st-pick { margin: 0 0 6px; min-height: 0; }
/* The three views as words above the tree, the one in force in the text colour (the grammar's narrowing words). */
.st-views { margin: 0 0 8px; min-height: 27px; }
/* The title row: the name, and at its right end the thing's place in the tree, nearest first, as Look draws it on a page. */
.st-ttl { display: flex; align-items: baseline; gap: 14px; margin: 0 0 2px; }
/* Too long for the row, it gives way from the middle, then the nearest tag; the top-level tag stays whole. */
.st-ttl .st-place { display: flex; align-items: baseline; margin-left: auto; font-size: var(--lk-small); white-space: nowrap; min-width: 0; flex: 0 1 auto; }
.st-ttl .st-place > * { flex: 0 1000 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; }
.st-ttl .st-place > :first-child { flex-shrink: 1; } .st-ttl .st-place > :last-child { flex-shrink: 0; }
.st-ttl .st-place .sep { flex: none; min-width: 0; color: var(--lk-quiet); margin: 0 .4em; }
.st-card h2 { font-size: 20px; font-weight: 600; margin: 0; display: flex; gap: 10px; align-items: center; line-height: 1.3; min-width: 0; }
.st-card h2 .st-pi { width: 13px; height: 13px; }
.st-card .sum { font-size: var(--lk-small); color: var(--lk-quiet); margin: 0 0 6px; display: flex; gap: 14px; flex-wrap: wrap; align-items: baseline; }
.st-card .acts { margin: 8px 0 20px; }
.st .act { color: var(--lk-quiet); cursor: pointer; white-space: nowrap; } .st .act:hover { color: inherit; }
/* A group's head is bold words on a row; groups are told apart by a gap of one line, not a hairline (the grammar). */
.st-card h3 { font-size: 14px; font-weight: 600; color: inherit; margin: 22px 0 2px; min-height: 25px; display: flex; align-items: center; }
.st-card h3:first-of-type { margin-top: 0; }
.st-ln { display: grid; grid-template-columns: 16px minmax(0, 1fr) 84px; gap: 0 8px; align-items: baseline; min-height: 25px; border-radius: 3px; padding: 0 4px 0 2px; margin-left: -2px; }
.st-ln:hover { background: var(--lk-wash); }
.st-pi { display: inline-flex; width: 11px; height: 11px; color: var(--lk-quiet); align-self: center; } .st-ln > .st-pi { align-self: start; margin-top: 5px; } .st-pi .lk-icon.lk-web, .st-pi .lk-icon.lk-web svg { width: 100%; height: 100%; } .st-pi .ti { font-size: 12px; line-height: 1; margin: -.5px; }
.st-ln .w { display: flex; gap: 8px; align-items: baseline; min-width: 0; flex-wrap: wrap; }
.st-ln .w .k { color: inherit; }
.st-ln .w .to { color: var(--lk-quiet); font-size: var(--lk-small); }
.st .lk { text-decoration: underline; text-decoration-color: var(--lk-line); text-underline-offset: 3px; cursor: pointer; }
.st .lk:hover { text-decoration-color: currentColor; }
.st .lk-tag { white-space: nowrap; cursor: pointer; }
.st-tbl .lk-tag { opacity: 1; }
.st .act .lk-tag { color: var(--lk-text, currentColor) !important; }   /* a tag in a value you can change reads like any tag, the text colour (the owner, 8 November 2026) */   /* in the table a tag is a column's whole content, not a mark after words: full strength (the owner, 5 November 2026) */
.st-ln .ct { text-align: right; font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-ln.low .ct { color: var(--lk-quiet); }
.st-ln.rng .x { margin-left: 2px; }
.st-ln.add .ct { text-align: left; white-space: normal; }
/* An issue's row, each part keyed by its role (the owner, 31 October 2026): the thing to settle in the text colour with the underline
   that opens its card, the tying words and the sentence in the quiet grey at the row's size, the tags as tags, the count as a number,
   the fix last in the text colour, taking the room it needs (the sentence wraps before it, never the fix word). */
.st-ln.iss { grid-template-columns: 16px minmax(0, 1fr) max-content; }
.st-ln.iss .w { color: var(--lk-quiet); display: block; }   /* the parts flow as text, so a long sentence wraps as text */
.st-ln.iss .w > span { margin: 0 2px; } .st-ln.iss .w > span:first-child { margin-left: 0; }
.st-ln.iss .w .sj { color: var(--lk-text, #222); font-weight: 500; margin-right: 4px; }
.st-ln.iss .w .to { color: var(--lk-quiet); font-size: 14px; } .st-ln.iss .w .pn { margin-left: -2px; }
.st-ln.iss .w .nm { color: var(--lk-quiet); font-variant-numeric: tabular-nums; font-size: 14px; margin-left: 6px; }
/* A line with its own issue: the fix word at its right end, after the faint count. */
.st-ln.fx { grid-template-columns: 16px minmax(0, 1fr) 84px max-content; }
/* A merge before it is staged, as the grammar shows a consequence: the two tags side by side, their properties lined up. */
.st-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; font-size: 14px; margin: 8px 0 6px; }
.st-two .h { font-weight: 600; padding-bottom: 4px; display: flex; gap: 8px; align-items: baseline; color: var(--lk-text, #222); } .st-two .h .ct { font-weight: 400; color: var(--lk-quiet); font-size: var(--lk-small); }
.st-two .pr { display: flex; gap: 8px; min-height: 24px; align-items: center; color: var(--lk-quiet); }   /* the name at the left of its column, "on both" at the right */
.st-two .pr .n { display: inline-flex; gap: 6px; align-items: center; min-width: 0; }
.st-two .pr .ct { font-size: var(--lk-small); color: var(--lk-quiet); margin-left: auto; white-space: nowrap; }
.st-two .pr.moves, .st-two .pr.shared { color: var(--lk-text, #222); } .st-two .pr.gone { text-decoration: line-through; color: var(--lk-quiet); } .st-two .pr.new { font-style: italic; }
.st .q { color: var(--lk-quiet); } .st .f { color: var(--lk-quiet); }
/* Baked in one pass (the owner, 5 November 2026: "the table feels half-baked"): the tick and the fold arrow stand in a margin at the
   table's left, as on a Regions row, so the head Property stands over the names; the chevron sits tight after the value it keys;
   the columns are sized to what they hold; the sorted head carries Logseq's arrow. */
.st-tbl { font-size: 14px; margin-left: 36px; }
.st-tbl .hd, .st-tbl .tr { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(0, 1.5fr) minmax(0, 1.5fr) 100px; gap: 0; align-items: center; min-height: 32px; border-bottom: 1px solid var(--lk-hair); }
.st-tbl .hd > *, .st-tbl .tr > * { padding: 4px 12px; min-width: 0; border-left: 1px solid var(--lk-hair); } .st-tbl .hd > :first-child, .st-tbl .tr > :first-child { border-left: 0; padding-left: 4px; }
.st-tbl .hd { font-weight: 600; } .st-tbl .hd .lk-head { cursor: pointer; } .st-tbl .hd .sortmark { color: inherit; font-weight: 400; margin-left: 5px; }
.st-tbl .tr > span:first-child { position: relative; } .st-tbl .tr .lk-tick { position: absolute !important; left: -34px !important; top: 50%; transform: translateY(-50%); margin: 0 !important; } .st-tbl .tr.dim { opacity: .45; } .st-tbl .st-q { margin: 6px 0 14px 4px; }
.st-acts .st-in { flex: 0 0 280px; width: 280px; }
.st-q .st-two .h .lk-icon, .st-q .st-two .h .st-pi { margin-right: 2px; }
.st-lines-t dd .lk-i-merge { margin-left: auto; }
.st-tbl .tr > span:first-child { white-space: nowrap; } .st-tbl .tr .k.lk { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }   /* the name is cut, not the cell, so the tick and the arrow in the margin stay in view */
.st-tbl .tr .k.lk { cursor: pointer; }
.st-tbl .tr.cur { background: var(--lk-wash); }
.st-tbl .tr .lk-fold { position: absolute; left: -17px; top: 50%; transform: translateY(-50%); width: 14px; }
.st-popen { padding: 8px 12px 14px 20px; border-bottom: 1px solid var(--lk-hair); }
/* The keys at rest (the owner's pick 1 of structure-table-keys-mockup.html, 5 November 2026): a cell that changes here ends with a faint chevron. */
.st-tbl .tr .st-cell { display: flex; align-items: center; justify-content: flex-start; gap: 6px; } .st-tbl .tr .st-cell > span:first-child { min-width: 0; }
/* The chevron is the library's (lk-change), not a letter, centred on the cell's words (the owner, 12 November 2026: "those are not correct
   downward facing chevrons. they are supposed to be vertically centered"). */
.st-tbl .tr .st-chev { cursor: pointer; padding: 0 2px; flex: none; display: inline-flex; align-items: center; } .st-tbl .tr .st-chev::before { vertical-align: 0; }
.st-popen .st-lines-t { margin: 0; font-size: 14px; }
/* On a tree row the name is the door (the grammar's row): the words carry the faint line under the pointer, since a line on every row would multiply. */
.st-row .nm .st-name { cursor: pointer; text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 3px; transition: text-decoration-color ${window.PluginDoor.timing('edge')}; }
.st-row .nm .st-name:hover { text-decoration-color: var(--lk-line); }
.st-h { font-size: 14px; font-weight: 600; margin: 22px 0 4px; }
/* A narrow pane (the right sidebar open): the table keeps its four columns, the tag columns wrapping. */
@container (max-width: 640px) { .st-tbl .hd, .st-tbl .tr { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 76px; } .st-tbl .hd > *, .st-tbl .tr > * { padding-inline: 8px; } }
.st-tbl .tr .ct { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
/* The groups of Every property: a name that folds like a bullet, its count at the right; what it holds one step in. */
.st-tbl .tr > :first-child { padding-left: var(--pd, 4px); }   /* inside a group: one step past its name, as a child bullet */
.st-tbl .st-grp .lk-fold { width: 14px; }
.st-tbl .st-grp { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto 22px; gap: 6px; align-items: center; min-height: 32px; padding-left: calc(var(--d, 0) * 16px); border-bottom: 1px solid var(--lk-hair); }
.st-tbl .st-grp .gn { font-weight: 600; cursor: text; } .st-tbl .st-grp.none .gn { font-weight: 500; cursor: default; }
.st-tbl .st-grp .ct { font-variant-numeric: tabular-nums; padding-right: 12px; }
/* The group's ×: the library's lk-reveal, shown while its row is pointed at. */
.st-tbl .st-grp.over { background: var(--lk-wash); box-shadow: inset 0 2px 0 var(--lk-line); }
.st-tbl .dragging { opacity: .4; }
.st-gnew { padding: 8px 2px 0; } .st-gnew .act + .act { margin-left: 20px; }
.st-tbl .to, .st-lines-t .to { margin: 0 .35em; }
/* Between the tags of a list, a comma (the audit's 33; the owner, 10 November 2026, of Every property's table: "just put a comma,
   instead of blank space"), quiet, tight after the name; the inspector's Beside draws the same list. */
.to.sp { margin: 0 !important; color: var(--lk-quiet); font-family: inherit; }
/* A node's row: the day in the left margin (the margin is time), the tick, the bullet, the name. */
.st-nodes .st-ln { grid-template-columns: 46px 14px 16px minmax(0, 1fr); }
.st-nodes .st-ln .lk-day { white-space: nowrap; }
.st-nodes .st-ln.cur { background: var(--lk-wash); }
.st-nodes .st-ln > input.lk-tick[type=checkbox] { align-self: start; margin-top: 4px !important; } .st-nodes .st-ln > .st-bul { align-self: start; margin-top: 3.5px; }
.st-nodes .more, .st-tbl .more { padding: 4px 2px; }
.st-menu { position: absolute; min-width: 230px; width: max-content; max-width: 360px; font-size: 14px; z-index: 30; }   /* the library's pop-up and menu (lk-pop, lk-menu) */
/* The prompt is a picker at the thing pressed (the owner, 5 November 2026), with the menu's look, anchored in the scrolling box
   the press was in so it moves with its row and moves nothing else. One drawing everywhere: a find line reading the ask as its
   own name, the rows; a row that cannot take the thing stays at the off strength with the reason in its title; one row is lit,
   the one Enter takes, moved by the arrows and by the pointer (as Logseq's own picker moves it); "show all" is the opener. */
.st-prompt { position: absolute; z-index: 30; width: min(320px, calc(100% - 8px)); max-height: 60vh; overflow: auto; padding: 6px; font-size: 14px; }   /* the library's pop-up (lk-pop) */
.st-right, .st-tree { position: relative; }
.st-prompt .st-find { margin-bottom: 4px; padding: 0 4px; }
.st-prompt .st-row { grid-template-columns: minmax(0, 1fr) minmax(40px, max-content); column-gap: 8px; padding-left: calc(var(--d, 0) * 14px + 4px); padding-right: 4px; }
.st-prompt .st-row.off .nm, .st-prompt .st-row.off .ct { color: var(--lk-off); }
.st-prompt .st-row.loose:not(.off) .nm { color: inherit; }   /* The top reads as any row that can take it; faint only when it cannot */
.st-prompt .nm .st-pi { align-self: start; margin-top: 5px; }   /* a long name wraps under itself, the icon at its first line */
.st-prompt .st-row:hover { background: none; }
.st-prompt .st-row.lit, .st-prompt .st-row.lit:hover { background: var(--lk-wash); }
.st-prompt .more { display: block; padding: 3px 4px; border-radius: 3px; width: 100%; text-align: left; }
.st-prompt .more.lit { background: var(--lk-wash); }
.st-prompt .q { padding: 4px 2px; color: var(--lk-quiet); } .st-prompt .q .hint { color: var(--lk-quiet); }
.st-prompt .st-find .ti-search { font-size: 14px; color: var(--lk-quiet); flex: none; }
.st-prompt .st-find .ask { font-size: var(--lk-small); color: var(--lk-quiet); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; }
.st-prompt .nm .up { margin-left: .5em; font-size: var(--lk-small); color: var(--lk-quiet); }
/* A faint row's count gives way to its reason under the pointer, so why it cannot take it is read where its number stood. */
.st-prompt .ct .why { display: none; } .st-prompt .st-row.off:hover .ct .n { display: none; } .st-prompt .st-row.off:hover .ct .why { display: inline; }
.st-empty { max-width: 60ch; }   /* the library's nothing-here line (lk-none) */
@media (max-width: 760px) { .st-page { height: auto; } }`;

const ensureStyle = doc => { S.base.sheet('st-style', CSS, 'st-own', doc); };

/* make(holder, mode, app): draws the screen into holder; mode is 'page' (Regions or Every property, with the tray), 'line'
   (the line above a tag's title) or 'tag' (a tag's lines, in the Ontology tab). app holds the state every view shares
   (main.js): the tray with its model, the cursor, what is open and ticked, the trail. */
function make(holder, mode, app, opts = {}) {
  const doc = holder.ownerDocument;
  ensureStyle(doc);
  const st = app.st;
  // What a drawing shows that can come or go when something folds: a tree's rows, Every property's groups and properties.
  const KEYED = '.st-row[data-row], .st-grp[data-group], .tr[data-prop], .st-popen[data-popen]';
  const keyOfShown = e => `${e.closest('[data-pane]')?.dataset.pane || ''}|${e.dataset.row ?? ''}|${e.dataset.group ?? ''}|${e.dataset.prop ?? ''}`;
  const root = doc.createElement('div');
  const TAGISH = mode === 'tag' || mode === 'line';   // 'line': the one line above a tag's title; 'tag': all its lines, in the inspector
  root.className = `st ${TAGISH ? `st-tag${mode === 'line' ? ' st-line' : ''}` : 'st-page'}`;
  root.tabIndex = 0;
  holder.appendChild(root);
  const M = () => app.tray.model;
  const T = id => M().tags.get(id);
  const P = id => M().props.get(id);
  const name = id => id === LOOSE ? 'The top' : T(id)?.title ?? '';
  const ISS = () => app.issues();
  const own = id => R.issuesOn(ISS(), id).length, below = id => R.issuesUnder(M(), ISS(), id).length;
  const touched = () => app.touched();
  const waitTag = id => touched().tags.has(id) ? 'wait' : '', waitProp = id => touched().props.has(id) ? 'wait' : '';
  let wantFocus = false;   // a press in this view asked for the keyboard; nothing else takes it

  // ---------- the tree ----------
  // pane 2: the second of Two panes, with a find box and folds of its own (st.pane2); otherwise the map's own.
  function visibleRows(pane) {
    const m = M(), rows = [], P2 = pane === 2 ? st.pane2 : null, open = P2 ? P2.open : st.open, seen = P2 ? P2.seen : st.seen;
    const tops = Mo.tops(m);
    const q = (P2 ? P2.find : st.find).trim().toLowerCase();
    if (q) {
      const hit = new Set([...m.tags.values()].filter(t => t.title.toLowerCase().includes(q)).map(t => t.id));
      const show = new Set();
      for (const h of hit) { for (const a of Mo.pathOf(m, h)) show.add(a); }
      const walk = (n, d) => { if (!show.has(n)) return; rows.push({ n, d, dim: !hit.has(n), open: true, kids: Mo.kids(m, n).length }); for (const k of Mo.kids(m, n)) walk(k, d + 1); };
      tops.forEach(k => walk(k, 0));
      return rows;
    }
    const walk = (n, d) => { if (d < 2 && !seen.has(n)) { seen.add(n); open.add(n); }   // the first two levels start open, and fold like any row
      const kids = Mo.kids(m, n); const isOpen = open.has(n); rows.push({ n, d, open: isOpen, kids: kids.length }); if (isOpen) kids.forEach(k => walk(k, d + 1)); };
    tops.forEach(k => walk(k, 0));
    return rows;
  }
  function rowHtml(r) {
    const t = r.n === LOOSE ? null : T(r.n), isTop = r.d === 0;
    const o = own(r.n), b = below(r.n);
    const arrow = r.kids ? `<span class="lk-fold" data-fold="${esc(r.n)}" aria-expanded="${r.open}"></span>` : '<span></span>';
    const bullet = `<span class="st-bul lk-bul ${r.kids && !r.open ? 'folded' : ''}"></span>`;
    const editing = !inPane2 && st.edit && st.edit.what === 'rename' && st.edit.on === r.n;
    const nm = editing ? `<input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : esc(name(r.n));
    const canDrag = t && !editing;   // any tag, a top-level one too: the top is open
    let h = `<div class="st-row lk-row ${isTop ? 'kind' : ''} ${r.n === LOOSE ? 'loose' : ''} ${r.dim || (st.aim && !aimOk(r.n)) ? 'dim' : ''} ${st.cur === r.n ? 'cur' : ''} ${waitTag(r.n)}" style="--d:${r.d}" data-row="${esc(r.n)}" ${canDrag ? 'draggable="true"' : ''}>` +
      `<input type="checkbox" class="lk-tick" data-tick="${esc(r.n)}" ${st.ticks.has(r.n) ? 'checked' : ''} ${r.n === LOOSE ? 'disabled style="visibility:hidden"' : ''}>` +
      arrow + bullet +
      `<span class="nm"><span class="${waitTag(r.n) ? 'lk-pencil' : ''} ${t?.uuid && !editing ? 'st-name' : ''}" ${t?.uuid && !editing ? `data-tpage="${esc(r.n)}"` : ''}>${nm}</span></span><span class="ct">${Mo.count(M(), r.n) || ''}</span><span class="iss ${o ? 'own' : b ? 'on' : ''}"></span></div>`;
    if (!inPane2 && st.edit && st.edit.what === 'new' && st.edit.on === r.n && st.edit.owner === mode) h += `<div class="st-row lk-row" style="--d:${r.d + 1}"><span></span><span></span><span class="st-bul lk-bul"></span><span class="nm"><input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" placeholder="a new tag under ${esc(name(r.n))}" autocomplete="off" spellcheck="false"></span><span class="ct"></span><span class="iss"></span></div>`;
    return h;
  }

  /* ---------- Two panes: the whole tree twice, side by side, each finding and scrolling on its own, so a tag can be dragged
     from one onto a row of the other when the two are far apart in one long tree. The first pane is the map's own (its find
     text, folds and cursor); a field opens only there. While a tag is held, "to the top" stands at the foot of each pane. */
  let inPane2 = false;
  function panesHtml() {
    const pane = n => {
      inPane2 = n === 2;
      const rows = visibleRows(n), q = n === 2 ? st.pane2.find : st.find;
      const h = `<div class="st-pane" data-pane="${n}"><div class="st-find lk-field"><input ${n === 2 ? 'data-find2' : 'data-find'} placeholder="Find a tag" value="${esc(q)}" autocomplete="off" spellcheck="false"></div>` +
        `<div class="st-tree lk-list" ${st.ticks.size ? 'data-picking' : ''}>${rows.map(rowHtml).join('')}<div class="st-row st-topdrop" data-row="${LOOSE}"><span></span><span></span><span></span><span class="nm">to the top</span></div></div></div>`;
      inPane2 = false;
      return h;
    };
    return `<div class="st-panes">${pane(1)}${pane(2)}</div>${st.aim ? '' : focusHtml(st.cur)}`;
  }

  // ---------- the whole: the areas ----------
  function topHtml() {
    const v = ['table', 'log'].includes(st.view) ? st.view : 'tree';
    const views = `<div class="st-views lk-views">${[['tree', 'Regions'], ['table', 'Every property'], ['log', 'Log']].map(([k, w]) => `<span class="lk-view ${v === k ? 'here on' : 'act'}" ${v === k ? '' : `data-show="${k}"`}>${w}</span>`).join('')}</div>`;
    const split = st.view === 'tree' ? `<span class="st-split act lk-btn lk-low lk-i-side" data-split>${st.split ? 'One pane' : 'Two panes'}</span>` : '';
    const find = st.view === 'tree' && st.split ? '' : `<div class="st-find lk-field"><input data-find placeholder="${st.view === 'table' ? 'Find a property' : 'Find a tag'}" value="${esc(st.find)}" autocomplete="off" spellcheck="false"></div>`;
    return `<div class="st-top">${views}${find}${split}${st.view === 'tree' ? `<span class="st-new act lk-add lk-i-plus" data-do="new" data-on="${LOOSE}">New top-level tag</span>` : ''}</div>${st.view === 'tree' ? actsHtml() : st.view === 'table' ? pactsHtml() : ''}`;
  }
  // What can be done stays in view, faint until it can be (the research: what you can do is recognised, not remembered), so nothing moves when a tag is picked.
  function actsHtml() {
    const aim = st.aim, names = aim && (aim.tags.length > 3 ? `${aim.tags.length} tags` : R.list(aim.tags.map(name)));
    if (aim) return `<div class="st-acts lk-bar"><b class="lk-said">${aim.what === 'move' ? `Move ${esc(names)} to` : `Merge ${esc(names)} into`}: press a tag</b><span class="act lk-btn lk-low lk-i-x" data-aimoff>Leave it</span>${aim.what === 'move' ? '<span class="act lk-btn lk-low lk-i-up" data-aimtop>To the top</span>' : ''}</div>`;
    const n = st.ticks.size;
    return `<div class="st-acts lk-bar">${n ? `<b class="lk-said">${n} picked</b>` : '<span class="say">Pick tags to move or merge</span>'}<span class="act lk-btn lk-low lk-i-move ${n ? '' : 'waits'}" data-aim="move">Move to…</span><span class="act lk-btn lk-low lk-i-merge ${n > 1 ? '' : 'waits'}" data-aim="merge">Merge into…</span></div>`;
  }
  /* Every property's bar, as Regions' is for tags: what is picked and what it can take, waiting faintly until it can. Merging,
     the rows are the choice ("press a property"); combining, the bar asks the name of the property they become. */
  function pactsHtml() {
    const ids = [...st.pticks].filter(id => P(id)), names = ids.length > 3 ? `${ids.length} properties` : R.list(ids.map(id => P(id).title));
    if (st.paim) return `<div class="st-acts lk-bar"><b class="lk-said">Merge ${esc(names)} into: press a property</b><span class="act lk-btn lk-low lk-i-x" data-paimoff>Leave it</span></div>`;
    if (st.edit?.what === 'pcombine' && st.edit.owner === mode) return `<div class="st-acts lk-bar"><b class="lk-said">Combine ${esc(names)} as</b><input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" placeholder="Name of the property they become" autocomplete="off" spellcheck="false"><span class="act lk-btn lk-low lk-i-x" data-paimoff>Leave it</span></div>`;
    const n = ids.length;
    return `<div class="st-acts lk-bar">${n ? `<b class="lk-said">${n} picked</b>` : '<span class="say">Pick properties to merge or combine</span>'}<span class="act lk-btn lk-low lk-i-merge ${n ? '' : 'waits'}" data-paim>Merge into…</span><span class="act lk-btn lk-low lk-i-rename ${n > 1 ? '' : 'waits'}" data-pcombine>Combine as…</span></div>`;
  }
  function regionsHtml() {
    const areas = [];
    for (const r of visibleRows()) { if (!r.d) areas.push([]); areas[areas.length - 1]?.push(r); }
    const asking = st.edit && st.edit.owner === mode && (st.edit.what === 'kids' || st.edit.on === LOOSE);
    const edit = asking ? `<div class="st-area"><div class="st-row lk-row kind"><span></span><span></span><span></span><span class="nm"><input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" placeholder="${st.edit.what === 'kids' ? `The first child tags of ${esc(name(st.edit.on))}, with commas` : 'Name of the new top-level tag'}" autocomplete="off" spellcheck="false"></span></div></div>` : '';
    return `<div class="st-regions lk-list" ${st.ticks.size ? 'data-picking' : ''}><svg class="st-lines" aria-hidden="true"></svg>${areas.map(a => `<div class="st-area">${a.map(rowHtml).join('')}</div>`).join('')}${edit}</div>${st.aim ? '' : focusHtml(st.cur)}`;
  }
  // The relationships of a tag, read left to right: the tag that holds the property, the property and what it holds, how many nodes.
  const relWord = (id, t) => `<span class="lk-tag ${id === t ? 'self' : ''}" data-go="${esc(id)}">${esc(name(id))}</span>`;
  const relProp = (r, t) => `<span><span class="lk" data-open="${esc(P(r.prop)?.uuid || '')}">${esc(r.title)}</span>: ${relWord(r.to, t)}</span>`;
  // The tag itself, which the heading above already names, is left out of its own lines (the audit's 31): "Provider: Doctor 74"
// for a road out of it, "Report  About" for a road into it.
const relLine = (r, t) => r.from === t ? `<span></span>${relProp(r, t)}<span class="num">${r.n}</span>`
    : r.to === t ? `${relWord(r.from, t)}<span><span class="lk" data-open="${esc(P(r.prop)?.uuid || '')}">${esc(r.title)}</span></span><span class="num">${r.n}</span>`
    : `${relWord(r.from, t)}${relProp(r, t)}<span class="num">${r.n}</span>`;
  function relsHtml(id) {
    const { out, in: inn } = Mo.roadsOf(M(), id), key = `rels${id}`;
    const part = (list, k) => { const shown = st.whole.has(key + k) ? list : list.slice(0, 3); return shown.map(r => relLine(r, id)).join('') + (shown.length < list.length ? `<span class="all lk-more" data-all="${key + k}">and ${list.length - shown.length} more</span>` : ''); };
    if (!out.length && !inn.length) return '<span>No relationships yet</span>';
    return `<div class="st-rel">${part(out, 'o')}${out.length && inn.length ? '<span class="gap"></span>' : ''}${part(inn, 'i')}</div>`;
  }
  function focusHtml(id) {
    const t = T(id); if (!t) return '';
    return `<div class="st-focus"><div class="f-h"><span class="lk" data-go="${esc(id)}">${esc(t.title)}</span></div>${relsHtml(id)}${mergeAskHtml(id)}${changeAskHtml(id)}${suggestHtml(id)}</div>`;
  }
  const suggestHtml = id => R.issuesOn(ISS(), id).map(i => { const n = ISS().indexOf(i); return `<div class="sug"><b>Suggested</b><span>${partsHtml(i.parts)}</span><span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${n}">${esc(fixWord(i.fix))}</span></div>${askHtml(n)}`; }).join('');
  // ---------- a tag's lines: Parent alone on one line above its title; the others in the inspector ----------
  // (the owner, 8 November 2026: Extends is called Parent, on one line above the title without moving the title down; 12 November:
  // Parent alone there; Child tags, Beside and Relationships live in the inspector alone.)
  const parentHtml = id => { const up = Mo.pathOf(M(), id).slice(0, -1).reverse(); return `<span class="act lk-pick" data-do="move" data-on="${id}">${up.length ? up.map(tagLink).join('<span class="to"> / </span>') : 'Nothing'}<span class="chev lk-change lk-i-chevron"></span></span>`; };
  const kidsHtml = id => { const kids = Mo.kids(M(), id), adding = st.edit?.what === 'new' && st.edit.on === id && st.edit.owner === mode;
    const key = `kids${id}`, shown = st.whole.has(key) ? kids : kids.slice(0, 6);
    return `${shown.map(k => `<div class="ont">${tagLink(k)}<span class="num">${Mo.count(M(), k)}</span></div>`).join('')}${shown.length < kids.length ? `<span class="lk-more" data-all="${key}">and ${kids.length - shown.length} more</span>` : ''}${adding ? `<input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" placeholder="Name of the child tag" autocomplete="off" spellcheck="false">` : `<span class="act lk-add lk-i-child" data-do="new" data-on="${id}">Add child tag</span>`}`; };
  function lineHtml(id) {
    if (!T(id)) return '';
    return `<dl class="st-lines-t st-line1"><dt>Parent</dt><dd>${parentHtml(id)}</dd></dl>${mergeAskHtml(id)}${changeAskHtml(id)}`;
  }
  function linesHtml(id) {
    if (!T(id)) return '';
    const up = Mo.pathOf(M(), id).slice(0, -1).reverse(), beside = up.length ? Mo.kids(M(), up[0]).filter(k => k !== id) : [];
    // Parent is said once, on the line above the page's title (the owner, 9 November 2026, the audit's B2); the inspector beside
    // it says what that line does not, Child tags first (the owner, 12 November 2026: "just have parent and that is all … the
    // children and other details in a sidebar view"; with several child tags the one line wrapped onto the title).
    return `<dl class="st-lines-t"><dt>Child tags</dt><dd class="col kids">${kidsHtml(id)}</dd>${beside.length ? `<dt>Beside</dt><dd><span>${ranges(beside)}</span></dd>` : ''}` +
      `<dt>Relationships</dt><dd>${relsHtml(id)}</dd></dl>${mergeAskHtml(id)}${changeAskHtml(id)}${suggestHtml(id)}`;
  }
  // A property's own page: the same short lines above what Logseq shows. Each action sits on what it acts on.
  function propLinesHtml(pid) {
    const m = M(), p = P(pid); if (!p) return '';
    const on = [...p.on].sort((a, b) => Mo.count(m, b) - Mo.count(m, a));
    const onRow = id => { const key = `${id}·${pid}`, t = T(id), kids = Mo.kids(m, id), fx = { word: '', ask: '' };
      return `<div class="ont" data-prop="${key}">${tagLink(id)}<span class="num">${Mo.filled(m, id, pid)} of ${Mo.count(m, id)}</span><span class="acts-r"><span class="act lk-btn lk-low lk-i-move" data-do="pmove" data-on="${key}">Move to…</span>${(p.choice || p.type === 'node') && t?.nodes.size ? `<span class="act lk-btn lk-low lk-i-split" data-do="split" data-on="${key}">Split…</span>` : ''}<span class="act lk-btn lk-low lk-del lk-i-minus" data-do="pdrop" data-on="${key}" title="Delete property from tag">Delete</span></span></div>` +
        kids.map(k => { const lf = lineFix(id, pid, k); return `<div class="ont kid">${tagLink(k)}<span class="num">${Mo.filled(m, k, pid)} of ${Mo.count(m, k)}</span><span class="acts-r">${lf.word}</span></div>${lf.ask}`; }).join(''); };
    const cutAt = st.whole.has(`range${pid}`) ? p.range.length : 3, nodeTags = p.range.slice(0, cutAt).map(id => `<span class="rg">${tagLink(id)}<span class="lk-x" data-unrange="${id}" data-unprop="${pid}" title="Take ${esc(name(id))} out">×</span></span>`).join('') + (p.range.length > cutAt ? `<span class="lk-more" data-all="range${pid}">and ${p.range.length - cutAt} more</span>` : '');
    const rels = Mo.roads(m).filter(r => r.prop === pid).sort((a, b) => b.n - a.n), key = `prop${pid}`, shown = st.whole.has(key) ? rels : rels.slice(0, 6);
    return `<dl class="st-lines-t"><dt>Property type</dt><dd>${esc(Mo.kindWord(p.choice ? 'choice' : p.type))}${p.many ? ', several values' : ''}<span class="act lk-btn lk-low lk-i-merge" data-do="pmerge" data-on="0·${pid}">Merge into…</span></dd>` +
      (p.type === 'node' ? `<dt>Node tags</dt><dd>${nodeTags}<span class="act lk-add lk-i-plus" data-addrange="0·${pid}">Specify node tags…</span></dd>` : '') +
      `<dt>On tags</dt><dd class="col">${on.map(onRow).join('')}${on.length ? '' : `<span>${plural(m.holders.get(p.ident)?.size || 0, 'node')}, on no tag</span>`}<span class="act lk-add lk-i-plus" data-do="pmove" data-on="0·${pid}">Put on a tag…</span></dd>` +
      (p.type === 'node' ? `<dt>Relationships</dt><dd>${rels.length ? `<div class="st-rel">${shown.map(r => `${relWord(r.from)}${relProp(r)}<span class="num">${r.n}</span>`).join('')}${shown.length < rels.length ? `<span class="all lk-more" data-all="${key}">and ${rels.length - shown.length} more</span>` : ''}</div>` : '<span>No relationships yet</span>'}</dd>` : '') + `</dl>${pmergeAskHtml(pid)}` +
      R.issuesOfProp(ISS(), pid).filter(i => !(i.line && i.line.kid != null)).map(i => { const n = ISS().indexOf(i); return `<div class="sug"><b>Suggested</b><span>${partsHtml(i.parts)}</span><span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${n}">${esc(fixWord(i.fix))}</span></div>${askHtml(n)}`; }).join('');
  }
  /* In the inspector each part is headed by what it describes (the owner, 9 November 2026: "how the section appear"): the tag in
     its mono, or the property with its icon. Above the table the page's own title says it, so the head shows in the inspector only. */
  const inspHeadHtml = o => { const p = o.prop != null ? P(o.prop) : null;
    if (o.prop != null) return p ? `<div class="st-insp-h">${pi(p)}<span>${esc(p.title)}</span></div>` : '';
    return T(o.tag) ? `<div class="st-insp-h">${tagLink(o.tag)}</div>` : ''; };
  function logHtml() {
    const all = app.logged();
    return `<div class="st-log">${all.length ? all.map(x => `<div class="ln"><span>${esc(new Date(x.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${esc(x.text)}</span><span>${x.nodes ? plural(x.nodes, 'node') : ''}</span></div>`).join('') : '<div class="st-empty">Nothing has been changed yet.</div>'}</div>`;
  }
  // ---------- the top line of every content: the path, ending on the thing itself; where to go back; the two lists ----------
  // The title row: the name, and at the right end the place in the tree, nearest first, each a tag that opens (as Look draws a page's).
  const acts = (on, list) => { const l = list.filter(Boolean); return l.length ? `<div class="acts lk-strip">${l.map(([word, a]) => `<span class="act lk-btn lk-i-${ACT_ICON[a]}" data-do="${a}" data-on="${esc(on)}">${word}</span>`).join('')}</div>` : ''; };

  // ---------- the card ----------
  // A tag named on a card or in the table: plain words with the faint underline, as the mockup draws it (a run of small mono
  // names was hard to read, the owner, 30 October 2026); where it stands already says it is a tag.
  const tagLink = id => `<span class="lk-tag tg ${waitTag(id) ? 'lk-pencil' : ''}" data-go="${esc(id)}">${esc(name(id))}</span>`;
  // A range of many tags (Topic, on purpose, takes fifteen): the first three, then how many more; the property's card lists them all.
  const ranges = ids => ids.slice(0, 3).map(tagLink).join('<span class="to sp">, </span>') + (ids.length > 3 ? ` <span class="to and">and ${ids.length - 3} more</span>` : '');
  // An issue that belongs to a line puts its fix word at the line's right end, after the faint count, with its ask under the line.
  const lineFix = (tagId, pid, kid) => { const i = R.issueOnLine(ISS(), tagId, pid, kid); return i ? { cls: 'fx', word: `<span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${ISS().indexOf(i)}">${esc(fixWord(i.fix))}</span>`, ask: askHtml(ISS().indexOf(i)) } : { cls: '', word: '', ask: '' }; };
  // An issue: what is wrong, then the fix as a word. Choosing the fix opens one line that says what it would do, with the
  // nodes it touches; only "stage it" puts it in the tray. A fix that needs a choice (which kind, which tag) opens the prompt.
  // The sentence in parts, each keyed by its role: the thing to settle in the text colour with the underline that opens its card
  // (a tag, or a property on a tag), the tying words quiet, the tags as tags (three, then "and N more"), the count as a number.
  const partsHtml = parts => parts.map(p => p.subject ? (p.subject.prop != null
      ? `<span class="k lk sj ${waitProp(p.subject.prop) ? 'lk-pencil' : ''}" data-prop="${p.subject.tag}·${p.subject.prop}">${esc(P(p.subject.prop)?.title ?? '')}</span>`
      : `<span class="k lk sj ${waitTag(p.subject.tag) ? 'lk-pencil' : ''}" data-go="${esc(p.subject.tag)}">${esc(name(p.subject.tag))}</span>`)
    : p.tags ? (p.sep === 'and' && p.tags.length === 2 ? p.tags.map(tagLink).join('<span class="to">and</span>') : ranges(p.tags))
    : p.count != null ? `<span class="nm">${esc(p.count)}</span>`
    : `<span class="to ${/^[,:;]/.test(p.words) ? 'pn' : ''}">${esc(p.words)}</span>`).join(' ').replace(/ (<span class="to pn")/g, '$1');
  const fixWord = w => w.replace(/^drop\b/i, 'Delete property from tag');
  const askLine = (c, last) => {
    const s = S.changes.sentence(M(), c), two = c.kind === 'merge';
    const words = last ? `<div class="lk-answers"><span class="act lk-accent lk-i-tick lk-enter" data-stage>Stage it</span><span class="act lk-btn lk-low lk-i-x" data-leave>Leave it</span></div>` : '';
    // Each thing once: what it asks; the merge's columns say which tag goes and how many nodes; what no Undo brings back, under them.
    return `<div class="st-q"><div class="h">${esc(two ? s.ask : s.text)}${s.nodes && !two ? ` · ${plural(s.nodes, 'node')}` : ''}</div>${two ? twoHtml(c.from, c.into) : ''}${two && s.lost.length ? `<div class="l">${s.lost.map(esc).join(' · ')}</div>` : ''}${words}</div>`;
  };
  function askHtml(n) {
    if (!st.ask || st.ask.i !== n) return '';
    const i = ISS()[n];
    return i ? askLine(i.change, true) : '';
  }
  // Ticked tags merged into this one: the same ask as a fix, one consequence for each.
  const mergeAskHtml = id => st.ask?.merges && st.ask.into === id ? st.ask.merges.map((from, n, all) => askLine({ kind: 'merge', from, into: id }, n === all.length - 1)).join('') : '';
  // A change that comes with its ask already (the × on a tag's own page): under the card's words, while what it names still holds.
  const changeAsk = () => { const c = st.ask?.change; return c && T(c.tag)?.parents.includes(c.from) ? c : null; };
  const changeAskHtml = id => changeAsk()?.tag === id ? askLine(changeAsk(), true) : '';
  // A merge before it is staged, as the grammar shows a consequence: the two tags side by side, their properties lined up,
  // what is shared, what moves to the kept tag and what the kept tag gains.
  function twoHtml(fromId, intoId) {
    const m = M(), from = T(fromId), into = T(intoId); if (!from || !into) return '';
    if (!from.props.length && !into.props.length && !from.kids.length && !Mo.count(m, fromId) && !Mo.count(m, intoId)) return '';   // nothing to set side by side
    const col = (t, other, gone) => `<div><div class="h">${esc(t.title)}<span class="ct">${[Mo.count(m, t.id) ? plural(Mo.count(m, t.id), 'node') : '', gone ? 'removed' : 'kept'].filter(Boolean).join(', ')}</span></div>` +
      t.props.map(pid => { const shared = other.props.includes(pid); return `<div class="pr ${shared ? 'shared' : gone ? 'moves' : ''}"><span class="n">${pi(P(pid))}${esc(P(pid).title)}</span><span class="ct">${shared ? `on both` : gone ? 'moves' : ''}</span></div>`; }).join('') +
      (!gone ? other.props.filter(pid => !t.props.includes(pid)).map(pid => `<div class="pr new"><span class="n">${pi(P(pid))}${esc(P(pid).title)}</span><span class="ct">new</span></div>`).join('') : '') +
      (gone && t.kids.length ? `<div class="pr moves"><span class="n">${plural(t.kids.length, 'tag')} under it</span><span class="ct">move</span></div>` : '') +
      `</div>`;
    return `<div class="st-two">${col(from, into, true)}${col(into, from, false)}</div>`;
  }
  /* Properties merged into one, before it is staged: the tag merge's ask, one for each property merged away. Two columns (the
     tags each is on, which move to the kept one), then what becomes of the values: their kind, what stays behind, and, where
     the kept property takes one value and a node would hold two, the way to Logseq's own page to let it take several. */
  function pmergeAskHtml(pid) {
    const a = st.ask?.pmerge; if (!a || a.into !== pid && !(TAGISH && a.froms.includes(pid)) || st.ask.owner !== mode) return '';
    const m = M(), into = P(a.into); if (!into) return '';
    const held = id => m.holders.get(P(id).ident)?.size || 0;
    const col = (p, other, gone) => `<div><div class="h">${pi(p)}${esc(p.title)}<span class="ct">${[held(p.id) ? plural(held(p.id), 'node') : '', gone ? 'emptied' : 'kept'].filter(Boolean).join(', ')}</span></div>` +
      p.on.map(t => { const both = other.on.includes(t); return `<div class="pr ${both ? 'shared' : gone ? 'moves' : ''}"><span class="n">${esc(name(t))}</span><span class="ct">${both ? 'on both' : gone ? 'moves' : ''}</span></div>`; }).join('') +
      (!gone ? a.froms.flatMap(f => P(f)?.on || []).filter((t, i, all) => !p.on.includes(t) && all.indexOf(t) === i).map(t => `<div class="pr new"><span class="n">${esc(name(t))}</span><span class="ct">new</span></div>`).join('') : '') + `</div>`;
    const clash = a.preview.reduce((n, x) => n + x.clash.length, 0);
    const blocks = a.froms.map((f, i) => { const from = P(f), x = a.preview[i]; if (!from) return '';
      const lines = [S.values.becomes(from, into), x.kept && `${plural(x.kept, 'value')} ${into.title} cannot take ${x.kept === 1 ? 'stays' : 'stay'} on ${from.title}`].filter(Boolean);
      return `<div class="h">Merge ${esc(from.title)} into ${esc(into.title)}</div>${from.on.length || into.on.length ? `<div class="st-two">${col(from, into, true)}${col(into, from, false)}</div>` : ''}${lines.map(l => `<div class="l">${esc(l)}</div>`).join('')}`; });
    const renamed = a.rename && a.rename !== into.title ? `<div class="h">Rename ${esc(into.title)} to ${esc(a.rename)}</div>` : '';
    const words = clash
      ? `<div class="l">${esc(into.title)} takes one value, and ${plural(clash, 'node')} would hold two: let it take several values on its page in Logseq first</div><div class="lk-answers"><span class="act lk-btn lk-i-go" data-do="ppage" data-on="0·${a.into}">Go to ${esc(into.title)}</span><span class="act lk-btn lk-low lk-i-x" data-leave>Leave it</span></div>`
      : `<div class="lk-answers"><span class="act lk-accent lk-i-tick lk-enter" data-stage>Stage it</span><span class="act lk-btn lk-low lk-i-x" data-leave>Leave it</span></div>`;
    return `<div class="st-q">${blocks.join('')}${renamed}${words}</div>`;
  }
  // ---------- every property ----------
  function tableHtml() {
    // One row per property: every tag it is declared on (the biggest first), what it points at, how filled over all of them.
    // The grammar's row (the owner, 5 November 2026: "things should be consistent across the app"): the fold arrow opens the
    // property's lines in place under the row, the name opens the property's page, a tag's name opens the tag's page, the tick
    // picks, and the rest of the row only selects. The row is keyed by its biggest tag, so its menu knows which tag it is on.
    const m = M(), byProp = new Map();
    for (const r of Mo.propRows(m)) { const g = byProp.get(r.prop) || { prop: r.prop, p: P(r.prop), on: [], filled: 0, of: 0 }; g.on.push({ tag: r.tag, of: r.of }); g.filled += r.filled; g.of += r.of; byProp.set(r.prop, g); }
    let rows = [...byProp.values()].map(g => { g.on.sort((a, b) => b.of - a.of); g.tag = g.on[0].tag; g.pct = g.filled / Math.max(g.of, 1); return g; });
    // A property on no tag is a row like any other (opened, renamed, dragged into a group); its count is the nodes that hold it,
    // and it is filled on none of its tags, so the least filled come first with it.
    for (const p of m.props.values()) if (!p.on.length) rows.push({ prop: p.id, p, on: [], tag: 0, filled: m.holders.get(p.ident)?.size || 0, of: 0, pct: 0 });
    // The find line narrows here as on Regions: by the property's name, the tags it is on, and the tags it holds.
    const q = st.find.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.p.title.toLowerCase().includes(q) || r.on.some(x => name(x.tag).toLowerCase().includes(q)) || r.p.range.some(id => name(id).toLowerCase().includes(q)));
    const s = st.sort, onName = g => name(g.tag);
    rows.sort((a, b) => s === 'name' ? a.p.title.localeCompare(b.p.title) : s === 'on' ? !a.tag - !b.tag || (a.tag && onName(a).localeCompare(onName(b))) || a.p.title.localeCompare(b.p.title) : s === 'to' ? name(b.p.range[0] ?? '').localeCompare(name(a.p.range[0] ?? '')) : a.pct - b.pct || a.p.title.localeCompare(b.p.title));
    let h = `<div class="st-tbl lk-list" ${st.pticks.size ? 'data-picking' : ''}><div class="hd">${['name', 'on', 'to', 'filled'].map(c => `<span class="lk-head ${s === c ? 'on' : ''}" data-sort="${c}">${{ name: 'Property', on: 'On tags', to: 'Holds', filled: 'Filled' }[c]}${s === c ? `<span class="sortmark">${c === 'to' ? '↓' : '↑'}</span>` : ''}</span>`).join('')}</div>`;
    // A property's name, or the field renaming it (Rename in its right-click menu).
    const nameCell = (key, title, wait, page) => st.edit?.what === 'prename' && st.edit.on === key && st.edit.owner === mode
      ? `<input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="k lk ${wait ? 'lk-pencil' : ''}" ${page ? `data-ppage="${esc(page)}"` : ''}>${esc(title)}</span>`;
    const tr = (r, d) => { const key = `${r.tag}·${r.prop}`, open = st.popen.has(r.prop); return `<div class="tr lk-row ${waitProp(r.prop)} ${st.paim && st.pticks.has(r.prop) ? 'dim' : ''} ${st.propCur === key ? 'cur' : ''}" data-prop="${key}" data-gprop="${esc(r.p.ident)}" draggable="true" style="--pd:${d ? 20 + d * 16 : 4}px"><span><input type="checkbox" class="lk-tick" data-ptick="${r.prop}" ${st.pticks.has(r.prop) ? 'checked' : ''}><span class="lk-fold" data-pfold="${r.prop}" aria-expanded="${open}" title="${open ? 'Close' : 'Open'} ${esc(r.p.title)} here"></span>${nameCell(key, r.p.title, waitProp(r.prop), key)}</span><span class="st-cell"><span>${r.on.length ? ranges(r.on.map(x => x.tag)) : '<span class="f">No tag</span>'}</span><span class="st-chev lk-change lk-i-chevron" data-pon="${r.prop}" title="Put ${esc(r.p.title)} on a tag…"></span></span><span class="st-cell"><span>${r.p.type === 'node' ? (r.p.range.length ? ranges(r.p.range) : 'any node') : esc(Mo.kindWord(r.p.choice ? 'choice' : r.p.type))}</span>${r.p.type === 'node' ? `<span class="st-chev lk-change lk-i-chevron" data-prange="${r.prop}" title="Node tags of ${esc(r.p.title)}…"></span>` : ''}</span><span class="ct">${r.tag ? `${r.filled} of ${r.of}` : plural(r.filled, 'node')}</span></div>${open ? `<div class="st-popen" data-popen="${r.prop}">${propLinesHtml(r.prop)}</div>` : ''}${pmergeAskHtml(r.prop)}`; };
    // A prompt about this property (Put on a tag…, Node tags…, from the cell's chevron or the opened lines) rolls out under its row.
    /* The groups: an outline of names, each folding like a bullet, holding properties and other groups, for order only
       (app.groups, kept on this computer). A property dragged onto a group's name goes into it; a group dragged onto another
       goes inside it; onto "No group", back out. With no group made, the table reads as before. */
    const G = app.groups(), gById = new Map(G.list.map(g => [g.id, g]));
    const groupOf = r => gById.has(G.of[r.p.ident]) ? G.of[r.p.ident] : null;
    const kidsOf = id => G.list.filter(g => (gById.has(g.under) ? g.under : null) === id);
    const propsIn = id => rows.filter(r => groupOf(r) === id);
    const countIn = id => propsIn(id).length + kidsOf(id).reduce((n, g) => n + countIn(g.id), 0);
    const field = (what, on) => st.edit?.what === what && st.edit.on === on && st.edit.owner === mode;
    const groupHtml = (g, d) => {
      const open = g.open !== false;
      let x = `<div class="st-grp lk-reveals" data-group="${esc(g.id)}" draggable="true" style="--d:${d}"><span class="lk-fold" data-gfold="${esc(g.id)}" aria-expanded="${open}"></span>` +
        (field('gname', g.id) ? `<input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="gn" data-gname="${esc(g.id)}">${esc(g.name)}</span>`) +
        `<span class="ct">${countIn(g.id) || ''}</span><span class="lk-x lk-reveal" role="button" tabindex="0" aria-label="Take the group ${esc(g.name)} away" data-gdrop="${esc(g.id)}" title="Take the group away; what it holds goes up a level">×</span></div>`;
      if (open) x += kidsOf(g.id).map(k => groupHtml(k, d + 1)).join('') + propsIn(g.id).map(r => tr(r, d + 1)).join('');
      return x;
    };
    if (G.list.length) {
      const free = propsIn(null);
      h += kidsOf(null).map(g => groupHtml(g, 0)).join('') + `<div class="st-grp none" data-group="" style="--d:0"><span></span><span class="gn">No group</span><span class="ct">${free.length || ''}</span><span></span></div>` + few('table', free).map(r => tr(r, 1)).join('') + moreOf('table', free);
    } else h += few('table', rows).map(r => tr(r, 0)).join('') + moreOf('table', rows);
    h += `<div class="st-gnew">${field('gnew', '') ? `<input class="st-in lk-field" data-edit value="${esc(st.edit.text)}" placeholder="Name of the group" autocomplete="off" spellcheck="false">` : '<span class="act lk-add lk-i-plus" data-gnew>New group</span><span class="act lk-add lk-i-plus" data-pnew>New property</span>'}</div>`;
    return h + `</div>`;
  }
  // A long list: a few, then "show all", as a tag's nodes.
  const FEW = 20;
  const few = (key, list) => st.whole.has(key) ? list : list.slice(0, FEW);
  const moreOf = (key, list) => !st.whole.has(key) && list.length > FEW ? `<div class="more lk-more" data-all="${esc(key)}">show all ${list.length}</div>` : '';
  // ---------- a tag's nodes ----------
  function nodesHtml() {
    const n = st.nodes, t = n && T(n.tag);
    if (!t) return `<div class="st-empty lk-none">No nodes to show</div>`;
    const list = n.all ? n.list : n.list.slice(0, 20);
    let h = `<div class="st-card st-nodes lk-list" ${n.ticks.size ? 'data-picking' : ''}><div class="st-h" style="margin-top:0"><span class="lk" data-go="${n.tag}">${esc(t.title)}</span>, ${plural(n.list.length, 'node')}</div>`;
    // Nothing ticked: the bar's room stays empty, so a tick moves no row.
    if (!n.ticks.size) h += `<div class="st-pick"></div>`;
    else h += `<div class="st-pick lk-bar"><b class="lk-said">${n.ticks.size} picked</b><span class="act lk-btn lk-i-move" data-do="nmove" data-on="${n.tag}">Move to another tag…</span><span class="act lk-btn lk-i-child" data-do="nsplit" data-on="${n.tag}">New child tag of ${esc(t.title)} with them…</span></div>`;
    h += list.map((x, i) => `<div class="st-ln ${i === n.cur ? 'cur' : ''}" data-node="${i}"><span class="lk-day">${dayWords(x.day)}</span><input type="checkbox" class="lk-tick" data-ntick="${i}" ${n.ticks.has(x.uuid) ? 'checked' : ''}><span class="st-bul lk-bul"></span><span class="w"><span class="lk-node lk-bare lk" data-uuid="${esc(x.uuid)}" data-open="${esc(x.uuid)}">${esc(x.title.slice(0, 120) || '…')}</span></span></div>`).join('');
    if (!n.all && n.list.length > 20) h += `<div class="more lk-more" data-more>show all ${n.list.length}</div>`;
    return h + `</div>`;
  }

  // ---------- the tray ----------
  function trayHtml() {
    const tr = app.tray;
    if (st.ask?.apply && !tr.lasting().length) st.ask = null;   // the line it asked about was taken out
    if (st.busy) return `<div class="busy lk-hint">${esc(st.busy)}</div>`;
    // The last Apply's arrow stays until a new Apply takes its place, whatever is staged or discarded in between.
    const done = tr.done ? `<div class="st-done">${esc(tr.done.text)}</div>` : '';
    const saying = tr.note || done ? `<div class="st-saying">${tr.note ? `<div class="note">${esc(tr.note)}</div>` : ''}${done}</div>` : '';
    if (!tr.changes.length) return saying;
    // The newest lines, since the newest is what was just done and what Cmd-Z takes; the rest behind "show all".
    const lines = tr.lines().map((c, i) => [c, i]), shown = st.whole.has('tray') ? lines : lines.slice(-FEW_LINES);
    // While the big question is open its blue yes is the one Apply on the screen.
    const big = st.ask?.apply, l = tr.links(), words = big ? '' : `<span class="lk-btn lk-low lk-i-x" data-discard>Discard</span><span class="lk-btn lk-i-eq" data-compare>Old and new</span><span class="lk-accent lk-i-tick" data-apply>Apply<span class="ky">Cmd Enter</span></span>`;
    // What changes reads first, then the facts, then the decision. A number lost is the one thing here in colour.
    return `<div class="tl">${shown.map(([c, i]) => `<span><span>${esc(c.text)}</span><i>${c.nodes ? plural(c.nodes, 'node') : ''}</i><span class="lk-x" data-drop="${i}" title="Take this one out">×</span></span>`).join('')}</div>` +
      (shown.length < lines.length ? `<div class="more lk-more" data-all="tray">show all ${lines.length}</div>` : '') + (st.compare ? compareHtml() : '') +
      `<div class="st-wait lk-bar">${lines.length > 1 ? `<b class="lk-said">${lines.length} changes waiting</b>` : ''}<span class="links">${l.kept} links kept${l.lost ? ` <b class="lk-del">${l.lost} lost</b>` : ''}</span>${words}</div>` + (big ? bigHtml() : saying);
  }
  const FEW_LINES = 5;
  // Old and new side by side: the top-level tags the waiting changes touch, as they stand and as Apply leaves them.
  function compareHtml() {
    const now = Mo.build(app.tray.raw), after = M(), seen = touched().tags, tops = new Set();
    for (const id of seen) for (const m of [now, after]) if (m.tags.has(id)) tops.add(Mo.pathOf(m, id)[0]);
    const col = (m, title, pencil) => { const out = []; const walk = (id, d) => { const t = m.tags.get(id); if (!t) return; out.push(`<div class="o ${pencil && seen.has(id) ? 'lk-pencil' : ''}" style="--d:${d}">${esc(t.title)}</div>`); Mo.kids(m, id).forEach(k => walk(k, d + 1)); }; tops.forEach(id => walk(id, 0)); return `<div><div class="h">${title}</div>${out.join('')}</div>`; };
    return `<div class="st-sb">${col(now, 'Now', false)}${col(after, 'After Apply', true)}</div>`;
  }
  // Apply, when Undo cannot put it all back: the library's question for a big change, its yes the one blue button.
  const bigHtml = () => `<div class="st-q st-big"><div class="h">Undo can’t put this back as it was</div>` +
    app.tray.lasting().map(x => `<div class="l">${esc(x.name)} is deleted for good. Undo makes a new tag of that name.</div>`).join('') +
    `<div class="lk-answers"><span class="lk-big" data-stage>Apply</span><span class="lk-btn lk-low lk-i-x" data-leave>Leave it</span></div></div>`;
  const pressApply = () => { if (st.ask?.apply) return; if (app.tray.lasting().length) { st.ask = { apply: true, owner: mode }; st.menu = null; return redraw(); } app.apply(); };

  // ---------- the prompt: the one drawing of a choice, a picker at the thing pressed ----------
  /* A picker anchored under the element pressed (the owner, 5 November: a choice rolling out under a table row, far from the
     chevron that opened it and pushing the rows down, "doesn't make any sense"; nothing else in Logseq or the plugin behaves so):
     as Logseq's own picker at a cell and the right-click menu, with the menu's look, in the scrolling box the press was in, so
     nothing on the page moves and it scrolls with its row. Drawn once, after the page, wherever the press was.
     One find line that reads the ask as its own name ("Put Provider on…", faint until letters are typed; the row above says what it
     concerns), then the rows: name and count, stepped in by level, no bullets, since these are choices and not blocks, as in Logseq's
     own picker (the owner, 5 November: "this menu looks awful" of an ask line, a field and bulleted rows). A row that cannot take the thing stays,
     faint, with the reason in its title (`why`), so the person sees why and not just that; Enter and a press do nothing on it.
     At rest the tree shows whole levels: the top-level tags always, the next level only when all of it fits in the few, so no
     top-level tag hides behind "show all" while a child of another shows. Typed letters find anywhere in the tree and the
     matches stand flat, since an indent under no parent says nothing. "show all" is the grammar's opener, reached by the
     arrows too. The lit row is the one Enter takes: the first that can take the thing, moved by the arrows and the pointer. */
  const PROMPT_FEW = 12;
  function promptHtml() {
    const p = st.prompt, m = M(), q = p.text.trim().toLowerCase(), hit = s => !q || s.toLowerCase().includes(q);
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    let ask, all, few, kind = 'tag';
    // The tag that gives n the property pid: n itself, or the nearest tag above it (a child tag inherits its parent's properties).
    const giver = (n, pid) => Mo.pathOf(m, n).reverse().find(a => T(a)?.props.includes(pid)) ?? null;
    if (p.list === 'values') {
      kind = 'value';
      ask = `Split ${name(p.tag)} by ${P(p.prop).title}: a child tag for…`;
      all = p.values.filter(v => hit(v.title)).map(v => ({ key: v.id, nm: v.title, ct: v.count, ctt: v.count ? plural(v.count, 'node') : '', d: 0, why: '' }));
    } else if (p.what === 'pmerge') {
      kind = 'property';
      ask = `Merge ${P(p.prop).title} into…`;
      all = [...m.props.values()].filter(x => x.id !== p.prop && hit(x.title)).sort(byTitle).map(x => ({ key: x.id, nm: x.title, ct: m.holders.get(x.ident)?.size || '', ctt: m.holders.get(x.ident)?.size ? `${plural(m.holders.get(x.ident).size, 'node')} with a value` : '', d: 0, why: '', icon: pi(x) }));
    } else if (p.list === 'props') {
      kind = 'property';
      ask = `Add a property to ${name(p.tag)}${p.under ? ' and all beneath' : ''}…`;
      all = [...m.props.values()].filter(x => hit(x.title)).sort(byTitle).map(x => { const g = giver(p.tag, x.id); return { key: x.id, nm: x.title, ct: x.on.length ? `on ${x.on.length}` : '', ctt: x.on.length ? `on ${plural(x.on.length, 'tag')}` : '', d: 0, why: g == null ? '' : g === p.tag ? `already on ${name(p.tag)}` : `inherited from ${name(g)}`, icon: pi(x) }; });
    } else {
      const subject = p.what === 'nodes' ? plural(p.nodes.length, 'ticked node') : p.what === 'prop' ? P(p.prop).title : p.what === 'tag' ? (p.tags.length > 1 ? `${p.tags.length} picked tags` : name(p.tags[0])) : '';
      ask = p.what === 'pnew' ? 'New property on…' : p.what === 'range' ? `Node tags of ${P(p.prop).title}${P(p.prop).range.length ? ', also' : ''}…` : p.what === 'prop' && !p.from ? `Put ${P(p.prop).title} on…` : `Move ${subject} to…`;
      // Why a tag cannot take it, in Logseq's words; '' when it can.
      const why = n => {
        if (p.what === 'tag') {
          if (p.tags.includes(n)) return 'the tag itself';
          const above = p.tags.find(s => Mo.under(m, n, s)); if (above != null) return `beneath ${name(above)}`;
          if (p.tags.every(s => Mo.parentOf(m, s) === n)) return p.tags.length > 1 ? 'already under it' : `${name(p.tags[0])} is already under it`;
        } else if (p.what === 'prop') {
          if (n === p.from) return `${P(p.prop).title} is on it already`;
          const g = giver(n, p.prop); if (g != null && g !== p.from) return g === n ? `${P(p.prop).title} is on it already` : `inherited from ${name(g)}`;
        } else if (p.what === 'range') { if (P(p.prop).range.includes(n)) return 'already a node tag'; }
        else if (p.what === 'nodes') { if (p.nodes.every(x => x.tag === n)) return p.nodes.length > 1 ? 'the nodes carry it already' : 'the node carries it already'; }
        return '';
      };
      const list = [];
      const walk = (n, d) => { const t = T(n), c = Mo.count(m, n), up = q ? Mo.parentOf(m, n) : null; if (hit(t.title)) list.push({ key: n, nm: t.title, ct: c || '', ctt: c ? plural(c, 'node') : '', d: q ? 0 : d, why: why(n), up: up != null ? name(up) : '' }); for (const k of Mo.kids(m, n)) walk(k, d + 1); };
      Mo.tops(m).forEach(k => walk(k, 0));
      if (p.what === 'tag' && hit('The top')) list.push({ key: LOOSE, nm: 'The top', ct: '', d: 0, loose: true, why: p.tags.every(s => !T(s)?.parents.length) ? 'already at the top' : '' });
      all = list;
      if (!q) { const tops = list.filter(r => r.d === 0), two = list.filter(r => r.d <= 1); few = two.length <= PROMPT_FEW ? two : tops; }
    }
    let rows = p.whole ? all : (few || all).slice(0, PROMPT_FEW);
    if (!p.whole && all.length > rows.length) rows = [...rows, { more: true, nm: `show all ${all.length}`, ct: '', d: 0, why: '' }];
    rows.forEach(r => { r.ok = !r.why; });
    p.shown = rows;
    // After "show all" the light goes to the first row it brought, so Enter or an arrow goes on from where the eye already is.
    if (p.had) { const i = rows.findIndex(r => r.ok && !r.more && !p.had.has(r.key)); if (i >= 0) p.lit = i; p.had = null; }
    if (!rows[p.lit]?.ok) p.lit = rows.findIndex(r => r.ok);   // the lit row is one Enter can take
    // Nothing to take: say what was looked for and the way out, or, when the rows stand but are all faint, where the reason is.
    const none = !rows.length ? `<div class="q">No ${kind} matches “${esc(p.text.trim())}”<span class="hint"> · Esc clears</span></div>` :
      !rows.some(r => r.ok) ? `<div class="q">None of these can take it<span class="hint"> · point at one to see why</span></div>` : '';
    // The magnifier says this line finds; once letters are typed the ask stays, faint, at the line's right, so it is not lost.
    return `<div class="st-prompt lk-pop"><div class="st-find lk-field"><i class="ti ti-search" aria-hidden="true"></i><input data-pin placeholder="${esc(ask)}" title="Find a ${kind}" value="${esc(p.text)}" autocomplete="off" spellcheck="false">${p.text ? `<span class="ask" title="${esc(ask)}">${esc(ask)}</span>` : ''}</div>` +
      rows.map((r, i) => r.more ? `<div class="more lk-more ${i === p.lit ? 'lit' : ''}" data-pick="${i}">${esc(r.nm)}</div>` :
        `<div class="st-row ${r.ok ? '' : 'off'} ${r.loose ? 'loose' : ''} ${i === p.lit ? 'lit' : ''}" style="--d:${Math.min(r.d, 6)}" data-pick="${i}" ${r.why ? `title="${esc(r.why)}"` : ''}><span class="nm">${r.icon || ''}<span class="t">${esc(r.nm)}</span>${r.up ? `<span class="up">${esc(r.up)}</span>` : ''}</span><span class="ct"><span class="n"${r.ctt ? ` title="${esc(r.ctt)}"` : ''}>${esc(r.ct)}</span>${r.why ? `<span class="why">${esc(r.why)}</span>` : ''}</span></div>`).join('') +
      none + `</div>`;
  }
  // ---------- the menu: the same words the card has ----------
  function menuHtml() {
    const mn = st.menu, m = M(), ticked = st.ticks.size;
    const it = (t, act, off, k) => `<div class="lk-item ${off ? 'off' : ''} ${/^(Remove|Delete)/.test(t) ? 'lk-del' : ''}" data-act="${act}">${esc(t)}${k ? `<span class="rt lk-note">${k}</span>` : ''}</div>`;
    let h = `<div class="st-menu lk-pop lk-menu" style="left:${mn.x}px;top:${mn.y}px">`;
    if (mn.kind === 'row') {
      const t = T(mn.on), none = !t, loose = mn.on === LOOSE;   // none: nothing behind the row
      const n = Mo.count(m, mn.on), nodesOf = ids => plural(ids.reduce((s, x) => s + Mo.count(m, x), 0), 'node');
      h += (t?.uuid ? it('Go to this tag', 'page') : '') + it('Open everything under', 'openall', false, 'Shift →') + it(st.ticks.has(mn.on) ? 'Untick' : 'Tick', 'tick', none || loose, 'space') + '<div class="gap lk-item"></div>' +
        it('Rename', 'rename', loose || !t) + it('Its nodes', 'nodes', !n) + it(loose ? 'New top-level tag' : 'Add child tag', 'new') + it('Add a property…', 'addprop', none || loose) + it('Add a property to all beneath…', 'addpropall', loose, Mo.kids(m, mn.on).length ? nodesOf(Mo.kids(m, mn.on)) : '') + '<div class="gap lk-item"></div>' +
        it('Move to…', 'move', none || loose, n ? plural(n, 'node') : '') +
        it(ticked > 1 ? `Merge the ${ticked} ticked into this` : 'Merge the ticked into this', 'merge', none || loose || ticked < 1 || (ticked === 1 && st.ticks.has(mn.on)), ticked && !st.ticks.has(mn.on) ? nodesOf([...st.ticks]) : '') + '<div class="gap lk-item"></div>' +
        it('Remove', 'remove', none || loose || n > 0 || Mo.kids(m, mn.on).length > 0, n ? plural(n, 'node') : '');
    } else {
      const [tagId, pid] = mn.on.split('·').map(Number), t = T(tagId), p = P(pid), parent = Mo.parentOf(m, tagId);
      const declared = !!t?.props.includes(pid);
      const f = t ? plural(Mo.filled(m, tagId, pid), 'value') : '';
      h += (p?.uuid ? it('Go to this property', 'ppage') + '<div class="gap lk-item"></div>' : '') + it('Rename', 'prename', !p) + it('Merge into…', 'pmerge', !p) + (p?.type === 'node' ? it('Specify node tags…', 'prange') : '') + '<div class="gap lk-item"></div>' +
        (t ? it('Move to…', 'pmove', !declared, f) + it(parent != null ? `Pull up to ${name(parent)}` : 'Pull up to the parent', 'pullup', !declared || parent == null, f) +
        (p && (p.choice || p.type === 'node') ? it('Split by its values…', 'split', !t.nodes.size, plural(t.nodes.size, 'node')) : '') + '<div class="gap lk-item"></div>' + it('Delete property from tag', 'pdrop', !declared, f) : it('Put on a tag…', 'pmove'));
    }
    return h + `</div>`;
  }

  // ---------- draw ----------
  function draw() {
    const active = doc.activeElement, hadFocus = root.contains(active) || wantFocus;
    const finding = !wantFocus && root.contains(active) && active.matches('[data-find]') ? active.selectionStart : null;
    const finding2 = !wantFocus && root.contains(active) && active.matches('[data-find2]') ? active.selectionStart : null;
    const paneScroll = [...root.querySelectorAll('.st-pane .st-tree')].map(t => t.scrollTop);
    const scroll = root.querySelector('.st-tree')?.scrollTop, scrollA = root.querySelector('.st-regions')?.scrollLeft, scrollR = root.querySelector('.st-right')?.scrollTop;
    const trayWas = root.querySelector('.st-tray')?.offsetHeight;   // undefined on the first drawing: what is there at opening does not slide
    if (mode === 'page') keepPlace();
    let h;
    if (mode === 'page') {
      const card = st.view === 'table' ? tableHtml() : st.view === 'log' ? logHtml() : st.view === 'nodes' ? nodesHtml() : st.split ? panesHtml() : regionsHtml();
      h = `${topHtml()}<div class="st-tray">${trayHtml()}</div><div class="st-right">${card}</div>`;
    } else if (mode === 'line') h = `<div class="st-tray">${trayHtml()}</div>${lineHtml(opts.tag)}`;
    else if (mode === 'tag') h = opts.prop != null ? `${inspHeadHtml(opts)}<div class="st-tray">${trayHtml()}</div>${propLinesHtml(opts.prop)}` : inspHeadHtml(opts) + linesHtml(opts.tag);
    if (st.menu && st.menu.owner === mode) h += menuHtml();
    // What a fold opens rolls out (the grammar), as Threads' rows do: the rows, groups and properties that were not there before.
    const wasShown = st.glide ? new Set([...root.querySelectorAll(KEYED)].map(keyOfShown)) : null;
    root.innerHTML = h;
    if (st.prompt && st.prompt.owner === mode) {
      const at = st.prompt.at || {}, box = (at.within && root.querySelector(at.within)) || root;
      box.insertAdjacentHTML('beforeend', promptHtml());
      const el = box.lastElementChild, room = box.clientWidth + box.scrollLeft - el.offsetWidth - 4;
      el.style.left = `${Math.max(0, Math.min(at.left || 0, room))}px`;
      // Decided once per opening: a picker that would run past the bottom of what shows, and fits above, opens upward from the thing pressed.
      if (st.prompt.up == null) { const bottom = Math.min(box.getBoundingClientRect().bottom, doc.defaultView?.innerHeight || Infinity), t = box.getBoundingClientRect().top - box.scrollTop + (at.top || 0);
        st.prompt.up = at.above != null && t + el.offsetHeight > bottom && at.above - el.offsetHeight >= box.scrollTop; }
      el.style.top = `${st.prompt.up ? at.above - el.offsetHeight : at.top || 0}px`;
    }
    const rolled = wasShown ? [...root.querySelectorAll(KEYED)].filter(e => !wasShown.has(keyOfShown(e))) : [];
    st.glide = false;
    window.PluginDoor.unroll(rolled);
    // The map's lines are measured from where the rows stand: once more when they have rolled out.
    if (rolled.length && mode === 'page') setTimeout(() => { if (root.isConnected) S.regions?.lines(root, M(), st.cur, !!st.aim); }, 200);
    /* The map scrolls with Logseq's page, one scroll bar, nothing cut off at its foot (10 November 2026, the audit's 17: the table
       and the Log stood in a box of their own, with a second scroll bar, and New group was cut off). Only Two panes keeps the
       window's height, since each pane scrolls on its own there. */
    if (mode === 'page') { const panes = !!root.querySelector('.st-panes'), top = root.getBoundingClientRect().top, win = doc.defaultView; root.classList.toggle('st-fill', panes); root.style.height = panes && win?.innerHeight && top >= 0 ? Math.max(360, win.innerHeight - top - 24) + 'px' : ''; }
    slideTray(trayWas);
    if (mode === 'page') S.regions?.lines(root, M(), st.cur, !!st.aim);
    if (scroll) root.querySelector('.st-tree').scrollTop = scroll;
    root.querySelectorAll('.st-pane .st-tree').forEach((t, i) => { if (paneScroll[i]) t.scrollTop = paneScroll[i]; });
    if (scrollA && root.querySelector('.st-regions')) root.querySelector('.st-regions').scrollLeft = scrollA;
    if (scrollR && root.querySelector('.st-right')) root.querySelector('.st-right').scrollTop = scrollR;
    root.querySelector('.st-row.cur')?.scrollIntoView?.({ block: 'nearest' });
    root.querySelector('.st-prompt .lit')?.scrollIntoView?.({ block: 'nearest' });
    const pin = root.querySelector('[data-pin]'), edit = root.querySelector('[data-edit]');
    wantFocus = false;
    if (!hadFocus) return;   // the keyboard is elsewhere, in a bullet being written, say: a draw leaves it there
    const box = finding != null && root.querySelector('[data-find]');
    if (pin && st.prompt.owner === mode) { pin.focus(); pin.setSelectionRange(pin.value.length, pin.value.length); }
    else if (edit && st.edit.owner === mode) { edit.focus(); edit.select(); }
    else if (box) { box.focus(); box.setSelectionRange(finding, finding); }
    else if (finding2 != null && root.querySelector('[data-find2]')) { const b2 = root.querySelector('[data-find2]'); b2.focus(); b2.setSelectionRange(finding2, finding2); }
    else root.focus({ preventScroll: true });
  }

  // The tray rolls out and back when its height changes (the grammar: what opens rolls out), the card moving with it, never with a jump.
  // Every draw makes the tray anew, so the slide runs from the height it had. Empty, it takes no room, so the card itself comes up.
  const SLIDE = { duration: Door.MOTION.tray.ms, easing: Door.MOTION.tray.ease };
  function slideTray(was) {
    const tray = root.querySelector('.st-tray'), now = tray?.offsetHeight;
    if (was == null || was === now || !tray?.animate || Door.still(doc)) return;
    if (!now) { root.querySelector('.st-right')?.animate({ marginTop: [`${was}px`, '0px'] }, SLIDE); return; }
    const box = doc.defaultView.getComputedStyle(tray), from = was ? {} : { paddingTop: ['0px', box.paddingTop], paddingBottom: ['0px', box.paddingBottom], borderBottomWidth: ['0px', box.borderBottomWidth] };
    tray.style.overflow = 'hidden';
    tray.animate({ height: [`${was}px`, `${now}px`], ...from }, SLIDE).onfinish = () => { tray.style.overflow = ''; };
  }

  // The rows a row holds as drawn: those after it, deeper than it, up to the next of its depth or less.
  const depthOf = e => Number(e.style.getPropertyValue('--d')) || 0;
  function rowsUnder(id) {
    const row = [...root.querySelectorAll('.st-row[data-row]')].find(e => e.dataset.row === String(id) && !e.closest('[data-pane="2"]'));
    if (!row) return [];
    const d = depthOf(row), out = [];
    for (let n = row.nextElementSibling; n && !(n.matches('.st-row') && depthOf(n) <= d); n = n.nextElementSibling) out.push(n);
    return out;
  }

  // ---------- going places: the trail, and the window's own history ----------
  const redraw = () => { wantFocus = true; app.draw(); };
  const place = () => ({ view: st.view, cur: st.cur, propCur: st.propCur, nodes: st.nodes });
  /* Every place the map shows is an entry in the window's history (#/structure?at=7), so Logseq's own back and forward, Cmd-[, Cmd-]
     and its arrows at the top, walk the cards as they walk pages, and on out to the page before the map: no key is taken. The address
     changes nothing Logseq draws. The arrow keys down the tree are one step: back goes to where the walk began. */
  const KEPT = 60;   // the window keeps fifty entries
  const shownAt = () => { const m = /[?&]at=(\d+)/.exec(doc.defaultView.location.hash); return m ? Number(m[1]) : null; };
  function keepPlace() {
    const win = doc.defaultView, at = shownAt(), now = { ...place(), trail: [...st.trail] }, walk = st.walking;
    st.walking = false;
    if (!/^#\/structure(\?|$)/.test(win.location.hash)) return;
    if (at !== st.at && st.places.has(at)) { go(st.places.get(at)); st.at = at; return; }   // back or forward landed here
    const was = st.places.get(st.at);
    if (at == null || at !== st.at) {   // the map just opened: this entry becomes the place it shows
      st.at = at ?? app.nextPlace(); st.places.set(st.at, now);
      if (at == null) win.history.replaceState(win.history.state, '', `#/structure?at=${st.at}`);
      return;
    }
    if (samePlace(was, now)) { was.trail = now.trail; return; }
    if (walk && was.walked) { st.places.set(at, { ...now, walked: true }); return; }
    st.at = app.nextPlace(); st.places.set(st.at, { ...now, walked: walk });
    if (st.places.size > KEPT) st.places.delete(st.places.keys().next().value);
    win.location.hash = `#/structure?at=${st.at}`;
  }
  // A place come back to: what it names, if it is still there; what was open on the way lets go.
  function go(p) {
    if (p.cur === LOOSE || M().tags.has(p.cur)) st.cur = p.cur;
    st.propCur = p.propCur && M().props.has(Number(p.propCur.split('·')[1])) ? p.propCur : null;
    st.view = p.view === 'nodes' && !p.nodes ? 'tree' : p.view; st.nodes = p.nodes; st.trail = [...p.trail];
    st.ask = null; st.prompt = null; st.edit = null; st.menu = null;
    if (T(st.cur)) Mo.pathOf(M(), st.cur).slice(0, -1).forEach(a => st.open.add(a));
  }
  const toPlace = () => { if (shownAt() === st.at || !st.places.has(shownAt())) return; wantFocus = !doc.activeElement?.matches('input, textarea, [contenteditable="true"]'); app.draw(); };   // Logseq's arrows keep the keyboard on the map, a bullet being written keeps it
  const samePlace = (a, b) => a.view === b.view && a.cur === b.cur && a.propCur === b.propCur && a.nodes === b.nodes;
  // A jump (a link, a list opened, a property's card): the place left is kept, so Escape comes back to it.
  function jump(fn) { const was = place(); fn(); if (!samePlace(was, place())) { st.trail.push(was); if (st.trail.length > 40) st.trail.shift(); } st.ask = null; redraw(); }
  function back() {
    while (st.trail.length) {
      const p = st.trail.pop();
      if (p.cur != null && p.cur !== LOOSE && !M().tags.has(p.cur)) continue;
      if (p.propCur && !M().props.has(Number(p.propCur.split('·')[1]))) continue;
      Object.assign(st, p); st.ask = null; redraw(); return true;
    }
    return false;
  }
  const goTo = id => { if (!M().tags.has(id) && id !== LOOSE) return; jump(() => { st.cur = id; st.propCur = null; st.view = 'tree'; Mo.pathOf(M(), id).slice(0, -1).forEach(a => st.open.add(a)); }); };
  // Opening rolls the rows under it out; folding rolls them up first, then draws without them.
  const fold = async (id, open) => {
    if (open === undefined) open = !st.open.has(id);
    if (open) st.glide = true; else await window.PluginDoor.rollUp(rowsUnder(id));
    open ? st.open.add(id) : st.open.delete(id); redraw();
  };
  const openAll = id => { const walk = x => { st.open.add(x); Mo.kids(M(), x).forEach(walk); }; walk(id); redraw(); };
  const tick = id => { const t = T(id); if (!t) return; st.ticks.has(id) ? st.ticks.delete(id) : st.ticks.add(id); redraw(); };
  // Where the press was: the element's box in the scrolling box it sits in (content coordinates, so the picker scrolls with its row).
  let pressAt = null, justClosed = null;
  const anchorOf = el => {
    const within = el.closest('.st-tree, .st-right');   // not the areas box: it scrolls sideways and would clip the picker
    const box = within || root, r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const pane = within?.closest('[data-pane]');
    return { within: within ? (pane ? `[data-pane="${pane.dataset.pane}"] .st-tree` : `.${within.classList[0]}`) : null, left: r.left - b.left + box.scrollLeft, top: r.bottom - b.top + box.scrollTop + 4, above: r.top - b.top + box.scrollTop - 4 };
  };
  const samePrompt = (a, b) => !!a && !!b && a.what === b.what && a.prop === b.prop && a.key === b.key && a.tag === b.tag && a.row === b.row && String(a.tags) === String(b.tags);
  const startPrompt = p => { st.menu = null; st.ask = null; if (samePrompt(justClosed, p)) { justClosed = null; return redraw(); } st.prompt = { text: '', lit: 0, owner: mode, at: pressAt, ...p }; redraw(); };
  const startMoveTag = id => { const tags = st.ticks.size > 1 && st.ticks.has(id) ? [...st.ticks] : [id]; if (mode === 'page') return startAim('move', tags); startPrompt({ what: 'tag', list: 'tags', tags, row: id }); };
  // On the page of the whole the areas are the choice: the bar says what is moving, and a press on a tag answers.
  const startAim = (what, tags) => { st.menu = null; st.ask = null; st.aim = { what, tags }; st.find = ''; redraw(); };
  const aimOk = id => { const a = st.aim, t = T(id); if (!a || !t) return false; return a.what === 'move' ? !a.tags.some(s => s === id || Mo.under(M(), id, s)) : !a.tags.includes(id); };
  function finishAim(id) {
    const a = st.aim; if (id !== LOOSE && !aimOk(id)) return;
    st.aim = null; st.find = '';
    if (a.what === 'move') moveTags(a.tags, id);
    else { st.cur = id; st.ask = { merges: a.tags, into: id, owner: mode }; }
    redraw();
  }
  function finishPrompt(row) {
    const p = st.prompt; if (!row || !row.ok) return;
    if (row.more) { p.whole = true; p.had = new Set(p.shown.filter(r => !r.more).map(r => r.key)); wantFocus = true; return redraw(); }
    st.prompt = null;
    if (p.what === 'tag') { moveTags(p.tags, row.key); }
    else if (p.what === 'prop') { const [tagId, pid] = p.key.split('·').map(Number); if (!tagId) { app.stage({ kind: 'addProp', prop: pid, tags: [row.key] }); st.propCur = `${row.key}·${pid}`; st.cur = row.key; } else if (row.key !== tagId) { app.stage({ kind: 'moveProp', prop: pid, from: [tagId], to: row.key }); st.propCur = `${row.key}·${pid}`; st.cur = row.key; } }
    else if (p.what === 'nodes') moveTicked(row.key);
    else if (p.what === 'pmerge') return askMerge([p.prop], row.key);
    else if (p.what === 'pnew') app.openNode(T(row.key)?.uuid);   // Logseq makes properties, not a plugin: its Add tag property is on the tag's page
    else if (p.what === 'range') { const was = P(p.prop).range; if (!was.includes(row.key)) app.stage({ kind: 'setRange', prop: p.prop, to: [...was, row.key] }); }
    else if (p.what === 'split') { const v = p.values.find(x => x.id === row.key); app.nodesWhere(p.tag, P(p.prop).ident, v.id).then(nodes => { const title = v.title.charAt(0).toUpperCase() + v.title.slice(1); app.stage({ kind: 'split', tag: p.tag, name: Mo.titled(M(), title).length ? `${title} ${name(p.tag)}` : title, prop: p.prop, nodes, where: `${P(p.prop).title} is ${v.title}` }); }); }
    else if (p.what === 'addprop') app.stage(p.under ? { kind: 'addProp', prop: row.key, under: p.tag } : { kind: 'addProp', prop: row.key, tags: [p.tag] });
    redraw();
  }
  // The ticked nodes of the list go to a tag, each from the tag it carries. Those landing beneath the list's tag stay in the list: its count still holds them.
  function moveTicked(to) {
    const n = st.nodes, ticked = n.list.filter(x => n.ticks.has(x.uuid)), from = new Map();
    for (const x of ticked) if (x.tag !== to) from.set(x.tag, [...from.get(x.tag) || [], { id: x.id, uuid: x.uuid }]);
    if (![...from].map(([tag, nodes]) => app.stage({ kind: 'retag', from: tag, to, nodes })).some(Boolean)) return;
    if (Mo.under(M(), to, n.tag)) ticked.forEach(x => { x.tag = to; }); else n.list = n.list.filter(x => !n.ticks.has(x.uuid));
    n.ticks.clear();
  }
  // The move itself, from the prompt, a drop or Tab: the tag and everything under it goes under the destination.
  function moveTags(tags, dest) {
    for (const s of tags) { const t = T(s); if (!t || s === dest || (dest !== LOOSE && Mo.under(M(), dest, s)) || (dest === LOOSE ? !t.parents.length : Mo.parentOf(M(), s) === dest)) continue; app.stage({ kind: 'move', tag: s, to: dest }); }
    st.ticks.clear(); st.open.add(dest);
  }
  const startEdit = (what, on, text) => { st.menu = null; st.ask = null; st.edit = { what, on, text, owner: mode }; redraw(); };
  function finishEdit(value) {
    const e = st.edit, v = String(value || '').trim();
    if (e.what === 'pcombine') return v ? combine(v) : (st.edit = null, redraw());
    if (!v || (e.what !== 'new' && e.what !== 'split')) return stageEdit(e, v);
    // A tag made under a name in use would take over what holds it, so the line stays and says so.
    Promise.resolve(Mo.titled(M(), v).length > 0 || app.nameTaken(v)).then(taken => {
      if (st.edit !== e) return;
      if (taken) app.notify(`“${v}” is already in the graph: give the new tag another name`, 'warning'); else stageEdit(e, v);
    });
  }
  // A new top-level tag waits in the tray for its first child tags, one batch (`wait`); any other safe change is written at once.
  function stageEdit(e, v) {
    st.edit = null;
    if (v) {
      if (e.what === 'rename' && v !== name(e.on)) app.stage({ kind: 'rename', tag: e.on, name: v });
      else if (e.what === 'new') { const c = app.stage({ kind: 'make', name: v, under: e.on === LOOSE ? null : e.on }, { wait: e.on === LOOSE }); st.open.add(e.on); if (c?.made != null) { st.cur = c.made; if (mode === 'side') st.cur = c.made; if (e.on === LOOSE) { st.edit = { what: 'kids', on: c.made, text: '', owner: mode }; } } }
      else if (e.what === 'kids') { for (const w of v.split(',').map(x => x.trim()).filter(Boolean)) if (!Mo.titled(M(), w).length) app.stage({ kind: 'make', name: w, under: e.on }); st.open.add(e.on); }
      else if (e.what === 'gnew') { const id = 'g' + Date.now().toString(36); app.changeGroups(`New group ${v}`, G => { G.list.push({ id, name: v, under: null, open: true }); }, id); }
      else if (e.what === 'gname') { const old = app.groups().list.find(x => x.id === e.on)?.name; if (old != null && old !== v) app.changeGroups(`Group ${old} renamed ${v}`, G => { const g = G.list.find(x => x.id === e.on); if (!g) return false; g.name = v; }, e.on); }
      else if (e.what === 'prename') { const [, pid] = e.on.split('·').map(Number); if (v !== P(pid).title) app.stage({ kind: 'renameProp', prop: pid, name: v }); }
      else if (e.what === 'split') {
        const n = st.nodes, ticked = n.list.filter(x => n.ticks.has(x.uuid));
        // Nodes carrying a tag beneath go to the new tag from there, so a new tag is made first.
        if (ticked.some(x => x.tag !== n.tag)) { const c = app.stage({ kind: 'make', name: v, under: n.tag }); if (c) moveTicked(c.made); }
        else { const c = app.stage({ kind: 'split', tag: n.tag, name: v, nodes: ticked.map(x => ({ id: x.id, uuid: x.uuid })) }); if (c) { ticked.forEach(x => { x.tag = c.made; }); n.ticks.clear(); } }
      }
    }
    redraw();
  }
  function act(a, on, shift) {
    st.menu = null; st.ask = null;
    const m = M();
    if (a === 'openall') openAll(on);
    else if (a === 'nodes') openNodes(on);
    else if (a === 'page') { redraw(); app.openNode(T(on)?.uuid, shift); }
    else if (a === 'prename') { const p = P(Number(on.split('·')[1])); if (p) startEdit('prename', on, p.title); else redraw(); }
    else if (a === 'ppage') { redraw(); app.openNode(P(Number(on.split('·')[1]))?.uuid, shift); }
    else if (a === 'main') app.openMain(on);
    else if (a === 'tick') tick(on);
    else if (a === 'move') { if (T(on)) startMoveTag(on); else redraw(); }
    else if (a === 'rename') { if (T(on)) startEdit('rename', on, name(on)); else redraw(); }
    else if (a === 'new') { if (!st.open.has(on)) st.open.add(on); startEdit('new', on, ''); }
    else if (a === 'addprop') { if (T(on)) startPrompt({ what: 'addprop', list: 'props', tag: on, row: on }); }
    else if (a === 'addpropall') { if (T(on)) startPrompt({ what: 'addprop', list: 'props', tag: on, under: true, row: on }); }
    else if (a === 'merge') { const from = [...st.ticks].filter(x => x !== on && T(x)); if (!from.length || !T(on)) return redraw(); st.cur = on; st.view = 'tree'; st.propCur = null; st.ask = { merges: from, into: on, owner: mode }; redraw(); }
    else if (a === 'remove') { const t = T(on); if (!t || Mo.count(m, on) || t.kids.length) return redraw(); const p = Mo.parentOf(m, on); app.stage({ kind: 'remove', tag: on }); if (st.cur === on) st.cur = p ?? Mo.tops(m)[0] ?? m.kinds[0].id; redraw(); }
    else if (a === 'pmove') { const [tagId] = on.split('·').map(Number); startPrompt({ what: 'prop', list: 'tags', key: on, prop: Number(on.split('·')[1]), from: tagId }); }
    else if (a === 'pullup') { const [tagId, pid] = on.split('·').map(Number); const dest = Mo.parentOf(m, tagId); if (dest == null) return redraw(); app.stage({ kind: 'moveProp', prop: pid, from: [tagId], to: dest }); st.propCur = `${dest}·${pid}`; st.cur = dest; redraw(); }
    else if (a === 'pmerge') { const pid = Number(on.split('·')[1]); if (!P(pid)) return redraw(); if (mode === 'page' && st.view === 'table') { st.pticks = new Set([pid, ...st.pticks]); st.paim = true; return redraw(); } startPrompt({ what: 'pmerge', list: 'props', prop: pid }); }
    else if (a === 'prange') { const [, pid] = on.split('·').map(Number); startPrompt({ what: 'range', list: 'tags', prop: pid }); }
        else if (a === 'pdrop') { const [tagId, pid] = on.split('·').map(Number); app.stage({ kind: 'dropProp', prop: pid, tag: tagId }); if (st.propCur === on) st.propCur = null; redraw(); }
    else if (a === 'split') { const [tagId, pid] = on.split('·').map(Number); app.valuesOf(tagId, P(pid).ident).then(values => { if (!values.length) return app.notify(`No ${P(pid).title} values on ${name(tagId)}'s own nodes`, 'warning'); startPrompt({ what: 'split', list: 'values', tag: tagId, prop: pid, values }); }); }
    else if (a === 'nmove') { const n = st.nodes; const nodes = n.list.filter(x => n.ticks.has(x.uuid)); if (nodes.length) startPrompt({ what: 'nodes', list: 'tags', tag: n.tag, nodes }); }
    else if (a === 'nsplit') { if (st.nodes?.ticks.size) startEdit('split', st.nodes.tag, ''); }
    else redraw();
  }
  // A fix, chosen: the ask line opens under the issue (what it would do, the nodes it touches); the second yes stages it.
  function fix(i) {
    const issue = ISS()[i]; if (!issue) return;
    const c = issue.change;
    if (c.kind === 'prompt') {
      if (c.what === 'tag') startMoveTag(c.tag);
      else if (c.what === 'range') startPrompt({ what: 'range', list: 'tags', prop: c.prop });
      else if (c.what === 'rename') { Mo.pathOf(M(), c.tag).slice(0, -1).forEach(a => st.open.add(a)); startEdit('rename', c.tag, c.name); }
      return;
    }
    st.ask = st.ask && st.ask.i === i ? null : { i, owner: mode }; st.menu = null; redraw();
  }
  // The merge's ask, once the values are read: what moves, what stays, what would clash.
  async function askMerge(froms, into, rename) {
    st.paim = false; st.menu = null;
    froms = froms.filter(f => f !== into && P(f)); if (!froms.length || !P(into)) return redraw();
    const preview = await app.mergePreview(froms, into);
    st.ask = { pmerge: { froms, into, preview, rename }, owner: mode }; redraw();
  }
  // Combined: the most held of the picked properties is kept, the others merged into it, and it takes the new name.
  function combine(v) {
    const ids = [...st.pticks].filter(id => P(id)), held = id => M().holders.get(P(id).ident)?.size || 0;
    const into = ids.sort((a, b) => held(b) - held(a))[0];
    if ([...M().props.values()].some(x => x.id !== into && !ids.includes(x.id) && x.title.trim().toLowerCase() === v.toLowerCase())) return app.notify(`“${v}” is another property's name: merge into that one instead`, 'warning');
    st.edit = null; askMerge(ids.filter(id => id !== into), into, v);
  }
  function stageAsk() {
    if (st.ask?.pmerge) { const a = st.ask.pmerge; if (a.preview.some(x => x.clash.length)) return; st.ask = null;
      a.froms.forEach((f, i) => { const x = a.preview[i]; app.stage({ kind: 'mergeProp', prop: f, intoProp: a.into, kept: x.kept, left: x.left, gave: x.gave }); });
      if (a.rename && a.rename !== P(a.into)?.title) app.stage({ kind: 'renameProp', prop: a.into, name: a.rename });
      st.pticks.clear(); return redraw(); }
    if (st.ask?.apply) { st.ask = null; return app.apply(); }
    if (st.ask?.change) { const c = changeAsk(); st.ask = null; if (c) app.stage(c); return redraw(); }
    if (st.ask?.merges) { const { merges, into } = st.ask; st.ask = null; for (const from of merges) app.stage({ kind: 'merge', from, into }); st.ticks.clear(); return redraw(); }
    const issue = st.ask && ISS()[st.ask.i]; st.ask = null; if (!issue) return redraw();
    const c = issue.change;
    app.stage({ ...c });
    if (c.kind === 'merge' && st.cur === c.from) st.cur = c.into;
    if (c.kind === 'remove' && st.cur === c.tag) st.cur = Mo.parentOf(M(), c.tag) ?? Mo.tops(M())[0] ?? null;
    redraw();
  }
  async function openNodes(id) {
    const list = await app.readNodes(id);
    jump(() => { st.nodes = { tag: id, list, ticks: new Set(), all: false, cur: 0 }; st.view = 'nodes'; st.propCur = null; st.cur = id; });
  }
  const show = what => jump(() => { st.view = what; st.propCur = null; st.nodes = null; st.whole.clear(); });   // 'tree' from the views line, 'table', 'health'
  
  // ---------- events ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-ppage],[data-tpage],[data-pfold],[data-pon],[data-prange],[data-all],[data-fold],[data-tick],[data-ptick],[data-paim],[data-paimoff],[data-pcombine],[data-ntick],[data-row],[data-go],[data-open],[data-unrange],[data-addrange],[data-prop],[data-fix],[data-stage],[data-leave],[data-sort],[data-apply],[data-discard],[data-drop],[data-undo],[data-act],[data-do],[data-show],[data-compare],[data-aim],[data-aimtop],[data-aimoff],[data-pick],[data-nodes],[data-more],[data-node],[data-split],[data-gfold],[data-gname],[data-gdrop],[data-gnew],[data-pnew]');
    const outside = st.prompt?.owner === mode && !e.target.closest('.st-prompt');
    if (!t) { if (st.menu || outside) { st.menu = null; if (outside) st.prompt = null; redraw(); } return; }
    if (e.target.matches?.('[data-edit]')) return;   // a click in a field being written stays in the field
    e.stopPropagation(); e.preventDefault();
    pressAt = anchorOf(t); justClosed = null;
    if (t.dataset.act && st.menu) {   // a choice from the menu hangs from the row the menu was for, where the menu opened, not from the item pressed
      const on = String(st.menu.on), row = root.querySelector(st.menu.kind === 'row' ? `.st-row[data-row="${on}"]` : `.tr[data-prop="${on}"], .ont[data-prop="${on}"]`);
      if (row) pressAt = anchorOf(row.querySelector('.nm, .k') || row);
    }
    if (outside) { justClosed = st.prompt; st.prompt = null; setTimeout(() => { if (!st.prompt && root.querySelector('.st-prompt')) draw(); }, 0); }   // a press elsewhere closes the picker, as Logseq's close; the press still acts
    if (t.hasAttribute('data-split')) { st.split = !st.split; return redraw(); }
    // Leaving for a Logseq page lets go of what was being asked here, so nothing waits unseen behind the page; the picks stay.
    const leave = (uuid, shift) => { st.paim = false; st.ask = null; st.menu = null; st.aim = null; st.prompt = null; redraw(); app.openNode(uuid, shift); };
    // While the bar asks "press a property", a press anywhere on a row answers it, a name in the row included.
    if (st.paim && mode === 'page' && st.view === 'table') { const row = t.closest('.st-tbl .tr[data-prop]'); if (row) { const id = Number(row.dataset.prop.split('·')[1]); return st.pticks.has(id) ? undefined : askMerge([...st.pticks], id); } }
    if (t.dataset.pon) return act('pmove', '0·' + t.dataset.pon);
    if (t.dataset.prange) return act('prange', '0·' + t.dataset.prange);
    if (t.dataset.pfold) { const id = Number(t.dataset.pfold); if (st.popen.has(id)) st.popen.delete(id); else { st.popen.add(id); st.glide = true; } return redraw(); }
    if (t.dataset.ppage) return leave(P(Number(t.dataset.ppage.split('·')[1]))?.uuid, e.shiftKey);
    if (t.dataset.tpage) return leave(T(keyOf(t.dataset.tpage))?.uuid, e.shiftKey);
    if (t.dataset.gfold) { const G = app.groups(), g = G.list.find(x => x.id === t.dataset.gfold); if (g) { g.open = g.open === false; if (g.open) st.glide = true; app.saveGroups(G); } return redraw(); }
    if (t.dataset.gname) { const g = app.groups().list.find(x => x.id === t.dataset.gname); return g ? startEdit('gname', g.id, g.name) : redraw(); }
    if (t.hasAttribute('data-gnew')) return startEdit('gnew', '', '');
    if (t.hasAttribute('data-pnew')) return startPrompt({ what: 'pnew', list: 'tags', row: null });
    if (t.dataset.gdrop) {   // the group goes; what it held goes up a level, nothing else changes
      const drop = t.dataset.gdrop, gone = app.groups().list.find(x => x.id === drop); if (!gone) return redraw();
      app.changeGroups(`Group ${gone.name} taken away`, G => {
        const g = G.list.find(x => x.id === drop); if (!g) return false;
        for (const k of G.list) if (k.under === g.id) k.under = g.under ?? null;
        for (const [ident, id] of Object.entries(G.of)) if (id === g.id) { if (g.under) G.of[ident] = g.under; else delete G.of[ident]; }
        G.list = G.list.filter(x => x !== g);
      }, gone.under);
      return redraw();
    }
    if (t.dataset.fold) { if (t.closest('[data-pane="2"]')) { const id = keyOf(t.dataset.fold), o = st.pane2.open; if (o.has(id)) o.delete(id); else { o.add(id); st.glide = true; } return redraw(); } return fold(keyOf(t.dataset.fold)); }
    if (t.dataset.tick) return tick(keyOf(t.dataset.tick));
    if (t.dataset.ptick) { const id = Number(t.dataset.ptick); st.pticks.has(id) ? st.pticks.delete(id) : st.pticks.add(id); return redraw(); }
    if (t.hasAttribute('data-paim')) { st.paim = true; st.ask = null; return redraw(); }
    if (t.hasAttribute('data-paimoff')) { st.paim = false; if (st.edit?.what === 'pcombine') st.edit = null; return redraw(); }
    if (t.hasAttribute('data-pcombine')) return startEdit('pcombine', '', '');
    if (t.dataset.ntick) { const x = st.nodes.list[+t.dataset.ntick]; st.nodes.ticks.has(x.uuid) ? st.nodes.ticks.delete(x.uuid) : st.nodes.ticks.add(x.uuid); st.nodes.cur = +t.dataset.ntick; return redraw(); }
    if (t.dataset.open) return leave(t.dataset.open, e.shiftKey);
    if (t.dataset.go) return leave(T(keyOf(t.dataset.go))?.uuid, e.shiftKey);
    if (t.dataset.aim) return startAim(t.dataset.aim, [...st.ticks]);
    if (t.hasAttribute('data-aimtop')) return finishAim(LOOSE);
    if (t.hasAttribute('data-aimoff')) { st.aim = null; return redraw(); }
    if (t.hasAttribute('data-compare')) { st.compare = !st.compare; return redraw(); }
    if (t.dataset.unrange) { const pid = Number(t.dataset.unprop ?? opts.prop); app.stage({ kind: 'setRange', prop: pid, to: P(pid).range.filter(id => id !== Number(t.dataset.unrange)) }); return redraw(); }
    if (t.dataset.addrange) { const pid = Number(t.dataset.addrange.split('·')[1]); return startPrompt({ what: 'range', list: 'tags', prop: pid }); }
    if (t.dataset.fix) return fix(+t.dataset.fix);
    if (t.hasAttribute('data-stage')) return stageAsk();
    if (t.hasAttribute('data-leave')) { st.ask = null; return redraw(); }
    if (t.dataset.sort) { st.sort = t.dataset.sort; return redraw(); }
    if (t.dataset.prop && st.paim && mode === 'page') { const id = Number(t.dataset.prop.split('·')[1]); return st.pticks.has(id) ? undefined : askMerge([...st.pticks], id); }
    if (t.dataset.prop) { if (mode !== 'page') return; const [tagId] = t.dataset.prop.split('·').map(Number); st.propCur = t.dataset.prop; if (T(tagId)) st.cur = tagId; st.menu = null; return redraw(); }   // the rest of a row selects
    if (t.dataset.do) return act(t.dataset.do, t.dataset.do.startsWith('p') && t.dataset.do !== 'page' || t.dataset.do === 'split' ? t.dataset.on : keyOf(t.dataset.on), e.shiftKey);
    if (t.dataset.show) return show(t.dataset.show);
    if (t.dataset.pick) return finishPrompt(st.prompt.shown[+t.dataset.pick]);
    if (t.dataset.act) return act(t.dataset.act, st.menu.on, e.shiftKey);
    if (t.dataset.nodes) return openNodes(keyOf(t.dataset.nodes));
    if (t.hasAttribute('data-more')) { st.nodes.all = true; return redraw(); }
    if (t.dataset.all) { st.whole.add(t.dataset.all); return redraw(); }
    if (t.dataset.node) { st.nodes.cur = +t.dataset.node; return redraw(); }
    if (t.hasAttribute('data-apply')) return pressApply();
    if (t.hasAttribute('data-discard')) return app.discard();
    if (t.dataset.drop !== undefined) return app.dropChange(+t.dataset.drop);
    if (t.dataset.row) { const id = keyOf(t.dataset.row); st.menu = null; if (st.aim && mode === 'page') return finishAim(id); st.cur = id; st.propCur = null; st.view = 'tree'; st.nodes = null; st.trail = []; st.ask = null; return redraw(); }   // a press on the tree starts a new way: the trail is for jumps
  });
  const keyOf = s => s === LOOSE ? LOOSE : Number(s);
  /* Dragging a row onto another moves the tag there, the same as "move under…": the tag and everything under it, the ticked
     tags together when the dragged one is ticked. The row under the pointer shows a line where the tag will go; a row the
     tag cannot go under (itself, anything under it) takes no drop. The move waits in the tray like every change. */
  const dragOf = e => { const r = e.target.closest?.('[data-row]'); return r ? keyOf(r.dataset.row) : null; };
  const canDrop = dest => st.drag && dest != null && (dest === LOOSE ? st.drag.tags.some(s => T(s)?.parents.length) : !st.drag.tags.some(s => s === dest || Mo.under(M(), dest, s)));
  /* In Every property a property or a group is dragged onto a group's name (or "No group"): only the groups change, kept on
     this computer, and the property itself stays as it is. A group cannot go inside itself or a group within it. */
  const gTarget = e => e.target.closest?.('.st-tbl [data-group]');
  const gWithin = (G, id, of) => { for (let g = G.list.find(x => x.id === id); g; g = G.list.find(x => x.id === g.under)) if (g.id === of) return true; return false; };
  const gCanDrop = el => { const d = st.gdrag; if (!d || !el) return false; const to = el.dataset.group; return d.group == null || (to !== d.group && !(to && gWithin(app.groups(), to, d.group))); };
  root.addEventListener('dragstart', e => {
    const gp = e.target.closest?.('.st-tbl [data-gprop]'), gh = e.target.closest?.('.st-tbl .st-grp[data-group]:not(.none)');
    if (gp || gh) {
      e.stopPropagation();
      st.gdrag = gp ? { prop: gp.dataset.gprop } : { group: gh.dataset.group };
      try { e.dataTransfer.setData('text/plain', (gp || gh).textContent.trim().slice(0, 60)); e.dataTransfer.effectAllowed = 'move'; } catch (error) { /* a test's plain event */ }
      (gp || gh).classList.add('dragging'); root.setAttribute('data-dragging', '');
      return;
    }
    const id = dragOf(e); const t = id != null && T(id);
    if (!t) { e.preventDefault(); return; }
    e.stopPropagation();
    st.drag = { tags: st.ticks.size > 1 && st.ticks.has(id) ? [...st.ticks] : [id], owner: mode };
    try { e.dataTransfer.setData('text/plain', t.title); e.dataTransfer.effectAllowed = 'move'; } catch (error) { /* a test's plain event */ }
    e.target.closest('[data-row]').classList.add('dragging');
    root.setAttribute('data-dragging', '');
  });
  root.addEventListener('dragover', e => {
    if (st.gdrag) {
      const el = gTarget(e); if (!gCanDrop(el)) return;
      e.preventDefault(); e.stopPropagation();
      try { e.dataTransfer.dropEffect = 'move'; } catch (error) { /* ditto */ }
      if (!el.classList.contains('over')) { for (const o of root.querySelectorAll('.over')) o.classList.remove('over'); el.classList.add('over'); }
      return;
    }
    const dest = dragOf(e); if (!canDrop(dest)) return;
    e.preventDefault(); e.stopPropagation();
    try { e.dataTransfer.dropEffect = 'move'; } catch (error) { /* ditto */ }
    const row = e.target.closest('[data-row]');
    if (!row.classList.contains('over')) { for (const o of root.querySelectorAll('.st-row.over')) o.classList.remove('over'); row.classList.add('over'); row.dataset.word = dest === LOOSE ? '' : `under ${name(dest)}`; }
  });
  // The ring goes only when the pointer is off its row: moving onto a word inside the row also reports leaving it.
  root.addEventListener('dragleave', e => { const row = e.target.closest?.('[data-row]'); if (row && doc.elementFromPoint(e.clientX, e.clientY)?.closest('[data-row]') !== row) row.classList.remove('over'); });
  root.addEventListener('drop', e => {
    if (st.gdrag) {
      const el = gTarget(e), d = st.gdrag; if (!gCanDrop(el)) return;
      e.preventDefault(); e.stopPropagation(); st.gdrag = null;
      const to = el.dataset.group || null, Gn = app.groups(), toName = to ? Gn.list.find(x => x.id === to)?.name : 'No group';
      const what = d.prop != null ? (M().byIdent.get(d.prop)?.title || 'A property') : `Group ${Gn.list.find(x => x.id === d.group)?.name || ''}`.trim();
      app.changeGroups(`${what} moved to ${toName}`, G => {
        if (d.prop != null) { if (to) G.of[d.prop] = to; else delete G.of[d.prop]; }
        else { const g = G.list.find(x => x.id === d.group); if (g) { g.under = to; G.list = [...G.list.filter(x => x !== g), g]; } }
        if (to) { const g = G.list.find(x => x.id === to); if (g) g.open = true; }
      }, to || d.group);
      redraw(); return;
    }
    const dest = dragOf(e); if (!canDrop(dest)) return;
    e.preventDefault(); e.stopPropagation();
    const tags = st.drag.tags; st.drag = null;
    moveTags(tags, dest); st.cur = tags[0]; redraw();
  });
  root.addEventListener('dragend', () => { st.drag = null; st.gdrag = null; root.removeAttribute('data-dragging'); for (const o of root.querySelectorAll('.over, .dragging')) o.classList.remove('over', 'dragging'); });
  // The right-click menu, on a row or a property line; it acts on what was clicked and leaves the cursor where it is.
  root.addEventListener('contextmenu', e => {
    const r = e.target.closest('[data-row]'), p = e.target.closest('[data-prop]');
    if (!r && !p) return;
    e.preventDefault(); e.stopPropagation();
    const box = root.getBoundingClientRect();
    st.menu = { kind: r ? 'row' : 'prop', on: r ? keyOf(r.dataset.row) : p.dataset.prop, x: e.clientX - box.left, y: e.clientY - box.top, owner: mode };
    st.ask = null; st.prompt = null;
    redraw();
  });
  // The pointer moves the prompt's lit row (as Logseq's picker does), so one row is lit for keys and mouse alike; no redraw, the classes
  // move. Only a pointer that really moved counts: a redraw puts a new row under a resting pointer, and that must not undo an arrow key.
  let lastAt = null;
  root.addEventListener('mousemove', e => {
    const at = `${e.clientX},${e.clientY}`; if (at === lastAt) return; lastAt = at;
    const r = st.prompt?.owner === mode && e.target.closest?.('.st-prompt [data-pick]'); if (!r) return;
    const i = +r.dataset.pick, p = st.prompt; if (i === p.lit || !p.shown?.[i]?.ok) return;
    p.lit = i; root.querySelectorAll('.st-prompt .lit').forEach(x => x.classList.remove('lit')); r.classList.add('lit');
  });
  root.addEventListener('input', e => {
    if (e.target.matches('[data-find]')) { st.find = e.target.value; draw(); if (lightFirst()) draw(); }
    else if (e.target.matches('[data-find2]')) { st.pane2.find = e.target.value; draw(); }
    else if (e.target.matches('[data-pin]')) { st.prompt.text = e.target.value; st.prompt.lit = 0; draw(); }
    else if (e.target.matches('[data-edit]')) st.edit.text = e.target.value;
  });
  /* The map behaves as a page of Logseq's (the owner, 5 November 2026): a letter typed is Logseq's, so its letter pairs (g j, t w) run
     here as anywhere, and so do its two-key shortcuts: Cmd-K, Cmd-Shift-P, Cmd-[ and Cmd-]. The map keeps only the keys every list
     has (arrows, Enter, Escape, Tab, space) and those it does itself, each what Logseq's does on a page: Cmd-F puts the caret in the
     find line, Cmd-O goes to the row's page (Shift: the sidebar, as Shift-Enter), Cmd-Down and Cmd-Up open and fold, Cmd-Z takes back.
     A field keeps what writing in it needs. */
  const FIELD = /^(a|c|f|v|x|y|z|enter|backspace)$/i, OWN = mode === 'page' ? /^(f|o|enter|backspace|arrowup|arrowdown)$/i : /^(f|o|arrowup|arrowdown)$/i;
  const passes = e => {
    if (doc.querySelector('.ui__dialog-overlay')) return true;   // one of Logseq's windows stands over the map: its keys are all Logseq's
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return (e.metaKey || e.ctrlKey) && !e.altKey && !FIELD.test(e.key);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) return e.key.length === 1 && e.key !== ' ';   // a letter is Logseq's; the list's keys stay here
    return e.altKey || !OWN.test(e.key);
  };
  const standing = () => st.prompt?.owner === mode || st.edit?.owner === mode || !!st.ask;
  for (const type of ['keyup', 'keypress']) root.addEventListener(type, e => { if (TAGISH && !standing()) return; if (!passes(e)) e.stopPropagation(); });
  // Where Cmd-O and Shift-Enter go: the node or property on screen, else the row the cursor is on.
  /* What the find box lights: the first row its letters leave, a tag in the outline, a property in Every property. lightFirst
     moves the cursor there and says whether it moved; lit says whether anything is listed for the letters. */
  const firstProp = () => (st.view === 'table' && mode === 'page' ? root.querySelector('.st-tbl .tr[data-prop]')?.dataset.prop || null : null);
  const firstTag = () => (st.view !== 'tree' ? null : visibleRows().find(r => !r.dim && r.n !== LOOSE)?.n ?? null);
  const lit = () => (st.view === 'table' && mode === 'page' ? !!firstProp() : firstTag() != null);
  function lightFirst() {
    if (!st.find.trim()) return false;
    if (st.view === 'table' && mode === 'page') { const key = firstProp(); if (!key || st.propCur === key) return false; st.propCur = key; return true; }
    const to = firstTag(); if (to == null || st.cur === to) return false; st.cur = to; if (mode === 'page') st.propCur = null; return true;
  }
  function openHere(inSidebar) {
    const n = st.view === 'nodes' && mode === 'page' ? st.nodes?.list[st.nodes.cur] : null, pid = mode === 'page' && st.propCur ? Number(st.propCur.split('·')[1]) : null;
    app.openNode(n?.uuid || (pid != null ? P(pid)?.uuid : T(st.cur)?.uuid), inSidebar);
  }
  root.addEventListener('keydown', e => {
    if (TAGISH && !standing()) return;
    if (!passes(e)) e.stopPropagation(); else if (doc.querySelector('.ui__dialog-overlay')) return;
    const k = e.key;
    if (st.prompt && st.prompt.owner === mode) {
      if (k === 'Escape') { if (st.prompt.text) { st.prompt.text = ''; st.prompt.lit = 0; draw(); } else { st.prompt = null; redraw(); } }   // one step at a time: the typed text, then the prompt
      else if (k === 'ArrowDown' || k === 'ArrowUp') { const rows = st.prompt.shown || [], by = k === 'ArrowDown' ? 1 : -1; for (let i = st.prompt.lit + by; rows[i]; i += by) if (rows[i].ok) { st.prompt.lit = i; break; } e.preventDefault(); draw(); }
      else if (k === 'Enter') { e.preventDefault(); finishPrompt(st.prompt.shown?.[st.prompt.lit]); }
      else if (k === 'Tab') { e.preventDefault(); st.prompt = null; redraw(); }   // Tab leaves the picker, as it leaves Logseq's own
      return;
    }
    if (st.edit && st.edit.owner === mode && e.target.matches('[data-edit]')) {
      if (k === 'Escape') { st.edit = null; redraw(); } else if (k === 'Enter') { e.preventDefault(); finishEdit(e.target.value); }
      return;
    }
    if (e.target.matches('[data-find2]')) { if (k === 'Escape') { st.pane2.find = ''; redraw(); } return; }
    if (e.target.matches('[data-find]')) {
      // The find box works as Find does (the owner, 9 and 12 November 2026): letters light the first match, Enter opens it
      // (Shift Enter in the sidebar), Escape empties the box.
      if (k === 'Escape') { st.find = ''; redraw(); }
      else if (k === 'Enter') { e.preventDefault(); if (st.find.trim() && (lightFirst(), lit())) openHere(e.shiftKey); }
      else if (k === 'ArrowDown') { e.preventDefault(); lightFirst(); redraw(); }
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    if ((k === 'Enter' || k === ' ') && e.target.closest?.('[data-gdrop]')) { e.preventDefault(); e.target.closest('[data-gdrop]').click(); return; }
    if (st.menu && k === 'Escape') { st.menu = null; redraw(); return; }
    if (st.paim && mode === 'page' && k === 'Escape') { e.preventDefault(); st.paim = false; return redraw(); }
    if (st.aim && mode === 'page') { if (k === 'Escape') { e.preventDefault(); st.aim = null; return redraw(); } if (k === 'Enter') { e.preventDefault(); return finishAim(st.cur); } }
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const l = k.toLowerCase();
      if (mode === 'page' && k === 'Enter' && app.tray.changes.length) { e.preventDefault(); pressApply(); }
      else if (mode === 'page' && k === 'Backspace' && app.tray.changes.length) { e.preventDefault(); app.discard(); }
      else if (l === 'f') { e.preventDefault(); const f = root.querySelector('[data-find]'); f.focus(); f.select(); }
      else if (l === 'o') { e.preventDefault(); openHere(e.shiftKey); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); fold(st.cur, k === 'ArrowDown'); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (st.ask && mode === 'page') {
      if (k === 'Enter') { e.preventDefault(); return stageAsk(); }
      if (k === 'Escape') { e.preventDefault(); st.ask = null; return redraw(); }
    }
    if (TAGISH) return;
    if (st.view === 'nodes' && mode === 'page') {
      const n = st.nodes, shown = n.all ? n.list : n.list.slice(0, 20);
      if (k === 'ArrowDown') n.cur = Math.min(shown.length - 1, n.cur + 1);
      else if (k === 'ArrowUp') n.cur = Math.max(0, n.cur - 1);
      else if (k === ' ') { const x = shown[n.cur]; if (x) n.ticks.has(x.uuid) ? n.ticks.delete(x.uuid) : n.ticks.add(x.uuid); }
      else if (k === 'Enter') { openHere(e.shiftKey); return; }
      else if (k === 'Escape') { e.preventDefault(); if (!back()) { st.view = 'tree'; st.nodes = null; redraw(); } return; }
      else return;
      e.preventDefault(); redraw(); return;
    }
    const rows = visibleRows().map(r => r.n), i = rows.indexOf(st.cur);
    const cur = T(st.cur), none = !cur || st.cur === LOOSE;
    const walked = to => { st.cur = to; if (mode === 'page') { st.propCur = null; st.walking = true; if (st.view === 'tree') st.trail = []; } };   // the arrows are the tree, as a press on it is
    if (k === 'ArrowDown') walked(rows[Math.min(rows.length - 1, i + 1)]);
    else if (k === 'ArrowUp') walked(rows[Math.max(0, i - 1)]);
    else if (k === 'ArrowRight') { if (e.shiftKey) { openAll(st.cur); return; } if (Mo.kids(M(), st.cur).length) st.open.add(st.cur); }
    else if (k === 'ArrowLeft') { if (st.open.has(st.cur)) st.open.delete(st.cur); else if (Mo.parentOf(M(), st.cur) != null) walked(Mo.parentOf(M(), st.cur)); }
    else if (k === 'Enter') { if (e.shiftKey) openHere(true); else if (st.propCur && st.view === 'table') openHere(false); else if (st.view !== 'tree' || st.propCur) jump(() => { st.view = 'tree'; st.propCur = null; st.nodes = null; }); else if (cur) app.openNode(cur.uuid, false); return; }
    else if (k === ' ' && mode === 'page') { tick(st.cur); return; }
    else if (k === 'Escape') {
      // The ladder: let go of what is nearest first (the find text, the ticks), then walk back the trail; with nothing left, the
      // keyboard goes back to Logseq: the map lets go of the focus, so arrows and Enter are Logseq's again.
      if (st.find) st.find = ''; else if (mode === 'page' && st.popen.size) st.popen.clear(); else if (mode === 'page' && st.ticks.size) st.ticks.clear(); else if (mode === 'page' && back()) return; else { e.preventDefault(); root.blur(); return; }
    }
    else if (k === 'Tab') { if (none) return; const p = Mo.parentOf(M(), st.cur); if (p == null) return; e.preventDefault(); const sib = Mo.kids(M(), p), j = sib.indexOf(st.cur); if (e.shiftKey) { const gp = Mo.parentOf(M(), p); if (gp != null) { app.stage({ kind: 'move', tag: st.cur, to: gp }); st.ticks.delete(st.cur); } } else if (j > 0) { app.stage({ kind: 'move', tag: st.cur, to: sib[j - 1] }); st.open.add(sib[j - 1]); st.ticks.delete(st.cur); } redraw(); return; }
    else return;
    e.preventDefault(); redraw();
  });

  // Back and forward landing on another place of the map; Cmd-Z, wherever the keyboard is but in words being written.
  const win = doc.defaultView;
  const undoKey = e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !/^[zy]$/i.test(e.key) || doc.querySelector('.ui__dialog-overlay') || doc.activeElement?.matches('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) app.takeBack();
  };
  const offs = mode === 'page' ? [S.base.listen(win, 'hashchange', toPlace), S.base.listen(doc, 'keydown', undoKey, true), S.base.listen(win, 'resize', draw)] : [];
  const view = { root, mode, tag: opts.tag, prop: opts.prop, draw, destroy: () => { app.views.delete(view); for (const off of offs.splice(0)) off(); root.remove(); }, focus: () => { if (TAGISH) return; if (!doc.activeElement?.matches('input, textarea, [contenteditable="true"]')) root.focus({ preventScroll: true }); } };
  app.views.add(view);
  return view;
}

S.view = { make, ensureStyle, CSS, pi };
})();
