/* A property's value that names a page opens it, as its underline says: a click on the name opens the page, Shift-click in
   the right sidebar (Logseq itself opens its list to set the property there). The list to set it opens from one press after
   the value, under the pointer: a + (the library's lk-plus) where the property holds several pages, to add one; a chevron
   (lk-change) where it holds one, to set another in its place; for a date, the date picker. Under a bullet and in a page's
   list alike. An empty property, words, a number or a choice keep Logseq's own click, since there is nothing to open.

   Under a bullet the press takes no room: it shows in the space before the next property, which is one width after every
   property, a press or none, so the gaps are even and nothing moves (style.js). It catches the pointer over the whole of that
   space and a little above and below, and fades only after a moment, so a hand that wavers does not lose it. In a page's
   list, where each property has a row of its own, it keeps its room. It opens the list by passing a click to Logseq's own value box, the way
   a click there does today. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, openPage } = Look.kit, { setting } = Look.settings;
const AREA = ':is(#main-content-container, #right-sidebar)';
// A value Look takes over: a page or a day, not empty. Its property's name is the pill's .property-k, or the row's title.
const VALUES = `${AREA} :is(.bottom-property-pill, .property-pair[data-property-title]) .property-value-inner:is([data-type="node"], [data-type="page"], [data-type="date"], [data-type="datetime"]):not(.empty-value)`;
const holderOf = inner => inner.closest('.bottom-property-pill, .property-pair');
const titleOf = holder => holder.getAttribute('data-property-title') || holder.querySelector('.property-k')?.textContent.trim() || '';
const nameIn = target => target?.closest?.(`${AREA} .property-value-inner:not(.empty-value) a.page-ref`);
const css = `
/* The press after a value: centred on the text's line, since the chevron has no letter to sit on the baseline by; shown while its
   property is pointed at or the press has the keyboard. */
.lk-valpress { display: inline-flex; align-items: center; align-self: center; padding: 0 !important; margin: 0 !important; white-space: nowrap; vertical-align: middle; }
.lk-valpress > span { display: inline-flex; align-items: center; justify-content: center; margin-left: 4px; min-width: 18px; height: 18px; border-radius: 9px; line-height: 1; }
.lk-valpress:focus-visible { outline: none !important; box-shadow: none !important; }
/* With the keyboard on the press, the property's capsule takes the press in. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:has(.lk-valpress:focus-visible)::after { right: -26px !important; }
/* How it shows, grey then darker near it, is the library's lk-reveal; the +'s size is the library's, the chevron's. */
.lk-valpress > span { color: inherit; background: none !important; }
/* On the press itself the round wash sits on its mark, not on the room before it. */
.lk-valpress.lk-reveal:is(:hover, :focus-visible) { background: none !important; }
.lk-valpress:is(:hover, :focus-visible) > span { background: var(--lk-wash) !important; }
.lk-valpress > span::before { margin-right: 0 !important; }
/* Logseq greys the whole value box under the pointer, a sign the box opens its list; the name opens its page now, so only the
   name's own wash shows (style.js), as on any link. */
${VALUES}:hover { background-color: transparent !important; }
/* Logseq clips a pill's value at its end; with a press after it, the press shows past it. */
.bottom-property-content:has(.lk-valpress) { overflow: visible !important; }
/* Logseq lays a value's parts out with a gap: the press gives it back, so it stands tight against its value. */
.bottom-property-content > .lk-valpress { margin-left: calc(-1 * var(--spacing, .25rem)) !important; }
/* Under a bullet: no room, the press over the next dot's place, which is one width (the press's) after every property. */
${AREA} .positioned-properties.block-below .bottom-property-pill .lk-valpress { width: 0 !important; overflow: visible; position: relative; z-index: 2; }
${AREA} .positioned-properties.block-below .bottom-property-pill .lk-valpress > span { margin-left: 7px; }
/* What catches the pointer: from the value's end over the whole space after it, and a few pixels above and below. */
${AREA} .positioned-properties.block-below .bottom-property-pill .lk-valpress::after { content: ''; position: absolute; left: -2px; top: -9px; width: 36px; height: calc(100% + 18px); }
`;
// The press after each value Look takes over: + or the chevron, by what the property holds; gone where it no longer fits.
// Under a bullet it follows the value's box; in a page's list, where that box is the row's whole width, the last name in it.
const spotOf = (inner, holder) => {
  if (!holder.matches('.property-pair')) return inner;
  const names = inner.querySelectorAll('a.page-ref');
  const last = names[names.length - 1];
  return last ? last.closest('.select-item') || last.closest('.inline-flex') || last : null;
};
const innerOf = press => press.closest('.property-value-inner') || (press.previousElementSibling?.matches?.('.property-value-inner') ? press.previousElementSibling : null);
function draw(doc) {
  const on = setting('valuesOpen');
  style('values', on ? css : '');
  for (const inner of doc.querySelectorAll(on ? VALUES : '.lk-valpress')) {
    if (!on) { inner.remove(); continue; }
    const holder = holderOf(inner), spot = spotOf(inner, holder);
    if (!spot) continue;
    const many = !/date/.test(inner.dataset.type) && !!Look.props.prop(titleOf(holder))?.many;
    const want = many ? 'lk-plus' : 'lk-change';
    let press = spot.nextElementSibling?.classList.contains('lk-valpress') ? spot.nextElementSibling : null;
    for (const stray of [...holder.querySelectorAll('.lk-valpress')].filter(p => p !== press)) stray.remove();
    if (press && press.classList.contains(want)) continue;
    press?.remove();
    press = doc.createElement('button');   // the library's lk-plus or lk-change
    press.type = 'button'; press.className = many ? 'lk-valpress lk-own lk-reveal lk-plus' : 'lk-valpress lk-own lk-reveal lk-change';
    holder.classList.add('lk-reveals');
    press.setAttribute('contenteditable', 'false');
    press.title = many ? `Add to ${titleOf(holder)}` : `Change ${titleOf(holder)}`;
    press.setAttribute('aria-label', press.title);
    press.innerHTML = many ? '<span class="lk-i-plus"></span>' : '<span class="lk-i-chevron"></span>';   // the library's icons
    spot.after(press);
  }
  for (const press of doc.querySelectorAll('.lk-valpress')) if (!innerOf(press)?.matches(':not(.empty-value)')) press.remove();
}
// The press, and a click on a name: Logseq's own handling of the value is kept from them (it opens its list on the press
// itself as well as on the click). The name opens its page on the click; the press passes a click to the value box, which opens
// the list, as soon as the button goes down, as Logseq's own box does, and not after the click (the owner: "laggy").
const KEYS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
function onPress(event) {
  if (!setting('valuesOpen')) return;
  const press = event.target?.closest?.('.lk-valpress');
  const name = press ? null : nameIn(event.target);
  if (!press && !name) return;
  if (name && !holderOf(name)) return;
  event.stopPropagation(); event.preventDefault();
  // Passed on once this event is over, so Logseq takes it as a click of its own and not one it is still handling; the rest of the
  // press (up, click) is kept from Logseq, so its list stays open.
  if (press) { if (event.type === 'pointerdown' && event.button === 0) { const box = innerOf(press)?.querySelector('.jtrigger'); host().defaultView.setTimeout(() => box?.click(), 0); } return; }
  if (event.type !== 'click') return;
  const uuid = name.getAttribute('data-uuid');
  if (uuid) openPage(uuid, event.shiftKey);
}
function start() {
  watchScreen(draw, draw);
  const win = host().defaultView;
  for (const type of KEYS) win.addEventListener(type, onPress, true);
}
function stop() {
  const win = host().defaultView;
  for (const type of KEYS) win.removeEventListener(type, onPress, true);
  for (const press of host().querySelectorAll('.lk-valpress')) press.remove();
}
Look.values = { start, stop };
})();
