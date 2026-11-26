/* PAGE: Relations. On every page Logseq shows (the main page, a page in the sidebar), the lists of what points at the page
   stand under the page's own bullets, and Logseq's own Linked references and two-way tabs, which say the same less plainly,
   are taken away there. A day in the journals feed is left as Logseq draws it. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'relations', title: 'Relations', about: 'Under a page: every node that points at it, one list for each property, and where it is mentioned. Any row opens in place.',
  start(base) {
    base.style('hides', G.touch.HIDES + `
${G.touch.PAGE} > .lk-rel { margin: 8px 0 32px; }
${G.touch.PAGE} > .lk-rel:not(:empty)::before { content: "Relations"; color: var(--lk-quiet); font-size: var(--lk-line-size); line-height: 24px; margin-bottom: -4px; background: linear-gradient(var(--lk-hair), var(--lk-hair)) no-repeat 82px 55% / calc(100% - 82px) 1px; }`);   /* the lists stand under their own quiet word and a hairline, as before 0.9 (the owner, 25 November 2026) */
    const offs = new Map();   // the plugin's element on a page -> what takes its lists away
    const pass = () => {
      for (const [foot, off] of offs) if (!foot.isConnected) { off(); offs.delete(foot); }
      for (const page of G.touch.pages()) {
        if (page.feed) continue;
        const foot = G.touch.pageFoot(page.el, 'lk-rel');
        if (foot.dataset.uuid === page.uuid) continue;
        offs.get(foot)?.();
        foot.dataset.uuid = page.uuid;
        offs.set(foot, G.node.lists(foot, page.uuid));
      }
    };
    base.onStop(G.touch.watch(pass));
    base.onStop(() => { for (const [foot, off] of offs) { off(); foot.remove(); } offs.clear(); });
  },
});
})();
