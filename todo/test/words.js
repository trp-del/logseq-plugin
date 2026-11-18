/* A task's words drawn as Logseq shows them (the owner, 18 November 2026: "todo doesn't show md syntax … correctly"): bold,
   italic, struck, marked, code, a link as its page's name opening that page, a tag as #Name, a block reference as that block's
   words, a web address as a link out; the plain words (menus, notices) without any of the marks.
   Run from the plugin's folder or this one: node todo/test/words.js (needs jsdom: NODE_PATH). */
const path = require('node:path'), assert = require('node:assert');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.parent = window;
const P = 'aaaaaaaa-0000-0000-0000-000000000001', TAG = 'aaaaaaaa-0000-0000-0000-000000000002', B = 'aaaaaaaa-0000-0000-0000-000000000003', B2 = 'aaaaaaaa-0000-0000-0000-000000000004';
const titles = { [P]: 'Dr. Mei Chen', [TAG]: 'Scan', [B]: 'the **blood** panel for [[' + P + ']]', [B2]: 'the ==iron== level from [[' + P + ']]' };
const BLOCKS = [B, B2];   // Logseq 2.0.2 keeps a block reference as [[uuid]], like a link
const raw = `Ask **[[${P}]]** about *fatigue* and \`dose\` ~~today~~ ==soon== #[[${TAG}]] re ((${B})) see https://nih.gov/a and [[${B2}]]`;
const pushed = [];
function ask(q) {
  if (q === '[:find ?t :where [?t :db/ident :logseq.class/Task]]') return [[10]];
  if (q.startsWith('[:find ?b ?u ?w ?sid')) return [[1, 'bbbbbbbb-0000-0000-0000-000000000001', raw, 'logseq.property/status.todo', 1, 1]];
  if (q.startsWith('[:find ?b ?pt ?jd')) return [[1, 'Notes', 0, 'cccccccc-0000-0000-0000-000000000001']];
  if (q.startsWith('[:find ?u :where')) return [...q.matchAll(/#uuid "([^"]+)"/g)].map(m => m[1]).filter(u => BLOCKS.includes(u)).map(u => [u]);
  if (q.startsWith('[:find ?u ?t')) return [...q.matchAll(/#uuid "([^"]+)"/g)].map(m => m[1]).filter(u => titles[u]).map(u => [u, titles[u]]);
  return [];
}
global.logseq = window.logseq = {
  settings: {}, updateSettings() {}, onSettingsChanged: () => () => {}, DB: { onChanged: () => () => {}, datascriptQuery: async q => ask(q) },
  App: { onCurrentGraphChanged: () => () => {}, registerCommandPalette() {}, pushState: (r, p) => pushed.push(['page', p.name]) },
  Editor: { openInRightSidebar: u => pushed.push(['side', u]) }, Experiments: {}, UI: { showMsg() {} },
};
require(path.join(ROOT, 'plugin.js'));
const Door = window.PluginDoor;
Door.register = () => {};
for (const f of ['export/core/inline.js', 'todo/logseq/db.js', 'todo/logseq/view.js', 'todo/main.js']) require(path.join(ROOT, f));
const T = window.Todo, app = T.app;
(async () => {
  app.tasks = await T.db.read(); app.read = true;
  const [t] = app.tasks;
  assert.equal(t.words, 'Ask Dr. Mei Chen about fatigue and dose today soon #Scan re the blood panel for Dr. Mei Chen see https://nih.gov/a and the iron level from Dr. Mei Chen', 'the plain words, no marks');
  const holder = document.createElement('div'); document.body.append(holder);
  const view = T.view.make(holder, 'page');
  const w = holder.querySelector('.td-words');
  assert.ok(w.querySelector('strong .lk-node[data-open-page="' + P + '"]'), 'a bold link: bold, in the link look, opening its page');
  assert.equal(w.querySelector('strong').textContent, 'Dr. Mei Chen', 'the link reads as the page name, no brackets');
  assert.equal(w.querySelector('em').textContent, 'fatigue');
  assert.equal(w.querySelector('code').textContent, 'dose');
  assert.equal(w.querySelector('s').textContent, 'today');
  assert.equal(w.querySelector('mark').textContent, 'soon');
  assert.equal(w.querySelector('.lk-tag').textContent, '#Scan', 'a tag as #Name');
  assert.equal(w.querySelector('.lk-tag').dataset.openPage, TAG);
  assert.ok(/re the blood panel for Dr\. Mei Chen/.test(w.textContent) && w.querySelectorAll('strong').length === 2, 'a block reference as that block\'s words, drawn too');
  assert.ok(w.querySelector('.lk-url[data-open-url="https://nih.gov/a"]'), 'a web address as a link out');
  const ref = w.querySelector('.lk-node[data-open-page="' + B2 + '"]');
  assert.ok(ref, 'a block reference kept as [[uuid]] is one link opening the block');
  assert.equal(ref.textContent, 'the iron level from Dr. Mei Chen', 'drawn as the block\'s words');
  assert.ok(ref.querySelector('mark') && !ref.querySelector('[data-open-page] [data-open-page]') && !ref.querySelector('[data-open-page]'), 'its marks drawn, no link inside the link');
  assert.ok(!/\*\*|\[\[|\(\(|`|==|~~/.test(w.textContent), 'no mark-up shows: ' + w.textContent);
  w.querySelector('.lk-tag').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  w.querySelector('.lk-node').dispatchEvent(new window.MouseEvent('click', { bubbles: true, shiftKey: true }));
  assert.deepEqual(pushed, [['page', TAG], ['side', P]], 'a press on a link opens its page, with Shift in the sidebar; not the task');
  view.destroy();
  console.log('todo words ok');
})().catch(e => { console.error(e); process.exit(1); });
