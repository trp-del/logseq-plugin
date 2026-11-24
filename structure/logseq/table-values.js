/* "Move values…" for the rows ticked in one of Logseq's tables (24 November 2026, the owner: "What I want is to simply be able to
   select nodes and then have the values from one property placed in a pre-existing or new property and perhaps delete the values in
   original property"; then yes to the drawing). Logseq's own bar for ticked rows (Selected: 3, Copy, Set property, Unset property)
   gets one more word. Pressed, a box opens under the bar: From (a property the picked nodes hold), Into (a property there is, or
   a new name), a tick to take the values out of the first, and the picked nodes as they will read, each property with its icon
   and its lighter name, a node's value underlined, what comes in green and what goes struck through. The yes copies or moves the
   values through Ontology's one writer, so one Undo takes the whole change back.
   Which rows are ticked is read from Logseq's own tick boxes. Logseq draws only the rows on screen, so each row's tick is kept as
   it was last seen; when the count kept differs from the bar's own "Selected: N" (every row ticked at once in a long table), the
   table is walked once from top to bottom to read the rest, and put back where it stood. A count that still differs changes
   nothing and says so. */
(function () {
const S = window.Structure;
const Door = window.PluginDoor;
const esc = Door.esc;
const WORD = 'Move values…';
const BAR = '.ls-table-actions', ROW = '.ls-table-row', TICK = 'label[data-table-row-select]';
const ticked = label => !!label.querySelector('[aria-checked="true"], [data-state="checked"], [data-checked]') || !!label.querySelector('input:checked');
const idOf = label => { const n = parseInt(label.getAttribute('for') || '', 10); return Number.isFinite(n) ? n : null; };

function start(app, doc) {
  const win = doc.defaultView, M = () => app.tray.model;
  const known = new WeakMap();   // a table → Map(node id → ticked), kept while its rows scroll out of what Logseq draws
  let box = null;                // the open box: { bar, table, pop, nodes, from, into, name, remove, pv, seq }
  // The table a bar belongs to: the nearest element around it that holds rows.
  const tableOf = bar => { let el = bar.parentElement; while (el && el !== doc.body && !el.querySelector(ROW)) el = el.parentElement; return el && el !== doc.body ? el : null; };
  const said = bar => { const n = parseInt((bar.querySelector('.selection-count')?.textContent || '').replace(/\D+/g, ''), 10); return Number.isFinite(n) ? n : null; };
  function read(table) {
    const map = known.get(table) || known.set(table, new Map()).get(table);
    for (const label of table.querySelectorAll(`${ROW} ${TICK}`)) { const id = idOf(label); if (id != null) map.set(id, ticked(label)); }
    return map;
  }
  const picked = table => [...read(table)].filter(([, on]) => on).map(([id]) => id);
  // Every row read once: the table walked down in steps of its own height, then put back where it stood.
  async function walk(table) {
    let scroller = table; while (scroller && scroller !== doc.body && !(/(auto|scroll)/.test(win.getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 4)) scroller = scroller.parentElement;
    if (!scroller || scroller === doc.body) return;
    const was = scroller.scrollTop, step = Math.max(120, Math.round(scroller.clientHeight * 0.7)), frame = () => new Promise(r => win.requestAnimationFrame(() => win.setTimeout(r, 30)));
    const top = () => table.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    for (let y = Math.max(0, top() - 40), end = top() + table.scrollHeight; y <= end; y += step) { scroller.scrollTop = y; await frame(); read(table); if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) break; }
    scroller.scrollTop = was; await frame();
  }

  /* Logseq's bar is one line as wide as its words, and in a narrow page (700 px with the left sidebar open) its last words stand past
     the right edge, out of reach without scrolling the table sideways: "Unset property", the bin, and the word added here. So the
     bar is kept to the width in view and wraps onto a second line. The rows make room for that line, so the bar never lies over a
     row; and the page is scrolled by the same height in the same turn, so the rows stay where they stood on the screen, under the
     hand that is ticking them (found by hand, 24 November 2026: the second tick landed on the wrong row), and what is above the
     rows moves up instead. All of it goes back when the bar goes. */
  const scrollerOf = el => { let s = el; while (s && s !== doc.body && !(/(auto|scroll)/.test(win.getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 4)) s = s.parentElement; return s && s !== doc.body ? s : null; };
  const rootOf = el => { let e = el; while (e && e !== doc.body && !e.querySelector(':scope > .lk-tstate')) e = e.parentElement; return e && e !== doc.body ? e : null; };
  function lineRoom(root, want) {
    if (root.style.getPropertyValue('--lk-bar-room') === want) return;
    const line = root.querySelector(':scope > .lk-tstate'), scroller = scrollerOf(root), grew = Number(root.dataset.stBarGrew || 0);
    if (!want) {   // back to one line, or the bar gone (the line has then shrunk already): the page goes back by what it was scrolled
      root.style.removeProperty('--lk-bar-room'); delete root.dataset.stBarGrew;
      if (scroller && grew) scroller.scrollTop -= grew;
      return;
    }
    const before = line ? line.getBoundingClientRect().height : 0;
    root.style.setProperty('--lk-bar-room', want);
    const delta = line ? line.getBoundingClientRect().height - before : 0;
    if (delta) { root.dataset.stBarGrew = String(grew + delta); if (scroller) scroller.scrollTop += delta; }
  }
  function fit(bar) {
    const holder = bar.closest('.table-action-bar') || bar, header = bar.closest('.ls-table-header'), scroller = bar.closest('.ls-table-rows'), main = doc.querySelector('#main-content-container');
    if (!header || !scroller) return;
    const edge = Math.min(scroller.getBoundingClientRect().right, main ? main.getBoundingClientRect().right : Infinity, win.innerWidth), room = Math.floor(edge - holder.getBoundingClientRect().left - 12);
    if (room < 160) return;
    if (holder.style.maxWidth !== `${room}px`) holder.style.maxWidth = `${room}px`;
    bar.classList.add('st-bar-fit');
    // Since 24 November 2026 Look sets the bar in the line above the names (the flat capsule), so it lies over no name and pushes
    // no row. Only where its words take two lines does that line grow, by --lk-bar-room, and the page is scrolled by the same
    // height in the same turn, so the rows stay under the hand.
    const root = rootOf(bar), lifted = !!root && !header.classList.contains('ls-fixed') && parseFloat(win.getComputedStyle(holder).top) < 0;
    if (root && (lifted || root.style.getPropertyValue('--lk-bar-room'))) {
      const h = Math.round(bar.getBoundingClientRect().height);
      lineRoom(root, lifted && h > 30 ? `${h + 3}px` : '');
      if (lifted) return;
    }
    const extra = Math.max(0, Math.round(bar.getBoundingClientRect().height - header.getBoundingClientRect().height + 2)), rows = header.nextElementSibling, foot = header.parentElement?.querySelector(':scope > .ls-table-footer');
    const want = extra ? `${extra}px` : '', had = parseInt(rows?.style.marginTop || '0', 10) || 0;
    for (const el of [rows, foot]) if (el && el.style.marginTop !== want) { el.style.marginTop = want; if (want) el.dataset.stBarPushed = ''; else delete el.dataset.stBarPushed; }
    if (header.parentElement && header.parentElement.style.marginBottom !== want) { header.parentElement.style.marginBottom = want; if (want) header.parentElement.dataset.stBarPushed = ''; else delete header.parentElement.dataset.stBarPushed; }
    if (extra !== had) { const scroller = scrollerOf(header.parentElement); if (scroller) scroller.scrollTop += extra - had; }   // in the same turn, before the screen is drawn
  }
  const unfit = table => { const root = rootOf(table); if (root) lineRoom(root, ''); let had = 0; for (const el of [table, ...table.querySelectorAll('[data-st-bar-pushed]')]) if (el.dataset && 'stBarPushed' in el.dataset) { had = Math.max(had, parseInt(el.style.marginTop || '0', 10) || 0); el.style.marginTop = ''; el.style.marginBottom = ''; delete el.dataset.stBarPushed; } if (had) { const scroller = scrollerOf(table); if (scroller) scroller.scrollTop -= had; } };

  // ---------- the word in Logseq's bar ----------
  /* While a list of Logseq's is open from one of the bar's words (Set property, Unset property, #), Logseq takes every word out of
     the bar and leaves its count, so nothing on the screen says what was pressed (the owner's "good" to "Emptiness, Applied", 24
     November 2026: "The bar stays whole and Set property is lit, so the screen still says where you are"). The words as they
     last stood are kept, and drawn in the shrunk bar as a stand-in that takes no press and no key, the pressed word marked; it
     goes when Logseq's own words come back (the stylesheet hides it in that same frame) or when no list is open. */
  const words = new WeakMap();   // a table → { cls, html } of its bar's words as last seen whole
  let pressed = '';              // the word last pressed in a bar: its letters, or the name of its icon
  const nameOf = b => b.textContent.trim() || [...(b.querySelector('.ui__icon')?.classList || [])].find(c => c.startsWith('ls-icon-')) || '';
  const realGroup = bar => [...bar.children].find(c => !c.classList.contains('st-bar-ghost') && c.querySelector('button'));
  function keep(bar, table) { const g = realGroup(bar); if (g && table) words.set(table, { cls: g.className, html: g.innerHTML }); }
  function ghost(bar, table) {
    const had = bar.querySelector(':scope > .st-bar-ghost');
    if (realGroup(bar)) { had?.remove(); return false; }
    const kept = table && words.get(table), listOpen = !!doc.querySelector('.ui__popover-content, .ui__dropdown-menu-content');
    if (!kept || !listOpen) { had?.remove(); return !!kept; }
    if (!had) {
      const g = doc.createElement('div'); g.className = `${kept.cls} st-bar-ghost`; g.innerHTML = kept.html; g.inert = true; g.setAttribute('aria-hidden', 'true');
      for (const el of g.querySelectorAll('[id]')) el.removeAttribute('id');
      for (const b of g.querySelectorAll('button')) { b.tabIndex = -1; b.removeAttribute('data-st-values'); if (pressed && nameOf(b) === pressed) b.dataset.lkOn = ''; }
      bar.append(g);
    }
    fit(bar);
    return true;
  }
  function dress() {
    for (const bar of doc.querySelectorAll(BAR)) {
      const table = tableOf(bar); if (table) { table.dataset.stValuesTable = ''; read(table); }
      if (ghost(bar, table)) continue;
      if (bar.querySelector('[data-st-values]')) { keep(bar, table); fit(bar); continue; }
      const group = bar.querySelector('.selection-action-group') || bar, like = [...group.querySelectorAll('button')].filter(b => b.textContent.trim().length > 1).pop();
      if (!like) continue;
      // Logseq's own button, copied bare: its look is Logseq's, so the word reads as one of the bar's.
      const word = like.cloneNode(false); word.removeAttribute('id'); word.dataset.stValues = ''; word.textContent = WORD;
      word.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(bar); });
      like.after(word);
      keep(bar, table); fit(bar);
    }
    // A table with no bar has no row ticked: what was kept of it is let go. The box goes with its bar.
    for (const table of doc.querySelectorAll('[data-st-values-table]')) if (!table.querySelector(BAR)) { known.delete(table); delete table.dataset.stValuesTable; unfit(table); }
    if (box && !box.bar.isConnected) close();
  }
  const press = event => { const word = event.target.closest?.(`${BAR} button`); if (word && !word.closest('.st-bar-ghost, .st-bar-ask')) { pressed = nameOf(word); pressedBar = word.closest(BAR); } };   // Logseq takes the words out at the press, before any click
  /* The bin (the owner's "good" to "Emptiness, Applied", 24 November 2026: "The bar itself turns into the question, in the same
     place, so nothing lies over the table. The three rows are struck red where they stand… The yes names its result, and the
     keyboard waits on Leave it"). Logseq's own window for the question still opens and still does the deleting: it is kept
     unseen from its first frame, the keyboard put on its Cancel, and the bar shows the question with two presses that press
     Logseq's Cancel and Yes. Whatever goes wrong here, the window is shown again as Logseq draws it. */
  let ask = null, pressedBar = null;   // the question in a bar: { dlg, bar, table, el, no, yes, off }
  function endAsk() {
    const a = ask; if (!a) return; ask = null;
    a.off(); a.el.remove(); a.bar.classList.remove('st-bar-asking'); if (a.table) delete a.table.dataset.stGoing;
    doc.documentElement.classList.remove('st-bin-ask');
    for (const bar of doc.querySelectorAll(BAR)) fit(bar);
  }
  function binAsk() {
    if (ask) { if (!ask.dlg.isConnected || !ask.bar.isConnected) endAsk(); return; }
    if (pressed !== 'ls-icon-trash' || !pressedBar?.isConnected) return;
    const dlg = doc.querySelector('.ui__dialog-content'); if (!dlg) return;
    const head = dlg.querySelector('#modal-headline')?.textContent || '', what = /delete (?:these|this|the) ([a-z]+)/i.exec(head);
    const buttons = [...dlg.querySelectorAll('.ui__dialog-main-content button')], no = buttons.find(b => /^cancel$/i.test(b.textContent.trim())), yes = buttons.find(b => /^yes$/i.test(b.textContent.trim()));
    pressed = '';
    if (!what || !no || !yes) return;   // not the question known here: Logseq's window stands as it is
    const bar = pressedBar, table = tableOf(bar), n = dlg.querySelectorAll('ol > li').length || said(bar) || 0, noun = n === 1 ? what[1].replace(/s$/, '') : what[1];
    const el = doc.createElement('div'); el.className = 'st-bar-ask';
    el.innerHTML = `<b>Delete ${n} ${esc(noun)}?</b>${/permanently/i.test(head) ? '<span class="lk-note">Properties and tags go for good.</span>' : ''}<span class="lk-answers"><button type="button" class="lk-btn lk-low lk-enter" data-ask="no">Leave it</button><button type="button" class="lk-big" data-ask="yes">Delete ${n} ${esc(noun)}</button></span>`;
    const light = () => { const on = doc.activeElement === yes ? 'yes' : 'no'; for (const b of el.querySelectorAll('[data-ask]')) b.classList.toggle('lk-enter', b.dataset.ask === on); };
    const focus = () => { if (!ask) return; if (doc.activeElement !== yes && doc.activeElement !== no) no.focus({ preventScroll: true }); light(); };
    // A press on the bar's question is a press outside Logseq's window, which would let the window go (and with it the ticks) before
    // the answer is given. So the press is kept from Logseq, from the window's own edge inwards, and the click gives the answer.
    const click = event => {
      if (!ask || !el.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const b = event.type === 'click' && event.target.closest('[data-ask]'); if (b) (b.dataset.ask === 'yes' ? yes : no).click();
    };
    const PRESSES = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    // The keys while the question stands: Enter and Space answer with the press the keyboard is on (Leave it, unless Tab moved it),
    // Tab moves between the two, Escape leaves. Taken here, before Logseq's own keys, so Enter can never mean anything else.
    const key = event => {
      if (!ask || event.isComposing) return;
      const k = event.key; if (k !== 'Enter' && k !== ' ' && k !== 'Tab' && k !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (k === 'Tab') { (doc.activeElement === yes ? no : yes).focus({ preventScroll: true }); light(); }
      else if (k === 'Escape') no.click();
      else (doc.activeElement === yes ? yes : no).click();
    };
    dlg.addEventListener('focusin', focus); for (const t of PRESSES) win.addEventListener(t, click, true);
    win.addEventListener('keydown', key, true);
    ask = { dlg, bar, table, el, no, yes, off: () => { dlg.removeEventListener('focusin', focus); win.removeEventListener('keydown', key, true); for (const t of PRESSES) win.removeEventListener(t, click, true); } };
    doc.documentElement.classList.add('st-bin-ask'); bar.classList.add('st-bar-asking'); if (table) table.dataset.stGoing = '';
    bar.append(el); no.focus({ preventScroll: true }); light(); fit(bar);
  }
  function seen(event) {   // a tick pressed: the rows are read again once Logseq has drawn them
    if (!event.target.closest?.(`${TICK}, [role="checkbox"]`)) return;
    win.requestAnimationFrame(() => { for (const bar of doc.querySelectorAll(BAR)) { const t = tableOf(bar); if (t) read(t); } });
  }

  // ---------- the box ----------
  const P = id => M().props.get(id);
  const icon = p => S.view.pi(p);
  const held = (p, nodes) => { const h = M().holders.get(p.ident); let n = 0; if (h) for (const id of nodes) if (h.has(id)) n++; return n; };
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  async function open(bar) {
    if (box?.bar === bar) return close();
    close();
    const table = tableOf(bar); if (!table) return;
    let nodes = picked(table); const want = said(bar);
    if (want != null && nodes.length !== want) { await walk(table); nodes = picked(table); }
    if (want != null && nodes.length !== want) return Door.notify(`Move values could not tell which ${want} rows are ticked (it read ${nodes.length}). Nothing was changed.`, 'warning');
    if (!nodes.length) return;
    const from = [...M().props.values()].filter(p => !p.made && held(p, nodes)).sort((a, b) => held(b, nodes) - held(a, nodes) || byTitle(a, b))[0] || null;
    const pop = doc.createElement('div'); pop.className = 'lk-pop st-values'; pop.tabIndex = -1; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Move values');
    doc.body.append(pop);
    box = { bar, table, pop, nodes, from: from?.id ?? null, into: null, name: '', remove: false, pv: null, seq: 0 };
    pop.addEventListener('click', onClick); pop.addEventListener('change', onChange); pop.addEventListener('keydown', onKey);
    doc.addEventListener('pointerdown', away, true); win.addEventListener('resize', place); doc.addEventListener('scroll', place, true);
    bar.querySelector('[data-st-values]')?.setAttribute('data-lk-on', '');   // the word is lit while its box is open
    draw(); place(); pop.focus({ preventScroll: true });
  }
  function close() {
    if (!box) return;
    const b = box; box = null;
    b.bar.querySelector('[data-st-values]')?.removeAttribute('data-lk-on');
    b.pop.remove(); doc.removeEventListener('pointerdown', away, true); win.removeEventListener('resize', place); doc.removeEventListener('scroll', place, true);
  }
  const away = event => { if (box && !box.pop.contains(event.target) && !event.target.closest?.('[data-st-values], .th-lsq-pop, .lk-door-menu')) close(); };
  function place() {
    if (!box) return; if (!box.bar.isConnected) return close();
    // Hung from its word in the bar (the owner's "good" to "Emptiness, Applied", 24 November 2026), so the ticked names stay in view
    // beside it; where the window has no room to the word's right, it ends at the window's edge.
    const r = box.bar.getBoundingClientRect(), word = box.bar.querySelector('[data-st-values]')?.getBoundingClientRect() || r, w = Math.min(400, win.innerWidth - 24);
    Object.assign(box.pop.style, { left: `${Math.max(8, Math.min(Math.round(word.left), win.innerWidth - w - 8))}px`, top: `${Math.round(r.bottom + 6)}px`, width: `${w}px`, maxHeight: `${Math.max(160, win.innerHeight - r.bottom - 16)}px` });
  }
  const intoProp = () => (box.into != null ? P(box.into) : null);
  const intoName = () => (box.into != null ? P(box.into)?.title || '' : box.name);
  // Drawn again, the box keeps the keys where they were: on the same word, or on the box itself.
  function draw() {
    const b = box, at = b.pop.contains(doc.activeElement) ? doc.activeElement : null;
    const key = !at || at === b.pop ? '' : at.dataset.pick ? `[data-pick="${at.dataset.pick}"]` : ['data-remove', 'data-go', 'data-leave'].map(n => (at.hasAttribute(n) ? `[${n}]` : '')).find(Boolean) || '';
    paint();
    if (at) (key && b.pop.querySelector(key) || b.pop).focus({ preventScroll: true });
  }
  function paint() {
    const b = box, from = b.from != null ? P(b.from) : null, into = intoProp(), name = intoName(), pv = b.pv;
    const pick = (which, p, words, off) => `<button type="button" class="act lk-pick tv-pick${off ? ' off' : ''}" data-pick="${which}">${p ? icon(p) : ''}<span class="tv-pn">${esc(words)}</span><span class="chev lk-change lk-i-chevron"></span></button>`;
    if (!from) { b.pop.innerHTML = `<div class="tv-none">None of the ${plural(b.nodes.length, 'picked node')} holds a value in a property of yours.</div><div class="lk-answers"><span class="act lk-btn lk-low lk-i-x" role="button" tabindex="0" data-leave>Leave it</span></div>`; return; }
    const propOf = n => (n === from.title ? from : into || from);   // a new property is made as the first one's kind, so it reads as that kind
    const vals = (r, p) => r.vals.map(v => { const w = typeof v === 'string' ? v : v.w, mark = r.mark === 'gone' ? '' : (typeof v === 'object' && v.mark === 'new') || r.mark === 'new' ? ' lk-coming' : ''; return `<span class="${p.type === 'node' || p.type === 'page' ? 'lk-node' : ''}${mark}">${esc(w)}</span>`; }).join('<span class="tv-sep">, </span>');
    const row = r => { const p = propOf(r.name), cls = r.mark === 'gone' ? ' lk-going' : r.mark === 'new' ? ' lk-coming' : ''; return `<span class="tv-k lk-prop${cls}">${icon(p)}<span class="lk-prop">${esc(r.name)}</span></span><span class="tv-v${cls}">${vals(r, p)}</span>`; };
    const note = n => `<div class="tv-n"><div class="tv-nh"><span class="lk-node">${esc(n.title)}</span>${n.tags.map(t => `<span class="lk-tag">${esc(t)}</span>`).join('')}</div><div class="tv-rows">${n.after.map(row).join('')}</div></div>`;
    const shown = pv ? pv.notes.filter(n => !n.same).slice(0, 2) : [], more = pv ? pv.gave.length - shown.length : 0;
    const why = !pv ? '' : pv.clash.length ? `${esc(name)} takes one value, and ${plural(pv.clash.length, 'picked node')} would hold more.` : !pv.gave.length ? `None of the ${plural(b.nodes.length, 'picked node')} holds a value that ${esc(name)} can take.` : '';
    const can = !!pv && !why;
    b.pop.innerHTML =
      `<div class="tv-form"><span class="lk-name">From</span><span>${pick('from', from, from.title)}</span>` +
      `<span class="lk-name">Into</span><span>${name ? pick('into', into || from, name) : pick('into', null, 'Choose a property, or type a new name', true)}${name && !into ? '<span class="lk-note tv-new">new property</span>' : ''}</span></div>` +
      `<label class="tv-rm"><input type="checkbox" class="lk-tick" data-remove ${b.remove ? 'checked' : ''}><span>Remove them from</span><span class="tv-k lk-prop">${icon(from)}<span class="lk-prop">${esc(from.title)}</span></span></label>` +
      (pv ? `<div class="tv-pv">${why ? `<div class="tv-none">${why}</div>` : shown.map(note).join('') + (more > 0 ? `<div class="lk-note tv-more">and ${more} more</div>` : '')}</div>` : '') +
      `<div class="lk-answers"><span class="act lk-accent lk-i-tick lk-enter${can ? '' : ' waits'}" role="button" tabindex="0" data-go>${can ? `${b.remove ? 'Move' : 'Copy'} ${plural(pv.moved, 'value')}` : b.remove ? 'Move' : 'Copy'}</span><span class="act lk-btn lk-low lk-i-x" role="button" tabindex="0" data-leave>Leave it</span></div>`;
  }
  // What the change will do, read from the graph as it is now; an answer that comes after a newer ask is dropped.
  async function preview() {
    const b = box; if (!b || b.from == null || !intoName()) { if (b) { b.pv = null; draw(); } return; }
    const seq = ++b.seq;
    const pv = await app.propPreview('forNodes', { prop: b.from, nodes: b.nodes, into: b.into, name: b.name, keep: !b.remove }).catch(error => { S.base.warnOnce('the values could not be read', error); return null; });
    if (box !== b || b.seq !== seq) return;
    b.pv = pv; draw(); place();
  }
  async function pickProp(which, at) {
    const b = box, m = M(), all = [...m.props.values()].filter(p => !p.made);
    const list = (which === 'from' ? all.filter(p => held(p, b.nodes)) : all.filter(p => p.id !== b.from)).sort(byTitle);
    const options = list.map(p => ({ label: p.title, held: p.id === b[which], iconHtml: icon(p), prop: p.id }));
    let got = null;
    if (Door.answers('relations:pickValue')) got = await Door.ask('relations:pickValue', { at, doc, placeholder: which === 'from' ? 'From property' : 'Into property, or a new name', options, free: which === 'into', make: which === 'into' ? words => `New property: ${words}` : null });
    else got = await new Promise(resolve => { const menu = Door.menu(at, options.map(o => ({ word: o.label, on: o.held, take: () => resolve(o) })), { align: 'left' }); if (!menu) resolve(null); });
    if (box !== b) return;
    // The list closed without a choice: the keys come back to the box, on the word that opened the list.
    if (!got || got === Door.UNANSWERED) { (b.pop.querySelector(`[data-pick="${which}"]`) || b.pop).focus({ preventScroll: true }); return; }
    if (got.typed != null) { const typed = String(got.typed).trim(); if (!typed) return; const same = all.find(p => p.title.trim().toLowerCase() === typed.toLowerCase());
      if (same && same.id === b.from) return; if (same) { b.into = same.id; b.name = ''; } else { b.into = null; b.name = typed; } }
    else if (got.prop != null) { if (which === 'from') { b.from = got.prop; if (b.into === b.from) { b.into = null; b.name = ''; } } else { b.into = got.prop; b.name = ''; } }
    else return;
    // From chosen: on to Into. Into chosen: the box holds the keys, so Enter is its yes.
    draw(); place(); (which === 'from' && b.pop.querySelector('[data-pick="into"]') || b.pop).focus({ preventScroll: true }); preview();
  }
  function go() {
    const b = box; if (!b || !b.pv || b.pv.clash.length || !b.pv.gave.length) return;
    const change = { kind: 'moveForNodes', prop: b.from, intoProp: b.into, name: b.into == null ? b.name : '', picked: b.nodes.slice(), keep: !b.remove, gave: b.pv.gave, left: b.pv.left };
    close();
    if (app.stage(change, { wait: true, here: true })) app.apply({ docks: true });
  }
  function onClick(event) {
    const t = event.target.closest('[data-pick], [data-go], [data-leave]'); if (!t || !box) return;
    if (t.dataset.pick) return void pickProp(t.dataset.pick, t);
    if (t.hasAttribute('data-leave')) return close();
    if (t.hasAttribute('data-go') && !t.classList.contains('waits')) return go();
  }
  function onChange(event) { if (!box || !event.target.matches?.('[data-remove]')) return; box.remove = event.target.checked; if (box.pv) preview(); else draw(); }
  function onKey(event) {
    if (!box) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return close(); }
    const at = event.target.closest?.('[data-pick], [data-leave], [data-go], [data-remove]');
    // Enter and Space on a word of the box press it; Enter anywhere else in the box is its yes.
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing) {
      if (event.key === ' ' && (!at || at.hasAttribute('data-remove'))) { event.stopPropagation(); return; }   // the tick box takes Space itself
      event.preventDefault(); event.stopPropagation();
      if (at?.dataset.pick) return void pickProp(at.dataset.pick, at);
      if (at?.hasAttribute('data-leave')) return close();
      return go();
    }
    event.stopPropagation();   // a letter typed here is not one of Logseq's keys
  }

  // In the frame Logseq draws or shrinks its bar, not one later: the word added, the bar fitted, the stand-in drawn (measured 24 November
  // 2026: the bar took two sizes, drawn and then grown when the word came).
  const offEarly = Door.watch(() => { try { binAsk(); } catch (error) { endAsk(); S.base.warnOnce('the bin\'s question could not be asked in the bar', error); } for (const bar of doc.querySelectorAll(BAR)) if (!bar.querySelector('[data-st-values], .st-bar-ghost') || (realGroup(bar) && bar.querySelector('.st-bar-ghost'))) return dress(); }, { early: true });
  const offWatch = Door.watch(dress);
  doc.addEventListener('click', seen, true); doc.addEventListener('pointerdown', press, true);
  dress();
  const refit = () => { for (const bar of doc.querySelectorAll(BAR)) fit(bar); };
  win.addEventListener('resize', refit);
  return () => { endAsk(); offEarly?.(); offWatch?.(); doc.querySelectorAll('.st-bar-ghost').forEach(el => el.remove()); doc.removeEventListener('click', seen, true); doc.removeEventListener('pointerdown', press, true); win.removeEventListener('resize', refit); close(); doc.querySelectorAll('[data-st-values]').forEach(el => el.remove()); doc.querySelectorAll('[data-st-values-table]').forEach(unfit); doc.querySelectorAll('.st-bar-fit').forEach(el => { el.classList.remove('st-bar-fit'); (el.closest('.table-action-bar') || el).style.maxWidth = ''; }); };
}
S.tableValues = { start, WORD };
})();
