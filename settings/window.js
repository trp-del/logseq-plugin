/* The one settings window, for the whole plugin. One real dialog (the browser's) in Logseq's own window, in the grammar's
   look. Down the left the places where you meet things (what you see, what you do, everything else), not the six parts that
   draw them; on the right the place's settings, each drawn as the thing itself (a part gives a specimen per setting) or a
   choice between its looks. A part says at the door (PluginDoor.describe) which place each of its sections belongs to, and
   nothing here knows what any of them does, so the window keeps working whichever parts are switched off. A letter typed
   anywhere finds, through every place. Every change applies at once through the plugin's own settings; a part switched on
   or off, under Parts, waits, pencilled, for the reload.
   Spacing is one scale: 8 inside a row, 12 between rows, 32 between sections, 40 between a place's head and its first row. */
(function () {
const Door = window.PluginDoor;
const ORDER = ['look', 'find', 'threads', 'predictive', 'structure', 'export'];
// The places, in plain words: what a person is doing or looking at when they want a setting. A part sends each of its
// sections to one of these (the section's `place`); the part it came from does not show.
const GROUPS = [['What you see', ['window', 'page', 'sidebar']], ['What you do', ['writing', 'finding', 'following', 'out']], ['Everything else', ['keys', 'parts']]];
const PLACES = {
  window: ['The window', 'How Logseq’s own screens look: type, sidebar, tables, search and menus.'],
  page: ['A page', 'How links, tags, properties and bullets read on a page.'],
  sidebar: ['The right sidebar', 'The panel on the right: its bar, its pages, its links and endnotes.'],
  writing: ['Writing', 'What the plugin offers while you type.'],
  finding: ['Finding', 'The search window.'],
  following: ['Following links', 'The rows under a page that show everything pointing at it.'],
  out: ['Taking a page out', 'The PDF, Markdown and rich-text export.'],
  keys: ['Keys', 'Every keyboard shortcut, in one list.'],
  parts: ['Parts', 'Switch a part off, and find a fault.'],
};
const HOME = { look: 'window', find: 'finding', threads: 'following', predictive: 'writing', export: 'out', structure: 'parts' };   // where a part's own name leads
const placeOf = key => PLACES[key] ? key : HOME[key] || 'window';
const REOPEN_KEY = 'logseq-plugin-settings-reopen';
const { esc, host } = window.PluginDoor;
const CSS = `.sw-dialog { position: fixed !important; top: 50% !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; margin: 0 !important; width: min(1360px, 94vw); height: 90vh; max-height: 90vh; overflow: hidden; box-sizing: border-box; padding: 0; }   /* the window's look is the library's lk-window */
.sw-dialog[open] { display: grid; grid-template-columns: 204px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); pointer-events: auto; }
.sw-head { grid-column: 1 / -1; display: grid; grid-template-columns: 204px minmax(0, 1fr) auto; align-items: center; padding: 14px 16px 10px 22px; }
.sw-head b { font-size: 16px; font-weight: 600; }
.sw-find { width: 100%; max-width: calc(100% - 22px); }   /* the library's field (lk-field) */
.sw-close { all: unset; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 6px; }
.sw-side { display: flex; flex-direction: column; padding: 8px 12px 16px 14px; min-height: 0; overflow: auto; }
/* A part is a line of the library's menu (lk-item), the one open lit (on). */
.sw-mod { display: grid; grid-template-columns: minmax(0, 1fr); padding: 5px 8px; cursor: pointer; }
.sw-group { font-size: var(--lk-label); color: var(--lk-quiet); padding: 20px 8px 4px; }
.sw-group:first-child { padding-top: 4px; }
.sw-placehead { padding: 8px 0 28px; }
.sw-placehead h2 { font-size: 20px; font-weight: 600; margin: 0 0 4px; letter-spacing: -.01em; }
.sw-placehead p { margin: 0; color: var(--lk-quiet); }
.sw-mod[aria-current="true"] { font-weight: 500; }
.sw-mod.off .sw-name { color: var(--lk-quiet); }
.sw-nomatch { opacity: .4; }
.sw-foot { margin-top: auto; padding: 16px 8px 0; display: grid; gap: 2px; justify-items: start; }
.sw-word.on { font-weight: 500; }
.sw-body { min-height: 0; overflow: auto; padding: 0 22px 22px; scrollbar-gutter: stable; }
.sw-none { padding-top: 18px; margin: 0; }
.sw-part { font-weight: 600; font-size: 16px; padding-top: 18px; }
.sw-part:first-child { padding-top: 8px; }
.sw-do { justify-self: start; margin-top: -3px; margin-bottom: -3px; }
.sw-css { width: 100%; min-height: 5.5em; box-sizing: border-box; font: 13px/1.5 var(--lk-mono, monospace); border: 1px solid var(--lk-hair); border-radius: 4px; padding: 6px 8px; background: none; color: inherit; resize: vertical; outline: none; box-shadow: none; }
.sw-css:focus { border-color: var(--lk-line); outline: none; box-shadow: none; }
.sw-list { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.sw-word-x { color: inherit; }
.sw-drop { margin-left: 1px; }
.sw-add { flex: 1; min-width: 12em; }
/* One scale for the space: 8 inside a row, 12 between rows, 32 between sections. */
.sw-section + .sw-section { margin-top: 32px; }
.sw-section h3 { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
.sw-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 4px 8px; align-items: baseline; padding: 12px 0; }
.sw-row .sw-title { font-weight: 500; }
.sw-row .sw-value { grid-column: 2; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
/* The specimen: the thing drawn as it will look, at the page's size, under its name. */
.sw-spec { grid-column: 2; margin-top: 3px; font-size: 15px; line-height: 1.6; color: var(--lk-text, #222); }
.sw-spec .sw-off { color: var(--lk-quiet); }
.sw-spec .sw-blue { color: var(--ls-link-text-color, #3b6fc9) !important; text-decoration: none !important; }
.sw-spec .sw-chip { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 4px; padding: 0 6px; }
.sw-spec .sw-cap { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 10px; padding: 0 8px; }
/* A page's name in a specimen: heavier than the words, not larger (the switch is what matters here); the mark beside it
   scales with it, as it does beside the title. */
.sw-spec .sw-big { font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.sw-spec .sw-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; margin: 0 8px 2px 0; }
.sw-spec .sw-ring { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: color-mix(in srgb, currentColor 11%, transparent); align-items: center; justify-content: center; margin-right: 6px; vertical-align: -3px; }
.sw-spec .sw-k { color: var(--lk-quiet); }
.sw-spec .sw-pill { display: inline-flex; gap: .4em; }
.sw-spec .sw-line { display: flex; align-items: baseline; gap: 10px; }
.sw-spec .sw-faintw { color: var(--lk-quiet); }
.sw-spec .sw-grey { opacity: .45; }
.sw-spec .sw-sep { color: var(--lk-quiet); margin: 0 6px; } .sw-spec .sw-gap { display: inline-block; width: 18px; }
.sw-tick { align-self: center; }   /* the library's tick box (lk-tick) */
.sw-field { min-width: 6em; }   /* the Pressing set's field (input.lk-value): a hairline only while it has the keyboard */
.sw-field.sw-wide { width: min(100%, 36em); }
.sw-choices { display: flex; gap: 14px; flex-wrap: wrap; }
.sw-choice { all: unset; cursor: pointer; }   /* the library's alternatives (lk-alts): the one in force (on) in the text colour */
.sw-choice.on { font-weight: 500; }
/* It stands beside a title and must not take the title's weight, or make the row taller when it comes. */
.sw-row .sw-default { font-weight: 400; margin-top: -3px; margin-bottom: -3px; }
.sw-ba { grid-column: 2; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 16px; margin: 6px -8px 0; }
.sw-opt { all: unset; box-sizing: border-box; display: grid; align-content: start; gap: 4px; padding: 6px 8px; border-radius: 6px; cursor: pointer; min-width: 0; }
.sw-opt:hover, .sw-opt:focus-visible { background: var(--lk-wash); }
.sw-opt .sw-spec { grid-column: auto; margin-top: 0; min-width: 0; overflow: hidden; }
.sw-opt .sw-lab { font-size: var(--lk-label); color: var(--lk-quiet); }
/* The look in force stands on the wash, as the line in force in a menu does; the others are quiet until pointed at. */
.sw-opt.on { background: var(--lk-wash); }
.sw-opt:not(.on) .sw-spec { color: var(--lk-quiet); }
.sw-opt:not(.on):hover .sw-spec { color: var(--lk-text); }
.sw-row:hover { background: var(--lk-wash); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 4px; }
.sw-rest { opacity: .5; }
.sw-partrow .sw-spec { margin-top: 0; color: var(--lk-quiet); font-size: 14px; }`;

const state = { cur: 'window', view: 'part', find: '' };
/* What a setting does, without moving (the owner, 8 November 2026: "why not just show what it will look like checked and not
   checked side by side"; "remove ticked boxes and just have selection of the things"): a setting with a drawing is a choice
   between its looks, side by side, no tick box and no words for them; the one in force stands on the wash, the others quiet; a
   press on a look takes it. A setting with no drawing keeps its tick box. */
let open = null;
let names = {};   // what a list offers as you type, by the setting's key

const parts = () => ORDER.map(key => Door.modules.find(module => module.key === key)).filter(module => module && Door.described[module.key]);
const switchKey = part => part.key + 'On';
const wanted = part => logseq.settings?.[switchKey(part)] !== false;
const started = part => (Door.started || []).includes(part);
const waiting = part => wanted(part) !== started(part);
const read = item => { const value = logseq.settings?.[item.key]; return typeof value === typeof item.default ? value : item.default; };
const changed = item => item.type !== 'action' && JSON.stringify(read(item)) !== JSON.stringify(item.default);
const write = (item, value) => logseq.updateSettings({ [item.key]: value });
/* A key is shown as plain words and may be typed so ("Cmd Option Enter"); it is kept in Logseq's spelling ("mod+alt+enter"),
   mod being Cmd on a Mac and Ctrl elsewhere. */
const MAC = /Mac/.test((typeof navigator !== 'undefined' && navigator.platform) || '');
const KEY_WORDS = MAC ? { mod: 'Cmd', alt: 'Option', ctrl: 'Ctrl' } : { mod: 'Ctrl', alt: 'Alt', ctrl: 'Ctrl' };
const SPELLED = { cmd: 'mod', command: 'mod', meta: 'mod', option: 'alt', opt: 'alt', control: MAC ? 'ctrl' : 'mod', ctrl: MAC ? 'ctrl' : 'mod' };
const capital = word => word.charAt(0).toUpperCase() + word.slice(1);
const keyWords = keys => String(keys || '').split('+').map(part => part.trim()).filter(Boolean).map(part => KEY_WORDS[part] || capital(part)).join(' ');
const keySpelling = words => String(words || '').toLowerCase().split(/[\s+]+/).filter(Boolean).map(word => SPELLED[word] || word).join('+');

// A part's rows as sections: a heading opens one, the rows under it follow.
function sectionsOf(part) {
  const sections = [];
  let current = null;
  for (const item of Door.described[part.key].schema || []) {
    if (item.type === 'heading') { current = { title: item.title, place: placeOf(item.place || Door.described[part.key].place || part.key), part, items: [] }; sections.push(current); continue; }
    if (!current) { current = { title: part.title, place: placeOf(Door.described[part.key].place || part.key), part, items: [] }; sections.push(current); }
    current.items.push(item);
  }
  return sections;
}
const everyRow = () => parts().flatMap(part => sectionsOf(part).flatMap(section => section.items.map(item => ({ part, section, item, place: section.place }))));
const byKey = key => everyRow().find(row => row.item.key === key);
const matches = (row, words) => `${row.item.title} ${row.item.description || ''} ${row.section.title} ${PLACES[row.place][0]}`.toLowerCase().includes(words);
// A place's sections, from every part that sends one there, in the order the parts are listed.
const sectionsAt = place => parts().flatMap(part => sectionsOf(part).filter(section => section.place === place));
const anyChanged = () => everyRow().some(row => changed(row.item));

// A list held as "a; b" or "a = b; c = d", drawn as its words, each with its ×, and a field to add one.
const listWords = (item, value) => String(value ?? '').split(/[;\n]/).map(word => word.trim()).filter(Boolean);
function listHtml(item, value) {
  const words = listWords(item, value);
  const offer = names[item.key]?.length ? `<datalist id="sw-offer-${esc(item.key)}">${names[item.key].map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>` : '';
  return `<span class="sw-list">${words.map(word => `<span class="sw-word-x">${esc(word)}<button type="button" class="sw-drop lk-x" data-key="${esc(item.key)}" data-word="${esc(word)}" aria-label="Take out ${esc(word)}">×</button></span>`).join('')}<input class="sw-field sw-add" id="sw-${esc(item.key)}" data-add="${esc(item.key)}" placeholder="${esc(item.list.hint || 'add')}" list="sw-offer-${esc(item.key)}" spellcheck="false" autocomplete="off">${offer}</span>`;
}
function rowHtml(row) {
  const { item, part } = row;
  const html = rowHtmlRaw(row);
  return wanted(part) ? html : html.replace(/^<(div|label) class="sw-row/, '<$1 class="sw-rest sw-row');
}
function rowHtmlRaw(row) {
  const { item, part } = row;
  const { specimen } = Door.described[part.key];
  if (item.type === 'action') return `<div class="sw-row"><span></span><button type="button" class="sw-do lk-lone lk-i-go" data-action="${esc(item.key)}">${esc(item.title)}</button></div>`;
  const value = read(item), key = esc(item.key), about = esc(item.description || '');
  const reset = changed(item) ? `<button type="button" class="sw-default lk-lone lk-i-undo" data-reset="${key}" title="Back to the default">default</button>` : '';
  const spec = specimen ? specimen(item, value) : '';
  const words = v => item.type === 'boolean' ? (v ? 'On' : 'Off') : esc(item.keys ? keyWords(v) : String(v ?? ''));
  const shown = (v, s) => s ? `<div class="sw-spec">${s}</div>` : `<div class="sw-spec">${words(v)}</div>`;
  const looks = item.type === 'boolean' ? [[true, ''], [false, '']] : item.type === 'enum' ? (item.enumChoices || []).map(choice => [choice, choice]) : null;
  const pictured = !!(spec && looks);
  const drawn = pictured ? `<div class="sw-ba">${looks.map(([v, label]) => `<button type="button" class="sw-opt lk-value${JSON.stringify(v) === JSON.stringify(value) ? ' on' : ''}" data-pick="${key}" data-val="${esc(JSON.stringify(v))}" aria-pressed="${JSON.stringify(v) === JSON.stringify(value)}">${label ? `<span class="sw-lab">${esc(label)}</span>` : ''}${shown(v, specimen(item, v))}</button>`).join('')}</div>`
    : spec ? `<div class="sw-spec" title="${about}">${spec}</div>` : '';
  if (item.type === 'boolean' && pictured) return `<div class="sw-row"><span></span><span class="sw-title" title="${about}">${esc(item.title)} ${reset}</span>${drawn}</div>`;
  if (item.type === 'boolean') return `<label class="sw-row"><input type="checkbox" class="sw-tick lk-tick" id="sw-${key}" data-key="${key}"${value ? ' checked' : ''}><span class="sw-title" title="${about}">${esc(item.title)} ${reset}</span>${drawn}</label>`;
  if (item.type === 'enum') return `<div class="sw-row"><span></span><span class="sw-title" title="${about}">${esc(item.title)}</span>${pictured ? `<span class="sw-value">${reset}</span>` : `<span class="sw-value sw-choices lk-alts">${(item.enumChoices || []).map(choice => `<button type="button" class="sw-choice lk-value${String(choice) === String(value) ? ' on' : ' off'}" data-key="${key}" data-choice="${esc(choice)}" aria-pressed="${String(choice) === String(value)}">${esc(choice)}</button>`).join('')}${reset}</span>`}${drawn}</div>`;
  if (item.list) return `<div class="sw-row"><span></span><span class="sw-title" title="${about}">${esc(item.title)}</span><span class="sw-value">${listHtml(item, value)}</span></div>`;
  if (item.inputAs === 'textarea') return `<div class="sw-row"><span></span><label class="sw-title" for="sw-${key}" title="${about}">${esc(item.title)}</label><span class="sw-value"><textarea class="sw-css" id="sw-${key}" data-key="${key}" spellcheck="false" placeholder="${esc(item.placeholder || '')}">${esc(value)}</textarea></span></div>`;
  const number = item.type === 'number';
  return `<div class="sw-row"><span></span><label class="sw-title" for="sw-${key}" title="${about}">${esc(item.title)}</label><span class="sw-value"><input type="${number ? 'number' : 'text'}" class="sw-field lk-value${number ? '' : ' sw-wide'}" id="sw-${key}" data-key="${key}" value="${esc(item.keys ? keyWords(value) : value)}" placeholder="none" spellcheck="false" autocomplete="off">${reset}</span>${drawn}</div>`;
}
const rowsByPlace = rows => Object.keys(PLACES).filter(place => rows.some(row => row.place === place)).map(place => `<div class="sw-part">${esc(PLACES[place][0])}</div>${rows.filter(row => row.place === place).map(rowHtml).join('')}`).join('');

function partsHtml() {
  return `<section class="sw-section"><h3>Switch on or off</h3>${parts().map(part => `<label class="sw-row sw-partrow"><input type="checkbox" class="sw-tick lk-tick" id="sw-run-${part.key}" data-run="${part.key}"${wanted(part) ? ' checked' : ''}><span class="sw-title${waiting(part) ? ' lk-pencil' : ''}">${esc(part.title)}</span><div class="sw-spec">${esc(part.about || '')}</div></label>`).join('')}</section>`;
}
function drawBody(dlg) {
  const body = dlg.querySelector('.sw-body'), at = body.scrollTop;
  const words = state.find.trim().toLowerCase();
  if (words) {
    const rows = everyRow().filter(row => matches(row, words));
    body.innerHTML = rows.length ? rowsByPlace(rows) : '<p class="sw-none lk-none">Nothing by that name</p>';
    return;
  }
  if (state.view === 'changed') {
    const rows = everyRow().filter(row => changed(row.item));
    body.innerHTML = rows.length ? rowsByPlace(rows) : '<p class="sw-none lk-none">Everything is as it started</p>';
    return;
  }
  const place = placeOf(state.cur), sections = sectionsAt(place);
  const lonely = sections.length === 1 && place !== 'parts';   // one section under the place's own name needs no second heading
  const head = `<div class="sw-placehead"><h2>${esc(PLACES[place][0])}</h2><p>${esc(PLACES[place][1])}</p></div>`;
  const drawn = sections.map(section => `<section class="sw-section">${lonely ? '' : `<h3>${esc(section.title)}</h3>`}${section.items.map(item => rowHtml({ item, part: section.part, section, place })).join('')}</section>`).join('');
  body.innerHTML = head + (place === 'parts' ? partsHtml() : '') + (drawn || (place === 'parts' ? '' : '<p class="sw-none lk-none">Nothing to set here.</p>'));
  body.scrollTop = at;
}
function drawSide(dlg) {
  const words = state.find.trim().toLowerCase();
  const rows = everyRow();
  dlg.querySelector('.sw-side').innerHTML = GROUPS.map(([group, places]) => `<div class="sw-group">${esc(group)}</div>${places.map(place => {
    const none = words && !rows.some(row => row.place === place && matches(row, words));
    const here = !words && state.view === 'part' && placeOf(state.cur) === place;
    const wait = place === 'parts' && parts().some(waiting);
    return `<div class="sw-mod lk-item${here ? ' on' : ''}${none ? ' sw-nomatch' : ''}" data-place="${place}" aria-current="${here}"><span class="sw-name${wait ? ' lk-pencil' : ''}">${esc(PLACES[place][0])}</span></div>`;
  }).join('')}`).join('') + `<div class="sw-foot">${parts().some(waiting) ? '<button type="button" class="sw-reload lk-lone lk-i-reload" id="sw-reload">Reload to apply</button>' : ''}${anyChanged() || state.view === 'changed' ? `<button type="button" class="sw-word lk-lone${state.view === 'changed' ? ' on' : ''}" id="sw-changed">Changed by you</button>` : ''}<button type="button" class="sw-word lk-lone" id="sw-plain">Logseq’s list</button></div>`;
}
// A redraw replaces what had the keyboard: hand it back, so Escape and the arrows keep working.
function draw() {
  if (!open) return;
  const doc = open.ownerDocument, had = doc.activeElement, id = open.contains(had) ? had.id : '';
  drawSide(open); drawBody(open);
  if (!open.contains(doc.activeElement)) (id && doc.getElementById(id) || open.querySelector('.sw-find')).focus({ preventScroll: true });
}

function reload() {
  const win = host().defaultView;
  try { win.sessionStorage.setItem(REOPEN_KEY, state.cur); } catch (error) { /* it only will not reopen */ }
  close();
  win.setTimeout(() => win.LSPluginCore?.reload(logseq.baseInfo?.id), 0);
}
function onChange(event) {
  const el = event.target;
  if (el.dataset.run) {
    logseq.updateSettings({ [el.dataset.run + 'On']: !!el.checked });
    return later();
  }
  const add = el.dataset.add;
  if (add) return addWord(el);
  const row = el.dataset.key && byKey(el.dataset.key); if (!row) return;
  const { item } = row;
  write(item, item.type === 'boolean' ? !!el.checked : item.type === 'number' ? (el.value === '' ? item.default : Number(el.value)) : item.keys ? keySpelling(el.value) : el.value);
  later();
}
// logseq.settings takes the new value a moment after the write: draw from it then.
const later = () => { host().defaultView.setTimeout(draw, 60); };
function addWord(input) {
  const { item } = byKey(input.dataset.add), word = input.value.trim();
  if (!word) return;
  const words = listWords(item, read(item));
  if (!words.some(w => w.toLowerCase() === word.toLowerCase())) write(item, [...words, word].join('; '));
  input.value = '';
  later();
}
function onClick(dlg, event) {
  const t = event.target;
  if (t === dlg) return close();   // a click on the backdrop
  if (t.closest('.sw-close')) return close();
  if (t.id === 'sw-reload') return reload();
  if (t.id === 'sw-plain') { close(); return logseq.showSettingsUI(); }
  if (t.id === 'sw-changed') { state.view = state.view === 'changed' ? 'part' : 'changed'; state.find = ''; dlg.querySelector('.sw-find').value = ''; return draw(); }
  if (t.dataset.run) return undefined;
  const choice = t.closest('.sw-choice'); if (choice) { write(byKey(choice.dataset.key).item, choice.dataset.choice); return later(); }
  const look = t.closest('.sw-opt'); if (look) { event.preventDefault(); write(byKey(look.dataset.pick).item, JSON.parse(look.dataset.val)); return later(); }
  const reset = t.closest('.sw-default'); if (reset) { event.preventDefault(); const { item } = byKey(reset.dataset.reset); write(item, item.default); return later(); }
  const drop = t.closest('.sw-drop'); if (drop) { const { item } = byKey(drop.dataset.key); write(item, listWords(item, read(item)).filter(word => word !== drop.dataset.word).join('; ')); return later(); }
  const action = t.closest('[data-action]'); if (action) { const { item } = byKey(action.dataset.action); close(); return item.run(); }
  const mod = t.closest('.sw-mod'); if (mod) { state.cur = mod.dataset.place; state.view = 'part'; state.find = ''; dlg.querySelector('.sw-find').value = ''; dlg.querySelector('.sw-body').scrollTop = 0; draw(); }
  return undefined;
}
// While the window is open Escape is the window's: it is taken before Logseq sees it, which would otherwise close its own
// Plugins panel behind the window. It lets go one step at a time: the words in the find line, then the window.
let offEscape = null;   // what takes the Escape listener off Logseq's window again
function onEscape(event) {
  if (event.key !== 'Escape' || !open) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (state.find) { state.find = ''; open.querySelector('.sw-find').value = ''; draw(); } else close();
}
// A letter typed anywhere finds; the arrows walk the six.
function onKey(dlg, event) {
  const t = event.target, find = dlg.querySelector('.sw-find');
  const typing = t.matches('input[type=text], input[type=number], textarea, input:not([type])') && !(t === find && !find.value);
  if (event.key === 'Escape') return;   // onEscape has it
  event.stopPropagation();   // a key combination typed here must not fire Logseq's shortcut
  if (t.dataset?.add && event.key === 'Enter') { event.preventDefault(); return void addWord(t); }
  if (typing) return;
  if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey && t !== find) { find.focus(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const list = GROUPS.flatMap(([, places]) => places), at = Math.max(0, list.indexOf(placeOf(state.cur))), step = event.key === 'ArrowDown' ? 1 : -1;
    state.cur = list[(at + step + list.length) % list.length]; state.view = 'part'; dlg.querySelector('.sw-body').scrollTop = 0; draw();
  }
}
async function loadNames() {
  for (const row of everyRow()) {
    const offer = row.item.list?.offer; if (!offer) continue;
    try { names[row.item.key] = await offer(); } catch (error) { names[row.item.key] = []; }
  }
  draw();
}
function openWindow(partKey) {
  const doc = host();
  close();
  // The stylesheet is written afresh on every opening: a reload of the plugin leaves the old one in Logseq's head.
  Door.root.sheet('sw-style', CSS, '', doc);
  if (partKey) { state.cur = placeOf(partKey); state.view = 'part'; }
  state.find = '';
  const dlg = doc.createElement('dialog');
  dlg.className = 'sw-dialog lk-window';
  dlg.innerHTML = `<div class="sw-head"><b>Plugin settings</b><input class="sw-find lk-field" type="text" id="sw-find" placeholder="find a setting" aria-label="Find a setting" spellcheck="false" autocomplete="off"><button type="button" class="sw-close lk-close" aria-label="Close" title="Close (Esc)">×</button></div><nav class="sw-side" aria-label="Where in Logseq"></nav><div class="sw-body"></div>`;
  dlg.querySelector('.sw-find').addEventListener('input', event => { state.find = event.target.value; draw(); });
  dlg.addEventListener('change', onChange);
  dlg.addEventListener('click', event => onClick(dlg, event));
  dlg.addEventListener('keydown', event => onKey(dlg, event));
  dlg.addEventListener('close', () => { if (open === dlg) open = null; dlg.remove(); offEscape?.(); offEscape = null; });
  offEscape?.(); offEscape = Door.root.listen(doc.defaultView, 'keydown', onEscape, true);
  doc.body.appendChild(dlg);
  open = dlg;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  drawSide(dlg); drawBody(dlg);
  dlg.querySelector('.sw-find').focus({ preventScroll: true });
  loadNames();
  return dlg;
}
function close() {
  if (!open) return;
  const dlg = open;
  open = null;
  offEscape?.(); offEscape = null;
  try { dlg.close(); } catch (error) { /* not open */ }
  dlg.remove();
}
function stop() { close(); try { host().getElementById('sw-style')?.remove(); } catch (error) { /* Logseq's window is gone */ } }
Door.settings = { open: openWindow, close, stop, keyWords, keySpelling, REOPEN_KEY, get current() { return open; } };
})();
