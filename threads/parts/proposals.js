/* Loaded after parts/two-way.js. Kept in its own scope. */
(() => {
/* What the + line, an opened node and the pick lists propose. Threads keeps no rules of its own: Predictive's core
   (predictive/core, on window.Flow: the "looks like" engine, the rules, the reader of names) and its one reading of the
   graph (Flow.app.context, kept fresh for the whole plugin) answer, and this part only puts Threads' questions in that
   core's shape and its answers in the rows'. Until 5 November 2026 this folder held its own copy of the engine
   (parts/alike.js) and of the rules (parts/shadow-rules.js), which drifted from Predictive's; they went that day.
   It draws nothing and writes nothing. The plugin's files.js loads Predictive's core before Threads; without it (a
   pretend window in the tests) this part provides nothing, and the + line proposes nothing.

   WHAT IT PROVIDES (core.provided):
   - earlierLinesRead()                              whether the graph has been read, so a mention's tag can be asked at once
   - draftProposals({ text, tag, set, journalDay })  the pieces for a node not yet made, from the words typed; never waits for a reading
   - nodeProposals(uuid)                             the pieces for a node already made, from its own words; waits for the first reading
   - pickerOrder(uuid, title)                        the page ids that fit a node's link property best, best first, for a pick list
   - namedPages(text, tagIds)                        the page ids some words name: linked, by a whole name, or by a word the graph earned
   - tagGuess(uuid)                                  the tag an untagged node's words look like, { id, uuid, title } or null
   A piece: { ident, title, kind: 'node' | 'day' | 'number', ids, shown, names, guess, many, day, journalId }. */
const shared = window.Threads.shared;
const { runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (proposals): ' });
const Flow = window.Flow;
const ready = () => !!(Flow?.propose && Flow.app && Flow.db && Flow.names && Flow.schema && Flow.text);

const context = opts => Flow.app.context(opts).catch(() => null);
// The pages linked in the words, read fresh: a page made or tagged a moment ago is otherwise unknown to the context.
const fresh = (ctx, text) => Flow.app.freshLinks(ctx, text).catch(() => ctx);
// A piece as the rows draw it. The tag a bullet might get, and a value that would tag a page, are left out: the line's tag is its own.
const plain = p => ({ ident: p.ident, title: p.prop.title, kind: p.kind, ids: p.ids, shown: p.shown, names: p.names || null, guess: !!p.guess, many: !!p.prop.many, day: p.day || 0, journalId: p.journalId > 0 ? p.journalId : null });
const shown = pieces => pieces.filter(p => p.kind !== 'tag' && !p.needsTag && !p.tagPage).map(plain);
const earlierLinesRead = () => !!Flow.app.state.ctx?.index;

// A node as the rules read one: its words, tags and values, its page and its parent.
async function bulletOf(uuid, ctx) {
  if (!Flow.text.UUID.test(String(uuid))) return null;
  const block = await Flow.db.pullBlock(uuid).catch(() => null);
  return block ? Flow.db.bulletOf(block, undefined, ctx.schema) : null;
}

// A node not yet made: the words typed, the tag it will get, what is already set on it (the row's property pointing at
// the page it is added from, a group's value: never proposed again) and the day it goes on (today's journal, unless it
// goes elsewhere).
async function draftProposals({ text, tag = '', set = [], journalDay = 0 }) {
  const words = String(text || '');
  const ctx0 = await context({ wait: false });
  if (!ctx0) return [];
  const ctx = await fresh(ctx0, words);
  const tagId = tag ? ctx.pages.find(p => p.isTag && p.lower === String(tag).toLowerCase())?.id ?? null : null;
  const journalId = journalDay ? Flow.propose.dayIdFor(ctx, journalDay) : null;
  const b = { id: 0, uuid: '', text: words, tags: tagId != null ? [tagId] : [], values: new Map(set.filter(s => s.ident && s.ids?.length).map(s => [s.ident, s.ids])),
    page: journalDay ? { id: journalId ?? -journalDay, uuid: '', title: '', day: journalDay, tags: [] } : null, parent: null };
  return shown(Flow.propose.propose(ctx, b).pieces);
}
// A node already made, opened in the rows: the pieces its own words give, as a bullet being written gets them.
async function nodeProposals(uuid) {
  const ctx0 = await context();
  const b = ctx0 && await bulletOf(uuid, ctx0);
  if (!b) return [];
  return shown(Flow.propose.propose(await fresh(ctx0, b.text), b).pieces);
}
// For a pick list: the pages the node's words link that the property takes, then what the nodes it looks like hold for
// it, each counted with the square of its likeness (an order, not a proposal). [] until the graph is read.
async function pickerOrder(uuid, title) {
  const ctx0 = await context({ wait: false });
  const prop = ctx0?.schema.props.find(p => p.type === 'node' && p.lower === String(title || '').trim().toLowerCase());
  const b = prop && await bulletOf(uuid, ctx0);
  if (!b) return [];
  const ctx = await fresh(ctx0, b.text);
  const accepted = new Set(prop.classes.map(c => c.id));
  const { links } = Flow.propose.inWords(b.text, ctx);
  const order = links.filter(page => !accepted.size || Flow.schema.fits(page, accepted, ctx.schema)).map(page => page.id);
  const score = new Map();
  for (const { entry, sim } of Flow.propose.looksLike(ctx, b.text, links, b.tags, prop, new Set([b.id])))
    for (const id of entry.values.get(prop.ident) || []) score.set(id, (score.get(id) || 0) + sim * sim);
  for (const [id] of [...score].sort((x, y) => y[1] - x[1])) if (!order.includes(id)) order.push(id);
  return order.slice(0, 5);
}
// The pages some words name, for the pick bar: linked, then by a whole name or a second name, then the one page a word
// of a name points to when the graph's lines earned it; only pages under the tags given (any tagged page with none).
async function namedPages(text, tagIds = []) {
  const words = String(text || '');
  const ctx0 = await context({ wait: false });
  if (!ctx0) return [];
  const ctx = await fresh(ctx0, words);
  const classIds = tagIds.length ? new Set(tagIds) : { has: () => true };
  const { links } = Flow.propose.inWords(words, ctx), free = Flow.propose.freeWords(words), out = [];
  for (const page of links) if (Flow.schema.fits(page, classIds, ctx.schema)) out.push(page.id);
  for (const page of Flow.names.allNamedIn(free, classIds, ctx, new Set())) if (!out.includes(page.id)) out.push(page.id);
  const one = Flow.names.namedIn(free, classIds, ctx, new Set());
  if (one && !out.includes(one.id)) out.push(one.id);
  return out;
}
// The tag an untagged mention looks like, so it can be offered to be made one: the same vote a bullet gets while it is
// written, on the node's stored words. Null for a node with a tag of yours already.
async function tagGuess(uuid) {
  const ctx0 = await context();
  const b = ctx0 && await bulletOf(uuid, ctx0);
  if (!b || b.tags.some(id => ctx0.knownTags.has(id))) return null;
  const tag = Flow.propose.tagFor(await fresh(ctx0, b.text), b, b.text);
  return tag ? { id: tag.id, uuid: tag.uuid, title: tag.title } : null;
}

function provide(core) { if (ready()) core.provide({ earlierLinesRead, draftProposals, nodeProposals, pickerOrder, namedPages, tagGuess }); }
// Another graph opened: the reading is Predictive's, and Predictive forgets it only while it runs.
function start() { if (ready()) window.Threads.core.onGraphChange(() => Flow.app.forget()); }
((window.Threads ||= {}).parts ||= []).push({ name: 'proposals', says: 'what the + line proposes', schema: [], provide, start, stop: runUnloadTasks });
})();
