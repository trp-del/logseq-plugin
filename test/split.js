/* node test/split.js   (needs jsdom: NODE_PATH, see README)
   Two pages side by side (split.js), against a stand-in Logseq whose right sidebar draws its list as Logseq 2.0.2 does (newest
   on top, each item with its ×): a ⌘-click on a page's link or a tag in the main view opens it beside, Logseq never hearing the
   press; a plain click, a Shift-click, a ⌘-click in the sidebar and a ⌘-click with the setting off go to Logseq as before; the
   halves are equal, a drag keeps each at least 320 px, a double press makes them equal again; another ⌘-click puts another page
   on the right; ⇄ and × stand in the window's top right corner, always shown; ⇄ swaps the pages; × closes the right half (⇄ then × the left), and the sidebar is then as it was (open or
   closed, its list in its order, a page that was in it before kept, its tab); anything opened in the sidebar by hand, or the sidebar closed, ends the split without taking it
   from the list; the plugin stopping leaves nothing behind; and nothing is ever written to the graph. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REPO = 'logseq_db_Test';
const U = n => `1a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// What a real browser shows: jsdom lets the last !important rule win whatever its weight, so which item Logseq's Chromium hides is
// asked of Playwright's Chromium, with the stand-in's stylesheets in their order and its sidebar as it stands.
async function chromeDisplay(w, selectors) {
  let chromium; try { ({ chromium } = require('playwright')); } catch (error) { return null; }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const sheets = [...w.doc.head.querySelectorAll('style')].map(el => `<style>${el.textContent}</style>`).join('');
    await page.setContent(`<html><head>${sheets}</head><body>${w.doc.getElementById('right-sidebar').outerHTML}</body></html>`);
    return await page.evaluate(list => list.map(sel => getComputedStyle(document.querySelector(sel)).display), selectors);
  } finally { await browser.close(); }
}

function world({ sidebarOpen = true, settings = {}, list = null, keyed = false, blank = null } = {}) {
  const dom = new JSDOM(`<html><head></head><body><main id="app-container-wrapper"><div id="app-container"><div id="left-container"><div id="main-container"><div id="left-sidebar"></div><div id="main-content-container"></div></div></div><div id="right-sidebar" class="cp__right-sidebar" data-lk-tab="todo"><div class="resizer" role="separator"></div><div class="cp__right-sidebar-inner"><div class="cp__right-sidebar-topbar"><div class="cp__right-sidebar-settings"></div></div><div class="sidebar-item-list"></div></div></div></div></main></body></html>`, { pretendToBeVisual: true, url: 'http://localhost/' });
  const win = dom.window, doc = win.document;
  Object.defineProperty(win, 'innerWidth', { value: 1500, configurable: true });
  const nodes = { [U(1)]: { id: 1, uuid: U(1), title: 'Fatigue' }, [U(2)]: { id: 2, uuid: U(2), title: 'Dr. Mei Chen' }, [U(3)]: { id: 3, uuid: U(3), title: 'Consultation', ident: ':user.class/Consultation' }, [U(4)]: { id: 4, uuid: U(4), title: 'Spoke with her', page: { id: 1 } } };
  const store = { 'sidebar/blocks': list || [[REPO, ':logseq-plugin/_sidebar.todo-side', 'plugin'], [REPO, 9, 'page']], 'ui/sidebar-open?': sidebarOpen };
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
    // keyed: an item already drawn keeps its element when it moves to the top, as Logseq's React list does with a page opened there
    // again. blank: the id of a node Logseq draws with nothing in it (a page it cannot show).
    const kept = keyed ? new Map([...list.querySelectorAll(':scope > .sidebar-item')].map(el => [el.dataset.id, el])) : new Map();
    const html = (id, type) => `<div class="sidebar-drop-indicator"></div><div class="sidebar-item item-type-${type}" data-id="${id}"><div class="sidebar-item-header">${id}<div class="item-actions"><button class="ui__button"><span class="ls-icon-x"></span></button></div></div><div class="sidebar-panel-content">${String(id) === String(blank) ? '' : `<div class="page"><div class="ls-page-blocks"><span class="bullet-container"></span><a class="page-ref" data-uuid="${U(3)}">Consultation</a></div></div>`}</div></div>`;
    const entries = store['ui/sidebar-open?'] ? store['sidebar/blocks'] : [];
    list.innerHTML = entries.map(([, id, type]) => kept.has(String(id)) ? `<div class="sidebar-drop-indicator"></div><i data-keep="${id}"></i>` : html(id, type)).join('');
    for (const slot of list.querySelectorAll('i[data-keep]')) slot.replaceWith(kept.get(slot.dataset.keep));
    for (const button of list.querySelectorAll('.ls-icon-x')) if (!button.dataset.heard && (button.dataset.heard = '1')) button.closest('button').addEventListener('click', event => { const id = event.target.closest('.sidebar-item').dataset.id; log.push(['sidebar ×', id]); store['sidebar/blocks'] = store['sidebar/blocks'].filter(e => String(e[1]) !== id); setTimeout(drawSide, 5); });
  };
  drawMain(); drawSide();
  // Logseq hears a press on a link (a click goes to the page): anything that reaches it is logged.
  for (const type of ['pointerdown', 'mousedown', 'click']) doc.addEventListener(type, event => { if (event.target.closest?.('a')) logseqHeard.push(type + (event.metaKey ? '+meta' : '') + (event.shiftKey ? '+shift' : '')); });
  win.logseq = { api: { get_state_from_store: key => store[key] } };
  const sidebarVisible = on => { store['ui/sidebar-open?'] = on; setTimeout(drawSide, 5); };
  const settingsNow = { ...settings };
  const byId = id => typeof id === 'number' ? Object.values(nodes).find(n => n.id === id) : nodes[id];
  const read = { getPage: async uuid => (byId(uuid) && !byId(uuid).page ? byId(uuid) : null), getBlock: async uuid => byId(uuid) || null, getCurrentPage: async () => nodes[shown] };
  // Only reads and what changes the screen: any write to the graph would be a call this stand-in does not have, and is logged.
  const Editor = new Proxy({ ...read,
    // As Logseq 2.0.2 does: a node, or the plugin's own view ('_sidebar.<key>'), goes to the top of the list, never twice.
    openInRightSidebar: async uuid => { const own = String(uuid).startsWith('_sidebar.'), n = own ? { id: ':logseq-plugin/' + uuid, title: uuid } : nodes[uuid]; log.push(['open beside', n.title]); store['sidebar/blocks'] = [[REPO, n.id, own ? 'plugin' : n.page ? 'block' : 'page'], ...store['sidebar/blocks'].filter(e => e[1] !== n.id)]; store['ui/sidebar-open?'] = true; setTimeout(drawSide, 5); },
  }, { get: (o, k) => k in o ? o[k] : (...args) => { log.push(['WRITE', k, args]); } });
  const logseq = { settings: settingsNow, Editor, App: { pushState: (_, { name }) => { log.push(['go to', nodes[name].title]); shown = name; setTimeout(drawMain, 5); }, setRightSidebarVisible: sidebarVisible }, UI: { showMsg: text => log.push(['notice', text]) },
    // As Logseq does: a plugin's style goes into the page's head after everything there, the split's own sheet included.
    provideStyle({ key, style }) { let el = doc.head.querySelector(`style[data-injected-style="${key}"]`); if (!el) { el = doc.createElement('style'); el.setAttribute('data-injected-style', key); } el.textContent = style; doc.head.appendChild(el); } };
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
    const heard = [];   // what a module drawing on the right page (Threads) hears of it
    w.Door.split.onChange(() => heard.push(JSON.parse(JSON.stringify(w.Door.split.page()))));   // as plain objects of this side (the plugin runs in a context of its own)
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.deepEqual(w.logseqHeard, [], 'Logseq does not hear the ⌘-click, so it does not go to the page');
    assert.deepEqual(heard, [{ uuid: U(2), page: true }], 'the page on the right is told as it changes');
    assert.ok(!w.doc.querySelector('[data-lk-split-item]').hasAttribute('data-lk-split-kind') && !w.doc.querySelector('.lk-split-icon'), 'a plain page has no # or P before its title');
    assert.equal(w.S().id, 2, 'Dr. Mei Chen is on the right');
    assert.equal(w.shown(), 'Fatigue', 'the page on the left stays');
    const side = w.doc.getElementById('right-sidebar');
    assert.ok(side.hasAttribute('data-lk-split'), 'the sidebar is the right half');
    const item = side.querySelector('[data-lk-split-item]');
    assert.equal(item?.dataset.id, '2', 'only the page opened beside is shown there');
    assert.equal(item.querySelector('.lk-split-title')?.textContent, 'Dr. Mei Chen', 'the page has its title over it');
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '750px', 'equal halves of the main area');
    // ⇄ and × in the window's top right corner, always shown, drawn as Logseq's toolbar icons; nothing on the line or the pages.
    const corner = w.doc.querySelector('body > .lk-split-tools');
    assert.ok(corner, 'the corner icons are there while the split is on');
    assert.deepEqual([...corner.children].map(a => [a.tagName, a.className, a.title]), [['A', 'button lk-tool lk-split-swap', 'Swap pages'], ['A', 'button lk-tool lk-split-x', 'Close the right page']], 'two of Logseq\'s toolbar icons: swap, then close');
    assert.ok([...corner.children].every(a => a.querySelector('svg.tabler-icon[width="20"]')), 'Tabler line icons at 20 px, as Logseq\'s');
    assert.ok(!corner.querySelector('.lk-reveal') && !corner.classList.contains('lk-reveals'), 'shown at rest, not under the pointer');
    assert.ok(!w.doc.querySelector('.lk-split-line *'), 'nothing on the line');
    assert.equal(w.doc.querySelectorAll('.lk-split-x, .lk-split-swap').length, 2, 'no × of a page beside the two corner icons');
    assert.ok(/body > \.lk-split-tools \{ position: fixed;[^}]*right: var\(--lk-split-edge/.test(w.doc.getElementById('lk-split-style').textContent), 'at the window\'s right edge');
    assert.ok(w.doc.getElementById('lk-split-style')?.textContent.includes('-webkit-app-region: no-drag'), 'the icons are cut out of the header band, so a mouse press reaches them');
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
    const drag = x => { line.dispatchEvent(new w.win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 1500 - parseFloat(w.doc.documentElement.style.getPropertyValue('--lk-split-w')) }));   // taken on the line itself
    line.dispatchEvent(new w.win.MouseEvent('pointermove', { bubbles: true, clientX: x })); line.dispatchEvent(new w.win.MouseEvent('pointerup', { bubbles: true, clientX: x })); };
    drag(1400);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '320px', 'the right half stops at 320 px');
    drag(100);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '1180px', 'the left half stops at 320 px');
    drag(600);
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '900px', 'the line follows the hand');
    // Taken 6 px into the strip, right of the line: the line keeps that distance from the hand, it does not jump to it.
    line.dispatchEvent(new w.win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 606 })); line.dispatchEvent(new w.win.MouseEvent('pointermove', { bubbles: true, clientX: 606 })); line.dispatchEvent(new w.win.MouseEvent('pointerup', { bubbles: true, clientX: 606 }));
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '900px', 'taken right of the line, the line stays put');
    assert.ok(/body > \.lk-split-line \{[^}]*left: calc\(100vw - var\(--lk-split-w, 50vw\)\);/.test(w.doc.getElementById('lk-split-style').textContent), 'the strip starts at the line and reaches only into the right page, clear of the left page\'s scroll bar');
    line.dispatchEvent(new w.win.MouseEvent('dblclick', { bubbles: true }));
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '750px', 'a double press gives equal halves');

    // A ⌘-click on a tag while the split is on: the tag's page takes the right half, the page that was there leaves the list.
    w.press(w.link('#main-content-container', 'a.tag'), { metaKey: true });
    await w.settle();
    assert.deepEqual(w.logseqHeard, []);
    assert.equal(w.S().id, 3, 'Consultation is on the right');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [3, ':logseq-plugin/_sidebar.todo-side', 9], 'Dr. Mei Chen left the sidebar list');
    assert.equal(w.doc.querySelector('[data-lk-split-item] .lk-split-title')?.textContent, 'Consultation');
    assert.equal(w.doc.querySelector('[data-lk-split-item]').getAttribute('data-lk-split-kind'), 'tag', 'a tag\'s page is marked, so its property list is left out as on the main view');
    assert.ok(w.doc.querySelector('[data-lk-split-item] .lk-split-title > svg.lk-split-icon:first-child + .lk-split-name'), 'Logseq\'s # stands before a tag\'s name, as on the main view');
    assert.equal(w.doc.querySelectorAll('.lk-split-tools').length, 1, 'one pair of corner icons');

    // ⇄: the two pages change places.
    w.doc.querySelector('.lk-split-swap').click();
    await w.settle();
    assert.equal(w.shown(), 'Consultation', 'the right page went to the main view');
    assert.equal(w.S().id, 1, 'the left page went to the right half');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [1, ':logseq-plugin/_sidebar.todo-side', 9], 'one page in the list for the right half');
    assert.equal(w.doc.querySelector('[data-lk-split-item] .lk-split-title')?.textContent, 'Fatigue');

    // × on the right: the right half closes; the sidebar is as it was, on the tab it was on.
    w.doc.querySelector('.lk-split-tools .lk-split-x').click();
    await w.settle();
    assert.equal(w.S().id, null, 'the split is closed');
    assert.deepEqual(heard.map(now => now?.uuid ?? null), [U(2), U(3), U(1), null], 'told of each page on the right, then of the split\'s end');
    assert.equal(w.Door.split.page(), null);
    assert.equal(w.shown(), 'Consultation', 'the left page stays and takes the whole width');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9], 'the sidebar list is as before the split');
    assert.equal(w.store['ui/sidebar-open?'], true, 'the sidebar is open, as it was');
    assert.ok(!w.doc.querySelector('[data-lk-split], [data-lk-split-item], .lk-split-own'), 'nothing of the split is left');
    assert.equal(w.doc.documentElement.style.getPropertyValue('--lk-split-w'), '');
    assert.deepEqual(w.log.filter(l => l[0] === 'WRITE'), [], 'nothing is written to the graph');
  }

  // The sidebar closed before the split: ⇄ then × puts the right page in the main view alone, and the sidebar is closed again.
  {
    const w = world({ sidebarOpen: false });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, 2);
    w.doc.querySelector('.lk-split-tools .lk-split-swap').click();
    await w.settle();
    w.doc.querySelector('.lk-split-tools .lk-split-x').click();
    await w.settle();
    assert.equal(w.shown(), 'Dr. Mei Chen', 'the right page takes the main view');
    assert.equal(w.S().id, null);
    assert.equal(w.store['ui/sidebar-open?'], false, 'the sidebar is closed, as it was');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9]);
  }

  // A page that was already in the sidebar before the split stays in it, and the list is put back in its old order: ⌘-click on it,
  // then × on the right; ⌘-click on another page, ⇄ twice (the page on the left was in the list too), ⌘-click on a third, × on the left.
  {
    const before = [[REPO, 3, 'page'], [REPO, ':logseq-plugin/_sidebar.todo-side', 'plugin'], [REPO, 2, 'page'], [REPO, 1, 'page'], [REPO, 9, 'page']];
    const ids = w => w.store['sidebar/blocks'].map(e => e[1]), was = before.map(e => e[1]);
    let w = world({ list: before.map(e => [...e]) });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });   // Dr. Mei Chen, third in the list
    await w.settle();
    assert.equal(ids(w)[0], 2, 'opened beside, it stands at the top while the split is on');
    w.doc.querySelector('.lk-split-tools .lk-split-x').click();
    await sleep(400);
    assert.equal(w.S().id, null);
    assert.deepEqual(ids(w), was, 'closed: every item still there, in its old order');

    w = world({ list: before.map(e => [...e]) });
    w.press(w.link('#main-content-container', 'a.tag'), { metaKey: true });   // Consultation, first in the list
    await w.settle();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });   // Dr. Mei Chen takes the right half
    await w.settle();
    assert.ok(ids(w).includes(3), 'the page that gave way stays: it was in the list before');
    w.doc.querySelector('.lk-split-swap').click();   // Fatigue (in the list) to the right, Dr. Mei Chen to the left
    await w.settle();
    assert.equal(w.S().id, 1);
    assert.ok(ids(w).includes(2), '⇄ keeps the page that was in the list before');
    w.doc.querySelector('.lk-split-swap').click();
    await w.settle();
    assert.ok(ids(w).includes(1), '⇄ back keeps the other one too');
    await w.Door.split.close('left');
    await sleep(400);
    assert.equal(w.S().id, null);
    assert.deepEqual(ids(w), was, 'closed from the left: every item still there, in its old order');
    assert.deepEqual(w.log.filter(l => l[0] === 'WRITE'), [], 'nothing is written to the graph');
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

  // The owner's white half (14 November 2026): the sidebar's tabs on a view of the plugin's (Todo), and the page ⌘-clicked already
  // among Opened, so Logseq moves its item to the top without drawing it anew and the tabs leave it unmarked. The tabs' rule that
  // hides every item but the tab's comes after the split's in the page (Logseq puts it there) and weighs the same: the page beside
  // was hidden. Now the split's item shows whatever the tab, and the half holds the page.
  {
    const w = world({ keyed: true, list: [[REPO, ':logseq-plugin/_sidebar.todo-side', 'plugin'], [REPO, 2, 'page'], [REPO, 9, 'page']] });
    const todo = w.doc.querySelector('[data-id=":logseq-plugin/_sidebar.todo-side"]');
    w.Door.sideTabs.add({ key: 'todo', word: 'Todo', order: 1, find: doc => doc.querySelector('.sidebar-item[data-id=":logseq-plugin/_sidebar.todo-side"]'), open() {} });
    w.Door.sideTabs.pick('todo');
    const item = w.doc.querySelector('.sidebar-item[data-id="2"]');
    const SEL = ['.sidebar-item[data-id="2"]', '.sidebar-item[data-id=":logseq-plugin/_sidebar.todo-side"]'];
    const before = await chromeDisplay(w, SEL);
    if (before) assert.deepEqual(before, ['none', 'block'], 'before: Dr. Mei Chen is among Opened, hidden under the Todo tab');
    assert.ok(todo.hasAttribute('data-lk-tab-on'), 'the Todo tab is picked');
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await sleep(400);
    w.Door.sideTabs.draw();
    assert.equal(w.S().id, 2, 'Dr. Mei Chen is on the right');
    assert.equal(w.doc.querySelector('.sidebar-item[data-id="2"]'), item, 'Logseq kept the item\'s element, moved to the top');
    assert.ok(!item.hasAttribute('data-lk-tab-on'), 'the tabs still have Todo picked, so they leave the item unmarked');
    assert.ok(item.hasAttribute('data-lk-split-item'), 'the split marks it');
    assert.ok(w.doc.head.querySelector('style[data-injected-style]') === w.doc.head.lastElementChild, 'the tabs\' sheet stands after the split\'s, as in Logseq');
    const during = await chromeDisplay(w, SEL);
    if (during) assert.deepEqual(during, ['flex', 'none'], 'the page beside is shown, the Todo view is not: no white half');
    else console.log('split: the white-half case checked without a browser (no Playwright)');
    assert.ok(!w.log.some(e => e[0] === 'notice'), 'no notice');
    await w.Door.split.close('right');
    await w.settle();
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 2, 9], 'the sidebar as it was, Dr. Mei Chen kept among Opened');
  }

  // A page Logseq cannot show in the sidebar (its item stays empty): within a moment the split closes as its × would, the sidebar
  // is as it was, and one plain notice says what happened. Never a white half left standing.
  {
    const w = world({ blank: 2 });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await sleep(3200);
    assert.equal(w.S().id, null, 'the split closed');
    assert.ok(!w.doc.querySelector('.lk-split-own, [data-lk-split], [data-lk-split-item]'), 'nothing of the split left on the screen');
    assert.deepEqual(w.store['sidebar/blocks'].map(e => e[1]), [':logseq-plugin/_sidebar.todo-side', 9], 'the page that could not be shown left the list');
    assert.ok(w.store['ui/sidebar-open?'], 'the sidebar open, as it was');
    assert.deepEqual(w.log.filter(e => e[0] === 'notice'), [['notice', 'The page could not be shown beside, so the two pages were put back as one.']], 'one plain notice');
    assert.equal(w.shown(), 'Fatigue', 'the page on the left stays');
  }
  // The sidebar closed before, and the page cannot be shown: the sidebar is closed again.
  {
    const w = world({ blank: 2, sidebarOpen: false });
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await sleep(3200);
    assert.equal(w.S().id, null, 'the split closed');
    assert.equal(w.store['ui/sidebar-open?'], false, 'the sidebar closed again');
    assert.equal(w.log.filter(e => e[0] === 'notice').length, 1, 'one notice');
  }
  // The page beside vanishing from the screen while the split is on (Logseq drawing the item anew, empty): the split closes too.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, 2);
    w.doc.querySelector('[data-lk-split-item] .sidebar-panel-content').replaceChildren();
    await sleep(3200);
    assert.equal(w.S().id, null, 'the split closed rather than stand empty');
    assert.equal(w.log.filter(e => e[0] === 'notice').length, 1, 'one notice');
  }

  // The page hidden by a rule while the split is on, a change Logseq's page reports to no watcher: the split's own once-a-second
  // look finds it, and the split closes rather than stand empty.
  {
    const w = world();
    w.press(w.link('#main-content-container', 'a.page-ref'), { metaKey: true });
    await w.settle();
    assert.equal(w.S().id, 2);
    const rule = w.doc.createElement('style'); rule.textContent = '#right-sidebar .sidebar-item-list { display: none !important; }';
    w.doc.head.appendChild(rule);
    await sleep(4200);
    assert.equal(w.S().id, null, 'the split closed');
    assert.equal(w.log.filter(e => e[0] === 'notice').length, 1, 'one notice');
    rule.remove();
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
  process.exit(0);   // the worlds left with a split on keep its once-a-second look running
})().catch(error => { console.error(error); process.exit(1); });
