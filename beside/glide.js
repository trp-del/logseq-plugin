/* BESIDE: focusing into a bullet and out (the owner picked it on 11 November 2026, after Bike's own focus, and again on 26
   November 2026). Where Logseq swaps the whole view in one frame, the bullet glides from where it stood to where it lands, its
   children with it, and the rest fades where it stands; stepping out runs the same glide back and the bullet comes back
   selected. The same for every way in and out: a press on a bullet, Logseq's keys, a step of the line above a focused bullet,
   Back and Forward. A faint up arrow after the last step of that line steps out one level.
   This decides which bullet moves and when; ground/touch.js (touch.glide) draws it, ground/look.js times it. */
(function () {
const G = window.PluginDoor;
const IN = 'mod+.', OUT = 'mod+,';   // Logseq's own keys for focusing in and out
G.part({
  key: 'glide', title: 'Focusing into a bullet and out',
  about: 'The bullet you focus into glides to the top and back, and comes back selected. An up arrow after the line above it, and Cmd-, step out one level. With the Mac’s Reduce motion on, the view only fades.',
  start(base) {
    const T = G.touch.glide, { wait, rest: settleFor } = G.look.MOTION.glide;
    base.style('glide', T.CSS);
    let before = null;     // the view read as the history changed
    let waiting = null;    // that view, while the new one is waited for; unwatch lets go of the waiting
    let unwatch = null;
    let shown = T.route(); // on Back and Forward the address has already changed when the view is read: the old view's is kept
    let landed = null;     // the bullet that came back selected
    let zoomed = null;     // the address's node, when it is a bullet: known before Logseq draws the line of steps
    let turn = 0, stopped = false;
    /* A node embedded in an outline, focused into from there (the owner, 18 November 2026: it could not be zoomed back out):
       Logseq's line of steps above it is the node's own place, in the page it was written on. So the view it was focused from is
       kept by the embed's node, and stepping out of that node goes back there. */
    const cameFrom = new Map();
    let pressed = null;    // { root, from, at }: a bullet of an embed just pressed, waiting for the history to change
    const noteEmbed = target => { const root = T.embedOf(target); pressed = root ? { root, from: T.address(), at: Date.now() } : null; };

    async function readRoute() {
      const uuid = T.route(); zoomed = null;
      if (uuid && await T.isBullet(uuid) && T.route() === uuid) zoomed = uuid;
    }
    const letGo = () => { waiting = null; unwatch?.(); unwatch = null; };
    // Whether a bullet that was drawn late has stopped moving: Logseq puts the scroll back and draws more round it for a moment.
    function atRest(was, uuid) {
      const top = T.top(uuid);
      if (was.rest?.top !== top) was.rest = { top, at: Date.now() };
      return Date.now() - was.rest.at >= settleFor;
    }
    function leaving(pushed) {
      // The bullet that came back selected lets go when the view changes again, as it would on a press elsewhere.
      if (landed) { landed = null; T.unselect(); }
      const view = T.view();
      before = view && { ...view, at: Date.now(), uuid: shown ?? T.route() };
      if (pushed) { if (pressed && Date.now() - pressed.at < 1500) cameFrom.set(pressed.root, pressed.from); pressed = null; }
    }
    // A newer change takes the place of one still waited for. The wait is by time: Logseq may take a quarter of a second or more.
    function arrived() {
      const was = before; before = null; shown = T.route(); turn++;
      letGo(); readRoute();
      if (!was) return;
      waiting = was; unwatch = T.soon(settle);
    }
    /* Once the new view stands: which bullet stays on screen through the move. Going in, the bullet now focused, which stood in
       the old view; going out, the bullet that was focused, which stands in the new one. */
    function settle() {
      const was = waiting; if (!was) return;
      if (Date.now() - was.at > wait) return letGo();
      if (!T.replaced(was)) return;
      const now = T.route(), into = now && now !== was.uuid && was.rows.has(now);
      if (into && !T.has(now)) return;
      // Stepping out of a focused bullet on a longer page, Logseq draws the page's first bullets first and this one a moment later.
      if (!into && was.focused && was.uuid && was.uuid !== now && !T.has(was.uuid)) { was.late = true; return; }
      const out = !into && !!was.uuid && was.uuid !== now && T.has(was.uuid), uuid = into ? now : out ? was.uuid : null;
      if (out && was.late && !atRest(was, uuid)) return;
      letGo();
      if (!uuid) return;
      T.play(was, uuid, out);
      if (out) select(uuid, turn);
    }
    // Coming back, the bullet is selected; but where you are writing in it (Cmd-, from the editor), the cursor stays.
    function select(uuid, mine) {
      const later = T.still() ? 0 : G.look.MOTION.glide.ms;
      setTimeout(async () => {
        if (stopped || mine !== turn || !T.has(uuid) || T.typing() || await T.editing() || mine !== turn) return;
        landed = uuid; T.select(uuid);
      }, later);
    }
    // One level out: back to the outline an embed's node was focused from; else a press on the last step of the line.
    function stepOut() {
      const uuid = T.route(), from = cameFrom.get(uuid);
      if (from) { cameFrom.delete(uuid); T.back(from); return; }
      if (T.stepUp() || !uuid || uuid !== zoomed) return;
      // Pressed so soon after focusing in that Logseq has not drawn the line yet: one level out by the bullet's parent.
      T.parent(uuid).then(up => { if (up && T.route() === uuid) T.go(up); });
    }

    base.onStop(() => { stopped = true; letGo(); T.clear(); });
    base.onStop(T.moves(leaving, arrived));
    base.listen(G.host(), 'pointerdown', event => { if (T.onBullet(event.target)) noteEmbed(event.target); }, true);
    // Cmd-. on the bullet that came back selected focuses into it again; everywhere else Logseq's own Cmd-. is left alone.
    base.onStop(G.touch.key(IN, () => {
      noteEmbed(null);
      if (T.typing() || !landed || !T.selected(landed)) return false;
      T.into(landed);
    }));
    // Cmd-, outside the editor in a focused bullet steps out one level (Logseq alone opens its settings there).
    base.onStop(G.touch.key(OUT, () => {
      if (T.typing() || !(T.focused() || (zoomed && zoomed === T.route()))) return false;
      stepOut();
    }));
    base.onStop(G.touch.watch(() => T.wayOut(stepOut)));
    readRoute();
  },
});
})();
