/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties by name, in a section of
   the right sidebar. A tag and a property are nodes like any other, so each row is the one line (node/line.js) and opens in
   place as Logseq's own page for it: its name is renamed there, the tag it sits under is changed there (Extends), a property's
   kind and what it takes are set there, all with Logseq's own controls and Logseq's own Undo. Nothing here writes. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags as an outline and your properties, in the right sidebar. Any of them opens in place to be renamed, moved or changed.',
  start(base) {
    base.style('ontology', '.lk-ontology { padding: 4px 4px 16px 22px; }');
    const section = G.touch.section('lk-ontology', 'Ontology', holder => {
      holder.classList.add('lk-ontology', 'lk-rel');
      const plain = node => ({ ...node, tag: '', tagShown: false, dayShown: 0, day: 0 });
      const list = G.node.listing(holder, async () => {
        const tree = G.find.tree(await G.read.tags()), props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
        const [tagNodes, propNodes] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.byUuids(props.map(prop => prop.uuid))]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth]));
        return [{ key: 'ontology:tags', kind: 'group', name: 'Tags', tag: '', face: 'tag', rows: tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0 })) },
          { key: 'ontology:properties', kind: 'group', name: 'Properties', tag: '', face: 'prop', rows: propNodes.map(plain) }].filter(one => one.rows.length);
      }, { few: 2000, none: 'No tags or properties of your own yet' });
      return () => list.off();
    }, TREE);
    base.onStop(section.off);
    G.touch.command('lk-ontology', 'Ontology', section.open);
    G.touch.toolbar('lk-ontology', 'Ontology', TREE, section.open);
  },
});
})();
