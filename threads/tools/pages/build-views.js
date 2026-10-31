// Builds docs/VIEWS.html: whole views drawn with the kit as the plugin draws them now (0.4.439): a page with two-way
// rows, the same page with a list open and three picked, an outline being written with proposals, the tag map's
// outline, walked and with a property opened, the link box, the settings window and the troubleshooting list. The tag map is the real
// part's own markup, captured by capture-tagmap.js from the Illness Test Graph; the rest follows what each part
// builds, with the kit's stylesheet and the parts' own layout pulled from the source; Logseq's own page furniture
// (the title, its property rows, bullets) is approximated. Run from the repo root: node <this file> <scratchpad dir>
const fs = require('fs'), path = require('path');
const S = process.argv[2];
const css = name => fs.readFileSync(path.join(S, 'css', name + '.css'), 'utf8');
const { icons: ICONS } = JSON.parse(fs.readFileSync(path.join(S, 'icons.json'), 'utf8'));
const tabler = JSON.parse(fs.readFileSync(path.join(S, 'tabler.json'), 'utf8'));
const { drawn: DRAWN = {} } = JSON.parse(fs.readFileSync(path.join(S, 'icons.json'), 'utf8'));
// An icon from Logseq's font, or the one shape the kit draws itself (DRAWN, parts/shared.js).
const T = name => DRAWN[name] ? `<i class="rf-drawn rf-drawn-${name}" aria-hidden="true">${DRAWN[name]}</i>` : `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const I = meaning => T(ICONS[meaning] || meaning);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tag = t => `<a class="rf-tag" href="#">${esc(t)}</a>`;

const view = (id, title, intro, html, notes, extra = '') => `
<section id="${id}">
  <h2>${esc(title)}</h2>
  <p class="intro">${intro}</p>
  <figure class="spec${extra ? ' ' + extra : ''}"><div class="sheet pv">${html}</div></figure>
  <ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
</section>`;

// ---- Logseq-like page furniture ----
const bullet = (text, cls = '') => `<div class="pv-bullet${cls ? ' ' + cls : ''}"><span class="pv-dot"></span><div class="pv-bt">${text}</div></div>`;
const propRow = (name, value) => `<div class="pv-prop"><span class="pv-pname">${esc(name)}</span><span class="pv-pval">${value}</span></div>`;

// ---- 1. A page with two-way rows (parts/two-way.js: rowHtml) ----
const twName = words => `<div class="rf-tw-name"><a class="rf-tw-field" href="#">${esc(words)}<span class="rf-tw-arrow">${I('to')}</span></a></div>`;
const pick = (on = false) => `<input type="checkbox" class="rf-check rf-tw-pick"${on ? ' checked' : ''} aria-label="Pick">`;
const side = `<a class="rf-quiet rf-tw-side" href="#" aria-label="Open in the sidebar">${I('sidebar')}</a>`;
const chev = `<a class="rf-quiet rf-tw-into rf-tw-chev" href="#" aria-label="Open">${I('fold')}</a>`;
const twItem = (day, name, t, plus = false) => `<span class="rf-tw-item rf-tw-datefirst">${pick()}<span class="rf-tw-day rf-day">${day}</span><span class="rf-tw-namecell"><span class="rf-tw-rec">${chev}<a class="rf-tw-record" href="#">${esc(name)}</a></span>${plus ? `<button type="button" class="rf-quiet rf-faint rf-tw-add">+</button>` : ''}</span><a class="rf-tag rf-tw-tag" href="#">${esc(t)}</a>${side}</span>`;
const twShort = (words, items) => `<div class="rf-tw-row">${twName(words)}<div class="rf-tw-value">${items}</div></div>`;
const twLong = (words, summary, open, list = '') => `<div class="rf-tw-row"${open ? ' data-open=""' : ''}>${twName(words)}<div class="rf-tw-value"><a class="rf-quiet rf-tw-fold" href="#">${I('fold')}</a><a class="rf-tw-toggle" href="#">${esc(summary)}</a><button type="button" class="rf-quiet rf-faint rf-tw-add">+</button></div>${list}</div>`;
const page1 = `
<div class="pv-titlebar"><h1 class="pv-title">Dr. Mei Chen</h1>${tag('Doctor')}</div>
<div class="pv-props">
  ${propRow('Specialized in', '<a class="pv-link" href="#">Oncology</a>')}
  ${propRow('Works at', '<a class="pv-link" href="#">Northgate Cancer Center</a>')}
</div>
<div class="refinement-two-way">
  ${twShort('provider of', twItem('12 Aug', 'Follow-up on the scan', 'Consultation') + twItem('23 Jun', 'Scan results explained', 'Consultation', true))}
  ${twLong('spoke with', '9 Conversations · 21 Jul – 2 Jun', false)}
  ${twShort('decided by', twItem('14 Jul', 'Decision on oxaliplatin dose', 'Decision', true))}
</div>
<div class="pv-addrow"><span>Add icon</span><span>Set property</span></div>
<div class="pv-blocks">
  ${bullet('Oncologist at <a class="pv-link" href="#">Northgate Cancer Center</a> since 2019. Leads the colorectal clinic on Tuesdays.')}
  ${bullet('Prefers written questions before a consultation.')}
</div>
`;

// ---- 2. The same page, a list open, three picked ----
const line = (day, text, t, on = false) => `<div class="rf-tw-line${on ? ' rf-tw-picked' : ''}">${pick(on)}<span class="rf-tw-day rf-day">${day}</span><span class="rf-tw-rec">${chev}<a class="rf-tw-record" href="#">${esc(text)}</a></span><a class="rf-tag rf-tw-tag" href="#">${esc(t)}</a>${side}</div>`;
const chip = (text, on = false) => `<button type="button" class="rf-chip rf-tw-chip" aria-pressed="${on}">${esc(text)}</button>`;
const bar = `<div class="rf-bar rf-tw-bar" role="toolbar"><label class="rf-count"><input type="checkbox" class="rf-check" checked><span>3 picked</span></label><button type="button" class="rf-quiet">${I('sidebar')}Sidebar</button><button type="button" class="rf-quiet">${I('to')}Change “Dr. Mei Chen” to …</button><button type="button" class="rf-quiet">${I('remove')}Remove “Dr. Mei Chen”</button><button type="button" class="rf-quiet">${I('tag')}Tag</button><button type="button" class="rf-quiet">${I('copy')}Copy</button><button type="button" class="rf-quiet">${I('property')}Set property</button><button type="button" class="rf-quiet">${I('delete')}</button><button type="button" class="rf-quiet rf-faint">Clear</button></div>`;
const page2 = `
<div class="pv-titlebar"><h1 class="pv-title">Dr. Mei Chen</h1>${tag('Doctor')}</div>
<div class="pv-props">${propRow('Specialized in', '<a class="pv-link" href="#">Oncology</a>')}${propRow('Works at', '<a class="pv-link" href="#">Northgate Cancer Center</a>')}</div>
<div class="refinement-two-way">
  ${bar}
  ${twShort('provider of', twItem('12 Aug', 'Follow-up on the scan', 'Consultation') + twItem('23 Jun', 'Scan results explained', 'Consultation', true))}
  ${twLong('spoke with', '9 Conversations · 21 Jul – 2 Jun', true, `<div class="rf-tw-list"><div class="rf-tw-chips">${chip('All 9', true)}${chip('Conversation 6')}${chip('Consultation 3')}</div>
    ${line('21 Jul', 'Asked about tingling fingers', 'Conversation', true)}
    ${line('14 Jul', 'Second opinion on the dose', 'Conversation')}
    ${line('7 Jul', 'Cycle 3 side effects', 'Conversation', true)}
    <div class="rf-tw-earlier rf-note">earlier</div>
    ${line('23 Jun', 'Scan results explained', 'Consultation', true)}
    ${line('16 Jun', 'Port care questions', 'Conversation')}
    <button type="button" class="rf-quiet rf-faint rf-tw-more">show all 9</button></div>`)}
  ${twShort('decided by', twItem('14 Jul', 'Decision on oxaliplatin dose', 'Decision', true))}
</div>`;

// ---- 3. An outline being written, with proposals (parts/shadow.js) ----
const pill = (name, html, proposed = false, made = false) => `<span class="bottom-property-pill${made ? ' rfs-made-pill' : ''}"${proposed ? ' data-refinement-proposal' : ''}><span class="${made ? 'rfs-made-name' : 'property-key-inner'}">${esc(name)}:</span><span class="bottom-property-content">${proposed ? `<span class="rfs-ghost">${html}</span>` : html}</span></span>`;
const pills = inner => `<div class="positioned-properties block-below"><div class="bottom-properties-row">${inner}</div></div>`;
const outline = `
<div class="pv-titlebar"><h1 class="pv-title">Oct 22nd, 2026</h1></div>
<div class="pv-blocks">
  ${bullet('Bloods came back fine, cycle 5 on Monday. <span class="rf-undo" role="button" title="Undo: Date and Findings were empty">' + I('undo') + '</span>' + pills(pill('Tags', tag('Report')) + pill('Date', '22 Oct') + pill('Findings', 'Normal')))}
  ${bullet('Spoke with <a class="pv-link" href="#">Dr. Mei Chen</a> about the next scan, on Friday<span class="pv-caret"></span>' + pills(pill('Spoke with', 'Dr. Mei Chen', true) + pill('Topic', 'Scan', true) + pill('Date', '24 Oct', true) + pill('Tags', `<span class="rf-tag rfs-ghost-tag">Conversation</span>`, true, true)), 'pv-editing')}
  ${bullet('<span class="rf-faint">Nausea again in the evening</span>')}
</div>
<div class="pv-keys"><span><kbd>Enter</kbd> fills in everything shown, guesses too</span><span><kbd>⌥ Enter</kbd> stops on each guess to check it</span><span><kbd>Esc</kbd> clears them until you type again</span></div>`;

// ---- 4 and 5. The tag map (parts/tags.js, parts/tags-props.js), captured from the real part ----
const tagsView = fs.readFileSync(path.join(S, 'tagmap-tags.html'), 'utf8');
const propsView = fs.readFileSync(path.join(S, 'tagmap-props.html'), 'utf8');

// ---- 6. The link box (parts/link-text.js) ----
const item = (words, end = '', on = false, cls = '') => `<button type="button" class="rf-item${on ? ' rf-on' : ''}${cls ? ' ' + cls : ''}" role="menuitem"><span class="rf-item-words">${words}</span>${end ? `<span class="rf-end">${end}</span>` : ''}</button>`;
const linkBox = `
<div class="pv-blocks">
  ${bullet('Asked <mark class="pv-sel">Mei</mark> about the port before cycle 5.', 'pv-editing')}
</div>
<div class="rf-pop refinement-link-text" style="width:320px;margin-left:60px">
  <div class="rf-pop-head">Link “Mei” to</div>
  <span class="rf-field rf-field-drawn"><span class="rf-typed rf-typed-fresh">Mei</span><span class="rf-caret"></span><kbd>⌘⌥L</kbd></span>
  <div class="rf-pop-body">${item('Dr. Mei Chen', tag('Doctor'), true)}${item('Mei’s clinic notes', 'page')}${item('New page “Mei”', '', false, 'rf-new rf-faint')}</div>
</div>`;

// ---- 7. The settings window (parts/settings-panel.js) ----
const srow = (title, desc, control, changed = false) => `<div class="rf-settings-row"><div class="rf-settings-text"><div class="rf-settings-title${changed ? ' rf-settings-changed' : ''}">${esc(title)}</div><div class="rf-note rf-settings-desc">${desc}</div></div><div class="rf-settings-control">${control}</div></div>`;
const settings = `
<dialog open class="rf-dialog refinement-settings rf-settings">
  <header class="rf-settings-head"><h2>Refinements settings</h2><span class="rf-field">${I('find')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></span><button type="button" class="rf-quiet" aria-label="Close">${I('close')}</button></header>
  <div class="rf-settings-main">
    <nav class="rf-settings-nav"><div class="rf-settings-group">Reading a page</div><button type="button" class="rf-quiet" aria-pressed="true">${I('twoWay')}Two-way links</button><div class="rf-settings-group">Writing a record</div><button type="button" class="rf-quiet">${I('proposals')}Proposals</button><button type="button" class="rf-quiet">${I('link')}Link selected text</button><button type="button" class="rf-quiet">${I('order')}Pickers</button><div class="rf-settings-group">Tools</div><button type="button" class="rf-quiet">${I('map')}Tag tree</button><button type="button" class="rf-quiet">${I('shortcut')}Shortcuts</button><button type="button" class="rf-quiet">${I('settings')}Troubleshooting</button><hr><button type="button" class="rf-quiet">${I('chosen')}Changed by you <span class="rf-note">3</span></button></nav>
    <div class="rf-settings-body"><section><h3>Two-way links</h3><div class="rf-settings-rows">
      ${srow('Links read the same from both ends', 'On a page that one of your fields points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such record becomes a row in the page’s own property list.', `<input type="checkbox" class="rf-check" checked>`)}
      ${srow('Fields read backwards', 'How a field’s name reads from the other end: “field = words; field = words”. A field not listed reads as “field of”.', `<span class="rf-field"><input type="text" value="symptoms = logged in; ask = "></span>`, true)}
      ${srow('Fields shown from one end only', 'Fields whose link is not shown as a row on the page they point to.', `<span class="rf-settings-list"><span class="rf-chip">Topic<button type="button" class="rf-chip-x">${I('remove')}</button></span><span class="rf-field"><input type="text" placeholder="Add a field"></span></span>`)}
      ${srow('Order in a row', 'Date first, or the name first, unless chosen per field by right-click.', `<span class="rf-seg"><button type="button" class="rf-quiet" aria-pressed="true">Date first</button><button type="button" class="rf-quiet" aria-pressed="false">Name first</button></span>`)}
    </div></section></div>
  </div>
  <footer class="rf-settings-foot"><span class="rf-note rf-settings-status">Changes are saved as you make them.</span><span class="rf-note">0.4.439</span><button type="button" class="rf-quiet">Logseq’s settings page</button><button type="button" class="rf-quiet">Reload plugin</button></footer>
</dialog>`;

// ---- 8. Troubleshooting (parts/diagnostics.js) ----
const mitem = (icon, words, end = '') => `<button type="button" class="rf-item" role="menuitem">${I(icon)}<span class="rf-item-words">${words}</span>${end ? `<span class="rf-end">${end}</span>` : ''}</button>`;
const tools = `
<div class="rf-pop" style="width:360px">
  <div class="rf-pop-head">Troubleshooting · none of these changes your notes</div>
  <div class="rf-pop-body">${mitem('copy', 'Copy performance report')}${mitem('show', 'Check what the plugin finds on this page')}${mitem('warning', 'Copy warnings')}<hr>${mitem('settings', 'Measuring', I('chosen'))}${mitem('settings', 'Foundation only')}</div>
</div>`;

const page = `<meta charset="utf-8">
<title>Refinements Views</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: the field guide's bench and sheets. Each sheet is a whole view drawn with the kit's own stylesheet and the
   parts' layout, in Logseq's page layout approximated. Blue is this page's own ink. */
:root {
  --bench: #eceef1; --ink: #1b1f25; --ink-2: #565e69; --rule: #d3d8de; --anno: #2849b8; --anno-wash: #2849b814;
  --sheet: #ffffff; --sheet-fg: #262a30; --sheet-sec: #6c737d; --sheet-border: #e2e5e9;
  --f-display: "Schibsted Grotesk", "Avenir Next", system-ui, sans-serif;
  --f-body: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --f-ls: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bench: #14171b; --ink: #e5e8ec; --ink-2: #9aa3ae; --rule: #2b3138; --anno: #8ea8ff; --anno-wash: #8ea8ff1f; color-scheme: dark; } }
:root[data-theme="dark"] { --bench: #14171b; --ink: #e5e8ec; --ink-2: #9aa3ae; --rule: #2b3138; --anno: #8ea8ff; --anno-wash: #8ea8ff1f; color-scheme: dark; }
@font-face { font-family: "tabler-icons"; src: url(data:font/woff2;base64,${tabler.font}) format("woff2"); font-weight: 400; font-style: normal; }
.ti { font-family: "tabler-icons" !important; font-style: normal; font-weight: 400; font-variant: normal; text-transform: none; line-height: 1; display: inline-block; -webkit-font-smoothing: antialiased; }
${Object.entries(tabler.map).map(([n, c]) => `.ti-${n}::before { content: "\\${c}"; }`).join('\n')}
* { box-sizing: border-box; }
body { background: var(--bench); color: var(--ink); font: 17px/1.55 var(--f-body); }
.wrap { max-width: 1100px; margin: 0 auto; padding-block: 40px 90px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1, h2 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.05; letter-spacing: -.015em; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.15; margin-top: 56px; }
.lead { font-size: 1.15rem; max-width: 60ch; color: var(--ink-2); margin: 14px 0 0; }
.intro { max-width: 70ch; margin: 6px 0 12px; color: var(--ink-2); }
.key { max-width: 70ch; margin: 14px 0 0; font-size: .98rem; color: var(--ink-2); }
.k-anno { color: var(--anno); font-weight: 600; }
.toolbar { display: flex; gap: 10px; align-items: center; margin: 22px 0 8px; font-size: .95rem; color: var(--ink-2); }
.toolbar button { font: inherit; padding: 4px 12px; border: 1px solid var(--rule); border-radius: 6px; background: transparent; color: var(--ink); cursor: pointer; }
.toolbar button[aria-pressed="true"] { background: var(--anno); color: #fff; border-color: var(--anno); }
.spec { margin: 0; max-width: 100%; }
.sheet { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; padding: 22px 28px; font: 16px/1.5 var(--f-ls); overflow: auto; max-width: 780px;
  --popover: 0 0% 100%; --popover-foreground: 0 0% 9%; --rf-fg: hsl(var(--popover-foreground)); --rf-bg: hsl(var(--popover));
  --ls-primary-text-color: #262a30; --ls-secondary-text-color: #6c737d; --ls-primary-background-color: #ffffff; --ls-border-color: #e2e5e9; --lx-accent-11: #2d6cc0; }
.dark .sheet { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-sec: #8e96a0; --sheet-border: #343a42; --popover: 220 7% 14%; --popover-foreground: 0 0% 88%; --ls-primary-text-color: #d8dce1; --ls-secondary-text-color: #8e96a0; --ls-primary-background-color: #1f2328; --ls-border-color: #343a42; --lx-accent-11: #8ab4f8; }
.sheet a { color: inherit; text-decoration: none; }
.spec.wide .sheet { max-width: 1000px; }
.notes { margin: 12px 0 0; padding-left: 20px; max-width: 78ch; color: var(--ink-2); }
.notes li { margin: 4px 0; }
.notes b { color: var(--anno); }
.notes code { font: 500 .78rem var(--f-mono); color: var(--ink); background: var(--anno-wash); padding: 1px 5px; border-radius: 3px; }
footer { margin-top: 60px; color: var(--ink-2); font-size: .9rem; border-top: 1px solid var(--rule); padding-top: 14px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

/* ===== The kit's stylesheet and the parts' own layout, as the plugin sends them to Logseq (built from the source) ===== */
${css('shared-kitCss')}
${css('two-way-twoWayCss')}
${css('tags')}
${css('shadow')}
${css('settings-panel')}
/* ===== end of the plugin's stylesheets ===== */

/* ===== The views (.pv-): Logseq's page furniture approximated; the plugin's pieces on it are its own ===== */
.pv { font-size: 16px; }
.pv kbd { font: inherit; font-size: .85em; opacity: .7; padding: 0 4px; border: 1px solid var(--rf-hair); border-radius: 3px; }
.pv-titlebar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.pv-title { font: 700 28px/1.2 var(--f-ls); letter-spacing: -.01em; margin: 0; }
.pv-titlebar .rf-tag { font-size: 13px; }
.pv-props { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
.pv-prop { display: grid; grid-template-columns: 150px 1fr; column-gap: 20px; min-height: 28px; align-items: baseline; }
.pv-pname { color: var(--rf-faint); font-size: 15px; }
.pv-link { color: var(--lx-accent-11); }
.sheet .refinement-two-way { margin: 2px 0 8px; padding-left: 24px; }
.sheet .rf-tw-bar { position: static; margin-bottom: 6px; }
.sheet .rf-tw-pick { opacity: .35; }
.sheet .rf-tw-pick:checked { opacity: 1; }
.pv-addrow { display: flex; gap: 16px; min-height: 28px; visibility: hidden; }
.pv-blocks { display: flex; flex-direction: column; gap: 6px; }
.pv-bullet { display: grid; grid-template-columns: 18px 1fr; column-gap: 6px; align-items: start; }
.pv-dot { width: 6px; height: 6px; margin: 10px 0 0 6px; border-radius: 50%; background: color-mix(in srgb, currentColor 45%, transparent); }
.pv-editing .pv-bt { background: var(--rf-wash); border-radius: 4px; padding: 2px 6px; margin-left: -6px; }
.pv-caret { display: inline-block; width: 1px; height: 1em; background: currentColor; vertical-align: -2px; margin-left: 1px; animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.pv .bottom-properties-row { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 4px; font-size: 14px; }
.pv .bottom-property-pill { display: inline-flex; gap: 4px; align-items: baseline; }
.pv .property-key-inner { color: var(--rf-faint); }
.pv-keys { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--rf-hair); font-size: 13px; color: var(--rf-faint); }
.pv-linked { display: flex; align-items: center; gap: 4px; margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--rf-hair); color: var(--rf-quiet); font-size: 15px; }
mark.pv-sel { background: color-mix(in srgb, currentColor 18%, transparent); color: inherit; border-radius: 2px; }
.sheet .rf-pop { position: static !important; transform: none !important; margin-top: 6px; }
.sheet .refinement-tags { padding: 0; }
.sheet .refinement-tags .rtg-row:hover > .rtg-acts { opacity: 1; }
.sheet dialog.rf-dialog { position: static; margin: 0; width: 100%; max-width: 720px; height: auto; max-height: none; min-height: 380px; font-size: 14px; }
</style>
<div class="wrap">
  <header>
    <h1>The plugin’s views, drawn with the kit</h1>
    <p class="lead">Whole views as the plugin draws them at 0.4.439: a page with its two-way rows, the same page with a list open and things picked, an outline being written with proposals, the tag map both ways, the link box, the settings window and the tools. Everything in the plugin’s grammar: it fades away, differences by weight and grey, tags in mono as a class, an action in stages.</p>
    <p class="key"><span class="k-anno">Blue</span> words are this page’s own marks. The sheets themselves carry no mark of this page: what is on a sheet is what Logseq shows, drawn by the kit’s own stylesheet and the parts’ layout pulled from the source, with Logseq’s own page furniture approximated and no colour of the plugin’s own.</p>
    <div class="toolbar" role="group" aria-label="Sheet colours"><span>Logseq’s theme on the sheets:</span><button type="button" id="light" aria-pressed="true">Light</button><button type="button" id="dark" aria-pressed="false">Dark</button></div>
  </header>

  ${view('page', 'A page: Dr. Mei Chen', 'A Doctor page as Logseq lays it out, with the plugin’s rows. Logseq’s own property rows come first; the two-way rows follow on the same grid, as if they were more properties, the backwards wording on the left with its arrow.', page1, [
    '<b>Two-way rows</b> (<code>parts/two-way.js</code>) sit on Logseq’s grid: the wording in the name column, the values at the same edge. A short row lists its nodes with their day, name and tag; a long row folds to a summary with a chevron, opened with a click.',
    '<b>Nothing shows until needed:</b> the tick boxes in the margin, the + after the last node, the sidebar icon, all appear when the pointer is on the rows.',
    '<b>Logseq’s “Add icon” and “Set property” line</b> keeps its height; its tag list under the page is hidden where the rows say the same.',
    '<b>A chevron before each name</b> opens the node here, under its row: its properties, what points at it, its first bullets; a chevron inside steps on, with a trail back (Escape returns).',
    '<b>Linked references</b> is hidden on a page like this one: the rows already hold everything it listed, the mentions too, each with where it sits. It stays on tag pages and journal days.',
  ])}

  ${view('picked', 'The same page: a list open, three picked', 'The “spoke with” row opened. The kinds as filter words, lines with their tick boxes, three picked, and the bar above the rows: a line of words with a hairline under it, no box.', page2, [
    '<b>The bar</b> (<code>shared.bar</code>) appears above the rows when the first thing is picked and goes when the last is cleared; Escape clears. The count sits first, the actions as quiet words with icons.',
    '<b>Filters</b> (<code>shared.chip</code>) are words: the one in force in the text colour, the others grey.',
    '<b>Picked lines</b> get the wash; unpicked lines show their box faint while the pointer is on the list.',
    '<b>“earlier”</b> is a quiet word with a hairline between what is to come and what has been.',
  ])}

  ${view('outline', 'An outline being written', 'A journal page. The bullet being written has its own properties under it, Logseq’s pills, and the plugin pencils in what it can, every value italic grey with a dotted line under it, a tag in mono without #. The bullet above was filled a moment ago and keeps its faded Undo arrow.', outline, [
    '<b>Every proposed value</b> (<code>parts/shadow.js</code>) looks the same: italic grey with a dotted line, whether the plugin was sure (the page named in the words) or guessing (the topic from the nodes this looks like, the date from “on Friday”).',
    '<b>A tag guess</b> is a made pill that looks like Logseq’s, the tag in mono without #.',
    '<b>Enter</b> fills in everything shown; <b>Option-Enter</b> stops on each guess; <b>Escape</b> clears them until you type again. The keys line at the bottom is for this page only, not drawn in Logseq.',
    '<b>The Undo arrow</b> (<code>shared.undo</code>) stays at the end of the bullet above until it is edited again or the page is left.',
  ])}

  ${view('tags', 'The tag map: walking', 'One outline of tags. Consultation is open: each property with the tag it leads to and how many of its nodes hold it; Provider is walked on to Doctor, which opens under it in the faint grey of the focus. Captured from the plugin running on the Illness Test Graph.', tagsView, [
    '<b>A tag opens</b> into its properties, then what points at it (the tag first, then the property), then its child tags.',
    '<b>The tag a property leads to</b> has its own chevron: it opens that tag under the line, as digging does in the two-way section; the way back is left out; a fourth level steps in with a trail, Esc steps back.',
    '<b>Counts</b> say how many of the tag’s nodes hold the property, “14 of 17”; faint when none do.',
    '<b>At the top</b>, the shape of the whole as counts, and what may want work, each with its action.',
  ], 'wide')}

  ${view('props', 'The tag map: a property', 'Provider’s own chevron opens what it is, under its line: the tags it is on, what it accepts, how it reads back, what it holds, its group, then the nodes that hold it and its actions. Captured from the plugin running on the Illness Test Graph.', propsView, [
    '<b>Each line is changed where it sits:</b> a click on its value opens the map’s own list or a field.',
    '<b>Tick properties</b>, on any tags, and the bar offers Merge, Move to a tag and Change what they accept.',
  ], 'wide')}

  ${view('link', 'Link selected text', 'Words selected in a bullet, Cmd+Option+L. The box opens under the words with the field as an underline and the pages that fit, each with its tag in mono at the right; Enter links the lit row. New page only when no page has the name.', linkBox, [
    '<b>The field</b> (<code>shared.drawnField</code>) is drawn, not real, so the keystrokes keep going to the bullet and Logseq’s own Cmd+Z takes the link back; it looks like every other field.',
    '<b>Rows</b> show the page and, at the right, its tag in mono or the word “page”.',
    '<b>New page</b> is last and faint, never first while a page fits.',
  ])}

  ${view('settings', 'The settings window', 'The one real window, the browser’s own dialog dressed by the kit: a find field, the sections on the left as quiet words with their icons, rows of a title, a quiet line and the control at the right: a tick box, two words with a hairline, named things as words with a × under the pointer, a field as an underline.', settings, [
    '<b>One kind of control per kind of setting:</b> on/off is a tick box, a choice of two is two words, a list of names is words with ×, text is an underline.',
    '<b>A dot</b> before a title marks a setting changed from its default; <b>Changed by you</b> lists them all.',
    '<b>Shortcuts</b> are a section like any other, read from the one register, so every shortcut can be changed here.',
  ])}

  ${view('tools', 'Troubleshooting', 'The tools as a list pop-up from the palette, each with its icon; the measuring switch ticked or not. No window; a report opens the same pop-up with the text and one quiet word, Copy.', tools, [
    '<b>A list pop-up,</b> the same as every other menu, placed by the browser.',
    '<b>Reports</b> open the same pop-up again with the text to copy and one quiet word, Copy.',
  ])}

  <footer>Built ${new Date().toISOString().slice(0, 10)} from the plugin’s source at 0.4.439. The elements, one drawing per kind, are on the elements page (https://claude.ai/artifact/9VE7BaQ8Yz6G14RBpkzZuN). Source of truth: <code>docs/VIEWS.html</code> in the plugin folder, built by <code>tools/pages/build-views.js</code>.</footer>
</div>
<script>
(function () {
  var wrap = document.querySelector('.wrap'), light = document.getElementById('light'), dark = document.getElementById('dark');
  function set(isDark) { wrap.classList.toggle('dark', isDark); light.setAttribute('aria-pressed', String(!isDark)); dark.setAttribute('aria-pressed', String(isDark)); try { localStorage.setItem('rf-views-theme', isDark ? 'dark' : 'light'); } catch (e) {} }
  light.addEventListener('click', function () { set(false); }); dark.addEventListener('click', function () { set(true); });
  var saved = null; try { saved = localStorage.getItem('rf-views-theme'); } catch (e) {} if (saved === 'dark') set(true);
})();
</script>
`;
fs.writeFileSync(path.join(process.cwd(), 'docs', 'VIEWS.html'), page);
console.log('wrote docs/VIEWS.html', Math.round(page.length / 1024), 'KB');
