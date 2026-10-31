/* The right sidebar, on the grammar. Logseq 2.0.2 paints the bar on top of it (.cp__right-sidebar-topbar) with
   --ls-right-sidebar-topbar-color, then --lx-gray-02, then --ls-secondary-background-color, and when the theme sets none, a
   fixed blue grey (rgb(216, 225, 232), measured); its views (Contents, Page graph, Help, and with developer mode on
   "(Dev) RTC", "(Dev) Undo/Redo", "(Dev) Profiler") are buttons in a row; each item is a card (.sidebar-item.color-level
   .rounded-md.shadow-lg, its header .color-level.rounded-t-md). Here: the bar takes the page's own ground with a hairline
   under it, the views are quiet words in the text colour, the developer views are left out (marked by a screen pass,
   since a stylesheet cannot read their words), and the items lie flat on the sidebar, no card, shadow or rounded corner,
   with a line between one and the next. Two switches. The old plugin's sidebar part drew the same (0.4.419, 0.4.420, the
   owner: "flattened design of sidebar, removing shadows and adding lines"; "where is this blue coming from?"). */
(function () {
const Look = window.Look;
const { style, watchScreen } = Look.kit;
const setting = key => Look.settings.setting(key);

const barCss = `
#right-sidebar .cp__right-sidebar-topbar { background-color: var(--ls-primary-background-color, Canvas) !important; box-shadow: 0 1px 0 var(--lk-hair); }
#right-sidebar .cp__right-sidebar-settings-btn { color: inherit !important; opacity: .7; background: none !important; border: 0 !important; box-shadow: none !important; }
#right-sidebar .cp__right-sidebar-settings-btn:hover, #right-sidebar .cp__right-sidebar-settings-btn:focus-visible { opacity: 1; }
#right-sidebar .cp__right-sidebar-settings > div[data-lk-dev] { display: none !important; }`;
const flatCss = `
#right-sidebar .sidebar-item-list > .sidebar-item, #right-sidebar .sidebar-item-list > .sidebar-item .sidebar-item-header { box-shadow: none !important; background: transparent !important; border-radius: 0 !important; }
#right-sidebar .sidebar-item-list > .sidebar-item ~ .sidebar-item { border-top: 1px solid var(--lk-line) !important; margin-top: 10px; padding-top: 6px; }`;

// The developer views are told by their words; the mark is swept with the plugin's attributes.
function markDevViews(doc) {
  const on = setting('sidebarBar');
  for (const box of doc.querySelectorAll('#right-sidebar .cp__right-sidebar-settings > div')) {
    const dev = on && /^\(Dev\)/.test(box.textContent.trim());
    if (dev) { if (!box.hasAttribute('data-lk-dev')) box.setAttribute('data-lk-dev', ''); }
    else if (box.hasAttribute('data-lk-dev')) box.removeAttribute('data-lk-dev');
  }
}
function apply() {
  style('sidebar-bar', setting('sidebarBar') ? barCss : '');
  style('sidebar-flat', setting('sidebarFlat') ? flatCss : '');
}
function start() { apply(); watchScreen(markDevViews); }
function stop() { style('sidebar-bar', ''); style('sidebar-flat', ''); }
Look.sidebar = { apply, start, stop, markDevViews };
})();
