/* New things on a list (7 November 2026, the owner: "build all that is left" of Threads Forty):
   - Since you last looked (N1): a quiet dot before a node made since this page was last open, and "· 2 new" at the head,
     which narrows the list to them; the next visit starts again from then.
   - Pin a line (N2): a node's right-click menu pins it above the others of its list, on this page, until unpinned.
   - Gaps (N7): a long silence between two dated nodes, far longer than the list's usual gap, says so on a quiet line.
   - Sort (N20): the View menu's Sort by: the day (Threads' own order), last changed, name or tag; the head says which.
   - What the list keeps saying (N6): under an open list's head, the values most of its nodes share, a click narrows to one.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, esc } = shared;
const { state, warnOnce } = twoWay;
// Choices kept in Logseq's window storage, as the lists' open state is: across restarts, on this Mac.
const stored = (key, fallback) => { try { return JSON.parse(host().defaultView.localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const keep = (key, value) => { try { host().defaultView.localStorage.setItem(key, JSON.stringify(value)); } catch { /* kept for this session */ } };
const redraw = () => { state.html = null; twoWay.draw(host()); };
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
  // What the lists keep saying rests on their nodes' values: read for every list of five or more.
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
twoWay.headHooks.push(group => sortOf(group) ? `<span class="th-tw-piece"><span class="th-tw-sep" aria-hidden="true">·</span><span class="th-tw-sorted">by ${SORTS[sortOf(group)]}</span></span>` : '');
twoWay.viewMenuHooks.push(group => {
  const by = sortOf(group);
  return [{ group: 'Sort by' }, { label: 'Day', chosen: !by, run: () => setSort(group, '') },
    ...Object.entries(SORTS).map(([k, label]) => ({ label: label[0].toUpperCase() + label.slice(1), chosen: by === k, run: () => setSort(group, k) }))];
});

/* Pin a line (N2): kept per list on this page; pinned nodes lead the list in the order they were pinned. */
const PIN_KEY = 'thTwoWayPins';
const pinsOf = group => stored(PIN_KEY, {})[listKey(group)] || [];
function setPins(group, list) {
  const all = stored(PIN_KEY, {});
  if (list.length) all[listKey(group)] = list; else delete all[listKey(group)];
  keep(PIN_KEY, all); redraw();
}
function pin(group, item, on) {
  const before = pinsOf(group);
  setPins(group, on ? [...before.filter(u => u !== item.uuid), item.uuid] : before.filter(u => u !== item.uuid));
  twoWay.offerUndo(`${on ? 'Pinned' : 'Unpinned'} “${twoWay.shortName(item.title)}”`, () => setPins(group, before), group.name);
}
twoWay.listHooks.push((group, key, items) => {
  const pins = pinsOf(group);
  if (!pins.length) return items;
  const at = uuid => { const i = pins.indexOf(uuid); return i < 0 ? Infinity : i; };
  return [...items.filter(item => pins.includes(item.uuid)).sort((a, b) => at(a.uuid) - at(b.uuid)), ...items.filter(item => !pins.includes(item.uuid))];
});
twoWay.leadHooks.push((group, item) => pinsOf(group).includes(item.uuid) ? `<span class="th-tw-pinned" title="Pinned to the top of this list (right-click to unpin)" aria-label="Pinned">${shared.iconHtml('pin')}</span>` : '');
twoWay.betweenHooks.push((group, item, prev) => { const pins = pinsOf(group); return prev && pins.includes(prev.uuid) && !pins.includes(item.uuid) ? '<div class="th-tw-pingap"></div>' : ''; });
twoWay.lineMenuHooks.push((group, item) => {
  if (state.drawingTop) return [];
  const on = pinsOf(group).includes(item.uuid);
  return [{ icon: 'pin', label: on ? 'Unpin' : 'Pin to the top', run: () => pin(group, item, !on) }];
});

/* Gaps (N7): between two dated nodes, a silence of three times the list's usual gap, and two weeks at least. */
const daysBetween = (a, b) => Math.round((new Date(Math.floor(a / 10000), Math.floor(a / 100) % 100 - 1, a % 100) - new Date(Math.floor(b / 10000), Math.floor(b / 100) % 100 - 1, b % 100)) / 86400000);
const usualGap = new WeakMap();
function usual(group) {
  const by = twoWay.dayChoice(group), was = usualGap.get(group);
  if (was && was.by === by) return was.median;
  const days = group.items.map(item => twoWay.dayIn(group, item)).filter(Boolean).sort((a, b) => b - a);
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d)).filter(g => g > 0).sort((a, b) => a - b);
  const median = gaps.length >= 3 ? gaps[Math.floor(gaps.length / 2)] : 0;
  usualGap.set(group, { by, median });
  return median;
}
twoWay.betweenHooks.push((group, item, prev, key) => {
  // Only on the whole list in day order: a narrowed list's gaps are the narrowing's, not a silence.
  const was = prev && twoWay.dayIn(group, prev), day = twoWay.dayIn(group, item);
  if (!was || !day || sortOf(group) || pinsOf(group).includes(prev.uuid) || state.keeps.has(key) || state.onlyNew?.has(key) || String(state.find || '').trim()) return '';
  const gap = Math.abs(daysBetween(was, day)), median = usual(group);
  return median && gap >= 14 && gap >= 3 * median ? `<div class="th-tw-earlier lk-note th-tw-gap" title="No node of this list between ${esc(twoWay.dayText(Math.min(was, day)))} and ${esc(twoWay.dayText(Math.max(was, day)))}">quiet for ${gap} days</div>` : '';
});

/* What the list keeps saying (N6): values held by two nodes or more and by at least a third of the list, not by all of it
   (that says nothing the head does not), the three most held; a click narrows the list to the nodes holding one. */
state.keeps = new Map();
const valuesOf = item => { const out = []; for (const [name, entry] of state.values.get(item.uuid) || []) for (const v of entry.values || []) { const text = v.day ? '' : String(v.title ?? v.text ?? '').trim(); if (text) out.push({ name, text }); } return out; };
function sharedValues(group, items) {
  const counts = new Map();
  for (const item of items) for (const v of new Set(valuesOf(item).filter(v => v.name !== group.name).map(v => `${v.name}\u0000${v.text}`))) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].filter(([, n]) => n >= 2 && n >= items.length / 3 && n < items.length).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => { const [name, text] = k.split('\u0000'); return { name, text }; });
}
twoWay.listHooks.push((group, key, items) => { const k = state.keeps.get(key); return k ? items.filter(item => valuesOf(item).some(v => v.name === k.name && v.text === k.text)) : items; });
twoWay.underHeadHooks.push((group, key, items) => {
  if (group.items.length < 5 || twoWay.isMentions(group)) return '';
  const chosen = state.keeps.get(key);
  const found = chosen ? [chosen] : sharedValues(group, group.items);
  if (!found.length) return '';
  const held = chosen ? items.length : 0;
  return `<div class="th-tw-keeps"><span class="th-tw-keepsword">${chosen ? `Only these ${held}:` : 'Often'}</span>${found.map(v => `<button type="button" class="th-chip th-tw-chip th-tw-keep" data-keeps="${esc(key)}" data-kname="${esc(v.name)}" data-ktext="${esc(v.text)}" aria-pressed="${!!chosen}" title="${chosen ? 'Show the whole list' : `Only the nodes whose ${esc(v.name)} is ${esc(v.text)}`}"><span class="th-tw-kname">${esc(v.name)}</span> ${esc(v.text)}</button>`).join('')}</div>`;
});

twoWay.clickHooks.push(event => {
  const t = event.target;
  const onlyNew = t.closest?.('[data-onlynew]');
  if (onlyNew) { event.preventDefault(); event.stopPropagation(); const k = onlyNew.dataset.onlynew; if (state.onlyNew.has(k)) state.onlyNew.delete(k); else state.onlyNew.add(k); twoWay.setOpen?.(k, true); redraw(); return true; }
  const keeps = t.closest?.('[data-keeps]');
  if (keeps) { event.preventDefault(); event.stopPropagation(); const k = keeps.dataset.keeps; if (state.keeps.has(k)) state.keeps.delete(k); else state.keeps.set(k, { name: keeps.dataset.kname, text: keeps.dataset.ktext }); redraw(); return true; }
  return false;
});

/* A year line (N3): the days in a list's head open a thin line under it, one dot per node where its day falls, the months
   under the line; the pointer on a dot names its node, a click on a dot narrows the list to that week, a click in it again
   gives the whole list back. A click on the days again folds the line away. */
state.yearOn = new Set(); state.yearPick = new Map();
const dayNum = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const dateOf = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
twoWay.underHeadHooks.unshift((group, key) => {
  if (!state.yearOn.has(key)) return '';
  const dayOf = item => twoWay.dayIn(group, item);
  const dated = group.items.filter(dayOf);
  if (dated.length < 2) return '';
  const days = dated.map(dayOf), lo = Math.min(...days), hi = Math.max(...days);
  const t0 = dateOf(lo).getTime(), span = Math.max(1, dateOf(hi).getTime() - t0);
  const x = n => ((dateOf(n).getTime() - t0) / span * 100).toFixed(2);
  const pick = state.yearPick.get(key);
  const months = []; for (let d = new Date(dateOf(lo).getFullYear(), dateOf(lo).getMonth() + 1, 1); d.getTime() <= dateOf(hi).getTime(); d.setMonth(d.getMonth() + 1)) months.push(`<span class="th-tw-ymonth" style="left:${x(dayNum(d))}%">${MON[d.getMonth()]}${d.getMonth() === 0 ? ' ' + d.getFullYear() : ''}</span>`);
  const band = pick ? `<span class="th-tw-yband" style="left:${x(Math.max(lo, pick[0]))}%;width:${Math.max(.8, x(Math.min(hi, pick[1])) - x(Math.max(lo, pick[0])))}%"></span>` : '';
  const dots = dated.map(item => { const day = dayOf(item); return `<a href="#" role="button" class="th-tw-ydot${pick && (day < pick[0] || day > pick[1]) ? ' th-tw-yoff' : ''}" style="left:${x(day)}%" data-yday="${day}" data-ykey="${esc(key)}" title="${esc(`${twoWay.dayText(day)}: ${twoWay.shortName(item.title)}`)}" aria-label="${esc(twoWay.dayText(day))}"></a>`; }).join('');
  return `<div class="th-tw-yearline" role="group" aria-label="Where in time the nodes fall">${band}${dots}${months.join('')}</div>`;
});
twoWay.listHooks.push((group, key, items) => { const p = state.yearPick.get(key); return p ? items.filter(item => twoWay.dayIn(group, item) >= p[0] && twoWay.dayIn(group, item) <= p[1]) : items; });
twoWay.headHooks.push((group, key) => { const p = state.yearPick.get(key); return p ? `<span class="th-tw-piece"><span class="th-tw-sep" aria-hidden="true">·</span><span class="th-tw-sorted">showing ${esc(twoWay.dayText(p[0]))} to ${esc(twoWay.dayText(p[1]))}</span></span>` : ''; });

/* Compare two nodes (N4): with two picked, the bar's Compare lays them side by side in a card, one property to a line, the
   values that differ in the text colour and the same ones quiet, then their first bullets. */
async function compare(uuids, at) {
  if (uuids.length !== 2) return;
  const [a, b] = await Promise.all(uuids.map(async uuid => ({ uuid, title: twoWay.shortName(state.groups.flatMap(g => g.items).find(i => i.uuid === uuid)?.title || ''), fields: await twoWay.provided.nodeFields(uuid).catch(() => new Map()), lines: await twoWay.provided.firstLines(uuid, 4, true).catch(() => []) })));
  const text = (fields, name) => (fields.get(name) || []).map(v => v.day ? twoWay.dayText(v.day) : String(v.title ?? v.text ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1')).filter(Boolean).join(', ');
  const names = [...new Set([...a.fields.keys(), ...b.fields.keys()])].filter(n => n !== 'Date' || text(a.fields, n) !== text(b.fields, n));
  const readable = async t => String(await twoWay.provided.readableTitle(String(t || '')).catch(() => t)).replace(/\[\[([^\]]+)\]\]/g, '$1');
  const lines = async n => (await Promise.all(n.lines.map(l => readable(l.title)))).filter(Boolean).map(t => `<div class="th-tw-cmpline">${esc(t)}</div>`).join('') || '<div class="th-tw-cmpnone">no bullets</div>';
  const cell = (n, name) => { const t = text(n.fields, name), other = text((n === a ? b : a).fields, name); return `<div class="th-tw-cmpv${t === other ? ' th-tw-cmpsame' : ''}">${t ? esc(t) : '<span class="th-tw-cmpnone">empty</span>'}</div>`; };
  const html = `<div class="th-tw-cmp"><div></div><div class="th-tw-cmph">${esc(a.title)}</div><div class="th-tw-cmph">${esc(b.title)}</div>${names.map(name => `<div class="th-tw-cmpk">${esc(name)}</div>${cell(a, name)}${cell(b, name)}`).join('')}<div class="th-tw-cmpk">Bullets</div><div>${await lines(a)}</div><div>${await lines(b)}</div></div>`;
  twoWay.hidePeek();
  const pop = shared.popup({ at, width: 560, head: 'Compare', onClose: () => {}, items: [] });
  pop.body.insertAdjacentHTML('beforeend', html);
}

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

/* Saved views (N9): what the find line holds and how each list is grouped and sorted, kept under a name; the names stand as a
   quiet line under the find line, on every page, one click brings a view back, its × forgets it. */
const VIEWS_KEY = 'thTwoWayViews';
const views = () => stored(VIEWS_KEY, []);
const hasViews = () => views().length > 0;
function viewsHtml() {
  const list = views(), keepNow = String(state.find || '').trim() || state.groups.some(g => sortOf(g) || twoWay.groupOf(g));
  if (!list.length && !keepNow) return '';
  return `<div class="th-tw-views">${keepNow ? '<button type="button" class="lk-btn lk-low th-tw-keepview" data-keepview="">Keep this view</button>' : ''}${list.map((v, i) => `<span class="th-tw-view lk-reveals"><a href="#" class="th-tw-viewname" data-view="${i}" title="${esc(v.find ? `“${v.find}”` : 'Grouped and sorted as kept')}">${esc(v.name)}</a><button type="button" class="lk-x lk-reveal" data-viewoff="${i}" aria-label="Forget this view" title="Forget this view">×</button></span>`).join('')}</div>`;
}
async function keepView(at) {
  const name = await shared.ask({ at, question: 'Name this view', go: 'Keep', field: { placeholder: 'Before the dose change' } });
  if (!name || !String(name).trim()) return;
  const groups = {}, sorts = {};
  for (const g of state.groups) { const by = twoWay.groupOf(g); if (by) groups[g.name] = by; if (sortOf(g)) sorts[g.name] = sortOf(g); }
  const before = views();
  keep(VIEWS_KEY, [...before, { name: String(name).trim(), find: String(state.find || '').trim(), groups, sorts }]);
  redraw();
  twoWay.offerUndo(`Kept the view “${String(name).trim()}”`, () => { keep(VIEWS_KEY, before); redraw(); });
}
function applyView(i) {
  const v = views()[i];
  if (!v) return;
  state.find = v.find || '';
  for (const g of state.groups) { twoWay.setGroup?.(g.name, v.groups?.[g.name] || ''); const all = stored(SORT_KEY, {}); if (v.sorts?.[g.name]) all[listKey(g)] = v.sorts[g.name]; else delete all[listKey(g)]; keep(SORT_KEY, all); }
  redraw();
}
function forgetView(i) {
  const before = views(), gone = before[i];
  keep(VIEWS_KEY, before.filter((_, j) => j !== i)); redraw();
  if (gone) twoWay.offerUndo(`Forgot the view “${gone.name}”`, () => { keep(VIEWS_KEY, before); redraw(); });
}

/* The keyboard walk (N14): with the keyboard on a node's name, Down and Up go to the next and the one before, Right opens it
   in place, Left closes it (or goes to the node it is in), Space picks it, turning picking on for its list; Enter opens its
   page, as always; Esc lets go. */
twoWay.starters.push(() => {
  const doc = host();
  const names = () => [...doc.querySelectorAll('.th-two-way a.th-tw-record')].filter(a => a.offsetParent);
  // Opening or closing draws the rows again: the keyboard stays on the same node's name, found by its place.
  const keepOn = key => { let tries = 0; const again = () => { const chev = doc.querySelector(`.th-two-way [data-dig="${CSS.escape(key)}"]`); const name = chev?.closest('.th-ol-line, .th-ol-prop')?.querySelector('a.th-tw-record'); if (name && doc.activeElement !== name) name.focus({ preventScroll: true }); if (++tries < 12) setTimeout(again, 120); }; setTimeout(again, 60); };
  const onKey = event => {
    const at = doc.activeElement;
    if (!at?.matches?.('.th-two-way a.th-tw-record') || event.metaKey || event.ctrlKey || event.altKey) return;
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
      to = [...doc.querySelectorAll(`.th-tw-row[data-field="${CSS.escape(group.name)}"] .th-tw-line[data-uuid="${CSS.escape(line.dataset.uuid)}"] a.th-tw-record`)][0];
    } else return;
    event.preventDefault(); event.stopPropagation();
    if (to) to.focus({ preventScroll: false });
  };
  doc.addEventListener('keydown', onKey, true);
  twoWay.onUnload(() => doc.removeEventListener('keydown', onKey, true));
});

twoWay.clickHooks.push(event => {
  const t = event.target, stop = () => { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); };
  const when = t.closest?.('.th-tw-head a.th-tw-when');
  if (when) { stop(); const k = when.dataset.key; if (state.yearOn.has(k)) { state.yearOn.delete(k); state.yearPick.delete(k); } else { state.yearOn.add(k); twoWay.setOpen?.(k, true); } redraw(); return true; }
  const ydot = t.closest?.('[data-yday]');
  if (ydot) {
    stop(); const k = ydot.dataset.ykey, d = Number(ydot.dataset.yday), p = state.yearPick.get(k);
    if (p && d >= p[0] && d <= p[1]) state.yearPick.delete(k);
    else { const at = dateOf(d); state.yearPick.set(k, [dayNum(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 3)), dayNum(new Date(at.getFullYear(), at.getMonth(), at.getDate() + 3))]); }
    redraw(); return true;
  }
  const odd = t.closest?.('[data-odd]');
  if (odd) {
    stop();
    const line = odd.closest('.th-tw-line'), chev = line?.querySelector('[data-dig]');
    if (chev) { state.emptyOpen.add(chev.dataset.dig); if (chev.getAttribute('aria-expanded') !== 'true') chev.click(); }
    return true;
  }
  if (t.closest?.('[data-keepview]')) { stop(); keepView(t.closest('[data-keepview]')).catch(error => warnOnce('could not keep the view', error)); return true; }
  const v = t.closest?.('[data-view]'); if (v) { stop(); applyView(Number(v.dataset.view)); return true; }
  const off = t.closest?.('[data-viewoff]'); if (off) { stop(); forgetView(Number(off.dataset.viewoff)); return true; }
  return false;
});

/* Drag a line to another list (N5): a node's line dragged onto another list's head gives the node that list's property,
   pointing at this page, so it stands in that list too; the faded arrow takes the property off again. */
let dragNode = null;
twoWay.starters.push(() => {
  const doc = host();
  const start = e => { const line = !e.target.closest?.('.th-tw-name') && e.target.closest?.('.th-two-way .th-tw-line[data-uuid]'); if (!line || state.drawingTop) return; const from = line.closest('.th-tw-row')?.dataset.field; dragNode = { uuid: line.dataset.uuid, from }; line.classList.add('th-tw-dragging'); };
  const target = e => { const row = e.target.closest?.('.th-two-way .th-tw-row'); const group = row && state.groups.find(g => g.name === row.dataset.field); return group && group.ident && group.name !== dragNode?.from ? { row, group } : null; };
  const clear = () => { for (const el of doc.querySelectorAll('.th-tw-row[data-dropnode], .th-tw-line.th-tw-dragging')) { el.removeAttribute('data-dropnode'); el.classList.remove('th-tw-dragging'); } };
  const over = e => { if (!dragNode) return; const t = target(e); for (const el of doc.querySelectorAll('.th-tw-row[data-dropnode]')) if (el !== t?.row) el.removeAttribute('data-dropnode'); if (!t) return; e.preventDefault(); e.stopPropagation(); t.row.setAttribute('data-dropnode', ''); };
  const drop = e => {
    if (!dragNode) return; const t = target(e), node = dragNode; dragNode = null; clear();
    if (!t) return; e.preventDefault(); e.stopPropagation();
    joinList(node.uuid, t.group).catch(error => { warnOnce('could not move the node into the list', error); shared.notify('The node could not be put in that list', 'warning'); });
  };
  const end = () => { dragNode = null; clear(); };
  doc.addEventListener('dragstart', start, true); doc.addEventListener('dragover', over, true); doc.addEventListener('drop', drop, true); doc.addEventListener('dragend', end, true);
  twoWay.onUnload(() => { doc.removeEventListener('dragstart', start, true); doc.removeEventListener('dragover', over, true); doc.removeEventListener('drop', drop, true); doc.removeEventListener('dragend', end, true); });
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

/* Ask this page (N13): a question after a "?" in the find line finds the page's nodes nearest to it in meaning, by Apple's
   sentence matcher in Predictive's helper on this Mac (nothing leaves it); the lists narrow to them, nearest first. Apple's
   model that writes an answer in words is not on every Mac (this one says "device not eligible"), so the answer is the nodes. */
const HELPER = 'http://127.0.0.1:47615';
state.ask = { q: '', page: '', hits: null, asking: false };
const askOf = () => { const t = String(state.find || '').trim(); return t.startsWith('?') ? t.slice(1).trim() : ''; };
async function askPage(q) {
  const items = [...new Map(state.groups.flatMap(g => g.items).map(item => [item.uuid, item])).values()];
  const ids = new Map(items.map((item, i) => [i + 1, item.uuid]));
  const graph = `threads:${state.pageUuid}`;
  const post = body => fetch(HELPER + '/meaning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) }).then(r => r.json());
  if (state.ask.page !== state.pageUuid) { await post({ graph, learn: items.map((item, i) => ({ id: i + 1, text: item.title })) }); state.ask.page = state.pageUuid; }
  const answer = await post({ graph, text: q, k: 8 });
  const near = (answer.near || []).filter(n => n.sim >= .3);
  return new Map(near.map(n => [ids.get(n.id), n.sim]));
}
twoWay.listHooks.unshift((group, key, items) => {
  const q = askOf();
  if (!q) return items;
  if (state.ask.q !== q && !state.ask.asking) {
    state.ask.asking = true;
    const asked = q;
    setTimeout(() => askPage(asked).then(hits => { state.ask = { ...state.ask, q: asked, hits, asking: false, failed: false }; redraw(); }, error => { state.ask = { ...state.ask, q: asked, hits: new Map(), asking: false, failed: true }; warnOnce('could not ask the matcher', error); redraw(); }), 350);
  }
  if (state.ask.q !== q || !state.ask.hits) return items;
  return items.filter(item => state.ask.hits.has(item.uuid)).sort((a, b) => state.ask.hits.get(b.uuid) - state.ask.hits.get(a.uuid));
});
twoWay.askCount = () => { const q = askOf(); if (!q) return ''; if (state.ask.q !== q || !state.ask.hits) return 'asking…'; if (state.ask.failed) return 'Predictive’s helper did not answer'; return state.ask.hits.size ? `${state.ask.hits.size} nearest in meaning, read on this Mac` : 'nothing near in meaning'; };

/* Keep a list beside you (N15): a list's right-click keeps it in a small panel at the window's right edge, there while you
   visit other pages; a line in it opens its node, × lets it go. Kept in Logseq's window storage. */
const BESIDE_KEY = 'thTwoWayKept';
function keepBeside(group) {
  const kept = { page: state.pageUuid, title: state.pageTitle, label: group.label, name: group.name, items: group.items.slice(0, 40).map(item => ({ uuid: item.uuid, title: twoWay.shortName(item.title), day: twoWay.dayCell(item) })) };
  keep(BESIDE_KEY, kept); drawBeside();
}
function drawBeside() {
  const doc = host(), kept = stored(BESIDE_KEY, null);
  let panel = doc.querySelector('.th-tw-dock');
  if (!kept) { panel?.remove(); return; }
  // Fresh nodes from the look-up of every page, where it has the page.
  const fresh = state.byPage.get(kept.page)?.find(g => g.name === kept.name);
  const items = fresh ? fresh.items.slice(0, 40).map(item => ({ uuid: item.uuid, title: twoWay.shortName(item.title), day: twoWay.dayCell(item) })) : kept.items;
  if (!panel) { panel = doc.createElement('div'); panel.className = 'th-tw-dock lk-pop'; doc.body.append(panel); }
  panel.innerHTML = `<div class="th-tw-dockhead"><span><b>${esc(kept.label)}</b> <span class="th-tw-dockpage">${esc(kept.title)}</span></span><button type="button" class="lk-x" data-dockoff="" aria-label="Let this list go" title="Let this list go">×</button></div><div class="th-tw-docklist">${items.map(item => `<a href="#" class="th-tw-dockline" data-dockopen="${esc(item.uuid)}"><span class="th-tw-dockday">${esc(item.day || '')}</span><span>${esc(item.title)}</span></a>`).join('')}</div>`;
}
twoWay.rowMenuHooks.push(group => state.drawingTop ? [] : [{ icon: 'sidebar', label: 'Keep this list beside you', run: () => keepBeside(group) }, { icon: 'export', label: 'Export list…', run: () => exportList(group) }]);
twoWay.settledHooks.push(() => drawBeside());
twoWay.starters.push(() => {
  const doc = host();
  const onDock = e => {
    const off = e.target.closest?.('.th-tw-dock [data-dockoff]'), open = e.target.closest?.('.th-tw-dock [data-dockopen]');
    if (off) { e.preventDefault(); const before = stored(BESIDE_KEY, null); keep(BESIDE_KEY, null); drawBeside(); twoWay.offerUndo('The list beside you is gone', () => { keep(BESIDE_KEY, before); drawBeside(); }); }
    else if (open) { e.preventDefault(); shared.openEntity(open.dataset.dockopen, e.shiftKey); }
  };
  doc.addEventListener('click', onDock, true);
  twoWay.onUnload(() => { doc.removeEventListener('click', onDock, true); doc.querySelector('.th-tw-dock')?.remove(); });
  setTimeout(drawBeside, 1500);
});

/* Export list (N16): what the list shows, after the find line, the day, the grouping and the order, leaves through DB Export's
   window, as PDF, Markdown or rich text. */
function exportList(group) {
  const app = window.DbExport?.app;
  if (!app?.exportWindow) return shared.notify('DB Export is off: switch it on to export a list', 'warning');
  const key = `${state.pageUuid}|${group.name}`;
  const shown = twoWay.listHooks.reduce((xs, hook) => hook(group, key, xs) || xs, (twoWay.foundGroups?.() || state.groups).find(g => g.name === group.name)?.items || group.items);
  app.exportWindow({ uuids: shown.map(item => item.uuid), title: `${group.label} · ${state.pageTitle}`, what: `${shown.length} nodes of “${group.label}”` });
}

/* Same as… (N18): two nodes of one list on one day whose words are nearly the same; the first carries a pencil. Joined, the
   second goes under the first as one of its bullets, with all it holds, and leaves this page's list; nothing is deleted, and
   the faded arrow puts it back where it was. */
const wordsSet = t => new Set(String(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2));
const alike = (a, b) => { const x = wordsSet(a), y = wordsSet(b); if (!x.size || !y.size) return false; let n = 0; for (const w of x) if (y.has(w)) n++; return n / Math.min(x.size, y.size) >= .75; };
const twinOf = (group, item) => item.day ? group.items.find(other => other !== item && other.day === item.day && alike(other.title, item.title) && group.items.indexOf(other) > group.items.indexOf(item)) : null;
twoWay.tailHooks.push((group, item) => {
  if (state.drawingTop) return '';
  const twin = twinOf(group, item);
  return twin ? shared.outline.pencil('same as the next?', { 'data-twin': item.uuid, 'data-twinof': twin.uuid, 'data-twinfield': group.name, title: `“${twoWay.shortName(twin.title)}”, the same day, reads almost the same. Click to join it into this one.` }) : '';
});
async function joinTwin(keepUuid, goneUuid, groupName, at) {
  const group = state.groups.find(g => g.name === groupName), gone = group?.items.find(i => i.uuid === goneUuid);
  if (!group || !gone) return;
  const ok = await shared.ask({ at, question: `Join “${twoWay.shortName(gone.title)}” into this one?`, note: 'It goes under this node as one of its bullets, with all it holds, and leaves this list. Nothing is deleted.', go: 'Join' });
  if (!ok) return;
  const block = await twoWay.provided.getBlock(goneUuid, { includeChildren: false });
  const parent = block?.parent?.uuid || block?.page?.uuid, left = block?.left?.uuid;
  const prop = group.ident ? (await twoWay.provided.propSchema()).props.find(p => p.ident === group.ident) : null;
  const here = await twoWay.provided.idByUuid(state.pageUuid);
  const had = prop ? await twoWay.heldNow(goneUuid, prop) : [];
  if (prop && here) await twoWay.setValues(goneUuid, prop, had.filter(v => v !== here));
  await twoWay.provided.moveBlock(goneUuid, keepUuid, { children: true });
  twoWay.later(200);
  await twoWay.offerKept(prop ? [[goneUuid, prop.ident]] : [], 'Joined two nodes', async () => {
    if (left && left !== parent) await twoWay.provided.moveBlock(goneUuid, left, { before: false }); else if (parent) await twoWay.provided.moveBlock(goneUuid, parent, { children: true });
    if (prop) await twoWay.setValues(goneUuid, prop, had);
    twoWay.later(200);
  }, groupName);
}

/* A bullet becomes a node (N19): a bullet of an opened node whose words look like one of your kinds (Predictive's guess, as for
   an untagged mention) carries a pencil, "could be a Symptom Log · Symptom type"; a click gives it that tag and that property
   pointing at this page, so it stands in this page's list; the faded arrow takes both off. */
twoWay.bulletTail = uuid => {
  if (!state.raise.has(uuid)) { twoWay.prepareRaise?.(uuid).catch(() => {}); return ''; }
  const best = state.raise.get(uuid)?.best;
  return best ? shared.outline.pencil(`could be a ${best.tag.title} · ${best.prop.title}`, { 'data-bnode': uuid, title: `Its words look like a ${best.tag.title}: click to make it one, with “${best.prop.title}” set to this page` }) : '';
};

twoWay.clickHooks.push(event => {
  const t = event.target, stop = () => { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); };
  const twin = t.closest?.('[data-twin]');
  if (twin) { stop(); joinTwin(twin.dataset.twin, twin.dataset.twinof, twin.dataset.twinfield, twin).catch(error => { warnOnce('could not join the nodes', error); shared.notify('The two could not be joined', 'warning'); }); return true; }
  const bnode = t.closest?.('[data-bnode]');
  if (bnode) { stop(); const best = state.raise.get(bnode.dataset.bnode)?.best; if (best) twoWay.raise?.(best, [bnode.dataset.bnode]).then(() => twoWay.later(200)).catch(error => warnOnce('could not make the bullet a node', error)); return true; }
  return false;
});
twoWay.starters.push(() => { state.stamps = new Map(); state.keeps = new Map(); state.visitPage = ''; state.yearOn = new Set(); state.yearPick = new Map(); });

Object.assign(twoWay, { exportList, keepBeside, compare, hasViews, isNew, pinsOf, sortOf, viewsHtml });
})();
