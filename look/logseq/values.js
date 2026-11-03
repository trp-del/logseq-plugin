/* A property's value that names a page opens it, as its underline says: a click on the name opens the page, Shift-click in
   the right sidebar (Logseq itself opens its list to set the property there). The list to set it opens from one press after
   the value, under the pointer: a + (the library's lk-plus) where the property holds several pages, to add one; a chevron
   (lk-change) where it holds one, to set another in its place; for a date, the date picker. Under a bullet and in a page's
   list alike. An empty property, words, a number or a choice keep Logseq's own click, since there is nothing to open.

   The press takes no room (the stylesheet), so nothing moves when the pointer comes; it opens the list by passing a click to
   Logseq's own value box, the way a click there does today. */
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
/* The press after a value: no room, so nothing moves, and above the next property, which its circle reaches into; shown while its property is pointed at or the press has the keyboard. */
.lk-valpress { position: relative; z-index: 2; display: inline-block; width: 0 !important; padding: 0 !important; margin: 0 !important; overflow: visible; white-space: nowrap; vertical-align: baseline; opacity: 0; transition: opacity .12s ease; }
.lk-valpress > span { display: inline-flex; align-items: center; justify-content: center; margin-left: 4px; min-width: 18px; height: 18px; border-radius: 9px; line-height: 1; background: var(--lk-paper, var(--ls-primary-background-color)); }
.lk-valpress:hover > span, .lk-valpress:focus-visible > span { background: color-mix(in srgb, currentColor 9%, var(--lk-paper, transparent)); }
.lk-valpress > span::before { margin-right: 0 !important; }
:is(.bottom-property-pill, .property-pair):hover .lk-valpress, .lk-valpress:focus-visible { opacity: 1; }
/* Logseq greys the whole value box under the pointer, a sign the box opens its list; the name opens its page now, so only the
   name's own wash shows (style.js), as on any link. */
${VALUES}:hover { background-color: transparent !important; }
/* Logseq clips a pill's value at its end; with a press after it, the press shows past it. */
.bottom-property-content:has(.lk-valpress) { overflow: visible !important; }
/* Logseq lays a value's parts out with a gap: the press gives it back, so it takes no room at all. */
.bottom-property-content > .lk-valpress { margin-left: calc(-1 * var(--spacing, .25rem)) !important; }
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
    press.type = 'button'; press.className = many ? 'lk-valpress lk-own lk-plus' : 'lk-valpress lk-own lk-change';
    press.setAttribute('contenteditable', 'false');
    press.title = many ? `Add to ${titleOf(holder)}` : `Change ${titleOf(holder)}`;
    press.setAttribute('aria-label', press.title);
    press.innerHTML = many ? '<span>+</span>' : '<span class="lk-i-chevron"></span>';   // the chevron: the library's icon
    spot.after(press);
  }
  for (const press of doc.querySelectorAll('.lk-valpress')) if (!innerOf(press)?.matches(':not(.empty-value)')) press.remove();
}
// The press, and a click on a name: Logseq's own handling of the value is kept from them (it opens its list on the press
// itself as well as on the click). The name opens its page; the press passes a click to the value box, which opens the list.
const KEYS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
function onPress(event) {
  if (!setting('valuesOpen')) return;
  const press = event.target?.closest?.('.lk-valpress');
  const name = press ? null : nameIn(event.target);
  if (!press && !name) return;
  if (name && !holderOf(name)) return;
  event.stopPropagation(); event.preventDefault();
  if (event.type !== 'click') return;
  // Passed on once this click is over, so Logseq takes it as a click of its own and not one it is still handling.
  if (press) { const box = innerOf(press)?.querySelector('.jtrigger'); host().defaultView.setTimeout(() => box?.click(), 0); return; }
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
