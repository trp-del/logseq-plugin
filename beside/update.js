/* BESIDE: update plugins. Logseq loads a plugin from a folder once, when it starts; what is put into the folder afterwards
   (a new release) waits for the next start. "u p", in the way of Logseq's own "t p" for its plugins page, or Update plugins in
   the command palette, has Logseq load every such plugin again from its folder, and one line then says what that brought.
   Plugins Logseq installed itself are not touched: Logseq updates those from its plugins page. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'update', title: 'Update plugins', about: 'u p: the plugins Logseq loads from a folder are loaded again, so they run what their folders hold now.',
  start() {
    const before = G.touch.plugins.took();   // left by the reload that started this very run: the versions before it
    if (before) { const words = G.update.said(before, G.touch.plugins.mine()); if (words) G.say(words, 'success'); }
    G.touch.command('lk-update-plugins', 'Update plugins', () => {
      const mine = G.touch.plugins.mine();
      if (!mine.length) { G.say('No plugin here is loaded from a folder. Logseq updates the ones it installed from its plugins page.'); return; }
      G.touch.plugins.keep(mine);
      G.touch.plugins.reload(mine.map(one => one.id)).catch(error => { console.error('Logseq Plugin: the plugins could not be reloaded', error); G.say('The plugins could not be reloaded.', 'error'); });
    }, 'u p');
  },
});
})();
