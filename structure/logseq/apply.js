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
   to the kept tag's page before the tag goes, and Undo moves them back.
   Since 16 November 2026 the way back is data, not functions: each inverse is { do, ...what it needs }, run by INV below, and kept in
   a record (logseq/records.js) written to this Mac before the writes it covers, so an Undo outlives Logseq and works from the Log for
   30 days. An inverse is safe to run whether or not its write happened, so the inverses of a step are recorded before the step's
   writes, and the record is flushed once per step, not once per write. A tag or page is made first and recorded after (its uuid is
   known only then): a Logseq that quits in that moment leaves one empty tag or page behind, nothing else. */
(function () {
const S = window.Structure;
const db = S.db;
// An inverse that names a tag not yet back fails and stays, so the next press finds it in order.
const live = h => { if (h.gone) throw new Error(`${h.title} is not back yet`); return h.uuid; };
const idOf = h => h.realId ?? h.id;
// A page or tag made at Apply, deleted by Undo only while untouched since.
const unmake = async uuid => { if (!await db.untouched(uuid)) return 'kept'; await db.deleteTag(uuid); };

/* A bullet's words with its links to one tag pointed elsewhere (16 November 2026, step 2 of the tag upkeep plan: until then a merge
   left every link to the merged tag written in a bullet pointing at a tag that no longer was). to: the tag the links go to, or null
   (a removal: the name stays as plain words). A tag is handed to Logseq by its name, #Name or #[[Two words]], since #[[uuid]]
   written by a plugin makes a new tag named by the id; a link keeps its [[uuid]] form, which Logseq reads right. */
const tagWord = title => /^[^\s\[\]#,()"']+$/.test(title) ? '#' + title : `#[[${title}]]`;
function relink(words, oldUuid, oldTitle, to) {
  const id = String(oldUuid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(words)
    .replace(new RegExp(`#\\[\\[${id}\\]\\]`, 'gi'), to ? tagWord(to.title) : oldTitle)
    .replace(new RegExp(`\\[\\[${id}\\]\\]`, 'gi'), to ? `[[${to.uuid}]]` : oldTitle);
}
// The inverses, by name. c is the record: c.h(key) gives a handle as it is now (a tag put back has its new uuid).
const INV = {
  unmake: (x, c) => unmake(x.h ? live(c.h(x.h)) : x.uuid),
  removeExtends: (x, c) => db.removeExtends(live(c.h(x.tag)), live(c.h(x.parent))),
  addExtends: (x, c) => db.addExtends(live(c.h(x.tag)), live(c.h(x.parent))),
  rename: async (x, c) => { const h = c.h(x.h); if (await db.titleOf(h.uuid) !== x.was) await db.rename(h.uuid, x.was); },
  removeTag: (x, c) => db.removeTag(x.node, live(c.h(x.tag))),
  addTag: (x, c) => db.addTag(x.node, live(c.h(x.tag))),
  removeClassProp: (x, c) => db.removeClassProp(live(c.h(x.tag)), x.prop),
  addClassProp: (x, c) => db.addClassProp(live(c.h(x.tag)), x.prop),
  putClassProps: (x, c) => db.putClassProps(live(c.h(x.tag)), x.ids),
  // What the map does not show in a range (Logseq's Task, Page) stays in it.
  setRange: (x, c) => { const was = x.was.map(k => c.h(k)); was.forEach(live); return db.setRange(x.prop, [...x.kept, ...was.map(idOf)]); },
  rangeBack: async (x, c) => { const h = c.h(x.h); live(h); const ids = await db.rangeIds(x.prop), id = idOf(h); if (!ids.includes(id)) await db.setRange(x.prop, [...ids, id]); },
  setValues: (x, c) => { const h = c.h(x.h); live(h); return db.setValues(x.node, x.ident, [...new Set(x.ids.map(v => v === x.oldId ? idOf(h) : v))]); },
  remake: async (x, c) => { const h = c.h(x.h); if (!await db.tagIdByUuid(h.uuid)) { const made = await db.remakeTag(x.title); h.uuid = made.uuid; h.realId = made.id; } h.gone = false; },
  putValues: (x, c) => db.putValues(x.node, x.ident, x.list),
  // The words as they were, the links pointing at the tag put back (its uuid and name now); guarded, so words written since stay.
  wordsBack: async (x, c) => { const h = c.h(x.h); live(h); const title = (await db.titleOf(h.uuid)) || h.title; return db.setWords(x.node, relink(x.words, x.oldUuid, title, { uuid: h.uuid, title })); },
  bulletsBack: async (x, c) => { const into = new Set(await db.pageBullets(live(c.h(x.into)))); const back = x.moving.filter(u => into.has(u)); if (back.length) await db.moveBullets(back, live(c.h(x.from))); },
};
/* A guard: what a node held under some properties, written back only while the node holds what Apply left. The stamp is taken
   once the writes are made; the first inverse to run decides for all the node's inverses, and the answer is kept in the record. */
const readStamp = spots => Promise.all(spots.map(([uuid, ident]) => db.stamp(uuid, ident))).then(JSON.stringify);
async function seal(rec, g) { rec.guards[g].stamp = await readStamp(rec.guards[g].spots); }
async function runInverse(x, rec) {
  if (x.g != null) {
    const g = rec.guards[x.g];
    if (g.stamp != null) g.verdict ??= (await readStamp(g.spots)) === g.stamp ? 'go' : 'kept';
    // 'kept' once per node, so the Undo counts nodes, not steps.
    if (g.verdict === 'kept') { if (g.said) return null; g.said = true; return 'kept'; }
  }
  const fn = INV[x.do];
  if (!fn) throw new Error('unknown way back ' + x.do);
  return fn(x, rec);
}

async function runStep(s, rec) {
  const K = h => rec.key(h), add = inv => rec.add(inv), ready = () => rec.flush();
  switch (s.op) {
    case 'makeTag': { const made = await db.makeTag(s.tag.title); s.tag.uuid = made.uuid; s.tag.realId = made.id; add({ do: 'unmake', h: K(s.tag) }); await ready(); if (s.parent?.uuid) { add({ do: 'removeExtends', tag: K(s.tag), parent: K(s.parent) }); await ready(); await db.addExtends(made.uuid, s.parent.uuid); } break; }
    case 'addExtends': add({ do: 'removeExtends', tag: K(s.tag), parent: K(s.parent) }); await ready(); await db.addExtends(s.tag.uuid, s.parent.uuid); break;
    case 'removeExtends': add({ do: 'addExtends', tag: K(s.tag), parent: K(s.parent) }); await ready(); await db.removeExtends(s.tag.uuid, s.parent.uuid); break;
    case 'rename': { const h = s.tag || s.prop; add({ do: 'rename', h: K(h), was: s.was }); await ready(); await db.rename(h.uuid, s.name); break; }
    case 'addTag': add({ do: 'removeTag', node: s.node, tag: K(s.tag) }); await ready(); await db.addTag(s.node, s.tag.uuid); break;
    case 'removeTag': add({ do: 'addTag', node: s.node, tag: K(s.tag) }); await ready(); await db.removeTag(s.node, s.tag.uuid); break;
    case 'addClassProp': add({ do: 'removeClassProp', tag: K(s.tag), prop: s.prop.id }); await ready(); await db.addClassProp(s.tag.uuid, s.prop.id); break;
    case 'removeClassProp': { const had = await db.classPropIds(s.tag.uuid); add({ do: 'putClassProps', tag: K(s.tag), ids: had }); await ready(); await db.removeClassProp(s.tag.uuid, s.prop.id); break; }
    case 'setRange': {
      const ids = list => list.map(idOf), before = await db.rangeIds(s.prop.uuid), shown = ids(s.was), kept = before.filter(id => !shown.includes(id));
      add({ do: 'setRange', prop: s.prop.uuid, kept, was: s.was.map(K) }); await ready();
      await db.setRange(s.prop.uuid, [...kept, ...ids(s.to)]);
      break; }
    case 'deleteTag': {
      const r = s.restore, h = s.tag, oldId = idOf(h), hk = K(h);
      // The last look: a node given the tag since the graph was read goes with the others, or it would lose the tag with nothing in its place.
      const late = oldId > 0 ? await db.nodeUuids(oldId) : [];
      if (late.length && !s.into) throw new Error(`${r.title} has nodes now, so it was not removed`);
      if (late.length) {
        const kept = new Set(await db.nodeUuids(idOf(s.into))), ik = K(s.into);
        for (const node of late) { if (!kept.has(node)) add({ do: 'removeTag', node, tag: ik }); add({ do: 'addTag', node, tag: hk }); }
        await ready();
        for (const node of late) { if (!kept.has(node)) await db.addTag(node, s.into.uuid); await db.removeTag(node, h.uuid); }
      }
      // Values that point at the tag's page go to the kept tag's page (a merge), or would be lost with it (a removal).
      const refs = oldId > 0 ? await db.valueRefs(oldId) : [];
      if (refs.length) {
        const each = [];
        for (const ref of refs) { const ids = await db.valueIds(ref.uuid, ref.ident), g = rec.guard([[ref.uuid, ref.ident]]); add({ do: 'setValues', g, h: hk, node: ref.uuid, ident: ref.ident, ids, oldId }); each.push({ ref, ids, g }); }
        await ready();
        for (const { ref, ids, g } of each) { if (s.into) await db.setValues(ref.uuid, ref.ident, [...new Set(ids.map(v => v === oldId ? idOf(s.into) : v))]); await seal(rec, g); }
      }
      // Links to the tag written in bullets follow it to the kept tag (a merge), or become its name as plain words (a removal).
      const worded = oldId > 0 ? await db.wordRefs(oldId, h.uuid) : [];
      if (worded.length) {
        const each = [];
        for (const w of worded) { const g = rec.guard([[w.uuid, 'block/title']]); add({ do: 'wordsBack', g, h: hk, node: w.uuid, words: w.words, oldUuid: h.uuid }); each.push({ w, g }); }
        await ready();
        for (const { w, g } of each) { await db.setWords(w.uuid, relink(w.words, h.uuid, r.title, s.into ? { uuid: s.into.uuid, title: s.into.title } : null)); await seal(rec, g); }
      }
      // Run last first: the tag, then what it had, each its own inverse, so a failure resumes where it stopped.
      for (const p of r.ranges || []) add({ do: 'rangeBack', h: hk, prop: p.uuid });
      for (const p of r.props) add({ do: 'addClassProp', tag: hk, prop: p.id });
      for (const p of r.parents) if (p.uuid) add({ do: 'addExtends', tag: hk, parent: K(p) });
      add({ do: 'remake', h: hk, title: r.title });
      h.gone = true;
      await ready();
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
        const put = [];
        for (const w of go) {
          if (w.page != null) { const p = await db.pageNamed(w.page); if (p.made) add({ do: 'unmake', uuid: p.made }); put.push({ id: p.id }); }
          else if (w.day != null) { const p = await db.dayPage(w.day); if (p.made) add({ do: 'unmake', uuid: p.made }); put.push({ id: p.id }); }
          else put.push(w);
        }
        const g = rec.guard([[node, from.ident], [node, into.ident]]);
        add({ do: 'putValues', g, node, ident: from.ident, list: before });
        add({ do: 'putValues', g, node, ident: into.ident, list: was });
        await ready();
        await db.putValues(node, into.ident, [...was, ...put]);
        await db.putValues(node, from.ident, stay);
        await seal(rec, g);
      }
      break; }
    case 'moveBullets': {
      // Read now: the bullets on the merged tag's page as they are at Apply. Undo moves back those still on the kept tag's page.
      const moving = await db.pageBullets(s.from.uuid);
      if (!moving.length) break;
      add({ do: 'bulletsBack', moving, from: K(s.from), into: K(s.into) }); await ready();
      await db.moveBullets(moving, s.into.uuid);
      break; }
    default: throw new Error('unknown step ' + s.op);
  }
}
const elsewhere = () => Object.assign(new Error('another graph was opened'), { elsewhere: true });
/* Runs every inverse not yet done, last first. Each that succeeds is marked done in the record; the failures stay, in order, for
   the next press. Stops if another graph is open. failures.kept: how many inverses left alone what had changed since Apply. */
async function putBack(rec, here) {
  const failures = [];
  failures.kept = 0;
  rec.state = 'undoing'; await rec.flush();
  try {
    for (let i = rec.inverses.length - 1; i >= 0; i--) {
      const x = rec.inverses[i];
      if (x.done) continue;
      if (!await here()) throw elsewhere();
      try { if (await runInverse(x, rec) === 'kept') failures.kept++; x.done = true; }
      catch (error) { console.error('Structure: a step could not be put back', error); failures.push(error); }
      rec.touched(i);
      await rec.flush();
    }
  } finally { rec.state = rec.left() ? 'done' : 'undone'; await rec.flush().catch(error => console.error('Structure: the record could not be kept', error)); }
  return failures;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/* Runs the plan into the record (records.js; one in memory when none is given); gives back the undo (a function giving the
   failures), how many steps ran and how many inverses wait. On a failure what was made is put back, and the error says what is
   left, with the same undo for what could not be. */
async function apply(plan, here = async () => true, rec = S.records ? S.records.make({ graph: '', text: '', memory: true }) : null) {
  const put = () => putBack(rec, here), left = () => rec.left();
  let at = 0;
  rec.of = plan.length; rec.state = 'writing';
  await rec.flush();
  try { for (const s of plan) { if (!await here()) throw elsewhere(); await runStep(s, rec); at++; rec.steps = at; } rec.state = 'done'; await rec.flush(); }
  catch (error) {
    const out = (text, moved = false) => Object.assign(new Error(text), { undo: put, left, elsewhere: moved, rec });
    if (error.elsewhere || !await here()) { rec.state = 'done'; await rec.flush().catch(() => {}); throw out(`another graph was opened after step ${at} of ${plan.length}, so the rest stopped; what was written stays in that graph, with its Undo`, true); }
    const where = `${error.message || error}, at step ${at + 1} of ${plan.length} (${plan[at]?.op})`;
    const failures = await put().catch(stop => { if (stop.elsewhere) return []; throw stop; });
    if (left()) throw out(`${where}; ${plural(failures.length || left(), 'step')} could not be put back: the arrow tries again`);
    throw out(`${where}; ${at ? `the ${plural(at, 'step')} made before ${at === 1 ? 'was' : 'were'} put back` : 'nothing was written'}`);
  }
  return { steps: at, undo: put, left, rec };
}

S.apply = { apply, runStep, putBack, relink };
})();
