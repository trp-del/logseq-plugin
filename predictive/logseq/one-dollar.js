/* One $ for one $ (17 November 2026, the owner: "don't double type $ in logseq"). Logseq pairs a typed $ for math: "$" gives
   "$|$", so "paid $5 on Friday" is kept as "paid $5 on Friday$", and two $ make math. When a $ typed with nothing selected
   came out as two around the cursor, the closing one is taken back at once, so the bullet holds what was typed. A $ typed
   over a selection (Logseq wraps it in $…$) is left as Logseq made it, and $$ for math is still written by typing it twice. */
(function () {
const Flow = window.Flow;
const { app } = Flow;
const { host } = app;
const screen = () => window.PluginDoor.screen;

let before = null;   // { box, value, at } as the $ key went down
function onKey(event) {
  before = null;
  const box = event.target;
  if (event.key !== '$' || event.isComposing || !app.isBlockBox(box) || box.selectionStart !== box.selectionEnd) return;
  before = { box, value: box.value, at: box.selectionStart };
  box.ownerDocument.defaultView.setTimeout(settle, 0);
}
// After Logseq has handled the key: two $ where one was typed, the cursor between them, lose the second.
function settle() {
  const was = before;
  before = null;
  if (!was || !was.box.isConnected) return;
  const { box, value, at } = was;
  if (box.value !== value.slice(0, at) + '$$' + value.slice(at) || box.selectionStart !== at + 1 || box.selectionEnd !== at + 1) return;
  screen().insert(box, '', at + 1, at + 2);
  box.setSelectionRange(at + 1, at + 1);
}

function begin() {
  app.listen(host().defaultView, ['keydown'], onKey, true);
}
Flow.oneDollar = { start: begin };
})();
