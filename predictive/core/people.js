/* New people and places as pages: a name in the words that no page has yet, pencilled as a new page in the property that takes
   such a thing, with the tag that property takes. Pure: the finding is Apple's name finder on the Mac (helper /names, through
   logseq/people.js), which reads a person, a place or an organization out of plain words; this decides which found name goes
   where, and only from the graph's own structure.

   "Saw Dr. Okafor at St Mary's about the scan" under Consultation: the rules find no page named Okafor, so Provider stays
   open; the name finder reads Okafor as a person and St Mary's as a place; Provider takes a Doctor, and the Doctor pages'
   titles are people, so "Dr. Okafor" is pencilled there as a new Doctor page, and St Mary's in Location as a new Hospital.

   Which tag holds which kind is read from the tag's own pages: the kinds of their titles (kinds: Map(tagId -> 'person' |
   'place' | 'organization')), found once per reading of the graph. A lead word most of a tag's pages begin with ("Dr." on the
   Doctor pages) is read from them too, and kept in front of a found name that follows it. No word of any language is named here.

   pieces(ctx, b, result, found, kinds) -> guesses: { kind: 'node', ids: [], newPage: { title, tag: { id, uuid, title } },
   shown: title, how: 'names', note }. Taking one makes the page with that tag and fills the property; Undo takes both back. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { wordsOf } = need('text');
const { fieldsOfTags, wide, isLinkProp, isChoiceProp, isBuiltInProp } = need('schema');
const names = need('names');
const proposeLib = need('propose');
const engine = need('engine');

const KIND_SHARE = .6, KIND_LEAST = 2, LEAD_SHARE = .5, LEAD_LEAST = 3;
// A place and an organization are one kind here: a hospital's name is read as either, and both are where a thing happens.
const sameKind = kind => kind === 'organization' ? 'place' : kind || null;
/* The kind of a tag from the kinds its pages are read as ([{ title, kind }] per page read, kind null for none): the kind most
   share, when at least KIND_SHARE of them do and KIND_LEAST at least. And the lead word, from all the tag's titles: the first
   word at least LEAD_SHARE of them begin with, short (up to four letters, so "Dr." and "St" but not a name), when LEAD_LEAST
   pages have it. */
function kindOfTitles(read, titles = read.map(r => r.title)) {
  const count = new Map();
  let n = 0;
  for (const { kind: read1 } of read) { const kind = sameKind(read1); n++; if (kind) count.set(kind, (count.get(kind) || 0) + 1); }
  const [best] = [...count].sort((a, b) => b[1] - a[1]);
  const kind = best && best[1] >= KIND_LEAST && best[1] / n >= KIND_SHARE ? best[0] : null;
  const leads = new Map();
  for (const title of titles) { const m = /^(\S{1,4})\s+\S/u.exec(String(title || '')); if (m) leads.set(m[1].toLowerCase(), (leads.get(m[1].toLowerCase()) || 0) + 1); }
  const [top] = [...leads].sort((a, b) => b[1] - a[1]);
  const lead = top && top[1] >= LEAD_LEAST && top[1] / titles.length >= LEAD_SHARE ? top[0] : null;
  return { kind, lead };
}

// Whether the graph already has a page the found name points at: a page by that name, or one the rules read it as (a whole
// name or a telling word of one, names.js), among any pages.
function knownPage(ctx, text) {
  const lower = text.toLowerCase().trim();
  if (ctx.byKey.has(lower)) return true;
  const words = wordsOf(text), any = { has: () => true };
  return !!names.namedIn(words, any, ctx, new Set()) || names.allNamedIn(words, any, ctx, new Set()).length > 0;
}
// The found name as it will be the page's title. Apple's finder joins a verb at the front of a line to the name ("Saw Dr.
// Okafor"), so the front is trimmed by the graph: the tag's lead word inside the name ("Dr.") starts it; else a first word the
// graph's own lines use as a word (in USED_LINES lines or more) and no page's name holds is dropped ("Saw", "Rang"). Then the
// tag's lead word goes in front when the words have it there ("Dr." before "Okafor").
const USED_LINES = 3;
function titled(ctx, text, found, lead) {
  let name = String(found.text || '').trim(), at = found.at;
  const words = name.split(/\s+/u);
  const leadAt = lead ? words.findIndex((w, i) => i > 0 && w.toLowerCase() === lead) : -1;
  if (leadAt > 0) { const cut = words.slice(0, leadAt).join(' ').length + 1; at += cut; name = name.slice(cut); }
  else {
    const { byWord, whole } = names.namesFor(ctx), stem = engine.stemmer(ctx.limits);
    for (;;) {
      const m = /^(\S+)\s+(\S.*)$/u.exec(name), first = m && wordsOf(m[1])[0];
      if (!first || byWord.has(first) || whole.has(first) || (ctx.index?.postings.get(stem(first))?.length || 0) < USED_LINES) break;
      at += name.length - m[2].length; name = m[2];
    }
  }
  const before = text.slice(0, at);
  const m = lead && /(\S{1,4})\s+$/u.exec(before);
  return m && m[1].toLowerCase() === lead ? `${m[1]} ${name}` : name;
}

function pieces(ctx, b, result, found, kinds) {
  if (!found?.length || !result || !kinds?.size) return [];
  if (result.record !== b && !result.assume) return [];
  const text = String(b.text || '');
  const tags = [...new Set([...b.tags, ...proposeLib.inWords(text, ctx).tags, ...(result.assume ? [result.assume.id] : [])])];
  // A property guessed from look-alike bullets alone is open too: a doctor named in the words is stronger than the usual doctor
  // (core/model.js, merge, puts the new page in that guess's place).
  const done = new Set(result.pieces.filter(p => !(p.kind === 'node' && p.guess && p.how === 'alike')).map(p => p.ident)), quiet = new Set(result.quiet || []);
  const open = fieldsOfTags(tags, ctx.schema).filter(prop => isLinkProp(prop) && !isChoiceProp(prop) && !isBuiltInProp(prop) && !wide(prop, ctx.schema)
    && !done.has(prop.ident) && !quiet.has(prop.ident) && !(b.values?.get(prop.ident) || []).length);
  if (!open.length) return [];
  const fresh = found.filter(f => f.text && !knownPage(ctx, f.text)).map(f => ({ ...f, kind: sameKind(f.kind) }));
  const out = [];
  for (const prop of open) {
    // The one tag of the property's range whose pages are of a found name's kind.
    const takes = prop.classes.map(c => ({ tag: c, kind: kinds.get(c.id)?.kind, lead: kinds.get(c.id)?.lead })).filter(x => x.kind);
    const fitting = fresh.map(f => ({ f, by: takes.filter(x => x.kind === f.kind) })).filter(x => x.by.length === 1);
    if (!fitting.length) continue;
    if (!prop.many && fitting.length !== 1) continue;   // two new people for one place: the words cannot say which
    const first = fitting[0], { tag, lead } = first.by[0];
    const title = titled(ctx, text, first.f, lead);
    if (ctx.byKey.has(title.toLowerCase())) continue;
    const tagPage = ctx.byId.get(tag.id);
    if (!tagPage?.uuid) continue;
    out.push({ ident: prop.ident, prop, kind: 'node', ids: [], shown: title, how: 'names', guess: true, newPage: { title, tag: { id: tag.id, uuid: tagPage.uuid, title: tagPage.title } }, note: `a new #${tagPage.title}` });
    fresh.splice(fresh.indexOf(first.f), 1);   // one name, one place
  }
  return out;
}

const api = { sameKind, kindOfTitles, knownPage, titled, pieces };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).people = api;
})();
