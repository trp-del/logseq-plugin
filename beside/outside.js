/* BESIDE: Alfred. The plugin answering from outside Logseq, so that a node can be found, seen whole and changed in the Alfred
   workflow's panels as on its own page. Alfred asks through Logseq's HTTP APIs server; each answer here is read and written by
   the ground, so a change made from Alfred is the same change, with the same Undo, as one made in Logseq.
   Asked with a request { … }, answered { ok: true, … } or { ok: false, said }:
     find({ words, limit })          Logseq's own search: { nodes: [{ uuid, title, kind, day, isPage }] }
     node({ uuid })                  { node }: a node whole (below)
     tags()                          { tags: [{ uuid, title, depth }] }: the person's tags as an outline
     candidates({ ident, words })    { nodes }: what a node property can hold (the nodes of the tags it takes), narrowed by words
     markdown({ node, uuid })        { text, said }: a bullet with the bullets under it (uuid), or the node whole, as Markdown
   A change answers { ok, steps, said, node, lit }: how many steps of Logseq's Undo it took, what to say, the node read afresh,
   and the line to light. node is the uuid of the node shown; uuid the bullet (or the node itself) the change is made to:
     setWords({ node, uuid, words })          a bullet's words
     newBullet({ node, after, words })        a new bullet after the bullet `after`, or last in the node when there is none
     move({ node, uuid, way })                way 'in' or 'out', as Tab and Shift-Tab in Logseq
     remove({ node, uuid })                   a bullet deleted, with the bullets under it
     setValue({ node, ident, pick, text })    a property of the node: pick is a choice's id or a node's uuid; text is typed
                                              words, a number or a day; neither clears a property that holds one value
     tag({ node, uuid, tag })                 a tag put on, or taken off where it is on
     status({ node, uuid, to })               a task's status by Logseq's name for it ('done', 'doing')
     undo({ node, steps })                    Logseq's Undo, that many steps
   A node whole: { uuid, title, isPage, day, task, tags: [{ uuid, title }],
     props: [{ ident, name, kind, many, values: [{ raw, text, uuid }], choices: [{ raw, text }] }],   kind: node, date, choice, number, checkbox, text
     lines: [{ uuid, depth, words, task, tag, under }],   its bullets; words as written, a link as [[its name]]; under: how many bullets stand under it
     lists: [{ name, said, rows: [{ uuid, title, kind, day, isPage }], more }] }   what points at it, as Relations lists it */
(function () {
const G = window.PluginDoor, R = G.read, Wr = G.write, W = G.words, D = G.days, T = G.tags, S = G.search;
const FEW = 5;
const fail = said => { throw new Error(said); };
const row = (node, names, kind = node.tag) => ({ uuid: node.uuid, title: W.plain(W.firstLine(node.words).line, names) || 'Untitled', kind: kind || '', day: D.short(node.day), isPage: !!node.isPage });
const kindOf = type => (type === 'node' || type === 'date' || type === 'number' || type === 'checkbox' ? type : 'text');

async function whole(uuid) {
  const at = await R.node(uuid);
  if (!at) return null;
  const [described, tagIndex, schema, own, statuses, choices] = await Promise.all([R.describe([at.id]), R.tags(), R.schema(), R.tagsOf(at.id), R.statuses(), R.choices()]);
  const me = described.get(at.id);
  if (!me) return null;
  const [bullets, held, pointing] = await Promise.all([R.outline(at.uuid, me.isPage), R.holds(at.id), R.pointingAt(at.id)]);
  const about = await R.describe(bullets.map(line => line.id));
  const task = status => { const name = statuses.find(one => one.id === status)?.name || ''; return !name ? '' : /^(done|canceled|cancelled)$/.test(name) ? 'done' : 'open'; };
  const lines = bullets.map((line, i) => {
    let under = 0;
    for (let j = i + 1; j < bullets.length && bullets[j].depth > line.depth; j++) under++;
    return { uuid: line.uuid, depth: line.depth, words: line.words, task: task(about.get(line.id)?.status), tag: about.get(line.id)?.tag || '', under };
  });
  // The properties its tags give it (those of the tags above them too), then any other it holds; by name, so they never jump.
  const idents = new Set();
  for (const id of own.filter(tag => tagIndex.has(tag))) for (const up of G.tags.above(id, tagIndex)) for (const ident of schema.byTag.get(up) || []) idents.add(ident);
  for (const ident of held.keys()) idents.add(ident);
  const props = [...idents].map(ident => schema.props.get(ident)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title) || a.ident.localeCompare(b.ident))
    .map(prop => ({ ident: prop.ident, name: prop.title, kind: choices.has(prop.ident) ? 'choice' : kindOf(prop.type), many: !!prop.many, values: held.get(prop.ident) || [], choices: choices.get(prop.ident) || [] }));
  const shaped = G.lists.lists({ links: pointing.links, mentions: pointing.mentions, own: at.day });
  const names = await R.names([...W.named(me.words), ...shaped.flatMap(list => list.rows.flatMap(one => W.named(one.words)))]);
  const lists = shaped.map(list => ({ name: list.kind === 'property' ? `${list.name} of` : list.name, said: list.said,
    rows: list.rows.slice(0, FEW).map(one => ({ ...row(one, names, one.tagShown ? one.tag : ''), day: D.short(one.dayShown) })), more: Math.max(0, list.rows.length - FEW) }));
  return { uuid: at.uuid, title: W.plain(W.firstLine(me.words).line, names) || 'Untitled', isPage: me.isPage, day: D.short(me.day), task: task(me.status),
    tags: own.map(id => tagIndex.get(id)).filter(Boolean).map(tag => ({ uuid: tag.uuid, title: tag.title })).sort((a, b) => a.title.localeCompare(b.title)), props, lines, lists };
}
// What a change answers: the node read afresh, so the panel draws what the graph now holds and never what it hoped for.
const changed = async (node, steps, said, lit = '') => ({ ok: true, steps: Number(steps) || 1, said, lit, node: await whole(node) });
const shown = async request => (await whole(request.node)) || fail('That node is no longer in the graph.');
const lineOf = (node, uuid) => node.lines.find(line => line.uuid === String(uuid || '').toLowerCase()) || fail('That bullet is no longer under this node.');
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const answers = {
  async find({ words, limit }) {
    const text = String(words || '').trim();
    if (!text) return { ok: true, nodes: [] };
    const found = await R.search(text, Math.min(Number(limit) || 30, 60));
    const names = await R.names(found.flatMap(node => W.named(node.words)));
    return { ok: true, nodes: found.map(node => row(node, names)) };
  },
  async node({ uuid }) { const node = await whole(uuid); return node ? { ok: true, node } : { ok: false, said: 'That node is no longer in the graph.' }; },
  async tags() { return { ok: true, tags: T.tree(await R.tags()).map(({ tag, depth }) => ({ uuid: tag.uuid, title: tag.title, depth })) }; },
  async candidates({ ident, words }) {
    const prop = (await R.schema()).props.get(String(ident)) || fail('That property is no longer in the graph.'), text = String(words || '').trim();
    const tagIndex = await R.tags(), takes = new Set();
    for (const tag of prop.range) for (const one of T.under(tag, tagIndex)) takes.add(one);
    const found = takes.size ? await R.tagged([...takes]) : text ? (await R.search(text, 40)).filter(node => node.isPage) : [];
    const names = await R.names(found.flatMap(node => W.named(node.words)));
    const plain = found.map(node => ({ ...node, words: W.plain(W.firstLine(node.words).line, names) }));
    const kept = takes.size ? S.narrow(plain, text).sort((a, b) => a.words.localeCompare(b.words)) : plain;
    return { ok: true, nodes: kept.slice(0, 60).map(node => ({ uuid: node.uuid, title: node.words || 'Untitled', kind: node.tag || '', day: D.short(node.day), isPage: !!node.isPage })) };
  },
  async markdown(request) {
    const node = await shown(request);
    if (request.uuid && String(request.uuid).toLowerCase() !== node.uuid) {
      const at = node.lines.indexOf(lineOf(node, request.uuid)), top = node.lines[at];
      return { ok: true, text: G.markdown.outline(node.lines.slice(at, at + 1 + top.under)), said: top.under ? `Copied the bullet and the ${count(top.under, 'bullet', 'bullets')} under it` : 'Copied the bullet' };
    }
    return { ok: true, text: G.markdown.page({ title: node.title, tags: node.tags.map(tag => tag.title), properties: node.props.map(prop => ({ name: prop.name, values: prop.values.map(value => value.text) })), lines: node.lines }),
      said: node.isPage ? 'Copied the page as Markdown' : 'Copied the node as Markdown' };
  },
  async setWords(request) {
    const node = await shown(request), line = lineOf(node, request.uuid), words = String(request.words ?? '');
    if (words === line.words) return { ok: true, steps: 0, said: '', lit: line.uuid, node };
    await Wr.setWords(line.uuid, words);
    return changed(node.uuid, 1, '', line.uuid);
  },
  async newBullet(request) {
    const node = await shown(request), words = String(request.words ?? '');
    if (!words.trim()) return { ok: true, steps: 0, said: '', lit: '', node };
    const made = request.after ? await Wr.addBullet(lineOf(node, request.after).uuid, words) : await Wr.addBullet(node.uuid, words, node.isPage ? { page: true } : { under: true });
    return changed(node.uuid, 1, '', made);
  },
  async move(request) {
    const node = await shown(request), line = lineOf(node, request.uuid);
    if (request.way === 'out' && line.depth === 0) return { ok: true, steps: 0, said: '', lit: line.uuid, node };   // it would leave the node shown
    const steps = request.way === 'out' ? await Wr.moveOut(line.uuid) : await Wr.moveIn(line.uuid);
    return steps ? changed(node.uuid, steps, '', line.uuid) : { ok: true, steps: 0, said: '', lit: line.uuid, node };
  },
  async remove(request) {
    const node = await shown(request), line = lineOf(node, request.uuid), at = node.lines.indexOf(line);
    await Wr.remove(line.uuid, false);
    const next = node.lines[at + 1 + line.under] || node.lines[at - 1];
    return changed(node.uuid, 1, line.under ? `Deleted the bullet and the ${count(line.under, 'bullet', 'bullets')} under it` : 'Deleted the bullet', next ? next.uuid : '');
  },
  async setValue(request) {
    const node = await shown(request), prop = node.props.find(one => one.ident === request.ident) || fail('That property is no longer on this node.');
    const lit = 'p:' + prop.ident, has = prop.values.map(value => value.raw), text = String(request.text ?? '').trim();
    const put = async (raw, ref, reads) => {
      if (!prop.many) { await Wr.setValue(node.uuid, prop.ident, raw, { ref }); return changed(node.uuid, 1, `${prop.name} is now ${reads}`, lit); }
      const on = has.includes(raw), next = on ? has.filter(one => one !== raw) : [...has, raw];
      await Wr.setValues(node.uuid, prop.ident, next, { ref, many: true });
      return changed(node.uuid, next.length ? 2 : 1, on ? `${reads} taken off ${prop.name}` : `${reads} added to ${prop.name}`, lit);
    };
    if (prop.kind === 'checkbox') { const to = !(has[0] === true); await Wr.setValue(node.uuid, prop.ident, to); return changed(node.uuid, 1, `${prop.name} is now ${to ? 'Yes' : 'No'}`, lit); }
    if (prop.kind === 'choice') { const choice = prop.choices.find(one => String(one.raw) === String(request.pick)) || fail('That choice is no longer there.'); return put(choice.raw, true, choice.text); }
    if (prop.kind === 'node' && request.pick) {
      const [to] = await R.byUuids([request.pick]);
      if (!to) fail('That node is no longer in the graph.');
      const names = await R.names(W.named(to.words));
      return put(to.id, true, W.plain(W.firstLine(to.words).line, names));
    }
    if (!text && !request.pick) {
      if (!has.length) return { ok: true, steps: 0, said: '', lit, node };
      await Wr.clearValue(node.uuid, prop.ident);
      return changed(node.uuid, 1, `${prop.name} is empty`, lit);
    }
    if (prop.kind === 'date') {
      const day = D.typed(text) || fail(`“${text}” is not a day I can read. Try “nov 18” or “2026-11-18”.`);
      const page = await R.node(await Wr.day(day)) || fail('That day’s journal could not be found.');
      return put(page.id, true, D.short(day));
    }
    if (prop.kind === 'number') { const n = Number(text.replace(/,/g, '')); if (!Number.isFinite(n)) fail(`“${text}” is not a number.`); return put(n, false, String(n)); }
    if (prop.kind === 'node') fail('Pick a node from the list.');
    return put(text, false, text);
  },
  async tag(request) {
    const node = await shown(request), uuid = String(request.uuid || node.uuid).toLowerCase(), tag = [...(await R.tags()).values()].find(one => one.uuid === String(request.tag || '').toLowerCase()) || fail('That tag is no longer in the graph.');
    const at = await R.node(uuid) || fail('That bullet is no longer in the graph.'), on = (await R.tagsOf(at.id)).includes(tag.id);
    await (on ? Wr.untag(uuid, tag.uuid) : Wr.tag(uuid, tag.uuid));
    return changed(node.uuid, 1, on ? `${tag.title} taken off` : `Tagged ${tag.title}`, uuid === node.uuid ? '' : uuid);
  },
  async status(request) {
    const node = await shown(request), uuid = String(request.uuid || node.uuid).toLowerCase();
    const to = (await R.statuses()).find(one => one.name === String(request.to)) || fail('Logseq has no such status.');
    await Wr.setStatus(uuid, to.title);
    return changed(node.uuid, 1, `Marked ${to.title.toLowerCase()}`, uuid === node.uuid ? '' : uuid);
  },
  /* Todo, as its sidebar section groups it (Overdue, Today, Coming up, Any time): { parts: [{ head, rows: [{ uuid, words, status,
     day, page, late }] }] }; a status set and taken back; a task added with the day its words say. */
  async todoList() {
    const [all, statuses] = await Promise.all([R.tasks(), R.statuses()]), today = D.number(new Date()), key = new Map(statuses.map(one => [one.id, one.name]));
    const sits = await R.where(all.map(task => task.id)), names = await R.names(all.flatMap(task => W.named(task.words)));
    return { ok: true, parts: G.todo.groups(all, today).map(list => ({ head: list.name, rows: list.rows.map(task => { const at = (sits.get(task.id) || [])[0];
      return { uuid: task.uuid, words: W.plain(W.firstLine(task.words).line, names), status: key.get(task.status) || 'todo', day: D.short(task.day), page: at && !at.day ? W.plain(at.words, names) : '', late: !!task.late }; }) })) };
  },
  async todoStatus({ uuid, status }) {
    const one = (await R.statuses()).find(s => s.name === String(status) || s.title.toLowerCase() === String(status).toLowerCase()) || fail('Logseq has no such status.');
    await Wr.setStatus(uuid, one.title);
    return { ok: true };
  },
  async todoUndo() { await Wr.undo(); return { ok: true }; },
  async todoAdd({ words }) {
    const read = G.todo.dayIn(words, D.number(new Date())), text = read ? read.words : String(words || '').trim();
    const uuid = await Wr.addTask(text, read ? read.day : 0);
    return { ok: true, uuid, words: text, day: read ? D.short(read.day) : '' };
  },
  /* A note from outside Logseq, at the end of today's journal, with the tag asked for: { uuid, page, tag, wrote }. */
  async note({ words, tag }) {
    const text = String(words || '').trim(); if (!text) fail('There are no words to write.');
    const page = await Wr.day(D.number(new Date())), uuid = await Wr.addBullet(page, text, { page: true });
    let tagged = '';
    if (tag) { const one = (await R.tags()).get(Number(tag)); if (one) { await Wr.tag(uuid, one.uuid); tagged = one.title; } }
    return { ok: true, uuid, page: D.short(D.number(new Date())), tag: tagged, wrote: [] };
  },
  /* Alfred's Home finds as Search does: with no kind, the kinds whose name holds the words and what holds every word; with a
     kind, its nodes narrowed by the words. { kinds: [{ id, title, count }], rows, choices: [], months: [] } */
  async browse({ kind, words, limit }) {
    const text = String(words || '').trim(), most = Math.min(Number(limit) || 40, 80), tags = await R.tags();
    if (kind) {
      const nodes = await R.tagged([...T.under(Number(kind), tags)]), names = await R.names(nodes.flatMap(node => W.named(node.words)));
      const plain = nodes.map(node => ({ ...node, shown: node.words, words: W.plain(node.words, names) })).sort((a, b) => (b.day || 0) - (a.day || 0));
      return { ok: true, kinds: [], choices: [], months: [], rows: S.narrow(plain, text).slice(0, most).map(node => row({ ...node, words: node.shown }, names)) };
    }
    if (!text) return { ok: true, kinds: [], rows: [], choices: [], months: [] };
    const counts = T.counts(tags, await R.tagPairs()), found = await R.search(text, most), names = await R.names(found.flatMap(node => W.named(node.words)));
    const ranked = S.rank(found.map(node => ({ ...node, shown: node.words, words: W.plain(node.words, names) })), text);
    return { ok: true, kinds: S.kinds(tags, text).slice(0, 6).map(one => ({ id: one.id, title: one.title, count: counts.get(one.id) || 0 })), rows: ranked.map(node => row({ ...node, words: node.shown }, names)), choices: [], months: [] };
  },
  /* What the Files panel added, taken away again: { made: "uuid,uuid" }. */
  async unadd({ made }) {
    for (const uuid of String(made || '').split(',').map(one => one.trim()).filter(Boolean)) await Wr.remove(uuid);
    return { ok: true };
  },
  async undo(request) {
    const steps = Math.max(1, Math.min(Number(request.steps) || 1, 6));
    for (let i = 0; i < steps; i++) { await Wr.undo(); await new Promise(done => setTimeout(done, 350)); }
    return { ok: true, steps: 1, said: 'Taken back', lit: '', node: await whole(request.node) };
  },
};

G.part({
  key: 'outside', title: 'Alfred', about: 'Answers the Alfred workflow: its search, a node whole with its bullets and properties, and the changes made there. Needs Logseq’s HTTP APIs server switched on.',
  start(base) {
    G.outside.answer(answers);
    const off = Object.fromEntries(Object.keys(answers).map(name => [name, async () => ({ ok: false, said: 'The Alfred part of the Logseq Plugin is switched off.' })]));
    base.onStop(() => G.outside.answer(off));
  },
});
})();
