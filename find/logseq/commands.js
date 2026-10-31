/* Logseq's commands, read from the running app: the ones its own palette lists (the three groups of global shortcuts it
   keeps in its state, and the commands plugins register), with the key each has right now, including the owner's own
   bindings. The app hands its state to a plugin in the same window (its api on the parent window), but not its
   translation, so the English name of each built-in command is kept here, taken from Logseq's dictionary
   (`src/resources/dicts/en.edn`, the `:command.*` entries, 130 on 31 October 2026); a command the dictionary does not
   name is shown by the words it registered with (a plugin's), or by its id. A command runs through the same door
   Logseq's palette uses, by its id. */
(function () {
const Find = window.Find;
const LABELS = {
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
// The app's api on the parent window; the plugin's frame shares its origin.
const hostApi = () => { try { return window.parent?.logseq?.api || null; } catch (error) { return null; } };
const idOf = raw => String(raw ?? '').replace(/^:/, '');
const humanize = id => { const n = id.split('/').pop().replace(/-/g, ' '); return n.charAt(0).toUpperCase() + n.slice(1); };
/* The key as Logseq shows it ("⌘+⇧+k", "g j", "t s | ⌘+,"), in the window's own form: the + between keys goes, a letter
   after a modifier is upper-case, the first of two bindings is shown ("⌘⇧K", "g j", "t s"); a disabled one is blank. */
function keyOf(shortcut) {
  if (typeof shortcut !== 'string' || !shortcut || /disabled/i.test(shortcut)) return '';
  return shortcut.split(' | ')[0].split(' ').map(step => {
    const parts = step.split('+').filter(Boolean);
    if (!parts.length) return step;
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 1) parts[parts.length - 1] = last.toUpperCase();
    return parts.join('');
  }).join(' ');
}
/* Every command the app lists, in its order (by id, so the ones of a kind sit together: editor, go, graph, ui …).
   When the app's state cannot be read, the built-in ones its palette lists, from the dictionary, without keys. */
function list() {
  let raw = [];
  try { raw = hostApi()?.get_state_from_store?.('command-palette/commands') || []; } catch (error) { raw = []; }
  const seen = new Set(), out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const id = idOf(c?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: LABELS[id] || (typeof c.desc === 'string' && c.desc) || humanize(id), key: keyOf(c.shortcut), action: typeof c.action === 'function' ? c.action : null });
  }
  if (!out.length) for (const id of Object.keys(LABELS)) if (!/^(auto-complete|cards|pdf|dev)\//.test(id)) out.push({ id, label: LABELS[id], key: '', action: null });
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
// Run one as Logseq's palette does, by its id; an id with capitals (a plugin's) would be lowered on the way, so its own action is called.
async function run(cmd) {
  if (/[A-Z]/.test(cmd.id) && cmd.action) return cmd.action();
  return logseq.App.invokeExternalCommand('logseq.' + cmd.id);
}
Find.commands = { list, run, keyOf, LABELS };
})();
