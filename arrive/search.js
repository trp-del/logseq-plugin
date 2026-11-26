/* ARRIVING: Search, a section of the right sidebar (the owner, 26 November 2026: "search can be sidebar", its results opening in
   the main view). One line to type in; under it what holds every typed word, each node once, grouped by its kind (a tag's name;
   pages with no tag, then lines). A line found in a note says where it sits; the typed letters are marked.
   A kind can be taken (Ontology's "Show its nodes"): it stands before the line and the list is every
   node of that kind, newest first, narrowed by the words, a value or a day.
     A press on a line, or Enter   goes to the node in the main view       Shift with either   opens it in the sidebar
     Right-click                   the line's own menu, as everywhere       Cmd-Enter           makes a page of the words
     Escape                        empties the words, then lets go of the kind
   Cmd-K opens it and puts the keys in its line. */
(function () {
const G = window.PluginDoor, S = G.search;
const LOOK = 'M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6';   // a magnifier, as Logseq's own line icons are drawn
G.part({
  key: 'search', title: 'Search', about: 'A section of the right sidebar to search your notes: what holds every word typed, grouped by kind, opening in the main view. Cmd-K opens it.',
  settings: [{ key: 'searchTakesSearchKey', type: 'boolean', default: true, title: 'Search opens on Cmd-K', description: 'Off: Cmd-K stays Logseq’s own search, and the plugin’s opens from the command palette.' }],
  start(base) {
    base.style('search', `
.lk-search { padding: 4px 4px 16px 22px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-search .lk-add { align-items: baseline; gap: 6px; }
.lk-search .lk-piece { flex: none; }
.lk-search .lk-piece[hidden] { display: none; }
.lk-search .lk-list-name { font-size: var(--lk-small); font-weight: 600; }
.lk-search .lk-list { margin-top: 0; }
.lk-search .lk-search-none { color: var(--lk-quiet); padding: 8px 0 0; }
.lk-search .lk-search-none[hidden] { display: none; }
.lk-search mark.lk-hit { background: none; color: inherit; font-weight: 600; padding: 0; margin: 0; border-radius: 0; }   /* the typed letters, in the words' own ink, a step heavier */`);
    const boxes = new Set();   // every drawn Search (the sidebar's section; one at a time in practice)
    const draw = holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-search', 'lk-day-end');
      holder.innerHTML = '<div class="lk-add"><span class="lk-piece lk-tag" hidden></span><input class="lk-field" type="text" placeholder="Search" spellcheck="false" autocomplete="off" aria-label="Search"></div><div class="lk-search-none" hidden>Nothing holds these words</div><div class="lk-rel"></div>';
      const field = holder.querySelector('.lk-field'), pieceEl = holder.querySelector('.lk-piece'), noneEl = holder.querySelector('.lk-search-none'), rel = holder.querySelector('.lk-rel');
      const box = { holder, field, kind: null, text: '', kindNodes: null, timer: 0 };
      boxes.add(box);
      const plain = async nodes => { const names = await G.read.names(nodes.flatMap(node => G.words.named(node.words))); return nodes.map(node => ({ ...node, plain: G.words.plain(node.words, names) })); };
      const read = async () => {
        const text = box.text.trim();
        let found = [];
        if (box.kind) {
          if (box.kindNodes?.id !== box.kind.id) {
            const tags = await G.read.tags(), nodes = await G.read.tagged([...G.tags.under(box.kind.id, tags)]), values = await G.read.values(nodes.map(node => node.id));
            box.kindNodes = { id: box.kind.id, nodes: (await plain(nodes)).map(node => ({ ...node, values: values.get(node.id) || [] })).sort((a, b) => (b.day || 0) - (a.day || 0) || a.plain.localeCompare(b.plain)) };
          }
          found = S.narrow(box.kindNodes.nodes.map(node => ({ ...node, shown: node.words, words: node.plain })), text).map(node => ({ ...node, words: node.shown }));
        } else if (text) {
          const nodes = await plain(await G.read.search(text, 80));
          found = S.rank(nodes.map(node => ({ ...node, shown: node.words, words: node.plain })), text).map(node => ({ ...node, words: node.shown }));
        }
        noneEl.hidden = !!found.length || !(text || box.kind);
        // A line found in a note says where it sits, so two lines of the same words are told apart.
        const sits = await G.read.where(found.filter(node => !node.isPage).map(node => node.id));
        const rows = found.slice(0, 120).map(node => ({ ...node, tagShown: false, dayShown: node.day, where: node.isPage ? [] : (sits.get(node.id) || []).filter(step => !step.day).slice(0, 2) }));   // a journal is a day, said once at the line's end
        if (box.kind) return rows.length ? [{ key: 'search:kind', kind: 'group', name: '', tag: '', rows }] : [];
        const groups = new Map();
        for (const row of rows) { const name = row.tag || (row.isPage ? 'Pages' : 'Lines'); if (!groups.has(name)) groups.set(name, []); groups.get(name).push(row); }
        const order = name => name === 'Lines' ? 2 : name === 'Pages' ? 1 : 0;
        return [...groups].sort((a, b) => order(a[0]) - order(b[0])).map(([name, list]) => ({ key: `search:${name}`, kind: 'group', name, tag: '', rows: list }));
      };
      const list = G.node.listing(rel, read, { few: 8, press: (row, event) => { G.touch.open(row.dataset.uuid, event.shiftKey); return true; },
        key: (row, event) => { if (event.key !== 'Enter') return false; G.touch.open(row.dataset.uuid, event.shiftKey); return true; } });
      const mark = () => { const want = S.tokens(box.text); for (const words of rel.querySelectorAll('.lk-line > .lk-words')) G.node.hit(words, want); };
      rel.addEventListener('lk-drawn', mark);
      const again = () => { pieceEl.hidden = !box.kind; pieceEl.textContent = box.kind?.title || ''; field.placeholder = box.kind ? 'Words, a value, a day' : 'Search'; list.again(); };
      box.take = tag => { box.kind = tag; box.kindNodes = null; box.text = ''; field.value = ''; again(); field.focus(); };
      box.again = () => { box.kindNodes = null; again(); };
      const onInput = () => { box.text = field.value; doc.defaultView.clearTimeout(box.timer); box.timer = doc.defaultView.setTimeout(again, box.kind ? 0 : 140); };
      const make = async () => {
        const name = field.value.trim(); if (!name || box.kind) return;
        try { G.touch.open(await G.write.newPage(name)); } catch (error) { G.say(`The page could not be made: ${error?.message || 'Logseq refused'}`, 'warning'); }
      };
      const onKey = event => {
        const first = () => rel.querySelector('.lk-row > .lk-line');
        if (event.key === 'ArrowDown') { const line = first(); if (line) { event.preventDefault(); line.focus(); } return; }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); make(); return; }
        if (event.key === 'Enter') { const row = first()?.parentElement; if (row) { event.preventDefault(); G.touch.open(row.dataset.uuid, event.shiftKey); } return; }
        if (event.key === 'Backspace' && !field.value && box.kind) { event.preventDefault(); box.kind = null; box.kindNodes = null; again(); return; }
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation();
          if (field.value) { field.value = ''; box.text = ''; again(); } else if (box.kind) { box.kind = null; box.kindNodes = null; again(); } else field.blur();
        }
      };
      field.addEventListener('input', onInput); field.addEventListener('keydown', onKey);
      return () => { boxes.delete(box); doc.defaultView.clearTimeout(box.timer); field.removeEventListener('input', onInput); field.removeEventListener('keydown', onKey); rel.removeEventListener('lk-drawn', mark); list.off(); };
    };
    const section = G.touch.section('lk-search', 'Search', draw, LOOK);
    base.onStop(section.off);
    // Opened with its line ready for words: from the key, the command, the corner, or another place with a kind already taken.
    const focus = async (tag = null) => {
      section.open();
      for (let tries = 0; tries < 20; tries++) {
        const box = [...boxes].find(one => one.holder.isConnected);
        if (box) { if (tag) box.take(tag); box.field.focus(); box.field.select(); return; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    G.touch.command('lk-search', 'Search', () => focus());
    G.arrive = { ...(G.arrive || {}), search: async id => focus((await G.read.tags()).get(id) || null) };
    base.onStop(() => { G.arrive = { ...(G.arrive || {}), search() {} }; });
    base.onStop(G.touch.key('mod+k', () => { if (G.setting('searchTakesSearchKey') === false) return false; focus(); }));
    base.onStop(G.touch.changed(() => { for (const box of boxes) if (box.holder.isConnected && (box.text.trim() || box.kind)) box.again(); }));
  },
});
})();
