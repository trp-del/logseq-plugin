/* The proposals' rules: given a context (one graph) and the bullet being written, what the properties of its record could
   hold. Ported from logseq-db-refinements (parts/shadow-rules.js) and rebuilt on plain data so it runs anywhere: no
   Logseq, no screen, no global state. Draws nothing and writes nothing.

   The bullet:  { id, uuid, text, tags: [tagIds], values: Map(propIdent -> [ids]),
                  page: { id, uuid, title, day (a journal page's day number, else 0), tags: [tagIds] } | null,
                  parent: { id, uuid, tags, values } | null }       (a parent that is a page is null)
   A piece:     { ident, prop, kind: 'node' | 'day' | 'number' | 'tag', ids, shown, how, guess?, day?, journalId?,
                  names?, from?, tagPage?, needsTag?, note? }

   Two grades of evidence, as before. SURE pieces read what is literally there: a page linked in the words that fits a
   property, the page the bullet is written on, the journal day where this graph always dates a thing the day it is
   written. GUESSES come from resemblance (the engine), plain names, dates and numbers in the words, the parent's values.
   Where several rules speak they must agree, or nothing is proposed: a wrong fill taken by habit is the one thing that
   must not happen.

   What is different from the version this came from, so that it works on any graph:
   - No property is found by its title. A Date is any property of type date, and whether the journal day suits it is
     read from the graph (dated[ident]: for each tag, how many nodes carry the day they were written on, how many another).
   - No list of English words that name nothing: ctx.common comes from the graph's own lines (context.js).
   - Dates in words come from a locale (dates.js). Nothing else here is language-bound.
   - Limits live in ctx.limits, so each graph can be tuned (score.js). */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { LINK, TAG, UUID, wordsOf, cleanWords, sameIds } = need('text');
const engine = need('engine');
const schemaLib = need('schema');
const { fieldsOfTags, fits, wide, untagged, isNumberProp, isDateProp, isChoiceProp, isLinkProp, isBuiltInProp } = schemaLib;
const names = need('names');
const { shownWords, linkIdsIn, profileOf } = need('context');
const { profileTag } = need('profile');
const { dayNumber } = need('dates');

const valuesOf = (node, ident) => node?.values?.get(ident) || [];

// The pages linked in the words ([[uuid]] as saved, [[Name]] in the text box), in order, each once; and the tags written
// in the words (#Consultation, #[[Symptom log]]), as tag ids. A link to a page's second name is that page.
function inWords(text, ctx) {
  const links = [], tags = [];
  const words = String(text || '');
  for (const [, key] of words.matchAll(LINK)) {
    const named = ctx.byKey.get(key.trim().toLowerCase()), page = (named?.aliasOf && ctx.byId.get(named.aliasOf.id)) || named;
    if (page && !links.includes(page)) links.push(page);
  }
  const lower = words.toLowerCase();
  for (const m of words.matchAll(TAG)) {
    const at = m.index + m[0].indexOf('#') + 1, rest = lower.slice(at);
    // The longest tag name that follows the #: Logseq shows a two-word tag as "#Symptom log", no brackets. "#Doctor's" is
    // not #Doctor: Logseq reads the whole word as the tag.
    const name = m[1] ? m[1].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w'’-]/.test(rest.charAt(t.length))) || m[2].toLowerCase();
    const page = ctx.byKey.get(name);
    if (page?.isTag && !tags.includes(page.id)) tags.push(page.id);
  }
  return { links, tags };
}

// The record (the bullet, or its parent when only the parent's tags give properties) and its properties, the most
// particular first: a link is claimed by doctor, taking #Doctor, before with, taking #Person.
function recordOf(b, ownTags, schema) {
  let record = b, fields = fieldsOfTags(ownTags, schema);
  if (!fields.length && b.parent) {
    const parentFields = fieldsOfTags(b.parent.tags, schema);
    if (parentFields.length) { record = b.parent; fields = parentFields; }
  }
  const depth = id => { let d = 0, q = [id]; const seen = new Set(); while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.parentsOf.get(c) || []) q.push(p); d = Math.max(d, seen.size); } return d; };
  // A wide property comes last: a narrower one that takes the link claims it first.
  const particular = prop => prop.type !== 'node' ? -1 : wide(prop, schema) ? -0.5 : Math.max(0, ...prop.classes.map(c => depth(c.id)));
  const ordered = fields.map((prop, i) => ({ prop, i, rank: particular(prop) })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(x => x.prop);
  return { record, fields, ordered };
}

/* Dates, read from the graph. dated[ident] is, for each tag, { same, other }: how many of its nodes hold this date
   property equal to the journal day they were written on, and how many another day. Sure only with evidence: at least 5
   such nodes and 19 in 20 dated the day written. */
const DATED_LEAST = 5, DATED_SHARE = .95, DATED_GUESS_SHARE = .8;
function datedEvidence(ctx, prop, tagIds) {
  let same = 0, other = 0;
  const byTag = ctx.dated?.get(prop.ident);
  for (const id of tagIds) { const n = byTag?.get(id); if (n) { same += n.same; other += n.other; } }
  return { same, other };
}
const datedWhenWritten = ev => ev.same + ev.other >= DATED_LEAST && ev.same / (ev.same + ev.other) >= DATED_SHARE;
// The journal day as a guess: one to four dated nodes, all the day written; or more, dated the day written at least 4 times
// in 5 but under the bar for sure. "At least one": no evidence is not permission.
function fewDatedAllSameDay(ev) {
  if (ev.same + ev.other >= DATED_LEAST) return ev.same / (ev.same + ev.other) >= DATED_GUESS_SHARE && !datedWhenWritten(ev);
  return ev.same >= 1 && ev.other === 0;
}
const mostlyAhead = ev => ev.other >= DATED_LEAST && ev.other > ev.same;
// A date in the words is the record's own only for a tag whose nodes are dated ahead at least as often as on the day
// written, or that has none dated yet: a visit's "I can drive in two weeks" is another day.
const datedAhead = ev => ev.other >= ev.same;

const dayIdFor = (ctx, day) => (ctx.dayIds ||= new Map([...(ctx.days || [])].map(([id, d]) => [d, id]))).get(day) ?? null;
// A day as the pencil shows it, with the year when it is not this year.
const dayText = (ctx, day) => {
  if (!day) return '';
  const year = Math.floor(day / 10000);
  return `${(ctx.reader.locale.months[Math.floor(day / 100) % 100 - 1] || '').slice(0, 3).replace(/^./, c => c.toUpperCase())} ${day % 100}${year === new Date().getFullYear() ? '' : `, ${year}`}`;
};

// The tag of the nodes an untagged bullet looks like: by its words and links alone, among every node the engine knows;
// the nearest vote, under the tag's own stricter limits. Plain lines vote "no tag" (0), so a line like many plain notes
// stays plain.
// The tag an untagged bullet reads like, in two stages: the nearest earlier lines vote (a near-twin, almost never wrong);
// when they find none, the tags' word profiles (core/profile.js) are asked, which know the words a tag's lines use as a
// whole. Either way a tag of yours that bullets carry, or nothing.
function tagFor(ctx, b, text) {
  if (!ctx.index) return null;
  const { links } = inWords(text, ctx);
  const tokens = engine.tokensOf(shownWords(text, ctx), ctx.limits.tagLinks === false ? [] : links.map(p => p.id), [], ctx.limits);
  if (tokens.length < 2) return null;
  const near = engine.neighbours(ctx.index, tokens, { k: ctx.limits.k, skip: new Set([b.id]), keep: entry => entry.values.get('block/tags')?.length > 0 });
  const voted = engine.vote(near, 'block/tags', { nearLeast: ctx.limits.tagNearLeast, lead: ctx.limits.tagLead, least: ctx.limits.tagLeast });
  const known = id => { const page = ctx.byId.get(id); return page?.isTag && page.uuid && ctx.knownTags.has(page.id) ? page : null; };
  if (voted && voted.ids.length === 1 && voted.ids[0] !== 0) {
    const page = known(voted.ids[0]);
    return page ? { ...page, from: examplesFor(ctx, near, 'block/tags', voted.ids), by: 'vote' } : null;
  }
  const sounded = profileTag(profileOf(ctx), tokens, ctx.limits.tagGap, { skip: b.id });
  const page = sounded && known(sounded.id);
  return page ? { ...page, from: examplesFor(ctx, near, 'block/tags', [sounded.id]), by: 'profile' } : null;
}
// The earlier bullets behind a vote, for saying why: the two nearest that held what was voted, as words, each once.
function examplesFor(ctx, near, ident, ids) {
  const key = [...ids].sort((a, b) => a - b).join(',');
  const said = near.filter(x => [...(x.entry.values.get(ident) || [])].sort((a, b) => a - b).join(',') === key)
    .map(x => String(x.entry.title || '').replace(/\[\[([^\]]+)\]\]/g, (m, k) => (UUID.test(k) ? ctx.byKey.get(k.toLowerCase())?.title || '' : k)).replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [...new Set(said)].slice(0, 2);
}
// The nodes the bullet looks like, for one property: the nearest earlier holders of it, by the bullet's words (links read
// as titles), its links and the record's tags; the bullet itself left out.
function looksLike(ctx, text, links, tagIds, prop, skip) {
  if (!ctx.index) return [];
  const tokens = engine.tokensOf(shownWords(text, ctx), links.map(p => p.id), tagIds, ctx.limits);
  return engine.neighbours(ctx.index, tokens, { k: ctx.limits.k, skip, keep: entry => entry.values.get(prop.ident)?.length > 0 });
}
const namesOf = pages => pages.length > 1 ? { names: pages.map(p => ({ id: p.id, title: p.title })) } : {};
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));

function propose(ctx, b, assume = null) {
  const { schema } = ctx;
  const text = b.text;
  const { links, tags: typedTags } = inWords(text, ctx);
  const allTags = [...new Set([...b.tags, ...typedTags])];
  const { record, fields, ordered } = recordOf(b, allTags, schema);
  const pieces = [];

  // No tag, and no record above: the tag of the nodes it looks like, with the properties it brings, all guesses.
  if (!fields.length) {
    const tag = allTags.length || assume ? null : tagFor(ctx, b, text);
    if (!tag) return { record, pieces };
    const assumed = propose(ctx, { ...b, tags: [...b.tags, tag.id] }, tag);
    const tagPiece = { ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'alike-tag', from: tag.from, guess: true };
    return { record: b, pieces: [tagPiece, ...assumed.pieces.map(piece => ({ ...piece, guess: true, needsTag: true }))], assume: tag };
  }

  const recordTags = record === b ? allTags : record.tags;
  const page = b.page, journalDay = page?.day || 0;
  const pageAsPage = page && !journalDay ? { id: page.id, uuid: page.uuid, title: page.title, tags: (page.tags || []).map(id => ({ id })) } : null;
  const held = new Set(fields.flatMap(prop => valuesOf(record, prop.ident)));
  const free = links.filter(p => !held.has(p.id)), used = new Set(), quiet = new Set();
  let pageUsed = false;

  for (const prop of ordered) {
    const filled = valuesOf(record, prop.ident).length > 0;
    if (isLinkProp(prop)) {
      const classIds = new Set(prop.classes.map(c => c.id));
      const fitting = free.filter(p => !used.has(p) && fits(p, classIds, schema));
      // A filled property still claims the links it takes: a second doctor named when doctor is filled does not become "with".
      if (fitting.length) {
        for (const p of fitting) used.add(p);
        // From a note under the record, only a one-value property is sure: a list of people in a note is not the record's
        // "spoke with". Into a wide property, only from the record's own words, and only as a guess.
        const isWide = wide(prop, schema);
        if (!filled && (prop.many ? record === b : fitting.length === 1) && !(isWide && record !== b)) {
          pieces.push({ ident: prop.ident, prop, kind: 'node', ids: fitting.map(p => p.id), shown: fitting.map(p => p.title).join(', '), ...namesOf(fitting), how: 'linked', ...(isWide ? { guess: true, how: 'linked-wide' } : {}) });
        } else quiet.add(prop.ident);   // two names for one place: quiet, and the names are spoken for
        continue;
      }
      if (filled) continue;
      // The page the bullet is written on fills one property only, the most particular that takes it.
      if (pageAsPage && !pageUsed && pageAsPage.id !== record.id && fits(pageAsPage, classIds, schema)) {
        pageUsed = true; used.add(ctx.byId.get(pageAsPage.id) || pageAsPage);
        pieces.push({ ident: prop.ident, prop, kind: 'node', ids: [pageAsPage.id], shown: pageAsPage.title, how: 'page', ...(wide(prop, schema) ? { guess: true, how: 'page-wide' } : {}) });
        continue;
      }
    } else if (!filled && isDateProp(prop)) {
      // The journal day only where this graph shows the tag's nodes are dated the day they are written.
      if (journalDay && datedWhenWritten(datedEvidence(ctx, prop, recordTags))) pieces.push({ ident: prop.ident, prop, kind: 'day', ids: [page.id], day: journalDay, journalId: page.id, shown: dayText(ctx, journalDay), how: 'day' });
    }
  }
  pieces.sort((a, c) => fields.indexOf(a.prop) - fields.indexOf(c.prop));   // shown in the order the tag gives them
  const guesses = guessesFor(ctx, { b, text, record, fields: ordered, recordTags, links, free, used, quiet, done: new Set(pieces.map(p => p.ident)) });
  guesses.sort((a, c) => fields.indexOf(a.prop) - fields.indexOf(c.prop));
  // quiet: the properties held back (two names for one place), which nothing else may fill either (core/model.js).
  return { record, pieces: [...pieces, ...guesses], quiet: [...quiet] };
}

function guessesFor(ctx, { b, text, record, fields, recordTags, links, free, used, quiet, done }) {
  const own = record === b, journalDay = b.page?.day || 0, reader = ctx.reader;
  const parentTags = own && b.parent ? b.parent.tags : [];
  const skip = new Set([b.id]);
  const words = freeWords(text), spoken = new Set(used), out = [];
  const open = prop => !done.has(prop.ident) && !quiet.has(prop.ident) && !valuesOf(record, prop.ident).length;
  // Only one date open: with two (a start and an end) the words cannot say which, so only the graph's evidence speaks.
  const openDates = fields.filter(p => isDateProp(p) && open(p));
  const oneDate = openDates.length === 1;
  const nodeOf = id => ctx.byId.get(id);
  for (const prop of fields) {
    if (!open(prop)) continue;
    const isNode = isLinkProp(prop), isDate = isDateProp(prop), isNumber = isNumberProp(prop);
    if (!isNode && !isDate && !isNumber) continue;
    if (isChoiceProp(prop)) continue;   // a choice (Status ...) is never proposed: where a thing stands is rarely in its words
    const said = [];
    // A number beside the property's name ("cycle 5"). Not from look-alike bullets: how bad a day was is not in its words.
    if (isNumber) {
      const n = own ? reader.numberInWords(text, prop.title) : null;
      if (n != null) out.push({ ident: prop.ident, prop, kind: 'number', ids: [n], shown: String(n), how: 'words-number', guess: true });
      continue;
    }
    if (parentTags.length) { const v = valuesOf(b.parent, prop.ident); if (v.length) said.push({ ids: v, how: 'parent' }); }
    if (isNode) {
      const classIds = new Set(prop.classes.map(c => c.id));
      const near = own ? looksLike(ctx, text, links, recordTags, prop, skip) : [];
      const voted = own ? engine.vote(near, prop.ident, { nearLeast: ctx.limits.nearLeast, lead: ctx.limits.lead }) : null;
      if (voted) said.push({ ids: voted.ids, how: 'alike', from: examplesFor(ctx, near, prop.ident, voted.ids) });
      // Two names or more for a property that holds several: the words say who, and the rest is not asked.
      let several = prop.many && !wide(prop, ctx.schema) ? names.allNamedIn(words, classIds, ctx, spoken) : [];
      // Names a one-value property of the bullet takes too (two doctors where the bullet also has one doctor) are spoken for
      // by that property, as two linked doctors are, so they do not spill over.
      if (several.length > 1 && fields.some(q => q !== prop && !q.many && isLinkProp(q) && !wide(q, ctx.schema) && open(q) && several.every(p => fits(p, new Set(q.classes.map(c => c.id)), ctx.schema)))) several = [];
      const named = several.length > 1 || wide(prop, ctx.schema) ? null : names.namedIn(words, classIds, ctx, spoken);
      if (several.length > 1) said.splice(0, said.length, { ids: several.map(p => p.id), how: 'words' });
      else if (named) said.push({ ids: [named.id], how: 'words' });
    }
    if (isDate) {
      const ev = datedEvidence(ctx, prop, recordTags);
      // The journal day, as a guess, where the graph has too few dated nodes to be sure but at least one, none of them
      // dated another day. A tag whose nodes are dated other days (written ahead) still gets nothing.
      if (!said.length && journalDay && fewDatedAllSameDay(ev)) said.push({ ids: [b.page.id], how: 'day' });
      // A date written in the words, counted from the day the bullet is written on (else today); one, or nothing.
      if (own && oneDate && datedAhead(ev)) {
        const days = reader.daysInWords(text, journalDay || dayNumber(new Date()));
        if (days.length === 1) { const id = dayIdFor(ctx, days[0]); said.push({ ids: [id ?? -days[0]], day: days[0], how: 'words-day' }); }
      }
      // Nothing else said a day, and the graph has no evidence either way: on a journal page, the journal day, as a guess to
      // check. Only for the bullet's own and only date, not when the words name two days or point ahead without naming one
      // ("next week"), not for Logseq's own Deadline and Scheduled, and not for a tag whose nodes are mostly dated ahead.
      if (own && !said.length && oneDate && journalDay && !isBuiltInProp(prop) && reader.daysInWords(text, journalDay).length < 2 && !reader.ahead.test(text) && !mostlyAhead(ev)) {
        said.push({ ids: [b.page.id], how: 'guess-day' });
      }
    }
    if (!said.length || !said.every(s => sameIds(s.ids, said[0].ids))) continue;
    const ids = said[0].ids;
    if (!prop.many && ids.length !== 1) continue;
    if (isDate) {
      const day = said.find(s => s.day)?.day || ctx.days?.get(ids[0]);
      if (day) out.push({ ident: prop.ident, prop, kind: 'day', ids, day, journalId: ids[0] > 0 ? ids[0] : null, shown: dayText(ctx, day), how: said.map(s => s.how).join('+'), guess: true });
      continue;
    }
    const pages = ids.map(nodeOf);
    if (pages.some(p => !p)) continue;
    for (const p of pages) spoken.add(p);
    out.push({ ident: prop.ident, prop, kind: 'node', ids, shown: pages.map(p => p.title).join(', '), ...namesOf(pages), how: said.map(s => s.how).join('+'), from: said.find(s => s.from)?.from, guess: true });
  }
  // A linked page with no tag yet: a guess for the first empty place it could fill (a property taking one tag), when there
  // are one or two such places and no other such page competes for them. Taking it gives the page that tag too.
  const { aliasIds } = names.namesFor(ctx);
  const loose = free.filter(p => !used.has(p) && untagged(p) && !aliasIds.has(p.id));
  const places = fields.filter(prop => open(prop) && isLinkProp(prop) && prop.classes.length === 1 && !out.some(g => g.ident === prop.ident));
  if (loose.length === 1 && places.length && places.length <= 2) {
    const [p] = loose, prop = places[0], tag = prop.classes[0];
    out.push({ ident: prop.ident, prop, kind: 'node', ids: [p.id], shown: p.title, how: 'untagged', guess: true, tagPage: { tag, uuids: [p.uuid] }, note: `becomes a #${tag.title}` });
  }
  return out;
}

/* The tags to pick from for a bullet that has none, when asked (a key, logseq/tag-pick.js): a short list, best first, and never written until chosen.

   Which tags could it be? Every page the words name, linked ([[Dr. Chen]]) or in plain words ("Dr. Chen", a whole name or alias, or a word of a
   name the graph's own lines tie to that page), says what kind of thing the line is about, and the graph's own structure says which tags
   could take such a page: those with a property (their own or inherited) that accepts it. A doctor can be the Provider of a Consultation, who
   you Spoke with in a Conversation, who Decided a Decision. That narrows 20 tags to a handful but not to one, since a visit and a call take the
   same people, so the words put them in order: the tags of the earlier lines nearest this one, each counted with the square of its likeness.
   Measured on the Illness Test Graph: a page was found in 24 of 45 fresh tagged lines (7 had a link), and the right tag was among the
   candidates in nearly every line that had one. Lines that name nothing, or whose tag the structure cannot give (a plain Expectation), are
   ordered by the words alone. Returns [{ tag: { id, uuid, title }, score, via: [page titles], how: 'mentioned' | 'words', fields: [property titles] }]. */
function mentionedPages(ctx, text) {
  const { links } = inWords(text, ctx), words = freeWords(text), any = { has: () => true }, out = [...links];
  for (const page of names.allNamedIn(words, any, ctx, new Set())) if (!out.includes(page)) out.push(page);
  const one = names.namedIn(words, any, ctx, new Set());
  if (one && !out.includes(one)) out.push(one);
  return out.filter(page => !page.isTag);
}
function candidateTags(ctx, pages) {
  const found = new Map();
  for (const id of ctx.knownTags) for (const prop of fieldsOfTags([id], ctx.schema)) {
    if (!isLinkProp(prop)) continue;
    const accepted = new Set(prop.classes.map(c => c.id));
    for (const page of pages) if (fits(page, accepted, ctx.schema)) { if (!found.has(id)) found.set(id, new Set()); found.get(id).add(page.title); }
  }
  return found;
}
// The tags of the earlier tagged lines nearest this one, by their words alone: tag id -> the sum of the squares of their likeness.
function tagScores(ctx, b) {
  const scores = new Map();
  if (!ctx.index) return scores;
  const tokens = engine.tokensOf(shownWords(b.text, ctx), [], [], ctx.limits);
  for (const { entry, sim } of engine.neighbours(ctx.index, tokens, { k: 10, skip: new Set([b.id]), keep: e => (e.values.get('block/tags') || [])[0] > 0 }))
    for (const id of entry.values.get('block/tags')) scores.set(id, (scores.get(id) || 0) + sim * sim);
  return scores;
}
const WORDS_FLOOR = .05;   // the sum of the squares of the likeness of the nearest lines of a tag: a nearest line about .22 alike
function tagChoices(ctx, b, { max = 5 } = {}) {
  if (b.tags.length || inWords(b.text, ctx).tags.length) return [];
  const scores = tagScores(ctx, b), candidates = candidateTags(ctx, mentionedPages(ctx, b.text));
  const item = (id, how) => { const page = ctx.byId.get(id); return page && page.isTag && page.uuid ? { tag: { id, uuid: page.uuid, title: page.title }, score: scores.get(id) || 0, via: [...(candidates.get(id) || [])], how, fields: fieldsOfTags([id], ctx.schema).map(p => p.title) } : null; };
  const byScore = (x, y) => y.score - x.score || y.via.length - x.via.length || x.tag.title.localeCompare(y.tag.title);
  const out = [...candidates.keys()].map(id => item(id, 'mentioned')).filter(Boolean).sort(byScore);
  // Fewer than three from the structure (or none: nothing named, or a kind of line no property points at): the words fill the list up.
  // Only where the words really point: a line that merely shares a word or two with a few earlier ones (score under the floor) says nothing.
  if (out.length < 3) for (const [id, score] of [...scores].sort((x, y) => y[1] - x[1])) {
    if (out.length >= Math.min(max, 4) || score < WORDS_FLOOR) break;
    if (!out.some(x => x.tag.id === id)) { const it = item(id, 'words'); if (it) out.push(it); }
  }
  return out.slice(0, max);
}

const api = { dayText, tagChoices, tagScores, mentionedPages, candidateTags, propose, inWords, recordOf, tagFor, looksLike, datedEvidence, datedWhenWritten, fewDatedAllSameDay, mostlyAhead, datedAhead, dayIdFor, valuesOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).propose = api;
})();
