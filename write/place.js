/* WRITING: what you make while writing asks where it belongs. Both asks are one list, right at your line, of your tags as an
   outline: Down or Up lights a tag and Enter takes it; Escape, or simply writing on, is the answer no. The keys never leave
   your bullet, and Logseq's own Undo takes the answer back.
     A new tag (Logseq's "New tag …" in its list on "#") stands at the top, under nothing: the list puts it under a tag.
     A new page (Logseq's "New page …" in its list on "[[") is of no kind: the list gives it its tag, so the link you just made
     is at once a doctor, a place, a bill, and the bullet's sure values can use it when you leave the bullet.
   Something made anywhere else (a tag's page, Ontology, the page list) is not asked about. */
(function () {
const G = window.PluginDoor;
let close = null;
// The one list both asks open. take(tag) writes; done says what was written, failed what could not be.
async function offer(box, head, skip, take, done, failed) {
  G.read.forget();
  const tags = new Map([...(await G.read.tags())].filter(([id]) => id !== skip));
  if (!tags.size || G.touch.writing() !== box) return;
  close = G.menu(box, [{ group: head }, ...G.tags.tree(tags).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag',
    take: () => take(tag).then(() => G.say(done(tag))).catch(error => G.say(`${failed(tag)}: ${error?.message || 'Logseq refused'}`, 'warning')) }))], { quiet: true });
}
const fail = error => console.error('Logseq Plugin: what was just made could not be asked about', error);
// One look at a time, in the order the changes came. A look never steps aside for a newer one, so what it found is never lost.
const inTurn = () => { let last = Promise.resolve(); return work => (last = last.then(work).catch(fail)); };
const HASH = /#\S/;   // a tag being typed
G.part({
  key: 'placing', title: 'A new tag asks where it goes', about: 'A tag made while writing: a list of your tags opens at the line to put it under one.',
  start(base) {
    let known = null, hash = false, alive = true;   // hash: a # stood in the bullet being written since the tags were last read
    const turn = inTurn();
    /* This runs at every change, so a save of plain words reads nothing. A tag is made while writing by a # in the bullet's
       words: the tags are read once when a # first stands in the box, to know them as they were, and then at each change until
       the box holds no # any more (Logseq takes the typed name out of the box just before it makes the tag). */
    const look = async () => {
      if (!alive || !hash) return;
      hash = HASH.test(G.touch.writing()?.value || '');
      const ids = await G.read.tagIds(), fresh = known ? [...ids].filter(id => !known.has(id)) : [];
      known = ids;
      const box = G.touch.writing();
      if (!alive || fresh.length !== 1 || !box) return;
      G.read.forget();
      const made = (await G.read.tags()).get(fresh[0]);
      if (made) await offer(box, `${made.title} is a new tag. Put it under:`, made.id, tag => G.write.placeTag(made.uuid, tag.uuid), tag => `${made.title} is now under ${tag.title}`, tag => `${made.title} could not be put under ${tag.title}`);
    };
    base.listen(G.host(), 'input', () => { if (hash || !HASH.test(G.touch.writing()?.value || '')) return; hash = true; turn(async () => { known = await G.read.tagIds(); }); }, true);
    base.onStop(G.touch.changed(() => turn(look), true));
    base.onStop(() => { alive = false; close?.(false); });
  },
});
G.part({
  key: 'kind', title: 'A new page asks what it is', about: 'A page made while writing: a list of your tags opens at the line to say what kind of thing it is.',
  start(base) {
    let since = Date.now(), alive = true, at = { box: null, names: new Set() };   // at: the box being written in, and the names it links that are settled
    const asked = new Set(), known = new Set(), turn = inTurn();   // known: the pages a reading has already been made for
    /* This runs at every save, so a save of plain words asks the graph nothing. A page made while writing is one the bullet's
       words link, so only a name the box links and that is not settled yet is looked up, by that name alone; and only when a
       page of that name stands which no reading was made for are the new pages read. */
    const look = async () => {
      const box = alive ? G.touch.writing() : null;
      if (!alive) return;
      if (!box) { since = Date.now(); return; }   // only what is made while a bullet is being written
      if (at.box !== box) at = { box, names: new Set() };
      const open = G.sure.links(box.value).filter(name => !at.names.has(name));
      if (!open.length) return;
      const found = await Promise.all(open.map(name => G.read.pageNamed(name)));
      let unread = false;
      open.forEach((name, i) => { if (!found[i]) return; at.names.add(name); if (!known.has(found[i].uuid)) { known.add(found[i].uuid); unread = true; } });
      if (!unread || !alive) return;   // a name still being typed, or a page already read for
      const pages = (await G.read.newPages(since - 1000)).filter(page => !asked.has(page.id));
      for (const page of pages) asked.add(page.id);   // each is asked about once, or not at all when several came at once
      if (!alive || pages.length !== 1 || G.touch.writing() !== box) return;
      const made = pages[0];
      await offer(box, `${made.title} is a new page. What is it?`, 0, tag => G.write.tag(made.uuid, tag.uuid), tag => `${made.title} is tagged ${tag.title}`, tag => `${made.title} could not be tagged ${tag.title}`);
    };
    base.onStop(G.touch.changed(() => turn(look), true));
    base.onStop(() => { alive = false; close?.(false); });
  },
});
})();
