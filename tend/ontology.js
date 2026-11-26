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
.lk-ontology .lk-row.lk-chosen > .lk-line:is(:focus-visible, :hover) { background: var(--lk-wash); }   /* lit only where the keys or the pointer are: a row left chosen keeps its lines, not a wash (the owner's marked page, 26 Nov) */
.lk-ontology .lk-list[data-face="tag"] > .lk-rows > .lk-row[style*="--lk-depth: 0;"] .lk-words { font-weight: 600; }   /* a top tag heads its tree */
.lk-ontology .lk-line > .lk-num { margin-left: 8px; }   /* a tag's count right after its name */
.lk-ontology .lk-line .lk-words { cursor: pointer; }
.lk-page { padding: 0 0 48px; }
.lk-page-title { font-size: var(--ls-page-title-size, 2rem); font-weight: 600; line-height: 1.25; margin: 0 0 18px; color: var(--lk-text); }
.lk-map { --lk-ground: var(--lk-paper); padding-left: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
.lk-map > .lk-add { order: 1; flex: 1 1 180px; max-width: 362px; position: static; margin-left: 0; padding-left: 0; background: none; }   /* one line, no box: the same width as its underline */   /* on its own page the line that adds scrolls with the page */
.lk-map > .lk-values { order: 2; margin: 0 0 12px auto; }   /* the two presses stand beside the line where there is room, under it where there is not: never over it (found by hand) */
.lk-map > .lk-side { order: 3; margin-bottom: 12px; }
.lk-map > .lk-ask { order: 4; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { order: 5; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { display: grid; grid-template-columns: repeat(2, minmax(232px, 340px)); justify-content: space-between; gap: 56px 44px; align-items: start; padding: 34px 26px 0 0; margin-left: -18px; container-type: normal; }   /* one left edge: the title, the line that adds and the top tags' dots (the owner's marked page, 26 Nov) */   /* the columns are counted as the areas are drawn */
.lk-map > .lk-rel > .lk-list { container: lk-list / inline-size; min-width: 0; }
/* Properties under the tag trees, across the whole width in columns as the trees stand, its head a top tag's: never one run off the screen, and in the same place whatever the width. */
.lk-map > .lk-rel > .lk-list[data-face="prop"] { grid-column: 1 / -1; }
.lk-map > .lk-rel > .lk-list[data-face="prop"] > .lk-rows { columns: 232px; column-gap: 44px; }
.lk-map > .lk-rel > .lk-list[data-face="prop"] > .lk-rows > .lk-row { break-inside: avoid; }
.lk-ontology .lk-list[data-face="prop"] > .lk-list-head .lk-plain { font-weight: 600; color: var(--lk-text); }
.lk-map > .lk-rel > .lk-list[data-face="prop"] > .lk-list-head { margin-left: 0; }   /* its name on the dots' edge */
.lk-joins { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.lk-joins { color: var(--lk-text); }
.lk-joins path { fill: none; stroke: currentColor; stroke-opacity: .5; stroke-width: 1; }   /* a hairline in the quiet grey, in light and dark alike */
.lk-ontology:not(.lk-map) > .lk-rel { padding-right: 20px; }   /* room at the right for the bracket of a tag's lines */`);
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
        const n = Math.max(1, Math.min(rel.querySelectorAll(':scope > .lk-list[data-face="tag"]').length || 1, Math.floor((inner + gap) / (NARROW + gap)))), want = `repeat(${n}, minmax(${NARROW}px, ${WIDE}px))`;
        if (rel.style.gridTemplateColumns !== want) rel.style.gridTemplateColumns = want;
      };
      const lines = () => {
        columns();
        rel.querySelector(':scope > .lk-joins')?.remove();
        const me = ids.get(lit);
        if (!me) return;
        const near = G.tags.under(me, tagIndex), rowOf = new Map([...rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows > .lk-row')].map(row => [ids.get(row.dataset.uuid), row]));
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
      const list = G.node.listing(rel, async () => {
        const tags = await G.read.tags(), tree = G.tags.tree(tags), props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
        const [tagNodes, propNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.byUuids(props.map(prop => prop.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.tags.counts(tags, pairs), idOf = new Map(tree.map(row => [row.tag.uuid, row.tag.id]));
        ids = idOf; tagIndex = tags; joins = await G.read.relations();
        const tagRows = tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(idOf.get(node.uuid)) || 0 }));
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
            const below = G.tags.under(tag.id, tags), others = new Map([...tags].filter(([id]) => !below.has(id)));
            G.menu(at, [{ group: `Put ${tag.title} under` }, ...G.tags.tree(others).map(({ tag: one, depth }) => ({ word: one.title, depth, face: 'tag', on: tag.parents.includes(one.id), take: () => move(uuid, one.uuid) }))]);
          };
          return [{ gap: true }, { word: 'Show its nodes', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.arrive.search(tag.id); } },
            { word: 'Move values…', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.moving.ask(holder, { tag: { id: tag.id, title: tag.title } }); } },
            { word: 'Put under…', take: under },
            ...(depthOf(row) > 0 ? [{ word: 'Move to the top', take: () => move(uuid, '') }] : [])];
        } });
      let offSide = null;
      if (wide) {   // the outline beside a page you are reading: one press away
        const side = doc.createElement('button'); side.type = 'button'; side.className = 'lk-btn lk-side'; side.textContent = 'In the sidebar';
        const values = doc.createElement('button'); values.type = 'button'; values.className = 'lk-btn lk-values'; values.textContent = 'Move values…';
        const open = () => section.open(), ask = () => G.moving.ask(holder, {});
        side.addEventListener('click', open); values.addEventListener('click', ask); (holder.querySelector(':scope > .lk-add') || holder.firstElementChild).after(values, side);
        offSide = () => { side.removeEventListener('click', open); values.removeEventListener('click', ask); side.remove(); values.remove(); };
      }
      return () => { sized?.disconnect(); offSide?.(); offAdd(); list.off(); };
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
