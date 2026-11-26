/* Loaded last. The three things Logseq gives a plugin only once: the settings list (a switch for each part), the start (each
   part in turn, one failing leaving the rest running) and the clean-up (every part that began, in reverse). */
(function () {
const G = window.PluginDoor;
const bases = [];
logseq.useSettingsSchema([
  { key: 'partsHeading', type: 'heading', default: null, title: 'What runs', description: 'Each part of the plugin, on or off. A change takes effect after the plugin is reloaded.' },
  ...G.parts.map(part => ({ key: part.key + 'On', type: 'boolean', default: true, title: part.title, description: part.about })),
  ...G.parts.flatMap(part => part.settings || []),
]);
// On a cold start Logseq starts a plugin before the graph's database is up: wait for the first read that answers.
async function graphReady() {
  for (let tries = 0; tries < 150; tries++) {
    try { await logseq.DB.datascriptQuery('[:find ?t :where [?t :db/ident :logseq.class/Tag]]'); return true; } catch (error) { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  return false;
}
async function main() {
  try { void window.parent.document; } catch (error) {
    G.say('Logseq Plugin cannot reach Logseq’s page from here. Uninstall it, then install it again with the "effect" box ticked.', 'error');
    return;
  }
  logseq.beforeunload(async () => { for (const base of bases.splice(0).reverse()) await base.stop(); });
  // What stands whichever parts run: the look's ground, the pieces of the node, and Logseq's editor asked for.
  const root = G.base('ground'); bases.push(root);
  root.style('look', G.look.faces(String(logseq.baseInfo?.lsr || '')) + G.look.TOKENS + G.look.PRESS + G.menu.CSS + G.undo.CSS + G.ask.CSS + G.line.CSS + G.node.CSS + G.listview.CSS + G.adding.CSS + G.pick.CSS + G.timeline.CSS + G.touch.OPENED + G.touch.MARKS);
  if (!(await graphReady())) G.say('Logseq Plugin needs a DB graph open. It starts its parts anyway; if they stay empty, reload the plugin once the graph is open.', 'warning');
  // A promise the plugin let fall is said in the console with the plugin's name, never as a red box over the page.
  root.listen(window, 'unhandledrejection', event => { console.error('Logseq Plugin: a step failed', event.reason); event.preventDefault(); });
  G.touch.editor.start(); root.onStop(() => G.touch.editor.stop());
  root.onStop(G.touch.here());
  for (const part of G.parts) {
    if (!G.on(part.key)) continue;
    const base = G.base(part.key); bases.push(base);
    try { await part.start(base); if (part.stop) base.onStop(() => part.stop()); G.started.push(part); }
    catch (error) { console.error(`Logseq Plugin: ${part.title} could not start`, error); G.say(`${part.title} could not start. The other parts run.`, 'warning'); await base.stop(); }
  }
}
logseq.ready(main).catch(error => console.error('Logseq Plugin: could not start', error));
})();
