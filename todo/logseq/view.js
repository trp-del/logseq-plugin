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
.td-side { padding: 0 2px; }   /* the section ends at its last group: the sidebar parts one section from the next */
.td-side .td-list > .td-group:last-child { margin-bottom: 8px; }
.td-title { margin: 0 0 28px; }
.td-add { margin: 0 0 32px; padding: 6px 0; }   /* the library's field (lk-field): its hairline and its firmer line with the keyboard */
.td-add .td-plus { color: var(--lk-quiet); flex: none; }
.td-add .td-plus::before { margin-right: 0; }
.td-add input { padding: 2px 0; }
.td-when { flex: none; white-space: nowrap; }   /* the library's quiet line (lk-note) */
.td-side .td-add { margin-bottom: 24px; }
/* Find a todo, under the add line: the library's field (lk-field), Logseq's search glass where the add line has its +. */
.td .td-add { margin-bottom: 6px; }
.td-find { margin: 0 0 32px; padding: 6px 0; }
.td-side .td-find { margin-bottom: 24px; }
.td-find .td-glass { color: var(--lk-quiet); flex: none; display: inline-flex; }
.td-find input { padding: 2px 0; }
.td-body { position: relative; }
.td-tools { position: absolute; top: -2px; right: -4px; z-index: 1; display: flex; gap: 8px; }   /* Show and the grouping, the library's words with their chevrons (lk-change), on the first heading's line at the right */
.td-show.td-narrow { color: var(--lk-text, currentColor) !important; }   /* a list narrowed by Show says so in the words' colour: what is left out must not pass unseen */
.td-group { margin: 0 0 28px; }
.td-list > .td-group:first-child > .td-head { padding-right: var(--td-tools-room, 200px); }   /* room for the two words on its line */
.td-sub { margin: 0 0 14px; }   /* a group inside a group (Then by) */
.td-sub:last-child { margin-bottom: 0; }
.td-sub > .td-head { margin: 10px 0 2px; }
.td-nested > .td-head { color: var(--lk-text, currentColor) !important; font-weight: 600 !important; }   /* a group that holds groups: its name in weight, the groups inside in the faint name */
/* A group's name is told as every list's is (B of table-sidebar-look.html, 18 November 2026): a bold word at the rows' size, as Links' groups and a table's. A group inside a group keeps the faint name. */
.td-list > .td-group > .td-head { font-size: 14px !important; font-weight: 600 !important; color: var(--lk-text, currentColor) !important; }
.td-side .td-words { font-size: 14px; }   /* the sidebar's rows are 14 px, as Ontology's, Links' and the table's; the Todo page keeps its larger size */
.td-head { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; }   /* the library's small faint name (lk-name), as Find's group heads */
.td-head.td-fold-head { cursor: pointer; margin-left: -22px; }
.td-side .td-head.td-fold-head { margin-left: -4px; }
.td-head .lk-fold { opacity: .6; }
/* The fold arrow of a task that opens in place: in the margin before its circle, on the first line's middle. The library shows it (a row's lk-fold: under the pointer, and while open), as Logseq shows its own. */
.td-row > .td-open { position: absolute; left: -12px; top: 9px; }
.td-node { margin: 0 0 6px -44px; }
/* A task's bullet before its circle, as a task stands on a page (the owner, 20 November 2026: "the todos can have the bullets in fron just like it would normally"): the library's, on the first line's middle. */
.td-bul { display: inline-flex; align-items: center; height: var(--lk-status-line); margin-right: -4px; }
.td-row { position: relative; --lk-status-line: 1.45em; display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; column-gap: var(--td-gap); align-items: start; padding: 7px 8px; margin: 0 -8px; border-radius: 6px; }
.td-words { color: inherit; text-decoration: none; cursor: pointer; overflow-wrap: anywhere; line-height: var(--lk-status-line); }
.td-where { display: block; width: fit-content; max-width: 100%; text-decoration: none; cursor: pointer; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.45; }   /* the library's quiet line (lk-note); a line tall enough that a cut name keeps its g and y (the owner's list, 18 November 2026: "Mortgage" lost its g) */
.td-day { white-space: nowrap; padding-top: .2em; }   /* the library's day (lk-day), at the row's right */
.td-day.td-late { color: color-mix(in srgb, var(--rx-red-10, #dc3e42) 78%, var(--lk-paper, transparent)) !important; }
.td-row.td-ticked .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
.td-done .td-words { text-decoration: line-through; text-decoration-color: var(--lk-line); color: var(--lk-quiet); }
/* code and ==marked== words: Logseq's own look (its :not(pre) > code and mark rules reach these rows), the same in both themes. */
.td-words .td-ref { cursor: pointer; }
.td-row.td-ticked .td-words .lk-tag, .td-done .td-words .lk-tag { text-decoration: line-through; }
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

/* The task's words as Logseq shows them (the owner, 18 November 2026: "todo doesn't show md syntax … correctly"), read by the
   plugin's one reader (DbExport.inline, as Find and Threads draw a block's words): **bold**, *italic*, ~~struck~~, ==marked==,
   `code` and line breaks drawn as such; a link as its page's name in the library's link look (lk-node), a press on it opening that
   page (with Shift, in the sidebar); a tag as #Name in the tag look; a web address, bare or as [words](address), a link out with
   ↗ after it (Door.urlHtml; a press opens the browser, main.js); $math$ as its letters, an image as its words. A press anywhere
   else on the words opens the task. Without the reader (the tests), the words plain with their web addresses. */
function wordsHtml(t) {
  const inline = window.DbExport?.inline, text = t.text ?? t.words;
  if (!inline) return Door.webParts(t.words).map(p => p.url ? Door.urlHtml(p.url, esc(p.text)) : esc(p.text)).join('');
  const page = (name, inner, cls) => { const to = t.links?.get(name.toLowerCase()) || name; return `<span class="${cls}" data-open-page="${esc(to)}" title="Open ${esc(name)}; with Shift, in the sidebar">${inner}</span>`; };
  // inLink: inside a block reference, whose words are one link; a link or tag there reads as its words.
  const go = (list, inLink = false) => list.map(tok => {
    const kids = () => go(tok.k, inLink);
    switch (tok.t) {
      case 'text': return esc(tok.s);
      case 'br': return '<br>';
      case 'code': return `<code class="td-code">${esc(tok.s)}</code>`;
      case 'strong': return `<strong>${kids()}</strong>`;
      case 'em': return `<em>${kids()}</em>`;
      case 'strike': return `<s>${kids()}</s>`;
      case 'mark': return `<mark class="td-mark">${kids()}</mark>`;
      case 'math': return esc(tok.s);
      case 'link': return inLink ? kids() : Door.urlHtml(tok.url, kids());
      case 'page': {
        if (inLink) return tok.k ? kids() : esc(tok.name);
        // A block reference (db.js): the block's own words with their marks, as one link opening the block.
        const ref = /^\uE000(\d+)\uE001$/.exec(tok.name), r = ref && t.refs?.[ref[1]];
        if (r) return `<span class="lk-node td-ref" data-open-page="${esc(r.uuid)}" title="Open the block; with Shift, in the sidebar">${go(inline.parse(r.text), true)}</span>`;
        return page(tok.name, tok.k ? kids() : esc(tok.name), 'lk-node td-ref');
      }
      case 'tag': return inLink ? esc('#' + tok.name) : page(tok.name, esc('#' + tok.name), 'lk-tag td-ref');
      case 'cite': return `(${kids()}${tok.page ? `, p. ${esc(tok.page)}` : ''})`;
      case 'image': return esc(tok.alt || '');
      default: return '';
    }
  }).join('');
  return go(inline.parse(text)).replace(/ +(<br>)/g, '$1');
}
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
/* The status list under the circle: Logseq's own Set Status list (PluginDoor.pickStatus), every status in the graph in Logseq's
   order, each with its own icon, the one in force ticked (none for a Task whose Status is empty). Up and Down walk it, Return takes one. */
function openStatus(from, uuid) {
  const t = T.app.tasks.find(x => x.uuid === uuid);
  if (!t) return;
  const now = T.app.ticking.has(uuid) ? 'done' : t.empty && !T.app.status.has(uuid) ? '' : T.app.shown(t);
  // The icons in the words' colour, as Logseq's own Set Status list draws them (on a bullet Logseq colours In Review and Canceled).
  // Logseq's own Set Status list, the one every circle opens (PluginDoor.pickStatus).
  Door.pickStatus(from, [...T.db.statuses.values()], s => s.name === now).then(s => { if (s) T.app.setTo(uuid, s.name); });
}

/* A task opens in place as Relations' opened node (20 November 2026; the owner, of the pictured proposal: "good I like all"): the fold
   arrow before its circle, Logseq's own, under the pointer; Right on its words opens it and Left closes it, as in Find and Relations.
   What opens is not Todo's drawing: an empty holder under the row, which Relations fills with the task's properties to change, its
   bullets to write in and what points at it. Without Relations there is no arrow. One task stands open at a time, on the page and in the sidebar alike. */
const openNodes = [];
const canOpen = () => { try { return !!Door.answers('relations:node'); } catch (error) { return false; } };
const toggleNode = (uuid, open = !openNodes.includes(uuid)) => {
  const at = openNodes.indexOf(uuid);
  if (open && at < 0) { openNodes.push(uuid); while (openNodes.length > 1) openNodes.shift(); } else if (!open && at >= 0) openNodes.splice(at, 1); else return;
  for (const v of T.app.views) v.draw();
};
// part: the group the row stands in (main.js, groups()); Done's rows have none.
function rowHtml(t, part) {
  const status = T.app.shown(t), done = status === 'done', late = !done && t.day && t.day < dates.today();
  const day = !part || (part.today && !late) ? '' : dayWords(t.day);
  const where = !part || part.where ? t.page.title || '' : '';
  const opened = canOpen() && openNodes.includes(t.uuid);
  const fold = canOpen() ? `<button type="button" class="td-open lk-fold" aria-expanded="${opened}" data-open-node="${esc(t.uuid)}" title="${opened ? 'Close' : 'Open here'}" tabindex="-1"></button>` : '';
  return `<div class="td-row lk-row lk-calm${T.app.ticking.has(t.uuid) ? ' td-ticked' : ''}${done ? ' td-done' : ''}${opened ? ' td-opened' : ''}" data-uuid="${esc(t.uuid)}">
${fold}<span class="td-bul" aria-hidden="true"><span class="lk-bul"></span></span>${circle(t, status)}
<div class="td-main"><div class="td-line"><a class="td-words" href="#" data-open="${esc(t.uuid)}" title="Open the task; with Shift, in the sidebar">${t.words || t.text ? wordsHtml(t) : 'Untitled'}</a></div>${where ? `<a class="td-where lk-note" href="#" data-open-page="${esc(t.page.uuid || t.page.title || where)}" title="Open ${esc(where)}; with Shift, in the sidebar">${esc(where)}</a>` : ''}</div>
<div class="td-day lk-day${late ? ' td-late' : ''}">${esc(day)}</div></div>${opened ? `<div class="td-node" data-th-node="${esc(t.uuid)}"></div>` : ''}`;
}

function listHtml(find = '') {
  const { parts, done } = T.app.groups(find);
  if (find && !parts.length && !done.length) return '<section class="td-group"><div class="lk-none">No task has these words.</div></section>';
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
<label class="td-find lk-field"><span class="td-glass" aria-hidden="true"></span><input type="text" placeholder="Find a todo" aria-label="Find a todo" spellcheck="false" autocomplete="off"></label>
<div class="td-body"><div class="td-tools"><button type="button" class="td-show lk-change" data-show aria-haspopup="menu" aria-expanded="false" title="Which tasks the list shows"><span class="td-show-word"></span><span class="lk-i-chevron" aria-hidden="true"></span></button><button type="button" class="td-by lk-change" data-by aria-haspopup="menu" aria-expanded="false" title="Group the list"><span class="td-by-word"></span><span class="lk-i-chevron" aria-hidden="true"></span></button></div><div class="td-list"></div></div>`;
  holder.appendChild(root);
  root.querySelector('.td-glass').innerHTML = Door.logseqIconHtml('search', { size: 16, doc });
  const finder = root.querySelector('.td-find input');
  const input = root.querySelector('.td-add input'), when = root.querySelector('.td-when'), list = root.querySelector('.td-list'), byWord = root.querySelector('.td-by-word');
  const tools = root.querySelector('.td-tools'), show = root.querySelector('.td-show'), showWord = root.querySelector('.td-show-word');
  let drawn = '';
  const view = {
    root, mode, find: '',
    draw() {
      // Not read yet: the add line alone; a read that failed says so in a plain line where the list stands.
      if (!T.app.read) { const said = T.app.failed ? `<div class="lk-none">The tasks could not be read: ${esc(T.app.failed)}.</div>` : ''; if (said !== drawn) { drawn = said; list.innerHTML = said; } return; }
      byWord.textContent = byWords();
      const sw = showWords();
      showWord.textContent = sw.words; show.classList.toggle('td-narrow', sw.narrow);
      root.style.setProperty('--td-tools-room', `${Math.ceil(tools.offsetWidth || 190) + 12}px`);
      const html = listHtml(view.find);
      if (html === drawn) return;
      // A field of an opened node being written in keeps its place: the list is drawn again once it is left.
      if (doc.activeElement?.matches?.('input, textarea') && list.contains(doc.activeElement) && doc.activeElement.closest('[data-th-node], .td-line')) { view.waits = true; return; }
      view.waits = false;
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
  // Find a todo: the list narrows as you type; Escape empties the field, a second Escape lets it go.
  finder.addEventListener('input', () => { view.find = finder.value; view.draw(); });
  finder.addEventListener('keydown', event => {
    event.stopPropagation();   // the field's keys are its own, never Logseq's
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); if (finder.value) { finder.value = ''; view.find = ''; view.draw(); } else finder.blur(); }
    else if (event.key === 'Enter') { event.preventDefault(); const first = list.querySelector('.td-row [data-open]'); if (first) T.app.open(first.dataset.open, event.shiftKey); }
  });
  input.addEventListener('keydown', event => {
    event.stopPropagation();   // the field's keys are its own, never Logseq's
    if (event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); const words = input.value.trim(); if (!words) return; input.value = ''; showDay(); T.app.add(words); }
    else if (event.key === 'Escape') { event.preventDefault(); if (input.value) { input.value = ''; showDay(); } else input.blur(); }
  });
  root.addEventListener('click', event => {
    if (event.target.closest('[data-th-node]')) return;   // an opened node's presses are Relations'
    const fold = event.target.closest('[data-open-node]');
    if (fold) { event.preventDefault(); toggleNode(fold.dataset.openNode); return; }
    const status = event.target.closest('[data-status-of]');
    if (status) { event.preventDefault(); openStatus(status, status.dataset.statusOf); return; }
    const page = event.target.closest('[data-open-page]');   // a link or tag in a task's words: its page, not the task
    if (page) { event.preventDefault(); const to = page.dataset.openPage; if (event.shiftKey) logseq.Editor.openInRightSidebar(to); else logseq.App.pushState('page', { name: to }); return; }
    const open = event.target.closest('[data-open]');
    if (open) { event.preventDefault(); T.app.open(open.dataset.open, event.shiftKey); return; }
    // A press just after a task's last word puts the caret in its words (the owner, 19 November 2026: "just like a md link"); on the words it opens the task.
    const line = event.target.closest('a, button, input, textarea') ? null : event.target.closest('.td-line');
    const words = line ? line.querySelector('.td-words') : null, of = line ? line.closest('.td-row')?.dataset.uuid : '';
    if (words && of && Door.answers('relations:editWords')) { event.preventDefault(); Door.ask('relations:editWords', of, words).catch(() => {}); return; }
    if (event.target.closest('[data-fold-done]')) { event.preventDefault(); T.app.foldDone(); return; }
    const by = event.target.closest('[data-by]');
    if (by) { event.preventDefault(); openBy(by); return; }
    const shown = event.target.closest('[data-show]');
    if (shown) { event.preventDefault(); openShow(shown); }
  });
  // Right on a task's words opens it in place, Left closes it, as on a row in Find and Relations.
  root.addEventListener('keydown', event => {
    if (event.target.closest?.('[data-th-node]') || !canOpen() || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const words = (event.key === 'ArrowRight' || event.key === 'ArrowLeft') && event.target.closest?.('.td-words');
    const uuid = words && words.closest('.td-row')?.dataset.uuid;
    if (!uuid) return;
    event.preventDefault(); event.stopPropagation();
    toggleNode(uuid, event.key === 'ArrowRight');
    [...root.querySelectorAll('.td-row')].find(r => r.dataset.uuid === uuid)?.querySelector('.td-words')?.focus({ preventScroll: true });
  });
  root.addEventListener('focusout', () => setTimeout(() => { if (view.waits) view.draw(); }, 60));
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
    if (event.target.closest('[data-th-node]')) return;   // an opened node's right-click is Relations'
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
  // The node's menu, the same in every place (PluginDoor.nodeMenu: Open, Open in sidebar, Go to the page, Set status, Add tag,
  // Delete), with a task's Priority and Deadline added here.
  const lines = [];
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
  Door.nodeMenu(from, uuid, { open: sidebar => T.app.open(uuid, sidebar), extra: lines });
}
T.view = { make, ensureStyle, dayWords, dayFull, rowMenu };
})();
