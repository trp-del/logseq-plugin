/* The rules that are a stylesheet (with one pass, marking the # a table writes before a tag): links, journal days, tags, property names and capsules, the words by a title, empty
   properties, the pencil after a date. Nothing is read from the graph and nothing moves on the page: the pills keep their
   height, the hidden # its slot. */
(function () {
const Look = window.Look;
const { style } = Look.kit, { setting } = Look.settings;
const { link, out, tag } = window.PluginDoor.LOOKS;   // a link's line, the ↗ after a web address, a tag's name: the door's, written once
const AREA = ':is(#main-content-container, #right-sidebar)';
const DAY = ':is([data-uuid^="00000001-"], .ls-datetime *)'; // Logseq 2.0.2 gives every journal page a uuid starting 00000001-

const links = `
${AREA} a.page-ref:not(.tag):not(${DAY}) { color: inherit !important; ${link()} }
${AREA} a.page-ref:not(.tag):not(${DAY}):hover { text-decoration-color: currentColor !important; }
${AREA} a.page-ref a.asset-ref { color: inherit !important; }
/* A file in the graph (a PDF, a document) is a link like any other: the words' colour, underlined, not Logseq's slate. */
${AREA} a.asset-ref:not(a.page-ref *) { color: inherit !important; ${link()} }
${AREA} a.asset-ref:not(a.page-ref *):hover { text-decoration-color: currentColor !important; }
/* A PDF says so after its name, small and grey as the other things after a bullet's words, beside Logseq's book icon before it
   (the owner, 11 November 2026: "in addition to book"). Inline-block, so the link's underline stops at the name. */
${AREA} a.asset-ref.is-pdf:not(a.page-ref *)::after { content: "PDF"; display: inline-block; margin-left: .5em; font-size: var(--lk-small); color: var(--lk-quiet); text-decoration: none; }
/* A web address is a link like the others, the words' colour with the faint line under it, and a ↗ after it in the quiet
   grey says it leaves Logseq (the owner, 11 November 2026: first before it, then "put it at end of link"). Inline-block, so the underline stops at the words. */
${AREA} a.external-link { color: inherit !important; border-bottom: none !important; ${link()} }
${AREA} a.external-link:hover { text-decoration-color: currentColor !important; }
${AREA} a.external-link::after { ${out} }
/* A bullet that is a page, or shows one: its words read as a link. A press opens the page (Predictive's page-here.js). */
${AREA} :is(.embed-block:not(.embed-block .embed-block) > .block-main-container, .block-main-container:not(.is-page-title-row):has(> .block-control-wrap :is(.ls-icon-file, .ls-icon-page))) .block-title-wrap { ${link(false)} cursor: pointer; }
${AREA} :is(.embed-block:not(.embed-block .embed-block) > .block-main-container, .block-main-container:not(.is-page-title-row):has(> .block-control-wrap :is(.ls-icon-file, .ls-icon-page))) .block-title-wrap:hover { text-decoration-color: currentColor; }
/* Under the pointer Logseq paints a link's box in its accent colour at strength; here the faint wash of a row under the
   pointer, the same for every link. Its colour alone, so the sort's mark, drawn as the link's background image, stays. */
${AREA} .page-reference:hover, ${AREA} a.page-ref:hover, ${AREA} .preview-ref-link:hover { background-color: var(--lk-wash) !important; }`;
/* A day mentioned in the words is quiet grey. In a property's value (a page's list, the line under a node) the quiet grey
   would read as the name's grey, so there a day keeps the value's colour, no underline, quiet only under the pointer; the
   calendar icon and the name already say it is a date. */
const VALUE = ':is(.property-value-container, .bottom-property-pill)';
const days = `
${AREA} a.page-ref${DAY}, ${AREA} .ls-datetime a { color: var(--lk-quiet) !important; text-decoration: none !important; }
${AREA} a.page-ref${DAY}:hover, ${AREA} .ls-datetime a:hover { color: inherit !important; }
${AREA} ${VALUE} a.page-ref${DAY}, ${AREA} ${VALUE} .ls-datetime a { color: inherit !important; }
${AREA} ${VALUE} a.page-ref${DAY}:hover, ${AREA} ${VALUE} .ls-datetime a:hover { color: var(--lk-quiet) !important; }`;
/* A tag: its name alone, as written, in the serif, upright (New York, --lk-tag-face), in the quiet grey (the text colour under the pointer), the words' size, where Logseq puts it. Logseq draws a # link before the name and swaps it
   for an × under the pointer; the # is made invisible in a fixed slot and the × takes the same slot, so the name never moves. */
const tags = `
${AREA} .block-tag :is(a.hash-symbol, a[title="Remove this tag"]) { display: inline-flex !important; align-items: center; justify-content: center; width: 1.1em; margin: 0 !important; padding: 0 !important; }
${AREA} .block-tag a.hash-symbol { visibility: hidden; }
${AREA} a.tag:not(mark *) { ${tag(false)} opacity: 1; }
${AREA} .block-tag:hover { background: var(--lk-wash) !important; }
${AREA} a.tag:not(mark *):hover { color: var(--lk-text, currentColor) !important; }
/* In a pane under 600px Logseq stacks a bullet's tag under its words, however short they are. It stays beside them while they keep 20em, or half
   the pane in a narrower one (the right sidebar: the audit's 37), and only then drops, keeping the right edge it has beside them, so tags read
   as one column at any width. */
${AREA} .block-row:not(.ls-page-title-container *) { flex-direction: row !important; flex-wrap: wrap; }
${AREA} .block-row:not(.ls-page-title-container *) > .block-content-wrapper { flex: 1 1 min(20em, 50%); min-width: 0; }
${AREA} .block-row > .ls-block-right { margin-left: auto !important; }
/* A tag by a title is the size of any other tag, not the title's. A day's own tag shows only under the pointer, so its row holds no line of its own under the title. */
${AREA} .ls-page-title-container .block-tag { font-size: 16px; line-height: 1.5; }
${AREA} .ls-page-title-container .block-row:not(:has(.lk-path)) { flex-direction: row !important; }
/* In Logseq's tables a tag's cell writes the # into the name itself ("#Consultation"); the # is clipped off in place, the name
   standing where it stood (10 November 2026, the audit's 22). Its width in the tag's face, --lk-hash (in em), is measured once
   below. Only a name that starts with # is marked. */
${AREA} .ls-table-cell a.tag > span[data-lk-hash] { display: inline-block; margin-left: calc(-1 * var(--lk-hash, .6em)); clip-path: inset(0 -.2em 0 var(--lk-hash, .6em)); }`;
// Marks a table's tag name that starts with #, so the stylesheet above can clip it; unmarks it when the setting is off.
// The # in the tag's own face, as a share of its size, set once on the page's root for the clip above.
const hashWidth = doc => {
  const root = doc.documentElement; if (root.style.getPropertyValue('--lk-hash')) return;
  const view = doc.defaultView; if (!view?.getComputedStyle) return;
  const face = view.getComputedStyle(root).getPropertyValue('--lk-tag-face').trim(); if (!face) return;
  let ctx = null; try { ctx = doc.createElement('canvas').getContext('2d'); } catch {} if (!ctx) return;
  ctx.font = `100px ${face}`; root.style.setProperty('--lk-hash', `${(ctx.measureText('#').width / 100).toFixed(3)}em`);
};
const hashes = doc => { hashWidth(doc); const on = !!setting('tagsAsClasses'); for (const span of doc.querySelectorAll('.ls-table-cell a.tag > span')) { const want = on && span.textContent.startsWith('#'); if (want !== span.hasAttribute('data-lk-hash')) span.toggleAttribute('data-lk-hash', want); } };
let hashWatched = false;
function watchHashes() {
  const doc = Look.kit.host();
  if (!hashWatched) { hashWatched = true; Look.kit.watchScreen(hashes, hashes); Look.kit.onStop(() => { hashWatched = false; for (const span of Look.kit.host().querySelectorAll('[data-lk-hash]')) span.removeAttribute('data-lk-hash'); Look.kit.host().documentElement.style.removeProperty('--lk-hash'); }); }
  hashes(doc);
}
/* The greys are mixed from currentColor, so they are set once per box and inherited, never on every descendant. The
   value keeps the text colour; the name, one level in, is a shade lighter. */
const names = `
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child,
${AREA} .ls-properties-area .property-pair .property-key-panel { color: var(--lk-quiet) !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child *:not(.tag),
${AREA} .ls-properties-area .property-pair .property-key-panel *:not(.tag) { color: inherit !important; }`;
/* The faint dot stands before every property that follows a filled one. A property holding a pencil (a value proposed by
   Predictive) counts as filled, so the row does not re-space when the pencil turns solid. */
/* An empty property in a page's list is shown, its name in the faint grey that says empty (the owner, 12 November 2026, on a page
   that showed only "+ Add property" though its tag gives it Treats and Ordered by: "those are supposed to be seen"). Until then it
   was folded away until it had the keyboard (1 November), which hid what a tag gives its pages. The stylesheet tells an empty one
   by Logseq's own marks, so the name is faint from the first frame: marked by script after Logseq had drawn it (0.3.100), the name
   stood in the names' grey and turned fainter a moment later on every page (the motion check, 12 November 2026). */
const EMPTY_ROWS = `${AREA} .ls-properties-area.ls-page-properties .property-pair:has(> .property-value-container :is(.is-blank, .empty-value)):not(:focus-within) > .property-key-panel { color: var(--lk-off) !important; }`;
const FILLED = ':is(:not(:has(.empty-value)), :has(.lk-pencil))';
const capsules = `
/* A bullet's properties under its words keep Logseq's own spacing (12 November 2026, the owner, on the gap under
   Provider / Topic / Date: "do what logseq does normally"): the 6px room added on 8 November is gone. */
/* Lines stay Logseq's own, close (9 November 2026, the owner, after 34px then 30px rows: "this needs to be tighter. lines in
   general"): properties and bullets keep Logseq's line spacing; only "+ Add property" stands a little apart from the rows. */
${AREA} .ls-new-property { margin-top: 10px; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill { background: transparent !important; padding-left: 4px !important; padding-right: 4px !important; margin-inline: -4px; overflow: visible !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:not(:focus-within)::after { box-shadow: none !important; border: 0 !important; }
${AREA} .ls-block .positioned-properties.block-below,
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-row { margin-inline: -8px !important; padding-inline: 8px !important; width: calc(100% + 16px) !important; max-width: none !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-pills-strip { margin-inline: -8px !important; padding-inline: 8px !important; width: calc(100% + 16px) !important; max-width: none !important; }
/* A value being written under a bullet (a number, words) takes the width of what is in it, not Logseq's long box. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill input.ui__input { field-sizing: content; width: auto !important; min-width: 3ch; max-width: 40ch; height: 24px !important; line-height: 24px; padding: 0 2px !important; border: 0 !important; box-shadow: none !important; outline: none !important; background: transparent !important; }
/* Room above and below inside the strip, given back outside, so the press after a value catches a pointer a little off the line. */
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-pills-strip { margin-block: -8px !important; padding-block: 8px !important; width: 0 !important; flex-wrap: wrap !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-row { height: auto !important; max-height: none !important; overflow: visible !important; }
/* The first property on a wrapped line: the space before it stands at nothing, so the name lines up with the line above. The space keeps its room, so the wrap does not change.
   Only a property that has that space, one after a filled property: after empty ones alone it has none, and moved all the same its
   name was cut off at the pane's left edge ("Topic:" read "ɔic:" in the Item tab, 12 November 2026). */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill[data-lk-line] { transform: translateX(-28px); }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill[data-lk-line]::before { visibility: hidden; }
/* The property with the keyboard: a capsule round it, close top and bottom, a little room at each end (the owner: "make it a capsule"). */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:focus-within::after { inset: 1px -4px !important; border-radius: 999px !important; box-shadow: inset 0 0 0 1px var(--lk-line) !important; }
/* Between one property and the next, space alone (the owner, 4 November 2026: the dot was not needed), one width after every
   property, the width of the press Look puts after a value (values.js), which stands in it under the pointer. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill::before { content: ''; display: inline-block; width: 24px; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill:focus-within::after { left: 24px !important; }`;
const titleWords = `
${AREA} .ls-page-title-actions { visibility: hidden !important; pointer-events: none !important; }`;
const emptyProps = `
${AREA} .ls-block > .block-main-container .positioned-properties.block-below .bottom-property-pill:has(.empty-value):not(:focus-within) { opacity: .5; }
/* A page property's value and its bullet stand level with its name (12 November 2026, the owner, on a Date: "a little higher than
   its label"): Logseq draws a value of words, a day or a choice 24px tall at the top of a 28px row, its name centred in it, so
   both stood 2px high. A value that is a block of its own keeps Logseq's place. */
${AREA} .property-pair > .property-value-container:not(:has(.ls-block)) > :is(.property-panel-bullet, .property-value) { margin-top: 2px; }`;
/* Logseq's "+ Add property" under a page's list, a filled bold button, as a faint word. */
const addProperty = `
${AREA} .ls-new-property button { background: none !important; box-shadow: none !important; border: 0 !important; color: var(--lk-quiet) !important; font-weight: 400 !important; padding-left: 0 !important; }
${AREA} .ls-new-property button:hover { color: inherit !important; }`;
const pencil = `
${AREA} .ls-block .bottom-property-edit-icon { display: none !important; }`;
/* A PDF quote: the quotation mark is its bullet, an opening mark where the dot stood, centred in the ring while folded (a font keeps
   a quotation mark high in its line, so the drop is measured: the ink's middle on the ring's, seen at 8×).
   With nothing under it Logseq would still show the fold arrow beside the mark under the pointer; the arrow goes, its room
   stays (the owner: "the quotes should be the bullet"). A quote is a highlight (Logseq marks its words as an annotation; embedded in another bullet it is that bullet's words, not
   its bullet), or a bullet whose words are nothing but a highlight cited. A note with words of its own keeps its dot. */
const QUOTED = `:is(.block-main-container:has(.block-content[data-type="annotation"]:not(.embed-block *)), .ls-block[data-block-title^="[["][data-block-title$="]]"] > .block-main-container:has(.block-title-wrap .hl-page))`;
const quoteBullets = `
${AREA} ${QUOTED} > .block-control-wrap .bullet { display: flex; align-items: center; justify-content: center; width: 16px !important; height: 16px !important; background: none !important; color: var(--lk-quiet); }
${AREA} ${QUOTED} > .block-control-wrap .bullet::before { content: "\\201C"; font: 19px/16px Georgia, "Times New Roman", serif; height: 16px; transform: translateY(.28em); }
${AREA} ${QUOTED} > .block-control-wrap[data-has-children="false"] .block-control { visibility: hidden; }`;
/* A PDF quote's page (11 November 2026, the owner: "get rid of emoji", the page "at the end of bullet", "style like (p. 1)"): Logseq's
   coloured dot and bold "P2" before the words go, and "(p. 2)" stands after them, small and grey as the other things that
   follow a bullet's words (a folded node's ↳ line). Logseq's own "P2" is only hidden, so a press on "(p. 2)" is passed to it
   and opens the PDF at the quote as before. Where a quote is cited inside a link, the page stands after the quote's words, in the link. */
const quotePageCss = `
${AREA} .block-title-wrap[data-lk-page] > .prefix-link { display: none !important; }
.lk-quote-page { display: inline-block; margin-left: .5em; font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; white-space: nowrap; text-decoration: none; cursor: alias; user-select: none; }
.lk-quote-page:hover { color: var(--lk-text, currentColor); }`;
const QUOTE_PAGES = `${AREA} .block-title-wrap > .prefix-link > .hl-page`;
function quotePages(doc) {
  const on = setting('quotePages');
  for (const page of on ? doc.querySelectorAll(QUOTE_PAGES) : []) {
    const wrap = page.parentElement.parentElement, n = /\d+/.exec(page.textContent || '')?.[0];
    if (!n) continue;
    let mark = [...wrap.children].find(child => child.classList.contains('lk-quote-page'));
    if (!mark) {
      mark = Look.kit.el(doc, 'span', { class: 'lk-quote-page lk-own' });
      const folded = [...wrap.children].find(child => child.classList.contains('lk-folded'));
      wrap.insertBefore(mark, folded || null);
    }
    if (mark.textContent !== `(p. ${n})`) mark.textContent = `(p. ${n})`;
    if (wrap.getAttribute('data-lk-page') !== n) wrap.setAttribute('data-lk-page', n);
  }
  for (const wrap of doc.querySelectorAll('[data-lk-page]')) {
    if (on && wrap.querySelector(':scope > .prefix-link > .hl-page')) continue;
    wrap.removeAttribute('data-lk-page');
    for (const mark of wrap.querySelectorAll(':scope > .lk-quote-page')) mark.remove();
  }
}
// The press is held back from Logseq, which would open the bullet to edit it, and played on Logseq's own page number instead.
function pressPage(event) {
  const mark = event.target?.closest?.('.lk-quote-page');
  if (!mark) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.type !== 'click') return;
  const page = mark.parentElement?.querySelector(':scope > .prefix-link > .hl-page');
  if (page) window.PluginDoor.screen.press(page, { shiftKey: event.shiftKey });
}
let pagesWatched = false;
function watchQuotePages() {
  const doc = Look.kit.host();
  if (!pagesWatched) {
    pagesWatched = true;
    Look.kit.watchScreen(quotePages, quotePages);
    Look.kit.listen(doc.defaultView, ['pointerdown', 'mousedown', 'mouseup', 'click'], pressPage, true);
    Look.kit.onStop(() => { pagesWatched = false; for (const wrap of Look.kit.host().querySelectorAll('[data-lk-page]')) wrap.removeAttribute('data-lk-page'); });
  }
  quotePages(doc);
}
/* The path to the bullet you edit (9 November 2026, the owner picked A in where-you-are-mockup.html; a shade darker, before,
   was too faint to see): the bullets above it and its own take the words' colour, and a darker line runs down Logseq's guide
   line only from each of them to the next, so the way from the top to you reads as one thread. Nothing new is drawn, the
   words are never touched, the rest of the outline stays as Logseq draws it. A .block-main-container never holds its
   block's children, so only the bullet being edited and those above it match. The line is drawn on the blocks it passes
   (each earlier sibling whole, the step itself down to its bullet), over the guide line at the block's left edge. */
/* The same path in Threads' opened rows (12 November 2026, the owner: "the outline doesn't follow the type of outline style
   of active node"): there the node you are at is the one in the wash (th-ol-focus, the last one opened), or the bullet or
   value whose words you are typing (th-in-place). Its guide lines are Threads' own (th-ol-kids, a line down the left of
   what a node holds: its line 3px in from a row's edge, 5px from a node's); the same choice draws them. */
const TH_HERE = ':is(.th-ol-focus, .th-in-place)';
const TH_STEP = `:is(${TH_HERE}, :has(${TH_HERE}))`;
const TH_BEFORE = `:has(~ ${TH_HERE}, ~ * ${TH_HERE})`;   // an earlier sibling of the step (a :has inside a :has is not allowed)
const TH = `${AREA} .th-two-way`;
const TH_KID = `${TH} .th-ol-kids:not(.th-ol-bare) > .th-ol-in >`;
const branch = `
${AREA} .ls-block:has(.editor-inner) > .block-main-container .bullet-container .bullet { background-color: var(--lk-text) !important; }
${AREA} .block-children .ls-block:is(:has(.editor-inner), :has(~ .ls-block .editor-inner))::before {
  content: ""; position: absolute; left: -1px; top: 0; width: 1.5px; pointer-events: none; z-index: 1;
  background: color-mix(in srgb, var(--lk-text) 55%, transparent); }
${AREA} .block-children .ls-block:has(~ .ls-block .editor-inner)::before { bottom: 0; }
${AREA} .block-children .ls-block:has(.editor-inner)::before { height: 14px; }
${AREA} .bullet-container .bullet { transition: background-color ${window.PluginDoor.timing('wash')}; }
@media (prefers-reduced-motion: reduce) { ${AREA} .bullet-container .bullet { transition: none; } }
${TH} .th-ol-unit:is(.th-ol-focus, :has(${TH_HERE})) > :is(.th-ol-line, .th-ol-bullet) .th-ol-dot > .lk-bul::before,
${TH} :is(.th-ol-line, .th-ol-bullet):has(.th-in-place) .th-ol-dot > .lk-bul::before { background: var(--lk-text); }
${TH_KID} :is(${TH_STEP}, ${TH_BEFORE}) { position: relative; }
${TH_KID} :is(${TH_STEP}, ${TH_BEFORE})::before {
  content: ""; position: absolute; left: 3px; top: 0; bottom: 0; width: 1.5px; pointer-events: none; z-index: 1;
  background: color-mix(in srgb, var(--lk-text) 55%, transparent); }
${TH_KID} .th-ol-unit:is(${TH_STEP}, ${TH_BEFORE})::before { left: 5px; }
${TH_KID} ${TH_STEP}::before { bottom: auto; height: 14px; }`;
/* The third choice (12 November 2026, the owner asked for it beside Lit): the guide lines along the way are darker, each
   whole, from the outermost bullet in to the one you edit; the dots stay as Logseq draws them. It began as the shade
   darker of 8 November, found too faint, so the line takes Lit's strength. */
const guides = `
${AREA} .block-children-container:has(.editor-inner) > .block-children { border-left-color: color-mix(in srgb, var(--lk-text) 55%, transparent) !important; }
${AREA} .block-children { transition: border-color ${window.PluginDoor.timing('wash')}; }
@media (prefers-reduced-motion: reduce) { ${AREA} .block-children { transition: none; } }
${TH} .th-ol-kids:not(.th-ol-bare):has(${TH_HERE}) { border-left-color: color-mix(in srgb, var(--lk-text) 55%, transparent) !important; }`;
/* Which way the path shows: Off, Lit (dots and steps) or Lines (whole guide lines). Before 12 November the setting was
   the switch litBranch; a saved Off there still reads Off until a choice is made. */
const pathChoice = () => {
  const saved = logseq.settings?.outlinePath;
  if (typeof saved === 'string') return setting('outlinePath');
  return logseq.settings?.litBranch === false ? 'Off' : setting('outlinePath');
};
/* Logseq's two-way list under a node (a two-way tag's nodes pointing at it, in tabs), inside the node's own block. A page's own
   list stands outside the page's blocks and is Threads' to hide where its rows replace it. */
const twoWay = `
#main-content-container .ls-page-blocks .ls-block :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }`;
function apply() {
  style('links', setting('quietLinks') ? links : '');
  style('days', setting('quietDays') ? days : '');
  style('tags', setting('tagsAsClasses') ? tags : '');
  watchHashes();
  style('names', setting('quietNames') ? names : '');
  style('capsules', setting('noCapsules') ? capsules : '');
  style('title-words', setting('hideTitleWords') ? titleWords : '');
  style('empty', emptyProps + EMPTY_ROWS);
  style('pencil', setting('hideDatePencil') ? pencil : '');
  style('two-way', setting('hideTwoWayList') ? twoWay : '');
  style('add-property', setting('quietAddProperty') ? addProperty : '');
  style('quote-bullets', setting('quoteBullets') ? quoteBullets : '');
  style('quote-pages', setting('quotePages') ? quotePageCss : '');
  watchQuotePages();
  const path = pathChoice();
  style('branch', path === 'Lit' ? branch : path === 'Lines' ? guides : '');
}
Look.style = { apply };
})();
