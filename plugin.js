/* The door every module comes in by. Loaded first. A module's own main.js, as it loads, calls
   PluginDoor.register({ key, title, about, schema, start, stop }); main.js, loaded last, gives Logseq every module's
   settings as one list and starts the modules in the order they registered. Logseq gives a plugin one start (logseq.ready),
   one settings list and one clean-up (beforeunload), so those three belong to main.js and to no module. The name is not
   Plugin: every browser already has a window.Plugin of its own, the entries of navigator.plugins. */
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
})();
