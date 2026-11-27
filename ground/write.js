/* GROUND: the one way the plugin writes to the graph, and the one Undo.
   Every write is one of Logseq's own editor calls, so each lands in Logseq's own history: Undo here is Logseq's Undo, the same
   Cmd-Z and the same result as on the node's own page (tried in Logseq 2.0.2, 25 November 2026: a status and a value written
   from the plugin each went back with one Undo, the Task tag Logseq had added going with the status).
     write.setStatus(uuid, title)   a task's status, by the name Logseq shows it under
     write.remove(uuid, isPage)     a bullet deleted; a page sent to Logseq's Recycle
     (the five that add a bullet, addTask, addNode, addBullet, addLine and addFile, set down the bullet being written for the moment)
     write.addTask(words, day)      a new bullet at the end of today's journal, its status Todo, its Deadline the day when one is given; answers its uuid
     write.setPriority(uuid, title) a task's priority by its name, or taken off with none
     write.setDeadline(uuid, day)   a task's deadline, or taken off with 0
     write.setNode(uuid, ident, id) a node (or a day's journal page) put under one of the person's properties
     write.newTag(name)             a new tag of the person's, at the top; answers its uuid (made in ground/touch.js)
     write.untag(uuid, tag)         one of the person's tags taken off a node
     write.tag(uuid, tag)           one of the person's tags put on a node
     write.newProperty(title, type, many, range)  a property of the person's own; answers { ident, uuid } (made in
                                    ground/touch.js; where its tags are refused it is taken away again)
     write.setValues(uuid, ident, raws, { ref, many })  what a node holds under a property, set to exactly these, in one write
                                    that Logseq makes whole or not at all. Answers how many steps of Undo it made: 1, or 0
                                    where the node already held exactly these. A value in words that stays keeps its own
                                    bullet and what is written under it; one that would go with bullets under it is refused
                                    before anything is written
     write.dropProperty(uuid)       a property removed, by its page
     write.moveTag(uuid, to, from)  a tag put under another (to) or at the top (''), and taken from under the tags in from;
                                    answers how many steps it took. Refused halfway, its first steps are taken back
     write.addNode(tag, ident, id, { words, page })  a new bullet (on today's journal, or at a page's end), tagged, pointing at
                                    node id through a property; answers { uuid, steps }. Refused halfway, the bullet is
                                    taken away again: nothing is left half made
     write.placeTag(uuid, under)    a tag put under another tag (in place of where it sat)
     write.rename(uuid, name)       a tag's or a property's name (its page's title), as Logseq's own title renames it
     write.tagProperties(uuid, ids) the properties a tag gives its nodes, set to exactly these (property ids), in one write
     write.range(uuid, ids)         the tags a node property's values hold, set to exactly these (tag ids)
     write.toPage(uuid, page)       a bullet, with what is under it, moved onto another page
     write.setText(uuid, ident, value), setDay(uuid, ident, day), clear(uuid, ident)
                                    words or a number, a day, nothing at all under a property. Words written over a value that
                                    holds bullets change that value's own words, as writing in it does, and the bullets stay
     write.newPage(name, tag)       a page of the person's own by this name, made if there is none, with a tag when one is
                                    given; answers its uuid. Where the tag is refused the refusal says the page was made
     write.setWords(uuid, words, { asRead })  a bullet's words, written as typed: Logseq makes [[a name]] a link and #Name a
                                    tag. asRead: the words were read from this bullet as a person reads them (read.outline):
                                    every link and tag the bullet already holds is written back as the link it is
     write.addBullet(at, words, where)  a new bullet with these words: after the bullet at (the default), as its last bullet
                                    ({ under: true }), or at the end of the page at ({ page: true }); answers its uuid
     write.addFile(at, file, { under })  a file of this Mac (ground/touch.js file) put into the graph as Logseq itself puts
                                    a pasted file: a node of its own, the file copied into the graph's assets folder. At the
                                    end of the page at, or as the last bullet of the bullet at ({ under: true }). Answers
                                    { uuid, steps }: the file's node, and the steps of Undo that take it away again. A file
                                    the graph already holds, one with no ending and one over 100 MB are refused before
                                    anything is made; refused later, the empty bullet made for it is taken away again
     write.moveIn(uuid)             a bullet set in under the bullet before it; write.moveOut(uuid) sets it out, after the one it
                                    sat under. Each answers how many writes it took (0: there was nowhere to move it)
     write.restore(uuid), write.deleteForGood(uuid)   Logseq's Recycle: a page brought back; deleted for good
     write.setValue(uuid, ident, raw, { ref }), write.clearValue(uuid, ident)   old names of setNode or setText, and of clear,
                                    kept until the places that call them are changed
     write.refused(what, error, then, { quiet })   the one way to say a refusal: a notice that says what was not done (what),
                                    why in everyday words, and what to do (then, a whole sentence, where the place knows
                                    it). Logseq's own error words go to the console, never into the notice. Answers the
                                    words. quiet: the same words answered and no notice shown, for a place that shows them
                                    itself (a panel outside Logseq)
     write.day(day)                 a day's journal page, made if there is none; answers its uuid
     write.undo()                   Logseq's Undo
   Logseq's calls as the running Logseq takes them (2.0.2, tried 27 November 2026), where its documentation says otherwise or
   nothing: deletePage and renamePage take a page's uuid (renamePage refuses a name: "Invalid page uuid"); several values go in
   one upsertBlockProperty with { reset: true }, which is one step of Undo and writes nothing when it refuses; without reset a
   list is added to what is there; a property that takes one value is given the value itself, never a list; Undo is the command
   logseq.editor/undo, which the documentation's list of commands leaves out. */
(function () {
const G = window.PluginDoor;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* A write that adds a bullet. The bullet being written is left for the moment of it and opened again after: when a new bullet
   lands after or under the one being written, Logseq saves that one's box as it reads, and a #tag in it then makes a tag named
   by an id (tried in Logseq 2.0.2, 27 November 2026). */
async function adding(write) {
  const resume = await G.touch.setDown();
  try { return await write(); } finally { await resume(); }
}
const sure = uuid => { if (!UUID.test(String(uuid || ''))) throw new Error('a node is changed by its id, and none was given'); return String(uuid); };
const MINE = /^user\.property\/[\w.-]+$/, pause = ms => new Promise(done => setTimeout(done, ms));
// A refusal of the plugin's own: its words are for the person (then: what to do), and are said as they are.
const no = (words, then = '') => Object.assign(new Error(words), { plain: true, then });
/* Logseq's own refusals the plugin can meet, said plainly. Anything else is "Logseq refused the change". */
const WHY = [
  [/own property value/i, 'a node cannot be a value of its own'],
  [/(\d+) validation error/i, found => `Logseq checked the graph first and found ${found[1]} ${found[1] === '1' ? 'thing' : 'things'} in it that it calls invalid, so it wrote nothing`],
  [/not a valid tag|n[o']t a tag/i, 'Logseq does not take that tag there'],
  [/built-in|read-only/i, 'that is one of Logseq’s own, which cannot be changed'],
  [/cycle/i, 'the tag would end up under itself'],
  [/name (is invalid|can't)|invalid (page|property) name/i, 'Logseq does not take that name'],
  [/already exists/i, 'something else already has that name'],
  [/timeout/i, 'Logseq did not answer'],
];
function why(error) {
  if (error?.plain) return String(error.message);
  const said = String(error?.message || error || '');
  console.warn('Logseq Plugin: a change was refused, in Logseq’s own words:', said, error);
  for (const [like, words] of WHY) { const found = like.exec(said); if (found) return typeof words === 'function' ? words(found) : words; }
  return 'Logseq refused the change';
}
/* A change made of several of Logseq's writes, kept whole. did(write) counts each write that went through. When one is refused,
   the ones before it are taken back with Logseq's own Undo, a moment apart as the Undo arrow does; mend() then takes away what
   may still stand; and the refusal goes on to the caller. Where a step could not be taken back the refusal says so (left) and
   carries how many steps of Undo take the rest away (steps). */
async function whole(run, mend) {
  let steps = 0;
  const did = async write => { const got = await write; steps++; return got; };
  try { return await run(did); }
  catch (error) {
    let back = 0;
    try { for (; back < steps; back++) { await pause(350); await G.write.undo(); } if (steps) await pause(350); if (mend) await mend(); }
    catch (failed) { console.warn('Logseq Plugin: a change refused halfway could not be taken back whole', failed); }
    if (back < steps && error && typeof error === 'object') { error.steps = steps - back; error.left = 'What was already written stays; Undo takes it back.'; }
    throw error;
  }
}
const few = words => { const text = String(words ?? '').trim(); return text.length > 40 ? text.slice(0, 39) + '…' : text; };
G.write = {
  setStatus: (uuid, title) => logseq.Editor.upsertBlockProperty(sure(uuid), 'logseq.property/status', String(title)),
  remove: (uuid, isPage) => isPage ? logseq.Editor.deletePage(sure(uuid)) : logseq.Editor.removeBlock(sure(uuid)),
  // A day as Logseq's own date picker writes it: that day's start, in this Mac's time.
  setPriority: (uuid, title) => title ? logseq.Editor.upsertBlockProperty(sure(uuid), 'logseq.property/priority', String(title)) : logseq.Editor.removeBlockProperty(sure(uuid), 'logseq.property/priority'),
  setDeadline(uuid, day) {
    if (!day) return logseq.Editor.removeBlockProperty(sure(uuid), 'logseq.property/deadline');
    if (!G.days.valid(day)) throw no('that is not a day');
    return logseq.Editor.upsertBlockProperty(sure(uuid), 'logseq.property/deadline', new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100).getTime());
  },
  async addTask(words, day = 0) {
    const text = String(words || '').trim();
    if (!text) throw no('a task needs words');
    const today = G.days.number(new Date());
    const page = await G.read.journal(today) || String((await logseq.Editor.createJournalPage(new Date()))?.uuid || '');
    if (!UUID.test(page)) throw no('today’s journal could not be found');
    const made = await adding(() => logseq.Editor.appendBlockInPage(page, text, { properties: { 'logseq.property/status': 'Todo', ...(G.days.valid(day) ? { 'logseq.property/deadline': new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100).getTime() } : {}) } }));
    return String(made?.uuid || '');
  },
  setNode(uuid, ident, id) {
    if (!/^user\.property\/[\w.-]+$/.test(String(ident)) || !Number.isSafeInteger(id) || id <= 0) throw new Error('a value is written under one of your properties, as a node of the graph');
    return logseq.Editor.upsertBlockProperty(sure(uuid), ident, id, { entityId: true });
  },
  newTag: name => G.touch.makeTag(String(name || '').trim()),
  untag: (uuid, tag) => logseq.Editor.removeBlockTag(sure(uuid), sure(tag)),
  tag: (uuid, tag) => logseq.Editor.addBlockTag(sure(uuid), sure(tag)),
  /* A property of the person's own (how it is made stands in ground/touch.js). Answers { ident, uuid }. range: the ids of the
     tags its values must hold (a node property). Where Logseq refuses those tags the property just made is taken away again. */
  async newProperty(title, type, many, range = []) {
    const name = String(title || '').trim(), tags = range.filter(id => Number.isSafeInteger(id) && id > 0);
    if (!name) throw no('a property needs a name');
    const made = await G.touch.makeProperty(name, String(type || 'default'), !!many);
    if (!made) throw no(`Logseq did not make “${name}”`);
    if (tags.length) {
      try { await logseq.Editor.setPropertyNodeTags(made.uuid, tags); }
      catch (error) {
        try { await logseq.Editor.deletePage(made.uuid); }
        catch (failed) { if (error && typeof error === 'object') { error.steps = 1; error.left = `The property “${name}” was made all the same, and takes any node.`; } }
        throw error;
      }
    }
    return made;
  },
  /* What a node holds under a property, set to exactly these values (raw, as read.holders answers them); none clears it. One
     write: a list with { reset: true }, as Logseq's guide gives it, which Logseq makes whole or refuses whole (tried in Logseq
     2.0.2, 27 November 2026: a node refused as its own value left what the node held untouched; one Undo put the old values
     back). A value in words is a bullet of Logseq's own and can hold bullets: written anew as words it would be a new bullet and
     the old one, with what is under it, would be out of reach; so one that stays is written by its own id, and one that would
     go while it holds bullets is refused before anything is written. Answers the steps of Undo made: 1, or 0. */
  async setValues(uuid, ident, raws, { ref = false, many = false } = {}) {
    if (!MINE.test(String(ident))) throw new Error('a value is written under one of your properties');
    const at = sure(uuid), [now, known] = await Promise.all([G.read.under(at, ident), G.read.schema()]), prop = known.props.get(ident);
    const free = now.words.filter(one => !raws.includes(one.id));
    let byId = false;
    const list = [...raws].map(raw => { const i = typeof raw === 'string' ? free.findIndex(one => one.words === raw) : -1; if (i < 0) return raw; byId = true; return free.splice(i, 1)[0].id; });
    const lost = free.find(one => one.under);
    if (lost) throw no(`the value “${few(lost.words)}” has ${lost.under === 1 ? 'a bullet' : `${lost.under} bullets`} written under it, which would be lost with it`, 'Move what is under that value out of it first.');
    if (list.length === now.held.length && list.every(raw => now.held.includes(raw))) return 0;   // it holds exactly these already
    if (!list.length) { await logseq.Editor.removeBlockProperty(at, ident); return 1; }
    const ids = ref || byId || ['node', 'date', 'asset'].includes(prop?.type);
    await logseq.Editor.upsertBlockProperty(at, ident, (prop ? prop.many : many) ? list : list[0], { reset: true, ...(ids ? { entityId: true } : {}) });
    return 1;
  },
  dropProperty: uuid => logseq.Editor.deletePage(sure(uuid)),   // Logseq lets a plugin remove only its own properties by name; a property's page it deletes like any page
  /* A tag moved: put under another tag (to), or to the top (to: ''), and taken from under the ones it sat under (from).
     Answers how many writes it took: that many steps of Logseq's Undo put the tag back. Only what changes something is
     written (the tag is not put under a tag it is under already, nor taken from under one it is not under), so each write
     counted is a step that stands on Logseq's history; refused halfway, those steps are taken back. */
  async moveTag(uuid, to, from = []) {
    const tag = sure(uuid), low = one => String(one).toLowerCase();
    let under = to ? sure(to) : '', off = from.filter(was => was !== to).map(sure);
    try {
      const now = new Set((await G.read.q(`[:find ?u :where [?t :block/uuid #uuid "${tag}"] [?t :logseq.property.class/extends ?p] [?p :block/uuid ?u]]`)).map(([u]) => low(u)));
      if (now.size) { if (under && now.has(low(under))) under = ''; off = off.filter(was => now.has(low(was))); }   // nothing read: nothing known, every write asked for is made
    } catch (error) { /* then every write asked for is made, as before */ }
    return whole(async did => {
      let steps = 0;
      if (under) { await did(logseq.Editor.addTagExtends(tag, under)); steps++; }
      for (const was of off) { await did(logseq.Editor.removeTagExtends(tag, was)); steps++; }
      return steps;
    });
  },
  /* A page of the person's own by this name, made if there is none, with one of the person's tags when one is given; answers
     its uuid. A name that already has a page answers that page. Where the tag is refused, the refusal says that the page was
     made and carries the one step of Undo that takes it away. */
  async newPage(name, tag = '') {
    const title = String(name || '').trim(), tagged = tag ? sure(tag) : '';
    if (!title) throw no('a page needs a name');
    const fresh = await logseq.Editor.createPage(title, {}, { redirect: false }), made = fresh || await logseq.Editor.getPage(title);
    if (!made?.uuid) throw no(`Logseq did not make “${title}”`);
    if (tagged) {
      try { await logseq.Editor.addBlockTag(String(made.uuid), tagged); }
      catch (error) { if (fresh && error && typeof error === 'object') { error.steps = 1; error.left = `The page “${title}” was made all the same, without the tag.`; } throw error; }
    }
    return String(made.uuid);
  },
  /* A new bullet that points at a node through a property, with a tag when one is given; answers { uuid, steps }, steps being
     how many of Logseq's Undos take it away again. words: what it says (none: an empty bullet); page: the page it goes to the
     end of (none: today's journal). */
  async addNode(tag, ident, id, { words = '', page = '' } = {}) {
    if (!MINE.test(String(ident)) || !Number.isSafeInteger(id) || id <= 0) throw new Error('a new node points at a node of the graph through one of your properties');
    const tagged = tag ? sure(tag) : '';
    const to = page ? sure(page) : await G.read.journal(G.days.number(new Date())) || String((await logseq.Editor.createJournalPage(new Date()))?.uuid || '');
    if (!UUID.test(to)) throw no('today’s journal could not be found');
    let made = '';
    // Refused at its tag or its value, the bullet is taken away again (Undo; then deleted, should it still stand): it was made
    // a moment ago by this write and holds nothing of the person's but the words they typed, which the + line keeps.
    return adding(() => whole(async did => {
      made = String((await logseq.Editor.appendBlockInPage(to, String(words || '')))?.uuid || '');
      if (!UUID.test(made)) throw no('Logseq did not make the new bullet');
      await did();   // counted only once the bullet is known to stand: a step counted for nothing would take back a change of the person's
      if (tagged) await did(logseq.Editor.addBlockTag(made, tagged));
      await did(logseq.Editor.upsertBlockProperty(made, ident, id, { entityId: true }));
      return { uuid: made, steps: tagged ? 3 : 2 };
    }, async () => { if (UUID.test(made) && await G.read.node(made)) await logseq.Editor.removeBlock(made); }));
  },
  async setWords(uuid, words, { asRead = false } = {}) {
    const at = sure(uuid), text = String(words ?? '');
    return logseq.Editor.updateBlock(at, asRead ? await G.read.asKept(at, text) : text);
  },
  async addBullet(at, words, { under = false, page = false } = {}) {
    const text = String(words ?? '');
    const made = await adding(() => page ? logseq.Editor.appendBlockInPage(sure(at), text) : logseq.Editor.insertBlock(sure(at), text, { sibling: !under }));
    return String(made?.uuid || '');
  },
  /* A file into the graph. Logseq's plugin API has no call that makes a file's node; its own editor makes one when a file is
     pasted into an empty bullet (ground/touch.js fileInto), in one write: the file is copied into the assets folder and the
     bullet becomes the file's node. So: an empty bullet (one step of Undo), then the paste (one more). Everything that can be
     known to fail is asked first, so a refusal leaves nothing: Logseq takes no file whose checksum the graph holds, none
     without an ending, none over 100 MB. Refused after the bullet was made and before the paste, the bullet is deleted by its
     own id, and only while it is still empty. Once the file was pasted and Logseq has not made the node in time, the bullet
     stays and the refusal says so: Logseq may only be slow, and a file landing a moment later then has its bullet (the
     plugin before the rebuild learned this on 10 November 2026: with the bullet removed the copied file was left with
     nothing pointing at it). The bullet the person is writing in is set down first and opened again after, as for every
     write that adds a bullet, and the file is pasted only into the bullet made here (fileInto sees to that). */
  async addFile(at, file, { under = false } = {}) {
    const to = sure(at), name = String(file?.name || 'The file');
    if (!file?.bytes || !file.sum) throw no(`${name} could not be read`);
    if (!file.type) throw no(`${name} has no ending (like .pdf), and Logseq takes no file without one`);
    if (file.size > 100 * 1024 * 1024) throw no(`${name} is larger than 100 MB, the most Logseq takes`);
    const twin = await G.read.fileTwin(file);
    if (twin) throw no(`${name} is already in the graph, as “${few(twin.title)}”${twin.gone ? ', on a page in the Recycle' : ''}`);
    return adding(async () => {
      const made = String((under ? await logseq.Editor.insertBlock(to, '', { sibling: false }) : await logseq.Editor.appendBlockInPage(to, ''))?.uuid || '').toLowerCase();
      if (!UUID.test(made)) throw no(`a bullet for ${name} could not be added`);
      const empty = async () => { const words = await G.read.typed(made).catch(() => null); return words != null && !words.trim(); };
      let node = null;
      try { node = await G.touch.fileInto(made, file, { show: to, taken: () => G.read.fileTwin(file).then(found => (found && !found.gone ? found : null)), patience: 30000 + Math.round(file.size / 5000) }); }
      catch (error) { if (await empty()) await logseq.Editor.removeBlock(made).catch(() => {}); throw error; }
      if (!node) throw no(`Logseq has not taken ${name} yet`, 'Its empty bullet stays on the page for when it does; delete the bullet if the file does not come.');
      // Logseq makes the empty bullet itself the file's node. Had words reached the bullet meanwhile, the node stands after it.
      if (node.uuid !== made && await empty()) { await logseq.Editor.removeBlock(made); return { uuid: node.uuid, steps: 3 }; }
      return { uuid: node.uuid, steps: 2 };
    });
  },
  // Set in as Logseq's Tab does: the last bullet under the one before it.
  async moveIn(uuid) {
    const before = await logseq.Editor.getPreviousSiblingBlock(sure(uuid));
    if (!before?.uuid) return 0;
    const last = ((await logseq.Editor.getBlock(before.uuid, { includeChildren: true }))?.children || []).filter(one => one && one.uuid).sort((a, b) => (String(a.order || '') < String(b.order || '') ? -1 : 1)).pop();
    if (last) await logseq.Editor.moveBlock(uuid, last.uuid, { before: false });
    else await logseq.Editor.moveBlock(uuid, before.uuid, { children: true });
    return 1;
  },
  // Set out as Logseq's Shift-Tab does: the bullet after the one it sat under.
  async moveOut(uuid) {
    const block = await logseq.Editor.getBlock(sure(uuid)), above = block?.parent?.id && block.parent.id !== block.page?.id ? await logseq.Editor.getBlock(block.parent.id) : null;
    if (!above?.uuid) return 0;
    await logseq.Editor.moveBlock(uuid, above.uuid, { before: false });
    return 1;
  },
  // Old names, kept until the places that call them are changed: one value is setNode (a node, a day, a set choice) or setText.
  setValue: (uuid, ident, raw, { ref = false } = {}) => ref ? G.write.setNode(uuid, ident, raw) : G.write.setText(uuid, ident, raw),
  clearValue: (uuid, ident) => G.write.clear(uuid, ident),
  async day(day) {
    if (!G.days.valid(day)) throw no('that is not a day');
    const found = await G.read.journal(day);
    if (found) return found;
    const made = await logseq.Editor.createJournalPage(new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100));
    if (!UUID.test(String(made?.uuid || ''))) throw no('that day’s journal could not be made');
    return String(made.uuid);
  },
  placeTag: (uuid, under) => logseq.Editor.addTagExtends(sure(uuid), sure(under)),
  // Logseq refuses a name another tag or property already has, and says so: the refusal is the answer.
  rename(uuid, name) { const title = String(name || '').trim(); if (!title) throw no('a name is needed'); return logseq.Editor.renamePage(sure(uuid), title); },
  /* Logseq's own calls for a tag's properties (addTagProperty, removeTagProperty) take only a plugin's tags ("Not a valid
     tag"), so the list is written whole, with { reset: true }: without it Logseq adds the list to what the tag gives, and a
     property taken off stays on (tried in Logseq 2.0.2, 27 November 2026; with reset it is one step of Undo). */
  tagProperties(uuid, ids) { if (!ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('a tag is given properties by their ids'); if (!ids.length) return logseq.Editor.removeBlockProperty(sure(uuid), 'logseq.property.class/properties'); return logseq.Editor.upsertBlockProperty(sure(uuid), 'logseq.property.class/properties', ids, { entityId: true, reset: true }); },
  range(uuid, ids) { if (!ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('a property takes tags by their ids'); return logseq.Editor.setPropertyNodeTags(sure(uuid), ids); },
  toPage: (uuid, page) => logseq.Editor.moveBlock(sure(uuid), sure(page), { children: true }),
  // A new, empty line at the end of what a node keeps under it; answers its uuid.
  async addLine(uuid, isPage) { const made = await adding(() => isPage ? logseq.Editor.appendBlockInPage(sure(uuid), '') : logseq.Editor.insertBlock(sure(uuid), '', { sibling: false })); return String(made?.uuid || ''); },
  // Logseq's Recycle: what lies in it brought back, or deleted for good (which nothing takes back). The plugin API's own two
  // calls (tried on a deleted page in Logseq 2.0.2, 27 November 2026: each answered true and did it).
  restore: uuid => logseq.Editor.restorePage(sure(uuid)),
  deleteForGood: uuid => logseq.Editor.deleteRecycledPagePermanently(sure(uuid)),
  /* Words, a number or yes/no written under one of the person's properties. Words written over the one value in words a node
     holds, where that value has bullets under it, change the value's own words as writing in it does: the bullets stay (tried
     in Logseq 2.0.2, 27 November 2026; a plain write would make a new value and leave the old one, with them, out of reach). */
  async setText(uuid, ident, value) {
    if (!MINE.test(String(ident))) throw new Error('a value is written under one of your properties');
    const at = sure(uuid);
    if (typeof value === 'string') { const { words } = await G.read.under(at, ident); if (words.length === 1 && words[0].under) return logseq.Editor.updateBlock(words[0].uuid, value); }
    return logseq.Editor.upsertBlockProperty(at, ident, value);
  },
  // A day written under a date property: the day's journal page, made when the graph has none yet.
  async setDay(uuid, ident, day) {
    if (!G.days.valid(day)) throw no('that is not a day');
    const page = await G.read.journal(day) || String((await logseq.Editor.createJournalPage(new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100)))?.uuid || '');
    const node = await G.read.node(page);
    if (!node) throw no('the day’s journal could not be found');
    return G.write.setNode(uuid, ident, node.id);
  },
  // Everything a node holds under a property taken off.
  clear(uuid, ident) {
    if (!MINE.test(String(ident))) throw new Error('only one of your properties is cleared');
    return logseq.Editor.removeBlockProperty(sure(uuid), ident);
  },
  /* The one way to say a refusal (the owner, 24 November 2026, of Logseq's own error words in a notice: "what is this"): what
     was not done, why in everyday words, what to do. */
  refused(what, error, then = '', { quiet = false } = {}) {
    const words = [`${String(what).replace(/[\s.:]+$/, '')}: ${why(error)}.`, error?.left, error?.then, then].filter(Boolean).join(' ');
    if (!quiet) G.say(words, 'warning');
    return words;
  },
  undo: () => logseq.App.invokeExternalCommand('logseq.editor/undo'),
};
})();
