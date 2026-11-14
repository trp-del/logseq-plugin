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
  // The bar at rest: Adjust, the template, where the export goes as tabs (the library's lk-view, the one in force "on"), the accent. The choices are in the column, put away until Adjust is pressed.
  assert.deepEqual([...win.querySelectorAll('.xp-bar .g:not(.end) .lk-name')].map(n => n.textContent), ['', 'export as']);
  assert.ok([...win.querySelectorAll('.xp-where label')].every(l => l.classList.contains('lk-view')) && win.querySelector('.xp-where label.on input').value === 'pdf', 'tabs, PDF in force');
  const side = win.querySelector('.xp-side'), adjust = win.querySelector('.xp-adjust');
  assert.ok(side.hidden && adjust.getAttribute('aria-pressed') === 'false', 'the column is put away at rest');
  adjust.click(); assert.ok(!side.hidden && adjust.classList.contains('on') && logseq.settings.sideOpen === true, 'Adjust shows the column, and it is remembered');
  adjust.click(); assert.ok(side.hidden && logseq.settings.sideOpen === false, 'pressed again, it is put away'); adjust.click();
  // The column is the library's menu laid open: a heading for each part (lk-group) after a gap, rows that are lk-item, what a row holds as lk-note.
  assert.deepEqual([...side.querySelectorAll('.xp-group:not(.xp-first)')].map(g => g.querySelector('.lk-group').textContent), ['Text', 'Prose', 'Timeline and Calendar', 'Look', 'Markdown', 'Title', 'Show', 'Your CSS']);
  assert.ok([...side.querySelectorAll('.xp-group:not(.xp-first)')].every(g => g.firstElementChild.matches('.lk-item.gap') && g.children[1].matches('.lk-group')), 'a gap, then the heading: the library draws the hairline between parts');
  assert.ok([...side.querySelectorAll('.xp-tplhead, .xp-rowhead, .xp-opt, .xp-sw, .xp-fieldrow')].every(r => r.classList.contains('lk-item')), 'every row is the library’s item');
  assert.ok(side.firstElementChild.matches('.xp-group.xp-first') && side.firstElementChild.querySelector('.xp-tpl .xp-tplhead') && !side.firstElementChild.querySelector('.lk-group') && !win.querySelector('.xp-bar .xp-tpl'), 'the template is the column’s first row, with no heading over it, not on the bar');
  assert.ok(/\.xp-side \{[^}]*overflow-anchor: none/.test(E.ui.CSS), 'the column’s scroll is never moved by the browser when a part changes height');
  assert.ok(win.querySelector('.xp-bar button.lk-accent') && !/\.xp-bar button:where\(:not\(\.lk-btn\)\)/.test(E.ui.CSS), 'the bar’s reset leaves the library’s main button as the library draws it');
  assert.ok(side.querySelector('.xp-group[data-for=md]').hidden && !side.querySelector('.xp-group[data-for="pdf rich"]').hidden, 'only the parts of the destination');
  // A row that holds one of several: its value at the right; pressed, the several unfold under it with the one in force ticked; one pressed is taken and the row folds.
  const style = side.querySelector('.xp-pickrow[data-row=xp-layout]'), head = style.querySelector('.xp-rowhead'), opts = style.querySelector('.xp-opts');
  assert.equal(head.firstElementChild.textContent, 'Style'); assert.equal(head.querySelector('.lk-note.xp-val').textContent, 'Document');
  assert.ok(style.querySelector('select.xp-layout[hidden]') && opts.hidden && head.getAttribute('aria-expanded') === 'false', 'folded at rest');
  head.click(); assert.ok(!opts.hidden && style.classList.contains('open') && head.getAttribute('aria-expanded') === 'true', 'pressed, it unfolds');
  assert.ok(opts.matches('.lk-pop.lk-menu'), 'as the library’s pop-up menu, over the rows, so nothing in the column moves');
  assert.deepEqual([...opts.querySelectorAll('.xp-opt')].filter(o => o.lastElementChild.classList.contains('lk-check')).map(o => o.firstElementChild.textContent), ['Document'], 'the one in force is ticked');
  [...opts.querySelectorAll('.xp-opt')].find(o => o.firstElementChild.textContent === 'Outline').click();
  assert.equal(win.querySelector('select.xp-layout').value, 'outline'); assert.equal(head.querySelector('.xp-val').textContent, 'Outline', 'the value reads it'); assert.ok(opts.hidden && !style.classList.contains('open'), 'and the row folds');
  // A row that is on or off: a tick while on; the whole row is pressed; Enter turns it too.
  const tags = win.querySelector('.xp-tags').closest('.xp-sw'); assert.ok(!tags.classList.contains('xp-off') && tags.getAttribute('aria-checked') === 'true' && tags.querySelector('.lk-note').classList.contains('lk-check'));
  tags.querySelector('input').checked = false; tags.querySelector('input').dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true }));
  assert.ok(tags.classList.contains('xp-off') && tags.getAttribute('aria-checked') === 'false', 'off: no tick');
  key(tags, 'Enter'); assert.ok(win.querySelector('.xp-tags').checked, 'Enter on the row turns it on'); tags.querySelector('input').checked = false; tags.querySelector('input').dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true }));
  assert.ok(win.querySelector('.xp-footer').matches('.xp-fieldrow input.lk-field'), 'a row that is written in holds the library’s field');
  // The rows of a style show only on that style; every such row opens and takes a value, one open at a time. Down walks the rows.
  const setLayout = v => { head.click(); opts.querySelector(`.xp-opt[data-v="${v}"]`).click(); };
  const plain = 'outline', layout = style;
  const sub = when => side.querySelector(`.xp-group[data-when=${when}]`);
  assert.ok(sub('prose').hidden && sub('dated').hidden);
  setLayout('timeline'); await sleep(200); assert.ok(!sub('dated').hidden && sub('prose').hidden, 'Timeline has its dates');
  setLayout('prose'); await sleep(200); assert.ok(sub('dated').hidden && !sub('prose').hidden, 'Prose has its rows');
  // What comes and goes does so by the library's one motion, never by a motion of the window's own.
  { const src = fs.readFileSync(path.join(root, 'export/logseq/ui.js'), 'utf8'); assert.ok(/PluginDoor\.regrow\(slot, had\[i\]\)/.test(src) && !/\.animate\(|transition:/.test(src), 'by PluginDoor.regrow'); }
  assert.deepEqual([...side.querySelectorAll('.xp-slot')].map(slot => [...slot.children].map(g => g.querySelector('.lk-group').textContent).join(' | ')), ['Prose | Timeline and Calendar', 'Look | Markdown'], 'the two places where one part stands in for another');
  for (const row of [...side.querySelectorAll('.xp-pickrow')].filter(r => !r.closest('[hidden]'))) {
    const was = row.querySelector('select').value, alts = row.querySelectorAll('.xp-opt');
    row.querySelector('.xp-rowhead').click(); assert.ok(row.classList.contains('open') && !row.querySelector('.xp-opts').hidden, `${row.dataset.row} opens`);
    assert.equal(win.querySelectorAll('.xp-pickrow.open').length, 1, 'one open at a time');
    (alts[1] || alts[0]).click(); assert.ok(!row.classList.contains('open') && row.querySelector('.xp-opts').hidden, `${row.dataset.row} folds once a value is taken`);
    assert.equal(row.querySelector('select').value, (alts[1] || alts[0]).dataset.v, 'and the value is taken');
    row.querySelector('.xp-rowhead').click(); row.querySelector(`.xp-opt[data-v="${was}"]`).click();
  }
  // Escape in an open menu folds it, keeps the window, and gives the keys back to the row it came from.
  head.click(); head.focus(); key(head, 'ArrowDown'); assert.ok(hostDoc.activeElement?.classList.contains('xp-opt'), 'Down in an open menu reaches its first choice');
  key(hostDoc.activeElement, 'Escape'); assert.ok(opts.hidden && win.isConnected && hostDoc.activeElement === head, 'Escape folds the menu and the keys go back to its row');
  head.focus(); key(head, 'ArrowDown'); assert.ok(hostDoc.activeElement && hostDoc.activeElement !== head && hostDoc.activeElement.closest('.xp-side'), 'Down goes to the next row');
  setLayout(plain); await sleep(200);
  assert.deepEqual([...win.querySelectorAll('.xp-lists .xp-plhead > .lk-note')].map(n => n.textContent), ['Properties of the page', 'Properties of the nodes']);
  const all = win.querySelector('.xp-all[data-role=nodes]'); assert.deepEqual([...all.children].map(a => [a.textContent, a.classList.contains('on')]), [['all', true], ['none', false]]);
  all.querySelector('[data-all="0"]').click(); assert.deepEqual([...all.children].map(a => a.classList.contains('on')), [false, true], 'none pressed: none in force'); all.querySelector('[data-all="1"]').click();
  const note = win.querySelector('.xp-note'); assert.ok(note.children.length === 1 && note.firstElementChild.dataset.pick === 'xp-zoom' && !note.querySelector('.xp-note-text'), 'over the desk, the size pick alone, no sentence');
  assert.ok(win.querySelector('button.lk-accent[data-act=pdf]') && win.querySelector('button.lk-close'), 'the accent and the × at the end');
  // Keys typed in the window never reach Logseq; Escape does, and folds an open panel first, then closes the window.
  key(win.querySelector('.xp-footer'), 'e'); assert.equal(reached, 0, 'a letter typed in a field stays in the window');
  head.click(); assert.ok(layout.classList.contains('open'));
  key(win.querySelector('.xp-footer'), 'Escape'); assert.ok(!layout.classList.contains('open'), 'Escape folds the open row'); assert.ok(hostDoc.querySelector('.xp'), 'the window stays');
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
  // Templates: a pick sets the controls; a change reads "· changed"; saved under a name it is the person's; renamed; a delete is asked about first.
  { const before = JSON.parse(JSON.stringify(logseq.settings)), msgs = [], showMsg = logseq.UI.showMsg; logseq.UI.showMsg = text => msgs.push(text);
    const w = E.ui.open({ doc, what: 'this page', act: async () => true });
    const xp = hostDoc.querySelector('.xp'), q = s => xp.querySelector(s), tpl = q('.xp-tpl'), value = () => tpl.querySelector('.xp-tplval').textContent, words = () => [...tpl.querySelectorAll('.lk-alts > .lk-item:not(.gap)')].map(a => a.firstElementChild.textContent);
    const opener = { click: () => tpl.querySelector('.xp-tplhead').click() };
    const press = text => [...tpl.querySelectorAll('.lk-alts > .lk-item > span:first-child, .lk-alts b')].find(a => a.textContent === text).click();
    assert.equal(value(), 'None'); opener.click();
    assert.deepEqual(words(), ['Report', 'Paper', 'Brief', 'Save as new…']);
    press('Paper');
    assert.equal(value(), 'Paper'); assert.equal(q('.xp-layout').value, 'prose'); assert.equal(q('.xp-look').value, 'book'); assert.equal(q('.xp-margins').value, 'wide'); assert.ok(!q('.xp-numbered').checked && !q('.xp-contents').checked);
    assert.ok(!q('.xp-group[data-when=prose]').hidden, 'Prose has its rows');
    q('.xp-look').value = 'plain'; q('.xp-look').dispatchEvent(new hostDoc.defaultView.Event('change', { bubbles: true }));
    assert.equal(value(), 'Paper · changed'); opener.click();
    assert.deepEqual(words(), ['Report', 'Paper', 'Brief', 'Save changes to Paper', 'Save as new…']);
    press('Save as new…'); const name = tpl.querySelector('.ask input'); assert.ok(name, 'a name is asked for in the line');
    name.value = 'Report'; press('Save'); assert.ok(tpl.querySelector('.ask') && msgs.pop().includes('already'), 'a name in use is refused');
    name.value = ' Clinic  letter '; key(name, 'Enter');
    assert.equal(value(), 'Clinic letter'); assert.equal(logseq.settings.templates['Clinic letter'].look, 'plain'); assert.equal(logseq.settings.template, 'Clinic letter');
    opener.click(); assert.deepEqual(words(), ['Report', 'Paper', 'Brief', 'Clinic letter', 'Save as new…', 'Rename…', 'Delete…']);
    press('Rename…'); tpl.querySelector('.ask input').value = 'Letter'; press('Rename'); assert.equal(value(), 'Letter'); assert.deepEqual(Object.keys(logseq.settings.templates), ['Letter']);
    opener.click(); press('Delete…'); press('Keep'); assert.ok(logseq.settings.templates.Letter, 'Keep keeps it');
    opener.click(); press('Delete…'); key(q('.xp-footer'), 'Escape'); assert.ok(logseq.settings.templates.Letter && hostDoc.querySelector('.xp'), 'Escape leaves it, and the window');
    opener.click(); press('Delete…'); press('Delete'); assert.deepEqual(Object.keys(logseq.settings.templates), []); assert.equal(value(), 'None');
    // Rules of your own that no template holds are kept as a template before a pick replaces them.
    q('.xp-cssbox').value = '.x-title { color: #333; }'; q('.xp-cssbox').dispatchEvent(new hostDoc.defaultView.Event('input', { bubbles: true }));
    opener.click(); press('Brief');
    assert.equal(logseq.settings.templates['Earlier CSS'].customCss, '.x-title { color: #333; }'); assert.equal(q('.xp-cssbox').value, ''); assert.ok(q('.xp-runin').checked && q('.xp-noteshead').value === '');
    key(hostDoc.body, 'Escape'); await w; logseq.UI.showMsg = showMsg;
    for (const k of Object.keys(logseq.settings)) delete logseq.settings[k]; Object.assign(logseq.settings, before); }
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
    const frame = [...xp.querySelectorAll('.xp-desk iframe')].at(-1); frame.onload?.(); await sleep(5);   // the newest frame: a preview is drawn unseen and takes the old one's place once laid out
    assert.equal(xp.querySelectorAll('.xp-desk iframe').length, 1, 'one preview frame is left once the new one stands');
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
