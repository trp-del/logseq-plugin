/* NODE: the one menu. A short list at the thing pressed; arrows walk it, Enter takes, Escape lets go and gives the focus back.
     G.menu(at, items, opts)   at: the element pressed, or { x, y, from } for a right-click;
                               items: { word, icon?, on?, depth?, face?, take } | { group } | { gap: true }
   One menu at a time; a second closes the first.
   opts.quiet: a list offered while a bullet is being written, as Logseq offers its own: the keys stay in the bullet, nothing is
   lit until an arrow is pressed, Enter takes only a lit line, Escape lets go, and any other key lets go and goes on into the
   bullet, so carrying on writing is the answer no. */
(function () {
const G = window.PluginDoor;
let close = null;
G.menu = (at, items, opts = {}) => {
  close?.();
  const from = at.from || at, doc = from.ownerDocument, win = doc.defaultView;
  const menu = doc.createElement('div'); menu.className = 'lk-menu'; menu.setAttribute('role', 'menu');
  menu.innerHTML = items.map((item, i) => item.gap ? '<div class="lk-gap"></div>' : item.group ? `<div class="lk-group">${G.esc(item.group)}</div>`
    : `<button type="button" class="lk-item${item.on ? ' on' : ''}" role="menuitem" data-i="${i}" data-face="${item.face || ''}" style="padding-left: ${9 + (item.depth || 0) * 14}px"${opts.quiet ? ' tabindex="-1"' : ''}><span class="lk-item-icon">${item.icon || ''}</span><span>${G.esc(item.word)}</span>${item.on ? `<span class="lk-item-on">${G.touch.icon('check', 14)}</span>` : ''}</button>`).join('');
  doc.body.appendChild(menu);
  const box = at.from ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : from.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(box.left, win.innerWidth - w - 8)) + 'px';
  if (opts.quiet) {
    // Never over the line being written: under it where there is room for a good part of the list, else above it; the list scrolls.
    const below = win.innerHeight - box.bottom - 12, above = box.top - 12, under = h <= below || below >= 220 || below >= above, room = Math.min(320, Math.max(120, under ? below : above));
    menu.style.maxHeight = room + 'px';
    menu.style.top = (under ? box.bottom + 4 : Math.max(8, box.top - 4 - Math.min(h, room))) + 'px';
  } else menu.style.top = (box.bottom + 4 + h > win.innerHeight - 8 ? Math.max(8, box.top - 4 - h) : box.bottom + 4) + 'px';
  const rows = () => [...menu.querySelectorAll('.lk-item')];
  const done = (refocus = true) => { if (close !== done) return; close = null; for (const off of offs) off(); menu.remove(); if (refocus && !opts.quiet) from.focus?.({ preventScroll: true }); };
  const take = row => { const item = items[Number(row.dataset.i)]; done(); item?.take?.(); };
  const onKey = event => {
    const all = rows(), now = all.indexOf(doc.activeElement);
    if (event.key === 'Escape') done();
    else if (event.key === 'ArrowDown') all[(now + 1) % all.length]?.focus();
    else if (event.key === 'ArrowUp') all[(now - 1 + all.length) % all.length]?.focus();
    else if (event.key === 'Tab') done();
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  const outside = event => { if (!menu.contains(event.target)) done(false); };
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); return () => target.removeEventListener(type, fn, opts); };
  let lit = -1;
  const light = to => { const all = rows(); if (!all.length) return; lit = (to + all.length) % all.length; all.forEach((row, i) => row.classList.toggle('lit', i === lit)); all[lit].scrollIntoView({ block: 'nearest' }); };
  const onQuietKey = event => {
    if (event.key === 'ArrowDown') light(lit + 1);
    else if (event.key === 'ArrowUp') light(lit < 0 ? -1 : lit - 1);
    else if ((event.key === 'Enter' || event.key === 'Tab') && lit >= 0) take(rows()[lit]);
    else if (event.key === 'Escape') done(false);
    else { if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(event.key)) done(false); return; }   // writing on: let go, and the key goes on into the bullet
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  };
  const offs = [opts.quiet ? on(doc, 'keydown', onQuietKey, true) : on(menu, 'keydown', onKey), on(menu, 'click', event => { const row = event.target.closest('.lk-item'); if (row) take(row); }),
    ...(opts.quiet ? [on(menu, 'mousedown', event => event.preventDefault())] : []),
    on(doc, 'pointerdown', outside, true), on(doc, 'wheel', outside, { capture: true, passive: true }), on(win, 'blur', () => done(false)), on(win, 'resize', () => done(false))];
  close = done;
  if (!opts.quiet) (rows().find(row => row.classList.contains('on')) || rows()[0])?.focus({ preventScroll: true });
  return done;
};
G.menu.CSS = `
.lk-menu { position: fixed; z-index: 9999; min-width: 11rem; max-width: min(22rem, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 5px; border-radius: 10px;
  background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); color: var(--lk-text); }
.lk-menu .lk-item { display: flex; align-items: center; gap: 8px; width: 100%; min-height: var(--lk-line-h); padding: 3px 9px 4px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); text-align: left; cursor: default; }
.lk-menu .lk-item:hover, .lk-menu .lk-item:focus, .lk-menu .lk-item.lit { background: var(--lk-lit); outline: none; }
.lk-menu .lk-item[data-face="tag"] { font-family: var(--lk-tag-face); }
.lk-menu .lk-item-icon { display: inline-flex; width: 18px; justify-content: center; color: var(--lk-quiet); flex: none; }
.lk-menu .lk-item-icon:empty { display: none; }
.lk-menu .lk-item-on { margin-left: auto; display: inline-flex; color: var(--lk-quiet); }
.lk-menu .lk-group { padding: 4px 9px 2px; font-size: var(--lk-label); color: var(--lk-quiet); }
.lk-menu .lk-gap { height: 1px; margin: 4px 9px; background: var(--lk-hair); }`;
})();
