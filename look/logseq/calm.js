/* Logseq's own screens around your pages, calmer (the owner, 8 November 2026: "less is more"): fewer lines, fills and boxes;
   space and the grammar's greys do the separating, and nothing you read is fainter than the quiet grey. One switch for each
   part, and a choice of reading width (the owner: "have options in the plugin settings"). Only stylesheets, and one pass that
   measures where a wide table stands; nothing is read from the graph. */
(function () {
const Look = window.Look;
const { style } = Look.kit, { setting } = Look.settings;
const AREA = ':is(#main-content-container, #right-sidebar)';
const PARTS = {
  calmType: `
/* The second pass (the owner: "You did not change much"). One typeface, the Mac's own, for Logseq and the plugin alike (mono
   stays mono). A neutral ink in place of Logseq's blue-black; in dark mode a softer white on a deeper ground, so the words do
   not glare. The greys follow, as they are mixed from the text colour. */
:root:root { --ls-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
body { font-family: var(--ls-font-family) !important; -webkit-font-smoothing: antialiased; }
:root[data-theme="light"] { --foreground: 0 0% 12%; }
:root[data-theme="dark"] { --background: 0 0% 9%; --foreground: 0 0% 92%; }`,
  calmSidebar: `
/* The left sidebar lies on the page's own ground, one hairline at its edge, where Logseq paints a grey slab (lighter than
   the page in dark mode). Its words at the body's weight; the one you are on gets the wash, not a grey pill. */
.left-sidebar-inner { background: var(--lk-paper) !important; box-shadow: inset -1px 0 0 var(--lk-hair) !important; }
.left-sidebar-inner :is(a.item, a.link-item, .favorite-item, .recent-item) { font-weight: 400 !important; }
.left-sidebar-inner a.item.active { background: var(--lk-wash) !important; }
.left-sidebar-inner .sidebar-content-group .hd { background: transparent !important; }
.left-sidebar-inner .sidebar-content-group .hd strong { font-weight: 400 !important; color: var(--lk-quiet) !important; }
/* The same page icon down every row is said once by the list: it goes to the off grey; an icon you chose keeps its place. */
.left-sidebar-inner :is(.page-icon, .ls-icon-calendar, .ls-icon-files) { color: var(--lk-quiet) !important; }
.left-sidebar-inner .cp__graphs-selector .thumb { background: none !important; }
/* The left sidebar: its words in the text colour with their icons in the quiet grey, the place you are on a little heavier
   (the owner, 8 November 2026: "you are now sacrificing legibility"; nothing you read is fainter than quiet). "Navigations"
   goes, its edit press still there under the pointer. */
.left-sidebar-inner :is(a.item, a.link-item) { color: var(--lk-text) !important; }
.left-sidebar-inner a.item.active { font-weight: 500 !important; }
.left-sidebar-inner .sidebar-content-group .hd:has(.as-edit) strong { visibility: hidden; }
.left-sidebar-inner .sidebar-content-group .hd .more { opacity: .7; }
.left-sidebar-inner .cp__graphs-selector strong { font-weight: 500 !important; }
.left-sidebar-inner .cp__graphs-selector :is(.thumb, .ls-icon-selector) { opacity: .7; }`,
  calmToolbar: `
/* The toolbar's icons: a finer stroke, quieter at rest, the text colour under the pointer. */
#head svg.tabler-icon, #head .ui__icon svg { stroke-width: 1.75 !important; }
#head :is(button, a.button):hover { opacity: 1 !important; }
.cp__sidebar-help-btn:hover { opacity: 1; }
.cp__sidebar-help-btn .inner { background: none !important; box-shadow: none !important; border: 0 !important; }
/* The toolbar at Logseq's own strength, its icons drawn finer. */
#head :is(button, a.button) { opacity: .7 !important; }
.cp__sidebar-help-btn { opacity: .7; }
/* The toolbar streamlined (the owner, 9 November 2026: "you are suppose to streamline not just move icons around", then "cut back
   and forth. put different plugin features under three dots"): two buttons where Logseq has eight, Logseq's ··· menu and the
   sidebar button. The plugin's places (Find, Structure, the inspector) head the ··· menu (Door.menuItems); Logseq's magnifier at
   the top left opens Find; back and forward are Cmd [ and Cmd ]; Home goes (Journals heads the left sidebar); the puzzle goes
   (Plugins and Plugin settings are in the ··· menu). Another plugin's button stays, before the ···. */
#head .r > .flex.items-center > button:has(.ls-icon-home), #head .r > .flex.items-center .toolbar-plugins-manager,
#head .r .nav-left, #head .r .nav-right, #head [id^="injected-ui-item-structure-open"], #head [id^="injected-ui-item-find-open"] { display: none !important; }
/* Scroll bars thin and faint, firmer under the pointer. */
::-webkit-scrollbar { width: 8px; height: 8px; background: transparent; }
::-webkit-scrollbar-thumb { background: var(--lk-hair); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--lk-line); }
::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }`,
  calmPage: `
/* A page's title a step smaller and a little tighter, so it heads the page without shouting over it. */
${AREA} .ls-page-title-container { font-size: 30px !important; line-height: 1.3 !important; }
${AREA} .ls-page-title-container .block-content-or-editor-inner { font-size: inherit !important; line-height: inherit !important; }
${AREA} .ls-page-title-container :is(.block-title-wrap, .editor-inner textarea) { font-weight: 600 !important; letter-spacing: -.015em; }
/* Journal days are parted by space, not a rule. */
#journals .journal-item { border-bottom-color: transparent !important; }
/* Linked references and its like: a quiet heading, not a bold one. */
${AREA} .references :is(h2, .font-medium, .font-bold) { font-weight: 500 !important; }`,
  calmTables: `
/* Logseq's tables: no ground on the head, no lines between columns (the column edge stays to drag), a hairline under each row,
   the wash under the pointer. */
${AREA} .ls-table-header { background: transparent !important; border-top-color: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-header-cell, ${AREA} .ls-table-rows .border-r { border-right-color: transparent !important; }
${AREA} .ls-table-header-cell { font-weight: 400 !important; }
${AREA} .ls-table-row { background: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-row:hover { background: var(--lk-wash) !important; }
/* The columns that stay put while the table scrolls need a ground: the page's own, or the wash's equal under the pointer. */
${AREA} :is(.ls-table-row, .ls-table-header) .sticky-columns { background: var(--lk-paper) !important; }
${AREA} .ls-table-row:hover .sticky-columns { background: color-mix(in srgb, var(--lk-text) 7%, var(--lk-paper)) !important; }
${AREA} :is(.ls-table-row, .ls-table-header) .sticky-columns button { background: transparent !important; }`,
  calmSearch: `
/* Logseq's search window: one ground, a hairline and one shadow, as the grammar's window. No grey bands at the top and the
   foot, no boxes round icons or keys, no blue ring round the row you are on; the tip at the foot is left out, its room kept. */
.ui__dialog-content:has(.cp__cmdk__modal), .cp__cmdk__modal { background: var(--lk-paper) !important; }
.cp__cmdk__modal .overflow-y-auto { background: transparent !important; }
.ui__dialog-content:has(.cp__cmdk__modal) { overflow: hidden; }
.cp__cmdk__modal .cp__cmdk-input-row { background: transparent !important; border-bottom-color: var(--lk-hair) !important; }
.cp__cmdk__modal div:has(> .search-results) { border-bottom-color: var(--lk-hair) !important; }
.cp__cmdk__modal div:has(> .search-results) > div:first-child { background: transparent !important; }
.cp__cmdk__modal div:has(> .search-results) > div:first-child .font-bold { font-weight: 400 !important; color: var(--lk-quiet) !important; }
.cp__cmdk__modal [data-item-index] > div { box-shadow: none !important; }
.cp__cmdk__modal [data-item-index] > div[style*="background"] { background: var(--lk-wash) !important; }
.cp__cmdk__modal [data-item-index] .bg-gray-05 { background: transparent !important; color: var(--lk-quiet) !important; }
.cp__cmdk__modal .hints { background: transparent !important; border-top: 1px solid var(--lk-hair) !important; }
.cp__cmdk__modal .hints > .text-sm { visibility: hidden; }`,
  calmMenus: `
/* Menus and panels (the owner, 8 November 2026: "look through the menus and panels and modernize them"). Logseq's menus,
   pop-ups and lists are drawn as the library's (lk-pop, lk-menu, lk-item in plugin.js): the page's ground, a hairline, a 6 px
   corner, one shadow; lines in the pop-up's body size (14 px) at the body's weight, the wash on the line you are on, icons in the off grey, a hairline between
   groups. */
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__popover-content, .ui__select-content, .ui__multi-select-content) { background: var(--lk-paper) !important; color: var(--lk-text) !important; border: 1px solid var(--lk-hair) !important; border-radius: 6px !important; box-shadow: 0 6px 18px rgba(0,0,0,.12) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__select-content) { padding: 4px !important; }
:is(.ui__dropdown-menu-item, .ui__select-item, .ui__context-menu-content [role=menuitem]) { font-weight: 400 !important; font-size: 14px !important; line-height: 20px !important; padding: 5px 8px !important; min-height: 0 !important; border-radius: 4px !important; color: var(--lk-text) !important; gap: 8px !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) :is(.ui__icon, i.ti) { font-size: 15px !important; width: 16px; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) svg.tabler-icon { width: 15px !important; height: 15px !important; stroke-width: 1.5 !important; }
:is(.ui__dropdown-menu-item, .ui__select-item, .ui__context-menu-content [role=menuitem]):is([data-highlighted], :hover) { background: var(--lk-wash) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content) :is(.ui__icon, i.ti) { color: var(--lk-quiet) !important; }
/* Under the keyboard a line takes the wash, never a ring round it (the grammar's rule). */
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content, .ui__select-content) :focus-visible { outline: none !important; box-shadow: none !important; background: var(--lk-wash) !important; border-radius: 4px; }
:is(.ui__dropdown-menu-separator, .ui__context-menu-separator, [role=separator]) { background: var(--lk-hair) !important; }
:is(.ui__dropdown-menu-label, .ui__context-menu-label) { font-weight: 400 !important; color: var(--lk-quiet) !important; }
/* Logseq's windows (Settings, the dialogs) are the library's window: the page's ground, a hairline, the same corner and shadow
   as the search window; the dimmed page behind them as the plugin's own windows have it. */
.ui__dialog-content { background: var(--lk-paper) !important; border: 1px solid var(--lk-hair) !important; border-radius: 8px !important; box-shadow: 0 10px 30px rgba(0,0,0,.14) !important; }
/* Settings: the list of sections lies on the window's ground with a hairline beside it, the one you are on in the wash, its
   names at the body's weight with faint icons; the window's name a step down. Logseq's filled dark buttons in it keep a soft
   ground so they still read as buttons, in the text colour, firmer under the pointer. */
.cp__settings-inner > aside { background: transparent !important; box-shadow: inset -1px 0 0 var(--lk-hair) !important; }
.cp__settings-inner .settings-menu-item { background: transparent !important; border-radius: 6px; }
.cp__settings-inner .settings-menu-item:is(.active, :hover) { background: var(--lk-wash) !important; }
.cp__settings-inner .settings-menu-link strong { font-weight: 400 !important; }
.cp__settings-inner .settings-menu-link .ui__icon { color: var(--lk-quiet) !important; }
.cp__settings-inner .cp__settings-modal-title { font-size: 20px !important; font-weight: 600 !important; }
.cp__settings-inner .cp__settings-category-title { font-weight: 600 !important; }
.cp__settings-inner .panel-wrap .ui__button[class~="bg-primary/90"] { background: color-mix(in srgb, var(--lk-text) 9%, transparent) !important; color: var(--lk-text) !important; box-shadow: none !important; border: 0 !important; border-radius: 6px !important; font-weight: 500 !important; }
.cp__settings-inner .panel-wrap .ui__button[class~="bg-primary/90"]:hover { background: color-mix(in srgb, var(--lk-text) 15%, transparent) !important; }
.cp__settings-inner .panel-wrap :is(select, [role=combobox], input:not([type=checkbox]):not([type=radio])) { background: transparent !important; border-color: var(--lk-hair) !important; box-shadow: none !important; }`,
};
/* Menu icons in colour (the owner, 9 November 2026: "you can add color to icons for menus", then "don't seem to have much semantic
   meaning for color"): colour only where it says something the words do not. Red: the line deletes, it can lose what you wrote.
   Amber: the star of a favourite, the colour a favourite has. Blue: the plugin's own places (Find, Structure, the inspector), so
   they are found at a glance among Logseq's lines. Every other icon keeps the quiet grey. The icons are told by their names:
   Logseq's ls-icon-<name>, the plugin's ti-<name>, and the ones the plugin draws (data-lk-menu-icon, settings/ways-in.js). */
const MENU_HUES = {
  blue: ['search', 'sitemap', 'info-circle'],
  amber: ['star', 'star-off'],
  red: ['trash'],
};
const MENUS = ':is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content)';
const menuHuesCss = `
:root { --lk-hue-blue: hsl(212 62% 50%); --lk-hue-amber: hsl(38 85% 46%); --lk-hue-red: hsl(2 62% 52%); }
:root[data-theme="dark"] { --lk-hue-blue: hsl(212 70% 66%); --lk-hue-amber: hsl(40 80% 60%); --lk-hue-red: hsl(2 70% 66%); }
` + Object.entries(MENU_HUES).map(([hue, names]) => `${MENUS} :is(${names.map(n => `.ls-icon-${n}, i.ti-${n}`).join(', ')}), ${names.map(n => `${MENUS} [data-lk-menu-icon="${n}"]::before`).join(', ')} { color: var(--lk-hue-${hue}) !important; }`).join('\n');
PARTS.calmMenus += menuHuesCss;
/* Width by kind (the owner, 8 November 2026: "certain things need to be wide like a table but others like outline can
   benefit from readable width"; "the readable width needs to be centered"). The page is one column at reading width,
   centred, so the title, the properties, Structure's lines, Threads' rows, the outline and the references share one left
   edge; a table, and Threads' two pages side by side, reach out to the window's width, centred on the same middle, wherever
   they stand under a bullet however deep (place(), below, measures where each stands). A tag's or a property's page, which
   holds the table of its nodes, keeps Logseq's own layout, everything on the left edge of the wide page (the owner: "tag or
   property pages should still have non-table elements on left side like default"). */
const WIDTHS = { Narrow: '44rem', Medium: '52rem', Wide: '60rem' };
const reading = () => WIDTHS[setting('readingWidth')] || null;
const widthCss = col => `
#main-content-container .cp__sidebar-main-content { max-width: ${col} !important; }
#main-content-container .cp__sidebar-main-content:has(.page-tabs) { max-width: min(1440px, 100%) !important; }
#main-content-container [data-lk-wide] { width: var(--lk-w) !important; max-width: none !important; margin-left: var(--lk-out) !important; }
#main-content-container :is(.ls-foldable-content-inner, .ls-page-blocks):has([data-lk-wide]) { overflow: visible !important; }`;
/* What reaches out to the window's width: each one's left edge is measured and moved so it spans the page's middle
   (up to 1440 px, 48 px from each side), whatever indent it stands at. Run before the screen is drawn, so nothing jumps. */
const WIDE = '#main-content-container :is(.ls-page-blocks .ls-table, .th-tw-beside)';
function place(doc) {
  if (!reading()) { for (const node of doc.querySelectorAll('[data-lk-wide]')) { node.removeAttribute('data-lk-wide'); node.style.removeProperty('--lk-out'); node.style.removeProperty('--lk-w'); } return; }
  const main = doc.querySelector('#main-content-container');
  if (!main) return;
  const m = main.getBoundingClientRect();
  const wide = Math.round(Math.max(0, Math.min(1440, m.width - 96)));
  const target = m.left + (m.width - wide) / 2;
  for (const node of doc.querySelectorAll(WIDE)) {
    if (node.closest('.cp__sidebar-main-content')?.querySelector('.page-tabs')) { if (node.hasAttribute('data-lk-wide')) { node.removeAttribute('data-lk-wide'); node.style.removeProperty('--lk-out'); node.style.removeProperty('--lk-w'); } continue; }
    const was = (node.getAttribute('data-lk-wide') || '').split(',').map(Number);
    const natural = node.getBoundingClientRect().left - (node.hasAttribute('data-lk-wide') ? was[0] : 0);
    const out = Math.round(target - natural);
    if (was[0] === out && was[1] === wide) continue;
    node.style.setProperty('--lk-out', out + 'px');
    node.style.setProperty('--lk-w', wide + 'px');
    node.setAttribute('data-lk-wide', out + ',' + wide);
  }
}
let watching = false, onResize = null;
function apply() {
  for (const [key, css] of Object.entries(PARTS)) style(key, setting(key) ? css : '');
  style('readingWidth', reading() ? widthCss(reading()) : '');
  const doc = Look.kit.host();
  if (!watching) { watching = true; Look.kit.watchScreen(place, place); onResize = () => place(doc); doc.defaultView.addEventListener('resize', onResize); }
  place(doc);
}
function stop() { if (onResize) Look.kit.host().defaultView.removeEventListener('resize', onResize); onResize = null; watching = false; }
Look.calm = { apply, stop };
})();
