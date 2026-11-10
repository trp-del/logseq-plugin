/* The lessons (core/lessons.js) kept in the graph: a page "Predictive lessons", one line per lesson, so each graph learns on its
   own and a graph opened on another computer brings what it learned. Read when the graph is first read; written a moment after a
   lesson changes. A line deleted on the page is forgotten: before each save the page is read again, and a lesson whose line is
   gone goes too. Only names of tags and properties and counts are written, never a note's words.
   A read that fails is never taken for an empty page (10 November 2026): the save stops and is tried again later, so the
   lessons are never written a second time under the first. And a page brought back out of the Recycle loses only the
   plugin's own lines (the lessons and the line saying what the page is); a line you wrote there yourself is kept. */
(function () {
const Flow = (window.Flow ||= {});
const core = Flow.lessons;
const PAGE = 'Predictive lessons';
const ABOUT = 'What Predictive has learned from how you answer its suggestions in this graph. Delete a line to make it forget that lesson.';
const SAVE_MS = 1500, AGAIN_MS = 30000, TRIES = 5;
const S = { graph: '', lessons: new Map(), uuids: new Map(), loading: null, dirty: new Set(), timer: 0, readAt: 0, failed: 0 };
const textOf = b => String(b?.title ?? b?.content ?? '');

// The page, unless it is in Logseq's Recycle: a page you deleted is every lesson forgotten (Logseq keeps a deleted page, with its
// lines, in the Recycle, and gives it back for a new page of the same name).
const recycled = async () => { const page = await logseq.Editor.getPage(PAGE).catch(() => null); return page && page[':logseq.property/deleted-at'] != null || page?.['deleted-at'] != null ? page : null; };
// No page yet: no lines. A page that is there and whose lines do not come throws: that is a failed read, not an empty page.
async function readPage() {
  if (await recycled()) return { blocks: [], found: new Map() };
  const page = await logseq.Editor.getPage(PAGE);
  const blocks = page ? await logseq.Editor.getPageBlocksTree(PAGE) : [];
  if (!Array.isArray(blocks)) throw new Error('the lessons page gave no lines');
  const found = new Map();
  for (const b of blocks) { const lesson = core.parseLine(textOf(b)); if (lesson) found.set(`${lesson.source} · ${lesson.target}`, { lesson, uuid: String(b.uuid) }); }
  return { blocks, found };
}
// The graph's lessons, read once per graph (again after a graph change); never waited for while typing.
// Read again a minute on, when nothing waits to be saved, so a line deleted on the page is forgotten without a restart.
const FRESH_MS = 60000;
function load(graph) {
  if (!graph) return S.loading;
  if (S.graph === graph) {
    if (S.dirty.size || Date.now() - S.readAt < FRESH_MS) return S.loading;
    S.readAt = Date.now();
    return (S.loading = readPage().then(({ found }) => {
      if (S.graph !== graph || S.dirty.size) return;
      S.lessons = new Map([...found].map(([key, f]) => [key, f.lesson])); S.uuids = new Map([...found].map(([key, f]) => [key, f.uuid]));
    }).catch(error => Flow.app.warnOnce('the lessons could not be read', error)));
  }
  S.readAt = Date.now();
  clearTimeout(S.timer);
  Object.assign(S, { graph, lessons: new Map(), uuids: new Map(), dirty: new Set() });
  S.loading = readPage().then(({ found }) => {
    if (S.graph !== graph) return;
    for (const [key, { lesson, uuid }] of found) if (!S.lessons.has(key)) { S.lessons.set(key, lesson); S.uuids.set(key, uuid); }
  }).catch(error => { S.readAt = 0; Flow.app.warnOnce('the lessons could not be read', error); });   // read again at the next ask, not a minute on
  return S.loading;
}
const lessons = () => S.lessons;

function note(piece, outcome, to) {
  if (!S.graph) return;
  const key = core.note(S.lessons, piece, outcome, to);
  if (!key) return;
  S.dirty.add(key);
  clearTimeout(S.timer);
  S.timer = setTimeout(saveSoon, SAVE_MS);
}
// A save that fails keeps what it had to write and tries again later, a few times; the next lesson learned starts it afresh.
function saveSoon() {
  save().then(() => { S.failed = 0; }).catch(error => {
    Flow.app.warnOnce('the lessons could not be saved', error);
    clearTimeout(S.timer);
    if (++S.failed < TRIES) S.timer = setTimeout(saveSoon, AGAIN_MS);
  });
}

async function save() {
  const graph = S.graph;
  if (!S.dirty.size) return;
  await S.loading;
  const { blocks, found } = await readPage();   // a failed read throws here, before anything is forgotten or written
  if (S.graph !== graph) return;
  const onPage = new Set(blocks.map(b => String(b.uuid)));
  // A line deleted on the page: that lesson is forgotten, whatever was added to it since.
  for (const [key, uuid] of [...S.uuids]) if (!onPage.has(uuid)) { S.uuids.delete(key); S.lessons.delete(key); S.dirty.delete(key); }
  const dirty = [...S.dirty];
  if (!dirty.length) return;
  let about = blocks.some(b => textOf(b).trim() === ABOUT);
  const gone = await recycled();
  if (gone) {
    // Deleted: brought back out of the Recycle without the plugin's own lines, and only what was learned since goes on it.
    // A line that is neither a lesson nor the line saying what the page is was written by you, and stays.
    await window.PluginDoor.write.restorePage(gone.uuid);
    const back = await logseq.Editor.getPageBlocksTree(PAGE);
    if (!Array.isArray(back)) throw new Error('the lessons page gave no lines after it was brought back');
    for (const b of back) if (textOf(b).trim() === ABOUT || core.parseLine(textOf(b))) await window.PluginDoor.write.removeBlock(b.uuid);
    about = false;
  }
  if (!(await logseq.Editor.getPage(PAGE))) await window.PluginDoor.write.createPage(PAGE, {}, { redirect: false, createFirstBlock: false });
  if (!about && (gone || !blocks.length)) await window.PluginDoor.write.appendBlock(PAGE, ABOUT);
  for (const key of dirty) {
    const lesson = S.lessons.get(key);
    if (lesson) {
      const uuid = S.uuids.get(key) || found.get(key)?.uuid;
      if (uuid) await window.PluginDoor.write.setWords(uuid, core.lineOf(lesson));
      else { const b = await window.PluginDoor.write.appendBlock(PAGE, core.lineOf(lesson)); if (b?.uuid) S.uuids.set(key, String(b.uuid)); }
    }
    S.dirty.delete(key);   // only once its line is written: what a failure leaves is tried again
  }
}

Flow.lessonsStore = { PAGE, load, lessons, note, save, S };
})();
