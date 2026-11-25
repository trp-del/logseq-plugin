/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties by name, in a section of
   the right sidebar. A tag and a property are nodes like any other, so each row is the one line (node/line.js) and opens in
   place as Logseq's own page for it: its name is renamed there, the tag it sits under is changed there (Extends), a property's
   kind and what it takes are set there, all with Logseq's own controls and Logseq's own Undo. Nothing here writes. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags as an outline and your properties, in the right sidebar. Any of them opens in place to be renamed, moved or changed; a line at the top makes a new tag.',
  start(base) {
    base.style('ontology', `
.lk-ontology { padding: 4px 4px 16px 22px; }
.lk-ontology .lk-list[data-face="tag"] > .lk-rows { position: relative; }
.lk-joins { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.lk-joins path { fill: none; stroke: var(--lk-line); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
.lk-ontology .lk-rows:has(.lk-joins) > .lk-row:not(.lk-joined) > .lk-line .lk-words { color: var(--lk-quiet); }`);
    const section = G.touch.section('lk-ontology', 'Ontology', holder => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-ontology');
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
      const move = async (uuid, to) => {
        try {
          const tags = await G.read.tags(), tag = [...tags.values()].find(one => one.uuid === uuid);
          if (!tag || to === uuid) return;
          rel.addEventListener('lk-drawn', () => rel.querySelector(`.lk-row[data-uuid="${uuid}"] > .lk-line`)?.focus({ preventScroll: true }), { once: true });
          await G.write.moveTag(uuid, to, tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean));
        } catch (error) { G.say(`The tag could not be moved: ${error?.message || 'Logseq refused'}`, 'warning'); }
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
        const box = rel.querySelector('.lk-list[data-face="tag"] > .lk-rows');
        rel.querySelector('.lk-joins')?.remove();
        for (const row of rel.querySelectorAll('.lk-row.lk-joined')) row.classList.remove('lk-joined');
        const me = ids.get(lit);
        if (!box || !me) return;
        const rowOf = new Map([...box.children].map(row => [ids.get(row.dataset.uuid), row]));
        const mine = joins.filter(([a, , b]) => a !== b && (a === me || b === me) && rowOf.has(a) && rowOf.has(b));
        if (!mine.length) return;
        const frame = box.getBoundingClientRect(), end = row => { const words = (row.querySelector(':scope > .lk-line .lk-words') || row).getBoundingClientRect(); return { x: words.right - frame.left + 8, y: words.top - frame.top + 13 }; };
        const from = end(rowOf.get(me)), others = [...new Map(mine.map(([a, ident, b, n]) => [a === me ? b : a, { held: a === me, row: rowOf.get(a === me ? b : a) }])).values()];
        const top = Math.min(from.y, ...others.map(one => end(one.row).y)), bottom = Math.max(from.y, ...others.map(one => end(one.row).y));
        // The trunk stands to the right of every name it passes.
        let trunk = 0;
        for (const row of box.children) { const at = end(row); if (at.y >= top - 1 && at.y <= bottom + 1) trunk = Math.max(trunk, at.x); }
        trunk = Math.min(trunk + 14, frame.width - 34);
        const svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('class', 'lk-joins'); svg.setAttribute('width', frame.width); svg.setAttribute('height', box.scrollHeight); svg.setAttribute('aria-hidden', 'true');
        const r = 5, hook = (at, head) => {
          const dir = at.y < from.y ? 1 : -1, same = Math.abs(at.y - from.y) < 2;
          const path = doc.createElementNS(NS, 'path');
          path.setAttribute('d', same ? `M${at.x} ${at.y}H${trunk}` : `M${at.x} ${at.y}H${trunk - r}Q${trunk} ${at.y} ${trunk} ${at.y + dir * r}V${from.y - dir * r}Q${trunk} ${from.y} ${trunk - r} ${from.y}H${from.x}`);
          svg.appendChild(path);
          if (head) { const tip = doc.createElementNS(NS, 'path'); tip.setAttribute('d', `M${at.x + 5} ${at.y - 3.5}L${at.x} ${at.y}L${at.x + 5} ${at.y + 3.5}`); svg.appendChild(tip); }
        };
        for (const one of others) { hook(end(one.row), one.held); one.row.classList.add('lk-joined'); }
        const here = doc.createElementNS(NS, 'path'); here.setAttribute('d', `M${from.x} ${from.y}H${Math.min(from.x + 10, trunk)}`); svg.appendChild(here);
        if (others.some(one => !one.held)) { const tip = doc.createElementNS(NS, 'path'); tip.setAttribute('d', `M${from.x + 5} ${from.y - 3.5}L${from.x} ${from.y}L${from.x + 5} ${from.y + 3.5}`); svg.appendChild(tip); }
        rowOf.get(me).classList.add('lk-joined');
        box.appendChild(svg);
      };
      const light = uuid => { if (uuid === lit) return; lit = uuid; lines(); };
      const onPoint = event => { const row = event.target.closest?.('.lk-list[data-face="tag"] > .lk-rows > .lk-row'); if (row && !row.dataset.open) light(row.dataset.uuid); };
      const onLeave = () => light(rel.contains(doc.activeElement) ? doc.activeElement.closest('.lk-row')?.dataset.uuid || '' : '');
      rel.addEventListener('pointerover', onPoint); rel.addEventListener('focusin', onPoint); rel.addEventListener('pointerleave', onLeave);
      rel.addEventListener('lk-drawn', () => lines());
      const list = G.node.listing(rel, async () => {
        const tags = await G.read.tags(), tree = G.find.tree(tags), props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
        const [tagNodes, propNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.byUuids(props.map(prop => prop.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.find.counts(tags, pairs), idOf = new Map(tree.map(row => [row.tag.uuid, row.tag.id]));
        ids = idOf; joins = await G.read.relations();
        return [{ key: 'ontology:tags', kind: 'group', name: 'Tags', tag: '', face: 'tag', rows: tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(idOf.get(node.uuid)) || 0 })) },
          { key: 'ontology:properties', kind: 'group', name: 'Properties', tag: '', face: 'prop', rows: propNodes.map(plain) }].filter(one => one.rows.length);
      }, { few: 2000, none: 'No tags or properties of your own yet',
        // As in any outline: Tab puts a tag under the tag above it at its level, Shift-Tab takes it out one level.
        key(row, event) {
          if (event.key !== 'Tab' || !isTag(row)) return false;
          const d = depthOf(row);
          if (!event.shiftKey) { const to = above(row, d); if (to) move(row.dataset.uuid, to.dataset.uuid); }
          else if (d > 0) move(row.dataset.uuid, d > 1 ? above(row, d - 2)?.dataset.uuid || '' : '');
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
      return () => { offAdd(); list.off(); };
    }, TREE);
    base.onStop(section.off);
    G.touch.command('lk-ontology', 'Ontology', section.open);
    G.touch.toolbar('lk-ontology', 'Ontology', TREE, section.open);
  },
});
})();
