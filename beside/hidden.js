/* BESIDE: hidden menu lines. A right-click on a line of one of Logseq's menus (a bullet's or a page's right-click menu, a ···
   menu, the / menu) offers one thing, Hide: the line is left out from then on, and Plugin settings brings it back (the owner,
   26 November 2026: "bring back ... a hide menu items"; they chose the right-click). Only the screen changes: nothing in the
   notes, no setting of Logseq's, and a hidden line's key still works. */
(function () {
const G = window.PluginDoor, H = G.hidden;
const KEY = 'hiddenItems';
G.part({
  key: 'hidden', title: 'Hidden menu items', about: 'Right-click a line in one of Logseq’s menus and choose Hide. Plugin settings brings it back.',
  start(base) {
    const kept = () => H.list(G.setting(KEY));
    const lines = G.touch.menuLines(base, (where, name) => H.has(kept(), where, name), (at, where, name) => {
      G.menu(at, [{ word: 'Hide', take: () => { Promise.resolve(G.touch.keep({ [KEY]: H.add(G.setting(KEY), where, name) })).then(() => lines.again()); lines.again(); G.say(`“${name}” is hidden. Plugin settings brings it back.`); } }]);
    });
    G.hiding = { again: () => lines.again() };
    base.onStop(() => { G.hiding = null; });
  },
});
})();
