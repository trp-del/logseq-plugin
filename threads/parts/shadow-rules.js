/* Loaded by main.js before parts/shadow.js, after parts/alike.js. Kept in its own scope; parts/shadow.js links it when the proposals start. */
(() => {
/* The proposals' rules: what the graph holds, what is sure, the guesses, the looks-like learning, the reasons (split out of parts/shadow.js at 0.4.268, layer 2 item 10, so that each piece of the proposals can be read
   and changed on its own). It draws nothing and writes nothing.
   The pieces share one bag, shared.feature('proposals') (P; a name on the window before 0.4.315): each puts there what
   the others use, and takes what it uses from there when the proposals start (P.links), or at once when the piece
   that has it is loaded before. */
const shared = window.refinementShared;
const { host, notify, graphNamedIn } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (proposals): ' });
const P = shared.feature('proposals');
P.links ||= [];
const take = (core, names) => shared.take(core, names, warnOnce);
let later, pending;
let model, UUID, propSchema, propPages, bare, pick, idOf, titleOf, alike, parseDay, dayAfter, dayNumber;

const ownLink = core => {
  ({ model, UUID, propSchema, propPages, bare, pick, idOf, titleOf, alike, parseDay, dayAfter, dayNumber } = take(core, ['UUID', 'propSchema', 'propPages', 'bare', 'pick', 'idOf', 'titleOf', 'alike', 'parseDay', 'dayAfter', 'dayNumber']));
  model = core.provided; // the graph is read through the model (0.4.226)
  ({ later, pending } = P);
};
P.links.push(ownLink);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayText = day => day ? `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}` : '';
// A pulled map's values under a property, by its ident, whatever the key's spelling; [] when the property is empty.
function valuesOf(node, ident) {
  for (const key of Object.keys(node || {})) if (bare(key) === ident) { const v = node[key]; return (Array.isArray(v) ? v : v == null ? [] : [v]).map(idOf).filter(id => id != null); }
  return [];
}
// A number property, and a property of choices (Status: Planned, Done …; not a link, whose choices are pages).
const isNumberProp = p => p.type === 'number';
const isChoiceProp = p => p.type !== 'node' && p.choices?.length > 0;
// The properties the tags give, own first, then what they inherit, without repeats.
function fieldsOfTags(tagIds, schema) {
  const seen = new Set(), fields = [], queue = [...tagIds];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}
// A page fits a link property when one of its tags, or a tag that tag extends, is a tag the property takes.
function fits(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    if (classIds.has(c)) return true;
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return false;
}
/* A wide property (0.4.220, at the owner's word: "I was testing it out because topic is wide thing"): one that takes
   tags from two or more separate families, a family being the top of a tag's chain of extends (Topic taking Symptom,
   Decision, Doctor and Consultation: Phenomena, Interpretation, Entity, Occurrence). Almost any link fits such a
   property, so fitting says little: a link or the page written on is only a guess for it, a name in plain words is
   never taken for it, and it is the last to claim a link (a linked doctor is the Provider, not the Topic). The
   engine's votes still count: what earlier lines like this one had in it is real evidence. */
const wideCache = new WeakMap();
function wide(prop, schema) {
  if (!prop?.classes?.length) return false;
  let byProp = wideCache.get(schema);
  if (!byProp) wideCache.set(schema, byProp = new Map());
  if (byProp.has(prop.ident)) return byProp.get(prop.ident);
  const tops = new Set();
  for (const c of prop.classes) {
    const seen = new Set(), queue = [c.id];
    while (queue.length) { const t = queue.shift(); if (seen.has(t)) continue; seen.add(t); const up = (schema.parentsOf.get(t) || []).filter(id => !schema.builtIn?.has(id)); if (!up.length) tops.add(t); queue.push(...up); }
  }
  const answer = tops.size >= 2;
  byProp.set(prop.ident, answer);
  return answer;
}
// A page with no tag of yours (only Logseq's own, such as Page).
const untagged = page => !page.isTag && !page.tags.some(t => !/^logseq\.class\//.test(t.ident));

/* What the graph holds, remembered for the session by the model (read again when the graph changes): the
   properties with their tags, every page with its tags, and the pages by name and by uuid. */
let context = null;
async function contextFor() {
  const [schema, pages] = await Promise.all([propSchema(), propPages()]);
  if (context && context.schema === schema && context.pages === pages) return context;
  const byKey = new Map(), byId = new Map();
  for (const page of pages) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  // Tag names, longest first, for "#Symptom log" written without brackets.
  const tagNames = pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length);
  ctx0Title = key => byKey.get(String(key).toLowerCase())?.title || '';
  return (context = { schema, pages, byKey, byId, tagNames });
}
// The pages linked in the words, read fresh (0.4.210, at the owner's word: "properties do not recognize the new page"):
// the page list is read at most every 30 s, so a page made or tagged a moment ago ([[Dr. New]] with #Doctor picked
// from Logseq's list right after it) was unknown, or known without its tag, and Provider stayed empty (seen in the
// app). Returns the context with those pages as they are now, or the context itself when nothing changed.
async function withFreshLinks(text, ctx) {
  const names = [...new Set([...String(text || '').matchAll(LINK)].map(([, key]) => key.trim().toLowerCase()).filter(key => key && !UUID.test(key)))];
  if (!names.length) return ctx;
  const fresh = [];
  for (const page of await model.pagesNamed(names)) { // the model leaves out Logseq's hidden pages, as the page list does
    const known = ctx.byId.get(page.id);
    if (known && known.title === page.title && sameIds(known.tags.map(t => t.id), page.tags.map(t => t.id))) continue;
    fresh.push({ ...known, ...page });
  }
  if (!fresh.length) return ctx;
  if (ctx.history) namesFor(ctx); // built once on the shared context, not again on each copy (second reading)
  const byKey = new Map(ctx.byKey), byId = new Map(ctx.byId);
  for (const page of fresh) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  return { ...ctx, byKey, byId };
}
// The bullet in edit with what the rules read: its tags and values, its parent (and the parent's), its page (the
// model's blockInEdit, 0.4.226).
const pullBlock = uuid => model.blockInEdit(uuid);
// The pages linked in the words ([[uuid]] as saved, [[Name]] in the text box), in order, each once; and the tags
// written in the words (#Consultation, #[[Symptom log]]), as tag ids. A link to a page's second name is that page
// (0.4.383: [[Dr. Chen]], the alias of Dr. Mei Chen, given #Doctor of its own, was proposed as the Provider itself).
const LINK = /\[\[([^\[\]]+)\]\]/g, TAG = /(?:^|\s)#(?:\[\[([^\]]+)\]\]|([^\s#\[\]]+))/g;
function inWords(text, ctx) {
  const links = [], tags = [];
  const words = String(text || '');
  for (const [, key] of words.matchAll(LINK)) {
    const named = ctx.byKey.get(key.trim().toLowerCase()), page = (named?.aliasOf && ctx.byId.get(named.aliasOf.id)) || named;
    if (page && !links.includes(page)) links.push(page);
  }
  const lower = words.toLowerCase();
  for (const m of words.matchAll(TAG)) {
    // The longest tag name that follows the #: Logseq shows a two-word tag as "#Symptom log", no brackets.
    const at = m.index + m[0].indexOf('#') + 1, rest = lower.slice(at);
    // "#Doctor's" is not #Doctor: Logseq reads the whole word as the tag (as pagesTaggedIn does, the code review 2026-10-21).
    const name = m[1] ? m[1].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w'’-]/.test(rest.charAt(t.length))) || m[2].toLowerCase();
    const page = ctx.byKey.get(name);
    if (page?.isTag && !tags.includes(page.id)) tags.push(page.id);
  }
  return { links, tags };
}
// A tag written right after a link, with no space ([[Dr. New]]#Doctor), is the page's tag, not the bullet's (0.4.209,
// at the owner's word). Logseq gives it to the bullet; the proposals put the page in the record's property that takes
// that tag, and filling in moves the tag to the page. The page by its name in the words (a page made a moment ago is
// not in the page list yet: page is then null), each once.
const PAGE_TAG = /\[\[([^\[\]]+)\]\]#(?:\[\[([^\[\]]+)\]\]|([^\s#\[\]]+))/g;
function pagesTaggedIn(text, ctx) {
  const words = String(text || ''), lower = words.toLowerCase(), out = [];
  for (const m of words.matchAll(PAGE_TAG)) {
    const rest = lower.slice(m.index + m[0].indexOf(']]#') + 3);
    // Logseq reads #Doctor's as a tag "Doctor's" (second reading), so a longer word is not the shorter tag.
    const tagName = m[2] ? m[2].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w'’-]/.test(rest.charAt(t.length))) || m[3].toLowerCase();
    const tag = ctx.byKey.get(tagName), key = m[1].trim().toLowerCase(), page = ctx.byKey.get(key) || null;
    if (!tag?.isTag || page?.isTag || out.some(x => x.key === key)) continue;
    out.push({ key, name: page ? page.title : m[1].trim(), page, tag });
  }
  return out;
}
// Where the tag written right after a page's link is in the words (as saved, the link is [[its uuid]], or its name):
// { at, text } with text the tag as written ("#Doctor", "#[[…]]"), or null.
function pageTagIn(title, page, tag) {
  const lower = title.toLowerCase();
  for (const key of [page.uuid, page.title]) {
    const mark = `[[${String(key).toLowerCase()}]]#`, at = lower.indexOf(mark);
    if (at < 0) continue;
    const from = at + mark.length, rest = title.slice(from), restLower = rest.toLowerCase();
    const n = rest.startsWith('[[') ? rest.indexOf(']]') + 2
      : restLower.startsWith(tag.lower) && !/[\w'’-]/.test(restLower.charAt(tag.lower.length)) ? tag.lower.length
      : (rest.match(/^[^\s#\[\]]+/) || [''])[0].length;
    return { at: from - 1, text: title.slice(from - 1, from + n) };
  }
  return null;
}
// The words without that tag.
function withoutPageTag(title, page, tag) {
  const found = pageTagIn(title, page, tag);
  return found ? title.slice(0, found.at) + title.slice(found.at + found.text.length) : title;
}
// The tag put back after the page's link (Undo, when the words were changed meanwhile).
function withPageTag(title, page, text) {
  for (const key of [page.uuid, page.title]) {
    const mark = `[[${String(key).toLowerCase()}]]`, at = title.toLowerCase().indexOf(mark);
    if (at >= 0 && title.charAt(at + mark.length) !== '#') return title.slice(0, at + mark.length) + text + title.slice(at + mark.length);
  }
  return title;
}
const isBlock = node => !!(node && pick(node, 'block/page'));
const cleanWords = text => String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => /^[0-9a-f-]{36}$/i.test(key) ? '' : key).replace(/\s+/g, ' ').trim();
// Logseq keeps the tags typed at the end of a bullet apart from its words, so they are left out when the saved words are compared.
const plainWords = text => cleanWords(String(text || '').replace(TAG, ' ')).toLowerCase();

/* The rules. b is the bullet in edit (pulled), text its words (the text box, or the saved title). Returns the
   record the pieces are for and the pieces: { ident, prop, kind: 'node' | 'day', ids, shown, tagPage?, day?, journalId?, how }. */
// The record (the bullet, or its parent when only the parent's tags give properties) and its properties, the most
// particular first: a link is claimed by doctor, taking #Doctor, before with, taking #Person.
function recordOf(b, ownTags, schema) {
  const parent = pick(b, 'block/parent');
  let record = b, fields = fieldsOfTags(ownTags, schema);
  if (!fields.length && isBlock(parent)) {
    const parentFields = fieldsOfTags((pick(parent, 'block/tags') || []).map(idOf), schema);
    if (parentFields.length) { record = parent; fields = parentFields; }
  }
  const depth = id => { let d = 0, q = [id]; const seen = new Set(); while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.parentsOf.get(c) || []) { q.push(p); } d = Math.max(d, seen.size); } return d; };
  // A wide property comes last (0.4.220): a narrower one that takes the link claims it first.
  const particular = prop => prop.type !== 'node' ? -1 : wide(prop, schema) ? -0.5 : Math.max(0, ...prop.classes.map(c => depth(c.id)));
  const ordered = fields.map((prop, i) => ({ prop, i, rank: particular(prop) })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(x => x.prop);
  return { record, fields, ordered };
}
// The bullet's own tags, as it was when its editing began: those on it that its saved words do not give a page
// ([[Dr. New]]#Doctor saved earlier is a page's). A tag of its own is never set aside or taken off (second reading:
// a consultation writing [[Jul 3 visit]]#Consultation would have lost its own tag).
function ownTagsAtStart(b, ctx) {
  const toPages = new Set(pagesTaggedIn(String(pick(b, 'block/title') ?? ''), ctx).map(x => x.tag.id));
  return new Set((pick(b, 'block/tags') || []).map(idOf).filter(id => !toPages.has(id)));
}
function piecesFor(b, text, ctx, ownAtStart = new Set(), assume = null) {
  const { schema } = ctx;
  const { links, tags: typedTags } = inWords(text, ctx);
  const allTags = [...new Set([...(pick(b, 'block/tags') || []).map(idOf), ...typedTags])];
  // Pages tagged in the words ([[Dr. New]]#Doctor): their tags are not the bullet's, and each goes in the most
  // particular property of the record that takes its tag, when that one is empty (one that holds several takes them
  // all); filled, or taken by another page, it stays quiet, as a link does. A tag with a page left unplaced is left to
  // Logseq, the bullet's after all, for every page it follows; so is one also written apart (#Doctor) or the bullet's own.
  let asPage = pagesTaggedIn(text, ctx).filter(x => !typedTags.includes(x.tag.id) && !ownAtStart.has(x.tag.id));
  const settle = () => {
    const aside = new Set(asPage.map(x => x.tag.id));
    const ownTags = allTags.filter(id => !aside.has(id));
    const found = recordOf(b, ownTags, schema), claimed = new Map();
    for (const x of asPage) {
      const prop = found.ordered.find(p => p.type === 'node' && p.classes.length && fits({ tags: [{ id: x.tag.id }] }, new Set(p.classes.map(c => c.id)), schema));
      if (prop && !valuesOf(found.record, prop.ident).length && (!claimed.has(prop.ident) || prop.many)) claimed.set(prop.ident, [...claimed.get(prop.ident) || [], x]);
    }
    return { ...found, ownTags, aside, claimed };
  };
  let settled = settle();
  for (let round = 0; round < 3; round++) {
    const placed = new Set([...settled.claimed.values()].flat());
    const unplaced = new Set(asPage.filter(x => !placed.has(x)).map(x => x.tag.id));
    if (!unplaced.size) break;
    asPage = asPage.filter(x => placed.has(x) && !unplaced.has(x.tag.id));
    settled = settle();
  }
  const { record, fields, ordered, ownTags, aside, claimed } = settled;
  // The properties only a page's tag gives the bullet (Logseq shows them until the tag is moved): Option-Enter skips them.
  const skip = fieldsOfTags([...aside], schema).filter(p => !fields.includes(p)).map(p => p.lower);
  const pieces = [];
  // Stage D: no tag, and no record above: the tag of the nodes it looks like, with the properties it brings, all guesses.
  if (!fields.length) {
    const tag = allTags.length || asPage.length || !isBlock(b) ? null : assume || tagFor(b, text, ctx);
    if (!tag) return { record, pieces, skip };
    const assumed = piecesFor({ ...b, 'block/tags': [{ 'db/id': tag.id }] }, text, ctx, ownAtStart, tag);
    const tagPiece = { ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'alike-tag', from: tag.from, guess: true };
    return { record: b, pieces: [tagPiece, ...assumed.pieces.map(piece => ({ ...piece, guess: true, needsTag: true }))], skip: assumed.skip, assume: tag };
  }
  const recordTags = record === b ? ownTags : (pick(record, 'block/tags') || []).map(idOf);
  const page = pick(b, 'block/page'), journalDay = Number(pick(page, 'block/journal-day') || 0);
  const pageTags = new Set((pick(page, 'block/tags') || []).map(idOf));
  const pageAsPage = page && !journalDay ? { id: idOf(page), uuid: String(pick(page, 'block/uuid') ?? ''), title: String(pick(page, 'block/title') ?? ''), tags: [...pageTags].map(id => ({ id })) } : null;
  const held = new Set(fields.flatMap(prop => valuesOf(record, prop.ident)));
  const free = links.filter(p => !held.has(p.id)), used = new Set(), quiet = new Set();
  let pageUsed = false;
  for (const [ident, xs] of claimed) {
    for (const x of xs) if (x.page) used.add(x.page);
    pieces.push({ ident, prop: ordered.find(p => p.ident === ident), kind: 'node', ids: xs.map(x => x.page?.id ?? 0), named: xs.map(x => x.key).join(','), asPage: xs, how: 'page-tag',
      shown: xs.map(x => x.page?.tags.some(t => t.id === x.tag.id) ? x.name : `${x.name} #${x.tag.title}`).join(', ') });
  }
  // A property kept quiet by two names keeps them: two doctors named do not spill into "with" (found by the scorer).
  for (const prop of ordered) {
    // A property a tagged page went in still speaks for the links it takes: a doctor linked beside [[Dr. New]]#Doctor
    // does not spill into "with" (second reading).
    if (claimed.has(prop.ident)) { if (prop.classes.length) { const classIds = new Set(prop.classes.map(c => c.id)); for (const p of free) if (fits(p, classIds, schema)) used.add(p); } continue; }
    const filled = valuesOf(record, prop.ident).length > 0;
    if (prop.type === 'node' && prop.classes.length) {
      const classIds = new Set(prop.classes.map(c => c.id));
      const fitting = free.filter(p => !used.has(p) && fits(p, classIds, schema));
      // A filled property still claims the links it takes: a second doctor named when doctor is filled does not become "with".
      if (fitting.length) {
        for (const p of fitting) used.add(p);
        // From a note under the record, only a one-value property is sure: a list of people in a note ("rang Amara and
        // Tunde") is not the record's "spoke with" (found by the scorer on the lean graph).
        // Into a wide property, only from the record's own words, and only as a guess: a link in a note under it ("Decided:
        // [[Surgery first]]") is not what the record is about (the owner's graph, 2026-10-21: four such, all wrong).
        const isWide = wide(prop, schema);
        if (!filled && (prop.many ? record === b : fitting.length === 1) && !(isWide && record !== b)) pieces.push({ ident: prop.ident, prop, kind: 'node', ids: fitting.map(p => p.id), shown: fitting.map(p => p.title).join(', '), ...namesOf(fitting), how: 'linked', ...(isWide ? { guess: true, how: 'linked-wide' } : {}) });
        else quiet.add(prop.ident); // no guess either
        continue; // two names for one place: quiet, and the names are spoken for
      }
      if (filled) continue;
      // The page fills one property only, the most particular that takes it (doctor, not also "with"; seen in the app).
      if (pageAsPage && !pageUsed && pageAsPage.id !== idOf(record) && fits(pageAsPage, classIds, schema)) { pageUsed = true; used.add(ctx.byId.get(pageAsPage.id) || pageAsPage); pieces.push({ ident: prop.ident, prop, kind: 'node', ids: [pageAsPage.id], shown: pageAsPage.title, how: 'page', ...(wide(prop, schema) ? { guess: true, how: 'page-wide' } : {}) }); continue; }
    } else if (!filled && prop.type === 'date' && prop.lower === 'date') {
      // The journal day only for tags whose nodes are dated the day they are written, as the graph shows (symptom logs
      // are; appointments are often written ahead, so the day would be wrong; found by the scorer).
      if (journalDay && datedWhenWritten(recordTags, ctx)) pieces.push({ ident: prop.ident, prop, kind: 'day', ids: [idOf(page)], day: journalDay, journalId: idOf(page), shown: dayText(journalDay), how: 'day' });
    }
  }
  pieces.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop)); // shown in the order the tag gives them
  const guesses = guessesFor({ b, text, record, fields: ordered, recordTags, links, free, used, quiet, done: new Set(pieces.map(p => p.ident)), ctx });
  guesses.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop));
  return { record, pieces: [...pieces, ...guesses], skip };
}

/* Piece 2: the guesses. Words are compared as lower-case words, links read as the names they show. */
const WORD = /[\p{L}\p{N}]+/gu;
const wordsOf = text => String(text || '').toLowerCase().match(WORD) || [];
// Words that name nothing on their own, even when a title has them.
const COMMON = new Set('with from that this have been after before about again today tomorrow morning evening night week weeks home done back into over than then them they there what when will just very more some other first last next little still feel felt good well better worse every each same also only once twice like says said told rang call called video check post appointment report results result about'.split(' '));
const telling = word => word.length >= 4 && !COMMON.has(word) && !/^\d+$/.test(word);
// The words a bullet's text shows outside its links and tags (what plain words can name).
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));
// All the words a text shows, a saved link ([[uuid]]) read as its page's title, tags left out (for the engine).
function shownWords(text, ctx) {
  const named = String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => ' ' + (/^[0-9a-f-]{36}$/i.test(key) ? ctx.byKey.get(key.toLowerCase())?.title || '' : key) + ' ');
  return new Set(wordsOf(named.replace(TAG, ' ')));
}
// The pages a saved title links ([[uuid]], or [[Name]] in the text box), as ids, for the engine's link tokens.
const linkIdsIn = (text, ctx) => [...new Set([...String(text || '').matchAll(LINK)].map(([, key]) => ctx.byKey.get(key.trim().toLowerCase())?.id).filter(id => id != null))];
// Every page by the names it goes by (its title and its aliases), for plain words: the telling words of each name,
// and each whole name. Alias pages themselves are left out: they stand for their original.
function namesFor(ctx) {
  if (ctx.names) return ctx.names;
  const aliasOf = new Map((ctx.aliases || []).map(([original, alias]) => [alias, original]));
  const byWord = new Map(), whole = new Map();
  const add = (page, name) => {
    const words = wordsOf(name);
    if (!words.length || name.length < 3) return;
    if (!whole.has(words[0])) whole.set(words[0], []);
    whole.get(words[0]).push({ page, words });
    for (const word of new Set(words.filter(telling))) { if (!byWord.has(word)) byWord.set(word, new Set()); byWord.get(word).add(page); }
  };
  for (const page of ctx.pages) if (!page.isTag && !aliasOf.has(page.id)) add(page, page.title);
  for (const [alias, original] of aliasOf) { const page = ctx.byId.get(original), name = ctx.byId.get(alias)?.title; if (page && name) add(page, name); }
  return (ctx.names = { byWord, whole, aliasIds: new Set(aliasOf.keys()) });
}
// The one page of the property's tags the words name, or null: a whole name counts more than a word of it, and a tie
// names no one.
function namedIn(words, classIds, ctx, spoken) {
  const { byWord, whole } = namesFor(ctx), score = new Map(), by = new Map();
  const bump = (page, n, word) => { if (!spoken.has(page) && fits(page, classIds, ctx.schema)) { score.set(page, (score.get(page) || 0) + n); if (word) by.set(page, [...by.get(page) || [], word]); } };
  for (const word of new Set(words)) for (const page of byWord.get(word) || []) bump(page, 1, word);
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w)) bump(page, 10); });
  let best = null, top = 0, tie = false;
  for (const [page, n] of score) { if (n > top) { best = page; top = n; tie = false; } else if (n === top) tie = true; }
  if (tie || !best) return null;
  // A page named only by a word of its title ("the tingling", "Dr. Patel") must have earned that word: when earlier
  // lines hold the word, most of them must be about that page (linking it, or holding it as a value). The stress test
  // (2026-10-21, 3,000 pages): one word shared by chance named a page 1,381 times wrong in 1,388.
  if (top < 10 && !wordsEarned(by.get(best) || [], best, ctx)) return null;
  return best;
}
// Every page of the property's tags the words name by a whole name or alias, in the order written, for a property
// that holds several ("Spoke with Dr. Mei Chen and Ruth Okoro" names two people). A word of a title alone names no one here, and
// a name inside a longer one ("Northgate" in "Northgate Cancer Center") counts only as the longer.
function allNamedIn(words, classIds, ctx, spoken) {
  const { whole } = namesFor(ctx), spans = [];
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w) && !spoken.has(page) && fits(page, classIds, ctx.schema)) spans.push({ page, from: i, to: i + name.length }); });
  const kept = spans.filter(a => !spans.some(b => b !== a && b.from <= a.from && b.to >= a.to && b.to - b.from > a.to - a.from));
  return [...new Set(kept.sort((a, b) => a.from - b.from).map(s => s.page))];
}
const EARNED_LINES = 1, EARNED_SHARE = .5;
function wordsEarned(words, page, ctx) {
  const index = ctx.alike;
  if (!index || !alike) return true; // nothing read yet: as before
  const link = 'link:' + page.id;
  for (const word of words) {
    const lines = index.postings.get(alike.stem(word)) || [];
    if (lines.length < EARNED_LINES) continue;
    let about = 0;
    // The page itself counts as about it: pages are learned from too since 0.4.239, and a hospital's own title holds its words.
    for (const i of lines) { const e = index.entries[i]; if (e.id === page.id || e.tokens.includes(link) || [...e.values.values()].some(ids => ids.includes(page.id))) about++; }
    if (about / lines.length < EARNED_SHARE) return false;
  }
  return true;
}
/* The plain-language reader (stage E): what is literally in the words, read the same in every graph. */
const WEEKDAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?';
// Whole month names only (the stress test, 2026-10-21: "5 marathons" was read as March 5, "3 junior doctors" as June 3).
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?=\\s)';
const SMALL = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// After a bare "the 4th", only the end of the words, a time, or a small joining word: "on the 2nd floor" is a floor.
const AFTER_DAY = '(?=\\s*$|\\s+(?:at|in|and|then|for|so|but|or|to|when|with|please|until|till|\\d))';
const asDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
// The days the words name, as day numbers, each once, counted from `base` (the journal day the bullet is written on,
// else today): a weekday is the coming one; "the 4th" the next 4th; a day and month the next such day; "in two weeks".
function daysInWords(text, base) {
  const words = ' ' + cleanWords(text).toLowerCase().replace(/[.,;:!?()]/g, ' ') + ' ', today = asDate(base), found = new Set();
  const add = date => { if (date && !Number.isNaN(date.getTime())) found.add(dayNumber(date)); };
  for (const [, word] of words.matchAll(/\s(today|tomorrow|tmr|yesterday)\s/g)) add(parseDay(word, today));
  // A weekday: its whole name anywhere ("Friday"); a short one only after on, next, this, by, until (the code review,
  // 2026-10-21: "Sat with Dr. Chen" and "Sun was out" were read as days).
  for (const [, next, on, day] of words.matchAll(new RegExp(`\\s(?:(next)\\s+|(on|this|by|until|till)\\s+)?(${WEEKDAY})(?=\\s)`, 'g'))) if (next || on || day.endsWith('day')) add(parseDay(`${next ? 'next ' : ''}${day}`, today));
  for (const [, n] of words.matchAll(new RegExp(`\\s(?:on|by|until|till|from|before|after|for|${WEEKDAY})\\s+the\\s+(\\d{1,2})(?:st|nd|rd|th)${AFTER_DAY}`, 'g'))) {
    const d = Number(n);
    if (d < 1 || d > 31) continue;
    let date = new Date(today.getFullYear(), today.getMonth(), d);
    if (date.getDate() !== d || date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, d);
    if (date.getDate() === d) add(date);
  }
  // A day and a month, either way round ("4 Aug", "the 4th of December", "Aug 4th"); a day that does not exist (Feb 30) is none.
  // "May" is a month only where a date can end: "Dose 4 may need lowering" is the verb (the code review, 2026-10-21).
  const dayMonth = (d, month, rest) => {
    if (month === 'may' && !new RegExp(`^${AFTER_DAY}`).test(rest)) return;
    const date = parseDay(`${d} ${month.slice(0, 3)}`, today); if (date && date.getDate() === Number(d)) add(date);
  };
  for (const m of words.matchAll(new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH})`, 'g'))) dayMonth(m[1], m[2], words.slice(m.index + m[0].length));
  for (const m of words.matchAll(new RegExp(`\\s(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'g'))) dayMonth(m[2], m[1], words.slice(m.index + m[0].length));
  for (const [, n, unit] of words.matchAll(/\sin\s+(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?|fortnights?)(?=\s)/g)) add(dayAfter(today, (SMALL[n] ?? Number(n)) * (unit.startsWith('fortnight') ? 14 : unit.startsWith('week') ? 7 : 1)));
  for (const [, iso] of words.matchAll(/\s(\d{4}-\d{1,2}-\d{1,2})\s/g)) add(parseDay(iso, today));
  return [...found];
}
// The number written beside a number property's name ("cycle 5", "5 cycles"), or null; two different ones, null.
function numberInWords(text, prop) {
  // A full stop ends a number ("Chemo cycle 5."), a point inside one does not (1.5).
  const words = ' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ').replace(/\.(?=\s|$)/g, ' ') + ' ', found = new Set();
  const name = prop.lower.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (!name) return null;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // "cycles 3 and 4" names two (the stress test): a number followed by another one is no answer.
  for (const [, n] of words.matchAll(new RegExp(`\\s${esc}s?\\s+(?:no\\.?\\s*|#)?(\\d+(?:\\.\\d+)?)(?=\\s)(?!\\s+(?:and|or|to|&|-)\\s+\\d)`, 'g'))) found.add(Number(n));
  for (const [, n] of words.matchAll(new RegExp(`\\s(\\d+(?:\\.\\d+)?)\\s+${esc}s?\\s`, 'g'))) found.add(Number(n));
  return found.size === 1 ? [...found][0] : null;
}
// The journal page of a day, by its number, when the graph has one; ctx.days is read the other way round once.
const dayIdFor = (ctx, day) => (ctx.dayIds ||= new Map([...(ctx.days || [])].map(([id, d]) => [d, id]))).get(day) ?? null;

// The tag of the nodes an untagged bullet looks like (stage D): by its words and links alone, among every node under
// a tag the model knows; the nearest vote, under the tag's own stricter limits. One tag, a tag page the plugin knows.
function tagFor(b, text, ctx) {
  if (!ctx.alike || !alike) return null;
  const { links } = inWords(text, ctx);
  const tokens = alike.tokensOf(shownWords(text, ctx), alike.limits.tagLinks === false ? [] : links.map(p => p.id), []);
  if (tokens.length < 2) return null;
  // Ordinary lines with no tag vote too, for none (0): a line like twenty earlier plain notes gets no tag (the stress
  // test, 2026-10-21: repeated plain notes were offered #Expectation by one rare word they shared with a scan).
  const near = alike.neighbours(ctx.alike, tokens, { skip: new Set([idOf(b)]), keep: entry => entry.values.get('block/tags')?.length > 0 });
  const { tagNearLeast: nearLeast, tagLead: lead, tagLeast: least } = alike.limits;
  const voted = alike.vote(near, 'block/tags', { nearLeast, lead, least });
  if (!voted || voted.ids.length !== 1 || voted.ids[0] === 0) return null;
  const page = ctx.byId.get(voted.ids[0]);
  return page?.isTag && page.uuid && (!ctx.knownTags || ctx.knownTags.has(page.id)) ? { ...page, from: examplesFor(near, 'block/tags', voted.ids) } : null;
}
// The nodes the bullet looks like, for one property: the nearest earlier holders of it, by the bullet's words
// (links read as titles), its links and the record's tags; the bullet itself left out. Only from the bullet's own
// words (not a note's under the record), and only once the engine's index is there (never waited for while typing).
function looksLike(text, links, tagIds, prop, skip, ctx) {
  if (!ctx.alike || !alike) return [];
  const tokens = alike.tokensOf(shownWords(text, ctx), links.map(p => p.id), tagIds);
  return alike.neighbours(ctx.alike, tokens, { skip, keep: entry => entry.values.get(prop.ident)?.length > 0 });
}
// For the pickers (0.4.253, parts/picker.js): the values that fit this bullet's property best, best first, as page ids:
// the pages its words link that the property takes, then what the nodes it looks like hold for it, each counted with
// the square of its likeness (the engine's vote, without the vote's thresholds: an order, not a proposal). [] when
// nothing fits or the engine has not read the earlier lines yet (never waited for: the list is already open).
async function pickerOrder(uuid, title, words) {
  if (!UUID.test(String(uuid))) return [];
  const ctx0 = await contextFor();
  const prop = ctx0.schema.props.find(p => p.type === 'node' && p.lower === String(title || '').trim().toLowerCase());
  const b = prop && await pullBlock(uuid);
  if (!b) return [];
  const text = words ?? titleOf(b);
  const ctx = await guessDataFor(await withFreshLinks(text, ctx0), { wait: false });
  const accepted = new Set(prop.classes.map(c => c.id));
  const { links } = inWords(text, ctx);
  const order = links.filter(page => !accepted.size || fits(page, accepted, ctx.schema)).map(page => page.id);
  const tagIds = (pick(b, 'block/tags') || []).map(idOf);
  const score = new Map();
  for (const { entry, sim } of looksLike(text, links, tagIds, prop, new Set([idOf(b)]), ctx))
    for (const id of entry.values.get(prop.ident) || []) score.set(id, (score.get(id) || 0) + sim * sim);
  for (const [id] of [...score].sort((x, y) => y[1] - x[1])) if (!order.includes(id)) order.push(id);
  return order.slice(0, 5);
}
/* For a node not yet made (0.4.406, the two-way rows' + line, docs/history/TWO-WAY-ADD-PROPOSALS-2026-10-25.html): the
   same pieces a bullet gets, from the words typed, the tag the node will get, what is already set on it (the row's
   property pointing at the page it is added from, a group's value: never proposed again, and that page never free for
   another property) and the day it goes on (today's journal unless it goes elsewhere). draftPieces is pure, on a
   context the caller gives (the tests); draftProposals reads the graph's, never waiting for the earlier lines, and
   returns plain data: a tag, or a value that would tag a page, is left out (the line's tag is its own). */
function draftPieces({ text, tagId = null, tag = '', set = [], journalDay = 0 }, ctx) {
  if (tagId == null && tag) tagId = ctx.pages.find(p => p.isTag && p.lower === String(tag).toLowerCase())?.id ?? null;
  const journalId = journalDay ? dayIdFor(ctx, journalDay) : null;
  const page = journalDay ? { 'db/id': journalId ?? -journalDay, 'block/journal-day': journalDay, 'block/tags': [] } : { 'db/id': -1, 'block/tags': [] };
  const b = { 'db/id': 0, 'block/uuid': '', 'block/title': String(text || ''), 'block/tags': tagId ? [{ 'db/id': tagId }] : [], 'block/page': page, 'block/parent': page };
  for (const { ident, ids } of set) if (ident && ids?.length) b[ident] = ids.map(id => ({ 'db/id': id }));
  return piecesFor(b, String(text || ''), ctx).pieces.filter(p => p.kind !== 'tag' && !p.needsTag && !p.tagPage);
}
async function draftProposals(draft) {
  const ctx = await withFreshLinks(draft.text, await guessDataFor(await daysFor(await contextFor(), { wait: false }), { wait: false }));
  return draftPieces(draft, ctx).map(p => ({ ident: p.ident, title: p.prop.title, kind: p.kind, ids: p.ids, shown: p.shown, names: p.names || null, guess: !!p.guess, many: !!p.prop.many, day: p.day || 0, journalId: p.journalId > 0 ? p.journalId : null }));
}
/* For a node already made (0.4.438, the two-way section's opened node, docs/STRUCTURE.md 6.1 stage 5: "an opened node's
   empty properties showing the proposals in italic with the dotted line, so digging fixes as it goes"): the pieces its
   own words give, as a bullet being written gets them, in draftProposals' shape. */
async function nodeProposals(uuid) {
  if (!UUID.test(String(uuid))) return [];
  const b = await pullBlock(uuid);
  if (!b) return [];
  const text = String(pick(b, 'block/title') ?? titleOf(b) ?? '');
  // Asked when a node is opened (a click, not typing), so the earlier lines are waited for, as tagGuess does.
  const ctx = await withFreshLinks(text, await guessDataFor(await daysFor(await contextFor())));
  return piecesFor(b, text, ctx).pieces.filter(p => p.kind !== 'tag' && !p.needsTag && !p.tagPage)
    .map(p => ({ ident: p.ident, title: p.prop.title, kind: p.kind, ids: p.ids, shown: p.shown, guess: !!p.guess, many: !!p.prop.many, day: p.day || 0, journalId: p.journalId > 0 ? p.journalId : null }));
}
/* The tag an untagged node's words look like (0.4.423, for the two-way rows' "mentioned in" row: a mention that looks like
   a Conversation is offered to be made one): the same nearest vote an untagged bullet's Tags pill gets while it is
   written (tagFor, stage D), on the node's stored words. { id, uuid, title } or null; null for a node with a tag of
   yours already, and when the words look like no one tag. */
async function tagGuess(uuid) {
  if (!UUID.test(String(uuid))) return null;
  const b = await pullBlock(uuid);
  if (!b) return null;
  const ctx0 = await contextFor();
  if ((pick(b, 'block/tags') || []).some(t => ctx0.byId.get(idOf(t))?.isTag && !ctx0.schema.builtIn?.has(idOf(t)))) return null;
  // A pulled block keeps its words under Logseq's own key (titleOf reads the API's shape).
  const text = String(pick(b, 'block/title') ?? titleOf(b) ?? '');
  // Asked on a tick, not while typing, so the earlier lines are waited for the first time.
  const ctx = await guessDataFor(await withFreshLinks(text, ctx0));
  const tag = tagFor(b, text, ctx);
  return tag ? { id: tag.id, uuid: tag.uuid, title: tag.title } : null;
}
/* The pages some words name (0.4.414, for the two-way rows' picking bar, idea 4 of the brainstorm of 2026-10-25): the
   pages linked in them, then every page named by its whole name or a second name ("Saw Dr. Chen and Dr. Patel" when
   Dr. Patel is a second name), then the one page a word of a name points to when the earlier lines earned it, as a
   bullet's proposals read them; only pages under the tags given (any tagged page with none given). Ids, in that order, each
   once. namedIds is pure, on a context; namedPages reads the graph's, never waiting for the earlier lines. */
function namedIds(text, tagIds, ctx) {
  const classIds = tagIds?.length ? new Set(tagIds) : { has: () => true }; // none given: a page with any tag
  const { links } = inWords(text, ctx), words = freeWords(text), out = [];
  for (const page of links) if (fits(page, classIds, ctx.schema)) out.push(page.id);
  for (const page of allNamedIn(words, classIds, ctx, new Set())) if (!out.includes(page.id)) out.push(page.id);
  const one = namedIn(words, classIds, ctx, new Set());
  if (one && !out.includes(one.id)) out.push(one.id);
  return out;
}
async function namedPages(text, tagIds = []) {
  const ctx = await withFreshLinks(text, await guessDataFor(await contextFor(), { wait: false }));
  return namedIds(String(text || ''), tagIds, ctx);
}
// The earlier bullets behind a vote, for saying why (0.4.266): the two nearest that held what was voted, as words, each once.
function examplesFor(near, ident, ids) {
  const key = [...ids].sort((a, b) => a - b).join(',');
  const said = near.filter(x => [...(x.entry.values.get(ident) || [])].sort((a, b) => a - b).join(',') === key)
    .map(x => String(x.entry.title || '').replace(/\[\[([^\]]+)\]\]/g, (m, k) => (UUID.test(k) ? ctx0Title(k) : k)).replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [...new Set(said)].slice(0, 2); // the same words twice say nothing more
}
let ctx0Title = () => '';
// Several pages for one property: each by itself, so a click on one name takes only that one (0.4.395).
const namesOf = pages => pages.length > 1 ? { names: pages.map(p => ({ id: p.id, title: p.title })) } : {};
const sameIds = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
function guessesFor({ b, text, record, fields, recordTags, links, free, used, quiet, done, ctx }) {
  const own = record === b, parent = pick(b, 'block/parent'), journalDay = Number(pick(pick(b, 'block/page'), 'block/journal-day') || 0);
  const parentTags = own && isBlock(parent) ? (pick(parent, 'block/tags') || []).map(idOf) : [];
  const skip = new Set([idOf(b)]);
  const words = freeWords(text), spoken = new Set(used), out = [];
  const open = prop => !done.has(prop.ident) && !quiet.has(prop.ident) && !valuesOf(record, prop.ident).length;
  const nodeOf = id => ctx.byId.get(id);
  for (const prop of fields) {
    if (!open(prop)) continue;
    const isNode = prop.type === 'node' && prop.classes.length, isDate = prop.type === 'date', isNumber = isNumberProp(prop), isChoice = isChoiceProp(prop);
    if (!isNode && !isDate && !isNumber && !isChoice) continue;
    const said = [];
    // Stage E: a number beside the property's name ("cycle 5"). Not from the bullets it looks like (tried 0.4.265: on the
    // test graph every Severity voted that way was wrong, 6 of 6, each by one: how bad a day was is not in its words).
    if (isNumber) {
      const n = own ? numberInWords(text, prop) : null;
      if (n != null) out.push({ ident: prop.ident, prop, kind: 'number', ids: [n], shown: String(n), how: 'words-number', guess: true });
      continue;
    }
    // A choice (Status …) is never proposed (0.4.292, the owner: "Drop"): guessed from look-alike bullets from 0.4.265, it
    // was wrong 255 times on the random Stress Check graph, and where a thing stands is rarely in its words. The
    // choices are still learned, for the pickers' order (pickerOrder).
    if (isChoice) continue;
    // The parent's values, for a property both have.
    if (parentTags.length) { const v = valuesOf(parent, prop.ident); if (v.length) said.push({ ids: v, how: 'parent' }); }
    if (isNode) {
      const classIds = new Set(prop.classes.map(c => c.id));
      // The nodes it looks like: the nearest earlier holders of the property vote, and a clear lead speaks.
      const near = own ? looksLike(text, links, recordTags, prop, skip, ctx) : [];
      const voted = own ? alike?.vote(near, prop.ident) : null;
      if (voted) said.push({ ids: voted.ids, how: 'alike', from: examplesFor(near, prop.ident, voted.ids) });
      // Two names or more for a property that holds several: the words say who, and the rest is not asked (0.4.395).
      let several = prop.many && !wide(prop, ctx.schema) ? allNamedIn(words, classIds, ctx, spoken) : [];
      // Names a one-value property of the bullet takes too (two doctors where the bullet also has one doctor): spoken for by the
      // property they leave quiet, as two linked doctors are (piecesFor), so they do not spill over. Not a wide one
      // (Topic): plain names are never taken for it, so it leaves nothing quiet.
      if (several.length > 1 && fields.some(q => q !== prop && !q.many && q.type === 'node' && q.classes.length && !wide(q, ctx.schema) && open(q) && several.every(p => fits(p, new Set(q.classes.map(c => c.id)), ctx.schema)))) several = [];
      const named = several.length > 1 || wide(prop, ctx.schema) ? null : namedIn(words, classIds, ctx, spoken);
      if (several.length > 1) said.splice(0, said.length, { ids: several.map(p => p.id), how: 'words' });
      else if (named) said.push({ ids: [named.id], how: 'words' });
    }
    // The journal day, as a guess, for a "date" of a tag the graph has too few dated nodes of to be sure (fewer than
    // 5) but at least one, none of them dated another day (0.4.211, at the owner's word: "the date is not taking the date of journal";
    // a treatment had 3). A tag whose nodes are dated other days (an expectation, written ahead) still gets nothing.
    if (isDate && !said.length && prop.lower === 'date' && journalDay && fewDatedAllSameDay(recordTags, ctx)) said.push({ ids: [idOf(pick(b, 'block/page'))], how: 'day' });
    // Stage E: a date written in the words, counted from the day the bullet is written on (else today); one, or nothing.
    if (isDate && own && prop.lower === 'date' && datedAhead(recordTags, ctx)) {
      const days = daysInWords(text, journalDay || dayNumber(new Date()));
      if (days.length === 1) { const id = dayIdFor(ctx, days[0]); said.push({ ids: [id ?? -days[0]], day: days[0], how: 'words-day' }); }
    }
    // Nothing else said a day: on a journal page, the journal day, as a guess to check (0.4.360, the owner a second time,
    // after 0.4.211: "the date is not filled with a proposal on a journal entry for something like #Appointment"). A new
    // tag, or one often dated ahead, used to get nothing; a date named in the words still comes first.
    // Only the bullet's own Date (not a record above it from a note), not when the words name two days or more, and not
    // when they point ahead without naming a day ("Scan next week", "tomorrow": today would be wrong), nor for a tag whose
    // earlier nodes are mostly dated another day (at least 5 of them: the test graph's Expectations, written weeks ahead).
    if (isDate && own && !said.length && prop.lower === 'date' && journalDay && daysInWords(text, journalDay).length < 2 && !AHEAD.test(text) && !mostlyAhead(recordTags, ctx)) said.push({ ids: [idOf(pick(b, 'block/page'))], how: 'guess-day' });
    if (!said.length || !said.every(s => sameIds(s.ids, said[0].ids))) continue;
    const ids = said[0].ids;
    if (!prop.many && ids.length !== 1) continue;
    if (isDate) {
      const day = said.find(s => s.day)?.day || ctx.days?.get(ids[0]);
      if (day) out.push({ ident: prop.ident, prop, kind: 'day', ids, day, journalId: ids[0] > 0 ? ids[0] : null, shown: dayText(day), how: said.map(s => s.how).join('+'), guess: true });
      continue;
    }
    const pages = ids.map(nodeOf);
    if (pages.some(p => !p)) continue;
    for (const p of pages) spoken.add(p);
    out.push({ ident: prop.ident, prop, kind: 'node', ids, shown: pages.map(p => p.title).join(', '), ...namesOf(pages), how: said.map(s => s.how).join('+'), from: said.find(s => s.from)?.from, guess: true });
  }
  // A linked page with no tag yet: a guess for the first empty place it could fill (a property taking one tag, the
  // most particular first), when there are one or two such places and no other such page competes for them. Taking
  // it gives the page that tag too. Only one place, since Enter takes every guess (0.4.202; it offered both before).
  const { aliasIds } = namesFor(ctx);
  const loose = free.filter(p => !used.has(p) && untagged(p) && !aliasIds.has(p.id));
  const places = fields.filter(prop => open(prop) && prop.type === 'node' && prop.classes.length === 1 && !out.some(g => g.ident === prop.ident));
  if (loose.length === 1 && places.length && places.length <= 2) {
    const [p] = loose;
    for (const prop of places.slice(0, 1)) {
      const tag = prop.classes[0];
      out.push({ ident: prop.ident, prop, kind: 'node', ids: [p.id], shown: p.title, how: 'untagged', guess: true,
        tagPage: { tag, uuids: [p.uuid] }, note: `becomes a #${tag.title}` });
    }
  }
  return out;
}
// The nodes under tags with link properties, their words, links, tags and values, made into the engine's index (the
// nodes a bullet may look like); and the aliases (original, alias), for plain words. Kept apart from the context, per
// graph, read again at most every five minutes (guessDataFor). ctx.history marks that it was read.
function addHistory(ctx, entries) {
  ctx.history = true;
  const kept = [];
  for (const entry of entries) {
    const words = entry.words || shownWords(entry.title, ctx);
    if (words.size < 2) continue;
    const values = new Map(entry.values);
    values.set('block/tags', entry.tags?.length ? entry.tags : [0]); // 0: a plain line, no tag
    kept.push({ id: entry.id, title: entry.title, tokens: alike ? alike.tokensOf(words, entry.links || linkIdsIn(entry.title, ctx), entry.tags) : [], values });
  }
  ctx.alike = alike ? alike.buildIndex(kept) : null;
  return ctx;
}
// Read at most every five minutes, apart from the context (which is read again every 30 s while you write), and
// never waited for while typing: until it is there, the guesses go without aliases and earlier lines.
const GUESS_DATA_EVERY = 300000;
const guessCache = { graph: null, at: 0, data: null, loading: null };
async function guessDataFor(ctx, { wait = true } = {}) {
  if (ctx.history) return ctx;
  const graph = (await model.currentGraph())?.name || '';
  let data = guessCache.graph === graph ? guessCache.data : null;
  if (!data || Date.now() - guessCache.at > GUESS_DATA_EVERY) {
    // A failed reading is reported once and tried again next time; never left as an error nobody handles.
    guessCache.loading ||= loadGuessData(ctx).then(fresh => Object.assign(guessCache, { graph, at: Date.now(), data: fresh }).data)
      .catch(error => { warnOnce('the earlier lines could not be read', error); return guessCache.data; }).finally(() => { guessCache.loading = null; });
    if (!data && wait) data = await guessCache.loading;
  }
  if (!data) return ctx;
  ctx.aliases = data.aliases;
  ctx.knownTags = new Set(data.tagIds || []);
  ctx.names = null;
  // The index is built once for each reading of the earlier lines, not again for every new context: the page list
  // is read again every 30 s while you write, and on 50,000 lines a new index took 0.2 s, a pause in the typing (the
  // stress test, 2026-10-21).
  if (!data.index) data.index = addHistory({ ...ctx }, data.entries).alike;
  ctx.history = true;
  ctx.alike = data.index;
  return ctx;
}
// The properties the earlier lines are learned by: links that take a tag, and choices (0.4.265).
const learnedProps = schema => [...schema.props.filter(p => p.type === 'node' && p.classes.length), ...schema.props.filter(isChoiceProp)];
/* Learning a node at once (0.4.267, layer 2 item 9, "learn a filled value at once"): when the graph changes, the nodes
   changed are read again a moment later and take their new place in what the guesses learn from, so a value filled
   in, or a tag given, counts for the next bullet at once instead of within five minutes. Only while the earlier lines
   are already read; the full reading every five minutes stays as it was. A node with no tag of the owner's (and not a
   plain line) or deleted is in effect taken out. */
const learning = { ids: new Set(), timer: 0 };
function learnSoon(blocks) {
  for (const block of blocks || []) { const id = idOf(block) ?? block?.id; if (Number.isSafeInteger(id) && id > 0) learning.ids.add(id); }
  if (!learning.ids.size || !guessCache.data?.index) return;
  clearTimeout(learning.timer); pending.delete(learning.timer);
  learning.timer = later(() => learnNow().catch(error => warnOnce('a changed node could not be learned', error)), 400);
}
async function learnNow() {
  const data = guessCache.data, ids = [...learning.ids];
  learning.ids.clear();
  if (!data?.index || !ids.length || !context?.schema || P.stopped) return;
  const ctx = context, learned = learnedProps(ctx.schema), known = new Set(data.tagIds || []);
  const nodes = new Map((await model.nodesById(ids, learned.map(p => p.ident))).map(n => [idOf(n), n]));
  if (guessCache.data !== data) return; // read again meanwhile: that reading has them
  for (const id of ids) {
    const n = nodes.get(id), title = String(pick(n, 'block/title') ?? '');
    const tags = (pick(n, 'block/tags') || []).map(idOf);
    const mine = tags.filter(t => known.has(t)), plain = !tags.length;
    const words = n && (mine.length || plain) ? shownWords(title, ctx) : new Set();
    const values = new Map(learned.map(p => [p.ident, valuesOf(n, p.ident)]).filter(([, v]) => v.length));
    values.set('block/tags', mine.length ? mine : [0]);
    const tokens = alike && words.size >= 2 ? alike.tokensOf(words, linkIdsIn(title, ctx), mine) : [];
    alike?.updateEntry(data.index, { id, title, tokens, values });
  }
}
async function loadGuessData(ctx) {
  const { schema } = ctx;
  if (!schema) return { aliases: [], tagIds: [], entries: [] }; // the properties not read yet: nothing to learn from
  // Choices are learned too (0.4.265, layer 2 item 7): what the bullets a new one looks like held, as a vote, like a
  // link (Status Planned on an expectation written like earlier planned ones). Numbers were tried and left out (below).
  const learned = learnedProps(schema);
  // Every tag of the owner's own (user.class/…), for stage D's tag votes: never Logseq's (Task, Card, Query), which
  // the schema knows too; before 0.4.213 only the tags with link properties.
  const tagIds = await model.userTagIds();
  const [rows, aliases, plain] = await Promise.all([
    model.taggedNodes(tagIds, learned.map(p => p.ident)).catch(error => { warnOnce('the earlier lines could not be read', error); return []; }),
    model.aliasPairs(),
    // Plain lines (no tag at all), for the tag's vote: they say "no tag" (the stress test, 2026-10-21).
    model.plainLines()]);
  return { aliases, tagIds,
    entries: [...plain.map(({ id, title }) => ({ id, title, words: shownWords(title, ctx), links: linkIdsIn(title, ctx), tags: [], values: new Map() })), ...rows.map(n => ({ id: idOf(n), title: String(pick(n, 'block/title') ?? ''), words: shownWords(String(pick(n, 'block/title') ?? ''), ctx), links: linkIdsIn(String(pick(n, 'block/title') ?? ''), ctx), tags: (pick(n, 'block/tags') || []).map(idOf),
      values: new Map(learned.map(p => [p.ident, valuesOf(n, p.ident)]).filter(([, v]) => v.length)) }))] };
}
// Journal days by page id, for the parent's date, and for each tag how many of its dated nodes written on a journal
// page carry that page's day (a small look-up kept with the context).
// Kept with the earlier lines, read again at most every five minutes (the stress test, 2026-10-21: read with every new
// context, every 30 s, the count took 0.2 s on a large graph, and the key that met it waited); only the first reading
// is waited for, as before.
const daysCache = { graph: null, at: 0, data: null, loading: null };
async function daysFor(ctx, { wait = true } = {}) {
  if (ctx.days) return ctx;
  const graph = (await model.currentGraph())?.name || '';
  let data = daysCache.graph === graph ? daysCache.data : null;
  if (!data || Date.now() - daysCache.at > GUESS_DATA_EVERY) {
    daysCache.loading ||= loadDays(ctx.schema).then(fresh => Object.assign(daysCache, { graph, at: Date.now(), data: fresh }).data)
      .catch(error => { warnOnce('the journal days could not be read', error); return daysCache.data; }).finally(() => { daysCache.loading = null; });
    if (!data && wait) data = await daysCache.loading;
  }
  if (!data) return ctx;
  ctx.days = data.days;
  ctx.dated = data.dated;
  return ctx;
}
// The Date property the rules use is found by its title, so the counts use the same one (the code review, 2026-10-21:
// it was named here as :user.property/date, which another graph's Date need not be).
async function loadDays(schema) {
  const date = schema?.props.find(p => p.type === 'date' && p.lower === 'date');
  const [days, dated] = await Promise.all([model.journalDays(), model.datedByTag(date?.ident)]);
  return { days, dated };
}
// Sure only with evidence: at least 5 such nodes under the record's own tags, and 19 in 20 dated the day written.
const DATED_LEAST = 5, DATED_SHARE = .95;
const AHEAD = /\b(?:next|tomorrow|later|soon|upcoming|coming up|in (?:a|an|\d+|a few|two|three) (?:days?|weeks?|months?|fortnight))\b/i;
function mostlyAhead(tagIds, ctx) { const { same, other } = datedCounts(tagIds, ctx); return other >= DATED_LEAST && other > same; }
function datedWhenWritten(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  return same + other >= DATED_LEAST && same / (same + other) >= DATED_SHARE;
}
// The journal day as a guess: a tag with one to four dated nodes, all the day written; or one with more, dated the day
// written at least 4 times in 5 but under the bar for sure (the stress test, 2026-10-21: one consultation the owner
// dated another day took the sure date from all of them, 10 in 11).
const DATED_GUESS_SHARE = .8;
function fewDatedAllSameDay(tagIds, ctx) {
  const { same, other } = datedCounts(tagIds, ctx);
  // At least one: no evidence is not permission (second reading: a new tag's first "Scan next Tuesday" would get today,
  // and so would every tag while the counts are still being read).
  if (same + other >= DATED_LEAST) return same / (same + other) >= DATED_GUESS_SHARE && !datedWhenWritten(tagIds, ctx);
  return same >= 1 && other === 0;
}
function datedCounts(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  return { same, other };
}
// A date in the words is the record's own only for a tag whose nodes are dated ahead at least as often as on the day
// written (an expectation), or that has none dated yet: a consultation's "I can drive in two weeks" is another day
// (the stress test, 2026-10-21).
function datedAhead(tagIds, ctx) {
  const { same, other } = datedCounts(tagIds, ctx);
  return other >= same;
}


Object.assign(P, { contextFor, daysFor, guessDataFor, ownTagsAtStart, piecesFor, pullBlock, withFreshLinks, LINK, TAG, inWords, pageTagIn, plainWords, sameIds, untagged, withPageTag, withoutPageTag, addHistory, freeWords, guessCache, learnSoon, allNamedIn, namedIn, namesFor, pickerOrder, wordsEarned, draftPieces, draftProposals, nodeProposals, namedIds, namedPages, tagGuess });
// The rules take what they use at their own start too, so the pickers' order (pickerOrder) works without the
// proposals while writing (0.4.269); parts/shadow.js runs every piece's link again when it starts.
(window.refinementParts ||= []).push({ name: 'proposals rules', schema: [], provide: core => core.provide({ pickerOrder, draftProposals, nodeProposals, namedPages, tagGuess }), start() { ownLink(window.refinementCore); }, stop: runUnloadTasks });
})();
