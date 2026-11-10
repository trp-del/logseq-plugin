/* Links and Endnotes, two tabs of the right sidebar (sidebar-tabs.js), each opening a section of the sidebar above its items, built as Logseq
   builds one, that folds by its head and goes by its ×, for the page you are on.

   Links: the links in the page's words, each once. Two orders, as words at the top of the section: By kind, a group for each top-level tag
   the links sit under, by name, its head naming that tag, a few of each and then "show all"; or Order on page. A tag, a citation (what /Cite
   writes), a cited highlight and a file are not links here.
   Endnotes: the citations of the page, numbered in the order they come, the same source at the same page once. A press on a name goes to the source: a
   PDF opens at that page. A press on a number goes back to the bullet, where the same number stands (cites.js).

   A name opens its page, with Shift in the right sidebar. It reads the graph and writes nothing. Each word is a copy of Logseq's own Contents button, so it
   reads as the others do. */
(function () {
const Look = window.Look;
const { el, style, host, watchScreen, onGraphChange, openPage } = Look.kit;
const setting = key => Look.settings.setting(key);

const FEW = 5;
const LINK = /(?<!#)\[\[([^[\]]+)\]\]/g;
const CITATION = /\((?:\[\[([^[\]]+)\]\]|\[([^\]]+)\]\((https?:[^)\s]+)\)|\*([^*]+)\*)(?:, p\. (\d+))?\)/g;   // a node, a web address, plain words
const SECTIONS = [{ key: 'links', word: 'Links', icon: 'link' }, { key: 'notes', word: 'Endnotes', icon: 'notes' }];
const state = { growing: new Set(), open: { links: false, notes: false }, folded: { links: false, notes: false }, words: {}, panels: {}, view: 'kind', page: false, rows: [], notes: [], all: new Set(), asked: 0, stopped: true };

const eachTitle = (tree, visit) => { for (const node of tree || []) { visit(String(node?.title ?? '')); eachTitle(node?.children, visit); } };
// What the words link to, each once, in the order of the page; a citation is not a link here.
function linksIn(tree) {
  const seen = new Set();
  eachTitle(tree, title => { for (const [, key] of title.replace(CITATION, '').matchAll(LINK)) seen.add(key.toLowerCase()); });
  return [...seen];
}
// What the words cite, in the order of the page, the same source at the same page once.
function citationsIn(tree) {
  const seen = new Map();
  eachTitle(tree, title => { for (const [, node, webTitle, url, words, page] of title.matchAll(CITATION)) {
    const id = node ? node.toLowerCase() : url ? url.toLowerCase() : `words:${words.toLowerCase()}`, at = `${id}|${page || ''}`;
    if (!seen.has(at)) seen.set(at, { id, key: node?.toLowerCase(), url, title: webTitle || words, page: page ? Number(page) : 0 });
  } });
  return [...seen.values()];
}
// Rows go under the top-level tag they sit under, the heads by name, the rows by name; the untagged come last, under a head saying so.
const NO_TAG = 'No tag';
function byKind(rows) {
  const names = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  const heads = [...new Set(rows.map(row => row.top).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const groups = heads.map(head => ({ head, rows: rows.filter(row => row.top === head).sort(names) }));
  return [...groups, { head: NO_TAG, rows: rows.filter(row => !row.top).sort(names) }].filter(group => group.rows.length);
}

async function titlesOf(uuids) {
  if (!uuids.length) return new Map();
  const rows = await Look.db.query(`[:find ?u ?t ?kind :where [(ground [${uuids.map(uuid => `#uuid "${uuid}"`).join(' ')}]) [?u ...]] [?b :block/uuid ?u] [?b :block/title ?t]
    [(get-else $ ?b :logseq.property.asset/type "") ?kind] (not [?b :logseq.property.pdf/hl-page _]) (not [?b :logseq.property/deleted-at _])]`);
  return new Map(rows.map(([uuid, title, kind]) => [String(uuid).toLowerCase(), { title: String(title), file: String(kind) }]));
}
const uuidFor = key => Look.db.UUID.test(key) ? key : Look.index?.uuidByName(key) || '';
const wordsOf = async (uuid, title) => title.includes('[[') ? (await logseq.Editor.getBlock(uuid))?.fullTitle || title : title;
async function readRows(blocks, own) {
  const index = Look.index, uuids = [...new Set(linksIn(blocks).map(uuidFor).filter(uuid => uuid && uuid.toLowerCase() !== own))];
  const found = await titlesOf(uuids), rows = [];
  for (const uuid of uuids.map(uuid => uuid.toLowerCase())) {
    const node = found.get(uuid);
    if (!node || node.file || index?.isTag(uuid)) continue;
    const chain = index?.chainsOfPage(uuid)?.[0]?.chain || [];
    rows.push({ uuid, title: await wordsOf(uuid, node.title), tag: chain[0]?.title || '', top: chain.at(-1)?.title || '' });
  }
  return rows;
}
async function readNotes(blocks) {
  const cited = citationsIn(blocks).map(note => note.key ? { ...note, uuid: uuidFor(note.key).toLowerCase() } : note);
  const found = await titlesOf([...new Set(cited.map(note => note.uuid).filter(Boolean))]), notes = [];
  for (const note of cited) {
    if (!note.key) { notes.push(note); continue; }
    const node = found.get(note.uuid);
    if (node) notes.push({ ...note, id: note.uuid, title: await wordsOf(note.uuid, node.title), pdf: node.file === 'pdf' });
  }
  return notes;
}
async function load() {
  if (!(state.open.links || state.open.notes || setting('citationNumbers')) || state.stopped) return;
  const asked = ++state.asked;
  await new Promise(resolve => setTimeout(resolve, 150));   // Logseq says the route changed a moment before it says which page
  const page = await Promise.resolve(logseq.Editor.getCurrentPage?.()).catch(() => null);
  let rows = [], notes = [];
  if (page?.uuid) try {
    const tree = await logseq.Editor.getPageBlocksTree(page.uuid);
    const blocks = tree?.length ? tree : (await logseq.Editor.getBlock(page.uuid, { includeChildren: true }))?.children || [];
    [rows, notes] = await Promise.all([readRows(blocks, String(page.uuid).toLowerCase()), readNotes(blocks)]);
  } catch (error) { console.error('Look: could not read the page’s links', error); }
  if (asked !== state.asked) return;
  Object.assign(state, { page: !!page?.uuid, rows, notes });
  Look.cites.setNotes(notes);
  render(host(), true);
}

function rowOf(doc, row, bare) {
  const open = event => { event.preventDefault(); openPage(row.uuid, event.shiftKey); };
  return el(doc, 'div', { class: 'lk-links-row' }, el(doc, 'a', { class: `lk-node${bare ? ' lk-bare' : ''}`, 'data-uuid': row.uuid, href: '#', click: open }, row.title), row.tag ? el(doc, 'span', { class: 'lk-tag' }, row.tag) : null);
}
function noteOf(doc, note, number) {
  const open = event => { event.preventDefault(); Look.cites.goTo(note, event.shiftKey); };
  return el(doc, 'div', { class: 'lk-notes-row' }, el(doc, 'a', { class: 'lk-notes-n', href: '#', title: 'Back to the bullet', click: event => { event.preventDefault(); Look.cites.showNumber(note); } }, String(number)),
    el(doc, 'span', { class: 'lk-notes-words' }, note.uuid || note.url ? el(doc, 'a', { class: 'lk-node', ...(note.uuid ? { 'data-uuid': note.uuid } : {}), href: '#', click: open }, note.title) : note.title, note.page ? `, p. ${note.page}` : null));
}
function linksBody(doc) {
  const view = (key, words) => el(doc, 'button', { class: `lk-view${state.view === key ? ' on' : ''}`, type: 'button', click: () => { state.view = key; render(doc); } }, words);
  const body = [el(doc, 'div', { class: 'lk-views' }, view('kind', 'By kind'), view('page', 'Order on page'))];
  if (!state.page) body.push(el(doc, 'div', { class: 'lk-links-none' }, 'Open a page to see its links.'));
  else if (!state.rows.length) body.push(el(doc, 'div', { class: 'lk-links-none' }, 'No links in this page’s words.'));
  else if (state.view === 'kind') for (const group of byKind(state.rows)) {
    const open = state.all.has(group.head), shown = open ? group.rows : group.rows.slice(0, FEW);
    body.push(el(doc, 'div', { class: 'lk-links-group' }, el(doc, 'div', { class: 'lk-links-head' }, group.head), ...shown.map(row => rowOf(doc, row, group.head !== NO_TAG)),
      shown.length < group.rows.length ? el(doc, 'button', { class: 'lk-more', type: 'button', click: () => { state.all.add(group.head); render(doc); unrollRest(doc, group.head); } }, `show all ${group.rows.length}`) : null));
  } else body.push(...state.rows.map(row => rowOf(doc, row, false)));
  return body;
}
function notesBody(doc) {
  if (!state.page) return [el(doc, 'div', { class: 'lk-links-none' }, 'Open a page to see its citations.')];
  if (!state.notes.length) return [el(doc, 'div', { class: 'lk-links-none' }, 'No citations on this page.')];
  return state.notes.map((note, i) => noteOf(doc, note, i + 1));
}
// read: the page was read for a section just opened, so what it holds grows on from the empty section (window.PluginDoor.regrow).
function render(doc, read) {
  for (const { key } of SECTIONS) {
    const panel = state.panels[key], body = panel?.querySelector('.sidebar-panel-content');
    if (!body) continue;
    const was = read && state.growing.has(key) && !body.hidden ? body.getBoundingClientRect().height : null;
    panel.classList.toggle('lk-links-flat', key === 'links' && state.view === 'page');
    body.replaceChildren(...(key === 'links' ? linksBody(doc) : notesBody(doc)));
    if (read) { state.growing.delete(key); window.PluginDoor.regrow(body, was); }
  }
  Look.kit.run(doc);
}
// The rest of a group, shown by "show all", rolls out under its first few.
function unrollRest(doc, head) {
  const group = [...(state.panels.links?.querySelectorAll('.lk-links-group') || [])].find(g => g.querySelector('.lk-links-head')?.textContent === head);
  window.PluginDoor.unroll([...(group?.querySelectorAll(':scope > .lk-links-row') || [])].slice(FEW));
}

// A section rolls out of the bar's word when opened and back up when closed; folding rolls what it holds up, unfolding out.
async function setOpen(key, open) {
  if (!open) await window.PluginDoor.rollUp(state.panels[key]);
  state.open[key] = open; state.all.clear();
  if (open) state.growing.add(key);
  load(); draw(host()); letHiddenGo();
  if (open) window.PluginDoor.unroll(state.panels[key]);
}
async function setFolded(key, folded) {
  const body = state.panels[key]?.querySelector('.sidebar-panel-content');
  if (folded) await window.PluginDoor.rollUp(body);
  state.folded[key] = folded; draw(host());
  if (!folded) window.PluginDoor.unroll(body);
}
// A section as Logseq builds one, so the sidebar's own rules reach it: a head that folds it, an × that closes it, what it holds under them.
function sectionOf(doc, { key, word, icon }) {
  const arrow = doc.querySelector('.ls-block .rotating-arrow')?.cloneNode(true) || el(doc, 'span', { class: 'rotating-arrow' });
  const fold = el(doc, 'button', { class: 'lk-side-fold flex flex-row px-2 items-center w-full overflow-hidden', type: 'button', click: () => setFolded(key, !state.folded[key]) },
    el(doc, 'span', { class: 'opacity-50 hover:opacity-100 flex items-center pr-1' }, arrow),
    el(doc, 'div', { class: 'ml-1 font-medium text-sm overflow-hidden whitespace-nowrap' }, el(doc, 'div', { class: 'flex items-center' }, el(doc, 'i', { class: `ti ti-${icon} text-md mr-2`, 'aria-hidden': 'true' }), word)));
  const close = el(doc, 'button', { class: 'lk-close', type: 'button', 'aria-label': `Close ${word}`, click: () => setOpen(key, false), html: '<i class="ti ti-x" aria-hidden="true"></i>' });
  return el(doc, 'div', { class: `lk-own lk-side flex sidebar-item content lk-side-${key}` }, el(doc, 'div', { class: 'flex flex-col w-full relative' },
    el(doc, 'div', { class: 'flex flex-row justify-between sidebar-item-header' }, fold, el(doc, 'div', { class: 'item-actions flex items-center' }, close)),
    el(doc, 'div', { class: 'initial sidebar-panel-content px-2' })));
}
// The words stand after Contents, the sections above the sidebar's items, in that order. Put back if Logseq draws the bar or the items again.
function draw(doc) {
  const contents = [...doc.querySelectorAll('#right-sidebar .cp__right-sidebar-settings > div:not(.lk-own)')].find(box => box.textContent.trim() === 'Contents');
  const list = doc.querySelector('#right-sidebar .sidebar-item-list');
  if (setting('sidebarLinks') && !contents) return;   // the sidebar is shut: the sections stand again when it opens
  if (!setting('sidebarLinks')) {
    for (const { key } of SECTIONS) { state.words[key]?.remove(); state.words[key] = null; state.panels[key]?.remove(); state.panels[key] = null; state.open[key] = false; }
    return;
  }
  let made = false, next = list?.firstElementChild;
  if (list) for (const section of SECTIONS) {
    const { key } = section;
    if (!state.open[key]) { if (next === state.panels[key]) next = next.nextElementSibling; state.panels[key]?.remove(); state.panels[key] = null; continue; }
    if (state.panels[key]?.parentElement !== list) { state.panels[key] = sectionOf(doc, section); made = true; }
    const panel = state.panels[key];
    if (next !== panel) list.insertBefore(panel, next);
    next = panel.nextElementSibling;
    const arrow = panel.querySelector('.rotating-arrow');
    arrow.classList.toggle('collapsed', state.folded[key]);
    arrow.classList.toggle('not-collapsed', !state.folded[key]);
    panel.querySelector('.lk-side-fold').setAttribute('aria-expanded', String(!state.folded[key]));
    panel.querySelector('.sidebar-panel-content').hidden = state.folded[key];
  }
  if (made) render(doc);
}

/* Logseq shuts the whole sidebar when its last item goes, and it does not know these sections. So with one open, the × of its last item only hides the item,
   until a word in the bar asks for it again or the last section goes, when the item goes as Logseq would have it. */
const hidden = () => [...host().querySelectorAll('#right-sidebar .sidebar-item[data-lk-closed]')];
function onItemClosed(event) {
  if (event.target?.closest?.('#right-sidebar .cp__right-sidebar-settings > div:not(.lk-own) button')) { for (const item of hidden()) item.removeAttribute('data-lk-closed'); return; }
  const close = event.target?.closest?.('#right-sidebar .sidebar-item:not(.lk-side) .item-actions button');
  if (!close?.querySelector('.ls-icon-x') || !(state.open.links || state.open.notes)) return;
  if (host().querySelectorAll('#right-sidebar .sidebar-item:not(.lk-side):not([data-lk-closed])').length > 1) return;
  event.preventDefault(); event.stopImmediatePropagation();
  close.closest('.sidebar-item').setAttribute('data-lk-closed', '');
}
function letHiddenGo() {
  if (state.open.links || state.open.notes) return;
  for (const item of hidden()) { item.removeAttribute('data-lk-closed'); window.PluginDoor.screen.click(item.querySelector('.ls-icon-x')?.closest('button')); }
}

const css = `
#right-sidebar .lk-links-word.on .cp__right-sidebar-settings-btn { opacity: 1; font-weight: 500; }
#right-sidebar .sidebar-item[data-lk-closed] { display: none !important; }
#right-sidebar .lk-side .sidebar-item-header { min-height: 32px; }
#right-sidebar .lk-side .sidebar-item-header i.ti { width: 18px; font-size: 18px; text-align: center; }
#right-sidebar .lk-side .lk-close { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
#right-sidebar .lk-side .sidebar-panel-content { padding-top: 6px; padding-bottom: 8px; font-size: 14px; line-height: 1.5; }
#right-sidebar .lk-side .lk-views { margin: 0 0 8px -8px; }
#right-sidebar .lk-links-group + .lk-links-group { margin-top: 12px; }
#right-sidebar .lk-links-head { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
#right-sidebar .lk-links-row { display: flex; align-items: baseline; gap: .5em; min-width: 0; padding: 2px 0; }
#right-sidebar .lk-links-row .lk-node { min-width: 0; overflow-wrap: anywhere; }
#right-sidebar .lk-links-row .lk-tag { flex: none; }
#right-sidebar .lk-notes-row { display: grid; grid-template-columns: 1.6em minmax(0, 1fr); align-items: baseline; padding: 2px 0; }
#right-sidebar .lk-notes-n { color: var(--lk-soft) !important; font-variant-numeric: tabular-nums; text-decoration: none; }
#right-sidebar .lk-notes-n:hover { color: var(--lk-text, currentColor) !important; }
#right-sidebar .lk-notes-words { min-width: 0; overflow-wrap: anywhere; }
#right-sidebar .lk-links-none { color: var(--lk-soft); }`;

/* Links and Endnotes are tabs of the right sidebar, after Inspector (sidebar-tabs.js, the owner, 9 November 2026): picked, the
   section opens if it is not open yet, and stands alone, without its head. */
let offTabs = [];
function start() {
  state.stopped = false;
  offTabs = SECTIONS.map(({ key, word }, i) => window.PluginDoor.sideTabs?.add({ key, word, order: 3 + i,
    find: () => (state.panels[key]?.isConnected ? state.panels[key] : null), open: () => { if (!state.open[key]) setOpen(key, true); } }));
  style('sidebar-links', css);
  watchScreen(draw);
  Look.kit.listen(host().defaultView, 'click', onItemClosed, true);
  Look.kit.onStop(logseq.App.onRouteChanged?.(load));
  onGraphChange(load);
  load();
}
function stop() { offTabs.forEach(off => off?.()); offTabs = []; state.stopped = true; Object.assign(state, { open: { links: false, notes: false }, words: {}, panels: {} }); style('sidebar-links', ''); }
Look.links = { start, stop, load, linksIn, citationsIn, byKind };
})();
