/* NODE: what has just changed, and the way back. After a change the plugin makes to a node that a list shows as a line, a
   small faint arrow stands right after that line's words: a press takes the change back with Logseq's own Undo. Nothing
   lights (the owner, 25 November 2026, chose the arrow as it was before 0.9 over a lit line with the arrow at its end).
   The arrow stands only for a change that was made: a write that answers no steps of Undo draws none, and leaves the arrow
   that stands (a press on an arrow for nothing would take back the person's last change instead).
   One arrow at a time. A new change's arrow takes the last one's place, and the arrow goes at the next change to the graph
   from anywhere, because Logseq's Undo would then take back that later change and not this one. That next change is heard at
   once, as soon as the plugin's own change is no longer being told (a third of a second with nothing heard). The arrow goes
   too when another graph is opened and when the plugin stops. Where no line shows the node any more (it was deleted, or it
   left the list), the arrow waits at the bottom right of the window.
   A change of several steps goes back one step after another. Should the person begin to write in a bullet meanwhile, the
   steps stop there and a notice says so: Logseq's Undo takes its newest change, and their words would be the newest.
     G.undo.after(uuid, write)   write: the promise of a change to that node; marks the node once the change is made. A write
                                 that answers a number says how many steps it was (0: nothing was written, so no arrow)
     G.undo.mark(uuid, steps)    the same for a change already made; steps: how many steps of Logseq's Undo it is (1)
     G.undo.hold(steps, gone)    a change to several nodes at once, whose place draws the press for the way back itself (the
                                 bar of picked nodes): no arrow is drawn, and everything else is the arrow's own. Answers what
                                 G.undo.back takes (null where no step was made); gone() runs when the way back is no longer there
     G.undo.back(held)           a held change taken back, where it still stands; answers whether all of it went back
     G.undo.dress(row)           called by a list (or a table) for each row it draws: the marked node's row gets its arrow
     G.undo.clear()              the arrow taken away (node/node.js calls it when the plugin stops) */
(function () {
const G = window.PluginDoor;
const ARROW = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h5a3 3 0 0 1 0 6H6M5 6l2.5-2.5M5 6l2.5 2.5"/></svg>';
const QUIET = 300, LONGEST = 1600, PACE = 350;   // how long nothing must be heard before the plugin's own change counts as told; the longest that wait may last; the wait between two steps of Undo
let last = null;   // { uuid, steps, timers: [], offs: [], dock, gone }
function clear() {
  const was = last;
  if (!was) return;
  last = null;
  const doc = G.host();
  for (const off of was.offs) { try { off(); } catch (error) { /* an ear already gone */ } }
  for (const timer of was.timers) doc.defaultView.clearTimeout(timer);
  for (const arrow of doc.querySelectorAll('.lk-undo')) arrow.remove();
  try { was.gone?.(); } catch (error) { console.error('Logseq Plugin: a place could not let go of its Undo', error); }
}
async function back(only) {
  const mine = last;
  if (!mine || (only && only !== mine)) return false;
  const steps = mine.steps, view = G.host().defaultView;
  clear();
  let done = 0;
  try {
    for (; done < steps; done++) {
      if (done && G.touch.writing()) break;   // words begun meanwhile are never what goes back
      await G.write.undo();
      if (done + 1 < steps) await new Promise(next => view.setTimeout(next, PACE));
    }
  } catch (error) { G.write.refused('It could not be undone', error); return false; }
  if (done < steps) G.say(`Undo stopped after ${done} of ${steps} steps, so that the words you began to write are not taken back. The rest of the change stands.`, 'warning', true);
  return done >= steps;
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
  if (!last || !last.uuid || row.dataset.uuid !== last.uuid) { row.querySelector(':scope > .lk-line .lk-undo, :scope > .lk-td .lk-undo')?.remove(); return; }
  const line = row.querySelector(':scope > .lk-line') || row.querySelector(':scope > .lk-td');   // a line, or a table's row (node/table.js): after its first cell's words
  if (!line || line.querySelector('.lk-undo')) return;
  const words = line.querySelector(':scope > .lk-words') || line, under = words.querySelector(':scope > .lk-sits');   // inside the words, so it follows the last of them wherever they end; before the small line that says where the node sits
  words.insertBefore(arrow(row.ownerDocument, false), under);
  last.dock?.remove(); last.dock = null;
}
/* A change that can be taken back stands, in place of the one before. From here on the graph is listened to at every change:
   what is heard while the plugin's own change is still being told (until nothing has been heard for QUIET) is that change;
   anything heard after ends this way back, as does another graph opened. */
function stand(steps, uuid, gone) {
  clear();
  const view = G.host().defaultView, mine = last = { uuid, steps, timers: [], offs: [], dock: null, gone };
  let told = false, quiet = 0;
  const wait = () => { view.clearTimeout(quiet); quiet = view.setTimeout(() => { told = true; }, QUIET); };
  wait();
  mine.timers.push(view.setTimeout(() => { told = true; }, LONGEST));
  mine.offs.push(() => view.clearTimeout(quiet),
    G.touch.changed(() => { if (last !== mine) return; if (told) clear(); else wait(); }, true),
    G.touch.graphChanged(() => { if (last === mine) clear(); }));
  return mine;
}
const count = steps => { const n = Math.floor(Number(steps)); return n > 0 ? n : 0; };
function mark(uuid, steps = 1) {
  uuid = String(uuid || '').toLowerCase();
  const n = count(steps);
  if (!uuid || !n) return;   // nothing was written: no arrow
  const doc = G.host(), view = doc.defaultView, mine = stand(n, uuid, null);
  const rows = () => [...doc.querySelectorAll(`:is(.lk-row, .lk-trow)[data-uuid="${uuid}"]`)];
  const light = () => { for (const row of rows()) dress(row); };
  light();
  // The lists read the graph again after the change: the row may be drawn anew, so it is dressed once more when they have.
  mine.timers.push(view.setTimeout(() => { if (last === mine) light(); }, 900));
  // No line shows it any more: the arrow waits at the bottom right.
  mine.timers.push(view.setTimeout(() => { if (last !== mine || doc.querySelector(':is(.lk-row, .lk-trow) .lk-undo')) return; mine.dock = arrow(doc, true); doc.body.appendChild(mine.dock); }, 1500));
}
const hold = (steps, gone) => { const n = count(steps); return n ? stand(n, '', typeof gone === 'function' ? gone : null) : null; };
async function after(uuid, write) { const made = await write; mark(uuid, typeof made === 'number' ? made : 1); return made; }   // a write that answers a number says how many steps it was; none, no arrow
G.undo = { after, mark, hold, back, dress, clear };
G.undo.CSS = `
.lk-undo { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 20px; height: 20px; margin: 0 0 0 4px; padding: 0; vertical-align: -4px; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-text); font: inherit; opacity: .45; cursor: pointer; }
.lk-undo svg { width: 13px; height: 13px; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-undo-dock svg { width: 15px; height: 15px; }
.lk-undo-dock { position: fixed; right: 64px; bottom: 20px; z-index: 9998; width: auto; height: 28px; padding: 0 12px 0 8px; border-radius: var(--lk-corner-round); background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); font-size: var(--lk-line-size); opacity: 1; margin: 0; vertical-align: 0; }
.lk-undo-dock:hover, .lk-undo-dock:focus-visible { background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-text); }`;
})();
