/* The plugin's shared state: Logseq's window, the settings, and the context (the graph as the core reads it), read in the
   background and kept fresh. Everything that draws asks here. */
(function () {
const Flow = (window.Flow ||= {});
const { db } = Flow;

const { host, notify } = window.PluginDoor;
/* Predictive's base (plugin.js, Door.base): a warning written once, its settings read with their defaults, its stylesheets sent
   only when changed, its listeners on Logseq's window and its clean-up steps, taken off and run when the plugin stops.
   Settings: the schema (settings.js) holds the defaults; the plugin's own memory (what was taken, what was tuned) lives in keys
   the schema does not show. */
const base = window.PluginDoor.base('predictive', { prefix: 'Flow: ', schema: () => Flow.settingsSchema });
const { warnOnce, setting, listen, onStop } = base;
const remember = (key, value) => logseq.updateSettings({ [key]: value });

const state = { ctx: null, loading: null, graph: '', generation: 0, pages: { at: 0, list: null, loading: null } };
const REFRESH = 300000, PAGES_EVERY = 30000;
const cleanGraph = g => String(g?.name || '').replace(/^logseq_db_/, '');
async function graphName() { try { state.graph = cleanGraph(await db.currentGraph()); } catch (error) { state.graph = ''; } return state.graph; }
async function allowed() {
  if (!setting('proposals')) return false;
  const skip = String(setting('proposalsSkipGraphs') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return !skip.includes((await graphName()).toLowerCase());
}

// How readily a tag is suggested: how near the nearest earlier line must be, and how far ahead of the others the leading tag. Measured on 45
// hand-written lines the graph had not seen the twin of (README): careful 2 right of 45, balanced 9, eager 14, one wrong tag in each of the last two.
// The vote's limits and the profile's gap (core/engine.js DEFAULT_LIMITS) for each eagerness; README, "How readily a tag is suggested".
// modelTag: whether Apple's model may pencil a tag where the rules found none (Option-T asks it whatever the setting).
const TAG_EAGERNESS = { careful: { tagNearLeast: .6, tagLead: .7, tagGap: 4, modelTag: false }, balanced: { tagNearLeast: .3, tagLead: .7, tagGap: 3, modelTag: true }, eager: { tagNearLeast: .25, tagLead: .6, tagGap: 2, modelTag: true } };
const tagLimits = () => TAG_EAGERNESS[setting('tagEagerness')] || TAG_EAGERNESS.balanced;
// What was tuned for the graph (properties), then the eagerness the setting asks for (tags): the tuner judges tags on the graph's own lines,
// which have twins in them, so it is too strict for lines written afresh.
const limitsFor = graph => ({ ...((logseq.settings?.tuned || {})[graph] || {}), ...tagLimits() });
const localeNow = () => (Flow.locales || {})[setting('locale')] || Flow.dates.en;

/* The context, read once and then kept: returned at once when there is one (read again in the background when it is five
   minutes old), so a key is never made to wait for the graph. wait false: null while the first reading is not done. */
async function context({ wait = true } = {}) {
  const old = state.ctx && Date.now() - state.ctx.readAt > REFRESH;
  if (!state.ctx || old) {
    if (!state.loading) {
      // A reading started in one graph never lands as another's: another graph opened meanwhile, it is dropped and read afresh.
      const generation = state.generation;
      const job = (async () => {
        const graph = await graphName();
        const ctx = await db.readContext({ limits: limitsFor(graph), locale: localeNow(), linkRates: setting('linkSuggest') && setting('linkSuggestLearn') });
        if (generation !== state.generation) return context({ wait });
        ctx.graph = graph;
        state.ctx = ctx;
        Flow.meaningAsk?.teach(ctx).catch(() => {});   // the matcher learns the graph in the background (logseq/meaning.js)
        return ctx;
      })().catch(error => { warnOnce('the graph could not be read', error); return state.ctx; }).finally(() => { if (state.loading === job) state.loading = null; });
      state.loading = job;
    }
  }
  const ctx = state.ctx || (wait ? await state.loading : null);
  if (ctx) ctx.dateFormat = await dateFormat();
  return ctx;
}
/* The date format Logseq names new journal days in (Settings, Editor), so a day is pencilled as it will be written. Read
   again when it is a second old: a change there shows at the next pause in typing, with nothing to reload. */
const dateFormat = () => window.PluginDoor.dates.format();   // the door's date service (plugin.js)
const forget = () => { state.generation++; state.ctx = null; Flow.meaningAsk?.forget(); Flow.peopleAsk?.forget(); state.loading = null; state.pages.list = null; state.pages.at = 0; state.pages.loading = null; learning.ids.clear(); clearTimeout(learning.timer); db.forget(); };

// The page list for suggested links, read again at most every 30 s, so a page made a moment ago is offered soon.
async function pages() {
  const p = state.pages;
  if (p.list && Date.now() - p.at < PAGES_EVERY) return p.list;
  if (!p.loading) {
    const generation = state.generation;
    const job = db.loadPages().then(list => { if (generation !== state.generation) return pages(); p.list = list; p.at = Date.now(); return list; })
      .catch(error => { warnOnce('the pages could not be read', error); return p.list || []; }).finally(() => { if (p.loading === job) p.loading = null; });
    p.loading = job;
  }
  return p.list || p.loading;
}

// The pages linked in the words, read fresh: a page made or tagged a moment ago ([[Dr. New]] with #Doctor) is otherwise
// unknown to the context. Returns the context itself when nothing changed.
async function freshLinks(ctx, text) {
  const names = [...new Set([...String(text || '').matchAll(Flow.text.LINK)].map(([, key]) => key.trim().toLowerCase()).filter(key => key && !Flow.text.UUID.test(key)))];
  if (!names.length) return ctx;
  const fresh = [];
  for (const page of await db.pagesNamed(names)) {
    const known = ctx.byId.get(page.id);
    if (known && known.title === page.title && Flow.text.sameIds(known.tags.map(t => t.id), page.tags.map(t => t.id))) continue;
    fresh.push({ ...known, ...page });
  }
  if (!fresh.length) return ctx;
  const byKey = new Map(ctx.byKey), byId = new Map(ctx.byId);
  for (const page of fresh) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  return { ...ctx, byKey, byId };
}

// What changed in the graph is learned a moment later, so a value filled in counts for the next bullet at once.
const learning = { ids: new Set(), timer: 0 };
function learnSoon(blocks) {
  for (const block of blocks || []) { const id = block?.id ?? db.idOf(block); if (Number.isSafeInteger(id) && id > 0) learning.ids.add(id); }
  if (!learning.ids.size || !state.ctx) return;
  clearTimeout(learning.timer);
  learning.timer = setTimeout(() => {
    const ids = [...learning.ids]; learning.ids.clear();
    db.learnNodes(state.ctx, ids).catch(error => warnOnce('a changed node could not be learned', error));
  }, 400);
}

// The floating things of Logseq itself (a list, a menu, a picker, a window) have the keys while they are open.
// Asked of the door's screen door (plugin.js); a pop-up of the plugin's own counts too.
const popupOpen = (doc = host()) => window.PluginDoor.screen.popupOpen(null, doc, { own: true });
// A bullet's own box only: never a page's title or a property's value.
// A table's cell being written (.ls-table-block, the editor Logseq opens over a table row) is a plain edit: nothing is pencilled in
// there (the owner, 8 November 2026: "remove the suggestion row in the edit", a screenshot of a Name cell being written).
const NOT_A_BULLET = '.ls-page-title, .page-title, h1.title, .property-pair, .bottom-property-pill, .property-block-container, .property-value-container, .ls-table-block';
const isBlockBox = node => node?.tagName === 'TEXTAREA' && !!node.closest('.ls-block') && !node.closest(NOT_A_BULLET);
const uuidOf = box => box?.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
// Logseq's own lists while writing ([[ pages, / commands, #tags): they have the keys.
const editorPopupOpen = (doc = host()) => window.PluginDoor.screen.editorPopupOpen(doc);

// A key as the settings spell it ("mod+alt+enter"; mod is Cmd on a Mac and Ctrl elsewhere): does the event match? Empty: never.
// The door's, one way for the whole plugin.
const keyMatches = (event, spec) => window.PluginDoor.keys.matches(event, spec);

Flow.app = { watch: base.watch, sendStyle: base.style, sheet: base.sheet, stopAll: base.stop, tagLimits, host, warnOnce, notify, setting, remember, state, graphName, allowed, context, forget, pages, freshLinks, learnSoon, popupOpen, editorPopupOpen, keyMatches, isBlockBox, uuidOf, listen, onStop, limitsFor };
})();
