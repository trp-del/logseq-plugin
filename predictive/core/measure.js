/* Measuring Apple's model on the graph's own notes: the questions, and the judging of the answers. Pure; the asking is
   logseq/measure.js, on the Mac that has the model.

   A note of yours that holds values is asked about as if it held none, in four ways, and each answer is set against
   what you wrote:
   - alone:    the note's words, as Predictive asks today;
   - moment:   and the words around it: the bullet it sits under, the two before it, the page;
   - examples: and up to three earlier notes of the same tag with their values, nearest by words;
   - both:     the moment and the examples.
   A note with a tag is also asked which tag it is, alone and with the moment.

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

const WAYS = ['alone', 'moment', 'examples', 'both'];
const TAG_WAYS = ['alone', 'moment'];
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
    const props = [...base.asked.values()].map(a => a.prop);
    const examples = examplesText(ctx, b, props);
    const way = (name, context, instructions, widen) => {
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
      out.props.push({ way: name, req: { ...base, fill, asked } });
    };
    way('alone');
    way('moment', around, around && MOMENT_INSTRUCTIONS, true);
    way('examples', examples);
    way('both', [around, examples].filter(Boolean).join('\n\n'), around && MOMENT_INSTRUCTIONS, true);
  }

  // The tag, asked of the note as if it had none.
  const bare = { ...b, tags: [], values: new Map(), parent: null };
  const tagReq = model.tagRequest(ctx, bare, note.day);
  if (tagReq) {
    out.tags.push({ way: 'alone', req: tagReq });
    out.tags.push({ way: 'moment', req: around ? { ...tagReq, fill: { ...tagReq.fill, context: [tagReq.fill.context, around].filter(Boolean).join('\n\n'), instructions: MOMENT_INSTRUCTIONS } } : tagReq });
  }
  return out;
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

/* One answer, judged: [{ key, result: 'right' | 'wrong' | 'silent' | 'spoke' | 'quiet', offered }] for the properties
   asked. A value the plugin would not keep (a number the words do not hold, a day they do not name) counts as silent,
   since that is what you would see. */
function judge(ctx, note, req, reply) {
  const kept = new Map(model.pieces(ctx, req, reply || { values: {} }).map(p => [p.ident, p]));
  const out = [];
  for (const [key, ask] of req.asked) {
    const truth = note.truth.get(ask.prop.ident);
    let said = null;
    if (ask.kind === 'choice') {
      const v = reply?.values?.[key];
      const id = v == null ? null : ask.ids.get(String(v).toLowerCase());
      said = id == null ? null : { ids: [id] };
    } else {
      const piece = kept.get(ask.prop.ident);
      if (piece) said = piece.kind === 'number' ? { number: piece.ids[0] } : piece.kind === 'day' ? { day: piece.day } : { ids: piece.ids };
    }
    const offered = ask.kind !== 'page' || !truth ? true : truth.ids.every(id => [...ask.pages.values()].some(p => p.id === id));
    let result;
    if (!truth) result = said ? 'spoke' : 'quiet';
    else if (!said) result = 'silent';
    else if (ask.kind === 'number') result = Number(said.number) === Number(truth.number) ? 'right' : 'wrong';
    else if (ask.kind === 'date') result = said.day === truth.day ? 'right' : 'wrong';
    else result = sameSet(said.ids, truth.ids) ? 'right' : 'wrong';
    out.push({ key, result, offered });
  }
  return out;
}
const judgeTag = (note, req, reply) => { const tag = model.tagOf(req, reply); return !tag ? 'silent' : note.b.tags.includes(tag.id) ? 'right' : 'wrong'; };

/* All the answers, counted. records: [{ note, asked, props: [{ way, results, ms }], tags: [{ way, result, ms }] }]. */
function tally(records) {
  const blank = () => ({ right: 0, wrong: 0, silent: 0, spoke: 0 });
  const t = { notes: records.length, questions: 0, ways: {}, tagWays: {}, byKind: {}, byProp: new Map(), ms: {} };
  for (const w of WAYS) { t.ways[w] = { all: blank(), named: blank(), unnamed: blank(), notOffered: 0 }; t.ms[w] = []; }
  for (const w of TAG_WAYS) { t.tagWays[w] = blank(); t.ms['tag ' + w] = []; }
  for (const rec of records) {
    const info = new Map(rec.asked.map(a => [a.key, a]));
    for (const { way, results, ms } of rec.props) {
      if (ms != null) t.ms[way].push(ms);
      for (const r of results) {
        if (r.result === 'quiet') continue;
        const a = info.get(r.key), w = t.ways[way];
        if (way === 'alone' && r.result !== 'spoke') t.questions++;
        w.all[r.result]++;
        if (a.kind === 'page' && r.result !== 'spoke') { w[a.named ? 'named' : 'unnamed'][r.result]++; if (!r.offered) w.notOffered++; }
        const kind = (t.byKind[a.kind] ||= Object.fromEntries(WAYS.map(x => [x, blank()])));
        kind[way][r.result]++;
        const tagTitle = rec.tagTitle || '';
        const pk = `${tagTitle} · ${a.prop.title}`;
        if (!t.byProp.has(pk)) t.byProp.set(pk, Object.fromEntries(WAYS.map(x => [x, { ...blank(), run: 0, best: 0 }])));
        const p = t.byProp.get(pk)[way];
        p[r.result]++;
        if (r.result === 'right') { p.run++; p.best = Math.max(p.best, p.run); } else if (r.result === 'wrong' || r.result === 'spoke') p.run = 0;
      }
    }
    for (const { way, result, ms } of rec.tags) { t.tagWays[way][result]++; if (ms != null) t.ms['tag ' + way].push(ms); }
  }
  return t;
}

const pct = (n, of) => of ? Math.round(100 * n / of) + '%' : '–';
const median = list => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const slowest = list => list.length ? Math.max(...list) : null;
const secs = ms => ms == null ? '–' : (ms / 1000).toFixed(1) + ' s';

/* The report as plain text, to read and to copy: numbers, and the names of tags and properties, never a note's words. */
function text(t, about = {}) {
  const row = (label, cells) => label.padEnd(26) + cells.map(c => String(c).padStart(12)).join('');
  const head = row('', WAYS);
  const asked = c => c.right + c.wrong + c.silent;
  const lines = [
    `Apple's model on this graph · Predictive ${about.version || ''} · helper ${about.helper || '1'} · ${about.date || ''}`.trim(),
    `${t.notes} notes, ${t.questions} properties asked in each of four ways.`,
    '', 'PROPERTIES', head,
    row('right', WAYS.map(w => `${t.ways[w].all.right} ${pct(t.ways[w].all.right, asked(t.ways[w].all))}`)),
    row('wrong', WAYS.map(w => `${t.ways[w].all.wrong} ${pct(t.ways[w].all.wrong, asked(t.ways[w].all))}`)),
    row('silent', WAYS.map(w => t.ways[w].all.silent)),
    row('filled one you left empty', WAYS.map(w => t.ways[w].all.spoke)),
    '', 'A PAGE NAMED IN THE NOTE', head,
    row('right / wrong / silent', WAYS.map(w => `${t.ways[w].named.right}/${t.ways[w].named.wrong}/${t.ways[w].named.silent}`)),
    '', 'A PAGE NOT NAMED IN THE NOTE', head,
    row('right / wrong / silent', WAYS.map(w => `${t.ways[w].unnamed.right}/${t.ways[w].unnamed.wrong}/${t.ways[w].unnamed.silent}`)),
    row('right page not offered', WAYS.map(w => t.ways[w].notOffered)),
    '', 'BY KIND OF PROPERTY (right / wrong / silent)', head,
    ...Object.entries(t.byKind).map(([kind, c]) => row(kind, WAYS.map(w => `${c[w].right}/${c[w].wrong}/${c[w].silent}`))),
    '', 'THE TAG OF A NOTE (right / wrong / silent)', row('', TAG_WAYS),
    row('', TAG_WAYS.map(w => `${t.tagWays[w].right}/${t.tagWays[w].wrong}/${t.tagWays[w].silent}`)),
    '', 'TIME PER QUESTION', row('', ['median', 'slowest']),
    ...[...WAYS, ...TAG_WAYS.map(w => 'tag ' + w)].map(w => row(w, [secs(median(t.ms[w])), secs(slowest(t.ms[w]))])),
    '', 'BY PROPERTY, WITH THE MOMENT AND EXAMPLES (right / wrong / silent, longest run right)',
    ...[...t.byProp].sort((x, y) => (y[1].both.right + y[1].both.wrong) - (x[1].both.right + x[1].both.wrong)).slice(0, 30)
      .map(([name, c]) => row(name.length > 25 ? name.slice(0, 24) + '…' : name, [`${c.both.right}/${c.both.wrong}/${c.both.silent}`, `run ${c.both.best}`])),
  ];
  if (about.oldHelper) lines.push('', 'Choices were not asked: the helper on this Mac is older than this release. Run install.sh again, then measure again.');
  return lines.join('\n');
}

const api = { WAYS, TAG_WAYS, candidates, momentText, examplesText, questions, judge, judgeTag, tally, text };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).measure = api;
})();
