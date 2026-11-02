/* The whole, as one page: each top-level tag is an area, its tags a small outline inside it, and the relationships drawn
   between the rows. Lines never cross words: between neighbouring areas a line stays in the gap; further apart it rises to
   the band above the areas, runs across and comes down. Only the lines of the tag you pressed show. The rows are the view's own, so ticks, Tab, drag, the menu and
   finding work here as they do anywhere. This file only draws the lines. */
(function () {
const S = window.Structure;
const Mo = S.model;
const NS = 'http://www.w3.org/2000/svg';
const width = n => Math.max(1, Math.min(2.5, Math.sqrt(n) / 3));
const R = 6;       // the corner of a line that turns

function lines(root, M, cur, quiet) {
  const box = root.querySelector('.st-regions'), svg = box?.querySelector('svg.st-lines');
  if (!svg) return;
  if (quiet) { svg.innerHTML = ''; return; }   // while a tag is being chosen, only the tags
  const at = box.getBoundingClientRect(), rows = new Map(), areas = [...box.querySelectorAll('.st-area')];
  for (const row of box.querySelectorAll('[data-row]')) rows.set(Number(row.dataset.row), row);
  // A folded tag's lines stop at the nearest row that shows.
  const rowOf = id => { const path = Mo.pathOf(M, id); for (let i = path.length - 1; i >= 0; i--) if (rows.has(path[i])) return rows.get(path[i]); return null; };
  const seat = row => { const r = row.getBoundingClientRect(), a = row.closest('.st-area'), ar = a.getBoundingClientRect(); return { y: r.top - at.top + box.scrollTop + 13, l: ar.left - at.left + box.scrollLeft, r: ar.right - at.left + box.scrollLeft, area: areas.indexOf(a) }; };
  const all = Mo.roads(M), near = Mo.within(M, cur), mine = r => near.has(r.from) || near.has(r.to);
  const shown = all.filter(mine);   // only what can be read: a line stands for the tag you pressed
  const pairs = new Map();
  for (const r of shown) { const a = rowOf(r.from), b = rowOf(r.to); if (!a || !b || a === b) continue; const key = `${r.from}>${r.to}`, p = pairs.get(key) || { a, b, n: 0, on: false }; p.n += r.n; p.on ||= mine(r); pairs.set(key, p); }
  let lane = 0;
  const paths = [...pairs.values()].sort((x, y) => x.on - y.on).map(p => {
    let a = seat(p.a), b = seat(p.b);
    if (a.area > b.area) [a, b] = [b, a];
    let d;
    if (a.area === b.area) { const x = a.r + 10 + (Math.abs(a.y - b.y) % 3) * 3, s = b.y > a.y ? 1 : -1; d = `M${a.r} ${a.y} H${x - R} Q${x} ${a.y} ${x} ${a.y + s * R} V${b.y - s * R} Q${x} ${b.y} ${x - R} ${b.y} H${b.r}`; }
    else if (b.area === a.area + 1) { const m = (a.r + b.l) / 2; d = `M${a.r} ${a.y} C${m} ${a.y} ${m} ${b.y} ${b.l} ${b.y}`; }
    else { const top = 4 + (lane++ % 5) * 4, x1 = a.r + 14, x2 = b.l - 14; d = `M${a.r} ${a.y} H${x1 - R} Q${x1} ${a.y} ${x1} ${a.y - R} V${top + R} Q${x1} ${top} ${x1 + R} ${top} H${x2 - R} Q${x2} ${top} ${x2} ${top + R} V${b.y - R} Q${x2} ${b.y} ${x2 + R} ${b.y} H${b.l}`; }
    return `<path d="${d}" fill="none" stroke="currentColor" stroke-opacity="${p.on ? .9 : .13}" stroke-width="${p.on ? width(p.n) : 1}"/>`;
  });
  svg.setAttribute('width', box.scrollWidth); svg.setAttribute('height', box.scrollHeight);
  svg.innerHTML = paths.join('');
}
S.regions = { lines, NS };
})();
