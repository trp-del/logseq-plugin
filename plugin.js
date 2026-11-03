/* The door every module comes in by. Loaded first. A module's own main.js, as it loads, calls
   PluginDoor.register({ key, title, about, schema, start, stop }); main.js, loaded last, gives Logseq every module's
   settings as one list and starts the modules in the order they registered. Logseq gives a plugin one start (logseq.ready),
   one settings list and one clean-up (beforeunload), so those three belong to main.js and to no module. The name is not
   Plugin: every browser already has a window.Plugin of its own, the entries of navigator.plugins.
   What every module draws with is here too, whichever are switched on: the greys and the shared names (Door.NAMES), the four
   marks, the icon of what a property holds and the Undo arrow, each drawn once. */
(function () {
const Door = (window.PluginDoor ||= { modules: [] });
Door.register = module => { Door.modules.push(module); };
// What a part shows in the settings window: { schema, specimen } (settings/window.js), or { none } when it has nothing to set.
Door.described = {};
Door.describe = (key, settings) => { Door.described[key] = settings; };
/* What a change in the graph is, from what Logseq hands the change hook ({ blocks, deletedBlockUuids, txMeta }). Writing is
   what typing does: words saved, a bullet made or moved. Logseq lists the page with it (its stamp moved), so a page in the
   list says nothing. Everything else (a property set, a tag taken off, a rename, a delete, an undo) changes the graph's shape.
   structureWatch() gives a module its own memory of each block's tags and name: true when a change may reach the tags and
   pages it holds, false for writing that leaves them as they were. A block not seen before counts only if it carries a tag. */
const WRITING = new Set(['save-block', 'insert-blocks', 'move-blocks', 'indent-outdent-blocks']);
const LOGSEQ_KIND = /^logseq\.class\/(?:Page|Journal)$/;
Door.writing = change => WRITING.has(change?.txMeta?.outlinerOp) && !change.txMeta['undo?'] && !change.txMeta['redo?'];
Door.structureWatch = () => {
  const seen = new Map();
  return change => {
    let reached = !Door.writing(change);
    for (const block of change?.blocks || []) {
      const tags = (block.tags || []).filter(tag => !LOGSEQ_KIND.test(tag?.ident || '')).map(tag => tag?.id ?? tag).sort();
      const now = JSON.stringify([tags, block.name ?? '']), was = seen.get(block.id);
      seen.set(block.id, now);
      if (was === undefined ? tags.length > 0 : was !== now) reached = true;
    }
    return reached;
  };
};
// Logseq tells every onSettingsChanged of any setting saved: this says whether one of a module's own keys is what changed.
Door.settingChanged = (keys, now, before) => !before || keys.some(key => JSON.stringify(now?.[key]) !== JSON.stringify(before[key]));

// Whether a module is switched on (its switch in the settings). The switches are read as the plugin starts.
Door.runs = key => logseq.settings?.[key + 'On'] !== false;
/* The day a node shows, from its date properties ([node, day, the property's name]): the one titled Date, whatever its ident, else
   the earliest, as Threads reads it. */
Door.datedDays = rows => {
  const days = new Map(), named = new Set();
  for (const [node, day, name] of rows) {
    const isDate = String(name).trim().toLowerCase() === 'date';
    if (!days.has(node) || (isDate && !named.has(node)) || (isDate === named.has(node) && Number(day) < days.get(node))) days.set(node, Number(day));
    if (isDate) named.add(node);
  }
  return days;
};
// The tags a graph may name each of the four sorts by, and which it is.
Door.SORT_NAMES = { entity: 'entity', entities: 'entity', occurrence: 'occurrence', occurrences: 'occurrence', phenomena: 'phenomenon', phenomenon: 'phenomenon', information: 'information', interpretation: 'information' };

/* The four sorts of thing and their marks, as the grammar page draws them: Entity (∃, the logical symbol), Occurrence
   (an open ring), Phenomena (a small wave), Information (three dots, ∴). One drawing, used before a link, in a page's icon
   slot, in lists and in Structure's tree. The shapes are 10 by 10. */
Door.MARKS = {
  entity: "<path d='M2 1.8H8V8.2H2M3.6 5H8' fill='none' stroke='currentColor' stroke-width='1.4'/>",
  occurrence: "<circle cx='5' cy='5' r='3.3' fill='none' stroke='currentColor' stroke-width='1.3'/>",
  phenomenon: "<path d='M1.3 6.2q1.85-3.4 3.7 0t3.7 0' fill='none' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/>",
  information: "<circle cx='5' cy='2.6' r='1.25' fill='currentColor'/><circle cx='2.3' cy='7.3' r='1.25' fill='currentColor'/><circle cx='7.7' cy='7.3' r='1.25' fill='currentColor'/>",
};
Door.markSvg = (sort, colour = 'currentColor') => `<svg viewBox="0 0 10 10" aria-hidden="true">${(Door.MARKS[sort] || '').replace(/currentColor/g, colour)}</svg>`;
// A mark as a picture for a stylesheet (a background takes no currentColor, so the grey is given).
Door.markUrl = (sort, colour) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>${(Door.MARKS[sort] || '').replace(/currentColor/g, colour)}</svg>`)}")`;
/* What a property holds, as an icon: the web (three dots joined) for a link to nodes, drawn here because no font has it;
   the rest from Logseq's own icon font (Tabler, loaded on every page). */
Door.WEB = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 2.6 2.4 9.2h7.2Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="2.6" r="1.7" fill="currentColor"/><circle cx="2.4" cy="9.2" r="1.7" fill="currentColor"/><circle cx="9.6" cy="9.2" r="1.7" fill="currentColor"/></svg>';
const KIND_ICONS = { node: null, page: null, date: 'calendar', datetime: 'calendar', text: 'letter-case', default: 'letter-case', number: '123', 'raw-number': '123', choice: 'select', checkbox: 'checkbox', url: 'world' };
Door.kindIconHtml = kind => {
  const k = String(kind || 'text').replace(/^:/, '');
  if (KIND_ICONS[k] === null) return `<i class="lk-icon lk-web" aria-hidden="true">${Door.WEB}</i>`;
  return `<i class="lk-icon ti ti-${KIND_ICONS[k] || 'letter-case'}" aria-hidden="true"></i>`;
};
// The Undo arrow: the grammar's one shape, from Logseq's icon font. Its fade is the shared name lk-undo.
Door.UNDO = '<i class="ti ti-arrow-back-up" aria-hidden="true"></i>';
/* The press's icons: one even line, the most literal drawing of what the press does, and anything that moves is an arrow. None
   is a ring, a wave or three dots, so none can be taken for a sort's mark. A press takes one by the shared name lk-i-<name>. */
Door.ICONS = {
  go: 'M2.5 8h11M9.5 4l4 4-4 4', up: 'M8 13.5v-11M4 6.5l4-4 4 4', move: 'M3 2.5V8a2 2 0 0 0 2 2h8.5M10 6.5l3.5 3.5-3.5 3.5',
  child: 'M3 2.5V6a2 2 0 0 0 2 2h2M11 4.5v7M7.5 8h7', merge: 'M3 2.5 8 8l5-5.5M8 8v5.5M5 10.5l3 3 3-3', split: 'M2.5 8h4l6-4.5M6.5 8l6 4.5M9.5 3.5h3v3M9.5 12.5h3v-3',
  plus: 'M8 2.5v11M2.5 8h11', chevron: 'M4 6l4 4 4-4', minus: 'M2.5 8h11', bin: 'M2.5 4.5h11M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M4 4.5l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-9',
  rename: 'M10.4 2.9 13.1 5.6 5.4 13.3l-3 .3.3-3zM8.8 4.5l2.7 2.7',
  copy: 'M6.4 5.2h6.4A1.2 1.2 0 0 1 14 6.4v6.4a1.2 1.2 0 0 1-1.200 1.200H6.400a1.200 1.200 0 0 1-1.200-1.200V6.400a1.200 1.200 0 0 1 1.200-1.200zM11 2.400H3.600a1.200 1.200 0 0 0-1.200 1.200V11',
  tag: 'M2.5 2.5h5.300l5.700 5.700-5.300 5.300-5.700-5.700zM5.300 5.300h.01', eq: 'M3 5.800h10M3 10.200h10', side: 'M3 3h10a1.200 1.200 0 0 1 1.200 1.200v7.600A1.200 1.200 0 0 1 13 13H3a1.200 1.200 0 0 1-1.200-1.200V4.200A1.200 1.200 0 0 1 3 3zM10 3v10',
  tick: 'M2.800 8.600 6.400 12l6.800-7.800', x: 'm3.800 3.800 8.400 8.400M12.200 3.800l-8.400 8.400', save: 'M8 2.500v8M4.500 7 8 10.500 11.500 7M3 13.500h10',
  undo: 'M6 9.500 3 6.500l3-3M3 6.500h7.500a3 3 0 0 1 0 6H9', reload: 'M13 8a5 5 0 1 1-1.500-3.500M13 2v3.500H9.500', enter: 'M13 3.500V7.800a2 2 0 0 1-2 2H3.500M6.800 6.500 3.500 9.800l3.300 3.300',
};
const iconUrl = d => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`)}")`;

// The greys, mixed from Logseq's text colour so they follow any theme: quiet, faint, a hairline and a firmer line.
const TOKENS = `
:root { --lk-quiet: color-mix(in srgb, currentColor 70%, transparent); --lk-faint: color-mix(in srgb, currentColor 70%, transparent); --lk-off: color-mix(in srgb, currentColor 46%, transparent);
  --lk-hair: color-mix(in srgb, currentColor 12%, transparent); --lk-line: color-mix(in srgb, currentColor 26%, transparent);
  --lk-wash: color-mix(in srgb, currentColor 7%, transparent);
  --lk-soft: color-mix(in srgb, var(--lk-text, currentColor) 70%, transparent); --lk-dim: color-mix(in srgb, var(--lk-text, currentColor) 70%, transparent);
  --lk-mono: var(--ls-font-family-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace); }`;
/* The shared names: one per word of the grammar. A module puts these on what it draws and carries no look of its own
   for them; these words are final (hence !important where a module still has a rule). They stand whichever modules run:
   Look's switch takes off what Look draws on Logseq's own page, never what they mean on what the others draw.
   lk-row: a row; lk-fold: its fold arrow, only under the pointer; lk-list: a list that can be picked from; lk-tick: a
   tick box, appearing when the pointer is on the list; lk-node: a node's name (with data-uuid: Look adds its sort mark);
   lk-tag: a tag; lk-prop: a property's name; lk-day: a day in the margin; lk-count: a number of things, never shown;
   lk-pencil: a pencilled value; lk-undo: the faded arrow.
   The Pressing set (buttons-mockup.html beside the plugins, 30 October 2026), for the controls of a bar or a window:
   lk-name: the small faint name above a value; lk-value: the value, the thing pressed, in the text colour, quiet under
   the pointer, faint when off (.off) or unwritten; lk-pick: a value that unfolds, a hairline standing before it (its
   chevron is the module's markup, coloured faint here); lk-alts: what a value can become, faint words with the
   one in force (.on) in the text colour; lk-accent: the one action, its key faint; lk-close: the ×.
   The module lays them out (a name over a value, the gaps); these give only their colours and weights.
   The button library (button-library.html in the workspace), one kind per job, each drawn whole here, so a module adds
   nothing of its own to how it looks, only where it stands. A press is a word with a line icon (lk-i-<name>, from Door.ICONS)
   on the round wash, at rest too; firmer under the pointer. lk-strip: a row of actions; lk-bar: what you can do with what
   you ticked, lk-said holding how many; lk-btn: a word in either, or among lk-answers, the answers under a question;
   lk-enter: the return sign, on the one press plain Enter takes;
   lk-accent: the main button, the one thing a screen is for; lk-big: the yes to a change Undo cannot put back whole, the one
   button with a colour and a fill, Logseq's own blue, a shade deeper so its white words read in both themes; lk-hint: words beside them saying what a key does now, never
   pressed; lk-lone: an action with nothing beside it; lk-add: "+ Add property"; lk-fix: what to do about a row, at its
   right end; lk-x: takes one thing off a row; lk-plus: adds to a row's group; lk-change (with lk-i-chevron): changes a value that holds one thing; lk-more: show all; lk-views with lk-view
   (.on): other contents of one place; lk-trail with lk-step: the places you came through; lk-head (.on): a sort head;
   lk-menu with lk-item (.off, .gap, a faint lk-note): a menu. */
Door.NAMES = `${TOKENS}
.lk-tag { color: inherit !important; opacity: .7; font-family: var(--lk-mono) !important; font-size: .85em !important; text-decoration: none !important; }
.lk-tag:hover { opacity: 1; }
.lk-node { color: inherit; text-decoration: underline !important; text-decoration-color: var(--lk-line) !important; text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
.lk-node:hover { text-decoration-color: currentColor !important; }
.lk-prop { color: var(--lk-quiet); }
.lk-day { color: var(--lk-faint) !important; font-size: 13px !important; font-variant-numeric: tabular-nums; }
.lk-count { display: none !important; }
.lk-pencil { font-style: italic !important; color: var(--lk-faint) !important; text-decoration: underline dotted !important; text-decoration-color: var(--lk-line) !important; text-underline-offset: 3px; background: none !important; }
/* A pencilled tag fades once: the pencil's grey, not the tag's own fade on top of it. */
.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; }
.lk-undo { opacity: .28 !important; transition: opacity .15s; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: .85 !important; }
.lk-row .lk-fold { opacity: 0 !important; transition: opacity .12s; }
.lk-row:hover .lk-fold, .lk-fold[aria-expanded="true"], .lk-fold:focus-visible { opacity: .6 !important; }
.lk-row:hover .lk-fold:hover { opacity: 1 !important; }
.lk-list .lk-tick { opacity: 0 !important; transition: opacity .12s; }
.lk-list:hover .lk-tick, .lk-list:focus-within .lk-tick, .lk-list[data-picking] .lk-tick { opacity: .55 !important; }
.lk-list .lk-tick:checked, .lk-list .lk-tick:hover { opacity: 1 !important; }
.lk-name { font-size: 11px !important; color: var(--lk-faint) !important; letter-spacing: .02em; font-weight: 400 !important; }
.lk-value:not(input) { color: inherit !important; cursor: pointer; }
.lk-value:not(input):hover { color: var(--lk-quiet) !important; }
.lk-value.off, input.lk-value::placeholder { color: var(--lk-off) !important; }
.lk-pick:not(:first-child) { border-left: 1px solid var(--lk-hair); }
.lk-pick .lk-value svg { color: var(--lk-faint); }
/* The faint goes on each alternative, not on the line, so the one in force can take the text colour back. */
.lk-alts { color: inherit !important; }
.lk-alts > * { color: var(--lk-faint) !important; }
.lk-alts > *:hover, .lk-alts > .on { color: inherit !important; }
.lk-accent { color: inherit !important; }
.lk-accent kbd { font-weight: 400 !important; color: var(--lk-faint) !important; }
.lk-close { color: var(--lk-faint) !important; }
.lk-close:hover, .lk-close:focus-visible { color: inherit !important; }
.lk-btn, .lk-accent, .lk-lone, .lk-add, .lk-fix, .lk-x, .lk-plus, .lk-change, .lk-more, .lk-view, .lk-step, .lk-head, .lk-item { appearance: none; background: none; border: 0; font: inherit; cursor: pointer; border-radius: 4px; }
.lk-btn, .lk-accent, .lk-lone, .lk-add, .lk-fix { border-radius: 1em; }
.lk-strip, .lk-bar, .lk-answers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.lk-answers { flex-basis: 100%; margin-top: 4px; }
.lk-btn { color: var(--lk-text, currentColor) !important; padding: 2px 6px; margin: 0 -6px; white-space: nowrap; }
.lk-said { font-weight: 500; padding-right: 6px; color: var(--lk-text, currentColor); }
.lk-hint { color: var(--lk-dim) !important; font-size: 12.5px; margin-left: auto; padding-left: 12px; white-space: nowrap; }
.lk-accent { cursor: pointer; border-radius: 1em; color: var(--lk-text, currentColor) !important; white-space: nowrap; }
.lk-answers > .lk-accent { padding: 2px 6px; margin: 0 -6px; }
.lk-big { appearance: none; border: 0; font: inherit; font-weight: 600; cursor: pointer; border-radius: 1em; padding: 3px 12px; margin-right: 8px; white-space: nowrap; background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 80%, #000); color: #fff !important; }
.lk-big:hover, .lk-big:focus-visible { background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 68%, #000); outline: none; }
.lk-lone { color: var(--lk-text, currentColor) !important; padding: 3px 6px; margin-left: -6px; white-space: nowrap; }
.lk-fix { color: var(--lk-text, currentColor) !important; padding: 2px 6px; white-space: nowrap; }
.lk-add, .lk-more { color: var(--lk-soft) !important; padding: 3px 0; }
.lk-more { text-decoration: underline !important; text-decoration-color: var(--lk-line) !important; text-underline-offset: 3px; }   /* it opens, so it reads as what opens */
.lk-add:hover, .lk-more:hover, .lk-add:focus-visible, .lk-more:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-x, .lk-plus, .lk-change { color: var(--lk-dim) !important; padding: 0 4px; }
.lk-x:hover, .lk-plus:hover, .lk-change:hover, .lk-x:focus-visible, .lk-plus:focus-visible, .lk-change:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-change::before { margin-right: 0 !important; }   /* the chevron alone, lk-i-chevron, no word after it */
.lk-btn:hover, .lk-btn:focus-visible, .lk-accent:hover, .lk-accent:focus-visible, .lk-lone:hover, .lk-lone:focus-visible, .lk-fix:hover, .lk-fix:focus-visible, .lk-x:hover, .lk-plus:hover, .lk-change:hover, .lk-view:hover, .lk-view:focus-visible, .lk-item:hover, .lk-item:focus-visible { background: var(--lk-wash); }
.lk-btn:focus-visible, .lk-accent:focus-visible, .lk-lone:focus-visible, .lk-fix:focus-visible, .lk-view:focus-visible, .lk-item:focus-visible { outline: none; }
/* Three levels, so a button's weight says how much it matters before it is read (the owner, 1 November: "change the hierarchy of buttons").
   1, lk-accent: the one step that decides, filled in the text colour, one on a screen. Above it only lk-big, what Undo cannot put back.
   2, lk-btn, lk-lone: what you do to the thing in front of you, on the round ground.
   3, lk-low, lk-fix: a way out, or an action repeated down a list: the word alone, the round ground under the pointer. */
.lk-btn, .lk-lone, .lk-fix, .lk-accent { display: inline-flex; align-items: center; gap: .35em; padding: 4px 12px !important; margin: 0 !important; line-height: 1.35; }
.lk-btn, .lk-lone { background: var(--lk-wash) !important; }
.lk-btn:hover, .lk-lone:hover, .lk-btn:focus-visible, .lk-lone:focus-visible { background: color-mix(in srgb, currentColor 13%, transparent) !important; }
.lk-accent { background: var(--lk-text, currentColor) !important; color: var(--lk-paper, var(--ls-primary-background-color, #fff)) !important; font-weight: 600; padding-inline: 16px !important; }
.lk-accent:hover, .lk-accent:focus-visible { background: color-mix(in srgb, var(--lk-text, currentColor) 82%, transparent) !important; }
.lk-accent kbd, .lk-accent .ky { color: inherit !important; opacity: .65; }
.lk-btn.lk-low, .lk-fix { background: none !important; padding: 4px 8px !important; }
/* Delete is red, at whatever level it stands (the owner, 1 November). */
.lk-del, .lk-btn.lk-i-bin, .lk-fix.lk-i-bin, .lk-fix.lk-i-minus, .lk-item.lk-del { color: var(--rx-red-10, #dc3e42) !important; }
.lk-btn.lk-low:hover, .lk-fix:hover, .lk-btn.lk-low:focus-visible, .lk-fix:focus-visible { background: var(--lk-wash) !important; }
.lk-views { display: flex; gap: 4px; }
.lk-view { color: var(--lk-soft) !important; padding: 3px 8px; }
.lk-view.on { font-weight: 600; }
.lk-view.on { color: var(--lk-text, currentColor) !important; font-weight: 500; }
.lk-trail { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: center; font-size: 13px; }
.lk-trail > :not(.lk-step) { color: var(--lk-dim); }
.lk-step { color: var(--lk-soft) !important; padding: 0; text-decoration: underline !important; text-decoration-color: var(--lk-hair) !important; text-underline-offset: 3px; }
.lk-step:hover { color: var(--lk-text, currentColor) !important; text-decoration-color: var(--lk-line) !important; }
.lk-head { color: var(--lk-soft) !important; text-align: left; }
.lk-head:hover, .lk-head.on { color: var(--lk-text, currentColor) !important; }
.lk-head.on { font-weight: 600; }
.lk-menu { border: 1px solid var(--lk-hair); border-radius: 6px; padding: 4px; }
.lk-item { display: flex; justify-content: space-between; gap: 16px; width: 100%; text-align: left; color: var(--lk-text, currentColor) !important; padding: 5px 8px; white-space: nowrap; }
.lk-item.off { color: var(--lk-off) !important; pointer-events: none; }
.lk-item.gap { height: 8px; padding: 0; pointer-events: none; background: none; }
.lk-note { color: var(--lk-dim); font-size: 12.5px; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .lk-fold, .lk-tick, .lk-undo { transition: none; } }
.lk-icon.lk-web { display: inline-flex; align-items: center; line-height: 1; }
.lk-icon.lk-web svg { display: block; width: 12px; height: 12px; }
[class*="lk-i-"]::before, .lk-enter::after { content: ""; display: inline-block; width: 1.05em; height: 1.05em; vertical-align: -.15em; background: currentColor; -webkit-mask: var(--lk-ic) center / contain no-repeat; mask: var(--lk-ic) center / contain no-repeat; }
[class*="lk-i-"]::before { margin-right: .38em; }
.lk-enter::after { --lk-ic: ${iconUrl(Door.ICONS.enter)}; width: .85em; height: .85em; vertical-align: -.08em; margin-left: .4em; opacity: .46; }
${Object.entries(Door.ICONS).map(([name, d]) => `.lk-i-${name} { --lk-ic: ${iconUrl(d)}; }`).join('\n')}`;
})();
