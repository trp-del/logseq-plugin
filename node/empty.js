/* NODE: the + under the pointer. A node's empty properties are kept out of sight; while the pointer is on a node that has some,
   a faint + stands after its last property. A press lists them, and the one chosen is filled with Logseq's own list, calendar
   or box. At rest, and while keys are typed, there is nothing, and the + takes no room (the owner, 26 November 2026, building
   it from the drawing of three ways).
     G.empty.start(base)   stands it, whichever parts run; G.empty.CSS its one rule */
(function () {
const G = window.PluginDoor;
const CSS = `.lk-plus.lk-empty-plus { position: fixed; z-index: 9; margin: 0; }`;
function start(base) {
  const doc = G.host();
  let button = null, at = null, last = null;
  const hide = () => { button?.remove(); button = at = last = null; };
  const list = () => {
    const spot = at;
    G.menu(button, [{ group: 'Empty here' }, ...spot.rows.map(one => ({ word: one.name, face: 'prop', take: () => setTimeout(() => { hide(); G.touch.fillEmpty(one.row); }, 0) }))]);
  };
  const show = spot => {
    at = spot;
    if (!button) {
      button = doc.createElement('button'); button.type = 'button'; button.className = 'lk-plus lk-empty-plus'; button.title = 'Empty properties'; button.setAttribute('aria-label', 'Empty properties');
      button.innerHTML = G.touch.icon('plus', 14);
      for (const type of ['pointerdown', 'mousedown']) button.addEventListener(type, event => { event.preventDefault(); event.stopPropagation(); });   // the bullet keeps the keys
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); list(); });
      doc.body.appendChild(button);
    }
    button.style.left = spot.x + 'px'; button.style.top = spot.y + 'px';
  };
  const menuOpen = () => !!doc.querySelector('.lk-menu');
  base.listen(doc, ['pointermove'], event => {
    if (event.buttons || menuOpen() || event.target === last || event.target.closest?.('.lk-empty-plus')) return;
    const spot = G.touch.busy() ? null : G.touch.emptiesAt(event.target);
    if (spot) show(spot); else hide();
    last = event.target;
  }, { passive: true });
  base.listen(doc, ['keydown', 'scroll'], () => { if (!menuOpen()) hide(); }, { capture: true, passive: true });
  base.listen(doc.documentElement, ['pointerleave'], () => { if (!menuOpen()) hide(); });
  base.listen(doc, ['pointerdown'], event => { if (!menuOpen() && !event.target.closest?.('.lk-empty-plus')) hide(); }, true);   // a press may go to another page: nothing is left standing there
  base.onStop(hide);
}
G.empty = { start, CSS };
})();
