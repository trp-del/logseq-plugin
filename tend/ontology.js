/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties by name, in a section of
   the right sidebar. A tag and a property are nodes like any other, so each row is the one line (node/line.js) and opens in
   place as Logseq's own page for it: its name is renamed there, the tag it sits under is changed there (Extends), a property's
   kind and what it takes are set there, all with Logseq's own controls and Logseq's own Undo. Nothing here writes. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags and properties, on a page of their own and as an outline in the right sidebar. Any of them opens in place to be renamed, moved or changed; a line at the top makes a new tag.',
  start(base) {
    base.style('ontology', `
.lk-ontology { padding: 4px 4px 16px 22px; }
.lk-ontology > .lk-rel { position: relative; }
.lk-page { padding: 0 0 48px; }
.lk-page-title { font-size: var(--ls-page-title-size, 2rem); font-weight: 600; line-height: 1.25; margin: 0 0 18px; color: var(--lk-text); }
.lk-map { --lk-ground: var(--lk-paper); padding-left: 22px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
.lk-map > .lk-add { order: 1; flex: 1 1 180px; max-width: 362px; position: static; }   /* on its own page the line that adds scrolls with the page */
.lk-map > .lk-values { order: 2; margin: 0 0 12px auto; }   /* the two presses stand beside the line where there is room, under it where there is not: never over it (found by hand) */
.lk-map > .lk-side { order: 3; margin-bottom: 12px; }
.lk-map > .lk-ask { order: 4; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { order: 5; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 40px 28px; align-items: start; padding-top: 16px; container-type: normal; }   /* as many areas beside each other as fit */
.lk-map > .lk-rel > .lk-list { container: lk-list / inline-size; min-width: 0; max-width: 340px; }
.lk-joins { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.lk-joins path { fill: none; stroke: var(--lk-line); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
.lk-ontology .lk-rel:has(> .lk-joins) .lk-list[data-face="tag"] .lk-row:not(.lk-joined) > .lk-line .lk-words { color: var(--lk-quiet); }`);
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
          await G.write.moveTag(uuid, to, tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean));
          writing = false;
        } catch (error) { done(); G.say(`The tag could not be moved: ${error?.message || 'Logseq refused'}`, 'warning'); }
      };
      const isTag = row => row.closest('.lk-list')?.dataset.face === 'tag';
      const depthOf = row => Number(row.style.getPropertyValue('--lk-depth')) || 0;
      // The nearest row above at a depth: the row's sibling (its own depth), its parent (one less), its parent's parent (two less).
      const above = (row, want) => { for (let at = row.previousElementSibling; at; at = at.previousElementSibling) { const d = depthOf(at); if (d === want) return at; if (d < want) return null; } return null; };
      /* The lines between tags. A tag is joined to another when its nodes hold, under one of your properties, nodes of the
         other. For the tag under the pointer or the keys, a hairline runs from its name to each tag it is joined with, clear of
         every name between them, with a small head at the tag that is held. Only that one tag's lines are drawn. */
      let ids = new Map(), lit = '', joins = [];
      const NS = 'http://www.w3.org/2000/svg';
      const lines = () => {
        rel.querySelector(':scope > .lk-joins')?.remove();
        for (const row of rel.querySelectorAll('.lk-row.lk-joined')) row.classList.remove('lk-joined');
        const me = ids.get(lit);
        if (!me) return;
        const rowOf = new Map([...rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows > .lk-row')].map(row => [ids.get(row.dataset.uuid), row]));
        const mine = joins.filter(([a, , b]) => a !== b && (a === me || b === me) && rowOf.has(a) && rowOf.has(b));
        if (!mine.length || !rowOf.has(me)) return;
        const frame = rel.getBoundingClientRect(), r = 5;
        const end = row => { const words = (row.querySelector(':scope > .lk-line .lk-words') || row).getBoundingClientRect(); return { x: words.right - frame.left + 8, y: words.top - frame.top + 13 }; };
        // Every joined row with its area; held: the lit tag holds it (the head stands at the tag that is held).
        const stops = [{ row: rowOf.get(me), held: mine.some(([a]) => a !== me) }, ...new Map(mine.map(([a, , b]) => [a === me ? b : a, { row: rowOf.get(a === me ? b : a), held: a === me }])).values()];
        const byArea = new Map();
        for (const stop of stops) { stop.at = end(stop.row); const area = stop.row.parentElement; if (!byArea.has(area)) byArea.set(area, []); byArea.get(area).push(stop); stop.row.classList.add('lk-joined'); }
        const svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('class', 'lk-joins'); svg.setAttribute('width', rel.scrollWidth); svg.setAttribute('height', rel.scrollHeight); svg.setAttribute('aria-hidden', 'true');
        const draw = d => { const path = doc.createElementNS(NS, 'path'); path.setAttribute('d', d); svg.appendChild(path); };
        const across = byArea.size > 1, trunks = [];
        for (const [area, here] of byArea) {
          const box = area.getBoundingClientRect(), band = box.top - frame.top - 10, ys = here.map(stop => stop.at.y), top = across ? band : Math.min(...ys), bottom = Math.max(...ys);
          // The trunk stands to the right of every name it passes, and never over the counts.
          let x = 0;
          for (const row of area.children) { const at = end(row); if (at.y >= top - 1 && at.y <= bottom + 1) x = Math.max(x, at.x); }
          x = Math.min(x + 14, box.right - frame.left - 34);
          for (const stop of here) {
            const first = !across && stop.at.y === top && top !== bottom, lastOne = stop.at.y === bottom && top !== bottom;
            draw(top === bottom && !across ? `M${stop.at.x} ${stop.at.y}H${x}` : first ? `M${stop.at.x} ${stop.at.y}H${x - r}Q${x} ${stop.at.y} ${x} ${stop.at.y + r}` : lastOne ? `M${stop.at.x} ${stop.at.y}H${x - r}Q${x} ${stop.at.y} ${x} ${stop.at.y - r}` : `M${stop.at.x} ${stop.at.y}H${x}`);
            if (stop.held) draw(`M${stop.at.x + 5} ${stop.at.y - 3.5}L${stop.at.x} ${stop.at.y}L${stop.at.x + 5} ${stop.at.y + 3.5}`);
          }
          if (top !== bottom) draw(`M${x} ${across ? top + r : top + r}V${bottom - r}`);
          if (across) trunks.push({ x, band });
        }
        // Areas side by side share the band above them; areas on different rows meet in the lane at the left edge.
        if (across) {
          const bands = [...new Set(trunks.map(trunk => Math.round(trunk.band)))].sort((a, b) => a - b), lane = -12;
          for (const band of bands) {
            const xs = trunks.filter(trunk => Math.round(trunk.band) === band).map(trunk => trunk.x), laned = bands.length > 1, least = Math.min(...xs), to = Math.max(...xs);
            // Each trunk turns into the band toward the others: the leftmost to the right, unless the band runs on to the lane.
            for (const x of xs) { const right = !laned && x === least && xs.length > 1; draw(`M${x} ${band + r}Q${x} ${band} ${right ? x + r : x - r} ${band}`); }
            const from = laned ? lane + r : least + r;
            if (to - r > from) draw(`M${from} ${band}H${to - r}`);
            if (bands.length > 1) draw(`M${lane + r} ${band}Q${lane} ${band} ${lane} ${band === bands[0] ? band + r : band - r}`);
          }
          if (bands.length > 1) draw(`M${lane} ${bands[0] + r}V${bands[bands.length - 1] - r}`);
        }
        rel.appendChild(svg);
      };
      const light = uuid => { if (uuid === lit) return; lit = uuid; lines(); };
      const onPoint = event => { const row = event.target.closest?.('.lk-list[data-face="tag"] > .lk-rows > .lk-row'); if (row && !row.dataset.open && row.closest('.lk-rel') === rel) light(row.dataset.uuid); };
      const onLeave = () => light(rel.contains(doc.activeElement) ? doc.activeElement.closest('.lk-row')?.dataset.uuid || '' : '');
      rel.addEventListener('pointerover', onPoint); rel.addEventListener('focusin', onPoint); rel.addEventListener('pointerleave', onLeave);
      rel.addEventListener('lk-drawn', () => lines());
      // One step in or out for a tag, worked out from where its row stands now.
      const step = (uuid, out) => {
        const row = rel.querySelector(`.lk-list[data-face="tag"] > .lk-rows > .lk-row[data-uuid="${uuid}"]`);
        if (!row) return;
        const d = depthOf(row);
        if (!out) { const to = above(row, d); if (to) move(uuid, to.dataset.uuid); }
        else if (d > 0) move(uuid, d > 1 ? above(row, d - 2)?.dataset.uuid || '' : '');
      };
      const list = G.node.listing(rel, async () => {
        const tags = await G.read.tags(), tree = G.find.tree(tags), props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
        const [tagNodes, propNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.byUuids(props.map(prop => prop.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.find.counts(tags, pairs), idOf = new Map(tree.map(row => [row.tag.uuid, row.tag.id]));
        ids = idOf; joins = await G.read.relations();
        const tagRows = tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(idOf.get(node.uuid)) || 0 }));
        const propList = { key: 'ontology:properties', kind: 'group', name: 'Properties', tag: '', face: 'prop', rows: propNodes.map(plain) };
        if (!wide) return [{ key: 'ontology:tags', kind: 'group', name: 'Tags', tag: '', face: 'tag', rows: tagRows }, propList].filter(one => one.rows.length);
        const areas = [];   // each top tag with the tags under it
        for (const row of tagRows) { if (!row.depth || !areas.length) areas.push([]); areas[areas.length - 1].push(row); }
        return [...areas.map(rows => ({ key: `ontology:area:${rows[0].uuid}`, kind: 'group', name: '', tag: '', face: 'tag', rows })), propList].filter(one => one.rows.length);
      }, { few: 2000, none: 'No tags or properties of your own yet',
        // As in any outline: Tab puts a tag under the tag above it at its level, Shift-Tab takes it out one level.
        key(row, event) {
          if (event.key !== 'Tab' || !isTag(row)) return false;
          if (moving) waiting = [row.dataset.uuid, event.shiftKey]; else step(row.dataset.uuid, event.shiftKey);
          return true;
        },
        more(row, at) {
          if (!isTag(row)) return row.closest('.lk-list')?.dataset.face === 'prop'
            ? [{ gap: true }, { word: 'Move values…', icon: G.touch.icon('arrows-right-left'), take: async () => { const prop = [...(await G.read.properties()).values()].find(one => one.uuid === row.dataset.uuid); if (prop) G.moving.ask(holder, { from: prop.ident }); } }] : [];
          const uuid = row.dataset.uuid;
          const under = async () => {
            const tags = await G.read.tags(), tag = [...tags.values()].find(one => one.uuid === uuid);
            if (!tag) return;
            const below = G.find.under(tag.id, tags), others = new Map([...tags].filter(([id]) => !below.has(id)));
            G.menu(at, [{ group: `Put ${tag.title} under` }, ...G.find.tree(others).map(({ tag: one, depth }) => ({ word: one.title, depth, face: 'tag', on: tag.parents.includes(one.id), take: () => move(uuid, one.uuid) }))]);
          };
          return [{ gap: true }, { word: 'Show its nodes', icon: G.touch.icon('search'), take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.arrive.find(tag.id); } },
            { word: 'Move values…', icon: G.touch.icon('arrows-right-left'), take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.moving.ask(holder, { tag: { id: tag.id, title: tag.title } }); } },
            { word: 'Put under…', icon: G.touch.icon('corner-down-right'), take: under },
            ...(depthOf(row) > 0 ? [{ word: 'Move to the top', icon: G.touch.icon('arrow-bar-to-up'), take: () => move(uuid, '') }] : [])];
        } });
      let offSide = null;
      if (wide) {   // the outline beside a page you are reading: one press away
        const side = doc.createElement('button'); side.type = 'button'; side.className = 'lk-btn lk-low lk-side'; side.textContent = 'In the sidebar';
        const values = doc.createElement('button'); values.type = 'button'; values.className = 'lk-btn lk-low lk-values'; values.textContent = 'Move values…';
        const open = () => section.open(), ask = () => G.moving.ask(holder, {});
        side.addEventListener('click', open); values.addEventListener('click', ask); (holder.querySelector(':scope > .lk-add') || holder.firstElementChild).after(values, side);
        offSide = () => { side.removeEventListener('click', open); values.removeEventListener('click', ask); side.remove(); values.remove(); };
      }
      return () => { offSide?.(); offAdd(); list.off(); };
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
