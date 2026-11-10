/* node test/outside.js   (needs jsdom: NODE_PATH, see README)
   Files from outside (outside.js), against a stand-in Logseq whose paste handler turns an empty bullet into an asset node, as
   Logseq 2.0.2 does: one file onto today's journal with the screen put back and the bullet being written in reopened; two files
   onto a page named, made when there is none and kept on screen; the page open in Logseq, and none open; a file that cannot
   be read, or that Logseq does not take, leaving no empty bullet behind; two calls at once going one after the other. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

function world() {
  const dom = new JSDOM('<html><body><div id="main"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/#/structure' });
  const win = dom.window, doc = win.document;
  const pages = { today: { uuid: 'today-uuid', title: 'Nov 5th, 2026', name: 'nov 5th, 2026' }, report: { uuid: 'report-uuid', title: 'Report', name: 'report' } };
  const blocks = {}, log = [];
  let open = null, shown = null, editing = false, n = 0;
  const draw = () => { doc.getElementById('main').innerHTML = shown ? Object.values(blocks).filter(b => b.page === shown).map(b => `<div blockid="${b.uuid}"></div>`).join('') : ''; };
  const files = { '/Users/x/Scan.pdf': 'pdf-bytes', '/Users/x/Photo.png': 'png', '/Users/x/Stuck.pdf': 'stuck', '/Users/x/Note.txt': 'a note', '/Users/x/Slow.pdf': 'slow' };
  const held = {};   // the graph's assets folder: uuid.type → bytes
  win.fetch = async url => { const p = url.replace(/^assets:\/\//, ''); const text = files[p] ?? held[p]; return text !== undefined ? { ok: true, arrayBuffer: async () => new win.TextEncoder().encode(text).buffer } : { ok: false }; };
  const logseq = {
    Editor: {
      getTodayPage: async () => pages.today,
      getCurrentPage: async () => open,
      getPage: async name => Object.values(pages).find(p => p.name === String(name).toLowerCase()) || null,
      createPage: async (name, _, opts) => { log.push(['createPage', name, opts.redirect]); const p = { uuid: name.toLowerCase() + '-uuid', title: name, name: name.toLowerCase() }; pages[name] = p; return p; },
      appendBlockInPage: async (page, content) => { const b = { uuid: 'b' + (++n), page, content, title: content }; blocks[b.uuid] = b; draw(); return b; },
      removeBlock: async uuid => { log.push(['removeBlock', uuid]); delete blocks[uuid]; draw(); },
      editBlock: async (uuid, opts) => { log.push(['editBlock', uuid, opts.pos]); if (!doc.querySelector(`[blockid="${uuid}"]`)) return; const ta = doc.createElement('textarea'); ta.id = 'edit-block-' + uuid; doc.body.appendChild(ta); ta.focus(); editing = uuid; },
      exitEditingMode: async () => { doc.querySelectorAll('textarea').forEach(t => t.remove()); editing = false; },
      checkEditing: async () => editing,
      getEditingCursorPosition: async () => ({ pos: 7 }),
      getBlock: async uuid => blocks[uuid] || null,
    },
    DB: { datascriptQuery: async (q, size, type) => Object.values(blocks).filter(b => b.properties && String(b.properties.size) === size && JSON.stringify(b.properties['logseq.property.asset/type']) === type).map(b => ({ uuid: b.uuid, title: b.title })) },
    App: { getCurrentGraph: async () => ({ path: '/graph' }), pushState: async (_, { name }) => { log.push(['pushState', name]); win.location.hash = '#/page/' + name; shown = name; draw(); } },
    provideModel: m => { logseq.model = m; },
    UI: { showMsg: (text) => log.push(['notice', text]) },
  };
  doc.addEventListener('paste', event => {   // Logseq's paste handler: a file into an empty bullet makes that bullet the asset
    const file = event.clipboardData?.files?.[0]; const uuid = event.target.id.replace('edit-block-', ''); const b = blocks[uuid];
    if (!file || !b || b.content !== '') return;
    if (file.name === 'Stuck.pdf') return;
    const wait = file.name === 'Slow.pdf' ? 2200 : 50;
    file.arrayBuffer().then(bytes => setTimeout(() => { const type = file.name.split('.').pop(); b.title = file.name.replace(/\.[^.]+$/, ''); b.properties = { 'logseq.property.asset/type': type, size: bytes.byteLength }; held['/graph/assets/' + uuid + '.' + type] = new win.TextDecoder().decode(bytes); }, wait));
  });
  // jsdom has no DataTransfer or ClipboardEvent: the two the paste needs, as Chromium has them
  win.DataTransfer = class { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } };
  win.ClipboardEvent = class extends win.Event { constructor(type, init) { super(type, init); this.clipboardData = init.clipboardData; } };
  const plugin = { parent: win, console, setTimeout, clearTimeout };
  plugin.window = plugin;
  const context = vm.createContext({ window: plugin, parent: win, logseq, console, setTimeout, clearTimeout, Promise, fetch: win.fetch, Date, Array, Object, String, Boolean, Error, JSON });
  for (const file of ['plugin.js', 'outside.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  plugin.PluginDoor.outside.patience = 3000;
  plugin.PluginDoor.outside.answerWithin = 1500;
  plugin.PluginDoor.outside.start();
  return { win, doc, log, blocks, pages, add: logseq.model.add, setOpen: p => { open = p; }, setEditing: uuid => { editing = uuid; } };
}

(async () => {
  // One file onto today's journal, from another screen, with a bullet being written in: back where it was after.
  {
    const w = world();
    w.setEditing('their-bullet');
    const out = await w.add({ files: ['/Users/x/Scan.pdf'], where: 'today' });
    same(out, { page: 'Nov 5th, 2026', added: ['Scan'] });
    const asset = Object.values(w.blocks).find(b => b.title === 'Scan');
    assert.ok(asset && asset.page === 'today-uuid' && asset.properties['logseq.property.asset/type'] === 'pdf', 'the empty bullet became the asset on today');
    assert.ok(w.log.some(([k, v]) => k === 'pushState' && v === 'today-uuid'), 'today was shown for the paste');
    await sleep(350);
    assert.equal(w.win.location.hash, '#/structure', 'the screen is back where it was');
    assert.deepEqual(w.log.filter(([k]) => k === 'editBlock').pop(), ['editBlock', 'their-bullet', 7], 'the bullet being written in is opened again, at its cursor');
    assert.ok(!w.doc.querySelector('textarea'), 'nothing is left open');
  }
  // Two files onto a page named: made when there is none, kept on screen.
  {
    const w = world();
    const out = await w.add({ files: ['/Users/x/Scan.pdf', '/Users/x/Photo.png'], where: { page: 'Letters' } });
    same(out, { page: 'Letters', added: ['Scan', 'Photo'] });
    assert.ok(w.log.some(([k, name, redirect]) => k === 'createPage' && name === 'Letters' && redirect === false), 'the page was made');
    assert.equal(w.win.location.hash, '#/page/letters-uuid', 'the page named stays on screen');
    assert.equal(Object.values(w.blocks).filter(b => b.page === 'letters-uuid').length, 2, 'two assets, no empty bullet');
    const again = await w.add({ files: ['/Users/x/Note.txt'], where: { page: 'letters' } });
    assert.equal(again.page, 'Letters', 'the page is found by its name in any case');
    assert.equal(w.log.filter(([k]) => k === 'createPage').length, 1, 'and not made twice');
  }
  // A file whose bytes are already in the graph: named, nothing added, no empty bullet left.
  {
    const w = world();
    await w.add({ files: ['/Users/x/Scan.pdf'], where: 'today' });
    const before = Object.keys(w.blocks).length;
    await assert.rejects(() => w.add({ files: ['/Users/x/Scan.pdf'], where: { page: 'Letters' } }), /Scan\.pdf is already in the graph, as “Scan”/);
    assert.equal(Object.keys(w.blocks).length, before, 'nothing was added');
    assert.ok(!w.log.some(([k, name]) => k === 'createPage' && name === 'Letters'), 'and no page was made for it');
  }
  // The page open in Logseq, and none.
  {
    const w = world();
    await assert.rejects(() => w.add({ files: ['/Users/x/Scan.pdf'], where: 'open' }), /No page is open/);
    w.setOpen(w.pages.report);
    const out = await w.add({ files: ['/Users/x/Scan.pdf'], where: 'open' });
    assert.equal(out.page, 'Report');
  }
  // A file that cannot be read: said, and no empty bullet left. A file Logseq has not taken when the wait runs out keeps its
  // bullet (10 November 2026): Logseq may only be slow, and a file that lands later then has its node.
  {
    const w = world();
    await assert.rejects(() => w.add({ files: ['/Users/x/Missing.pdf'], where: 'today' }), /Missing\.pdf could not be read/);
    await assert.rejects(() => w.add({ files: ['Scan.pdf'], where: 'today' }), /whole path/);
    await assert.rejects(() => w.add({ files: [], where: 'today' }), /No file/);
    const before = Object.keys(w.blocks).length;
    same(await w.add({ files: ['/Users/x/Stuck.pdf'], where: 'today' }), { pending: true });   // the caller's time ran out first
    await sleep(2200);
    assert.equal(Object.keys(w.blocks).length, before + 1, 'the bullet stays when the wait runs out, for a file that lands late');
    assert.ok(!w.log.some(([k]) => k === 'removeBlock'), 'nothing is removed: ' + JSON.stringify(w.log));
    assert.ok(w.log.some(([k, text]) => k === 'notice' && /has not taken Stuck\.pdf yet; its bullet is kept/.test(text)), 'and it is said in Logseq, since the caller is gone');
  }
  // A file Logseq is slow to take: answered as pending before the caller's time runs out, and still taken.
  {
    const w = world();
    const out = await w.add({ files: ['/Users/x/Slow.pdf'], where: 'today' });
    same(out, { pending: true });
    await sleep(2000);
    assert.ok(Object.values(w.blocks).some(b => b.title === 'Slow' && b.properties), 'the file went in after the answer');
  }
  // Two calls at once go one after the other.
  {
    const w = world();
    const [a, b] = await Promise.all([w.add({ files: ['/Users/x/Scan.pdf'], where: 'today' }), w.add({ files: ['/Users/x/Photo.png'], where: { page: 'Letters' } })]);
    same([a.added, b.added], [['Scan'], ['Photo']]);
    const order = w.log.filter(([k]) => k === 'editBlock').map(([, u]) => u);
    assert.deepEqual(order, ['b1', 'b2'], 'one bullet open at a time, in order');
  }
  console.log('outside: all checks passed');
})().catch(error => { console.error(error); process.exit(1); });
