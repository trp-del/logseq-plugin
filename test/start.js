/* Stands in for main.js in a module's own checks: logseq.ready and logseq.beforeunload, as the stand-ins expect them. */
(function () {
const modules = window.PluginDoor.modules;
if (typeof logseq.useSettingsSchema === 'function') logseq.useSettingsSchema(modules.flatMap(module => module.schema || []));
logseq.ready(async () => { for (const module of modules) await module.start(); });
logseq.beforeunload?.(async () => { for (const module of modules) await module.stop?.(); });
})();
