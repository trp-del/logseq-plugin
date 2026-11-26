// The plugin's files, in the order they load (loader.js reads this list). The order is the stack: the frame, the pieces that
// decide (core, no Logseq in them), the ground, the node, then each part that stands on them. main.js, last, starts the parts.
window.PluginFiles = [
  'plugin.js',
  'core/words.js', 'core/days.js', 'core/lists.js', 'core/tags.js', 'core/search.js', 'core/todo.js', 'core/sure.js', 'core/move.js', 'core/update.js', 'core/view.js', 'core/reads.js', 'core/time.js', 'core/markdown.js',
  'ground/look.js', 'ground/read.js', 'ground/write.js', 'ground/outside.js', 'ground/touch.js',
  'node/menu.js', 'node/undo.js', 'node/ask.js', 'node/line.js', 'node/node.js', 'node/view.js', 'node/add.js', 'node/pick.js', 'node/card.js', 'node/time.js',
  'page/relations.js', 'page/place.js', 'page/recycle.js',
  'arrive/search.js', 'arrive/todo.js',
  'write/sure.js', 'write/where.js', 'write/place.js',
  'tend/move.js', 'tend/ontology.js',
  'beside/calm.js', 'beside/update.js', 'beside/outside.js', 'beside/corner.js',
  'main.js',
];
