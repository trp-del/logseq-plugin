/* WRITING: sure values. When you leave a bullet you wrote in, what its words already say for certain is written into its
   properties: the doctor you linked goes under the property that takes doctors, the page you are on under the one that takes
   its kind, the day under the date. Only into empty properties, only where one thing alone can be meant (core/sure.js), and
   never on a bullet you did not change. Logseq shows the value on the bullet at once; its own Undo takes it back. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'sure', title: 'Sure values', about: 'On leaving a bullet you wrote in: what its words say for certain is written into its empty properties.',
  start(base) {
    const busy = new Set();
    base.onStop(G.touch.left(async uuid => {
      if (busy.has(uuid)) return;
      busy.add(uuid);
      try {
        const facts = await G.read.writing(uuid);
        for (const value of facts ? G.sure.sure(facts) : []) await G.write.setNode(uuid, value.ident, value.value);
      } catch (error) { console.error('Logseq Plugin: a bullet\'s sure values could not be written', error); }
      busy.delete(uuid);
    }));
  },
});
})();
