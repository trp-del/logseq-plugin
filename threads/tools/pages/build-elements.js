// Builds docs/ELEMENTS.html: every kind of element the loaded parts draw, one drawing per kind, rendered with the kit's
// own stylesheet (pulled from the source at build time) and the markup the kit builds; and, per kind, where it comes
// from (Logseq, the browser, or the kit) and which parts use it. Before 0.4.319 this page showed each kind's many
// drawings side by side with a sketch of the kit; the kit is built now, so the page shows what the plugin draws.
// Run from the repo root: node <this file> <scratchpad dir>
const fs = require('fs'), path = require('path');
const S = process.argv[2];
const css = name => fs.readFileSync(path.join(S, 'css', name + '.css'), 'utf8');
const { icons: ICONS, kindWords } = JSON.parse(fs.readFileSync(path.join(S, 'icons.json'), 'utf8'));
const tabler = JSON.parse(fs.readFileSync(path.join(S, 'tabler.json'), 'utf8'));
const { drawn: DRAWN = {} } = JSON.parse(fs.readFileSync(path.join(S, 'icons.json'), 'utf8'));
// An icon from Logseq's font, or the one shape the kit draws itself (DRAWN, parts/shared.js).
const T = name => DRAWN[name] ? `<i class="rf-drawn rf-drawn-${name}" aria-hidden="true">${DRAWN[name]}</i>` : `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const I = meaning => T(ICONS[meaning] || meaning);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tag = t => `<a class="rf-tag" href="#">${esc(t)}</a>`;

const spec = (what, cls, html, note = '', extra = '') => `
<figure class="spec${extra ? ' ' + extra : ''}">
  <div class="sheet">${html}</div>
  <figcaption><span class="part">${esc(what)}</span><code>${esc(cls)}</code>${note ? `<span class="note">${note}</span>` : ''}</figcaption>
</figure>`;
// The card beside a kind: where it comes from, what it is, who uses it.
const from = (source, what, users) => `
<aside class="rec">
  <div class="verdict">${esc(source)}</div>
  <dl>
    <dt>What</dt><dd>${what}</dd>
    <dt>Used by</dt><dd>${users}</dd>
  </dl>
</aside>`;
const section = (id, title, count, intro, specs, card = '', after = '') => `
<section id="${id}">
  <h2>${esc(title)} <span class="ways">${count}</span></h2>
  <p class="intro">${intro}</p>
  <div class="row">${specs.join('')}</div>
  ${card}
  ${after}
</section>`;

// ---------- The kit's pieces, as the kit builds them ----------
const item = (icon, words, end = '', on = false, cls = '') => `<button type="button" class="rf-item${on ? ' rf-on' : ''}${cls ? ' ' + cls : ''}" role="menuitem">${icon ? I(icon) : ''}<span class="rf-item-words">${words}</span>${end}</button>`;
const kbd = k => `<kbd>${k}</kbd>`;
const end = html => `<span class="rf-end">${html}</span>`;
const pop = (inner, cls = '', width = 240, head = '') => `<div class="rf-pop${cls ? ' ' + cls : ''}" style="width:${width}px">${head ? `<div class="rf-pop-head">${head}</div>` : ''}${inner}</div>`;

const popMenu = pop(`<div class="rf-pop-body">${item('rename', 'Rename …', kbd('r'))}${item('add', 'New tag inside', kbd('n'))}${item('map', 'Also put under …', kbd('a'))}<hr>${item('page', 'Open Consultation', kbd('Enter'))}${item('sidebar', 'Open in the right sidebar', kbd('⇧ Enter'))}</div>`, 'refinement-tags-menu', 250, 'Consultation');
const popChosen = pop(`<div class="rf-pop-body">${item('', 'Nothing', end(I('chosen')), true)}${item('tag', 'Tag')}${item('date', 'Month')}<hr>${item('rename', 'Rename how it reads …')}</div>`, '', 220, 'Provider');
const popList = pop(`<span class="rf-field"><input type="text" value="Pro" placeholder="Type to find a tag"></span><div class="rf-pop-body">${item('', tag('Procedure'), end('Occurrence'), true)}${item('', tag('Process note'), end('Entity'))}</div>`, 'refinement-tags-menu', 260, 'Also put Scan under …');
const popAsk = pop(`<div class="rf-pop-body"><div class="rf-ask-words">Delete 3 records?</div><div class="rf-note">They go to Logseq’s Recycle.</div><div class="rf-btns"><button type="button" class="rf-quiet">Cancel</button><button type="button" class="rf-go">Delete</button></div></div>`, 'rf-ask', 300);
const popAskField = pop(`<div class="rf-pop-body"><div class="rf-ask-words">Rename Provider</div><div class="rf-note">Everywhere it is used. Enter renames, Esc leaves it.</div><span class="rf-field"><input type="text" value="Provider"></span><div class="rf-btns"><button type="button" class="rf-quiet">Cancel</button><button type="button" class="rf-go">Keep</button></div></div>`, 'rf-ask refinement-tags-menu', 300);
const popPlan = pop(`<div class="rf-pop-body"><div class="rf-ask-words">Turn Specialty into links to pages?</div><div class="rtg-namefield"><span class="rtg-note">New property</span><span class="rf-field rf-field-inline"><input type="text" value="Specialty"></span></div><div class="rtg-namefield"><span class="rtg-note">Pages tagged</span><span class="rf-field rf-field-inline"><input type="text" value="Specialty kind"></span><button type="button" class="rf-quiet rf-faint">Pick …</button></div><ul><li>Specialty is renamed “Specialty (old)” and keeps its values, so nothing is lost</li><li>a new Specialty is made on Doctor, holding a link to a Specialty kind page</li><li>3 pages: Oncology, Radiology, Surgery</li><li>5 nodes get their link, for example Dr. Mei Chen → Oncology</li></ul><p class="rtg-note">When it looks right, delete “Specialty (old)” yourself. The faded arrow on its row puts everything back.</p><div class="rf-btns"><button type="button" class="rf-quiet">Cancel</button><button type="button" class="rf-go">Turn into links</button></div></div>`, 'refinement-tags-dialog rf-ask', 440);

const settingsRow = (title, desc, control, changed = false) => `<div class="rf-settings-row"><div class="rf-settings-text"><div class="rf-settings-title${changed ? ' rf-settings-changed' : ''}">${esc(title)}</div><div class="rf-note rf-settings-desc">${desc}</div></div><div class="rf-settings-control">${control}</div></div>`;
const dlgSettings = `<dialog open class="rf-dialog refinement-settings rf-settings">
  <header class="rf-settings-head"><h2>Refinements settings</h2><span class="rf-field">${I('find')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></span><button type="button" class="rf-quiet" aria-label="Close">${I('close')}</button></header>
  <div class="rf-settings-main">
    <nav class="rf-settings-nav"><div class="rf-settings-group">Reading a page</div><button type="button" class="rf-quiet" aria-pressed="true">${I('twoWay')}Two-way links</button><div class="rf-settings-group">Writing a record</div><button type="button" class="rf-quiet">${I('proposals')}Proposals</button><button type="button" class="rf-quiet">${I('link')}Link selected text</button><div class="rf-settings-group">Tools</div><button type="button" class="rf-quiet">${I('map')}Tag tree</button><button type="button" class="rf-quiet">${I('shortcut')}Shortcuts</button></nav>
    <div class="rf-settings-body"><section><h3>Two-way links</h3><div class="rf-settings-rows">
      ${settingsRow('Links read the same from both ends', 'On a page that one of your fields points to, a record named by the “doctor” of visits is listed as a row.', `<input type="checkbox" class="rf-check" checked>`)}
      ${settingsRow('Order in a row', 'Date first, or the name first.', `<span class="rf-seg"><button type="button" class="rf-quiet" aria-pressed="true">Date first</button><button type="button" class="rf-quiet" aria-pressed="false">Name first</button></span>`)}
      ${settingsRow('Proposals may write in', 'Graphs named here get proposals filled in; others only show them.', `<span class="rf-chip">Illness Test Graph<button type="button" class="rf-chip-x">${I('remove')}</button></span>`, true)}
    </div></section></div>
  </div>
  <footer class="rf-settings-foot"><span class="rf-note rf-settings-status">Changes are saved as you make them.</span><span class="rf-note">0.4.319</span><button type="button" class="rf-quiet">Logseq’s settings page</button><button type="button" class="rf-quiet">Reload plugin</button></footer>
</dialog>`;

const buttons = [
  spec('quiet', '.rf-quiet', `<div class="line"><button type="button" class="rf-quiet">Cancel</button><button type="button" class="rf-quiet">Unfold</button><button type="button" class="rf-quiet">${I('sidebar')}Sidebar</button><button type="button" class="rf-quiet">${I('more')}</button><button type="button" class="rf-quiet rf-faint">+ Property</button><button type="button" class="rf-quiet rf-faint">Clear</button></div>`, 'words or an icon, no edge; faint for what can be made or cleared'),
  spec('go', '.rf-go', `<div class="line"><button type="button" class="rf-go">Delete</button><button type="button" class="rf-go">Turn into links</button><button type="button" class="rf-go" disabled>Make …</button></div>`, 'the one that does what was asked: bold, underlined, no fill'),
  spec('pressed', '.rf-quiet[aria-pressed=true]', `<div class="line"><span class="rf-seg"><button type="button" class="rf-quiet" aria-pressed="true">Tags</button><button type="button" class="rf-quiet" aria-pressed="false">Properties</button></span><button type="button" class="rf-quiet" aria-pressed="true">Measuring</button></div>`, 'a quiet button in force: the text colour, bold'),
];
const fields = [
  spec('field', '.rf-field', `<div class="col"><span class="rf-field"><input type="text" placeholder="Find a tag or property"></span><span class="rf-field">${I('find')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></span></div>`, 'a real text box drawn as a hairline underneath; an icon, a key hint'),
  spec('inline', '.rf-field-inline', `<div class="line"><span>Name</span><span class="rf-field rf-field-inline"><input type="text" value="Imaging"></span><span class="rf-note">Enter</span></div>`, 'on a line, among words'),
  spec('tall', '.rf-field-tall', `<span class="rf-field rf-field-tall" style="width:280px"><textarea rows="3">Findings from a lab or a scan.</textarea></span>`, 'a few lines, for a description'),
  spec('drawn', '.rf-field-drawn', `<span class="rf-field rf-field-drawn" style="width:280px"><span class="rf-typed rf-typed-fresh">Mei</span><span class="rf-caret"></span><kbd>⌘⌥L</kbd></span>`, 'the link box only: drawn text and a drawn caret, the keystrokes stay in the bullet'),
];
const ticks = [
  spec('tick box', 'input.rf-check', `<div class="line"><input type="checkbox" class="rf-check" aria-label="off"> <input type="checkbox" class="rf-check" checked aria-label="on"> <label class="rf-tick"><input type="checkbox" class="rf-check" checked>Two-way links</label></div>`, 'the browser’s checkbox as a small rounded square: off, on, with its words'),
  spec('chosen', '.rf-item .rf-end', `${popChosen}`, 'a chosen row in a menu shows the check icon'),
];
const words = [
  spec('tag', '.rf-tag', `<div class="line"><span>Follow-up on the scan</span> ${tag('Consultation')} <span>Oncology</span> ${tag('Specialty kind')}</div>`, 'a tag as a class: mono, no #, the faint underline of a link'),
  spec('filter', '.rf-chip[aria-pressed]', `<div class="line"><button type="button" class="rf-chip" aria-pressed="true">All 9</button><button type="button" class="rf-chip" aria-pressed="false">Consultation 6</button><button type="button" class="rf-chip" aria-pressed="false">Decision 3</button></div>`, 'the one in force in the text colour'),
  spec('removable', '.rf-chip .rf-chip-x', `<div class="line"><span class="rf-note">Graphs:</span><span class="rf-chip">Illness Test Graph<button type="button" class="rf-chip-x">${I('remove')}</button></span><span class="rf-chip">Seed Check<button type="button" class="rf-chip-x" style="opacity:1">${I('remove')}</button></span></div>`, 'a word with a × under the pointer'),
  spec('kind', '.rf-kind', `<div class="col"><div class="line"><span class="rf-kind" style="width:15px;justify-content:center" title="${esc(kindWords.node || 'a link to a node')}">${I('node')}</span><span class="rtg-pname" style="display:inline-block;width:6em">Provider</span><span>Dr. Mei Chen</span></div><div class="line"><span class="rf-kind" style="width:15px;justify-content:center">${I('nodes')}</span><span class="rtg-pname" style="display:inline-block;width:6em">Topic</span><span>Fatigue, Nausea</span></div><div class="line"><span class="rf-kind" style="width:15px;justify-content:center"></span><span class="rtg-pname" style="display:inline-block;width:6em">Date</span><span>Oct 29</span></div><div class="line"><span class="rf-kind" style="width:15px;justify-content:center"></span><span class="rtg-pname" style="display:inline-block;width:6em">Severity</span><span>4</span></div></div>`, 'a property linking to nodes, one or several, marked left of its name with three dots joined in a triangle (drawn by the kit); a fact, a date or a number, carries no mark'),
];
const bars = [
  spec('picking bar', '.rf-bar', `<div class="rf-bar" role="toolbar"><label class="rf-count"><input type="checkbox" class="rf-check" checked><span>3 of 12 picked</span></label><button type="button" class="rf-quiet">${I('sidebar')}Sidebar</button><button type="button" class="rf-quiet">${I('to')}Change “Dr. Mei Chen” to …</button><button type="button" class="rf-quiet">${I('tag')}Tag</button><button type="button" class="rf-quiet">${I('copy')}Copy</button><button type="button" class="rf-quiet">${I('delete')}</button><button type="button" class="rf-quiet rf-faint">Clear</button></div>`, 'the count with its tick box, the actions as quiet words, a hairline under it', 'wide'),
];
const twRow = (label, inner) => `<div class="refinement-two-way"><div class="rf-tw-row">${label}${inner}</div></div>`;
const twName = words => `<div class="rf-tw-name">${esc(words)}<span class="rf-tw-arrow">${I('to')}</span></div>`;
const twItem = (day, name, t, plus = '') => `<span class="rf-tw-item rf-tw-datefirst"><input type="checkbox" class="rf-check rf-tw-pick" aria-label="Pick"><span class="rf-tw-day rf-day">${day}</span><span class="rf-tw-namecell"><a class="rf-tw-record" href="#">${esc(name)}</a>${plus}</span><a class="rf-tag rf-tw-tag" href="#">${esc(t)}</a><a class="rf-quiet rf-tw-side" href="#">${I('sidebar')}</a></span>`;
const pluses = [
  spec('after a row', '.rf-tw-add', twRow(twName('provider of'), `<div class="rf-tw-value">${twItem('12 Aug', 'Follow-up on the scan', 'Consultation', `<button type="button" class="rf-quiet rf-faint rf-tw-add" style="opacity:1">+</button>`)}</div>`), 'a quiet + after the last node, shown under the pointer', 'wide'),
  spec('the line that opens', '.rf-tw-draft', twRow(twName('provider of'), `<div class="rf-tw-value"></div><div class="rf-tw-draft rf-tw-drafting"><span class="rf-tw-draft-plus rf-faint">+</span><span class="rf-tw-draft-main"><span class="rf-field rf-field-inline"><input type="text" class="rf-tw-draft-field rf-tw-draft-name" placeholder="Add a Consultation"></span></span><a class="rf-tag rf-tw-tag rf-tw-draft-tag" href="#">Consultation</a></div>`), 'the kit’s field inline, with the tag the node will get', 'wide'),
  spec('under an open tag', '.rtg-adds', `<div class="refinement-tags"><div class="rtg-adds" style="opacity:1;padding-left:0"><button type="button" class="rf-quiet rf-faint rtg-addline">+ Property</button><button type="button" class="rf-quiet rf-faint rtg-addline">+ Tag inside</button><button type="button" class="rf-quiet rf-faint rtg-addline">+ Description</button></div></div>`, 'faint words, full under the pointer; each opens a line in place'),
];
const cards = [
  spec('hover card', '.rf-card', pop(`<div class="rf-pop-body"><a href="#" class="rf-card-title">Follow-up on the scan</a><div class="rf-note">${tag('Consultation')} · <a href="#" class="rf-card-day">12 Aug</a></div><div class="rf-card-fields"><a href="#" class="rf-card-name">Provider</a><span><a href="#">Dr. Mei Chen</a></span><a href="#" class="rf-card-name">Topic</a><span><a href="#">Scan results</a></span></div><div class="rf-card-lines"><a href="#" class="rf-card-line">Scan looked stable, next one in October.</a></div></div>`, 'rf-card', 300), 'a node’s preview; every piece opens what it names'),
  spec('hint', 'title="…"', `<div class="tooltip-mock"><span class="tip-anchor">Spoke with</span><span class="tip">Open the “Spoke with” field</span></div>`, 'the browser’s own tooltip after a pause, drawn by the system'),
];
const undos = [
  spec('Undo', '.rf-undo', `<span>Provider: Dr. Mei Chen <span class="rf-undo" role="button" title="Undo: Provider was empty">${I('undo')}</span></span>`, 'a faded arrow at the end of what changed; its words in the tooltip'),
  spec('waiting', '.rf-undo-docked', `<div class="rf-undo-dock" style="position:static;align-items:flex-start"><span class="rf-undo rf-undo-docked">${I('undo')}<span class="rf-undo-words">Deleted 3 records</span></span></div>`, 'at the bottom right with its words when nothing is left on screen to sit beside'),
];
const pill = (name, html) => `<span class="bottom-property-pill" data-refinement-proposal><span class="property-key-inner">${esc(name)}:</span><span class="bottom-property-content">${html}</span></span>`;
const ghosts = [
  spec('proposed value', '.rfs-ghost', `<div class="ls-block"><div class="positioned-properties block-below"><div class="bottom-properties-row">${pill('Provider', `<span class="rfs-ghost">Dr. Mei Chen</span>`)}${pill('Topic', `<span class="rfs-ghost">Scan results</span>`)}${pill('Date', `<span class="rfs-ghost">24 Oct</span>`)}</div></div></div>`, 'inside Logseq’s own pill: italic grey with a dotted line, sure or guessed alike'),
  spec('proposed tag', '.rfs-ghost-tag', `<div class="ls-block"><div class="positioned-properties block-below rfs-made"><div class="bottom-properties-row"><span class="bottom-property-pill rfs-made-pill"><span class="rfs-made-name">Tags:</span><span class="bottom-property-content"><span class="rfs-ghost"><span class="rf-tag rfs-ghost-tag">Consultation</span></span></span></span></div></div></div>`, 'a made pill that looks like Logseq’s; the tag in mono, no #'),
];
const helps = [
  spec('quiet line', '.rf-note', `<div class="col"><div class="rf-note">Everywhere it is used. Enter to rename, Esc to leave it.</div><div class="line"><span class="rtg-note">Shows up here as</span> <span class="rtg-val">provider of</span> <span class="rtg-small">also on 2 other tags</span></div></div>`, 'a hint, a note in a pop-up, quiet words on a row'),
  spec('help paragraph', '.rf-guide', `<div class="rf-guide" role="note"><p><b>What this means.</b> Every node tagged ${tag('Consultation')} gets an empty <b>Provider</b> to fill in.</p><p><b>Which way to link.</b> Put the property on the side that has one answer.</p></div>`, 'opens under the info icon; a hairline down its left'),
];

// The outline (0.4.441): the kit's own builders, run in a pretend window, so the page shows exactly the markup they make.
const K = (() => { const { JSDOM } = require('jsdom'); const d = new JSDOM('', { runScripts: 'outside-only' }); d.window.eval(fs.readFileSync(path.join(process.cwd(), 'parts', 'shared.js'), 'utf8')); return d.window.refinementShared; })();
const O = K.outline;
const nm = (t, tg, open = false) => O.name({ text: t, tag: tg, open });
const tickBox = (on = false) => `<input type="checkbox" class="rf-check"${on ? ' checked' : ''} aria-label="Pick">`;
const olWrap = (html, width = 640, cls = '') => `<div class="rf-ol${cls ? ' ' + cls : ''}" style="padding-left:22px;max-width:${width}px">${html}</div>`;
const consultLine = (open, focus, inner = '') => {
  const line = O.line({ tick: tickBox(), day: 'Oct 29', chev: O.chev({ open, label: 'Spoke with Dr. Mei Chen about fatigue' }), body: nm('Spoke with Dr. Mei Chen about fatigue', 'Consultation', open) });
  return open ? O.unit({ focus, html: line + O.kids({ from: 'day', html: inner }) }) : line;
};
const fatigueKids = slOpen => [['Oct 4', 'A bit better.', slOpen], ['Oct 2', 'Wiped out all day.'], ['Sep 20', 'A bit better.']].map(([d, t, o], i) => {
    const line = O.prop({ name: i ? '' : 'Symptom type', kind: 'node', value: `<span class="rf-ol-day">${d}</span>${O.chev({ open: !!o, label: t })}<span class="rf-ol-body">${nm(t, 'Symptom Log', !!o)}</span>` });
    return o ? O.unit({ focus: true, html: line + O.kids({ from: 'back', html: O.prop({ kind: 'number', name: 'Severity', value: '1' }) + O.prop({ kind: 'date', name: 'Date', value: 'Oct 4' }) + O.newBullet({ label: 'A new bullet inside A bit better.' }) }) }) : line;
  }).join('') + O.more({ text: 'show all 13', under: 'value' })
  + O.prop({ name: 'Side effects', kind: 'node', value: `<span class="rf-ol-day">Oct 20</span>${O.chev({ label: 'Having fatigue' })}<span class="rf-ol-body">${nm('Having fatigue with after ferrous sulfate cisplatin', 'Treatment')}</span>` });
const consultKids = (fatOpen, slOpen) => {
  const topic = O.prop({ kind: 'node', name: 'Topic', chev: O.chev({ open: fatOpen, label: 'Fatigue' }), value: `<span class="rf-ol-body">${nm('Fatigue', 'Symptom', fatOpen)}</span>` });
  return (fatOpen ? O.unit({ focus: !slOpen, html: topic + O.kids({ from: 'prop', html: fatigueKids(slOpen) }) }) : topic)
    + O.prop({ kind: 'date', name: 'Date', value: 'Oct 29' }) + O.newBullet({ label: 'A new bullet' });
};
const doc = (() => { const { JSDOM } = require('jsdom'); return new JSDOM('').window.document; })();
const outlines = [
  spec('chevron', '.rf-chev', `<div class="line rf-ol">${O.chev({ label: 'a' })}<span class="rf-note">at rest</span>&nbsp;&nbsp;<span class="rf-ol-line" style="background:var(--rf-wash)">${O.chev({ label: 'b' })}<span class="rf-note">on its line</span></span>&nbsp;&nbsp;${O.chev({ open: true, label: 'c' })}<span class="rf-note">open</span></div>`, 'the one control that opens: faint at rest, never hidden, full on its line, turned down while open, a 24 px place to click'),
  spec('line', '.rf-ol-line', olWrap(consultLine(false) + O.line({ tick: tickBox(true), day: 'Oct 20', chev: O.chev({ label: 'x' }), body: nm('Spoke with Dr. Chen about Blood in stool', 'Consultation') }) + O.line({ tick: tickBox(), day: 'Aug 20', chev: O.chev({ label: 'y' }), body: nm('First appointment with my oncologist, Dr. Mei Chen.', 'Consultation') }) + O.more({ text: 'show all 4' })), 'the tick box in the margin, the day in a column of one width, the chevron right before the name, the name a link, the tag after it; the second ticked; “show all” on the names’ edge', 'wide'),
  spec('one level', '.rf-ol-kids', olWrap(consultLine(true, true, consultKids(false, false))), 'opened under its own name, one hairline down from its chevron; the name bold while open; the focus on a very faint grey, its line and what it holds', 'wide'),
  spec('three levels', '.rf-ol-unit.rf-ol-focus', olWrap(consultLine(true, false, consultKids(true, true))), 'nothing moved: Fatigue opened where it was, then “A bit better.”; the last one opened is the focus; one name per line, three then “show all”', 'wide'),
  spec('narrow', '@container rf-ol', olWrap(consultLine(true, false, consultKids(true, true)), 400), 'at 400 px (the sidebar): the names’ column and the indent give way, three levels still fit', 'wide'),
  spec('working', 'outline.close, outline.focus', `<div id="ol-live" class="rf-ol" style="padding-left:22px;max-width:640px"></div>`, 'try it: the chevrons open and close (unrolling, rolling up), a click inside an open node moves the grey there, Esc closes the focus and hands it to its parent, the empty bullet takes words and Enter starts the next', 'wide'),
  spec('properties', '.rf-ol-prop', olWrap(O.prop({ kind: 'node', name: 'Target', value: O.pencil('Colon cancer') }) + O.prop({ kind: 'text', name: 'Therapy regimen', value: '<span class="rf-faint">empty</span>' }) + O.prop({ kind: 'number', name: 'Cycle', value: '1' }) + O.prop({ kind: 'date', name: 'Date', value: 'Oct 20' })), 'Logseq’s property row: a node property’s mark, a fact none with its room kept, the name quieter than the value, one column for the names; pencilled in, empty'),
  spec('bullets', '.rf-ol-bullet', olWrap(O.bullet({ html: 'Asked about the cold sensitivity' }) + O.bullet({ html: 'Wants a blood test before cycle 5' }) + O.newBullet({ label: 'A new bullet' })), 'written as a bullet: Logseq’s dot and the words; the faint empty one at the end takes a caret, no box, no line under it'),
  spec('pencilled in', '.rf-pencil', `<div class="line">${O.pencil('Colon cancer')} <span class="rf-note">proposed</span>&nbsp;&nbsp;<span>Colon cancer</span> <span class="rf-note">taken</span></div>`, 'what the proposals fill in, sure or guessed alike: italic, faint, a dotted line; a click or Enter takes it'),
  spec('trail', '.rf-ol-trail', `<div class="rf-ol">${O.trail([{ text: 'Dr. Mei Chen' }, { text: 'Spoke with Dr. Mei Chen about fatigue' }, { text: 'Fatigue' }], 'A bit better.' + tag('Symptom Log'), '<span class="rf-note" style="margin-left:auto">Esc steps back</span>')}</div>`, 'where you are: the names on the way, each a click back, the deepest last, with its tag', 'wide'),
  spec('find with a count', '.rf-field-count', `<div class="col" style="width:320px">${K.fieldHtml({ icon: 'find', placeholder: 'Find in what points here', count: 546 })}${K.fieldHtml({ icon: 'find', value: 'sampl', count: '12 of 546' })}</div>`, 'the kit’s field, the count at its end, never in the grey words'),
];
// The tag map's pieces (0.4.448, docs/MAP-DESIGN.md 5): the kit's own builders again, on the Illness Test Graph's real
// counts (read through the command line on 2026-10-27) and a slice of Scale Check. Every line of the map has its faint
// tick box, as the map's rows do.
const C = (held, of) => O.count({ held, of });
const pchev = (open = false, label = '') => O.chev({ open, label });
const L = (name, to, count, o = {}) => O.leads({ name, kind: o.kind || 'node', inherited: o.inh, to: to && { text: to, open: !!o.open, n: o.n }, count, tick: name ? tickBox(o.tick) : '', chev: name ? pchev(!!o.popen, name) : '' });
const P = (from, name, count, o = {}) => O.pointing({ from: { text: from, open: !!o.open }, name, count, tick: tickBox(o.tick) });
const tagLn = (name, count, open = false) => O.line({ tick: tickBox(), chev: O.chev({ open, label: name }), body: O.tag({ text: name, open }), end: count });
const doctorKids = O.kids({ from: 'leads', html: L('Works at', 'Organization', C(6, 9)) + L('Specialized in', 'Specialty', C(5, 9)) + L('Notes', null, C(0, 9), { kind: 'text', inh: true })
  + O.group('Pointed at by') + P('Decision', 'Decided by', C(4, 6)) + P('Cancer', 'Diagnosed by', C(1, 1)) + P('Consultation', 'Topic', C(1, 17)) + P('Conversation', 'Topic', C(0, 8)) });
const consKids = (docOpen, o = {}) => O.kids({ html: (docOpen ? O.unit({ focus: true, html: L('Provider', 'Doctor', C(14, 17), { open: true }) + doctorKids }) : L('Provider', 'Doctor', C(14, 17), { tick: o.tick }))
  + L('Topic', 'Symptom', C(12, 17), { n: 5, tick: o.tick }) + L('', 'Cancer', '', { n: 4 }) + L('', 'Disease', '', { n: 1 }) + O.more({ text: 'show all 15', under: 'leads' })
  + L('Date', null, C(16, 17), { kind: 'date', inh: true })
  + O.group('Pointed at by') + P('Conversation', 'Topic', C(0, 8)) + P('Consultation', 'Topic', C(0, 17)) });
const propOpen = O.kids({ html: L('Provider', 'Doctor', C(14, 17), { popen: true }) + O.kids({ html: O.prop({ kind: '', name: 'On tags', value: `${O.tag({ text: 'Consultation' })}` }) + O.prop({ kind: '', name: 'Reads back as', value: 'Provider' }) + O.prop({ kind: '', name: 'One or several', value: 'one' }) + O.prop({ kind: '', name: 'Group', value: '<span class="rf-faint">—</span>' }) })
  + L('Topic', 'Symptom', C(12, 17), { n: 5 }) + L('', 'Cancer', '', { n: 4 }) + O.more({ text: 'show all 15', under: 'leads' }) });
const undoMark = `<span class="rf-undo" role="button" title="Undo: Topic was empty on both">${I('undo')}</span>`;
const nmA = t => `<a href="#" class="rf-ol-name">${esc(t)}</a>`;
const mapPieces = [
  spec('bearings', '.rf-ol-sum', `<div class="rf-ol" style="max-width:640px">${O.sum([{ text: '22 tags' }, { text: '22 properties' }, { text: '4 to look at' }])}<div style="height:10px"></div>${O.sum([{ text: '509 tags, 104 with no nodes' }, { text: '299 properties, 280 that no node holds' }, { text: '253 to look at' }])}</div>`, 'the first line of the map, the Illness Test Graph and Scale Check: the shape of the whole as counts; each is a word that narrows the map to what it counts', 'wide'),
  spec('the count', '.rf-ol-count', `<div class="rf-ol" style="max-width:420px">${O.line({ body: 'used', end: C(14, 17) })}${O.line({ body: 'used by none', end: C(0, 9) })}${O.line({ body: 'one number', end: C(1173) })}${O.line({ body: 'nothing to count', end: C() })}${O.line({ cls: 'rf-hover', body: 'under the pointer', end: C(14, 17) })}</div>`, 'in its own column on the right, one width for every line: how many of how many nodes, a word that opens those nodes; faint when none, a faint dash when there is nothing to count; names never fade'),
  spec('a tag and where its properties lead', '.rf-ol-leads', olWrap(tagLn('Consultation', C(17), true) + consKids(false), 640, 'rf-ol-margin'), 'Consultation opened: each property with its own chevron, its kind and name in one column, the tag it leads to after it with its chevron to walk on, how many Consultations hold it on the right; a property leading to several tags takes a line for each, the nodes pointing at each counted after it (Topic: 5 point at a Symptom, 4 at a Cancer); inherited one step quieter; under a quiet heading, what points at Consultation, the other way round: the tag first, then the property, no kind icon', 'wide'),
  spec('walking on', '.rf-ol-from-leads', olWrap(tagLn('Consultation', C(17), true) + consKids(true), 640, 'rf-ol-margin'), 'Doctor opened right where it was, under its own name, in the faint grey of the focus, exactly as digging in the two-way section; Provider, the way here, is left out of what points at Doctor; 4 of the 6 Decisions point at a Doctor through Decided by; no Doctor holds Notes: its count is faint, its name is not', 'wide'),
  spec('a property opened', '.rf-ol-leads .rf-chev', olWrap(tagLn('Consultation', C(17), true) + propOpen, 640, 'rf-ol-margin'), 'Provider’s own chevron, at the line’s start, opens what it is under it: the tags it is on, how it reads on the pages it points at, one or several, its group; the chevron before Doctor walks on instead', 'wide'),
  spec('ticked, a long name', '.rf-ol-leads input.rf-check', olWrap(tagLn('Consultation', C(17), true) + consKids(false, { tick: 'on' }) + tagLn('Cancer', C(1), true) + O.kids({ html: L('Confirmation Status of the first diagnosis', null, C(1, 1), { kind: 'text', tick: 'on' }) + L('Diagnosed by', 'Doctor', C(1, 1)) }), 640, 'rf-ol-margin'), 'ticking properties on two tags to merge or move them: the tick box in the margin of its line, its box only, no grey; a long property name wraps in its column, never inside a word', 'wide'),
  spec('at scale', '.rf-ol-more', olWrap(tagLn('Artifact', C(3), true) + O.kids({ html: L('Related', 'Occurrence', C(575, 2092)) + L('', 'Interpretation', '') + L('', 'Work', '') + O.more({ text: 'show all 6', under: 'leads' }) + L('Topic', 'Concept', C(0, 2092))
    + O.group('Pointed at by') + P('Draft', 'Related', C(575, 575)) + P('Annual researcher', 'Related', C(0, 4)) + P('Annual review', 'Related', C(0, 9)) + O.more({ text: 'show all 131', under: 'bare' }) + P('Lab protocol', 'Depends on', C(0, 3))
    + O.group('Child tags') + tagLn('Document', C()) + tagLn('Source', C(12)) + O.more({ text: 'show all 12', under: 'bare' }) }), 640, 'rf-ol-margin'), 'Scale Check: Related points at Artifact from 131 tags, a line each, the few that use it among the first, then “show all”; no list grows with the graph until it is asked', 'wide'),
  spec('narrow, three levels', '@container rf-ol', olWrap(tagLn('Consultation', C(17), true) + O.kids({ html: O.unit({ html: L('Provider', 'Doctor', C(14, 17), { open: true }) + O.kids({ from: 'leads', html: O.unit({ focus: true, html: L('Works at', 'Organization', C(6, 9), { open: true }) + O.kids({ from: 'leads', html: L('Location', null, C(0, 5), { kind: 'text', inh: false }) + O.group('Child tags') + tagLn('Hospital', C(3)) + tagLn('Health system', C(2)) }) }) + L('Specialized in', 'Specialty', C(5, 9)) }) }) + L('Topic', 'Symptom', C(12, 17), { n: 5 }) + L('', 'Cancer', '', { n: 4 }) }), 400, 'rf-ol-margin'), 'at 400 px (the sidebar), three levels open: the tag a property leads to goes under its name, the counts keep their column, nothing runs into anything', 'wide'),
  spec('findings', '.rf-ol-finding', `<div class="rf-ol" style="max-width:640px">${O.sum([{ text: 'To look at', plain: true }, { text: 'Empty 230' }, { text: 'Move down 5' }, { text: 'Few words 3' }, { text: 'Alike 15' }])}${O.finding({ html: `${nmA('Status')} on ${O.tag({ text: 'Expectation' })} holds two words on ${C(11)} nodes: Planned 8, Done 3`, act: 'Make it a choice …' })}${O.finding({ html: `${O.tag({ text: 'Consultation' })} · ${C(2)} name a Symptom or a Person in their words, ${nmA('Topic')} empty`, act: 'Fill …' })}${O.finding({ cls: 'rf-hover', html: `${nmA('Cites')} on ${O.tag({ text: 'Source' })} is held only by ${O.tag({ text: 'Journal article' })} nodes (${C(391)})`, act: 'Move down to Journal article' })}${O.finding({ html: `${O.tag({ text: 'Source' })} · none of its ${C(1450)} nodes hold ${['Published', 'DOI', 'Topic', 'Year', 'Summary', 'Authors'].map(nmA).join(', ')}`, act: 'Take them off …' })}${O.finding({ done: true, html: `${O.tag({ text: 'Consultation' })} · Topic filled on 2 from their words ${undoMark}` })}${O.more({ text: 'show all 253', under: 'flush' })}</div>`, 'the kinds over the list, words that narrow it; one line each: what was found in plain words, its names and counts links, the one action at the end, faint until its line is under the pointer (the third); done: quieter, the faded Undo arrow after it; five, then “show all”', 'wide'),
];
// The working drawing runs the kit itself, put in the page, on a few nodes of the Illness Test Graph.
const liveScript = `<script>${fs.readFileSync(path.join(process.cwd(), 'parts', 'shared.js'), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>
<script>(function () {
  var K = window.refinementShared, O = K.outline, box = document.getElementById('ol-live');
  var N = { c: { t: 'Spoke with Dr. Mei Chen about fatigue', g: 'Consultation', d: 'Oct 29', props: [['node', 'Topic', 'f'], ['date', 'Date', 'Oct 29']], bullets: [] },
    f: { t: 'Fatigue', g: 'Symptom', back: [['Symptom type', ['s1', 's2', 's3']]], bullets: [] },
    s1: { t: 'A bit better.', g: 'Symptom Log', d: 'Oct 4', props: [['number', 'Severity', '1'], ['date', 'Date', 'Oct 4']], bullets: [] },
    s2: { t: 'Wiped out all day.', g: 'Symptom Log', d: 'Oct 2', props: [['number', 'Severity', '3']], bullets: [] },
    s3: { t: 'A bit better.', g: 'Symptom Log', d: 'Sep 20', props: [['number', 'Severity', '1']], bullets: [] } };
  var open = {}, focus = '', fresh = '';
  function kids(id, key, from) { return O.kids({ from: from, fresh: fresh === key, attrs: { 'data-key': key }, html: body(id, key) }); }
  function unit(line, id, key, from) { return open[key] ? O.unit({ html: line + kids(id, key, from), focus: focus === key, attrs: { 'data-key': key } }) : line; }
  function body(id, key) {
    var n = N[id], h = '';
    (n.props || []).forEach(function (p) {
      if (p[0] === 'node') { var k = key + '>' + p[2]; h += unit(O.prop({ kind: 'node', name: p[1], chev: O.chev({ open: !!open[k], attrs: { 'data-k': k, 'data-id': p[2] } }), value: '<span class="rf-ol-body">' + O.name({ text: N[p[2]].t, tag: N[p[2]].g, open: !!open[k] }) + '</span>' }), p[2], k, 'prop'); }
      else h += O.prop({ kind: p[0], name: p[1], value: p[2] });
    });
    (n.back || []).forEach(function (b) { b[1].forEach(function (x, i) { var k = key + '>' + x; h += unit(O.prop({ kind: 'node', name: i ? '' : b[0], value: '<span class="rf-ol-day">' + N[x].d + '</span>' + O.chev({ open: !!open[k], attrs: { 'data-k': k, 'data-id': x } }) + '<span class="rf-ol-body">' + O.name({ text: N[x].t, tag: N[x].g, open: !!open[k] }) + '</span>' }), x, k, 'back'); }); });
    n.bullets.forEach(function (t) { h += O.bullet({ html: t.replace(/&/g, '&amp;').replace(/</g, '&lt;') }); });
    return h + O.newBullet({ attrs: { 'data-node': id, 'data-key': key } });
  }
  function draw(caretIn) {
    box.innerHTML = unit(O.line({ tick: '<input type="checkbox" class="rf-check">', day: 'Oct 29', chev: O.chev({ open: !!open.c, attrs: { 'data-k': 'c', 'data-id': 'c' } }), body: O.name({ text: N.c.t, tag: N.c.g, open: !!open.c }) }), 'c', 'c', 'day');
    fresh = '';
    if (caretIn) { var f = box.querySelector('input[data-key="' + caretIn + '"]'); if (f) f.focus(); }
  }
  var up = function (k) { return k.split('>').slice(0, -1).join('>'); };
  function close(k) { O.close(box.querySelector('.rf-ol-kids[data-key="' + k + '"]'), function () { Object.keys(open).forEach(function (o) { if (o === k || o.indexOf(k + '>') === 0) delete open[o]; }); if (focus === k || focus.indexOf(k + '>') === 0) focus = open[up(k)] ? up(k) : ''; draw(); }); }
  box.addEventListener('click', function (e) {
    var c = e.target.closest('.rf-chev'); if (c) { e.preventDefault(); var k = c.dataset.k; if (open[k]) close(k); else { open[k] = 1; focus = fresh = k; draw(); } return; }
    if (e.target.closest('a')) { e.preventDefault(); return; }
    var inside = !e.target.closest('button, input') && e.target.closest('.rf-ol-kids[data-key]'); if (inside) { focus = inside.dataset.key; O.focus(box, focus); }
  });
  box.addEventListener('keydown', function (e) { var f = e.target.closest('input[data-node]'); if (f && e.key === 'Enter' && f.value.trim()) { N[f.dataset.node].bullets.push(f.value.trim()); draw(f.dataset.key); } if (f && e.key === 'Escape') f.blur(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && focus && !e.target.closest('input')) close(focus); });
  box.addEventListener('focusin', function (e) { var f = e.target.closest('input[data-key]'); if (f) { focus = f.dataset.key; O.focus(box, focus); } });
  draw();
})();</script>`;

// An action in stages, as the kit does it now: adding a property to a tag in the tag map.
const treeRow = (name, open = true) => `<div class="rtg-row rtg-root"><button type="button" class="rf-quiet rtg-fold${open ? '' : ' rtg-shut'}">${I('fold')}</button><div class="rtg-main"><div class="rtg-line"><span class="rtg-name">${esc(name)}</span></div></div></div>`;
const propRow = (kind, name, accepts = '') => `<div class="rtg-row rtg-prow"><button type="button" class="rf-quiet rtg-fold rtg-shut">${I('fold')}</button><div class="rtg-main"><div class="rtg-line"><i class="ti ti-${ICONS[kind]} rf-kind"></i><span class="rtg-pname">${esc(name)}</span><span class="rtg-ptype">${accepts}</span></div></div></div>`;
const stageBox = (kids) => `<div class="refinement-tags">${treeRow('Consultation')}<div class="rtg-kids">${propRow('node', 'Provider', tag('Doctor'))}${propRow('nodes', 'Topic', tag('Phenomena') + ', ' + tag('Doctor') + ' <span class="rf-note">· 11 more</span>')}${kids}</div></div>`;
const addsLine = `<div class="rtg-adds" style="opacity:1"><button type="button" class="rf-quiet rf-faint rtg-addline">+ Property</button><button type="button" class="rf-quiet rf-faint rtg-addline">+ Tag inside</button><button type="button" class="rf-quiet rf-faint rtg-addline">+ Description</button></div>`;
const stage1 = stageBox(addsLine);
const stage2 = stageBox(pop(`<span class="rf-field"><input type="text" value="Follow" placeholder="Type to find a property"></span><div class="rf-pop-body">${item('date', 'Follow-up', '', false)}${item('add', 'New property “Follow” …', '', true)}</div>`, 'refinement-tags-menu', 280, 'Add a property to Consultation'));
const stage3 = stageBox(pop(`<div class="rf-pop-body">${item('text', 'Text')}${item('number', 'Number')}${item('date', 'Date', '', true)}${item('yesNo', 'Checkbox', end('yes or no'))}${item('web', 'Web address')}${item('node', 'Link to nodes', end('picked from a tag'))}</div>`, 'refinement-tags-menu', 260, 'Follow holds …'));
const stage4 = stageBox(`<div class="rtg-row rtg-prow rtg-current"><button type="button" class="rf-quiet rtg-fold rtg-shut">${I('fold')}</button><div class="rtg-main"><div class="rtg-line"><i class="ti ti-${ICONS.date} rf-kind"></i><span class="rtg-pname">Follow</span><span class="rtg-ptype"></span><span class="rf-undo" role="button" title="Undo: Made Follow on Consultation">${I('undo')}</span></div></div></div>${addsLine}`);
const stagesHtml = `<div class="stages">
  <figure class="spec"><div class="sheet">${stage1}</div><figcaption><span class="part">1</span><span class="note">The pointer rests on the tag: faint words appear under its properties.</span></figcaption></figure>
  <figure class="spec"><div class="sheet">${stage2}</div><figcaption><span class="part">2</span><span class="note">“+ Property” pressed: the list pop-up under it, the properties that fit as you type, and a new one by the name typed.</span></figcaption></figure>
  <figure class="spec"><div class="sheet">${stage3}</div><figcaption><span class="part">3</span><span class="note">Enter on the new name: the kinds as a menu with their icons; arrows or a click pick one.</span></figcaption></figure>
  <figure class="spec"><div class="sheet">${stage4}</div><figcaption><span class="part">4</span><span class="note">The property is made through Logseq’s own box and takes its row, with a faded Undo arrow. No window at any point.</span></figcaption></figure>
</div>`;

// The kit's icon list: what each means and its name in Logseq's font.
const ICON_WORDS = { undo: 'Undo', sidebar: 'Open in the sidebar', page: 'Open as a page', fold: 'Fold, unfold (turns down when open)', add: 'Add', more: 'More', delete: 'Delete', find: 'Find', settings: 'Settings, tools', close: 'Close', remove: 'Remove', chosen: 'Chosen, on', help: 'What this means', map: 'The tag map', tag: 'A tag', property: 'A property', rename: 'Rename', copy: 'Copy', to: 'Points to', picked: 'Picked', warning: 'Warning', show: 'Show', hide: 'Hide', shortcut: 'Shortcut', twoWay: 'Two-way links', order: 'Move up or down', proposals: 'Proposals', date: 'A date (a kind of value)', text: 'Text (a kind of value)', number: 'A number (a kind of value)', choice: 'A choice (a kind of value)', several: 'Several (a kind of value)', yesNo: 'Yes or no (a kind of value)', web: 'A web address (a kind of value)', node: 'Points to a node (a kind of value)', nodes: 'Points to several nodes (a kind of value)', link: 'Link selected text' };
const iconsHtml = `<div class="glyphs">${Object.entries(ICONS).map(([meaning, name]) => `<div class="glyph"><div class="g">${T(name)}</div><div class="gl"><span class="part">${esc(ICON_WORDS[meaning] || meaning)}</span><code>${esc(meaning)} · ${DRAWN[name] ? 'drawn by the kit' : 'ti-' + esc(name)}</code></div></div>`).join('')}</div>`;

// ---------- Tables ----------
const summary = `
<table class="sum">
<thead><tr><th>Element</th><th>Drawings</th><th>From</th><th>In the kit as</th></tr></thead>
<tbody>
<tr><td><a href="#pops">Pop-up</a></td><td>1 box, 2 fillings, a question, a plan</td><td>the browser’s popover, placed by the browser</td><td><code>popup</code>, <code>ask</code></td></tr>
<tr><td><a href="#dialogs">Window</a></td><td>1</td><td>the browser’s dialog, dressed</td><td><code>dialog</code></td></tr>
<tr><td><a href="#buttons">Button</a></td><td>3: quiet, go, pressed</td><td>kit</td><td><code>quiet</code>, <code>go</code></td></tr>
<tr><td><a href="#finds">Field</a></td><td>1, in three coats (inline, tall, drawn)</td><td>kit</td><td><code>field</code>, <code>drawnField</code></td></tr>
<tr><td><a href="#ticks">Tick box</a></td><td>1</td><td>the browser’s checkbox</td><td><code>tick</code></td></tr>
<tr><td><a href="#chips">Words</a></td><td>tag, filter, removable, kind</td><td>kit</td><td><code>tag</code>, <code>chip</code>, <code>kindIcon</code></td></tr>
<tr><td><a href="#bars">Picking bar</a></td><td>1</td><td>kit</td><td><code>bar</code></td></tr>
<tr><td><a href="#pluses">The “+” to add</a></td><td>a quiet +, a field on the line, faint words</td><td>kit</td><td><code>quiet</code>, <code>field</code></td></tr>
<tr><td><a href="#peek">Hover card</a></td><td>1 (+ the browser’s tooltip for hints)</td><td>kit; the browser</td><td><code>card</code></td></tr>
<tr><td><a href="#icons">Icon</a></td><td>${Object.keys(ICONS).length} meanings, none drawn by the plugin</td><td>Logseq’s own icon font</td><td><code>ICONS</code>, <code>icon</code></td></tr>
<tr><td><a href="#undo">Undo</a></td><td>1</td><td>kit</td><td><code>undo</code></td></tr>
<tr><td><a href="#ghost">Proposed value</a></td><td>1</td><td>Logseq’s own pill, one mark</td><td>the proposals’ own class</td></tr>
<tr><td><a href="#help">Quiet words, help</a></td><td>2</td><td>kit</td><td><code>note</code>, <code>guide</code></td></tr>
</tbody></table>`;
const behind = `
<table class="behind">
<thead><tr><th>Done behind the scenes</th><th>Ways</th><th>Where</th></tr></thead>
<tbody>
<tr><td>Putting a box under what it belongs to</td><td>0 of the plugin’s own</td><td>the browser places every pop-up (anchor positioning) and flips it when there is no room</td></tr>
<tr><td>Closing a box on Escape or a click outside</td><td>0</td><td>the browser does it for the dialog and for every popover</td></tr>
<tr><td>Waiting for Logseq to draw something, pressing its buttons, typing into its fields</td><td>1</td><td>the screen door in layer 1 (<code>core.screen</code>: waitFor, press, typeInto, key, item, sidebarItems, escapeMenus)</td></tr>
<tr><td>Reading and writing the graph</td><td>1</td><td>the model in layer 1 (<code>parts/model.js</code>): every read and every write a part makes goes through its doors</td></tr>
<tr><td>Showing a notice at the top</td><td>1</td><td><code>notify</code>, which is Logseq’s own notice</td></tr>
<tr><td>Making an element, making text safe for the page</td><td>1 each</td><td><code>el</code> and <code>esc</code> in the kit</td></tr>
<tr><td>A shortcut, a palette command, a toolbar button, a menu item</td><td>1</td><td>the register in <code>main.js</code>: every command with its name, keys, icon and places; the settings window lists them under Shortcuts</td></tr>
<tr><td>A whole view hosted by Logseq (a page, a sidebar panel)</td><td>1</td><td><code>core.mountView</code> in layer 1 (the tag map)</td></tr>
<tr><td>What the pieces of a feature share</td><td>1</td><td><code>shared.feature(name)</code>: a bag by name, no name on the window</td></tr>
</tbody></table>`;

// ---------- The page ----------
const page = `<meta charset="utf-8">
<title>Refinements Elements</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: the field guide's bench and sheets. Every specimen sits on a white Logseq-like sheet and is drawn by the kit's
   own stylesheet, pulled from the source when this page was built. The guide's own marks are in one cobalt ink. */
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
h1, h2, h3 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.05; letter-spacing: -.015em; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.15; margin-top: 56px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.wrap > section > h3 { font: 600 .75rem var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); margin: 18px 0 8px; }
.ways { font: 500 .8rem var(--f-mono); color: var(--anno); background: var(--anno-wash); padding: 2px 8px; border-radius: 4px; }
.lead { font-size: 1.15rem; max-width: 60ch; color: var(--ink-2); margin: 14px 0 0; }
.intro { max-width: 70ch; margin: 6px 0 12px; color: var(--ink-2); }
.prose { max-width: 70ch; }
.prose p { margin: 10px 0; }
.prose ul { padding-left: 22px; }
.prose li { margin: 6px 0; }
.key { max-width: 70ch; margin: 14px 0 0; font-size: .98rem; color: var(--ink-2); }
.k-anno { color: var(--anno); font-weight: 600; }
.toolbar { display: flex; gap: 10px; align-items: center; margin: 22px 0 8px; font-size: .95rem; color: var(--ink-2); }
.toolbar button { font: inherit; padding: 4px 12px; border: 1px solid var(--rule); border-radius: 6px; background: transparent; color: var(--ink); cursor: pointer; }
.toolbar button[aria-pressed="true"] { background: var(--anno); color: #fff; border-color: var(--anno); }
table.sum, table.behind { width: 100%; border-collapse: collapse; margin: 18px 0 0; font-size: .98rem; }
table.sum th, table.behind th { text-align: left; font: 600 .75rem var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); padding: 6px 10px 6px 0; border-bottom: 1px solid var(--rule); }
table.sum td, table.behind td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
table.sum a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--anno); text-underline-offset: 3px; }
table code, figcaption code, .gl code { font: 500 .78rem var(--f-mono); color: var(--ink); background: var(--anno-wash); padding: 1px 5px; border-radius: 3px; }
.tablewrap { overflow-x: auto; }
.row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.spec { margin: 0; flex: 1 1 260px; max-width: 100%; min-width: 0; }
.spec.wide { flex-basis: 100%; }
.spec.wide .sheet { max-width: 680px; }
/* a line drawn as under the pointer, to show that state at rest */
.sheet .rf-hover { background: var(--rf-wash); } .sheet .rf-hover > .rf-ol-act { color: var(--rf-quiet); }
.sheet { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; padding: 18px 16px; font: 16px/1.5 var(--f-ls); overflow: auto; min-height: 60px;
  --popover: 0 0% 100%; --popover-foreground: 0 0% 9%; --rf-fg: hsl(var(--popover-foreground)); --rf-bg: hsl(var(--popover));
  --ls-primary-text-color: #262a30; --ls-secondary-text-color: #6c737d; --ls-primary-background-color: #ffffff; --ls-border-color: #e2e5e9; --lx-accent-11: #2d6cc0; }
.dark .sheet { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-sec: #8e96a0; --sheet-border: #343a42;
  --popover: 220 7% 14%; --popover-foreground: 0 0% 88%;
  --ls-primary-text-color: #d8dce1; --ls-secondary-text-color: #8e96a0; --ls-primary-background-color: #1f2328; --ls-border-color: #343a42; --lx-accent-11: #8ab4f8; }
.sheet a:not([class*="rf-"]) { color: inherit; text-decoration: none; }
figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 6px; font-size: .86rem; color: var(--ink-2); }
figcaption .part { color: var(--anno); font-weight: 600; }
figcaption .note, .gl .note { flex-basis: 100%; }
.glyphs { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.glyph .g { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; height: 64px; display: flex; align-items: center; justify-content: center; font-family: var(--f-ls); font-size: 22px; }
.dark .glyph .g { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-border: #343a42; }
.gl { display: flex; flex-wrap: wrap; gap: 2px 8px; margin-top: 5px; font-size: .8rem; color: var(--ink-2); }
.gl .part { color: var(--anno); font-weight: 600; }
.rec { margin: 14px 0 14px; padding: 14px 16px 14px 18px; border-left: 3px solid var(--anno); background: var(--anno-wash); border-radius: 0 8px 8px 0; max-width: 78ch; }
.rec .verdict { font: 600 .75rem var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--anno); margin-bottom: 6px; }
.rec dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
.rec dt { font-weight: 600; color: var(--ink-2); }
.rec dd { margin: 0; }
.tooltip-mock { position: relative; display: inline-block; padding-bottom: 34px; }
.tip-anchor { border-bottom: 1px dotted currentColor; }
.tip { position: absolute; left: 12px; top: 26px; font: 12px system-ui; background: #f2f2f2; color: #1d1d1f; border: 1px solid rgba(0,0,0,.18); border-radius: 4px; padding: 3px 7px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
.dark .tip { background: #2c2c2e; color: #e5e5e7; border-color: rgba(255,255,255,.14); }
.stages { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 10px; }
.stages .spec { flex: none; }
.stages .sheet { font-size: 14px; min-height: 150px; }
footer { margin-top: 60px; color: var(--ink-2); font-size: .9rem; border-top: 1px solid var(--rule); padding-top: 14px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

/* ===== The kit's stylesheet and the parts' own layout, as the plugin sends them to Logseq (built from the source) ===== */
${css('shared-kitCss')}
${css('two-way-twoWayCss')}
${css('tags')}
${css('shadow')}
${css('settings-panel')}
/* ===== end of the plugin's stylesheets ===== */
/* On a sheet a pop-up sits in the flow, and the one window is open and sized to its sheet. */
.sheet .rf-pop { position: static !important; transform: none !important; max-width: 100%; }
.sheet .rf-pop.rf-card { position: static !important; }
.sheet dialog.rf-dialog { position: static; margin: 0; width: 100%; max-width: 700px; height: auto; max-height: none; min-height: 300px; font-size: 14px; }
.sheet .refinement-tags { padding: 0; font-size: 15px; }
.sheet .refinement-two-way { margin: 0; padding-left: 24px; }
.sheet .rf-bar { position: static; }
.sheet .rf-tw-pick { opacity: .35; }
.sheet .line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 14px; }
.sheet .col { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; font-size: 14px; }
.sheet .col .line { align-items: baseline; gap: 6px; }
.sheet .rtg-pname { color: var(--rf-quiet); }
.sheet .rtg-tv { color: var(--rf-quiet); }
.sheet .bottom-properties-row { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; }
.sheet .bottom-property-pill { display: inline-flex; align-items: baseline; gap: .3em; }
.sheet .property-key-inner { color: var(--rf-faint); }
.sheet .rtg-namefield { display: flex; align-items: baseline; gap: 10px; margin: 6px 0; }
.sheet .rtg-namefield .rf-field { flex: 1; }
.sheet .rtg-note { color: var(--rf-faint); font-size: 13px; }
.sheet ul { margin: 6px 0 8px; padding-left: 18px; }
.sheet kbd { font: inherit; font-size: .85em; }
</style>
<div class="wrap">
  <header>
    <h1>The plugin’s elements: one drawing per kind</h1>
    <p class="lead">Every kind of thing the loaded parts put on screen, drawn once by the kit (<code>parts/shared.js</code>, docs/LAYERS.md section 3), with the kit’s own stylesheet pulled from the source when this page was built. Each part draws only its layout with these pieces; a new kind of thing goes into the kit first.</p>
    <p class="key"><span class="k-anno">Blue</span> marks are this page’s own notes. The sheets themselves carry no mark of this page: what is on a sheet is what Logseq shows, drawn by the kit.</p>
    <div class="toolbar" role="group" aria-label="Sheet colours"><span>Logseq’s theme on the sheets:</span><button type="button" id="light" aria-pressed="true">Light</button><button type="button" id="dark" aria-pressed="false">Dark</button></div>
  </header>

  <section id="summary">
    <h2>At a glance</h2>
    <div class="tablewrap">${summary}</div>
  </section>

  <section id="grammar">
    <h2>The grammar</h2>
    <div class="prose">
      <p><b>The plugin fades away.</b> Things are told apart by weight and grey, not by boxes, pills or fills. An action happens in stages, one thing appearing after the other, in place; the one window is the settings. Italic is only for a value the proposals pencil in, always with a dotted line under it; nothing else is italic. A tag reads as a class: mono, no #.</p>
      <p><b>Colour is the last key.</b> Today the kit uses Logseq’s pop-up colours, its text colour and four greys mixed from it (quiet, faint, a hairline, a line, a wash), in both themes. Every icon is Logseq’s own icon font.</p>
      <p><b>Three places an element comes from,</b> tried in this order: Logseq’s own (colours, the icon font, its property pills for a proposed value, its notice, its lists for the pickers); the browser’s own (the dialog, the popover that dismisses and places itself, the checkbox, the tooltip); the kit, for what neither gives (a list with a field, words for chips, the picking bar, the hover card, the Undo arrow, the quiet line).</p>
    </div>
  </section>

  <section id="stages">
    <h2>An action in stages <span class="ways">the shape of every edit</span></h2>
    <p class="intro">How the kit stages an action, with one example: adding a property to a tag in the tag map. Nothing appears before it is needed, each step appears where the last one was, and the thing is done where it will live.</p>
    ${stagesHtml}
  </section>

  ${section('pops', 'Pop-ups', '1 box', 'The browser’s popover, placed under its anchor by the browser and flipped when there is no room, dismissed by it on Escape or a click outside; the kit gives it Logseq’s own [[ menu look. Two fillings: a menu and a list. A question is the same box with the words, a note and the two buttons; a plan is the box with lines and fields.', [
    spec('menu', '.rf-pop .rf-item', popMenu, 'an icon, the words, a key'),
    spec('list', '.rf-pop .rf-field', popList, 'the kit’s field, then the rows that fit; a tag on a row in mono, the place at the right'),
    spec('question', '.rf-ask', popAsk, 'beside what it is about: Cancel and the one that does it as words'),
    spec('question with a field', '.rf-ask .rf-field', popAskField, 'a name, a description, a wording'),
    spec('plan', '.refinement-tags-dialog', popPlan, 'what will change as lines, fields to change, the note, the two words', 'wide'),
  ], from('The browser’s popover, dressed by the kit', 'One box (<code>shared.popup</code>: <code>.rf-pop</code>, <code>.rf-pop-head</code>, <code>.rf-pop-body</code>) with items (<code>.rf-item</code>: icon, words, a key or a check or a word at the right) or a field and rows that narrow as you type; Up, Down and Enter handled once in the kit. A question is <code>shared.ask</code>; a plan a pop-up filled by the tag map.', 'every menu of the tag map and the two-way rows, the tag and property lists, the link box, the troubleshooting list, the reports, every rename, description and wording box, the three plans (a merge, a child tag, links), the choices panel'))}

  ${section('dialogs', 'The window', '1', 'The one real window: the browser’s own dialog, shown modal, dressed by the kit. The browser keeps the keyboard, closes on Escape and draws the backdrop.', [
    spec('settings', 'dialog.rf-dialog', dlgSettings, 'the find field, the sections as quiet words with icons, rows with a tick box, two words or removable words', 'wide'),
  ], from('The browser’s dialog, dressed by the kit', '<code>shared.dialog</code>: a <code>&lt;dialog&gt;</code> with the kit’s edge, corners and shadow, built by its one user.', 'the settings window'))}

  ${section('buttons', 'Buttons', '3', 'Something to press. Three, none filled or edged: words that are a little darker than the words around them.', buttons, from('The kit', '<code>shared.quiet</code> (greyed words or an icon, lit under the pointer; faint for what can be made or cleared), <code>shared.go</code> (the one that does what was asked), and a quiet button with <code>aria-pressed</code> for the one in force; two side by side with a hairline between them are <code>.rf-seg</code>.', 'every part: the tools of the tag map, the + and ⋯ on its rows, the lines’ Change …, the bar’s actions, Cancel and the go word of every question, the settings window’s sections and footer'))}

  ${section('finds', 'The field', '1', 'A text box drawn as a hairline underneath, firmer while typing; an icon on the left and a key hint on the right when given. Inline on a line, taller for a description, and drawn (not real) for the one box whose keystrokes must keep going to the bullet.', fields, from('The kit', '<code>shared.field</code> (<code>.rf-field</code>; <code>rf-field-inline</code>, <code>rf-field-tall</code>) and <code>shared.drawnField</code> for the link box, which looks the same.', 'the tag map’s find box and every list pop-up, the settings window’s find box and text settings, a new tag’s or property’s name on its line, a choice’s name in the choices panel, the two-way rows’ draft line, the link box'))}

  ${section('ticks', 'The tick box', '1', 'Something that is on or off: the browser’s checkbox drawn as a small rounded square with a check mark inside when on. A chosen row in a menu shows the check icon instead.', ticks, from('The browser’s checkbox, dressed by the kit', '<code>shared.tick</code> (<code>input.rf-check</code>, with its words in <code>label.rf-tick</code>); the keyboard and the screen reader are the browser’s.', 'the pick boxes left of the two-way rows, the count in the picking bar, every on/off setting'))}

  ${section('chips', 'Words for chips', '4', 'A small labelled thing is words at a weight, never a pill: a tag as a class, a filter in force or not, a removable item with a × under the pointer, and a value’s kind as an icon.', words, from('The kit', '<code>shared.tag</code> (<code>.rf-tag</code>: mono, no #, the tag grey, a link’s faint underline), <code>shared.chip</code> (<code>.rf-chip</code> pressed or with a <code>.rf-chip-x</code>), <code>shared.kindIcon</code> (<code>.rf-kind</code>, from the icon list).', 'the tags at the right of the two-way rows and on every line of the tag map, the kinds above an open list, the graphs and pages named in the settings, the kind left of every property’s name'))}

  ${section('bars', 'The picking bar', '1', 'The bar that appears when something is ticked: the count with its tick box, the actions as quiet words with icons, Clear faint at the end; one line with a hairline under it, in the flow above the rows.', bars, from('The kit', '<code>shared.bar</code> (<code>.rf-bar</code>, <code>.rf-count</code>); each part hands it its actions.', 'the two-way rows (sidebar, change to, remove, tag, copy, set or unset a property, delete), the tag map (to the top level, move to)'))}

  ${section('pluses', 'The “+” to add', '3', 'Where a new thing can be made: a quiet + at the end of a row, the kit’s field opening on the line, faint words under an open tag. Nothing is there until it is needed.', pluses, from('The kit', 'A quiet faint button whose words say what it adds, then <code>shared.field</code> inline; no drawing of their own.', 'the two-way rows’ + and draft line, the tag map’s + on a row, + New tag, + New property, + New group and the line of faint words under an open tag'))}

  ${section('peek', 'The hover card', '1', 'What shows when the pointer rests on a node: the kit’s card, a popover of the hint kind placed by the browser; every piece opens what it names. A short hint on a control is the browser’s own tooltip.', cards, from('The kit; the browser', '<code>shared.card</code> (<code>.rf-card</code>: title, tag, day, fields, first lines); <code>title="…"</code> for a hint.', 'the two-way rows’ hover card; tooltips everywhere'))}

  ${section('icons', 'Icons', `${Object.keys(ICONS).length} meanings`, 'Icons come from Logseq’s Tabler icon font, loaded on every page, so an icon is one short tag with a name; the one shape the font lacks, a node property’s three dots joined in a triangle, the kit draws once. The kit keeps one list: what each icon means and which name draws it; a part asks for a meaning, never a name.', [], from('Logseq’s own icon font', '<code>shared.ICONS</code>, <code>shared.icon(doc, meaning)</code>, <code>shared.iconHtml(meaning)</code>.', 'every icon of every part: the toolbar button, the chevrons, the kinds, the menus, the Undo arrow'), iconsHtml)}

  ${section('undo', 'Undo', '1', 'The one Undo: a faded arrow at the end of what changed, saying what it takes back when pointed at; a click takes it back. Several changes keep several arrows. When nothing of the change is left on screen, the arrow waits at the bottom right with its words.', undos, from('The kit', '<code>shared.undo.offer({ key, at, text, run })</code>; the arrow is the font’s.', 'every change of every part: a proposal filled in, a node added from the rows, every change in the tag map'))}

  ${section('ghost', 'Proposed values', '1', 'What the proposals pencil into a bullet’s own properties: inside Logseq’s own pill, italic grey with a dotted line, sure or guessed alike. A proposed tag reads in mono without the #.', ghosts, from('Logseq’s own pill, one mark', 'The proposals’ own class (<code>.rfs-ghost</code>) on Logseq’s pill markup, with the kit’s greys; a tag inside it is the kit’s tag.', 'the proposals'))}

  ${section('outline', 'The outline', '1 tree', 'Something that opens under something, the same everywhere: one chevron right before the name it opens, what it holds under that name with one hairline down from the chevron, nothing moving when it opens. The section opened last is the focus, on a very faint grey (the grey is the focus’s alone), its line and everything under it. One name per line where a name can open; a property’s line as Logseq draws it; a bullet as a bullet.', outlines, from('The kit (0.4.441)', '<code>shared.outline</code>: <code>chev</code>, <code>name</code>, <code>line</code>, <code>kids</code>, <code>unit</code>, <code>prop</code>, <code>bullet</code>, <code>newBullet</code>, <code>more</code>, <code>pencil</code>, <code>trail</code>, <code>tie</code>, and the behaviour <code>close</code> (rolling up) and <code>focus</code> (moving the wash); <code>shared.chevron</code> for a part that builds elements; <code>shared.field</code> and <code>fieldHtml</code> with a <code>count</code>; <code>shared.undo.near</code>, an Undo found again by its row.', 'the two-way section and the tag map (0.4.456: the map is one outline)'))}

  ${section('mappieces', 'The tag map’s pieces', '6', 'The structure walked as the content is (0.4.448, docs/MAP-DESIGN.md): a tag opens into its properties, each with the tag it leads to and how much it is used, then what points at it; the tag a property leads to opens under its own name, as a node does in the two-way section. A count opens the nodes it counts. What may want work is a finding, one line with its action. Built alone here first; the map moves onto them in the next stages.', mapPieces, from('The kit (0.4.448)', '<code>shared.outline</code>: <code>sum</code>, <code>count</code>, <code>tag</code>, <code>leads</code>, <code>pointing</code>, <code>group</code>, <code>finding</code>, <code>line</code>’s <code>end</code> and <code>more</code> under <code>leads</code>; the model’s <code>structureUse</code> reads the counts.', 'the tag map’s outline and its findings (0.4.456)'))}
  ${section('help', 'Quiet words and help', '2', 'A quiet line for a hint under a field, a note in a pop-up or quiet words on a row; a help paragraph, quiet grey with a hairline down its left, for the longer “what this means” under the info icon.', helps, from('The kit', '<code>shared.note</code> (<code>.rf-note</code>) and <code>shared.guide</code> (<code>.rf-guide</code>).', 'every pop-up’s note, the settings window’s descriptions, the tag map’s small words and its help paragraphs'))}

  <section id="behind">
    <h2>Behind the scenes <span class="ways">not drawn</span></h2>
    <p class="intro">Things done one way only, with no picture: how a box is placed, how Logseq is waited for and pressed, how the graph is read and written, how a notice is shown, how shortcuts are registered.</p>
    <div class="tablewrap">${behind}</div>
  </section>

  <section id="kit">
    <h2>The kit</h2>
    <div class="prose">
      <p><b>From Logseq:</b> colours; property pills for proposed values; its own lists for the pickers; its icon font; its notice at the top.</p>
      <p><b>From the browser:</b> the dialog; pop-ups that dismiss and place themselves; the tick box; tooltips for hints.</p>
      <p><b>Drawn by the kit, once each:</b> the pop-up box with a menu filling and a list filling; the dialog’s dressing; three buttons; one field in three coats; words for filters and removable items, the tag as a class, kinds as icons; the picking bar; the hover card; the Undo arrow; the quiet line and the help paragraph; the icon list.</p>
      <p>Every loaded part draws only its layout with these, calls Logseq only through layer 1 (the model, the screen door, the register, the notice) and publishes no name on the window; <code>tools/leaning-test.js</code> keeps it so.</p>
    </div>
  </section>

  <footer>Built ${new Date().toISOString().slice(0, 10)} from the plugin’s source at 0.4.319: the stylesheets are the kit’s own and the parts’ layout, the markup follows what the kit builds, and Logseq’s colours are approximated on the sheets. Source of truth: <code>docs/ELEMENTS.html</code> in the plugin folder, built by <code>tools/pages/build-elements.js</code>.</footer>
</div>
${liveScript}
<script>
(function () {
  var wrap = document.querySelector('.wrap'), light = document.getElementById('light'), dark = document.getElementById('dark');
  function set(isDark) {
    wrap.classList.toggle('dark', isDark);
    light.setAttribute('aria-pressed', String(!isDark)); dark.setAttribute('aria-pressed', String(isDark));
    try { localStorage.setItem('rf-elements-theme', isDark ? 'dark' : 'light'); } catch (e) {}
  }
  light.addEventListener('click', function () { set(false); });
  dark.addEventListener('click', function () { set(true); });
  var saved = null; try { saved = localStorage.getItem('rf-elements-theme'); } catch (e) {}
  if (saved === 'dark') set(true);
})();
</script>
`;
fs.writeFileSync(path.join(process.cwd(), 'docs', 'ELEMENTS.html'), page);
console.log('wrote docs/ELEMENTS.html', Math.round(page.length / 1024), 'KB');
