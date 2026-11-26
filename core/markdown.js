/* A node and its bullets as Markdown, for the clipboard. No Logseq here.
     outline(lines)                            the bullets as a nested list
     page({ title, tags, properties, lines })  a node whole: its name as a heading, its tags on a line, each property that holds
                                               something on a line of its own, then its bullets
   lines: [{ depth, words, task }], in the order they stand; depth 0 is the first level; task '' (no task), 'open' or 'done'.
   words: as a person reads them, a link as [[its name]]. A link is written as its name alone, and a tag in the words as #Name.
   A bullet of several lines keeps them, the later ones set in under the first. */
(function (root) {
const plain = words => String(words == null ? '' : words).replace(/#\[\[([^\[\]\n]+)\]\]/g, (all, name) => '#' + name.replace(/\s+/g, '-')).replace(/\[\[([^\[\]\n]+)\]\]/g, '$1');
function outline(lines) {
  const list = (lines || []).filter(line => line), least = Math.min(...list.map(line => Number(line.depth) || 0), Infinity);
  return list.map(line => {
    const pad = '  '.repeat(Math.max(0, (Number(line.depth) || 0) - least)), mark = line.task === 'done' ? '- [x] ' : line.task ? '- [ ] ' : '- ';
    const [first, ...rest] = plain(line.words).split('\n');
    return [pad + mark + first.trim(), ...rest.map(more => pad + '  ' + more.trim())].join('\n');
  }).join('\n');
}
function page({ title, tags = [], properties = [], lines = [] } = {}) {
  const head = ['# ' + plain(String(title || 'Untitled').split('\n')[0])];
  if (tags.length) head.push(tags.map(tag => '#' + String(tag).replace(/\s+/g, '-')).join(' '));
  const held = properties.filter(prop => prop && (prop.values || []).length).map(prop => `${prop.name}: ${prop.values.map(plain).join(', ')}`);
  return [head.join('\n'), held.join('\n'), outline(lines)].filter(Boolean).join('\n\n');
}
const api = { outline, page, plain };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).markdown = api;
})(typeof window !== 'undefined' ? window : globalThis);
