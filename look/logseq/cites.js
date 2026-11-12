/* A citation in a bullet reads as its endnote: a raised number where "(MRI report, Oct 14, p. 3)" stands, on the page it belongs to. Under the pointer
   the number says its source; a press goes to the source, and a PDF opens at the page. Only the drawing changes: the graph keeps the words, and a bullet
   being edited, or shown away from its page (Threads, Linked references, Find, an embed, the sidebar), keeps them on screen too, since a number belongs to one page.

   The words are Logseq's text nodes either side of its link. A stylesheet cannot reach a text node, and wrapping one would take it from under Logseq, so
   the brackets and the page are taken out of those nodes in place and put back when the number goes; the link is hidden and the number stands after it. */
(function () {
const Look = window.Look;
const { el, style, host, watchScreen, listen, openPage } = Look.kit;
const setting = key => Look.settings.setting(key);

const REFS = '#main-content-container .ls-page-blocks .block-title-wrap > :is(.page-reference, a.external-link, i)';
const AFTER = /^(?:, p\. (\d+))?\)/;
const keyOf = (id, page) => `${String(id).toLowerCase()}|${page || ''}`;
// What a citation is to: a node by its uuid, a web address, plain words.
const idOf = ref => ref.matches('.page-reference') ? ref.querySelector('a[data-uuid]')?.getAttribute('data-uuid') : ref.matches('a') ? ref.getAttribute('href') : `words:${ref.textContent}`;
const state = { numbers: new Map(), drawn: new Map(), card: null };

// A link in brackets with an optional page after it, as /Cite writes it: what stands either side, or null.
function citedAt(ref) {
  const before = ref.previousSibling, after = ref.nextSibling;
  if (before?.nodeType !== 3 || after?.nodeType !== 3 || !before.nodeValue.endsWith('(')) return null;
  const closing = AFTER.exec(after.nodeValue);
  return closing && { before, after, page: closing[1] || '', length: closing[0].length };
}
function putBack(ref) {
  const drawn = state.drawn.get(ref);
  if (!drawn) return;
  state.drawn.delete(ref);
  if (drawn.before.nodeValue === drawn.beforeNow) drawn.before.nodeValue = drawn.beforeWas;
  if (drawn.after.nodeValue === drawn.afterNow) drawn.after.nodeValue = drawn.afterWas;
  drawn.number.remove();
  ref.removeAttribute('data-lk-cite');
}
function draw(doc) {
  const on = setting('citationNumbers');
  for (const [ref, drawn] of state.drawn) {
    if (!ref.isConnected) { state.drawn.delete(ref); continue; }
    const note = on && state.numbers.get(drawn.key);
    if (note) drawn.number.textContent = String(note.n); else putBack(ref);
  }
  if (!on || !state.numbers.size) return;
  for (const ref of doc.querySelectorAll(REFS)) {
    if (state.drawn.has(ref) || ref.closest('.embed-block')) continue;
    const cited = citedAt(ref), id = cited && idOf(ref);
    const key = id ? keyOf(id, cited.page) : '', note = state.numbers.get(key);
    if (!note) continue;
    const { before, after } = cited, beforeWas = before.nodeValue, afterWas = after.nodeValue;
    const beforeNow = beforeWas.replace(/\s*\($/, ''), afterNow = afterWas.slice(cited.length);
    before.nodeValue = beforeNow; after.nodeValue = afterNow;
    const number = el(doc, 'sup', { class: 'lk-cite-n lk-own', 'data-lk-key': key }, String(note.n));
    ref.setAttribute('data-lk-cite', '');
    ref.after(number);
    state.drawn.set(ref, { key, before, after, beforeWas, afterWas, beforeNow, afterNow, number });
  }
}
// notes: Endnotes' list for the page you are on, in order.
function setNotes(notes) {
  state.numbers = new Map(notes.map((note, i) => [keyOf(note.id, note.page), { ...note, n: i + 1 }]));
  draw(host());
}
function goTo(note, inSidebar) {
  if (note.url) return logseq.App.openExternalLink(note.url);
  if (!note.uuid) return;
  if (!note.pdf || inSidebar) return openPage(note.uuid, inSidebar);
  window.parent.logseq.api.open_pdf_viewer(note.uuid);
  if (note.page) window.Flow?.cite?.goToPage(note.page);
}
// From an endnote back to where it is cited, the first place on the page.
function showNumber(note) {
  host().querySelector(`.lk-cite-n[data-lk-key="${CSS.escape(keyOf(note.id, note.page))}"]`)?.scrollIntoView({ block: 'center' });
}

function hideCard() { state.card?.remove(); state.card = null; }
function onOver(event) {
  const number = event.target?.closest?.('.lk-cite-n');
  if (!number) return hideCard();
  const note = state.numbers.get(number.getAttribute('data-lk-key'));
  if (!note || state.card?.number === number) return;
  hideCard();
  const doc = number.ownerDocument, at = number.getBoundingClientRect();
  const card = el(doc, 'div', { class: 'lk-cite-card lk-pop lk-own' }, el(doc, 'div', {}, el(doc, 'span', { class: note.uuid || note.url ? 'lk-cite-source' : '' }, note.title), note.page ? `, p. ${note.page}` : null),
    note.pdf || note.url ? el(doc, 'div', { class: 'lk-cite-how' }, note.url ? 'A press opens the link' : note.page ? `A press opens the PDF at page ${note.page}` : 'A press opens the PDF') : null);
  card.number = number;
  doc.body.append(card);
  card.style.left = `${Math.min(at.left, doc.documentElement.clientWidth - card.offsetWidth - 12)}px`;
  card.style.top = `${at.bottom + 6}px`;
  state.card = card;
}
// The press is held back from Logseq, which would open the bullet to edit it.
function onPress(event) {
  const number = event.target?.closest?.('.lk-cite-n');
  if (!number) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.type !== 'click') return;
  const note = state.numbers.get(number.getAttribute('data-lk-key'));
  hideCard();
  if (note) goTo(note, event.shiftKey);
}

const css = `
[data-lk-cite] { display: none !important; }
.lk-cite-n { font-size: .68em; line-height: 0; vertical-align: .55em; padding: 0 1px; margin-left: 0; border-radius: 3px; color: var(--lk-quiet); font-variant-numeric: tabular-nums; cursor: pointer; }
.lk-cite-n:hover { background: var(--lk-wash); color: var(--lk-text, currentColor); }
.lk-cite-card { position: fixed; z-index: 40; max-width: 320px; padding: 8px 10px; pointer-events: none; }   /* the library's pop-up (lk-pop) */
.lk-cite-source { ${window.PluginDoor.LOOKS.link(false)} }
.lk-cite-how { color: var(--lk-quiet); font-size: var(--lk-small); margin-top: 2px; }`;

function start() {
  style('cite-numbers', css);
  watchScreen(draw);
  const win = host().defaultView;
  listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true);
  listen(win, 'pointerover', onOver, true);
}
function stop() {
  for (const ref of [...state.drawn.keys()]) putBack(ref);
  hideCard();
  state.numbers = new Map();
  style('cite-numbers', '');
}
Look.cites = { start, stop, setNotes, showNumber, goTo, citedAt };
})();
