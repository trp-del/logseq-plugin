/* node test/apply.test.js
   Apply and its one Undo (logseq/apply.js) against a stand-in of the graph's writes (8 November 2026, the data-safety fixes):
   Undo leaves alone a node changed after Apply, and a page or tag Apply made that has been written on since; a merge moves the
   bullets on the merged tag's page to the kept tag's page, and Undo moves them back.
   Since 16 November 2026 also the record (logseq/records.js): an Apply's way back read from disk after a restart puts back
   what it wrote, a run cut off halfway is found and put back from the Log, a later change to the same tags is undone first,
   and a record older than 30 days is dropped. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { Structure: {} };
const S = window.Structure;
// The stand-in: what each node holds, the pages made and what is written on them, the bullets on each page.
const held = new Map(), touched = new Set(), bulletsOn = new Map(), deleted = [], log = [];
const key = (uuid, ident) => `${uuid}|${ident}`;
S.values = { family: () => 'text', convert: (from, into, v) => ({ text: v.title }) };
S.db = {
  propValues: async ident => new Map([...held].filter(([k]) => k.endsWith('|' + ident)).map(([k, list]) => [Number(k.split('|')[0].replace('n', '')), list.map(t => ({ title: t }))])),
  choicesOf: async () => new Map(),
  uuidOfNode: async id => 'n' + id,
  putValues: async (node, ident, list) => { log.push(['put', node, ident, list.map(v => v.text ?? v.title)]); held.set(key(node, ident), list.map(v => v.text ?? v.title)); },
  stamp: async (uuid, ident) => ident === 'block/title' ? JSON.stringify(words.get(uuid) ?? null) : JSON.stringify(held.get(key(uuid, ident)) || []),
  pageNamed: async name => ({ id: 900, made: 'page-' + name }),
  dayPage: async () => ({ id: 901 }),
  untouched: async uuid => !touched.has(uuid),
  deleteTag: async uuid => { deleted.push(uuid); },
  makeTag: async title => ({ uuid: 'tag-' + title, id: 800 }),
  addExtends: async () => {},
  pageBullets: async uuid => [...(bulletsOn.get(uuid) || [])],
  moveBullets: async (uuids, to) => { for (const [page, list] of bulletsOn) bulletsOn.set(page, list.filter(u => !uuids.includes(u))); bulletsOn.set(to, [...(bulletsOn.get(to) || []), ...uuids]); },
};
// The record's storage on this Mac (logseq.FileStorage), as a map of file names to text; `files` survives a "restart".
const files = new Map();
S.recordStore = { getItem: async k => files.get(k) ?? null, setItem: async (k, v) => { files.set(k, String(v)); }, removeItem: async k => { files.delete(k); } };
// What a tag holds, for a merge: the nodes carrying each tag, the tags that exist.
const words = new Map(), tagged = new Map(), tags = new Map([['visit', 501], ['consult', 502]]);
Object.assign(S.db, {
  nodeUuids: async id => [...tagged].filter(([, set]) => [...set].some(u => tags.get(u) === id)).map(([n]) => n),
  addTag: async (node, uuid) => { tagged.set(node, new Set([...(tagged.get(node) || []), uuid])); },
  removeTag: async (node, uuid) => { const set = tagged.get(node); if (set) set.delete(uuid); },
  valueRefs: async () => [], valueIds: async () => [], setValues: async () => {},
  // Bullets' words: uuid -> words; a link to a tag is [[uuid]], a tag written in words #[[uuid]].
  wordRefs: async (id, uuid) => [...words].filter(([, w]) => w.includes(uuid)).map(([node, w]) => ({ uuid: node, words: w })),
  setWords: async (node, w) => { words.set(node, w); },
  titleOf: async uuid => uuid === 'visit-again' ? 'Visit' : null,
  tagIdByUuid: async uuid => tags.get(uuid) || null,
  remakeTag: async title => { const uuid = title.toLowerCase() + '-again'; tags.set(uuid, 600); return { uuid, id: 600 }; },
  addClassProp: async () => {}, removeExtends: async () => {}, rangeIds: async () => [], setRange: async () => {},
});
const realDelete = S.db.deleteTag;
S.db.deleteTag = async uuid => { tags.delete(uuid); return realDelete(uuid); };
eval(fs.readFileSync(path.join(__dirname, '../logseq/records.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../logseq/apply.js'), 'utf8'));
const { apply } = S.apply;

(async () => {
  // Values moved from one property into another: Undo puts back the node left as Apply left it, and leaves the node changed since.
  held.set(key('n1', 'from'), ['tired']); held.set(key('n2', 'from'), ['dizzy']);
  const move = { op: 'moveValues', from: { ident: 'from', type: 'default' }, into: { ident: 'into', type: 'default', many: true } };
  const done = await apply([move]);
  assert.deepEqual(held.get(key('n1', 'into')), ['tired']); assert.deepEqual(held.get(key('n1', 'from')), []);
  held.set(key('n2', 'into'), ['dizzy', 'written by hand']);   // n2 changed after Apply
  const failures = await done.undo();
  assert.equal(failures.length, 0, 'nothing fails');
  assert.equal(failures.kept, 1, 'one node is counted once as left alone');
  assert.deepEqual(held.get(key('n1', 'from')), ['tired'], 'the node as Apply left it gets its values back');
  assert.deepEqual(held.get(key('n2', 'into')), ['dizzy', 'written by hand'], 'the node changed since keeps what was written by hand');
  console.log('  ok  Undo puts back a node as Apply left it, and leaves a node changed since');

  // A tag Apply made: Undo deletes it only while nothing has been written on it or points at it.
  deleted.length = 0;
  const made = await apply([{ op: 'makeTag', tag: { title: 'Fresh', uuid: '' } }]);
  touched.add('tag-Fresh');
  const left = await made.undo();
  assert.equal(left.kept, 1); assert.deepEqual(deleted, [], 'a tag written on since stays');
  touched.delete('tag-Fresh');
  const again = await apply([{ op: 'makeTag', tag: { title: 'Fresh', uuid: '' } }]);
  await again.undo();
  assert.deepEqual(deleted, ['tag-Fresh'], 'an untouched tag Apply made goes again');
  console.log('  ok  a tag Apply made goes with Undo only while untouched');

  // A merge's bullets: moved to the kept tag's page, after what it holds, and moved back by Undo (to the tag put back).
  bulletsOn.set('gone', ['b1', 'b2']); bulletsOn.set('kept', ['k1']);
  const from = { uuid: 'gone', title: 'Gone' }, into = { uuid: 'kept', title: 'Kept' };
  const merged = await apply([{ op: 'moveBullets', from, into }]);
  assert.deepEqual(bulletsOn.get('kept'), ['k1', 'b1', 'b2'], 'the bullets follow the kept tag\'s own, in their order');
  assert.deepEqual(bulletsOn.get('gone'), []);
  from.uuid = 'gone-again';   // the tag deleted and made again by the deletion's own inverse, under a new uuid
  await merged.undo();
  assert.deepEqual(bulletsOn.get('gone-again'), ['b1', 'b2'], 'Undo moves them back onto the tag put back');
  assert.deepEqual(bulletsOn.get('kept'), ['k1']);
  console.log('  ok  a merge moves the bullets on the merged tag\'s page, and Undo moves them back');

  // A merge written to disk, then Logseq "restarts": the Undo is read back from the files alone and puts every node back.
  const R = S.records, G = 'logseq_db_Illness Test Graph';
  tagged.set('n10', new Set(['visit'])); tagged.set('n11', new Set(['visit'])); tagged.set('n12', new Set(['visit', 'consult']));
  const visit = { id: 501, uuid: 'visit', title: 'Visit' }, consult = { id: 502, uuid: 'consult', title: 'Consultation' };
  const mergePlan = [{ op: 'deleteTag', tag: visit, into: consult, restore: { title: 'Visit', parents: [], props: [{ id: 7 }], ranges: [] } }];
  const rec = R.make({ graph: G, text: 'Merge Visit into Consultation' });
  await apply(mergePlan, async () => true, rec);
  assert.deepEqual([...tagged.get('n10')], ['consult'], 'a node of the merged tag carries the kept tag');
  assert.ok(!tags.has('visit'), 'the merged tag is gone');
  const [head] = await R.list(G);
  assert.equal(head.state, 'done'); assert.ok(head.left > 0, 'the record holds its way back');
  const back = await R.load(G, head);   // nothing from memory: the record as read from the files
  const lost = await S.apply.putBack(back, async () => true);
  assert.equal(lost.length, 0);
  assert.deepEqual([...tagged.get('n10')], ['visit-again'], 'read from disk, Undo gives the node the tag back, not the kept one');
  assert.deepEqual([...tagged.get('n12')].sort(), ['consult', 'visit-again'], 'a node that had both keeps both');
  assert.equal((await R.list(G))[0].state, 'undone', 'the Log says it was undone');
  console.log('  ok  a merge is undone from its record on disk, as after a restart');

  // Links written in bullets follow the merge to the kept tag, and come back to the tag put back by Undo.
  tags.set('visit', 501); tagged.set('n30', new Set(['visit']));
  words.set('w1', 'Saw her today #[[visit]] about the cough'); words.set('w2', 'see [[visit]] notes'); words.set('w3', 'nothing here');
  const visit2 = { id: 501, uuid: 'visit', title: 'Visit' };
  const linkRec = R.make({ graph: G, text: 'Merge Visit into Consultation' });
  await apply([{ op: 'deleteTag', tag: visit2, into: consult, restore: { title: 'Visit', parents: [], props: [], ranges: [] } }], async () => true, linkRec);
  assert.equal(words.get('w1'), 'Saw her today #Consultation about the cough', 'a tag in words is handed over by name');
  assert.equal(words.get('w2'), 'see [[consult]] notes', 'a link in words points at the kept tag');
  assert.equal(words.get('w3'), 'nothing here');
  words.set('w2', 'see [[consult]] notes, and more written since');
  const linkBack = await R.load(G, (await R.list(G)).find(h => h.id === linkRec.id));
  const kept = await S.apply.putBack(linkBack, async () => true);
  assert.equal(words.get('w1'), 'Saw her today #Visit about the cough', 'Undo hands the tag put back over by its name');
  assert.equal(words.get('w2'), 'see [[consult]] notes, and more written since', 'words written since the merge stay');
  assert.equal(kept.kept, 1);
  console.log('  ok  links written in bullets follow a merge, and Undo points them back');

  // Cut off: Logseq quits after the first step. The next start finds the record halfway and calls it cut; its Undo puts back.
  held.set(key('n20', 'from'), ['pale']);
  const cutRec = R.make({ graph: G, text: 'Move Pale' });
  cutRec.state = 'writing'; cutRec.of = 2; await cutRec.flush();
  await S.apply.runStep({ op: 'moveValues', from: { ident: 'from', type: 'default' }, into: { ident: 'into', type: 'default', many: true } }, cutRec);
  assert.deepEqual(held.get(key('n20', 'into')), ['pale']);
  const afterStart = await R.list(G);
  const cutHead = afterStart.find(h => h.id === cutRec.id);
  assert.equal(cutHead.state, 'cut', 'a run left writing is found cut off');
  assert.equal((await R.list(G, new Set([cutRec.id]))).find(h => h.id === cutRec.id).state, 'cut');
  await S.apply.putBack(await R.load(G, cutHead), async () => true);
  assert.deepEqual(held.get(key('n20', 'from')), ['pale'], 'the cut-off write is put back');
  console.log('  ok  a run cut off halfway is found at start and put back from its record');

  // A later change to the same tag is undone first.
  const a = { id: 1, at: 1000, text: 'Merge Visit into Consultation', state: 'done', left: 4, touches: ['consult', 'visit'] };
  const b = { id: 2, at: 2000, text: 'Rename Consultation', state: 'done', left: 1, touches: ['consult'] };
  const c = { id: 3, at: 3000, text: 'Move Symptom', state: 'done', left: 1, touches: ['symptom'] };
  assert.equal(R.laterOver([c, b, a], a), b, 'the later change of the same tag stands first');
  assert.equal(R.laterOver([c, { ...b, state: 'undone' }, a], a), null, 'once that one is undone, this one can be');
  console.log('  ok  a later change to the same tags is undone first');

  // Thirty days: an older record goes, with its files.
  const old = R.make({ graph: G, text: 'Long ago' }); old.at = Date.now() - 31 * 24 * 3600 * 1000; old.state = 'done';
  old.add({ do: 'unmake', uuid: 'x' }); await old.flush();
  assert.ok([...files.keys()].some(k => k.includes(old.id)));
  assert.ok(!(await R.list(G)).some(h => h.id === old.id), 'a record of 31 days ago is not listed');
  assert.ok(![...files.keys()].some(k => k.includes(old.id)), 'and its files are gone');
  console.log('  ok  a record older than 30 days is dropped with its files');

  // Words turned into dates: a property made, filled with what reads as a date, the names swapped; undone from disk, all of it
  // goes back, the made property taken away (16 November 2026).
  const props = new Map([['p-date', 'Date seen']]), dropped = [], classes = new Map([['visit', ['p-date']]]);
  Object.assign(S.db, {
    makeProp: async (title, type, many) => { props.set('p-new', title); return { uuid: 'p-new', ident: 'new', id: 777, made: true }; },
    dropProp: async made => { dropped.push(made.uuid); props.delete(made.uuid); return true; },
    rename: async (uuid, name) => { props.set(uuid, name); },
    addClassProp: async (tagUuid, id) => { classes.set(tagUuid, [...(classes.get(tagUuid) || []), id]); },
    removeClassProp: async (tagUuid, id) => { classes.set(tagUuid, (classes.get(tagUuid) || []).filter(x => x !== id)); },
  });
  const titleOfWas = S.db.titleOf; S.db.titleOf = async uuid => props.get(uuid) ?? titleOfWas(uuid);
  const convertWas = S.values.convert; S.values.convert = (from, into, v) => /\d{4}/.test(v.title) ? { text: 'day:' + v.title } : null;
  held.set(key('n40', 'date'), ['14 Oct 2026']); held.set(key('n41', 'date'), ['last Tuesday']);
  const Fh = { id: 50, uuid: 'p-date', ident: 'date', title: 'Date seen' }, Nh = { id: -9, uuid: '', ident: '', title: 'Date seen (dates)' }, vt = { id: 1, uuid: 'visit', title: 'Visit' };
  const rtRec = R.make({ graph: G, text: 'Turn Date seen into dates' });
  await apply([{ op: 'makeProp', prop: Nh, type: 'date', many: false }, { op: 'addClassProp', tag: vt, prop: Nh },
    { op: 'moveValues', from: { ...Fh, type: 'default' }, into: { h: Nh, type: 'date', many: false } },
    { op: 'rename', prop: Fh, name: 'Date seen, as written', was: 'Date seen' }, { op: 'rename', prop: Nh, name: 'Date seen', was: 'Date seen (dates)' }], async () => true, rtRec);
  assert.deepEqual(held.get(key('n40', 'new')), ['day:14 Oct 2026'], 'a date read from the words is in the new property');
  assert.deepEqual(held.get(key('n41', 'date')), ['last Tuesday'], 'words that are no date stay where they were');
  assert.equal(props.get('p-new'), 'Date seen'); assert.equal(props.get('p-date'), 'Date seen, as written');
  const rtBack = await R.load(G, (await R.list(G)).find(h => h.id === rtRec.id));
  const rtLost = await S.apply.putBack(rtBack, async () => true);
  assert.equal(rtLost.length, 0, 'every step goes back');
  assert.deepEqual(held.get(key('n40', 'date')), ['14 Oct 2026'], 'the words are back'); assert.deepEqual(held.get(key('n40', 'new')), []);
  assert.equal(props.get('p-date'), 'Date seen', 'the old name is back'); assert.deepEqual(dropped, ['p-new'], 'the property made is taken away');
  assert.deepEqual(classes.get('visit'), ['p-date']);
  S.values.convert = convertWas; S.db.titleOf = titleOfWas;
  console.log('  ok  words turned into dates, and Undo from disk puts every piece back');
  // One tag's move (moveForTag): only the nodes holding that tag (or one beneath it) move; another tag's node keeps its value; Undo puts them back.
  held.set(key('n70', 'charged'), ['Comcast']); held.set(key('n71', 'charged'), ['Verizon']);
  S.db.nodesTagged = async ids => new Set(ids.includes(31) ? [70] : []);
  const one = await apply([{ op: 'moveValues', from: { ident: 'charged', type: 'node' }, into: { ident: 'services', type: 'node', many: false }, onTags: [{ id: 31, uuid: 'bills', title: 'Bills' }] }]);
  assert.deepEqual(held.get(key('n70', 'services')), ['Comcast']); assert.deepEqual(held.get(key('n70', 'charged')), []);
  assert.deepEqual(held.get(key('n71', 'charged')), ['Verizon'], 'the other tag\'s node is left as it is'); assert.equal(held.get(key('n71', 'services')), undefined);
  assert.equal((await one.undo()).length, 0);
  assert.deepEqual(held.get(key('n70', 'charged')), ['Comcast']); assert.deepEqual(held.get(key('n70', 'services')), []);
  console.log('  ok  one tag\'s values moved, the other tag\'s left, and Undo puts them back');
  // The picked nodes alone (moveForNodes): a copy leaves the first property as it is; a move empties it on those nodes; Undo puts both back.
  held.set(key('n80', 'charged'), ['Amazon']); held.set(key('n81', 'charged'), ['Netflix']); held.set(key('n82', 'charged'), ['Apple']);
  const copy = await apply([{ op: 'moveValues', from: { ident: 'charged', type: 'node' }, into: { ident: 'provider', type: 'node', many: false }, onNodes: [80, 81], keep: true }]);
  assert.deepEqual(held.get(key('n80', 'provider')), ['Amazon']); assert.deepEqual(held.get(key('n80', 'charged')), ['Amazon'], 'a copy keeps the first value');
  assert.equal(held.get(key('n82', 'provider')), undefined, 'a node not picked is left as it is');
  assert.equal((await copy.undo()).length, 0); assert.deepEqual(held.get(key('n80', 'provider')), []); assert.deepEqual(held.get(key('n80', 'charged')), ['Amazon']);
  const moved81 = await apply([{ op: 'moveValues', from: { ident: 'charged', type: 'node' }, into: { ident: 'provider', type: 'node', many: false }, onNodes: [81], keep: false }]);
  assert.deepEqual(held.get(key('n81', 'provider')), ['Netflix']); assert.deepEqual(held.get(key('n81', 'charged')), []); assert.deepEqual(held.get(key('n80', 'charged')), ['Amazon']);
  assert.equal((await moved81.undo()).length, 0); assert.deepEqual(held.get(key('n81', 'charged')), ['Netflix']);
  console.log('  ok  the picked nodes\' values copied, then moved, and Undo puts them back');
  console.log('apply: every check passed');
})().catch(error => { console.error(error); process.exit(1); });
