/* GROUND: the one way the plugin writes to the graph, and the one Undo.
   Every write is one of Logseq's own editor calls, so each lands in Logseq's own history: Undo here is Logseq's Undo, the same
   Cmd-Z and the same result as on the node's own page (tried in Logseq 2.0.2, 25 November 2026: a status and a value written
   from the plugin each went back with one Undo, the Task tag Logseq had added going with the status).
     write.setStatus(uuid, title)   a task's status, by the name Logseq shows it under
     write.remove(uuid, isPage)     a bullet deleted; a page sent to Logseq's Recycle
     write.addTask(words)           a new bullet at the end of today's journal, its status Todo; answers its uuid
     write.setNode(uuid, ident, id) a node (or a day's journal page) put under one of the person's properties
     write.newTag(name)             a new tag of the person's, at the top; answers its uuid
     write.untag(uuid, tag)         one of the person's tags taken off a node
     write.tag(uuid, tag)           one of the person's tags put on a node
     write.placeTag(uuid, under)    a tag put under another tag (in place of where it sat)
     write.undo()                   Logseq's Undo */
(function () {
const G = window.PluginDoor;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sure = uuid => { if (!UUID.test(String(uuid || ''))) throw new Error('a node is changed by its id, and none was given'); return String(uuid); };
G.write = {
  setStatus: (uuid, title) => logseq.Editor.upsertBlockProperty(sure(uuid), 'logseq.property/status', String(title)),
  remove: (uuid, isPage) => isPage ? logseq.Editor.deletePage(sure(uuid)) : logseq.Editor.removeBlock(sure(uuid)),
  async addTask(words) {
    const text = String(words || '').trim();
    if (!text) throw new Error('a task needs words');
    const today = G.days.number(new Date());
    const page = await G.read.journal(today) || String((await logseq.Editor.createJournalPage(new Date()))?.uuid || '');
    if (!UUID.test(page)) throw new Error('today’s journal could not be found');
    const made = await logseq.Editor.appendBlockInPage(page, text, { properties: { 'logseq.property/status': 'Todo' } });
    return String(made?.uuid || '');
  },
  setNode(uuid, ident, id) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident)) || !Number.isSafeInteger(id) || id <= 0) throw new Error('a value is written under one of your properties, as a node of the graph');
    return logseq.Editor.upsertBlockProperty(sure(uuid), ident, id, { entityId: true });
  },
  // Logseq's createTag makes a tag that belongs to the plugin (plugin.class/…), which is not one of the person's own: a page made
  // as a class is (user.class/…), the same as "New tag" in Logseq's own list.
  async newTag(name) { const made = await logseq.Editor.createPage(String(name || '').trim(), {}, { redirect: false, class: true }); return String(made?.uuid || ''); },
  untag: (uuid, tag) => logseq.Editor.removeBlockTag(sure(uuid), sure(tag)),
  tag: (uuid, tag) => logseq.Editor.addBlockTag(sure(uuid), sure(tag)),
  placeTag: (uuid, under) => logseq.Editor.addTagExtends(sure(uuid), sure(under)),
  undo: () => logseq.App.invokeExternalCommand('logseq.editor/undo'),
};
})();
