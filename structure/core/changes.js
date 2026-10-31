/* The staged changes: what the tray holds. Each is a small plain object (its kind and what it names); from it come the
   sentence the tray shows with the nodes it touches, the change made to the model so the tree shows the result before
   anything is written, and the steps the writer runs at Apply, each with its inverse for the one Undo.
   Steps name tags and properties through handles ({ id, uuid, title }): a tag made at Apply gets its uuid then, and a
   tag deleted and put back by Undo gets a new one, and every later step sees it. */
(function () {
const S = window.Structure;
const Mo = S.model;
const { count, tag, prop, filled, parentOf, kids } = Mo;
const list = names => S.rules.list(names);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const name = (M, id) => tag(M, id)?.title ?? '?';

// The sentence in the tray, and how many nodes the change touches.
function sentence(M, c) {
  switch (c.kind) {
    case 'move': { const was = parentOf(M, c.tag); return { text: c.to === Mo.LOOSE ? `Take ${name(M, c.tag)} out from under ${was == null ? 'every tag' : name(M, was)}` : `Move ${name(M, c.tag)} from ${was == null ? 'no kind' : name(M, was)} to ${name(M, c.to)}`, nodes: count(M, c.tag) }; }
    case 'rename': return { text: `Rename ${name(M, c.tag)} to ${c.name}`, nodes: count(M, c.tag) };
    case 'renameProp': return { text: `Rename ${prop(M, c.prop).title} to ${c.name}`, nodes: prop(M, c.prop).on.reduce((s, t) => s + filled(M, t, c.prop), 0) };
    case 'merge': return { text: `Merge ${name(M, c.from)} into ${name(M, c.into)}, ${plural(count(M, c.from), 'node')} retagged, ${name(M, c.from)} removed`, nodes: count(M, c.from) };
    case 'retag': return { text: `Move ${plural(c.nodes.length, 'node')} from ${name(M, c.from)} to ${name(M, c.to)}`, nodes: c.nodes.length };
    case 'moveProp': { const from = c.from.filter(id => tag(M, id)); return { text: `Move ${prop(M, c.prop).title} from ${list(from.map(id => name(M, id)))} to ${name(M, c.to)}`, nodes: from.reduce((s, id) => s + filled(M, id, c.prop), 0) }; }
    case 'addProp': return { text: c.under != null ? `Add ${prop(M, c.prop).title} to every tag under ${name(M, c.under)}` : `Add ${prop(M, c.prop).title} to ${list(c.tags.map(id => name(M, id)))}`, nodes: (c.under != null ? [c.under] : c.tags).reduce((s, id) => s + count(M, id), 0) };
    case 'dropProp': { const n = filled(M, c.tag, c.prop); return { text: `Drop ${prop(M, c.prop).title} from ${name(M, c.tag)}${n ? `, ${plural(n, 'value')} kept on the nodes` : ''}`, nodes: n }; }
    case 'remove': return { text: `Remove ${name(M, c.tag)}`, nodes: count(M, c.tag) };
    case 'make': return { text: c.under == null ? `Make ${c.name} under no kind` : `Make ${c.name} under ${name(M, c.under)}`, nodes: 0 };
    case 'keepUnder': return { text: `Keep ${name(M, c.tag)} only under ${name(M, c.parent)}`, nodes: count(M, c.tag) };
    case 'setRange': { const to = c.to.filter(id => tag(M, id)); return { text: `Set ${prop(M, c.prop).title} to point at ${to.length ? list(to.map(id => name(M, id))) : 'any node'}`, nodes: prop(M, c.prop).on.reduce((s, t) => s + filled(M, t, c.prop), 0) }; }
    case 'split': return { text: `Make ${c.name} under ${name(M, c.tag)} with ${plural(c.nodes.length, 'node')}${c.where ? ` where ${c.where}` : ''}`, nodes: c.nodes.length };
    default: return { text: c.kind, nodes: 0 };
  }
}

/* The change made to the model, so the tree and the cards show the result at once. A tag made here gets a made-up id
   (negative); the change that made it keeps that id (c.made), so later changes can name it. */
function applyToModel(M, c) {
  const t = c.tag != null ? tag(M, c.tag) : null;
  switch (c.kind) {
    case 'move': if (t && c.to === Mo.LOOSE) { t.parents = []; Mo.link(M); } else if (t && M.tags.has(c.to) && !Mo.under(M, c.to, c.tag)) { t.parents = [c.to, ...t.parents.filter(p => p !== c.to && p !== parentOf(M, c.tag))]; Mo.link(M); } break;
    case 'rename': if (t) t.title = c.name; break;
    case 'renameProp': { const p = prop(M, c.prop); if (p) p.title = c.name; break; }
    case 'merge': { const from = tag(M, c.from), into = tag(M, c.into); if (!from || !into) break;
      for (const n of from.nodes) into.nodes.add(n); into.nodeUuids.push(...from.nodeUuids);
      for (const k of from.kids) { const kt = tag(M, k); if (!Mo.under(M, c.into, k)) kt.parents = [c.into, ...kt.parents.filter(p => p !== c.from && p !== c.into)]; else kt.parents = kt.parents.filter(p => p !== c.from); }
      for (const pid of from.props) if (!into.props.includes(pid)) into.props.push(pid);
      if (into.parents.includes(c.from)) into.parents = [...from.parents.filter(p => p !== c.into), ...into.parents.filter(p => p !== c.from)];
      Mo.removeTag(M, c.from); break; }
    case 'retag': { const from = tag(M, c.from), to = tag(M, c.to); if (!from || !to) break; for (const n of c.nodes) { from.nodes.delete(n.id); to.nodes.add(n.id); } from.nodeUuids = from.nodeUuids.filter(u => !c.nodes.some(n => n.uuid === u)); to.nodeUuids.push(...c.nodes.map(n => n.uuid)); M.memo.clear(); break; }
    case 'moveProp': { for (const id of c.from) { const x = tag(M, id); if (x) x.props = x.props.filter(p => p !== c.prop); } const to = tag(M, c.to); if (to && !to.props.includes(c.prop)) to.props.push(c.prop); Mo.link(M); break; }
    case 'addProp': { const ids = c.under != null ? everyUnder(M, c.under) : c.tags; for (const id of ids) { const x = tag(M, id); if (x && !x.props.includes(c.prop)) x.props.push(c.prop); } Mo.link(M); break; }
    case 'dropProp': if (t) { t.props = t.props.filter(p => p !== c.prop); Mo.link(M); } break;
    case 'remove': if (t) { for (const k of t.kids) { const kt = tag(M, k); kt.parents = [...t.parents, ...kt.parents.filter(p => p !== c.tag)]; } Mo.removeTag(M, c.tag); } break;
    case 'make': c.made = Mo.addTag(M, c.name, c.under); break;
    case 'keepUnder': if (t) { t.parents = [c.parent]; Mo.link(M); } break;
    case 'setRange': { const p = prop(M, c.prop); if (p) p.range = c.to.filter(id => tag(M, id)); break; }
    case 'split': { c.made = Mo.addTag(M, c.name, c.tag); const nt = tag(M, c.made); for (const n of c.nodes) { t.nodes.delete(n.id); nt.nodes.add(n.id); } nt.nodeUuids = c.nodes.map(n => n.uuid); t.nodeUuids = t.nodeUuids.filter(u => !c.nodes.some(n => n.uuid === u)); if (c.prop != null) nt.props.push(c.prop); M.memo.clear(); break; }
    default: break;
  }
}
const everyUnder = (M, id) => { const out = []; const walk = x => { for (const k of kids(M, x)) { out.push(k); walk(k); } }; walk(id); return out; };

/* The steps the writer runs, in order, against the model as it stands when the change's turn comes (earlier changes of the
   tray already applied to it). A step: { op, ...handles }. Ops and their inverses (logseq/apply.js):
   makeTag(tag, parent) ⇄ deleteTag; addExtends(tag, parent) ⇄ removeExtends; rename(tag|prop, name, was); addTag(node, tag)
   ⇄ removeTag; addClassProp(tag, prop) ⇄ removeClassProp; setRange(prop, to, was); deleteTag(tag, restore) ⇄ put back. */
function steps(M, c) {
  const H = id => handleOf(M, id), out = [];
  const t = c.tag != null ? tag(M, c.tag) : null;
  const ensureKind = id => { const k = tag(M, id); if (k?.missing && !k.uuid) out.push({ op: 'makeTag', tag: H(id), parent: null }); };
  switch (c.kind) {
    case 'move': { if (!t) break; if (c.to === Mo.LOOSE) { for (const p of t.parents) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(p) }); break; } if (Mo.under(M, c.to, c.tag)) break; ensureKind(c.to); const was = parentOf(M, c.tag); out.push({ op: 'addExtends', tag: H(c.tag), parent: H(c.to) }); if (was != null) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(was) }); break; }
    case 'rename': out.push({ op: 'rename', tag: H(c.tag), name: c.name, was: t.title }); break;
    case 'renameProp': out.push({ op: 'rename', prop: propHandle(M, c.prop), name: c.name, was: prop(M, c.prop).title }); break;
    case 'merge': { const from = tag(M, c.from), into = tag(M, c.into); if (!from || !into) break;
      for (const u of from.nodeUuids) { out.push({ op: 'addTag', node: u, tag: H(c.into) }); out.push({ op: 'removeTag', node: u, tag: H(c.from) }); }
      for (const k of from.kids) { if (Mo.under(M, c.into, k)) continue; out.push({ op: 'addExtends', tag: H(k), parent: H(c.into) }); }
      if (into.parents.includes(c.from)) for (const p of from.parents) if (p !== c.into) out.push({ op: 'addExtends', tag: H(c.into), parent: H(p) });
      for (const pid of from.props) if (!into.props.includes(pid)) out.push({ op: 'addClassProp', tag: H(c.into), prop: propHandle(M, pid) });
      out.push({ op: 'deleteTag', tag: H(c.from), into: H(c.into), restore: restoreOf(M, c.from) }); break; }
    case 'retag': for (const n of c.nodes) { out.push({ op: 'addTag', node: n.uuid, tag: H(c.to) }); out.push({ op: 'removeTag', node: n.uuid, tag: H(c.from) }); } break;
    case 'moveProp': { const to = tag(M, c.to); if (to && !to.props.includes(c.prop)) out.push({ op: 'addClassProp', tag: H(c.to), prop: propHandle(M, c.prop) }); for (const id of c.from) if (id !== c.to && tag(M, id)?.props.includes(c.prop)) out.push({ op: 'removeClassProp', tag: H(id), prop: propHandle(M, c.prop) }); break; }
    case 'addProp': for (const id of c.under != null ? everyUnder(M, c.under) : c.tags) if (!tag(M, id).props.includes(c.prop)) out.push({ op: 'addClassProp', tag: H(id), prop: propHandle(M, c.prop) }); break;
    case 'dropProp': if (t?.props.includes(c.prop)) out.push({ op: 'removeClassProp', tag: H(c.tag), prop: propHandle(M, c.prop) }); break;
    case 'remove': if (t) { for (const k of t.kids) for (const p of t.parents) out.push({ op: 'addExtends', tag: H(k), parent: H(p) }); out.push({ op: 'deleteTag', tag: H(c.tag), restore: restoreOf(M, c.tag) }); } break;
    case 'make': { if (c.under != null) ensureKind(c.under); const h = { id: c.made ?? M.nextId--, uuid: '', title: c.name }; M.handles.set(h.id, h); out.push({ op: 'makeTag', tag: h, parent: c.under == null ? null : H(c.under) }); break; }
    case 'keepUnder': if (t) for (const p of t.parents) if (p !== c.parent) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(p) }); break;
    case 'setRange': { const p = prop(M, c.prop); const to = c.to.filter(id => tag(M, id)); if (to.length === p.range.length && to.every(id => p.range.includes(id))) break; for (const id of to) ensureKind(id); out.push({ op: 'setRange', prop: propHandle(M, c.prop), to: to.map(H), was: p.range.map(H) }); break; }
    case 'split': { const h = { id: c.made ?? M.nextId--, uuid: '', title: c.name }; M.handles.set(h.id, h); out.push({ op: 'makeTag', tag: h, parent: H(c.tag) }); if (c.prop != null) out.push({ op: 'addClassProp', tag: h, prop: propHandle(M, c.prop) }); for (const n of c.nodes) { out.push({ op: 'addTag', node: n.uuid, tag: h }); out.push({ op: 'removeTag', node: n.uuid, tag: H(c.tag) }); } break; }
    default: break;
  }
  return out;
}
// One handle per tag or property for the whole batch, so a uuid learned at Apply (a tag made) reaches every later step.
function handleOf(M, id) { M.handles ||= new Map(); if (!M.handles.has(id)) { const t = tag(M, id); M.handles.set(id, { id, uuid: t?.uuid || '', title: t?.title || '' }); } return M.handles.get(id); }
function propHandle(M, id) { M.handles ||= new Map(); const key = 'p' + id; if (!M.handles.has(key)) { const p = prop(M, id); M.handles.set(key, { id, uuid: p?.uuid || '', title: p?.title || '', ident: p?.ident || '' }); } return M.handles.get(key); }
// Everything needed to put a deleted tag back: its name, where it sat, what it declared, the relations whose range named it
// (its nodes get it back from the inverses of the retagging steps that came before the deletion; the values that pointed at
// its page are read at Apply, logseq/apply.js).
const restoreOf = (M, id) => { const t = tag(M, id); return { title: t.title, parents: t.parents.map(p => handleOf(M, p)), props: t.props.map(p => propHandle(M, p)), ranges: [...M.props.values()].filter(p => p.range.includes(id)).map(p => propHandle(M, p.id)) }; };

/* The tray: the changes in order. Its model is the base (the graph as read) with every change applied, built afresh
   when a change comes or goes, so a line taken out leaves the others' result. */
function makeTray() {
  const tray = { changes: [], base: null, model: null, done: null };
  tray.setBase = raw => { tray.raw = raw; tray.rebuild(); };
  // Each change's sentence is written on the model as it stands before that change, then the change is applied.
  const say = (M, c) => { const s = sentence(M, c); c.text = s.text; c.count = s.nodes; };   // kept on the change (its own `nodes` may be a list)
  tray.rebuild = () => { tray.model = Mo.build(tray.raw || { tags: [], props: [] }); for (const c of tray.changes) { say(tray.model, c); applyToModel(tray.model, c); } return tray.model; };
  tray.stage = c => { say(tray.model, c); tray.changes.push(c); tray.done = null; applyToModel(tray.model, c); return c; };
  tray.drop = i => { tray.changes.splice(i, 1); tray.rebuild(); };
  tray.discard = () => { tray.changes = []; tray.rebuild(); };
  tray.lines = () => tray.changes.map(c => ({ text: c.text, nodes: c.count }));
  tray.nodes = () => tray.lines().reduce((s, l) => s + l.nodes, 0);
  // The steps of every change, each computed on the model as it stands before that change (the tray's base, then each
  // change applied in turn), so names and parents are those the writer will find.
  tray.plan = () => { const M = Mo.build(tray.raw); M.handles = new Map(); const out = []; for (const c of tray.changes) { const s = steps(M, c); for (const x of s) x.change = c; out.push(...s); applyToModel(M, c); } return out; };
  return tray;
}

S.changes = { sentence, applyToModel, steps, makeTray, everyUnder, handleOf, propHandle };
})();
