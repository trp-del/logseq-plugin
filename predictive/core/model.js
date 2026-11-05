/* Apple's on-device model, as one more way to guess. Pure: what to ask it about a bullet, and which of its answers to keep.
   The asking itself is logseq/model.js, the model is the helper (helper/main.swift), on the Mac, never off it.

   The model reads the words for what they mean, which the rules cannot: which of two properties a person named in plain
   words belongs in (the Provider, or who you Spoke with), a number with no property's name beside it ("5 mg"), which of two
   days is the start and which the end. So it is asked only about what the rules left open, and held to the graph:

   - Only the bullet's own properties (not a parent's), only when the rules proposed no tag, never a choice (Status ...),
     never Logseq's own Deadline and Scheduled, never one the rules held back (two names for one place), never a wide
     property (one that takes almost any page, a Topic): as for the rules, a name in plain words is never taken for it.
   - What the rules proposed stays, but for one kind of guess: a person named in plain words, which the rules put in the
     first property that takes such a page, knowing nothing of roles. That one the model is asked about again, and its
     reading replaces the rules' (merge). Where it says nothing, the rules' guess stays.
   - A page property is offered the pages the words name (a whole name, or a telling word of it, as names.js reads them)
     that fit it, and not one the rules already placed. When the words name none, the pages it can take (rangePages), so
     the model can read what the words describe in other words; either way only pages of the graph that fit it.
   - A number is kept only if the words hold it; a day only if the date reader finds that day in the words.
   - Everything kept is a guess: dotted, written only by Enter or a click, as any guess.
   - A bullet with no tag, where the rules found none: which of the graph's tags it is (tagRequest), or none.

   request(ctx, b, result, today) -> { fill (what is sent), asked: Map(key -> { prop, kind, pages: Map(lower title -> page) }),
   days: Set(day numbers in the words) } | null.  pieces(ctx, request, reply) -> the guesses kept. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { wordsOf, TAG } = need('text');
const { fieldsOfTags, fits, wide, isNumberProp, isDateProp, isChoiceProp, isLinkProp, isBuiltInProp } = need('schema');
const names = need('names');
const { dayNumber } = need('dates');
const proposeLib = need('propose');
const engine = need('engine');
const { shownWords } = need('context');

const MOST_PAGES = 12;
/* When the words name no page for a property, the model is offered the pages the property can take (its range), so it can
   read what the words describe in other words ("woke up with a bloody nose" for a symptom page Bleeding): pages only,
   those most often the property's value first, at most MOST_RANGE for one property and MOST_OFFERED in all, which keeps
   the question inside what the model on the Mac can read. */
const MOST_RANGE = 40, MOST_OFFERED = 80;
function valueUse(ctx, ident) {
  const byProp = ctx.valueUse ||= new Map();
  if (byProp.has(ident)) return byProp.get(ident);
  const use = new Map();
  for (const entry of ctx.index?.entries || []) for (const id of entry.values.get(ident) || []) use.set(id, (use.get(id) || 0) + 1);
  byProp.set(ident, use);
  return use;
}
// A second name (an alias) is its page: "Dr. Chen" is offered and kept as Dr. Mei Chen, never as a page of its own.
const ownPage = (ctx, page) => (page?.aliasOf && ctx.byId.get(page.aliasOf.id)) || page;
function rangePages(ctx, prop, classIds, spoken) {
  const use = valueUse(ctx, prop.ident);
  return ctx.pages.filter(page => !page.isTag && !page.day && page.title && !page.aliasOf && !spoken.has(page) && fits(page, classIds, ctx.schema))
    .sort((x, y) => (use.get(y.id) || 0) - (use.get(x.id) || 0) || x.title.localeCompare(y.title)).slice(0, MOST_RANGE);
}
// What the model is told, and what each question asks: sent with the question, so the wording lives here, not in the helper.
const INSTRUCTIONS = 'You fill in the properties of one note in someone\'s notes about their life and health. Fill a property only when ' +
  'the note\'s words say its value, plainly or in other words for the same thing. When the words do not say, leave the property ' +
  'out or answer none. Never guess from what is usual. A person the note was with, talked to or saw goes in the property whose ' +
  'name fits that role.';
const ABOUT = {
  named: title => `The ${title} the words name, from the choices; none if the words do not say.`,
  range: title => `The ${title} this note is about, from the choices: the one its words describe, even when they use other words for it; none if none of them fits.`,
  tag: () => 'Which of these kinds of note this note is, from the choices; none if it is a plain note that is none of them.',
  number: title => `The ${title} as a number, only if the words give it.`,
  date: title => `The day of ${title} as YYYY-MM-DD, only if the words name it.`,
};
// A guess from a name in plain words and nothing else: the one guess of the rules the model may replace.
const byWordsAlone = p => p.kind === 'node' && p.guess && p.how === 'words';
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));
const iso = day => `${Math.floor(day / 10000)}-${String(Math.floor(day / 100) % 100).padStart(2, '0')}-${String(day % 100).padStart(2, '0')}`;
const fromIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };

// The pages the words name in plain words, a whole name or a telling word of one, that fit the property, in the order written.
function namedPages(ctx, words, classIds, spoken) {
  const { byWord, whole } = names.namesFor(ctx), found = [];
  const add = named => { const page = ownPage(ctx, named); if (!found.includes(page) && !spoken.has(page) && fits(page, classIds, ctx.schema)) found.push(page); };
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w)) add(page); });
  for (const word of words) for (const page of byWord.get(word) || []) add(page);
  return found.slice(0, MOST_PAGES);
}

/* Which of the graph's tags an untagged bullet is: asked when the rules found no tag (the pencilled tag; not while the setting
   is careful, ctx.limits.modelTag) and by Option-T. Not for a bullet under a record, whose properties come from above. The
   choices are the tags bullets carry, the same list for both, so one answer serves both: the tags the pages it names could
   take first (tagChoices), then by how many bullets carry them, at most MOST_TAGS. */
const MOST_TAGS = 60;
function tagUse(ctx) {
  if (ctx.tagUse) return ctx.tagUse;
  const use = new Map();
  for (const entry of ctx.index?.entries || []) for (const id of entry.values.get('block/tags') || []) use.set(id, (use.get(id) || 0) + 1);
  return (ctx.tagUse = use);
}
function tagRequest(ctx, b, today = dayNumber(new Date()), { examples = false, described = false } = {}) {
  const text = String(b.text || '');
  if (b.tags.length || proposeLib.inWords(text, ctx).tags.length || freeWords(text).length < 2) return null;
  if (proposeLib.recordOf(b, [], ctx.schema).fields.length) return null;
  const use = tagUse(ctx), byTitle = new Map();
  const first = proposeLib.tagChoices(ctx, b).map(item => item.tag.id);
  const rest = [...ctx.knownTags].filter(id => !first.includes(id)).sort((x, y) => (use.get(y) || 0) - (use.get(x) || 0));
  for (const id of [...first, ...rest]) {
    const page = ctx.byId.get(id);
    if (page?.isTag && page.uuid && !byTitle.has(page.title.toLowerCase())) byTitle.set(page.title.toLowerCase(), page);
    if (byTitle.size >= MOST_TAGS) break;
  }
  if (!byTitle.size) return null;
  const page = b.page && !b.page.day ? b.page.title : '';
  return {
    fill: { text: shown(ctx, text), page, tags: [], today: iso(b.page?.day || today), instructions: INSTRUCTIONS, context: tagContext(ctx, b, [...byTitle.values()], { examples, described }), properties: [{ key: 't', title: 'Kind of note', kind: 'tag', choices: [...byTitle.values()].map(p => p.title), about: ABOUT.tag() }] },
    asked: new Map([['t', { kind: 'tag', tags: byTitle }]]), days: new Set(), bullet: b,
  };
}
/* What the tag question adds to the note, so the model has more to go on than the tags' names: what each tag holds (its
   properties, at most four), for the first TAG_HINTS tags offered. With examples, also one earlier line of each of the
   first TAG_EXAMPLES tags, the one nearest this bullet by its words; asked without them since 0.3.19: on the test graph
   (0.3.18) Apple's filter refused 28 of 60 tag questions with the earlier lines and 2 of 60 without, and the right tag
   came 51 times against 29. All of it from the graph, read on the Mac. */
const TAG_HINTS = 25, TAG_EXAMPLES = 8, EXAMPLE_LENGTH = 90;
function tagContext(ctx, b, tags, { examples = false, described = false } = {}) {
  const hints = tags.slice(0, TAG_HINTS).map(tag => {
    const props = fieldsOfTags([tag.id], ctx.schema).filter(p => !isBuiltInProp(p)).slice(0, 4).map(p => p.title);
    const above = described ? (ctx.schema.parentsOf.get(tag.id) || []).filter(id => !ctx.schema.builtIn?.has(id)).map(id => ctx.byId.get(id)?.title).filter(Boolean) : [];
    return `- ${tag.title}${above.length ? ` (a kind of ${above.join(', ')})` : ''}${props.length ? ': ' + props.join(', ') : ''}`;
  });
  const wanted = new Set(examples ? tags.slice(0, TAG_EXAMPLES).map(t => t.id) : []), example = new Map();
  // Bullets only: a page is learned as a line too, but its name shows nothing of what a note of that kind says.
  const bulletOf = e => !ctx.byId.has(e.id) && (e.values.get('block/tags') || []).some(id => wanted.has(id));
  if (ctx.index) {
    const tokens = engine.tokensOf(shownWords(b.text, ctx), [], [], ctx.limits);
    const near = engine.neighbours(ctx.index, tokens, { k: 60, skip: new Set([b.id]), keep: bulletOf });
    for (const { entry } of near) for (const id of entry.values.get('block/tags')) if (wanted.has(id) && !example.has(id)) example.set(id, entry);
    for (const entry of ctx.index.entries) {
      if (example.size >= wanted.size) break;
      if (bulletOf(entry)) for (const id of entry.values.get('block/tags')) if (wanted.has(id) && !example.has(id)) example.set(id, entry);
    }
  }
  const lines = tags.filter(t => example.has(t.id)).map(t => {
    const words = shown(ctx, example.get(t.id).title).replace(/\s+/g, ' ').trim();
    return `- "${words.length > EXAMPLE_LENGTH ? words.slice(0, EXAMPLE_LENGTH - 1) + '…' : words}" (${t.title})`;
  });
  return [`The kinds of note, with what each holds:\n${hints.join('\n')}`, lines.length ? `Earlier notes of some kinds:\n${lines.join('\n')}` : ''].filter(Boolean).join('\n\n');
}
/* The pages a stretch of words names that fit a property: linked ones ([[...]]) first, then named in plain words. For the
   words around a bullet (its parent, the bullets before it), so "she" can be the doctor named a line above. */
function momentPages(ctx, text, classIds, spoken) {
  const found = [];
  for (const [, key] of String(text || '').matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const page = ownPage(ctx, ctx.byKey.get(key.toLowerCase()));
    if (page && !found.includes(page) && !spoken.has(page) && fits(page, classIds, ctx.schema)) found.push(page);
  }
  for (const page of namedPages(ctx, freeWords(text), classIds, spoken)) if (!found.includes(page)) found.push(page);
  return found.slice(0, MOST_PAGES);
}
/* Each property said in plain words from the graph's structure, names only: what it holds, on which tag, beside which
   other properties ("Targets (a Symptom) of this Therapeutic Session note; its other properties are Procedure, Date").
   Apple's guidance: a field's description is another way of prompting. For measuring first (0.3.20); Predictive itself
   still asks with ABOUT. */
function describe(ctx, req, tagIds = []) {
  const tag = req.fill.tags?.join(', ') || 'this';
  // Every property the note's tags give, not only those asked, so the model knows each role a name could fill.
  const all = [...new Set([...fieldsOfTags(tagIds, ctx.schema).filter(p => !isBuiltInProp(p)).map(p => p.title), ...[...req.asked.values()].map(a => a.prop.title)])];
  const properties = req.fill.properties.map(p => {
    const ask = req.asked.get(p.key);
    if (!ask || ask.kind === 'tag') return p;
    const others = all.filter(t => t !== p.title);
    const rest = others.length ? ` Its other properties are ${others.join(', ')}; what belongs there does not go here.` : '';
    const range = (ask.prop.classes || []).map(c => c.title).filter(Boolean).slice(0, 3).join(' or ');
    let about;
    if (ask.kind === 'page') about = `${p.title}${range ? ` (a ${range})` : ''} of this ${tag} note, from the choices${ask.how === 'range' ? ', even when the words use other words for it' : ''}; none if the words do not say.`;
    else if (ask.kind === 'number') about = `${p.title} of this ${tag} note as a number, only if the words give it.`;
    else if (ask.kind === 'date') about = `The day of ${p.title} in this ${tag} note as YYYY-MM-DD, only if the words name it.`;
    else about = `${p.title} of this ${tag} note, from the choices; none if the words do not say.`;
    return { ...p, about: about + rest };
  });
  return { ...req, fill: { ...req.fill, properties } };
}
/* The same question split into one per property, each asking that property alone: Apple's guidance is that the model
   does best with one specific task. Each keeps what it asks about, so its answer is read as any other. */
const oneByOne = req => req.fill.properties.map(p => ({ ...req, fill: { ...req.fill, properties: [p] }, asked: new Map([[p.key, req.asked.get(p.key)]]) }));
// The tag the model read, as a page, or null.
const tagOf = (req, reply) => { const v = reply?.values?.t; return v == null ? null : req.asked.get('t')?.tags.get(String(v).toLowerCase()) || null; };

function request(ctx, b, result, today = dayNumber(new Date())) {
  if (!result) return null;
  // A tag the rules pencilled: the model is asked about its properties as for a bullet with that tag (its answers wait
  // for the tag, as the rules' guesses for it do).
  if (result.assume) {
    const tagged = { ...b, tags: [...b.tags, result.assume.id] };
    const asked = request(ctx, tagged, proposeLib.propose(ctx, tagged, result.assume), today);
    return asked ? { ...asked, needsTag: true } : null;
  }
  if (!result.pieces.length && ctx.limits?.modelTag !== false) { const asked = tagRequest(ctx, b, today); if (asked) return asked; }
  if (result.record !== b) return null;
  const text = String(b.text || '');
  const words = freeWords(text);
  if (words.length < 2) return null;
  const { inWords } = proposeLib;
  const tags = [...new Set([...b.tags, ...inWords(text, ctx).tags])];
  const fields = fieldsOfTags(tags, ctx.schema);
  const done = new Set(result.pieces.filter(p => !byWordsAlone(p)).map(p => p.ident)), quiet = new Set(result.quiet || []);
  const spoken = new Set(result.pieces.filter(p => p.kind === 'node' && !byWordsAlone(p)).flatMap(p => p.ids.map(id => ctx.byId.get(id)).filter(Boolean)));
  const base = b.page?.day || today;
  const days = new Set(ctx.reader.daysInWords(text, base));
  const hasNumber = /\d/.test(text.replace(/\[\[[^\]]*\]\]/g, ' '));
  const asked = new Map(), properties = [];
  let offered = 0;
  for (const prop of fields) {
    if (done.has(prop.ident) || quiet.has(prop.ident) || (b.values?.get(prop.ident) || []).length) continue;
    if (isChoiceProp(prop) || isBuiltInProp(prop)) continue;
    const key = 'p' + asked.size;
    if (isLinkProp(prop)) {
      if (wide(prop, ctx.schema)) continue;
      const classIds = new Set(prop.classes.map(c => c.id));
      let pages = namedPages(ctx, words, classIds, spoken), how = 'named';
      if (!pages.length && offered < MOST_OFFERED) { pages = rangePages(ctx, prop, classIds, spoken).slice(0, MOST_OFFERED - offered); how = 'range'; }
      if (!pages.length) continue;
      offered += pages.length;
      asked.set(key, { prop, kind: 'page', how, pages: new Map(pages.map(p => [p.title.toLowerCase(), p])) });
      properties.push({ key, title: prop.title, kind: 'page', many: !!prop.many, choices: pages.map(p => p.title), about: ABOUT[how](prop.title) });
    } else if (isNumberProp(prop) && hasNumber) {
      asked.set(key, { prop, kind: 'number' });
      properties.push({ key, title: prop.title, kind: 'number', about: ABOUT.number(prop.title) });
    } else if (isDateProp(prop) && days.size) {
      asked.set(key, { prop, kind: 'date' });
      properties.push({ key, title: prop.title, kind: 'date', about: ABOUT.date(prop.title) });
    }
  }
  if (!properties.length) return null;
  const tagTitles = tags.map(id => ctx.byId.get(id)?.title).filter(Boolean);
  const page = b.page && !b.page.day ? b.page.title : '';
  return { fill: { text: shown(ctx, text), page, tags: tagTitles, today: iso(base), instructions: INSTRUCTIONS, properties }, asked, days };
}
// The words as the person reads them: a saved link as its page's name.
const shown = (ctx, text) => String(text).replace(/\[\[([^\[\]]+)\]\]/g, (m, key) => ctx.byKey.get(key.toLowerCase())?.title || key);

function pieces(ctx, req, reply) {
  if (req.needsTag) return pieces(ctx, { ...req, needsTag: false }, reply).map(piece => ({ ...piece, needsTag: true }));
  const out = [], values = reply?.values || {}, taken = new Set();
  const { dayIdFor, dayText } = proposeLib;
  // The tag: pencilled as the rules pencil theirs, with the properties it brings as guesses.
  const tag = tagOf(req, reply);
  if (tag) {
    const tagPiece = { ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'model', guess: true };
    const assumed = proposeLib.propose(ctx, { ...req.bullet, tags: [...req.bullet.tags, tag.id] }, tag);
    return [tagPiece, ...assumed.pieces.map(piece => ({ ...piece, guess: true, needsTag: true }))];
  }
  for (const [key, ask] of req.asked) {
    if (ask.kind === 'tag') continue;
    const v = values[key];
    if (v == null) continue;
    const { prop } = ask;
    if (ask.kind === 'page') {
      const pages = [...new Set((Array.isArray(v) ? v : [v]).map(t => ask.pages.get(String(t).toLowerCase())).filter(Boolean))].filter(p => !taken.has(p));
      if (!pages.length || (!prop.many && pages.length !== 1)) continue;
      for (const p of pages) taken.add(p);   // one name, one place
      out.push({ ident: prop.ident, prop, kind: 'node', ids: pages.map(p => p.id), shown: pages.map(p => p.title).join(', '), ...(pages.length > 1 ? { names: pages.map(p => ({ id: p.id, title: p.title })) } : {}), how: 'model', guess: true });
    } else if (ask.kind === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      const written = String(n);
      if (!new RegExp(`(^|[^\\d.])${written.replace('.', '\\.')}(?![\\d])`).test(req.fill.text)) continue;   // the words hold it
      out.push({ ident: prop.ident, prop, kind: 'number', ids: [n], shown: written, how: 'model', guess: true });
    } else if (ask.kind === 'date') {
      const day = fromIso(v);
      if (!day || !req.days.has(day)) continue;   // a day the words name, nothing else
      const id = dayIdFor(ctx, day);
      out.push({ ident: prop.ident, prop, kind: 'day', ids: [id ?? -day], day, journalId: id, shown: dayText(ctx, day), how: 'model', guess: true });
    }
  }
  // Two date properties given the same day are one day named, not a start and an end: neither is kept.
  const dayPieces = out.filter(p => p.kind === 'day');
  if (dayPieces.length > 1 && new Set(dayPieces.map(p => p.day)).size < dayPieces.length) return out.filter(p => p.kind !== 'day');
  return out;
}

/* After the model reads a tag, the tag's properties are asked about too, as for a bullet that has the tag: followUp gives
   that second question (null when there is no tag or nothing to ask), withFollowUp puts its answers with the tag's. */
function followUp(ctx, req, reply, today = dayNumber(new Date())) {
  const tag = req?.bullet && tagOf(req, reply);
  if (!tag) return null;
  const tagged = { ...req.bullet, tags: [...req.bullet.tags, tag.id] };
  const next = request(ctx, tagged, proposeLib.propose(ctx, tagged, tag), today);
  return next ? { req: next } : null;
}
function withFollowUp(ctx, first, req, reply) {
  const [tagPiece, ...rest] = first;
  const more = pieces(ctx, req, reply).map(piece => ({ ...piece, needsTag: true }));
  return [tagPiece, ...merge(rest, more)];
}

/* The proposals shown: the rules', and the model's for what the rules left open. A model guess for a property the rules
   guessed from plain words alone takes its place; a plain-words guess holding a page the model put elsewhere goes, so one
   person is not in two places. */
function merge(rules, model) {
  if (!model?.length) return rules;
  const byModel = new Map(model.map(p => [p.ident, p])), placed = new Set(model.filter(p => p.kind === 'node').flatMap(p => p.ids));
  const kept = rules.filter(q => !(byWordsAlone(q) && (byModel.has(q.ident) || q.ids.some(id => placed.has(id)))));
  return [...kept, ...model.filter(p => !kept.some(q => q.ident === p.ident))];
}

const api = { describe, oneByOne, request, tagRequest, tagContext, tagOf, followUp, withFollowUp, pieces, merge, iso, fromIso, namedPages, rangePages, momentPages, freeWords, shown, byWordsAlone, INSTRUCTIONS, ABOUT, MOST_TAGS, MOST_RANGE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).model = api;
})();
