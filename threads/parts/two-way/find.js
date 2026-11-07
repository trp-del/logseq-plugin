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

/* Find among what points here (0.4.436; the kit's field since 0.4.442, the count at its end; the owner, 2026-10-27: "there
   should be a way to search like properties … it does not appear everywhere and it seems very limited"): a field above
   the rows on every page that something points at. Typing keeps a whole row whose name holds what is typed, and in the
   others the nodes whose title or tag hold it, or one of their own properties, by its name or a value ("Findings",
   "adenocarcinoma"); a node found by a property says which under its line. The lists open in full. The nodes' values are
   read once, as the field is first used. Esc in the field empties it. */
const FIND_FROM = 20; // the find line stands only when there are enough rows to need it (the owner, 2026-10-31)
const allPointing = () => new Set(state.groups.flatMap(g => g.items.map(item => item.uuid))).size;
function findHtml() {
  const n = allPointing();
  if (n < FIND_FROM && !state.find) return '';
  const found = state.find ? foundGroups().reduce((sum, g) => sum + g.items.length, 0) : 0;
  return `<div class="th-tw-findrow">${shared.fieldHtml({ icon: 'find', value: state.find, placeholder: 'Find in what points here', count: state.find ? `${found} of ${n}` : n, inputCls: 'th-tw-find', label: 'Find in what points here' })}</div>`;
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
  const q = state.find.trim().toLowerCase();
  if (!q) return state.groups;
  return state.groups.map(g => {
    const whole = has(g.label, q) || has(g.name, q);
    const items = g.items.map(item => {
      // A property that holds the words opens the node even when its title holds them too ("chen" shows the Provider).
      const hit = propHit(item, q, g.name);
      return hit ? { ...item, hit } : whole || has(item.title, q) || has(item.tag, q) || has(twoWay.dayCell(item), q) ? item : null;
    }).filter(Boolean);
    return { ...g, items, found: true, total: g.items.length, whole };
  }).filter(g => g.items.length);
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
  const q = state.find.trim().toLowerCase();
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
  const q = state.find.trim().toLowerCase();
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
const findsLine = (prop, values) => { const q = state.find.trim().toLowerCase(); return !!q && (everyWord(q, [prop.title, ...values.map(v => v.day ? twoWay.dayText(v.day) : v.text)]) || has(prop.title, q) || values.some(v => has(v.day ? twoWay.dayText(v.day) : v.text, q))); };
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
  field.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (state.find) { state.find = ''; twoWay.draw(host()); } else field.blur(); } });
  for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
}

Object.assign(twoWay, { closeQuietly, findHtml, findsLine, foundGroups, has, highlightFind, keepFind, openHits, steadyWidth });
})();
