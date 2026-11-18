/* Date words you taught: which date you put a day in, by the words right before it (18 November 2026, the owner: "how can you
   develop something robust", then "yes 1 and 2"). The word lists in core/dates.js know "due", "starts", "until"; they will never
   know every wording ("cutoff Dec 4", "last day Dec 12", "visit Dec 4"). So every node where you filled a date by hand teaches:
   the words before a day in its words ("cutoff") went to the date that holds that day (Due date). A day in the words you put in
   no date counts against those words ("Gutter cleaning Nov 24, invoice due Nov 30" with only Nov 30 filled: "cleaning" names no
   date), where every day you filled was read in the words. Moving a pencilled day to
   another date teaches the same way, once the node is written.

   Pure: reads the context's entries (each with dates: Map(ident -> [journal page ids]), read by logseq/db.js) and ctx.days.
   cuesOf(ctx) -> Map(key -> Map(ident or 'none' -> { n, ahead, gone })), built when first asked and again after a node is learned.
   learnedDays(ctx, dates, text, base, { least, claimed, kindOf }) -> [{ prop, day, n }]: for each part of the words with one day
   not claimed, the date its words were put in before. The nearer words decide: the last two ("last day") where taught, else
   the last one ("cutoff"). A date leads with LEAD of the votes taught for a day the same way, ahead or gone by: "visit Dec 4"
   taught as Scheduled does not make "visited Nov 9" scheduled, and "visited Nov 9" taught as Completed stays apart from it. Where the bullet's tag has no
   such property, a property of the same kind (kindOf: deadline, start…) takes it. Words are matched in their base forms
   (engine.lemma: "commenced" teaches "commences"). */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const engine = need('engine');

const LEAD = .8;
const keyOf = words => words.split(' ').map(w => engine.lemma(w) || w).join(' ');
const wayOf = (day, base) => !base ? null : day > base ? 'ahead' : day < base ? 'gone' : null;

function cuesOf(ctx) {
  if (ctx.dateCues) return ctx.dateCues;
  const cues = new Map(), reader = ctx.reader;
  const add = (key, ident, way) => {
    let votes = cues.get(key);
    if (!votes) cues.set(key, votes = new Map());
    const v = votes.get(ident) || { n: 0, ahead: 0, gone: 0 };
    v.n++; if (way) v[way]++;
    votes.set(ident, v);
  };
  for (const e of ctx.index?.entries || []) {
    if (!e.dates?.size || !e.title) continue;
    const filled = new Map();
    for (const [ident, ids] of e.dates) for (const id of ids) { const d = ctx.days.get(id); if (d) filled.set(d, ident); }
    if (!filled.size) continue;
    const pageDay = ctx.days.get(e.page) || 0, base = pageDay || [...filled.keys()][0];
    // A day you left out counts against its words only when every day you filled was read in the words: a day read otherwise
    // than you meant it ("early January" read as the 1st, filled as the 5th) teaches nothing.
    const read = reader.dayWords(e.title, base), allFound = [...filled.keys()].every(d => read.some(r => r.day === d));
    for (const { day, words } of read) {
      const ident = filled.get(day) || (allFound ? 'none' : null), way = wayOf(day, pageDay);
      if (ident) for (const w of words) add(keyOf(w), ident, way);
    }
  }
  return ctx.dateCues = cues;
}

function learnedDays(ctx, dates, text, base, { least = 1, claimed = new Set(), kindOf = () => null } = {}) {
  const cues = cuesOf(ctx), out = [];
  if (!cues.size || !dates.length || !ctx.reader.dayWords) return out;
  const byIdent = new Map((ctx.schema?.props || []).map(p => [p.ident, p]));
  for (const { day, words } of ctx.reader.dayWords(text, base)) {
    if (claimed.has(day)) continue;
    for (const w of words) {
      const votes = cues.get(keyOf(w));
      if (!votes) continue;   // not taught: the shorter words may be
      // Only the votes taught for a day the same way (ahead, gone by) or for a day of no known way: "visit Dec 4" (Scheduled)
      // and "visited Nov 9" (Completed) share a base form and stay apart.
      const way = wayOf(day, base), count = v => way ? v[way] + v.n - v.ahead - v.gone : v.n;
      let total = 0;
      for (const v of votes.values()) total += count(v);
      const [ident, v] = [...votes].sort((a, b) => count(b[1]) - count(a[1]))[0];
      if (ident !== 'none' && count(v) >= least && count(v) / total >= LEAD) {
        const taught = byIdent.get(ident), kind = taught && kindOf(taught);
        const same = dates.filter(p => p.ident === ident);
        const ofKind = kind ? dates.filter(p => kindOf(p) === kind) : [];
        const prop = same[0] || (ofKind.length === 1 ? ofKind[0] : null);
        if (prop) out.push({ prop, day, n: v.n });
      }
      break;   // the nearer words were taught: they decide
    }
  }
  return out;
}

const api = { cuesOf, learnedDays, LEAD };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).dateWords = api;
})();
