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
.lk-relpage { gap: 28px; margin: 0 0 0 -30px; padding-left: 20px; }   /* the padding keeps what hangs left of the rows in view while the section rolls */
.lk-relpage > :first-child { margin-top: 28px; }   /* the room above the first list is inside the section, so it rolls with it */   /* a list's name on the edge of the word Relations and of the page's property names (26 November 2026); its rows stay one step in under it */
.lk-relpage > .lk-list > .lk-list-head[data-one] > .lk-list-via { margin-left: calc(var(--lk-mark-box) + var(--lk-mark-gap)); }   /* a head with no arrow keeps the arrow's room */
.lk-relpage > .lk-list > .lk-rows { margin-left: -7px; }
.lk-relpage > .lk-list > .lk-more { position: relative; left: -7px; }   /* Show more on its rows' words' edge */   /* a row's dot one step in from its list's name, as Logseq sets a child under its parent */
.lk-relsec { margin: 0; }
.lk-relfind-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--lk-mark-box); margin: 0 var(--lk-mark-gap) 0 -8px; color: var(--lk-quiet); }   /* the magnifier inside the page's edge (the owner, 26 November 2026: "move the spotlight inward") */
.lk-relsec:not(:has(+ .lk-rel > .lk-list)) { display: none; }
.lk-relsec > .lk-relhead { display: flex; gap: var(--lk-mark-gap); margin: 0 0 0 -28px;   /* the word on the page's edge, its arrow hanging before it as Logseq's own */ cursor: default; border-radius: 6px; }
.lk-relsec > .lk-relhead::after { margin-left: 8px; }
.lk-relsec > .lk-relhead:focus-visible { outline: none; background: var(--lk-wash); }
.lk-relsec > .lk-relhead .lk-fold { opacity: 0; margin-top: 0; }
.lk-relsec > .lk-relhead:hover .lk-fold, .lk-relsec > .lk-relhead:focus-visible .lk-fold, .lk-relsec > .lk-relhead[aria-expanded="false"] .lk-fold { opacity: 1; }
.lk-relsec > .lk-relhead[aria-expanded="true"] .lk-fold svg { transform: rotate(90deg); }
.lk-relsec:has(> .lk-relhead[aria-expanded="false"]) + .lk-rel:not(.lk-folding), .lk-relsec:has(> .lk-relhead[aria-expanded="false"]) > .lk-relfind:not(.lk-folding) { display: none; }
/* The line that closes the section, the same as the one after the word, running on under the word (the owner, 27 November 2026),
   as far under the last row as the first list stands under the word's line: 54 from the middle of the row.
   Folded, it draws up and fades with the lists, and one line is left. */
.lk-relwrap::after { content: ""; display: block; height: 1px; margin: 40px 0 0 -8px; background: var(--lk-hair); transition: margin-top ${G.look.MOTION.roll}ms ease-out, opacity ${G.look.MOTION.roll}ms ease-out; }
.lk-relwrap:has(> .lk-relsec > .lk-relhead[aria-expanded="false"])::after { margin-top: 0; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .lk-relwrap::after { transition: none; } }
.lk-relfind { display: flex; align-items: center; }
.lk-relfind > * { margin-top: 6px; }
.lk-relfind[hidden] { display: none; }
.lk-relfind .lk-field { flex: 1; min-width: 0; border: 0; border-bottom: 1px solid transparent; outline: 0; background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); line-height: 24px; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-relfind .lk-field:focus, .lk-relfind .lk-field:not(:placeholder-shown) { border-bottom-color: var(--lk-line); }
.lk-relfind .lk-field::placeholder { color: var(--lk-quiet); }
.lk-relsec > .lk-relhead:hover .lk-fold { color: var(--lk-text); }
.lk-relday { display: inline-flex; flex: none; font-size: var(--lk-small); }
.lk-relday[hidden] { display: none; }`);
    const kept = new Map();   // the plugin's element on a page -> { off, head }
    const wrapOf = foot => foot.parentElement;
    const doc = G.host();
    const section = (page, foot) => {
      const head = foot.previousElementSibling, uuid = page.uuid;
      head.innerHTML = `<div class="lk-relhead" role="button" tabindex="0" aria-expanded="${!shut.read().has(uuid)}"><span class="lk-fold">${G.node.CHEV}</span>Relations</div><div class="lk-relfind" hidden><span class="lk-relfind-icon">${G.touch.icon('search', 15)}</span><input class="lk-field" type="text" placeholder="Search" title="Words narrow every list. A day turns the lists back: on Oct 7" aria-label="Find in Relations" spellcheck="false" autocomplete="off"><span class="lk-relday" hidden><button type="button" class="lk-btn lk-low" data-by="-7">‹ a week earlier</button><button type="button" class="lk-btn lk-low" data-by="7">a week later ›</button><button type="button" class="lk-btn lk-low" data-by="0">Today</button></span></div>`;
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
      // The section folds as a list does: what is under the word rolls up and then it is shut; opened, it rolls out. A press
      // while it moves turns it round from where it stands.
      let turn = 0;
      const fold = () => {
        const open = !shut.flip(uuid), now = ++turn, under = [find, foot];
        const from = under.map(el => el.classList.contains('lk-folding') ? el.offsetHeight : 0);
        const rest = el => { el.classList.remove('lk-folding'); for (const name of ['height', 'overflow', 'transition']) el.style.removeProperty(name); };
        if (!open) for (const el of under) el.classList.add('lk-folding');
        line.setAttribute('aria-expanded', String(open));
        under.forEach((el, i) => {
          if (open) { rest(el); G.node.roll(el, from[i]); }
          else G.node.rollUp(el).then(() => { if (now === turn) rest(el); });
        });
      };
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
    // A right-click in the section is the section's own. The section stands inside Logseq's block for the page's title, so a
    // right-click the plugin let pass opened Logseq's menu for the page, with Delete page in it. What has a menu of the plugin's
    // (the word Relations, a list's head, a line) has taken the press by now; anywhere else in the section no menu opens. An
    // opened node is Logseq's own editor and keeps Logseq's menus; the find line keeps the menu of a field.
    const ownRight = event => {
      if (event.target.closest('.lk-open') || (event.type !== 'contextmenu' && event.button !== 2)) return;
      event.stopPropagation();
      if (event.type === 'contextmenu' && !event.target.closest('input, textarea')) event.preventDefault();
    };
    const pass = () => {
      for (const [foot, one] of kept) if (!foot.isConnected) { one.off(); kept.delete(foot); }
      for (const page of G.touch.pages()) {
        // Where the plugin before the rebuild had it: under the title and the page's properties, above the page's own bullets.
        const wrap = page.el.querySelector('.lk-relwrap') || (!page.feed && G.touch.pageUnder(page.el, 'lk-relwrap')) || G.touch.pageFoot(page.el, 'lk-relwrap');
        // Logseq draws a page's properties again when a folded page is unfolded, and puts them last in the title's block: the lists go
        // back under them. Lists at the foot of a journal day, or of a page with no title, stay where they are.
        if (wrap.nextElementSibling && wrap.parentElement !== page.el && !wrap.parentElement.classList.contains('lk-relfoot')) wrap.parentElement.appendChild(wrap);
        if (!wrap.lkOwnRight) { wrap.lkOwnRight = true; for (const type of ['contextmenu', 'mousedown', 'pointerdown']) wrap.addEventListener(type, ownRight); }
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
