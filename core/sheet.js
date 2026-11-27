/* What stands on the key sheet, and how typed words find among its lines. No Logseq here.
     groups(commands, search)  commands: every command with the key it has now, { id, label, key } (key as the Mac's marks,
                               '' for none), Logseq's and the plugin's; search: null while Search does not run, else
                               { takesKey }: whether Cmd-K is its own;
                               corner the same for the corner and Cmd-Shift-P. Answers [{ head, lines: [{ words, keys }] }] in the
                               order a person meets them; a line with no key is left out, and so is a group with no line.
     found(words, typed)       the words cut for showing, [{ text, hit }], when they hold every word typed; else null. */
(function (root) {
const TWO = /^⇧?[^\s⌘⌥⌃⇧] ⇧?[^\s⌘⌥⌃⇧]$/;   // two keys pressed one after the other: "g j", "g ⇧G"
function groups(commands = [], search = null, corner = null) {
  const by = new Map(commands.map(one => [one.id, one.key || '']));
  const the = (...ids) => ids.map(id => by.get(id) || '');
  // While Cmd-K opens the plugin's Search, a command of Logseq's that says Cmd-K never hears it.
  const theirs = key => (search?.takesKey && key === '⌘K') || (corner?.takesKey && key === '⌘⇧P') ? '' : key;
  const two = commands.filter(one => TWO.test(one.key || '')).sort((a, b) => a.key.replace(/⇧/g, '').localeCompare(b.key.replace(/⇧/g, '')) || a.label.localeCompare(b.label));   // by their letters, a Shift not counted
  return [
    ['Writing', [
      ['Add a property', the('editor/add-property')],
      ['Undo, redo', the('editor/undo', 'editor/redo')],
    ]],
    ['Arranging bullets', [
      ['Indent, outdent', the('editor/indent', 'editor/outdent')],
      ['Move up, down', the('editor/move-block-up', 'editor/move-block-down')],
      ['Fold, unfold', the('editor/collapse-block-children', 'editor/expand-block-children')],
      ['Select the bullet above, below', the('editor/select-block-up', 'editor/select-block-down')],
    ]],
    ['Finding', [
      ['Search', [search?.takesKey ? '⌘K' : '']],
      ['Logseq’s search', [theirs(by.get('go/search') || '')]],
      ['Commands', [corner?.takesKey ? '⌘⇧P' : '']],
      ['Logseq’s commands', the('command-palette/toggle').map(theirs)],
    ]],
    ['Moving around', [
      ['Back, forward', the('go/backward', 'go/forward')],
    ]],
    ['Two letters, outside a bullet', two.map(one => [one.label, [one.key]])],
  ].map(([head, lines]) => ({ head, lines: lines.map(([words, keys]) => ({ words, keys: keys.filter(Boolean) })).filter(line => line.keys.length) }))
    .filter(group => group.lines.length);
}
function found(words, typed) {
  const text = String(words), low = text.toLowerCase(), want = String(typed || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!want.every(word => low.includes(word))) return null;
  const lit = new Array(text.length).fill(false);
  for (const word of want) for (let at = low.indexOf(word); at >= 0; at = low.indexOf(word, at + 1)) lit.fill(true, at, at + word.length);
  const out = [];
  for (let i = 0; i < text.length; i++) { if (!out.length || out[out.length - 1].hit !== lit[i]) out.push({ text: '', hit: lit[i] }); out[out.length - 1].text += text[i]; }
  return out;
}
const api = { groups, found };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).sheet = api;
})(typeof window !== 'undefined' ? window : globalThis);
