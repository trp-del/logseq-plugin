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
const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
deq(titles(M, Mo.tops(M)), raw.tags.filter(t => !(t.parents || []).length).map(t => t.title).sort(byName), 'the top is every tag that extends nothing, by name: no tag stands first for its name');
assert.ok(!('kinds' in M) && !('KINDS' in Mo) && !('kindOf' in Mo) && ![...M.tags.values()].some(t => 'kind' in t), 'no tag is a kind');
assert.equal(Mo.count(M, id('Consultation')), 90); assert.equal(Mo.count(M, id('Medical event')), 226); assert.equal(Mo.count(M, id('Occurrence')), 732);
deq(titles(M, Mo.pathOf(M, id('Consultation'))), ['Occurrence', 'Medical event', 'Consultation']);
deq(titles(M, Mo.kids(M, id('Medical event'))), ['Blood draw', 'Consultation', 'Procedure', 'Scan', 'Stay', 'Visit'], 'children by name');
assert.equal(Mo.filled(M, id('Consultation'), pid('Provider')), 87); assert.equal(Mo.filled(M, id('Medical event'), pid('Date')), 226, 'filled counts the nodes under the tag, not where the property is declared');
deq(Mo.inherited(M, id('Consultation')).map(x => M.props.get(x.prop).title), ['Notes', 'Status']);
deq(Mo.pointedAt(M, id('Consultation')).map(x => `${M.tags.get(x.tag).title}·${M.props.get(x.prop).title} ${x.filled}`), ['Report·Source 41', 'Question·Asked at 15', 'Decision·After 9', 'Plan·Decided at 6']);
deq(Mo.rangeGuess(M, pid('Maker')).map(([t, n]) => [M.tags.get(t).title, n]), [['Organisation', 4]]);
const empty = Mo.build({ tags: [], props: [] });
assert.equal(Mo.tops(empty).length, 0); assert.equal(empty.tags.size, 0, 'a graph with no tags has nothing at the top: no row is made up');
console.log('  ok  the model: counts, paths, the top, what a tag has and what points at it');

// The five rules.
const I = S.rules.issues(M);
const by = text => I.find(i => i.text.startsWith(text));
assert.equal(by('Side effect sits under').fix, 'keep only under Symptom');
assert.equal(by('Source has no nodes').fix, 'remove');
assert.equal(by('Visit reads like Consultation').fix, 'merge into Consultation');
assert.equal(by('Maker on Medication links to nodes').fix, 'set Organisation');
assert.equal(by('Date on Blood draw').fix, 'pull up to Medical event'); assert.equal(by('Date on Blood draw').change.from.length, 6);
assert.equal(by('With on Consultation, 7 of 90').fix, 'drop');
assert.equal(by('Results is plural').fix, 'merge into Result');
const named = title => Mo.build({ ...raw, tags: raw.tags.map(t => t.title === 'Mood' ? { ...t, title } : t) });
const soft = S.rules.issues(named('Diabetes')).find(i => i.text.startsWith('Diabetes'));
assert.equal(soft.text, 'Diabetes may be plural'); assert.equal(soft.fix, 'rename…'); assert.equal(soft.change.kind, 'prompt', 'a guess at a singular is never staged unasked');
assert.equal(S.rules.singularOf("Crohn's"), null, 'a possessive is no plural');
assert.equal(S.rules.singularOf('Consultations'), 'Consultation'); assert.equal(S.rules.singularOf('Studies'), 'Study'); assert.equal(S.rules.singularOf('Diagnosis'), null); assert.equal(S.rules.singularOf('Status'), null); assert.equal(S.rules.singularOf('Process'), null);
assert.equal(S.rules.issuesOn(I, id('Consultation')).length, 1, 'With, on Consultation'); assert.ok(S.rules.issuesUnder(M, I, id('Occurrence')).length >= 3);
const loose = Mo.build({ ...raw, tags: raw.tags.map(t => t.title === 'Task' ? { ...t, parents: [] } : t) });
assert.ok(!S.rules.issues(loose).some(i => i.text.startsWith('Task sits under none')));   // a tag at the top is as good as any, since the top is open
deq(loose.loose.map(i => loose.tags.get(i).title), ['Entity', 'Information', 'Occurrence', 'Phenomenon', 'Task'], 'Task stands at the top among the others, by name');
// A tag named like one of the old kinds, or one slip from it, is a tag like any other: nothing asks to make it a kind.
const slipped = { ...raw, tags: raw.tags.map(t => t.title === 'Occurrence' ? { ...t, title: 'Occurence', parents: [id('Information')] } : t) };
assert.ok(!S.rules.issues(Mo.build(slipped)).some(i => /kind/.test(i.text) || /kind/.test(i.fix)), 'no suggestion speaks of a kind');
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
tray.stage({ kind: 'split', tag: id('Consultation'), name: 'Follow-up', prop: pid('With'), nodes: raw.nodes[id('Consultation')].slice(0, 2), where: 'With is Family' });
assert.equal(tray.lines()[0].text, 'Make Follow-up under Consultation with 2 nodes where With is Family');
plan = tray.plan(); deq(plan.map(s => s.op), ['makeTag', 'addClassProp', 'addTag', 'removeTag', 'addTag', 'removeTag']);
tray.discard();
tray.stage({ kind: 'remove', tag: id('Source') }); plan = tray.plan(); deq(plan.map(s => s.op), ['deleteTag']); assert.equal(plan[0].restore.title, 'Source');
tray.discard();
// A graph with no Entity tag: the tags that were under it stand at the top, and nothing stands empty for Entity.
const noEntity = { ...raw, tags: raw.tags.filter(t => t.title !== 'Entity').map(t => t.parents[0] === id('Entity') ? { ...t, parents: [] } : t) };
const tray2 = S.changes.makeTray(); tray2.setBase(noEntity);
assert.ok(![...tray2.model.tags.values()].some(t => t.title === 'Entity'), 'no empty Entity row'); assert.ok(['Person', 'Place', 'Organisation', 'Medication'].every(n => tray2.model.loose.includes(id(n))));
tray2.stage({ kind: 'move', tag: id('Person'), to: id('Place') });
assert.equal(tray2.lines()[0].text, 'Move Person from the top to Place');
plan = tray2.plan(); deq(plan.map(s => s.op), ['addExtends'], 'nothing is made first');
// Any tag can go to the top, and a tag named Entity can go under another like any tag.
tray2.discard(); tray.discard();
tray.stage({ kind: 'move', tag: id('Consultation'), to: Mo.LOOSE }); assert.equal(tray.lines()[0].text, 'Consultation goes to the top, out from under Medical event'); assert.ok(tray.model.loose.includes(id('Consultation')));
tray.stage({ kind: 'move', tag: id('Entity'), to: id('Information') }); assert.equal(tray.lines()[1].text, 'Move Entity from the top to Information'); assert.ok(!tray.model.loose.includes(id('Entity')));
deq(tray.plan().map(s => s.op), ['removeExtends', 'addExtends']);
// The root: a tag taken to the top, a new tag at the top, a top-level tag renamed.
tray.discard();
tray.stage({ kind: 'move', tag: id('Task'), to: Mo.LOOSE }); assert.equal(tray.lines()[0].text, 'Task goes to the top, out from under Occurrence'); assert.ok(tray.model.loose.includes(id('Task'))); const atTop = tray.model.loose.length;
tray.stage({ kind: 'make', name: 'Scratch', under: null }); assert.equal(tray.lines()[1].text, 'Make Scratch at the top'); assert.equal(tray.model.loose.length, atTop + 1);
tray.stage({ kind: 'rename', tag: id('Phenomenon'), name: 'Phenomena' }); assert.equal(tray.model.tags.get(id('Phenomenon')).title, 'Phenomena');
plan = tray.plan(); deq(plan.map(s => s.op), ['removeExtends', 'makeTag', 'rename']); assert.equal(plan[0].parent.title, 'Occurrence'); assert.equal(plan[1].parent, null); assert.equal(plan[2].tag.title, 'Phenomenon'); assert.equal(plan[2].name, 'Phenomena');
tray.discard();
console.log('  ok  the plan: steps in order, handles shared, what Undo needs kept; the top');

// A merge: a node that held both tags gets no addTag, so Undo cannot take the kept tag from it; child tags are taken off before
// the delete; the sentence says what no Undo brings back.
const pair = S.changes.makeTray();
pair.setBase({ tags: [{ id: 1, uuid: 'from', title: 'From', parents: [], props: [], bullets: 3, links: 12 }, { id: 2, uuid: 'kept', title: 'Kept', parents: [], props: [] }, { id: 3, uuid: 'kid', title: 'Kid', parents: [1], props: [] }, { id: 4, uuid: 'to', title: 'To', parents: [], props: [] }],
  props: [], nodes: { 1: [{ id: 10, uuid: 'both' }, { id: 11, uuid: 'one' }], 2: [{ id: 10, uuid: 'both' }] } });
pair.stage({ kind: 'merge', from: 1, into: 2 });
assert.equal(pair.lines()[0].text, 'Merge From into Kept, From removed · 3 bullets on its page move to Kept · 12 links become words');
deq(pair.plan().map(s => [s.op, s.node ?? s.tag?.title ?? s.from.title, s.parent?.title ?? s.tag?.title ?? s.into.title]), [['removeTag', 'both', 'From'], ['addTag', 'one', 'Kept'], ['removeTag', 'one', 'From'], ['addExtends', 'Kid', 'Kept'], ['removeExtends', 'Kid', 'From'], ['moveBullets', 'From', 'Kept'], ['deleteTag', 'From', 'From']]);
assert.equal(pair.model.tags.get(2).nodeUuids.length, 2, 'a node held twice is one');
pair.discard(); pair.stage({ kind: 'retag', from: 1, to: 2, nodes: [{ id: 10, uuid: 'both' }] });
deq(pair.plan().map(s => s.op), ['removeTag'], 'a retag leaves alone a node that already holds the tag');
console.log('  ok  a merge: what a node held is left, child tags taken off first, the bullets on its page moved, what cannot come back said');
// Out from under one parent: the other stays, the sentence says what goes with it, and one step is written.
{ const two = S.changes.makeTray();
  two.setBase({ tags: [{ id: 1, uuid: 'a', title: 'First', parents: [], props: [7] }, { id: 2, uuid: 'b', title: 'Second', parents: [], props: [8] }, { id: 3, uuid: 'c', title: 'Under both', parents: [1, 2], props: [] }],
    props: [{ id: 7, uuid: 'p', ident: 'user.property/p', title: 'Goes', type: 'default', range: [] }, { id: 8, uuid: 'q', ident: 'user.property/q', title: 'Stays', type: 'default', range: [] }], nodes: { 3: [{ id: 30, uuid: 'n' }] } });
  two.stage({ kind: 'takeOut', tag: 3, from: 1 });
  assert.equal(two.lines()[0].text, 'Take Under both out from under First, no longer inheriting Goes'); assert.equal(two.lines()[0].nodes, 1);
  deq(two.model.tags.get(3).parents, [2], 'the other parent stays');
  deq(two.plan().map(s => [s.op, s.parent.title]), [['removeExtends', 'First']]); }
// A merge swaps the kept tag into what pointed at the merged one, and the card never holds a dead id while it waits.
const ranged = S.changes.makeTray();
ranged.setBase({ tags: [{ id: 1, uuid: 'from', title: 'From', parents: [], props: [] }, { id: 2, uuid: 'kept', title: 'Kept', parents: [], props: [] }, { id: 3, uuid: 'other', title: 'Other', parents: [], props: [] }, { id: 4, uuid: 'gone', title: 'Gone', parents: [], props: [] }],
  props: [{ id: 50, uuid: 'p1', ident: 'user.property/source', title: 'Source', type: 'node', range: [1, 3] }, { id: 51, uuid: 'p2', ident: 'user.property/both', title: 'Both', type: 'node', range: [1, 2] }, { id: 52, uuid: 'p3', ident: 'user.property/kept', title: 'Kept to', type: 'node', range: [2] }] });
ranged.stage({ kind: 'merge', from: 1, into: 2 }); deq(ranged.model.props.get(50).range, [2, 3], 'the kept tag takes its place'); deq(ranged.model.props.get(51).range, [2], 'once');
deq(ranged.plan().filter(s => s.op === 'setRange').map(s => [s.prop.title, s.to.map(h => h.title), s.was.map(h => h.title)]), [['Source', ['Kept', 'Other'], ['From', 'Other']], ['Both', ['Kept'], ['From', 'Kept']]], 'a step for each, before the delete');
assert.equal(ranged.plan().at(-1).op, 'deleteTag');
ranged.discard(); ranged.stage({ kind: 'remove', tag: 4 }); deq(ranged.model.props.get(52).range, [2]);
ranged.discard(); ranged.stage({ kind: 'remove', tag: 3 }); deq(ranged.model.props.get(50).range, [1], 'a removed tag leaves the range while it waits');
ranged.discard();
console.log('  ok  a merge swaps the kept tag into each range; a removed tag leaves it');

// A line taken out: the others keep what they named, and what needed it goes with it.
const lines = S.changes.makeTray();
lines.setBase({ tags: [{ id: 1, uuid: 'stay', title: 'Stay', parents: [], props: [] }, { id: 2, uuid: 'pa', title: 'Parent', parents: [], props: [] }], props: [{ id: 50, uuid: 'p1', ident: 'user.property/x', title: 'X', type: 'node', range: [] }] });
const A = lines.stage({ kind: 'make', name: 'A', under: 2 }), B = lines.stage({ kind: 'make', name: 'B', under: 2 }), C = lines.stage({ kind: 'make', name: 'C', under: 2 });
lines.stage({ kind: 'move', tag: 1, to: B.made });
lines.drop(0); assert.equal(lines.lines().at(-1).text, 'Move Stay from the top to B', 'not C: an id stays what it was'); assert.equal(lines.lost.length, 0);
lines.stage({ kind: 'make', name: 'Under B', under: B.made }); lines.stage({ kind: 'rename', tag: C.made, name: 'C2' }); lines.stage({ kind: 'setRange', prop: 50, to: [B.made] });
const drops = lines.lines().findIndex(l => l.text === 'Make B under Parent');
lines.drop(drops); deq(lines.lines().map(l => l.text), ['Make C under Parent', 'Rename C to C2'], 'what needed B went with it'); deq(lines.lost.map(c => c.kind), ['move', 'make', 'setRange'], 'each said');
lines.lost = []; deq(lines.plan().map(s => s.op), ['makeTag', 'rename']);
console.log('  ok  a line taken out retargets nothing, and takes what needs it with it');

// The tray read again under its changes: a line naming what left the graph leaves the tray, and its nodes follow the graph.
const fresh = S.changes.makeTray(), base = extra => ({ tags: [{ id: 1, uuid: 'a', title: 'A', parents: [], props: [] }, { id: 2, uuid: 'b', title: 'B', parents: [], props: [] }, ...extra], props: [], nodes: { 1: [{ id: 10, uuid: 'n1' }] } });
fresh.setBase(base([{ id: 3, uuid: 'c', title: 'C', parents: [], props: [] }]));
fresh.stage({ kind: 'merge', from: 1, into: 2 }); fresh.stage({ kind: 'move', tag: 3, to: 2 });
fresh.setBase({ ...base([{ id: 3, uuid: 'c', title: 'C', parents: [], props: [] }]), nodes: { 1: [{ id: 10, uuid: 'n1' }, { id: 11, uuid: 'n2' }] } });
deq(fresh.plan().filter(s => s.op === 'addTag').map(s => s.node), ['n1', 'n2'], 'a node tagged since is in the merge');
fresh.setBase(base([])); deq(fresh.lines().map(l => l.text), ['Merge A into B, A removed']); deq(fresh.lost.map(c => c.kind), ['move'], 'a tag gone from the graph ends its line');
fresh.lost = []; fresh.setBase({ tags: [{ id: 2, uuid: 'b', title: 'B', parents: [], props: [] }], props: [] }); assert.equal(fresh.changes.length, 0, 'no merge of a tag that is not there');
// A failed Apply put a tag back under a new id: the waiting line names the new one, so a second press does the same thing.
const again = S.changes.makeTray(); again.setBase(base([])); again.stage({ kind: 'merge', from: 1, into: 2 }); again.renumber(new Map([[1, 7]]));
again.setBase({ tags: [{ id: 7, uuid: 'a2', title: 'A', parents: [], props: [] }, { id: 2, uuid: 'b', title: 'B', parents: [], props: [] }], props: [], nodes: { 7: [{ id: 10, uuid: 'n1' }] } });
assert.equal(again.changes.length, 1); assert.equal(again.plan().at(-1).op, 'deleteTag'); assert.equal(again.plan().at(-1).tag.uuid, 'a2');
// A staged change leaves the last Apply's Undo where it was.
const kept = S.changes.makeTray(); kept.setBase(base([])); kept.done = { text: 'x' }; kept.stage({ kind: 'move', tag: 1, to: 2 }); kept.discard(); deq(kept.done, { text: 'x' });
// A tag named Entity is read as any tag: at the top because it extends nothing, and no other row is made beside it.
{ const one = Mo.build({ tags: [{ id: 1, uuid: 'e', title: 'Entity', parents: [], props: [] }], props: [] }); deq(Mo.tops(one), [1]); assert.equal(one.tags.size, 1); }
console.log('  ok  a tray read again, a failed Apply tried again, the arrow kept');
{ const M = S.model.build({ tags: [{ id: 1, title: 'Organization' }, { id: 2, title: 'Hospital', parents: [1] }, { id: 3, title: 'Doctor', props: [9] }, { id: 4, title: 'Report' }], props: [{ id: 9, ident: 'p/works', title: 'Works at', type: 'node', range: [1, 4] }], roads: [[3, 'p/works', 2, 9]] });
  const of = id => S.model.roadsOf(M, id);
  assert.deepEqual(plain(of(1).in.map(r => [r.from, r.to, r.n])), [[3, 2, 9]], 'a tag answers with the tags beneath it, and a range already used beneath stands no second time');
  assert.deepEqual(plain(of(4).in.map(r => [r.from, r.to, r.n])), [], 'a relation set up and not used yet is no relationship (the audit\'s 13)'); }
{ const M = S.model.build({ tags: [{ id: 1, title: 'Doctor' }, { id: 2, title: 'Treatment' }, { id: 3, title: 'Consultation', props: [9] }], props: [{ id: 9, ident: 'p/provider', title: 'Provider', type: 'node', range: [1] }], roads: [[3, 'p/provider', 1, 12], [3, 'p/provider', 2, 1]] });
  assert.deepEqual(plain(S.model.roads(M).map(r => [r.from, r.to, r.n])), [[3, 1, 12]], 'a value outside the range is a bad value, not a relationship (the audit\'s 13)');
  assert.deepEqual(plain(S.model.roadsOf(M, 2).in), [], 'Treatment is reached by no relationship'); }
// Properties merged: each value as the kept property takes it, what stays behind, what would clash; the tray's line, the model, the steps.
{ const V = S.values, text = { type: 'default' }, node = { type: 'node' }, num = { type: 'number' }, date = { type: 'date' }, yes = { type: 'checkbox' };
  deq(V.convert(text, text, { id: 5, title: 'tired' }), { text: 'tired' });
  deq(V.convert(node, node, { id: 7, title: 'Dr. Mei Chen' }), { id: 7 }, 'a node stays the node it is');
  deq(V.convert(text, node, { id: 5, title: 'Dr. Liu' }), { page: 'Dr. Liu' }, 'words become the node of that name');
  deq(V.convert(text, num, { id: 5, title: '1,200' }), { num: 1200 }); assert.equal(V.convert(text, num, { id: 5, title: 'high' }), null, 'words that are no number stay');
  deq(V.convert(text, date, { id: 5, title: 'Nov 4th, 2026' }), { day: 20261104 }); deq(V.convert(date, date, { id: 9, title: 'Nov 4th, 2026', day: 20261104 }), { id: 9 });
  deq(V.convert(yes, text, { raw: true }), { text: 'true' }); deq(V.convert(text, yes, { id: 5, title: 'Yes' }), { raw: true });
  deq(V.convert(text, { type: 'default', choice: true, choices: new Map([['mild', 40]]) }, { id: 5, title: 'Mild' }), { id: 40 }, 'words that name a choice become it');
  const values = new Map([['p/doc', new Map([[1, [{ id: 7, title: 'Dr. Mei Chen' }]]])], ['p/phys', new Map([[1, [{ id: 8, title: 'Dr. Liu' }]], [2, [{ id: 9, title: 'Dr. Ng' }]]])], ['p/n', new Map([[3, [{ id: 4, title: 'high' }]], [2, [{ id: 6, title: '3' }]]])]]);
  const doc = { id: 1, ident: 'p/doc', type: 'node', many: false }, phys = { id: 2, ident: 'p/phys', type: 'node' }, n = { id: 3, ident: 'p/n', type: 'number' };
  deq(V.preview([phys], doc, values)[0].clash, [1], 'a node holding both, where the kept property takes one value');
  deq(V.preview([phys], { ...doc, many: true }, values)[0].clash, [], 'none where it takes several');
  const x = V.preview([n], { ...n, id: 4, ident: 'p/m' }, values)[0]; assert.equal(x.moved, 1); assert.equal(x.kept, 1); deq(x.left, [3]); deq(x.gave, [2]);
  const tr = S.changes.makeTray();
  tr.setBase({ tags: [{ id: 10, uuid: 'c', title: 'Consultation', props: [1] }, { id: 11, uuid: 'v', title: 'Visit', props: [2] }], props: [{ ...doc, uuid: 'pd', title: 'Doctor', range: [] }, { ...phys, uuid: 'pp', title: 'Physician', range: [] }], nodes: { 10: [{ id: 1, uuid: 'n1' }], 11: [{ id: 2, uuid: 'n2' }] }, holders: { 'p/doc': [1], 'p/phys': [2] } });
  tr.stage({ kind: 'mergeProp', prop: 2, intoProp: 1, kept: 0, left: [], gave: [2] });
  deq(tr.lines(), [{ text: 'Merge Physician into Doctor, Physician emptied', nodes: 1 }]);
  deq(tr.model.tags.get(11).props, [1], 'the tag it was on has the kept property'); deq([...tr.model.holders.get('p/doc')], [1, 2]); assert.equal(tr.model.holders.get('p/phys').size, 0);
  assert.ok(tr.model.props.has(2), 'the property merged away stays, empty');
  deq(tr.plan().map(s => s.op), ['addClassProp', 'removeClassProp', 'moveValues']);
  tr.discard(); tr.stage({ kind: 'mergeProp', prop: 2, intoProp: 1, kept: 2, left: [2], gave: [] });
  assert.equal(tr.lines()[0].text, 'Merge Physician into Doctor, Physician emptied · 2 values stay on Physician');
  tr.setBase({ tags: [], props: [{ ...doc, uuid: 'pd', title: 'Doctor', range: [] }] }); assert.equal(tr.changes.length, 0, 'no merge of a property that is not there'); }
console.log('  ok  properties merged: values converted, what stays, what clashes, the line, the model, the steps');
console.log('core: every check passed');
