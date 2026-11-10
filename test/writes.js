/* node test/writes.js
   The one way the plugin writes to the graph (PluginDoor.write in plugin.js, 10 November 2026), checked as test/library.js checks
   the button library: every write a module makes goes through the door, so the Undo guards and the delete by id cannot be
   stepped round. A write call of Logseq's anywhere else in the running code fails this run and is named with its line.
   Then the door's own writes and guards, against a pretend Logseq. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert');
const ROOT = path.resolve(__dirname, '..');
// Logseq's calls that change the graph. A new one a module needs is added to the door first, then here.
const WRITES = ['addBlockTag', 'removeBlockTag', 'upsertBlockProperty', 'removeBlockProperty', 'updateBlock', 'insertBlock', 'insertBatchBlock', 'appendBlockInPage',
  'prependBlockInPage', 'removeBlock', 'moveBlock', 'createPage', 'createJournalPage', 'deletePage', 'renamePage', 'restorePage', 'deleteRecycledPagePermanently',
  'addTagExtends', 'removeTagExtends', 'addTagProperty', 'removeTagProperty', 'upsertProperty', 'removeProperty', 'createTag', 'setBlockIcon', 'removeBlockIcon'];
const listed = fs.readFileSync(path.join(ROOT, 'files.js'), 'utf8').match(/'[a-z/-]+\.js'/g).map(s => s.slice(1, -1));
const files = [...new Set(['main.js', 'loader.js', ...listed])].filter(f => f !== 'plugin.js' && fs.existsSync(path.join(ROOT, f)));
const call = new RegExp(`\\b(?:Editor|api)\\s*\\.\\s*(${WRITES.join('|')}|${WRITES.map(w => w.replace(/[A-Z]/g, c => '_' + c.toLowerCase())).join('|')})\\b`);
const strays = [];
for (const file of files) {
  // Comments left out, so a call named only in a comment is no write.
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n');
  lines.forEach((line, i) => { const m = call.exec(line.replace(/(^|[\s;{}])\/\/.*$/, '$1')); if (m) strays.push(`${file}:${i + 1}  ${m[0]}`); });
}
if (strays.length) { console.log('FAIL  a write to the graph that does not go through PluginDoor.write:\n  ' + strays.join('\n  ')); process.exit(1); }
console.log(`  ok  every write in ${files.length} files goes through the one door`);

const U = n => `6a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function doorWith(logseq) {
  const win = {}; win.window = win;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plugin.js'), 'utf8'), vm.createContext({ window: win, logseq, console, setTimeout, clearTimeout, encodeURIComponent }), { filename: 'plugin.js' });
  return win.PluginDoor;
}
(async () => {
  // Each plain write reaches the Logseq call it stands for, with what it was given.
  const calls = [], Editor = new Proxy({}, { get: (_, name) => async (...args) => { calls.push([name, ...args]); } });
  const door = doorWith({ Editor, DB: { datascriptQuery: async () => [] } }), W = door.write;
  const pairs = { addTag: 'addBlockTag', removeTag: 'removeBlockTag', setValue: 'upsertBlockProperty', unsetValue: 'removeBlockProperty', setWords: 'updateBlock', insertBlock: 'insertBlock',
    appendBlock: 'appendBlockInPage', removeBlock: 'removeBlock', moveBlock: 'moveBlock', createPage: 'createPage', createJournalPage: 'createJournalPage', renamePage: 'renamePage',
    restorePage: 'restorePage', deleteForGood: 'deleteRecycledPagePermanently', addExtends: 'addTagExtends', removeExtends: 'removeTagExtends' };
  for (const [mine, logseqs] of Object.entries(pairs)) { calls.length = 0; await W[mine]('a', 'b'); assert.deepEqual(calls[0].slice(0, 2), [logseqs, 'a'], `${mine} is Logseq's ${logseqs}`); }
  calls.length = 0; await W.showPage(U(1), 268); assert.deepEqual(calls[0], ['upsertBlockProperty', U(1), 'block/link', 268, { entityId: true }], 'a bullet shows a page by its link, one write');
  calls.length = 0; await W.unshowPage(U(1)); assert.deepEqual(calls[0], ['removeBlockProperty', U(1), 'block/link']);
  console.log('  ok  each write is the Logseq call it stands for');

  // A page is deleted by its id. A name is refused outright: another page could share it.
  await assert.rejects(() => W.deletePage('Dr. Lee'), /by its id/, 'a name is no id');
  await assert.rejects(() => W.deletePage({ title: 'Dr. Lee' }), /by its id/);
  {
    const here = new Set([U(2)]), asked = [];
    const d = doorWith({ Editor: { deletePage: async key => { asked.push(key); here.delete(key); }, getPage: async () => null }, DB: {} });
    const ask = async q => here.has(/#uuid "([^"]+)"/.exec(q)[1]) ? [[1]] : [];
    assert.equal(await d.write.deletePage({ uuid: U(2), title: 'Dr. Lee' }, ask), true); assert.deepEqual(asked, [U(2)], 'asked by the uuid only');
    assert.equal(await d.write.deletePage(U(2), ask), false, 'a page already gone: nothing is asked again'); assert.equal(asked.length, 1);
  }
  console.log('  ok  a page is deleted by its id, and a name alone is refused');

  // A page a change made goes again only while untouched.
  {
    const asked = [], gone = new Set(); let linked = true;
    const d = doorWith({ Editor: { deletePage: async key => { asked.push(key); gone.add(key); }, getPage: async () => null }, DB: {} });
    const ask = async q => /:block\/refs/.test(q) ? (linked ? [[1]] : []) : /deleted-at/.test(q) ? (gone.has(U(4)) ? [] : [[1]]) : [];
    assert.equal(await d.write.dropMade({ uuid: U(4) }, { ask }), false, 'linked to since: it stays'); assert.equal(asked.length, 0);
    linked = false; assert.equal(await d.write.dropMade({ uuid: U(4) }, { ask }), true, 'untouched: it goes'); assert.deepEqual(asked, [U(4)]);
  }
  // A value is put back only while it is as the change left it.
  {
    let held = [5], undone = 0;
    const d = doorWith({ Editor: {}, DB: {} }), ask = async q => /\?v :block\/title|:logseq.property\/value/.test(q) ? [] : held.map(v => [v]);
    const undo = await d.write.guarded([[U(5), 'user.property/provider']], async () => { undone++; }, ask);
    held = [6]; assert.equal(await undo(), 'kept', 'changed since: Undo leaves it'); assert.equal(undone, 0);
    const d2 = await d.write.guarded([[U(5), 'user.property/provider']], async () => { undone++; }, ask);
    await d2(); assert.equal(undone, 1, 'as the change left it: Undo runs');
  }
  console.log('  ok  the Undo guards: a made page that is linked to stays, a value changed since stays');
  console.log('writes: all checks passed');
})().catch(error => { console.error('FAIL  ' + (error.message || error)); process.exit(1); });
