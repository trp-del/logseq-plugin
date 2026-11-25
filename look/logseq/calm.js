/* Logseq's own screens around your pages, calmer (the owner, 8 November 2026: "less is more"): fewer lines, fills and boxes;
   space and the grammar's greys do the separating, and nothing you read is fainter than the quiet grey. One switch for each
   part, and a choice of reading width (the owner: "have options in the plugin settings"). Only stylesheets, one pass that
   measures where a wide table stands, and Logseq's scroll bar rules set aside (macBars); nothing is read from the graph. */
(function () {
const Look = window.Look;
const { style } = Look.kit, { setting } = Look.settings;
const AREA = ':is(#main-content-container, #right-sidebar)';
const LOOKS = window.PluginDoor.LOOKS;   // the library's looks, written once there
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
/* The page's icon a diamond (the owner, 14 November 2026: "do diamond shape for page", then "fill in the diamond", then "make symbol smaller", then "go back to diamond regular size outline but make it heavier"), an outline at the regular size, wherever Logseq draws its file icon for a
   page: the left sidebar, search, the right sidebar. Logseq's box and colour stay; only its drawing gives way to the diamond. */
.icon-cp-container > .ls-icon-file svg > * { display: none; }
.icon-cp-container > .ls-icon-file svg { background: currentColor; -webkit-mask: var(--lk-sf-page, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 3l5 5-5 5-5-5z' fill='none' stroke='black' stroke-width='1.5' stroke-linejoin='miter'/%3E%3C/svg%3E")) center / var(--lk-sf-page-size, 100% 100%) no-repeat; }
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
   and forth. put different plugin features under three dots"): four buttons where Logseq has eight, Ontology and Todo (the owner,
   14 November 2026: buttons, not in the ··· menu), Logseq's ··· menu and the sidebar button. Find and the inspector head the ···
   menu (Door.menuItems); Logseq's magnifier at
   the top left opens Find; back and forward are Cmd [ and Cmd ]; Home goes (Journals heads the left sidebar); the puzzle goes
   (Plugins and Plugin settings are in the ··· menu). Another plugin's button stays, before the ···. */
#head .r > .flex.items-center > button:has(.ls-icon-home), #head .r > .flex.items-center .toolbar-plugins-manager,
#head .r .nav-left, #head .r .nav-right, #head [id^="injected-ui-item-find-open"] { display: none !important; }
/* Scroll bars: the Mac's own (the owner, 14 November 2026: "default to macos scrollbar behavior", then "They should actually be
   them"). The plugin draws none, and Logseq's own scroll bar styling is set aside where it reaches the page and the sidebar
   (macBars, below), so each bar is the system's, following System Settings > Appearance > Show scroll bars. The plugin's
   earlier thin bar, and the setting that chose it, went on 24 November 2026. */`,
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
/* Logseq's tables: no ground of its own on the head, no lines between columns (the column edge stays to drag), a hairline under
   each row, the wash under the pointer. The head takes the page's own ground, not none: Logseq pins it at the top while its
   table scrolls, and with no ground the rows read through the column names (the owner, 12 November 2026: "the table headers
   look translucent"). */
${AREA} .ls-table-header { background: var(--lk-paper) !important; border-top-color: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-header-cell, ${AREA} .ls-table-rows .border-r { border-right-color: transparent !important; }
${AREA} .ls-table-header-cell { font-weight: 400 !important; }
${AREA} .ls-table-row { background: transparent !important; border-bottom-color: var(--lk-hair) !important; }
${AREA} .ls-table-row:hover { background: var(--lk-wash) !important; }
/* The columns that stay put while the table scrolls need a ground: the page's own, or the wash's equal under the pointer. */
${AREA} :is(.ls-table-row, .ls-table-header) .sticky-columns { background: var(--lk-paper) !important; }
${AREA} .ls-table-row:hover .sticky-columns { background: color-mix(in srgb, var(--lk-text) 7%, var(--lk-paper)) !important; }
${AREA} :is(.ls-table-row, .ls-table-header) .sticky-columns button:not(.ui__checkbox) { background: transparent !important; }
/* A table's tick boxes are the library's tick box (lk-tick): a rounded square, its edge firming and a small check in the text colour
   when ticked. Logseq fills a ticked one with its colour and draws a white check; the line above once took the fill away and left
   the white check on white, so a ticked row could not be told (the owner, 13 November 2026: "the check boxes in tables seem off"). */
${AREA} .ls-table .ui__checkbox:not(.property-value-inner *) { width: 14px !important; height: 14px !important; border: 1.5px solid var(--lk-line) !important; border-radius: 4px !important; background: transparent !important; box-shadow: none !important; align-items: center; justify-content: center; }
${AREA} .ls-table .ui__checkbox:not(.property-value-inner *):hover, ${AREA} .ls-table .ui__checkbox:not(.property-value-inner *):is([data-checked], [data-state=checked], [data-state=indeterminate]) { border-color: var(--lk-text) !important; }
${AREA} .ls-table .ui__checkbox:not(.property-value-inner *) :is(span, svg) { color: var(--lk-text) !important; }
${AREA} .ls-table .ui__checkbox:not(.property-value-inner *) svg { width: 10px !important; height: 10px !important; stroke-width: 3.2 !important; }
/* Under the pointer Logseq shows two buttons at the end of a row's name: open the page, open it in the sidebar. Its arrow for the first
   read as "to the side", beside the sidebar's own icon, and a page icon was ugly; the first says Open instead (the owner, 16 November 2026). */
${AREA} .table-block-title > .absolute button:first-child { width: auto !important; padding: 0 6px !important; font-size: var(--lk-small); font-weight: 400; color: var(--lk-quiet); }
${AREA} .table-block-title > .absolute button:first-child:hover { color: var(--lk-text); }
${AREA} .table-block-title > .absolute button { background: transparent !important; border-radius: 999px !important; }
${AREA} .table-block-title > .absolute button:hover { background: var(--lk-wash) !important; }
${AREA} .table-block-title > .absolute button:first-child svg { display: none; }
${AREA} .table-block-title > .absolute button:first-child::before { content: "Open"; }
/* The table in the plugin's own look (the owner, 18 November 2026, chose B of table-sidebar-look.html: "the table view design is still
   stunted and isn't keeping in line with the plugin's library design"). One text colour: the table's words are the plugin's text colour
   and its quiet grey, not Logseq's black and grey. The column named in the sort is the one dark word of the head. */
${AREA} .ls-table :is(.ls-table-cell, .ls-table-cell *:not(.tag, a.tag, .tag *, .ui__checkbox, .ui__checkbox *)) { color: var(--lk-text); }
${AREA} .ls-table :is(.text-muted-foreground, .text-gray-500, .bracket) { color: var(--lk-quiet) !important; }
${AREA} .ls-table-header-cell button { color: var(--lk-quiet) !important; font-size: 14px; }
${AREA} .ls-table-header-cell button:hover { color: var(--lk-text) !important; }
${AREA} .ls-table-header-cell:has(.ls-icon-arrow-up, .ls-icon-arrow-down) button { color: var(--lk-text) !important; font-weight: 600; }
/* A link in a cell is its name with the faint underline, with no brackets, as a link is everywhere else. */
${AREA} .ls-table-cell .page-reference > .bracket { display: none; }
/* The bar: the view's name as a word (the one in force with its short bar), no icon and no count; what each button does is said in a
   word beside its icon, as the Ontology page's presses are, a round wash under the pointer. The two + signs of Logseq's bar said
   different things with one mark: the one beside the view's name makes a view ("+ New view"), the one at the right end makes a node ("+ New"). */
${AREA} .ls-view-head .views button[data-view-tab-id] { padding: 3px 8px 6px !important; height: auto !important; font-weight: 400 !important; color: var(--lk-quiet) !important; position: relative; }
${AREA} .ls-view-head .views button[data-view-tab-id]:not(.text-muted-foreground) { color: var(--lk-text) !important; }
${AREA} .ls-view-head .views button[data-view-tab-id]:not(.text-muted-foreground)::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: 0; height: 1px; background: currentColor; }
${AREA} .ls-view-head .views button[data-view-tab-id] > :is(.ls-icon-color-wrap, .text-xs) { display: none !important; }
${AREA} .ls-view-head .views button[title="Add new view"] { padding: 3px 8px 6px !important; height: auto !important; width: auto !important; opacity: 1 !important; color: var(--lk-quiet) !important; font-size: 14px; font-weight: 400; }
${AREA} .ls-view-head .views button[title="Add new view"]:hover { color: var(--lk-text) !important; background: transparent !important; }
${AREA} .ls-view-head .views button[title="Add new view"] > * { display: none !important; }
${AREA} .ls-view-head .views button[title="Add new view"]::before { content: "+ New view"; }
${AREA} .ls-view-head .view-actions { opacity: 1 !important; gap: 2px !important; }
${AREA} :is(.ls-view-head .view-actions > *, .ls-view-head .view-actions button) { width: auto !important; min-width: 0 !important; flex: none !important; white-space: nowrap; }
${AREA} .ls-view-head .views { margin-left: -8px; }
${AREA} .ls-view-head :is(.view-action-search > div, .view-action-type .property-value-inner, .view-action-type .jtrigger) { width: auto !important; flex: none !important; }
${AREA} .ls-view-head .view-actions :is(button.as-ghost, .view-action-type) { color: var(--lk-text) !important; font-size: 14px !important; font-weight: 400 !important; height: auto !important; padding: 4px 9px !important; border-radius: 999px !important; gap: 6px !important; background: transparent !important; }
${AREA} .ls-view-head .view-actions .view-action-type { display: inline-flex; align-items: center; padding: 0 !important; }
${AREA} .ls-view-head .view-actions .view-action-type .select-item { padding: 4px 9px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; }
${AREA} .ls-view-head .view-actions :is(button.as-ghost, .view-action-type .select-item):hover { background: var(--lk-wash) !important; }
${AREA} .ls-view-head .view-actions :is(.ui__icon, svg) { width: 15px; height: 15px; color: var(--lk-text) !important; }
${AREA} .ls-view-head .view-actions svg { stroke-width: 1.5 !important; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-arrows-up-down)::after { content: "Sort"; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-filter)::after { content: "Filter"; }
${AREA} .ls-view-head .view-action-search > div > button:first-child::after { content: "Find"; }
${AREA} .ls-view-head .view-action-search:has(input) > div > button:first-child::after { content: none; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-table) .select-item::after { content: "Table"; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-list) .select-item::after { content: "List"; }
${AREA} .ls-view-head .view-action-type:has(.ls-icon-layout-grid) .select-item::after { content: "Gallery"; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-plus)::after { content: "New"; }
${AREA} .ls-view-head .view-actions > button:has(.ls-icon-dots) { padding: 4px 8px !important; }
/* Find in the table is the library's field: its words on a hairline that firms while it has the keyboard, no box and no ring. */
${AREA} .ls-view-head .view-action-search input { background: transparent !important; border: 0 !important; border-bottom: 1px solid var(--lk-line) !important; border-radius: 0 !important; box-shadow: none !important; outline: none !important; font-size: 14px; color: var(--lk-text); }
${AREA} .ls-view-head .view-action-search input:focus { border-bottom-color: var(--lk-text) !important; }
${AREA} .ls-view-head .view-action-search input::placeholder { color: var(--lk-off); }
/* What you can do with the rows you ticked (the owner's "good" to "Emptiness, Applied", 24 November 2026): a flat capsule in the
   line above the column names, where "Sorted by…" stands, so it covers no name and no row moves; its words start on the names'
   edge; the bin stands apart at its end. Logseq draws the bar inside the head of the table, over the names, and the table cuts off
   whatever leaves it; so while a bar stands, the table's own boxes (its rows, and the fold around them) reach one line up (pulled up and padded by
   the same 31 pt, so nothing in them moves) and the bar is set in that line. "Sorted by…" keeps its room, unseen, while the bar stands there. With the
   head held at the window's top (Logseq's ls-fixed) the line above is out of sight, and the bar stays on the head as Logseq has
   it. A table with no such line above it keeps the bar where Logseq puts it. The capsule is the library's (LOOKS.capsule). */
${AREA} :has(> .lk-tstate) :is(.ls-foldable-content-inner, .ls-table-rows):has(.ls-table-actions) { margin-top: calc(-1 * var(--lk-bar-room, 31px)) !important; padding-top: var(--lk-bar-room, 31px) !important; }
${AREA} :has(> .lk-tstate) .ls-table-header:not(.ls-fixed) > .table-action-bar { top: calc(1px - var(--lk-bar-room, 31px)) !important; left: 24px !important; }
${AREA} :has(> .lk-tstate) .ls-table-header:not(.ls-fixed):has(> .table-action-bar) { overflow: visible !important; }   /* the head cuts off what leaves it; it needs to only while it is held at the window's top */
${AREA} .ls-table-header.ls-fixed > .table-action-bar .ls-table-actions { background-image: linear-gradient(var(--lk-wash), var(--lk-wash)) !important; background-color: var(--lk-paper) !important; }   /* over the names there, so on the page's own ground */
/* In a narrow page the bar's words take two lines: the line it stands in is then as high as the bar (--lk-bar-room, set by Ontology's
   table-values, which also keeps the rows where they stood on the screen). */
${AREA} :has(> .lk-tstate):has(.ls-table-actions) > .lk-tstate { visibility: hidden; box-sizing: border-box; min-height: calc(var(--lk-bar-room, 31px) - 4px); }
${AREA} .table-action-bar .ls-table-actions { ${LOOKS.capsule} border-radius: 14px !important; min-height: 28px; padding: 0 10px 0 8px !important; gap: 2px !important; }   /* round ends at one line; the same corners when its words take two */
${AREA} .table-action-bar .ui__button:has(.ls-icon-trash) { margin-left: 10px !important; }
/* The word that is pressed, while its list or box is open: a shade firmer than the capsule, so the bar says where you are. */
${AREA} .table-action-bar .ui__button:is([data-lk-on], [aria-expanded="true"]) { background: var(--lk-hair) !important; }
${AREA} .table-action-bar .selection-count { color: var(--lk-quiet); font-size: 14px; white-space: nowrap; }
${AREA} .table-action-bar .ui__toolbar-group { gap: 2px !important; }
${AREA} .table-action-bar .ui__button { border: 0 !important; background: transparent !important; box-shadow: none !important; border-radius: 999px !important; font-size: 14px !important; font-weight: 400 !important; color: var(--lk-text) !important; height: 28px !important; padding: 0 10px !important; margin: 0 !important; }
${AREA} .table-action-bar .ui__button:hover { background: var(--lk-wash) !important; }
${AREA} .table-action-bar .ui__button:has(.ls-icon-trash) { color: var(--lk-hue-red, #dc3e42) !important; }
${AREA} .table-action-bar .ui__button .ui__icon { color: inherit !important; }
/* A group's name: a bold word at the rows' size with a gap above it, as a group is told everywhere; the column names stand once, at
   the top of the first group (tables.js marks the others). */
${AREA} .ls-foldable-title:not(:has(.ls-view-head)) .my-2 { font-size: 14px; font-weight: 600; color: var(--lk-text); margin-top: 18px; margin-bottom: 4px; }
${AREA} .ls-table[data-lk-nohead] .ls-table-header { display: none !important; }
${AREA} .ls-table[data-lk-nohead] .ls-table-rows > .relative { padding-top: 0 !important; }   /* the room Logseq keeps for the head it draws */
/* A tag's own table without its Tags column: tables.js says the column's place (data-lk-notags), these rules hide it in every row as it comes. */
${AREA} .ls-table[data-lk-notags="1"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(1), ${AREA} .ls-table[data-lk-notags="2"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(2), ${AREA} .ls-table[data-lk-notags="3"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(3), ${AREA} .ls-table[data-lk-notags="4"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(4), ${AREA} .ls-table[data-lk-notags="5"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(5), ${AREA} .ls-table[data-lk-notags="6"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(6), ${AREA} .ls-table[data-lk-notags="7"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(7), ${AREA} .ls-table[data-lk-notags="8"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(8), ${AREA} .ls-table[data-lk-notags="9"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(9), ${AREA} .ls-table[data-lk-notags="10"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(10), ${AREA} .ls-table[data-lk-notags="11"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(11), ${AREA} .ls-table[data-lk-notags="12"] :is(.ls-table-header, .ls-table-row) > .flex-row:not(.sticky-columns) > :nth-child(12) { display: none !important; }
/* The state line under the bar: what the table is cut by, each part a press that opens Logseq's own list for it. */
.lk-tstate { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 14px; min-height: 22px; padding: 2px 0 4px 0; margin-left: -4px; font-size: var(--lk-small); color: var(--lk-quiet); }`,
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
.cp__cmdk__modal .hints > .text-sm { visibility: hidden; }
/* The letters typed, where they stand in a match: semibold, as in Find, with no yellow behind them (the owner, 14 November 2026:
   "yellow is not that readable"). In the search window and in the lists that open while writing (# tags, [[ pages, / commands, a
   property's values), which are one list of Logseq's. */
.cp__cmdk__modal mark, #ui__ac mark { background: none !important; color: inherit !important; font-weight: 600 !important; padding: 0 !important; }`,
  calmMenus: `
/* Menus and panels (the owner, 8 November 2026: "look through the menus and panels and modernize them"). Logseq's menus,
   pop-ups and lists are drawn as the library's (lk-pop, lk-menu, lk-item in plugin.js), which since 22 November 2026 is the Mac's
   own (the owner, of three drawn directions: "try c", then "Yes, build C"): glass the page shows through, a 10-point corner, a
   hair-thin edge, the Mac's shadow; tight 13 px lines, the line you are on filled in the text colour, a hairline set in between
   groups, keys as the Mac's marks with no cap round them. */
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__popover-content, .ui__select-content, .ui__multi-select-content) { background: var(--lk-glass) !important; -webkit-backdrop-filter: var(--lk-glass-blur) !important; backdrop-filter: var(--lk-glass-blur) !important; color: var(--lk-text) !important; border: .5px solid var(--lk-line) !important; border-radius: 10px !important; box-shadow: var(--lk-float-shadow) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__select-content) { padding: 5px !important; }
:is(.ui__dropdown-menu-item, .ui__dropdown-menu-sub-trigger, .ui__select-item, .ui__context-menu-content [role=menuitem]) { font-weight: 400 !important; font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; padding: 3px 9px 4px !important; box-sizing: border-box !important; height: var(--lk-line-h) !important; min-height: 0 !important; border-radius: 6px !important; color: var(--lk-text) !important; gap: 8px !important; }
/* A line that opens a further menu stays on the soft ground while that menu is open, as Logseq has it. */
.ui__dropdown-menu-sub-trigger[data-open]:not([data-highlighted], :hover) { background: var(--lk-wash) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) :is(.ui__icon, i.ti) { font-size: 14px !important; width: 14px; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) svg.tabler-icon { width: 14px !important; height: 14px !important; stroke-width: 1.4 !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content) :is(.ui__icon, i.ti) { color: var(--lk-quiet) !important; }
/* The line you are on, under the pointer or the keyboard: filled in the text colour, everything on it in the page's. Never a ring. */
:is(.ui__dropdown-menu-item, .ui__dropdown-menu-sub-trigger, .ui__select-item, .ui__context-menu-content [role=menuitem]):is([data-highlighted], :hover) { ${LOOKS.lit} }
/* Nothing on the line you are on is reversed: its icon, key and check keep their own colours (24 November 2026). */
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__popover-content, .ui__select-content) :focus-visible { outline: none !important; box-shadow: none !important; }
:is(.ui__dropdown-menu-separator, .ui__context-menu-separator, .ui__dropdown-menu-content [role=separator], .ui__context-menu-content [role=separator]) { background: var(--lk-hair) !important; height: 1px !important; margin: 5px 9px !important; }
:is(.ui__dropdown-menu-label, .ui__context-menu-label) { font-weight: 400 !important; color: var(--lk-quiet) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) :is(.shui-shortcut-combo, .shui-shortcut-separate, .shui-shortcut-key) { background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; min-width: 0 !important; font: inherit !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-combo { gap: 1px !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-key { color: var(--lk-off) !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-separator { display: none !important; }
/* The marks are the Mac's: its sign for the Delete key, and a click named in small letters after its sign (⇧ click). Only the look: the words Logseq wrote stay in the page. */
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) .shui-shortcut-key { display: inline-flex !important; align-items: center; height: var(--lk-line-lead) !important; line-height: 18px !important; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key { color: transparent !important; position: relative; width: 16px; overflow: hidden; white-space: nowrap; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] > span:has(.shui-shortcut-key) { display: flex !important; align-items: center; }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem] :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key::after { content: "⌫"; position: absolute; inset: 0; text-align: right; color: var(--lk-off); }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [role=menuitem]:is([data-highlighted], :hover) :is([data-shortcut-binding="delete"], [data-shortcut-binding="backspace"]) kbd.shui-shortcut-key.shui-shortcut-key::after { color: var(--lk-paper); }
:is(.ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content) [data-shortcut-binding$="+click"] .shui-shortcut-key:last-child { text-transform: lowercase; margin-left: 3px; }
/* A list you pick from (a property's values, a tag): the menu's lines; its field is words over a hairline, not a slab; the value in
   force is the filled line. */
.ui__popover-content .cp__select { font-size: var(--lk-line-size) !important; }
.ui__popover-content .cp__select .input-wrap { background: transparent !important; padding: 4px 5px 0 !important; }
.ui__popover-content .cp__select-input { background: transparent !important; font-size: var(--lk-line-size) !important; padding: 4px 9px !important; border: 0 !important; box-shadow: inset 0 -1px 0 var(--lk-hair) !important; border-radius: 0 !important; }
.ui__popover-content .cp__select .menu-link-wrap { padding: 0 5px !important; }
.ui__popover-content .cp__select .menu-link { display: flex !important; padding: 3px 9px 4px !important; border-radius: 6px !important; }
.ui__popover-content .cp__select .menu-link, .ui__popover-content .cp__select .menu-link * { font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; }
.ui__popover-content .cp__select .menu-link svg { width: 14px !important; height: 14px !important; }
.ui__popover-content .cp__select .menu-link.chosen { ${LOOKS.lit} }
/* Logseq's ask (Are you sure…): the Mac's alert. Small, on the same glass, its icon above the question, the two answers one over
   the other at full width, the one that goes ahead filled in the text colour; the page behind dimmed a little, never blurred white. */
.ui__alert-dialog-content { width: 260px !important; max-width: 260px !important; padding: 18px 14px 14px !important; gap: 4px !important; text-align: center !important; background: var(--lk-glass) !important; -webkit-backdrop-filter: var(--lk-glass-blur) !important; backdrop-filter: var(--lk-glass-blur) !important; border: .5px solid var(--lk-line) !important; border-radius: 14px !important; box-shadow: var(--lk-float-shadow) !important; }
.ui__alert-dialog-header { text-align: center !important; }
.ui__alert-dialog-title { font-size: 13px !important; line-height: 18px !important; font-weight: 600 !important; }
.ui__alert-dialog-title > span { flex-direction: column !important; gap: 6px !important; }
.ui__alert-dialog-title .ui__icon svg { width: 30px !important; height: 30px !important; stroke-width: 1.2 !important; color: var(--lk-quiet) !important; }
.ui__alert-dialog-main-content, .ui__alert-dialog-main-content p { font-size: 12px !important; opacity: 1 !important; color: var(--lk-quiet) !important; }
.ui__alert-dialog-main-content p { margin: 0 0 8px !important; }
.ui__alert-dialog-footer { display: block !important; }
.ui__alert-dialog-footer > span:first-child:empty { display: none !important; }
.ui__alert-dialog-footer > span:last-child { display: flex !important; flex-direction: column-reverse !important; gap: 6px !important; width: 100% !important; }
.ui__alert-dialog-footer .ui__button { width: 100% !important; height: 28px !important; border-radius: 7px !important; border: 0 !important; font-size: 13px !important; font-weight: 500 !important; box-shadow: none !important; }
.ui__alert-dialog-footer .ui__button.as-outline { background: var(--lk-wash) !important; color: var(--lk-text) !important; }
.ui__alert-dialog-footer .ui__button.as-solid { background: var(--lk-text) !important; color: var(--lk-paper) !important; }
.ui__alert-dialog-overlay { background: rgba(0,0,0,.14) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
/* The ask before a page is deleted, in the Mac's words (askWords, below, names it): Delete “Mortgage”? / It goes to the Recycle. /
   Delete. Logseq's own words stay in the page, unseen; only what is drawn over them changes, so its Escape, Enter and buttons work as before. */
[data-lk-ask="delete-page"] .ui__alert-dialog-title > span[data-lk-words] { font-size: 0 !important; line-height: 0 !important; }
[data-lk-ask="delete-page"] .ui__alert-dialog-title > span[data-lk-words]::after { content: attr(data-lk-words); font-size: 13px; line-height: 18px; margin-top: -6px; overflow-wrap: anywhere; }
[data-lk-ask="delete-page"] .ui__alert-dialog-main-content p { font-size: 0 !important; }
[data-lk-ask="delete-page"] .ui__alert-dialog-main-content p::after { content: "It goes to the Recycle."; font-size: 12px; line-height: 16px; }
[data-lk-ask="delete-page"] .ui__alert-dialog-footer .ui__button.as-solid { font-size: 0 !important; gap: 0 !important; }
[data-lk-ask="delete-page"] .ui__alert-dialog-footer .ui__button.as-solid::after { content: "Delete"; font-size: 13px; }
/* A yes or no on a property: the Mac's switch, on in the text colour, off in the line grey. A tick stays for picking rows in a table. */
.property-value-inner .ui__checkbox { width: 28px !important; height: 16px !important; border: 0 !important; border-radius: 8px !important; background: var(--lk-line) !important; position: relative !important; box-shadow: none !important; }
.property-value-inner .ui__checkbox:is([data-checked], [aria-checked=true]) { background: var(--lk-text) !important; }
.property-value-inner .ui__checkbox > * { display: none !important; }
.property-value-inner .ui__checkbox::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--lk-paper); }
.property-value-inner .ui__checkbox:is([data-checked], [aria-checked=true])::after { left: 14px; }
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
/* On the filled line a coloured icon, and one the plugin draws, takes the page's colour like the words beside it. */
PARTS.calmMenus += `
`;
/* Width by kind (the owner, 8 November 2026: "certain things need to be wide like a table but others like outline can
   benefit from readable width"; "the readable width needs to be centered"). The page is one column at reading width,
   centred, so the title, the properties, Structure's lines, Threads' rows, the outline and the references share one left
   edge; a table, and Threads' two pages side by side, reach out to the window's width, centred on the same middle, wherever
   they stand under a bullet however deep (place(), below, measures where each stands). A tag's or a property's page, which
   holds the table of its nodes, keeps Logseq's own layout, everything on the left edge of the wide page (the owner: "tag or
   property pages should still have non-table elements on left side like default"). */
/* The lists that open on the line you are writing ([[ pages, # tags, / commands, (( nodes): as big as what they hold (the owner,
   24 November 2026: "the window that appears is much too massive"; measured that day at 512 by 288 round names 150 wide, pushed
   226 pt left of the caret by its own width, 5 pt from the window's edge, eight sizes on its way open). As wide as its widest
   name, eight lines at most and then it scrolls, the menu's tight line, the line you are on filled, there in one frame at one
   size, a few points clear of the line it hangs from. Every number is the library's (Door.LOOKS.line, lit, fit). */
const WRITING_LIST = '.ui__popover-content[data-editor-popup-ref]';
PARTS.calmMenus += `
${WRITING_LIST} { ${LOOKS.fit('7rem')} padding: 5px !important; font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; overflow: hidden !important; }
/* A list that holds no line yet shows nothing: Logseq draws the box a frame before its rows, and an empty box that then grows is a flash. */
${WRITING_LIST}:not(:has(.menu-link)) { visibility: hidden !important; }
/* The tag list keeps one width from its first frame: it is a tree you step in and out of, and the line you are on names its
   child tags at the right end, so a width that followed each step would move the names sideways (and Logseq, placing the list
   before its rows were in, set it past the window's edge for a frame). 300 pt holds its widest line. */
${WRITING_LIST}[data-editor-popup-ref="page-search-hashtag"] { width: 300px !important; min-width: 0 !important; max-width: calc(100vw - 16px) !important; }
${WRITING_LIST}[data-editor-popup-ref="page-search-hashtag"] #ui__ac-inner { min-width: 0 !important; }
${WRITING_LIST}[data-side="bottom"] { margin-top: 6px !important; }
${WRITING_LIST}[data-side="top"] { margin-bottom: 6px !important; }
${WRITING_LIST} #ui__ac-inner { max-height: calc(8 * var(--lk-line-h)) !important; }
/* A list of tags keeps the tree's steps (--st-pad, set by Ontology): set to one edge here, the list after # showed every tag flush left
   (the owner, 24 November 2026: "Why don't you use the tag hierarchy anytime a tag is chosen?"). */
${WRITING_LIST} .menu-link-wrap { padding: 0 0 0 var(--st-pad, 0px) !important; }
${WRITING_LIST} .menu-link { ${LOOKS.line} display: flex !important; align-items: center !important; white-space: nowrap !important; }
${WRITING_LIST} .menu-link, ${WRITING_LIST} .menu-link * { font-size: var(--lk-line-size) !important; line-height: var(--lk-line-lead) !important; }
${WRITING_LIST} .menu-link .flex-1, ${WRITING_LIST} .menu-link .flex-1 > .flex-col { min-width: 0 !important; overflow: hidden !important; }
${WRITING_LIST} .menu-link .flex-row { align-items: center !important; min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
${WRITING_LIST} .menu-link .flex-row > .h-5 { height: var(--lk-line-lead) !important; flex: none !important; }
${WRITING_LIST} .menu-link .flex-row > :not(.h-5) { min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
${WRITING_LIST} .menu-link svg { width: 14px !important; height: 14px !important; }
${WRITING_LIST} .menu-link.chosen { ${LOOKS.lit} }
`;
/* Making or picking a property (Logseq's list under "+ Add property", then the new name, its type, its tag): as big as what it
   holds (the owner's five pictures, 24 November 2026). Logseq gives the list one height, 286 pt, whatever it holds, so the box
   for a new name stood 235 by 286 round one line; the list of tags ran 42 lines down the window. Now eight lines at most, and
   under its line the box is as high as its lines. Above its line it keeps one height, so the field you type in does not move
   as the list shortens. Its lines are the menu's (the library's line). A list of tags keeps the tree's steps (--st-pad, set by
   Ontology): the rule above had set every line to one edge. */
PARTS.calmMenus += `
.ui__popover-content[data-side="bottom"] .ls-property-dialog .ls-property-key { height: auto !important; }
.ui__popover-content:not([data-side="bottom"]) .ls-property-dialog .ls-property-key { height: min(calc(8 * var(--lk-line-h) + 46px), calc(var(--available-height, 100vh) - 12px)) !important; }
/* Whole lines only (seen in the hand test, 24 November 2026: "Choose tag" cut its seventh line in half in a short window).
   Eight lines, or as many as the window has room for under (or over) the words it hangs from: Logseq says how much that is
   (--available-height), and the list keeps 8 pt clear of the window's edge (at 28 a line, eight lines ran past the foot of a 560 pt window). */
.ls-property-dialog .cp__select-main > :not(.input-wrap) { max-height: min(calc(8 * var(--lk-line-h) + 4px), calc(round(down, var(--available-height, 100vh) - 56px, var(--lk-line-h)) + 4px)) !important; overflow-y: auto !important; }
.ui__popover-content .cp__select .menu-link { box-sizing: border-box !important; min-height: var(--lk-line-h) !important; align-items: center !important; }
.ui__popover-content .cp__select .menu-link .pt-1 { padding-top: 0 !important; display: inline-flex !important; align-items: center !important; }
.ui__popover-content .cp__select #ui__ac-inner > .menu-link-wrap { padding-left: calc(5px + var(--st-pad, 0px)) !important; }
/* Hung from "+ Add property", every step of it (the list, the new name with its type, "Choose tag"): the left edge on the
   words' own (Logseq sets it a few points to their left), 6 pt clear of them, as the lists on a line being written are, so the
   corner stays through the steps. Logseq keeps the box 224 pt wide round a list 202 wide; the box is as wide as its list. */
.ui__popover-content:has(.ls-property-dialog) { margin-left: 4.5px !important; }
.ui__popover-content[data-side="bottom"]:has(.ls-property-dialog) { margin-top: 6px !important; }
.ui__popover-content[data-side="top"]:has(.ls-property-dialog) { margin-bottom: 6px !important; }
.ls-property-dialog .ls-property-input:has(.cp__select-main) { min-width: 0 !important; }
.ls-property-dialog .ls-property-input:has(.cp__select-main) > .ls-property-add { min-width: 11rem !important; }
/* One size from the first frame. Logseq draws the field a frame or three before its lines, so the box grew after it was there;
   and the tags of "Choose tag" come a frame after "Skip choosing tag". While no line is in, and for "Choose tag" before a letter
   is typed, the list has the height of its eight lines already (there are always more than eight to come). */
.ls-property-dialog .cp__select-main:not(:has(.menu-link)) > :not(.input-wrap),
.ls-property-dialog .cp__select-main:has(input[placeholder="Choose tag"]:placeholder-shown) > :not(.input-wrap) { min-height: min(calc(8 * var(--lk-line-h) + 4px), calc(round(down, var(--available-height, 100vh) - 56px, var(--lk-line-h)) + 4px)) !important; }
/* Whatever floats is there at once, at its one size, as the Mac's menus are (measured 24 November 2026: Logseq's lists took four
   to eight sizes on their way open and went on changing for a tenth of a second). */
:is(.ui__popover-content, .ui__dropdown-menu-content, .ui__dropdown-menu-sub-content, .ui__context-menu-content, .ui__context-menu-sub-content, .ui__select-content) { ${LOOKS.atOnce} }
`;
const WIDTHS = { Narrow: '44rem', Medium: '52rem', Wide: '60rem' };
const reading = () => WIDTHS[setting('readingWidth')] || null;
const widthCss = col => `
#main-content-container .cp__sidebar-main-content { max-width: ${col} !important; }
#main-content-container .cp__sidebar-main-content:has(.page-tabs) { max-width: min(1440px, 100%) !important; }
/* Logseq's wide mode (t w) wins over the reading width (the owner, 15 November 2026, of the Ontology page: "it doesn't seem
   responsive to wide mode"): Logseq's own wide width, 1440 px, on every page, as in Logseq without the plugin. */
.ls-wide-mode #main-content-container .cp__sidebar-main-content { max-width: var(--ls-main-content-max-width-wide, 1440px) !important; }
#main-content-container [data-lk-wide] { width: var(--lk-w) !important; max-width: none !important; margin-left: var(--lk-out) !important; }
#main-content-container :is(.ls-foldable-content-inner, .ls-page-blocks):has([data-lk-wide]) { overflow: visible !important; }`;
/* What reaches out to the window's width: each one's left edge is measured and moved so it spans the page's middle
   (up to 1440 px, 48 px from each side), whatever indent it stands at. Run before the screen is drawn, so nothing jumps. */
const WIDE = '#main-content-container .ls-page-blocks .ls-table';
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
/* The Mac's own scroll bars. Any ::-webkit-scrollbar rule that reaches a scroller makes Chromium draw that bar itself, not the
   system's, and a later rule cannot undo it: Logseq 2.0.2 has #main-content-container::-webkit-scrollbar (a 16 px strip whose
   handle never shows). So each of Logseq's rules that reaches the main page or the right sidebar is made to match nothing
   (:not(*) before the part that reaches it) while the plugin runs, and given back as it was when the plugin stops. Checked on every pass of the screen, so a scroller Logseq draws later, or a stylesheet it loads again,
   is caught. */
const SCROLLERS = '#main-content-container, #right-sidebar .sidebar-item-list, #right-sidebar .cp__right-sidebar-scrollable';
const OFF = ':not(*)';
const setAside = new Map();   // Logseq's rule → its selector as Logseq wrote it
const seen = new WeakSet(), barRules = [];
const parts = list => { const out = []; let depth = 0, from = 0; for (let i = 0; i < list.length; i++) { const c = list[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === ',' && !depth) { out.push(list.slice(from, i)); from = i + 1; } } return [...out, list.slice(from)].map(p => p.trim()); };
// The element a part of a selector styles the bar of: the part with its ::-webkit-scrollbar… taken off ("" or a trailing space
// means any element, as in ".visible-scrollbar ::-webkit-scrollbar").
const owner = part => { const base = part.replace(/::-webkit-scrollbar[\s\S]*$/, ''); return !base.trim() ? '*' : /\s$/.test(base) ? base + '*' : base; };
function collect(rules) { for (const rule of rules) { if (rule.cssRules?.length && !rule.selectorText) collect(rule.cssRules); else if (rule.selectorText?.includes('::-webkit-scrollbar')) barRules.push(rule); } }
function macBars(doc) {
  if (!setting('calmToolbar')) return giveBack();
  for (const sheet of doc.styleSheets) {
    if (seen.has(sheet) || sheet.ownerNode?.hasAttribute?.('data-injected-style')) continue;   // the plugin's own sheets draw no bar now
    seen.add(sheet);
    try { collect(sheet.cssRules); } catch (error) { /* a sheet from elsewhere, not readable */ }
  }
  const scrollers = [...doc.querySelectorAll(SCROLLERS)];
  if (!scrollers.length) return;
  for (const rule of barRules) {
    if (setAside.has(rule) || !rule.parentStyleSheet) continue;
    const list = parts(rule.selectorText);
    const reaches = part => scrollers.some(el => { try { return el.matches(owner(part)); } catch (error) { return false; } });
    if (!list.some(reaches)) continue;
    const was = rule.selectorText;
    rule.selectorText = list.map(part => reaches(part) ? OFF + part : part).join(', ');
    if (rule.selectorText !== was) setAside.set(rule, was);
  }
}
function giveBack() { for (const [rule, was] of setAside) rule.selectorText = was; setAside.clear(); }

/* Logseq's ask before a page is deleted says "Are you sure you want to delete this page?", the page's name on a line under it, and
   Confirm. The Mac asks with the name in the question and names the answer by what it does. The ask is named here when it is that
   one ask about one page, in English, and the stylesheet (calmMenus) draws the Mac's words over Logseq's; any other ask keeps
   Logseq's words. Only attributes are set: nothing Logseq wrote is changed, so its dialog behaves as it did. */
const DELETE_PAGE = 'Are you sure you want to delete this page?';
function askWords(doc) {
  for (const box of doc.querySelectorAll('.ui__alert-dialog-content')) {
    const title = box.querySelector('.ui__alert-dialog-title > span'), lines = box.querySelectorAll('.ui__alert-dialog-main-content p'), yes = box.querySelector('.ui__alert-dialog-footer .ui__button.as-solid');
    const name = lines.length === 1 ? (lines[0].textContent.match(/^- (.+)$/) || [])[1] : null;
    const is = setting('calmMenus') && title && title.textContent.trim() === DELETE_PAGE && name && yes && yes.textContent.trim() === 'Confirm';
    const words = is ? `Delete “${name}”?` : null;
    if (!is) { if (box.hasAttribute('data-lk-ask')) { box.removeAttribute('data-lk-ask'); title?.removeAttribute('data-lk-words'); } continue; }
    if (box.getAttribute('data-lk-ask') !== 'delete-page') box.setAttribute('data-lk-ask', 'delete-page');
    if (title.getAttribute('data-lk-words') !== words) title.setAttribute('data-lk-words', words);
  }
}

let watching = false;
function apply() {
  for (const [key, css] of Object.entries(PARTS)) style(key, setting(key) ? css : '');
  style('readingWidth', reading() ? widthCss(reading()) : '');
  const doc = Look.kit.host();
  if (!watching) { watching = true; Look.kit.watchScreen(doc => { place(doc); macBars(doc); askWords(doc); }, place); Look.kit.listen(doc.defaultView, 'resize', () => place(doc)); }
  place(doc);
  macBars(doc);
}
function stop() { watching = false; giveBack(); }   // the pass and the listener go with Look's base; Logseq's scroll bar rules go back
Look.calm = { apply, stop, macBars, setAside };
})();
