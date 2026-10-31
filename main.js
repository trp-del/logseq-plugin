/* Logseq Plugin: six modules in one plugin. Loaded last; by now every module has registered (plugin.js). This file holds
   the three things Logseq gives a plugin only once: the settings list (every module's, under a switch for each), the
   start (each module in turn, one failing leaving the rest running) and the clean-up (each module's stop, in reverse). */
(function () {
const Plugin = window.Plugin;
const notify = (text, status = 'info') => logseq.UI.showMsg(text, status);   // no options: with a timeout the notice stays on screen
const switchKey = module => module.key + 'On';
const on = module => logseq.settings?.[switchKey(module)] !== false;

// Logseq's own settings panel: first the switches, then each module's settings as that module wrote them.
const schema = [
  { key: 'modulesHeading', type: 'heading', default: null, title: 'What runs', description: 'Each part of the plugin, on or off. A change takes effect after the plugin is reloaded.' },
  ...Plugin.modules.map(module => ({ key: switchKey(module), type: 'boolean', default: true, title: module.title, description: module.about })),
  ...Plugin.modules.flatMap(module => module.schema || []),
];

const started = Plugin.started = [];   // on the window, so a check from outside can read what runs
async function main() {
  // Installed without the "effect" box ticked, Logseq keeps the plugin in a sealed frame where Logseq's own page cannot be
  // reached and nothing can draw. Say so once, instead of failing module by module.
  try { void window.parent.document; } catch (error) {
    notify('Logseq Plugin cannot reach Logseq’s page from here. Uninstall it, then install it again with the "effect" box ticked.', 'error');
    return;
  }
  for (const module of Plugin.modules) {
    if (!on(module)) continue;
    try { await module.start(); started.push(module); }
    catch (error) { console.error(`${module.title}: could not start`, error); notify(`${module.title} could not start: ${error.message}`, 'warning'); }
  }
  // A switch flipped: nothing starts or stops live (a module's commands and menu items cannot be taken back), so say so.
  logseq.onSettingsChanged?.((now, before) => {
    if (!before) return;   // Logseq rewrites every setting as the plugin starts: a default being filled in, not a change
    if (Plugin.modules.some(module => switchKey(module) in before && now?.[switchKey(module)] !== before[switchKey(module)])) notify('Reload the plugin to apply what runs');
  });
  logseq.beforeunload?.(async () => {
    for (const module of [...started].reverse()) {
      try { await module.stop?.(); } catch (error) { console.error(`${module.title}: could not stop`, error); }
    }
  });
}
logseq.useSettingsSchema(schema);
logseq.ready(main).catch(error => console.error('Logseq Plugin: could not start', error));
})();
