/* The settings window, in the grammar's look: one real dialog (the browser's) in Logseq's own window. Show, don't tell:
   every setting is the thing itself, drawn as it will look with the setting as it stands (the plugin gives a specimen
   per setting), with its switch in the margin and its name; no paragraphs. Sections carry a heading and one line of what
   they are for. A field with a hairline under it for words or a number, quiet words for a choice with the one in force in
   the text colour, a faint "default" after a value that differs from its default. Every change applies at once through
   the plugin's own settings, and the specimen redraws. A copy of Look's (logseq-look/logseq/window.js), as Predictive keeps one; a change to the window goes to Look first. */
(function () {
const NS = window.Find;
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const CSS = `
.sw-dialog { --sw-quiet: color-mix(in srgb, currentColor 70%, transparent); --sw-faint: color-mix(in srgb, currentColor 46%, transparent);
  --sw-hair: color-mix(in srgb, currentColor 12%, transparent); --sw-line: color-mix(in srgb, currentColor 26%, transparent); --sw-wash: color-mix(in srgb, currentColor 7%, transparent);
  position: fixed !important; top: 50% !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; margin: 0 !important; width: min(640px, 92vw); max-height: 86vh; box-sizing: border-box; padding: 0; border: 1px solid var(--sw-hair); border-radius: 8px;
  background: var(--ls-primary-background-color, #fff); color: var(--ls-primary-text-color, #222); font-size: 14px; line-height: 1.5;
  box-shadow: 0 10px 30px rgba(0,0,0,.14); }
.sw-dialog::backdrop { background: rgba(0,0,0,.18); }
.sw-head { display: flex; align-items: baseline; gap: 8px; padding: 16px 22px 10px; position: sticky; top: 0; background: inherit; z-index: 1; }
.sw-head b { font-size: 16px; font-weight: 600; }
.sw-head .sw-quiet { color: var(--sw-quiet); }
.sw-close { all: unset; margin-left: auto; cursor: pointer; color: var(--sw-faint); font-size: 18px; line-height: 1; padding: 0 4px; }
.sw-close:hover, .sw-close:focus-visible { color: inherit; }
.sw-body { padding: 0 22px 22px; }
.sw-section { padding-top: 14px; }
.sw-section + .sw-section { margin-top: 22px; }
.sw-section h3 { font-size: 14px; font-weight: 600; margin: 0; }
.sw-legend { color: var(--sw-quiet); margin: 0 0 6px; max-width: 62ch; }
.sw-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 2px 8px; align-items: baseline; padding: 9px 0; }
.sw-row .sw-title { font-weight: 500; }
.sw-row .sw-value { grid-column: 2; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
/* The specimen: the thing drawn as it will look, at the page's size, under its name. */
.sw-spec { grid-column: 2; margin-top: 3px; font-size: 15px; line-height: 1.6; color: var(--ls-primary-text-color, #222); }
.sw-spec .sw-off { color: var(--sw-faint); }
.sw-spec .sw-blue { color: var(--ls-link-text-color, #3b6fc9) !important; text-decoration: none !important; }
.sw-spec .sw-chip { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 4px; padding: 0 6px; }
.sw-spec .sw-cap { background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 10px; padding: 0 8px; }
.sw-spec .sw-big { font-size: 22px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
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
.sw-tick:checked::after { content: ''; position: absolute; left: 3.5px; top: 0.5px; width: 4px; height: 7px; border-right: 1.5px solid var(--ls-primary-text-color, #222); border-bottom: 1.5px solid var(--ls-primary-text-color, #222); transform: rotate(45deg); }
.sw-tick:focus-visible { outline: 1px solid var(--sw-line); outline-offset: 2px; }
.sw-field { border: 0; border-bottom: 1px solid var(--sw-line); background: none; color: inherit; font: inherit; padding: 1px 2px; min-width: 6em; outline: none; }
.sw-field:focus { border-bottom-color: currentColor; }
.sw-field.sw-wide { width: min(100%, 36em); }
.sw-choices { display: flex; gap: 14px; flex-wrap: wrap; }
.sw-choice { all: unset; cursor: pointer; color: var(--sw-quiet); }
.sw-choice:hover { color: inherit; }
.sw-choice[aria-pressed="true"] { color: inherit; font-weight: 500; }
.sw-default { all: unset; cursor: pointer; color: var(--sw-faint); }
.sw-default:hover { color: inherit; }
.sw-row:hover { background: var(--sw-wash); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 4px; }`;

let open = null;
/* open({ doc, name, schema, read, write }): doc is Logseq's document; name the plugin's; schema the plugin's settings list
   (headings, booleans, strings, numbers, enums); read(key) the value in force; write({ key: value }) applies it. */
function openWindow({ doc, name, schema, read, write, specimen }) {
  close();
  // The stylesheet is written afresh on every opening: a reload of the plugin leaves the old one in Logseq's head.
  let sheet = doc.getElementById('sw-style');
  if (!sheet) { sheet = doc.createElement('style'); sheet.id = 'sw-style'; sheet.className = 'fd-own'; doc.head.appendChild(sheet); }
  if (sheet.textContent !== CSS) sheet.textContent = CSS;
  const dlg = doc.createElement('dialog');
  dlg.className = 'sw-dialog fd-own';
  const sections = [];
  let current = null;
  for (const item of schema) {
    if (item.hidden) continue;
    if (item.type === 'heading') { current = { title: item.title, legend: item.description || '', items: [] }; sections.push(current); continue; }
    if (!current) { current = { title: name, legend: '', items: [] }; sections.push(current); }
    current.items.push(item);
  }
  const rowHtml = item => {
    const value = read(item.key), differs = JSON.stringify(value) !== JSON.stringify(item.default);
    const reset = differs ? `<button type="button" class="sw-default" data-reset="${esc(item.key)}" title="Back to the default">default</button>` : '';
    const spec = specimen ? specimen(item, value) : '';
    const drawn = spec ? `<div class="sw-spec" title="${esc(item.description || '')}">${spec}</div>` : '';
    if (item.type === 'boolean') return `<label class="sw-row"><input type="checkbox" class="sw-tick" data-key="${esc(item.key)}"${value ? ' checked' : ''}><span class="sw-title" title="${esc(item.description || '')}">${esc(item.title)} ${reset}</span>${drawn}</label>`;
    if (item.type === 'enum') return `<div class="sw-row"><span></span><span class="sw-title" title="${esc(item.description || '')}">${esc(item.title)} ${reset}</span><span class="sw-value sw-choices">${(item.enumChoices || []).map(c => `<button type="button" class="sw-choice" data-key="${esc(item.key)}" data-choice="${esc(c)}" aria-pressed="${String(c) === String(value)}">${esc(c)}</button>`).join('')}</span>${drawn}</div>`;
    const number = item.type === 'number';
    return `<div class="sw-row"><span></span><span class="sw-title" title="${esc(item.description || '')}">${esc(item.title)} ${reset}</span><span class="sw-value"><input type="${number ? 'number' : 'text'}" class="sw-field${number ? '' : ' sw-wide'}" data-key="${esc(item.key)}" value="${esc(value ?? '')}" spellcheck="false" autocomplete="off"></span>${drawn}</div>`;
  };
  dlg.innerHTML = `<div class="sw-head"><b>${esc(name)}</b><span class="sw-quiet">settings</span><button type="button" class="sw-close" aria-label="Close" title="Close (Esc)">×</button></div>
    <div class="sw-body">${sections.map(s => `<section class="sw-section"><h3>${esc(s.title)}</h3>${s.legend ? `<p class="sw-legend">${esc(s.legend)}</p>` : ''}${s.items.map(rowHtml).join('')}</section>`).join('')}</div>`;
  const byKey = new Map(schema.map(i => [i.key, i]));
  const redraw = () => { const at = dlg.querySelector('.sw-body').scrollTop; const keep = { doc, name, schema, read, write, specimen }; close(); openWindow(keep); if (open) open.querySelector('.sw-body').scrollTop = at; };
  dlg.addEventListener('change', event => {
    const el = event.target, key = el.dataset?.key; if (!key) return;
    const item = byKey.get(key);
    const value = item.type === 'boolean' ? !!el.checked : item.type === 'number' ? (el.value === '' ? item.default : Number(el.value)) : el.value;
    write({ [key]: value });
    if (item.type !== 'string') redraw();
  });
  dlg.addEventListener('click', event => {
    const t = event.target;
    if (t.closest('.sw-close')) return close();
    const choice = t.closest('.sw-choice'); if (choice) { write({ [choice.dataset.key]: choice.dataset.choice }); return redraw(); }
    const reset = t.closest('.sw-default'); if (reset) { write({ [reset.dataset.reset]: byKey.get(reset.dataset.reset).default }); return redraw(); }
    if (t === dlg) close(); // a click on the backdrop
  });
  // Keys typed here stay here (a key combination typed into a field would otherwise fire Logseq's shortcut); Escape closes.
  dlg.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
  dlg.addEventListener('close', () => { if (open === dlg) open = null; dlg.remove(); });
  doc.body.appendChild(dlg);
  open = dlg;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  return dlg;
}
function close() { if (open) { const d = open; open = null; try { d.close(); } catch (e) { /* not open */ } d.remove(); } }
NS.settingsWindow = { open: openWindow, close, get current() { return open; } };
})();
