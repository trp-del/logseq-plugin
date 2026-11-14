/* A property's list of values, by tag (14 November 2026). Logseq's list stays Logseq's: its rows, its ticks, its typing and its
   Enter. When the pages a property takes carry more than one tag (a property that takes Person lists doctors too, since Doctor
   sits under Person), each tag's pages stand under its name: the narrower tag first (Doctor), then the wider (Person), in
   Logseq's own order inside each. Before any letter a group shows its first few and "and 13 more", which opens it; typing
   narrows across the groups as Logseq narrows. One tag only, and the list is exactly Logseq's.
   The rows are Logseq's own, put in order by CSS (order), so nothing of Logseq's is moved or drawn again; Up and Down walk
   them in the order shown, by lighting the next row as the pointer would (Logseq lights the row under the pointer). */
(function () {
const S = window.Structure;
const Mo = S.model;
const Door = window.PluginDoor;
const CSS = `
#ui__ac-inner.st-vg { display: flex; flex-direction: column; }
#ui__ac-inner.st-vg > .menu-link-wrap.st-vhide { display: none; }
#ui__ac-inner.st-vg > .st-vh { padding: 6px 10px 2px; font-size: var(--lk-small); font-weight: 600; pointer-events: none; }
#ui__ac-inner.st-vg > .st-vmore { padding: 4px 6px 6px; margin: 0 4px; border-radius: 4px; font-size: var(--lk-small); color: var(--lk-quiet); cursor: pointer; }
#ui__ac-inner.st-vg > .st-vmore.on { background: var(--lk-wash); }
#ui__ac-inner.st-vg.st-vmore-lit > .menu-link-wrap .menu-link.chosen { background: none !important; }`;
const FEW = 5, SPAN = 100000;

function start(app, doc) {
  const sheet = S.base.sheet('st-value-list-style', CSS, 'st-own', doc);
  const M = () => app.tray.model;
  const listEl = () => doc.querySelector('.cp__select #ui__ac-inner');
  const inputOf = list => list?.closest('.cp__select')?.querySelector('input.cp__select-input') || null;
  const rowsOf = list => [...list.querySelectorAll(':scope > .menu-link-wrap')];
  const nameOf = row => row.textContent.trim();
  // The property the list sets, from the words in its box ("Set Spoke with"): the node properties of that name, and the tags they take.
  function rangeOf(list) {
    const said = /^Set (.+)$/.exec(inputOf(list)?.placeholder || '')?.[1];
    if (!said) return null;
    const m = M(), range = new Set();
    for (const p of m.props.values()) if (p.title === said && (p.type === 'node' || p.type === 'page')) p.range.forEach(id => range.add(id));
    return range.size ? Mo.rangeOrder(m, [...range]) : null;
  }
  // Each page's tag among those tags, by the page's name: asked once per set of tags, and again in the background each time a list opens.
  const known = new Map();   // the tags' ids joined -> { byName: Map(name -> tag id), at }
  async function learn(order) {
    const key = order.join(' ');
    const rows = await Door.query(`[:find ?name ?t :where ${Door.idsIn('?t', order)} [?n :block/tags ?t] [?n :block/title ?name]]`);
    const rank = new Map(order.map((id, i) => [id, i])), byName = new Map();
    for (const [name, t] of rows) { const had = byName.get(String(name)); if (had == null || rank.get(t) < rank.get(had)) byName.set(String(name), t); }   // a page with two of the tags stands under the narrower
    known.set(key, { byName, at: Date.now() });
    return known.get(key);
  }
  let open = null;   // { list, order, key, said, groups: [{ tag, rows, shown }], unfolded: Set(tag), lit: the "and N more" the keys are on (a tag id) or null }
  const sweep = list => {
    list.classList.remove('st-vg', 'st-vmore-lit');
    list.querySelectorAll(':scope > .st-vh, :scope > .st-vmore').forEach(n => n.remove());
    for (const row of rowsOf(list)) { row.style.order = ''; row.classList.remove('st-vhide'); }
  };
  const hover = row => { Door.screen.hover(row.querySelector('a') || row); row.scrollIntoView?.({ block: 'nearest' }); };
  // What the keys walk: the rows shown and each "and N more", in the order they stand.
  const walk = list => [...list.querySelectorAll(':scope > .menu-link-wrap:not(.st-vhide), :scope > .st-vmore')].sort((a, b) => Number(a.style.order) - Number(b.style.order));
  function light(list) {
    list.classList.toggle('st-vmore-lit', open?.lit != null);
    for (const more of list.querySelectorAll(':scope > .st-vmore')) { const on = open?.lit === Number(more.dataset.tag); more.classList.toggle('on', on); if (on) more.scrollIntoView?.({ block: 'nearest' }); }
  }
  function draw(list, data, fresh) {
    const m = M(), rows = rowsOf(list), said = inputOf(list)?.value || '';
    const groups = new Map(open.order.map(id => [id, []])), loose = [];
    rows.forEach(row => { const t = data.byName.get(nameOf(row)); if (t != null && groups.has(t)) groups.get(t).push(row); else loose.push(row); });
    const filled = [...groups].filter(([, list]) => list.length);
    sweep(list);
    if (filled.length < 2) { open.groups = []; open.lit = null; return; }
    list.classList.add('st-vg');
    open.groups = filled.map(([tag, own], g) => {
      const base = (g + 1) * SPAN, all = !!said.trim() || open.unfolded.has(tag) || own.length <= FEW + 1;
      const head = doc.createElement('div'); head.className = 'st-vh'; head.style.order = String(base); head.textContent = m.tags.get(tag).title; list.append(head);
      own.forEach((row, i) => { row.style.order = String(base + 1 + i); row.classList.toggle('st-vhide', !all && i >= FEW); });
      if (!all) { const more = doc.createElement('div'); more.className = 'st-vmore'; more.dataset.tag = String(tag); more.style.order = String(base + SPAN - 1); more.textContent = `and ${own.length - FEW} more`; list.append(more); }
      return { tag, rows: own };
    });
    loose.forEach((row, i) => { row.style.order = String((filled.length + 2) * SPAN + i); });
    if (open.lit != null && !list.querySelector(`:scope > .st-vmore[data-tag="${open.lit}"]`)) open.lit = null;
    // The lit row is the first one shown when the list opens and when the words change, and is kept there while Logseq draws the
    // list again as its search answers, until a key or the pointer moves it; a tick or an opened group leaves it where it is.
    if (fresh) { open.lit = null; open.first = true; open.walked = null; }
    if (open.first) { const first = walk(list)[0]; if (first?.classList.contains('menu-link-wrap') && !first.querySelector('a.chosen')) hover(first); }
    light(list);
  }
  async function pass() {
    const list = listEl();
    if (!list) { open = null; return; }
    const order = rangeOf(list);
    if (!order || order.length < 2) { if (open) sweep(list); open = null; return; }
    const key = order.join(' '), said = inputOf(list)?.value || '';
    const fresh = !open || open.list !== list || open.key !== key || open.said !== said;
    if (!open || open.list !== list || open.key !== key) open = { list, order, key, said, groups: [], unfolded: new Set(), lit: null };
    open.said = said;
    const have = known.get(key);
    if (have) { draw(list, have, fresh); if (fresh && Date.now() - have.at > 2000) learn(order).then(data => { if (open?.list === list && open.key === key && list.isConnected) draw(list, data, false); }).catch(() => {}); return; }
    try { const data = await learn(order); if (open?.list === list && open.key === key && list.isConnected) draw(list, data, true); }
    catch (error) { S.base.warnOnce('the list of values could not be put in groups', error); }
  }
  const mine = n => n.classList?.contains('st-vh') || n.classList?.contains('st-vmore');
  const offWatch = S.base.watch((page, changes) => {
    const records = changes.filter(r => r.type === 'childList');
    if (!records.some(r => r.target.id === 'ui__ac-inner' || r.target.closest?.('.cp__select') || [...r.addedNodes, ...r.removedNodes].some(n => n.matches?.('.cp__select, .cp__select *') || n.querySelector?.('.cp__select')))) return;
    if (records.every(r => [...r.addedNodes, ...r.removedNodes].every(mine))) return;
    pass();
  }, { early: true });
  // The tags' pages are asked for as soon as a property's value is pressed or reached, so the groups stand in the list's first frame.
  function ahead(e) {
    const pill = e.target.closest?.('.property-value-inner[data-type="node"]'); if (!pill) return;
    const name = pill.closest('.bottom-property-pill')?.querySelector('.property-k')?.textContent?.trim(); if (!name) return;
    const m = M(), range = new Set();
    for (const p of m.props.values()) if (p.title === name && (p.type === 'node' || p.type === 'page')) p.range.forEach(id => range.add(id));
    const order = range.size ? Mo.rangeOrder(m, [...range]) : [];
    if (order.length > 1 && !(Date.now() - (known.get(order.join(' '))?.at || 0) < 2000)) learn(order).catch(() => {});
  }
  const unfold = tag => { const list = listEl(); if (!open || !list) return; open.unfolded.add(tag); open.lit = null; open.first = false; const group = open.groups.find(g => g.tag === tag), next = group?.rows[FEW]; draw(list, known.get(open.key), false); if (next) hover(next); inputOf(list)?.focus(); };
  function onKey(e) {
    const list = listEl();
    if (!open || !list || open.list !== list || !list.classList.contains('st-vg') || e.isComposing || !e.isTrusted) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const all = walk(list); if (!all.length) return;
      open.first = false;
      const now = open.lit != null ? all.findIndex(n => n.dataset.tag === String(open.lit)) : open.walked && all.includes(open.walked) ? all.indexOf(open.walked) : all.findIndex(n => n.querySelector?.('a.chosen'));
      const next = all[(now + (e.key === 'ArrowDown' ? 1 : all.length - 1) + (now < 0 && e.key === 'ArrowUp' ? 1 : 0)) % all.length];
      eat();
      open.walked = next.classList.contains('st-vmore') ? null : next;   // the row the keys are on, kept here: two presses can come before Logseq has drawn the first
      if (next.classList.contains('st-vmore')) { open.lit = Number(next.dataset.tag); light(list); } else { open.lit = null; light(list); hover(next); }
    } else if (e.key === 'Enter' && open.lit != null) { eat(); unfold(open.lit); }
  }
  function onPress(e) {
    const more = e.target.closest?.('.st-vmore'); if (!more || !listEl()?.contains(more)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'pointerdown' && e.button === 0) unfold(Number(more.dataset.tag));
  }
  // The pointer, once it really moves: over one of Logseq's rows it takes the keys off an "and N more", over an "and N more" it lights it.
  let pointer = '';
  function onOver(e) { const at = `${e.clientX},${e.clientY}`, moved = at !== pointer; pointer = at; const list = listEl(); if (!moved || !open || !list?.contains(e.target)) return; open.first = false; open.walked = null; if (open.lit == null && !e.target.closest?.('.st-vmore')) return; if (e.target.closest?.('.menu-link-wrap')) { open.lit = null; light(list); } else { const more = e.target.closest?.('.st-vmore'); if (more) { open.lit = Number(more.dataset.tag); light(list); } } }
  const offs = [S.base.listen(doc, 'keydown', onKey, true), S.base.listen(doc, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true), S.base.listen(doc, 'mousemove', onOver, true), S.base.listen(doc, ['pointerdown', 'focusin'], ahead, true)];
  return () => { offWatch(); offs.forEach(off => off?.()); sheet.remove(); const list = listEl(); if (list) sweep(list); open = null; known.clear(); };
}
S.valueList = { start };
})();
