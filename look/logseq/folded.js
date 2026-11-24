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
const MOST = 3, FACTS = 2;
const shows = held => held && (held.task || held.done || held.files?.length || held.quotes || held.tags.length || held.due || held.facts?.length || held.match);
const fileCount = (held, kind) => (held.files || []).find(([k]) => k === kind)?.[1] || 0;
const some = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cut = (text, max) => window.PluginDoor.short(text, max);
/* The note answers the place it is shown in (0.5, E; the owner, 22 November 2026: "More consider how the information on folded
   bullers can be more contextually aware"). place: { says: [words the place already says, a page's own name, a list's kind, what
   Find's sentence named], facts: true where the place shows the node's own properties itself (Logseq's bullet with its property
   lines), match: [the words a place found the node by] }. The four rules:
   1. nothing the place already says is said again (a tag or a value that is the page's own name, the list's kind, Find's words,
      a value the node's own words already hold);
   2. what waits comes first (the due day leads while a task under it is unfinished);
   3. the tag picks the facts: the node's own filled properties, in its tag's order, the first two, where the place does not show them;
   4. after Find, the line that matched: the first line under the node holding every word Find was given, in quotes, before the rest. */
const fitted = (held, place) => {
  if (!held) return held;   // nothing read under it
  const says = new Set((place?.says || []).map(w => String(w).trim().toLowerCase()).filter(Boolean));
  const said = text => says.has(String(text).trim().toLowerCase());
  const tags = held.tags.filter(t => !said(t));
  const shown = String(place?.words || '').toLowerCase();
  const typed = String(place?.typed || '').trim().toLowerCase();
  // A value is known when the place says it: a page title as Logseq draws it runs on into its tags, so a title holding the value counts.
  const known = value => { const v = String(value).trim().toLowerCase(); return said(v) || [...says].some(w => v.length > 2 && w.includes(v)) || shown.includes(v) || (typed.length > 2 && v.includes(typed)); };
  const facts = place?.facts ? [] : (held.facts || []).filter(f => !known(f.value)).slice(0, FACTS);
  const ws = (place?.match || []).map(w => String(w).trim().toLowerCase()).filter(Boolean);
  const match = ws.length ? (held.lines || []).find(line => { const t = line.toLowerCase(); return ws.every(w => t.includes(w)); }) || '' : '';
  return { ...held, tags, facts, match };
};
const waits = held => !!(held.due && held.task);
function wordsFor(held, place) {
  if (place) held = fitted(held, place);
  const words = [];
  if (waits(held)) words.push(dueLabel(held.due));
  if (held.match) words.push(`\u201C${cut(held.match, 40)}\u201D`);
  for (const f of held.facts || []) words.push(`${f.name} ${cut(f.value, 24)}`);
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
  const sep = () => { if (parts.length > 1) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·')); };
  // What waits comes first: the nearest due day, before the count of what is unfinished.
  if (waits(held)) parts.push(el(doc, 'span', { class: 'lk-due' }, dueLabel(held.due)));
  // The line Find's words were found in, then the node's own facts: plain words of the note, parted by a dot as tags are.
  if (held.match) { sep(); parts.push(el(doc, 'span', { title: held.match }, `\u201C${cut(held.match, 40)}\u201D`)); }
  for (const f of held.facts) { sep(); parts.push(el(doc, 'span', { title: `${f.name}: ${f.value}` }, cut(f.value, 24))); }
  if (held.match || held.facts.length) { const before = parts.length; sep(); if (!(held.task || held.done || held.files?.length || held.quotes || held.tags.length || held.due)) parts.length = before; }
  const pair = (name, n) => parts.push(el(doc, 'span', { class: 'lk-pair' }, el(doc, 'span', { html: iconHtml(name) }), el(doc, 'span', {}, String(n))));
  // A ticked circle once every one is done, else the open circle.
  if (held.done) pair(held.task ? 'circle' : 'circle-check', `${held.done}/${held.task + held.done}`);
  else if (held.task) pair('circle', held.task);
  if (fileCount(held, 'image')) pair('photo', fileCount(held, 'image'));
  // A quote is the same mark as a quote's bullet (style.js), not an icon.
  if (held.quotes) parts.push(el(doc, 'span', { class: 'lk-pair' }, el(doc, 'span', { class: 'lk-quote' }, '\u201C'), el(doc, 'span', {}, String(held.quotes))));
  if (fileCount(held, 'pdf')) pair('file-type-pdf', fileCount(held, 'pdf'));
  if (fileCount(held, 'file')) pair('file', fileCount(held, 'file'));
  // A dot before each tag (two tags are kept apart by a dot, as at the title row), unless it is the first thing after the ↳ or a dot stands before it.
  const lastIsSep = () => parts[parts.length - 1]?.classList?.contains('lk-sep');
  held.tags.slice(0, MOST).forEach(title => {
    if (!lastIsSep()) sep();
    parts.push(el(doc, 'a', { class: 'lk-tag', href: '#', 'data-tag': title }, title));
  });
  if (held.due && !waits(held)) { if (!lastIsSep()) sep(); parts.push(el(doc, 'span', {}, dueLabel(held.due))); }
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
  // The words the node is shown with, its row's day included: a value they already hold is not said again (Paid off the Amex Gold
  // card, Amex Gold; a Date of Oct 14 on a row whose day reads Oct 14).
  const wordsOf = holder => { if (!holder) return ''; const note = [...holder.querySelectorAll('.lk-folded')].map(n => n.textContent).join(''); return (holder.textContent || '').replace(note, '').replace(/\s+/g, ' ').trim(); };
  const list = v => String(v || '').split('|').filter(Boolean);
  const side = el.closest?.('.sidebar-item');
  const title = (side ? side.querySelector('.ls-page-title, .page-title, .sidebar-item-header') : el.ownerDocument.querySelector('#main-content-container .ls-page-title'))?.textContent || '';
  const pageSays = [title.split('\n')[0].replace(/^#\s*/, '').trim()];
  // Inside Find's window, what is typed on its line is said there too (a node opened in Find, its rows Relations' own).
  const typed = el.closest?.('dialog.fd')?.querySelector('.fd-input')?.value?.trim() || '';
  // A row of the plugin's lists: its mark (data-lk-held), with what the module wrote on it, else the page it is shown on.
  const mark = el.hasAttribute?.('data-lk-held') ? el : el.closest?.('[data-lk-says], [data-lk-match]');
  if (mark) return { says: mark.hasAttribute('data-lk-says') ? list(mark.getAttribute('data-lk-says')) : pageSays, match: list(mark.getAttribute('data-lk-match')), facts: mark.hasAttribute('data-lk-facts'), typed, words: wordsOf(mark.closest('.lk-row, .fd-r, .th-ol-line, .td-line') || mark.parentElement) };
  // Logseq's own bullet shows its own properties under its words while open; folded, it hides them, so the note says the first two.
  const block = el.closest?.('.ls-block[blockid]');
  const facts = !!(block && [...block.querySelectorAll('.ls-properties-area, .property-k')].some(p => p.closest('.ls-block[blockid]') === block));
  return { says: pageSays, facts, typed, words: block ? wordsOf(own(block, '.block-title-wrap') || own(block, '.block-content')) : '' };
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
    const now = held.get(uuid), old = own(block, '.lk-folded'), at = placeOf(block), key = (now ? now.seen : 0) + JSON.stringify(at);
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
    const now = held.get(uuid), at = placeOf(words), key = (now ? now.seen : 0) + JSON.stringify(at);
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
    for (const uuid of uuids) { const got = found.get(uuid) || null; if (got) got.seen = ++read.seq; held.set(uuid, got); fresh.add(uuid); asked.delete(uuid); }
    while (held.size > 2000) { const first = held.keys().next().value; held.delete(first); fresh.delete(first); }
    draw(host());
  } catch (error) { for (const uuid of uuids) { fresh.add(uuid); asked.delete(uuid); } console.error('Look: could not read what a folded node holds', error); }
}
read.pages = new Set();
read.seq = 0;   // each reading's number: a note is drawn again only when what it holds was read anew or its place changed
function clear(doc = host()) { for (const note of doc.querySelectorAll('.lk-folded')) note.remove(); }
function start() {
  stopped = false;
  style('folded', css);
  watchScreen(draw);
  // What a note counts sits on its node's page: a change on another page leaves every note true.
  onGraphChange((pages, written) => { if (stopped || !(pages || [...written].some(id => read.pages.has(id)))) return; fresh.clear(); draw(host()); });
}
function stop() { stopped = true; held.clear(); fresh.clear(); asked.clear(); read.pages.clear(); }
Look.folded = { start, stop, draw, dueLabel, wordsFor, build, fitted };
})();
