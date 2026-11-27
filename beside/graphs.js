/* BESIDE: the graph switcher (the owner, 27 November 2026: "add feature to tab through the different graphs almost like a cmd-tab
   on a mac", then "have it go vertical list"). Hold Control and press Tab: the graphs stand in a list in the middle of the
   window, the open one first and the one before it lit. Tab again moves down, Shift-Tab up, as do the arrows; let Control go
   and the lit graph opens. A quick Control-Tab goes straight to the graph before, the list never drawn. Escape, or leaving the
   window, closes it and nothing changes; a press on a name opens that graph. From Logseq's list of commands and the corner the
   list stands without a key held: Enter opens, Escape or a press outside closes. Nothing is written to a graph. The order is
   kept on this Mac (core/graphs.js). Cmd-Tab itself is the Mac's. */
(function () {
const G = window.PluginDoor;
const WAIT = 160;   // ms of Control held before the list is drawn
const RECENT = 'lk.graphs-recent';
// The plugin's one menu in its look (node/menu.js), standing in the middle of the window.
const CSS = `
.lk-menu.lk-graphs { left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: 17rem; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); user-select: none; }
.lk-graphs .lk-item-word { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
G.part({
  key: 'graphs', title: 'The graph switcher', about: 'Hold Control and press Tab to go through your graphs, as Cmd-Tab goes through apps.',
  start(base) {
    base.style('graphs', CSS);
    const doc = G.host(), win = doc.defaultView, R = G.graphs;
    // up: the list asked for and not yet taken or let go. held: it was asked for by Control, so letting Control go takes it.
    let up = false, held = false, list = [], at = 0, box = null, timer = 0, back = null, opening = false;
    const kept = G.touch.kept(RECENT, []);   // the order the graphs were opened in, kept on this Mac; where nothing is kept the order is by name
    const recent = () => { const list = kept.get(); return Array.isArray(list) ? list : []; };
    const remember = url => kept.set(R.opened(recent(), url));
    let here = '';
    const note = async () => { const url = await G.touch.graphs.current(); if (url) { here = url; remember(url); } };
    note();
    base.onStop(G.touch.graphChanged(() => { if (up) close(); note(); }));
    function hide() { win.clearTimeout(timer); timer = 0; up = false; held = false; box?.remove(); box = null; back = null; }
    function close() { const give = back; hide(); give?.(); }
    const light = () => { box?.querySelectorAll('.lk-item').forEach((one, i) => { one.classList.toggle('lit', i === at); one.setAttribute('aria-selected', String(i === at)); if (i === at) one.scrollIntoView({ block: 'nearest' }); }); };
    function draw() {
      win.clearTimeout(timer); timer = 0;
      if (!up || box) return;
      box = doc.createElement('div'); box.className = 'lk-menu lk-graphs lk-peeks'; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', 'Graphs');
      box.innerHTML = list.map(url => `<button type="button" class="lk-item" role="option" tabindex="-1" title="${G.esc(R.name(url))}"><span class="lk-item-word">${G.esc(R.name(url))}</span></button>`).join('');
      doc.body.appendChild(box);
      const found = event => [...box.children].indexOf(event.target.closest('.lk-item'));
      // A press keeps the keyboard where it is; the pointer lights what it moves over, as in the Mac's switcher.
      box.addEventListener('mousedown', event => event.preventDefault());
      box.addEventListener('pointermove', event => { const i = found(event); if (i >= 0 && i !== at) { at = i; light(); } });
      box.addEventListener('click', event => { const i = found(event); if (i >= 0) { at = i; take(); } });
      light();
    }
    async function take() {
      const url = list[at];
      if (!url || url === here) return close();
      hide();
      opening = true;
      try { if (!(await G.touch.graphs.open(url))) G.say(`${R.name(url)} was not opened: Logseq’s list of graphs does not show it. Open it from the graph’s name at the top of the left sidebar.`, 'warning'); }
      finally { opening = false; }
    }
    // The list is asked for. here is read before, so the keys never wait on Logseq.
    function ask(by, holding) {
      const all = G.touch.graphs.list();
      if (!all.length) return false;
      list = R.order(all, here ? R.opened(recent(), here) : recent());
      up = true; held = holding; at = list[0] === here ? R.step(0, by, list.length) : 0;
      if (holding) timer = win.setTimeout(draw, WAIT); else { back = G.touch.keepPlace(); doc.activeElement?.blur?.(); draw(); }
      return true;
    }
    const busy = () => G.touch.busy() || !!doc.querySelector('.lk-menu:not(.lk-graphs), dialog[open], [role="alertdialog"]');
    const move = by => { at = R.step(at, by, list.length); if (box) light(); else draw(); };
    // On the window, on the way down: heard before any part, or Logseq, takes the key.
    base.listen(win, 'keydown', event => {
      const tab = event.key === 'Tab' && event.ctrlKey && !event.metaKey && !event.altKey;
      if (!up) {
        if (!tab || opening || busy() || !ask(event.shiftKey ? -1 : 1, true)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        return;
      }
      // While the list is up the keys are its own.
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Tab') move(event.shiftKey ? -1 : 1);
      else if (event.key === 'ArrowDown') move(1);
      else if (event.key === 'ArrowUp') move(-1);
      else if (event.key === 'Escape') close();
      else if (event.key === 'Enter') take();
    }, true);
    base.listen(win, 'keyup', event => {
      if (!up) return;
      event.stopImmediatePropagation();
      if (held && event.key === 'Control') take();
    }, true);
    // A press elsewhere closes it, and lands where it was pressed.
    base.listen(doc, 'pointerdown', event => { if (up && !box?.contains(event.target)) hide(); }, true);
    base.listen(win, 'blur', event => { if (event.target === win && up) close(); });
    base.onStop(() => { hide(); for (const left of doc.querySelectorAll('.lk-graphs')) left.remove(); });
    G.touch.command('lk-graphs', 'Switch graph', () => win.setTimeout(() => { if (!up) ask(1, false); }, 150));
  },
});
})();
