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
     write.newProperty(title, type, many, range)  a property of the person's own; answers { ident, uuid }
     write.setValues(uuid, ident, raws, { ref, many })  what a node holds under a property, set to exactly these
     write.dropProperty(uuid)       a property removed, by its page
     write.moveTag(uuid, to, from)  a tag put under another (to) or at the top (''), and taken from under the tags in from
     write.addNode(tag, ident, id)  a new empty bullet on today's journal, tagged, pointing at node id through a property; its uuid
     write.placeTag(uuid, under)    a tag put under another tag (in place of where it sat)
     write.setText(uuid, ident, value), setDay(uuid, ident, day), clear(uuid, ident), newPage(name, tag)
                                    words or a number, a day, nothing at all under a property; a new page, tagged
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
  /* A property of the person's own, made as Logseq's own "new property" makes it (Logseq's upsertProperty would make one that
     belongs to the plugin). Answers { ident, uuid }. range: the ids of the tags its values must hold (a node property). */
  async newProperty(title, type, many, range = []) {
    const name = String(title || '').trim();
    if (!name) throw new Error('a property needs a name');
    await logseq.Editor.upsertNodes([{ operation: 'add', entityType: 'property', id: `lk-new-${Date.now()}`, data: { title: name, 'property-type': String(type || 'default'), ...(many ? { 'property-cardinality': 'many' } : {}) } }], {});
    const found = (await G.read.q(`[:find ?i ?u ?c :where [?p :block/title ?t] [(= ?t ${JSON.stringify(name)})] [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")] [?p :block/uuid ?u] [?p :block/created-at ?c]]`)).sort((a, b) => b[2] - a[2])[0];
    if (!found) throw new Error(`Logseq did not make “${name}”`);
    const made = { ident: String(found[0]).replace(/^:/, ''), uuid: String(found[1]) };
    if (range.length) await logseq.Editor.setPropertyNodeTags(made.uuid, range.filter(id => Number.isSafeInteger(id) && id > 0));
    return made;
  },
  // What a node holds under a property, set to exactly these values (raw, as read.holders answers them); none clears it.
  async setValues(uuid, ident, raws, { ref = false, many = false } = {}) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident))) throw new Error('a value is written under one of your properties');
    await logseq.Editor.removeBlockProperty(sure(uuid), ident);
    if (!raws.length) return;
    await logseq.Editor.upsertBlockProperty(uuid, ident, many ? raws : raws[0], ref ? { entityId: true } : {});
  },
  dropProperty: uuid => logseq.Editor.deletePage(sure(uuid)),   // Logseq lets a plugin remove only its own properties by name; a property's page it deletes like any page
  // A tag moved: put under another tag (to), or to the top (to: ''), and taken from under the ones it sat under (from).
  // Answers how many writes it took: that many steps of Logseq's Undo put the tag back.
  async moveTag(uuid, to, from = []) {
    let steps = 0;
    if (to) { await logseq.Editor.addTagExtends(sure(uuid), sure(to)); steps++; }
    for (const was of from) if (was !== to) { await logseq.Editor.removeTagExtends(sure(uuid), sure(was)); steps++; }
    return steps;
  },
  // A page of the person's own by this name, made if there is none; answers its uuid.
  async newPage(name) {
    const title = String(name || '').trim();
    if (!title) throw new Error('a page needs a name');
    const made = await logseq.Editor.createPage(title, {}, { redirect: false }) || await logseq.Editor.getPage(title);
    if (!made?.uuid) throw new Error(`Logseq did not make “${title}”`);
    return String(made.uuid);
  },
  // A new, empty bullet at the end of today's journal that holds a tag and points at a node through a property; answers its uuid.
  async addNode(tag, ident, id) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident)) || !Number.isSafeInteger(id) || id <= 0) throw new Error('a new node points at a node of the graph through one of your properties');
    const page = await G.read.journal(G.days.number(new Date())) || String((await logseq.Editor.createJournalPage(new Date()))?.uuid || '');
    if (!UUID.test(page)) throw new Error('today’s journal could not be found');
    const made = String((await logseq.Editor.appendBlockInPage(page, ''))?.uuid || '');
    await logseq.Editor.addBlockTag(sure(made), sure(tag));
    await logseq.Editor.upsertBlockProperty(made, ident, id, { entityId: true });
    return made;
  },
  placeTag: (uuid, under) => logseq.Editor.addTagExtends(sure(uuid), sure(under)),
  // A new, empty line at the end of what a node keeps under it; answers its uuid.
  async addLine(uuid, isPage) { const made = isPage ? await logseq.Editor.appendBlockInPage(sure(uuid), '') : await logseq.Editor.insertBlock(sure(uuid), '', { sibling: false }); return String(made?.uuid || ''); },
  // Logseq's Recycle: a page or a bullet brought back, or deleted for good (which nothing takes back). Logseq's own two calls.
  restore: uuid => G.host().defaultView.logseq.api.restore_page(sure(uuid)),
  deleteForGood: uuid => G.host().defaultView.logseq.api.delete_recycled_page_permanently(sure(uuid)),
  // Words, a number or yes/no written under one of the person's properties.
  setText(uuid, ident, value) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident))) throw new Error('a value is written under one of your properties');
    return logseq.Editor.upsertBlockProperty(sure(uuid), ident, value);
  },
  // A day written under a date property: the day's journal page, made when the graph has none yet.
  async setDay(uuid, ident, day) {
    if (!G.days.valid(day)) throw new Error('that is not a day');
    const page = await G.read.journal(day) || String((await logseq.Editor.createJournalPage(new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100)))?.uuid || '');
    const node = await G.read.node(page);
    if (!node) throw new Error('the day’s journal could not be found');
    return G.write.setNode(uuid, ident, node.id);
  },
  // Everything a node holds under a property taken off.
  clear(uuid, ident) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident))) throw new Error('only one of your properties is cleared');
    return logseq.Editor.removeBlockProperty(sure(uuid), ident);
  },
  // A new page, with one of the person's tags when one is given; answers its uuid.
  async newPage(name, tag = '') {
    const made = String((await logseq.Editor.createPage(String(name || '').trim(), {}, { redirect: false }))?.uuid || '');
    if (tag) await logseq.Editor.addBlockTag(sure(made), sure(tag));
    return made;
  },
  undo: () => logseq.App.invokeExternalCommand('logseq.editor/undo'),
};
})();
