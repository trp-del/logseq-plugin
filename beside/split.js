/* BESIDE: two pages side by side. A Cmd-press on a link in the main view (a link in the words or in a property's value, a tag,
   a line of the plugin's lists) opens that page beside the one shown: the main area in two halves, your page on the left, the one
   pressed on the right. The right half is Logseq's own right sidebar drawn as a page (touch.beside), so it is a whole page of
   Logseq's to write in. A plain press and a Shift-press do what they always do.
   Between the halves one hairline: dragged, a half grows (never under 320); pressed twice, equal halves. Over the right page's
   corner two icons drawn as Logseq's own: swap the two pages, and close the right one. Closing puts the sidebar back as it was.
   Opening anything in the sidebar, or shutting it, ends the split and leaves the sidebar yours. A half never stands blank.
   Nothing is written to the graph. */
(function () {
const G = window.PluginDoor;
const MIN = 320;        // the narrowest a half is dragged to
const SHOW_MS = 2500;   // how long the page beside may take to show
const NOT_SHOWN = 'The page could not be shown beside, so the two pages were put back as one.';
G.part({
  key: 'split', title: 'Two pages side by side', about: '⌘-click a link in the main view and its page opens beside the one you are on.',
  start(base) {
    const side = G.touch.beside, doc = G.host(), view = doc.defaultView;
    base.style('split', G.touch.SPLIT + `
/* The line between the halves: a strip the hand can hold, all of it on the right page, so the left page's scroll bar stays free. */
body > .lk-split-line { position: fixed; top: 0; bottom: 0; left: calc(100vw - var(--lk-split-w, 50vw)); width: 10px; z-index: 11; cursor: col-resize; touch-action: none; background: none; -webkit-app-region: no-drag; }
body > .lk-split-line::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 1px; background: var(--lk-hair); }
body.lk-split-coming > :is(.lk-split-line, .lk-split-tools) { visibility: hidden; }
body > .lk-split-line:hover::before, body > .lk-split-line.lk-held::before { background: var(--lk-line); }
/* Swap and close: their size, grey and place are read from Logseq's own icons on the left page's header. */
body > .lk-split-tools { position: fixed; z-index: 11; display: flex; align-items: center; -webkit-app-region: no-drag; }
body > .lk-split-tools > button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; margin: 0; border: 0; background: none; cursor: pointer; -webkit-app-region: no-drag; }
body > .lk-split-tools > button:is(:hover, :focus-visible) { opacity: 1 !important; background: var(--lk-wash); outline: none; }`);
    /* The one state: the node on the right, the share of the main area it takes, what the sidebar was before, and whether a change
       of the split's own is under way (the sidebar's list is then changing by our hand). */
    const split = { node: null, ratio: .5, before: null, busy: false, lost: 0 };
    let timer = 0, offSized = null, offProps = null, tools = null, line = null, stopped = false;

    const layout = () => {
      if (!split.node || split.leaving) return;
      const whole = Math.max(0, view.innerWidth - side.mainLeft());
      const share = whole < MIN * 2 ? .5 : Math.min(1 - MIN / whole, Math.max(MIN / whole, split.ratio));
      const width = `${Math.round(whole * share)}px`, root = doc.documentElement.style;
      if (root.getPropertyValue('--lk-split-w') !== width) root.setProperty('--lk-split-w', width);
      const like = tools && side.headIcons();
      if (!like) return;
      Object.assign(tools.style, { top: `${like.top}px`, right: `${like.edge}px`, gap: `${like.gap}px` });
      for (const button of tools.children) {
        Object.assign(button.style, { width: `${like.width}px`, height: `${like.height}px`, padding: like.padding, borderRadius: like.radius, color: like.color, opacity: like.opacity });
        if (like.stroke) button.querySelector('svg')?.setAttribute('stroke-width', parseFloat(like.stroke) || 2);
      }
    };
    const makeTools = () => {
      const box = doc.createElement('div'); box.className = 'lk-split-tools';
      box.innerHTML = [['swap', 'Swap pages', 'arrowsLeftRight'], ['close', 'Close the right page', 'x']]
        .map(([what, word, icon]) => `<button type="button" data-do="${what}" title="${word}" aria-label="${word}">${G.touch.icon(icon, 20)}</button>`).join('');
      const press = event => { const what = event.target.closest('button')?.dataset.do; if (!what) return; event.preventDefault(); event.stopPropagation(); (what === 'swap' ? swap : close)(); };
      box.addEventListener('click', press);
      box.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') press(event); });   // Logseq takes Enter for itself unless it is held here
      return box;
    };
    const makeLine = () => {
      const strip = doc.createElement('div'); strip.className = 'lk-split-line';
      strip.setAttribute('role', 'separator'); strip.setAttribute('aria-orientation', 'vertical'); strip.setAttribute('aria-label', 'Between the two pages: drag to make one wider, double-click for equal halves');
      strip.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault(); strip.setPointerCapture?.(event.pointerId); strip.classList.add('lk-held');
        const held = event.clientX - strip.getBoundingClientRect().left;   // where it was taken, so it does not jump to the pointer
        const move = at => { const whole = view.innerWidth - side.mainLeft(); if (whole > 0) { split.ratio = (view.innerWidth - at.clientX + held) / whole; layout(); } };
        const up = () => {
          strip.classList.remove('lk-held'); for (const [type, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) strip.removeEventListener(type, fn);
          const whole = view.innerWidth - side.mainLeft(), width = parseFloat(doc.documentElement.style.getPropertyValue('--lk-split-w'));
          if (whole > 0 && width) split.ratio = width / whole;   // dragged past a limit, the share is the width it stopped at
        };
        strip.addEventListener('pointermove', move); strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
      });
      strip.addEventListener('dblclick', () => { split.ratio = .5; layout(); });
      return strip;
    };
    // The right half, and the split's own pieces, put on screen again whenever Logseq draws its screen anew.
    const draw = () => {
      if (!split.node) return;
      if (!side.mark(split.node.id, { page: split.node.isPage, title: split.node.title, kind: split.node.kind })) return;
      if (!tools?.isConnected) doc.body.appendChild(tools = makeTools());
      if (!line?.isConnected) doc.body.appendChild(line = makeLine());
      layout();
    };
    // Takes everything of the split's off the screen; the sidebar is then drawn as it always is.
    const clear = () => {
      doc.body.classList.remove('lk-split-coming');
      view.clearInterval(timer); timer = 0; offSized?.(); offSized = null; offProps?.(); offProps = null;
      tools?.remove(); line?.remove(); tools = line = null;
      side.unmark(); doc.documentElement.style.removeProperty('--lk-split-w');
      split.node = null; split.before = null; split.lost = 0; split.leaving = false;
    };
    /* The split's end. By the split's own doing (restore) the sidebar goes back as it was: the page beside taken out of its list
       unless it stood there before, the same order, open or shut. After a change by hand, nothing of the list is touched. */
    const end = async restore => {
      const { node, before } = split;
      if (!node) return;
      split.busy = true;
      try {
        if (restore) {
          if (!before.list.includes(node.id)) await side.takeOut(node.id);
          await side.reorder(before.list);
          if (!before.open) side.setOpen(false);
        }
      } catch (error) { console.error('Logseq Plugin: the sidebar could not be put back as it was', error); }
      finally { clear(); split.busy = false; }
    };
    const fail = async previous => {
      console.warn('Logseq Plugin: the page beside was not shown', split.node?.uuid);
      try { if (previous && !split.before.list.includes(previous.id)) await side.takeOut(previous.id); } catch (error) { console.error('Logseq Plugin: a page could not be taken out of the sidebar', error); }
      await end(true);
      G.say(NOT_SHOWN, 'warning');
    };
    // Opens a node on the right: the split begins, or the page already there gives way to it.
    const open = async to => {
      if (split.busy) return;
      split.busy = true;
      try {
        const node = await G.read.opened(to);
        if (!node || stopped || node.id === split.node?.id) return;
        const previous = split.node;
        if (!previous) split.before = { open: side.isOpen(), list: side.list() };
        split.node = node; split.lost = 0;
        let waits = null;
        if (!previous) {
          // The half waits off the window's right edge while its page is drawn, then comes in.
          layout(); waits = side.slide(1, 1, 1, 'linear'); doc.body.classList.add('lk-split-coming'); side.mark(node.id, { page: false, title: '', kind: '' });   // the half stands, empty, before the page comes, so nothing shows at the sidebar's own width
          if (!G.on('calm') || G.setting('calm-side') === false) offProps = side.openProps();
          offSized = side.mainSized(layout);
          timer = view.setInterval(watch, 1000);   // besides the passes over the screen: a change they do not report must not leave a white half either
        }
        await side.put(node.uuid);
        const came = await side.until(() => { draw(); return side.shown(node.id); }, SHOW_MS);
        doc.body.classList.remove('lk-split-coming');
        if (!came) { waits?.drop(); split.busy = false; await fail(previous); return; }
        if (waits) { const { in: ms, ease } = G.look.MOTION.beside, comes = side.slide(1, 0, ms, ease); waits.drop(); comes.done.then(comes.drop); }
        else { const body = side.body(node.id); if (body) G.node.roll(body, 0); }   // another page in the half already there
        if (previous && !split.before.list.includes(previous.id)) await side.takeOut(previous.id);   // one that was in the sidebar before the split stays in it
      } catch (error) { console.error('Logseq Plugin: a page could not be opened beside', error); if (split.node) { split.busy = false; await fail(null); } }
      finally { split.busy = false; }
    };
    // Closes the right half: it leaves by the right edge; then the left page takes the whole width.
    const close = async () => {
      if (!split.node || split.busy) return;
      split.busy = true;
      const { out: ms, ease } = G.look.MOTION.beside, goes = side.slide(0, 1, ms, ease);
      await goes.done;
      // The left page takes the width as the half is gone, not once the sidebar has been put back behind it.
      split.leaving = true; doc.documentElement.style.setProperty('--lk-split-w', '0px');
      await end(true);
      goes.drop();
    };
    // The page on the left goes to the right half, the right one to the main view.
    const swap = async () => {
      if (!split.node || split.busy) return;
      const right = split.node.uuid, left = await side.mainPage();
      if (!left) return G.say('The left shows no page to swap.');
      if (left === right) return;
      await open(left);
      if (split.node?.uuid === left) G.touch.open(right);
    };
    // Logseq's sidebar changed by hand (something else opened in it, or it shut) ends the split. Otherwise it stays drawn.
    function watch() {
      if (!split.node || split.busy) return;
      if (!side.isOpen() || side.list()[0] !== split.node.id) return void end(false);
      draw();
      // The page gone from the screen (deleted, or Logseq drawing anew): if it does not come back in a moment, the split closes.
      if (side.shown(split.node.id)) { split.lost = 0; return; }
      if (!split.lost) split.lost = Date.now();
      else if (Date.now() - split.lost >= SHOW_MS) fail(null);
    }
    base.onStop(side.presses((to, how, click) => {
      if (how === 'beside') { if (click) open(to); return true; }
      // Shift-press on a link to the very page beside: Logseq's list does not change, so the split is ended here.
      if (split.node && !split.busy) G.read.opened(to).then(node => { if (node && node.id === split.node?.id && !split.busy) end(false); });
    }));
    base.listen(view, 'resize', layout);
    base.onStop(G.touch.watch(watch));
    base.onStop(G.touch.changed(async () => {   // the page beside renamed: its title follows
      const now = split.node, node = now && await G.read.opened(now.uuid);
      if (node && split.node === now && node.id === now.id) { split.node = node; draw(); }
    }));
    base.onStop(async () => { stopped = true; await end(true); });   // the plugin stopped or loaded again closes the split as its × does
  },
});
})();
