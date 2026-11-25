/* PAGE: a page's place. Under a page's title, each of its tags with the tags it sits under, up to the top: what the page
   is, and where that stands among the kinds of things. Each name opens its tag. Logseq's own tag at the title's right, which
   says only the first step, is taken away where the path stands. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'place', title: 'A page’s place', about: 'Under a page’s title: its tags, each with the tags it sits under.',
  start(base) {
    base.style('place', G.touch.HIDES_TAGS + `
.lk-place { font-family: var(--lk-tag-face); color: var(--lk-quiet); font-size: 16px; font-weight: 400; line-height: 24px; margin: 2px 0 6px; }
.lk-place:empty { display: none; }
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
      const html = own.filter(id => all.has(id)).map(id => G.tags.path(id, all)).sort((a, b) => a[0].title.localeCompare(b[0].title))
        .map(path => `<span class="lk-path">${path.map(tag => `<a data-to="${G.esc(tag.uuid)}">${G.esc(tag.title)}</a>`).join('<span class="lk-up">/</span>')}</span>`).join('');
      if (head.lkHtml !== html) { head.innerHTML = html; head.lkHtml = html; }
      void mine;
    };
    const heads = new Set();
    const pass = () => {
      for (const head of heads) if (!head.isConnected) heads.delete(head);
      for (const page of G.touch.pages()) {
        if (page.feed) continue;
        const head = G.touch.pageHead(page.el, 'lk-place');
        if (!head || head.dataset.uuid === page.uuid) continue;
        head.dataset.uuid = page.uuid; heads.add(head);
        if (!head.lkWired) { head.lkWired = true; head.addEventListener('click', event => { const a = event.target.closest('a[data-to]'); if (a) G.touch.open(a.dataset.to, event.shiftKey); }); }
        draw(head, page.uuid);
      }
    };
    base.onStop(G.touch.watch(pass));
    base.onStop(G.touch.changed(() => { for (const head of heads) if (head.isConnected) draw(head, head.dataset.uuid); }));
    base.onStop(() => { for (const head of heads) head.remove(); heads.clear(); });
  },
});
})();
