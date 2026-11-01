/* The rules that are only a stylesheet: links, journal days, tags, property names and capsules, the words by a title, empty
   properties, the pencil after a date. Nothing is read from the graph and nothing moves on the page: the pills keep their
   height, the hidden # its slot. */
(function () {
const Look = window.Look;
const { style } = Look.kit, { setting } = Look.settings;
const AREA = ':is(#main-content-container, #right-sidebar)';
const DAY = ':is([data-uuid^="00000001-"], .ls-datetime *)'; // Logseq 2.0.2 gives every journal page a uuid starting 00000001-

const links = `
${AREA} a.page-ref:not(.tag):not(${DAY}) { color: inherit !important; text-decoration: underline !important; text-decoration-color: var(--lk-line) !important; text-decoration-thickness: 1px; text-underline-offset: .2em; }
${AREA} a.page-ref:not(.tag):not(${DAY}):hover { text-decoration-color: currentColor !important; }
${AREA} a.page-ref a.asset-ref { color: inherit !important; }
/* Under the pointer Logseq paints a link's box in its accent colour at strength; here the faint wash of a row under the
   pointer, the same for every link. */
${AREA} .page-reference:hover, ${AREA} a.page-ref:hover, ${AREA} .preview-ref-link:hover { background: var(--lk-wash) !important; }`;
/* A day mentioned in the words is quiet grey. In a property's value (a page's list, the line under a node) the quiet grey
   would read as the name's grey, so there a day keeps the value's colour, no underline, quiet only under the pointer; the
   calendar icon and the name already say it is a date. */
const VALUE = ':is(.property-value-container, .bottom-property-pill)';
const days = `
${AREA} a.page-ref${DAY}, ${AREA} .ls-datetime a { color: var(--lk-quiet) !important; text-decoration: none !important; }
${AREA} a.page-ref${DAY}:hover, ${AREA} .ls-datetime a:hover { color: inherit !important; }
${AREA} ${VALUE} a.page-ref${DAY}, ${AREA} ${VALUE} .ls-datetime a { color: inherit !important; }
${AREA} ${VALUE} a.page-ref${DAY}:hover, ${AREA} ${VALUE} .ls-datetime a:hover { color: var(--lk-quiet) !important; }`;
/* A tag: its name alone, as written, in mono, a step smaller, where Logseq puts it. Logseq draws a # link before the name and swaps it
   for an × under the pointer; the # is made invisible in a fixed slot and the × takes the same slot, so the name never moves. */
const tags = `
${AREA} .block-tag :is(a.hash-symbol, a[title="Remove this tag"]) { display: inline-flex !important; align-items: center; justify-content: center; width: 1.1em; margin: 0 !important; padding: 0 !important; }
${AREA} .block-tag a.hash-symbol { visibility: hidden; }
${AREA} a.tag:not(mark *) { color: inherit !important; opacity: .7; font-family: var(--lk-mono); font-size: .85em; text-decoration: none !important; }
${AREA} a.tag:not(mark *):hover { opacity: 1; }
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
const FILLED = ':is(:not(:has(.empty-value)), :has(.lk-pencil))';
const capsules = `
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill { background: transparent !important; padding-left: 4px !important; padding-right: 4px !important; margin-inline: -4px; overflow: visible !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:not(:focus-within)::after { box-shadow: none !important; border: 0 !important; }
${AREA} .ls-block .positioned-properties.block-below,
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-row,
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-pills-strip { margin-inline: -4px !important; padding-inline: 4px !important; width: calc(100% + 8px) !important; max-width: none !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-pills-strip { margin-block: -2px !important; padding-block: 2px !important; width: 0 !important; flex-wrap: wrap !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-row { height: auto !important; max-height: none !important; overflow: visible !important; }
/* The first property on a wrapped line: its dot stands at nothing, so it goes, and the name lines up with the line above. The dot keeps its room, so the wrap does not change. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill[data-lk-line] { transform: translateX(-16px); }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill[data-lk-line]::before { visibility: hidden; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:focus-within::after { inset: -2px 0 !important; border-radius: 6px !important; box-shadow: inset 0 0 0 1px var(--lk-line) !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill::before { content: '·'; display: inline-block; width: 12px; color: var(--lk-faint); }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill${FILLED} ~ .bottom-property-pill:focus-within::after { left: 16px !important; }`;
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
function apply() {
  style('links', setting('quietLinks') ? links : '');
  style('days', setting('quietDays') ? days : '');
  style('tags', setting('tagsAsClasses') ? tags : '');
  style('names', setting('quietNames') ? names : '');
  style('capsules', setting('noCapsules') ? capsules : '');
  style('title-words', setting('hideTitleWords') ? titleWords : '');
  style('empty', emptyProps);
  style('pencil', setting('hideDatePencil') ? pencil : '');
  style('add-property', setting('quietAddProperty') ? addProperty : '');
  style('quote-bullets', setting('quoteBullets') ? quoteBullets : '');
}
Look.style = { apply };
})();
