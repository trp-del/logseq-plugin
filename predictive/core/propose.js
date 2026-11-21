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
const datesLib = need('dates');
const { shownWords, linkIdsIn, profileOf } = need('context');
const { profileTag } = need('profile');
const dateWords = (typeof require === 'function' && typeof module !== 'undefined') ? require('./date-words.js') : window.Flow.dateWords;
const tagScoreLib = (typeof require === 'function' && typeof module !== 'undefined') ? require('./tag-score.js') : window.Flow.tagScore;
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
/* What this graph shows about a linked page and a property: of the earlier nodes with one of these tags whose words link a
   page the property takes, in how many the property holds that page (taken) and in how many it does not (left). A doctor
   linked in a Recommendation may be who recommended it or who you were with; a procedure linked in a note may be only
   mentioned. Counted by node: one that links two such pages and holds one of them has taken a linked page; one that links
   such a page and holds another, or holds the linked page in another property, has left it out; one whose property is
   simply empty says nothing, as it may be a note nobody filled in yet. Measured on the owner's graph on 12 November 2026: of 22 values written from a linked page, 7 were not what
   had been filled in, and 3 went into properties left empty. So a linked page is written at once only where the graph does
   not say otherwise: with LINK_LEAST such nodes or more, it is sure when the property took the page in at least 9 of 10,
   a guess from half, and left alone under half (the page then stays free for another property that takes it). */
const LINK_LEAST = 4, LINK_SURE = .9, LINK_GUESS = .5;
function linkEvidence(ctx, prop, tagIds, classIds, skipId) {
  const index = ctx.index;
  if (!index?.postings) return { taken: 0, left: 0 };
  const count = entry => {
    // By node, not by link: a note that links two doctors and puts one in this property has taken a linked page for it.
    // Left out only where the node shows it: the property holds another page, or the linked page sits in another of the node's
    // properties. A property simply left empty says nothing: it may be a note nobody filled in yet.
    const linked = [];
    let took = false;
    const held = entry.values.get(prop.ident) || [];
    for (const token of entry.tokens) {
      if (!token.startsWith('link:')) continue;
      const page = ctx.byId.get(Number(token.slice(5)));
      if (!page || page.isTag || !fits(page, classIds, ctx.schema)) continue;
      linked.push(page.id); if (held.includes(page.id)) took = true;
    }
    if (!linked.length) return { taken: 0, left: 0 };
    if (took) return { taken: 1, left: 0 };
    const elsewhere = () => { for (const [ident, ids] of entry.values) if (ident !== prop.ident && ident !== 'block/tags' && ids.some(id => linked.includes(id))) return true; return false; };
    return { taken: 0, left: held.length || elsewhere() ? 1 : 0 };
  };
  const key = `${prop.ident}|${[...tagIds].sort().join(',')}`, kept = (ctx.linkTaken ||= new Map());
  if (!kept.has(key)) {
    const seen = new Set(), sum = { taken: 0, left: 0 };
    for (const id of tagIds) for (const i of index.postings.get('tag:' + id) || []) {
      if (seen.has(i)) continue; seen.add(i);
      const c = count(index.entries[i]); sum.taken += c.taken; sum.left += c.left;
    }
    kept.set(key, sum);
  }
  const all = kept.get(key);
  // The bullet itself, when it is already in the graph, says nothing about itself.
  const own = skipId > 0 ? index.entries.find(e => e.id === skipId && tagIds.some(id => (e.values.get('block/tags') || []).includes(id))) : null;
  const mine = own ? count(own) : { taken: 0, left: 0 };
  return { taken: all.taken - mine.taken, left: all.left - mine.left };
}
// 'sure', 'guess' or 'leave', from the evidence; with too little of it, sure, as a linked page always was.
function linkTrust(ev) {
  const n = ev.taken + ev.left;
  if (n < LINK_LEAST) return 'sure';
  const share = ev.taken / n;
  return share >= LINK_SURE ? 'sure' : share >= LINK_GUESS ? 'guess' : 'leave';
}
const mostlyAhead = ev => ev.other >= DATED_LEAST && ev.other > ev.same;
// A date in the words is the record's own only for a tag whose nodes are dated ahead at least as often as on the day
// written, or that has none dated yet: a visit's "I can drive in two weeks" is another day.
const datedAhead = ev => ev.other >= ev.same;

const dayIdFor = (ctx, day) => (ctx.dayIds ||= new Map([...(ctx.days || [])].map(([id, d]) => [d, id]))).get(day) ?? null;
// A day as the pencil shows it: as Logseq will write it, so nothing changes when it is filled in. The journal page's own title
// where the graph has that day (Logseq keeps a day's name when the date format changes), else the day in the date format
// Logseq will name the new day in (ctx.dateFormat).
const dayText = (ctx, day) => {
  if (!day) return '';
  return ctx.dayTitles?.get(day) || datesLib.formatDay(day, ctx.dateFormat, ctx.reader?.locale);
};

// The tag of the nodes an untagged bullet looks like: by its words and links alone, among every node the engine knows;
// the nearest vote, under the tag's own stricter limits. Plain lines vote "no tag" (0), so a line like many plain notes
// stays plain.
// The tag an untagged bullet reads like, in two stages: the nearest earlier lines vote (a near-twin, almost never wrong);
// when they find none, the tags' word profiles (core/profile.js) are asked, which know the words a tag's lines use as a
// whole. Either way a tag of yours that bullets carry, or nothing.
/* Enough words to suggest a tag: four words (each once, a page's name counted by its words), for every source of a tag (the vote,
   the word profiles, Apple's matcher and model); Option-T, asked for, lists at any length. Measured 8 November 2026 on the 59
   held-out lines typed a word at a time on the Illness Test Graph: with no such wait, 36 wrong tags showed on the way and the tag
   changed 10 times; waiting for four words, 15 and 3, and the tag each line ends with is the same (16 right, 1 wrong). Most wrong
   ones came from Apple's matcher on one to three words. Plain word count, not the graph's uncommon words: a graph of look-alike
   lines finds half its words common, and the wait would never end there. */
const TAG_WORDS_LEAST = 4;
const tellingWords = (ctx, text) => engine.tokensOf(shownWords(text, ctx), [], [], ctx.limits).length;
const enoughForTag = (ctx, text) => tellingWords(ctx, text) >= (ctx.limits?.tagWordsLeast ?? TAG_WORDS_LEAST);
// Enough for this bullet: four words, or fewer that the graph has seen as they are, with one tag (core/tag-score.js twinOf).
const readyForTag = (ctx, b, text) => enoughForTag(ctx, text) || !!tagScoreLib.twinOf(ctx, b, text);
function tagFor(ctx, b, text) {
  if (!ctx.index || !readyForTag(ctx, b, text)) return null;
  // The vote, the word profiles and the context clues together, sure or silent (core/tag-score.js).
  const got = tagScoreLib.guess(ctx, b, text);
  const page = got && ctx.byId.get(got.id);
  return page ? { ...page, from: examplesFor(ctx, got.near, 'block/tags', [got.id]), by: got.by, why: got.why } : null;
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
/* The number property a sum of money goes to, learned: among the earlier bullets nearest this one that had a sum in their words and
   a value in one of these properties, the property they filled, each counted with the square of its likeness. Speaks only when the
   nearest is near enough and the leader holds the vote, as for a page (ctx.limits nearLeast, lead). { prop, from } or null. */
function moneyLearned(ctx, text, links, tagIds, numbers, skip) {
  if (!ctx.index || !numbers.length) return null;
  const idents = new Set(numbers.map(p => p.ident));
  const tokens = engine.tokensOf(shownWords(text, ctx), links.map(p => p.id), tagIds, ctx.limits);
  const near = engine.neighbours(ctx.index, tokens, { k: ctx.limits.k, skip, keep: e => e.numbers?.some(i => idents.has(i)) && ctx.reader.moneyInWords(e.title) != null });
  if (!near.length || near[0].sim < ctx.limits.nearLeast) return null;
  const votes = new Map();
  let total = 0;
  for (const { entry, sim } of near) for (const ident of entry.numbers) if (idents.has(ident)) { votes.set(ident, (votes.get(ident) || 0) + sim * sim); total += sim * sim; }
  const [lead] = [...votes].sort((a, b) => b[1] - a[1]);
  if (!lead || lead[1] / total < ctx.limits.lead) return null;
  const from = near.filter(x => x.entry.numbers.includes(lead[0])).slice(0, 2).map(x => String(x.entry.title || '').replace(/\[\[([^\]]+)\]\]/g, (m, k) => (UUID.test(k) ? ctx.byKey.get(k.toLowerCase())?.title || '' : k)).replace(/\s+/g, ' ').trim());
  return { prop: numbers.find(p => p.ident === lead[0]), from: [...new Set(from)].filter(Boolean) };
}
// The meaning a date property's name gives it: 'deadline' (Logseq's Deadline, a Due date), 'scheduled', or null.
// What kind of day a date property takes, by its name (Logseq's own Deadline and Scheduled by theirs): deadline, scheduled, start,
// end, completed, or null.
const MEANINGS = ['deadline', 'scheduled', 'start', 'end', 'completed'];
const meaningOf = (prop, reader) => prop.ident === 'logseq.property/deadline' ? 'deadline' : prop.ident === 'logseq.property/scheduled' ? 'scheduled'
  : MEANINGS.find(m => reader.nameMeans?.(m, prop.title)) || null;
const namesOf = pages => pages.length > 1 ? { names: pages.map(p => ({ id: p.id, title: p.title })) } : {};
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));

/* Which date each day in the words goes to, by the words around it (17 November 2026, the owner: "recognize using words as cues for
   deadline vs scheduled vs start and end date vs completed"). In this order, each day to one property only:
   1. a span ("from Jan 5 to Jun 30", "Jan 5–Jun 30"): the start and the end, where the tag has one date of each;
   2. a property's own name right before the day ("renews Mar 3", "due date Dec 5");
   3. a word of the kind right before the day ("due", "scheduled for", "starts", "until"), or for completed a part of the sentence
      saying it was done ("paid Nov 20", "fixed the leak on Nov 12");
   2b. where you taught it (core/date-words.js): words you put such a day after, in that date, twice or more ("cutoff Dec 4" in
      Due date): before the kind words, so a day you moved twice goes where you moved it; taught once, after the kind words;
   4. with two or more dates and one day ahead left with no word for it, said as an appointment is ("Inspection on Monday",
      "Plumber Dec 4 at 10am"): the scheduled one. A day with no word at all ("the Dec 4 quote", "photos from Nov 9", "Sam's
      birthday is Dec 4") is left alone: on 456 sentences, guessing those put 49 days in the wrong place (17 November 2026).
   Fills meant (ident → { day, how }). */
function meantDaysFor(reader, dates, text, base, meant, ctx = null) {
  if (!dates.length || !reader.dayMeant) return;
  const claimed = new Set(), byMeaning = new Map();
  for (const prop of dates) { const m = meaningOf(prop, reader); if (m) { if (!byMeaning.has(m)) byMeaning.set(m, []); byMeaning.get(m).push(prop); } }
  const only = m => (byMeaning.get(m) || []).length === 1 ? byMeaning.get(m)[0] : null;
  const give = (prop, day, how) => { if (!prop || day == null || meant.has(prop.ident) || claimed.has(day)) return; meant.set(prop.ident, { day, how }); claimed.add(day); };
  const span = reader.rangeIn?.(text, base);
  if (span && only('start') && only('end')) { give(only('start'), span.start, 'words-start'); give(only('end'), span.end, 'words-end'); }
  for (const prop of dates) {
    const name = String(prop.title || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    if (name) give(prop, reader.dayMeant({ words: [name] }, text, base), 'words-name');
  }
  const kindOf = prop => meaningOf(prop, reader);
  const taught = least => { if (ctx?.index) for (const { prop, day } of dateWords.learnedDays(ctx, dates, text, base, { least, claimed, kindOf })) give(prop, day, 'words-learned'); };
  taught(2);
  for (const m of MEANINGS) for (const prop of byMeaning.get(m) || []) if ((byMeaning.get(m) || []).length === 1) {
    const day = reader.dayMeant(m, text, base);
    if (day != null && !(span && (day === span.start || day === span.end) && m !== 'start' && m !== 'end')) give(prop, day, 'words-' + m);
  }
  taught(1);
  if (dates.length < 2 || meant.size) return;
  const days = reader.daysInWords(text, base).filter(d => !claimed.has(d));
  if (days.length !== 1 || span || reader.anyCue?.(text)) return;   // a word of a kind that did not take ("the deadline to file is Dec 15"): no guess
  // Not Logseq's own Scheduled: a plain day on a task ("Call the pharmacy on Friday") is not put in its agenda.
  const scheduled = only('scheduled');
  const saidAsAppointment = reader.dayMeant({ words: ['on'] }, text, base) === days[0] || /\sat\s+\d{1,2}(?::\d\d)?\s*(?:am|pm)?(?=[\s.,;!?]|$)/i.test(' ' + text);
  if (days[0] > base && saidAsAppointment) give(scheduled && !isBuiltInProp(scheduled) ? scheduled : null, days[0], 'words-ahead');
}
function propose(ctx, b, assume = null) {
  const { schema } = ctx;
  const text = b.text;
  const { links, tags: typedTags } = inWords(text, ctx);
  const allTags = [...new Set([...b.tags, ...typedTags])];
  const { record, fields, ordered } = recordOf(b, allTags, schema);
  const pieces = [];

  // No tag, and no record above: the tag of the nodes it looks like, with the properties it brings, all guesses.
  if (!fields.length) {
    const fresh = allTags.length || assume ? null : tagFor(ctx, b, text);
    // Steady (core/tag-score.js): with the bullet's state, a shown tag stays while the words go on, and another replaces it only
    // at two pauses running. Fewer than enough words again (the words taken back): nothing held.
    const held = b.tagState && !(allTags.length || assume);
    const ready = held && readyForTag(ctx, b, text);
    if (held && !ready) Object.assign(b.tagState, { shown: null, pending: null, n: 0 });
    // Words written before with one tag (by: 'twin') are sure, so they take the place at once: "Gas" shows Purchase, and the
    // bill's "Gas bill" Bill payment as soon as "bill" is typed, not a pause later.
    const sure = ready && fresh?.by === 'twin';
    if (sure) Object.assign(b.tagState, { shown: fresh, pending: null, n: 0 });
    const tag = sure ? fresh : ready ? tagScoreLib.steady(b.tagState, fresh, id => tagScoreLib.leadOf(ctx, b, text, id), ctx.limits.tagHold ?? 4) : fresh;
    if (!tag) return { record, pieces };
    const assumed = propose(ctx, { ...b, tags: [...b.tags, tag.id] }, tag);
    const tagPiece = { ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'alike-tag', from: tag.from, why: tag.why, guess: true };
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
      // What the graph's earlier nodes say of a linked page and this property: where they mostly leave it out, so does this.
      const trust = fitting.length && !filled ? linkTrust(linkEvidence(ctx, prop, recordTags, classIds, b.id)) : 'sure';
      if (fitting.length && trust === 'leave') continue;
      // A filled property still claims the links it takes: a second doctor named when doctor is filled does not become "with".
      if (fitting.length) {
        for (const p of fitting) used.add(p);
        // From a note under the record, only a one-value property is sure: a list of people in a note is not the record's
        // "spoke with". Into a wide property, only from the record's own words, and only as a guess.
        const isWide = wide(prop, schema);
        if (!filled && (prop.many ? record === b : fitting.length === 1) && !(isWide && record !== b)) {
          pieces.push({ ident: prop.ident, prop, kind: 'node', ids: fitting.map(p => p.id), shown: fitting.map(p => p.title).join(', '), ...namesOf(fitting), how: 'linked', ...(trust === 'guess' ? { guess: true } : {}), ...(isWide ? { guess: true, how: 'linked-wide' } : {}) });
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
  // Basic meanings (core/dates.js): a day the words say something is due or set for goes to the date named for it (Logseq's
  // Deadline and Scheduled too), and that day is then no other date's; a sum of money goes to the one number named for money.
  const base = journalDay || dayNumber(new Date()), meant = new Map();
  if (own) meantDaysFor(reader, fields.filter(p => open(p) && (isDateProp(p) || p.type === 'datetime')), text, base, meant, ctx);
  const meantDays = new Set([...meant.values()].map(m => m.day));
  // Which number takes the sum: the one earlier bullets like this one, with a sum in their words, filled (learned from the graph,
  // so Amount, Payment and Cost are told apart by how you used them); else the one number named for money.
  const numberNames = fields.filter(isNumberProp).map(p => p.title);
  // A sum with its currency; else, where the tag takes a sum, one plain number that can only be the sum ("Gas 64.28").
  const takesSum = fields.some(p => open(p) && isNumberProp(p) && reader.nameMeans('money', p.title));
  const money = own && reader.moneyInWords ? (reader.moneyInWords(text) ?? (takesSum && reader.plainSum ? reader.plainSum(text) : null)) : null;
  let moneyPiece = null;
  if (money != null) {
    const numbers = fields.filter(p => open(p) && isNumberProp(p) && reader.numberInWords(text, p.title, numberNames) == null);
    const learned = moneyLearned(ctx, text, links, recordTags, numbers, skip);
    const named = numbers.filter(p => reader.nameMeans('money', p.title));
    if (learned) moneyPiece = { prop: learned.prop, how: 'alike-money', from: learned.from };
    else if (named.length === 1) moneyPiece = { prop: named[0], how: 'words-money' };
  }
  for (const prop of fields) {
    if (!open(prop)) continue;
    const m = meant.get(prop.ident);
    if (m) {
      const id = dayIdFor(ctx, m.day);
      out.push({ ident: prop.ident, prop, kind: 'day', ids: [id ?? -m.day], day: m.day, journalId: id, shown: dayText(ctx, m.day), how: m.how, guess: true });
      continue;
    }
    const isNode = isLinkProp(prop), isDate = isDateProp(prop), isNumber = isNumberProp(prop);
    if (!isNode && !isDate && !isNumber) continue;
    if (isChoiceProp(prop)) continue;   // a choice (Status ...) is never proposed: where a thing stands is rarely in its words
    const said = [];
    // A number beside the property's name ("cycle 5"). Not from look-alike bullets: how bad a day was is not in its words.
    if (isNumber) {
      const n = own ? reader.numberInWords(text, prop.title, numberNames) : null;
      if (n != null) out.push({ ident: prop.ident, prop, kind: 'number', ids: [n], shown: String(n), how: 'words-number', guess: true });
      else if (moneyPiece?.prop === prop) out.push({ ident: prop.ident, prop, kind: 'number', ids: [money], shown: String(money), how: moneyPiece.how, ...(moneyPiece.from ? { from: moneyPiece.from } : {}), guess: true });
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
      // A page named in plain words is taken for this property only where the graph's earlier nodes do not mostly leave such
      // a page out of it (linkEvidence): it then stays free for the next property that takes it.
      const leftOut = () => linkTrust(linkEvidence(ctx, prop, recordTags, classIds, b.id)) === 'leave';
      const named = several.length > 1 || wide(prop, ctx.schema) ? null : names.namedIn(words, classIds, ctx, spoken);
      if (several.length > 1) said.splice(0, said.length, { ids: several.map(p => p.id), how: 'words' });
      // A name the words send the other way ("paid off" a card is to it) stays free for the property going that way.
      else if (named && !leftOut() && !(names.sideOf(prop) && names.directionOf(words, named, ctx) && names.directionOf(words, named, ctx) !== names.sideOf(prop))) said.push({ ids: [named.id], how: 'words' });
    }
    if (isDate) {
      const ev = datedEvidence(ctx, prop, recordTags);
      // The journal day, as a guess, where the graph has too few dated nodes to be sure but at least one, none of them
      // dated another day. A tag whose nodes are dated other days (written ahead) still gets nothing.
      if (!said.length && journalDay && fewDatedAllSameDay(ev)) said.push({ ids: [b.page.id], how: 'day' });
      // A date written in the words, counted from the day the bullet is written on (else today); one, or nothing. Off a journal
      // page nothing else can say the day, so the words speak for any tag (8 November 2026: "Scan results with Dr. Mei Chen next
      // Friday" on a page left the Date of a Consultation empty, since Consultations are mostly dated the day written).
      if (own && oneDate && (datedAhead(ev) || !journalDay)) {
        const days = reader.daysInWords(text, journalDay || dayNumber(new Date()));
        if (days.length === 1 && !meantDays.has(days[0])) { const id = dayIdFor(ctx, days[0]); said.push({ ids: [id ?? -days[0]], day: days[0], how: 'words-day' }); }
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
   ordered by the words alone. Returns [{ tag: { id, uuid, title }, score, via: [page titles], takes: [{ prop, pages }] (which property would take which pages), how: 'mentioned' | 'words', fields: [property titles] }]. */
function mentionedPages(ctx, text) {
  const { links } = inWords(text, ctx), words = freeWords(text), any = { has: () => true }, out = [...links];
  for (const page of names.allNamedIn(words, any, ctx, new Set())) if (!out.includes(page)) out.push(page);
  const one = names.namedIn(words, any, ctx, new Set());
  if (one && !out.includes(one)) out.push(one);
  return out.filter(page => !page.isTag);
}
/* The tags a line could be, from the pages it names: a tag one of whose properties takes such a page (a Conversation, whose Spoke
   with takes the person named). A wide property is no reason (14 November 2026, the owner's two lines: a note about a family
   offered as a Consultation, a reason for a decision as a Conversation, both only because Topic takes any page): almost any page
   fits it, so fitting says nothing about what the line is. Gives tag id -> Map(the property's title -> Set(the pages' titles)). */
function candidateTags(ctx, pages) {
  const found = new Map();
  for (const id of ctx.knownTags) for (const prop of fieldsOfTags([id], ctx.schema)) {
    if (!isLinkProp(prop) || wide(prop, ctx.schema)) continue;
    const accepted = new Set(prop.classes.map(c => c.id));
    for (const page of pages) if (fits(page, accepted, ctx.schema)) { if (!found.has(id)) found.set(id, new Map()); const by = found.get(id); if (!by.has(prop.title)) by.set(prop.title, new Set()); by.get(prop.title).add(page.title); }
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
  const item = (id, how) => { const page = ctx.byId.get(id); return page && page.isTag && page.uuid ? { tag: { id, uuid: page.uuid, title: page.title }, score: scores.get(id) || 0, via: [...new Set([...(candidates.get(id)?.values() || [])].flatMap(set => [...set]))], takes: [...(candidates.get(id) || [])].map(([prop, set]) => ({ prop, pages: [...set] })), how, fields: fieldsOfTags([id], ctx.schema).map(p => p.title) } : null; };
  const byScore = (x, y) => y.score - x.score || y.via.length - x.via.length || x.tag.title.localeCompare(y.tag.title);
  const out = [...candidates.keys()].map(id => item(id, 'mentioned')).filter(Boolean).sort(byScore);
  // The tag the same words carried before (core/tag-score.js twinOf) comes first, as it is the one pencilled in.
  const twin = tagScoreLib.twinOf(ctx, b, b.text);
  if (twin) { const at = out.findIndex(x => x.tag.id === twin.id), it = at >= 0 ? out.splice(at, 1)[0] : item(twin.id, 'twin'); if (it) out.unshift(it); }
  // Fewer than three from the structure (or none: nothing named, or a kind of line no property points at): the words fill the list up.
  // Only where the words really point: a line that merely shares a word or two with a few earlier ones (score under the floor) says nothing.
  if (out.length < 3) for (const [id, score] of [...scores].sort((x, y) => y[1] - x[1])) {
    if (out.length >= Math.min(max, 4) || score < WORDS_FLOOR) break;
    if (!out.some(x => x.tag.id === id)) { const it = item(id, 'words'); if (it) out.push(it); }
  }
  return out.slice(0, max);
}

const api = { linkEvidence, linkTrust, moneyLearned, enoughForTag, readyForTag, tellingWords, TAG_WORDS_LEAST, meaningOf, dayText, tagChoices, tagScores, mentionedPages, candidateTags, propose, inWords, recordOf, tagFor, looksLike, datedEvidence, datedWhenWritten, fewDatedAllSameDay, mostlyAhead, datedAhead, dayIdFor, valuesOf, freeWords };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).propose = api;
})();
