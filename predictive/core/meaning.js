/* Matching by meaning: a note that says what earlier notes said in other words. Pure: given the earlier notes nearest in
   meaning (found by the helper on the Mac, logseq/meaning.js, with Apple's sentence matcher: no Apple Intelligence needed and
   no filter on health words), which tag and which values they vote for. The engine (core/engine.js) finds near notes by
   shared words; this finds them by meaning, and speaks only where the rules left a thing open.

   "Mouth feels like sandpaper, even water stings" shares no word with "Mouth so dry I could not swallow the toast", so the
   rules say nothing; by meaning the second is nearest, and its Occurrence (Dry mouth) and its tag (Symptom Log) are offered.

   near: [{ entry, sim }] best first, the entries of ctx.index with the cosine similarity of their meaning to the bullet's,
   the bullet itself left out. Limits (ctx.limits): meaningK, how many near notes vote (12); meaningLeast, how near the nearest holder must be (cosine; .45 as it
   comes, since Apple's matcher puts a note that says the same at about .5 and an unrelated one under .4); meaningLead, the
   share of the vote the leading value must hold; meaningGap, how far the nearest holder of the leading value must stand
   ahead of the nearest holder of the runner-up (a tie says nothing).

   pieces(ctx, b, result, near) -> the guesses: for an untagged bullet the rules found nothing for, the tag (how 'meaning')
   with the tag's properties as guesses under it (needsTag), as the rules pencil theirs; for a tagged bullet, nothing since
   12 November 2026 (with the limit meaningProps, each open page property the near holders agree on). Every piece is a guess: dotted, written only by Enter or a click. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { fieldsOfTags, wide, isLinkProp, isChoiceProp, isBuiltInProp } = need('schema');
const proposeLib = need('propose');

/* 12 November 2026, measured on the made-up graph of tools/harness (7,500 notes learned, 600 held-out notes written in other
   sentences, 150 plain): with the six nearest and a lead of .6 the tag was right 114 times and wrong 28, 11 plain notes were
   tagged, and a page property voted by meaning was right 22 times and wrong 18, whatever the nearness asked (.45 to .7 moved
   it by two or three: Apple's matcher puts two notes of one sentence shape nearer than two that mean the same). With the twelve
   nearest and a lead of .8: the tag right 82, wrong 20, 3 plain notes tagged. So twelve and .8, and the page properties are no
   longer voted by meaning (meaningProps; the harness can still ask for them, --set meaningProps=true).
   meaningPower: a near note votes with its nearness to this power, the square. Tried on 12 November 2026 for a small graph
   (some 40 tagged notes over nine tags, as the owner's, where the twelve nearest hold every tag and one seldom leads): the
   eighth power gave more tags on the harness (24 to 43 of 300) but 12 of them wrong where 1 was, so the square stays, and in
   a small graph the matcher mostly keeps quiet until there is more to go on.
   meaningTagged is not here: it is learned from each graph (barFrom, below), and absent, plain notes vote as they always did. */
const LIMITS = Object.freeze({ meaningLeast: .45, meaningLead: .8, meaningGap: .04, meaningK: 12, meaningProps: false, meaningPower: 2 });
const limitsOf = ctx => ({ ...LIMITS, ...(ctx.limits || {}) });

/* What the near entries holding ident agree on: each votes for its value with its similarity to the power meaningPower; the leading value wins when the nearest holder is near enough, the value holds the lead's share, and its nearest holder
   stands clear of the runner-up's. null when they do not agree. */
const vote = (near, ident, limits) => voteWhy(near, ident, limits).best;
// The same vote with why it gave nothing (why), for the measure: { best } or { best: null, why }.
function voteWhy(near, ident, limits) {
  // For the tag, plain notes vote too (their "no tag", 0): a line like many plain notes stays plain.
  const holders = near.filter(x => x.entry.values?.get(ident)?.length);
  if (!holders.length) return { best: null, why: 'no near notes' };
  if (holders[0].sim < limits.meaningLeast) return { best: null, why: 'the nearest note is too far' };
  const tally = new Map();
  let total = 0;
  for (const { entry, sim } of holders) {
    const ids = entry.values.get(ident), key = [...ids].sort((a, b) => a - b).join(',');
    const t = tally.get(key) || { ids, sum: 0, sim: 0, n: 0, from: [] };
    const weight = Math.pow(sim, limits.meaningPower);
    t.sum += weight; t.sim = Math.max(t.sim, sim); t.n++; t.from.push(entry); tally.set(key, t); total += weight;
  }
  /* The tag, where meaningTagged is set: plain notes ("no tag") do not stand against the tags. The tagged notes must hold at
     least that share of the whole vote, or the line is like plain notes; then one tag must lead among the tagged alone. So a
     graph where half the notes of a kind were never tagged still gets the kind's tag offered. */
  if (ident === 'block/tags' && limits.meaningTagged != null) {
    const plain = tally.get('0'), tagged = total - (plain?.sum || 0);
    if (!tagged || tagged / total < limits.meaningTagged) return { best: null, why: 'the near notes are plain notes' };
    tally.delete('0'); total = tagged;
  }
  const ranked = [...tally.values()].sort((a, b) => b.sum - a.sum), best = ranked[0], second = ranked[1];
  if (total && best.sum / total < limits.meaningLead) return { best: null, why: 'no value holds enough of the vote' };
  if (second && best.sim - second.sim < limits.meaningGap) return { best: null, why: 'two values as near as each other' };
  return { best };
}
/* How much of the vote tagged notes must hold before a tag is offered (meaningTagged), learned from the graph itself, since
   graphs differ: in one every note of a kind is tagged, in another half of them were never tagged, and there the untagged
   look-alikes would outvote the tag every time (12 November 2026: on the owner's graph the matcher gave no tag to any of 40
   notes; the harness did the same once half its notes of each kind were left untagged). taggedShare(near): the share of a
   vote that tagged notes hold. barFrom(shares): from the shares around a sample of the graph's own tagged notes, seven tenths
   of the usual one (the median), never under .15 nor over .8; null with fewer than 20 notes to go on, and then plain notes
   vote as they always did. */
function taggedShare(near, power = LIMITS.meaningPower) {
  let tagged = 0, total = 0;
  for (const { entry, sim } of near || []) { const ids = entry.values?.get('block/tags') || []; if (!ids.length) continue; const weight = Math.pow(sim, power); total += weight; if (!(ids.length === 1 && ids[0] === 0)) tagged += weight; }
  return total ? tagged / total : 0;
}
const SAMPLE = 80, SAMPLE_LEAST = 20;
function barFrom(shares) {
  if (!shares || shares.length < SAMPLE_LEAST) return null;
  const sorted = [...shares].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  return Math.min(.8, Math.max(.15, Math.round(70 * median) / 100));
}
// The tagged bullets a graph is sampled by: up to SAMPLE of them, spread evenly over the index (pages left out).
function sampleOf(ctx) {
  const tagged = (ctx.index?.entries || []).filter(e => e.tokens?.length && !ctx.byId.has(e.id) && (e.values.get('block/tags') || [])[0] > 0);
  const step = Math.max(1, Math.floor(tagged.length / SAMPLE));
  return tagged.filter((e, i) => i % step === 0).slice(0, SAMPLE);
}

/* Why an untagged bullet got no tag by meaning, in a few plain words, for the measure's report (names of reasons only): null
   when it would get one. The same steps as wanted and pieces, in their order. */
function whyNoTag(ctx, b, result, near) {
  if (!result || !ctx.index) return 'no graph read';
  if (result.pieces.length || result.assume) return 'the rules already proposed something';
  if (b.tags.length || proposeLib.inWords(b.text, ctx).tags.length) return 'a tag is already there';
  if (proposeLib.recordOf(b, [], ctx.schema).fields.length) return 'it sits under a tagged bullet';
  if (!proposeLib.enoughForTag(ctx, b.text)) return 'too few words';
  const { best, why } = voteWhy(near || [], 'block/tags', limitsOf(ctx));
  if (!best) return why;
  if (best.ids.length === 1 && best.ids[0] === 0) return 'the near notes are plain notes';
  const page = best.ids.length === 1 && ctx.byId.get(best.ids[0]);
  return page?.isTag && page.uuid && ctx.knownTags.has(page.id) ? null : 'the near notes\' tag is not one bullets carry';
}
// The two nearest earlier notes behind a vote, as words, for saying why (a saved link read as its page's name).
const examples = (ctx, from) => [...new Set(from.slice(0, 2).map(e => String(e.title || '').replace(/\[\[([^\]]+)\]\]/g, (m, k) => ctx.byKey.get(k.toLowerCase())?.title || k).replace(/\s+/g, ' ').trim()).filter(Boolean))];

// Whether there is anything meaning could fill: an untagged bullet the rules pencilled nothing for, or open page properties.
function wanted(ctx, b, result) {
  if (!result || !ctx.index) return false;
  if (!result.pieces.length && !result.assume) return !b.tags.length && !proposeLib.inWords(b.text, ctx).tags.length && proposeLib.recordOf(b, [], ctx.schema).fields.length === 0 && proposeLib.enoughForTag(ctx, b.text);
  return !!limitsOf(ctx).meaningProps && openProps(ctx, b, result).length > 0;
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
  if (!limits.meaningProps) return out;   // a page property voted by meaning was wrong nearly as often as right (see LIMITS)
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

const api = { LIMITS, vote, voteWhy, whyNoTag, taggedShare, barFrom, sampleOf, wanted, openProps, pieces, nearOf, textOf, examples };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).meaning = api;
})();
