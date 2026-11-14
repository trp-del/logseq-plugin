/* The one settings window, for the whole plugin. One real dialog (the browser's) in Logseq's own window, in the grammar's
   look, in three columns (the owner, 12 November 2026: "make it explicitly clear visually what will happen"):
   - down the left the places where you meet things (what you see, what you do, everything else), not the six parts;
   - in the middle the place's settings, one line each, with what each is set to at its right end (a dot before it when you
     changed it), so the list reads as a summary of how the plugin is set;
   - on the right the setting in the middle that is chosen, large: its name, one plain line, then every choice as a picture of
     the thing itself, side by side, each named under it. The one in force has a firmer edge and the library's check mark (lk-check); the one the plugin came
     with says "as it came". In each picture only what differs from the other choice keeps its full strength; the rest steps
     back (worked out here by comparing the pictures, so a part draws only its pictures). A press on a picture takes it.
   A number shows a picture at each of a few sizes and takes another typed; keys show what pressing them does and record the
   next keys pressed; a list shows its words with a × each; CSS changes the picture as you type.
   A part says at the door (PluginDoor.describe) which place each of its sections belongs to, its pictures (specimen) and the
   names of its choices (an item's `looks`), and nothing here knows what any of them does, so the window keeps working
   whichever parts are switched off. A letter typed anywhere finds, through every place. Every change applies at once through
   the plugin's own settings; a part switched on or off, under Parts, waits for the reload. */
(function () {
const Door = window.PluginDoor;
const ORDER = ['look', 'find', 'threads', 'predictive', 'structure', 'export'];
const GROUPS = [['What you see', ['window', 'page', 'sidebar']], ['What you do', ['writing', 'finding', 'following', 'out']], ['Everything else', ['keys', 'parts']]];
const PLACES = {
  window: ['The window', 'How Logseq’s own screens look: type, sidebar, tables, search and menus.'],
  page: ['A page', 'How links, tags, properties and bullets read on a page.'],
  sidebar: ['The right sidebar', 'The panel on the right: its bar, its pages, its links and endnotes.'],
  writing: ['Writing', 'What the plugin offers while you type.'],
  finding: ['Finding', 'The search window.'],
  following: ['Following links', 'What a ⌘-click on a link does, and the rows under a page that show everything pointing at it.'],
  out: ['Taking a page out', 'The PDF, Markdown and rich-text export.'],
  keys: ['Keys', 'Every keyboard shortcut, in one list.'],
  parts: ['Parts', 'Switch a part off, and find a fault.'],
};
const HOME = { plugin: 'following', look: 'window', find: 'finding', threads: 'following', predictive: 'writing', export: 'out', structure: 'parts', todo: 'parts' };   // where a part's own name leads
const placeOf = key => PLACES[key] ? key : HOME[key] || 'window';
const REOPEN_KEY = 'logseq-plugin-settings-reopen';
const { esc, host } = window.PluginDoor;
const STYLE = `.sw-dialog { position: fixed !important; top: 50% !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; margin: 0 !important; width: min(1360px, 94vw); height: 90vh; max-height: 90vh; overflow: hidden; box-sizing: border-box; padding: 0; }   /* the window's look is the library's lk-window */
.sw-dialog[open] { display: grid; grid-template-columns: var(--sw-cols); grid-template-rows: auto minmax(0, 1fr); pointer-events: auto; }
/* The three columns give way together in a narrow Logseq window, the pictures' column keeping the most. */
.sw-dialog { --sw-cols: clamp(132px, 15%, 188px) clamp(190px, 26%, 320px) minmax(0, 1fr); }
.sw-head { grid-column: 1 / -1; display: grid; grid-template-columns: clamp(110px, 15%, 166px) minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px 16px 12px 22px; border-bottom: 1px solid var(--lk-hair); }
.sw-head b { font-size: 16px; font-weight: 600; }
.sw-find { width: 100%; max-width: 300px; }   /* the library's field (lk-field) */
.sw-close { all: unset; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 6px; }
/* The places: lines of the library's menu (lk-item), the one open lit (on). */
.sw-side { display: flex; flex-direction: column; padding: 8px 12px 16px 14px; min-height: 0; overflow: auto; }
.sw-group { font-size: var(--lk-label); color: var(--lk-quiet); padding: 18px 8px 4px; }
.sw-group:first-child { padding-top: 4px; }
.sw-mod { padding: 5px 8px; white-space: normal !important; word-break: normal; overflow-wrap: normal; }
.sw-mod.on { font-weight: 500; }
.sw-mod .sw-count { color: var(--lk-quiet); font-weight: 400; }
.sw-nomatch { opacity: .4; }
.sw-foot { margin-top: auto; padding-top: 16px; display: grid; gap: 2px; }
.sw-foot .sw-reload { justify-self: start; margin-bottom: 8px !important; }
/* The settings, one line each: a line of the library's menu (lk-item), its name at the left, its value at the right. */
.sw-list { min-height: 0; overflow: auto; padding: 6px 10px 16px; border-left: 1px solid var(--lk-hair); border-right: 1px solid var(--lk-hair); }
.sw-sec { font-size: var(--lk-label); color: var(--lk-quiet); padding: 14px 8px 4px; }
.sw-sec:first-child { padding-top: 6px; }
.sw-row { padding: 6px 8px; align-items: baseline; white-space: normal !important; }   /* a long name takes a second line rather than being cut */
.sw-row { flex-wrap: wrap; column-gap: 12px; row-gap: 0; }
.sw-row .sw-name { min-width: 0; word-break: normal; overflow-wrap: normal; hyphens: manual; }
.sw-row.on .sw-name { font-weight: 500; }
.sw-row .sw-now { color: var(--lk-quiet); font-size: var(--lk-small); margin-left: auto; text-align: right; }   /* in a narrow window it drops under the name, at the right */
.sw-row .sw-now.sw-moved { color: var(--lk-text); }
.sw-row .sw-now.sw-moved::before { content: "•"; margin-right: 5px; }
.sw-row.sw-rest { opacity: .5; }
.sw-none { padding: 18px 8px; margin: 0; }
/* The chosen setting, large. Spacing: 8 inside a group, 20 between groups. */
.sw-body { min-height: 0; overflow: auto; padding: 20px clamp(14px, 2.5vw, 28px) 28px; scrollbar-gutter: stable; }
.sw-body h2 { font-size: 20px; font-weight: 600; margin: 0 0 4px; letter-spacing: -.01em; }
.sw-what { margin: 0 0 20px; color: var(--lk-quiet); max-width: 64ch; }
.sw-looks { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px 18px; }
.sw-opt { all: unset; box-sizing: border-box; display: grid; align-content: start; gap: 10px; min-width: 0; cursor: pointer; }   /* the library's choice (lk-value) */
.sw-opt.sw-still { cursor: default; }
/* A picture: a slice of a page at the page's size, in the page's colours. */
.sw-pic { box-sizing: border-box; border: 1px solid var(--lk-hair); border-radius: 8px; padding: 14px 16px; min-height: 92px; overflow: hidden; font-size: 15px; line-height: 1.6; color: var(--lk-text); background: var(--lk-paper); transition: border-color .12s; }
.sw-opt:not(.sw-still):hover .sw-pic, .sw-opt:focus-visible .sw-pic { border-color: var(--lk-line); }
.sw-opt:focus-visible { outline: none; }
.sw-opt.on .sw-pic { border: 2px solid var(--lk-text); padding: 13px 15px; }
.sw-lab { display: flex; gap: 8px; align-items: baseline; padding-left: 2px; color: var(--lk-quiet); }
.sw-lab .sw-tick { width: 1em; visibility: hidden; color: var(--lk-text); }
.sw-opt.on .sw-lab .sw-tick { visibility: visible; }
.sw-opt.on .sw-lab .sw-nm { color: var(--lk-text); font-weight: 600; }
.sw-lab .sw-came { font-size: var(--lk-small); }
/* Only what differs keeps its strength: the rest of a picture steps back. No colour and no line. */
.sw-pic.sw-marked { color: var(--lk-off); }
.sw-pic.sw-marked :has(.sw-mark) > :not(:has(.sw-mark)):not(.sw-mark) { opacity: .45; }
.sw-pic .sw-mark { color: var(--lk-text); }
.sw-more { margin-top: 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; color: var(--lk-quiet); }
.sw-field { min-width: 6em; }   /* the Pressing set's field (input.lk-value): a hairline only while it has the keyboard */
.sw-field.sw-wide { width: min(100%, 30em); }
.sw-words { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; color: var(--lk-text); }
.sw-drop { margin-left: 1px; }
.sw-css { width: 100%; max-width: 46em; min-height: 6em; box-sizing: border-box; font: 13px/1.5 var(--lk-mono, monospace); border: 1px solid var(--lk-hair); border-radius: 6px; padding: 8px; background: none; color: inherit; resize: vertical; outline: none; }
.sw-css:focus { border-color: var(--lk-line); outline: none !important; box-shadow: none !important; }
.sw-recording { color: var(--lk-text); }
/* What a picture draws with: a part's specimens use these, at the page's size. */
.sw-pic .sw-blue { color: var(--ls-link-text-color, #3b6fc9) !important; text-decoration: none !important; }
.sw-pic .sw-chip { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 4px; padding: 0 6px; }
.sw-pic .sw-cap { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 10px; padding: 0 8px; }
.sw-pic .sw-big { font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.sw-pic .sw-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; margin: 0 8px 2px 0; }
.sw-pic .sw-ring { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: color-mix(in srgb, currentColor 11%, transparent); align-items: center; justify-content: center; margin-right: 6px; vertical-align: -3px; }
.sw-pic .sw-k { color: var(--lk-quiet); }
.sw-key { display: inline-block; min-width: 1.4em; text-align: center; font-size: var(--lk-label); line-height: 1.5; padding: 0 6px; margin: 0 2px 0 0; border: 1px solid var(--lk-line); border-bottom-width: 2px; border-radius: 5px; color: var(--lk-text); }
.sw-pic .sw-then { display: block; margin: 6px 0 6px 14px; color: var(--lk-quiet); font-size: var(--lk-small); }
.sw-pic .sw-caret { display: inline-block; width: 1.5px; height: 1.05em; background: currentColor; vertical-align: -2px; margin: 0 1px; }
.sw-pic .sw-pill { display: inline-flex; gap: .4em; }
.sw-pic .sw-line { display: flex; align-items: baseline; gap: 10px; }
.sw-pic .sw-faintw { color: var(--lk-quiet); }
.sw-pic .sw-grey { opacity: .45; }
.sw-pic .sw-sep { color: var(--lk-quiet); margin: 0 6px; } .sw-pic .sw-gap { display: inline-block; width: 18px; }`;

const state = { cur: 'window', sel: null, view: 'place', find: '', recording: false };
let open = null;
let names = {};   // what a list offers as you type, by the setting's key

const parts = () => ORDER.map(key => Door.modules.find(module => module.key === key)).filter(module => module && Door.described[module.key]);
// What stands whichever parts run (two pages side by side) says its rows at the door under 'plugin': rows with no switch of their own.
const standing = () => Door.described.plugin ? [{ key: 'plugin', title: 'Logseq Plugin' }] : [];
const switchKey = part => part.key + 'On';
const wanted = part => logseq.settings?.[switchKey(part)] !== false;
const started = part => (Door.started || []).includes(part);
const waiting = part => wanted(part) !== started(part);
const read = item => { const value = logseq.settings?.[item.key]; return typeof value === typeof item.default ? value : item.default; };
const changed = item => JSON.stringify(read(item)) !== JSON.stringify(item.default);
const write = (item, value) => logseq.updateSettings({ [item.key]: value });
/* A key is shown as plain words and recorded from the keys pressed; it is kept in Logseq's spelling ("mod+alt+enter"), mod
   being Cmd on a Mac and Ctrl elsewhere. */
const MAC = Door.keys.mac;
const SPELLED = { cmd: 'mod', command: 'mod', meta: 'mod', option: 'alt', opt: 'alt', control: MAC ? 'ctrl' : 'mod', ctrl: MAC ? 'ctrl' : 'mod' };
// A key in plain words, and the keys pressed as a setting spells them: the door's, one way for the whole plugin.
const keyWords = keys => Door.keyWords(keys);
const keySpelling = words => String(words || '').toLowerCase().split(/[\s+]+/).filter(Boolean).map(word => SPELLED[word] || word).join('+');
const pressed = event => Door.keys.pressed(event);

/* A part's rows, as sections: a heading opens one, the rows under it follow. An action stands under the setting before it
   (Measure under Apple's tools, Open troubleshooting under Run only the base). Under Parts, a switch for each part. */
function sectionsOf(part) {
  const described = Door.described[part.key], sections = [];
  let current = null, last = null;
  for (const item of described.schema || []) {
    if (item.type === 'heading') { current = { title: item.title, place: placeOf(item.place || described.place || part.key), part, items: [] }; sections.push(current); last = null; continue; }
    if (!current) { current = { title: part.title, place: placeOf(described.place || part.key), part, items: [] }; sections.push(current); }
    if (item.type === 'action' && last) { (last.acts ||= []).push(item); continue; }
    const row = { ...item, part };
    current.items.push(row); last = row;
  }
  return sections;
}
const switchRows = () => parts().map(part => ({ key: switchKey(part), type: 'boolean', default: true, title: part.title, description: part.about || '', part, isSwitch: true, looks: ['Off', 'On'] }));
function allSections() {
  const list = [...parts(), ...standing()].flatMap(sectionsOf);
  return [...list.filter(s => s.place !== 'parts'), { title: 'Switch on or off', place: 'parts', items: switchRows() }, ...list.filter(s => s.place === 'parts')];
}
const everyRow = () => allSections().flatMap(section => section.items.map(item => ({ item, section, place: section.place })));
const byKey = key => everyRow().find(row => row.item.key === key);
const matches = (row, words) => `${row.item.title} ${row.item.description || ''} ${row.section.title} ${PLACES[row.place][0]}`.toLowerCase().includes(words);
// The rows the middle shows: a place's, everything the words find, or what you changed.
function shownRows() {
  const words = state.find.trim().toLowerCase(), rows = everyRow();
  if (words) return rows.filter(row => matches(row, words));
  if (state.view === 'changed') return rows.filter(row => changed(row.item));
  return rows.filter(row => row.place === placeOf(state.cur));
}

// What a setting is set to, in the words its choices are named by.
const listWords = value => String(value ?? '').split(/[;\n]/).map(word => word.trim()).filter(Boolean);
const capital = word => word.charAt(0).toUpperCase() + word.slice(1);
function choices(item) {
  if (item.type === 'boolean') { const [off, on] = item.looks || ['Off', 'On']; return [[false, off], [true, on]]; }
  if (item.type === 'enum') return (item.enumChoices || []).map(choice => [choice, item.looks?.[choice] || capital(String(choice))]);
  if (item.type === 'number' && item.presets) return item.presets.map(n => [n, String(n)]);
  return null;
}
function nowWords(item) {
  const value = read(item), found = choices(item)?.find(([v]) => JSON.stringify(v) === JSON.stringify(value));
  if (found) return found[1];
  if (item.keys) return keyWords(value) || 'none';
  if (item.list) return listWords(value).length ? `${listWords(value).length} set` : 'none';
  if (item.inputAs === 'textarea') return String(value).trim() ? 'your rules' : 'none';
  return String(value ?? '').trim() || 'none';
}
const picture = (row, value) => {
  const { item } = row, described = Door.described[item.part?.key] || {};
  if (!item.isSwitch) return described.specimen?.(item, value) || '';
  // A part's switch: what the part draws (its own picture, said at the door), or what it is for; off, nothing of it.
  return value ? described.picture?.(true) || esc(item.description) : described.picture?.(false) || `<span class="sw-faintw">No ${esc(item.title)}</span>`;
};

function listHtml() {
  const rows = shownRows(), words = state.find.trim();
  if (!rows.length) return `<p class="sw-none lk-none">${words ? 'Nothing by that name' : 'Everything is as it came'}</p>`;
  let last = '';
  return rows.map(row => {
    const head = words || state.view === 'changed' ? `${row.section.title} · ${PLACES[row.place][0]}` : row.section.title;
    const sec = head !== last ? `<div class="sw-sec">${esc(head)}</div>` : ''; last = head;
    const rest = row.item.part && !row.item.isSwitch && !wanted(row.item.part) ? ' sw-rest' : '';
    return sec + `<button type="button" class="sw-row lk-item${row.item.key === state.sel ? ' on' : ''}${rest}" data-row="${esc(row.item.key)}" role="option" aria-selected="${row.item.key === state.sel}"><span class="sw-name">${esc(row.item.title)}</span><span class="sw-now${changed(row.item) ? ' sw-moved' : ''}">${esc(nowWords(row.item))}</span></button>`;
  }).join('');
}
const quote = text => String(text).replace(/["\\]/g, '\\$&');   // a key or a value inside an attribute selector
// The plain line under a setting's name: its description up to the first stop, a semicolon or a colon; the whole of it stays under the pointer.
const firstSentence = text => { const m = String(text || '').match(/^.*?([.!?;:](\s|$))/); const line = (m ? m[0] : String(text || '')).trim().replace(/[;:]$/, '.'); return line.length > 170 ? line.slice(0, 168).replace(/[ ,][^ ,]*$/, '') + '…' : line; };
function paneHtml() {
  const row = byKey(state.sel);
  if (!row) return '';
  const { item } = row, value = read(item), key = esc(item.key);
  const head = `<h2 title="${esc(item.description || '')}">${esc(item.title)}</h2><p class="sw-what">${esc(item.what || firstSentence(item.description))}</p>`;
  const look = (v, name, html, still, plainName) => {
    const on = JSON.stringify(v) === JSON.stringify(value), came = !plainName && JSON.stringify(v) === JSON.stringify(item.default);
    const lab = `<span class="sw-lab"><span class="sw-tick lk-check" aria-hidden="true"></span><span class="sw-nm">${name}</span>${came ? '<span class="sw-came">as it came</span>' : ''}</span>`;
    return still ? `<div class="sw-opt sw-still on"><div class="sw-pic">${html}</div>${lab}</div>`
      : `<button type="button" class="sw-opt lk-value${on ? ' on' : ''}" data-pick="${key}" data-val="${esc(JSON.stringify(v))}" aria-pressed="${on}"><div class="sw-pic">${html || `<span class="sw-faintw">${name}</span>`}</div>${lab}</button>`;
  };
  let body = '';
  const options = choices(item);
  if (options) {
    body = `<div class="sw-looks">${options.map(([v, name]) => look(v, esc(name), picture(row, v))).join('')}</div>`;
    if (item.type === 'number') body += `<div class="sw-more"><label for="sw-${key}">Another number</label><input type="number" class="sw-field lk-value" id="sw-${key}" data-key="${key}" value="${options.some(([v]) => v === value) ? '' : esc(value)}" placeholder="${esc(value)}"></div>`;
  } else if (item.keys) {
    const words = keyWords(value);
    body = `<div class="sw-looks">${look(value, words ? words.split(' ').map(w => `<span class="sw-key">${esc(w)}</span>`).join('') : 'No key', picture(row, value), true)}</div>`
      + `<div class="sw-more"><button type="button" class="lk-btn lk-low${state.recording ? ' sw-recording' : ''}" id="sw-record" data-record="${key}">${state.recording ? 'Press the keys now…' : 'Press new keys'}</button>${value ? `<button type="button" class="lk-btn lk-low" data-set="${key}" data-val='""'>No key</button>` : ''}${value !== item.default ? `<button type="button" class="lk-btn lk-low lk-i-undo" data-set="${key}" data-val="${esc(JSON.stringify(item.default))}">Back to ${esc(keyWords(item.default) || 'no key')}</button>` : ''}</div>`;
  } else if (item.list) {
    const offer = names[item.key]?.length ? `<datalist id="sw-offer-${key}">${names[item.key].map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>` : '';
    const pic = picture(row, value);
    body = (pic ? `<div class="sw-looks">${look(value, listWords(value).length ? 'As you listed' : 'Nothing listed', pic, true, true)}</div>` : '')
      + `<div class="sw-more"><span class="sw-words">${listWords(value).map(word => `<span>${esc(word)}<button type="button" class="sw-drop lk-x" data-key="${key}" data-word="${esc(word)}" aria-label="Take out ${esc(word)}">×</button></span>`).join('')}</span><input class="sw-field lk-value sw-wide" id="sw-${key}" data-add="${key}" placeholder="${esc(item.list.hint || 'add')}, then Return" list="sw-offer-${key}" spellcheck="false" autocomplete="off">${offer}</div>`;
  } else if (item.inputAs === 'textarea') {
    const pic = picture(row, value);
    body = (pic ? `<div class="sw-looks">${look(value, String(value).trim() ? 'With your rules' : 'No rules of your own', pic, true, true)}</div>` : '')
      + `<div class="sw-more" style="display:block"><textarea class="sw-css" id="sw-${key}" data-key="${key}" spellcheck="false" placeholder="${esc(item.placeholder || '')}">${esc(value)}</textarea></div>`;
  } else {
    const pic = picture(row, value);
    body = (pic ? `<div class="sw-looks">${look(value, String(value ?? '').trim() ? 'As you set it' : 'None set', pic, true, true)}</div>` : '')
      + `<div class="sw-more"><input type="${item.type === 'number' ? 'number' : 'text'}" class="sw-field lk-value sw-wide" id="sw-${key}" data-key="${key}" value="${esc(value)}" placeholder="none" spellcheck="false" autocomplete="off"></div>`;
  }
  for (const act of item.acts || []) body += `<div class="sw-more"><button type="button" class="lk-lone lk-i-go" data-action="${esc(act.key)}">${esc(act.title)}</button></div>`;
  if (item.isSwitch && parts().some(waiting)) body += `<div class="sw-more"><span class="lk-pencil">A part switched on or off waits for the reload.</span><button type="button" class="sw-reload lk-lone lk-i-reload" data-reload="1">Reload to apply</button></div>`;
  return head + body;
}
/* In each picture, only what differs from the other choice keeps its strength. Two pictures are walked side by side: where
   their shapes match, deeper; where a piece differs, it is marked. A picture whose whole shape differs is left as it is. */
function differ(a, b) {
  if (a.isEqualNode(b)) return;
  const sameShell = a.nodeType === 1 && b.nodeType === 1 && a.nodeName === b.nodeName && a.attributes.length === b.attributes.length && [...a.attributes].every(at => b.getAttribute(at.name) === at.value);
  if (sameShell && a.childNodes.length) return differIn(a, b);
  if (a.nodeType === 3) { if (a.textContent.trim()) mark(a); return; }
  if (a.nodeType === 1) a.classList.add('sw-mark');
}
// Children walked in order: one found in the other picture is kept, one beside its like is compared deeper, one with none is marked.
function differIn(a, b) {
  const theirs = [...b.childNodes]; let at = 0;
  for (const child of [...a.childNodes]) {
    const found = theirs.findIndex((other, i) => i >= at && other.isEqualNode(child));
    if (found >= 0) { at = found + 1; continue; }
    const like = theirs[at];
    if (like && like.nodeType === child.nodeType && like.nodeName === child.nodeName) { differ(child, like); at++; continue; }
    if (child.nodeType === 3) { if (child.textContent.trim()) mark(child); } else if (child.nodeType === 1) child.classList.add('sw-mark');
  }
}
function mark(text) { const span = text.ownerDocument.createElement('span'); span.className = 'sw-mark'; text.replaceWith(span); span.appendChild(text); }
function markDifferences(body) {
  const pics = [...body.querySelectorAll('.sw-looks .sw-pic')];
  if (pics.length < 2) return;
  const plain = pics.map(pic => pic.cloneNode(true));
  pics.forEach((pic, i) => {
    differIn(pic, plain[i === 0 ? 1 : 0]);
    if (pic.querySelector('.sw-mark')) pic.classList.add('sw-marked');
  });
}
function drawSide(dlg) {
  const words = state.find.trim().toLowerCase(), rows = everyRow(), count = rows.filter(row => changed(row.item)).length;
  dlg.querySelector('.sw-side').innerHTML = GROUPS.map(([group, places]) => `<div class="sw-group">${esc(group)}</div>${places.map(place => {
    const none = words && !rows.some(row => row.place === place && matches(row, words));
    const here = !words && state.view === 'place' && placeOf(state.cur) === place;
    return `<button type="button" class="sw-mod lk-item${here ? ' on' : ''}${none ? ' sw-nomatch' : ''}" data-place="${place}" aria-current="${here}"><span class="sw-name${place === 'parts' && parts().some(waiting) ? ' lk-pencil' : ''}">${esc(PLACES[place][0])}</span></button>`;
  }).join('')}`).join('') + `<div class="sw-foot">${parts().some(waiting) ? '<button type="button" class="sw-reload lk-lone lk-i-reload" data-reload="1">Reload to apply</button>' : ''}${count || state.view === 'changed' ? `<button type="button" class="sw-mod lk-item${state.view === 'changed' && !words ? ' on' : ''}" id="sw-changed"><span>Changed by you</span><span class="sw-count">${count || ''}</span></button>` : ''}<button type="button" class="sw-mod lk-item" id="sw-plain"><span>Logseq’s list</span></button></div>`;
}
function drawList(dlg) {
  const rows = shownRows();
  if (!rows.some(row => row.item.key === state.sel)) state.sel = rows[0]?.item.key || null;
  const list = dlg.querySelector('.sw-list'), at = list.scrollTop;
  list.innerHTML = listHtml();
  list.scrollTop = at;
}
function drawBody(dlg) {
  const body = dlg.querySelector('.sw-body');
  body.innerHTML = paneHtml();
  if (byKey(state.sel)?.item.type !== 'number') markDifferences(body);   // sizes of one thing: each picture is the whole of it
}
// A redraw replaces what had the keyboard: hand it back, so Escape and the arrows keep working.
function draw() {
  if (!open) return;
  const doc = open.ownerDocument, had = doc.activeElement, id = open.contains(had) ? had.id || '' : '', row = had?.dataset?.row, pick = had?.dataset?.val;
  drawSide(open); drawList(open); drawBody(open);
  const back = (id && doc.getElementById(id)) || (row && open.querySelector(`.sw-row[data-row="${quote(row)}"]`)) || (pick && open.querySelector(`.sw-opt[data-val="${quote(pick)}"]`));
  (back || (open.contains(doc.activeElement) ? null : open.querySelector('.sw-find')))?.focus({ preventScroll: true });
}
const choose = key => { state.sel = key; state.recording = false; draw(); open?.querySelector(`.sw-row[data-row="${quote(key)}"]`)?.scrollIntoView?.({ block: 'nearest' }); };
const goPlace = place => { state.cur = place; state.view = 'place'; state.find = ''; state.sel = null; state.recording = false; open.querySelector('.sw-find').value = ''; open.querySelector('.sw-body').scrollTop = 0; draw(); };

function reload() {
  const win = host().defaultView;
  try { win.sessionStorage.setItem(REOPEN_KEY, 'parts'); } catch (error) { /* it only will not reopen */ }
  close();
  win.setTimeout(() => win.LSPluginCore?.reload(logseq.baseInfo?.id), 0);
}
// logseq.settings takes the new value a moment after the write: draw from it then.
const later = () => { host().defaultView.setTimeout(draw, 60); };
function onChange(event) {
  const el = event.target;
  if (el.dataset.add) return addWord(el);
  const row = el.dataset.key && byKey(el.dataset.key); if (!row) return;
  const { item } = row;
  if (item.type === 'number' && el.value === '') return;
  write(item, item.type === 'number' ? Number(el.value) : el.value);
  later();
}
function onInput(event) {
  const el = event.target;
  // The find box works as Find does (the owner, 9 and 12 November 2026): letters light the first setting they leave and show it at the right; Enter goes to it.
  if (el.classList.contains('sw-find')) { state.find = el.value; state.view = 'place'; const first = state.find.trim() ? shownRows()[0] : null; if (first) state.sel = first.item.key; drawSide(open); drawList(open); drawBody(open); return; }
  // CSS changes its picture as it is typed.
  if (el.classList.contains('sw-css')) { const { item } = byKey(el.dataset.key); write(item, el.value); host().defaultView.setTimeout(() => { if (!open) return; const pic = open.querySelector('.sw-body .sw-pic'); const row = byKey(item.key); if (pic) pic.innerHTML = picture(row, el.value); drawList(open); }, 60); }
}
function addWord(input) {
  const { item } = byKey(input.dataset.add), word = input.value.trim();
  if (!word) return;
  const words = listWords(read(item));
  if (!words.some(w => w.toLowerCase() === word.toLowerCase())) write(item, [...words, word].join('; '));
  input.value = '';
  later();
}
function onClick(dlg, event) {
  const t = event.target;
  if (t === dlg) return close();   // a click on the backdrop
  if (t.closest('.sw-close')) return close();
  if (t.closest('[data-reload]')) return reload();
  if (t.closest('#sw-plain')) { close(); return logseq.showSettingsUI(); }
  if (t.closest('#sw-changed')) { state.view = state.view === 'changed' ? 'place' : 'changed'; state.find = ''; state.sel = null; dlg.querySelector('.sw-find').value = ''; return draw(); }
  const place = t.closest('.sw-mod[data-place]'); if (place) return goPlace(place.dataset.place);
  const row = t.closest('.sw-row'); if (row) return choose(row.dataset.row);
  const look = t.closest('.sw-opt[data-pick]'); if (look) { event.preventDefault(); write(byKey(look.dataset.pick).item, JSON.parse(look.dataset.val)); return later(); }
  const set = t.closest('[data-set]'); if (set) { state.recording = false; write(byKey(set.dataset.set).item, JSON.parse(set.dataset.val)); return later(); }
  if (t.closest('#sw-record')) { state.recording = !state.recording; return draw(); }
  const drop = t.closest('.sw-drop'); if (drop) { const { item } = byKey(drop.dataset.key); write(item, listWords(read(item)).filter(word => word !== drop.dataset.word).join('; ')); return later(); }
  const action = t.closest('[data-action]'); if (action) { const act = everyRow().flatMap(r => r.item.acts || []).find(a => a.key === action.dataset.action); close(); return act?.run(); }
  return undefined;
}
// While the window is open Escape is the window's: it is taken before Logseq sees it, which would otherwise close its own
// Plugins panel behind the window. It lets go one step at a time: the keys being recorded, the words in the find line, then the window.
let offEscape = null;   // what takes the Escape listener off Logseq's window again
function onEscape(event) {
  if (event.key !== 'Escape' || !open) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (state.recording) { state.recording = false; draw(); }
  else if (state.find) { state.find = ''; open.querySelector('.sw-find').value = ''; draw(); } else close();
}
// A letter typed anywhere finds; Up and Down walk the settings, Left and Right the pictures, Return takes one (a button's own).
function onKey(dlg, event) {
  const t = event.target, find = dlg.querySelector('.sw-find');
  if (event.key === 'Escape') return;   // onEscape has it
  event.stopPropagation();   // a key combination typed here must not fire Logseq's shortcut
  if (state.recording) {
    if (['Meta', 'Alt', 'Control', 'Shift'].includes(event.key)) return;
    event.preventDefault(); state.recording = false;
    write(byKey(state.sel).item, pressed(event)); return void later();
  }
  if (t.dataset?.add && event.key === 'Enter') { event.preventDefault(); return void addWord(t); }
  if (t === find && event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const first = state.find.trim() ? shownRows().find(row => row.item.key === state.sel) || shownRows()[0] : null;
    if (first) { event.preventDefault(); choose(first.item.key); dlg.querySelector(`.sw-row[data-row="${quote(first.item.key)}"]`)?.focus({ preventScroll: true }); }
    return;
  }
  const typing = t.matches('input, textarea') && !(t === find && (event.key === 'ArrowDown' || event.key === 'ArrowUp'));
  if (typing) return;
  if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) { find.focus(); return; }
  const rows = shownRows(), at = rows.findIndex(row => row.item.key === state.sel);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))];
    if (next) { choose(next.item.key); dlg.querySelector(`.sw-row[data-row="${quote(next.item.key)}"]`)?.focus({ preventScroll: true }); }
    return;
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const opts = [...dlg.querySelectorAll('.sw-body .sw-opt[data-pick]')];
    if (!opts.length) return;
    event.preventDefault();
    const here = opts.indexOf(t.closest?.('.sw-opt')), from = here >= 0 ? here : opts.findIndex(o => o.classList.contains('on'));
    opts[Math.max(0, Math.min(opts.length - 1, from + (event.key === 'ArrowRight' ? 1 : -1)))]?.focus();
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
  Door.root.sheet('sw-style', STYLE, '', doc);
  if (partKey) { state.cur = placeOf(partKey); state.view = 'place'; state.sel = null; }
  state.find = ''; state.recording = false;
  const dlg = doc.createElement('dialog');
  dlg.className = 'sw-dialog lk-window';
  dlg.innerHTML = `<div class="sw-head"><b>Plugin settings</b><input class="sw-find lk-field" type="text" id="sw-find" placeholder="find a setting" aria-label="Find a setting" spellcheck="false" autocomplete="off"><button type="button" class="sw-close lk-close" aria-label="Close" title="Close (Esc)">×</button></div><nav class="sw-side" aria-label="Where in Logseq"></nav><div class="sw-list" role="listbox" aria-label="Settings"></div><div class="sw-body" aria-live="polite"></div>`;
  dlg.addEventListener('input', onInput);
  dlg.addEventListener('change', onChange);
  dlg.addEventListener('click', event => onClick(dlg, event));
  dlg.addEventListener('keydown', event => onKey(dlg, event));
  dlg.addEventListener('close', () => { if (open === dlg) open = null; dlg.remove(); offEscape?.(); offEscape = null; });
  offEscape?.(); offEscape = Door.root.listen(doc.defaultView, 'keydown', onEscape, true);
  doc.body.appendChild(dlg);
  open = dlg;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  drawSide(dlg); drawList(dlg); drawBody(dlg);
  dlg.querySelector('.sw-find').focus({ preventScroll: true });
  loadNames();
  return dlg;
}
function close() {
  if (!open) return;
  const dlg = open;
  open = null; state.recording = false;
  offEscape?.(); offEscape = null;
  try { dlg.close(); } catch (error) { /* not open */ }
  dlg.remove();
}
function stop() { close(); try { host().getElementById('sw-style')?.remove(); } catch (error) { /* Logseq's window is gone */ } }
Door.settings = { open: openWindow, close, stop, keyWords, keySpelling, REOPEN_KEY, get current() { return open; } };
})();
