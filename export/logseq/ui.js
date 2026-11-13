/* The export window: a quiet bar over the page on a desk, and a column of choices beside the sheet. It is drawn into Logseq's
   own document, not the plugin's frame (as Threads draws), so the plugin's stylesheet reaches it: the window is built from the
   visual grammar's shared names (lk-row, lk-list, lk-tick, lk-prop, lk-count, and the Pressing set, lk-name, lk-value, lk-pick,
   lk-alts, lk-view, lk-pop, lk-accent, lk-close). The owner, 12 November 2026: rows unfolding under the bar read as a "toolbar
   jammed underneath toolbar"; they chose a quiet bar with the choices in a column on the left, and tabs that look like tabs.
   The bar: Adjust (shows the column or puts it away, remembered), where the export goes as tabs (lk-view, a bar under the one
   in force), the template (a pick whose alternatives are a pop-up; last on the left, since its words change length and nothing
   stands after it to be pushed), and at the right end the one accent that does the export,
   then ×. The column is the library's menu laid open (the owner, 13 November 2026: the first column "has no structure, doesn't
   pull from library ui elements"): parts under a heading in the text colour with a hairline between them (lk-group), each row one
   line pressed as a whole (lk-item), what it holds at its right in the quiet grey (lk-note). A row that holds one of several
   brings them as a pop-up menu at the row, over the rows below, the one in force ticked; a row that is on or off shows a tick while on; a row that is written in has
   the library's field at its right. Up and Down walk the rows. Every part and row keeps its place: what belongs to another style or destination is faint and out of reach, never taken away, so the column does not move. The page is drawn at its printed width on the desk, with only the size pick at the desk's right, and
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
/* A choice that stays open (where the export goes): the library's alternatives (lk-alts), the one in force (on) in the text colour. */
.xp-where { display: flex; --lk-view-pad: 0px; }   /* the space between its words is the library's, as every tab row's */
.xp-where > * { position: relative; cursor: pointer; white-space: nowrap; }
.xp-where input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.xp-where label:has(:focus-visible) { background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
/* The column of choices beside the sheet, on its left: the library's menu laid open. Its looks are the library's (lk-group,
   lk-item, lk-note, lk-field, lk-list, lk-tick); here only where things stand: the rows' words on the bar's left edge, a long
   name on two lines, what unfolds under a row a step in. */
.xp-body { flex: 1; display: flex; min-height: 0; }
.xp-side { flex: none; width: 320px; overflow-y: auto; scrollbar-width: thin; padding: 0 12px 28px 20px; background: var(--lk-paper, #fff); border-right: 1px solid var(--lk-hair); }
.xp-side[hidden], .xp-side [hidden] { display: none !important; }
.xp-side [inert] { opacity: .4; }
.xp-side [inert] [inert] { opacity: 1; }   /* a faint row in a faint part is not made fainter twice */   /* a part or a row of another style or destination: in its place, faint */
.xp-side .xp-group:first-child > .gap { display: none; }
.xp-side .xp-group:first-child > .lk-group { border-top: 0; margin-top: 0; padding-top: 6px; }
.xp-side .xp-group > .gap { height: 20px; }
.xp-side .lk-group { padding-bottom: 5px; }
.xp-side .lk-item { white-space: normal; align-items: baseline; }
.xp-side .lk-item > :first-child { min-width: 0; }
.xp-side .lk-item > .lk-note { flex: none; }
/* What a row can become: the library's pop-up menu at the row, under its value, over the rows below, so nothing in the column
   moves (the owner, 13 November 2026, of choices that unfolded in the column: "pushes everything down"); over the row instead
   where there is no room under it. */
.xp-side .xp-pickrow { position: relative; }
.xp-side .xp-opts { position: absolute; right: 0; top: 100%; z-index: 6; min-width: 190px; max-width: 100%; margin-top: 2px; }
.xp-side .xp-opts.up { top: auto; bottom: 100%; margin: 0 0 2px; }
.xp-side .xp-sw.xp-off .xp-on { visibility: hidden; }
.xp-side .xp-sw:focus-visible { outline: none; background: var(--lk-wash); }
.xp-side .xp-fieldrow { cursor: text; }
.xp-side .xp-fieldrow input.lk-field { flex: 0 1 10em; width: 10em; min-width: 3em; text-align: right; }
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
.xp-lists { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.xp-plhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0 8px; }
.xp-side .xp-list { padding: 0 8px; }
.xp-all { margin: 0 -8px 0 0; }
.xp-list { display: grid; grid-template-columns: 1fr; gap: 0 18px; margin-top: 2px; }
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
.xp-side .xp-cssbox { display: block; font-family: Menlo, Consolas, monospace; font-size: var(--lk-small); line-height: 1.5; width: calc(100% - 16px); margin: 4px 8px 0; height: 9.5em; resize: vertical; white-space: pre; border: 1px solid var(--lk-line); border-radius: 4px; padding: 6px 8px; }
.xp-side .xp-partshead { padding: 10px 8px 4px; }
.xp-side .xp-parts { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 0 8px; }
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
    const lists = [['head', doc.kind === 'blocks' ? (doc.nodes.length > 1 ? 'Properties of the blocks chosen' : 'Properties of the block chosen') : 'Properties of the page', D.propertiesIn(doc, 'head'), c.hiddenHead], ['nodes', doc.kind === 'blocks' ? 'Properties of those under' : 'Properties of the nodes', D.propertiesIn(doc, 'nodes'), c.hiddenNodes]].filter(l => l[2].length);
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
    /* The column is the library's menu laid open (lk-group, lk-item, lk-note, as the Outline tab's menu and the settings window's
       list): a part is a heading in the text colour, a step heavier, with a hairline over every part after the first; a row is one
       line pressed as a whole, its name at the left and what it holds at the right in the quiet grey. Three kinds of row: one that
       holds one of several (pressed, the several come as the library's pop-up menu at the row, the one in force ticked), one that is on or off (a tick while on),
       and one that is written in (the library's field at its right). */
    const rowPick = (cls, name, items, chosen) => `<div class="xp-pickrow" data-row="${cls}"><button type="button" class="lk-item xp-rowhead" aria-expanded="false"><span>${esc(name)}</span><span class="lk-note xp-val">${esc((items.find(([k]) => k === chosen) || items[0])[1])}</span></button><select class="${cls}" hidden>${items.map(([k, n]) => `<option value="${esc(k)}" ${k === chosen ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><div class="xp-opts lk-pop lk-menu" role="menu" aria-label="${esc(name)}" hidden>${items.map(([k, n]) => `<button type="button" class="lk-item xp-opt" data-v="${esc(k)}"><span>${esc(n)}</span><span class="lk-note${k === chosen ? ' lk-check' : ''}" aria-hidden="true"></span></button>`).join('')}</div></div>`;
    const rowSwitch = (cls, name, on) => `<label class="lk-item xp-sw${on ? '' : ' xp-off'}" tabindex="0" role="checkbox" aria-checked="${!!on}"><span>${esc(name)}</span><span class="lk-note xp-on lk-check" aria-hidden="true"></span><input type="checkbox" class="${cls}" ${on ? 'checked' : ''} hidden></label>`;
    const rowField = (cls, name, value, placeholder) => `<label class="lk-item xp-fieldrow"><span>${esc(name)}</span><input type="text" class="lk-field ${cls}" placeholder="${esc(placeholder)}" value="${esc(value)}"></label>`;
    const rowList = (role, label, ps, hidden) => `<div class="xp-plist"><div class="xp-plhead"><span class="lk-note">${esc(label)}</span><span class="xp-all lk-bar" data-role="${role}"><a class="lk-btn lk-low" data-all="1" data-role="${role}">all</a><a class="lk-btn lk-low" data-all="0" data-role="${role}">none</a></span></div>
      <div class="xp-list lk-list" data-role="${role}">${ps.map(p => `<label class="xp-prop lk-row"><input type="checkbox" class="lk-tick" value="${esc(p.ident)}" ${hidden.has(p.ident) ? '' : 'checked'}><span class="lk-prop">${kindIconHtml(p.type)}<span>${esc(p.name)}</span></span><span class="lk-count">${p.count}</span></label>`).join('')}</div></div>`;
    const group = (name, body, fors = '', when = '') => `<div class="xp-group" role="group" aria-label="${esc(name)}" ${fors ? `data-for="${fors}"` : ''} ${when ? `data-when="${when}"` : ''}><div class="lk-item gap"></div><div class="lk-group">${esc(name)}</div>${body}</div>`;
    const only = (html, fors) => html.replace(/^<(\w+) /, `<$1 data-for="${fors}" `);
    root.innerHTML = `<div class="xp-titlebar" style="height:${dragBand(hostDoc)}px">Export ${esc(what)}</div>
    <div class="xp-bar" role="toolbar" aria-label="Export">
      <div class="g"><div class="it">${nm('')}<button type="button" class="lk-btn xp-adjust${c.sideOpen ? ' on' : ''}" aria-pressed="${c.sideOpen}" title="Every choice, in a column beside the sheet">Adjust</button></div></div>
      <div class="g">${where(TARGETS, c.target)}</div>
      <div class="g"><div class="it lk-pick xp-tpl" data-pick="xp-template">${nm('template')}<button type="button" class="lk-value" title="A named set of every choice here">${CHEV}</button><select class="xp-template" hidden></select><div class="lk-alts lk-pop" hidden></div></div></div>
      <div class="g end"><button type="button" class="lk-btn lk-i-save" data-act="md-file" data-for="md">Save as file…</button>
        <button type="button" data-act="md" data-for="md" class="lk-accent lk-i-copy xp-main">Copy Markdown<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="rich" data-for="rich" class="lk-accent lk-i-copy xp-main">Copy rich text<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="pdf" data-for="pdf" class="lk-accent lk-i-save xp-main">Save PDF…<kbd>Cmd Enter</kbd></button>
        <button type="button" class="lk-close xp-cancel" aria-label="Close" title="Close (Esc)">×</button></div>
    </div>
    <div class="xp-body">
    <div class="xp-side" ${c.sideOpen ? '' : 'hidden'}>
    ${group('Text', rowPick('xp-layout', 'Style', D.layouts.map(l => [l.key, l.name]), c.layout))}
    ${group('Prose', `${rowPick('xp-kids', 'Bullets under a line', KIDS, c.prose.children) + rowSwitch('xp-numbered', 'Numbered headings', c.prose.numbered)
      + rowSwitch('xp-runin', 'Headings under a # lead their line', c.prose.runIn)
      + only(rowSwitch('xp-contents', 'Contents list', c.prose.contents), 'pdf rich')
      + only(rowSwitch('xp-titlesheet', 'Title on its own sheet', c.prose.titleSheet), 'pdf')
      + only(rowSwitch('xp-sectionsheets', 'Each # on a new sheet', c.prose.sectionSheets), 'pdf')
      + rowField('xp-noteshead', 'Notes heading', c.prose.notesHead, 'None')}`, '', 'prose')}
    ${group('Timeline and Calendar', rowPick('xp-datekey', 'Date from', [['auto', 'Automatic'], ...dates.map(d => [d.key, d.name])], c.dated.dateKey)
      + rowPick('xp-under', 'Under the date', [['', 'Nothing'], ...props.filter(p => p.type !== 'date' && p.type !== 'datetime').map(p => [p.ident, p.name])], c.dated.under)
      + rowSwitch('xp-newest', 'Newest first', c.dated.newestFirst), '', 'dated')}
    ${group('Look', rowPick('xp-look', 'Type', themes.looks.map(l => [l.key, l.name]), c.look) + rowPick('xp-size', 'Text size', SIZES, c.size)
      + only(rowPick('xp-paper', 'Paper', [['A4', 'A4'], ['Letter', 'Letter']], c.paper), 'pdf') + only(rowPick('xp-margins', 'Margins', MARGINS, c.margins), 'pdf')
      + only(rowSwitch('xp-pagenumbers', 'Page numbers', c.pageNumbers), 'pdf') + only(rowField('xp-footer', 'Footer', c.footer, 'None'), 'pdf'), 'pdf rich')}
    ${doc.title ? group('Title', rowSwitch('xp-titledate', 'Today’s date', c.titleDate) + rowField('xp-kicker', 'Line above', lines.kicker || '', 'None') + rowField('xp-subtitle', 'Subtitle', lines.subtitle || '', 'None')
      + rowField('xp-by', 'Prepared by', c.preparedBy, 'None')) : ''}
    ${group('Markdown', rowPick('xp-links', 'Links', LINKS, c.links) + rowSwitch('xp-frontmatter', 'Front matter', c.frontMatter), 'md')}
    ${group('Show', rowSwitch('xp-tags', 'Tags', c.tags) + rowSwitch('xp-tasks', 'Task boxes', c.tasks) + (lists.length ? `<div class="xp-lists">${lists.map(l => rowList(...l)).join('')}</div>` : ''))}
    ${group('Your CSS', `<textarea class="xp-cssbox lk-field" spellcheck="false" aria-label="Rules of your own, added after the look’s" placeholder=".x-title { letter-spacing: 0.02em; }">${esc(c.customCss)}</textarea>
      <div class="xp-partshead lk-note">Point at a part to see it on the sheet. Press it to write its rule.</div><div class="xp-parts lk-alts"></div>`, 'pdf rich')}
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
      for (const row of root.querySelectorAll('.xp-pickrow')) { const sel = row.querySelector('select'); row.querySelector('.xp-val').textContent = sel.selectedOptions[0]?.textContent || ''; for (const o of row.querySelectorAll('.xp-opt')) o.lastElementChild.classList.toggle('lk-check', o.dataset.v === sel.value); }
      for (const row of root.querySelectorAll('.xp-sw')) { const on = row.querySelector('input').checked; row.classList.toggle('xp-off', !on); row.setAttribute('aria-checked', String(on)); }
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
      q('[data-row=xp-layout] .xp-rowhead').title = D.layouts.find(l => l.key === ch.layout)?.about || '';
      q('[data-row=xp-look] .xp-rowhead').title = themes.look(ch.look).about;
      // What belongs to another destination, or to another style, is not shown.
      /* What belongs to another destination or another style. On the bar it is not shown. In the column it keeps its place and
         goes faint, out of reach of the pointer and the keys (inert), so no row moves when a style or a destination is taken
         (the owner, 13 November 2026: "the sidebar just jumps based on menu selection. it should be anchored"). */
      const fits = el => (!el.dataset.for || el.dataset.for.split(' ').includes(ch.target)) && (!el.dataset.when || (el.dataset.when === 'prose' ? ch.layout === 'prose' : D.dated(ch.layout)));
      for (const el of root.querySelectorAll('[data-for], [data-when]')) { if (el.closest('.xp-side')) el.inert = !fits(el); else el.hidden = !fits(el); }
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
    // A value taken from a list of the window's own is told to the select that stands behind it, so one "change" redraws the sheet.
    const told = sel => sel.dispatchEvent(new (hostDoc.defaultView.Event)('change', { bubbles: true }));
    // Unfolding: one pick open at a time, its alternatives a line of words under its row (the template's a pop-up under the bar); folded by a press elsewhere or Escape.
    const openOnes = () => [...root.querySelectorAll('.it.open, .xp-pickrow.open')];
    const closePops = keep => {
      if (keep !== tpl() && tpl().querySelector('.lk-alts').dataset.ask) { endAsk(); drawTemplates(choice()); }
      for (const it of openOnes()) { it.classList.remove('open'); it.querySelector('.lk-alts, .xp-opts')?.setAttribute('hidden', ''); it.style.marginBottom = ''; const head = it.querySelector('.xp-rowhead'); if (head) { head.classList.remove('on'); head.setAttribute('aria-expanded', 'false'); } }
    };
    const unfold = it => {
      const was = it.classList.contains('open'); closePops(); if (was) return;
      it.classList.add('open');
      const a = it.querySelector('.lk-alts'); a.hidden = false;
      if (it.closest('.xp-note')) it.style.marginBottom = `${a.offsetHeight + 4}px`;   // over the desk the line takes its room below; in the column it is part of the row, and the template's floats
    };
    // Keys in the column, as in a menu: Up and Down walk its rows, Enter or Space turns a row that is on or off (a button takes them by itself).
    q('.xp-side').addEventListener('keydown', event => {
      const row = event.target.closest?.('.xp-rowhead, .xp-opt, .xp-sw');
      if (!row) return;
      if ((event.key === 'Enter' || event.key === ' ') && row.classList.contains('xp-sw') && !event.metaKey && !event.ctrlKey) { event.preventDefault(); const box = row.querySelector('input'); box.checked = !box.checked; told(box); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const rows = [...q('.xp-side').querySelectorAll('.xp-rowhead, .xp-opt, .xp-sw, .xp-fieldrow input')].filter(el => !el.closest('[hidden], [inert]'));
      const next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) { event.preventDefault(); next.focus(); }
    });
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
      // The column: a row that holds one of several unfolds them under it; one of them pressed is taken, and the row folds.
      const head = event.target.closest('.xp-rowhead');
      if (head) { const row = head.parentNode, was = row.classList.contains('open'); closePops(); if (!was) { row.classList.add('open'); head.classList.add('on'); head.setAttribute('aria-expanded', 'true'); const menu = row.querySelector('.xp-opts'); menu.classList.remove('up'); menu.hidden = false; menu.classList.toggle('up', menu.getBoundingClientRect().bottom > q('.xp-side').getBoundingClientRect().bottom - 4); } return; }
      const opt = event.target.closest('.xp-opt');
      if (opt) { const row = opt.closest('.xp-pickrow'), sel = row.querySelector('select'); sel.value = opt.dataset.v; closePops(); row.querySelector('.xp-rowhead').focus(); told(sel); return; }
      const alt = event.target.closest('[data-pick] .lk-alts span');
      if (alt) { const it = alt.closest('[data-pick]'), sel = it.querySelector('select'); sel.value = alt.dataset.v; closePops(it); told(sel); return; }
      const v = event.target.closest('.it[data-pick] > .lk-value'); if (v) { unfold(v.parentNode); return; }
      if (!event.target.closest('.it.open, .xp-pickrow.open')) closePops();
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
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (openOnes().length) { const back = hostDoc.activeElement?.closest?.('.xp-pickrow')?.querySelector('.xp-rowhead'); closePops(); back?.focus(); return; } close(); }
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
