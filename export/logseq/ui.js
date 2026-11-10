/* The export window: a toolbar over the document, like a page on a desk. It is drawn into Logseq's own document, not the
   plugin's frame (as Threads draws), so the Look plugin's stylesheet reaches it: the window is built from the visual
   grammar's shared names (look/README.md: lk-row, lk-list, lk-tick, lk-prop, lk-count, and the Pressing set,
   lk-name, lk-value, lk-pick, lk-alts, lk-accent, lk-close) and carries only a plain look of its own for them; switch Look
   off and it still works. The toolbar is a row of controls on the Pressing rule (buttons-mockup.html beside the plugins):
   each is a small faint name over a value in the text colour, and the value is the thing pressed. A value that unfolds
   (a pick) wears a faint chevron after it and a hairline standing before it; a switch reads its state as words; a field
   is faint until written. Pressed, a pick shows what it can become as a line of words under the row, from its own left
   edge, so nothing moves sideways; a panel (Page, Title block, Dates, Show) unfolds its own controls in a row under the
   bar, and stays folded until pressed. The destination's three words stay unfolded at the left; the one accent, the
   button that does the export, stands at the right end, and × is the way out. The page is drawn beneath at its printed
   width on a desk, with only the size pick at the desk's right, and redrawn as the choices change, or the Markdown as
   text. Every choice is remembered in the plugin's settings. */
(function () {
const E = (window.DbExport ||= {});
const { inline, doc: D, themes } = E;
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
.xp-bar .g.end { margin-left: auto; gap: 26px; padding-top: 15px; }
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
.xp-where { display: flex; gap: 14px; }
.xp-where > * { position: relative; cursor: pointer; white-space: nowrap; }
.xp-where input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.xp-where label:has(:focus-visible) { background: var(--lk-wash); box-shadow: 0 0 0 3px var(--lk-wash); border-radius: 1em; }
/* A panel's own controls, unfolded in a row under the bar; a pick whose panel is open shows it by its value going quiet. */
.xp-fold { flex: none; padding: 0 28px 16px; background: var(--lk-paper, #fff); }
.xp-fold[hidden] { display: none; }
.xp-fold .row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px 0; }
.xp .it.open > .lk-value { color: var(--lk-quiet); }
/* The lists of properties to pick from, inside Show: each headed by a named value, whose they are over all / none as a
   small lk-bar, its first word under the name; then one column, a row per property, its tick box at the left (lk-tick: Look
   shows them when the pointer is on the list), the icon of what it holds, its name, the count (lk-count: never shown where
   Look runs). A list longer than ten takes two columns. The gap tells the two lists apart. */
.xp-lists { display: flex; gap: 44px; flex-wrap: wrap; margin-top: 14px; }
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
.xp-desk { flex: 1; overflow: auto; padding: 26px 24px 48px; }
.xp-desk iframe { display: block; margin: 0 auto; width: 794px; max-width: 100%; height: 600px; border: 0; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22); }
.xp-desk iframe.sheets { background: transparent; box-shadow: none; }
/* Over the desk, at its right, alone: how large the sheets are drawn. */
.xp-note { display: flex; justify-content: flex-end; align-items: center; font-size: var(--lk-small); padding: 0 0 12px; }
.xp-note .it { padding: 0; } .xp-note .lk-name { display: none; } .xp-note .lk-value { color: var(--lk-quiet); }
.xp-note .lk-alts { left: auto; right: 0; justify-content: flex-end; }`;

// The icon of what a property holds, before its name: the door's.
const kindIconHtml = type => `<span class="xp-kind">${window.PluginDoor.kindIconHtml(type || 'default')}</span>`;

const TARGETS = [{ key: 'pdf', name: 'PDF' }, { key: 'md', name: 'Markdown' }, { key: 'rich', name: 'Rich text' }];
const SIZES = [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], MARGINS = [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']];
const LINKS = [['plain', 'Links as words'], ['wiki', '[[Wikilinks]]'], ['file', 'Links to .md files']];
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
    titleLines: s.titleLines && typeof s.titleLines === 'object' ? s.titleLines : {} };
}
function remember(c, title) {
  const titleLines = { ...c.titleLines };
  if (title) titleLines[title] = { kicker: c.kicker || '', subtitle: c.subtitle || '' };
  const now = { target: c.target, layout: c.layout, look: c.look, paper: c.paper, margins: c.margins, size: c.size, footer: c.footer, pageNumbers: c.pageNumbers, showTags: c.tags, taskBoxes: c.tasks,
    titleDate: c.titleDate, preparedBy: c.preparedBy, mdLinks: c.links, frontMatter: c.frontMatter, previewZoom: c.zoom, hiddenHeadProperties: [...c.hiddenHead], hiddenNodeProperties: [...c.hiddenNodes], dated: c.dated, titleLines };
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
    const c = read();
    const props = D.propertiesIn(doc);
    const lists = [['head', doc.kind === 'blocks' ? (doc.nodes.length > 1 ? 'of the blocks chosen' : 'of the block chosen') : 'of the page', D.propertiesIn(doc, 'head'), c.hiddenHead], ['nodes', doc.kind === 'blocks' ? 'of those under' : 'of the nodes', D.propertiesIn(doc, 'nodes'), c.hiddenNodes]].filter(l => l[2].length);
    const dates = D.dateChoices(doc);
    const lines = doc.title ? (c.titleLines[doc.title] || {}) : {};
    const root = hostDoc.createElement('div');
    root.className = 'xp';
    const CHEV = '<svg class="m" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3l2.5 2.5L6.5 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
    const nm = name => `<div class="lk-name">${esc(name)}</div>`;
    // Where the export goes: a choice that stays open.
    const where = (items, chosen) => `<div class="it lk-choice">${nm('export as')}<div class="xp-where lk-alts" role="radiogroup" aria-label="Export as">${items.map(i => `<label><input type="radio" name="xp-target" value="${i.key}" ${i.key === chosen ? 'checked' : ''}>${esc(i.name)}</label>`).join('')}</div></div>`;
    // A pick: the name, the value with the chevron, the select it stands for (hidden), and what it can become, unfolded under it when pressed.
    const pick = (cls, name, items, chosen, title = '') => `<div class="it lk-pick" data-pick="${cls}">${nm(name)}<button type="button" class="lk-value" ${title ? `title="${esc(title)}"` : ''}>${esc((items.find(([k]) => k === chosen) || items[0])[1])}${CHEV}</button><select class="${cls}" hidden>${items.map(([k, n]) => `<option value="${esc(k)}" ${k === chosen ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><div class="lk-alts" hidden>${items.map(([k, n]) => `<span data-v="${esc(k)}" class="${k === chosen ? 'on' : ''}">${esc(n)}</span>`).join('')}</div></div>`;
    // A panel: a pick whose value is its state in a few words (describe fills them) and whose unfolding is a row of its own controls under the bar.
    const panel = (cls, name, fors = '') => `<div class="it lk-pick ${cls}" data-panel="${cls}" ${fors ? `data-for="${fors}"` : ''}>${nm(name)}<button type="button" class="lk-value">${CHEV}</button></div>`;
    const fold = (cls, body, fors = '') => `<div class="xp-fold" data-panel="${cls}" ${fors ? `data-for="${fors}"` : ''} hidden><div class="row">${body}</div></div>`;
    // A switch: the name, and a value that reads the state; the box is hidden and the word turns it.
    const sw = (cls, name, on, offWord, onWord) => `<div class="it lk-switch">${nm(name)}<label class="lk-value ${on ? '' : 'off'}" data-on="${esc(onWord)}" data-off="${esc(offWord)}"><input type="checkbox" class="${cls}" ${on ? 'checked' : ''}>${esc(on ? onWord : offWord)}</label></div>`;
    // A field: the name, and a value faint until written.
    const field = (cls, name, value, placeholder) => `<div class="it xp-field">${nm(name)}<input type="text" class="lk-value ${cls}" placeholder="${esc(placeholder)}" value="${esc(value)}"></div>`;
    // A list of properties, headed by whose they are over all / none (a small bar); then the grammar's row, a tick box at the left, the icon of what it holds, the name, the count.
    const list = (role, label, ps, hidden) => `<div class="it">${nm(label)}<div class="xp-all lk-bar" data-role="${role}"><a class="lk-btn lk-i-tick" data-all="1" data-role="${role}">all</a><a class="lk-btn lk-i-x" data-all="0" data-role="${role}">none</a></div>
      <div class="xp-list lk-list${ps.length > 10 ? ' two' : ''}" data-role="${role}">${ps.map(p => `<label class="xp-prop lk-row"><input type="checkbox" class="lk-tick" value="${esc(p.ident)}" ${hidden.has(p.ident) ? '' : 'checked'}><span class="lk-prop">${kindIconHtml(p.type)}<span>${esc(p.name)}</span></span><span class="lk-count">${p.count}</span></label>`).join('')}</div></div>`;
    root.innerHTML = `<div class="xp-titlebar" style="height:${dragBand(hostDoc)}px">Export ${esc(what)}</div>
    <div class="xp-bar" role="toolbar" aria-label="Export">
      <div class="g">${where(TARGETS, c.target)}</div>
      <div class="g">${pick('xp-layout', 'style', D.layouts.map(l => [l.key, l.name]), c.layout)}${panel('xp-dates', 'dates')}</div>
      <div class="g" data-for="pdf rich">${pick('xp-look', 'look', themes.looks.map(l => [l.key, l.name]), c.look)}${panel('xp-page', 'page', 'pdf')}${doc.title ? panel('xp-title', 'title block') : ''}</div>
      <div class="g" data-for="md">${pick('xp-links', 'links', LINKS, c.links)}${sw('xp-frontmatter', 'front matter', c.frontMatter, 'No front matter', 'Front matter')}</div>
      <div class="g">${panel('xp-show', 'show')}</div>
      <div class="g end"><button type="button" class="lk-btn lk-i-save" data-act="md-file" data-for="md">Save as file…</button>
        <button type="button" data-act="md" data-for="md" class="lk-accent lk-i-copy xp-main">Copy Markdown<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="rich" data-for="rich" class="lk-accent lk-i-copy xp-main">Copy rich text<kbd>Cmd Enter</kbd></button>
        <button type="button" data-act="pdf" data-for="pdf" class="lk-accent lk-i-save xp-main">Save PDF…<kbd>Cmd Enter</kbd></button>
        <button type="button" class="lk-close xp-cancel" aria-label="Close" title="Close (Esc)">×</button></div>
    </div>
    ${fold('xp-dates', pick('xp-datekey', 'date from', [['auto', 'Automatic'], ...dates.map(d => [d.key, d.name])], c.dated.dateKey)
      + pick('xp-under', 'under the date', [['', 'Nothing'], ...props.filter(p => p.type !== 'date' && p.type !== 'datetime').map(p => [p.ident, p.name])], c.dated.under)
      + sw('xp-newest', 'order', c.dated.newestFirst, 'Oldest first', 'Newest first'))}
    ${fold('xp-page', pick('xp-paper', 'paper', [['A4', 'A4'], ['Letter', 'Letter']], c.paper) + pick('xp-margins', 'margins', MARGINS, c.margins) + pick('xp-size', 'text size', SIZES, c.size)
      + field('xp-footer', 'footer', c.footer, 'Footer') + sw('xp-pagenumbers', 'numbers', c.pageNumbers, 'No page numbers', 'Page numbers'), 'pdf')}
    ${doc.title ? fold('xp-title', field('xp-kicker', 'line above', lines.kicker || '', 'Line above') + field('xp-subtitle', 'subtitle', lines.subtitle || '', 'Subtitle')
      + field('xp-by', 'prepared by', c.preparedBy, 'Prepared by') + sw('xp-titledate', 'date', c.titleDate, 'No date', 'Today’s date')) : ''}
    ${fold('xp-show', sw('xp-tags', '', c.tags, 'No tags', 'Tags') + sw('xp-tasks', '', c.tasks, 'No task boxes', 'Task boxes') + (lists.length ? `<div class="xp-lists" style="flex-basis:100%">${lists.map(l => list(...l)).join('')}</div>` : ''))}
    <div class="xp-desk"><div class="xp-note">${pick('xp-zoom', 'size', ZOOMS, c.zoom, 'How large the preview is drawn')}</div><iframe title="Preview"></iframe></div>`;
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
      hiddenHead: hiddenNow('head', c.hiddenHead), hiddenNodes: hiddenNow('nodes', c.hiddenNodes),
      shownHead: boxes('head').length ? new Set(boxes('head').filter(b => b.checked).map(b => b.value)) : null, shownNodes: boxes('nodes').length ? new Set(boxes('nodes').filter(b => b.checked).map(b => b.value)) : null });
    // The words each control shows: a pick its chosen option (and which of its alternatives is in force), a switch its state.
    const syncValues = () => {
      for (const it of root.querySelectorAll('[data-pick]')) {
        const sel = it.querySelector('select'), v = it.querySelector('.lk-value'), text = sel.selectedOptions[0]?.textContent || '';
        if (v.firstChild?.nodeType === 3) v.firstChild.nodeValue = text; else v.insertBefore(hostDoc.createTextNode(text), v.firstChild);
        for (const a of it.querySelectorAll('.lk-alts span')) a.classList.toggle('on', a.dataset.v === sel.value);
      }
      for (const l of root.querySelectorAll('.xp-where label')) l.classList.toggle('on', l.querySelector('input').checked);
      for (const v of root.querySelectorAll('.lk-switch .lk-value')) { const on = v.querySelector('input').checked; v.classList.toggle('off', !on); v.lastChild.nodeValue = on ? v.dataset.on : v.dataset.off; }
      for (const h of root.querySelectorAll('.xp-all')) { const bs = boxes(h.dataset.role), on = bs.filter(b => b.checked).length; h.querySelector('[data-all="1"]').classList.toggle('on', on === bs.length); h.querySelector('[data-all="0"]').classList.toggle('on', on === 0); }
    };
    // What the toolbar shows for the destination, and the words in its panels' buttons.
    const describe = () => {
      const ch = choice();
      q('[data-pick=xp-layout] .lk-value').title = D.layouts.find(l => l.key === ch.layout)?.about || '';
      q('[data-pick=xp-look] .lk-value').title = themes.look(ch.look).about;
      // What belongs to another destination is hidden; a panel's row stays folded until its pick is pressed, and is never opened from here.
      for (const el of root.querySelectorAll('[data-for]')) { const fits = el.dataset.for.split(' ').includes(ch.target); if (el.classList.contains('xp-fold')) { if (!fits) el.hidden = true; } else el.hidden = !fits; }
      q('.xp-dates').hidden = !D.dated(ch.layout); if (q('.xp-dates').hidden) q('.xp-fold[data-panel=xp-dates]').hidden = true;
      syncValues();
      // Each panel's value: a few words for its state, the rest told inside the panel.
      const s = (sel, text) => { const el = q(sel); if (el) { if (el.firstChild?.nodeType === 3) el.firstChild.nodeValue = text; else el.insertBefore(hostDoc.createTextNode(text), el.firstChild); } };
      const pageMore = [ch.margins !== 'normal', ch.size !== 'normal', !!ch.footer, !ch.pageNumbers].filter(Boolean).length;
      s('.xp-page .lk-value', pageMore ? `${ch.paper}, ${pageMore === 1 ? 'one change' : 'changes'}` : ch.paper);
      s('.xp-title .lk-value', [ch.kicker && 'line above', ch.subtitle && 'subtitle', ch.preparedBy && 'prepared by', ch.titleDate && 'date'].filter(Boolean).join(', ') || 'plain');
      const count = (role, word) => { const all = boxes(role).length, on = boxes(role).filter(b => b.checked).length; return all && on !== all ? (on ? `some ${word}` : `no ${word}`) : ''; };
      s('.xp-show .lk-value', [!ch.tags && 'no tags', !ch.tasks && 'no boxes', count('head', doc.kind === 'blocks' ? 'block properties' : 'page properties'), count('nodes', 'node properties')].filter(Boolean).join(', ') || 'everything');
      s('.xp-dates .lk-value', [ch.dated.dateKey !== 'auto' && (dates.find(d => d.key === ch.dated.dateKey)?.name || ch.dated.dateKey), ch.dated.under && 'with a line under', ch.dated.newestFirst && 'newest first'].filter(Boolean).join(', ') || 'automatic');
      const f = q('.xp-desk iframe'), paged = ch.target === 'pdf';
      f.className = paged ? 'sheets' : '';
      f.style.width = paged ? `${E.preview.sizes({ paper: ch.paper, margins: themes.MARGINS[ch.margins] }).width + 40}px` : ch.paper === 'Letter' && ch.target === 'rich' ? '816px' : '794px';
    };
    // The preview: the page at its printed width, or the Markdown as text; it can be changed, and the change goes into the export.
    const frame = q('.xp-desk iframe');
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
    const wordsOf = ch => JSON.stringify([ch.target === 'md', ch.layout, ch.tags, ch.tasks, ch.links, ch.frontMatter, [...(ch.shownHead || [])], [...(ch.shownNodes || [])], ch.dated, ch.kicker, ch.subtitle, ch.preparedBy, ch.titleDate]);
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
          frame.srcdoc = html;
          edited = kept == null ? null : () => kept;
          drawn = wordsOf(ch);
          frame.onload = async () => { try {
            const d = frame.contentDocument, sheets = ch.target === 'pdf';
            if (!md) { d.body.contentEditable = 'true'; d.body.spellcheck = false; }
            let again = null;
            d.addEventListener('input', () => {
              edited = md ? () => d.querySelector('pre')?.textContent ?? null : sheets ? () => E.preview.gather(d).innerHTML || null : () => d.querySelector('.x-doc')?.innerHTML || null;
              if (sheets) { clearTimeout(again); again = setTimeout(() => { if (n === run) { E.preview.repaginate(d, sheetOpts(ch)); fit(); } }, 600); }   // the sheets dealt again once typing pauses
              fit();
            });
            d.addEventListener('keydown', onKey, true);
            d.addEventListener('click', () => closePops());
            if (sheets) { await E.print.settle(d); if (n !== run) return; E.preview.paginate(d, sheetOpts(ch)); }   // pictures first, so their height is known
            fit(); setTimeout(fit, 300);
          } catch (error) { console.warn('DB Export: preview sheets', error); fit(); } };
        } catch (error) { console.warn('DB Export: preview', error); }
      }, 150);
    };
    // Unfolding: one thing open at a time, a pick's alternatives under it or a panel's row under the bar; folded by a press elsewhere or Escape.
    const openOnes = () => [...root.querySelectorAll('.it.open')];
    // A pick inside a panel's row (keep) leaves that row and the panel's own value open.
    const closePops = keep => {
      const fold = keep?.closest('.xp-fold'), panel = fold && q(`.it[data-panel=${fold.dataset.panel}]`);
      for (const it of openOnes()) { if (it === panel) continue; it.classList.remove('open'); it.querySelector('.lk-alts')?.setAttribute('hidden', ''); it.style.marginBottom = ''; }
      for (const f of root.querySelectorAll('.xp-fold')) if (f !== fold) f.hidden = true;
    };
    const unfold = it => {
      const was = it.classList.contains('open'); closePops(it); if (was) return;
      it.classList.add('open');
      if (it.dataset.pick) { const a = it.querySelector('.lk-alts'); a.hidden = false; it.style.marginBottom = `${a.offsetHeight + 4}px`; }   // the line of alternatives takes its room below the row, from the pick's left edge
      else if (it.dataset.panel) { const f = q(`.xp-fold[data-panel=${it.dataset.panel}]`); if (f) { f.hidden = false; f.querySelector('input, button')?.focus(); } }
    };
    root.addEventListener('click', event => {
      const alt = event.target.closest('.lk-alts span');
      if (alt) { const it = alt.closest('[data-pick]'), sel = it.querySelector('select'); sel.value = alt.dataset.v; closePops(it); sel.dispatchEvent(new (hostDoc.defaultView.Event)('change', { bubbles: true })); return; }
      const v = event.target.closest('.it[data-pick] > .lk-value, .it[data-panel] > .lk-value'); if (v) { unfold(v.parentNode); return; }
      if (!event.target.closest('.it.open, .xp-fold')) closePops();
    });
    root.addEventListener('input', event => { if (!event.target.closest('.xp-zoom')) refresh(); });
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
      try { done = await act(ch, action, edited ? edited() : null) !== false; } catch (error) { console.error(error); logseq.UI.showMsg(`Export stopped: ${error.message}`, 'error'); }
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
E.ui = { open, read, sweep, host, kindIconHtml, CSS, TARGETS };
})();
