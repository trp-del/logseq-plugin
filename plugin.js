/* The frame every part stands in. Loaded first; holds nothing a person sees.
     G.part({ key, title, about, start(base), stop() })   a part says what it is; main.js starts the ones switched on
     G.base(key)     what a part adds to Logseq's window, kept so that all of it goes when the part stops:
                     listen(target, type, fn, opts), style(id, css), onStop(fn), stop()
     G.host()        Logseq's own page (the plugin runs in a frame beside it)
     G.esc(text)     words made safe to put into markup
     G.say(text)     a notice, Logseq's own
   A file may use only what the layers under it gave G (tools/layers.js checks this): ground, then node, then page. */
(function () {
const G = (window.PluginDoor ||= {});
G.parts = []; G.started = [];
G.part = part => { G.parts.push(part); };
G.on = key => logseq.settings?.[key + 'On'] !== false;
G.host = () => window.parent.document;
G.esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
G.say = (text, status = 'info') => { try { logseq.UI.showMsg(text, status); } catch (error) { console.log('Logseq Plugin: ' + text); } };
G.base = key => {
  const offs = [];
  const base = {
    key,
    onStop(off) { if (typeof off === 'function') offs.push(off); return off; },
    listen(target, types, fn, opts) {
      const list = [].concat(types);
      for (const type of list) target.addEventListener(type, fn, opts);
      return base.onStop(() => { for (const type of list) target.removeEventListener(type, fn, opts); });
    },
    style(id, css) {
      const doc = G.host(), name = `lk-style-${key}-${id}`;
      doc.getElementById(name)?.remove();
      const el = doc.createElement('style'); el.id = name; el.textContent = css; doc.head.appendChild(el);
      return base.onStop(() => el.remove());
    },
    async stop() { for (const off of offs.splice(0).reverse()) { try { await off(); } catch (error) { console.error(`Logseq Plugin: ${key} left something behind`, error); } } },
  };
  return base;
};
})();
