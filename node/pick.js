/* NODE: nodes picked in a list, and what is done to several at once.
   Pick nodes, in a list's View, draws a tick box before each of its nodes and one on the head for all of them; Space picks the
   node the keyboard is on. With nodes picked a bar stands at the top of their list: how many, a × that lets them go, Open in
   sidebar, Set tag, Set property, More (Select all, Clear a property, and for a property's list Take out this page and Change
   this page; for mentions, Make it…) and Delete, which asks first. What was done is said on one line with an Undo that takes
   every step of it back through Logseq's own Undo. Picking ends with Escape, the ×, or an action done.
     G.pick.bar(state, box, made)     the bar of a list, kept true
     G.pick.act(state, event)         a press on a tick box or the bar; true when taken
     G.pick.value(at, prop, take)     a value asked for, by the property's kind: take(write) is given a function that writes it on one node */
(function () {
const G = window.PluginDoor;
const icon = (name, size = 14) => G.touch.icon(name, size);
const refused = what => error => G.say(`${what}: ${error?.message || 'Logseq refused'}`, 'warning');
const nodes = n => `${n} ${n === 1 ? 'node' : 'nodes'}`;
// Every write of one action, one node after another; then picking ends and one line says what was done.
async function run(state, box, uuids, words, each) {
  const key = box.lkList.key, view = state.view;
  let steps = 0, done = 0;
  box.dataset.busy = '1';
  try { for (const uuid of uuids) { steps += Number(await each(uuid)) || 0; done++; } }
  catch (error) { refused(`It stopped after ${nodes(done)}`)(error); }
  delete box.dataset.busy;
  view.picking.delete(key); view.picked.delete(key);
  view.did = done ? { key, words: words(done), steps } : null;
  state.again();
}
// A node asked for, among the nodes a property takes: the ones under its tags (every tagged node where it names none), narrowed
// by typing; a name no node has is offered as a new page, with the property's tag when it takes exactly one.
async function askNode(at, prop, take) {
  const tags = await G.read.tags(), range = (prop.range || []).filter(id => tags.has(id));
  const under = range.length ? [...new Set(range.flatMap(id => [...G.tags.under(id, tags)]))] : [...tags.keys()];
  const found = (await G.read.tagged(under)).sort((a, b) => String(a.words).localeCompare(String(b.words))).slice(0, 400);
  const names = await G.read.names(found.flatMap(node => G.words.named(G.words.firstLine(node.words).line)));
  G.menu(at, found.map(node => ({ word: G.words.plain(G.words.firstLine(node.words).line, names), value: node.tag, take: () => take(node.id, node) })), { find: `A node for ${prop.title}`,
    make: words => ({ word: `New option: ${words}`, take: async () => { try { const uuid = await G.write.newPage(words, range.length === 1 ? tags.get(range[0]).uuid : ''); const made = await G.read.node(uuid); if (made) take(made.id, made); } catch (error) { refused('The page could not be made')(error); } } }) });
}
// A value asked for, by the property's kind. take(write) is handed write(uuid): the value written on one node, answering how many
// steps of Logseq's Undo it took.
function value(at, prop, take) {
  const type = prop.type || 'default';
  if (type === 'node') return void askNode(at, prop, id => take(async uuid => { await G.write.setNode(uuid, prop.ident, id); return 1; }));
  if (type === 'checkbox') return void G.menu(at, [true, false].map(yes => ({ word: yes ? 'Yes' : 'No', take: () => take(async uuid => { await G.write.setText(uuid, prop.ident, yes); return 1; }) })));
  if (type === 'date') {
    const today = G.days.number(new Date()), next = new Date(); next.setDate(next.getDate() + 1);
    const on = day => take(async uuid => { await G.write.setDay(uuid, prop.ident, day); return 1; });
    return void G.menu(at, [{ word: 'Today', take: () => on(today) }, { word: 'Tomorrow', take: () => on(G.days.number(next)) }], { find: 'A day: Oct 7, 2026-10-07',
      enter: words => { const day = G.view.dayIn(words, 99991231); if (day) on(day); else G.say(`“${words}” is not a day I can read. Try Oct 7 or 2026-10-07.`, 'warning'); } });
  }
  G.menu(at, [], { find: `${type === 'number' ? 'A number' : type === 'url' ? 'An address' : 'Words'} for ${prop.title}`, enter: words => {
    const written = type === 'number' ? Number(words) : words;
    if (type === 'number' && !Number.isFinite(written)) { G.say(`“${words}” is not a number.`, 'warning'); return; }
    take(async uuid => { await G.write.setText(uuid, prop.ident, written); return 1; });
  } });
}
async function askProperty(at, title, take, only = null) {
  const { props } = await G.read.schema();
  const all = [...props.values()].filter(prop => !only || only.has(prop.title)).sort((a, b) => a.title.localeCompare(b.title));
  G.menu(at, [{ group: title }, ...all.map(prop => ({ word: prop.title, face: 'prop', take: () => take(prop) }))], { find: 'A property' });
}
async function askTag(at, title, take) {
  const tags = await G.read.tags();
  G.menu(at, [{ group: title }, ...G.tags.tree(tags).map(({ tag, depth }) => ({ word: tag.title, depth, face: 'tag', take: () => take(tag) }))], { find: 'A tag' });
}
// This page taken out of what a node holds under the list's property; with another node given, that one put in its place.
async function swap(state, box, uuids, into) {
  const list = box.lkList, here = await G.read.node(state.view.uuid), { props } = await G.read.schema(), prop = props.get(list.prop.ident);
  const holders = new Map((await G.read.holders(list.prop.ident)).map(one => [one.uuid, one]));
  await run(state, box, uuids, n => into ? `${into.words || 'Another node'} put in place of this page on ${nodes(n)}` : `This page taken out of ${list.name} on ${nodes(n)}`, async uuid => {
    const kept = (holders.get(uuid)?.values || []).map(one => one.raw).filter(raw => raw !== here.id);
    await G.write.setValues(uuid, list.prop.ident, into ? [...kept, into.id] : kept, { ref: true, many: !!prop?.many });
    return kept.length || into ? 2 : 1;
  });
}
function more(state, box, at, uuids) {
  const list = box.lkList, view = state.view, key = list.key;
  const held = new Set(list.rows.filter(row => uuids.includes(row.uuid)).flatMap(row => Object.keys(row.held || {})));
  G.menu(at, [
    { word: 'Select all', icon: icon('list-check'), take: () => { view.picked.set(key, new Set([...box.querySelectorAll(':scope > .lk-rows > .lk-row:not(.lk-faint)')].map(row => row.dataset.uuid))); state.redraw(); } },
    ...(held.size ? [{ word: 'Clear a property…', icon: icon('eraser'), take: () => askProperty(at, 'Clear a property', prop => run(state, box, uuids, n => `${prop.title} cleared on ${nodes(n)}`, async uuid => { await G.write.clear(uuid, prop.ident); return 1; }), held) }] : []),
    ...(list.kind === 'property' ? [{ gap: true },
      { word: 'Take out this page', icon: icon('unlink'), take: () => swap(state, box, uuids, null).catch(refused('It could not be taken out')) },
      { word: 'Change this page…', icon: icon('replace'), take: async () => { const { props } = await G.read.schema(); askNode(at, props.get(list.prop.ident) || list.prop, (id, node) => swap(state, box, uuids, { id, words: node.words }).catch(refused('It could not be changed'))); } }] : []),
    ...(list.kind === 'mentions' ? [{ gap: true }, { word: 'Make it…', icon: icon('wand'), take: () => makeIt(state, box, at, uuids).catch(refused('The choices could not be read')) }] : []),
  ]);
}
// A mention made into something that points here: a tag, with the property of that tag that takes this page.
async function makeIt(state, box, at, uuids) {
  const here = await G.read.node(state.view.uuid), [tags, mine, { props, byTag }] = await Promise.all([G.read.tags(), G.read.tagsOf(here.id), G.read.schema()]);
  const fits = prop => prop.type === 'node' && (!prop.range.length || prop.range.some(top => mine.some(tag => G.tags.under(top, tags).has(tag))));
  const choices = [];
  for (const [tagId, idents] of byTag) { const tag = tags.get(tagId); if (tag) for (const ident of idents) { const prop = props.get(ident); if (prop && fits(prop)) choices.push({ tag, prop }); } }
  if (!choices.length) { G.say('No tag of yours has a property that takes this page.'); return; }
  G.menu(at, [{ group: 'Make it' }, ...choices.sort((a, b) => a.tag.title.localeCompare(b.tag.title)).map(({ tag, prop }) => ({ word: tag.title, face: 'tag', value: prop.title,
    take: () => run(state, box, uuids, n => `${nodes(n)} made ${tag.title}, pointing here through ${prop.title}`, async uuid => { await G.write.tag(uuid, tag.uuid); await G.write.setNode(uuid, prop.ident, here.id); return 2; }) }))], { find: 'A tag' });
}
// The bar of a list, and under it the line of what was last done there.
function bar(state, box, made) {
  const view = state.view, list = box.lkList, head = box.firstElementChild, doc = box.ownerDocument;
  let el = box.querySelector(':scope > .lk-pickbar');
  const n = made?.picked.size || 0, did = view?.did?.key === list.key ? view.did : null, asking = el?.dataset.asking === '1' && n;
  if (!made || (!n && !did)) { el?.remove(); return; }
  if (!el) { el = doc.createElement('div'); el.className = 'lk-pickbar'; head.after(el); }
  if (asking) return;
  delete el.dataset.asking;
  const html = n ? `<b class="lk-pick-n">${n}</b><button type="button" class="lk-btn lk-low lk-pick-x" data-do="clear" aria-label="Let them go" title="Let them go">${icon('x', 14)}</button>
<button type="button" class="lk-btn lk-low lk-i-side" data-do="open">Open in sidebar</button><button type="button" class="lk-btn lk-low lk-i-tag" data-do="tag">Set tag</button><button type="button" class="lk-btn lk-low lk-i-list" data-do="prop">Set property</button><button type="button" class="lk-btn lk-low" data-do="more">More</button>
<button type="button" class="lk-btn lk-low lk-pick-del lk-i-bin" data-do="delete">Delete</button>`
    : `<span class="lk-did">${G.esc(did.words)}</span><button type="button" class="lk-btn lk-low lk-i-undo" data-do="undo">Undo</button><button type="button" class="lk-btn lk-low" data-do="done" aria-label="Done" title="Done">${icon('x', 14)}</button>`;
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
  const all = head.querySelector('.lk-tick-all');
  if (all) { const shown = made.rows.length; all.checked = shown > 0 && n >= shown; all.indeterminate = n > 0 && n < shown; }
}
// Delete asks first, in the bar's own place: pages named apart from bullets, and the keyboard waits on Cancel.
function askDelete(state, box, el, uuids) {
  const rows = box.lkList.rows.filter(row => uuids.includes(row.uuid)), pages = rows.filter(row => row.isPage).length, bullets = rows.length - pages;
  const what = [pages ? `${pages} ${pages === 1 ? 'page' : 'pages'} with all ${pages === 1 ? 'its' : 'their'} bullets` : '', bullets ? `${bullets} ${bullets === 1 ? 'bullet' : 'bullets'}` : ''].filter(Boolean).join(' and ');
  el.dataset.asking = '1'; el.lkHtml = '';
  el.innerHTML = `<span class="lk-did"><b>Delete ${G.esc(what)}?</b> ${bullets ? 'A bullet is deleted for good.' : 'A page goes to Logseq’s Recycle.'}</span><button type="button" class="lk-del" data-do="delete-yes">Delete</button><button type="button" class="lk-btn" data-do="delete-no">Cancel</button>`;
  el.querySelector('[data-do="delete-no"]').focus();
}
function act(state, event) {
  const target = event.target, box = target.closest('.lk-list'), view = state.view;
  if (!view || !box || box.parentElement !== state.el || !box.lkList) return false;
  const key = box.lkList.key, picked = () => { if (!view.picked.has(key)) view.picked.set(key, new Set()); return view.picked.get(key); };
  const row = target.closest('.lk-row');
  if (event.type === 'keydown' && event.key === ' ' && row && target.matches('.lk-line') && row.parentElement.parentElement === box && G.listview.VIEWED.has(box.lkList.kind)) {
    event.preventDefault(); view.picking.add(key); const set = picked(); if (!set.delete(row.dataset.uuid)) set.add(row.dataset.uuid); state.redraw();
    box.querySelector(`.lk-row[data-uuid="${row.dataset.uuid}"] > .lk-line`)?.focus(); return true;
  }
  if (event.type === 'keydown' && event.key === 'Escape' && view.picking.has(key) && !target.closest('.lk-open') && !/^(INPUT|TEXTAREA)$/.test(target.tagName.replace('INPUT', target.type === 'checkbox' ? 'TICK' : 'INPUT'))) {
    event.preventDefault(); view.picking.delete(key); view.picked.delete(key); state.redraw(); return true;
  }
  if (event.type !== 'click') return false;
  if (target.matches('.lk-tick-all')) { const shown = [...box.querySelectorAll(':scope > .lk-rows > .lk-row:not(.lk-faint)')].map(one => one.dataset.uuid); view.picked.set(key, new Set(picked().size >= shown.length ? [] : shown)); state.redraw(); return true; }
  if (target.matches('.lk-row > .lk-tick')) { const set = picked(), uuid = row.dataset.uuid; if (!set.delete(uuid)) set.add(uuid); state.redraw(); return true; }
  const press = target.closest('.lk-pickbar [data-do]');
  if (!press) return false;
  const what = press.dataset.do, uuids = [...picked()], el = press.closest('.lk-pickbar'), spot = press.getBoundingClientRect(), at = { x: spot.left, y: spot.bottom + 4, from: press };   // where the press was: the bar may be drawn again before a list opens
  if (what === 'clear') { view.picking.delete(key); view.picked.delete(key); state.redraw(); }
  else if (what === 'done') { view.did = null; state.redraw(); }
  else if (what === 'undo') { const steps = view.did?.steps || 0; view.did = null; (async () => { for (let i = 0; i < steps; i++) { await G.write.undo(); await new Promise(done => setTimeout(done, 250)); } state.again(); })().catch(refused('It could not all be taken back')); }
  else if (what === 'open') { for (const uuid of uuids) G.touch.open(uuid, true); view.picking.delete(key); view.picked.delete(key); state.redraw(); }
  else if (what === 'tag') askTag(at, 'Set tag', tag => run(state, box, uuids, n => `${tag.title} put on ${nodes(n)}`, async uuid => { await G.write.tag(uuid, tag.uuid); return 1; })).catch(refused('The tags could not be read'));
  else if (what === 'prop') askProperty(at, 'Set property', prop => value(at, prop, write => run(state, box, uuids, n => `${prop.title} set on ${nodes(n)}`, write))).catch(refused('The properties could not be read'));
  else if (what === 'more') more(state, box, at, uuids);
  else if (what === 'delete') askDelete(state, box, el, uuids);
  else if (what === 'delete-no') { delete el.dataset.asking; state.redraw(); box.querySelector('.lk-row > .lk-line')?.focus(); }
  else if (what === 'delete-yes') { delete el.dataset.asking; const rows = new Map(box.lkList.rows.map(one => [one.uuid, one])); run(state, box, uuids, n => `${nodes(n)} deleted`, async uuid => { await G.write.remove(uuid, !!rows.get(uuid)?.isPage); return 1; }); }
  return true;
}
G.pick = { bar, act, value, askProperty, askTag, askNode };
G.pick.CSS = `
.lk-pickbar { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 4px; margin: 4px 0 6px; padding: 4px 8px; border-radius: 10px; background: var(--lk-wash); font-size: var(--lk-line-size); }
.lk-pick-n { font-size: 17px; font-weight: 600; margin: 0 2px 0 4px; font-variant-numeric: tabular-nums; }
.lk-pick-x { padding: 4px 6px !important; margin-right: 6px; }
.lk-pick-del { margin-left: auto; color: var(--lk-going); }
.lk-did { flex: 1; min-width: 0; padding: 2px 4px; }
.lk-list[data-busy] > .lk-pickbar { opacity: .5; pointer-events: none; }`;
})();
