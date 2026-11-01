/* node test/window.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-plugin/node_modules; without it the check is skipped)
   The export window drawn into a stand-in for Logseq's document (jsdom), on the hand-made document of test/sample.js: it
   is built from the visual grammar's shared names (Look gives them their look), its keys stay out of Logseq's reach,
   Escape closes it, ⌘-Enter presses the button that matches, and nothing is left behind when the plugin stops. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (error) { console.log('window: skipped, needs jsdom (set NODE_PATH)'); process.exit(0); }
const { logseq } = require('./graph.js');
const { root, order } = require('../../test/module.js')('export');
const dom = new JSDOM('<html><body><div id="head" class="drag-region"></div><div id="main-content-container"></div></body></html>', { pretendToBeVisual: true });
const hostDoc = dom.window.document;
const own = new JSDOM('<html><body></body></html>').window.document;   // the plugin's own frame
const sandbox = { window: { parent: { document: hostDoc }, document: own }, document: own, logseq, console, setTimeout, clearTimeout, Promise, URL, Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp, encodeURI, fetch: async () => { throw new Error('no network'); }, Blob: class {}, FileReader: class {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const file of [...order, 'export/test/sample.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (target, name, init = {}) => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
(async () => {
  await sleep(30);
  const E = sandbox.window.DbExport;
  const doc = E.sample();
  const acted = [];
  let reached = 0; hostDoc.addEventListener('keydown', () => { reached += 1; });   // what Logseq's own shortcuts would see
  const opened = E.ui.open({ doc, what: 'this page', act: async (ch, action) => { acted.push([action, ch.target, ch.layout, [...ch.hiddenNodes]]); } });
  const win = hostDoc.querySelector('.xp');
  assert.ok(win && hostDoc.getElementById('xp-style'), 'the window and its stylesheet are in Logseq’s document');
  assert.equal(own.querySelector('.xp'), null, 'nothing in the plugin’s own frame');
  assert.deepEqual([...win.querySelectorAll('.xp-where label')].map(l => l.textContent), ['PDF', 'Markdown', 'Rich text']);
  assert.equal(win.querySelector('.xp-where input:checked').value, 'pdf');
  // The property lists: the grammar's rows, ticks, names with the icon of what they hold, counts as lk-count.
  const lists = [...win.querySelectorAll('.xp-list.lk-list')];
  assert.deepEqual(lists.map(l => l.dataset.role), ['head', 'nodes']);
  const rows = [...lists[1].querySelectorAll('.xp-prop.lk-row')];
  assert.deepEqual(rows.map(r => r.querySelector('.lk-prop').textContent), ['Date', 'Deadline', 'End', 'Hospital', 'Provider', 'Severity', 'Topic']);
  assert.ok(rows.every(r => r.querySelector('input.lk-tick[type=checkbox]') && r.querySelector('.lk-count')), 'a tick and a count on every row');
  assert.ok(rows[0].querySelector('.xp-kind .ti-calendar') && rows[4].querySelector('.xp-kind svg') && rows[5].querySelector('.xp-kind .ti-123'), 'a calendar before Date, the web before Provider, 123 before Severity');
  // The Pressing set: every control a small name over a value; a pick wears the chevron and stands for a hidden select; a switch reads its state; a panel unfolds its row under the bar.
  const style = win.querySelector('.it[data-pick=xp-layout]');
  assert.equal(style.querySelector('.lk-name').textContent, 'style'); assert.equal(style.querySelector('.lk-value').firstChild.nodeValue, 'Document'); assert.ok(style.querySelector('.lk-value svg.m'), 'the chevron after the value');
  assert.ok(style.querySelector('select.xp-layout[hidden]'), 'the select stands behind the value'); assert.ok(style.querySelector('.lk-alts').hidden, 'folded at rest');
  style.querySelector('.lk-value').click(); assert.ok(!style.querySelector('.lk-alts').hidden && style.classList.contains('open'), 'pressed, it unfolds');
  const prose = [...style.querySelectorAll('.lk-alts span')].find(a => a.textContent === 'Outline'); prose.click();
  assert.equal(win.querySelector('select.xp-layout').value, prose.dataset.v, 'an alternative pressed sets the select'); assert.equal(style.querySelector('.lk-value').firstChild.nodeValue, 'Outline', 'and the value reads it'); assert.ok(style.querySelector('.lk-alts').hidden, 'and it folds');
  const tags = win.querySelector('.xp-tags').closest('.lk-value'); assert.equal(tags.lastChild.nodeValue, 'Tags'); tags.querySelector('input').checked = false; tags.querySelector('input').dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true }));
  assert.equal(tags.lastChild.nodeValue, 'No tags', 'a switch reads its state'); assert.ok(tags.classList.contains('off'));
  assert.equal(tags.closest('.it').querySelector('.lk-name').textContent, '', 'no name over a switch in Show: the value says its own word');
  // The Page row stays folded until Page is pressed, and a choice elsewhere does not open it; the Show lists are headed by whose they are over all / none, the one in force in the text colour.
  const pageFold = win.querySelector('.xp-fold[data-panel=xp-page]'); assert.ok(pageFold.hidden, 'the Page row is folded when the window opens'); assert.ok(pageFold.hidden, 'and stays folded after a choice');
  // Every pick inside a panel's row can be used: pressing it keeps the row, taking a value keeps the row and folds the pick.
  const layout = win.querySelector('[data-pick=xp-layout]'), plain = layout.querySelector('select').value;
  const setLayout = v => { layout.querySelector('.lk-value').click(); layout.querySelector(`.lk-alts span[data-v="${v}"]`).click(); };
  setLayout('timeline'); await sleep(200);   // Dates shows on a dated style
  for (const fold of win.querySelectorAll('.xp-fold')) for (const it of fold.querySelectorAll('.it[data-pick]')) {
    const value = win.querySelector(`.it[data-panel=${fold.dataset.panel}] > .lk-value`), was = it.querySelector('select').value, alts = it.querySelectorAll('.lk-alts span');
    value.click(); assert.ok(!fold.hidden, `${fold.dataset.panel} unfolds`);
    it.querySelector('.lk-value').click(); assert.ok(!fold.hidden && it.classList.contains('open') && !it.querySelector('.lk-alts').hidden, `${it.dataset.pick} opens in its row`);
    (alts[1] || alts[0]).click(); assert.ok(!fold.hidden && !it.classList.contains('open') && it.querySelector('.lk-alts').hidden, `taking a value of ${it.dataset.pick} leaves its row open`);
    assert.equal(it.querySelector('select').value, (alts[1] || alts[0]).dataset.v, 'and the value is taken');
    it.querySelector('.lk-value').click(); it.querySelector(`.lk-alts span[data-v="${was}"]`).click();
    value.click(); assert.ok(fold.hidden, 'pressed again, the panel folds');
  }
  setLayout(plain); await sleep(200);
  assert.deepEqual([...win.querySelectorAll('.xp-lists .lk-name')].map(n => n.textContent), ['of the page', 'of the nodes']);
  const all = win.querySelector('.xp-all[data-role=nodes]'); assert.deepEqual([...all.children].map(a => [a.textContent, a.classList.contains('on')]), [['all', true], ['none', false]]);
  all.querySelector('[data-all="0"]').click(); assert.deepEqual([...all.children].map(a => a.classList.contains('on')), [false, true], 'none pressed: none in force'); all.querySelector('[data-all="1"]').click();
  const note = win.querySelector('.xp-note'); assert.ok(note.children.length === 1 && note.firstElementChild.dataset.pick === 'xp-zoom' && !note.querySelector('.xp-note-text'), 'over the desk, the size pick alone, no sentence');
  assert.ok(win.querySelector('button.lk-accent[data-act=pdf]') && win.querySelector('button.lk-close'), 'the accent and the × at the end');
  // Keys typed in the window never reach Logseq; Escape does, and folds an open panel first, then closes the window.
  key(win.querySelector('.xp-footer'), 'e'); assert.equal(reached, 0, 'a letter typed in a field stays in the window');
  const show = win.querySelector('.it[data-panel=xp-show]'), fold = win.querySelector('.xp-fold[data-panel=xp-show]'); show.querySelector('.lk-value').click(); assert.ok(!fold.hidden, 'the panel unfolds under the bar');
  key(win.querySelector('.xp-footer'), 'Escape'); assert.ok(fold.hidden, 'Escape folds the open panel'); assert.ok(hostDoc.querySelector('.xp'), 'the window stays');
  // ⌘-Enter presses the button that matches the destination; an unticked property is left out.
  rows[4].querySelector('input').checked = false;
  win.querySelector('input[name=xp-target][value=md]').checked = true;
  key(hostDoc.body, 'Enter', { metaKey: true });
  await opened;
  assert.deepEqual(acted, [['md', 'md', 'outline', ['user.property/provider']]], 'the export ran with the choices made');
  assert.equal(hostDoc.querySelector('.xp'), null, 'the window is gone after the export');
  assert.equal(logseq.settings.target, 'md', 'the choice is remembered');
  // The same choices again: nothing is saved, since every save tells every module.
  const sends = [], write = logseq.updateSettings;
  logseq.updateSettings = values => { sends.push(values); write.call(logseq, values); };
  const again = E.ui.open({ doc, what: 'this page', act: async () => {} });
  key(hostDoc.body, 'Enter', { metaKey: true }); await again;
  assert.deepEqual(sends, [], 'an export that changes no choice saves no setting');
  logseq.updateSettings = write;
  // Left out on another page, and not listed here: stays left out, while what this page lists follows its ticks.
  logseq.settings.hiddenHeadProperties = ['user.property/private'];
  let chosen = null;
  const kept = E.ui.open({ doc, what: 'this page', act: async ch => { chosen = ch; } });
  const heads = [...hostDoc.querySelectorAll('.xp-list[data-role=head] input')]; heads[0].checked = false; heads[0].dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true }));
  key(hostDoc.body, 'Enter', { metaKey: true }); await kept;
  assert.ok(chosen.hiddenHead.has('user.property/private') && chosen.hiddenHead.has(heads[0].value), 'kept across pages, with this page\'s tick');
  heads[0].checked = true;
  // A cancel: the window stays, with what was chosen; a finish closes it. A failure the same.
  let answer = false, left = 0;
  const stays = E.ui.open({ doc, what: 'this page', act: async () => { left += 1; if (answer instanceof Error) throw answer; return answer; } });
  key(hostDoc.body, 'Enter', { metaKey: true }); await sleep(20);
  assert.ok(hostDoc.querySelector('.xp') && !hostDoc.querySelector('.xp').hidden, 'a cancel leaves the window open and shown'); assert.equal(left, 1);
  answer = new Error('no room'); key(hostDoc.body, 'Enter', { metaKey: true }); await sleep(20); assert.ok(hostDoc.querySelector('.xp'), 'a failure too');
  answer = undefined; key(hostDoc.body, 'Enter', { metaKey: true }); await stays; assert.equal(hostDoc.querySelector('.xp'), null, 'a finish closes it');
  { const print = E.print.print; E.print.print = async () => {}; assert.equal(await E.app.act(doc, { ...E.ui.read(), target: 'pdf' }, 'pdf', null), false, 'the print window does not say it saved, so the window stays'); E.print.print = print;
    const save = E.files.save; E.files.save = async () => ({ saved: false }); assert.equal(await E.app.act(doc, E.ui.read(), 'md-file', null), false, 'a folder not chosen is a cancel'); E.files.save = async () => ({ saved: true, path: 'x' }); assert.equal(await E.app.act(doc, E.ui.read(), 'md-file', null), true); E.files.save = save; }
  // Words changed in the preview: kept by a change of look, and said to go when the words themselves are drawn again.
  { const bodies = [], real = E.app.pageHtml, msgs = [], show = logseq.UI.showMsg; E.app.pageHtml = async (d, ch, o) => { bodies.push(o.body ?? null); return '<html></html>'; }; logseq.UI.showMsg = text => msgs.push(text);
    const w = E.ui.open({ doc, what: 'this page', act: async () => true });
    const xp = hostDoc.querySelector('.xp'), q = s => xp.querySelector(s), radio = v => { const r = q(`input[name=xp-target][value=${v}]`); r.checked = true; r.dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true })); };
    const redrawn = async () => { await sleep(190); };
    radio('rich'); await redrawn();
    const frame = q('.xp-desk iframe'); frame.onload?.(); await sleep(5);
    const d = frame.contentDocument; d.body.innerHTML = '<div class="x-doc">changed words</div>'; d.dispatchEvent(new dom.window.Event('input'));
    bodies.length = 0; const look = q('select.xp-look'); look.value = 'book'; look.dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true })); await redrawn();
    assert.deepEqual(bodies, ['changed words'], 'a look keeps them'); assert.deepEqual(msgs, []);
    bodies.length = 0; const box = q('.xp-tags'); box.checked = !box.checked; box.dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true })); await redrawn();
    assert.deepEqual(bodies, [null], 'a change of what is on the sheet draws it from the page'); assert.ok(msgs[0]?.includes('words changed in it went'), 'and says so');
    key(hostDoc.body, 'Escape'); await w; E.app.pageHtml = real; logseq.UI.showMsg = show; }
  // A file of that name is left alone.
  { const taken = new Set(['/d/Notes.md', '/d/Notes 2.md', '/d/Plain']), apis = { doAction: async ([, path]) => taken.has(path) ? { size: 1 } : null };
    assert.equal(await E.files.freePath(apis, '/d', 'Notes.md'), '/d/Notes 3.md'); assert.equal(await E.files.freePath(apis, '/d', 'Free.md'), '/d/Free.md'); assert.equal(await E.files.freePath(apis, '/d', 'Plain'), '/d/Plain 2'); }
  // Escape alone closes it; the sweep takes the stylesheet too.
  E.ui.open({ doc, what: 'this page', act: async () => {} });
  key(hostDoc.body, 'Escape');
  assert.equal(hostDoc.querySelector('.xp'), null, 'Escape closes the window');
  E.ui.sweep();
  assert.equal(hostDoc.querySelectorAll('.xp, #xp-style').length, 0, 'nothing left in Logseq’s document');
  console.log('  ok  the export window: in Logseq’s document, the grammar’s names, keys kept, Escape and ⌘-Enter, swept');

  // The preview's sheets, on set heights (a sheet holds 1000): a heading goes over with what follows it, and when what
  // follows is taller than a whole sheet can give it after the heading, the heading stays and the dealing goes on.
  const sheets = new JSDOM('<html><head></head><body></body></html>').window, deal = html => {
    const d = sheets.document, heights = el => [...el.querySelectorAll('[data-h]')].reduce((sum, n) => sum + Number(n.dataset.h), 0);
    for (const p of d.querySelectorAll('.pv-page, .x-doc')) p.remove();
    d.body.insertAdjacentHTML('beforeend', `<div class="x-doc">${html}</div>`);
    let asked = 0;
    Object.defineProperty(sheets.HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { if (++asked > 500) throw new Error('sheets for ever'); return heights(this); } });
    Object.defineProperty(sheets.HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 1000; } });
    const n = E.preview.paginate(d, { paper: 'A4' });
    return { n, pages: [...d.querySelectorAll('.pv-page .x-doc')].map(page => [...page.children].map(c => c.id)) };
  };
  assert.deepEqual(deal('<p id="a" data-h="900"></p><h2 id="b" data-h="50"></h2><p id="c" data-h="300"></p>').pages, [['a'], ['b', 'c']], 'a heading never ends a sheet');
  assert.deepEqual(deal('<h2 id="a" data-h="50"></h2><p id="b" data-h="1500"></p><p id="c" data-h="100"></p>').pages, [['a'], ['b'], ['c']], 'a heading before something too tall stays, and the dealing goes on');
  assert.deepEqual(deal('<h1 id="a" data-h="50"></h1><h2 id="b" data-h="50"></h2><p id="c" data-h="950"></p>').pages, [['a', 'b'], ['c']], 'two headings the same');
  assert.deepEqual(deal('<p id="a" data-h="900"></p><div id="t" class="x-head" data-h="50"></div><p id="b" data-h="1500"></p>').pages, [['a'], ['t'], ['b']], 'moved to a new sheet first, then the same');
  console.log('  ok  the preview’s sheets: a heading before something too tall never deals sheets for ever');
  process.exit(0);
})().catch(error => { console.error('FAIL ', error); process.exit(1); });
