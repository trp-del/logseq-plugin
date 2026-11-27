/* PAGE: a page's place. At the right end of a page's title on the main page, and under the title elsewhere, each of its tags with the tags it sits under, up to the top: what the page
   is, and where that stands among the kinds of things. Each name opens its tag. Logseq's own tag at the title's right, which
   says only the first step, is taken away where the path stands. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'place', title: 'A page’s place', about: 'At the right end of a page’s title, and under the title in the sidebar: its tags, each with the tags it sits under.',
  start(base) {
    base.style('place', G.touch.HIDES_TAGS + `
/* One line that never wraps and gives way with an ellipsis, wherever it stands: at the title's end, under a title, in the sidebar. */
.lk-place { font-family: var(--lk-tag-face); color: var(--lk-quiet); font-size: var(--lk-words-size); font-weight: 400; line-height: 24px; margin: 2px 0 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lk-place:empty { display: none; }
/* A tag's own page: above its title, the tag it stands under, pressed to put it under another (before 0.9). */
.lk-parent { display: flex; align-items: baseline; gap: 10px; margin: 0 0 2px; font-family: var(--ls-font-family, inherit); font-size: var(--lk-small); font-weight: 400; line-height: 20px; letter-spacing: normal; }
.lk-parent > b { font-weight: 600; }
.lk-parent > button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 0 4px; margin-left: -4px; border-radius: var(--lk-corner); color: var(--lk-text); font: inherit; font-family: var(--lk-tag-face); font-size: var(--lk-tag-size); cursor: pointer; }
.lk-parent > button:hover, .lk-parent > button:focus-visible { background: var(--lk-wash); outline: none; }
.lk-parent > button::after { content: ""; width: 5px; height: 5px; margin: -3px 2px 0 2px; border: solid var(--lk-quiet); border-width: 0 1.2px 1.2px 0; transform: rotate(45deg); }
/* At the right end of the title's line on the main page. */
.lk-place.lk-place-end { margin: 4px 0; padding-left: 0; max-width: min(24em, 100%); font-size: var(--lk-words-size); line-height: 24px; letter-spacing: normal; }
.lk-place a { color: inherit; cursor: pointer; }
.lk-place a:hover { color: var(--lk-text); }
.lk-place .lk-up { color: var(--lk-off); margin: 0 .4em; }
.lk-place .lk-path + .lk-path::before { content: ""; display: inline-block; width: 1.4em; }`);
    let turn = 0;
    const draw = async (head, uuid) => {
      const mine = ++turn;
      const node = await G.read.node(uuid);
      const [all, own] = node ? await Promise.all([G.read.tags(), G.read.tagsOf(node.id)]) : [new Map(), []];
      if (!head.isConnected || head.dataset.uuid !== uuid) return;
      const html = own.filter(id => all.has(id)).map(id => ({ id, path: G.tags.path(id, all) })).sort((a, b) => a.path[0].title.localeCompare(b.path[0].title))
        .map(({ id, path }) => `<span class="lk-path" data-tag="${id}">${path.map(tag => `<a data-to="${G.esc(tag.uuid)}">${G.esc(tag.title)}</a>`).join('<span class="lk-up">/</span>')}</span>`).join('');
      if (head.lkHtml !== html) { head.innerHTML = html; head.lkHtml = html; }
      void mine;
    };
    // A tag's page says its parent above the title; a press lists the tags it may go under.
    const parentOf = async (line, uuid) => {
      const all = await G.read.tags(), tag = [...all.values()].find(one => one.uuid === uuid);
      if (!line.isConnected || line.dataset.uuid !== uuid) return;
      line.hidden = !tag;
      if (!tag) return;
      const names = tag.parents.map(id => all.get(id)?.title).filter(Boolean).sort().join(', ') || 'None';
      const html = `<b>Parent</b><button type="button">${G.esc(names)}</button>`;
      if (line.lkHtml !== html) { line.innerHTML = html; line.lkHtml = html; }
    };
    const putUnder = async line => {
      const uuid = line.dataset.uuid, all = await G.read.tags(), tag = [...all.values()].find(one => one.uuid === uuid);
      if (!tag) return;
      const from = tag.parents.map(id => all.get(id)?.uuid).filter(Boolean);
      const move = async to => { try { G.undo.mark(uuid, await G.write.moveTag(uuid, to, from)); } catch (error) { G.say(`The tag could not be moved: ${error?.message || 'Logseq refused'}`, 'warning'); } };
      const may = G.tags.tree(all).filter(({ tag: one }) => !G.tags.above(one.id, all).has(tag.id));   // not itself, nor a tag under it
      G.menu(line.lastElementChild, [{ word: 'None (at the top)', on: !from.length, take: () => move('') }, { gap: true },
        ...may.map(({ tag: one, depth }) => ({ word: one.title, face: 'tag', depth, on: tag.parents.includes(one.id), take: () => move(one.uuid) }))]);
    };
    // A right-click on a path changes that tag of the page: the one chosen takes its place, with one Undo.
    const change = async (event, uuid, id) => {
      const node = await G.read.node(uuid);
      if (!node) return;
      const [all, own] = await Promise.all([G.read.tags(), G.read.tagsOf(node.id)]), was = all.get(id);
      if (!was) return;
      const swap = async to => {
        let steps = 0;
        try {
          if (!own.includes(to.id)) { await G.write.tag(uuid, to.uuid); steps++; }
          await G.write.untag(uuid, was.uuid); steps++;
        } catch (error) { G.say(`The tag could not be changed: ${error?.message || 'Logseq refused'}`, 'warning'); }
        if (steps) G.undo.mark(uuid, steps);
      };
      G.menu(event, G.tags.tree(all).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: tag.id === id, take: () => { if (tag.id !== id) swap(tag); } })), { find: 'Change tag' });
    };
    const heads = new Set();
    const pass = () => {
      for (const head of heads) if (!head.isConnected) heads.delete(head);
      for (const page of G.touch.pages()) {
        if (page.feed) continue;
        const line = G.touch.pageHead(page.el, 'lk-parent', true);
        if (line && line.dataset.uuid !== page.uuid) {
          line.dataset.uuid = page.uuid; line.hidden = true; heads.add(line);
          if (!line.lkWired) { line.lkWired = true; for (const type of ['mousedown', 'pointerdown']) line.addEventListener(type, event => event.stopPropagation()); line.addEventListener('click', event => { if (event.target.closest('button')) { event.stopPropagation(); putUnder(line); } }); }
          parentOf(line, page.uuid);
        }
        const end = G.touch.titleEnd(page.el, 'lk-place'), head = end || G.touch.pageHead(page.el, 'lk-place');
        if (end) { end.classList.add('lk-place-end'); const under = G.touch.pageHead(page.el, 'lk-place'); if (under && under !== end) { heads.delete(under); under.remove(); } }
        if (!head || head.dataset.uuid === page.uuid) continue;
        head.dataset.uuid = page.uuid; heads.add(head);
        if (!head.lkWired) {
          head.lkWired = true;
          head.addEventListener('click', event => { const a = event.target.closest('a[data-to]'); if (a) G.touch.open(a.dataset.to, event.shiftKey); });
          // The press is the path's own: Logseq's menu for the title does not open under it.
          for (const type of ['mousedown', 'pointerdown']) head.addEventListener(type, event => { if (event.button === 2) event.stopPropagation(); });
          head.addEventListener('contextmenu', event => {
            const path = event.target.closest('.lk-path');
            if (!path) return;
            event.preventDefault(); event.stopPropagation();
            change({ x: event.clientX, y: event.clientY, from: path }, head.dataset.uuid, Number(path.dataset.tag)).catch(() => G.say('The tags could not be read', 'warning'));
          });
        }
        draw(head, page.uuid);
      }
    };
    base.onStop(G.touch.watch(pass));
    base.onStop(G.touch.changed(() => { for (const head of heads) if (head.isConnected) (head.classList.contains('lk-parent') ? parentOf : draw)(head, head.dataset.uuid); }));
    base.onStop(() => { for (const head of heads) head.remove(); heads.clear(); });
  },
});
})();
