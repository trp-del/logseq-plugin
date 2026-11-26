/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties by name, in a section of
   the right sidebar. A tag and a property are nodes like any other, so each row is the one line (node/line.js) and opens in
   place as Logseq's own page for it: its name is renamed there, the tag it sits under is changed there (Extends), a property's
   kind and what it takes are set there, all with Logseq's own controls and Logseq's own Undo.
   Three tabs, as before the rebuild (the owner, 26 November 2026, "As before" and then "yes" to the old row of actions, tick
   boxes and tabs): Tags, Properties and History. Every row has a tick box; the row of actions under the tabs says what can be
   done with the ticked rows and waits faintly until it can be: for tags Merge…, Move up a level, Move under…, Rename and
   Delete (empty tags only), for properties Merge… and Rename. Each is written at once, through ground/write.js, and Logseq's
   own Undo takes it back (the faded arrow). History lists what was changed here, newest first, kept on this computer for 30
   days. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
const HISTORY = 'lk.ontology.history', DAYS30 = 30 * 864e5;
const TABS = [['tags', 'Tags', 'tag'], ['props', 'Properties', 'list'], ['history', 'History', 'history']];
const tabOf = { page: 'tags', side: 'tags' };   // the tab each place was left on, while Logseq runs
// What was changed here, by graph, newest first; each line its words as parts: [kind, text], kind '' (words), 'tag' or 'prop'.
const history = {
  all() { try { return JSON.parse(G.host().defaultView.localStorage.getItem(HISTORY) || '{}') || {}; } catch (error) { return {}; } },
  read(graph) { const now = Date.now(); return (this.all()[graph] || []).filter(one => now - one.when < DAYS30); },
  add(graph, said) {
    const all = this.all(); all[graph] = [{ when: Date.now(), said }, ...this.read(graph)].slice(0, 300);
    try { G.host().defaultView.localStorage.setItem(HISTORY, JSON.stringify(all)); } catch (error) { /* kept for this sitting only */ }
    for (const heard of listeners) heard();
  },
};
const listeners = new Set();
const saidHtml = said => said.map(([kind, text]) => kind ? `<span class="lk-${kind}">${G.esc(text)}</span>` : G.esc(text)).join('');
const names = (list, kind) => list.flatMap((one, i) => [...(i ? [['', i === list.length - 1 ? ' and ' : ', ']] : []), [kind, one]]);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags and properties, on a page of their own and as an outline in the right sidebar. A press on a name goes to its page; a press beside it shows the tag’s lines; a line at the top makes a new tag.',
  start(base) {
    base.style('ontology', `
.lk-ontology { padding: 4px 4px 16px 22px; }
.lk-ontology > .lk-rel { position: relative; }
.lk-ontology .lk-row > .lk-fold { visibility: hidden; }   /* nothing opens under a tag or a property here */
.lk-ontology .lk-row.lk-chosen > .lk-line:is(:focus-visible, :hover) { background: var(--lk-wash); }   /* lit only where the keys or the pointer are: a row left chosen keeps its lines, not a wash (the owner's marked page, 26 Nov) */
/* A row as Ontology drew it before the rebuild (the owner, 26 November 2026: "I prefer this line style of before and non bold for
   all of these.. there should also be line with bullets like normal"): the name at the small size and in no tag bold, the count in
   a column at the area's right edge, the rows close; a hairline from each tag's bullet down along the tags under it, as Logseq's
   own outline has. */
.lk-ontology .lk-list > .lk-rows > .lk-row .lk-words { font-size: var(--lk-small); font-weight: 400; }
.lk-ontology .lk-list > .lk-rows > .lk-row > .lk-line { padding-block: 1px; line-height: 24px; }
.lk-ontology .lk-line > .lk-num { margin-left: auto; padding-left: 12px; }
.lk-ontology .lk-list[data-face="tag"] > .lk-rows > .lk-row:not([style*="--lk-depth: 0;"]) { background: repeating-linear-gradient(90deg, transparent 0 11px, var(--lk-line) 11px 12px) 14px 0 / calc(var(--lk-depth, 0) * 12px) 100% no-repeat; }   /* one hairline under each tag the row sits under, through its bullet (25 px in, 12 a step) */
.lk-ontology .lk-line .lk-words { cursor: pointer; }
.lk-page { padding: 0 0 48px; }
.lk-page-title { font-size: var(--ls-page-title-size, 2rem); font-weight: 600; line-height: 1.25; margin: 0 0 18px; color: var(--lk-text); }
.lk-map { --lk-ground: var(--lk-paper); padding-left: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
.lk-map > .lk-add { order: 1; flex: 1 1 180px; max-width: 362px; position: static; margin-left: 0; padding-left: 0; background: none; }   /* one line, no box: the same width as its underline */   /* on its own page the line that adds scrolls with the page */
.lk-map > .lk-values { order: 2; margin: 0 0 12px auto; }   /* the two presses stand beside the line where there is room, under it where there is not: never over it (found by hand) */
.lk-map > .lk-side { order: 3; margin-bottom: 12px; }
.lk-map > .lk-ask { flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { order: 6; flex: 0 0 100%; min-width: 0; }
.lk-map > .lk-rel { display: grid; grid-template-columns: repeat(2, minmax(232px, 340px)); justify-content: space-between; gap: 56px 44px; align-items: start; padding: 26px 26px 0 20px; container-type: normal; }   /* one left edge: the title, the line that adds and the top tags' dots (the owner's marked page, 26 Nov) */   /* the columns are counted as the areas are drawn */
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
.lk-ontology:not(.lk-map) > .lk-rel { padding-right: 20px; }   /* room at the right for the bracket of a tag's lines */
/* The tabs, as before the rebuild: an icon and a word each, the one in force in the ink with a line under it (the library's tab). */
.lk-onto-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 24px; margin: 0 0 14px; font-size: var(--lk-line-size); }
.lk-onto-tabs > .lk-tab { display: inline-flex; align-items: center; gap: 6px; padding: 3px 0 7px; line-height: 1.35; }
.lk-onto-tabs > .lk-tab svg, .lk-onto-acts .lk-btn svg { width: 16px; height: 16px; flex: none; }
.lk-map > .lk-onto-tabs { order: 0; flex: 0 0 100%; }
.lk-ontology:not([data-tab="tags"]) > .lk-add { display: none; }
.lk-ontology[data-tab="history"] > :is(.lk-values, .lk-side, .lk-rel, .lk-onto-acts, .lk-ask) { display: none; }
.lk-ontology:not([data-tab="history"]) > .lk-history { display: none; }
/* The row of actions: what the ticked rows can take, each press waiting faintly until it can be pressed (disabled). */
.lk-onto-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin: 2px 0 10px; font-size: var(--lk-line-size); }
.lk-map > .lk-onto-acts { order: 4; flex: 0 0 100%; margin-left: -8px; }
.lk-onto-acts > .lk-said { margin: 0 8px; white-space: nowrap; }
.lk-onto-acts > .lk-btn { gap: 8px; }
.lk-onto-acts > .lk-onto-del { color: var(--lk-going); }
.lk-onto-acts > .lk-pick-x { padding: 4px 6px; }
/* A tick box on every row, in one column at the area's left edge whatever the row's depth, faint until ticked or pointed at
   (as before the rebuild: the owner, 17 November 2026, found nothing on the map looked tickable when the boxes were hidden). */
.lk-ontology .lk-rows > .lk-row { position: relative; }
.lk-ontology .lk-rows > .lk-row > input.lk-tick[type=checkbox] { position: absolute; grid-area: auto; left: -20px; top: 0; margin: 7px 0 0; opacity: .55; }   /* grid-area auto: placed against the row's own edge, not its indented column */
.lk-ontology .lk-rows > .lk-row > input.lk-tick[type=checkbox]:is(:checked, :hover, :focus-visible) { opacity: 1; }
.lk-ontology .lk-rel { padding-left: 20px; }
/* A name renamed in place: the line gives way to a field with the name in it. */
.lk-row.lk-renaming > .lk-line { display: none; }
.lk-row > .lk-rename { grid-column: 2 / -1; box-sizing: border-box; width: auto; min-width: 0; height: var(--lk-line-h); margin: 0 0 0 calc(var(--lk-mark-box) + var(--lk-mark-gap)); padding: 0; border: 0; border-bottom: 1px solid var(--lk-text); border-radius: 0; background: none; box-shadow: none; outline: 0; color: var(--lk-text); font-size: var(--lk-words-size); }   /* the name where it stood, underlined while it is written, as before */
.lk-list[data-face="tag"] .lk-row > .lk-rename { font-family: var(--lk-tag-face); }
.lk-list[data-face="prop"] .lk-row > .lk-rename { font-family: var(--lk-prop-face); font-size: var(--lk-prop-size); }
/* The merge, said once before it is made: the tags as tags, a few nodes as they will read. */
.lk-ask .lk-tag { font-family: var(--lk-tag-face); }
.lk-ask .lk-tag.lk-going { color: var(--lk-going); text-decoration: line-through; text-decoration-thickness: 1.5px; }   /* what goes, struck through in red, as anywhere a change is shown */
.lk-ask .lk-tag.lk-coming { color: var(--lk-coming); }
.lk-onto-acts > [data-act="merge"] svg { transform: rotate(180deg); }   /* two into one, downward, as the old mark had it */
.lk-ask .lk-merge-node { text-decoration: underline; text-decoration-color: var(--lk-link); text-underline-offset: 3px; }
.lk-map > .lk-ask { order: 5; }
.lk-ontology:not([data-tab="tags"]):not([data-tab="props"]) > .lk-merge { display: none; }
/* History: what was changed here, newest first. */
.lk-history { display: flex; flex-direction: column; gap: 6px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-map > .lk-history { order: 7; flex: 0 0 100%; }
.lk-history-line { display: flex; gap: 16px; align-items: baseline; }
.lk-history-when { flex: none; min-width: 7.5em; color: var(--lk-quiet); font-variant-numeric: tabular-nums; }
.lk-history .lk-tag { font-family: var(--lk-tag-face); }
.lk-history .lk-prop { color: var(--lk-text); }`);
    /* One drawing for both places. In the sidebar: one outline. On the page: every top tag an area of its own, side by side,
       so the lines between tags run in the gaps and over the band above the areas. */
    const draw = (holder, wide) => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-ontology'); holder.classList.toggle('lk-map', wide);
      const place = wide ? 'page' : 'side';
      holder.dataset.tab = tabOf[place];
      holder.innerHTML = `<div class="lk-onto-tabs" role="tablist"></div><div class="lk-onto-acts"></div><div class="lk-rel"></div><div class="lk-history"></div>`;
      const tabsEl = holder.firstElementChild, acts = tabsEl.nextElementSibling, history_ = holder.lastElementChild;
      // A new tag is made at the top; opened in place, Logseq's own page for it puts it under another.
      const offAdd = G.node.adder(holder, 'New tag', async name => {
        const there = [...(await G.read.tags()).values()].find(tag => tag.title.trim().toLowerCase() === name.toLowerCase());
        return there ? there.uuid : G.write.newTag(name);
      }, 'The tag could not be made');
      const plain = node => ({ ...node, tag: '', tagShown: false, dayShown: 0, day: 0 });
      const rel = holder.querySelector(':scope > .lk-rel');
      tabsEl.after(holder.querySelector(':scope > .lk-add'));   // the line that adds stands under the tabs
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
          const under = [...tags.values()].find(one => one.uuid === to);
          did(under ? [['', 'Moved '], ['tag', tag.title], ['', ' under '], ['tag', under.title]] : [['', 'Moved '], ['tag', tag.title], ['', ' to the top']]);
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
      // ---- what each tab lists, and the rows ticked in it
      const picked = { tags: new Set(), props: new Set() };
      let info = new Map();   // uuid -> { title, id, count, depth, parents, kids } of each row drawn, as last read
      const pickedNow = () => holder.dataset.tab === 'props' ? picked.props : picked.tags;
      const read = async () => {
        const tab = holder.dataset.tab;
        if (tab === 'history') return [];
        const tags = await G.read.tags(), tree = G.tags.tree(tags);
        ids = new Map(tree.map(row => [row.tag.uuid, row.tag.id])); tagIndex = tags;
        if (tab === 'props') {
          const props = [...(await G.read.properties()).values()].sort((a, b) => a.title.localeCompare(b.title));
          const [propNodes, held] = await Promise.all([G.read.byUuids(props.map(prop => prop.uuid)), G.read.propertyCounts().catch(() => new Map())]);
          const rows = propNodes.map(node => ({ ...plain(node), count: held.get(String(node.uuid).toLowerCase()) || 0 }));   // each with how many nodes hold it, as a tag says its nodes
          info = new Map(rows.map(row => [row.uuid, { title: props.find(prop => prop.uuid === row.uuid)?.title || '', count: row.count }]));
          for (const uuid of [...picked.props]) if (!info.has(uuid)) picked.props.delete(uuid);
          return rows.length ? [{ key: 'ontology:properties', kind: 'group', name: '', tag: '', face: 'prop', rows }] : [];
        }
        const [tagNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.tags.counts(tags, pairs);
        joins = await G.read.relations();
        const tagRows = tagNodes.map(node => ({ ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(ids.get(node.uuid)) || 0 }));
        info = new Map(tree.map(({ tag, depth: d }) => [tag.uuid, { title: tag.title, id: tag.id, count: counts.get(tag.id) || 0, depth: d, parents: tag.parents, kids: [...tags.values()].some(one => one.parents.includes(tag.id)) }]));
        for (const uuid of [...picked.tags]) if (!info.has(uuid)) picked.tags.delete(uuid);
        if (!wide) return tagRows.length ? [{ key: 'ontology:tags', kind: 'group', name: '', tag: '', face: 'tag', rows: tagRows }] : [];
        const areas = [];   // each top tag with the tags under it
        for (const row of tagRows) { if (!row.depth || !areas.length) areas.push([]); areas[areas.length - 1].push(row); }
        return areas.map(rows => ({ key: `ontology:area:${rows[0].uuid}`, kind: 'group', name: '', tag: '', face: 'tag', rows }));
      };
      const opts = { few: 2000,
        ticks: { on: () => holder.dataset.tab !== 'history', has: uuid => pickedNow().has(uuid), flip(uuid, row, on) { if (on) pickedNow().add(uuid); else pickedNow().delete(uuid); bar(); } },
        press(row, event) {
          if (event.target.closest('.lk-words')) G.touch.open(row.dataset.uuid, event.shiftKey);
          else row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true });
          return true;
        },
        // As in any outline: Tab puts a tag under the tag above it at its level, Shift-Tab takes it out one level. Space ticks.
        key(row, event) {
          if (event.key === ' ') { const set = pickedNow(), uuid = row.dataset.uuid; if (!set.delete(uuid)) set.add(uuid); const tick = row.querySelector(':scope > .lk-tick'); if (tick) tick.checked = set.has(uuid); row.classList.toggle('lk-picked', set.has(uuid)); bar(); return true; }
          if (event.key === 'Escape' && pickedNow().size) { clear(); return true; }
          if (event.key === 'Enter') { G.touch.open(row.dataset.uuid, event.shiftKey); return true; }   // nothing opens under the row
          if (event.key !== 'Tab' || !isTag(row)) return false;
          if (moving) waiting = [row.dataset.uuid, event.shiftKey]; else step(row.dataset.uuid, event.shiftKey);
          return true;
        },
        more(row, at) {
          if (!isTag(row)) return row.closest('.lk-list')?.dataset.face === 'prop'
            ? [{ gap: true }, { word: 'Move values…', take: async () => { const prop = [...(await G.read.properties()).values()].find(one => one.uuid === row.dataset.uuid); if (prop) G.moving.ask(holder, { from: prop.ident }); } }] : [];
          const uuid = row.dataset.uuid;
          return [{ gap: true }, { word: 'Show its nodes', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.arrive.search(tag.id); } },
            { word: 'Move values…', take: async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.moving.ask(holder, { tag: { id: tag.id, title: tag.title } }); } },
            { word: 'Move under…', take: () => under(at, [uuid]) },   // the same word and the same list as the row of actions
            ...(depthOf(row) > 0 ? [{ word: 'Move to the top', take: () => move(uuid, '') }] : [])];
        } };
      const NONE = { tags: 'No tags of your own yet', props: 'No properties of your own yet', history: '' };
      let list = G.node.listing(rel, read, { ...opts, none: NONE[holder.dataset.tab] });

      // ---- the tabs
      const tabs = () => {
        const html = TABS.map(([key, word, icon]) => `<button type="button" class="lk-tab${holder.dataset.tab === key ? ' on' : ''}" data-kind="" data-tab="${key}" role="tab" aria-selected="${holder.dataset.tab === key}">${G.touch.icon(icon, 16)}${word}</button>`).join('');
        if (tabsEl.lkHtml !== html) { tabsEl.innerHTML = html; tabsEl.lkHtml = html; }
      };
      const show = tab => {
        if (tab === holder.dataset.tab) return;
        tabOf[place] = holder.dataset.tab = tab;
        holder.querySelector(':scope > .lk-merge')?.remove();
        tabs(); list.off(); list = G.node.listing(rel, read, { ...opts, none: NONE[tab] }); lit = ''; lines(); bar(); past();
      };
      tabsEl.addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) show(tab.dataset.tab); });

      // ---- the row of actions: what the ticked rows can take, faint until it can be pressed
      const ICON = { merge: 'arrow-merge', up: 'arrow-up', under: 'corner-down-right', rename: 'pencil', delete: 'trash' };
      const press = (act, word, can, title = '', cls = '') => `<button type="button" class="lk-btn lk-low${cls}" data-act="${act}"${can ? '' : ' disabled'}${title ? ` title="${G.esc(title)}"` : ''}>${G.touch.icon(ICON[act], 16)}${G.esc(word)}</button>`;
      const bar = () => {
        const tab = holder.dataset.tab, set = pickedNow(), n = set.size;
        let html = '';
        if (tab === 'tags') {
          const rows = [...set].map(uuid => info.get(uuid)).filter(Boolean), top = rows.every(one => !one.parents.length), empty = n > 0 && rows.every(one => !one.count && !one.kids);
          html = `<b class="lk-said">${n ? `${plural(n, 'tag')} picked` : 'Tick tags, then'}</b>` + press('merge', 'Merge…', n > 1, n > 1 ? '' : 'Tick two or more to merge them')
            + press('up', 'Move up a level', n > 0 && !top, n && top ? 'Already at the top' : '') + press('under', 'Move under…', n > 0)
            + press('rename', 'Rename', n === 1) + press('delete', 'Delete', empty, n && !empty ? 'Only a tag with no nodes and no child tags can be deleted: merge the others' : '', ' lk-onto-del');
        } else if (tab === 'props') {
          html = `<b class="lk-said">${n ? `${plural(n, 'property', 'properties')} picked` : 'Tick properties, then'}</b>` + press('merge', 'Merge…', n > 1, n > 1 ? '' : 'Tick two or more to merge them') + press('rename', 'Rename', n === 1);
        }
        if (html && n) html += `<button type="button" class="lk-btn lk-low lk-pick-x" data-act="clear" aria-label="Let them go" title="Let them go">${G.touch.icon('x', 14)}</button>`;
        if (acts.lkHtml !== html) { acts.innerHTML = html; acts.lkHtml = html; }
      };
      const clear = () => { pickedNow().clear(); for (const row of rel.querySelectorAll('.lk-row.lk-picked')) { row.classList.remove('lk-picked'); const tick = row.querySelector(':scope > .lk-tick'); if (tick) tick.checked = false; } bar(); };
      const graph = () => G.read.graph().catch(() => '');
      const did = async said => history.add(await graph(), said);
      let busy = false;
      const once_ = async (what, work) => {
        if (busy) return;
        busy = true; acts.toggleAttribute('data-busy', true);
        try { await work(); } catch (error) { G.say(`${what}: ${error?.message || 'Logseq refused'}`, 'warning'); }
        busy = false; acts.removeAttribute('data-busy'); G.read.forget(); list.again();
      };
      const fresh = async () => { G.read.forget(); const tags = await G.read.tags(); return { tags, byUuid: new Map([...tags.values()].map(tag => [tag.uuid, tag])) }; };
      // Up one level: from under its tag to under that tag's own, or to the top.
      const up = uuids => once_('It could not be moved', async () => {
        const { tags, byUuid } = await fresh();
        let steps = 0, last = '';
        const moved = [];
        for (const uuid of uuids) {
          const tag = byUuid.get(uuid), parent = tag && tags.get(tag.parents[0]);
          if (!parent) continue;
          const to = parent.parents[0] ? tags.get(parent.parents[0])?.uuid || '' : '';
          steps += await G.write.moveTag(uuid, to, tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean)); last = uuid; moved.push(tag.title);
        }
        clear();
        if (!steps) return;
        G.undo.mark(last, steps);
        did([['', 'Moved '], ...names(moved, 'tag'), ['', ' up a level']]);
      });
      // Under a tag chosen from the whole tree, or to the top. The picked tags, and the tags under them, are not offered.
      const under = async (at, uuids) => {
        const { tags, byUuid } = await fresh(), moving_ = uuids.map(uuid => byUuid.get(uuid)).filter(Boolean);
        if (!moving_.length) return;
        const below = new Set(moving_.flatMap(tag => [...G.tags.under(tag.id, tags)])), others = new Map([...tags].filter(([id]) => !below.has(id)));
        const to = target => once_('It could not be moved', async () => {
          const now = await fresh();
          let steps = 0, last = '';
          for (const tag of moving_) { const was = now.byUuid.get(tag.uuid); if (!was || (target ? was.parents.length === 1 && now.tags.get(was.parents[0])?.uuid === target.uuid : !was.parents.length)) continue; steps += await G.write.moveTag(tag.uuid, target?.uuid || '', was.parents.map(id => now.tags.get(id)?.uuid).filter(Boolean)); last = tag.uuid; }
          clear();
          if (!steps) return;
          G.undo.mark(last, steps);
          did(target ? [['', 'Moved '], ...names(moving_.map(tag => tag.title), 'tag'), ['', ' under '], ['tag', target.title]] : [['', 'Moved '], ...names(moving_.map(tag => tag.title), 'tag'), ['', ' to the top']]);
        });
        const one = moving_.length === 1 ? moving_[0] : null;
        G.menu(at, [{ group: one ? `Move ${one.title} under` : `Move ${moving_.length} picked tags under` }, ...G.tags.tree(others).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: !!one && one.parents.includes(tag.id), take: () => to(tag) })),
          { gap: true }, { word: 'The top', take: () => to(null) }], { find: 'A tag' });
      };
      // The name in place: the row's line gives way to a field; Enter writes it, Escape or a press elsewhere leaves it.
      const rename = uuid => {
        const row = rel.querySelector(`.lk-rows > .lk-row[data-uuid="${uuid}"]`), was = info.get(uuid)?.title || '';
        if (!row || row.querySelector(':scope > .lk-rename')) return;
        const field = doc.createElement('input'); field.type = 'text'; field.className = 'lk-field lk-rename'; field.value = was; field.spellcheck = false; field.setAttribute('aria-label', `New name for ${was}`);
        row.classList.add('lk-renaming'); row.appendChild(field); field.focus(); field.select();
        const kind = isTag(row) ? 'tag' : 'prop';
        let gone = false;
        const leave = () => { if (gone) return; gone = true; field.remove(); row.classList.remove('lk-renaming'); };
        field.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); leave(); row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true }); }
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const name = field.value.trim();
          leave();
          if (!name || name === was) return;
          once_('It could not be renamed', async () => { await G.undo.after(uuid, G.write.rename(uuid, name)); clear(); did([['', 'Renamed '], [kind, was], ['', ' to '], [kind, name]]); });
        });
        for (const type of ['click', 'mousedown', 'contextmenu']) field.addEventListener(type, event => event.stopPropagation());
        field.addEventListener('blur', leave);
      };
      // Deleted after a red yes: only tags with no nodes and no child tags, which take nothing with them.
      const remove = uuids => {
        const rows = uuids.map(uuid => [uuid, info.get(uuid)]).filter(([, one]) => one && !one.count && !one.kids), row = rows[0] && rel.querySelector(`.lk-rows > .lk-row[data-uuid="${rows[0][0]}"]`);
        if (!row) return;
        G.ask.gone(row, { words: rows.length === 1 ? `Delete ${rows[0][1].title}?` : `Delete ${rows.length} tags?`, note: rows.length === 1 ? 'It has no nodes and no child tags.' : 'They have no nodes and no child tags.', yes: 'Delete',
          take: () => once_('It could not be deleted', async () => {
            let steps = 0;
            for (const [uuid] of rows) { await G.write.remove(uuid, true); steps++; }
            clear(); G.undo.mark(rows[0][0], steps);
            did([['', 'Deleted '], ...names(rows.map(([, one]) => one.title), 'tag')]);
          }) });
      };
      acts.addEventListener('click', event => {
        const at = event.target.closest('[data-act]');
        if (!at || at.disabled || busy) return;
        const act = at.dataset.act, uuids = [...pickedNow()], tab = holder.dataset.tab;
        if (act === 'clear') clear();
        else if (act === 'up') up(uuids);
        else if (act === 'under') under(at, uuids);
        else if (act === 'rename') rename(uuids[0]);
        else if (act === 'delete') remove(uuids);
        else if (act === 'merge') (tab === 'props' ? mergeProps : mergeTags)(uuids).catch(error => G.say(`The merge could not be read: ${error?.message || 'Logseq refused'}`, 'warning'));
      });

      // ---- a merge, said once before it is made (the owner, 24 November 2026, of the box before: "Confusing")
      const box = () => { let el = holder.querySelector(':scope > .lk-merge'); if (!el) { el = doc.createElement('div'); el.className = 'lk-ask lk-merge'; acts.after(el); } return el; };
      const ask = (html, keys) => {
        const el = box(); el.dataset.asking = 'merge'; el.innerHTML = html;
        const close = () => { el.removeEventListener('keydown', onKey); el.onclick = null; delete el.dataset.asking; el.remove(); };
        const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } else if (event.key === 'Enter' && !event.target.matches('button')) { event.preventDefault(); keys.yes?.(); } };
        el.addEventListener('keydown', onKey);
        el.onclick = event => { const does = event.target.closest('[data-do]')?.dataset.do; if (does === 'leave') close(); else if (does && keys[does]) keys[does](event.target.closest('[data-do]')); };
        el.querySelector('[data-do="yes"]:not([disabled])')?.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
        return close;
      };
      const answers = (yes, can, other) => `<div class="lk-answers"><button type="button" class="lk-accent" data-do="yes"${can ? '' : ' disabled'}>${G.esc(yes)}</button><button type="button" class="lk-btn" data-do="leave">Cancel</button>${other ? `<button type="button" class="lk-btn lk-low" data-do="other">${G.esc(other)}</button>` : ''}</div>`;
      const wordsOf = async nodes => { const named = await G.read.names(nodes.flatMap(node => G.words.named(G.words.firstLine(node.words).line))); return node => G.words.plain(G.words.firstLine(node.words).line, named) || 'Untitled'; };
      // Tags: the one with the most nodes is kept unless another is chosen; the others' nodes, child tags, properties, the
      // values and links that point at them and the bullets on their pages go to it, and then they are deleted.
      const mergeTags = async uuids => {
        const { tags, byUuid } = await fresh(), chosen = uuids.map(uuid => byUuid.get(uuid)).filter(Boolean);
        if (chosen.length < 2) return;
        const reach = new Map(await Promise.all(chosen.map(async tag => [tag.uuid, await G.read.reach(tag.id)])));
        chosen.sort((a, b) => reach.get(b.uuid).tagged.length - reach.get(a.uuid).tagged.length || a.title.localeCompare(b.title));
        let kept = chosen[0];
        const draw_ = async () => {
          const gone = chosen.filter(tag => tag !== kept), nodes = await G.read.byUuids(gone.flatMap(tag => reach.get(tag.uuid).tagged).slice(0, 4)), say = await wordsOf(nodes);
          const n = new Set(gone.flatMap(tag => reach.get(tag.uuid).tagged)).size, goneOf = uuid => gone.find(tag => reach.get(tag.uuid).tagged.includes(uuid));
          const close = ask(`<div class="lk-ask-head">Merge ${saidHtml(names(gone.map(tag => tag.title), 'tag'))} into <span class="lk-tag">${G.esc(kept.title)}</span></div>
${nodes.length ? `<div class="lk-ask-rows">${nodes.map(node => `<div class="lk-ask-line"><span class="lk-merge-node">${G.esc(say(node))}</span> <span class="lk-tag lk-going">${G.esc(goneOf(node.uuid)?.title || '')}</span> <span class="lk-tag lk-coming">${G.esc(kept.title)}</span></div>`).join('')}</div>` : ''}
<div class="lk-ask-note">${plural(n, 'node')} · links to the ${gone.length === 1 ? 'tag follow' : 'tags follow'}</div>${answers('Merge', true, chosen.length === 2 ? 'Keep the other name' : 'Keep another name…')}`, {
            other: at => { if (chosen.length === 2) { kept = chosen.find(tag => tag !== kept); draw_(); } else G.menu(at, chosen.map(tag => ({ word: tag.title, face: 'tag', on: tag === kept, take: () => { kept = tag; draw_(); } }))); },
            yes: () => { close(); once_('The tags could not all be merged', async () => {
              let steps = 0;
              for (const tag of gone) steps += await mergeTag(tag, kept);
              clear(); G.undo.mark(kept.uuid, steps);
              did([['', 'Merged '], ...names(gone.map(one => one.title), 'tag'), ['', ' into '], ['tag', kept.title]]);
            }); },
          });
        };
        await draw_();
      };
      // One tag merged into another; answers how many steps of Logseq's Undo it took.
      const mergeTag = async (gone, kept) => {
        let steps = 0;
        const { props } = await G.read.schema(), r = await G.read.reach(gone.id), link = new RegExp(`\\[\\[${gone.uuid}\\]\\]`, 'gi');
        for (const one of r.named) { const words = one.words.replace(link, `[[${kept.uuid}]]`); if (words !== one.words) { await G.write.setWords(one.uuid, words); steps++; } }   // links in the words follow
        for (const one of r.held) { const raws = [...new Set(one.raws.map(raw => raw === gone.id ? kept.id : raw))], prop = props.get(one.ident); await G.write.setValues(one.uuid, one.ident, raws, { ref: true, many: !!prop?.many }); steps += raws.length ? 2 : 1; }
        for (const one of r.ranges) { await G.write.range(one.uuid, [...new Set(one.ids.map(id => id === gone.id ? kept.id : id))]); steps++; }
        G.read.forget();
        const now = await G.read.reach(gone.id), has = new Set((await G.read.reach(kept.id)).tagged);
        for (const uuid of now.tagged) { if (!has.has(uuid)) { await G.write.tag(uuid, kept.uuid); steps++; } await G.write.untag(uuid, gone.uuid); steps++; }
        const keptProps = (await G.read.reach(kept.id)).props, more = now.props.filter(id => !keptProps.includes(id));
        if (more.length) { await G.write.tagProperties(kept.uuid, [...keptProps, ...more]); steps++; }
        G.read.forget();
        const tags = await G.read.tags(), keptTag = tags.get(kept.id), goneTag = tags.get(gone.id);
        for (const kid of [...tags.values()].filter(one => one.parents.includes(gone.id))) {
          if (kid.id === kept.id) steps += await G.write.moveTag(kept.uuid, goneTag.parents[0] && goneTag.parents[0] !== kept.id ? tags.get(goneTag.parents[0])?.uuid || '' : '', [gone.uuid]);   // the kept tag stood under the other: it takes its place
          else steps += await G.write.moveTag(kid.uuid, kid.parents.includes(kept.id) || G.tags.under(kid.id, tags).has(kept.id) ? '' : keptTag.uuid, [gone.uuid]);
        }
        for (const uuid of now.bullets) { await G.write.toPage(uuid, kept.uuid); steps++; }
        await G.write.remove(gone.uuid, true); steps++;
        return steps;
      };
      // Properties: the one most nodes hold is kept unless another is chosen; the others' values go into it (a node it would give
      // a second value to, where it takes one, keeps its own) and the tags that gave them give it. The merged property stays, empty,
      // as before the rebuild: a property deleted and brought back by Logseq's Undo comes back as another item, and what pointed
      // at it would not follow (found by hand, 26 November 2026).
      const mergeProps = async uuids => {
        const [{ props: schema, byTag }, all] = await Promise.all([(G.read.forget(), G.read.schema()), G.read.properties()]);
        const chosen = uuids.map(uuid => [...all.values()].find(prop => prop.uuid === uuid)).filter(Boolean).map(prop => schema.get(prop.ident) && { ...schema.get(prop.ident), uuid: prop.uuid });
        if (chosen.length < 2 || chosen.some(prop => !prop)) return;
        const holders = new Map(await Promise.all(chosen.map(async prop => [prop.ident, await G.read.holders(prop.ident)])));
        chosen.sort((a, b) => holders.get(b.ident).length - holders.get(a.ident).length || a.title.localeCompare(b.title));
        let kept = chosen[0];
        const planOf = gone => { const into = new Map(holders.get(kept.ident).map(node => [node.id, node.values])); return G.move.plan({ nodes: holders.get(gone.ident).map(node => ({ uuid: node.uuid, words: node.words, from: node.values, into: into.get(node.id) || [] })), from: gone, into: kept, remove: true }); };
        const draw_ = async () => {
          const gone = chosen.filter(prop => prop !== kept), plans = gone.map(prop => [prop, planOf(prop)]), refused = plans.find(([, made]) => made.refused && made.rows.length === 0 && made.refused.includes('different'))?.[1].refused || '';
          const rows = plans.flatMap(([prop, made]) => made.rows.filter(row => !row.skip).map(row => ({ prop, row }))), kept_ = plans.reduce((n, [, made]) => n + made.kept, 0);
          const nodes = await G.read.byUuids(rows.slice(0, 4).map(one => one.row.uuid)), say = await wordsOf(nodes), few = (values, cls) => values.map(value => `<span class="${cls}">${G.esc(value.text || '—')}</span>`).join(', ');
          const close = ask(`<div class="lk-ask-head">Merge ${saidHtml(names(gone.map(prop => prop.title), 'prop'))} into <span class="lk-prop">${G.esc(kept.title)}</span></div>
${!refused && rows.length ? `<div class="lk-ask-rows">${rows.slice(0, 4).map(({ prop, row }, i) => `<div class="lk-ask-row"><div class="lk-ask-words">${G.esc(nodes[i] ? say(nodes[i]) : row.words || 'Untitled')}</div><div><span class="lk-prop">${G.esc(prop.title)}</span> ${few(row.goes, 'lk-going')}</div><div><span class="lk-prop">${G.esc(kept.title)}</span> ${[few(row.stays, ''), few(row.comes, 'lk-coming')].filter(Boolean).join(', ') || '—'}</div></div>`).join('')}${rows.length > 4 ? `<div class="lk-ask-more">and ${rows.length - 4} more</div>` : ''}</div>` : ''}
<div class="lk-ask-note">${refused ? G.esc(refused) : `${plural(rows.length, 'node')}${kept_ ? ` · ${plural(kept_, 'node')} ${kept_ === 1 ? 'keeps its' : 'keep their'} own, as ${G.esc(kept.title)} takes one value` : ''}`}</div>${answers('Merge', !refused, chosen.length === 2 ? 'Keep the other name' : 'Keep another name…')}`, {
            other: at => { if (chosen.length === 2) { kept = chosen.find(prop => prop !== kept); draw_(); } else G.menu(at, chosen.map(prop => ({ word: prop.title, face: 'prop', on: prop === kept, take: () => { kept = prop; draw_(); } }))); },
            yes: () => { if (refused) return; close(); once_('The properties could not all be merged', async () => {
              let steps = 0;
              const REF = kept.type === 'node' || kept.type === 'date', had = new Map(holders.get(kept.ident).map(node => [node.uuid, node.values.length]));
              for (const [prop, made] of plans) {
                for (const row of made.rows.filter(one => !one.skip)) {
                  if (row.comes.length) { const fresh_ = !had.get(row.uuid); await G.write.setValues(row.uuid, kept.ident, [...row.stays, ...row.comes].map(value => value.raw), { ref: REF, many: kept.many, fresh: fresh_ }); steps += fresh_ ? 1 : 2; had.set(row.uuid, 1); }
                  await G.write.setValues(row.uuid, prop.ident, [], {}); steps++;
                }
                // The tags that gave the merged property give the kept one.
                for (const [tagId, idents] of byTag) if (idents.includes(prop.ident)) {
                  const tag = tagIndex.get(tagId), now = (await G.read.reach(tagId)).props, keptId = (await G.read.node(kept.uuid))?.id, propId = (await G.read.node(prop.uuid))?.id;
                  if (!tag || !keptId) continue;
                  await G.write.tagProperties(tag.uuid, [...new Set(now.filter(id => id !== propId).concat(keptId))]); steps++;
                }
              }
              clear(); G.undo.mark(kept.uuid, steps);
              did([['', 'Merged '], ...names(gone.map(one => one.title), 'prop'), ['', ' into '], ['prop', kept.title]]);
            }); },
          });
        };
        await draw_();
      };

      // ---- History: what was changed here, newest first
      const past = async () => {
        if (holder.dataset.tab !== 'history') return;
        const lines = history.read(await graph()), today = G.days.number(new Date());
        const when = ms => { const at = new Date(ms), day = G.days.number(at); return `${day === today ? 'Today' : G.days.short(day, today)}, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`; };
        history_.innerHTML = lines.length ? lines.map(one => `<div class="lk-history-line"><span class="lk-history-when">${G.esc(when(one.when))}</span><span>${saidHtml(one.said)}</span></div>`).join('') : '<div class="lk-none">Nothing has been changed yet.</div>';
      };
      listeners.add(past);
      G.tending = { did };   // Move values tells its moves here too
      tabs(); bar(); past();
      rel.addEventListener('lk-drawn', bar);
      let offSide = null;
      if (wide) {   // the outline beside a page you are reading: one press away
        const side = doc.createElement('button'); side.type = 'button'; side.className = 'lk-btn lk-side'; side.textContent = 'In the sidebar';
        const values = doc.createElement('button'); values.type = 'button'; values.className = 'lk-btn lk-values'; values.textContent = 'Move values…';
        const open = () => section.open(), ask = () => G.moving.ask(holder, {});
        side.addEventListener('click', open); values.addEventListener('click', ask); (holder.querySelector(':scope > .lk-add') || holder.firstElementChild).after(values, side);
        offSide = () => { side.removeEventListener('click', open); values.removeEventListener('click', ask); side.remove(); values.remove(); };
      }
      return () => { sized?.disconnect(); offSide?.(); offAdd(); list.off(); listeners.delete(past); };
    };
    const section = G.touch.section('lk-ontology', 'Ontology', holder => draw(holder, false), TREE);
    const page = G.touch.page('lk-ontology', 'Ontology', holder => draw(holder, true));
    base.onStop(section.off); base.onStop(page.off); base.onStop(() => { delete G.tending; });
    G.touch.command('lk-ontology', 'Ontology', page.open);
    G.touch.command('lk-ontology-side', 'Ontology in the sidebar', section.open);
  },
});
})();
