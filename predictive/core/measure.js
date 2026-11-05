/* Measuring Apple's model on the graph's own notes: the questions, and the judging of the answers. Pure; the asking is
   logseq/measure.js, on the Mac that has the model.

   A note of yours that holds values is asked about as if it held none, and each answer is set against what you wrote.
   It is asked four ways, each from the note's words alone, after Apple's guidance (a field's description is another way
   of prompting; the model does best with one specific task):
   - together:        every property in one question, as Predictive asks today;
   - one by one:      a question for each property;
   - described:       one question, each property said in plain words from the graph's structure (model.describe);
   - both:            one by one, and described.
   A note with a tag is also asked which tag it is, as Predictive asks it (since 0.3.19 without the earlier lines of each
   kind, which 0.3.18 measured as what Apple's filter refused), and described, each tag with the tags above it. (The
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

   Nothing here is shown to anyone but the person on that Mac: the report (text) holds numbers and the names of tags and
   properties, never a note's words. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const model = need('model');
const { fieldsOfTags, isChoiceProp, isLinkProp, isNumberProp, isDateProp } = need('schema');
const engine = need('engine');
const { shownWords } = need('context');

// Apple's settings, by the word the report gives each and the name the helper takes.
const SETTINGS = [['', 'default']];   // [' loose', 'permissive'], [' tagger', 'tagging'] measured in 0.3.16
const WAYS = ['together', 'one by one', 'described', 'both'];
const TAG_WAYS = ['today', 'described'];   // the tag question as Predictive asks it, and with the tags above each
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
const MOMENT_INSTRUCTIONS = model.INSTRUCTIONS + ' The notes around it may say who or what a word like "she", "he", "it" or ' +
  '"the scan" means; use them for that, and only for that.';

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
function questions(ctx, note) {
  const { b, truth } = note;
  const hidden = { ...b, values: new Map(), parent: null };
  const base = model.request(ctx, hidden, { pieces: [], record: hidden, quiet: [] }, note.day);
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
    way('together');
    const together = out.props[0].req, described = model.describe(ctx, together, b.tags);
    for (const req of model.oneByOne(together)) out.props.push({ way: 'one by one', req });
    out.props.push({ way: 'described', req: described });
    for (const req of model.oneByOne(described)) out.props.push({ way: 'both', req });
  }

  // The tag, asked of the note as if it had none.
  const bare = { ...b, tags: [], values: new Map(), parent: null };
  const tagReq = model.tagRequest(ctx, bare, note.day);
  if (tagReq) {
    out.tags.push({ way: 'today', req: tagReq });
    const described = model.tagRequest(ctx, bare, note.day, { described: true });
    if (described) out.tags.push({ way: 'described', req: described });
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
    out.push({ key, result, offered, wrote: shownValue(ctx, ask.kind, truth), said: said && shownValue(ctx, ask.kind, said) });
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
  for (const w of WAYS) { t.ways[w] = { all: blank(), named: blank(), unnamed: blank(), notOffered: 0 }; each(w); }
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
        if (r.result === 'quiet') continue;
        const a = info.get(r.key), w = t.ways[way];
        if (way === 'together' && r.result !== 'spoke') t.questions++;
        w.all[r.result]++;
        if (a.kind === 'page' && r.result !== 'spoke') { w[a.named ? 'named' : 'unnamed'][r.result]++; if (!r.offered) w.notOffered++; }
        const kindName = a.kind === 'date' ? (r.offered ? 'date, day in the words' : 'date, day not in the words') : a.kind;
        const kind = (t.byKind[kindName] ||= Object.fromEntries(WAYS.map(x => [x, blank()])));
        kind[way][r.result]++;
        const pk = `${rec.tagTitle || ''} · ${a.prop.title}`;
        if (!t.byProp.has(pk)) t.byProp.set(pk, Object.fromEntries(WAYS.map(x => [x, { ...blank(), run: 0, best: 0 }])));
        const p = t.byProp.get(pk)[way];
        p[r.result]++;
        if (r.result === 'right') { p.run++; p.best = Math.max(p.best, p.run); } else if (r.result === 'wrong' || r.result === 'spoke') p.run = 0;
      }
    }
    for (const q of rec.tags) { t.tagWays[q.way][q.result]++; asked('tag ' + q.way, q); }
  }
  return t;
}

const pct = (n, of) => of ? Math.round(100 * n / of) + '%' : '–';
const median = list => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const largest = list => list.length ? Math.max(...list) : null;
const smallest = list => list.length ? Math.min(...list) : null;
const secs = ms => ms == null ? '–' : (ms / 1000).toFixed(1) + ' s';
const num = n => n == null ? '–' : String(n);

/* The report as plain text, to read and to copy: numbers, and the names of tags and properties, never a note's words. */
function text(t, about = {}, details = null) {
  const row = (label, cells) => label.padEnd(30) + cells.map(c => String(c).padStart(14)).join('');
  const shortName = n => n;
  const head = row('', WAYS);
  const all = c => c.right + c.wrong + c.silent + c.failed;
  const rwsf = c => `${c.right}/${c.wrong}/${c.silent}/${c.failed}`;
  const names = [...WAYS, ...TAG_WAYS.map(w => 'tag ' + w)];
  const reasons = new Set(names.flatMap(n => [...t.reasons[n].keys()]));
  const lines = [
    `Apple's model on this graph · Predictive ${about.version || ''} · helper ${about.helper || '1'} · ${about.date || ''}`.trim(),
    `${t.notes} notes, ${t.questions} properties asked four ways: together (as today), one by one, described from your structure, and both (one by one and described).`,
    '', 'PROPERTIES', head,
    row('right', WAYS.map(w => `${t.ways[w].all.right} ${pct(t.ways[w].all.right, all(t.ways[w].all))}`)),
    row('wrong', WAYS.map(w => `${t.ways[w].all.wrong} ${pct(t.ways[w].all.wrong, all(t.ways[w].all))}`)),
    row('silent (answered, no value)', WAYS.map(w => t.ways[w].all.silent)),
    row('failed (no answer at all)', WAYS.map(w => t.ways[w].all.failed)),
    row('filled one you left empty', WAYS.map(w => t.ways[w].all.spoke)),
    '', 'A PAGE NAMED IN THE NOTE (right / wrong / silent / failed)', head,
    row('', WAYS.map(w => rwsf(t.ways[w].named))),
    '', 'A PAGE NOT NAMED IN THE NOTE (right / wrong / silent / failed)', head,
    row('', WAYS.map(w => rwsf(t.ways[w].unnamed))),
    row('right page not offered', WAYS.map(w => t.ways[w].notOffered)),
    '', 'BY KIND OF PROPERTY (right / wrong / silent / failed)', head,
    ...Object.entries(t.byKind).map(([kind, c]) => row(kind, WAYS.map(w => rwsf(c[w])))),
    '', 'THE TAG OF A NOTE (right / wrong / silent / failed)', row('', TAG_WAYS),
    row('', TAG_WAYS.map(w => rwsf(t.tagWays[w]))),
    '', 'WHY QUESTIONS FAILED (questions, not properties)', row('', names.map(shortName)),
    ...(reasons.size ? [...reasons].map(r => row(r.length > 29 ? r.slice(0, 28) + '…' : r, names.map(n => t.reasons[n].get(r) || 0))) : [row('none failed', [])]),
    '', 'SIZE OF A QUESTION, ABOUT, IN TOKENS', row('', ['median', 'largest', 'failed min', 'answer max']),
    ...names.map(n => row(shortName(n), [num(median(t.sizes[n])), num(largest(t.sizes[n])), num(smallest(t.failedSizes[n])), num(largest(t.answeredSizes[n]))])),
    '', 'TIME PER QUESTION ANSWERED', row('', ['median', 'slowest']),
    ...names.map(n => row(shortName(n), [secs(median(t.ms[n])), secs(largest(t.ms[n]))])),
    '', 'BY PROPERTY (right / wrong / silent / failed)', row('', WAYS),
    ...[...t.byProp].sort((x, y) => (y[1].together.right + y[1].together.wrong) - (x[1].together.right + x[1].together.wrong)).slice(0, 30)
      .map(([name, c]) => row(name.length > 29 ? name.slice(0, 28) + '…' : name, WAYS.map(w => rwsf(c[w])))),
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

const api = { isTestGraph, tagSaid, detailOf, WAYS, TAG_WAYS, SETTINGS, candidates, momentText, examplesText, questions, judge, judgeTag, tally, text, size, reason };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).measure = api;
})();
