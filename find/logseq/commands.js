/* Logseq's commands, read from the running app: the ones its own palette lists (the three groups of global shortcuts it
   keeps in its state, and the commands plugins register), with the key each has right now, including the owner's own
   bindings. The app hands its state to a plugin in the same window (its api on the parent window), but not its
   translation, so the English name of each built-in command is kept at the door (plugin.js, Door.COMMAND_LABELS); a command the dictionary does not
   name is shown by the words it registered with (a plugin's), or by its id. A command runs through the same door
   Logseq's palette uses, by its id. */
(function () {
const Find = window.Find;
const LABELS = window.PluginDoor.COMMAND_LABELS;   // the English name of each of Logseq's commands, kept at the door
const idOf = window.PluginDoor.bare;   // a command's id without its leading colon
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
  const raw = window.PluginDoor.logseqCommands();
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
