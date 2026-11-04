/* What a folded node holds, after its words, small and grey: a circle with the number of unfinished tasks at any depth;
   then its pictures, quotes, PDFs and other files, each an icon with its number; then the tags of what is inside, the
   most used first, up to three, with no number on them; then the nearest due day of a task, or "was due" once it has
   passed. A ↳ leads it (the owner, 2026-10-29, bringing back the arrow of the original before 0.4.466). Shown only while folded. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, onGraphChange, el, iconHtml, openPage } = Look.kit, { setting } = Look.settings;
const css = `
.lk-folded { display: inline-flex; align-items: baseline; gap: .25em; margin-left: .5em; font-size: .85em; color: var(--lk-quiet); white-space: nowrap; user-select: none; cursor: default; }
.lk-folded .lk-icon { font-size: .95em; align-self: center; }
/* An icon and its number are one pair; a wider gap between pairs than inside one. */
.lk-folded .lk-pair { display: inline-flex; align-items: baseline; gap: .15em; }
.lk-folded .lk-pair + .lk-pair { margin-left: .35em; }
/* A font keeps a quotation mark high in its line, so the drop is measured: the ink's middle on the number's. */
.lk-folded .lk-quote { display: inline-block; font: 1.4em/1 Georgia, "Times New Roman", serif; height: .7em; transform: translateY(.35em); }
.lk-folded .lk-sep { color: var(--lk-faint); margin: 0 .1em; }
.lk-folded a.lk-tag { cursor: pointer; }
.block-head-wrap > a.asset-ref + .lk-folded { margin-right: auto; align-self: center; flex: none; }
.ls-block:not([data-collapsed="true"]) > .block-main-container .lk-folded { display: none; }`;

// "due today", "was due Oct 12" once passed, else "due Oct 19".
function dueLabel(day, now = new Date()) {
  const date = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date - today) / 86400000);
  const word = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return days === 0 ? 'due today' : days < 0 ? 'was due ' + word : 'due ' + word;
}
const MOST = 3;
const shows = held => held && (held.task || held.files?.length || held.quotes || held.tags.length || held.due);
const fileCount = (held, kind) => (held.files || []).find(([k]) => k === kind)?.[1] || 0;
const some = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function wordsFor(held) {
  const words = [];
  if (held.task) words.push(`${some(held.task, 'unfinished task', 'unfinished tasks')} under it`);
  if (fileCount(held, 'image')) words.push(some(fileCount(held, 'image'), 'picture', 'pictures'));
  if (held.quotes) words.push(some(held.quotes, 'quote', 'quotes'));
  if (fileCount(held, 'pdf')) words.push(some(fileCount(held, 'pdf'), 'PDF', 'PDFs'));
  if (fileCount(held, 'file')) words.push(some(fileCount(held, 'file'), 'file', 'files'));
  words.push(...held.tags.slice(0, MOST));
  if (held.due) words.push(dueLabel(held.due));
  return words;
}
function build(doc, held) {
  const parts = [el(doc, 'span', { class: 'lk-lead', 'aria-hidden': 'true' }, '↳')];
  const pair = (name, n) => parts.push(el(doc, 'span', { class: 'lk-pair' }, el(doc, 'span', { html: iconHtml(name) }), el(doc, 'span', {}, String(n))));
  if (held.task) pair('circle', held.task);
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
  if (held.due) { if (parts.length > 1) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·')); parts.push(el(doc, 'span', {}, dueLabel(held.due))); }
  const keep = event => event.stopPropagation();
  const note = el(doc, 'span', { class: 'lk-folded lk-own', contenteditable: 'false', title: wordsFor(held).join(' · '), mousedown: keep, pointerdown: keep, click: onClick }, ...parts);
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
    const now = held.get(uuid), old = own(block, '.lk-folded'), key = JSON.stringify(now);
    if (!canPlace(block) || !shows(now)) { old?.remove(); continue; }
    if (old?.getAttribute('data-held') === key) continue;
    old?.remove();
    const note = build(doc, now);
    note.setAttribute('data-held', key);
    place(block, note);
  }
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
