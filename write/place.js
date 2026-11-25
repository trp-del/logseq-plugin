/* WRITING: a new tag asks where it goes. A tag made while you write (Logseq's "New tag …" in its list on "#") stands at the top,
   under nothing. Right under your line a list of your tags opens, as an outline: an arrow and Enter put the new tag under one
   of them; Escape, or simply writing on, leaves it at the top. The keys never leave your bullet, and Logseq's own Undo takes the
   placing back. A tag made anywhere else (a tag's page, Ontology) is not asked about: there you are already placing it. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'placing', title: 'A new tag asks where it goes', about: 'A tag made while writing: a list of your tags opens under the line to put it under one.',
  start(base) {
    let known = null, turn = 0, close = null;
    const ask = async id => {
      const box = G.touch.writing();
      if (!box) return;
      G.read.forget();
      const tags = await G.read.tags(), made = tags.get(id);
      if (!made || G.touch.writing() !== box) return;
      const others = new Map([...tags].filter(([one]) => one !== id));
      if (!others.size) return;
      close = G.menu(box, [{ group: `${made.title} is a new tag. Put it under:` }, ...G.find.tree(others).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag',
        take: () => G.write.placeTag(made.uuid, tag.uuid).then(() => G.say(`${made.title} is now under ${tag.title}`)).catch(error => G.say(`${made.title} could not be put under ${tag.title}: ${error?.message || 'Logseq refused'}`, 'warning')) }))], { quiet: true });
    };
    const look = async () => {
      const mine = ++turn, ids = await G.read.tagIds();
      if (mine !== turn) return;
      const fresh = known ? [...ids].filter(id => !known.has(id)) : [];
      known = ids;
      if (fresh.length === 1) ask(fresh[0]).catch(error => console.error('Logseq Plugin: the new tag could not be asked about', error));
    };
    look().catch(() => {});
    base.onStop(G.touch.changed(() => look().catch(() => {}), true));
    base.onStop(() => { turn++; close?.(false); });
  },
});
})();
