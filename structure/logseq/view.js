/* Structure's screens, drawn in three places. The page of the whole (mode 'page'): each top-level tag an area, its tags a small
   outline, the relationships as lines between them, the tray on top. A tag's own page in Logseq (mode 'tag'): five short lines above
   Logseq's table saying what surrounds the tag, then what Structure suggests. The right sidebar (mode 'side'): the outline alone.
   Every property, a property's card, a tag's nodes and the log open in the place of the areas. Nothing a single letter does: letters
   typed on the outline find a tag; what a thing can take is in its right-click menu. A fix first says what it would do, with the nodes
   it touches, and is staged only on a second yes. A change waiting is pencilled in where it will happen. It is drawn into Logseq's own
   document, so the shared names (lk-row, lk-fold, lk-list, lk-tick, lk-node, lk-undo) sit on what they name and carry no look here. */
(function () {
const S = window.Structure;
const Mo = S.model, R = S.rules;
const { LOOSE } = Mo;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Logseq's fold chevron, as it draws it: a small right-pointing angle that turns down when open.
const CHEVRON = `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2 7 5 3.5 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// The four marks and the icon of what a property holds are the door's, as for every module.
const Door = window.PluginDoor;
const SORTS = { E: 'entity', O: 'occurrence', P: 'phenomenon', I: 'information' }, KIND_OF = { rel: 'node', num: 'number', date: 'date', choice: 'choice', text: 'text' };
const km = k => k ? `<svg class="st-km" viewBox="0 0 10 10" aria-hidden="true">${Door.MARKS[SORTS[k]] || ''}</svg>` : '<span></span>';
const pi = p => `<i class="st-pi" aria-hidden="true">${Door.kindIconHtml(KIND_OF[Mo.propKind(p)])}</i>`;
const day = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const dayWords = d => d ? day(new Date(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100).getTime()) : '';   // a journal day, 20261023

// The icon of a press: by what it does, and for a fix by its first word.
const ACT_ICON = { page: 'go', ppage: 'go', rename: 'rename', prename: 'rename', move: 'move', pmove: 'move', new: 'child', addprop: 'plus', addpropall: 'plus', merge: 'merge', remove: 'bin', pullup: 'up', split: 'split', pdrop: 'minus' };
const fixIcon = word => [[/^(remove|delete)/i, 'bin'], [/^drop/i, 'minus'], [/^(pull|lift)/i, 'up'], [/^(move|place|put)/i, 'move'], [/^merge/i, 'merge'], [/^rename/i, 'rename'], [/^(add|new)/i, 'plus']].find(([re]) => re.test(word))?.[1] || 'tick';
const CSS = `
.st { --st-quiet: currentColor; --st-faint: var(--lk-faint); --st-hair: var(--lk-hair); --st-line: var(--lk-line); --st-wash: var(--lk-wash);
  --st-ring: color-mix(in srgb, currentColor 11%, transparent); --st-mono: var(--lk-mono);
  color: var(--lk-text, #222); font-size: 14px; line-height: 1.5; outline: none; position: relative; }
.st * { box-sizing: border-box; }
.st-page { display: flex; flex-direction: column; height: 600px; min-height: 360px; }
.st-top { display: flex; align-items: center; gap: 18px; padding: 0 22px 8px 6px; min-height: 37px; }
.st-acts { display: flex; align-items: center; gap: 8px; padding: 0 22px 10px 6px; min-height: 38px; }
.st-acts .lk-said { font-weight: 600; margin-right: 8px; } .st-acts .say { margin-right: 8px; }
.st-acts .waits { opacity: .45; pointer-events: none; }
.st-top .st-views, .st-top .st-pick { margin: 0; flex: none; } .st-top .st-pick { gap: 8px; } .st-top .lk-said { margin-right: 8px; } .st-top .st-find { margin: 0; flex: 0 1 200px; min-width: 80px; }
.st-top .st-new { margin-left: auto; white-space: nowrap; flex: none; }
/* The areas: one line of columns, a band above them for the lines that cross, gaps wide enough for the lines between neighbours. */
.st-regions { position: relative; display: flex; gap: 48px; padding: 30px 30px 12px 6px; overflow-x: auto; min-width: 0; }
.st-area { flex: 1 0 220px; min-width: 220px; max-width: 320px; position: relative; z-index: 1; }
.st-regions .st-lines { position: absolute; left: 0; top: 0; pointer-events: none; color: var(--lk-text, #222); }
.st-regions .st-row { grid-template-columns: 14px 14px 12px minmax(0, 1fr) 40px 8px; }
.st-regions .st-row.kind .nm { font-weight: 600; }
.st-regions .st-row .nm { overflow-wrap: normal; }
.st-regions .st-row.cur { font-weight: 600; } .st-regions .st-row.cur::before { display: none; }
.st-regions .st-prompt { background: var(--lk-paper, #fff); position: relative; z-index: 2; }
/* The tag you are on, under the areas: its name opens its page; its relationships; what Structure suggests. */
.st-focus { padding: 16px 6px 24px; border-top: 1px solid var(--st-hair); margin-top: 6px; max-width: 760px; }
.st-focus .f-h { font-weight: 600; margin-bottom: 8px; }
.st-rel { display: grid; grid-template-columns: auto auto auto; gap: 3px 14px; justify-content: start; align-items: baseline; font-size: 14px; }
.st-rel .self { font-weight: 700; color: inherit; } .st-rel .gap { grid-column: 1 / -1; height: 6px; } .st-rel .all { grid-column: 1 / -1; }
.st-rel .num, .st-lines-t .num { font-variant-numeric: tabular-nums; }
/* A tag's own page: the lines above Logseq's table. */
.st-tagholder { min-width: 0; }
.page-inner:has(> .st-tagholder) .lk-path { display: none; }   /* the Extends line says it */
.st-tag { font-size: 14px; }
.st-page .st-tray { padding-left: 6px; }
.st-tag .st-tray { padding: 0 0 10px; margin-bottom: 12px; }
.st-lines-t { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 8px 14px; margin: 0; }
.st-lines-t dt { font-weight: 600; } .st-lines-t dd { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; min-width: 0; }
.st-lines-t .chev { font-size: 11px; margin-left: 3px; }
.st-tag .sug { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; padding-top: 12px; }
.st-tag .st-prompt { margin-left: 118px; }
.st-lines-t dd.col { display: grid; gap: 3px; justify-items: start; }
.st-lines-t .ont { display: grid; grid-template-columns: 170px 70px auto; gap: 0 14px; align-items: baseline; }
.st-lines-t .ont.kid { padding-left: 16px; } .st-lines-t .ont.kid .lk-tag { margin-right: -16px; }
.st-lines-t .ont .num { font-variant-numeric: tabular-nums; text-align: right; }
.st-lines-t .ont .acts-r { display: flex; gap: 2px; }
.st-lines-t .ont { padding-block: 2px; }
.st-tag .sug { align-items: center; } .st-rel .lk-more { margin-top: 2px; }
.st-lines-t .rg { display: inline-flex; gap: 4px; align-items: baseline; }
.st-tag .st-in { max-width: 240px; }
.st-lines-t .to { margin: 0 .35em; }
.st-sb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; font-size: 13.5px; margin: 10px 0 2px; }
.st-sb .h { font-weight: 600; margin-bottom: 4px; } .st-sb .o { padding-left: calc(var(--d, 0) * 16px); }
.st-tray .links { font-variant-numeric: tabular-nums; }
.st-log .ln { display: grid; grid-template-columns: 120px minmax(0, 1fr) 110px; gap: 0 12px; padding: 4px 0; border-bottom: 1px solid var(--st-hair); font-size: 13.5px; }
.st-left { grid-row: 1 / -1; border-right: 1px solid var(--st-hair); padding: 12px 10px 12px 14px; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.st-right { flex: 1; padding: 0 22px 56px 6px; min-width: 0; min-height: 0; overflow: auto; container-type: inline-size; }
.st-side .st-left { border: 0; padding: 4px 4px 8px 6px; }
/* The tray stands on top of the card, where a change is made, above what scrolls, so Apply is always in reach. The card's foot keeps clear of Logseq's help button, which stands over that corner. */
.st-tray { border-bottom: 1px solid var(--st-hair); padding: 10px 22px 10px 26px; font-size: 14px; min-width: 0; }
.st-tray:empty { display: none; }
.st-tray .st-wait { overflow: visible; } .st-tray .st-wait .links + .lk-low, .st-tray .st-wait .links + .lk-accent { margin-left: auto !important; } .st-tray .st-wait { gap: 6px 8px; } 
.st-tray .tl { display: grid; gap: 1px; min-width: 0; margin-bottom: 8px; }
/* A line of the tray: the sentence, then in a column of its own how many nodes it affects, so the two are never read as one. */
.st-tray .tl > span { display: grid; grid-template-columns: minmax(0, 1fr) max-content 16px; gap: 0 12px; align-items: baseline; color: var(--lk-text, #222); font-size: 13.5px; }
.st-tray .tl span i { color: var(--st-quiet); font-style: normal; font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-tray .tl .lk-x { justify-self: end; padding: 0 2px; }
.st-tray .st-wait .lk-accent { padding: 2px 6px; margin: 0 -6px; }
.st-tray .ky { font-weight: 400; font-size: 12px; margin-left: 6px; }
/* The yes to what Undo cannot put back whole (the library's), under the lines it answers for. */
/* A count that opens its nodes: what opens has an underline. */
.st-card .sum .lk-lone { padding: 0; margin: 0; text-decoration: underline; text-decoration-color: var(--st-line, var(--lk-line)); text-underline-offset: 3px; }
.st-card .sum .lk-lone:hover { background: none; text-decoration-color: currentColor; }
/* A question, wherever it opens (the library's): what it asks, what follows from it, the answers; joined by a line from the margin. */
.st-q { margin: 6px 0 16px; padding-left: 12px; border-left: 2px solid var(--st-hair); max-width: 640px; }
.st-tray .st-q { margin: 8px 0 2px; max-width: none; }
.st-q .h { font-weight: 600; } .st-q .l { color: var(--st-quiet); font-size: 13.5px; }
.st-q .lk-answers { margin-top: 6px; } .st-q .lk-hint { white-space: normal; }
/* st-done, not done: Logseq strikes through its own .done (a finished task). */
.st-tray .st-saying { display: flex; gap: 16px; justify-content: flex-end; }
.st-tray .st-done, .st-tray .note { color: var(--st-quiet); white-space: nowrap; font-size: 13.5px; }   /* the Undo arrow waits at the right, at the top of the card (the grammar) */
.st-tray .st-wait + .tl + .st-saying, .st-tray .st-wait + .tl + .more + .st-saying { margin-top: 4px; }
.st-tray .st-done .lk-undo { cursor: pointer; margin-left: 6px; font-size: 16px; }
.st-tray .busy { color: var(--st-faint); }
.st-find { border-bottom: 1px solid var(--st-line); color: var(--st-faint); font-size: 13.5px; display: flex; min-height: 24px; padding: 0 2px; margin: 0 0 10px; align-items: center; gap: 6px; }
.st-find input, .st-in { all: unset; flex: 1; color: var(--lk-text, #222); min-width: 0; font: inherit; }
.st-find input::placeholder { color: var(--st-faint); }
.st-find .n { font-size: 12px; color: var(--st-faint); font-variant-numeric: tabular-nums; }
.st-in { border-bottom: 1px solid var(--st-line); width: 100%; }
.st-tree { flex: 1; min-height: 0; overflow: auto; }
/* A row is built as Logseq builds a block (the grammar): the tick in the margin, the fold arrow shown under the pointer, the
   bullet ringed while folded, then the mark and the name; at the right edge only what tells the rows apart (here the count). */
/* A long name wraps like text, so the row's pieces stand at its first line. Each level is one step in, as deep as the tree goes. */
.st-row { display: grid; grid-template-columns: 14px 14px 16px minmax(0, 1fr) 46px 12px; align-items: start; min-height: 26px; padding-left: calc(var(--d, 0) * 12px); border-radius: 3px; position: relative; }
.st-side .st-row { grid-template-columns: 14px 16px minmax(0, 1fr) 40px 12px; }
.st-bul { display: inline-flex; width: 14px; height: 14px; margin-top: 6px; border-radius: 50%; align-items: center; justify-content: center; justify-self: center; }
.st-bul.folded { background: var(--st-ring); }
.st-bul i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .55; }
.st-row.kind .st-bul i { opacity: .8; }
.st-row:hover { background: var(--st-wash); }
.st-row.cur { background: var(--st-wash); }
.st-row.cur::before { content: ""; position: absolute; left: -8px; top: 5px; bottom: 5px; width: 2px; background: var(--st-line); border-radius: 1px; }
/* The tick box drawn as Threads draws it (parts/shared.js, rf-check): Logseq paints a ticked checkbox blue with its own
   !important rules, so each is overridden here. When it shows is Look's word (on the list under the pointer, or while picking). */
.st input.lk-tick[type=checkbox] { appearance: none !important; -webkit-appearance: none !important; position: relative; box-sizing: border-box; width: 13px !important; height: 13px !important; margin: 0 !important; padding: 0; flex: none; border: 1px solid var(--st-line) !important; border-radius: 3px !important; background: none !important; color: inherit !important; vertical-align: -1px; cursor: pointer; outline: none; box-shadow: none !important; }
.st input.lk-tick[type=checkbox]:checked, .st input.lk-tick[type=checkbox]:focus, .st input.lk-tick[type=checkbox]:hover { background-color: transparent !important; background-image: none !important; border-color: currentColor !important; color: inherit !important; box-shadow: none !important; }
.st input.lk-tick:checked::before { content: ""; position: absolute; left: 3.5px; top: .5px; width: 3.5px; height: 7px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
.st input.lk-tick:focus-visible { outline: none; border-color: currentColor !important; }
/* Every box at the middle of its row's first line, in one straight column at the left edge whatever the row's depth, so a
   top-level row, which can be ticked like any (the top is open), keeps its fold arrow beside its box. */
.st .st-row > input.lk-tick[type=checkbox] { margin-top: 6.5px !important; margin-left: calc(0px - var(--d, 0) * 12px - var(--st-in, 0px)) !important; }
/* Under a kind a name starts right of the kind's name, past the kind's mark. */
.st-tree .st-row:not(.kind):not(.loose) { --st-in: 9px; padding-left: calc(var(--d, 0) * 12px + var(--st-in)); }
.st-row .lk-fold { display: inline-flex; width: 14px; height: 20px; margin-top: 3px; align-items: center; justify-content: center; cursor: pointer; }
.st-row .lk-fold svg { width: 10px; height: 10px; transition: transform .12s; } .st-row .lk-fold[aria-expanded="true"] svg { transform: rotate(90deg); }
.st-row .st-km { width: 10px; height: 10px; color: var(--st-quiet); flex: none; }
.st-row .nm { min-width: 0; padding: 3px 0; line-height: 20px; overflow-wrap: anywhere; display: flex; gap: 7px; align-items: baseline; }
.st-row.kind .nm { font-weight: 500; }
.st-row.dim .nm, .st-row.dim .ct, .st-row.loose .nm { color: var(--lk-off); }
.st-row .ct { text-align: right; line-height: 26px; color: var(--st-quiet); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.st-row .iss { width: 5px; height: 5px; margin-top: 10.5px; border-radius: 50%; background: currentColor; opacity: 0; justify-self: center; }
.st-row .iss.on { opacity: .35; } .st-row .iss.own { opacity: .7; }
/* Everything that presses shows it under the pointer, and nothing else does: a line or a row that opens a card, a number, the rest of a list. */
.st [data-row], .st [data-prop], .st [data-nodes], .st [data-node], .st [data-pick], .st [data-all], .st [data-more], .st [data-go], .st [data-back], .st [data-open] { cursor: pointer; }
.st .lk-view.on { cursor: default; } .st-row.off[data-pick] { cursor: default; }
.st-row.dragging { opacity: .4; }
.st-row.over { background: var(--st-wash); box-shadow: inset 0 2px 0 var(--st-line); }
.st-row.over[data-word]:not([data-word=""])::after { content: attr(data-word); position: absolute; right: 64px; top: 4px; font-size: 12px; color: var(--st-quiet); pointer-events: none; }
/* Two panes: each finds and scrolls on its own; "to the top" stands at each foot only while a tag is held. */
.st-panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 8px 0 12px; }
.st-pane { min-width: 0; padding: 4px 14px 0 6px; display: flex; flex-direction: column; }
.st-pane + .st-pane { border-left: 1px solid var(--st-hair); padding-left: 14px; }
.st-pane .st-tree { max-height: calc(100vh - 300px); min-height: 160px; overflow-y: auto; }
.st-topdrop { display: none; } .st[data-dragging] .st-topdrop { display: grid; } .st-topdrop .nm { color: var(--st-quiet); }
.st-top .st-split { flex: none; }

/* Pencilled in (Look's lk-pencil on the name): what a change waiting in the tray touches. */
/* The pick bar, as the grammar draws it: above the list, how many and what can be done as quiet words, Esc clears. */
.st-pick { margin: 0 0 8px; min-height: 27px; flex-wrap: nowrap; }
.st-nodes .st-pick { margin: 0 0 6px; min-height: 0; }
/* The trail, as the grammar draws it: where you came through, each a step back, › between; Escape goes back one step. */
.st-trail { margin: 0 0 4px; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; }
.st-trail .lk-step { min-width: 3em; overflow: hidden; text-overflow: ellipsis; }
.st-trail .sep { flex: none; }
/* The three views as words above the tree, the one in force in the text colour (the grammar's narrowing words). */
.st-views { margin: 0 0 8px; min-height: 27px; }
/* The title row: the name, and at its right end the thing's place in the tree, nearest first, as Look draws it on a page. */
.st-ttl { display: flex; align-items: baseline; gap: 14px; margin: 0 0 2px; }
/* Too long for the row, it gives way from the middle, then the nearest tag; the kind stays whole. */
.st-ttl .st-place { display: flex; align-items: baseline; margin-left: auto; font-size: 12px; white-space: nowrap; min-width: 0; flex: 0 1 auto; }
.st-ttl .st-place > * { flex: 0 1000 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; }
.st-ttl .st-place > :first-child { flex-shrink: 1; } .st-ttl .st-place > :last-child { flex-shrink: 0; }
.st-ttl .st-place .sep { flex: none; min-width: 0; color: var(--st-faint); margin: 0 .4em; }
.st-card h2 { font-size: 20px; font-weight: 600; margin: 0; display: flex; gap: 10px; align-items: center; line-height: 1.3; min-width: 0; }
.st-card h2 .st-km { width: 14px; height: 14px; color: var(--st-quiet); } .st-card h2 .st-pi { width: 13px; height: 13px; }
.st-card .sum { font-size: 13px; color: var(--st-quiet); margin: 0 0 6px; display: flex; gap: 14px; flex-wrap: wrap; align-items: baseline; }
.st-card .acts { margin: 8px 0 20px; }
.st .act { color: var(--st-quiet); cursor: pointer; white-space: nowrap; } .st .act:hover { color: inherit; }
/* A group's head is bold words on a row; groups are told apart by a gap of one line, not a hairline (the grammar). */
.st-card h3, .st-hl h3 { font-size: 14px; font-weight: 600; color: inherit; margin: 22px 0 2px; min-height: 25px; display: flex; align-items: center; }
.st-card h3:first-of-type, .st-hl h3:first-child { margin-top: 0; } .st-hl .st-ttl + h3 { margin-top: 12px; }
.st-ln { display: grid; grid-template-columns: 16px minmax(0, 1fr) 84px; gap: 0 8px; align-items: baseline; min-height: 25px; border-radius: 3px; padding: 0 4px 0 2px; margin-left: -2px; }
.st-ln:hover { background: var(--st-wash); }
.st-pi { display: inline-flex; width: 11px; height: 11px; color: var(--st-faint); align-self: center; } .st-ln > .st-pi { align-self: start; margin-top: 5px; } .st-pi .lk-icon.lk-web, .st-pi .lk-icon.lk-web svg { width: 100%; height: 100%; } .st-pi .ti { font-size: 12px; line-height: 1; margin: -.5px; }
.st-ln .w { display: flex; gap: 8px; align-items: baseline; min-width: 0; flex-wrap: wrap; }
.st-ln .w .k { color: inherit; }
.st-ln .w .to { color: var(--st-faint); font-size: 12px; }
.st .lk { text-decoration: underline; text-decoration-color: var(--st-line); text-underline-offset: 3px; cursor: pointer; }
.st .lk:hover { text-decoration-color: currentColor; }
.st .lk-tag { white-space: nowrap; cursor: pointer; }
.st-ln .ct { text-align: right; font-size: 12.5px; color: var(--st-quiet); font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-ln.low .ct { color: var(--st-faint); }
.st-ln.rng .x { margin-left: 2px; }
.st-ln.add .ct { text-align: left; white-space: normal; }
/* An issue's row, each part keyed by its role (the owner, 31 October 2026): the thing to settle in the text colour with the underline
   that opens its card, the tying words and the sentence in the quiet grey at the row's size, the tags as tags, the count as a number,
   the fix last in the text colour, taking the room it needs (the sentence wraps before it, never the fix word). */
.st-ln.iss { grid-template-columns: 16px minmax(0, 1fr) max-content; }
.st-ln.iss .w { color: var(--st-quiet); display: block; }   /* the parts flow as text, so a long sentence wraps as text */
.st-ln.iss .w > span { margin: 0 2px; } .st-ln.iss .w > span:first-child { margin-left: 0; }
.st-ln.iss .w .sj { color: var(--lk-text, #222); font-weight: 500; margin-right: 4px; }
.st-ln.iss .w .to { color: var(--st-quiet); font-size: 13.5px; } .st-ln.iss .w .pn { margin-left: -2px; }
.st-ln.iss .w .nm { color: var(--st-quiet); font-variant-numeric: tabular-nums; font-size: 13.5px; margin-left: 6px; }
/* A line with its own issue: the fix word at its right end, after the faint count. */
.st-ln.fx { grid-template-columns: 16px minmax(0, 1fr) 84px max-content; }
/* A merge before it is staged, as the grammar shows a consequence: the two tags side by side, their properties lined up. */
.st-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; font-size: 13.5px; margin: 8px 0 6px; }
.st-two .h { font-weight: 600; padding-bottom: 4px; display: flex; gap: 8px; align-items: baseline; color: var(--lk-text, #222); } .st-two .h .ct { font-weight: 400; color: var(--st-quiet); font-size: 12.5px; }
.st-two .pr { display: flex; gap: 8px; min-height: 24px; align-items: center; color: var(--st-quiet); }   /* the name at the left of its column, "on both" at the right */
.st-two .pr .n { display: inline-flex; gap: 6px; align-items: center; min-width: 0; }
.st-two .pr .ct { font-size: 12.5px; color: var(--st-faint); margin-left: auto; white-space: nowrap; }
.st-two .pr.moves, .st-two .pr.shared { color: var(--lk-text, #222); } .st-two .pr.gone { text-decoration: line-through; color: var(--st-faint); } .st-two .pr.new { font-style: italic; }
.st .q { color: var(--st-quiet); } .st .f { color: var(--st-faint); }
.st-tbl { font-size: 13.5px; }
.st-tbl .hd, .st-tbl .tr { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr) minmax(0, 1.4fr) 116px; gap: 0; align-items: center; min-height: 32px; border-bottom: 1px solid var(--st-hair); }
.st-tbl .hd > *, .st-tbl .tr > * { padding: 4px 12px; min-width: 0; border-left: 1px solid var(--st-hair); } .st-tbl .hd > :first-child, .st-tbl .tr > :first-child { border-left: 0; padding-left: 4px; }
.st-tbl .hd { font-weight: 600; } .st-tbl .hd .lk-head { cursor: pointer; }
.st-tbl .tr:hover { background: var(--st-wash); }
.st-tbl .tr > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.st-h { font-size: 14px; font-weight: 600; margin: 22px 0 4px; }
/* A narrow pane (the right sidebar open): the table keeps its four columns, the tag columns wrapping. */
@container (max-width: 640px) { .st-tbl .hd, .st-tbl .tr { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 76px; } .st-tbl .hd > *, .st-tbl .tr > * { padding-inline: 8px; } }
.st-tbl .tr .ct { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
/* The groups of Every property: a name that folds like a bullet, its count at the right; what it holds one step in. */
.st-tbl .tr > :first-child { padding-left: var(--pd, 4px); }   /* inside a group: one step past its name, as a child bullet */
.st-tbl .st-grp .lk-fold { display: inline-flex; width: 14px; height: 20px; align-items: center; justify-content: center; cursor: pointer; }
.st-tbl .st-grp .lk-fold svg { width: 10px; height: 10px; transition: transform .12s; } .st-tbl .st-grp .lk-fold[aria-expanded="true"] svg { transform: rotate(90deg); }
.st-tbl .st-grp { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto 22px; gap: 6px; align-items: center; min-height: 32px; padding-left: calc(var(--d, 0) * 16px); border-bottom: 1px solid var(--st-hair); }
.st-tbl .st-grp .gn { font-weight: 600; cursor: text; } .st-tbl .st-grp.none .gn { font-weight: 500; cursor: default; }
.st-tbl .st-grp .ct { font-variant-numeric: tabular-nums; padding-right: 12px; }
.st-tbl .st-grp .lk-x { visibility: hidden; } .st-tbl .st-grp:hover .lk-x { visibility: visible; }
.st-tbl .st-grp.over { background: var(--st-wash); box-shadow: inset 0 2px 0 var(--st-line); }
.st-tbl .dragging { opacity: .4; }
.st-gnew { padding: 8px 2px 0; }
.st-tbl .to, .st-lines-t .to { margin: 0 .35em; }
.st-hl .st-ln { grid-template-columns: minmax(0, 1fr) max-content; }
/* A node's row: the day in the left margin (the margin is time), the tick, the bullet, the name. */
.st-nodes .st-ln { grid-template-columns: 46px 14px 16px minmax(0, 1fr); }
.st-nodes .st-ln .lk-day { white-space: nowrap; }
.st-nodes .st-ln.cur { background: var(--st-wash); }
.st-nodes .st-ln > input.lk-tick[type=checkbox] { align-self: start; margin-top: 4px !important; } .st-nodes .st-ln > .st-bul { align-self: start; margin-top: 3.5px; }
.st-nodes .more, .st-hl .more, .st-tbl .more { padding: 4px 2px; }
.st-menu { position: absolute; background: var(--lk-paper, #fff); box-shadow: 0 6px 18px rgba(0,0,0,.12); min-width: 230px; width: max-content; max-width: 360px; font-size: 13.5px; z-index: 30; }
/* A prompt happens in place (the grammar: never a window): it rolls out under its row, joined by a line from the margin. */
.st-prompt { margin: 2px 0 8px 30px; padding: 4px 0 2px 10px; border-left: 1px solid var(--st-hair); font-size: 13.5px; max-width: 320px; }
.st-card .st-prompt { margin-left: 2px; }
.st-prompt .ask { color: var(--st-quiet); font-size: 12.5px; margin-bottom: 4px; }
.st-prompt .ask b { color: inherit; font-weight: 500; }
.st-prompt .st-find { margin-bottom: 6px; }
.st-prompt .st-row { grid-template-columns: 14px 16px minmax(0, 1fr) 40px; }
.st-prompt .st-row { padding-left: calc(var(--d, 0) * 14px); }
.st-prompt .st-row.more { color: var(--st-faint); }
.st-prompt .st-row.off .nm, .st-prompt .st-row.off .ct { color: var(--st-faint); }
.st-prompt .st-row:hover { background: none; }
.st-prompt .st-row.lit, .st-prompt .st-row.lit:hover { background: var(--st-wash); }
.st-empty { color: var(--st-quiet); max-width: 60ch; }
@media (max-width: 760px) { .st-page { height: auto; } }`;

function ensureStyle(doc) {
  let sheet = doc.getElementById('st-style');
  if (!sheet) { sheet = doc.createElement('style'); sheet.id = 'st-style'; sheet.className = 'st-own'; doc.head.appendChild(sheet); }
  if (sheet.textContent !== CSS) sheet.textContent = CSS;
}

/* make(holder, mode, app): draws the screen into holder; mode is 'page' (tree, card, tray) or 'side' (the tree alone).
   app holds the state every view shares (logseq/main.js): the tray with its model, the cursor, what is open and ticked,
   the trail. The sidebar's tree has a cursor and a find box of its own (app.st.side), so reading a page's tag there
   never moves the main view. */
function make(holder, mode, app, opts = {}) {
  const doc = holder.ownerDocument;
  ensureStyle(doc);
  const st = app.st;
  // What a drawing shows that can come or go when something folds: a tree's rows, Every property's groups and properties.
  const KEYED = '.st-row[data-row], .st-grp[data-group], .tr[data-prop]';
  const keyOfShown = e => `${e.closest('[data-pane]')?.dataset.pane || ''}|${e.dataset.row ?? ''}|${e.dataset.group ?? ''}|${e.dataset.prop ?? ''}`;
  const loc = mode === 'side' ? st.side : st;   // the cursor and the find text this view uses
  const root = doc.createElement('div');
  root.className = `st ${mode === 'side' ? 'st-side' : mode === 'tag' ? 'st-tag' : 'st-page'}`;
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
    const q = (P2 ? P2.find : loc.find).trim().toLowerCase();
    if (q) {
      const hit = new Set([...m.tags.values()].filter(t => !t.missing && t.title.toLowerCase().includes(q)).map(t => t.id));
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
    const t = r.n === LOOSE ? null : T(r.n), isKind = r.d === 0, side = mode === 'side';
    const o = own(r.n), b = below(r.n);
    const arrow = r.kids ? `<span class="lk-fold" data-fold="${esc(r.n)}" aria-expanded="${r.open}">${CHEVRON}</span>` : '<span></span>';
    const bullet = `<span class="st-bul ${r.kids && !r.open ? 'folded' : ''}"><i></i></span>`;
    const editing = !inPane2 && st.edit && st.edit.what === 'rename' && st.edit.on === r.n;
    const nm = editing ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : esc(name(r.n));
    const canDrag = t && !t.missing && !editing;   // any tag, a kind's too: the top is open
    let h = `<div class="st-row lk-row ${isKind ? 'kind' : ''} ${r.n === LOOSE ? 'loose' : ''} ${r.dim || (st.aim && !aimOk(r.n)) ? 'dim' : ''} ${t?.missing ? 'dim' : ''} ${loc.cur === r.n ? 'cur' : ''} ${waitTag(r.n)}" style="--d:${r.d}" data-row="${esc(r.n)}" ${canDrag ? 'draggable="true"' : ''}>` +
      (side ? '' : `<input type="checkbox" class="lk-tick" data-tick="${esc(r.n)}" ${st.ticks.has(r.n) ? 'checked' : ''} ${r.n === LOOSE || t?.missing ? 'disabled style="visibility:hidden"' : ''}>`) +
      arrow + bullet +
      `<span class="nm">${isKind && t?.kind ? km(t.kind) : ''}<span class="${waitTag(r.n) ? 'lk-pencil' : ''}">${nm}</span></span><span class="ct">${Mo.count(M(), r.n) || ''}</span><span class="iss ${o ? 'own' : b ? 'on' : ''}"></span></div>`;
    if (!inPane2 && st.edit && st.edit.what === 'new' && st.edit.on === r.n && st.edit.owner === mode) h += `<div class="st-row lk-row" style="--d:${r.d + 1}"><span></span><span></span><span class="st-bul"><i></i></span><span class="nm"><input class="st-in" data-edit value="${esc(st.edit.text)}" placeholder="a new tag under ${esc(name(r.n))}" autocomplete="off" spellcheck="false"></span><span class="ct"></span><span class="iss"></span></div>`;
    if (!inPane2 && !promptDrawn && st.prompt && st.prompt.owner === mode && st.prompt.row === r.n) { h += promptHtml(); promptDrawn = true; }
    return h;
  }
  function treeHtml() {
    const rows = visibleRows();
    promptDrawn = false;
    const views = '';
    return `<div class="st-left">${views}<div class="st-find"><input data-find placeholder="find a tag…" value="${esc(loc.find)}" autocomplete="off" spellcheck="false"><span class="n">${loc.find.trim() ? rows.filter(r => !r.dim).length : ''}</span></div>` +
      `<div class="st-tree lk-list" ${st.ticks.size ? 'data-picking' : ''}>${rows.map(rowHtml).join('')}</div></div>`;
  }

  /* ---------- Two panes: the whole tree twice, side by side, each finding and scrolling on its own, so a tag can be dragged
     from one onto a row of the other when the two are far apart in one long tree. The first pane is the map's own (its find
     text, folds and cursor); a field opens only there. While a tag is held, "to the top" stands at the foot of each pane. */
  let inPane2 = false;
  function panesHtml() {
    promptDrawn = false;
    const pane = n => {
      inPane2 = n === 2;
      const rows = visibleRows(n), q = n === 2 ? st.pane2.find : loc.find;
      const h = `<div class="st-pane" data-pane="${n}"><div class="st-find"><input ${n === 2 ? 'data-find2' : 'data-find'} placeholder="Find a tag" value="${esc(q)}" autocomplete="off" spellcheck="false"></div>` +
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
    const find = st.view === 'tree' && st.split ? '' : `<div class="st-find"><input data-find placeholder="Find a tag" value="${esc(loc.find)}" autocomplete="off" spellcheck="false"></div>`;
    return `<div class="st-top">${views}${find}${split}<span class="st-new act lk-add lk-i-plus" data-do="new" data-on="${LOOSE}">New top-level tag</span></div>${st.view === 'tree' ? actsHtml() : ''}`;
  }
  // What can be done stays in view, faint until it can be (the research: what you can do is recognised, not remembered), so nothing moves when a tag is picked.
  function actsHtml() {
    const aim = st.aim, names = aim && (aim.tags.length > 3 ? `${aim.tags.length} tags` : R.list(aim.tags.map(name)));
    if (aim) return `<div class="st-acts lk-bar"><b class="lk-said">${aim.what === 'move' ? `Move ${esc(names)} to` : `Merge ${esc(names)} into`}: press a tag</b><span class="act lk-btn lk-low lk-i-x" data-aimoff>Leave it</span>${aim.what === 'move' ? '<span class="act lk-btn lk-i-up" data-aimtop>To the top</span>' : ''}</div>`;
    const n = st.ticks.size;
    return `<div class="st-acts lk-bar">${n ? `<b class="lk-said">${n} picked</b>` : '<span class="say">Pick tags to move or merge</span>'}<span class="act lk-btn lk-i-move ${n ? '' : 'waits'}" data-aim="move">Move to…</span><span class="act lk-btn lk-i-merge ${n > 1 ? '' : 'waits'}" data-aim="merge">Merge into…</span></div>`;
  }
  function regionsHtml() {
    promptDrawn = false;
    const areas = [];
    for (const r of visibleRows()) { if (!r.d) areas.push([]); areas[areas.length - 1]?.push(r); }
    const asking = st.edit && st.edit.owner === mode && (st.edit.what === 'kids' || st.edit.on === LOOSE);
    const edit = asking ? `<div class="st-area"><div class="st-row lk-row kind"><span></span><span></span><span></span><span class="nm"><input class="st-in" data-edit value="${esc(st.edit.text)}" placeholder="${st.edit.what === 'kids' ? `The first child tags of ${esc(name(st.edit.on))}, with commas` : 'Name of the new top-level tag'}" autocomplete="off" spellcheck="false"></span></div></div>` : '';
    return `<div class="st-regions lk-list" ${st.ticks.size ? 'data-picking' : ''}><svg class="st-lines" aria-hidden="true"></svg>${areas.map(a => `<div class="st-area">${a.map(rowHtml).join('')}</div>`).join('')}${edit}</div>${st.aim ? '' : focusHtml(st.cur)}`;
  }
  // The relationships of a tag, read left to right: the tag that holds the property, the property and what it holds, how many nodes.
  const relWord = (id, t) => `<span class="lk-tag ${id === t ? 'self' : ''}" data-go="${esc(id)}">${esc(name(id))}</span>`;
  const relProp = (r, t) => `<span><span class="lk" data-open="${esc(P(r.prop)?.uuid || '')}">${esc(r.title)}</span>: ${relWord(r.to, t)}</span>`;
  const relLine = (r, t) => `${relWord(r.from, t)}${relProp(r, t)}<span class="num">${r.n}</span>`;
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
  // ---------- a tag's own page: the lines above Logseq's table ----------
  function linesHtml(id) {
    const t = T(id); if (!t) return '';
    const up = Mo.pathOf(M(), id).slice(0, -1).reverse(), kids = Mo.kids(M(), id), beside = up.length ? Mo.kids(M(), up[0]).filter(k => k !== id) : [];
    const adding = st.edit?.what === 'new' && st.edit.on === id && st.edit.owner === mode;
    const extendsWord = `<span class="act lk-pick" data-do="move" data-on="${id}">${up.length ? up.map(tagLink).join('<span class="to"> / </span>') : 'Nothing'}<span class="chev">⌄</span></span>`;
    return `<dl class="st-lines-t"><dt>Extends</dt><dd>${extendsWord}</dd>${beside.length ? `<dt>Beside</dt><dd><span>${ranges(beside)}</span></dd>` : ''}` +
      `<dt>Child tags</dt><dd>${kids.length ? `<span>${ranges(kids)}</span>` : ''}${adding ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" placeholder="Name of the child tag" autocomplete="off" spellcheck="false">` : `<span class="act lk-add lk-i-child" data-do="new" data-on="${id}">Add child tag</span>`}</dd>` +
      `<dt>Relationships</dt><dd>${relsHtml(id)}</dd></dl>${cardPrompt()}${mergeAskHtml(id)}${changeAskHtml(id)}${suggestHtml(id)}`;
  }
  // A property's own page: the same short lines above what Logseq shows. Each action sits on what it acts on.
  function propLinesHtml(pid) {
    const m = M(), p = P(pid); if (!p) return '';
    const on = [...p.on].sort((a, b) => Mo.count(m, b) - Mo.count(m, a));
    const onRow = id => { const key = `${id}·${pid}`, t = T(id), kids = Mo.kids(m, id), fx = { word: '', ask: '' };
      return `<div class="ont" data-prop="${key}">${tagLink(id)}<span class="num">${Mo.filled(m, id, pid)} of ${Mo.count(m, id)}</span><span class="acts-r"><span class="act lk-btn lk-low lk-i-move" data-do="pmove" data-on="${key}">Move to…</span>${(p.choice || p.type === 'node') && t?.nodes.size ? `<span class="act lk-btn lk-low lk-i-split" data-do="split" data-on="${key}">Split…</span>` : ''}<span class="act lk-btn lk-low lk-del lk-i-minus" data-do="pdrop" data-on="${key}" title="Delete property from tag">Delete</span></span></div>` +
        kids.map(k => { const lf = lineFix(id, pid, k); return `<div class="ont kid">${tagLink(k)}<span class="num">${Mo.filled(m, k, pid)} of ${Mo.count(m, k)}</span><span class="acts-r">${lf.word}</span></div>${lf.ask}`; }).join(''); };
    const cutAt = st.whole.has(`range${pid}`) ? p.range.length : 3, nodeTags = p.range.slice(0, cutAt).map(id => `<span class="rg">${tagLink(id)}<span class="lk-x" data-unrange="${id}" title="Take ${esc(name(id))} out">×</span></span>`).join('') + (p.range.length > cutAt ? `<span class="lk-more" data-all="range${pid}">and ${p.range.length - cutAt} more</span>` : '');
    const rels = Mo.roads(m).filter(r => r.prop === pid).sort((a, b) => b.n - a.n), key = `prop${pid}`, shown = st.whole.has(key) ? rels : rels.slice(0, 6);
    return `<dl class="st-lines-t"><dt>Property type</dt><dd>${esc(Mo.kindWord(p.choice ? 'choice' : p.type))}${p.many ? ', several values' : ''}</dd>` +
      (p.type === 'node' ? `<dt>Node tags</dt><dd>${nodeTags}<span class="act lk-add lk-i-plus" data-addrange="0·${pid}">Specify node tags…</span></dd>` : '') +
      `<dt>On tags</dt><dd class="col">${on.map(onRow).join('')}${on.length ? '' : `<span>${plural(m.holders.get(p.ident)?.size || 0, 'node')}, on no tag</span>`}<span class="act lk-add lk-i-plus" data-do="pmove" data-on="0·${pid}">Put on a tag…</span></dd>` +
      (p.type === 'node' ? `<dt>Relationships</dt><dd>${rels.length ? `<div class="st-rel">${shown.map(r => `${relWord(r.from)}${relProp(r)}<span class="num">${r.n}</span>`).join('')}${shown.length < rels.length ? `<span class="all lk-more" data-all="${key}">and ${rels.length - shown.length} more</span>` : ''}</div>` : '<span>No relationships yet</span>'}</dd>` : '') + `</dl>${cardPrompt()}` +
      R.issuesOfProp(ISS(), pid).filter(i => !(i.line && i.line.kid != null)).map(i => { const n = ISS().indexOf(i); return `<div class="sug"><b>Suggested</b><span>${partsHtml(i.parts)}</span><span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${n}">${esc(fixWord(i.fix))}</span></div>${askHtml(n)}`; }).join('');
  }
  function logHtml() {
    const all = app.logged();
    return `<div class="st-log">${all.length ? all.map(x => `<div class="ln"><span>${esc(new Date(x.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${esc(x.text)}</span><span>${x.nodes ? plural(x.nodes, 'node') : ''}</span></div>`).join('') : '<div class="st-empty">Nothing has been changed yet.</div>'}</div>`;
  }
  // ---------- the top line of every content: the path, ending on the thing itself; where to go back; the two lists ----------
  const placeName = p => p.view === 'table' ? 'Every property' : p.view === 'log' ? 'Log' : p.view === 'nodes' ? `the nodes of ${name(p.nodes?.tag)}` : p.propCur ? P(Number(p.propCur.split('·')[1]))?.title ?? '' : name(p.cur);
  // The trail (the grammar's): the places you came through, each a step back (a click goes back to it). It ends with ›:
  // the title under it is where you are, so the name is not said twice (the owner, 31 October 2026, on a property's card).
  // One line in one place: the last few places, the ones before them a faint "…".
  const TRAIL = 4;
  const trailHtml = () => { const steps = st.trail.map((p, i) => [placeName(p), i]).filter(([w]) => w); return steps.length ? `<div class="st-trail lk-trail">${steps.length > TRAIL ? '<span class="sep">…</span>' : ''}${steps.slice(-TRAIL).map(([w, i]) => `<span class="lk-step" data-back="${i}">${esc(w)}</span>`).join('<span class="sep">›</span>')}<span class="sep">›</span></div>` : ''; };
  // The title row: the mark and the name, and at the right end the place in the tree, nearest first, each a tag that opens (as Look draws a page's).
  const titleHtml = (mark, title, above, cls) => `<div class="st-ttl"><h2 class="${cls || ''}">${mark}<span class="${cls ? 'lk-pencil' : ''}">${title}</span></h2>${above.length ? `<span class="st-place">${above.map(tagLink).join('<span class="sep">/</span>')}</span>` : ''}</div>`;
  // The prompt that belongs to the card (a property's, the nodes'), in place under the words.
  let promptDrawn = false;   // set by the tree: whether the prompt's row is on screen (else the card shows the prompt)
  const cardPrompt = () => st.prompt && st.prompt.owner === mode && !promptDrawn ? promptHtml() : '';
  const acts = (on, list) => { const l = list.filter(Boolean); return l.length ? `<div class="acts lk-strip">${l.map(([word, a]) => `<span class="act lk-btn lk-i-${ACT_ICON[a]}" data-do="${a}" data-on="${esc(on)}">${word}</span>`).join('')}</div>` : ''; };

  // ---------- the card ----------
  // A tag named on a card or in the table: plain words with the faint underline, as the mockup draws it (a run of small mono
  // names was hard to read, the owner, 30 October 2026); where it stands already says it is a tag.
  const tagLink = id => `<span class="lk-tag tg ${waitTag(id) ? 'lk-pencil' : ''}" data-go="${esc(id)}">${esc(name(id))}</span>`;
  // A range of many tags (Topic, on purpose, takes fifteen): the first three, then how many more; the property's card lists them all.
  const ranges = ids => ids.slice(0, 3).map(tagLink).join('<span class="to">·</span>') + (ids.length > 3 ? `<span class="to">and ${ids.length - 3} more</span>` : '');
  // An issue that belongs to a line puts its fix word at the line's right end, after the faint count, with its ask under the line.
  const lineFix = (tagId, pid, kid) => { const i = R.issueOnLine(ISS(), tagId, pid, kid); return i ? { cls: 'fx', word: `<span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${ISS().indexOf(i)}">${esc(fixWord(i.fix))}</span>`, ask: askHtml(ISS().indexOf(i)) } : { cls: '', word: '', ask: '' }; };
  function propLine(tagId, pid, of, inh) {
    const p = P(pid), f = Mo.filled(M(), tagId, pid), low = of && f / of < .2;
    const editing = st.edit && st.edit.what === 'prename' && st.edit.on === `${tagId}·${pid}`;
    const fx = inh ? { cls: '', word: '', ask: '' } : lineFix(tagId, pid);
    return `<div class="st-ln ${inh ? 'inh' : ''} ${low ? 'low' : ''} ${fx.cls} ${waitProp(pid)}" data-prop="${tagId}·${pid}">${pi(p)}<span class="w">` +
      (editing ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="k lk ${waitProp(pid) ? 'lk-pencil' : ''}">${esc(p.title)}</span>`) +
      (p.type === 'node' ? `<span class="to">Node tags</span>${p.range.length ? ranges(p.range) : '<span class="to">any node</span>'}` : '') +
      (inh ? `<span class="to">inherited from ${esc(name(inh))}</span>` : '') +
      `</span><span class="ct">${f} of ${of}</span>${fx.word}</div>${fx.ask}`;
  }
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
  const issueLine = (i, lead) => { const n = ISS().indexOf(i); return `<div class="st-ln iss">${lead}<span class="w">${partsHtml(i.parts)}</span><span class="fix act lk-fix lk-i-${fixIcon(i.fix)}" data-fix="${n}">${esc(fixWord(i.fix))}</span></div>` + askHtml(n); };
  const issuesHtml = list => !list.length ? '' : `<h3>Issues</h3>` + list.map(i => issueLine(i, '<span></span>')).join('');
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
  // ---------- every property ----------
  function tableHtml() {
    // One row per property: every tag it is declared on (the biggest first), what it points at, how filled over all of them.
    // The row opens the property's card on its biggest tag; the card's "Also on" has each tag's own count.
    const m = M(), byProp = new Map();
    for (const r of Mo.propRows(m)) { const g = byProp.get(r.prop) || { prop: r.prop, p: P(r.prop), on: [], filled: 0, of: 0 }; g.on.push({ tag: r.tag, of: r.of }); g.filled += r.filled; g.of += r.of; byProp.set(r.prop, g); }
    const rows = [...byProp.values()].map(g => { g.on.sort((a, b) => b.of - a.of); g.tag = g.on[0].tag; g.pct = g.filled / Math.max(g.of, 1); return g; });
    const s = st.sort, onName = g => name(g.tag);
    rows.sort((a, b) => s === 'name' ? a.p.title.localeCompare(b.p.title) : s === 'on' ? onName(a).localeCompare(onName(b)) || a.p.title.localeCompare(b.p.title) : s === 'to' ? name(b.p.range[0] ?? '').localeCompare(name(a.p.range[0] ?? '')) : a.pct - b.pct || a.p.title.localeCompare(b.p.title));
    let h = `<div class="st-tbl"><div class="hd">${['name', 'on', 'to', 'filled'].map(c => `<span class="lk-head ${s === c ? 'on' : ''}" data-sort="${c}">${{ name: 'Property', on: 'On tags', to: 'Holds', filled: 'Filled' }[c]}</span>`).join('')}</div>`;
    // A property's name, or the field renaming it (Rename in its right-click menu).
    const nameCell = (key, title, wait) => st.edit?.what === 'prename' && st.edit.on === key && st.edit.owner === mode
      ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="k lk ${wait ? 'lk-pencil' : ''}">${esc(title)}</span>`;
    const tr = (r, d) => `<div class="tr ${waitProp(r.prop)}" data-prop="${r.tag}·${r.prop}" data-gprop="${esc(r.p.ident)}" draggable="true" style="--pd:${d ? 20 + d * 16 : 4}px"><span>${nameCell(`${r.tag}·${r.prop}`, r.p.title, waitProp(r.prop))}</span><span>${ranges(r.on.map(x => x.tag))}</span><span>${r.p.type === 'node' ? (r.p.range.length ? ranges(r.p.range) : 'Any node') : esc(Mo.kindWord(r.p.choice ? 'choice' : r.p.type))}</span><span class="ct">${r.filled} of ${r.of}</span></div>`;
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
      let x = `<div class="st-grp" data-group="${esc(g.id)}" draggable="true" style="--d:${d}"><span class="lk-fold" data-gfold="${esc(g.id)}" aria-expanded="${open}">${CHEVRON}</span>` +
        (field('gname', g.id) ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="gn" data-gname="${esc(g.id)}">${esc(g.name)}</span>`) +
        `<span class="ct">${countIn(g.id) || ''}</span><span class="lk-x" data-gdrop="${esc(g.id)}" title="Take the group away; what it holds goes up a level">×</span></div>`;
      if (open) x += kidsOf(g.id).map(k => groupHtml(k, d + 1)).join('') + propsIn(g.id).map(r => tr(r, d + 1)).join('');
      return x;
    };
    if (G.list.length) {
      const free = propsIn(null);
      h += kidsOf(null).map(g => groupHtml(g, 0)).join('') + `<div class="st-grp none" data-group="" style="--d:0"><span></span><span class="gn">No group</span><span class="ct">${free.length || ''}</span><span></span></div>` + few('table', free).map(r => tr(r, 1)).join('') + moreOf('table', free);
    } else h += few('table', rows).map(r => tr(r, 0)).join('') + moreOf('table', rows);
    h += `<div class="st-gnew">${field('gnew', '') ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" placeholder="Name of the group" autocomplete="off" spellcheck="false">` : '<span class="act lk-add lk-i-plus" data-gnew>New group</span>'}</div>`;
    const loose = [...m.props.values()].filter(p => !p.on.length);
    if (loose.length) h += `</div><h3 class="st-h">On no tag</h3><div class="st-tbl">` + few('loose', loose).map(p => `<div class="tr ${waitProp(p.id)}" data-prop="0·${p.id}"><span>${nameCell(`0·${p.id}`, p.title, waitProp(p.id))}</span><span></span><span>${p.range.length ? p.range.map(tagLink).join(', ') : esc(Mo.kindWord(p.choice ? 'choice' : p.type))}</span><span class="ct">${m.holders.get(p.ident)?.size || 0} nodes</span></div>`).join('') + moreOf('loose', loose);
    return h + `</div>`;
  }
  // A long list: a few, then "show all", as a tag's nodes.
  const FEW = 20;
  const few = (key, list) => st.whole.has(key) ? list : list.slice(0, FEW);
  const moreOf = (key, list) => !st.whole.has(key) && list.length > FEW ? `<div class="more lk-more" data-all="${esc(key)}">show all ${list.length}</div>` : '';
  // ---------- a tag's nodes ----------
  function nodesHtml() {
    const n = st.nodes, t = n && T(n.tag);
    if (!t) return `<div class="st-empty">No nodes to show.</div>`;
    const list = n.all ? n.list : n.list.slice(0, 20);
    let h = `<div class="st-card st-nodes lk-list" ${n.ticks.size ? 'data-picking' : ''}><div class="st-h" style="margin-top:0"><span class="lk" data-go="${n.tag}">${esc(t.title)}</span>, ${plural(n.list.length, 'node')}</div>`;
    // Nothing ticked: the bar's room stays empty, so a tick moves no row.
    if (!n.ticks.size) h += `<div class="st-pick"></div>`;
    else h += `<div class="st-pick lk-bar"><b class="lk-said">${n.ticks.size} picked</b><span class="act lk-btn lk-i-move" data-do="nmove" data-on="${n.tag}">Move to another tag…</span><span class="act lk-btn lk-i-child" data-do="nsplit" data-on="${n.tag}">New child tag of ${esc(t.title)} with them…</span></div>`;
    h += cardPrompt();
    h += list.map((x, i) => `<div class="st-ln ${i === n.cur ? 'cur' : ''}" data-node="${i}"><span class="lk-day">${dayWords(x.day)}</span><input type="checkbox" class="lk-tick" data-ntick="${i}" ${n.ticks.has(x.uuid) ? 'checked' : ''}><span class="st-bul"><i></i></span><span class="w"><span class="lk-node lk-bare lk" data-uuid="${esc(x.uuid)}" data-open="${esc(x.uuid)}">${esc(x.title.slice(0, 120) || '…')}</span></span></div>`).join('');
    if (!n.all && n.list.length > 20) h += `<div class="more lk-more" data-more>show all ${n.list.length}</div>`;
    return h + `</div>`;
  }

  // ---------- the tray ----------
  function trayHtml() {
    const tr = app.tray;
    if (st.ask?.apply && !tr.lasting().length) st.ask = null;   // the line it asked about was taken out
    if (st.busy) return `<div class="busy lk-hint">${esc(st.busy)}</div>`;
    // The last Apply's arrow stays until a new Apply takes its place, whatever is staged or discarded in between.
    const done = tr.done ? `<div class="st-done">${esc(tr.done.text)} <span class="lk-undo" title="Undo" data-undo>${Door.UNDO}</span></div>` : '';
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

  // ---------- the move prompt ----------
  function promptHtml() {
    const p = st.prompt, m = M(), q = p.text.toLowerCase();
    let ask, rows, all;
    if (p.list === 'values') {
      ask = `Split <b>${esc(name(p.tag))}</b> by <b>${esc(P(p.prop).title)}</b>: a new tag under it for the nodes where it is…`;
      all = p.values.filter(v => !q || v.title.toLowerCase().includes(q)).map(v => ({ key: v.id, nm: v.title, ct: v.count, d: 0, ok: true }));
      rows = all.slice(0, 10);
    } else if (p.list === 'props') {
      ask = `Add to <b>${esc(name(p.tag))}</b>${p.under ? ' and every tag under it' : ''} the property…`;
      all = [...m.props.values()].filter(x => !T(p.tag).props.includes(x.id) && (!q || x.title.toLowerCase().includes(q))).sort((a, b) => a.title.localeCompare(b.title)).map(x => ({ key: x.id, nm: x.title, ct: x.on.length ? `on ${x.on.length}` : '', d: 0, ok: true, icon: pi(x) }));
      rows = all.slice(0, 10);
    } else {
      const subject = p.what === 'nodes' ? `${p.nodes.length} ticked nodes` : p.what === 'prop' ? `the property ${P(p.prop).title}` : p.what === 'range' ? `what ${P(p.prop).title} points at` : p.tags.length > 1 ? `${p.tags.length} picked tags` : name(p.tags[0]);
      ask = p.what === 'range' ? `Node tags of <b>${esc(P(p.prop).title)}</b>${P(p.prop).range.length ? ', also' : ''}…` : p.what === 'prop' && !p.from ? `Put <b>${esc(P(p.prop).title)}</b> on…` : `Move <b>${esc(subject)}</b> to…`;
      const list = all = [];
      const walk = (n, d) => { const t = T(n); const ok = p.what === 'tag' ? !p.tags.some(s => Mo.under(m, n, s)) : p.what === 'range' || p.what === 'nodes' ? !t.missing : !t.missing || p.what !== 'prop' || !!p.from; if (!q || t.title.toLowerCase().includes(q)) list.push({ key: n, nm: t.title, ct: Mo.count(m, n) || '', d, ok, mark: d === 0 ? t.kind : null }); for (const k of Mo.kids(m, n)) walk(k, d + 1); };
      Mo.tops(m).forEach(k => walk(k, 0));
      if (p.what === 'tag' && (!q || 'the top'.includes(q))) list.push({ key: LOOSE, nm: 'The top', ct: '', d: 0, ok: true, loose: true });
      rows = q ? list.slice(0, 8) : list.filter(r => r.d <= 1).slice(0, 12);
    }
    if (p.whole) rows = all;
    else if (all.length > rows.length) rows = [...rows, { more: true, nm: `show all ${all.length}`, ct: '', d: 0, ok: true }];
    p.shown = rows;
    if (!rows[p.lit]?.ok) p.lit = rows.findIndex(r => r.ok);   // the lit row is one Enter can take
    return `<div class="st-prompt"><div class="ask">${ask}</div><div class="st-find"><input data-pin value="${esc(p.text)}" autocomplete="off" spellcheck="false"></div>` +
      rows.map((r, i) => `<div class="st-row ${r.ok ? '' : 'off'} ${r.loose ? 'loose' : ''} ${r.more ? 'more' : ''} ${i === p.lit ? 'lit' : ''}" style="--d:${Math.min(r.d, 2)}" data-pick="${i}"><span></span><span class="st-bul"><i></i></span><span class="nm">${r.mark ? km(r.mark) : r.icon || ''}${esc(r.nm)}</span><span class="ct">${esc(r.ct)}</span></div>`).join('') +
      (rows.length ? '' : `<div class="q" style="padding:4px 2px">nothing matches</div>`) + `</div>`;
  }
  // ---------- the menu: the same words the card has ----------
  function menuHtml() {
    const mn = st.menu, m = M(), ticked = st.ticks.size;
    const it = (t, act, off, k) => `<div class="lk-item ${off ? 'off' : ''} ${/^(Remove|Delete)/.test(t) ? 'lk-del' : ''}" data-act="${act}">${esc(t)}${k ? `<span class="rt lk-note">${k}</span>` : ''}</div>`;
    let h = `<div class="st-menu lk-menu" style="left:${mn.x}px;top:${mn.y}px">`;
    if (mn.kind === 'row') {
      const t = T(mn.on), isKind = !t || t.missing, loose = mn.on === LOOSE;   // isKind: nothing behind the row (a kind the graph lacks)
      const n = Mo.count(m, mn.on), nodesOf = ids => plural(ids.reduce((s, x) => s + Mo.count(m, x), 0), 'node');
      h += (t?.uuid ? it('Go to this tag', 'page') : '') + it('Open everything under', 'openall', false, 'Shift →') + (mode === 'side' ? it('Open the map here', 'main', false, 'Enter') : it(st.ticks.has(mn.on) ? 'Untick' : 'Tick', 'tick', isKind || loose, 'space')) + '<div class="gap lk-item"></div>' +
        it('Rename', 'rename', loose || !t || t.missing) + it('Its nodes', 'nodes', !n) + it(loose ? 'New top-level tag' : 'Add child tag', 'new') + it('Add a property…', 'addprop', isKind || loose) + it('Add a property to all beneath…', 'addpropall', loose, Mo.kids(m, mn.on).length ? nodesOf(Mo.kids(m, mn.on)) : '') + '<div class="gap lk-item"></div>' +
        it('Move to…', 'move', isKind || loose, n ? plural(n, 'node') : '') +
        it(ticked > 1 ? `Merge the ${ticked} ticked into this` : 'Merge the ticked into this', 'merge', isKind || loose || ticked < 1 || (ticked === 1 && st.ticks.has(mn.on)), ticked && !st.ticks.has(mn.on) ? nodesOf([...st.ticks]) : '') + '<div class="gap lk-item"></div>' +
        it('Remove', 'remove', isKind || loose || n > 0 || Mo.kids(m, mn.on).length > 0, n ? plural(n, 'node') : '');
    } else {
      const [tagId, pid] = mn.on.split('·').map(Number), t = T(tagId), p = P(pid), parent = Mo.parentOf(m, tagId);
      const declared = !!t?.props.includes(pid);
      const f = t ? plural(Mo.filled(m, tagId, pid), 'value') : '';
      h += (p?.uuid ? it('Go to this property', 'ppage') + '<div class="gap lk-item"></div>' : '') + it('Rename', 'prename', !p) + (p?.type === 'node' ? it('Specify node tags…', 'prange') : '') + '<div class="gap lk-item"></div>' +
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
    promptDrawn = false;
    let h;
    if (mode === 'page') {
      const card = st.view === 'table' ? tableHtml() : st.view === 'log' ? logHtml() : st.view === 'nodes' ? nodesHtml() : st.split ? panesHtml() : regionsHtml();
      h = `${topHtml()}<div class="st-tray">${trayHtml()}</div><div class="st-right">${card}</div>`;
    } else if (mode === 'tag') h = `<div class="st-tray">${trayHtml()}</div>${opts.prop != null ? propLinesHtml(opts.prop) : linesHtml(opts.tag)}`;
    else h = treeHtml();
    if (st.menu && st.menu.owner === mode) h += menuHtml();
    // What a fold opens rolls out (the grammar), as Threads' rows do: the rows, groups and properties that were not there before.
    const wasShown = st.glide ? new Set([...root.querySelectorAll(KEYED)].map(keyOfShown)) : null, hadPrompt = !!root.querySelector('.st-prompt');
    root.innerHTML = h;
    const rolled = [...(wasShown ? [...root.querySelectorAll(KEYED)].filter(e => !wasShown.has(keyOfShown(e))) : []), ...(!hadPrompt && root.querySelector('.st-prompt') ? [root.querySelector('.st-prompt')] : [])];
    st.glide = false;
    window.PluginDoor.unroll(rolled);
    // The map's lines are measured from where the rows stand: once more when they have rolled out.
    if (rolled.length && mode === 'page') setTimeout(() => { if (root.isConnected) S.regions?.lines(root, M(), st.cur, !!st.aim); }, 200);
    // The screen takes the room Logseq gives it: from where the holder sits to the bottom of the window.
    if (mode === 'page') { const top = root.getBoundingClientRect().top, win = doc.defaultView; if (win?.innerHeight && top >= 0) root.style.height = Math.max(360, win.innerHeight - top - 24) + 'px'; }
    slideTray(trayWas);
    if (mode === 'page') S.regions?.lines(root, M(), st.cur, !!st.aim);
    if (scroll) root.querySelector('.st-tree').scrollTop = scroll;
    root.querySelectorAll('.st-pane .st-tree').forEach((t, i) => { if (paneScroll[i]) t.scrollTop = paneScroll[i]; });
    if (scrollA && root.querySelector('.st-regions')) root.querySelector('.st-regions').scrollLeft = scrollA;
    if (scrollR && root.querySelector('.st-right')) root.querySelector('.st-right').scrollTop = scrollR;
    root.querySelector('.st-row.cur')?.scrollIntoView?.({ block: 'nearest' });
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
  const SLIDE = { duration: 160, easing: 'ease-out' };
  function slideTray(was) {
    const tray = root.querySelector('.st-tray'), now = tray?.offsetHeight;
    if (was == null || was === now || !tray?.animate || doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
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
  const tick = id => { const t = T(id); if (!t || t.missing) return; st.ticks.has(id) ? st.ticks.delete(id) : st.ticks.add(id); redraw(); };
  const startPrompt = p => { st.menu = null; st.ask = null; st.prompt = { text: '', lit: 0, owner: mode, ...p }; redraw(); };
  const startMoveTag = id => { const tags = st.ticks.size > 1 && st.ticks.has(id) ? [...st.ticks] : [id]; if (mode === 'page') return startAim('move', tags); startPrompt({ what: 'tag', list: 'tags', tags, row: id }); };
  // On the page of the whole the areas are the choice: the bar says what is moving, and a press on a tag answers.
  const startAim = (what, tags) => { st.menu = null; st.ask = null; st.aim = { what, tags }; loc.find = ''; redraw(); };
  const aimOk = id => { const a = st.aim, t = T(id); if (!a || !t) return false; return a.what === 'move' ? !a.tags.some(s => s === id || Mo.under(M(), id, s)) : !a.tags.includes(id) && !t.missing; };
  function finishAim(id) {
    const a = st.aim; if (id !== LOOSE && !aimOk(id)) return;
    st.aim = null; loc.find = '';
    if (a.what === 'move') moveTags(a.tags, id);
    else { st.cur = id; st.ask = { merges: a.tags, into: id, owner: mode }; }
    redraw();
  }
  function finishPrompt(row) {
    const p = st.prompt; if (!row || !row.ok) return;
    if (row.more) { p.whole = true; wantFocus = true; return redraw(); }
    st.prompt = null;
    if (p.what === 'tag') { moveTags(p.tags, row.key); }
    else if (p.what === 'prop') { const [tagId, pid] = p.key.split('·').map(Number); if (!tagId) { app.stage({ kind: 'addProp', prop: pid, tags: [row.key] }); st.propCur = `${row.key}·${pid}`; st.cur = row.key; } else if (row.key !== tagId) { app.stage({ kind: 'moveProp', prop: pid, from: [tagId], to: row.key }); st.propCur = `${row.key}·${pid}`; st.cur = row.key; } }
    else if (p.what === 'nodes') moveTicked(row.key);
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
    for (const s of tags) { const t = T(s); if (!t || t.missing || s === dest || (dest !== LOOSE && Mo.under(M(), dest, s)) || (dest === LOOSE ? !t.parents.length : Mo.parentOf(M(), s) === dest)) continue; app.stage({ kind: 'move', tag: s, to: dest }); }
    st.ticks.clear(); st.open.add(dest);
  }
  const startEdit = (what, on, text) => { st.menu = null; st.ask = null; st.edit = { what, on, text, owner: mode }; redraw(); };
  function finishEdit(value) {
    const e = st.edit, v = String(value || '').trim();
    if (!v || (e.what !== 'new' && e.what !== 'split')) return stageEdit(e, v);
    // A tag made under a name in use would take over what holds it, so the line stays and says so.
    Promise.resolve(Mo.titled(M(), v).length > 0 || app.nameTaken(v)).then(taken => {
      if (st.edit !== e) return;
      if (taken) app.notify(`“${v}” is already in the graph: give the new tag another name`, 'warning'); else stageEdit(e, v);
    });
  }
  function stageEdit(e, v) {
    st.edit = null;
    if (v) {
      if (e.what === 'rename' && v !== name(e.on)) app.stage({ kind: 'rename', tag: e.on, name: v });
      else if (e.what === 'new') { const c = app.stage({ kind: 'make', name: v, under: e.on === LOOSE ? null : e.on }); st.open.add(e.on); if (c?.made != null) { loc.cur = c.made; if (mode === 'side') st.cur = c.made; if (e.on === LOOSE) { st.edit = { what: 'kids', on: c.made, text: '', owner: mode }; } } }
      else if (e.what === 'kids') { for (const w of v.split(',').map(x => x.trim()).filter(Boolean)) if (!Mo.titled(M(), w).length) app.stage({ kind: 'make', name: w, under: e.on }); st.open.add(e.on); }
      else if (e.what === 'gnew' || e.what === 'gname') {
        const G = app.groups();
        if (e.what === 'gnew') G.list.push({ id: 'g' + Date.now().toString(36), name: v, under: null, open: true });
        else { const g = G.list.find(x => x.id === e.on); if (g) g.name = v; }
        app.saveGroups(G);
      }
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
    else if (a === 'move') { if (T(on) && !T(on).missing) startMoveTag(on); else redraw(); }
    else if (a === 'rename') { if (T(on) && !T(on).missing) startEdit('rename', on, name(on)); else redraw(); }
    else if (a === 'new') { if (!st.open.has(on)) st.open.add(on); startEdit('new', on, ''); }
    else if (a === 'addprop') { if (T(on) && !T(on).missing) startPrompt({ what: 'addprop', list: 'props', tag: on, row: on }); }
    else if (a === 'addpropall') { if (T(on)) startPrompt({ what: 'addprop', list: 'props', tag: on, under: true, row: on }); }
    else if (a === 'merge') { const from = [...st.ticks].filter(x => x !== on && T(x)); if (!from.length || !T(on) || T(on).missing) return redraw(); st.cur = on; st.view = 'tree'; st.propCur = null; st.ask = { merges: from, into: on, owner: mode }; redraw(); }
    else if (a === 'remove') { const t = T(on); if (!t || t.missing || Mo.count(m, on) || t.kids.length) return redraw(); const p = Mo.parentOf(m, on); app.stage({ kind: 'remove', tag: on }); if (st.cur === on) st.cur = p ?? Mo.tops(m)[0] ?? m.kinds[0].id; redraw(); }
    else if (a === 'pmove') { const [tagId] = on.split('·').map(Number); startPrompt({ what: 'prop', list: 'tags', key: on, prop: Number(on.split('·')[1]), from: tagId }); }
    else if (a === 'pullup') { const [tagId, pid] = on.split('·').map(Number); const dest = Mo.parentOf(m, tagId); if (dest == null) return redraw(); app.stage({ kind: 'moveProp', prop: pid, from: [tagId], to: dest }); st.propCur = `${dest}·${pid}`; st.cur = dest; redraw(); }
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
  function stageAsk() {
    if (st.ask?.apply) { st.ask = null; return app.apply(); }
    if (st.ask?.change) { const c = changeAsk(); st.ask = null; if (c) app.stage(c); return redraw(); }
    if (st.ask?.merges) { const { merges, into } = st.ask; st.ask = null; for (const from of merges) app.stage({ kind: 'merge', from, into }); st.ticks.clear(); return redraw(); }
    const issue = st.ask && ISS()[st.ask.i]; st.ask = null; if (!issue) return redraw();
    const c = issue.change;
    app.stage({ ...c });
    if (c.kind === 'merge' && st.cur === c.from) st.cur = c.into;
    if (c.kind === 'remove' && st.cur === c.tag) st.cur = Mo.parentOf(M(), c.tag) ?? Mo.tops(M())[0] ?? M().kinds[0].id;
    redraw();
  }
  async function openNodes(id) {
    const list = await app.readNodes(id);
    jump(() => { st.nodes = { tag: id, list, ticks: new Set(), all: false, cur: 0 }; st.view = 'nodes'; st.propCur = null; st.cur = id; });
  }
  const show = what => jump(() => { st.view = what; st.propCur = null; st.nodes = null; st.whole.clear(); });   // 'tree' from the views line, 'table', 'health'
  
  // ---------- events ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-all],[data-fold],[data-tick],[data-ntick],[data-row],[data-go],[data-open],[data-unrange],[data-addrange],[data-prop],[data-fix],[data-stage],[data-leave],[data-sort],[data-apply],[data-discard],[data-drop],[data-undo],[data-act],[data-do],[data-show],[data-compare],[data-aim],[data-aimtop],[data-aimoff],[data-back],[data-pick],[data-nodes],[data-more],[data-node],[data-split],[data-gfold],[data-gname],[data-gdrop],[data-gnew]');
    if (!t) { if (st.menu) { st.menu = null; redraw(); } return; }
    if (e.target.matches?.('[data-edit]')) return;   // a click in a field being written stays in the field
    e.stopPropagation(); e.preventDefault();
    if (t.hasAttribute('data-split')) { st.split = !st.split; return redraw(); }
    if (t.dataset.gfold) { const G = app.groups(), g = G.list.find(x => x.id === t.dataset.gfold); if (g) { g.open = g.open === false; if (g.open) st.glide = true; app.saveGroups(G); } return redraw(); }
    if (t.dataset.gname) { const g = app.groups().list.find(x => x.id === t.dataset.gname); return g ? startEdit('gname', g.id, g.name) : redraw(); }
    if (t.hasAttribute('data-gnew')) return startEdit('gnew', '', '');
    if (t.dataset.gdrop) {   // the group goes; what it held goes up a level, nothing else changes
      const G = app.groups(), g = G.list.find(x => x.id === t.dataset.gdrop); if (!g) return redraw();
      for (const k of G.list) if (k.under === g.id) k.under = g.under ?? null;
      for (const [ident, id] of Object.entries(G.of)) if (id === g.id) { if (g.under) G.of[ident] = g.under; else delete G.of[ident]; }
      G.list = G.list.filter(x => x !== g); app.saveGroups(G); return redraw();
    }
    if (t.dataset.fold) { if (t.closest('[data-pane="2"]')) { const id = keyOf(t.dataset.fold), o = st.pane2.open; if (o.has(id)) o.delete(id); else { o.add(id); st.glide = true; } return redraw(); } return fold(keyOf(t.dataset.fold)); }
    if (t.dataset.tick) return tick(keyOf(t.dataset.tick));
    if (t.dataset.ntick) { const x = st.nodes.list[+t.dataset.ntick]; st.nodes.ticks.has(x.uuid) ? st.nodes.ticks.delete(x.uuid) : st.nodes.ticks.add(x.uuid); st.nodes.cur = +t.dataset.ntick; return redraw(); }
    if (t.dataset.open) return app.openNode(t.dataset.open, e.shiftKey);
    if (t.dataset.go) { const id = keyOf(t.dataset.go); return mode === 'side' ? app.openMain(id) : app.openNode(T(id)?.uuid, e.shiftKey); }
    if (t.dataset.aim) return startAim(t.dataset.aim, [...st.ticks]);
    if (t.hasAttribute('data-aimtop')) return finishAim(LOOSE);
    if (t.hasAttribute('data-aimoff')) { st.aim = null; return redraw(); }
    if (t.hasAttribute('data-compare')) { st.compare = !st.compare; return redraw(); }
    if (t.dataset.unrange) { const pid = opts.prop; app.stage({ kind: 'setRange', prop: pid, to: P(pid).range.filter(id => id !== Number(t.dataset.unrange)) }); return redraw(); }
    if (t.dataset.addrange) { const pid = Number(t.dataset.addrange.split('·')[1]); return startPrompt({ what: 'range', list: 'tags', prop: pid }); }
    if (t.dataset.fix) return fix(+t.dataset.fix);
    if (t.hasAttribute('data-stage')) return stageAsk();
    if (t.hasAttribute('data-leave')) { st.ask = null; return redraw(); }
    if (t.dataset.sort) { st.sort = t.dataset.sort; return redraw(); }
    if (t.dataset.prop) { if (mode === 'tag') return; return app.openNode(P(Number(t.dataset.prop.split('·')[1]))?.uuid, e.shiftKey); }
    if (t.dataset.do) return act(t.dataset.do, t.dataset.do.startsWith('p') && t.dataset.do !== 'page' || t.dataset.do === 'split' ? t.dataset.on : keyOf(t.dataset.on), e.shiftKey);
    if (t.dataset.show) return show(t.dataset.show);
    if (t.dataset.back !== undefined) { const to = +t.dataset.back; while (st.trail.length > to + 1) st.trail.pop(); return back(); }
    if (t.dataset.pick) return finishPrompt(st.prompt.shown[+t.dataset.pick]);
    if (t.dataset.act) return act(t.dataset.act, st.menu.on, e.shiftKey);
    if (t.dataset.nodes) return openNodes(keyOf(t.dataset.nodes));
    if (t.hasAttribute('data-more')) { st.nodes.all = true; return redraw(); }
    if (t.dataset.all) { st.whole.add(t.dataset.all); return redraw(); }
    if (t.dataset.node) { st.nodes.cur = +t.dataset.node; return redraw(); }
    if (t.hasAttribute('data-apply')) return pressApply();
    if (t.hasAttribute('data-discard')) return app.discard();
    if (t.hasAttribute('data-undo')) return app.undo();
    if (t.dataset.drop !== undefined) return app.dropChange(+t.dataset.drop);
    if (t.dataset.row) { const id = keyOf(t.dataset.row); st.menu = null; if (st.aim && mode === 'page') return finishAim(id); if (mode === 'side') { loc.cur = id; if (e.detail === 2) return app.openMain(id); return redraw(); } if (e.detail === 2) return app.openNode(T(id)?.uuid, e.shiftKey); st.cur = id; st.propCur = null; st.view = 'tree'; st.nodes = null; st.trail = []; st.ask = null; return redraw(); }   // a press on the tree starts a new way: the trail is for jumps
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
    if (!t || t.missing) { e.preventDefault(); return; }
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
      const G = app.groups(), to = el.dataset.group || null;
      if (d.prop != null) { if (to) G.of[d.prop] = to; else delete G.of[d.prop]; }
      else { const g = G.list.find(x => x.id === d.group); if (g) { g.under = to; G.list = [...G.list.filter(x => x !== g), g]; } }
      if (to) { const g = G.list.find(x => x.id === to); if (g) g.open = true; }
      app.saveGroups(G); redraw(); return;
    }
    const dest = dragOf(e); if (!canDrop(dest)) return;
    e.preventDefault(); e.stopPropagation();
    const tags = st.drag.tags; st.drag = null;
    moveTags(tags, dest); loc.cur = tags[0]; redraw();
  });
  root.addEventListener('dragend', () => { st.drag = null; st.gdrag = null; root.removeAttribute('data-dragging'); for (const o of root.querySelectorAll('.over, .dragging')) o.classList.remove('over', 'dragging'); });
  // The right-click menu, on a row or a property line; it acts on what was clicked and leaves the cursor where it is.
  root.addEventListener('contextmenu', e => {
    const r = e.target.closest('[data-row]'), p = e.target.closest('[data-prop]');
    if (!r && !p) return;
    e.preventDefault(); e.stopPropagation();
    const box = root.getBoundingClientRect();
    st.menu = { kind: r ? 'row' : 'prop', on: r ? keyOf(r.dataset.row) : p.dataset.prop, x: e.clientX - box.left, y: e.clientY - box.top, owner: mode };
    st.ask = null;
    redraw();
  });
  root.addEventListener('input', e => {
    if (e.target.matches('[data-find]')) { loc.find = e.target.value; draw(); }
    else if (e.target.matches('[data-find2]')) { st.pane2.find = e.target.value; draw(); }
    else if (e.target.matches('[data-pin]')) { st.prompt.text = e.target.value; st.prompt.lit = 0; draw(); }
    else if (e.target.matches('[data-edit]')) st.edit.text = e.target.value;
  });
  /* Keys typed here stay here, but for Logseq's own two-key shortcuts, which work on the map as anywhere: Cmd-K, Cmd-Shift-P, Cmd-[ and
     Cmd-]. The map keeps those it does itself, each what Logseq's does on a page: Cmd-F finds, Cmd-O goes to the row's page (Shift: the
     sidebar, as Shift-Enter), Cmd-Down and Cmd-Up open and fold, Cmd-Z takes back. A field keeps what writing in it needs. A letter alone never reaches Logseq: it finds. */
  const FIELD = /^(a|c|f|v|x|y|z|enter|backspace)$/i, OWN = mode === 'page' ? /^(f|o|enter|backspace|arrowup|arrowdown)$/i : /^(f|o|arrowup|arrowdown)$/i;
  const passes = e => {
    if (doc.querySelector('.ui__dialog-overlay')) return true;   // one of Logseq's windows stands over the map: its keys are all Logseq's
    if (!e.metaKey && !e.ctrlKey && !e.altKey) return false;
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return !e.altKey && !FIELD.test(e.key);
    return e.altKey || !OWN.test(e.key);
  };
  const standing = () => st.prompt?.owner === mode || st.edit?.owner === mode || !!st.ask;
  for (const type of ['keyup', 'keypress']) root.addEventListener(type, e => { if (mode === 'tag' && !standing()) return; if (!passes(e)) e.stopPropagation(); });
  // Where Cmd-O and Shift-Enter go: the node or property on screen, else the row the cursor is on.
  function openHere(inSidebar) {
    const n = st.view === 'nodes' && mode === 'page' ? st.nodes?.list[st.nodes.cur] : null, pid = mode === 'page' && st.propCur ? Number(st.propCur.split('·')[1]) : null;
    app.openNode(n?.uuid || (pid != null ? P(pid)?.uuid : T(loc.cur)?.uuid), inSidebar);
  }
  root.addEventListener('keydown', e => {
    if (mode === 'tag' && !standing()) return;
    if (!passes(e)) e.stopPropagation(); else if (doc.querySelector('.ui__dialog-overlay')) return;
    const k = e.key;
    if (st.prompt && st.prompt.owner === mode) {
      if (k === 'Escape') { st.prompt = null; redraw(); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { const rows = st.prompt.shown || [], by = k === 'ArrowDown' ? 1 : -1; for (let i = st.prompt.lit + by; rows[i]; i += by) if (rows[i].ok) { st.prompt.lit = i; break; } e.preventDefault(); draw(); }
      else if (k === 'Enter') { e.preventDefault(); finishPrompt(st.prompt.shown?.[st.prompt.lit]); }
      return;
    }
    if (st.edit && st.edit.owner === mode && e.target.matches('[data-edit]')) {
      if (k === 'Escape') { st.edit = null; redraw(); } else if (k === 'Enter') { e.preventDefault(); finishEdit(e.target.value); }
      return;
    }
    if (e.target.matches('[data-find2]')) { if (k === 'Escape') { st.pane2.find = ''; redraw(); } return; }
    if (e.target.matches('[data-find]')) {
      if (k === 'Escape') { loc.find = ''; redraw(); }
      else if (k === 'ArrowDown' || k === 'Enter') { const first = visibleRows().find(r => !r.dim); if (first) loc.cur = first.n; e.preventDefault(); redraw(); }
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    if (st.menu && k === 'Escape') { st.menu = null; redraw(); return; }
    if (st.aim && mode === 'page') { if (k === 'Escape') { e.preventDefault(); st.aim = null; return redraw(); } if (k === 'Enter') { e.preventDefault(); return finishAim(st.cur); } }
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const l = k.toLowerCase();
      if (mode === 'page' && k === 'Enter' && app.tray.changes.length) { e.preventDefault(); pressApply(); }
      else if (mode === 'page' && k === 'Backspace' && app.tray.changes.length) { e.preventDefault(); app.discard(); }
      else if (l === 'f') { e.preventDefault(); const f = root.querySelector('[data-find]'); f.focus(); f.select(); }
      else if (l === 'o') { e.preventDefault(); openHere(e.shiftKey); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); fold(loc.cur, k === 'ArrowDown'); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (st.ask && mode === 'page') {
      if (k === 'Enter') { e.preventDefault(); return stageAsk(); }
      if (k === 'Escape') { e.preventDefault(); st.ask = null; return redraw(); }
    }
    if (mode === 'tag') return;
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
    const rows = visibleRows().map(r => r.n), i = rows.indexOf(loc.cur);
    const cur = T(loc.cur), isKind = !cur || cur.missing || loc.cur === LOOSE;
    // A letter typed on the tree finds a tag, as in any outline; nothing a single letter does.
    if (k.length === 1 && k !== ' ') { const f = root.querySelector('[data-find]'); if (!f) return; e.preventDefault(); loc.find = k === '/' ? loc.find : loc.find + k; draw(); const g = root.querySelector('[data-find]'); g.focus(); g.setSelectionRange(g.value.length, g.value.length); return; }
    const walked = to => { loc.cur = to; if (mode === 'page') { st.propCur = null; st.walking = true; if (st.view === 'tree') st.trail = []; } };   // the arrows are the tree, as a press on it is
    if (k === 'ArrowDown') walked(rows[Math.min(rows.length - 1, i + 1)]);
    else if (k === 'ArrowUp') walked(rows[Math.max(0, i - 1)]);
    else if (k === 'ArrowRight') { if (e.shiftKey) { openAll(loc.cur); return; } if (Mo.kids(M(), loc.cur).length) st.open.add(loc.cur); }
    else if (k === 'ArrowLeft') { if (st.open.has(loc.cur)) st.open.delete(loc.cur); else if (Mo.parentOf(M(), loc.cur) != null) walked(Mo.parentOf(M(), loc.cur)); }
    else if (k === 'Enter') { if (e.shiftKey) openHere(true); else if (mode === 'side') app.openMain(loc.cur); else if (st.view !== 'tree' || st.propCur) jump(() => { st.view = 'tree'; st.propCur = null; st.nodes = null; }); else if (cur) app.openNode(cur.uuid, false); return; }
    else if (k === ' ' && mode === 'page') { tick(st.cur); return; }
    else if (k === 'Escape') {
      // The ladder: let go of what is nearest first (the find text, the ticks), then walk back the trail; with nothing left, the
      // keyboard goes back to Logseq, so a letter is Logseq's again (its t and g pairs) and no longer finds a tag here.
      if (loc.find) loc.find = ''; else if (mode === 'page' && st.ticks.size) st.ticks.clear(); else if (mode === 'page' && back()) return; else { e.preventDefault(); root.blur(); return; }
    }
    else if (k === 'Tab') { if (mode === 'side' || isKind) return; const p = Mo.parentOf(M(), st.cur); if (p == null) return; e.preventDefault(); const sib = Mo.kids(M(), p), j = sib.indexOf(st.cur); if (e.shiftKey) { const gp = Mo.parentOf(M(), p); if (gp != null) { app.stage({ kind: 'move', tag: st.cur, to: gp }); st.ticks.delete(st.cur); } } else if (j > 0) { app.stage({ kind: 'move', tag: st.cur, to: sib[j - 1] }); st.open.add(sib[j - 1]); st.ticks.delete(st.cur); } redraw(); return; }
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
  if (mode === 'page') { win.addEventListener('hashchange', toPlace); doc.addEventListener('keydown', undoKey, true); }
  if (mode === 'page') win.addEventListener('resize', draw);
  const view = { root, mode, tag: opts.tag, prop: opts.prop, draw, destroy: () => { app.views.delete(view); win.removeEventListener('hashchange', toPlace); win.removeEventListener('resize', draw); doc.removeEventListener('keydown', undoKey, true); root.remove(); }, focus: () => { if (mode === 'tag') return; if (!doc.activeElement?.matches('input, textarea, [contenteditable="true"]')) root.focus({ preventScroll: true }); } };
  app.views.add(view);
  return view;
}

S.view = { make, ensureStyle, CSS };
})();
