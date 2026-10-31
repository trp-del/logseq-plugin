/* Apply and the one Undo. The tray's plan is a list of steps (core/changes.js); each is run through logseq/db.js in
   order and its inverse kept, so the lot can be put back in reverse by one arrow. A step that fails stops the batch
   and the steps already made are put back at once. A tag deleted by a merge or a removal comes back from Undo as a new
   tag of the same name, in the same place, with the same declared properties; its nodes get it back as the retagging steps
   before the deletion are undone. */
(function () {
const S = window.Structure;
const db = S.db;

async function runStep(s, undo) {
  switch (s.op) {
    case 'makeTag': { const made = await db.makeTag(s.tag.title); s.tag.uuid = made.uuid; s.tag.realId = made.id; if (s.parent?.uuid) await db.addExtends(made.uuid, s.parent.uuid); undo.push(async () => { await db.deleteTag(s.tag.uuid); }); break; }
    case 'addExtends': await db.addExtends(s.tag.uuid, s.parent.uuid); undo.push(() => db.removeExtends(s.tag.uuid, s.parent.uuid)); break;
    case 'removeExtends': await db.removeExtends(s.tag.uuid, s.parent.uuid); undo.push(() => db.addExtends(s.tag.uuid, s.parent.uuid)); break;
    case 'rename': { const h = s.tag || s.prop; await db.rename(h.uuid, s.name); undo.push(() => db.rename(h.uuid, s.was)); break; }
    case 'addTag': await db.addTag(s.node, s.tag.uuid); undo.push(() => db.removeTag(s.node, s.tag.uuid)); break;
    case 'removeTag': await db.removeTag(s.node, s.tag.uuid); undo.push(() => db.addTag(s.node, s.tag.uuid)); break;
    case 'addClassProp': await db.addClassProp(s.tag.uuid, s.prop.id); undo.push(() => db.removeClassProp(s.tag.uuid, s.prop.id)); break;
    case 'removeClassProp': await db.removeClassProp(s.tag.uuid, s.prop.id); undo.push(() => db.addClassProp(s.tag.uuid, s.prop.id)); break;
    case 'setRange': await db.setRange(s.prop.uuid, s.to.map(h => h.realId ?? h.id)); undo.push(() => db.setRange(s.prop.uuid, s.was.map(h => h.realId ?? h.id))); break;
    case 'deleteTag': {
      const r = s.restore, h = s.tag, oldId = h.realId ?? h.id;
      // Values that point at the tag's page go to the kept tag's page (a merge), or would be lost with it (a removal).
      const refs = oldId > 0 ? await db.valueRefs(oldId) : [];
      const was = [];
      for (const ref of refs) {
        const ids = await db.valueIds(ref.uuid, ref.ident);
        was.push({ ...ref, ids });
        if (s.into) await db.setValues(ref.uuid, ref.ident, [...new Set(ids.map(v => v === oldId ? (s.into.realId ?? s.into.id) : v))]);
      }
      await db.deleteTag(h.uuid);
      undo.push(async () => {
        const made = await db.makeTag(r.title); h.uuid = made.uuid; h.realId = made.id;
        for (const p of r.parents) if (p.uuid) await db.addExtends(h.uuid, p.uuid);
        for (const p of r.props) await db.addClassProp(h.uuid, p.id);
        for (const p of r.ranges || []) { const ids = await db.rangeIds(p.uuid); if (!ids.includes(made.id)) await db.setRange(p.uuid, [...ids, made.id]); }
        for (const ref of was) await db.setValues(ref.uuid, ref.ident, [...new Set(ref.ids.map(v => v === oldId ? made.id : v))]).catch(() => {});
      });
      break; }
    default: throw new Error('unknown step ' + s.op);
  }
}
// Runs the plan; gives back the undo (a function) and how many steps ran. On a failure the steps made are put back.
async function apply(plan) {
  const undo = [];
  let at = 0;
  try { for (const s of plan) { await runStep(s, undo); at++; } }
  catch (error) { await putBack(undo).catch(() => {}); throw new Error(`${error.message || error}, at step ${at + 1} of ${plan.length} (${plan[at]?.op}); the ${at} made before were put back`); }
  return { steps: at, undo: () => putBack(undo) };
}
async function putBack(undo) { for (const fn of [...undo].reverse()) await fn(); }

S.apply = { apply, runStep };
})();
