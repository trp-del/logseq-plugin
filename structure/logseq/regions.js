/* The whole, as one page: each top-level tag is an area, its tags a small outline inside it, and the relationships drawn
   between the rows. Lines never cross words: between neighbouring areas a line stays in the gap; further apart it rises to
   the band above the areas, runs across and comes down. Only the lines of the tag you pressed show. The rows are the view's own, so ticks, Tab, drag, the menu and
   finding work here as they do anywhere. This file only draws the lines. */
(function () {
const S = window.Structure;
const Mo = S.model;
const NS = 'http://www.w3.org/2000/svg';
const R = 6;       // the corner of a line that turns
const LINE = 'stroke="currentColor" stroke-opacity=".5" stroke-width="1"';   // a hairline in the quiet grey, in light and dark alike
const watched = new WeakMap();   // each map's last drawing, drawn again when its width changes (the right sidebar opens, the window narrows)

/* The areas share the page's width and wrap onto a second row rather than run past its edge (10 November 2026, the audit's 15:
   a fourth area stood off the right edge behind a scroll bar, and the lines were thick and bright in dark mode). A line between
   areas on one row keeps to their gap or the band above that row; between rows it goes down the gap at the right of its area, runs
   along the band above the lower row, and comes down the gap at the right of the other. */
/* The columns (15 November 2026, the owner: "have the ontology fill the space in order to maximize the space between the columns"):
   as many as fit at their narrowest (232 px, a 15-letter name two steps in) and no more than there are areas, each as wide as
   340 px at most and all the same width; the stylesheet's justify-content puts the first at the left edge, the last at the
   right and the room left over in the gaps. Worked out here, at each drawing and each change of width, since CSS counts the
   columns at their widest. */
/* A tall area takes the spare columns (23 November 2026, the owner: two top-level tags, one of 74 nodes and one of 27, stood as two
   uneven columns with the rest of the page empty). Where more columns fit than there are areas, each spare column goes to the area
   whose columns are then tallest, as long as it has a branch (a tag one step under the top, with its rows) to put there; an area in
   several columns has its top-level tag over the first and its branches poured down them in order, each whole. A spare column that
   would shorten nothing is left out, so a page of short areas stays as it was. The columns' width and gap are read back from the grid,
   so a column of a split area is as wide as any other and as far from the next. */
const NARROW = 232, WIDE = 340;
function columns(box) {
  const win = box.ownerDocument.defaultView, css = win.getComputedStyle(box), gap = parseFloat(css.columnGap) || 0;
  const inner = box.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0);
  const areas = [...box.querySelectorAll(':scope > .st-area')].filter(a => a.getClientRects().length);
  const fit = Math.max(1, Math.floor((inner + gap) / (NARROW + gap)));
  const tall = areas.map(a => ({ a, rows: a.querySelectorAll('[data-row]').length, branches: a.querySelectorAll(':scope > .st-branch').length, k: 1 }));
  for (let spare = fit - areas.length; spare > 0; spare--) {
    const top = tall.reduce((m, t) => (t.rows / t.k > m.rows / m.k ? t : m), tall[0]);
    if (!top || top.k >= top.branches) break;   // the tallest cannot be split further: another column would shorten nothing
    top.k++;
  }
  const n = Math.max(1, Math.min(fit, tall.reduce((s, t) => s + t.k, 0) || 1));
  const want = `repeat(${n}, minmax(${NARROW}px, ${WIDE}px))`;
  if (box.style.gridTemplateColumns !== want) box.style.gridTemplateColumns = want;
  const tracks = win.getComputedStyle(box).gridTemplateColumns.split(' ').map(parseFloat).filter(x => x > 0);
  const col = tracks[0] || NARROW, between = n > 1 ? (inner - tracks.reduce((s, x) => s + x, 0)) / (n - 1) : gap;
  for (const t of tall) {
    const split = n >= areas.length && t.k > 1;
    t.a.classList.toggle('st-split', split);
    t.a.style.gridColumn = split ? `span ${t.k}` : '';
    t.a.style.columnCount = split ? t.k : '';
    t.a.style.columnGap = split ? `${Math.max(gap, between)}px` : '';
    if (split) t.a.style.setProperty('--st-col', `${col}px`); else t.a.style.removeProperty('--st-col');
  }
}
function lines(root, M, cur, quiet) {
  const box = root.querySelector('.st-regions'), svg = box?.querySelector('svg.st-lines');
  if (!svg) return;
  watch(box, () => lines(root, M, cur, quiet));
  columns(box);
  if (quiet) { svg.innerHTML = ''; return; }   // while a tag is being chosen, only the tags
  const at = box.getBoundingClientRect(), rows = new Map(), areas = [...box.querySelectorAll('.st-area')];
  // A row's column: its area's, or in an area split into columns, the one the row stands in. Columns are told apart by their left edge.
  const colOf = row => { const a = row.closest('.st-area'); return a.classList.contains('st-split') ? row.getBoundingClientRect() : a.getBoundingClientRect(); };
  const lefts = [...new Set([...box.querySelectorAll('[data-row]')].map(r => Math.round(colOf(r).left)))].sort((x, y) => x - y);
  for (const row of box.querySelectorAll('[data-row]')) rows.set(Number(row.dataset.row), row);
  // The rows of areas, by their tops: a row's band is the space above it.
  const tops = [...new Set(areas.map(a => Math.round(a.getBoundingClientRect().top - at.top)))].sort((x, y) => x - y);
  const rowIn = a => tops.indexOf(Math.round(a.getBoundingClientRect().top - at.top));
  // A folded tag's lines stop at the nearest row that shows.
  const rowOf = id => { const path = Mo.pathOf(M, id); for (let i = path.length - 1; i >= 0; i--) if (rows.has(path[i])) return rows.get(path[i]); return null; };
  const seat = row => { const r = row.getBoundingClientRect(), a = row.closest('.st-area'), ar = colOf(row); return { y: r.top - at.top + box.scrollTop + 13, l: ar.left - at.left + box.scrollLeft, r: ar.right - at.left + box.scrollLeft, area: rowIn(a) * 1000 + lefts.indexOf(Math.round(ar.left)), line: rowIn(a) }; };
  const bandAbove = line => tops[line] + box.scrollTop - 26;
  const all = Mo.roads(M), near = Mo.within(M, cur), mine = r => near.has(r.from) || near.has(r.to);
  const shown = all.filter(mine);   // only what can be read: a line stands for the tag you pressed
  const pairs = new Map();
  for (const r of shown) { const a = rowOf(r.from), b = rowOf(r.to); if (!a || !b || a === b) continue; const key = `${r.from}>${r.to}`, p = pairs.get(key) || { a, b }; pairs.set(key, p); }
  let lane = 0;
  const paths = [...pairs.values()].map(p => {
    let a = seat(p.a), b = seat(p.b);
    if (a.line > b.line || (a.line === b.line && a.area > b.area)) [a, b] = [b, a];
    let d;
    if (a.area === b.area) { const x = a.r + 10 + (Math.abs(a.y - b.y) % 3) * 3, s = b.y > a.y ? 1 : -1; d = `M${a.r} ${a.y} H${x - R} Q${x} ${a.y} ${x} ${a.y + s * R} V${b.y - s * R} Q${x} ${b.y} ${x - R} ${b.y} H${b.r}`; }
    else if (a.line === b.line && b.area === a.area + 1) { const m = (a.r + b.l) / 2; d = `M${a.r} ${a.y} C${m} ${a.y} ${m} ${b.y} ${b.l} ${b.y}`; }
    else if (a.line === b.line) {
      // Up to the band above the row, across, and down into the other area from its left.
      const top = bandAbove(a.line) + (lane++ % 5) * 4, x1 = a.r + 14, x2 = b.l - 14;
      d = `M${a.r} ${a.y} H${x1 - R} Q${x1} ${a.y} ${x1} ${a.y - R} V${top + R} Q${x1} ${top} ${x1 + R} ${top} H${x2 - R} Q${x2} ${top} ${x2} ${top + R} V${b.y - R} Q${x2} ${b.y} ${x2 + R} ${b.y} H${b.l}`;
    } else {
      // Between rows: down the gap at the right of the upper area, along the band above the lower row, down the gap at the right of
      // the lower area and in from that side, so the line never needs room at the page's left edge.
      const k = lane++ % 5, top = bandAbove(b.line) + k * 4, x1 = a.r + 14 + k * 3, x2 = b.r + 14 + k * 3, turn = x2 > x1 ? 1 : x2 < x1 ? -1 : 0;
      const across = turn ? `Q${x1} ${top} ${x1 + turn * R} ${top} H${x2 - turn * R} Q${x2} ${top} ${x2} ${top + R}` : `V${top + R}`;
      d = `M${a.r} ${a.y} H${x1 - R} Q${x1} ${a.y} ${x1} ${a.y + R} V${top - (turn ? R : 0)} ${across} V${b.y - R} Q${x2} ${b.y} ${x2 - R} ${b.y} H${b.r}`;
    }
    return `<path d="${d}" fill="none" ${LINE}/>`;
  });
  svg.setAttribute('width', box.scrollWidth); svg.setAttribute('height', box.scrollHeight);
  svg.innerHTML = paths.join('');
}
function watch(box, draw) {
  const RO = box.ownerDocument.defaultView?.ResizeObserver;
  if (!RO) return;
  let w = watched.get(box);
  if (!w) { w = { draw, width: box.clientWidth }; w.ro = new RO(() => { if (!box.isConnected) return w.ro.disconnect(); if (box.clientWidth !== w.width) { w.width = box.clientWidth; w.draw(); } }); w.ro.observe(box); watched.set(box, w); }
  w.draw = draw;
}
S.regions = { lines, NS };
})();
