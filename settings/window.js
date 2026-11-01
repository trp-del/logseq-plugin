/* The one settings window, for the whole plugin. One real dialog (the browser's) in Logseq's own window, in the grammar's
   look. Down the left the six parts, each with a tick for whether it runs; on the right the part's settings, each drawn as
   the thing itself (the part gives a specimen per setting), with its switch in the margin and its name; no paragraphs.
   A letter typed anywhere finds, through every part. A part describes its settings at the door (PluginDoor.describe), and
   nothing here knows what any of them does, so the window keeps working whichever parts are switched off. Every change
   applies at once through the plugin's own settings; a part switched on or off waits, pencilled, for the reload. */
(function () {
const Door = window.PluginDoor;
const ORDER = ['look', 'find', 'threads', 'predictive', 'structure', 'export'];
const REOPEN_KEY = 'logseq-plugin-settings-reopen';
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const host = () => window.parent.document;
const CSS = `.sw-dialog { --sw-quiet: var(--lk-quiet); --sw-faint: var(--lk-faint); --sw-hair: var(--lk-hair); --sw-line: var(--lk-line); --sw-wash: var(--lk-wash);
  position: fixed !important; top: 50% !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; margin: 0 !important; width: min(860px, 92vw); height: min(700px, 88vh); max-height: 88vh; overflow: hidden; box-sizing: border-box; padding: 0; border: 1px solid var(--sw-hair); border-radius: 8px;
  background: var(--lk-paper, #fff); color: var(--lk-text, #222); font-size: 14px; line-height: 1.5;
  box-shadow: 0 10px 30px rgba(0,0,0,.14); }
.sw-dialog::backdrop { background: rgba(0,0,0,.18); }
.sw-dialog[open] { display: grid; grid-template-columns: 204px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); pointer-events: auto; }
.sw-head { grid-column: 1 / -1; display: grid; grid-template-columns: 204px minmax(0, 1fr) auto; align-items: center; padding: 14px 16px 10px 22px; }
.sw-head b { font-size: 16px; font-weight: 600; }
.sw-find { border: 0; border-bottom: 1px solid transparent; background: none; color: inherit; font: inherit; padding: 2px 0; outline: none; box-shadow: none; width: 100%; max-width: calc(100% - 22px); }
.sw-find::placeholder { color: var(--sw-faint); opacity: 1; }
.sw-find:focus { border-bottom-color: var(--sw-line); outline: none; box-shadow: none; }
.sw-close { all: unset; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 6px; }
.sw-side { display: flex; flex-direction: column; padding: 8px 12px 16px 14px; min-height: 0; overflow: auto; }
.sw-mod { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; padding: 5px 8px; border-radius: 4px; cursor: pointer; }
.sw-mod:hover { background: var(--sw-wash); }
.sw-mod[aria-current="true"] { background: var(--sw-wash); font-weight: 500; }
.sw-mod.off .sw-name { color: var(--sw-faint); }
.sw-mod .lk-pencil { font-style: italic; }
.sw-nomatch { opacity: .4; }
.sw-foot { margin-top: auto; padding: 16px 8px 0; display: grid; gap: 2px; justify-items: start; }
.sw-word.on { font-weight: 500; }
.sw-body { min-height: 0; overflow: auto; padding: 0 22px 22px; scrollbar-gutter: stable; }
.sw-resting .sw-row, .sw-resting h3 { opacity: .5; }
.sw-none { color: var(--sw-quiet); padding-top: 18px; margin: 0; }
.sw-part { font-weight: 600; font-size: 16px; padding-top: 18px; }
.sw-part:first-child { padding-top: 8px; }
.sw-do { justify-self: start; margin-top: -3px; margin-bottom: -3px; }
.sw-css { width: 100%; min-height: 5.5em; box-sizing: border-box; font: 13px/1.5 var(--lk-mono, monospace); border: 1px solid var(--sw-hair); border-radius: 4px; padding: 6px 8px; background: none; color: inherit; resize: vertical; outline: none; box-shadow: none; }
.sw-css:focus { border-color: var(--sw-line); outline: none; box-shadow: none; }
.sw-list { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.sw-word-x { color: inherit; }
.sw-drop { margin-left: 1px; }
.sw-add { flex: 1; min-width: 12em; }
.sw-section { padding-top: 14px; }
.sw-section + .sw-section { margin-top: 22px; }
.sw-section h3 { font-size: 14px; font-weight: 600; margin: 0; }
.sw-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 2px 8px; align-items: baseline; padding: 9px 0; }
.sw-row .sw-title { font-weight: 500; }
.sw-row .sw-value { grid-column: 2; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
/* The specimen: the thing drawn as it will look, at the page's size, under its name. */
.sw-spec { grid-column: 2; margin-top: 3px; font-size: 15px; line-height: 1.6; color: var(--lk-text, #222); }
.sw-spec .sw-off { color: var(--sw-faint); }
.sw-spec .sw-blue { color: var(--ls-link-text-color, #3b6fc9) !important; text-decoration: none !important; }
.sw-spec .sw-chip { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 4px; padding: 0 6px; }
.sw-spec .sw-cap { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 10px; padding: 0 8px; }
/* A page's name in a specimen: heavier than the words, not larger (the switch is what matters here); the mark beside it
   scales with it, as it does beside the title. */
.sw-spec .sw-big { font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.sw-spec .sw-big .lk-page-mark { position: static; width: 1em; height: 1em; }
.sw-spec .sw-big .lk-page-mark svg { width: .6em; height: .6em; }
.sw-spec .sw-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; margin: 0 8px 2px 0; }
.sw-spec .sw-ring { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: color-mix(in srgb, currentColor 11%, transparent); align-items: center; justify-content: center; margin-right: 6px; vertical-align: -3px; }
.sw-spec .sw-k { color: var(--sw-quiet); }
.sw-spec .sw-pill { display: inline-flex; gap: .4em; }
.sw-spec .sw-line { display: flex; align-items: baseline; gap: 10px; }
.sw-spec .sw-faintw { color: var(--sw-faint); }
.sw-spec .sw-grey { opacity: .45; }
.sw-spec .sw-sep { color: var(--sw-faint); margin: 0 6px; }
.sw-tick { appearance: none !important; -webkit-appearance: none !important; width: 13px !important; height: 13px !important; margin: 0 !important; align-self: center; border: 1px solid var(--sw-line) !important; border-radius: 3px !important; background: none !important; box-shadow: none !important; color: inherit !important; cursor: pointer; position: relative; }
.sw-tick:checked { background: none !important; border-color: var(--sw-line) !important; }
.sw-tick:checked::after { content: ''; position: absolute; left: 3.5px; top: 0.5px; width: 4px; height: 7px; border-right: 1.5px solid var(--lk-text, #222); border-bottom: 1.5px solid var(--lk-text, #222); transform: rotate(45deg); }
.sw-tick:focus-visible { outline: 1px solid var(--sw-line); outline-offset: 2px; }
.sw-field { border: 0; border-bottom: 1px solid var(--sw-line); background: none; color: inherit; font: inherit; padding: 1px 2px; min-width: 6em; outline: none; }
.sw-field:focus { border-bottom-color: currentColor; }
.sw-field.sw-wide { width: min(100%, 36em); }
.sw-choices { display: flex; gap: 14px; flex-wrap: wrap; }
.sw-choice { all: unset; cursor: pointer; color: var(--sw-faint); }
.sw-choice:hover { color: inherit; }
.sw-choice[aria-pressed="true"] { color: inherit; font-weight: 500; }
/* It stands beside a title and must not take the title's weight, or make the row taller when it comes. */
.sw-row .sw-default { font-weight: 400; margin-top: -3px; margin-bottom: -3px; }
.sw-row:hover { background: var(--sw-wash); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 4px; }`;

const state = { cur: 'look', view: 'part', find: '' };
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

// A part's rows as sections: a heading opens one, the rows under it follow.
function sectionsOf(part) {
  const sections = [];
  let current = null;
  for (const item of Door.described[part.key].schema || []) {
    if (item.type === 'heading') { current = { title: item.title, items: [] }; sections.push(current); continue; }
    if (!current) { current = { title: part.title, items: [] }; sections.push(current); }
    current.items.push(item);
  }
  return sections;
}
const everyRow = () => parts().flatMap(part => sectionsOf(part).flatMap(section => section.items.map(item => ({ part, section, item }))));
const byKey = key => everyRow().find(row => row.item.key === key);
const matches = (row, words) => `${row.item.title} ${row.item.description || ''} ${row.section.title} ${row.part.title}`.toLowerCase().includes(words);
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
  const { specimen } = Door.described[part.key];
  if (item.type === 'action') return `<div class="sw-row"><span></span><button type="button" class="sw-do lk-lone" data-action="${esc(item.key)}">${esc(item.title)}</button></div>`;
  const value = read(item), key = esc(item.key), about = esc(item.description || '');
  const reset = changed(item) ? `<button type="button" class="sw-default lk-lone" data-reset="${key}" title="Back to the default">default</button>` : '';
  const spec = specimen ? specimen(item, value) : '';
  const drawn = spec ? `<div class="sw-spec" title="${about}">${spec}</div>` : '';
  if (item.type === 'boolean') return `<label class="sw-row"><input type="checkbox" class="sw-tick" id="sw-${key}" data-key="${key}"${value ? ' checked' : ''}><span class="sw-title" title="${about}">${esc(item.title)} ${reset}</span>${drawn}</label>`;
  if (item.type === 'enum') return `<div class="sw-row"><span></span><span class="sw-title" title="${about}">${esc(item.title)}</span><span class="sw-value sw-choices lk-alts">${(item.enumChoices || []).map(choice => `<button type="button" class="sw-choice lk-value${String(choice) === String(value) ? ' on' : ' off'}" data-key="${key}" data-choice="${esc(choice)}" aria-pressed="${String(choice) === String(value)}">${esc(choice)}</button>`).join('')}${reset}</span>${drawn}</div>`;
  if (item.list) return `<div class="sw-row"><span></span><span class="sw-title" title="${about}">${esc(item.title)}</span><span class="sw-value">${listHtml(item, value)}</span></div>`;
  if (item.inputAs === 'textarea') return `<div class="sw-row"><span></span><label class="sw-title" for="sw-${key}" title="${about}">${esc(item.title)}</label><span class="sw-value"><textarea class="sw-css" id="sw-${key}" data-key="${key}" spellcheck="false" placeholder="${esc(item.placeholder || '')}">${esc(value)}</textarea></span></div>`;
  const number = item.type === 'number';
  return `<div class="sw-row"><span></span><label class="sw-title" for="sw-${key}" title="${about}">${esc(item.title)}</label><span class="sw-value"><input type="${number ? 'number' : 'text'}" class="sw-field${number ? '' : ' sw-wide'}" id="sw-${key}" data-key="${key}" value="${esc(value)}" spellcheck="false" autocomplete="off">${reset}</span>${drawn}</div>`;
}
const rowsByPart = rows => parts().filter(part => rows.some(row => row.part === part)).map(part => `<div class="sw-part">${esc(part.title)}</div>${rows.filter(row => row.part === part).map(rowHtml).join('')}`).join('');

function drawBody(dlg) {
  const body = dlg.querySelector('.sw-body'), at = body.scrollTop;
  const words = state.find.trim().toLowerCase();
  body.classList.remove('sw-resting');
  if (words) {
    const rows = everyRow().filter(row => matches(row, words));
    body.innerHTML = rows.length ? rowsByPart(rows) : '<p class="sw-none">Nothing by that name.</p>';
    return;
  }
  if (state.view === 'changed') {
    const rows = everyRow().filter(row => changed(row.item));
    body.innerHTML = rows.length ? rowsByPart(rows) : '<p class="sw-none">Everything is as it started.</p>';
    return;
  }
  const part = parts().find(p => p.key === state.cur) || parts()[0];
  body.classList.toggle('sw-resting', !wanted(part));
  const none = Door.described[part.key].none;
  body.innerHTML = none ? `<p class="sw-none">${esc(none)}</p>` : sectionsOf(part).map(section => `<section class="sw-section"><h3>${esc(section.title)}</h3>${section.items.map(item => rowHtml({ item, part, section })).join('')}</section>`).join('');
  body.scrollTop = at;
}
function drawSide(dlg) {
  const words = state.find.trim().toLowerCase();
  const rows = els => parts().map(part => els(part)).join('');
  dlg.querySelector('.sw-side').innerHTML = rows(part => {
    const none = words && !everyRow().some(row => row.part === part && matches(row, words));
    const here = !words && state.view === 'part' && state.cur === part.key;
    return `<div class="sw-mod${wanted(part) ? '' : ' off'}${none ? ' sw-nomatch' : ''}" data-part="${part.key}" aria-current="${here}"><input type="checkbox" class="sw-tick" id="sw-run-${part.key}" data-run="${part.key}"${wanted(part) ? ' checked' : ''} aria-label="${esc(part.title)} runs"><span class="sw-name${waiting(part) ? ' lk-pencil' : ''}">${esc(part.title)}</span></div>`;
  }) + `<div class="sw-foot">${parts().some(waiting) ? '<button type="button" class="sw-reload lk-lone" id="sw-reload">Reload to apply</button>' : ''}${anyChanged() || state.view === 'changed' ? `<button type="button" class="sw-word lk-lone${state.view === 'changed' ? ' on' : ''}" id="sw-changed">Changed by you</button>` : ''}<button type="button" class="sw-word lk-lone" id="sw-plain">Logseq’s list</button></div>`;
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
  write(item, item.type === 'boolean' ? !!el.checked : item.type === 'number' ? (el.value === '' ? item.default : Number(el.value)) : el.value);
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
  const reset = t.closest('.sw-default'); if (reset) { event.preventDefault(); const { item } = byKey(reset.dataset.reset); write(item, item.default); return later(); }
  const drop = t.closest('.sw-drop'); if (drop) { const { item } = byKey(drop.dataset.key); write(item, listWords(item, read(item)).filter(word => word !== drop.dataset.word).join('; ')); return later(); }
  const action = t.closest('[data-action]'); if (action) { const { item } = byKey(action.dataset.action); close(); return item.run(); }
  const mod = t.closest('.sw-mod'); if (mod) { state.cur = mod.dataset.part; state.view = 'part'; state.find = ''; dlg.querySelector('.sw-find').value = ''; dlg.querySelector('.sw-body').scrollTop = 0; draw(); }
  return undefined;
}
// While the window is open Escape is the window's: it is taken before Logseq sees it, which would otherwise close its own
// Plugins panel behind the window. It lets go one step at a time: the words in the find line, then the window.
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
    const list = parts(), at = list.findIndex(part => part.key === state.cur), step = event.key === 'ArrowDown' ? 1 : -1;
    state.cur = list[(at + step + list.length) % list.length].key; state.view = 'part'; dlg.querySelector('.sw-body').scrollTop = 0; draw();
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
  let sheet = doc.getElementById('sw-style');
  if (!sheet) { sheet = doc.createElement('style'); sheet.id = 'sw-style'; doc.head.appendChild(sheet); }
  if (sheet.textContent !== CSS) sheet.textContent = CSS;
  if (partKey) { state.cur = partKey; state.view = 'part'; }
  state.find = '';
  const dlg = doc.createElement('dialog');
  dlg.className = 'sw-dialog';
  dlg.innerHTML = `<div class="sw-head"><b>Plugin settings</b><input class="sw-find" type="text" id="sw-find" placeholder="find a setting" aria-label="Find a setting" spellcheck="false" autocomplete="off"><button type="button" class="sw-close lk-close" aria-label="Close" title="Close (Esc)">×</button></div><nav class="sw-side" aria-label="The six parts"></nav><div class="sw-body"></div>`;
  dlg.querySelector('.sw-find').addEventListener('input', event => { state.find = event.target.value; draw(); });
  dlg.addEventListener('change', onChange);
  dlg.addEventListener('click', event => onClick(dlg, event));
  dlg.addEventListener('keydown', event => onKey(dlg, event));
  dlg.addEventListener('close', () => { if (open === dlg) open = null; dlg.remove(); doc.defaultView.removeEventListener('keydown', onEscape, true); });
  doc.defaultView.addEventListener('keydown', onEscape, true);
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
  dlg.ownerDocument.defaultView.removeEventListener('keydown', onEscape, true);
  try { dlg.close(); } catch (error) { /* not open */ }
  dlg.remove();
}
function stop() { close(); try { host().getElementById('sw-style')?.remove(); } catch (error) { /* Logseq's window is gone */ } }
Door.settings = { open: openWindow, close, stop, REOPEN_KEY, get current() { return open; } };
})();
