/* BESIDE: Logseq's own screens, quieted. The top bar, a page's title, "Add property", a bullet's line of properties, the right
   sidebar's top row and Logseq's tables, each as the plugin drew them before 0.9 (the owner chose each, 25 November 2026).
   Only stylesheets, written in the ground (touch.CALM); nothing is read from the graph and nothing is added to the page. */
(function () {
const G = window.PluginDoor;
const SAID = { bar: 'The top bar: fewer buttons', title: 'A page’s title: a step smaller', add: '“Add property” as quiet words', pills: 'A bullet’s properties as one quiet line', side: 'The right sidebar without Logseq’s top row', table: 'Logseq’s tables, quieter' };
G.part({
  key: 'calm', title: 'Logseq, quieted', about: 'Logseq’s own top bar, titles, properties and tables drawn more quietly.',
  settings: Object.entries(SAID).map(([key, title]) => ({ key: 'calm-' + key, type: 'boolean', default: true, title, description: '' })),
  start(base) {
    for (const key of Object.keys(SAID)) if (G.setting('calm-' + key) !== false) base.style('calm-' + key, G.touch.CALM[key]);
    if (G.setting('calm-table') === false) return;
    // A tag's own table says the tag on every row: its Tags column is left out.
    let tagUuids = new Set(), asked = false;
    const learn = async () => { tagUuids = new Set([...(await G.read.tags()).values()].map(tag => tag.uuid)); asked = true; };
    learn();
    base.onStop(G.touch.changed(learn));
    base.onStop(G.touch.watch(() => { if (asked) for (const page of G.touch.pages()) G.touch.lessColumn(page.el, tagUuids.has(page.uuid) ? 'Tags' : ''); }));
  },
});
})();
