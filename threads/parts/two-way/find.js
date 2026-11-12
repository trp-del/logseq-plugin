/* Find among what points here: the find line, the nodes it narrows to, the ones a property found opens, the words lit.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host } = shared;
const { state, warnOnce } = twoWay;

/* Find among what points here (the kit's field, the count at its end; the owner, 2026-10-27: "there
   should be a way to search like properties … it does not appear everywhere and it seems very limited"): a field above
   the rows on every page that something points at. Typing keeps a whole row whose name holds what is typed, and in the
   others the nodes whose title or tag hold it, or one of their own properties, by its name or a value ("Findings",
   "adenocarcinoma"); a node found by a property says which under its line. The lists open in full. The nodes' values are
   read once, as the field is first used. Esc in the field empties it. */
const FIND_FROM = 20; // the find line stands only when there are enough rows to need it (the owner, 2026-10-31)
const allPointing = () => new Set(state.groups.flatMap(g => g.items.map(item => item.uuid))).size;
function findHtml() {
  const n = allPointing();
  if (n < FIND_FROM && !state.find && !state.findShown) return '';
  const read = readFind(), found = state.find ? foundGroups().reduce((sum, g) => sum + g.items.length, 0) : 0;
  // The count says what the words did: the nodes found of all; on a day, up to it; a page named that is not there.
  const other = read.beside ? twoWay.besidePage?.() : null;
  const count = twoWay.askCount?.() || (!state.find ? n : read.beside && !other ? `no page “${read.beside}”` : other ? `beside ${other.title}` : read.asOf && !read.q ? `${found} of ${n} up to ${twoWay.dayText(read.asOf)}` : `${found} of ${n}`);
  // On a day: a week back, a week on, and Today, so the day can be walked without typing it again (C15, 7 November 2026).
  const steps = read.asOf ? `<div class="th-tw-daysteps lk-strip"><button type="button" class="lk-btn lk-low" data-daystep="-7" title="The page a week earlier">‹ a week earlier</button><button type="button" class="lk-btn lk-low" data-daystep="7" title="The page a week later">a week later ›</button><button type="button" class="lk-btn lk-low" data-daystep="0" title="Back to today's whole page">Today</button></div>` : '';
  return `<div class="th-tw-findrow">${shared.fieldHtml({ icon: 'find', value: state.find, placeholder: 'Find in these', count, inputCls: 'th-tw-find', label: 'Find in what points here' })}${steps}</div>`;
}
/* The find line's words read (7 November 2026): "and Dr. Helen Brooks" names a page to stand beside this one (parts/two-way/beside.js);
   "on Oct 7", "up to 7 Oct", "until 2026-10-07" turn the page back to that day, the later nodes faint; whatever is left
   finds as before. A day with no year is this year's, or last year's when this year's is still to come. */
const MONTHS = window.PluginDoor.dates.MONTHS.map(name => name.slice(0, 3).toLowerCase());   // the door's month names (plugin.js), as they are typed
const readCache = { text: null, read: null };
function readFind() {
  if (readCache.text === state.find) return readCache.read;
  let text = String(state.find || '').trim(), beside = '', asOf = 0;
  const and = text.match(/(?:^|\s)and\s+(\S.*)$/i);
  if (and) { beside = and[1].trim(); text = text.slice(0, and.index).trim(); }
  const on = text.match(/(?:^|\s)(?:on|up to|until|before)\s+(\d{4}-\d{1,2}-\d{1,2}|(?:\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\.?\s+\d{1,2})(?:,?\s+\d{4})?)\s*$/i);
  if (on) { asOf = dayOf(on[1]); if (asOf) text = text.slice(0, on.index).trim(); }
  // A question ("? when did the dose change") is asked of the matcher (parts/two-way/more.js), not found as letters.
  if (text.startsWith('?')) text = '';
  return (readCache.text = state.find, readCache.read = { q: text.toLowerCase(), beside, asOf });
}
const DAY_WORDS = /\s*(?:^|\s)(?:on|up to|until|before)\s+(?:\d{4}-\d{1,2}-\d{1,2}|(?:\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\.?\s+\d{1,2})(?:,?\s+\d{4})?)(?=\s+and\s+|\s*$)/i;
// A week back or on from the day in force, written into the find line; 0 takes the day away.
function stepDay(by) {
  const { asOf } = readFind();
  if (!asOf) return;
  if (!by) state.find = String(state.find).replace(DAY_WORDS, '').trim();
  else {
    const d = new Date(Math.floor(asOf / 10000), Math.floor(asOf / 100) % 100 - 1, asOf % 100 + by);
    const label = window.PluginDoor.dates.words(window.PluginDoor.dates.number(d));   // a day in words by the door's one rule
    state.find = String(state.find).replace(DAY_WORDS, ` on ${label}`).trim();
  }
  state.html = null; twoWay.draw(host());
}
twoWay.clickHooks.push(event => {
  const b = event.target.closest?.('[data-daystep]');
  if (!b) return false;
  event.preventDefault(); event.stopPropagation();
  stepDay(Number(b.dataset.daystep));
  return true;
});
function dayOf(words) {
  const today = twoWay.todayNumber(), thisYear = Math.floor(today / 10000);
  let y = 0, m = 0, d = 0;
  const iso = words.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else {
    const parts = words.replace(/[.,]/g, ' ').trim().split(/\s+/);
    const month = parts.findIndex(w => /^[a-z]/i.test(w)), day = parts.findIndex(w => /^\d{1,2}$/.test(w)), year = parts.findIndex(w => /^\d{4}$/.test(w));
    if (month < 0 || day < 0) return 0;
    m = MONTHS.indexOf(parts[month].slice(0, 3).toLowerCase()) + 1; d = Number(parts[day]); y = year >= 0 ? Number(parts[year]) : 0;
    if (!y) { y = thisYear; if (y * 10000 + m * 100 + d > today) y--; }
  }
  if (!m || m > 12 || !d || d > 31) return 0;
  return y * 10000 + m * 100 + d;
}
// What is typed matches at the start of a word ("4" finds a severity of 4, not "Oct 4"; "ct" no "Doctor").
const has = (text, q) => { const t = String(text ?? '').toLowerCase(); let at = t.indexOf(q); while (at > 0 && /[\p{L}\p{N}]/u.test(t[at - 1])) at = t.indexOf(q, at + 1); return at >= 0; };

// The first of a node's own properties whose name or a value holds what is typed; the row's own property (it names this
// page) is left out.
function propHit(item, q, row) {
  for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === row) continue;
    // The node's own day is in the margin already: found by its words only through the property's name.
    const texts = entry.values.filter(v => !(v.day && v.day === item.day)).map(v => v.day ? twoWay.dayText(v.day) : String(v.text ?? '')).filter(Boolean);
    if (has(name, q) || texts.some(t => has(t, q)) || everyWord(q, [name, ...texts])) return { name };
  }
  return null;
}
function foundGroups() {
  const { q, asOf } = readFind();
  if (!q && !asOf) return state.groups;
  return state.groups.map(g => {
    const whole = !!q && (has(g.label, q) || has(g.name, q));
    let items = !q ? g.items : g.items.map(item => {
      // A property that holds the words opens the node even when its title holds them too ("chen" shows the Provider).
      const hit = propHit(item, q, g.name);
      return hit ? { ...item, hit } : whole || has(item.title, q) || has(item.tag, q) || has(twoWay.dayCell(item), q) ? item : null;
    }).filter(Boolean);
    // On a day: the nodes up to it stay the list; the later ones go under it, faint (rowHtml). A node with no day stays.
    const since = asOf ? items.filter(item => item.day > asOf) : null;
    if (asOf) items = items.filter(item => !(item.day > asOf));
    return { ...g, items, since, found: true, total: g.items.length, whole };
  }).filter(g => g.items.length || g.since?.length);
}
/* A node found by one of its own properties opens as when dug (the owner, 2026-10-27: "it should show me the actual
   Provider properties as they are seen in the outline already developed"), its matching property's name in the text's
   weight; at most 20 open so, the rest found by their line alone. What the field opened closes again when the words no
   longer find it by a property or the field is emptied; one closed by its chevron stays closed while finding. */
const FIND_OPENS = 20;
// Several words ("severity 4"): each found at the start of a word somewhere in the line.
const everyWord = (q, texts) => { const words = q.split(/\s+/).filter(Boolean); return words.length > 1 && words.every(w => texts.some(t => has(t, w))); };
// Nodes found by a property open only from this many letters (a number at once), so the first letters narrow the list
// without opening and shutting whole blocks of it (the reviewer: 323 → 1183 → 209 px over "s", "se", "sep").
const OPEN_FROM = 3;
const opensNow = q => q.length >= OPEN_FROM || /^\d+$/.test(q);
function openHits(groups) {
  const want = new Map();
  const { q } = readFind();
  if (q && opensNow(q)) for (const g of groups) for (const item of g.items) if (item.hit && want.size < FIND_OPENS) want.set(`r:${g.name}>${item.uuid}`, item);
  // What the field opened closes when no longer found, "show the rest" too; one closed by its chevron is closed already.
  for (const k of [...state.findDug.keys()]) if (!want.has(k)) { closeQuietly(k); state.findDug.delete(k); }
  for (const [k, item] of want) {
    if (state.findDug.has(k) || state.dig.has(k)) continue;
    // Opened only once read, so it never shows open and empty while its lines arrive.
    // Each node is asked for once a page: one that cannot be read is never asked again on every drawing.
    if (!state.node.has(item.uuid)) { if (!state.findAsked.has(item.uuid)) { state.findAsked.add(item.uuid); twoWay.readNode(item.uuid, 0).then(() => { if (state.find.trim() && state.node.has(item.uuid)) { state.html = null; twoWay.draw(host()); } }).catch(error => warnOnce('could not read a node', error)); } continue; }
    state.findDug.set(k, true);
    state.dig.set(k, { uuid: item.uuid, id: 0, title: twoWay.shortName(item.title) });
  }
  return groups;
}
const closeQuietly = key => { for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k); };
/* The words found, lightly highlighted wherever they show in the section (the owner, 2026-10-27: "a very light highlight
   of things as well"): the browser's own highlights, so the text is not touched and nothing moves; Logseq's own subtle
   blue (the owner's word over the standing "no colour of the plugin's own"). The same start-of-word rule as the finding; at most 2000 text pieces looked at. */
function highlightFind(box) {
  const win = box?.ownerDocument?.defaultView, reg = win?.CSS?.highlights;
  if (!reg || !win.Highlight) return;
  const { q } = readFind();
  if (!q || !opensNow(q) || !box.isConnected) { reg.delete('th-find'); return; }
  const words = [...new Set([q, ...q.split(/\s+/)])].filter(Boolean);
  const doc = box.ownerDocument, ranges = [];
  const walk = doc.createTreeWalker(box, win.NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest('.th-tw-findrow, .th-tw-head, .th-ol-more') ? win.NodeFilter.FILTER_REJECT : win.NodeFilter.FILTER_ACCEPT });
  for (let n = walk.nextNode(), seen = 0; n && seen < 2000; n = walk.nextNode(), seen++) {
    const t = n.data.toLowerCase();
    for (const w of words) for (let at = t.indexOf(w); at >= 0; at = t.indexOf(w, at + w.length)) {
      if (at > 0 && /[\p{L}\p{N}]/u.test(t[at - 1])) continue;
      const r = doc.createRange(); r.setStart(n, at); r.setEnd(n, at + w.length); ranges.push(r);
    }
  }
  reg.set('th-find', new win.Highlight(...ranges));
}
/* While the section is on a page, the page's scroll bar keeps its room (frame by frame, 2026-10-27, the owner: "things
   shift left or right"): finding, opening or folding made the page short enough to lose its scroll bar, and the whole
   page moved 8 px sideways and back. Kept from the start for as long as Threads runs, on every page (6 November 2026: let go when the
   section went, a short page widened by 16 px two seconds after it opened). */
function steadyWidth(doc, on) {
  const pane = doc?.querySelector('#main-content-container');
  if (!pane) return;
  if (on) { if (pane.style.scrollbarGutter !== 'stable') pane.style.scrollbarGutter = 'stable'; }
  else if (pane.style.scrollbarGutter) pane.style.scrollbarGutter = '';
}
// While finding, a node's property line whose name or a value holds the words.
const findsLine = (prop, values) => { const { q } = readFind(); return !!q && (everyWord(q, [prop.title, ...values.map(v => v.day ? twoWay.dayText(v.day) : v.text)]) || has(prop.title, q) || values.some(v => has(v.day ? twoWay.dayText(v.day) : v.text, q))); };
// The values of every node pointing here, read once a page, the first time the field is used.
function readForFind() {
  if (state.findRead === state.pageUuid) return;
  state.findRead = state.pageUuid;
  twoWay.readValues(state.groups.flatMap(g => g.items.map(item => item.uuid))).then(() => { if (state.find.trim()) { state.html = null; twoWay.draw(host()); } }).catch(error => { state.findRead = ''; warnOnce('could not read the values to find in', error); });
}
function keepFind(box, caret) {
  const field = box.querySelector('.th-tw-find');
  if (!field) return;
  if (caret != null) { field.focus({ preventScroll: true }); field.setSelectionRange(caret, caret); }
  field.addEventListener('focus', readForFind);
  // While finding, the section keeps at least the height it had before the first letter, so a page scrolled down to it
  // keeps its place (the reviewer: the field dropped 43 to 190 px under the cursor when the rows got shorter than the
  // screen). Emptied, it lets go.
  field.addEventListener('input', () => { if (!state.find.trim()) state.findHold = box.getBoundingClientRect().height; state.find = field.value; readForFind(); twoWay.draw(host()); });
  /* The find line works as Find does (the owner, 9 and 12 November 2026): with letters in it, the first node they leave is
     lit; Enter opens its page (Shift Enter in the sidebar), Down goes to its name, where the keyboard walks the lists; Escape
     empties the line, then lets go of it. */
  const first = () => (state.find.trim() ? [...box.querySelectorAll('.th-tw-line a.th-tw-record')].find(a => a.offsetParent) || null : null);
  const lit = first()?.closest('.th-tw-line');
  if (lit) lit.classList.add('on');
  field.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (state.find) { state.find = ''; twoWay.draw(host()); } else field.blur(); }
    else if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) { const to = first(); if (to) { event.preventDefault(); shared.openEntity(to.dataset.uuid, event.shiftKey); } }
    else if (event.key === 'ArrowDown') { const to = first(); if (to) { event.preventDefault(); to.focus({ preventScroll: false }); } }
  });
  for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
}

// The find line called up where it does not stand by itself (fewer than twenty rows): Logseq's command palette.
twoWay.starters.push(() => twoWay.provided.registerCommand?.('threads-find', 'Threads: find in Linked', () => {
  state.findShown = true; state.html = null; twoWay.draw(host());
  state.box?.querySelector('.th-tw-find')?.focus({ preventScroll: false });
}));

Object.assign(twoWay, { closeQuietly, findHtml, findsLine, foundGroups, has, highlightFind, keepFind, openHits, readFind, steadyWidth });
})();
