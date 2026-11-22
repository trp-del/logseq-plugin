/* One $ for one $ (17 November 2026, the owner: "don't double type $ in logseq"). Logseq pairs a typed $ for math: "$" gives
   "$|$", so "paid $5 on Friday" is kept as "paid $5 on Friday$", and two $ make math. When a $ typed with nothing selected
   came out as two around the cursor, the closing one is taken back at once, so the bullet holds what was typed. A $ typed
   over a selection (Logseq wraps it in $…$) is left as Logseq made it, and $$ for math is still written by typing it twice. */
(function () {
const Flow = window.Flow;
const { app } = Flow;
const { host } = app;
const screen = () => window.PluginDoor.screen;

// Each typed $ keeps its own note of the box as it was, so a key pressed right after it (fast typing, or Logseq busy for a moment)
// cannot lose it: on 22 November 2026 "Dinner $84 plus $15 tip" typed fast kept the closing $, which then began the next bullet.
function onKey(event) {
  const box = event.target;
  if (event.key !== '$' || event.isComposing || !app.isBlockBox(box) || box.selectionStart !== box.selectionEnd) return;
  const was = { box, value: box.value, at: box.selectionStart };
  box.ownerDocument.defaultView.setTimeout(() => settle(was), 0);
}
// After Logseq has handled the key: two $ where one was typed, the cursor between them (with whatever was typed since), lose the
// second. Anything else (a $ of your own already there, the words changed some other way) is left as it is.
function settle(was) {
  if (!was || !was.box.isConnected) return;
  const { box, value, at } = was, now = box.value, cursor = box.selectionStart;
  if (cursor !== box.selectionEnd || cursor <= at || now.length !== value.length + 2 + (cursor - at - 1)) return;
  const since = now.slice(at + 1, cursor);
  if (now.slice(0, at) !== value.slice(0, at) || now.charAt(at) !== '$' || now.charAt(cursor) !== '$' || now.slice(cursor + 1) !== value.slice(at) || since.includes('$')) return;
  screen().insert(box, '', cursor, cursor + 1);
  box.setSelectionRange(cursor, cursor);
}

function begin() {
  app.listen(host().defaultView, ['keydown'], onKey, true);
}
Flow.oneDollar = { start: begin };
})();
