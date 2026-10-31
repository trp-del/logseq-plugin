/* Find: the search window as the first step of a walk. Loaded by loader.js after the kit, the graph reader, the settings,
   the settings window and the window (files.js). Opens from Logseq's search key (a setting), the command palette and a
   word in the toolbar; forgets what it read when the graph changes. */
(function () {
const Find = window.Find;
const isMac = /Mac/i.test(navigator.platform || '');
let keyListener = null;
function listenForKeys() {
  const doc = Find.kit.host();
  if (keyListener) doc.removeEventListener('keydown', keyListener, true);
  keyListener = event => {
    const mod = isMac ? event.metaKey : event.ctrlKey;
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
  doc.addEventListener('keydown', keyListener, true);
}
async function main() {
  Find.kit.style('tokens', Find.kit.TOKENS);
  listenForKeys();
  logseq.App.registerCommandPalette({ key: 'find-open', label: 'Find' }, () => Find.window.open());
  logseq.provideModel({ findOpen: () => Find.window.open() });
  logseq.App.registerUIItem('toolbar', { key: 'find-open', template: '<a class="button" data-on-click="findOpen" title="Find (Cmd+K)"><i class="ti ti-route"></i></a>' });
  logseq.DB.onChanged(() => Find.window.forget());
  logseq.App.onCurrentGraphChanged(() => { Find.window.close(); Find.window.forget(); });
}
function stop() {
  Find.window.close();
  if (keyListener) Find.kit.host().removeEventListener('keydown', keyListener, true);
  Find.kit.sweep();
}
window.PluginDoor.describe('find', { schema: [{ type: 'heading', title: 'The window' }, ...Find.settings.schema], specimen: Find.settings.specimen });
window.PluginDoor.register({
  key: 'find', title: 'Find', about: 'The search window as the first step of a walk: a name, then the kinds and the time, then the thread from what you found.',
  schema: Find.settings.schema.map(({ key, type, title, description, default: def, enumChoices }) => ({ key, type, title, description, default: def, ...(enumChoices ? { enumChoices } : {}) })),
  start: main, stop,
});
})();
