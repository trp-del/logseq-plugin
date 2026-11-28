/* NODE: a node opened in place, and the lists of what points at a node.
   An opened node is Logseq's own editor for it (its words, its bullets, its properties, its menus, its Undo) with the lists of
   what points at it underneath, each row a line that opens in turn. Nothing of the node is drawn by the plugin.
     G.node.toggle(row, byKey), open(row, keys, byKey), close(row)   a row of a list opened and closed in place (keys: opened by
                                                 a key or a press on its line, so the keys rest on the opened node and Left closes
                                                 it; byKey: by a key, so the node is brought into view)
     G.node.peek(holder, uuid, shut)             the opened node without its Relations, in a holder of the caller's (the corner's look)
     G.node.listing(el, read, opts)              lists of nodes drawn into el and kept true while the graph changes. read() answers
                                                 [{ key, kind, name, tag, rows, face }] (a list with no name has no head; face 'tag' or
                                                 'prop' draws its rows' words as tags or properties are drawn); opts: press(row,
                                                 event) -> true when the place takes a press on a line itself, few (rows before Show
                                                 all), none (words to say when there is nothing), add: true where a property's
                                                 list has a + that opens the line to type a new node in (node/add.js), key(row, event) -> true when the place takes a key
                                                 on a line, more(row) -> the place's own lines for a row's menu, ticks: { on(row), has(uuid), flip(uuid, row, ticked) } where a
                                                 place lets its rows be ticked: on(row) whether the row has a tick box, has(uuid)
                                                 whether it is ticked, flip(...) told of a press on one; next(list) where a place
                                                 gives a list only the first of its rows and says how many wait (list.waits): Show
                                                 more counts them, and pressed with every given row shown it calls next, which
                                                 brings more. Gives back { off(), again() }
     G.node.follow(fn)                           fn runs a moment after the graph changed, as the lists read again: not while a
                                                 bullet is being written in, but once, when that bullet is left; gives back what stops it
     G.node.adder(holder, name, add, failed)     a line at the head of holder that adds (a task, a tag); gives back what removes it.
                                                 add(words) answers the uuid of what it made, or { uuid, steps } with the steps of
                                                 Undo it made: 0 where the thing was there already, and then no Undo arrow is set
     G.node.lists(el, uuid)                      the listing of what points at a node; gives back what takes it away
     G.node.once(base)                           keeps every opened node saying each property once (touch.once) */
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
function mount(holder, uuid, from = '', bare = false) {   // bare: without what points at the node
  const doc = holder.ownerDocument, view = doc.defaultView, k = String(++count);
  holder.dataset.k = k; holder.dataset.node = uuid;
  const rule = doc.createElement('style'), page = doc.createElement('div'), head = doc.createElement('div'), rel = doc.createElement('div');
  page.className = 'lk-editor'; head.className = 'lk-relhead'; head.textContent = 'Relations'; rel.className = 'lk-rel';
  const tagRule = doc.createElement('style');
  holder.append(rule, tagRule, page);
  if (!bare) holder.append(head, rel);
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
      css += `.lk-open[data-k="${k}"] > .lk-editor ${seat.mark}::before { transform: rotate(90deg); }\n`;
      if (dug.dataset.whole) css += `.lk-open[data-k="${k}"] > .lk-editor ${seat.row} { margin-bottom: ${dug.offsetHeight}px !important; }\n`;   // room only once the node has come to rest: one move, not a stutter
    }
    if (rule.textContent !== css) rule.textContent = css;
  };
  const sized = view.ResizeObserver ? new view.ResizeObserver(() => place()) : null;
  sized?.observe(page);
  holder.lkPlace = place;
  /* Whole: Logseq's editor has come to rest and the lists of what points at the node have been drawn once, so the node rolls
     out with them in it and nothing arrives later to push the page down (a wait of 1.2 s at the most for the lists). */
  let edited = false, listed = bare;
  const ready = () => { if (!edited || !listed) return; holder.dataset.whole = '1'; place(); holder.parentElement?.closest('.lk-open')?.lkPlace?.(); };
  const whole = G.touch.editor.whole(page, () => { edited = true; ready(); });
  const drawn = () => { listed = true; ready(); }, cap = bare ? 0 : view.setTimeout(drawn, 1200);
  if (!bare) rel.addEventListener('lk-drawn', drawn, { once: true });
  const offEditor = G.touch.editor.show(page, uuid), offLists = bare ? () => {} : lists(rel, uuid, from);
  const undig = value => { const dug = dugs.get(value); if (!dug) return; dugs.delete(value); sized?.unobserve(dug); dug.lkOff?.(); dug.remove(); place(); };
  holder.lkDig = value => {
    if (dugs.has(value)) { undig(value); return; }
    const dug = doc.createElement('div'); dug.className = 'lk-open lk-dugopen';
    holder.insertBefore(dug, bare ? null : head); dugs.set(value, dug);
    mount(dug, value, uuid, bare); dug.lkClose = () => undig(value);
    sized?.observe(dug); place(); within = dug;
    view.setTimeout(() => { if (dug.isConnected && !dug.dataset.whole) { dug.dataset.whole = '1'; place(); } }, 1500);
  };
  holder.lkOff = () => { whole(); view.clearTimeout(cap); sized?.disconnect(); for (const dug of dugs.values()) dug.lkOff?.(); dugs.clear(); offEditor(); offLists(); };
}
/* An opened node rolls out of its line: from the line's height to its own, in one short move, and nothing is held once it is
   there (the owner's pages of 25 November 2026: "Rolls out of its line"). Not where the person asks for less motion. */
const still = el => el.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
function roll(holder, from) {
  const view = holder.ownerDocument.defaultView, full = holder.offsetHeight;
  if (!full || full <= from + 4 || still(holder)) return;
  const done = () => { holder.style.height = ''; holder.style.overflow = ''; holder.style.transition = ''; holder.removeEventListener('transitionend', done); view.clearTimeout(cap); };
  const cap = view.setTimeout(done, 400);
  holder.style.height = `${from}px`; holder.style.overflow = 'hidden';
  void holder.offsetHeight;
  holder.style.transition = 'height .16s ease-out'; holder.style.height = `${full}px`;
  holder.addEventListener('transitionend', done);
}
// The same motion back up, before a thing is taken away: to nothing, or to a height (an opened node rolls up to its line's).
// Answers once it is up (at once where less motion is asked for).
function rollUp(holder, to = 0) {
  const view = holder.ownerDocument.defaultView, full = holder.offsetHeight;
  if (!full || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return new Promise(done => {
    const end = () => { holder.removeEventListener('transitionend', end); view.clearTimeout(cap); done(); };
    const cap = view.setTimeout(end, 400);
    holder.style.height = `${full}px`; holder.style.overflow = 'hidden';
    void holder.offsetHeight;
    holder.style.transition = 'height .16s ease-out'; holder.style.height = `${to}px`;
    holder.addEventListener('transitionend', end);
  });
}
/* A list changed by the person's own press: what comes rolls out and what goes rolls up, each run of lines from its top, and the
   rest moves with them (the owner chose it, 27 November 2026: "Rolls"). change() draws the list anew. Whatever is still rolling
   is brought to its end before the list is drawn again. */
const SIZES = ['height', 'min-height', 'overflow', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'];
function moved(root, change) {
  root.lkSettle?.();
  const view = root.ownerDocument.defaultView;
  const had = [root, ...root.querySelectorAll(':scope > .lk-list > .lk-rows')].map(holder => [holder, [...holder.children]]);
  change();
  if (still(root)) return;
  const runs = [];
  for (const [holder, before] of had) {
    if (!holder.isConnected) continue;
    const old = new Set(before), gone = new Set(before.filter(el => el.parentElement !== holder && !el.isConnected && !el.matches('.lk-more')));
    let after = null;   // a line that went is put back after the one it stood after, to roll up from there
    for (const el of before) {
      if (gone.has(el)) { el.inert = true; el.classList.add('lk-gone'); holder.insertBefore(el, after ? after.nextSibling : holder.firstChild); after = el; }
      else if (el.parentElement === holder) after = el;
    }
    let run = null;
    for (const el of holder.children) {
      const kind = gone.has(el) ? 'goes' : old.has(el) ? '' : 'comes';
      if (!kind) { run = null; continue; }
      if (!run || run.kind !== kind) runs.push(run = { kind, els: [] });
      run.els.push(el);
    }
  }
  if (!runs.length) return;
  for (const run of runs) run.full = run.els.map(el => { const look = view.getComputedStyle(el); return { height: el.offsetHeight, edges: ['margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'].map(name => [name, parseFloat(look.getPropertyValue(name)) || 0]) }; });
  const ms = G.look.MOTION.roll, from = view.performance.now();
  const at = part => {
    for (const run of runs) {
      let left = run.full.reduce((sum, one) => sum + one.height, 0) * (run.kind === 'comes' ? part : 1 - part);
      run.els.forEach((el, i) => {
        const { height, edges } = run.full[i]; if (!height) return;
        const now = Math.max(0, Math.min(height, left)), share = now / height; left -= height;
        el.style.setProperty('height', `${now}px`); el.style.setProperty('min-height', '0'); el.style.setProperty('overflow', 'hidden');
        for (const [name, full] of edges) el.style.setProperty(name, `${full * share}px`);
      });
    }
  };
  const end = () => {
    root.lkSettle = null; view.cancelAnimationFrame(frame); view.clearTimeout(cap);
    for (const run of runs) for (const el of run.els) { if (run.kind === 'goes') el.remove(); else for (const name of SIZES) el.style.removeProperty(name); }
  };
  const step = time => { const t = Math.min(1, Math.max(0, (time - from) / ms)); if (t >= 1) return end(); at(1 - (1 - t) * (1 - t)); frame = view.requestAnimationFrame(step); };
  at(0);
  let frame = view.requestAnimationFrame(step); const cap = view.setTimeout(end, ms + 300);
  root.lkSettle = end;
}
/* keys: the row was opened by a key or a press on its own line. Its line goes out of sight once the node is shown, and the keys
   would fall to the page; they are put on the opened node instead, so the key that closes it (Left, node handle below) still
   reaches it. Once the person goes into the node the keys are Logseq's, and Escape is the way out. */
// The place that scrolls a thing: the nearest one above it that does, else the window's own.
const scroller = el => { const view = el.ownerDocument.defaultView; for (let at = el.parentElement; at; at = at.parentElement) { const flow = view.getComputedStyle(at).overflowY; if ((flow === 'auto' || flow === 'scroll') && at.scrollHeight > at.clientHeight + 1) return at; } return el.ownerDocument.scrollingElement; };
/* A thing opened from the keyboard at the foot of what scrolls it is brought into view as far as that holds it: its top stays in
   view, and as much of its height as fits comes in, in the same short move. Not after a press: the line pressed stays under
   the pointer, and the page is the person's to scroll. */
function reveal(el, height) {
  const doc = el.ownerDocument, port = scroller(el), at = el.getBoundingClientRect();
  const frame = port === doc.scrollingElement ? { top: 0, bottom: doc.defaultView.innerHeight } : port.getBoundingClientRect();
  const over = at.top + height + 12 - frame.bottom, room = at.top - Math.max(frame.top, 48) - 12;   // Logseq's top 48 are its header's
  if (over > 0 && room > 0) port.scrollBy({ top: Math.min(over, room), behavior: still(el) ? 'auto' : 'smooth' });
}
const rest = holder => {   // the node can hold the keys only until they leave it: a press inside it then lands where it always did
  holder.tabIndex = -1; holder.focus({ preventScroll: true });
  holder.addEventListener('blur', () => holder.removeAttribute('tabindex'), { once: true });
};
function open(row, keys = false, byKey = false) {   // byKey: opened from the keyboard, so no pointer rests on its line: it is brought into view
  if (row.dataset.open || !G.touch.editor.can()) { if (!row.dataset.open) G.touch.open(row.dataset.uuid); return; }
  const doc = row.ownerDocument, holder = doc.createElement('div'); holder.className = 'lk-open';
  row.appendChild(holder); row.dataset.open = 'soon';
  mount(holder, row.dataset.uuid);
  // Logseq fills the node in over a few frames (a link's name, a property's value): it is shown once it has come to rest.
  const shown = new (row.ownerDocument.defaultView.MutationObserver)(() => { if (holder.dataset.whole) { shown.disconnect(); if (row.dataset.open === 'soon') { const line = row.querySelector(':scope > .lk-line'), from = line?.offsetHeight || 28, had = keys && (doc.activeElement === line || doc.activeElement === doc.body || !doc.activeElement); row.dataset.open = '1'; holder.lkFrom = from; const full = holder.offsetHeight; roll(holder, from); if (byKey) reveal(row, full); if (had) rest(holder); } } });
  shown.observe(holder, { attributes: true, attributeFilter: ['data-whole'] });
  holder.lkClose = () => close(row, true);
  row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Close');
  within = holder;
}
/* A node looked at without opening it in a list: the same opened node without its Relations (the owner, 27 November 2026), in a
   holder of the caller's. shut closes the look, which
   Escape does as it does an opened row. Gives back what takes it away; null while Logseq's editor cannot be lent. */
function peek(holder, uuid, shut) {
  if (!G.touch.editor.can()) return null;
  mount(holder, uuid, '', true); holder.lkClose = shut;
  watchKeys(holder.ownerDocument);
  return () => holder.lkOff?.();
}
/* focus: closed by the person's own hand (the arrow, Escape, Left): the node rolls back up into its line as it rolled out, and
   the line has the keys again. Taken away by the plugin (a list that goes), it goes at once. A row whose node no longer belongs
   to the list (lkLeft, set where the list is drawn: it stayed only because it was open) leaves in this same move, the whole row
   rolling up, and its list with it where the list held nothing else. */
function close(row, focus = false) {
  const holder = row.querySelector(':scope > .lk-open');
  if (!holder || holder.lkClosing) return;
  const end = () => {
    for (const inner of holder.querySelectorAll('.lk-open')) inner.lkOff?.();
    holder.lkOff?.(); holder.remove(); delete row.dataset.open;
    row.dispatchEvent(new (row.ownerDocument.defaultView.CustomEvent)('lk-closed', { bubbles: true }));   // its line is read again at once: what was written in it shows without a wait
    row.querySelector(':scope > .lk-fold')?.setAttribute('aria-label', 'Open');
    if (focus) row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true });
  };
  if (!focus || row.dataset.open !== '1' || still(holder)) return end();
  holder.lkClosing = true;
  const box = row.closest('.lk-list'), leaving = row.lkLeft ? (box?.lkLeft ? box : row) : null;
  rollUp(leaving || holder, leaving ? 0 : holder.lkFrom || 28).then(() => {
    const next = leaving && (row.nextElementSibling || row.previousElementSibling);
    end();
    if (leaving) { leaving.remove(); next?.querySelector?.(':scope > .lk-line')?.focus({ preventScroll: true }); }
  });
}
const toggle = (row, byKey = false) => row.dataset.open ? close(row, true) : open(row, true, byKey);
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
/* The lists follow the graph: a moment after it changed they read it again. Not while a bullet is being written in: a hand
   writing saves at every pause, and every list reading the graph at each of them is work for nothing the person sees. The change
   is kept, and read once, when that bullet is left (another has the keys, or none). */
function follow(fn) {
  const view = G.host().defaultView;
  let held = null, timer = 0;
  const same = () => { const box = G.touch.writing(); return !!box && box === held.box && box.id === held.id; };
  const look = () => { timer = 0; if (!held) return; if (same()) { timer = view.setTimeout(look, 400); return; } held = null; fn(); };
  const off = G.touch.changed(() => {
    const box = G.touch.writing();
    if (!box) { held = null; view.clearTimeout(timer); timer = 0; fn(); return; }
    held = { box, id: box.id };
    if (!timer) timer = view.setTimeout(look, 400);
  });
  return () => { off(); view.clearTimeout(timer); timer = 0; held = null; };
}
function listing(el, read, opts = {}) {
  const state = { el, read, next: opts.next || null, all: new Set(), turn: 0, hits: 0, draft: null, ticks: opts.ticks || null, press: opts.press || null, leaves: opts.leaves || null, left: new Set(), rolls: false, dayStart: opts.dayStart || null, few: opts.few || 10, none: opts.none || '', add: !!opts.add, key: opts.key || null, more: opts.more || null, view: opts.view || null, last: null };
  state.redraw = () => { if (state.last && el.isConnected) draw(state, ...state.last); };
  state.again = () => load(state);
  mounted.set(el, state);
  const onEvent = event => handle(state, event);
  for (const type of EVENTS) el.addEventListener(type, onEvent);
  const onClosed = event => { if (event.target.closest('.lk-rel') === el) { G.read.forget(); load(state); } };
  el.addEventListener('lk-closed', onClosed);
  watchKeys(el.ownerDocument);
  offDigs ||= G.touch.digs((editor, uuid) => { const holder = editor.parentElement; if (!holder?.lkDig) return false; holder.lkDig(uuid); return true; });
  offChanged ||= follow(() => { for (const [one, s] of mounted) { if (!one.isConnected) mounted.delete(one); else load(s); } });
  load(state);
  return {
    again: () => load(state),
    off() {
      state.gone = true; state.turn++;   // a reading on its way is stopped: nothing of this list is drawn into what stands here next
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
function related(el, uuid, from = '') {
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
    const props = [...(await G.read.schema()).props.values()], types = Object.fromEntries(props.map(prop => [prop.title, prop.type]));
    const quiet = props.filter(prop => prop.hidden).map(prop => prop.title);   // set to "Hide by default": not said after a line
    for (const list of made) {
      list.types = types; list.hidden = quiet; list.own_name = list.prop?.title || '';
      if (list.kind === 'property') list.name = G.reads.back(list.prop.title, named);   // read from this end: "Prescribed by" is "Prescribed" here
      if (from) list.rows = list.rows.filter(row => row.uuid !== from);   // never back to the node it was opened from (the owner's marked page, 26 Nov)
      list.rows = list.rows.map(row => ({ ...row, held: held.get(row.id) || {}, where: list.kind === 'mentions' && !row.isPage ? (sits.get(row.id) || []) : [] }));
    }
    total = made.reduce((n, list) => n + list.rows.length, 0);
    return G.view.ordered(from ? made.filter(list => list.rows.length) : made, G.listview.order(uuid));   // a list that held only the way back is left out
  }, { view, few: 10, add: true });
  const offDrags = G.listview.drags(mounted.get(el));
  return { ...handle, off() { offDrags(); handle.off(); }, rows: () => total, day: () => view.own, find(words) { view.find = G.view.parse(words, D.number(new Date())); mounted.get(el)?.redraw(); } };
}
const lists = (el, uuid, from) => related(el, uuid, from).off;
async function load(state) {
  if (state.gone) return;   // the list was taken off
  const turn = ++state.turn;
  try {
    const [made, statuses] = await Promise.all([state.read(), G.read.statuses()]);
    // The names linked in a row's own words, and in the words of what it sits under (the line that says where a row sits reads a linked name as its name).
    const names = await G.read.names(made.flatMap(list => list.rows.flatMap(row => [...W.named(W.firstLine(row.words).line), ...(row.where || []).flatMap(step => W.named(String(step.words || '')))])));
    if (turn !== state.turn || !state.el.isConnected) return;
    const holds = await G.read.withLines(made.flatMap(list => list.rows.map(row => row.id)));
    if (turn !== state.turn || !state.el.isConnected) return;
    for (const list of made) for (const row of list.rows) row.holds = holds.has(row.id);
    if (state.leaves && state.last && !(await finished(state, made, statuses, turn))) return;
    state.last = [made, names, statuses];
    if (state.rolls) { state.rolls = false; moved(state.el, () => draw(state, made, names, statuses)); } else draw(state, made, names, statuses);
    state.el.dispatchEvent(new (state.el.ownerDocument.defaultView.CustomEvent)('lk-drawn'));
  } catch (error) {
    console.error('Logseq Plugin: a list of nodes could not be read', error);
  }
}
/* A task finished from a list that lets finished tasks go (Todo): its circle shows it ticked, the line waits a moment, then rolls
   up; undone, it rolls back (the owner chose it, 27 November 2026: "Ticks, waits, closes"). False: a newer reading took over. */
async function finished(state, made, statuses, turn) {
  const view = state.el.ownerDocument.defaultView, next = new Set(made.flatMap(list => list.rows.map(row => row.uuid)));
  if ([...next].some(uuid => state.left.delete(uuid))) state.rolls = true;
  const lines = uuid => [...state.el.querySelectorAll(`.lk-row[data-uuid="${uuid}"]:not([data-open]):not(.lk-gone)`)];
  // Only a task the place no longer holds at all is asked after: one narrowed or filtered away costs nothing while typing.
  const gone = state.last[0].flatMap(list => list.rows).filter(row => !next.has(row.uuid) && state.leaves(row.uuid) && lines(row.uuid).length);
  if (!gone.length) return true;
  const now = await G.read.describe(gone.map(row => row.id));
  if (turn !== state.turn || !state.el.isConnected) return false;
  let until = 0;
  for (const row of gone) {
    const status = statuses.find(one => one.id === now.get(row.id)?.status);
    if (!status || !G.line.ended(status)) continue;
    state.left.add(row.uuid);
    for (const line of lines(row.uuid)) {
      if (!line.lkDone) G.line.mark(line, status);   // finished somewhere else: it shows ticked from now
      until = Math.max(until, line.lkDone + G.look.MOTION.done);
    }
  }
  if (!until) return true;
  await new Promise(done => view.setTimeout(done, Math.max(0, until - Date.now())));
  if (turn !== state.turn || !state.el.isConnected) return false;
  state.rolls = true;
  return true;
}
/* Elements are kept by their key and only what changed is redrawn, so an opened row keeps its editor and the writing in it.
   A row the person has open stays until they close it, even when the node no longer points here (they may have just changed
   that in it): it is not among the wanted any more, and it keeps its place, the others taking theirs around it. It is never
   moved: moving it would take it from under the pointer and the keys out of the node being written in. */
function sync(parent, wanted, keyOf, make, update, stays = child => !!child.dataset.open) {
  const have = new Map([...parent.children].map(child => [child.dataset.key, child]));
  const keys = new Set(wanted.map(keyOf)), kept = new Set([...parent.children].filter(child => !keys.has(child.dataset.key) && stays(child)));
  let prev = null;
  for (const item of wanted) {
    const key = keyOf(item);
    let child = have.get(key);
    if (child) have.delete(key); else { child = make(item); child.dataset.key = key; }
    child.lkLeft = false;
    update(child, item);
    let next = prev ? prev.nextElementSibling : parent.firstElementChild;
    while (next && next !== child && kept.has(next)) next = next.nextElementSibling;   // past what stays open in its place
    if (next !== child) parent.insertBefore(child, next);
    prev = child;
  }
  for (const child of have.values()) { if (kept.has(child)) child.lkLeft = true; else child.remove(); }   // lkLeft: it stays only while it is open, and goes when it is closed
}
/* A list that is no longer wanted while one of its rows is open: the list stays with that row (and with it the node being
   written in), and everything else of it goes. It is taken away when the row is closed, at the reading that follows. */
function staysOpen(box) {
  if (!box.querySelector(':scope > .lk-rows > .lk-row[data-open]')) return false;
  for (const el of [...box.querySelectorAll(':scope > .lk-rows > *, :scope > .lk-more, :scope > .lk-pickbar, :scope > .lk-time')]) if (!el.dataset.open) el.remove();
  return true;
}
function draw(state, made, names, statuses) {
  state.el.lkSettle?.();
  const doc = state.el.ownerDocument, today = D.number(new Date());
  state.hits = 0;   // how many found nodes say where they were found, this drawing
  const wanted = made.length || !state.none ? made : [{ key: 'none', kind: 'none', name: state.none, rows: [] }];
  sync(state.el, wanted, list => list.key, () => {
    const box = doc.createElement('div'); box.className = 'lk-list';
    box.innerHTML = `<div class="lk-list-head" role="button" tabindex="0"><span class="lk-fold">${CHEV}</span><span class="lk-list-via"></span><span class="lk-list-name"></span></div><div class="lk-rows"></div>`;
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
    const lined = via || (made && list.count);   // two lines: what the list is, then what it holds
    const first = lined ? `<span class="${via || list.kind === 'due' ? 'lk-prop' : 'lk-plain'}">${G.esc(list.name)}</span>${list.count ? '' : plus}` : '';
    const name = made && list.count ? G.listview.head(state, list, made, plus, today) : via ? (list.count ? `<span class="lk-said">${G.esc(list.tag ? said : `${said} nodes`)}</span>${plus}` : '')
      : `<span class="${list.kind === 'due' ? 'lk-prop' : list.kind === 'none' ? 'lk-none' : 'lk-plain'}">${G.esc(list.name)}</span>${said ? ` <span class="lk-tag">${G.esc(said)}</span>` : ''}`;
    if (head.children[1].innerHTML !== first) head.children[1].innerHTML = first;
    if (made && !head.dataset.thin) { head.dataset.thin = '1'; head.firstElementChild.innerHTML = CHEV; }
    if (made) head.children[1].draggable = true;   // a list's name dragged among the page's lists sets their order
    head.toggleAttribute('data-one', !!lined && !list.count); head.toggleAttribute('data-plain', !!lined && !via);
    box.lkList = list;
    if (head.lastElementChild.innerHTML !== name) head.lastElementChild.innerHTML = name;
    head.hidden = !list.name; box.dataset.kind = list.kind; box.dataset.face = list.face || '';
    rowsEl.hidden = isFolded;
    const items = made ? G.listview.items(state, list, made, state.few) : L.shown(list.rows, state.all.has(list.key), state.few).map(row => ({ type: 'row', key: row.uuid, row }));
    // The rows not shown: those the list was given and holds back, and those the place has not given yet (list.waits, where it has a next).
    const kept = made ? (items.hidden || 0) : list.rows.length - items.length, waits = !made && state.next ? Math.max(0, Number(list.waits) || 0) : 0, hidden = kept + waits;
    const dated = items.filter(item => item.type === 'row' && item.row.dayShown), long = dated.some(item => Math.floor(item.row.dayShown / 10000) !== Math.floor(today / 10000));
    // Where a row's day stands, as the place's menu says: at the line's right end (as it comes), or before its words.
    const front = made ? G.listview.viewOf(list.key).at === 'start' : !!state.dayStart?.();
    box.style.setProperty('--lk-daycol', !dated.length || (front && made) ? '0px' : long ? '92px' : '56px');   // in front, a list of Relations has the day after the bullet, inside the line
    box.classList.toggle('lk-day-end', !front);
    box.style.setProperty('--lk-dayin', long ? '90px' : '54px');
    box.toggleAttribute('data-picking', !!made?.picking);
    box.toggleAttribute('data-viewed', !!made);
    sync(rowsEl, items, item => item.key, item => {
      if (item.type === 'draft') return G.adding.el(state);
      const el = doc.createElement(item.type === 'more' ? 'button' : 'div');
      if (item.type !== 'row') return el;
      el.className = 'lk-row';
      // In a list of Relations a row's arrow is the thin one its head has, as before the rebuild; elsewhere Logseq's own.
      el.innerHTML = `<span class="lk-day"></span><button type="button" class="lk-fold" aria-label="Open">${CHEV}</button><div class="lk-line" role="button" tabindex="0"></div>`;
      return el;
    }, (el, item) => {
      if (item.type === 'draft') return;
      if (item.type !== 'row') { G.listview.paint(el, item, today); return; }
      const row = item.row;
      el.dataset.uuid = row.uuid; el.dataset.status = row.status || ''; el.dataset.page = row.isPage ? '1' : '';
      el.classList.toggle('lk-faint', !!item.faint);
      el.style.setProperty('--lk-depth', String(row.depth || 0));   // an outline's row stands in by its depth
      const day = D.short(row.dayShown, today), dayEl = el.firstElementChild;
      if (dayEl.textContent !== day) dayEl.textContent = day;
      dayEl.classList.toggle('lk-late', !!(day && row.late));
      dayEl.title = day ? (row.dayFrom || 'The day it was written') : '';
      let tick = el.querySelector(':scope > .lk-tick');
      const ticking = item.picking || !!state.ticks?.on(row), ticked = item.picking ? !!item.picked : !!state.ticks?.has(row.uuid);
      el.classList.toggle('lk-picked', ticked);
      if (ticking) { if (!tick) { tick = doc.createElement('input'); tick.type = 'checkbox'; tick.className = 'lk-tick'; tick.setAttribute('aria-label', 'Pick this node'); el.insertBefore(tick, el.children[1]); } tick.checked = ticked; } else tick?.remove();
      const want = made?.finding ? G.search.tokens(state.view.find.words) : [];
      // A list of one node has a head that names no kind (nothing to count), so its row says the tag itself.
      const html = G.line.html(row, { names, statuses, tagShown: row.tagShown || (!!made && !list.count), said: made?.shared, day: front && made && dated.length ? day : undefined }) + (want.length ? `<!--${G.esc(want.join(' '))}-->` : ''), line = el.querySelector(':scope > .lk-line');
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
      more.textContent = `Show ${hidden} more`; more.dataset.fewer = ''; more.dataset.next = !kept && waits ? '1' : '';   // how many wait, before the press (the owner, 25 November 2026); with every given row shown, the press asks the place for more
    } else if (made && !isFolded && state.view.all.has(list.key) && !made.picking && !made.groups && made.rows.length > state.few + 2) {
      if (!more) { more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-more'; box.appendChild(more); }
      more.textContent = 'Show fewer'; more.dataset.fewer = '1'; more.dataset.next = '';
    } else more?.remove();
    more?.classList.toggle('lk-more-link', !!made);
    if (state.add) G.adding.keep(state, box, list);   // the line begun from the list's + stands at its end
  }, staysOpen);
}
// The words being found, marked where they stand in a line's words.
function hit(words, want) {
  if (!words) return;
  for (const old of words.querySelectorAll('mark.lk-hit')) old.replaceWith(...old.childNodes);   // marks of letters typed before go first
  words.normalize();
  const doc = words.ownerDocument, walk = doc.createTreeWalker(words, 4), nodes = [];
  for (let node; (node = walk.nextNode());) if (!node.parentElement.closest('.lk-tag, .lk-tell, .lk-lacks, .lk-sits')) nodes.push(node);
  // Every typed word found in a stretch of the words is marked, each once and none over another: the places come from the
  // deciding piece (core/search.js marks), taken from the end so the places before stay true.
  for (const node of nodes) for (const [at, length] of G.search.marks(node.textContent, want).reverse()) {
    const rest = node.splitText(at); rest.splitText(length);
    const mark = doc.createElement('mark'); mark.className = 'lk-hit'; rest.replaceWith(mark); mark.appendChild(rest);
  }
}
function handle(state, event) {
  const target = event.target;
  /* An element, asked by its kind and not by whose Element it is: a piece the plugin drew into Logseq's page can belong to the
     plugin's own frame rather than to Logseq's window (seen in Logseq 2.0.2, 27 November 2026: the presses of the picked-nodes
     bar), and a press on it was then dropped here without a word. */
  if (target?.nodeType !== 1) return;
  // Only what belongs to this node's lists: a nested node's lists handle their own.
  if (target.closest('.lk-rel') !== state.el) return;
  const found = target.closest('.lk-row'), row = found && state.el.contains(found) ? found : null;   // a list inside an opened node: the row that node is open under is not this list's
  // The keys rest on the opened node itself (not in it): Left closes it, as Right opened it, and its line has the keys again.
  if (row && event.type === 'keydown' && event.key === 'ArrowLeft' && target === row.querySelector(':scope > .lk-open') && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); close(row, true); return; }
  if (row && target.closest('.lk-open')?.closest('.lk-row') === row) return;   // inside the opened node everything is Logseq's
  if (target.closest('.lk-draft')) return;   // the line a new node is typed in has its own ears
  if (row && target.closest('.lk-found')) { if (event.type === 'click' && target.closest('.lk-found-rest')) { event.preventDefault(); event.stopPropagation(); open(row); } return; }
  const plus = target.closest('.lk-plus');
  if (plus) { if (event.type === 'click') { event.preventDefault(); event.stopPropagation(); G.adding.start(state, plus.closest('.lk-list'), plus.closest('.lk-group-head')?.lkGroup || null); } return; }
  if (event.type === 'mousedown') { if (event.shiftKey && target.closest('.lk-line')) event.preventDefault(); return; }   // Shift-click opens beside: it selects no words on its way
  if (state.view && G.pick.act(state, event)) { event.stopPropagation(); return; }
  if (state.ticks && row && event.type === 'click' && target.matches('.lk-row > .lk-tick')) { event.stopPropagation(); row.classList.toggle('lk-picked', target.checked); state.ticks.flip(row.dataset.uuid, row, target.checked); return; }
  if (state.view && G.timeline.act(state, event)) { event.stopPropagation(); return; }
  if (row && event.type === 'click' && state.press && target.closest('.lk-line') && !target.closest('.lk-status, a[data-to], .lk-url') && state.press(row, event)) { event.stopPropagation(); return; }
  if (row && event.type === 'keydown' && state.key && target.matches('.lk-line') && state.key(row, event)) { event.preventDefault(); event.stopPropagation(); return; }
  if (row && G.line.act(event, row, state.more)) { event.stopPropagation(); return; }
  if (state.view && !row && G.listview.act(state, event)) { event.stopPropagation(); return; }
  const head = target.closest('.lk-list-head');
  // Only the arrow folds a list to a press; the rest of its head line (the property's name, the tags) is for reading and choosing
  // (the owner, 26 November 2026: "only click on the chevron shpuld fold the sections of relations not the entire row"). The keys
  // still fold it from the head.
  if (head && head.parentElement.dataset.kind !== 'none' && ((event.type === 'click' && target.closest('.lk-fold')) || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')))) {
    if (target.closest('.lk-tick, button')) return;
    event.preventDefault(); event.stopPropagation(); foldList(state, head.parentElement); return;
  }
  if (event.type === 'click' && target.closest('.lk-more')?.dataset.next && state.next) { state.rolls = true; state.next(target.closest('.lk-list').lkList); return; }   // the rows that wait are brought by the place, and roll out as it draws them
  if (event.type === 'click' && target.closest('.lk-more')) {
    const more = target.closest('.lk-more'), box = more.closest('.lk-list'), gkey = more.dataset.gkey || '', key = gkey || box.dataset.key, fewer = !!more.dataset.fewer, was = more.getBoundingClientRect().top;
    if (fewer) { state.all.delete(key); state.view?.all.delete(key); } else { state.all.add(key); state.view?.all.add(key); }
    moved(state.el, state.redraw);
    // After Show fewer the list's own Show more stands where the press was made, the rows above it coming down to it: the list
    // the person was in stays in the window (the page had shrunk under the view, which was left on the next list or on nothing).
    if (fewer) pin(() => [...box.querySelectorAll('.lk-more')].find(one => (one.dataset.gkey || '') === gkey && !one.dataset.fewer), was);
    return;
  }
  if (event.type === 'keydown' && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && target.matches('.lk-line, .lk-list-head')) {
    const stops = [...state.el.querySelectorAll('.lk-line, .lk-list-head')].filter(el => el.closest('.lk-rel') === state.el && el.offsetParent);
    const next = stops[stops.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); event.stopPropagation(); next.focus(); }
  }
}
// A piece kept at one height in the window while what is above it rolls: what scrolls it follows, frame by frame, for the roll's time.
function pin(find, top) {
  const first = find(); if (!first) return;
  const view = first.ownerDocument.defaultView, port = scroller(first), until = view.performance.now() + G.look.MOTION.roll + 140;
  const step = () => { const el = find(); if (el?.isConnected) { const off = el.getBoundingClientRect().top - top; if (Math.abs(off) > .5) port.scrollTop += off; } if (view.performance.now() < until) view.requestAnimationFrame(step); };
  step();
}
// A list folds: its lines roll up and then it is shut; opened, they roll out. A folded list keeps no kind chosen.
/* One move: where the head has two lines (its name, then its kinds and days), the second line goes and comes with the rows,
   over the same time, and the room under the head with them (it was taken away in one frame, 80 px, before the rows rolled). */
function foldList(state, box) {
  const key = box.dataset.key, rows = box.querySelector(':scope > .lk-rows'), head = box.firstElementChild, second = head.querySelector(':scope > .lk-list-via:not(:empty) ~ .lk-list-name');
  const parts = [rows, ...(second ? [second] : [])];
  const flip = () => { folded.flip(key); state.view?.kinds.delete(key); state.redraw(); };
  if (box.lkShutting) return;
  if (folded.has(key)) { flip(); for (const part of parts) roll(part, 0); return; }
  box.lkShutting = true; head.dataset.rolling = '1'; head.setAttribute('aria-expanded', 'false');
  Promise.all(parts.map(part => rollUp(part))).then(() => { box.lkShutting = false; delete head.dataset.rolling; flip(); for (const part of parts) for (const name of ['height', 'overflow', 'transition']) part.style.removeProperty(name); });
}
/* A line that adds: one field at the head of a place's list. Enter hands its words to add(words), which answers the uuid of what
   it made, or { uuid, steps }: the steps of Logseq's Undo it made, 0 where the thing was there already. The list then moves to
   that row while the field stays in view, and the Undo arrow is set only where something was made: an arrow for nothing would
   take back the person's last change. Escape empties the field and lets go. Gives back what takes the line's ears away. */
function adder(holder, name, add, failed) {
  const doc = holder.ownerDocument, view = doc.defaultView, line = doc.createElement('div'); line.className = 'lk-add';
  line.innerHTML = `<input class="lk-field" type="text" placeholder="${G.esc(name)}" aria-label="${G.esc(name)}" spellcheck="true" autocomplete="off">`;
  holder.prepend(line);
  const field = line.firstElementChild;
  const show = (uuid, tries = 0) => {
    const row = uuid && holder.querySelector(`.lk-row[data-uuid="${uuid}"]`);
    if (!row) { if (tries < 20 && holder.isConnected) view.setTimeout(() => show(uuid, tries + 1), 150); return; }
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const onKey = async event => {
    if (event.key === 'Escape') { field.value = ''; field.blur(); return; }
    if (event.key !== 'Enter' || !field.value.trim() || field.disabled) return;
    event.preventDefault(); event.stopPropagation();
    field.disabled = true;
    try {
      const got = await add(field.value.trim()), told = !!got && typeof got === 'object', uuid = String((told ? got.uuid : got) || '').toLowerCase();
      field.value = '';
      G.undo.mark(uuid, told ? got.steps : 1);   // the way back, at once and only for what was made; the arrow is drawn when the row is
      show(uuid);
    }
    catch (error) { G.write.refused(failed, error); }
    field.disabled = false; field.focus();
  };
  field.addEventListener('keydown', onKey);
  return () => { field.removeEventListener('keydown', onKey); line.remove(); };
}
// Every opened node says each property once, whatever Logseq is set to list under it (touch.once).
function once(base) {
  let placed = new Set();   // the names of the person's own properties that stand at a line's start or end
  const load = async () => { placed = new Set([...(await G.read.schema()).props.values()].filter(prop => /^block-(left|right)$/.test(prop.at)).map(prop => prop.title)); G.touch.once(placed); };
  load().catch(() => {});   // before the graph is up there is none; the next change brings them
  base.onStop(G.touch.changed(() => load().catch(() => {})));
  base.onStop(G.touch.watch(() => G.touch.once(placed)));
  base.onStop(() => G.undo.clear());   // the Undo arrow goes with the plugin: this is the node's one piece main.js starts with a base
}
G.node = { peek, toggle, open, close, roll, rollUp, moved, back, listing, lists, related, adder, follow, folded, hit, once, ARROW, CHEV };
G.node.CSS = `
/* The letters typed, where they are found: semibold in the words' own ink, no colour behind them, no line under them and no
   room of their own, so a word never comes apart. The one look of a match, in every list, menu and sheet (the grammar:
   "The letters typed, in a match are semibold, with no colour behind them"). */
mark.lk-hit { background: none; color: inherit; font-weight: 600; padding: 0; margin: 0; border-radius: 0; }
.lk-rel:empty { display: none; }
.lk-rel { display: flex; flex-direction: column; gap: 18px; container: lk-list / inline-size; }
.lk-list-head[hidden] { display: none; }
.lk-list[hidden] { display: none; }
.lk-list[data-face="tag"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-tag-face); }
.lk-list[data-face="prop"] > .lk-rows > .lk-row > .lk-line .lk-words { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; }
.lk-list[data-kind="none"] .lk-fold { visibility: hidden; }
.lk-list-head { display: flex; align-items: center; gap: 2px var(--lk-mark-gap); min-height: 28px; margin-left: -18px; cursor: default; border-radius: var(--lk-corner); }
.lk-list-head > .lk-fold { cursor: pointer; }
.lk-list-head:focus-visible { outline: none; background: var(--lk-wash); }
.lk-list-head .lk-fold { opacity: 0; margin-top: 0; }
.lk-list-head:hover .lk-fold, .lk-list-head:focus-visible .lk-fold, .lk-list-head[aria-expanded="false"] .lk-fold { opacity: 1; }
/* A group's name over its rows (Todo's "Overdue", Search's "Pages"): small and bold, the one form for every place that lists by groups. */
.lk-list[data-kind="group"] > .lk-list-head > .lk-list-name { font-size: var(--lk-small); font-weight: 600; }
.lk-prop { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; color: var(--lk-quiet); }
.lk-plain { color: var(--lk-quiet); }
.lk-list-name { flex: 1; min-width: 0; display: flex; align-items: baseline; }   /* the kinds (in the tag's face), All and the counts share one baseline */
.lk-list-head:has(> .lk-list-via:not(:empty)) { flex-wrap: wrap; }
.lk-list-via { flex: 1 1 0; min-width: 0; display: flex; align-items: flex-start; min-height: 24px; }
/* A property's list: the arrow and the property's name on the first line, the kinds under the name (one head for every list). */
.lk-list-head:has(> .lk-list-via:not(:empty)) > .lk-list-name { flex: 0 0 100%; padding-left: calc(var(--lk-mark-box) + var(--lk-mark-gap)); }
.lk-list-head[aria-expanded="false"]:not([data-rolling]):has(> .lk-list-via:not(:empty)) > .lk-list-name { display: none; }   /* closed: one line, its name (while it rolls shut the second line is still there, rolling up with the rows) */
.lk-list-head[aria-expanded="false"]:has(> .lk-list-via:not(:empty)) { padding-bottom: 0; }
.lk-list-via > .lk-prop { color: var(--lk-text); font-size: var(--lk-line-size); line-height: 24px; }   /* what the list is: the property, in the ink, at the size of the lines it heads */
.lk-list-via:empty { display: none; }
.lk-list-via > svg:first-child { flex: none; width: 13px; height: 13px; margin: 5.5px 5.5px 0 1.5px; color: var(--lk-off); }
.lk-list-via > .ti:first-child { flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: var(--lk-mark-box); height: 24px; margin: 0 var(--lk-mark-gap) 0 0; font-size: var(--lk-small); color: var(--lk-off); }   /* the mark's box, on the name's first line */
.lk-list-head[data-one] > :is(.lk-fold, .lk-list-name) { display: none; }
/* A list of Relations has the day after the bullet, inside the line. Opened, the node stands where its words stood, and its
   day stays where it was. */
.lk-list[data-viewed] > .lk-rows > .lk-row { position: relative; }
.lk-list[data-viewed]:not(.lk-day-end) > .lk-rows > .lk-row > .lk-day { display: none; }
.lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row[data-open="1"] > .lk-day { display: flex; align-items: baseline; position: absolute; left: 44px; top: 2px; width: var(--lk-dayin, 54px); padding: 0; color: var(--lk-quiet); z-index: 1; }
/* On the baseline of the opened node's first line, as on the line's words it stood beside: a strut of the words' line. */
.lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row[data-open="1"] > .lk-day::before { content: "\\200b"; width: 0; font-size: var(--lk-words-size); line-height: 24px; }
/* The band of a node opened in a list of Relations starts at the row's dot and holds the dot and the day; the node itself starts
   past the day, where the line's words stood. (The owner, 25 November 2026: "this location of grey box": it started under the day.) */
.lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row > .lk-open { --lk-open-shift: 0px; padding-left: calc(var(--lk-dayin, 54px) + 10px); }
/* A node with no day, in a list of dated ones: no empty day before its words. They come after the dated ones, a little apart
   (the owner's marked page, 26 November 2026: "No day, so a wide hole"). */
.lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line > .lk-dayin:empty { display: none; }
.lk-list[data-viewed] > .lk-rows > .lk-row:has(> .lk-line > .lk-dayin:not(:empty)) + .lk-row:has(> .lk-line > .lk-dayin:empty) { margin-top: 10px; }
.lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row:has(> .lk-line > .lk-dayin:empty) > .lk-open { padding-left: 0; }
.lk-list[data-viewed] > .lk-rows > .lk-row[data-open="1"]::before { content: ""; position: absolute; left: 23px; top: 11px; width: 6px; height: 6px; border-radius: 50%; background: var(--lk-line); z-index: 1; }
.lk-list-head[data-thin] { padding-bottom: 6px; align-items: flex-start; transition: padding-bottom .16s ease-out; }   /* the room under the head goes and comes with the fold, in its time */
.lk-list-head[data-thin] > .lk-list-name { align-items: baseline; }
.lk-list-head[data-thin] > .lk-fold { opacity: 1 !important; }   /* the one arrow, in the quiet grey every arrow has, never fainter */
.lk-list-head[data-thin]:hover > .lk-fold { color: var(--lk-text); }
.lk-list-head[data-plain] > .lk-list-via > .lk-plain { font-size: var(--lk-line-size); }
.lk-list[data-picking] .lk-row > .lk-fold { display: none; }
.lk-row > .lk-tick { grid-column: 2; align-self: start; justify-self: center; position: relative; z-index: 1; }
.lk-row > input.lk-tick[type=checkbox] { margin: calc(2px + (24px - 14px) / 2) 0 0; }   /* on the middle of the line's first line: its 2 above, its 24, the tick's 14 */
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-tick { grid-column: 1; grid-row: 1; }   /* where the day is at the right, the box takes the arrow's place before the line (it had a row of its own under it) */
/* The tick for all stands in the mark's box where the head's arrow stands, which gives way to it as a row's arrow does. */
.lk-list-head > .lk-list-name > .lk-tick-all { margin: 0 calc(var(--lk-mark-gap) + (var(--lk-mark-box) - 14px) / 2) 0 calc((var(--lk-mark-box) - 14px) / 2 - var(--lk-mark-box) - var(--lk-mark-gap)); align-self: center; }
.lk-list[data-picking] > .lk-list-head > .lk-fold { visibility: hidden; }
.lk-row.lk-picked > .lk-line { background: var(--lk-wash); border-radius: 6px; }
.lk-said { font-weight: 500; }
/* What a list's head says of its nodes ("4 Transfers", the kinds with their counts) is a size under the lines it heads, in every place (the owner, 26 November 2026). */
.lk-list-head .lk-said, .lk-list-head .lk-tabs { font-size: var(--lk-line-size); }
.lk-list-head:has(> .lk-list-via:not(:empty)) .lk-fold { opacity: 1; }   /* on the count's line the arrow stays in view, faint, as it was */
.lk-list-name .lk-tag { margin-left: .5em; font-size: var(--lk-small); }
.lk-span { margin-left: auto; padding-left: 12px; font-size: var(--lk-small); color: var(--lk-off); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* Where a found node holds the words: the property and its values under its line, on the words' own edge. */
.lk-row > .lk-found { grid-column: 3; min-width: 0; padding: 0 6px 4px 20px; font-size: 14px; line-height: 21px; }
.lk-list:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row > .lk-found { padding-left: calc(20px + var(--lk-dayin, 54px) + 12px); }
.lk-row[data-open] > .lk-found { display: none; }
.lk-found .lk-found-rest { display: block; margin: 0; }
.lk-rows > .lk-more.lk-more-group { display: block; }
/* A narrow place (the sidebar, a node opened deep): the indents shrink. A row's arrow stands in the gutter where its list's
   arrow stands and its bullet on the edge the head's words start on (the owner, 25 November 2026: "This is a sidebar and you
   need to account for that especially with indentation"). */
@container lk-list (max-width: 300px) {
  /* Names and values stack here, each node value with its arrow before it: a row's arrow, its dot and the line under the dot
     stand a step further out than the words, so that arrow has room of its own (26 November 2026: "this is not aligned with
     lines and chevron and the bullets start too far in"). */
  .lk-row > .lk-line > .lk-bul { position: relative; left: -8px; }
  .lk-row > .lk-fold { position: relative; left: -8px; }
  .lk-row > .lk-open { margin-left: calc(var(--lk-open-shift) - 8px); }
  .lk-rows > .lk-row > .lk-open, .lk-list[data-viewed][data-viewed][data-viewed] > .lk-rows > .lk-row > .lk-open { padding-left: 8px; }   /* the band and its line stand out; what is in it stays on the words' edge */
  .lk-list[data-viewed] > .lk-rows > .lk-row[data-open="1"]::before { left: 15px; }
  .lk-list[data-viewed] > .lk-rows { margin-left: -18px; }
  .lk-list[data-viewed] > .lk-rows > .lk-row > .lk-line > .lk-dayin:empty { display: none; }
  .lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row > .lk-open { --lk-open-shift: -2px; padding-left: 0; }   /* measured: the opened node's words stand where its line's words stood */
  .lk-list[data-viewed]:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row[data-open="1"] > .lk-day { display: none; }
  .lk-list:has(> .lk-rows > .lk-row > .lk-line > .lk-dayin) > .lk-rows > .lk-row > .lk-found { padding-left: 20px; }
  .lk-list[data-viewed] .lk-draft .lk-dayin { display: none; }
  .lk-list[data-viewed] > .lk-more.lk-more-link, .lk-list[data-viewed] > .lk-rows > .lk-more.lk-more-link { margin-left: calc(var(--lk-mark-box) + var(--lk-mark-gap)); }
  .lk-list[data-viewed] > .lk-draft { margin-left: -18px; }
}
.lk-plus { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: 4px; padding: 0; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-quiet); opacity: .55; cursor: pointer; }
.lk-plus:hover, .lk-plus:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
@container lk-list (max-width: 300px) { .lk-span { display: none; } }
/* Show more stands on the edge of the rows' words: the arrow's column, the bullet's box and its gap, then (in Relations) the day with its own margins and the gap after it. */
.lk-more.lk-more-link { margin-left: calc(18px + var(--lk-mark-box) + var(--lk-mark-gap) + 6px + var(--lk-dayin, 54px) + 2px + var(--lk-mark-gap)); font-size: inherit; line-height: 24px; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-list:not(:has(.lk-dayin)) > .lk-more.lk-more-link { margin-left: calc(18px + var(--lk-mark-box) + var(--lk-mark-gap)); }
.lk-more { margin: 2px 0 0 calc(var(--lk-daycol, 0px) + 18px + var(--lk-mark-box) + var(--lk-mark-gap)); padding: 2px 0; text-align: start; border: 0; background: none; color: var(--lk-quiet); font: inherit; font-size: var(--lk-small); cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-more:hover { color: var(--lk-text); text-decoration-color: currentColor; }
.lk-day-end > .lk-more, .lk-day-end > :where(.lk-rows) > .lk-more { margin-left: calc(18px + var(--lk-mark-box) + var(--lk-mark-gap)); }
.lk-add { display: flex; margin: -4px 0 12px -22px; padding: 4px 0 0 22px; position: sticky; top: 0; z-index: 2; background: var(--lk-ground, transparent); }   /* stays in view while the list moves to what was added */
.lk-add:has(+ .lk-ask) { position: static; }   /* a box open under it: it scrolls away with the rest, and never floats over the box */
.lk-add .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; line-height: 24px; padding: 2px 0 2px calc(var(--lk-mark-box) + var(--lk-mark-gap) - 18px);   /* the words typed start on the edge of the lists' names below */ box-shadow: none; border-radius: 0; }
.lk-add .lk-field:focus { border-bottom-color: var(--lk-line); }
.lk-add .lk-field::placeholder { color: var(--lk-off); }
.lk-add ~ .lk-rel .lk-row { scroll-margin: 44px 0 8px; }
.lk-open { --lk-open-shift: -2px; margin-left: var(--lk-open-shift); position: relative; }
.lk-open:focus { outline: none; }   /* it holds the keys after it was opened by one; nothing is drawn round it */
/* The levels show: one soft band for the node opened from a row; a node dug into stands under the value it was reached
   through, its rows starting where the value's words start, with a guide line down from the value's arrow. It takes its room
   in one move, once Logseq has drawn it. */
.lk-row > .lk-open { background: color-mix(in srgb, var(--lk-text) 3.5%, transparent); border-radius: var(--lk-corner); padding: 0 8px 6px 0; }   /* a soft band and the hairline down its side (the owner, 26 November 2026, of a picture with both: "have it look like this") */
/* A line down the left side of the node opened from a row, from under its own line to its foot, as before 0.9. */
/* ... under the row's dot, as Logseq draws a bullet's line down to its children: the dot's box is the mark's box at the band's start. */
.lk-row > .lk-open::before { content: ""; position: absolute; left: calc(var(--lk-mark-box) / 2 - .5px - var(--lk-open-shift)); top: 28px; bottom: 8px; width: 1px; background: var(--lk-line); pointer-events: none; }
.lk-dugopen { position: absolute; right: 0; margin: 0; padding: 0 0 6px 14px; opacity: 0; pointer-events: none; container: lk-list / inline-size; }   /* a dug node is measured by its own width, so where it is narrow its rows take the narrow layout (name over value) */
.lk-dugopen[data-whole] { opacity: 1; pointer-events: auto; transition: opacity .16s ease .04s; }
.lk-dugopen.lk-flow { position: relative; margin: 2px 0 6px 28px; }
/* The guide line runs down from the middle of the arrow before the value: the arrow's box is 12 wide and ends 4 before the value's words. */
.lk-dugopen::before { content: ""; position: absolute; left: calc(-1 * (4px + 12px / 2) - .5px); top: 1px; bottom: 8px; width: 1px; background: var(--lk-line); }
/* What points at the node: under one word and a thin line, apart from the node's own rows. */
.lk-relhead { display: flex; align-items: center; gap: 10px; margin: 6px 0 0 22px; color: var(--lk-quiet); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-relhead::after { content: ""; flex: 1; height: 1px; background: var(--lk-hair); }
.lk-open > .lk-relhead:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-dugopen > .lk-relhead { margin-left: 0; }
.lk-row > .lk-open > .lk-rel { margin: 2px 0 6px 40px; }   /* one step in under the word Relations, so a head's mark stands where the word starts */
.lk-dugopen > .lk-rel { margin: 2px 0 0 18px; }`;
})();
