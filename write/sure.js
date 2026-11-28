/* WRITING: sure values. When you leave a bullet you wrote in, what its words already say for certain is written into its
   properties: the doctor you linked goes under the property that takes doctors, the page you are on under the one that takes
   its kind, the day under the date. Only into empty properties, only where one thing alone can be meant (core/sure.js), and
   never on a bullet you did not change. Logseq shows the value on the bullet at once; its own Undo takes it back.
   A web address typed without http:// in front is made a link the same way, on leaving the bullet. Making the link writes the
   bullet's words whole, and Logseq puts words written into a bullet that is open into its box: so the link is written only
   when nobody is writing in that bullet, asked right before the write, and only while the graph still holds the words that
   were left (core/sure.js, linking). Gone back into at once, the bullet gets its link when it is next left. */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'sure', title: 'Sure values', about: 'On leaving a bullet you wrote in: a web address becomes a link, and what its words say for certain is written into its empty properties.',
  start(base) {
    const busy = new Set();
    base.onStop(G.touch.left(async (uuid, left) => {
      if (busy.has(uuid)) return;
      busy.add(uuid);
      try {
        if (G.sure.addresses(left) != null) {   // only a bullet left with an address in its words is read for a link
          const was = await G.read.asKept(uuid, left), kept = await G.read.typed(uuid);
          const linked = G.sure.linking({ kept, left: was, writing: (await G.touch.writingIn()) === uuid });   // asked last, right before the write
          if (linked != null) await G.write.setWords(uuid, linked);
        }
        const facts = await G.read.writing(uuid);
        for (const value of facts ? G.sure.sure(facts) : []) await G.write.setNode(uuid, value.ident, value.value);
      } catch (error) { console.error('Logseq Plugin: a bullet\'s sure values could not be written', error); }
      busy.delete(uuid);
    }));
  },
});
})();
