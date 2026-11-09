/* Loaded by main.js first, before the other parts. Kept in its own scope. */
(() => {
/* The plumbing of layer 1 that lives in the plugin's frame, and THE KIT (layer 2, docs/LAYERS.md section 3): the
   pieces every part draws with, each drawn once, with one stylesheet. This header is the contract between the files.

   WHAT THIS FILE PROVIDES, on window.Threads.shared (and nothing else):

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
   - screen                       THE screen door (core.screen): waitFor, press, typeInto, key, floating, item, sidebarItems,
                                  popupOpen, escapeMenus: the one way to work Logseq's own boxes.
   - openEntity(uuid, inSidebar)  opens a page or block by uuid, in the right sidebar when asked.
   - openPageNamed(name, inSidebar)   opens a page by its name the same way.
   - settingReader(schema)        returns setting(key): the saved value, or the schema's default when
                                  the saved value is missing or of another type.
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
   - kitCss                       THE stylesheet: the greys, the pop-up, the dialog, the quiet button, the field,
                                  the tick box, the words for chips, the tag, the kind icons, the picking bar, the
                                  hover card, the Undo arrow, the quiet line and the help paragraph. Sent by main.js
                                  before any part. Colours: Logseq's --popover pair and the text colour; the four
                                  greys mixed from currentColor (quiet .7, faint .5, hairline 12%, line 26%, wash 7%).
   - el(doc, tag, props, ...children)   THE element builder: class, html (parsed), a function is a listener, true
                                  is an empty attribute, null and false are skipped.
   - esc(text)                    THE text escaper for innerHTML.
   - ICONS, icon(doc, name), iconHtml(name)   THE icon list: a meaning ('sidebar', 'tag'…) or a Tabler name,
                                  drawn from Logseq's own icon font (<i class="ti ti-…">); the one shape the font lacks,
                                  three dots joined in a triangle ('joins'), drawn once here (DRAWN).
   - kindIconHtml(kind)           a value's kind as an icon: three dots joined in a triangle for a link to
                                  one node or several, a calendar, Aa, 123, a box with a chevron for a choice.
   - tag(doc, title, props)       a tag as a class: its name alone, no #, mono, the tag grey, a link to its page (plain:
                                  true where a click already chooses; a click of its own never follows the "#");
   - quiet(doc, { icon, label, title, pressed, run })   a press of the library's third level (lk-btn lk-low); go(doc, { label, run })
                                  the one that does what was asked, the library's lk-accent; pressed is in force, aria-pressed="true".
   - field(doc, { placeholder, value, icon, kbd, inline, multiline, keys, input })   the library's field (lk-field), a real
                                  text box on a hairline (a few lines tall with multiline); keys typed in it never
                                  reach Logseq; .input is the box.
   - note(doc, text)              the library's quiet line (lk-note).
   - popup({ at, kind, head, items, field, rows, manual, hint, cls, width, onClose })   THE pop-up, the library's lk-pop: the browser's
                                  popover, placed under its anchor (an element or a rect) by CSS anchor positioning
                                  and flipped when there is no room, dismissed by the browser on Escape or a click
                                  outside; a menu filling (items: icon, label, kbd, on, run) or a list filling (the
                                  field, then rows(query)); Up, Down and Enter handled here. Returns { el, close,
                                  items, lit, field, query, closed }. popups.closeAll() closes every open one (unload).
   - pickValue({ at, placeholder, options, clearLabel, free })   Logseq's own value picker, in Logseq's own classes.
   - editInPlace({ at, value, type, placeholder, wrap })    a value typed where it sits, as Logseq does for a number.
     wrap: the words wrap as they are written (a bullet's): a box as tall as they are, growing line by line; Shift-Enter breaks a line.
   - ask({ at, question, note, go, cancel, field })   a question beside what it is about: Cancel and the one that
                                  does it as words; resolves true/false, or the field's text / null (field.select
                                  starts with its words selected; multiline takes Shift-Enter for a new line).
   - card({ at, title, tag, day, fields, lines, empty, open })   the hover card: a node's preview, every piece clickable
                                  (open(what, value, event): 'node', 'prop', 'value', 'line').
   - undo                         the door's one Undo (PluginDoor.undo), every offer with owner 'threads'; undo.near({ root,
                                  key, col }) names an arrow's place by a row's key, found again after every redraw.

   WHAT EVERY OTHER PART MUST DO:
   - wrap itself in its own scope, `(() => { … })();`
   - take what it needs from window.Threads.shared (`const shared = window.Threads.shared;`), and
     make its own lifecycle with its own prefix and, when it cleans up Logseq's window, its own stopKey,
     so that a reload still stops each part's earlier copy on its own;
   - push { name, schema, provide?, start, ready?, commands?, moved?, foundation?, stop } onto window.Threads.parts
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
   window.Threads.shared as they load, and parts/model.js second: the one part that knows what a page,
   block, tag, property, journal day and link are in a DB graph (titles, the stored form of a link, the
   property schema, the pages, days, journal titles, the Logseq version checked with). It provides them
   through core.provided, so every other part reads the graph through it with take(); the core itself knows
   nothing of content. main.js itself takes its helpers from here once the parts
   have loaded (useShared), before it gives Logseq the settings and before main() runs, and main()
   publishes window.Threads.core before it starts any part. */

// ===== Layer 1: talking to Logseq from the frame =====

// The Logseq window. The plugin runs in a frame inside it.
const { host, notify, esc } = window.PluginDoor;

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
const lifeCounts = () => lives.reduce((out, { prefix, unloadTasks }) => { const key = prefix.replace(/^Threads ?\(?|\)?: $/g, '') || 'core'; out[key] = (out[key] || 0) + unloadTasks.length; return out; }, {});
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
  floating: el => el.getClientRects().length > 0 && !el.closest('#right-sidebar, #main-content-container, #left-sidebar, .cp__header, .th-pop, .th-tags'),
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

// HTML given to el (an icon, a tag's words) is parsed once per document and copied after (2026-10-23: the tag map of
// 600 tags parsed the same few icons thousands of times a redraw, its slowest step). At most 500 kept.
const parsed = new WeakMap();
// THE element builder: el(doc, 'button', { class: 'th-quiet', title: 'Undo', click: () => … }, icon, 'Undo').
const el = window.PluginDoor.el;

/* THE icon list: what each icon means, by the name of its Tabler icon in Logseq's own font (loaded on every page;
   Logseq draws its own toolbar with it), so the plugin draws no icon of its own, but for the one shape the font lacks
   (DRAWN, below). */
const ICONS = {
  sidebar: 'layout-sidebar-right-expand', page: 'file-text', fold: 'chevron-right', add: 'plus', more: 'dots',
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
  joins: window.PluginDoor.WEB,
};
const iconHtml = name => { const n = ICONS[name] || name; return DRAWN[n] ? `<i class="th-drawn th-drawn-${n}" aria-hidden="true">${DRAWN[n]}</i>` : `<i class="ti ti-${esc(n)}" aria-hidden="true"></i>`; };
const icon = (doc, name, title) => { const n = ICONS[name] || name;
  return el(doc, 'i', { class: DRAWN[n] ? `th-drawn th-drawn-${n}` : `ti ti-${n}`, html: DRAWN[n] || null, 'aria-hidden': title ? null : 'true', title: title || null }); };
// A value's kind as an icon left of the property's name: the door's, the one drawing every module uses.
const kindIconHtml = kind => window.PluginDoor.kindIconHtml(kind);
// A tag as a class: its name alone, no #. Always a link to its page (0.4.332, the owner: "they should always be
// clickable"; Shift: in the sidebar), unless it sits where a click already chooses something (a list's row, a proposal):
// plain. A caller with its own href or click handles the click itself.
function tag(doc, title, props = {}) {
  const { plain, ...rest } = props, name = String(title ?? '').replace(/^#/, '');
  if (plain) return el(doc, 'span', { class: 'th-tag lk-tag', ...rest }, name);
  const own = rest.href || rest.click;
  // A click of the caller's own on the bare "#" link never follows it: Logseq reads "#" as its home, the Journals, and the
  // tag map left for there under an "also under" or a child tag's click (0.4.427).
  const click = !rest.click ? null : rest.href && rest.href !== '#' ? rest.click : event => { event.preventDefault(); rest.click(event); };
  return el(doc, 'a', { class: 'th-tag lk-tag', href: '#', ...rest,
    click: own ? click : event => { event.preventDefault(); event.stopPropagation(); openPageNamed(name, event.shiftKey); } }, name);
}
// The same as words for a paragraph (the help paragraph opens it, guide below).
// The two buttons, both the library's: quiet (the third level, lk-low: the word alone, the wash under the pointer), go (lk-accent, the one that does it); pressed is in force.
function quiet(doc, { icon: name, label, title, pressed, run, cls } = {}) {
  return el(doc, 'button', { type: 'button', class: `lk-btn lk-low${cls ? ' ' + cls : ''}`, title: title || null, 'aria-pressed': pressed == null ? null : String(!!pressed), click: run || null },
    name ? icon(doc, name) : null, label != null ? String(label) : null);
}
const go = (doc, { label, title, run, cls } = {}) => el(doc, 'button', { type: 'button', class: `lk-accent${cls ? ' ' + cls : ''}`, title: title || null, click: run || null }, label);
// Keys typed in a box of the plugin's stay out of Logseq's shortcuts (Escape goes on, so a pop-up still closes).
const keepKeys = box => { for (const type of ['keydown', 'keyup', 'keypress']) box.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); };
/* THE field: a real text box drawn as a hairline underneath, firmer while typing; an icon on the left and a key hint
   on the right when given; inline on a line. keys(event) sees every keydown first (return true to take it). */
/* count (0.4.441, the find field of docs/REWORK.md 6): a number at the field's right end ("546", "12 of 546"), never in
   the grey words; wrap.count(text) changes it. fieldHtml is the markup twin for a part that draws by markup. */
function field(doc, { placeholder = '', value = '', icon: name, kbd, inline, multiline, keys, input, title, cls, count } = {}) {
  const box = multiline ? el(doc, 'textarea', { rows: '3', placeholder, spellcheck: 'true', title: title || null }) : el(doc, 'input', { type: 'text', placeholder, spellcheck: 'false', autocomplete: 'off', title: title || null });
  box.value = value;
  const counted = count == null ? null : el(doc, 'span', { class: 'th-field-count lk-count' }, String(count));
  const wrap = el(doc, 'span', { class: `th-field lk-field${inline ? ' th-field-inline' : ''}${multiline ? ' th-field-tall' : ''}${cls ? ' ' + cls : ''}` }, name ? icon(doc, name) : null, box, counted, kbd ? el(doc, 'kbd', {}, kbd) : null);
  wrap.count = text => { if (counted) counted.textContent = String(text ?? ''); };
  keepKeys(box);
  if (keys) box.addEventListener('keydown', event => { if (keys(event) === true) { event.preventDefault(); event.stopPropagation(); } });
  if (input) box.addEventListener('input', () => input(box.value));
  wrap.input = box;
  return wrap;
}
const fieldHtml = ({ placeholder = '', value = '', icon: name, count, cls = '', inputCls = '', label = '' } = {}) =>
  `<span class="th-field lk-field${cls ? ' ' + cls : ''}">${name ? iconHtml(name) : ''}<input type="text"${inputCls ? ` class="${esc(inputCls)}"` : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" spellcheck="false" autocomplete="off"${label ? ` aria-label="${esc(label)}"` : ''}>${count == null ? '' : `<span class="th-field-count lk-count">${esc(count)}</span>`}</span>`;
const note = (doc, text, cls) => el(doc, 'div', { class: `lk-note${cls ? ' ' + cls : ''}` }, text);

/* THE pop-up: the browser's popover (dismissed by it on Escape or a click outside, in the top layer), placed under
   its anchor by CSS anchor positioning and flipped up or sideways when there is no room; the box is Logseq's own [[
   menu look. Two fillings: a menu (items) and a list (a field, then rows). With a rect for `at`, a 0×0 anchor is put
   there. `focusOn`: a selector inside it that takes the keyboard when it shows, in place of the pop-up itself. `manual`: the part dismisses it itself (the link box, whose keys stay in the bullet); `hint`: a card that
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
    node = el(doc, 'span', { class: 'th-anchor', 'aria-hidden': 'true' });
    Object.assign(node.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${Math.max(0, (rect.right ?? rect.left) - rect.left)}px`, height: `${Math.max(0, (rect.bottom ?? rect.top) - rect.top)}px`, pointerEvents: 'none' });
    doc.body.append(node);
    made = true;
  }
  const name = `--th-anchor-${++anchorCount}`, before = node.style.getPropertyValue('anchor-name');
  node.style.setProperty('anchor-name', name);
  return { name, cleanup: () => { if (made) node.remove(); else if (node.style.getPropertyValue('anchor-name') === name) { if (before) node.style.setProperty('anchor-name', before); else node.style.removeProperty('anchor-name'); } } };
}
function popup({ at, kind = 'menu', head, items, field: fieldOptions, rows, keys, manual = false, hint = false, cls = '', width, onClose, doc, focusOn = '', inside = null } = {}) {
  let waitUp = null; // set while the pop-up waits for the mouse button that opened it to be let go
  doc = doc || host();
  const pop = el(doc, 'div', { class: `th-pop lk-pop${items || rows ? ' lk-menu' : ''}${cls ? ' ' + cls : ''}`, role: hint ? 'tooltip' : fieldOptions ? 'listbox' : 'menu', tabindex: hint ? null : '-1' });
  pop.setAttribute('popover', manual ? 'manual' : hint ? 'hint' : 'auto');
  if (width) pop.style.width = typeof width === 'number' ? `${width}px` : width;
  const anchor = anchorFor(doc, at);
  if (anchor) { pop.classList.add('th-anchored'); pop.style.setProperty('position-anchor', anchor.name); }
  const wasActive = doc.activeElement;
  let closed = false, resolveClosed;
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });
  const close = () => {
    if (closed) return;
    closed = true;
    closeSub();
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
  if (head) pop.append(el(doc, 'div', { class: 'th-pop-head' }, head));
  let fieldEl = null;
  if (fieldOptions) {
    fieldEl = field(doc, { ...fieldOptions, input: value => { fieldOptions.input?.(value); if (rows) drawItems(rows(value)); } });
    pop.append(fieldEl);
  }
  const body = el(doc, 'div', { class: 'th-pop-body' });
  pop.append(body);
  const buttons = () => [...body.querySelectorAll('.th-item')];
  const lit = i => { const all = buttons(); all.forEach((b, k) => b.classList.toggle('on', k === i)); all[i]?.scrollIntoView?.({ block: 'nearest' }); };
  const litAt = () => buttons().findIndex(b => b.classList.contains('on'));
  /* An item with sub (a function giving its items) is a parent, as View is in a menu bar (the owner, 8 November 2026): its
     items open to its side, on a press, on → or Enter, or when the pointer rests on it; ← or Escape closes them again, and
     choosing one of them closes both. */
  let sub = null, subOf = null, subTimer = 0;
  const closeSub = () => { win?.clearTimeout(subTimer); sub?.close(); sub = null; subOf = null; };
  const openSub = async (item, b) => {
    if (subOf === item && sub && !sub.isClosed) return;
    closeSub(); subOf = item;
    const list = await item.sub();
    if (closed || subOf !== item || !b.isConnected) return;
    const wrap = x => x && x.run ? { ...x, run: y => { const r = x.run(y); if (r !== 'keep' && !x.keep) close(); return r; } } : x;
    b.classList.add('th-sub-open');
    sub = popup({ at: b, doc, inside: controller, cls: 'th-side', width: item.subWidth, items: list.map(wrap), onClose: () => { b.classList.remove('th-sub-open'); if (subOf === item) { sub = null; subOf = null; } if (!closed) pop.focus({ preventScroll: true }); } });
  };
  const run = item => { if (item.disabled) return; if (item.sub) { const b = buttons().find(x => x.item === item); if (b) openSub(item, b); return; } const keep = item.run?.(item) === 'keep' || item.keep; if (!keep) close(); };
  function drawItems(list = []) {
    body.replaceChildren();
    for (const item of list) {
      if (!item) continue;
      if (item.sep) { body.append(el(doc, 'div', { class: 'lk-item gap' })); continue; }
      if (item.note) { body.append(note(doc, item.note)); continue; }
      if (item.group) { body.append(el(doc, 'div', { class: 'lk-group', role: 'presentation' }, item.group)); continue; }
      const b = el(doc, 'button', { type: 'button', class: `th-item lk-item${item.on ? ' on' : ''}${item.faint ? ' th-faint' : ''}${item.cls ? ' ' + item.cls : ''}`, role: 'menuitem', title: item.title || null, disabled: item.disabled || null,
        click: () => run(item) },
        item.icon ? icon(doc, item.icon) : null, item.html ? el(doc, 'span', { class: 'th-item-words', html: item.html }) : el(doc, 'span', { class: 'th-item-words' }, String(item.label ?? '')),
        item.sub ? el(doc, 'span', { class: 'th-end th-sub-arrow' }, icon(doc, 'fold')) : item.kbd ? el(doc, 'kbd', {}, item.kbd) : item.right ? el(doc, 'span', { class: 'th-end' }, typeof item.right === 'string' ? item.right : '', typeof item.right === 'string' ? null : item.right) : item.chosen ? el(doc, 'span', { class: 'th-end' }, icon(doc, 'chosen')) : null);
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
    if (event.key === 'Escape' || (event.key === 'ArrowLeft' && inside && !fieldEl)) { event.preventDefault(); event.stopPropagation(); close(); return; }
    const all = buttons();
    if (event.key === 'ArrowRight' && all[litAt()]?.item?.sub) { event.preventDefault(); event.stopPropagation(); openSub(all[litAt()].item, all[litAt()]).then(() => sub && sub.lit(0)); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { if (!all.length) return; event.preventDefault(); event.stopPropagation(); const i = litAt(); lit(i < 0 ? 0 : (i + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length); return; }
    if (event.key === 'Enter' && !event.isComposing) { const b = all[litAt()]; if (b) { event.preventDefault(); event.stopPropagation(); run(b.item); return; } }
    // The caller's own keys on the lit row (the tag tree's → and ←); true: taken, the rows drawn again with the same row lit.
    if (keys && keys(event, all[litAt()]?.item) === true) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.target === pop) event.stopPropagation();
  });
  for (const type of ['keyup', 'keypress']) pop.addEventListener(type, event => event.stopPropagation());
  // The pointer over a row lights it, as in Logseq's own lists.
  body.addEventListener('mousemove', event => { const b = event.target.closest?.('.th-item'); if (!b || b.parentElement !== body) return; if (!b.classList.contains('on')) lit(buttons().indexOf(b));
    if (b.item?.sub) { if (subOf !== b.item) { win?.clearTimeout(subTimer); subTimer = win?.setTimeout(() => openSub(b.item, b), 160); } }
    else if (sub) { win?.clearTimeout(subTimer); subTimer = win?.setTimeout(closeSub, 160); } });
  // A menu inside another (a parent's items) stands in its pop-up, so the browser keeps the two open together.
  (inside ? inside.el : doc.body).append(pop);
  const show = () => {
    if (closed) return;
    try { if (pop.showPopover) pop.showPopover(); } catch (error) { /* shown as a plain box */ }
    if (!hint) { if (fieldEl) fieldEl.input.focus({ preventScroll: true }); else if (!manual) ((focusOn && pop.querySelector(focusOn)) || pop).focus({ preventScroll: true }); }
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
const FEW = 40;
// keepOrder: the options stay in the order given, the held one ticked in its place (Logseq's Set Status); iconHtml: a row's icon before its words.
function pickValue({ at, placeholder = '', options = [], clearLabel = '', free = false, doc, keepOrder = false } = {}) {
  doc = doc || host();
  return new Promise(resolve => {
    let answer = null, finished = false, lit = 0, shown = [], all = false;
    const pop = el(doc, 'div', { class: 'ui__popover-content z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 th-lsq-pop',
      role: 'dialog', tabindex: '-1', 'data-side': 'bottom', 'data-state': 'open' });
    pop.setAttribute('popover', 'auto');
    const anchor = anchorFor(doc, at);
    if (anchor) { pop.classList.add('th-anchored'); pop.style.setProperty('position-anchor', anchor.name); }
    const input = el(doc, 'input', { class: '!p-1.5 cp__select-input w-full', type: 'text', placeholder });
    const list = el(doc, 'div', { class: 'th-lsq-list hide-scrollbar' });
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
      const words = item.clear ? [el(doc, 'span', { class: 'ui__icon ti', html: X_SVG }), el(doc, 'span', {}, item.label)] : [...(item.iconHtml ? [el(doc, 'span', { class: 'ui__icon ti th-lsq-icon', html: item.iconHtml })] : []), el(doc, 'div', { class: item.more ? 'th-faint' : null }, item.label)];
      const link = el(doc, 'a', { class: `${i === lit ? 'chosen ' : ''}flex justify-between menu-link${item.clear ? ' lk-lone' : ''}`, tabindex: '-1',
        mousedown: event => event.preventDefault(), click: event => { event.preventDefault(); choose(item); },
        mousemove: () => { if (lit !== i) light(i); } },
        el(doc, 'span', { class: 'flex-1' }, el(doc, 'div', { class: `${i === lit ? 'chosen ' : ''}flex flex-row justify-between w-full` },
          el(doc, 'div', { class: 'flex flex-row items-center gap-1' }, ...words),
          el(doc, 'div', { class: 'tip flex items-center gap-1' }, item.held ? el(doc, 'span', { class: 'ls-icon-check ui__icon ti', html: CHECK_SVG }) : null))));
      return el(doc, 'div', { class: 'menu-link-wrap' }, link);
    };
    function draw() {
      const q = input.value.trim().toLowerCase();
      const starts = o => o.label.toLowerCase().startsWith(q);
      const found = q ? options.filter(o => o.label.toLowerCase().includes(q)).sort((a, b) => (starts(b) - starts(a)) || a.label.length - b.label.length)
        : keepOrder ? options : [...options.filter(o => o.held), ...options.filter(o => !o.held)]; // what it holds first, ticked, as Logseq lists it
      // A few, then "show all": a list of thousands costs more to draw than anyone reads, and typing narrows it.
      const few = all || found.length <= FEW ? found : [...found.slice(0, FEW), { label: `show all ${found.length}`, more: true }];
      shown = [...few, ...(clearLabel && !q ? [{ label: clearLabel, clear: true }] : [])];
      lit = Math.min(lit, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map(row));
      list.querySelector('.chosen')?.scrollIntoView?.({ block: 'nearest' });
    }
    // The lit row moves by its class: nothing is drawn again under the pointer or the arrows.
    const mark = (i, on) => { const link = list.children[i]?.querySelector('a'); link?.classList.toggle('chosen', on); link?.firstElementChild?.firstElementChild?.classList.toggle('chosen', on); };
    const light = i => { mark(lit, false); lit = i; mark(lit, true); };
    const choose = item => { if (item.more) { all = true; input.focus(); draw(); } else take(item.clear ? { clear: true } : item); };
    input.addEventListener('input', () => { lit = 0; all = false; draw(); });
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (shown.length) { light((lit + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length); list.children[lit]?.scrollIntoView?.({ block: 'nearest' }); } }
      else if (event.key === 'Enter') {
        event.preventDefault();
        const item = shown[lit], typed = input.value.trim();
        if (item && (item.more || !typed || !free || item.label.toLowerCase().includes(typed.toLowerCase()))) choose(item);
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
   place in the new drawing and the box goes on there, words and caret as they were. onType(words) hears each change as it is
   typed (a bullet saves as it is written); show(words) gives the html that stands in the box's place once new words are kept,
   so the old words never come back for a moment before the redraw. */
function editInPlace({ at, value = '', type = 'text', placeholder = '', doc, again, wrap = false, onType, show, onEnd } = {}) {
  const numeric = type === 'number';
  type = 'text';
  doc = doc || host();
  return new Promise(resolve => {
    let was = [...at.childNodes];
    // Words with a line break keep it: an input would flatten them. Words that wrap (a bullet's) are a box that grows with them.
    const lines = String(value).split('\n').length;
    const box = wrap || lines > 1;
    const input = el(doc, box ? 'textarea' : 'input', { class: `ui__input flex w-full rounded-md border-none bg-transparent px-0 !py-0 min-h-0 leading-6 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 th-in-place${wrap ? ' th-in-wrap' : ''}`, ...(box ? { rows: wrap ? 1 : lines } : { type }), placeholder });
    input.value = value;
    if (numeric) input.setAttribute('inputmode', 'decimal');
    const grow = () => { if (!wrap) return; input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
    // How it ended, for onEnd: 'enter', 'escape', or 'away' (a click elsewhere, or the box gone with a redraw).
    let finished = false, moving = false, ended = 'away';
    const finish = answer => { if (finished) return; finished = true; onEnd?.(ended); const html = answer != null && show ? show(answer) : null; if (html != null) at.innerHTML = html; else at.replaceChildren(...was); resolve(answer); };
    input.across = redraw => {
      const from = input.selectionStart, to = input.selectionEnd;
      moving = true; redraw(); moving = false;
      const next = again?.();
      if (!next) { finish(input.value === value ? null : input.value); return; }
      at = next; was = [...at.childNodes]; at.replaceChildren(input); grow();
      input.focus({ preventScroll: true }); input.setSelectionRange(from, to);
    };
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Enter' && wrap && event.shiftKey) return;   // a line break, as in Logseq's own bullets
      if (event.key === 'Enter') { event.preventDefault(); ended = 'enter'; finish(input.value === value ? null : input.value); }
      else if (event.key === 'Escape') { event.preventDefault(); ended = 'escape'; finish(null); }
    });
    if (wrap) input.addEventListener('input', grow);
    if (onType) input.addEventListener('input', () => onType(input.value));
    for (const type of ['keyup', 'keypress']) input.addEventListener(type, event => event.stopPropagation());
    for (const type of ['mousedown', 'click']) input.addEventListener(type, event => event.stopPropagation());
    input.addEventListener('blur', () => { if (!moving) finish(input.value === value ? null : input.value); });
    at.replaceChildren(input);
    grow();
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* a field that has no caret */ }
  });
}
/* A question beside what it is about: the question, a quiet note, the library's answers under it, Cancel and the one
   that does it (no backdrop, no fill). Resolves true or false; with a field, the text typed (Enter or the go word) or null.
   lasting: what nothing can put back (a bullet deleted). Then the yes is lk-big, the library's yes to a change Undo cannot put
   back, and the keyboard waits on Cancel, so Enter cancels and only a press says yes. */
function ask({ at, question, note: hint, go: goWord = 'OK', cancel = 'Cancel', field: fieldOptions, width, cls, doc, lasting = false } = {}) {
  doc = doc || host();
  return new Promise(resolve => {
    let answer = fieldOptions ? null : false;
    const p = popup({ at, doc, cls: `th-ask${cls ? ' ' + cls : ''}`, width, onClose: () => resolve(answer), focusOn: lasting ? '.th-btns .lk-i-x' : '' });
    const done = () => { answer = fieldOptions ? f.input.value : true; p.close(); };
    const f = fieldOptions ? field(doc, { ...fieldOptions, keys: event => { if (event.key === 'Enter' && !event.isComposing && !(fieldOptions.multiline && event.shiftKey)) { done(); return true; } return fieldOptions.keys?.(event) === true; } }) : null;
    // Only what is there: the browser writes an empty piece out as the word "null" (0.4.326).
    p.body.append(...[el(doc, 'div', { class: 'th-ask-words' }, question), hint ? note(doc, hint) : null, f,
      el(doc, 'div', { class: 'th-btns lk-answers' }, el(doc, 'button', { type: 'button', class: `lk-btn lk-i-x${lasting ? ' lk-enter' : ''}`, click: () => p.close() }, cancel),
        lasting ? el(doc, 'button', { type: 'button', class: 'lk-big', click: done }, goWord) : go(doc, { label: goWord, run: done, cls: 'lk-i-tick lk-enter' }))].filter(Boolean));
    if (f) { f.input.focus({ preventScroll: true }); if (fieldOptions.select && f.input.value) f.input.select(); }
    else if (lasting) p.body.querySelector('.th-btns .lk-i-x')?.focus({ preventScroll: true });
    // Enter takes what is offered: with the keyboard on a button, that button, so on Cancel it cancels. Pressed here, since Logseq takes Enter before the browser would.
    p.el.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing || event.target === f?.input) return;
      event.preventDefault(); event.stopPropagation();
      const button = event.target.closest?.('button');
      if (button) button.click(); else if (lasting) p.close(); else done();
    });
  });
}
/* THE outline (0.4.441, docs/REWORK.md sections 4 and 6): one way for something to open under something, for the two-way
   section, the tag map and the sidebar. Markup, as the two-way section draws (a DOM part wraps it with fragmentOf).
   - chev({ open, label, attrs }): the one chevron, a 16 px mark in a 24 px place to click, faint at rest (never hidden),
     full on its line, turned down while open (160 ms, none with reduced motion).
   - line({ body, chev, day, tick, cls, attrs, dot }): one line of a tree; with dot (a node, as a Logseq bullet: true, or
     { uuid, closed, title }, see dot), the
     chevron, the dot, the day in a column of one width (none when day is null) and the name. Without, the tick box hangs in the margin, then the day in a
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
     triangle; a fact none, its room kept), its name quieter than its value (kind '': a row pointing back, named by its property with no room for a mark, so it does not read as the node's own), the names of one node on one column (--th-ol-name); a value never breaks inside a word.
   - bullet({ html, attrs, wordsAttrs, closed }), newBullet({ attrs, label }): a bullet as Logseq draws one, its dot and words
     (wordsAttrs go on the words: a bullet changed where it stands is found and focused by them); the empty one
     at the end is faint, written in like a bullet: a caret on the line, no box, no line under it (a bare text box, so
     what is typed keeps the field's helpers, the grey name completed after the caret among them).
   - more({ text, attrs, under, cls }): "show all 13" under a list, on its edge: under 'dot' or 'dotday' (the names of dotted lines, with no day column or after one), 'name' (the names after a day), 'bare'
     (names with no day before them) or 'value' (a property's values); the library's lk-more, or the kind cls names.
   - name({ text, title, open, tag, attrs }): a node's name, the faint underline of a link, bold while open, its tag after.
   - pencil(text, attrs): what the proposals fill in, sure or guessed alike: italic, faint, a dotted line; with the class
     th-pencil-taken, kept (it will be set), in the words' own look.
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
     map's full colour; one step quieter and "inherited" when it comes from above) in one column (--th-ol-lname), then
     the tag it leads to ({ text, open, n, chevAttrs }: a chevron right before it to walk on; n, given only when it leads
     to several tags, a count of the nodes pointing at that one), then its count. A property leading to several tags takes
     a line for each, the name left out after the first ('' as name): one name per line where a name can open. What
     opens under its tag is kids({ from: 'leads' }). In a narrow place the tag goes under the name.
   - pointing({ from, name, nameAttrs, count, tick, attrs }): what points at a tag, the other way round so the direction
     reads at a glance: the tag the property sits on first ({ text, open, chevAttrs }, its chevron in the line's own place,
     to walk there), then the property, with no kind icon (as the two-way rows pointing back have none), then how many of
     that tag's nodes point here ("4 of 6").
   - more({ under: 'leads' }): "show all 15" under a property's tags; under 'flush', on a list's own edge (the findings).
   - group(text): a quiet heading over the lines of one kind under a tag ("Points at it", "Child tags").
   - the class th-ol-margin on the outline's root (the map): the tick boxes of every level stand in one column in the
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
    if (!kids?.isConnected || !kids.animate || !win?.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    window.PluginDoor.rollUp(kids).then(done);
  },
  // After a drawing lands: what came marked fresh (th-ol-unroll) unrolls with the plugin's one motion (PluginDoor.unroll), once.
  unrolled(root) {
    const fresh = [...root?.querySelectorAll?.('.th-ol-kids.th-ol-unroll') || []];
    for (const kids of fresh) kids.classList.remove('th-ol-unroll');
    window.PluginDoor?.unroll?.(fresh);
  },
  focus(root, key) { for (const unit of root?.querySelectorAll('.th-ol-unit') || []) unit.classList.toggle('th-ol-focus', unit.dataset.key === key); },
  chev: ({ open = false, label = '', attrs, cls = '' } = {}) => `<button type="button" class="th-chev lk-fold${cls ? ' ' + cls : ''}" aria-expanded="${open}" aria-label="${esc(`${open ? 'Close' : 'Open'} ${label}`.trim())}" title="${open ? 'Close' : 'Open here'}"${attrsHtml(attrs)}></button>`,
  room: () => '<span class="th-chev-room" aria-hidden="true"></span>',
  /* A bullet's dot: the library's lk-bul, Logseq's own bullet (plugin.js), here in its place on the line. closed: what it holds
     is folded (the ring). uuid: a press opens the node, as a press on Logseq's bullet opens the block (Shift: the sidebar);
     opens: it opens something its line says (a bullet's own dot). hidden: only a dot's room (a "show all" under dotted lines). */
  dot: (hidden = false, { uuid = '', closed = false, title = '', opens = false } = {}) => `<span class="th-ol-dot${hidden ? ' th-ol-dot-room' : ''}" aria-hidden="${uuid ? 'false' : 'true'}"><span class="lk-bul${closed ? ' folded' : ''}${uuid || opens ? ' opens' : ''}"${uuid ? ` data-open-uuid="${esc(uuid)}" title="${esc(title ? `Open ${title}` : 'Open')}"` : ''}></span></span>`,
  // The day's column: nothing when the list has no days (null), else the day, or its room where a line has none ('').
  // A day that says what it is of ({ text, from }: "Oct 7 Journal", 8 November 2026) carries the property's name after it, smaller.
  day: day => day == null ? '' : day && typeof day === 'object' ? `<span class="th-ol-day lk-day" title="${esc(`${day.from}: ${day.text}`)}"><span class="th-ol-dtext">${esc(day.text)}</span><span class="th-ol-dfrom lk-name">${esc(day.from)}</span></span>` : `<span class="th-ol-day lk-day">${esc(day)}</span>`,
  line: ({ body = '', chev = '', day, tick = '', end = '', cls = '', attrs, dot = false } = {}) => `<div class="th-ol-line lk-row${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${tick}${dot ? `${chev || outline.room()}${outline.dot(false, dot === true ? {} : dot)}${outline.day(day)}` : `${outline.day(day)}${chev || outline.room()}`}<span class="th-ol-body">${body}</span>${end ? `<span class="th-ol-end">${end}</span>` : ''}</div>`,
  kids: ({ html = '', from = '', fresh = false, attrs, cls = '' } = {}) => `<div class="th-ol-kids${from ? ' th-ol-from-' + from : ''}${fresh ? ' th-ol-unroll' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><div class="th-ol-in">${html}</div></div>`,
  unit: ({ html = '', focus = false, attrs, cls = '' } = {}) => `<div class="th-ol-unit${focus ? ' th-ol-focus' : ''}${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${html}</div>`,
  prop: ({ kind = 'text', name = '', value = '', chev = '', attrs, cls = '', nameAttrs } = {}) => `<div class="th-ol-line lk-row th-ol-prop${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}><span class="th-ol-pname lk-prop"${attrsHtml(nameAttrs)}>${name ? `${kind ? `<span class="th-kind">${kindIconHtml(kind)}</span>` : ''}${esc(name)}` : ''}</span><span class="th-ol-pv">${chev}${value}</span></div>`,
  bullet: ({ html = '', attrs, cls = '', wordsAttrs, closed = false } = {}) => `<div class="th-ol-bullet${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${outline.dot(false, { closed, opens: !!attrs?.['data-bullet'] })}<span class="th-ol-words"${attrsHtml(wordsAttrs)}>${html}</span></div>`,
  newBullet: ({ attrs, label = 'A new bullet', text = '' } = {}) => `<div class="th-ol-bullet th-ol-new">${outline.dot()}<span class="th-field lk-field th-ol-words th-ol-write"><input type="text" value="${esc(text)}" spellcheck="true" autocomplete="off" aria-label="${esc(label)}" placeholder="${esc(label)}"${attrsHtml(attrs)}></span></div>`,
  more: ({ text = '', attrs, under = 'name', cls = 'lk-more' } = {}) => { const b = `<button type="button" class="${cls} th-ol-more"${attrsHtml(attrs)}>${esc(text)}</button>`; return under === 'value' ? `<div class="th-ol-line th-ol-prop th-ol-moreline"><span class="th-ol-pname"></span><span class="th-ol-pv">${b}</span></div>` : under === 'flush' ? `<div class="th-ol-line th-ol-moreline">${b}</div>` : under === 'leads' ? `<div class="th-ol-line lk-row th-ol-leads th-ol-moreline">${outline.room()}<span class="th-ol-lname"></span><span class="th-ol-to">${b}</span></div>` : under === 'dot' || under === 'dotday' ? `<div class="th-ol-line th-ol-moreline">${outline.room()}${outline.dot(true)}${under === 'dotday' ? outline.day('') : ''}${b}</div>` : `<div class="th-ol-line th-ol-moreline">${under === 'bare' ? '' : '<span class="th-ol-day lk-day"></span>'}${outline.room()}${b}</div>`; },
  pencil: (text, attrs, cls = '') => `<button type="button" class="th-pencil lk-pencil${cls ? ' ' + cls : ''}"${attrsHtml(attrs)}>${esc(text)}</button>`,
  trail: (steps = [], here = '', end = '') => `<div class="th-ol-trail lk-trail">${steps.map(s => `<a href="#" class="th-ol-step lk-step"${attrsHtml(s.attrs)}>${esc(s.text)}</a><span class="th-ol-sep" aria-hidden="true">›</span>`).join('')}${here ? `<span class="th-ol-here">${here}</span>` : ''}${end}</div>`,
};
/* The hover card: a node's preview, every piece clickable (open(what, value): 'node', 'prop' with the
   name, 'line' with the text). A browser popover of the hint kind, placed under what the pointer rests on. */
function card({ at, title, fields = [], lines = [], open, width = 300, cls = '', doc } = {}) {
  doc = doc || host();
  const p = popup({ at, doc, hint: true, cls: `th-card${cls ? ' ' + cls : ''}`, width });
  const act = (what, value) => event => { event.preventDefault(); event.stopPropagation(); open?.(what, value, event); };
  // A field is [name, value] or { name, uuid, values: [{ text, uuid }] }; a line a string or { uuid, text | html }.
  const fieldRow = f => {
    const name = Array.isArray(f) ? f[0] : f.name, values = Array.isArray(f) ? [{ text: f[1] }] : f.values || [];
    const cell = el(doc, 'span');
    values.forEach((v, i) => { if (i) cell.append(', '); cell.append(el(doc, 'a', { href: '#', click: act('value', { name, ...v }) }, v.text)); });
    return [el(doc, 'a', { href: '#', class: 'th-card-name', click: act('prop', Array.isArray(f) ? { name } : f) }, name), cell];
  };
  const lineRow = line => el(doc, 'a', { href: '#', class: 'th-card-line', html: typeof line === 'object' && line.html ? line.html : null, click: act('line', line) }, typeof line === 'string' ? line : line.html ? null : line.text);
  // Only what is there (0.4.326): a node with no properties and no lines showed "nullnull" in its card.
  p.body.append(...[
    title ? el(doc, 'a', { href: '#', class: 'th-card-title', click: act('node') }, title) : null,
    fields.length ? el(doc, 'div', { class: 'th-card-fields' }, ...fields.flatMap(fieldRow)) : null,
    lines.length ? el(doc, 'div', { class: 'th-card-lines' }, ...lines.map(lineRow)) : null].filter(Boolean));
  return p;
}

/* THE Undo is the door's (PluginDoor.undo, since 6 November 2026; it was this kit's from 0.4.258). Here only the kit's way of
   naming a place: undo.near({ root, key, col }) finds the arrow's place again by the row's key after every redraw, not as an
   element a redraw replaces: in root() the row [data-key=key], then its cell [data-col=col] or the row's name. Every offer from
   Threads carries owner 'threads', so leaving the page clears Threads' arrows and no other module's. */
const attr = text => String(text).replace(/["\\]/g, '\\$&');
const undo = Object.create(window.PluginDoor.undo, {
  offer: { value: entry => window.PluginDoor.undo.offer({ owner: 'threads', ...entry }) },
  clear: { value: () => window.PluginDoor.undo.clear('threads') },
  near: { value: ({ root, key, col } = {}) => () => {
    const box = typeof root === 'function' ? root() : root;
    const row = box?.isConnected ? box.querySelector(`[data-key="${attr(key)}"]`) : null;
    return row ? (col && row.querySelector(`[data-col="${attr(col)}"]`)) || row.querySelector('.th-ol-body, .th-ttreeval') || row : null;
  } },
});

/* THE stylesheet of the kit. Sent by main.js before any part (the foundation's own boxes must look right under
   Foundation only). Greys from currentColor, so the same rules hold on the page and in a pop-up, light and dark. */
const kitCss = `/* The kit (parts/shared.js, 0.4.311; docs/LAYERS.md section 3): where the library's pieces stand in Threads. Since
   6 November 2026 every piece is drawn by the plugin's library (plugin.js): the pop-up (lk-pop), the window (lk-window), the
   presses (lk-btn lk-low, lk-accent), the field (lk-field), the tick box (lk-tick), the fold arrow (lk-fold), the Undo arrow
   (lk-undo), the quiet line (lk-note), the greys and the one motion. Here only the kit's own names, each with its place
   and its room, never a look of its own; the greys are the library's by the library's names. */
/* The pop-up (the library's lk-pop) in the top layer, placed by the browser under its anchor and flipped when there is no room. */
.th-pop { position: fixed; inset: auto; margin: 0; z-index: 10001; box-sizing: border-box; min-width: 160px; max-width: min(420px, 92vw); padding: 4px; overflow: visible; outline: none; }
.th-pop.th-anchored { top: anchor(bottom); left: anchor(left); margin-top: 4px; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline; }
/* A parent item's own items, to its side, their first item level with it; turned to the left where the right has no room. */
.th-pop.th-anchored.th-side { top: anchor(top); left: anchor(right); margin: -5px 0 0 6px; position-try-fallbacks: flip-inline; }
.th-pop .th-sub-arrow { opacity: .55; }
.th-pop .th-item.th-sub-open { background: var(--lk-wash, rgba(0,0,0,.05)); }
.th-lsq-pop { position: fixed; inset: auto; margin: 0; padding: 0; width: 14rem; overflow: visible; }
.th-lsq-pop .menu-link .flex-row > div:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-lsq-pop.th-anchored { top: anchor(bottom); left: anchor(left); margin-top: 4px; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline; }
.th-lsq-pop .th-lsq-list { max-height: 18rem; overflow-y: auto; }
.th-lsq-pop .th-lsq-icon svg { width: 16px; height: 16px; display: block; }
.th-lsq-pop .th-lsq-icon .ti { font-size: 16px; line-height: 1; }
/* Clear is the library's lone word, standing on the list's own edge. */
.th-lsq-pop .menu-link.lk-lone { margin-left: 0; }
.th-in-place { font: inherit; color: inherit; height: auto; width: 100%; min-width: 4em; padding: 0; box-shadow: none; }
.th-in-place.th-in-wrap { display: block; resize: none; overflow: hidden; line-height: inherit; }   /* a bullet's words wrap; the box is as tall as they are (editInPlace's grow) */
/* With nothing to sit under (a pop-up opened from the palette): near the top, in the middle. */
.th-pop:not(.th-anchored) { top: 12vh; left: 50%; transform: translateX(-50%); }
.th-pop-head { padding: 3px 8px; font-size: var(--lk-label); color: var(--lk-quiet); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-pop-body { max-height: 320px; overflow-y: auto; }
/* A line of a menu is the library's lk-item (lit: on); here only how its icon and words stand. */
.th-item { align-items: center; gap: 8px; box-sizing: border-box; }
.th-item > :is(.ti, .th-drawn) { width: 16px; flex: none; color: var(--lk-faint); font-size: 15px; }
.th-item > .th-drawn { justify-content: center; align-self: center; }
.th-item.th-faint { color: var(--lk-faint) !important; }
.th-item-words { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-item kbd, .th-end { margin-left: auto; flex: none; font: inherit; font-size: var(--lk-small); color: var(--lk-faint); }
.th-pop .th-field { margin: 0 8px 4px; }
/* A report to copy (the troubleshooting tools): the text in a quiet box, Copy as the one word. */
.th-report { padding: 8px 10px; max-width: min(720px, 92vw); }
.th-report > .th-pop-body { max-height: none; }
/* The Recycle list (troubleshooting): as tall as the window allows below the pop-up's place, so many lines show at once. */
.th-recycle { max-width: min(640px, 92vw); }
.th-recycle > .th-pop-body { max-height: calc(84vh - 60px); }
.th-recycle .th-recycle-acts { gap: 2px; }
/* The ask under a row of the Recycle: joined to it by a line from the margin, a bold line, what goes, then the answers. */
.th-recycle-ask { margin: 2px 8px 8px 30px; padding: 4px 0 4px 12px; border-left: 1px solid var(--lk-line); font-size: 14px; }
.th-recycle-ask-h { font-weight: 600; }
.th-recycle-ask-l { color: var(--lk-quiet); }
.th-recycle-ask .lk-answers { margin-top: 6px; }
.th-report textarea { display: block; box-sizing: border-box; width: 100%; height: min(50vh, 420px); margin: 6px 0 0; padding: 6px 8px; border: 0; border-radius: 4px; background: var(--lk-wash); color: inherit; font: 12px/1.45 var(--lk-mono); resize: vertical; outline: none; }
/* A question beside what it is about. */
.th-ask { padding: 8px 10px; }
.th-ask-words { font-weight: 600; margin: 2px 0; }
.th-ask .th-field { margin: 6px 0 2px; width: 100%; }
.th-btns:not(.lk-answers) { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px; }
/* The answers are the library's. Cancel stays first in the markup, so Tab and Enter reach what they did; the main answer
   stands first, as the library draws it, and its wash reaches past the row's edge, so the body does not clip it. */
.th-ask > .th-pop-body { margin-inline: -8px; padding-inline: 8px; }
.th-ask .lk-answers > .lk-accent { order: -1; }
/* The window (the library's lk-window): the browser's dialog, mid-screen. */
.th-dialog { position: fixed; inset: 0; margin: auto; padding: 0; box-sizing: border-box; width: min(700px, 92vw); max-height: 86vh; overflow: auto; }
/* A press's icon stands as the library's line icons do: 15px, before the word. */
.lk-btn > .ti { font-size: 15px; }
.lk-btn > .th-drawn { width: 15px; justify-content: center; }
:is(.th-chip, .th-ol-more, .th-ask button):focus-visible { outline: none; background: var(--lk-wash); }
.th-faint { color: var(--lk-faint); }
/* The field is the library's lk-field; here its room on a line. */
.th-field { min-height: 26px; }
.th-field-tall { align-items: flex-start; }
.th-field-tall > textarea { resize: vertical; line-height: 1.4; }
.th-field > :is(.ti, .th-drawn), .th-field > kbd { flex: none; color: var(--lk-faint); font: inherit; font-size: var(--lk-small); }
.th-field > .ti { font-size: 15px; }
.th-field-inline { display: inline-flex; min-height: 22px; vertical-align: baseline; }
/* The drawn field: the same look, the text and the caret drawn, so nothing takes the keyboard from the bullet. */
/* The drawn caret sits right against the letters (0.4.321, the owner: "the cursor is a couple spaces ahead of text"): no gap
   between the pieces of the drawn field, the key hint kept apart by its own room. */
/* The tick box is the library's lk-tick; with a label, in a label. */
/* Words for chips: a filter, or a removable item with a × on hover. */
.th-chip { display: inline-flex; align-items: center; gap: 2px; padding: 0; border: 0; background: none; color: var(--lk-quiet); font: inherit; font-size: 14px; cursor: default; }
button.th-chip { cursor: pointer; }
.th-chip[aria-pressed="true"] { color: inherit; font-weight: 600; }
/* A chip's × is the library's lk-reveal: its colour, ground and fade come from there. */
/* A tag as a class: mono, the tag grey, no #, no underline (0.4.332: the mono face says it is a tag, and every tag is a
   link); darker under the pointer. */
/* A tag's look (mono, small capitals, grey) is Look's, through lk-tag; only its shape stays here. */
.th-tag { font-style: normal; font-weight: 400; color: inherit; text-decoration: none; border: 0; cursor: default; }
a.th-tag { cursor: pointer; }
a.th-tag:hover { opacity: 1; }
/* A value's kind as an icon left of the property's name. */
.th-kind { display: inline-flex; color: var(--lk-faint); font-size: 15px; vertical-align: -2px; }
/* The picking bar: one line of words above the list, a hairline under it. */
/* A cell changed where it sits (0.4.430; the table it came with is gone since 0.4.456). */
/* The chevron is the library's fold arrow (lk-fold: shown while its row is pointed at, turned down while open); th-chev
   names its place on a line. */
.th-chev { position: relative; }
.th-chev-room { flex: none; display: inline-block; width: 16px; }
/* THE outline: lines, what opens under them, the focus. --th-ol-day is the days' column (a list with a day of another year sets it wider), --th-ol-name the property names'
   column, one width at every depth so the names of nodes at one depth line up. */
.th-ol { --th-ol-day: var(--lk-day, 48px); --th-ol-name: 12em; --th-ol-gap: 6px; font-size: 14px; line-height: 1.5; }
.th-ol-line { position: relative; display: flex; align-items: baseline; gap: var(--th-ol-gap); min-height: 28px; box-sizing: border-box; padding: 3px 4px; margin-left: -4px; border-radius: 4px; }
.th-ol-line:hover { background: var(--lk-wash); }
.th-ol-line > .th-chev, .th-ol-pv > .th-chev { align-self: flex-start; top: 0; height: 1.5em; }
/* A value that opens hangs its chevron just left of the value (the drawing; the owner, 2026-10-27: the values of one
   column start at one edge), so "cisplatin" starts where "1" and "Oct 20" do. */
.th-ol-pv > .th-chev:first-child { margin-left: calc(-16px - var(--th-ol-gap)); }
.th-ol-line > input.lk-tick[type=checkbox] { position: absolute; left: -20px; top: 6px; margin: 0; opacity: .3; }
.th-ol-line:hover > input.lk-tick[type=checkbox], .th-ol-line > input.lk-tick[type=checkbox]:checked, .th-ol-line > input.lk-tick[type=checkbox]:focus-visible { opacity: 1; }
.th-ol-day { flex: none; width: var(--th-ol-day); font-variant-numeric: tabular-nums; white-space: nowrap; }
.th-ol-dtext { display: inline-block; min-width: var(--lk-day, 48px); }
.th-ol-dfrom { margin-left: 2px; }
.th-ol-body { min-width: 0; overflow-wrap: normal; }
.th-ol-body > .th-tag, .th-ol-pv .th-tag { margin-left: 6px; white-space: nowrap; }
.th-ol-open { font-weight: 600; }
.th-ol-kids { --th-ol-cx: 8px; display: grid; grid-template-rows: 1fr; margin: 0 0 0 var(--th-ol-cx); padding-left: 16px; border-left: 1px solid var(--lk-line); }
.th-ol-kids > .th-ol-in { min-width: 0; min-height: 0; padding-bottom: 2px; }
.th-ol-from-day { --th-ol-cx: calc(var(--th-ol-day) + var(--th-ol-gap) + 8px); }
.th-ol-from-prop { --th-ol-cx: calc(var(--th-ol-name) - 8px); }
.th-ol-from-back { --th-ol-cx: calc(var(--th-ol-name) + var(--th-ol-day) + 2 * var(--th-ol-gap) + 8px); }
/* Opening grows the room under the line from nothing, so what is below slides down with it; closing rolls it back up before
   it goes: the plugin's one motion (PluginDoor.unroll and rollUp, through outline.unrolled and outline.close). */
.th-ol-unit { margin: 0 -6px; padding: 0 6px; border-radius: 6px; transition: background-color .16s ease; }
.th-ol-unit.th-ol-focus { background: color-mix(in srgb, currentColor 3%, transparent); }
.th-ol-prop > .th-ol-pname { flex: none; box-sizing: border-box; width: var(--th-ol-name); padding-right: calc(16px + var(--th-ol-gap)); display: inline-flex; gap: 6px; align-items: baseline; color: var(--lk-quiet); overflow-wrap: normal; }   /* the padding is the room of the fold arrow that overhangs from the value (.th-ol-pv > .th-chev): a long name wraps before it, between its words, never inside one (7 November 2026: "Confirmatio / n Status") */
.th-ol-prop > .th-ol-pname .th-kind { font-size: 13px; vertical-align: 0; width: 13px; justify-content: center; flex: none; opacity: .6; } /* as faint as on a page's rows */
/* A drawn mark sits like a font icon: on the words' line, in their colour (the kit's ICONS, DRAWN). */
.th-drawn { display: inline-flex; align-items: center; line-height: 1; }
.th-drawn > svg { display: block; width: 12px; height: 12px; }
.th-ol-pv { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: var(--th-ol-gap); overflow-wrap: normal; word-break: normal; }
.th-ol-pv > .th-ol-body { flex: 1 1 auto; }
/* From the second level down the names' column is narrower, so three levels leave the names room at a page's width; set
   on what a second-level node holds, so the lines and the hairline under them read the same width. */
.th-ol-kids .th-ol-kids > .th-ol-in { --th-ol-name: 9.5em; }   /* 8.5em until 7 November 2026: "Symptom type", "Diagnosed by" and "Confirmation" took two lines at the rows' size, and the lines lost their rhythm */
/* A list that opens with no line of its own (a row's list): the same unrolling, no hairline. */
.th-ol-kids.th-ol-bare { margin-left: 0; padding-left: 0; border-left: 0; }
.th-ol-pv > .th-ol-day { margin-right: 0; }
.th-ol-bullet { display: flex; align-items: baseline; gap: 8px; min-height: 26px; padding: 1px 4px; margin-left: -4px; }
/* The dot is the library's lk-bul (outline.dot): only its place here, centred on the first line of the words as Logseq centres it on
   its row. A dot that opens something points as Logseq's does. */
.th-ol-dot { flex: none; width: 16px; height: 1.5em; align-self: flex-start; display: inline-flex; align-items: center; justify-content: center; }
.th-ol-bullet[data-bullet] > .th-ol-dot { cursor: pointer; }
.th-ol-words { min-width: 0; flex: 1; outline: none; }
.th-ol-new > .th-ol-dot { opacity: .45; }
.th-ol-dot-room { visibility: hidden; }
.th-field.th-ol-write { display: flex; border: 0; padding: 0; min-height: 21px; font-size: inherit; line-height: inherit; }
.th-field.th-ol-write > input { cursor: text; caret-color: currentColor; }
.th-ol-line.th-ol-moreline { min-height: 24px; padding-top: 0; padding-bottom: 0; }
.th-ol-line.th-ol-moreline:hover { background: transparent; }
.th-ol-name { color: inherit; cursor: pointer; } /* its underline and mark are Look's, through lk-node */
/* Narrow (the sidebar, a narrow window): inside an opened node a property's name sits on its own line above the nodes it
   holds or that point through it,
   and the indent gives way, so three levels still fit with whole words. Only where the section is truly narrow: at
   the page's width the values' column is about 540 px wide in a 1100 px window, and 560 put every linked property on
   two lines there (the review, 31 October); below 420 the names' column would take a third of the room. */
.th-ol { container: th-ol / inline-size; }
@container th-ol (max-width: 420px) {
  .th-ol-kids { padding-left: 10px; }
  .th-ol-kids .th-ol-prop:has(> .th-ol-pv > :is(.th-chev, .th-ol-day)) { flex-wrap: wrap; }
  .th-ol-kids .th-ol-prop:has(> .th-ol-pv > :is(.th-chev, .th-ol-day)) > .th-ol-pname { width: auto; flex-basis: 100%; }
  .th-ol-kids .th-ol-prop > .th-ol-pname:empty { display: none; }
  .th-ol-kids .th-ol-from-prop { --th-ol-cx: 8px; }
  .th-ol-kids .th-ol-prop:has(> .th-ol-pv > :is(.th-chev, .th-ol-day)) > .th-ol-pv > .th-chev:first-child { margin-left: 0; }
  .th-ol-kids .th-ol-from-back { --th-ol-cx: calc(var(--th-ol-day) + var(--th-ol-gap) + 8px); }
  .th-ol-leads, .th-ol-kids { --th-ol-lname: 7.5em; }
  .th-ol-leads:not(.th-ol-pointing) { flex-wrap: wrap; }
  .th-ol-leads:not(.th-ol-pointing) > .th-ol-lname { flex: 1 1 auto; width: auto; }
  .th-ol-leads:not(.th-ol-pointing) > .th-ol-lname:empty { display: none; }
  .th-ol-leads:not(.th-ol-pointing) > .th-ol-end { order: 1; }
  .th-ol-leads:not(.th-ol-pointing) > .th-ol-to { order: 2; flex-basis: 100%; padding-left: calc(16px + var(--th-ol-gap)); box-sizing: border-box; }
  .th-ol-from-leads, .th-ol-kids .th-ol-from-leads { --th-ol-cx: calc(16px + var(--th-ol-gap) + 8px); }
  .th-ol-end { min-width: 3.6em; padding-left: 8px; } }
.th-pencil { all: unset; cursor: pointer; } /* italic, grey and dotted are Look's, through lk-pencil */
.th-pencil:hover { color: var(--lk-quiet); }
.th-pencil.th-pencil-taken { font-style: normal; color: inherit; text-decoration: none; }
.th-pencil:focus-visible { outline: none; background: var(--lk-wash) !important; }
/* The trail is the library's lk-trail with lk-step; the place you are at ends it, in the text colour. */
.th-ol-sep { color: var(--lk-faint); }
.th-ol-trail > .th-ol-here { color: var(--lk-text, currentColor); font-weight: 600; }
.th-ol-here .th-tag { margin-left: 6px; font-weight: 400; }
/* The tag map's pieces (0.4.448): the count column, a property with the tag it leads to, a group's heading, a finding.
   --th-ol-lname is the property names' column, so the tags they lead to start on one column and open under themselves. */
.th-ol { --th-ol-lname: 9.5em; }
.th-ol.th-ol-margin { position: relative; padding-left: 24px; }
.th-ol-margin .th-ol-line { position: static; }
.th-ol-margin .th-ol-line > input.lk-tick[type=checkbox] { left: 2px; top: auto; margin-top: 5px; }
.th-ol-end { flex: none; margin-left: auto; padding-left: 12px; min-width: 5.2em; text-align: right; font-size: var(--lk-small); font-variant-numeric: tabular-nums; white-space: nowrap; }
.th-ol-count { color: inherit; text-decoration: underline; text-decoration-color: var(--lk-line); text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
.th-ol-count:hover { text-decoration-color: currentColor; }
span.th-ol-count { text-decoration: none; cursor: default; }
.th-ol-leads > .th-ol-lname { flex: none; width: var(--th-ol-lname); display: inline-flex; gap: 6px; align-items: baseline; }
.th-ol-lwords { min-width: 0; overflow-wrap: normal; word-break: normal; }
.th-ol-inh > .th-ol-lname { color: var(--lk-quiet); }
.th-ol-inhw { color: var(--lk-faint); font-size: var(--lk-small); white-space: nowrap; }
.th-ol-to { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: var(--th-ol-gap); }
.th-ol-to > .th-chev { align-self: flex-start; top: 1px; }
.th-ol-to .th-ol-open { font-weight: 700; }
.th-ol-count.th-ol-n { margin-left: 6px; color: var(--lk-faint); font-size: var(--lk-small); font-variant-numeric: tabular-nums; text-decoration-color: var(--lk-line); }
.th-ol-pointing > .th-ol-lname { width: var(--th-ol-lname); } /* one column for every line of a list; a tag longer than it wraps between its words */
.th-ol-pointing > .th-ol-lname .th-tag { white-space: normal; overflow-wrap: normal; word-break: normal; }
.th-ol-from-leads { --th-ol-cx: calc(16px + 2 * var(--th-ol-gap) + var(--th-ol-lname) + 8px); }
.th-field-count { flex: none; color: var(--lk-faint); font-size: var(--lk-small); font-variant-numeric: tabular-nums; padding-left: 6px; }
@media (prefers-reduced-motion: reduce) { .th-ol-unit { transition: none; } }
/* A kind's mark (0.4.473), 10 px in the quiet grey; a kind's row in a list of tags: its mark and its word in weight, as
   the map's headings, the count of its nodes at the end in the quiet grey. */
/* The hover card: a node's preview with a little room. */
.th-card { padding: 10px 12px; font-size: 14px; }
.th-card a { color: inherit; text-decoration: none; }
.th-card-title { display: block; font-weight: 600; margin-bottom: 3px; }
.th-card-title:hover, .th-card-fields a:hover, .th-card-line:hover { text-decoration: underline; text-decoration-color: var(--lk-line); text-underline-offset: 3px; }
.th-card-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; row-gap: 4px; margin-top: 8px; }
.th-card-name { color: var(--lk-faint); }
.th-card-lines { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--lk-hair); color: var(--lk-quiet); }
.th-card :first-child:is(.th-card-fields, .th-card-lines) { margin-top: 0; padding-top: 0; border-top: 0; }
.th-card-line { display: block; border-radius: 4px; margin: 0 -4px; padding: 0 4px; }
.th-card-line:hover { background: var(--lk-wash); text-decoration: none; }
.th-card-line::before { content: '• '; color: var(--lk-faint); }
/* The quiet line (the library's lk-note) and the help paragraph. */
.lk-note { line-height: 1.45; padding: 2px 0; }
.th-pop .lk-note { padding: 4px 8px; }
.th-anchor { position: fixed; width: 0; height: 0; pointer-events: none; }

`;

// This file's own boxes: the kit's pop-ups, anchors and dialog, and the Undo dock.
leftovers.push({ prefix: 'Threads: ', elements: '.th-pop, .th-anchor, dialog.th-dialog' });

// THE finder of the plugin's marks on Logseq's screen (2026-10-23): every class and attribute prefix any part uses.
// The troubleshooting box counts with it, the boot test looks for leftovers with it and the frame tests
// (tools/frames.js, the plugin's tools/motion-check.js) track with it, so a new prefix is never counted by one and missed by another.
// A new prefix goes here and nowhere else.
const MARK_CLASS = /^th-/, MARK_ATTR = /^data-th-/;
const isOwnMark = node => node?.nodeType === 1 && ([...node.attributes].some(attr => MARK_ATTR.test(attr.name))
  || (typeof node.className === 'string' && [...node.classList].some(cls => MARK_CLASS.test(cls))));
// Every mark in doc, counted: 'data-th-x' → n, '.th-y' → n.
function ownMarks(doc) {
  const marks = new Map();
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of node.attributes) if (MARK_ATTR.test(attr.name)) marks.set(attr.name, (marks.get(attr.name) || 0) + 1);
    if (typeof node.className === 'string') for (const cls of node.classList) if (MARK_CLASS.test(cls)) marks.set('.' + cls, (marks.get('.' + cls) || 0) + 1);
  }
  return marks;
}

(window.Threads ||= {}).shared = {
  host, notify, lifecycle, sweepLeftovers, take, screen, openEntity, openPageNamed, settingReader, perf, warnings,
  kitCss, el, esc, ICONS, icon, iconHtml, kindIconHtml, tag, quiet, go, keepKeys, field, fieldHtml, outline, note, popup, popups, pickValue, editInPlace, ask, card, undo,
  MARK_CLASS, MARK_ATTR, isOwnMark, ownMarks, lifeCounts,
};
})();
