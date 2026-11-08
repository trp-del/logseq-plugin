/* Apply and the one Undo. The tray's plan is a list of steps (core/changes.js); each is run through logseq/db.js in
   order, with its inverse kept before the write, since a step can fail halfway (a list cleared and not filled again). Every
   inverse can run on a step that did not finish. A step that fails stops the batch and everything made is put back at once. Putting back
   runs every inverse, drops each as it succeeds and says how many failed; what failed stays for the next press of the arrow.
   A tag deleted by a merge or a removal comes back from Undo as a new tag of the same name (the next free one when another tag
   holds it), in the same place, with the same declared properties; its nodes and child tags get it back as the steps before
   the deletion are undone. The links to it in bullets do not come back; the bullets on its page do after a merge (below). Before each step the
   graph's name is asked: another graph opened stops the batch, and nothing is put back into the graph now open.
   An Undo never writes over what came after Apply (8 November 2026): a tag or page Apply made goes again only while nothing is
   written on it or points at it, and a node's values go back only while they are as Apply left them. What changed since is
   left as it is: its inverse answers 'kept', and the Undo says how many. A merge moves the bullets on the merged tag's page
   to the kept tag's page before the tag goes, and Undo moves them back. */
(function () {
const S = window.Structure;
const db = S.db;
// An inverse that names a tag not yet back fails and stays, so the next press finds it in order.
const live = h => { if (h.gone) throw new Error(`${h.title} is not back yet`); return h.uuid; };
// A page or tag made at Apply, deleted by Undo only while untouched since.
const unmake = async uuid => { if (!await db.untouched(uuid)) return 'kept'; await db.deleteTag(uuid); };
/* What a node held under some properties, written back only while the node holds what Apply left: the stamp is taken once the
   writes are made, and the first inverse to run decides for all the node's inverses. */
function guarded(spots) {
  const mark = { stamp: null, verdict: null };
  const read = () => Promise.all(spots.map(([uuid, ident]) => db.stamp(uuid, ident))).then(JSON.stringify);
  return {
    seal: async () => { mark.stamp = await read(); },
    // 'kept' once per node, so the Undo counts nodes, not steps.
    run: fn => async () => { if (mark.stamp != null) mark.verdict ??= (await read()) === mark.stamp ? 'go' : 'kept'; if (mark.verdict === 'kept') { if (mark.said) return null; mark.said = true; return 'kept'; } return fn(); },
  };
}

async function runStep(s, undo) {
  switch (s.op) {
    case 'makeTag': { const made = await db.makeTag(s.tag.title); s.tag.uuid = made.uuid; s.tag.realId = made.id; undo.push(() => unmake(live(s.tag))); if (s.parent?.uuid) await db.addExtends(made.uuid, s.parent.uuid); break; }
    case 'addExtends': undo.push(() => db.removeExtends(live(s.tag), live(s.parent))); await db.addExtends(s.tag.uuid, s.parent.uuid); break;
    case 'removeExtends': undo.push(() => db.addExtends(live(s.tag), live(s.parent))); await db.removeExtends(s.tag.uuid, s.parent.uuid); break;
    case 'rename': { const h = s.tag || s.prop; undo.push(async () => { if (await db.titleOf(h.uuid) !== s.was) await db.rename(h.uuid, s.was); }); await db.rename(h.uuid, s.name); break; }
    case 'addTag': undo.push(() => db.removeTag(s.node, live(s.tag))); await db.addTag(s.node, s.tag.uuid); break;
    case 'removeTag': undo.push(() => db.addTag(s.node, live(s.tag))); await db.removeTag(s.node, s.tag.uuid); break;
    case 'addClassProp': undo.push(() => db.removeClassProp(live(s.tag), s.prop.id)); await db.addClassProp(s.tag.uuid, s.prop.id); break;
    case 'removeClassProp': { const had = await db.classPropIds(s.tag.uuid); undo.push(() => db.putClassProps(live(s.tag), had)); await db.removeClassProp(s.tag.uuid, s.prop.id); break; }
    case 'setRange': {
      // What the map does not show in a range (Logseq's Task, Page) stays in it.
      const ids = list => list.map(h => h.realId ?? h.id), before = await db.rangeIds(s.prop.uuid), shown = ids(s.was), kept = before.filter(id => !shown.includes(id));
      undo.push(() => { s.was.forEach(live); return db.setRange(s.prop.uuid, [...kept, ...ids(s.was)]); });
      await db.setRange(s.prop.uuid, [...kept, ...ids(s.to)]);
      break; }
    case 'deleteTag': {
      const r = s.restore, h = s.tag, oldId = h.realId ?? h.id;
      // The last look: a node given the tag since the graph was read goes with the others, or it would lose the tag with nothing in its place.
      const late = oldId > 0 ? await db.nodeUuids(oldId) : [];
      if (late.length && !s.into) throw new Error(`${r.title} has nodes now, so it was not removed`);
      if (late.length) {
        const kept = new Set(await db.nodeUuids(s.into.realId ?? s.into.id));
        for (const node of late) {
          if (!kept.has(node)) { undo.push(() => db.removeTag(node, live(s.into))); await db.addTag(node, s.into.uuid); }
          undo.push(() => db.addTag(node, live(h))); await db.removeTag(node, h.uuid);
        }
      }
      // Values that point at the tag's page go to the kept tag's page (a merge), or would be lost with it (a removal).
      const refs = oldId > 0 ? await db.valueRefs(oldId) : [];
      for (const ref of refs) {
        const ids = await db.valueIds(ref.uuid, ref.ident), g = guarded([[ref.uuid, ref.ident]]);
        undo.push(g.run(() => { live(h); return db.setValues(ref.uuid, ref.ident, [...new Set(ids.map(v => v === oldId ? (h.realId ?? h.id) : v))]); }));
        if (s.into) await db.setValues(ref.uuid, ref.ident, [...new Set(ids.map(v => v === oldId ? (s.into.realId ?? s.into.id) : v))]);
        await g.seal();
      }
      // Run last first: the tag, then what it had, each its own inverse, so a failure resumes where it stopped.
      for (const p of r.ranges || []) undo.push(async () => { live(h); const ids = await db.rangeIds(p.uuid), id = h.realId ?? h.id; if (!ids.includes(id)) await db.setRange(p.uuid, [...ids, id]); });
      for (const p of r.props) undo.push(() => db.addClassProp(live(h), p.id));
      for (const p of r.parents) if (p.uuid) undo.push(() => db.addExtends(live(h), live(p)));
      undo.push(async () => { if (!await db.tagIdByUuid(h.uuid)) { const made = await db.remakeTag(r.title); h.uuid = made.uuid; h.realId = made.id; } h.gone = false; });
      h.gone = true;
      await db.deleteTag(h.uuid);
      break; }
    case 'moveValues': {
      // Read now: the values as they are at Apply. What the kept property cannot take stays where it was; each node is put back on its own.
      const { from, into } = s, V = S.values;
      const [fromVals, intoVals, choices] = await Promise.all([db.propValues(from.ident, from.type), db.propValues(into.ident, into.type), into.choice ? db.choicesOf(into.id) : null]);
      const kept = v => from.choice || V.family(from.type) === 'ref' ? { id: v.id } : v.raw != null ? { raw: v.raw } : from.type === 'number' ? { num: Number(v.title) } : { text: v.title };
      const keptInto = v => into.choice || V.family(into.type) === 'ref' ? { id: v.id } : v.raw != null ? { raw: v.raw } : into.type === 'number' ? { num: Number(v.title) } : { text: v.title };
      for (const [nodeId, list] of fromVals) {
        const node = String(await db.uuidOfNode(nodeId)), was = (intoVals.get(nodeId) || []).map(keptInto), before = list.map(kept);
        const go = [], stay = [];
        for (const v of list) { const w = V.convert(from, { ...into, choices }, v); if (w) go.push(w); else stay.push(kept(v)); }
        if (!go.length) continue;
        if (!into.many && was.length + go.length > 1) throw new Error(`${into.title} takes one value, and a node holds more`);
        const add = [];
        for (const w of go) {
          if (w.page != null) { const p = await db.pageNamed(w.page); if (p.made) undo.push(() => unmake(p.made)); add.push({ id: p.id }); }
          else if (w.day != null) { const p = await db.dayPage(w.day); if (p.made) undo.push(() => unmake(p.made)); add.push({ id: p.id }); }
          else add.push(w);
        }
        const g = guarded([[node, from.ident], [node, into.ident]]);
        undo.push(g.run(() => db.putValues(node, from.ident, before)));
        undo.push(g.run(() => db.putValues(node, into.ident, was)));
        await db.putValues(node, into.ident, [...was, ...add]);
        await db.putValues(node, from.ident, stay);
        await g.seal();
      }
      break; }
    case 'moveBullets': {
      // Read now: the bullets on the merged tag's page as they are at Apply. Undo moves back those still on the kept tag's page.
      const moving = await db.pageBullets(s.from.uuid);
      if (!moving.length) break;
      undo.push(async () => { const into = new Set(await db.pageBullets(live(s.into))); const back = moving.filter(u => into.has(u)); if (back.length) await db.moveBullets(back, live(s.from)); });
      await db.moveBullets(moving, s.into.uuid);
      break; }
    default: throw new Error('unknown step ' + s.op);
  }
}
const elsewhere = () => Object.assign(new Error('another graph was opened'), { elsewhere: true });
// Runs every inverse, last first. Each that succeeds is dropped; gives back the failures. Stops if another graph is open.
// failures.kept: how many inverses left alone what had changed since Apply.
async function putBack(undo, here) {
  const failures = [], left = [];
  failures.kept = 0;
  try {
    while (undo.length) {
      if (!await here()) throw elsewhere();
      const fn = undo.pop();
      try { if (await fn() === 'kept') failures.kept++; } catch (error) { console.error('Structure: a step could not be put back', error); failures.push(error); left.unshift(fn); }
    }
  } finally { undo.push(...left); }
  return failures;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Runs the plan; gives back the undo (a function giving the failures), how many steps ran and how many inverses wait. On a
// failure what was made is put back, and the error says what is left, with the same undo for what could not be.
async function apply(plan, here = async () => true) {
  const undo = [], put = () => putBack(undo, here), left = () => undo.length;
  let at = 0;
  try { for (const s of plan) { if (!await here()) throw elsewhere(); await runStep(s, undo); at++; } }
  catch (error) {
    const out = (text, moved = false) => Object.assign(new Error(text), { undo: put, left, elsewhere: moved });
    if (error.elsewhere || !await here()) throw out(`another graph was opened after step ${at} of ${plan.length}, so the rest stopped; what was written stays in that graph, with its Undo`, true);
    const where = `${error.message || error}, at step ${at + 1} of ${plan.length} (${plan[at]?.op})`;
    const failures = await put().catch(stop => { if (stop.elsewhere) return []; throw stop; });
    if (left()) throw out(`${where}; ${plural(failures.length || left(), 'step')} could not be put back: the arrow tries again`);
    throw out(`${where}; ${at ? `the ${plural(at, 'step')} made before ${at === 1 ? 'was' : 'were'} put back` : 'nothing was written'}`);
  }
  return { steps: at, undo: put, left };
}

S.apply = { apply, runStep };
})();
