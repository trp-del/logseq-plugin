/* NODE: what has just changed, and the way back. After a change the plugin makes to a node that a list shows as a line, a
   small faint arrow stands right after that line's words: a press takes the change back with Logseq's own Undo. Nothing
   lights (the owner, 25 November 2026, chose the arrow as it was before 0.9 over a lit line with the arrow at its end).
   One arrow at a time. A new change's arrow takes the last one's place, and the arrow goes at the next change to the graph
   from anywhere, because Logseq's Undo would then take back that later change and not this one. Where no line shows the node
   any more (it was deleted, or it left the list), the arrow waits at the bottom right of the window.
     G.undo.after(uuid, write)   write: the promise of a change to that node; marks the node once the change is made
     G.undo.mark(uuid, steps)    the same for a change already made; steps: how many steps of Logseq's Undo it is (1)
     G.undo.dress(row)           called by a list (or a table) for each row it draws: the marked node's row gets its arrow */
(function () {
const G = window.PluginDoor;
const ARROW = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h5a3 3 0 0 1 0 6H6M5 6l2.5-2.5M5 6l2.5 2.5"/></svg>';
let last = null;   // { uuid, steps, offChanged, timers: [], dock }
function clear() {
  if (!last) return;
  const doc = G.host();
  last.offChanged?.(); for (const timer of last.timers) doc.defaultView.clearTimeout(timer);
  for (const arrow of doc.querySelectorAll('.lk-undo')) arrow.remove();
  last = null;
}
async function back() {
  const steps = last?.steps || 1, view = G.host().defaultView;
  clear();
  try { for (let i = 0; i < steps; i++) { await G.write.undo(); if (i + 1 < steps) await new Promise(done => view.setTimeout(done, 350)); } } catch (error) { G.say(`It could not be undone: ${error?.message || 'Logseq refused'}`, 'warning'); }
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
  if (!last || row.dataset.uuid !== last.uuid) { row.querySelector(':scope > .lk-line .lk-undo, :scope > .lk-td .lk-undo')?.remove(); return; }
  const line = row.querySelector(':scope > .lk-line') || row.querySelector(':scope > .lk-td');   // a line, or a table's row (node/table.js): after its first cell's words
  if (!line || line.querySelector('.lk-undo')) return;
  const words = line.querySelector(':scope > .lk-words') || line, under = words.querySelector(':scope > .lk-sits');   // inside the words, so it follows the last of them wherever they end; before the small line that says where the node sits
  words.insertBefore(arrow(row.ownerDocument, false), under);
  last.dock?.remove(); last.dock = null;
}
function mark(uuid, steps = 1) {
  uuid = String(uuid || '').toLowerCase();
  if (!uuid) return;
  clear();
  const doc = G.host(), view = doc.defaultView;
  last = { uuid, steps: Math.max(1, Number(steps) || 1), timers: [], dock: null, offChanged: null };
  const mine = last, rows = () => [...doc.querySelectorAll(`:is(.lk-row, .lk-trow)[data-uuid="${uuid}"]`)];
  const light = () => { for (const row of rows()) dress(row); };
  light();
  // The lists read the graph again after the change: the row may be drawn anew, so it is dressed once more when they have.
  mine.timers.push(view.setTimeout(() => { if (last === mine) light(); }, 900));
  // No line shows it any more: the arrow waits at the bottom right.
  mine.timers.push(view.setTimeout(() => { if (last !== mine || doc.querySelector(':is(.lk-row, .lk-trow) .lk-undo')) return; mine.dock = arrow(doc, true); doc.body.appendChild(mine.dock); }, 1500));
  // The change itself is still being told for a moment; after that, any change to the graph ends this arrow.
  mine.timers.push(view.setTimeout(() => { if (last === mine) mine.offChanged = G.touch.changed(() => { if (last === mine) clear(); }); }, 1600));
}
async function after(uuid, write) { const made = await write; mark(uuid, Number.isInteger(made) && made > 0 ? made : 1); return made; }   // a write that answers a number says how many steps it was
G.undo = { after, mark, dress, clear };
G.undo.CSS = `
.lk-undo { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 20px; height: 20px; margin: 0 0 0 4px; padding: 0; vertical-align: -4px; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-text); font: inherit; opacity: .45; cursor: pointer; }
.lk-undo svg { width: 13px; height: 13px; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-undo-dock svg { width: 15px; height: 15px; }
.lk-undo-dock { position: fixed; right: 64px; bottom: 20px; z-index: 9998; width: auto; height: 28px; padding: 0 12px 0 8px; border-radius: var(--lk-corner-round); background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); font-size: var(--lk-line-size); opacity: 1; margin: 0; vertical-align: 0; }
.lk-undo-dock:hover, .lk-undo-dock:focus-visible { background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-text); }`;
})();
