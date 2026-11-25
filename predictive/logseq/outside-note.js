/* A note written from outside Logseq, in the Alfred workflow's Add panel (outside.js asks; 18 November 2026). The proposals
   Predictive pencils under a tagged bullet you write in Logseq, for words that are not in a bullet yet: the tag first, then the properties
   it brings. And the note written with the ones you took, through the same writer and the same lessons, with one Undo.

     guess({ words, where, tag })  → { tag, sure, choices, pieces }   nothing written
     note({ words, where, tag, take, refused }) → { uuid, page, tag, wrote }
     undo({ uuid })                → { undone }

   `where` is outside.js's: "today", "open" or { page }. `tag` is a tag's id the caller picked (⌘T in the panel), or null for the
   guess. The panel asks for a tag with every guess, so here one is still offered (core/propose.js, offerTag: four words, the
   nearest earlier lines, a tag's own words, words written before with a tag); in Logseq a bullet is offered none by itself since
   24 November 2026. The other tags it could be come as `choices`, best first, in the order of Option-T's list (tagChoices), which
   the panel offers on keys and never takes by Enter. */
(function () {
const Flow = window.Flow, Door = window.PluginDoor;

// The page the note will go on, read only: a guess makes nothing. Today's journal may not exist yet; its day still counts.
async function pageOf(where) {
  if (where === 'today' || !where) {
    const today = await logseq.Editor.getTodayPage().catch(() => null);
    if (today?.uuid) return { id: today.id, uuid: today.uuid, title: today.title || '', day: Number(today.journalDay) || Door.dates.today(), tags: [] };
    return { id: null, uuid: '', title: '', day: Door.dates.today(), tags: [] };
  }
  const p = where === 'open' ? await logseq.Editor.getCurrentPage().catch(() => null) : await logseq.Editor.getPage(String(where.page || '')).catch(() => null);
  return p?.uuid ? { id: p.id, uuid: p.uuid, title: p.title || p.name || '', day: Number(p.journalDay) || 0, tags: (p.tags || []).map(t => (typeof t === 'object' ? t.id : t)) } : null;
}
const tagOf = (ctx, id) => { const t = ctx.byId.get(Number(id)); return t && t.isTag ? { id: Number(id), uuid: t.uuid, title: t.title } : null; };
const fieldsOf = (ctx, id) => Flow.schema.fieldsOfTags([id], ctx.schema).map(p => p.title);
// What the panel draws of a proposed value: its property, the value as it will read, and whether it is only a guess.
const piecesOut = pieces => pieces.filter(p => p.kind !== 'tag').map(p => ({ key: p.ident, prop: p.prop?.title || '', shown: p.shown || '', guess: Boolean(p.guess), made: '' }));   // made: a new page's title, never since the name finder went; the panel still reads it

async function proposal(ctx, b, tagId) {
  if (tagId) {
    const tag = tagOf(ctx, tagId);
    if (!tag) throw new Error('That tag is not in this graph');
    const r = Flow.propose.propose(ctx, { ...b, tags: [tag.id] }, tag);
    return { tag: { ...tag, why: 'you picked it' }, sure: true, pieces: r.pieces };
  }
  const r = Flow.propose.propose(ctx, b, null, { offerTag: true }), t = r.pieces.find(p => p.kind === 'tag');
  return t ? { tag: { id: t.tag.id, uuid: t.tag.uuid, title: t.tag.title, why: t.why || '' }, sure: false, pieces: r.pieces } : { tag: null, sure: false, pieces: r.pieces };
}
async function bulletFor(words, where) {
  const ctx0 = await Flow.app.context({ wait: false });
  if (!ctx0) return { ctx: null };
  Flow.lessonsStore?.load(ctx0.graph);
  const ctx = await Flow.app.freshLinks(ctx0, words);
  return { ctx, b: { id: null, uuid: '', text: words, tags: [], values: new Map(), page: await pageOf(where), parent: null } };
}

async function guess({ words = '', where = 'today', tag = null } = {}) {
  words = String(words).trim();
  if (!words) return { tag: null, choices: [], pieces: [] };
  const { ctx, b } = await bulletFor(words, where);
  if (!ctx) return { loading: true, tag: null, choices: [], pieces: [] };
  const got = await proposal(ctx, b, tag);
  const choices = Flow.propose.tagChoices(ctx, b, { max: 5 }).filter(c => c.tag.id !== got.tag?.id)
    .map(c => ({ id: c.tag.id, uuid: c.tag.uuid, title: c.tag.title, fields: c.fields, why: Flow.tagPick?.reasonOf ? Flow.tagPick.reasonOf(c) : '' }));
  return { tag: got.tag && { ...got.tag, fields: fieldsOf(ctx, got.tag.id) }, sure: got.sure, choices, pieces: piecesOut(got.pieces), enough: Flow.propose.enoughForTag ? Boolean(Flow.propose.enoughForTag(ctx, words)) : true };
}

// Undo for each note written here, by its id: what was filled in, then the note itself. Kept while Logseq runs.
const undos = new Map();
async function note({ words = '', where = 'today', tag = null, take = 'all', refused = null } = {}) {
  words = String(words).trim();
  if (!words) throw new Error('There are no words to add');
  const target = await Door.outside.page(where);
  const block = await Door.write.appendBlock(target.uuid, words);
  if (!block?.uuid) throw new Error('Logseq did not take the note');
  const uuid = block.uuid, wrote = [];
  let undoFills = null, tagTitle = '';
  try {
    const { ctx } = await bulletFor(words, where);
    const pulled = ctx && await Flow.db.pullBlock(uuid);
    if (ctx && pulled && (tag || take !== 'none')) {
      const b = Flow.db.bulletOf(pulled, words, ctx.schema), got = await proposal(ctx, b, tag);
      const wanted = got.pieces.filter(p => p.kind === 'tag' ? Boolean(tag) || take === 'all' : take === 'all' || (Array.isArray(take) && take.includes(p.ident)));
      const tagPiece = tag && got.tag ? [{ ident: 'block/tags', kind: 'tag', ids: [got.tag.id], tag: got.tag, prop: { ident: 'block/tags', title: 'Tags' } }] : [];
      const pieces = [...tagPiece, ...wanted.filter(p => p.kind !== 'tag' || !tag)].map(p => (tag ? { ...p, needsTag: false } : p));
      if (pieces.length) {
        const { written, undo } = await Flow.proposeUi.writePieces(uuid, pieces);
        undoFills = undo;
        for (const p of written) if (p.kind === 'tag') tagTitle = p.tag.title; else wrote.push({ prop: p.prop.title, shown: p.shown || '' });
      }
    }
    // A tag shown and left untaken is a no, as the × is in Logseq.
    if (refused && ctx) { const t = tagOf(ctx, refused); if (t) Flow.lessonsStore?.note({ kind: 'tag', ident: 'block/tags', ids: [t.id], tag: t, how: 'alike-tag', from: 'words' }, 'no'); }
  } catch (error) { console.error('From outside: the note went in, its proposals did not', error); }
  undos.set(uuid, async () => { if (undoFills) await undoFills(); await Door.write.removeBlock(uuid); });
  return { uuid, page: target.title || target.name || '', tag: tagTitle, wrote };
}
async function undo({ uuid } = {}) {
  const run = undos.get(String(uuid || ''));
  if (!run) throw new Error('That note can no longer be taken back from here: use Undo in Logseq');
  undos.delete(String(uuid));
  await run();
  return { undone: true };
}

// Every tag of yours, under your own top-level tags in the order of the tree, each with its place ("Person › Doctor") and the
// properties it brings: the panel's ⌘T sheet filters this list as you type.
async function tags() {
  const ctx = await Flow.app.context({ wait: true });
  if (!ctx) return { tags: [] };
  const { schema } = ctx, mine = id => { const t = ctx.byId.get(id); return t && t.isTag && !schema.builtIn?.has(id); };
  const ids = [...ctx.byId.keys()].filter(mine);
  const parentOf = id => (schema.parentsOf.get(id) || []).find(p => mine(p) && p !== id) ?? null;
  const children = new Map();
  for (const id of ids) { const up = parentOf(id); if (!children.has(up)) children.set(up, []); children.get(up).push(id); }
  const title = id => ctx.byId.get(id).title, out = [];
  const walk = (id, path, depth) => {
    out.push({ id, uuid: ctx.byId.get(id).uuid, title: title(id), path: [...path, title(id)].join(' › '), depth, fields: Flow.schema.fieldsOfTags([id], schema).map(p => p.title) });
    for (const c of (children.get(id) || []).sort((a, b) => title(a).localeCompare(title(b)))) if (depth < 12) walk(c, [...path, title(id)], depth + 1);
  };
  for (const top of (children.get(null) || []).sort((a, b) => title(a).localeCompare(title(b)))) walk(top, [], 0);
  return { tags: out };
}

Flow.outsideNote = { guess, note, undo, tags };
})();
