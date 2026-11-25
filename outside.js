/* What comes in from outside Logseq: the Alfred workflow, through Logseq's HTTP API. It stands whichever modules run, like
   the settings window, and writes one thing: files put into the graph the way Logseq puts a dropped file, each as a node of
   its own (an asset: its title the file's name without the extension, the file copied into the graph's assets folder), on
   today's journal, on the page open in Logseq, or on a page named by the caller, made when there is none.
   Logseq's API gives a plugin no call that makes an asset node; its own paste handler does. So each file is pasted into an
   empty bullet appended to the page, which Logseq turns into the asset node (seen in Logseq 2.0.2, 5 November 2026: an empty
   bullet becomes the asset itself, a bullet with words gets the asset as the bullet after it). The bullet must be on screen to
   be opened, so the page is shown meanwhile and the screen put back after, with the bullet that was being written in.
   The caller asks for it as
     logseq.App.invokeExternalPluginCmd  ["logseq-plugin", "models", "add", [{ files: [absolute paths], where }]]
   where `where` is "today", "open" or { page: "its name" }, and is answered { page, added: [titles] }, or { pending: true }
   when the files are still going in as Logseq's ten seconds for the call run out, or an error with the reason, which the
   caller shows. A file Logseq is slow to take keeps its bullet: only a bullet the file was never pasted into is taken back. Words, links and pages the caller writes through Logseq's own API; only files need this.
   Since 18 November 2026 the workflow's panels (Alfred 6's Alfred UI) ask more of it, each answered by the part that does the
   same in Logseq, so the two never differ:
     files    check (each file's name and its twin in the graph, before anything is added), add with linkTwins (a twin linked on
              the page, not refused), progress (how far an add is), unadd (every bullet an add made, taken back)
     notes    guess, note, undo, tags: Predictive's (predictive/logseq/outside-note.js)
   The tasks answers (todoList, todoAdd, todoStatus, todoUndo) and the reading answers (find, read, browse) went on 24 November
   2026, with the workflow's Todo, Search, Home and page panels. */
(function () {
const Door = window.PluginDoor;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (check, ms, every = 100) => {
  const end = Date.now() + ms;
  for (;;) { const found = await check(); if (found) return found; if (Date.now() > end) return null; await sleep(every); }
};
const hasAssetType = block => !!block && [block, block.properties || {}].some(o => Object.keys(o).some(k => /asset\/type$/.test(k)));
const fileName = path => String(path).split('/').filter(Boolean).pop() || '';

async function page(where) {
  if (where === 'today') {
    // Logseq's today call can answer nothing while today's journal is on screen (seen on the owner's other Mac, 12 November
    // 2026), so the day is looked up by its number and made when there is none, as the workflow's own words do.
    // A today's page in Recycle is passed over too: it never comes on screen to take a file (13 November 2026).
    const recycled = page => !!page && [page, page.properties || {}].some(o => Number(o[':logseq.property/deleted-at'] || o['logseq.property/deleted-at'] || 0) > 0);
    let today = await logseq.Editor.getTodayPage().catch(() => null);
    if (!today?.uuid || recycled(today)) {
      const { id } = await Door.dates.page(Door.dates.today());
      today = id ? await logseq.Editor.getPage(id) : null;
    }
    if (!today?.uuid) throw new Error("Today's journal could not be found");
    return today;
  }
  if (where === 'open') {
    const open = await logseq.Editor.getCurrentPage();
    if (!open?.uuid) throw new Error('No page is open in Logseq');
    return open;
  }
  const name = String(where?.page ?? '').trim();
  if (!name) throw new Error('No page was named');
  const found = await logseq.Editor.getPage(name);
  if (found?.uuid) return found;
  const made = await window.PluginDoor.write.createPage(name, {}, { redirect: false, createFirstBlock: false });
  if (!made?.uuid) throw new Error(`The page “${name}” could not be made`);
  return made;
}
// The bytes of a file on this computer. Logseq serves any absolute path on its assets scheme (seen 5 November 2026).
async function read(path) {
  const response = await fetch('assets://' + path).catch(() => null);
  if (!response?.ok) throw new Error(`${fileName(path) || path} could not be read`);
  return response.arrayBuffer();
}
/* Logseq keeps one copy of a file: a paste whose bytes match an asset already in the graph is refused with a notice of its own
   and nothing is inserted (logseq/logseq master, assets.cljs, new-asset-block). So the twin is looked for first, by size and
   type and then byte for byte, and named. */
const same = (a, b) => { if (a.byteLength !== b.byteLength) return false; const x = new Uint8Array(a), y = new Uint8Array(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; };
async function twin(bytes, name) { return (await twinOf(bytes, name))?.title || null; }
async function twinOf(bytes, name) {
  const type = (/\.([^.]+)$/.exec(name)?.[1] || '').toLowerCase();
  const graph = await logseq.App.getCurrentGraph().catch(() => null);
  if (!type || !graph?.path) return null;
  const rows = await logseq.DB.datascriptQuery(`[:find [(pull ?a [:block/uuid :block/title]) ...] :in $ ?size ?type :where [?a :logseq.property.asset/size ?size] [?a :logseq.property.asset/type ?type]]`, String(bytes.byteLength), JSON.stringify(type)).catch(() => null) || [];
  for (const row of rows) {
    const uuid = row.uuid || row['block/uuid'];
    if (!uuid) continue;
    const held = await fetch(`assets://${encodeURI(String(graph.path).replace(/\/$/, ''))}/assets/${uuid}.${type}`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
    if (held && same(held, bytes)) return { uuid: String(uuid), title: row.title || row['block/title'] || String(uuid) };
  }
  return null;
}
// One file into one page: an empty bullet, opened, the file pasted, the bullet watched until it is the asset.
async function paste(target, { path, bytes }, screen) {
  const name = fileName(path);
  const block = await window.PluginDoor.write.appendBlock(target.uuid, '');
  if (!block?.uuid) throw new Error(`A bullet for ${name} could not be added`);
  const doc = window.parent.document, win = doc.defaultView;
  const takeBack = async () => { try { await logseq.Editor.exitEditingMode(true); } catch (error) { /* it was not open */ } try { await window.PluginDoor.write.removeBlock(block.uuid); } catch (error) { /* it was already gone */ } };
  let shown = await until(() => doc.querySelector(`[blockid="${block.uuid}"]`), screen.moved ? 3000 : 400);
  if (!shown) {
    await screen.show(target);
    shown = await until(() => doc.querySelector(`[blockid="${block.uuid}"]`), 4000);
  }
  if (!shown) { await takeBack(); throw new Error('The page did not come on screen'); }
  // Opened for writing: the box Logseq draws for it, asked for again when a page still settling took the first ask.
  let box = null;
  for (let tries = 0; !box && tries < 3; tries++) {
    await logseq.Editor.editBlock(block.uuid, {});
    box = await until(() => doc.getElementById('edit-block-' + block.uuid), 1500, 50);
  }
  if (!box) { await takeBack(); throw new Error(`The bullet for ${name} could not be opened`); }
  if (doc.activeElement !== box) box.focus();
  const transfer = new win.DataTransfer();
  transfer.items.add(new win.File([bytes], name, {}));
  Door.screen.paste(box, transfer);
  // Copying a large file and reading it for its checksum takes Logseq a while.
  const asset = await until(async () => { const now = await logseq.Editor.getBlock(block.uuid).catch(() => null); return hasAssetType(now) ? now : null; }, Door.outside.patience, 200);
  try { await logseq.Editor.exitEditingMode(true); } catch (error) { /* it closed itself */ }
  // Still not the file's node when the wait runs out: the bullet stays (10 November 2026). Logseq may only be slow with a large file,
  // and a file that lands a moment later then has its node; removing the bullet left the file in the graph with nothing pointing at it.
  if (!asset) throw new Error(`Logseq has not taken ${name} yet; its bullet is kept on the page for when it does`);
  Door.outside.progress.made.push(block.uuid);
  return asset.title || asset.content || name.replace(/\.[^.]+$/, '');
}
// Where the owner was: the route, and the bullet being written in, put back once the files are in.
function remember() {
  const win = window.parent, was = win.location.hash;
  const screen = { moved: false, editing: null };
  screen.show = async target => {
    if (!screen.moved) {
      screen.editing = await logseq.Editor.checkEditing().catch(() => null) || null;
      if (screen.editing) screen.at = (await logseq.Editor.getEditingCursorPosition().catch(() => null))?.pos ?? 0;
    }
    screen.moved = true;
    await logseq.App.pushState('page', { name: target.uuid }, {});
  };
  screen.back = async keep => {
    if (!screen.moved) return;
    if (!keep) win.location.hash = was;
    if (screen.editing && typeof screen.editing === 'string') {
      await sleep(keep ? 0 : 300);
      try { await logseq.Editor.editBlock(screen.editing, { pos: screen.at }); } catch (error) { /* the bullet is gone */ }
    }
  };
  return screen;
}
/* Two calls at once go one after the other: one screen, one bullet open at a time. Logseq gives a call from outside ten
   seconds, so a job still running when the time is nearly up is answered { pending: true } and goes on; what then goes wrong
   can only be said in Logseq. */
let queue = Promise.resolve();
function add(request) {
  const job = queue.then(() => addNow(request || {}));
  queue = job.catch(() => {});
  const later = sleep(Door.outside.answerWithin).then(() => ({ pending: true }));
  job.then(() => {}, error => later.then(answer => { if (answer.pending) logseq.UI.showMsg(`Nothing was added from outside: ${window.PluginDoor.reason(error, 'Logseq did not take it')}`, 'warning'); }));
  return Promise.race([job, later]);
}
async function addNow({ files: given, where, linkTwins = false }) {
  const paths = (Array.isArray(given) ? given : [given]).map(f => String(f ?? '').trim()).filter(Boolean);
  if (!paths.length) throw new Error('No file was given');
  if (paths.some(p => !p.startsWith('/'))) throw new Error('A file needs its whole path');
  // Every file read and known to be new before anything is made, so a file refused leaves no page and no bullet behind. Asked to
  // (the workflow's files tray, which said so before adding), a file already in the graph is linked on the page instead.
  const files = [], twins = [];
  for (const path of paths) {
    const bytes = await read(path), already = await twinOf(bytes, fileName(path));
    if (already && !linkTwins) throw new Error(`${fileName(path)} is already in the graph, as “${already.title}”`);
    if (already) twins.push(already); else files.push({ path, bytes });
  }
  const target = await page(where);
  const screen = remember();
  const added = [], progress = Door.outside.progress = { total: files.length, done: 0, now: '', made: [], linked: [], failed: '', page: target.title || target.name || '' };
  try {
    for (const file of files) { progress.now = fileName(file.path); added.push(await paste(target, file, screen)); progress.done++; }
    for (const t of twins) { const b = await Door.write.appendBlock(target.uuid, `[[${t.uuid}]]`); if (b?.uuid) progress.made.push(b.uuid); progress.linked.push(t.title); }
    progress.now = '';
  } catch (error) { progress.failed = Door.reason(error, 'Logseq did not take it'); throw error; } finally {
    // A page the caller named stays on screen when it was shown for this: they just added to it.
    await screen.back(Boolean(where?.page)).catch(error => console.error('From outside: the screen could not be put back', error));
  }
  return { page: target.title || target.name || '', added, linked: twins.map(t => t.title) };
}
/* For the files tray, before anything is added: each file's name as its node will be titled, its size, and the node it already is
   in the graph, if any. While adding: how far it is (progress), and afterwards every bullet made, for one Undo (unadd). */
async function check({ files: given } = {}) {
  const paths = (Array.isArray(given) ? given : [given]).map(f => String(f ?? '').trim()).filter(Boolean);
  const out = [];
  for (const path of paths) {
    const name = fileName(path);
    try { const bytes = await read(path), t = await twinOf(bytes, name); out.push({ path, name, title: name.replace(/\.[^.]+$/, ''), type: (/\.([^.]+)$/.exec(name)?.[1] || '').toUpperCase(), size: bytes.byteLength, twin: t ? t.title : '' }); }
    catch (error) { out.push({ path, name, title: name, type: '', size: 0, twin: '', said: Door.reason(error, 'could not be read') }); }
  }
  return { files: out };
}
const progress = async () => Door.outside.progress || { total: 0, done: 0, made: [] };
async function unadd({ made = [] } = {}) {
  for (const uuid of made) { try { await Door.write.removeBlock(String(uuid)); } catch (error) { /* already gone */ } }
  return { undone: made.length };
}
/* A note, from the workflow's Add panel: Predictive's proposals for words not yet written (guess), the note written with what was
   taken (note), and that note taken back (undo). Without Predictive running, a note goes in as words alone. */
const predictive = () => window.Flow?.outsideNote;
async function guess(request) {
  const p = predictive();
  return p ? p.guess(request || {}) : { off: true, tag: null, choices: [], pieces: [] };
}
async function note(request) {
  const p = predictive();
  if (p) return p.note(request || {});
  const words = String(request?.words || '').trim();
  if (!words) throw new Error('There are no words to add');
  const target = await page(request?.where || 'today'), block = await Door.write.appendBlock(target.uuid, words);
  return { uuid: block?.uuid || '', page: target.title || target.name || '', tag: '', wrote: [] };
}
async function undo(request) {
  const p = predictive();
  if (p) return p.undo(request || {});
  await Door.write.removeBlock(String(request?.uuid || ''));
  return { undone: true };
}
async function tags() {
  const p = predictive();
  return p ? p.tags() : { off: true, tags: [] };
}
function start() {
  logseq.provideModel({ add, check, progress, unadd, guess, note, undo, tags });
}
Door.outside = { start, add, page, progress: null, patience: 30000, answerWithin: 8000 };   // how long Logseq is given to take one file; how long the caller waits
})();
