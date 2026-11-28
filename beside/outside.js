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
     append({ page, words })                  a new bullet at the end of any page, answered { ok, uuid }
     note({ words, where, tag, own })         a note from outside: a bullet at the end of today's journal ('today'), of the page
                                              open in Logseq ('open') or of a page by its name ({ page }), made if there is none;
                                              tag: a tag's uuid, put on it; own: words of the person's own, a bullet under it.
                                              Answered { ok, uuid, page, tag, said }: said names what could not be done after the
                                              bullet was written
     show({ uuid })                           Logseq goes to that node, as a press on its name does there
     setWords({ node, uuid, words })          a bullet's words, as read in the node's lines and changed: a link or a tag the
                                              bullet already held stays the link it is; what is typed anew is written as typed
     newBullet({ node, after, words })        a new bullet after the bullet `after`, or last in the node when there is none
     move({ node, uuid, way })                way 'in' or 'out', as Tab and Shift-Tab in Logseq
     remove({ node, uuid })                   a bullet deleted, with the bullets under it
     setValue({ node, ident, pick, text, clear })  a property of the node: pick is a choice's id or a node's uuid; text is
                                              typed words, a number or a day; clear empties it, whatever its kind; with none of
                                              them a tick box turns over
     tag({ node, uuid, tag })                 a tag put on, or taken off where it is on
     status({ node, uuid, to })               a task's status by Logseq's name for it ('done', 'doing')
     undo({ node })  or  undo({ uuid })       what Alfred changed last on that node (or the note it added) taken back with
                                              Logseq's Undo, as many steps as that change took. Refused, with nothing taken
                                              back, when it was not the last change to the graph: Logseq's Undo would then take
                                              back that later change and not this one (as the Undo arrow goes, node/undo.js)
   Files, put into the graph as Logseq puts a dropped file (a node of its own, the file copied into the graph):
     check({ files })                         before anything is added: { files: [{ path, name, title, type, size, twin, said }] }
                                              twin: the name of the node the file already is in the graph; said: why it cannot be
                                              read, or that its node lies on a page in the Recycle (it is then left out)
     add({ files, where, linkTwins })         the files added to today's journal, the open page or a page by its name; a file
                                              already in the graph is refused, or with linkTwins linked on the page. Answered
                                              { ok, page, added, linked, made } or, when Logseq's ten seconds for a call from
                                              outside would run out first, { ok, pending: true } while the files keep going in
     progress()                               how far the last add is: { total, done, now, made, linked, failed, page }
     unadd({ made })                          the bullets an add made ("uuid,uuid"), taken away again
   A refusal is answered { ok: false, said }, said in the plugin's words: Logseq's own go to the console (write.refused, quiet).
   A node whole: { uuid, title, isPage, day, task, tags: [{ uuid, title }],
     props: [{ ident, name, kind, many, values: [{ raw, text, uuid }], choices: [{ raw, text }] }],   kind: node, date, choice, number, checkbox, text
     lines: [{ uuid, depth, words, task, tag, tags: [{ uuid, title }], under }],   its bullets; words as a person reads them, a link as [[its name]];
                                                          tag: its first tag by name, tags: every tag it has; under: how many bullets stand under it
     lists: [{ name, said, rows: [{ uuid, title, kind, day, isPage }], more }] }   what points at it, as Relations lists it */
(function () {
const G = window.PluginDoor, R = G.read, Wr = G.write, W = G.words, D = G.days, T = G.tags, S = G.search;
const FEW = 5;
// A refusal of the answers' own, in words a panel says as they are. Anything else that stops an answer (Logseq refusing a write)
// is said as the ground says a refusal, in everyday words after what was not done, with no notice in Logseq (plainly, below).
const fail = said => { throw Object.assign(new Error(said), { mine: true, plain: true }); };
const plainly = (what, error) => (error?.mine ? String(error.message) : Wr.refused(what, error, '', { quiet: true }));
const sleep = ms => new Promise(done => setTimeout(done, ms));
/* What Alfred changed last, and may still take back: { key, steps, until, stale }. key: the node a panel will name when it asks
   (the node it shows, the task, the note); steps: how many steps of Logseq's Undo the change took. Any change to the graph after
   the change's own have settled (until) makes it stale: Logseq's Undo would take back that later change. A change with no Undo
   in Alfred (a bullet appended, files) is kept under no key, so the change before it can no longer be asked for. */
let last = null, ticks = 0;
const did = (key, steps) => { if (steps > 0) last = { key: String(key || '').toLowerCase(), steps, until: Date.now() + 1600, stale: false }; };
const heard = () => { ticks++; if (last && Date.now() > last.until) last.stale = true; };
const NOT_BACK = 'Not taken back: the graph has changed since. Use Undo in Logseq.';
async function back(key) {
  if (!last || last.stale || last.key !== String(key || '').toLowerCase()) fail(NOT_BACK);
  const steps = last.steps;
  last = null;
  for (let i = 0; i < steps; i++) { await Wr.undo(); await sleep(350); }
  return steps;
}
// A write that failed part of the way may have changed the graph: what stood to be taken back then no longer is the last change.
const WRITES = ['setWords', 'newBullet', 'move', 'remove', 'setValue', 'tag', 'status', 'todoStatus', 'todoAdd', 'append', 'note', 'unadd'];
const guarded = run => async request => { const before = ticks; try { return await run(request); } catch (error) { if (last && ticks !== before) last.stale = true; throw error; } };
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
    const tags = (about.get(line.id)?.tags || []).map(tag => tagIndex.get(tag.id)).filter(Boolean).map(tag => ({ uuid: tag.uuid, title: tag.title }));   // every tag of the person's it has
    return { uuid: line.uuid, depth: line.depth, words: line.words, task: task(about.get(line.id)?.status), tag: about.get(line.id)?.tag || '', tags, under };
  });
  // The properties its tags give it (those of the tags above them too), then any other it holds; by name, so they never jump.
  // One set to "Hide by default" is left out, as Logseq's own page leaves it out.
  const idents = new Set();
  for (const id of own.filter(tag => tagIndex.has(tag))) for (const up of G.tags.above(id, tagIndex)) for (const ident of schema.byTag.get(up) || []) idents.add(ident);
  for (const ident of held.keys()) idents.add(ident);
  const props = [...idents].map(ident => schema.props.get(ident)).filter(prop => prop && !prop.hidden).sort((a, b) => a.title.localeCompare(b.title) || a.ident.localeCompare(b.ident))
    .map(prop => ({ ident: prop.ident, name: prop.title, kind: choices.has(prop.ident) ? 'choice' : kindOf(prop.type), many: !!prop.many, values: held.get(prop.ident) || [], choices: choices.get(prop.ident) || [] }));
  const shaped = G.lists.lists({ links: pointing.links, mentions: pointing.mentions, own: at.day });
  const names = await R.names([...W.named(me.words), ...shaped.flatMap(list => list.rows.flatMap(one => W.named(one.words)))]);
  const lists = shaped.map(list => ({ name: list.kind === 'property' ? `${list.name} of` : list.name, said: list.said,
    rows: list.rows.slice(0, FEW).map(one => ({ ...row(one, names, one.tagShown ? one.tag : ''), day: D.short(one.dayShown) })), more: Math.max(0, list.rows.length - FEW) }));
  return { uuid: at.uuid, title: W.plain(W.firstLine(me.words).line, names) || 'Untitled', isPage: me.isPage, day: D.short(me.day), task: task(me.status),
    tags: own.map(id => tagIndex.get(id)).filter(Boolean).map(tag => ({ uuid: tag.uuid, title: tag.title })).sort((a, b) => a.title.localeCompare(b.title)), props, lines, lists };
}
// What a change answers: the node read afresh, so the panel draws what the graph now holds and never what it hoped for.
const changed = async (node, steps, said, lit = '') => { did(node, Number(steps) || 1); return { ok: true, steps: Number(steps) || 1, said, lit, node: await whole(node) }; };
const shown = async request => (await whole(request.node)) || fail('That node is no longer in the graph.');
const lineOf = (node, uuid) => node.lines.find(line => line.uuid === String(uuid || '').toLowerCase()) || fail('That bullet is no longer under this node.');
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* Where something from outside goes: today's journal, the page open in Logseq, or a page by its name, made if there is none.
   steps: the step of Logseq's Undo a page made here took (1), else 0. */
async function place(where) {
  if (where && typeof where === 'object') {
    const name = String(where.page || '').trim() || fail('No page was named.'), found = await R.pageNamed(name);
    if (found && !found.gone) return { uuid: found.uuid, title: name, isPage: true, steps: 0 };
    return { uuid: await Wr.newPage(name) || fail(`The page “${name}” could not be made.`), title: name, isPage: true, steps: 1 };
  }
  if (where === 'open') {
    const uuid = await G.touch.openPage() || fail('No page is open in Logseq.'), at = await R.node(uuid) || fail('No page is open in Logseq.');
    const me = (await R.describe([at.id])).get(at.id), names = await R.names(W.named(me?.words || ''));
    return { uuid: at.uuid, title: W.plain(W.firstLine(me?.words || '').line, names) || 'the open page', isPage: !!me?.isPage, steps: 0 };
  }
  const today = D.number(new Date()), day = await Wr.dayPage(today);
  return { uuid: day.uuid, title: D.short(today), isPage: true, steps: day.steps };
}
/* Files into the graph, by the ground's three pieces: touch.file reads a file of this Mac, read.fileTwin finds the node it
   already is, write.addFile puts it in as Logseq takes a pasted file. Everything is read and looked for before anything is
   made. A twin on a page in the Recycle is neither added (Logseq takes no file the graph holds) nor linked into a deleted page.
   going: how far the last add is, for the files tray's bar. The add is one record of what Alfred changed, with every step it
   made (a page made for it, each file's steps, each link). */
const twinSaid = (file, twin) => `${file.name} is already in the graph, as “${twin.title}”${twin.gone ? ', on a page in the Recycle' : ''}.`;
const pathsOf = files => [].concat(files || []).map(one => String(one ?? '').trim()).filter(Boolean);
let adding = Promise.resolve(), going = { total: 0, done: 0, now: '', made: [], linked: [], failed: '', page: '' };
async function addFiles({ files, where, linkTwins }) {
  const paths = pathsOf(files), fresh = [], twins = [];
  if (!paths.length) fail('No file was given.');
  if (paths.some(path => !path.startsWith('/'))) fail('A file needs its whole path.');
  for (const path of paths) {
    const file = await G.touch.file(path), twin = await R.fileTwin(file);
    if (twin && (!linkTwins || twin.gone)) fail(twinSaid(file, twin));
    if (twin) twins.push(twin); else fresh.push(file);
  }
  const to = await place(where), now = going = { total: fresh.length, done: 0, now: '', made: [], linked: [], failed: '', page: to.title };
  let steps = to.steps, doing = '';
  try {
    for (const file of fresh) { doing = `${file.name} was not added`; now.now = file.name; const made = await Wr.addFile(to.uuid, file, { under: !to.isPage }); now.made.push(made.uuid); steps += made.steps; now.done++; }
    for (const twin of twins) {
      doing = `“${twin.title}” was not linked`;
      const uuid = await Wr.addBullet(to.uuid, `[[${twin.uuid}]]`, to.isPage ? { page: true } : { under: true });
      if (!uuid) fail(`${doing}: Logseq made no bullet.`);
      now.made.push(uuid); steps++; now.linked.push(twin.title);
    }
    now.now = '';
  } catch (error) {
    steps += Number(error?.steps) || 0;   // what a write refused halfway left standing
    const before = now.made.length ? ` What went in before it stays on ${to.title}.` : '';
    now.failed = (error?.mine ? String(error.message) : Wr.refused(doing || 'The files were not added', error, '', { quiet: true })) + before;
    fail(now.failed);
  } finally { did('', steps); }
  return { ok: true, page: to.title, added: fresh.map(file => file.title), linked: [...now.linked], made: [...now.made] };
}

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
    await Wr.setWords(line.uuid, words, { asRead: true });   // the field held the words as read: each link and tag the bullet had goes back by its id
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
    /* The ground refuses a change that would take away a value with bullets written under it, before anything is written.
       Its refusal carries the plugin's own words (why, and what to do), and Logseq's refusal is said in everyday words: either
       after what was not done. */
    const written = async write => { try { return await write(); } catch (error) { fail(Wr.refused(`${prop.name} was not changed`, error, '', { quiet: true })); } };
    const put = async (raw, ref, reads) => {
      if (!prop.many) { await written(() => (ref ? Wr.setNode(node.uuid, prop.ident, raw) : Wr.setText(node.uuid, prop.ident, raw))); return changed(node.uuid, 1, `${prop.name} is now ${reads}`, lit); }
      // One of several: the ground writes the whole set in one step and answers the steps it made (none where nothing changed).
      const on = has.includes(raw), next = on ? has.filter(one => one !== raw) : [...has, raw];
      const steps = await written(() => Wr.setValues(node.uuid, prop.ident, next, { ref, many: true }));
      return steps ? changed(node.uuid, steps, on ? `${reads} taken off ${prop.name}` : `${reads} added to ${prop.name}`, lit) : { ok: true, steps: 0, said: '', lit, node };
    };
    const clear = async () => {
      if (!has.length) return { ok: true, steps: 0, said: '', lit, node };
      await written(() => Wr.clear(node.uuid, prop.ident));
      return changed(node.uuid, 1, `${prop.name} is empty`, lit);
    };
    if (request.clear) return clear();   // before the kinds: a tick box is never turned over by it, a set choice needs no pick
    if (prop.kind === 'checkbox') { const to = !(has[0] === true); await written(() => Wr.setText(node.uuid, prop.ident, to)); return changed(node.uuid, 1, `${prop.name} is now ${to ? 'Yes' : 'No'}`, lit); }
    if (prop.kind === 'choice') { const choice = prop.choices.find(one => String(one.raw) === String(request.pick)) || fail('That choice is no longer there.'); return put(choice.raw, true, choice.text); }
    if (prop.kind === 'node' && request.pick) {
      const [to] = await R.byUuids([request.pick]);
      if (!to) fail('That node is no longer in the graph.');
      const names = await R.names(W.named(to.words));
      return put(to.id, true, W.plain(W.firstLine(to.words).line, names));
    }
    if (!text && !request.pick) return clear();
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
    did(uuid, 1);
    return { ok: true };
  },
  async todoUndo({ uuid }) { await back(uuid); return { ok: true }; },
  async todoAdd({ words }) {
    const read = G.todo.dayIn(words, D.number(new Date())), text = read ? read.words : String(words || '').trim();
    const uuid = await Wr.addTask(text, read ? read.day : 0);
    if (!uuid) fail('Logseq made no task.');
    did(uuid, 1);
    return { ok: true, uuid, words: text, day: read ? D.short(read.day) : '' };
  },
  /* A bullet with these words at the end of a page, for what Alfred adds itself (today, the open page, a selection): written here
     so the bullet being written in Logseq is set down first, as for every addition of the plugin's. { uuid } */
  async append({ page, words }) {
    const uuid = await Wr.addBullet(String(page || ''), String(words ?? ''), { page: true });
    if (!uuid) fail('Logseq made no bullet.');
    did('', 1);
    return { ok: true, uuid };
  },
  /* A note from outside Logseq, at the end of the page it is sent to, with the tag picked and the person's own words under it:
     { uuid, page, tag, said }. Everything is looked up before anything is written. Once the bullet stands, the note is answered
     as added whatever follows, and said names what could not be done after it, so it is never written a second time. */
  async note({ words, where, tag, own }) {
    const text = String(words || '').trim(), under = String(own || '').trim(); if (!text) fail('There are no words to write.');
    const picked = tag ? [...(await R.tags()).values()].find(one => one.uuid === String(tag).toLowerCase()) || fail('That tag is no longer in the graph.') : null;
    const to = await place(where), uuid = await Wr.addBullet(to.uuid, text, to.isPage ? { page: true } : { under: true });
    if (!uuid) fail('Logseq made no bullet.');
    let steps = 1 + (to.steps || 0), said = '', doing = '';   // the page made for it (a day's journal, a page by its name) goes with it
    try {
      if (picked) { doing = `The tag ${picked.title} could not be put on it`; await Wr.tag(uuid, picked.uuid); steps++; }
      if (under) { doing = 'Your own words could not be written under it'; if (!(await Wr.addBullet(uuid, under, { under: true }))) fail('Logseq made no bullet'); steps++; }
    } catch (error) { said = Wr.refused(doing, error, '', { quiet: true }); }
    did(uuid, steps);
    return { ok: true, uuid, page: to.title, tag: picked && !/^The tag/.test(said) ? picked.title : '', said };
  },
  // Logseq goes to a node, as a press on its name does in Logseq: a page shown, a bullet shown as a page of its own.
  async show({ uuid }) {
    const at = await R.node(uuid) || fail('That node is no longer in the graph.');
    await G.touch.open(at.uuid);
    return { ok: true };
  },
  /* Alfred's Home finds as Search does. { kinds: [{ id, title, count }], rows, choices: [], months: [] }
       nothing typed   the kinds with the most nodes, and the pages opened last
       words           the kinds whose name holds the words, and what holds every word
       a kind taken    its nodes, newest first, narrowed by the words; with { kind: { id, title }, total, cutFrom: 0 } */
  async browse({ kind, words, limit }) {
    const text = String(words || '').trim(), most = Math.min(Number(limit) || 40, 80), tags = await R.tags();
    if (kind) {
      const tag = tags.get(Number(kind)) || fail('That kind is no longer in the graph.');
      const nodes = await R.tagged([...T.under(tag.id, tags)]), names = await R.names(nodes.flatMap(node => W.named(node.words)));
      const plain = nodes.map(node => ({ ...node, shown: node.words, words: W.plain(node.words, names) })).sort((a, b) => (b.day || 0) - (a.day || 0)), kept = S.narrow(plain, text);
      return { ok: true, kind: { id: tag.id, title: tag.title }, total: kept.length, cutFrom: 0, kinds: [], choices: [], months: [], rows: kept.slice(0, most).map(node => row({ ...node, words: node.shown }, names)) };
    }
    const counts = T.counts(tags, await R.tagPairs());
    if (!text) {
      const top = [...tags.values()].map(tag => ({ id: tag.id, title: tag.title, count: counts.get(tag.id) || 0 })).filter(one => one.count).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 6);
      const pages = await R.recent(5), names = await R.names(pages.flatMap(node => W.named(node.words)));
      return { ok: true, kinds: top, rows: pages.map(node => row(node, names)), choices: [], months: [] };
    }
    const found = await R.search(text, most), names = await R.names(found.flatMap(node => W.named(node.words)));
    const ranked = S.rank(found.map(node => ({ ...node, shown: node.words, words: W.plain(node.words, names) })), text);
    return { ok: true, kinds: S.kinds(tags, text).slice(0, 6).map(one => ({ id: one.id, title: one.title, count: counts.get(one.id) || 0 })), rows: ranked.map(node => row({ ...node, words: node.shown }, names)), choices: [], months: [] };
  },
  /* Files. Each is read and looked for in the graph before anything is made, so a file refused leaves no page and no bullet. */
  async check({ files }) {
    const out = [];
    for (const path of pathsOf(files)) {
      const name = path.split('/').filter(Boolean).pop() || path;
      try {
        const file = await G.touch.file(path), twin = await R.fileTwin(file), gone = twin && twin.gone;
        out.push({ path, name: file.name, title: file.title, type: String(file.type || '').toUpperCase(), size: file.size, twin: twin && !gone ? twin.title : '', said: gone ? twinSaid(file, twin) : '' });
      } catch (error) { out.push({ path, name, title: name, type: '', size: 0, twin: '', said: error?.plain ? String(error.message) : Wr.refused(`${name} could not be read`, error, '', { quiet: true }) }); }
    }
    return { ok: true, files: out };
  },
  add(request) {
    // Two adds go one after the other: one bullet is open at a time.
    const job = adding.then(() => addFiles(request)).catch(error => fail(plainly('The files were not added', error))); adding = job.catch(() => {});
    let late = false;
    job.catch(error => { if (late) G.say(`Not every file was added from outside Logseq. ${error.message}`, 'warning'); });   // the panel has its answer already: the notice is the one place left to say it
    return Promise.race([job, sleep(8000).then(() => { late = true; return { ok: true, pending: true }; })]);
  },
  async progress() { return { ok: true, ...going, made: [...going.made], linked: [...going.linked] }; },
  /* What an add made, taken away again: { made: "uuid,uuid" }. */
  async unadd({ made }) {
    let steps = 0;
    try { for (const uuid of String(made || '').split(',').map(one => one.trim()).filter(Boolean)) { await Wr.remove(uuid); steps++; } }
    finally { did('', steps); }
    return { ok: true };
  },
  async undo(request) {
    const steps = await back(request.node || request.uuid);
    return { ok: true, steps, said: 'Taken back', lit: '', node: request.node ? await whole(request.node) : null };
  },
};
for (const name of WRITES) answers[name] = guarded(answers[name]);
/* What a panel says was not done, when Logseq refuses: every refusal reaches a panel in the plugin's words (F22). */
const NOT_DONE = {
  find: 'Nothing could be found', node: 'The node could not be read', tags: 'Your tags could not be read', candidates: 'The list could not be read',
  markdown: 'Nothing was copied', setWords: 'The words were not changed', newBullet: 'The bullet was not added', move: 'The bullet was not moved',
  remove: 'The bullet was not deleted', setValue: 'The property was not changed', tag: 'The tag was not changed', status: 'The status was not set',
  todoList: 'The tasks could not be read', todoStatus: 'The status was not set', todoUndo: 'Nothing was taken back', todoAdd: 'The task was not added',
  append: 'Nothing was added', note: 'The note was not added', show: 'Logseq could not go there', browse: 'Nothing could be found',
  check: 'The files could not be read', add: 'The files were not added', progress: 'How far the files are could not be read',
  unadd: 'The files were not taken out of the page', undo: 'Nothing was taken back',
};
for (const [name, run] of Object.entries(answers)) answers[name] = async request => { try { return await run(request); } catch (error) { return fail(plainly(NOT_DONE[name] || 'It was not done', error)); } };

G.part({
  key: 'outside', title: 'Alfred', about: 'Answers the Alfred workflow: its search, a node whole with its bullets and properties, and the changes made there. Needs Logseq’s HTTP APIs server switched on.',
  start(base) {
    G.outside.answer(answers);
    base.onStop(G.touch.changed(heard, true));   // every change to the graph is heard at once: it ends what Alfred may take back
    const off = Object.fromEntries(Object.keys(answers).map(name => [name, async () => ({ ok: false, said: 'The Alfred part of the Logseq Plugin is switched off.' })]));
    base.onStop(() => G.outside.answer(off));
  },
});
})();
