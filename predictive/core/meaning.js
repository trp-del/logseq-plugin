/* Matching by meaning: a note that says what earlier notes said in other words. Pure: given the earlier notes nearest in
   meaning (found by the helper on the Mac, logseq/meaning.js, with Apple's sentence matcher: no Apple Intelligence needed and
   no filter on health words), which tag and which values they vote for. The engine (core/engine.js) finds near notes by
   shared words; this finds them by meaning, and speaks only where the rules left a thing open.

   "Mouth feels like sandpaper, even water stings" shares no word with "Mouth so dry I could not swallow the toast", so the
   rules say nothing; by meaning the second is nearest, and its Occurrence (Dry mouth) and its tag (Symptom Log) are offered.

   near: [{ entry, sim }] best first, the entries of ctx.index with the cosine similarity of their meaning to the bullet's,
   the bullet itself left out. Limits (ctx.limits): meaningLeast, how near the nearest holder must be (cosine; .45 as it
   comes, since Apple's matcher puts a note that says the same at about .5 and an unrelated one under .4); meaningLead, the
   share of the vote the leading value must hold; meaningGap, how far the nearest holder of the leading value must stand
   ahead of the nearest holder of the runner-up (a tie says nothing).

   pieces(ctx, b, result, near) -> the guesses: for an untagged bullet the rules found nothing for, the tag (how 'meaning')
   with the tag's properties as guesses under it (needsTag), as the rules pencil theirs; for a tagged bullet, each open page
   property the near holders agree on. Every piece is a guess: dotted, written only by Enter or a click. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { fieldsOfTags, wide, isLinkProp, isChoiceProp, isBuiltInProp } = need('schema');
const proposeLib = need('propose');

const LIMITS = Object.freeze({ meaningLeast: .45, meaningLead: .6, meaningGap: .04, meaningK: 6 });
const limitsOf = ctx => ({ ...LIMITS, ...(ctx.limits || {}) });

/* What the near entries holding ident agree on: each votes for its value with the square of its similarity, as the engine
   does; the leading value wins when the nearest holder is near enough, the value holds the lead's share, and its nearest holder
   stands clear of the runner-up's. null when they do not agree. */
function vote(near, ident, limits) {
  // For the tag, plain notes vote too (their "no tag", 0): a line like many plain notes stays plain.
  const holders = near.filter(x => x.entry.values?.get(ident)?.length);
  if (!holders.length || holders[0].sim < limits.meaningLeast) return null;
  const tally = new Map();
  let total = 0;
  for (const { entry, sim } of holders) {
    const ids = entry.values.get(ident), key = [...ids].sort((a, b) => a - b).join(',');
    const t = tally.get(key) || { ids, sum: 0, sim: 0, n: 0, from: [] };
    t.sum += sim * sim; t.sim = Math.max(t.sim, sim); t.n++; t.from.push(entry); tally.set(key, t); total += sim * sim;
  }
  const ranked = [...tally.values()].sort((a, b) => b.sum - a.sum), best = ranked[0], second = ranked[1];
  if (total && best.sum / total < limits.meaningLead) return null;
  if (second && best.sim - second.sim < limits.meaningGap) return null;
  return best;
}
// The two nearest earlier notes behind a vote, as words, for saying why (a saved link read as its page's name).
const examples = (ctx, from) => [...new Set(from.slice(0, 2).map(e => String(e.title || '').replace(/\[\[([^\]]+)\]\]/g, (m, k) => ctx.byKey.get(k.toLowerCase())?.title || k).replace(/\s+/g, ' ').trim()).filter(Boolean))];

// Whether there is anything meaning could fill: an untagged bullet the rules pencilled nothing for, or open page properties.
function wanted(ctx, b, result) {
  if (!result || !ctx.index) return false;
  if (!result.pieces.length && !result.assume) return !b.tags.length && !proposeLib.inWords(b.text, ctx).tags.length && proposeLib.recordOf(b, [], ctx.schema).fields.length === 0 && proposeLib.enoughForTag(ctx, b.text);
  return openProps(ctx, b, result).length > 0;
}
// The page properties of the bullet's own tags that nothing filled: not held, not proposed, not held back (quiet), not wide.
function openProps(ctx, b, result) {
  if (result.record !== b && !result.assume) return [];
  const tags = [...new Set([...b.tags, ...proposeLib.inWords(b.text, ctx).tags, ...(result.assume ? [result.assume.id] : [])])];
  const done = new Set(result.pieces.map(p => p.ident)), quiet = new Set(result.quiet || []);
  return fieldsOfTags(tags, ctx.schema).filter(prop => isLinkProp(prop) && !isChoiceProp(prop) && !isBuiltInProp(prop) && !wide(prop, ctx.schema)
    && !done.has(prop.ident) && !quiet.has(prop.ident) && !(b.values?.get(prop.ident) || []).length);
}

const tagPiece = (tag, from) => ({ ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'meaning', from, guess: true });

function pieces(ctx, b, result, near) {
  if (!near?.length || !result) return [];
  const limits = limitsOf(ctx), out = [];
  const known = id => { const page = ctx.byId.get(id); return page?.isTag && page.uuid && ctx.knownTags.has(page.id) ? page : null; };
  // No tag and nothing from the rules: the tag the near notes carry, with its properties as guesses that wait for it.
  if (!result.pieces.length && !result.assume && !b.tags.length) {
    if (!proposeLib.enoughForTag(ctx, b.text)) return [];   // a tag waits for enough words (core/propose.js)
    const voted = vote(near, 'block/tags', limits), tag = voted && voted.ids.length === 1 && known(voted.ids[0]);
    if (!tag) return [];
    const from = examples(ctx, voted.from);
    const tagged = { ...b, tags: [...b.tags, tag.id] }, assumed = proposeLib.propose(ctx, tagged, tag);
    const under = assumed.pieces.map(piece => ({ ...piece, guess: true, needsTag: true }));
    const rest = pieces(ctx, tagged, { ...assumed, record: tagged }, near).map(piece => ({ ...piece, needsTag: true }));
    return [tagPiece({ ...tag, from }, from), ...under, ...rest.filter(p => !under.some(q => q.ident === p.ident))];
  }
  for (const prop of openProps(ctx, b, result)) {
    const classIds = new Set(prop.classes.map(c => c.id));
    const voted = vote(near, prop.ident, limits);
    if (!voted) continue;
    const pages = voted.ids.map(id => ctx.byId.get(id));
    if (pages.some(p => !p || !need('schema').fits(p, classIds, ctx.schema))) continue;
    if (!prop.many && pages.length !== 1) continue;
    out.push({ ident: prop.ident, prop, kind: 'node', ids: voted.ids, shown: pages.map(p => p.title).join(', '), ...(pages.length > 1 ? { names: pages.map(p => ({ id: p.id, title: p.title })) } : {}), how: 'meaning', from: examples(ctx, voted.from), guess: true });
  }
  return out;
}

// The near entries from the helper's answer ([{ id, sim }]) as the vote wants them: the context's own entries, by id.
function nearOf(ctx, found) {
  const byId = ctx.index?.byId || (ctx.index && (ctx.index.byId = new Map(ctx.index.entries.map((e, i) => [e.id, i]))));
  if (!byId) return [];
  return (found || []).map(({ id, sim }) => { const i = byId.get(Number(id)); const entry = i == null ? null : ctx.index.entries[i]; return entry && entry.tokens?.length ? { entry, sim: Number(sim) || 0 } : null; }).filter(Boolean);
}
// The words a note is learned by: a saved link read as its page's name, tags left out, so the matcher reads what the person reads.
const textOf = (ctx, title) => String(title || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => ' ' + (ctx.byKey.get(String(key).toLowerCase())?.title || key) + ' ').replace(/(?:^|\s)#[^\s#\[\]]+/g, ' ').replace(/\s+/g, ' ').trim();

const api = { LIMITS, vote, wanted, openProps, pieces, nearOf, textOf, examples };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).meaning = api;
})();
