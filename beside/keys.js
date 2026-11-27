/* BESIDE: the key sheet (the owner, 12 November 2026: "can I hold option and a sheet of shortcuts appear"; chosen again on
   26 November 2026). Hold Option on its own for a moment and a sheet of keys stands in the middle of the window. While Option
   is still held it takes nothing: any other key puts it away and does its own job, as do a press of the mouse, the wheel and
   leaving the window. A quick Option with a letter, as in typing é, is over before the sheet would come; Option with Cmd,
   Shift or Ctrl never brings it, nor does it come over one of Logseq's windows or lists, or one of the plugin's.
   Let go of Option once it shows and it stays (the owner: "it should stay after holding it and allow search or highlight if I
   just start typing"): letters typed find among its lines, the words found a step heavier; Up and Down light a line. Escape
   clears what was typed, then closes and gives the keys back where they were; so does a press outside it, where the press
   lands. Every key is read as it stands when the sheet comes (core/sheet.js says which lines there are). Keys are told here,
   not set: Logseq's own keyboard settings set them. */
(function () {
const G = window.PluginDoor;
const HOLD = 700;   // ms of Option alone before the sheet comes; typing é takes a fraction of it
// The words first, each key right after them in a small box (the owner, 12 November 2026); nothing greyed, the page not dimmed.
const CSS = `
.lk-sheet { position: fixed; left: 50%; top: 50%; z-index: 9999; pointer-events: none; box-sizing: border-box; width: 94vw; max-width: 1500px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--lk-corner-float); background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); color: var(--lk-text); font-size: var(--lk-words-size); line-height: 24px;
  opacity: 0; transform: translate(-50%, -50%) scale(.985); transition: opacity .12s ease, transform .12s ease; }
.lk-sheet.on { opacity: 1; transform: translate(-50%, -50%); }
.lk-sheet.stays { pointer-events: auto; }
.lk-sheet .lk-field { flex: none; margin: 22px 36px 0; padding: 2px 0; border: 0; border-bottom: 1px solid var(--lk-line); border-radius: 0; outline: 0; box-shadow: none; background: none; color: inherit; font: inherit; }
.lk-sheet .lk-field::placeholder { color: var(--lk-off); }
.lk-sheet:not(.stays) .lk-field { visibility: hidden; }
.lk-sheet-body { padding: 22px 36px 6px; columns: 3; column-gap: 56px; overflow: auto; min-height: 0; }
.lk-sheet-group { break-inside: avoid; padding-bottom: 32px; }   /* a line's pitch is 32: every line of every column on one grid */
.lk-sheet-group.lk-long { break-inside: auto; }
.lk-sheet-body.finding .lk-sheet-group { break-inside: avoid; }   /* a few lines found: each group whole, under its heading */
.lk-sheet-head { break-after: avoid; margin: 0; padding: 4px 0; font-size: var(--lk-line-size); font-weight: 600; line-height: 24px; }   /* drawn as high as a line, so the columns stay on the grid */
.lk-sheet-line { margin: 0 -6px; padding: 4px 6px; border-radius: var(--lk-corner); break-inside: avoid; }
.lk-sheet-line.lit { background: var(--lk-wash); }
.lk-sheet-keys { margin-left: 10px; white-space: nowrap; }
.lk-sheet-keys .lk-keycap + .lk-keycap { margin-left: 6px; }
.lk-sheet mark.lk-hit { background: none; color: inherit; font-weight: 600; padding: 0; margin: 0; border-radius: 0; }
.lk-sheet-none { margin: 0 0 20px; color: var(--lk-quiet); }
.lk-sheet [hidden] { display: none !important; }
@media (max-width: 1000px) { .lk-sheet { font-size: var(--lk-line-size); } .lk-sheet-body { columns: 2; } }
@media (prefers-reduced-motion: reduce) { .lk-sheet { transition: none; transform: translate(-50%, -50%); } }`;
G.part({
  key: 'keys', title: 'The key sheet', about: 'Hold Option on its own for a moment and a sheet of keys comes: let go and it stays, to type into.',
  start(base) {
    base.style('keys', CSS);
    const doc = G.host(), win = doc.defaultView;
    let timer = 0, box = null, stays = false, back = null, pressed = false;
    // The Mac's marks in the system face: a mono face draws ⌘ and ⌥ small or not at all.
    const cap = key => `<span class="lk-keycap">${G.esc(key).replace(/[⌘⌥⇧⌃↩⇥⎋⌫⌦↑↓←→]/g, '<span class="lk-keymark">$&</span>')}</span>`;
    const lineHtml = line => `<div class="lk-sheet-line"><span class="lk-sheet-words">${G.esc(line.words)}</span><span class="lk-sheet-keys">${line.keys.map(cap).join('')}</span></div>`;
    function body() {
      const all = G.touch.logseqCommands().concat(G.touch.commands().map(one => ({ id: one.name, label: one.label, key: one.key })));
      const search = G.started.some(part => part.key === 'search') ? { takesKey: G.setting('searchTakesSearchKey') !== false } : null;
      const corner = G.started.some(part => part.key === 'corner') ? { takesKey: G.setting('cornerTakesCommandKey') !== false } : null;
      return G.sheet.groups(all, search, corner, G.started.some(part => part.key === 'graphs')).map(group => `<section class="lk-sheet-group${group.lines.length > 12 ? ' lk-long' : ''}"><div class="lk-sheet-head">${G.esc(group.head)}</div>${group.lines.map(lineHtml).join('')}</section>`).join('');
    }
    // It fades out as it came, and is gone from the page once faded.
    function hide() {
      win.clearTimeout(timer); timer = 0; stays = false; back = null;
      const gone = box; box = null;
      if (!gone) return;
      gone.classList.remove('on', 'stays');
      if (gone.contains(doc.activeElement)) doc.activeElement.blur();   // no key lands in a sheet on its way out
      win.setTimeout(() => gone.remove(), 140);
    }
    // Closed by a key: the keys go back where they were, a bullet being written opened again with its caret.
    function close() { const give = back; hide(); give?.(); }
    // One of Logseq's windows or lists, or one of the plugin's, is open: it has its own keys.
    const windowOpen = () => G.touch.busy() || !!doc.querySelector('.lk-menu, dialog[open], [role="dialog"]:not(.lk-sheet), [role="alertdialog"]');
    function show() {
      win.clearTimeout(timer); timer = 0;
      if (windowOpen()) return;
      box = doc.createElement('div'); box.className = 'lk-sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Keys');
      box.innerHTML = `<input class="lk-field" type="text" placeholder="Find a key" aria-label="Find a key" spellcheck="false" autocomplete="off"><div class="lk-sheet-body">${body()}</div>`;
      doc.body.appendChild(box);
      box.getBoundingClientRect();   // laid out first, so it fades in
      box.classList.add('on');
      // A press on the sheet keeps the keyboard in the find line.
      box.addEventListener('mousedown', event => { if (event.target.tagName !== 'INPUT') event.preventDefault(); });
      box.querySelector('.lk-field').addEventListener('input', narrow);
    }
    // Option let go once the sheet shows: it stays, and takes the keyboard into its find line.
    function stay() {
      if (!box) return;
      stays = true; back = G.touch.keepPlace(); box.classList.add('stays');
      box.style.height = box.offsetHeight + 'px';   // finding never makes it jump: the lines go, the sheet stays its size
      box.querySelector('.lk-field').focus({ preventScroll: true });
    }
    const light = line => { box.querySelector('.lk-sheet-line.lit')?.classList.remove('lit'); if (line) { line.classList.add('lit'); line.scrollIntoView({ block: 'nearest' }); } };
    const shown = () => [...box.querySelectorAll('.lk-sheet-line:not([hidden])')];
    // The words typed find among the lines: a line whose words hold every word typed stays; a group left with none goes.
    function narrow() {
      const typed = box.querySelector('.lk-field').value.trim(), list = box.querySelector('.lk-sheet-body');
      for (const line of list.querySelectorAll('.lk-sheet-line')) {
        const words = line.querySelector('.lk-sheet-words'), pieces = G.sheet.found(words.textContent, typed);
        line.hidden = !pieces;
        words.innerHTML = (pieces || [{ text: words.textContent }]).map(piece => piece.hit ? `<mark class="lk-hit">${G.esc(piece.text)}</mark>` : G.esc(piece.text)).join('');
      }
      for (const group of list.querySelectorAll('.lk-sheet-group')) group.hidden = !group.querySelector('.lk-sheet-line:not([hidden])');
      list.classList.toggle('finding', !!typed);
      list.querySelector('.lk-sheet-none')?.remove();
      if (!shown().length) list.insertAdjacentHTML('afterbegin', '<p class="lk-sheet-none">No key does that.</p>');
      list.scrollTop = 0;
      light(typed ? shown()[0] : null);
    }
    function step(by) {
      const lines = shown(), at = lines.indexOf(box.querySelector('.lk-sheet-line.lit'));
      if (lines.length) light(lines[Math.max(0, Math.min(lines.length - 1, at < 0 ? (by > 0 ? 0 : lines.length - 1) : at + by))]);
    }
    // While the sheet stays the keys are its own: none reaches Logseq or the other parts.
    function stayingKey(event) {
      event.stopPropagation();
      const field = box.querySelector('.lk-field');
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); if (field.value) { field.value = ''; narrow(); } else close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); step(event.key === 'ArrowDown' ? 1 : -1); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); return; }
      if (event.target !== field && !event.metaKey && !event.ctrlKey) field.focus({ preventScroll: true });
    }
    // On the window, on the way down: heard before any part, or Logseq, takes the key.
    base.listen(win, 'keydown', event => {
      if (stays) return stayingKey(event);
      if (event.key !== 'Alt') return hide();   // any other key goes on to its own job
      if (event.repeat) return;
      hide();
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.isComposing || pressed) return;
      G.touch.keysRead();   // read while Option is held, so a key changed in Logseq's settings shows
      timer = win.setTimeout(show, HOLD);
    }, true);
    base.listen(win, ['keyup', 'keypress'], event => {
      if (stays) { event.stopPropagation(); return; }
      if (event.type !== 'keyup' || event.key !== 'Alt') return;
      if (box) stay(); else hide();
    }, true);
    // A press of the mouse: while Option is held it puts the sheet away; once it stays, only a press outside it does.
    const outside = event => { if (!stays || !box?.contains(event.target)) hide(); };
    base.listen(doc, ['pointerdown', 'mousedown'], event => { pressed = true; outside(event); }, true);
    base.listen(doc, ['pointerup', 'mouseup', 'pointercancel', 'dragend'], () => { pressed = false; }, true);
    base.listen(doc, 'wheel', outside, { capture: true, passive: true });
    base.listen(win, 'blur', event => { if (event.target !== win) return; pressed = false; if (!stays) hide(); });
    base.listen(doc, 'visibilitychange', hide);
    base.onStop(() => { hide(); for (const left of doc.querySelectorAll('.lk-sheet')) left.remove(); });
    // Another way in, from Logseq's list of commands and the corner: the sheet open and staying, as after a hold.
    G.touch.command('lk-keys', 'Show the keys', () => G.touch.keysRead().then(() => win.setTimeout(() => { hide(); show(); stay(); }, 150)));
  },
});
})();
