/* node test/core.test.js
   The pure core on the mockup's made-up graph (test/sample.js): the counts, the five rules, the tray's sentences, the
   changes shown in the model before Apply, and the steps the writer runs with what Undo needs. */
const assert = require('node:assert/strict');
const S = require('./run-core.js');
const { sample } = require('./sample.js');
const Mo = S.model;
const raw = sample(), id = n => raw.idOf.get(n), pid = n => raw.propIdOf.get(n);
const titles = (M, ids) => ids.map(i => M.tags.get(i).title);
const plain = x => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

// The model.
let M = Mo.build(raw);
deq(M.kinds.map(k => k.name), ['Entity', 'Occurrence', 'Phenomenon', 'Information']);
assert.equal(Mo.count(M, id('Consultation')), 90); assert.equal(Mo.count(M, id('Medical event')), 226); assert.equal(Mo.count(M, id('Occurrence')), 732);
deq(titles(M, Mo.pathOf(M, id('Consultation'))), ['Occurrence', 'Medical event', 'Consultation']);
assert.equal(Mo.kindOf(M, id('Consultation')), 'O'); assert.equal(Mo.kindOf(M, id('Side effect')), 'P', 'under two parents of one kind is still that kind');
deq(titles(M, Mo.kids(M, id('Medical event'))), ['Blood draw', 'Consultation', 'Procedure', 'Scan', 'Stay', 'Visit'], 'children by name');
assert.equal(Mo.filled(M, id('Consultation'), pid('Provider')), 87); assert.equal(Mo.filled(M, id('Medical event'), pid('Date')), 226, 'filled counts the nodes under the tag, not where the property is declared');
deq(Mo.inherited(M, id('Consultation')).map(x => M.props.get(x.prop).title), ['Notes', 'Status']);
deq(Mo.pointedAt(M, id('Consultation')).map(x => `${M.tags.get(x.tag).title}·${M.props.get(x.prop).title} ${x.filled}`), ['Report·Source 41', 'Question·Asked at 15', 'Decision·After 9', 'Plan·Decided at 6']);
deq(Mo.rangeGuess(M, pid('Maker')).map(([t, n]) => [M.tags.get(t).title, n]), [['Organisation', 4]]);
const empty = Mo.build({ tags: [], props: [] });
assert.equal(empty.kinds.length, 4); assert.ok(empty.tags.get(empty.kinds[0].id).missing, 'a graph without the umbrella tags still shows the four kinds, empty');
console.log('  ok  the model: counts, paths, kinds, what a tag has and what points at it');

// The five rules.
const I = S.rules.issues(M);
const by = text => I.find(i => i.text.startsWith(text));
assert.equal(by('Side effect sits under').fix, 'keep only under Symptom');
assert.equal(by('Source has no nodes').fix, 'remove');
assert.equal(by('Visit reads like Consultation').fix, 'merge into Consultation');
assert.equal(by('Maker on Medication links to nodes').fix, 'set Organisation');
assert.equal(by('Date on Blood draw').fix, 'pull up to Medical event'); assert.equal(by('Date on Blood draw').change.from.length, 6);
assert.equal(by('With on Consultation, 7 of 90').fix, 'drop, or leave');
assert.equal(by('Results is plural').fix, 'merge into Result');
assert.equal(S.rules.singularOf('Consultations'), 'Consultation'); assert.equal(S.rules.singularOf('Studies'), 'Study'); assert.equal(S.rules.singularOf('Diagnosis'), null); assert.equal(S.rules.singularOf('Status'), null); assert.equal(S.rules.singularOf('Process'), null);
assert.equal(S.rules.issuesOn(I, id('Consultation')).length, 1, 'With, on Consultation'); assert.ok(S.rules.issuesUnder(M, I, id('Occurrence')).length >= 3);
const loose = Mo.build({ ...raw, tags: raw.tags.map(t => t.title === 'Task' ? { ...t, parents: [] } : t) });
assert.equal(S.rules.issues(loose).find(i => i.text.startsWith('Task sits under none')).fix, 'put under a kind'); deq(loose.loose.map(i => loose.tags.get(i).title), ['Task']);
console.log('  ok  the five rules, each with its fix');

// The tray: sentences, the model showing the change, lines taken out.
const tray = S.changes.makeTray(); tray.setBase(raw); M = tray.model;
tray.stage({ kind: 'move', tag: id('Scan'), to: id('Conversation') });
deq(tray.lines(), [{ text: 'Move Scan from Medical event to Conversation', nodes: 22 }]);
assert.equal(Mo.parentOf(M, id('Scan')), id('Conversation')); assert.equal(Mo.count(M, id('Medical event')), 204);
tray.stage({ kind: 'merge', from: id('Visit'), into: id('Consultation') });
tray.stage({ kind: 'merge', from: id('Results'), into: id('Result') });
tray.stage(by('Date on Blood draw').change);
deq(tray.lines().slice(1).map(l => l.text), ['Merge Visit into Consultation, Visit removed', 'Merge Results into Result, Results removed', 'Move Date from Blood draw, Consultation, Procedure, Scan and Stay to Medical event'], 'Visit, merged away a line earlier, is not named');
assert.equal(tray.lines()[3].nodes, 226, 'Visit\'s nodes, now Consultation\'s, still count');
assert.ok(!M.tags.has(id('Visit')) && Mo.count(M, id('Consultation')) === 121 && M.tags.get(id('Medical event')).props.includes(pid('Date')) && !M.tags.get(id('Stay')).props.includes(pid('Date')));
tray.stage({ kind: 'rename', tag: id('Scan'), name: 'Imaging' }); assert.equal(M.tags.get(id('Scan')).title, 'Imaging');
tray.stage({ kind: 'dropProp', prop: pid('With'), tag: id('Consultation') }); assert.equal(tray.lines()[5].text, 'Drop With from Consultation, 7 values kept on the nodes');
const made = tray.stage({ kind: 'make', name: 'Follow-up', under: id('Consultation') }); assert.ok(made.made < 0 && M.tags.get(made.made).title === 'Follow-up' && Mo.parentOf(M, made.made) === id('Consultation'));
tray.stage({ kind: 'keepUnder', tag: id('Side effect'), parent: id('Symptom') }); deq(M.tags.get(id('Side effect')).parents, [id('Symptom')]);
tray.stage({ kind: 'setRange', prop: pid('Maker'), to: [id('Organisation')] }); deq(M.props.get(pid('Maker')).range, [id('Organisation')]); assert.equal(tray.lines().at(-1).text, 'Set Maker to point at Organisation');
tray.stage({ kind: 'setRange', prop: pid('With'), to: [id('Person'), id('Organisation')] }); assert.equal(tray.lines().at(-1).text, 'Set With to point at Person and Organisation');
tray.stage({ kind: 'setRange', prop: pid('Provider'), to: [] }); assert.equal(tray.lines().at(-1).text, 'Set Provider to point at any node');
tray.stage({ kind: 'addProp', prop: pid('Notes'), under: id('Conversation') }); assert.ok(M.tags.get(id('Call')).props.includes(pid('Notes')));
assert.equal(tray.lines()[11].text, 'Add Notes to every tag under Conversation');
assert.equal(tray.nodes(), 22 + 31 + 3 + 226 + 22 + 7 + 0 + 30 + 4 + 0 + (87 + 28) + (120 + 22), 'With was dropped a line earlier; Provider counts Visit\'s merged nodes; Scan, moved under Conversation first, counts under it last');
tray.drop(0); assert.equal(Mo.parentOf(tray.model, id('Scan')), id('Medical event'), 'a line taken out leaves the others'); assert.equal(tray.model.tags.get(id('Scan')).title, 'Imaging');
tray.discard(); assert.equal(tray.changes.length, 0); assert.ok(tray.model.tags.has(id('Visit')));
console.log('  ok  the tray: sentences with their counts, the model showing the result, a line taken out');

// The plan: the steps the writer runs, in order, naming tags through handles.
tray.stage({ kind: 'move', tag: id('Scan'), to: id('Conversation') });
tray.stage({ kind: 'merge', from: id('Visit'), into: id('Consultation') });
tray.stage({ kind: 'remove', tag: id('Source') });
tray.stage(by('Date on Blood draw').change);
tray.stage({ kind: 'make', name: 'Follow-up', under: id('Consultation') });
tray.stage({ kind: 'move', tag: id('Stay'), to: tray.changes.find(c => c.kind === 'make').made });
let plan = tray.plan();
const ops = plan.map(s => s.op);
deq(ops.slice(0, 2), ['addExtends', 'removeExtends']); assert.equal(plan[0].tag.title, 'Scan'); assert.equal(plan[0].parent.title, 'Conversation'); assert.equal(plan[1].parent.title, 'Medical event');
const merge = plan.filter(s => s.change.kind === 'merge');
assert.equal(merge.filter(s => s.op === 'addTag').length, 31); assert.equal(merge.filter(s => s.op === 'removeTag').length, 31);
assert.equal(merge.at(-1).op, 'deleteTag'); assert.equal(merge.at(-1).restore.title, 'Visit'); assert.equal(merge.at(-1).into.title, 'Consultation'); deq(merge.at(-1).restore.parents.map(h => h.title), ['Medical event']); deq(merge.at(-1).restore.props.map(h => h.title), ['Provider', 'Date']);
assert.ok(!merge.some(s => s.op === 'addClassProp'), 'Consultation already has Provider and Date');
const pull = plan.filter(s => s.change.kind === 'moveProp');
deq(pull.map(s => `${s.op} ${s.tag.title}`), ['addClassProp Medical event', 'removeClassProp Blood draw', 'removeClassProp Consultation', 'removeClassProp Procedure', 'removeClassProp Scan', 'removeClassProp Stay'], 'Visit is gone by then');
const mk = plan.find(s => s.op === 'makeTag'); assert.equal(mk.tag.title, 'Follow-up'); assert.equal(mk.parent.title, 'Consultation');
const last = plan.at(-2); assert.equal(last.op, 'addExtends'); assert.equal(last.tag.title, 'Stay'); assert.strictEqual(last.parent, mk.tag, 'the move under the new tag shares its handle, so the uuid learned at Apply reaches it');
tray.discard();
tray.stage({ kind: 'split', tag: id('Consultation'), name: 'Follow-up', prop: pid('With'), nodes: [{ id: 1, uuid: 'u1' }, { id: 2, uuid: 'u2' }], where: 'With is Family' });
assert.equal(tray.lines()[0].text, 'Make Follow-up under Consultation with 2 nodes where With is Family');
plan = tray.plan(); deq(plan.map(s => s.op), ['makeTag', 'addClassProp', 'addTag', 'removeTag', 'addTag', 'removeTag']);
tray.discard();
tray.stage({ kind: 'remove', tag: id('Source') }); plan = tray.plan(); deq(plan.map(s => s.op), ['deleteTag']); assert.equal(plan[0].restore.title, 'Source');
tray.discard();
// A graph with no Entity tag: moving under the empty kind row makes the tag first.
const noEntity = { ...raw, tags: raw.tags.filter(t => t.title !== 'Entity').map(t => t.parents[0] === id('Entity') ? { ...t, parents: [] } : t) };
const tray2 = S.changes.makeTray(); tray2.setBase(noEntity);
assert.ok(tray2.model.tags.get(tray2.model.kinds[0].id).missing); assert.equal(tray2.model.loose.length, 4, 'Person, Place, Organisation and Medication under no kind');
tray2.stage({ kind: 'move', tag: id('Person'), to: tray2.model.kinds[0].id });
assert.equal(tray2.lines()[0].text, 'Move Person from no kind to Entity'); assert.equal(tray2.model.loose.length, 3);
plan = tray2.plan(); deq(plan.map(s => s.op), ['makeTag', 'addExtends']); assert.equal(plan[0].tag.title, 'Entity'); assert.strictEqual(plan[1].parent, plan[0].tag);
// The root: a tag taken out of every kind, a new tag under no kind, a kind renamed.
tray.discard();
tray.stage({ kind: 'move', tag: id('Task'), to: Mo.LOOSE }); assert.equal(tray.lines()[0].text, 'Take Task out from under Occurrence'); deq(tray.model.loose, [id('Task')]);
tray.stage({ kind: 'make', name: 'Scratch', under: null }); assert.equal(tray.lines()[1].text, 'Make Scratch under no kind'); assert.equal(tray.model.loose.length, 2);
tray.stage({ kind: 'rename', tag: id('Phenomenon'), name: 'Phenomena' }); assert.equal(tray.model.tags.get(id('Phenomenon')).title, 'Phenomena');
plan = tray.plan(); deq(plan.map(s => s.op), ['removeExtends', 'makeTag', 'rename']); assert.equal(plan[0].parent.title, 'Occurrence'); assert.equal(plan[1].parent, null); assert.equal(plan[2].tag.title, 'Phenomenon'); assert.equal(plan[2].name, 'Phenomena');
tray.discard();
console.log('  ok  the plan: steps in order, handles shared, what Undo needs kept; the root and the kinds');
console.log('core: every check passed');
