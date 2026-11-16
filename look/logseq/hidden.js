/* Hidden items: Logseq's own items the owner never uses, kept off the screen (the owner, 15 November 2026: "hide things around
   the app like commands or menu items that logseq has"; the mockup reports/hide-unused-mockup.html, picks 1A and 2A).
   A right-click on a row of one of Logseq's menus, a command in the search window, a toolbar button or a left-sidebar item
   opens the library's menu with one line, Hide; the row rolls away, and the library's Undo arrow waits at the bottom right.
   The setting hiddenItems keeps them as "Where: name; Where: name", and the settings window lists them by where, a × each.
   Only the screen changes: the row is left out where Logseq draws it (data-lk-hidden). No note, page, property, Logseq
   setting or key is touched; a hidden command's key still works (2A), and a menu says nothing of what it leaves out (1A).
   The arrows in a list of Logseq's own pass over a row left out (Logseq keeps its own place in the list, so a press that
   lands on a left-out row is pressed again). */
(function () {
const Look = window.Look;
const { style, listen, watchScreen, host, setting } = Look.kit;
const Door = window.PluginDoor;
const KEY = 'hiddenItems';

/* Where an item can be met, the word the list files it under, the box Logseq draws it in and its rows. The name of a row is its
   own words, without the key Logseq writes after it. */
const PLACES = [
  { where: 'Right-click menus', box: '.ls-context-menu-content, .ui__context-menu-content', row: '[role="menuitem"], [role="menuitemcheckbox"]' },
  { where: '··· menus', box: '.ui__dropdown-menu-content:not(.ls-context-menu-content), .ui__dropdown-menu-sub-content', row: '[role="menuitem"], [role="menuitemcheckbox"]' },
  { where: 'The / menu', box: '#ui__ac', row: '.menu-link-wrap' },
  { where: 'Command search', box: '.cp__cmdk__modal', row: '[data-item-index]:has(.ls-icon-command)', words: '.cp__cmdk-item-main-text' },
  { where: 'Toolbar', box: '#head', row: 'button, a.button', toolbar: true },
  { where: 'Left sidebar', box: '.left-sidebar-inner', row: '.journals-nav, .all-pages-nav, .flashcards-nav, .graph-view-nav, .whiteboards-nav, .sidebar-navigations > *' },
];
/* Logseq's toolbar buttons carry no words, only an icon; each is named here as Logseq's own commands name it. The ··· button is
   never offered: what is in it (the plugin's settings among them) would be out of reach. */
const TOOLS = { 'menu-2': 'Toggle left sidebar', search: 'Search', home: 'Home', puzzle: 'Plugins', 'arrow-left': 'Back', 'arrow-right': 'Forward', 'layout-sidebar-right': 'Toggle right sidebar' };
const SHORTCUT = '.shui-shortcut-combo, .ui__dropdown-menu-shortcut, .ui__context-menu-shortcut, .keyboard-shortcut, kbd, svg';

function nameOf(row, place) {
  if (place.toolbar) {
    const own = (row.getAttribute('title') || row.getAttribute('aria-label') || '').trim();
    if (own) return own.split(':')[0];
    const icon = row.querySelector('[class*="ls-icon-"]')?.className.match(/ls-icon-([a-z0-9-]+)/)?.[1];
    return TOOLS[icon] || '';
  }
  const copy = row.cloneNode(true);
  for (const k of copy.querySelectorAll(SHORTCUT)) k.remove();
  // A command's row in the search window: its words, then its keys in small boxes at the right.
  const words = (place.words && copy.querySelector(place.words) || copy).textContent || '';
  return words.replace(/\s+/g, ' ').trim();
}
const words = () => String(setting(KEY) || '').split(/[;\n]/).map(w => w.trim()).filter(Boolean);
const split = word => { const at = word.indexOf(': '); return at < 0 ? ['', word] : [word.slice(0, at), word.slice(at + 2)]; };
function hiddenSet() {
  const by = new Map();
  for (const word of words()) { const [where, name] = split(word); const key = name.toLowerCase(); if (!by.has(where)) by.set(where, new Set()); by.get(where).add(key); }
  return by;
}
const isHidden = (by, where, name) => !!name && !!(by.get(where)?.has(name.toLowerCase()) || by.get('')?.has(name.toLowerCase()));

// Each pass marks what is hidden and unmarks what came back, in every place on the screen.
function pass(doc) {
  const by = hiddenSet();
  for (const place of PLACES) for (const box of doc.querySelectorAll(place.box)) for (const row of box.querySelectorAll(place.row)) {
    if (row.closest('.lk-own, .lk-pop')) continue;
    const hide = isHidden(by, place.where, nameOf(row, place));
    if (hide !== row.hasAttribute('data-lk-hidden')) row.toggleAttribute('data-lk-hidden', hide);
  }
  for (const list of doc.querySelectorAll('#ui__ac .hide-scrollbar')) tidyHeads(list);
  if (walking === 0) offLit(doc);   // a list that opens on a hidden row (Logseq lights its first) moves on to the first that shows
  for (const box of doc.querySelectorAll(SEPARATED)) for (const holder of new Set([...box.querySelectorAll(LINE)].map(line => line.parentElement))) tidyLines(holder);
}
/* A menu's dividing lines: one left between two groups that still show, none at the top or the foot, never two together. */
const SEPARATED = '.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content';
const LINE = '.ui__dropdown-menu-separator, .ui__context-menu-separator';
/* The / menu's headings (BASIC, FORMAT ...): Logseq draws each with its group's first row in one holder and the rest after it.
   A heading whose every row is hidden goes with them. */
function tidyHeads(list) {
  let holder = null, shown = false;
  const close = () => { if (holder) mark(holder, !shown); };
  for (const child of list.children) {
    if (child.querySelector(':scope > .ui__ac-group-name')) { close(); holder = child; shown = !child.querySelector(':scope > .menu-link-wrap')?.hasAttribute('data-lk-hidden'); continue; }
    if (holder && child.matches('.menu-link-wrap') && !child.hasAttribute('data-lk-hidden')) shown = true;
  }
  close();
}
const mark = (node, out) => { if (out !== node.hasAttribute('data-lk-hidden')) node.toggleAttribute('data-lk-hidden', out); };
function tidyLines(box) {
  let seen = false, pending = null;
  for (const child of box.children) {
    if (child.matches(LINE)) { const out = !seen || !!pending; mark(child, out); if (!out) pending = child; continue; }
    if (child.hasAttribute('data-lk-hidden') || child.matches('.lk-own')) continue;
    seen = true; pending = null;
  }
  if (pending) mark(pending, true);
}
// The library's menu opened over one of Logseq's (its menus keep the rest of the window from the pointer while open) still takes it.
const CSS = `[data-lk-hidden] { display: none !important; } .lk-door-menu.lk-over { pointer-events: auto !important; z-index: 2147483000 !important; }
#ui__ac a.menu-link:not(.chosen):hover { color: inherit !important; }`;
/* The / menu draws the row under the pointer in near-white, meant for the lit row's ground; Logseq lights the row the pointer
   moves onto, so this is never seen, until a row under a still pointer is hidden and the next one slides beneath it. */

function placeOf(target) {
  for (const place of PLACES) {
    const box = target.closest?.(place.box); if (!box) continue;
    const row = target.closest(place.row); if (!row || !box.contains(row) || row.closest('.lk-own, .lk-pop')) continue;
    const name = nameOf(row, place); if (!name || name.length > 80) continue;
    return { place, row, name };
  }
  return null;
}
function save(list) { logseq.updateSettings({ [KEY]: list.join('; ') }); }
function hide({ place, name }) {
  const before = words(), word = `${place.where}: ${name}`;
  if (before.some(w => w.toLowerCase() === word.toLowerCase())) return;
  save([...before, word]);
  Door.undo.offer({ owner: 'look', key: `look:hidden:${word}`, at: () => null, text: `Hid “${name}”`,
    run: async () => { save(words().filter(w => w.toLowerCase() !== word.toLowerCase())); } });
}
// Rolls the row away where it stands, then leaves it out; the menu it was in stays open.
function roll(row) {
  const win = row.ownerDocument.defaultView, h = row.offsetHeight;
  if (!h || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { row.toggleAttribute('data-lk-hidden', true); offLit(row.ownerDocument); return; }
  const { ms, ease } = Door.MOTION?.rollUp || { ms: 180, ease: 'ease' };
  Object.assign(row.style, { overflow: 'hidden', height: `${h}px`, transition: `height ${ms}ms ${ease}, opacity ${ms}ms ${ease}, padding ${ms}ms ${ease}` });
  win.requestAnimationFrame(() => Object.assign(row.style, { height: '0px', opacity: '0', paddingTop: '0px', paddingBottom: '0px' }));
  win.setTimeout(() => { row.toggleAttribute('data-lk-hidden', true); for (const p of ['overflow', 'height', 'transition', 'opacity', 'paddingTop', 'paddingBottom']) row.style[p] = ''; offLit(row.ownerDocument); }, ms + 20);
}
function onMenu(event) {
  const found = placeOf(event.target); if (!found) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const before = host().activeElement;
  if (!Door.menu(found.row, [{ word: 'Hide', take: () => { roll(found.row); hide(found); } }], { align: 'left' })) return;
  // Over Logseq's own menu, which stands above everything and keeps the pointer to itself while open.
  const shown = [...host().querySelectorAll('.lk-door-menu')].pop(); shown?.classList.add('lk-over');
  // The keys go back to where they were (the search window's box), not to the row, which takes no keys and may be gone.
  const back = before, win = host().defaultView;
  const wait = () => { if (shown?.isConnected) return void win.requestAnimationFrame(wait); const now = host().activeElement; if (back?.isConnected && (!now || now === host().body || now === found.row)) back.focus({ preventScroll: true }); };
  win.requestAnimationFrame(wait);
}

/* The arrows in a list Logseq keeps itself (the / menu, the search window): a press that lights a left-out row is pressed again,
   the same way, until a row that shows is lit; Logseq's menus (Radix) pass over it on their own. */
const LIT = '.cp__cmdk__modal [data-kb-highlighted="true"], #ui__ac .chosen, #ui__ac [aria-selected="true"]';
let walking = 0;
// The row just hidden was the lit one (the pointer was on it): the next row that shows is lit, so Enter never takes a hidden row.
let pressedAt = 0;   // one press at a time: Logseq moves its light a moment after the press, and a second press would pass a row
function offLit(doc) { if (Date.now() - pressedAt < 150) return; const lit = doc.querySelector(LIT); if (!lit?.closest('[data-lk-hidden]')) return; const list = lit.closest('#ui__ac, .cp__cmdk__modal'); if (!list || !list.querySelector('.menu-link-wrap:not([data-lk-hidden]), [data-item-index]:not([data-lk-hidden])')) return; pressedAt = Date.now(); Door.screen.key(doc.activeElement || doc.body, 'ArrowDown', { code: 'ArrowDown', keyCode: 40, which: 40 }); }
function onArrow(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' || walking > 40) return;
  const doc = host(), win = doc.defaultView;
  if (!doc.querySelector('#ui__ac, .cp__cmdk__modal')) return;
  win.setTimeout(() => {
    const lit = doc.querySelector(LIT);
    if (!lit?.closest('[data-lk-hidden]')) { walking = 0; return; }
    walking += 1;
    Door.screen.key(doc.activeElement || doc.body, event.key, { code: event.code, keyCode: event.keyCode, which: event.which });
  }, 30);
}

function apply() { style('hidden', CSS); pass(host()); }
function start() {
  const doc = host();
  apply();
  watchScreen(pass, pass);
  listen(doc, 'contextmenu', onMenu, true);
  listen(doc, 'keydown', onArrow, true);   // seen before Logseq's own box takes it; looked at once Logseq has moved
}
function stop() { style('hidden', ''); for (const row of host().querySelectorAll('[data-lk-hidden]')) row.removeAttribute('data-lk-hidden'); }

/* The settings window's list: by where, each name with its × (the window draws the groups from the words). */
Look.hidden = { apply, start, stop, words, PLACES };
})();
