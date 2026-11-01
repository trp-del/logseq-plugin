/* The screen, as the mockup draws it: the tree on the left (the four kinds on top, your tags under them, each row a
   name, the nodes under it and a dot when an issue sits on or below it), the card on the right (one path line, the
   thing's name, what it can take as words, where it sits, what it has, what points at it, its issues), the tray on top of it
   (the changes waiting, as sentences with the nodes they touch, Apply and Discard, and the last Apply's one Undo). Every property as
   one sortable list and the Health list open from words on the path line. Nothing a single letter does: letters typed on
   the tree find a tag, as in any outline; what a thing can take is written on its card and in its right-click menu.
   Escape walks back the way you came. A fix first says what it would do, with the nodes it touches, and is staged only
   on a second yes. A change waiting in the tray is pencilled in where it will happen (italic, the dotted line).
   The same drawing serves the main view and the right sidebar (the tree alone there, with a cursor of its own). It is
   drawn into Logseq's own document, so the shared stylesheet reaches it: the shared names (lk-row, lk-fold, lk-list, lk-tick,
   lk-node, lk-undo) sit on what they name and carry no look of their own here; the rest is the mockup's stylesheet on
   the grammar's tokens (greys mixed from the text colour, hairlines and space instead of boxes). */
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

const CSS = `
.st { --st-quiet: var(--lk-quiet); --st-faint: var(--lk-faint); --st-hair: var(--lk-hair); --st-line: var(--lk-line); --st-wash: var(--lk-wash);
  --st-ring: color-mix(in srgb, currentColor 11%, transparent); --st-mono: var(--lk-mono);
  color: var(--lk-text, #222); font-size: 14px; line-height: 1.5; outline: none; position: relative; }
.st * { box-sizing: border-box; }
.st-page { display: grid; grid-template-columns: 308px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); height: 600px; min-height: 360px; }
.st-left { grid-row: 1 / -1; border-right: 1px solid var(--st-hair); padding: 12px 10px 12px 14px; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.st-right { grid-column: 2; grid-row: 2; padding: 14px 22px 56px 26px; min-width: 0; min-height: 0; overflow: auto; container-type: inline-size; }
.st-side .st-left { border: 0; padding: 4px 4px 8px 6px; }
/* The tray stands on top of the card, where a change is made, above what scrolls, so Apply is always in reach. The card's foot keeps clear of Logseq's help button, which stands over that corner. */
.st-tray { grid-column: 2; grid-row: 1; border-bottom: 1px solid var(--st-hair); padding: 10px 22px 10px 26px; font-size: 14px; min-width: 0; }
.st-tray:empty { display: none; }
.st-tray .st-wait { overflow: visible; } .st-tray .st-wait .lk-btn:first-of-type { margin-left: auto; } .st-tray .st-wait .lk-btn:first-of-type::before { display: none; }
.st-tray .tl { display: grid; gap: 1px; min-width: 0; margin-top: 4px; }
/* A line of the tray: the sentence, then in a column of its own how many nodes it affects, so the two are never read as one. */
.st-tray .tl > span { display: grid; grid-template-columns: minmax(0, 1fr) max-content 16px; gap: 0 12px; align-items: baseline; color: var(--lk-text, #222); font-size: 13.5px; }
.st-tray .tl span i { color: var(--st-quiet); font-style: normal; font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-tray .tl .lk-x { justify-self: end; padding: 0 2px; }
.st-tray .st-wait .lk-accent { padding: 3px 8px; }
.st-tray .ky { font-weight: 400; color: var(--st-faint); font-size: 12px; margin-left: 6px; }
/* The yes to what Undo cannot put back whole (the library's), under the lines it answers for. */
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
/* Every box at the middle of its row's first line, in one straight column whatever the row's depth. */
.st .st-row > input.lk-tick[type=checkbox] { margin-top: 6.5px !important; margin-left: calc(14.5px - var(--d, 0) * 12px - var(--st-in, 0px)) !important; }
/* Under a kind a name starts right of the kind's name, past the kind's mark. */
.st-tree .st-row:not(.kind):not(.loose) { --st-in: 9px; padding-left: calc(var(--d, 0) * 12px + var(--st-in)); }
.st-row .lk-fold { display: inline-flex; width: 14px; height: 20px; margin-top: 3px; align-items: center; justify-content: center; cursor: pointer; }
.st-row .lk-fold svg { width: 10px; height: 10px; transition: transform .12s; } .st-row .lk-fold[aria-expanded="true"] svg { transform: rotate(90deg); }
.st-row .st-km { width: 10px; height: 10px; color: var(--st-quiet); flex: none; }
.st-row .nm { min-width: 0; padding: 3px 0; line-height: 20px; overflow-wrap: anywhere; display: flex; gap: 7px; align-items: baseline; }
.st-row.kind .nm { font-weight: 500; }
.st-row.dim .nm, .st-row.dim .ct, .st-row.loose .nm { color: var(--st-faint); }
.st-row .ct { text-align: right; line-height: 26px; color: var(--st-quiet); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.st-row .iss { width: 5px; height: 5px; margin-top: 10.5px; border-radius: 50%; background: currentColor; opacity: 0; justify-self: center; }
.st-row .iss.on { opacity: .35; } .st-row .iss.own { opacity: .7; }
/* Everything that presses shows it under the pointer, and nothing else does: a line or a row that opens a card, a number, the rest of a list. */
.st [data-row], .st [data-prop], .st [data-nodes], .st [data-node], .st [data-pick], .st [data-all], .st [data-more], .st [data-go], .st [data-back], .st [data-open] { cursor: pointer; }
.st .lk-view.on { cursor: default; } .st-row.off[data-pick] { cursor: default; }
.st-row.dragging { opacity: .4; }
.st-row.over { background: var(--st-wash); box-shadow: inset 0 2px 0 var(--st-line); }
/* Pencilled in (Look's lk-pencil on the name): what a change waiting in the tray touches. */
/* The pick bar, as the grammar draws it: above the list, how many and what can be done as quiet words, Esc clears. */
.st-pick { margin: 0 0 8px; min-height: 27px; flex-wrap: nowrap; }
.st-nodes .st-pick { margin: 0 0 6px; }
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
/* The On column gets the room its three names and the count need, taken from Name and Points at, which hold one word each. */
.st-tbl .hd, .st-tbl .tr { display: grid; grid-template-columns: 16px minmax(96px, .8fr) minmax(0, 2fr) minmax(0, 1fr) 96px; gap: 0 12px; align-items: center; min-height: 26px; padding: 0 4px; border-radius: 3px; }
.st-tbl .hd { font-size: 12.5px; border-bottom: 1px solid var(--st-hair); margin-bottom: 4px; min-height: 22px; }
.st-tbl .tr:hover { background: var(--st-wash); }
.st-tbl .tr .on { color: var(--st-quiet); }
.st-tbl .to { color: var(--st-faint); font-size: 12px; margin: 0 4px; }
.st-tbl .tr > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
/* A narrow pane (the right sidebar open): the table keeps its four columns, the tag columns wrapping. */
@container (max-width: 640px) { .st-tbl .hd, .st-tbl .tr { grid-template-columns: 16px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 72px; gap: 0 8px; } .st-tbl .hd span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .st-ln { grid-template-columns: 16px minmax(0, 1fr) 72px; } }
.st-tbl .tr .ct { font-variant-numeric: tabular-nums; color: var(--st-quiet); font-size: 12.5px; text-align: right; }
.st-tbl .tr.low .ct { color: var(--st-faint); }
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
.st-prompt .st-row.lit { background: var(--st-wash); }
.st-empty { color: var(--st-quiet); max-width: 60ch; }
@media (max-width: 760px) { .st-page { grid-template-columns: 1fr; grid-template-rows: auto auto auto; height: auto; } .st-left { grid-row: 1; border-right: 0; border-bottom: 1px solid var(--st-hair); } .st-tray { grid-column: 1; grid-row: 2; } .st-right { grid-column: 1; grid-row: 3; } }`;

function ensureStyle(doc) {
  let sheet = doc.getElementById('st-style');
  if (!sheet) { sheet = doc.createElement('style'); sheet.id = 'st-style'; sheet.className = 'st-own'; doc.head.appendChild(sheet); }
  if (sheet.textContent !== CSS) sheet.textContent = CSS;
}

/* make(holder, mode, app): draws the screen into holder; mode is 'page' (tree, card, tray) or 'side' (the tree alone).
   app holds the state every view shares (logseq/main.js): the tray with its model, the cursor, what is open and ticked,
   the trail. The sidebar's tree has a cursor and a find box of its own (app.st.side), so reading a page's tag there
   never moves the main view. */
function make(holder, mode, app) {
  const doc = holder.ownerDocument;
  ensureStyle(doc);
  const st = app.st;
  const loc = mode === 'side' ? st.side : st;   // the cursor and the find text this view uses
  const root = doc.createElement('div');
  root.className = `st ${mode === 'side' ? 'st-side' : 'st-page'}`;
  root.tabIndex = 0;
  holder.appendChild(root);
  const M = () => app.tray.model;
  const T = id => M().tags.get(id);
  const P = id => M().props.get(id);
  const name = id => id === LOOSE ? 'Not under a kind' : T(id)?.title ?? '';
  const ISS = () => app.issues();
  const own = id => R.issuesOn(ISS(), id).length, below = id => R.issuesUnder(M(), ISS(), id).length;
  const touched = () => app.touched();
  const waitTag = id => touched().tags.has(id) ? 'wait' : '', waitProp = id => touched().props.has(id) ? 'wait' : '';
  let wantFocus = false;   // a press in this view asked for the keyboard; nothing else takes it

  // ---------- the tree ----------
  function visibleRows() {
    const m = M(), rows = [];
    const tops = [...m.kinds.map(k => k.id), LOOSE];   // the root row always: where a new root tag is made, where a tag is dropped out of every kind
    const q = loc.find.trim().toLowerCase();
    if (q) {
      const hit = new Set([...m.tags.values()].filter(t => !t.missing && t.title.toLowerCase().includes(q)).map(t => t.id));
      const show = new Set();
      for (const h of hit) { for (const a of Mo.pathOf(m, h)) show.add(a); if (!Mo.kindOf(m, h) && !T(h).parents.length) show.add(LOOSE); }
      const walk = (n, d) => { if (!show.has(n)) return; rows.push({ n, d, dim: !hit.has(n), open: true, kids: Mo.kids(m, n).length }); for (const k of Mo.kids(m, n)) walk(k, d + 1); };
      tops.forEach(k => walk(k, 0));
      return rows;
    }
    for (const top of tops) if (!st.seen.has(top)) { st.seen.add(top); st.open.add(top); }   // a kind starts open, and folds like any row
    const walk = (n, d) => { const kids = Mo.kids(m, n); const open = st.open.has(n); rows.push({ n, d, open, kids: kids.length }); if (open) kids.forEach(k => walk(k, d + 1)); };
    tops.forEach(k => walk(k, 0));
    return rows;
  }
  function rowHtml(r) {
    const t = r.n === LOOSE ? null : T(r.n), isKind = r.d === 0, side = mode === 'side';
    const o = own(r.n), b = below(r.n);
    const arrow = r.kids ? `<span class="lk-fold" data-fold="${esc(r.n)}" aria-expanded="${r.open}">${CHEVRON}</span>` : '<span></span>';
    const bullet = `<span class="st-bul ${r.kids && !r.open ? 'folded' : ''}"><i></i></span>`;
    const editing = st.edit && st.edit.what === 'rename' && st.edit.on === r.n;
    const nm = editing ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : esc(name(r.n));
    const canDrag = t && !t.kind && !t.missing && !editing;
    let h = `<div class="st-row lk-row ${isKind ? 'kind' : ''} ${r.n === LOOSE ? 'loose' : ''} ${r.dim ? 'dim' : ''} ${t?.missing ? 'dim' : ''} ${loc.cur === r.n ? 'cur' : ''} ${waitTag(r.n)}" style="--d:${r.d}" data-row="${esc(r.n)}" ${canDrag ? 'draggable="true"' : ''}>` +
      (side ? '' : `<input type="checkbox" class="lk-tick" data-tick="${esc(r.n)}" ${st.ticks.has(r.n) ? 'checked' : ''} ${isKind || r.n === LOOSE ? 'disabled style="visibility:hidden"' : ''}>`) +
      arrow + bullet +
      `<span class="nm">${isKind && t?.kind ? km(t.kind) : ''}<span class="${waitTag(r.n) ? 'lk-pencil' : ''}">${nm}</span></span><span class="ct">${Mo.count(M(), r.n) || ''}</span><span class="iss ${o ? 'own' : b ? 'on' : ''}"></span></div>`;
    if (st.edit && st.edit.what === 'new' && st.edit.on === r.n && st.edit.owner === mode) h += `<div class="st-row lk-row" style="--d:${r.d + 1}"><span></span><span></span><span class="st-bul"><i></i></span><span class="nm"><input class="st-in" data-edit value="${esc(st.edit.text)}" placeholder="a new tag under ${esc(name(r.n))}" autocomplete="off" spellcheck="false"></span><span class="ct"></span><span class="iss"></span></div>`;
    if (st.prompt && st.prompt.owner === mode && st.prompt.row === r.n) { h += promptHtml(); promptDrawn = true; }
    return h;
  }
  function treeHtml() {
    const rows = visibleRows();
    promptDrawn = false;
    const picked = mode === 'page' && st.ticks.size ? `<div class="st-pick lk-bar"><b class="lk-said">${st.ticks.size} ticked</b><span class="act lk-btn" data-do="move" data-on="${esc(st.cur)}">move under…</span><span class="esc lk-hint">Esc clears</span></div>` : '';
    const n = ISS().length, v = st.view === 'health' ? 'health' : st.view === 'table' ? 'table' : 'tree';
    // Ticks take the place of the three words, so the rows stay where they were; what merges them stands on the card beside it.
    const views = mode === 'side' ? '' : picked || `<div class="st-views lk-views">${[['tree', 'tags'], ['table', 'every property'], ['health', `health${n ? ` · ${n}` : ''}`]].map(([k, w]) => `<span class="lk-view ${v === k ? 'here on' : 'act'}" ${v === k ? '' : `data-show="${k}"`}>${w}</span>`).join('')}</div>`;
    return `<div class="st-left">${views}<div class="st-find"><input data-find placeholder="find a tag…" value="${esc(loc.find)}" autocomplete="off" spellcheck="false"><span class="n">${loc.find.trim() ? rows.filter(r => !r.dim).length : ''}</span></div>` +
      `<div class="st-tree lk-list" ${st.ticks.size ? 'data-picking' : ''}>${rows.map(rowHtml).join('')}</div></div>`;
  }

  // ---------- the top line of every content: the path, ending on the thing itself; where to go back; the two lists ----------
  const placeName = p => p.view === 'table' ? 'every property' : p.view === 'health' ? 'Health' : p.view === 'nodes' ? `the nodes of ${name(p.nodes?.tag)}` : p.propCur ? P(Number(p.propCur.split('·')[1]))?.title ?? '' : name(p.cur);
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
  const acts = (on, list) => { const l = list.filter(Boolean); return l.length ? `<div class="acts lk-strip">${l.map(([word, a]) => `<span class="act lk-btn" data-do="${a}" data-on="${esc(on)}">${word}</span>`).join('')}</div>` : ''; };

  // ---------- the card ----------
  // A tag named on a card or in the table: plain words with the faint underline, as the mockup draws it (a run of small mono
  // names was hard to read, the owner, 30 October 2026); where it stands already says it is a tag.
  const tagLink = id => `<span class="lk-tag tg ${waitTag(id) ? 'lk-pencil' : ''}" data-go="${esc(id)}">${esc(name(id))}</span>`;
  // A range of many tags (Topic, on purpose, takes fifteen): the first three, then how many more; the property's card lists them all.
  const ranges = ids => ids.slice(0, 3).map(tagLink).join('<span class="to">·</span>') + (ids.length > 3 ? `<span class="to">and ${ids.length - 3} more</span>` : '');
  // An issue that belongs to a line puts its fix word at the line's right end, after the faint count, with its ask under the line.
  const lineFix = (tagId, pid, kid) => { const i = R.issueOnLine(ISS(), tagId, pid, kid); return i ? { cls: 'fx', word: `<span class="fix act lk-fix" data-fix="${ISS().indexOf(i)}">${esc(i.fix)}</span>`, ask: askHtml(ISS().indexOf(i)) } : { cls: '', word: '', ask: '' }; };
  function propLine(tagId, pid, of, inh) {
    const p = P(pid), f = Mo.filled(M(), tagId, pid), low = of && f / of < .2;
    const editing = st.edit && st.edit.what === 'prename' && st.edit.on === `${tagId}·${pid}`;
    const fx = inh ? { cls: '', word: '', ask: '' } : lineFix(tagId, pid);
    return `<div class="st-ln ${inh ? 'inh' : ''} ${low ? 'low' : ''} ${fx.cls} ${waitProp(pid)}" data-prop="${tagId}·${pid}">${pi(p)}<span class="w">` +
      (editing ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : `<span class="k lk ${waitProp(pid) ? 'lk-pencil' : ''}">${esc(p.title)}</span>`) +
      (p.type === 'node' ? `<span class="to">points at</span>${p.range.length ? ranges(p.range) : '<span class="to">any node</span>'}` : '') +
      (inh ? `<span class="to">inherited from ${esc(name(inh))}</span>` : '') +
      `</span><span class="ct">${f} of ${of}</span>${fx.word}</div>${fx.ask}`;
  }
  function cardTag(id) {
    const m = M(), t = T(id);
    if (id === LOOSE) return cardLoose();
    if (!t) return `<div class="st-card">${trailHtml()}<div class="st-empty">Pick a tag on the left.</div></div>`;
    const path = Mo.pathOf(m, id), total = Mo.count(m, id), kids = Mo.kids(m, id), kind = Mo.kindOf(m, id);
    let h = `<div class="st-card">` + trailHtml() + titleHtml(km(kind), esc(t.title), path.slice(0, -1).reverse(), waitTag(id));
    const newest = m.newest.get(id);
    h += `<div class="sum"><span class="${total ? 'lk-lone' : ''}" ${total ? `data-nodes="${id}"` : ''}>${plural(total, 'node')}${t.nodes.size && kids.length ? `, ${t.nodes.size} carrying the tag itself` : ''}</span>${kids.length ? `<span>${plural(kids.length, 'tag')} under it</span>` : ''}` +
      (t.parents.length > 1 ? `<span>also under ${t.parents.slice(1).map(tagLink).join(', ')}</span>` : '') +
      (!path.slice(0, -1).length && !t.kind ? `<span>under no kind</span>` : '') +
      `${newest ? `<span>newest ${day(newest)}</span>` : ''}${t.missing ? `<span>no tag of this name in the graph yet; one is made when something is moved under it</span>` : ''}</div>`;
    // What it can take, as words. A kind takes less; a missing kind only a new tag.
    const ticked = [...st.ticks].filter(x => x !== id && T(x));
    const go = t.uuid && ['go to this tag', 'page'];
    // While a question stands on this card it is what the card is for: the words give way to it.
    const asked = st.ask?.merges && st.ask.into === id || changeAsk()?.tag === id;
    if (!asked) h += acts(id, t.kind ? [go, !t.missing && ['rename', 'rename'], ['new tag inside', 'new'], ['add a property to all beneath…', 'addpropall']]
      : [go, ['rename', 'rename'], ['move under…', 'move'], ['new tag inside', 'new'], ['add a property…', 'addprop'], kids.length && ['add a property to all beneath…', 'addpropall'],
        ticked.length && [`merge the ${ticked.length === 1 ? 'ticked tag' : ticked.length + ' ticked tags'} into this`, 'merge'], !total && !kids.length && ['remove', 'remove']]);
    h += mergeAskHtml(id) + changeAskHtml(id) + cardPrompt();
    const inh = Mo.inherited(m, id);
    if (t.props.length || inh.length) {
      h += `<h3>Has</h3>`;
      h += [...t.props].sort((a, b) => Mo.filled(m, id, b) - Mo.filled(m, id, a)).map(p => propLine(id, p, total, false)).join('');
      h += inh.map(x => propLine(id, x.prop, total, x.from)).join('');
    }
    const pa = Mo.pointedAt(m, id);
    if (pa.length) h += `<h3>Points at it</h3>` + pa.map(x => `<div class="st-ln ${waitProp(x.prop)}" data-prop="${x.tag}·${x.prop}">${pi(P(x.prop))}<span class="w"><span class="k lk ${waitProp(x.prop) ? 'lk-pencil' : ''}">${esc(P(x.prop).title)}</span><span class="to">on</span>${tagLink(x.tag)}</span><span class="ct">${x.filled}</span></div>`).join('');
    h += issuesHtml(R.issuesOn(ISS(), id).filter(i => !(i.line && i.line.tag === id)));   // the ones with a line of their own sit on it
    return h + `</div>`;
  }
  function cardLoose() {
    const m = M();
    let h = `<div class="st-card">${trailHtml()}${titleHtml('', 'Not under a kind', [], '')}`;
    h += `<div class="sum"><span>${m.loose.length ? `${plural(m.loose.length, 'tag')} under none of the four kinds` : 'every tag sits under a kind'}</span></div>`;
    h += acts(LOOSE, [['new tag here', 'new']]) + cardPrompt();
    if (m.loose.length) h += `<h3>Tags</h3>` + m.loose.map(id => `<div class="st-ln ${waitTag(id)}"><span></span><span class="w">${tagLink(id)}</span><span class="ct">${Mo.count(m, id) || ''}</span></div>`).join('');
    return h + `</div>`;
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
  const issueLine = (i, lead) => { const n = ISS().indexOf(i); return `<div class="st-ln iss">${lead}<span class="w">${partsHtml(i.parts)}</span><span class="fix act lk-fix" data-fix="${n}">${esc(i.fix)}</span></div>` + askHtml(n); };
  const issuesHtml = list => !list.length ? '' : `<h3>Issues</h3>` + list.map(i => issueLine(i, '<span></span>')).join('');
  const askLine = (c, last) => {
    const s = S.changes.sentence(M(), c), two = c.kind === 'merge';
    const words = last ? `<div class="lk-answers"><span class="act lk-accent" data-stage>stage it</span><span class="act lk-btn" data-leave>leave it</span><span class="ky lk-hint">Enter stages · Esc leaves it</span></div>` : '';
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
  // A property's name at the head of its card; rename writes here.
  const propTitle = (p, key) => st.edit?.what === 'prename' && st.edit.on === key ? `<input class="st-in" data-edit value="${esc(st.edit.text)}" autocomplete="off" spellcheck="false">` : esc(p.title);
  const pointsSum = p => `${p.type === 'node' ? `points at ${p.range.length === 1 ? tagLink(p.range[0]) : p.range.length ? plural(p.range.length, 'tag') : 'any node'}` : Mo.kindWord(p.choice ? 'choice' : p.type)}${p.many ? ', several' : ''}`;
  // What it points at, one tag a row with how many of its values point at that tag's nodes; × takes a tag out, the last line adds one.
  function pointsList(p, key) {
    const m = M(), at = m.pointed.get(p.ident) || new Map();
    return `<h3>Points at</h3>` + p.range.map(id => `<div class="st-ln rng"><span></span><span class="w">${tagLink(id)}<span class="x lk-x" data-unrange="${id}" title="Take ${esc(name(id))} out of what ${esc(p.title)} points at">×</span></span><span class="ct">${at.get(id) ? plural(at.get(id), 'value') : ''}</span></div>`).join('') +
      `<div class="st-ln add"><span></span><span class="w"><span class="act lk-add" data-addrange="${key}">${p.range.length ? 'another tag…' : 'a tag…'}</span></span><span class="ct">${[...at].filter(([id]) => !p.range.includes(id) && m.tags.has(id)).length ? `<span class="f">also found: ${[...at].filter(([id]) => !p.range.includes(id) && m.tags.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id, n]) => `${esc(name(id))} ${n}`).join(', ')}</span>` : ''}</span></div>`;
  }
  // A property on no tag has a card of its own, keyed 0·property: what it is, how many nodes hold it, and a tag to put it on.
  function cardNoTag(p, key) {
    return `<div class="st-card" data-propcard="${key}">` + trailHtml() + titleHtml(pi(p), propTitle(p, key), [], waitProp(p.id)) +
      `<div class="sum"><span>${pointsSum(p)}</span><span>on no tag</span><span>${plural(M().holders.get(p.ident)?.size || 0, 'node')}</span></div>` +
      acts(key, [p.uuid && ['go to this property', 'ppage'], ['rename', 'prename'], ['put on a tag…', 'pmove']]) + cardPrompt() + (p.type === 'node' ? pointsList(p, key) : '') + `</div>`;
  }
  function cardProp(key) {
    const m = M(), [tagId, pid] = key.split('·').map(Number), p = P(pid), t = T(tagId);
    if (p && !tagId) return p.on.length ? cardProp(`${p.on[0]}·${pid}`) : cardNoTag(p, key);
    if (!p || !t) return `<div class="st-card">${trailHtml()}<div class="st-empty">That property is no longer on this tag.</div></div>`;
    const of = Mo.count(m, tagId), f = Mo.filled(m, tagId, pid), declared = t.props.includes(pid), parent = Mo.parentOf(m, tagId), from = Mo.inherited(m, tagId).find(x => x.prop === pid)?.from;
    let h = `<div class="st-card" data-propcard="${key}">` + trailHtml() + titleHtml(pi(p), propTitle(p, key), [...Mo.pathOf(m, tagId)].reverse(), waitProp(pid));
    // The facts, said once: what it points at, how filled here (the title row's right end already names the tag), inherited.
    h += `<div class="sum"><span>${pointsSum(p)}</span><span>${f} of ${of} filled</span>${from != null ? `<span>inherited from ${esc(name(from))}</span>` : ''}</div>`;
    // What it can take, as short words on one line; another tag it points at is the last line of the Points at list below.
    h += acts(key, [p.uuid && ['go to this property', 'ppage'], ['rename', 'prename'], declared && ['move to…', 'pmove'], declared && parent != null && [`pull up to ${esc(name(parent))}`, 'pullup'],
      (p.choice || p.type === 'node') && t.nodes.size && ['split by its values…', 'split'], declared && ['drop', 'pdrop']]) + cardPrompt();
    if (p.type === 'node') h += pointsList(p, key);
    const kids = Mo.kids(m, tagId);
    if (kids.length) h += `<h3>Filled, by tag beneath</h3>` + [{ id: tagId, own: true }, ...kids.map(id => ({ id }))].map(({ id, own: o }) => { const c = o ? t.nodes.size : Mo.count(m, id); const fl = o ? Mo.filledOwn(m, tagId, pid) : Mo.filled(m, id, pid); const fx = o ? { cls: '', word: '', ask: '' } : lineFix(tagId, pid, id); return c || !o ? `<div class="st-ln ${fx.cls}"><span></span><span class="w">${tagLink(id)}${o ? '<span class="to">the tag itself</span>' : ''}</span><span class="ct">${fl} of ${c}</span>${fx.word}</div>${fx.ask}` : ''; }).join('');
    const same = p.on.filter(id => id !== tagId);
    if (same.length) h += `<h3>Also on</h3>` + same.map(id => `<div class="st-ln" data-prop="${id}·${pid}"><span></span><span class="w">${tagLink(id)}</span><span class="ct">${Mo.filled(m, id, pid)} of ${Mo.count(m, id)}</span></div>`).join('');
    h += issuesHtml(R.issuesOfProp(ISS(), pid).filter(i => !(i.line && i.line.tag === tagId && i.line.prop === pid && i.line.kid != null && kids.includes(i.line.kid))));   // the ones with a line of their own sit on it
    return h + `</div>`;
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
    let h = `<div class="st-card">${trailHtml()}${titleHtml('', 'Every property', [], '')}<div class="sum"><span>${plural(m.props.size, 'property').replace('propertys', 'properties')} on ${new Set(rows.flatMap(g => g.on.map(x => x.tag))).size} tags</span></div><div class="st-tbl">`;
    h += `<div class="hd"><span></span>${['name', 'on', 'to', 'filled'].map(c => `<span class="lk-head ${s === c ? 'on' : ''}" data-sort="${c}">${{ name: 'Name', on: 'On', to: 'Points at', filled: 'Filled' }[c]}</span>`).join('')}</div>`;
    h += few('table', rows).map(r => `<div class="tr ${r.pct < .2 ? 'low' : ''} ${waitProp(r.prop)}" data-prop="${r.tag}·${r.prop}">${pi(r.p)}<span><span class="k lk ${waitProp(r.prop) ? 'lk-pencil' : ''}">${esc(r.p.title)}</span></span><span class="on">${ranges(r.on.map(x => x.tag))}</span><span class="on">${r.p.type === 'node' ? (r.p.range.length ? ranges(r.p.range) : '<span class="f">any node</span>') : `<span class="f">${Mo.kindWord(r.p.choice ? 'choice' : r.p.type)}</span>`}</span><span class="ct">${r.filled} of ${r.of}</span></div>`).join('');
    const loose = [...m.props.values()].filter(p => !p.on.length);
    h += moreOf('table', rows);
    if (loose.length) h += `</div><h3>On no tag</h3><div class="st-tbl">` + few('loose', loose).map(p => `<div class="tr ${waitProp(p.id)}" data-prop="0·${p.id}">${pi(p)}<span><span class="k lk ${waitProp(p.id) ? 'lk-pencil' : ''}">${esc(p.title)}</span></span><span class="on f">—</span><span class="on">${p.range.length ? p.range.map(tagLink).join(', ') : `<span class="f">${Mo.kindWord(p.choice ? 'choice' : p.type)}</span>`}</span><span class="ct">${m.holders.get(p.ident)?.size || 0} nodes</span></div>`).join('') + moreOf('loose', loose);
    return h + `</div></div>`;
  }
  // ---------- health ----------
  // A long list: a few, then "show all", as a tag's nodes.
  const FEW = 20;
  const few = (key, list) => st.whole.has(key) ? list : list.slice(0, FEW);
  const moreOf = (key, list) => !st.whole.has(key) && list.length > FEW ? `<div class="more lk-more" data-all="${esc(key)}">show all ${list.length}</div>` : '';
  function healthHtml() {
    const all = ISS(), by = new Map();
    for (const i of all) by.set(i.rule, [...(by.get(i.rule) || []), i]);
    let h = `<div class="st-card st-hl">${trailHtml()}${titleHtml('', 'Health', [], '')}${all.length ? '' : `<div class="sum"><span>nothing to settle</span></div>`}`;
    for (const [rule, list] of by) h += `<h3>${esc(rule)}</h3>` + few(rule, list).map(i => issueLine(i, '')).join('') + moreOf(rule, list);
    return h + `</div>`;
  }
  // ---------- a tag's nodes ----------
  function nodesHtml() {
    const n = st.nodes, t = n && T(n.tag);
    if (!t) return `<div class="st-card">${trailHtml()}<div class="st-empty">No nodes to show.</div></div>`;
    const list = n.all ? n.list : n.list.slice(0, 20);
    let h = `<div class="st-card st-nodes lk-list" ${n.ticks.size ? 'data-picking' : ''}>${trailHtml()}${titleHtml('', `${plural(n.list.length, 'node')} of ${esc(t.title)}`, [...Mo.pathOf(M(), n.tag)].reverse(), '')}`;
    // Nothing ticked: the bar's room stays empty, so a tick moves no row.
    if (!n.ticks.size) h += `<div class="st-pick"></div>`;
    else h += `<div class="st-pick lk-bar"><b class="lk-said">${n.ticks.size} ticked</b><span class="act lk-btn" data-do="nmove" data-on="${n.tag}">move to another tag…</span><span class="act lk-btn" data-do="nsplit" data-on="${n.tag}">new tag under ${esc(t.title)} with them…</span><span class="esc lk-hint">Esc clears</span></div>`;
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
    const big = st.ask?.apply, words = big ? '' : `<span class="lk-btn" data-discard>Discard<span class="ky">Cmd Delete</span></span><span class="lk-accent" data-apply>Apply<span class="ky">Cmd Enter</span></span>`;
    return `<div class="st-wait lk-bar"><b class="lk-said">${plural(lines.length, 'change')} waiting</b>${words}</div>` +
      `<div class="tl">${shown.map(([c, i]) => `<span><span>${esc(c.text)}</span><i>${c.nodes ? `affects ${plural(c.nodes, 'node')}` : ''}</i><span class="lk-x" data-drop="${i}" title="Take this one out">×</span></span>`).join('')}</div>` +
      (shown.length < lines.length ? `<div class="more lk-more" data-all="tray">show all ${lines.length}</div>` : '') + (big ? bigHtml() : saying);
  }
  const FEW_LINES = 5;
  // Apply, when Undo cannot put it all back: the library's question for a big change, its yes the one blue button.
  const bigHtml = () => `<div class="st-q st-big"><div class="h">Undo can’t put this back as it was</div>` +
    app.tray.lasting().map(x => `<div class="l">${esc(x.name)} is deleted for good. Undo makes a new tag of that name.</div>`).join('') +
    `<div class="lk-answers"><span class="lk-big" data-stage>Apply</span><span class="lk-btn" data-leave>Leave it</span><span class="lk-hint">Enter applies · Esc leaves it</span></div></div>`;
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
      const subject = p.what === 'nodes' ? `${p.nodes.length} ticked nodes` : p.what === 'prop' ? `the property ${P(p.prop).title}` : p.what === 'range' ? `what ${P(p.prop).title} points at` : p.tags.length > 1 ? `${p.tags.length} ticked tags` : name(p.tags[0]);
      ask = p.what === 'range' ? `<b>${esc(P(p.prop).title)}</b> points at${P(p.prop).range.length ? ' also' : ''}…` : p.what === 'prop' && !p.from ? `Put <b>${esc(P(p.prop).title)}</b> on…` : `Move <b>${esc(subject)}</b> under…`;
      const list = all = [];
      const walk = (n, d) => { const t = T(n); const ok = p.what === 'tag' ? !p.tags.some(s => Mo.under(m, n, s)) : p.what === 'range' || p.what === 'nodes' ? !t.kind && !t.missing : !t.missing || p.what !== 'prop' || !!p.from; if (!q || t.title.toLowerCase().includes(q)) list.push({ key: n, nm: t.title, ct: Mo.count(m, n) || '', d, ok, mark: d === 0 ? t.kind : null }); for (const k of Mo.kids(m, n)) walk(k, d + 1); };
      m.kinds.forEach(k => walk(k.id, 0));
      for (const l of m.loose) walk(l, 1);
      if (p.what === 'tag' && (!q || 'not under a kind'.includes(q))) list.push({ key: LOOSE, nm: 'Not under a kind', ct: '', d: 0, ok: true, loose: true });
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
    const it = (t, act, off, k) => `<div class="lk-item ${off ? 'off' : ''}" data-act="${act}">${esc(t)}${k ? `<span class="rt lk-note">${k}</span>` : ''}</div>`;
    let h = `<div class="st-menu lk-menu" style="left:${mn.x}px;top:${mn.y}px">`;
    if (mn.kind === 'row') {
      const t = T(mn.on), isKind = !t || t.kind, loose = mn.on === LOOSE;
      const n = Mo.count(m, mn.on), nodesOf = ids => plural(ids.reduce((s, x) => s + Mo.count(m, x), 0), 'node');
      h += (t?.uuid ? it('Go to this tag', 'page') : '') + it('Open everything under', 'openall', false, 'Shift →') + (mode === 'side' ? it('Open the map here', 'main', false, 'Enter') : it(st.ticks.has(mn.on) ? 'Untick' : 'Tick', 'tick', isKind || loose, 'space')) + '<div class="gap lk-item"></div>' +
        it('Rename', 'rename', loose || !t || t.missing) + it(loose ? 'New tag here' : 'New tag inside', 'new') + it('Add a property…', 'addprop', isKind || loose) + it('Add a property to all beneath…', 'addpropall', loose, Mo.kids(m, mn.on).length ? nodesOf(Mo.kids(m, mn.on)) : '') + '<div class="gap lk-item"></div>' +
        it('Move under…', 'move', isKind || loose, n ? plural(n, 'node') : '') +
        it(ticked > 1 ? `Merge the ${ticked} ticked into this` : 'Merge the ticked into this', 'merge', isKind || loose || ticked < 1 || (ticked === 1 && st.ticks.has(mn.on)), ticked && !st.ticks.has(mn.on) ? nodesOf([...st.ticks]) : '') + '<div class="gap lk-item"></div>' +
        it('Remove', 'remove', isKind || loose || n > 0 || Mo.kids(m, mn.on).length > 0, n ? plural(n, 'node') : '');
    } else {
      const [tagId, pid] = mn.on.split('·').map(Number), t = T(tagId), p = P(pid), parent = Mo.parentOf(m, tagId);
      const declared = !!t?.props.includes(pid);
      const f = t ? plural(Mo.filled(m, tagId, pid), 'value') : '';
      h += (p?.uuid ? it('Go to this property', 'ppage') + '<div class="gap lk-item"></div>' : '') + it('Rename', 'prename') + (p?.type === 'node' ? it('Points at another tag too…', 'prange') : '') + '<div class="gap lk-item"></div>' +
        (t ? it('Move to…', 'pmove', !declared, f) + it(parent != null ? `Pull up to ${name(parent)}` : 'Pull up to the parent', 'pullup', !declared || parent == null, f) +
        (p && (p.choice || p.type === 'node') ? it('Split by its values…', 'split', !t.nodes.size, plural(t.nodes.size, 'node')) : '') + '<div class="gap lk-item"></div>' + it('Drop', 'pdrop', !declared, f) : it('Put on a tag…', 'pmove'));
    }
    return h + `</div>`;
  }

  // ---------- draw ----------
  function draw() {
    const active = doc.activeElement, hadFocus = root.contains(active) || wantFocus;
    const finding = !wantFocus && root.contains(active) && active.matches('[data-find]') ? active.selectionStart : null;
    const scroll = root.querySelector('.st-tree')?.scrollTop, scrollR = root.querySelector('.st-right')?.scrollTop;
    const trayWas = root.querySelector('.st-tray')?.offsetHeight;   // undefined on the first drawing: what is there at opening does not slide
    if (mode === 'page') keepPlace();
    let h = treeHtml();
    if (mode === 'page') {
      const card = st.view === 'table' ? tableHtml() : st.view === 'health' ? healthHtml() : st.view === 'nodes' ? nodesHtml() : st.propCur ? cardProp(st.propCur) : cardTag(st.cur);
      h += `<div class="st-tray">${trayHtml()}</div><div class="st-right">${card}</div>`;
    }
    if (st.menu && st.menu.owner === mode) h += menuHtml();
    root.innerHTML = h;
    // The screen takes the room Logseq gives it: from where the holder sits to the bottom of the window.
    if (mode === 'page') { const top = root.getBoundingClientRect().top, win = doc.defaultView; if (win?.innerHeight && top >= 0) root.style.height = Math.max(360, win.innerHeight - top - 24) + 'px'; }
    slideTray(trayWas);
    if (scroll) root.querySelector('.st-tree').scrollTop = scroll;
    if (scrollR && root.querySelector('.st-right')) root.querySelector('.st-right').scrollTop = scrollR;
    root.querySelector('.st-row.cur')?.scrollIntoView?.({ block: 'nearest' });
    const pin = root.querySelector('[data-pin]'), edit = root.querySelector('[data-edit]');
    wantFocus = false;
    if (!hadFocus) return;   // the keyboard is elsewhere, in a bullet being written, say: a draw leaves it there
    const box = finding != null && root.querySelector('[data-find]');
    if (pin && st.prompt.owner === mode) { pin.focus(); pin.setSelectionRange(pin.value.length, pin.value.length); }
    else if (edit && st.edit.owner === mode) { edit.focus(); edit.select(); }
    else if (box) { box.focus(); box.setSelectionRange(finding, finding); }
    else root.focus({ preventScroll: true });
  }

  // The tray rolls out and back when its height changes (the grammar: what opens rolls out), the card moving with it, never with a jump.
  // Every draw makes the tray anew, so the slide runs from the height it had. Empty, it takes no room, so the card itself comes up.
  const SLIDE = { duration: 160, easing: 'ease-out' };
  function slideTray(was) {
    const tray = root.querySelector('.st-tray'), now = tray?.offsetHeight;
    if (was == null || was === now || !tray?.animate || doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!now) { root.querySelector('.st-right').animate({ marginTop: [`${was}px`, '0px'] }, SLIDE); return; }
    const box = doc.defaultView.getComputedStyle(tray), from = was ? {} : { paddingTop: ['0px', box.paddingTop], paddingBottom: ['0px', box.paddingBottom], borderBottomWidth: ['0px', box.borderBottomWidth] };
    tray.style.overflow = 'hidden';
    tray.animate({ height: [`${was}px`, `${now}px`], ...from }, SLIDE).onfinish = () => { tray.style.overflow = ''; };
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
  const fold = (id, open) => { if (open === undefined) open = !st.open.has(id); open ? st.open.add(id) : st.open.delete(id); redraw(); };
  const openAll = id => { const walk = x => { st.open.add(x); Mo.kids(M(), x).forEach(walk); }; walk(id); redraw(); };
  const tick = id => { const t = T(id); if (!t || t.kind) return; st.ticks.has(id) ? st.ticks.delete(id) : st.ticks.add(id); redraw(); };
  const startPrompt = p => { st.menu = null; st.ask = null; st.prompt = { text: '', lit: 0, owner: mode, ...p }; redraw(); };
  const startMoveTag = id => { const tags = st.ticks.size > 1 && st.ticks.has(id) ? [...st.ticks] : [id]; startPrompt({ what: 'tag', list: 'tags', tags, row: id }); };
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
    for (const s of tags) { const t = T(s); if (!t || t.kind || s === dest || (dest !== LOOSE && Mo.under(M(), dest, s)) || (dest === LOOSE ? !t.parents.length : Mo.parentOf(M(), s) === dest)) continue; app.stage({ kind: 'move', tag: s, to: dest }); }
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
      else if (e.what === 'new') { const c = app.stage({ kind: 'make', name: v, under: e.on === LOOSE ? null : e.on }); st.open.add(e.on); if (c?.made != null) { loc.cur = c.made; if (mode === 'side') st.cur = c.made; } }
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
    else if (a === 'page') { redraw(); app.openNode(T(on)?.uuid, shift); }
    else if (a === 'ppage') { redraw(); app.openNode(P(Number(on.split('·')[1]))?.uuid, shift); }
    else if (a === 'main') app.openMain(on);
    else if (a === 'tick') tick(on);
    else if (a === 'move') { if (T(on) && !T(on).kind) startMoveTag(on); else redraw(); }
    else if (a === 'rename') { if (T(on) && !T(on).missing) startEdit('rename', on, name(on)); else redraw(); }
    else if (a === 'new') { if (!st.open.has(on)) st.open.add(on); startEdit('new', on, ''); }
    else if (a === 'addprop') { if (T(on) && !T(on).kind) startPrompt({ what: 'addprop', list: 'props', tag: on, row: on }); }
    else if (a === 'addpropall') { if (T(on)) startPrompt({ what: 'addprop', list: 'props', tag: on, under: true, row: on }); }
    else if (a === 'merge') { const from = [...st.ticks].filter(x => x !== on && T(x)); if (!from.length || !T(on) || T(on).kind) return redraw(); st.cur = on; st.view = 'tree'; st.propCur = null; st.ask = { merges: from, into: on, owner: mode }; redraw(); }
    else if (a === 'remove') { const t = T(on); if (!t || t.kind || Mo.count(m, on) || t.kids.length) return redraw(); const p = Mo.parentOf(m, on); app.stage({ kind: 'remove', tag: on }); if (st.cur === on) st.cur = p ?? m.kinds[0].id; redraw(); }
    else if (a === 'pmove') { const [tagId] = on.split('·').map(Number); startPrompt({ what: 'prop', list: 'tags', key: on, prop: Number(on.split('·')[1]), from: tagId }); }
    else if (a === 'pullup') { const [tagId, pid] = on.split('·').map(Number); const dest = Mo.parentOf(m, tagId); if (dest == null) return redraw(); app.stage({ kind: 'moveProp', prop: pid, from: [tagId], to: dest }); st.propCur = `${dest}·${pid}`; st.cur = dest; redraw(); }
    else if (a === 'prange') { const [, pid] = on.split('·').map(Number); st.propCur = on; startPrompt({ what: 'range', list: 'tags', prop: pid }); }
    else if (a === 'prename') { const [, pid] = on.split('·').map(Number); if (st.view === 'table') showProp(on); startEdit('prename', on, P(pid).title); }
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
    if (c.kind === 'remove' && st.cur === c.tag) st.cur = Mo.parentOf(M(), c.tag) ?? M().kinds[0].id;
    redraw();
  }
  async function openNodes(id) {
    const list = await app.readNodes(id);
    jump(() => { st.nodes = { tag: id, list, ticks: new Set(), all: false, cur: 0 }; st.view = 'nodes'; st.propCur = null; st.cur = id; });
  }
  const show = what => jump(() => { st.view = what; st.propCur = null; st.nodes = null; st.whole.clear(); });   // 'tree' from the views line, 'table', 'health'
  const showProp = key => jump(() => { const on = Number(key.split('·')[0]); st.propCur = key; st.view = 'tree'; st.nodes = null; if (on) st.cur = on; });

  // ---------- events ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-all],[data-fold],[data-tick],[data-ntick],[data-row],[data-go],[data-open],[data-unrange],[data-addrange],[data-prop],[data-fix],[data-stage],[data-leave],[data-sort],[data-apply],[data-discard],[data-drop],[data-undo],[data-act],[data-do],[data-show],[data-back],[data-pick],[data-nodes],[data-more],[data-node]');
    if (!t) { if (st.menu) { st.menu = null; redraw(); } return; }
    e.stopPropagation(); e.preventDefault();
    if (t.dataset.fold) return fold(keyOf(t.dataset.fold));
    if (t.dataset.tick) return tick(keyOf(t.dataset.tick));
    if (t.dataset.ntick) { const x = st.nodes.list[+t.dataset.ntick]; st.nodes.ticks.has(x.uuid) ? st.nodes.ticks.delete(x.uuid) : st.nodes.ticks.add(x.uuid); st.nodes.cur = +t.dataset.ntick; return redraw(); }
    if (t.dataset.open) return app.openNode(t.dataset.open, e.shiftKey);
    if (t.dataset.go) { const id = keyOf(t.dataset.go); return mode === 'side' ? app.openMain(id) : goTo(id); }
    if (t.dataset.unrange) { const pid = Number(st.propCur.split('·')[1]); app.stage({ kind: 'setRange', prop: pid, to: P(pid).range.filter(id => id !== Number(t.dataset.unrange)) }); return redraw(); }
    if (t.dataset.addrange) { const pid = Number(t.dataset.addrange.split('·')[1]); return startPrompt({ what: 'range', list: 'tags', prop: pid }); }
    if (t.dataset.fix) return fix(+t.dataset.fix);
    if (t.hasAttribute('data-stage')) return stageAsk();
    if (t.hasAttribute('data-leave')) { st.ask = null; return redraw(); }
    if (t.dataset.sort) { st.sort = t.dataset.sort; return redraw(); }
    if (t.dataset.prop) return showProp(t.dataset.prop);
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
    if (t.dataset.row) { const id = keyOf(t.dataset.row); st.menu = null; if (mode === 'side') { loc.cur = id; if (e.detail === 2) return app.openMain(id); return redraw(); } if (e.detail === 2) return openNodes(id); st.cur = id; st.propCur = null; st.view = 'tree'; st.nodes = null; st.trail = []; st.ask = null; return redraw(); }   // a press on the tree starts a new way: the trail is for jumps
  });
  const keyOf = s => s === LOOSE ? LOOSE : Number(s);
  /* Dragging a row onto another moves the tag there, the same as "move under…": the tag and everything under it, the ticked
     tags together when the dragged one is ticked. The row under the pointer shows a line where the tag will go; a row the
     tag cannot go under (itself, anything under it) takes no drop. The move waits in the tray like every change. */
  const dragOf = e => { const r = e.target.closest?.('[data-row]'); return r ? keyOf(r.dataset.row) : null; };
  const canDrop = dest => st.drag && dest != null && (dest === LOOSE ? st.drag.tags.some(s => T(s)?.parents.length) : !st.drag.tags.some(s => s === dest || Mo.under(M(), dest, s)));
  root.addEventListener('dragstart', e => {
    const id = dragOf(e); const t = id != null && T(id);
    if (!t || t.kind || t.missing) { e.preventDefault(); return; }
    e.stopPropagation();
    st.drag = { tags: st.ticks.size > 1 && st.ticks.has(id) ? [...st.ticks] : [id], owner: mode };
    try { e.dataTransfer.setData('text/plain', t.title); e.dataTransfer.effectAllowed = 'move'; } catch (error) { /* a test's plain event */ }
    e.target.closest('[data-row]').classList.add('dragging');
  });
  root.addEventListener('dragover', e => {
    const dest = dragOf(e); if (!canDrop(dest)) return;
    e.preventDefault(); e.stopPropagation();
    try { e.dataTransfer.dropEffect = 'move'; } catch (error) { /* ditto */ }
    const row = e.target.closest('[data-row]');
    if (!row.classList.contains('over')) { for (const o of root.querySelectorAll('.st-row.over')) o.classList.remove('over'); row.classList.add('over'); }
  });
  root.addEventListener('dragleave', e => { const row = e.target.closest?.('[data-row]'); if (row && !row.contains(e.relatedTarget)) row.classList.remove('over'); });
  root.addEventListener('drop', e => {
    const dest = dragOf(e); if (!canDrop(dest)) return;
    e.preventDefault(); e.stopPropagation();
    const tags = st.drag.tags; st.drag = null;
    moveTags(tags, dest); loc.cur = tags[0]; redraw();
  });
  root.addEventListener('dragend', () => { st.drag = null; for (const o of root.querySelectorAll('.st-row.over, .st-row.dragging')) o.classList.remove('over', 'dragging'); });
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
  for (const type of ['keyup', 'keypress']) root.addEventListener(type, e => { if (!passes(e)) e.stopPropagation(); });
  // Where Cmd-O and Shift-Enter go: the node or property on screen, else the row the cursor is on.
  function openHere(inSidebar) {
    const n = st.view === 'nodes' && mode === 'page' ? st.nodes?.list[st.nodes.cur] : null, pid = mode === 'page' && st.propCur ? Number(st.propCur.split('·')[1]) : null;
    app.openNode(n?.uuid || (pid != null ? P(pid)?.uuid : T(loc.cur)?.uuid), inSidebar);
  }
  root.addEventListener('keydown', e => {
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
    if (e.target.matches('[data-find]')) {
      if (k === 'Escape') { loc.find = ''; redraw(); }
      else if (k === 'ArrowDown' || k === 'Enter') { const first = visibleRows().find(r => !r.dim); if (first) loc.cur = first.n; e.preventDefault(); redraw(); }
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    if (st.menu && k === 'Escape') { st.menu = null; redraw(); return; }
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
    const cur = T(loc.cur), isKind = !cur || cur.kind || loc.cur === LOOSE;
    // A letter typed on the tree finds a tag, as in any outline; nothing a single letter does.
    if (k.length === 1 && k !== ' ') { const f = root.querySelector('[data-find]'); if (!f) return; e.preventDefault(); loc.find = k === '/' ? loc.find : loc.find + k; draw(); const g = root.querySelector('[data-find]'); g.focus(); g.setSelectionRange(g.value.length, g.value.length); return; }
    const walked = to => { loc.cur = to; if (mode === 'page') { st.propCur = null; st.walking = true; if (st.view === 'tree') st.trail = []; } };   // the arrows are the tree, as a press on it is
    if (k === 'ArrowDown') walked(rows[Math.min(rows.length - 1, i + 1)]);
    else if (k === 'ArrowUp') walked(rows[Math.max(0, i - 1)]);
    else if (k === 'ArrowRight') { if (e.shiftKey) { openAll(loc.cur); return; } if (Mo.kids(M(), loc.cur).length) st.open.add(loc.cur); }
    else if (k === 'ArrowLeft') { if (st.open.has(loc.cur)) st.open.delete(loc.cur); else if (Mo.parentOf(M(), loc.cur) != null) walked(Mo.parentOf(M(), loc.cur)); }
    else if (k === 'Enter') { if (e.shiftKey) openHere(true); else if (mode === 'side') app.openMain(loc.cur); else if (st.view !== 'tree' || st.propCur) jump(() => { st.view = 'tree'; st.propCur = null; st.nodes = null; }); else if (cur && Mo.count(M(), st.cur)) openNodes(st.cur); return; }
    else if (k === ' ' && mode === 'page') { tick(st.cur); return; }
    else if (k === 'Escape') {
      // The ladder: let go of what is nearest first (the find text, the ticks), then walk back the trail.
      if (loc.find) loc.find = ''; else if (mode === 'page' && st.ticks.size) st.ticks.clear(); else if (mode === 'page' && back()) return; else return;
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
  const view = { root, mode, draw, destroy: () => { app.views.delete(view); win.removeEventListener('hashchange', toPlace); doc.removeEventListener('keydown', undoKey, true); root.remove(); }, focus: () => { if (!doc.activeElement?.matches('input, textarea, [contenteditable="true"]')) root.focus({ preventScroll: true }); } };
  app.views.add(view);
  return view;
}

S.view = { make, ensureStyle, CSS };
})();
