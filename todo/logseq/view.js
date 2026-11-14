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
.td-add { margin: 0 0 32px; padding: 6px 0; border-bottom-color: var(--lk-hair); }
.td-add:focus-within { border-bottom-color: var(--lk-line); }
.td-add .td-plus { color: var(--lk-quiet); flex: none; }
.td-add .td-plus::before { margin-right: 0; }
.td-add input { padding: 2px 0; }
.td-when { flex: none; color: var(--lk-quiet); font-size: var(--lk-small); white-space: nowrap; }
.td-side .td-add { margin-bottom: 24px; }
.td-body { position: relative; }
.td-by { position: absolute; top: -2px; right: -4px; z-index: 1; }   /* the grouping, the library's word with its chevron (lk-change), on the first heading's line at the right */
.td-group { margin: 0 0 28px; }
.td-list > .td-group:first-child > .td-head { padding-right: 104px; }   /* room for the grouping word on its line */
.td-head { display: flex; align-items: center; gap: 6px; font-size: var(--lk-small); color: var(--lk-quiet); margin: 0 0 6px; }
.td-head.td-fold-head { cursor: pointer; margin-left: -22px; }
.td-side .td-head.td-fold-head { margin-left: -4px; }
.td-head .lk-fold { opacity: .6; }
.td-row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; column-gap: var(--td-gap); align-items: start; padding: 7px 8px; margin: 0 -8px; border-radius: 6px; }
.td-row .lk-tick { margin-top: .36em !important; }
.td-row .td-doing::after { content: ""; position: absolute; inset: 3px; border-radius: 1.5px; background: var(--lk-quiet); }
.td-words { color: inherit; text-decoration: none; cursor: pointer; overflow-wrap: anywhere; line-height: 1.45; }
.td-where { font-size: var(--lk-small); color: var(--lk-quiet); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-day { white-space: nowrap; padding-top: .2em; }   /* the library's day (lk-day), at the row's right */
.td-day.td-late { color: color-mix(in srgb, var(--rx-red-10, #dc3e42) 78%, var(--lk-paper, transparent)) !important; }
.td-row.td-ticked .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
.td-done .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
.td-done .td-where, .td-done .td-day { color: var(--lk-off) !important; }
.td-head .lk-tag { color: inherit; }
.td .lk-none { padding: 4px 0 0; }`;
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

// part: the group the row stands in (main.js, groups()); Done's rows have none.
function rowHtml(t, part) {
  const status = T.app.shown(t), done = status === 'done', late = !done && t.day && t.day < dates.today();
  const day = !part || (part.today && !late) ? '' : dayWords(t.day);
  const where = !part || part.where ? t.page.title || '' : '';
  return `<div class="td-row lk-row${T.app.ticking.has(t.uuid) ? ' td-ticked' : ''}${done ? ' td-done' : ''}" data-uuid="${esc(t.uuid)}">
<input type="checkbox" class="lk-tick${status === 'doing' ? ' td-doing' : ''}" data-tick="${esc(t.uuid)}"${done || T.app.ticking.has(t.uuid) ? ' checked' : ''} aria-label="${done ? 'Not done' : 'Done'}: ${esc(t.words)}" title="${status === 'doing' ? 'Doing' : done ? 'Done' : 'Todo'}">
<div class="td-main"><div class="td-line"><a class="td-words" href="#" data-open="${esc(t.uuid)}" title="Open the task; with Shift, in the sidebar">${esc(t.words || 'Untitled')}</a></div>${where ? `<div class="td-where">${esc(where)}</div>` : ''}</div>
<div class="td-day lk-day${late ? ' td-late' : ''}">${esc(day)}</div></div>`;
}

function listHtml() {
  const { parts, done } = T.app.groups();
  const head = p => `<div class="td-head">${p.tag ? `<span class="lk-tag">${esc(p.head)}</span>` : esc(p.head)}</div>`;
  const part = p => `<section class="td-group" data-group="${esc(p.key)}">${head(p)}${p.rows.length ? p.rows.map(t => rowHtml(t, p)).join('') : `<div class="lk-none">${esc(p.none || '')}</div>`}</section>`;
  const open = T.app.doneOpen;
  const doneHtml = done.length ? `<section class="td-group" data-group="done"><div class="td-head td-fold-head" data-fold-done><button type="button" class="lk-fold" aria-expanded="${open}" aria-label="${open ? 'Fold' : 'Unfold'} Done"></button><span>Done</span><span class="lk-note">${done.length}</span></div>${open ? `<div class="td-done-rows">${done.map(t => rowHtml(t, null)).join('')}</div>` : ''}</section>` : '';
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
<label class="td-add lk-field"><span class="lk-i-plus td-plus" aria-hidden="true"></span><input type="text" placeholder="Add a todo" aria-label="Add a todo" spellcheck="true"><span class="td-when"></span></label>
<div class="td-body"><button type="button" class="td-by lk-change" data-by aria-haspopup="menu" aria-expanded="false" title="Group the list"><span class="td-by-word"></span><span class="lk-i-chevron" aria-hidden="true"></span></button><div class="td-list"></div></div>`;
  holder.appendChild(root);
  const input = root.querySelector('input'), when = root.querySelector('.td-when'), list = root.querySelector('.td-list'), byWord = root.querySelector('.td-by-word');
  let drawn = '';
  const view = {
    root, mode,
    draw() {
      if (!T.app.read) return;
      byWord.textContent = BY_WORDS[T.app.by()];
      const html = listHtml();
      if (html === drawn) return;
      // A row coming into an open Done, or Done opening, rolls out; nothing else moves.
      const before = new Set([...list.querySelectorAll('.td-row')].map(r => r.dataset.uuid + (r.classList.contains('td-done') ? ':d' : '')));
      drawn = html; list.innerHTML = html;
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
    const open = event.target.closest('[data-open]');
    if (open) { event.preventDefault(); T.app.open(open.dataset.open, event.shiftKey); return; }
    if (event.target.closest('[data-fold-done]')) { event.preventDefault(); T.app.foldDone(); return; }
    const by = event.target.closest('[data-by]');
    if (by) { event.preventDefault(); openBy(by); }
  });
  root.addEventListener('change', event => {
    const tick = event.target.closest('[data-tick]');
    if (tick) T.app.tick(tick.dataset.tick);
  });
  T.app.views.add(view);
  view.draw();
  return view;
}
// The grouping's menu, the library's (PluginDoor.menu): under "By day", its right edge on the word's.
function openBy(from) {
  const now = T.app.by();
  Door.menu(from, [{ group: 'Group by' }, ...T.db.GROUPINGS.map(v => ({ word: v, on: v === now, take: () => T.app.setBy(v) }))]);
}
T.view = { make, ensureStyle, dayWords, dayFull };
})();
