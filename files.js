// The plugin's files, in the order they load (loader.js reads this list). The order is the stack: the frame, the pieces that
// decide (core, no Logseq in them), the ground, the node, then each part that stands on them. main.js, last, starts the parts.
window.PluginFiles = [
  'plugin.js',
  'core/words.js', 'core/days.js', 'core/lists.js', 'core/tags.js', 'core/find.js', 'core/todo.js', 'core/sure.js', 'core/move.js', 'core/update.js', 'core/view.js',
  'ground/look.js', 'ground/read.js', 'ground/write.js', 'ground/touch.js',
  'node/menu.js', 'node/line.js', 'node/node.js', 'node/view.js',
  'page/relations.js', 'page/place.js',
  'arrive/find.js', 'arrive/todo.js',
  'write/sure.js', 'write/where.js', 'write/place.js',
  'tend/move.js', 'tend/ontology.js',
  'beside/update.js',
  'main.js',
];
