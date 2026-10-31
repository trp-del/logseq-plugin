// The plugin's files, in the order they load (loader.js reads this list). plugin.js first: the door each module comes in
// by. Then each module's files, its own main.js last, in the order the modules start: Look first, because the others
// carry its class names and draw nothing of their own for them; Threads last. main.js, last of all, starts them.
window.PluginFiles = [
  'plugin.js', 'settings/window.js', 'settings/ways-in.js',
  'look/logseq/kit.js', 'look/logseq/db.js', 'look/logseq/settings.js', 'look/logseq/style.js', 'look/logseq/marks.js', 'look/logseq/props.js', 'look/logseq/title.js', 'look/logseq/folded.js', 'look/logseq/sidebar.js', 'look/main.js',
  'find/logseq/kit.js', 'find/logseq/db.js', 'find/logseq/settings.js', 'find/logseq/commands.js', 'find/logseq/find.js', 'find/main.js',
  'predictive/core/text.js', 'predictive/core/engine.js', 'predictive/core/profile.js', 'predictive/core/dates.js', 'predictive/core/schema.js', 'predictive/core/context.js', 'predictive/core/names.js', 'predictive/core/link.js', 'predictive/core/propose.js', 'predictive/core/score.js',
  'predictive/logseq/settings.js', 'predictive/logseq/db.js', 'predictive/logseq/app.js', 'predictive/logseq/link-ui.js', 'predictive/logseq/propose-ui.js', 'predictive/logseq/tag-pick.js', 'predictive/logseq/steps.js', 'predictive/main.js',
  'structure/core/model.js', 'structure/core/rules.js', 'structure/core/changes.js', 'structure/logseq/db.js', 'structure/logseq/apply.js', 'structure/logseq/view.js', 'structure/logseq/mount.js', 'structure/main.js',
  'export/core/inline.js', 'export/core/dates.js', 'export/core/doc.js', 'export/core/markdown.js', 'export/core/html.js', 'export/core/themes.js',
  'export/logseq/db.js', 'export/logseq/files.js', 'export/logseq/clipboard.js', 'export/logseq/print.js', 'export/logseq/preview.js', 'export/logseq/ui.js', 'export/main.js',
  'threads/parts/shared.js', 'threads/parts/model.js', 'threads/parts/diagnostics.js', 'threads/parts/two-way.js', 'threads/parts/property-kinds.js', 'threads/parts/alike.js', 'threads/parts/shadow-rules.js', 'threads/settings.js', 'threads/main.js',
  'main.js',
];
