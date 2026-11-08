/* node test/apply.test.js
   Apply and its one Undo (logseq/apply.js) against a stand-in of the graph's writes (8 November 2026, the data-safety fixes):
   Undo leaves alone a node changed after Apply, and a page or tag Apply made that has been written on since; a merge moves the
   bullets on the merged tag's page to the kept tag's page, and Undo moves them back. */
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
  console.log('apply: every check passed');
})().catch(error => { console.error(error); process.exit(1); });
