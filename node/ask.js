/* NODE: the question before a change that reaches far and may not come back whole. A box under the line it answers for: what
   goes, what that takes with it, then a red yes and Cancel (the owner, 25 November 2026: "that color should be red and leave it
   should be cancel"; a question inside a page is an outlined box). The keys wait on Cancel: Enter and Escape leave it, and
   only a press on the red yes goes ahead. One question at a time.
     G.ask.gone(row, { words, note, yes, take })   words: the question; note: what it takes with it; yes: the red press's
                                                   word; take(): the change, answering a promise. Gives back what closes it. */
(function () {
const G = window.PluginDoor;
let shut = null;
function gone(row, { words, note = '', yes = 'Delete', take }) {
  shut?.();
  const doc = row.ownerDocument, box = doc.createElement('div'); box.className = 'lk-ask lk-ask-gone'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-label', words);
  box.innerHTML = `<div class="lk-ask-head">${G.esc(words)}</div>${note ? `<div class="lk-ask-note">${G.esc(note)}</div>` : ''}<div class="lk-answers"><button type="button" class="lk-del" data-do="yes">${G.esc(yes)}</button><button type="button" class="lk-btn lk-low" data-do="no">Cancel</button></div>`;
  row.appendChild(box);
  const close = (refocus = true) => { if (shut !== close) return; shut = null; box.remove(); doc.removeEventListener('pointerdown', outside, true); if (refocus) row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true }); };
  const outside = event => { if (!box.contains(event.target)) close(false); };
  box.addEventListener('click', async event => {
    const does = event.target.closest('[data-do]')?.dataset.do;
    if (!does) return;
    event.preventDefault(); event.stopPropagation();
    if (does === 'no') return close();
    box.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await take(); } catch (error) { G.write.refused('It could not be done', error); }
    close(false);
  });
  for (const type of ['keydown', 'contextmenu', 'mousedown']) box.addEventListener(type, event => {
    if (type === 'keydown' && event.key === 'Escape') { event.preventDefault(); close(); }
    event.stopPropagation();   // nothing in the box is a press or a key on the line it stands under
  });
  doc.addEventListener('pointerdown', outside, true);
  shut = close;
  box.querySelector('[data-do="no"]').focus({ preventScroll: true });
  box.scrollIntoView({ block: 'nearest' });
  return close;
}
G.ask = { gone };
G.ask.CSS = `
.lk-row > .lk-ask-gone { grid-column: 2 / -1; max-width: 420px; margin: 4px 0 10px; padding: 12px; border-radius: var(--lk-corner-float); box-shadow: 0 0 0 1px var(--lk-line); display: flex; flex-direction: column; gap: 6px; font-family: var(--ls-font-family, inherit); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-ask-gone .lk-ask-head { font-weight: 600; }
.lk-ask-gone .lk-ask-note { color: var(--lk-quiet); font-size: var(--lk-small); }
.lk-ask-gone .lk-answers { display: flex; align-items: center; gap: 8px; margin-top: 4px; }`;
})();
