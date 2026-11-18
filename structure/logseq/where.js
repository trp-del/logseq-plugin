/* A new tag asks where it goes (14 November 2026, deepened 18 November 2026). Whatever made the tag (Enter, Cmd-Enter or a press
   on "New tag" in the # list, "+ New option" in Logseq's Set Tags list) asks here, so the question is the same everywhere.

   The owner, 18 November 2026: "when a new tag is created and asks where to place, only a couple levels are seen, not deep down".
   Until then the list stopped one level under the top-level tags. Now the whole tree can be reached:
   - the question stands on its own line, the new tag in the tag's look, since where a tag goes is a choice that matters;
   - your top-level tags stand open one level, deeper tags folded; a fold arrow opens a tag (Right arrow), and closes it or steps
     back to its parent (Left arrow); what opens rolls out;
   - letters typed find any tag at any depth, each with its path after its name, as the # list shows it;
   - Enter or a press puts the tag there, with the faded Undo arrow beside the tag; "The top" (or Escape) leaves it with no parent.
   The same tree answers "Change to another tag…" on a tag's right-click menu (tag-menu.js).
   Drawn from the library: lk-pop, lk-menu, lk-group, lk-field, lk-item (.on), lk-fold, lk-tag, lk-note. */
(function () {
const S = window.Structure;
const Mo = S.model;
const Door = window.PluginDoor;
const { esc } = Door;
const CSS = `
.st-where { position: fixed; z-index: 9999; width: 340px; display: flex; flex-direction: column; max-height: min(420px, calc(100vh - 24px)); outline: none; }
.st-where .lk-group.st-wq { font-size: inherit; padding: 4px 8px 6px; }
.st-where .lk-field { margin: 0 8px 6px; }
.st-where .st-wl { overflow: auto; min-height: 0; }
.st-where .st-wr { display: flex; align-items: center; justify-content: flex-start; gap: 2px; width: 100%; text-align: left; padding: 2px 8px 2px calc(4px + var(--d, 0) * 16px); line-height: 22px; }
.st-where .st-wr .lk-fold { opacity: .6; }
.st-where .st-wr .lk-fold:hover { opacity: 1; }
.st-where .st-wr .st-wsp { width: 16px; flex: none; }
.st-where .st-wr .nm { white-space: nowrap; flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.st-where .st-wr.top .nm { font-weight: 600; }
.st-where .st-wr .lk-note { margin-left: .6em; flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
.st-where .st-wr .lk-note > bdi { direction: ltr; unicode-bidi: isolate; }
.st-where .st-wr.st-wtop { color: var(--lk-quiet); }
.st-where .st-wr.st-wnow .nm { color: var(--lk-quiet); }
.st-where .st-wnone { padding: 4px 8px; color: var(--lk-quiet); }`;

let shown = null;   // the question open now: { box, close }

function start(app, doc) {
  const win = doc.defaultView;
  const sheet = S.base.sheet('st-where-style', CSS, 'st-own', doc);
  const M = () => app.tray.model;
  const findTag = async name => {
    for (let i = 0; i < 20; i++) {
      const row = await S.db.query(`[:find ?u :where [?t :block/title ${JSON.stringify(name)}] [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u]]`).catch(() => []);
      if (row[0]) return String(row[0][0]);
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  };
  // Where the faded Undo arrow stands: the new tag on the bullet it was given to, else what asked.
  const tagOn = (uuid, near) => { const sel = `a.tag[data-uuid="${uuid}"]`; return (near?.isConnected && near.closest?.('.ls-block')?.querySelector(sel)) || doc.querySelector(`.ls-block ${sel}`); };

  /* THE tag tree picker, one drawing for every "which tag" asked outside the map: a new tag's place (ask, below) and a tag changed
     on a bullet or a page (tag-menu.js, "Change to another tag…"). ask: the question's words, the tag shown in the tag's look
     ({ before, tag, after }); near: the element it opens under; back: what gets the keyboard again; skip: a tag id left out with
     everything under it; now: the tag held now, shown faint and not taken; leave: the words of the row "The top" (null for none); onPick(row): called with { id } or { top: true }. */
  function pick({ ask: words, near = null, back = null, skip = null, now = null, leave = null, onPick }) {
    const m = M();
    shown?.close(null);
    const anchor = near?.isConnected ? near.getBoundingClientRect() : { left: 200, bottom: 200, top: 200 };
    const open = new Set(Mo.tops(m));   // the top-level tags stand open one level
    let q = '', lit = 0, rows = [];
    const label = `${words.before}${words.tag}${words.after}`;
    const box = Door.el(doc, 'div', { class: 'st-where lk-pop lk-menu', role: 'dialog', 'aria-label': label });
    box.innerHTML = `<div class="lk-group st-wq">${esc(words.before)}<span class="lk-tag">${esc(words.tag)}</span>${esc(words.after)}</div><label class="lk-field"><input type="text" placeholder="Find a tag" autocomplete="off" spellcheck="false"></label><div class="st-wl" role="listbox"></div>`;
    const input = box.querySelector('input'), list = box.querySelector('.st-wl');
    const title = id => m.tags.get(id)?.title || '';
    const kidsOf = id => Mo.kids(m, id).filter(k => k !== skip);
    // The rows as they stand: the tree with what is open, or, with letters typed, every tag that matches, with its path.
    function build() {
      const out = [];
      if (q) {
        const low = q.toLowerCase();
        const all = [...m.tags.values()].filter(t => t.id !== skip && !(skip != null && Mo.under(m, t.id, skip)) && t.title.toLowerCase().includes(low));
        all.sort((a, b) => (b.title.toLowerCase().startsWith(low) - a.title.toLowerCase().startsWith(low)) || a.title.localeCompare(b.title));
        for (const t of all) out.push({ id: t.id, d: 0, path: Mo.pathOf(m, t.id).slice(0, -1).map(title).join(' / ') });
      } else {
        const walk = (id, d) => { out.push({ id, d, kids: kidsOf(id).length > 0 }); if (open.has(id)) kidsOf(id).forEach(k => walk(k, d + 1)); };
        Mo.tops(m).filter(id => id !== skip).forEach(id => walk(id, 0));
      }
      if (leave && (!q || 'the top'.includes(q.toLowerCase()))) out.push({ top: true, d: 0 });
      return out;
    }
    const rowHtml = (r, i) => r.top
      ? `<div class="lk-item st-wr st-wtop${i === lit ? ' on' : ''}" role="option" data-i="${i}" style="--d:0"><span class="st-wsp"></span><span class="nm">${esc(leave || '')}</span><span class="lk-note"><bdi>no parent</bdi></span></div>`
      : `<div class="lk-item st-wr${r.id === now ? ' st-wnow' : ''}${r.d === 0 && !q ? ' top' : ''}${i === lit ? ' on' : ''}" role="option" data-i="${i}" data-id="${r.id}" style="--d:${Math.min(r.d, 8)}">` +
        (r.kids ? `<span class="lk-fold" role="button" aria-label="${open.has(r.id) ? 'Close' : 'Open'} ${esc(title(r.id))}" aria-expanded="${open.has(r.id)}"></span>` : '<span class="st-wsp"></span>') +
        `<span class="nm">${esc(title(r.id))}</span>${r.id === now ? '<span class="lk-note"><bdi>now</bdi></span>' : r.path ? `<span class="lk-note"><bdi>${esc(r.path)}</bdi></span>` : ''}</div>`;
    // Drawn again from the rows; the rows that were not there before roll out.
    function draw({ roll = false } = {}) {
      const had = new Set([...list.querySelectorAll('[data-id]')].map(n => n.dataset.id));
      rows = build();
      lit = Math.max(0, Math.min(lit, rows.length - 1));
      list.innerHTML = rows.length ? rows.map(rowHtml).join('') : `<div class="st-wnone">No tag matches “${esc(q)}”</div>`;
      if (roll) Door.unroll([...list.querySelectorAll('[data-id]')].filter(n => !had.has(n.dataset.id)));
      list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    }
    const light = i => { lit = i; list.querySelectorAll('.st-wr').forEach(n => n.classList.toggle('on', Number(n.dataset.i) === i)); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); };
    const toggle = async (id, want = !open.has(id)) => {
      if (want === open.has(id)) return;
      if (want) { open.add(id); draw({ roll: true }); return; }
      // Closing: the rows under it roll up, then go.
      const gone = new Set(), walk = k => { gone.add(String(k)); if (open.has(k)) kidsOf(k).forEach(walk); };
      kidsOf(id).forEach(walk);
      open.delete(id);
      await Door.rollUp([...list.querySelectorAll('[data-id]')].filter(n => gone.has(n.dataset.id)));
      lit = rows.findIndex(r => r.id === id); draw();
    };
    let done = false;
    function close(row) {
      if (done) return; done = true;
      shown = null; off();
      box.remove();
      const to = back?.isConnected ? back : near?.isConnected && near.matches?.('textarea, input') ? near : null;
      if (to) { const pos = to.selectionStart; to.focus(); if (pos != null) to.setSelectionRange?.(pos, pos); }
      if (row) onPick(row);
    }
    const take = i => { const r = rows[i]; if (r && !(now != null && r.id === now)) close(r); };
    box.addEventListener('keydown', e => {
      e.stopPropagation();
      const r = rows[lit];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) light((lit + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length); }
      else if (e.key === 'Enter') { e.preventDefault(); take(lit); }
      else if (e.key === 'Escape') { e.preventDefault(); close(null); }
      else if (e.key === 'Tab') e.preventDefault();
      else if (e.key === 'ArrowRight' && !q && r?.kids) { e.preventDefault(); if (!open.has(r.id)) toggle(r.id, true); else light(lit + 1); }
      else if (e.key === 'ArrowLeft' && !q && r && !r.top) {
        e.preventDefault();
        if (open.has(r.id) && r.kids) toggle(r.id, false);
        else { const up = Mo.parentOf(m, r.id), at = rows.findIndex(x => x.id === up); if (at >= 0) light(at); }
      }
    }, true);
    input.addEventListener('input', () => { q = input.value.trim(); lit = 0; draw(); });
    // A press: on a fold arrow it opens or closes; elsewhere on a row it takes the row. Held back, so the box keeps the keyboard.
    box.addEventListener('pointerdown', e => {
      if (e.target === input) return;
      e.preventDefault();
      const row = e.target.closest('.st-wr'); if (!row || e.button !== 0) return;
      const r = rows[Number(row.dataset.i)];
      if (e.target.closest('.lk-fold') && r?.kids) toggle(r.id);
      else take(Number(row.dataset.i));
      input.focus();
    });
    box.addEventListener('mousemove', e => { const row = e.target.closest('.st-wr'); if (row && Number(row.dataset.i) !== lit) light(Number(row.dataset.i)); });
    const away = e => { if (!box.contains(e.target)) close(null); };
    const offs = [S.base.listen(doc, 'pointerdown', away, true), S.base.listen(win, 'blur', () => close(null))];
    const off = () => offs.forEach(o => o?.());
    doc.body.append(box);
    draw();
    // Under what asked, or above it when there is no room below; inside the window.
    const w = box.offsetWidth, h = box.offsetHeight;
    const below = anchor.bottom + 6 + h <= win.innerHeight - 12 || anchor.top - 6 - h < 12;
    box.style.left = `${Math.max(12, Math.min(anchor.left + 18, win.innerWidth - w - 12))}px`;
    const top = below ? anchor.bottom + 6 : Math.max(12, anchor.top - 6 - h);
    box.style.top = `${top}px`;
    if (below) box.style.maxHeight = `${Math.max(200, win.innerHeight - top - 12)}px`;   // never past the window's foot: the list scrolls
    Door.unroll(box);
    input.focus();
    shown = { box, close };
  }

  // A new tag asks where it goes. Escape or "The top" leaves it with no parent.
  async function ask(name, { near = null, back = null } = {}) {
    const uuid = await findTag(name);
    if (!uuid) return;
    await app.reread();
    const self = [...M().tags.values()].find(t => String(t.uuid) === uuid);
    if (!self || self.parents.length) return;   // given a place already (a tag that was there under another spelling)
    pick({ ask: { before: 'Put ', tag: name, after: ' under' }, near, back, skip: self.id, leave: 'The top', onPick: async row => {
      if (row.top) return;
      const parent = M().tags.get(row.id);
      try { await S.db.addExtends(uuid, parent.uuid); }
      catch (error) { S.base.warnOnce('the new tag could not be placed', error); return Door.notify(`${name} could not be put under ${parent.title}`, 'warning'); }
      await app.reread();
      Door.undo.offer({ owner: 'structure', key: `structure:where:${uuid}`, at: () => tagOn(uuid, near), text: `${name} back at the top`,
        run: async () => { await S.db.removeExtends(uuid, parent.uuid); await app.reread(); },
        onFail: error => { S.base.warnOnce('the new tag could not be put back', error); Door.notify(`${name} could not be put back at the top`, 'warning'); } });
    } });
  }
  return { ask, pick, stop: () => { shown?.close(null); sheet.remove(); } };
}
S.where = { start };
})();
