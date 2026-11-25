/* PAGE: Relations. On every page Logseq shows (the main page, a page in the sidebar), the lists of what points at the page
   stand under the page's own bullets, and Logseq's own Linked references and two-way tabs, which say the same less plainly,
   are taken away there. A day in the journals feed is left as Logseq draws it.
   The section stands under its own line, the word Relations with a thin line after it: a press folds the whole of it, kept
   for each page. From twenty nodes up a find line stands under that line (Relations: find in them calls it up anywhere):
   words narrow every list, "on Oct 7" turns the lists back to that day, Enter opens the first node found, Escape empties it. */
(function () {
const G = window.PluginDoor;
const SHUT = 'lk.rel-shut';
const shut = { read() { try { return new Set(JSON.parse(G.host().defaultView.localStorage.getItem(SHUT) || '[]')); } catch (error) { return new Set(); } },
  flip(uuid) { const set = shut.read(); if (!set.delete(uuid)) set.add(uuid); try { G.host().defaultView.localStorage.setItem(SHUT, JSON.stringify([...set])); } catch (error) { /* this sitting only */ } return set.has(uuid); } };
G.part({
  key: 'relations', title: 'Relations', about: 'Under a page: every node that points at it, one list for each property, and where it is mentioned. Any row opens in place.',
  start(base) {
    base.style('hides', G.touch.HIDES + `
${G.touch.PAGE} > .lk-rel { margin: 8px 0 32px; }
.lk-relsec { margin: 20px 0 0; }
.lk-relsec:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-relsec > .lk-relhead { display: flex; margin: 0 0 0 -18px; cursor: default; border-radius: 6px; }
.lk-relsec > .lk-relhead:focus-visible { outline: none; background: var(--lk-wash); }
.lk-relsec > .lk-relhead .lk-fold { opacity: 0; margin-top: 0; }
.lk-relsec > .lk-relhead:hover .lk-fold, .lk-relsec > .lk-relhead[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-relsec > .lk-relhead[aria-expanded="true"] .lk-fold svg { transform: rotate(90deg); }
.lk-relsec:has(> .lk-relhead[aria-expanded="false"]) + .lk-rel, .lk-relsec:has(> .lk-relhead[aria-expanded="false"]) > .lk-relfind { display: none; }
.lk-relfind { display: flex; margin: 2px 0 6px; }
.lk-relfind[hidden] { display: none; }
.lk-relfind .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid transparent; outline: 0; background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-relfind .lk-field:focus, .lk-relfind .lk-field:not(:placeholder-shown) { border-bottom-color: var(--lk-line); }
.lk-relfind .lk-field::placeholder { color: var(--lk-off); }`);
    const kept = new Map();   // the plugin's element on a page -> { off, head }
    const doc = G.host();
    const section = (page, foot) => {
      const head = G.touch.pageFoot(page.el, 'lk-relsec'), uuid = page.uuid;
      head.innerHTML = `<div class="lk-relhead" role="button" tabindex="0" aria-expanded="${!shut.read().has(uuid)}"><span class="lk-fold">${G.node.ARROW}</span>Relations</div><div class="lk-relfind" hidden><input class="lk-field" type="text" placeholder="Find in these, or a day: on Oct 7" aria-label="Find in Relations" spellcheck="false" autocomplete="off"></div>`;
      const line = head.firstElementChild, find = head.lastElementChild, field = find.firstElementChild;
      const lists = G.node.related(foot, uuid);
      const fold = () => line.setAttribute('aria-expanded', String(!shut.flip(uuid)));
      const onLine = event => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fold(); } };
      const onDrawn = () => { if (lists.rows() >= 20 || field.value) find.hidden = false; };
      const onInput = () => lists.find(field.value);
      const onKey = event => {
        if (event.key === 'Escape') { if (field.value) { event.preventDefault(); event.stopPropagation(); field.value = ''; lists.find(''); } else field.blur(); return; }
        const first = foot.querySelector('.lk-row:not(.lk-faint) > .lk-line');
        if (event.key === 'Enter' && first) { event.preventDefault(); G.touch.open(first.parentElement.dataset.uuid, event.shiftKey); }
        else if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
      };
      line.addEventListener('click', onLine); line.addEventListener('keydown', onLine);
      foot.addEventListener('lk-drawn', onDrawn); field.addEventListener('input', onInput); field.addEventListener('keydown', onKey);
      return { head, side: page.side, show() { if (line.getAttribute('aria-expanded') === 'false') fold(); find.hidden = false; field.focus(); field.select(); },
        off() { foot.removeEventListener('lk-drawn', onDrawn); lists.off(); head.remove(); } };
    };
    const pass = () => {
      for (const [foot, one] of kept) if (!foot.isConnected) { one.off(); kept.delete(foot); }
      for (const page of G.touch.pages()) {
        if (page.feed) continue;
        const foot = G.touch.pageFoot(page.el, 'lk-rel');
        if (foot.dataset.uuid === page.uuid) continue;
        kept.get(foot)?.off();
        foot.dataset.uuid = page.uuid;
        kept.set(foot, section(page, foot));
      }
    };
    base.onStop(G.touch.watch(pass));
    base.onStop(() => { for (const [foot, one] of kept) { one.off(); foot.remove(); } kept.clear(); });
    // The find line called up where it does not stand by itself: on the page in front.
    G.touch.command('lk-relations-find', 'Relations: find in them', () => {
      const live = [...kept].filter(([foot]) => foot.isConnected && foot.firstElementChild), one = (live.find(([, sec]) => !sec.side) || live[0])?.[1];
      if (one) one.show(); else G.say('Nothing points at this page yet.');
    });
  },
});
})();
