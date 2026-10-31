/* A pretend Logseq: a small DB graph in the shapes the real one returns (seen in the Illness Test Graph through Logseq's
   command line, 2026-10-29), and a stand-in `logseq` whose datascriptQuery answers the four queries logseq/db.js asks.
   Node only. Exports { logseq, U, ent, shown, commands, menus } for test/load.js. */
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Entities: id → attributes. Refs are numbers. Properties (ident, title, type) are entities too, as in Logseq.
const ent = {};
const add = (id, attrs) => { ent[id] = { 'db/id': id, ...attrs }; return id; };
const prop = (id, ident, title, type) => add(id, { 'db/ident': ident, 'block/title': title, 'logseq.property/type': type, 'block/uuid': U(id) });
// Logseq's own attributes and properties.
prop(1, 'block/title', 'Title', 'string'); prop(2, 'block/uuid', 'UUID', 'uuid'); prop(3, 'block/tags', 'Tags', 'node'); prop(4, 'block/page', 'Page', 'entity');
prop(5, 'block/parent', 'Node parent', 'entity'); prop(6, 'block/order', 'Order', 'string'); prop(7, 'block/journal-day', 'Journal day', 'number'); prop(8, 'block/name', 'Name', 'string');
prop(9, 'logseq.property/status', 'Status', 'default'); prop(10, 'logseq.property/priority', 'Priority', 'default'); prop(11, 'logseq.property/deadline', 'Deadline', 'datetime'); prop(12, 'logseq.property/scheduled', 'Scheduled', 'datetime');
prop(13, 'logseq.property.node/display-type', 'Display type', 'keyword'); prop(14, 'logseq.property.code/lang', 'Language', 'default'); prop(15, 'logseq.property/order-list-type', 'List type', 'default');
prop(16, 'logseq.property/query', 'Query', 'default'); prop(17, 'logseq.property/created-from-property', 'Created from', 'entity'); prop(18, 'logseq.property/value', 'Value', 'any');
prop(19, 'logseq.property.asset/type', 'Asset type', 'string'); prop(20, 'logseq.property.pdf/hl-page', 'Page', 'number'); prop(21, 'logseq.property/asset', 'Asset', 'node'); prop(22, 'logseq.property.pdf/hl-image', 'Image', 'node');
prop(23, 'block/link', 'Link', 'entity'); prop(24, 'logseq.property/heading', 'Heading', 'number'); prop(25, 'block/collapsed?', 'Collapsed', 'checkbox'); prop(26, 'block/updated-at', 'Updated', 'number');
// Classes, choices.
add(40, { 'db/ident': 'logseq.class/Tag', 'block/title': 'Tag', 'block/uuid': U(40) }); add(41, { 'db/ident': 'logseq.class/Task', 'block/title': 'Task', 'block/uuid': U(41) });
add(42, { 'db/ident': 'logseq.class/Page', 'block/title': 'Page', 'block/uuid': U(42) }); add(43, { 'db/ident': 'logseq.class/Asset', 'block/title': 'Asset', 'block/uuid': U(43) });
add(44, { 'db/ident': 'logseq.class/Pdf-annotation', 'block/title': 'PDF Annotation', 'block/uuid': U(44) }); add(45, { 'db/ident': 'logseq.class/Query', 'block/title': 'Query', 'block/uuid': U(45) });
add(50, { 'db/ident': 'logseq.property/status.todo', 'block/title': 'Todo', 'block/uuid': U(50) }); add(51, { 'db/ident': 'logseq.property/status.done', 'block/title': 'Done', 'block/uuid': U(51) });
add(52, { 'db/ident': 'logseq.property/priority.high', 'block/title': 'High', 'block/uuid': U(52) });
// Your tags and properties.
add(60, { 'db/ident': 'user.class/Doctor', 'block/title': 'Doctor', 'block/name': 'doctor', 'block/uuid': U(60), 'block/tags': [40] });
add(61, { 'db/ident': 'user.class/Consultation', 'block/title': 'Consultation', 'block/name': 'consultation', 'block/uuid': U(61), 'block/tags': [40] });
prop(70, 'user.property/provider', 'Provider', 'node'); prop(71, 'user.property/date', 'Date', 'date'); prop(72, 'user.property/severity', 'Severity', 'number');
prop(73, 'user.property/specialty', 'Specialty', 'default'); prop(74, 'user.property/notes', 'Notes', 'default'); prop(75, 'user.property/site', 'Site', 'url');
add(80, { 'block/title': 'Oncology', 'block/uuid': U(80), 'block/closed-value-property': [73], 'logseq.property/created-from-property': 73 });   // a choice
// Pages.
add(100, { 'block/title': 'Dr. Mei Chen', 'block/name': 'dr. mei chen', 'block/uuid': U(100), 'block/tags': [42, 60], 'user.property/specialty': 80, 'user.property/notes': 101, 'user.property/site': 'https://northgate.example/chen' });
add(101, { 'block/uuid': U(101), 'logseq.property/value': 'Secretary Paula', 'logseq.property/created-from-property': 74, 'block/parent': 100, 'block/page': 100, 'block/order': 'a0' });   // a text value
add(110, { 'block/title': 'Oct 23rd, 2026', 'block/name': 'oct 23rd, 2026', 'block/uuid': U(110), 'block/journal-day': 20261023 });
add(120, { 'block/title': 'Fatigue', 'block/name': 'fatigue', 'block/uuid': U(120), 'block/tags': [42] });
// Blocks on Dr. Mei Chen.
add(200, { 'block/title': 'Consultant oncologist. Explains with **drawings**.', 'block/uuid': U(200), 'block/parent': 100, 'block/page': 100, 'block/order': 'a1' });
add(201, { 'block/title': 'Appointments', 'block/uuid': U(201), 'block/parent': 100, 'block/page': 100, 'block/order': 'a2', 'logseq.property/order-list-type': 'number' });
add(202, { 'block/title': `Spoke with [[${U(100)}]] about [[${U(120)}]] #[[${U(61)}]]`, 'block/uuid': U(202), 'block/parent': 201, 'block/page': 100, 'block/order': 'a0', 'block/tags': [61], 'user.property/provider': 100, 'user.property/date': 110, 'user.property/severity': 203 });
add(203, { 'block/uuid': U(203), 'logseq.property/value': 4, 'logseq.property/created-from-property': 72, 'block/parent': 202, 'block/page': 100, 'block/order': 'a0' });
add(204, { 'block/title': 'Sort out the power of attorney', 'block/uuid': U(204), 'block/parent': 201, 'block/page': 100, 'block/order': 'a1', 'block/tags': [41], 'logseq.property/status': 50, 'logseq.property/priority': 52, 'logseq.property/deadline': 1785542400000 });
add(205, { 'block/title': 'const x = 1;', 'block/uuid': U(205), 'block/parent': 100, 'block/page': 100, 'block/order': 'a3', 'logseq.property.node/display-type': 'code', 'logseq.property.code/lang': 'js' });
add(206, { 'block/title': 'Papers', 'block/uuid': U(206), 'block/parent': 100, 'block/page': 100, 'block/order': 'a4' });
add(207, { 'block/title': 'Epidemiology of cholangiocarcinoma', 'block/uuid': U(207), 'block/parent': 206, 'block/page': 100, 'block/order': 'a0', 'block/tags': [43], 'logseq.property.asset/type': 'pdf' });
add(208, { 'block/title': 'United States of America and Canada have observed an increase in iCCA', 'block/uuid': U(208), 'block/parent': 207, 'block/page': 100, 'block/order': 'a0', 'block/tags': [44], 'logseq.property.pdf/hl-page': 2, 'logseq.property/asset': 207 });
add(209, { 'block/title': 'Oct 23, 2026', 'block/uuid': U(209), 'block/parent': 207, 'block/page': 100, 'block/order': 'a1', 'block/tags': [44], 'logseq.property.pdf/hl-page': 1, 'logseq.property/asset': 207, 'logseq.property.pdf/hl-image': 210 });
add(210, { 'block/title': 'pdf area highlight', 'block/uuid': U(210), 'block/parent': 209, 'block/page': 100, 'block/order': 'a0', 'block/tags': [43], 'logseq.property.asset/type': 'png' });
add(211, { 'block/title': 'Open to-dos', 'block/uuid': U(211), 'block/parent': 100, 'block/page': 100, 'block/order': 'a5', 'block/tags': [45], 'logseq.property/query': 212 });
add(212, { 'block/uuid': U(212), 'logseq.property/value': '(task todo)', 'logseq.property/created-from-property': 16, 'block/parent': 211, 'block/page': 100, 'block/order': 'a0' });
add(213, { 'block/title': ' ', 'block/uuid': U(213), 'block/parent': 100, 'block/page': 100, 'block/order': 'a6', 'block/link': 120 });
add(215, { 'block/title': `She pointed at ((${U(208)}))`, 'block/uuid': U(215), 'block/parent': 100, 'block/page': 100, 'block/order': 'a8' });
add(214, { 'block/title': `((${U(200)}))`, 'block/uuid': U(214), 'block/parent': 100, 'block/page': 100, 'block/order': 'a7', 'logseq.property/heading': 2 });
// Fatigue's blocks (embedded above).
add(300, { 'block/title': 'Tired most afternoons since the second cycle', 'block/uuid': U(300), 'block/parent': 120, 'block/page': 120, 'block/order': 'a0' });
// A node tagged Doctor elsewhere (for the tag page's list).
add(400, { 'block/title': 'Oct 20th, 2026', 'block/name': 'oct 20th, 2026', 'block/uuid': U(400), 'block/journal-day': 20261020 });
add(401, { 'block/title': `Dr. Kim, radiologist #[[${U(60)}]]`, 'block/uuid': U(401), 'block/parent': 400, 'block/page': 400, 'block/order': 'a0', 'block/tags': [60] });

const byUuid = new Map(Object.values(ent).filter(e => e['block/uuid']).map(e => [e['block/uuid'], e]));
const childrenOf = id => Object.values(ent).filter(e => e['block/parent'] === id && e['block/page'] === (ent[id]['block/page'] ?? id) && e['block/order'] != null).sort((a, b) => a['block/order'].localeCompare(b['block/order']));
const tree = e => ({ uuid: e['block/uuid'], id: e['db/id'], title: e['block/title'], content: e['block/title'], children: childrenOf(e['db/id']).map(tree) });
const pageOf = e => ({ uuid: e['block/uuid'], id: e['db/id'], name: e['block/name'], originalName: e['block/title'], title: e['block/title'] });

const groundUuids = q => [...q.matchAll(/#uuid "([0-9a-f-]{36})"/g)].map(m => m[1]);
const groundIds = q => { const m = q.match(/\(ground \[([\d ]+)\]\)/); return m ? m[1].trim().split(/\s+/).map(Number) : []; };
function datascriptQuery(q) {
  if (q.includes('[?b ?a ?v]')) {   // every attribute of the grounded blocks
    const out = [];
    for (const u of groundUuids(q)) {
      const e = byUuid.get(u); if (!e) continue;
      for (const [a, v] of Object.entries(e)) {
        if (a === 'db/id') continue;
        const p = Object.values(ent).find(x => x['db/ident'] === a);
        const vals = Array.isArray(v) ? v : [v];
        for (const x of vals) out.push([u, ':' + a, p?.['block/title'] || '', p ? ':' + p['logseq.property/type'] : ':none', p?.['block/order'] || '', x]);
      }
    }
    return out;
  }
  if (q.includes('(pull ?e')) return groundIds(q).map(id => ent[id]).filter(Boolean).map(e => [{ ...e, 'block/tags': (e['block/tags'] || []).map(id => ({ 'db/id': id, 'db/ident': ent[id]['db/ident'] })) }]);
  if (q.includes('[?b :block/title ?t]')) return groundUuids(q).map(u => byUuid.get(u)).filter(e => e && e['block/title'] != null).map(e => [e['block/uuid'], e['block/title'], e['logseq.property.pdf/hl-page'] || 0, e['logseq.property/asset'] ? ent[e['logseq.property/asset']]['block/title'] : '']);
  const tagged = q.match(/\[\?b :block\/tags (\d+)\]/);
  if (tagged) return Object.values(ent).filter(e => (e['block/tags'] || []).includes(Number(tagged[1])) && e['block/uuid']).map(e => [e['block/uuid'], e['block/name'] || '']);
  return [];
}
const shown = [], commands = [], menus = [];
const logseq = {
  ready: fn => Promise.resolve().then(fn), settings: {}, updateSettings(s) { Object.assign(this.settings, s); }, useSettingsSchema() {}, showMainUI() {}, hideMainUI() {},
  App: { registerCommandPalette: ({ key }) => commands.push(key), registerPageMenuItem: label => menus.push(label), onCurrentGraphChanged() {}, getCurrentGraph: async () => ({ name: 'logseq_db_pretend', path: '/graphs/pretend' }) },
  DB: { onChanged() {}, datascriptQuery: async q => datascriptQuery(q), q: async query => query === '(task todo)' ? [ent[204]].map(e => ({ uuid: e['block/uuid'], id: e['db/id'], title: e['block/title'] })) : [], customQuery: async () => [] },
  UI: { showMsg: m => shown.push(m) },
  Editor: {
    registerBlockContextMenuItem: label => menus.push(label),
    getPage: async key => { const e = typeof key === 'number' ? ent[key] : byUuid.get(String(key).toLowerCase()) || Object.values(ent).find(x => x['block/name'] === String(key).toLowerCase()); return e && e['block/name'] ? pageOf(e) : null; },
    getCurrentPage: async () => pageOf(ent[100]),
    getPageBlocksTree: async key => { const e = byUuid.get(String(key).toLowerCase()) || Object.values(ent).find(x => x['block/name'] === String(key).toLowerCase()); return e ? childrenOf(e['db/id']).map(tree) : []; },
    getBlock: async (uuid, opts) => { const e = byUuid.get(String(uuid).toLowerCase()); return e ? (opts?.includeChildren ? tree(e) : { ...tree(e), children: [] }) : null; },
    getSelectedBlocks: async () => null, getCurrentBlock: async () => null,
  },
};
module.exports = { logseq, U, ent, shown, commands, menus };
