/* The clipboard: rich text (HTML with its styles inline, and the Markdown as the plain-text form) or Markdown alone, through
   the plugin's one way to copy (PluginDoor.copy in plugin.js). */
(function () {
const E = (window.DbExport ||= {});
E.clipboard = { write: parts => window.PluginDoor.copy(parts) };
})();
