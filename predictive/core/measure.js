/* Measuring Apple's model on the graph's own notes: the questions, and the judging of the answers. Pure; the asking is
   logseq/measure.js, on the Mac that has the model.

   A note of yours that holds values is asked about as if it held none, and each answer is set against what you wrote.
   It is asked from the note's words alone, as Predictive asks: every property in one question, each said in plain words
   from the graph's structure (model.describe), and which tag it is, each tag with the tags above it. 0.3.20 measured the
   alternatives on the owner's graph: one question per property answered exactly as one for all, and describing was a
   little righter, so Predictive describes. Per property the report says how often the right page was not among the
   choices (not offered) and how often the model named some of the right pages but not all (partly). Apart from the
   questions, it lists the properties whose values in the whole graph are pages the property does not take (outside
   its range): those the model can never offer, and Structure can fix. (The
   words around a note and earlier notes as examples, momentText and examplesText, are no longer asked: 0.3.17 to 0.3.19
   measured them making answers wronger and refusals more often. 0.3.15 measured the words around a note and the examples apart:
   neither made the answers righter, and both made Apple's filter refuse more often. 0.3.16 measured Apple's looser filter,
   which answered exactly as the model as it comes, and its tagging model, which was wrong more often; neither is asked
   now, and SETTINGS holds them should they be measured again.)

   On a graph made for measuring (one with a page titled "Predictive test graph", whose notes are about no one real), the
   report also lists each note's words with what was written and what the model said (details), to see why an answer
   goes wrong. On any other graph it never does.

   Each property asked is right (what you wrote), wrong (something else), or silent. A property you left empty that the
   model fills anyway is counted apart (spoke), since a wrong fill taken by habit is the one thing that must not happen.
   A page property is also marked by whether the page is named in the note's own words (named), and whether it was among
   the choices the model was given at all (offered).

   Since 12 November 2026 two ways are asked side by side. named: as Predictive asks now, a page property only when the note's
   words name a page it takes. range too: as it asked until then, a property whose page the words do not name offered the pages
   it can take. Both are counted over the same properties (one the named way does not ask is silent there), so the two columns
   can be set against each other. A choice (Status) is asked here and never while writing, so it is counted apart, outside the
   totals. Properties you left empty are counted too (left empty), with how many the model filled anyway. The share right
   comes with its 95% range (Wilson), since a few dozen notes cannot place it closer than that.

   The tag is asked three ways: all tags (as Predictive asks), near tags (only the few tags the notes nearest in meaning
   carry, where the matcher is on the Mac), and near tags with the list back to front. A model that reads the note gives the
   same tag both ways round; one that takes the first that fits does not, so the report says how often the two agreed and how
   often an agreed tag was right.

   Nothing here is shown to anyone but the person on that Mac: the report (text) holds numbers and the names of tags and
   properties, never a note's words. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const model = need('model');
const { fieldsOfTags, fits, isChoiceProp, isBuiltInProp, isLinkProp, isNumberProp, isDateProp } = need('schema');
const engine = need('engine');
const lessons = need('lessons');
const { shownWords } = need('context');

// Apple's settings, by the word the report gives each and the name the helper takes.
const SETTINGS = [['', 'default']];   // [' loose', 'permissive'], [' tagger', 'tagging'] measured in 0.3.16
const WAYS = ['named', 'range too'];   // as Predictive asks, and as it asked until 12 November 2026; 0.3.20 measured 'one by one', 'described' and 'both'
const TAG_WAYS = ['all tags', 'near tags', 'near, turned'];   // as Predictive asks it; among the tags of the nearest notes; those back to front
const NEAR_TAGS = 5;
const TEST_PAGE = 'predictive test graph';
const EXAMPLES = 3, LINE = 160;

// A small deterministic shuffle, so the same graph is measured on the same notes each time.
function seeded(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
/* The notes worth measuring: bullets (not pages) with a tag of yours and at least four words, in a fixed shuffled order.
   The reader keeps those that turn out to hold a value it can judge, until it has enough. */
function candidates(ctx, { seed = 11 } = {}) {
  const list = (ctx.index?.entries || []).filter(e => !ctx.byId.has(e.id) && (e.values.get('block/tags') || []).some(id => id > 0)
    && String(e.title).split(/\s+/).length >= 4);
  const rand = seeded(seed);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.map(e => e.id);
}

const clip = text => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > LINE ? t.slice(0, LINE - 1) + '…' : t; };

/* What the moment adds: the words around the note, as the person reads them. note.parent and note.before are raw titles. */
function momentText(ctx, note) {
  const lines = [];
  if (note.parent) lines.push(`It is written under: "${clip(model.shown(ctx, note.parent))}"`);
  if (note.before?.length) lines.push(`Just before it:\n${note.before.map(t => `- "${clip(model.shown(ctx, t))}"`).join('\n')}`);
  if (note.pageTitle) lines.push(`On the page: ${note.pageTitle}`);
  return lines.length ? `Around this note:\n${lines.join('\n')}` : '';
}

/* Up to three earlier notes of the same tag, nearest by words, with the values they hold under the properties asked. */
function examplesText(ctx, b, props) {
  if (!ctx.index || !props.length) return '';
  const tags = new Set(b.tags), idents = props.map(p => p.ident);
  const keep = e => e.id !== b.id && !ctx.byId.has(e.id) && (e.values.get('block/tags') || []).some(id => tags.has(id)) && idents.some(i => (e.values.get(i) || []).length);
  const tokens = engine.tokensOf(shownWords(b.text, ctx), [], [], ctx.limits);
  const near = engine.neighbours(ctx.index, tokens, { k: 40, skip: new Set([b.id]), keep }).map(n => n.entry).slice(0, EXAMPLES);
  if (!near.length) return '';
  const lines = near.map(e => {
    const values = props.map(p => [p, (e.values.get(p.ident) || []).map(id => ctx.byId.get(id)?.title).filter(Boolean)]).filter(([, v]) => v.length);
    return `- "${clip(model.shown(ctx, e.title))}" → ${values.map(([p, v]) => `${p.title}: ${v.join(', ')}`).join('; ')}`;
  });
  return `Earlier notes of this kind, with what was filled in:\n${lines.join('\n')}`;
}

/* The questions for one note. note: { b (the bullet, values as written), truth: Map(ident -> { kind, ids, number, day }),
   parent, before: [titles], pageTitle, day }. Returns { props: [{ way, req }], tags: [{ way, req }], asked: [{ key, prop,
   kind, named }] } with every request holding the same keys, so the four ways are judged on the same properties. */
function questions(ctx, note, { nearTags = null } = {}) {
  const { b, truth } = note;
  const hidden = { ...b, values: new Map(), parent: null };
  const base = model.request(ctx, hidden, { pieces: [], record: hidden, quiet: [] }, note.day, { range: true });
  const out = { props: [], tags: [], asked: [] };
  const around = momentText(ctx, note);
  const aroundRaw = [note.parent, ...(note.before || [])].filter(Boolean).join('\n');

  if (base) {
    // Choices (Status, a property with a list): never asked today; asked here so the report can say whether they could be.
    const fields = fieldsOfTags(b.tags, ctx.schema);
    for (const prop of fields.filter(p => isChoiceProp(p) && truth.has(p.ident))) {
      const key = 'c' + base.asked.size;
      base.asked.set(key, { prop, kind: 'choice', ids: new Map(prop.choices.map(c => [c.title.toLowerCase(), c.id])) });
      base.fill.properties.push({ key, title: prop.title, kind: 'choice', choices: prop.choices.map(c => c.title), about: `The ${prop.title} of this note, from the choices; none if the words do not say.` });
    }
    for (const [key, ask] of base.asked) {
      const own = model.momentPages(ctx, b.text, new Set(ask.prop.classes?.map(c => c.id) || []), new Set());
      const ids = truth.get(ask.prop.ident)?.ids || [];
      out.asked.push({ key, prop: ask.prop, kind: ask.kind, named: ask.kind === 'page' ? ids.length > 0 && ids.every(id => own.some(p => p.id === id)) : null });
    }
    const way = (name, context, instructions, widen, setting) => {
      const asked = new Map([...base.asked].map(([k, a]) => [k, { ...a, pages: a.pages ? new Map(a.pages) : a.pages }]));
      const fill = { ...base.fill, properties: base.fill.properties.map(p => ({ ...p, choices: p.choices && [...p.choices] })) };
      if (widen && aroundRaw) for (const p of fill.properties) {
        const ask = asked.get(p.key);
        if (ask.kind !== 'page') continue;
        for (const page of model.momentPages(ctx, aroundRaw, new Set(ask.prop.classes.map(c => c.id)), new Set())) {
          if (ask.pages.has(page.title.toLowerCase())) continue;
          ask.pages.set(page.title.toLowerCase(), page); p.choices.push(page.title);
        }
      }
      if (context) fill.context = context;
      if (instructions) fill.instructions = instructions;
      if (setting !== 'default') fill.model = setting;
      out.props.push({ way: name, req: { ...base, fill, asked } });
    };
    // named: the same question without the properties whose page the words do not name (their keys kept, so both ways are
    // judged property by property); no question at all when nothing is left.
    const kept = new Set([...base.asked].filter(([, a]) => a.how !== 'range').map(([k]) => k));
    if (kept.size) out.props.push({ way: 'named', req: { ...base, fill: { ...base.fill, properties: base.fill.properties.filter(p => kept.has(p.key)) }, asked: new Map([...base.asked].filter(([k]) => kept.has(k))) }, full: base });
    else out.props.push({ way: 'named', req: null, full: base });
    way('range too');
  }

  // The tag, asked of the note as if it had none.
  const bare = { ...b, tags: [], values: new Map(), parent: null };
  const tagReq = model.tagRequest(ctx, bare, note.day);
  if (tagReq) {
    out.tags.push({ way: 'all tags', req: tagReq });
    const only = (nearTags || []).slice(0, NEAR_TAGS);
    if (only.length > 1) for (const [way, turned] of [['near tags', false], ['near, turned', true]]) {
      const req = model.tagRequest(ctx, bare, note.day, { only, turned });
      if (req) out.tags.push({ way, req, listed: only.some(id => b.tags.includes(id)) });
    }
  }
  return out;
}

/* The tags the notes nearest in meaning carry, most voted first (each note votes with the square of its nearness, as
   core/meaning.js counts): the short list the model is asked to choose among. near: [{ entry, sim }]. */
function nearTags(ctx, near) {
  const sum = new Map();
  for (const { entry, sim } of near || []) for (const id of entry.values?.get('block/tags') || []) if (ctx.knownTags.has(id)) sum.set(id, (sum.get(id) || 0) + sim * sim);
  return [...sum].sort((x, y) => y[1] - x[1]).map(([id]) => id);
}
/* The properties a way did not ask that the fullest question did (full): silent where you wrote a value, quiet where you
   left it empty, so every way is counted over the same properties. */
function notAsked(note, full, req) {
  const out = [];
  for (const [key, ask] of full.asked) {
    if (req?.asked.has(key)) continue;
    const truth = note.truth.get(ask.prop.ident);
    out.push({ key, result: truth ? 'silent' : 'quiet', offered: true, unasked: true });
  }
  return out;
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

/* How long a question is, roughly, in the model's tokens (about four letters each): everything sent, the note, the words
   around it, the instructions and every choice. Apple's model on the Mac reads only a few thousand tokens at once. */
const size = fill => Math.round(JSON.stringify(fill || {}).length / 4);
/* Why a question failed, as a name only: the first word of what the helper or the browser said ("exceededContextWindowSize",
   "timed out"). Nothing after it, so no words of a note can come with it. */
function reason(error) {
  const said = String(error ?? '');
  if (/TimeoutError|timed out/i.test(said)) return 'timed out';
  if (/AbortError/.test(said)) return 'stopped';
  if (/Failed to fetch|NetworkError|TypeError/.test(said)) return 'helper not reached';
  return (said.match(/[A-Za-z][A-Za-z0-9_]*/) || ['unknown'])[0].slice(0, 40);
}

/* One answer, judged: [{ key, result, offered }] for the properties asked. result is 'right' | 'wrong' | 'silent' (no
   value, or one the plugin would not keep: a number the words do not hold, a day they do not name) | 'failed' (the
   model gave no answer at all: error is what was said) | 'spoke' (filled one you left empty) | 'quiet' (left it empty
   too). offered: for a page, whether the right page was among the choices; for a date, whether its day is named in the
   words, since only then can it be kept. */
function judge(ctx, note, req, reply, error = null) {
  const kept = reply ? new Map(model.pieces(ctx, req, reply).map(p => [p.ident, p])) : new Map();
  const out = [];
  for (const [key, ask] of req.asked) {
    const truth = note.truth.get(ask.prop.ident);
    const offered = !truth ? true : ask.kind === 'page' ? truth.ids.every(id => [...ask.pages.values()].some(p => p.id === id))
      : ask.kind === 'date' ? !!req.days?.has(truth.day) : true;
    if (!reply) { out.push({ key, result: truth ? 'failed' : 'quiet', offered }); continue; }
    let said = null;
    if (ask.kind === 'choice') {
      const v = reply.values?.[key];
      const id = v == null ? null : ask.ids.get(String(v).toLowerCase());
      said = id == null ? null : { ids: [id] };
    } else {
      const piece = kept.get(ask.prop.ident);
      if (piece) said = piece.kind === 'number' ? { number: piece.ids[0] } : piece.kind === 'day' ? { day: piece.day } : { ids: piece.ids };
    }
    let result;
    if (!truth) result = said ? 'spoke' : 'quiet';
    else if (!said) result = 'silent';
    else if (ask.kind === 'number') result = Number(said.number) === Number(truth.number) ? 'right' : 'wrong';
    else if (ask.kind === 'date') result = said.day === truth.day ? 'right' : 'wrong';
    else result = sameSet(said.ids, truth.ids) ? 'right' : 'wrong';
    // Some of the right pages named, not all (or one too many): counted wrong, and marked so the report can say it.
    const partly = result === 'wrong' && !!said.ids && said.ids.some(id => truth.ids?.includes(id));
    out.push({ key, result, offered, partly, wrote: shownValue(ctx, ask.kind, truth), said: said && shownValue(ctx, ask.kind, said) });
  }
  return out;
}
/* What you would see while writing, judged: the note's own properties (choices and Logseq's own left out, as nothing ever
   proposes them) against everything proposed for it, the rules', the matcher's, the name finder's and the model's together
   (pieces, as the proposals merge them). [{ title, result: 'right' | 'wrong' | 'silent' | 'spoke' | 'quiet', sure, source }]:
   sure is a value written when you leave the bullet, not sure a pencilled guess; source is what it went on, in the words the
   lessons page uses (core/lessons.js: your words, a linked page, earlier lines, the bullet above, Apple's model ...). */
function judgeSeen(ctx, note, pieces) {
  const by = new Map((pieces || []).filter(p => p.kind !== 'tag').map(p => [p.ident, p])), out = [];
  for (const prop of fieldsOfTags(note.b.tags, ctx.schema)) {
    if (isChoiceProp(prop) || isBuiltInProp(prop) || prop.ident === 'block/tags') continue;
    const truth = note.truth.get(prop.ident), piece = by.get(prop.ident);
    let result;
    if (!piece) result = truth ? 'silent' : 'quiet';
    else if (!truth) result = 'spoke';
    else if (truth.kind === 'number') result = Number(piece.ids[0]) === Number(truth.number) ? 'right' : 'wrong';
    else if (truth.kind === 'date') result = piece.day === truth.day ? 'right' : 'wrong';
    else result = sameSet(piece.ids, truth.ids) ? 'right' : 'wrong';
    out.push({ title: prop.title, result, sure: !!piece && !piece.guess, source: piece ? lessons.sourceOf(piece) : null });
  }
  return out;
}

// A value as words, for the details of a test graph: pages and choices by title, a number, a day as YYYY-MM-DD.
function shownValue(ctx, kind, v) {
  if (!v) return null;
  if (v.number != null) return String(v.number);
  if (v.day) return model.iso(v.day);
  return (v.ids || []).map(id => ctx.byId.get(id)?.title || ctx.schema.props.flatMap(p => p.choices || []).find(c => c.id === id)?.title || '?').join(', ');
}
const isTestGraph = ctx => (ctx.pages || []).some(p => String(p.title || '').toLowerCase() === TEST_PAGE);
const judgeTag = (note, req, reply, error = null) => {
  if (!reply) return 'failed';
  const tag = model.tagOf(req, reply);
  return !tag ? 'silent' : note.b.tags.includes(tag.id) ? 'right' : 'wrong';
};
const tagSaid = (req, reply) => model.tagOf(req, reply)?.title || null;

/* All the answers, counted. records: [{ tagTitle, asked, props: [{ way, results, ms, size, error }], tags: [{ way, result,
   ms, size, error }] }]. ms is kept only for questions answered. */
function tally(records) {
  const blank = () => ({ right: 0, wrong: 0, silent: 0, failed: 0, spoke: 0 });
  const t = { notes: records.length, questions: 0, ways: {}, tagWays: {}, byKind: {}, byProp: new Map(), ms: {}, sizes: {}, failedSizes: {}, answeredSizes: {}, reasons: {} };
  const each = name => { t.ms[name] = []; t.sizes[name] = []; t.failedSizes[name] = []; t.answeredSizes[name] = []; t.reasons[name] = new Map(); };
  for (const w of WAYS) { t.ways[w] = { all: blank(), named: blank(), unnamed: blank(), notOffered: 0, empty: 0, unasked: 0 }; each(w); }
  t.choices = Object.fromEntries(WAYS.map(w => [w, blank()]));
  t.turned = { right: 0, wrong: 0, differ: 0, silent: 0 }; t.listed = { yes: 0, of: 0 };
  for (const w of TAG_WAYS) { t.tagWays[w] = blank(); each('tag ' + w); }
  const asked = (name, q) => {
    if (q.size != null) t.sizes[name].push(q.size);
    if (q.error) { t.failedSizes[name].push(q.size); const r = reason(q.error); t.reasons[name].set(r, (t.reasons[name].get(r) || 0) + 1); }
    else { if (q.size != null) t.answeredSizes[name].push(q.size); if (q.ms != null) t.ms[name].push(q.ms); }
  };
  for (const rec of records) {
    const info = new Map(rec.asked.map(a => [a.key, a]));
    for (const q of rec.props) {
      const { way, results } = q;
      asked(way, q);
      for (const r of results) {
        const a = info.get(r.key), w = t.ways[way];
        // A choice is never asked while writing: counted apart, outside the totals.
        if (a.kind === 'choice') { if (r.result !== 'quiet') t.choices[way][r.result]++; continue; }
        if (r.result === 'quiet' || r.result === 'spoke') w.empty++;
        if (r.result === 'quiet') continue;
        if (way === WAYS[0] && r.result !== 'spoke') t.questions++;
        if (r.unasked) w.unasked++;
        w.all[r.result]++;
        if (a.kind === 'page' && r.result !== 'spoke') { w[a.named ? 'named' : 'unnamed'][r.result]++; if (!r.offered) w.notOffered++; }
        const kindName = a.kind === 'date' ? (r.offered ? 'date, day in the words' : 'date, day not in the words') : a.kind;
        const kind = (t.byKind[kindName] ||= Object.fromEntries(WAYS.map(x => [x, blank()])));
        kind[way][r.result]++;
        const pk = `${rec.tagTitle || ''} · ${a.prop.title}`;
        if (!t.byProp.has(pk)) t.byProp.set(pk, Object.fromEntries(WAYS.map(x => [x, { ...blank(), run: 0, best: 0, notOffered: 0, partly: 0 }])));
        const p = t.byProp.get(pk)[way];
        p[r.result]++;
        if (r.result !== 'spoke' && !r.offered) p.notOffered++;
        if (r.partly) p.partly++;
        if (r.result === 'right') { p.run++; p.best = Math.max(p.best, p.run); } else if (r.result === 'wrong' || r.result === 'spoke') p.run = 0;
      }
    }
    for (const q of rec.tags) { t.tagWays[q.way][q.result]++; asked('tag ' + q.way, q); }
    // The short list both ways round: the same tag twice (right or wrong), two different answers, or none both times.
    const near = rec.tags.find(q => q.way === 'near tags'), turned = rec.tags.find(q => q.way === 'near, turned');
    if (near) { t.listed.of++; if (near.listed) t.listed.yes++; }
    if (near && turned && near.result !== 'failed' && turned.result !== 'failed') {
      if (near.result === 'silent' && turned.result === 'silent') t.turned.silent++;
      else if (near.said && near.said === turned.said) t.turned[near.result === 'right' ? 'right' : 'wrong']++;
      else t.turned.differ++;
    }
    // By meaning (core/meaning.js) and the name finder (core/people.js), where the helper has them: the tag the near notes carry,
    // the open page properties they agree on, and new pages the finder would have offered for a name the note already linked.
    if (rec.seen) {
      const s = (t.seen ||= { sure: blank(), guess: blank(), silent: 0, empty: 0, bySource: new Map(), byProp: new Map() });
      for (const r of rec.seen) {
        if (r.result === 'quiet' || r.result === 'spoke') s.empty++;
        if (r.result === 'quiet') continue;
        const name = `${rec.tagTitle || ''} · ${r.title}`;
        const p = s.byProp.get(name) || { sure: blank(), guess: blank(), silent: 0 }; s.byProp.set(name, p);
        if (r.result === 'silent') { s.silent++; p.silent++; continue; }
        p[r.sure ? 'sure' : 'guess'][r.result]++;
        s[r.sure ? 'sure' : 'guess'][r.result]++;
        const c = s.bySource.get(r.source) || blank(); c[r.result]++; s.bySource.set(r.source, c);
      }
    }
    if (rec.meaning) {
      const m = (t.meaning ||= { notes: 0, tag: blank(), props: blank(), byProp: new Map(), doubles: 0, named: 0 });
      m.notes++;
      m.tag[rec.meaning.tag]++;
      for (const p of rec.meaning.props) { m.props[p.result]++; const c = m.byProp.get(p.title) || blank(); c[p.result]++; m.byProp.set(p.title, c); }
      m.doubles += rec.meaning.doubles || 0; m.named += rec.meaning.named || 0;
      if (rec.meaning.why) (m.why ||= new Map()).set(rec.meaning.why, (m.why.get(rec.meaning.why) || 0) + 1);
    }
  }
  return t;
}
const meaningLines = m => !m ? [] : (() => {
  const rws = c => `${c.right} / ${c.wrong} / ${c.silent}`;
  const row = (label, cells) => label.padEnd(30) + cells.map(c => String(c).padStart(14)).join('');
  const props = m.props.right + m.props.wrong + m.props.silent > 0;   // page properties are voted by meaning only where the limit asks
  return ['', 'BY MEANING (Apple\'s matcher on this Mac, no filter): right / wrong / silent', row('', props ? ['tag', 'properties'] : ['tag']),
    row(`${m.notes} notes`, props ? [rws(m.tag), rws(m.props)] : [rws(m.tag)]),
    ...[...m.byProp].sort((x, y) => (y[1].right + y[1].wrong) - (x[1].right + x[1].wrong)).slice(0, 20).map(([name, c]) => row(name.length > 29 ? name.slice(0, 28) + '…' : name, ['', rws(c)])),
    ...(m.why?.size ? ['WHY NO TAG BY MEANING: ' + [...m.why].sort((x, y) => y[1] - x[1]).map(([why, n]) => `${why} ${n}`).join(' · ')] : []),
    `NEW PAGES BY THE NAME FINDER: ${m.doubles} offered for a name the note already had a page for (a double), in ${m.named} notes with a name read.`];
})();

const seenLines = s => !s ? [] : (() => {
  const row = (label, cells) => label.padEnd(30) + cells.map(c => String(c).padStart(14)).join('');
  const filled = s.sure.right + s.sure.wrong + s.guess.right + s.guess.wrong + s.silent;
  return ['', 'WHAT YOU WOULD SEE WHILE WRITING (the rules, the matcher, the name finder and the model together; choices left out)',
    row(`of ${filled} you filled`, ['right', 'wrong']),
    row('written when you leave', [s.sure.right, s.sure.wrong]),
    row('pencilled, a guess', [s.guess.right, s.guess.wrong]),
    row('nothing shown', [s.silent]),
    row(`of ${s.empty} you left empty`, ['written', 'pencilled']),
    row('filled anyway', [s.sure.spoke, s.guess.spoke]),
    row('BY WHAT IT WENT ON', ['right', 'wrong', 'empty filled']),
    ...[...s.bySource].sort((x, y) => (y[1].right + y[1].wrong) - (x[1].right + x[1].wrong)).map(([name, c]) => row(name, [c.right, c.wrong, c.spoke])),
    row('BY PROPERTY (right/wrong)', ['written', 'pencilled', 'nothing', 'empty filled']),
    ...[...s.byProp].sort((x, y) => (y[1].sure.wrong + y[1].guess.wrong + y[1].sure.spoke + y[1].guess.spoke) - (x[1].sure.wrong + x[1].guess.wrong + x[1].sure.spoke + x[1].guess.spoke) || x[0].localeCompare(y[0])).slice(0, 30)
      .map(([name, p]) => row(name.length > 29 ? name.slice(0, 28) + '…' : name, [`${p.sure.right}/${p.sure.wrong}`, `${p.guess.right}/${p.guess.wrong}`, p.silent, p.sure.spoke + p.guess.spoke]))];
})();

const pct = (n, of) => of ? Math.round(100 * n / of) + '%' : '–';
// Where the true share may lie, from n of of (Wilson's 95% range): "27–56%".
function range(n, of) {
  if (!of) return '–';
  const z = 1.96, p = n / of, mid = (p + z * z / (2 * of)) / (1 + z * z / of), half = z * Math.sqrt(p * (1 - p) / of + z * z / (4 * of * of)) / (1 + z * z / of);
  return `${Math.round(100 * Math.max(0, mid - half))}–${Math.round(100 * Math.min(1, mid + half))}%`;
}
const median = list => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const largest = list => list.length ? Math.max(...list) : null;
const smallest = list => list.length ? Math.min(...list) : null;
const secs = ms => ms == null ? '–' : (ms / 1000).toFixed(1) + ' s';
const num = n => n == null ? '–' : String(n);

/* The report as plain text, to read and to copy: numbers, and the names of tags and properties, never a note's words. */
function text(t, about = {}, details = null, outside = []) {
  const row = (label, cells) => label.padEnd(30) + cells.map(c => String(c).padStart(14)).join('');
  const shortName = n => n;
  const head = row('', WAYS);
  const all = c => c.right + c.wrong + c.silent + c.failed;
  const rwsf = c => `${c.right}/${c.wrong}/${c.silent}/${c.failed}`;
  const names = [...WAYS, ...TAG_WAYS.map(w => 'tag ' + w)];
  const reasons = new Set(names.flatMap(n => [...t.reasons[n].keys()]));
  const lines = [
    `Apple's model on this graph · Predictive ${about.version || ''} · helper ${about.helper || '1'} · ${about.date || ''}`.trim(),
    `${t.notes} notes, ${t.questions} properties you filled, ${t.ways[WAYS[0]].empty} you left empty.`,
    'named: as Predictive asks now, a page only when the note\'s words name it. range too: as it asked until 12 November 2026.',
    '', 'PROPERTIES YOU FILLED', head,
    row('right', WAYS.map(w => `${t.ways[w].all.right} ${pct(t.ways[w].all.right, all(t.ways[w].all))}`)),
    row('  its 95% range', WAYS.map(w => range(t.ways[w].all.right, all(t.ways[w].all)))),
    row('wrong', WAYS.map(w => `${t.ways[w].all.wrong} ${pct(t.ways[w].all.wrong, all(t.ways[w].all))}`)),
    row('silent', WAYS.map(w => t.ways[w].all.silent)),
    row('  of those, not asked', WAYS.map(w => t.ways[w].unasked)),
    row('failed (no answer at all)', WAYS.map(w => t.ways[w].all.failed)),
    '', 'PROPERTIES YOU LEFT EMPTY', head,
    row('left empty', WAYS.map(w => t.ways[w].empty)),
    row('filled anyway', WAYS.map(w => `${t.ways[w].all.spoke} ${pct(t.ways[w].all.spoke, t.ways[w].empty)}`)),
    '', 'A PAGE NAMED IN THE NOTE (right / wrong / silent / failed)', head,
    row('', WAYS.map(w => rwsf(t.ways[w].named))),
    '', 'A PAGE NOT NAMED IN THE NOTE (right / wrong / silent / failed)', head,
    row('', WAYS.map(w => rwsf(t.ways[w].unnamed))),
    row('right page not offered', WAYS.map(w => t.ways[w].notOffered)),
    '', 'BY KIND OF PROPERTY (right / wrong / silent / failed)', head,
    ...Object.entries(t.byKind).map(([kind, c]) => row(kind, WAYS.map(w => rwsf(c[w])))),
    row('choice (measured only)', WAYS.map(w => rwsf(t.choices[w]))),
    '', 'THE TAG OF A NOTE (right / wrong / silent / failed)', row('', TAG_WAYS),
    row('', TAG_WAYS.map(w => rwsf(t.tagWays[w]))),
    row('right, 95% range', TAG_WAYS.map(w => range(t.tagWays[w].right, all(t.tagWays[w])))),
    `NEAR TAGS: the ${NEAR_TAGS} tags the nearest notes carry. The right tag was among them in ${t.listed.yes} of ${t.listed.of} notes.`,
    `BOTH WAYS ROUND: the same tag ${t.turned.right + t.turned.wrong} times (${t.turned.right} right, ${t.turned.wrong} wrong), two different tags ${t.turned.differ} times, none both times ${t.turned.silent}.`,
    '', 'WHY QUESTIONS FAILED (questions, not properties)', row('', names.map(shortName)),
    ...(reasons.size ? [...reasons].map(r => row(r.length > 29 ? r.slice(0, 28) + '…' : r, names.map(n => t.reasons[n].get(r) || 0))) : [row('none failed', [])]),
    '', 'SIZE OF A QUESTION, ABOUT, IN TOKENS', row('', ['median', 'largest', 'failed min', 'answer max']),
    ...names.map(n => row(shortName(n), [num(median(t.sizes[n])), num(largest(t.sizes[n])), num(smallest(t.failedSizes[n])), num(largest(t.answeredSizes[n]))])),
    '', 'TIME PER QUESTION ANSWERED', row('', ['median', 'slowest']),
    ...names.map(n => row(shortName(n), [secs(median(t.ms[n])), secs(largest(t.ms[n]))])),
    '', `BY PROPERTY (${WAYS[1]}: the fullest question)`, row('', ['r/w/s/failed', 'not offered', 'partly']),
    ...[...t.byProp].sort((x, y) => (y[1][WAYS[1]].right + y[1][WAYS[1]].wrong) - (x[1][WAYS[1]].right + x[1][WAYS[1]].wrong)).slice(0, 30)
      .map(([name, c]) => row(name.length > 29 ? name.slice(0, 28) + '…' : name, [rwsf(c[WAYS[1]]), c[WAYS[1]].notOffered, c[WAYS[1]].partly])),
    '', 'NOT OFFERED: the right page was not among the choices, as its tags are not ones the property takes; for a date, the day is not named in the words.',
    'PARTLY: the model named some of the right pages, not all; counted wrong.',
    ...outsideLines(outside),
    ...meaningLines(t.meaning),
    ...seenLines(t.seen),
  ];
  if (details?.length) {
    lines.push('', 'DETAILS (a test graph only: these notes are about no one real)');
    for (const d of details) {
      lines.push('', `"${d.words}" (${d.tag})`);
      for (const p of d.props) lines.push(`  ${p.title}: wrote ${p.wrote ?? '–'} · ` + p.ways.map(w => `${w.way} ${w.failed ? 'failed: ' + w.failed : w.said ? `said ${w.said} (${w.result})` : w.result}${w.offered === false ? ', right one not offered' : ''}`).join(' · '));
      if (d.tags.length) lines.push(`  Tag: ` + d.tags.map(x => `${x.way ? x.way + ' ' : ''}${x.failed ? 'failed: ' + x.failed : x.said ? `said ${x.said} (${x.result})` : x.result}`).join(' · '));
    }
  }
  if (about.oldHelper) lines.push('', 'The helper on this Mac is older than this release: only Apple\'s model as it comes was asked, and dates still fail. Run install.sh again, then measure again.');
  if (about.noTagger) lines.push('', 'Apple\'s tagging model is not on this Mac, so it was not asked.');
  return lines.join('\n');
}

/* The properties whose values, across the whole graph, are pages they do not take: the page's tags (and the tags those
   extend) are none of the property's range. Such a page is never offered to the model, so the right answer cannot come.
   Names only: [{ name: 'Therapeutic Session · Targets', range, total, outside, byTag: [[tag title, count]] }]. */
function outsideRange(ctx) {
  const out = [];
  for (const prop of ctx.schema.props) {
    if (!prop.classes?.length || prop.type !== 'node') continue;
    const range = new Set(prop.classes.map(c => c.id));
    let total = 0, outside = 0;
    const byTag = new Map();
    for (const e of ctx.index?.entries || []) for (const id of e.values.get(prop.ident) || []) {
      const page = ctx.byId.get(id);
      if (!page) continue;
      total++;
      if (fits(page, range, ctx.schema)) continue;
      outside++;
      const tag = page.tags.map(t => t.title).filter(Boolean).join(', ') || 'no tag';
      byTag.set(tag, (byTag.get(tag) || 0) + 1);
    }
    if (outside) out.push({ name: prop.title, range: prop.classes.map(c => c.title).join(', '), total, outside, byTag: [...byTag].sort((a, b) => b[1] - a[1]) });
  }
  return out.sort((a, b) => b.outside - a.outside);
}
function outsideLines(outside) {
  if (!outside?.length) return ['', 'VALUES OUTSIDE THEIR PROPERTY\'S RANGE: none in this graph.'];
  return ['', 'VALUES OUTSIDE THEIR PROPERTY\'S RANGE (the whole graph; fix in Structure: widen the range, or retag the pages)',
    ...outside.slice(0, 20).map(o => `${o.name} takes ${o.range}: ${o.outside} of ${o.total} values are not, tagged ${o.byTag.slice(0, 4).map(([t, n]) => `${t} ${n}`).join(', ')}`)];
}

/* One note's details for a test graph: its words, and for each property asked, what was written and what each way said. */
function detailOf(ctx, note, asked, props, tags) {
  const titleOf = new Map(asked.map(a => [a.key, a.prop.title]));
  const byKey = new Map();
  for (const { way, results, error } of props) for (const r of results) {
    if (r.result === 'quiet') continue;
    if (!byKey.has(r.key)) byKey.set(r.key, { title: titleOf.get(r.key), wrote: r.wrote, ways: [] });
    byKey.get(r.key).ways.push({ way, result: r.result, said: r.said, offered: r.offered, failed: error ? reason(error) : null });
  }
  return { words: clip(model.shown(ctx, note.b.text)), tag: ctx.byId.get(note.b.tags[0])?.title || '', props: [...byKey.values()],
    tags: tags.map(x => ({ way: x.way, result: x.result, said: x.said, failed: x.error ? reason(x.error) : null })) };
}

const api = { judgeSeen, nearTags, notAsked, range, NEAR_TAGS, outsideRange, isTestGraph, tagSaid, detailOf, WAYS, TAG_WAYS, SETTINGS, candidates, momentText, examplesText, questions, judge, judgeTag, tally, text, size, reason };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).measure = api;
})();
