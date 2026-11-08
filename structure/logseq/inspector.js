/* The inspector: a panel in Logseq's right sidebar beside a tag's or a property's page (8 November 2026). At its top stand the
   lines that otherwise stand above the page's table (main.js places the same 'tag' view there while the inspector is shown); below
   them, the node of the table's row last pressed or moved to: its whole words, its tags, every property it holds, the page it was
   written on. Read only: a change is made in the table, as before. Logseq hosts the panel (mount.js); this file draws the lower
   part and says where the upper part goes. */
(function () {
const S = window.Structure;
const { esc, host } = window.PluginDoor;
const ROW = '#main-content-container .ls-table-row[blockid]';
const insp = { holder: null, top: null, node: null, uuid: '', ask: 0, stops: [] };

// Shown: the panel is in the page and drawn (Logseq's sidebar open and the panel not folded).
const shown = () => !!(insp.holder?.isConnected && insp.holder.getClientRects().length);
const top = () => (shown() ? insp.top : null);

const name = v => String(v?.title ?? v?.fullTitle ?? v?.name ?? '');
const isPage = v => !!(v && typeof v === 'object' && (v.journalDay || (v.tags || []).some(t => String(t?.ident ?? t).match(/class\/(Page|Journal|Tag)|^:user\.class\//))));
// Logseq keeps a link in a bullet's words as [[Name]]; it reads here as the link it is.
const words = text => esc(String(text || '')).replace(/\[\[([^\]]+)\]\]/g, (m, n) => `<span class="lk" data-name="${n}">${n}</span>`);
function value(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.map(value).filter(Boolean).join('<span class="to">, </span>');
  if (typeof v !== 'object') return esc(typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
  if (isPage(v) && v.uuid) return `<span class="lk" data-uuid="${esc(v.uuid)}">${esc(name(v))}</span>`;
  return words(name(v));
}
const propOf = key => { const ident = String(key).replace(/^:/, ''); return [...(S.inspector.model?.()?.props?.values() || [])].find(x => x.ident === ident); };
function propTitle(key) {
  const ident = String(key).replace(/^:/, '');
  const p = propOf(key);
  return p?.title || ident.replace(/^user\.property\//, '').replace(/-[A-Za-z0-9_]{8}$/, '').replace(/-/g, ' ');
}

async function drawNode() {
  const box = insp.node; if (!box) return;
  const ask = ++insp.ask, uuid = insp.uuid;
  if (!uuid) return idle();
  let b = null, page = null;
  let kids = [];
  try {
    b = await logseq.Editor.getBlock(uuid, { includeChildren: true }).catch(() => null);
    if (!b) { b = await logseq.Editor.getPage(uuid); if (b) b = { ...b, page: null }; }   // a page's row: Logseq hands it only as a page
    if (b?.page?.id) { page = await logseq.Editor.getPage(b.page.id); kids = b.children || []; }
    else if (b) kids = await logseq.Editor.getPageBlocksTree(uuid) || [];   // the row is a page: its content is its outline
  } catch (error) { /* gone meanwhile */ }
  if (ask !== insp.ask) return;
  if (!b) { box.innerHTML = '<p class="st-insp-none">This row’s node is gone.</p>'; return; }
  const props = { ...(b.properties || {}) };
  // A page is handed with its values as bare ids: each is read, so it shows by its name. A number property keeps its number.
  const whole = async (v, key) => {
    if (Array.isArray(v)) return Promise.all(v.map(x => whole(x, key)));
    if (typeof v !== 'number' || propOf(key)?.type === 'number') return v;
    return (await logseq.Editor.getBlock(v).catch(() => null)) || v;
  };
  for (const key of Object.keys(props)) if (key === 'tags' || /^:?user\.property\//.test(key)) props[key] = await whole(props[key], key);
  if (ask !== insp.ask) return;
  const tags = [].concat(props.tags || []).filter(t => t?.uuid && /^:?user\.class\//.test(String(t.ident || '')));
  const said = b.page === null ? `<span class="lk" data-uuid="${esc(uuid)}">${esc(name(b))}</span>` : words(b.fullTitle ?? b.title ?? b.content);
  let h = `<div class="st-insp-words">${said || '<span class="st-insp-none">No words</span>'}</div><dl class="st-lines-t">`;
  if (tags.length) h += `<dt>Tags</dt><dd>${tags.map(t => `<span class="lk-tag" data-uuid="${esc(t.uuid)}">${esc(name(t))}</span>`).join('')}</dd>`;
  for (const [key, v] of Object.entries(props)) {
    if (!/^:?user\.property\//.test(key)) continue;
    const shown = value(v); if (!shown) continue;
    h += `<dt>${esc(propTitle(key))}</dt><dd><span>${shown}</span></dd>`;
  }
  if (page?.uuid) h += `<dt>On page</dt><dd><span class="lk" data-uuid="${esc(page.uuid)}">${esc(name(page))}</span></dd>`;
  insp.seen = new Set([uuid]); insp.pageId = page?.id ?? b.id;   // a change on this page, a new bullet included, draws it again
  box.innerHTML = h + '</dl>' + outline(kids);
}
/* What is written in the node or on the page, below what describes it: the outline as Logseq shows it, read only, with
   Logseq's bullets (lk-bul); a folded bullet stays folded. A long outline shows its first lines, then Show all. */
const FEW = 60;
function outline(kids) {
  const lines = [];
  const walk = (list, d) => { for (const k of list || []) { if (!k?.uuid) continue; insp.seen.add(k.uuid); const folded = k['collapsed?'] && k.children?.length; lines.push({ k, d, folded }); if (!folded) walk(k.children, d + 1); } };
  walk(kids, 0);
  const real = lines.filter(l => (l.k.fullTitle ?? l.k.title ?? '').trim() || l.k.children?.length);
  if (!real.length) return '';
  const shown = insp.all ? real : real.slice(0, FEW);
  return `<div class="st-insp-outline">${shown.map(({ k, d, folded }) => `<div class="st-insp-b" style="--d:${d}"><span class="lk-bul opens ${folded ? 'folded' : ''}" data-uuid="${esc(k.uuid)}" title="Open this bullet"></span><span class="w">${words(k.fullTitle ?? k.title ?? '')}</span></div>`).join('')}` +
    (shown.length < real.length ? `<span class="lk-more" data-all>Show all ${real.length}</span>` : '') + '</div>';
}

// No row pressed: one faint line says what the panel is waiting for, or nothing when the lines above already fill it.
function idle() {
  const box = insp.node; if (!box || insp.uuid) return;
  const doc = box.ownerDocument, table = !!doc.querySelector(ROW), lines = !!insp.top?.querySelector('.st-lines-t');
  const say = table ? 'Press a row in the table to see it here.' : lines ? '' : 'Open a tag’s or a property’s page to see it here.';
  if (box.textContent === say) return;
  box.innerHTML = say ? `<p class="st-insp-none">${say}</p>` : '';
}
function pick(uuid) {
  mark(uuid);
  if (uuid === insp.uuid) return; insp.uuid = uuid; insp.all = false; drawNode();
}
// The row the inspector shows carries a quiet wash, so the eye finds it in the table; the arrows move it with the row.
function mark(uuid) {
  const doc = host();
  for (const r of doc.querySelectorAll('[data-st-picked]')) if (r.getAttribute('blockid') !== uuid || !shown()) r.removeAttribute('data-st-picked');
  if (uuid && shown()) for (const r of doc.querySelectorAll(`${ROW}[blockid="${uuid}"]`)) r.setAttribute('data-st-picked', '');
}
/* While the inspector is shown, a single press on a cell of the table only selects its row (the owner, 8 November 2026: "single
   to select and double to edit"): Logseq's own press, which opens the cell's editor or follows a link, waits for a double press,
   which hands it the press it would have had. The tick box, the heads and the keys stay Logseq's; with the inspector closed every
   press is Logseq's as before. Cmd, Ctrl, Alt and Shift presses pass, so Shift still opens a link in the sidebar. */
const TICK = '[data-table-row-select], [role="checkbox"]';
let replaying = false;
function cellOf(e) {
  if (replaying || !shown() || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  const cell = e.target?.closest?.('.ls-table-cell');
  return cell && cell.closest(ROW) && !e.target.closest(TICK) ? cell : null;
}
// Logseq follows a link as the button goes down, so the press is held from there on, not only at its click.
function hold(e) { if (cellOf(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
function press(e) {
  const cell = cellOf(e); if (!cell) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.detail > 1) return;   // the second press of a double press: the dblclick does the work
  cell.focus({ preventScroll: true });
  pick(cell.closest(ROW).getAttribute('blockid') || '');
}
function twice(e) {
  const cell = cellOf(e); if (!cell) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const win = e.view || host().defaultView, at = { bubbles: true, cancelable: true, composed: true, view: win, clientX: e.clientX, clientY: e.clientY, button: 0, detail: 1 };
  replaying = true;
  try { for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) e.target.dispatchEvent(new (t.startsWith('pointer') ? win.PointerEvent : win.MouseEvent)(t, { ...at, buttons: /down/.test(t) ? 1 : 0 })); }
  finally { replaying = false; }
}
// A row of Logseq's table is pressed, or reached with the arrows: its node is the one shown. Only rows in the main view count.
function onRow(e) { const row = e.target?.closest?.(ROW); if (row) pick(row.getAttribute('blockid') || ''); }
function open(e) {
  if (e.target.closest('[data-all]')) { insp.all = true; return drawNode(); }
  const t = e.target.closest('[data-uuid],[data-name]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  const to = t.dataset.uuid || t.dataset.name;
  if (e.shiftKey) logseq.Editor.openInRightSidebar(to); else logseq.App.pushState('page', { name: to });
}

function start() {
  const doc = host();
  const HELD = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
  for (const t of HELD) doc.addEventListener(t, hold, true);
  doc.addEventListener('click', press, true); doc.addEventListener('dblclick', twice, true);
  doc.addEventListener('focusin', onRow, true); doc.addEventListener('click', onRow, true);
  const offRoute = logseq.App.onRouteChanged?.(() => pick(''));
  const offDb = logseq.DB.onChanged?.(change => { if (insp.uuid && (change?.blocks || []).some(b => insp.seen?.has(b?.uuid) || (insp.pageId && b?.page?.id === insp.pageId))) { clearTimeout(insp.later); insp.later = setTimeout(drawNode, 400); } });
  insp.stops = [() => { for (const t of HELD) doc.removeEventListener(t, hold, true); doc.removeEventListener('click', press, true); doc.removeEventListener('dblclick', twice, true); doc.removeEventListener('focusin', onRow, true); doc.removeEventListener('click', onRow, true); mark(''); }, offRoute, offDb];
}
function stop() { for (const s of insp.stops) { try { s?.(); } catch (error) { /* already gone */ } } insp.stops = []; if (insp.holder) insp.holder.innerHTML = ''; insp.watch?.disconnect(); }

// Logseq gives the panel a holder: the two parts go in, the node part listens for presses on its links.
function mounted(holder) {
  const doc = holder.ownerDocument;
  S.view.ensureStyle(doc);
  holder.innerHTML = '<div class="st-insp-top"></div><div class="st st-tag st-insp-node"></div>';
  insp.holder = holder; insp.top = holder.firstChild; insp.node = holder.lastChild;
  insp.node.addEventListener('click', open);
  // Logseq's sidebar hidden or the panel folded leaves the holder in the page with no size: the lines go back above the table.
  let was = shown();
  insp.watch?.disconnect();
  insp.watch = doc.defaultView.ResizeObserver && new doc.defaultView.ResizeObserver(() => { if (shown() !== was) { was = shown(); mark(insp.uuid); S.inspector.changed?.(); } });
  insp.watch?.observe(holder);
  drawNode();
  S.inspector.changed?.();
}
function gone(holder) { if (insp.holder !== holder) return; insp.watch?.disconnect(); insp.holder = insp.top = insp.node = null; mark(''); S.inspector.changed?.(); }

S.inspector = { start, stop, mounted, gone, top, shown, idle, KEY: 'structure-inspector', model: null, changed: null };
})();
