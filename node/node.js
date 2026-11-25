/* NODE: a node opened in place, and the lists of what points at a node.
   An opened node is Logseq's own editor for it (its words, its bullets, its properties, its menus, its Undo) with the lists of
   what points at it underneath, each row a line that opens in turn. Nothing of the node is drawn by the plugin.
     G.node.toggle(row), open(row), close(row)   a row of a list opened and closed in place
     G.node.listing(el, read, opts)              lists of nodes drawn into el and kept true while the graph changes. read() answers
                                                 [{ key, kind, name, tag, rows, face }] (a list with no name has no head; face 'tag' or
                                                 'prop' draws its rows' words as tags or properties are drawn); opts: press(row,
                                                 event) -> true when the place takes a press on a line itself, few (rows before Show
                                                 all), none (words to say when there is nothing), add(list) -> the uuid of a
                                                 node it made for a list's + , key(row, event) -> true when the place takes a key
                                                 on a line, more(row) -> the place's own lines for a row's menu. Gives back { off(), again() }
     G.node.adder(holder, name, add, failed)     a line at the head of holder that adds (a task, a tag); gives back what removes it
     G.node.lists(el, uuid)                      the listing of what points at a node; gives back what takes it away */
(function () {
const G = window.PluginDoor, L = G.lists, D = G.days, W = G.words;
const ARROW = '<svg viewBox="0 0 192 512" fill="currentColor" aria-hidden="true"><path d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"/></svg>';
const FOLDED = 'lk.folded';   // the lists the person keeps folded, by their key, kept across pages and restarts
const folded = (() => { let set = null; const read = () => { if (!set) { try { set = new Set(JSON.parse(G.host().defaultView.localStorage.getItem(FOLDED) || '[]')); } catch (error) { set = new Set(); } } return set; };
  return { has: key => read().has(key), flip(key) { const s = read(); if (!s.delete(key)) s.add(key); try { G.host().defaultView.localStorage.setItem(FOLDED, JSON.stringify([...s])); } catch (error) { /* kept for this session only */ } } }; })();

// ---- a node opened in place
let within = null, offKeys = null, count = 0;   // the opened node the person is in (its holder); what stops the keys being watched
/* What an opened node is made of, put into a holder of the plugin's: Logseq's own editor for the node, the nodes dug into from
   it, and what points at it under the word Relations.
   Digging: the arrow before a value that is a node opens that node under its value, one step in, in the same form: its own
   rows, the nodes dug into from it, its Relations. The dug node is the plugin's own element. It is never put inside Logseq's
   rows (Logseq throws away what it did not draw there): room is opened under the value's row by a style rule, and the node is
   laid into that room. Where the value has no row of its own, the node stands under the rows. */
function mount(holder, uuid) {
  const doc = holder.ownerDocument, view = doc.defaultView, k = String(++count);
  holder.dataset.k = k; holder.dataset.node = uuid;
  const rule = doc.createElement('style'), page = doc.createElement('div'), head = doc.createElement('div'), rel = doc.createElement('div');
  page.className = 'lk-editor'; head.className = 'lk-relhead'; head.textContent = 'Relations'; rel.className = 'lk-rel';
  holder.append(rule, page, head, rel);
  const dugs = new Map();   // the uuid of a value -> the holder of the node dug into
  const place = () => {
    if (!holder.isConnected) return;
    const wide = G.touch.names(page), col = wide ? Math.min(150, Math.max(56, wide)) + 'px' : '';
    if (page.style.getPropertyValue('--lk-keycol') !== col) page.style.setProperty('--lk-keycol', col);
    let css = '';
    for (const [value, dug] of dugs) {
      const seat = G.touch.seat(page, value);
      dug.classList.toggle('lk-flow', !seat);
      if (!seat) { dug.style.top = dug.style.left = ''; continue; }
      dug.style.top = Math.round(page.offsetTop + seat.top) + 'px'; dug.style.left = Math.round(page.offsetLeft + seat.left) + 'px';
      css += `.lk-open[data-k="${k}"] > .lk-editor ${seat.mark}::before { transform: rotate(90deg); background: var(--lk-text); }\n`;
      if (dug.dataset.whole) css += `.lk-open[data-k="${k}"] > .lk-editor ${seat.row} { margin-bottom: ${dug.offsetHeight}px !important; }\n`;   // room only once the node has come to rest: one move, not a stutter
    }
    if (rule.textContent !== css) rule.textContent = css;
  };
  const sized = view.ResizeObserver ? new view.ResizeObserver(() => place()) : null;
  sized?.observe(page);
  holder.lkPlace = place;
  const whole = G.touch.editor.whole(page, () => { holder.dataset.whole = '1'; place(); holder.parentElement?.closest('.lk-open')?.lkPlace?.(); });
  const offEditor = G.touch.editor.show(page, uuid), offLists = lists(rel, uuid);
  const undig = value => { const dug = dugs.get(value); if (!dug) return; dugs.delete(value); sized?.unobserve(dug); dug.lkOff?.(); dug.remove(); place(); };
  holder.lkDig = value => {
    if (dugs.has(value)) { undig(value); return; }
    const dug = doc.createElement('div'); dug.className = 'lk-open lk-dugopen';
    holder.insertBefore(dug, head); dugs.set(value, dug);
    mount(dug, value); dug.lkClose = () => undig(value);
    sized?.observe(dug); place(); within = dug;
    view.setTimeout(() => { if (dug.isConnected && !dug.dataset.whole) { dug.dataset.whole = '1'; place(); } }, 800);
  };
  holder.lkOff = () => { whole(); sized?.disconnect(); for (const dug of dugs.values()) dug.lkOff?.(); dugs.clear(); offEditor(); offLists(); };
}
function open(row) {
  if (row.dataset.open || !G.touch.editor.can()) { if (!row.dataset.open) G.touch.open(row.dataset.uuid); return; }
  const holder = row.ownerDocument.createElement('div'); holder.className = 'lk-open';
  row.appendChild(holder); row.dataset.open = 'soon';
  mount(holder, row.dataset.uuid);
  // Logseq fills the node in over a few frames (a link's name, a property's value): it is shown once it has come to rest.
  const shown = new (row.ownerDocument.defaultView.MutationObserver)(() => { if (holder.dataset.whole) { shown.disconnect(); if (row.dataset.open === 'soon') row.dataset.open = '1'; } });
  shown.observe(holder, { attributes: true, attributeFilter: ['data-whole'] });
  holder.lkClose = () => close(row, true);
  row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Close');
  within = holder;
}
function close(row, focus = false) {
  const holder = row.querySelector(':scope > .lk-open');
  if (!holder) return;
  for (const inner of holder.querySelectorAll('.lk-open')) inner.lkOff?.();
  holder.lkOff?.(); holder.remove(); delete row.dataset.open;
  row.dispatchEvent(new (row.ownerDocument.defaultView.CustomEvent)('lk-closed', { bubbles: true }));   // its line is read again at once: what was written in it shows without a wait
  row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Open');
  if (focus) row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true });
}
const toggle = row => row.dataset.open ? close(row, true) : open(row);
/* One step back in a place: closes the opened node the person is in there (else the one opened last), a node dug into before
   the node it was dug from. Says whether one was closed. */
function back(scope) {
  const holder = within?.isConnected && scope.contains(within) ? within : [...scope.querySelectorAll('.lk-open')].pop();
  if (!holder?.lkClose) return false;
  const up = holder.parentElement.closest('.lk-open');
  holder.lkClose(); within = up;
  return true;
}
/* Escape closes the opened node the person is in, one node at a time, innermost first. Inside it everything is Logseq's, so
   Logseq's own Escapes come first: the one that stops the writing is left to Logseq (a field has the focus), and the next one,
   pressed with nothing being written, closes the node. "In" is the node last opened, or where the last press or focus landed. */
function watchKeys(doc) {
  if (offKeys) return;
  const note = event => { within = event.target.closest?.('.lk-open') || null; };
  const onKey = event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const at = event.target, holder = within?.isConnected ? within : null;
    if (!holder || /^(TEXTAREA|INPUT|SELECT)$/.test(at.tagName) || at.isContentEditable || G.touch.busy()) return;
    back(doc);
  };
  doc.addEventListener('pointerdown', note, true); doc.addEventListener('focusin', note, true); doc.addEventListener('keydown', onKey, true);
  offKeys = () => { doc.removeEventListener('pointerdown', note, true); doc.removeEventListener('focusin', note, true); doc.removeEventListener('keydown', onKey, true); offKeys = null; within = null; };
}

// ---- the lists of what points at a node
const mounted = new Map();   // el -> state
const EVENTS = ['click', 'keydown', 'contextmenu', 'mousedown'];
let offChanged = null, offDigs = null;
function listing(el, read, opts = {}) {
  const state = { el, read, all: new Set(), turn: 0, press: opts.press || null, few: opts.few || 10, none: opts.none || '', add: opts.add || null, key: opts.key || null, more: opts.more || null };
  mounted.set(el, state);
  const onEvent = event => handle(state, event);
  for (const type of EVENTS) el.addEventListener(type, onEvent);
  const onClosed = event => { if (event.target.closest('.lk-rel') === el) { G.read.forget(); load(state); } };
  el.addEventListener('lk-closed', onClosed);
  watchKeys(el.ownerDocument);
  offDigs ||= G.touch.digs((editor, uuid) => { const holder = editor.parentElement; if (!holder?.lkDig) return false; holder.lkDig(uuid); return true; });
  offChanged ||= G.touch.changed(() => { for (const [one, s] of mounted) { if (!one.isConnected) mounted.delete(one); else load(s); } });
  load(state);
  return {
    again: () => load(state),
    off() {
      mounted.delete(el);
      for (const type of EVENTS) el.removeEventListener(type, onEvent);
      el.removeEventListener('lk-closed', onClosed);
      for (const row of el.querySelectorAll('.lk-row[data-open]')) close(row);
      el.replaceChildren();
      if (!mounted.size) { offChanged?.(); offChanged = null; offDigs?.(); offDigs = null; offKeys?.(); }
    },
  };
}
// What points at a node: its properties' lists, what Logseq's dates put on its day, where it is mentioned.
function lists(el, uuid) {
  return listing(el, async () => {
    const node = await G.read.node(uuid);
    if (!node) return [];
    const [pointing, dues] = await Promise.all([G.read.pointingAt(node.id), node.day ? G.read.dues(node.day) : []]);
    return L.lists({ ...pointing, dues, own: node.day || 0 });
  }, { add: async list => {
    const [tags, target] = await Promise.all([G.read.tags(), G.read.node(uuid)]), those = [...tags.values()].filter(tag => tag.title === list.one);
    if (those.length !== 1 || !target) throw new Error(`no one tag is called ${list.one}`);
    return G.write.addNode(those[0].uuid, list.prop.ident, target.id);
  } }).off;
}
async function load(state) {
  const turn = ++state.turn;
  try {
    const [made, statuses] = await Promise.all([state.read(), G.read.statuses()]);
    const names = await G.read.names(made.flatMap(list => list.rows.flatMap(row => W.named(W.firstLine(row.words).line))));
    if (turn !== state.turn || !state.el.isConnected) return;
    draw(state, made, names, statuses);
    state.el.dispatchEvent(new (state.el.ownerDocument.defaultView.CustomEvent)('lk-drawn'));
  } catch (error) {
    console.error('Logseq Plugin: a list of nodes could not be read', error);
  }
}
// Elements are kept by their key and only what changed is redrawn, so an opened row keeps its editor and the writing in it.
function sync(parent, wanted, keyOf, make, update) {
  const have = new Map([...parent.children].map(child => [child.dataset.key, child]));
  let prev = null;
  for (const item of wanted) {
    const key = keyOf(item);
    let child = have.get(key);
    if (child) have.delete(key); else { child = make(item); child.dataset.key = key; }
    update(child, item);
    const next = prev ? prev.nextElementSibling : parent.firstElementChild;
    if (next !== child) parent.insertBefore(child, next);
    prev = child;
  }
  // A row the person has open stays until they close it, even when the node no longer points here (they may have just changed that in it).
  for (const child of have.values()) if (!child.dataset.open) child.remove();
}
function draw(state, made, names, statuses) {
  const doc = state.el.ownerDocument, today = D.number(new Date());
  const wanted = made.length || !state.none ? made : [{ key: 'none', kind: 'none', name: state.none, rows: [] }];
  sync(state.el, wanted, list => list.key, () => {
    const box = doc.createElement('div'); box.className = 'lk-list';
    box.innerHTML = `<div class="lk-list-head" role="button" tabindex="0"><span class="lk-fold">${ARROW}</span><span class="lk-list-name"></span></div><div class="lk-rows"></div>`;
    return box;
  }, (box, list) => {
    const isFolded = folded.has(list.key), head = box.firstElementChild, rowsEl = box.children[1];
    head.setAttribute('aria-expanded', String(!isFolded));
    // The head says what the list is, how many it holds and of what, and from when to when; + adds one more of its kind.
    const said = list.said || list.tag || '';
    const name = `<span class="${list.kind === 'property' || list.kind === 'due' ? 'lk-prop' : list.kind === 'none' ? 'lk-none' : 'lk-plain'}">${G.esc(list.name)}</span>${said ? ` <span class="lk-tag">${G.esc(said)}</span>` : ''}`
      + (state.add && list.kind === 'property' && list.one ? `<button type="button" class="lk-plus" title="Add a ${G.esc(list.one)}" aria-label="Add a ${G.esc(list.one)}">${G.touch.icon('plus', 14)}</button>` : '')
      + (list.from ? `<span class="lk-span">${G.esc(D.short(list.from, today))} to ${G.esc(D.short(list.to, today))}</span>` : '');
    box.lkList = list;
    if (head.lastElementChild.innerHTML !== name) head.lastElementChild.innerHTML = name;
    head.hidden = !list.name; box.dataset.kind = list.kind; box.dataset.face = list.face || '';
    rowsEl.hidden = isFolded;
    const rows = L.shown(list.rows, state.all.has(list.key), state.few);
    const days = list.rows.some(row => row.dayShown), long = list.rows.some(row => row.dayShown && Math.floor(row.dayShown / 10000) !== Math.floor(today / 10000));
    box.style.setProperty('--lk-daycol', days ? (long ? '92px' : '56px') : '0px');
    sync(rowsEl, rows, row => row.uuid, () => {
      const el = doc.createElement('div'); el.className = 'lk-row';
      el.innerHTML = `<span class="lk-day"></span><button type="button" class="lk-fold" aria-label="Open">${ARROW}</button><div class="lk-line" role="button" tabindex="0"></div>`;
      return el;
    }, (el, row) => {
      el.dataset.uuid = row.uuid; el.dataset.status = row.status || ''; el.dataset.page = row.isPage ? '1' : '';
      el.style.setProperty('--lk-depth', String(row.depth || 0));   // an outline's row stands in by its depth
      const day = D.short(row.dayShown, today), dayEl = el.firstElementChild;
      if (dayEl.textContent !== day) dayEl.textContent = day;
      dayEl.title = day ? (row.dayFrom || 'The day it was written') : '';
      const html = G.line.html(row, { names, statuses, tagShown: row.tagShown }), line = el.children[2];
      if (line.lkHtml !== html) { line.innerHTML = html; line.lkHtml = html; }
    });
    let more = box.querySelector(':scope > .lk-more');
    if (rows.length < list.rows.length && !isFolded) {
      if (!more) { more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-more'; more.textContent = 'Show all'; box.appendChild(more); }
    } else more?.remove();
  });
}
/* + on a list's head: one more node of the list's kind, pointing here through the list's property. It is made on today's
   journal, shown in the list, opened in place, and the caret stands in it. */
async function addTo(state, box) {
  const list = box?.lkList, view = state.el.ownerDocument.defaultView;
  if (!list || !state.add || box.dataset.adding) return;
  box.dataset.adding = '1';
  try {
    const uuid = String(await state.add(list) || '').toLowerCase();
    for (let tries = 0; uuid && tries < 30; tries++) {
      const row = state.el.querySelector(`.lk-row[data-uuid="${uuid}"]`);
      if (row) { if (!row.dataset.open) open(row); const page = row.querySelector(':scope > .lk-open > .lk-editor'); if (page) G.touch.editor.whole(page, () => G.touch.edit(uuid)); break; }   // the caret as soon as Logseq has drawn the node
      await new Promise(done => view.setTimeout(done, 150));
    }
  } catch (error) { G.say(`It could not be added: ${error?.message || 'Logseq refused'}`, 'warning'); }
  delete box.dataset.adding;
}
function handle(state, event) {
  const target = event.target;
  if (!(target instanceof target.ownerDocument.defaultView.Element)) return;
  // Only what belongs to this node's lists: a nested node's lists handle their own.
  if (target.closest('.lk-rel') !== state.el) return;
  const row = target.closest('.lk-row');
  if (row && target.closest('.lk-open')?.closest('.lk-row') === row) return;   // inside the opened node everything is Logseq's
  if (event.type === 'mousedown') { if (event.shiftKey && target.closest('.lk-line')) event.preventDefault(); return; }   // Shift-click opens beside: it selects no words on its way
  if (row && event.type === 'click' && state.press && target.closest('.lk-line') && !target.closest('.lk-status, a[data-to], .lk-url') && state.press(row, event)) { event.stopPropagation(); return; }
  if (row && event.type === 'keydown' && state.key && target.matches('.lk-line') && state.key(row, event)) { event.preventDefault(); event.stopPropagation(); return; }
  if (row && G.line.act(event, row, state.more)) { event.stopPropagation(); return; }
  const plus = target.closest('.lk-plus');
  if (plus) { if (event.type === 'click') { event.preventDefault(); event.stopPropagation(); addTo(state, plus.closest('.lk-list')); } return; }
  const head = target.closest('.lk-list-head');
  if (head && head.parentElement.dataset.kind !== 'none' && (event.type === 'click' || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')))) {
    event.preventDefault(); event.stopPropagation(); folded.flip(head.parentElement.dataset.key); load(state); return;
  }
  if (event.type === 'click' && target.closest('.lk-more')) { state.all.add(target.closest('.lk-list').dataset.key); load(state); return; }
  if (event.type === 'keydown' && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && target.matches('.lk-line, .lk-list-head')) {
    const stops = [...state.el.querySelectorAll('.lk-line, .lk-list-head')].filter(el => el.closest('.lk-rel') === state.el && el.offsetParent);
    const next = stops[stops.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); event.stopPropagation(); next.focus(); }
  }
}
/* A line that adds: one field at the head of a place's list. Enter hands its words to add(words), which answers the uuid of what
   it made (or of what was there already); the list then moves to that row and lights it for a moment, while the field stays in
   view. Escape empties the field and lets go. Gives back what takes the line's ears away. */
function adder(holder, name, add, failed) {
  const doc = holder.ownerDocument, view = doc.defaultView, line = doc.createElement('div'); line.className = 'lk-add';
  line.innerHTML = `<input class="lk-field" type="text" placeholder="${G.esc(name)}" aria-label="${G.esc(name)}" spellcheck="true" autocomplete="off">`;
  holder.prepend(line);
  const field = line.firstElementChild;
  const show = (uuid, tries = 0) => {
    const row = uuid && holder.querySelector(`.lk-row[data-uuid="${uuid}"]`);
    if (!row) { if (tries < 20 && holder.isConnected) view.setTimeout(() => show(uuid, tries + 1), 150); return; }
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    row.classList.add('lk-new'); view.setTimeout(() => row.classList.remove('lk-new'), 1800);
  };
  const onKey = async event => {
    if (event.key === 'Escape') { field.value = ''; field.blur(); return; }
    if (event.key !== 'Enter' || !field.value.trim() || field.disabled) return;
    event.preventDefault(); event.stopPropagation();
    field.disabled = true;
    try { const uuid = await add(field.value.trim()); field.value = ''; show(String(uuid || '').toLowerCase()); }
    catch (error) { G.say(`${failed}: ${error?.message || 'Logseq refused'}`, 'warning'); }
    field.disabled = false; field.focus();
  };
  field.addEventListener('keydown', onKey);
  return () => { field.removeEventListener('keydown', onKey); line.remove(); };
}
G.node = { toggle, open, close, back, listing, lists, adder };
G.node.CSS = `
.lk-rel:empty { display: none; }
.lk-rel { display: flex; flex-direction: column; gap: 18px; container: lk-list / inline-size; }
.lk-list-head[hidden] { display: none; }
.lk-list[data-face="tag"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-tag-face); }
.lk-list[data-face="prop"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: .9em; letter-spacing: -.01em; }
.lk-list[data-kind="none"] .lk-fold { visibility: hidden; }
.lk-list-head { display: flex; align-items: center; gap: 2px; min-height: 28px; margin-left: -18px; cursor: default; border-radius: 6px; }
.lk-list-head:focus-visible { outline: none; background: var(--lk-wash); }
.lk-list-head .lk-fold { opacity: 0; margin-top: 0; }
.lk-list-head:hover .lk-fold, .lk-list-head:focus-visible .lk-fold, .lk-list-head[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-prop { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: .9em; letter-spacing: -.01em; color: var(--lk-quiet); }
.lk-plain { color: var(--lk-quiet); }
.lk-list-name { flex: 1; min-width: 0; display: flex; align-items: center; }
.lk-list-name .lk-tag { margin-left: .5em; font-size: var(--lk-small); }
.lk-span { margin-left: auto; padding-left: 12px; font-size: var(--lk-small); color: var(--lk-off); white-space: nowrap; font-variant-numeric: tabular-nums; }
.lk-plus { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: 4px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--lk-quiet); opacity: .55; cursor: pointer; }
.lk-plus:hover, .lk-plus:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
@container lk-list (max-width: 300px) { .lk-span { display: none; } }
.lk-more { margin: 2px 0 0 calc(var(--lk-daycol, 0px) + 34px); padding: 2px 0; border: 0; background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; }
.lk-more:hover { color: var(--lk-text); }
.lk-add { display: flex; margin: -4px 0 12px -22px; padding: 4px 0 0 22px; position: sticky; top: 0; z-index: 2; background: var(--lk-ground, transparent); }   /* stays in view while the list moves to what was added */
.lk-add:has(+ .lk-ask) { position: static; }   /* a box open under it: it scrolls away with the rest, and never floats over the box */
.lk-add .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-add .lk-field:focus { border-bottom-color: var(--lk-line); }
.lk-add .lk-field::placeholder { color: var(--lk-off); }
.lk-add ~ .lk-rel .lk-row { scroll-margin: 44px 0 8px; }
.lk-add ~ .lk-rel .lk-row > .lk-line { transition: background-color .6s ease; }
.lk-add ~ .lk-rel .lk-row.lk-new > .lk-line { background: var(--lk-lit); transition: none; }
.lk-open { margin-left: -2px; position: relative; }
/* The levels show: one soft band for the node opened from a row; a node dug into stands under the value it was reached
   through, its rows starting where the value's words start, with a guide line down from the value's arrow. It takes its room
   in one move, once Logseq has drawn it. */
.lk-row > .lk-open { background: color-mix(in srgb, var(--lk-text) 3.5%, transparent); border-radius: 6px; padding: 0 8px 6px 0; }
.lk-dugopen { position: absolute; right: 0; margin: 0; padding: 0 0 6px; opacity: 0; pointer-events: none; }
.lk-dugopen[data-whole] { opacity: 1; pointer-events: auto; transition: opacity .16s ease .04s; }
.lk-dugopen.lk-flow { position: relative; margin: 2px 0 6px 28px; }
.lk-dugopen::before { content: ""; position: absolute; left: -11px; top: 1px; bottom: 8px; width: 1px; background: var(--lk-line); }
/* What points at the node: under one word and a thin line, apart from the node's own rows. */
.lk-relhead { display: flex; align-items: center; gap: 10px; margin: 6px 0 0 22px; color: var(--lk-quiet); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-relhead::after { content: ""; flex: 1; height: 1px; background: var(--lk-hair); }
.lk-relhead:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-dugopen > .lk-relhead { margin-left: 0; }
.lk-row > .lk-open > .lk-rel { margin: 2px 0 6px 22px; }
.lk-dugopen > .lk-rel { margin: 2px 0 0; }`;
})();
