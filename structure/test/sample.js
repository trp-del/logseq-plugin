/* The made-up graph of the mockup (structure-mockup.html), about one illness, in the raw shape logseq/db.js reads from a
   graph: ids, parents, declared properties, the nodes under each tag, which nodes hold which property. The numbers are
   the mockup's: Consultation 90 nodes, Provider filled on 87, and so on. */
const KINDS = [['Entity', null], ['Occurrence', null], ['Phenomenon', null], ['Information', null]];
const TAGS = [
  ['Entity', null, 0], ['Person', 'Entity', 2], ['Doctor', 'Person', 14], ['Oncologist', 'Doctor', 5], ['Surgeon', 'Doctor', 3], ['GP', 'Doctor', 2],
  ['Patient', 'Person', 1], ['Family', 'Person', 6], ['Nurse', 'Person', 4], ['Pharmacist', 'Person', 2],
  ['Place', 'Entity', 1], ['Facility', 'Place', 2], ['Hospital', 'Facility', 4], ['Clinic', 'Facility', 6], ['Pharmacy', 'Place', 3], ['Home', 'Place', 1],
  ['Organisation', 'Entity', 1], ['Insurer', 'Organisation', 2], ['Employer', 'Organisation', 1],
  ['Medication', 'Entity', 18],
  ['Occurrence', null, 0], ['Medical event', 'Occurrence', 0], ['Consultation', 'Medical event', 90], ['Procedure', 'Medical event', 31], ['Stay', 'Medical event', 12],
  ['Scan', 'Medical event', 22], ['Blood draw', 'Medical event', 40], ['Visit', 'Medical event', 31],
  ['Conversation', 'Occurrence', 0], ['Call', 'Conversation', 54], ['Email', 'Conversation', 38], ['Message', 'Conversation', 28],
  ['Treatment', 'Occurrence', 0], ['Chemo cycle', 'Treatment', 8], ['Infusion', 'Treatment', 24], ['Dose', 'Treatment', 310],
  ['Task', 'Occurrence', 44],
  ['Phenomenon', null, 0], ['Symptom', 'Phenomenon', 0], ['Fatigue', 'Symptom', 60], ['Pain', 'Symptom', 48], ['Nausea', 'Symptom', 36], ['Sleep', 'Symptom', 22],
  ['Side effect', 'Phenomenon', 30], ['Mood', 'Phenomenon', 41],
  ['Measurement', 'Phenomenon', 0], ['Weight', 'Measurement', 72], ['Temperature', 'Measurement', 55], ['Blood pressure', 'Measurement', 44],
  ['Information', null, 0], ['Report', 'Information', 41], ['Result', 'Information', 0], ['Lab result', 'Result', 66], ['Scan result', 'Result', 22], ['Results', 'Information', 3],
  ['Letter', 'Information', 19], ['Note', 'Information', 36], ['Plan', 'Information', 9], ['Question', 'Information', 23], ['Decision', 'Information', 15], ['Source', 'Information', 0],
];
// [tag, property, kind, range, filled]
const PROPS = [
  ['Consultation', 'Provider', 'node', 'Doctor', 87], ['Consultation', 'Place', 'node', 'Facility', 61], ['Consultation', 'Date', 'date', null, 90], ['Consultation', 'With', 'node', 'Person', 7],
  ['Procedure', 'Surgeon', 'node', 'Surgeon', 29], ['Procedure', 'Date', 'date', null, 31], ['Procedure', 'Place', 'node', 'Hospital', 30],
  ['Stay', 'Date', 'date', null, 12], ['Stay', 'End', 'date', null, 11], ['Stay', 'Place', 'node', 'Hospital', 12],
  ['Scan', 'Date', 'date', null, 22], ['Scan', 'Place', 'node', 'Facility', 20], ['Blood draw', 'Date', 'date', null, 40],
  ['Visit', 'Provider', 'node', 'Doctor', 28], ['Visit', 'Date', 'date', null, 31],
  ['Medical event', 'Notes', 'default', null, 140], ['Medical event', 'Status', 'choice', null, 226],
  ['Call', 'Spoke with', 'node', 'Person', 51], ['Call', 'Date', 'date', null, 54], ['Email', 'From', 'node', 'Person', 38], ['Email', 'Date', 'date', null, 38], ['Message', 'From', 'node', 'Person', 25],
  ['Conversation', 'About', 'node', 'Medical event', 44],
  ['Dose', 'Of', 'node', 'Medication', 310], ['Dose', 'Amount', 'number', null, 302], ['Dose', 'Date', 'date', null, 310], ['Infusion', 'Of', 'node', 'Medication', 24], ['Infusion', 'Place', 'node', 'Facility', 24],
  ['Chemo cycle', 'Starts', 'date', null, 8], ['Chemo cycle', 'Ends', 'date', null, 7],
  ['Task', 'Due', 'date', null, 30], ['Task', 'Status', 'choice', null, 44],
  ['Symptom', 'Severity', 'number', null, 131], ['Symptom', 'Date', 'date', null, 166], ['Side effect', 'Of', 'node', 'Medication', 27], ['Side effect', 'Date', 'date', null, 30],
  ['Mood', 'Date', 'date', null, 41], ['Measurement', 'Value', 'number', null, 171], ['Measurement', 'Date', 'date', null, 171],
  ['Report', 'Source', 'node', 'Consultation', 41], ['Report', 'Author', 'node', 'Doctor', 33], ['Report', 'Date', 'date', null, 41],
  ['Lab result', 'From', 'node', 'Blood draw', 60], ['Scan result', 'From', 'node', 'Scan', 22], ['Result', 'Date', 'date', null, 88],
  ['Letter', 'From', 'node', 'Person', 19], ['Letter', 'To', 'node', 'Person', 17], ['Plan', 'Decided at', 'node', 'Consultation', 6],
  ['Question', 'Asked at', 'node', 'Consultation', 15], ['Question', 'Answered', 'choice', null, 18], ['Decision', 'After', 'node', 'Consultation', 9], ['Decision', 'Date', 'date', null, 15],
  ['Doctor', 'Works at', 'node', 'Facility', 12], ['Doctor', 'Speciality', 'default', null, 9], ['Medication', 'Maker', 'node', null, 4],
];
function sample() {
  const idOf = new Map(TAGS.map(([n], i) => [n, 100 + i]));
  const U = (a, b) => `00000000-0000-4000-8000-${String(a).padStart(4, '0')}${String(b).padStart(8, '0')}`;
  const tags = TAGS.map(([title, parent], i) => ({ id: 100 + i, uuid: U(1, 100 + i), title, parents: parent ? [idOf.get(parent)] : [], props: [] }));
  tags.find(t => t.title === 'Side effect').parents.push(idOf.get('Symptom'));
  const props = [], propIdOf = new Map();
  for (const [, name, type, range] of PROPS) if (!propIdOf.has(name)) { const id = 500 + propIdOf.size; propIdOf.set(name, id); props.push({ id, uuid: U(2, id), ident: 'user.property/' + name.toLowerCase().replace(/\W+/g, '-'), title: name, type: type === 'choice' ? 'default' : type, many: false, choice: type === 'choice', range: range ? [idOf.get(range)] : [] }); }
  // Each tag's own nodes, numbered; the nodes under a tag that hold a property are the first `filled` of them, the tag's own
  // first, then its children's (so a property filled on 87 of Consultation's 90 is held by 87 of its own nodes).
  const nodes = {}, own = new Map();
  let next = 10000;
  for (const [title, , n] of TAGS) { const id = idOf.get(title); nodes[id] = []; for (let i = 0; i < n; i++) { nodes[id].push({ id: next, uuid: U(3, next) }); next++; } own.set(id, nodes[id].map(x => x.id)); }
  const kidsOf = id => tags.filter(t => t.parents[0] === id).map(t => t.id);
  const underIds = id => [...own.get(id), ...kidsOf(id).flatMap(underIds)];
  const holders = {};
  for (const [tagName, name, , , filled] of PROPS) {
    const tagId = idOf.get(tagName), pid = propIdOf.get(name), prop = props.find(p => p.id === pid);
    tags.find(t => t.id === tagId).props.push(pid);
    const ids = underIds(tagId).slice(0, filled);
    holders[prop.ident] = [...new Set([...(holders[prop.ident] || []), ...ids])];
  }
  const pointed = [['user.property/maker', idOf.get('Organisation'), 4]];
  return { tags, props, nodes, holders, pointed, newest: { [idOf.get('Consultation')]: Date.UTC(2026, 9, 28) }, idOf, propIdOf };
}
module.exports = { sample, TAGS, PROPS, KINDS };
