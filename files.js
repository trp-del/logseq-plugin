// The plugin's files, in the order they load (loader.js reads this list). plugin.js first: the door each module comes in
// by. Then each module's files, its own main.js last, in the order the modules start: Look first, Threads last. main.js, last of all, starts them.
window.PluginFiles = [
  'plugin.js', 'settings/window.js', 'settings/ways-in.js',
  'look/logseq/kit.js', 'look/logseq/db.js', 'look/logseq/settings.js', 'look/logseq/style.js', 'look/logseq/marks.js', 'look/logseq/props.js', 'look/logseq/title.js', 'look/logseq/folded.js', 'look/logseq/sidebar.js', 'look/logseq/cites.js', 'look/logseq/links.js', 'look/logseq/values.js', 'look/main.js',
  'find/logseq/kit.js', 'find/logseq/db.js', 'find/logseq/settings.js', 'find/logseq/commands.js', 'find/logseq/find.js', 'find/main.js',
  'predictive/core/text.js', 'predictive/core/engine.js', 'predictive/core/profile.js', 'predictive/core/dates.js', 'predictive/core/schema.js', 'predictive/core/context.js', 'predictive/core/names.js', 'predictive/core/link.js', 'predictive/core/propose.js', 'predictive/core/model.js', 'predictive/core/score.js',
  'predictive/logseq/settings.js', 'predictive/logseq/db.js', 'predictive/logseq/app.js', 'predictive/logseq/model.js', 'predictive/logseq/link-ui.js', 'predictive/logseq/propose-ui.js', 'predictive/logseq/tag-pick.js', 'predictive/logseq/cite.js', 'predictive/logseq/page-here.js', 'predictive/logseq/steps.js', 'predictive/main.js',
  'structure/core/model.js', 'structure/core/rules.js', 'structure/core/changes.js', 'structure/logseq/db.js', 'structure/logseq/apply.js', 'structure/logseq/view.js', 'structure/logseq/regions.js', 'structure/logseq/mount.js', 'structure/logseq/hash.js', 'structure/main.js',
  'export/core/inline.js', 'export/core/dates.js', 'export/core/doc.js', 'export/core/markdown.js', 'export/core/html.js', 'export/core/themes.js',
  'export/logseq/db.js', 'export/logseq/files.js', 'export/logseq/clipboard.js', 'export/logseq/print.js', 'export/logseq/preview.js', 'export/logseq/ui.js', 'export/main.js',
  'threads/parts/shared.js', 'threads/parts/model.js', 'threads/parts/diagnostics.js', 'threads/parts/two-way.js', 'threads/parts/alike.js', 'threads/parts/shadow-rules.js', 'threads/settings.js', 'threads/main.js',
  'main.js',
];
// Any of them failing to load, or stopping as it loads, is kept here for main.js to say. Only main.js itself failing has nobody
// to say it, so then this does.
window.PluginFilesFailed = [];
window.PluginFilesSaid = () => { const all = window.PluginFilesFailed; return all.slice(0, 3).join(', ') + (all.length > 3 ? ` and ${all.length - 3} more` : ''); };
window.PluginFilesWatch = event => {
  const url = String(event.target?.src || event.filename || '').split('?')[0];
  const file = (window.PluginFiles || []).filter(name => url.endsWith('/' + name)).sort((a, b) => b.length - a.length)[0];
  if (!file || window.PluginFilesFailed.includes(file)) return;
  window.PluginFilesFailed.push(file);
  if (window.PluginFiles.at(-1) !== file) return;
  logseq.ready(() => logseq.UI.showMsg(`Logseq Plugin could not start: ${window.PluginFilesSaid()} did not load.`, 'error'));
};
window.addEventListener('error', window.PluginFilesWatch, true);
