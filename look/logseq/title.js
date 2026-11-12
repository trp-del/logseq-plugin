/* A page's place in the tree, at the right end of its title row, where Logseq keeps a page's own tags and fades them in
   under the pointer: the page's tag and the tags above it, nearest first, "Doctor / Person / Entity", each name opening
   its page (Shift: in the right sidebar). On a tag's own page, only the tags above it; its own name is the title. Two
   tags of a page are kept apart by a dot. Under the pointer an × stands before a tag the page holds and takes it off; on
   a tag's page it reaches every node under the tag, so it opens Structure's ask, and with Structure off there is no ×. It sits in the room before the name, so nothing moves.
   The same line sits under a page's name in the right sidebar. Drawn from the index marks.js keeps, in the same frame as
   the title, so the row's right end never moves after the title has come. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, el, esc, openPage, notify } = Look.kit, { setting } = Look.settings;
const css = `
.lk-path { display: inline-flex; align-items: baseline; align-self: flex-start; max-width: 24em; margin: 17px 0 0 -6px; padding-left: 18px; overflow: hidden; white-space: nowrap; line-height: 1.6; vertical-align: middle; font-size: 14px; }
/* Too long for the row, the line gives way from the middle, then the nearest tag if it alone is too long; the kind stays whole.
   How far a tag gives way is never more than its name is long (--lk-n, its letters, each counted .4em, a little under a letter of the tag's serif), so a
   short name keeps no room after it: a floor of 4em once left a wide gap after "Doctor". */
/* A last letter that leans past its box or a tail that hangs below (the y of Entity): room for both inside the clip, given back outside. */
.lk-path > a.lk-tag { flex: 0 1000 auto; min-width: min(1.2em, calc(var(--lk-n, 3) * .4em)); overflow: hidden; text-overflow: ellipsis; padding-right: .15em; margin-right: -.15em; line-height: inherit; }
.lk-path > a.lk-end { flex-shrink: 0; }
.lk-path > .lk-held { display: inline-flex; flex: 0 1 auto; }
.lk-path > .lk-held > a.lk-tag { min-width: min(3.2em, calc(var(--lk-n, 8) * .4em)); overflow: hidden; text-overflow: ellipsis; }
.lk-path > .lk-sep { flex: none; }
.lk-path .lk-sep { margin: 0 .35em; color: var(--lk-quiet); }
.lk-path .lk-own { position: relative; }
.lk-path .lk-sep:has(+ .lk-held) { display: inline-block; min-width: 22px; margin: 0; text-align: center; }
/* The × is the library's lk-reveal: shown while its tag is pointed at, kept while the hand moves onto it, darker near it. It stands
   where the separator before the tag is, and the separator gives way to it for as long as it shows. */
.lk-path .lk-x { position: absolute; right: calc(100% + 3px); top: 0; bottom: 0; width: 14px; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
.lk-path .lk-sep:has(+ .lk-held) { transition: visibility 0s linear .47s; }
.lk-path .lk-sep:has(+ .lk-held:is(:hover, :focus-within)) { visibility: hidden; transition-delay: 0s; }
.lk-path a.lk-tag { cursor: pointer; }
/* Logseq's own faded tags there give way to the line. */
.ls-block-right:has(> .lk-path) > .block-tags { display: none; }
/* In the right sidebar: a line of its own under the page's name, wrapping between names. */
.lk-path.lk-path-sb { display: block; max-width: none; margin: 4px 0 0 4px; white-space: normal; overflow: visible; }
.lk-path.lk-path-sb .lk-held { white-space: nowrap; }
/* The Undo arrow of a tag taken off, at the right end of the title row: on the line the tags stand on. */
.ls-block-right > .lk-undo.lk-undo-title { align-self: flex-start; margin: 21px 0 0 6px; }
.sidebar-item-header .page-title > .lk-undo.lk-undo-title { text-decoration: none !important; }   /* beside a sidebar page's name: the name's underline is not the arrow's */`;

const state = { box: null, page: '', tagPage: false, boxes: new Map() };
const PAGE_TITLE = '#main-content-container :is(.ls-page-title, .page-title, h1.title)';
const SIDEBAR_PAGE = '#right-sidebar .sidebar-item.item-type-page';
const shownTitle = doc => { const titles = [...doc.querySelectorAll(PAGE_TITLE)].filter(t => t.querySelector('.ls-block[blockid]')); return titles.length === 1 ? titles[0] : null; };

// What the row reads. A tag's page: the tags above it only. A page: each held tag's whole chain.
function groupsOf(index, uuid) {
  const groups = [];
  if (index.isTag(uuid) && !index.isPageKind(uuid)) {
    const own = index.chainByUuid(uuid);
    groups.tagPage = true;
    if (own.chain.length > 1 || own.others.length) groups.push({ chain: own.chain.slice(1), others: own.others });
    return groups;
  }
  for (const chain of index.chainsOfPage(uuid)) groups.push(chain);
  return groups;
}
const link = (doc, t, end) => el(doc, 'a', { class: end ? 'lk-tag lk-end' : 'lk-tag', href: '#', 'data-uuid': t.uuid, style: `--lk-n: ${[...String(t.title)].length}` }, t.title);
const asks = () => window.PluginDoor.runs('structure');
function held(doc, t, tagPage) {
  if (tagPage && !asks()) return link(doc, t);
  const words = tagPage ? `Take this tag out from under ${t.title}` : `Remove ${t.title} from this page`;
  return el(doc, 'span', { class: 'lk-held lk-own lk-reveals' }, link(doc, t), el(doc, 'span', { class: 'lk-x lk-reveal', role: 'button', tabindex: '0', title: words, 'aria-label': words, 'data-take': t.uuid }, '×'));
}
function build(doc, groups) {
  const parts = [];
  groups.forEach((path, n) => {
    if (n) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·'));
    path.chain.forEach((t, i) => { if (i) parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '/')); parts.push(i ? link(doc, t, i === path.chain.length - 1) : held(doc, t, groups.tagPage)); });
    path.others.forEach(t => { parts.push(el(doc, 'span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·')); parts.push(groups.tagPage ? held(doc, t, true) : link(doc, t)); });
  });
  return parts;
}
const keep = event => event.stopPropagation(); // the title is a block: a press in its row would put it in edit
const pageOf = box => box?.dataset.page ? { page: box.dataset.page, tagPage: box.dataset.tagPage === '1' } : null;
function open(event) {
  event.preventDefault(); event.stopPropagation();
  const own = pageOf(event.currentTarget);
  const x = event.target.closest('.lk-x');
  if (x) return takeOff(x.getAttribute('data-take'), own || { page: state.page, tagPage: state.tagPage }, x.closest('.lk-held')?.querySelector('a.lk-tag')?.textContent || 'The tag');
  const a = event.target.closest('a[data-uuid]');
  if (a) openPage(a.getAttribute('data-uuid'), event.shiftKey);
}
const press = event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.lk-x')) open(event); };
/* Where the Undo arrow of a tag taken off sits: at the right end of the page's title row, where the tag was; in the right sidebar,
   at the end of the page's line of tags, or of its name when no tag is left. With the page off screen it waits at the bottom right. */
function undoPlace(page) {
  const doc = host(), title = shownTitle(doc);
  if (title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') === page) { const row = title.querySelector('.is-page-title-row'); return row?.querySelector('.ls-block-right') || row; }
  for (const [item, box] of state.boxes) if (box.dataset.page === page && item.isConnected) return box.isConnected && box.childElementCount ? box : item.querySelector('.sidebar-item-header .page-title');
  return null;
}
// The × and its key take the tag off the same way, and leave the same faded Undo arrow every other change leaves (10 November 2026).
async function takeOff(tagUuid, { page, tagPage }, name = 'The tag') {
  if (!page || !tagUuid) return;
  try {
    if (tagPage) {
      if (await window.PluginDoor.ask('structure.takeOut', page, tagUuid) === window.PluginDoor.UNANSWERED) notify('Switch on Ontology to take a tag out of its place');
      return;
    }
    await Look.db.removeTag(page, tagUuid);
    setTimeout(() => Look.marks.load(), 300);
    window.PluginDoor.undo.offer({ owner: 'look', key: `look:${page}:${tagUuid}`, at: () => undoPlace(page), node: page, text: `${name} taken off this page`, cls: 'lk-undo-title',
      run: async () => { await Look.db.addTag(page, tagUuid); setTimeout(() => Look.marks.load(), 300); },
      onFail: error => { console.error('Look: a tag could not be put back', error); notify('The tag could not be put back', 'warning'); } });
  } catch (error) { console.error('Look: a tag could not be taken off', error); notify('The tag could not be taken off', 'warning'); }
}
function drawTitle(doc, index) {
  const title = shownTitle(doc);
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  const row = title?.querySelector('.is-page-title-row');
  const groups = uuid && row && setting('tagChain') ? groupsOf(index, uuid) : [];
  state.page = uuid; state.tagPage = !!groups.tagPage;
  if (!groups.length) { state.box?.remove(); state.box = null; return; }
  const spot = row.querySelector('.ls-block-right') || row;
  let box = state.box;
  if (!box || box.ownerDocument !== doc) { box = state.box = el(doc, 'div', { class: 'lk-path lk-own', click: open, keydown: press, mousedown: keep, pointerdown: keep }); }
  const key = JSON.stringify([uuid, groups.tagPage, groups]);
  if (box.dataset.key !== key) { box.dataset.key = key; box.dataset.page = uuid; box.dataset.tagPage = groups.tagPage ? '1' : ''; box.replaceChildren(...build(doc, groups)); }
  if (box.parentElement !== spot) spot.append(box);
}
function drawSidebar(doc, index) {
  const on = setting('tagChainSidebar'), seen = new Set();
  if (on) for (const item of doc.querySelectorAll(SIDEBAR_PAGE)) {
    const name = item.querySelector('.sidebar-item-header .page-title > span')?.textContent.trim();
    const pageEl = item.querySelector('.sidebar-panel-content .page');
    if (!name || !pageEl) continue;
    seen.add(item);
    const uuid = index.uuidByName(name);
    if (!uuid) continue;
    const groups = groupsOf(index, uuid);
    let box = state.boxes.get(item);
    if (!box) state.boxes.set(item, box = el(doc, 'div', { class: 'lk-path lk-path-sb lk-own', click: open, keydown: press, mousedown: keep, pointerdown: keep }));
    const key = JSON.stringify([uuid, groups.tagPage, groups]);
    if (box.dataset.key !== key) { box.dataset.key = key; box.dataset.page = uuid; box.dataset.tagPage = groups.tagPage ? '1' : ''; box.replaceChildren(...build(doc, groups)); }
    const spot = pageEl.querySelector('.ls-sidebar-page-properties');
    if (spot) { if (box.nextElementSibling !== spot) spot.before(box); }
    else { const inner = pageEl.querySelector('.page-inner') || pageEl; if (inner.firstElementChild !== box) inner.prepend(box); }
  }
  for (const [item, box] of state.boxes) if (!seen.has(item)) { box.remove(); state.boxes.delete(item); }
}
function draw(doc) { const index = Look.index; if (!index) return; drawTitle(doc, index); drawSidebar(doc, index); }
function start() { style('title', css); watchScreen(draw); }
function stop() { window.PluginDoor.undo.clear('look'); state.box?.remove(); state.box = null; for (const box of state.boxes.values()) box.remove(); state.boxes.clear(); }
Look.title = { start, stop, draw, groupsOf };
})();
