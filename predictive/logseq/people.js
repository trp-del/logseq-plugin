/* New people and places, through Predictive's helper on this Mac (helper/, /names). Which found name goes where is
   core/people.js; this asks Apple's name finder what names a bullet holds, and once per reading of the graph what kind of
   thing each tag's pages are (a person, a place, an organization), from their titles. Nothing leaves the Mac. */
(function () {
const Flow = (window.Flow ||= {});
const { app, people } = Flow;

const { helper } = window.PluginDoor, LOOK_AGAIN = 30000, MOST_TITLES = 30, KEEP = 60;
const S = { ready: null, at: 0, checking: null, kinds: null, answers: new Map() };

async function ready() {
  if (!app.setting('proposalsModel')) return false;
  if (S.ready !== null && Date.now() - S.at < LOOK_AGAIN) return S.ready;
  S.checking ||= helper.status().then(r => !!r.names, () => false)
    .then(ok => { S.ready = ok; S.at = Date.now(); S.checking = null; return ok; });
  return S.checking;
}
const post = (texts, giveUp = 4000) => helper.post('/names', { texts }, { wait: giveUp }).then(r => r?.names || null);

// The kind of each tag of yours, from its pages' titles: Map(tagId -> { kind, lead }); found once per reading of the graph.
async function kinds(ctx) {
  if (!ctx || !await ready()) return new Map();
  const key = `${ctx.graph}\n${ctx.readAt}`;
  if (S.kinds?.key === key) return S.kinds.job;
  const job = (async () => {
    const byTag = new Map();
    for (const page of ctx.pages) if (!page.isTag && !page.aliasOf && page.title) for (const t of page.tags) if (ctx.knownTags.has(t.id)) { if (!byTag.has(t.id)) byTag.set(t.id, []); if (byTag.get(t.id).length < MOST_TITLES) byTag.get(t.id).push(page.title); }
    // A name alone, or a list of names, is read as nothing or at random by Apple's finder (7 November 2026: eleven doctors in
    // a line, with commas, semicolons or line breaks, gave nothing or one); a name in a sentence is read well. So each page is
    // read in one of the graph's own lines that links it, the link shown as the name, and the kind is what the finder reads at
    // the name's place there. A page no line links is not read.
    const asks = [];   // { tag, title, text, at, to }
    for (const [id, titles] of byTag) {
      if (titles.length < 2) continue;
      for (const title of titles) {
        const page = ctx.byKey.get(title.toLowerCase());
        const lines = page ? ctx.index?.postings.get('link:' + page.id) || [] : [];
        for (const i of lines.slice(0, 2)) {
          const text = Flow.meaning.textOf(ctx, ctx.index.entries[i]?.title), at = text.indexOf(title);
          if (at >= 0) { asks.push({ tag: id, title, text, at, to: at + title.length }); break; }
        }
      }
    }
    const found = asks.length ? await post(asks.map(a => a.text), 20000) : [];
    if (!found) return new Map();
    const out = new Map();
    for (const [id, titles] of byTag) {
      const mine = asks.map((a, i) => a.tag === id ? { a, names: found[i] || [] } : null).filter(Boolean);
      const read = mine.map(({ a, names }) => ({ title: a.title, kind: names.find(n => n.at < a.to && n.to > a.at)?.kind || null }));
      const { kind, lead } = people.kindOfTitles(read, titles);
      if (kind) out.set(id, { kind, lead });
    }
    return out;
  })().catch(error => { S.ready = null; app.warnOnce('the tags’ kinds could not be read', error); return new Map(); });
  S.kinds = { key, job };
  job.then(value => { if (S.kinds?.key === key) S.kinds.value = value; });
  return job;
}
// The names in the bullet's words, as the person reads them.
async function namesIn(ctx, b) {
  if (!await ready()) return [];
  const text = Flow.meaning.textOf(ctx, b.text);
  if (!text) return [];
  if (!S.answers.has(text)) {
    const found = await post([text]).catch(() => null);
    if (!found) { S.ready = null; return []; }
    S.answers.set(text, found[0] || []);
    if (S.answers.size > KEEP) S.answers.delete(S.answers.keys().next().value);
  }
  return S.answers.get(text);
}
// The guesses already in for these words, or null when the names or the kinds are not in yet.
function had(ctx, b, result) {
  if (!result || (result.record !== b && !result.assume)) return [];
  const text = Flow.meaning.textOf(ctx, b.text), found = S.answers.get(text), known = S.kinds?.key === `${ctx.graph}\n${ctx.readAt}` ? S.kinds.value : null;
  const read = { ...b, text };
  return found && known ? people.pieces(ctx, read, result.record === b ? { ...result, record: read } : result, found, known) : null;
}
// The guesses: new pages for the names no page has yet, or [].
async function ask(ctx, b, result) {
  if (!result || (result.record !== b && !result.assume)) return [];
  const [found, known] = await Promise.all([namesIn(ctx, b), kinds(ctx)]);
  // The names as the rules read the words (links as names): the offsets are into that text.
  const read = { ...b, text: Flow.meaning.textOf(ctx, b.text) };
  return people.pieces(ctx, read, result.record === b ? { ...result, record: read } : result, found, known);
}

Flow.peopleAsk = { ready, kinds, namesIn, had, ask, forget: () => { S.kinds = null; S.answers.clear(); S.ready = null; } };
})();
