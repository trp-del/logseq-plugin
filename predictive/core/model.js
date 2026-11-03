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
   - A page property is offered only the pages the words name (a whole name, or a telling word of it, as names.js reads
     them) that fit it, and not one the rules already placed. No such page: it is not asked.
   - A number is kept only if the words hold it; a day only if the date reader finds that day in the words.
   - Everything kept is a guess: dotted, written only by Enter or a click, as any guess.

   request(ctx, b, result, today) -> { fill (what is sent), asked: Map(key -> { prop, kind, pages: Map(lower title -> page) }),
   days: Set(day numbers in the words) } | null.  pieces(ctx, request, reply) -> the guesses kept. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { wordsOf, TAG } = need('text');
const { fieldsOfTags, fits, wide, isNumberProp, isDateProp, isChoiceProp, isLinkProp, isBuiltInProp } = need('schema');
const names = need('names');
const { dayNumber } = need('dates');
const proposeLib = need('propose');

const MOST_PAGES = 12;
// A guess from a name in plain words and nothing else: the one guess of the rules the model may replace.
const byWordsAlone = p => p.kind === 'node' && p.guess && p.how === 'words';
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));
const iso = day => `${Math.floor(day / 10000)}-${String(Math.floor(day / 100) % 100).padStart(2, '0')}-${String(day % 100).padStart(2, '0')}`;
const fromIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };

// The pages the words name in plain words, a whole name or a telling word of one, that fit the property, in the order written.
function namedPages(ctx, words, classIds, spoken) {
  const { byWord, whole } = names.namesFor(ctx), found = [];
  const add = page => { if (!found.includes(page) && !spoken.has(page) && fits(page, classIds, ctx.schema)) found.push(page); };
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w)) add(page); });
  for (const word of words) for (const page of byWord.get(word) || []) add(page);
  return found.slice(0, MOST_PAGES);
}

function request(ctx, b, result, today = dayNumber(new Date())) {
  if (!result || result.record !== b || result.assume) return null;
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
  for (const prop of fields) {
    if (done.has(prop.ident) || quiet.has(prop.ident) || (b.values?.get(prop.ident) || []).length) continue;
    if (isChoiceProp(prop) || isBuiltInProp(prop)) continue;
    const key = 'p' + asked.size;
    if (isLinkProp(prop)) {
      if (wide(prop, ctx.schema)) continue;
      const pages = namedPages(ctx, words, new Set(prop.classes.map(c => c.id)), spoken);
      if (!pages.length) continue;
      asked.set(key, { prop, kind: 'page', pages: new Map(pages.map(p => [p.title.toLowerCase(), p])) });
      properties.push({ key, title: prop.title, kind: 'page', many: !!prop.many, choices: pages.map(p => p.title) });
    } else if (isNumberProp(prop) && hasNumber) {
      asked.set(key, { prop, kind: 'number' });
      properties.push({ key, title: prop.title, kind: 'number' });
    } else if (isDateProp(prop) && days.size) {
      asked.set(key, { prop, kind: 'date' });
      properties.push({ key, title: prop.title, kind: 'date' });
    }
  }
  if (!properties.length) return null;
  const tagTitles = tags.map(id => ctx.byId.get(id)?.title).filter(Boolean);
  const page = b.page && !b.page.day ? b.page.title : '';
  return { fill: { text: shown(ctx, text), page, tags: tagTitles, today: iso(base), properties }, asked, days };
}
// The words as the person reads them: a saved link as its page's name.
const shown = (ctx, text) => String(text).replace(/\[\[([^\[\]]+)\]\]/g, (m, key) => ctx.byKey.get(key.toLowerCase())?.title || key);

function pieces(ctx, req, reply) {
  const out = [], values = reply?.values || {}, taken = new Set();
  const { dayIdFor, dayText } = proposeLib;
  for (const [key, ask] of req.asked) {
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

/* The proposals shown: the rules', and the model's for what the rules left open. A model guess for a property the rules
   guessed from plain words alone takes its place; a plain-words guess holding a page the model put elsewhere goes, so one
   person is not in two places. */
function merge(rules, model) {
  if (!model?.length) return rules;
  const byModel = new Map(model.map(p => [p.ident, p])), placed = new Set(model.filter(p => p.kind === 'node').flatMap(p => p.ids));
  const kept = rules.filter(q => !(byWordsAlone(q) && (byModel.has(q.ident) || q.ids.some(id => placed.has(id)))));
  return [...kept, ...model.filter(p => !kept.some(q => q.ident === p.ident))];
}

const api = { request, pieces, merge, iso, fromIso, namedPages, byWordsAlone };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).model = api;
})();
