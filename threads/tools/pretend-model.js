/* Starts parts/model.js in a pretend window the way main.js does (0.4.224), for the tests that load a part on its own
   (tools/tags-test.js, tag-drag-test.js, tags-speed.js, pictures.js, shadow-test.js, shadow-write-test.js): the core's
   dsQuery reads window.logseq.DB unless the test gave the core one, graphWide remembers nothing, and what the test put
   on the core itself wins over the model's own. Load parts/shared.js and parts/model.js first, then this, then the part.
   From node: require('./pretend-model') is the script's text, to eval in the window or add to the page. */
module.exports = `(() => {
  const core = window.refinementCore ||= {};
  core.provided ||= {};
  core.provide = things => Object.assign(core.provided, things);
  core.dsQuery ||= async query => { const rows = await logseq.DB.datascriptQuery(query); return Array.isArray(rows) ? rows : []; };
  core.graphWide ||= (name, load) => Promise.resolve().then(load);
  // What a part on the kit asks of the core (0.4.319): the hooks, the screen door, the settings' save, a style sent.
  for (const hook of ['onPageChange', 'onDatabaseChange', 'onSettingsChange', 'onGraphChange']) core[hook] ||= () => {};
  core.screen ||= window.refinementShared.screen;
  core.saveSettings ||= patch => logseq.updateSettings(patch);
  core.sendStyle ||= () => {};
  const part = window.refinementParts.find(p => p.name === 'model');
  part.provide(core);
  part.start();
  // What the test put on the core itself (a pretend propSchema, say) wins over the model's own.
  for (const key of Object.keys(core.provided)) if (key in core && key !== 'provided' && key !== 'provide') core.provided[key] = core[key];
})();`;
