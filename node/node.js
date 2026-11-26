/* NODE: a node opened in place, and the lists of what points at a node.
   An opened node is Logseq's own editor for it (its words, its bullets, its properties, its menus, its Undo) with the lists of
   what points at it underneath, each row a line that opens in turn. Nothing of the node is drawn by the plugin.
     G.node.toggle(row), open(row), close(row)   a row of a list opened and closed in place
     G.node.listing(el, read, opts)              lists of nodes drawn into el and kept true while the graph changes. read() answers
                                                 [{ key, kind, name, tag, rows, face }] (a list with no name has no head; face 'tag' or
                                                 'prop' draws its rows' words as tags or properties are drawn); opts: press(row,
                                                 event) -> true when the place takes a press on a line itself, few (rows before Show
                                                 all), none (words to say when there is nothing), add: true where a property's
                                                 list has a + that opens the line to type a new node in (node/add.js), key(row, event) -> true when the place takes a key
                                                 on a line, more(row) -> the place's own lines for a row's menu. Gives back { off(), again() }
     G.node.adder(holder, name, add, failed)     a line at the head of holder that adds (a task, a tag); gives back what removes it
     G.node.lists(el, uuid)                      the listing of what points at a node; gives back what takes it away */
(function () {
const G = window.PluginDoor, L = G.lists, D = G.days, W = G.words;
const ARROW = '<svg viewBox="0 0 192 512" fill="currentColor" aria-hidden="true"><path d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"/></svg>';
// The thin arrow Relations' heads had before the rebuild: on the section's line, a list's head and a group's line.
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"/></svg>';
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
  const tagRule = doc.createElement('style');
  holder.append(rule, tagRule, page, head, rel);
  // After a value that is a node, what that node is: its tag, as a line says it (before 0.9; the owner, 25 November 2026). Said
  // by a rule of this holder's own, so nothing is put into Logseq's rows.
  let saidFor = '';
  const sayTags = async () => {
    const uuids = G.touch.valued(page), key = uuids.join(' ');
    if (key === saidFor) return;
    saidFor = key;
    const nodes = (await Promise.all(uuids.map(one => G.read.node(one)))).filter(Boolean), lines = await G.read.describe(nodes.map(node => node.id));
    if (key !== saidFor || !holder.isConnected) return;
    tagRule.textContent = G.touch.valueTags(nodes.map(node => [node.uuid, lines.get(node.id)?.tag]).filter(([, tag]) => tag));
  };
  const dugs = new Map();   // the uuid of a value -> the holder of the node dug into
  const place = () => {
    if (!holder.isConnected) return;
    const wide = G.touch.names(page), col = wide ? Math.min(150, Math.max(56, wide)) + 'px' : '';
    if (page.style.getPropertyValue('--lk-keycol') !== col) page.style.setProperty('--lk-keycol', col);
    sayTags();
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
/* An opened node rolls out of its line: from the line's height to its own, in one short move, and nothing is held once it is
   there (the owner's pages of 25 November 2026: "Rolls out of its line"). Not where the person asks for less motion. */
function roll(holder, from) {
  const view = holder.ownerDocument.defaultView, full = holder.offsetHeight;
  if (!full || full <= from + 4 || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const done = () => { holder.style.height = ''; holder.style.overflow = ''; holder.style.transition = ''; holder.removeEventListener('transitionend', done); view.clearTimeout(cap); };
  const cap = view.setTimeout(done, 400);
  holder.style.height = `${from}px`; holder.style.overflow = 'hidden';
  void holder.offsetHeight;
  holder.style.transition = 'height .16s ease-out'; holder.style.height = `${full}px`;
  holder.addEventListener('transitionend', done);
}
function open(row) {
  if (row.dataset.open || !G.touch.editor.can()) { if (!row.dataset.open) G.touch.open(row.dataset.uuid); return; }
  const holder = row.ownerDocument.createElement('div'); holder.className = 'lk-open';
  row.appendChild(holder); row.dataset.open = 'soon';
  mount(holder, row.dataset.uuid);
  // Logseq fills the node in over a few frames (a link's name, a property's value): it is shown once it has come to rest.
  const shown = new (row.ownerDocument.defaultView.MutationObserver)(() => { if (holder.dataset.whole) { shown.disconnect(); if (row.dataset.open === 'soon') { const from = row.querySelector(':scope > .lk-line')?.offsetHeight || 28; row.dataset.open = '1'; roll(holder, from); } } });
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
  const state = { el, read, all: new Set(), turn: 0, hits: 0, draft: null, press: opts.press || null, few: opts.few || 10, none: opts.none || '', add: !!opts.add, key: opts.key || null, more: opts.more || null, view: opts.view || null, last: null };
  state.redraw = () => { if (state.last && el.isConnected) draw(state, ...state.last); };
  state.again = () => load(state);
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
      G.adding.drop(state, false);
      el.replaceChildren();
      if (!mounted.size) { offChanged?.(); offChanged = null; offDigs?.(); offDigs = null; offKeys?.(); }
    },
  };
}
/* What points at a node: its properties' lists, what Logseq's dates put on its day, where it is mentioned. Each list is shown
   as its View says (node/view.js), in the order the person gave the page's lists. Gives back the listing's handle with
   find(words), which narrows every list to the words and turns them back to a day ("on Oct 7"), and rows(), how many nodes
   the lists hold. */
function related(el, uuid) {
  const view = G.listview.state(uuid);
  let total = 0;
  const handle = listing(el, async () => {
    const node = await G.read.node(uuid);
    if (!node) return [];
    view.own = node.day || 0;
    const [pointing, dues] = await Promise.all([G.read.pointingAt(node.id), node.day ? G.read.dues(node.day) : []]);
    const hidden = new Set(G.listview.hidden()), named = G.listview.named();
    const made = L.lists({ ...pointing, dues, own: node.day || 0 }).filter(list => !(list.kind === 'property' && hidden.has(list.prop.ident)));
    const said = made.filter(list => list.kind === 'mentions').flatMap(list => list.rows.map(row => row.id));
    const [held, sits] = await Promise.all([G.read.held(made.flatMap(list => list.rows.map(row => row.id))), G.read.where(said)]);
    const types = Object.fromEntries([...(await G.read.schema()).props.values()].map(prop => [prop.title, prop.type]));
    for (const list of made) {
      list.types = types; list.own_name = list.prop?.title || '';
      if (list.kind === 'property') list.name = G.reads.back(list.prop.title, named);   // read from this end: "Prescribed by" is "Prescribed" here
      list.rows = list.rows.map(row => ({ ...row, held: held.get(row.id) || {}, where: list.kind === 'mentions' && !row.isPage ? (sits.get(row.id) || []) : [] }));
    }
    total = made.reduce((n, list) => n + list.rows.length, 0);
    return G.view.ordered(made, G.listview.order(uuid));
  }, { view, few: 10, add: true });
  const offDrags = G.listview.drags(mounted.get(el));
  return { ...handle, off() { offDrags(); handle.off(); }, rows: () => total, day: () => view.own, find(words) { view.find = G.view.parse(words, D.number(new Date())); mounted.get(el)?.redraw(); } };
}
const lists = (el, uuid) => related(el, uuid).off;
async function load(state) {
  const turn = ++state.turn;
  try {
    const [made, statuses] = await Promise.all([state.read(), G.read.statuses()]);
    const names = await G.read.names(made.flatMap(list => list.rows.flatMap(row => W.named(W.firstLine(row.words).line))));
    if (turn !== state.turn || !state.el.isConnected) return;
    state.last = [made, names, statuses];
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
  state.hits = 0;   // how many found nodes say where they were found, this drawing
  const wanted = made.length || !state.none ? made : [{ key: 'none', kind: 'none', name: state.none, rows: [] }];
  sync(state.el, wanted, list => list.key, () => {
    const box = doc.createElement('div'); box.className = 'lk-list';
    box.innerHTML = `<div class="lk-list-head" role="button" tabindex="0"><span class="lk-fold">${ARROW}</span><span class="lk-list-via"></span><span class="lk-list-name"></span></div><div class="lk-rows"></div>`;
    return box;
  }, (box, list) => {
    const isFolded = folded.has(list.key), head = box.firstElementChild, rowsEl = box.querySelector(':scope > .lk-rows');
    head.setAttribute('aria-expanded', String(!isFolded));
    /* The head says what the list is, how many it holds and of what, and from when to when; + adds one more of its kind.
       A property's list has its head on two lines, as the plugin before the rebuild drew it (the owner, 25 November 2026: "I
       prefer the two line of oriiginal"): the property's mark and name on the first, and under it the count with its kind in
       the words' own face, the + and the days. A list of one node has nothing to count, so its head is the first line alone. */
    const said = list.said || list.tag || '', via = list.kind === 'property', made = G.listview.shape(state, list, names, today);
    const plus = state.add && via ? `<button type="button" class="lk-plus" title="Add a ${G.esc(list.one || 'node')}" aria-label="Add a ${G.esc(list.one || 'node')}">${G.touch.icon('plus', 14)}</button>` : '';   // on a list of several kinds too: the new node gets the kind most of them are
    const span = list.from ? `<span class="lk-span">${G.esc(D.short(list.from, today))} to ${G.esc(D.short(list.to, today))}</span>` : '';
    const lined = via || (made && list.count);   // two lines: what the list is, then what it holds
    const first = lined ? `${via ? G.touch.icon('hierarchy', 13) : ''}<span class="${via || list.kind === 'due' ? 'lk-prop' : 'lk-plain'}">${G.esc(list.name)}</span>${list.count ? '' : plus}` : '';
    const name = made && list.count ? G.listview.head(state, list, made, plus, today) : via ? (list.count ? `<span class="lk-said">${G.esc(list.tag ? said : `${said} nodes`)}</span>${plus}${span}` : '')
      : `<span class="${list.kind === 'due' ? 'lk-prop' : list.kind === 'none' ? 'lk-none' : 'lk-plain'}">${G.esc(list.name)}</span>${said ? ` <span class="lk-tag">${G.esc(said)}</span>` : ''}${span}`;
    if (head.children[1].innerHTML !== first) head.children[1].innerHTML = first;
    if (made && !head.dataset.thin) { head.dataset.thin = '1'; head.firstElementChild.innerHTML = CHEV; }
    if (made) head.children[1].draggable = true;   // a list's name dragged among the page's lists sets their order
    head.toggleAttribute('data-one', !!lined && !list.count); head.toggleAttribute('data-plain', !!lined && !via);
    box.lkList = list;
    if (head.lastElementChild.innerHTML !== name) head.lastElementChild.innerHTML = name;
    head.hidden = !list.name; box.dataset.kind = list.kind; box.dataset.face = list.face || '';
    rowsEl.hidden = isFolded;
    const items = made ? G.listview.items(state, list, made, state.few) : L.shown(list.rows, state.all.has(list.key), state.few).map(row => ({ type: 'row', key: row.uuid, row }));
    const hidden = made ? (items.hidden || 0) : list.rows.length - items.length;
    const dated = items.filter(item => item.type === 'row' && item.row.dayShown), long = dated.some(item => Math.floor(item.row.dayShown / 10000) !== Math.floor(today / 10000));
    box.style.setProperty('--lk-daycol', made ? '0px' : dated.length ? (long ? '92px' : '56px') : '0px');   // a list of Relations has the day after the bullet, inside the line
    box.style.setProperty('--lk-dayin', long ? '90px' : '54px');
    box.toggleAttribute('data-picking', !!made?.picking);
    box.toggleAttribute('data-viewed', !!made);
    sync(rowsEl, items, item => item.key, item => {
      if (item.type === 'draft') return G.adding.el(state);
      const el = doc.createElement(item.type === 'more' ? 'button' : 'div');
      if (item.type !== 'row') return el;
      el.className = 'lk-row';
      // In a list of Relations a row's arrow is the thin one its head has, as before the rebuild; elsewhere Logseq's own.
      el.innerHTML = `<span class="lk-day"></span><button type="button" class="lk-fold${made ? ' lk-fold-thin' : ''}" aria-label="Open">${made ? CHEV : ARROW}</button><div class="lk-line" role="button" tabindex="0"></div>`;
      return el;
    }, (el, item) => {
      if (item.type === 'draft') return;
      if (item.type !== 'row') { G.listview.paint(el, item, today); return; }
      const row = item.row;
      el.dataset.uuid = row.uuid; el.dataset.status = row.status || ''; el.dataset.page = row.isPage ? '1' : '';
      el.classList.toggle('lk-faint', !!item.faint); el.classList.toggle('lk-fresh', !!(state.view?.since && (row.made || 0) > state.view.since)); el.classList.toggle('lk-picked', !!item.picked);
      el.style.setProperty('--lk-depth', String(row.depth || 0));   // an outline's row stands in by its depth
      const day = D.short(row.dayShown, today), dayEl = el.firstElementChild;
      if (dayEl.textContent !== day) dayEl.textContent = day;
      dayEl.classList.toggle('lk-late', !!(day && row.late));
      dayEl.title = day ? (row.dayFrom || 'The day it was written') : '';
      let tick = el.querySelector(':scope > .lk-tick');
      if (item.picking) { if (!tick) { tick = doc.createElement('input'); tick.type = 'checkbox'; tick.className = 'lk-tick'; tick.setAttribute('aria-label', 'Pick this node'); el.insertBefore(tick, el.children[1]); } tick.checked = !!item.picked; } else tick?.remove();
      const want = made?.finding ? G.find.tokens(state.view.find.words) : [];
      const html = G.line.html(row, { names, statuses, tagShown: row.tagShown, day: made && dated.length ? day : undefined }) + (want.length ? `<!--${G.esc(want.join(' '))}-->` : ''), line = el.querySelector(':scope > .lk-line');
      if (made) line.draggable = true;   // onto another list's head: the node gets that list's property
      if (line.lkHtml !== html) { line.innerHTML = html; line.lkHtml = html; if (want.length) hit(line.querySelector('.lk-words'), want); }
      G.undo.dress(el);   // the node changed last keeps its arrow through a redraw
      /* Found by what it holds under a property: that property and its values under the line, the words marked, and "Show
         the rest", which opens the node. Twenty a drawing at most; the others are found by their line alone. */
      let found = el.querySelector(':scope > .lk-found');
      const hits = made?.finding && !item.faint && state.hits < 20 ? (row.hits || []) : [];
      if (hits.length) {
        state.hits++;
        const said = hits.map(one => `<div class="lk-found-prop"><span class="lk-prop">${G.esc(one.name)}</span> <span class="lk-words">${G.esc(one.values.join(', '))}</span></div>`).join('') + '<button type="button" class="lk-more lk-found-rest">Show the rest</button>' + `<!--${G.esc(want.join(' '))}-->`;
        if (!found) { found = doc.createElement('div'); found.className = 'lk-found'; el.appendChild(found); }
        if (found.lkHtml !== said) { found.innerHTML = said; found.lkHtml = said; for (const words of found.querySelectorAll('.lk-words')) hit(words, want); }
      } else found?.remove();
    });
    box.hidden = !!made?.finding && !made.rows.length && !made.since.length;   // while finding, a list with nothing found is left out
    G.pick.bar(state, box, made);
    G.timeline.keep(state, box, made, today);
    let more = box.querySelector(':scope > .lk-more');
    if (hidden > 0 && !isFolded) {
      if (!more) { more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-more'; box.appendChild(more); }
      more.textContent = `Show ${hidden} more`; more.dataset.fewer = '';   // how many wait, before the press (the owner, 25 November 2026)
    } else if (made && !isFolded && state.view.all.has(list.key) && !made.picking && !made.groups && made.rows.length > state.few + 2) {
      if (!more) { more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-more'; box.appendChild(more); }
      more.textContent = 'Show fewer'; more.dataset.fewer = '1';
    } else more?.remove();
    more?.classList.toggle('lk-more-link', !!made);
    if (state.add) G.adding.keep(state, box, list);   // the line begun from the list's + stands at its end
  });
}
// The words being found, marked where they stand in a line's words.
function hit(words, want) {
  if (!words) return;
  const doc = words.ownerDocument, walk = doc.createTreeWalker(words, 4), nodes = [];
  for (let node; (node = walk.nextNode());) if (!node.parentElement.closest('.lk-tag, .lk-tell, .lk-lacks, .lk-sits')) nodes.push(node);
  for (const node of nodes) {
    const low = node.textContent.toLowerCase(); let at = -1, len = 0;
    for (const word of want) { const i = low.indexOf(word); if (i >= 0 && (at < 0 || i < at)) { at = i; len = word.length; } }
    if (at < 0) continue;
    const rest = node.splitText(at); rest.splitText(len);
    const mark = doc.createElement('mark'); mark.className = 'lk-hit'; rest.replaceWith(mark); mark.appendChild(rest);
  }
}
function handle(state, event) {
  const target = event.target;
  if (!(target instanceof target.ownerDocument.defaultView.Element)) return;
  // Only what belongs to this node's lists: a nested node's lists handle their own.
  if (target.closest('.lk-rel') !== state.el) return;
  const row = target.closest('.lk-row');
  if (row && target.closest('.lk-open')?.closest('.lk-row') === row) return;   // inside the opened node everything is Logseq's
  if (target.closest('.lk-draft')) return;   // the line a new node is typed in has its own ears
  if (row && target.closest('.lk-found')) { if (event.type === 'click' && target.closest('.lk-found-rest')) { event.preventDefault(); event.stopPropagation(); open(row); } return; }
  const plus = target.closest('.lk-plus');
  if (plus) { if (event.type === 'click') { event.preventDefault(); event.stopPropagation(); G.adding.start(state, plus.closest('.lk-list'), plus.closest('.lk-group-head')?.lkGroup || null); } return; }
  if (event.type === 'mousedown') { if (event.shiftKey && target.closest('.lk-line')) event.preventDefault(); return; }   // Shift-click opens beside: it selects no words on its way
  if (state.view && G.pick.act(state, event)) { event.stopPropagation(); return; }
  if (state.view && G.timeline.act(state, event)) { event.stopPropagation(); return; }
  if (row && event.type === 'click' && state.press && target.closest('.lk-line') && !target.closest('.lk-status, a[data-to], .lk-url') && state.press(row, event)) { event.stopPropagation(); return; }
  if (row && event.type === 'keydown' && state.key && target.matches('.lk-line') && state.key(row, event)) { event.preventDefault(); event.stopPropagation(); return; }
  if (row && G.line.act(event, row, state.more)) { event.stopPropagation(); return; }
  if (state.view && !row && G.listview.act(state, event)) { event.stopPropagation(); return; }
  const head = target.closest('.lk-list-head');
  if (head && head.parentElement.dataset.kind !== 'none' && (event.type === 'click' || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')))) {
    if (target.closest('.lk-tick, button')) return;
    event.preventDefault(); event.stopPropagation(); folded.flip(head.parentElement.dataset.key); state.redraw(); return;
  }
  if (event.type === 'click' && target.closest('.lk-more')) { const key = target.closest('.lk-more').dataset.gkey || target.closest('.lk-list').dataset.key; if (target.closest('.lk-more').dataset.fewer) { state.all.delete(key); state.view?.all.delete(key); } else { state.all.add(key); state.view?.all.add(key); } state.redraw(); return; }
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
    G.undo.mark(uuid);   // what was added lights, with the way back at its end
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
G.node = { toggle, open, close, back, listing, lists, related, adder, folded, ARROW, CHEV };
G.node.CSS = `
.lk-rel:empty { display: none; }
.lk-rel { display: flex; flex-direction: column; gap: 18px; container: lk-list / inline-size; }
.lk-list-head[hidden] { display: none; }
.lk-list[hidden] { display: none; }
.lk-list[data-face="tag"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-tag-face); }
.lk-list[data-face="prop"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; }
.lk-list[data-kind="none"] .lk-fold { visibility: hidden; }
.lk-list-head { display: flex; align-items: center; gap: 2px; min-height: 28px; margin-left: -18px; cursor: default; border-radius: var(--lk-corner); }
.lk-list-head:focus-visible { outline: none; background: var(--lk-wash); }
.lk-list-head .lk-fold { opacity: 0; margin-top: 0; }
.lk-list-head:hover .lk-fold, .lk-list-head:focus-visible .lk-fold, .lk-list-head[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-prop { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; color: var(--lk-quiet); }
.lk-plain { color: var(--lk-quiet); }
.lk-list-name { flex: 1; min-width: 0; display: flex; align-items: center; }
.lk-list-head:has(> .lk-list-via:not(:empty)) { flex-wrap: wrap; }
.lk-list-via { order: -1; flex: 0 0 100%; display: flex; align-items: center; min-height: 24px; }
.lk-list-via:empty { display: none; }
.lk-list-via > :is(svg, .ti):first-child { flex: none; width: 13px; height: 13px; margin: 0 4px 0 3px; font-size: var(--lk-small); color: var(--lk-off); }
.lk-list-head[data-one] > :is(.lk-fold, .lk-list-name) { display: none; }
/* A list of Relations has the day after the bullet, inside the line. Opened, the node stands where its words stood, and its
   day stays where it was. */
.lk-list[data-viewed] > .lk-rows > .lk-row { position: relative; }
.lk-list[data-viewed] > .lk-rows > .lk-row > .lk-day { display: none; }
.lk-list[data-viewed]:has(.lk-dayin) > .lk-rows > .lk-row[data-open="1"] > .lk-day { display: block; position: absolute; left: 44px; top: 2px; width: var(--lk-dayin, 54px); padding: 0; color: var(--lk-quiet); z-index: 1; }
.lk-list[data-viewed]:has(.lk-dayin) > .lk-rows > .lk-row > .lk-open { margin-left: calc(var(--lk-dayin, 54px) + 10px); }
.lk-list[data-viewed] > .lk-rows > .lk-row[data-open="1"]::before { content: ""; position: absolute; left: 23px; top: 13px; width: 6px; height: 6px; border-radius: 50%; background: var(--lk-line); z-index: 1; }
.lk-list-head[data-thin] { padding-bottom: 6px; align-items: flex-start; }
.lk-list-head[data-thin] > .lk-list-name { align-items: flex-start; }
.lk-list-head[data-thin] > .lk-fold { opacity: .45 !important; }
.lk-list-head[data-thin]:hover > .lk-fold { opacity: .8 !important; }
.lk-list-head[data-plain] > .lk-list-via > .lk-plain { font-size: var(--lk-line-size); }
.lk-row.lk-fresh > .lk-line > .lk-bul::before { background: var(--lk-text); width: 7px; height: 7px; }   /* made since the page was last open */
.lk-list[data-picking] .lk-row > .lk-fold { display: none; }
.lk-row > .lk-tick { grid-column: 2; align-self: start; margin-top: 9px; justify-self: center; position: relative; z-index: 1; }
.lk-list-head > .lk-list-name > .lk-tick-all { margin: 0 6px 0 -19px; align-self: center; }
.lk-row.lk-picked > .lk-line { background: var(--lk-wash); border-radius: 6px; }
.lk-said { font-weight: 500; }
/* What a list's head says of its nodes ("4 Transfers", the kinds with their counts) is a size under the lines it heads, in every place (the owner, 26 November 2026). */
.lk-list-head .lk-said, .lk-list-head .lk-tabs { font-size: var(--lk-line-size); }
.lk-list-head:has(> .lk-list-via:not(:empty)) .lk-fold { opacity: 1; }   /* on the count's line the arrow stays in view, faint, as it was */
.lk-list-name .lk-tag { margin-left: .5em; font-size: var(--lk-small); }
.lk-span { margin-left: auto; padding-left: 12px; font-size: var(--lk-small); color: var(--lk-off); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* A row's arrow in a list of Relations: the thin one, faint until the row is under the pointer. */
.lk-row > .lk-fold.lk-fold-thin svg { width: 13px; height: 13px; }
/* Where a found node holds the words: the property and its values under its line, on the words' own edge. */
.lk-row > .lk-found { grid-column: 3; min-width: 0; padding: 0 6px 4px 20px; font-size: 14px; line-height: 21px; }
.lk-list:has(.lk-row .lk-dayin) > .lk-rows > .lk-row > .lk-found { padding-left: calc(20px + var(--lk-dayin, 54px) + 12px); }
.lk-row[data-open] > .lk-found { display: none; }
.lk-found .lk-found-rest { display: block; margin: 0; }
.lk-rows > .lk-more.lk-more-group { display: block; }
/* A narrow place (the sidebar, a node opened deep): the indents shrink. A row's arrow stands in the gutter where its list's
   arrow stands, its bullet on the edge the head's words start on, and its day goes under its words, small, in place of a
   column beside them that would leave the words a few letters wide (the owner, 25 November 2026: "This is a sidebar and you
   need to account for that especially with indentation"). */
@container lk-list (max-width: 300px) {
  .lk-list[data-viewed] > .lk-rows { margin-left: -18px; }
  .lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line { flex-wrap: wrap; }
  .lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line > .lk-words { flex: 1 1 0; }
  .lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line > .lk-dayin { order: 9; flex: 0 0 100%; width: auto; margin: -3px 0 3px 20px; line-height: 16px; font-size: var(--lk-label); }
  .lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line > .lk-dayin:empty { display: none; }
  .lk-list[data-viewed]:has(.lk-dayin) > .lk-rows > .lk-row > .lk-open { margin-left: -2px; }   /* measured: the opened node's words stand where its line's words stood */
  .lk-list[data-viewed]:has(.lk-dayin) > .lk-rows > .lk-row[data-open="1"] > .lk-day { display: none; }
  .lk-list:has(.lk-row .lk-dayin) > .lk-rows > .lk-row > .lk-found { padding-left: 20px; }
  .lk-list[data-viewed] .lk-draft .lk-dayin { display: none; }
  .lk-list[data-viewed] > .lk-more.lk-more-link, .lk-list[data-viewed] > .lk-rows > .lk-more.lk-more-link { margin-left: 20px; }
  .lk-list[data-viewed] > .lk-draft { margin-left: -18px; }
  .lk-row > .lk-open::before { left: 4px; }   /* the side line clear of a value's arrow, which stands in the gutter here */
}
.lk-plus { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: 4px; padding: 0; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-quiet); opacity: .55; cursor: pointer; }
.lk-plus:hover, .lk-plus:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
@container lk-list (max-width: 300px) { .lk-span { display: none; } }
.lk-more.lk-more-link { margin-left: calc(18px + 16px + 6px + var(--lk-dayin, 54px) + 6px); font-size: inherit; line-height: 24px; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-list:not(:has(.lk-dayin)) > .lk-more.lk-more-link { margin-left: 38px; }
.lk-more { margin: 2px 0 0 calc(var(--lk-daycol, 0px) + 34px); padding: 2px 0; border: 0; background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-more:hover { color: var(--lk-text); text-decoration-color: currentColor; }
.lk-day-end .lk-more { margin-left: 34px; }
.lk-add { display: flex; margin: -4px 0 12px -22px; padding: 4px 0 0 22px; position: sticky; top: 0; z-index: 2; background: var(--lk-ground, transparent); }   /* stays in view while the list moves to what was added */
.lk-add:has(+ .lk-ask) { position: static; }   /* a box open under it: it scrolls away with the rest, and never floats over the box */
.lk-add .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-add .lk-field:focus { border-bottom-color: var(--lk-line); }
.lk-add .lk-field::placeholder { color: var(--lk-off); }
.lk-add ~ .lk-rel .lk-row { scroll-margin: 44px 0 8px; }
.lk-open { margin-left: -2px; position: relative; }
/* The levels show: one soft band for the node opened from a row; a node dug into stands under the value it was reached
   through, its rows starting where the value's words start, with a guide line down from the value's arrow. It takes its room
   in one move, once Logseq has drawn it. */
.lk-row > .lk-open { background: color-mix(in srgb, var(--lk-text) 3.5%, transparent); border-radius: var(--lk-corner); padding: 0 8px 6px 0; }
/* A line down the left side of the node opened from a row, from under its own line to its foot, as before 0.9. */
.lk-row > .lk-open::before { content: ""; position: absolute; left: 9px; top: 28px; bottom: 8px; width: 1px; background: var(--lk-line); pointer-events: none; }
.lk-dugopen { position: absolute; right: 0; margin: 0; padding: 0 0 6px; opacity: 0; pointer-events: none; }
.lk-dugopen[data-whole] { opacity: 1; pointer-events: auto; transition: opacity .16s ease .04s; }
.lk-dugopen.lk-flow { position: relative; margin: 2px 0 6px 28px; }
.lk-dugopen::before { content: ""; position: absolute; left: -11px; top: 1px; bottom: 8px; width: 1px; background: var(--lk-line); }
/* What points at the node: under one word and a thin line, apart from the node's own rows. */
.lk-relhead { display: flex; align-items: center; gap: 10px; margin: 6px 0 0 22px; color: var(--lk-quiet); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-relhead::after { content: ""; flex: 1; height: 1px; background: var(--lk-hair); }
.lk-open > .lk-relhead:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-dugopen > .lk-relhead { margin-left: 0; }
.lk-row > .lk-open > .lk-rel { margin: 2px 0 6px 40px; }   /* one step in under the word Relations, so a head's mark stands where the word starts */
.lk-dugopen > .lk-rel { margin: 2px 0 0 18px; }`;
})();
