/* node test/helpers.js
   The small things every module needs to read the graph, kept once on the door (plugin.js, 10 November 2026; until then each
   module copied them): the id pattern, an ident without its colon, an attribute of a pulled map, a node's number, a query that
   always gives a list, the Apple helper's address. A copy anywhere else in the running code fails this run and is named with
   its line. Then each helper itself. */
const assert = require('node:assert/strict');
const { files, strays, fail, doorWith } = require('./ground.js');
const pure = file => !/^(?:predictive|export|structure)\/core\//.test(file);   // code that runs in Node without the door keeps its own

const RULES = [
  [/\/\^\[0-9a-f\]\{8\}/, 'the id pattern written out again (use PluginDoor.UUID)'],
  [/\.replace\(\/\^:\/, ''\)/, 'a leading colon stripped by hand (use PluginDoor.bare)'],
  [/Array\.isArray\(rows\) \? rows : \[\]/, 'a query wrapped again to give a list (use PluginDoor.query)'],
  [/\?\.\[':' \+ name\] \?\? /, 'a pulled map’s attribute read by a copy of pick (use PluginDoor.pick)'],
  [/typeof \w+ === 'number' \? \w+ : pick\(/, 'a node’s number read by a copy of idOf (use PluginDoor.idOf)'],
  [/Number\.isSafeInteger\(id\) && id > 0;/, 'isEntityId written again (use PluginDoor.isEntityId)'],
  [/127\.0\.0\.1:47615/, 'the Apple helper’s address written again (use PluginDoor.HELPER)'],
  [/\bHELPER\s*\+|fetch\([^)]*\/(?:status|fill|meaning|names|reads-back)\b/, 'the Apple helper asked by lines of a file’s own (use PluginDoor.helper.status and .post)'],
];
for (const [pattern, what] of RULES) { const found = strays(pattern, { only: pure }); if (found.length) fail(what, found); }
console.log(`  ok  no file of ${files.length} keeps a copy of the shared helpers`);

// What the door hands back is made in its own context, so lists are compared by what they hold.
const same = (got, want, why) => assert.equal(JSON.stringify(got), JSON.stringify(want), why);
(async () => {
  const asked = [];
  const D = doorWith({ DB: { datascriptQuery: async q => { asked.push(q); return q === 'none' ? null : [[1]]; } } });
  assert.ok(D.UUID.test('6a000000-0000-4000-8000-000000000001')); assert.ok(!D.UUID.test('Dr. Lee')); assert.ok(!D.UUID.test('6a000000-0000-4000-8000-000000000001 '));
  assert.equal(D.bare(':user.property/provider'), 'user.property/provider'); assert.equal(D.bare('block/title'), 'block/title'); assert.equal(D.bare(null), '');
  assert.equal(D.pick({ 'block/title': 'a' }, 'block/title'), 'a'); assert.equal(D.pick({ ':block/title': 'b' }, 'block/title'), 'b'); assert.equal(D.pick({ title: 'c' }, 'block/title'), 'c'); assert.equal(D.pick(null, 'block/title'), undefined);
  assert.equal(D.idOf(12), 12); assert.equal(D.idOf({ id: 13 }), 13); assert.equal(D.idOf({ 'db/id': 14 }), 14); assert.equal(D.idOf({ ':db/id': 15 }), 15); assert.equal(D.idOf(null), undefined);
  same(D.listOf(null), []); same(D.listOf(3), [3]); same(D.listOf([3, 4]), [3, 4]);
  same(await D.query('some'), [[1]]); same(await D.query('none'), [], 'a query that gives nothing gives an empty list');
  assert.equal(D.isEntityId(5), true); assert.equal(D.isEntityId(0), false); assert.equal(D.isEntityId('5'), false); assert.equal(D.isEntityId(1.5), false);
  // Lists written into a query let in only whole numbers and well-formed ids, each once.
  assert.equal(D.idsIn('?b', [3, 3, 'x', -1, 4]), '[(identity [3 4]) [?b ...]]');
  assert.equal(D.uuidsIn('?u', ['6a000000-0000-4000-8000-000000000001', '"] [?e :block/title ?t] ;', '6a000000-0000-4000-8000-000000000001']), '[(identity [#uuid "6a000000-0000-4000-8000-000000000001"]) [?u ...]]');
  assert.match(D.HELPER, /^http:\/\/127\.0\.0\.1:\d+$/, 'the helper answers on this Mac only');
  console.log('  ok  each helper reads what it should, and a list in a query lets in only numbers and ids');
  // The one way to ask Apple's helper: its address, the question as JSON (words already made go as they are), a wait that ends.
  { const sent = []; const H = doorWith({}, null, { fetch: async (url, o) => { sent.push([url, o.method || 'GET', o.body, !!o.signal]); return { json: async () => ({ ready: true }) }; }, AbortSignal }).helper;
    assert.equal(H.can(), true); assert.equal(doorWith({}).helper.can(), false, 'a window with no fetch cannot ask');
    same(await H.status(), { ready: true }); same(await H.post('/names', { texts: ['a'] }), { ready: true }); await H.post('/fill', '{"a":1}', { wait: 50, signal: new AbortController().signal });
    same(sent, [['http://127.0.0.1:47615/status', 'GET', undefined, true], ['http://127.0.0.1:47615/names', 'POST', '{"texts":["a"]}', true], ['http://127.0.0.1:47615/fill', 'POST', '{"a":1}', true]]);
    console.log('  ok  the helper is asked one way'); }
  // A web address in words: bare or as Markdown, a sentence's full stop left outside, and drawn as lk-url with its address.
  same(D.webParts('see https://nih.gov/a. and [the trial](https://ct.gov/x?y=1) done'), [{ text: 'see ' }, { text: 'https://nih.gov/a', url: 'https://nih.gov/a' }, { text: '. and ' }, { text: 'the trial', url: 'https://ct.gov/x?y=1' }, { text: ' done' }], 'web addresses cut out of the words');
  same(D.webParts('no address'), [{ text: 'no address' }]); same(D.webParts(''), [{ text: '' }]);
  assert.equal(D.urlHtml('https://a.b/"x', 'a.b'), '<span class="lk-url" data-open-url="https://a.b/&quot;x" title="https://a.b/&quot;x">a.b</span>');
  console.log('  ok  a web address is cut out of words and drawn as lk-url');
  console.log('helpers: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.stack || error)); process.exit(1); });
