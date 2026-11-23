/* What a folded node holds, after its words, small and grey: a circle with the number of unfinished tasks at any depth, or,
   once some are done, done of all (1/2), the circle ticked when all are;
   then its pictures, quotes, PDFs and other files, each an icon with its number; then the tags of what is inside, the
   most used first, up to three, with no number on them; then the nearest due day of a task, or "was due" once it has
   passed. A ↳ leads it (the owner, 2026-10-29, bringing back the arrow of the original). Shown only while folded. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, onGraphChange, el, iconHtml, openPage } = Look.kit, { setting } = Look.settings;
const css = `
/* The line is the library's quiet note (lk-note: its grey, its size, regular weight under a heading's bold); here only its place. */
.lk-folded { display: inline-flex; align-items: baseline; gap: .25em; margin-left: .5em; white-space: nowrap; user-select: none; cursor: default; }
.lk-folded .lk-icon { align-self: center; }
/* An icon and its number are one pair; a wider gap between pairs than inside one. */
.lk-folded .lk-pair { display: inline-flex; align-items: baseline; gap: .15em; }
.lk-folded .lk-pair + .lk-pair { margin-left: .35em; }
/* A font keeps a quotation mark high in its line, so the drop is measured: the ink's middle on the number's. */
.lk-folded .lk-quote { display: inline-block; font: 1.4em/1 Georgia, "Times New Roman", serif; height: .7em; transform: translateY(.35em); }
.lk-folded .lk-sep { color: var(--lk-quiet); margin: 0 .1em; }
.lk-folded a.lk-tag { cursor: pointer; }
.block-head-wrap > a.asset-ref + .lk-folded { margin-right: auto; align-self: center; flex: none; }
.ls-block:not([data-collapsed="true"]) > .block-main-container .lk-folded { display: none; }`;

// "due today", "was due Oct 12" once passed, else "due Oct 19".
function dueLabel(day, now = new Date()) {
  const date = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date - today) / 86400000);
  const word = window.PluginDoor.dates.words(day, { year: false });   // the door's one rule for a day in words
  return days === 0 ? 'due today' : days < 0 ? 'was due ' + word : 'due ' + word;
}
const MOST = 3;
const shows = held => held && (held.task || held.done || held.files?.length || held.quotes || held.tags.length || held.due);
const fileCount = (held, kind) => (held.files || []).find(([k]) => k === kind)?.[1] || 0;
const some = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/* The note answers the place it is shown in (0.5, E; the owner, 22 November 2026: "More consider how the information on folded
   bullers can be more contextually aware"). place: { says: [words the place already says, a page's own name, a list's kind] }.
   Two rules are kept here: what waits comes first (the due day leads while a task under it is unfinished), and nothing the place
   already says is said again (a tag that is the page's own name, or the kind a list is headed by, is left out). */
const fitted = (held, place) => {
  const says = new Set((place?.says || []).map(w => String(w).trim().toLowerCase()).filter(Boolean));
  return says.size ? { ...held, tags: held.tags.filter(t => !says.has(String(t).toLowerCase())) } : held;
};
const waits = held => !!(held.due && held.task);
function wordsFor(held) {
  const words = [];
  if (waits(held)) words.push(dueLabel(held.due));
  // Done of all, "1/2" (the owner, 16 November 2026: "do a x/2"); with none done, the unfinished count alone, as before.
  if (held.done) words.push(`${held.done} of ${some(held.task + held.done, 'task', 'tasks')} under it done`);
  else if (held.task) words.push(`${some(held.task, 'unfinished task', 'unfinished tasks')} under it`);
  if (fileCount(held, 'image')) words.push(some(fileCount(held, 'image'), 'picture', 'pictures'));
  if (held.quotes) words.push(some(held.quotes, 'quote', 'quotes'));
  if (fileCount(held, 'pdf')) words.push(some(fileCount(held, 'pdf'), 'PDF', 'PDFs'));
  if (fileCount(held, 'file')) words.push(some(fileCount(held, 'file'), 'file', 'files'));
  words.push(...held.tags.slice(0, MOST));
  if (held.due && !waits(held)) words.push(dueLabel(held.due));
  return words;
}
function build(doc, held, place) {
  held = fitted(held, place);
  const parts = [el(doc, 'span', { class: 'lk-lead', 'aria-hidden': 'true' }, '↳')];
  // What waits comes first: the nearest due day, before the count of what is unfinished.
  if (waits(held)) parts.push(el(doc, 'span', { class: 'lk-due' }, dueLabel(held.due)));
  const pair = (name, n) => parts.push(el(doc, 'span', { class: 'lk-pair' }, el(doc, 'span', { html: iconHtml(name) }), el(doc, 'span', {}, String(n))));
  // A ticked circle once every one is done, else the open circle.
  if (held.done) pair(held.task ? 'circle' : 'circle-check', `${held.done}/${held.task + held.done}`);
  else if (held.task) pair('circle', held.task);
  if (fileCount(held, 'image')) pair('photo', fileCount(held, 'image'));
  // A quote is the same mark as a quote's bullet (style.js), not an icon.
  if (held.quotes) parts.push(el(doc, 'span', { class: 'lk-pair' }, el(doc, 'span', { class: 'lk-quote' }, '\u201C'), el(doc, 'span', {}, String(held.quotes))));
  if (fileCount(held, 'pdf')) pair('file-type-pdf', fileCount(held, 'pdf'));
  if (fileCount(held, 'file')) pair('file', fileCount(held, 'file'));
  // A dot before each tag (two tags are kept apart by a dot, as at the title row), unless it is the first thing after the ↳.
  held.tags.slice(0, MOST).forEach(title => {
    if (parts.length > 1) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·'));
    parts.push(el(doc, 'a', { class: 'lk-tag', href: '#', 'data-tag': title }, title));
  });
  if (held.due && !waits(held)) { if (parts.length > 1) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·')); parts.push(el(doc, 'span', {}, dueLabel(held.due))); }
  const keep = event => event.stopPropagation();
  const note = el(doc, 'span', { class: 'lk-folded lk-note lk-own', contenteditable: 'false', title: wordsFor(held).join(' · '), mousedown: keep, pointerdown: keep, click: onClick }, ...parts);
  return note;
}
async function onClick(event) {
  const a = event.target.closest('a[data-tag]');
  if (!a) return;
  event.preventDefault(); event.stopPropagation();
  const page = await Look.db.getPage(a.getAttribute('data-tag'));
  if (page?.uuid) openPage(String(page.uuid), event.shiftKey);
}
let held = new Map(), fresh = new Set(), asked = new Set(), stopped = false;
/* Where a folded bullet stands: what that place already says. A Logseq bullet: the name of the page it is shown on (the page in
   front, or the page of the sidebar item it stands in; a journal day says no tag). A row of the plugin's lists: what the module
   wrote on its mark (data-lk-says, words parted by |: the kind a list is headed by, the kind read in Find). */
function placeOf(el) {
  const mark = el.closest?.('[data-lk-says]');
  if (mark) return { says: String(mark.getAttribute('data-lk-says')).split('|') };
  const side = el.closest?.('.sidebar-item');
  const title = (side ? side.querySelector('.ls-page-title, .page-title, .sidebar-item-header') : el.ownerDocument.querySelector('#main-content-container .ls-page-title'))?.textContent || '';
  return { says: [title.split('\n')[0].replace(/^#\s*/, '').trim()] };
}
const shownIn = (now, place) => shows(fitted(now, place));
const own = (block, selector) => [...block.querySelectorAll(selector)].find(w => w.closest('.ls-block[blockid]') === block);
const place = (block, note) => { const wrap = own(block, '.block-title-wrap'); if (wrap) return wrap.append(note); own(block, '.block-head-wrap a.asset-ref')?.after(note); };
const canPlace = block => !!(own(block, '.block-title-wrap') || own(block, '.block-head-wrap a.asset-ref'));
function draw(doc) {
  if (stopped) return;
  if (!setting('foldedNote')) return clear(doc);
  const missing = [];
  for (const block of doc.querySelectorAll('.ls-block[blockid][data-collapsed="true"]')) {
    const uuid = block.getAttribute('blockid').toLowerCase();
    if (!fresh.has(uuid) && !asked.has(uuid)) missing.push(uuid);
    if (!held.has(uuid)) continue;
    const now = held.get(uuid), old = own(block, '.lk-folded'), at = placeOf(block), key = JSON.stringify([now, at.says]);
    if (!canPlace(block) || !shownIn(now, at)) { old?.remove(); continue; }
    if (old?.getAttribute('data-held') === key) continue;
    old?.remove();
    const note = build(doc, now, at);
    note.setAttribute('data-held', key);
    place(block, note);
  }
  /* The same line after a folded row's words in the plugin's own lists, Threads' Linked and Find (16 November 2026, the owner: the
     folded-heading line in "Linked and Find"): a module marks the words of a row whose node is folded with data-lk-held (its uuid),
     and the line follows them, read and drawn as for Logseq's own bullets. Shown while the row is folded: the mark goes when it opens. */
  for (const words of doc.querySelectorAll('[data-lk-held]')) {
    const uuid = String(words.getAttribute('data-lk-held')).toLowerCase(), old = words.nextElementSibling?.classList.contains('lk-folded') ? words.nextElementSibling : null;
    if (!fresh.has(uuid) && !asked.has(uuid) && !missing.includes(uuid)) missing.push(uuid);
    if (!held.has(uuid)) continue;
    const now = held.get(uuid), at = placeOf(words), key = JSON.stringify([now, at.says]);
    if (!shownIn(now, at)) { old?.remove(); continue; }
    if (old?.getAttribute('data-held') === key) continue;
    old?.remove();
    const note = build(doc, now, at);
    note.setAttribute('data-held', key);
    words.after(note);
  }
  // A line left behind by a row that opened, or whose mark went.
  for (const note of doc.querySelectorAll('.lk-folded')) { const before = note.previousElementSibling; if (before && !before.hasAttribute('data-lk-held') && !note.closest('.ls-block')) note.remove(); }
  if (missing.length) read(missing);
}
async function read(uuids) {
  for (const uuid of uuids) asked.add(uuid);
  try {
    const found = await Look.db.heldBelow(uuids);
    if (stopped) return;
    for (const page of found.pages || []) read.pages.add(page);
    for (const uuid of uuids) { held.set(uuid, found.get(uuid) || null); fresh.add(uuid); asked.delete(uuid); }
    while (held.size > 2000) { const first = held.keys().next().value; held.delete(first); fresh.delete(first); }
    draw(host());
  } catch (error) { for (const uuid of uuids) { fresh.add(uuid); asked.delete(uuid); } console.error('Look: could not read what a folded node holds', error); }
}
read.pages = new Set();
function clear(doc = host()) { for (const note of doc.querySelectorAll('.lk-folded')) note.remove(); }
function start() {
  stopped = false;
  style('folded', css);
  watchScreen(draw);
  // What a note counts sits on its node's page: a change on another page leaves every note true.
  onGraphChange((pages, written) => { if (stopped || !(pages || [...written].some(id => read.pages.has(id)))) return; fresh.clear(); draw(host()); });
}
function stop() { stopped = true; held.clear(); fresh.clear(); asked.clear(); read.pages.clear(); }
Look.folded = { start, stop, draw, dueLabel, wordsFor, build };
})();
