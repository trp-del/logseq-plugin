/* The hierarchy in the list that opens on #. Logseq's list stays Logseq's, with its keys: this writes into it, and gives a tag
   through Logseq's own choosing.
   - With letters typed, every row is a tag that matches, with its path on its own line, after its name, quiet; "New tag" stands
     last, and the first match is lit (14 November 2026, the owner, of #hospi: "confusing with hospital"; until then the first
     tag stood among the tags above and beside it, rows the keys passed over that read as choices, with "New tag" lit between
     two matches).
   - Before any letter (# alone), your own tags stand under your top-level tags, the few used most lately under each, and
     Logseq's own tags (Task, Template, Card…) fold into one line at the foot (14 November 2026).
   - The lit tag names the tags under it at its right end; Right arrow steps down to them, Left arrow back up.
   - A name that is nearly a tag's (a plural, a letter off, the words in another order) keeps that tag in the list, lit, above
     "New tag", so a second tag is not made for the same thing.
   - A new tag then asks where it goes, in the same place, and Escape leaves it with no parent. */
(function () {
const S = window.Structure;
const Mo = S.model;
const Door = window.PluginDoor;
const { esc } = Door;
const CSS = `
.st-hc { padding: 3px 10px; font-size: var(--lk-small); pointer-events: none; }
.st-hc.up { font-weight: 600; }
.st-hc.more { padding-top: 0; }
.st-hp { font-size: var(--lk-small); margin-left: .6em; color: var(--lk-quiet); }
#ui__ac-inner .flex-row:has(> .st-hp) { align-items: baseline; }
#ui__ac-inner .menu-link-wrap.st-in-tree, #ui__ac-inner .menu-link-wrap.st-hrow { padding-left: var(--st-pad, 0); }
/* the plugin's own rows, built as Logseq builds its rows so they look and light as Logseq's do */
#ui__ac-inner.st-own > .menu-link-wrap:not(.st-hrow) { display: none; }
/* with letters typed: Logseq's rows in Logseq's order, but "New tag" last, by order alone, so nothing of Logseq's is moved */
#ui__ac-inner.st-typed { display: flex; flex-direction: column; }
#ui__ac-inner.st-typed > .st-last { order: 1; }
#ui__ac-inner .st-hrow .flex-1 > .st-hp { font-weight: 400; }
#ui__ac-inner .st-hrow.st-head .menu-link { font-weight: 600; }
#ui__ac-inner .st-hrow.st-quiet .menu-link { color: var(--lk-quiet); }
#ui__ac-inner .st-hrow .menu-link { cursor: pointer; white-space: nowrap; }
/* the tags under the lit tag, at its right end; a press on them steps down */
.st-hk { margin-left: auto; padding-left: 1.5em; font-size: var(--lk-small); font-weight: 400; color: var(--lk-off); white-space: nowrap; display: none; }
#ui__ac-inner .menu-link.chosen > .st-hk { display: inline; }
#ui__ac-inner.st-twin-lit > .menu-link-wrap:not(.st-hrow) .menu-link.chosen { background: none !important; }
#ui__ac-inner.st-twin-lit > .menu-link-wrap:not(.st-hrow) .menu-link.chosen > .st-hk { display: none; }
#ui__ac.st-taking { visibility: hidden; }
.st-where { position: fixed; z-index: 9999; width: 280px; max-height: 340px; overflow: auto; outline: none; }   /* the library's pop-up and menu (lk-pop, lk-menu); a line lk-item, the lit one on */
.st-where .h { padding: 4px 10px 6px; font-weight: 600; border-bottom: 1px solid var(--lk-hair); margin-bottom: 4px; }
.st-where .r.on { font-weight: 600; }`;
const FEW = 4, STEP = 16;

function start(app, doc) {
  const win = doc.defaultView;
  const sheet = S.base.sheet('st-hash-style', CSS, 'st-own', doc);
  const M = () => app.tray.model;
  const byTitle = title => [...M().tags.values()].find(t => t.title === title);
  // What is being typed after a #, or null when the list open is not the tag list.
  // The # may follow a space, the start, or the end of a link or a bracket: "[[Medicare]]#" opens Logseq's tag list too (15 November
  // 2026, the owner: "the wrong menu appears after a wikilink is created"; the plain list showed because only a space counted).
  const typed = () => { const a = doc.activeElement; if (a?.tagName !== 'TEXTAREA') return null; const m = /(?:^|[\s\])}])#([^#\n]*)$/.exec(a.value.slice(0, a.selectionStart)); return m ? m[1] : null; };
  const listEl = () => doc.getElementById('ui__ac-inner');
  const logseqRows = list => [...list.querySelectorAll(':scope > .menu-link-wrap:not(.st-hrow)')];
  // A row's own words, without what is written into it.
  const words = w => { const c = w.cloneNode(true); c.querySelectorAll('.st-hp, .st-hk').forEach(n => n.remove()); return c.textContent.trim(); };
  const edits = () => window.Flow?.link?.editsBetween || null;   // Predictive's edit distance, the one used inside [[ ]]

  /* What the list shows of the plugin's own, in one place; everything is drawn from it.
     own: null while Logseq's rows show; else the plugin's rows in their place: { kind: 'top' | 'under' | 'logseq', id, rows, lit, back, q }.
       rows: { tag: id | title: a tag of Logseq's own | fold: Logseq's tags, folded | more: the top-level tag to step into, depth, head, quiet, pick }.
     twin: with letters typed, the tag whose name is nearly the words: { id, q, lit }. */
  let own = null, twin = null, was = '', taking = false, movedFor = '', moved = false, walked = null;   // moved: a key or the pointer has moved the lit row since these words were typed

  const kidsNote = id => { const kids = Mo.kids(M(), id); if (!kids.length) return ''; const names = kids.slice(0, 2).map(k => M().tags.get(k).title).join(', '); return `${names}${kids.length > 2 ? ` and ${kids.length - 2} more` : ''} ›`; };
  // Before any letter: each top-level tag, the few tags used most lately under it, and Logseq's own tags in one line at the foot.
  function topRows(list) {
    const m = M(), rows = [];
    for (const top of Mo.tops(m)) {
      const has = Mo.kids(m, top).length > 0;
      rows.push({ tag: top, depth: 0, head: has, pick: true });
      if (!has) continue;
      const { shown, more } = Mo.lately(m, top, FEW);
      for (const id of shown) rows.push({ tag: id, depth: 1, pick: true });
      if (more) rows.push({ more: top, depth: 1, quiet: true, pick: true, text: `and ${more} more` });
    }
    const theirs = logseqRows(list).map(words).filter(t => t && !byTitle(t));
    if (theirs.length && rows.length) rows.push({ fold: theirs, depth: 0, quiet: true, pick: true, text: `Logseq’s tags: ${theirs.slice(0, 4).join(', ')}${theirs.length > 4 ? ` and ${theirs.length - 4} more` : ''}` });
    return rows;
  }
  // Under one tag: the tags above it as rows the keys pass over, the tag itself, then every tag under it.
  function underRows(id) {
    const m = M(), path = Mo.pathOf(m, id), rows = [];
    path.forEach((p, d) => rows.push(p === id ? { tag: p, depth: d, head: true, pick: true } : { text: m.tags.get(p).title, depth: d, head: true }));
    for (const k of Mo.kids(m, id)) rows.push({ tag: k, depth: path.length, pick: true });
    return rows;
  }
  const firstLit = rows => { const kid = rows.findIndex(r => r.pick && !r.head); return kid >= 0 ? kid : rows.findIndex(r => r.pick); };
  function showTop(list, q) { const rows = topRows(list); own = rows.some(r => r.pick) ? { kind: 'top', rows, lit: firstLit(rows), back: null, q } : null; }
  function stepDown(id, q) { const rows = underRows(id); own = { kind: 'under', id, rows, lit: firstLit(rows), back: own, q }; }
  function stepBack() { own = own.back; }

  // One of the plugin's rows, built as Logseq builds its own (menu-link-wrap, menu-link, chosen), so it looks and lights the same.
  function rowEl(r, i) {
    const m = M(), t = r.tag != null ? m.tags.get(r.tag) : null;
    const wrap = doc.createElement('div'); wrap.className = `menu-link-wrap st-hrow${r.head ? ' st-head' : ''}${r.quiet ? ' st-quiet' : ''}`; wrap.dataset.i = String(i); wrap.style.setProperty('--st-pad', `${(r.depth || 0) * STEP}px`);
    const a = doc.createElement('a'); a.className = 'flex justify-between menu-link';
    const name = doc.createElement('span'); name.className = 'flex-1'; name.textContent = t ? t.title : (r.title ?? r.text); a.append(name);
    const path = r.path && t ? Mo.pathOf(m, t.id).slice(0, -1) : [];
    if (path.length) { const span = doc.createElement('span'); span.className = 'st-hp'; span.textContent = path.map(id => m.tags.get(id).title).join(' / '); name.append(span); }
    const note = t && kidsNote(t.id);
    if (note && !(own?.kind === 'under' && own.id === t.id)) { const k = doc.createElement('span'); k.className = 'st-hk'; k.textContent = note; a.append(k); }
    wrap.append(a);
    return wrap;
  }
  const contextRow = (text, depth, cls = '') => { const n = doc.createElement('div'); n.className = `st-hc ${cls}`; n.style.paddingLeft = `${10 + depth * STEP}px`; n.textContent = text; return n; };
  // The lit row, lit as Logseq lights its own; nothing is drawn again.
  function light() {
    const list = listEl(); if (!list) return;
    list.classList.toggle('st-twin-lit', !!(twin && twin.lit && !own));
    for (const w of list.querySelectorAll(':scope > .st-hrow')) { const on = own ? Number(w.dataset.i) === own.lit : !!twin?.lit; w.querySelector('a').classList.toggle('chosen', on); if (on) w.scrollIntoView?.({ block: 'nearest' }); }
  }
  const sweep = list => {
    list.querySelectorAll('.st-hc, .st-hrow, .st-hp, .st-hk').forEach(n => n.remove());
    list.querySelectorAll(':scope > .st-in-tree').forEach(w => { w.classList.remove('st-in-tree'); w.style.removeProperty('--st-pad'); });
    list.querySelectorAll(':scope > .st-last').forEach(w => w.classList.remove('st-last'));
    list.classList.remove('st-own', 'st-twin-lit', 'st-typed');
  };
  function draw() {
    const list = listEl(); if (!list) return;
    sweep(list);
    const m = M();
    if (!own) list.style.minWidth = '';
    if (own) {
      if (!list.style.minWidth) list.style.minWidth = `${Math.max(list.offsetWidth, 300)}px`;   // the list keeps its width as its rows change, so nothing moves sideways
      list.classList.add('st-own');
      const at = list.firstChild;
      own.rows.forEach((r, i) => list.insertBefore(r.pick ? rowEl(r, i) : contextRow(r.text, r.depth, r.head ? 'up' : ''), at));
      return light();
    }
    const wraps = logseqRows(list);
    mark(list);
    for (const w of wraps) {
      const t = byTitle(words(w));
      if (!t) continue;
      const link = w.querySelector('a.menu-link'), note = kidsNote(t.id);
      if (link && note) { const k = doc.createElement('span'); k.className = 'st-hk'; k.textContent = note; link.append(k); }
      const path = Mo.pathOf(m, t.id).slice(0, -1);
      if (!path.length) continue;
      // On the tag's own line, after its name (10 November 2026, the audit's 24: on the empty line above the row, a place read as
      // the foot of the row before it).
      const line = w.querySelector('.flex-row') || w.querySelector('span');
      if (line) { const span = doc.createElement('span'); span.className = 'st-hp'; span.textContent = path.map(id => m.tags.get(id).title).join(' / '); line.append(span); }
    }
    if (twin) list.insertBefore(rowEl({ tag: twin.id, depth: 0, path: true }, 0), list.firstChild);
    light();
  }
  // With letters typed: "New tag" is put last, by order alone. Logseq's row for it reads "New tag" and the words, and is no tag's name.
  const isNew = w => /^New tag /.test(words(w)) && !byTitle(words(w));
  function mark(list) {
    const on = !own && !!(typed() || '');
    list.classList.toggle('st-typed', on);
    for (const w of logseqRows(list)) w.classList.toggle('st-last', on && isNew(w));
  }
  // The rows as they stand with letters typed: the near name's tag, Logseq's matches in Logseq's order, then "New tag".
  const shown = list => { const rows = logseqRows(list); return [...list.querySelectorAll(':scope > .st-hrow'), ...rows.filter(w => !w.classList.contains('st-last')), ...rows.filter(w => w.classList.contains('st-last'))]; };
  const lightTheirs = row => { Door.screen.hover(row.querySelector('a') || row); row.scrollIntoView?.({ block: 'nearest' }); };
  // The first row is the lit one until a key or the pointer moves it: Logseq draws its list again as its search answers, lights its
  // own first row each time (which may be "New tag", now last), and its count can run past the rows, leaving none lit.
  function keepFirst(list) {
    if (own || moved || !(typed() || '')) return;
    const first = shown(list)[0];
    if (first && !first.classList.contains('st-hrow') && !first.querySelector('a.chosen')) lightTheirs(first);
  }
  // Logseq drew its list (it opened, the words changed): what stands of the plugin's own is worked out again, then drawn.
  function pass() {
    const list = listEl(), q = list && typed();
    if (!list || q == null) { was = ''; own = null; twin = null; return; }
    if (taking) return;
    const wraps = logseqRows(list), m = M();
    if (own && own.q !== q) own = null;
    if (!own && q === '') showTop(list, q);
    const near = !own && q.trim() ? Mo.nearTag(m, q, edits()) : null;
    twin = near != null && !wraps.some(w => byTitle(words(w))?.id === near) ? { id: near, q, lit: twin && twin.id === near && twin.q === q ? twin.lit : true } : null;
    if (movedFor !== q) { movedFor = q; moved = false; walked = null; }
    const key = [q, wraps.map(words).join('|'), own ? `${own.kind}:${own.id ?? ''}` : '', twin ? twin.id : ''].join('\u0001');
    if (key === was && list.querySelector('.st-hp, .st-hc, .st-hrow, .st-hk')) { mark(list); light(); return keepFirst(list); }
    was = key;
    draw();
    keepFirst(list);
  }
  // A pass on the one screen watcher (plugin.js), run at once when Logseq's list changes, before it is drawn; what the pass writes is set aside by the watcher.
  const mine = n => ['st-hc', 'st-hp', 'st-hrow', 'st-hk'].some(c => n.classList?.contains(c));
  const offWatch = S.base.watch((page, changes) => { const records = changes.filter(r => r.type === 'childList'); if (records.some(r => r.target.id === 'ui__ac-inner' || r.target.closest?.('#ui__ac-inner') || [...r.addedNodes].some(n => n.id === 'ui__ac' || n.querySelector?.('#ui__ac-inner')))) { if (![...records].every(r => [...r.addedNodes, ...r.removedNodes].every(mine))) pass(); } }, { early: true });

  /* Giving a tag from one of the plugin's rows, through Logseq's own choosing, so the bullet, the cursor and Cmd-Z are as when
     Logseq's row is taken: the words after the # become the tag's name, Logseq's list then holds its row, and that row is
     pressed (inline: lit, then Logseq's own Cmd-Enter). The list is out of sight for that moment. Where Logseq's list never
     shows the row, the words are taken out and the tag given through Logseq's call. */
  async function give({ title, uuid }, inline) {
    const box = doc.activeElement, q = typed();
    if (q == null) return;
    const upto = box.selectionStart, from = upto - q.length, holder = doc.getElementById('ui__ac');
    taking = true; own = null; twin = null; was = '';
    holder?.classList.add('st-taking');
    try {
      if (box.value.slice(from, upto) !== title) Door.screen.insert(box, title, from, upto);
      const row = await Door.screen.waitFor(() => { const list = listEl(); return list && logseqRows(list).find(w => words(w) === title); }, 1500, { frames: true });
      if (row && !inline) Door.screen.press(row.querySelector('a') || row);
      else if (row) {
        const link = row.querySelector('a') || row;
        Door.screen.hover(link);
        Door.screen.key(box, 'Enter', { keyCode: 13, which: 13, metaKey: true });
      } else if (uuid && box.isConnected) {
        const blockId = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
        Door.screen.insert(box, '', from - 1, from + title.length);
        Door.screen.key(box, 'Escape', { keyCode: 27, which: 27 });
        if (blockId) await Door.write.addTag(blockId, uuid);
      }
    } catch (error) { S.base.warnOnce('the tag could not be given', error); Door.notify(`The tag ${title} could not be given`, 'warning'); }
    finally { taking = false; doc.getElementById('ui__ac')?.classList.remove('st-taking'); pass(); }
  }
  // What a row does when taken: a tag is given; "and 3 more" steps under its top-level tag; Logseq's tags unfold.
  function take(r, inline = false) {
    if (r.more != null) { stepDown(r.more, own.q); return draw(); }
    if (r.fold) { const rows = r.fold.map(title => ({ title, depth: 0, pick: true })); own = { kind: 'logseq', rows, lit: 0, back: own, q: own.q }; return draw(); }
    if (r.tag != null) { const t = M().tags.get(r.tag); return give({ title: t.title, uuid: t.uuid }, inline); }
    if (r.title) return give({ title: r.title, uuid: '' }, inline);
  }
  const litRow = () => own ? own.rows[own.lit] : null;
  const canStep = r => r && (r.more != null || r.fold || (r.tag != null && Mo.kids(M(), r.tag).length > 0 && !(own?.kind === 'under' && own.id === r.tag)));
  const step = r => { if (r.tag != null) { stepDown(r.tag, own ? own.q : typed() || ''); draw(); } else take(r); };

  // ---------- a new tag asks where it goes ----------
  async function where(name) {
    let t = null;
    for (let i = 0; i < 20 && !t; i++) { await new Promise(r => setTimeout(r, 150)); const row = await S.db.query(`[:find ?u :where [?t :block/title ${JSON.stringify(name)}] [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u]]`); if (row[0]) t = String(row[0][0]); }
    if (!t) return;
    await app.reread();
    const writing = doc.activeElement, box = writing?.getBoundingClientRect?.() || { left: 200, bottom: 200 };
    const pos = writing?.selectionStart;
    const list = doc.createElement('div'); list.className = 'st-where lk-pop lk-menu'; list.tabIndex = 0;
    list.style.left = `${Math.min(box.left + 18, win.innerWidth - 300)}px`; list.style.top = `${Math.min(box.bottom + 6, win.innerHeight - 350)}px`;
    const m = M(), rows = [];
    const walk = (id, d) => { rows.push({ id, d }); if (d < 1) Mo.kids(m, id).forEach(k => walk(k, d + 1)); };
    Mo.tops(m).filter(id => m.tags.get(id).uuid !== t).forEach(id => walk(id, 0));
    let lit = 0;
    const draw = () => { list.innerHTML = `<div class="h">Put ${esc(name)} under</div>` + rows.map((r, i) => `<div class="r lk-item ${i === lit ? 'on' : ''}" data-i="${i}" style="padding-left:${10 + r.d * 18}px">${esc(m.tags.get(r.id).title)}</div>`).join(''); list.querySelector('.lit')?.scrollIntoView({ block: 'nearest' }); };
    const done = async pick => {
      list.remove();
      if (pick) { await S.db.addExtends(t, m.tags.get(pick.id).uuid); await app.reread(); }
      if (writing?.isConnected) { writing.focus(); if (pos != null) writing.setSelectionRange(pos, pos); }
    };
    list.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') { e.preventDefault(); lit = Math.min(rows.length - 1, lit + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); lit = Math.max(0, lit - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); done(rows[lit]); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    list.addEventListener('mousedown', e => { e.preventDefault(); const r = e.target.closest('[data-i]'); if (r) done(rows[+r.dataset.i]); });
    doc.body.appendChild(list); draw(); list.focus();
  }
  const newName = () => { const chosen = doc.querySelector('#ui__ac-inner > .menu-link-wrap:not(.st-hrow) a.chosen'), m = chosen && /^New tag (.+)$/.exec(chosen.textContent.trim()); return m ? m[1] : null; };
  const plain = e => !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
  // The keys, before Logseq hears them. Logseq's own rows keep Logseq's keys; the plugin's rows take Up, Down and Enter as Logseq's
  // do, and Right and Left step down and back up. Typing, Escape and everything else are Logseq's.
  function onKey(e) {
    if (e.isComposing || taking || !e.isTrusted) return;
    const list = listEl(), q = list && typed();
    if (q == null) return;
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    const chosenLogseq = () => (walked && walked.isConnected ? walked : null) || logseqRows(list).find(w => w.querySelector('a.chosen'));
    if (own) {
      const picks = own.rows.map((r, i) => r.pick ? i : -1).filter(i => i >= 0), at = picks.indexOf(own.lit);
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && plain(e)) { eat(); own.lit = picks[(at + (e.key === 'ArrowDown' ? 1 : picks.length - 1)) % picks.length]; light(); }
      else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { eat(); take(litRow(), e.metaKey || e.ctrlKey); }
      else if (e.key === 'ArrowRight' && plain(e) && canStep(litRow())) { eat(); step(litRow()); }
      else if (e.key === 'ArrowLeft' && plain(e) && own.kind !== 'top') { eat(); stepBack(); draw(); }
      return;
    }
    // Logseq's rows, with letters typed. Up and Down walk the rows as they stand (the near name's tag, the matches, "New tag" last),
    // by lighting the next one as the pointer over it would; Enter and everything else stay Logseq's, but on the near name's tag.
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && plain(e) && list.classList.contains('st-typed')) {
      const all = shown(list); if (!all.length) return;
      const at = twin?.lit ? 0 : all.indexOf(chosenLogseq()), next = at < 0 ? (e.key === 'ArrowDown' ? all[0] : all[all.length - 1]) : all[(at + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
      eat(); moved = true;
      if (twin) twin.lit = next.classList.contains('st-hrow');
      walked = next.classList.contains('st-hrow') ? null : next;   // the row the keys are on, kept here: two presses can come before Logseq has drawn the first
      if (walked) lightTheirs(next);
      return light();
    }
    if (twin?.lit) {
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { eat(); const t = M().tags.get(twin.id); return give({ title: t.title, uuid: t.uuid }, e.metaKey || e.ctrlKey); }
      if (e.key === 'ArrowRight' && plain(e) && Mo.kids(M(), twin.id).length) { eat(); stepDown(twin.id, q); return draw(); }
      return;
    }
    if (e.key === 'ArrowRight' && plain(e)) { const w = chosenLogseq(), t = w && byTitle(words(w)); if (t && Mo.kids(M(), t.id).length) { eat(); stepDown(t.id, q); draw(); } return; }
    if (e.key === 'Enter') { const n = newName(); if (n) where(n); }
  }
  // The pointer: moved over a row it lights it, a press takes it, a press on the tags named at its right end steps down. The press is held
  // back so the bullet keeps the keyboard.
  // Only a pointer that really moved counts: a list drawn under a resting pointer must not take the lit row with it.
  let pointer = '';
  function onOver(e) {
    const at = `${e.clientX},${e.clientY}`, shifted = at !== pointer; pointer = at;
    const list = listEl(); if (!shifted || !list || !list.contains(e.target)) return;
    moved = true; walked = null;   // the module's own: the pointer has moved the lit row, so the first match is no longer kept lit
    const row = e.target.closest?.('.st-hrow');
    if (own && row) { const i = Number(row.dataset.i); if (i !== own.lit) { own.lit = i; light(); } }
    else if (twin && !own) { const lit = !!row; if (e.target.closest?.('.menu-link-wrap') && lit !== twin.lit) { twin.lit = lit; light(); } }
  }
  function onPress(e) {
    const list = listEl(), row = list && e.target.closest?.('.st-hrow');
    if (!row || !list.contains(row)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'pointerdown' || e.button !== 0 || taking) return;   // the first of the press: held back, it keeps the keyboard in the bullet, and no mousedown follows it
    const down = !!e.target.closest('.st-hk');
    if (own) { const r = own.rows[Number(row.dataset.i)]; if (!r) return; if (down && canStep(r)) step(r); else take(r, e.metaKey || e.ctrlKey); }
    else if (twin) { if (down) { stepDown(twin.id, typed() || ''); draw(); } else { const t = M().tags.get(twin.id); give({ title: t.title, uuid: t.uuid }, e.metaKey || e.ctrlKey); } }
  }
  // A press on the tags named at the right end of one of Logseq's own rows steps down too.
  function onPressTheirs(e) {
    const k = e.target.closest?.('#ui__ac-inner > .menu-link-wrap:not(.st-hrow) .st-hk');
    if (!k || e.button !== 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'pointerdown') return;
    const t = byTitle(words(k.closest('.menu-link-wrap')));
    if (t) { stepDown(t.id, typed() || ''); draw(); }
  }
  const offs = [
    S.base.listen(doc, 'keydown', onKey, true), S.base.listen(doc, 'mousemove', onOver, true),
    ...['pointerdown', 'mousedown', 'mouseup', 'click'].flatMap(type => [S.base.listen(doc, type, onPress, true), S.base.listen(doc, type, onPressTheirs, true)]),
  ];
  return () => { offWatch(); offs.forEach(off => off?.()); sheet.remove(); const list = listEl(); if (list) { sweep(list); list.style.minWidth = ''; } doc.getElementById('ui__ac')?.classList.remove('st-taking'); doc.querySelectorAll('.st-where').forEach(n => n.remove()); own = null; twin = null; };
}
S.hash = { start };
})();
