/* NODE: a node opened in place, and the lists of what points at a node.
   An opened node is Logseq's own editor for it (its words, its bullets, its properties, its menus, its Undo) with the lists of
   what points at it underneath, each row a line that opens in turn. Nothing of the node is drawn by the plugin.
     G.node.toggle(row), open(row), close(row)   a row of a list opened and closed in place
     G.node.lists(el, uuid)                      the lists of what points at a node, drawn into el and kept true while the graph
                                                 changes; gives back what takes them away */
(function () {
const G = window.PluginDoor, L = G.lists, D = G.days, W = G.words;
const ARROW = '<svg viewBox="0 0 192 512" fill="currentColor" aria-hidden="true"><path d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"/></svg>';
const FOLDED = 'lk.folded';   // the lists the person keeps folded, by their key, kept across pages and restarts
const folded = (() => { let set = null; const read = () => { if (!set) { try { set = new Set(JSON.parse(G.host().defaultView.localStorage.getItem(FOLDED) || '[]')); } catch (error) { set = new Set(); } } return set; };
  return { has: key => read().has(key), flip(key) { const s = read(); if (!s.delete(key)) s.add(key); try { G.host().defaultView.localStorage.setItem(FOLDED, JSON.stringify([...s])); } catch (error) { /* kept for this session only */ } } }; })();

// ---- a node opened in place
function open(row) {
  if (row.dataset.open || !G.touch.editor.can()) { if (!row.dataset.open) G.touch.open(row.dataset.uuid); return; }
  const doc = row.ownerDocument, holder = doc.createElement('div'); holder.className = 'lk-open';
  const page = doc.createElement('div'); page.className = 'lk-editor';
  const rel = doc.createElement('div'); rel.className = 'lk-rel';
  holder.append(page, rel); row.appendChild(holder); row.dataset.open = '1';
  row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Close');
  const offEditor = G.touch.editor.show(page, row.dataset.uuid), offLists = lists(rel, row.dataset.uuid);
  holder.lkOff = () => { offEditor(); offLists(); };
}
function close(row, focus = false) {
  const holder = row.querySelector(':scope > .lk-open');
  if (!holder) return;
  for (const inner of holder.querySelectorAll('.lk-open')) inner.lkOff?.();
  holder.lkOff?.(); holder.remove(); delete row.dataset.open;
  row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Open');
  if (focus) row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true });
}
const toggle = row => row.dataset.open ? close(row, true) : open(row);

// ---- the lists of what points at a node
const mounted = new Map();   // el -> state
let offChanged = null;
function lists(el, uuid) {
  const state = { el, uuid: String(uuid).toLowerCase(), all: new Set(), turn: 0 };
  mounted.set(el, state);
  const onEvent = event => handle(state, event);
  for (const type of ['click', 'keydown', 'contextmenu']) el.addEventListener(type, onEvent);
  offChanged ||= G.touch.changed(() => { for (const [one, s] of mounted) { if (!one.isConnected) mounted.delete(one); else load(s); } });
  load(state);
  return () => {
    mounted.delete(el);
    for (const type of ['click', 'keydown', 'contextmenu']) el.removeEventListener(type, onEvent);
    for (const row of el.querySelectorAll('.lk-row[data-open]')) close(row);
    el.replaceChildren();
    if (!mounted.size && offChanged) { offChanged(); offChanged = null; }
  };
}
async function load(state) {
  const turn = ++state.turn;
  try {
    const node = await G.read.node(state.uuid);
    const [pointing, dues, statuses] = node ? await Promise.all([G.read.pointingAt(node.id), node.day ? G.read.dues(node.day) : [], G.read.statuses()]) : [{ links: [], mentions: [] }, [], []];
    const made = L.lists({ ...pointing, dues });
    const names = await G.read.names(made.flatMap(list => list.rows.flatMap(row => W.named(W.firstLine(row.words).line))));
    if (turn !== state.turn || !state.el.isConnected) return;
    draw(state, made, names, statuses);
  } catch (error) {
    console.error('Logseq Plugin: what points at a node could not be read', error);
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
  sync(state.el, made, list => list.key, () => {
    const box = doc.createElement('div'); box.className = 'lk-list';
    box.innerHTML = `<div class="lk-list-head" role="button" tabindex="0"><span class="lk-fold">${ARROW}</span><span class="lk-list-name"></span></div><div class="lk-rows"></div>`;
    return box;
  }, (box, list) => {
    const isFolded = folded.has(list.key), head = box.firstElementChild, rowsEl = box.children[1];
    head.setAttribute('aria-expanded', String(!isFolded));
    const name = `<span class="${list.kind === 'mentions' ? 'lk-plain' : 'lk-prop'}">${G.esc(list.name)}</span>${list.tag ? ` <span class="lk-tag">${G.esc(list.tag)}</span>` : ''}`;
    if (head.lastElementChild.innerHTML !== name) head.lastElementChild.innerHTML = name;
    rowsEl.hidden = isFolded;
    const rows = L.shown(list.rows, state.all.has(list.key));
    const days = list.rows.some(row => row.day), long = list.rows.some(row => row.day && Math.floor(row.day / 10000) !== Math.floor(today / 10000));
    box.style.setProperty('--lk-daycol', days ? (long ? '92px' : '56px') : '0px');
    sync(rowsEl, rows, row => row.uuid, () => {
      const el = doc.createElement('div'); el.className = 'lk-row';
      el.innerHTML = `<span class="lk-day"></span><button type="button" class="lk-fold" aria-label="Open">${ARROW}</button><div class="lk-line" role="button" tabindex="0"></div>`;
      return el;
    }, (el, row) => {
      el.dataset.uuid = row.uuid; el.dataset.status = row.status || ''; el.dataset.page = row.isPage ? '1' : '';
      const day = D.short(row.day, today), dayEl = el.firstElementChild;
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
function handle(state, event) {
  const target = event.target;
  if (!(target instanceof target.ownerDocument.defaultView.Element)) return;
  // Only what belongs to this node's lists: a nested node's lists handle their own.
  if (target.closest('.lk-rel') !== state.el) return;
  const row = target.closest('.lk-row');
  if (row && target.closest('.lk-open') && target.closest('.lk-open').parentElement === row) {
    // Inside the opened node everything is Logseq's. Escape, once Logseq is no longer editing, closes the node.
    if (event.type === 'keydown' && event.key === 'Escape' && !/^(TEXTAREA|INPUT)$/.test(target.tagName) && !target.isContentEditable) { event.stopPropagation(); close(row, true); }
    return;
  }
  if (row && G.line.act(event, row)) { event.stopPropagation(); return; }
  const head = target.closest('.lk-list-head');
  if (head && (event.type === 'click' || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')))) {
    event.preventDefault(); folded.flip(head.parentElement.dataset.key); load(state); return;
  }
  if (event.type === 'click' && target.closest('.lk-more')) { state.all.add(target.closest('.lk-list').dataset.key); load(state); return; }
  if (event.type === 'keydown' && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && target.matches('.lk-line, .lk-list-head')) {
    const stops = [...state.el.querySelectorAll('.lk-line, .lk-list-head')].filter(el => el.closest('.lk-rel') === state.el && el.offsetParent);
    const next = stops[stops.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); next.focus(); }
  }
}
G.node = { toggle, open, close, lists };
G.node.CSS = `
.lk-rel:empty { display: none; }
.lk-rel { display: flex; flex-direction: column; gap: 18px; }
.lk-list-head { display: flex; align-items: center; gap: 2px; min-height: 28px; margin-left: -18px; cursor: default; border-radius: 6px; }
.lk-list-head:focus-visible { outline: none; background: var(--lk-wash); }
.lk-list-head .lk-fold { opacity: 0; margin-top: 0; }
.lk-list-head:hover .lk-fold, .lk-list-head:focus-visible .lk-fold, .lk-list-head[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-prop { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: .9em; letter-spacing: -.01em; color: var(--lk-quiet); }
.lk-plain { color: var(--lk-quiet); }
.lk-list-name .lk-tag { margin-left: .5em; font-size: var(--lk-small); }
.lk-more { margin: 2px 0 0 calc(var(--lk-daycol, 0px) + 34px); padding: 2px 0; border: 0; background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; }
.lk-more:hover { color: var(--lk-text); }
.lk-open { margin-left: -10px; }
.lk-open > .lk-rel { margin: 6px 0 10px 28px; }`;
})();
