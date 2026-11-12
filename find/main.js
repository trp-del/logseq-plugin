/* Find: the search window as the first step of a walk. Loaded by loader.js after the kit, the graph reader, the settings,
   the settings window and the window (files.js). Opens from Logseq's search key and Logseq's own magnifier at the top left (a
   setting), and the command palette; forgets what it read when the graph changes. */
(function () {
const Find = window.Find;
const isMac = /Mac/i.test(navigator.platform || '');
function listenForKeys() {
  const doc = Find.kit.host();
  const keyListener = event => {
    const mod = isMac ? event.metaKey : event.ctrlKey;
    // Cmd Shift . (Ctrl elsewhere): the window with > typed, Logseq's commands listed; again, it closes. The period by its place
    // on the keyboard, since with Shift it reads > on most layouts. No key of Logseq's uses it.
    if (mod && event.shiftKey && !event.altKey && (event.code === 'Period' || event.key === '>' || event.key === '.')) { event.preventDefault(); event.stopPropagation(); Find.window.commands(); return; }
    // Cmd Option K (Ctrl Alt elsewhere): the window as a sentence; again, it closes. By the key's place, since Option changes what it reads.
    if (mod && event.altKey && !event.shiftKey && (event.code === 'KeyK' || String(event.key).toLowerCase() === 'k')) { event.preventDefault(); event.stopPropagation(); Find.window.sentence(); return; }
    if (!mod || event.altKey || String(event.key).toLowerCase() !== 'k') return;
    // Keys typed inside our own window never reach here (its dialog stops them); Logseq's own search box does.
    const takes = Find.settings.setting('takesSearchKey');
    if (event.shiftKey) {
      if (!takes) { event.preventDefault(); event.stopPropagation(); Find.window.toggle(); }
      else { event.preventDefault(); event.stopPropagation(); Find.window.close(); Promise.resolve(logseq.App.invokeExternalCommand('logseq.go/search')).catch(() => {}); }
      return;
    }
    if (takes) { event.preventDefault(); event.stopPropagation(); Find.window.toggle(); }
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
  listenForKeys();
  logseq.App.registerCommandPalette({ key: 'find-open', label: 'Find' }, () => Find.window.open());
  logseq.App.registerCommandPalette({ key: 'find-sentence', label: 'Find by sentence' }, () => Find.window.sentence());
  logseq.provideModel({ findOpen: () => Find.window.open() });
  onStop(logseq.DB.onChanged(() => Find.window.forget()));
  onStop(logseq.App.onCurrentGraphChanged(() => { Find.window.close(); Find.window.forget(); }));
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
