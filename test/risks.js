/* node test/risks.js   (needs jsdom: NODE_PATH, see README)
   The data-safety fixes of 10 November 2026 (reports/changes-to-make.md, items 1 to 7; found by the code review of 9 November,
   reports/code-review-part2.md, "Spots that could lose or spoil data"), each tried against a stand-in. Until the fixes these
   were tracked as open risks; now each is an ordinary check, and the run fails when one comes back.
     1. A big change keeps its own Undo: a change of one thing (Predictive filling a value) no longer takes away the arrow of a
        change of many things (Structure's Apply); only the next change of many things does.
     2. Look's × on a title row leaves the faded Undo arrow, by the pointer and by the keyboard, and the arrow puts the tag back.
     3. "Show a page here" (Predictive, Cmd-;) never writes the bullet's words: one write shows the page, and Undo takes it off.
     4. A page the plugin made is deleted by its id: where another page shares the name, that other page is never the one to go.
     5. A page Threads made is kept once anything links to it (the door's one rule; the press itself is tried in
        threads/tools/two-way-rows-test.js).
     6. The Predictive lessons page: a read that fails writes nothing, so no lesson is written twice; and a page brought back
        out of the Recycle keeps the lines you wrote on it.
     7. A file from outside that Logseq takes slowly keeps its bullet: tried in test/outside.js, with the rest of that door. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let standIn; try { standIn = require('../look/test/stand-in.js'); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const code = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const U = n => `6a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// The door (plugin.js) in a bare context, with a pretend Logseq: enough for its writes and its guards.
function doorWith(logseq) {
  const win = {}; win.window = win;
  const context = vm.createContext({ window: win, logseq, console, setTimeout, clearTimeout, encodeURIComponent });
  vm.runInContext(code('plugin.js'), context, { filename: 'plugin.js' });
  return { win, context, door: win.PluginDoor };
}

const CHECKS = [
  ['1. a big change keeps its own Undo', async () => {
    const r = await standIn.load(); await sleep(200);
    const undo = r.door.undo, at = () => r.doc.body;
    undo.offer({ owner: 'structure', key: 'structure', at: () => null, text: 'Merged 20 tags', run: async () => {}, many: true, docks: false });
    undo.offer({ owner: 'predictive', key: 'fill', at, text: 'Filled Provider', run: async () => {} });
    undo.offer({ owner: 'predictive', key: 'fill-2', at, text: 'Filled Topic', run: async () => {} });
    if (!undo.has('structure')) return 'a change of one thing took the big change\'s Undo';
    if (undo.has('fill') || !undo.has('fill-2')) return 'a change of one thing should take the place of the last change of one thing';
    if (r.doc.querySelector('.lk-undo-dock [data-lk-undo="structure"]')) return 'Structure\'s arrow must not wait at the bottom right while its line is out of sight';
    undo.offer({ owner: 'threads', key: 'pick', at, text: 'Tagged 3 nodes', run: async () => {}, many: true });
    if (undo.has('structure') || !undo.has('pick') || !undo.has('fill-2')) return 'the next change of many things should take the big change\'s place, and only that';
    undo.clear();
  }],
  ['2. Look\'s × leaves the Undo arrow, by pointer and by key', async () => {
    for (const way of ['click', 'Enter']) {
      const r = await standIn.load(); await sleep(400);
      const x = r.doc.querySelector('.lk-x[data-take]');
      if (!x) return 'the stand-in page drew no × on its title row';
      const taken = [], back = [];
      r.Look.db.removeTag = async (page, tag) => { taken.push([page, tag]); }; r.Look.db.addTag = async (page, tag) => { back.push([page, tag]); };
      x.dispatchEvent(way === 'click' ? new r.dom.window.MouseEvent('click', { bubbles: true }) : new r.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(100);
      if (taken.length !== 1) return `${way}: the × took ${taken.length} tags off`;
      const [key] = r.door.undo.keys();
      if (!key) return `${way}: no Undo arrow after the tag was taken off`;
      await r.door.undo.take(key); await sleep(50);
      if (JSON.stringify(back) !== JSON.stringify(taken)) return `${way}: the arrow did not put the same tag back on the same page: ${JSON.stringify(back)}`;
    }
  }],
  ['3. "Show a page here" never writes the bullet\'s words', async () => {
    const wrote = [], offered = [];
    let link = null;
    const win = { Flow: {}, PluginDoor: {
      write: { showPage: async (uuid, id) => { wrote.push(['show', uuid, id]); link = id; }, unshowPage: async uuid => { wrote.push(['unshow', uuid]); link = null; } },
      undo: { offer: entry => offered.push(entry) } } }; win.window = win;
    win.Flow.app = { setting: () => null, host: () => ({ querySelector: () => null }), warnOnce() {}, notify() {}, listen() {} };
    win.Flow.db = { dsQuery: async () => link == null ? [] : [[link]] }; win.Flow.proposeUi = {};
    const logseq = { Editor: { exitEditingMode: async () => {}, updateBlock: async (uuid, words) => { wrote.push(['words', uuid, words]); } } };
    vm.runInContext(code('predictive/logseq/page-here.js'), vm.createContext({ window: win, logseq, setTimeout, clearTimeout, Promise, console }));
    await win.Flow.pageHere.showPage('b1', { id: 268, title: 'Dr. Mei Chen' });
    if (JSON.stringify(wrote) !== JSON.stringify([['show', 'b1', 268]])) return 'expected one write, the page shown, and the words never written: ' + JSON.stringify(wrote);
    if (offered.length !== 1) return 'no Undo arrow was offered';
    await offered[0].run();
    if (JSON.stringify(wrote.at(-1)) !== JSON.stringify(['unshow', 'b1'])) return 'Undo did not take the page off the bullet';
    link = 999; wrote.length = 0; await offered[0].run();   // the bullet shows another page by now: Undo leaves it
    if (wrote.length) return 'Undo wrote over a bullet that had changed since';
  }],
  ['4. a page the plugin made is deleted by its id, never by a shared name', async () => {
    // Two pages share a name: an older "dr. lee" of the person's own, and "Dr. Lee" that Predictive made a moment ago.
    for (const byIdWorks of [true, false]) {
      const OLD = U(1), MADE = U(2), pages = [{ uuid: OLD, title: 'dr. lee', name: 'dr. lee' }, { uuid: MADE, title: 'Dr. Lee', name: 'dr. lee' }], deleted = [];
      const find = key => pages.find(p => p.uuid === key) || pages.find(p => p.name === String(key).toLowerCase());
      const logseq = { App: {}, Editor: {
        getPage: async key => find(key) || null,
        // Logseq 2.0.2 has been seen to leave a page in place when asked by its uuid: then only the name is left to ask by.
        deletePage: async key => { const p = find(key); if (!p || (!byIdWorks && p.uuid === key)) return; deleted.push(p.uuid); pages.splice(pages.indexOf(p), 1); } },
        DB: { datascriptQuery: async q => { const uuid = /#uuid "([^"]+)"/.exec(q)?.[1]; return /deleted-at/.test(q) && !/:block\/page|:block\/refs|\?a/.test(q) ? (pages.some(p => p.uuid === uuid) ? [[1]] : []) : []; } } };
      const { win, context } = doorWith(logseq);
      win.Flow = { context: {}, schema: {}, link: {}, text: { UUID: /x/ } };
      vm.runInContext(code('predictive/logseq/db.js'), context);
      let said = '';
      const went = await win.Flow.db.dropPage({ uuid: MADE, title: 'Dr. Lee' }).catch(error => { said = error.message; return false; });
      if (deleted.includes(OLD)) return `the person's own page of the same name was deleted (delete by id ${byIdWorks ? 'works' : 'ignored'})`;
      if (byIdWorks && !(went === true && deleted.length === 1 && deleted[0] === MADE)) return 'the made page should go by its id: ' + JSON.stringify(deleted);
      if (!byIdWorks && !(deleted.length === 0 && /another page answers to its name/.test(said))) return 'with the name answering to another page, nothing may be deleted: ' + JSON.stringify([deleted, said]);
    }
  }],
  ['5. a made page that something links to is kept (the door\'s one rule)', async () => {
    const { door } = doorWith({ Editor: {}, DB: {} });
    const world = { refs: 0, valueOf: 0, own: 1, words: [] };
    const ask = async q => /:block\/title \?t/.test(q) ? world.words.map(w => [w]) : /:block\/refs/.test(q) ? Array(world.refs).fill([1]) : /\[\?b \?a \?p\]/.test(q) ? Array(world.valueOf).fill([1]) : /\[\?p \?a _\]/.test(q) ? Array(world.own).fill([':user.property/provider']) : [];
    // Threads gives the page it makes a value of its own (the relationship it was added under), so its own values are not asked.
    if (!await door.write.untouched(U(3), ask, { own: false })) return 'a page just made, holding only what its maker gave it, should count as untouched';
    if (await door.write.untouched(U(3), ask)) return 'for Predictive and Structure a value of its own still counts as touched';
    world.refs = 1; if (await door.write.untouched(U(3), ask, { own: false })) return 'a link in a bullet pointing at the page must keep it';
    world.refs = 0; world.valueOf = 1; if (await door.write.untouched(U(3), ask, { own: false })) return 'a property\'s value pointing at the page must keep it';
    world.valueOf = 0; world.words = ['a line written on it']; if (await door.write.untouched(U(3), ask, { own: false })) return 'words written on the page must keep it';
  }],
  ['6. the lessons page is never written twice, and keeps your own lines', async () => {
    const ABOUT = 'What Predictive has learned from how you answer its suggestions in this graph. Delete a line to make it forget that lesson.';
    const LINE = 'Apple\'s matcher · tag Conversation: taken 1, said no 5';
    const run = async ({ lines, readFails = false, recycled = false }) => {
      const wrote = [], page = { uuid: U(9), ...(recycled ? { 'deleted-at': 1 } : {}) };
      const blocks = lines.map((title, i) => ({ uuid: U(20 + i), title }));
      const logseq = { Editor: {
        getPage: async () => page, getPageBlocksTree: async () => readFails ? null : blocks,
        restorePage: async () => { wrote.push(['restore']); delete page['deleted-at']; }, removeBlock: async uuid => { wrote.push(['remove', blocks.find(b => b.uuid === uuid)?.title]); },
        createPage: async () => { wrote.push(['createPage']); }, appendBlockInPage: async (_, words) => { wrote.push(['append', words]); return { uuid: U(90 + wrote.length) }; },
        updateBlock: async (uuid, words) => { wrote.push(['update', uuid, words]); } }, DB: {} };
      const { win, context } = doorWith(logseq);
      win.Flow = { app: { warnOnce() {} } };
      vm.runInContext(code('predictive/core/lessons.js'), context); vm.runInContext(code('predictive/logseq/lessons.js'), context);
      const store = win.Flow.lessonsStore, lesson = win.Flow.lessons.parseLine(LINE), key = `${lesson.source} · ${lesson.target}`;
      Object.assign(store.S, { graph: 'g', loading: null }); store.S.lessons.set(key, lesson); store.S.dirty.add(key);
      let failed = false;
      await store.save().catch(() => { failed = true; });
      return { wrote, failed, kept: store.S.dirty.has(key), lessonLine: win.Flow.lessons.lineOf(lesson) };
    };
    // The page is there with the lesson's line, and the read fails: nothing may be written, and the lesson waits to be saved.
    const fail = await run({ lines: [ABOUT, LINE], readFails: true });
    if (fail.wrote.length || !fail.failed || !fail.kept) return 'a failed read must write nothing and keep the lesson for the next try: ' + JSON.stringify(fail);
    // The read answers: the lesson's own line is written over, and neither it nor the explanation is added a second time.
    const ok = await run({ lines: [ABOUT, LINE] });
    if (ok.wrote.length !== 1 || ok.wrote[0][0] !== 'update') return 'a lesson already on the page is written in its own line, once: ' + JSON.stringify(ok.wrote);
    // Out of the Recycle: the plugin's own lines go, the line you wrote stays.
    const back = await run({ lines: [ABOUT, LINE, 'my own note about this page'], recycled: true });
    const removed = back.wrote.filter(w => w[0] === 'remove').map(w => w[1]);
    if (removed.includes('my own note about this page')) return 'your own line on the page was deleted';
    if (JSON.stringify(removed) !== JSON.stringify([ABOUT, LINE])) return 'only the plugin\'s own lines go when the page comes back: ' + JSON.stringify(removed);
  }],
];

(async () => {
  let failed = 0;
  for (const [name, check] of CHECKS) {
    let problem;
    try { problem = await check(); } catch (error) { problem = `the check itself failed (${error.message})`; }
    if (problem) failed++;
    console.log(`${problem ? 'FAIL  ' : '  ok  '}${name}${problem ? ': ' + problem : ''}`);
  }
  console.log(`risks: ${CHECKS.length - failed} of ${CHECKS.length} data-safety checks hold (fix 7 is tried in test/outside.js)`);
  setTimeout(() => process.exit(failed ? 1 : 0), 50);
})();
