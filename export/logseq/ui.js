/* The export window: a quiet bar over the page on a desk, and a column of choices beside the sheet. It is drawn into Logseq's
   own document, not the plugin's frame (as Threads draws), so the plugin's stylesheet reaches it: the window is built from the
   visual grammar's shared names (lk-row, lk-list, lk-tick, lk-prop, lk-count, and the Pressing set, lk-name, lk-value, lk-pick,
   lk-alts, lk-view, lk-pop, lk-accent, lk-close). The owner, 12 November 2026: rows unfolding under the bar read as a "toolbar
   jammed underneath toolbar"; they chose a quiet bar with the choices in a column on the left, and tabs that look like tabs.
   The bar: Adjust (shows the column or puts it away, remembered), the template (a pick whose alternatives are a pop-up), where
   the export goes as tabs (lk-view, a bar under the one in force), and at the right end the one accent that does the export,
   then ×. The column: groups told apart by a gap, each a small head over its rows; a row is a name at the left and its value at
   the right, the value being what is pressed: a pick wears a faint chevron and unfolds its alternatives as a line of words under
   its row, a switch reads its state as a word, a field is faint until written. Only the groups of the destination, and the rows
   of the style, are shown. The page is drawn at its printed width on the desk, with only the size pick at the desk's right, and
   redrawn as the choices change, or the Markdown as text. Every choice is remembered in the plugin's settings. */
(function () {
const E = (window.DbExport ||= {});
const { inline, doc: D, themes, templates: T } = E;
const esc = inline.escapeHtml;
// Logseq's document; the plugin's own when it cannot be reached (the plugin installed without "effect").
const { host } = window.PluginDoor;

/* The greys are the plugin's own (--lk-*, plugin.js). Logseq's colours apply as they are: the window stands in Logseq's
   document. */
const CSS = `
.xp { position: fixed; inset: 0; z-index: 9990; display: flex; flex-direction: column; box-sizing: border-box; margin: 0;
  background: color-mix(in srgb, var(--lk-paper, #fff) 84%, #000); color: var(--lk-text, #222);
  font-family: var(--ls-font-family, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif); font-size: 14px; line-height: 1.35;
  }
.xp * { box-sizing: border-box; }
.xp[hidden] { display: none; }
.xp-titlebar { display: flex; align-items: center; justify-content: center; flex: none; height: 48px; font-size: var(--lk-small); color: var(--lk-quiet); background: var(--lk-paper, #fff); }
/* The bar: a row of controls, nothing between them but space, a wider space between groups; the accent and the × at the end. */
.xp-bar { display: flex; align-items: flex-start; flex-wrap: wrap; flex: none; padding: 2px 28px 14px; background: var(--lk-paper, #fff); }
.xp-bar .g { display: flex; align-items: flex-start; }
.xp-bar .g + .g { margin-left: 44px; }
.xp-bar .g[hidden] { display: none; }
.xp-bar .g.end { margin-left: auto; gap: 26px; padding-top: 15px; align-items: center; }   /* the × on the line the two buttons share: from the top it stood 7 px above it (measured 12 November 2026) */
/* A control: its name small and faint above, its value in the text colour below. The gap between controls is equal paddings,
   so a pick's hairline stands mid-gap. (The layout of the Pressing names; their colours are the shared stylesheet's.) */
.xp .it { --pl: 20px; position: relative; display: flex; flex-direction: column; gap: 3px; white-space: nowrap; padding: 0 20px 0 var(--pl); }
.xp .it[hidden] { display: none; }
.xp .it:first-child, .xp .it[hidden] + .it { --pl: 0px; } .xp .it:last-child { padding-right: 0; }
.xp .it.lk-pick:not(:first-child) { border-left: 1px solid var(--lk-hair); }
.xp .it[hidden] + .it.lk-pick { border-left: 0; }
.xp .lk-name { min-height: 15px; }
.xp .lk-value { all: unset; display: inline-flex; align-items: center; cursor: pointer; color: var(--lk-text, #222); font: inherit; line-height: 1.35; }
.xp .lk-value:focus-visible { outline: none; background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
/* The mark: a small faint chevron tight after a value that unfolds. */
.xp .lk-value .m { width: 8px; height: 8px; margin-left: 4px; color: var(--lk-quiet); flex: none; }
/* What a value can become: a line of faint words under it, the one in force in the text colour. It takes its room below the
   row (the pick grows by the line's height while open, see unfold), never beside the pick: nothing moves sideways. */
.xp .lk-pick .lk-alts { position: absolute; left: var(--pl); top: 100%; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--lk-quiet); width: max-content; max-width: 420px; white-space: normal; }
.xp .lk-pick .lk-alts[hidden] { display: none; }
.xp .lk-alts span { cursor: pointer; }
/* A field is the Pressing set's input.lk-value (the library): a hairline under it only while it has the keyboard. */
/* A switch: a hidden box; its word reads the state. */
.xp .lk-switch input { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
.xp .lk-switch .lk-value { position: relative; }
.xp .lk-switch:has(:focus-visible) .lk-value { background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
/* A choice that stays open (where the export goes): the library's alternatives (lk-alts), the one in force (on) in the text colour. */
.xp-where { display: flex; gap: 16px; --lk-view-pad: 0px; }
.xp-where > * { position: relative; cursor: pointer; white-space: nowrap; }
.xp-where input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.xp-where label:has(:focus-visible) { background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
/* The column of choices beside the sheet, on its left: groups told apart by a gap, each a small head over its rows; a row is
   its name at the left and its value at the right, and a pick's alternatives are a line of words under its row. */
.xp-body { flex: 1; display: flex; min-height: 0; }
.xp-side { flex: none; width: 320px; overflow-y: auto; scrollbar-width: thin; padding: 6px 22px 28px 28px; background: var(--lk-paper, #fff); border-right: 1px solid var(--lk-hair); display: flex; flex-direction: column; gap: 22px; }
.xp-side[hidden], .xp-group[hidden], .xp-sub[hidden] { display: none; }
.xp-group, .xp-sub { display: flex; flex-direction: column; gap: 7px; }
.xp .xp-side .it { flex-direction: row; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 14px; padding: 0; border-left: 0 !important; white-space: normal; }
.xp .xp-side .it > .lk-name { font-size: 14px !important; letter-spacing: 0; min-height: 0; flex: 1 1 0; min-width: 0; }
.xp .xp-side .it > .lk-value { flex: none; white-space: nowrap; }
.xp .xp-side .it > .lk-name::first-letter, .xp-gh::first-letter { text-transform: uppercase; }
.xp .xp-side .lk-pick .lk-alts { position: static; flex-basis: 100%; width: auto; max-width: none; margin: 2px 0 4px; justify-content: flex-end; }
.xp .xp-side .xp-field { flex-wrap: nowrap; }
.xp .xp-side .xp-field input.lk-value { text-align: right; flex: 0 1 10em; min-width: 3em; width: 10em; }
.xp .it.open > .lk-value { color: var(--lk-quiet); }
/* On the bar, the values stand on one line: Adjust under an empty name, the tabs with their bar hanging below the words. */
.xp .xp-bar .lk-btn.xp-adjust { position: relative; top: -3px; left: -12px; }   /* the library's button keeps its padding; moved by it, its word stands on the values' line and at the column's left edge */
.xp .xp-bar .lk-btn.xp-adjust.on { background: color-mix(in srgb, currentColor 18%, transparent) !important; }
.xp-where .lk-view { padding-top: 0; }
.xp-where { margin-bottom: -6px; }
/* The lists of properties to pick from, inside Show: each headed by a named value, whose they are over all / none as a
   small lk-bar, its first word under the name; then one column, a row per property, its tick box at the left (lk-tick: Look
   shows them when the pointer is on the list), the icon of what it holds, its name, the count (lk-count: never shown where
   Look runs). A list longer than ten takes two columns. The gap tells the two lists apart. */
.xp-lists { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
.xp .xp-side .xp-lists .it { flex-direction: column; align-items: stretch; }
.xp-all { margin: -3px 0 -3px -12px; }
.xp-list { display: grid; grid-template-columns: 1fr; gap: 0 18px; margin-top: 10px; }
.xp-list.two { grid-template-columns: 1fr 1fr; }
.xp-list .xp-prop { display: flex; align-items: center; gap: 6px; padding: 2px 0; cursor: pointer; min-width: 0; }
.xp-list .xp-prop input { margin: 0; flex: none; }
.xp-list .lk-prop { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xp-kind { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; font-size: 14px; color: var(--lk-quiet); flex: none; }
.xp-kind .lk-icon.lk-web svg { width: 11px; height: 11px; }
.xp-list .lk-count { margin-left: auto; color: var(--lk-quiet); font-size: var(--lk-small); }
/* The tick box is the library's (lk-tick). */
/* The accent: the one action, its key beside it; a second action lk-btn, its words level with the accent's and the gap
   between them measured from its words; × the way out. */
.xp-bar button:where(:not(.lk-btn)) { all: unset; cursor: pointer; font: inherit; color: var(--lk-text, #222); white-space: nowrap; }
.xp-bar button[hidden] { display: none; }
.xp-bar button:focus-visible { outline: none; background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
.xp-bar .lk-btn { margin: -2px -6px; }
.xp-bar button.lk-accent kbd { font: inherit; font-size: var(--lk-small); margin-left: 8px; }
.xp-bar button.lk-close { font-size: 17px; line-height: 1; margin-top: -2px; }
.xp-desk { flex: 1; min-width: 0; overflow: auto; padding: 26px 24px 48px; }
.xp-desk iframe { display: block; margin: 0 auto; width: 794px; max-width: 100%; height: 600px; border: 0; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22); }
.xp-desk iframe.sheets { background: transparent; box-shadow: none; }
/* Over the desk, at its right, alone: how large the sheets are drawn. */
.xp-note { display: flex; justify-content: flex-end; align-items: center; font-size: var(--lk-small); padding: 0 0 12px; }
.xp-note .it { padding: 0; } .xp-note .lk-name { display: none; } .xp-note .lk-value { color: var(--lk-quiet); }
.xp-note .lk-alts { left: auto; right: 0; justify-content: flex-end; }
/* The template pick: its alternatives are a pop-up under it (the library's lk-pop), the templates one to a line, then what can be
   done with the one in force under a hairline; a name is asked for there, and so is whether a delete is meant. */
.xp .xp-tpl .lk-alts { flex-direction: column; flex-wrap: nowrap; gap: 6px; padding: 10px 14px; min-width: 210px; max-width: 340px; z-index: 5; }
.xp .xp-tpl .lk-alts .do.first { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--lk-hair); }
.xp .xp-tpl .lk-alts[data-ask] > :not(.ask) { display: none; }
.xp .xp-tpl .ask { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; cursor: default; white-space: normal; }
.xp .xp-tpl .ask input { width: 100%; }
.xp .xp-tpl .ask b { font-weight: inherit; cursor: pointer; }
.xp .xp-tpl .was { color: var(--lk-quiet); white-space: pre; }
/* Your CSS: the box, and under it the parts of the sheet in plain words; a word pointed at lights its part on the sheet. */
.xp-side .xp-cssbox { font-family: Menlo, Consolas, monospace; font-size: var(--lk-small); line-height: 1.5; width: 100%; height: 9.5em; resize: vertical; white-space: pre; border: 1px solid var(--lk-line); border-radius: 4px; padding: 6px 8px; }
.xp-side .xp-partshead { margin-top: 4px; }
.xp-side .xp-parts { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.xp-side .xp-parts span { cursor: pointer; }`;

// The icon of what a property holds, before its name: the door's.
const kindIconHtml = type => `<span class="xp-kind">${window.PluginDoor.kindIconHtml(type || 'default')}</span>`;

const TARGETS = [{ key: 'pdf', name: 'PDF' }, { key: 'md', name: 'Markdown' }, { key: 'rich', name: 'Rich text' }];
const SIZES = [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], MARGINS = [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']];
const LINKS = [['plain', 'Links as words'], ['wiki', '[[Wikilinks]]'], ['file', 'Links to .md files']];
const KIDS = [['join', 'Run on'], ['each', 'A paragraph each'], ['list', 'Stay bullets']];
const ZOOMS = [['fit', 'Fit the window'], ['75', '75%'], ['100', '100%'], ['125', '125%'], ['150', '150%']];

function read() {   // the remembered choices, with their defaults
  const s = logseq.settings || {};
  const str = (k, d = '') => typeof s[k] === 'string' ? s[k] : d;
  const bool = (k, d) => typeof s[k] === 'boolean' ? s[k] : d;
  return { target: TARGETS.some(t => t.key === s.target) ? s.target : 'pdf',
    layout: D.layouts.some(l => l.key === s.layout) ? s.layout : 'document', look: themes.looks.some(l => l.key === s.look) ? s.look : 'plain',
    paper: s.paper === 'Letter' ? 'Letter' : 'A4', margins: themes.MARGINS[s.margins] ? s.margins : 'normal', size: themes.SIZES[s.size] ? s.size : 'normal',
    footer: str('footer'), pageNumbers: bool('pageNumbers', true), tags: bool('showTags', true), tasks: bool('taskBoxes', true), titleDate: bool('titleDate', true), preparedBy: str('preparedBy'),
    links: LINKS.some(l => l[0] === s.mdLinks) ? s.mdLinks : 'plain', zoom: ZOOMS.some(z => z[0] === s.previewZoom) ? s.previewZoom : 'fit', frontMatter: bool('frontMatter', false), customCss: str('customCss'),
    hiddenHead: new Set(Array.isArray(s.hiddenHeadProperties) ? s.hiddenHeadProperties : Array.isArray(s.hiddenProperties) ? s.hiddenProperties : []),   // the one list of 0.1.1 counts for both
    hiddenNodes: new Set(Array.isArray(s.hiddenNodeProperties) ? s.hiddenNodeProperties : Array.isArray(s.hiddenProperties) ? s.hiddenProperties : []), dated: s.dated && typeof s.dated === 'object' ? { ...s.dated } : { dateKey: 'auto', under: '', newestFirst: false },
    titleLines: s.titleLines && typeof s.titleLines === 'object' ? s.titleLines : {},
    prose: D.proseOpts(s.prose), sideOpen: bool('sideOpen', false), template: str('template'), templates: s.templates && typeof s.templates === 'object' && !Array.isArray(s.templates) ? s.templates : {} };
}
// A template's set laid over a choice: only the keys the set holds; the lists of properties left out become Sets again.
function withTemplate(c, set) {
  const next = { ...c };
  for (const [key, value] of Object.entries(set || {})) next[key] = key === 'hiddenHead' || key === 'hiddenNodes' ? new Set(value) : value && typeof value === 'object' ? { ...value } : value;
  if (set?.prose) next.prose = D.proseOpts(set.prose);
  return next;
}
function remember(c, title) {
  const titleLines = { ...c.titleLines };
  if (title) titleLines[title] = { kicker: c.kicker || '', subtitle: c.subtitle || '' };
  const now = { target: c.target, layout: c.layout, look: c.look, paper: c.paper, margins: c.margins, size: c.size, footer: c.footer, pageNumbers: c.pageNumbers, showTags: c.tags, taskBoxes: c.tasks,
    titleDate: c.titleDate, preparedBy: c.preparedBy, customCss: c.customCss, mdLinks: c.links, frontMatter: c.frontMatter, previewZoom: c.zoom, hiddenHeadProperties: [...c.hiddenHead], hiddenNodeProperties: [...c.hiddenNodes], dated: c.dated, titleLines, prose: c.prose, template: c.template || '' };
  // Only what changed: a save tells every module, and an export usually changes nothing.
  const changed = Object.fromEntries(Object.entries(now).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(logseq.settings?.[key])));
  try {
    if (Object.keys(changed).length) logseq.updateSettings(changed);
  } catch (error) { console.warn('DB Export: could not remember the choices', error); }
}

/* Logseq's header is the window's drag handle (-webkit-app-region: drag, the top 48px): a real click there moves the window
   and never reaches the page, whatever is drawn over it, so nothing of the toolbar may sit in that band. Measured from
   Logseq's own window, so a different header height is followed. */
function dragBand(doc) {
  try {
    let bottom = 0;
    for (const e of doc.querySelectorAll('.drag-region, #head')) { if (doc.defaultView.getComputedStyle(e).webkitAppRegion === 'drag') { const b = e.getBoundingClientRect(); if (b.top < 100 && b.width > 300) bottom = Math.max(bottom, b.bottom); } }
    return Math.round(bottom) || 48;
  } catch (error) { return 48; }
}
// The window's stylesheet, once, in the document the window is drawn in.
const ensureStyle = doc => { E.base.sheet('xp-style', CSS, '', doc); };
// Keys typed in the window stay in it: Logseq's own shortcuts never see them (Escape goes on to the window's own handler).
function keepKeys(el) { for (const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); }
// Everything the window leaves in Logseq's document, taken out when the plugin stops.
function sweep(doc = host()) { for (const node of doc.querySelectorAll('.xp, #xp-style')) node.remove(); }

/* Opens the window for a document. `act(choice, action, edited)` does the export; `what` names it ("this page", "3 blocks").
   `edited` is the preview after the user changed it: the page's HTML, or for Markdown the text. */
function open({ doc, what, act }) {
  return new Promise(resolve => {
    const hostDoc = host();
    ensureStyle(hostDoc);
    for (const old of hostDoc.querySelectorAll('.xp')) old.remove();   // one window at a time
    let c = read();
    if (!T.get(c.templates, c.template)) c.template = '';
    const props = D.propertiesIn(doc);
    const lists = [['head', doc.kind === 'blocks' ? (doc.nodes.length > 1 ? 'of the blocks chosen' : 'of the block chosen') : 'of the page', D.propertiesIn(doc, 'head'), c.hiddenHead], ['nodes', doc.kind === 'blocks' ? 'of those under' : 'of the nodes', D.propertiesIn(doc, 'nodes'), c.hiddenNodes]].filter(l => l[2].length);
    const dates = D.dateChoices(doc);
    const lines = doc.title ? (c.titleLines[doc.title] || {}) : {};
    const root = hostDoc.createElement('div');
    root.className = 'xp';
    const CHEV = '<svg class="m" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3l2.5 2.5L6.5 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
    const nm = name => `<div class="lk-name">${esc(name)}</div>`;
    // Where the export goes: a choice that stays open.
    const where = (items, chosen) => `<div class="it lk-choice">${nm('export as')}<div class="xp-where lk-views" role="radiogroup" aria-label="Export as">${items.map(i => `<label class="lk-view${i.key === chosen ? ' on' : ''}"><input type="radio" name="xp-target" value="${i.key}" ${i.key === chosen ? 'checked' : ''}>${esc(i.name)}</label>`).join('')}</div></div>`;
    // A pick: the name, the value with the chevron, the select it stands for (hidden), and what it can become, unfolded under it when pressed.
    const pick = (cls, name, items, chosen, title = '') => `<div class="it lk-pick" data-pick="${cls}">${nm(name)}<button type="button" class="lk-value" ${title ? `title="${esc(title)}"` : ''}>${esc((items.find(([k]) => k === chosen) || items[0])[1])}${CHEV}</button><select class="${cls}" hidden>${items.map(([k, n]) => `<option value="${esc(k)}" ${k === chosen ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><div class="lk-alts" hidden>${items.map(([k, n]) => `<span data-v="${esc(k)}" class="${k === chosen ? 'on' : ''}">${esc(n)}</span>`).join('')}</div></div>`;
    // A switch: the name, and a value that reads the state; the box is hidden and the word turns it.
    const sw = (cls, name, on, offWord, onWord) => `<div class="it lk-switch">${nm(name)}<label class="lk-value ${on ? '' : 'off'}" data-on="${esc(onWord)}" data-off="${esc(offWord)}"><input type="checkbox" class="${cls}" ${on ? 'checked' : ''}>${esc(on ? onWord : offWord)}</label></div>`;
    // A field: the name, and a value faint until written.
    const field = (cls, name, value, placeholder) => `<div class="it xp-field">${nm(name)}<input type="text" class="lk-value ${cls}" placeholder="${esc(placeholder)}" value="${esc(value)}"></div>`;
    // A list of properties, headed by whose they are over all / none (a small bar); then the grammar's row, a tick box at the left, the icon of what it holds, the name, the count.
    const list = (role, label, ps, hidden) => `<div class="it">${nm(label)}<div class="xp-all lk-bar" data-role="${role}"><a class="lk-btn lk-i-tick" data-all="1" data-role="${role}">all</a><a class="lk-btn lk-i-x" data-all="0" data-role="${role}">none</a></div>
      <div class="xp-list lk-list${ps.length > 10 ? ' two' : ''}" data-role="${role}">${ps.map(p => `<label class="xp-prop lk-row"><input type="checkbox" class="lk-tick" value="${esc(p.ident)}" ${hidden.has(p.ident) ? '' : 'checked'}><span class="lk-prop">${kindIconHtml(p.type)}<span>${esc(p.name)}</span></span><span class="lk-count">${p.count}</span></label>`).join('')}</div></div>`;
    // A group of the column: a small head and its rows; shown for the destinations it belongs to.
    const group = (name, body, fors = '') => `<div class="xp-group" ${fors ? `data-for="${fors}"` : ''}><div class="xp-gh lk-name">${esc(name)}</div>${body}</div>`;
    const only = (html, fors) => html.replace('class="it', `data-for="${fors}" class="it`);
    root.innerHTML = `<div class="xp-titlebar" style="height:${dragBand(hostDoc)}px">Export ${esc(what)}</div>
    <div class="xp-bar" role="toolbar" aria-label="Export">
      <div class="g"><div class="it">${nm('')}<button type="button" class="lk-btn xp-adjust${c.sideOpen ? ' on' : ''}" aria-pressed="${c.sideOpen}" title="Every choice, in a column beside the sheet">Adjust</button></div></div>
      <div class="g"><div class="it lk-pick xp-tpl" data-pick="xp-template">${nm('template')}<button type="button" class="lk-value" title="A named set of every choice here">${CHEV}</button><select class="xp-template" hidden></select><div class="lk-alts lk-pop" hidden></div></div></div>
      <div class="g">${where(TARGETS, c.target)}</div>
      <div class="g end"><button type="button" class="lk-btn lk-i-save" data-act="md-file" data-for="md">Save as file…</button>
        <button type="button" data-act="md" data-for="md" class="lk-accent lk-i-copy xp-main">Copy Markdown<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="rich" data-for="rich" class="lk-accent lk-i-copy xp-main">Copy rich text<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="pdf" data-for="pdf" class="lk-accent lk-i-save xp-main">Save PDF…<kbd>Cmd Enter</kbd></button>
        <button type="button" class="lk-close xp-cancel" aria-label="Close" title="Close (Esc)">×</button></div>
    </div>
    <div class="xp-body">
    <div class="xp-side" ${c.sideOpen ? '' : 'hidden'}>
    ${group('Text', pick('xp-layout', 'style', D.layouts.map(l => [l.key, l.name]), c.layout)
      + `<div class="xp-sub" data-when="prose">${pick('xp-kids', 'bullets under a line', KIDS, c.prose.children) + sw('xp-numbered', 'headings', c.prose.numbered, 'Not numbered', 'Numbered')
      + sw('xp-runin', 'headings under a #', c.prose.runIn, 'Own line', 'Lead the line') + field('xp-noteshead', 'over the notes', c.prose.notesHead, 'No heading')
      + only(sw('xp-contents', 'contents list', c.prose.contents, 'No', 'Yes'), 'pdf rich')
      + only(sw('xp-titlesheet', 'title', c.prose.titleSheet, 'Over the text', 'On its own sheet'), 'pdf')
      + only(sw('xp-sectionsheets', 'sections', c.prose.sectionSheets, 'Run on', 'Each # on a new sheet'), 'pdf')}</div>`
      + `<div class="xp-sub" data-when="dated">${pick('xp-datekey', 'date from', [['auto', 'Automatic'], ...dates.map(d => [d.key, d.name])], c.dated.dateKey)
      + pick('xp-under', 'under the date', [['', 'Nothing'], ...props.filter(p => p.type !== 'date' && p.type !== 'datetime').map(p => [p.ident, p.name])], c.dated.under)
      + sw('xp-newest', 'order', c.dated.newestFirst, 'Oldest first', 'Newest first')}</div>`)}
    ${group('Look', pick('xp-look', 'look', themes.looks.map(l => [l.key, l.name]), c.look) + pick('xp-size', 'text size', SIZES, c.size), 'pdf rich')}
    ${group('Page', pick('xp-paper', 'paper', [['A4', 'A4'], ['Letter', 'Letter']], c.paper) + pick('xp-margins', 'margins', MARGINS, c.margins)
      + field('xp-footer', 'footer', c.footer, 'None') + sw('xp-pagenumbers', 'page numbers', c.pageNumbers, 'No', 'Yes'), 'pdf')}
    ${doc.title ? group('Title', field('xp-kicker', 'line above', lines.kicker || '', 'None') + field('xp-subtitle', 'subtitle', lines.subtitle || '', 'None')
      + field('xp-by', 'prepared by', c.preparedBy, 'None') + sw('xp-titledate', 'date', c.titleDate, 'No date', 'Today’s date')) : ''}
    ${group('Markdown', pick('xp-links', 'links', LINKS, c.links) + sw('xp-frontmatter', 'front matter', c.frontMatter, 'No', 'Yes'), 'md')}
    ${group('Show', sw('xp-tags', 'tags', c.tags, 'No', 'Yes') + sw('xp-tasks', 'task boxes', c.tasks, 'No', 'Yes') + (lists.length ? `<div class="xp-lists">${lists.map(l => list(...l)).join('')}</div>` : ''))}
    ${group('Your CSS', `<textarea class="xp-cssbox lk-field" spellcheck="false" aria-label="Rules of your own, added after the look’s" placeholder=".x-title { letter-spacing: 0.02em; }">${esc(c.customCss)}</textarea>
      <div class="xp-partshead lk-name">The parts of this sheet. Point to see one, press to write its rule.</div><div class="xp-parts lk-alts"></div>`, 'pdf rich')}
    </div>
    <div class="xp-desk"><div class="xp-note">${pick('xp-zoom', 'size', ZOOMS, c.zoom, 'How large the preview is drawn')}</div><iframe title="Preview"></iframe></div>
    </div>`;
    keepKeys(root);
    hostDoc.body.appendChild(root);
    const q = sel => root.querySelector(sel);
    const boxes = role => [...root.querySelectorAll(`.xp-list[data-role=${role}] input`)];
    const target = () => q('input[name=xp-target]:checked')?.value || 'pdf';
    // What is left out: what this page lists as ticked here, and whatever was left out on another page, which this page does not list.
    const hiddenNow = (role, was) => new Set([...[...was].filter(ident => !boxes(role).some(b => b.value === ident)), ...boxes(role).filter(b => !b.checked).map(b => b.value)]);
    const choice = () => ({ ...c, target: target(),
      layout: q('.xp-layout').value, look: q('.xp-look').value,
      paper: q('.xp-paper').value, margins: q('.xp-margins').value, size: q('.xp-size').value, footer: q('.xp-footer').value, pageNumbers: q('.xp-pagenumbers').checked,
      tags: q('.xp-tags').checked, tasks: q('.xp-tasks').checked, zoom: q('.xp-zoom').value, links: q('.xp-links').value, frontMatter: q('.xp-frontmatter').checked,
      kicker: q('.xp-kicker')?.value || '', subtitle: q('.xp-subtitle')?.value || '', preparedBy: q('.xp-by')?.value ?? c.preparedBy, titleDate: q('.xp-titledate')?.checked ?? c.titleDate,
      dated: { dateKey: q('.xp-datekey').value, under: q('.xp-under').value, newestFirst: q('.xp-newest').checked },
      customCss: q('.xp-cssbox').value,
      prose: { children: q('.xp-kids').value, numbered: q('.xp-numbered').checked, contents: q('.xp-contents').checked, titleSheet: q('.xp-titlesheet').checked, sectionSheets: q('.xp-sectionsheets').checked, runIn: q('.xp-runin').checked, notesHead: q('.xp-noteshead').value.trim() },
      hiddenHead: hiddenNow('head', c.hiddenHead), hiddenNodes: hiddenNow('nodes', c.hiddenNodes),
      shownHead: boxes('head').length ? new Set(boxes('head').filter(b => b.checked).map(b => b.value)) : null, shownNodes: boxes('nodes').length ? new Set(boxes('nodes').filter(b => b.checked).map(b => b.value)) : null });
    // The words each control shows: a pick its chosen option (and which of its alternatives is in force), a switch its state.
    const syncValues = () => {
      for (const it of root.querySelectorAll('[data-pick]:not(.xp-tpl)')) {
        const sel = it.querySelector('select'), v = it.querySelector('.lk-value'), text = sel.selectedOptions[0]?.textContent || '';
        if (v.firstChild?.nodeType === 3) v.firstChild.nodeValue = text; else v.insertBefore(hostDoc.createTextNode(text), v.firstChild);
        for (const a of it.querySelectorAll('.lk-alts span')) a.classList.toggle('on', a.dataset.v === sel.value);
      }
      for (const l of root.querySelectorAll('.xp-where label')) l.classList.toggle('on', l.querySelector('input').checked);
      for (const v of root.querySelectorAll('.lk-switch .lk-value')) { const on = v.querySelector('input').checked; v.classList.toggle('off', !on); v.lastChild.nodeValue = on ? v.dataset.on : v.dataset.off; }
      for (const h of root.querySelectorAll('.xp-all')) { const bs = boxes(h.dataset.role), on = bs.filter(b => b.checked).length; h.querySelector('[data-all="1"]').classList.toggle('on', on === bs.length); h.querySelector('[data-all="0"]').classList.toggle('on', on === 0); }
    };
    /* The template pick. Its value: the template in force, "· changed" once a choice differs from it. Its alternatives: the
       templates, then what can be done: save the changes, save as a new one, rename, delete (the person's own only). */
    const setText = (el, text) => { if (el.firstChild?.nodeType === 3) el.firstChild.nodeValue = text; else el.insertBefore(hostDoc.createTextNode(text), el.firstChild); };
    const tpl = () => q('.xp-tpl');
    function drawTemplates(ch) {
      const it = tpl(), alts = it.querySelector('.lk-alts'), set = T.get(c.templates, c.template), changed = T.changed(set, ch), mine = T.isOwn(c.templates, c.template);
      const value = it.querySelector('.lk-value');
      setText(value, c.template || 'None');
      value.querySelector('.was')?.remove();
      if (c.template && changed) { const was = hostDoc.createElement('span'); was.className = 'was'; was.textContent = ' · changed'; value.insertBefore(was, value.querySelector('svg')); }
      if (alts.dataset.ask) return;   // a name is being typed, or a delete asked about: the line stays as it is
      const word = (text, attrs) => `<span ${attrs}>${esc(text)}</span>`;
      alts.innerHTML = [...T.names(c.templates).map(name => word(name, `data-v="${esc(name)}" class="${name === c.template ? 'on' : ''}"`)),
        c.template && changed ? word(`Save changes to ${c.template}`, 'data-do="save" class="do"') : '', word('Save as new…', 'data-do="new" class="do"'),
        mine && !T.BUILT_IN[c.template] ? word('Rename…', 'data-do="rename" class="do"') : '', mine ? word(T.BUILT_IN[c.template] ? `Back to the plugin’s ${c.template}` : 'Delete…', 'data-do="delete" class="do"') : ''].join('');
      alts.querySelector('.do')?.classList.add('first');
    }
    // A template's set put on the controls, as if each had been pressed.
    function show(next) {
      c = next;
      const set = (sel, value) => { const el = q(sel); if (el && value != null && [...el.options].some(o => o.value === String(value))) el.value = String(value); };
      const tick = (sel, on) => { const el = q(sel); if (el) el.checked = !!on; };
      const text = (sel, value) => { const el = q(sel); if (el) el.value = value ?? ''; };
      for (const radio of root.querySelectorAll('input[name=xp-target]')) radio.checked = radio.value === c.target;
      set('.xp-layout', c.layout); set('.xp-look', c.look); set('.xp-paper', c.paper); set('.xp-margins', c.margins); set('.xp-size', c.size); set('.xp-links', c.links);
      text('.xp-footer', c.footer); text('.xp-by', c.preparedBy);
      tick('.xp-pagenumbers', c.pageNumbers); tick('.xp-tags', c.tags); tick('.xp-tasks', c.tasks); tick('.xp-frontmatter', c.frontMatter); tick('.xp-titledate', c.titleDate);
      set('.xp-datekey', c.dated?.dateKey); set('.xp-under', c.dated?.under); tick('.xp-newest', c.dated?.newestFirst);
      set('.xp-kids', c.prose.children); tick('.xp-numbered', c.prose.numbered); tick('.xp-contents', c.prose.contents); tick('.xp-titlesheet', c.prose.titleSheet); tick('.xp-sectionsheets', c.prose.sectionSheets); tick('.xp-runin', c.prose.runIn); text('.xp-noteshead', c.prose.notesHead); text('.xp-cssbox', c.customCss);
      for (const [role, hidden] of [['head', c.hiddenHead], ['nodes', c.hiddenNodes]]) for (const box of boxes(role)) box.checked = !hidden.has(box.value);
    }
    const keepTemplates = (store, name) => { c = { ...c, templates: store, template: name }; try { logseq.updateSettings({ templates: null }); logseq.updateSettings({ templates: store, template: name }); } catch (error) { console.warn('DB Export: could not keep the templates', error); } };
    const endAsk = () => { const alts = tpl().querySelector('.lk-alts'); delete alts.dataset.ask; };
    function takeTemplate(name) {
      const set = T.get(c.templates, name); if (!set) return;
      const now = choice();
      // Rules of your own that no template holds would go with this pick: they are kept as a template first.
      if (now.customCss.trim() && 'customCss' in set && set.customCss !== now.customCss && !T.names(c.templates).some(n => T.get(c.templates, n).customCss === now.customCss)) {
        let kept = 'Earlier CSS'; for (let k = 2; T.names(c.templates).includes(kept); k++) kept = `Earlier CSS ${k}`;
        keepTemplates(T.save(c.templates, kept, now), c.template); logseq.UI.showMsg(`Your CSS was kept as the template ${kept}`);
      }
      show(withTemplate({ ...now, template: name, templates: c.templates }, set));
      closePops(); refresh();
    }
    // The name asked for in the line of alternatives: Enter takes it, Escape leaves things as they were.
    function askName(doing) {
      const alts = tpl().querySelector('.lk-alts');
      alts.dataset.ask = doing;
      alts.insertAdjacentHTML('beforeend', `<span class="ask"><input type="text" class="lk-field" aria-label="Template name" placeholder="Name of the template" value="${doing === 'rename' ? esc(c.template) : ''}"><b data-ask="ok">${doing === 'rename' ? 'Rename' : 'Save'}</b><b data-ask="no">Cancel</b></span>`);
      const input = alts.querySelector('.ask input');
      input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); event.stopPropagation(); answer(true); } });
      input.focus(); input.select();
    }
    function answer(yes) {
      const alts = tpl().querySelector('.lk-alts'), doing = alts.dataset.ask, ch = choice();
      if (yes && doing === 'delete') { const name = c.template; keepTemplates(T.remove(c.templates, name), T.BUILT_IN[name] ? name : ''); logseq.UI.showMsg(T.BUILT_IN[name] ? `${name} is the plugin’s again` : `Deleted the template ${name}`); }
      else if (yes) {
        const name = T.clean(alts.querySelector('.ask input').value);
        if (!name) return alts.querySelector('.ask input').focus();
        if (name !== c.template && T.names(c.templates).includes(name)) { logseq.UI.showMsg(`There is already a template named ${name}`, 'warning'); return alts.querySelector('.ask input').focus(); }
        if (doing === 'rename') keepTemplates(T.rename(c.templates, c.template, name), name);
        else { keepTemplates(T.save(c.templates, name, ch), name); logseq.UI.showMsg(`Saved the template ${name}`); }
      }
      endAsk(); closePops(); describe();
    }
    function doTemplate(doing) {
      const alts = tpl().querySelector('.lk-alts');
      if (doing === 'save') { keepTemplates(T.save(c.templates, c.template, choice()), c.template); logseq.UI.showMsg(`Saved the changes to ${c.template}`); closePops(); describe(); }
      else if (doing === 'new' || doing === 'rename') askName(doing);
      else if (doing === 'delete') {
        alts.dataset.ask = 'delete';
        alts.insertAdjacentHTML('beforeend', `<span class="ask">${esc(T.BUILT_IN[c.template] ? `Drop your changes to ${c.template}?` : `Delete the template ${c.template}?`)}<b data-ask="ok">${T.BUILT_IN[c.template] ? 'Drop them' : 'Delete'}</b><b data-ask="no">Keep</b></span>`);
        }
    }
    // What the toolbar shows for the destination, and the words in its panels' buttons.
    const describe = () => {
      const ch = choice();
      q('[data-pick=xp-layout] .lk-value').title = D.layouts.find(l => l.key === ch.layout)?.about || '';
      q('[data-pick=xp-look] .lk-value').title = themes.look(ch.look).about;
      // What belongs to another destination, or to another style, is not shown.
      for (const el of root.querySelectorAll('[data-for]')) el.hidden = !el.dataset.for.split(' ').includes(ch.target);
      for (const el of root.querySelectorAll('[data-when]')) el.hidden = !(el.dataset.when === 'prose' ? ch.layout === 'prose' : D.dated(ch.layout));
      syncValues(); drawTemplates(ch);
    };
    // The preview's frame takes the shape of what it will hold: sheets side by side for a PDF, one page's width otherwise.
    const shape = (f, ch) => {
      const paged = ch.target === 'pdf';
      f.className = paged ? 'sheets' : '';
      f.style.width = paged ? `${E.preview.sizes({ paper: ch.paper, margins: themes.MARGINS[ch.margins] }).width + 40}px` : ch.paper === 'Letter' && ch.target === 'rich' ? '816px' : '794px';
    };
    // The preview: the page at its printed width, or the Markdown as text; it can be changed, and the change goes into the export.
    let frame = q('.xp-desk iframe');
    const win = hostDoc.defaultView;
    // The preview's size on screen: the sheet at its true size (100%), larger, or shrunk to the window when it is narrower.
    const zoomIt = () => {
      const z = q('.xp-zoom').value, desk = q('.xp-desk').clientWidth - 48, w = parseFloat(frame.style.width) || 794;
      frame.style.zoom = z === 'fit' ? String(Math.min(1, desk / w)) : String(Number(z) / 100);
      frame.style.maxWidth = 'none';
    };
    const fit = () => { try { frame.style.height = Math.max(600, frame.contentDocument.documentElement.scrollHeight + 2) + 'px'; } catch (error) { /* keeps its height */ } zoomIt(); };
    const offResize = E.base.listen(win, 'resize', zoomIt);
    const sheetOpts = ch => ({ paper: ch.paper, margins: themes.MARGINS[ch.margins], footer: ch.footer, pageNumbers: ch.pageNumbers });
    let timer = null, run = 0, edited = null, drawn = null;
    // What decides the words on the sheet. Anything else (the look, the paper, the footer) leaves words changed in the preview where they are.
    const wordsOf = ch => JSON.stringify([ch.target === 'md', ch.layout, ch.prose, ch.tags, ch.tasks, ch.links, ch.frontMatter, [...(ch.shownHead || [])], [...(ch.shownNodes || [])], ch.dated, ch.kicker, ch.subtitle, ch.preparedBy, ch.titleDate]);
    const refresh = () => {
      describe();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const n = ++run, ch = choice();
        try {
          const md = ch.target === 'md';
          const same = drawn === wordsOf(ch), kept = same && edited ? edited() : null;
          const html = md ? `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:60px 72px;background:#fff;color:#111}pre{margin:0;font:13px/1.55 Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;outline:none}</style></head><body><pre contenteditable="true" spellcheck="false">${esc(kept ?? E.app.markdown(doc, ch))}</pre></body></html>`
            : await E.app.pageHtml(doc, ch, { extraCss: 'body:focus { outline: none; }', body: kept });
          if (n !== run) return;
          if (edited && !same) logseq.UI.showMsg('The sheet was drawn again from the page, so the words changed in it went', 'warning');
          /* The new preview is drawn in a frame of its own, unseen, and takes the old one's place once it is laid out (13 November
             2026): written into the frame on screen, the sheet stood empty for a frame or two on every change of target, look or
             paper (recorded: blank at 194 ms in about half the changes from Markdown to PDF). */
          const next = hostDoc.createElement('iframe'); next.title = 'Preview';
          shape(next, ch);
          next.style.position = 'absolute'; next.style.visibility = 'hidden'; next.style.pointerEvents = 'none';
          frame.after(next);
          const swap = () => { if (!next.isConnected) return; if (n !== run) { next.remove(); return; } const old = frame; frame = next; next.style.position = ''; next.style.visibility = ''; next.style.pointerEvents = ''; if (old !== next) old.remove(); };
          next.srcdoc = html;
          edited = kept == null ? null : () => kept;
          drawn = wordsOf(ch);
          next.onload = async () => { try {
            const d = next.contentDocument, sheets = ch.target === 'pdf';
            if (!md) { d.body.contentEditable = 'true'; d.body.spellcheck = false; }
            let again = null;
            d.addEventListener('input', () => {
              edited = md ? () => d.querySelector('pre')?.textContent ?? null : sheets ? () => E.preview.gather(d).innerHTML || null : () => d.querySelector('.x-doc')?.innerHTML || null;
              if (sheets) { clearTimeout(again); again = setTimeout(() => { if (n === run) { E.preview.repaginate(d, sheetOpts(ch)); fit(); } }, 600); }   // the sheets dealt again once typing pauses
              fit();
            });
            d.addEventListener('keydown', onKey, true);
            d.addEventListener('click', () => closePops());
            drawParts(d, ch);
            if (sheets) { await E.print.settle(d); if (n !== run) { next.remove(); return; } E.preview.paginate(d, sheetOpts(ch)); }   // pictures first, so their height is known
            swap(); fit(); setTimeout(fit, 300);
          } catch (error) { console.warn('DB Export: preview sheets', error); swap(); fit(); } };
        } catch (error) { console.warn('DB Export: preview', error); }
      }, 150);
    };
    // The parts the sheet in the preview holds, as words; pointed at, a part lights on the sheet; pressed, its rule goes into the box.
    function drawParts(d, ch) {
      const line = q('.xp-parts');
      line.innerHTML = themes.PARTS.filter(([part]) => d.querySelector(`.x-${part}`)).map(([part, name]) => `<span data-part="${part}">${esc(name)}</span>`).join('');
      line.dataset.look = ch.look;
    }
    const light = part => { try { E.preview.light(frame.contentDocument, part); } catch (error) { /* no preview yet */ } };
    root.addEventListener('mouseover', event => { const part = event.target.closest('.xp-parts span'); light(part ? part.dataset.part : null); });
    q('.xp-parts').addEventListener('mouseleave', () => light(null));   // the pointer may leave straight onto the sheet, which is another document
    root.addEventListener('click', event => {
      const part = event.target.closest('.xp-parts span'); if (!part) return;
      const box = q('.xp-cssbox'), ch = choice(), at = box.value.indexOf(`.x-${part.dataset.part} {`);
      if (at < 0) { box.value = (box.value.trim() ? box.value.replace(/\s*$/, '\n\n') : '') + themes.ruleText(ch.look, part.dataset.part, { size: ch.size }) + '\n'; }
      const start = box.value.indexOf(`.x-${part.dataset.part} {`), end = box.value.indexOf('}', start) + 1;
      box.focus(); box.setSelectionRange(start, end);
      box.scrollTop = Math.max(0, (box.value.slice(0, start).split('\n').length - 1) * parseFloat(hostDoc.defaultView.getComputedStyle(box).lineHeight || '18'));   // the rule's first line at the box's top
      if (at < 0) refresh();
    });
    // Unfolding: one pick open at a time, its alternatives a line of words under its row (the template's a pop-up under the bar); folded by a press elsewhere or Escape.
    const openOnes = () => [...root.querySelectorAll('.it.open')];
    const closePops = keep => {
      if (keep !== tpl() && tpl().querySelector('.lk-alts').dataset.ask) { endAsk(); drawTemplates(choice()); }
      for (const it of openOnes()) { it.classList.remove('open'); it.querySelector('.lk-alts')?.setAttribute('hidden', ''); it.style.marginBottom = ''; }
    };
    const unfold = it => {
      const was = it.classList.contains('open'); closePops(); if (was) return;
      it.classList.add('open');
      const a = it.querySelector('.lk-alts'); a.hidden = false;
      if (it.closest('.xp-note')) it.style.marginBottom = `${a.offsetHeight + 4}px`;   // over the desk the line takes its room below; in the column it is part of the row, and the template's floats
    };
    // Adjust: the column of choices beside the sheet, shown or put away; remembered.
    q('.xp-adjust').addEventListener('click', () => {
      const side = q('.xp-side'), open = side.hidden;
      side.hidden = !open; q('.xp-adjust').classList.toggle('on', open); q('.xp-adjust').setAttribute('aria-pressed', String(open));
      c = { ...c, sideOpen: open }; try { logseq.updateSettings({ sideOpen: open }); } catch (error) { /* not remembered */ }
      closePops(); zoomIt();
    });
    root.addEventListener('click', event => {
      const asked = event.target.closest('.xp-tpl [data-ask]'); if (asked && asked.tagName === 'B') { answer(asked.dataset.ask === 'ok'); return; }
      if (event.target.closest('.xp-tpl .ask')) return;
      const act = event.target.closest('.xp-tpl [data-do]'); if (act) { doTemplate(act.dataset.do); return; }
      const named = event.target.closest('.xp-tpl .lk-alts span[data-v]'); if (named) { takeTemplate(named.dataset.v); return; }
      const alt = event.target.closest('[data-pick] .lk-alts span');
      if (alt) { const it = alt.closest('[data-pick]'), sel = it.querySelector('select'); sel.value = alt.dataset.v; closePops(it); sel.dispatchEvent(new (hostDoc.defaultView.Event)('change', { bubbles: true })); return; }
      const v = event.target.closest('.it[data-pick] > .lk-value'); if (v) { unfold(v.parentNode); return; }
      if (!event.target.closest('.it.open')) closePops();
    });
    root.addEventListener('input', event => { if (!event.target.closest('.xp-zoom, .xp-tpl')) refresh(); });
    root.addEventListener('change', event => { if (event.target.closest('.xp-zoom')) { syncValues(); remember(choice(), doc.title); zoomIt(); } else refresh(); });
    root.addEventListener('click', event => { const all = event.target.closest('[data-all]'); if (all) { boxes(all.dataset.role).forEach(b => { b.checked = all.dataset.all === '1'; }); refresh(); } });
    refresh();
    let finished = false, offKey = () => {};
    const close = () => { if (finished) return; finished = true; offKey(); offResize(); root.remove(); resolve(); };
    const go = async action => {
      if (finished) return;
      const ch = choice();
      remember(ch, doc.title);
      if (action === 'pdf') root.hidden = true;   // the print window takes its place
      let done = false;
      try { done = await act(ch, action, edited ? edited() : null) !== false; } catch (error) { console.error(error); logseq.UI.showMsg(`Export stopped: ${window.PluginDoor.reason(error, 'the page could not be written out. Nothing in the graph was changed')}`, 'error'); }
      if (done) close(); else root.hidden = false;   // cancelled: the window stays, with what was chosen and written
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (openOnes().length) { closePops(); return; } close(); }
      else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.stopPropagation(); go(target()); }
    };
    offKey = E.base.listen(hostDoc, 'keydown', onKey, true);
    root.addEventListener('click', event => {
      if (event.target.closest('.xp-cancel')) close();
      const b = event.target.closest('[data-act]'); if (b) go(b.dataset.act);
    });
    setTimeout(() => q(`.xp-bar button.lk-accent[data-for=${target()}]`)?.focus(), 50);
  });
}
E.ui = { open, read, withTemplate, sweep, host, kindIconHtml, CSS, TARGETS };
})();
