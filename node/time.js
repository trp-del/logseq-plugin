/* NODE: a list's timeline. Under a list's head, where its View asks for it: a hairline with a dot for each node on its day, from
   the first node's month to today, a tick and a name at each month's start, today a short upright line. A press on a dot
   narrows the list to its week and puts the cursor on it; Left and Right walk on, each dot named, Enter opens the node; a drag
   across the line narrows to any span of days. Laid out by a property, there is a lane for each of its three most held values
   and one for the others; a lane's name narrows the list to it. Escape lets go of the lane, then of the span. Taller piles a
   week's dots into a column. The deciding is core/time.js; the look is the one the plugin had before the rebuild. */
(function () {
const G = window.PluginDoor, T = G.time;
const setting = key => { const view = G.listview.viewOf(key); return { how: view.timeline || '', tall: !!view.tall }; };
// What the list's shape needs to know of its timeline: the span and the lane it is narrowed to.
function narrowing(state, list) {
  const view = state.view, { how } = setting(list.key), span = view.spans.get(list.key) || null;
  if (!how) return { span: null, lane: null, lanes: null };
  const lanes = how !== 'line' ? T.lanesBy(list.rows, how) : null, at = view.lanes.get(list.key);
  return { span, lanes, lane: lanes && at != null ? { of: lanes.laneOf, at } : null };
}
function keep(state, box, made, today) {
  const list = box.lkList, key = list.key, view = state.view, { how, tall } = setting(key), doc = box.ownerDocument;
  let el = box.querySelector(':scope > .lk-time');
  if (!made || !how || made.dots.length < 2 || box.querySelector(':scope > .lk-list-head')?.getAttribute('aria-expanded') === 'false') { el?.remove(); return; }
  const lanes = how !== 'line' ? T.lanesBy(list.rows, how) : null, laneAt = view.lanes.get(key), lit = view.lit.get(key) ?? null;
  const dots = made.dots.map(dot => ({ ...dot, lane: lanes ? lanes.laneOf(dot.row) : 0 }));
  const laid = T.layout({ dots, lanes: lanes ? lanes.names.map((name, i) => ({ name, count: lanes.counts[i] })) : null, pick: view.spans.get(key) || null, lit, tall, today });
  const n = lanes ? lanes.names.length : 1, esc = G.esc, parts = [];
  if (laid.pick) parts.push(`<span class="lk-time-pick" style="left:${laid.pick.left}%;width:max(4px, ${laid.pick.width}%)"></span>`);
  for (let i = 0; i < n; i++) parts.push(`<span class="lk-time-rule" style="--lane:${i}"></span>`);
  for (const month of laid.months) parts.push(`<span class="lk-time-month" style="left:${month.left}%">${esc(month.name)}</span>`);
  parts.push('<span class="lk-time-month lk-time-end" style="left:100%">​</span>', `<span class="lk-time-today" style="left:${laid.today}%"><span>today</span></span>`);
  for (const dot of laid.dots) {
    parts.push(`<a role="button" class="lk-time-dot${dot.off ? ' off' : ''}${dot.lit ? ' at' : ''}" data-i="${dot.i}" data-day="${dot.day}" style="left:${dot.left}%;--lane:${dot.lane};--pile:${dot.pile}" title="${esc(`${T.words(dot.day)}: ${dot.title}`)}" aria-label="${esc(T.words(dot.day))}"></a>`);
    if (dot.lit) parts.push(`<span class="lk-time-name${dot.left > 60 ? ' end' : ''}" style="left:${dot.left}%;--lane:${dot.lane};--pile:${dot.pile}"><span class="lk-day">${esc(T.words(dot.day))}</span> ${esc(dot.title)}</span>`);
  }
  for (const pile of laid.more) parts.push(`<span class="lk-time-more" style="left:${pile.left}%;--lane:${pile.lane};--pile:5">+${pile.n}</span>`);
  const names = lanes ? lanes.names.map((name, i) => `<a role="button" class="lk-time-lane${laneAt === i ? ' on' : laneAt != null ? ' off' : ''}" data-lane="${i}" style="--lane:${i}" title="${esc(name)}">${esc(name)} <span class="lk-time-count">${lanes.counts[i]}</span></a>`).join('') : '';
  const html = `<span class="lk-time-year">${laid.year}</span>${names}<div class="lk-time-track" data-start="${laid.start}" data-end="${laid.end}">${parts.join('')}</div>`;
  if (!el) {
    el = doc.createElement('div'); el.tabIndex = 0; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Where in time the nodes fall');
    (box.querySelector(':scope > .lk-pickbar') || box.firstElementChild).after(el);
    wire(state, box, el);
  }
  el.className = `lk-time${tall ? ' lk-time-tall' : ''}${lanes ? ' lk-time-laned' : ''}${lit != null ? ' lk-time-named' : ''}`;
  el.style.setProperty('--lanes', String(n));
  el.lkDots = dots;
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
}
// A drag across the line narrows the list to the days under it.
function wire(state, box, el) {
  const doc = el.ownerDocument, key = box.lkList.key, view = state.view;
  let drag = null;
  el.addEventListener('mousedown', event => { const track = event.button === 0 && event.target.closest('.lk-time-track'); if (track && !event.target.closest('.lk-time-dot')) drag = { track, x: event.clientX, moved: false, band: null }; });
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.band = drag.track.querySelector('.lk-time-pick') || drag.track.insertAdjacentElement('afterbegin', doc.createElement('span')); drag.band.className = 'lk-time-pick'; }
    const r = drag.track.getBoundingClientRect(), a = Math.max(0, Math.min(drag.x, event.clientX) - r.left), b = Math.min(r.width, Math.max(drag.x, event.clientX) - r.left);
    drag.band.style.left = `${a}px`; drag.band.style.width = `${Math.max(4, b - a)}px`;
  };
  const up = event => {
    if (!drag) return;
    const { track, x, moved } = drag; drag = null;
    if (!moved) return;
    const r = track.getBoundingClientRect(), start = Number(track.dataset.start), end = Number(track.dataset.end);
    const from = T.dayAt(start, end, (Math.min(x, event.clientX) - r.left) / r.width), to = T.dayAt(start, end, (Math.max(x, event.clientX) - r.left) / r.width);
    view.spans.set(key, [from, to]); view.lit.delete(key); el.lkHtml = ''; state.redraw();
  };
  doc.addEventListener('mousemove', move); doc.addEventListener('mouseup', up);
  el.lkOff = () => { doc.removeEventListener('mousemove', move); doc.removeEventListener('mouseup', up); };
}
function act(state, event) {
  const target = event.target, el = target.closest?.('.lk-time'), box = el?.closest('.lk-list'), view = state.view;
  if (!el || !view || !box || box.parentElement !== state.el) return false;
  const key = box.lkList.key, dots = el.lkDots || [], again = () => { state.redraw(); box.querySelector(':scope > .lk-time')?.focus({ preventScroll: true }); };
  if (event.type === 'click') {
    const dot = target.closest('.lk-time-dot'), lane = target.closest('.lk-time-lane');
    if (dot) { event.preventDefault(); const i = Number(dot.dataset.i); view.spans.set(key, T.week(Number(dot.dataset.day))); view.lit.set(key, i); again(); return true; }
    if (lane) { event.preventDefault(); const i = Number(lane.dataset.lane); if (view.lanes.get(key) === i) view.lanes.delete(key); else view.lanes.set(key, i); again(); return true; }
    return true;
  }
  if (event.type !== 'keydown') return false;
  const lit = view.lit.get(key);
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    if (!dots.length) return true;
    const next = lit == null ? (event.key === 'ArrowRight' ? 0 : dots.length - 1) : Math.max(0, Math.min(dots.length - 1, lit + (event.key === 'ArrowRight' ? 1 : -1)));
    event.preventDefault(); view.lit.set(key, next); view.spans.set(key, T.week(dots[next].day)); again(); return true;
  }
  if (event.key === 'Enter' && lit != null && dots[lit]) { event.preventDefault(); const row = box.querySelector(`.lk-row[data-uuid="${dots[lit].uuid}"]`); if (row) { G.node.open(row); row.scrollIntoView({ block: 'nearest' }); } else G.touch.open(dots[lit].uuid); return true; }
  if (event.key === 'Escape' && (view.lanes.has(key) || view.spans.has(key) || lit != null)) { event.preventDefault(); if (view.lanes.has(key)) view.lanes.delete(key); else { view.spans.delete(key); view.lit.delete(key); } again(); return true; }
  return false;
}
/* A plain strip for a place that is not a list of Relations (Todo): one line, a dot for each { day, title, late }, a late one in
   red, today its short upright line. A press on a dot answers pressed(dot). Nothing is narrowed and nothing is dragged. */
function strip(el, dots, today, pressed) {
  const laid = T.layout({ dots, today }), esc = G.esc, parts = ['<span class="lk-time-rule" style="--lane:0"></span>'];
  for (const month of laid.months) parts.push(`<span class="lk-time-month" style="left:${month.left}%">${esc(month.name)}</span>`);
  parts.push(`<span class="lk-time-today" style="left:${laid.today}%"><span>today</span></span>`);
  for (const dot of laid.dots) parts.push(`<a role="button" class="lk-time-dot${dots[dot.i].late ? ' late' : ''}" data-i="${dot.i}" style="left:${dot.left}%;--lane:0;--pile:${dot.pile}" title="${esc(`${T.words(dot.day)}: ${dot.title}`)}" aria-label="${esc(`${T.words(dot.day)}: ${dot.title}`)}"></a>`);
  const html = `<span class="lk-time-year">${laid.year}</span><div class="lk-time-track">${parts.join('')}</div>`;
  el.className = 'lk-time lk-time-strip'; el.style.setProperty('--lanes', '1'); el.lkDots = dots;
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
  if (!el.lkWired) { el.lkWired = true; el.addEventListener('click', event => { const dot = event.target.closest('.lk-time-dot'); if (dot) pressed(el.lkDots[Number(dot.dataset.i)]); }); }
}
G.timeline = { keep, act, narrowing, setting, strip };
G.timeline.CSS = `
.lk-time { position: relative; margin: 8px 0 6px; padding-top: 16px; --lk-time-row: 18px; outline: none; }
.lk-time.lk-time-tall { --lk-time-row: 60px; }
.lk-time.lk-time-tall.lk-time-laned { --lk-time-row: 40px; }
.lk-time.lk-time-laned { padding-left: 6.5rem; }
.lk-time-year { position: absolute; top: 0; left: 0; padding-left: calc(var(--lk-mark-box) + var(--lk-mark-gap) - 18px);   /* on the head's words' edge */ font-size: var(--lk-label); line-height: 14px; color: var(--lk-quiet); }
.lk-time-track { position: relative; height: calc(var(--lanes, 1) * var(--lk-time-row) + 18px); cursor: crosshair; user-select: none; touch-action: none; }
.lk-time-rule { position: absolute; left: 0; right: 0; top: calc((var(--lane) + 1) * var(--lk-time-row) - 9px); height: 1px; background: var(--lk-line); pointer-events: none; }
.lk-time-month { position: absolute; bottom: 0; padding-left: 3px; font-size: var(--lk-label); line-height: 14px; color: var(--lk-quiet); pointer-events: none; white-space: nowrap; }
.lk-time-month::before { content: ""; position: absolute; left: 0; top: -17px; height: 8px; border-left: 1px solid var(--lk-line); }
.lk-time-today { position: absolute; top: calc(var(--lanes, 1) * var(--lk-time-row) - 17px); height: 16px; border-left: 1.2px solid var(--lk-text); pointer-events: none; }
.lk-time-today > span { position: absolute; top: calc(-16px - var(--lanes, 1) * var(--lk-time-row) + 17px); right: -4px;   /* on the year's line: back up the track's 16 and the tick's own top */ font-size: var(--lk-label); line-height: 14px; color: var(--lk-text); white-space: nowrap; }
.lk-time-pick { position: absolute; top: 0; height: calc(var(--lanes, 1) * var(--lk-time-row)); background: var(--lk-wash); border-radius: 3px; pointer-events: none; box-shadow: inset 0 0 0 1px var(--lk-line); }
.lk-time-dot { position: absolute; top: calc((var(--lane, 0) + 1) * var(--lk-time-row) - 12.5px - var(--pile, 0) * 9px); width: 7px; height: 7px; margin-left: -3.5px; box-sizing: border-box; border-radius: 50%; background: var(--lk-text); opacity: .75; cursor: pointer; }
.lk-time-dot:hover { opacity: 1; box-shadow: 0 0 0 3px var(--lk-wash); }
.lk-time-dot.off { opacity: .22; }
.lk-time-dot.late { background: var(--lk-going); opacity: 1; }
.lk-time-strip .lk-time-track { cursor: default; }
.lk-time-dot.at { opacity: 1; box-shadow: 0 0 0 2px var(--lk-paper), 0 0 0 3.2px var(--lk-text); }
.lk-time-more { position: absolute; top: calc((var(--lane, 0) + 1) * var(--lk-time-row) - 16px - var(--pile, 0) * 9px); transform: translateX(-50%); font-size: var(--lk-label); line-height: 12px; color: var(--lk-quiet); pointer-events: none; }
.lk-time-name { position: absolute; top: calc((var(--lane, 0) + 1) * var(--lk-time-row) - 31px - var(--pile, 0) * 9px); transform: translateX(-8px); max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lk-small); line-height: 16px; padding: 0 4px; background: var(--lk-paper); color: var(--lk-text); border-radius: 3px; pointer-events: none; z-index: 1; }
.lk-time-name .lk-day { color: var(--lk-quiet); }
.lk-time-name.end { transform: translateX(calc(-100% + 8px)); }
.lk-time-named .lk-time-today > span { visibility: hidden; }
.lk-time-lane { position: absolute; left: calc(var(--lk-mark-box) + var(--lk-mark-gap) - 18px); top: calc(16px + (var(--lane) + 1) * var(--lk-time-row) - 17px); width: 6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lk-label); line-height: 16px; color: var(--lk-quiet); cursor: pointer; }
.lk-time-lane:hover, .lk-time-lane.on { color: var(--lk-text); }
.lk-time-lane.off { opacity: .55; }
.lk-time-count { color: var(--lk-off); }`;
})();
