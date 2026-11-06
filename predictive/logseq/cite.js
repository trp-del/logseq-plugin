/* A citation: where a bullet came from, written in its words.

   /Cite, or Option-C as it comes (the setting "Keys for citing"), rolls a line out under the bullet. Typing finds among the pages and the PDFs; Enter takes one; last in the list stands what was typed, as a web
   address or as plain words. A PDF or plain words then ask for the page, and Enter with none leaves the page out. The bullet gets "([[the source]], p. 3)" and is left, with the faded arrow
   to take the citation off. Escape goes back one step. A press on a citation to a PDF opens the PDF at that page: Logseq opens
   it, and the page is then scrolled to. A link in the words is what Threads and Logseq's references already follow, so a
   citation is a road and needs nothing of its own in the graph. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db } = Flow;
const { host, notify, warnOnce } = app;
const P = Flow.proposeUi;

const MOST = 6;
const el = (doc, tag, attrs = {}, ...kids) => { const e = doc.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.append(...kids); return e; };
let open = null;   // { box, uuid, at, sources, found, on, source, line }
let stopped = true, registered = false;

/* What can be cited, best first: a name that starts with the words, then one with a word that does, then one that holds them;
   a PDF before a page, a short name before a long one. */
function finds(sources, typed) {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rank = lower => lower.startsWith(words[0]) ? 0 : new RegExp(`(^|[^\\p{L}\\p{N}])${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(lower) ? 1 : 2;
  return sources.filter(s => words.every(word => s.lower.includes(word)))
    .sort((a, b) => rank(a.lower) - rank(b.lower) || b.pdf - a.pdf || a.lower.length - b.lower.length || a.lower.localeCompare(b.lower)).slice(0, MOST);
}
/* What typed can be as it stands, offered last: a web address, or plain words such as "Smith 2023". */
function offer(typed, found) {
  const words = typed.trim();
  if (!words || found.some(source => source.lower === words.toLowerCase())) return null;
  if (/^(https?:\/\/|www\.)\S+$/i.test(words)) {
    const url = /^www\./i.test(words) ? `https://${words}` : words;
    return { web: true, url, title: url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '') };
  }
  return { words: true, title: words.replace(/\*/g, '') };
}
async function sourcesNow() {
  const [pages, pdfs] = await Promise.all([app.pages(), db.loadPdfs()]);
  return [...pdfs, ...pages.filter(page => !page.isTag).map(page => ({ uuid: page.uuid, title: page.title, lower: page.lower, pdf: false }))];
}

// The line rolls back up into the bullet before it goes, as it rolled out (window.PluginDoor, the grammar: what opens rolls out).
function close() { const line = open?.line; open = null; if (line) window.PluginDoor.rollUp(line).then(() => line.remove()); }
function drawFound() {
  const { line, found, on } = open, doc = line.ownerDocument;
  line.querySelector('.flow-cite-found').replaceChildren(...found.map((source, i) =>
    el(doc, 'div', { class: 'flow-cite-row lk-item' + (i === on ? ' on' : ''), role: 'option', 'aria-selected': String(i === on), 'data-i': String(i) },
      source.uuid ? el(doc, 'span', { class: 'lk-node', 'data-uuid': source.uuid }, source.title)
        : el(doc, 'span', {}, el(doc, 'span', { class: 'flow-cite-word' }, source.web ? 'Link ' : 'Words '), source.web ? source.url : source.title))));
}
function askName() {
  const doc = open.line.ownerDocument, field = el(doc, 'input', { class: 'flow-cite-field lk-field', 'aria-label': 'Find a source', spellcheck: 'false' });
  open.source = null; open.found = []; open.on = 0;
  open.line.replaceChildren(field, el(doc, 'div', { class: 'flow-cite-found', role: 'listbox' }));
  field.addEventListener('input', () => { if (!open) return; const found = finds(open.sources, field.value), own = offer(field.value, found); open.found = own ? [...found, own] : found; open.on = 0; drawFound(); });
  field.focus();
}
function askPage(source) {
  const doc = open.line.ownerDocument, field = el(doc, 'input', { class: 'flow-cite-page lk-field', 'aria-label': 'Page', inputmode: 'numeric' });
  open.source = source;
  open.line.replaceChildren(el(doc, 'div', { class: 'flow-cite-asked' }, el(doc, 'span', {}, source.title), el(doc, 'span', { class: 'flow-cite-word' }, ' · page '), field));
  field.addEventListener('input', () => { field.value = field.value.replace(/\D/g, ''); });
  field.focus();
}
const take = source => { if (source.pdf || source.words) askPage(source); else write(source, ''); };

/* The words go in through the box, where the /Cite was, as if typed, so Logseq keeps them with the rest and its own Undo holds. */
function typeIn(box, at, text) {
  const doc = box.ownerDocument;
  box.focus(); box.setSelectionRange(at, at);
  let typed = false;
  try { typed = doc.execCommand('insertText', false, text); } catch (error) { typed = false; }
  if (typed) return;
  box.setRangeText(text, at, at, 'end');
  box.dispatchEvent(new doc.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}
const citation = (uuid, page) => `([[${uuid}]]${page ? `, p. ${page}` : ''})`;
// A link and italic words are drawn by Logseq as elements of their own, which is what lets Look find them as it finds a [[link]].
const wording = (source, page) => source.web ? `([${source.title}](${source.url}))` : source.words ? `(*${source.title}*${page ? `, p. ${page}` : ''})` : citation(source.uuid, page);
async function write(source, page) {
  const { box, uuid, at } = open;
  close();
  if (!box.isConnected) return notify('The bullet was left, so nothing was cited.', 'warning');
  const before = box.value[at - 1], after = box.value[at];
  const words = wording(source, page);
  typeIn(box, at, (before && !/\s/.test(before) ? ' ' : '') + words + (after && !/[\s.,;:)]/.test(after) ? ' ' : ''));
  await logseq.Editor.exitEditingMode();
  P.rememberUndo(uuid, uuid, [{ kind: 'citation', prop: { title: 'Citation', ident: 'citation' }, ids: [], shown: source.title + (page ? `, p. ${page}` : '') }], () => takeOff(uuid, words));
}
async function takeOff(uuid, words) {
  const title = String((await logseq.Editor.getBlock(uuid))?.title ?? '');
  const at = title.indexOf(words);
  if (at < 0) return;
  await logseq.Editor.updateBlock(uuid, (title.slice(0, at).replace(/ $/, '') + title.slice(at + words.length)).trim());
}

async function show({ uuid } = {}) {
  if (stopped) return;
  const box = host().activeElement;
  if (!app.isBlockBox(box) || app.uuidOf(box) !== uuid) return notify('Put the cursor in a bullet first.');
  const sources = await sourcesNow().catch(error => { warnOnce('the sources could not be read', error); return null; });
  if (!sources) return notify('The pages could not be read.', 'warning');
  if (!box.isConnected) return;
  close();
  const row = box.closest('.ls-block[blockid]'), own = [...row.children].find(child => child.classList?.contains('block-main-container'));
  open = { box, uuid, at: box.selectionStart, sources, found: [], on: 0, source: null, line: el(box.ownerDocument, 'div', { class: 'flow-cite' }) };
  (own || row.lastElementChild).after(open.line);
  askName();
  window.PluginDoor.unroll(open.line);
}

function backToBullet() { const { box, at } = open; close(); if (box.isConnected) { box.focus(); box.setSelectionRange(at, at); } }
function onKey(event) {
  if (event.isComposing) return;
  if (!open && app.keyMatches(event, app.setting('citeKeys')) && app.isBlockBox(event.target) && !app.editorPopupOpen()) {
    event.preventDefault(); event.stopImmediatePropagation();
    return void show({ uuid: app.uuidOf(event.target) }).catch(error => warnOnce('the citation line could not open', error));
  }
  if (!open || !open.line.contains(event.target)) return;
  const swallow = () => { event.preventDefault(); event.stopImmediatePropagation(); };
  if (event.key === 'Escape') { swallow(); return open.source ? askName() : backToBullet(); }
  if (event.key === 'Enter') {
    swallow();
    if (open.source) return write(open.source, event.target.value).catch(error => { warnOnce('the citation could not be written', error); notify('The citation could not be written', 'warning'); });
    if (open.found[open.on]) take(open.found[open.on]);
    return;
  }
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open.source) {
    swallow();
    if (open.found.length) { open.on = (open.on + (event.key === 'ArrowDown' ? 1 : open.found.length - 1)) % open.found.length; drawFound(); }
    return;
  }
  event.stopPropagation();   // what is typed here is the line's, not Logseq's shortcuts'
}
// A click on a row takes it; the press is held back so the line keeps the keyboard. A press elsewhere lets the line go.
function onPress(event) {
  if (!open) return;
  const row = event.target?.closest?.('.flow-cite-row');
  if (row) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === 'click') take(open.found[Number(row.dataset.i)]);
  } else if (event.type === 'pointerdown' && !open.line.contains(event.target)) close();
}

/* Logseq opens the PDF on the same press, at the page it was last left on, so the page is gone to once the viewer has settled. */
const PATIENCE = 8000, SETTLE = 500;
function goToPage(page) {
  const doc = host(), began = Date.now();
  let found = 0;
  const step = () => {
    const viewer = doc.querySelector('.extensions__pdf-viewer'), target = viewer?.querySelector(`.pdfViewer .page[data-page-number="${page}"]`);
    if (target && !found) found = Date.now();
    if (target && Date.now() - found >= SETTLE) return viewer.scrollTo({ top: target.offsetTop });
    if (Date.now() - began < PATIENCE) setTimeout(step, 100);
  };
  step();
}
function onCitationPress(event) {
  const link = event.target?.closest?.('.asset-ref.is-pdf');
  if (!link || !link.closest('.block-content')) return;
  const page = Number(/^,\s*p\.\s*(\d+)/.exec(link.closest('.page-reference')?.nextSibling?.textContent || '')?.[1]);
  if (page) goToPage(page);
}

/* The fields are the library's (lk-field), the sources found its menu lines (lk-item, lit with on); here only their places under the bullet. */
const css = `
.flow-cite { margin: 2px 0 6px 31px; padding: 2px 0 2px 10px; border-left: 1px solid var(--lk-line); max-width: 460px; font-size: .95em; }
.flow-cite-field { display: block; width: 100%; }
.flow-cite-page { width: 5ch; }
.flow-cite-word { color: var(--lk-faint); }
.flow-cite-found:not(:empty) { margin-top: 4px; }
.flow-cite-row { padding: 2px 6px; margin-left: -6px; cursor: pointer; }
`;

function start() {
  stopped = false;
  app.onStop(() => { stopped = true; close(); });
  app.sendStyle('flow-cite', css);
  const win = host().defaultView;
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true);
  app.listen(win, ['click'], onCitationPress, true);
  logseq.App.onRouteChanged?.(close);
  if (!registered) { registered = true; logseq.Editor.registerSlashCommand('Cite', show); }   // Logseq keeps it for as long as the plugin runs
}
Flow.cite = { start, close, finds, citation, offer, wording, goToPage, state: () => open };
})();
