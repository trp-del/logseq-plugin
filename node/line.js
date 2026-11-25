/* NODE: the one line any node is shown as, wherever a list shows it.
     G.line.html(node, { names, statuses, tagShown })   the line's markup: bullet, status circle if a task, words, tag, a count
                                                        at its end where the node has one (node.count), and
                                                        after them node.why: values of the node that a search matched
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
  return `<button type="button" class="lk-status" title="${G.esc(s.title)}" aria-label="Status: ${G.esc(s.title)}">${G.touch.statusIcon(s.icon) || G.esc(s.title)}</button>`;
}
function html(node, { names, statuses, tagShown }) {
  return `<span class="lk-bul" aria-hidden="true"></span>${statusHtml(node, statuses)}<span class="lk-words">${wordsHtml(node.words, names)}${tagShown && node.tag ? ` <span class="lk-tag">${G.esc(node.tag)}</span>` : ''}${(node.why || []).map(value => ` <span class="lk-why">${G.esc(value)}</span>`).join('')}${node.lacks ? ` <button type="button" class="lk-lacks" data-lacks="${G.esc(node.lacks)}" title="Give it a ${G.esc(node.lacks)}">no ${G.esc(node.lacks)}?</button>` : ''}${(node.where || []).length ? `<span class="lk-sits">${node.where.map(step => `<a class="lk-step" data-to="${G.esc(step.uuid)}">${G.esc(W.plain(step.words, names))}</a>`).join('<span class="lk-off"> › </span>')}</span>` : ''}</span>${node.count ? `<span class="lk-num">${Number(node.count)}</span>` : ''}`;
}

async function pickStatus(at, row) {
  const statuses = await G.read.statuses(), now = Number(row.dataset.status) || 0;
  G.menu(at, statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now,
    take: () => G.write.setStatus(row.dataset.uuid, s.title).catch(error => G.say(`The status could not be set: ${error?.message || 'Logseq refused'}`, 'warning')) })));
}
// The person's tags as an outline, the node's own ticked: a press puts a tag on the node or takes it off.
async function pickTags(at, row) {
  const uuid = row.dataset.uuid, node = await G.read.node(uuid);
  if (!node) return;
  const [tags, own] = await Promise.all([G.read.tags(), G.read.tagsOf(node.id)]), has = new Set(own);
  G.menu(at, [{ group: 'Tags' }, ...G.find.tree(tags).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: has.has(tag.id),
    take: () => (has.has(tag.id) ? G.write.untag(uuid, tag.uuid) : G.write.tag(uuid, tag.uuid)).catch(error => G.say(`The tag could not be changed: ${error?.message || 'Logseq refused'}`, 'warning')) }))]);
}
// A property given to a node, as Logseq's own Add property gives one to a bullet: the properties its tags give and it has not
// filled first, then every other; then the value, asked for by the property's kind.
async function addProperty(at, uuid, only = '') {
  const node = await G.read.node(uuid);
  if (!node) return;
  const [{ props, byTag }, own, held] = await Promise.all([G.read.schema(), G.read.tagsOf(node.id), G.read.held([node.id])]), has = held.get(node.id) || {};
  const write = prop => G.pick.value(at, prop, set => set(uuid).catch(error => G.say(`The value could not be written: ${error?.message || 'Logseq refused'}`, 'warning')));
  if (only) { const prop = [...props.values()].find(one => one.title === only); if (prop) write(prop); return; }
  const given = [...new Set(own.flatMap(tag => byTag.get(tag) || []))].map(ident => props.get(ident)).filter(prop => prop && !has[prop.title]), first = new Set(given.map(prop => prop.ident));
  const rest = [...props.values()].filter(prop => !first.has(prop.ident)).sort((a, b) => a.title.localeCompare(b.title));
  G.menu(at, [...(given.length ? [{ group: 'From its tags' }, ...given.map(prop => ({ word: prop.title, face: 'prop', take: () => write(prop) })), { gap: true }] : []), ...rest.map(prop => ({ word: prop.title, face: 'prop', value: has[prop.title] ? 'has one' : '', take: () => write(prop) }))], { find: 'A property' });
}
// A new line at the end of what a node keeps: the node opens in place and the caret stands in the new line.
async function addLine(row) {
  try {
    const made = String(await G.write.addLine(row.dataset.uuid, row.dataset.page === '1') || '').toLowerCase();
    if (!row.dataset.open) G.node.open(row);
    const page = row.querySelector(':scope > .lk-open > .lk-editor');
    if (page && made) G.touch.editor.whole(page, () => G.touch.edit(made));
  } catch (error) { G.say(`The line could not be added: ${error?.message || 'Logseq refused'}`, 'warning'); }
}
async function menu(at, row, more) {
  const uuid = row.dataset.uuid, statuses = row.dataset.status ? await G.read.statuses() : [], now = Number(row.dataset.status) || 0;
  G.menu(at, [
    { word: 'Open', icon: G.touch.icon('arrow-right'), take: () => G.touch.open(uuid) },
    { word: 'Open in sidebar', icon: G.touch.icon('layout-sidebar-right'), take: () => G.touch.open(uuid, true) },
    ...(row.dataset.page === '1' ? [] : [{ word: 'Go to its page', icon: G.touch.icon('file'), take: async () => { const node = await G.read.node(uuid), at = node && (await G.read.where([node.id])).get(node.id); if (at?.[0]) G.touch.open(at[0].uuid); } }]),
    ...(row.closest('.lk-list')?.dataset.face ? [] : [{ gap: true }, { word: 'Tags…', icon: G.touch.icon('hash'), take: () => pickTags(at, row) }]),   // not on a tag or a property itself
    ...(statuses.length ? [{ gap: true }, { group: 'Status' }, ...statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now, take: () => G.write.setStatus(uuid, s.title).catch(error => G.say(`The status could not be set: ${error?.message || 'Logseq refused'}`, 'warning')) }))] : []),
    ...(row.closest('.lk-list')?.dataset.face ? [] : [{ gap: true },
      { word: 'Add property…', icon: G.touch.icon('plus'), take: () => addProperty(at, uuid) },
      { word: 'Add a line', icon: G.touch.icon('corner-down-right'), take: () => addLine(row) }]),
    ...((more && more(row, at)) || []),   // what the place itself offers for this row
    { gap: true },
    { word: 'Delete', icon: G.touch.icon('trash'), take: () => G.write.remove(uuid, row.dataset.page === '1').catch(error => G.say(`It could not be deleted: ${error?.message || 'Logseq refused'}`, 'warning')) },
  ]);
}
// A press or a key on a closed line. The list calls this for every event in it; true says the line took it.
function act(event, row, more) {
  const target = event.target, line = target.closest('.lk-line');
  if (event.type === 'contextmenu') { if (!line) return false; event.preventDefault(); menu({ x: event.clientX, y: event.clientY, from: line }, row, more); return true; }
  if (event.type === 'click') {
    const status = target.closest('.lk-status');
    if (status && line) { pickStatus(status, row); return true; }
    const lacks = target.closest('.lk-lacks');
    if (lacks && line) { const spot = lacks.getBoundingClientRect(); addProperty({ x: spot.left, y: spot.bottom + 4, from: line }, row.dataset.uuid, lacks.dataset.lacks); return true; }
    const link = target.closest('a[data-to]');
    if (link && line) { G.touch.open(link.dataset.to, event.shiftKey); return true; }
    const url = target.closest('.lk-url');
    if (url && line) { G.touch.openUrl(url.dataset.href); return true; }
    if (target.closest('.lk-fold') && target.closest('.lk-row') === row) { G.node.toggle(row); return true; }
    if (line) { if (event.shiftKey) G.touch.open(row.dataset.uuid, true); else G.node.toggle(row); return true; }
    return false;
  }
  if (event.type === 'keydown' && line && target === line) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (event.shiftKey) G.touch.open(row.dataset.uuid, true); else G.node.toggle(row); return true; }
    if (event.key === 'ArrowRight' && !row.dataset.open) { event.preventDefault(); G.node.open(row); return true; }   // Right opens in place, Left closes
    if (event.key === 'ArrowLeft' && row.dataset.open) { event.preventDefault(); G.node.close(row, true); return true; }
  }
  return false;
}
G.line = { html, act, menu, addProperty };
G.line.CSS = `
.lk-row { display: grid; grid-template-columns: var(--lk-daycol, 0px) 18px minmax(0, 1fr); align-items: start; padding-left: calc(var(--lk-depth, 0) * 18px); }
.lk-row > .lk-day { grid-column: 1; overflow: hidden; white-space: nowrap; font-size: var(--lk-small); color: var(--lk-off); font-variant-numeric: tabular-nums; line-height: 24px; padding-top: 2px; }
.lk-row > .lk-fold { grid-column: 2; position: relative; z-index: 1; }   /* above the opened node, whose own margin reaches under it */
.lk-row > .lk-line, .lk-row > .lk-open { grid-column: 3; min-width: 0; }
.lk-row[data-open="1"] > .lk-line { display: none; }
.lk-row[data-open="soon"] > .lk-open { height: 0; overflow: hidden; visibility: hidden; }   /* Logseq is still filling it in: the line stays until it is whole */
.lk-fold { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 24px; margin-top: 2px; padding: 0; border: 0; background: none; color: var(--lk-off); cursor: pointer; opacity: 0; }
.lk-fold svg { width: 14px; height: 14px; transition: transform .12s ease; }
.lk-row:hover > .lk-fold, .lk-row:focus-within > .lk-fold, .lk-row[data-open] > .lk-fold, .lk-list-head .lk-fold { opacity: 1; }
.lk-row[data-open] > .lk-fold svg, [aria-expanded="true"] > .lk-fold svg { transform: rotate(90deg); }
.lk-fold:hover { color: var(--lk-text); }
.lk-line { display: flex; align-items: flex-start; gap: 4px; padding: 2px 6px 2px 0; border-radius: 6px; line-height: 24px; cursor: default; }
.lk-line:focus-visible { outline: none; background: var(--lk-wash); }
.lk-bul { flex: none; width: 16px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
.lk-bul::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--lk-line); }
.lk-status-icon { display: inline-flex; }
.lk-status { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 24px; padding: 0; border: 0; background: none; color: var(--lk-quiet); cursor: pointer; }
.lk-words { min-width: 0; overflow-wrap: anywhere; }
.lk-words a.lk-node, .lk-words a.lk-url { color: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-words a.lk-url::after { content: "\\2197"; display: inline-block; margin-left: .2em; color: var(--lk-quiet); text-decoration: none; }
.lk-tag { font-family: var(--lk-tag-face); font-style: normal; color: var(--lk-quiet); text-decoration: none; }
a.lk-tag { cursor: pointer; }
.lk-none, .lk-off { color: var(--lk-off); }
.lk-why { color: var(--lk-quiet); font-size: var(--lk-small); margin-left: .35em; }
.lk-lacks { appearance: none; border: 0; background: none; padding: 0; margin-left: .35em; font: inherit; font-size: var(--lk-small); color: var(--lk-off); cursor: pointer; }
.lk-lacks:hover, .lk-lacks:focus-visible { color: var(--lk-text); outline: none; }
.lk-sits { display: block; font-size: var(--lk-small); line-height: 18px; color: var(--lk-off); margin: -2px 0 2px; }
.lk-sits a.lk-step { color: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-hair); text-underline-offset: 3px; }
.lk-sits a.lk-step:hover { color: var(--lk-text); }
.lk-num { flex: none; margin-left: auto; padding-left: 12px; font-size: var(--lk-small); color: var(--lk-off); font-variant-numeric: tabular-nums; }
/* In a narrow place (the sidebar) the words get the whole width: the day stands under them, an outline steps in less, and an
   opened node takes the width of the list. */
@container lk-list (max-width: 300px) {
  .lk-row { grid-template-columns: 18px minmax(0, 1fr); padding-left: calc(var(--lk-depth, 0) * 12px); }
  .lk-row > .lk-fold { grid-column: 1; grid-row: 1; }
  .lk-row > .lk-line, .lk-row > .lk-open { grid-column: 2; grid-row: 1; }
  .lk-row > .lk-day { grid-column: 2; grid-row: 2; padding: 0 0 4px 20px; margin-top: -3px; line-height: 16px; font-size: var(--lk-label); }
  .lk-row[data-status]:not([data-status=""]) > .lk-day { padding-left: 44px; }
  .lk-row > .lk-day:empty, .lk-row[data-open="1"] > .lk-day { display: none; }
  .lk-row[data-open="1"] { padding-left: 0; }
  .lk-more { margin-left: 34px; }
  .lk-open > .lk-rel { margin-left: 8px; }
}`;
})();
