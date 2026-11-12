/* The inspector: a panel in Logseq's right sidebar beside a tag's or a property's page (8 November 2026). With no row pressed
   it holds the lines that otherwise stand above the page's table (main.js places the same 'tag' view there while the inspector is
   shown). Once a row of the table is pressed or moved to, the row comes first (the owner, 9 and 12 November 2026: the inspector is
   about the content of the row): where it stands in the table, its whole words, its tags, every property it holds, the page it
   was written on, its outline; the tag's or property's lines fold under one line at the foot, "About Consultation", which opens
   them. Read only: a change is made in the table, as before. Logseq hosts the panel (mount.js); this file draws the row's part
   and says where the lines go. */
(function () {
const S = window.Structure;
const { esc, host } = window.PluginDoor;
const ROW = '#main-content-container .ls-table-row[blockid]';
const insp = { holder: null, top: null, node: null, about: null, aboutOpen: false, uuid: '', ask: 0, stops: [] };

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
const propOf = key => { const ident = window.PluginDoor.bare(key); return [...(S.inspector.model?.()?.props?.values() || [])].find(x => x.ident === ident); };
function propTitle(key) {
  const ident = window.PluginDoor.bare(key);
  const p = propOf(key);
  return p?.title || ident.replace(/^user\.property\//, '').replace(/-[A-Za-z0-9_]{8}$/, '').replace(/-/g, ' ');
}

/* The row's state of the panel: with a row shown, the lines wait folded under the foot line, named after the tag or property
   they are about; with none, they stand at the top as before and the foot line is gone. */
function sync() {
  const holder = insp.holder; if (!holder) return;
  const of = (insp.top?.querySelector('.st-insp-h')?.textContent || '').trim();
  holder.toggleAttribute('data-row', !!insp.uuid);
  holder.toggleAttribute('data-about', !!insp.uuid && insp.aboutOpen);
  const fold = insp.about?.querySelector('.lk-fold'), word = insp.about?.querySelector('.st-insp-aboutw');
  if (fold) fold.setAttribute('aria-expanded', String(insp.aboutOpen));
  if (word && word.textContent !== `About ${of}`.trim()) word.textContent = `About ${of}`.trim();
}
async function toggleAbout() {
  const lines = insp.top;
  if (insp.aboutOpen) await window.PluginDoor.rollUp(lines);
  insp.aboutOpen = !insp.aboutOpen; sync();
  if (insp.aboutOpen) window.PluginDoor.unroll(lines);
}
async function drawNode() {
  const box = insp.node; if (!box) return;
  const ask = ++insp.ask, uuid = insp.uuid;
  sync();
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
  if (!b) { box.innerHTML = '<p class="st-insp-none lk-none">This row’s node is gone.</p>'; return; }
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
  // The part's head: the node's words after its bullet, or a page's name after the page's icon, as Logseq marks each.
  const mark = b.page === null ? '<i class="ti ti-file" aria-hidden="true"></i>' : '<span class="lk-bul" aria-hidden="true"></span>';
  let h = `${whereHtml(uuid)}<div class="st-insp-words">${mark}<span class="st-insp-said">${said || '<span class="st-insp-none">No words</span>'}</span></div><dl class="st-lines-t">`;
  // Each line's name with the icon Look gives it on a page: a property by what it holds, Tags a #, On page a page.
  const icon = key => { const p = propOf(key); return p ? S.view.pi(p) : '<i class="st-pi" aria-hidden="true">' + window.PluginDoor.kindIconHtml('text') + '</i>'; };
  if (tags.length) h += `<dt><i class="ti ti-hash" aria-hidden="true"></i>Tags</dt><dd>${tags.map(t => `<span class="lk-tag" data-uuid="${esc(t.uuid)}">${esc(name(t))}</span>`).join('')}</dd>`;
  for (const [key, v] of Object.entries(props)) {
    if (!/^:?user\.property\//.test(key)) continue;
    const shown = value(v); if (!shown) continue;
    h += `<dt>${icon(key)}<span>${esc(propTitle(key))}</span></dt><dd><span>${shown}</span></dd>`;
  }
  if (page?.uuid) h += `<dt><i class="ti ti-file" aria-hidden="true"></i>On page</dt><dd><span class="lk" data-uuid="${esc(page.uuid)}">${esc(name(page))}</span></dd>`;
  insp.seen = new Set([uuid]); insp.pageId = page?.id ?? b.id;   // a change on this page, a new bullet included, draws it again
  box.innerHTML = h + '</dl>' + outline(kids);
}
/* Where the row stands in Logseq's table, "Consultation · 12 of 53" (the owner's O1c, 12 November 2026): its place is the
   number Logseq's list gives the row (data-item-index, as only the rows near the screen are drawn), the whole is the count
   Logseq writes beside the table's view. Either one missing, the line is not drawn. */
function whereHtml(uuid) {
  const row = host().querySelector(`${ROW}[blockid="${uuid}"]`);
  const at = Number(row?.closest('[data-item-index]')?.dataset.itemIndex);
  let all = NaN;
  for (let up = row?.parentElement, i = 0; up && i < 14 && !(all > 0); up = up.parentElement, i++) {
    const n = [...up.querySelectorAll('.text-muted-foreground.text-xs')].map(e => e.textContent.trim()).find(t => /^\d+$/.test(t));
    if (n) all = Number(n);
  }
  if (!row || !(at >= 0) || !(all > 0) || at >= all) return '';
  const of = (insp.top?.querySelector('.st-insp-h')?.textContent || '').trim();
  return `<div class="st-insp-where">${of ? `${esc(of)} · ` : ''}${at + 1} of ${all}</div>`;
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
  sync();
  const box = insp.node; if (!box || insp.uuid) return;
  const doc = box.ownerDocument, table = !!doc.querySelector(ROW), lines = !!insp.top?.querySelector('.st-lines-t');
  const say = table ? 'Press a row in the table to see it here.' : lines ? '' : 'Open a tag’s or a property’s page to see it here.';
  if (box.textContent === say) return;
  box.innerHTML = say ? `<p class="st-insp-none lk-none">${say}</p>` : '';
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
  // The press held back is played again where it was made, through the door's screen door (plugin.js).
  replaying = true;
  try { window.PluginDoor.screen.press(e.target, { composed: true, clientX: e.clientX, clientY: e.clientY, detail: 1 }); }
  finally { replaying = false; }
}
// A row of Logseq's table is pressed, or reached with the arrows: its node is the one shown. Only rows in the main view count.
function onRow(e) { const row = e.target?.closest?.(ROW); if (row) pick(row.getAttribute('blockid') || ''); }
function open(e) {
  if (e.target.closest('[data-about]')) { e.preventDefault(); return toggleAbout(); }
  if (e.target.closest('[data-all]')) { insp.all = true; return drawNode(); }
  const t = e.target.closest('[data-uuid],[data-name]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  const to = t.dataset.uuid || t.dataset.name;
  if (e.shiftKey) logseq.Editor.openInRightSidebar(to); else logseq.App.pushState('page', { name: to });
}

function start() {
  const doc = host();
  const HELD = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
  const { listen } = S.base;
  const offKeys = [listen(doc, HELD, hold, true), listen(doc, 'click', press, true), listen(doc, 'dblclick', twice, true), listen(doc, ['focusin', 'click'], onRow, true)];
  const offRoute = S.base.onStop(logseq.App.onRouteChanged?.(() => pick('')));
  const offDb = S.base.onStop(logseq.DB.onChanged?.(change => { if (insp.uuid && (change?.blocks || []).some(b => insp.seen?.has(b?.uuid) || (insp.pageId && b?.page?.id === insp.pageId))) { clearTimeout(insp.later); insp.later = setTimeout(drawNode, 400); } }));
  insp.stops = [...offKeys, () => mark(''), offRoute, offDb];
}
function stop() { for (const s of insp.stops) { try { s?.(); } catch (error) { /* already gone */ } } insp.stops = []; if (insp.holder) insp.holder.innerHTML = ''; insp.watch?.disconnect(); }

// Logseq gives the panel a holder: the two parts go in, the node part listens for presses on its links.
function mounted(holder) {
  const doc = holder.ownerDocument;
  S.view.ensureStyle(doc);
  holder.innerHTML = '<div class="st st-tag st-insp-node"></div><div class="lk-row st-insp-about" data-about=""><button type="button" class="lk-fold" aria-expanded="false" aria-label="What surrounds it"></button><span class="st-insp-aboutw"></span></div><div class="st-insp-top"></div>';
  insp.holder = holder; insp.node = holder.firstChild; insp.about = insp.node.nextSibling; insp.top = holder.lastChild;
  insp.node.addEventListener('click', open); insp.about.addEventListener('click', open);
  // Logseq's sidebar hidden or the panel folded leaves the holder in the page with no size: the lines go back above the table.
  let was = shown();
  insp.watch?.disconnect();
  insp.watch = doc.defaultView.ResizeObserver && new doc.defaultView.ResizeObserver(() => { if (shown() !== was) { was = shown(); mark(insp.uuid); S.inspector.changed?.(); } });
  insp.watch?.observe(holder);
  drawNode();
  S.inspector.changed?.();
}
function gone(holder) { if (insp.holder !== holder) return; insp.watch?.disconnect(); insp.holder = insp.top = insp.node = insp.about = null; mark(''); S.inspector.changed?.(); }

S.inspector = { start, stop, mounted, gone, top, shown, idle, KEY: 'structure-inspector', model: null, changed: null };
})();
