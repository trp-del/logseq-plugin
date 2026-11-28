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
   table scrolls sideways inside its own box where the room is narrower than its columns, never past the window. */
(function () {
const G = window.PluginDoor;
G.table = (el, opts) => {
  const doc = el.ownerDocument, cols = opts.columns;
  let sort = { ...(opts.sort || { key: cols[0].key, dir: 1 }) }, rows = [], turn = 0, gone = false;
  const box = doc.createElement('div'); box.className = 'lk-table'; if (opts.face) box.dataset.face = opts.face;
  box.style.setProperty('--lk-cols', cols.map(col => col.width || 'minmax(0, 1fr)').join(' '));
  box.style.setProperty('--lk-min', cols.reduce((n, col) => n + (col.min || 0), 0) + 'px');   // narrower than this, the table scrolls sideways
  el.replaceChildren(box);
  const order = () => {
    const col = cols.find(one => one.key === sort.key) || cols[0], tie = opts.tie || (() => '');
    const value = row => col.by(row);
    return [...rows].sort((a, b) => { const x = value(a), y = value(b); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return (c * sort.dir) || String(tie(a)).localeCompare(String(tie(b))); });
  };
  const head = () => `<div class="lk-thead" role="row">${cols.map(col => { const on = col.key === sort.key; return `<button type="button" class="lk-th${on ? ' on' : ''}${col.end ? ' lk-end' : ''}" role="columnheader" data-sort="${G.esc(col.key)}" aria-sort="${on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${G.esc(col.word)}${on ? `<span class="lk-sortmark" aria-hidden="true">${sort.dir > 0 ? '↑' : '↓'}</span>` : ''}</button>`; }).join('')}</div>`;
  const line = row => `<div class="lk-trow${opts.ticks?.has(row.uuid) ? ' lk-picked' : ''}" role="row" tabindex="0" data-uuid="${G.esc(row.uuid)}"${row.held != null ? ` data-held="${Number(row.held) || 0}"` : ''}>${opts.ticks ? `<input type="checkbox" class="lk-tick" aria-label="Pick this row"${opts.ticks.has(row.uuid) ? ' checked' : ''}>` : ''}${cols.map(col => `<div class="lk-td${col.end ? ' lk-end' : ''}" role="cell">${col.cell(row)}</div>`).join('')}</div>`;
  const draw = () => {
    if (gone) return;
    const was = doc.activeElement?.closest?.('.lk-trow')?.dataset.uuid, inside = box.contains(doc.activeElement), headAt = doc.activeElement?.closest?.('.lk-th')?.dataset.sort, left = box.scrollLeft;
    box.innerHTML = `<div class="lk-tgrid" role="table">${head()}${rows.length ? order().map(line).join('') : `<div class="lk-none">${G.esc(opts.none || '')}</div>`}</div>`;
    box.scrollLeft = left;
    for (const row of box.querySelectorAll('.lk-trow')) G.undo.dress(row);
    if (inside) (was && box.querySelector(`.lk-trow[data-uuid="${was}"]`) || headAt && box.querySelector(`.lk-th[data-sort="${headAt}"]`))?.focus({ preventScroll: true });
    el.dispatchEvent(new (doc.defaultView.CustomEvent)('lk-drawn'));
  };
  const load = async () => {
    const mine = ++turn;
    try { const got = await opts.read(); if (mine !== turn || gone) return; rows = got; draw(); }
    catch (error) { console.error('Logseq Plugin: a table could not be read', error); }
  };
  const rowOf = target => target.closest?.('.lk-trow');
  const sortBy = th => { sort = th.dataset.sort === sort.key ? { key: sort.key, dir: -sort.dir } : { key: th.dataset.sort, dir: 1 }; opts.sorted?.(sort); draw(); };
  const onClick = event => {
    const target = event.target, th = target.closest('.lk-th');
    if (th) { sortBy(th); return; }
    const row = rowOf(target);
    if (!row) return;
    if (target.matches('.lk-tick')) { event.stopPropagation(); row.classList.toggle('lk-picked', target.checked); opts.ticks?.flip(row.dataset.uuid, row, target.checked); return; }
    if (opts.press?.(row, event)) return;
    const link = target.closest('a[data-to]');
    if (link) { event.preventDefault(); G.touch.open(link.dataset.to, event.shiftKey); return; }
    if (!target.closest('button, input')) row.focus({ preventScroll: true });
  };
  const onKey = event => {
    const th = event.target.closest?.('.lk-th');   // Logseq takes Enter before a button hears it: the column's name is pressed here
    if (th && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); sortBy(th); return; }
    if (th && event.key === 'ArrowDown') { event.preventDefault(); box.querySelector('.lk-trow')?.focus(); return; }
    const row = rowOf(event.target);
    if (!row || event.target !== row) return;
    if (opts.key?.(row, event)) { event.preventDefault(); event.stopPropagation(); return; }
    const all = [...box.querySelectorAll('.lk-trow')], at = all.indexOf(row);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') (all[at + (event.key === 'ArrowDown' ? 1 : -1)] || (at === 0 && event.key === 'ArrowUp' ? box.querySelector(`.lk-th[data-sort="${sort.key}"]`) : null))?.focus();
    else if (event.key === 'Enter') G.touch.open(row.dataset.uuid, event.shiftKey);
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  const onMenu = event => {
    const row = rowOf(event.target);
    if (!row) return;
    event.preventDefault();
    G.line.menu({ x: event.clientX, y: event.clientY, from: row }, row, opts.more);
  };
  box.addEventListener('click', onClick); box.addEventListener('keydown', onKey); box.addEventListener('contextmenu', onMenu);
  const onClosed = () => { G.read.forget(); load(); };   // a row deleted from its menu
  box.addEventListener('lk-closed', onClosed);
  const offChanged = G.node.follow(load);   // as the lists: read again after a change, but not at every pause of a bullet being written
  load();
  return {
    again: load,
    off() { gone = true; offChanged(); box.removeEventListener('click', onClick); box.removeEventListener('keydown', onKey); box.removeEventListener('contextmenu', onMenu); box.removeEventListener('lk-closed', onClosed); el.replaceChildren(); },
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
.lk-td.lk-end { justify-content: flex-end; font-variant-numeric: tabular-nums; white-space: nowrap; }
.lk-td .lk-change { flex: none; padding: 0 2px; font-size: var(--lk-line-size); }
.lk-td .lk-change::after { width: 1.05em; height: 1.05em; margin-left: 0; }   /* the ▾ at the size of the cell's words, as 0.5.17 drew it */
.lk-td a[data-to] { cursor: pointer; }
.lk-td a.lk-tag { font-size: inherit; }
.lk-td .lk-sep { color: var(--lk-quiet); }
.lk-td .lk-off { color: var(--lk-quiet); }
.lk-table > .lk-tgrid > .lk-none { padding: 8px 4px; color: var(--lk-quiet); }`;
})();
