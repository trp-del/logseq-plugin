/* WRITING: where a tag sits. In Logseq's own list of tags, the one that opens when you type "#", each of your tags is followed
   by the tags it sits under, up to the top, so two tags with like names are told apart before one is taken. The list, its
   order, its keys and what Enter does stay Logseq's. A name two of your tags share is given no path: it could be either. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'where', title: 'Where a tag sits', about: 'In Logseq’s list of tags: each tag followed by the tags it sits under.',
  start(base) {
    let paths = new Map();
    const read = async () => {
      const tags = await G.read.tags(), next = new Map(), twice = new Set();
      for (const tag of tags.values()) {
        const name = tag.title.trim().toLowerCase();
        if (next.has(name)) twice.add(name);
        next.set(name, G.tags.path(tag.id, tags).slice(1).map(one => one.title).join(' / '));
      }
      for (const name of twice) next.delete(name);
      paths = next;
    };
    read().catch(error => console.error('Logseq Plugin: the tags could not be read', error));
    base.onStop(G.touch.changed(() => read().catch(() => {})));
    base.style('where', '.lk-where { margin-left: .7em; font-family: var(--lk-tag-face); font-size: var(--lk-small); color: var(--lk-quiet); white-space: nowrap; }');
    base.onStop(G.touch.tagList(name => paths.get(name.toLowerCase()) || ''));
  },
});
})();
