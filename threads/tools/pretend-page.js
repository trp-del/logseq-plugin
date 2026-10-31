/* The pretend Logseq page the Chromium tests draw on (2026-10-23): tools/pictures.js photographs it still,
   tools/frames.js records it moving. A small graph shaped like the Illness Test Graph behind a stand-in for Logseq's
   API, Logseq 2.0.2's theme colours light and dark, the two-way rows of Dr. Mei Chen's page, and Logseq's own icon
   font from the app's bundle. Not a test by itself. */
const tablerCss = require('./logseq-bundle').tablerStyle();
// Logseq 2.0.2 sets its newer theme colours (--background, --popover, --border, as "h s% l%") and, in dark mode, leaves
// the older --ls-* names unset (read in the app on 2026-10-19); the pretend page does the same.
const THEMES = {
  light: { attrs: '', css: ':root { --background: 0 0% 100%; --popover: 0 0% 100%; --popover-foreground: 0 0% 15%; --border: 0 0% 89%; } body { background: #fff; color: #262626; }' },
  dark: { attrs: ' data-theme="dark" class="dark"', css: ':root { --background: 0 0% 11%; --popover: 0 0% 7%; --popover-foreground: 0 0% 95%; --border: 0 0% 16%; } body { background: rgb(28, 28, 28); color: #d6d8db; }' },
};

// A small graph shaped like the Illness Test Graph, run inside the page as a pretend Logseq.
function pretendLogseq() {
  let next = 10;
  const props = [], tags = [], choices = [];
  const prop = (title, type, many, accepts = []) => { const p = { ':db/id': next++, ':db/ident': ':user.property/' + title.replace(/\W/g, ''), ':block/title': title, ':block/uuid': 'p-' + title.replace(/\W/g, '-'),
    ':logseq.property/type': ':' + type, ':db/cardinality': many ? ':db.cardinality/many' : ':db.cardinality/one', ':logseq.property/classes': accepts.map(id => ({ ':db/id': id })) }; props.push(p); return p; };
  const tag = (title, parent, own = [], desc = '') => { const t = { ':db/id': next++, ':db/ident': ':user.class/' + title.replace(/\W/g, ''), ':block/uuid': 't-' + title.replace(/\W/g, '-'), ':block/title': title,
    ':logseq.property.class/extends': parent ? [{ ':db/id': parent[':db/id'] }] : [], ':logseq.property.class/properties': own.map(p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] })) };
    if (desc) t[':logseq.property/description'] = { ':block/title': desc };
    tags.push(t); return t; };
  const entity = tag('Entity', null, [], 'Things that exist: people, places, medicines.');
  const person = tag('Person', entity, [prop('phone', 'default', false)]);
  const doctor = tag('Doctor', person, [prop('speciality', 'default', false)]);
  const place = tag('Place', entity, [prop('address', 'default', false)]);
  const hospital = tag('Hospital', place);
  const medicine = tag('Medicine', entity, [prop('dose', 'default', false)]);
  const concept = tag('Concept', null);
  const symptom = tag('Symptom', concept);
  const occurrence = tag('Occurrence', null, [prop('date', 'date', false)]);
  const severity = prop('severity', 'default', false);
  const appointment = tag('Appointment', occurrence, [prop('doctor', 'node', false, [doctor[':db/id']]), prop('hospital', 'node', false, [hospital[':db/id']]), prop('symptoms', 'node', true, [symptom[':db/id']])], 'A visit, a scan or a treatment.');
  tag('Infusion', appointment, [prop('medicines', 'node', true, [medicine[':db/id']])]);
  tag('Scan', appointment, [prop('report', 'node', false)]);
  const procedureType = prop('procedure type', 'default', false);
  tag('Procedure', occurrence, [procedureType]);
  tag('Symptom log', occurrence, [severity]);
  ['Imaging', 'Biopsy', 'Surgery'].forEach((t, k) => choices.push([procedureType[':db/id'], { ':block/title': t, ':block/order': 'a' + k }]));
  ['Mild', 'Moderate', 'Severe'].forEach((t, k) => choices.push([severity[':db/id'], { ':block/title': t, ':block/order': 'a' + k }]));
  const counts = tags.map((t, i) => [t[':db/id'], [0, 2, 6, 0, 4, 9, 0, 14, 0, 13, 8, 3, 2, 21][i] || 0]);
  const settings = { tagTreeRoots: 'Entity, Occurrence, Concept', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('closed-value') ? choices
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? counts : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} }, Editor: {},
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

// Two-way rows as on Dr. Mei Chen's page: one short row, one long open list with several kinds of records.
const TWO_WAY_GROUPS = (() => {
  const item = (i, title, tag, day) => ({ uuid: 'r' + i, title, tag, day });
  const visits = [
    item(1, 'Consultation with Dr. Chen', 'Appointment', 20261112), item(2, 'Infusion 9', 'Infusion', 20261105),
    item(3, 'Infusion 8', 'Infusion', 20261015), item(4, 'CT abdomen', 'Scan', 20261002), item(5, 'Infusion 7', 'Infusion', 20260924),
    item(6, 'Infusion 6', 'Infusion', 20260910), item(7, 'Infusion 5', 'Infusion', 20260827),
  ];
  return [
    { name: 'doctor', label: 'doctor of', ident: 'user.property/doctor', fieldUuid: 'f1', items: visits },
    { name: 'works at', label: 'works here', ident: 'user.property/worksat', fieldUuid: 'f2', items: [item(9, 'Northgate Cancer Center', 'Hospital', 0)] },
  ];
})();

const exposeAtEnd = (source, names, file) => {
  const out = source.replace(/\}\)\(\);\s*$/, `${names.map(n => `window.__${n} = ${n};`).join(' ')} })();`);
  if (out === source) throw new Error(`the end of ${file} changed; tools/pictures.js cannot reach it`);
  return out;
};


module.exports = { THEMES, pretendLogseq, TWO_WAY_GROUPS, exposeAtEnd, tablerCss };
