/* Find: the search window as the first step of a walk. Loaded by loader.js after the kit, the graph reader, the settings,
   the settings window and the window (files.js). Opens from Logseq's search key and Logseq's own magnifier at the top left (a
   setting), and the command palette; forgets what it read when the graph changes. */
(function () {
const Find = window.Find;
const Keys = window.PluginDoor.keys;
/* Find's keys, kept once: the listener below matches them and the key sheet reads them at the door. Cmd K (Ctrl elsewhere) is
   Find's while it takes Logseq's search key, and Cmd Shift K then Logseq's own search; the other way round otherwise.
   Cmd Option K: the window as a sentence. Cmd Shift .: the window with > typed, Logseq's commands listed; no key of Logseq's
   uses it. Each is matched by the key's place on the keyboard, since Shift and Option change what a key reads. */
const keys = () => { const takes = Find.settings.setting('takesSearchKey') !== false; return { find: takes ? 'mod+k' : 'mod+shift+k', logseqSearch: takes ? 'mod+shift+k' : 'mod+k', sentence: 'mod+alt+k', commands: 'mod+shift+.' }; };
/* A bullet being written, and the last one that was: the palette takes the caret before its command runs (found by hand, 23 November
   2026: "Put the cursor in a bullet first"), so "Find: link from here" goes back to the bullet the hand was in, at its caret. The
   very copy of it: the same page open on the left and in the sidebar draws the bullet twice, and Logseq's editBlock writes in the
   first copy it finds (found by hand, 24 November 2026: the panel opened, and Escape left the caret, in the left copy). */
const bulletBox = at => at?.tagName === 'TEXTAREA' && !!at.closest('.ls-block') && !at.closest('[data-th-node]');
const SIDE = '#right-sidebar, .cp__right-sidebar';
let lastBullet = null;   // { uuid, pos, side, copy: the bullet's own .ls-block, id: its id }
function rememberBullet() {
  const doc = Find.kit.host();
  const note = () => { const at = doc.activeElement; if (!bulletBox(at)) return; const copy = at.closest('.ls-block'); lastBullet = { uuid: copy.getAttribute('blockid'), pos: at.selectionStart, side: !!at.closest(SIDE), copy, id: copy.id || '' }; };
  for (const type of ['keyup', 'mouseup', 'focusin']) Find.kit.listen(doc, type, note, true);
  Find.kit.onStop(logseq.App.onRouteChanged?.(() => { lastBullet = null; }));
  Find.kit.onStop(() => { lastBullet = null; });
}
async function panelFromCommand() {
  const doc = Find.kit.host(), no = () => logseq.UI.showMsg('Put the cursor in a bullet first', 'warning');
  if (Find.settings.setting('panel') === false) return;
  if (bulletBox(doc.activeElement)) return void Find.window.panel(doc.activeElement);
  const was = lastBullet;
  if (!was?.uuid || !doc.querySelector(`.ls-block[blockid="${was.uuid}"]`)) return no();
  await new Promise(r => setTimeout(r, 150));   // the palette closes first
  // The copy that was written in: the same element, or, drawn again, the one of the same id; else the one on the same side.
  const copyNow = () => (was.copy?.isConnected ? was.copy : null) || (was.id && doc.getElementById(was.id)) ||
    [...doc.querySelectorAll(`.ls-block[blockid="${was.uuid}"]`)].find(b => !!b.closest(SIDE) === was.side) || null;
  const inCopy = () => { const at = doc.activeElement, copy = copyNow(); return bulletBox(at) && copy && at.closest('.ls-block') === copy ? at : null; };
  const wait = async () => { for (let i = 0; i < 20 && !inCopy(); i++) await new Promise(r => setTimeout(r, 50)); return inCopy(); };
  // Logseq puts a bullet in writing where the hand presses its words, in that copy; its editBlock only where the first copy stands.
  const press = copy => { const words = copy?.querySelector(':scope > .block-main-container .block-content') || copy?.querySelector('.block-content'); if (!words) return false;
    const r = words.getBoundingClientRect(), view = doc.defaultView, at = { bubbles: true, cancelable: true, view, button: 0, clientX: r.right - 2, clientY: r.top + Math.min(r.height / 2, 10) };
    for (const [Kind, type] of [[view.PointerEvent || view.MouseEvent, 'pointerdown'], [view.MouseEvent, 'mousedown'], [view.PointerEvent || view.MouseEvent, 'pointerup'], [view.MouseEvent, 'mouseup'], [view.MouseEvent, 'click']]) words.dispatchEvent(new Kind(type, { ...at, pointerType: 'mouse', isPrimary: true }));
    return true; };
  let at = null;
  if (press(copyNow())) at = await wait();
  if (!at) { await Promise.resolve(logseq.Editor.editBlock(was.uuid, { pos: was.pos })).catch(() => {}); at = await wait(); }
  if (!at) return no();
  await new Promise(r => setTimeout(r, 60));   // Logseq places its own caret once writing starts; the hand's place is put back after it
  at = inCopy(); if (!at) return no();
  try { at.setSelectionRange(was.pos, was.pos); } catch (error) { /* the words changed */ }
  Find.window.panel(at);
}
function listenForKeys() {
  const doc = Find.kit.host();
  Find.kit.onStop?.(Keys.tell('find', keys));
  const keyListener = event => {
    const now = keys(), is = spec => Keys.matches(event, spec), mine = () => { event.preventDefault(); event.stopPropagation(); };
    /* The small Find under the line has a key of its own (the owner, 23 November 2026: "Give it its own key"; Hyper in a line opens
       Logseq's own list, and the palette takes the caret). In a bullet being written it opens the panel; again, it closes it. */
    if (is(Find.settings.setting('panelKeys')) && Find.settings.setting('panel') !== false) {
      const at = doc.activeElement, state = Find.window.state;
      if (state.dlg && state.host && !state.host.held) { mine(); Find.window.close(); return; }
      if (!state.dlg && bulletBox(at)) { mine(); Find.window.panel(at); return; }
    }
    // Again, each closes its window.
    if (is(now.commands)) { mine(); Find.window.commands(); return; }
    if (is(now.sentence)) { mine(); Find.window.sentence(); return; }
    // Keys typed inside our own window never reach here (its dialog stops them); Logseq's own search box does.
    if (is(now.find)) { mine(); Find.window.toggle(); return; }
    // Logseq's own search on Cmd Shift K while Find has Cmd K; left on Cmd K, Logseq hears its key itself.
    if (is(now.logseqSearch) && now.find === 'mod+k') { mine(); Find.window.close(); Promise.resolve(logseq.App.invokeExternalCommand('logseq.go/search')).catch(() => {}); }
  };
  Find.kit.listen(doc, 'keydown', keyListener, true);
}
/* Logseq's magnifier at the top left opens Find too, while Find takes the search key: one search, where the toolbar had a second
   button for it (the owner, 9 November 2026: "streamline not just move icons around"). Shift and the magnifier is Logseq's own
   search, as Cmd Shift K is. */
function takeSearchButton() {
  const doc = Find.kit.host();
  const searchPress = event => {
    if (!event.target?.closest?.('#search-button') || event.shiftKey || !Find.settings.setting('takesSearchKey')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    Find.window.toggle();
  };
  Find.kit.listen(doc, 'click', searchPress, true);
}
async function main() {
  takeSearchButton();
  const { onStop } = Find.kit;
  onStop(window.PluginDoor.addMenuItem({ key: 'find', label: 'Find', icon: 'search', run: () => Find.window.open() }));
  Find.window.dress();
  listenForKeys();
  rememberBullet();
  Find.under.start();
  Find.within.start();
  logseq.App.registerCommandPalette({ key: 'find-open', label: 'Find' }, () => Find.window.open());
  logseq.App.registerCommandPalette({ key: 'find-sentence', label: 'Find by sentence' }, () => Find.window.sentence());
  logseq.provideModel({ findOpen: () => Find.window.open() });
  onStop(window.PluginDoor.offerAsk('find:kind', kind => Find.window.openKind(kind)));
  /* 0.5: Find as a small panel under the line being written (the owner, 22 November 2026: "that window opens and takes over majority
     of screen"). Opened by its own key (the setting panelKeys, in the listener above) and the command below, and asked through the door as find:panel with the bullet's box. Since 22 November 2026
     Predictive's Hyper tap on a line opens Logseq's own link list instead (PluginDoor.screen.linkList). */
  onStop(window.PluginDoor.offerAsk('find:panel', ({ box } = {}) => Find.window.panel(box)));
  onStop(window.PluginDoor.offerAsk('find:held', () => Find.window.held()));
  logseq.App.registerCommandPalette({ key: 'find-held', label: 'Find: tag the selected bullets' }, async () => { if (!await Find.window.held()) logseq.UI.showMsg('Select some bullets first', 'warning'); });
  logseq.App.registerCommandPalette({ key: 'find-panel', label: 'Find: link from here' }, () => panelFromCommand());
  onStop(logseq.DB.onChanged(() => Find.window.forget()));
  onStop(logseq.App.onCurrentGraphChanged(() => { Find.window.close(); Find.window.forget(true); }));
  const warming = setTimeout(() => Find.window.warm(), 1500);
  onStop(() => clearTimeout(warming));
}
function stop() {
  try { Find.window.close(); } catch (error) { console.error('Find: the window could not close', error); }
  const done = Find.kit.stopAll();   // the base: its listeners, Logseq's hooks and its line in the ··· menu
  Find.kit.sweep();
  return done;
}
window.PluginDoor.describe('find', { schema: [{ type: 'heading', title: 'The search window', place: 'finding' }, ...Find.settings.schema], specimen: Find.settings.specimen, picture: on => on ? Find.settings.specimen({ key: 'takesSearchKey', type: 'boolean' }, true) : '<span class="sw-k">Cmd K</span> Logseq’s search, and no Find' });
window.PluginDoor.register({
  key: 'find', title: 'Find', about: 'The search window as the first step of a walk: a name, then the kinds and the time, then the thread from what you found.',
  schema: Find.settings.schema.map(({ key, type, title, description, default: def, enumChoices }) => ({ key, type, title, description, default: def, ...(enumChoices ? { enumChoices } : {}) })),
  start: main, stop,
});
})();
