/* Look: how things look in a Logseq DB graph, as the visual grammar says. Loaded after the kit, the graph reader, the
   settings and the parts (the plugin's files.js). Each part draws one thing; the settings switch each on and off. The
   module registers with the plugin (plugin.js), which starts it and stops it. */
(function () {
const Look = window.Look;
async function main() {
  Look.style.apply(); Look.calm.apply();
  Look.marks.start();
  Look.props.start();
  Look.title.start();
  Look.folded.start();
  Look.sidebar.start();
  Look.cites.start();
  Look.links.start();
  Look.values.start();
  Look.notices.start();
  Look.focus.start();
  Look.keys.start();
  const { onStop } = Look.kit;
  onStop(logseq.DB.onChanged(change => Look.kit.graphChanged(change)));
  const own = Look.settings.schema.map(item => item.key);
  onStop(logseq.onSettingsChanged?.((now, before) => { if (!window.PluginDoor.settingChanged(own, now, before)) return; Look.style.apply(); Look.calm.apply(); Look.sidebar.apply(); Look.notices.apply(); Look.kit.run(Look.kit.host()); Look.links.load(); }));
  onStop(logseq.App.onCurrentGraphChanged(() => { window.PluginDoor.undo.clear('look'); Look.marks.load(); Look.props.load(); }));   // an arrow would act on the graph left behind
}
function stop() {
  // Each on its own: a part that never started must not leave the others running.
  for (const part of ['marks', 'props', 'title', 'folded', 'sidebar', 'links', 'cites', 'values', 'notices', 'focus', 'keys', 'calm']) { try { Look[part].stop(); } catch (error) { console.error(`Look: ${part} could not stop`, error); } }
  // The base: Look's passes off the screen watcher, its listeners and Logseq's hooks off, then what it left on the page.
  const done = Look.kit.stopAll();
  Look.kit.sweep();
  return done;
}
window.PluginDoor.describe('look', { schema: Look.settings.schema, specimen: Look.settings.specimen, picture: on => Look.settings.specimen({ key: 'quietLinks', type: 'boolean' }, on) + ' &nbsp; ' + Look.settings.specimen({ key: 'tagsAsClasses', type: 'boolean' }, on).replace(/^Spoke with Dr\. Mei Chen &nbsp; /, '') });
window.PluginDoor.register({
  key: 'look', title: 'Look', about: 'How things look: a link in the text colour, a page in a property that opens it, a tag in serif, a page’s place beside its title, an icon of what a property holds, notices small at the bottom.',
  schema: Look.settings.schema.map(({ key, type, title, description, default: def }) => ({ key, type, title, description, default: def })),
  start: main, stop,
});
})();
