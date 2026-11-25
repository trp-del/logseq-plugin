/* The staged changes: what the tray holds. Each is a small plain object (its kind and what it names); from it come the
   sentence the tray shows with the nodes it touches, the change made to the model so the tree shows the result before
   anything is written, and the steps the writer runs at Apply, each with its inverse for the one Undo.
   Steps name tags and properties through handles ({ id, uuid, title }): a tag made at Apply gets its uuid then, and a
   tag deleted and put back by Undo gets a new one, and every later step sees it. */
(function () {
const S = window.Structure;
const Mo = S.model;
const { count, tag, prop, filled, parentOf, kids } = Mo;
const list = names => Mo.list(names);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const name = (M, id) => tag(M, id)?.title ?? '?';

// What goes with a tag's deletion for good, in the words the merge's sentence and the Apply's question share. A merge moves the
// bullets on the tag's page to the kept tag's page (8 November 2026), so only a removal loses them.
// A merge carries the links written in bullets over to the kept tag (16 November 2026); a removal leaves the name as words.
const losses = (t, merged) => [!merged && t?.bullets && (t.bullets === 1 ? '1 bullet on its page goes' : `${t.bullets} bullets on its page go`), !merged && t?.links && (t.links === 1 ? '1 link becomes words' : `${t.links} links become words`)].filter(Boolean);
const moved = (M, c) => { const t = tag(M, c.from), n = t?.bullets, l = t?.links; return [n && `${n === 1 ? '1 bullet on its page moves' : `${n} bullets on its page move`} to ${name(M, c.into)}`, l && `${l === 1 ? '1 link in a bullet points' : `${l} links in bullets point`} to ${name(M, c.into)}`].filter(Boolean); };
// A change Undo cannot put back whole: a tag with something on it deleted. Undo makes a new one; what is lost stays lost.
function lasting(M, c) {
  const id = c.kind === 'merge' ? c.from : c.kind === 'remove' ? c.tag : null, t = id != null ? tag(M, id) : null;
  if (!t || t.made || !(count(M, id) || t.bullets || t.links)) return null;
  return { name: t.title };
}

// The sentence in the tray, and how many nodes the change touches.
function sentence(M, c) {
  switch (c.kind) {
    case 'move': { const was = parentOf(M, c.tag); return { text: c.to === Mo.LOOSE ? `${name(M, c.tag)} goes to the top, out from under ${was == null ? 'every tag' : name(M, was)}` : `Move ${name(M, c.tag)} from ${was == null ? 'the top' : name(M, was)} to ${name(M, c.to)}`, nodes: count(M, c.tag) }; }
    case 'takeOut': { const stays = Mo.inherited(M, c.tag, c.from), lost = Mo.inherited(M, c.tag).filter(x => !stays.some(y => y.prop === x.prop)).map(x => prop(M, x.prop).title); return { text: `Take ${name(M, c.tag)} out from under ${name(M, c.from)}${lost.length ? `, no longer inheriting ${list(lost)}` : ''}`, nodes: count(M, c.tag) }; }
    case 'rename': return { text: `Rename ${name(M, c.tag)} to ${c.name}`, nodes: count(M, c.tag) };
    case 'renameProp': return { text: `Rename ${prop(M, c.prop).title} to ${c.name}`, nodes: prop(M, c.prop).on.reduce((s, t) => s + filled(M, t, c.prop), 0) };
    case 'merge': {   // the count sits in the tray's own column; what no Undo brings back is said here, as the ask reads this sentence too
      return { text: [`Merge ${name(M, c.from)} into ${name(M, c.into)}, ${name(M, c.from)} removed`, ...moved(M, c), ...losses(tag(M, c.from), true)].join(' · '), nodes: count(M, c.from), ask: `Merge ${name(M, c.from)} into ${name(M, c.into)}`, lost: [...moved(M, c), ...losses(tag(M, c.from), true)] }; }
    case 'retag': return { text: `Move ${plural(c.nodes.length, 'node')} from ${name(M, c.from)} to ${name(M, c.to)}`, nodes: c.nodes.length };
    case 'moveProp': { const from = c.from.filter(id => tag(M, id)); return { text: `Move ${prop(M, c.prop).title} from ${list(from.map(id => name(M, id)))} to ${name(M, c.to)}`, nodes: from.reduce((s, id) => s + filled(M, id, c.prop), 0) }; }
    case 'addProp': return { text: c.under != null ? `Add ${prop(M, c.prop).title} to every tag under ${name(M, c.under)}` : `Add ${prop(M, c.prop).title} to ${list(c.tags.map(id => name(M, id)))}`, nodes: (c.under != null ? [c.under] : c.tags).reduce((s, id) => s + count(M, id), 0) };
    case 'dropProp': { const n = filled(M, c.tag, c.prop); return { text: `Remove ${prop(M, c.prop).title} from ${name(M, c.tag)}${n ? `, ${plural(n, 'value')} kept on the nodes` : ''}`, nodes: n }; }
    case 'remove': return { text: [`Remove ${name(M, c.tag)}`, ...losses(tag(M, c.tag))].join(' · '), nodes: count(M, c.tag) };
    case 'make': return { text: c.under == null ? `Make ${c.name} at the top` : `Make ${c.name} under ${name(M, c.under)}`, nodes: 0 };
    case 'setRange': { const to = c.to.filter(id => tag(M, id)); return { text: `Set ${prop(M, c.prop).title} to point at ${to.length ? list(to.map(id => name(M, id))) : 'any node'}`, nodes: prop(M, c.prop).on.reduce((s, t) => s + filled(M, t, c.prop), 0) }; }
    case 'split': return { text: `Make ${c.name} under ${name(M, c.tag)} with ${plural(c.nodes.length, 'node')}`, nodes: c.nodes.length };   // the ticked nodes of a tag's nodes list, into a new child tag
    case 'mergeProp': { const from = prop(M, c.prop).title, into = prop(M, c.intoProp).title, left = c.kept ? `${plural(c.kept, 'value')} ${c.kept === 1 ? 'stays' : 'stay'} on ${from}` : '';
      return { text: [`Merge ${from} into ${into}, ${from} emptied`, left].filter(Boolean).join(' · '), nodes: M.holders.get(prop(M, c.prop).ident)?.size || 0, ask: `Merge ${from} into ${into}`, lost: left ? [left] : [] }; }
    // 16 November 2026, fixing messy properties: a property made to hold words turned to dates (or another kind).
    case 'retype': { const p = prop(M, c.prop); if (!p) break; const what = KINDS[c.type] || 'words'; return { text: [`Turn ${p.title} into ${what}`, c.moved && `${plural(c.moved, 'value')} ${c.moved === 1 ? 'becomes' : 'become'} ${what === 'dates' ? (c.moved === 1 ? 'a date' : 'dates') : what}`, c.kept && `${plural(c.kept, 'value')} ${c.kept === 1 ? 'stays' : 'stay'} in ${p.title}, as written`].filter(Boolean).join(' · '), nodes: (c.gave || []).length + (c.left || []).length }; }
    // 19 November 2026, the owner: one tag's values of a shared property moved to another property, the other tags left as they are.
    case 'moveForTag': { const p = prop(M, c.prop); if (!p || !tag(M, c.tag)) break; const into = c.intoProp != null ? prop(M, c.intoProp)?.title : c.name;
      return { text: [`On ${name(M, c.tag)} only: move ${p.title} into ${into}${c.intoProp == null ? ' (a new property)' : ''}`, `${name(M, c.tag)} asks for ${into} in place of ${p.title}`].join(' · '), nodes: (c.gave || []).length }; }
    // 24 November 2026, the owner: the values of the nodes picked, placed in another property, and perhaps taken out of the first.
    case 'moveForNodes': { const p = prop(M, c.prop); if (!p) break; const into = c.intoProp != null ? prop(M, c.intoProp)?.title : c.name, n = (c.gave || []).length;
      return { text: `${c.keep ? 'Copy' : 'Move'} ${p.title} into ${into}${c.intoProp == null ? ' (a new property)' : ''}`, nodes: n }; }   // how many nodes stands after the sentence, once
    default: return { text: c.kind, nodes: 0 };
  }
  return { text: c.kind, nodes: 0 };
}

/* The change made to the model, so the tree and the cards show the result at once. A tag made here gets a made-up id
   (negative); the change that made it keeps that id (c.made), so later changes can name it. */
function applyToModel(M, c) {
  const t = c.tag != null ? tag(M, c.tag) : null;
  switch (c.kind) {
    case 'move': if (t && c.to === Mo.LOOSE) { t.parents = []; Mo.link(M); } else if (t && M.tags.has(c.to) && !Mo.under(M, c.to, c.tag)) { t.parents = [c.to, ...t.parents.filter(p => p !== c.to && p !== parentOf(M, c.tag))]; Mo.link(M); } break;
    case 'takeOut': if (t) { t.parents = t.parents.filter(p => p !== c.from); Mo.link(M); } break;
    case 'rename': if (t) t.title = c.name; break;
    case 'renameProp': { const p = prop(M, c.prop); if (p) p.title = c.name; break; }
    case 'merge': { const from = tag(M, c.from), into = tag(M, c.into); if (!from || !into) break;
      for (const n of from.nodes) into.nodes.add(n); into.nodeUuids = [...new Set([...into.nodeUuids, ...from.nodeUuids])]; into.bullets = (into.bullets || 0) + (from.bullets || 0);
      for (const k of from.kids) { const kt = tag(M, k); if (!Mo.under(M, c.into, k)) kt.parents = [c.into, ...kt.parents.filter(p => p !== c.from && p !== c.into)]; else kt.parents = kt.parents.filter(p => p !== c.from); }
      for (const pid of from.props) if (!into.props.includes(pid)) into.props.push(pid);
      if (into.parents.includes(c.from)) into.parents = [...from.parents.filter(p => p !== c.into), ...into.parents.filter(p => p !== c.from)];
      for (const p of M.props.values()) if (p.range.includes(c.from)) p.range = swapped(p.range, c.from, c.into);
      Mo.removeTag(M, c.from); break; }
    case 'retag': { const from = tag(M, c.from), to = tag(M, c.to); if (!from || !to) break; for (const n of c.nodes) { from.nodes.delete(n.id); to.nodes.add(n.id); } from.nodeUuids = from.nodeUuids.filter(u => !c.nodes.some(n => n.uuid === u)); to.nodeUuids = [...new Set([...to.nodeUuids, ...c.nodes.map(n => n.uuid)])]; M.memo.clear(); break; }
    case 'moveProp': { for (const id of c.from) { const x = tag(M, id); if (x) x.props = x.props.filter(p => p !== c.prop); } const to = tag(M, c.to); if (to && !to.props.includes(c.prop)) to.props.push(c.prop); Mo.link(M); break; }
    case 'addProp': { const ids = c.under != null ? everyUnder(M, c.under) : c.tags; for (const id of ids) { const x = tag(M, id); if (x && !x.props.includes(c.prop)) x.props.push(c.prop); } Mo.link(M); break; }
    case 'dropProp': if (t) { t.props = t.props.filter(p => p !== c.prop); Mo.link(M); } break;
    case 'remove': if (t) { for (const k of t.kids) { const kt = tag(M, k); kt.parents = [...t.parents, ...kt.parents.filter(p => p !== c.tag)]; } Mo.removeTag(M, c.tag); } break;
    case 'make': c.made = Mo.addTag(M, c.name, c.under, c.made); break;
    case 'setRange': { const p = prop(M, c.prop); if (p) p.range = c.to.filter(id => tag(M, id)); break; }
    case 'mergeProp': { const from = prop(M, c.prop), into = prop(M, c.intoProp); if (!from || !into) break;
      // The kept property takes the tags, the nodes and the relationships; the one merged away keeps only the values it cannot give.
      for (const t of M.tags.values()) if (t.props.includes(c.prop)) { t.props = t.props.filter(p => p !== c.prop); if (!t.props.includes(c.intoProp)) t.props.push(c.intoProp); }
      const had = M.holders.get(from.ident) || new Set(), keep = new Set(c.left || []);
      M.holders.set(into.ident, new Set([...(M.holders.get(into.ident) || []), ...(c.gave || [...had].filter(n => !keep.has(n)))]));
      M.holders.set(from.ident, new Set([...had].filter(n => keep.has(n))));
      for (const r of M.roads) if (r.ident === from.ident) r.ident = into.ident;
      const pointed = M.pointed.get(from.ident); if (pointed) { const to = M.pointed.get(into.ident) || new Map(); for (const [t, n] of pointed) to.set(t, (to.get(t) || 0) + n); M.pointed.set(into.ident, to); M.pointed.delete(from.ident); }
      if (into.type === 'node' && from.type === 'node' && into.range.length) into.range = [...new Set([...into.range, ...from.range])];
      Mo.link(M); break; }
    case 'retype': { const from = prop(M, c.prop); if (!from) break;
      // The new property stands in the model at once, under a made-up id, on the old one's tags; the nodes it takes go with it.
      const id = c.made ?? M.nextId--; c.made = id;
      const ident = `made.property/${-id}`, title = from.title;
      M.props.set(id, { id, uuid: '', ident, title, type: c.type, many: from.many, choice: false, range: [], on: [], made: true });
      M.byIdent.set(ident, M.props.get(id));
      from.title = `${from.title}, as written`;
      for (const t of M.tags.values()) if (t.props.includes(c.prop)) { t.props.push(id); if (!c.kept) t.props = t.props.filter(x => x !== c.prop); }
      const had = M.holders.get(from.ident) || new Set();
      M.holders.set(ident, new Set(c.gave || []));
      M.holders.set(from.ident, new Set([...had].filter(n => (c.left || []).includes(n))));
      Mo.link(M); break; }
    case 'moveForTag': { const from = prop(M, c.prop); if (!from || !t) break;
      let into = c.intoProp != null ? prop(M, c.intoProp) : null;
      if (!into) {   // the new property stands in the model at once, under a made-up id, as the old one's kind
        const id = c.made ?? M.nextId--; c.made = id; const ident = `made.property/${-id}`;
        into = { id, uuid: '', ident, title: c.name, type: from.choice ? 'default' : from.type, many: from.many, choice: false, range: from.type === 'node' ? from.range.slice() : [], on: [], made: true };
        M.props.set(id, into); M.byIdent.set(ident, into);
      }
      t.props = t.props.filter(x => x !== c.prop); if (!t.props.includes(into.id)) t.props.push(into.id);
      const gave = new Set(c.gave || []), had = M.holders.get(from.ident) || new Set();
      M.holders.set(into.ident, new Set([...(M.holders.get(into.ident) || []), ...gave]));
      M.holders.set(from.ident, new Set([...had].filter(n => !gave.has(n) || (c.left || []).includes(n))));
      Mo.link(M); break; }
    case 'moveForNodes': { const from = prop(M, c.prop); if (!from) break;
      let into = c.intoProp != null ? prop(M, c.intoProp) : null;
      if (!into) {   // the new property stands in the model at once, under a made-up id, as the old one's kind
        const id = c.made ?? M.nextId--; c.made = id; const ident = `made.property/${-id}`;
        into = { id, uuid: '', ident, title: c.name, type: from.choice ? 'default' : from.type, many: from.many, choice: false, range: from.type === 'node' ? from.range.slice() : [], on: [], made: true };
        M.props.set(id, into); M.byIdent.set(ident, into);
      }
      const gave = new Set(c.gave || []), had = M.holders.get(from.ident) || new Set();
      M.holders.set(into.ident, new Set([...(M.holders.get(into.ident) || []), ...gave]));
      if (!c.keep) M.holders.set(from.ident, new Set([...had].filter(n => !gave.has(n) || (c.left || []).includes(n))));
      Mo.link(M); break; }
    case 'split': { c.made = Mo.addTag(M, c.name, c.tag, c.made); const nt = tag(M, c.made); for (const n of c.nodes) { t.nodes.delete(n.id); nt.nodes.add(n.id); } nt.nodeUuids = c.nodes.map(n => n.uuid); t.nodeUuids = t.nodeUuids.filter(u => !c.nodes.some(n => n.uuid === u)); M.memo.clear(); break; }
    default: break;
  }
}
const swapped = (range, from, into) => [...new Set(range.map(id => id === from ? into : id))];
const everyUnder = (M, id) => { const out = []; const walk = x => { for (const k of kids(M, x)) { out.push(k); walk(k); } }; walk(id); return out; };

/* The steps the writer runs, in order, against the model as it stands when the change's turn comes (earlier changes of the
   tray already applied to it). A step: { op, ...handles }. Ops and their inverses (logseq/apply.js):
   makeTag(tag, parent) ⇄ deleteTag; addExtends(tag, parent) ⇄ removeExtends; rename(tag|prop, name, was); addTag(node, tag)
   ⇄ removeTag; addClassProp(tag, prop) ⇄ removeClassProp; setRange(prop, to, was); deleteTag(tag, restore) ⇄ put back;
   moveValues(from, into): every node's values of one property into another, each node's own put back by its inverse. A node
   that already holds a tag gets no addTag, so Undo does not take from it what it held before. */
function steps(M, c) {
  const H = id => handleOf(M, id), out = [];
  const t = c.tag != null ? tag(M, c.tag) : null;
  switch (c.kind) {
    case 'move': { if (!t) break; if (c.to === Mo.LOOSE) { for (const p of t.parents) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(p) }); break; } if (Mo.under(M, c.to, c.tag)) break; const was = parentOf(M, c.tag); out.push({ op: 'addExtends', tag: H(c.tag), parent: H(c.to) }); if (was != null) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(was) }); break; }
    case 'takeOut': if (t?.parents.includes(c.from)) out.push({ op: 'removeExtends', tag: H(c.tag), parent: H(c.from) }); break;
    case 'rename': out.push({ op: 'rename', tag: H(c.tag), name: c.name, was: t.title }); break;
    case 'renameProp': out.push({ op: 'rename', prop: propHandle(M, c.prop), name: c.name, was: prop(M, c.prop).title }); break;
    case 'merge': { const from = tag(M, c.from), into = tag(M, c.into); if (!from || !into) break;
      for (const u of from.nodeUuids) { if (!into.nodeUuids.includes(u)) out.push({ op: 'addTag', node: u, tag: H(c.into) }); out.push({ op: 'removeTag', node: u, tag: H(c.from) }); }
      for (const k of from.kids) { if (Mo.under(M, c.into, k)) continue; out.push({ op: 'addExtends', tag: H(k), parent: H(c.into) }); }
      if (into.parents.includes(c.from)) for (const p of from.parents) if (p !== c.into) out.push({ op: 'addExtends', tag: H(c.into), parent: H(p) });
      for (const pid of from.props) if (!into.props.includes(pid)) out.push({ op: 'addClassProp', tag: H(c.into), prop: propHandle(M, pid) });
      // What pointed at the merged tag points at the kept one; Logseq would only drop the tag from the range.
      for (const p of M.props.values()) if (p.range.includes(c.from)) out.push({ op: 'setRange', prop: propHandle(M, p.id), to: swapped(p.range, c.from, c.into).map(H), was: p.range.map(H) });
      // Taken off first, or Logseq leaves its Root Tag on them when the tag goes. Undone after the tag is back, so on its new uuid.
      for (const k of M.tags.values()) if (k.parents.includes(c.from)) out.push({ op: 'removeExtends', tag: H(k.id), parent: H(c.from) });
      out.push({ op: 'moveBullets', from: H(c.from), into: H(c.into) });
      out.push({ op: 'deleteTag', tag: H(c.from), into: H(c.into), restore: restoreOf(M, c.from) }); break; }
    case 'retag': for (const n of stillOn(M, c.from, c.nodes)) { if (!tag(M, c.to)?.nodeUuids.includes(n.uuid)) out.push({ op: 'addTag', node: n.uuid, tag: H(c.to) }); out.push({ op: 'removeTag', node: n.uuid, tag: H(c.from) }); } break;
    case 'moveProp': { const to = tag(M, c.to); if (to && !to.props.includes(c.prop)) out.push({ op: 'addClassProp', tag: H(c.to), prop: propHandle(M, c.prop) }); for (const id of c.from) if (id !== c.to && tag(M, id)?.props.includes(c.prop)) out.push({ op: 'removeClassProp', tag: H(id), prop: propHandle(M, c.prop) }); break; }
    case 'addProp': for (const id of c.under != null ? everyUnder(M, c.under) : c.tags) if (!tag(M, id).props.includes(c.prop)) out.push({ op: 'addClassProp', tag: H(id), prop: propHandle(M, c.prop) }); break;
    case 'dropProp': if (t?.props.includes(c.prop)) out.push({ op: 'removeClassProp', tag: H(c.tag), prop: propHandle(M, c.prop) }); break;
    case 'remove': if (t) { for (const k of t.kids) for (const p of t.parents) out.push({ op: 'addExtends', tag: H(k), parent: H(p) }); out.push({ op: 'deleteTag', tag: H(c.tag), restore: restoreOf(M, c.tag) }); } break;
    case 'make': { const h = { id: c.made ?? M.nextId--, uuid: '', title: c.name }; M.handles.set(h.id, h); out.push({ op: 'makeTag', tag: h, parent: c.under == null ? null : H(c.under) }); break; }
    case 'setRange': { const p = prop(M, c.prop); const to = c.to.filter(id => tag(M, id)); if (to.length === p.range.length && to.every(id => p.range.includes(id))) break; out.push({ op: 'setRange', prop: propHandle(M, c.prop), to: to.map(H), was: p.range.map(H) }); break; }
    case 'mergeProp': { const from = prop(M, c.prop), into = prop(M, c.intoProp); if (!from || !into) break;
      const F = propHandle(M, c.prop), I = propHandle(M, c.intoProp);
      // Declared where the other was first, so no tag is left without either; the values then, read afresh at Apply.
      for (const t of M.tags.values()) if (t.props.includes(c.prop)) { if (!t.props.includes(c.intoProp)) out.push({ op: 'addClassProp', tag: H(t.id), prop: I }); out.push({ op: 'removeClassProp', tag: H(t.id), prop: F }); }
      if (into.type === 'node' && from.type === 'node' && into.range.length && from.range.some(id => !into.range.includes(id))) out.push({ op: 'setRange', prop: I, to: [...new Set([...into.range, ...from.range])].map(H), was: into.range.map(H) });
      out.push({ op: 'moveValues', from: { ...F, type: from.type, choice: from.choice, many: from.many }, into: { ...I, type: into.type, choice: into.choice, many: into.many } }); break; }
    case 'retype': { const from = prop(M, c.prop); if (!from) break;
      const F = propHandle(M, c.prop), id = c.made ?? M.nextId--, title = freeTitle(M, `${from.title} (${KINDS[c.type] || 'new'})`);
      const N = { id, uuid: '', ident: '', title }; M.handles.set('p' + id, N);
      const tags = [...M.tags.values()].filter(t => t.props.includes(c.prop));
      out.push({ op: 'makeProp', prop: N, type: c.type, many: from.many });
      for (const t of tags) out.push({ op: 'addClassProp', tag: H(t.id), prop: N });
      out.push({ op: 'moveValues', from: { ...F, type: from.type, choice: from.choice, many: from.many }, into: { h: N, type: c.type, choice: false, many: from.many } });
      // The old one keeps what cannot be read, under a name that says so; the new one takes the name.
      out.push({ op: 'rename', prop: F, name: freeTitle(M, `${from.title}, as written`), was: from.title });
      out.push({ op: 'rename', prop: N, name: from.title, was: title });
      if (!c.kept) for (const t of tags) out.push({ op: 'removeClassProp', tag: H(t.id), prop: F });
      break; }
    case 'moveForTag': { const from = prop(M, c.prop); if (!from || !t) break;
      const F = propHandle(M, c.prop);
      let I, into;
      if (c.intoProp != null) { into = prop(M, c.intoProp); if (!into) break; I = propHandle(M, c.intoProp); }
      else {
        into = { type: from.choice ? 'default' : from.type, choice: false, many: from.many };
        I = { id: c.made ?? M.nextId--, uuid: '', ident: '', title: c.name }; M.handles.set('p' + I.id, I);
        out.push({ op: 'makeProp', prop: I, type: into.type, many: from.many });
        if (from.type === 'node' && from.range.length) out.push({ op: 'setRange', prop: I, to: from.range.map(H), was: [] });
      }
      // Asked for on the tag first, so its nodes are never left asking for neither; then the values of its nodes (and of its child
      // tags' nodes, which inherit the property from it), read afresh at Apply; then the old property taken off the tag alone.
      if (c.intoProp == null || !t.props.includes(c.intoProp)) out.push({ op: 'addClassProp', tag: H(c.tag), prop: I });
      out.push({ op: 'moveValues', from: { ...F, type: from.type, choice: from.choice, many: from.many }, into: c.intoProp != null ? { ...I, type: into.type, choice: into.choice, many: into.many } : { h: I, type: into.type, choice: false, many: from.many }, onTags: [c.tag, ...everyUnder(M, c.tag)].map(H) });
      if (t.props.includes(c.prop)) out.push({ op: 'removeClassProp', tag: H(c.tag), prop: F });
      break; }
    // The picked nodes alone, whatever their tags; no tag is asked for anything new. keep: the first property keeps its values.
    // The nodes are named in `picked`, as plain ids: `nodes` is a tag's nodes elsewhere, which a change stops standing without.
    case 'moveForNodes': { const from = prop(M, c.prop); if (!from) break;
      const F = propHandle(M, c.prop);
      let I, into;
      if (c.intoProp != null) { into = prop(M, c.intoProp); if (!into) break; I = propHandle(M, c.intoProp); }
      else {
        into = { type: from.choice ? 'default' : from.type, choice: false, many: from.many };
        I = { id: c.made ?? M.nextId--, uuid: '', ident: '', title: c.name }; M.handles.set('p' + I.id, I);
        out.push({ op: 'makeProp', prop: I, type: into.type, many: from.many });
        if (from.type === 'node' && from.range.length) out.push({ op: 'setRange', prop: I, to: from.range.map(H), was: [] });
      }
      out.push({ op: 'moveValues', from: { ...F, type: from.type, choice: from.choice, many: from.many }, into: c.intoProp != null ? { ...I, type: into.type, choice: into.choice, many: into.many } : { h: I, type: into.type, choice: false, many: from.many }, onNodes: (c.picked || []).slice(), keep: !!c.keep });
      break; }
    case 'split': { const h = { id: c.made ?? M.nextId--, uuid: '', title: c.name }; M.handles.set(h.id, h); out.push({ op: 'makeTag', tag: h, parent: H(c.tag) }); for (const n of stillOn(M, c.tag, c.nodes)) { out.push({ op: 'addTag', node: n.uuid, tag: h }); out.push({ op: 'removeTag', node: n.uuid, tag: H(c.tag) }); } break; }
    default: break;
  }
  return out;
}
// What a property holds, in the plural, for a change's sentence.
const KINDS = { date: 'dates', datetime: 'dates', number: 'numbers', checkbox: 'yes or no', node: 'nodes', page: 'nodes', url: 'links', default: 'words' };
// A property's name no other property has, by adding a number.
const freeTitle = (M, title) => { const taken = new Set([...M.props.values()].map(p => p.title.trim().toLowerCase())); let t = title; for (let n = 2; taken.has(t.toLowerCase()); n++) t = `${title} ${n}`; return t; };
// Of the nodes a change named, those that hold the tag as the graph was last read.
const stillOn = (M, id, nodes) => { const holds = new Set(tag(M, id)?.nodeUuids); return nodes.filter(n => holds.has(n.uuid)); };
// Whether a change can still run: what it names is in the model as it stands. A tag gone from the graph, or made by a line
// taken out, ends it. In a list one name left is enough (the sentence and the steps leave out the others).
const NAMES = ['tag', 'from', 'into', 'to', 'under', 'tags'];
function alive(M, c) {
  const has = id => id === Mo.LOOSE || !!tag(M, id);
  if (c.prop != null && !prop(M, c.prop)) return false;
  if (c.intoProp != null && !prop(M, c.intoProp)) return false;
  for (const k of NAMES) { const v = c[k]; if (Array.isArray(v) ? v.length && !v.some(has) : v != null && !has(v)) return false; }
  return !c.nodes || stillOn(M, c.from ?? c.tag, c.nodes).length > 0;
}
// One handle per tag or property for the whole batch, so a uuid learned at Apply (a tag made) reaches every later step.
function handleOf(M, id) { M.handles ||= new Map(); if (!M.handles.has(id)) { const t = tag(M, id); M.handles.set(id, { id, uuid: t?.uuid || '', title: t?.title || '' }); } return M.handles.get(id); }
function propHandle(M, id) { M.handles ||= new Map(); const key = 'p' + id; if (!M.handles.has(key)) { const p = prop(M, id); M.handles.set(key, { id, uuid: p?.uuid || '', title: p?.title || '', ident: p?.ident || '' }); } return M.handles.get(key); }
// Everything needed to put a deleted tag back: its name, where it sat, what it declared, the relations whose range named it
// (its nodes and child tags get it back from the inverses of the steps that came before the deletion; the values that pointed
// at its page are read at Apply, logseq/apply.js).
const restoreOf = (M, id) => { const t = tag(M, id); return { title: t.title, parents: t.parents.map(p => handleOf(M, p)), props: t.props.map(p => propHandle(M, p)), ranges: [...M.props.values()].filter(p => p.range.includes(id)).map(p => propHandle(M, p.id)) }; };

/* The tray: the changes in order. Its model is the base (the graph as read) with every change applied, built afresh
   when a change comes or goes, so a line taken out leaves the others' result. */
function makeTray() {
  const tray = { changes: [], lost: [], base: null, model: null, done: null };
  tray.setBase = raw => { tray.raw = raw; tray.rebuild(); };
  // Each change's sentence is written on the model as it stands before that change, then the change is applied.
  const say = (M, c) => { const s = sentence(M, c); c.text = s.text; c.count = s.nodes; c.lasting = lasting(M, c); };   // kept on the change (its own `nodes` may be a list)
  // A change that can no longer run leaves the tray for tray.lost, and with it whatever needed it, so the screen can say so.
  tray.rebuild = () => { tray.model = Mo.build(tray.raw || { tags: [], props: [] }); tray.changes = tray.changes.filter(c => { if (!alive(tray.model, c)) { tray.lost.push(c); return false; } say(tray.model, c); applyToModel(tray.model, c); return true; }); return tray.model; };
  tray.stage = c => { say(tray.model, c); tray.changes.push(c); applyToModel(tray.model, c); return c; };
  tray.drop = i => { tray.changes.splice(i, 1); tray.rebuild(); };
  // Tags that came back under new ids (a failed Apply put back): the lines that name them follow.
  tray.renumber = moved => { const to = id => moved.get(id) ?? id; for (const c of tray.changes) for (const k of NAMES) { const v = c[k]; if (Array.isArray(v)) c[k] = v.map(to); else if (v != null) c[k] = to(v); } };
  tray.discard = () => { tray.changes = []; tray.rebuild(); };
  tray.lines = () => tray.changes.map(c => ({ text: c.text, nodes: c.count }));
  tray.nodes = () => tray.lines().reduce((s, l) => s + l.nodes, 0);
  // The links the waiting changes reach, and those that would not survive: a plain count before Apply. A removal turns the links in bullets' words to plain words; a merge carries them to the kept tag; nothing else loses one.
  tray.links = () => { const M = Mo.build(tray.raw || { tags: [], props: [] }), seen = new Set(); let kept = 0, lost = 0; for (const c of tray.changes) for (const id of [c.tag, c.from, c.into, c.to].flat().filter(x => typeof x === 'number' && tag(M, x))) { if (seen.has(id)) continue; seen.add(id); kept += Mo.linksOf(M, id); } for (const c of tray.changes) { const gone = c.kind === 'remove' ? c.tag : null; if (gone != null && tag(M, gone)) lost += tag(M, gone).links; } return { kept: Math.max(0, kept - lost), lost }; };
  tray.lasting = () => tray.changes.map(c => c.lasting).filter(Boolean);
  // The steps of every change, each computed on the model as it stands before that change (the tray's base, then each
  // change applied in turn), so names and parents are those the writer will find.
  tray.plan = () => { const M = Mo.build(tray.raw); M.handles = new Map(); const out = []; for (const c of tray.changes) { const s = steps(M, c); for (const x of s) x.change = c; out.push(...s); applyToModel(M, c); } out.handles = M.handles; return out; };
  return tray;
}

S.changes = { sentence, applyToModel, steps, makeTray, everyUnder, handleOf, propHandle };
})();
