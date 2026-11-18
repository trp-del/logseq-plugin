/* The tag of an untagged bullet, sure or silent, with the reason in words. Pure: no Logseq, no screen.

   Three ways meet here, each measured on the Illness Test Graph's own tagged bullets (tools/tag-score, 16 November 2026):
   1. the nearest earlier lines vote (core/engine.js): a near-twin is almost never wrong;
   2. word counting: each tag's word profile (core/profile.js, naive Bayes);
   3. context clues, counted per tag like words: whether the bullet is on a journal day, and the kind (tag) of each page its words
      link. Tried and left out, since they added wrong guesses: the bullet above's tag, the bullets before it under the same
      parent, the page itself, the page's tags.
   A guess from 2 + 3 shows when its tag leads the runner-up (plain lines included) by `tagGap` in log-odds, and the near lines
   do not name another tag (silent then: the words and the near lines disagree). On the measure this kept every right guess, cut
   the guess switching from one tag to another while words are added from 5 bullets to 1, and wrong ones on the way from 24 to 19.

   tagScore(ctx, b, text, tagId) -> { score 0..1, why, by }: how well a bullet fits one tag. tagRank(ctx, b, text, tagIds) ->
   the same for several, best first, `sure` on the first when it would be shown. guess(ctx, b, text) -> { id, why, by, lead } |
   null: what would be shown. b: { id, page: { id, day } | null }. why: a few words ("like 6 earlier lines", "words “mouth”,
   “stings”", "links a Doctor", "on a journal day"). */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const engine = need('engine'), profileLib = need('profile'), contextLib = need('context');
const PLAIN = profileLib.PLAIN;

/* ---- clues ---- */
const CLUE_ALPHA = .5;
// The clues of a line: journal:1 / journal:0 for the day it is on (when its page is known), link:<tag> for each tag of each page
// it links (link:none for a linked page with no tag of yours).
function cluesOf(ctx, { page = null, linkIds = [] } = {}) {
  const out = new Set();
  if (page != null) out.add('journal:' + (ctx.days?.has(page) ? 1 : 0));
  for (const id of linkIds) {
    const p = ctx.byId.get(id);
    if (!p || p.isTag) continue;
    const tags = (p.tags || []).map(t => t.id).filter(t => ctx.knownTags.has(t));
    if (!tags.length) out.add('link:none');
    for (const t of tags) out.add('link:' + t);
  }
  return [...out];
}
const linkIdsOf = entry => (entry.tokens || []).filter(t => t.startsWith('link:')).map(t => Number(t.slice(5)));
// Counted per tag over the graph's lines, built when first asked for (and again after a line is learned, as the profile is).
function cluesModel(ctx) {
  if (!ctx?.index) return null;
  if (ctx.clues) return ctx.clues;
  const profile = contextLib.profileOf(ctx), classes = new Set(profile.classes);
  const counts = new Map(), lines = new Map(), own = new Map();
  for (const e of ctx.index.entries) {
    if (ctx.byId.has(e.id)) continue;   // a page is not a line
    const c = (e.values?.get('block/tags') || [PLAIN])[0];
    if (!classes.has(c)) continue;
    const f = cluesOf(ctx, { page: e.page ?? null, linkIds: linkIdsOf(e) });
    own.set(e.id, { c, f });
    lines.set(c, (lines.get(c) || 0) + 1);
    for (const x of f) { if (!counts.has(x)) counts.set(x, new Map()); counts.get(x).set(c, (counts.get(x).get(c) || 0) + 1); }
  }
  return ctx.clues = { counts, lines, own, classes: profile.classes };
}
// What the clues add to each tag's log-probability; the line itself (skip) left out of the counts.
function clueScores(ctx, clues, skip) {
  const m = cluesModel(ctx), mine = skip != null ? m.own.get(skip) : null, add = new Map();
  for (const c of m.classes) {
    const n = (m.lines.get(c) || 0) - (mine?.c === c ? 1 : 0);
    let lp = 0;
    for (const x of clues) lp += Math.log(((m.counts.get(x)?.get(c) || 0) - (mine?.c === c && mine.f.includes(x) ? 1 : 0) + CLUE_ALPHA) / (n + 2 * CLUE_ALPHA));
    add.set(c, lp);
  }
  return add;
}

/* ---- the ways together ---- */
const known = (ctx, id) => { const p = ctx.byId.get(id); return p?.isTag && p.uuid && ctx.knownTags.has(p.id) ? p : null; };
function tokensFor(ctx, text) {
  return engine.tokensOf(contextLib.shownWords(text, ctx), [], [], ctx.limits);
}
function cluesFor(ctx, b, text) {
  return cluesOf(ctx, { page: b.page ? b.page.id : null, linkIds: contextLib.linkIdsIn(text, ctx) });
}
// Words and clues together: [[tag, logp], ...] best first, and each tag's words and clues kept for saying why.
// (Leaving the graph's common words out of the words was tried, 16 November 2026: fewer right and more wrong everywhere.)
function scored(ctx, b, text) {
  const tokens = tokensFor(ctx, text), profile = contextLib.profileOf(ctx);
  if (!profile || tokens.length < 2) return { list: [], tokens, clues: [] };
  const clues = ctx.limits.tagClues === false ? [] : cluesFor(ctx, b, text), add = clueScores(ctx, clues, b.id);
  const list = profileLib.profileScores(profile, tokens, { skip: b.id }).map(([c, lp]) => [c, lp + (add.get(c) || 0)]).sort((x, y) => y[1] - x[1]);
  return { list, tokens, clues, profile, words: [...contextLib.shownWords(String(text).replace(/#?\[\[[^\]]*\]\]/g, ' '), ctx)] };   // a linked page's name is said by its kind, not its words
}
function nearOf(ctx, b, tokens) {
  return engine.neighbours(ctx.index, tokens, { k: ctx.limits.k, skip: new Set([b.id]), keep: e => e.values.get('block/tags')?.length > 0 });
}
// The near lines' tag when they lean to one (a looser vote than the one that shows a tag by itself), or null.
function nearLean(ctx, near) {
  const v = engine.vote(near, 'block/tags', { nearLeast: ctx.limits.tagLeanNear ?? .2, lead: ctx.limits.tagLeanLead ?? .6, least: 1 });
  return v && v.ids.length === 1 ? v.ids[0] : null;
}

// Why, in a few words: the words that lean most to the tag over the runner-up, or the clue that does.
function whyOf(ctx, s, tag, over) {
  const p = s.profile, alpha = p.alpha, V = p.vocab;
  const rate = (c, t) => ((p.counts.get(c)?.get(t) || 0) + alpha) / ((p.total.get(c) || 0) + alpha * V);
  // The words as written (not their stems), leaving out the graph's common words and short ones ("and", "she").
  const seen = new Set(), words = [];
  for (const word of s.words) {
    const t = engine.tokensOf(word, [], [], ctx.limits)[0];
    if (!t || seen.has(t) || word.length < 4 || ctx.common?.has(word) || (p.counts.get(tag)?.get(t) || 0) < 2) continue;
    seen.add(t);
    const w = Math.log(rate(tag, t) / rate(over ?? PLAIN, t));
    if (w > .7) words.push([word, w]);
  }
  words.sort((a, b) => b[1] - a[1]).splice(2);
  const linkClue = s.clues.find(x => x === 'link:' + tag) ? null : s.clues.find(x => x.startsWith('link:') && x !== 'link:none');
  const linkTitle = linkClue && ctx.byId.get(Number(linkClue.slice(5)))?.title;
  if (words.length) return `${words.length === 1 ? "word" : "words"} ${words.map(([t]) => `“${t}”`).join(', ')}` + (linkTitle ? `, links a ${linkTitle}` : '');
  if (linkTitle) return `links a ${linkTitle}`;
  return 'words like its lines';
}

// A line's words in their base forms (engine.lemma), each once, in order: two lines with the same key are twins.
// Sums and other numbers are left out of the key: "Gas $64.28" and "Gas 58.30" are written like "Gas" (17 November 2026, the owner:
// "sums will often be in nodes").
const SUM_WORDS = new Set(['k', 'dollar', 'dollars', 'buck', 'bucks', 'euro', 'euros', 'pound', 'pounds', 'usd', 'eur', 'gbp', 'cad', 'aud', 'chf']);
const twinKey = (ctx, text) => [...new Set(engine.tokensOf(new Set([...contextLib.shownWords(text, ctx)].filter(w => !/\d/.test(w) && !SUM_WORDS.has(String(w).toLowerCase()))), [], [], { ...ctx.limits, lemma: true }))].sort().join(' ');
// The graph's lines by key, built when first asked for and again after a line is learned (context.learnEntry), as the profile is.
function twinsOf(ctx) {
  if (ctx.twins) return ctx.twins;
  const by = new Map();
  for (const e of ctx.index.entries) {
    if (!e || ctx.byId.has(e.id) || !e.title) continue;   // a page is not a line
    const key = twinKey(ctx, e.title);
    if (!key) continue;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(e);
  }
  return ctx.twins = by;
}
/* The word that names the thing: the main noun of the words ("case" in "Phone case", "bill" in "Gas bill", "latte" in "oat latte
   before work"), by the grammar library, in its base form; a line of one or two words with no noun found, its last word. Asides in
   brackets and links' brackets left out. null when the library is missing or nothing is found. Kept per text. */
const heads = new Map();
function headOf(ctx, text) {
  const plain = String(text || '').replace(/\[\[([^\]]*)\]\]/g, '$1').replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  if (heads.has(plain)) return heads.get(plain);
  const nlp = engine.nlpOf(), stem = engine.lemma;
  let head = null;
  if (nlp && plain) {
    try { const nouns = nlp(plain).nouns().out('array'); if (nouns.length) head = String(nouns[0]).toLowerCase().split(/\s+/).pop(); } catch (error) { head = null; }
    const words = plain.toLowerCase().split(/\s+/).filter(Boolean);
    if (!head && words.length <= 2) head = words[words.length - 1];
    head = head && /^\p{L}+$/u.test(head) ? stem(head) : null;
  }
  if (heads.size > 5000) heads.clear();
  heads.set(plain, head);
  return head;
}
/* 0. The same words as before: earlier lines whose words are just these words, in their base forms ("Coffee", "coffee",
   "Paid the bills" and "paid the bill" are one), a line's own links read as their names. Short notes written again and again
   ("Coffee", "Gas", "Weekly shop") say nothing to the word counting and fall under the four-word wait, yet are the surest of all.
   Failing those, near twins: earlier lines close in words (`twinNear`, .5) that name the same thing (headOf), so "car insurance"
   meets "Car insurance paid" and "Phone case" does not meet "Phone".
   Speaks at any length when one tag of yours holds `twinLead` (.8) of the tagged twins: one same-words twin is enough
   (`twinLeast` 1), near twins need two (`twinNearLeast` 2).
   Untagged twins count against it only when they outnumber the tagged ones (`twinPlain` 1): the same words written without a tag
   are mostly a tag forgotten, which is what this is for (on the messy Personal Finance graph two in five repeats of "Gas" had none).
   -> { id, n, why } | null. */
function twinOf(ctx, b, text) {
  if (!ctx?.index || ctx.limits.twinLeast === 0) return null;
  const tokens = tokensFor(ctx, text), key = twinKey(ctx, text);
  if (!key) return null;
  const count = (lines, least) => {
    const tally = new Map();
    let n = 0, plain = 0;
    for (const e of lines) {
      const c = (e.values.get('block/tags') || [PLAIN])[0];
      if (c === PLAIN || !known(ctx, c)) { plain++; continue; }
      tally.set(c, (tally.get(c) || 0) + 1); n++;
    }
    if (!n || n < least || plain > n * (ctx.limits.twinPlain ?? 1)) return null;
    const [best, most] = [...tally].sort((x, y) => y[1] - x[1])[0];
    return most / n >= (ctx.limits.twinLead ?? .8) ? { id: best, n: most } : null;
  };
  const same = (twinsOf(ctx).get(key) || []).filter(e => e.id !== b.id);
  const exact = count(same, ctx.limits.twinLeast ?? 1);
  if (exact) return { ...exact, why: exact.n === 1 ? 'written like this once before' : `written like this ${exact.n} times before` };
  const least = ctx.limits.twinNear ?? .5, head = least < 1 ? headOf(ctx, text) : null;
  if (!head) return null;
  const near = engine.neighbours(ctx.index, tokens, { k: 12, skip: new Set([b.id]), keep: e => !ctx.byId.has(e.id) })
    .filter(x => x.sim >= least && headOf(ctx, x.entry.title) === head).map(x => x.entry);
  const close = count(near, ctx.limits.twinNearLeast ?? 2);
  return close ? { ...close, why: `like ${close.n} earlier line${close.n === 1 ? '' : 's'}` } : null;
}

function guess(ctx, b, text) {
  if (!ctx?.index) return null;
  const twin = twinOf(ctx, b, text);
  if (twin) return { id: twin.id, by: 'twin', lead: Infinity, why: twin.why, near: nearOf(ctx, b, tokensFor(ctx, text)) };
  const tokens = tokensFor(ctx, text);
  if (tokens.length < 2) return null;
  const near = nearOf(ctx, b, tokens);
  // 1. A near-twin among earlier lines.
  const voted = engine.vote(near, 'block/tags', { nearLeast: ctx.limits.tagNearLeast, lead: ctx.limits.tagLead, least: ctx.limits.tagLeast });
  if (voted && voted.ids.length === 1 && voted.ids[0] !== 0 && known(ctx, voted.ids[0])) {
    const n = near.filter(x => (x.entry.values.get('block/tags') || [])[0] === voted.ids[0]).length;
    return { id: voted.ids[0], by: 'vote', lead: Infinity, why: `like ${n} earlier line${n === 1 ? '' : 's'}`, near };
  }
  // 2 + 3. Words and clues, unless the near lines lean to another tag.
  if (!(ctx.limits.tagGap > 0)) return null;
  const s = scored(ctx, b, text), [best, next] = s.list;
  if (!best || best[0] === PLAIN || !isFinite(best[1]) || !known(ctx, best[0])) return null;
  const lead = best[1] - (next ? next[1] : -Infinity);
  if (lead < ctx.limits.tagGap) return null;
  const lean = nearLean(ctx, near);
  if (ctx.limits.tagLeanSilent !== false && lean != null && lean !== PLAIN && lean !== best[0]) return null;
  return { id: best[0], by: 'profile', lead, why: whyOf(ctx, s, best[0], next?.[0]), near };
}

// How well a bullet fits each of several tags (the split sorting, Option-T): 0..1 against the best of the others, best first.
function tagRank(ctx, b, text, tagIds) {
  const s = scored(ctx, b, text);
  if (!s.list.length) return [];
  const by = new Map(s.list), ids = tagIds.filter(id => by.has(id));
  const ranked = ids.map(id => {
    const others = s.list.filter(([c]) => c !== id && (ids.includes(c) || tagIds.length === 0)).map(([, lp]) => lp);
    const rival = others.length ? Math.max(...others) : -Infinity;
    const lead = by.get(id) - rival;
    return { id, lead, score: isFinite(lead) ? 1 / (1 + Math.exp(-lead)) : 1, by: 'profile', why: whyOf(ctx, s, id, null) };
  }).sort((x, y) => y.lead - x.lead);
  if (ranked[0]) ranked[0].sure = ranked[0].lead >= (ctx.limits.tagGap || 3);
  return ranked;
}
const tagScore = (ctx, b, text, tagId) => tagRank(ctx, b, text, [tagId, ...(contextLib.profileOf(ctx)?.classes || []).filter(c => c !== tagId)]).find(r => r.id === tagId) || null;

/* Steady, with a higher bar to appear than to stay. A tag first shows when it leads by tagGap (5 as set "balanced"); once shown it
   stays while the words go on as long as it still leads the runner-up, plain lines included, by tagHold (4); another tag replaces
   it only when it would be shown at two pauses running. Measured 16 November 2026 on 8,900 tagged bullets and 2,100 plain ones
   (made-up graphs of 6,000 and 20,000 notes asked in other sentences, Scale Check, the Illness Test Graph), against the version
   before (gap 3, nothing held): right 4,085 → 3,780, wrong 218 → 156, the shown tag switching to another 362 → 97, vanishing again
   787 → 437, plain notes left with a tag 80 → 25. Holding more loosely (tagHold 0 to 3) kept more tags on screen but left a tag on
   up to 69 of 750 plain notes; keeping the tag whatever the words said did so too. state: { shown, pending, n } kept per bullet;
   leadOf(id): how far the words lean to that tag now. */
function steady(state, next, leadOf = null, hold = 4) {
  if (!state.shown) { state.shown = next || null; return state.shown; }
  if (!next) {
    if (leadOf && !(leadOf(state.shown.id) >= hold)) { state.shown = null; state.pending = null; state.n = 0; }
    return state.shown;
  }
  if (next.id === state.shown.id) { state.pending = null; state.n = 0; return state.shown = next; }
  if (state.pending === next.id) state.n++; else { state.pending = next.id; state.n = 1; }
  if (state.n >= 2) { state.pending = null; state.n = 0; return state.shown = next; }
  return state.shown;
}
// How far the words (and clues) lean to one tag now: its score less the best other's, plain lines included.
function leadOf(ctx, b, text, tagId) {
  const list = scored(ctx, b, text).list, mine = list.find(([c]) => c === tagId), rival = list.find(([c]) => c !== tagId);
  return mine && rival ? mine[1] - rival[1] : -Infinity;
}

const api = { guess, twinOf, tagRank, tagScore, steady, leadOf, cluesOf, cluesModel, clueScores, scored };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).tagScore = api;
})();
