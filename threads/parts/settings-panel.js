/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Settings window: a window listing every setting of the plugin, opened from “Threads settings”
   in Logseq's three-dots menu (top right) or from the command palette. Sections are listed on the
   left under umbrella groups (0.4.129: Reading a page, Writing a record, Around the page, Tools,
   Paused; the tag tree moved from Paused to Tools in 0.4.155), each with a numbered picture of where its sections work; the search box looks through every
   setting's name and explanation.
   Logseq 2.0.2 gives plugins no way to add to that menu, so the item is added when the menu opens:
   the plugin notices the click on the three-dots button and puts its item under “Plugins”.
   On the kit since 0.4.317 (docs/LAYERS.md; the views page): the one real window, the browser's own dialog dressed
   by the kit (Escape, the keyboard and the backdrop are the browser's); the find box is the kit's field with its
   icon and key hint; the sections on the left are quiet words with their icons; a row is a title, a quiet line and
   the control at the right: on or off is a tick box, a choice of two or three is quiet words with a hairline between
   them, a list of names is words with a × on hover and a field to add to it (the graph's tags offered in the kit's
   list pop-up as you type), text is an underline; Reset is a faint word that shows when a value differs from its
   default; the shortcuts are a group of their own, read from the one register, so every key the plugin listens for
   is changed here. Nothing of the window's own is drawn but its layout; no colour of its own; no logseq.* call:
   the settings, the schema, the register, the graph's tags and the reload come through the core. */

const shared = window.refinementShared;
const { host, el, icon, quiet, field, tick, chip, note } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (settings): ', leaves: { elements: 'dialog.refinement-settings, .refinement-settings-menu-item' } });
const take = (core, names) => shared.take(core, names, warnOnce);
let sendStyle, settingsNow, settingsSchema, saveSettings, openLogseqSettings, reloadPlugin, pluginVersion, commands, tagTitles, propSchema, currentGraph;
const ITEM_CLASS = 'refinement-settings-menu-item';
const COPY = String(Date.now()); // tells this copy's menu item from one left by an earlier copy

/* The window's own layout only (0.4.317): the kit draws the dialog, the field, the tick box, the quiet words, the
   chips and the notes. Greys from the kit's tokens. */
const css = `
dialog.refinement-settings { display: none; width: min(1180px, 96vw); height: min(900px, 92vh); max-height: 92vh; overflow: hidden; }
dialog.refinement-settings[open] { display: flex; flex-direction: column; }
.rf-settings-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 14px; border-bottom: 1px solid var(--rf-hair); }
.rf-settings-head h2 { margin: 0; width: 210px; flex: none; font-size: 15px; font-weight: 600; }
.rf-settings-head .rf-field { flex: 1; }
.rf-settings-main { flex: 1; display: flex; min-height: 0; }
.rf-settings-nav { width: 230px; flex: none; overflow-y: auto; padding: 8px 6px; border-right: 1px solid var(--rf-hair); display: flex; flex-direction: column; gap: 1px; }
.rf-settings-nav .rf-quiet { justify-content: flex-start; width: 100%; height: 30px; text-align: left; }
.rf-settings-nav .rf-quiet .rf-note { margin-left: auto; padding: 0; }
.rf-settings-nav .rf-quiet > .ti { color: var(--rf-faint); }
.rf-settings-group { margin: 12px 0 2px; padding: 0 8px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--rf-faint); }
.rf-settings-group:first-child { margin-top: 0; }
.rf-settings-nav hr { width: 100%; margin: 8px 0; border: 0; border-top: 1px solid var(--rf-hair); }
.rf-settings.rf-searching .rf-settings-nav .rf-quiet { color: var(--rf-faint); }
.rf-settings.rf-searching .rf-settings-nav .rf-quiet.rf-has-hits { color: var(--rf-quiet); }
.rf-settings-body { flex: 1; overflow-y: auto; padding: 8px 28px 28px; }
.rf-settings-body > * { max-width: 900px; }
.rf-settings-body section { padding-top: 16px; }
.rf-settings-body section h3 { margin: 0; font-size: 15px; font-weight: 600; }
.rf-settings.rf-listing section h3 { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--rf-faint); }
.rf-settings.rf-listing .rf-settings-note { display: none; }
.rf-settings-rows { margin-top: 8px; }
.rf-settings-row { display: flex; align-items: flex-start; gap: 24px; padding: 12px 0; border-top: 1px solid var(--rf-hair); }
.rf-settings-row:first-child { border-top: 0; }
.rf-settings-text { flex: 1; min-width: 0; }
.rf-settings-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-weight: 500; }
.rf-settings-title .rf-quiet { height: 20px; font-size: 12px; }
.rf-settings-changed::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 7px 2px 0; border-radius: 50%; background: var(--rf-line); vertical-align: middle; }
.rf-settings-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.rf-settings-desc.rf-open, .rf-settings.rf-searching .rf-settings-desc { display: block; -webkit-line-clamp: unset; }
.rf-settings-more { height: 20px; font-size: 12px; margin-top: 1px; }
.rf-settings.rf-searching .rf-settings-more { display: none; }
.rf-settings-hit { border-radius: 2px; background: var(--rf-wash); box-shadow: inset 0 -1px var(--rf-line); }
.rf-settings-control { flex: none; display: flex; align-items: center; gap: 10px; padding-top: 2px; }
.rf-settings-control .rf-field { width: 240px; }
/* The editors of 0.4.415: lists of names, ordered lists, tables of pairs, groups, keys, sliders. Hairlines and greys of
   the kit; no colour of their own. */
.rf-settings-list { padding: 6px 8px; border: 1px solid var(--rf-hair); border-radius: 6px; min-height: 34px; box-sizing: border-box; cursor: text; }
.rf-settings-ordered .rf-chip { cursor: grab; padding: 1px 6px 1px 2px; border-radius: 4px; }
.rf-settings-ordered .rf-chip:hover { background: var(--rf-wash); }
.rf-settings-n { display: inline-grid; place-items: center; min-width: 16px; height: 16px; margin-right: 4px; border: 1px solid var(--rf-line); border-radius: 50%; font-size: 10px; font-weight: 600; color: var(--rf-faint); }
.rf-settings-dragging { opacity: .4; }
.rf-settings-drop { box-shadow: -2px 0 0 var(--rf-line); }
.rf-settings-table { display: grid; gap: 2px; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--rf-hair); border-radius: 6px; }
.rf-settings-table-row { display: grid; grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1.4fr) 28px; gap: 8px; align-items: center; min-height: 30px; }
.rf-settings-table-row > .ti { color: var(--rf-faint); text-align: center; }
.rf-settings-table-row .rf-field { width: 100%; }
.rf-settings-table-row > .rf-quiet { opacity: .5; }
.rf-settings-table-row:hover > .rf-quiet, .rf-settings-table-row > .rf-quiet:focus-visible { opacity: 1; }
.rf-settings-table-head { min-height: 22px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--rf-faint); }
.rf-settings-table-new { margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--rf-hair); }
.rf-settings-groups { display: grid; gap: 8px; margin-top: 8px; justify-items: start; }
.rf-settings-group-box { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--rf-hair); border-radius: 6px; }
.rf-settings-group-head { display: flex; align-items: center; gap: 4px; }
.rf-settings-group-head .rf-field { flex: 1; font-weight: 600; }
.rf-settings-group-box .rf-settings-list { border: 0; padding: 4px 0 0; min-height: 0; }
.rf-settings-keys { display: inline-flex; align-items: center; gap: 8px; }
.rf-settings-keys .rf-field { width: 200px; font-family: var(--rf-mono); }
.rf-settings-keys .rf-quiet[aria-pressed="true"] { color: inherit; }
.rf-settings-range-box { display: inline-flex; align-items: center; gap: 10px; }
.rf-settings-range { -webkit-appearance: none; appearance: none; width: 200px; height: 18px; margin: 0; background: none; cursor: pointer; }
.rf-settings-range:focus { outline: none; }
.rf-settings-range::-webkit-slider-runnable-track { height: 2px; border-radius: 1px; background: var(--rf-line); }
.rf-settings-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -5px; border: 1px solid var(--rf-line); border-radius: 50%; background: var(--ls-primary-background-color, Canvas); box-shadow: 0 0 0 1px var(--rf-quiet) inset; }
.rf-settings-range:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--rf-line); outline-offset: 1px; }
.rf-settings-range-value { min-width: 56px; font-variant-numeric: tabular-nums; color: var(--rf-quiet); }
.rf-settings-list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 8px; }
.rf-settings-list .rf-field { min-width: 120px; flex: 1; }
.rf-settings-empty { padding: 40px 0; text-align: center; color: var(--rf-faint); }
.rf-settings-foot { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 14px; border-top: 1px solid var(--rf-hair); }
.rf-settings-foot .rf-settings-status { flex: 1; }
.rf-settings-status.rf-needs-reload { color: inherit; }
dialog.refinement-settings [hidden] { display: none !important; }
/* The group's picture (0.4.129): a zone per section, numbered like the list beside it. The window's own layout; the
   words of the zones (.m, .t, .h, u, .mono, .ind, .row, .b) are quiet marks in the kit's greys, no colour. */
.rf-settings-card { margin-top: 16px; padding: 12px 14px 14px; border: 1px solid var(--rf-hair); border-radius: 8px; }
.rf-settings-card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.rf-settings-card-title { font-size: 15px; font-weight: 600; }
.rf-settings-card-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 205px); gap: 14px; align-items: start; }
.rs-art { display: grid; gap: 6px; min-width: 0; font-size: 12px; line-height: 1.45; }
.rs-zone { position: relative; min-width: 0; padding: 6px 8px 6px 30px; border: 1px solid var(--rf-hair); border-radius: 6px; cursor: pointer; overflow: hidden; }
.rs-zone::before, .rs-legend .rs-n { content: attr(data-n); display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--rf-line); border-radius: 50%; font-size: 10px; font-weight: 600; line-height: 1; color: var(--rf-quiet); }
.rs-zone::before { position: absolute; left: 7px; top: 7px; }
.rs-art.rs-focus .rs-zone { opacity: .45; }
.rs-art.rs-focus .rs-zone[aria-current], .rs-zone:hover { opacity: 1 !important; border-color: var(--rf-line); }
.rs-zone.rs-off > * { opacity: .45; text-decoration: line-through; text-decoration-color: var(--rf-line); }
.rs-zone.rs-off { padding-right: 56px; }
.rs-zone.rs-off::after { content: 'paused'; position: absolute; right: 8px; top: 7px; font-size: 10px; color: var(--rf-faint); }
.rs-art .win { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 6px; }
.rs-art .win .rs-zone { padding-top: 26px; padding-left: 8px; }
.rs-art .m { color: var(--rf-faint); }
.rs-art .t { font-size: 15px; font-weight: 600; line-height: 1.25; }
.rs-art .h { font-weight: 600; }
.rs-art .b { display: inline-block; width: 4px; height: 4px; margin: 0 6px 2px 0; border-radius: 50%; background: var(--rf-line); vertical-align: middle; }
.rs-art .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.rs-art .ind { padding-left: 10px; }
.rs-art u { text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 2px; }
.rs-art .mono { font-family: var(--rf-mono); font-size: 11px; }
.rs-art .dbox { padding: 0 3px; border-radius: 3px; background: var(--rf-wash); }
.rs-art .pencil { font-style: italic; color: var(--rf-faint); text-decoration: underline dotted; text-underline-offset: 2px; }
.rs-art .cap { display: inline-block; padding: 0 3px; border-bottom: 1px solid var(--rf-line); font-family: var(--rf-mono); font-size: 10px; line-height: 1.3; color: var(--rf-quiet); }
.rs-art .caret { display: inline-block; width: 1px; height: 1em; margin-left: 1px; background: currentColor; vertical-align: -2px; }
.rs-art .menu { display: inline-block; margin: 3px 0 0 10px; padding: 2px 0; border: 1px solid var(--rf-hair); border-radius: 5px; font-size: 11px; }
.rs-art .menu .mrow { display: flex; gap: 10px; justify-content: space-between; padding: 0 8px; }
.rs-art .menu .mrow.sel { background: var(--rf-wash); }
.rs-art .box { padding: 1px 6px; border-bottom: 1px solid var(--rf-line); margin-bottom: 3px; }
.rs-art .tb { margin-top: 4px; padding-top: 3px; border-top: 1px solid var(--rf-hair); color: var(--rf-faint); font-size: 11px; }
.rs-art .doc { margin: 4px 0 0 10px; padding: 4px 8px; border: 1px solid var(--rf-hair); border-radius: 4px; }
.rs-legend { display: grid; gap: 2px; align-content: start; }
.rs-legend button { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 4px; align-items: start; padding: 5px 6px; border: 0; border-radius: 4px; background: none; color: var(--rf-quiet); font: inherit; text-align: left; cursor: pointer; }
.rs-legend button:hover, .rs-legend button[aria-current] { color: inherit; background: var(--rf-wash); }
.rs-legend .rs-n { margin-top: 1px; }
.rs-legend b { display: block; font-weight: 600; font-size: 13px; }
.rs-legend .rs-d { display: block; font-size: 12px; line-height: 1.35; color: var(--rf-faint); }
.rs-legend button.rs-off b::after { content: ' · paused'; font-weight: 400; color: var(--rf-faint); }
.rf-settings-card.rf-settings-card-focus .rf-settings-card-note, .rf-settings-card.rf-settings-card-focus .rs-legend button:not([aria-current]) .rs-d { display: none; }
.rf-settings-row.rf-settings-paused > .rf-settings-text, .rf-settings-row.rf-settings-paused > .rf-settings-control { opacity: .45; }
/* A small picture of what a look setting changes (0.4.173), beside its tick box; only a setting with a preview has one. */
.rs-pv { width: 172px; height: 54px; box-sizing: border-box; overflow: hidden; padding: 5px 8px; border: 1px solid var(--rf-hair); border-radius: 6px; font-size: 11px; line-height: 1.4; white-space: nowrap; cursor: pointer; }
`;

/* Umbrella groups (0.4.129): the sections gathered by what they are for, each group with a picture of where on
   screen its sections work. This part holds only the groups' shells; each section's heading brings the rest in
   its part's own schema (since 0.4.163, its words and picture since 0.4.173): group and rank (its place), legend
   (its line beside the picture), zone (its piece of the picture), pauseSwitch (a paused part: the switch that
   turns it back on; its other rows step back while that is off), icon (the kit's name; a default by its key
   otherwise) and last (shown after the others). A section that names no group goes into Other. The number on a
   zone is given when it is drawn, so the picture and the list beside it always agree. layout 'win' lays the zones
   side by side, like the parts of Logseq's window. */
const GROUPS = [
  { key: 'reading', title: 'Reading a page', note: 'How pages, rows and links look. Nothing here writes to your notes.' },
  { key: 'writing', title: 'Writing a record', note: 'Help while you write. Nothing is written until you press a key.' },
  { key: 'around', title: 'Around the page', note: 'The parts of Logseq’s window around the page.', layout: 'win' },
  { key: 'tools', title: 'Tools', note: 'Things you run when you need them, and the plugin’s keys.' },
  { key: 'paused', title: 'Paused', note: 'Switched off for now. Turn one on with its first switch, then reload the plugin.' },
];
// A section's icon, from the kit's list: its heading's own, else by what its key says, else its group's.
const ICON_BY_KEY = [[/twoWay/, 'twoWay'], [/tagTree|tags/i, 'map'], [/shadow|proposal/i, 'proposals'], [/linkText/, 'link'], [/picker/, 'picked'], [/tagMenu/, 'tag'], [/troubleshoot/, 'settings'], [/shortcut/, 'shortcut']];
const ICON_BY_GROUP = { reading: 'page', writing: 'proposals', around: 'sidebar', tools: 'settings', paused: 'hide' };
const iconOf = heading => heading.icon || ICON_BY_KEY.find(([re]) => re.test(heading.key))?.[1] || ICON_BY_GROUP[heading.group] || 'settings';
// A section's picture, from its heading's zone; a group's picture is its sections' zones in their order.
const zoneOf = heading => heading.zone ? `<div class="rs-zone" data-section="${heading.key}">${heading.zone}</div>` : '';
const artOf = group => {
  const zones = group.sections.map(section => zoneOf(section.heading)).join('');
  return zones && (group.layout === 'win' ? `<div class="win">${zones}</div>` : zones);
};
function groupsOf(sections) {
  const groups = GROUPS.map(group => ({ ...group, sections: [] }));
  const other = { key: 'other', title: 'Other', note: '', sections: [] };
  for (const section of sections) (groups.find(group => group.key === section.heading.group) || other).sections.push(section);
  const rank = section => section.heading.rank ?? 0;
  for (const group of groups) group.sections.sort((a, b) => rank(a) - rank(b) || sections.indexOf(a) - sections.indexOf(b));
  const shown = [...groups, other].filter(group => group.sections.length);
  for (const group of shown) for (const section of group.sections) section.group = group;
  return shown;
}

const valueOf = item => {
  const value = settingsNow()?.[item.key];
  return value === undefined || value === null || typeof value !== typeof item.default ? item.default : value;
};
const RELOAD_RE = /after you reload/i;
/* What a text setting holds (0.4.415), from its schema's list: { split, ordered, pairs, groups, suggest, about }.
   split is what the parts split on (',' or ';'); ordered: the names can be dragged into order; pairs: "a = b; c = d"
   as a table of two columns; groups: "Name: a, b; Name: c" as boxes of names; suggest: whose names are offered as you
   type (tags, properties, graph); about: the words the window shows in place of the description, which spells out the
   one-line form Logseq's own settings page still needs. A description starting "Comma-separated" is a list too. */
const listOf = item => item.type !== 'string' ? null : item.list || (/^Comma-separated/i.test(item.description || '') ? { split: ',', suggest: /tag/i.test(item.key) ? 'tags' : null } : null);
// Keys in Logseq's spelling (the shortcuts of the register, and the settings named …Keys or …Shortcut) get a recorder.
const isKeys = item => item.type === 'string' && (!!item.command || /(Keys|Shortcut)$/.test(item.key));
const splitOn = (text, sep) => String(text ?? '').split(sep === ';' ? /[;\n]/ : sep).map(word => word.trim()).filter(Boolean);
const joinWith = sep => sep === ';' ? '; ' : ', ';
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
// A key as Logseq spells it (mod is ⌘ on a Mac, Ctrl elsewhere); null for a modifier pressed alone.
const KEY_WORDS = { ' ': 'space', Enter: 'enter', Tab: 'tab', Backspace: 'backspace', Delete: 'delete', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'esc' };
function keyWord(event, mac) {
  if (['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Fn'].includes(event.key)) return null;
  // Option changes the letter on a Mac (alt+l types ¬), so letters and digits come from the key's place.
  const base = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : /^Digit\d$/.test(event.code) ? event.code.slice(5) : KEY_WORDS[event.key] || event.key.toLowerCase();
  const mods = [];
  if (mac ? event.metaKey : event.ctrlKey) mods.push('mod');
  if (mac && event.ctrlKey) mods.push('ctrl');
  if (event.altKey) mods.push('alt');
  if (event.shiftKey) mods.push('shift');
  return { text: [...mods, base].join('+'), plain: !mods.length };
}
// “Applies right away.” is the usual case and goes unsaid; “after you reload” becomes a small note.
const tidyText = text => (text || '').replace(/\s*(Changes here apply|Changes to [^.]* apply|Applies) (right away|after you reload the plugin|at once)\.?/g, '').trim();
let lastSection = null;

// Text with the searched words picked out.
function fillMarked(doc, node, text, words) {
  node.textContent = '';
  if (!words.length) { node.textContent = text; return; }
  const re = new RegExp(words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let at = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > at) node.append(text.slice(at, match.index));
    node.append(el(doc, 'span', { class: 'rf-settings-hit' }, match[0]));
    at = match.index + match[0].length;
  }
  if (at < text.length) node.append(text.slice(at));
}
// Settings grouped under their headings, in the order shown in the list on the left; the shortcuts of the register
// (0.4.317) as a section of their own under Tools, each one's setting taken out of its own section.
function sectionsOf(items) {
  const sections = [];
  let current = null;
  const bound = new Map((commands?.() || []).filter(c => c.shortcut).map(c => [c.shortcut, c]));
  const shortcuts = { heading: { key: 'shortcuts', title: 'Shortcuts', group: 'tools', rank: 3, icon: 'shortcut', legend: 'Every key the plugin listens for, in Logseq’s spelling (mod is ⌘ on a Mac, Ctrl elsewhere)',
    zone: '<div><span class="mono">mod+alt+l</span> <span class="m">link selected text</span></div><div><span class="mono">alt+enter</span> <span class="m">step through the properties</span></div>' }, items: [] };
  for (const item of items) {
    if (item.type === 'heading') { current = { heading: item, items: [] }; sections.push(current); continue; }
    if (!current) { current = { heading: { key: 'general', title: 'General' }, items: [] }; sections.push(current); }
    if (bound.has(item.key)) { shortcuts.items.push({ ...item, title: bound.get(item.key).label, command: bound.get(item.key) }); continue; }
    // The graph's structure is edited in the tag map, not here (0.4.439, docs/STRUCTURE.md stage 6): marked hidden.
    if (['boolean', 'string', 'number', 'enum'].includes(item.type) && !item.hidden) current.items.push(item);
  }
  if (shortcuts.items.length) sections.push(shortcuts);
  // Lists kept by other windows (such as rich copy's left-out properties) are not shown.
  return sections.filter(section => section.items.length)
    .sort((a, b) => !!a.heading.last - !!b.heading.last); // such as shortcuts, looked up least often
}

// The window open now, so an unload can close it (0.4.279: a reload from Logseq's Plugins panel with the window open
// left its Escape listener on Logseq's document; the window's own Reload button already closes it first).
let closeOpen = null;
function open() {
  const doc = host();
  closeOpen?.();
  let reloadWanted = false;
  const status = note(doc, 'Changes are saved as you make them.', 'rf-settings-status');
  const save = (entry, value) => {
    saveSettings({ [entry.item.key]: value });
    entry.value = value;
    entry.markChanged();
    entry.drawPreview?.(value);
    if (entry.reload) reloadWanted = true;
    if (sections.some(section => section.heading.pauseSwitch === entry.item.key)) markPaused();
    status.textContent = reloadWanted ? 'Saved. Some changes show after you reload the plugin.' : 'Saved.';
    status.classList.toggle('rf-needs-reload', reloadWanted);
    updateCounts();
  };

  // The names a list offers as you type, read once per window.
  const SOURCES = {
    tags: () => tagTitles(),
    properties: async () => (await propSchema()).props.map(prop => prop.title),
    graph: async () => { const name = String((await currentGraph())?.name || '').replace(/^logseq_db_/, ''); return name ? [name] : []; },
  };
  const sourced = new Map();
  const namesOf = source => { if (!SOURCES[source]) return Promise.resolve([]); if (!sourced.has(source)) sourced.set(source, SOURCES[source]().catch(() => [])); return sourced.get(source); };

  /* THE name box of every list: the kit's field, the source's names offered in the kit's list pop-up as you type
     (Up and Down move, Enter or a click takes one); Enter takes what is typed. taken() names what is already there.
     keep leaves a picked name in the box (the first column of a table) instead of adding it at once. */
  const nameBox = ({ placeholder = 'Add…', title, source, taken = () => [], add, keys: more, keep = false, comma = false }) => {
    let pop = null, names = null;
    const closePop = () => { pop?.close(); pop = null; };
    namesOf(source).then(list => { names = list; });
    const pick = text => { closePop(); if (keep) { f.input.value = text; add(text, true); return; } f.input.value = ''; add(text); };
    const suggest = () => {
      if (!names?.length) return;
      const q = f.input.value.trim().toLowerCase(), have = taken();
      // The graph's own name is offered as soon as the box is entered; the long lists only once something is typed.
      const hits = q || source === 'graph' ? names.filter(n => n.toLowerCase().includes(q) && !have.some(h => same(h, n))).slice(0, 8) : [];
      if (!hits.length || (hits.length === 1 && same(hits[0], q))) { closePop(); return; }
      const list = hits.map(n => ({ icon: source === 'tags' ? 'tag' : source === 'properties' ? 'property' : null, label: n, run: () => pick(n) }));
      if (pop && !pop.isClosed) pop.items(list); else pop = shared.popup({ doc, at: f, manual: true, items: list, width: 240, onClose: () => { pop = null; } });
      pop.lit(0);
    };
    const f = field(doc, { placeholder, inline: true, title,
      keys: event => {
        const open = pop && !pop.isClosed;
        if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { const n = pop.body.querySelectorAll('.rf-item').length; pop.lit(((pop.litAt < 0 ? 0 : pop.litAt) + (event.key === 'ArrowDown' ? 1 : n - 1)) % n); return true; }
        if (event.key === 'Enter' || (comma && event.key === ',')) {
          const lit = open ? pop.body.querySelectorAll('.rf-item')[pop.litAt] : null;
          if (lit) { lit.click(); return true; }
          if (f.input.value.trim()) { pick(f.input.value.trim()); return true; }
        }
        if (event.key === 'Escape' && open) { closePop(); return true; }
        return more?.(event) === true;
      },
      input: suggest });
    f.input.addEventListener('focus', () => { if (source === 'graph') suggest(); });
    f.input.addEventListener('blur', () => setTimeout(() => { if (pop?.el.contains(doc.activeElement)) return; closePop(); if (!keep && f.input.value.trim()) pick(f.input.value.trim()); }, 120));
    return f;
  };

  /* A list of names (tags, fields, graphs, sidebar items) as separate words: each with a × on hover, the name box at
     the end to add more (a comma adds as well; Backspace in the empty box takes back the last). An ordered list numbers
     its words and they can be dragged into a new order. Still saved as the one line the parts read. */
  const chipsControl = (entry, list) => {
    const { item } = entry;
    let items = [], dragFrom = -1;
    const box = el(doc, 'div', { class: `rf-settings-list${list.ordered ? ' rf-settings-ordered' : ''}`, role: 'group', 'aria-label': item.title });
    const commit = () => save(entry, items.join(joinWith(list.split)));
    const draw = () => {
      for (const word of [...box.querySelectorAll('.rf-chip')]) word.remove();
      items.forEach((name, index) => {
        const word = chip(doc, { label: name, title: list.ordered ? 'Drag to move' : null, remove: () => { items.splice(index, 1); draw(); commit(); } });
        if (list.ordered) {
          word.prepend(el(doc, 'span', { class: 'rf-settings-n' }, String(index + 1)));
          word.draggable = true;
          word.addEventListener('dragstart', event => { dragFrom = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', name); word.classList.add('rf-settings-dragging'); });
          word.addEventListener('dragend', () => { dragFrom = -1; draw(); });
          word.addEventListener('dragover', event => { if (dragFrom < 0) return; event.preventDefault(); for (const w of box.querySelectorAll('.rf-settings-drop')) w.classList.remove('rf-settings-drop'); word.classList.add('rf-settings-drop'); });
          word.addEventListener('drop', event => {
            event.preventDefault();
            if (dragFrom < 0 || dragFrom === index) return;
            const [moved] = items.splice(dragFrom, 1);
            items.splice(index, 0, moved);
            dragFrom = -1;
            draw();
            commit();
          });
        }
        f.before(word);
      });
    };
    const add = text => {
      const fresh = splitOn(text, list.split).map(word => list.suggest === 'tags' ? word.replace(/^#/, '') : word)
        .filter((word, i, all) => !items.some(have => same(have, word)) && all.findIndex(w => same(w, word)) === i);
      if (!fresh.length) return;
      items.push(...fresh);
      draw();
      commit();
    };
    const f = nameBox({ title: `Add to ${item.title}`, source: list.suggest, taken: () => items, add, comma: true,
      keys: event => { if (event.key === 'Backspace' && !f.input.value && items.length) { items.pop(); draw(); commit(); return true; } return false; } });
    box.addEventListener('mousedown', event => { if (event.target === box) { event.preventDefault(); f.input.focus(); } });
    box.append(f);
    const show = value => { items = splitOn(value, list.split); draw(); };
    return [box, show, true];
  };

  /* Pairs ("field = words; field = words") as a table: one line per pair, both sides changed in place, a × to take one
     out, and an empty line at the end whose first box offers the fields. */
  const pairsControl = (entry, list) => {
    const { item } = entry;
    let pairs = [];
    const sep = list.pairs || '=';
    const box = el(doc, 'div', { class: 'rf-settings-table', role: 'group', 'aria-label': item.title });
    const commit = () => save(entry, pairs.filter(([a, b]) => a && b).map(([a, b]) => `${a} ${sep} ${b}`).join(joinWith(list.split)));
    const head = el(doc, 'div', { class: 'rf-settings-table-row rf-settings-table-head' }, el(doc, 'span', {}, list.left || 'Name'), el(doc, 'span'), el(doc, 'span', {}, list.right || 'Words'), el(doc, 'span'));
    const cell = (value, label, change) => {
      const f = field(doc, { inline: true, value, title: label, keys: event => { if (event.key === 'Enter') { f.input.blur(); return true; } return false; } });
      f.input.setAttribute('aria-label', label);
      f.input.addEventListener('change', () => change(f.input.value.trim()));
      return f;
    };
    const lineOf = (pair, index) => {
      const x = quiet(doc, { icon: 'remove', title: 'Take this line out', run: () => { pairs.splice(index, 1); draw(); commit(); } });
      x.setAttribute('aria-label', `Take out ${pair[0]}`);
      return el(doc, 'div', { class: 'rf-settings-table-row' },
        cell(pair[0], list.left || 'Name', v => { if (!v) { pairs.splice(index, 1); draw(); } else pair[0] = v; commit(); }),
        icon(doc, 'to'),
        cell(pair[1], list.right || 'Words', v => { pair[1] = v; commit(); }), x);
    };
    // The new line: pick or type the field, then the words; Enter in the words adds the line.
    const right = field(doc, { inline: true, placeholder: 'reads as…', title: list.right || 'Words',
      keys: event => { if (event.key === 'Enter') { addLine(); return true; } return false; } });
    const left = nameBox({ placeholder: 'Add a field…', title: list.left || 'Name', source: list.suggest, keep: true, taken: () => pairs.map(([a]) => a), add: () => right.input.focus() });
    const addLine = () => {
      const a = left.input.value.trim(), b = right.input.value.trim();
      if (!a || !b) { (a ? right : left).input.focus(); return; }
      const have = pairs.find(([x]) => same(x, a));
      if (have) have[1] = b; else pairs.push([a, b]);
      left.input.value = right.input.value = '';
      draw();
      commit();
      left.input.focus();
    };
    const addRow = el(doc, 'div', { class: 'rf-settings-table-row rf-settings-table-new' }, left, icon(doc, 'to'), right, quiet(doc, { icon: 'add', title: 'Add this line', run: addLine }));
    const draw = () => { box.textContent = ''; box.append(head, ...pairs.map(lineOf), addRow); };
    const show = value => { pairs = splitOn(value, list.split).map(part => { const at = part.indexOf(sep); return at < 0 ? [part.trim(), ''] : [part.slice(0, at).trim(), part.slice(at + 1).trim()]; }).filter(([a]) => a); draw(); };
    return [box, show, true];
  };

  /* Groups ("Name: a, b; Name: c") as boxes: each with its name to change in place, its names as words with a × and
     a box to add one, arrows to move the group up or down, and a × to take the group out; + New group at the end. A
     name put in one group leaves any other, as on the map. */
  const groupsControl = (entry, list) => {
    const { item } = entry;
    let groups = [];
    const box = el(doc, 'div', { class: 'rf-settings-groups', role: 'group', 'aria-label': item.title });
    const commit = () => save(entry, groups.filter(g => g.name).map(g => `${g.name}: ${g.names.join(', ')}`).join('; '));
    const groupBox = (group, index) => {
      const name = field(doc, { inline: true, value: group.name, placeholder: 'Name of the group', title: 'Name of the group', keys: event => { if (event.key === 'Enter') { name.input.blur(); return true; } return false; } });
      name.classList.add('rf-settings-group-name');
      name.input.addEventListener('change', () => { group.name = name.input.value.trim(); commit(); });
      const move = by => { const [g] = groups.splice(index, 1); groups.splice(index + by, 0, g); draw(); commit(); };
      const up = quiet(doc, { icon: 'chevron-up', title: 'Move up', run: () => move(-1) });
      const down = quiet(doc, { icon: 'chevron-down', title: 'Move down', run: () => move(1) });
      up.disabled = index === 0;
      down.disabled = index === groups.length - 1;
      const drop = quiet(doc, { icon: 'remove', title: 'Take this group out (its properties stay)', run: () => { groups.splice(index, 1); draw(); commit(); } });
      const words = el(doc, 'div', { class: 'rf-settings-list' });
      const add = text => {
        const fresh = splitOn(text, ',').filter(word => !group.names.some(have => same(have, word)));
        if (!fresh.length) return;
        for (const g of groups) if (g !== group) g.names = g.names.filter(have => !fresh.some(word => same(word, have)));
        group.names.push(...fresh);
        draw();
        commit();
        box.querySelectorAll('.rf-settings-group-box')[index]?.querySelector('.rf-settings-list input')?.focus();
      };
      const f = nameBox({ placeholder: 'Add a property…', title: `Add to ${group.name || 'this group'}`, source: list.suggest, taken: () => group.names, add, comma: true });
      group.names.forEach((n, i) => words.append(chip(doc, { label: n, remove: () => { group.names.splice(i, 1); draw(); commit(); } })));
      words.append(f);
      words.addEventListener('mousedown', event => { if (event.target === words) { event.preventDefault(); f.input.focus(); } });
      return el(doc, 'div', { class: 'rf-settings-group-box' }, el(doc, 'div', { class: 'rf-settings-group-head' }, name, up, down, drop), words);
    };
    const newGroup = quiet(doc, { icon: 'add', label: 'New group', run: () => {
      let n = 1;
      while (groups.some(g => same(g.name, n === 1 ? 'New group' : `New group ${n}`))) n += 1;
      groups.push({ name: n === 1 ? 'New group' : `New group ${n}`, names: [] });
      draw();
      commit();
      const name = [...box.querySelectorAll('.rf-settings-group-name input')].pop();
      name?.focus();
      name?.select();
    } });
    const draw = () => { box.textContent = ''; box.append(...groups.map(groupBox), newGroup); };
    const show = value => {
      groups = String(value ?? '').split(';').map(part => { const at = part.indexOf(':'); return { name: (at < 0 ? part : part.slice(0, at)).trim(), names: at < 0 ? [] : splitOn(part.slice(at + 1), ',') }; }).filter(g => g.name);
      draw();
    };
    return [box, show, true];
  };

  /* Keys: the field, as before, and Record: the next keys pressed are written in Logseq's spelling. A plain key waits a
     moment for a second one, so chords such as g m can be recorded; Escape stops without a change, Backspace alone
     records none. */
  const keysControl = entry => {
    const { item } = entry;
    const mac = /Mac/i.test(doc.defaultView.navigator.platform || '');
    let recording = null, timer = 0;
    const finish = text => {
      clearTimeout(timer);
      recording = null;
      record.setAttribute('aria-pressed', 'false');
      record.lastChild.textContent = 'Record';
      f.input.placeholder = '';
      if (text === undefined) { show(entry.value); return; }
      show(text);
      save(entry, text);
    };
    const f = field(doc, { inline: true, title: item.title,
      keys: event => {
        if (recording) {
          if (event.key === 'Escape') { finish(); return true; }
          if (event.key === 'Backspace' && !recording.length) { finish(''); return true; }
          const word = keyWord(event, mac);
          if (!word) return true;
          recording.push(word.text);
          f.input.value = recording.join(' ');
          clearTimeout(timer);
          if (word.plain && recording.length === 1) timer = setTimeout(() => finish(recording.join(' ')), 900);
          else finish(recording.join(' '));
          return true;
        }
        if (event.key === 'Enter') { f.input.blur(); return true; }
        return false;
      } });
    f.input.setAttribute('aria-label', item.title);
    f.input.addEventListener('blur', () => { if (recording) finish(recording.length ? recording.join(' ') : undefined); });
    f.input.addEventListener('change', () => { if (!recording) save(entry, f.input.value.trim()); });
    const record = quiet(doc, { icon: 'shortcut', label: 'Record', faint: true, pressed: false, title: 'Press the keys you want (Escape: no change, Backspace: none)', run: () => {
      if (recording) { finish(); return; }
      recording = [];
      record.setAttribute('aria-pressed', 'true');
      record.lastChild.textContent = 'Press the keys…';
      f.input.value = '';
      f.input.placeholder = 'Press the keys…';
      f.input.focus();
    } });
    const show = value => { f.input.value = String(value ?? ''); };
    return [el(doc, 'span', { class: 'rf-settings-keys' }, f, record), show];
  };

  // A number with a range: a slider with the value beside it, saved when let go.
  const rangeControl = entry => {
    const { item } = entry;
    const [min, max, step = 1, unit = ''] = item.range;
    const slider = el(doc, 'input', { type: 'range', min: String(min), max: String(max), step: String(step), class: 'rf-settings-range', 'aria-label': item.title });
    const shown = el(doc, 'span', { class: 'rf-settings-range-value' });
    const label = () => { shown.textContent = `${slider.value}${unit ? ' ' + unit : ''}`; };
    slider.addEventListener('input', label);
    slider.addEventListener('change', () => save(entry, Number(slider.value)));
    keepKeysIn(slider);
    const show = value => { slider.value = String(value); label(); };
    return [el(doc, 'span', { class: 'rf-settings-range-box' }, slider, shown), show];
  };
  // Arrow keys on the slider stay with it, not with Logseq.
  const keepKeysIn = node => { for (const type of ['keydown', 'keyup']) node.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); };

  // One control per kind of setting; each returns the control and a way to show a new value in it.
  const control = entry => {
    const { item } = entry;
    if (item.type === 'boolean') {
      const box = tick(doc, { checked: valueOf(item), title: item.title, change: on => save(entry, on) });
      box.setAttribute('aria-label', item.title);
      return [box, value => { box.checked = !!value; }];
    }
    if (item.type === 'enum') {
      const box = el(doc, 'span', { class: 'rf-seg', role: 'group', 'aria-label': item.title });
      const show = value => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.choice === value)); };
      for (const choice of item.enumChoices || []) {
        const b = quiet(doc, { label: choice, run: () => { show(choice); save(entry, choice); } });
        b.dataset.choice = choice;
        box.append(b);
      }
      return [box, show];
    }
    const list = listOf(item);
    if (list?.groups) return groupsControl(entry, list);
    if (list?.pairs) return pairsControl(entry, list);
    if (list) return chipsControl(entry, list);
    if (isKeys(item)) return keysControl(entry);
    if (item.type === 'number' && Array.isArray(item.range)) return rangeControl(entry);
    // Text and numbers: the field, saved on Enter or when it is left.
    const f = field(doc, { inline: true, title: item.title, keys: event => { if (event.key === 'Enter') { f.input.blur(); return true; } return false; } });
    f.input.setAttribute('aria-label', item.title);
    const show = value => { f.input.value = String(value ?? ''); };
    f.input.addEventListener('change', () => {
      const next = item.type === 'number' ? Number(f.input.value) : f.input.value;
      if (item.type === 'number' && Number.isNaN(next)) { show(entry.value); return; }
      save(entry, next);
    });
    return [f, show];
  };

  const groups = groupsOf(sectionsOf(settingsSchema()));
  const sections = groups.flatMap(group => group.sections);
  const entries = [];
  const body = el(doc, 'div', { class: 'rf-settings-body' });
  const card = el(doc, 'div', { class: 'rf-settings-card' });
  body.append(card);
  const empty = el(doc, 'div', { class: 'rf-settings-empty', hidden: true });
  for (const section of sections) {
    const sectionReload = RELOAD_RE.test(section.heading.description || '');
    const noteText = tidyText(section.heading.description);
    const rows = el(doc, 'div', { class: 'rf-settings-rows' });
    section.node = el(doc, 'section', {}, el(doc, 'h3', {}, section.heading.title),
      sectionReload ? note(doc, [noteText, 'Changes here show after you reload the plugin.'].filter(Boolean).join(' '), 'rf-settings-note')
        : noteText ? note(doc, noteText, 'rf-settings-note') : null,
      rows);
    body.append(section.node);
    for (const item of section.items) {
      const entry = { item, section, value: valueOf(item), reload: sectionReload || RELOAD_RE.test(item.description || '') };
      const [input, show, wide] = control(entry);
      // A small picture of the setting's effect, where one is drawn; clicking it flips the tick box.
      let preview = null;
      if (item.type === 'boolean' && Array.isArray(item.preview)) {
        preview = el(doc, 'div', { class: 'rs-pv', 'aria-hidden': 'true', title: 'What this changes (click to switch)' });
        preview.addEventListener('click', () => input.click());
        entry.drawPreview = value => { preview.innerHTML = item.preview[value ? 1 : 0] || ''; };
        entry.drawPreview(entry.value);
      }
      show(entry.value);
      const titleText = el(doc, 'span');
      const reset = quiet(doc, { label: 'Reset', faint: true, title: `Back to the default: ${item.type === 'boolean' ? (item.default ? 'on' : 'off') : item.default === '' ? 'empty' : item.default}`, run: () => { show(item.default); save(entry, item.default); } });
      const title = el(doc, 'div', { class: 'rf-settings-title' }, titleText,
        entry.reload && !sectionReload ? note(doc, 'after reload') : null, reset);
      const desc = el(doc, 'div', { class: 'rf-note rf-settings-desc' });
      const more = quiet(doc, { label: 'More', faint: true, cls: 'rf-settings-more', run: () => { const opened = desc.classList.toggle('rf-open'); more.lastChild.textContent = opened ? 'Less' : 'More'; } });
      more.hidden = true;
      // A list shows its names one by one, so “Comma-separated tag names” reads “Tag names”.
      const descText = listOf(item)?.about || tidyText(item.description).replace(/^Comma-separated (\w)/i, (_, first) => first.toUpperCase());
      entry.row = el(doc, 'div', { class: 'rf-settings-row' },
        el(doc, 'div', { class: 'rf-settings-text' }, title, descText ? desc : null, descText ? more : null, wide ? input : null),
        wide ? null : el(doc, 'div', { class: 'rf-settings-control' }, preview, input));
      entry.mark = words => { fillMarked(doc, titleText, item.title, words); fillMarked(doc, desc, descText, words); };
      entry.markChanged = () => {
        const changed = entry.value !== item.default;
        titleText.classList.toggle('rf-settings-changed', changed);
        titleText.title = changed ? 'Changed from the default' : '';
        reset.hidden = !changed;
      };
      entry.haystack = `${item.title} ${descText} ${section.heading.title}`.toLowerCase();
      entry.more = more;
      entry.desc = desc;
      entry.mark([]);
      entry.markChanged();
      rows.append(entry.row);
      entries.push(entry);
    }
  }
  body.append(empty);

  // The list on the left: the groups as small labels, one quiet word with its icon per section, then the settings
  // that differ from their defaults.
  const nav = el(doc, 'nav', { class: 'rf-settings-nav', 'aria-label': 'Sections' });
  const navButton = (label, key, name) => {
    const count = note(doc, '');
    const b = quiet(doc, { icon: name, label, run: () => { find.input.value = ''; show(key); } });
    b.append(count);
    nav.append(b);
    return b;
  };
  for (const group of groups) {
    group.label = el(doc, 'div', { class: 'rf-settings-group' }, group.title);
    group.label.addEventListener('click', () => { find.input.value = ''; show('group:' + group.key); });
    nav.append(group.label);
    for (const section of group.sections) section.button = navButton(section.heading.title, section.heading.key, iconOf(section.heading));
  }
  nav.append(el(doc, 'hr'));
  const changedButton = navButton('Changed by you', 'changed', 'chosen');
  function updateCounts() {
    changedButton.lastChild.textContent = String(entries.filter(entry => entry.value !== entry.item.default).length || '');
  }

  let current = lastSection && (lastSection === 'changed' || sections.some(s => s.heading.key === lastSection) || groups.some(g => 'group:' + g.key === lastSection))
    ? lastSection : groups[0] ? 'group:' + groups[0].key : sections[0]?.heading.key;
  const pauseSwitchOf = headingKey => sections.find(section => section.heading.key === headingKey)?.heading.pauseSwitch;
  const isPaused = headingKey => !!pauseSwitchOf(headingKey) && !entries.find(entry => entry.item.key === pauseSwitchOf(headingKey))?.value;
  // A paused part's rows step back, all but the switch that turns it on.
  function markPaused() {
    for (const entry of entries) entry.row.classList.toggle('rf-settings-paused', isPaused(entry.section.heading.key) && entry.item.key !== entry.section.heading.pauseSwitch);
  }
  // The group's picture: each zone numbered like the list beside it; the section on screen stands out.
  function drawCard(group, sectionKey) {
    card.textContent = '';
    card.hidden = !group || !artOf(group);
    card.classList.toggle('rf-settings-card-focus', !!sectionKey);
    if (card.hidden) return;
    const art = el(doc, 'div', { class: 'rs-art' + (sectionKey ? ' rs-focus' : '') });
    art.innerHTML = artOf(group);
    const legend = el(doc, 'div', { class: 'rs-legend' });
    group.sections.forEach((section, index) => {
      const key = section.heading.key, n = String(index + 1), off = isPaused(key);
      for (const zone of art.querySelectorAll(`[data-section="${key}"]`)) {
        zone.dataset.n = n;
        zone.title = section.heading.title;
        zone.toggleAttribute('aria-current', key === sectionKey);
        zone.classList.toggle('rs-off', off);
        zone.addEventListener('click', () => show(key));
      }
      const button = el(doc, 'button', { type: 'button' }, el(doc, 'span', { class: 'rs-n' }, n),
        el(doc, 'span', {}, el(doc, 'b', {}, section.heading.title), el(doc, 'span', { class: 'rs-d' }, section.heading.legend || '')));
      button.toggleAttribute('aria-current', key === sectionKey);
      button.classList.toggle('rs-off', off);
      button.addEventListener('click', () => show(key));
      legend.append(button);
    });
    card.append(el(doc, 'div', { class: 'rf-settings-card-head' }, el(doc, 'span', { class: 'rf-settings-card-title' }, group.title), group.note ? note(doc, group.note, 'rf-settings-card-note') : null),
      el(doc, 'div', { class: 'rf-settings-card-grid' }, art, legend));
  }
  function show(key = current) {
    current = key;
    lastSection = key;
    const words = find.input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const groupKey = key.startsWith('group:') ? key.slice(6) : null;
    const searching = words.length > 0;
    box.classList.toggle('rf-searching', searching);
    box.classList.toggle('rf-listing', searching || key === 'changed');
    for (const entry of entries) {
      const shown = searching ? words.every(word => entry.haystack.includes(word))
        : key === 'changed' ? entry.value !== entry.item.default
        : groupKey ? entry.section.group.key === groupKey
        : entry.section.heading.key === key;
      entry.row.hidden = !shown;
      entry.mark(searching ? words : []);
    }
    for (const section of sections) {
      const hits = section.items.length && [...section.node.querySelectorAll('.rf-settings-row')].some(row => !row.hidden);
      section.node.hidden = !hits;
      section.button.classList.toggle('rf-has-hits', searching && hits);
      section.button.setAttribute('aria-pressed', String(!searching && section.heading.key === key));
    }
    for (const group of groups) group.label.classList.toggle('rf-settings-group-on', !searching && groupKey === group.key);
    changedButton.setAttribute('aria-pressed', String(!searching && key === 'changed'));
    if (searching || key === 'changed') { card.hidden = true; card.textContent = ''; }
    else drawCard(groupKey ? groups.find(group => group.key === groupKey) : sections.find(section => section.heading.key === key)?.group, groupKey ? null : key);
    const none = !entries.some(entry => !entry.row.hidden);
    empty.hidden = !none;
    empty.textContent = searching ? `No setting matches “${find.input.value.trim()}”.` : 'Every setting is at its default.';
    body.scrollTop = 0;
    // “More” only where the explanation is cut short.
    if (!searching) doc.defaultView.requestAnimationFrame(() => {
      for (const entry of entries) if (!entry.row.hidden && !entry.desc.classList.contains('rf-open')) {
        entry.more.hidden = entry.desc.scrollHeight <= entry.desc.clientHeight + 1;
      }
    });
  }

  const find = field(doc, { placeholder: 'Find a setting', icon: 'find', kbd: '/', title: 'Find a setting',
    // The first Escape empties the find box; the next closes the window (the browser's dialog does that).
    keys: event => { if (event.key === 'Escape' && find.input.value) { find.input.value = ''; find.input.dispatchEvent(new doc.defaultView.Event('input')); return true; } return false; },
    input: () => { find.querySelector('kbd').hidden = !!find.input.value; show(); } });
  let box = null, finishDialog = null;
  const close = () => finishDialog?.();
  closeOpen = close;
  shared.dialog({ doc, cls: 'refinement-settings rf-settings', build: (dialogEl, finish) => {
    box = dialogEl;
    finishDialog = finish;
    dialogEl.setAttribute('aria-label', 'Threads settings');
    // / or Cmd/Ctrl+F goes to the find box; the other keys stay in the window (the browser's dialog keeps them).
    dialogEl.addEventListener('keydown', event => {
      const typing = event.target?.matches?.('input, textarea');
      if (!typing && (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'))) { event.preventDefault(); find.input.focus(); find.input.select(); }
    });
    const closeButton = quiet(doc, { icon: 'close', title: 'Close (Esc)', run: close });
    closeButton.setAttribute('aria-label', 'Close');
    const reload = quiet(doc, { label: 'Reload plugin', faint: true, run: () => { close(); reloadPlugin(); } });
    const logseqPage = quiet(doc, { label: 'Logseq’s settings page', faint: true, run: () => { close(); openLogseqSettings(); } });
    dialogEl.append(
      el(doc, 'header', { class: 'rf-settings-head' }, el(doc, 'h2', {}, 'Threads settings'), find, closeButton),
      el(doc, 'div', { class: 'rf-settings-main' }, nav, body),
      el(doc, 'footer', { class: 'rf-settings-foot' }, status, note(doc, pluginVersion() || ''), logseqPage, reload));
  } }).then(() => { if (closeOpen === close) closeOpen = null; });
  updateCounts();
  markPaused();
  show(current);
  find.input.focus();
}

/* The three-dots menu is drawn only while open. After a click on its button, look for the menu for a
   few frames and add the item below “Plugins” (or at the end if that item is missing). */
function addMenuItem(menu) {
  const doc = menu.ownerDocument;
  // An item left by an earlier copy of the plugin would open that copy's panel, so it is replaced.
  for (const old of menu.querySelectorAll('.' + ITEM_CLASS)) old.remove();
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const plugins = items.find(item => item.querySelector('[class*="icon-apps"]')) ||
    items.find(item => item.textContent.trim() === 'Plugins');
  const model = plugins || items[0];
  if (!model) return;
  const item = model.cloneNode(true);
  item.classList.add(ITEM_CLASS);
  item.dataset.copy = COPY;
  item.removeAttribute('data-highlighted');
  item.removeAttribute('id');
  const label = [...item.querySelectorAll('div')].find(div => !div.children.length) || item;
  label.textContent = 'Threads settings';
  // Logseq draws its menu icons from the same font (Tabler); the settings icon from the kit's list takes the drawing's place.
  const svg = item.querySelector('svg');
  if (svg) svg.replaceWith(icon(doc, 'settings'));
  item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
  item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
  item.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    // Escape closes the menu the way Logseq's own items do.
    menu.dispatchEvent(new (doc.defaultView.KeyboardEvent)('keydown', { key: 'Escape', bubbles: true }));
    open();
  });
  (plugins || items[items.length - 1]).after(item);
}
function watchDotsButton() {
  const doc = host(), win = doc.defaultView;
  const onClick = event => {
    // A copy of the plugin whose frame is gone (removed without its clean-up) steps aside.
    if (!window.parent) { doc.removeEventListener('click', onClick, true); return; }
    if (!event.target.closest?.('.toolbar-dots-btn')) return;
    let tries = 0;
    const look = () => {
      const menu = [...doc.querySelectorAll('[role="menu"]')].find(m => m.querySelector('[role="menuitem"]'));
      if (menu) { if (!menu.querySelector(`.${ITEM_CLASS}[data-copy="${COPY}"]`)) addMenuItem(menu); }
      else if (++tries < 30) win.requestAnimationFrame(look);
    };
    win.requestAnimationFrame(look);
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

const menuCss = `.${ITEM_CLASS}[data-highlighted] { background: var(--rf-wash); }`;
function provide(core) {
  // For tools/boot-test.js and the palette: the window, through the core (no name on the window since 0.4.317).
  core.provide({ settingsPanel: { open } });
}
function start() {
  ({ sendStyle, settingsNow, settingsSchema, saveSettings, openLogseqSettings, reloadPlugin, pluginVersion, commands, tagTitles, propSchema, currentGraph } = take(window.refinementCore,
    ['sendStyle', 'settingsNow', 'settingsSchema', 'saveSettings', 'openLogseqSettings', 'reloadPlugin', 'pluginVersion', 'commands', 'tagTitles', 'propSchema', 'currentGraph']));
  sendStyle('refinement-settings-panel', css + menuCss);
  onUnload(watchDotsButton());
  onUnload(() => {
    closeOpen?.();
    const doc = host();
    for (const item of doc.querySelectorAll('.' + ITEM_CLASS)) item.remove();
  });
}

// The palette entry that opens the window (Logseq's own settings page for the plugin, should the window fail to open).
const commandList = [{ key: 'show-settings', label: 'Threads settings', icon: 'settings', run: () => { try { open(); } catch (error) { warnOnce('the settings window could not open', error); openLogseqSettings(); } } }];
(window.refinementParts ||= []).push({ name: 'settings panel', foundation: true, schema: [], provide, start, commands: commandList, stop: runUnloadTasks });
})();
