/* The ways into the settings window: g then , outside a bullet, Plugin settings in the command palette, the same words in Logseq's three-dots menu under
   Plugins (and, at the head of that menu, the modules' places: Door.menuItems), and the gear on the plugin's card, whose Open settings comes here instead of Logseq's plain list. Logseq's list
   stays one word away, at the foot of the window. */
(function () {
const Door = window.PluginDoor;
const LABEL = 'Plugin settings', ITEM_CLASS = 'plugin-settings-menu-item';
const COPY = String(Date.now());   // tells this copy's menu item from one left by an earlier copy
const { host } = window.PluginDoor;
const open = () => Door.settings.open();

// A card says its plugin's id on a line of its own: compared whole, since many ids begin the same way.
const cardIsMine = card => [...card.querySelectorAll('small')].some(line => line.textContent.trim() === `ID: ${logseq.baseInfo?.id}`);

// The gear on a plugin's card is a small menu. Logseq would open its list from it; for this plugin the window opens instead.
function onGear(event) {
  const line = event.target.closest?.('.cp__plugins-item-card .ctl .menu-list li');
  if (!line || line.textContent.trim() !== 'Open settings') return;
  if (!cardIsMine(line.closest('.cp__plugins-item-card'))) return;
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
  open();
}

// Logseq 2.0.2 gives plugins no way to add to the three-dots menu, which is drawn only while open: after a click on its
// button, look for the menu for a few frames and add the item below Plugins.
function addMenuItem(menu) {
  const doc = menu.ownerDocument;
  for (const old of menu.querySelectorAll('.' + ITEM_CLASS)) old.remove();
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const plugins = items.find(item => item.querySelector('[class*="icon-apps"]')) || items.find(item => item.textContent.trim() === 'Plugins');
  const model = plugins || items[0];
  if (!model) return;
  const item = model.cloneNode(true);
  item.classList.add(ITEM_CLASS);
  item.dataset.copy = COPY;
  item.removeAttribute('data-highlighted');
  item.removeAttribute('id');
  ([...item.querySelectorAll('div')].find(div => !div.children.length) || item).textContent = LABEL;
  const drawing = item.querySelector('svg');
  // Sliders, not Settings' gear above it: two lines, two icons.
  if (drawing) { const icon = doc.createElement('i'); icon.className = 'ti ti-adjustments'; drawing.replaceWith(icon); }
  const holder = item.querySelector('[class*="ls-icon-"]');
  if (holder) holder.className = holder.className.replace(/\bls-icon-[\w-]+/, 'ls-icon-adjustments');
  item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
  item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
  item.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    // Escape closes the menu the way Logseq's own items do.
    Door.screen.key(menu, 'Escape');
    open();
  });
  (plugins || items[items.length - 1]).after(item);
}
// The modules' places (Door.menuItems: Find, the inspector) at the head of the menu, a line under them, drawn as
// Logseq's own lines are: each a copy of the first, its words and icon changed.
const PLACE_CLASS = 'plugin-place-menu-item';
function addPlaces(menu) {
  const doc = menu.ownerDocument;
  for (const old of menu.querySelectorAll('.' + PLACE_CLASS)) old.remove();
  const items = [...menu.querySelectorAll('[role="menuitem"]')].filter(item => !item.classList.contains(ITEM_CLASS));
  const first = items[0]; if (!first || !Door.menuItems.length) return;
  // Each with its icon (the owner, 9 November 2026: "plugin features in menu should have icons"): copied from a line of Logseq's
  // that has one (Settings, Plugins), so the icon stands where Logseq's stand.
  const model = items.find(item => item.querySelector('svg')) || first;
  const made = Door.menuItems.map(({ label, icon, run }) => {
    const item = model.cloneNode(true);
    item.classList.add(PLACE_CLASS); item.dataset.copy = COPY;
    item.removeAttribute('data-highlighted'); item.removeAttribute('id');
    ([...item.querySelectorAll('div, span')].reverse().find(el => !el.children.length && el.textContent.trim()) || item).textContent = label;
    const drawing = item.querySelector('svg, i.ti');
    if (drawing) { const i = doc.createElement('i'); i.className = `ti ti-${icon}`; drawing.replaceWith(i); }
    // The box keeps Logseq's name for the icon it holds, so a rule that colours an icon by its name reaches it (calm.js).
    const holder = item.querySelector('[class*="ls-icon-"]');
    if (holder) holder.className = holder.className.replace(/\bls-icon-[\w-]+/, `ls-icon-${icon}`);
    item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
    item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
    item.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      Door.screen.key(menu, 'Escape');
      run();
    });
    return item;
  });
  const line = doc.createElement('div'); line.setAttribute('role', 'separator'); line.className = `ui__dropdown-menu-separator ${PLACE_CLASS}`;
  line.style.cssText = 'height:1px;margin:4px -4px;';
  first.before(...made, line);
}
/* Logseq's own lines that it draws with no icon (the page's: Add to Favorites, Copy page URL, Delete page…) get one, so every line
   of the menu has its icon in the same column (the owner, 9 November 2026: "add icons for middle section of menu"). Drawn by a
   stylesheet before the line's words, from the same icon font, at the size and colour of the icons Logseq draws there; the line
   itself is Logseq's and is left as it is. A line this list does not know keeps the column empty, so its words still line up. */
const PAGE_ICONS = { 'Add to Favorites': 'star', 'Remove from Favorites': 'star-off', 'Copy page URL': 'link', 'Delete page': 'trash',
  'Export page': 'file-export', 'Publish page': 'world-upload', 'Unpublish page': 'world-off', 'Make it public for publishing': 'lock-open',
  'Make it private': 'lock', 'PDF or Markdown, your styles…': 'file-type-pdf', 'Convert to Tag': 'hash', 'Convert Tag to Page': 'file', 'Convert to Page': 'file',
  '(Dev) Show page data': 'code', 'Open in default app': 'external-link', 'Open in directory': 'folder', 'Copy page path': 'copy',
  // A bullet's menu (right-click on its dot), and the same words wherever else they stand.
  'Open in sidebar': 'layout-sidebar-right', 'Add comment': 'message', 'Add reaction': 'mood-smile', 'Set icon': 'icons',
  'Copy block ref': 'parentheses', 'Copy block refs': 'parentheses', 'Copy block embed': 'box-model', 'Copy block embeds': 'box-model', 'Copy block URL': 'link', 'Copy / Export as..': 'copy', 'Copy as': 'copy',
  'Cut': 'cut', 'Copy': 'clipboard', 'Delete': 'trash', 'Delete selected blocks': 'trash', 'Delete block': 'trash', 'Make a Flashcard': 'cards', 'Toggle number list': 'list-numbers',
  'Expand all': 'chevrons-down', 'Collapse all': 'chevrons-up', 'Developer tools': 'code', '(Dev) Show block data': 'code', '(Dev) Show block AST': 'code',
  'Open in a new tab': 'external-link', 'Open page in sidebar': 'layout-sidebar-right', 'Open in new window': 'external-link' };
const ICON_ATTR = 'data-lk-menu-icon';
const SWAP = { Recycle: 'recycle' };
function iconRules(doc, size, width, gap) {
  let sheet = doc.getElementById('lk-menu-icons');
  if (!sheet) sheet = Door.root.sheet('lk-menu-icons', null, '', doc);
  if (sheet.dataset.size === `${size}/${width}/${gap}`) return;
  const probe = doc.createElement('i'); probe.className = 'ti'; probe.style.cssText = 'position:absolute;visibility:hidden'; doc.body.appendChild(probe);
  const rules = [];
  for (const name of new Set([...Object.values(PAGE_ICONS), ...Object.values(SWAP)])) {
    probe.className = `ti ti-${name}`;
    const glyph = doc.defaultView.getComputedStyle(probe, '::before').content;
    if (glyph && glyph !== 'none') rules.push(`[${ICON_ATTR}="${name}"]::before { content: ${glyph}; }`);
  }
  const font = doc.defaultView.getComputedStyle(probe).fontFamily;
  probe.remove();
  sheet.dataset.size = `${size}/${width}/${gap}`; sheet.dataset.gap = String(gap); delete sheet.dataset.gaps;
  const iconBox = `[${ICON_ATTR}]::before { content: ""; font-family: ${font}; font-style: normal; font-weight: normal; font-size: ${size}px; line-height: 1; width: ${width}px; margin-right: ${gap}px; flex: none; text-align: center; color: var(--lk-quiet, currentColor); -webkit-font-smoothing: antialiased; }`;
  sheet.textContent = iconBox + '\n' + rules.join('\n') + `\n[${ICON_ATTR}] .ui__icon { display: none !important; }`;
}
// A line's words: its first words, before any key it shows (Open in sidebar ⇧Click).
function labelOf(item) {
  const walk = item.ownerDocument.createTreeWalker(item, 4);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.trim()) return n.nodeValue.trim();
  return '';
}
function addPageIcons(menu) {
  const doc = menu.ownerDocument;
  // The column reaches where Logseq's words start after its icons, measured on one of its lines; the icon as large as its drawing.
  // Measured in layout (offset), not on screen: the menu opens with a small zoom, which shrinks what the screen reports. A menu
  // with none of Logseq's icons (a bullet's) takes the last measure, so its lines stand as the ··· menu's do.
  const box = [...menu.querySelectorAll(`[role="menuitem"]:not(.${PLACE_CLASS}):not(.${ITEM_CLASS}) .ui__icon`)].find(b => b.querySelector('svg')), drawn = box?.querySelector('svg');
  const row = box?.parentElement, words = box && [...row.children].find(el => el !== box);
  const gap = row ? parseFloat(doc.defaultView.getComputedStyle(row).columnGap) || 0 : 4;
  if (box && words) iconRules(doc, Math.round(parseFloat(doc.defaultView.getComputedStyle(drawn).width) || 16), Math.round(words.offsetLeft - box.offsetLeft - gap) || 16, gap);
  else if (!doc.getElementById('lk-menu-icons')) iconRules(doc, 15, 16, 4);
  // A line's icon stands the same way from its words whatever space Logseq's line puts between its parts: a plain line keeps a gap
  // of its own (a bullet's menu), a line that opens a smaller menu (Add reaction ›) none; the icon's margin makes up the difference.
  const sheet = doc.getElementById('lk-menu-icons'), css = el => doc.defaultView.getComputedStyle(el);
  const plain = menu.querySelector('[role="menuitem"]:not(.ui__dropdown-menu-sub-trigger)'), sub = menu.querySelector('.ui__dropdown-menu-sub-trigger');
  const want = parseFloat(sheet?.dataset.gap) || 4, key = `${plain ? css(plain).columnGap : ''}/${sub ? css(sub).columnGap : ''}`;
  if (sheet && sheet.dataset.gaps !== key) {
    sheet.dataset.gaps = key;
    const margin = el => want - (parseFloat(el && css(el).columnGap) || 0);
    sheet.textContent = sheet.textContent.split('\n/*gaps*/')[0] + `\n/*gaps*/ [${ICON_ATTR}]::before { margin-right: ${margin(plain)}px; }` + (sub ? `\n.ui__dropdown-menu-sub-trigger[${ICON_ATTR}]::before { margin-right: ${margin(sub)}px; }` : '');
  }
  for (const item of menu.querySelectorAll('[role="menuitem"]')) {
    // A line whose icon Logseq gives to another line too (Recycle's bin is Delete's) takes one of its own: Logseq's is hidden.
    const swap = SWAP[labelOf(item)];
    if (swap) { if (item.getAttribute(ICON_ATTR) !== swap) item.setAttribute(ICON_ATTR, swap); continue; }
    if (item.querySelector('.ui__icon, i.ti')) { item.removeAttribute(ICON_ATTR); continue; }
    const name = PAGE_ICONS[labelOf(item)] || 'none';
    if (item.getAttribute(ICON_ATTR) !== name) item.setAttribute(ICON_ATTR, name);
  }
}
// Every menu Logseq opens (the ··· menu, a bullet's, a page's in the left sidebar), each time it opens.
const MENU = '.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content';
const menusPass = doc => { for (const menu of doc.querySelectorAll(MENU)) if (menu.querySelector('[role="menuitem"]:not([data-lk-menu-icon]):not(:has(.ui__icon, i.ti))')) addPageIcons(menu); };
let offs = [];
// The menu is looked for once a frame for half a second (the screen door's wait), so the lines are in it before it is first drawn.
async function onDots(event) {
  if (!event.target.closest?.('.toolbar-dots-btn')) return;
  const doc = host();
  const menu = await Door.screen.waitFor(() => [...doc.querySelectorAll('[role="menu"]')].find(m => m.querySelector('[role="menuitem"]')), 500, { frames: true });
  if (!menu) return;
  if (!menu.querySelector(`.${ITEM_CLASS}[data-copy="${COPY}"]`)) addMenuItem(menu);
  if (!menu.querySelector(`.${PLACE_CLASS}[data-copy="${COPY}"]`)) addPlaces(menu);
}

function start() {
  const doc = host();
  // g then , ("go to settings", as Cmd-, in a Mac app): two keys, as Logseq's own g pairs, pressed outside a bullet.
  logseq.App.registerCommandPalette({ key: 'plugin-settings', label: LABEL, keybinding: { binding: 'g ,' } }, open);
  Door.root.style('plugin-settings-menu', `:is(.${ITEM_CLASS}, .${PLACE_CLASS})[data-highlighted] { background: color-mix(in srgb, currentColor 7%, transparent); }`);
  offs = [Door.root.listen(doc, 'click', onGear, true), Door.root.listen(doc, 'click', onDots, true), Door.root.watch(menusPass)];
}
// A reload pressed in the window comes back to the window, at the part it was on, once the parts have started.
function reopen() {
  const win = host().defaultView;
  let back = null;
  try { back = win.sessionStorage.getItem(Door.settings.REOPEN_KEY); win.sessionStorage.removeItem(Door.settings.REOPEN_KEY); } catch (error) { /* no storage: it stays closed */ }
  if (back) Door.settings.open(back);
}
function stop() {
  const doc = host();
  for (const off of offs.splice(0)) off();
  for (const item of doc.querySelectorAll(`.${ITEM_CLASS}, .${PLACE_CLASS}`)) item.remove();
  for (const item of doc.querySelectorAll(`[${ICON_ATTR}]`)) item.removeAttribute(ICON_ATTR);
  doc.getElementById('lk-menu-icons')?.remove();
  Door.settings.stop();
}
Door.settingsWays = { start, reopen, stop };
})();
