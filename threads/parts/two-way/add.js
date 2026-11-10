/* The + line: adding a node from the page, with what it would get pencilled in under the line, a page's name completed
   in grey after the cursor, the where list, and the new node or page made through the model with its Undo.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, openEntity, notify, esc } = shared;
const { state, warnOnce } = twoWay;

/* Adding from the far end (the owner's pick of "Add only"): the + at the end of a row opens a small box,
   "New record · doctor: Dr. Mei Chen", with the kinds the row already holds (the most common chosen) and a name.
   Enter (or Add) makes the record with that name and tag and the field pointing at this page: a page of its own when
   most records in the row are pages (people, places), else a block on today's journal (visits, tests). Add and open
   also opens it in the sidebar to fill in. The bar at the bottom offers Undo, which removes what was made.
   Nothing is unlinked from here: a link is changed on the record that holds it. */
/* Adding a node from the page (the owner: "a line under each section that once upon hover a plus appears you
   can start typing. you hit enter, another logseq input appears about where if it is a node. otherwise it is just a
   page"). Under each row a quiet line; with the pointer on the row a + shows at its left and the words "Add a …".
   Typing there is the new node's name. Enter: where most of the linked nodes are pages, the page is made at once;
   otherwise a second field takes its place on the line, asking where it goes, with today's journal, this page and the
   pages matching what is typed as rows under it (the kit's pop-up); Enter takes the lit one. The tag it gets sits
   at the line's right in the tags' column, a click lists the others. Escape steps back, then drops it. The faded
   arrow by the row's name takes a made node away. */
const adding = { pop: null };
function closeAdd() { adding.pop?.close(); adding.pop = null; }
const pageTitleNow = () => twoWay.named.uuid === state.pageUuid && twoWay.named.title ? twoWay.named.title : 'this page';
function kindsOf(group) {
  const counts = new Map();
  for (const item of group.items) if (item.tag !== 'note') counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}
function draftFor(group) {
  if (state.draft?.field === group.name) return state.draft;
  const kinds = kindsOf(group);
  state.draft = { field: group.name, kinds, kind: kinds[0] || '', step: 'name', name: '', where: '', asPage: null, lit: 0, gkey: '', set: null, proposals: [], kept: null, quiet: false };
  twoWay.readTitle().catch(() => {});
  twoWay.provided.pagesAmong(group.items.map(item => item.uuid), twoWay.uuidsIn).then(pages => { if (state.draft?.field === group.name) state.draft.asPage = pages * 2 > group.items.length; }).catch(() => {});
  return state.draft;
}
function addLineHtml(group) {
  if (!group.ident) return '';
  const d = state.draft?.field === group.name ? state.draft : null;
  // The + in the gap under the row (the owner: "you can just have a plus in the gap that then open input"):
  // shown with the pointer on the row, it takes no room; the line comes only once it is clicked. A line begun from a
  // group's + is drawn in that group.
  if (!d || d.gkey) return '';
  return draftLineHtml(group, d);
}
function draftLineHtml(group, d) {
  const kind = d ? d.kind : kindsOf(group)[0] || '';
  const tag = `<a class="th-tag lk-tag th-tw-tag th-tw-draft-tag" href="#" data-draft="tag" title="The tag it gets (click for the others)">${kind ? esc(kind) : 'no tag'}</a>`;
  const field = d?.step === 'where'
    ? `<span class="th-tw-draft-typed">${esc(d.name)}</span><span class="th-field lk-field th-field-inline"><input type="text" class="th-tw-draft-field th-tw-draft-where" placeholder="Where? Enter: today’s journal" spellcheck="false" aria-label="Where the new node goes"></span>`
    : `<span class="th-field lk-field th-field-inline"><input type="text" class="th-tw-draft-field th-tw-draft-name" placeholder="Add a${/^[aeiou]/i.test(kind) ? 'n' : ''} ${esc(kind || 'node')}" spellcheck="false" aria-label="Name of a new node"></span>`;
  return `<div class="th-tw-draft th-tw-drafting" data-field="${esc(group.name)}"><span class="th-tw-draft-plus th-faint lk-i-plus" aria-hidden="true"></span><span class="th-tw-draft-main">${field}</span>${tag}<div class="th-tw-draft-props">${propsHtml(group, d)}</div></div>`;
}
/* The rest of the new node, under the line (the owner's pick):
   what the node will get, as the proposals read in a bullet, italic grey with a dotted line under a guess: the row's
   property pointing at this page and a group's value (set, never a proposal), then what the proposals' rules say for
   the words typed (a linked or named page, the nodes it looks like, the day), read through the core when the rules are
   loaded and nothing without them. Enter takes everything shown; a click on a guess keeps that one and lets the other
   guesses go (a second click lets go of it again); Escape clears them until something is typed again. The row keeps
   its height while the line is open, so proposals coming and going move nothing under them (as under a bullet). */
const pieceKey = piece => `${piece.ident}|${(piece.ids || []).join(',')}`;
function propsHtml(group, d) {
  if (!d) return '';
  const item = (title, shown) => `<span class="th-tw-dprop"><span class="th-tw-dname">${esc(title)}</span><span class="th-pencil th-pencil-taken">${esc(shown)}</span></span>`;
  const parts = [item(group.name, pageTitleNow())];
  if (d.set?.ident && d.set.text != null) parts.push(item(twoWay.groupName(twoWay.groupOf(group)), String(d.set.text)));
  if (!d.quiet) {
    const anyKept = d.kept && d.proposals.some(p => p.guess && d.kept.has(pieceKey(p)));
    for (const p of d.proposals) {
      const key = pieceKey(p), kept = !!d.kept?.has(key), passed = p.guess && anyKept && !kept;
      const tip = p.guess ? (kept ? 'Kept: Enter sets it. Click to let it go again' : 'A guess. Enter sets it; click to keep this one and let the other guesses go') : 'From the words: Enter sets it';
      parts.push(`<button type="button" class="th-tw-dprop th-tw-dpick" data-pkey="${esc(key)}" aria-pressed="${kept}" title="${esc(tip)}"><span class="th-tw-dname">${esc(p.title)}</span><span class="th-pencil${kept ? ' th-pencil-taken' : ' lk-pencil'}${passed ? ' th-tw-dpassed' : ''}">${esc(p.shown)}</span></button>`);
    }
  }
  return parts.join('');
}
function drawDraftProps() {
  const d = state.draft, group = d && state.groups.find(g => g.name === d.field);
  const box = group && state.box?.querySelector(`.th-tw-draft[data-field="${CSS.escape(d.field)}"] .th-tw-draft-props`);
  if (box) box.innerHTML = propsHtml(group, d);
}
// What Enter sets beyond the row's property: everything shown, or with a guess kept, the sure ones and the kept guesses.
function takenPieces(d) {
  if (!d || d.quiet) return [];
  const anyKept = d.kept && d.proposals.some(p => p.guess && d.kept.has(pieceKey(p)));
  return d.proposals.filter(p => !p.guess || !anyKept || d.kept.has(pieceKey(p)));
}
function keepPiece(key) {
  const d = state.draft, piece = d?.proposals.find(p => pieceKey(p) === key);
  if (!d) return;
  if (piece?.guess) { d.kept ||= new Set(); if (d.kept.has(key)) d.kept.delete(key); else d.kept.add(key); drawDraftProps(); }
  focusDraft();
}
// The proposals are asked for a moment after the typing pauses, the newest answer only, for the line still open.
const proposing = { timer: 0, version: 0 };
function proposeSoon(group) {
  if (!twoWay.provided.draftProposals) return;
  clearTimeout(proposing.timer);
  proposing.timer = setTimeout(() => proposeNow(group).catch(error => warnOnce('the new node’s proposals could not be worked out', error)), 250);
}
async function proposeNow(group) {
  const d = state.draft;
  if (!d || d.field !== group.name) return;
  const version = ++proposing.version, text = d.name;
  if (!text.trim()) { d.proposals = []; drawDraftProps(); return; }
  const page = await twoWay.model.getPage(state.pageUuid).catch(() => null);
  const set = [];
  if (page?.id && group.ident) set.push({ ident: group.ident, ids: [page.id] });
  if (d.set?.ident && (d.set.id != null || d.set.number != null)) set.push({ ident: d.set.ident, ids: [d.set.id ?? d.set.number] });
  const pieces = await twoWay.provided.draftProposals({ text, tag: d.kind || '', set, journalDay: d.asPage ? 0 : twoWay.todayNumber() });
  if (version !== proposing.version || state.draft !== d || d.name !== text) return;
  d.proposals = Array.isArray(pieces) ? pieces : [];
  drawDraftProps();
}
/* A page's name typed in a line of the rows (in the + line,  also in the line that writes a bullet into
   a node, idea 2 of the brainstorm of 2026-10-25): the rest of the name in grey after the cursor, laid over the box,
   through the suggested links' own reading when that part is loaded (the pages that would fill one of the tag's
   properties first: the new node's tag, or the opened node's); the Right arrow writes [[the page]] in the line.
   looking.key says which line the grey name is for ('draft', or 'node:' and the node's uuid), so it comes back on the
   same line when the rows are drawn again. */
const looking = { version: 0, boost: new Map(), hit: null, key: '' };
const lineKey = field => field.matches('.th-tw-draft-name') ? 'draft' : field.matches('.th-tw-node-field') ? `node:${field.dataset.uuid}` : '';
async function lookName(field, kind) {
  const inner = twoWay.provided.linkSuggestInner, key = lineKey(field);
  if (!inner?.suggestFor || !key) return clearGhost();
  const text = field.value, caret = field.selectionStart;
  if (caret !== field.selectionEnd || caret !== text.length) return clearGhost();
  const version = ++looking.version;
  state.pagesRead ||= await twoWay.provided.propPages().catch(() => []);
  let boost = null;
  if (inner.boostFor && kind) {
    if (!looking.boost.has(kind)) {
      const tag = state.pagesRead.find(p => p.isTag && p.lower === kind.toLowerCase());
      looking.boost.set(kind, tag ? inner.boostFor([tag.id], await twoWay.provided.propSchema(), state.pagesRead) : null);
    }
    boost = looking.boost.get(kind);
  }
  if (version !== looking.version || !field.isConnected || field.value !== text) return;
  const hit = inner.suggestFor(text, caret, state.pagesRead, { min: 3, boost });
  if (!hit || hit.after || !hit.ghost) return clearGhost();
  looking.hit = hit; looking.key = key;
  drawGhost(field, hit);
}
function drawGhost(field, hit) {
  const wrap = field.closest('.th-field');
  if (!wrap) return;
  let over = wrap.querySelector('.th-tw-ghost-over');
  if (!over) { wrap.insertAdjacentHTML('beforeend', '<span class="th-tw-ghost-over" aria-hidden="true"><span class="th-tw-ghost-typed"></span><span class="th-tw-ghost-rest"></span></span>'); over = wrap.lastElementChild; }
  const style = field.ownerDocument.defaultView.getComputedStyle(field);
  Object.assign(over.style, { left: field.offsetLeft + 'px', top: field.offsetTop + 'px', width: field.offsetWidth + 'px', height: field.offsetHeight + 'px', paddingLeft: style.paddingLeft, paddingTop: style.paddingTop, font: style.font, letterSpacing: style.letterSpacing, transform: `translateX(-${field.scrollLeft || 0}px)` });
  over.firstElementChild.textContent = field.value.slice(0, hit.end);
  over.lastElementChild.textContent = hit.ghost;
  if (hit.name) over.lastElementChild.setAttribute('data-name', hit.name); else over.lastElementChild.removeAttribute('data-name');
}
// After the rows are drawn again: the grey name back on its own line, if it is still the one typed in.
function keepGhost(field) {
  const hit = looking.hit;
  if (!hit || looking.key !== lineKey(field)) return;
  setTimeout(() => { if (looking.hit === hit && field.isConnected && field.value.length === hit.end) drawGhost(field, hit); }, 0);
}
function clearGhost() {
  looking.hit = null; looking.key = '';
  looking.version++;
  for (const over of state.box?.querySelectorAll('.th-tw-ghost-over') || []) over.remove();
}
// The Right arrow: the words become [[the page]], the caret after it. False when there is nothing to take here.
function takeGhost(field) {
  const hit = looking.hit, value = field.value;
  if (!hit || looking.key !== lineKey(field) || field.selectionStart !== value.length) return false;
  const next = value.slice(0, hit.start) + `[[${hit.title}]]` + value.slice(hit.end);
  field.value = next;
  field.setSelectionRange(next.length, next.length);
  clearGhost();
  if (field.matches('.th-tw-node-field')) state.nodeDraft = { uuid: field.dataset.uuid, text: next };
  else if (state.draft) {
    state.draft.name = next;
    const group = state.groups.find(g => g.name === state.draft.field);
    if (group) proposeSoon(group);
  }
  return true;
}
// Leaving the line takes the grey name away (a line drawn again in its place is not a leaving: the old one is gone).
const leaveGhost = field => setTimeout(() => { if (field.isConnected && looking.key === lineKey(field) && field.ownerDocument.activeElement !== field) clearGhost(); }, 0);
// The tag of a node listed in the rows, by its uuid ('' for none).
const tagOfNode = uuid => { for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return item.tag && item.tag !== 'note' ? item.tag : ''; return ''; };
async function journalPageFor(day) {
  return twoWay.provided.journalIdFor(day);
}
// The line is drawn again with the rows; what was typed and the caret come back with it.
function keepDraft(box) {
  for (const field of box.querySelectorAll('.th-tw-draft-field')) {
    const line = field.closest('.th-tw-draft'), group = state.groups.find(g => g.name === line.dataset.field);
    const d = state.draft?.field === line.dataset.field ? state.draft : null;
    if (d) field.value = field.matches('.th-tw-draft-where') ? d.where : d.name;
    // The grey name comes back with the line: the rows are drawn again now and then while the line is open.
    if (d && field.matches('.th-tw-draft-name')) keepGhost(field);
    field.addEventListener('focus', () => { if (group && state.draft?.field !== group.name) { closeAdd(); draftFor(group); twoWay.draw(host()); focusDraft(); } else if (field.matches('.th-tw-draft-where')) whereList(field); });
    field.addEventListener('input', () => {
      const now = state.draft?.field === line.dataset.field ? state.draft : group && draftFor(group);
      if (!now) return;
      if (field.matches('.th-tw-draft-where')) { now.where = field.value; now.lit = 0; now.moved = true; whereList(field); }
      else { now.name = field.value; now.quiet = false; if (group) proposeSoon(group); lookName(field, now.kind).catch(() => {}); }
    });
    field.addEventListener('keydown', onDraftKey);
    field.addEventListener('blur', () => leaveGhost(field));
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
function focusDraft() {
  const d = state.draft;
  const field = d && state.box?.querySelector(`.th-tw-draft[data-field="${CSS.escape(d.field)}"] .th-tw-draft-field`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
function dropDraft() { state.draft = null; closeAdd(); twoWay.draw(host()); }
function onDraftKey(event) {
  event.stopPropagation();
  if (event.isComposing) return;
  const d = state.draft, onWhere = event.target.matches('.th-tw-draft-where');
  if (event.key === 'Escape') {
    event.preventDefault();
    if (onWhere) { d.step = 'name'; d.where = ''; closeAdd(); twoWay.draw(host()); focusDraft(); }
    else if (looking.hit && looking.key === 'draft') clearGhost();
    else if (d?.proposals.length && !d.quiet) { d.quiet = true; drawDraftProps(); }
    else { dropDraft(); event.target.blur?.(); }
  } else if (!onWhere && event.key === 'ArrowRight') {
    if (takeGhost(event.target)) event.preventDefault();
  } else if (!onWhere && ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    clearGhost();
  } else if (onWhere && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const rows = adding.pop?.body.querySelectorAll('.th-item').length || 0;
    if (rows) { d.moved = true; d.lit = (d.lit + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows; adding.pop.lit(d.lit); }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (!d?.name.trim()) return;
    if (onWhere) { const lit = adding.pop?.body.querySelectorAll('.th-item')[d.lit]; return makeDraft(lit?.item?.act || 'journal', event.metaKey || event.ctrlKey); }
    // From a group's +: no question where, today's journal (a page of its own where the nodes are pages).
    if (d.gkey) return makeDraft(d.asPage ? 'page-itself' : 'journal', event.metaKey || event.ctrlKey);
    if (d.asPage) return makeDraft('page-itself', event.metaKey || event.ctrlKey);
    d.step = 'where'; d.lit = 0; d.moved = false; if (d.lastWhere?.startsWith('page:')) d.where = d.lastWhere.slice(5); clearGhost();
    twoWay.draw(host()); focusDraft();
  }
}
// The rows under the where field: today's journal, this page, then the pages that match what is typed.
async function whereList(field) {
  const d = state.draft;
  if (!d || d.step !== 'where' || !field.isConnected) return;
  state.pagesRead ||= await twoWay.provided.propPages().catch(() => []);
  if (state.draft !== d || !field.isConnected) return;
  const q = d.where.trim().toLowerCase();
  const rows = [['journal', 'Today’s journal', 'date'], ['here', pageTitleNow(), 'page']].filter(([, text]) => !q || text.toLowerCase().includes(q));
  if (q) for (const p of state.pagesRead.filter(p => p.lower.includes(q) && p.uuid !== state.pageUuid).sort((a, b) => (b.lower.startsWith(q) - a.lower.startsWith(q)) || a.lower.length - b.lower.length).slice(0, 6)) rows.push(['page:' + p.title, p.title, 'page']);
  // The place chosen for the node before, lit until the arrows or typing move the light.
  if (d.lastWhere && !d.moved) { const at = rows.findIndex(([act]) => act === d.lastWhere); if (at >= 0) d.lit = at; }
  d.lit = Math.min(d.lit, Math.max(0, rows.length - 1));
  const items = rows.length ? rows.map(([act, text, name]) => ({ icon: name, label: text, act, run: item => makeDraft(item.act, false) })) : [{ note: 'No page by that name' }];
  if (!adding.pop || adding.pop.isClosed) adding.pop = shared.popup({ at: field.closest('.th-field') || field, manual: true, cls: 'th-two-way-add', width: 260, items, onClose: () => { adding.pop = null; } });
  else adding.pop.items(items);
  if (rows.length) adding.pop.lit(d.lit);
  if (field.isConnected && field.ownerDocument.activeElement !== field) field.focus({ preventScroll: true });   // the list opening takes the keyboard, and keys would reach Logseq's shortcuts
}
async function makeDraft(target, open) {
  const d = state.draft, group = d && state.groups.find(g => g.name === d.field);
  if (!group) return dropDraft();
  const name = d.name.trim();
  if (!name) return focusDraft();
  if (d.making) return;   // Enter twice makes one
  d.making = true;
  const page = await twoWay.model.getPage(state.pageUuid).catch(() => null);
  if (!page?.id) { d.making = false; return notify('This page could not be read, so nothing was added', 'warning'); }
  const asPage = target === 'page-itself';
  const where = asPage || target === 'journal' ? 'journal' : target === 'here' ? 'here' : 'page';
  const other = where === 'page' ? target.slice(5) : '';
  const again = { kind: d.kind, gkey: d.gkey, set: d.set, lastWhere: asPage ? '' : target };
  dropDraft();
  let made = false;
  try { made = await addRecord({ group, page, name, kind: d.kind, open, asPage, where, other, set: d.set, pieces: takenPieces(d) }) === true; }
  catch (error) { warnOnce('could not add the new node', error); notify('The new node could not be added', 'warning'); }
  // The line stays open for the next one (idea 5 of the brainstorm of 2026-10-25): empty, in the same place,
  // with the same tag and group, the place chosen last lit in the where step. Not after Cmd-Enter, which opens the new
  // node in the sidebar; Escape on the empty line closes it, as before.
  if (made && !open && state.groups.some(g => g.name === group.name)) openAgain(group, again);
}
function openAgain(group, { kind, gkey, set, lastWhere }) {
  closeAdd(); state.draft = null;
  const d = draftFor(group);
  Object.assign(d, { kind, gkey, set, lastWhere });
  if (gkey) twoWay.setOpen(gkey, true);
  state.html = null; twoWay.draw(host()); focusDraft();
}
// The other tags, under the tag at the line's right: the kit's pop-up, the one in force ticked.
function tagList(anchor) {
  const line = anchor.closest('.th-tw-draft'), group = state.groups.find(g => g.name === line?.dataset.field);
  if (!group) return;
  closeAdd();
  const d = draftFor(group);
  twoWay.draw(host());
  const at = state.box?.querySelector(`.th-tw-draft[data-field="${CSS.escape(d.field)}"] .th-tw-draft-tag`) || anchor;
  adding.pop = shared.popup({ at, cls: 'th-two-way-add', width: 200, onClose: () => { adding.pop = null; },
    items: [...d.kinds, ''].map(k => ({ icon: k ? 'tag' : null, label: k || 'no tag', faint: !k, chosen: k === d.kind, run: () => { d.kind = k; twoWay.draw(host()); focusDraft(); } })) });
}
async function addRecord({ group, page, name, kind, open, asPage, where = 'journal', other = '', edit = false, set = null, pieces = [] }) {
  // A page in the Recycle still answers to its name, and "making" that name hands it back still in the Recycle: it is brought back instead.
  const named = asPage ? await twoWay.model.getPage(name).catch(() => null) : null, recycled = named?.uuid ? await twoWay.model.inRecycle(String(named.uuid)).catch(() => false) : false;
  if (named && !recycled) return notify(`A page named “${name}” already exists, so nothing was added`, 'warning');
  const prop = (await twoWay.provided.propSchema()).props.find(p => p.ident === group.ident);
  let tagUuid = '';
  if (kind) {
    tagUuid = await twoWay.provided.tagUuidNamed(kind);
  }
  let block, undo;
  if (asPage) {
    if (recycled) { await twoWay.model.restorePage(String(named.uuid)); block = named; }
    else block = await twoWay.model.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!block?.uuid) throw new Error('the page was not made');
    // By its id (10 November 2026): the door deletes by the uuid, and by the name only once the name is seen to answer to this very page.
    undo = async () => { await twoWay.model.deletePage(String(block.uuid)); twoWay.later(300); };
    // A page made now is not in the look-up of every page: it has no rows of its own yet.
    state.byPage.set(String(block.uuid), []);
  } else {
    // Where it goes: today's journal, this page, or another page named in the box (an existing one only).
    let target = '';
    if (where === 'here') target = String(page.uuid);
    else if (where === 'page') {
      const found = (await twoWay.provided.propPages()).find(p => p.lower === other.toLowerCase()) || await twoWay.model.getPage(other).catch(() => null);
      if (!found?.uuid || await twoWay.model.inRecycle(String(found.uuid))) return notify(`There is no page named “${other}”, so nothing was added`, 'warning');
      target = String(found.uuid);
    } else {
      const journalId = await twoWay.provided.journalIdFor(twoWay.todayNumber());
      target = journalId ? String(await twoWay.provided.uuidById(journalId)) : '';
      if (!target) throw new Error('no journal page for today');
    }
    block = await twoWay.model.appendBlock(target, name);
    if (!block?.uuid) throw new Error('the block was not made');
    undo = async () => { await twoWay.model.removeBlock(block.uuid); twoWay.later(300); };
  }
  try {
    if (tagUuid) await twoWay.model.addTag(block.uuid, tagUuid);
    if (prop?.many) await twoWay.model.setValue(block.uuid, group.ident, [page.id], { entityId: true, reset: true });
    else await twoWay.model.setValue(block.uuid, group.ident, page.id, { entityId: true });
    if (set?.ident) await twoWay.setGroupValue(block.uuid, set);
  } catch (error) { await undo().catch(() => {}); throw error; }
  // The proposals shown under the line, each on its own: one that fails leaves the node made, and says so.
  const filled = [];
  for (const piece of pieces) {
    try {
      if (piece.kind === 'day') await twoWay.model.setValue(block.uuid, piece.ident, piece.journalId ?? await journalPageFor(piece.day));
      else if (piece.kind === 'number') await twoWay.model.setValue(block.uuid, piece.ident, piece.ids[0]);
      else if (piece.many) await twoWay.model.setValue(block.uuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await twoWay.model.setValue(block.uuid, piece.ident, piece.ids[0], { entityId: true });
      filled.push(piece.title);
    } catch (error) { warnOnce(`“${piece.title}” could not be filled in on the new node`, error); notify(`“${piece.title}” could not be filled in on the new node`, 'warning'); }
  }
  twoWay.later(300);
  await twoWay.offerMade(String(block.uuid), `Added “${name}”${kind ? ` (${kind})` : ''}${asPage ? ' as a page' : where === 'here' ? ' to this page' : where === 'page' ? ` to ${other}` : ' to today’s journal'}${filled.length ? `, with ${filled.join(', ')}` : ''}`, undo, group.name, null, asPage);
  if (open) openEntity(block.uuid, true);
  // Into its words at once: the sidebar draws it a moment after it opens.
  if (edit && !asPage) { const uuid = block.uuid; window.Threads.core.screen.waitFor(() => host().querySelector(`#right-sidebar .ls-block[blockid="${uuid}"]`), 3000).then(found => found && twoWay.model.editBlock(uuid, { pos: 0 })).catch(error => warnOnce('the new record could not be put in edit', error)); }
  return true;
}

Object.assign(twoWay, { addLineHtml, adding, clearGhost, closeAdd, draftFor, draftLineHtml, focusDraft, keepDraft, keepGhost, keepPiece, kindsOf, leaveGhost, lineKey, lookName, looking, tagList, tagOfNode, takeGhost });
})();
