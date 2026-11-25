/* The ways of guessing a tag that score-tags.js compares. Each: { name, guess(ctx, line, text) -> { id } | null }.
   "today" is the plugin's own tagFor (core/propose.js): the vote, then the word profiles. The others are its parts alone, and
   the ideas being tried, each added here as it is built. */
const path = require('node:path');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const engine = core('engine'), profileLib = core('profile'), propose = core('propose'), context = core('context');

const known = (ctx, id) => { const p = ctx.byId.get(id); return p?.isTag && ctx.knownTags.has(id) ? p : null; };
const tokensOf = (ctx, text) => engine.tokensOf(context.shownWords(text, ctx), [], [], ctx.limits);

// Way 2: the nearest earlier lines vote.
function vote(ctx, line, text) {
  if (!propose.enoughForTag(ctx, text)) return null;
  const tokens = tokensOf(ctx, text);
  if (tokens.length < 2) return null;
  const near = engine.neighbours(ctx.index, tokens, { k: ctx.limits.k, skip: new Set([line.id]), keep: e => e.values.get('block/tags')?.length > 0 });
  const v = engine.vote(near, 'block/tags', { nearLeast: ctx.limits.tagNearLeast, lead: ctx.limits.tagLead, least: ctx.limits.tagLeast });
  return v && v.ids.length === 1 && v.ids[0] !== 0 && known(ctx, v.ids[0]) ? { id: v.ids[0] } : null;
}
// Way 1: word counting (naive Bayes word profiles).
function profile(ctx, line, text, gap) {
  if (!propose.enoughForTag(ctx, text)) return null;
  const tokens = tokensOf(ctx, text);
  if (tokens.length < 2) return null;
  const s = profileLib.profileTag(context.profileOf(ctx), tokens, typeof gap === 'number' ? gap : ctx.limits.tagGap, { skip: line.id });
  return s && known(ctx, s.id) ? { id: s.id } : null;
}
// Today: the plugin's own.
function today(ctx, line, text) {
  const t = propose.tagFor(ctx, { id: line.id, page: line.page != null ? { id: line.page } : null }, text);
  return t ? { id: t.id } : null;
}

// "today" with the word profiles replaced by words + clues: the vote first, as today.
const withVote = inner => (ctx, line, text) => vote(ctx, line, text) || inner(ctx, line, text);
const CLUES = (process.env.CLUES || 'parent,sibling,page,pagetag,journal,link').split(',');
function all(ctx) {
  const clues = require('./clues.js');
  const list = [
    { name: 'nearest lines (2)', guess: vote },
    { name: 'word counting (1)', guess: profile },
    { name: 'before (1+2)', guess: (c, l, t) => vote(c, l, t) || profile(c, l, t, 3) },   // as released: gap 3
    { name: 'now: tagFor (1+2+3)', guess: today },
  ];
  if (process.env.JOIN) {
    // Idea 5: join the ways. A loose vote (any near line, a modest lead) is a second opinion beside words + clues.
    const kept = new Set(['journal', 'link']), model = clues.build(ctx, kept);
    const scoreOf = clues.way(model, { gap: -Infinity });   // words + clues, always its best and its lead
    const loose = (c, l, t, nearLeast, lead) => {
      if (!propose.enoughForTag(c, t)) return null;
      const tokens = tokensOf(c, t); if (tokens.length < 2) return null;
      const near = engine.neighbours(c.index, tokens, { k: c.limits.k, skip: new Set([l.id]), keep: e => e.values.get('block/tags')?.length > 0 });
      const v = engine.vote(near, 'block/tags', { nearLeast, lead, least: 1 });
      return v && v.ids.length === 1 ? { id: v.ids[0] } : null;   // 0 = "plain" counts as an opinion too
    };
    const join = ({ agreeGap, aloneGap, nearLeast = .2, lead = .6 }) => (c, l, t) => {
      const strict = vote(c, l, t); if (strict) return strict;
      const w = scoreOf(c, l, t); if (!w) return null;
      const o = loose(c, l, t, nearLeast, lead);
      if (o && o.id === w.id) return w.lead >= agreeGap ? w : null;
      if (o && o.id !== w.id && !(process.env.JOIN_TAGS_ONLY && o.id === 0)) return null;   // the near lines say otherwise: silent
      return w.lead >= aloneGap ? w : null;
    };
    const out = [{ name: 'kept', guess: withVote(clues.way(model, { gap: 3 })) }];
    if (process.env.STEADY) {
      // Idea 6: once shown, the guess holds. A different tag replaces it only when it is shown at `twice` pauses running;
      // with keep, a pause where nothing would show keeps the shown guess.
      const base = join({ agreeGap: 3, aloneGap: 3 });
      const steady = ({ twice, keep }) => { const st = new Map(); return (c, l, t, o) => {
        if (o.at === 1) st.set(l.id, { shown: null, pending: null, n: 0 });
        const s = st.get(l.id), g = base(c, l, t);
        if (!s.shown) { s.shown = g; return g; }
        if (!g) return keep ? s.shown : (s.shown = null);
        if (g.id === s.shown.id) { s.pending = null; s.n = 0; return s.shown = g; }
        if (s.pending === g.id) s.n++; else { s.pending = g.id; s.n = 1; }
        if (s.n >= twice) { s.pending = null; s.n = 0; return s.shown = g; }
        return s.shown;
      }; };
      out.push({ name: 'joined (silent if near lines differ)', guess: base });
      for (const spec of process.env.STEADY.split(';')) { const [tw, kp] = spec.split(',').map(Number); out.push({ name: `steady twice ${tw}${kp ? ' keep' : ''}`, guess: steady({ twice: tw, keep: !!kp }) }); }
      return out;
    }
    for (const spec of process.env.JOIN.split(';')) { const [a, b, n, ld] = spec.split(',').map(Number); out.push({ name: `join ${spec}`, guess: join({ agreeGap: a, aloneGap: b, nearLeast: n || .2, lead: ld || .6 }) }); }
    return out;
  }
  if (process.env.CORRECT) {
    // First pass: the kept way (journal + link clues, gap 3); its wrong lines are the corrections.
    const kept = new Set(['journal', 'link']), model = clues.build(ctx, kept), first = withVote(clues.way(model, { gap: 3 }));
    const steps = t => { const p = String(t).match(/#?\[\[[^\]]*\]\]\S*|\S+/g) || []; return p.map((_, i) => p.slice(0, i + 1).join(' ')); };
    const wrongIds = ctx.graph.lines.filter(l => l.tags.length).filter(l => steps(l.title).some(t => { const g = first(ctx, l, t); return g && !l.tags.includes(g.id); })).map(l => l.id);
    console.error('corrections:', wrongIds.length);
    const out = [{ name: 'kept (no corrections)', guess: first }];
    const corr = require('./corrections.js');
    for (const w of process.env.CORRECT.split(',').map(Number)) {
      const weights = new Map(wrongIds.map(id => [id, w])), p = corr.weightedProfile(ctx, weights);
      const m = { ...model };
      // clue counts weighted the same way
      m.counts = new Map(); m.lines = new Map(); m.own = new Map();
      for (const l of ctx.graph.lines) { const o = model.own.get(l.id); if (!o) continue; const ww = weights.get(l.id) || 1; m.own.set(l.id, { ...o, w: ww }); m.lines.set(o.c, (m.lines.get(o.c) || 0) + ww); for (const x of o.f) { if (!m.counts.has(x)) m.counts.set(x, new Map()); m.counts.get(x).set(o.c, (m.counts.get(x).get(o.c) || 0) + ww); } }
      out.push({ name: `corrections x${w}`, guess: withVote(clues.way(m, { gap: 3, words: (t, id) => corr.scores(p, t, id) })) });
    }
    return out;
  }
  if (process.env.SWEEP) {
    const sets = { 'words': null, ...Object.fromEntries((process.env.SWEEP_SETS || 'all').split(';').map(x => [x, new Set(x === 'all' ? CLUES : x.split(','))])) };
    const models = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v && clues.build(ctx, v)]));
    const out = [];
    for (const gap of (process.env.SWEEP).split(',').map(Number)) for (const [k, m] of Object.entries(models))
      out.push({ name: `${k} gap ${gap}`, guess: m ? withVote(clues.way(m, { gap })) : withVote((c, l, t) => profile(c, l, t, gap)) });
    return out;
  }
  for (const k of CLUES) list.push({ name: `+ ${k}`, guess: withVote(clues.way(clues.build(ctx, new Set([k])))) });
  list.push({ name: '+ all clues', guess: withVote(clues.way(clues.build(ctx, new Set(CLUES)))) });
  return list;
}
module.exports = { all, vote, profile, today, tokensOf, known };
