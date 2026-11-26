/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties by name, in a section of
   the right sidebar. A tag and a property are nodes like any other, so each row is the one line (node/line.js) and opens in
   place as Logseq's own page for it: its name is renamed there, the tag it sits under is changed there (Extends), a property's
   kind and what it takes are set there, all with Logseq's own controls and Logseq's own Undo. Nothing here writes. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags and properties, on a page of their own and as an outline in the right sidebar. A press on a name goes to its page; a press beside it shows the tag’s lines; a line at the top makes a new tag.',
  start(base) {
    base.style('ontology', `
.lk-ontology { padding: 4px 4px 16px 22px; }
.lk-ontology > .lk-rel { position: relative; }
.lk-ontology .lk-row > .lk-fold { visibility: hidden; }   /* nothing opens under a tag or a property here */
.lk-ontology .lk-row.lk-chosen > .lk-line { background: var(--lk-wash); }
.lk-ontology .lk-line .lk-words { cursor: pointer; }
.lk-page { padding: 0 0 48px; }
.lk-page-title { font-size: var(--ls-page-title-size, 2rem); font-weight: 600; line-height: 1.25; margin: 0 0 18px; color: var(--lk-text); }
.lk-map { --lk-ground: var(--lk-paper); padding-left: 22px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
.lk-map > .lk-add { order: 1; flex: 1 1 180px; max-width: 362px; position: static; }   /* on its own page the line that adds scrolls with the page */
.lk-map > .lk-values { order: 2; margin: 0 0 12px auto; }   /* the two presses stand beside the line where there is room, under it where there is not: never over it (found by hand) */
.lk-map > .lk-side { order: 3; margin-bottom: 12px; }
.lk-map > .lk-ask { order: 4; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { order: 5; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { display: grid; grid-template-columns: repeat(2, minmax(232px, 340px)); justify-content: space-between; gap: 56px 44px; align-items: start; padding: 34px 26px 0 0; container-type: normal; }   /* the columns are counted as the areas are drawn */
.lk-map > .lk-rel > .lk-list { container: lk-list / inline-size; min-width: 0; }
.lk-joins { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.lk-joins { color: var(--lk-text); }
.lk-joins path { fill: none; stroke: currentColor; stroke-opacity: .5; stroke-width: 1; }   /* a hairline in the quiet grey, in light and dark alike */
.lk-ontology:not(.lk-map) > .lk-rel { padding-right: 20px; }   /* room at the right for the bracket of a tag's lines */
/* Tick tags, then act on all of them: one line of presses over the map, and a line to find a tag by, at its right. */
.lk-ont-bar { order: 4; flex: 0 0 100%; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; min-height: 32px; margin: 2px 0 0; font-size: var(--lk-small); }
.lk-ont-said { margin-right: 8px; color: var(--lk-quiet); white-space: nowrap; }
.lk-ont-bar[data-n]:not([data-n="0"]) .lk-ont-said { color: var(--lk-text); }
.lk-ont-bar .lk-btn { font-size: inherit; }
.lk-ont-bar .lk-btn.lk-goes { color: var(--lk-going); }
.lk-ont-find { margin-left: auto; flex: 0 1 180px; min-width: 100px; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-ont-find:focus { border-bottom-color: var(--lk-line); }
.lk-ont-find::placeholder { color: var(--lk-off); }
.lk-ont-bar > .lk-ask { flex: 0 0 100%; }
.lk-ont-merge { max-width: 520px; margin: 4px 0 10px; padding: 12px; border-radius: var(--lk-corner-float); box-shadow: 0 0 0 1px var(--lk-line); display: flex; flex-direction: column; gap: 6px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-ont-merge .lk-ask-head { font-weight: 600; }
.lk-ont-merge .lk-ask-head .lk-tag { font-weight: 400; color: var(--lk-text); }
.lk-ont-merge .lk-ask-note { color: var(--lk-quiet); font-size: var(--lk-small); }
.lk-ont-merge .lk-answers { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
.lk-ont-merge .lk-tag.lk-going { color: var(--lk-going); }
.lk-ont-merge .lk-tag.lk-coming { color: var(--lk-coming); }
.lk-ont-rename { flex: 0 0 100%; display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; }
.lk-ont-rename .lk-field { flex: 0 1 280px; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-line); outline: 0; background: none; color: inherit; font: inherit; font-family: var(--lk-tag-face); font-size: var(--lk-words-size); line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }`);
    /* One drawing for both places. In the sidebar: one outline. On the page: every top tag an area of its own, side by side,
       so the lines between tags run in the gaps and over the band above the areas. */
    const draw = (holder, wide) => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-ontology'); holder.classList.toggle('lk-map', wide);
      holder.innerHTML = '<div class="lk-rel"></div>';
      // A new tag is made at the top; opened in place, Logseq's own page for it puts it under another.
      const offAdd = G.node.adder(holder, 'New tag', async name => {
        const there = [...(await G.read.tags()).values()].find(tag => tag.title.trim().toLowerCase() === name.toLowerCase());
        return there ? there.uuid : G.write.newTag(name);
      }, 'The tag could not be made');
      const plain = node => ({ ...node, tag: '', tagShown: false, dayShown: 0, day: 0 });
      const rel = holder.lastElementChild;
      G.moving.last(holder);   // the line of the last move of values, until it is let go
      // A tag moved under another, or to the top: written at once; Logseq's own Undo takes it back. The row keeps the keys.
      /* One move at a time: a second Tab pressed before the outline has been drawn anew would be worked out from where the tag
         stood, not from where it stands (found by hand, 25 November 2026: Tab then Shift-Tab in quick succession left a tag under
         two parents). Until the first move shows, further moves are not taken. */
      let moving = false, waiting = null;   // waiting: the one key pressed while a move was still on its way, taken up when it shows
      const move = async (uuid, to) => {
        if (moving) return;
        moving = true;
        const view = doc.defaultView, done = () => { moving = false; view.clearTimeout(cap); rel.removeEventListener('lk-drawn', shown); if (waiting) { const [id, out] = waiting; waiting = null; view.setTimeout(() => step(id, out), 0); } };
        const shown = () => { if (!writing) { done(); rel.querySelector(`.lk-row[data-uuid="${uuid}"] > .lk-line`)?.focus({ preventScroll: true }); } };
        let writing = true; const cap = view.setTimeout(done, 4000);
        try {
          G.read.forget();
          const tags = await G.read.tags(), tag = [...tags.values()].find(one => one.uuid === uuid);
          if (!tag || to === uuid) { done(); return; }
          rel.addEventListener('lk-drawn', shown);
          G.undo.mark(uuid, await G.write.moveTag(uuid, to, tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean)));   // the faded arrow beside the tag takes the whole move back
          writing = false;
        } catch (error) { done(); G.say(`The tag could not be moved: ${error?.message || 'Logseq refused'}`, 'warning'); }
      };
      const isTag = row => row.closest('.lk-list')?.dataset.face === 'tag';
      const depthOf = row => Number(row.style.getPropertyValue('--lk-depth')) || 0;
      // The nearest row above at a depth: the row's sibling (its own depth), its parent (one less), its parent's parent (two less).
      const above = (row, want) => { for (let at = row.previousElementSibling; at; at = at.previousElementSibling) { const d = depthOf(at); if (d === want) return at; if (d < want) return null; } return null; };
      /* The lines between tags, drawn as the released Ontology drew them (the owner, 25 November 2026: "I prefer the style of
         the connecting lines of the old ontology"). A tag is joined to another when its nodes hold, under one of your
         properties, nodes of the other. Each pair is one hairline of its own, in the quiet grey, from the edge of one area at
         its row to the edge of the other at its row, turning on a corner of 6: inside one area a bracket just outside its right
         edge; between neighbouring areas one soft curve across the gap; further apart up to the band above the row of areas,
         across, and down into the other from its left; between rows of areas down the gap at the right of each. Lines never
         cross words. Only the lines of the tag under the pointer or the keys, and of the tags under it, are drawn. */
      let ids = new Map(), lit = '', joins = [], tagIndex = new Map();
      const NS = 'http://www.w3.org/2000/svg', R = 6, NARROW = 232, WIDE = 340;
      // As many areas beside each other as fit at their narrowest, none wider than 340, the room left over in the gaps.
      const columns = () => {
        if (!wide) return;
        const view = doc.defaultView, css = view.getComputedStyle(rel), gap = parseFloat(css.columnGap) || 0, inner = rel.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0);
        const n = Math.max(1, Math.min(rel.querySelectorAll(':scope > .lk-list').length || 1, Math.floor((inner + gap) / (NARROW + gap)))), want = `repeat(${n}, minmax(${NARROW}px, ${WIDE}px))`;
        if (rel.style.gridTemplateColumns !== want) rel.style.gridTemplateColumns = want;
      };
      const lines = () => {
        columns();
        rel.querySelector(':scope > .lk-joins')?.remove();
        const me = ids.get(lit);
        if (!me) return;
        const near = G.find.under(me, tagIndex), rowOf = new Map([...rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows > .lk-row')].map(row => [ids.get(row.dataset.uuid), row]));
        const at = rel.getBoundingClientRect(), areas = [...rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows')];
        const tops = [...new Set(areas.map(area => Math.round(area.getBoundingClientRect().top - at.top)))].sort((x, y) => x - y);
        const seat = row => { const r = (row.querySelector(':scope > .lk-line') || row).getBoundingClientRect(), area = row.parentElement, ar = area.getBoundingClientRect(); return { y: r.top - at.top + 14, l: ar.left - at.left, r: ar.right - at.left, area: areas.indexOf(area), line: tops.indexOf(Math.round(ar.top - at.top)) }; };
        const pairs = new Map();
        for (const [from, , to] of joins) { if (from === to || !(near.has(from) || near.has(to))) continue; const a = rowOf.get(from), b = rowOf.get(to); if (a && b && a !== b) pairs.set(`${from}>${to}`, { a, b }); }
        if (!pairs.size) return;
        let lane = 0;
        const svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('class', 'lk-joins'); svg.setAttribute('width', rel.scrollWidth); svg.setAttribute('height', rel.scrollHeight); svg.setAttribute('aria-hidden', 'true');
        for (const pair of pairs.values()) {
          let a = seat(pair.a), b = seat(pair.b), d;
          if (a.line > b.line || (a.line === b.line && a.area > b.area)) [a, b] = [b, a];
          if (a.area === b.area) { const x = a.r + 10 + (Math.abs(a.y - b.y) % 3) * 3, turn = b.y > a.y ? 1 : -1; d = `M${a.r} ${a.y} H${x - R} Q${x} ${a.y} ${x} ${a.y + turn * R} V${b.y - turn * R} Q${x} ${b.y} ${x - R} ${b.y} H${b.r}`; }
          else if (a.line === b.line && b.area === a.area + 1) { const mid = (a.r + b.l) / 2; d = `M${a.r} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${b.l} ${b.y}`; }
          else if (a.line === b.line) {
            const top = tops[a.line] - 26 + (lane++ % 5) * 4, x1 = a.r + 14, x2 = b.l - 14;
            d = `M${a.r} ${a.y} H${x1 - R} Q${x1} ${a.y} ${x1} ${a.y - R} V${top + R} Q${x1} ${top} ${x1 + R} ${top} H${x2 - R} Q${x2} ${top} ${x2} ${top + R} V${b.y - R} Q${x2} ${b.y} ${x2 + R} ${b.y} H${b.l}`;
          } else {
            const k = lane++ % 5, top = tops[b.line] - 26 + k * 4, x1 = a.r + 14 + k * 3, x2 = b.r + 14 + k * 3, turn = x2 > x1 ? 1 : x2 < x1 ? -1 : 0;
            const across = turn ? `Q${x1} ${top} ${x1 + turn * R} ${top} H${x2 - turn * R} Q${x2} ${top} ${x2} ${top + R}` : `V${top + R}`;
            d = `M${a.r} ${a.y} H${x1 - R} Q${x1} ${a.y} ${x1} ${a.y + R} V${top - (turn ? R : 0)} ${across} V${b.y - R} Q${x2} ${b.y} ${x2 - R} ${b.y} H${b.r}`;
          }
          const path = doc.createElementNS(NS, 'path'); path.setAttribute('d', d); svg.appendChild(path);
        }
        rel.appendChild(svg);
      };
      // The lines follow the width: the sidebar opened, the window narrowed.
      const RO = doc.defaultView.ResizeObserver, sized = RO ? new RO(() => { if (rel.isConnected && rel.clientWidth !== sized.was) { sized.was = rel.clientWidth; lines(); } }) : null;
      sized?.observe(rel);
      const light = uuid => { if (uuid === lit) return; lit = uuid; lines(); };
      /* A row is selected by a press beside its name or by the arrow keys: its lines show, and stay until another row is
         selected. Nothing opens under a tag or a property here (the owner, 25 November 2026: "don't show the whole tag page in
         ontology under a tag nor property page"): a press on the name goes to its page, Shift in the sidebar, Enter too. */
      const select = row => {
        for (const was of rel.querySelectorAll('.lk-row.lk-chosen')) if (was !== row) was.classList.remove('lk-chosen');
        row?.classList.add('lk-chosen');
        light(row && isTag(row) ? row.dataset.uuid : '');
      };
      const onFocus = event => { const row = event.target.closest?.('.lk-rows > .lk-row'); if (row && row.closest('.lk-rel') === rel) select(row); };
      rel.addEventListener('focusin', onFocus);
      rel.addEventListener('lk-drawn', () => { const row = lit && rel.querySelector(`.lk-row[data-uuid="${lit}"]`); if (row) row.classList.add('lk-chosen'); lines(); });
      // One step in or out for a tag, worked out from where its row stands now.
      const step = (uuid, out) => {
        const row = rel.querySelector(`.lk-list[data-face="tag"] > .lk-rows > .lk-row[data-uuid="${uuid}"]`);
        if (!row) return;
        const d = depthOf(row);
        if (!out) { const to = above(row, d); if (to) move(uuid, to.dataset.uuid); }
        else if (d > 0) move(uuid, d > 1 ? above(row, d - 2)?.dataset.uuid || '' : '');
      };
      /* Tick tags, then act on all of them (the owner chose this old part, 26 November 2026), on the page of its own. A tick box
         stands before every tag, shown under the pointer and once ticked. Over the map, one line: what is ticked, then Merge…
         (two tags), Move up a level, Move under…, Rename (one tag), Delete, and × to untick; at its right, a line that narrows
         the map to the tags whose names hold what is typed, each with the tags above it. Every action is written at once and
         leaves the Undo arrow, which takes all of it back. */
      const picked = new Set(), countOf = new Map(); let bar = null, wanted = '';
      const fresh = async () => { G.read.forget(); const tags = await G.read.tags(); return { tags, of: new Map([...tags.values()].map(tag => [tag.uuid, tag])) }; };
      const say = () => {
        if (!bar) return;
        const n = picked.size; bar.dataset.n = String(n);
        bar.querySelector('.lk-ont-said').textContent = n ? `${n} ${n === 1 ? 'tag' : 'tags'} picked` : 'Tick tags, then';
        for (const button of bar.querySelectorAll('button[data-do]')) { const does = button.dataset.do; if (does === 'none') button.hidden = !n; else button.disabled = does === 'merge' ? n !== 2 : does === 'rename' ? n !== 1 : !n; }
      };
      const ticks = () => {
        if (!wide) return;
        const rows = [...rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows > .lk-row')], here = new Set(rows.map(row => row.dataset.uuid));
        if (!wanted) for (const uuid of [...picked]) if (!here.has(uuid)) picked.delete(uuid);   // a tag that went (merged, deleted) is no longer picked
        for (const row of rows) {
          const line = row.querySelector(':scope > .lk-line'); if (!line) continue;
          let tick = line.querySelector(':scope > input.lk-tick');
          if (!tick) { tick = doc.createElement('input'); tick.type = 'checkbox'; tick.className = 'lk-tick'; tick.setAttribute('aria-label', `Pick ${line.querySelector('.lk-words')?.textContent.trim() || 'this tag'}`); line.prepend(tick); }
          tick.checked = picked.has(row.dataset.uuid);
        }
        say();
      };
      const moveAll = async to => {   // to: a tag's uuid, '' for the top, or 'up' for one level out
        try {
          const { tags, of } = await fresh(); let steps = 0, last = '';
          for (const uuid of picked) {
            const tag = of.get(uuid); if (!tag) continue;
            const from = tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean);
            const dest = to === 'up' ? (tag.parents.length ? tags.get(tags.get(tag.parents[0])?.parents[0])?.uuid || '' : null) : to;
            if (dest == null || dest === uuid || (from.length === 1 && from[0] === dest) || (!from.length && dest === '')) continue;
            steps += await G.write.moveTag(uuid, dest, from); last = uuid;
          }
          if (last) G.undo.mark(last, steps);
        } catch (error) { G.say(`The tags could not all be moved: ${error?.message || 'Logseq refused'}`, 'warning'); }
      };
      const act = async (does, button) => {
        if (does === 'none') { picked.clear(); return ticks(); }
        if (does === 'up') return moveAll('up');
        const { tags, of } = await fresh(), mine = [...picked].map(uuid => of.get(uuid)).filter(Boolean);
        if (!mine.length) return;
        if (does === 'under') {
          const below = new Set(mine.flatMap(tag => [...G.find.under(tag.id, tags)])), others = new Map([...tags].filter(([id]) => !below.has(id)));
          return void G.menu(button, [...G.find.tree(others).map(({ tag: one, depth }) => ({ word: one.title, depth, face: 'tag', take: () => moveAll(one.uuid) })), { gap: true }, { word: 'The top', take: () => moveAll('') }], { find: `Move ${mine.length} picked ${mine.length === 1 ? 'tag' : 'tags'} to…` });
        }
        if (does === 'delete') {
          const nodes = mine.reduce((sum, tag) => sum + (countOf.get(tag.uuid) || 0), 0);
          return void G.ask.gone(bar, { words: mine.length === 1 ? `Delete the tag “${mine[0].title}”?` : `Delete ${mine.length} tags?`,
            note: nodes ? `${nodes} ${nodes === 1 ? 'node holds' : 'nodes hold'} ${mine.length === 1 ? 'it' : 'them'}. ${mine.length === 1 ? 'It is' : 'They are'} taken off every one of them.` : '', yes: mine.length === 1 ? 'Delete the tag' : `Delete ${mine.length} tags`,
            take: async () => { let steps = 0; for (const tag of mine) { await G.write.remove(tag.uuid, true); steps++; } G.undo.mark(mine[mine.length - 1].uuid, steps); picked.clear(); list.again(); } });
        }
        if (does === 'merge') {
          /* Two tags made one, shown before it is made: the first ticked goes into the second (or the other way round, on "Keep
             the other name"). Every node that held the tag that goes holds the one that stays; the tags under it move under the
             one that stays; then the tag that goes is deleted. Links in words to the tag that goes are not rewritten. */
          bar.querySelector('.lk-ont-merge')?.remove();
          let [from, into] = mine;
          const box = doc.createElement('div'); box.className = 'lk-ask lk-ont-merge';
          const paint = async () => {
            const nodes = await G.read.tagged([from.id]), names = await G.read.names(nodes.flatMap(node => G.words.named(node.words)));
            const kids = [...tags.values()].filter(tag => tag.parents.includes(from.id) && tag.id !== into.id);
            box.innerHTML = `<div class="lk-ask-head">Merge <span class="lk-tag">${G.esc(from.title)}</span> into <span class="lk-tag">${G.esc(into.title)}</span></div>`
              + nodes.slice(0, 4).map(node => `<div class="lk-ont-will">${G.esc(G.words.plain(node.words, names) || 'Untitled')} <span class="lk-tag lk-going">${G.esc(from.title)}</span> <span class="lk-tag lk-coming">${G.esc(into.title)}</span></div>`).join('')
              + `<div class="lk-ask-note">${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'}${nodes.length > 4 ? `, ${nodes.length - 4} more not shown` : ''}${kids.length ? ` · ${kids.length} ${kids.length === 1 ? 'tag' : 'tags'} under ${G.esc(from.title)} ${kids.length === 1 ? 'moves' : 'move'} under ${G.esc(into.title)}` : ''} · the tag ${G.esc(from.title)} is then deleted</div>`
              + `<div class="lk-answers"><button type="button" class="lk-accent" data-go="yes">Merge</button><button type="button" class="lk-btn lk-low" data-go="no">Cancel</button><button type="button" class="lk-btn lk-low" data-go="swap">Keep the other name</button></div>`;
            box.lkPlan = { nodes, kids };
            box.querySelector('[data-go="yes"]').focus();
          };
          bar.appendChild(box); await paint();
          box.addEventListener('click', async event => {
            const go = event.target.closest('[data-go]')?.dataset.go; if (!go) return;
            event.stopPropagation();
            if (go === 'no') return void box.remove();
            if (go === 'swap') { [from, into] = [into, from]; return void paint(); }
            for (const button of box.querySelectorAll('button')) button.disabled = true;
            let steps = 0;
            try {
              for (const node of box.lkPlan.nodes) { await G.write.tag(node.uuid, into.uuid); await G.write.untag(node.uuid, from.uuid); steps += 2; }
              for (const kid of box.lkPlan.kids) steps += await G.write.moveTag(kid.uuid, into.uuid, [from.uuid]);
              await G.write.remove(from.uuid, true); steps++;
              G.undo.mark(into.uuid, steps); picked.clear();
            } catch (error) { G.say(`The tags could not be merged whole: ${error?.message || 'Logseq refused'}. What was written can be taken back with Undo, ${steps} ${steps === 1 ? 'step' : 'steps'}.`, 'warning'); }
            box.remove(); list.again();
          });
          box.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); box.remove(); } });
          return;
        }
        if (does === 'rename') {
          bar.querySelector('.lk-ont-rename')?.remove();
          const tag = mine[0], box = doc.createElement('div'); box.className = 'lk-ont-rename';
          box.innerHTML = `<input class="lk-field" type="text" aria-label="The tag’s name" spellcheck="false" autocomplete="off"><button type="button" class="lk-accent" data-go="yes">Rename</button><button type="button" class="lk-btn lk-low" data-go="no">Cancel</button>`;
          const field = box.firstElementChild; field.value = tag.title; bar.appendChild(box); field.focus(); field.select();
          const go = async yes => {
            const name = field.value.trim(); box.remove();
            if (!yes || !name || name === tag.title) return;
            if ([...tags.values()].some(one => one.id !== tag.id && one.title.trim().toLowerCase() === name.toLowerCase())) return void G.say(`A tag named “${name}” is there already. Merge the two instead.`, 'warning');
            try { await G.undo.after(tag.uuid, G.write.rename(tag.uuid, name)); list.again(); } catch (error) { G.say(`The tag could not be renamed: ${error?.message || 'Logseq refused'}`, 'warning'); }
          };
          box.addEventListener('click', event => { const does = event.target.closest('[data-go]')?.dataset.go; if (does) { event.stopPropagation(); go(does === 'yes'); } });
          field.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); go(true); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); go(false); } });
        }
      };
      let offBar = null;
      if (wide) {
        bar = doc.createElement('div'); bar.className = 'lk-ont-bar';
        bar.innerHTML = `<span class="lk-ont-said"></span><button type="button" class="lk-btn lk-low" data-do="merge">Merge…</button><button type="button" class="lk-btn lk-low" data-do="up">Move up a level</button><button type="button" class="lk-btn lk-low" data-do="under">Move under…</button><button type="button" class="lk-btn lk-low" data-do="rename">Rename</button><button type="button" class="lk-btn lk-low lk-goes" data-do="delete">Delete</button><button type="button" class="lk-btn lk-low" data-do="none" aria-label="Untick all" title="Untick all" hidden>×</button><input class="lk-ont-find" type="text" placeholder="Find a tag" aria-label="Find a tag" spellcheck="false" autocomplete="off">`;
        rel.before(bar);
        const onBar = event => { const button = event.target.closest('button[data-do]'); if (button && button.parentElement === bar && !button.disabled) act(button.dataset.do, button); };
        const find = bar.querySelector('.lk-ont-find'), onFind = () => { const now = find.value.trim().toLowerCase(); if (now !== wanted) { wanted = now; list.again(); } };
        const onFindKey = event => { if (event.key === 'Escape' && find.value) { event.preventDefault(); event.stopPropagation(); find.value = ''; onFind(); } };
        // A press on a tick box ticks it and does nothing else: it is not a press on the tag's line.
        const onTick = event => { const tick = event.target.closest?.('input.lk-tick'); if (!tick || !rel.contains(tick)) return; event.stopPropagation(); if (event.type !== 'click') return; const uuid = tick.closest('.lk-row')?.dataset.uuid; if (!uuid) return; if (tick.checked) picked.add(uuid); else picked.delete(uuid); say(); };
        bar.addEventListener('click', onBar); find.addEventListener('input', onFind); find.addEventListener('keydown', onFindKey);
        for (const type of ['click', 'mousedown', 'pointerdown', 'keydown']) rel.addEventListener(type, onTick, true);
        rel.addEventListener('lk-drawn', ticks);
        say();
        offBar = () => { for (const type of ['click', 'mousedown', 'pointerdown', 'keydown']) rel.removeEventListener(type, onTick, true); rel.removeEventListener('lk-drawn', ticks); bar.remove(); };
      }
      const list = G.node.listing(rel, async () => {
        const tags = await G.read.tags(), tree = G.find.tree(tags), props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
        const [tagNodes, propNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.byUuids(props.map(prop => prop.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.find.counts(tags, pairs), idOf = new Map(tree.map(row => [row.tag.uuid, row.tag.id]));
        ids = idOf; tagIndex = tags; joins = await G.read.relations();
        let tagRows = tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(idOf.get(node.uuid)) || 0 }));
        countOf.clear(); for (const row of tagRows) countOf.set(row.uuid, row.count);
        if (wanted) {   // the tags whose names hold what is typed, each with the tags above it
          const keep = new Set();
          tagRows.forEach((row, i) => { if (!String(row.words).toLowerCase().includes(wanted)) return; keep.add(i); for (let j = i - 1, d = row.depth; j >= 0 && d > 0; j--) if (tagRows[j].depth < d) { keep.add(j); d = tagRows[j].depth; } });
          tagRows = tagRows.filter((row, i) => keep.has(i));
        }
        const propList = { key: 'ontology:properties', kind: 'group', name: 'Properties', tag: '', face: 'prop', rows: propNodes.map(plain) };
        if (!wide) return [{ key: 'ontology:tags', kind: 'group', name: 'Tags', tag: '', face: 'tag', rows: tagRows }, propList].filter(one => one.rows.length);
        const areas = [];   // each top tag with the tags under it
        for (const row of tagRows) { if (!row.depth || !areas.length) areas.push([]); areas[areas.length - 1].push(row); }
        return [...areas.map(rows => ({ key: `ontology:area:${rows[0].uuid}`, kind: 'group', name: '', tag: '', face: 'tag', rows })), propList].filter(one => one.rows.length);
      }, { few: 2000, none: 'No tags or properties of your own yet',
        press(row, event) {
          if (event.target.closest('.lk-words')) G.touch.open(row.dataset.uuid, event.shiftKey);
          else row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true });
          return true;
        },
        // As in any outline: Tab puts a tag under the tag above it at its level, Shift-Tab takes it out one level.
        key(row, event) {
          if (event.key === 'Enter' || event.key === ' ') { if (event.key === 'Enter') G.touch.open(row.dataset.uuid, event.shiftKey); return true; }   // nothing opens under the row
          if (event.key !== 'Tab' || !isTag(row)) return false;
          if (moving) waiting = [row.dataset.uuid, event.shiftKey]; else step(row.dataset.uuid, event.shiftKey);
          return true;
        },
        more(row, at) {
          if (!isTag(row)) return row.closest('.lk-list')?.dataset.face === 'prop'
            ? [{ gap: true }, { word: 'Move values…', take: async () => { const prop = [...(await G.read.properties()).values()].find(one => one.uuid === row.dataset.uuid); if (prop) G.moving.ask(holder, { from: prop.ident }); } }] : [];
          const uuid = row.dataset.uuid;
          const under = async () => {
            const tags = await G.read.tags(), tag = [...tags.values()].find(one => one.uuid === uuid);
            if (!tag) return;
            const below = G.find.under(tag.id, tags), others = new Map([...tags].filter(([id]) => !below.has(id)));
            G.menu(at, [{ group: `Put ${tag.title} under` }, ...G.find.tree(others).map(({ tag: one, depth }) => ({ word: one.title, depth, face: 'tag', on: tag.parents.includes(one.id), take: () => move(uuid, one.uuid) }))]);
          };
          return [{ gap: true }, { word: 'Show its nodes', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.arrive.find(tag.id); } },
            { word: 'Move values…', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.moving.ask(holder, { tag: { id: tag.id, title: tag.title } }); } },
            { word: 'Put under…', take: under },
            ...(depthOf(row) > 0 ? [{ word: 'Move to the top', take: () => move(uuid, '') }] : [])];
        } });
      let offSide = null;
      if (wide) {   // the outline beside a page you are reading: one press away
        const side = doc.createElement('button'); side.type = 'button'; side.className = 'lk-btn lk-low lk-side'; side.textContent = 'In the sidebar';
        const values = doc.createElement('button'); values.type = 'button'; values.className = 'lk-btn lk-low lk-values'; values.textContent = 'Move values…';
        const open = () => section.open(), ask = () => G.moving.ask(holder, {});
        side.addEventListener('click', open); values.addEventListener('click', ask); (holder.querySelector(':scope > .lk-add') || holder.firstElementChild).after(values, side);
        offSide = () => { side.removeEventListener('click', open); values.removeEventListener('click', ask); side.remove(); values.remove(); };
      }
      return () => { sized?.disconnect(); offSide?.(); offBar?.(); offAdd(); list.off(); };
    };
    const section = G.touch.section('lk-ontology', 'Ontology', holder => draw(holder, false), TREE);
    const page = G.touch.page('lk-ontology', 'Ontology', holder => draw(holder, true));
    base.onStop(section.off); base.onStop(page.off);
    G.touch.command('lk-ontology', 'Ontology', page.open);
    G.touch.command('lk-ontology-side', 'Ontology in the sidebar', section.open);
    G.touch.toolbar('lk-ontology', 'Ontology', TREE, page.open);
  },
});
})();
