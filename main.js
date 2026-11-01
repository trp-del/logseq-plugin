/* Logseq Plugin: six modules in one plugin. Loaded last; by now every module has registered (plugin.js). This file holds
   the three things Logseq gives a plugin only once: the settings list (every module's, under a switch for each), the
   start (each module in turn, one failing or never answering leaving the rest running) and the clean-up (the stop of every
   module that began, in reverse). And what stands whichever modules run: the shared names, and Logseq's frame kept in place. */
(function () {
const Door = window.PluginDoor;
const notify = (text, status = 'info') => logseq.UI.showMsg(text, status);   // no options: with a timeout the notice stays on screen
const switchKey = module => module.key + 'On';
const on = module => logseq.settings?.[switchKey(module)] !== false;

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
  // The text colour and the window's ground, for every module whichever are switched on. Logseq 2.0.2 sets neither
  // --ls-primary-* any more, though a theme may; its own are --foreground and --background, which follow light and dark.
  logseq.provideStyle({ key: 'plugin-theme', style: ':root { --lk-text: var(--ls-primary-text-color, hsl(var(--foreground))); --lk-paper: var(--ls-primary-background-color, hsl(var(--background))); }' });
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
}
logseq.useSettingsSchema(schema);
logseq.ready(main).catch(error => console.error('Logseq Plugin: could not start', error));
})();
