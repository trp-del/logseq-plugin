/* GROUND: the door from outside Logseq. Another program on this Mac (the Alfred workflow) asks the plugin through Logseq's HTTP
   APIs server, which calls an answer the plugin gave Logseq by name.
     outside.answer(answers)   { name: async request => what to answer }: given to Logseq under those names. A failure inside one
                               is answered as { ok: false, said }, never left hanging. Giving a name again replaces its answer. */
(function () {
const G = window.PluginDoor;
function answer(answers) {
  const safe = {};
  for (const [name, run] of Object.entries(answers)) {
    safe[name] = async request => {
      try { return await run(request && typeof request === 'object' ? request : {}); }
      catch (error) { console.warn(`Logseq Plugin: could not answer “${name}” from outside`, error); return { ok: false, said: String(error?.message || 'Logseq refused') }; }
    };
  }
  logseq.provideModel(safe);
}
G.outside = { answer };
})();
