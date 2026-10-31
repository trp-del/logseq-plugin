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
  logseq.DB.onChanged(({ blocks }) => Look.kit.graphChanged(blocks));
  logseq.onSettingsChanged?.(() => { Look.style.apply(); Look.sidebar.apply(); Look.kit.run(Look.kit.host()); });
  logseq.App.onCurrentGraphChanged(() => { Look.marks.load(); });
  // The settings window: from the command palette (Logseq's gear on the plugin's card still opens its own panel, which no
  // plugin can replace).
  logseq.App.registerCommandPalette({ key: 'look-settings', label: 'Look: settings' }, () => Look.settings.openWindow());
}
function stop() {
  Look.marks.stop(); Look.props.stop(); Look.title.stop(); Look.folded.stop(); Look.sidebar.stop();
  Look.settingsWindow.close();
  Look.kit.stopWatching();
  Look.kit.sweep();
}
window.Plugin.register({
  key: 'look', title: 'Look', about: 'How things look: a link in the text colour, the sort’s mark before it, a tag in mono, a page’s place beside its title, an icon of what a property holds.',
  schema: Look.settings.schema.map(({ key, type, title, description, default: def }) => ({ key, type, title, description, default: def })),
  start: main, stop,
});
})();
