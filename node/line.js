/* NODE: the one line any node is shown as, wherever a list shows it.
     G.line.html(node, { names, statuses, tagShown, day })   (day: words for the day, drawn after the bullet as Relations has it)
     G.line.html(node, { names, statuses, tagShown })   the line's markup: bullet, status circle if a task, words, tag, a count
                                                        at its end where the node has one (node.count), and
                                                        after them node.why: values of the node that a search matched
     G.line.act(event, row)                             what a press or a key on a line does; true when it took the event
     G.line.menu(at, row, more)                         the line's right-click menu (a table's row too, node/table.js)
     G.line.pickTags(at, uuid, typing)                  the tags as an outline, the node's own ticked
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
function html(node, { names, statuses, tagShown, day }) {
  return `<span class="lk-bul${node.holds ? ' lk-folded' : ''}" aria-hidden="true"></span>${day == null ? '' : `<span class="lk-dayin">${G.esc(day)}</span>`}${statusHtml(node, statuses)}<span class="lk-words">${wordsHtml(node.words, names)}${tagShown && node.tag ? `\u2002<span class="lk-tag">${G.esc(node.tag)}</span>` : ''}${(node.why || []).map(value => ` <span class="lk-why">${G.esc(value)}</span>`).join('')}${node.tell ? `\u2004<span class="lk-tell">${G.esc(node.tell)}</span>` : ''}${node.lacks ? `\u2004<button type="button" class="lk-lacks" data-lacks="${G.esc(node.lacks)}" title="Give it a ${G.esc(node.lacks)}">no ${G.esc(node.lacks)}?</button>` : ''}${(node.where || []).length ? `<span class="lk-sits">${node.where.map(step => `<a class="lk-step" data-to="${G.esc(step.uuid)}">${G.esc(step.day ? G.days.short(step.day) : W.plain(step.words, names))}</a>`).join('<span class="lk-off"> › </span>')}</span>` : ''}</span>${node.count ? `<span class="lk-num">${Number(node.count)}</span>` : ''}`;
}

const ended = status => /^(done|canceled|cancelled)$/.test(status.name);
// A line's circle shows a status at once, ahead of the graph telling of it; lkDone says when it showed a task finished.
function mark(row, status) {
  const line = row.querySelector(':scope > .lk-line'), circle = line?.querySelector(':scope > .lk-status');
  if (!circle) return;
  circle.innerHTML = G.touch.statusIcon(status.icon) || G.esc(status.title); circle.title = status.title; circle.setAttribute('aria-label', `Status: ${status.title}`);
  line.lkHtml = null;   // drawn again from the graph at the next reading
  row.lkDone = ended(status) ? Date.now() : 0;
}
function setStatus(row, status) {
  mark(row, status);
  G.undo.after(row.dataset.uuid, G.write.setStatus(row.dataset.uuid, status.title)).catch(error => { G.say(`The status could not be set: ${error?.message || 'Logseq refused'}`, 'warning'); row.dispatchEvent(new (row.ownerDocument.defaultView.CustomEvent)('lk-closed', { bubbles: true })); });
}
async function pickStatus(at, row) {
  const statuses = await G.read.statuses(), now = Number(row.dataset.status) || 0;
  G.menu(at, statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now,
    take: () => setStatus(row, s) })));
}
// The person's tags as an outline, the node's own ticked: a press puts a tag on the node or takes it off.
// typing: the list has a line to type in, and words no tag has make a new one, as Logseq's own list of tags does.
async function pickTags(at, uuid, typing = false) {
  const node = await G.read.node(uuid), failed = error => G.say(`The tag could not be changed: ${error?.message || 'Logseq refused'}`, 'warning');
  if (!node) return;
  const [tags, own] = await Promise.all([G.read.tags(), G.read.tagsOf(node.id)]), has = new Set(own);
  G.menu(at, [{ group: 'Tags' }, ...G.tags.tree(tags).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', on: has.has(tag.id),
    take: () => G.undo.after(uuid, has.has(tag.id) ? G.write.untag(uuid, tag.uuid) : G.write.tag(uuid, tag.uuid)).catch(failed) }))],
  typing ? { find: 'Set Tags', make: words => ({ word: `New tag: ${words}`, take: () => G.undo.after(uuid, G.write.newTag(words).then(made => G.write.tag(uuid, made))).catch(failed) }) } : {});
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
  const uuid = row.dataset.uuid, statuses = row.dataset.status ? await G.read.statuses() : [], now = Number(row.dataset.status) || 0, face = row.closest('.lk-list, .lk-table')?.dataset.face || '';
  G.menu(at, [
    { word: 'Open', take: () => G.touch.open(uuid) },
    { word: 'Open in sidebar', take: () => G.touch.open(uuid, true) },
    ...(face ? [] : [{ gap: true }, { word: 'Tags…', take: () => pickTags(at, row.dataset.uuid) }]),   // not on a tag or a property itself
    ...(statuses.length ? [{ gap: true }, { group: 'Status' }, ...statuses.map(s => ({ word: s.title, icon: G.touch.statusIcon(s.icon), on: s.id === now, take: () => setStatus(row, s) }))] : []),
    ...((more && more(row, at)) || []),   // what the place itself offers for this row
    { gap: true },
    { word: face ? 'Delete…' : 'Delete', goes: true, take: () => {
      // A tag and a property are pages. Logseq does not always tell of a page that went, so the list is asked to read again.
      const del = async () => { await G.undo.after(uuid, G.write.remove(uuid, !!face || row.dataset.page === '1')); row.dispatchEvent(new (row.ownerDocument.defaultView.CustomEvent)('lk-closed', { bubbles: true })); };
      if (!face) return void del().catch(error => G.say(`It could not be deleted: ${error?.message || 'Logseq refused'}`, 'warning'));
      // A tag or a property reaches every node that holds it: the question first, in red.
      const name = row.querySelector('.lk-words')?.textContent.trim() || 'this', held = Number(row.querySelector('.lk-num')?.textContent || row.dataset.held) || 0, kind = face === 'tag' ? 'tag' : 'property';
      G.ask.gone(row, { words: `Delete the ${kind} “${name}”?`, note: held ? `${held} ${held === 1 ? 'node holds' : 'nodes hold'} it. It is taken off every one of them.` : 'It is taken off every node that holds it.', yes: `Delete the ${kind}`, take: del });
    } },
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
    // The bullet goes to its node, as Logseq's own does; in an open row of Relations it is the dot the row draws.
    const box = target === row && row.dataset.open ? row.getBoundingClientRect() : null;
    if ((line && target.closest('.lk-bul')) || (box && event.clientY - box.top < 28 && event.clientX - box.left >= 16 && event.clientX - box.left <= 36)) { G.touch.open(row.dataset.uuid, event.shiftKey); return true; }
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
G.line = { html, act, menu, mark, ended, addProperty, pickTags };
G.line.CSS = `
/* A row: its day, the fold arrow, the line. A list of Relations says the day inside the line, after the bullet (lk-dayin), and
   keeps no column for it. A list whose day stands at the right end says so on its box (lk-day-end; each list's menu puts the
   day there or in front); the line then reaches under the day, so its wash holds both. A day that has passed is red. */
.lk-row { display: grid; grid-template-columns: var(--lk-daycol, 0px) 18px minmax(0, 1fr); align-items: start; padding-left: calc(var(--lk-depth, 0) * 18px); }
.lk-row > .lk-day { grid-column: 1; overflow: hidden; white-space: nowrap; font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; line-height: 24px; padding-top: 2px; }
.lk-row > .lk-day.lk-late { color: var(--lk-going); }
.lk-row > .lk-fold { grid-column: 2; position: relative; z-index: 1; }   /* above the opened node, whose own margin reaches under it */
.lk-row > .lk-line, .lk-row > .lk-open { grid-column: 3; min-width: 0; }
.lk-day-end > :where(.lk-rows) > .lk-row { grid-template-columns: 18px minmax(0, 1fr) var(--lk-daycol, 0px); }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-fold { grid-column: 1; grid-row: 1; }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-day { grid-column: 3; grid-row: 1; z-index: 1; text-align: right; padding: 2px 6px 0 0; align-self: baseline; }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-day.lk-late { color: var(--lk-going); }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-day:empty, .lk-day-end > :where(.lk-rows) > .lk-row[data-open="1"] > .lk-day { display: none; }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-line { grid-column: 2 / -1; grid-row: 1; align-self: baseline; padding-right: calc(var(--lk-daycol, 0px) + 6px); }
.lk-day-end > :where(.lk-rows) > .lk-row > .lk-open { grid-column: 2 / -1; }
.lk-row[data-open="1"] > .lk-line { display: none; }
.lk-row[data-open="soon"] > .lk-open { height: 0; overflow: hidden; visibility: hidden; }   /* Logseq is still filling it in: the line stays until it is whole */
.lk-fold { display: inline-flex; align-items: center; justify-content: center; width: var(--lk-mark-box); height: 24px; margin-top: 2px; padding: 0; border: 0; background: none; color: var(--lk-off); cursor: pointer; opacity: 0; }
.lk-fold svg { width: 14px; height: 14px; transition: transform .12s ease; }
.lk-row:hover > .lk-fold, .lk-row:has(:focus-visible) > .lk-fold, .lk-row[data-open] > .lk-fold, .lk-list-head .lk-fold { opacity: 1; }
.lk-row[data-open] > .lk-fold svg, [aria-expanded="true"] > .lk-fold svg { transform: rotate(90deg); }
.lk-fold:hover { color: var(--lk-text); }
.lk-line { display: flex; align-items: baseline; gap: 4px; padding: 2px 6px 2px 0; border-radius: var(--lk-corner); line-height: 24px; cursor: default; }
.lk-line > :is(.lk-bul, .lk-status) { align-self: flex-start; }   /* the marks keep the line's first 24, the words and the day stand on one baseline */
.lk-line:focus-visible { outline: none; background: var(--lk-wash); }
.lk-line > .lk-bul { cursor: pointer; }
.lk-line > .lk-bul:hover::before { opacity: 1; box-shadow: 0 0 0 4.8px var(--lk-bullet-ring); }   /* it goes to its node, as Logseq's own */
.lk-bul { flex: none; width: 16px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
.lk-bul::before { content: ""; width: 6.4px; height: 6.4px; border-radius: 50%; background: var(--lk-bullet); opacity: .8; }
.lk-bul.lk-folded::before { box-shadow: 0 0 0 4.8px var(--lk-bullet-ring); }   /* it holds lines: the ring Logseq puts round a folded bullet, 16 across (the owner, 26 November 2026: the bullet as before 0.9) */
.lk-status-icon { display: inline-flex; }
.lk-status-icon > .ti { font-size: 18px; line-height: 1; }   /* an icon picked in Logseq comes from its icon font, sized as text: the circles' 18 (27 November 2026: "Errorrs with size") */
/* A task carries one mark before its words, its status circle, standing where the bullet stands; its words keep the edge of every other line. */
.lk-status { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 24px; padding: 0; border: 0; background: none; color: var(--lk-quiet); cursor: pointer; }
.lk-words { min-width: 0; overflow-wrap: anywhere; }
.lk-words a.lk-node, .lk-words a.lk-url { color: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width); text-underline-offset: 3px; }
.lk-words a:is(.lk-node, .lk-url):hover { text-decoration-color: currentColor; }
.lk-words a.lk-url::after { content: "\\2197"; display: inline-block; margin-left: .2em; color: var(--lk-quiet); text-decoration: none; }
.lk-tag { font-family: var(--lk-tag-face); font-size: var(--lk-tag-size); font-style: normal; color: var(--lk-quiet); text-decoration: none; }
a.lk-tag { cursor: pointer; }
a.lk-tag:hover { color: var(--lk-text); }
.lk-none { color: var(--lk-quiet); }
.lk-off { color: var(--lk-off); }
/* A tick box on a line shows under the pointer or the keyboard, and stays once ticked (the owner, 25 November 2026). */
.lk-line > input.lk-tick { align-self: center; margin-right: 2px; opacity: 0; }
.lk-row:is(:hover, :focus-within) > .lk-line > input.lk-tick, .lk-line > input.lk-tick:checked { opacity: 1; }
.lk-why { color: var(--lk-quiet); font-size: var(--lk-small); margin-left: .35em; }
.lk-tell { color: var(--lk-quiet); font-size: var(--lk-small); white-space: nowrap; }   /* kept whole: the wide space before it is where the line breaks */
.lk-dayin { flex: none; line-height: 1; width: var(--lk-dayin, 54px); margin: 0 2px 0 6px; overflow: hidden; white-space: nowrap; font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; }
/* The tag and the value said after the words are set apart by a wide space, not a margin, so where one wraps to a line of its
   own it starts on the words' edge. */
/* A run in another face or size inside the words (a tag, a value said after them, "no Topic?"), and the day and the count
   beside them, keep to the words' own line: they take no more height than the words do, so every row is one height. */
.lk-words :is(.lk-tag, .lk-why, .lk-tell, .lk-lacks) { line-height: 1; }
.lk-lacks { appearance: none; border: 0; background: none; padding: 0; font: inherit; font-size: var(--lk-small); white-space: nowrap; text-align: start; color: var(--lk-off); cursor: pointer; }
.lk-lacks:hover, .lk-lacks:focus-visible { color: var(--lk-text); outline: none; }
.lk-sits { display: block; font-size: var(--lk-small); line-height: 18px; color: var(--lk-quiet); margin: -2px 0 2px; }
.lk-sits a.lk-step { color: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: var(--lk-hair); text-underline-offset: 3px; }
.lk-sits a.lk-step:hover { color: var(--lk-text); text-decoration-color: var(--lk-line); }
.lk-num { flex: none; line-height: 1; margin-left: auto; padding-left: 12px; font-size: var(--lk-small); color: var(--lk-off); font-variant-numeric: tabular-nums; }
/* In a narrow place (the sidebar) an outline steps in less, and an opened node takes the width of the list. A day put at the
   beginning of the line stays there, and gives up its room while the node is open. */
@container lk-list (max-width: 300px) {
  .lk-row { padding-left: calc(var(--lk-depth, 0) * 12px); }
  .lk-row[data-open="1"] { grid-template-columns: 0 18px minmax(0, 1fr); }
  .lk-row > .lk-day:empty, .lk-row[data-open="1"] > .lk-day { display: none; }
  /* Where the day stands at the right end it stays there, narrow or not. */
  .lk-day-end > :where(.lk-rows) > .lk-row { grid-template-columns: 18px minmax(0, 1fr) var(--lk-daycol, 0px); }
  .lk-day-end > :where(.lk-rows) > .lk-row > .lk-line { grid-column: 2 / -1; padding-right: calc(var(--lk-daycol, 0px) + 6px); }
  .lk-day-end > :where(.lk-rows) > .lk-row.lk-row > .lk-day.lk-day { grid-column: 3; grid-row: 1; padding: 2px 6px 0 0; margin-top: 0; line-height: 24px; font-size: var(--lk-small); }   /* said twice over, past the rule that steps a task's day in under its circle */
  .lk-row[data-open="1"] { padding-left: 0; }
  .lk-more { margin-left: calc(18px + var(--lk-mark-box) + var(--lk-mark-gap)); }
  .lk-open > .lk-rel { margin-left: 8px; }
}`;
})();
