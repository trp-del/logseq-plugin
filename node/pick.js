/* NODE: nodes picked in a list, and what is done to several at once.
   Pick nodes, in a list's View, draws a tick box before each of its nodes and one on the head for all of them; Space picks the
   node the keyboard is on. With nodes picked a bar stands at the top of their list: how many, a × that lets them go, Open in
   sidebar, Set tag, Set property, More (Select all, Clear a property, and for a property's list Take out this page and Change
   this page; for mentions, Make it…) and Delete, which asks first. What was done is said on one line with an Undo, which is
   the Undo arrow's own (node/undo.js): it takes back the steps that were made, and goes at the next change to the graph as
   the arrow does. Picking ends with Escape, the ×, or an action done.
     G.pick.bar(state, box, made)     the bar of a list, kept true
     G.pick.act(state, event)         a press on a tick box or the bar; true when taken
     G.pick.value(at, prop, take)     a value asked for, by the property's kind: its set choices where it has them, a node, yes or
                                      no, a day, a day and a time, a number, words. take(write, before) is given write(uuid),
                                      which writes it on one node and answers the steps of Undo that took, and before: the steps
                                      already made while asking (a new option's page) */
(function () {
const G = window.PluginDoor;
const icon = (name, size = 14) => G.touch.icon(name, size);
const refused = what => error => G.write.refused(what, error);
const nodes = n => `${n} ${n === 1 ? 'node' : 'nodes'}`;
const tagged = (list, id) => new Set(list.rows.filter(row => (row.tags || []).some(tag => tag.id === id)).map(row => row.uuid));   // the rows that hold a tag already
/* Every write of one action, one node after another; then picking ends and one line says what was done. each(uuid, did) answers
   the steps of Undo it made on that node, or calls did() after each step where a later one may be refused, so a node left
   halfway is counted as far as it got. The way back is handed to the Undo arrow's own piece with exactly those steps. */
async function run(state, box, uuids, words, each, before = 0, whole = true) {   // whole: false where Undo would not bring back all that went (no Undo is offered then)
  const key = box.lkList.key, view = state.view;
  let steps = Number(before) || 0, done = 0;
  const did = (n = 1) => { steps += n; };
  box.dataset.busy = '1';
  try { for (const uuid of uuids) { const made = await each(uuid, did); if (typeof made === 'number') steps += made; done++; } }
  catch (error) { steps += Number(error?.steps) || 0; refused(`It stopped after ${nodes(done)}`)(error); }   // a refusal says the steps it left standing (a journal page made for a day)
  delete box.dataset.busy;
  view.picking.delete(key); view.picked.delete(key);
  const said = done || steps ? { key, words: words(done), way: null } : null;
  if (said && whole) said.way = G.undo.hold(steps, () => { if (view.did === said) { said.way = null; state.redraw(); } });   // the Undo goes when the arrow would
  else if (said && steps) G.undo.clear();   // nor an older arrow left standing over what cannot be brought back
  view.did = said;
  state.again();
}
/* A node asked for, among the nodes a property takes: the ones under its tags (every tagged node where it names none). The list
   opens with the first of them by name; what is typed narrows it and looks through all the others too, so every node is found
   by its name, however many there are. A name none of them has is offered as a new option: a page of that name, with the
   property's tag when it takes exactly one. take(id, node, before): before, the steps of Undo making that page took. */
const FIRST = 400;
async function askNode(at, prop, take) {
  const W = G.words, tags = await G.read.tags(), range = (prop.range || []).filter(id => tags.has(id));
  const under = range.length ? [...new Set(range.flatMap(id => [...G.tags.under(id, tags)]))] : [...tags.keys()];
  const found = await G.read.tagged(under), names = await G.read.names(found.flatMap(node => W.named(W.firstLine(node.words).line)));
  const all = found.map(node => { const word = W.plain(W.firstLine(node.words).line, names); return { node, word, low: `${word} ${node.tag || ''}`.toLowerCase() }; }).sort((a, b) => a.word.localeCompare(b.word));
  const line = one => ({ word: one.word, value: one.node.tag, take: () => take(one.node.id, one.node, 0) }), rest = all.slice(FIRST);
  const has = words => { const low = words.trim().toLowerCase(); return all.some(one => one.word.trim().toLowerCase() === low); };
  G.menu(at, all.slice(0, FIRST).map(line), { find: `A node for ${prop.title}`,
    ...(rest.length ? { searchName: '', search: async words => { const want = words.toLowerCase().split(/\s+/).filter(Boolean); return rest.filter(one => want.every(word => one.low.includes(word))).slice(0, 60).map(line); } } : {}),
    make: words => has(words) ? null : ({ word: `New option: ${words}`, take: async () => {
      const tag = range.length === 1 ? tags.get(range[0]).uuid : '';
      try {
        const there = await G.read.pageNamed(words), uuid = await G.write.newPage(words, tag), made = await G.read.node(uuid);   // a page of that name already there is taken, never made twice
        if (made) take(made.id, { ...made, words }, (there && !there.gone ? 0 : 1) + (tag ? 1 : 0));
      } catch (error) { refused('The page could not be made')(error); }
    } }) });
}
/* A day and a time typed: a day as G.days.typed reads one, then a time with a colon or am/pm ("Oct 7 14:30", "2026-10-07 09:00",
   "tomorrow 9am"). A day alone is that day's start, as Logseq's own date picker writes one. Answers the time in milliseconds; 0
   for what cannot be read. */
function dayTime(words) {
  const text = String(words || '').trim(), m = text.match(/^(.*?)[\s,]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i), timed = !!m && (m[3] != null || !!m[4]);
  const day = G.days.typed(timed ? m[1] : text);
  if (!day) return 0;
  let hour = timed ? Number(m[2]) : 0; const minute = timed && m[3] ? Number(m[3]) : 0;
  if (timed && m[4]) { if (hour < 1 || hour > 12) return 0; hour = hour % 12 + (/pm/i.test(m[4]) ? 12 : 0); }
  if (hour > 23 || minute > 59) return 0;
  const at = G.days.toDate(day); at.setHours(hour, minute, 0, 0);
  return at.getTime();
}
// A value asked for, by the property's kind. take(write, before) is handed write(uuid): the value written on one node, answering
// how many steps of Logseq's Undo it took.
async function value(at, prop, take) {
  const type = prop.type || 'default', one = write => take(async uuid => { await write(uuid); return 1; }, 0);
  // A property with set choices offers its choices, as Logseq's own list does: a choice is written by its id.
  const choices = type === 'checkbox' || type === 'node' ? [] : ((await G.read.choices()).get(prop.ident) || []);
  if (choices.length) return void G.menu(at, choices.map(choice => ({ word: String(choice.text), take: () => one(uuid => G.write.setNode(uuid, prop.ident, choice.raw)) })), { find: `A choice for ${prop.title}` });
  if (type === 'node') return void askNode(at, prop, (id, node, before = 0) => take(async uuid => { await G.write.setNode(uuid, prop.ident, id); return 1; }, before));
  if (type === 'checkbox') return void G.menu(at, [true, false].map(yes => ({ word: yes ? 'Yes' : 'No', take: () => one(uuid => G.write.setText(uuid, prop.ident, yes)) })));
  if (type === 'date') {
    // setDay answers its steps: 2 where the day's journal page had to be made first, so the Undo takes the page back as well.
    const today = G.days.number(new Date()), on = day => take(async uuid => { const made = await G.write.setDay(uuid, prop.ident, day); return typeof made === 'number' ? made : 1; }, 0);
    return void G.menu(at, [{ word: 'Today', take: () => on(today) }, { word: 'Tomorrow', take: () => on(G.days.shift(today, 1)) }], { find: 'A day: Oct 7, 2026-10-07',
      enter: words => { const day = G.days.typed(words); if (day) on(day); else G.say(`“${words}” is not a day I can read. Try Oct 7 or 2026-10-07.`, 'warning'); } });   // a year left out is this year's
  }
  if (type === 'datetime') return void G.menu(at, [], { find: 'A day and a time: Oct 7 14:30',
    enter: words => { const time = dayTime(words); if (time) one(uuid => G.write.setText(uuid, prop.ident, time)); else G.say(`“${words}” is not a day and a time I can read. Try Oct 7 14:30 or 2026-10-07 09:00.`, 'warning'); } });
  G.menu(at, [], { find: `${type === 'number' ? 'A number' : type === 'url' ? 'An address' : 'Words'} for ${prop.title}`, enter: words => {
    const written = type === 'number' ? Number(words) : words;
    if (type === 'number' && !Number.isFinite(written)) { G.say(`“${words}” is not a number.`, 'warning'); return; }
    one(uuid => G.write.setText(uuid, prop.ident, written));
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
// before: the steps of Undo already made while that node was asked for (a new option's page).
async function swap(state, box, uuids, into, before = 0) {
  const list = box.lkList, here = await G.read.node(state.view.uuid), { props } = await G.read.schema(), prop = props.get(list.prop.ident);
  const holders = new Map((await G.read.holders(list.prop.ident)).map(one => [one.uuid, one]));
  await run(state, box, uuids, n => into ? `${into.words || 'Another node'} put in place of this page on ${nodes(n)}` : `This page taken out of ${list.name} on ${nodes(n)}`, uuid => {
    const kept = (holders.get(uuid)?.values || []).map(one => one.raw).filter(raw => raw !== here.id);
    return G.write.setValues(uuid, list.prop.ident, into ? [...kept, into.id] : kept, { ref: true, many: !!prop?.many });   // it answers the steps it made: 1, or 0 where nothing changed
  }, before);
}
function more(state, box, at, uuids) {
  const list = box.lkList, view = state.view, key = list.key;
  const held = new Set(list.rows.filter(row => uuids.includes(row.uuid)).flatMap(row => Object.keys(row.held || {})));
  G.menu(at, [
    { word: 'Select all', icon: icon('list-check'), take: () => { view.picked.set(key, new Set([...box.querySelectorAll(':scope > .lk-rows > .lk-row:not(.lk-faint)')].map(row => row.dataset.uuid))); state.redraw(); } },
    ...(held.size ? [{ word: 'Clear a property…', icon: icon('eraser'), take: () => askProperty(at, 'Clear a property', prop => { const has = new Set(list.rows.filter(row => (row.held || {})[prop.title]).map(row => row.uuid)); return run(state, box, uuids, n => `${prop.title} cleared on ${nodes(n)}`, async uuid => { if (!has.has(uuid)) return 0; await G.write.clear(uuid, prop.ident); return 1; }); }, held) }] : []),
    ...(list.kind === 'property' ? [{ gap: true },
      { word: 'Take out this page', icon: icon('unlink'), take: () => swap(state, box, uuids, null).catch(refused('It could not be taken out')) },
      { word: 'Change this page…', icon: icon('replace'), take: async () => { const { props } = await G.read.schema(); askNode(at, props.get(list.prop.ident) || list.prop, (id, node, before) => swap(state, box, uuids, { id, words: node.words }, before).catch(refused('It could not be changed'))); } }] : []),
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
    take: () => { const has = tagged(box.lkList, tag.id); return run(state, box, uuids, n => `${nodes(n)} made ${tag.title}, pointing here through ${prop.title}`, async (uuid, did) => { if (!has.has(uuid)) { await G.write.tag(uuid, tag.uuid); did(); } await G.write.setNode(uuid, prop.ident, here.id); did(); }); } }))], { find: 'A tag' });
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
    : `<span class="lk-did">${G.esc(did.words)}</span>${did.way ? '<button type="button" class="lk-btn lk-low lk-i-undo" data-do="undo">Undo</button>' : ''}<button type="button" class="lk-btn lk-low" data-do="done" aria-label="Done" title="Done">${icon('x', 14)}</button>`;
  if (el.lkHtml !== html) { el.innerHTML = html; el.lkHtml = html; }
  const all = head.querySelector('.lk-tick-all');
  if (all) { const shown = made.rows.length; all.checked = shown > 0 && n >= shown; all.indeterminate = n > 0 && n < shown; }
}
/* Delete asks first, in the bar's own place, and says truly where each kind of thing picked goes (node/ask.js has what Logseq
   does with a deleted page): a bullet comes back with Undo; a page goes to Logseq's Recycle; today's journal keeps its page
   and loses its bullets, which only Undo brings back. Tags and properties are deleted only through the one way they are deleted everywhere, with its
   counting question (G.ask.remove): picked alone they are handed to it; picked among other things they are left, and the
   question says so. The keyboard waits on Cancel. */
async function askDelete(state, box, el, uuids) {
  const rows = box.lkList.rows.filter(row => uuids.includes(row.uuid)), plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const kinds = new Map(await Promise.all(rows.filter(row => row.isPage).map(async row => [row.uuid, await G.ask.pageKind(row.uuid)])));
  const of = what => rows.filter(row => (kinds.get(row.uuid) || (row.isPage ? 'page' : '')) === what), schema = [...of('tag'), ...of('property')];
  if (schema.length && schema.length === rows.length && (!of('tag').length || !of('property').length)) {
    const first = box.querySelector(`.lk-row[data-uuid="${schema[0].uuid}"]`);
    if (first && await G.ask.remove(first, schema.map(row => row.uuid))) { state.view.picking.delete(box.lkList.key); state.view.picked.delete(box.lkList.key); state.redraw(); }
    return;
  }
  const pages = of('page').length, today = of('today').length, bullets = of('').length, going = [...of('page'), ...of('today'), ...of('')].map(row => row.uuid);
  const what = [pages ? `${plural(pages, 'page')} with all ${pages === 1 ? 'its' : 'their'} bullets` : '', today ? 'everything written on today’s journal' : '', bullets ? plural(bullets, 'bullet') : ''].filter(Boolean);
  const left = schema.length ? `${of('tag').length ? plural(of('tag').length, 'tag') : ''}${of('tag').length && of('property').length ? ' and ' : ''}${of('property').length ? plural(of('property').length, 'property', 'properties') : ''}` : '';
  const stays = left ? `${schema.length === 1 ? `The ${left.slice(2)} is` : `The ${left} are`} left: delete ${schema.length === 1 ? 'it from its own row' : 'them from their own rows'}.` : '';
  if (!going.length) { G.say(stays); return; }
  const said = [bullets ? `Undo brings the ${bullets === 1 ? 'bullet' : 'bullets'} back.` : '', pages ? 'A page goes to Logseq’s Recycle.' : '',
    today ? 'Today’s journal keeps its page and loses every bullet on it: only Undo brings them back.' : '', stays].filter(Boolean).join(' ');
  el.dataset.asking = '1'; el.lkHtml = ''; el.lkDelete = { uuids: going, forGood: false };
  el.innerHTML = `<span class="lk-did"><b>Delete ${G.esc(what.join(' and '))}?</b> ${G.esc(said)}</span><button type="button" class="lk-del" data-do="delete-yes">Delete</button><button type="button" class="lk-btn" data-do="delete-no">Cancel</button>`;
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
  else if (what === 'undo') {   // the Undo arrow's own way back: the line stays, at work, until the last step has gone back
    const said = view.did, way = said?.way;
    if (!way) { view.did = null; state.redraw(); return true; }
    box.dataset.busy = '1';
    G.undo.back(way).then(() => { delete box.dataset.busy; if (view.did === said) view.did = null; state.again(); });
  }
  else if (what === 'open') { for (const uuid of uuids) G.touch.open(uuid, true); view.picking.delete(key); view.picked.delete(key); state.redraw(); }
  else if (what === 'tag') askTag(at, 'Set tag', tag => { const has = tagged(box.lkList, tag.id); return run(state, box, uuids, n => `${tag.title} put on ${nodes(n)}`, async uuid => { if (has.has(uuid)) return 0; await G.write.tag(uuid, tag.uuid); return 1; }); }).catch(refused('The tags could not be read'));   // a node that holds the tag already is not written to, so no step is counted for it
  else if (what === 'prop') askProperty(at, 'Set property', prop => value(at, prop, (write, before) => run(state, box, uuids, n => `${prop.title} set on ${nodes(n)}`, write, before)).catch(refused('The choices could not be read'))).catch(refused('The properties could not be read'));
  else if (what === 'more') more(state, box, at, uuids);
  else if (what === 'delete') askDelete(state, box, el, uuids).catch(refused('What was picked could not be read'));
  else if (what === 'delete-no') { delete el.dataset.asking; state.redraw(); box.querySelector('.lk-row > .lk-line')?.focus(); }
  else if (what === 'delete-yes') { delete el.dataset.asking; const rows = new Map(box.lkList.rows.map(one => [one.uuid, one])), plan = el.lkDelete || { uuids, forGood: false }; run(state, box, plan.uuids, n => `${nodes(n)} deleted`, async uuid => { await G.write.remove(uuid, !!rows.get(uuid)?.isPage); return 1; }, 0, !plan.forGood); }
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
