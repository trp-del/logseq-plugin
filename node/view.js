/* NODE: how a list of what points at a node is shown, and what its head offers. The deciding is core/view.js; this draws it.
   A head names the list's kinds with their counts (All first, the one in force marked), "2 new" for nodes made since the page
   was last open, the + and one faint ⋯ that opens View: Group by, Date, Sort by, Pick nodes, Move up and Move down. A setting
   that is not the default is said quietly before the days. What is set is kept for the list's property on every page; the order
   of a page's lists is kept for that page.
     G.listview.state(uuid)                 what a place keeps for its lists while it stands
     G.listview.dayPlaces(start, take)      a menu's two lines for where a row's day stands
     G.listview.shape(state, list, names, today), head(...), items(...), paint(el, item), act(state, event)   used by the listing */
(function () {
const G = window.PluginDoor, V = G.view, D = G.days, W = G.words;
const store = (key, fallback) => {
  let kept = null;
  const read = () => { if (kept == null) { try { kept = JSON.parse(G.host().defaultView.localStorage.getItem(key) || 'null') ?? fallback; } catch (error) { kept = fallback; } } return kept; };
  return { get: read, set(value) { kept = value; try { G.host().defaultView.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* kept for this sitting only */ } } };
};
const views = store('lk.views', {}), orders = store('lk.lists-order', {}), seen = store('lk.seen', {});
const reads = store('lk.reads', {}), oneEnd = store('lk.one-end', []);   // how a property reads on the pages it points to, by the person; the properties not listed there at all
const viewOf = key => views.get()[key] || {};
const setView = (key, change) => { const next = { ...viewOf(key), ...change }; for (const name of Object.keys(next)) if (!next[name]) delete next[name]; const all = { ...views.get() }; if (Object.keys(next).length) all[key] = next; else delete all[key]; views.set(all); };
const VIEWED = new Set(['property', 'mentions', 'due']);
// What a place keeps for its lists while it stands: the kind in force in each, the words being found, what is being picked.
function state(uuid) {
  const last = seen.get()[uuid] || 0;
  seen.set({ ...seen.get(), [uuid]: Date.now() });
  return { uuid, own: 0, since: last, kinds: new Map(), find: { words: '', upTo: 0 }, picking: new Set(), picked: new Map(), all: new Set(), spans: new Map(), lanes: new Map(), lit: new Map() };
}
const order = uuid => orders.get()[uuid] || [];
function shape(state, list, names, today) {
  const view = state.view;
  if (!view || !VIEWED.has(list.kind)) return null;
  const rows = list.rows.map(row => ({ ...row, plain: W.plain(W.firstLine(row.words).line, names) }));
  const time = G.timeline.narrowing(state, { ...list, rows });
  const made = V.shape({ ...list, rows, own: view.own }, { ...viewOf(list.key), kind: view.kinds.get(list.key) || '', since: view.since, span: time.span, lane: time.lane }, view.find, today);
  if (time.span || time.lane) made.said.push(`showing ${[time.lane ? `${viewOf(list.key).timeline} ${time.lanes.names[time.lane.at]}` : '', time.span ? `${D.short(time.span[0], today)} to ${D.short(time.span[1], today)}` : ''].filter(Boolean).join(', ')}`);
  made.finding ||= !!(time.span || time.lane);
  made.finding = !!(view.find.words || view.find.upTo) || made.finding;
  made.kind = view.kinds.get(list.key) || '';
  /* The tags every row of the list holds, beside the one the head already names as its kind: said once, on the head, and left
     off the rows. Task is not counted on a row that shows its status circle. (A deciding piece: core/view.js shape should
     answer it; until then it is worked out here.) */
  const sayable = row => (row.tags || []).map(tag => tag.title).filter(title => title && !(title === 'Task' && row.status)), kindsHere = new Set(list.rows.map(row => row.tag));
  made.shared = list.rows.length > 1 ? sayable(list.rows[0]).filter(title => !kindsHere.has(title) && list.rows.every(row => sayable(row).includes(title))) : [];   // not a tag the head counts as a kind: that one is said there already
  made.picking = view.picking.has(list.key);
  made.picked = view.picked.get(list.key) || new Set();
  return made;
}
const icon = (name, size = 14) => G.touch.icon(name, size);
// The second line of a list's head: its kinds, what is new, the + and the ⋯, what is set, the days.
function head(state, list, made, plus, today) {
  const tab = (kind, word, n, on, extra = '') => `<button type="button" class="lk-tab${on ? ' on' : ''}${extra}" data-kind="${G.esc(kind)}" aria-pressed="${on}">${G.esc(word)}${n == null ? '' : ` <span class="lk-n">${n}</span>`}</button>`;
  let kinds = '';
  if (made.tabs.length) {
    kinds = made.tabs.map(one => tab(one.kind, one.word, one.n, one.on)).join('');
    if (made.kind && made.kind !== '@new' && !made.tabs.some(one => one.kind === made.kind)) kinds += tab(made.kind, made.kind === '@none' ? 'No tag' : made.kind, made.count, true);
    if (made.more) kinds += `<button type="button" class="lk-tab lk-tabmore">and ${made.more} more</button>`;
  } else kinds = tab(made.one || '', made.one || 'All', made.count, !!made.one && made.kind === made.one);   // one kind: the same tab every head has, its name and count (the owner's marked page, 26 Nov: "Recommended, then Recommendations")
  kinds += (made.shared || []).map(title => `<span class="lk-tag">${G.esc(title)}</span>`).join('');   // a tag every row holds, said once here (after the kinds, as a head says a tag after its name)
  if (made.fresh) kinds += tab('@new', `${made.fresh} new`, null, made.kind === '@new', ' lk-newtab');
  const dots = `<button type="button" class="lk-dots" title="View and more" aria-label="View and more">${icon('dots', 16)}</button>`;
  const said = made.said.length ? `<button type="button" class="lk-set" title="View">${G.esc(made.said.join(' · '))}</button>` : '';
  const finding = !!(state.view.find.words || state.view.find.upTo);
  if (finding && made.total !== made.count) kinds += `<span class="lk-today">${made.total} today</span>`;
  return `${made.picking ? `<input type="checkbox" class="lk-tick lk-tick-all" aria-label="Pick every node of the list">` : ''}<span class="lk-tabs">${kinds}</span><span class="lk-head-do">${plus}${dots}</span><span class="lk-head-end">${said}${made.from && made.to ? `<span class="lk-span">${G.esc(D.short(made.from, today))} to ${G.esc(D.short(made.to, today))}</span>` : ''}</span>`;   // the span of the list's days at the head's right end, as before 0.9 (the owner's choice, 26 November 2026: "before for list head")
}
// What stands under the head, in order: a group's line, a node's row, the line saying since when.
const GROUP_FEW = 12;   // a group's nodes before its own "Show more", as before the rebuild
function items(state, list, made, few) {
  const by = viewOf(list.key).group || '', out = [], row = (one, under = '', faint = false) => ({ type: 'row', key: under ? `${one.uuid}@${under}` : one.uuid, row: one, faint, picking: made.picking, picked: made.picked.has(one.uuid) });
  if (made.groups) {
    for (const group of made.groups) {
      const shut = G.node.folded.has(`${list.key}/${group.key}`);
      const draft = G.adding.item(state, list, group), gkey = `${list.key}/${group.key}/all`, whole = made.picking || state.view.all.has(gkey) || group.rows.length <= GROUP_FEW;
      // + on a group: a node here, with the group's tag, or its value under the property the list is grouped by (not for a month, nor for those with none).
      out.push({ type: 'group', key: `g:${group.key}`, group: { ...group, by, byTag: by === 'Tag' }, shut: shut && !draft, plus: list.kind === 'property' && by !== 'Month' && (by === 'Tag' || !!group.key) });
      if (draft) out.push({ type: 'draft', key: 'draft' });
      if (!shut || draft) { for (const one of whole ? group.rows : group.rows.slice(0, GROUP_FEW)) out.push(row(one, `g:${group.key}`));
        if (group.rows.length > GROUP_FEW && !made.picking) out.push({ type: 'more', key: `m:${group.key}`, gkey, n: group.rows.length - GROUP_FEW, fewer: whole }); }
    }
  } else {
    const all = made.picking || state.view.all.has(list.key) || made.rows.length <= few;   // while finding too: a few, then "Show more", as before the rebuild
    for (const one of all ? made.rows : made.rows.slice(0, few)) out.push(row(one));
    out.hidden = all ? 0 : made.rows.length - few;
  }
  if (made.since.length) { out.push({ type: 'since', key: 'since', n: made.since.length, day: state.view.find.upTo }); for (const one of made.since) out.push(row(one, 'since', true)); }
  return out;
}
// A group's line or the since line, drawn into its element.
function paint(el, item, today) {
  if (item.type === 'more') { const words = item.fewer ? 'Show fewer' : `Show ${item.n} more`; el.className = 'lk-more lk-more-link lk-more-group'; el.type = 'button'; el.dataset.gkey = item.gkey; el.dataset.fewer = item.fewer ? '1' : ''; if (el.textContent !== words) el.textContent = words; return; }
  const html = item.type === 'group'
    ? `<span class="lk-fold">${G.node.CHEV}</span><span class="${item.group.tag ? 'lk-tag' : 'lk-group-name'}">${G.esc(item.group.name)}</span><span class="lk-n">${item.group.rows.length}</span>${item.plus ? `<button type="button" class="lk-plus" title="Add a node here" aria-label="Add a node here">${icon('plus', 12)}</button>` : ''}`
    : `<span>since ${G.esc(D.short(item.day, today))}</span><span class="lk-n">${item.n}</span>`;
  el.className = item.type === 'group' ? 'lk-group-head' : 'lk-since';
  if (item.type === 'group') { el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-expanded', String(!item.shut)); el.dataset.group = item.group.key; el.lkGroup = item.group; }
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
}
// Where a row's day stands, the same two lines in every list's menu: before the words, or at the line's right end.
const dayPlaces = (start, take) => [{ group: 'Date position' }, ...[[true, 'Beginning of the line'], [false, 'End of the line']].map(([value, word]) => ({ word, on: value === start, take: () => take(value) }))];
// View: what a list goes by, as an ordinary menu: a line per setting, its choices in a menu beside it, the one in force ticked.
function viewItems(state, box) {
  const list = box.lkList, key = list.key, now = viewOf(key), offers = V.offers(list.rows), view = state.view;
  const set = change => { setView(key, change); state.redraw(); };
  const choose = (title, name, choices) => choices.map(([value, word, face]) => ({ word, face, on: (now[name] || '') === value, take: () => set({ [name]: value }) }));
  const sortWord = { '': 'Day', changed: 'Last changed', name: 'Name', tag: 'Tag' };
  const keys = [...state.el.querySelectorAll(':scope > .lk-list')].map(one => one.dataset.key), at0 = keys.indexOf(key);
  const move = by => { orders.set({ ...orders.get(), [view.uuid]: V.moved(keys, key, by) }); state.again(); };
  const picking = view.picking.has(key);
  const timeline = { word: 'Timeline', sub: [
    { word: 'Hidden', on: !now.timeline, take: () => { view.spans.delete(key); view.lanes.delete(key); view.lit.delete(key); set({ timeline: '' }); } }, { word: 'One line', on: now.timeline === 'line', take: () => { view.lanes.delete(key); set({ timeline: 'line' }); } },
    ...offers.groups.filter(name => name !== 'Tag' && name !== 'Month').map(name => ({ word: `By ${name}`, face: 'prop', on: now.timeline === name, take: () => { view.lanes.delete(key); set({ timeline: name }); } })),
    ...(now.timeline ? [{ gap: true }, { word: 'Taller', on: !!now.tall, take: () => set({ tall: now.tall ? '' : '1' }) }] : [])] };
  // The order and the words the plugin had before the rebuild: Group by, Sort by, Timeline, Date; then Pick nodes; then moving the list.
  return [
    { word: 'Group by', sub: choose('Group by', 'group', [['', 'None'], ...offers.groups.map(name => [name, name, name === 'Tag' || name === 'Month' ? '' : 'prop'])]) },
    { word: 'Sort by', sub: choose('Sort by', 'sort', [['', 'Day'], ...offers.sorts.map(name => [name, sortWord[name]])]) },
    timeline,
    { word: 'Date', sub: [...choose('Date', 'date', [['', 'Date or journal'], ...offers.dates.map(name => [name, name === 'Journal' ? 'The day it is written on' : name, name === 'Journal' ? '' : 'prop']), ['none', 'No date']]),
      { gap: true }, ...dayPlaces(now.at === 'start', start => set({ at: start ? 'start' : '' }))] },
    { gap: true },
    { word: picking ? 'Stop picking' : 'Pick nodes', take: () => { if (picking) { view.picking.delete(key); view.picked.delete(key); } else view.picking.add(key); state.redraw(); } },
    ...(at0 > 0 || (at0 >= 0 && at0 < keys.length - 1) ? [{ gap: true }] : []),
    ...(at0 > 0 ? [{ word: 'Move up', take: () => move(-1) }] : []),
    ...(at0 >= 0 && at0 < keys.length - 1 ? [{ word: 'Move down', take: () => move(1) }] : []),
  ];
}
const menu = (state, box, at) => G.menu(at, viewItems(state, box));
// A property's name, right-clicked: View, how it reads back, and hiding it where it points.
function nameMenu(state, box, at) {
  const list = box.lkList;
  if (list.kind !== 'property') return menu(state, box, at);
  const title = list.prop.title, give = name => { const all = { ...reads.get() }; if (name && name !== G.reads.back(title)) all[title] = name; else delete all[title]; reads.set(all); state.again(); };
  G.menu(at, [
    { word: 'View', sub: () => viewItems(state, box) },
    { gap: true },
    { word: 'Reads back as…', take: () => G.menu(at, [{ group: `How ${title} reads on the pages it points to` }, { word: G.reads.back(title), value: 'by grammar', on: !reads.get()[title], take: () => give('') },
      ...(G.reads.back(title) === title ? [] : [{ word: title, value: 'its own name', on: reads.get()[title] === title, take: () => give(title) }])], { find: 'Or type how it reads', enter: give }) },
    { word: 'Hide where it points', take: () => { oneEnd.set([...new Set([...oneEnd.get(), list.prop.ident])]); state.again(); G.say(`${list.name} is no longer listed on the pages it points to. Right-click the word Relations to bring it back.`); } },
  ]);
}
// Every kind of a list with its count, for "and 3 more".
function kindsMenu(state, box, at) {
  const list = box.lkList, now = state.view.kinds.get(list.key) || '';
  G.menu(at, [{ word: 'All', value: String(list.rows.length), on: !now, take: () => { state.view.kinds.delete(list.key); state.redraw(); } },
    ...V.kinds(list.rows).map(one => ({ word: one.name || 'No tag', face: one.name ? 'tag' : '', value: String(one.n), on: now === (one.name || '@none'), take: () => { state.view.kinds.set(list.key, one.name || '@none'); state.redraw(); } }))]);
}
// A press or a key on what a head and its groups offer. True when it was taken.
function act(state, event) {
  const target = event.target, box = target.closest('.lk-list');
  if (!box || box.parentElement !== state.el || !box.lkList || !VIEWED.has(box.lkList.kind)) return false;
  const key = box.lkList.key, view = state.view, press = event.type === 'click' || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' '));
  if (event.type === 'contextmenu' && target.closest('.lk-list-head')) { event.preventDefault(); (target.closest('.lk-list-via') ? nameMenu : menu)(state, box, { x: event.clientX, y: event.clientY, from: target.closest('.lk-list-head') }); return true; }
  if (!press) return false;
  const tab = target.closest('.lk-tab');
  if (tab) {
    event.preventDefault();
    if (tab.classList.contains('lk-tabmore')) kindsMenu(state, box, tab);
    else { const kind = tab.dataset.kind; if (!kind || view.kinds.get(key) === kind) view.kinds.delete(key); else view.kinds.set(key, kind); state.redraw(); }
    return true;
  }
  const dots = target.closest('.lk-dots, .lk-set');
  if (dots) { event.preventDefault(); menu(state, box, dots); return true; }
  const group = target.closest('.lk-group-head');
  if (group) { event.preventDefault(); G.node.moved(state.el, () => { G.node.folded.flip(`${key}/${group.dataset.group}`); state.redraw(); }); return true; }
  return false;
}
/* Dragging. A node's line dragged onto the head of another property's list gets that list's property, pointing here. A list's
   name dragged above or below another list sets the order of the page's lists. Gives back what takes the ears away. */
function drags(state) {
  const el = state.el, view = state.view, doc = el.ownerDocument;
  let moving = null, marked = null;
  const unmark = () => { marked?.removeAttribute('data-drop'); marked = null; };
  const mine = target => { const box = target.closest?.('.lk-list'); return box && box.parentElement === el ? box : null; };
  const where = (event, box) => {
    if (!moving || !box) return '';
    if (moving.kind === 'list') { if (box.dataset.key === moving.key) return ''; const at = box.getBoundingClientRect(); return event.clientY < at.top + Math.min(at.height, 60) / 2 ? 'above' : 'below'; }
    return box.lkList?.kind === 'property' && box.dataset.key !== moving.from && event.target.closest('.lk-list-head') ? 'into' : '';
  };
  const start = event => {
    const box = mine(event.target), line = event.target.closest?.('.lk-row > .lk-line'), via = event.target.closest?.('.lk-list-via');
    if (!box || !VIEWED.has(box.lkList?.kind)) return;
    if (line && line.closest('.lk-list') === box && !line.parentElement.dataset.open) moving = { kind: 'node', uuid: line.parentElement.dataset.uuid, from: box.dataset.key, words: line.querySelector('.lk-words')?.innerText || '' };
    else if (via) moving = { kind: 'list', key: box.dataset.key };
    else return;
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', moving.uuid || moving.key);
  };
  const over = event => { const box = mine(event.target), at = where(event, box); if (!at) { unmark(); return; } event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (marked !== box) unmark(); marked = box; box.dataset.drop = at; };
  const drop = async event => {
    const box = mine(event.target), at = where(event, box), was = moving; unmark(); moving = null;
    if (!at || !was) return;
    event.preventDefault();
    if (was.kind === 'list') {
      const keys = [...el.querySelectorAll(':scope > .lk-list')].map(one => one.dataset.key).filter(key => key !== was.key), i = keys.indexOf(box.dataset.key) + (at === 'below' ? 1 : 0);
      keys.splice(i, 0, was.key); orders.set({ ...orders.get(), [view.uuid]: keys }); state.again(); return;
    }
    if (box.lkList.rows.some(row => row.uuid === was.uuid)) return;   // it points here through that property already: nothing to write
    // The way back is the Undo arrow after the line's words, as for every change made from a line.
    try { const here = await G.read.node(view.uuid); await G.undo.after(was.uuid, G.write.setNode(was.uuid, box.lkList.prop.ident, here.id)); state.again(); }
    catch (error) { G.write.refused(`It could not be given ${box.lkList.prop.title}`, error); }
  };
  const end = () => { unmark(); moving = null; };
  const ears = [['dragstart', start], ['dragover', over], ['drop', drop], ['dragend', end], ['dragleave', event => { if (!el.contains(event.relatedTarget)) unmark(); }]];
  for (const [type, fn] of ears) el.addEventListener(type, fn);
  return () => { for (const [type, fn] of ears) el.removeEventListener(type, fn); };
}
// The properties hidden where they point, to bring back: a list at the word Relations.
async function hiddenMenu(at, again) {
  const idents = oneEnd.get(), props = await G.read.properties();
  if (!idents.length) return false;
  G.menu(at, [{ group: 'Hidden where they point. A press shows one again' }, ...idents.map(ident => ({ word: props.get(ident)?.title || ident, face: 'prop', take: () => { oneEnd.set(oneEnd.get().filter(one => one !== ident)); again(); } }))]);
  return true;
}
G.listview = { dayPlaces, state, order, shape, head, items, paint, act, menu, viewOf, setView, VIEWED, hiddenMenu, drags, named: () => reads.get(), hidden: () => oneEnd.get() };
G.listview.CSS = `
/* The kinds, the + and the ⋯ and the days are one run of words that wraps where it must: the + and the ⋯ follow the last kind
   on whichever line it stands, and the days close that line at its right end (the owner, 25 November 2026, of kinds wrapped one
   a line beside the + and the days: "I see a lot of problems with alignment of elements"). */
/* Two lines of a head stand two gaps apart, so the line under a chosen kind (one gap under its word) is nearer to its own
   letters than to the line of the head, or the first row, under it (the owner, 27 November 2026, of that line read as a line
   over the word below: "did you catch this underline issue?"). Measured on 0.5.17, where this head was chosen from: the line
   6 px under the foot of its own letters. */
.lk-list-head > .lk-list-name { flex-wrap: wrap; row-gap: calc(2 * var(--lk-mark-gap)); }
.lk-tabs { display: contents; }
.lk-list-name > .lk-tabs > * { margin-right: 24px; }
.lk-list-name > .lk-tabs > :last-child { margin-right: 0; }
.lk-head-do { flex: none; align-self: baseline; display: inline-flex; align-items: center; gap: 12px; height: 24px; margin-left: 8px; }   /* the + and the ⋯ follow the last word, on whichever line it stands */
.lk-tab { appearance: none; position: relative; border: 0; background: none; padding: 0; margin: 0; font: inherit; line-height: 1; color: var(--lk-quiet); cursor: pointer; white-space: nowrap; }
.lk-tab:hover, .lk-tab:focus-visible { color: var(--lk-text); outline: none; }
.lk-tab:not([data-kind=""]):not(.lk-tabmore):not(.lk-newtab):not([data-kind="@none"]) { font-family: var(--lk-tag-face); }   /* a kind is a tag: in the tag's face */
.lk-tab.on { color: var(--lk-text); }
.lk-tab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: calc(-1 * var(--lk-mark-gap)); height: 1px; background: currentColor; }   /* the chosen kind underlined across its word and count, a line under them, as before 0.9 (the owner's choice, 26 November 2026) */
.lk-tab .lk-n { margin-left: .25em; color: var(--lk-quiet); font-variant-numeric: tabular-nums; }
.lk-group-head .lk-n, .lk-since .lk-n { margin-left: .25em; font-size: var(--lk-small); font-weight: 400; color: var(--lk-off); font-variant-numeric: tabular-nums; }
.lk-tabmore { text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-newtab { font-size: var(--lk-small); }
.lk-today { font-size: var(--lk-small); color: var(--lk-quiet); white-space: nowrap; }
.lk-dots, .lk-set { appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer; color: var(--lk-quiet); }
.lk-dots { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: 2px; border-radius: 6px; opacity: .55; }
.lk-dots:hover, .lk-dots:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-head-end { flex: none; margin-left: auto; display: inline-flex; align-items: baseline; gap: 12px; padding-left: 12px; white-space: nowrap; line-height: 24px; }
.lk-head-end .lk-span { margin-left: 0; padding-left: 0; font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; }
.lk-head-end > * { line-height: 1; }
/* A strut at the start of the + and ⋯, and of the days: each is a line 24 high standing on the words' baseline, on whichever
   line of the head it falls (the gap after the strut is taken back). */
.lk-head-do::before, .lk-head-end::before { content: "\\200b"; width: 0; margin-right: -12px; }
/* A kind (in the tag's face) stands on a line of the words' face, so every line of the head is 24 high on one baseline. */
.lk-tab::before, .lk-head-do::before, .lk-head-end::before { font-family: var(--ls-font-family, inherit); font-size: var(--lk-line-size); font-weight: 400; line-height: 24px; }
.lk-tab::before { content: "\\200b"; }
/* Days that are not shown take no line: none to say, or a place too narrow for them. */
.lk-head-end:empty::before { content: none; }
@container lk-list (max-width: 300px) { .lk-head-end:not(:has(> :not(.lk-span)))::before { content: none; } }
.lk-set { font-size: var(--lk-small); }
.lk-set:hover, .lk-set:focus-visible { color: var(--lk-text); outline: none; }
.lk-group-head, .lk-since { display: flex; align-items: center; gap: var(--lk-mark-gap); min-height: var(--lk-line-h); margin: 6px 0 0 calc(var(--lk-daycol, 0px)); color: var(--lk-quiet); font-size: var(--lk-line-size); cursor: default; border-radius: 6px; }
.lk-group-head:first-child { margin-top: 0; }
.lk-group-head:focus-visible { outline: none; background: var(--lk-wash); }
.lk-group-head .lk-fold { opacity: 1; margin-top: 0; }
.lk-group-head[aria-expanded="false"] .lk-fold svg { transform: none; }
.lk-group-head .lk-fold svg { transform: rotate(90deg); }
.lk-group-name { font-weight: 500; color: var(--lk-text); }
.lk-since { margin-top: 10px; padding-left: 18px; gap: 4px; }
.lk-since::after { content: ""; flex: 1; height: 1px; margin-left: 8px; background: var(--lk-hair); }
.lk-row.lk-faint > .lk-line, .lk-row.lk-faint > .lk-day { opacity: .5; }
.lk-menu .lk-item-value { margin-left: auto; padding-left: 16px; color: var(--lk-quiet); font-size: var(--lk-small); white-space: nowrap; }
.lk-list[data-drop="into"] > .lk-list-head { background: var(--lk-lit); }
.lk-list[data-drop="above"] { box-shadow: 0 -2px 0 0 var(--lk-text); }
.lk-list[data-drop="below"] { box-shadow: 0 2px 0 0 var(--lk-text); }
.lk-list-via[draggable="true"] { cursor: grab; }
/* Where the place is not wide (the sidebar, a page beside an open sidebar) the days have a line of their own under the head's
   words, on the words' edge: never alone at the right end of a line of their own. */
@container lk-list (max-width: 420px) { .lk-head-end { flex: 0 0 100%; margin-left: 0; padding-left: 0; justify-content: flex-start; } .lk-head-end .lk-span { display: inline; } }
@container lk-list (max-width: 300px) { .lk-list-name > .lk-tabs > * { margin-right: 14px; } .lk-list-name > .lk-tabs > :last-child { margin-right: 0; } }`;
})();
