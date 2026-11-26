/* BESIDE: update plugins. "u p", in the way of Logseq's own "t p" for its plugins page, or Update plugins in the command palette,
   brings every plugin Logseq runs to its newest, and one line then says what that brought.
   - The plugins Logseq installed from its marketplace or from a GitHub release (its own list of them): each is handed to Logseq's
     own updater, the one behind "Check update" on a plugin's card, which fetches a newer release when there is one, as 0.5.17 did
     (the owner, 26 November 2026: "u p is still not working. look to pre 0.6.0 to find it correctly used").
   - The plugins Logseq loads from a folder: Logseq loads each one once, when it starts, so what was put into the folder
     afterwards (a new release) waits for the next start. Logseq loads them again from their folders, this one last. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'update', title: 'Update plugins', about: 'u p: every plugin is brought to its newest: those Logseq installed (from its marketplace or a GitHub release) are updated by Logseq\'s own updater, those from a folder are loaded again.',
  start() {
    const kept = G.touch.plugins.took();   // left by the reload that started this very run: what came before it
    if (kept) {
      // This plugin was updated from its release (Logseq loaded the new copy) or loaded again from its folder: say what came.
      const market = kept.market || {};
      if (kept.own) market.updated = [...(market.updated || []), { ...kept.own, to: G.touch.plugins.now(kept.own.id)?.version || '' }];
      const words = G.update.said(kept.list || [], G.touch.plugins.mine(), market); if (words) G.say(words, market.failed?.length ? 'warning' : 'success');
    }
    let running = false;
    G.touch.command('lk-update-plugins', 'Update plugins', async () => {
      if (running) return;
      running = true;
      try {
        const fromRelease = await G.touch.plugins.market(), market = await G.touch.plugins.updates(fromRelease);
        const mine = G.touch.plugins.mine().filter(one => !fromRelease.some(other => other.id === one.id));
        if (!mine.length) { const words = G.update.said([], [], market); G.say(words || 'No plugin to update.', market.failed.length ? 'warning' : 'success'); return; }
        G.touch.plugins.keep({ list: mine, market });
        await G.touch.plugins.reload(mine.map(one => one.id));
      } catch (error) { console.error('Logseq Plugin: the plugins could not be updated', error); G.say('The plugins could not be updated.', 'error'); }
      finally { running = false; }
    }, 'u p');
  },
});
})();
