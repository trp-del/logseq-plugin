/* New things on a list (7 November 2026, the owner: "build all that is left" of Threads Forty):
   - Since you last looked (N1): a quiet dot before a node made since this page was last open, and "· 2 new" at the head,
     which narrows the list to them; the next visit starts again from then.
   - Sort (N20): the View menu's Sort by: the day (Threads' own order), last changed, name or tag; the head says which.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
// Given to each copy of the part (the main view's, and the right half's of two pages side by side); with no part loaded, nothing of it runs.
window.Threads.parts?.find(part => part.name === 'two-way')?.inner?.piece?.(twoWay => {
const shared = window.Threads.shared;
const { host, esc } = shared;
const { state, warnOnce } = twoWay;
// Choices kept in Logseq's window storage, as the lists' open state is: across restarts, on this Mac.
const stored = (key, fallback) => { try { return JSON.parse(host().defaultView.localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const keep = (key, value) => { try { host().defaultView.localStorage.setItem(key, JSON.stringify(value)); } catch { /* kept for this session */ } };
const redraw = () => { state.html = null; twoWay.draw(host()); };
// Drawing again takes the keyboard off the timeline: it goes back to the timeline it was on (its key), once drawn.
const yearRefocus = k => requestAnimationFrame(() => state.box?.querySelector(`.lk-time[data-lk-time="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }));
const listKey = group => `${state.pageUuid}|${group.name}`;

/* When each node was made and last changed, read with the rows; and the visit: the moment this page was last open. */
state.stamps = new Map();
const SEEN_KEY = 'thTwoWaySeen';
twoWay.loadHooks.push(async (page, groups) => {
  const uuids = groups.flatMap(g => [...g.items, ...(g.since || [])].map(item => item.uuid));
  const stamps = await twoWay.provided.createdAt?.(uuids).catch(error => { warnOnce('could not read when the nodes were made', error); return null; });
  if (stamps) for (const [uuid, s] of stamps) state.stamps.set(uuid, s);
  if (state.visitPage !== page.uuid) {
    const seen = stored(SEEN_KEY, {});
    state.visitPage = page.uuid; state.newSince = Number(seen[page.uuid]) || 0; state.onlyNew = new Set();
    seen[page.uuid] = Date.now();
    keep(SEEN_KEY, seen);
  }
  // “no Topic?” and the timeline's lanes rest on the nodes' values: read for every list of five or more.
  const want = groups.filter(g => g.items.length >= 5).flatMap(g => g.items.map(item => item.uuid)).filter(uuid => !state.values.has(uuid));
  if (want.length) await twoWay.readValues(want.slice(0, 2000)).catch(error => warnOnce('could not read the values the lists share', error));
  return groups;
});
const isNew = item => !!state.newSince && (state.stamps.get(item.uuid)?.created || 0) > state.newSince;
twoWay.leadHooks.push((group, item) => isNew(item) ? '<span class="th-tw-new" title="New since you last looked at this page" aria-label="New"></span>' : '');
twoWay.headHooks.push((group, key) => {
  const n = group.items.filter(isNew).length;
  if (!n) return '';
  const on = state.onlyNew?.has(key);
  return `<span class="th-tw-piece"><span class="th-tw-sep" aria-hidden="true">·</span><button type="button" class="lk-more th-tw-newcount" data-onlynew="${esc(key)}" aria-pressed="${!!on}" title="${on ? 'Show the whole list' : 'Only the nodes made since you last looked'}">${n} new</button></span>`;
});
twoWay.listHooks.push((group, key, items) => state.onlyNew?.has(key) ? items.filter(isNew) : items);

/* Sort (N20): kept per list on this page. */
const SORT_KEY = 'thTwoWaySort';
const SORTS = { changed: 'last changed', name: 'name', tag: 'tag' };
const sortOf = group => stored(SORT_KEY, {})[listKey(group)] || '';
function setSort(group, to) {
  const all = stored(SORT_KEY, {});
  if (to) all[listKey(group)] = to; else delete all[listKey(group)];
  keep(SORT_KEY, all); redraw();
}
twoWay.listHooks.push((group, key, items) => {
  const by = sortOf(group);
  // By day, the list's own order, unless a date property is chosen in View: then by that one (8 November 2026), as the rows
  // come, the days still to come first, the soonest first, then the past, the latest first, then those with none.
  if (!by && !twoWay.dayChoice(group).startsWith('p:')) return items;
  const list = [...items];
  if (!by) { const today = twoWay.todayNumber(), d = item => twoWay.dayIn(group, item), rank = n => n >= today ? 0 : n ? 1 : 2; return list.sort((a, b) => rank(d(a)) - rank(d(b)) || (d(a) >= today ? d(a) - d(b) : d(b) - d(a)) || a.title.localeCompare(b.title)); }
  if (by === 'changed') list.sort((a, b) => (state.stamps.get(b.uuid)?.updated || 0) - (state.stamps.get(a.uuid)?.updated || 0));
  else if (by === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (by === 'tag') list.sort((a, b) => String(a.tag).localeCompare(String(b.tag)) || a.title.localeCompare(b.title));
  return list;
});
// The order in force is said once, in the View menu's words on the heading (group.js).
twoWay.sortSaid = group => sortOf(group) ? `Sorted by ${SORTS[sortOf(group)]}` : '';
twoWay.viewMenuHooks.push(group => {
  const by = sortOf(group);
  return [{ group: 'Sort by' }, { label: 'Day', chosen: !by, run: () => setSort(group, '') },
    ...Object.entries(SORTS).map(([k, label]) => ({ label: label[0].toUpperCase() + label.slice(1), chosen: by === k, run: () => setSort(group, k) }))];
});

/* Gaps (N7), "quiet for 25 days" between two dated nodes, were taken out at the owner's word (10 November 2026). */

// A node's values as words, each with the property it is of (a day is left out): what the timeline's lanes are made from.
const valuesOf = item => { const out = []; for (const [name, entry] of state.values.get(item.uuid) || []) for (const v of entry.values || []) { const text = v.day ? '' : String(v.title ?? v.text ?? '').trim(); if (text) out.push({ name, text, ident: entry.ident }); } return out; };
twoWay.clickHooks.push(event => {
  const t = event.target;
  const onlyNew = t.closest?.('[data-onlynew]');
  if (onlyNew) { event.preventDefault(); event.stopPropagation(); const k = onlyNew.dataset.onlynew; if (state.onlyNew.has(k)) state.onlyNew.delete(k); else state.onlyNew.add(k); twoWay.setOpen?.(k, true); redraw(); return true; }
  return false;
});

/* A year line (N3): the days in a list's head open a thin line under it, one dot per node where its day falls, the months
   under the line; the pointer on a dot names its node, a click on a dot narrows the list to that week, a click in it again
   gives the whole list back. A click on the days again folds the line away.
   Lanes and spans (10 November 2026, the owner picked lanes "but allow time span to still be selected"): the list's View
   menu, under Timeline, hides the line, shows it as one line, or lays it out by a property the nodes hold, one lane per value
   (its three most held values, then "others"), as Find's opened timeline does, remembered per property row (the owner: "in
   one menu"); a click on a lane's name narrows the list to that lane, a second click gives it back. A drag across the line
   picks any span of days, the list narrowing as it goes. Escape lets go of the lane, then of the span, one at a time.
   Its shape (the owner's pick A of timeline-shape-options.html): no box, a hairline a lane with the dots on it, a tick where
   each month starts with its name under it, the line in the words' column, kept 6px in from both ends. */
state.yearOn = new Set(); state.yearPick = new Map(); state.yearLaneOn = new Map(); state.yearAt = new Map(); state.yearTall = new Set(); state.yearDots = new Map();
const dayNum = window.PluginDoor.dates.number;
const dateOf = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100);
const MON = window.PluginDoor.dates.MONTHS.map(name => name.slice(0, 3));   // the door's month names (plugin.js)
const LANES_KEY = 'thTwoWayYearLanes';   // { property row's name: the property its line is laid out by }
const lanesBy = group => stored(LANES_KEY, {})[group.name] || '';
const setLanesBy = (group, name) => { const all = stored(LANES_KEY, {}); if (name) all[group.name] = name; else delete all[group.name]; keep(LANES_KEY, all); };
// The properties a list's nodes hold that could make lanes: two values at least, one held twice, not a value per node.
function laneProps(group) {
  const by = new Map();
  for (const item of group.items) for (const v of new Set(valuesOf(item).filter(v => v.name !== group.name).map(v => `${v.name}\u0000${v.text}`))) {
    const [name, text] = v.split('\u0000'), counts = by.get(name) || new Map();
    counts.set(text, (counts.get(text) || 0) + 1); by.set(name, counts);
  }
  return [...by].map(([name, counts]) => ({ name, values: [...counts].sort((a, b) => b[1] - a[1]), held: [...counts.values()].reduce((a, b) => a + b, 0) }))
    .filter(p => p.values.length >= 2 && p.values[0][1] >= 2 && p.values.length < group.items.length)
    .sort((a, b) => b.held - a.held || a.name.localeCompare(b.name)).slice(0, 3);
}
// The lanes in force for a list: the property, its lanes' names ("others" last, when a node holds none of the three), a node's lane.
function lanesOf(group, items = group.items) {
  const prop = laneProps(group).find(p => p.name === lanesBy(group));
  if (!prop) return null;
  const top = prop.values.slice(0, 3).map(([text]) => text);
  const laneOf = item => { const held = valuesOf(item).filter(v => v.name === prop.name).map(v => v.text); const i = top.findIndex(t => held.includes(t)); return i < 0 ? top.length : i; };
  const names = items.some(item => twoWay.dayIn(group, item) && laneOf(item) === top.length) ? [...top, 'others'] : top;
  return { prop, names, laneOf };
}
twoWay.underHeadHooks.unshift((group, key) => {
  if (!state.yearOn.has(key)) return '';
  const dayOf = item => twoWay.dayIn(group, item);
  // A tab that narrows the list to one kind narrows the line too (11 November 2026, the owner: "items should disappear from
  // timeline if tab is selected that filters"); the span and the lane only fade the dots they leave out.
  const only = state.only.get(key), mine = only && group.items.some(item => item.tag === only) ? group.items.filter(item => item.tag === only) : group.items;
  // The library's timeline (PluginDoor.timeline, 16 November 2026: one timeline in Find and in Linked), its dots left to right.
  const dated = mine.filter(dayOf).sort((a, b) => dayOf(a) - dayOf(b));
  if (dated.length < 2) return '';
  state.yearDots.set(key, dated);
  const pick = state.yearPick.get(key), lanes = lanesOf(group, mine), on = lanes ? state.yearLaneOn.get(key) : undefined;
  const dots = dated.map(item => {
    const day = dayOf(item), lane = lanes ? lanes.laneOf(item) : 0;
    return { day, lane, title: twoWay.shortName(item.title), off: (pick && (day < pick[0] || day > pick[1])) || (on !== undefined && lane !== on) };
  });
  const laneList = lanes ? lanes.names.map((name, i) => ({ name, count: dated.filter(item => lanes.laneOf(item) === i).length, on: on === i, off: on !== undefined && on !== i,
    title: on === i ? 'Show every lane' : `Only the nodes whose ${lanes.prop.name} is ${name}` })) : null;
  const at = state.yearAt.get(key);
  return `<div class="th-tw-yearline">${window.PluginDoor.timeline.html({ key, dots, lanes: laneList, pick, at: at == null ? null : at, tall: state.yearTall.has(key), label: 'Where in time the nodes fall; drag across it to pick days' })}</div>`;
});
twoWay.listHooks.push((group, key, items) => {
  const p = state.yearPick.get(key), on = state.yearLaneOn.get(key), lanes = on !== undefined ? lanesOf(group) : null;
  return items.filter(item => (!p || (twoWay.dayIn(group, item) >= p[0] && twoWay.dayIn(group, item) <= p[1])) && (!lanes || lanes.laneOf(item) === on));
});
twoWay.headHooks.push((group, key) => {
  const p = state.yearPick.get(key), on = state.yearLaneOn.get(key), lanes = on !== undefined ? lanesOf(group) : null;
  const said = [lanes ? `${lanes.prop.name} ${lanes.names[on]}` : '', p ? `${twoWay.dayText(p[0])} to ${twoWay.dayText(p[1])}` : ''].filter(Boolean).join(', ');
  /* Its own quieter, smaller line under the tabs, with a × that gives the whole list back (11 November 2026, the owner: "the second
     line needs to look different if it has different function than top"): the tabs pick what kind, this line says what the
     timeline narrowed. */
  return said ? `<span class="th-tw-piece th-tw-showing"><span class="th-tw-sorted">Showing ${esc(said)}</span><button type="button" class="lk-x" data-yclear="${esc(key)}" title="Show the whole list again (Escape)" aria-label="Show the whole list again">×</button></span>` : state.yearOn.has(key) ? `<span class="th-tw-piece th-tw-showing th-tw-showing-room" aria-hidden="true"><span class="th-tw-sorted">&nbsp;</span></span>` : '';   // its room kept while the timeline shows, so a press on a dot moves nothing (16 November 2026, the owner: "when you click it make the line jump down")
});
// The timeline in force, for the View menu's words on the heading: "Timeline", "Timeline by Topic", or nothing while hidden.
twoWay.timelineSaid = group => { const key = listKey(group); if (!state.yearOn.has(key)) return ''; const lanes = lanesOf(group); return lanes ? `Timeline by ${lanes.prop.name}` : 'Timeline'; };
// The list's View menu, under Timeline: hidden, one line, or lanes by a property (the owner: "organize view in one menu").
twoWay.viewMenuHooks.push(group => {
  if (group.items.filter(item => twoWay.dayIn(group, item)).length < 2) return [];
  const key = listKey(group), open = state.yearOn.has(key), by = open ? lanesOf(group)?.prop.name || '' : null;
  const show = name => { state.yearOn.add(key); twoWay.setOpen?.(key, true); setLanesBy(group, name); state.yearLaneOn.delete(key); redraw(); };
  return [{ group: 'Timeline' }, { label: 'Hidden', chosen: !open, run: () => { state.yearOn.delete(key); state.yearPick.delete(key); state.yearLaneOn.delete(key); redraw(); } },
    { label: 'One line', chosen: by === '', run: () => show('') },
    // Taller: the dots of a week piled into a column, as Find's timeline does when opened (16 November 2026).
    { label: 'Taller', chosen: open && state.yearTall.has(key), run: () => { state.yearOn.add(key); twoWay.setOpen?.(key, true); if (state.yearTall.has(key)) state.yearTall.delete(key); else state.yearTall.add(key); redraw(); } },
    ...laneProps(group).map(p => ({ icon: 'property', label: `By ${p.name}`, chosen: by === p.name, run: () => show(p.name) }))];
});
// A drag across the line: the band follows the pointer, and letting go picks the days under it.
twoWay.starters.push(() => {
  const doc = host();
  let drag = null;
  const dayAt = (track, clientX) => window.PluginDoor.timeline.dayAt(track, clientX);
  const keyOf = track => track.closest('[data-lk-time]')?.dataset.lkTime;
  const down = event => {
    const track = event.button === 0 && event.target.closest?.('.th-two-way .lk-time-track');
    if (track && !twoWay.mine(track)) return;
    if (track) drag = { track, x: event.clientX, from: dayAt(track, event.clientX), moved: false };
  };
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.band = drag.track.querySelector('.lk-time-pick') || drag.track.insertAdjacentElement('afterbegin', doc.createElement('span')); drag.band.className = 'lk-time-pick'; }
    const r = drag.track.getBoundingClientRect(), a = Math.max(0, Math.min(drag.x, event.clientX) - r.left), b = Math.min(r.width, Math.max(drag.x, event.clientX) - r.left);
    drag.band.style.left = `${a / r.width * 100}%`; drag.band.style.width = `${(b - a) / r.width * 100}%`;
    event.preventDefault();
  };
  const up = event => {
    if (!drag) return;
    const was = drag; drag = null;
    if (!was.moved) return;
    const to = dayAt(was.track, event.clientX);
    state.yearPick.set(keyOf(was.track), [Math.min(was.from, to), Math.max(was.from, to)]);
    state.yearDragged = true; setTimeout(() => { state.yearDragged = false; }, 0);   // the click that ends a drag is not a click on a dot
    redraw();
  };
  // Escape lets go of a lane, then of a span, before anything else it does on these rows.
  const escape = event => {
    if (event.key !== 'Escape' || event.target.closest?.('input, textarea, [contenteditable="true"]') || state.picked.size || state.selecting.size || !twoWay.ours(event)) return;
    const lane = [...state.yearLaneOn.keys()].pop(), span = [...state.yearPick.keys()].pop(), lit = [...state.yearAt.keys()].pop();
    if (lane !== undefined) state.yearLaneOn.delete(lane); else if (span !== undefined) state.yearPick.delete(span); else if (lit !== undefined) state.yearAt.delete(lit); else return;
    event.preventDefault(); event.stopImmediatePropagation(); redraw();
  };
  /* The keyboard on the timeline (16 November 2026, as on Find's): ← → walk the dots, the one the cursor is on ringed and named;
     Enter opens its node (Shift: in the sidebar). Drawing again takes the focus away, so it is put back on the same timeline. */
  const walk = event => {
    const box = event.target.closest?.('.th-two-way .lk-time');
    if (!box || !twoWay.mine(box) || event.metaKey || event.ctrlKey || event.altKey) return;
    const k = box.dataset.lkTime, dated = state.yearDots.get(k) || [], at = state.yearAt.get(k);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (!dated.length) return;
      state.yearAt.set(k, at == null ? (event.key === 'ArrowRight' ? 0 : dated.length - 1) : Math.max(0, Math.min(dated.length - 1, at + (event.key === 'ArrowRight' ? 1 : -1))));
    } else if (event.key === 'Enter' && at != null && dated[at]) { event.preventDefault(); event.stopPropagation(); twoWay.openPage(dated[at].uuid, event.shiftKey); return; }
    else return;
    event.preventDefault(); event.stopPropagation(); redraw(); yearRefocus(k);
  };
  twoWay.listen(doc, 'mousedown', down, true); twoWay.listen(doc, 'mousemove', move, true); twoWay.listen(doc, 'mouseup', up, true);
  twoWay.listen(doc, 'keydown', escape, true); twoWay.listen(doc, 'keydown', walk, true);

});

/* The odd one out (N8): in a list of five or more, a property most of its nodes hold (four in five) and one does not: that
   node's line says so, pencilled; a click opens the node in place with its empty properties shown, where Predictive's
   pencilled guess for it waits to be taken. */
const oddsOf = group => {
  if (group.items.length < 5 || twoWay.isMentions(group)) return new Map();
  const holders = new Map();
  for (const item of group.items) for (const [name, entry] of state.values.get(item.uuid) || []) if (name !== group.name && (entry.values || []).length) holders.set(name, (holders.get(name) || new Set()).add(item.uuid));
  const odd = new Map();
  for (const [name, set] of holders) if (set.size >= group.items.length * .8 && set.size < group.items.length) for (const item of group.items) if (!set.has(item.uuid) && state.values.has(item.uuid)) odd.set(item.uuid, { name, held: set.size, of: group.items.length });
  return odd;
};
twoWay.tailHooks.push((group, item) => {
  if (state.drawingTop) return '';
  const odd = oddsOf(group).get(item.uuid);
  return odd ? shared.outline.pencil(`no ${odd.name}?`, { 'data-odd': item.uuid, 'data-oddfield': group.name, title: `${odd.held} of ${odd.of} here have a ${odd.name}; this one has none. Click to open it and fill it in.` }) : '';
});

/* The keyboard walk (N14): with the keyboard on a node's name, Down and Up go to the next and the one before, Right opens it
   in place, Left closes it (or goes to the node it is in), Space picks it, turning picking on for its list; Enter opens its
   page, as always; Esc lets go. */
twoWay.starters.push(() => {
  const doc = host();
  const names = () => [...(state.box?.querySelectorAll('a.th-tw-record') || [])].filter(a => a.offsetParent);
  // Opening or closing draws the rows again: the keyboard stays on the same node's name, found by its place.
  const keepOn = key => { let tries = 0; const again = () => { const chev = state.box?.querySelector(`[data-dig="${CSS.escape(key)}"]`); const name = chev?.closest('.th-ol-line, .th-ol-prop')?.querySelector('a.th-tw-record'); if (name && doc.activeElement !== name) name.focus({ preventScroll: true }); if (++tries < 12) setTimeout(again, 120); }; setTimeout(again, 60); };
  const onKey = event => {
    const at = doc.activeElement;
    if (!at?.matches?.('.th-two-way a.th-tw-record') || !twoWay.mine(at) || event.metaKey || event.ctrlKey || event.altKey) return;
    const line = at.closest('.th-ol-line, .th-ol-prop');
    const chev = line?.querySelector('[data-dig]');
    let to = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { const all = names(), i = all.indexOf(at); to = all[i + (event.key === 'ArrowDown' ? 1 : -1)]; }
    else if (event.key === 'ArrowRight') { if (chev && chev.getAttribute('aria-expanded') !== 'true') { chev.click(); keepOn(chev.dataset.dig); } }
    else if (event.key === 'ArrowLeft') {
      if (chev && chev.getAttribute('aria-expanded') === 'true') { chev.click(); keepOn(chev.dataset.dig); }
      else { const kids = line?.closest('.th-ol-kids[data-key]'); to = kids?.closest('.th-ol-unit')?.querySelector('a.th-tw-record'); }
    } else if (event.key === ' ') {
      const row = at.closest('.th-tw-row'), group = state.groups.find(g => g.name === row?.dataset.field);
      if (!group || !line?.matches('.th-tw-line')) return;
      state.selecting.add(group.name);
      const k = `${line.dataset.uuid}|${group.name}`;
      if (state.picked.has(k)) state.picked.delete(k); else state.picked.add(k);
      state.html = null; twoWay.draw(doc);
      to = [...state.box.querySelectorAll(`.th-tw-row[data-field="${CSS.escape(group.name)}"] .th-tw-line[data-uuid="${CSS.escape(line.dataset.uuid)}"] a.th-tw-record`)][0];
    } else return;
    event.preventDefault(); event.stopPropagation();
    if (to) to.focus({ preventScroll: false });
  };
  twoWay.listen(doc, 'keydown', onKey, true);
});

twoWay.clickHooks.push(event => {
  const t = event.target, stop = () => { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); };
  const when = t.closest?.('.th-tw-head a.th-tw-when');
  if (when) { stop(); const k = when.dataset.key; if (state.yearOn.has(k)) { state.yearOn.delete(k); state.yearPick.delete(k); state.yearLaneOn.delete(k); } else { state.yearOn.add(k); twoWay.setOpen?.(k, true); } redraw(); return true; }
  if (state.yearDragged && t.closest?.('.th-two-way .lk-time-track')) { stop(); return true; }
  const yclear = t.closest?.('[data-yclear]');
  if (yclear) { stop(); const k = yclear.dataset.yclear; state.yearPick.delete(k); state.yearLaneOn.delete(k); redraw(); return true; }
  const ylane = t.closest?.('.th-two-way .lk-time-lane');
  if (ylane) { stop(); const k = ylane.closest('[data-lk-time]').dataset.lkTime, i = Number(ylane.dataset.lane); if (state.yearLaneOn.get(k) === i) state.yearLaneOn.delete(k); else state.yearLaneOn.set(k, i); redraw(); return true; }
  const ydot = t.closest?.('.th-two-way .lk-time-dot');
  if (ydot) {
    stop(); const k = ydot.closest('[data-lk-time]').dataset.lkTime, d = Number(ydot.dataset.day), p = state.yearPick.get(k);
    state.yearAt.set(k, Number(ydot.dataset.i));   // the cursor on it, so the arrows walk on from here
    if (p && d >= p[0] && d <= p[1]) state.yearPick.delete(k);
    else { const at = dateOf(d); state.yearPick.set(k, [dayNum(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 3)), dayNum(new Date(at.getFullYear(), at.getMonth(), at.getDate() + 3))]); }
    redraw(); yearRefocus(k); return true;
  }
  const odd = t.closest?.('[data-odd]');
  if (odd) {
    stop();
    const line = odd.closest('.th-tw-line'), chev = line?.querySelector('[data-dig]');
    if (chev) { state.emptyOpen.add(chev.dataset.dig); if (chev.getAttribute('aria-expanded') !== 'true') chev.click(); }
    return true;
  }
  return false;
});

/* Drag a line to another list (N5): a node's line dragged onto another list's head gives the node that list's property,
   pointing at this page, so it stands in that list too; the faded arrow takes the property off again. */
let dragNode = null;
twoWay.starters.push(() => {
  const doc = host();
  const start = e => { const line = !e.target.closest?.('.th-tw-name') && e.target.closest?.('.th-two-way .th-tw-line[data-uuid]'); if (!line || !twoWay.mine(line) || state.drawingTop) return; const from = line.closest('.th-tw-row')?.dataset.field; dragNode = { uuid: line.dataset.uuid, from }; line.classList.add('th-tw-dragging'); };
  const target = e => { const row = e.target.closest?.('.th-two-way .th-tw-row'); if (row && !twoWay.mine(row)) return null; const group = row && state.groups.find(g => g.name === row.dataset.field); return group && group.ident && group.name !== dragNode?.from ? { row, group } : null; };
  const clear = () => { for (const el of doc.querySelectorAll('.th-tw-row[data-dropnode], .th-tw-line.th-tw-dragging')) { el.removeAttribute('data-dropnode'); el.classList.remove('th-tw-dragging'); } };
  const over = e => { if (!dragNode) return; const t = target(e); for (const el of doc.querySelectorAll('.th-tw-row[data-dropnode]')) if (el !== t?.row) el.removeAttribute('data-dropnode'); if (!t) return; e.preventDefault(); e.stopPropagation(); t.row.setAttribute('data-dropnode', ''); };
  const drop = e => {
    if (!dragNode) return; const t = target(e), node = dragNode; dragNode = null; clear();
    if (!t) return; e.preventDefault(); e.stopPropagation();
    joinList(node.uuid, t.group).catch(error => { warnOnce('could not move the node into the list', error); shared.notify('The node could not be put in that list', 'warning'); });
  };
  const end = () => { dragNode = null; clear(); };
  twoWay.listen(doc, 'dragstart', start, true); twoWay.listen(doc, 'dragover', over, true); twoWay.listen(doc, 'drop', drop, true); twoWay.listen(doc, 'dragend', end, true);
});
async function joinList(uuid, group) {
  const prop = (await twoWay.provided.propSchema()).props.find(p => p.ident === group.ident);
  const here = await twoWay.provided.idByUuid(state.pageUuid);
  if (!prop || !here) return;
  const had = await twoWay.heldNow(uuid, prop);
  if (had.includes(here)) return shared.notify(`It is in “${group.label}” already`, 'warning');
  await twoWay.setValues(uuid, prop, prop.many ? [...had, here] : [here]);
  twoWay.later(200);
  twoWay.offerUndo(`Now in “${group.label}” too`, async () => { await twoWay.setValues(uuid, prop, had); twoWay.later(200); }, group.name);
}

twoWay.starters.push(() => { state.stamps = new Map(); state.visitPage = ''; state.yearOn = new Set(); state.yearPick = new Map(); state.yearLaneOn = new Map(); state.yearAt = new Map(); state.yearTall = new Set(); state.yearDots = new Map(); });

Object.assign(twoWay, { isNew, sortOf });
});
})();
