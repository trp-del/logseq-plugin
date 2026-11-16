/* An embed by typing (16 November 2026, the owner: "use some sort of way to trigger it instead of using slash command like << or
   (("). Typing << in a bullet (the setting "Typing that embeds a node") opens Logseq's own Node embed search where the marks
   stood, as /Node embed does: the marks go, what is typed next finds a node or page in Logseq's own list, Enter shows it in
   the bullet, Logseq's Cmd-Z takes it back. Escape closes the list and gives the marks back with what was typed after them, so
   << can still be written. (( stays Logseq's block reference.
   The marks count only after a space or at the start of a bullet, and not inside `code`, so "a<<b" stays words. Logseq's / list,
   which the search is opened through, is kept off the screen for the moment it stands there, so nothing flashes. */
(function () {
const Flow = window.Flow;
const { app } = Flow;
const { host, setting, notify, warnOnce } = app;
const screen = () => window.PluginDoor.screen;

const HANDOFF = 'flow-embed-handoff';
let busy = false, open = null;   // open: { box, at, trigger } while Logseq's search stands from our marks
const triggerNow = () => String(setting('embedTrigger') ?? '').trim();
const inCode = (text, at) => ((text.slice(0, at).match(/`/g) || []).length % 2) === 1;
// Where the marks just typed stand, or -1: right before the cursor, after a space or the start, not in code.
function marksAt(box, trigger) {
  const at = box.selectionEnd, from = at - trigger.length;
  if (box.selectionStart !== at || from < 0 || box.value.slice(from, at) !== trigger) return -1;
  if (from > 0 && !/\s/.test(box.value[from - 1])) return -1;
  return inCode(box.value, from) ? -1 : from;
}

function onInput(event) {
  const box = event.target, trigger = triggerNow();
  if (busy || !trigger || event.isComposing || !app.isBlockBox(box) || !/^insert/.test(event.inputType || '') || event.data !== trigger.slice(-1)) return;
  // After Logseq has taken the key, so its editor and ours agree on what is in the box.
  setTimeout(() => {
    if (busy || host().activeElement !== box || app.editorPopupOpen()) return;
    const from = marksAt(box, trigger);
    if (from >= 0) start(box, from, trigger).catch(error => warnOnce('the embed search did not open', error));
  }, 0);
}

/* Where the bullet holds words of its own, the embed goes in a new bullet under it, as Logseq's own /Node embed does there: the
   marks come out of the words, the words are kept, and the search opens in the new bullet. (Opened in place, Logseq would take
   the bullet for empty while it has not yet saved the words just typed, and put the embed over them: seen 16 November 2026.) */
async function start(box, from, trigger) {
  const words = (box.value.slice(0, from) + box.value.slice(from + trigger.length)).trim();
  if (!words) return handOff(box, from, trigger, null);
  busy = true;
  let fresh = null;
  const uuid = app.uuidOf(box);
  try {
    screen().insert(box, '', from, from + trigger.length);
    fresh = await window.PluginDoor.write.insertBlock(uuid, '', { sibling: true });
    if (!fresh?.uuid) throw new Error('no new bullet');
    await logseq.Editor.editBlock(fresh.uuid);
    const freshBox = await screen().waitFor(() => { const el = host().activeElement; return app.isBlockBox(el) && app.uuidOf(el) === fresh.uuid ? el : null; }, 1500, { frames: true });
    if (!freshBox) throw new Error('the new bullet did not open');
    busy = false;
    return handOff(freshBox, 0, trigger, { uuid, at: from, fresh: fresh.uuid });
  } finally { busy = false; }
}

const nodeEmbedRow = doc => [...doc.querySelectorAll('.ui__popover-content .menu-link')].find(row => row.textContent.trim() === 'Node embed');
async function handOff(box, from, trigger, back) {
  busy = true;
  const doc = box.ownerDocument, root = doc.documentElement;
  root.classList.add(HANDOFF);
  try {
    screen().insert(box, '/', from, from + trigger.length);   // the marks become Logseq's /, which opens its list
    const row = await screen().waitFor(() => nodeEmbedRow(doc), 1000, { frames: true });
    if (!row) { if (back) await goBack(back, ''); else giveBack(box, from, '/', trigger); return notify('Logseq’s Node embed could not be opened', 'warning'); }
    screen().press(row);   // the row is pressed as the mouse does, Logseq's own way in
    const search = await screen().waitFor(() => doc.querySelector('.ac-block-search'), 1000, { frames: true });
    if (search) open = { box, at: from, trigger, back };
  } finally {
    doc.defaultView.requestAnimationFrame(() => root.classList.remove(HANDOFF));
    busy = false;
  }
}
// Puts the marks back where what stands from `at` is `was` (the / when the list did not come; nothing after an Escape).
function giveBack(box, at, was, trigger) {
  if (!box.isConnected || box.value.slice(at, at + was.length) !== was) return;
  screen().insert(box, trigger, at, at + was.length);
}

/* From the new bullet back to where the marks were typed: the new bullet goes (it holds only what was typed to search), and the
   marks and those words stand again in the bullet's words, the cursor after them. */
async function goBack(back, typed) {
  const trigger = triggerNow() || '<<';
  const made = await logseq.Editor.getBlock(back.fresh, { includeChildren: true });
  if (made && !made.link && !(made.children || []).length && !String(made.content ?? made.title ?? '').replace(typed, '').trim()) await window.PluginDoor.write.removeBlock(back.fresh);
  await logseq.Editor.editBlock(back.uuid);
  const box = await screen().waitFor(() => { const el = host().activeElement; return app.isBlockBox(el) && app.uuidOf(el) === back.uuid ? el : null; }, 1500, { frames: true });
  if (!box) return;
  const at = Math.min(back.at, box.value.length), text = (at > 0 && !/\s/.test(box.value[at - 1]) ? ' ' : '') + trigger + typed;   // Logseq trims the space it saved the words with
  screen().insert(box, text, at, at);
  box.setSelectionRange(at + text.length, at + text.length);
}

// Escape in Logseq's search, opened from our marks: Logseq closes it, then the marks come back before what was typed.
function onKey(event) {
  if (!open) return;
  const doc = host(), searching = !!doc.querySelector('.ac-block-search');
  if (!searching || event.target !== open.box) { if (!searching) open = null; return; }
  if (event.key !== 'Escape') return;
  const { box, at, trigger, back } = open;
  open = null;
  setTimeout(() => {
    if (host().activeElement !== box || doc.querySelector('.ac-block-search')) return;
    if (back) goBack(back, box.value).catch(error => warnOnce('the bullet could not be gone back to', error));
    else giveBack(box, Math.min(at, box.value.length), '', trigger);
  }, 30);
}

const CSS = `html.${HANDOFF} :is([data-radix-popper-content-wrapper], .ui__popover-content):not(:has(.ac-block-search)) { visibility: hidden !important; }`;
function begin() {
  const win = host().defaultView;
  app.sendStyle('flow-embed-here', CSS);
  app.listen(win, ['input'], onInput, true);
  app.listen(win, ['keydown'], onKey, true);
}
Flow.embedHere = { start: begin, marksAt };
})();
