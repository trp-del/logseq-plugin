/* NODE: what has just changed, and the way back. After a change the plugin makes to a node that a list shows as a line, that
   line lights for a moment and then fades, and a faded arrow stands at its end: a press takes the change back with Logseq's
   own Undo (the owner, 25 November 2026: a faded arrow beside what changed; a changed line lights, then fades).
   One arrow at a time. A new change's arrow takes the last one's place, and the arrow goes at the next change to the graph
   from anywhere, because Logseq's Undo would then take back that later change and not this one. Where no line shows the node
   any more (it was deleted, or it left the list), the arrow waits at the bottom right of the window.
     G.undo.after(uuid, write)   write: the promise of a change to that node; marks the node once the change is made
     G.undo.mark(uuid)           the same for a change already made
     G.undo.dress(row)           called by a list for each row it draws: the marked node's row gets its arrow */
(function () {
const G = window.PluginDoor;
const ARROW = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h5a3 3 0 0 1 0 6H6M5 6l2.5-2.5M5 6l2.5 2.5"/></svg>';
let last = null;   // { uuid, since, offChanged, timers: [], dock }
function clear() {
  if (!last) return;
  const doc = G.host();
  last.offChanged?.(); for (const timer of last.timers) doc.defaultView.clearTimeout(timer);
  for (const arrow of doc.querySelectorAll('.lk-undo')) arrow.remove();
  last = null;
}
async function back() {
  clear();
  try { await G.write.undo(); } catch (error) { G.say(`It could not be undone: ${error?.message || 'Logseq refused'}`, 'warning'); }
}
function arrow(doc, docked) {
  const button = doc.createElement('button'); button.type = 'button'; button.className = docked ? 'lk-undo lk-undo-dock' : 'lk-undo';
  button.title = 'Undo'; button.setAttribute('aria-label', 'Undo'); button.innerHTML = ARROW + (docked ? '<span>Undo</span>' : '');
  // Its own ears, so a press on it is never taken for a press on the line it stands in.
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); back(); });
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); });
  button.addEventListener('mousedown', event => event.stopPropagation());
  return button;
}
function dress(row) {
  if (!last || row.dataset.uuid !== last.uuid) { row.querySelector(':scope > .lk-line > .lk-undo')?.remove(); return; }
  const line = row.querySelector(':scope > .lk-line');
  if (!line || line.querySelector(':scope > .lk-undo')) return;
  line.appendChild(arrow(row.ownerDocument, false));
  last.dock?.remove(); last.dock = null;
}
function mark(uuid) {
  uuid = String(uuid || '').toLowerCase();
  if (!uuid) return;
  clear();
  const doc = G.host(), view = doc.defaultView;
  last = { uuid, timers: [], dock: null, offChanged: null };
  const mine = last, rows = () => [...doc.querySelectorAll(`.lk-row[data-uuid="${uuid}"]`)];
  const light = () => { for (const row of rows()) { dress(row); row.classList.remove('lk-lit-now'); void row.offsetWidth; row.classList.add('lk-lit-now'); } };
  light();
  // The lists read the graph again after the change: the row may be drawn anew, so it is lit once more when they have.
  mine.timers.push(view.setTimeout(() => { if (last === mine) light(); }, 900));
  // No line shows it any more: the arrow waits at the bottom right.
  mine.timers.push(view.setTimeout(() => { if (last !== mine || doc.querySelector('.lk-row .lk-undo')) return; mine.dock = arrow(doc, true); doc.body.appendChild(mine.dock); }, 1500));
  // The change itself is still being told for a moment; after that, any change to the graph ends this arrow.
  mine.timers.push(view.setTimeout(() => { if (last === mine) mine.offChanged = G.touch.changed(() => { if (last === mine) clear(); }); }, 1600));
}
async function after(uuid, write) { const made = await write; mark(uuid); return made; }
G.undo = { after, mark, dress, clear };
G.undo.CSS = `
.lk-undo { flex: none; align-self: flex-start; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 22px; height: 24px; margin-left: 2px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--lk-text); font: inherit; opacity: .45; cursor: pointer; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-undo-dock { position: fixed; right: 64px; bottom: 20px; z-index: 9998; width: auto; height: 28px; padding: 0 12px 0 8px; border-radius: 1em; background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); font-size: var(--lk-line-size); opacity: 1; }
.lk-undo-dock:hover, .lk-undo-dock:focus-visible { background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-text); }
.lk-row.lk-lit-now > .lk-line { animation: lk-lit-now 1.8s ease-out; }
@keyframes lk-lit-now { from { background: var(--lk-lit); } 35% { background: var(--lk-lit); } to { background: transparent; } }
@media (prefers-reduced-motion: reduce) { .lk-row.lk-lit-now > .lk-line { animation: none; } }`;
})();
