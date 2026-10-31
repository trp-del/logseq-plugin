/* The context: everything the rules read about one graph, built once from plain data (the adapter in logseq/db.js reads
   Logseq; the tests build it from arrays). A context is cheap to hold and is read again every few minutes.

   buildContext({ schema, pages, aliases, userTagIds, entries, days, dated, limits, locale }) returns
   { schema, pages, byKey, byId, tagNames, aliases, knownTags, index, common, days, dated, limits, reader }; profileOf(ctx)
   gives the per-tag word profile (core/profile.js), built from the index when first asked for.

   entries are the graph's earlier lines, the only knowledge the engine has: { id, title, tags: [tagIds of yours],
   values: Map(propIdent -> [ids]) }, plain lines (no tag) with tags [] and no values. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { wordsOf, LINK, TAG, UUID } = need('text');
const engine = need('engine');
const dates = need('dates');
const profileLib = need('profile');

// All the words a text shows, a saved link ([[uuid]]) read as its page's title, tags left out (for the engine).
function shownWords(text, ctx) {
  const named = String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => ' ' + (UUID.test(key) ? ctx.byKey.get(key.toLowerCase())?.title || '' : key) + ' ');
  return new Set(wordsOf(named.replace(TAG, ' ')));
}
// The pages a saved title links ([[uuid]], or [[Name]] in the text box), as ids, for the engine's link tokens.
const linkIdsIn = (text, ctx) => [...new Set([...String(text || '').matchAll(LINK)].map(([, key]) => ctx.byKey.get(key.trim().toLowerCase())?.id).filter(id => id != null))];

// A word that fills too many lines to name anything ("today", "morning", "with"): read from the graph's own lines, so
// no list of words is needed in any language. Needs a few lines before it judges.
const COMMON_LEAST = 5, COMMON_SHARE = .08;

function historyEntry(ctx, raw) {
  const words = shownWords(raw.title, ctx);
  if (words.size < 2) return null;
  const tags = raw.tags || [];
  const values = new Map(raw.values || []);
  values.set('block/tags', tags.length ? tags : [0]);   // 0: a plain line, no tag (so plain lines vote "no tag")
  return { entry: { id: raw.id, title: raw.title, tokens: engine.tokensOf(words, linkIdsIn(raw.title, ctx), tags, ctx.limits), values }, words };
}

function buildContext({ schema, pages = [], aliases = [], userTagIds = [], entries = [], days = new Map(), dated = new Map(), limits = {}, locale = dates.en } = {}) {
  const byKey = new Map(), byId = new Map();
  for (const page of pages) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  const ctx = {
    schema, pages, byKey, byId, aliases, days, dated,
    // Tag names, longest first, for "#Symptom log" written without brackets.
    tagNames: pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length),
    knownTags: new Set(userTagIds),
    limits: { ...engine.DEFAULT_LIMITS, ...limits },
    reader: dates.makeReader(locale),
    index: null, common: new Set(), names: null, dayIds: null, profile: null,
  };
  const kept = [], df = new Map();
  for (const raw of entries) {
    const made = historyEntry(ctx, raw);
    if (!made) continue;
    kept.push(made.entry);
    for (const w of made.words) df.set(w, (df.get(w) || 0) + 1);
  }
  for (const [w, d] of df) if (d >= COMMON_LEAST && d / kept.length >= COMMON_SHARE) ctx.common.add(w);
  ctx.index = engine.buildIndex(kept);
  return ctx;
}

// One node learned at once. raw null (deleted, or tagged only with tags that are not yours) takes it out. The profile is
// built again when next asked for, so a line just tagged counts at once.
function learnEntry(ctx, id, raw) {
  if (!ctx?.index) return;
  const made = raw && historyEntry(ctx, { ...raw, id });
  engine.updateEntry(ctx.index, made ? made.entry : { id, title: '', tokens: [], values: new Map() });
  ctx.profile = null;
}

// The per-tag word profile of the graph's lines: pages (learned as lines too) are not bullets, so they make no class.
function profileOf(ctx) {
  if (!ctx?.index) return null;
  return ctx.profile ||= profileLib.buildProfile(ctx.index.entries, { isPage: e => ctx.byId.has(e.id), knownTags: ctx.knownTags, least: ctx.limits.profileLeast, alpha: ctx.limits.profileAlpha });
}

const api = { buildContext, learnEntry, profileOf, shownWords, linkIdsIn, historyEntry };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).context = api;
})();
