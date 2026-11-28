/* NODE: the one menu. A short list at the thing pressed; arrows walk it, Enter takes, Escape lets go and gives the focus back.
     G.menu(at, items, opts)   at: the element pressed, or { x, y, from } for a right-click;
                               items: { word, icon?, on?, depth?, face?, goes?, value?, take } | { group } | { gap: true }
                               (goes: what takes something away, in red; value: a quiet word at the line's end, what a setting is at)
   item.sub: the choices under a line (an array, or a function answering one), shown as a menu of its own beside it, as the
   Mac's menus do: the line carries a chevron, and pointing at it, Right, Enter or a press opens it; Left or Escape goes back.
   One menu at a time; a second closes the first.
   Tags as an outline fold, as Logseq's outline does: an arrow before a tag that has tags under it (under the pointer, and
   always once folded), Right and Left on its line, Cmd-Up and Cmd-Down. What is folded is kept on this Mac, in every such list
   (G.folds). Words typed to narrow the list look through the folded tags too: each tag found stays under the tags it sits under, those
   in a quieter ink and passed over by the arrows, and the typed letters are marked as in Search.
   In an outline there is one highlight. It starts at the line the tag hangs from, never across the lines, and glides from tag
   to tag, drawing in and out with the depth (not with the Mac's Reduce motion). The pointer and the arrows move the same one,
   so Enter takes the tag lit; in a quiet list the pointer only borrows it, and Enter still takes what an arrow lit. In a quiet list the keys are the bullet's.
   opts.find: a line to type in at the list's head, which narrows it (true, or the words it shows while empty); with it,
   opts.make(words) -> { word, take } offers a line for words no line has, and opts.enter(words) takes the words themselves.
   opts.alt { word, icon, key, take(words) }: with opts.find, what Option-Enter does with the words typed, whichever line is lit;
   the list closes. While words are typed a last line, kept in view, says it and its key, and does it when taken.
   opts.rank: with opts.find, the lines closest to the words typed come first (a list of commands).
   opts.search(words) -> items: with opts.find, what the words find elsewhere, listed under the lines under "In your notes".
   opts.searchName '': what is found is more of the same list (a list too long to hold whole): its lines come under the
   others as lines like them, word and value, under no name.
   A line found may carry item.under { tag, page }, each { name, to }: its tag at the right end of its words, as tags are
   drawn, and under them the page it is on. A click on either goes there (Shift: in the sidebar), not to the line.
   opts.peek(holder, item, shut) -> what takes it away, or null for a line with nothing to look at: a tap on Shift, alone, shows
   the lit line in a box beside the menu (the owner, 27 November 2026). The arrows move it along; Shift or Escape closes it.
   While it is closed the pointer lights the found line it moves over, so a tap looks at the line pointed at.
   item.also: other words a line is found by.
   opts.height: the most the menu stands tall, its lines scrolling under the line to type in.
   opts.dock: the menu stands in the window's bottom right corner at one size, which the words narrowing it do not change.
   opts.quiet: a list offered while a bullet is being written, as Logseq offers its own: the keys stay in the bullet, nothing is
   lit until an arrow is pressed, Enter takes only a lit line, Escape lets go, and any other key lets go and goes on into the
   bullet, so carrying on writing is the answer no. opts.lit: the line of a quiet list that is lit from the start. */
(function () {
const G = window.PluginDoor;
let close = null;
// The tags folded in the lists of tags, by name, kept on this Mac.
const FOLDED = 'lk.tags-folded';
let folded = null;
const kept = () => { if (!folded) { try { folded = new Set(JSON.parse(G.host().defaultView.localStorage.getItem(FOLDED) || '[]')); } catch (error) { folded = new Set(); } } return folded; };
G.folds = {
  shut: name => kept().has(name),
  set(name, on) { if (on) kept().add(name); else kept().delete(name); try { G.host().defaultView.localStorage.setItem(FOLDED, JSON.stringify([...kept()])); } catch (error) { /* kept for this run only */ } },
};
G.menu = (at, items, opts = {}) => { close?.(); return make(at, items, opts, null); };
function make(at, items, opts, parent) {
  const from = at.from || at, doc = from.ownerDocument, win = doc.defaultView;
  const menu = doc.createElement('div'); menu.className = 'lk-menu'; menu.setAttribute('role', 'menu');
  const tree = items.some(item => item.depth != null);   // tags as an outline: each a bullet, a line down from it along the tags under it
  if (tree) menu.classList.add('lk-menu-tree');
  menu.innerHTML = (opts.find ? `<input class="lk-menu-find" type="text" placeholder="${G.esc(opts.find === true ? 'Find' : opts.find)}" aria-label="${G.esc(opts.find === true ? 'Find' : opts.find)}" spellcheck="false" autocomplete="off">` : '') + items.map((item, i) => item.gap ? '<div class="lk-gap"></div>' : item.group ? `<div class="lk-group">${G.esc(item.group)}</div>`
    : `<button type="button" class="lk-item${item.sub ? ' lk-has-sub' : ''}${item.on ? ' on' : ''}${item.goes ? ' lk-goes' : ''}" role="menuitem" data-i="${i}" data-also="${G.esc(item.also || '')}" data-face="${item.face || ''}" style="${tree ? `padding-left: ${4 + (item.depth || 0) * 29}px; ` : ''}--lk-d: ${item.depth || 0}"${opts.quiet ? ' tabindex="-1"' : ''}><span class="lk-item-icon">${item.icon || ''}</span>${tree ? `<span class="lk-item-fold" aria-hidden="true">${G.touch.icon('chevron-right', 14)}</span><span class="lk-item-bul" aria-hidden="true"></span>` : ''}<span class="lk-item-word">${G.esc(item.word)}</span>${item.value && !item.sub ? `<span class="lk-item-value">${G.esc(item.value)}</span>` : ''}${item.on ? `<span class="lk-item-on">${G.touch.icon('check', 14)}</span>` : ''}${item.sub ? `<span class="lk-item-sub">${G.touch.icon('chevron-right', 14)}</span>` : ''}</button>`).join('');
  doc.body.appendChild(menu);
  const outline = tree ? [...menu.querySelectorAll('.lk-item')] : [], nameOf = row => items[Number(row.dataset.i)].word;
  const foldUp = () => {
    const state = G.tags.folds(outline.map(row => ({ depth: items[Number(row.dataset.i)].depth, name: nameOf(row) })), G.folds.shut);
    outline.forEach((row, i) => { row.hidden = state[i].hidden; row.classList.toggle('lk-kids', state[i].kids); row.classList.toggle('lk-shut', state[i].shut); if (state[i].kids) row.setAttribute('aria-expanded', String(!state[i].shut)); });
  };
  const fold = (row, on = !row.classList.contains('lk-shut')) => { if (!row?.classList.contains('lk-kids')) return false; G.folds.set(nameOf(row), on); foldUp(); lightUnder(row); return true; };
  // A key that folds: Cmd-Up and Cmd-Down as in Logseq's outline; Left and Right where the keys are not typing.
  const foldKey = (event, row, plain) => {
    if (!row) return false;
    const cmd = event.metaKey || event.ctrlKey, shut = row.classList.contains('lk-shut');
    if (cmd && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return fold(row, event.key === 'ArrowUp');
    if (plain && !cmd && ((event.key === 'ArrowLeft' && !shut) || (event.key === 'ArrowRight' && shut))) return fold(row, !shut);
    return false;
  };
  foldUp();
  if (opts.height) menu.style.maxHeight = Math.min(opts.height, win.innerHeight - 16) + 'px';   // a long list scrolls under its line to type in
  const box = at.from ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : from.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  if (parent) {   // beside the line it opens from, on the right where there is room, else on the left
    const side = parent.menu.getBoundingClientRect(), right = side.right - 2 + w <= win.innerWidth - 8;
    menu.style.left = (right ? side.right - 2 : Math.max(8, side.left + 2 - w)) + 'px';
    menu.style.top = Math.max(8, Math.min(box.top - 4, win.innerHeight - h - 8)) + 'px';
  } else
  menu.style.left = Math.max(8, Math.min(box.left, win.innerWidth - w - 8)) + 'px';
  if (opts.dock) Object.assign(menu.style, { left: 'auto', top: 'auto', right: '12px', bottom: '12px', width: Math.max(w, 352) + 'px', height: Math.min(opts.height || 420, win.innerHeight - 24) + 'px', boxSizing: 'border-box' });
  if (opts.quiet) {
    // Never over the line being written: under it where there is room for a good part of the list, else above it; the list scrolls.
    const below = win.innerHeight - box.bottom - 12, above = box.top - 12, under = h <= below || below >= 220 || below >= above, room = Math.min(320, Math.max(120, under ? below : above));
    menu.style.maxHeight = room + 'px';
    menu.style.top = (under ? box.bottom + 4 : Math.max(8, box.top - 4 - Math.min(h, room))) + 'px';
  } else if (!parent && !opts.dock) menu.style.top = (box.bottom + 4 + h > win.innerHeight - 8 ? Math.max(8, box.top - 4 - h) : box.bottom + 4) + 'px';
  const rows = () => [...menu.querySelectorAll('.lk-item')].filter(row => !row.hidden);
  // An outline's one highlight, laid under the line it is on. It appears where it is wanted and glides from there.
  let glow = null;
  if (tree) { glow = doc.createElement('div'); glow.className = 'lk-glow'; glow.setAttribute('aria-hidden', 'true'); menu.insertBefore(glow, outline[0]); }
  const lightUnder = row => {
    if (!glow) return;
    if (!row || row.hidden || !row.isConnected) return void glow.classList.remove('on');
    const fresh = !glow.classList.contains('on'), depth = items[Number(row.dataset.i)]?.depth || 0;
    if (fresh) glow.style.transition = 'none';
    Object.assign(glow.style, { left: row.offsetLeft + depth * 29 + 'px', top: row.offsetTop + 'px', height: row.offsetHeight + 'px' });
    glow.classList.add('on');
    if (fresh) { void glow.offsetWidth; glow.style.transition = ''; }
  };
  let child = null, gone = false;
  const shut = () => { if (gone) return; gone = true; peeks.close(); child?.shut(); child = null; for (const off of offs) off(); menu.remove(); };
  /* The look beside the menu. What is drawn in it comes from opts.peek; it is shown once it has come to rest, and the one
     before it stays until then, so arrowing along does not flash. */
  const peeks = (() => {
    let box = null, shown = null, coming = null, wait = 0;
    const drop = one => { if (one) { win.clearInterval(one.watch); one.off?.(); one.el.remove(); } };
    const close = () => { win.clearTimeout(wait); drop(coming); drop(shown); coming = shown = null; box?.remove(); box = null; };
    const place = () => { const at = menu.getBoundingClientRect(), width = Math.max(260, Math.min(420, at.left - 16)); Object.assign(box.style, { left: Math.max(8, at.left - 8 - width) + 'px', top: at.top + 'px', width: width + 'px', height: at.height + 'px' }); };
    const show = item => {
      if (!box) return;
      if (coming) { drop(coming); coming = null; }
      if (item && shown?.item === item) { box.hidden = false; return; }
      const el = doc.createElement('div'); el.className = 'lk-open lk-peeked';
      box.appendChild(el);
      const off = item && opts.peek(el, item, () => { close(); menu.querySelector('.lk-menu-find')?.focus({ preventScroll: true }); });
      if (!off) { el.remove(); drop(shown); shown = null; box.hidden = true; return; }
      const next = coming = { item, el, off }, from = win.performance.now();
      next.watch = win.setInterval(() => {
        if (!el.dataset.whole && win.performance.now() - from < 900) return;
        win.clearInterval(next.watch); drop(shown); shown = next; coming = null; el.classList.add('whole'); box.hidden = false; box.scrollTop = 0;
      }, 30);
    };
    return {
      close, get open() { return !!box; }, has: target => !!box && (box.contains(target) || G.touch.floating(target)),
      toggle(item) { if (box) return close(); if (!item) return; box = doc.createElement('div'); box.className = 'lk-peek'; box.hidden = true; doc.body.appendChild(box); place(); show(item); if (!coming) close(); },
      follow(item) { if (!box) return; win.clearTimeout(wait); wait = win.setTimeout(() => show(item), 120); },
    };
  })();
  const done = (refocus = true) => {
    if (parent) { shut(); parent.child = null; if (refocus) from.focus?.({ preventScroll: true }); return; }
    if (close !== done) return; close = null; shut(); if (refocus && !opts.quiet) from.focus?.({ preventScroll: true });
  };
  const all = () => { let top = self; while (top.parent) top = top.parent; top.done(false); };   // a choice taken closes every menu open
  const self = { menu, parent, shut, done, get child() { return child; }, set child(c) { child = c; } };
  const openSub = (row, focus) => {
    const item = items[Number(row.dataset.i)]; if (!item?.sub) return;
    if (child && child.from === row) { if (focus) child.first(); return; }
    child?.shut(); child = null;
    const subItems = typeof item.sub === 'function' ? item.sub() : item.sub;
    child = make(row, subItems, { focusFirst: focus }, self); child.from = row;
  };
  const take = row => { const item = items[Number(row.dataset.i)]; if (item?.sub) return openSub(row, true); all(); item?.take?.(); };
  const onKey = event => {
    const all = rows(), now = all.indexOf(doc.activeElement);
    if (foldKey(event, all[now], true)) { /* folded */ }
    else if (event.key === 'Escape' || (parent && event.key === 'ArrowLeft')) done();
    else if (event.key === 'ArrowDown') all[(now + 1) % all.length]?.focus();
    else if (event.key === 'ArrowUp') all[(now - 1 + all.length) % all.length]?.focus();
    else if (event.key === 'ArrowRight' && all[now]?.classList.contains('lk-has-sub')) openSub(all[now], true);
    else if (event.key === 'Enter' && now >= 0) take(all[now]);   // taken here: Logseq's own keys would keep Enter from a press on the line
    else if (event.key === 'Tab') done();
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  const inside = target => { for (let at = self; at; at = at.child) if (at.menu.contains(target)) return true; return peeks.has(target); };
  const outside = event => { if (parent) return; if (!inside(event.target)) done(false); };   // the first menu watches for a press outside every one open
  const hover = event => { const row = event.target.closest('.lk-item'); if (!row || !menu.contains(row)) return; if (row.classList.contains('lk-has-sub')) openSub(row, false); else if (child) { child.shut(); child = null; } };
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); return () => target.removeEventListener(type, fn, opts); };
  let lit = -1;
  const light = to => { const all = rows(); if (!all.length) return; lit = (to + all.length) % all.length; all.forEach((row, i) => row.classList.toggle('lit', i === lit)); all[lit].scrollIntoView({ block: 'nearest' }); lightUnder(all[lit]); };
  const onQuietKey = event => {
    if (event.key === 'ArrowDown') light(lit + 1);
    else if (event.key === 'ArrowUp') light(lit < 0 ? -1 : lit - 1);
    else if ((event.key === 'Enter' || event.key === 'Tab') && lit >= 0) take(rows()[lit]);
    else if (event.key === 'Escape') done(false);
    else { if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(event.key)) done(false); return; }   // writing on: let go, and the key goes on into the bullet
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  };
  const offs = [opts.quiet ? on(doc, 'keydown', onQuietKey, true) : on(menu, 'keydown', onKey), on(menu, 'click', event => { const row = event.target.closest('.lk-item'); if (!row) return; const link = event.target.closest('a[data-to]'); if (link) { event.preventDefault(); all(); G.touch.open(link.dataset.to, event.shiftKey); return; } if (event.target.closest('.lk-item-fold') && fold(row)) return; take(row); }), on(menu, 'pointerover', hover),
    ...(opts.quiet ? [on(menu, 'mousedown', event => event.preventDefault())] : []),
    ...(parent ? [] : [on(doc, 'pointerdown', outside, true), on(doc, 'wheel', event => { if (!inside(event.target)) done(false); }, { capture: true, passive: true }), on(win, 'blur', () => done(false)), on(win, 'resize', () => done(false))])];
  if (!parent) close = done;
  if (tree) {
    // A pointer at rest takes nothing from the arrows: only a move to another spot counts.
    let spot = '';
    const pointed = event => { const here = `${event.clientX},${event.clientY}`; if (here === spot) return null; spot = here; const row = event.target.closest('.lk-item'); return row && menu.contains(row) ? row : null; };
    if (opts.quiet) offs.push(on(menu, 'pointermove', event => { const row = pointed(event); if (row) lightUnder(row); }), on(menu, 'pointerleave', () => lightUnder(rows()[lit])));
    else if (opts.find) offs.push(on(menu, 'pointermove', event => {
      const row = pointed(event); if (!row || row.classList.contains('lit')) return;
      for (const one of menu.querySelectorAll('.lk-item.lit')) one.classList.remove('lit');
      row.classList.add('lit'); lit = rows().filter(one => !one.classList.contains('lk-path')).indexOf(row); lightUnder(row);
    }));
    else offs.push(on(menu, 'pointermove', event => pointed(event)?.focus({ preventScroll: true })), on(menu, 'focusin', event => lightUnder(event.target.closest('.lk-item'))));
  }
  self.first = () => (rows().find(row => row.classList.contains('on')) || rows()[0])?.focus({ preventScroll: true });
  if (opts.find) {
    /* A list with a line to type in: the words narrow it, an arrow lights a line, Enter takes the lit one (the first, when none
       is lit). opts.make(words) answers a line for words no line has ("+ New option: …", Logseq's own words); opts.enter(words)
       takes the words themselves where the list has nothing to light. */
    const field = menu.firstElementChild, extra = doc.createElement('button');
    extra.type = 'button'; extra.className = 'lk-item lk-item-make'; extra.hidden = true; menu.appendChild(extra);
    let hint = null;
    if (opts.alt) {
      hint = doc.createElement('button'); hint.type = 'button'; hint.className = 'lk-item lk-item-make lk-item-alt'; hint.hidden = true; menu.classList.add('lk-menu-alt'); menu.appendChild(hint);
      hint.innerHTML = `<span class="lk-item-icon">${G.touch.icon(opts.alt.icon, 15)}</span><span class="lk-item-word">${G.esc(opts.alt.word)}</span><span class="lk-item-value">${G.esc(opts.alt.key)}</span>`;
    }
    const other = () => { const words = field.value.trim(); done(); if (words) opts.alt.take(words); };
    let made = null;
    const first = opts.rank ? [...menu.querySelectorAll('.lk-item:not(.lk-item-make)')] : [], rest = opts.rank ? [...menu.querySelectorAll('.lk-group, .lk-gap')] : [];
    if (opts.rank) { rest.at = new Map(rest.map(el => { let next = el.nextElementSibling; while (next && !next.classList.contains('lk-item')) next = next.nextElementSibling; return [el, first.indexOf(next)]; })); }
    const seen = () => [...menu.querySelectorAll('.lk-item')].filter(row => !row.hidden && !row.classList.contains('lk-path'));   // the lines an arrow lights
    // One lit line: the light is taken off every line, also off one the words have since narrowed away.
    const lightIn = to => { const all = seen(); for (const row of menu.querySelectorAll('.lk-item.lit')) row.classList.remove('lit'); if (!all.length) { lit = -1; lightUnder(menu.querySelector('.lk-item-make:not([hidden])')); peeks.follow(null); return; } lit = (to + all.length) % all.length; all[lit].classList.add('lit'); all[lit].scrollIntoView({ block: 'nearest' }); lightUnder(all[lit]); peeks.follow(items[Number(all[lit].dataset.i)]); };
    // Whether the person has moved the light since the last letter, and whether Enter came before the notes had answered.
    let walked = false, looking = false, entered = false;
    const narrow = () => {
      const want = field.value.trim().toLowerCase().split(/\s+/).filter(Boolean); let exact = false;
      for (const el of menu.querySelectorAll('.lk-group, .lk-gap')) el.hidden = want.length > 0;
      menu.classList.toggle('lk-narrowed', want.length > 0);   // a narrowed outline stands open: no fold arrows
      if (!want.length) { foldUp(); for (const row of outline) { row.classList.remove('lk-path'); G.node.hit(row.querySelector('.lk-item-word'), []); } }
      if (want.length) for (const row of menu.querySelectorAll('.lk-item:not(.lk-item-make)')) { const text = `${row.textContent} ${row.dataset.also || ''}`.toLowerCase(); row.hidden = !want.every(word => text.includes(word)); if (row.textContent.toLowerCase().trim() === field.value.trim().toLowerCase()) exact = true; }
      if (want.length && tree) {   // each tag found under the tags it sits under, and the letters that found it
        const state = G.tags.found(outline.map(row => ({ depth: items[Number(row.dataset.i)].depth, name: row })), row => !row.hidden);
        outline.forEach((row, i) => { row.hidden = !state[i]; row.classList.toggle('lk-path', state[i] === 'path'); G.node.hit(row.querySelector('.lk-item-word'), state[i] === 'hit' ? want : []); });
      }
      if (opts.rank) {   // the closest first: the words as typed at a word's start, then anywhere, then apart; the shorter before the longer
        const phrase = want.join(' '), score = row => { const text = row.querySelector('span:not(.lk-item-icon)').textContent.toLowerCase(); return (text.startsWith(phrase) || text.includes(' ' + phrase) ? 0 : text.includes(phrase) ? 1 : 2) * 1000 + text.length; };
        const order = want.length ? [...first].sort((a, b) => (a.hidden - b.hidden) || score(a) - score(b)) : first;
        for (const row of order) menu.insertBefore(row, extra);
        if (!want.length) for (const el of rest) menu.insertBefore(el, first[rest.at.get(el)] || extra);
      }
      made = opts.make && field.value.trim() && !exact ? opts.make(field.value.trim()) : null;
      extra.hidden = !made; if (made) extra.innerHTML = `<span class="lk-item-icon">${G.touch.icon('plus', 14)}</span><span>${G.esc(made.word)}</span>`;
      if (hint) hint.hidden = !field.value.trim();
      walked = entered = false;
      if (opts.search) find(field.value.trim());   // first: it takes away the lines found for the letters before
      lightIn(0);
    };
    // What the words find elsewhere comes under the lines, a moment later; an answer overtaken by a later letter is dropped.
    let asked = 0, wait = 0;
    const find = words => {
      for (const el of menu.querySelectorAll('.lk-found-line, .lk-item-found')) el.remove();
      win.clearTimeout(wait); const mine = ++asked;
      looking = !!words;
      if (!words) return;
      wait = win.setTimeout(async () => {
        let found = [];
        try { found = await opts.search(words); } catch (error) { console.error('Logseq Plugin: the search did not answer', error); }
        if (mine !== asked || !menu.isConnected) return;
        looking = false;
        if (!found.length) { if (entered) press(); return; }
        for (const el of menu.querySelectorAll('.lk-found-line, .lk-item-found')) el.remove();
        const same = opts.searchName === '';   // more of the same list: lines like the others, under no name
        if (!same) { const head = doc.createElement('div'); head.className = 'lk-group lk-found-line'; head.textContent = 'In your notes'; menu.insertBefore(head, extra); }
        for (const item of found) {
          const row = doc.createElement('button'); row.type = 'button'; row.className = same ? 'lk-item lk-item-found' : 'lk-item lk-found-line'; row.setAttribute('role', 'menuitem'); row.dataset.i = items.length; items.push(item);
          if (same) { row.innerHTML = `<span class="lk-item-icon">${item.icon || ''}</span><span class="lk-item-word">${G.esc(item.word)}</span>${item.value ? `<span class="lk-item-value">${G.esc(item.value)}</span>` : ''}`; menu.insertBefore(row, extra); continue; }
          const { tag, page } = item.under || {};
          row.innerHTML = `<span class="lk-item-icon">${item.icon || ''}</span><span class="lk-found-text"><span class="lk-found-first"><span class="lk-found-words">${G.esc(item.word)}</span>${tag ? `<a class="lk-tag" data-to="${G.esc(tag.to)}">${G.esc(tag.name)}</a>` : ''}</span>${page ? `<span class="lk-sits"><a class="lk-step" data-to="${G.esc(page.to)}">${G.esc(page.name)}</a></span>` : ''}</span>`;
          menu.insertBefore(row, extra);
        }
        if (!walked) lightIn(0);   // the first line, which is the first note found where no command has the words
        if (entered) press();
      }, 140);
    };
    const press = () => { entered = false; const row = menu.querySelector('.lk-item.lit:not([hidden])') || seen()[lit]; const words = field.value.trim(); if (row === extra && made) { done(); made.take(); } else if (row && row === hint) other(); else if (row) take(row); else if (opts.enter && words) { done(); opts.enter(words); } };
    offs.push(() => win.clearTimeout(wait));
    if (opts.peek) {
      menu.classList.add('lk-peeks');   // one highlight: the pointer moves the light, so a line merely under it is not lit too
      // A tap: Shift down and up again with nothing between, so typing a capital never opens it.
      let tap = 0, spot = '';
      const lookAt = () => { const row = menu.querySelector('.lk-item.lit:not([hidden])'); return row && items[Number(row.dataset.i)]; };
      offs.push(on(doc, 'keydown', event => { tap = event.key === 'Shift' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && menu.contains(event.target) ? win.performance.now() : 0; }, true),
        on(doc, 'keyup', event => { if (event.key !== 'Shift' || !tap) return; const quick = win.performance.now() - tap < 600; tap = 0; if (quick && menu.contains(event.target)) peeks.toggle(lookAt()); }, true),
        on(doc, 'pointerdown', () => { tap = 0; }, true),
        on(menu, 'pointermove', event => {
          const here = `${event.clientX},${event.clientY}`, row = event.target.closest('.lk-item'); if (here === spot) return; const first = !spot; spot = here;
          if (!first && row && !peeks.open && !row.classList.contains('lit')) { walked = true; lightIn(seen().indexOf(row)); }
        }));
    }
    offs.push(on(field, 'input', narrow), on(field, 'keydown', event => {
      if (foldKey(event, seen()[lit], !field.value)) { /* folded */ }
      else if (event.key === 'ArrowDown') { walked = true; lightIn(lit + 1); }
      else if (event.key === 'ArrowUp') { walked = true; lightIn(lit - 1); }
      else if (event.key === 'Enter' && event.altKey && opts.alt) other();   // the list closes; with no words typed nothing is done, the lit line least of all
      else if (event.key === 'Enter') { if (looking && !walked && seen()[lit] === extra) entered = true; else press(); }
      else if (event.key === 'Escape' && peeks.open) peeks.close();
      else if (event.key === 'Escape') done();
      // A letter stays in this line: with a bullet being written, Logseq would otherwise take "[" and the like into the bullet.
      else { if (!event.metaKey && !event.ctrlKey && event.key !== 'Tab') event.stopPropagation(); return; }
      event.preventDefault(); event.stopPropagation();
    }), on(extra, 'click', event => { event.stopPropagation(); if (made) { done(); made.take(); } }));
    if (hint) offs.push(on(hint, 'click', event => { event.stopPropagation(); other(); }));
    field.focus({ preventScroll: true }); lightIn(Math.max(0, seen().findIndex(row => row.classList.contains('on'))));
    return parent ? self : done;
  }
  if (parent) { if (opts.focusFirst) self.first(); return self; }
  if (!opts.quiet) self.first();
  else if (opts.lit != null) light(opts.lit);
  return done;
}
G.menu.CSS = `
.lk-menu { position: fixed; z-index: 9999; min-width: 11rem; max-width: min(22rem, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 4px; border-radius: var(--lk-corner-float);
  background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); color: var(--lk-text); }
.lk-menu .lk-item { display: flex; align-items: center; gap: 8px; width: 100%; min-height: var(--lk-line-h); padding: 4px 8px; border: 0; border-radius: var(--lk-corner); background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); text-align: left; cursor: default; }
.lk-menu .lk-item:hover, .lk-menu .lk-item:focus, .lk-menu .lk-item.lit { background: var(--lk-lit); outline: none; }
.lk-menu .lk-item.lk-goes { color: var(--lk-going); }   /* what takes something away, as a change that takes away is shown */
.lk-menu .lk-item[data-face="tag"] { font-family: var(--lk-tag-face); font-size: var(--lk-tag-size); }
.lk-menu .lk-item[data-face="prop"] { font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; }
.lk-menu .lk-item-icon { display: inline-flex; width: 18px; justify-content: center; color: var(--lk-quiet); flex: none; }
.lk-menu .lk-item-icon:empty { display: none; }
.lk-menu .lk-item-on { margin-left: auto; display: inline-flex; color: var(--lk-quiet); }
.lk-menu .lk-item-sub { margin-left: auto; display: inline-flex; color: var(--lk-quiet); }
.lk-menu .lk-item-on + .lk-item-sub { margin-left: 4px; }
.lk-menu.lk-peeks .lk-item:hover:not(.lit) { background: none; }
.lk-menu .lk-found-line.lk-item { align-items: flex-start; }
.lk-menu .lk-found-line .lk-item-icon { height: var(--lk-line-lead); align-items: center; }
.lk-menu .lk-found-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.lk-menu .lk-found-first { display: flex; align-items: baseline; gap: 12px; }
.lk-menu .lk-found-first > .lk-tag { flex: none; margin-left: auto; cursor: pointer; }
.lk-menu .lk-found-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-menu .lk-sits { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-menu .lk-sits a.lk-step { color: var(--lk-quiet); cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-hair); text-underline-offset: 3px; }
.lk-menu .lk-sits a.lk-step:hover { color: var(--lk-text); text-decoration-color: var(--lk-line); }
.lk-menu .lk-found-first > a.lk-tag:hover { color: var(--lk-text); }
/* The look beside the menu: the menu's glass and corner, under Logseq's own lists so a value pressed in it opens over it. */
.lk-peek { position: fixed; z-index: 40; box-sizing: border-box; overflow: auto; padding: 8px 12px 12px 22px; border-radius: var(--lk-corner-float); background: var(--lk-paper); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); color: var(--lk-text); }
.lk-peek[hidden] { display: none; }
.lk-peek > .lk-peeked { position: absolute; left: 22px; right: 12px; visibility: hidden; }
.lk-peek > .lk-peeked.whole { position: static; visibility: visible; }
.lk-menu .lk-group { padding: 4px 8px 2px; font-size: var(--lk-label); color: var(--lk-quiet); }
.lk-menu .lk-gap { height: 1px; margin: 4px 8px; background: var(--lk-hair); }
.lk-menu [hidden] { display: none !important; }
.lk-menu .lk-item-alt { position: sticky; bottom: -4px; margin-top: 9px; background: var(--lk-paper); }
.lk-menu .lk-item-alt::before { content: ""; position: absolute; left: 0; right: 0; bottom: 100%; height: 9px; background: linear-gradient(var(--lk-hair), var(--lk-hair)) center / calc(100% - 16px) 1px no-repeat, var(--lk-paper); pointer-events: none; }   /* set apart by the menu's own hairline, which stays with it over a long list */
.lk-menu .lk-item-alt .lk-item-icon { color: var(--lk-text); }
.lk-menu .lk-item-alt:is(:hover, :focus, .lit) { background: linear-gradient(var(--lk-lit), var(--lk-lit)), var(--lk-paper); }
.lk-menu.lk-peeks .lk-item-alt:hover:not(.lit) { background: var(--lk-paper); }
.lk-menu-alt .lk-item { scroll-margin-bottom: var(--lk-line-h); }
.lk-menu .lk-item-alt .lk-item-value { margin-left: auto; }
.lk-menu-find { display: block; width: 100%; box-sizing: border-box; margin: 0 0 4px; padding: 4px 8px; border: 0; border-bottom: 1px solid var(--lk-hair); outline: 0; background: none; color: inherit; font: inherit; font-size: var(--lk-line-size); box-shadow: none; border-radius: 0; }
.lk-menu-find { position: sticky; top: -4px; z-index: 1; background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); }
.lk-menu-tree .lk-item { position: relative; gap: 0; }
.lk-menu .lk-item-fold { flex: none; width: 16px; display: inline-flex; align-items: center; justify-content: center; align-self: stretch; color: var(--lk-off); opacity: 0; visibility: hidden; position: relative; z-index: 1; }
.lk-menu .lk-item-fold svg { transform: rotate(90deg); transition: transform .12s ease; }
.lk-menu .lk-item.lk-kids > .lk-item-fold { visibility: visible; cursor: pointer; }
.lk-menu .lk-item.lk-kids:is(:hover, :focus-visible, .lit, .lk-shut) > .lk-item-fold { opacity: 1; }
.lk-menu .lk-item.lk-shut > .lk-item-fold svg { transform: none; }
.lk-menu .lk-item.lk-shut > .lk-item-bul::before { box-shadow: 0 0 0 4.8px var(--lk-bullet-ring); }   /* folded: the ring Logseq puts round a folded bullet */
.lk-menu-tree.lk-narrowed .lk-item-fold { visibility: hidden !important; }
.lk-menu-tree.lk-narrowed .lk-item.lk-shut > .lk-item-bul::before { box-shadow: none; }
.lk-menu .lk-item-bul { flex: none; width: 16px; margin-right: 4px; display: inline-flex; align-items: center; justify-content: center; align-self: stretch; }
.lk-menu .lk-item-bul::before { content: ""; width: 6.4px; height: 6.4px; border-radius: 50%; background: var(--lk-bullet); opacity: .8; }
/* One hairline down from each tag through the tags under it, through the middle of its bullet, as Logseq's outline draws it
   (the owner, 26 November 2026: "menus that have you select tags should probably have bullet outline too"). */
.lk-menu-tree .lk-item::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--lk-d, 0) * 29px); pointer-events: none; background: repeating-linear-gradient(90deg, transparent 0 27.5px, var(--lk-line) 27.5px 28.5px, transparent 28.5px 29px); }   /* Logseq's step between levels, so a fold arrow stands clear of the line */
.lk-menu-tree .lk-item:is(:hover, :focus, .lit) { background: none; }   /* the outline's one highlight is drawn under the line instead */
.lk-menu .lk-glow { position: absolute; right: 4px; border-radius: var(--lk-corner); background: var(--lk-lit); pointer-events: none; opacity: 0; transition: left .14s ease-out, top .14s ease-out, height .14s ease-out, opacity .1s ease-out; }
.lk-menu .lk-glow.on { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .lk-menu .lk-glow { transition: none; } }
.lk-menu .lk-item.lk-path { color: var(--lk-quiet); }   /* a tag shown only so that what is under it is seen in its place */
.lk-menu mark.lk-hit { background: none; color: inherit; font-weight: 600; padding: 0; margin: 0; border-radius: 0; }   /* the typed letters, as Search marks them */
.lk-menu-find::placeholder { color: var(--lk-off); }`;
})();
