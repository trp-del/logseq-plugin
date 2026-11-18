/* Todo's one drawing, for both places it stands: the page of its own (#/todo, in the main view) and the Todo tab of the right
   sidebar. make(holder, mode) draws into what Logseq hands over; mode 'page' has the title, 'side' none and the sidebar's width.
   Every view draws from the one state in main.js (T.app), so a task ticked in one is ticked in the other at once. */
(function () {
const T = window.Todo;
const Door = window.PluginDoor;
const { esc, dates } = Door;

const CSS = `
.td { --td-gap: 12px; color: var(--lk-text, currentColor); }
.td-page { max-width: 720px; margin: 0 auto; padding: 8px 0 120px; }
.td-side { padding: 0 2px 40px; }
.td-title { margin: 0 0 28px; }
.td-add { margin: 0 0 32px; padding: 6px 0; }   /* the library's field (lk-field): its hairline and its firmer line with the keyboard */
.td-add .td-plus { color: var(--lk-quiet); flex: none; }
.td-add .td-plus::before { margin-right: 0; }
.td-add input { padding: 2px 0; }
.td-when { flex: none; white-space: nowrap; }   /* the library's quiet line (lk-note) */
.td-side .td-add { margin-bottom: 24px; }
.td-body { position: relative; }
.td-tools { position: absolute; top: -2px; right: -4px; z-index: 1; display: flex; gap: 8px; }   /* Show and the grouping, the library's words with their chevrons (lk-change), on the first heading's line at the right */
.td-show.td-narrow { color: var(--lk-text, currentColor) !important; }   /* a list narrowed by Show says so in the words' colour: what is left out must not pass unseen */
.td-group { margin: 0 0 28px; }
.td-list > .td-group:first-child > .td-head { padding-right: var(--td-tools-room, 200px); }   /* room for the two words on its line */
.td-sub { margin: 0 0 14px; }   /* a group inside a group (Then by) */
.td-sub:last-child { margin-bottom: 0; }
.td-sub > .td-head { margin: 10px 0 2px; }
.td-nested > .td-head { color: var(--lk-text, currentColor) !important; font-weight: 600 !important; }   /* a group that holds groups: its name in weight, the groups inside in the faint name */
.td-head { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; }   /* the library's small faint name (lk-name), as Find's group heads */
.td-head.td-fold-head { cursor: pointer; margin-left: -22px; }
.td-side .td-head.td-fold-head { margin-left: -4px; }
.td-head .lk-fold { opacity: .6; }
.td-row { --lk-status-line: 1.45em; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: var(--td-gap); align-items: start; padding: 7px 8px; margin: 0 -8px; border-radius: 6px; }
.td-words { color: inherit; text-decoration: none; cursor: pointer; overflow-wrap: anywhere; line-height: var(--lk-status-line); }
.td-where { margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* the library's quiet line (lk-note) */
.td-day { white-space: nowrap; padding-top: .2em; }   /* the library's day (lk-day), at the row's right */
.td-day.td-late { color: color-mix(in srgb, var(--rx-red-10, #dc3e42) 78%, var(--lk-paper, transparent)) !important; }
.td-row.td-ticked .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
.td-done .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
.td-done .td-where, .td-done .td-day { color: var(--lk-off) !important; }`;
const ensureStyle = doc => T.base.sheet('td-style', CSS, 'td-own', doc);

// A day as a row says it: Yesterday or the date when late, Tomorrow, the weekday within a week, else the date.
function dayWords(day, today = dates.today()) {
  if (!day) return '';
  const span = Math.round((dates.date(day) - dates.date(today)) / 86400000);
  if (span === 0) return 'Today';
  if (span === -1) return 'Yesterday';
  if (span === 1) return 'Tomorrow';
  if (span > 1 && span < 7) return dates.WEEKDAYS[dates.date(day).getDay()].slice(0, 3);
  return dates.words(day);
}
// The day the add line reads, said whole beside the field: "Friday, Nov 20".
const dayFull = day => `${dayWords(day) === 'Today' || dayWords(day) === 'Tomorrow' ? dayWords(day) : dates.WEEKDAYS[dates.date(day).getDay()]}, ${dates.words(day)}`;

const BY_WORDS = { Day: 'By day', Page: 'By page', Tag: 'By tag', Priority: 'By priority', Status: 'By status' };
// "By day", or with a second level "By day, then page".
const byWords = () => BY_WORDS[T.app.by()] + (T.app.then() ? `, then ${T.app.then().toLowerCase()}` : '');
// What Show lists: "All open", or the statuses shown when some are left out ("Todo, Doing"; "3 statuses" past two).
function showWords() {
  const open = T.app.openStatuses(), hidden = T.app.hidden(), shown = open.filter(s => !hidden.has(s.name));
  if (!open.length || shown.length === open.length) return { words: 'All open', narrow: false };
  return { words: shown.length <= 2 ? shown.map(s => s.title).join(', ') : `${shown.length} statuses`, narrow: true };
}

// The task's words; a web address in them is a link out with ↗ after it, as in Find, Threads and Logseq's own page (Door.webParts,
// urlHtml; 16 November 2026: features drawn the same everywhere). A press on it opens the browser, not the task (main.js).
const wordsHtml = words => Door.webParts(words).map(p => p.url ? Door.urlHtml(p.url, esc(p.text)) : esc(p.text)).join('');
/* A task's status circle, Logseq's own (PluginDoor.statusHtml): the icon each status has in the graph (the owner, 15 November 2026:
   "they should be circles just like the tasks", "follow whatever icons are chosen by the properties"); a task just ticked shows
   Done's at once. A press opens the status list (openStatus), as a press on Logseq's own circle does (the owner, 15 November
   2026: "I cannot select different statuses"). */
function circle(t, status) {
  const ticked = T.app.ticking.has(t.uuid), s = T.db.statuses.get(ticked ? 'done' : status);
  const name = s?.title || (ticked ? 'Done' : status);
  const attrs = ` data-status-of="${esc(t.uuid)}" title="${esc(name)}: click to set the status" aria-label="Status: ${esc(name)}, ${esc(t.words)}"`;
  return Door.statusHtml(s || { title: name, icon: null }, { cls: 'td-circle', attrs, doc: Door.host() });
}
/* The status list, the library's menu under the circle (PluginDoor.menu): every status in the graph, in Logseq's order, each with
   its own icon, the one in force checked (none for a Task whose Status is empty). Up and Down walk it, Return takes one. */
function openStatus(from, uuid) {
  const t = T.app.tasks.find(x => x.uuid === uuid);
  if (!t) return;
  const now = T.app.ticking.has(uuid) ? 'done' : t.empty && !T.app.status.has(uuid) ? '' : T.app.shown(t);
  // The icons in the words' colour, as Logseq's own Set Status list draws them (on a bullet Logseq colours In Review and Canceled).
  Door.menu(from, [{ group: 'Set Status' }, ...[...T.db.statuses.values()].map(s => ({ word: s.title, icon: Door.statusIconHtml(s.icon, from.ownerDocument), on: s.name === now, take: () => T.app.setTo(uuid, s.name) }))], { align: 'left' });
}

// part: the group the row stands in (main.js, groups()); Done's rows have none.
function rowHtml(t, part) {
  const status = T.app.shown(t), done = status === 'done', late = !done && t.day && t.day < dates.today();
  const day = !part || (part.today && !late) ? '' : dayWords(t.day);
  const where = !part || part.where ? t.page.title || '' : '';
  return `<div class="td-row lk-row${T.app.ticking.has(t.uuid) ? ' td-ticked' : ''}${done ? ' td-done' : ''}" data-uuid="${esc(t.uuid)}">
${circle(t, status)}
<div class="td-main"><div class="td-line"><a class="td-words" href="#" data-open="${esc(t.uuid)}" title="Open the task; with Shift, in the sidebar">${t.words ? wordsHtml(t.words) : 'Untitled'}</a></div>${where ? `<div class="td-where lk-note">${esc(where)}</div>` : ''}</div>
<div class="td-day lk-day${late ? ' td-late' : ''}">${esc(day)}</div></div>`;
}

function listHtml() {
  const { parts, done } = T.app.groups();
  const head = p => `<div class="td-head lk-name">${p.tag ? `<span class="lk-tag">${esc(p.head)}</span>` : esc(p.head)}</div>`;
  const rows = p => p.rows.length ? p.rows.map(t => rowHtml(t, p)).join('') : `<div class="lk-none">${esc(p.none || '')}</div>`;
  // A group with a second level holds its groups, each under its faint name; one without, its rows.
  const part = p => p.subs
    ? `<section class="td-group td-nested" data-group="${esc(p.key)}">${head(p)}${p.rows.length ? p.subs.map(q => `<section class="td-sub" data-group="${esc(q.key)}">${head(q)}${rows(q)}</section>`).join('') : rows(p)}</section>`
    : `<section class="td-group" data-group="${esc(p.key)}">${head(p)}${rows(p)}</section>`;
  const open = T.app.doneOpen;
  const doneHtml = done.length ? `<section class="td-group" data-group="done"><div class="td-head lk-name td-fold-head" data-fold-done><button type="button" class="lk-fold" aria-expanded="${open}" aria-label="${open ? 'Fold' : 'Unfold'} Done"></button><span>Done</span><span class="lk-note">${done.length}</span></div>${open ? `<div class="td-done-rows">${done.map(t => rowHtml(t, null)).join('')}</div>` : ''}</section>` : '';
  // A grouping other than Day with no open task: one nothing-here line where the groups stand.
  const groups = parts.length ? parts.map(part).join('') : '<section class="td-group"><div class="lk-none">Nothing to do.</div></section>';
  return groups + doneHtml;
}

function make(holder, mode) {
  const doc = holder.ownerDocument;
  ensureStyle(doc);
  const root = doc.createElement('div');
  root.className = `td td-own td-${mode}`;
  root.innerHTML = `${mode === 'page' ? '<h1 class="title page-title td-title">Todo</h1>' : ''}
<label class="td-add lk-field"><span class="lk-i-plus td-plus" aria-hidden="true"></span><input type="text" placeholder="Add a todo" aria-label="Add a todo" spellcheck="true"><span class="td-when lk-note"></span></label>
<div class="td-body"><div class="td-tools"><button type="button" class="td-show lk-change" data-show aria-haspopup="menu" aria-expanded="false" title="Which tasks the list shows"><span class="td-show-word"></span><span class="lk-i-chevron" aria-hidden="true"></span></button><button type="button" class="td-by lk-change" data-by aria-haspopup="menu" aria-expanded="false" title="Group the list"><span class="td-by-word"></span><span class="lk-i-chevron" aria-hidden="true"></span></button></div><div class="td-list"></div></div>`;
  holder.appendChild(root);
  const input = root.querySelector('input'), when = root.querySelector('.td-when'), list = root.querySelector('.td-list'), byWord = root.querySelector('.td-by-word');
  const tools = root.querySelector('.td-tools'), show = root.querySelector('.td-show'), showWord = root.querySelector('.td-show-word');
  let drawn = '';
  const view = {
    root, mode,
    draw() {
      // Not read yet: the add line alone; a read that failed says so in a plain line where the list stands.
      if (!T.app.read) { const said = T.app.failed ? `<div class="lk-none">The tasks could not be read: ${esc(T.app.failed)}.</div>` : ''; if (said !== drawn) { drawn = said; list.innerHTML = said; } return; }
      byWord.textContent = byWords();
      const sw = showWords();
      showWord.textContent = sw.words; show.classList.toggle('td-narrow', sw.narrow);
      root.style.setProperty('--td-tools-room', `${Math.ceil(tools.offsetWidth || 190) + 12}px`);
      const html = listHtml();
      if (html === drawn) return;
      // A row coming into an open Done, or Done opening, rolls out; nothing else moves.
      const before = new Set([...list.querySelectorAll('.td-row')].map(r => r.dataset.uuid + (r.classList.contains('td-done') ? ':d' : '')));
      const held = doc.activeElement?.closest?.('[data-status-of]')?.dataset.statusOf;   // the keys stay on a circle drawn again
      drawn = html; list.innerHTML = html;
      if (held) list.querySelector(`[data-status-of="${held}"]`)?.focus({ preventScroll: true });
      if (before.size) Door.unroll([...list.querySelectorAll('.td-done-rows .td-row')].filter(r => !before.has(r.dataset.uuid + ':d')));
      Door.undo.draw();
    },
    rows: uuid => [...list.querySelectorAll('.td-row')].filter(r => r.dataset.uuid === uuid),
    focus() { if (mode === 'page') input.focus({ preventScroll: true }); },
    destroy() { T.app.views.delete(view); root.remove(); },
  };
  // The day the words name, said beside the field before Return.
  const showDay = () => { const found = T.db.dayIn(input.value); when.textContent = found ? dayFull(found.day) : ''; };
  input.addEventListener('input', showDay);
  input.addEventListener('keydown', event => {
    event.stopPropagation();   // the field's keys are its own, never Logseq's
    if (event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); const words = input.value.trim(); if (!words) return; input.value = ''; showDay(); T.app.add(words); }
    else if (event.key === 'Escape') { event.preventDefault(); if (input.value) { input.value = ''; showDay(); } else input.blur(); }
  });
  root.addEventListener('click', event => {
    const status = event.target.closest('[data-status-of]');
    if (status) { event.preventDefault(); openStatus(status, status.dataset.statusOf); return; }
    const open = event.target.closest('[data-open]');
    if (open) { event.preventDefault(); T.app.open(open.dataset.open, event.shiftKey); return; }
    if (event.target.closest('[data-fold-done]')) { event.preventDefault(); T.app.foldDone(); return; }
    const by = event.target.closest('[data-by]');
    if (by) { event.preventDefault(); openBy(by); return; }
    const shown = event.target.closest('[data-show]');
    if (shown) { event.preventDefault(); openShow(shown); }
  });
  // From the keys: Shift-F10 (or a keyboard's menu key) on a task's words opens the same menu.
  root.addEventListener('keydown', event => {
    if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
    const row = event.target.closest?.('.td-row[data-uuid]');
    if (!row) return;
    event.preventDefault(); event.stopPropagation();
    rowMenu(row.querySelector('.td-words') || row, row.dataset.uuid, row.classList.contains('td-done'));
  });
  // A task right-clicked: its own menu (rowMenu), under its words.
  root.addEventListener('contextmenu', event => {
    const row = event.target.closest('.td-row[data-uuid]');
    if (!row) return;
    event.preventDefault(); event.stopPropagation();
    rowMenu(row.querySelector('.td-words') || row, row.dataset.uuid, row.classList.contains('td-done'));
  });
  T.app.views.add(view);
  view.draw();
  return view;
}
/* The grouping's menu, the library's (PluginDoor.menu): under "By day", its right edge on the word's. Group by: the first level;
   Then by: the second inside it, None for none, the first level's own choice faint. */
const BY_ICON = { Day: 'calendar', Page: 'file', Tag: 'hash', Priority: 'flag', Status: 'circle-dot' };
function openBy(from) {
  const now = T.app.by(), then = T.app.then() || 'None';
  // An icon before every menu line (0.4 line 3.3), Logseq's own as its menus draw them.
  const icon = v => `<i class="ti ti-${BY_ICON[v] || 'minus'}"></i>`;
  Door.menu(from, [{ group: 'Group by' }, ...T.db.GROUPINGS.map(v => ({ word: v, icon: icon(v), on: v === now, take: () => T.app.setBy(v) })),
    { group: 'Then by' }, ...['None', ...T.db.GROUPINGS].map(v => ({ word: v, icon: icon(v), on: v === then, off: v === now, take: () => T.app.setThen(v) }))]);
}
/* Show: which open statuses the list holds, each with its icon, ticked when shown; a line ticks and unticks in place and the
   menu stays open, so several can be chosen in one go (the owner, 18 November 2026: "show every task that isn't complete …
   with a filter to narrow it down"). Show all lists every one again. The last one shown stays. */
function openShow(from) {
  const hidden = T.app.hidden(), open = T.app.openStatuses();
  Door.menu(from, [{ group: 'Show' }, ...open.map(s => ({ word: s.title, icon: Door.statusIconHtml(s.icon, from.ownerDocument) || Door.logseqIconHtml('circle', { doc: from.ownerDocument }), on: !hidden.has(s.name), stay: true, take: () => T.app.toggleShow(s.name) })),
    ...(hidden.size ? [{ gap: true }, { word: 'Show all', icon: '<i class="ti ti-list-check"></i>', take: () => T.app.showAll() }] : [])]);
}
/* A task's own menu, right-clicked (the owner, 18 November 2026: "a right-click menu on tasks"): the library's menu under its
   words, each line an icon and a plain name. Open, Open in sidebar, Go to the page it is on; then for an open task its
   Priority (Logseq's values and icons, the one in force ticked) and its Deadline (Today, Tomorrow, Next week), each with a
   line to take it off when it has one. Each change offers the one Undo at the row. */
function rowMenu(from, uuid, isDone) {
  const t = T.app.tasks.find(x => x.uuid === uuid);
  if (!t) return;
  const doc = from.ownerDocument, ti = id => Door.logseqIconHtml(id, { doc });
  const lines = [
    { word: 'Open', icon: ti('arrow-right'), take: () => T.app.open(uuid, false) },
    { word: 'Open in sidebar', icon: ti('layout-sidebar-right'), take: () => T.app.open(uuid, true) },
    ...(t.page.uuid ? [{ word: `Go to ${t.page.title}`, icon: Door.signHtml('page'), take: () => logseq.App.pushState('page', { name: t.page.uuid }) }] : []),
  ];
  if (!isDone && T.app.shown(t) !== 'done') {
    const today = dates.today(), plus = n => { const d = dates.date(today); d.setDate(d.getDate() + n); return dates.number(d); };
    const monday = plus(((8 - dates.date(today).getDay()) % 7) || 7);
    lines.push({ group: 'Priority' }, ...T.db.priorities.map(p => ({ word: p.title, icon: Door.statusIconHtml(p.icon, doc) || ti('flag'), on: p.name === t.priority, take: () => T.app.setPriority(uuid, p.name) })),
      ...(t.priority ? [{ word: 'Remove priority', icon: ti('antenna-bars-off'), take: () => T.app.setPriority(uuid, '') }] : []),
      { group: 'Deadline' },
      { word: 'Today', icon: ti('calendar-event'), on: t.deadline === today, take: () => T.app.setDeadline(uuid, today) },
      { word: 'Tomorrow', icon: ti('calendar-plus'), on: t.deadline === plus(1), take: () => T.app.setDeadline(uuid, plus(1)) },
      { word: 'Next week', icon: ti('calendar-week'), on: t.deadline === monday, take: () => T.app.setDeadline(uuid, monday) },
      ...(t.deadline ? [{ word: 'Remove deadline', icon: ti('calendar-off'), take: () => T.app.setDeadline(uuid, 0) }] : []));
  }
  Door.menu(from, lines, { align: 'left' });
}
T.view = { make, ensureStyle, dayWords, dayFull, rowMenu };
})();
