/* NODE: how a list of what points at a node is shown, and what its head offers. The deciding is core/view.js; this draws it.
   A head names the list's kinds with their counts (All first, the one in force marked), "2 new" for nodes made since the page
   was last open, the + and one faint ⋯ that opens View: Group by, Date, Sort by, Pick nodes, Move up and Move down. A setting
   that is not the default is said quietly before the days. What is set is kept for the list's property on every page; the order
   of a page's lists is kept for that page.
     G.listview.state(uuid)                 what a place keeps for its lists while it stands
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
  } else kinds = `<span class="lk-said">${made.count} ${G.esc(made.of)}</span>`;
  if (made.fresh) kinds += tab('@new', `${made.fresh} new`, null, made.kind === '@new', ' lk-newtab');
  const dots = `<button type="button" class="lk-dots" title="View and more" aria-label="View and more">${icon('dots', 16)}</button>`;
  const said = made.said.length ? `<button type="button" class="lk-set" title="View">${G.esc(made.said.join(' · '))}</button>` : '';
  const upTo = state.view.find.upTo, days = upTo ? `up to ${D.short(upTo, today)} · ${made.total} today` : made.from ? `${D.short(made.from, today)} to ${D.short(made.to, today)}` : '';
  return `${made.picking ? `<input type="checkbox" class="lk-tick lk-tick-all" aria-label="Pick every node of the list">` : ''}<span class="lk-tabs">${kinds}<span class="lk-head-do">${plus}${dots}</span></span><span class="lk-head-end">${said}${days ? `<span class="lk-span">${G.esc(days)}</span>` : ''}</span>`;
}
// What stands under the head, in order: a group's line, a node's row, the line saying since when.
function items(state, list, made, few) {
  const out = [], row = (one, under = '', faint = false) => ({ type: 'row', key: under ? `${one.uuid}@${under}` : one.uuid, row: one, faint, picking: made.picking, picked: made.picked.has(one.uuid) });
  if (made.groups) {
    for (const group of made.groups) {
      const shut = G.node.folded.has(`${list.key}/${group.key}`);
      out.push({ type: 'group', key: `g:${group.key}`, group, shut });
      if (!shut) for (const one of group.rows) out.push(row(one, `g:${group.key}`));
    }
  } else {
    const all = made.finding || made.picking || state.view.all.has(list.key) || made.rows.length <= few + 2;
    for (const one of all ? made.rows : made.rows.slice(0, few)) out.push(row(one));
    out.hidden = all ? 0 : made.rows.length - few;
  }
  if (made.since.length) { out.push({ type: 'since', key: 'since', n: made.since.length, day: state.view.find.upTo }); for (const one of made.since) out.push(row(one, 'since', true)); }
  return out;
}
// A group's line or the since line, drawn into its element.
function paint(el, item, today) {
  const html = item.type === 'group'
    ? `<span class="lk-fold">${G.node.ARROW}</span><span class="${item.group.tag ? 'lk-tag' : 'lk-group-name'}">${G.esc(item.group.name)}</span><span class="lk-n">${item.group.rows.length}</span>`
    : `<span>since ${G.esc(D.short(item.day, today))}</span><span class="lk-n">${item.n}</span>`;
  el.className = item.type === 'group' ? 'lk-group-head' : 'lk-since';
  if (item.type === 'group') { el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-expanded', String(!item.shut)); el.dataset.group = item.group.key; }
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
}
// View: what a list goes by. One line per setting with its value beside it; a press opens its choices.
function menu(state, box, at) {
  const list = box.lkList, key = list.key, now = viewOf(key), offers = V.offers(list.rows), view = state.view;
  const set = change => { setView(key, change); state.redraw(); };
  const choose = (title, name, choices) => () => G.menu(at, [{ group: title }, ...choices.map(([value, word, face]) => ({ word, face, on: (now[name] || '') === value, take: () => set({ [name]: value }) }))]);
  const dateWord = value => !value ? 'Its own' : value === 'none' ? 'No date' : value === 'Journal' ? 'Day written' : value;
  const sortWord = { '': 'Day', changed: 'Last changed', name: 'Name', tag: 'Tag' };
  const keys = [...state.el.querySelectorAll(':scope > .lk-list')].map(one => one.dataset.key), at0 = keys.indexOf(key);
  const move = by => { orders.set({ ...orders.get(), [view.uuid]: V.moved(keys, key, by) }); state.again(); };
  const picking = view.picking.has(key);
  G.menu(at, [
    { group: 'View' },
    { word: 'Group by', value: now.group || 'None', take: choose('Group by', 'group', [['', 'None'], ...offers.groups.map(name => [name, name, name === 'Tag' || name === 'Month' ? '' : 'prop'])]) },
    { word: 'Date', value: dateWord(now.date || ''), take: choose('Date', 'date', [['', 'Its own date'], ...offers.dates.map(name => [name, name === 'Journal' ? 'The day it is written on' : name, name === 'Journal' ? '' : 'prop']), ['none', 'No date']]) },
    { word: 'Timeline', value: !now.timeline ? 'Hidden' : now.timeline === 'line' ? (now.tall ? 'Taller' : 'One line') : `By ${now.timeline}`, take: () => G.menu(at, [{ group: 'Timeline' },
      { word: 'Hidden', on: !now.timeline, take: () => { view.spans.delete(key); view.lanes.delete(key); view.lit.delete(key); set({ timeline: '' }); } }, { word: 'One line', on: now.timeline === 'line', take: () => { view.lanes.delete(key); set({ timeline: 'line' }); } },
      ...offers.groups.filter(name => name !== 'Tag' && name !== 'Month').map(name => ({ word: `By ${name}`, face: 'prop', on: now.timeline === name, take: () => { view.lanes.delete(key); set({ timeline: name }); } })),
      ...(now.timeline ? [{ gap: true }, { word: 'Taller', on: !!now.tall, take: () => set({ tall: now.tall ? '' : '1' }) }] : [])]) },
    { word: 'Sort by', value: sortWord[now.sort || ''], take: choose('Sort by', 'sort', [['', 'Day'], ...offers.sorts.map(name => [name, sortWord[name]])]) },
    ...(list.kind === 'property' ? [{ gap: true },
      { word: 'Reads back as…', value: list.name, take: () => {
        const title = list.prop.title, give = name => { const all = { ...reads.get() }; if (name && name !== G.reads.back(title)) all[title] = name; else delete all[title]; reads.set(all); state.again(); };
        G.menu(at, [{ group: `How ${title} reads on the pages it points to` }, { word: G.reads.back(title), value: 'by grammar', on: !reads.get()[title], take: () => give('') },
          ...(G.reads.back(title) === title ? [] : [{ word: title, value: 'its own name', on: reads.get()[title] === title, take: () => give(title) }])], { find: 'Or type how it reads', enter: give });
      } },
      { word: 'Hide where it points', icon: icon('eye-off'), take: () => { oneEnd.set([...new Set([...oneEnd.get(), list.prop.ident])]); state.again(); G.say(`${list.name} is no longer listed on the pages it points to. Right-click the word Relations to bring it back.`); } }] : []),
    { gap: true },
    { word: picking ? 'Stop picking' : 'Pick nodes', icon: icon('square-check'), take: () => { if (picking) { view.picking.delete(key); view.picked.delete(key); } else view.picking.add(key); state.redraw(); } },
    { gap: true },
    ...(at0 > 0 ? [{ word: 'Move up', icon: icon('arrow-up'), take: () => move(-1) }] : []),
    ...(at0 >= 0 && at0 < keys.length - 1 ? [{ word: 'Move down', icon: icon('arrow-down'), take: () => move(1) }] : []),
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
  if (event.type === 'contextmenu' && target.closest('.lk-list-head')) { event.preventDefault(); menu(state, box, { x: event.clientX, y: event.clientY, from: target.closest('.lk-list-head') }); return true; }
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
  if (group) { event.preventDefault(); G.node.folded.flip(`${key}/${group.dataset.group}`); state.redraw(); return true; }
  return false;
}
// The properties hidden where they point, to bring back: a list at the word Relations.
async function hiddenMenu(at, again) {
  const idents = oneEnd.get(), props = await G.read.properties();
  if (!idents.length) return false;
  G.menu(at, [{ group: 'Hidden where they point. A press shows one again' }, ...idents.map(ident => ({ word: props.get(ident)?.title || ident, face: 'prop', take: () => { oneEnd.set(oneEnd.get().filter(one => one !== ident)); again(); } }))]);
  return true;
}
G.listview = { state, order, shape, head, items, paint, act, menu, viewOf, setView, VIEWED, hiddenMenu, named: () => reads.get(), hidden: () => oneEnd.get() };
G.listview.CSS = `
.lk-tabs { display: flex; align-items: center; flex-wrap: wrap; gap: 0 16px; min-width: 0; flex: 0 1 auto; }
.lk-head-do { display: inline-flex; align-items: center; margin-left: -10px; }   /* the + and the ⋯ follow the last word, on whichever line it stands */
.lk-tab { appearance: none; position: relative; border: 0; background: none; padding: 0; margin: 0; font: inherit; color: var(--lk-quiet); cursor: pointer; white-space: nowrap; }
.lk-tab:hover, .lk-tab:focus-visible { color: var(--lk-text); outline: none; }
.lk-tab.on { color: var(--lk-text); font-weight: 500; }
.lk-tab.on::after { content: ""; position: absolute; left: 0; bottom: -3px; width: 14px; height: 1.5px; border-radius: 1px; background: currentColor; }
.lk-tab .lk-n, .lk-group-head .lk-n, .lk-since .lk-n { margin-left: .25em; font-size: var(--lk-small); font-weight: 400; color: var(--lk-off); font-variant-numeric: tabular-nums; }
.lk-tabmore, .lk-newtab { font-size: var(--lk-small); }
.lk-dots, .lk-set { appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer; color: var(--lk-quiet); }
.lk-dots { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: 2px; border-radius: 6px; opacity: .55; }
.lk-dots:hover, .lk-dots:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-head-end { margin-left: auto; display: inline-flex; align-items: baseline; gap: 12px; padding-left: 12px; white-space: nowrap; }
.lk-head-end .lk-span { margin-left: 0; padding-left: 0; }
.lk-set { font-size: var(--lk-small); }
.lk-set:hover, .lk-set:focus-visible { color: var(--lk-text); outline: none; }
.lk-group-head, .lk-since { display: flex; align-items: center; gap: 2px; min-height: var(--lk-line-h); margin: 6px 0 0 calc(var(--lk-daycol, 0px)); color: var(--lk-quiet); font-size: var(--lk-line-size); cursor: default; border-radius: 6px; }
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
@container lk-list (max-width: 300px) { .lk-head-end { flex: 0 0 100%; margin-left: 0; padding-left: 0; } }`;
})();
