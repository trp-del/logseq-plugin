/* NODE: the card a line raises. Resting the pointer on a node's words for a moment raises a card with only what the line does
   not say: the node's whole name when the line cut it, what it holds under its properties, and its first lines. With nothing to
   add there is no card. It stands to the right of the words where there is room, else under the line, or above it near the
   window's foot; it goes when the pointer leaves, at a press, a key or a scroll. */
(function () {
const G = window.PluginDoor;
let card = null, timer = 0, asked = 0, offs = null;
const drop = () => { clearTimeout(timer); asked++; card?.remove(); card = null; };
async function raise(line) {
  const turn = ++asked, row = line.closest('.lk-row'), doc = line.ownerDocument, win = doc.defaultView;
  if (!row || row.dataset.open) return;
  const node = await G.read.node(row.dataset.uuid);
  if (!node || turn !== asked) return;
  const [held, lines, mine] = await Promise.all([G.read.held([node.id]), G.read.firstLines(node.id, 3), G.read.byUuids([row.dataset.uuid])]);
  if (turn !== asked || !line.isConnected) return;
  const names = await G.read.names([...lines, mine[0]?.words || ''].flatMap(text => G.words.named(text)));
  if (turn !== asked) return;
  const words = line.querySelector('.lk-words'), whole = G.words.plain(mine[0]?.words || '', names), cut = whole.trim().length > (words?.innerText || '').trim().length + 2 || /…\s*$/.test(words?.innerText || '');
  const props = Object.entries(held.get(node.id) || {});
  if (!cut && !props.length && !lines.length) return;
  card = doc.createElement('div'); card.className = 'lk-card';
  card.innerHTML = `${cut ? `<div class="lk-card-name">${G.esc(whole)}</div>` : ''}${props.map(([name, values]) => `<div class="lk-card-row"><span class="lk-prop">${G.esc(name)}</span><span>${G.esc(values.join(', '))}</span></div>`).join('')}${lines.map(text => `<div class="lk-card-line"><span class="lk-bul" aria-hidden="true"></span><span>${G.esc(G.words.plain(text, names))}</span></div>`).join('')}`;
  doc.body.appendChild(card);
  const at = (words || line).getBoundingClientRect(), box = line.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
  let left = at.right + 12, top = box.top;
  if (left + w > win.innerWidth - 8) { left = Math.max(8, Math.min(at.left, win.innerWidth - w - 8)); top = box.bottom + 4; if (top + h > win.innerHeight - 8) top = Math.max(8, box.top - 4 - h); }
  else if (top + h > win.innerHeight - 8) top = Math.max(8, win.innerHeight - 8 - h);
  card.style.left = `${Math.round(left)}px`; card.style.top = `${Math.round(top)}px`;
}
function start() {
  if (offs) return;
  const doc = G.host();
  const over = event => {
    const words = event.target.closest?.('.lk-row > .lk-line .lk-words');
    if (!words || event.target.closest('.lk-status, .lk-lacks, .lk-sits')) return;
    clearTimeout(timer); const line = words.closest('.lk-line');
    timer = doc.defaultView.setTimeout(() => raise(line).catch(() => {}), 650);
  };
  const out = event => { if (event.target.closest?.('.lk-row > .lk-line')) drop(); };
  const on = (type, fn, opts) => { doc.addEventListener(type, fn, opts); return () => doc.removeEventListener(type, fn, opts); };
  offs = [on('mouseover', over), on('mouseout', out), on('pointerdown', drop, true), on('keydown', drop, true), on('wheel', drop, { capture: true, passive: true })];
}
function stop() { drop(); for (const off of offs || []) off(); offs = null; }
G.card = { start, stop };
G.card.CSS = `
.lk-card { position: fixed; z-index: 9998; max-width: min(24rem, calc(100vw - 16px)); padding: 8px 12px; border-radius: 10px; pointer-events: none; font-size: var(--lk-line-size); line-height: var(--lk-line-lead);
  background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); color: var(--lk-text); }
.lk-card-name { font-weight: 500; margin-bottom: 4px; }
.lk-card-row { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 12px; }
.lk-card-line { display: flex; gap: 4px; color: var(--lk-quiet); }
.lk-card-line .lk-bul { height: var(--lk-line-lead); }`;
})();
