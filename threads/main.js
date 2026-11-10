/* Threads' engine: the parts (parts/*.js) register on window.Threads.parts as they load; this file, loaded last, joins their
   settings, publishes the core they share (window.Threads.core) and starts them in three steps when the plugin's door says so.
   The helpers every part shares (the Logseq document, warnings, the clean-up list, the kit) live in parts/shared.js; its header
   is the contract between the files. This file runs after the parts are loaded and takes them in useShared(). The screen
   watcher is the door's (plugin.js, Door.watch) since 5 November 2026; the React mount, the command register and the moving
   of old defaults went the same day, since no part used them.
   Logseq keeps only the most recent beforeunload callback a plugin registers, so every part keeps its own clean-up list and
   the module's stop runs them all. */
let host, notify, warnOnce, onUnload, runUnloadTasks, setting, perf, base;
function useShared() {
  const shared = window.Threads?.shared;
  if (!shared) throw new Error('parts/shared.js did not load');
  ({ host, notify, perf } = shared);
  // The core's base (plugin.js, Door.base). Its stop takes Threads' screen updaters off the door's watcher first, so nothing
  // re-applies while the steps undo their changes; every stylesheet it sends is counted for the troubleshooting tools.
  base = window.PluginDoor.base('threads', { prefix: 'Threads: ', styled: (key, style, changed) => perf.style(key, style, changed) });
  warnOnce = base.warnOnce; onUnload = base.onStop; runUnloadTasks = () => { screen.count = 0; return base.stop(); };
}

/* Threads' screen updaters on the door's one watcher. An early one (watchDomEarly) runs at once on every change, before the
   screen is drawn, given the changes; it must be quick. Each is timed for the troubleshooting tools; the base takes them off at
   Threads' stop, so only Threads' go. A failing one is retired by the door after five errors. */
const screen = { count: 0 };
function watchDomEarly(update) {
  const timed = (doc, records) => { perf.seen('screen watcher', records); perf.time(update.name, () => update(doc, records)); };
  base.watch(timed, { early: true });
  screen.count++;
}
const addsElements = records => window.PluginDoor.addsElements(records);

/* The plugin's hooks live in Logseq's window, so they outlive the plugin's own frame. If an earlier copy was removed without
   its clean-up finishing (an error, or Logseq's ten-second limit), they would keep running beside this copy. Each copy
   therefore leaves its clean-up where the next one can find it (the base's takeOver, plugin.js), and a new copy
   runs it and removes anything still left on screen (sweepEarlierCopy). */
const STOP_KEY = '__threadsStop';
// Each part declares what it may leave on screen in its lifecycle (leaves); the door sweeps it all.
const sweepEarlierCopy = doc => window.PluginDoor.sweep('threads', doc);

// Logseq ignores an empty stylesheet, which would leave the previous rules in place. A comment
// counts as content, so sending one is how a stylesheet is cleared.
const orNoRules = style => style.trim() ? style : '/* no rules */';

/* Database queries. Datascript with Logseq's own idents (:logseq.class/Tag, :block/title...), as
   the plugin SDK's DB guides do. Lists of ids are written into the query text, so only whole
   numbers and well-formed uuids are let in. The helpers are the door's (plugin.js); dsQuery gives a query's rows, or [] for none. */
const { UUID, isEntityId, idsIn, uuidsIn, query: dsQuery } = window.PluginDoor;

/* Self-check after a Logseq update. Once a page has settled, a few pairs are compared (screenChecks, from
   parts/model.js: what a drawn page must hold): when the page plainly has a thing (blocks, a title,
   references) but the part the plugin finds inside it is missing, Logseq has most likely renamed that
   part, and the features listed beside it have quietly stopped. One note in the app per problem per
   session. Nothing is switched off: a feature that cannot find its part already draws nothing. A Logseq
   version other than the one the model was checked with (CHECKED_WITH) gets one note per version. */
const selfCheck = { timer: 0, noted: new Set() };
// Looks twice, a few seconds apart, so a page caught half-drawn does not count.
function scheduleSelfCheck() {
  clearTimeout(selfCheck.timer);
  selfCheck.timer = setTimeout(() => runSelfCheck(true), 4000);
}
function runSelfCheck(first) {
  const doc = host();
  const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 0; } };
  const missing = provided.screenChecks().filter(([what, has, needs, , min]) => !selfCheck.noted.has(what) && count(has) >= min && count(needs) === 0);
  if (!missing.length) return;
  if (first) { selfCheck.timer = setTimeout(() => runSelfCheck(false), 3000); return; }
  for (const [what, has, needs] of missing) {
    selfCheck.noted.add(what);
    warnOnce(`self-check: ${what} not found (the page has ${has}, but no ${needs})`);
  }
  notify(`Part of Threads may have stopped, probably after a Logseq update: ${missing.map(([, , , stops]) => stops).join('; ')}. For details, run “Check what the plugin finds on this page”.`, 'warning');
}
async function versionNotice() {
  let version = '';
  try { version = (await logseq.App.getInfo('version')) || ''; } catch (error) { return; }
  if (!version || version === provided.CHECKED_WITH || logseq.settings?.selfCheckSeenVersion === version) return;
  logseq.updateSettings({ selfCheckSeenVersion: version });
  notify(`You are on Logseq ${version}; Threads was last checked with ${provided.CHECKED_WITH}. If something looks off, run “Check what the plugin finds on this page”.`, 'warning');
}
function startSelfCheck() {
  versionNotice();
  scheduleSelfCheck();
  onUnload(logseq.App.onRouteChanged(scheduleSelfCheck));
  onUnload(() => clearTimeout(selfCheck.timer));
}
// Stylesheets that depend on settings are sent again only when their text has changed (the base's style): every send
// makes Logseq work out the look of the whole page again.
const sendStyle = (key, style) => { base.style(key, style); };
/* The settings are the parts': each declares its own (schema), with the heading of its section saying which
   group of the settings window it sits in (group, rank). setting(key), from shared.js, reads the joined list:
   a setting's current value, or its default when unset or of the wrong type. A setting that only takes effect
   when the plugin starts says so in its description, or its heading does for the whole section; the core
   finds them there (reloadOnly) to say "reload" when one changes. */
const RELOAD_RE = /after you reload/i, AT_ONCE_RE = /right away|at once/i;
function reloadOnly(schema) {
  const keys = []; let sectionReload = false;
  for (const item of schema) {
    if (item.type === 'heading') { sectionReload = RELOAD_RE.test(item.description || ''); continue; }
    const text = item.description || '';
    if (RELOAD_RE.test(text) || (sectionReload && !AT_ONCE_RE.test(text))) keys.push(item.key);
  }
  return keys;
}
let RELOAD_SETTINGS = [];
let schemaAll = []; // every part's settings, joined (core.settingsSchema)

/* After the database changes, everything the plugin knows from it is looked up again in one round:
   as soon as the changes pause, or every few seconds while they keep coming (typing). Seven
   separate timers used to do this, finishing at three different moments after each edit. */
const dbWork = { timer: 0, since: 0, slowTimer: 0, slowAt: 0 };
// Lists that cover the whole graph (every linked block, every property value,
// page titles, journals, property names) change rarely; while you edit, they are read again at most
// this often, plus once more after you stop. Looking at a new page reads them fresh only when something
// changed since they were read (0.4.150): read on every page change they held up the page's own extras.
const GRAPH_WIDE_EVERY = 30000;
const graphCache = new Map();
function graphWide(name, load) {
  const hit = graphCache.get(name);
  if (hit && Date.now() - hit.at < GRAPH_WIDE_EVERY) return hit.promise;
  const promise = Promise.resolve().then(load);
  graphCache.set(name, { at: Date.now(), promise });
  promise.catch(() => { if (graphCache.get(name)?.promise === promise) graphCache.delete(name); });
  return promise;
}
const DB_PAUSE = 800, DB_LONGEST = 2500;
function scheduleDbWork() {
  const now = Date.now();
  if (!dbWork.since) dbWork.since = now;
  clearTimeout(dbWork.timer);
  dbWork.timer = setTimeout(runDbWork, Math.max(0, Math.min(DB_PAUSE, dbWork.since + DB_LONGEST - now)));
}
function runDbWork() {
  dbWork.since = 0;
  perf.add('database round (calls only)', 0);
  // A job's look-up still waiting from a page change is not needed too: each job says what to cancel first.
  for (const job of dbJobs) if (job.before) { try { job.before(); } catch (error) { warnOnce(`${job.name} could not cancel its earlier look-up`, error); } }
  const failed = error => warnOnce('a look-up after a change failed', error);
  const run = jobs => { for (const job of jobs) { try { Promise.resolve(job.fn()).catch(failed); } catch (error) { failed(error); } } };
  // About the page on screen: after every round.
  const pageJobs = dbJobs.filter(job => job.scope === 'page');
  // Whole-graph lists: now if they are due; otherwise one full round when they fall due.
  const fullRound = () => {
    clearTimeout(dbWork.slowTimer);
    dbWork.slowTimer = 0;
    dbWork.slowAt = Date.now();
    graphCache.clear();
    graphCache.changed = false;
    run([...dbJobs.filter(job => job.scope === 'graph'), ...pageJobs]);
  };
  const wait = dbWork.slowAt + GRAPH_WIDE_EVERY - Date.now();
  if (wait <= 0) return fullRound();
  run(pageJobs);
  if (!dbWork.slowTimer) dbWork.slowTimer = setTimeout(fullRound, wait);
}
/* The core, as the other files see it: window.Threads.core, published by main() before any part starts. It holds the
   core's own tools (the screen updaters, the database round, stylesheets, settings, the query helpers) and a registry for
   the parts: each part gives its functions and state to the core by name (core.provide, in its provide() step) and takes
   what it needs from core.provided in its start() step, after every part has provided, so the order of the parts does not
   matter. Database look-ups register with core.onDbRound(name, fn, { scope, before }): scope 'page' (the default) runs
   after every round, 'graph' only when the whole-graph lists fall due; before() is run at the start of every round to
   cancel a look-up of the job's own still waiting. runDbWork knows no job by name. */
/* The hooks the parts register with the core (onPageChange, onDatabaseChange, onSettingsChange, onGraphChange): the core
   listens to Logseq once, does its own housekeeping first (its caches), then runs each part's function in the order
   registered, one failing not stopping the next. */
const hooks = { page: [], database: [], settings: [], graph: [] };
const runHooks = (list, what, ...args) => { for (const fn of list) { try { fn(...args); } catch (error) { warnOnce(`a part's ${what} step failed (${fn.name || 'unnamed'})`, error); } } };
const provided = {}; // what the parts give the core and each other, by name
const dbJobs = [];   // database-round jobs, in the order the parts registered them (core.onDbRound)
function publishCore() {
  window.Threads.core = {
    host, setting, notify, graphWide, scheduleDbWork, sendStyle, orNoRules, watchDomEarly, addsElements,
    screen: window.Threads.shared.screen,
    // The settings as the settings window reads and writes them (0.4.317): the values now, the joined schema, a save,
    // Logseq's own settings page, a reload of this plugin, its version.
    settingsNow: () => logseq.settings || {}, settingsSchema: () => schemaAll, saveSettings: patch => logseq.updateSettings(patch),
    openLogseqSettings: () => logseq.showSettingsUI(), pluginVersion: () => logseq.baseInfo?.version || '',
    reloadPlugin: () => { const win = host().defaultView, id = logseq.baseInfo?.id || 'logseq-plugin'; win.setTimeout(() => win.LSPluginCore?.reload(id), 0); },
    UUID, isEntityId, idsIn, uuidsIn, dsQuery,
    provided, provide: things => Object.assign(provided, things),
    onDbRound: (name, fn, { scope = 'page', before } = {}) => { dbJobs.push({ name, fn, scope, before }); },
    onPageChange: fn => hooks.page.push(fn), onDatabaseChange: fn => hooks.database.push(fn), onSettingsChange: fn => hooks.settings.push(fn),
    onGraphChange: fn => hooks.graph.push(fn), // another graph opened (0.4.315)
    // A hidden door for the stress tests (2026-10-23, tools/app-stress.js): what this copy has set going, and when it
    // started, so twenty reloads or sixty pages can be checked to leave one of everything and nothing growing.
    counts: () => ({ startedAt, cleanUps: window.Threads.shared.lifeCounts(), watchers: base.watching(),
      hooks: Object.fromEntries(Object.entries(hooks).map(([k, list]) => [k, list.length])), dbJobs: dbJobs.length, styles: base.styles(),
      popups: window.Threads.shared.popups.size, undos: window.Threads.shared.undo.size }),
  };
}
// THE screen door lives in parts/shared.js (layer 1's plumbing, 0.4.315, so the pretend windows of the tests have it too); the core publishes it.
let startedAt = 0; // when this copy started (the counts' door: a reload that took effect has a new one)
function main() {
  startedAt = Date.now();
  // Installed from GitHub without the "effect" box ticked, Logseq keeps the plugin in a sealed frame on another
  // address (lsp://logseq.io), where Logseq's own page cannot be reached and nothing of the plugin can draw (seen
  // 0.4.282 on the owner's other computer: no rows, no map, no settings item). Say so once, instead of failing part by part.
  try { host(); } catch (error) {
    logseq.UI.showMsg('Threads cannot reach Logseq\'s page from here. Uninstall it, then install it again with the "effect" box ticked (Install plugin from GitHub release).', 'error', { timeout: 0 });
    return;
  }
  // The clean-up (runUnloadTasks) is run by the plugin's own beforeunload (main.js at the root), as this module's stop.
  base.takeOver(STOP_KEY, sweepEarlierCopy);
  publishCore();
  base.style('threads-kit', window.Threads.shared.kitCss); // the kit's look, before any part (0.4.169, the kit since 0.4.311)
  // THE Undo (parts/shared.js, 0.4.258): its arrows belong to the page they were made on, and go with the plugin.
  onUnload(logseq.App.onRouteChanged(() => window.Threads.shared.undo.clear()));
  onUnload(() => window.Threads.shared.undo.stop());
  onUnload(() => window.Threads.shared.popups.closeAll()); // no pop-up outlives the plugin (0.4.316)
  // The kit follows the mouse buttons itself, so a right-click menu waits for the release in an installed copy too (0.4.360).
  window.Threads.shared.popups.followButtons(host().defaultView);
  onUnload(() => window.Threads.shared.popups.stopFollowing());
  // The parts (parts/*.js, loaded before this file). Each keeps its own clean-up, run from here; one
  // that fails to start leaves the rest of the plugin working. Three steps, each over every part before the
  // next: provide() gives the core the part's functions and state; start() takes the others' things and
  // registers with the core; ready() starts what draws on screen, once every part has started. The core
  // starts no part by name. With the setting Foundation only (0.4.167), only the parts marked foundation run:
  // the model, the troubleshooting tools and the settings window; the others stay loaded (their settings
  // keep their place) but are never started.
  const foundationOnly = setting('foundationOnly') === true;
  const running = foundationOnly ? plugInParts.filter(part => part.foundation) : plugInParts;
  if (foundationOnly) notify('Threads is running only its foundation (Foundation only, under Troubleshooting in its settings). Turn it off and reload the plugin to get everything back.', 'warning');
  const failed = new Set();
  const step = (part, what, fn) => { try { fn(); } catch (error) { warnOnce(`the ${part.name} part could not ${what}`, error); failed.add(part.says || part.name); } };
  for (const part of running) step(part, 'provide its functions', () => part.provide?.(window.Threads.core));
  for (const part of running) { step(part, 'start', () => part.start()); onUnload(part.stop); }
  for (const part of running) step(part, 'get ready', () => part.ready?.());
  if (failed.size) notify(`Part of Threads could not start: ${[...failed].join(', ')}. The rest runs.`, 'warning');
  startSelfCheck();

  // Every hook returns an "off" function; each is called when the plugin unloads. The core listens
  // once and runs what the parts registered (hooks) after its own housekeeping.
  onUnload(logseq.App.onRouteChanged(() => {
    if (graphCache.changed) { graphCache.clear(); graphCache.changed = false; } // a new page reads changed whole-graph lists fresh
    runHooks(hooks.page, 'page change');
  }));
  // Edits fire this constantly while typing, so the database round waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged((change = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    graphCache.changed = true;
    runHooks(hooks.database, 'database change', change);
    scheduleDbWork();
  }));
  onUnload(logseq.App.onCurrentGraphChanged(() => { graphCache.clear(); window.Threads.shared.undo.clear(); runHooks(hooks.graph, 'graph change'); })); // another graph has other lists, and an arrow would act on what is not there
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before) || !window.PluginDoor.settingChanged(schemaAll.map(item => item.key), now, before)) return;
    runHooks(hooks.settings, 'settings change', now, before);
    // Logseq rewrites every setting when the plugin starts, so a setting with no earlier value is a
    // default being filled in (first install, or a new setting after an update), not a change.
    if (RELOAD_SETTINGS.some(key => before && key in before && now?.[key] !== before[key])) notify('Reload the plugin to apply this change', 'info');
  }));
}
/* Every part lives in parts/*.js and adds itself to window.Threads.parts. The plugin's files.js loads them, in order,
   before this file: shared.js first (the other parts read window.Threads.shared as they load), model.js second (the
   Logseq model, which every part reads the graph through, core.provided), then diagnostics, two-way,
   proposals. The parts' settings, in that order, each under its heading, go to the plugin
   with this module's registration, so they hold their defaults when main runs. */
let plugInParts = [];
useShared();
plugInParts = window.Threads.parts || [];
schemaAll = plugInParts.flatMap(part => part.schema);
setting = window.PluginDoor.settingReader(schemaAll);
RELOAD_SETTINGS = reloadOnly(schemaAll);
window.PluginDoor.register({
  key: 'threads', title: 'Threads', about: 'On a page, everything that points at it, named by the property it came through, to follow and dig along.',
  schema: schemaAll, start: main, stop: () => runUnloadTasks(),
});
