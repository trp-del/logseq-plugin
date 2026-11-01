/* Look: how things look in a Logseq DB graph, as the visual grammar says. Loaded after the kit, the graph reader, the
   settings and the parts (the plugin's files.js). Each part draws one thing; the settings switch each on and off. The
   module registers with the plugin (plugin.js), which starts it and stops it. */
(function () {
const Look = window.Look;
async function main() {
  Look.style.apply();
  Look.marks.start();
  Look.props.start();
  Look.title.start();
  Look.folded.start();
  Look.sidebar.start();
  logseq.DB.onChanged(change => Look.kit.graphChanged(change));
  const own = Look.settings.schema.map(item => item.key);
  logseq.onSettingsChanged?.((now, before) => { if (!window.PluginDoor.settingChanged(own, now, before)) return; Look.style.apply(); Look.sidebar.apply(); Look.kit.run(Look.kit.host()); });
  logseq.App.onCurrentGraphChanged(() => { Look.marks.load(); Look.props.load(); });
}
function stop() {
  // Each on its own: a part that never started must not leave the others running.
  for (const part of ['marks', 'props', 'title', 'folded', 'sidebar']) { try { Look[part].stop(); } catch (error) { console.error(`Look: ${part} could not stop`, error); } }
  Look.kit.stopWatching();
  Look.kit.sweep();
}
window.PluginDoor.describe('look', { schema: Look.settings.schema, specimen: Look.settings.specimen });
window.PluginDoor.register({
  key: 'look', title: 'Look', about: 'How things look: a link in the text colour, the sort’s mark before it, a tag in mono, a page’s place beside its title, an icon of what a property holds.',
  schema: Look.settings.schema.map(({ key, type, title, description, default: def }) => ({ key, type, title, description, default: def })),
  start: main, stop,
});
})();
