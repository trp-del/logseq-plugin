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
   A change of several steps goes back one step after another, and the arrow stays, faint and not pressable, until the last
   step has gone back; then it goes (nothing else is drawn for it). Should the person begin to write in a bullet meanwhile,
   or make another change through the plugin, the steps stop there and a notice says so: Logseq's Undo takes its newest
   change, and theirs would be the newest.
     G.undo.after(uuid, write)   write: the promise of a change to that node; marks the node once the change is made. A write
                                 that answers a number says how many steps it was (0: nothing was written, so no arrow)
     G.undo.mark(uuid, steps)    the same for a change already made; steps: how many steps of Logseq's Undo it is (1)
     G.undo.hold(steps, gone)    a change to several nodes at once, whose place draws the press for the way back itself (the
                                 bar of picked nodes): no arrow is drawn, and everything else is the arrow's own. Answers what
                                 G.undo.back takes (null where no step was made); gone() runs when the way back is no longer there
     G.undo.back(held)           a held change taken back, where it still stands; answers whether all of it went back
     G.undo.dress(row)           called by a list (or a table) for each row it draws: the marked node's row gets its arrow
     G.undo.beside(words, uuid)  for a line that is not a row (a line of Ontology's History): the arrow stands after what the
                                 element words holds, while the change that stands is that node's (uuid). Called when the line
                                 is drawn; the element is remembered, so an arrow set after the drawing finds it too. Nothing
                                 of a row is needed, and the place styles nothing. Answers whether the arrow stands there
     G.undo.taken(fn)            fn(uuid, whole) runs when a press on the arrow, wherever it stands (a row, a plain line, the
                                 bottom right), has finished taking its change back; whole: every step went back (false where
                                 it stopped part of the way or was refused). uuid: the node the arrow stood for ('' for a held
                                 change). Not run when the arrow merely goes. Gives back what stops it. So a place that keeps
                                 a line for the change (Ontology's History) needs no ear of its own on the arrow
     G.undo.own(key, putBack)    a change kept on this computer and not in the graph (Ontology's property groups): the same arrow,
                                 standing and going as every arrow does (after the row whose uuid is key, or after the words of an
                                 element given G.undo.beside(words, key); at the bottom right where none shows), whose press runs
                                 putBack() in place of Logseq's Undo. One step: a putBack that throws is said (G.write.refused) and
                                 the arrow goes; G.undo.taken is told (key, whole) as for any arrow. A new way into the one arrow,
                                 added in round rundown-070 for the groups
   One change shows one arrow: the one at the bottom right is drawn only while no arrow shows in a line, and goes when one does.
     G.undo.clear()              the arrow taken away (node/node.js calls it when the plugin stops) */
(function () {
const G = window.PluginDoor;
const ARROW = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h5a3 3 0 0 1 0 6H6M5 6l2.5-2.5M5 6l2.5 2.5"/></svg>';
const QUIET = 300, LONGEST = 1600, PACE = 350;   // how long nothing must be heard before the plugin's own change counts as told; the longest that wait may last; the wait between two steps of Undo
let last = null;   // { uuid, steps, timers: [], offs: [], dock, gone, going }   going: its steps are being taken back
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
  if (!mine || mine.going || (only && only !== mine)) return false;
  const steps = mine.steps, doc = G.host(), view = doc.defaultView;
  // The arrow stays while the steps go back, faint and not pressable, and goes with the last of them. The ears go now: each
  // step going back is a change to the graph too.
  mine.going = true;
  for (const off of mine.offs.splice(0)) { try { off(); } catch (error) { /* an ear already gone */ } }
  for (const button of doc.querySelectorAll('.lk-undo')) button.disabled = true;
  let done = 0, failed = null, why = '';
  try {
    if (mine.putBack) { await mine.putBack(); done = steps; }   // a change kept on this computer: its own way back, one step
    else for (; done < steps; done++) {
      // What the person does meanwhile is never what goes back: words begun in a bullet, or another change made through the plugin.
      if (done && (why = last !== mine ? 'the change you made meanwhile is' : G.touch.writing() ? 'the words you began to write are' : '')) break;
      await G.write.undo();
      if (done + 1 < steps) await new Promise(next => view.setTimeout(next, PACE));
    }
  } catch (error) { failed = error; }
  if (last === mine) clear();
  const whole = !failed && done >= steps;
  if (failed) G.write.refused('It could not be undone', failed);
  else if (!whole) G.say(`Undo stopped after ${done} of ${steps} steps, so that ${why} not taken back. The rest of the change stands.`, 'warning', true);
  for (const fn of [...told]) { try { fn(mine.uuid, whole); } catch (error) { console.error('Logseq Plugin: a place could not follow an Undo', error); } }
  return whole;
}
const told = new Set(), taken = fn => { told.add(fn); return () => told.delete(fn); };   // the places told when an arrow's change has been taken back
function arrow(doc, docked) {
  const button = doc.createElement('button'); button.type = 'button'; button.className = docked ? 'lk-undo lk-undo-dock' : 'lk-undo';
  button.title = 'Undo'; button.setAttribute('aria-label', 'Undo'); button.innerHTML = ARROW + (docked ? '<span>Undo</span>' : '');
  button.disabled = !!last?.going;   // drawn anew while its steps go back: not pressable
  // Its own ears, so a press on it is never taken for a press on the line it stands in.
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); back(); });
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); });
  button.addEventListener('mousedown', event => event.stopPropagation());
  return button;
}
// The arrow put at the end of the words an element holds: inside them, so it follows the last of them wherever they end; before
// the small line that says where a node sits. The one at the bottom right goes: one change shows one arrow.
function put(words) {
  if (!words.querySelector('.lk-undo')) words.insertBefore(arrow(words.ownerDocument, false), words.querySelector(':scope > .lk-sits'));
  last.dock?.remove(); last.dock = null;
}
function dress(row) {
  if (!last || !last.uuid || row.dataset.uuid !== last.uuid) { row.querySelector(':scope > .lk-line .lk-undo, :scope > .lk-td .lk-undo')?.remove(); return; }
  const line = row.querySelector(':scope > .lk-line') || row.querySelector(':scope > .lk-td');   // a line, or a table's row (node/table.js): after its first cell's words
  if (!line || line.querySelector('.lk-undo')) return;
  put(line.querySelector(':scope > .lk-words') || line);
}
function beside(words, uuid) {
  uuid = String(uuid || '').toLowerCase();
  words.dataset.lkUndo = uuid;   // found again by the arrow when it is set after this line was drawn
  if (!last || !last.uuid || last.uuid !== uuid) { words.querySelector(':scope > .lk-undo')?.remove(); return false; }
  put(words);
  return true;
}
const shows = el => el.checkVisibility ? el.checkVisibility() : true;   // an arrow in a place that is shut (a tab not shown) does not show
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
  show(stand(n, uuid, null));
}
// The arrow set where the change shows: after each row of its node, after each line given its key; at the bottom right where none shows.
function show(mine) {
  const doc = G.host(), view = doc.defaultView, uuid = mine.uuid;
  const rows = () => [...doc.querySelectorAll(`:is(.lk-row, .lk-trow)[data-uuid="${uuid}"]`)];
  const light = () => { for (const row of rows()) dress(row); for (const words of doc.querySelectorAll(`[data-lk-undo="${uuid}"]`)) put(words); };
  light();
  // The lists read the graph again after the change: the row may be drawn anew, so it is dressed once more when they have.
  mine.timers.push(view.setTimeout(() => { if (last === mine) light(); }, 900));
  // No line shows it any more: the arrow waits at the bottom right.
  mine.timers.push(view.setTimeout(() => { if (last !== mine || [...doc.querySelectorAll('.lk-undo:not(.lk-undo-dock)')].some(shows)) return; mine.dock = arrow(doc, true); doc.body.appendChild(mine.dock); }, 1500));
}
function own(key, putBack) {
  key = String(key || '').toLowerCase();
  if (!key || typeof putBack !== 'function') return;
  const mine = stand(1, key, null);
  mine.putBack = putBack;
  show(mine);
}
const hold = (steps, gone) => { const n = count(steps); return n ? stand(n, '', typeof gone === 'function' ? gone : null) : null; };
async function after(uuid, write) { const made = await write; mark(uuid, typeof made === 'number' ? made : 1); return made; }   // a write that answers a number says how many steps it was; none, no arrow
G.undo = { after, mark, own, hold, back, dress, beside, taken, clear };
G.undo.CSS = `
/* After a line's words, on the words' own line: its middle on the middle of the small letters (it sat 2 below, and its box
   reached under the line and made the row 1 taller), and it takes no room in the run of the words, so where the words
   fill their line it still stands after the last of them and never on a line of its own (the row grew by a line when
   the arrow came and shrank when it went). */
.lk-undo { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 20px; height: 20px; margin: 0 -24px 0 4px; padding: 0; vertical-align: middle; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-text); font: inherit; opacity: .45; cursor: pointer; }
.lk-undo svg { width: 13px; height: 13px; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: 1; background: var(--lk-wash); outline: none; }
.lk-undo:disabled { opacity: .45; pointer-events: none; cursor: default; }   /* its steps are going back: faint, not pressable, until the last has gone */
.lk-undo-dock svg { width: 15px; height: 15px; }
.lk-undo-dock { position: fixed; right: 64px; bottom: 20px; z-index: 9998; width: auto; height: 28px; padding: 0 12px 0 8px; border-radius: var(--lk-corner-round); background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); font-size: var(--lk-line-size); opacity: 1; margin: 0; vertical-align: 0; }
.lk-undo-dock:hover, .lk-undo-dock:focus-visible { background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-text); }`;
})();
