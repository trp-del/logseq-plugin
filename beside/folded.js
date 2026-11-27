/* BESIDE: what a folded bullet holds, said after its words while it is folded, small and grey, as before the rebuild (0.5.17; the
   owner chose it back on 26 November 2026). Only what asks something of you (the owner, 24 November 2026: "just do tasks and
   assets and due dates. nothing more"): an open circle with the number of unfinished tasks under it at any depth, or done of all
   ("1/3") once some are done, the circle ticked when all are; the pictures, PDFs and other files right under it, each an icon with
   its number; the nearest day an unfinished task is due ("due Oct 19", "was due Oct 12" once passed). A ↳ leads it. */
(function () {
const G = window.PluginDoor, D = G.days;
const due = (day, today = D.number(new Date())) => day === today ? 'due today' : `${day < today ? 'was due' : 'due'} ${D.short(day, today)}`;
const shows = held => held && (held.task || held.done || held.image || held.pdf || held.file || held.due);
const said = held => {
  const words = [];
  if (held.done) words.push(`${held.done} of ${held.task + held.done} tasks under it done`); else if (held.task) words.push(`${held.task} unfinished ${held.task === 1 ? 'task' : 'tasks'} under it`);
  if (held.image) words.push(`${held.image} ${held.image === 1 ? 'picture' : 'pictures'}`);
  if (held.pdf) words.push(`${held.pdf} ${held.pdf === 1 ? 'PDF' : 'PDFs'}`);
  if (held.file) words.push(`${held.file} ${held.file === 1 ? 'file' : 'files'}`);
  if (held.due) words.push(due(held.due));
  return words.join(' · ');
};
function html(held) {
  const pair = (name, n) => `<span class="lk-pair">${G.touch.icon(name, 14)}<span>${n}</span></span>`, parts = ['<span class="lk-lead" aria-hidden="true">↳</span>'];
  if (held.done) parts.push(pair(held.task ? 'circle' : 'circle-check', `${held.done}/${held.task + held.done}`)); else if (held.task) parts.push(pair('circle', held.task));
  if (held.image) parts.push(pair('photo', held.image));
  if (held.pdf) parts.push(pair('file-type-pdf', held.pdf));
  if (held.file) parts.push(pair('file', held.file));
  if (held.due) parts.push(`${parts.length > 1 ? '<span class="lk-sep" aria-hidden="true">·</span>' : ''}<span>${G.esc(due(held.due))}</span>`);
  return parts.join('');
}
G.part({
  key: 'folded', title: 'What a folded bullet holds', about: 'After a folded bullet’s words: its unfinished tasks, the files right under it and the nearest day due.',
  start(base) {
    base.style('folded', `${G.touch.FOLDED}
.lk-held-note { display: inline-flex; align-items: baseline; gap: .25em; margin-left: .5em; white-space: nowrap; user-select: none; cursor: default; font-size: var(--lk-small); color: var(--lk-quiet); font-weight: 400; }
.lk-held-note .lk-pair > :first-child { align-self: center; width: 14px; height: 14px; }
.lk-held-note .lk-pair { display: inline-flex; align-items: baseline; gap: .15em; }
.lk-held-note .lk-pair + .lk-pair { margin-left: .35em; }
.lk-held-note .lk-sep { margin: 0 .1em; }`);
    const held = new Map(), asked = new Set();
    let stopped = false;
    const draw = () => {
      if (stopped) return;
      const missing = [];
      for (const spot of G.touch.foldedSpots()) {
        if (!held.has(spot.uuid)) { if (!asked.has(spot.uuid)) missing.push(spot.uuid); continue; }
        const now = held.get(spot.uuid), key = JSON.stringify(now);
        if (!shows(now)) { spot.at?.remove(); continue; }
        if (spot.at?.dataset.held === key) continue;
        spot.at?.remove();
        const el = G.host().createElement('span');
        el.className = 'lk-held-note'; el.contentEditable = 'false'; el.dataset.held = key; el.title = said(now); el.innerHTML = html(now);
        for (const type of ['mousedown', 'pointerdown', 'click']) el.addEventListener(type, event => event.stopPropagation());
        spot.put(el);
      }
      if (missing.length) read(missing);
    };
    /* A read that fails is said once and left: the bullets are asked about again when the screen or the graph next changes
       (draw runs then), never at once, which went round without end while the graph could not be read. */
    let failing = false;
    const read = async uuids => {
      for (const uuid of uuids) asked.add(uuid);
      let found = null;
      try { found = await G.read.folded(uuids); }
      catch (error) { if (!failing) console.error('Logseq Plugin: what a folded bullet holds could not be read', error); failing = true; }
      for (const uuid of uuids) asked.delete(uuid);
      if (stopped || !found) return;
      failing = false;
      for (const uuid of uuids) held.set(uuid, found.get(uuid) || null);
      draw();
    };
    base.onStop(G.touch.watch(draw));
    base.onStop(G.touch.changed(() => { held.clear(); draw(); }));
    base.onStop(() => { stopped = true; for (const el of G.host().querySelectorAll('.lk-held-note')) el.remove(); });
  },
});
})();
