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
${AREA} a.tag:not(mark *), .lk-tag { color: inherit !important; opacity: .7; font-family: var(--lk-mono); font-size: .85em; text-decoration: none !important; }
${AREA} a.tag:not(mark *):hover, .lk-tag:hover { opacity: 1; }
${AREA} .block-tag:hover { background: var(--lk-wash) !important; }`;
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
${AREA} .ls-block .positioned-properties.block-below .bottom-properties-pills-strip { margin-block: -2px !important; padding-block: 2px !important; }
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
/* The shared names: one per word of the grammar. Another plugin (Threads, Predictive) puts these on what it draws and
   carries no look of its own for them; Look's word is final (hence !important where the other plugin still has a rule).
   lk-row: a row; lk-fold: its fold arrow, only under the pointer; lk-list: a list that can be picked from; lk-tick: a
   tick box, appearing when the pointer is on the list; lk-node: a node's name (with data-uuid: Look adds its sort mark);
   lk-tag: a tag; lk-prop: a property's name; lk-day: a day in the margin; lk-count: a number of things, never shown;
   lk-pencil: a pencilled value; lk-undo: the faded arrow.
   The Pressing set (buttons-mockup.html beside the plugins, 30 October 2026), for the controls of a bar or a window:
   lk-name: the small faint name above a value; lk-value: the value, the thing pressed, in the text colour, quiet under
   the pointer, faint when off (.off) or unwritten; lk-pick: a value that unfolds, a hairline standing before it (its
   chevron is the other plugin's markup, coloured faint here); lk-alts: what a value can become, faint words with the
   one in force (.on) in the text colour; lk-accent: the one action, a little heavier, its key faint; lk-close: the ×.
   The other plugin lays them out (a name over a value, the gaps); Look only gives them their colours and weights. */
const shared = `
.lk-tag { color: inherit !important; opacity: .7; font-family: var(--lk-mono) !important; font-size: .85em !important; text-decoration: none !important; }
.lk-tag:hover { opacity: 1; }
.lk-node { color: inherit; text-decoration: underline !important; text-decoration-color: var(--lk-line) !important; text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
.lk-node:hover { text-decoration-color: currentColor !important; }
.lk-prop { color: var(--lk-quiet); }
.lk-day { color: var(--lk-faint) !important; font-size: 13px !important; font-variant-numeric: tabular-nums; }
.lk-count { display: none !important; }
.lk-pencil { font-style: italic !important; color: var(--lk-faint) !important; text-decoration: underline dotted !important; text-decoration-color: var(--lk-line) !important; text-underline-offset: 3px; background: none !important; }
/* A pencilled tag fades once: the pencil's grey, not the tag's own fade on top of it. */
.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; }
.lk-undo { opacity: .28 !important; transition: opacity .15s; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: .85 !important; }
.lk-row .lk-fold { opacity: 0 !important; transition: opacity .12s; }
.lk-row:hover .lk-fold, .lk-fold[aria-expanded="true"], .lk-fold:focus-visible { opacity: .6 !important; }
.lk-row:hover .lk-fold:hover { opacity: 1 !important; }
.lk-list .lk-tick { opacity: 0 !important; transition: opacity .12s; }
.lk-list:hover .lk-tick, .lk-list:focus-within .lk-tick, .lk-list[data-picking] .lk-tick { opacity: .55 !important; }
.lk-list .lk-tick:checked, .lk-list .lk-tick:hover { opacity: 1 !important; }
.lk-name { font-size: 11px !important; color: var(--lk-faint) !important; letter-spacing: .02em; font-weight: 400 !important; }
.lk-value:not(input) { color: inherit !important; cursor: pointer; }
.lk-value:not(input):hover { color: var(--lk-quiet) !important; }
.lk-value.off, input.lk-value::placeholder { color: var(--lk-faint) !important; }
.lk-pick:not(:first-child) { border-left: 1px solid var(--lk-hair); }
.lk-pick .lk-value svg { color: var(--lk-faint); }
/* The faint goes on each alternative, not on the line, so the one in force can take the text colour back. */
.lk-alts { color: inherit !important; }
.lk-alts > * { color: var(--lk-faint) !important; }
.lk-alts > *:hover, .lk-alts > .on { color: inherit !important; }
.lk-accent { font-weight: 600 !important; color: inherit !important; }
.lk-accent kbd { font-weight: 400 !important; color: var(--lk-faint) !important; }
.lk-close { color: var(--lk-faint) !important; }
.lk-close:hover, .lk-close:focus-visible { color: inherit !important; }
@media (prefers-reduced-motion: reduce) { .lk-fold, .lk-tick, .lk-undo { transition: none; } }`;

function apply() {
  style('tokens', Look.kit.TOKENS);
  style('shared', shared);
  style('links', setting('quietLinks') ? links : '');
  style('days', setting('quietDays') ? days : '');
  style('tags', setting('tagsAsClasses') ? tags : '');
  style('names', setting('quietNames') ? names : '');
  style('capsules', setting('noCapsules') ? capsules : '');
  style('title-words', setting('hideTitleWords') ? titleWords : '');
  style('empty', setting('quietEmptyProps') ? emptyProps : '');
  style('pencil', setting('hideDatePencil') ? pencil : '');
  style('add-property', setting('quietAddProperty') ? addProperty : '');
}
Look.style = { apply };
})();
