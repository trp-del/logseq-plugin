/* node test/split.js   (needs jsdom: NODE_PATH, see README)
   Two pages side by side (split.js), against a stand-in Logseq whose right sidebar draws its list as Logseq 2.0.2 does (newest
   on top, each item with its ×): a ⌘-click on a page's link or a tag in the main view opens it beside, Logseq never hearing the
   press; a plain click, a Shift-click, a ⌘-click in the sidebar and a ⌘-click with the setting off go to Logseq as before; the
   halves are equal, a drag keeps each at least 320 px, a double press makes them equal again; another ⌘-click puts another page
   on the right; ⇄ swaps the pages; × on the right and on the left close a half, and the sidebar is then as it was (open or
   closed, its list, its tab); anything opened in the sidebar by hand, or the sidebar closed, ends the split without taking it
   from the list; the plugin stopping leaves nothing behind; and nothing is ever written to the graph. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REPO = 'logseq_db_Test';
const U = n => `1a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function world({ sidebarOpen = true, settings = {} } = {}) {
  const dom = new JSDOM(`<html><head></head><body><main id="app-container-wrapper"><div id="app-container"><div id="left-container"><div id="main-container"><div id="left-sidebar"></div><div id="main-content-container"></div></div></div><div id="right-sidebar" class="cp__right-sidebar" data-lk-tab="todo"><div class="resizer" role="separator"></div><div class="cp__right-sidebar-inner"><div class="cp__right-sidebar-topbar"><div class="cp__right-sidebar-settings"></div></div><div class="sidebar-item-list"></div></div></div></div></main></body></html>`, { pretendToBeVisual: true, url: 'http://localhost/' });
  const win = dom.window, doc = win.document;
  Object.defineProperty(win, 'innerWidth', { value: 1500, configurable: true });
  const nodes = { [U(1)]: { id: 1, uuid: U(1), title: 'Fatigue' }, [U(2)]: { id: 2, uuid: U(2), title: 'Dr. Mei Chen' }, [U(3)]: { id: 3, uuid: U(3), title: 'Consultation' }, [U(4)]: { id: 4, uuid: U(4), title: 'Spoke with her', page: { id: 1 } } };
  const store = { 'sidebar/blocks': [[REPO, ':logseq-plugin/_sidebar.todo-side', 'plugin'], [REPO, 9, 'page']], 'ui/sidebar-open?': sidebarOpen };
  const log = [], logseqHeard = [];
  let shown = U(1);
  // Logseq's main view and right sidebar, drawn from its state.
  const drawMain = () => {
    const page = nodes[shown];
    doc.getElementById('main-content-container').innerHTML = `<div class="ls-page-title"><div class="block-content">${page.title}</div></div><div class="ls-page-blocks"><span class="bullet-container"></span>Spoke with <a class="page-ref" data-uuid="${U(2)}">Dr. Mei Chen</a> <a class="tag" data-uuid="${U(3)}">Consultation</a> <a class="lk-node" data-uuid="${U(4)}">Spoke with her</a></div>`;
  };
  const drawSide = () => {
    doc.getElementById('right-sidebar').classList.toggle('open', store['ui/sidebar-open?']);
    const list = doc.querySelector('.sidebar-item-list');
    list.innerHTML = store['ui/sidebar-open?'] ? store['sidebar/blocks'].map(([, id, type]) => `<div class="sidebar-drop-indicator"></div><div class="sidebar-item item-type-${type}" data-id="${id}"><div class="sidebar-item-header">${id}<div class="item-actions"><button class="ui__button"><span class="ls-icon-x"></span></button></div></div><div class="sidebar-panel-content"><div class="page"><div class="ls-page-blocks"><span class="bullet-container"></span><a class="page-ref" data-uuid="${U(3)}">Consultation</a></div></div></div></div>`).join('') : '';
    for (const button of list.querySelectorAll('.ls-icon-x')) button.closest('button').addEventListener('click', event => { const id = event.target.closest('.sidebar-item').dataset.id; log.push(['sidebar ×', id]); store['sidebar/blocks'] = store['sidebar/blocks'].filter(e => String(e[1]) !== id); setTimeout(drawSide, 5); });
  };
  drawMain(); drawSide();
  // Logseq hears a press on a link (a click goes to the page): anything that reaches it is logged.
  for (const type of ['pointerdown', 'mousedown', 'click']) doc.addEventListener(type, event => { if (event.target.closest?.('a')) logseqHeard.push(type + (event.metaKey ? '+meta' : '') + (event.shiftKey ? '+shift' : '')); });
  win.logseq = { api: { get_state_from_store: key => store[key] } };
  const sidebarVisible = on => { store['ui/sidebar-open?'] = on; setTimeout(drawSide, 5); };
  const settingsNow = { ...settings };
  const read = { getPage: async uuid => (nodes[uuid] && !nodes[uuid].page ? nodes[uuid] : null), getBlock: async uuid => nodes[uuid] || null, getCurrentPage: async () => nodes[shown] };
  // Only reads and what changes the screen: any write to the graph would be a call this stand-in does not have, and is logged.
  const Editor = new Proxy({ ...read,
    openInRightSidebar: async uuid => { const n = nodes[uuid]; log.push(['open beside', n.title]); store['sidebar/blocks'] = [[REPO, n.id, n.page ? 'block' : 'page'], ...store['sidebar/blocks'].filter(e => e[1] !== n.id)]; store['ui/sidebar-open?'] = true; setTimeout(drawSide, 5); },
  }, { get: (o, k) => k in o ? o[k] : (...args) => { log.push(['WRITE', k, args]); } });
  const logseq = { settings: settingsNow, Editor, App: { pushState: (_, { name }) => { log.push(['go to', nodes[name].title]); shown = name; setTimeout(drawMain, 5); }, setRightSidebarVisible: sidebarVisible }, UI: { showMsg: text => log.push(['notice', text]) }, provideStyle() {} };
  const plugin = { parent: win, console, setTimeout, clearTimeout };
  plugin.window = plugin;
  const context = vm.createContext({ window: plugin, parent: win, logseq, console, setTimeout, clearTimeout, Promise, navigator: { platform: 'MacIntel' } });
  for (const file of ['plugin.js', 'sidebar-tabs.js', 'split.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const Door = plugin.PluginDoor;
  Door.split.start();
  const press = (el, init = {}) => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })); };
  const link = (where, cls) => doc.querySelector(`${where} ${cls}`);
  const S = () => Door.split.state();
  const settle = () => sleep(120);
  return { win, doc, store, log, logseqHeard, Door, press, link, S, settle, shown: () => nodes[shown].title, settings: settingsNow };
}

(async () => {
  // A ⌘-click on a page's link in the main view: the page opens beside, as two equal halves, and Logseq never hears the press.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.deepEqual(w.logseqHeard, [], 'Logseq does not hear the ⌘-click, so it does not go to the page');
    assert.equal(w.S().id, 2, 'Dr. Mei Chen is on the right');
    assert.equal(w.shown(), 'Fatigue', 'the page on the left stays');
    const side = w.doc.getElementById('right-sidebar');
    assert.ok(side.hasAttribute('data-lk-split'), 'the sidebar is the right half');
    const item = side.querySelector('[data-lk-split-item]');
    assert.equal(item?.dataset.id, '2', 'only the page opened beside is shown there');
    assert.equal(item.querySelector('.lk-split-title')?.textContent, 'Dr. Mei Chen', 'the page has its title over it');
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '750px', 'equal halves of the main area');
    assert.ok(w.doc.querySelector('.lk-split-line .lk-split-swap.lk-change.lk-reveal'), 'the hairline with ⇄, shown only when pointed at');
    const xs = side => w.doc.querySelector(`body > .lk-split-x.lk-x.lk-reveal[data-side="${side}"]`);
    assert.ok(xs('left') && xs('right'), 'each page has its ×, standing over the page, not in it');
    assert.ok(!w.doc.querySelector('#main-content-container .lk-reveals, #right-sidebar .lk-reveals') && !w.doc.getElementById('main-container').closest('.lk-reveals') && !item.closest('.lk-reveals'), 'no page is made a holder, so presses of its own stay hidden');
    // Pointing: the page under the pointer shows its × (lk-near), the other page's stays hidden; leaving the window hides both.
    const point = (el, type = 'pointerover', init = {}) => el.dispatchEvent(new w.win.MouseEvent(type, { bubbles: true, ...init }));
    point(w.link('#main-content-container', 'a.tag'));
    assert.ok(xs('left').classList.contains('lk-near') && !xs('right').classList.contains('lk-near'), 'the left page pointed at: its × shows');
    point(xs('left'));
    assert.ok(xs('left').classList.contains('lk-near'), 'moving onto the × keeps it');
    point(item.querySelector('.bullet-container'));
    assert.ok(!xs('left').classList.contains('lk-near') && xs('right').classList.contains('lk-near'), 'the right page pointed at: its × shows');
    point(item, 'pointerout', { relatedTarget: null });
    assert.ok(!xs('left').classList.contains('lk-near') && !xs('right').classList.contains('lk-near'), 'the pointer gone: both hide');
    assert.ok(w.doc.getElementById('lk-split-style')?.textContent.includes('#right-sidebar[data-lk-split] .cp__right-sidebar-topbar > *'), 'no tab row while the split is on');

    // A plain click, a Shift-click and a ⌘-click in the right half go to Logseq as before.
    w.logseqHeard.length = 0;
    w.press(w.link('#main-content-container', 'a.page-ref'));
    w.press(w.link('#main-content-container', 'a.page-ref'), { shiftKey: true });
    w.press(w.link('#right-sidebar [data-lk-split-item]', 'a.page-ref'), { metaKey: true });
    assert.deepEqual(w.logseqHeard, ['pointerdown', 'mousedown', 'click', 'pointerdown+shift', 'mousedown+shift', 'click+shift', 'pointerdown+meta', 'mousedown+meta', 'click+meta'], 'Logseq hears the presses that are not a ⌘-click in the main view');
    w.logseqHeard.length = 0;

    // Dragging the line: never narrower than 320 px; a double press: equal halves again.
    w.Door.split.state();   // (the share is read from the state)
    const line = w.doc.querySelector('.lk-split-line');
    const drag = x => { line.dispatchEvent(new w.win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 750 })); line.dispatchEvent(new w.win.MouseEvent('pointermove', { bubbles: true, clientX: x })); line.dispatchEvent(new w.win.MouseEvent('pointerup', { bubbles: true, clientX: x })); };
    drag(1400);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '320px', 'the right half stops at 320 px');
    drag(100);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '1180px', 'the left half stops at 320 px');
    drag(600);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '900px', 'the line follows the hand');
    line.dispatchEvent(new w.win.MouseEvent('dblclick', { bubbles: true }));
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '750px', 'a double press gives equal halves');

    // A ⌘-click on a tag while the split is on: the tag's page takes the right half, the page that was there leaves the list.
    w.press(w.link('#main-content-container', 'a.tag'), { metaKey: true });
    await w.settle();
    assert.deepEqual(w.logseqHeard, []);
    assert.equal(w.S().id, 3, 'Consultation is on the right');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [3, ':logseq-plugin/_sidebar.todo-side', 9], 'Dr. Mei Chen left the sidebar list');
    assert.equal(w.doc.querySelector('[data-lk-split-item] .lk-split-title')?.textContent, 'Consultation');
    assert.equal(w.doc.querySelectorAll('.lk-split-x[data-side="right"]').length, 1, 'one × on the right');

    // ⇄: the two pages change places.
    w.doc.querySelector('.lk-split-swap').click();
    await w.settle();
    assert.equal(w.shown(), 'Consultation', 'the right page went to the main view');
    assert.equal(w.S().id, 1, 'the left page went to the right half');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [1, ':logseq-plugin/_sidebar.todo-side', 9], 'one page in the list for the right half');
    assert.equal(w.doc.querySelector('[data-lk-split-item] .lk-split-title')?.textContent, 'Fatigue');

    // × on the right: the right half closes; the sidebar is as it was, on the tab it was on.
    w.doc.querySelector('.lk-split-x[data-side="right"]').click();
    await w.settle();
    assert.equal(w.S().id, null, 'the split is closed');
    assert.equal(w.shown(), 'Consultation', 'the left page stays and takes the whole width');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9], 'the sidebar list is as before the split');
    assert.equal(w.store['ui/sidebar-open?'], true, 'the sidebar is open, as it was');
    assert.ok(!w.doc.querySelector('[data-lk-split], [data-lk-split-item], .lk-split-own'), 'nothing of the split is left');
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '');
    assert.deepEqual(w.log.filter(l => l[0] === 'WRITE'), [], 'nothing is written to the graph');
  }

  // The sidebar closed before the split: × on the left puts the right page in the main view, and the sidebar is closed again.
  {
    const w = world({ sidebarOpen: false });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, 2);
    w.doc.querySelector('.lk-split-x[data-side="left"]').click();
    await w.settle();
    assert.equal(w.shown(), 'Dr. Mei Chen', 'the right page takes the main view');
    assert.equal(w.S().id, null);
    assert.equal(w.store['ui/sidebar-open?'], false, 'the sidebar is closed, as it was');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9]);
  }

  // A node's row (a block) opens beside too, without a title of the plugin's (Logseq shows the block itself).
  {
    const w = world();
    w.press(w.link('#main-content-container', '.lk-node'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, 4);
    assert.ok(!w.doc.querySelector('.lk-split-title'), 'a block has no title drawn over it');
  }

  // The real sidebar stays the person's: something opened in it by hand ends the split, the page beside stays in its list.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    w.store['sidebar/blocks'] = [[REPO, 3, 'page'], ...w.store['sidebar/blocks']];
    w.doc.querySelector('.sidebar-item-list').appendChild(w.doc.createElement('div'));   // Logseq redraws the list
    await sleep(20);
    w.doc.querySelector('.sidebar-item-list').innerHTML += '';
    await w.settle();
    assert.equal(w.S().id, null, 'the split ended');
    assert.ok(!w.doc.querySelector('[data-lk-split]'), 'the sidebar is drawn as Logseq draws it');
    assert.ok(w.store['sidebar/blocks'].some(e => e[1] === 2), 'the page that was beside is still among the opened ones');
  }

  // The sidebar closed by hand while the split is on: the split ends.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    w.store['ui/sidebar-open?'] = false;
    w.doc.querySelector('.sidebar-item-list').innerHTML = '';
    await w.settle();
    assert.equal(w.S().id, null);
    assert.ok(!w.doc.querySelector('.lk-split-own, [data-lk-split]'));
  }

  // The setting off: a ⌘-click goes to Logseq as a click does.
  {
    const w = world({ settings: { splitOnCmdClick: false } });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, null);
    assert.deepEqual(w.logseqHeard, ['pointerdown+meta', 'mousedown+meta', 'click+meta']);
  }

  // The plugin stopping with the split on closes it as its × would, and leaves nothing behind.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    await w.Door.split.stop();
    await w.settle();
    assert.equal(w.S().id, null);
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9], 'the page beside left the list');
    assert.ok(!w.doc.querySelector('.lk-split-own, [data-lk-split], [data-lk-split-item], #lk-split-style'), 'nothing left on the screen');
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, null, 'stopped, a ⌘-click is Logseq’s again');
  }

  // The settings window's row, and Logseq's settings list, hold the one setting.
  {
    const w = world();
    assert.equal(w.Door.described.plugin.schema[1].key, 'splitOnCmdClick');
    assert.equal(w.Door.described.plugin.schema[0].place, 'following', 'under Following links');
    assert.ok(w.Door.rootSchema.some(item => item.key === 'splitOnCmdClick' && item.default === true), 'on as it comes');
    assert.ok(fs.readFileSync(path.join(root, 'files.js'), 'utf8').includes("'split.js'"), 'loaded with the plugin');
  }
  console.log('split: ⌘-click opens beside, the line drags and swaps, × closes either half, the sidebar stays yours, nothing written');
})().catch(error => { console.error(error); process.exit(1); });
