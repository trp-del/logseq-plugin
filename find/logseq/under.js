/* A linked node seen in the page (0.5, C; the owner, 22 November 2026: "viewing a node should pobably appear more inline"). With
   the caret on or just after a link in the bullet being written, the looking key opens that node under the line, in the page
   itself: Relations' opened node, the one drawing every place uses, rolled out of the line with the lines below moving down. It
   is changed there as anywhere. The key again, or Escape, rolls it up and the caret is where it was. Hyper is not this key (the
   owner: "but that mean I cannot create another link", then "A different key for looking"); a click on a link still opens its page.

   How: an empty element with data-th-node="<uuid>" is put inside the bullet's .ls-block, after its line; Relations fills such
   holders wherever they stand (threads/parts/two-way.js). Nothing is drawn here but the holder's place. One at a time. */
(function () {
const Find = window.Find;
const { host, el, listen, onStop, setting, notify, style } = Find.kit;
const D = window.PluginDoor, Keys = D.keys;
const CSS = `
/* The holder's place: under the line, from the words' left edge, a group's gap below it. The node inside is Relations' drawing. */
.fd-under { margin: 2px 0 var(--lk-gap, 14px) 22px; }`;

let open = null;   // { holder, block, uuid (the block's), pos, node (the linked node's uuid), watch }

// The link the caret is on or just after: [[name]] or [[uuid]], by the caret's place in the box's words.
function linkAt(box) {
  const at = box.selectionStart, text = box.value;
  const re = /\[\[([^\]\n]+)\]\]/g; let m;
  while ((m = re.exec(text))) if (at >= m.index && at <= m.index + m[0].length) return m[1].trim();
  return null;
}
async function nodeOf(name) {
  if (D.UUID?.test?.(name)) return name.toLowerCase();
  const page = await Promise.resolve(logseq.Editor.getPage(name)).catch(() => null);
  return page?.uuid ? String(page.uuid).toLowerCase() : null;
}
async function close({ back = true } = {}) {
  const was = open; if (!was) return;
  open = null; was.watch?.disconnect();
  const inside = was.holder.contains(host().activeElement);
  await D.rollUp(was.holder).catch(() => {});
  was.holder.remove();
  // The caret never left the line unless the node was written in: then it is put back where it was.
  if (back && inside && was.uuid) Promise.resolve(logseq.Editor.editBlock(was.uuid, { pos: was.pos })).catch(() => {});
}
async function look(box) {
  const block = box.closest('.ls-block'), line = block?.querySelector(':scope > .block-main-container');
  if (!block || !line) return;
  const name = linkAt(box);
  if (!name) return notify('Put the cursor on a link first');
  if (!D.answers?.('relations:node')) return notify('Relations is off, so the page cannot be opened here', 'warning');
  const node = await nodeOf(name);
  if (!node) return notify(`No page is named “${name}” yet`);
  if (open && open.block === block && open.node === node) return close();   // the key again: it rolls up
  await close({ back: false });
  const doc = host();
  style('under', CSS);
  const holder = el(doc, 'div', { class: 'fd-under fd-own', 'data-th-node': node, 'data-lk-under': '1', contenteditable: 'false' });
  // Presses inside it are its own: Logseq must not take them for a press on the bullet (which would end the writing).
  for (const type of ['mousedown', 'pointerdown', 'click']) holder.addEventListener(type, event => event.stopPropagation());
  line.after(holder);
  // Logseq may draw the bullet again and leave the holder out: it is put back while it is open.
  const watch = new doc.defaultView.MutationObserver(() => {
    if (!open || open.holder !== holder) return;
    if (!block.isConnected) return void close({ back: false });
    if (!holder.isConnected) { const l = block.querySelector(':scope > .block-main-container'); if (l) l.after(holder); }
  });
  watch.observe(block.parentElement || block, { childList: true, subtree: true });
  open = { holder, block, uuid: block.getAttribute('blockid'), pos: box.selectionStart, node, watch };
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
  if (inHolder || (at?.tagName === 'TEXTAREA' && open.block.contains(at))) { event.preventDefault(); event.stopPropagation(); close(); }
}
function start() {
  const doc = host();
  listen(doc, 'keydown', onKey, true);
  onStop(() => { if (open) { open.watch?.disconnect(); open.holder.remove(); open = null; } });
  onStop(logseq.App.onRouteChanged?.(() => { close({ back: false }); }));
  logseq.App.registerCommandPalette({ key: 'find-look', label: 'Find: look at the link under the cursor' }, () => { const box = host().activeElement; if (box?.tagName === 'TEXTAREA') look(box); else notify('Put the cursor on a link in a bullet first'); });
}
Find.under = { start, look, close, state: () => open };
})();
