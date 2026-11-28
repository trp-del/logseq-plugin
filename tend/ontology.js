/* TENDING: Ontology. Your tags as an outline, each under the tag it sits under, and your properties in a table, on a page of
   their own and in a section of the right sidebar. A tag and a property are nodes like any other, so each row is the one line
   (node/line.js). Nothing opens under a row (the owner, 25 November 2026: "don't show the whole tag page in ontology under a
   tag nor property page"): a press on a name goes to its page, Shift in the sidebar, Enter too, where a property's kind and
   what it takes are set with Logseq's own controls; a press beside the name, or the arrow keys, selects the row, which shows
   a tag's lines.
   Three tabs, as before the rebuild (the owner, 26 November 2026, "As before" and then "yes" to the old row of actions, tick
   boxes and tabs): Tags, Properties and History. Every row has a tick box; the row of actions under the tabs says what can be
   done with the ticked rows and waits faintly until it can be: for tags Merge…, Move up a level, Move under…, Rename and
   Delete, for properties Merge… and Rename. Each is written at once, through ground/write.js, and Logseq's own Undo takes it
   back (the faded arrow), counted in the steps the writes answer; where Logseq refuses one write of several, what was written
   before it keeps its arrow and its line in History. A delete asks first, in red, counting what goes with the tag or the
   property, and offers no Undo where Undo would not bring all of it back: the one shared delete (node/ask.js), the same
   from the row of actions as from a row's menu in any place. History lists what was changed here, newest first, kept on this computer for 30 days; its newest line carries
   the Undo arrow while that change is still the last change to the graph (the library's arrow, which goes at the next change
   as every arrow does). No older line has an Undo: that would be a second set of writes of the plugin's own. A change taken
   back whole with its arrow, wherever the arrow stands, loses its line: History says what was changed and still stands.
   Properties are the table they were before the rebuild (the owner, 26 November 2026, "I like before version"; node/table.js):
   Property, On tags (▾ puts it on a tag or takes it off), Holds (▾ changes the tags a node value must have), Filled ("2 of 6"),
   sorted by a press on a column's name, least filled first at the start.
   Property groups, as 0.5.17 had them (the owner, 28 November 2026: "B. Groups, as in 0.5.17"): named groups, for order only,
   kept on this computer for each graph and never written to the graph (core/groups.js decides, the table draws them). New
   group, the line at the table's foot, makes one; a press on a group's name or Enter on its line renames it; a property or a
   group dragged onto a group's line (or onto a row in it) goes into it, onto a row in no group out of every group; a
   property's right-click Move to group… and Tab and Shift-Tab do the same with the keys; the group's right-click Take the
   group away (or Delete on its line) takes it away, what it held going up a level. Each of these has the Undo arrow, which
   puts back what was kept; folding has none. */
(function () {
const G = window.PluginDoor;
const TREE = 'M3 12h2c3 0 3 -6 6 -6h1M3 12h2c3 0 3 6 6 6h1M12 6c2 0 2 -3 4 -3h4M12 6c2 0 2 3 4 3h4M12 18c2 0 2 -3 4 -3h4M12 18c2 0 2 3 4 3h4';   // one into two into four, on its side
const HISTORY = 'lk.ontology.history', DAYS30 = 30 * 864e5, GROUPS = 'lk.ontology.groups';
const TABS = [['tags', 'Tags', 'tag'], ['props', 'Properties', 'list'], ['history', 'History', 'history']];
const tabOf = { page: 'tags', side: 'tags' };   // the tab each place was left on, while Logseq runs
const sortOf = { page: { key: 'filled', dir: 1 }, side: { key: 'filled', dir: 1 } };   // how each place's table of properties was last sorted
// What a property holds, in words, as the table of 0.5.17 said it.
const KIND = { date: 'a date', datetime: 'a date', number: 'a number', checkbox: 'yes or no', url: 'a link' };
// What was changed here, by graph, newest first; each line its words as parts: [kind, text], kind '' (words), 'tag' or 'prop'.
const history = {
  all() { const all = G.touch.kept(HISTORY, {}).get(); return all && typeof all === 'object' ? all : {}; },
  read(graph) { const now = Date.now(); return (this.all()[graph] || []).filter(one => now - one.when < DAYS30); },
  add(graph, said, when = Date.now()) {
    const all = this.all(); all[graph] = [{ when, said }, ...this.read(graph)].slice(0, 300);
    G.touch.kept(HISTORY, {}).set(all);
    for (const heard of listeners) heard();
  },
  // A change taken back: its line goes.
  drop(graph, when) {
    const all = this.all(), was = all[graph] || [];
    all[graph] = was.filter(one => one.when !== when);
    if (all[graph].length === was.length) return;
    G.touch.kept(HISTORY, {}).set(all);
    for (const heard of listeners) heard();
  },
};
const listeners = new Set();
// The property groups, by graph: what core/groups.js decides, kept on this computer (the window's local storage).
const kept = {
  read(graph) { const all = G.touch.kept(GROUPS, {}).get(); return G.groups.clean(all && typeof all === 'object' ? all[graph] : null); },
  write(graph, g) { const was = G.touch.kept(GROUPS, {}).get(), all = was && typeof was === 'object' ? { ...was } : {}; if (g.list.length) all[graph] = g; else delete all[graph]; G.touch.kept(GROUPS, {}).set(all); },
};
const saidHtml = said => said.map(([kind, text]) => kind ? `<span class="lk-${kind}">${G.esc(text)}</span>` : G.esc(text)).join('');
const names = (list, kind) => list.flatMap((one, i) => [...(i ? [['', i === list.length - 1 ? ' and ' : ', ']] : []), [kind, one]]);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
G.part({
  key: 'ontology', title: 'Ontology', about: 'Your tags and properties, on a page of their own and as an outline in the right sidebar. A press on a name goes to its page; a press beside it shows the tag’s lines; a line at the top makes a new tag.',
  start(base) {
    base.style('box', G.changeBox.CSS);   // the box a merge is shown in, which is Move values' too: here whether or not that part runs
    base.style('ontology', `
.lk-ontology { padding: 4px 4px 16px 22px; }
.lk-ontology > .lk-rel { position: relative; }
.lk-ontology .lk-row:not([data-kids="1"]) > .lk-fold { visibility: hidden; }   /* nothing opens under a tag or a property here; a tag with tags under it folds, as a bullet does */
.lk-ontology .lk-row[data-kids="1"]:not([data-shut="1"]) > .lk-fold svg { transform: rotate(90deg); }
.lk-ontology .lk-row[data-shut="1"] > .lk-fold svg { transform: none; }
.lk-ontology .lk-row[data-shut="1"] > .lk-line > .lk-bul::before { box-shadow: 0 0 0 4.8px var(--lk-bullet-ring); }   /* folded: the ring Logseq puts round a folded bullet */
.lk-ontology .lk-row.lk-chosen > .lk-line:is(:focus-visible, :hover) { background: var(--lk-wash); }   /* lit only where the keys or the pointer are: a row left chosen keeps its lines, not a wash (the owner's marked page, 26 Nov) */
/* A row as Ontology drew it before the rebuild (the owner, 26 November 2026: "I prefer this line style of before and non bold for
   all of these.. there should also be line with bullets like normal"): the name at the small size and in no tag bold, the count in
   a column at the area's right edge, the rows close; a hairline from each tag's bullet down along the tags under it, as Logseq's
   own outline has. */
.lk-ontology .lk-list > .lk-rows > .lk-row .lk-words { font-size: var(--lk-small); font-weight: 400; }
.lk-ontology .lk-list > .lk-rows > .lk-row > .lk-line { padding-block: 1px; line-height: 24px; }
.lk-ontology .lk-line > .lk-num { margin-left: auto; padding-left: 12px; }
.lk-ontology .lk-list[data-face="tag"] > .lk-rows > .lk-row { padding-left: calc(var(--lk-depth, 0) * 29px); }   /* Logseq's own step between levels, so a fold arrow stands clear of the guide line of the tag above (the owner, 26 November 2026) */
.lk-ontology .lk-list[data-face="tag"] > .lk-rows > .lk-row:not([style*="--lk-depth: 0;"]) { background: repeating-linear-gradient(90deg, transparent 0 25px, var(--lk-line) 25px 26px, transparent 26px 29px) 0 0 / calc(var(--lk-depth, 0) * 29px - 3px) 100% no-repeat; }   /* one hairline under each tag the row sits under, through its bullet's middle (25.5 in, 29 a step) */
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
.lk-joins { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.lk-joins { color: var(--lk-text); }
.lk-joins path { fill: none; stroke: currentColor; stroke-opacity: .5; stroke-width: 1; }   /* a hairline in the quiet grey, in light and dark alike */
.lk-ontology:not(.lk-map) > .lk-rel { padding-right: 20px; }   /* room at the right for the bracket of a tag's lines */
/* The tabs, as before the rebuild: an icon and a word each, the one in force in the ink with a line under it (the library's tab). */
.lk-onto-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 24px; margin: 0 0 14px; font-size: var(--lk-line-size); }
.lk-onto-tabs > .lk-tab { display: inline-flex; align-items: center; gap: 6px; padding: 3px 0 7px; line-height: 1.35; }
.lk-onto-tabs > .lk-tab svg, .lk-onto-acts .lk-btn svg { width: var(--lk-mark-box); height: var(--lk-mark-box); flex: none; }   /* a mark before a word: the library's box for one */
.lk-map > .lk-onto-tabs { order: 0; flex: 0 0 100%; }
.lk-ontology[data-tab="history"] > .lk-add { display: none; }   /* the one line to type in: New tag on Tags, Find a property on Properties */
.lk-ontology .lk-trow > .lk-ask-gone { grid-column: 1 / -1; }   /* the question before a delete, under the whole of a table's row */
.lk-ontology[data-tab="history"] > :is(.lk-values, .lk-side, .lk-rel, .lk-onto-acts, .lk-ask) { display: none; }
.lk-ontology:not([data-tab="history"]) > .lk-history { display: none; }
/* The row of actions: what the ticked rows can take, each press waiting faintly until it can be pressed (disabled). */
.lk-onto-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin: 2px 0 10px; font-size: var(--lk-line-size); }
.lk-map > .lk-onto-acts { order: 4; flex: 0 0 100%; margin-left: -8px; }
.lk-onto-acts > .lk-said { margin: 0 8px; white-space: nowrap; }
.lk-onto-acts > .lk-btn { gap: 8px; }
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
.lk-history .lk-prop { color: var(--lk-text); }
/* The table of properties: across the page's whole width, its tick boxes on the same left edge as the tags' (node/table.js). */
.lk-ontology[data-tab="props"] > .lk-rel { display: block; padding-left: 0; }
.lk-ontology:not(.lk-map)[data-tab="props"] > .lk-rel { padding-right: 0; }
.lk-ontology .lk-table a.lk-prop { color: var(--lk-text); font-size: var(--lk-line-size); text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-ontology .lk-table a.lk-prop:hover { text-decoration-color: currentColor; }
.lk-trow.lk-renaming > .lk-td:first-of-type > .lk-words { display: none; }
.lk-tgroup.lk-renaming > .lk-tgroup-words { display: none; }
.lk-tgroup > .lk-rename { box-sizing: border-box; width: auto; min-width: 0; height: 22px; margin: 0; padding: 0; border: 0; border-bottom: 1px solid var(--lk-text); border-radius: 0; background: none; box-shadow: none; outline: 0; color: var(--lk-text); font: inherit; font-weight: 500; }   /* the group's name where it stood, underlined while it is written, as a row's */
/* New group: the library's line that adds, at the table's foot, its words on the edge of the properties' names. */
.lk-groups-foot { padding: 12px 0 0 38px; }
.lk-groups-foot > .lk-add { position: static; max-width: 362px; margin-bottom: 0; }
.lk-map > .lk-groups-foot { order: 6; flex: 0 0 100%; }
.lk-ontology:not([data-tab="props"]) > .lk-groups-foot { display: none; }
.lk-trow .lk-td > .lk-rename { flex: 1 1 auto; box-sizing: border-box; width: auto; min-width: 0; height: 22px; margin: 0; padding: 0; border: 0; border-bottom: 1px solid var(--lk-text); border-radius: 0; background: none; box-shadow: none; outline: 0; color: var(--lk-text); font-family: var(--lk-prop-face); font-size: var(--lk-line-size); }`);
    // What was changed is told to History once, whichever place it was changed in; Move values tells its moves here too.
    /* uuid: the node the Undo arrow was just set after for this change. Its line of History carries the arrow too, while it is
       the newest line and the arrow stands; a change heard later lets the line go (the arrow itself goes by the library's own
       hearing, and another part may since have set one for the same node). */
    const graph = () => G.read.graph().catch(() => '');
    let standing = null;   // { uuid, when, set, graph }: the line of History the arrow that stands belongs to
    const did = async (said, uuid = '') => {
      const when = Date.now(), mine = uuid ? { uuid: String(uuid).toLowerCase(), when, set: when, graph: '' } : null;
      if (mine) standing = mine;
      const name = await graph();
      if (mine) mine.graph = name;
      history.add(name, said, when);
    };
    base.onStop(G.touch.changed(() => { if (standing && Date.now() - standing.set > 2000) standing = null; }));
    /* A change taken back whole with its arrow, wherever the arrow stood (the row, History's line, the bottom right), loses its
       line in History: the library tells of the press once it has finished (G.undo.taken). Where the Undo stopped part of
       the way, the line stays. */
    base.onStop(G.undo.taken((uuid, whole) => { const mine = standing; if (!mine || mine.uuid !== uuid) return; standing = null; if (whole) history.drop(mine.graph, mine.when); }));
    G.tending = { did: said => did(said) };
    // A tag or a property deleted, from Ontology or from any other row that shows one: its line in History.
    base.onStop(G.ask.removed(({ kind, gone, arrow }) => did([['', 'Deleted '], ...names(gone, kind === 'tag' ? 'tag' : 'prop')], arrow)));
    /* One drawing for both places. In the sidebar: one outline. On the page: every top tag an area of its own, side by side,
       so the lines between tags run in the gaps and over the band above the areas. A drawing that fails is said in the console
       and left empty: the ground would otherwise try it again at every change of the page. */
    const draw = (holder, wide) => {
      try { return drawing(holder, wide); }
      catch (error) { console.error('Logseq Plugin: Ontology could not be drawn', error); holder.replaceChildren(); return () => {}; }
    };
    const drawing = (holder, wide) => {
      const doc = holder.ownerDocument;
      holder.classList.add('lk-ontology'); holder.classList.toggle('lk-map', wide);
      const place = wide ? 'page' : 'side';
      holder.dataset.tab = tabOf[place];
      holder.innerHTML = `<div class="lk-onto-tabs" role="tablist"></div><div class="lk-onto-acts"></div><div class="lk-rel"></div><div class="lk-history"></div>`;
      const tabsEl = holder.firstElementChild, acts = tabsEl.nextElementSibling, history_ = holder.lastElementChild;
      /* A new tag is made at the top. A name that exists is shown instead of made twice: nothing was written, so the line that
         adds is answered no steps and sets no Undo arrow (an arrow there would take back the last change made anywhere). */
      const offAdd = G.node.adder(holder, 'New tag', async name => {
        if (holder.dataset.tab !== 'tags') return '';
        const there = [...(await G.read.tags()).values()].find(tag => tag.title.trim().toLowerCase() === name.toLowerCase());
        if (!there) return G.write.newTag(name);
        showTag(there);
        return { uuid: there.uuid, steps: 0 };
      }, 'The tag could not be made');
      /* On Properties the same line finds a property by its name: what is typed narrows the table, and Enter adds nothing. */
      const field = holder.querySelector(':scope > .lk-add .lk-field');
      let finding = '';
      const LINE = { tags: 'New tag', props: 'Find a property' };
      const lineFor = tab => { if (!field) return; field.value = ''; finding = ''; const words = LINE[tab] || ''; field.placeholder = words; field.setAttribute('aria-label', words); };
      const onFind = () => { if (holder.dataset.tab !== 'props') return; const words = field.value.trim().toLowerCase(); if (words !== finding) { finding = words; list.again(); } };
      const onFindKey = event => { if (holder.dataset.tab !== 'props') return; if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } else if (event.key === 'Escape') holder.ownerDocument.defaultView.setTimeout(onFind, 0); };   // Escape empties the line (the line's own doing): the table is whole again
      field?.addEventListener('input', onFind);
      field?.parentElement.addEventListener('keydown', onFindKey, true);
      const plain = node => ({ ...node, tag: '', tagShown: false, dayShown: 0, day: 0 });
      const rel = holder.querySelector(':scope > .lk-rel');
      tabsEl.after(holder.querySelector(':scope > .lk-add'));   // the line that adds stands under the tabs
      G.moving?.last(holder);   // the lines of the moves of values not let go; none where Move values is switched off
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
          const steps = await G.write.moveTag(uuid, to, tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean));
          if (!steps) { done(); return; }   // it stood there already: nothing was written, so no arrow and no line in History
          G.undo.mark(uuid, steps);   // the faded arrow beside the tag takes the whole move back
          const under = [...tags.values()].find(one => one.uuid === to);
          did(under ? [['', 'Moved '], ['tag', tag.title], ['', ' under '], ['tag', under.title]] : [['', 'Moved '], ['tag', tag.title], ['', ' to the top']], uuid);
          writing = false;
        } catch (error) { done(); if (error?.steps) G.undo.mark(uuid, error.steps); G.write.refused('The tag could not be moved', error); }
      };
      const isTag = row => row.closest('.lk-list')?.dataset.face === 'tag';
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
        const shown = id => G.tags.path(id, tagIndex).map(tag => rowOf.get(tag.id)).find(Boolean);   // a tag folded away: its lines stop at the nearest tag that shows
        for (const [from, , to] of joins) { if (from === to || !(near.has(from) || near.has(to))) continue; const a = shown(from), b = shown(to); if (a && b && a !== b) pairs.set(`${from}>${to}`, { a, b }); }
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
      /* One step in or out for a tag, worked out from the tags as last read (core/tags.js), never from the rows drawn: on the
         page a top tag is the first row of an area of its own, and Tab still puts it under the top tag before it, as in the
         sidebar. */
      const step = (uuid, out) => {
        const id = ids.get(uuid), to = id == null ? null : G.tags.step(id, tagIndex, out);
        if (to == null) return;
        const under = to ? tagIndex.get(to)?.uuid : '';
        if (under != null) move(uuid, under);
      };
      // A tag that is there already, shown: the tags it sits under unfolded and its row selected (the line that adds brings it into view).
      const showTag = tag => {
        const view = doc.defaultView;
        for (const one of G.tags.path(tag.id, tagIndex).slice(1)) if (G.folds.shut(one.title)) G.folds.set(one.title, false);
        const find = (tries = 0) => {
          const row = rel.querySelector(`.lk-list[data-face="tag"] > .lk-rows > .lk-row[data-uuid="${tag.uuid}"]`);
          if (row) select(row);
          else if (tries < 10 && holder.isConnected) view.setTimeout(() => find(tries + 1), 150);
        };
        list.again(); find();
      };
      // ---- what each tab lists, and the rows ticked in it
      const picked = { tags: new Set(), props: new Set() };
      /* The tags folded are the ones folded in every list of tags (G.folds, by name): one memory. What Ontology kept for itself
         before (by a tag's id, under a name of its own) is handed to it once, when the tags are first read, and let go. */
      let folds = G.touch.kept('lk.ontology-folded', null);
      let info = new Map();   // uuid -> { title, id, count, depth, parents, kids } of each row drawn, as last read
      const pickedNow = () => holder.dataset.tab === 'props' ? picked.props : picked.tags;
      const read = async () => {
        const tab = holder.dataset.tab;
        if (tab !== 'tags') return [];   // properties are a table of their own (below), History a list of its own
        const tags = await G.read.tags(), tree = G.tags.tree(tags);
        ids = new Map(tree.map(row => [row.tag.uuid, row.tag.id])); tagIndex = tags;
        const [tagNodes, pairs] = await Promise.all([G.read.byUuids(tree.map(row => row.tag.uuid)), G.read.tagPairs()]);
        const depth = new Map(tree.map(row => [row.tag.uuid, row.depth])), counts = G.tags.counts(tags, pairs);
        joins = await G.read.relations();
        const kidsOf = new Set([...tags.values()].flatMap(one => one.parents));   // the tags that have tags under them, worked out once
        if (folds) { const was = folds.get(); if (Array.isArray(was)) for (const row of tree) if (was.includes(row.tag.uuid)) G.folds.set(row.tag.title, true); folds.drop(); folds = null; }
        let cut = Infinity;   // a folded tag hides the tags under it, as a folded bullet hides its children
        const tagRows = tagNodes.map(node => { const tag = tags.get(ids.get(node.uuid)); return { ...plain(node), depth: depth.get(node.uuid) || 0, count: counts.get(tag?.id) || 0, shutHere: !!tag && kidsOf.has(tag.id) && G.folds.shut(tag.title) }; })
          .filter(row => { if (row.depth <= cut) cut = Infinity; if (row.depth > cut) return false; if (row.shutHere) cut = row.depth; return true; });
        info = new Map(tree.map(({ tag, depth: d }) => [tag.uuid, { title: tag.title, id: tag.id, count: counts.get(tag.id) || 0, depth: d, parents: tag.parents, kids: kidsOf.has(tag.id) }]));
        for (const uuid of [...picked.tags]) if (!info.has(uuid)) picked.tags.delete(uuid);
        if (!wide) return tagRows.length ? [{ key: 'ontology:tags', kind: 'group', name: '', tag: '', face: 'tag', rows: tagRows }] : [];
        const areas = [];   // each top tag with the tags under it
        for (const row of tagRows) { if (!row.depth || !areas.length) areas.push([]); areas[areas.length - 1].push(row); }
        return areas.map(rows => ({ key: `ontology:area:${rows[0].uuid}`, kind: 'group', name: '', tag: '', face: 'tag', rows }));
      };
      // What Ontology adds to a row's right-click menu. Move values… only where that part runs. The menu's Delete… is the shared one.
      const more = (row, at) => {
        const uuid = row.dataset.uuid, values = take => G.moving ? [{ word: 'Move values…', take }] : [];
        if (!isTag(row)) { const lines = values(async () => { const prop = [...(await G.read.properties()).values()].find(one => one.uuid.toLowerCase() === uuid); if (prop) G.moving?.ask(holder, { from: prop.ident }); }); return lines.length ? [{ gap: true }, ...lines] : []; }
        return [{ gap: true }, ...values(async () => { const tag = [...(await G.read.tags()).values()].find(one => one.uuid === uuid); if (tag) G.moving?.ask(holder, { tag: { id: tag.id, title: tag.title } }); }),
          { word: 'Move under…', take: () => under(at, [uuid]) },   // the same word and the same list as the row of actions
          ...((info.get(uuid)?.depth || 0) > 0 ? [{ word: 'Move to the top', take: () => move(uuid, '') }] : [])];
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
          if ((event.metaKey || event.ctrlKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && isTag(row) && row.dataset.kids === '1') { fold(row.dataset.uuid, event.key === 'ArrowUp'); return true; }   // Logseq's own keys for folding
          if (event.key === 'Escape' && pickedNow().size) { clear(); return true; }
          if (event.key === 'Enter') { G.touch.open(row.dataset.uuid, event.shiftKey); return true; }   // nothing opens under the row
          if (event.key !== 'Tab' || !isTag(row)) return false;
          if (moving) waiting = [row.dataset.uuid, event.shiftKey]; else step(row.dataset.uuid, event.shiftKey);
          return true;
        },
        more };
      const NONE = { tags: 'No tags of your own yet', props: 'No properties of your own yet', history: '' };
      // ---- the table of properties
      const tagLink = id => { const tag = tagIndex.get(id); return tag ? `<a class="lk-tag" data-to="${G.esc(String(tag.uuid).toLowerCase())}">${G.esc(tag.title)}</a>` : ''; };
      const tagList = ids => ids.slice(0, 3).map(tagLink).join('<span class="lk-sep">, </span>') + (ids.length > 3 ? ` <span class="lk-off">and ${ids.length - 3} more</span>` : '');
      const holds = row => row.type === 'node' ? (row.range.length ? tagList(row.range) : 'any node') : G.esc(row.choice ? 'a choice' : KIND[row.type] || 'words');
      const holdsWords = row => row.type === 'node' ? (row.range.length ? row.range.map(id => tagIndex.get(id)?.title || '').join(', ') : 'any node') : row.choice ? 'a choice' : KIND[row.type] || 'words';
      const readProps = async () => {
        const [tags, pairs, { props, byTag }, held, choices, name] = await Promise.all([G.read.tags(), G.read.tagPairs(), G.read.schema(), G.read.holding(), G.read.choices().catch(() => new Map()), graph()]);
        tagIndex = tags; graphName = name; groupsNow = kept.read(name);
        const fill = G.tags.filled(tags, pairs, byTag, held);
        const rows = [...props.values()].map(prop => { const f = fill.get(prop.ident) || { on: [], filled: 0, of: 0 }; return { uuid: String(prop.uuid).toLowerCase(), ident: prop.ident, title: prop.title, type: prop.type, range: prop.range.filter(id => tags.has(id)), choice: (choices.get(prop.ident) || []).length > 0, on: f.on, filled: f.filled, of: f.of, held: new Set(held.get(prop.ident) || []).size }; });
        info = new Map(rows.map(row => [row.uuid, { title: row.title, count: row.held, row }]));
        for (const uuid of [...picked.props]) if (!info.has(uuid)) picked.props.delete(uuid);
        const found = finding ? rows.filter(row => finding.split(/\s+/).every(word => row.title.toLowerCase().includes(word))) : rows;
        tableOpts.none = rows.length && !found.length ? `No property has “${finding}” in its name` : NONE.props;
        return found;
      };
      // A ▾ in a cell: the tags, as an outline, with a tick at each one that carries the property (On tags) or that its node values
      // must have (Holds). A press puts the tag in or takes it out, written at once; Logseq's own Undo takes it back.
      const onTags = async (at, uuid) => {
        const row = info.get(uuid)?.row;
        if (!row) return;
        const carries = new Set(row.on);
        G.menu(at, [{ group: `Tags that give ${row.title}` }, ...G.tags.tree(tagIndex).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: carries.has(tag.id), take: () => once_(`${row.title} could not be changed`, async () => {
          const [now, prop] = await Promise.all([G.read.reach(tag.id), G.read.node(uuid)]);
          if (!prop) return;
          const off = now.props.includes(prop.id);
          await G.undo.after(uuid, G.write.tagProperties(tag.uuid, off ? now.props.filter(id => id !== prop.id) : [...now.props, prop.id]));
          did(off ? [['', 'Took '], ['prop', row.title], ['', ' off '], ['tag', tag.title]] : [['', 'Put '], ['prop', row.title], ['', ' on '], ['tag', tag.title]], uuid);
        }) }))], { find: 'A tag' });
      };
      const nodeTags = async (at, uuid) => {
        const row = info.get(uuid)?.row;
        if (!row || row.type !== 'node') return;
        const has = new Set(row.range), set = (ids, said) => once_(`${row.title} could not be changed`, async () => { await G.undo.after(uuid, G.write.range(uuid, ids)); did(said, uuid); });
        G.menu(at, [{ group: `What ${row.title} holds` }, { word: 'Any node', on: !has.size, take: () => { if (has.size) set([], [['', 'Let '], ['prop', row.title], ['', ' hold any node']]); } }, { gap: true },
          ...G.tags.tree(tagIndex).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: has.has(tag.id), take: () => has.has(tag.id)
            ? set(row.range.filter(id => id !== tag.id), [['', 'Let '], ['prop', row.title], ['', ' hold nodes of '], ...(row.range.length > 1 ? names(row.range.filter(id => id !== tag.id).map(id => tagIndex.get(id)?.title || ''), 'tag') : [['', 'any tag']])])
            : set([...row.range, tag.id], [['', 'Let '], ['prop', row.title], ['', ' hold nodes of '], ...names([...row.range, tag.id].map(id => tagIndex.get(id)?.title || ''), 'tag')]) }))], { find: 'A tag' });
      };
      const COLUMNS = [
        { key: 'name', word: 'Property', width: 'minmax(120px, 1fr)', min: 120, by: row => row.title.toLowerCase(), cell: row => `<span class="lk-words"><a class="lk-prop" data-to="${row.uuid}">${G.esc(row.title)}</a></span>` },
        { key: 'on', word: 'On tags', width: 'minmax(130px, 1.5fr)', min: 130, by: row => row.on.length ? (tagIndex.get(row.on[0])?.title || '').toLowerCase() : '￿', cell: row => `<span class="lk-words">${row.on.length ? tagList(row.on) : '<span class="lk-off">No tag</span>'}</span><button type="button" class="lk-change" data-cell="on" aria-label="Tags that give ${G.esc(row.title)}" title="Put ${G.esc(row.title)} on a tag…"></button>` },
        { key: 'holds', word: 'Holds', width: 'minmax(110px, 1.5fr)', min: 110, by: row => holdsWords(row).toLowerCase(), cell: row => `<span class="lk-words">${holds(row)}</span>${row.type === 'node' ? `<button type="button" class="lk-change" data-cell="holds" aria-label="What ${G.esc(row.title)} holds" title="Node tags of ${G.esc(row.title)}…"></button>` : ''}` },
        { key: 'filled', word: 'Filled', width: 'minmax(84px, 100px)', min: 84, end: true, by: row => row.of ? row.filled / row.of : 0, cell: row => row.of ? `${row.filled} of ${row.of}` : plural(row.held, 'node') },
      ];
      const tableOpts = { columns: COLUMNS, read: readProps, face: 'prop', none: NONE.props, sort: sortOf[place], sorted: sort => { sortOf[place] = tableOpts.sort = sort; }, tie: row => row.title,   // none: what the table says with no rows, set at each reading
        ticks: { has: uuid => picked.props.has(uuid), flip(uuid, row, on) { if (on) picked.props.add(uuid); else picked.props.delete(uuid); bar(); } },
        key: (row, event) => { if (event.key === 'Tab' && groupsNow.list.length && !event.metaKey && !event.ctrlKey && !event.altKey) { step_({ ident: identOf(row.dataset.uuid), uuid: row.dataset.uuid }, event.shiftKey); return true; } return opts.key(row, event); },
        more: (row, at) => [...more(row, at), ...(groupsNow.list.length ? [{ gap: true }, { word: 'Move to group…', take: () => toGroup(at, row.dataset.uuid) }] : [])],
        press(row, event) { const cell = event.target.closest('.lk-change[data-cell]'); if (!cell) return false; (cell.dataset.cell === 'on' ? onTags : nodeTags)(cell, row.dataset.uuid); return true; } };
      /* ---- the property groups (core/groups.js), kept on this computer for the graph that is open. Every change but a fold goes
         through regroup: written, the table drawn again, and the Undo arrow set where the change shows (after the property's
         name, or after the group's name and count), whose press puts back what was kept before, each group left folded or
         open as it is by then. */
      let graphName = '', groupsNow = G.groups.clean(null);
      const regroup = (change, at) => {
        const name = graphName, before = kept.read(name), next = change(before);
        if (!next || next === before) return false;
        kept.write(name, next); groupsNow = next; list.again();
        standing = null;   // the arrow now stands for this change, not for History's newest line
        G.undo.own(at, () => {
          const now = kept.read(name), open = new Map(now.list.map(one => [one.id, one.open]));
          const back = { ...before, list: before.list.map(one => open.has(one.id) ? { ...one, open: open.get(one.id) } : one) };
          kept.write(name, back); if (graphName === name) groupsNow = back;
          if (holder.isConnected) list.again();
        });
        return true;
      };
      const groupKey = id => `lk-group-${id}`;
      const identOf = uuid => info.get(uuid)?.row?.ident;
      const groupOf = ident => groupsNow.of[ident] ?? null;
      const titleOf = id => groupsNow.list.find(one => one.id === id)?.name || '';
      const putProp = (uuid, to) => { const ident = identOf(uuid); return !!ident && groupOf(ident) !== (to ?? null) && regroup(g => G.groups.put(g, [ident], to ?? null), uuid); };
      const putGroup = (id, under) => regroup(g => G.groups.inside(g, id, under ?? null), groupKey(id));
      const takeAway = id => { const was = groupsNow.list.find(one => one.id === id); if (was) regroup(g => G.groups.drop(g, id), was.under ? groupKey(was.under) : groupKey(id)); };
      // A group's name in place: the line gives way to a field with the name in it; Enter writes it, Escape or a press elsewhere leaves it.
      const renameGroup = id => {
        const line = rel.querySelector(`.lk-tgroup[data-group="${id}"]`), was = titleOf(id);
        if (!line || line.querySelector('.lk-rename')) return;
        const field = doc.createElement('input'); field.type = 'text'; field.className = 'lk-field lk-rename'; field.value = was; field.spellcheck = false; field.setAttribute('aria-label', `New name for the group ${was}`);
        line.classList.add('lk-renaming'); line.appendChild(field); field.focus(); field.select();
        let left = false;
        const leave = () => { if (left) return; left = true; field.remove(); line.classList.remove('lk-renaming'); };
        field.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); leave(); line.focus({ preventScroll: true }); }
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const name = field.value.trim();
          leave(); line.focus({ preventScroll: true });
          if (name && name !== was) regroup(g => G.groups.rename(g, id, name), groupKey(id));
        });
        for (const type of ['click', 'mousedown', 'contextmenu', 'dragstart']) field.addEventListener(type, event => event.stopPropagation());
        field.addEventListener('blur', leave);
      };
      // The groups as an outline in a menu: where a property or a group can go. Indented only where a group stands in another.
      const groupLines = (on, take, leaveOut = null) => { const all = G.groups.tree(groupsNow).filter(one => !leaveOut || !G.groups.within(groupsNow, one.id, leaveOut)), deep = all.some(one => one.depth); return all.map(one => ({ word: one.name, ...(deep ? { depth: one.depth } : {}), on: on === one.id, take: () => take(one.id) })); };
      const toGroup = (at, uuid) => {
        const ident = identOf(uuid), row = info.get(uuid)?.row;
        if (!ident || !groupsNow.list.length) return;
        G.menu(at, [{ group: `Put ${row.title} in` }, ...groupLines(groupOf(ident), id => putProp(uuid, id)), { gap: true }, { word: 'No group', on: groupOf(ident) == null, take: () => putProp(uuid, null) }]);
      };
      const intoGroup = (at, id) => {
        const was = groupsNow.list.find(one => one.id === id);
        if (!was) return;
        G.menu(at, [{ group: `Move ${was.name} into` }, ...groupLines(was.under, to => putGroup(id, to), id), { gap: true }, { word: 'The top', on: was.under == null, take: () => putGroup(id, null) }]);
      };
      const step_ = (what, out) => regroup(g => G.groups.step(g, what, out), what.group ? groupKey(what.group) : what.uuid);
      const groupsOpts = {
        layout: sorted => G.groups.layout(groupsNow, sorted, row => row.ident, !!finding),
        fold(id, open) { const name = graphName, g = kept.read(name), next = G.groups.fold(g, id, open); if (next !== g) kept.write(name, next); groupsNow = next; },
        press(id) { renameGroup(id); return true; },
        key(id, event) {
          if (event.key === 'Enter') { renameGroup(id); return true; }
          if (event.key === 'Tab') { step_({ group: id }, event.shiftKey); return true; }
          if (event.key === 'Delete' || event.key === 'Backspace') { takeAway(id); return true; }
          return false;
        },
        more: (id, at) => [{ word: 'Rename', take: () => renameGroup(id) }, { word: 'Move into…', take: () => intoGroup(at, id) }, { gap: true }, { word: 'Take the group away', take: () => takeAway(id) }],
        can(what, to) {
          if (what.group) { const was = groupsNow.list.find(one => one.id === what.group); return !!was && (was.under ?? null) !== (to ?? null) && !(to && G.groups.within(groupsNow, to, what.group)); }
          const ident = identOf(what.uuid); return !!ident && groupOf(ident) !== (to ?? null);
        },
        drop: (what, to) => what.group ? putGroup(what.group, to) : putProp(what.uuid, to),
      };
      tableOpts.groups = groupsOpts;
      // New group, at the table's foot: the library's line that adds. A name that is there already is that group, made again never.
      const foot = doc.createElement('div'); foot.className = 'lk-groups-foot'; rel.after(foot);
      const offFoot = G.node.adder(foot, 'New group', async name => {
        const there = G.groups.named(kept.read(graphName), name);
        if (there) { rel.querySelector(`.lk-tgroup[data-group="${there.id}"]`)?.scrollIntoView({ block: 'nearest' }); return { uuid: '', steps: 0 }; }
        const id = `g${Date.now().toString(36)}`;
        regroup(g => G.groups.make(g, name, id), groupKey(id));
        return { uuid: '', steps: 0 };   // nothing written to the graph: the arrow stands after the new group's name
      }, 'The group could not be made');
      const table = () => G.table(rel, tableOpts);
      const mount = tab => tab === 'props' ? table() : G.node.listing(rel, read, { ...opts, none: NONE[tab] });
      lineFor(holder.dataset.tab);
      let list = mount(holder.dataset.tab);
      // Folding a tag, kept on this Mac: a press on its arrow, or Cmd-Up and Cmd-Down on its row.
      const fold = (uuid, on) => {
        const title = info.get(uuid)?.title;
        if (!title) return;
        G.folds.set(title, on ?? !G.folds.shut(title));
        list.again();
        doc.defaultView.setTimeout(() => rel.querySelector(`.lk-row[data-uuid="${uuid}"] > .lk-line`)?.focus({ preventScroll: true }), 120);
      };
      const marks = () => { for (const row of rel.querySelectorAll('.lk-list[data-face="tag"] > .lk-rows > .lk-row')) { const one = info.get(row.dataset.uuid); row.dataset.kids = one?.kids ? '1' : ''; row.dataset.shut = one && G.folds.shut(one.title) ? '1' : ''; } };
      rel.addEventListener('lk-drawn', marks);
      rel.addEventListener('click', event => {
        const row = event.target.closest?.('.lk-fold')?.closest('.lk-row');
        if (!row || row.dataset.kids !== '1' || row.closest('.lk-rel') !== rel) return;
        event.preventDefault(); event.stopImmediatePropagation(); fold(row.dataset.uuid);
      }, true);

      // ---- the tabs
      const tabs = () => {
        const html = TABS.map(([key, word, icon]) => `<button type="button" class="lk-tab${holder.dataset.tab === key ? ' on' : ''}" data-kind="" data-tab="${key}" role="tab" aria-selected="${holder.dataset.tab === key}">${G.touch.icon(icon, 16)}${word}</button>`).join('');
        if (tabsEl.lkHtml !== html) { tabsEl.innerHTML = html; tabsEl.lkHtml = html; }
      };
      const show = tab => {
        if (tab === holder.dataset.tab) return;
        tabOf[place] = holder.dataset.tab = tab;
        lineFor(tab);
        holder.querySelector(':scope > .lk-merge')?.remove();
        tabs(); list.off(); list = mount(tab); lit = ''; lines(); bar(); past();
      };
      tabsEl.addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) show(tab.dataset.tab); });

      // ---- the row of actions: what the ticked rows can take, faint until it can be pressed
      const ICON = { merge: 'arrow-merge', up: 'arrow-up', under: 'corner-down-right', rename: 'pencil', delete: 'trash' };
      const press = (act, word, can, title = '', cls = '') => `<button type="button" class="lk-btn lk-low${cls}" data-act="${act}"${can ? '' : ' disabled'}${title ? ` title="${G.esc(title)}"` : ''}>${G.touch.icon(ICON[act], 16)}${G.esc(word)}</button>`;
      const bar = () => {
        const tab = holder.dataset.tab, set = pickedNow(), n = set.size;
        let html = '';
        if (tab === 'tags') {
          const rows = [...set].map(uuid => info.get(uuid)).filter(Boolean), top = rows.every(one => !one.depth);
          html = `<b class="lk-said">${n ? `${plural(n, 'tag')} picked` : 'Tick tags, then'}</b>` + press('merge', 'Merge…', n > 1, n > 1 ? '' : 'Tick two or more to merge them')
            + press('up', 'Move up a level', n > 0 && !top, n && top ? 'Already at the top' : '') + press('under', 'Move under…', n > 0)
            + press('rename', 'Rename', n === 1) + press('delete', 'Delete', n > 0, '', ' lk-going-btn');   // the library's red for a press that takes away
        } else if (tab === 'props') {
          html = `<b class="lk-said">${n ? `${plural(n, 'property', 'properties')} picked` : 'Tick properties, then'}</b>` + press('merge', 'Merge…', n > 1, n > 1 ? '' : 'Tick two or more to merge them') + press('rename', 'Rename', n === 1);
        }
        if (html && n) html += `<button type="button" class="lk-btn lk-low lk-pick-x" data-act="clear" aria-label="Let them go" title="Let them go">${G.touch.icon('x', 14)}</button>`;
        if (acts.lkHtml !== html) { acts.innerHTML = html; acts.lkHtml = html; }
      };
      const clear = () => { pickedNow().clear(); for (const row of rel.querySelectorAll('.lk-picked')) { row.classList.remove('lk-picked'); const tick = row.querySelector(':scope > .lk-tick'); if (tick) tick.checked = false; } bar(); };
      /* One change at a time, made of one write or of many. work(made) counts as it goes: made.steps, the steps of Logseq's
         Undo written so far (a write that answers its steps is added as answered); made.at, the row the Undo arrow stands
         after; made.said(), the line for History, said of what was written; made.undo, false where Undo would not bring back
         all that went. Where Logseq refuses one write of several, what was written before it still gets its arrow and its
         line in History, and the refusal says so. */
      let busy = false;
      const once_ = async (what, work) => {
        if (busy) return;
        busy = true; acts.toggleAttribute('data-busy', true);
        const made = { steps: 0, at: '', said: null, undo: true };
        let failed = null;
        try { await work(made); } catch (error) { failed = error; made.steps += Number(error?.steps) || 0; }
        if (made.steps > 0) {
          const arrow = made.undo && made.at;
          if (arrow) G.undo.mark(made.at, made.steps); else G.undo.clear();   // no arrow where it would not bring all of it back, nor an older one left standing
          const said = made.said?.();
          if (said) did(said, arrow ? made.at : '');
        }
        if (failed) G.write.refused(what, failed, made.steps > 0 && made.undo && !failed.left ? 'What was written before that stays: the Undo arrow takes it back.' : '');
        busy = false; acts.removeAttribute('data-busy'); G.read.forget(); list.again();
      };
      // The words of a line of History for several things, the last of them only begun where a write was refused part of the way.
      const partly = (verb, done, part, kind, tail) => !done.length && !part ? null : [['', `${verb} `], ...names(done, kind), ...(part ? [['', done.length ? ' and part of ' : 'part of '], [kind, part]] : []), ...tail];
      const fresh = async () => { G.read.forget(); const tags = await G.read.tags(); return { tags, byUuid: new Map([...tags.values()].map(tag => [tag.uuid, tag])) }; };
      // Up one level: from under its tag to under that tag's own, or to the top.
      // The tag a tag sits under is the one the outline shows it under (core/tags.js), where it has several.
      const up = uuids => once_('The tags could not all be moved', async made => {
        const { tags, byUuid } = await fresh(), moved = [];
        made.said = () => moved.length ? [['', 'Moved '], ...names(moved, 'tag'), ['', ' up a level']] : null;
        for (const uuid of uuids) {
          const tag = byUuid.get(uuid), to = tag ? G.tags.step(tag.id, tags, true) : null;
          if (to == null) continue;
          if (!made.at) made.at = uuid;   // where the arrow stands, should this very move be refused with steps left written
          const steps = await G.write.moveTag(uuid, to ? tags.get(to).uuid : '', tag.parents.map(id => tags.get(id)?.uuid).filter(Boolean));
          if (steps) { made.steps += steps; made.at = uuid; moved.push(tag.title); }
        }
        clear();
      });
      // Under a tag chosen from the whole tree, or to the top. The picked tags, and the tags under them, are not offered.
      const under = async (at, uuids) => {
        const { tags, byUuid } = await fresh(), moving_ = uuids.map(uuid => byUuid.get(uuid)).filter(Boolean);
        if (!moving_.length) return;
        const below = new Set(moving_.flatMap(tag => [...G.tags.under(tag.id, tags)])), others = new Map([...tags].filter(([id]) => !below.has(id)));
        const to = target => once_('The tags could not all be moved', async made => {
          const now = await fresh(), moved = [];
          made.said = () => moved.length ? [['', 'Moved '], ...names(moved, 'tag'), ...(target ? [['', ' under '], ['tag', target.title]] : [['', ' to the top']])] : null;
          for (const tag of moving_) {
            const was = now.byUuid.get(tag.uuid);
            if (!was || (target ? was.parents.length === 1 && now.tags.get(was.parents[0])?.uuid === target.uuid : !was.parents.length)) continue;
            if (!made.at) made.at = tag.uuid;
            const steps = await G.write.moveTag(tag.uuid, target?.uuid || '', was.parents.map(id => now.tags.get(id)?.uuid).filter(Boolean));
            if (steps) { made.steps += steps; made.at = tag.uuid; moved.push(tag.title); }
          }
          clear();
        });
        const one = moving_.length === 1 ? moving_[0] : null;
        G.menu(at, [{ group: one ? `Move ${one.title} under` : `Move ${moving_.length} picked tags under` }, ...G.tags.tree(others).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: !!one && one.parents.includes(tag.id), take: () => to(tag) })),
          { gap: true }, { word: 'The top', take: () => to(null) }], { find: 'A tag' });
      };
      // The name in place: the row's line gives way to a field; Enter writes it, Escape or a press elsewhere leaves it.
      const rename = uuid => {
        const row = rel.querySelector(`:is(.lk-rows > .lk-row, .lk-trow)[data-uuid="${uuid}"]`), was = info.get(uuid)?.title || '';
        if (!row || row.querySelector('.lk-rename')) return;
        const field = doc.createElement('input'); field.type = 'text'; field.className = 'lk-field lk-rename'; field.value = was; field.spellcheck = false; field.setAttribute('aria-label', `New name for ${was}`);
        row.classList.add('lk-renaming'); (row.classList.contains('lk-trow') ? row.querySelector(':scope > .lk-td') : row).appendChild(field); field.focus(); field.select();
        const kind = isTag(row) ? 'tag' : 'prop';
        let gone = false;
        const leave = () => { if (gone) return; gone = true; field.remove(); row.classList.remove('lk-renaming'); };
        field.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); leave(); (row.querySelector(':scope > .lk-line') || row).focus({ preventScroll: true }); }
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const name = field.value.trim();
          leave();
          if (!name || name === was) return;
          once_('It could not be renamed', async made => { made.at = uuid; made.said = () => [['', 'Renamed '], [kind, was], ['', ' to '], [kind, name]]; await G.write.rename(uuid, name); made.steps = 1; clear(); });
        });
        for (const type of ['click', 'mousedown', 'contextmenu']) field.addEventListener(type, event => event.stopPropagation());
        field.addEventListener('blur', leave);
      };
      /* A tag or a property is deleted by the one shared way (node/ask.js remove), from the row of actions as from any row's
         menu: the red question under the first ticked row that is drawn counts what truly goes. What follows a delete, however
         it was started, is heard below (G.ask.removed): the ticks go and the list is read again. */
      const remove = uuids => { const row = uuids.map(uuid => rel.querySelector(`:is(.lk-rows > .lk-row, .lk-trow)[data-uuid="${uuid}"]`)).find(Boolean); if (row) G.ask.remove(row, uuids); };
      const offRemoved = G.ask.removed(() => { clear(); G.read.forget(); list.again(); });
      acts.addEventListener('click', event => {
        const at = event.target.closest('[data-act]');
        if (!at || at.disabled || busy) return;
        const act = at.dataset.act, uuids = [...pickedNow()], tab = holder.dataset.tab;
        if (act === 'clear') clear();
        else if (act === 'up') up(uuids);
        else if (act === 'under') under(at, uuids);
        else if (act === 'rename') rename(uuids[0]);
        else if (act === 'delete') remove(uuids);
        else if (act === 'merge') (tab === 'props' ? mergeProps : mergeTags)(uuids).catch(error => G.write.refused('The merge could not be read', error, 'Nothing was changed.'));
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
            yes: () => { close(); once_('The tags could not all be merged', async made => {
              const done = []; let part = '';
              made.at = kept.uuid; made.said = () => partly('Merged', done, part, 'tag', [['', ' into '], ['tag', kept.title]]);
              for (const tag of gone) {
                const before = made.steps;
                try { await mergeTag(tag, kept, made); } catch (error) { if (made.steps > before) part = tag.title; throw error; }
                done.push(tag.title);
              }
              clear();
            }); },
          });
        };
        await draw_();
      };
      // One tag merged into another. Each write is counted as it is made (made.steps), so a merge refused part of the way
      // still knows how many steps of Logseq's Undo take back what it wrote.
      const mergeTag = async (gone, kept, made) => {
        const { props } = await G.read.schema(), r = await G.read.reach(gone.id), link = new RegExp(`\\[\\[${gone.uuid}\\]\\]`, 'gi');
        for (const one of r.named) { const words = one.words.replace(link, `[[${kept.uuid}]]`); if (words !== one.words) { await G.write.setWords(one.uuid, words); made.steps++; } }   // links in the words follow
        for (const one of r.held) { const raws = [...new Set(one.raws.map(raw => raw === gone.id ? kept.id : raw))], prop = props.get(one.ident); made.steps += await G.write.setValues(one.uuid, one.ident, raws, { ref: true, many: !!prop?.many }); }
        for (const one of r.ranges) { await G.write.range(one.uuid, [...new Set(one.ids.map(id => id === gone.id ? kept.id : id))]); made.steps++; }
        G.read.forget();
        const now = await G.read.reach(gone.id), has = new Set((await G.read.reach(kept.id)).tagged);
        for (const uuid of now.tagged) { if (!has.has(uuid)) { await G.write.tag(uuid, kept.uuid); made.steps++; } await G.write.untag(uuid, gone.uuid); made.steps++; }
        const keptProps = (await G.read.reach(kept.id)).props, more_ = now.props.filter(id => !keptProps.includes(id));
        if (more_.length) { await G.write.tagProperties(kept.uuid, [...keptProps, ...more_]); made.steps++; }
        G.read.forget();
        const tags = await G.read.tags(), keptTag = tags.get(kept.id), goneTag = tags.get(gone.id);
        for (const kid of [...tags.values()].filter(one => one.parents.includes(gone.id))) {
          if (kid.id === kept.id) made.steps += await G.write.moveTag(kept.uuid, goneTag.parents[0] && goneTag.parents[0] !== kept.id ? tags.get(goneTag.parents[0])?.uuid || '' : '', [gone.uuid]);   // the kept tag stood under the other: it takes its place
          else made.steps += await G.write.moveTag(kid.uuid, kid.parents.includes(kept.id) || G.tags.under(kid.id, tags).has(kept.id) ? '' : keptTag.uuid, [gone.uuid]);
        }
        for (const uuid of now.bullets) { await G.write.toPage(uuid, kept.uuid); made.steps++; }
        await G.write.remove(gone.uuid, true); made.steps++;
      };
      /* Properties: the one most nodes hold is kept unless another is chosen; the others' values go into it and the tags that gave
         them give it. The properties are decided together (core/move.js merge), each on what the kept one will hold once the
         ones before it are in: a node that holds a value under two of them gets both, and no value is left under no property.
         A node the kept property would give a second value to, where it takes one, keeps its own under the property it stood
         under; so does a value that has bullets written under it; the box says how many of each. The merged property stays,
         empty, as before the rebuild: a property deleted and brought back by Logseq's Undo comes back as another item, and what
         pointed at it would not follow (found by hand, 26 November 2026). */
      const mergeProps = async uuids => {
        const [{ props: schema, byTag }, all] = await Promise.all([(G.read.forget(), G.read.schema()), G.read.properties()]);
        const chosen = uuids.map(uuid => [...all.values()].find(prop => prop.uuid === uuid)).filter(Boolean).map(prop => schema.get(prop.ident) && { ...schema.get(prop.ident), uuid: prop.uuid });
        if (chosen.length < 2 || chosen.some(prop => !prop)) return;
        const holders = new Map(await Promise.all(chosen.map(async prop => [prop.ident, await G.read.holders(prop.ident)])));
        chosen.sort((a, b) => holders.get(b.ident).length - holders.get(a.ident).length || a.title.localeCompare(b.title));
        let kept = chosen[0];
        const draw_ = async () => {
          const gone = chosen.filter(prop => prop !== kept), plans = G.move.merge({ kept, held: holders.get(kept.ident), gone: gone.map(prop => ({ prop, nodes: holders.get(prop.ident) })) });
          const refused = plans.find(({ made }) => made.refused && made.rows.length === 0 && made.refused.includes('different'))?.made.refused || '';
          const rows = plans.flatMap(({ prop, made }) => made.rows.filter(row => !row.skip).map(row => ({ prop, row }))), leftFor = why => plans.reduce((n, { made }) => n + (made.left.find(one => one.why === why)?.n || 0), 0);
          const changed = new Set(rows.map(one => one.row.uuid)).size, own = leftFor('one'), under_ = leftFor('under'), keeps = n => `${plural(n, 'node')} ${n === 1 ? 'keeps its' : 'keep their'} own`;
          const nodes = await G.read.byUuids(rows.slice(0, 4).map(one => one.row.uuid)), say = await wordsOf(nodes), few = (values, cls) => values.map(value => `<span class="${cls}">${G.esc(value.text || '—')}</span>`).join(', ');
          const close = ask(`<div class="lk-ask-head">Merge ${saidHtml(names(gone.map(prop => prop.title), 'prop'))} into <span class="lk-prop">${G.esc(kept.title)}</span></div>
${!refused && rows.length ? `<div class="lk-ask-rows">${rows.slice(0, 4).map(({ prop, row }, i) => `<div class="lk-ask-row"><div class="lk-ask-words">${G.esc(nodes[i] ? say(nodes[i]) : row.words || 'Untitled')}</div><div><span class="lk-prop">${G.esc(prop.title)}</span> ${few(row.goes, 'lk-going')}</div><div><span class="lk-prop">${G.esc(kept.title)}</span> ${[few(row.stays, ''), few(row.comes, 'lk-coming')].filter(Boolean).join(', ') || '—'}</div></div>`).join('')}${rows.length > 4 ? `<div class="lk-ask-more">and ${rows.length - 4} more</div>` : ''}</div>` : ''}
<div class="lk-ask-note">${refused ? G.esc(refused) : `${plural(changed, 'node')}${own ? ` · ${keeps(own)}, as ${G.esc(kept.title)} takes one value` : ''}${under_ ? ` · ${keeps(under_)}, as a value that has bullets written under it stays where it is` : ''}`}</div>${answers('Merge', !refused, chosen.length === 2 ? 'Keep the other name' : 'Keep another name…')}`, {
            other: at => { if (chosen.length === 2) { kept = chosen.find(prop => prop !== kept); draw_(); } else G.menu(at, chosen.map(prop => ({ word: prop.title, face: 'prop', on: prop === kept, take: () => { kept = prop; draw_(); } }))); },
            yes: () => { if (refused) return; close(); once_('The properties could not all be merged', async made => {
              const done = []; let part = '';
              made.at = kept.uuid; made.said = () => partly('Merged', done, part, 'prop', [['', ' into '], ['prop', kept.title]]);
              const REF = ['node', 'date', 'asset'].includes(kept.type);
              for (const { prop, made: planned } of plans) {
                const before = made.steps;
                try {
                  for (const row of planned.rows.filter(one => !one.skip)) {
                    if (row.comes.length) made.steps += await G.write.setValues(row.uuid, kept.ident, [...row.stays, ...row.comes].map(value => value.raw), { ref: REF, many: kept.many });
                    made.steps += await G.write.setValues(row.uuid, prop.ident, [], {});
                  }
                  // The tags that gave the merged property give the kept one.
                  for (const [tagId, idents] of byTag) if (idents.includes(prop.ident)) {
                    const tag = tagIndex.get(tagId), now = (await G.read.reach(tagId)).props, keptId = (await G.read.node(kept.uuid))?.id, propId = (await G.read.node(prop.uuid))?.id;
                    if (!tag || !keptId) continue;
                    await G.write.tagProperties(tag.uuid, [...new Set(now.filter(id => id !== propId).concat(keptId))]); made.steps++;
                  }
                } catch (error) { if (made.steps > before) part = prop.title; throw error; }
                done.push(prop.title);
              }
              clear();
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
        // The newest line, where it is the change the Undo arrow stands for: the library's arrow after its words, while it stands.
        if (lines.length && standing && standing.when === lines[0].when) G.undo.beside(history_.firstElementChild.lastElementChild, standing.uuid);
      };
      listeners.add(past);
      tabs(); bar(); past();
      rel.addEventListener('lk-drawn', bar);
      let offSide = null;
      if (wide) {   // the outline beside a page you are reading: one press away
        const side = doc.createElement('button'); side.type = 'button'; side.className = 'lk-btn lk-side'; side.textContent = 'In the sidebar';
        const values = G.moving ? doc.createElement('button') : null;   // only where Move values runs
        if (values) { values.type = 'button'; values.className = 'lk-btn lk-values'; values.textContent = 'Move values…'; }
        const open = () => section.open(), ask_ = () => G.moving?.ask(holder, {});
        side.addEventListener('click', open); values?.addEventListener('click', ask_); (holder.querySelector(':scope > .lk-add') || holder.firstElementChild).after(...(values ? [values, side] : [side]));
        offSide = () => { side.removeEventListener('click', open); values?.removeEventListener('click', ask_); side.remove(); values?.remove(); };
      }
      return () => { offFoot(); foot.remove(); sized?.disconnect(); offSide?.(); offRemoved(); field?.removeEventListener('input', onFind); field?.parentElement.removeEventListener('keydown', onFindKey, true); offAdd(); list.off(); listeners.delete(past); };
    };
    const section = G.touch.section('lk-ontology', 'Ontology', holder => draw(holder, false), TREE);
    const page = G.touch.page('lk-ontology', 'Ontology', holder => draw(holder, true));
    base.onStop(section.off); base.onStop(page.off); base.onStop(() => { delete G.tending; });
    G.touch.command('lk-ontology', 'Ontology', page.open);
    G.touch.command('lk-ontology-side', 'Ontology in the sidebar', section.open);
  },
});
})();
