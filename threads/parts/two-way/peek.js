/* The card that comes up when the pointer rests on a node's name: what the row does not say, each piece opening what it
   names.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { openEntity, openPageNamed, esc } = shared;
const { state, warnOnce } = twoWay;

/* Peek (0.4.184): resting the pointer on a record for a moment shows a card beside it, with the record's tag and
   day, its fields (the one that points here left out) and its first lines, read when asked and kept until the
   graph changes. It goes when the pointer leaves the record and the card. The card is the kit's (0.4.318). */
const PEEK_MS = 450;
const peek = { timer: 0, hide: 0, card: null, uuid: '', anchor: null, cache: new Map() };
/* Every piece of the card opens what it names (0.4.262, the owner: "make the different links and elements of the hover
   clickable"): the title the node itself, its tag the tag's page, a property's name the property's page, a value the
   page it points to, a line the bullet it is, a link in a line its page; Shift-click opens it in the right sidebar.
   Words that name nothing (a text value) open the node, as the card always did. */
async function peekData(uuid, field) {
  const key = `${uuid}|${field}`;
  if (peek.cache.has(key)) return peek.cache.get(key);
  const fields = await twoWay.provided.nodeFields(uuid);
  fields.delete(field);
  const readable = async text => { try { return String(await twoWay.provided.readableTitle(String(text || ''))).trim(); } catch { return String(text || '').trim(); } };
  const rows = [];
  for (const [name, values] of [...fields].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8)) {
    const shown = await Promise.all(values.map(async v => ({ text: v.day ? twoWay.dayText(v.day) : (await readable(v.title ?? v.text)).replace(/\[\[([^\]]+)\]\]/g, '$1'), uuid: v.uuid || '' })));
    const seen = new Set(), kept = shown.filter(v => v.text && !seen.has(v.text) && seen.add(v.text));
    if (kept.length) rows.push({ name, uuid: fields.props?.get(name) || '', values: kept });
  }
  let lines = [];
  try { lines = (await Promise.all((await twoWay.provided.firstLines(uuid, 4, true)).map(async line => ({ uuid: line.uuid, text: await readable(line.title) })))).filter(line => line.text); } catch { /* no lines, then */ }
  const data = { rows, lines };
  peek.cache.set(key, data);
  return data;
}
// A line's words with its links open: [[Page]] as Page, [words]([[Page]]) as words, each opening the page.
function lineHtml(text, limit = 140) {
  const short = text.length > limit ? text.slice(0, limit - 1) + '…' : text;
  let html = '', at = 0;
  for (const m of short.matchAll(/\[([^\[\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/g)) {
    html += esc(short.slice(at, m.index)) + `<span class="th-tw-peek-open lk-node" data-open-page="${esc(m[2] ?? m[3])}">${esc(m[1] ?? m[3])}</span>`;
    at = m.index + m[0].length;
  }
  return html + esc(short.slice(at));
}
function findItem(uuid, rowEl) {
  const group = state.groups.find(g => g.name === rowEl?.dataset.field);
  return group ? { group, item: group.items.find(item => item.uuid === uuid) } : {};
}
function onOver(event) {
  const link = event.target.closest?.('a.th-tw-record');
  if (!link) return;
  clearTimeout(peek.hide);
  if (peek.anchor === link && peek.card && !peek.card.isClosed) return;
  clearTimeout(peek.timer);
  peek.timer = setTimeout(() => showPeek(link).catch(error => warnOnce('could not show the node card', error)), PEEK_MS);
}
function onOut(event) {
  if (!event.target.closest?.('a.th-tw-record')) return;
  clearTimeout(peek.timer);
  hidePeekSoon();
}
// A page by its name: its uuid from the page list, else Logseq finds it by name (openPageNamed, parts/shared.js).
async function openPage(name, inSidebar) {
  const page = (await twoWay.provided.propPages().catch(() => [])).find(p => p.lower === name.toLowerCase());
  if (page?.uuid) return openEntity(page.uuid, inSidebar);
  return openPageNamed(name, inSidebar);
}
const hidePeekSoon = () => { clearTimeout(peek.hide); peek.hide = setTimeout(hidePeek, 200); };
function hidePeek() { clearTimeout(peek.timer); clearTimeout(peek.hide); peek.card?.close(); peek.card = null; peek.anchor = null; }
/* The card sits clear of the rows: to the right of the words on the lines it stands beside; else under the row, so it
   never covers the list's head above (7 November 2026, the owner: "Good"); above the row only where the window has no
   room under it. */
function placePeek(card, link) {
  const box = card.getBoundingClientRect(), at = link.getBoundingClientRect(), pane = link.closest('.th-two-way').getBoundingClientRect();
  const top = Math.max(48, at.top - 10), bottom = top + box.height;
  const words = [...card.ownerDocument.querySelectorAll('.th-two-way .th-ol-line')].filter(line => { const r = line.getBoundingClientRect(); return r.bottom > top && r.top < bottom; })
    .flatMap(line => [...line.querySelectorAll('.th-ol-body > *')]).map(part => part.getBoundingClientRect().right);
  const left = Math.max(at.right, ...words) + 16, room = left + box.width <= pane.right;
  // Under or above, whichever covers no list's head (the next list's head can stand right under a row); under first.
  const heads = [...card.ownerDocument.querySelectorAll('.th-two-way .th-tw-head')].map(head => head.getBoundingClientRect());
  const x0 = at.left, x1 = at.left + box.width, clear = y => !heads.some(r => r.bottom > y && r.top < y + box.height && r.right > x0 && r.left < x1);
  const under = at.bottom + 6, above = at.top - box.height - 6;
  const fits = under + box.height <= card.ownerDocument.defaultView.innerHeight - 8, aboveFits = above >= 48;
  // Neither clear (a row just above the next list): under, past that list's head.
  const past = Math.max(under, ...heads.filter(r => r.bottom > under && r.top < under + box.height && r.right > x0 && r.left < x1).map(r => r.bottom + 6));
  const pastFits = past + box.height <= card.ownerDocument.defaultView.innerHeight - 8;
  const y = fits && clear(under) ? under : aboveFits && clear(above) ? above : pastFits ? past : fits ? under : Math.max(48, above);
  Object.assign(card.style, { margin: '0', left: `${room ? left : at.left}px`, top: `${room ? top : y}px` });
}
async function showPeek(link) {
  const { group, item } = findItem(link.dataset.uuid, link.closest('.th-tw-row'));
  if (!item) return;
  const data = await peekData(item.uuid, group.name);
  if (!link.isConnected || !link.matches(':hover')) return;
  const doc = link.ownerDocument;
  hidePeek();
  // Only what the row does not say (the review, 31 October): its tag and day stand on it, and its name unless the row cut it.
  const fields = data.rows.filter(row => !item.day || row.values.map(v => v.text).join(', ') !== twoWay.dayText(item.day));
  const cut = link.scrollHeight > link.clientHeight + 1;
  if (!cut && !fields.length && !data.lines.length) return;
  const card = peek.card = shared.card({ doc, at: link, title: cut ? item.title : '',
    fields: fields.map(row => ({ name: row.name, uuid: row.uuid, values: row.values })),
    lines: data.lines.map(line => ({ uuid: line.uuid, html: lineHtml(line.text) })),
    open: (what, value, event) => {
      // The innermost piece that names something: a link in a line before the line it is in.
      const page = event?.target?.closest?.('[data-open-page]')?.dataset.openPage;
      hidePeek();
      if (page) return openPage(page, event.shiftKey);
      if (what === 'prop') return value?.uuid ? openEntity(value.uuid, event.shiftKey) : openEntity(item.uuid, event.shiftKey);
      if (what === 'value' || what === 'line') return openEntity(value?.uuid || item.uuid, event.shiftKey);
      return openEntity(item.uuid, event.shiftKey);
    } });
  card.el.classList.add('th-two-way-peek');
  placePeek(card.el, link);
  card.el.addEventListener('mouseenter', () => clearTimeout(peek.hide));
  card.el.addEventListener('mouseleave', hidePeekSoon);
  peek.anchor = link;
}

Object.assign(twoWay, { hidePeek, lineHtml, onOut, onOver, openPage, peek });
})();
