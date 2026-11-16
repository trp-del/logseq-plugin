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
  stamp: async (uuid, ident) => JSON.stringify(held.get(key(uuid, ident)) || []),
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
const tagged = new Map(), tags = new Map([['visit', 501], ['consult', 502]]);
Object.assign(S.db, {
  nodeUuids: async id => [...tagged].filter(([, set]) => [...set].some(u => tags.get(u) === id)).map(([n]) => n),
  addTag: async (node, uuid) => { tagged.set(node, new Set([...(tagged.get(node) || []), uuid])); },
  removeTag: async (node, uuid) => { const set = tagged.get(node); if (set) set.delete(uuid); },
  valueRefs: async () => [], valueIds: async () => [], setValues: async () => {},
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
  console.log('apply: every check passed');
})().catch(error => { console.error(error); process.exit(1); });
