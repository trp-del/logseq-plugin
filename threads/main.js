/* Personal Logseq DB refinements. All commands preserve their source blocks. */
/* The helpers every part shares (the Logseq document, warnings, the clean-up list, dialog boxes…)
   live in parts/shared.js; its header is the contract between the files. This file runs before the
   parts are loaded, so it takes them in useShared() once they have loaded, before Logseq is given the
   settings and before main() runs. Nothing above main() calls them while this file loads.
   Logseq keeps only the most recent beforeunload callback a plugin registers, so every part of the
   plugin keeps its own clean-up list and main() registers one callback that runs them all. */
let host, notify, warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed, setting, perf;
function useShared() {
  const shared = window.refinementShared;
  if (!shared) throw new Error('parts/shared.js did not load');
  ({ host, notify, perf } = shared);
  // The clean-up stops the screen watcher first, so nothing re-applies while the steps undo their
  // changes; a new copy runs the earlier copy's clean-up and sweeps what it left on screen.
  ({ warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed } = shared.lifecycle({ prefix: 'Threads: ', stopKey: STOP_KEY, before: stopWatchingDom, sweep: sweepEarlierCopy }));
}

/* One watcher for Logseq's screen, with two kinds of update function. One part failing does not
   stop the others.
   - Early ones (watchDomEarly) run at once on every change, before the screen is drawn, so that
     Logseq's own look never shows first. They are given the changes and must be quick.
   - The others (watchDom) run once in the next frame, so many changes at once cost one pass.
   The watcher does not react to what these functions change themselves: what the early ones
   change is set aside, and what the later pass changes is shown to the early ones once. */
const domWatch = { updaters: new Set(), early: [], observer: null, frame: 0, win: null, doc: null };
function runEarly(records) {
  for (const fn of [...domWatch.early]) {
    try { perf.time(fn.name, () => fn(domWatch.doc, records)); } catch (error) { updaterFailed(fn, error, domWatch.early); }
  }
  domWatch.observer?.takeRecords();
}
function ensureDomWatch() {
  if (domWatch.observer) return domWatch.doc;
  const doc = host(), win = doc.defaultView;
  domWatch.doc = doc;
  domWatch.win = win;
  domWatch.observer = new win.MutationObserver(records => {
    perf.seen('screen watcher', records);
    runEarly(records);
    // A change of class or id alone (pointing, selecting) needs no later pass.
    if (domWatch.frame || !records.some(record => record.type !== 'attributes')) return;
    const timing = perf.frameState();
    domWatch.frame = win.requestAnimationFrame(() => {
      domWatch.frame = 0;
      perf.pass(timing);
      for (const fn of [...domWatch.updaters]) {
        try { perf.time(fn.name, () => fn(doc)); } catch (error) { updaterFailed(fn, error, domWatch.updaters); }
      }
      perf.passDone();
      const own = domWatch.observer?.takeRecords() || [];
      if (own.length) runEarly(own);
    });
  });
  domWatch.observer.observe(doc.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['data-ref', 'data-uuid', 'class', 'blockid', 'data-hl-type'] });
  return doc;
}
function watchDom(update) {
  const doc = ensureDomWatch();
  domWatch.updaters.add(update);
  update(doc);
}
function watchDomEarly(update) {
  ensureDomWatch();
  domWatch.early.push(update);
}
const addsElements = records => records.some(record => record.type === 'childList');
function stopWatchingDom() {
  domWatch.observer?.disconnect();
  if (domWatch.frame) domWatch.win?.cancelAnimationFrame(domWatch.frame);
  domWatch.observer = null;
  domWatch.frame = 0;
  domWatch.updaters.clear();
  domWatch.early.length = 0;
}

/* The plugin's watchers live in Logseq's window, so they outlive the plugin's own frame. If an
   earlier copy was removed without its clean-up finishing (an error, or Logseq's ten-second limit),
   they would keep running beside this copy. Each copy therefore leaves its clean-up where the next
   one can find it (takeOverFromEarlierCopy, from shared.js), and a new copy runs it and removes
   anything still left on screen (sweepEarlierCopy). */
const STOP_KEY = '__dbRefinementsStop';
// Each part declares what it may leave on screen in its lifecycle (leaves); shared.js sweeps it all.
const sweepEarlierCopy = doc => window.refinementShared.sweepLeftovers(doc);

// Logseq ignores an empty stylesheet, which would leave the previous rules in place. A comment
// counts as content, so sending one is how a stylesheet is cleared.
const orNoRules = style => style.trim() ? style : '/* no rules */';

/* Database queries. Datascript with Logseq's own idents (:logseq.class/Tag, :block/title...), as
   the plugin SDK's DB guides do. Lists of ids are written into the query text, so only whole
   numbers and well-formed uuids are let in. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isEntityId = id => Number.isSafeInteger(id) && id > 0;
const idsIn = (variable, ids) => `[(identity [${[...new Set(ids)].filter(isEntityId).join(' ')}]) [${variable} ...]]`;
const uuidsIn = (variable, uuids) => `[(identity [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
// Rows of a query, or [] when it returns nothing.
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};

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
// Stylesheets that depend on settings are sent again only when their text has changed: every send
// makes Logseq work out the look of the whole page again.
const sentStyles = new Map();
function sendStyle(key, style) {
  const changed = sentStyles.get(key) !== style;
  perf.style(key, style, changed);
  if (!changed) return;
  sentStyles.set(key, style);
  logseq.provideStyle({ key, style: orNoRules(style) });
}
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
/* The core, as the other files see it: window.refinementCore, published by main() before any part
   starts. It holds the core's own tools (the screen watcher, the database round, stylesheets, settings,
   the query helpers) and a registry for the area parts (pages.js, links.js, … in step 7 of the
   cleanup): each part gives its functions and state to the core by name (core.provide, in its provide()
   step) and takes what it needs from core.provided in its start() step, after every part has provided,
   so the order of the parts does not matter. Database look-ups register with
   core.onDbRound(name, fn, { scope, before }): scope 'page' (the default) runs after every round, 'graph'
   only when the whole-graph lists fall due; before() is run at the start of every round to cancel a
   look-up of the job's own still waiting. runDbWork knows no job by name (one database round, GUIDE.md). */
/* The hooks the parts register with the core (onPageChange, onDatabaseChange, onSettingsChange): the core
   listens to Logseq once, does its own housekeeping first (its caches), then runs each part's function
   in the order registered, one failing not stopping the next. */
const hooks = { page: [], database: [], settings: [], graph: [] };
const runHooks = (list, what, ...args) => { for (const fn of list) { try { fn(...args); } catch (error) { warnOnce(`a part's ${what} step failed (${fn.name || 'unnamed'})`, error); } } };
const provided = {}; // what the area parts give the core and each other, by name
const dbJobs = [];   // database-round jobs, in the order the parts registered them (core.onDbRound)
function publishCore() {
  window.refinementCore = {
    host, setting, notify, graphWide, scheduleDbWork, sendStyle, orNoRules, watchDom, watchDomEarly, addsElements, ensureDomWatch,
    screen: window.refinementShared.screen, commands: commandList, mountView,
    // The settings as the settings window reads and writes them (0.4.317): the values now, the joined schema, a save,
    // Logseq's own settings page, a reload of this plugin, its version.
    settingsNow: () => logseq.settings || {}, settingsSchema: () => schemaAll, saveSettings: patch => logseq.updateSettings(patch),
    openLogseqSettings: () => logseq.showSettingsUI(), pluginVersion: () => logseq.baseInfo?.version || '',
    reloadPlugin: () => { const win = host().defaultView, id = logseq.baseInfo?.id || 'logseq-threads'; win.setTimeout(() => win.LSPluginCore?.reload(id), 0); },
    UUID, isEntityId, idsIn, uuidsIn, dsQuery,
    provided, provide: things => Object.assign(provided, things),
    onDbRound: (name, fn, { scope = 'page', before } = {}) => { dbJobs.push({ name, fn, scope, before }); },
    onPageChange: fn => hooks.page.push(fn), onDatabaseChange: fn => hooks.database.push(fn), onSettingsChange: fn => hooks.settings.push(fn),
    onGraphChange: fn => hooks.graph.push(fn), // another graph opened (0.4.315)
    // A hidden door for the stress tests (2026-10-23, tools/app-stress.js): what this copy has set going, and when it
    // started, so twenty reloads or sixty pages can be checked to leave one of everything and nothing growing.
    counts: () => ({ startedAt, cleanUps: window.refinementShared.lifeCounts(), watchers: domWatch.updaters.size + domWatch.early.length,
      hooks: Object.fromEntries(Object.entries(hooks).map(([k, list]) => [k, list.length])), dbJobs: dbJobs.length, styles: sentStyles.size,
      popups: window.refinementShared.popups.size, undos: window.refinementShared.undo.size }),
  };
}
// A saved setting whose old default clashed with something (a part declares it in `moved`) is moved to the new
// default where the saved value is still the old one: Logseq saves every default, so a changed default alone would
// not reach an existing install.
function moveOldDefaults() {
  for (const part of plugInParts) for (const [key, [old, now]] of Object.entries(part.moved || {})) if (logseq.settings?.[key] === old) logseq.updateSettings({ [key]: now });
}
/* A whole view hosted by Logseq's own React (0.4.319, for the tag map): a page of its own (a route, #/<route>) and a
   panel in the right sidebar, both registered here so no part reaches Logseq's React itself. mountView({ key, route,
   sidebarKey, title, holderClass, make }): make(holder, mode) draws into the holder and returns { destroy }; the result
   says which of the two could be registered (page, sidebar) and opens them (openPage, openSidebar). */
function mountView({ key, route, sidebarKey, title, holderClass = '', make }) {
  const React = logseq.Experiments?.React;
  const hosted = { page: false, sidebar: false };
  const component = mode => function RefinementView() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      let view = null;
      try { view = make(holder, mode); } catch (error) { warnOnce(`the ${title} view could not be drawn`, error); }
      // Logseq titles a plugin's sidebar panel with its inner name.
      const heading = mode === 'sidebar' && holder.closest('.sidebar-item')?.querySelector('.page-title h3');
      if (heading) heading.textContent = title;
      return () => view?.destroy?.();
    }, []);
    return React.createElement('div', { ref, className: `${holderClass} rf-holder-${mode}`.trim() });
  };
  if (!React?.createElement) warnOnce(`Logseq gives plugins no React here, so the ${title} view cannot be shown`);
  else {
    try { const Page = component('page'); logseq.Experiments.registerRouteRenderer(key, { name: key, path: route, render: () => React.createElement(Page) }); hosted.page = true; }
    catch (error) { warnOnce(`the ${title} page could not be added`, error); }
    try { const Side = component('sidebar'); logseq.Experiments.registerSidebarRenderer(sidebarKey, { title, render: () => React.createElement(Side) }); hosted.sidebar = true; }
    catch (error) { warnOnce(`the ${title} sidebar panel could not be added`, error); }
  }
  return {
    page: hosted.page, sidebar: hosted.sidebar,
    openPage: () => { host().defaultView.location.hash = '#' + route; },
    openSidebar: async () => { await logseq.Editor.openInRightSidebar('_sidebar.' + sidebarKey); await logseq.App.setRightSidebarVisible?.(true); },
  };
}
// THE screen door lives in parts/shared.js (layer 1's plumbing, 0.4.315, so the pretend windows of the tests have it too); the core publishes it.
/* THE command register (0.4.311, docs/LAYERS.md layer 1): every command of every part, with its name, its shortcut, its
   icon and where it shows. A part declares commands: [{ key, label, run, shortcut, binding, icon, places, title }]:
   shortcut names the setting that holds the keys (changed in the settings window; empty binds none), binding is a
   fixed set of keys when there is no setting; places is any of 'palette' (Logseq's command palette, with the keys as
   its keybinding; the default), 'toolbar' (a button in Logseq's toolbar with the icon), 'menu' (a bullet's right-click
   menu), 'keys' (the engine itself listens for the keys on Logseq's window, for commands that work inside a bullet
   being written, which Logseq's palette does not reach; run(event) returns true when it took the key). The settings
   window reads the register (core.commands()) for its shortcuts group. */
const commands = [];
const keyCommands = [];
const bindingOf = command => {
  let binding = command.shortcut ? String(setting(command.shortcut) || '').trim().toLowerCase() : String(command.binding || '').trim().toLowerCase();
  const moved = command.part?.moved?.[command.shortcut];
  if (binding && moved?.[0] === binding) binding = moved[1]; // the saved setting may not show the move yet
  return binding;
};
// Logseq's own spelling of a shortcut (mod+alt+l, alt+enter, mod+shift+up): mod is ⌘ on a Mac, Ctrl elsewhere.
const IS_MAC = /Mac/.test((typeof navigator !== 'undefined' && navigator.platform) || '');
const KEY_NAMES = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', ' ': 'space', escape: 'esc' };
function keyOf(event) {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const key = String(event.key || '').toLowerCase();
  return KEY_NAMES[key] || key;
}
function matchesBinding(event, binding) {
  if (!binding) return false;
  const parts = binding.split('+').map(p => p.trim()).filter(Boolean);
  const want = { mod: false, ctrl: false, alt: false, shift: false, meta: false };
  let key = '';
  for (const p of parts) { if (p in want) want[p] = true; else key = p === 'escape' ? 'esc' : p; }
  if (!key || keyOf(event) !== key) return false;
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const ctrl = IS_MAC ? event.ctrlKey : false;
  const meta = IS_MAC ? false : event.metaKey;
  return mod === want.mod && ctrl === want.ctrl && event.altKey === want.alt && event.shiftKey === want.shift && meta === want.meta;
}
function onCommandKey(event) {
  if (event.defaultPrevented) return;
  for (const command of keyCommands) {
    if (!matchesBinding(event, bindingOf(command))) continue;
    let took = false;
    try { took = command.run(event) === true; } catch (error) { warnOnce(`the command ${command.key} failed`, error); }
    if (took) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  }
}
function registerCommands(parts) {
  const model = {};
  for (const part of parts) for (const declared of part.commands || []) {
    const command = { places: declared.menu ? ['palette', 'menu'] : ['palette'], ...declared, part, partName: part.name };
    commands.push(command);
    const binding = bindingOf(command);
    const run = (...args) => { try { return command.run(...args); } catch (error) { warnOnce(`the command ${command.key} failed`, error); } };
    if (command.places.includes('palette')) logseq.App.registerCommandPalette({ key: command.key, label: command.label, ...(binding ? { keybinding: { binding } } : {}) }, run);
    if (command.places.includes('menu')) logseq.Editor.registerBlockContextMenuItem(command.label, run);
    if (command.places.includes('toolbar')) {
      const name = `rfCommand_${command.key.replace(/\W/g, '_')}`;
      model[name] = run;
      logseq.App.registerUIItem('toolbar', { key: `refinements-${command.key}`, template: `<a class="button rf-toolbar" data-on-click="${name}" title="${command.title || command.label}"><i class="ti ti-${command.icon || 'adjustments-horizontal'}"></i></a>` });
    }
    if (command.places.includes('keys')) keyCommands.push(command);
  }
  if (Object.keys(model).length) logseq.provideModel(model);
  if (keyCommands.length) {
    const win = host().defaultView;
    win.addEventListener('keydown', onCommandKey, true);
    onUnload(() => { win.removeEventListener('keydown', onCommandKey, true); keyCommands.length = 0; });
  }
}
// The register as the settings window reads it: every command with its words, keys, icon and places.
const commandList = () => commands.map(({ key, label, title, icon, shortcut, binding, places, partName }) => ({ key, label, title, icon, shortcut, binding: bindingOf({ shortcut, binding, part: commands.find(c => c.key === key)?.part }), fixed: !shortcut, places, part: partName }));
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
  moveOldDefaults();
  takeOverFromEarlierCopy();
  publishCore();
  logseq.provideStyle({ key: 'refinements-kit', style: window.refinementShared.kitCss }); // the kit's look, before any part (0.4.169, the kit since 0.4.311)
  // THE Undo (parts/shared.js, 0.4.258): its arrows belong to the page they were made on, and go with the plugin.
  onUnload(logseq.App.onRouteChanged(() => window.refinementShared.undo.clear()));
  onUnload(() => window.refinementShared.undo.stop());
  onUnload(() => window.refinementShared.popups.closeAll()); // no pop-up outlives the plugin (0.4.316)
  // The kit follows the mouse buttons itself, so a right-click menu waits for the release in an installed copy too (0.4.360).
  window.refinementShared.popups.followButtons(host().defaultView);
  onUnload(() => window.refinementShared.popups.stopFollowing());
  // The main view keeps room for its scroll bar (0.4.182), so a page growing past the window's height, or a list
  // unfolding, no longer moves everything 8px sideways as the bar comes and goes (seen in the owner's Logseq).
  // Off since 0.4.251; on 2026-10-23 the owner dropped it after looking (the Mac's scroll bars take no room), kept here
  // as the line it was:
  // logseq.provideStyle({ key: 'refinements-steady-scroll', style: '#main-content-container { scrollbar-gutter: stable; }' });
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
  for (const part of running) step(part, 'provide its functions', () => part.provide?.(window.refinementCore));
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
  onUnload(logseq.App.onCurrentGraphChanged(() => { graphCache.clear(); window.refinementShared.undo.clear(); runHooks(hooks.graph, 'graph change'); })); // another graph has other lists, and an arrow would act on what is not there
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before) || !window.PluginDoor.settingChanged(schemaAll.map(item => item.key), now, before)) return;
    runHooks(hooks.settings, 'settings change', now, before);
    // Logseq rewrites every setting when the plugin starts, so a setting with no earlier value is a
    // default being filled in (first install, or a new setting after an update), not a change.
    if (RELOAD_SETTINGS.some(key => before && key in before && now?.[key] !== before[key])) notify('Reload the plugin to apply this change', 'info');
  }));

  registerCommands(running);
}
/* Every part lives in parts/*.js and adds itself to window.refinementParts. The plugin's files.js loads them, in order,
   before this file: shared.js first (the other parts read window.refinementShared as they load), model.js second (the
   Logseq model, which every part reads the graph through, core.provided), then diagnostics, two-way,
   alike, shadow-rules. The parts' settings, in that order, each under its heading, go to the plugin
   with this module's registration, so they hold their defaults when main runs. */
let plugInParts = [];
useShared();
plugInParts = window.refinementParts || [];
schemaAll = plugInParts.flatMap(part => part.schema);
setting = window.refinementShared.settingReader(schemaAll);
RELOAD_SETTINGS = reloadOnly(schemaAll);
window.PluginDoor.register({
  key: 'threads', title: 'Threads', about: 'On a page, everything that points at it, named by the property it came through, to follow and dig along.',
  schema: schemaAll, start: main, stop: runUnloadTasks,
});
