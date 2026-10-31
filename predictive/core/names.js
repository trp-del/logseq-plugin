/* Plain names: a page named in the words without brackets ("at Northgate", "Dr. Patel"). Ported from
   logseq-db-refinements (parts/shadow-rules.js) with one change that makes it work in any graph and any language: the
   fixed list of English words that "name nothing" is replaced by ctx.common, the words this graph's own lines use too
   often to name anything (context.js). */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { wordsOf } = need('text');
const engine = need('engine');
const { fits } = need('schema');

const telling = (word, ctx) => word.length >= 4 && !ctx.common.has(word) && !/^\d+$/.test(word);

// Every page by the names it goes by (its title and its aliases), for plain words: the telling words of each name and
// each whole name. Alias pages themselves are left out: they stand for their original.
function namesFor(ctx) {
  if (ctx.names) return ctx.names;
  const aliasOf = new Map((ctx.aliases || []).map(([original, alias]) => [alias, original]));
  const byWord = new Map(), whole = new Map();
  const add = (page, name) => {
    const words = wordsOf(name);
    if (!words.length || name.length < 3) return;
    if (!whole.has(words[0])) whole.set(words[0], []);
    whole.get(words[0]).push({ page, words });
    for (const word of new Set(words.filter(w => telling(w, ctx)))) { if (!byWord.has(word)) byWord.set(word, new Set()); byWord.get(word).add(page); }
  };
  for (const page of ctx.pages) if (!page.isTag && !aliasOf.has(page.id)) add(page, page.title);
  for (const [alias, original] of aliasOf) { const page = ctx.byId.get(original), name = ctx.byId.get(alias)?.title; if (page && name) add(page, name); }
  return (ctx.names = { byWord, whole, aliasIds: new Set(aliasOf.keys()) });
}

/* A page named only by a word of its title must have earned that word: when earlier lines hold the word, most of them
   must be about that page (linking it, or holding it as a value). One word shared by chance would otherwise name a page
   wrongly again and again (the stress test: 1,381 wrong in 1,388). */
const EARNED_LINES = 1, EARNED_SHARE = .5;
function wordsEarned(words, page, ctx) {
  const index = ctx.index;
  if (!index) return true;
  const link = 'link:' + page.id, stem = engine.stemmer(ctx.limits);
  for (const word of words) {
    const lines = index.postings.get(stem(word)) || [];
    if (lines.length < EARNED_LINES) continue;
    let about = 0;
    for (const i of lines) { const e = index.entries[i]; if (e.id === page.id || e.tokens.includes(link) || [...e.values.values()].some(ids => ids.includes(page.id))) about++; }
    if (about / lines.length < EARNED_SHARE) return false;
  }
  return true;
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
  if (top < 10 && !wordsEarned(by.get(best) || [], best, ctx)) return null;
  return best;
}

// Every page of the property's tags the words name by a whole name or alias, in the order written, for a property that
// holds several ("Spoke with Dr. Mei Chen and Ruth Okoro" names two people). A name inside a longer one ("Northgate" in
// "Northgate Cancer Center") counts only as the longer.
function allNamedIn(words, classIds, ctx, spoken) {
  const { whole } = namesFor(ctx), spans = [];
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w) && !spoken.has(page) && fits(page, classIds, ctx.schema)) spans.push({ page, from: i, to: i + name.length }); });
  const kept = spans.filter(a => !spans.some(b => b !== a && b.from <= a.from && b.to >= a.to && b.to - b.from > a.to - a.from));
  return [...new Set(kept.sort((a, b) => a.from - b.from).map(s => s.page))];
}

const api = { namesFor, namedIn, allNamedIn, wordsEarned, telling };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).names = api;
})();
