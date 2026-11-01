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

// The greys, mixed from Logseq's text colour so they follow any theme: quiet, faint, a hairline and a firmer line.
const TOKENS = `
:root { --lk-quiet: color-mix(in srgb, currentColor 70%, transparent); --lk-faint: color-mix(in srgb, currentColor 46%, transparent);
  --lk-hair: color-mix(in srgb, currentColor 12%, transparent); --lk-line: color-mix(in srgb, currentColor 26%, transparent);
  --lk-wash: color-mix(in srgb, currentColor 7%, transparent);
  --lk-soft: color-mix(in srgb, var(--lk-text, currentColor) 70%, transparent); --lk-dim: color-mix(in srgb, var(--lk-text, currentColor) 46%, transparent);
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
   one in force (.on) in the text colour; lk-accent: the one action, a little heavier, its key faint; lk-close: the ×.
   The module lays them out (a name over a value, the gaps); these give only their colours and weights.
   The button library (button-library.html in the workspace), one kind per job, each drawn whole here, so a module adds
   nothing of its own to how it looks, only where it stands. lk-strip: a row of actions; lk-bar: what you can do with what
   you ticked, lk-said holding how many; lk-btn: a word in either, or among lk-answers, the answers under a question;
   lk-accent: the main button, the one thing a screen is for; lk-big: the yes to a change Undo cannot put back whole, the one
   button with a colour and a fill, Logseq's own blue, a shade deeper so its white words read in both themes; lk-hint: words beside them saying what a key does now, never
   pressed; lk-lone: an action with nothing beside it; lk-add: "+ Add property"; lk-fix: what to do about a row, at its
   right end; lk-x: takes one thing off a row; lk-plus: adds to a row's group; lk-more: show all; lk-views with lk-view
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
.lk-value.off, input.lk-value::placeholder { color: var(--lk-faint) !important; }
.lk-pick:not(:first-child) { border-left: 1px solid var(--lk-hair); }
.lk-pick .lk-value svg { color: var(--lk-faint); }
/* The faint goes on each alternative, not on the line, so the one in force can take the text colour back. */
.lk-alts { color: inherit !important; }
.lk-alts > * { color: var(--lk-faint) !important; }
.lk-alts > *:hover, .lk-alts > .on { color: inherit !important; }
.lk-accent { font-weight: 600 !important; color: inherit !important; }
.lk-accent kbd { font-weight: 400 !important; color: var(--lk-faint) !important; }
.lk-close { color: var(--lk-faint) !important; }
.lk-close:hover, .lk-close:focus-visible { color: inherit !important; }
.lk-btn, .lk-accent, .lk-lone, .lk-add, .lk-fix, .lk-x, .lk-plus, .lk-more, .lk-view, .lk-step, .lk-head, .lk-item { appearance: none; background: none; border: 0; font: inherit; cursor: pointer; border-radius: 4px; }
.lk-strip, .lk-bar, .lk-answers { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 0; overflow: hidden; }
.lk-strip { border-top: 1px solid var(--lk-hair); border-bottom: 1px solid var(--lk-hair); padding: 4px 0; }
.lk-answers { flex-basis: 100%; margin-top: 4px; overflow: visible; }
.lk-btn { position: relative; color: var(--lk-text, currentColor) !important; padding: 3px 12px; white-space: nowrap; }
.lk-strip > .lk-btn::before, .lk-bar > .lk-btn::before, .lk-answers > .lk-btn::before { content: ""; position: absolute; left: -1px; top: 50%; width: 1px; height: 12px; margin-top: -6px; background: var(--lk-line); }
.lk-said { font-weight: 500; padding-right: 12px; color: var(--lk-text, currentColor); }
.lk-hint { color: var(--lk-dim) !important; font-size: 12.5px; margin-left: auto; padding-left: 12px; white-space: nowrap; }
.lk-accent { cursor: pointer; border-radius: 4px; color: var(--lk-text, currentColor) !important; white-space: nowrap; }
.lk-answers > .lk-accent { padding: 3px 8px; margin-left: -8px; }
.lk-big { appearance: none; border: 0; font: inherit; font-weight: 600; cursor: pointer; border-radius: 4px; padding: 3px 12px; margin-right: 8px; white-space: nowrap; background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 80%, #000); color: #fff !important; }
.lk-big:hover, .lk-big:focus-visible { background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 68%, #000); outline: none; }
.lk-big + .lk-btn::before { display: none; }
.lk-lone { color: var(--lk-text, currentColor) !important; padding: 3px 6px; margin-left: -6px; white-space: nowrap; }
.lk-fix { color: var(--lk-text, currentColor) !important; padding: 2px 6px; white-space: nowrap; }
.lk-add, .lk-more { color: var(--lk-soft) !important; padding: 3px 0; }
.lk-add:hover, .lk-more:hover, .lk-add:focus-visible, .lk-more:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-x, .lk-plus { color: var(--lk-dim) !important; padding: 0 4px; }
.lk-x:hover, .lk-plus:hover, .lk-x:focus-visible, .lk-plus:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-btn:hover, .lk-btn:focus-visible, .lk-accent:hover, .lk-accent:focus-visible, .lk-lone:hover, .lk-lone:focus-visible, .lk-fix:hover, .lk-fix:focus-visible, .lk-x:hover, .lk-plus:hover, .lk-view:hover, .lk-view:focus-visible, .lk-item:hover, .lk-item:focus-visible { background: var(--lk-wash); }
.lk-btn:focus-visible, .lk-accent:focus-visible, .lk-lone:focus-visible, .lk-fix:focus-visible, .lk-view:focus-visible, .lk-item:focus-visible { outline: none; }
.lk-views { display: flex; gap: 4px; }
.lk-view { color: var(--lk-soft) !important; padding: 3px 8px; }
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
.lk-item.off { color: var(--lk-dim) !important; pointer-events: none; }
.lk-item.gap { height: 8px; padding: 0; pointer-events: none; background: none; }
.lk-note { color: var(--lk-dim); font-size: 12.5px; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .lk-fold, .lk-tick, .lk-undo { transition: none; } }
.lk-icon.lk-web { display: inline-flex; align-items: center; line-height: 1; }
.lk-icon.lk-web svg { display: block; width: 12px; height: 12px; }`;
})();
