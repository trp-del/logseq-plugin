/* PAGE: Relations. On every page Logseq shows (the main page, a page in the sidebar), the lists of what points at the page
   stand under the page's title and properties, above its own bullets, where the plugin before the rebuild had them, and
   Logseq's own Linked references and two-way tabs, which say the same less plainly, are taken away there. A journal day has
   them at its foot, after its bullets. A day in the journals feed has them too, at the foot of the day; with nothing pointing at it they
   take no place there.
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
/* Measured, one rule (the owner, 25 November 2026: "can you measure things to make sure they are aligned and proper spacing"):
   a mark stands in a box 16 wide that ends 4 before its words; from the middle of one line to the middle of the next it is 26
   inside a head, 32 from a head to what it heads, and 54 from one section to the next. */
.lk-relwrap { margin: 27px 0 20px; padding-left: 18px; font-size: 1rem; font-weight: 400; line-height: 24px; letter-spacing: normal; color: var(--lk-text); cursor: auto; }
.lk-relwrap:not(:has(.lk-relpage > .lk-list)) { display: none; }
.lk-relpage { gap: 28px; margin: 28px 0 0 19px; }   /* the lists one step in under the word Relations, as a bullet's children stand under it (the owner, 26 November 2026: "in-line with natural hierarchy") */
.lk-relpage > .lk-list > .lk-rows { margin-left: -7px; }
.lk-relpage > .lk-list > .lk-more { position: relative; left: -7px; }   /* Show more on its rows' words' edge */   /* a row's dot one step in from its list's name, as Logseq sets a child under its parent */
.lk-relsec { margin: 0; }
.lk-relfind-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--lk-mark-box); margin: 0 var(--lk-mark-gap) 0 -28px; color: var(--lk-quiet); }   /* the words on the edge of the word Relations, the mark hanging before them */
.lk-relsec:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-relsec > .lk-relhead { display: flex; gap: var(--lk-mark-gap); margin: 0 0 0 -28px;   /* the word on the page's edge, its arrow hanging before it as Logseq's own */ cursor: default; border-radius: 6px; }
.lk-relsec > .lk-relhead::after { margin-left: 8px; }
.lk-relsec > .lk-relhead:focus-visible { outline: none; background: var(--lk-wash); }
.lk-relsec > .lk-relhead .lk-fold { opacity: 0; margin-top: 0; }
.lk-relsec > .lk-relhead:hover .lk-fold, .lk-relsec > .lk-relhead[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-relsec > .lk-relhead[aria-expanded="true"] .lk-fold svg { transform: rotate(90deg); }
.lk-relsec:has(> .lk-relhead[aria-expanded="false"]) + .lk-rel, .lk-relsec:has(> .lk-relhead[aria-expanded="false"]) > .lk-relfind { display: none; }
.lk-relfind { display: flex; align-items: center; margin: 6px 0 0; }
.lk-relfind[hidden] { display: none; }
.lk-relfind .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid transparent; outline: 0; background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-relfind .lk-field:focus, .lk-relfind .lk-field:not(:placeholder-shown) { border-bottom-color: var(--lk-line); }
.lk-relfind .lk-field::placeholder { color: var(--lk-quiet); }
.lk-relsec > .lk-relhead .lk-fold { opacity: 1 !important; }
.lk-relsec > .lk-relhead:hover .lk-fold { color: var(--lk-text); }
.lk-relday { display: inline-flex; flex: none; font-size: var(--lk-small); }
.lk-relday[hidden] { display: none; }`);
    const kept = new Map();   // the plugin's element on a page -> { off, head }
    const wrapOf = foot => foot.parentElement;
    const doc = G.host();
    const section = (page, foot) => {
      const head = foot.previousElementSibling, uuid = page.uuid;
      head.innerHTML = `<div class="lk-relhead" role="button" tabindex="0" aria-expanded="${!shut.read().has(uuid)}"><span class="lk-fold">${G.node.CHEV}</span>Relations</div><div class="lk-relfind" hidden><span class="lk-relfind-icon">${G.touch.icon('search', 15)}</span><input class="lk-field" type="text" placeholder="Find in these" title="Words narrow every list. A day turns the lists back: on Oct 7" aria-label="Find in Relations" spellcheck="false" autocomplete="off"><span class="lk-relday" hidden><button type="button" class="lk-btn lk-low" data-by="-7">‹ a week earlier</button><button type="button" class="lk-btn lk-low" data-by="7">a week later ›</button><button type="button" class="lk-btn lk-low" data-by="0">Today</button></span></div>`;
      const line = head.firstElementChild, find = head.lastElementChild, field = find.querySelector('.lk-field');
      // On a day: a week earlier, a week later, and back to today.
      const steps = find.lastElementChild, today = () => G.days.number(new Date());
      const onDay = () => { const at = G.view.parse(field.value, today()); steps.hidden = !at.upTo; return at; };
      steps.addEventListener('click', event => {
        const by = event.target.closest('[data-by]')?.dataset.by, at = onDay();
        if (by == null || !at.upTo) return;
        if (by === '0') field.value = at.words;
        else { const day = new Date(Math.floor(at.upTo / 10000), Math.floor(at.upTo / 100) % 100 - 1, at.upTo % 100 + Number(by)); field.value = `${at.words ? at.words + ' ' : ''}on ${G.time.words(G.days.number(day))}`; }
        lists.find(field.value); onDay(); field.focus();
      });
      const lists = G.node.related(foot, uuid);
      const fold = () => line.setAttribute('aria-expanded', String(!shut.flip(uuid)));
      const onLine = event => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fold(); } };
      // A journal day has its lists at the foot of the day, after its bullets; every other page under its title and properties.
      const onDrawn = () => { if (lists.rows() >= 20 || field.value) find.hidden = false; if (lists.day() && !page.feed) { const at = G.touch.pageFoot(page.el, 'lk-relfoot'); if (wrapOf(foot).parentElement !== at) at.appendChild(wrapOf(foot)); } };
      const onInput = () => { lists.find(field.value); onDay(); };
      const onKey = event => {
        if (event.key === 'Escape') { if (field.value) { event.preventDefault(); event.stopPropagation(); field.value = ''; lists.find(''); onDay(); } else field.blur(); return; }
        const first = foot.querySelector('.lk-row:not(.lk-faint) > .lk-line');
        if (event.key === 'Enter' && first) { event.preventDefault(); G.touch.open(first.parentElement.dataset.uuid, event.shiftKey); }
        else if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
      };
      line.addEventListener('contextmenu', event => { event.preventDefault(); G.listview.hiddenMenu({ x: event.clientX, y: event.clientY, from: line }, () => lists.again()).catch(() => true).then(shown => { if (!shown) G.say('No list is hidden on the pages it points to.'); }); });
      line.addEventListener('click', onLine); line.addEventListener('keydown', onLine);
      foot.addEventListener('lk-drawn', onDrawn); field.addEventListener('input', onInput); field.addEventListener('keydown', onKey);
      return { head, side: page.side, show() { if (line.getAttribute('aria-expanded') === 'false') fold(); find.hidden = false; field.focus(); field.select(); },
        off() { foot.removeEventListener('lk-drawn', onDrawn); lists.off(); } };
    };
    const pass = () => {
      for (const [foot, one] of kept) if (!foot.isConnected) { one.off(); kept.delete(foot); }
      for (const page of G.touch.pages()) {
        // Where the plugin before the rebuild had it: under the title and the page's properties, above the page's own bullets.
        const wrap = page.el.querySelector('.lk-relwrap') || (!page.feed && G.touch.pageUnder(page.el, 'lk-relwrap')) || G.touch.pageFoot(page.el, 'lk-relwrap');
        if (wrap.dataset.uuid === page.uuid) continue;
        kept.get(wrap.lastElementChild)?.off();
        wrap.dataset.uuid = page.uuid;
        wrap.innerHTML = '<div class="lk-relsec"></div><div class="lk-rel lk-relpage"></div>';
        kept.set(wrap.lastElementChild, section(page, wrap.lastElementChild));
      }
    };
    base.onStop(G.touch.watch(pass));
    base.onStop(() => { for (const [foot, one] of kept) { one.off(); wrapOf(foot)?.remove(); } kept.clear(); for (const el of doc.querySelectorAll('.lk-relfoot')) el.remove(); });
    // The find line called up where it does not stand by itself: on the page in front.
    G.touch.command('lk-relations-find', 'Relations: find in them', () => {
      const live = [...kept].filter(([foot]) => foot.isConnected && foot.firstElementChild), one = (live.find(([, sec]) => !sec.side) || live[0])?.[1];
      if (one) one.show(); else G.say('Nothing points at this page yet.');
    });
  },
});
})();
