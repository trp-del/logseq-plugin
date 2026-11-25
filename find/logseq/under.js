/* A linked node seen in the page (0.5, C; the owner, 22 November 2026: "viewing a node should pobably appear more inline"). With
   the caret on or just after a link in the bullet being written, the looking key opens that node under the line, in the page
   itself: Relations' opened node, the one drawing every place uses, rolled out of the line with the lines below moving down. It
   is changed there as anywhere. The key again, or Escape, rolls it up and the caret is where it was. Hyper is not this key (the
   owner: "but that mean I cannot create another link", then "A different key for looking"); a click on a link still opens its page.

   Since 23 November 2026 (the owner: "show the node, which is a link, different underneath than just the outline, like add a background
   or something to make it distinct. it is unclear"; picture 1A) the node stands on the library's ground (lk-ground), with no guide
   line from the margin; its top line says the node's place (Look fills it, as beside a page's title) and holds the close ×, which does
   what Escape and the key again do; and the link that was opened is lit on the same wash (lk-opened; while the line is being written
   the link is letters in Logseq's box, so the wash is laid behind them: lk-opened-at), the opened one only.

   How: an empty element with data-th-node="<uuid>" is put inside the bullet's .ls-block, after its line; Relations fills such
   holders wherever they stand (threads/parts/two-way.js). Nothing is drawn here but the holder's place. One at a time. */
(function () {
const Find = window.Find;
const { host, el, listen, onStop, setting, notify, style } = Find.kit;
const D = window.PluginDoor, Keys = D.keys;
const CSS = `
/* The holder's place: under the line, from the words' left edge, a group's gap below it. The node inside is Relations' drawing. */
.fd-under { margin: 2px 0 var(--lk-gap, 14px) 22px; }
/* Where the wash behind the opened link is laid from: a point at the foot of the line, taking no room. */
.fd-opened-at { position: relative; height: 0; }
.fd-measure { position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; white-space: pre-wrap; }`;

let open = null;   // { holder, block, uuid (the block's), pos, node (the linked node's uuid), watch }

// The link the caret is on or just after: [[name]] or [[uuid]], by the caret's place in the box's words.
const LINK = () => /\[\[([^\]\n]+)\]\]/g;
// nth: which of the line's links to that name it is, so the same one is found again as the line is written on.
function linkAt(box) {
  const at = box.selectionStart, text = box.value;
  const re = LINK(), seen = new Map(); let m;
  while ((m = re.exec(text))) {
    const name = m[1].trim(), nth = seen.get(name) || 0; seen.set(name, nth + 1);
    if (at >= m.index && at <= m.index + m[0].length) return { name, nth, end: m.index + m[0].length };
  }
  return null;
}
// Where that link stands in the words now: [from, to), or null once it was written away.
function linkIn(text, name, nth) {
  const re = LINK(); let m, n = 0;
  while ((m = re.exec(text))) if (m[1].trim() === name && n++ === nth) return [m.index, m.index + m[0].length];
  return null;
}
/* The opened link, lit. Read, the line shows it as Logseq's own link, which takes the library's lk-opened. Written in, the line is
   letters in a box: the same letters are laid out once in an unseen copy of the box to learn where the link's stand, and the wash
   is placed behind them. Done when the line changes (its words, its width, Logseq drawing it again), never on a timer. */
function light() {
  const now = open; if (!now) return;
  const doc = host(), line = now.block.querySelector(':scope > .block-main-container');
  if (!line || !now.lit.isConnected) return;
  const box = line.querySelector('textarea');
  const refs = box ? [] : [...line.querySelectorAll('.block-content-wrapper a.page-ref, .block-content-wrapper .page-reference')].filter(a => !a.querySelector('a.page-ref'));
  const named = refs.filter(a => [a.getAttribute('data-ref'), a.textContent].some(t => String(t || '').trim().toLowerCase() === now.name.toLowerCase()) || a.closest('[data-ref]')?.getAttribute('data-ref')?.toLowerCase() === now.name.toLowerCase());
  const want = named[now.nth] || null;
  for (const a of line.querySelectorAll('.lk-opened')) if (a !== want) a.classList.remove('lk-opened');
  if (want && !want.classList.contains('lk-opened')) want.classList.add('lk-opened');
  let rects = [];
  const at = box ? linkIn(box.value, now.name, now.nth) : null;
  if (at) {
    const cs = doc.defaultView.getComputedStyle(box), copy = el(doc, 'div', { class: 'fd-measure fd-own', 'aria-hidden': 'true' });
    for (const p of ['font', 'letterSpacing', 'wordSpacing', 'textIndent', 'tabSize', 'padding', 'borderWidth', 'borderStyle', 'boxSizing', 'lineHeight', 'wordBreak', 'overflowWrap', 'width']) copy.style[p] = cs[p];
    const span = el(doc, 'span', {}, box.value.slice(at[0], at[1]));
    copy.append(box.value.slice(0, at[0]), span, box.value.slice(at[1]) || ' ');
    doc.body.append(copy);   // outside the bullet, whose changes are what calls this
    const base = copy.getBoundingClientRect(), from = box.getBoundingClientRect(), to = now.lit.getBoundingClientRect();
    rects = [...span.getClientRects()].map(r => [Math.round(r.left - base.left + from.left - to.left) - 3, Math.round(r.top - base.top + from.top - to.top) - 1, Math.round(r.width) + 6, Math.round(r.height) + 2]);
    copy.remove();
  }
  const key = JSON.stringify(rects);
  if (now.lit.dataset.key === key) return;
  now.lit.dataset.key = key;
  now.lit.replaceChildren(...rects.map(([x, y, w, h]) => el(doc, 'span', { class: 'lk-opened-at', style: `left:${x}px;top:${y}px;width:${w}px;height:${h}px` })));
}
let lightFrame = 0;
const lightSoon = () => { if (lightFrame || !open) return; lightFrame = host().defaultView.requestAnimationFrame(() => { lightFrame = 0; light(); }); };
const unlight = was => { was.sized?.disconnect(); was.lit?.remove(); for (const a of was.block.querySelectorAll('.lk-opened')) if (!a.closest('[data-th-node]')) a.classList.remove('lk-opened'); };
async function nodeOf(name) {
  if (D.UUID?.test?.(name)) return name.toLowerCase();
  const page = await Promise.resolve(logseq.Editor.getPage(name)).catch(() => null);
  return page?.uuid ? String(page.uuid).toLowerCase() : null;
}
async function close({ back = true } = {}) {
  const was = open; if (!was) return;
  open = null; was.watch?.disconnect(); unlight(was);
  const inside = was.pressed || was.holder.contains(host().activeElement);
  await D.rollUp(was.holder).catch(() => {});
  was.holder.remove();
  // The caret never left the line unless the node was written in: then it is put back where it was.
  if (back && inside && was.uuid) Promise.resolve(logseq.Editor.editBlock(was.uuid, { pos: was.pos })).catch(() => {});
}
async function look(box) {
  const block = box.closest('.ls-block'), line = block?.querySelector(':scope > .block-main-container');
  if (!block || !line) return;
  const link = linkAt(box), name = link?.name;
  if (!name) return notify('Put the cursor on a link first');
  /* With the caret inside the brackets Logseq lists pages to link, over the very place the node opens in: the caret steps to just
     after the link, and Logseq's list is let go with its own Escape (which closes the list, not the writing). */
  if (box.selectionStart < link.end) { box.setSelectionRange(link.end, link.end); box.dispatchEvent(new (host().defaultView.Event)('select', { bubbles: true })); }
  await new Promise(r => setTimeout(r, 60));
  if (D.screen.editorPopupOpen(host())) { D.screen.key(box, 'Escape'); await new Promise(r => setTimeout(r, 120)); }
  if (host().activeElement !== box) return;   // Logseq took the Escape for the bullet: nothing is opened over a line no longer written
  if (!D.answers?.('relations:node')) return notify('Relations is off, so the page cannot be opened here', 'warning');
  const node = await nodeOf(name);
  if (!node) return notify(`No page is named “${name}” yet`);
  if (open && open.block === block && open.node === node) return close();   // the key again: it rolls up
  await close({ back: false });
  const doc = host();
  style('under', CSS);
  // data-lk-ground: Relations draws a node opened inside this one on a ground of its own, with its place and its ×, and no guide line.
  const holder = el(doc, 'div', { class: 'fd-under fd-own lk-ground', 'data-th-node': node, 'data-lk-under': '1', 'data-lk-ground': '1', contenteditable: 'false' },
    el(doc, 'div', { class: 'lk-ground-top' }, el(doc, 'span', { 'data-lk-place': node }), el(doc, 'button', { type: 'button', class: 'lk-close lk-i-x fd-under-x', 'aria-label': `Close ${name}`, title: 'Close (Esc)' })));
  // Presses inside it are its own: Logseq must not take them for a press on the bullet (which would end the writing).
  for (const type of ['mousedown', 'pointerdown', 'click']) holder.addEventListener(type, event => {
    event.stopPropagation();
    /* A press on something to press (a fold arrow, a ×, a link, a bullet) keeps the caret in the line: otherwise the line lets go of
       its box, Logseq draws the bullet again under the press and the press is lost (found 24 November 2026: the first press on a
       value's fold arrow opened nothing). A press on words to edit takes the keyboard as usual. */
    if (type === 'mousedown' && event.target.closest?.('button, a, .lk-bul, [data-dig]') && !event.target.closest('input, textarea, [contenteditable="true"]')) event.preventDefault();
    if (!event.target.closest?.('.fd-under-x')) return;
    event.preventDefault();   // the caret stays where it is: in the line, the writing goes on
    if (type === 'click' && open?.holder === holder) close();
  });
  const lit = el(doc, 'div', { class: 'fd-opened-at fd-own', 'aria-hidden': 'true', contenteditable: 'false' });
  line.after(lit, holder);
  // Logseq may draw the bullet again and leave the holder out: it is put back while it is open.
  const watch = new doc.defaultView.MutationObserver(() => {
    if (!open || open.holder !== holder) return;
    if (!block.isConnected) return void close({ back: false });
    const l = block.querySelector(':scope > .block-main-container');
    if (l && (!holder.isConnected || !lit.isConnected)) l.after(lit, holder);
    lightSoon();
  });
  watch.observe(block.parentElement || block, { childList: true, subtree: true });
  // The line growing or narrowing (the window, a sidebar) moves the link's letters: the wash follows.
  const sized = doc.defaultView.ResizeObserver ? new doc.defaultView.ResizeObserver(lightSoon) : null;
  sized?.observe(line);
  open = { holder, block, uuid: block.getAttribute('blockid'), pos: box.selectionStart, node, watch, lit, sized, name, nth: link.nth };
  light();
  /* On the last line in the window the node opened below the window's edge, its place and its × out of sight (found 25 November
     2026: the guard's press on the × landed on nothing in a Logseq just started). Its top line is brought into view, by the
     least scroll that shows it; a line already in view moves nothing. */
  holder.firstElementChild?.scrollIntoView?.({ block: 'nearest' });
}
function onKey(event) {
  const doc = host(), at = doc.activeElement;
  if (Keys.matches(event, setting('lookKeys'))) {
    if (setting('look') === false) return;
    const box = at?.tagName === 'TEXTAREA' && at.closest('.ls-block') && !at.closest('[data-th-node]') ? at : null;
    if (!box && !open) return;
    event.preventDefault(); event.stopPropagation();
    if (box) look(box); else close();
    return;
  }
  if (event.key !== 'Escape' || !open || event.defaultPrevented) return;
  // Escape with the caret in the line: the node rolls up and the writing goes on (Logseq never sees this Escape). Inside the
  // node a field's own Escape comes first (Relations'); from the node itself, it rolls up and the caret goes back to the line.
  const inHolder = open.holder.contains(event.target);
  if (inHolder && event.target.closest?.('input, textarea, [contenteditable="true"], [popover]')) return;
  /* A press inside the node leaves the keyboard on no field (the page itself, or the pane holding it): the last press was inside, so
     the Escape is the node's too, and Logseq never sees it (it would select the bullet). Found by hand, 24 November 2026. */
  const loose = open.pressed && !at?.closest?.('input, textarea, select, [contenteditable="true"]') && !D.screen.popupOpen(null, doc, { own: true });   // an open menu or list takes its Escape first
  if (!(inHolder || loose || (at?.tagName === 'TEXTAREA' && open.block.contains(at)))) return;
  event.preventDefault(); event.stopPropagation();
  // One step at a time: a node opened inside this one (on its own ground) closes first, by its ×, as Relations closes it.
  const inner = [...open.holder.querySelectorAll('.lk-ground .lk-ground-top > .lk-close[data-dig]')].pop();
  if (inner) inner.click(); else close();
}
function start() {
  const doc = host();
  listen(doc, 'keydown', onKey, true);
  // Where the last press was: inside the opened node or not (Escape after a press inside closes it).
  listen(doc, 'pointerdown', event => { if (open) open.pressed = open.holder.contains(event.target); }, true);
  listen(doc, 'input', event => { if (open && event.target?.tagName === 'TEXTAREA' && open.block.contains(event.target) && !open.holder.contains(event.target)) lightSoon(); }, true);
  onStop(() => { if (open) { open.watch?.disconnect(); unlight(open); open.holder.remove(); open = null; } });
  onStop(logseq.App.onRouteChanged?.(() => { close({ back: false }); }));
  logseq.App.registerCommandPalette({ key: 'find-look', label: 'Find: look at the link under the cursor' }, () => { const box = host().activeElement; if (box?.tagName === 'TEXTAREA') look(box); else notify('Put the cursor on a link in a bullet first'); });
}
Find.under = { start, look, close, state: () => open };
})();
