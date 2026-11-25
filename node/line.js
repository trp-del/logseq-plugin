/* NODE: the one line any node is shown as, wherever a list shows it.
     G.line.html(node, { names, statuses, tagShown })   the line's markup: bullet, status circle if a task, words, tag
     G.line.act(event, row)                             what a press or a key on a line does; true when it took the event
     G.line.menu(at, row)                               the line's right-click menu
   A row is the list's element for one node (data-uuid, data-page when the node is a page); the line stands in it. */
(function () {
const G = window.PluginDoor, W = G.words;
const MARK = { b: 'b', i: 'i', code: 'code', del: 'del', mark: 'mark' };
function wordsHtml(words, names) {
  const { line, more } = W.firstLine(words);
  const html = W.parts(line, names).map(part => {
    const text = G.esc(part.text);
    const to = part.uuid ? `data-to="${G.esc(part.uuid)}"` : `data-to="${G.esc(part.name || '')}"`;
    let inner = part.kind === 'link' ? `<a class="lk-node" ${to}>${text}</a>`
      : part.kind === 'tag' ? `<a class="lk-tag" ${to}>${text}</a>`
      : part.kind === 'url' ? `<a class="lk-url" data-href="${G.esc(part.href)}" title="${G.esc(part.href)}">${text}</a>` : text;
    for (const mark of [...(part.marks || [])].reverse()) inner = `<${MARK[mark]}>${inner}</${MARK[mark]}>`;
    return inner;
  }).join('');
  return (html || '<span class="lk-none">Empty</span>') + (more ? '<span class="lk-off"> …</span>' : '');
}
function statusHtml(node, statuses) {
  const s = node.status && statuses.find(one => one.id === node.status);
  if (!s) return '';
  const colour = s.icon?.color ? ` style="color: ${G.esc(s.icon.color)}"` : '';
  return `<button type="button" class="lk-status ls-icon-${G.esc(s.icon?.id || '')}"${colour} title="${G.esc(s.title)}" aria-label="Status: ${G.esc(s.title)}">${G.touch.statusIcon(s.icon) || G.esc(s.title)}</button>`;
}
function html(node, { names, statuses, tagShown }) {
  return `<span class="lk-bul" aria-hidden="true"></span>${statusHtml(node, statuses)}<span class="lk-words">${wordsHtml(node.words, names)}${tagShown && node.tag ? ` <span class="lk-tag">${G.esc(node.tag)}</span>` : ''}</span>`;
}

async function pickStatus(at, row) {
  const statuses = await G.read.statuses(), now = Number(row.dataset.status) || 0;
  G.menu(at, statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now,
    take: () => G.write.setStatus(row.dataset.uuid, s.title).catch(error => G.say(`The status could not be set: ${error?.message || 'Logseq refused'}`, 'warning')) })));
}
async function menu(at, row) {
  const uuid = row.dataset.uuid, statuses = row.dataset.status ? await G.read.statuses() : [], now = Number(row.dataset.status) || 0;
  G.menu(at, [
    { word: 'Open', icon: G.touch.icon('arrow-right'), take: () => G.touch.open(uuid) },
    { word: 'Open in sidebar', icon: G.touch.icon('layout-sidebar-right'), take: () => G.touch.open(uuid, true) },
    ...(statuses.length ? [{ gap: true }, { group: 'Status' }, ...statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now, take: () => G.write.setStatus(uuid, s.title).catch(error => G.say(`The status could not be set: ${error?.message || 'Logseq refused'}`, 'warning')) }))] : []),
    { gap: true },
    { word: 'Delete', icon: G.touch.icon('trash'), take: () => G.write.remove(uuid, row.dataset.page === '1').catch(error => G.say(`It could not be deleted: ${error?.message || 'Logseq refused'}`, 'warning')) },
  ]);
}
// A press or a key on a closed line. The list calls this for every event in it; true says the line took it.
function act(event, row) {
  const target = event.target, line = target.closest('.lk-line');
  if (event.type === 'contextmenu') { if (!line) return false; event.preventDefault(); menu({ x: event.clientX, y: event.clientY, from: line }, row); return true; }
  if (event.type === 'click') {
    const status = target.closest('.lk-status');
    if (status && line) { pickStatus(status, row); return true; }
    const link = target.closest('a[data-to]');
    if (link && line) { G.touch.open(link.dataset.to, event.shiftKey); return true; }
    const url = target.closest('.lk-url');
    if (url && line) { logseq.App.openExternalLink(url.dataset.href); return true; }
    if (target.closest('.lk-fold') && target.closest('.lk-row') === row) { G.node.toggle(row); return true; }
    if (line) { if (event.shiftKey) G.touch.open(row.dataset.uuid, true); else G.node.toggle(row); return true; }
    return false;
  }
  if (event.type === 'keydown' && line && target === line) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (event.shiftKey) G.touch.open(row.dataset.uuid, true); else G.node.toggle(row); return true; }
  }
  return false;
}
G.line = { html, act, menu };
G.line.CSS = `
.lk-row { display: grid; grid-template-columns: var(--lk-daycol, 0px) 18px minmax(0, 1fr); align-items: start; }
.lk-row > .lk-day { grid-column: 1; overflow: hidden; white-space: nowrap; font-size: var(--lk-small); color: var(--lk-off); font-variant-numeric: tabular-nums; line-height: 24px; padding-top: 2px; }
.lk-row > .lk-fold { grid-column: 2; }
.lk-row > .lk-line, .lk-row > .lk-open { grid-column: 3; min-width: 0; }
.lk-row[data-open] > .lk-line { display: none; }
.lk-fold { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 24px; margin-top: 2px; padding: 0; border: 0; background: none; color: var(--lk-off); cursor: pointer; opacity: 0; }
.lk-fold svg { width: 14px; height: 14px; transition: transform .12s ease; }
.lk-row:hover > .lk-fold, .lk-row:focus-within > .lk-fold, .lk-row[data-open] > .lk-fold, .lk-list-head .lk-fold { opacity: 1; }
.lk-row[data-open] > .lk-fold svg, [aria-expanded="true"] > .lk-fold svg { transform: rotate(90deg); }
.lk-fold:hover { color: var(--lk-text); }
.lk-line { display: flex; align-items: flex-start; gap: 4px; padding: 2px 6px 2px 0; border-radius: 6px; line-height: 24px; cursor: default; }
.lk-line:focus-visible { outline: none; background: var(--lk-wash); }
.lk-bul { flex: none; width: 16px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
.lk-bul::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--lk-line); }
.lk-status { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 24px; padding: 0; border: 0; background: none; color: var(--lk-quiet); cursor: pointer; }
.lk-words { min-width: 0; overflow-wrap: anywhere; }
.lk-words a.lk-node, .lk-words a.lk-url { color: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-words a.lk-url::after { content: "\\2197"; display: inline-block; margin-left: .2em; color: var(--lk-quiet); text-decoration: none; }
.lk-tag { font-family: var(--lk-tag-face); font-style: normal; color: var(--lk-quiet); text-decoration: none; }
a.lk-tag { cursor: pointer; }
.lk-none, .lk-off { color: var(--lk-off); }`;
})();
