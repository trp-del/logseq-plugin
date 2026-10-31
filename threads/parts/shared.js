/* Loaded by main.js first, before the other parts. Kept in its own scope. */
(() => {
/* The plumbing of layer 1 that lives in the plugin's frame, and THE KIT (layer 2, docs/LAYERS.md section 3): the
   pieces every part draws with, each drawn once, with one stylesheet. This header is the contract between the files.

   WHAT THIS FILE PROVIDES, on window.refinementShared (and nothing else):

   Layer 1, talking to Logseq from the frame (the engine itself, the watcher, the database round, the command register
   and the screen door are in main.js; the graph in parts/model.js):
   - host()                      the Logseq document (the plugin runs in a frame inside Logseq's window).
   - notify(message, level)      THE notice: an in-app message at the top, through Logseq's own.
   - lifecycle({ prefix, stopKey, before, sweep, leaves })   one per part; returns
       warnOnce(message, ...details)   a console warning written once per session per message, with the
                                       part's prefix ('Threads: ', 'Threads (search): ', …);
       onUnload(task)                  adds a clean-up step (also takes the "off" function of a Logseq hook);
       runUnloadTasks()                runs the steps in reverse order (after `before`, if given) and
                                       returns a promise that waits for any step that finishes later;
       takeOverFromEarlierCopy()       runs the earlier copy's clean-up left under window[stopKey] in
                                       Logseq's window, leaves this one there, then calls sweep(doc);
       leaves: { elements, attributes, reset }   what the part may leave on screen if a copy is cut short:
                                       a selector list of its own elements, the names of the attributes it
                                       sets on Logseq's elements, and a reset(doc) for anything else. The
                                       core sweeps every part's leaves before it starts (sweepLeftovers).
   - sweepLeftovers(doc)          removes what every part declared in its leaves, part by part.
       updaterFailed(fn, error, list)  retires a screen updater that threw five times;
       listen(win, types, handler)     a capture-phase listener on Logseq's window, removed on unload.
   - take(core, names, warn)      the core's and the parts' things in one object, warning once (through the part's own
                                  warnOnce) for each name missing; every part's take() is this (0.4.294).
   - feature(name)                the bag the pieces of one feature share (the proposals, the tag map), by name.
   - screen                       THE screen door (core.screen): waitFor, press, typeInto, key, floating, item, sidebarItems,
                                  popupOpen, escapeMenus: the one way to work Logseq's own boxes.
   - openEntity(uuid, inSidebar)  opens a page or block by uuid, in the right sidebar when asked.
   - openPageNamed(name, inSidebar)   opens a page by its name the same way.
   - settingReader(schema)        returns setting(key): the saved value, or the schema's default when
                                  the saved value is missing or of another type.
   - graphNamedIn(list)           true when the open graph is named in the comma-separated list (an "Only in
                                  these graphs" setting); false while the list is empty.
   - perf                         measuring hooks (add, time, seen, style, frameState, pass, passDone,
                                  ownSettingsOnly): no-ops until the diagnostics part measures.
   - warnings                     every distinct warnOnce message of this session (message, first time, count).
   - lifeCounts()                 every part's clean-up steps waiting, by part: the stress tests' count of what a part has
                                  set going (listeners, hooks, timers given to onUnload); one that grows with use leaks.
   - MARK_CLASS, MARK_ATTR, isOwnMark(node), ownMarks(doc)   THE finder of the plugin's marks on Logseq's screen: every
                                  class and attribute prefix a part uses; the troubleshooting box, the boot test and the
                                  frame tests all count with it.

   Layer 2, the kit (0.4.311; the picture is docs/ELEMENTS.html and docs/VIEWS.html, the words docs/LAYERS.md). A part
   draws nothing of its own: it uses these and adds only its own layout. A new kind of thing goes in here first.
   - kitCss                       THE stylesheet: the greys, the pop-up, the dialog, the three buttons, the field,
                                  the tick box, the words for chips, the tag, the kind icons, the picking bar, the
                                  hover card, the Undo arrow, the quiet line and the help paragraph. Sent by main.js
                                  before any part. Colours: Logseq's --popover pair and the text colour; the four
                                  greys mixed from currentColor (quiet .7, faint .5, hairline 12%, line 26%, wash 7%).
   - el(doc, tag, props, ...children)   THE element builder: class, html (parsed), a function is a listener, true
                                  is an empty attribute, null and false are skipped.
   - esc(text)                    THE text escaper for innerHTML.
   - ICONS, icon(doc, name), iconHtml(name)   THE icon list: a meaning ('undo', 'sidebar', 'tag'…) or a Tabler name,
                                  drawn from Logseq's own icon font (<i class="ti ti-…">); the one shape the font lacks,
                                  three dots joined in a triangle ('joins'), drawn once here (DRAWN).
   - KINDS, kindIcon(doc, kind, { several })   a value's kind as an icon: three dots joined in a triangle for a link to
                                  one node or several, a calendar, Aa, 123, a box with a chevron for a choice.
   - tag(doc, title, props)       a tag as a class: its name alone, no #, mono, the tag grey, a link to its page (plain:
                                  true where a click already chooses; a click of its own never follows the "#");
                                  tagLinkHtml(title) the same as words.
   - quiet(doc, { icon, label, title, faint, pressed, run })   the quiet button; go(doc, { label, run }) the one that
                                  does what was asked; pressed is a quiet button with aria-pressed="true".
   - field(doc, { placeholder, value, icon, kbd, inline, multiline, keys, input })   THE field: a real text box drawn
                                  as a hairline underneath (a few lines tall with multiline); keys typed in it never
                                  reach Logseq; .input is the box.
   - drawnField(doc, { text, placeholder, fresh, kbd })   the same look with drawn text and a drawn caret: only for the
                                  link box, whose keystrokes must keep going to the bullet.
   - tick(doc, { checked, label, title, change })   the browser's tick box as a small rounded square.
   - chip(doc, { label, pressed, run, remove })     a filter (greyed, the one in force in the text colour) or a
                                  removable item (a word with a × on hover); never a pill.
   - note(doc, text), guide(doc, paragraphs)        the quiet line; the help paragraph with a hairline down its left.
   - choices(doc, { items, picked, pick })          quiet words to pick one of, on a line, with their icons.
   - popup({ at, kind, head, items, field, rows, manual, hint, cls, width, onClose })   THE pop-up: the browser's
                                  popover, placed under its anchor (an element or a rect) by CSS anchor positioning
                                  and flipped when there is no room, dismissed by the browser on Escape or a click
                                  outside; a menu filling (items: icon, label, kbd, on, run) or a list filling (the
                                  field, then rows(query)); Up, Down and Enter handled here. Returns { el, close,
                                  items, lit, field, query, closed }. popups.closeAll() closes every open one (unload).
   - pickValue({ at, placeholder, options, clearLabel, free })   Logseq's own value picker, in Logseq's own classes.
   - editInPlace({ at, value, type, placeholder })    a value typed where it sits, as Logseq does for a number.
   - ask({ at, question, note, go, cancel, field })   a question beside what it is about: Cancel and the one that
                                  does it as words; resolves true/false, or the field's text / null (field.select
                                  starts with its words selected; multiline takes Shift-Enter for a new line).
   - dialog({ build, cls, width })   THE window: the browser's <dialog>, shown modal, dressed; for settings only.
   - bar(doc, { count, total, actions, clear, all })   the picking bar: the count with its tick box, the actions as
                                  quiet words with icons, a hairline under it; .update({ count, total }).
   - tagTreeRows(matches, opened, sibs, tags, query, builtInLast, byName)   THE tag tree's rows: matches under the tags
                                  above them, child tags one level below; the tag list after a # and the tag map's pickers.
   - card({ at, title, tag, day, fields, lines, empty, open })   the hover card: a node's preview, every piece clickable
                                  (open(what, value, event): 'node', 'tag', 'day', 'prop', 'value', 'line').
   - undo                         THE Undo (0.4.258): undo.offer({ key, at, text, run, onFail, cls, data }) puts a
                                  faded arrow at the end of at()'s element(s), or at the bottom right when there is
                                  none; forget, clear, draw, size, has, stop.

   WHAT EVERY OTHER PART MUST DO:
   - wrap itself in its own scope, `(() => { … })();`
   - take what it needs from window.refinementShared (`const shared = window.refinementShared;`), and
     make its own lifecycle with its own prefix and, when it cleans up Logseq's window, its own stopKey,
     so that a reload still stops each part's earlier copy on its own;
   - push { name, schema, provide?, start, ready?, commands?, moved?, foundation?, stop } onto window.refinementParts
     (foundation: true keeps the part running under the setting Foundation only: the model, the troubleshooting
     tools and the settings window);
     main.js joins the schemas, in the order of PART_FILES, after its own, and from main() calls every
     part's provide(core), then every start(), then every ready() (what draws on screen, once every part
     has started), and stop() at unload; it puts each command in the one register ({ key, label, run, shortcut,
     binding, icon, places }: main.js says what each is) and moves a saved setting named in moved
     ({ key: [old default, new default] }). The core starts no part by name.
   - call Logseq only through layer 1: the graph through parts/model.js, the screen through core.screen, a
     command through the register, a notice through notify; never logseq.* itself (docs/LAYERS.md section 1);
   - bring its own troubleshooting: what it looks for on screen and any tool of its own, through
     core.provided.addTroubleshooting({ checks, tools }) from parts/diagnostics.js (0.4.172), never by
     the troubleshooting part reaching into it.

   LOAD ORDER AND WHY: loader.js → main.js → parts/shared.js → parts/model.js → the other parts → main().
   loader.js loads main.js with a fresh timestamp (Logseq caches a plugin's script between reloads);
   main.js loads the parts the same way, this file first, because the others read
   window.refinementShared as they load, and parts/model.js second: the one part that knows what a page,
   block, tag, property, journal day and link are in a DB graph (titles, the stored form of a link, the
   property schema, the pages, days, journal titles, the Logseq version checked with). It provides them
   through core.provided, so every other part reads the graph through it with take(); the core itself knows
   nothing of content. main.js itself takes its helpers from here once the parts
   have loaded (useShared), before it gives Logseq the settings and before main() runs, and main()
   publishes window.refinementCore before it starts any part. */

// ===== Layer 1: talking to Logseq from the frame =====

// The Logseq window. The plugin runs in a frame inside it.
const host = () => window.parent.document;
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);

/* A warning is written once per session for each distinct message, so a part that fails after every
   change (a look-up after each edit, a screen update on each redraw) does not fill the console. */
// Every distinct warning of this session, for "Copy warnings": message (with its prefix), first time, count.
const warnings = [];
function warner(prefix) {
  const warned = new Map();
  return (message, ...details) => {
    const earlier = warned.get(message);
    if (earlier) { earlier.count++; return; }
    const entry = { message: prefix + message, at: new Date(), count: 1 };
    warned.set(message, entry);
    warnings.push(entry);
    console.warn(prefix + message, ...details);
  };
}

/* Logseq keeps only the most recent beforeunload callback a plugin registers, so every part of the
   plugin keeps its clean-up in a list of its own and main() registers one callback that runs them all.
   The plugin's watchers live in Logseq's window, so they outlive the plugin's own frame. If an earlier
   copy was removed without its clean-up finishing (an error, or Logseq's ten-second limit), they would
   keep running beside this copy. Each copy therefore leaves its clean-up where the next one can find it
   (window[stopKey]), and a new copy runs it and sweeps anything still left on screen. */
const UPDATER_TRIES = 5;
/* What each part may leave on screen, declared by the part in its lifecycle (leaves). A new copy of the
   plugin sweeps all of it before it starts, so an earlier copy cut short (an error, Logseq's ten-second
   limit) leaves no mark behind. The core used to keep one list of every part's marks; each part now
   names its own, beside the code that writes them. */
const leftovers = [];
function sweepLeftovers(doc) {
  for (const { prefix, elements, attributes, reset } of leftovers) {
    try {
      if (reset) reset(doc);
      if (elements) for (const el of doc.querySelectorAll(elements)) el.remove();
      for (const name of attributes || []) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
    } catch (error) { console.warn(prefix + 'leftovers could not be cleared', error); }
  }
}
// Every part's clean-up list, by its prefix, so the stress tests can see one that grows with use (lifeCounts).
const lives = [];
// Several parts share a prefix (the proposals' four, the tag map's three, the core and the troubleshooting tools): their
// steps are added up under it, so none hides another's (the second reading of 2026-10-23).
const lifeCounts = () => lives.reduce((out, { prefix, unloadTasks }) => { const key = prefix.replace(/^Refinements ?\(?|\)?: $/g, '') || 'core'; out[key] = (out[key] || 0) + unloadTasks.length; return out; }, {});
function lifecycle({ prefix, stopKey, before, sweep, leaves }) {
  const warnOnce = warner(prefix);
  if (leaves) leftovers.push({ prefix, ...leaves });
  const unloadTasks = [];
  lives.push({ prefix, unloadTasks });
  // Also takes the "off" function every logseq.*.onXxx hook returns.
  const onUnload = task => { if (typeof task === 'function') unloadTasks.push(task); };
  // Every step starts at once, in reverse order of set-up, so the screen is clean by the time this
  // returns; the promise it returns waits for any step that finishes later.
  function runUnloadTasks() {
    if (before) before(); // for example: stop the screen watcher, so nothing re-applies while the steps undo their changes
    const failed = error => warnOnce('clean-up step failed', error);
    const pending = [];
    for (const task of unloadTasks.splice(0).reverse()) {
      try { pending.push(Promise.resolve(task()).catch(failed)); } catch (error) { failed(error); }
    }
    return Promise.all(pending);
  }
  function takeOverFromEarlierCopy() {
    let win;
    try { win = host().defaultView; } catch (error) { return; }
    try { win[stopKey]?.(); } catch (error) { warnOnce('an earlier copy could not be stopped', error); }
    win[stopKey] = runUnloadTasks;
    onUnload(() => { if (win[stopKey] === runUnloadTasks) delete win[stopKey]; });
    if (sweep) try { sweep(win.document); } catch (error) { warnOnce('leftovers could not be cleared', error); }
  }
  /* A screen update that throws again and again is switched off for the rest of the session, with one
     note saying which part stopped. The others carry on; a reload starts it again. */
  const updaterFailures = new Map();
  function updaterFailed(fn, error, list) {
    const n = (updaterFailures.get(fn) || 0) + 1;
    updaterFailures.set(fn, n);
    if (n < UPDATER_TRIES) return warnOnce(`a screen update failed (${fn.name || 'unnamed'})`, error);
    if (list instanceof Set) list.delete(fn);
    else { const at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }
    warnOnce(`${fn.name || 'a screen update'} stopped for this session after ${n} errors`, error);
  }
  // Listens on Logseq's window before Logseq does (capture phase), until the part unloads.
  function listen(win, types, handler) {
    for (const type of types) win.addEventListener(type, handler, true);
    onUnload(() => { for (const type of types) win.removeEventListener(type, handler, true); });
  }
  return { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed, listen };
}
/* The pieces of one feature share one bag (0.4.315): the proposals' four files, the tag map's three. Asked for by name,
   made on the first ask, the same object for every piece; no name on the window. */
const features = new Map();
const feature = name => { if (!features.has(name)) features.set(name, {}); return features.get(name); };
const take = (core, names, warn) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warn(`${name} is missing from the core`); return all; };

// Opens a page or block by uuid; in the right sidebar when asked (Shift-click).
function openEntity(uuid, inSidebar = false) {
  if (!uuid) return;
  if (inSidebar) logseq.Editor.openInRightSidebar(uuid);
  else logseq.App.pushState('page', { name: uuid });
}
// Opens a page by its name (0.4.318); in the right sidebar when asked, where Logseq has to find it first.
async function openPageNamed(name, inSidebar = false) {
  if (!name) return;
  if (inSidebar) { const found = await Promise.resolve(logseq.Editor.getPage(name)).catch(() => null); if (found?.uuid) return logseq.Editor.openInRightSidebar(found.uuid); }
  logseq.App.pushState('page', { name });
}

/* Measuring, for the troubleshooting tools (parts/diagnostics.js). The core calls perf.* on its hot
   paths (every screen change, every stylesheet, every database round); while nothing is measuring,
   each call returns at once. The diagnostics part puts its measuring object in perf.impl while
   measuring is on and takes it out when it is off. */
const perf = {
  impl: null,
  add(name, ms) { if (perf.impl) perf.impl.add(name, ms); },
  time(name, fn) { return perf.impl ? perf.impl.time(name, fn) : fn(); },
  seen(name, records) { if (perf.impl) perf.impl.seen(name, records); },
  style(key, text, sent) { if (perf.impl) perf.impl.style(key, text, sent); },
  frameState() { return perf.impl ? perf.impl.frameState() : ''; },
  pass(state) { if (perf.impl) perf.impl.pass(state); },
  passDone() { if (perf.impl) perf.impl.passDone(); },
  // Measuring or not: whether a settings change touched only the plugin's own keys (reports, debugPerf, the self-check note).
  ownSettingsOnly(now, before) {
    const changed = Object.keys({ ...now, ...before }).filter(key => JSON.stringify(now?.[key]) !== JSON.stringify(before?.[key]));
    return changed.length > 0 && changed.every(key => /^(?:perf|debugPerf|selfCheck)/.test(key));
  },
};

/* Plugin settings are shared by every graph; a part that writes to notes keeps to the graphs named in one of its
   settings ("Only in these graphs", a comma-separated list). True when the open graph is one of them. */
async function graphNamedIn(list) {
  const names = String(list || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return false;
  const graph = await logseq.App.getCurrentGraph().catch(() => null);
  // A DB graph's name may carry an internal prefix ("logseq_db_"), and its url or path ends in the name.
  const strip = value => String(value || '').toLowerCase().replace(/^logseq_db_/, '');
  const candidates = [graph?.name, graph?.url, String(graph?.path || '').split(/[\\/]/).pop()]
    .map(strip).map(value => value.replace(/^.*[\\/]/, '')).filter(Boolean);
  return candidates.some(value => names.includes(value));
}

// A part's settings: the saved value, or the default when the saved value is missing or of the wrong type.
function settingReader(schema) {
  const settingDefaults = Object.fromEntries(schema.map(item => [item.key, item.default]));
  return function setting(key) {
    const value = logseq.settings?.[key];
    return typeof value === typeof settingDefaults[key] ? value : settingDefaults[key];
  };
}

/* THE screen door (0.4.311, docs/LAYERS.md layer 1; here since 0.4.315, published by main.js as core.screen): the one way a part waits for Logseq to draw something, presses one
   of its buttons, types into one of its fields, finds one of its floating items by its words, finds a page's item in the
   right sidebar, asks whether one of its pop-ups is open, and closes what floats. Every part that has to work Logseq's
   own boxes (the tag map's Add property and Add choice, the proposals' Option-Enter) goes through here; the three
   copies of waitFor, the two of press and the three "is a pop-up open" that the parts carried are gone with it.
   Checked with Logseq 2.0.2: its lists are .cp__select, its menus and pickers float in .ui__popover-content or a
   [data-radix-popper-content-wrapper], its windows are .ui__modal. */
const LOGSEQ_POPUPS = '.cp__select, .ui__popover-content, [data-radix-popper-content-wrapper], .ui__modal-panel, .ui__modal, [role="menu"], [role="dialog"], [role="listbox"]';
const screen = {
  // Polls find() every 50 ms until it returns something or ms pass; null then.
  waitFor: (find, ms = 1500) => new Promise(resolve => {
    const started = Date.now();
    const tick = () => { let found = null; try { found = find(); } catch (error) { found = null; } if (found || Date.now() - started > ms) resolve(found || null); else setTimeout(tick, 50); };
    tick();
  }),
  // Presses an element as the mouse does: Logseq opens its lists on the press, not on a click alone (found in the app).
  press(el) {
    const win = el.ownerDocument.defaultView;
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, view: win, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }));
  },
  // Types words into one of Logseq's boxes as typing would (its boxes listen for input); selects them when asked, so the
  // next key typed replaces them.
  typeInto(box, words, { select = false } = {}) {
    const win = box.ownerDocument.defaultView, proto = box.matches('textarea') ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (set) set.call(box, words); else box.value = words;
    box.dispatchEvent(new win.Event('input', { bubbles: true }));
    if (select) box.select?.();
  },
  // A key to an element (Escape to a menu, Enter to a row).
  key: (el, name, init = {}) => !!el?.dispatchEvent(new el.ownerDocument.defaultView.KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init })),
  // What floats over the page (Logseq's boxes and lists): not the sidebars, the main view, the header or the plugin's own.
  floating: el => el.getClientRects().length > 0 && !el.closest('#right-sidebar, #main-content-container, #left-sidebar, .cp__header, .rf-pop, .refinement-tags'),
  // A floating item (a menu row, an option, a button) whose words pass test(text); null when none.
  item(test, doc = host()) {
    return [...doc.querySelectorAll('[role="menuitem"], [role="option"], [role="menuitemcheckbox"], .menu-link, .cp__select-main .menu-link, button, li, a')].filter(screen.floating).find(el => test(el.textContent.trim())) || null;
  },
  // The items of the right sidebar whose header names a page (Logseq's .sidebar-item with its .sidebar-item-header).
  sidebarItems(title, doc = host()) {
    const named = text => text.replace(/^[#\s]+/, '').trim().toLowerCase();
    return [...doc.querySelectorAll('#right-sidebar .sidebar-item')].filter(item => named(item.querySelector('.sidebar-item-header')?.textContent || '').startsWith(String(title).toLowerCase()));
  },
  // Is one of Logseq's own pop-ups open (a list, a menu, a picker, a window)? With an element: does it sit in one?
  popupOpen(el, doc = host()) {
    if (el) return !!el.closest?.(LOGSEQ_POPUPS);
    return [...doc.querySelectorAll(LOGSEQ_POPUPS)].some(screen.floating);
  },
  // Closes what floats: Escape to each open menu and to whatever has the keyboard.
  escapeMenus(doc = host()) {
    for (const menu of [...doc.querySelectorAll('[role="menu"], [role="dialog"], .cp__select')].filter(screen.floating)) screen.key(menu, 'Escape');
    screen.key(doc.activeElement, 'Escape');
  },
};

// ===== Layer 2: the kit =====

/* The grammar the kit keeps (the owner's, docs/LAYERS.md section 2): the plugin fades away; differences by weight and
   grey, not by boxes; no colour of the plugin's own; a tag is a class, not a tag; property names lighter than their
   values; a value's kind is an icon left of the name; an action happens in stages, in place; italic only for a
   proposed value; Undo is the faded arrow. Three sources, in this order: Logseq's own (its colours, pills, lists,
   icon font, notice), the browser's own (the dialog, the popover and its placement and dismissal, the checkbox, the
   tooltip), and the kit for what neither gives. */

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
// HTML given to el (an icon, a tag's words) is parsed once per document and copied after (2026-10-23: the tag map of
// 600 tags parsed the same few icons thousands of times a redraw, its slowest step). At most 500 kept.
const parsed = new WeakMap();
function fragmentOf(doc, html) {
  let cache = parsed.get(doc);
  if (!cache) parsed.set(doc, cache = new Map());
  let t = cache.get(html);
  if (!t) { t = doc.createElement('template'); t.innerHTML = html; if (cache.size >= 500) cache.delete(cache.keys().next().value); cache.set(html, t); }
  return t.content.cloneNode(true);
}
// THE element builder: el(doc, 'button', { class: 'rf-quiet', title: 'Undo', click: () => … }, icon, 'Undo').
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.append(fragmentOf(doc, String(value)));
    else if (typeof value === 'function') node.addEventListener(key, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(child => child != null && child !== false));
  return node;
}

/* THE icon list: what each icon means, by the name of its Tabler icon in Logseq's own font (loaded on every page;
   Logseq draws its own toolbar with it), so the plugin draws no icon of its own, but for the one shape the font lacks
   (DRAWN, below). */
const ICONS = {
  undo: 'arrow-back-up', sidebar: 'layout-sidebar-right-expand', page: 'file-text', fold: 'chevron-right', add: 'plus', more: 'dots',
  delete: 'trash', find: 'search', settings: 'adjustments-horizontal', close: 'x', remove: 'x', chosen: 'check', help: 'info-circle',
  map: 'hierarchy', tag: 'tag', property: 'forms', rename: 'cursor-text', copy: 'copy', to: 'arrow-right', picked: 'square-check',
  warning: 'alert-triangle', show: 'eye', hide: 'eye-off', shortcut: 'keyboard', twoWay: 'arrows-left-right', order: 'arrows-sort',
  proposals: 'bulb', date: 'calendar', text: 'letter-case', number: '123', choice: 'select', several: 'stack-2', yesNo: 'checkbox', web: 'world',
  node: 'joins', nodes: 'joins', fact: 'blank', link: 'link', task: 'circle', image: 'photo', pdf: 'file-type-pdf', file: 'file', quote: 'blockquote',
};
/* The shape the font lacks, drawn once: a node property's mark, three filled dots at a triangle's corners joined by thin
   lines, a small web (the owner, 2026-10-28, docs/ONTOLOGY.md 8: a node is a point, a node property what joins nodes
   into the web; Tabler's topology-ring-3 is a square, its vector-triangle hollow squares). 12 px, in the colour around
   it; it replaces 0.4.467's dot, ring and dotted ring ("I am not a fan"). 'fact' is a blank of the same size: a fact
   listed among node properties carries no mark, and its name keeps their edge. */
const DRAWN = {
  blank: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"></svg>',
  joins: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 2.6 2.4 9.2h7.2Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="2.6" r="1.7" fill="currentColor"/><circle cx="2.4" cy="9.2" r="1.7" fill="currentColor"/><circle cx="9.6" cy="9.2" r="1.7" fill="currentColor"/></svg>',
};
/* THE four kinds of docs/ONTOLOGY.md (0.4.473), in the chain's order, and their marks (section 8: an entity's ∃, an
   occurrence's open ring of 0.4.470, a phenomenon's filled triangle, information's three dots), drawn as shapes on a 10 by
   10 square in currentColor: before a link (parts/property-kinds.js), in the map and in every list of tags. A kind is the
   graph's own umbrella tag named like one (names). kindOfTag(tag) reads a tag of the tag graph's shape (title, builtIn,
   parents) up to such an umbrella, at any depth; under two kinds, or none, it has none. kindMarkHtml(key) the mark. */
const ONTOLOGY = [
  { key: 'entity', word: 'Entities', low: 'entities', names: ['entity', 'entities'], shape: "<path d='M2 1.8H8V8.2H2M3.6 5H8' fill='none' stroke='currentColor' stroke-width='1.4'/>" },
  { key: 'occurrence', word: 'Occurrences', low: 'occurrences', names: ['occurrence', 'occurrences'], shape: "<circle cx='5' cy='5' r='3.3' fill='none' stroke='currentColor' stroke-width='1.3'/>" },
  { key: 'phenomenon', word: 'Phenomena', low: 'phenomena', names: ['phenomenon', 'phenomena'], shape: "<path d='M5 1.6 8.8 8.4H1.2Z'/>" },
  { key: 'information', word: 'Information', low: 'information', names: ['information', 'interpretation'], shape: "<circle cx='5' cy='2.4' r='1.35'/><circle cx='2.1' cy='7.6' r='1.35'/><circle cx='7.9' cy='7.6' r='1.35'/>" },
];
const ONTOLOGY_NAMES = new Map(ONTOLOGY.flatMap(k => k.names.map(n => [n, k])));
const umbrellaKind = tag => tag && !tag.builtIn ? ONTOLOGY_NAMES.get(String(tag.title || '').trim().toLowerCase()) || null : null;
function kindOfTag(tag) {
  const found = new Set(), seen = new Set([tag?.id]), queue = tag ? [tag] : [];
  while (queue.length) {
    const t = queue.shift(), own = umbrellaKind(t);
    if (own) { found.add(own); continue; }
    for (const p of t.parents || []) if (!seen.has(p.id)) { seen.add(p.id); queue.push(p); }
  }
  return found.size === 1 ? [...found][0] : null;
}
const kindMarkHtml = key => { const k = ONTOLOGY.find(x => x.key === key); return k ? `<svg class="rf-kindmark" viewBox="0 0 10 10" fill="currentColor" role="img" aria-label="${k.key}">${k.shape}</svg>` : ''; };
const iconHtml = name => { const n = ICONS[name] || name; return DRAWN[n] ? `<i class="rf-drawn rf-drawn-${n}" aria-hidden="true">${DRAWN[n]}</i>` : `<i class="ti ti-${esc(n)}" aria-hidden="true"></i>`; };
const icon = (doc, name, title) => { const n = ICONS[name] || name;
  return el(doc, 'i', { class: DRAWN[n] ? `rf-drawn rf-drawn-${n}` : `ti ti-${n}`, html: DRAWN[n] || null, 'aria-hidden': title ? null : 'true', title: title || null }); };
// A value's kind (Logseq's property types) as an icon left of the property's name. A link to a node is three dots joined in
// a triangle (0.4.468, docs/ONTOLOGY.md 8; the arrow went at 0.4.467, the owner: "it is too confusing"); links to several
// nodes take the same mark as one (0.4.335); its words on hover still say several. Every property's name carries it,
// wherever it stands, a fact's too (0.4.477, the owner: "a property always shows its icon, on pages too").
const kindIconHtml = (kind, many) => { let m = KINDS[String(kind || 'text').replace(/^:/, '')] || 'text'; if (many) m = m === 'node' ? 'nodes' : 'several'; return iconHtml(m); };
const KINDS = { node: 'node', date: 'date', datetime: 'date', default: 'text', text: 'text', number: 'number', choice: 'choice', checkbox: 'yesNo', url: 'web', page: 'node' };
const KIND_WORDS = { node: 'a link to a node', nodes: 'links to several nodes', date: 'a date', text: 'text', number: 'a number', choice: 'a choice', yesNo: 'yes or no', web: 'a web address', several: 'several' };
function kindIcon(doc, kind, { several = false, title } = {}) {
  let meaning = KINDS[String(kind || 'text').replace(/^:/, '')] || 'text';
  if (several) meaning = meaning === 'node' ? 'nodes' : 'several';
  const i = icon(doc, meaning, title === undefined ? KIND_WORDS[meaning] : title);
  i.classList.add('rf-kind');
  return i;
}
// A tag as a class: its name alone, no #. Always a link to its page (0.4.332, the owner: "they should always be
// clickable"; Shift: in the sidebar), unless it sits where a click already chooses something (a list's row, a proposal):
// plain. A caller with its own href or click handles the click itself.
function tag(doc, title, props = {}) {
  const { plain, ...rest } = props, name = String(title ?? '').replace(/^#/, '');
  if (plain) return el(doc, 'span', { class: 'rf-tag lk-tag', ...rest }, name);
  const own = rest.href || rest.click;
  // A click of the caller's own on the bare "#" link never follows it: Logseq reads "#" as its home, the Journals, and the
  // tag map left for there under an "also under" or a child tag's click (0.4.427).
  const click = !rest.click ? null : rest.href && rest.href !== '#' ? rest.click : event => { event.preventDefault(); rest.click(event); };
  return el(doc, 'a', { class: 'rf-tag lk-tag', href: '#', title: `Open ${name} (Shift: in the sidebar)`, ...rest,
    click: own ? click : event => { event.preventDefault(); event.stopPropagation(); openPageNamed(name, event.shiftKey); } }, name);
}
// The same as words for a paragraph (the help paragraph opens it, guide below).
const tagLinkHtml = title => { const name = esc(String(title ?? '').replace(/^#/, '')); return `<a class="rf-tag lk-tag" href="#" data-tag-page="${name}" title="Open ${name} (Shift: in the sidebar)">${name}</a>`; };
// The three buttons: quiet (an icon or greyed words, lit on hover), go (the one that does it), pressed (quiet, in force).
function quiet(doc, { icon: name, label, title, faint, pressed, run, cls } = {}) {
  return el(doc, 'button', { type: 'button', class: `rf-quiet${faint ? ' rf-faint' : ''}${cls ? ' ' + cls : ''}`, title: title || null, 'aria-pressed': pressed == null ? null : String(!!pressed), click: run || null },
    name ? icon(doc, name) : null, label != null ? String(label) : null);
}
const go = (doc, { label, title, run, cls } = {}) => el(doc, 'button', { type: 'button', class: `rf-go${cls ? ' ' + cls : ''}`, title: title || null, click: run || null }, label);
// Keys typed in a box of the plugin's stay out of Logseq's shortcuts (Escape goes on, so a pop-up still closes).
const keepKeys = box => { for (const type of ['keydown', 'keyup', 'keypress']) box.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); };
/* THE field: a real text box drawn as a hairline underneath, firmer while typing; an icon on the left and a key hint
   on the right when given; inline on a line. keys(event) sees every keydown first (return true to take it). */
/* count (0.4.441, the find field of docs/REWORK.md 6): a number at the field's right end ("546", "12 of 546"), never in
   the grey words; wrap.count(text) changes it. fieldHtml is the markup twin for a part that draws by markup. */
function field(doc, { placeholder = '', value = '', icon: name, kbd, inline, multiline, keys, input, title, cls, count } = {}) {
  const box = multiline ? el(doc, 'textarea', { rows: '3', placeholder, spellcheck: 'true', title: title || null }) : el(doc, 'input', { type: 'text', placeholder, spellcheck: 'false', autocomplete: 'off', title: title || null });
  box.value = value;
  const counted = count == null ? null : el(doc, 'span', { class: 'rf-field-count lk-count' }, String(count));
  const wrap = el(doc, 'span', { class: `rf-field${inline ? ' rf-field-inline' : ''}${multiline ? ' rf-field-tall' : ''}${cls ? ' ' + cls : ''}` }, name ? icon(doc, name) : null, box, counted, kbd ? el(doc, 'kbd', {}, kbd) : null);
  wrap.count = text => { if (counted) counted.textContent = String(text ?? ''); };
  keepKeys(box);
  if (keys) box.addEventListener('keydown', event => { if (keys(event) === true) { event.preventDefault(); event.stopPropagation(); } });
  if (input) box.addEventListener('input', () => input(box.value));
  wrap.input = box;
  return wrap;
}
const fieldHtml = ({ placeholder = '', value = '', icon: name, count, cls = '', inputCls = '', label = '' } = {}) =>
  `<span class="rf-field${cls ? ' ' + cls : ''}">${name ? iconHtml(name) : ''}<input type="text"${inputCls ? ` class="${esc(inputCls)}"` : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" spellcheck="false" autocomplete="off"${label ? ` aria-label="${esc(label)}"` : ''}>${count == null ? '' : `<span class="rf-field-count lk-count">${esc(count)}</span>`}</span>`;
/* The drawn field (0.4.314): the field's look with drawn text and a drawn caret, for the one box whose keystrokes must keep
   going to the bullet (the link box, so that Logseq's own Cmd+Z takes the link back); fresh marks text the next key replaces. */
function drawnField(doc, { text = '', placeholder = '', fresh = false, kbd, cls } = {}) {
  return el(doc, 'span', { class: `rf-field rf-field-drawn${cls ? ' ' + cls : ''}` },
    text ? el(doc, 'span', { class: `rf-typed${fresh ? ' rf-typed-fresh' : ''}` }, text) : el(doc, 'span', { class: 'rf-placeholder' }, placeholder),
    el(doc, 'span', { class: 'rf-caret', 'aria-hidden': 'true' }), kbd ? el(doc, 'kbd', {}, kbd) : null);
}
// The browser's tick box as a small rounded square; with a label, in a label.
function tick(doc, { checked = false, label, title, change, cls } = {}) {
  const box = el(doc, 'input', { type: 'checkbox', class: `rf-check lk-tick${label == null && cls ? ' ' + cls : ''}`, title: title || null, change: change ? () => change(box.checked) : null });
  box.checked = !!checked;
  if (label == null) return box;
  return el(doc, 'label', { class: `rf-tick${cls ? ' ' + cls : ''}` }, box, String(label));
}
// Words for chips: a filter (pressed or not) or a removable item (a × on hover).
function chip(doc, { label, pressed, run, remove, title, cls } = {}) {
  const word = el(doc, run ? 'button' : 'span', { type: run ? 'button' : null, class: `rf-chip${cls ? ' ' + cls : ''}`, 'aria-pressed': pressed == null ? null : String(!!pressed), title: title || null, click: run || null }, String(label));
  if (remove) word.append(el(doc, 'button', { type: 'button', class: 'rf-chip-x', title: 'Remove', 'aria-label': `Remove ${label}`, click: event => { event.stopPropagation(); remove(); } }, icon(doc, 'remove')));
  return word;
}
const note = (doc, text, cls) => el(doc, 'div', { class: `rf-note${cls ? ' ' + cls : ''}` }, text);
const guide = (doc, paragraphs) => el(doc, 'div', { class: 'rf-guide', role: 'note', click: openTagIn }, ...[].concat(paragraphs).map(p => typeof p === 'string' ? el(doc, 'p', {}, p) : p));
// A tag written as words (tagLinkHtml) opens its page.
function openTagIn(event) {
  const link = event.target.closest?.('a.rf-tag[data-tag-page]');
  if (!link) return;
  event.preventDefault(); event.stopPropagation();
  openPageNamed(link.dataset.tagPage, event.shiftKey);
}
/* Quiet words to pick one of, on a line (the kinds of a new property, the tags a + may give): items [{ icon, label,
   value, title }]; pick(value, item). The returned row has key(event): Left/Right move, Enter picks; true when taken. */
function choices(doc, { items, picked, pick, cls } = {}) {
  const row = el(doc, 'span', { class: `rf-pick${cls ? ' ' + cls : ''}`, role: 'group' });
  const buttons = items.map(item => quiet(doc, { icon: item.icon, label: item.label, title: item.title, faint: item.faint, pressed: item.value === picked, run: () => pick(item.value, item) }));
  row.append(...buttons);
  const at = () => buttons.findIndex(b => b.getAttribute('aria-pressed') === 'true');
  row.key = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const i = at(), n = i < 0 ? 0 : (i + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
      buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === n)));
      return true;
    }
    if (event.key === 'Enter') { const i = at(); if (i >= 0) { pick(items[i].value, items[i]); return true; } }
    return false;
  };
  return row;
}

/* THE pop-up: the browser's popover (dismissed by it on Escape or a click outside, in the top layer), placed under
   its anchor by CSS anchor positioning and flipped up or sideways when there is no room; the box is Logseq's own [[
   menu look. Two fillings: a menu (items) and a list (a field, then rows). With a rect for `at`, a 0×0 anchor is put
   there. `manual`: the part dismisses it itself (the link box, whose keys stay in the bullet); `hint`: a card that
   takes no focus (the hover card). Keys typed inside never reach Logseq. */
let anchorCount = 0;
// Every pop-up open now, so an unload closes them all (main.js calls popups.closeAll; the boot test looks for leftovers).
const openPops = new Set();
/* Which mouse buttons are down on Logseq's window, followed by the kit itself (0.4.360). The pop-up used to read the
   window's current event, which an installed copy cannot see: it runs in a frame of its own, so a right-click menu there
   opened while the button was still down and the release closed it at once (the owner's tag map, on their main computer).
   Started by the core with the plugin, so the press that opens the first menu is already counted. */
const pressed = { win: null, buttons: 0, stop: null };
function followButtons(win) {
  if (!win || pressed.win === win) return;
  pressed.stop?.();
  const down = event => { pressed.buttons = event.buttons || (1 << (event.button || 0)); };
  const up = event => { pressed.buttons = event.buttons || 0; };
  const types = { pointerdown: down, mousedown: down, pointerup: up, mouseup: up, pointercancel: () => { pressed.buttons = 0; } };
  for (const [type, fn] of Object.entries(types)) win.addEventListener(type, fn, true);
  pressed.win = win; pressed.buttons = 0;
  pressed.stop = () => { for (const [type, fn] of Object.entries(types)) win.removeEventListener(type, fn, true); pressed.win = null; pressed.buttons = 0; pressed.stop = null; };
}
const popups = { closeAll() { for (const pop of [...openPops]) pop.close(); }, get size() { return openPops.size; }, followButtons, stopFollowing: () => pressed.stop?.() };
function anchorFor(doc, at) {
  if (!at) return null;
  const isElement = typeof at.getBoundingClientRect === 'function' && at.nodeType === 1;
  let node = at, made = false;
  if (!isElement) {
    const rect = typeof at.getBoundingClientRect === 'function' ? at.getBoundingClientRect() : at;
    node = el(doc, 'span', { class: 'rf-anchor', 'aria-hidden': 'true' });
    Object.assign(node.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${Math.max(0, (rect.right ?? rect.left) - rect.left)}px`, height: `${Math.max(0, (rect.bottom ?? rect.top) - rect.top)}px`, pointerEvents: 'none' });
    doc.body.append(node);
    made = true;
  }
  const name = `--rf-anchor-${++anchorCount}`, before = node.style.getPropertyValue('anchor-name');
  node.style.setProperty('anchor-name', name);
  return { name, cleanup: () => { if (made) node.remove(); else if (node.style.getPropertyValue('anchor-name') === name) { if (before) node.style.setProperty('anchor-name', before); else node.style.removeProperty('anchor-name'); } } };
}
function popup({ at, kind = 'menu', head, items, field: fieldOptions, rows, keys, manual = false, hint = false, cls = '', width, onClose, doc } = {}) {
  let waitUp = null; // set while the pop-up waits for the mouse button that opened it to be let go
  doc = doc || host();
  const pop = el(doc, 'div', { class: `rf-pop${cls ? ' ' + cls : ''}`, role: hint ? 'tooltip' : fieldOptions ? 'listbox' : 'menu', tabindex: hint ? null : '-1' });
  pop.setAttribute('popover', manual ? 'manual' : hint ? 'hint' : 'auto');
  if (width) pop.style.width = typeof width === 'number' ? `${width}px` : width;
  const anchor = anchorFor(doc, at);
  if (anchor) { pop.classList.add('rf-anchored'); pop.style.setProperty('position-anchor', anchor.name); }
  const wasActive = doc.activeElement;
  let closed = false, resolveClosed;
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });
  const close = () => {
    if (closed) return;
    closed = true;
    const hadFocus = pop.contains(doc.activeElement);
    try { if (pop.hidePopover && pop.matches(':popover-open')) pop.hidePopover(); } catch (error) { /* already hidden */ }
    pop.remove();
    anchor?.cleanup();
    openPops.delete(controller);
    if (hadFocus && wasActive?.isConnected && wasActive !== doc.body) try { wasActive.focus({ preventScroll: true }); } catch (error) { /* cannot */ }
    waitUp?.();
    onClose?.();
    resolveClosed();
  };
  pop.addEventListener('toggle', event => { if (event.newState === 'closed') close(); });
  if (head) pop.append(el(doc, 'div', { class: 'rf-pop-head' }, head));
  let fieldEl = null;
  if (fieldOptions) {
    fieldEl = field(doc, { ...fieldOptions, input: value => { fieldOptions.input?.(value); if (rows) drawItems(rows(value)); } });
    pop.append(fieldEl);
  }
  const body = el(doc, 'div', { class: 'rf-pop-body' });
  pop.append(body);
  const buttons = () => [...body.querySelectorAll('.rf-item')];
  const lit = i => { const all = buttons(); all.forEach((b, k) => b.classList.toggle('rf-on', k === i)); all[i]?.scrollIntoView?.({ block: 'nearest' }); };
  const litAt = () => buttons().findIndex(b => b.classList.contains('rf-on'));
  const run = item => { if (item.disabled) return; const keep = item.run?.(item) === 'keep' || item.keep; if (!keep) close(); };
  function drawItems(list = []) {
    body.replaceChildren();
    for (const item of list) {
      if (!item) continue;
      if (item.sep) { body.append(el(doc, 'hr')); continue; }
      if (item.note) { body.append(note(doc, item.note)); continue; }
      // A row of a tree (the tag tree, 0.4.431): indented by its depth, faded when it shows only where a match is, its
      // child tags counted with the fold chevron at the end (a click on it opens or closes them, the list staying).
      const fold = item.fold ? el(doc, 'span', { class: 'rf-end rf-tree-kids', title: item.fold.open ? 'Close its child tags (←)' : 'Show its child tags (→)',
        click: event => { event.preventDefault(); event.stopPropagation(); item.fold.toggle(); } }, String(item.fold.count), el(doc, 'span', { class: 'rf-tree-tri' + (item.fold.open ? ' rf-tree-open' : '') }, icon(doc, 'fold'))) : null;
      const b = el(doc, 'button', { type: 'button', class: `rf-item${item.on ? ' rf-on' : ''}${item.faint ? ' rf-faint' : ''}${item.dim ? ' rf-tree-dim' : ''}${item.cls ? ' ' + item.cls : ''}`, role: 'menuitem', title: item.title || null, disabled: item.disabled || null,
        style: item.depth != null ? `padding-left: ${8 + item.depth * 16}px` : null, click: () => run(item) },
        item.icon ? icon(doc, item.icon) : null, item.html ? el(doc, 'span', { class: 'rf-item-words', html: item.html }) : el(doc, 'span', { class: 'rf-item-words' }, String(item.label ?? '')),
        item.chosen && item.depth != null ? el(doc, 'span', { class: 'rf-end rf-tree-chosen' }, icon(doc, 'chosen')) : null,
        fold || (item.kbd ? el(doc, 'kbd', {}, item.kbd) : item.right ? el(doc, 'span', { class: 'rf-end' }, typeof item.right === 'string' ? item.right : '', typeof item.right === 'string' ? null : item.right) : item.chosen && item.depth == null ? el(doc, 'span', { class: 'rf-end' }, icon(doc, 'chosen')) : null));
      b.item = item;
      body.append(b);
    }
    if (list.length && litAt() < 0 && (fieldOptions || kind === 'list')) { const first = buttons().findIndex(b => !b.disabled); lit(first < 0 ? 0 : first); }
  }
  if (items) drawItems(items);
  if (rows && fieldOptions) drawItems(rows(fieldEl.input.value));
  // Draw the rows again (a tree's row opened or closed), the same row lit.
  const redraw = () => { if (!rows || !fieldEl) return; const was = buttons()[litAt()]?.item?.key; drawItems(rows(fieldEl.input.value)); const i = buttons().findIndex(b => b.item?.key != null && b.item.key === was); if (i >= 0) lit(i); };
  pop.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    const all = buttons();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { if (!all.length) return; event.preventDefault(); event.stopPropagation(); const i = litAt(); lit(i < 0 ? 0 : (i + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length); return; }
    if (event.key === 'Enter' && !event.isComposing) { const b = all[litAt()]; if (b) { event.preventDefault(); event.stopPropagation(); run(b.item); return; } }
    // The caller's own keys on the lit row (the tag tree's → and ←); true: taken, the rows drawn again with the same row lit.
    if (keys && keys(event, all[litAt()]?.item) === true) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.target === pop) event.stopPropagation();
  });
  for (const type of ['keyup', 'keypress']) pop.addEventListener(type, event => event.stopPropagation());
  // The pointer over a row lights it, as in Logseq's own lists.
  body.addEventListener('mousemove', event => { const b = event.target.closest?.('.rf-item'); if (b && !b.classList.contains('rf-on')) lit(buttons().indexOf(b)); });
  doc.body.append(pop);
  const show = () => {
    if (closed) return;
    try { if (pop.showPopover) pop.showPopover(); } catch (error) { /* shown as a plain box */ }
    if (!hint) { if (fieldEl) fieldEl.input.focus({ preventScroll: true }); else if (!manual) pop.focus({ preventScroll: true }); }
  };
  /* Opened while a mouse button is still down (a right-click opens its menu on the press, on a Mac): shown once the button
     is let go (0.4.323, the owner: "menu appear for less than a second and then disappears. you can get it to stay if you
     hold down click"). The browser closes an open pop-up when a press ends outside it, and the press that opened it had
     begun outside, so the release closed the menu it had just opened. */
  const win = doc.defaultView;
  if (!hint && ((pressed.win === win ? pressed.buttons : 0) || win?.event?.buttons || 0) > 0) {
    const up = () => { waitUp(); win.setTimeout(show, 0); };
    waitUp = () => { waitUp = null; win.removeEventListener('pointerup', up, true); win.removeEventListener('pointercancel', up, true); };
    win.addEventListener('pointerup', up, true);
    win.addEventListener('pointercancel', up, true);
  } else show();
  const controller = { el: pop, body, close, items: drawItems, redraw, lit, get litAt() { return litAt(); }, field: fieldEl, get query() { return fieldEl?.input.value ?? ''; }, closed: closedPromise, get isClosed() { return closed; } };
  openPops.add(controller);
  return controller;
}
/* Logseq's own value picker, drawn with Logseq's own classes so it looks and moves like the one on a page (1.0.3, the
   owner: "I don't like this popup … it is not a natural popup"; then "why can't it be like a normal bullet or normal tag
   selector"). Copied from Logseq 2.0.2's "Set Works at" picker: the field at the top saying "Set <property>", the
   choices under it, the one held ticked at the right, Clear last with its ×. Placed and dismissed as THE pop-up is:
   the browser's popover under its anchor, flipped when there is no room, closed by Escape or a click outside.
   options: [{ label, held }]. Resolves with the option picked, { clear: true }, { typed } (free: words matching no
   option, Enter), or null. */
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"></path></svg>';
const X_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>';
function pickValue({ at, placeholder = '', options = [], clearLabel = '', free = false, doc } = {}) {
  doc = doc || host();
  return new Promise(resolve => {
    let answer = null, finished = false, lit = 0, shown = [];
    const pop = el(doc, 'div', { class: 'ui__popover-content z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 rf-lsq-pop',
      role: 'dialog', tabindex: '-1', 'data-side': 'bottom', 'data-state': 'open' });
    pop.setAttribute('popover', 'auto');
    const anchor = anchorFor(doc, at);
    if (anchor) { pop.classList.add('rf-anchored'); pop.style.setProperty('position-anchor', anchor.name); }
    const input = el(doc, 'input', { class: '!p-1.5 cp__select-input w-full', type: 'text', placeholder });
    const list = el(doc, 'div', { class: 'rf-lsq-list hide-scrollbar' });
    pop.append(el(doc, 'div', { class: 'property-select' }, el(doc, 'div', { class: 'cp__select-main cp__select' },
      el(doc, 'div', { class: 'input-wrap' }, input),
      el(doc, 'div', { class: 'py-1' }, el(doc, 'div', { class: 'item-results-wrap' }, el(doc, 'div', { class: 'cp__select-results' }, list))))));
    const finish = () => {
      if (finished) return;
      finished = true;
      try { if (pop.matches(':popover-open')) pop.hidePopover(); } catch (error) { /* already hidden */ }
      pop.remove();
      anchor?.cleanup();
      resolve(answer);
    };
    const take = value => { answer = value; finish(); };
    const row = (item, i) => {
      const words = item.clear ? [el(doc, 'span', { class: 'ui__icon ti', html: X_SVG }), el(doc, 'span', {}, item.label)] : [el(doc, 'div', {}, item.label)];
      const link = el(doc, 'a', { class: `${i === lit ? 'chosen ' : ''}flex justify-between menu-link`, tabindex: '-1',
        mousedown: event => event.preventDefault(), click: event => { event.preventDefault(); take(item.clear ? { clear: true } : item); },
        mousemove: () => { if (lit !== i) { lit = i; draw(); } } },
        el(doc, 'span', { class: 'flex-1' }, el(doc, 'div', { class: `${i === lit ? 'chosen ' : ''}flex flex-row justify-between w-full` },
          el(doc, 'div', { class: 'flex flex-row items-center gap-1' }, ...words),
          el(doc, 'div', { class: 'tip flex items-center gap-1' }, item.held ? el(doc, 'span', { class: 'ls-icon-check ui__icon ti', html: CHECK_SVG }) : null))));
      return el(doc, 'div', { class: 'menu-link-wrap' }, link);
    };
    function draw() {
      const q = input.value.trim().toLowerCase();
      const starts = o => o.label.toLowerCase().startsWith(q);
      const found = q ? options.filter(o => o.label.toLowerCase().includes(q)).sort((a, b) => (starts(b) - starts(a)) || a.label.length - b.label.length)
        : [...options.filter(o => o.held), ...options.filter(o => !o.held)]; // what it holds first, ticked, as Logseq lists it
      shown = [...found, ...(clearLabel && !q ? [{ label: clearLabel, clear: true }] : [])];
      lit = Math.min(lit, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map(row));
      list.querySelector('.chosen')?.scrollIntoView?.({ block: 'nearest' });
    }
    input.addEventListener('input', () => { lit = 0; draw(); });
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (shown.length) { lit = (lit + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; draw(); } }
      else if (event.key === 'Enter') {
        event.preventDefault();
        const item = shown[lit], typed = input.value.trim();
        if (item && (!typed || !free || item.label.toLowerCase().includes(typed.toLowerCase()))) take(item.clear ? { clear: true } : item);
        else if (free && typed) take({ typed });
      } else if (event.key === 'Escape') { event.preventDefault(); finish(); }
    });
    for (const type of ['keyup', 'keypress']) input.addEventListener(type, event => event.stopPropagation());
    pop.addEventListener('toggle', event => { if (event.newState === 'closed') finish(); });
    draw();
    doc.body.append(pop);
    try { pop.showPopover(); } catch (error) { /* shown as a plain box */ }
    input.focus({ preventScroll: true });
  });
}
/* A value typed where it sits, as Logseq does for a number on a bullet (copied from Logseq 2.0.2: its input with no
   border and no fill, at the line's own size). Enter keeps it, Escape leaves it as it was, a click away keeps what was
   typed. Resolves with the words, or null when nothing changed. A redraw of the rows does not end it: again() finds the
   place in the new drawing and the box goes on there, words and caret as they were. */
function editInPlace({ at, value = '', type = 'text', placeholder = '', doc, again } = {}) {
  const numeric = type === 'number';
  type = 'text';
  doc = doc || host();
  return new Promise(resolve => {
    let was = [...at.childNodes];
    const input = el(doc, 'input', { class: 'ui__input flex w-full rounded-md border-none bg-transparent px-0 !py-0 min-h-0 leading-6 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rf-in-place', type, placeholder });
    input.value = value;
    if (numeric) input.setAttribute('inputmode', 'decimal');
    let finished = false, moving = false;
    const finish = answer => { if (finished) return; finished = true; at.replaceChildren(...was); resolve(answer); };
    input.across = redraw => {
      const from = input.selectionStart, to = input.selectionEnd;
      moving = true; redraw(); moving = false;
      const next = again?.();
      if (!next) { finish(input.value === value ? null : input.value); return; }
      at = next; was = [...at.childNodes]; at.replaceChildren(input);
      input.focus({ preventScroll: true }); input.setSelectionRange(from, to);
    };
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); finish(input.value === value ? null : input.value); }
      else if (event.key === 'Escape') { event.preventDefault(); finish(null); }
    });
    for (const type of ['keyup', 'keypress']) input.addEventListener(type, event => event.stopPropagation());
    for (const type of ['mousedown', 'click']) input.addEventListener(type, event => event.stopPropagation());
    input.addEventListener('blur', () => { if (!moving) finish(input.value === value ? null : input.value); });
    at.replaceChildren(input);
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* a field that has no caret */ }
  });
}
/* A question beside what it is about: the question, a quiet note, Cancel and the one that does it as words (no
   backdrop, no fill). Resolves true or false; with a field, the text typed (Enter or the go word) or null. */
function ask({ at, question, note: hint, go: goWord = 'OK', cancel = 'Cancel', field: fieldOptions, width, cls, doc } = {}) {
  doc = doc || host();
  return new Promise(resolve => {
    let answer = fieldOptions ? null : false;
    const p = popup({ at, doc, cls: `rf-ask${cls ? ' ' + cls : ''}`, width, onClose: () => resolve(answer) });
    const done = () => { answer = fieldOptions ? f.input.value : true; p.close(); };
    const f = fieldOptions ? field(doc, { ...fieldOptions, keys: event => { if (event.key === 'Enter' && !event.isComposing && !(fieldOptions.multiline && event.shiftKey)) { done(); return true; } return fieldOptions.keys?.(event) === true; } }) : null;
    // Only what is there: the browser writes an empty piece out as the word "null" (0.4.326).
    p.body.append(...[el(doc, 'div', { class: 'rf-ask-words' }, question), hint ? note(doc, hint) : null, f,
      el(doc, 'div', { class: 'rf-btns' }, quiet(doc, { label: cancel, run: () => p.close() }), go(doc, { label: goWord, run: done }))].filter(Boolean));
    if (f) { f.input.focus({ preventScroll: true }); if (fieldOptions.select && f.input.value) f.input.select(); }
    // Enter takes what is offered: with the keyboard on a button, that button, so on Cancel it cancels. Pressed here, since Logseq takes Enter before the browser would.
    p.el.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing || event.target === f?.input) return;
      event.preventDefault(); event.stopPropagation();
      const button = event.target.closest?.('button');
      if (button) button.click(); else done();
    });
  });
}
/* THE window: the browser's own dialog, shown modal (it keeps the keyboard, closes on Escape, draws the backdrop),
   dressed by the kit; the settings window is its one user. build(box, finish, doc) fills it; the promise resolves
   with what finish() is given, or undefined on Escape or a click on the backdrop. */
function dialog({ build, cls = '', width, doc } = {}) {
  doc = doc || host();
  return new Promise(resolve => {
    const box = el(doc, 'dialog', { class: `rf-dialog${cls ? ' ' + cls : ''}` });
    if (width) box.style.width = width;
    let done = false;
    const finish = value => { if (done) return; done = true; try { if (box.open) box.close(); } catch (error) { /* not open */ } box.remove(); resolve(value); };
    box.addEventListener('cancel', event => { event.preventDefault(); finish(undefined); });
    box.addEventListener('close', () => finish(undefined));
    box.addEventListener('mousedown', event => { if (event.target === box) finish(undefined); }); // the backdrop: the box has no edge of its own
    for (const type of ['keydown', 'keyup', 'keypress']) box.addEventListener(type, event => { if (type !== 'keydown' || event.key !== 'Escape') event.stopPropagation(); });
    doc.body.append(box);
    build(box, finish, doc);
    try { if (box.showModal) box.showModal(); else box.setAttribute('open', ''); } catch (error) { box.setAttribute('open', ''); }
  });
}
/* The picking bar: the count with its tick box (ticked while something is picked; a click picks all or clears),
   the actions as quiet words with icons, Clear faint at the end; one line with a hairline under it. */
/* One line (0.4.443, docs/REWORK.md 4): its room is kept where it sits (box.idle(true) hides it in place, so nothing
   moves when something is picked); the actions marked more: true wait under ⋯; box.extra is a place for the part's own
   words after the count (what one ticked thing is tied to). */
function bar(doc, { count = 0, total = 0, actions = [], clear, all, cls } = {}) {
  const box = el(doc, 'div', { class: `rf-bar${actions.some(a => a.more) ? ' rf-bar-hasmore' : ''}${cls ? ' ' + cls : ''}`, role: 'toolbar' });
  const words = el(doc, 'span');
  const box1 = tick(doc, { checked: count > 0, title: 'Pick all, or none', change: on => (on ? all : clear)?.() });
  box.append(el(doc, 'label', { class: 'rf-count' }, box1, words));
  box.extra = el(doc, 'span', { class: 'rf-bar-extra' });
  box.append(box.extra);
  const shown = actions.filter(a => !a.more);
  shown.forEach(action => box.append(quiet(doc, { icon: action.icon, label: action.label, title: action.title, faint: action.faint, run: action.run, cls: 'rf-bar-later' })));
  // ⋯ holds the actions marked more, and while the part's own words show (box.extra) every action but the first.
  const later = () => actions.filter(a => a.more || box.extra.childNodes.length);
  if (actions.length > 1) box.append(quiet(doc, { icon: 'more', title: 'More actions', cls: 'rf-bar-more', run: event => {
    const at = event.currentTarget;
    popup({ doc, at, items: later().map(a => ({ icon: a.icon, label: a.label, title: a.title, run: () => a.run({ currentTarget: at }) })) });
  } }));
  if (clear) box.append(quiet(doc, { label: 'Clear', faint: true, title: 'Clear what is picked (Escape)', run: clear, cls: 'rf-bar-later' }));
  box.idle = on => { box.classList.toggle('rf-bar-idle', !!on); box.toggleAttribute('aria-hidden', !!on); };
  box.update = ({ count: n = count, total: t = total } = {}) => { count = n; total = t; words.textContent = t && t !== n ? `${n} of ${t} picked` : `${n} picked`; box1.checked = n > 0; box1.indeterminate = n > 0 && t > 0 && n < t; };
  box.update();
  return box;
}
/* THE tag tree for a list of tags (0.4.388 in the tag list after a #; the kit's since 0.4.431, so the tag map's pickers
   show the same tree, the owner: "use the tag selector that have indented hierarchy that was already developed").
   tags: { byId } of the model's tags (each with parents and kids). One parent per tag in the tree (a tag that extends
   two sits under the first by name, as the title's corner reads it). Returns the rows to show, each
   { t, depth, dim (shown only for where a match is), match, count (its child tags), kidsShown }. */
const parentOf = t => [...(t.parents || [])].sort((a, b) => a.title.localeCompare(b.title))[0] || null;
const kidsOf = t => t.kids || [];
// What to show: Logseq's matches in Logseq's order, each under its parents, plus what → and ← opened. A match whose name
// holds the words typed opens its child tags; one Logseq lists only because its letters come in that order (Phenomena
// for "pe", seen in the app) stays closed, as do Logseq's own tags (Page holds Journal and Whiteboard), so the list
// stays short; → opens them.
function tagTreeRows(matches, opened, sibs, tags, query = '', builtInLast = false, byName = false) {
  const rank = new Map(), visible = new Set(), dimOk = new Set();
  matches.forEach((t, i) => { if (!rank.has(t.id)) rank.set(t.id, i); });
  const showWithParents = t => { for (let p = t, seen = new Set(); p && !seen.has(p.id); seen.add(p.id), p = parentOf(p)) visible.add(p.id); };
  const openKids = t => { for (const k of kidsOf(t)) { visible.add(k.id); dimOk.add(k.id); } };
  const q = query.trim().toLowerCase();
  for (const t of matches) { showWithParents(t); dimOk.add(t.id); if (q && !t.builtIn && t.title.toLowerCase().includes(q)) openKids(t); }
  for (const id of opened) { const t = tags.byId.get(id); if (t && visible.has(id)) openKids(t); }
  for (const id of sibs) {
    const t = tags.byId.get(id); if (!t || !visible.has(id)) continue;
    const p = parentOf(t);
    const family = p ? kidsOf(p) : [...tags.byId.values()].filter(x => !parentOf(x) && !x.builtIn);
    for (const s of family) { visible.add(s.id); dimOk.add(s.id); }
  }
  // A branch is ordered by its best match (Logseq's order), then by name.
  const best = new Map();
  const bestOf = t => {
    if (best.has(t.id)) return best.get(t.id);
    best.set(t.id, Infinity);
    let b = rank.has(t.id) ? rank.get(t.id) : Infinity;
    for (const k of kidsOf(t)) if (visible.has(k.id)) b = Math.min(b, bestOf(k));
    best.set(t.id, b);
    return b;
  };
  const order = list => list.slice().sort((a, b) => (byName ? 0 : bestOf(a) - bestOf(b)) || a.title.localeCompare(b.title));
  const rows = [], placed = new Set();
  const walk = (t, depth) => {
    if (placed.has(t.id)) return;
    placed.add(t.id);
    const kids = kidsOf(t).filter(k => visible.has(k.id));
    // The chevron points down when child tags show below, opened or shown as matches of their own (a Tags list with
    // nothing typed shows every tag; seen in the app with every chevron pointing right).
    rows.push({ t, depth, dim: !dimOk.has(t.id), match: rank.has(t.id), count: kidsOf(t).length, kidsShown: kids.length > 0,
      kind: depth === 0 ? umbrellaKind(t) : null, nodes: t.nodes ? nodesUnder(t).size : null });
    for (const k of order(kids)) walk(k, depth + 1);
  };
  const roots = [...visible].map(id => tags.byId.get(id)).filter(t => t && !(parentOf(t) && visible.has(parentOf(t).id)));
  // Listed by name, the four kinds come first in the chain's order (0.4.473: as in the map), then your other tags, then
  // Logseq's own.
  const kindRank = t => { const k = umbrellaKind(t); return k ? ONTOLOGY.indexOf(k) : t.builtIn ? 6 : 5; };
  // While typing too (the reviewer: Logseq's own tags came between the kinds after #pe): the kinds in their order, then
  // your other tags, then Logseq's own, each group in the order of its best match.
  const rootOrder = list => order(list).sort((a, b) => kindRank(a) - kindRank(b));
  for (const t of rootOrder(roots)) walk(t, 0);
  return rows;
}

// The nodes carrying a tag or a tag under it, each once (a tag graph's tag with its nodes): the one count a tag shows,
// in the map and in every list.
const underMemo = new WeakMap();
function nodesUnder(t) {
  if (underMemo.has(t)) return underMemo.get(t);
  const all = new Set(t.nodes || []);
  underMemo.set(t, all);
  for (const k of kidsOf(t)) for (const b of nodesUnder(k)) all.add(b);
  return all;
}
tagTreeRows.nodesUnder = nodesUnder;
tagTreeRows.parentOf = parentOf;
tagTreeRows.kidsOf = kidsOf;
// A cell that can be changed where it sits: the text colour on the pointer, an underline of the line grey.
const cellEdit = (node, title, run) => { node.classList.add('rf-tedit'); if (title) node.title = title; node.addEventListener('click', event => { event.stopPropagation(); run(event); }); return node; };
/* THE outline (0.4.441, docs/REWORK.md sections 4 and 6): one way for something to open under something, for the two-way
   section, the tag map and the sidebar. Markup, as the two-way section draws (a DOM part wraps it with fragmentOf).
   - chev({ open, label, attrs }): the one chevron, a 16 px mark in a 24 px place to click, faint at rest (never hidden),
     full on its line, turned down while open (160 ms, none with reduced motion).
   - line({ body, chev, day, tick, cls, attrs }): one line of a tree; the tick box hangs in the margin, then the day in a
     column of one width, the chevron right before the name it opens, the name with its tag (body).
   - kids({ html, from, fresh, attrs }): what an opened line holds, under its name, one hairline down from its chevron.
     from says what stands before that chevron: 'day' (a day), 'prop' (a property's name column), 'back' (a property's
     name and a day), '' (nothing). fresh: it unrolls (180 ms) as it comes.
   - unit({ html, focus, attrs }): an opened line and what it holds, kept together; the focus (the one opened last) sits on
     a very faint grey, its line and everything under it as one block. Nothing else changes: the wash is drawn in room
     the unit always keeps, so nothing moves when the focus moves. The grey is the focus's alone, and fainter than the
     pointer's wash (the owner, 2026-10-26: "grey was only meant for the deep dive of the two-way link, and it should
     have had a much fainter grey"); a tick shows in its box only.
   - prop({ kind, many, name, value, attrs }): a property's line, Logseq's look: a node property's mark (three dots joined in a
     triangle; a fact none, its room kept), its name quieter than its value (kind '': a row pointing back, named by its property with no room for a mark, so it does not read as the node's own), the names of one node on one column (--rf-ol-name); a value never breaks inside a word.
   - bullet({ html, attrs }), newBullet({ attrs, label }): a bullet as Logseq draws one, its dot and words; the empty one
     at the end is faint, written in like a bullet: a caret on the line, no box, no line under it (a bare text box, so
     what is typed keeps the field's helpers, the grey name completed after the caret among them).
   - more({ text, attrs, under }): "show all 13" under a list, on its edge: under 'name' (the names after a day), 'bare'
     (names with no day before them) or 'value' (a property's values).
   - name({ text, title, open, tag, attrs }): a node's name, the faint underline of a link, bold while open, its tag after.
   - pencil(text, attrs): what the proposals fill in, sure or guessed alike: italic, faint, a dotted line; with the class
     rf-pencil-taken, kept (it will be set), in the words' own look.
   - trail(steps, here): where you are, the names on the way, each a click back, the deepest last.
   The tag map's pieces (0.4.448, docs/MAP-DESIGN.md 5), the structure walked as the content is:
   - line({ …, end }): end is what sits in the count column on the line's right edge, one width for every line.
   - count({ held, of, title, attrs }): how much a property or a tag is used, "14 of 17" (held of of) or "575" (held
     alone), a word that opens the nodes it counts; faint when nothing holds it ("0 of 9"), a faint "—" (not a link) when
     there is nothing to count.
   - tag({ text, open, attrs }): a tag line's name, the tag in mono as everywhere, bold while open.
   - leads({ name, nameAttrs, inherited, to, count, tick, chev, attrs }): a property in the map, one line: its
     own chevron (chev, opening what it is: its tags, how it reads back), its name, with no kind icon (0.4.465: the icons
     said how Logseq stores a value, which nobody thinks in, docs/DESIGN-AXIOMS.md 14; the line's own words say it) (a link, in the
     map's full colour; one step quieter and "inherited" when it comes from above) in one column (--rf-ol-lname), then
     the tag it leads to ({ text, open, n, chevAttrs }: a chevron right before it to walk on; n, given only when it leads
     to several tags, a count of the nodes pointing at that one), then its count. A property leading to several tags takes
     a line for each, the name left out after the first ('' as name): one name per line where a name can open. What
     opens under its tag is kids({ from: 'leads' }). In a narrow place the tag goes under the name.
   - pointing({ from, name, nameAttrs, count, tick, attrs }): what points at a tag, the other way round so the direction
     reads at a glance: the tag the property sits on first ({ text, open, chevAttrs }, its chevron in the line's own place,
     to walk there), then the property, with no kind icon (as the two-way rows pointing back have none), then how many of
     that tag's nodes point here ("4 of 6").
   - more({ under: 'leads' }): "show all 15" under a property's tags; under 'flush', on a list's own edge (the findings).
   - group(text): a quiet heading over the lines of one kind under a tag ("Pointed at by", "Child tags").
   - the class rf-ol-margin on the outline's root (the map): the tick boxes of every level stand in one column in the
     margin, as the map's rows had them, instead of each at its own indent on the hairline; what unrolls there fades in
     without the small slide, so no tick box moves while it comes.
   - sum(parts): one line of counts as words, "22 tags · 22 properties · 4 to look at", each part { text, attrs } a
     word that narrows to what it counts (a link), or { text, plain: true }; the map's bearings and the kinds over the
     findings.
   - finding({ html, act, actAttrs, done, attrs }): one thing found that may want work: the words (names in them are
     links), the one action at the end, faint at rest like every action; done: the words quieter, the Undo arrow after them. */
const attrsHtml = attrs => Object.entries(attrs || {}).filter(([, v]) => v != null && v !== false).map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join('');
const outline = {
  /* Behaviour, the same in every part: close(kids, done) rolls what an opened line holds back up, then calls done (at
     once with reduced motion); focus(root, key) moves the wash to the unit of that key, in place. */
  close(kids, done) {
    const win = kids?.ownerDocument?.defaultView;
    if (!kids?.isConnected || !win?.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    let over = false; const end = () => { if (over) return; over = true; done(); };
    kids.classList.remove('rf-ol-unroll'); kids.classList.add('rf-ol-rollup');
    kids.addEventListener('animationend', end, { once: true }); win.setTimeout(end, 220);
  },
  focus(root, key) { for (const unit of root?.querySelectorAll('.rf-ol-unit') || []) unit.classList.toggle('rf-ol-focus', unit.dataset.key === key); },
  chev: ({ open = false, label = '', attrs, cls = '' } = {}) => `<button type="button" class="rf-chev lk-fold${cls ? ' ' + cls : ''}" aria-expanded="${open}" aria-label="${esc(`${open ? 'Close' : 'Open'} ${label}`.trim())}" title="${open ? 'Close' : 'Open here'}"${attrsHtml(attrs)}>${iconHtml('fold')}</button>`,
  room: () => '<span class="rf-chev-room" aria-hidden="true"></span>',
  line: ({ body = '', chev = '', day, tick = '', end = '', cls = '', attrs } = {}) => `<div class="rf-ol-line lk-row${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${tick}${day == null ? '' : `<span class="rf-ol-day lk-day">${esc(day)}</span>`}${chev || outline.room()}<span class="rf-ol-body">${body}</span>${end ? `<span class="rf-ol-end">${end}</span>` : ''}</div>`,
  kids: ({ html = '', from = '', fresh = false, attrs, cls = '' } = {}) => `<div class="rf-ol-kids${from ? ' rf-ol-from-' + from : ''}${fresh ? ' rf-ol-unroll' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><div class="rf-ol-in">${html}</div></div>`,
  unit: ({ html = '', focus = false, attrs, cls = '' } = {}) => `<div class="rf-ol-unit${focus ? ' rf-ol-focus' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${html}</div>`,
  prop: ({ kind = 'text', many = false, name = '', value = '', chev = '', attrs, cls = '', nameAttrs } = {}) => `<div class="rf-ol-line lk-row rf-ol-prop${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><span class="rf-ol-pname lk-prop"${attrsHtml(nameAttrs)}>${name ? `${kind ? `<span class="rf-kind">${kindIconHtml(kind, many)}</span>` : ''}${esc(name)}` : ''}</span><span class="rf-ol-pv">${chev}${value}</span></div>`,
  bullet: ({ html = '', attrs, cls = '' } = {}) => `<div class="rf-ol-bullet${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><span class="rf-ol-dot" aria-hidden="true"></span><span class="rf-ol-words">${html}</span></div>`,
  newBullet: ({ attrs, label = 'A new bullet', text = '' } = {}) => `<div class="rf-ol-bullet rf-ol-new"><span class="rf-ol-dot" aria-hidden="true"></span><span class="rf-field rf-ol-words rf-ol-write"><input type="text" value="${esc(text)}" spellcheck="true" autocomplete="off" aria-label="${esc(label)}"${attrsHtml(attrs)}></span></div>`,
  more: ({ text = '', attrs, under = 'name' } = {}) => { const b = `<button type="button" class="rf-quiet rf-faint rf-ol-more"${attrsHtml(attrs)}>${esc(text)}</button>`; return under === 'value' ? `<div class="rf-ol-line rf-ol-prop rf-ol-moreline"><span class="rf-ol-pname"></span><span class="rf-ol-pv">${b}</span></div>` : under === 'flush' ? `<div class="rf-ol-line rf-ol-moreline">${b}</div>` : under === 'leads' ? `<div class="rf-ol-line lk-row rf-ol-leads rf-ol-moreline">${outline.room()}<span class="rf-ol-lname"></span><span class="rf-ol-to">${b}</span></div>` : `<div class="rf-ol-line rf-ol-moreline">${under === 'bare' ? '' : '<span class="rf-ol-day lk-day"></span>'}${outline.room()}${b}</div>`; },
  name: ({ text = '', title = '', open = false, tag: tagTitle = '', attrs, cls = '' } = {}) => `<a href="#" class="rf-ol-name lk-node${open ? ' rf-ol-open' : ''}${cls ? ' ' + cls : ''}"${title && title !== text ? ` title="${esc(title)}"` : ''}${attrsHtml(attrs)}>${esc(text)}</a>${tagTitle ? '<wbr>' + tagLinkHtml(tagTitle) : ''}`,
  pencil: (text, attrs, cls = '') => `<button type="button" class="rf-pencil lk-pencil${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${esc(text)}</button>`,
  trail: (steps = [], here = '', end = '') => `<div class="rf-ol-trail">${steps.map(s => `<a href="#" class="rf-ol-step"${attrsHtml(s.attrs)}>${esc(s.text)}</a><span class="rf-ol-sep" aria-hidden="true">›</span>`).join('')}${here ? `<span class="rf-ol-here">${here}</span>` : ''}${end}</div>`,
  count: ({ held, of, title = 'Open these nodes', attrs } = {}) => {
    if (held == null) return '<span class="rf-ol-count lk-count rf-ol-none">—</span>';
    const words = of == null ? countWord(held) : `${countWord(held)} of ${countWord(of)}`;
    return `<a href="#" class="rf-ol-count lk-count${Number(held) === 0 ? ' rf-ol-none' : ''}" title="${esc(attrs?.title ?? title)}"${attrsHtml({ ...attrs, title: null })}>${words}</a>`;
  },
  tag: ({ text = '', open = false, attrs } = {}) => { const name = esc(String(text).replace(/^#/, '')); return `<a class="rf-tag lk-tag rf-ol-tagname${open ? ' rf-ol-open' : ''}" href="#" data-tag-page="${name}"${attrsHtml(attrs)}>${name}</a>`; },
  leads: ({ name = '', nameAttrs, inherited = false, to = null, count = '', tick = '', chev = '', attrs, cls = '' } = {}) =>
    `<div class="rf-ol-line lk-row rf-ol-leads${inherited ? ' rf-ol-inh' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${tick}${chev || outline.room()}<span class="rf-ol-lname">${name ? `<span class="rf-ol-lwords"><a href="#" class="rf-ol-name lk-node"${attrsHtml(nameAttrs)}>${esc(name)}</a>${inherited ? ' <span class="rf-ol-inhw">inherited</span>' : ''}</span>` : ''}</span>`
    + `<span class="rf-ol-to">${to ? `${outline.chev({ open: !!to.open, label: to.text, attrs: to.chevAttrs })}<span class="rf-ol-body">${outline.tag({ text: to.text, open: !!to.open, attrs: to.attrs })}${to.n != null ? `<a href="#" class="rf-ol-count lk-count rf-ol-n" title="${esc(to.nAttrs?.title ?? 'Open these nodes')}"${attrsHtml({ ...to.nAttrs, title: null })}>${countWord(to.n)}</a>` : ''}</span>` : ''}</span>${count ? `<span class="rf-ol-end">${count}</span>` : ''}</div>`,
  pointing: ({ from = {}, name = '', nameAttrs, count = '', tick = '', attrs, cls = '' } = {}) =>
    `<div class="rf-ol-line lk-row rf-ol-leads rf-ol-pointing${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${tick}${outline.chev({ open: !!from.open, label: from.text, attrs: from.chevAttrs })}<span class="rf-ol-lname"><span class="rf-ol-lwords">${outline.tag({ text: from.text, open: !!from.open, attrs: from.attrs })}</span></span>`
    + `<span class="rf-ol-to"><span class="rf-ol-body"><a href="#" class="rf-ol-name lk-node"${attrsHtml(nameAttrs)}>${esc(name)}</a></span></span>${count ? `<span class="rf-ol-end">${count}</span>` : ''}</div>`,
  group: (text = '') => `<div class="rf-ol-group">${esc(text)}</div>`,
  sum: (parts = []) => `<div class="rf-ol-sum">${parts.map((p, i) => `${i ? '<span class="rf-ol-sep" aria-hidden="true">·</span>' : ''}${p.plain ? `<span>${esc(p.text)}</span>` : `<a href="#" class="rf-ol-sumword"${attrsHtml(p.attrs)}>${esc(p.text)}</a>`}`).join('')}</div>`,
  finding: ({ html = '', act = '', actAttrs, done = false, attrs, cls = '' } = {}) => `<div class="rf-ol-line rf-ol-finding${done ? ' rf-ol-done' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><span class="rf-ol-body">${html}</span>${act && !done ? `<button type="button" class="rf-quiet rf-faint rf-ol-act"${attrsHtml(actAttrs)}>${esc(act)}</button>` : ''}</div>`,
};
// A count as people read it: 1,173, not 1173.
const countWord = n => typeof n === 'number' ? n.toLocaleString('en') : String(n ?? '');
// The chevron as an element, for the parts that build with el.
const chevron = (doc, { open = false, label = '', click, cls = '' } = {}) => { const b = fragmentOf(doc, outline.chev({ open, label, cls })).firstElementChild; if (click) b.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); click(event); }); return b; };
/* The hover card: a node's preview, every piece clickable (open(what, value): 'node', 'tag', 'day', 'prop' with the
   name, 'line' with the text). A browser popover of the hint kind, placed under what the pointer rests on. */
function card({ at, title, tag: tagTitle, day, fields = [], lines = [], empty = '', open, width = 300, cls = '', doc } = {}) {
  doc = doc || host();
  const p = popup({ at, doc, hint: true, cls: `rf-card${cls ? ' ' + cls : ''}`, width });
  const act = (what, value) => event => { event.preventDefault(); event.stopPropagation(); open?.(what, value, event); };
  const meta = [];
  if (tagTitle) meta.push(tag(doc, tagTitle, { href: '#', click: act('tag', tagTitle) }));
  if (day) { if (meta.length) meta.push(' · '); meta.push(el(doc, 'a', { href: '#', class: 'rf-card-day', click: act('day', day) }, day)); }
  // A field is [name, value] or { name, uuid, values: [{ text, uuid }] }; a line a string or { uuid, text | html }.
  const fieldRow = f => {
    const name = Array.isArray(f) ? f[0] : f.name, values = Array.isArray(f) ? [{ text: f[1] }] : f.values || [];
    const cell = el(doc, 'span');
    values.forEach((v, i) => { if (i) cell.append(', '); cell.append(el(doc, 'a', { href: '#', click: act('value', { name, ...v }) }, v.text)); });
    return [el(doc, 'a', { href: '#', class: 'rf-card-name', click: act('prop', Array.isArray(f) ? { name } : f) }, name), cell];
  };
  const lineRow = line => el(doc, 'a', { href: '#', class: 'rf-card-line', html: typeof line === 'object' && line.html ? line.html : null, click: act('line', line) }, typeof line === 'string' ? line : line.html ? null : line.text);
  // Only what is there (0.4.326): a node with no properties and no lines showed "nullnull" in its card.
  p.body.append(...[
    el(doc, 'a', { href: '#', class: 'rf-card-title', click: act('node') }, title),
    meta.length ? el(doc, 'div', { class: 'rf-note' }, ...meta) : null,
    fields.length ? el(doc, 'div', { class: 'rf-card-fields' }, ...fields.flatMap(fieldRow)) : null,
    lines.length ? el(doc, 'div', { class: 'rf-card-lines' }, ...lines.map(lineRow)) : null,
    empty && !fields.length && !lines.length ? el(doc, 'div', { class: 'rf-note' }, empty) : null].filter(Boolean));
  return p;
}

/* THE Undo of the plugin (0.4.258, at the owner's word: "make one pop-up, one Undo and one dialog"; its look is the
   proposals' faded arrow of 0.4.218, which the owner chose over the bar: "the undo toast notification is in an awful place
   and loud and too far down and distracting. it should be something just where text is but very subtle, like a faded
   icon"). After a change, a faded arrow sits beside what changed and says what it takes back when pointed at; a click
   takes it back. Each change keeps its own arrow until it is used, the page is left (main.js clears them), or the part
   forgets it, so a second change never takes the first one's Undo away (the bar did). A change offered again under the
   same key adds to that arrow: one click takes both back, the later first. When nothing of the change is on screen to
   sit beside (the nodes were deleted), the arrow waits at the bottom right with its words beside it, quiet, until used
   or the page is left. The old dark bar at the bottom is gone (0.4.311).
   undo.offer({ key, at, text, run, onFail, cls, data })  at() returns the element(s) to sit at the end of, or null;
   undo.forget(key or entry => bool), undo.clear(), undo.draw(), undo.size, undo.stop(). */
const attr = text => String(text).replace(/["\\]/g, '\\$&');
const undoState = { entries: new Map(), observer: null, listening: false, drawing: false };
const undoTargets = entry => { try { const at = entry.at?.(); return (Array.isArray(at) ? at : at ? [at] : []).filter(el => el?.isConnected); } catch (error) { return []; } };
function undoArrow(doc, key, entry, docked) {
  const arrow = doc.createElement('span');
  arrow.className = `rf-undo lk-undo${entry.cls ? ' ' + entry.cls : ''}${docked ? ' rf-undo-docked' : ''}`;
  arrow.dataset.rfUndo = key;
  arrow.setAttribute('role', 'button');
  arrow.setAttribute('contenteditable', 'false');
  arrow.setAttribute('aria-label', `Undo: ${entry.text}`);
  arrow.title = `Undo: ${entry.text}`;
  arrow.innerHTML = iconHtml('undo') + (docked ? `<span class="rf-undo-words"></span>` : '');
  if (docked) arrow.querySelector('.rf-undo-words').textContent = entry.text;
  return arrow;
}
function drawUndoArrows() {
  const doc = host();
  if (undoState.drawing) return;
  undoState.drawing = true;
  try {
    const { entries } = undoState;
    for (const arrow of doc.querySelectorAll('.rf-undo')) {
      const entry = entries.get(arrow.dataset.rfUndo);
      if (!entry) { arrow.remove(); continue; }
      const targets = undoTargets(entry);
      if (arrow.classList.contains('rf-undo-docked') ? targets.length : !targets.includes(arrow.parentElement)) arrow.remove();
    }
    let dock = doc.querySelector('.rf-undo-dock');
    for (const [key, entry] of entries) {
      const targets = undoTargets(entry);
      for (const target of targets) if (![...target.children].some(child => child.dataset?.rfUndo === key)) target.appendChild(undoArrow(doc, key, entry, false));
      if (!targets.length && !doc.querySelector(`.rf-undo-dock [data-rf-undo="${attr(key)}"]`)) {
        if (!dock) { dock = doc.createElement('div'); dock.className = 'rf-undo-dock'; doc.body.appendChild(dock); }
        dock.appendChild(undoArrow(doc, key, entry, true));
      }
    }
    if (dock && !dock.children.length) dock.remove();
  } finally { undoState.drawing = false; }
  undoState.observer?.takeRecords();
}
// A press on an arrow is the plugin's (inside a bullet Logseq would start editing it); the click takes the change back.
function onUndoArrow(event) {
  const arrow = event.target?.closest?.('.rf-undo');
  if (!arrow) return;
  event.stopImmediatePropagation();
  if (event.type !== 'pointerdown') event.preventDefault();
  if (event.type !== 'click') return;
  const key = arrow.dataset.rfUndo, entry = undoState.entries.get(key);
  undoState.entries.delete(key);
  drawUndoArrows();
  watchUndos();
  if (entry) Promise.resolve().then(entry.run).catch(error => { if (entry.onFail) entry.onFail(error); else notify('The change could not be undone', 'warning'); });
}
// The arrows are put back whenever Logseq draws the place again; the watcher runs only while there is an arrow.
function watchUndos() {
  const doc = host(), win = doc.defaultView, on = undoState.entries.size > 0;
  if (on && !undoState.observer) {
    undoState.observer = new win.MutationObserver(() => drawUndoArrows());
    undoState.observer.observe(doc.body, { childList: true, subtree: true });
  } else if (!on && undoState.observer) { undoState.observer.disconnect(); undoState.observer = null; }
  if (on && !undoState.listening) { for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) win.addEventListener(type, onUndoArrow, true); undoState.listening = true; }
  else if (!on && undoState.listening) { for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) win.removeEventListener(type, onUndoArrow, true); undoState.listening = false; }
}
const undo = {
  offer({ key, at, text, run, onFail, cls, data }) {
    const before = undoState.entries.get(key);
    const all = before ? async () => { let failed = null; try { await run(); } catch (error) { failed = error; } await before.run(); if (failed) throw failed; } : run;
    undoState.entries.set(key, { at, text: before ? `${text} · ${before.text}` : text, run: all, onFail: onFail || before?.onFail, cls, data: data ?? before?.data });
    // Drawn again, so an arrow with the old words is replaced.
    for (const arrow of host().querySelectorAll(`[data-rf-undo="${attr(key)}"]`)) arrow.remove();
    watchUndos();
    drawUndoArrows();
  },
  forget(which) {
    let gone = false;
    for (const [key, entry] of undoState.entries) if (typeof which === 'function' ? which({ key, ...entry }) : key === which) { undoState.entries.delete(key); gone = true; }
    if (gone) { drawUndoArrows(); watchUndos(); }
  },
  /* Undo by name (0.4.441): the place of an arrow found again by the row's key after every redraw, not held as an
     element a redraw replaces: in root() the row [data-key=key], then its cell [data-col=col] or the row's name. */
  near: ({ root, key, col } = {}) => () => {
    const box = typeof root === 'function' ? root() : root;
    const row = box?.isConnected ? box.querySelector(`[data-key="${attr(key)}"]`) : null;
    return row ? (col && row.querySelector(`[data-col="${attr(col)}"]`)) || row.querySelector('.rf-ol-body, .rf-ttreeval') || row : null;
  },
  clear() { if (!undoState.entries.size) return; undoState.entries.clear(); drawUndoArrows(); watchUndos(); },
  draw: () => drawUndoArrows(),
  get size() { return undoState.entries.size; },
  has: key => undoState.entries.has(key),
  keys: () => [...undoState.entries.keys()],
  stop() { undoState.entries.clear(); try { drawUndoArrows(); watchUndos(); host().querySelector('.rf-undo-dock')?.remove(); } catch (error) { /* Logseq's window is gone */ } },
};

/* THE stylesheet of the kit. Sent by main.js before any part (the foundation's own boxes must look right under
   Foundation only). Greys from currentColor, so the same rules hold on the page and in a pop-up, light and dark. */
const kitCss = `/* The kit (parts/shared.js, 0.4.311; docs/LAYERS.md section 3): one pop-up, one dialog, three buttons, one field, one
   tick box, words for chips, the tag as a class, kinds as icons, the picking bar, the hover card, the Undo arrow, the
   quiet line and the help paragraph. No colour of the plugin's own: Logseq's pop-up colours (--popover and its
   partner) and four greys mixed from the text colour. Logseq's own icon font (.ti) draws every icon. */
:root { --rf-fg: hsl(var(--popover-foreground, 0 0% 9%)); --rf-bg: hsl(var(--popover, 0 0% 100%));
  --rf-quiet: color-mix(in srgb, currentColor 70%, transparent); --rf-faint: color-mix(in srgb, currentColor 50%, transparent);
  --rf-hair: color-mix(in srgb, currentColor 12%, transparent); --rf-line: color-mix(in srgb, currentColor 26%, transparent);
  --rf-wash: color-mix(in srgb, currentColor 7%, transparent); --rf-focus: color-mix(in srgb, currentColor 3%, transparent); --rf-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
/* The pop-up: Logseq's own [[ menu look (6px corners, its light shadow, 14px rows), in the top layer, placed by the
   browser under its anchor and flipped when there is no room. */
.rf-pop { position: fixed; inset: auto; margin: 0; z-index: 10001; box-sizing: border-box; min-width: 160px; max-width: min(420px, 92vw); padding: 4px; overflow: visible;
  background: var(--rf-bg); color: var(--rf-fg); border: 1px solid var(--rf-hair); border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1);
  font-size: 14px; line-height: 1.4; text-align: left; outline: none; }
.rf-pop.rf-anchored { top: anchor(bottom); left: anchor(left); margin-top: 4px; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline; }
.rf-lsq-pop { position: fixed; inset: auto; margin: 0; padding: 0; width: 14rem; overflow: visible; }
.rf-lsq-pop .menu-link .flex-row > div:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-lsq-pop.rf-anchored { top: anchor(bottom); left: anchor(left); margin-top: 4px; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline; }
.rf-lsq-pop .rf-lsq-list { max-height: 18rem; overflow-y: auto; }
.rf-in-place { font: inherit; color: inherit; height: auto; width: 100%; min-width: 4em; padding: 0; box-shadow: none; }
/* With nothing to sit under (a pop-up opened from the palette): near the top, in the middle. */
.rf-pop:not(.rf-anchored) { top: 12vh; left: 50%; transform: translateX(-50%); }
.rf-pop-head { padding: 3px 8px; font-size: 12px; color: var(--rf-quiet); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-pop-body { max-height: 320px; overflow-y: auto; }
.rf-item { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 6px 8px; border: 0; border-radius: 4px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rf-item > :is(.ti, .rf-drawn) { width: 16px; flex: none; color: var(--rf-faint); font-size: 15px; }
.rf-item > .rf-drawn { justify-content: center; align-self: center; }
.rf-item:hover, .rf-item.rf-on { background: var(--rf-wash); }
.rf-item:disabled { opacity: .45; cursor: default; }
.rf-item-words { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-item kbd, .rf-end { margin-left: auto; flex: none; font: inherit; font-size: 12px; color: var(--rf-faint); }
.rf-pop hr { margin: 4px 6px; border: 0; border-top: 1px solid var(--rf-hair); }
.rf-pop .rf-field { margin: 0 8px 4px; }
/* A report to copy (the troubleshooting tools): the text in a quiet box, Copy as the one word. */
.rf-report { padding: 8px 10px; max-width: min(720px, 92vw); }
.rf-report > .rf-pop-body { max-height: none; }
/* The Recycle list (troubleshooting): as tall as the window allows below the pop-up's place, so many lines show at once. */
.rf-recycle { max-width: min(640px, 92vw); }
.rf-recycle > .rf-pop-body { max-height: calc(84vh - 60px); }
.rf-recycle-delete:hover { color: var(--rf-fg); text-decoration: underline; }
.rf-report textarea { display: block; box-sizing: border-box; width: 100%; height: min(50vh, 420px); margin: 6px 0 0; padding: 6px 8px; border: 0; border-radius: 4px; background: var(--rf-wash); color: inherit; font: 12px/1.45 var(--rf-mono); resize: vertical; outline: none; }
/* A question beside what it is about. */
.rf-ask { padding: 8px 10px; }
.rf-ask-words { font-weight: 600; margin: 2px 0; }
.rf-ask .rf-field { margin: 6px 0 2px; width: 100%; }
.rf-btns { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px; }
/* The window: the browser's dialog in the kit's colours; the settings window only. */
.rf-dialog { position: fixed; inset: 0; margin: auto; padding: 0; box-sizing: border-box; width: min(700px, 92vw); max-height: 86vh; overflow: auto;
  background: var(--rf-bg); color: var(--rf-fg); border: 1px solid var(--rf-hair); border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.14); font-size: 14px; line-height: 1.4; text-align: left; }
.rf-dialog::backdrop { background: rgba(0,0,0,.18); }
/* The three buttons: quiet, go, pressed. No fills, no edges. */
.rf-quiet { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: var(--rf-quiet); font: inherit; font-size: 14px; line-height: 1; cursor: pointer; white-space: nowrap; }
.rf-quiet > .ti { font-size: 15px; }
.rf-quiet > .rf-drawn { width: 15px; justify-content: center; }
.rf-quiet:hover { background: var(--rf-wash); color: inherit; }
.rf-quiet[aria-pressed="true"] { color: inherit; font-weight: 600; background: none; }
.rf-quiet:disabled { opacity: .45; cursor: default; background: none; }
.rf-go { display: inline-flex; align-items: center; height: 24px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: inherit; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 3px; }
.rf-go:hover { background: var(--rf-wash); }
.rf-go:disabled { opacity: .45; cursor: default; background: none; }
:is(.rf-quiet, .rf-go, .rf-item, .rf-chip):focus-visible { outline: 2px solid var(--rf-line); outline-offset: 1px; }
.rf-faint { color: var(--rf-faint); }
/* Two or three quiet words with a hairline between them: a two-way choice. */
.rf-seg { display: inline-flex; }
.rf-seg > .rf-quiet + .rf-quiet { border-left: 1px solid var(--rf-line); border-radius: 0 4px 4px 0; }
.rf-seg > .rf-quiet:first-child { border-radius: 4px 0 0 4px; }
/* The field: a hairline underneath, firmer while typing. */
.rf-field { display: flex; align-items: center; gap: 6px; box-sizing: border-box; padding: 2px; border: 0; border-bottom: 1px solid var(--rf-line); background: transparent; min-height: 26px; font-size: 14px; line-height: 1.4; }
.rf-field:focus-within { border-bottom-color: currentColor; }
.rf-field > :is(input, textarea) { flex: 1; min-width: 0; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; color: inherit; font: inherit; outline: none; box-shadow: none; }
.rf-field > :is(input, textarea)::placeholder { color: var(--rf-faint); }
.rf-field-tall { align-items: flex-start; }
.rf-field-tall > textarea { resize: vertical; line-height: 1.4; }
.rf-pop-list { max-height: 300px; overflow-y: auto; }
.rf-field > :is(.ti, .rf-drawn), .rf-field > kbd { flex: none; color: var(--rf-faint); font: inherit; font-size: 12px; }
.rf-field > .ti { font-size: 15px; }
.rf-field-inline { display: inline-flex; min-height: 22px; vertical-align: baseline; }
/* The drawn field: the same look, the text and the caret drawn, so nothing takes the keyboard from the bullet. */
/* The drawn caret sits right against the letters (0.4.321, the owner: "the cursor is a couple spaces ahead of text"): no gap
   between the pieces of the drawn field, the key hint kept apart by its own room. */
.rf-field-drawn { align-items: baseline; gap: 0; }
.rf-field-drawn > .rf-typed { flex: 0 1 auto; min-width: 0; white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.rf-field-drawn > .rf-typed-fresh { background: var(--rf-wash); border-radius: 2px; }
.rf-field-drawn > .rf-placeholder { flex: 1; min-width: 0; color: var(--rf-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-field-drawn > .rf-caret { display: inline-block; flex: none; width: 1.5px; height: 1.1em; margin-left: 1px; transform: translateY(.2em); background: currentColor; animation: rf-blink 1s steps(1) infinite; }
.rf-field-drawn > .rf-placeholder + .rf-caret { order: -1; margin: 0 1px 0 0; }
.rf-field-drawn > kbd { margin-left: auto; padding-left: 6px; }
@keyframes rf-blink { 50% { opacity: 0; } }
.rf-item.rf-new > .rf-item-words { font-style: italic; }
/* The tick box: the browser's checkbox as a small rounded square, a check mark inside when on. */
input.rf-check[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative; box-sizing: border-box; width: 13px; height: 13px; margin: 0; padding: 0; flex: none; border: 1px solid var(--rf-line); border-radius: 3px; background: none; color: inherit; vertical-align: -1px; cursor: pointer; outline: none; box-shadow: none; }
/* Logseq's own forms rule paints a checked box blue with a drawn tick (Tailwind forms); the kit's square keeps its own. */
input.rf-check[type=checkbox]:checked, input.rf-check[type=checkbox]:indeterminate, input.rf-check[type=checkbox]:focus { background-color: transparent !important; background-image: none !important; border-color: currentColor !important; color: inherit !important; box-shadow: none !important; }
input.rf-check:checked::before { content: ""; position: absolute; left: 3.5px; top: .5px; width: 3.5px; height: 7px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
input.rf-check:indeterminate::before { content: ""; position: absolute; left: 2px; right: 2px; top: 5px; height: 1.5px; background: currentColor; }
input.rf-check:focus-visible { outline: 2px solid var(--rf-line); outline-offset: 1px; }
.rf-tick { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
/* Words for chips: a filter, or a removable item with a × on hover. */
.rf-chip { display: inline-flex; align-items: center; gap: 2px; padding: 0; border: 0; background: none; color: var(--rf-quiet); font: inherit; font-size: 14px; cursor: default; }
button.rf-chip { cursor: pointer; }
.rf-chip[aria-pressed="true"] { color: inherit; font-weight: 600; }
.rf-chip-x { display: inline-flex; border: 0; padding: 0 2px; background: none; color: var(--rf-faint); font-size: 12px; cursor: pointer; opacity: 0; }
.rf-chip:hover .rf-chip-x, .rf-chip-x:focus-visible { opacity: 1; }
/* A tag as a class: mono, the tag grey, no #, no underline (0.4.332: the mono face says it is a tag, and every tag is a
   link); darker under the pointer. */
/* A tag's look (mono, small capitals, grey) is Look's, through lk-tag; only its shape stays here. */
.rf-tag { font-style: normal; font-weight: 400; color: inherit; text-decoration: none; border: 0; cursor: default; }
a.rf-tag { cursor: pointer; }
a.rf-tag:hover { opacity: 1; }
/* A value's kind as an icon left of the property's name. */
.rf-kind { display: inline-flex; color: var(--rf-faint); font-size: 15px; vertical-align: -2px; }
/* The picking bar: one line of words above the list, a hairline under it. */
/* A cell changed where it sits (0.4.430; the table it came with is gone since 0.4.456). */
.rf-tedit { cursor: pointer; border-radius: 2px; }
.rf-tedit:hover { text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 3px; }
@keyframes rf-unroll { from { grid-template-rows: 0fr; } to { grid-template-rows: 1fr; } }
@keyframes rf-rollup { from { grid-template-rows: 1fr; } to { grid-template-rows: 0fr; } }
@keyframes rf-unroll-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
/* THE chevron (0.4.441): the one control that opens what is under it. A 16 px mark in a 24 px place to click, faint at
   rest and never hidden, full on its line, turned down while open. */
.rf-chev { all: unset; box-sizing: border-box; position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 20px; cursor: pointer; color: inherit; border-radius: 3px; transition: opacity .12s; }
.rf-chev::before { content: ''; position: absolute; inset: -2px -4px; }
.rf-chev .ti { font-size: 15px; transition: transform .16s ease; }
.rf-chev[aria-expanded="true"] .ti { transform: rotate(90deg); }
.rf-chev:focus-visible { outline: 1px solid var(--rf-line); }
.rf-chev-room { flex: none; display: inline-block; width: 16px; }
/* THE outline: lines, what opens under them, the focus. --rf-ol-day is the days' column (a list with a day of another year sets it wider), --rf-ol-name the property names'
   column, one width at every depth so the names of nodes at one depth line up. */
.rf-ol { --rf-ol-day: 48px; --rf-ol-name: 10em; --rf-ol-gap: 6px; font-size: 14px; line-height: 1.5; }
.rf-ol-line { position: relative; display: flex; align-items: baseline; gap: var(--rf-ol-gap); min-height: 28px; box-sizing: border-box; padding: 3px 4px; margin-left: -4px; border-radius: 4px; }
.rf-ol-line:hover { background: var(--rf-wash); }
.rf-ol-line > .rf-chev, .rf-ol-pv > .rf-chev { align-self: flex-start; top: 0; height: 1.5em; }
/* A value that opens hangs its chevron just left of the value (the drawing; the owner, 2026-10-27: the values of one
   column start at one edge), so "cisplatin" starts where "1" and "Oct 20" do. */
.rf-ol-pv > .rf-chev:first-child { margin-left: calc(-16px - var(--rf-ol-gap)); }
.rf-ol-line > input.rf-check[type=checkbox] { position: absolute; left: -20px; top: 8px; margin: 0; opacity: .3; }
.rf-ol-line:hover > input.rf-check[type=checkbox], .rf-ol-line > input.rf-check[type=checkbox]:checked, .rf-ol-line > input.rf-check[type=checkbox]:focus-visible { opacity: 1; }
.rf-ol-day { flex: none; width: var(--rf-ol-day); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rf-ol-body { min-width: 0; overflow-wrap: normal; }
.rf-ol-body > .rf-tag, .rf-ol-pv .rf-tag { margin-left: 6px; font-size: 12.5px; white-space: nowrap; }
.rf-ol-open { font-weight: 600; }
.rf-ol-kids { --rf-ol-cx: 8px; display: grid; grid-template-rows: 1fr; margin: 0 0 0 var(--rf-ol-cx); padding-left: 16px; border-left: 1px solid var(--rf-line); }
.rf-ol-kids > .rf-ol-in { min-width: 0; min-height: 0; padding-bottom: 2px; }
.rf-ol-from-day { --rf-ol-cx: calc(var(--rf-ol-day) + var(--rf-ol-gap) + 8px); }
.rf-ol-from-prop { --rf-ol-cx: calc(var(--rf-ol-name) - 8px); }
.rf-ol-from-back { --rf-ol-cx: calc(var(--rf-ol-name) + var(--rf-ol-day) + 2 * var(--rf-ol-gap) + 8px); }
/* Opening grows the room under the line from nothing, so what is below slides down with it; closing
   rolls it back up before it goes (outline.close). */
.rf-ol-kids.rf-ol-unroll { animation: rf-unroll .18s ease-out; }
.rf-ol-kids.rf-ol-rollup { animation: rf-rollup .14s ease-in forwards; }
:is(.rf-ol-unroll, .rf-ol-rollup) > .rf-ol-in { overflow: hidden; }
.rf-ol-unroll > .rf-ol-in { animation: rf-unroll-in .18s ease-out; }
.rf-ol-unit { margin: 0 -6px; padding: 0 6px; border-radius: 6px; transition: background-color .16s ease; }
.rf-ol-unit.rf-ol-focus { background: var(--rf-focus); }
.rf-ol-prop > .rf-ol-pname { flex: none; width: var(--rf-ol-name); display: inline-flex; gap: 6px; align-items: baseline; color: var(--rf-quiet); overflow-wrap: anywhere; }
.rf-ol-prop > .rf-ol-pname .rf-kind { font-size: 13px; vertical-align: 0; width: 13px; justify-content: center; flex: none; opacity: .6; } /* as faint as on a page's rows */
/* A drawn mark sits like a font icon: on the words' line, in their colour (the kit's ICONS, DRAWN). */
.rf-drawn { display: inline-flex; align-items: center; line-height: 1; }
.rf-drawn > svg { display: block; width: 12px; height: 12px; }
.rf-ol-pv { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: var(--rf-ol-gap); overflow-wrap: normal; word-break: normal; }
.rf-ol-pv > .rf-ol-body { flex: 1 1 auto; }
/* From the second level down the names' column is narrower, so three levels leave the names room at a page's width; set
   on what a second-level node holds, so the lines and the hairline under them read the same width. */
.rf-ol-kids .rf-ol-kids > .rf-ol-in { --rf-ol-name: 8.5em; }
/* A list that opens with no line of its own (a row's list): the same unrolling, no hairline. */
.rf-ol-kids.rf-ol-bare { margin-left: 0; padding-left: 0; border-left: 0; }
.rf-ol-pv > .rf-ol-day { margin-right: 0; }
.rf-ol-bullet { display: flex; align-items: baseline; gap: 8px; min-height: 26px; padding: 1px 4px; margin-left: -4px; }
.rf-ol-dot { flex: none; width: 16px; text-align: center; color: var(--rf-faint); }
.rf-ol-dot::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; vertical-align: 2px; }
.rf-ol-words { min-width: 0; flex: 1; outline: none; }
.rf-ol-new > .rf-ol-dot { opacity: .45; }
.rf-field.rf-ol-write { display: flex; border: 0; padding: 0; min-height: 21px; font-size: inherit; line-height: inherit; }
.rf-field.rf-ol-write > input { cursor: text; caret-color: currentColor; }
.rf-ol-more { padding: 2px 0; font-size: 13px; }
.rf-ol-line.rf-ol-moreline { min-height: 24px; padding-top: 0; padding-bottom: 0; }
.rf-ol-line.rf-ol-moreline:hover { background: transparent; }
.rf-ol-name { color: inherit; cursor: pointer; } /* its underline and mark are Look's, through lk-node */
/* Narrow (the sidebar, a narrow window): inside an opened node a property's name sits on its own line above the nodes it
   holds or that point through it,
   and the indent gives way, so three levels still fit with whole words. Only where the section is truly narrow: at
   the page's width the values' column is about 540 px wide in a 1100 px window, and 560 put every linked property on
   two lines there (the review, 31 October); below 420 the names' column would take a third of the room. */
.rf-ol { container: rf-ol / inline-size; }
@container rf-ol (max-width: 420px) {
  .rf-ol-kids { padding-left: 10px; }
  .rf-ol-kids .rf-ol-prop:has(> .rf-ol-pv > :is(.rf-chev, .rf-ol-day)) { flex-wrap: wrap; }
  .rf-ol-kids .rf-ol-prop:has(> .rf-ol-pv > :is(.rf-chev, .rf-ol-day)) > .rf-ol-pname { width: auto; flex-basis: 100%; }
  .rf-ol-kids .rf-ol-prop > .rf-ol-pname:empty { display: none; }
  .rf-ol-kids .rf-ol-from-prop { --rf-ol-cx: 8px; }
  .rf-ol-kids .rf-ol-prop:has(> .rf-ol-pv > :is(.rf-chev, .rf-ol-day)) > .rf-ol-pv > .rf-chev:first-child { margin-left: 0; }
  .rf-ol-kids .rf-ol-from-back { --rf-ol-cx: calc(var(--rf-ol-day) + var(--rf-ol-gap) + 8px); }
  .rf-ol-leads, .rf-ol-kids { --rf-ol-lname: 7.5em; }
  .rf-ol-leads:not(.rf-ol-pointing) { flex-wrap: wrap; }
  .rf-ol-leads:not(.rf-ol-pointing) > .rf-ol-lname { flex: 1 1 auto; width: auto; }
  .rf-ol-leads:not(.rf-ol-pointing) > .rf-ol-lname:empty { display: none; }
  .rf-ol-leads:not(.rf-ol-pointing) > .rf-ol-end { order: 1; }
  .rf-ol-leads:not(.rf-ol-pointing) > .rf-ol-to { order: 2; flex-basis: 100%; padding-left: calc(16px + var(--rf-ol-gap)); box-sizing: border-box; }
  .rf-ol-from-leads, .rf-ol-kids .rf-ol-from-leads { --rf-ol-cx: calc(16px + var(--rf-ol-gap) + 8px); }
  .rf-ol-end { min-width: 3.6em; padding-left: 8px; } }
.rf-pencil { all: unset; cursor: pointer; } /* italic, grey and dotted are Look's, through lk-pencil */
.rf-pencil:hover { color: var(--rf-quiet); }
.rf-pencil.rf-pencil-taken { font-style: normal; color: inherit; text-decoration: none; }
.rf-pencil:focus-visible { outline: 1px solid var(--rf-line); border-radius: 2px; }
.rf-ol-trail { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; font-size: 13px; color: var(--rf-quiet); }
.rf-ol-step { color: inherit; text-decoration: underline; text-decoration-color: var(--rf-hair); text-underline-offset: 3px; }
.rf-ol-step:hover { color: var(--rf-fg); }
.rf-ol-sep { color: var(--rf-faint); }
.rf-ol-here { color: inherit; font-weight: 600; }
.rf-ol-here .rf-tag { margin-left: 6px; font-weight: 400; }
/* The tag map's pieces (0.4.448): the count column, a property with the tag it leads to, a group's heading, a finding.
   --rf-ol-lname is the property names' column, so the tags they lead to start on one column and open under themselves. */
.rf-ol { --rf-ol-lname: 9.5em; }
.rf-ol.rf-ol-margin { position: relative; padding-left: 24px; }
.rf-ol-margin .rf-ol-line { position: static; }
.rf-ol-margin .rf-ol-line > input.rf-check[type=checkbox] { left: 2px; top: auto; margin-top: 5px; }
.rf-ol-margin .rf-ol-unroll > .rf-ol-in { animation-name: rf-unroll-fade; }
@keyframes rf-unroll-fade { from { opacity: 0; } to { opacity: 1; } }
.rf-ol-end { flex: none; margin-left: auto; padding-left: 12px; min-width: 5.2em; text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rf-ol-count { color: inherit; text-decoration: underline; text-decoration-color: var(--rf-line); text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
.rf-ol-count:hover { text-decoration-color: currentColor; }
.rf-ol-count.rf-ol-none { color: var(--rf-faint); }
span.rf-ol-count { text-decoration: none; cursor: default; }
.rf-ol-tagname { opacity: 1; cursor: pointer; font-size: 13.5px; }
.rf-ol-tagname.rf-ol-open { font-weight: 700; }
.rf-ol-leads > .rf-ol-lname { flex: none; width: var(--rf-ol-lname); display: inline-flex; gap: 6px; align-items: baseline; }
.rf-ol-lwords { min-width: 0; overflow-wrap: normal; word-break: normal; }
.rf-ol-inh > .rf-ol-lname { color: var(--rf-quiet); }
.rf-ol-inhw { color: var(--rf-faint); font-size: 12.5px; white-space: nowrap; }
.rf-ol-to { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: var(--rf-ol-gap); }
.rf-ol-to > .rf-chev { align-self: flex-start; top: 1px; }
.rf-ol-to .rf-tag { font-size: 13px; }
.rf-ol-to .rf-ol-open { font-weight: 700; }
.rf-ol-count.rf-ol-n { margin-left: 6px; color: var(--rf-faint); font-size: 12.5px; font-variant-numeric: tabular-nums; text-decoration-color: var(--rf-line); }
.rf-ol-pointing > .rf-ol-lname .rf-tag { font-size: 13px; }
.rf-ol-pointing > .rf-ol-lname { width: var(--rf-ol-lname); } /* one column for every line of a list; a tag longer than it wraps between its words */
.rf-ol-pointing > .rf-ol-lname .rf-tag { white-space: normal; overflow-wrap: normal; word-break: normal; }
.rf-ol-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; font-size: 14px; color: var(--rf-quiet); }
.rf-ol-sumword { color: inherit; text-decoration: underline; text-decoration-color: var(--rf-line); text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
.rf-ol-sumword:hover { text-decoration-color: currentColor; }
.rf-ol-sumword[aria-pressed="true"] { color: inherit; font-weight: 600; text-decoration-color: currentColor; }
.rf-ol-from-leads { --rf-ol-cx: calc(16px + 2 * var(--rf-ol-gap) + var(--rf-ol-lname) + 8px); }
.rf-ol-group { box-sizing: border-box; min-height: 24px; padding: 6px 0 0 calc(16px + var(--rf-ol-gap)); font-size: 12.5px; color: var(--rf-faint); }
.rf-ol-finding > .rf-ol-body { flex: 1 1 auto; }
.rf-ol-finding .rf-tag { margin: 0; font-size: 13px; }
.rf-ol-act { flex: none; margin-left: auto; height: 22px; font-size: 13.5px; }
.rf-ol-line:hover > .rf-ol-act { color: var(--rf-quiet); }
.rf-ol-done > .rf-ol-body { color: var(--rf-quiet); }
.rf-field-count { flex: none; color: var(--rf-faint); font-size: 12.5px; font-variant-numeric: tabular-nums; padding-left: 6px; }
@media (prefers-reduced-motion: reduce) { .rf-chev .ti, .rf-ol-unit { transition: none; } .rf-ol-kids.rf-ol-unroll, .rf-ol-kids.rf-ol-rollup, .rf-ol-unroll > .rf-ol-in { animation: none; } }
.rf-tree-dim .rf-item-words { opacity: .45; }
/* A kind's mark (0.4.473), 10 px in the quiet grey; a kind's row in a list of tags: its mark and its word in weight, as
   the map's headings, the count of its nodes at the end in the quiet grey. */
.rf-kindmark { display: inline-block; width: 10px; height: 10px; flex: none; color: var(--rf-quiet); vertical-align: -1px; margin-right: 6px; }
.rf-kindrow { font-weight: 600; font-family: inherit; }
.rf-tree-n { color: var(--rf-quiet); font-variant-numeric: tabular-nums; }
.rf-tree-dim .rf-kindrow { opacity: .45; }
.rf-tree-kids { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; cursor: pointer; }
.rf-tree-tri { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; }
.rf-tree-tri .ti { font-size: 15px; color: var(--rf-faint); transition: transform .12s ease; }
.rf-tree-tri.rf-tree-open .ti { transform: rotate(90deg); }
.rf-tree-chosen { margin-left: 6px; }
.rf-bar { display: flex; flex-wrap: nowrap; align-items: center; gap: 2px 6px; padding: 2px 0 6px; margin-bottom: 6px; border-bottom: 1px solid var(--rf-hair); font-size: 14px; white-space: nowrap; min-width: 0; overflow: hidden; }
.rf-bar.rf-bar-idle { visibility: hidden; }
.rf-bar > * { flex: none; }
.rf-bar > .rf-bar-extra { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 2px 10px; }
.rf-bar > .rf-bar-extra:empty { display: none; }
.rf-bar:has(> .rf-bar-extra:not(:empty)) > .rf-bar-later { display: none; }
.rf-bar:not(.rf-bar-hasmore):not(:has(> .rf-bar-extra:not(:empty))) > .rf-bar-more { display: none; }
.rf-bar > .rf-bar-extra { flex: 1 1 auto; }
.rf-bar-extra .rf-bar-extra > * { flex: none; }
.rf-bar-extra > :not(:last-child):not(.rf-note) { flex: 0 1 auto; min-width: 0; overflow: hidden; }
.rf-count { display: inline-flex; align-items: center; gap: 6px; padding-right: 10px; font-weight: 600; cursor: pointer; }
/* The hover card: a node's preview with a little room. */
.rf-card { padding: 10px 12px; font-size: 14px; }
.rf-card a { color: inherit; text-decoration: none; }
.rf-card-title { display: block; font-weight: 600; margin-bottom: 3px; }
.rf-card-title:hover, .rf-card-fields a:hover, .rf-card-line:hover, .rf-card-day:hover { text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 3px; }
.rf-card-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; row-gap: 4px; margin-top: 8px; }
.rf-card-name { color: var(--rf-faint); }
.rf-card-lines { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--rf-hair); color: var(--rf-quiet); }
.rf-card-line { display: block; border-radius: 4px; margin: 0 -4px; padding: 0 4px; }
.rf-card-line:hover { background: var(--rf-wash); text-decoration: none; }
.rf-card-line::before { content: '• '; color: var(--rf-faint); }
/* The quiet line and the help paragraph. */
.rf-note { font-size: 12px; line-height: 1.45; color: var(--rf-faint); padding: 2px 0; }
.rf-pop .rf-note { padding: 4px 8px; }
.rf-day { color: var(--rf-faint); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.rf-guide { padding: 2px 0 2px 10px; border-left: 1px solid var(--rf-line); font-size: 14px; color: var(--rf-quiet); }
.rf-guide p { margin: 0 0 4px; }
.rf-guide p:last-child { margin-bottom: 0; }
/* Quiet words to pick one of. */
.rf-pick { display: inline-flex; flex-wrap: wrap; gap: 2px; }
.rf-pick .rf-quiet { font-size: 13px; height: 22px; padding: 0 5px; }
/* THE Undo (undo.offer): a faded arrow at the end of what changed, clearer under the pointer; with nothing on screen to
   sit beside, it waits at the bottom right with its words, as quiet. */
.rf-undo { display: inline-flex; align-items: center; gap: 6px; vertical-align: -2px; margin-left: .4em; color: currentColor; cursor: pointer; transition: opacity .15s; }
.rf-undo > .ti { font-size: 14px; }
.rf-undo:hover { opacity: .75; }
.rf-undo-dock { position: fixed; z-index: 10002; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: min(420px, 60vw); color: var(--rf-fg); font-size: 12px; }
.rf-undo-docked { margin: 0; padding: 3px 9px; border-radius: 6px; opacity: 1; background: var(--rf-bg); border: 1px solid var(--rf-hair); color: var(--rf-quiet); }
.rf-undo-docked:hover { color: var(--rf-fg); }
.rf-undo-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-anchor { position: fixed; width: 0; height: 0; pointer-events: none; }

`;

// This file's own boxes: the kit's pop-ups, anchors and dialog, and the Undo dock.
leftovers.push({ prefix: 'Threads: ', elements: '.rf-pop, .rf-anchor, dialog.rf-dialog, .rf-undo-dock' });

// THE finder of the plugin's marks on Logseq's screen (2026-10-23): every class and attribute prefix any part uses.
// The troubleshooting box counts with it, the boot test looks for leftovers with it and the frame tests
// (tools/frames.js, tools/app-frames.js) track with it, so a new prefix is never counted by one and missed by another.
// A new prefix goes here and nowhere else.
const MARK_CLASS = /^(refinement-|rf-|rfs-|rfp-|rtg-|rs-)/, MARK_ATTR = /^data-(refinement|rf|rfs)-/;
const isOwnMark = node => node?.nodeType === 1 && ([...node.attributes].some(attr => MARK_ATTR.test(attr.name))
  || (typeof node.className === 'string' && [...node.classList].some(cls => MARK_CLASS.test(cls))));
// Every mark in doc, counted: 'data-rf-x' → n, '.rf-y' → n.
function ownMarks(doc) {
  const marks = new Map();
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of node.attributes) if (MARK_ATTR.test(attr.name)) marks.set(attr.name, (marks.get(attr.name) || 0) + 1);
    if (typeof node.className === 'string') for (const cls of node.classList) if (MARK_CLASS.test(cls)) marks.set('.' + cls, (marks.get('.' + cls) || 0) + 1);
  }
  return marks;
}

window.refinementShared = {
  host, notify, lifecycle, sweepLeftovers, take, feature, screen, openEntity, openPageNamed, settingReader, graphNamedIn, perf, warnings,
  kitCss, el, esc, fragmentOf, ICONS, icon, iconHtml, KINDS, kindIcon, kindIconHtml, ONTOLOGY, umbrellaKind, kindOfTag, kindMarkHtml, tag, tagLinkHtml, quiet, go, keepKeys, field, fieldHtml, drawnField, outline, chevron, tick, chip, note, guide, choices, popup, popups, pickValue, editInPlace, ask, dialog, bar, cellEdit, tagTreeRows, card, undo,
  MARK_CLASS, MARK_ATTR, isOwnMark, ownMarks, lifeCounts,
};
})();
