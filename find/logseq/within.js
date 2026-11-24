/* The filter bar: the page in front of you narrowed for a moment (the owner, 23 November 2026: "also fingure out a way to filter
   bullets in view like based on properties, tags etc. I am not talking about in a query since this would only be atemporary thing.
   so it would be on top but not in the way of things since you have to see bullets", then, of the first drawings, "I was thinking
   more of an input bar, where you can type free text but also do the tag or property search. it is more flexible"; picture 3D).

   One key brings up one bar on the library's glass at the foot of the main pane, over the page, moving nothing. Words typed narrow
   the page to the bullets whose words or property values hold every one of them. While you type, a short list above the bar offers
   what is on this page and matches the letters: tags, property values ("Provider: Dr. Mei Chen") and linked pages; Enter takes the
   lit one and it stands in the bar as a piece with its own ×. Pieces and words narrow together. A bullet that matches is shown with
   everything under it; the bullets it sits under stay, in the off grey; the rest is hidden, or greyed (the word at the bar's right
   end switches). Escape, the ×, or the key again clears the bar, closes it and leaves the page as it was.

   Nothing is written: the bullets are marked on the screen only (data-fd-w on a bullet, data-fd-within on the pane), no fold is
   changed, nothing is saved, nothing goes into Undo. So a match inside a folded bullet is not opened (Logseq 2.0.2 keeps a fold in
   the graph): the folded bullet stays, in the text colour, as the place the match is in.

   What the page holds is read once through Find's own reader (db.js: details and facets) when the bar opens and again a moment
   after the graph changes; typing only compares, so the page follows each letter with no wait. */
(function () {
const Find = window.Find;
const { host, el, listen, onStop, setting, notify, style } = Find.kit;
const D = window.PluginDoor, Keys = D.keys;
const norm = text => D.sentence.norm(text);
const SCROLLER = 'main-content-container', MOST = 6;
const CSS = `
/* Where the bar stands: over the foot of the main pane, placed from the pane's own edges (--fd-w-*), above the page and under Logseq's menus. */
.fd-within { position: fixed; left: var(--fd-w-left, 12px); bottom: var(--fd-w-bottom, 12px); width: var(--fd-w-width, 300px); z-index: 20; }
.fd-within-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; padding: 5px 6px 5px 10px; font-size: var(--lk-small); line-height: 1.4; }
.fd-within-input { all: unset; flex: 1 1 90px; min-width: 90px; padding: 2px 0; cursor: text; }
.fd-within-input::placeholder { color: var(--lk-off); }
.fd-within-bar > .lk-value { flex: none; white-space: nowrap; padding: 2px 6px; }
.fd-within-bar > .lk-close { all: unset; flex: none; cursor: pointer; padding: 2px 6px; }
/* The list of what can be picked: just above the bar, never wider than it; a long name is cut. */
.fd-within-list { position: absolute; left: 0; bottom: calc(100% + 6px); min-width: min(250px, 100%); max-width: 100%; font-size: var(--lk-small); }
.fd-within-list:empty { display: none; }
.fd-within-list .lk-item > :first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fd-within-list .lk-item > .lk-note { flex: none; }
/* The page, narrowed: what does not match is out of the way, hidden or in the off grey; a bullet a match sits under stays, in the off grey. */
#${SCROLLER}[data-fd-within="hidden"] .ls-block[data-fd-w="out"] { display: none !important; }
/* In a long list Logseq draws only the bullets near the window and measures each one (2.0.2: react-virtuoso, [data-item-index]); one of
   no height it reports as an error and cannot place. There a hidden bullet keeps a hair of height, unseen. */
#${SCROLLER}[data-fd-within="hidden"] [data-item-index]:has(> .ls-block[data-fd-w="out"]) { height: 1px; overflow: hidden; visibility: hidden; }
#${SCROLLER}[data-fd-within="hidden"] [data-item-index] > .ls-block[data-fd-w="out"] { display: block !important; }
#${SCROLLER}[data-fd-within] .ls-block[data-fd-w="way"] > .block-main-container, #${SCROLLER}[data-fd-within="greyed"] .ls-block[data-fd-w="out"] > .block-main-container { color: var(--lk-off); }
#${SCROLLER}[data-fd-within] .ls-block[data-fd-w="way"] > .block-main-container :is(a, span, .tag, .page-ref), #${SCROLLER}[data-fd-within="greyed"] .ls-block[data-fd-w="out"] > .block-main-container :is(a, span, .tag, .page-ref) { color: inherit !important; }
.fd-within-none { margin: 0 0 0 22px; }`;

let S = null;   // the bar while it is open: { box, bar, list, input, mode, pieces, typed, offers, lit, data, before, off: [], token }

const scroller = () => host().getElementById(SCROLLER);
const blockOf = row => row.parentElement;

/* What the page holds, read through Find's reader. The pages are those of the bullets on screen (one page, the days of the
   journals, the page a focused bullet is on); every bullet of theirs is read with the bullet it sits in, so a match inside a
   folded bullet is known though Logseq has not drawn it. */
async function read() {
  const now = S; if (!now) return;
  const token = (now.token = (now.token || 0) + 1);
  const shown = [...new Set(D.pageRows(scroller()).map(row => blockOf(row).getAttribute('blockid')).filter(u => D.UUID.test(u || '')))];
  const data = { nodes: new Map(), tags: new Map(), said: new Map(), pages: new Map() };
  if (shown.length) {
    // The pages first (a few at most), then each page's bullets by its id: one question joining both took seconds on a long page.
    const some = shown.slice(0, 400).map(u => `#uuid "${u}"`).join(' ');
    const pages = [...new Set((await D.query(`[:find ?p :where [(ground [${some}]) [?s ...]] [?x :block/uuid ?s] [?x :block/page ?p]]`).catch(() => [])).map(([p]) => Number(p)).filter(Number.isSafeInteger))].slice(0, 40);
    const rows = (await Promise.all(pages.map(p => D.query(`[:find ?b ?u ?par :where [?b :block/page ${p}] [?b :block/uuid ?u] [?b :block/parent ?pb] [?pb :block/uuid ?par] (not [?b :logseq.property/deleted-at _]) (not [?b :logseq.property/created-from-property _])]`).catch(() => [])))).flat();
    const parents = new Map(rows.map(([, u, par]) => [String(u).toLowerCase(), String(par).toLowerCase()]));
    const ids = [...new Set(rows.map(([b]) => b))];
    const [nodes, index] = await Promise.all([ids.length ? Find.db.details(ids, []) : [], Find.db.tagIndex()]);
    const held = nodes.length ? await Find.db.facets(nodes) : { byNode: new Map(), said: new Map() };
    if (S !== now || now.token !== token) return;
    const above = id => { const out = new Set(), walk = t => { if (!t || out.has(t.id)) return; out.add(t.id); (t.parents || []).forEach(walk); }; walk(index.byId.get(id)); return out; };
    for (const n of nodes) {
      const kinds = new Set(); for (const t of n.tags) for (const id of above(t)) kinds.add(id);
      const props = held.byNode.get(n.id) || new Set(), refs = new Set(n.parts.filter(p => p.uuid).map(p => p.uuid));
      const hay = norm([n.text, ...[...props].map(k => held.said.get(k)?.label || '')].join(' \n '));
      data.nodes.set(n.uuid, { kinds, props, refs, hay, parent: parents.get(n.uuid) || '' });
      for (const t of n.tags) { const tag = index.byId.get(t); if (tag && !tag.own) data.tags.set(t, { id: t, title: tag.title, count: (data.tags.get(t)?.count || 0) + 1 }); }
      for (const k of props) { const v = held.said.get(k); if (v) data.said.set(k, { key: k, name: v.name, label: v.label, count: (data.said.get(k)?.count || 0) + 1 }); }
      for (const p of n.parts) if (p.uuid && p.text) data.pages.set(p.uuid, { uuid: p.uuid, title: p.text, count: (data.pages.get(p.uuid)?.count || 0) + 1 });
    }
  }
  if (S !== now || now.token !== token) return;
  now.data = data;
  offer(); apply();
}

// Whether a bullet holds everything asked: every piece, and every word typed, in its words or its property values.
const words = () => norm(S.typed).split(' ').filter(Boolean);
const asking = () => S.pieces.length > 0 || words().length > 0;
function holds(node, typed) {
  for (const p of S.pieces) {
    if (p.kind === 'tag' ? !node.kinds.has(p.id) : p.kind === 'property' ? !node.props.has(p.key) : !node.refs.has(p.uuid)) return false;
  }
  return typed.every(w => node.hay.includes(w));
}
/* The page marked. A match and what is under it: as written. A bullet a match sits under: kept (way), or, folded with the match
   inside it, kept as it is (held). The rest: out. The bullet being written in is never out, nor one not read yet. */
function apply() {
  const now = S, pane = scroller(); if (!now || !pane) return;
  const rows = D.pageRows(pane), nodes = now.data?.nodes || new Map();
  let typed = words(), on = asking() && !!now.data;
  const hits = new Set(), ways = new Set();
  const find = () => { hits.clear(); ways.clear(); for (const [uuid, node] of nodes) if (holds(node, typed)) { hits.add(uuid); for (let p = node.parent, n = 0; p && n < 64 && !ways.has(p); p = nodes.get(p)?.parent, n++) ways.add(p); } };
  if (on) find();
  /* Letters that lead to a piece in the short list but stand in no bullet's words ("pur" on the way to the tag Purchase; found by
     hand, 24 November 2026): the page stays as the pieces already set leave it, and waits for Enter, rather than going blank. */
  if (on && typed.length && !hits.size && now.offers.length) { typed = []; on = now.pieces.length > 0; if (on) find(); else hits.clear(); }
  const writing = host().activeElement?.tagName === 'TEXTAREA' ? host().activeElement.closest('.ls-block[blockid]') : null;
  /* Whether anything matches here is asked of what was read, not of what is drawn: Logseq draws a long page piece by piece, and a
     match further down has no element yet. A match counts when it is on screen or under a bullet that is (a focused bullet shows
     only what is under it). */
  const drawn = new Set(rows.map(row => blockOf(row).getAttribute('blockid')));
  const here = uuid => { for (let u = uuid, n = 0; u && n < 64; u = nodes.get(u)?.parent, n++) if (drawn.has(u)) return true; return false; };
  let seen = 0, changed = false;
  if (on) for (const uuid of hits) if (here(uuid)) { seen = 1; break; }
  const mark = (block, value) => { if ((block.getAttribute('data-fd-w') || '') === value) return; changed = true; if (value) block.setAttribute('data-fd-w', value); else block.removeAttribute('data-fd-w'); };
  for (const row of rows) {
    const block = blockOf(row), uuid = block.getAttribute('blockid');
    if (!on) { mark(block, ''); continue; }
    const under = () => { for (let e = block.parentElement?.closest('.ls-block[blockid]'); e && pane.contains(e); e = e.parentElement?.closest('.ls-block[blockid]')) if (hits.has(e.getAttribute('blockid'))) return true; return false; };
    if (hits.has(uuid)) mark(block, '');
    else if (!nodes.has(uuid) || block === writing || under()) mark(block, '');
    else if (ways.has(uuid)) mark(block, block.getAttribute('data-collapsed') === 'true' ? '' : 'way');   // folded with the match inside it: kept as it is, the place the match is in
    else mark(block, 'out');
  }
  const mode = on ? now.mode : '';
  if ((pane.getAttribute('data-fd-within') || '') !== mode) { changed = true; if (mode) pane.setAttribute('data-fd-within', mode); else pane.removeAttribute('data-fd-within'); }
  /* Logseq's long list works out which bullets to draw from the heights it has measured, and looks again only when the page is
     scrolled or resized. Bullets hidden or brought back change those heights, so it is told to look again, once per change: it
     then draws the bullets that now fit, they are marked as they come (the screen watcher), and it settles when nothing changes. */
  if (changed) host().defaultView.requestAnimationFrame(() => { if (S === now) pane.dispatchEvent(new (host().defaultView.Event)('scroll')); });
  // Nothing matches (and nothing is offered for the letters): the library's nothing-here line where the bullets would stand, the bar still open.
  const none = on && !seen && rows.length > 0;
  if (none && !now.none?.isConnected) { now.none = el(host(), 'div', { class: 'lk-none fd-within-none fd-own' }, 'No bullet on this page holds that.'); (blockOf(rows[0]).closest('.ls-page-blocks, .blocks-container') || blockOf(rows[0])).before(now.none); }
  else if (!none && now.none) { now.none.remove(); now.none = null; }
}

/* What the letters could be on this page: tags, property values, linked pages, the ones that start with the letters first. */
function offer() {
  const now = S; if (!now) return;
  const q = norm(now.typed), data = now.data;
  let found = [];
  if (q && data) {
    const picked = new Set(now.pieces.map(p => p.kind + ':' + (p.id ?? p.key ?? p.uuid)));
    const rank = text => { const t = norm(text); return t.startsWith(q) ? 0 : t.split(/[\s:]+/).some(w => w.startsWith(q)) ? 1 : t.includes(q) ? 2 : -1; };
    const all = [
      ...[...data.tags.values()].map(t => ({ kind: 'tag', id: t.id, label: t.title, count: t.count, at: rank(t.title) })),
      ...[...data.said.values()].map(v => ({ kind: 'property', key: v.key, name: v.name, label: v.label, count: v.count, at: Math.min(...[rank(v.label), rank(`${v.name}: ${v.label}`)].filter(n => n >= 0), 9) })).map(o => ({ ...o, at: o.at === 9 ? -1 : o.at })),
      ...[...data.pages.values()].map(p => ({ kind: 'page', uuid: p.uuid, label: p.title, count: p.count, at: rank(p.title) })),
    ];
    const order = { tag: 0, property: 1, page: 2 };
    found = all.filter(o => o.at >= 0 && !picked.has(o.kind + ':' + (o.id ?? o.key ?? o.uuid))).sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind] || b.count - a.count || a.label.localeCompare(b.label)).slice(0, MOST);
  }
  now.offers = found; now.lit = found.length ? Math.min(Math.max(now.lit, 0), found.length - 1) : 0;
  drawList();
}
const pieceWords = (doc, o) => o.kind === 'tag' ? el(doc, 'span', { class: 'lk-tag' }, o.label)
  : o.kind === 'property' ? el(doc, 'span', {}, el(doc, 'span', { class: 'lk-prop' }, o.name + ': '), o.label)
  : el(doc, 'span', {}, o.label);
function drawList() {
  const now = S, doc = host();
  now.list.replaceChildren(...now.offers.map((o, i) => el(doc, 'button', { type: 'button', class: 'lk-item' + (i === now.lit ? ' on' : ''), role: 'option', 'aria-selected': String(i === now.lit), title: o.kind === 'property' ? `${o.name}: ${o.label}` : o.label,
    mousedown: event => event.preventDefault(), click: () => take(i) }, pieceWords(doc, o), el(doc, 'span', { class: 'lk-note off' }, o.kind))));
  now.input.setAttribute('aria-expanded', String(now.offers.length > 0));
}
function drawPieces() {
  const now = S, doc = host();
  for (const old of now.bar.querySelectorAll('.lk-piece')) old.remove();
  now.pieces.forEach((p, i) => now.bar.insertBefore(el(doc, 'span', { class: 'lk-piece', title: p.kind === 'property' ? `${p.name}: ${p.label}` : p.label }, pieceWords(doc, p),
    el(doc, 'button', { type: 'button', class: 'lk-x', 'aria-label': `Take off ${p.label}`, title: 'Take this off', mousedown: event => event.preventDefault(), click: () => drop(i) }, '×')), now.input));
  now.input.placeholder = now.pieces.length ? '' : 'filter this page';
}
function take(i) {
  const now = S, o = now?.offers[i]; if (!o) return;
  now.pieces.push(o); now.typed = ''; now.input.value = ''; now.lit = 0;
  drawPieces(); offer(); apply(); now.input.focus({ preventScroll: true });
}
function drop(i) { const now = S; if (!now) return; now.pieces.splice(i, 1); drawPieces(); offer(); apply(); now.input.focus({ preventScroll: true }); }
function switchMode() {
  const now = S; if (!now) return;
  now.mode = now.mode === 'hidden' ? 'greyed' : 'hidden';
  now.modeWord.textContent = now.mode === 'hidden' ? 'The rest hidden' : 'The rest greyed';
  apply(); now.input.focus({ preventScroll: true });
}
// The bar follows the main pane's edges: over its foot, as wide as it lets (640 at most), centred.
function place() {
  const now = S, pane = scroller(); if (!now || !pane) return;
  const r = pane.getBoundingClientRect(), win = host().defaultView;
  // Logseq's help button stands in the pane's bottom right corner: in a narrow pane the bar ends before it.
  const help = host().querySelector('.cp__sidebar-help-btn')?.getBoundingClientRect();
  const room = help && help.width && help.bottom > r.bottom - 60 && help.left > r.left + 220 ? Math.min(pane.clientWidth - 24, help.left - r.left - 20) : pane.clientWidth - 24;
  const w = Math.max(200, Math.min(room, 640));
  now.box.style.setProperty('--fd-w-left', Math.round(r.left + Math.max(12, Math.min((pane.clientWidth - w) / 2, room + 12 - w))) + 'px');
  now.box.style.setProperty('--fd-w-width', Math.round(w) + 'px');
  now.box.style.setProperty('--fd-w-bottom', Math.round(win.innerHeight - r.bottom + 12) + 'px');
}
function onKey(event) {
  const now = S; if (!now) return;
  event.stopPropagation();   // Logseq's own keys stay out of the line being typed
  if (event.isComposing || event.keyCode === 229) return;   // an input method is still choosing its letters
  if (event.key === 'Escape' || Keys.matches(event, setting('withinKeys'))) { event.preventDefault(); return void close(); }
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && now.offers.length) { event.preventDefault(); now.lit = (now.lit + (event.key === 'ArrowDown' ? 1 : now.offers.length - 1)) % now.offers.length; return drawList(); }
  if (event.key === 'Enter') { event.preventDefault(); if (now.offers.length) take(now.lit); return; }
  if (event.key === 'Backspace' && !now.input.value && now.pieces.length) { event.preventDefault(); drop(now.pieces.length - 1); }
}
function open() {
  if (S) return void S.input.focus({ preventScroll: true });
  const doc = host(), pane = scroller();
  if (!pane) return notify('Open a page first');
  style('within', CSS);
  const box = doc.activeElement?.tagName === 'TEXTAREA' && pane.contains(doc.activeElement) ? doc.activeElement : null;
  const before = { top: pane.scrollTop, uuid: box?.closest('.ls-block[blockid]')?.getAttribute('blockid') || '', pos: box?.selectionStart ?? 0 };
  const input = el(doc, 'input', { class: 'fd-within-input', type: 'text', placeholder: 'filter this page', spellcheck: 'false', autocomplete: 'off', role: 'combobox', 'aria-label': 'Filter the bullets on this page', 'aria-expanded': 'false',
    input: () => { if (!S) return; S.typed = input.value; S.lit = 0; offer(); apply(); }, keydown: onKey });
  const modeWord = el(doc, 'button', { type: 'button', class: 'lk-value', title: 'Hide the rest, or grey it', mousedown: event => event.preventDefault(), click: switchMode }, 'The rest hidden');
  const bar = el(doc, 'div', { class: 'fd-within-bar lk-pop', click: event => { if (event.target === bar) input.focus({ preventScroll: true }); } }, input, modeWord,
    el(doc, 'button', { type: 'button', class: 'lk-close lk-i-x', 'aria-label': 'Close the filter', title: 'Close (Esc)', mousedown: event => event.preventDefault(), click: () => close() }));
  const list = el(doc, 'div', { class: 'fd-within-list lk-pop lk-menu', role: 'listbox' });
  const whole = el(doc, 'div', { class: 'fd-within fd-own', contenteditable: 'false' }, list, bar);
  for (const type of ['keydown', 'keyup', 'keypress']) whole.addEventListener(type, event => event.stopPropagation());
  doc.body.append(whole);
  S = { box: whole, bar, list, input, modeWord, mode: 'hidden', pieces: [], typed: '', offers: [], lit: 0, data: null, before, off: [], none: null, timer: 0 };
  place();
  const win = doc.defaultView, sized = win.ResizeObserver ? new win.ResizeObserver(place) : null;
  sized?.observe(pane);
  S.off.push(() => sized?.disconnect());
  // Logseq drawing more of the page (a long page comes in pieces, a fold opened by hand): the new bullets are marked too.
  S.off.push(D.watch(() => { if (S) apply(); }));
  input.focus({ preventScroll: true });
  read().catch(error => console.error('Find: the page could not be read for the filter bar', error));
}
/* Closed: the marks off, the page where it was, the caret back in the bullet it stood in. back: false when the page itself has
   gone (another page opened, the plugin stopping). */
function close({ back = true } = {}) {
  const was = S; if (!was) return;
  S = null; clearTimeout(was.timer);
  for (const off of was.off) { try { off(); } catch (error) { /* already gone */ } }
  const pane = scroller();
  for (const block of host().querySelectorAll('.ls-block[data-fd-w]')) block.removeAttribute('data-fd-w');
  pane?.removeAttribute('data-fd-within');
  was.none?.remove(); was.box.remove();
  pane?.dispatchEvent(new (host().defaultView.Event)('scroll'));   // Logseq's long list looks again at the bullets brought back
  if (!back || !pane) return;
  pane.scrollTop = was.before.top;
  if (was.before.uuid) Promise.resolve(logseq.Editor.editBlock(was.before.uuid, { pos: was.before.pos })).then(() => { pane.scrollTop = was.before.top; }).catch(() => {});
}
function onDocKey(event) {
  if (!Keys.matches(event, setting('withinKeys')) || setting('within') === false) return;
  if (S && S.box.contains(event.target)) return;   // the bar's own keys close it
  event.preventDefault(); event.stopPropagation();
  if (S) close(); else open();
}
function start() {
  listen(host(), 'keydown', onDocKey, true);
  listen(host().defaultView, 'resize', place, { passive: true });
  onStop(() => close({ back: false }));
  onStop(logseq.App.onRouteChanged?.(() => close({ back: false })));
  // The graph changed (a bullet written, a tag set): the page is read again a moment later, the bar as it is.
  onStop(logseq.DB.onChanged(() => { if (!S) return; clearTimeout(S.timer); S.timer = setTimeout(() => read().catch(() => {}), 700); }));
  logseq.App.registerCommandPalette({ key: 'find-within', label: 'Find: filter the bullets on this page' }, () => { if (S) close(); else open(); });
}
Find.within = { start, open, close, state: () => S && { pieces: S.pieces.map(p => p.label), typed: S.typed, mode: S.mode, offers: S.offers.map(o => o.label) } };
})();
