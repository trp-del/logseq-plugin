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
  Look.marks.stop(); Look.props.stop(); Look.title.stop(); Look.folded.stop(); Look.sidebar.stop();
  Look.kit.stopWatching();
  Look.kit.sweep();
}
// In the settings window one row stands for Look's icon and Threads' mark of the same thing, and Threads' tip on a cut
// name sits with the other property rows.
const propertyRows = row => row.key !== 'propertyIcons' ? [row] : [{ ...row, also: 'propertyKindIcons' },
  { key: 'propertyNameTips', type: 'boolean', default: true, title: 'A cut property name whole under the pointer', description: 'With the pointer on a property’s name that Logseq has cut short, its whole name shows as a tooltip.' }];
window.PluginDoor.describe('look', { schema: Look.settings.schema.flatMap(propertyRows), specimen: Look.settings.specimen });
window.PluginDoor.register({
  key: 'look', title: 'Look', about: 'How things look: a link in the text colour, the sort’s mark before it, a tag in mono, a page’s place beside its title, an icon of what a property holds.',
  schema: Look.settings.schema.map(({ key, type, title, description, default: def }) => ({ key, type, title, description, default: def })),
  start: main, stop,
});
})();
