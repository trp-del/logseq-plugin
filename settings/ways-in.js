/* The ways into the settings window: g then , outside a bullet, Plugin settings in the command palette, the same words in Logseq's three-dots menu under
   Plugins, and the gear on the plugin's card, whose Open settings comes here instead of Logseq's plain list. Logseq's list
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
  if (drawing) { const icon = doc.createElement('i'); icon.className = 'ti ti-settings'; drawing.replaceWith(icon); }
  item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
  item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
  item.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    // Escape closes the menu the way Logseq's own items do.
    menu.dispatchEvent(new (doc.defaultView.KeyboardEvent)('keydown', { key: 'Escape', bubbles: true }));
    open();
  });
  (plugins || items[items.length - 1]).after(item);
}
function onDots(event) {
  if (!event.target.closest?.('.toolbar-dots-btn')) return;
  const doc = host(), win = doc.defaultView;
  let tries = 0;
  const look = () => {
    const menu = [...doc.querySelectorAll('[role="menu"]')].find(m => m.querySelector('[role="menuitem"]'));
    if (menu) { if (!menu.querySelector(`.${ITEM_CLASS}[data-copy="${COPY}"]`)) addMenuItem(menu); }
    else if (++tries < 30) win.requestAnimationFrame(look);
  };
  win.requestAnimationFrame(look);
}

function start() {
  const doc = host();
  // g then , ("go to settings", as Cmd-, in a Mac app): two keys, as Logseq's own g pairs, pressed outside a bullet.
  logseq.App.registerCommandPalette({ key: 'plugin-settings', label: LABEL, keybinding: { binding: 'g ,' } }, open);
  logseq.provideStyle({ key: 'plugin-settings-menu', style: `.${ITEM_CLASS}[data-highlighted] { background: color-mix(in srgb, currentColor 7%, transparent); }` });
  doc.addEventListener('click', onGear, true);
  doc.addEventListener('click', onDots, true);
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
  doc.removeEventListener('click', onGear, true);
  doc.removeEventListener('click', onDots, true);
  for (const item of doc.querySelectorAll('.' + ITEM_CLASS)) item.remove();
  Door.settings.stop();
}
Door.settingsWays = { start, reopen, stop };
})();
