/* Focusing into a bullet and out again (the owner picked C on 11 November 2026, focus-glide-mockup.html beside the
   plugins, after Bike's own focus): where Logseq swaps the whole view in one frame, the bullet glides from where it stood
   to where it lands, its children with it, and the rest fades where it stands. Stepping out runs the same glide back,
   the rest fading in round it, and the bullet comes back selected with Logseq's own selection. A faint up arrow after
   the last step of the line above a focused bullet steps out one level, as pressing that step does.

   Every way in and out goes through Logseq's history: a press on a bullet, Logseq's keys for focusing in and out, a step
   of the line, Back and Forward, a search result. So the view is read just before the history changes (pushState, and
   popstate for Back and Forward, both while the old view is still drawn) and the move is made once the new view is drawn.
   With the Mac's Reduce motion on, the old view only fades. */
(function () {
const Look = window.Look;
const { host, style, listen, onStop, watchScreen, el } = Look.kit, { setting } = Look.settings;
const { ms: TIME, ease: EASE, fadeEase: FADE } = window.PluginDoor.MOTION.glide;
const MOST = 600;   // a view with more blocks than this is not copied for the fade: only the bullet glides
const ROW = ':scope > .block-main-container';
// The glide's keys, Logseq's own for focusing in and out, kept once: the listener matches them and the key sheet reads them at the door.
const Keys = window.PluginDoor.keys, KEYS = { in: 'mod+.', out: 'mod+,' };

const css = `
.breadcrumb--block-page > .lk-out { margin-left: 4px; }
.breadcrumb--block-page > .lk-out::before { margin-right: 0; }
.lk-ghost { position: absolute; overflow: hidden; pointer-events: none; z-index: 9; }
.lk-ghost > * { position: absolute; }
.lk-ghost * { transition: none !important; }`;

const win = () => host().defaultView;
const main = doc => doc.getElementById('main-content-container');
const routeId = () => /#\/page\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(win().location.hash)?.[1] || null;
const rowOf = block => block.querySelector(ROW);
const inView = (rect, box) => rect.bottom > box.top && rect.top < box.bottom && rect.height > 0;
// A block as drawn in the page itself: the first one with its id that is not in the references below it.
const blockIn = (scroller, id) => [...scroller.querySelectorAll(`.ls-block[blockid="${id}"]`)].find(b => !b.closest('.references, .lk-ghost') && rowOf(b)) || null;
// What view is drawn: whether a bullet is focused (the line of steps stands), and the first bullet of the view. The move
// waits until this differs from the view read before the history changed, so it never acts on the old view.
const drawn = scroller => `${!!scroller.querySelector('.breadcrumb--block-page')}|${[...scroller.querySelectorAll('.ls-block[blockid]:not(.lk-ghost *)')].find(rowOf)?.getAttribute('blockid') || ''}`;

let before = null, landed = null;
/* The route shown: on Back and Forward the address has already changed when the view is read, so the route the old view
   belongs to is kept here, set at start and after every change. */
let shown = null;
/* The view as it stands before the history changes: where each block's row is on screen, and a still copy of the view
   for the fade. */
function read() {
  if (!setting('focusGlide')) return;
  // The bullet that came back selected lets go when the view changes again, as it would when pressing elsewhere.
  if (landed) { landed = null; logseq.Editor.clearSelectedBlocks?.(); }
  const doc = host(), scroller = main(doc);
  if (!scroller) return;
  const box = scroller.getBoundingClientRect(), rows = new Map();
  const blocks = scroller.querySelectorAll('.ls-block[blockid]:not(.lk-ghost *)');
  for (const block of blocks) {
    const id = block.getAttribute('blockid');
    if (rows.has(id)) continue;
    const row = rowOf(block); if (!row) continue;
    const rect = row.getBoundingClientRect();
    if (inView(rect, box)) rows.set(id, { x: rect.left, y: rect.top });
  }
  let copy = null;
  if (blocks.length <= MOST && scroller.firstElementChild) {
    copy = scroller.firstElementChild.cloneNode(true);
    for (const node of copy.querySelectorAll('[id]')) node.removeAttribute('id');
    copy.removeAttribute('id');
    const at = scroller.firstElementChild.getBoundingClientRect();   // the copy stands exactly where the view stood
    Object.assign(copy.style, { top: (at.top - box.top) + 'px', left: (at.left - box.left) + 'px', width: at.width + 'px', right: 'auto', margin: '0' });
  }
  before = { at: Date.now(), id: shown ?? routeId(), view: drawn(scroller), rows, copy, box: { left: box.left, top: box.top, width: box.width, height: box.height } };
}

const writing = () => !!host().activeElement?.matches('textarea, input, [contenteditable="true"]');
const reduced = () => window.PluginDoor.still(win());
function fadeOld(doc, copy, box, hide, rows) {
  if (!copy) return;
  const ghost = el(doc, 'div', { class: 'lk-own lk-ghost', 'aria-hidden': 'true' });
  const scroller = main(doc);   // the copy stands in Logseq's view at what is on screen now, so it covers what was on screen then
  Object.assign(ghost.style, { left: scroller.scrollLeft + 'px', top: scroller.scrollTop + 'px', width: box.width + 'px', height: box.height + 'px' });
  if (hide) for (const b of copy.querySelectorAll(`.ls-block[blockid="${hide}"]`)) b.style.visibility = 'hidden';
  // The line of steps never fades (the owner, 12 November 2026: it flashed): it stands where it is and only its words change,
  // and where it comes or goes with the page's title it simply comes or goes.
  for (const line of copy.querySelectorAll('.breadcrumb--block-page')) line.style.visibility = 'hidden';
  ghost.append(copy);
  scroller.append(ghost);   // inside Logseq's view, so its rules for what stands in the view still hold for the copy
  for (const played of ghost.getAnimations({ subtree: true })) played.finish();   // Logseq's own fade-ins shown as they ended, not played again
  // Margins fold differently in a copy that stands on its own, so it is put right by one bullet it holds.
  for (const [id, at] of rows) {
    const row = copy.querySelector(`.ls-block[blockid="${id}"] > .block-main-container`); if (!row) continue;
    const now = row.getBoundingClientRect();
    copy.style.top = (parseFloat(copy.style.top) + at.y - now.top) + 'px'; copy.style.left = (parseFloat(copy.style.left) + at.x - now.left) + 'px';
    break;
  }
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TIME * (reduced() ? .6 : .35), easing: FADE, fill: 'forwards' });
  fade.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), 2000);   // in case the fade never ends (a window in the background)
}

/* Once the new view is drawn: which bullet stays on screen through the move. Going in, the bullet now focused, which
   stood in the old view; going out, the bullet that was focused, which stands in the new one. */
function move(was, tries = 0) {
  const doc = host(), scroller = main(doc);
  if (!scroller || !was) return;
  const now = routeId();
  if (drawn(scroller) === was.view) { if (tries < 30) win().requestAnimationFrame(() => move(was, tries + 1)); return; }
  let id = null, out = false;
  if (now && now !== was.id && was.rows.has(now) && blockIn(scroller, now)) id = now;
  else if (was.id && was.id !== now && blockIn(scroller, was.id)) { id = was.id; out = true; }
  if (!id) return;
  const block = blockIn(scroller, id), row = rowOf(block);
  const box = scroller.getBoundingClientRect();
  if (out && !inView(row.getBoundingClientRect(), box)) row.scrollIntoView({ block: 'center' });
  fadeOld(doc, was.copy, was.box, id, was.rows);
  if (!reduced()) {
    const from = was.rows.get(id);
    const to = row.getBoundingClientRect();
    if (from) block.animate([{ transform: `translate(${from.x - to.left}px, ${from.y - to.top}px)` }, { transform: 'none' }], { duration: TIME, easing: EASE });
    // Everything else in the new view that is on screen fades in where it stands.
    const others = [...scroller.querySelectorAll('.block-main-container, .block-children-left-border, .ls-page-title, .page-title, .ls-page-properties')]
      .filter(node => !block.contains(node) && !node.contains(block) && inView(node.getBoundingClientRect(), box));
    for (const node of others) node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TIME * .8, delay: TIME * (out ? .25 : .35), easing: FADE, fill: 'backwards' });
  }
  // Coming back, the bullet is selected; but where you are writing in it (Cmd-, from the editor), the cursor stays and nothing is selected.
  if (out) setTimeout(async () => {
    if (!setting('focusGlide') || !blockIn(main(host()) || doc, id)) return;
    if (writing() || await logseq.Editor.checkEditing?.()) return;
    landed = id; logseq.Editor.selectBlock?.(id);
  }, reduced() ? 0 : TIME);
}
/* The view was read when the history changed; the move waits for the new view, at most a second. */
function changed() {
  const was = before; before = null; shown = routeId();
  if (!was || Date.now() - was.at > 1000) return;
  win().requestAnimationFrame(() => move(was));
}

// One level out: a press on the last step of the line above a focused bullet. Logseq's step goes on the press (its
// pointerdown and pointerup), not on a click. The arrow and Cmd-, both come here.
function stepOut(doc) {
  const last = [...(main(doc)?.querySelectorAll('.breadcrumb--block-page > a:not(.lk-out)') || [])].pop();
  if (last) window.PluginDoor.screen.press(last);
  return !!last;
}
/* The way out: an up arrow after the last step of the line above a focused bullet, the library's step (lk-step) with its
   up icon; a press on it is a press on that last step. */
function arrow(doc) {
  const line = main(doc)?.querySelector('.breadcrumb--block-page');
  const has = line?.querySelector(':scope > .lk-out');
  if (!line || !setting('focusGlide')) { has?.remove(); return; }
  const steps = line.querySelectorAll(':scope > a:not(.lk-out)');
  if (!steps.length) return;
  if (has) { if (has.previousElementSibling === steps[steps.length - 1]) return; has.remove(); }
  const press = event => { event.preventDefault(); event.stopPropagation(); stepOut(doc); };
  steps[steps.length - 1].after(el(doc, 'a', { class: 'lk-own lk-out lk-step lk-i-up', role: 'button', tabindex: '0', title: 'Step out one level', 'aria-label': 'Step out one level',
    click: press, pointerdown: event => event.stopPropagation(), keydown: event => { if (event.key === 'Enter' || event.key === ' ') press(event); } }));
}

let pushState = null;
function start() {
  style('focus', css);
  const w = win(), history = w.history;
  shown = routeId();
  const own = pushState = history.pushState;
  history.pushState = function (...args) { try { read(); } catch (error) { console.error('Look: could not read the view', error); } const done = own.apply(this, args); changed(); return done; };
  onStop(() => { if (history.pushState !== own) history.pushState = own; pushState = null; });
  listen(w, 'popstate', () => { read(); changed(); }, true);
  watchScreen(arrow, arrow);
  // Cmd-. on the bullet that came back selected focuses into it again, as Cmd-. does on the bullet you write in; so in and out
  // go back and forth by keys alone. Logseq's own Cmd-. is left alone everywhere else.
  // Cmd-, outside the editor in a focused bullet steps out one level, as the arrow does. Logseq alone opens its settings on that
  // key there (tried 12 November 2026); the owner was shown both and the glide keeps the key, settings staying on t s and in the menu.
  onStop(Keys.tell('look.focus', () => KEYS));
  listen(w, 'keydown', event => {
    if (!setting('focusGlide') || writing()) return;
    if (Keys.matches(event, KEYS.in) && landed && host().querySelector(`#main-content-container .ls-block.selected[blockid="${landed}"]`)) {
      event.preventDefault(); event.stopImmediatePropagation();
      logseq.App.pushState('page', { name: landed });
    } else if (Keys.matches(event, KEYS.out) && !landed && main(host())?.querySelector('.breadcrumb--block-page') && !host().querySelector('#main-content-container .ls-block.selected')) {
      event.preventDefault(); event.stopImmediatePropagation();
      stepOut(host());
    }
  }, true);
}
function stop() { style('focus', ''); before = null; landed = null; shown = null; }
Look.focus = { start, stop };
})();
