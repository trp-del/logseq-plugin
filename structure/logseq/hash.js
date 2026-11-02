/* The hierarchy in the list that opens on #. Logseq's list stays Logseq's, with its keys: this only writes into it. Each tag
   gets its path on the empty line Logseq keeps above a row; when letters narrow the list, the first tag stands in its place
   among the tags above it and beside them, as rows the arrow keys pass over. A new tag then asks where it goes, in the same
   place, and Escape leaves it with no parent. */
(function () {
const S = window.Structure;
const Mo = S.model;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `
.st-hc { padding: 3px 10px; font-size: 13px; pointer-events: none; }
.st-hc.up { font-weight: 600; }
.st-hc.more { padding-top: 0; }
.st-hp { font-size: 12px; margin-left: 3px; }
#ui__ac-inner .menu-link-wrap.st-in-tree { padding-left: var(--st-pad, 0); }
.st-where { position: fixed; z-index: 9999; width: 280px; max-height: 340px; overflow: auto; background: var(--lk-paper, var(--ls-primary-background-color, #fff)); color: var(--lk-text, #222); border: 1px solid var(--lk-hair); border-radius: 6px; font-size: 14px; padding: 5px 0; outline: none; }
.st-where .h { padding: 4px 10px 6px; font-weight: 600; border-bottom: 1px solid var(--lk-hair); margin-bottom: 4px; }
.st-where .r { padding: 3px 10px; cursor: pointer; } .st-where .r.lit { background: var(--lk-wash); font-weight: 600; } .st-where .r:hover { background: var(--lk-wash); }`;
const MANY = 6;

function start(app, doc) {
  const win = doc.defaultView;
  let sheet = doc.getElementById('st-hash-style');
  if (!sheet) { sheet = doc.createElement('style'); sheet.id = 'st-hash-style'; sheet.className = 'st-own'; doc.head.appendChild(sheet); }
  sheet.textContent = CSS;
  const M = () => app.tray.model;
  const byTitle = title => [...M().tags.values()].find(t => !t.missing && t.title === title);
  // What is being typed after a #, or null when the list open is not the tag list.
  const typed = () => { const a = doc.activeElement; if (a?.tagName !== 'TEXTAREA') return null; const m = /(?:^|\s)#([^#\n]*)$/.exec(a.value.slice(0, a.selectionStart)); return m ? m[1] : null; };
  let was = '';
  // A row's own words, without the path written into it.
  const words = w => { const c = w.cloneNode(true); c.querySelector('.st-hp')?.remove(); return c.textContent.trim(); };
  function pass() {
    const list = doc.getElementById('ui__ac-inner'), q = list && typed();
    if (!list || q == null) { was = ''; return; }
    const wraps = [...list.querySelectorAll(':scope > .menu-link-wrap')];
    const key = q + '|' + wraps.map(words).join('|');
    if (key === was && list.querySelector('.st-hp, .st-hc')) return;
    was = key;
    list.querySelectorAll('.st-hc').forEach(n => n.remove());
    wraps.forEach(w => { w.classList.remove('st-in-tree'); w.querySelector('.st-hp')?.remove(); });
    const m = M();
    let first = q ? wraps.find(w => byTitle(words(w))) : null;
    for (const w of wraps) {
      const t = byTitle(words(w));
      if (!t) continue;
      const path = Mo.pathOf(m, t.id).slice(0, -1);
      if (!path.length || w === first) continue;
      const slot = w.querySelector('.text-xs') || w.querySelector('span');
      if (slot) { const span = doc.createElement('span'); span.className = 'st-hp'; span.textContent = path.map(id => m.tags.get(id).title).join(' / '); slot.prepend(span); }
    }
    if (!first) return;
    // The first tag in its place: each tag above it with the tags beside that one.
    const t = byTitle(words(first)), path = Mo.pathOf(m, t.id), step = 16;
    const row = (text, depth, cls = '') => { const n = doc.createElement('div'); n.className = `st-hc ${cls}`; n.style.paddingLeft = `${10 + depth * step}px`; n.textContent = text; return n; };
    const before = [], after = [];
    path.forEach((id, d) => {
      if (id === t.id) return;
      if (d === 0) before.push(row(m.tags.get(id).title, 0, 'up'));
      const next = path[d + 1], kids = Mo.kids(m, id).filter(k => k !== next), at = Mo.kids(m, id).indexOf(next), cut = kids.slice(0, MANY);
      const up = cut.filter(k => Mo.kids(m, id).indexOf(k) < at), down = cut.filter(k => Mo.kids(m, id).indexOf(k) > at);
      up.forEach(k => before.push(row(m.tags.get(k).title, d + 1)));
      if (d + 1 < path.length - 1) before.push(row(m.tags.get(next).title, d + 1, 'up'));
      const tail = down.map(k => row(m.tags.get(k).title, d + 1));
      if (kids.length > MANY) tail.push(row(`and ${kids.length - MANY} more`, d + 1, 'more'));
      after.unshift(...tail);
    });
    before.forEach(n => list.insertBefore(n, first));
    first.classList.add('st-in-tree'); first.style.setProperty('--st-pad', `${(path.length - 1) * step}px`);
    after.reverse().forEach(n => first.after(n));
  }
  const watch = new win.MutationObserver(records => { if (records.some(r => r.target.id === 'ui__ac-inner' || r.target.closest?.('#ui__ac-inner') || [...r.addedNodes].some(n => n.id === 'ui__ac' || n.querySelector?.('#ui__ac-inner')))) { if (![...records].every(r => [...r.addedNodes, ...r.removedNodes].every(n => n.classList?.contains('st-hc') || n.classList?.contains('st-hp')))) pass(); } });
  watch.observe(doc.body, { subtree: true, childList: true });

  // ---------- a new tag asks where it goes ----------
  async function where(name) {
    let t = null;
    for (let i = 0; i < 20 && !t; i++) { await new Promise(r => setTimeout(r, 150)); const row = await S.db.query(`[:find ?u :where [?t :block/title ${JSON.stringify(name)}] [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u]]`); if (row[0]) t = String(row[0][0]); }
    if (!t) return;
    await app.reread();
    const writing = doc.activeElement, box = writing?.getBoundingClientRect?.() || { left: 200, bottom: 200 };
    const pos = writing?.selectionStart;
    const list = doc.createElement('div'); list.className = 'st-where'; list.tabIndex = 0;
    list.style.left = `${Math.min(box.left + 18, win.innerWidth - 300)}px`; list.style.top = `${Math.min(box.bottom + 6, win.innerHeight - 350)}px`;
    const m = M(), rows = [];
    const walk = (id, d) => { rows.push({ id, d }); if (d < 1) Mo.kids(m, id).forEach(k => walk(k, d + 1)); };
    Mo.tops(m).filter(id => m.tags.get(id).uuid !== t).forEach(id => walk(id, 0));
    let lit = 0;
    const draw = () => { list.innerHTML = `<div class="h">Put ${esc(name)} under</div>` + rows.map((r, i) => `<div class="r ${i === lit ? 'lit' : ''}" data-i="${i}" style="padding-left:${10 + r.d * 18}px">${esc(m.tags.get(r.id).title)}</div>`).join(''); list.querySelector('.lit')?.scrollIntoView({ block: 'nearest' }); };
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
  const newName = () => { const chosen = doc.querySelector('#ui__ac-inner a.chosen'), m = chosen && /^New tag (.+)$/.exec(chosen.textContent.trim()); return m ? m[1] : null; };
  const press = e => { if (e.key !== 'Enter' || typed() == null) return; const n = newName(); if (n) where(n); };
  doc.addEventListener('keydown', press, true);
  return () => { watch.disconnect(); doc.removeEventListener('keydown', press, true); sheet.remove(); doc.querySelectorAll('.st-where, .st-hc').forEach(n => n.remove()); };
}
S.hash = { start };
})();
