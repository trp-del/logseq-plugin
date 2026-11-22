/* The actions walk (20 November 2026): every place in the plugin that shows a node, against every action a person can take on
   that node, pressed for real (mouse and keys) in a test Logseq on a throwaway copy of a graph, each result read back from the
   graph, then Undo pressed and read back too. Rule 7 of the workspace (act in place): the node's own page is the measure, and
   Logseq alone (the plugin off) beside it.

     node tools/walk/walk.js [--places "own page,Find row"] [--port 9472] [--keep]

   One node is made for the walk in the copy (a Task with a Status, a Payment Source and one child, on a page of its own), so the
   same node is acted on in every place. Each square of the table is one of
     works      the action landed in the graph, from the place, and one Undo put it back,
     different  it landed, but its Undo did not put it back (or needed more than one), or it took a gesture the node's own page
                does not use,
     missing    no gesture tried reached it from the place,
   with the gesture that worked, a picture, and what each try did. Run output goes to ~/.logseq-guard/walk/<time>/ (walk.json and
   page.html), never into the plugin. It is a net, not proof: every square is also tried by hand (stage-test-by-hand).

   It never runs against the owner's Logseq (port 9222) and never on a graph that is not its own copy. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const sandbox = require('../guard/sandbox.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const PORT = Number(opt('port', 9472));
if (PORT === 9222) throw new Error('9222 is the owner\'s Logseq: the walk runs only in its own');
const GRAPH = 'Personal Finance';
const PLUGIN = path.resolve(__dirname, '../..');
const RUN = path.join(os.homedir(), '.logseq-guard', 'walk', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const NODE = { page: 'Walk notes', words: 'Ask Chase about the Costco refund', child: 'Refund reference 4471', tag: 'Task', status: 'Todo', source: 'Chase Checking' };
const CHANGE = { words: ' ok', source: 'Amex Gold', tag: 'Purchase', status: 'Doing', child: 'walk child' };
const ACTIONS = ['open', 'words', 'property', 'tag', 'status', 'child', 'delete'];

/* ---------- the node, read from the graph ---------- */
async function read(box) {
  // Read through Logseq's own API in the main window, so it reads the same with the plugin off.
  return box.page.evaluate(async uuid => {
    const api = window.logseq.api, Q = async t => { const r = await api.datascript_query(t); return typeof r === 'string' ? JSON.parse(r) : r; };
    const b = await api.get_block(uuid, { children: true });
    if (!b) return { gone: true };
    const q = await Q(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/tags ?g] [?g :block/title ?t]]`);
    const s = await Q(`[:find ?st :where [?b :block/uuid #uuid "${uuid}"] [?b :logseq.property/status ?s] [?s :block/title ?st]]`);
    const p = await Q(`[:find ?pt :where [?b :block/uuid #uuid "${uuid}"] [?b :user.property/payment-source ?v] [?v :block/title ?pt]]`);
    const kids = await Q(`[:find ?t :where [?p :block/uuid #uuid "${uuid}"] [?k :block/parent ?p] [?k :block/title ?t]]`);
    return { words: b.title, tags: (q || []).map(r => r[0]).sort(), status: s?.[0]?.[0] || '', source: (p || []).map(r => r[0]).sort().join(', '), kids: (kids || []).map(r => r[0]).sort() };
  }, box.uuid);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const landed = {
  words: (b, a) => !a.gone && a.words === b.words + CHANGE.words,
  property: (b, a) => !a.gone && a.source.includes(CHANGE.source),
  tag: (b, a) => !a.gone && a.tags.includes(CHANGE.tag),
  status: (b, a) => !a.gone && a.status === CHANGE.status,
  child: (b, a) => !a.gone && a.kids.length === b.kids.length + 1,
  delete: (b, a) => !!a.gone,
};

/* ---------- the node, made and put back ---------- */
async function make(box) {
  box.uuid = await box.page.evaluate(async N => {
    const api = window.logseq.api;
    let pg = await api.get_page(N.page);
    if (!pg) pg = await api.create_page(N.page, {}, { redirect: false });
    const b = await api.append_block_in_page(pg.uuid, N.words);
    await api.add_block_tag(b.uuid, N.tag);
    await api.upsert_block_property(b.uuid, 'logseq.property/status', N.status);
    const src = await api.get_page(N.source);
    await api.upsert_block_property(b.uuid, ':user.property/payment-source', src.id);
    await api.insert_block(b.uuid, N.child, { sibling: false });
    // An embed of the node, on a page of its own, for the embed's row.
    let ep = await api.get_page('Walk embed');
    if (!ep) { ep = await api.create_page('Walk embed', {}, { redirect: false }); await api.append_block_in_page(ep.uuid, `{{embed ((${b.uuid}))}}`); }
    return b.uuid;
  }, NODE);
  box.start = await read(box);
}
// After a square: whatever Undo left behind is set back through Logseq's API (the walk's own housekeeping, not a measured action).
async function putBack(box) {
  const now = await read(box);
  if (same(now, box.start)) return '';
  if (now.gone) { await make(box); return 'made again (the walk lost the node)'; }
  await box.page.evaluate(async ([uuid, S, C]) => {
    const api = window.logseq.api;
    const b = await api.get_block(uuid);
    if (b.title !== S.words) await api.update_block(uuid, S.words);
    try { await api.remove_block_tag(uuid, C.tag); } catch (e) { /* not there */ }
    await api.upsert_block_property(uuid, 'logseq.property/status', S.status);
    const src = await api.get_page(S.source);
    await api.upsert_block_property(uuid, ':user.property/payment-source', src.id);
    const kids = JSON.parse(JSON.stringify(await api.datascript_query(`[:find ?u ?t :where [?p :block/uuid #uuid "${uuid}"] [?k :block/parent ?p] [?k :block/uuid ?u] [?k :block/title ?t]]`)));
    for (const [u, t] of kids || []) if (!S.kids.includes(t)) await api.remove_block(String(u));
  }, [box.uuid, { ...box.start, source: NODE.source }, CHANGE]);
  await sleep(500);
  const back = await read(box);
  return same(back, box.start) ? 'set back by the walk' : 'set back by the walk, not fully: ' + JSON.stringify(back);
}

/* ---------- pressing ---------- */
const keys = async (page, ...list) => { for (const k of list) { await page.keyboard.press(k); await sleep(250); } };
const type = async (page, text) => { await page.keyboard.type(text, { delay: 40 }); await sleep(300); };
const center = r => [r.x + r.width / 2, r.y + r.height / 2];
async function press(page, el, where = 'center', button = 'left') {
  if (!el) return false;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const r = await el.boundingBox(); if (!r) return false;
  const [x, y] = where === 'after' ? [r.x + r.width + 3, r.y + r.height / 2] : center(r);
  await page.mouse.click(x, y, { button }); await sleep(600); return true;
}
// The text's own box (the words, not their whole line), so "after the last word" is right after it.
async function wordsEnd(page, el) {
  return el && page.evaluate(e => {
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let last = null;
    while (w.nextNode()) if (w.currentNode.textContent.trim()) last = w.currentNode;
    if (!last) return null; const r = document.createRange(); r.selectNodeContents(last); const b = [...r.getClientRects()].pop();
    return b ? { x: b.right + 3, y: b.top + b.height / 2 } : null;
  }, el);
}
async function pressAfter(page, el) {
  if (!el) return false; await el.scrollIntoViewIfNeeded().catch(() => {});
  const at = await wordsEnd(page, el); if (!at) return false;
  await page.mouse.click(at.x, at.y); await sleep(700); return true;
}
// Menu items under the pointer, by their words.
async function menuItem(page, re) {
  const items = await page.$$('.menu-link, [role=menuitem], .lk-menu-item, .dropdown-wrapper a');
  for (const it of items) { const t = (await it.textContent()).trim(); if ((await it.boundingBox()) && re.test(t)) return it; }
  return null;
}
// A list that opened under the pointer: its item pressed by its words; if no item shows those words, they are typed and Enter
// pressed (a list that filters as you type).
async function choose(page, words) {
  await sleep(500);
  const items = await page.$$('[role=menuitem], [role=option], .menu-link, .lk-item, .lk-menu-item, .dropdown-wrapper button');
  for (const it of items) {
    if (!(await it.boundingBox())) continue;
    const t = (await it.textContent()).trim().replace(/\s+/g, ' ');
    if (t === words || t.startsWith(words + ' ')) { await press(page, it); return; }
  }
  await type(page, words); await keys(page, 'Enter');
}
async function menuWords(page) { return page.evaluate(() => [...document.querySelectorAll('.menu-link, [role=menuitem], .lk-menu-item')].filter(e => e.getClientRects().length).map(e => e.textContent.trim().replace(/\s+/g, ' ')).slice(0, 30)); }
const editing = page => page.evaluate(() => { const a = document.activeElement; return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable); });

/* ---------- the gestures for each action, tried in order ---------- */
// Each gesture: [name, async (page, P) => done?]. P is the place's handles: words(), circle(), within(), selectNode().
const GESTURES = {
  open: [
    ['a press on its words', async (page, P) => press(page, await P.words())],
    ['the Open button beside its words', async (page, P) => { const w = await P.words(); if (!w || !P.openButton) return false; await w.hover(); await sleep(400); return press(page, await P.openButton()); }],
  ],
  words: [
    ['a press just after its last word, typing, Escape', async (page, P) => { if (!(await pressAfter(page, await P.words()))) return false; if (!(await editing(page))) return false; await keys(page, 'End'); await type(page, CHANGE.words); await keys(page, 'Escape'); return true; }],
  ],
  property: [
    ['a press beside the value, then its list', async (page, P) => { const v = await P.value(); if (!(await pressAfter(page, v))) return false; await choose(page, CHANGE.source); await keys(page,'Escape'); return true; }],
    ['a right-click on the value, then its menu', async (page, P) => { const v = await P.value(); if (!(await press(page, v, 'center', 'right'))) return false; const it = await menuItem(page, /change|set|value/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await choose(page, CHANGE.source); await keys(page,'Escape'); return true; }],
    ['the keys p a with the node picked', async (page, P) => { if (!(await P.selectNode())) return false; await keys(page, 'p', 'a'); await sleep(400); await type(page, 'Payment Source'); await keys(page, 'Enter'); await sleep(400); await choose(page, CHANGE.source); await keys(page,'Escape', 'Escape'); return true; }],
    ['the right-click menu', async (page, P) => { if (!(await press(page, await P.words(), 'center', 'right'))) return false; const it = await menuItem(page, /propert/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await type(page, 'Payment Source'); await keys(page, 'Enter'); await sleep(400); await choose(page, CHANGE.source); await keys(page,'Escape'); return true; }],
  ],
  tag: [
    ['the keys p t with the node picked', async (page, P) => { if (!(await P.selectNode())) return false; await keys(page, 'p', 't'); await sleep(400); await type(page, CHANGE.tag); await keys(page, 'Enter', 'Escape', 'Escape'); return true; }],
    ['the right-click menu', async (page, P) => { if (!(await press(page, await P.words(), 'center', 'right'))) return false; const it = await menuItem(page, /tag/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await type(page, CHANGE.tag); await keys(page, 'Enter', 'Escape'); return true; }],
  ],
  status: [
    ['a press on the status circle, then its list', async (page, P) => { if (!(await press(page, await P.circle()))) return false; await choose(page, CHANGE.status); await keys(page,'Escape'); return true; }],
    ['the keys p s with the node picked', async (page, P) => { if (!(await P.selectNode())) return false; await keys(page, 'p', 's'); await sleep(400); await choose(page, CHANGE.status); await keys(page,'Escape', 'Escape'); return true; }],
    ['the right-click menu', async (page, P) => { if (!(await press(page, await P.words(), 'center', 'right'))) return false; const it = await menuItem(page, /status|doing/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await choose(page, CHANGE.status); await keys(page,'Escape'); return true; }],
  ],
  child: [
    ['Enter at the end of its last bullet, typing, Escape', async (page, P) => { const l = P.lastBullet && await P.lastBullet(); if (!(await pressAfter(page, l))) return false; if (!(await editing(page))) return false; await keys(page, 'End', 'Enter'); await type(page, CHANGE.child); await keys(page, 'Escape'); return true; }],
    ['typing in the opened node\'s new-bullet line', async (page, P) => { const f = P.newLine && await P.newLine(); if (!(await press(page, f))) return false; await type(page, CHANGE.child); await keys(page, 'Enter'); await sleep(300); await keys(page, 'Escape'); return true; }],
    ['Enter after the last word, Tab, typing, Escape', async (page, P) => { if (!(await pressAfter(page, await P.words()))) return false; if (!(await editing(page))) return false; await keys(page, 'End', 'Enter'); await sleep(300); await keys(page, 'Tab'); await type(page, CHANGE.child); await keys(page, 'Escape'); return true; }],
    ['the right-click menu', async (page, P) => { if (!(await press(page, await P.words(), 'center', 'right'))) return false; const it = await menuItem(page, /child|add a bullet|new bullet/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await type(page, CHANGE.child); await keys(page, 'Escape'); return true; }],
  ],
  delete: [
    ['Backspace with the node picked', async (page, P) => { if (!(await P.selectNode())) return false; await keys(page, 'Backspace'); await sleep(400); await keys(page, 'Enter'); return true; }],
    ['the right-click menu', async (page, P) => { if (!(await press(page, await P.words(), 'center', 'right'))) return false; const it = await menuItem(page, /delete/i); if (!it) { await keys(page, 'Escape'); return false; } await press(page, it); await sleep(400); return true; }],
  ],
};

/* ---------- the places ---------- */
const go = (page, name) => page.evaluate(n => window.logseq.api.push_state('page', { name: n }), name);
const firstVisible = async (page, sel, text) => {
  for (const el of await page.$$(sel)) { if (!(await el.boundingBox())) continue; if (!text || (await el.textContent()).includes(text)) return el; }
  return null;
};
// Picking the node as Logseq does: a press after the last word, then Escape (the node stays picked).
const pickLikeLogseq = (page, P) => async () => { if (!(await pressAfter(page, await P.words()))) return false; await keys(page, 'Escape'); return true; };

// Find: Cmd+K, the node's first words typed; its row by the node's id.
const openFind = async box => {
  const page = box.page;
  await keys(page, 'Escape', 'Escape'); await go(page, NODE.page); await sleep(1200);
  await page.keyboard.press('Meta+k'); await sleep(1000);
  await type(page, 'Ask Chase about'); await sleep(1500);
};
const findHandles = (box, opened) => {
  const page = box.page, row = `dialog.fd .fd-r[data-uuid="${box.uuid}"]`, kids = `dialog.fd .fd-kids[data-dug="${box.uuid}"]`;
  const P = {
    words: () => firstVisible(page, `${row} .fd-w > span:last-child`),
    circle: () => firstVisible(page, `${row} .lk-status`),
    value: () => opened ? firstVisible(page, `${kids} .th-ol-body`, NODE.source) : null,
    lastBullet: () => opened ? firstVisible(page, `${kids} .th-ol-words, ${kids} .block-content-inner`, NODE.child) : null,
    newLine: () => opened ? firstVisible(page, `${kids} input.th-tw-node-field`) : null,
    opened: async () => (await page.evaluate(([u, c]) => location.hash.includes(u) || [...document.querySelectorAll('dialog.fd .fd-kids')].some(k => k.textContent.includes(c) && k.getClientRects().length), [box.uuid, NODE.child])),
  };
  P.selectNode = async () => { const w = await P.words(); if (!w) return false; await w.hover(); await sleep(300); return true; };
  return P;
};

// Logseq's own blocks inside a part of the window (the node's own page, an embed, a row in the sidebar).
const blockHandles = (box, scope) => {
  const page = box.page;
  const P = {
    words: () => firstVisible(page, `${scope} .block-content-inner, ${scope} .block-title-wrap`, NODE.words.split(' ').slice(0, 3).join(' ')),
    circle: () => firstVisible(page, `${scope} .ls-icon-Todo, ${scope} .marker-switch`),
    value: () => firstVisible(page, `${scope} .property-value-inner, ${scope} .property-value`, NODE.source),
    lastBullet: () => firstVisible(page, `${scope} .block-content-inner`, NODE.child),
  };
  P.selectNode = pickLikeLogseq(page, P);
  return P;
};
// The plugin's own rows (Relations, Todo): the row by the node's id, an opened node under it.
const rowHandles = (box, { row, words, kids }) => {
  const page = box.page;
  const P = {
    words: () => firstVisible(page, `${row} ${words}`),
    circle: () => firstVisible(page, `${row} .lk-status`),
    value: () => kids ? firstVisible(page, `${kids} .th-ol-body`, NODE.source) : null,
    lastBullet: () => kids ? firstVisible(page, `${kids} .th-ol-words, ${kids} .block-content-inner`, NODE.child) : null,
    newLine: () => kids ? firstVisible(page, `${kids} input.th-tw-node-field`) : null,
  };
  P.selectNode = async () => { const w = await P.words(); if (!w) return false; await w.hover(); await sleep(300); return true; };
  return P;
};
const MAIN = '#main-content-container', SIDE = '#right-sidebar';
// Relations on Chase Checking: the Task kind picked, so the node's row is among the first rows.
async function relations(box, where) {
  const page = box.page;
  const more = await firstVisible(page, `${where} .th-two-way .th-tw-kinds`, 'more'); if (more) { await press(page, more); await sleep(600); }
  const task = await page.evaluateHandle(where => [...document.querySelectorAll(`${where} .th-two-way button, .lk-item, [role=menuitem]`)].find(e => e.getClientRects().length && /^Task\s*\d*$/.test(e.textContent.trim())) || null, where);
  if (task.asElement()) { await press(page, task.asElement()); await sleep(1200); }
}
async function sidebarShut(box) {
  await box.page.evaluate(() => window.logseq.api.clear_right_sidebar_blocks && window.logseq.api.clear_right_sidebar_blocks()).catch(() => {});
  await box.page.evaluate(() => window.logseq.api.set_right_sidebar_visible && window.logseq.api.set_right_sidebar_visible(false)).catch(() => {});
  await sleep(600);
}
async function embedReady(box) {
  const page = box.page;
  await go(page, 'Walk embed'); await sleep(2000);
  if (await firstVisible(page, `${MAIN} .embed-block .block-content-inner, ${MAIN} .block-children-container .block-content-inner`, NODE.words)) return;
  // Made the first time as a person makes one: /Node embed in the empty bullet, then the node's words.
  const first = await firstVisible(page, `${MAIN} .ls-page-blocks .block-content-inner`);
  if (first) await pressAfter(page, first); else await press(page, await firstVisible(page, `${MAIN} .ls-page-blocks`));
  await keys(page, 'Meta+a'); await keys(page, 'Delete');
  await type(page, '/Node embed'); await sleep(800); await keys(page, 'Enter'); await sleep(800);
  await type(page, 'Ask Chase about the Costco'); await sleep(1500); await keys(page, 'Enter'); await sleep(1500); await keys(page, 'Escape');
}

const PLACES = [
  {
    name: 'The node\'s own page', measure: true,
    async enter(box) { await sidebarShut(box); await go(box.page, box.uuid); await sleep(2500); },
    handles(box) { return blockHandles(box, `${MAIN} .ls-page-blocks`); },
    open: 'here',
  },
  {
    name: 'The node\'s own page, Logseq alone (plugin off)', measure: true, off: true,
    async enter(box) { await go(box.page, box.uuid); await sleep(2500); },
    handles(box) { return blockHandles(box, `${MAIN} .ls-page-blocks`); },
    open: 'here',
  },
  {
    name: 'Find\'s rows',
    async enter(box) { await sidebarShut(box); await openFind(box); },
    handles(box) { return findHandles(box, false); },
  },
  {
    name: 'A node opened in Find',
    async enter(box) { await sidebarShut(box); await openFind(box); const f = await firstVisible(box.page, `dialog.fd .fd-r[data-uuid="${box.uuid}"] .fd-fold`); await press(box.page, f); await sleep(1200); },
    handles(box) { return findHandles(box, true); },
    open: 'here',
  },
  {
    name: 'Todo\'s page',
    async enter(box) { await sidebarShut(box); await box.page.evaluate(() => { location.hash = '#/todo'; }); await sleep(2500); },
    handles(box) { return rowHandles(box, { row: `${MAIN} .td-row[data-uuid="${box.uuid}"]`, words: '.td-words' }); },
  },
  {
    name: 'A task opened in Todo',
    async enter(box) { await sidebarShut(box); await box.page.evaluate(() => { location.hash = '#/todo'; }); await sleep(2500); const f = await firstVisible(box.page, `${MAIN} .td-row[data-uuid="${box.uuid}"] .lk-fold`); await press(box.page, f); await sleep(1500); },
    handles(box) { return rowHandles(box, { row: `${MAIN} .td-row[data-uuid="${box.uuid}"]`, words: '.td-words', kids: `${MAIN} [data-th-node="${box.uuid}"]` }); },
    open: 'here',
  },
  {
    name: 'Todo in the sidebar',
    async enter(box) { await sidebarShut(box); await go(box.page, NODE.page); await sleep(1200); await box.frame().evaluate(() => window.PluginDoor.sideTabs.show('todo')); await sleep(2500); },
    handles(box) { return rowHandles(box, { row: `${SIDE} .td-row[data-uuid="${box.uuid}"]`, words: '.td-words' }); },
  },
  {
    name: 'Relations\' rows on a page',
    async enter(box) { await sidebarShut(box); await go(box.page, NODE.source); await sleep(2500); await relations(box, MAIN); },
    handles(box) { return rowHandles(box, { row: `${MAIN} .th-two-way .th-ol-line[data-uuid="${box.uuid}"]`, words: '.th-ol-name' }); },
  },
  {
    name: 'A node opened in Relations',
    async enter(box) { await sidebarShut(box); await go(box.page, NODE.source); await sleep(2500); await relations(box, MAIN); const c = await firstVisible(box.page, `${MAIN} .th-two-way .th-chev[data-uuid="${box.uuid}"]`); await press(box.page, c); await sleep(1500); },
    handles(box) { return rowHandles(box, { row: `${MAIN} .th-two-way .th-ol-line[data-uuid="${box.uuid}"]`, words: '.th-ol-name', kids: `${MAIN} .th-two-way .th-ol-kids[data-key*="${box.uuid}"]` }); },
    open: 'here',
  },
  {
    name: 'A page in the right sidebar (its Relations)',
    async enter(box) {
      await sidebarShut(box); await go(box.page, NODE.page); await sleep(1000);
      const id = await box.page.evaluate(async n => (await window.logseq.api.get_page(n))?.uuid, NODE.source);
      await box.page.evaluate(id => window.logseq.api.open_in_right_sidebar(id), id); await sleep(3000); await relations(box, SIDE);
    },
    handles(box) { return rowHandles(box, { row: `${SIDE} .th-two-way .th-ol-line[data-uuid="${box.uuid}"]`, words: '.th-ol-name' }); },
  },
  {
    name: 'A tag\'s table (Task)',
    async enter(box) { await sidebarShut(box); await go(box.page, NODE.tag); await sleep(3000); },
    handles(box) {
      const page = box.page;
      const theRow = async () => { for (const r of await page.$$(`${MAIN} .ls-table-row`)) if ((await r.textContent()).includes(NODE.words)) return r; return null; };
      const P = {
        words: async () => { const r = await theRow(); return r && r.$('.table-block-title'); },
        circle: async () => { const r = await theRow(); if (!r) return null; for (const c of await r.$$('.ls-table-cell')) if ((await c.textContent()).trim() === NODE.status) return c; return null; },
        openButton: async () => { const r = await theRow(); return r && r.$('button[title="Open"]'); },
        value: async () => { const r = await theRow(); if (!r) return null; for (const c of await r.$$('.ls-table-cell')) if ((await c.textContent()).includes(NODE.source)) return c; return null; },
        lastBullet: async () => null,
      };
      P.selectNode = pickLikeLogseq(page, P);
      return P;
    },
  },
  {
    name: 'The table\'s row view (the row in the sidebar)',
    async enter(box) {
      // As a person does it: the table's page, the toolbar's Row view button, then the row's words.
      await go(box.page, NODE.tag); await sleep(3000);
      const button = () => firstVisible(box.page, '.lk-tool[data-on-click="rowView"]');
      const on = await box.frame().evaluate(() => !!(window.PluginDoor && window.PluginDoor.sideTabs.rows()));
      if (on) { await press(box.page, await button()); await sleep(1200); }
      await press(box.page, await button()); await sleep(1500);
      for (const r of await box.page.$$(`${MAIN} .ls-table-row`)) if ((await r.textContent()).includes(NODE.words)) { await press(box.page, await r.$('.table-block-title')); break; }
      await sleep(2000);
    },
    async leave(box) { const on = await box.frame().evaluate(() => !!(window.PluginDoor && window.PluginDoor.sideTabs.rows())).catch(() => false); if (on) { await press(box.page, await firstVisible(box.page, '.lk-tool[data-on-click="rowView"]')); await sleep(1000); } },
    handles(box) { return blockHandles(box, SIDE); },
    open: 'here',
  },
  {
    name: 'An embedded node',
    async enter(box) { await sidebarShut(box); await embedReady(box); },
    handles(box) { return blockHandles(box, `${MAIN} .ls-page-blocks`); },
  },
];

/* ---------- one square ---------- */
// Opened: the window went to the node's page, or the node's child came into view where it was not (opened in place).
const childSeen = page => page.evaluate(c => [...document.querySelectorAll('*')].filter(e => e.getClientRects().length && e.children.length === 0 && e.textContent.trim() === c).length, NODE.child);
const opened = async (box, seen) => (await box.page.evaluate(u => location.hash.includes(u), box.uuid)) || (await childSeen(box.page)) > seen;
async function square(box, place, action) {
  const page = box.page, out = { place: place.name, action, tries: [] };
  if (action === 'open' && place.open === 'here') { out.result = 'here'; return out; }
  await place.enter(box);
  const before = await read(box);
  const P = place.handles(box);
  for (const [name, fn] of GESTURES[action]) {
    let ran = false, err = '';
    await place.enter(box);
    const seen = await childSeen(page);
    try { ran = await fn(page, P); } catch (e) { err = String(e.message || e).split('\n')[0].slice(0, 120); }
    await sleep(900);
    if (action === 'open') {
      const ok = ran && (await opened(box, seen));
      out.tries.push({ gesture: name, ran, ok, err });
      if (ok) { out.result = 'works'; out.gesture = name; break; }
      continue;
    }
    const after = await read(box);
    const ok = ran && landed[action](before, after);
    out.tries.push({ gesture: name, ran, ok, err, menu: !ok && /right-click/.test(name) ? await menuWords(page) : undefined });
    if (!ok) { await keys(page, 'Escape', 'Escape'); if (!same(await read(box), before)) out.stray = await putBack(box); continue; }
    out.gesture = name;
    out.picture = await shoot(page, place, action);
    // One Undo, pressed where the action was.
    await keys(page, 'Escape'); await page.keyboard.press('Meta+z'); await sleep(1200);
    const undone = await read(box);
    out.undo = same(undone, before) ? 'one Undo put it back' : (await page.keyboard.press('Meta+z'), await sleep(1200), same(await read(box), before) ? 'took two Undos' : 'Undo did not put it back');
    out.result = out.undo === 'one Undo put it back' ? 'works' : 'different';
    break;
  }
  if (!out.result) { out.result = 'missing'; out.picture = await shoot(page, place, action + '-missing'); }
  if (place.leave) await place.leave(box);
  out.fixed = await putBack(box);
  if (!out.fixed) delete out.fixed;
  await keys(page, 'Escape', 'Escape');
  return out;
}
async function shoot(page, place, what) {
  const file = `${place.name.replace(/\W+/g, '-').toLowerCase()}--${what}.png`;
  await page.screenshot({ path: path.join(RUN, file) }).catch(() => {});
  return file;
}

/* ---------- the run ---------- */
(async () => {
  fs.mkdirSync(RUN, { recursive: true });
  const only = opt('places', '') ? String(opt('places')).split(',').map(s => s.trim().toLowerCase()) : null;
  const places = PLACES.filter(p => !only || only.some(o => p.name.toLowerCase().startsWith(o)));
  const box = await sandbox.start({ dir: path.join(RUN, 'logseq'), graph: GRAPH, plugin: PLUGIN, port: PORT });
  const results = [];
  try {
    await box.page.evaluate(async () => { window.moveTo(80, 60); window.resizeTo(700, 560); await new Promise(r => setTimeout(r, 400)); });
    await make(box);
    for (const place of places) {
      if (place.off) await box.page.evaluate(() => window.LSPluginCore.disable('logseq-plugin')), await sleep(2000);
      for (const action of ACTIONS) {
        const r = await square(box, place, action);
        results.push(r);
        console.log(`${place.name} · ${action}: ${r.result}${r.gesture ? ' (' + r.gesture + ')' : ''}${r.undo ? ', ' + r.undo : ''}`);
      }
      if (place.off) { await box.page.evaluate(() => window.LSPluginCore.enable('logseq-plugin')); await sleep(4000); }
    }
  } finally {
    fs.writeFileSync(path.join(RUN, 'walk.json'), JSON.stringify({ when: new Date().toISOString(), plugin: PLUGIN, graph: GRAPH, node: NODE, change: CHANGE, results }, null, 1));
    page(results);
    if (!opt('keep', false)) await sandbox.stop(box); else console.log(`kept open on port ${PORT}`);
  }
  console.log(`\nThe table: ${path.join(RUN, 'page.html')}`);
  process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });

function page(results) {
  const places = [...new Set(results.map(r => r.place))];
  const cell = r => !r ? '<td></td>' : `<td class="${r.result}"><b>${r.result}</b>${r.gesture ? `<br><small>${r.gesture}</small>` : ''}${r.undo && r.undo !== 'one Undo put it back' ? `<br><small>${r.undo}</small>` : ''}${r.picture ? `<br><a href="${r.picture}">picture</a>` : ''}</td>`;
  const rows = places.map(p => `<tr><th>${p}</th>${ACTIONS.map(a => cell(results.find(r => r.place === p && r.action === a))).join('')}</tr>`).join('\n');
  fs.writeFileSync(path.join(RUN, 'page.html'), `<!doctype html><meta charset="utf-8"><title>Actions walk</title><style>body{font:15px -apple-system,sans-serif;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px;vertical-align:top;text-align:left}.works{background:#eaf6ea}.different{background:#fdf3dc}.missing{background:#fbe5e5}.here{color:#888}</style><h1>Actions walk</h1><table><tr><th></th>${ACTIONS.map(a => `<th>${a}</th>`).join('')}</tr>${rows}</table><pre>${JSON.stringify(results, null, 1).replace(/</g, '&lt;')}</pre>`);
}
