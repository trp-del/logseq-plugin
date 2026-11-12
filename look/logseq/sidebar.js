/* The right sidebar, on the grammar. Logseq 2.0.2 paints the bar on top of it (.cp__right-sidebar-topbar) with
   --ls-right-sidebar-topbar-color, then --lx-gray-02, then --ls-secondary-background-color, and when the theme sets none, a
   fixed blue grey (rgb(216, 225, 232), measured); its views (Contents, Page graph, Help, and with developer mode on
   "(Dev) RTC", "(Dev) Undo/Redo", "(Dev) Profiler") are buttons in a row; each item is a card (.sidebar-item.color-level
   .rounded-md.shadow-lg, its header .color-level.rounded-t-md). Here: the bar takes the page's own ground with a hairline
   under it, the views are quiet words in the text colour, the developer views are left out (marked by a screen pass,
   since a stylesheet cannot read their words), and the items lie flat on the sidebar, no card, shadow or rounded corner,
   with a line between one and the next. Two switches. The old plugin's sidebar part drew the same (the
   owner: "flattened design of sidebar, removing shadows and adding lines"; "where is this blue coming from?"). A page in it
   (sidebarPages): its name in the item's head reads as a link and opens the page in the main view, where Logseq would fold the
   item (its arrow still folds it); its properties stand open, Logseq's "Open properties" pressed once for it and left out. */
(function () {
const Look = window.Look;
const { style, watchScreen } = Look.kit;
const setting = key => Look.settings.setting(key);

const barCss = `
#right-sidebar .cp__right-sidebar-topbar { background-color: var(--lk-paper, Canvas) !important; box-shadow: 0 1px 0 var(--lk-hair); }
#right-sidebar .cp__right-sidebar-settings-btn { color: inherit !important; opacity: .7; background: none !important; border: 0 !important; box-shadow: none !important; }
#right-sidebar .cp__right-sidebar-settings-btn:hover, #right-sidebar .cp__right-sidebar-settings-btn:focus-visible { opacity: 1; }
#right-sidebar .cp__right-sidebar-settings > div[data-lk-dev] { display: none !important; }`;
const flatCss = `
#right-sidebar .sidebar-item-list > .sidebar-item, #right-sidebar .sidebar-item-list > .sidebar-item .sidebar-item-header { box-shadow: none !important; background: transparent !important; border-radius: 0 !important; }
#right-sidebar .sidebar-item-list > .sidebar-item ~ .sidebar-item { border-top: 1px solid var(--lk-line) !important; margin-top: 10px; padding-top: 6px; }
#right-sidebar .sidebar-item-list { padding-top: 24px !important; }
/* The whole sidebar on the page's own ground (the owner, 9 November 2026: "inspector should be same color as main view … as well
   whole sidebar"), where Logseq paints it a grey of its own; the line at its edge parts it from the page. */
#right-sidebar, #right-sidebar .right-sidebar-container, #right-sidebar-container { background-color: var(--lk-paper, Canvas) !important; }`;
const PAGE_ITEM = '#right-sidebar .sidebar-item.item-type-page';
const NAME = `${PAGE_ITEM} .sidebar-item-header .page-title > span:last-child`;
const PROPS_TOGGLE = `${PAGE_ITEM} .ls-sidebar-page-properties > div:first-child:has(> button:only-child)`;
const pagesCss = `
${NAME} { cursor: pointer; ${window.PluginDoor.LOOKS.link(false)} }
${NAME}:hover { text-decoration-color: currentColor; }
${PROPS_TOGGLE} { display: none !important; }`;

// The developer views and Help are told by their words; the mark is swept with the plugin's attributes.
function markDevViews(doc) {
  const on = setting('sidebarBar');
  for (const box of doc.querySelectorAll('#right-sidebar .cp__right-sidebar-settings > div')) {
    // Help goes too: the ? at the window's bottom right opens Logseq's help too; and Contents and Page graph (the owner, 9 November
    // 2026: "remove contents, page, graph"), so the row holds the plugin's views: Inspector, Links, Endnotes.
    const dev = on && /^(\(Dev\)|Help|Contents|Page graph)$|^\(Dev\)/.test(box.textContent.trim());
    if (dev) { if (!box.hasAttribute('data-lk-dev')) box.setAttribute('data-lk-dev', ''); }
    else if (box.hasAttribute('data-lk-dev')) box.removeAttribute('data-lk-dev');
  }
}
/* Each page's properties open: Logseq's "Open properties" pressed once for each item, while they are closed, and never again
   for that item. A press is a click, and Logseq closes the list open in the bullet being written (after # or /) on any click:
   pressed again every second, for a page whose properties never show as open (one with none of its own), it closed that list
   a letter or two into typing (the owner, 6 November 2026: "the prompt just disappears after typing a letter or two"). Once
   also leaves an item the person folds folded. */
const pressed = new WeakSet();
function openProperties(doc) {
  if (!setting('sidebarPages')) return;
  for (const box of doc.querySelectorAll(`${PAGE_ITEM} .ls-sidebar-page-properties`)) {
    if (pressed.has(box) || box.querySelector('.ls-page-properties')) continue;
    const toggle = box.querySelector(':scope > div:first-child > button:only-child');
    if (!toggle) continue;
    pressed.add(box);
    window.PluginDoor.screen.click(toggle);
  }
}
// A press on a page's name in an item's head opens the page in the main view, before Logseq takes it to fold the item.
function openName(event) {
  if (!setting('sidebarPages') || event.button) return;
  const name = event.target.closest?.(NAME);
  if (!name) return;
  event.preventDefault(); event.stopPropagation();
  const words = name.textContent.trim();
  const uuid = Look.index?.uuidByName?.(words);
  if (uuid) Look.kit.openPage(uuid, event.shiftKey); else logseq.App.pushState('page', { name: words.toLowerCase() });
}
function pass(doc) { markDevViews(doc); openProperties(doc); }
function apply() {
  style('sidebar-bar', setting('sidebarBar') ? barCss : '');
  style('sidebar-flat', setting('sidebarFlat') ? flatCss : '');
  style('sidebar-pages', setting('sidebarPages') ? pagesCss : '');
}
function start() { apply(); watchScreen(pass); Look.kit.listen(Look.kit.host(), 'click', openName, true); }
function stop() { style('sidebar-bar', ''); style('sidebar-flat', ''); style('sidebar-pages', ''); }
Look.sidebar = { apply, start, stop, markDevViews, openProperties, openName };
})();
