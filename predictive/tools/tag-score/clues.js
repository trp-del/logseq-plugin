/* Idea 3, context clues, tried outside the plugin first. Where a bullet stands says something about its tag: the tag of the
   bullet above it, the tags of the bullets before it under the same parent, the page it is on (and that page's tags), and the
   kind (tag) of each page its words link. Each clue is counted per tag over the graph's lines, like a word in the word profiles,
   and adds its log-likelihood to the profile's score for each tag (naive Bayes over words and clues together). The line asked
   about is left out of the counts (leave-one-out). kinds: which clues to use. */
const path = require('node:path');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const profileLib = core('profile'), context = core('context'), propose = core('propose');
const { UUID } = core('text');
const PLAIN = 0;

function cluesOf(g, line, kinds, pageTags) {
  const out = [];
  if (line.page == null) return out;   // a line with no place (the hand-written held-out lines): no clues
  const parent = g.byId.get(line.parent);
  if (kinds.has('parent')) out.push('parent:' + (parent ? parent.tags[0] ?? 'plain' : 'top'));
  if (kinds.has('sibling') && g.siblings) {
    const before = (g.siblings.get(line.parent) || []).filter(s => s.id !== line.id && s.order < line.order);
    for (const t of new Set(before.flatMap(s => s.tags.length ? s.tags : ['plain']))) out.push('sib:' + t);
  }
  if (kinds.has('page') && line.page != null) out.push('page:' + line.page);
  if (kinds.has('pagetag') && line.page != null) { const tags = pageTags.get(line.page) || []; if (!tags.length) out.push('pagetag:none'); for (const t of tags) out.push('pagetag:' + t); }
  if (kinds.has('journal') && line.page != null) out.push('journal:' + (g.journal.has(line.page) ? 1 : 0));
  if (kinds.has('link')) for (const [, key] of String(line.text ?? line.title).matchAll(/\[\[([^\]]+)\]\]/g)) {
    const page = UUID.test(key) ? g.byUuid.get(key.toLowerCase()) : g.byLower.get(key.toLowerCase());
    for (const t of page ? (pageTags.get(page.id) || ['none']) : []) out.push('link:' + t);
  }
  return [...new Set(out)];
}

function build(ctx, kinds, alpha = .5) {
  const g = ctx.graph, E = g.E;
  const tagIdents = new Map([...E.values()].filter(e => typeof e['db/ident'] === 'string').map(e => [e['db/id'], e['db/ident']]));
  const pageTags = new Map();
  for (const p of ctx.pages) pageTags.set(p.id, p.tags.filter(t => !String(t.ident || '').startsWith('logseq.class/')).map(t => t.id));
  g.journal = new Set([...E.values()].filter(e => e['block/journal-day'] !== undefined).map(e => e['db/id']));
  g.byUuid = new Map(ctx.pages.map(p => [p.uuid.toLowerCase(), p]));
  g.byLower = new Map(ctx.pages.map(p => [p.lower, p]));
  g.siblings = new Map();
  for (const l of g.lines) { if (!g.siblings.has(l.parent)) g.siblings.set(l.parent, []); g.siblings.get(l.parent).push(l); }
  const profile = context.profileOf(ctx), classes = new Set(profile.classes);
  const counts = new Map(), lines = new Map(), own = new Map();
  for (const l of g.lines) {
    const c = l.tags.length ? l.tags[0] : PLAIN;
    if (!classes.has(c)) continue;
    const f = cluesOf(g, l, kinds, pageTags);
    own.set(l.id, { c, f });
    lines.set(c, (lines.get(c) || 0) + 1);
    for (const x of f) { if (!counts.has(x)) counts.set(x, new Map()); counts.get(x).set(c, (counts.get(x).get(c) || 0) + 1); }
  }
  return { kinds, pageTags, counts, lines, own, alpha, profile };
}

// The log-likelihood the clues add for each tag: Bernoulli for each clue present, with smoothing; the line's own clues left out.
function clueScores(model, ctx, line) {
  const f = cluesOf(ctx.graph, line, model.kinds, model.pageTags), mine = model.own.get(line.id);
  const add = new Map();
  for (const c of model.profile.classes) {
    const n = (model.lines.get(c) || 0) - (mine?.c === c ? (mine.w || 1) : 0);
    let lp = 0;
    for (const x of f) {
      const k = (model.counts.get(x)?.get(c) || 0) - (mine?.c === c && mine.f.includes(x) ? (mine.w || 1) : 0);
      lp += Math.log((k + model.alpha) / (n + 2 * model.alpha));
    }
    add.set(c, lp);
  }
  return add;
}

// The way: word profile scores plus clue scores; a tag when it leads the runner-up (plain included) by the gap.
function way(model, { weight = 1, gap, words: wordsOf } = {}) {
  return (ctx, line, text) => {
    if (!propose.enoughForTag(ctx, text)) return null;
    const tokens = require('./ways.js').tokensOf(ctx, text);
    if (tokens.length < 2) return null;
    const words = wordsOf ? wordsOf(tokens, line.id) : profileLib.profileScores(model.profile, tokens, { skip: line.id });
    const add = clueScores(model, ctx, line);
    const scored = words.map(([c, lp]) => [c, lp + weight * (add.get(c) || 0)]).sort((a, b) => b[1] - a[1]);
    const [best, next] = scored;
    if (!best || best[0] === PLAIN || !isFinite(best[1])) return null;
    const lead = best[1] - (next ? next[1] : -Infinity);
    const g = gap ?? ctx.limits.tagGap;
    return lead >= g && ctx.knownTags.has(best[0]) ? { id: best[0], lead } : null;
  };
}
module.exports = { build, way, cluesOf, clueScores };
