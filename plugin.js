/* The door every module comes in by. Loaded first. A module's own main.js, as it loads, calls
   Plugin.register({ key, title, about, schema, start, stop }); main.js, loaded last, gives Logseq every module's settings
   as one list and starts the modules in the order they registered. Logseq gives a plugin one start (logseq.ready), one
   settings list and one clean-up (beforeunload), so those three belong to main.js and to no module. */
(function () {
const Plugin = (window.Plugin ||= { modules: [] });
Plugin.register = module => { Plugin.modules.push(module); };
})();
