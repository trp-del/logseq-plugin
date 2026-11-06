/* Logseq Plugin: six modules in one plugin. Loaded last; by now every module has registered (plugin.js). This file holds
   the three things Logseq gives a plugin only once: the settings list (every module's, under a switch for each), the
   start (each module in turn, one failing or never answering leaving the rest running) and the clean-up (the stop of every
   module that began, in reverse). And what stands whichever modules run: the shared names, Logseq's frame kept in place, the settings
   window and the door for files from outside (outside.js). */
(function () {
const Door = window.PluginDoor;
const notify = (text, status = 'info') => logseq.UI.showMsg(text, status);   // no options: with a timeout the notice stays on screen
const switchKey = module => module.key + 'On';
const on = module => Door.runs(module.key);

// Logseq's own settings panel: first the switches, then each module's settings as that module wrote them.
const schema = [
  { key: 'modulesHeading', type: 'heading', default: null, title: 'What runs', description: 'Each part of the plugin, on or off. A change takes effect after the plugin is reloaded.' },
  ...Door.modules.map(module => ({ key: switchKey(module), type: 'boolean', default: true, title: module.title, description: module.about })),
  ...Door.modules.flatMap(module => module.schema || []),
];

const started = Door.started = [];   // on the window, so a check from outside can read what runs
const began = [];   // every module whose start was called: each is stopped, whether or not its start finished
// On a cold start Logseq starts a plugin before the graph's database is up, and every read throws. Six plugins hid that by
// loading one after another; one plugin gets here first. So wait for the first read that answers, and start regardless
// after half a minute, for a graph that never opens: each module then says its own failure as it did.
async function graphReady() {
  for (let tries = 0; tries < 150; tries++) {
    try { await logseq.DB.datascriptQuery('[:find ?t :where [?t :db/ident :logseq.class/Tag]]'); return; }
    catch (error) { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
}
/* Logseq's frame stays where it is. Its outer boxes (the window itself, and the boxes holding the main view and the sidebars)
   do not scroll; only the views inside them do. A focus or scrollIntoView, a module's or Logseq's, can still push one of them
   up, and then the top of every view, the toolbar and the titles, stays cut off and the mouse cannot scroll it back (the
   owner: "view jumps up and top of view is cut off no matter what page"). Whenever such a box is scrolled, it is put back at
   the top at once. */
const SCROLLS = /^(auto|scroll|overlay)$/;
function keepFrameInPlace() {
  const doc = window.parent.document, win = doc.defaultView;
  const frame = el => el === doc.scrollingElement || el === doc.body
    || (el.querySelector?.('#main-content-container, #left-sidebar, #right-sidebar') && !SCROLLS.test(win.getComputedStyle(el).overflowY));
  const onScroll = event => {
    const el = event.target === doc ? doc.scrollingElement : event.target;
    if (!el || el.nodeType !== 1 || !el.scrollTop || !frame(el)) return;
    el.scrollTop = 0;
  };
  win.addEventListener('scroll', onScroll, true);
  return () => win.removeEventListener('scroll', onScroll, true);
}
// One module's start, given its time: one that does not answer is said, and the next starts. If it answers later it still runs.
const STILL_STARTING = 15000;
async function startModule(module) {
  began.push(module);
  let timer = 0;
  const done = Promise.resolve().then(() => module.start()).then(() => { started.push(module); return true; })
    .catch(error => { console.error(`${module.title}: could not start`, error); notify(`${module.title} could not start: ${error.message}`, 'warning'); return true; });
  const late = new Promise(resolve => { timer = setTimeout(() => resolve(false), STILL_STARTING); });
  if (!await Promise.race([done, late])) notify(`${module.title} has not finished starting. The rest goes on without waiting.`, 'warning');
  clearTimeout(timer);
}
async function main() {
  // Installed without the "effect" box ticked, Logseq keeps the plugin in a sealed frame where Logseq's own page cannot be
  // reached and nothing can draw. Say so once, instead of failing module by module.
  try { void window.parent.document; } catch (error) {
    notify('Logseq Plugin cannot reach Logseq’s page from here. Uninstall it, then install it again with the "effect" box ticked.', 'error');
    return;
  }
  // The text colour and the window's ground (Door.THEME), for every module whichever are switched on.
  logseq.provideStyle({ key: 'plugin-theme', style: Door.THEME });
  logseq.provideStyle({ key: 'plugin-names', style: Door.NAMES });
  // What a module needs nothing of, and what must stand even if a start never answers, comes before the first start.
  const letFrameGo = keepFrameInPlace();
  logseq.beforeunload?.(async () => {
    try { letFrameGo(); } catch (error) { console.error('The frame guard: could not stop', error); }
    try { Door.settingsWays.stop(); } catch (error) { console.error('The settings window: could not stop', error); }
    for (const module of [...began].reverse()) {
      try { await module.stop?.(); } catch (error) { console.error(`${module.title}: could not stop`, error); }
    }
  });
  try { Door.settingsWays.start(); } catch (error) { console.error('The settings window: could not start', error); notify(`The settings window could not start: ${error.message}`, 'warning'); }
  try { Door.outside?.start(); } catch (error) { console.error('From outside: could not start', error); notify(`Adding from outside could not start: ${error.message}`, 'warning'); }
  try { logseq.App.registerCommandPalette({ key: 'update-plugins', label: 'Update plugins', keybinding: { binding: 'u p' } }, updatePlugins); } catch (error) { console.error('Update plugins: the command could not be registered', error); }
  // A switch flipped: nothing starts or stops live (a module's commands and menu items cannot be taken back), so say so.
  logseq.onSettingsChanged?.((now, before) => {
    if (!before) return;   // Logseq rewrites every setting as the plugin starts: a default being filled in, not a change
    if (Door.settings.current) return;   // the window says so itself
    if (Door.modules.some(module => switchKey(module) in before && now?.[switchKey(module)] !== before[switchKey(module)])) notify('Reload the plugin to apply what runs');
  });
  const failed = window.PluginFilesFailed || [];
  window.removeEventListener('error', window.PluginFilesWatch, true);
  if (failed.length) notify(`Logseq Plugin: ${window.PluginFilesSaid()} did not load, so part of it may not work.`, 'warning');
  await graphReady();
  for (const module of Door.modules) if (on(module)) await startModule(module);
  Door.settingsWays.reopen();
  sayUpdated();
}
/* Update plugins (u then p outside a bullet, as Logseq's own two-key pairs, or the command palette): every plugin that is
   switched on comes to its newest; a plugin switched off stays off. One loaded from a folder loads again, so it runs what
   changed there. One installed from a GitHub release or the Marketplace is handed to Logseq's own updater, the one "Check
   update" on its card uses: Logseq fetches the newest release and, if it is newer, puts it in, reloads the plugin and says so;
   if not, it says the plugin is up to date. Reloading such a plugin alone would run the same old copy (the owner, 5 November
   2026: "Plugins updated at the bottom, but no actual updates occurred"). This plugin goes last, since its reload ends this
   code; from a folder, its files come under a new address each start (loader.js), so nothing old stays. */
async function updatePlugins() {
  const core = window.parent.LSPluginCore, me = logseq.baseInfo?.id;
  if (!core?.registeredPlugins) return notify('Logseq would not reload its plugins from here.', 'warning');
  const others = [...core.registeredPlugins.values()].filter(p => p.loaded && p.id !== me);
  let failed = 0;
  for (const p of others) {
    const release = fromRelease(p.id);
    try { if (release) await fetchNewest(release); else await core.reload(p.id); }
    catch (error) { failed++; console.error(`Update plugins: ${p.id} could not reload`, error); }
  }
  const mine = fromRelease(me);
  if (mine) {
    if (failed) notify(`${failed} plugin${failed > 1 ? 's' : ''} could not reload`, 'warning');
    return fetchNewest(mine);   // Logseq reloads this plugin when a newer release came, and says so either way
  }
  // A notice goes with the plugin that showed it, so the reloaded plugin says it, from a note left here.
  try { window.parent.sessionStorage.setItem(UPDATED_KEY, String(failed)); } catch (error) { /* it only will not be said */ }
  window.parent.setTimeout(() => core.reload(me), 0);
}
// A plugin Logseq installed itself (from a GitHub release or the Marketplace), as its updater takes it, with the repository
// its releases come from; null for one loaded from a folder, or one with no repository to ask, which is only reloaded.
function fromRelease(id) {
  let installed = {};
  try { installed = window.parent.logseq.api.get_state_from_store('plugin/installed-plugins') || {}; } catch (error) { return null; }
  const p = Object.values(installed).find(p => p?.id === id);
  if (!p?.iir) return null;
  const address = typeof p.repository === 'string' ? p.repository : p.repository?.url;
  const repo = p.repo || /github\.com[/:]([^/]+\/[^/]+?)(\.git)?\/?$/.exec(address || '')?.[1];
  return repo ? { id, repo, version: p.version, title: p.title, name: p.name, theme: !!p.theme, effect: !!p.effect } : null;
}
// Asks Logseq's updater for a plugin's newest release and waits for its answer (Logseq says the outcome itself), or a minute.
function fetchNewest(pkg) {
  const apis = window.parent.apis;
  return new Promise(resolve => {
    const heard = (a, b) => { const e = b || a; if (e?.payload?.id === pkg.id && !e['only-check']) done(); };
    const done = () => { clearTimeout(timer); apis.removeListener('lsp-updates', heard); resolve(); };
    const timer = setTimeout(done, 60000);
    apis.addListener('lsp-updates', heard);
    Promise.resolve(apis.doAction(['updateMarketPlugin', { ...pkg, 'only-check': false }])).catch(error => { console.error(`Update plugins: ${pkg.id} could not be fetched`, error); done(); });
  });
}
const UPDATED_KEY = 'logseq-plugin-updated';
function sayUpdated() {
  let failed = null;
  try { failed = window.parent.sessionStorage.getItem(UPDATED_KEY); window.parent.sessionStorage.removeItem(UPDATED_KEY); } catch (error) { return; }
  if (failed == null) return;
  const n = Number(failed) || 0;
  notify(n ? `Plugins updated; ${n} could not reload` : 'Plugins updated', n ? 'warning' : 'success');
}
Door.updatePlugins = updatePlugins;
logseq.useSettingsSchema(schema);
logseq.ready(main).catch(error => console.error('Logseq Plugin: could not start', error));
})();
