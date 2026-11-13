/* Links and Endnotes, two tabs of the right sidebar (sidebar-tabs.js), each opening a section of the sidebar above its items, built as Logseq
   builds one, that folds by its head and goes by its ×, for the page you are on.

   Links: the links in the page's words, each once. Two orders, as words at the top of the section: By kind, a group for each top-level tag
   the links sit under, by name, its head naming that tag, a few of each and then "show all"; or Order on page. A tag, a citation (what /Cite
   writes), a cited highlight and a file are not links here.
   Endnotes: the citations of the page, numbered in the order they come, the same source at the same page once. A press on a name goes to the source: a
   PDF opens at that page. A press on a number goes back to the bullet, where the same number stands (cites.js).

   Contents: the page's headings (the bullets started with #, ## or ###), in the order of the page, each level one step in from the
   heading it sits under (a ### right under a # one step, not two), numbered in the quiet grey (1, 1.1 or another way from its ⋯ menu),
   each section folding by its arrow or all at once from the menu; the top ones in the medium weight, the rest in the quiet grey. A press
   glides the main view to the heading; with Shift it opens in the right sidebar.

   A name opens its page, with Shift in the right sidebar. It reads the graph and writes nothing. Each word is a copy of Logseq's own Contents button, so it
   reads as the others do. */
(function () {
const Look = window.Look;
const { el, style, host, watchScreen, onGraphChange, openPage } = Look.kit;
const setting = key => Look.settings.setting(key);

const FEW = 5;
const LINK = /(?<!#)\[\[([^[\]]+)\]\]/g;
const CITATION = /\((?:\[\[([^[\]]+)\]\]|\[([^\]]+)\]\((https?:[^)\s]+)\)|\*([^*]+)\*)(?:, p\. (\d+))?\)/g;   // a node, a web address, plain words
const SECTIONS = [{ key: 'links', word: 'Links', icon: 'link' }, { key: 'contents', word: 'Outline', icon: 'list' }];   // Endnotes stand under Links; Contents is named Outline (the owner, 12 November 2026)
const closed = () => Object.fromEntries(SECTIONS.map(({ key }) => [key, false]));
const anyOpen = () => SECTIONS.some(({ key }) => state.open[key]);
const state = { growing: new Set(), open: closed(), folded: closed(), words: {}, panels: {}, view: 'kind', page: false, rows: [], notes: [], heads: [], all: new Set(), asked: 0, stopped: true };

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
// The page's headings in its order. Logseq keeps a # typed at a bullet's start as the bullet's heading level (1 to 6); a level of
// true (a heading with no number) counts as the top. Each is set one step in from the nearest heading above it with a smaller level.
const LEVEL = ':logseq.property/heading';
const plain = words => words.replace(/\*\*|__|~~|==|`/g, '').replace(/(^|\s)[_*]([^_*]+)[_*](?=\s|$)/g, '$1$2').trim();
async function readHeads(tree) {
  const found = [], stack = [], counts = [];
  const walk = (nodes, above = []) => { for (const node of nodes || []) {
    const raw = node?.[LEVEL] ?? node?.properties?.heading;
    const level = raw === true ? 1 : Number(raw);
    if (level >= 1) {
      while (stack.length && stack.at(-1) >= level) stack.pop();
      counts.length = stack.length + 1; counts[stack.length] = (counts[stack.length] || 0) + 1;
      found.push({ uuid: String(node.uuid).toLowerCase(), depth: stack.length, counts: [...counts], above, title: String(node.fullTitle ?? node.title ?? '').split('\n')[0] });
      stack.push(level);
    }
    walk(node?.children, [...above, String(node.uuid).toLowerCase()]);
  } };
  walk(tree);
  // A link in a heading reads as the name it links to.
  const ids = [...new Set(found.flatMap(head => [...head.title.matchAll(/\[\[([0-9a-f-]{36})\]\]/gi)].map(([, id]) => id.toLowerCase())))];
  const names = ids.length ? await titlesOf(ids) : new Map();
  return found.map(head => ({ ...head, title: plain(head.title.replace(/\[\[([^[\]]+)\]\]/g, (all, key) => names.get(key.toLowerCase())?.title ?? key)) || 'Untitled' }));
}
// A heading glides to the top of the main view. One inside a folded bullet: the folds above it open first, as a press on their
// arrows would.
const blockOnPage = uuid => [...host().querySelectorAll(`#main-content-container .ls-block[blockid="${uuid}"]`)].find(block => block.offsetParent);
async function goToHead(head, inSidebar) {
  if (inSidebar) { logseq.Editor.openInRightSidebar(head.uuid); return; }
  let opened = false;
  for (const uuid of head.above) if (blockOnPage(uuid)?.getAttribute('data-collapsed') === 'true') { await logseq.Editor.setBlockCollapsed(uuid, false); opened = true; }
  if (opened) await new Promise(resolve => setTimeout(resolve, 120));
  // Logseq draws a long page as it is scrolled: until the heading is drawn, the view steps down a screen at a time.
  const view = host().getElementById('main-content-container');
  let shown = blockOnPage(head.uuid);
  for (let step = 0; !shown && view && step < 40; step++) {
    const was = view.scrollTop;
    view.scrollTop += view.clientHeight;
    await new Promise(resolve => setTimeout(resolve, 80));
    shown = blockOnPage(head.uuid);
    if (!shown && view.scrollTop === was) break;
  }
  shown?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
async function load() {
  if (state.stopped) return;
  // With neither section open and no numbers to draw, only the citations are read: the Endnotes tab is there only on a page that has some.
  const whole = state.open.links || setting('citationNumbers');
  const asked = ++state.asked;
  await new Promise(resolve => setTimeout(resolve, 150));   // Logseq says the route changed a moment before it says which page
  const page = await Promise.resolve(logseq.Editor.getCurrentPage?.()).catch(() => null);
  let rows = [], notes = [], heads = [];
  if (page?.uuid) try {
    const tree = await logseq.Editor.getPageBlocksTree(page.uuid);
    const blocks = tree?.length ? tree : (await logseq.Editor.getBlock(page.uuid, { includeChildren: true }))?.children || [];
    [rows, notes, heads] = await Promise.all([whole ? readRows(blocks, String(page.uuid).toLowerCase()) : [], readNotes(blocks), readHeads(blocks)]);
  } catch (error) { console.error('Look: could not read the page’s links', error); }
  if (asked !== state.asked) return;
  Object.assign(state, { page: !!page?.uuid, rows, notes, heads, read: true });
  if (whole) Look.cites.setNotes(notes);
  if (whole || state.open.contents) render(host(), true);
  window.PluginDoor.sideTabs?.draw();
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
  // Nothing to show: the one nothing-here line, at the top of the tab, as in every tab of the sidebar (the audit's 32); the two ways
  // of ordering come only with something to order.
  if (!state.page) return [el(doc, 'div', { class: 'lk-links-none lk-none' }, 'Open a page to see its links.')];
  if (!state.rows.length) return [el(doc, 'div', { class: 'lk-links-none lk-none' }, 'No links in this page’s words.'), ...notesBody(doc)];
  const body = [el(doc, 'div', { class: 'lk-views' }, view('kind', 'By kind'), view('page', 'Order on page'))];
  if (state.view === 'kind') for (const group of byKind(state.rows)) {
    const open = state.all.has(group.head), shown = open ? group.rows : group.rows.slice(0, FEW);
    body.push(el(doc, 'div', { class: 'lk-links-group' }, el(doc, 'div', { class: 'lk-links-head' }, group.head), ...shown.map(row => rowOf(doc, row, group.head !== NO_TAG)),
      shown.length < group.rows.length ? el(doc, 'button', { class: 'lk-more', type: 'button', click: () => { state.all.add(group.head); render(doc); unrollRest(doc, group.head); } }, `show all ${group.rows.length}`) : null));
  } else body.push(...state.rows.map(row => rowOf(doc, row, false)));
  body.push(...notesBody(doc));
  return body;
}
function notesBody(doc) {
  // Under the page's links, one heading and the citations in their order; a page with no citations has no heading (the owner, 12 November 2026).
  if (!state.notes.length) return [];
  return [el(doc, 'div', { class: 'lk-links-group lk-notes' }, el(doc, 'div', { class: 'lk-links-head' }, 'Endnotes'), ...state.notes.map((note, i) => noteOf(doc, note, i + 1)))];
}
/* Contents' ⋯ menu (the owner, 12 November 2026: "3 dots in right corner to change numbering system, keep, fold sections"): how the
   headings are numbered, saved with the plugin's settings; and fold every section or none. A section folds by its arrow too, as an
   outline's does: the headings inside it go, the heading stays. Folds live while the plugin runs, by the heading's id. */
const ALPHA = n => { let out = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(97 + (n - 1) % 26) + out; return out; };
const ROMAN = n => [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
  .reduce((out, [value, mark]) => { for (; n >= value; n -= value) out += mark; return out; }, '');
const NUMBERINGS = [
  { key: 'decimal', word: '1, 1.1, 1.1.1', label: counts => counts.join('.') },
  { key: 'outline', word: '1, a, i', label: counts => [String, ALPHA, ROMAN][(counts.length - 1) % 3](counts.at(-1)) },
  { key: 'classic', word: 'I, A, 1, a', label: counts => [n => ROMAN(n).toUpperCase(), n => ALPHA(n).toUpperCase(), String, ALPHA][(counts.length - 1) % 4](counts.at(-1)) },
  { key: 'none', word: 'None', label: () => '' },
];
let numberedBy = null;   // the choice just taken, until the saved settings say it back
const numbering = () => NUMBERINGS.find(way => way.key === (numberedBy || setting('contentsNumbers'))) || NUMBERINGS[0];
const folds = new Set();
// The headings inside each heading: the ones after it, until one at its depth or nearer the top.
const inside = (heads, i) => { const out = []; for (let j = i + 1; j < heads.length && heads[j].depth > heads[i].depth; j++) out.push(heads[j]); return out; };
const shownHeads = () => { const hidden = new Set(); state.heads.forEach((head, i) => { if (folds.has(head.uuid) && !hidden.has(head.uuid)) for (const sub of inside(state.heads, i)) hidden.add(sub.uuid); }); return state.heads.filter(head => !hidden.has(head.uuid)); };
const rowsOf = uuids => [...(state.panels.contents?.querySelectorAll('.lk-contents-row') || [])].filter(row => uuids.includes(row.dataset.uuid));
// Folding rolls the headings inside up and away, unfolding rolls them out, as every fold of the plugin.
async function setFolds(change) {
  const before = new Set(shownHeads().map(head => head.uuid));
  change();
  const after = shownHeads().map(head => head.uuid), going = [...before].filter(uuid => !after.includes(uuid)), coming = after.filter(uuid => !before.has(uuid));
  if (going.length) await window.PluginDoor.rollUp(rowsOf(going));
  render(host());
  if (coming.length) window.PluginDoor.unroll(rowsOf(coming));
}
function contentsBody(doc) {
  if (!state.page) return [el(doc, 'div', { class: 'lk-links-none lk-none' }, 'Open a page to see its headings.')];
  if (!state.heads.length) return [el(doc, 'div', { class: 'lk-links-none lk-none' }, 'No headings on this page.')];
  const way = numbering(), holds = new Set(state.heads.filter((head, i) => inside(state.heads, i).length).map(head => head.uuid));
  // The numbers of one level share one width, right-aligned, so the words of a level start on one line (I, II and III alike).
  const shown = shownHeads(), widths = [];
  for (const head of shown) widths[head.depth] = Math.max(widths[head.depth] || 0, way.label(head.counts).length);
  const rows = shown.map(head => {
    const go = event => { if (event.target.closest('.lk-fold')) return; event.preventDefault(); goToHead(head, event.shiftKey); };
    const fold = holds.has(head.uuid) ? el(doc, 'button', { class: 'lk-fold', type: 'button', 'aria-expanded': String(!folds.has(head.uuid)), 'aria-label': folds.has(head.uuid) ? 'Unfold' : 'Fold',
      click: event => { event.stopPropagation(); setFolds(() => folds.has(head.uuid) ? folds.delete(head.uuid) : folds.add(head.uuid)); } }) : el(doc, 'span', { class: 'lk-contents-nofold' });
    const label = way.label(head.counts);
    return el(doc, 'div', { class: `lk-contents-row lk-row${head.depth ? '' : ' lk-contents-top'}`, style: `padding-left: ${head.depth * 20}px`, 'data-uuid': head.uuid, role: 'link', tabindex: '0',
      click: go, keydown: event => { if (event.key === 'Enter') go(event); } },
      fold, label ? el(doc, 'span', { class: 'lk-contents-n', style: `min-width: ${widths[head.depth]}ch` }, label) : null, el(doc, 'span', { class: 'lk-contents-words' }, head.title));
  });
  const more = el(doc, 'button', { class: 'lk-btn lk-low lk-contents-more', type: 'button', 'aria-label': 'Numbering and folding', title: 'Numbering and folding', 'aria-haspopup': 'menu',
    html: Look.kit.iconHtml('dots'), click: event => openMenu(doc, event.currentTarget) });
  return [more, ...rows];
}
// The menu, the library's (lk-pop, lk-menu, lk-group, lk-item): under the ⋯, its right edge on the ⋯'s. Up and Down walk it, Enter
// takes a line, Escape or a press elsewhere closes it, and the ⋯ has the keys again.
let menu = null;
function closeMenu(back) { if (!menu) return; menu.box.remove(); menu.off(); if (back) menu.from.focus(); menu = null; }
function openMenu(doc, from) {
  if (menu) { closeMenu(); return; }
  const way = numbering(), folding = state.heads.filter((head, i) => inside(state.heads, i).length);
  const takes = new Map();   // each line and what taking it does, for the press and for Enter alike
  const item = (word, pressed, act, off) => { const take = () => { closeMenu(true); act(); }; const line = el(doc, 'button', { class: `lk-item${off ? ' off' : ''}`, type: 'button', role: 'menuitem', click: take }, el(doc, 'span', {}, word), pressed ? el(doc, 'span', { class: 'lk-note' }, '✓') : null); takes.set(line, take); return line; };
  const box = el(doc, 'div', { class: 'lk-pop lk-menu lk-own lk-contents-menu', role: 'menu' },
    el(doc, 'div', { class: 'lk-group' }, 'Numbering'),
    ...NUMBERINGS.map(each => item(each.word, each.key === way.key, () => { numberedBy = each.key; logseq.updateSettings({ contentsNumbers: each.key }); render(host()); })),
    el(doc, 'div', { class: 'lk-item gap' }), el(doc, 'div', { class: 'lk-group' }, 'Sections'),
    item('Fold all', false, () => setFolds(() => folding.forEach(head => folds.add(head.uuid))), folding.every(head => folds.has(head.uuid))),
    item('Unfold all', false, () => setFolds(() => folding.forEach(head => folds.delete(head.uuid))), !folding.some(head => folds.has(head.uuid))));
  Object.assign(box.style, { position: 'fixed', zIndex: 60, width: 'max-content' });
  doc.body.append(box);
  const at = from.getBoundingClientRect();
  Object.assign(box.style, { top: `${at.bottom + 4}px`, left: `${Math.max(8, at.right - box.offsetWidth)}px` });
  const lines = [...box.querySelectorAll('.lk-item:not(.gap):not(.off)')];
  let at_ = 0;
  const light = i => { lines.forEach((line, j) => line.classList.toggle('on', j === i)); lines[i]?.focus(); at_ = i; };
  const keys = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); takes.get(lines[at_])?.(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); light((at_ + (event.key === 'ArrowDown' ? 1 : lines.length - 1)) % lines.length); }
  };
  const away = event => { if (!box.contains(event.target) && event.target !== from && !from.contains(event.target)) closeMenu(); };
  box.addEventListener('keydown', keys);
  menu = { box, from, off: Look.kit.listen(doc, 'pointerdown', away, true) };
  window.PluginDoor.unroll(box);
  light(0);
}
// read: the page was read for a section just opened, so what it holds grows on from the empty section (window.PluginDoor.regrow).
function render(doc, read) {
  for (const { key } of SECTIONS) {
    const panel = state.panels[key], body = panel?.querySelector('.sidebar-panel-content');
    if (!body) continue;
    const was = read && state.growing.has(key) && !body.hidden ? body.getBoundingClientRect().height : null;
    panel.classList.toggle('lk-links-flat', key === 'links' && state.view === 'page');
    body.replaceChildren(...(key === 'links' ? linksBody(doc) : contentsBody(doc)));
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
  if (!close?.querySelector('.ls-icon-x') || !anyOpen()) return;
  if (host().querySelectorAll('#right-sidebar .sidebar-item:not(.lk-side):not([data-lk-closed])').length > 1) return;
  event.preventDefault(); event.stopImmediatePropagation();
  close.closest('.sidebar-item').setAttribute('data-lk-closed', '');
}
function letHiddenGo() {
  if (anyOpen()) return;
  for (const item of hidden()) { item.removeAttribute('data-lk-closed'); window.PluginDoor.screen.click(item.querySelector('.ls-icon-x')?.closest('button')); }
}

const css = `
#right-sidebar .sidebar-item[data-lk-closed] { display: none !important; }
#right-sidebar .lk-side .sidebar-item-header { min-height: 32px; }
#right-sidebar .lk-side .sidebar-item-header i.ti { width: 18px; font-size: 18px; text-align: center; }
#right-sidebar .lk-side .lk-close { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
#right-sidebar .lk-side .sidebar-panel-content { padding-top: 6px; padding-bottom: 8px; font-size: 14px; line-height: 1.5; }
#right-sidebar .lk-side .lk-views { margin: 0 0 8px -8px; }
#right-sidebar .lk-links-group + .lk-links-group { margin-top: 12px; }
#right-sidebar :is(.lk-links-row, .lk-links-none) + .lk-notes { margin-top: 16px; }   /* Endnotes, after the links in the order of the page or the line that says there are none */
#right-sidebar .lk-links-group + .lk-notes { margin-top: 20px; }
#right-sidebar .lk-links-head { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
#right-sidebar .lk-links-row { display: flex; align-items: baseline; gap: .5em; min-width: 0; padding: 2px 0; }
#right-sidebar .lk-links-row .lk-node { min-width: 0; overflow-wrap: anywhere; }
#right-sidebar .lk-links-row .lk-tag { flex: none; }
#right-sidebar .lk-notes-row { display: grid; grid-template-columns: 1.6em minmax(0, 1fr); align-items: baseline; padding: 2px 0; }
#right-sidebar .lk-notes-n { color: var(--lk-quiet) !important; font-variant-numeric: tabular-nums; text-decoration: none; }
#right-sidebar .lk-notes-n:hover { color: var(--lk-text, currentColor) !important; }
#right-sidebar .lk-notes-words { min-width: 0; overflow-wrap: anywhere; }
#right-sidebar .lk-side-contents .sidebar-panel-content { position: relative; }
#right-sidebar .lk-contents-more { position: absolute; top: 0; right: 0; }
#right-sidebar .lk-side-contents .lk-contents-row:nth-child(2) { margin-right: 36px; }
#right-sidebar .lk-contents-row .lk-fold, #right-sidebar .lk-contents-nofold { align-self: flex-start; width: 16px; height: 1.5em; flex: none; margin-right: -2px; }
/* The arrow as Logseq's: only under the pointer, and at rest on a folded section, so a fold is seen. */
#right-sidebar .lk-contents-row .lk-fold[aria-expanded="true"] { opacity: 0 !important; }
#right-sidebar .lk-contents-row:is(:hover, :focus-within) .lk-fold, #right-sidebar .lk-contents-row .lk-fold[aria-expanded="false"] { opacity: .6 !important; }
#right-sidebar .lk-contents-row .lk-fold:hover { opacity: 1 !important; }
#right-sidebar .lk-contents-row { display: flex; gap: .5em; align-items: baseline; padding-block: 2px; border-radius: 4px; cursor: pointer; color: var(--lk-quiet) !important; text-decoration: none !important; overflow-wrap: anywhere; }
#right-sidebar .lk-contents-row.lk-contents-top { color: var(--lk-text, currentColor) !important; font-weight: 600; }
#right-sidebar .lk-contents-row.lk-contents-top:not(:first-child) { margin-top: 8px; }
#right-sidebar .lk-contents-n { flex: none; text-align: right; color: var(--lk-quiet); font-weight: 400; font-variant-numeric: tabular-nums; }
#right-sidebar .lk-contents-words { min-width: 0; }
#right-sidebar .lk-contents-row:hover { color: var(--lk-text, currentColor) !important; }
#right-sidebar .lk-links-none { padding: 0; }   /* the library's nothing-here line (lk-none), at the top of the tab */`;

/* Links and Endnotes are tabs of the right sidebar, after Inspector (sidebar-tabs.js, the owner, 9 November 2026): picked, the
   section opens if it is not open yet, and stands alone, without its head. */
let offTabs = [];
function start() {
  state.stopped = false;
  // Outline stands first on the left (the owner, 12 November 2026), before Structure's Ontology (1) and Item (2); Links after them.
  offTabs = SECTIONS.map(({ key, word }) => window.PluginDoor.sideTabs?.add({ key, word, order: key === 'contents' ? 0 : 3,
    find: () => (state.panels[key]?.isConnected ? state.panels[key] : null), open: () => { if (!state.open[key]) setOpen(key, true); },
    // Outline has no tab on a page with no headings; until the page is read, it stays as it was.
    hidden: key === 'contents' ? () => state.read && !state.heads.length : undefined }));
  style('sidebar-links', css);
  watchScreen(draw);
  Look.kit.listen(host().defaultView, 'click', onItemClosed, true);
  Look.kit.onStop(logseq.App.onRouteChanged?.(load));
  onGraphChange(load);
  load();
}
function stop() { closeMenu(); offTabs.forEach(off => off?.()); offTabs = []; state.stopped = true; Object.assign(state, { open: closed(), words: {}, panels: {} }); style('sidebar-links', ''); }
Look.links = { start, stop, load, linksIn, citationsIn, byKind, readHeads, NUMBERINGS };
})();
