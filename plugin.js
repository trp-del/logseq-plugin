/* The door every module comes in by. Loaded first. A module's own main.js, as it loads, calls
   PluginDoor.register({ key, title, about, schema, start, stop }); main.js, loaded last, gives Logseq every module's
   settings as one list and starts the modules in the order they registered. Logseq gives a plugin one start (logseq.ready),
   one settings list and one clean-up (beforeunload), so those three belong to main.js and to no module. The name is not
   Plugin: every browser already has a window.Plugin of its own, the entries of navigator.plugins. */
(function () {
const Door = (window.PluginDoor ||= { modules: [] });
Door.register = module => { Door.modules.push(module); };
// What a part shows in the settings window: { schema, specimen } (settings/window.js), or { none } when it has nothing to set.
Door.described = {};
Door.describe = (key, settings) => { Door.described[key] = settings; };
})();
