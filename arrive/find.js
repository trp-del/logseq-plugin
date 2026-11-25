/* ARRIVING: Find. One line to type in, over a list of nodes.
   With nothing typed it shows your tags as an outline: the kinds of things there are. A kind taken stands in the line, and the
   list is every node of that kind, newest first. Words typed then narrow it by a node's own words, its tag, a value of one of
   its properties (the doctor a consultation was with) or its day (oct, 2026). With no kind taken, the words go to Logseq's own
   search, and kinds whose name they spell stand above what it finds.
   The rows are the one line (node/line.js), so everything a line does elsewhere it does here. Arriving is what differs:
     Enter, or a press on a line   goes to the node and closes the window      Shift with either   opens it in the sidebar
     Right arrow, or the arrow     opens the node in place, in the window      Escape              back one step at a time */
(function () {
const G = window.PluginDoor, F = G.find;
G.part({
  key: 'find', title: 'Find', about: 'A window to reach any node: take a kind, then narrow by words, a value or a day. Cmd-K, or Find in the command palette.',
  settings: [{ key: 'findTakesSearchKey', type: 'boolean', default: true, title: 'Find opens on Cmd-K', description: 'Logseq’s own search stays on its magnifier. Off: Find opens from the command palette only.' }],
  start(base) {
    let win = null;   // the open window's state, or null
    base.style('find', `
.lk-veil { position: fixed; inset: 0; z-index: 40; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 0; background: color-mix(in srgb, var(--lk-paper) 40%, transparent); }
.lk-find { width: min(680px, 100%); max-height: 72vh; display: flex; flex-direction: column; border-radius: 12px; background: var(--lk-paper); color: var(--lk-text); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); overflow: hidden; }
.lk-find-top { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--lk-hair); flex: none; }
.lk-find-top .lk-piece { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--lk-wash); }
.lk-find-top .lk-field { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: inherit; font: inherit; font-size: 18px; line-height: 28px; padding: 0; box-shadow: none; }
.lk-find-top .lk-field::placeholder { color: var(--lk-off); }
.lk-find-body { overflow-y: auto; padding: 8px 16px 12px; }
.lk-find-body:empty { display: none; }
.lk-kind { display: flex; align-items: center; min-height: 28px; padding: 0 8px; border-radius: 6px; cursor: default; }
.lk-kind .lk-tag { color: var(--lk-text); }
.lk-kind.lit, .lk-find .lk-line.lit { background: var(--lk-lit); }
.lk-find-kinds:not(:empty) + .lk-find-rows:not(:empty) { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--lk-hair); }
.lk-find .lk-none { padding: 4px 8px; }
/* In Find the words start the row and the day stands at its right end, right-aligned (the owner, 25 November 2026). The line
   reaches under the day, so the lit line is one band from the bullet to the day. An opened node takes the whole width. */
.lk-find .lk-row { grid-template-columns: 18px minmax(0, 1fr) var(--lk-daycol, 0px); }
.lk-find .lk-row > .lk-fold { grid-column: 1; grid-row: 1; }
.lk-find .lk-row > .lk-line { grid-column: 2 / -1; grid-row: 1; padding-right: calc(var(--lk-daycol, 0px) + 10px); }
.lk-find .lk-row > .lk-open { grid-column: 2 / -1; }
.lk-find .lk-row > .lk-day { grid-column: 3; grid-row: 1; z-index: 1; text-align: right; padding-right: 10px; }
.lk-find .lk-row > .lk-day:empty, .lk-find .lk-row[data-open="1"] > .lk-day { display: none; }
.lk-find .lk-more { margin-left: 34px; }`);

    const stops = () => [...win.body.querySelectorAll('.lk-kind, .lk-find-rows > .lk-list > .lk-rows > .lk-row > .lk-line')].filter(el => el.offsetParent);
    const light = (index, scroll = true) => {
      const all = stops(); win.lit = Math.max(0, Math.min(index, all.length - 1));
      for (const el of win.body.querySelectorAll('.lit')) el.classList.remove('lit');
      const at = all[win.lit]; if (at) { at.classList.add('lit'); if (scroll) at.scrollIntoView({ block: 'nearest' }); }
    };
    async function nodesFor() {
      if (win.kind) {
        if (win.kindNodes?.id !== win.kind.id) {
          const tags = await G.read.tags(), nodes = await G.read.tagged([...F.under(win.kind.id, tags)]), values = await G.read.values(nodes.map(node => node.id));
          const names = await G.read.names(nodes.flatMap(node => G.words.named(node.words)));
          win.kindNodes = { id: win.kind.id, nodes: nodes.map(node => ({ ...node, plain: G.words.plain(node.words, names), values: values.get(node.id) || [] })).sort((a, b) => (b.day || 0) - (a.day || 0) || a.plain.localeCompare(b.plain)) };
        }
        return F.narrow(win.kindNodes.nodes.map(node => ({ ...node, shown: node.words, words: node.plain })), win.text).map(node => ({ ...node, words: node.shown }));
      }
      return win.text.trim() ? G.read.search(win.text.trim()) : [];
    }
    async function draw() {
      const mine = ++win.turn, tags = await G.read.tags();
      if (!win || mine !== win.turn) return;
      win.pieceEl.hidden = !win.kind; win.pieceEl.textContent = win.kind?.title || '';
      win.field.placeholder = win.kind ? 'Words, a value, a day' : 'Find';
      const kinds = win.kind ? [] : win.text.trim() ? F.kinds(tags, win.text).slice(0, 6).map(tag => ({ tag, depth: 0 })) : F.tree(tags);
      win.kindsEl.innerHTML = kinds.map(({ tag, depth }) => `<div class="lk-kind" data-id="${tag.id}" style="padding-left: ${8 + depth * 18}px"><span class="lk-tag">${G.esc(tag.title)}</span></div>`).join('');
      win.found = await nodesFor();
      if (!win || mine !== win.turn) return;
      win.noneEl.hidden = !!(kinds.length || win.found.length) || !(win.text.trim() || win.kind);
      await win.list.again();
    }
    const take = tag => { win.kind = tag; win.text = ''; win.field.value = ''; win.lit = 0; draw(); };
    const go = (row, side) => { const uuid = row.dataset.uuid; if (!side) close(); G.touch.open(uuid, side); };
    function act(event) {
      const all = stops(), at = all[win.lit];
      if (!at) return;
      if (at.classList.contains('lk-kind')) return void G.read.tags().then(tags => take(tags.get(Number(at.dataset.id))));
      go(at.closest('.lk-row'), event.shiftKey);
    }
    function onKey(event) {
      const field = win.field, typing = event.target === field;
      if (event.key === 'Escape') {
        if (G.touch.busy() || (!typing && /^(TEXTAREA|INPUT)$/.test(event.target.tagName))) return;   // Logseq's own Escape first
        event.preventDefault(); event.stopPropagation();
        const opened = [...win.body.querySelectorAll('.lk-row[data-open]')].pop();
        if (opened) { G.node.close(opened); field.focus(); }
        else if (win.text) { win.text = ''; field.value = ''; draw(); }
        else if (win.kind) { win.kind = null; draw(); }
        else close();
        return;
      }
      if (!typing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); light(win.lit + (event.key === 'ArrowDown' ? 1 : -1)); }
      else if (event.key === 'Enter') { event.preventDefault(); act(event); }
      else if (event.key === 'Tab') { event.preventDefault(); const at = stops()[win.lit]; if (at?.classList.contains('lk-kind')) act(event); }
      else if (event.key === 'ArrowRight' && field.selectionStart === field.value.length) { const row = stops()[win.lit]?.closest('.lk-row'); if (row) { event.preventDefault(); G.node.open(row); } }
      else if (event.key === 'Backspace' && !field.value && win.kind) { event.preventDefault(); win.kind = null; draw(); }
      else return;
      event.stopPropagation();
    }
    function open() {
      if (win) { win.field.focus(); win.field.select(); return; }
      const doc = G.host(), veil = doc.createElement('div'); veil.className = 'lk-veil';
      veil.innerHTML = `<div class="lk-find" role="dialog" aria-label="Find"><div class="lk-find-top"><span class="lk-piece lk-tag" hidden></span><input class="lk-field" type="text" placeholder="Find" spellcheck="false" autocomplete="off" aria-label="Find"></div><div class="lk-find-body"><div class="lk-find-kinds"></div><div class="lk-find-rows lk-rel"></div><div class="lk-none" hidden>Nothing found</div></div></div>`;
      doc.body.appendChild(veil);
      const q = sel => veil.querySelector(sel);
      win = { veil, field: q('.lk-field'), pieceEl: q('.lk-piece'), body: q('.lk-find-body'), kindsEl: q('.lk-find-kinds'), rowsEl: q('.lk-find-rows'), noneEl: q('.lk-none'), kind: null, text: '', lit: 0, turn: 0, found: [], kindNodes: null, back: doc.activeElement, timer: 0 };
      win.list = G.node.listing(win.rowsEl, async () => win.found.length ? [{ key: 'found', kind: 'plain', name: '', tag: '', rows: win.found.map(node => ({ ...node, tagShown: !!node.tag && node.tag !== win.kind?.title, dayShown: node.day })) }] : [],
        { few: 40, press: (row, event) => { go(row, event.shiftKey); return true; } });
      win.rowsEl.addEventListener('lk-drawn', () => { if (win) light(win.lit, false); });
      win.field.addEventListener('input', () => { win.text = win.field.value; win.lit = 0; clearTimeout(win.timer); win.timer = setTimeout(draw, win.kind ? 0 : 120); });
      veil.addEventListener('keydown', onKey, true);
      veil.addEventListener('mousedown', event => { if (event.target === veil) close(); });
      win.kindsEl.addEventListener('click', event => { const kind = event.target.closest('.lk-kind'); if (kind) G.read.tags().then(tags => take(tags.get(Number(kind.dataset.id)))); win.field.focus(); });
      win.field.focus();
      draw();
    }
    function close() {
      if (!win) return;
      const was = win; win = null;
      clearTimeout(was.timer); was.list.off(); was.veil.remove();
      try { was.back?.focus?.({ preventScroll: true }); } catch (error) { /* gone */ }
    }
    G.touch.command('lk-find', 'Find', open);
    base.onStop(G.touch.key('mod+k', () => { if (G.setting('findTakesSearchKey') === false) return false; if (win) close(); else open(); }));
    base.onStop(G.touch.changed(() => { if (win) { win.kindNodes = null; draw(); } }));
    base.onStop(close);
  },
});
})();
