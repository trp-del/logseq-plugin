/* The rules that are only a stylesheet: links, journal days, tags, property names and capsules, the words by a title, empty
   properties, the pencil after a date. Nothing is read from the graph and nothing moves on the page: the pills keep their
   height, the hidden # its slot. */
(function () {
const Look = window.Look;
const { style } = Look.kit, { setting } = Look.settings;
const AREA = ':is(#main-content-container, #right-sidebar)';
const DAY = ':is([data-uuid^="00000001-"], .ls-datetime *)'; // Logseq 2.0.2 gives every journal page a uuid starting 00000001-

const links = `
${AREA} a.page-ref:not(.tag):not(${DAY}) { color: inherit !important; text-decoration: underline !important; text-decoration-color: var(--lk-link) !important; text-decoration-thickness: var(--lk-link-width) !important; text-underline-offset: .2em; }
${AREA} a.page-ref:not(.tag):not(${DAY}):hover { text-decoration-color: currentColor !important; }
${AREA} a.page-ref a.asset-ref { color: inherit !important; }
/* A bullet that is a page, or shows one: its words read as a link. A press opens the page (Predictive's page-here.js). */
${AREA} :is(.embed-block:not(.embed-block .embed-block) > .block-main-container, .block-main-container:not(.is-page-title-row):has(> .block-control-wrap :is(.ls-icon-file, .ls-icon-page))) .block-title-wrap { text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; cursor: pointer; }
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
/* A tag: its name alone, as written, in mono, in the text colour and the words' size, where Logseq puts it. Logseq draws a # link before the name and swaps it
   for an × under the pointer; the # is made invisible in a fixed slot and the × takes the same slot, so the name never moves. */
const tags = `
${AREA} .block-tag :is(a.hash-symbol, a[title="Remove this tag"]) { display: inline-flex !important; align-items: center; justify-content: center; width: 1.1em; margin: 0 !important; padding: 0 !important; }
${AREA} .block-tag a.hash-symbol { visibility: hidden; }
${AREA} a.tag:not(mark *) { color: inherit !important; opacity: 1; font-family: var(--lk-mono); font-size: inherit; font-size-adjust: 0.51; text-decoration: none !important; }
${AREA} .block-tag:hover { background: var(--lk-wash) !important; }
/* In a pane under 600px Logseq stacks a bullet's tag under its words, however short they are. It stays beside them while they keep 20em, and only then
   drops, keeping the right edge it has beside them, so tags read as one column at any width. */
${AREA} .block-row:not(.ls-page-title-container *) { flex-direction: row !important; flex-wrap: wrap; }
${AREA} .block-row:not(.ls-page-title-container *) > .block-content-wrapper { flex: 1 1 20em; min-width: 0; }
${AREA} .block-row > .ls-block-right { margin-left: auto !important; }
/* A tag by a title is the size of any other tag, not the title's. A day's own tag shows only under the pointer, so its row holds no line of its own under the title. */
${AREA} .ls-page-title-container .block-tag { font-size: 16px; line-height: 1.5; }
${AREA} .ls-page-title-container .block-row:not(:has(.lk-path)) { flex-direction: row !important; }`;
/* The greys are mixed from currentColor, so they are set once per box and inherited, never on every descendant. The
   value keeps the text colour; the name, one level in, is a shade lighter. */
const names = `
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child,
${AREA} .ls-properties-area .property-pair .property-key-panel { color: var(--lk-quiet) !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child *:not(.tag),
${AREA} .ls-properties-area .property-pair .property-key-panel *:not(.tag) { color: inherit !important; }`;
/* The faint dot stands before every property that follows a filled one. A property holding a pencil (a value proposed by
   Predictive) counts as filled, so the row does not re-space when the pencil turns solid. */
/* An empty property is hidden from Logseq's first paint (the stylesheet sees the blank marker), so the rows below never jump up
   when the script's check (lk-empty, in props.js) lands a frame later; a row the check finds holding words is kept (lk-filled). */
const EMPTY_ROWS = `.ls-page-properties .property-pair:is(.lk-empty, .property-panel-row-empty, .property-panel-row:has(> .property-value-container :is(.is-blank, .empty-value)):not(:has(.ls-empty-text-property))):not(.lk-filled):not(:focus-within) { display: none; }`;
const FILLED = ':is(:not(:has(.empty-value)), :has(.lk-pencil))';
const capsules = `
/* A bullet's properties under its words belong to that bullet (8 November 2026, the owner: "better spacing ... logical
   groups"): a little room after them, so the next bullet stands apart from them instead of as close as they stand to their own words. */
${AREA} .ls-block .positioned-properties.block-below { margin-bottom: 6px; }
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
/* The first property on a wrapped line: the space before it stands at nothing, so the name lines up with the line above. The space keeps its room, so the wrap does not change. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill[data-lk-line] { transform: translateX(-28px); }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill[data-lk-line]::before { visibility: hidden; }
/* The property with the keyboard: a capsule round it, close top and bottom, a little room at each end (the owner: "make it a capsule"). */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:focus-within::after { inset: 1px -4px !important; border-radius: 999px !important; box-shadow: inset 0 0 0 1px var(--lk-line) !important; }
/* Between one property and the next, space alone (the owner, 4 November 2026: the dot was not needed), one width after every
   property, the width of the press Look puts after a value (values.js), which stands in it under the pointer. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill::before { content: ''; display: inline-block; width: 24px; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill:focus-within::after { left: 24px !important; }`;
const titleWords = `
${AREA} .ls-page-title-actions { visibility: hidden !important; pointer-events: none !important; }`;
const emptyProps = `
${AREA} .ls-block > .block-main-container .positioned-properties.block-below .bottom-property-pill:has(.empty-value):not(:focus-within) { opacity: .5; }`;
/* Logseq's "+ Add property" under a page's list, a filled bold button, as a faint word. */
const addProperty = `
${AREA} .ls-new-property button { background: none !important; box-shadow: none !important; border: 0 !important; color: var(--lk-faint) !important; font-weight: 400 !important; padding-left: 0 !important; }
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
/* The branch being written in: the lines and bullets above the bullet you edit are a shade darker, so you see where you are
   in a deep outline. The words are never touched. A .block-main-container never holds its block's children, so only the
   bullet being edited and those above it match. */
const branch = `
${AREA} .block-children-container:has(.editor-inner) > .block-children { border-left-color: var(--lk-line) !important; }
${AREA} .ls-block:has(.editor-inner) > .block-main-container .bullet-container .bullet { background-color: var(--lk-off) !important; }
${AREA} .block-children, ${AREA} .bullet-container .bullet { transition: border-color .15s, background-color .15s; }
@media (prefers-reduced-motion: reduce) { ${AREA} .block-children, ${AREA} .bullet-container .bullet { transition: none; } }`;
/* Logseq's two-way list under a node (a two-way tag's nodes pointing at it, in tabs), inside the node's own block. A page's own
   list stands outside the page's blocks and is Threads' to hide where its rows replace it. */
const twoWay = `
#main-content-container .ls-page-blocks .ls-block :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }`;
function apply() {
  style('links', setting('quietLinks') ? links : '');
  style('days', setting('quietDays') ? days : '');
  style('tags', setting('tagsAsClasses') ? tags : '');
  style('names', setting('quietNames') ? names : '');
  style('capsules', setting('noCapsules') ? capsules : '');
  style('title-words', setting('hideTitleWords') ? titleWords : '');
  style('empty', emptyProps + EMPTY_ROWS);
  style('pencil', setting('hideDatePencil') ? pencil : '');
  style('two-way', setting('hideTwoWayList') ? twoWay : '');
  style('add-property', setting('quietAddProperty') ? addProperty : '');
  style('quote-bullets', setting('quoteBullets') ? quoteBullets : '');
  style('branch', setting('litBranch') ? branch : '');
}
Look.style = { apply };
})();
