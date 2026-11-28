/* NODE: the one table. Nodes in rows under named columns, as Ontology's table of properties drew them before the rebuild (0.5.17;
   the owner, 26 November 2026, "I like before version"): a head of column names, a press on one sorting the rows by it with an
   arrow after its name (a second press turns the order round), hairlines between the rows and the columns, a tick box in the
   margin at each row's left, the last column's numbers at its right edge. Kept true while the graph changes.
     G.table(el, opts)   opts: columns: [{ key, word, cell(row) -> html, by(row) -> what it sorts by (a number or words),
                               width: the column's track (CSS grid), min: the least it takes in pixels, end: true for numbers
                               set at the right }],
                         read() -> rows, each { uuid, … } (a row is the node it shows, data-uuid on its element),
                         sort: { key, dir: 1 up | -1 down } at the start, sorted(sort) told of every change of it,
                         tie(row) -> words that order rows the sort finds equal,
                         ticks: { has(uuid), flip(uuid, row, ticked) }, key(row, event) -> true when the place takes a key,
                         press(row, event) -> true when the place takes a press inside a row (a cell's ▾),
                         more(row, at) -> the place's own lines for a row's right-click menu (node/line.js's menu), face: the
                         rows' kind for that menu ('tag' or 'prop'), none: what is said when there are no rows.
                         Gives back { again(), off() }; el is told 'lk-drawn' after each drawing.
   In a cell: a.lk-tag[data-to] and a[data-to] go to a node's page (Shift: in the sidebar), a button.lk-change is a ▾ that
   opens what the place offers. The name a row's Undo arrow stands after is the first cell's .lk-words.
   The keys: Up and Down walk the rows (Up from the first goes to the sorted column's name), Enter goes to the row's page, a
   column's name is a press (Enter or Space sorts, Down goes to the first row). The
   table scrolls sideways inside its own box where the room is narrower than its columns, never past the window.
   Groups of rows (Ontology's property groups, as 0.5.17 had them: the owner, 28 November 2026, "B. Groups, as in 0.5.17"):
                         groups: { layout(rows) -> [{ kind: 'group', id, name, depth, n, open } | { kind: 'row', row, depth,
                                   in }] the rows (in the table's order) laid out in groups (core/groups.js layout),
                                   fold(id, open) the place keeps a group folded or open, press(id, event) -> true when the
                                   place takes a press on a group's name, key(id, event) -> true when it takes a key on a
                                   group's line, more(id, at) -> the lines of a group's right-click menu (G.menu),
                                   can(what, to) / drop(what, to): a row ({ uuid }) or a group ({ group: id }) dragged onto a
                                   group's line or onto a row (to: that group's id, or the row's group, null for none) }
   A group's line is the library's group head across the whole table: Logseq's fold arrow, the name in the small bold, how many
   rows it holds after the name (none said while it holds none); its rows and its groups one step in. The arrow, Space,
   Cmd-Up and Cmd-Down fold it, and what it holds rolls up or out (G.node.moved). The Undo arrow of a change to a group stands
   after its name and count: G.undo.own(`lk-group-${id}`, putBack). The lines are kept from one drawing to the next where they
   did not change, so a line keeps the keys and nothing that stays is drawn anew. */
(function () {
const G = window.PluginDoor;
G.table = (el, opts) => {
  const doc = el.ownerDocument, cols = opts.columns, grouped = opts.groups || null;
  let sort = { ...(opts.sort || { key: cols[0].key, dir: 1 }) }, rows = [], turn = 0, gone = false, dragging = null;
  const box = doc.createElement('div'); box.className = 'lk-table'; if (opts.face) box.dataset.face = opts.face;
  box.style.setProperty('--lk-cols', cols.map(col => col.width || 'minmax(0, 1fr)').join(' '));
  box.style.setProperty('--lk-min', cols.reduce((n, col) => n + (col.min || 0), 0) + 'px');   // narrower than this, the table scrolls sideways
  const grid = doc.createElement('div'); grid.className = 'lk-tgrid'; grid.setAttribute('role', 'table'); box.appendChild(grid);
  el.replaceChildren(box);
  const order = () => {
    const col = cols.find(one => one.key === sort.key) || cols[0], tie = opts.tie || (() => '');
    const value = row => col.by(row);
    return [...rows].sort((a, b) => { const x = value(a), y = value(b); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return (c * sort.dir) || String(tie(a)).localeCompare(String(tie(b))); });
  };
  const head = () => `<div class="lk-thead" role="row">${cols.map(col => { const on = col.key === sort.key; return `<button type="button" class="lk-th${on ? ' on' : ''}${col.end ? ' lk-end' : ''}" role="columnheader" data-sort="${G.esc(col.key)}" aria-sort="${on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${G.esc(col.word)}${on ? `<span class="lk-sortmark" aria-hidden="true">${sort.dir > 0 ? '↑' : '↓'}</span>` : ''}</button>`; }).join('')}</div>`;
  const line = (row, depth, at, drag) => `<div class="lk-trow${opts.ticks?.has(row.uuid) ? ' lk-picked' : ''}" role="row" tabindex="0" data-uuid="${G.esc(row.uuid)}"${row.held != null ? ` data-held="${Number(row.held) || 0}"` : ''}${grouped ? ` data-in="${G.esc(at || '')}"` : ''}${depth ? ` data-depth style="--lk-depth: ${depth}"` : ''}${drag ? ' draggable="true"' : ''}>${opts.ticks ? `<input type="checkbox" class="lk-tick" aria-label="Pick this row"${opts.ticks.has(row.uuid) ? ' checked' : ''}>` : ''}${cols.map(col => `<div class="lk-td${col.end ? ' lk-end' : ''}" role="cell">${col.cell(row)}</div>`).join('')}</div>`;
  // A group's line. Whether it is open is set on the line itself, so a fold keeps the line and turns its arrow.
  const heading = item => `<div class="lk-group-head lk-tgroup" role="row" tabindex="0" data-group="${G.esc(item.id)}" data-undo="lk-group-${G.esc(item.id)}"${item.depth ? ` style="--lk-depth: ${item.depth}"` : ''}${grouped.drop ? ' draggable="true"' : ''}><button type="button" class="lk-fold" tabindex="-1" aria-label="Fold or unfold ${G.esc(item.name)}">${G.node.CHEV}</button><span class="lk-tgroup-words"><span class="lk-group-name">${G.esc(item.name)}</span>${item.n ? `<span class="lk-n">${item.n}</span>` : ''}</span></div>`;
  const parts = () => {
    const sorted = order(), items = grouped ? grouped.layout(sorted) : sorted.map(row => ({ kind: 'row', row, depth: 0, in: null }));
    const drag = !!grouped?.drop && items.some(item => item.kind === 'group');
    const out = [['head', head()]];
    for (const item of items) out.push(item.kind === 'group' ? [`g:${item.id}`, heading(item), item] : [`r:${item.row.uuid}`, line(item.row, item.depth, item.in, drag)]);
    if (!items.length) out.push(['none', `<div class="lk-none">${G.esc(opts.none || '')}</div>`]);
    return out;
  };
  const make = html => { const t = doc.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; };
  const draw = () => {
    if (gone) return;
    const active = doc.activeElement, inside = box.contains(active), was = active?.closest?.('.lk-trow')?.dataset.uuid, group = active?.closest?.('.lk-tgroup')?.dataset.group, headAt = active?.closest?.('.lk-th')?.dataset.sort, left = box.scrollLeft;
    const had = new Map([...grid.children].map(child => [child.lkKey, child]));
    const next = parts().map(([key, html, item]) => {
      const old = had.get(key), el_ = old && old.lkHtml === html ? old : make(html);
      el_.lkKey = key; el_.lkHtml = html;
      if (item) { el_.setAttribute('aria-expanded', String(item.open)); el_.lkItem = item; }
      return el_;
    });
    next.forEach((child, i) => { if (grid.children[i] !== child) grid.insertBefore(child, grid.children[i] || null); });
    while (grid.children.length > next.length) grid.lastElementChild.remove();
    box.scrollLeft = left;
    for (const row of grid.querySelectorAll('.lk-trow')) G.undo.dress(row);
    for (const line_ of grid.querySelectorAll('.lk-tgroup')) G.undo.beside(line_.querySelector('.lk-tgroup-words'), line_.dataset.undo);
    if (inside && !box.contains(doc.activeElement)) (was && grid.querySelector(`.lk-trow[data-uuid="${was}"]`) || group && grid.querySelector(`.lk-tgroup[data-group="${group}"]`) || headAt && grid.querySelector(`.lk-th[data-sort="${headAt}"]`))?.focus({ preventScroll: true });
    el.dispatchEvent(new (doc.defaultView.CustomEvent)('lk-drawn'));
  };
  const load = async () => {
    const mine = ++turn;
    try { const got = await opts.read(); if (mine !== turn || gone) return; rows = got; draw(); }
    catch (error) { console.error('Logseq Plugin: a table could not be read', error); }
  };
  // A group folded or unfolded: what it holds rolls up or out, the rest moves with it.
  const fold = (line_, open) => {
    const item = line_.lkItem;
    if (!item || item.open === open) return;
    G.node.moved(grid, () => { grouped.fold(item.id, open); draw(); });
  };
  const rowOf = target => target.closest?.('.lk-trow');
  const lineOf = target => target.closest?.('.lk-tgroup');
  const sortBy = th => { sort = th.dataset.sort === sort.key ? { key: sort.key, dir: -sort.dir } : { key: th.dataset.sort, dir: 1 }; opts.sorted?.(sort); draw(); };
  const onClick = event => {
    const target = event.target, th = target.closest('.lk-th');
    if (th) { sortBy(th); return; }
    const group = lineOf(target);
    if (group) {
      if (target.closest('.lk-undo')) return;
      if (target.closest('.lk-fold')) { event.preventDefault(); fold(group, !group.lkItem?.open); return; }
      if (target.closest('.lk-group-name') && grouped.press?.(group.dataset.group, event)) return;
      group.focus({ preventScroll: true });
      return;
    }
    const row = rowOf(target);
    if (!row) return;
    if (target.matches('.lk-tick')) { event.stopPropagation(); row.classList.toggle('lk-picked', target.checked); opts.ticks?.flip(row.dataset.uuid, row, target.checked); return; }
    if (opts.press?.(row, event)) return;
    const link = target.closest('a[data-to]');
    if (link) { event.preventDefault(); G.touch.open(link.dataset.to, event.shiftKey); return; }
    if (!target.closest('button, input')) row.focus({ preventScroll: true });
  };
  // The lines the keys walk: the rows and the groups' lines, in their order.
  const walk = (from, by) => { const all = [...grid.querySelectorAll('.lk-trow, .lk-tgroup')], at = all.indexOf(from); return all[at + by] || (at === 0 && by < 0 ? grid.querySelector(`.lk-th[data-sort="${sort.key}"]`) : null); };
  const onKey = event => {
    const th = event.target.closest?.('.lk-th');   // Logseq takes Enter before a button hears it: the column's name is pressed here
    if (th && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); sortBy(th); return; }
    if (th && event.key === 'ArrowDown') { event.preventDefault(); grid.querySelector('.lk-trow, .lk-tgroup')?.focus(); return; }
    const group = lineOf(event.target);
    if (group && event.target === group) {
      if (grouped.key?.(group.dataset.group, event)) { event.preventDefault(); event.stopPropagation(); return; }
      const meta = event.metaKey || event.ctrlKey;
      if (event.key === ' ' || (meta && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) fold(group, event.key === ' ' ? !group.lkItem?.open : event.key === 'ArrowDown');   // Space, and Logseq's own keys for folding
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') walk(group, event.key === 'ArrowDown' ? 1 : -1)?.focus();
      else return;
      event.preventDefault(); event.stopPropagation(); return;
    }
    const row = rowOf(event.target);
    if (!row || event.target !== row) return;
    if (opts.key?.(row, event)) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') walk(row, event.key === 'ArrowDown' ? 1 : -1)?.focus();
    else if (event.key === 'Enter') G.touch.open(row.dataset.uuid, event.shiftKey);
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  const onMenu = event => {
    const group = lineOf(event.target);
    if (group) { event.preventDefault(); const lines = grouped.more?.(group.dataset.group, { x: event.clientX, y: event.clientY, from: group }); if (lines?.length) G.menu({ x: event.clientX, y: event.clientY, from: group }, lines); return; }
    const row = rowOf(event.target);
    if (!row) return;
    event.preventDefault();
    G.line.menu({ x: event.clientX, y: event.clientY, from: row }, row, opts.more);
  };
  /* Dragging, where the table is in groups: a row or a group's line dragged onto a group's line goes into that group, onto a row
     into that row's group (a row in none: out of every group). Where it would go is lit, as a list's head is lit for a drop. */
  let lit = null;
  const unlight = () => { if (lit) delete lit.dataset.drop; lit = null; };
  const target = event => { const at = event.target.closest?.('.lk-tgroup, .lk-trow'); return at && grid.contains(at) ? at : null; };
  const toOf = at => at.classList.contains('lk-tgroup') ? at.dataset.group : (at.dataset.in || null);
  const onDragStart = event => {
    const at = event.target.closest?.('.lk-trow[draggable], .lk-tgroup[draggable]');
    if (!at || !grouped?.drop) return;
    dragging = at.classList.contains('lk-tgroup') ? { group: at.dataset.group } : { uuid: at.dataset.uuid };
    try { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', (at.querySelector('.lk-group-name, .lk-td') || at).textContent.trim().slice(0, 60)); } catch (error) { /* a plain event */ }
  };
  const onDragOver = event => {
    if (!dragging) return;
    const at = target(event);
    if (!at || !(grouped.can?.(dragging, toOf(at)) ?? true)) { unlight(); return; }
    event.preventDefault();
    try { event.dataTransfer.dropEffect = 'move'; } catch (error) { /* ditto */ }
    if (lit !== at) { unlight(); lit = at; at.dataset.drop = 'into'; }
  };
  const onDrop = event => {
    const what = dragging, at = target(event);
    unlight(); dragging = null;
    if (!what || !at || !(grouped.can?.(what, toOf(at)) ?? true)) return;
    event.preventDefault();
    grouped.drop(what, toOf(at));
  };
  const onDragEnd = () => { unlight(); dragging = null; };
  const onDragLeave = event => { if (!box.contains(event.relatedTarget)) unlight(); };
  const ears = [['click', onClick], ['keydown', onKey], ['contextmenu', onMenu], ['dragstart', onDragStart], ['dragover', onDragOver], ['drop', onDrop], ['dragend', onDragEnd], ['dragleave', onDragLeave]];
  for (const [type, fn] of ears) box.addEventListener(type, fn);
  const onClosed = () => { G.read.forget(); load(); };   // a row deleted from its menu
  box.addEventListener('lk-closed', onClosed);
  const offChanged = G.node.follow(load);   // as the lists: read again after a change, but not at every pause of a bullet being written
  load();
  return {
    again: load,
    off() { gone = true; offChanged(); for (const [type, fn] of ears) box.removeEventListener(type, fn); box.removeEventListener('lk-closed', onClosed); el.replaceChildren(); },
  };
};
/* The look, measured on the table of 0.5.17: the words at the size of a window's lines, a row at least 32 tall, a hairline under
   each row and between the columns, 4 and 12 of room in a cell, the head's names quiet and the sorted one in the ink and bold
   with its arrow after it, the tick boxes in a margin 36 wide at the left. */
G.table.CSS = `
.lk-table { position: relative; max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-left: 36px; box-sizing: border-box; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); color: var(--lk-text); }
.lk-tgrid { min-width: var(--lk-min, 0px); }
.lk-thead, .lk-trow { position: relative; display: grid; grid-template-columns: var(--lk-cols); align-items: center; min-height: 32px; border-bottom: 1px solid var(--lk-hair); }
.lk-thead > *, .lk-trow > .lk-td { box-sizing: border-box; min-width: 0; padding: 4px 12px; border-left: 1px solid var(--lk-hair); }
.lk-thead > :first-child, .lk-trow > .lk-td:first-of-type { border-left: 0; padding-left: 4px; }
.lk-th { appearance: none; display: flex; align-items: center; height: 100%; margin: 0; border-top: 0; border-right: 0; border-bottom: 0; border-radius: 0; background: none; font: inherit; color: var(--lk-quiet); font-weight: 400; text-align: left; white-space: nowrap; cursor: pointer; }
.lk-th:hover, .lk-th:focus-visible { color: var(--lk-text); outline: none; }
.lk-th:focus-visible { background: var(--lk-wash); }
.lk-th.on { color: var(--lk-text); font-weight: 600; }
.lk-th.lk-end { justify-content: flex-start; }
.lk-sortmark { margin-left: 5px; font-weight: 400; }
.lk-trow { outline: none; }
.lk-trow:focus-visible, .lk-trow:focus-within:not(:has(.lk-tick:focus)) { background: var(--lk-wash); }
.lk-trow.lk-picked { background: var(--lk-wash); }
.lk-trow > input.lk-tick[type=checkbox] { position: absolute; left: -34px; top: 50%; margin: 0; transform: translateY(-50%); }
.lk-td { display: flex; align-items: center; gap: 6px; }
.lk-td > .lk-words { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-td > .lk-undo { flex: none; margin: 0; }   /* the Undo arrow after a row's name stands beside the words, not inside them: inside, the words' cut-off end hid it from the pointer (found in round rundown-070: no table row's arrow could be pressed); a long name is cut before it */
.lk-td.lk-end { justify-content: flex-end; font-variant-numeric: tabular-nums; white-space: nowrap; }
.lk-td .lk-change { flex: none; padding: 0 2px; font-size: var(--lk-line-size); }
.lk-td .lk-change::after { width: 1.05em; height: 1.05em; margin-left: 0; }   /* the ▾ at the size of the cell's words, as 0.5.17 drew it */
.lk-td a[data-to] { cursor: pointer; }
.lk-td a.lk-tag { font-size: inherit; }
.lk-td .lk-sep { color: var(--lk-quiet); }
.lk-td .lk-off { color: var(--lk-quiet); }
.lk-table > .lk-tgrid > .lk-none { padding: 8px 4px; color: var(--lk-quiet); }
/* Groups: a group's line is the library's group head (its fold arrow, its small bold name, its count after the name) laid
   across the table as a row of it, with a row's height and hairline; what a group holds stands one step in, a step being the
   room of a mark and its gap, so a group's rows start one step past its name and a group inside it has its arrow under that
   name, as in Logseq's outline. Where a dragged row or group would go is lit, as a list's head is lit for a drop. */
.lk-table .lk-tgroup { margin: 0; min-height: 32px; box-sizing: border-box; padding: 0 12px 0 calc(4px + var(--lk-depth, 0) * (var(--lk-mark-box) + var(--lk-mark-gap))); border-radius: 0; border-bottom: 1px solid var(--lk-hair); outline: none; }
.lk-tgroup > .lk-fold { flex: none; }
.lk-tgroup-words { display: inline-flex; align-items: baseline; min-width: 0; }
.lk-tgroup-words > .lk-group-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: text; }
.lk-tgroup-words > .lk-n { flex: none; }
.lk-trow[data-depth] > .lk-td:first-of-type { padding-left: calc(4px + (var(--lk-depth, 0) + 1) * (var(--lk-mark-box) + var(--lk-mark-gap))); }
.lk-table [data-drop="into"] { background: var(--lk-lit); }
.lk-tgrid > .lk-trow[style*="overflow"] { border-bottom-color: transparent; overflow: visible !important; clip-path: inset(0 0 0 -40px); }   /* a row rolling up or out (G.node.moved holds it short and cuts what overflows it) draws no hairline, since the hairlines of rows held short would lie on one another in a grey band, and is cut at its top and foot only, so its tick box in the margin rolls with it instead of going at once */
.lk-tgroup > .lk-rename { flex: 1 1 auto; }`;
})();
