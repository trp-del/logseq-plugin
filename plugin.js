/* The door every module comes in by. Loaded first. A module's own main.js, as it loads, calls
   PluginDoor.register({ key, title, about, schema, start, stop }); main.js, loaded last, gives Logseq every module's
   settings as one list and starts the modules in the order they registered. Logseq gives a plugin one start (logseq.ready),
   one settings list and one clean-up (beforeunload), so those three belong to main.js and to no module. The name is not
   Plugin: every browser already has a window.Plugin of its own, the entries of navigator.plugins.
   What every module draws with is here too, whichever are switched on: the greys and the shared names (Door.NAMES), the four
   marks, the icon of what a property holds and the Undo arrow, each drawn once. */
(function () {
const Door = (window.PluginDoor ||= { modules: [] });
Door.register = module => { Door.modules.push(module); };
// What a part shows in the settings window: { schema, specimen } (settings/window.js), or { none } when it has nothing to set.
Door.described = {};
Door.describe = (key, settings) => { Door.described[key] = settings; };
/* What a change in the graph is, from what Logseq hands the change hook ({ blocks, deletedBlockUuids, txMeta }). Writing is
   what typing does: words saved, a bullet made or moved. Logseq lists the page with it (its stamp moved), so a page in the
   list says nothing. Everything else (a property set, a tag taken off, a rename, a delete, an undo) changes the graph's shape.
   structureWatch() gives a module its own memory of each block's tags and name: true when a change may reach the tags and
   pages it holds, false for writing that leaves them as they were. A block not seen before counts only if it carries a tag. */
const WRITING = new Set(['save-block', 'insert-blocks', 'move-blocks', 'indent-outdent-blocks']);
const LOGSEQ_KIND = /^logseq\.class\/(?:Page|Journal)$/;
Door.writing = change => WRITING.has(change?.txMeta?.outlinerOp) && !change.txMeta['undo?'] && !change.txMeta['redo?'];
Door.structureWatch = () => {
  const seen = new Map();
  return change => {
    let reached = !Door.writing(change);
    for (const block of change?.blocks || []) {
      const tags = (block.tags || []).filter(tag => !LOGSEQ_KIND.test(tag?.ident || '')).map(tag => tag?.id ?? tag).sort();
      const now = JSON.stringify([tags, block.name ?? '']), was = seen.get(block.id);
      seen.set(block.id, now);
      if (was === undefined ? tags.length > 0 : was !== now) reached = true;
    }
    return reached;
  };
};
// Logseq tells every onSettingsChanged of any setting saved: this says whether one of a module's own keys is what changed.
Door.settingChanged = (keys, now, before) => !before || keys.some(key => JSON.stringify(now?.[key]) !== JSON.stringify(before[key]));

/* The four small helpers every module needs, once (6 November 2026; until then each module wrote its own): host() is Logseq's
   page (the plugin runs in a frame of it); esc(text) escapes words for markup; el(doc, tag, props, ...children) makes an element
   (attributes by name, listeners by event name, markup by html; a null or false prop is skipped); notify(text, status) is
   Logseq's notice, with no options (a timeout option leaves the notice on screen). */
Door.host = () => { try { return window.parent.document; } catch (error) { return document; } };
Door.esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
Door.el = (doc, tag, props = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (typeof value === 'function') node.addEventListener(key, value);
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child != null && child !== false) node.append(child);
  return node;
};
Door.notify = (text, status = 'info') => { try { return logseq.UI.showMsg(text, status); } catch (error) { console.log(`Logseq Plugin: ${text}`); } };
/* Two checks every Undo makes before it writes, so an Undo never takes away what was written after the change it undoes (8 November
   2026, the data-safety review). valueStamp(uuid, ident): what a node holds under a property this moment, as words to compare (a
   value's id with its words, a number's number), taken right after a change and again at Undo: the same stamp, nothing touched
   since. pageUntouched(uuid): a page a change made can go again only while no bullet on it has words, nothing else points at it
   (a link, a property's value) and it holds no value of its own.
   ask: the module's own query call, one query in, the rows out (Logseq's datascriptQuery when none is given). */
const dsAsk = query => logseq.DB.datascriptQuery(query);
Door.valueStamp = async (uuid, ident, ask = dsAsk) => {
  const at = String(ident).replace(/^:/, '');
  const values = (await ask(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${at} ?v]]`) || []).map(([v]) => v);
  const ids = values.filter(Number.isInteger), words = new Map();
  if (ids.length) {
    const these = `[(ground [${ids.join(' ')}]) [?v ...]]`;
    for (const [v, t] of await ask(`[:find ?v ?t :where ${these} [?v :block/title ?t]]`) || []) words.set(v, `${v}:${t}`);
    for (const [v, n] of await ask(`[:find ?v ?n :where ${these} [?v :logseq.property/value ?n]]`) || []) words.set(v, `${v}=${JSON.stringify(n)}`);
  }
  return JSON.stringify(values.map(v => words.get(v) ?? JSON.stringify(v)).sort());
};
Door.pageUntouched = async (uuid, ask = dsAsk, { own = true } = {}) => {
  const page = `[?p :block/uuid #uuid "${uuid}"]`, USER = '[?pr :db/ident ?a] [?pr :block/tags :logseq.class/Property] [(namespace ?a) ?ns] [(= ?ns "user.property")]';
  const words = await ask(`[:find ?t :where ${page} [?b :block/page ?p] [?b :block/title ?t]]`) || [];
  if (words.some(([t]) => String(t ?? '').trim())) return false;
  if ((await ask(`[:find ?b :where ${page} [?b :block/refs ?p] (not [?b :block/page ?p])]`) || []).length) return false;
  if ((await ask(`[:find ?b :where ${page} [?b ?a ?p] ${USER}]`) || []).length) return false;
  // own: false for a page the change itself gave values (Threads' "+" line), whose own state the maker compares (madeStamp).
  return !own || !(await ask(`[:find ?a :where ${page} [?p ?a _] ${USER}]`) || []).length;
};
/* THE one way the plugin writes to the graph (10 November 2026, the code review's "one write layer"; until then Look, Predictive,
   Structure, Threads and the outside door each wrapped Logseq's write calls for themselves). Every write a module makes goes
   through Door.write, and test/writes.js fails on a write call anywhere else, as test/library.js does on a hand-drawn button.
   The writes are Logseq's own editor calls under the plugin's names, so a Logseq update that changes one is mended here once.
   The Undo guard is built in beside them, so no module keeps a rule of its own for what an Undo may take away:
     stamp(uuid, ident), untouched(uuid, ask, { own })   the two checks above;
     madeStamp(uuid)        a thing just made, as it stands: its words, when it last changed, the bullets inside it;
     guarded(spots, undo)   resolves to an undo that runs only while each [node, property] holds what the change left, and answers
                            'kept' otherwise;
     deletePage(page)       a page is deleted by its id, never by a name another page could share: by its uuid, and where
                            Logseq leaves the page in place when asked so (seen in 2.0.2), by its name only once that name is
                            seen to answer to this very page. Answers whether it went;
     dropMade(page, { own })  a page a change made goes again only while untouched. Answers whether it went.
   ask is the caller's query call where it has one of its own (a stand-in's), Logseq's otherwise. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Door.UUID = UUID;
const pageGone = async (uuid, ask = dsAsk) => !(await ask(`[:find ?p :where [?p :block/uuid #uuid "${uuid}"] (not [?p :logseq.property/deleted-at _])]`) || []).length;
Door.write = {
  addTag: (uuid, tagUuid) => logseq.Editor.addBlockTag(uuid, tagUuid),
  removeTag: (uuid, tagUuid) => logseq.Editor.removeBlockTag(uuid, tagUuid),
  setValue: (uuid, ident, value, opts) => logseq.Editor.upsertBlockProperty(uuid, ident, value, opts),
  unsetValue: (uuid, ident) => logseq.Editor.removeBlockProperty(uuid, ident),
  setWords: (uuid, words, opts) => logseq.Editor.updateBlock(uuid, words, opts),
  insertBlock: (uuid, words, opts) => logseq.Editor.insertBlock(uuid, words, opts),
  appendBlock: (page, words, opts) => logseq.Editor.appendBlockInPage(page, words, opts),
  removeBlock: uuid => logseq.Editor.removeBlock(uuid),
  moveBlock: (uuid, target, opts) => logseq.Editor.moveBlock(uuid, target, opts),
  createPage: (name, props, opts) => logseq.Editor.createPage(name, props, opts),
  createJournalPage: date => logseq.Editor.createJournalPage(date),
  renamePage: (uuid, name) => logseq.Editor.renamePage(uuid, name),
  restorePage: uuid => logseq.Editor.restorePage(uuid),
  deleteForGood: uuid => logseq.Editor.deleteRecycledPagePermanently(uuid),   // out of Logseq's Recycle: nothing brings it back
  addExtends: (tagUuid, parentUuid) => logseq.Editor.addTagExtends(tagUuid, parentUuid),
  removeExtends: (tagUuid, parentUuid) => logseq.Editor.removeTagExtends(tagUuid, parentUuid),
  /* A bullet shows a page (Logseq's Node embed is the bullet's link to the page): one write, and the bullet's words stay in the
     graph under it, so taking the link off again shows them as they were (seen in Logseq 2.0.2, 10 November 2026). */
  showPage: (uuid, pageId) => logseq.Editor.upsertBlockProperty(uuid, 'block/link', pageId, { entityId: true }),
  unshowPage: uuid => logseq.Editor.removeBlockProperty(uuid, 'block/link'),
  async deletePage(page, ask = dsAsk) {
    const uuid = String(page?.uuid ?? page ?? '');
    if (!UUID.test(uuid)) throw new Error('a page is deleted by its id, and none was given');
    if (await pageGone(uuid, ask)) return false;
    await logseq.Editor.deletePage(uuid);
    if (await pageGone(uuid, ask)) return true;
    const found = await Promise.resolve(logseq.Editor.getPage(uuid)).catch(() => null), name = found?.name || found?.title || found?.originalName;
    const named = name ? await Promise.resolve(logseq.Editor.getPage(name)).catch(() => null) : null;
    if (String(named?.uuid ?? '').toLowerCase() !== uuid.toLowerCase()) throw new Error('another page answers to its name, so it stays');
    await logseq.Editor.deletePage(name);
    return pageGone(uuid, ask);
  },
  async dropMade(page, { own = true, ask = dsAsk } = {}) {
    if (!await Door.pageUntouched(String(page?.uuid ?? page), ask, { own })) return false;
    return Door.write.deletePage(page, ask);
  },
  stamp: (uuid, ident, ask) => Door.valueStamp(uuid, ident, ask),
  untouched: (uuid, ask, opts) => Door.pageUntouched(uuid, ask, opts),
  async madeStamp(uuid, ask = dsAsk) {
    const [[id, words, at] = []] = await ask(`[:find ?b ?w ?at :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?w] [?b :block/updated-at ?at]]`) || [];
    if (id == null) return '';
    const [[kids] = [0]] = await ask(`[:find (count ?k) :where [?k :block/parent ${id}] (not [?k :logseq.property/created-from-property _])]`) || [];
    return JSON.stringify([words, at, kids]);
  },
  async guarded(spots, undo, ask) {
    const read = () => Promise.all(spots.map(([uuid, ident]) => Door.valueStamp(uuid, ident, ask))).then(JSON.stringify);
    const was = await read();
    return async () => { if (await read() !== was) return 'kept'; return undo(); };
  },
};
/* What one module asks of another goes through here, never by a name on the window (10 November 2026; Look's × on a tag's page
   called Structure straight). The module that answers offers the ask by name as it starts and gets back what takes it off at
   stop; Door.ask(name, ...args) runs it and resolves to its answer, or to Door.UNANSWERED when no module offers it (the one that
   would is switched off or has not started). Door.answers(name) says whether one does. */
const offeredAsks = new Map();
Door.UNANSWERED = Symbol('unanswered');
Door.offerAsk = (name, fn) => { offeredAsks.set(name, fn); return () => { if (offeredAsks.get(name) === fn) offeredAsks.delete(name); }; };
Door.answers = name => offeredAsks.has(name);
Door.ask = async (name, ...args) => { const fn = offeredAsks.get(name); return fn ? fn(...args) : Door.UNANSWERED; };
// Whether a module is switched on (its switch in the settings). The switches are read as the plugin starts.
Door.runs = key => logseq.settings?.[key + 'On'] !== false;
/* The English name of each of Logseq's built-in commands, by its id without the colon: the app hands a plugin its state but
   not its translation. Taken from Logseq's dictionary (`src/resources/dicts/en.edn`, the `:command.*` entries, 130 on 31
   October 2026). Find's list of commands and Look's key sheet name commands with it. */
Door.COMMAND_LABELS = {
  'auto-complete/complete': 'Auto-complete: Choose selected item',
  'auto-complete/meta-complete': 'Auto-complete: Cmd + Enter to choose selected item',
  'auto-complete/next': 'Auto-complete: Select next item',
  'auto-complete/prev': 'Auto-complete: Select previous item',
  'auto-complete/shift-complete': 'Auto-complete: Open selected item in sidebar',
  'command-palette/toggle': 'Search commands',
  'editor/add-comment': 'Add comment',
  'editor/add-property': 'Add property',
  'editor/add-property-deadline': 'Add task deadline to selected block',
  'editor/add-property-icon': 'Add icon',
  'editor/add-property-priority': 'Add task priority to selected block',
  'editor/add-property-status': 'Add task status to selected block',
  'editor/add-reaction': 'Add reaction',
  'editor/backspace': 'Backspace / Delete backwards',
  'editor/backward-kill-word': 'Delete a word backwards',
  'editor/backward-word': 'Move cursor backward a word',
  'editor/beginning-of-block': 'Move cursor to the beginning of a block',
  'editor/bold': 'Bold',
  'editor/clear-block': 'Delete entire block content',
  'editor/collapse-block-children': 'Collapse',
  'editor/copy': 'Copy (copies either selection, or block reference)',
  'editor/copy-embed': 'Copy a block embed pointing to the current block',
  'editor/copy-page-url': 'Copy page url',
  'editor/copy-text': 'Copy selections as text',
  'editor/cut': 'Cut',
  'editor/cycle-todo': 'Rotate the TODO state',
  'editor/delete': 'Delete / Delete forwards',
  'editor/delete-selection': 'Delete selected blocks',
  'editor/down': 'Move cursor down / Select down',
  'editor/end-of-block': 'Move cursor to the end of a block',
  'editor/escape-editing': 'Escape editing',
  'editor/expand-block-children': 'Expand',
  'editor/follow-link': 'Follow link under cursor',
  'editor/forward-kill-word': 'Delete a word forwards',
  'editor/forward-word': 'Move cursor forward a word',
  'editor/highlight': 'Highlight',
  'editor/indent': 'Indent block',
  'editor/insert-link': 'HTML Link',
  'editor/insert-youtube-timestamp': 'Insert youtube timestamp',
  'editor/italics': 'Italics',
  'editor/jump': 'Jump to a property key or value',
  'editor/kill-line-after': 'Delete line after cursor position',
  'editor/kill-line-before': 'Delete line before cursor position',
  'editor/left': 'Move cursor left / Open selected block at beginning',
  'editor/move-block-down': 'Move block down',
  'editor/move-block-up': 'Move block up',
  'editor/move-blocks': 'Move blocks to',
  'editor/new-block': 'Create new block',
  'editor/new-line': 'New line in current block',
  'editor/open-edit': 'Edit selected block',
  'editor/open-link-in-sidebar': 'Open link in sidebar',
  'editor/open-selected-blocks-in-sidebar': 'Open selected block(s) in sidebar',
  'editor/outdent': 'Outdent block',
  'editor/paste-text-in-one-block-at-point': 'Paste text into one block at point',
  'editor/quick-add': 'Quick add',
  'editor/redo': 'Redo',
  'editor/right': 'Move cursor right / Open selected block at end',
  'editor/select-all-blocks': 'Select all blocks',
  'editor/select-block-down': 'Select block below',
  'editor/select-block-up': 'Select block above',
  'editor/select-down': 'Select content below',
  'editor/select-parent': 'Select parent block',
  'editor/select-up': 'Select content above',
  'editor/set-tags': 'Set tags for selected block(s)',
  'editor/strike-through': 'Strikethrough',
  'editor/toggle-block-children': 'Toggle expand/collapse',
  'editor/toggle-display-hidden-properties': 'Toggle display hidden properties',
  'editor/toggle-number-list': 'Toggle number list',
  'editor/toggle-open-blocks': 'Toggle open blocks (collapse or expand all blocks)',
  'editor/undo': 'Undo',
  'editor/up': 'Move cursor up / Select up',
  'editor/zoom-in': 'Zoom in editing block / Forwards otherwise',
  'editor/zoom-out': 'Zoom out editing block / Backwards otherwise',
  'go/all-graphs': 'Go to all graphs',
  'go/all-pages': 'Go to all pages',
  'go/backward': 'Backwards',
  'go/electron-find-in-page': 'Find text in page',
  'go/electron-jump-to-the-next': 'Jump to the next match to your Find bar search',
  'go/electron-jump-to-the-previous': 'Jump to the previous match to your Find bar search',
  'go/flashcards': 'Toggle flashcards',
  'go/forward': 'Forwards',
  'go/graph-view': 'Go to graph view',
  'go/home': 'Go to home',
  'go/journals': 'Go to journals',
  'go/keyboard-shortcuts': 'Go to keyboard shortcuts',
  'go/next-journal': 'Go to next journal',
  'go/prev-journal': 'Go to previous journal',
  'go/search': 'Search pages and blocks',
  'go/search-in-page': 'Search blocks in page',
  'go/search-themes': 'Search themes',
  'go/tomorrow': 'Go to tomorrow',
  'graph/add': 'Add a graph',
  'graph/db-add': 'Add a DB graph',
  'graph/db-save': 'Save the current db to the disk (~/logseq/graphs/your-current-graph)',
  'graph/export-as-html': 'Export public graph pages as HTML',
  'graph/open': 'Select graph to open',
  'graph/remove': 'Remove a graph',
  'misc/copy': 'Copy',
  'misc/export-block-data': 'Export block EDN data',
  'misc/export-graph-ontology-data': 'Export graph\'s tags and properties EDN data',
  'misc/export-page-data': 'Export page EDN data',
  'misc/import-edn-data': 'Import EDN data',
  'page/toggle-favorite': 'Add to/remove from favorites',
  'pdf/close': 'PDF: Close current pdf doc',
  'pdf/find': 'PDF: Search text of current pdf doc',
  'pdf/next-page': 'PDF: Next page of current pdf doc',
  'pdf/previous-page': 'PDF: Previous page of current pdf doc',
  'publish/open-dialog': 'Open publish dialog for current page',
  'search/re-index': 'Rebuild search index',
  'shell/run': 'Run git command',
  'sidebar/clear': 'Clear all in the right sidebar',
  'sidebar/close-top': 'Closes the top item in the right sidebar',
  'sidebar/open-today-page': 'Open today\'s page in the right sidebar',
  'ui/clear-all-notifications': 'Clear all notifications',
  'ui/customize-appearance': 'Customize appearance',
  'ui/goto-plugins': 'Go to plugins dashboard',
  'ui/highlight-recent-blocks': 'Toggle highlight recent blocks',
  'ui/install-plugin-from-github': 'Install plugin from GitHub release',
  'ui/install-plugins-from-file': 'Install plugins from plugins.edn',
  'ui/select-theme-color': 'Select available theme colors',
  'ui/toggle-brackets': 'Toggle whether to display brackets',
  'ui/toggle-contents': 'Toggle Contents in sidebar',
  'ui/toggle-document-mode': 'Toggle document mode',
  'ui/toggle-help': 'Toggle help',
  'ui/toggle-left-sidebar': 'Toggle left sidebar',
  'ui/toggle-right-sidebar': 'Toggle right sidebar',
  'ui/toggle-settings': 'Toggle settings',
  'ui/toggle-theme': 'Toggle between dark/light theme',
  'ui/toggle-wide-mode': 'Toggle wide mode',
  'window/close': 'Close window'
};
/* Logseq's commands as its palette keeps them in the app's state ({ id, shortcut, desc, action }), each shortcut the one in force:
   the palette's state keeps Logseq's own default, and a key changed in the graph's config (its :shortcuts, where Logseq's
   keymap and the key sheet write) wins over it, an empty one for none. Read on the app's api on the parent window; [] when
   it cannot be read. */
/* readLogseqConfigKeys: the keys changed in the graph's config, {} where none is changed, and null when they could not be read
   (no api, a throw, an answer that is no list of keys), which is not the same as none. setLogseqKey writes one command's key
   into that list, every other key kept: Logseq replaces the whole list with what it is handed, so when the list could not
   be read nothing is written and false comes back (12 November 2026, the library review: a failed read wrote a list of one). */
Door.readLogseqConfigKeys = () => {
  try {
    const api = window.parent?.logseq?.api;
    if (typeof api?.get_current_graph_configs !== 'function') return null;
    const all = api.get_current_graph_configs('shortcuts');
    if (all == null) return {};
    return typeof all === 'object' && !Array.isArray(all) ? all : null;
  } catch (error) { return null; }
};
Door.logseqConfigKeys = () => Door.readLogseqConfigKeys() || {};
Door.setLogseqKey = (id, spelling) => {
  const kept = Door.readLogseqConfigKeys(), api = window.parent?.logseq?.api;
  if (!kept || !id || typeof api?.set_current_graph_configs !== 'function') return false;
  const keys = { ...kept, [id]: spelling ? [spelling] : [] };
  // Made in Logseq's own window: Logseq reads only an object of its window, and one from the plugin's frame is passed over.
  try { api.set_current_graph_configs((window.parent.JSON || JSON).parse(JSON.stringify({ shortcuts: keys }))); return true; } catch (error) { console.error('Logseq’s key could not be saved', error); return false; }
};
Door.logseqCommands = () => {
  let all = [];
  try { all = window.parent?.logseq?.api?.get_state_from_store?.('command-palette/commands'); } catch (error) { all = []; }
  if (!Array.isArray(all)) return [];
  const own = Door.logseqConfigKeys();
  return all.map(command => {
    const id = String(command?.id ?? '').replace(/^:/, '');
    if (!(id in own)) return command;
    const set = own[id], first = Array.isArray(set) ? set[0] : set;
    return { ...command, shortcut: typeof first === 'string' ? first : '' };
  });
};
/* A key in plain words, as the grammar tells keys: "Option T", "Cmd Shift K", "Cmd Option Enter", "Shift Tab"; two letters
   pressed one after the other stay as Logseq writes them, "g j". Takes Logseq's spelling ("⌘+⇧+k", "t s | ⌘+,": the first binding) and a
   setting's ("mod+alt+enter"). None, or Logseq's "Disabled": ''. */
const ON_MAC = /Mac|iPhone|iPad/i.test(typeof navigator === 'undefined' ? 'Mac' : navigator.platform || '');
const KEY_WORDS = { mod: ON_MAC ? 'Cmd' : 'Ctrl', cmd: 'Cmd', meta: 'Cmd', command: 'Cmd', '⌘': 'Cmd',
  alt: ON_MAC ? 'Option' : 'Alt', opt: 'Option', option: 'Option', '⌥': 'Option', shift: 'Shift', '⇧': 'Shift', ctrl: 'Ctrl', control: 'Ctrl', '⌃': 'Ctrl',
  enter: 'Enter', return: 'Enter', '↩': 'Enter', tab: 'Tab', escape: 'Escape', esc: 'Escape', backspace: 'Backspace', delete: 'Delete', space: 'Space',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right', '↑': 'Up', '↓': 'Down', '←': 'Left', '→': 'Right' };
Door.keyWords = spelling => {
  if (typeof spelling !== 'string' || !spelling.trim() || /disabled/i.test(spelling)) return '';
  return spelling.split(' | ')[0].trim().split(/\s+/).map(step => step.length === 1 ? step : step.split('+').filter(Boolean)
    .map(part => KEY_WORDS[part.toLowerCase()] || (part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))).join(' ')).join(' ');
};
/* A key as the Mac's marks, as Look's key sheet writes it (the owner, 12 November 2026: "revert to icons from modifiers"):
   ⌘⌥T, ⌘⇧↑, ⇧⇥, a letter after a mark in capitals; two letters pressed one after the other stay as Logseq writes them, "t p".
   Takes the same spellings as Door.keyWords. Everywhere else a key is told in words. */
const KEY_MARKS = { mod: ON_MAC ? '⌘' : 'Ctrl ', cmd: '⌘', meta: '⌘', command: '⌘', alt: '⌥', opt: '⌥', option: '⌥', shift: '⇧', ctrl: '⌃', control: '⌃',
  enter: '↩', return: '↩', tab: '⇥', escape: '⎋', esc: '⎋', backspace: '⌫', delete: '⌦', space: 'Space', up: '↑', down: '↓', left: '←', right: '→', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };
const MARK_ORDER = ['⌃', '⌥', '⇧', '⌘'];   // the order a Mac menu writes them in
Door.keyMarks = spelling => {
  if (typeof spelling !== 'string' || !spelling.trim() || /disabled/i.test(spelling)) return '';
  return spelling.split(' | ')[0].trim().split(/\s+/).map(step => {
    if (step.length === 1) return step;
    const parts = step.split('+').filter(Boolean).map(part => KEY_MARKS[part.toLowerCase()] || (part.length === 1 ? part.toUpperCase() : part));
    const key = parts.pop();
    return parts.sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b)).join('') + key;
  }).join(' ');
};
/* THE keys of the plugin (12 November 2026, the library review: the settings window, the key sheet and Predictive each read a
   pressed key by a rule of their own, so an arrow recorded in the settings window, "up", never matched Predictive's "arrowup",
   nor Option with a punctuation mark, which a Mac types as another character). A key is kept in Logseq's spelling,
   "mod+alt+enter": mod is Cmd on a Mac and Ctrl elsewhere.
     mac                 whether this is a Mac;
     name(event)         the key pressed, by its place on the keyboard where Option would change what it types: "t", "5", ";",
                         "up", "enter", "space";
     pressed(event)      the keys pressed as a setting spells them, "mod+alt+t";
     logseq(event)       the same keys as Logseq's config spells them, "meta+shift+p", "alt+up";
     matches(event, spec) whether the keys pressed are a setting's; an empty setting never;
     tell(part, keys), told(part)  a part's keys that are no setting (Find's, the focus glide's), told once by the part that
                         listens for them and read by the key sheet, so the sheet never writes one from memory. */
const KEY_CODES = { Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Quote: "'", Backquote: '`', Minus: '-', Equal: '=', Space: 'space' };
const KEY_NAMES = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', ' ': 'space', spacebar: 'space', return: 'enter', esc: 'escape' };
const keyNamed = name => { const low = String(name ?? '').toLowerCase(); return KEY_NAMES[low] || low; };
const toldKeys = new Map();
Door.keys = {
  mac: ON_MAC,
  tell: (part, keys) => { toldKeys.set(part, keys); return () => { if (toldKeys.get(part) === keys) toldKeys.delete(part); }; },
  told: part => { try { return toldKeys.get(part)?.() || {}; } catch (error) { return {}; } },
  name: event => { const code = event?.code || ''; return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : KEY_CODES[code] || keyNamed(event?.key); },
  pressed: event => [event.metaKey && (ON_MAC ? 'mod' : 'meta'), event.ctrlKey && (ON_MAC ? 'ctrl' : 'mod'), event.altKey && 'alt', event.shiftKey && 'shift', Door.keys.name(event)].filter(Boolean).join('+'),
  logseq: event => [event.ctrlKey && 'ctrl', event.altKey && 'alt', event.shiftKey && 'shift', event.metaKey && 'meta', Door.keys.name(event)].filter(Boolean).join('+'),
  matches: (event, spec) => {
    const parts = String(spec || '').toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
    if (!parts.length) return false;
    const key = keyNamed(parts.pop()), mods = new Set(parts);
    const meta = mods.has('meta') || mods.has('cmd') || (ON_MAC && mods.has('mod')), ctrl = mods.has('ctrl') || (!ON_MAC && mods.has('mod'));
    if (!!event.metaKey !== meta || !!event.ctrlKey !== ctrl || !!event.altKey !== (mods.has('alt') || mods.has('opt')) || !!event.shiftKey !== mods.has('shift')) return false;
    return Door.keys.name(event) === key || keyNamed(event.key) === key;
  },
};
/* The day a node shows, from its date properties ([node, day, the property's name]): the one titled Date, whatever its ident, else
   the earliest, as Threads reads it. */
Door.datedDays = rows => {
  const days = new Map(), named = new Set();
  for (const [node, day, name] of rows) {
    const isDate = String(name).trim().toLowerCase() === 'date';
    if (!days.has(node) || (isDate && !named.has(node)) || (isDate === named.has(node) && Number(day) < days.get(node))) days.set(node, Number(day));
    if (isDate) named.add(node);
  }
  return days;
};
/* What a property holds, as an icon: the web (three dots joined) for a link to nodes, drawn here because no font has it;
   the rest from Logseq's own icon font (Tabler, loaded on every page). */
Door.WEB = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 2.6 2.4 9.2h7.2Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="2.6" r="1.7" fill="currentColor"/><circle cx="2.4" cy="9.2" r="1.7" fill="currentColor"/><circle cx="9.6" cy="9.2" r="1.7" fill="currentColor"/></svg>';
const KIND_ICONS = { node: null, page: null, date: 'calendar', datetime: 'calendar', text: 'letter-case', default: 'letter-case', number: '123', 'raw-number': '123', choice: 'select', checkbox: 'checkbox', url: 'world' };
Door.kindIconHtml = kind => {
  const k = String(kind || 'text').replace(/^:/, '');
  if (KIND_ICONS[k] === null) return `<i class="lk-icon lk-web" aria-hidden="true">${Door.WEB}</i>`;
  return `<i class="lk-icon ti ti-${KIND_ICONS[k] || 'letter-case'}" aria-hidden="true"></i>`;
};
/* A module's button in Logseq's top toolbar, drawn as Logseq draws its own there (Tabler's line icons as SVG, 20 px, the same
   stroke), so it stands among Home, the arrows and the sidebar button as one of them; a font glyph came out heavier. The drawings
   say what the button opens: Structure a tree of tags, the inspector an i in a circle (Logseq's
   Contents already has the list beside a box) (9 November 2026). */
Door.TOOLBAR_ICONS = {
  structure: 'M3 17a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2zM15 17a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2zM9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2zM6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1M12 9v3',
  inspector: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1',
};
Door.toolbarButton = (model, title, icon) => `<a class="button lk-tool" data-on-click="${model}" title="${title}" aria-label="${title}"><svg class="tabler-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${Door.TOOLBAR_ICONS[icon]}"/></svg></a>`;
/* The plugin's places in Logseq's ··· menu at the top right (the owner, 9 November 2026: "put different plugin features under
   three dots"), where the toolbar had a button for each: a module adds { key, label, icon, run } and gets back what takes it off.
   settings/ways-in.js draws them at the head of the menu each time it opens, in the order added, as Logseq draws its own lines. */
Door.menuItems = [];
Door.addMenuItem = item => { Door.menuItems = Door.menuItems.filter(x => x.key !== item.key).concat(item); return () => { Door.menuItems = Door.menuItems.filter(x => x !== item); }; };
/* One watcher of Logseq's screen for every module (until 5 November 2026 Look and Threads each kept an observer of their own).
   Door.watch(fn, { early }) registers a pass and returns what takes it off. A pass runs once at registration and then once per
   frame after the screen changed, so many changes cost one pass; a change of class alone (pointing, selecting) runs none. An
   early pass runs at once on every change, given the records, before the screen is drawn, so Logseq's own look never shows
   first; it must be quick. What the early passes change is set aside, and what a frame's passes change is shown to the early
   ones once, so the watcher never answers itself. A pass that throws five times is retired for the session. The observer stands
   while any pass is registered and goes with the last. */
const screen = { early: new Set(), passes: new Set(), witnesses: new Set(), observer: null, frame: 0, doc: null, win: null, failures: new Map() };
const SCREEN_ATTRS = ['data-uuid', 'blockid', 'data-collapsed', 'data-page-tags', 'data-ref', 'class', 'data-hl-type'];
function passFailed(fn, set, error) {
  const n = (screen.failures.get(fn) || 0) + 1;
  screen.failures.set(fn, n);
  if (n < 5) return console.error(`PluginDoor: a screen pass failed (${fn.name || 'unnamed'})`, error);
  set.delete(fn);
  console.error(`PluginDoor: ${fn.name || 'a screen pass'} stopped for this session after ${n} errors`, error);
}
function runEarly(records) {
  for (const fn of [...screen.early]) { try { fn(screen.doc, records); } catch (error) { passFailed(fn, screen.early, error); } }
  const own = screen.observer?.takeRecords() || [];
  // A witness only looks (a measuring tool): it is given every change, what the early passes just made included, and changes nothing.
  if (screen.witnesses.size) { const all = own.length ? [...records, ...own] : records; for (const fn of [...screen.witnesses]) { try { fn(screen.doc, all); } catch (error) { passFailed(fn, screen.witnesses, error); } } }
}
function ensureScreen() {
  if (screen.observer) return;
  const doc = window.parent.document, win = doc.defaultView;
  screen.doc = doc; screen.win = win;
  screen.observer = new win.MutationObserver(records => {
    runEarly(records);
    if (screen.frame || !records.some(r => r.type !== 'attributes')) return;
    screen.frame = win.requestAnimationFrame(() => {
      screen.frame = 0;
      for (const fn of [...screen.passes]) { try { fn(doc); } catch (error) { passFailed(fn, screen.passes, error); } }
      const own = screen.observer?.takeRecords() || [];
      if (own.length) runEarly(own);
    });
  });
  screen.observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: SCREEN_ATTRS });
}
Door.watch = (fn, { early = false, witness = false } = {}) => {
  ensureScreen();
  const set = witness ? screen.witnesses : early ? screen.early : screen.passes;
  set.add(fn);
  if (!early && !witness) { try { fn(screen.doc); } catch (error) { passFailed(fn, set, error); } }
  return () => { set.delete(fn); if (!Door.watching()) Door.stopWatching(); };
};
Door.addsElements = records => records.some(r => r.type === 'childList');
Door.watching = () => screen.early.size + screen.passes.size + screen.witnesses.size;
Door.stopWatching = () => {
  screen.observer?.disconnect();
  if (screen.frame) screen.win?.cancelAnimationFrame(screen.frame);
  screen.observer = null; screen.frame = 0; screen.early.clear(); screen.passes.clear(); screen.witnesses.clear();
};
/* THE base of a module (10 November 2026, the code review's "one module base"; until then Predictive's app.js, Threads' shared.js,
   Look's and Find's kits and Structure's and DB Export's main.js each carried a small framework of their own for the same jobs).
   const base = Door.base(key, { prefix, schema, stylePrefix, leaves, styled }) gives a module, or a part of one:
     warnOnce(message, ...details)   a console warning written once per session per message, under the prefix; every one is kept
                                     in Door.warnings (message, first time, count);
     onStop(task)                    a clean-up step; also takes the "off" a Logseq hook returns (anything else is let go);
     listen(target, types, fn, opts) a listener on Logseq's window or page, taken off at stop; both give back what runs the
                                     step now and forgets it, for a part switched off while the module runs;
     watch(pass, opts)               a pass on the one screen watcher (Door.watch), taken off at stop, before the other steps,
                                     so nothing draws again while they undo;
     setting(key)                    a setting's saved value, or its default from the schema when it is missing or of another
                                     type; a key the schema does not hold is given as saved. schema: a list, or what gives one;
     style(key, css)                 a stylesheet through Logseq, sent only when its words changed (every send makes Logseq lay
                                     the page out again); empty words clear it; answers whether it was sent;
     sheet(id, css, cls, doc)        a stylesheet of the module's own in Logseq's page, there at once (a window that opens this
                                     turn cannot wait for Logseq's), taken out at stop; css null leaves its words as they are;
     sweep(doc)                      takes out what the module may leave on Logseq's page (leaves: { elements, attributes, reset });
     stop()                          the watcher's passes off, then every step, the last set up first; the promise waits for
                                     any step that ends later;
     waiting()                       how many steps wait (a count that grows with use is a leak);
     takeOver(stopKey, sweep)        runs the clean-up an earlier copy of the module left in Logseq's window (a copy cut short
                                     by an error or Logseq's ten-second limit), leaves this one there, then sweeps.
   Door.settingReader(schema) is the reader alone; Door.sweep(key, doc) sweeps every base of a module; Door.bases(key) lists them. */
Door.warnings = [];
const bases = [];
Door.settingReader = schema => {
  let list = null, map = null;   // read again only when what gives the schema gives another list
  const defaults = () => {
    const now = (typeof schema === 'function' ? schema() : schema) || [];
    if (now !== list) { list = now; map = new Map(now.map(item => [item.key, item.default])); }
    return map;
  };
  return key => {
    const value = logseq.settings?.[key], known = defaults();
    if (!known.has(key)) return value ?? undefined;
    return typeof value === typeof known.get(key) && value !== null ? value : known.get(key);
  };
};
Door.base = (key, { prefix = '', schema, stylePrefix = '', leaves = null, styled = null } = {}) => {
  const warned = new Map(), tasks = [], offs = [], sent = new Map(), sheets = new Set();
  const base = { key, prefix, leaves };
  base.warnOnce = (message, ...details) => {
    const earlier = warned.get(message);
    if (earlier) { earlier.count++; return; }
    const entry = { message: prefix + message, at: new Date(), count: 1 };
    warned.set(message, entry);
    Door.warnings.push(entry);
    console.warn(prefix + message, ...details.filter(detail => detail !== undefined));
  };
  // What onStop and listen give back runs the step now and takes it off the list, for a part that is switched off while the module runs.
  base.onStop = task => {
    if (typeof task !== 'function') return () => {};
    tasks.push(task);
    return () => { const at = tasks.indexOf(task); if (at < 0) return; tasks.splice(at, 1); return task(); };
  };
  base.listen = (target, types, fn, options) => {
    for (const type of [].concat(types)) target.addEventListener(type, fn, options);
    return base.onStop(() => { for (const type of [].concat(types)) target.removeEventListener(type, fn, options); });
  };
  base.watch = (pass, options) => { const off = Door.watch(pass, options); offs.push(off); return () => { const at = offs.indexOf(off); if (at >= 0) offs.splice(at, 1); off(); }; };
  base.watching = () => offs.length;
  base.setting = Door.settingReader(schema);
  base.style = (name, css) => {
    const text = css && css.trim() ? css : '/* no rules */', changed = sent.get(name) !== text;
    if (styled) styled(name, css, changed);
    if (!changed) return false;
    sent.set(name, text);
    logseq.provideStyle({ key: stylePrefix + name, style: text });
    return true;
  };
  base.styles = () => sent.size;
  base.sheet = (id, css, cls = '', doc = Door.host()) => {
    let sheet = doc.getElementById(id);
    if (!sheet) { sheet = doc.createElement('style'); sheet.id = id; if (cls) sheet.className = cls; doc.head.appendChild(sheet); }
    if (css != null && sheet.textContent !== css) sheet.textContent = css;
    if (!sheets.has(id)) { sheets.add(id); base.onStop(() => { sheets.delete(id); doc.getElementById(id)?.remove(); }); }
    return sheet;
  };
  base.sweep = (doc = Door.host()) => {
    if (!leaves) return;
    try {
      if (leaves.reset) leaves.reset(doc);
      if (leaves.elements) for (const el of doc.querySelectorAll(leaves.elements)) el.remove();
      for (const name of leaves.attributes || []) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
    } catch (error) { console.warn(prefix + 'leftovers could not be cleared', error); }
  };
  base.stop = () => {
    while (offs.length) { try { offs.pop()(); } catch (error) { /* the watcher is gone already */ } }
    const failed = error => base.warnOnce('clean-up step failed', error), pending = [];
    for (const task of tasks.splice(0).reverse()) { try { pending.push(Promise.resolve(task()).catch(failed)); } catch (error) { failed(error); } }
    return Promise.all(pending);
  };
  base.waiting = () => tasks.length;
  base.takeOver = (stopKey, sweep) => {
    let win;
    try { win = Door.host().defaultView; } catch (error) { return; }
    try { win[stopKey]?.(); } catch (error) { base.warnOnce('an earlier copy could not be stopped', error); }
    win[stopKey] = base.stop;
    base.onStop(() => { if (win[stopKey] === base.stop) delete win[stopKey]; });
    if (sweep) try { sweep(win.document); } catch (error) { base.warnOnce('leftovers could not be cleared', error); }
  };
  bases.push(base);
  return base;
};
Door.bases = key => bases.filter(base => key == null || base.key === key);
// The base of what stands whichever modules run (main.js, the settings window and its ways in, the sidebar's tabs): stopped last.
Door.root = Door.base('plugin', { prefix: 'Logseq Plugin: ' });
Door.sweep = (key, doc) => { for (const base of Door.bases(key)) base.sweep(doc); };

/* THE one way to work Logseq's own boxes (10 November 2026, the code review's "one way to drive Logseq's menus"; it was Threads'
   screen door, with copies in Predictive's steps and the settings' menu): waiting for Logseq to draw something, pressing one of
   its buttons, typing into one of its fields, sending it a key, asking whether one of its pop-ups is open, closing what floats.
   Every made-up press or key the plugin sends Logseq is sent from here (test/screen.js fails on one anywhere else), so a Logseq
   update that renames a menu or changes what it listens for is mended in this one place.
   Checked with Logseq 2.0.2: its lists are .cp__select, its menus and pickers float in .ui__popover-content or a
   [data-radix-popper-content-wrapper], its windows are .ui__modal; its lists while writing ([[ pages, / commands, # tags) are
   #ui__ac, .absolute-modal or [data-editor-popup-ref]. */
const LOGSEQ_POPUPS = '.cp__select, .ui__popover-content, [data-radix-popper-content-wrapper], .ui__modal-panel, .ui__modal, [role="menu"], [role="dialog"], [role="listbox"]';
const LOGSEQ_FRAME = '#right-sidebar, #main-content-container, #left-sidebar, .cp__header', OWN_POPUPS = '.lk-pop, .th-pop';
Door.screen = {
  POPUPS: LOGSEQ_POPUPS,
  // Looks for find() until it gives something or ms pass (null then): every 50 ms, or with frames: true once a frame, for what must
  // be there before the screen is next drawn.
  waitFor: (find, ms = 1500, { frames = false } = {}) => new Promise(resolve => {
    const started = Date.now(), win = frames ? Door.host().defaultView : null;
    const tick = () => { let found = null; try { found = find(); } catch (error) { found = null; } if (found || Date.now() - started > ms) resolve(found || null); else if (win) win.requestAnimationFrame(tick); else setTimeout(tick, 50); };
    if (win) win.requestAnimationFrame(tick); else tick();
  }),
  // Presses an element as the mouse does: Logseq opens its lists on the press, not on a click alone (found in the app). at: where
  // the pointer is, and anything else the events should say, for a press played again where one was held back.
  press(el, at = {}) {
    const win = el.ownerDocument.defaultView;
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, view: win, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true, ...at }));
  },
  // A plain click on one of Logseq's own buttons (its × on a sidebar item, a notice's close), where a click alone is what it takes.
  click: el => { el?.click(); return !!el; },
  // Types words into one of Logseq's boxes as typing would (its boxes listen for input); selects them when asked, so the
  // next key typed replaces them.
  // inputType: said with the input, where Logseq's editor should take the words as a replacement.
  typeInto(box, words, { select = false, inputType = '' } = {}) {
    const win = box.ownerDocument.defaultView, proto = box.matches('textarea') ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (set) set.call(box, words); else box.value = words;
    if (inputType) Door.screen.typed(box, inputType); else box.dispatchEvent(new win.Event('input', { bubbles: true }));
    if (select) box.select?.();
  },
  // Puts words into a box Logseq is editing, over what stands from start to end, as typing would, so Logseq keeps them with the
  // rest and its own Undo holds them: the browser's own insert first, and where that does nothing, the words set and Logseq told.
  insert(box, words, start = 0, end = box.value.length) {
    box.focus(); box.setSelectionRange(start, end);
    let typed = false;
    try { typed = box.ownerDocument.execCommand('insertText', false, words); } catch (error) { typed = false; }
    if (typed && box.value.slice(start, start + words.length) === words) return;
    box.setRangeText(words, start, end, 'end');
    Door.screen.typed(box, 'insertText', words);
  },
  // Tells Logseq a box's words were changed by the plugin (a link put in, a name's capitals), as typing would: Logseq saves a
  // bullet on the input it hears. inputType and data as the browser names them.
  typed: (box, inputType = 'insertText', data) => box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', data === undefined ? { bubbles: true, inputType } : { bubbles: true, inputType, data })),
  // Hands a box what a paste would (files, words): Logseq takes it as its own paste.
  paste: (box, clipboardData) => box.dispatchEvent(new box.ownerDocument.defaultView.ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })),
  // A key to an element (Escape to a menu, Enter to a row).
  key: (el, name, init = {}) => !!el?.dispatchEvent(new el.ownerDocument.defaultView.KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init })),
  // What floats over the page: not the sidebars, the main view or the header; the plugin's own pop-ups only when asked (own: true).
  floating: (el, { own = false } = {}) => el.getClientRects().length > 0 && !el.closest(own ? LOGSEQ_FRAME : `${LOGSEQ_FRAME}, ${OWN_POPUPS}`),
  // A floating item (a menu row, an option, a button) whose words pass test(text); null when none.
  item(test, doc = Door.host()) {
    return [...doc.querySelectorAll('[role="menuitem"], [role="option"], [role="menuitemcheckbox"], .menu-link, .cp__select-main .menu-link, button, li, a')].filter(el => Door.screen.floating(el)).find(el => test(el.textContent.trim())) || null;
  },
  // The items of the right sidebar whose header names a page (Logseq's .sidebar-item with its .sidebar-item-header).
  sidebarItems(title, doc = Door.host()) {
    const named = text => text.replace(/^[#\s]+/, '').trim().toLowerCase();
    return [...doc.querySelectorAll('#right-sidebar .sidebar-item')].filter(item => named(item.querySelector('.sidebar-item-header')?.textContent || '').startsWith(String(title).toLowerCase()));
  },
  // Is something floating open (a list, a menu, a picker, a window)? With an element: does it sit in one? own: the plugin's count too.
  popupOpen(el, doc = Door.host(), options) {
    if (el) return !!el.closest?.(LOGSEQ_POPUPS);
    return [...doc.querySelectorAll(LOGSEQ_POPUPS)].some(node => Door.screen.floating(node, options));
  },
  // Logseq's own lists while writing ([[ pages, / commands, # tags): they have the keys.
  editorPopupOpen: (doc = Door.host()) => !!doc.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]'),
  // Closes what floats: Escape to each open menu and to whatever has the keyboard.
  escapeMenus(doc = Door.host()) {
    for (const menu of [...doc.querySelectorAll('[role="menu"], [role="dialog"], .cp__select')].filter(el => Door.screen.floating(el))) Door.screen.key(menu, 'Escape');
    Door.screen.key(doc.activeElement, 'Escape');
  },
};

/* The small things every module needs to read the graph, once (10 November 2026; each module had copied them): bare(ident) an
   ident without its leading colon; pick(node, name) an attribute of a pulled map whatever its key's spelling (:block/title,
   block/title, title); idOf(value) a node's number, from the number or the map; listOf(value) always a list; query(q) the rows
   of a query, [] when it gives none; isEntityId(id); idsIn and uuidsIn write a list into a query, letting in only whole numbers
   and well-formed ids; HELPER, where Predictive's helper for Apple's tools answers on this Mac. The id pattern is Door.UUID. */
Door.bare = value => String(value ?? '').replace(/^:/, '');
Door.pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
Door.idOf = value => typeof value === 'number' ? value : Door.pick(value, 'db/id');
Door.listOf = value => value == null ? [] : Array.isArray(value) ? value : [value];
Door.query = async query => { const rows = await logseq.DB.datascriptQuery(query); return Array.isArray(rows) ? rows : []; };
Door.isEntityId = id => Number.isSafeInteger(id) && id > 0;
Door.idsIn = (variable, ids) => `[(identity [${[...new Set(ids)].filter(Door.isEntityId).join(' ')}]) [${variable} ...]]`;
Door.uuidsIn = (variable, uuids) => `[(identity [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
Door.HELPER = 'http://127.0.0.1:47615';
/* The one way to ask the helper (12 November 2026, the library review: six files each sent to it by lines of their own).
     can()                          whether this window can ask at all (a test's stand-in may have no fetch);
     status(wait)                   what the helper says of itself ({ ready, meaning, names, cloud, version, reason }); it throws
                                    when the helper does not answer within wait ms (0.8 s unless given);
     post(path, body, { wait, signal })   an answer to a question ("/fill", "/meaning", "/names", "/reads-back"), body an object
                                    or words already made; it throws on no answer within wait ms (4 s unless given) or when
                                    signal stops it. What an answer means, and how long each part waits, stays the part's. */
const helperSignal = (wait, signal) => signal ? AbortSignal.any([signal, AbortSignal.timeout(wait)]) : AbortSignal.timeout(wait);
Door.helper = {
  can: () => typeof fetch === 'function' && typeof AbortSignal?.timeout === 'function',
  status: (wait = 800) => fetch(Door.HELPER + '/status', { signal: AbortSignal.timeout(wait) }).then(reply => reply.json()),
  post: (path, body, { wait = 4000, signal = null } = {}) => fetch(Door.HELPER + path, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body), signal: helperSignal(wait, signal) }).then(reply => reply.json()),
};

/* Words onto the clipboard, once for every module (12 November 2026; DB Export had its own and Predictive's report window copied
   nothing): text, and html beside it when given. Logseq's own window first, since the plugin's frame never has the keyboard and
   the browser refuses a copy from a window without it ("Document is not focused"); then the frame. The clipboard API, then the
   copy event, then plain words. true when one of them took. */
Door.copy = async ({ text, html } = {}) => {
  let hostWin = null;
  try { hostWin = window.parent?.document?.defaultView || null; } catch (error) { hostWin = null; }
  const wins = [hostWin, window].filter((win, i, all) => win && all.indexOf(win) === i);
  for (const win of wins) {
    try {
      const parts = { 'text/plain': new win.Blob([text], { type: 'text/plain' }) };
      if (html) parts['text/html'] = new win.Blob([html], { type: 'text/html' });
      await win.navigator.clipboard.write([new win.ClipboardItem(parts)]);
      return true;
    } catch (error) { /* the next way */ }
  }
  for (const win of wins) {
    const doc = win.document;
    let done = false;
    const onCopy = event => { if (html) event.clipboardData.setData('text/html', html); event.clipboardData.setData('text/plain', text); event.preventDefault(); done = true; };
    doc.addEventListener('copy', onCopy, true);
    try { doc.execCommand('copy'); } catch (error) { /* the next way */ } finally { doc.removeEventListener('copy', onCopy, true); }
    if (done) return true;
  }
  for (const win of wins) { try { await win.navigator.clipboard.writeText(text); return true; } catch (error) { /* give up */ } }
  return false;
};

/* A web address in words a module draws (a Threads line, a Find result): bare ("https://nih.gov/x") or as Markdown
   ("[the trial](https://…)"). webParts cuts words into plain stretches ({ text }) and web addresses ({ text, url }); urlHtml
   draws one as lk-url, a span (it may stand inside a node's own link) whose press main.js sends to the browser, from one place
   for every module. A full stop or a bracket after a bare address is the sentence's, not the address's. */
const WEB_ADDRESS = /\[([^\[\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'"…])/g;
Door.webParts = text => {
  const parts = [], words = String(text ?? '');
  let at = 0;
  for (const m of words.matchAll(WEB_ADDRESS)) {
    if (m.index > at) parts.push({ text: words.slice(at, m.index) });
    parts.push({ text: m[1] ?? m[3], url: m[2] ?? m[3] });
    at = m.index + m[0].length;
  }
  if (at < words.length || !parts.length) parts.push({ text: words.slice(at) });
  return parts;
};
Door.urlHtml = (url, inner) => `<span class="lk-url" data-open-url="${Door.esc(url)}" title="${Door.esc(url)}">${inner}</span>`;

/* THE dates of the plugin (10 November 2026, the code review's "one date service"; Predictive and Threads each named a journal's
   title, and Find, Threads, Structure and Look each put a day in words by a rule of their own). A day is its number, 20261023.
     MONTHS, WEEKDAYS        the names in full, the first letter large; a module that reads typed words takes them from here;
     number(date), date(day), today()   between a day's number and a Date;
     words(day, { year })    a day in words, one rule everywhere: "Oct 23", and "Oct 23, 2025" when it is not this year's
                             (year: false never says the year, where the place already does; 'always' says it every time);
     month(key)              a month (202610) the same way: "Oct", "Oct 2025";
     title(date, format)     a day as Logseq titles its journal page in a date format (MMM do, yyyy; E, dd.MM.yyyy; yyyyMMdd ...);
     format()                the format the open graph names new journal days in (Settings, Editor), read again when a second
                             old, so a change there shows with nothing to reload;
     titleFor(day, ask)      the title of a day's journal page: the page's own when the graph has it, else as it will be named;
     page(day, ask)          the journal page of a day: { id, made }, made by Logseq's own journal call when the graph has none
                             yet (made: its uuid, for an Undo that takes it back; null when it was there);
     pageFor(day, ask)       the same, its number in the graph alone;
     forget()                another graph opened: its format is read afresh. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const dateFormat = { value: '', at: 0, asking: null };
Door.dates = {
  MONTHS, WEEKDAYS,
  number: date => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate(),
  date: day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100),
  today: () => Door.dates.number(new Date()),
  words(day, { year = true } = {}) {
    if (!day) return '';
    const y = Math.floor(day / 10000), text = `${MONTHS[Math.floor(day / 100) % 100 - 1].slice(0, 3)} ${day % 100}`;
    return !year || (year !== 'always' && y === new Date().getFullYear()) ? text : `${text}, ${y}`;
  },
  month(key) { const y = Math.floor(key / 100); return MONTHS[key % 100 - 1].slice(0, 3) + (y === new Date().getFullYear() ? '' : ' ' + y); },
  title(date, format = 'MMM do, yyyy') {
    const pad = n => String(n).padStart(2, '0');
    const parts = {
      yyyy: date.getFullYear(), yy: pad(date.getFullYear() % 100),
      MMMM: MONTHS[date.getMonth()], MMM: MONTHS[date.getMonth()].slice(0, 3), MM: pad(date.getMonth() + 1), M: date.getMonth() + 1,
      do: ordinal(date.getDate()), dd: pad(date.getDate()), d: date.getDate(),
      EEEE: WEEKDAYS[date.getDay()], EEE: WEEKDAYS[date.getDay()].slice(0, 3), E: WEEKDAYS[date.getDay()].slice(0, 3),
    };
    return String(format || 'MMM do, yyyy').replace(/yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|E/g, token => parts[token]);
  },
  format() {
    if (Date.now() - dateFormat.at < 1000) return Promise.resolve(dateFormat.value);
    dateFormat.asking ||= Promise.resolve().then(() => logseq.App.getUserConfigs()).then(configs => configs?.preferredDateFormat || '', () => dateFormat.value)
      .then(value => { dateFormat.value = value; dateFormat.at = Date.now(); dateFormat.asking = null; return value; });
    return dateFormat.asking;
  },
  forget() { dateFormat.at = 0; dateFormat.value = ''; },
  async titleFor(day, ask = Door.query) {
    try {
      const [[title] = []] = await ask(`[:find ?t :where [?p :block/journal-day ${Number(day)}] [?p :block/title ?t]]`) || [];
      if (title) return String(title);
    } catch (error) { /* no such journal yet: as it will be named */ }
    return Door.dates.title(Door.dates.date(day), await Door.dates.format() || 'MMM do, yyyy');
  },
  async page(day, ask = Door.query) {
    const look = async () => { const [[page] = []] = await ask(`[:find (pull ?p [:db/id]) :where [?p :block/journal-day ${Number(day)}]]`) || []; return page ? Door.idOf(page) : null; };
    const found = await look();
    if (found) return { id: found, made: null };
    // Logseq's own journal call: it names the page in the graph's format and marks it a journal day itself (10 November 2026).
    const made = await Door.write.createJournalPage(Door.dates.date(day));
    return { id: made?.id ?? await look(), made: made?.uuid ? String(made.uuid) : null };
  },
  async pageFor(day, ask = Door.query) { return (await Door.dates.page(day, ask)).id; },
};
/* What opens rolls out (the grammar), as Threads' section does: the room it takes grows from nothing in 180 ms while it fades
   in, so what is below glides down instead of jumping; closing rolls it back up before it goes. One motion for every module,
   none under reduced motion. unroll(elements) after they are drawn; rollUp(elements) resolves when they are gone from view,
   to draw without them then; regrow(element, height it had) where one thing grew or shrank in place. */
const MOTION_MS = 180;
const still = el => { const win = el?.ownerDocument?.defaultView; return !win || !el.animate || !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches; };
// A row may hold a minimum height and padding (a grid row, a line): they go to nothing with the height, or it cannot shrink.
const shut = el => ({ height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 });
const full = el => { const cs = el.ownerDocument.defaultView.getComputedStyle(el); return { height: el.getBoundingClientRect().height + 'px', minHeight: cs.minHeight, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, opacity: 1 }; };
const clipWhile = (el, animation) => { const was = el.style.overflow; el.style.overflow = 'hidden'; const end = () => { el.style.overflow = was; }; animation.onfinish = end; animation.oncancel = end; return animation; };
Door.unroll = (elements, ms = MOTION_MS) => {
  for (const el of [].concat(elements || [])) {
    if (!el?.isConnected || still(el)) continue;
    if (el.getBoundingClientRect().height > 0) clipWhile(el, el.animate([shut(el), full(el)], { duration: ms, easing: 'ease-out' }));
  }
};
// It holds its end until it resolves, then lets go: the caller draws without the elements (or hides them) in the same step.
Door.rollUp = (elements, ms = 140) => {
  const running = [].concat(elements || []).filter(el => el?.isConnected && !still(el) && el.getBoundingClientRect().height)
    .map(el => clipWhile(el, el.animate([full(el), shut(el)], { duration: ms, easing: 'ease-in', fill: 'forwards' })));
  return Promise.all(running.map(a => a.finished.catch(() => {}))).then(() => { for (const a of running) a.cancel(); });
};
Door.regrow = (el, from, ms = MOTION_MS) => {
  if (!el?.isConnected || still(el) || from == null) return;
  const to = el.getBoundingClientRect().height;
  if (Math.abs(to - from) < 1) return;
  clipWhile(el, el.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: ms, easing: 'ease-out' }));
};
// The Undo arrow: the grammar's one shape, from Logseq's icon font. Its fade is the shared name lk-undo.
Door.UNDO = '<i class="ti ti-arrow-back-up" aria-hidden="true"></i>';
/* THE Undo of the plugin, one for every module (6 November 2026; until then Threads, Predictive and Structure each kept their own;
   the logic is Threads', at the owner's word "make one pop-up, one Undo and one dialog"; the look the owner chose: "something
   just where text is but very subtle, like a faded icon"). After a change a faded arrow sits at the end of what changed and says what it
   takes back when pointed at; a click takes it back. One arrow stands for a change of one thing and one for a change of many things:
   a new change's arrow takes the place of the last one of its size (the grammar, and `many` below). A change offered again under the same key adds to that arrow: one click takes both back, the later first. When
   nothing of the change is on screen to sit beside, the arrow waits at the bottom right with its words beside it, quiet, until it is
   used, forgotten or cleared. The arrows are put back whenever Logseq draws the place again (the one screen watcher), so a module
   gives at() as a function finding the place afresh.
   undo.offer({ owner, key, at, text, run, onFail, cls, many, docks, node })   owner: the module's key, so it can clear its own when its page is left;
     at(): the element(s) to sit at the end of, or null; run(): the inverse, async; onFail(error): said instead of the plain notice.
     many: a change of many things (Structure's Apply, a pick of several nodes in Threads). It keeps its own Undo (the owner, 9 November
     2026): a change of one thing takes the place of the last change of one thing only, a change of many things that of the last change
     of many things only, so filling in one value never takes a merge's way back. docks: false for an arrow that lives at the end of
     the line saying what was done and nowhere else (Structure's), so it never waits at the bottom right while its line is out of sight.
   undo.forget(key or entry => bool), undo.take(key) (run it as a press would), undo.clear(owner or nothing: every one), undo.has(key),
   undo.keys(), undo.size, undo.draw(), undo.stop(). The arrow is lk-undo with data-lk-undo=key; the dock lk-undo-dock.
   The bottom right is for the page the change was made on (10 November 2026, the audit's 12: an arrow from another page stayed
   there for good and covered the right sidebar's words): an arrow waits there only while that page is open, goes for good once
   the node it changed (node: its uuid, block or page) is gone from the graph, and stands left of the right sidebar, never on it. */
const undoState = { entries: new Map(), unwatch: null, listening: false, drawing: false };
// The page in front, by its route without the graph's query: the place a change was made, and where its arrow may wait.
// A page reached by its name in other capitals is the same page.
const routeNow = () => { try { const at = String(Door.host().defaultView.location.hash || '').split('?')[0]; try { return decodeURIComponent(at).toLowerCase(); } catch (error) { return at.toLowerCase(); } } catch (error) { return ''; } };
// Whether the node a waiting arrow changed is still in the graph (not deleted, not in the Recycle, nor on a page that is), asked at
// most once a second per arrow, again a second later while it waits; a node gone forgets the arrow. A look-up that fails says nothing.
async function undoNodeGone(key, entry) {
  if (!entry.node || entry.asking) return;
  const wait = 1000 - (Date.now() - (entry.asked || 0));
  if (wait > 0) { if (!entry.again) entry.again = setTimeout(() => { entry.again = null; if (undoState.entries.get(key) === entry) drawUndoArrows(); }, wait + 20); return; }
  entry.asking = true;
  try {
    const uuid = String(entry.node);
    if (!UUID.test(uuid)) return;
    const live = await dsAsk(`[:find ?b :where [?b :block/uuid #uuid "${uuid}"] (not [?b :logseq.property/deleted-at _]) (not [?b :block/page ?p] [?p :logseq.property/deleted-at _])]`);
    if (Array.isArray(live) && !live.length && undoState.entries.get(key) === entry) Door.undo.forget(key);
  } catch (error) { /* not known: the arrow waits */
  } finally { entry.asking = false; entry.asked = Date.now(); }
}
// The dock's right edge: clear of the right sidebar while it is open.
function seatDock(doc, dock) {
  const side = doc.getElementById('right-sidebar'), open = side && !side.classList.contains('closed') ? side.getBoundingClientRect().width : 0;
  const right = `${Math.round(open) + 20}px`;
  if (dock.style.right !== right) dock.style.right = right;
}
const undoAttr = text => String(text).replace(/["\\]/g, '\\$&');
const undoTargets = entry => { try { const at = entry.at?.(); return (Array.isArray(at) ? at : at ? [at] : []).filter(el => el?.isConnected); } catch (error) { return []; } };
function undoArrow(doc, key, entry, docked) {
  const arrow = doc.createElement('span');
  arrow.className = `lk-undo${entry.cls ? ' ' + entry.cls : ''}${docked ? ' lk-undo-docked' : ''}`;
  arrow.dataset.lkUndo = key;
  arrow.setAttribute('role', 'button');
  arrow.setAttribute('contenteditable', 'false');
  arrow.setAttribute('aria-label', `Undo: ${entry.text}`);
  arrow.title = `Undo: ${entry.text}`;
  arrow.innerHTML = Door.UNDO + (docked ? '<span class="lk-undo-words"></span>' : '');
  if (docked) arrow.querySelector('.lk-undo-words').textContent = entry.text;
  return arrow;
}
const mayWait = entry => entry.docks !== false && entry.route === routeNow();
function drawUndoArrows() {
  const doc = Door.host();
  if (undoState.drawing) return;
  undoState.drawing = true;
  try {
    const { entries } = undoState;
    for (const arrow of doc.querySelectorAll('.lk-undo[data-lk-undo]')) {
      const entry = entries.get(arrow.dataset.lkUndo);
      if (!entry) { arrow.remove(); continue; }
      const targets = undoTargets(entry);
      if (arrow.classList.contains('lk-undo-docked') ? targets.length || !mayWait(entry) : !targets.includes(arrow.parentElement)) arrow.remove();
    }
    let dock = doc.querySelector('.lk-undo-dock');
    for (const [key, entry] of entries) {
      const targets = undoTargets(entry);
      for (const target of targets) if (![...target.children].some(child => child.dataset?.lkUndo === key)) target.appendChild(undoArrow(doc, key, entry, false));
      if (!targets.length && mayWait(entry)) {
        undoNodeGone(key, entry);
        if (doc.querySelector(`.lk-undo-dock [data-lk-undo="${undoAttr(key)}"]`)) continue;
        if (!dock) { dock = doc.createElement('div'); dock.className = 'lk-undo-dock'; doc.body.appendChild(dock); }
        dock.appendChild(undoArrow(doc, key, entry, true));
      }
    }
    if (dock && !dock.children.length) dock.remove();
    else if (dock) seatDock(doc, dock);
  } finally { undoState.drawing = false; }
}
function takeUndo(key) {
  const entry = undoState.entries.get(key);
  undoState.entries.delete(key);
  drawUndoArrows();
  watchUndos();
  if (entry) return Promise.resolve().then(entry.run).catch(error => { if (entry.onFail) entry.onFail(error); else Door.notify('The change could not be undone', 'warning'); });
}
// A press on an arrow is the plugin's (inside a bullet Logseq would start editing it); the click takes the change back.
function onUndoArrow(event) {
  const arrow = event.target?.closest?.('.lk-undo[data-lk-undo]');
  if (!arrow) return;
  event.stopImmediatePropagation();
  if (event.type !== 'pointerdown') event.preventDefault();
  if (event.type === 'click') takeUndo(arrow.dataset.lkUndo);
}
// The arrows are put back whenever Logseq draws the place again; the pass runs only while there is an arrow.
function watchUndos() {
  const win = Door.host().defaultView, on = undoState.entries.size > 0;
  if (on && !undoState.unwatch) undoState.unwatch = Door.watch(function undoArrows() { drawUndoArrows(); });
  else if (!on && undoState.unwatch) { undoState.unwatch(); undoState.unwatch = null; }
  if (on && !undoState.listening) { for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) win.addEventListener(type, onUndoArrow, true); undoState.listening = true; }
  else if (!on && undoState.listening) { for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) win.removeEventListener(type, onUndoArrow, true); undoState.listening = false; }
}
Door.undo = {
  offer({ owner = '', key, at, text, run, onFail, cls, many = false, docks = true, node = null }) {
    const before = undoState.entries.get(key);
    for (const [other, entry] of [...undoState.entries]) if (other !== key && !!entry.many === !!many) undoState.entries.delete(other);   // a new change's arrow takes the place of the last one of its size
    const all = before ? async () => { let failed = null; try { await run(); } catch (error) { failed = error; } await before.run(); if (failed) throw failed; } : run;
    undoState.entries.set(key, { owner, at, text: before ? `${text} · ${before.text}` : text, run: all, onFail: onFail || before?.onFail, cls, many: !!many, docks, node: node || before?.node || null, route: before?.route || routeNow() });
    for (const arrow of Door.host().querySelectorAll(`[data-lk-undo="${undoAttr(key)}"]`)) arrow.remove();   // drawn again, so an arrow with the old words is replaced
    watchUndos();
    drawUndoArrows();
  },
  forget(which) {
    let gone = false;
    for (const [key, entry] of undoState.entries) if (typeof which === 'function' ? which({ key, ...entry }) : key === which) { undoState.entries.delete(key); gone = true; }
    if (gone) { drawUndoArrows(); watchUndos(); }
  },
  take: key => takeUndo(key),
  clear(owner) {
    if (!undoState.entries.size) return;
    if (owner == null) undoState.entries.clear(); else for (const [key, entry] of undoState.entries) if (entry.owner === owner) undoState.entries.delete(key);
    drawUndoArrows(); watchUndos();
  },
  draw: () => drawUndoArrows(),
  get size() { return undoState.entries.size; },
  has: key => undoState.entries.has(key),
  keys: () => [...undoState.entries.keys()],
  stop() { undoState.entries.clear(); try { drawUndoArrows(); watchUndos(); Door.host().querySelector('.lk-undo-dock')?.remove(); } catch (error) { /* Logseq's window is gone */ } },
};
/* The press's icons: one even line, the most literal drawing of what the press does, and anything that moves is an arrow. None
   is a ring, a wave or three dots, so none can be taken for a sort's mark. A press takes one by the shared name lk-i-<name>. */
Door.ICONS = {
  go: 'M2.5 8h11M9.5 4l4 4-4 4', up: 'M8 13.5v-11M4 6.5l4-4 4 4', move: 'M3 2.5V8a2 2 0 0 0 2 2h8.5M10 6.5l3.5 3.5-3.5 3.5',
  child: 'M3 2.5V6a2 2 0 0 0 2 2h2M11 4.5v7M7.5 8h7', merge: 'M3 2.5 8 8l5-5.5M8 8v5.5M5 10.5l3 3 3-3', split: 'M2.5 8h4l6-4.5M6.5 8l6 4.5M9.5 3.5h3v3M9.5 12.5h3v-3',
  plus: 'M8 2.5v11M2.5 8h11', chevron: 'M4 6l4 4 4-4', minus: 'M2.5 8h11', bin: 'M2.5 4.5h11M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M4 4.5l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-9',
  rename: 'M10.4 2.9 13.1 5.6 5.4 13.3l-3 .3.3-3zM8.8 4.5l2.7 2.7',
  copy: 'M6.4 5.2h6.4A1.2 1.2 0 0 1 14 6.4v6.4a1.2 1.2 0 0 1-1.200 1.200H6.400a1.200 1.200 0 0 1-1.200-1.200V6.400a1.200 1.200 0 0 1 1.200-1.200zM11 2.400H3.600a1.200 1.200 0 0 0-1.200 1.200V11',
  tag: 'M2.5 2.5h5.300l5.700 5.700-5.300 5.300-5.700-5.700zM5.300 5.300h.01', eq: 'M3 5.800h10M3 10.200h10', side: 'M3 3h10a1.200 1.200 0 0 1 1.200 1.200v7.600A1.200 1.200 0 0 1 13 13H3a1.200 1.200 0 0 1-1.200-1.200V4.200A1.200 1.200 0 0 1 3 3zM10 3v10',
  tick: 'M2.800 8.600 6.400 12l6.800-7.800', x: 'm3.800 3.800 8.400 8.400M12.200 3.800l-8.400 8.400', save: 'M8 2.500v8M4.500 7 8 10.500 11.500 7M3 13.500h10',
  undo: 'M6 9.500 3 6.500l3-3M3 6.500h7.500a3 3 0 0 1 0 6H9', reload: 'M13 8a5 5 0 1 1-1.500-3.500M13 2v3.500H9.500', enter: 'M13 3.500V7.800a2 2 0 0 1-2 2H3.500M6.800 6.500 3.500 9.800l3.300 3.300',
};
const iconUrl = d => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`)}")`;

/* The text colour and the window's ground, for every module whichever are switched on, sent by main.js and by every stand-in that
   draws with the shared names. Logseq 2.0.2 sets neither --ls-primary-* any more, though a theme may; its own are --foreground
   and --background, which follow light and dark. */
Door.THEME = ':root { --lk-text: var(--ls-primary-text-color, hsl(var(--foreground))); --lk-paper: var(--ls-primary-background-color, hsl(var(--background))); }';
// The greys, mixed from Logseq's text colour so they follow any theme: quiet, faint, a hairline and a firmer line; and the
// underline of a link to a node, half a pixel (one dot of a sharp screen), so a stronger grey than the line to be seen
// (at 16% it read as none, the owner 3 Nov 2026).
const TOKENS = `
:root { --lk-quiet: color-mix(in srgb, var(--lk-text, currentColor) 70%, transparent); --lk-off: color-mix(in srgb, var(--lk-text, currentColor) 46%, transparent);
  --lk-hair: color-mix(in srgb, currentColor 12%, transparent); --lk-line: color-mix(in srgb, currentColor 26%, transparent);
  --lk-link: color-mix(in srgb, currentColor 45%, transparent); --lk-link-width: .5px;
  --lk-wash: color-mix(in srgb, currentColor 7%, transparent);
  --lk-mono: var(--ls-font-family-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
  --lk-tag-face: "New York", ui-serif, Georgia, serif; --lk-tag-adjust: none;
  --lk-day: 48px;
  --lk-small: 13px; --lk-label: 12px; }`;
/* The shared names: one per word of the grammar. A module puts these on what it draws and carries no look of its own
   for them; these words are final (hence !important where a module still has a rule). They stand whichever modules run:
   Look's switch takes off what Look draws on Logseq's own page, never what they mean on what the others draw.
   lk-row: a row; lk-fold: its fold arrow, only under the pointer; lk-list: a list that can be picked from; lk-tick: a
   tick box, appearing when the pointer is on the list; lk-node: a node's name (with data-uuid: Look adds its sort mark); lk-url: a web address, ↗ after it;
   lk-tag: a tag; lk-prop: a property's name; lk-day: a day in the margin; lk-count: a number of things, never shown;
   lk-pencil: a pencilled value; lk-undo: the faded arrow.
   The Pressing set (buttons-mockup.html beside the plugins, 30 October 2026), for the controls of a bar or a window:
   lk-name: the small faint name above a value; lk-value: the value, the thing pressed, in the text colour, quiet under
   the pointer, faint when off (.off) or unwritten; lk-pick: a value that unfolds, a hairline standing before it (its
   chevron is the module's markup, coloured faint here); lk-alts: what a value can become, faint words with the
   one in force (.on) in the text colour; lk-accent: the one action, its key faint; lk-close: the ×.
   The module lays them out (a name over a value, the gaps); these give only their colours and weights.
   The button library (button-library.html in the workspace), one kind per job, each drawn whole here, so a module adds
   nothing of its own to how it looks, only where it stands. A press is a word with a line icon (lk-i-<name>, from Door.ICONS)
   on the round wash, at rest too; firmer under the pointer. lk-strip: a row of actions; lk-bar: what you can do with what
   you ticked, lk-said holding how many; lk-btn: a word in either, or among lk-answers, the answers under a question;
   lk-enter: the return sign, on the one press plain Enter takes;
   lk-accent: the main button, the one thing a screen is for; lk-big: the yes to a change Undo cannot put back whole, the one
   button with a colour and a fill, Logseq's own blue, a shade deeper so its white words read in both themes; lk-hint: words beside them saying what a key does now, never
   pressed; lk-lone: an action with nothing beside it; lk-add: "+ Add property"; lk-fix: what to do about a row, at its
   right end; lk-x: takes one thing off a row; lk-plus: adds to a row's group; lk-change (with lk-i-chevron): changes a value that holds one thing (these three
   only darken under the pointer, no ground behind them); lk-reveal on any of them, with lk-reveals on what it acts on: shown
   only while that is pointed at, light grey, darker near it, kept while the hand wavers; lk-more: show all; lk-views with lk-view
   (.on): other contents of one place; lk-trail with lk-step: the places you came through; lk-head (.on): a sort head;
   lk-menu with lk-item (.off, .gap, a faint lk-note) and lk-group, the heading of a part of it: a menu.
   Drawn whole here since 6 November 2026, so no module draws them again: lk-window (a window mid-screen) and lk-pop (a pop-up at
   the thing pressed), the frames; lk-tick, the tick box; lk-fold, the fold arrow, its markup empty; lk-bul (.folded, .opens), Logseq's bullet;
   lk-field, a field on a hairline; lk-none, the nothing-here line; lk-undo, the arrow as a press; --lk-day, the day column's width. */
/* The looks more than one stylesheet writes, each once (12 November 2026, the library review: a tag's look and a web address's
   stood here and again in Look, and both had to change for the quiet grey; a link's faint underline stood in ten places with
   three distances under the words). Look puts them on Logseq's own links and tags, the door on what the modules draw.
     link(firm)   a link's line: the faint underline, 3px under the words; firm (unless false) holds against Logseq's own rule;
     out          the ↗ after a web address, in the quiet grey, outside the underline;
     tag(firm)    a tag's name: the Mac's serif, upright, the quiet grey, the words' own size. */
Door.LOOKS = {
  link: (firm = true) => { const i = firm ? ' !important' : ''; return `text-decoration: underline${i}; text-decoration-color: var(--lk-link)${i}; text-decoration-thickness: var(--lk-link-width)${i}; text-underline-offset: 3px;`; },
  out: 'content: "\\2197"; display: inline-block; margin-left: .2em; color: var(--lk-quiet); text-decoration: none;',
  tag: (firm = true) => { const i = firm ? ' !important' : ''; return `color: var(--lk-quiet) !important; font-family: var(--lk-tag-face)${i}; font-style: normal${i}; font-size: inherit${i}; font-size-adjust: var(--lk-tag-adjust); text-decoration: none !important;`; },
};
Door.NAMES = `${TOKENS}
/* A tag: its name in the Mac's serif, upright (New York, --lk-tag-face), in the quiet grey, the words' own size (the owner,
   8 November 2026: "no reason why tags should be fainter ... or why there is an odd size discrepancy"; 10 November 2026: the
   mono read too close to the words, a box would distract; 11 November 2026: not italic, and in the quiet grey, "do new york quiet grey"; the text colour under the pointer). Its line height is the words', so a tag never makes its row taller. */
.lk-tag { ${Door.LOOKS.tag()} line-height: 1; }
.lk-tag:hover { color: var(--lk-text, currentColor) !important; }
.lk-node { color: inherit; ${Door.LOOKS.link()} cursor: pointer; }
.lk-node:hover { text-decoration-color: currentColor !important; }
/* A web address is a link like a node's name with a ↗ after it in the quiet grey, saying it leaves Logseq (the owner, 11 November
   2026: a right-up arrow, then "put it at end of link"); Look gives Logseq's own web links the same. */
.lk-url { color: inherit; overflow-wrap: anywhere; ${Door.LOOKS.link()} cursor: pointer; }
.lk-url:hover { text-decoration-color: currentColor !important; }
.lk-url::after { ${Door.LOOKS.out} }
.lk-prop { color: var(--lk-quiet); }
.lk-day { color: var(--lk-quiet) !important; font-size: var(--lk-small) !important; font-variant-numeric: tabular-nums; }
.lk-count { display: none !important; }
/* A pencilled value, a proposal: in mono, grey, a dotted line under it; a pencilled tag too, so a proposal never reads as a
   written tag (the owner, 10 November 2026: "I want proposed to be mono"). */
.lk-pencil { font-family: var(--lk-mono) !important; font-style: normal !important; font-size-adjust: 0.51; color: var(--lk-quiet) !important; text-decoration: underline dotted !important; text-decoration-color: var(--lk-line) !important; text-underline-offset: 3px; background: none !important; }
/* A pencilled tag fades once: the pencil's grey, not the tag's own fade on top of it. */
.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; font-family: var(--lk-mono) !important; font-style: normal !important; font-size-adjust: 0.51; }
.lk-undo { opacity: .28 !important; transition: opacity .15s; }
.lk-undo:hover, .lk-undo:focus-visible { opacity: .85 !important; }
.lk-row .lk-fold { opacity: 0 !important; transition: opacity .12s; }
.lk-row:hover .lk-fold, .lk-row.on .lk-fold, .lk-fold[aria-expanded="true"], .lk-fold:focus-visible { opacity: .6 !important; }
/* The row the keyboard is on (on), or the pointer: the one wash. */
.lk-row:hover, .lk-row.on { background: var(--lk-wash); }
.lk-row:hover .lk-fold:hover, .lk-fold:hover { opacity: 1 !important; }
.lk-list .lk-tick { opacity: 0 !important; transition: opacity .12s; }
.lk-list:hover .lk-tick, .lk-list:focus-within .lk-tick, .lk-list[data-picking] .lk-tick { opacity: .55 !important; }
.lk-list .lk-tick:checked, .lk-list .lk-tick:hover { opacity: 1 !important; }
.lk-name { font-size: var(--lk-label) !important; color: var(--lk-quiet) !important; letter-spacing: .02em; font-weight: 400 !important; }
.lk-value:not(input) { color: inherit !important; cursor: pointer; }
.lk-value:not(input):hover { color: var(--lk-quiet) !important; }
.lk-value.off, input.lk-value::placeholder { color: var(--lk-off) !important; }
/* The Pressing set's field: a value typed in a bar, faint and reading its own name until written, a hairline under it only while it has the keyboard. */
input.lk-value { cursor: text; border: 0; border-bottom: 1px solid transparent; border-radius: 0; padding: 0 0 1px; background: none; color: inherit; font: inherit; outline: none; box-shadow: none; }
input.lk-value:focus { border-bottom-color: currentColor; outline: none; box-shadow: none; }
.lk-pick:not(:first-child) { border-left: 1px solid var(--lk-hair); }
.lk-pick .lk-value svg { color: var(--lk-quiet); }
/* The faint goes on each alternative, not on the line, so the one in force can take the text colour back. */
.lk-alts { color: inherit !important; }
.lk-alts > * { color: var(--lk-quiet) !important; }
.lk-alts > *:hover, .lk-alts > .on { color: inherit !important; }
.lk-accent { color: inherit !important; }
.lk-accent kbd { font-weight: 400 !important; color: var(--lk-quiet) !important; }
.lk-close { color: var(--lk-quiet) !important; }
.lk-close:hover, .lk-close:focus-visible { color: inherit !important; }
.lk-btn, .lk-accent, .lk-lone, .lk-add, .lk-fix, .lk-x, .lk-plus, .lk-change, .lk-more, .lk-view, .lk-step, .lk-head, .lk-item { appearance: none; background: none; border: 0; font: inherit; cursor: pointer; border-radius: 4px; }
.lk-btn, .lk-accent, .lk-lone, .lk-add, .lk-fix { border-radius: 1em; }
.lk-strip, .lk-bar, .lk-answers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.lk-answers { flex-basis: 100%; margin-top: 4px; }
.lk-btn { color: var(--lk-text, currentColor) !important; padding: 2px 6px; margin: 0 -6px; white-space: nowrap; }
.lk-said { font-weight: 500; padding-right: 6px; color: var(--lk-text, currentColor); }
.lk-hint { color: var(--lk-quiet) !important; font-size: var(--lk-small); margin-left: auto; padding-left: 12px; white-space: nowrap; }
.lk-accent { cursor: pointer; border-radius: 1em; color: var(--lk-text, currentColor) !important; white-space: nowrap; }
.lk-answers > .lk-accent { padding: 2px 6px; margin: 0 -6px; }
.lk-big { appearance: none; border: 0; font: inherit; font-weight: 600; cursor: pointer; border-radius: 1em; padding: 3px 12px; margin-right: 8px; white-space: nowrap; background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 80%, #000); color: #fff !important; }
.lk-big:hover, .lk-big:focus-visible { background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 68%, #000); outline: none; }
.lk-lone { color: var(--lk-text, currentColor) !important; padding: 3px 6px; margin-left: -6px; white-space: nowrap; }
.lk-fix { color: var(--lk-text, currentColor) !important; padding: 2px 6px; white-space: nowrap; }
.lk-add, .lk-more { color: var(--lk-quiet) !important; padding: 3px 0; }
.lk-more { text-decoration: underline !important; text-decoration-color: var(--lk-line) !important; text-underline-offset: 3px; }   /* it opens, so it reads as what opens */
.lk-add:hover, .lk-more:hover, .lk-add:focus-visible, .lk-more:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-x, .lk-plus, .lk-change { color: var(--lk-quiet) !important; padding: 0 4px; }
.lk-x:hover, .lk-plus:hover, .lk-change:hover, .lk-x:focus-visible, .lk-plus:focus-visible, .lk-change:focus-visible { color: var(--lk-text, currentColor) !important; background: var(--lk-wash); }
/* Their mark alone (lk-i-plus, lk-i-chevron), no word after it. The faint grey sits close to the text colour, so the round wash is what
   shows the pointer has it, as on a level-3 button; a press that shows only near its holder (lk-reveal) takes it too, on the press itself. */
.lk-change::before, .lk-plus::before { margin-right: 0 !important; }
/* The + is the size of the chevron beside it (the owner, 7 November 2026: "it should be size of chevron"): its arms span the chevron's width. */
.lk-plus.lk-i-plus, .lk-plus > .lk-i-plus { display: inline-flex; align-items: center; justify-content: center; }   /* the mark centred in its own place; a press holding it (Look's after a value) keeps its own layout, so a press of no width under a bullet does not pull the mark back over the value */
.lk-plus.lk-i-plus { width: 20px; height: 20px; padding: 0 !important; flex: none; }   /* a round place the size of the fold arrow's, so the wash is a small square, not a strip */
.lk-plus.lk-i-plus::before, .lk-plus > .lk-i-plus::before { width: .75em !important; height: .75em !important; vertical-align: middle; }
/* A press that shows only while what it acts on is pointed at (the owner, 4 November 2026: "it disappears when I move the cursor over
   it", "grey, then darker upon closer, more drastic"). It is light grey while its holder is pointed at and the text colour near it; a
   zone round it (::after) catches the pointer, so moving onto it never loses it; it fades only after a moment. Hidden, it takes no
   pointer, so it never stands in the way of what is under it. The module says where it stands and how big its zone is. */
.lk-reveal { position: relative; opacity: 0; pointer-events: none; transition: opacity .12s ease .35s, color .1s ease; color: color-mix(in srgb, var(--lk-text, currentColor) 30%, transparent) !important; background: none !important; }
.lk-reveal::after { content: ''; position: absolute; inset: -9px -6px; }
.lk-reveals:hover .lk-reveal, .lk-reveal:focus-visible { opacity: 1; pointer-events: auto; transition-delay: 0s, 0s; }
.lk-reveal:is(:hover, :focus-visible) { color: var(--lk-text, currentColor) !important; background: var(--lk-wash) !important; }   /* on the press itself: the round wash too, as on every press */
.lk-reveal:focus-visible { outline: none; }
.lk-btn:hover, .lk-btn:focus-visible, .lk-accent:hover, .lk-accent:focus-visible, .lk-lone:hover, .lk-lone:focus-visible, .lk-fix:hover, .lk-fix:focus-visible, .lk-item:hover, .lk-item:focus-visible { background: var(--lk-wash); }
.lk-btn:focus-visible, .lk-accent:focus-visible, .lk-lone:focus-visible, .lk-fix:focus-visible, .lk-view:focus-visible, .lk-item:focus-visible { outline: none; }
/* Three levels, so a button's weight says how much it matters before it is read (the owner, 1 November: "change the hierarchy of buttons").
   1, lk-accent: the one step that decides, filled in the text colour, one on a screen. Above it only lk-big, what Undo cannot put back.
   2, lk-btn, lk-lone: what you do to the thing in front of you, on the round ground.
   3, lk-low, lk-fix: a way out, or an action repeated down a list: the word alone, the round ground under the pointer. */
.lk-btn, .lk-lone, .lk-fix, .lk-accent { display: inline-flex; align-items: center; gap: .35em; padding: 4px 12px !important; margin: 0 !important; line-height: 1.35; }
.lk-btn, .lk-lone { background: var(--lk-wash) !important; }
.lk-btn:hover, .lk-lone:hover, .lk-btn:focus-visible, .lk-lone:focus-visible { background: color-mix(in srgb, currentColor 13%, transparent) !important; }
.lk-accent { background: var(--lk-text, currentColor) !important; color: var(--lk-paper, var(--ls-primary-background-color, #fff)) !important; font-weight: 600; padding-inline: 16px !important; }
.lk-accent:hover, .lk-accent:focus-visible { background: color-mix(in srgb, var(--lk-text, currentColor) 82%, transparent) !important; }
.lk-accent kbd, .lk-accent .ky { color: inherit !important; opacity: .65; }
.lk-btn.lk-low, .lk-fix { background: none !important; padding: 4px 8px !important; }
/* Delete is red, at whatever level it stands (the owner, 1 November). */
.lk-del, .lk-btn.lk-i-bin, .lk-fix.lk-i-bin, .lk-fix.lk-i-minus, .lk-item.lk-del { color: var(--rx-red-10, #dc3e42) !important; }
.lk-btn.lk-low:hover, .lk-fix:hover, .lk-btn.lk-low:focus-visible, .lk-fix:focus-visible { background: var(--lk-wash) !important; }
.lk-btn.lk-low[aria-pressed="true"] { font-weight: 600; }   /* a third-level press in force (a kind picked, a sort on) */
.lk-row .lk-btn.lk-low { padding-block: 1px !important; }   /* on a row it takes the row's height, so the row never grows for it */
.lk-views { display: flex; gap: 4px; }
/* lk-view: other contents of one place, drawn one way everywhere (the sidebar's tabs, Links, Structure, Linked's kinds): the one in
   force in the text colour with a short bar under its word, the others quiet (the owner, 9 November 2026, C1b: "a short bar under
   the view in force"). No underline, which means "opens"; no ground, no change of weight, so no name shifts when another is picked.
   The bar is the word's width (--lk-view-pad, the press's own side padding, keeps it off the padding) and stands below the letters. */
.lk-view { position: relative; color: var(--lk-quiet) !important; padding: 3px var(--lk-view-pad, 8px) 6px; font-weight: inherit; }
.lk-view:hover, .lk-view:focus-visible { color: var(--lk-text, currentColor) !important; }
.lk-view.on { color: var(--lk-text, currentColor) !important; }
.lk-view.on::after { content: ""; position: absolute; left: var(--lk-view-pad, 8px); right: var(--lk-view-pad, 8px); bottom: 0; height: 2px; border-radius: 1px; background: currentColor; }
.lk-trail { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: center; font-size: var(--lk-small); }
.lk-trail > :not(.lk-step) { color: var(--lk-quiet); }
.lk-step { color: var(--lk-quiet) !important; padding: 0; text-decoration: underline !important; text-decoration-color: var(--lk-hair) !important; text-underline-offset: 3px; }
.lk-step:hover { color: var(--lk-text, currentColor) !important; text-decoration-color: var(--lk-line) !important; }
/* A sort head: the others grey and of the body's weight, the sorted one dark and bold, so it stands out from them. */
.lk-head { color: var(--lk-quiet) !important; text-align: left; font-weight: 400; }
.lk-head:hover, .lk-head.on { color: var(--lk-text, currentColor) !important; }
.lk-head.on { font-weight: 600; }
.lk-menu { border: 1px solid var(--lk-hair); border-radius: 6px; padding: 4px; }
.lk-item { display: flex; justify-content: space-between; gap: 16px; width: 100%; text-align: left; color: var(--lk-text, currentColor) !important; padding: 5px 8px; white-space: nowrap; }
.lk-item.off { color: var(--lk-off) !important; pointer-events: none; }
.lk-item.on { background: var(--lk-wash); }   /* the line the keyboard is on */
/* A press that cannot be taken now: at the off strength, and no hand. */
:is(.lk-btn, .lk-lone, .lk-accent, .lk-fix, .lk-item):disabled { opacity: .45; cursor: default; pointer-events: none; }
.lk-item.gap { height: 8px; padding: 0; pointer-events: none; background: none; }
/* lk-group: the heading of a part of a menu (the owner, 7 November 2026, of the View menu's "Group by" and "Date": "the headers
   need to be more prominent"): the menu's words in the text colour, a step heavier, a hairline over each part after the first,
   so the parts read apart before a word is read; a faint lk-note stays for a word of help. */
.lk-group { padding: 6px 8px 3px; font-size: var(--lk-small); font-weight: 600; color: var(--lk-text, currentColor); cursor: default; }
.lk-item.gap + .lk-group { border-top: 1px solid var(--lk-hair); margin-top: -4px; padding-top: 8px; }
.lk-note { color: var(--lk-quiet); font-size: var(--lk-small); font-variant-numeric: tabular-nums; }
/* lk-picked: what you can do with what you picked, right above the picked rows on the same grey as them, so the picks and what
   acts on them read as one block, the only filled area in a list (the owner, 5 November 2026, the grey block of picking-redesign.html:
   "build 2"). lk-picked-count holds the number (lk-picked-n), lk-picked-x clears the picks, lk-picked-act is an action, a plain word
   with its icon, lk-picked-gap sends Delete (lk-del) to the right end. The module says where it stands. */
.lk-picked { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; background: var(--lk-wash); border-bottom: 1px solid var(--lk-hair); padding: 6px 10px 7px; line-height: 1.35; }
.lk-picked-count { display: inline-flex; align-items: baseline; gap: 6px; color: var(--lk-quiet); font-size: 14px; margin-right: 2px; }
.lk-picked-n { font-size: 20px; font-weight: 600; color: var(--lk-text, currentColor); font-variant-numeric: tabular-nums; line-height: 1; }
.lk-picked-x, .lk-picked-act { appearance: none; background: none; border: 0; font: inherit; cursor: pointer; border-radius: 999px; }
.lk-picked-x { font-size: 16px; line-height: 1; color: var(--lk-quiet); padding: 4px 8px 4px 4px; }
.lk-picked-act { font-weight: 500; color: var(--lk-text, currentColor); display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; }
.lk-picked-act::before { margin-right: 0 !important; }
.lk-picked :is(.lk-picked-act, .lk-picked-x):is(:hover, :focus-visible) { background: color-mix(in srgb, currentColor 9%, transparent); color: var(--lk-text, currentColor); outline: none; }
.lk-picked .lk-picked-act.lk-del { color: var(--rx-red-10, #dc3e42) !important; }
.lk-picked-gap { flex: 1; }
/* The pieces every module used to draw for itself, each drawn once here (6 November 2026, the audit of the Frankenstein's monster):
   the frames, the tick box, the fold arrow, the bullet, the field, the Undo arrow, the nothing-here line and the day's column
   (--lk-day). A module gives each only its place; the look is final here. */
/* lk-window: a window in the middle of the screen (Find, the settings window, a measure report, an ask that needs the whole
   screen), the page dimmed the same behind each; lk-pop: a pop-up or picker beside the thing pressed (a menu, a tag picker,
   the # list, a name over a dot). Both on the page's paper, a hairline round them, one shadow each. */
.lk-window { background: var(--lk-paper, #fff); color: var(--lk-text, #222); border: 1px solid var(--lk-hair); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.14); font-size: 14px; line-height: 1.5; text-align: left; }
.lk-window::backdrop { background: rgba(0,0,0,.16); }
.lk-pop { background: var(--lk-paper, #fff); color: var(--lk-text, #222); border: 1px solid var(--lk-hair); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.12); font-size: 14px; line-height: 1.4; text-align: left; }
/* lk-tick, drawn: the browser's checkbox as a small rounded square, its edge and its check mark in the text colour when on; a
   half-mark for a list ticked in part. Logseq's own forms rule paints a ticked box blue, so each piece is overridden. When it
   shows is lk-list's word above. */
input.lk-tick[type=checkbox] { appearance: none !important; -webkit-appearance: none !important; position: relative; box-sizing: border-box; width: 13px !important; height: 13px !important; margin: 0 !important; padding: 0 !important; flex: none; border: 1px solid var(--lk-line) !important; border-radius: 3px !important; background: none !important; color: inherit !important; cursor: pointer; vertical-align: -1px; }
input.lk-tick[type=checkbox]:is(:checked, :indeterminate, :focus, :hover) { background-color: transparent !important; background-image: none !important; border-color: currentColor !important; color: inherit !important; box-shadow: none !important; outline: none !important; }
input.lk-tick[type=checkbox]:checked::before { content: ""; position: absolute; left: 3.5px; top: .5px; width: 3.5px; height: 7px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
input.lk-tick[type=checkbox]:indeterminate::before { content: ""; position: absolute; left: 2px; right: 2px; top: 5px; height: 1.5px; background: currentColor; }
/* lk-fold, drawn: the chevron in a 16 by 20 place (Logseq's own width), pointing right while closed, down while open, turning in .12s; keyed, the
   round wash. Its markup is empty: the library draws the mark. */
.lk-fold { appearance: none; background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 20px; flex: none; border-radius: 3px; }
.lk-fold::before { content: ""; width: 10px; height: 10px; background: currentColor; -webkit-mask: var(--lk-ic) center / contain no-repeat; mask: var(--lk-ic) center / contain no-repeat; --lk-ic: ${iconUrl(Door.ICONS.chevron)}; transform: rotate(-90deg); transition: transform .12s; }
.lk-fold[aria-expanded="true"]::before { transform: none; }
.lk-fold > * { display: none !important; }   /* a mark a module still puts inside (an svg, an icon) gives way to the library's */
.lk-fold:focus-visible { outline: none; background: var(--lk-wash); }   /* keyed, the wash; under the pointer none, its showing is enough (the owner, 7 November 2026) */
/* lk-bul, Logseq's own bullet, by Logseq's numbers and colours (2.0.2, measured 7 November 2026; the owner: "create in library a
   logseq bullet that can be used elsewhere"): a .4em dot (6.4 px) at .8 in Logseq's bullet grey, in a 16 px round place; the
   place washed with Logseq's ring while what is under it is folded (.folded). One that opens something (.opens: a press opens
   the node, as a press on Logseq's bullet opens the block) shows the ring and a dot a fifth larger under the pointer. Logseq's
   own variables first, so a theme that recolours its bullets recolours these; a mix of the text colour where they are missing. */
.lk-bul { display: inline-flex; width: 16px; height: 16px; min-width: 16px; border-radius: 50%; align-items: center; justify-content: center; flex: none; transition: background-color .15s; }
.lk-bul::before { content: ""; width: 6.4px; height: 6.4px; border-radius: 50%; opacity: .8; transition: transform .2s; background: var(--lx-gray-08, var(--ls-block-bullet-color, var(--rx-gray-08, color-mix(in srgb, var(--lk-text, currentColor) 28%, transparent)))); }
.lk-bul.folded, .lk-bul.opens:hover { background: var(--lx-gray-04-alpha, var(--ls-block-bullet-border-color, var(--rx-gray-04-alpha, color-mix(in srgb, currentColor 7%, transparent)))); }
.lk-bul.opens { cursor: pointer; }
.lk-bul.opens:hover::before { transform: scale(1.2); }
/* lk-field, drawn: the letters on a hairline, firmer while the field has the keyboard, the placeholder faint; the browser's box,
   outline and shadow taken away. On the input itself, or on a span that holds the input beside an icon or a count. */
.lk-field:not(input, textarea) { display: flex; align-items: center; gap: 6px; }
.lk-field { box-sizing: border-box; min-width: 0; border: 0; border-bottom: 1px solid var(--lk-line); border-radius: 0; background: none; color: inherit; font: inherit; padding: 2px 0; outline: none; box-shadow: none; }
.lk-field:is(:focus, :focus-within) { border-bottom-color: currentColor; outline: none; box-shadow: none; }
.lk-field :is(input, textarea) { flex: 1; width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; color: inherit; font: inherit; outline: none; box-shadow: none; }
.lk-field::placeholder, .lk-field :is(input, textarea)::placeholder { color: var(--lk-quiet); opacity: 1; }
/* lk-none: nothing here, one line at the off strength where the things would stand, no box. */
.lk-none { color: var(--lk-off); padding: 6px 0; }
/* lk-undo, the press: the arrow alone, no ground, at the end of what changed; with nothing on screen to sit beside, it waits at
   the bottom right (lk-undo-dock) with its words (lk-undo-words), as quiet. */
.lk-undo-dock { position: fixed; z-index: 10002; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: min(420px, 60vw); color: var(--lk-text, currentColor); font-size: var(--lk-small); }
.lk-undo.lk-undo-docked { margin: 0; padding: 3px 9px; border-radius: 6px; opacity: 1 !important; background: var(--lk-paper, #fff); border: 1px solid var(--lk-hair); color: var(--lk-quiet); }
.lk-undo.lk-undo-docked:hover { color: var(--lk-text, currentColor); }
.lk-undo-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-undo { appearance: none; border: 0; background: none; padding: 0 4px; margin: 0 0 0 .4em; font: inherit; line-height: 1; color: inherit; cursor: pointer; vertical-align: -2px; display: inline-flex; align-items: center; gap: 6px; }
.lk-undo .ti { font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .lk-fold, .lk-fold::before, .lk-tick, .lk-undo { transition: none; } }
/* With less motion a revealed press shows at once, without a fade, and still waits its moment before it goes. */
@media (prefers-reduced-motion: reduce) { .lk-reveal { transition: opacity 0s linear .35s, color 0s; } }
.lk-icon.lk-web { display: inline-flex; align-items: center; line-height: 1; }
.lk-icon.lk-web svg { display: block; width: 12px; height: 12px; }
[class*="lk-i-"]::before, .lk-enter::after { content: ""; display: inline-block; width: 1.05em; height: 1.05em; vertical-align: -.15em; background: currentColor; -webkit-mask: var(--lk-ic) center / contain no-repeat; mask: var(--lk-ic) center / contain no-repeat; }
[class*="lk-i-"]::before { margin-right: .38em; }
.lk-enter::after { --lk-ic: ${iconUrl(Door.ICONS.enter)}; width: .85em; height: .85em; vertical-align: -.08em; margin-left: .4em; opacity: .46; }
${Object.entries(Door.ICONS).map(([name, d]) => `.lk-i-${name} { --lk-ic: ${iconUrl(d)}; }`).join('\n')}`;
})();
