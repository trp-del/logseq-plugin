/* The stand-in for Logseq that the checks and the pictures load the plugin against: a fake `logseq` whose queries answer in
   the shapes Logseq 2.0.2 returns, and a jsdom page drawn like a Logseq page (the markup Logseq 2.0.2 gives a title row, a
   page's list of properties, a bullet with links, a tag and a line of properties, a folded node, the left sidebar's
   recents). Only the real app shows the rest. load() runs the plugin's files, in files.js's order, and hands back the page. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');

const { root, order } = require('../../test/module.js')('look');
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = d => `00000001-0000-4000-8000-${String(d).padStart(12, '0')}`; // a journal page's uuid starts 00000001-
// Tags: Entity > Person > Doctor, Entity > Hospital; Occurrence > Consultation; Phenomena > Symptom; Information > Report.
const TAGS = [[1, 'Entity', 'user.class/Entity'], [2, 'Person', 'user.class/Person'], [3, 'Doctor', 'user.class/Doctor'], [4, 'Occurrence', 'user.class/Occurrence'], [5, 'Consultation', 'user.class/Consultation'], [6, 'Phenomena', 'user.class/Phenomena'], [7, 'Symptom', 'user.class/Symptom'], [8, 'Information', 'user.class/Information'], [10, 'Report', 'user.class/Report'], [11, 'Hospital', 'user.class/Hospital'], [9, 'Tag', 'logseq.class/Tag']];
const EXT = [[2, 1], [3, 2], [5, 4], [7, 6], [10, 8], [11, 1]];
// Pages: Dr. Mei Chen and Dr. Tom Okonkwo (Doctor), Fatigue (Symptom), a consultation, a report, a hospital; the tag page Doctor.
const PAGES = [[U(20), 'dr. mei chen', 3], [U(21), 'fatigue', 7], [U(22), 'consultation with dr. chen', 5], [U(23), 'ct report', 10], [U(24), 'northgate hospital', 11], [U(25), 'dr. tom okonkwo', 3], [U(3), 'doctor', 9]];
const prop = (id, title, type) => [{ 'db/id': id, 'block/title': title, 'logseq.property/type': ':' + type, 'db/cardinality': ':db.cardinality/one' }];
const PROPS = [prop(100, 'Provider', 'node'), prop(101, 'Date', 'date'), prop(102, 'Specialty', 'default'), prop(103, 'Works at', 'node'), prop(104, 'First seen', 'date'), prop(105, 'Rating', 'number'), prop(106, 'Status', 'default'), prop(107, 'Notes', 'default'), prop(108, 'Symptom', 'node'), prop(109, 'Topic', 'default'), prop(110, 'Report', 'node')];
function fakeQuery(q) {
  const has = (...p) => p.every(x => q.includes(x));
  if (has(':logseq.class/Tag] [?t :block/uuid ?u] [?t :block/title ?title]')) return TAGS.map(([id, t, i]) => [id, U(id), t, ':' + i]);
  if (has('logseq.property.class/extends ?p')) return EXT;
  if (has('[?p :block/name ?n] [?p :block/tags ?t]')) return PAGES.map(([u, n, t]) => [u, n, t]);
  if (has('[?b :block/page _] [?b :block/tags ?t] [?b :block/uuid ?u]')) return [[U(300), 5]];
  if (has(':logseq.class/Property] [?p :db/ident _]')) return PROPS;
  if (has('closed-value-property ?p]]')) return [[106]]; // Status is a choice
  // What the folded node (U(400)) holds: three children; a task due Nov 19, two consultations, one of them a symptom too, a PDF.
  if (has('[?r :block/uuid ?u] [?r :block/page ?pg]')) return [[U(400), 400, 500]];
  if (has('[?b :block/page ?pg] [?b :block/parent ?parent]')) return [[401, 400], [402, 401], [403, 400]];
  if (has('[?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]')) return [[401, 'Task', ':logseq.class/Task'], [402, 'Consultation', ':user.class/Consultation'], [403, 'Consultation', ':user.class/Consultation'], [403, 'Symptom', ':user.class/Symptom']];
  if (has('logseq.property/status ?s')) return [];
  if (has('[?d :block/journal-day ?day]')) return [[401, 20261119]];
  if (has('(> ?ms 100000000000)')) return [];
  if (has('logseq.property.asset/type ?type')) return [[403, 900, ':pdf']];
  // Two links in the words, one written twice; a tag and a cited highlight, which are not links; a web address.
  if (has('[?b :block/title ?title]')) return [[401, `See [[${U(20)}]] and [[${U(20)}]] #[[${U(5)}]]`], [402, `Cited [[${U(800)}]]`], [403, 'At https://example.org/a).']];
  if (has('[?r :block/uuid ?u]') && has('logseq.property.pdf/hl-page')) return [[U(800)]];
  if (has('logseq.property.pdf/hl-page')) return [];
  return [];
}
/* The pieces of a Logseq 2.0.2 page, as the plugin meets them. */
const link = (uuid, words) => `<a class="page-ref" data-uuid="${uuid}">${words}</a>`;
const day = (d, words) => `<div class="ls-datetime"><a class="page-ref" data-uuid="${DAY(d)}">${words}</a></div>`;
// A row of a page's list: Logseq's dot in a button, the name, the value.
const row = (name, value) => `<div class="property-pair property-panel-row" data-property-title="${name}"><div class="property-key-panel"><div class="property-icon"><div class="property-m"><span class="bullet-container"></span></div></div><div class="property-key-inner"><a class="property-k">${name}</a></div></div><div class="property-value-container">${value}</div></div>`;
// A pill in the line under a bullet's words; an empty one holds Logseq's "Empty"; a pencilled one holds Predictive's proposal beside it.
const pill = (name, value, extra = '') => `<div class="bottom-property-pill"${extra}><div><div class="property-key-inner"><a class="property-k">${name}</a></div></div><div class="bottom-property-content">${value}</div></div>`;
const empty = '<div class="empty-value">Empty</div>';
const pencil = words => `${empty}<span class="flow-ghost flow-guess lk-pencil">${words}</span>`;
const tagOf = (uuid, name) => `<span class="block-tag"><a class="hash-symbol">#</a><a class="tag page-ref" data-uuid="${uuid}">${name}</a></span>`;
const item = (name, icon = '<i class="ls-icon-page"></i>') => `<a class="link-item" data-page-name="${name}"><span class="page-icon">${icon}</span><span class="page-title">${name}</span></a>`;
// A bullet: its dot, its words with Logseq's tags (or a proposed one) at the right end of the line, its line of properties under them.
const bullet = (uuid, words, right = '', more = '', extra = '') => `<div class="ls-block" blockid="${uuid}"${extra}><div class="block-main-container"><div class="block-control-wrap"><span class="bullet-container"><span class="bullet"></span></span></div><div class="block-content-wrapper"><div class="block-head-wrap"><div class="block-title-wrap">${words}</div>${right ? `<div class="ls-block-right">${right}</div>` : ''}</div>${more}</div></div></div>`;

const page = `
<div id="main-content-container">
  <div class="ls-page-title"><div class="ls-block" blockid="${U(20)}"><div class="is-page-title-row"><div class="block-control-wrap"><a class="block-control"></a></div><div class="block-title-wrap">Dr. Mei Chen</div>
    <div class="ls-block-right"><div class="block-tags">${tagOf(U(3), 'Doctor')}</div></div></div></div></div>
  <div class="ls-page-properties ls-properties-area">${row('Specialty', 'Oncology')}${row('Works at', link(U(24), 'Northgate Hospital'))}${row('First seen', day(20260903, 'Sep 3rd, 2026'))}${row('Rating', '4')}${row('Status', 'Active')}</div>
  <div class="ls-new-property"><button>+ Add property</button></div>
  ${bullet(U(300), `Video call with ${link(U(20), 'Dr. Mei Chen')} about the ${link(U(21), 'fatigue')}. She wants the ${link(U(23), 'CT report')} before the next ${link(U(22), 'consultation')}`, `<div class="block-tags">${tagOf(U(5), 'Consultation')}</div>`,
    `<div class="positioned-properties block-below"><div class="bottom-properties-row">${pill('Date', day(20260903, 'Sep 3rd, 2026'))}${pill('Provider', link(U(20), 'Dr. Mei Chen'))}${pill('Notes', empty)}</div></div>`)}
  ${bullet(U(301), `Locum at ${link(U(24), 'Northgate Hospital')} before that. Seen on ${day(20261021, 'Oct 21st, 2026')}, said it was probably IBS.`)}
  ${bullet(U(400), 'This week', '', '', ' data-collapsed="true"')}
</div>
<div id="left-sidebar"><div class="recent"><h4>Recent</h4>${['Dr. Mei Chen', 'Consultation with Dr. Chen', 'Fatigue', 'CT report', 'Oct 19th, 2026', 'Northgate Hospital', 'Doctor', 'Questions for Dr. Chen', 'Dr. Tom Okonkwo'].map(n => item(n)).join('')}</div></div>`;
/* A bullet as Predictive leaves it while it is written: Logseq's own pills for the tag's properties, three of them holding a
   pencilled value beside Logseq's "Empty", and the proposed tag pencilled at the right end of the line. */
const pencilled = `
<div id="main-content-container">
  ${bullet(U(500), `Saw ${link(U(20), 'Dr. Mei Chen')} about the fatigue, worse in the evenings`, `<span class="flow-ghost flow-guess flow-tag-ghost lk-pencil"><span class="flow-tag lk-tag">Consultation</span></span>`,
    `<div class="positioned-properties block-below"><div class="bottom-properties-row">${pill('Provider', pencil('Dr. Mei Chen'), ' data-flow-proposal=""')}${pill('Date', pencil('Oct 23rd, 2026'), ' data-flow-proposal=""')}${pill('Symptom', pencil('Fatigue'), ' data-flow-proposal=""')}${pill('Topic', empty)}${pill('Report', empty)}</div></div>`)}
</div><div id="left-sidebar"></div>`;

/* Loads the plugin against a page; back comes the page, the plugin, the fake logseq, the stylesheets it sent and the errors
   it logged. */
async function load({ html = page, settings = {} } = {}) {
  const dom = new JSDOM(`<html><body>${html}</body></html>`, { pretendToBeVisual: true });
  const doc = dom.window.document;
  const styles = {}, errors = [];
  const logseq = {
    ready: fn => Promise.resolve().then(fn), settings, provideStyle: ({ key, style }) => { styles[key] = style; }, useSettingsSchema() {}, onSettingsChanged(fn) { logseq._settingsHook = fn; }, updateSettings() {}, provideModel() {},
    beforeunload(fn) { logseq._unload = fn; }, App: { onCurrentGraphChanged(fn) { logseq._graph = fn; }, pushState() {}, registerCommandPalette() {}, registerUIItem() {} }, DB: { onChanged() {}, datascriptQuery: async q => fakeQuery(q) },
    UI: { showMsg() {} }, Editor: { getPage: async () => null, openInRightSidebar() {} },
  };
  const sandbox = { window: { parent: { document: doc } }, logseq, document: { currentScript: null }, console: { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); console.error(...a); } }, setTimeout, clearTimeout, Promise, URL, Date, Map, Set, JSON, encodeURIComponent, String, Number, Array, Object, RegExp, Math };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const file of order) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  await new Promise(r => setTimeout(r, 150));
  return { dom, doc, win: sandbox.window, Look: sandbox.window.Look, logseq, styles, errors, order, door: sandbox.window.PluginDoor };
}
module.exports = { U, DAY, page, pencilled, load };
