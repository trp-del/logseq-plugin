/* TENDING: values moved from one property into another. You say which nodes (a tag's, or every node that holds the property),
   which property the values come out of and which they go into (one there is, or a new one of the same kind), and whether they
   are taken off the first. Before anything is written the box shows a few of the nodes as they will read: what comes in green,
   what goes struck through in red, and the yes says how many ("Copy 16 values", "Move 16 values"). A property that takes one
   value is never given a second, and a value that has bullets written under it stays where it is: such nodes are left as they
   are, and the box says how many and why. Afterwards one line says what was done, with one Undo for all of it, a property it
   made included; the line stays, Logseq closed and opened again, until you let it go. A second move gets a line of its own
   over the first.
   That Undo is the plugin's own (Logseq's Undo does not last past a restart): it puts back what each node held before the
   move, and only where the node still holds exactly what the move left. A node changed since is left as it is and named;
   nothing written after the move is taken back. Where Logseq refuses a write half way through a move, what was written by then
   keeps its line, its Undo and its line in Ontology's History.
     G.moving.ask(place, { from, tag, only })   the box, put at the head of place: from, a property's ident; tag, { id, title } to
                                          take only that tag's nodes and those of the tags below it; only, the ids of the nodes to
                                          take (the rows ticked in one of Logseq's tables). One of the three at least
     G.moving.last(place)                 the lines of the moves made in this graph and not let go
     G.changeBox.CSS                      the look of the box a change of many nodes is shown in before it is made, which
                                          Ontology's merge is drawn in too, whether or not this part runs */
(function () {
const G = window.PluginDoor;
const KEY = 'lk.moved', REF = type => type === 'node' || type === 'date' || type === 'asset';
/* The moves made and not let go, newest first: kept on this Mac (G.touch.kept), and here for this sitting, so a line stays true
   where the window's store is full. A move kept by an earlier release is one record with no note of what was written: it is
   read as the move it was. */
let records = null;
const old = record => record && Array.isArray(record.rows) && record.from && record.into ? { ...record, id: record.id || String(record.when || Date.now()),
  rows: record.rows.map(row => row.wrote ? row : { ...row, wrote: { into: row.comes?.length ? [...(row.was?.into || []), ...row.comes] : null, from: !!row.goes } }) } : null;
const store = {
  all() { if (!records) { const kept = G.touch.kept(KEY, null).get(); records = (Array.isArray(kept) ? kept : kept ? [kept] : []).map(old).filter(Boolean); } return records; },
  save() { const keeper = G.touch.kept(KEY, null); if (store.all().length) keeper.set(records); else keeper.drop(); },
  add(record) { store.all().unshift(record); store.save(); },
  drop(record) { records = store.all().filter(one => one !== record); store.save(); },
};
const esc = text => G.esc(String(text ?? ''));
const few = (values, cls) => values.map(value => `<span class="${cls}">${esc(value.text || '—')}</span>`).join(', ');
const named = rows => rows.slice(0, 3).map(row => `“${String(row.words || 'Untitled').slice(0, 40)}”`).join(', ') + (rows.length > 3 ? ` and ${rows.length - 3} more` : '');

function boxAt(place) {
  let box = place.querySelector(':scope > .lk-ask.lk-moving');
  if (!box) { box = place.ownerDocument.createElement('div'); box.className = 'lk-ask lk-moving'; const head = place.querySelector(':scope > .lk-add'); if (head) head.after(box); else place.prepend(box); }   // under the line that adds, above the lists
  return box;
}

/* A move put back: each node that still holds what the move left gets back what it held before. Answers what was done:
   { back, changed: [row], refused: [{ row, error }] }. */
async function putBack(record, say) {
  G.read.forget();
  const [into, from] = await Promise.all([G.read.holders(record.into.ident), G.read.holders(record.from.ident)]);
  const raws = list => new Map(list.map(node => [node.uuid, node.values.map(value => value.raw)]));
  const can = G.move.back(record.rows, { into: raws(into), from: raws(from) }), refused = [];
  for (const [i, row] of can.back.entries()) {
    say(`Putting back ${i + 1} of ${can.back.length}…`);
    try {
      if (row.wrote.into) { await G.write.setValues(row.uuid, record.into.ident, row.was.into, { ref: REF(record.type), many: record.into.many }); row.wrote.into = null; }
      if (row.wrote.from) { await G.write.setValues(row.uuid, record.from.ident, row.was.from, { ref: REF(record.type), many: record.from.many }); row.wrote.from = false; }
    } catch (error) { refused.push({ row, error }); }
  }
  return { back: can.back.length - refused.length, changed: can.left, refused };
}

// The lines of what was done, each with its Undo.
async function last(place) {
  let graph = '';
  try { graph = await G.read.graph(); } catch (error) { return; }
  const mine = store.all().filter(record => record.graph === graph);
  if (!mine.length) { const box = place.querySelector(':scope > .lk-ask.lk-moving'); if (box && !box.dataset.asking) box.remove(); return; }
  const box = boxAt(place);
  if (box.dataset.asking) return;
  box.innerHTML = mine.map(record => {
    const n = record.rows.reduce((sum, row) => sum + (row.comes?.length || 0), 0) || record.rows.reduce((sum, row) => sum + (row.goes ? row.was.from.length : 0), 0);
    return `<div class="lk-ask-said" data-id="${esc(record.id)}">${record.remove ? 'Moved' : 'Copied'} ${n} ${n === 1 ? 'value' : 'values'} from <span class="lk-prop">${esc(record.from.title)}</span> into <span class="lk-prop">${esc(record.into.title)}</span>${record.into.made ? ', a new property' : ''}.</div>
<div class="lk-answers" data-id="${esc(record.id)}"><button type="button" class="lk-btn lk-i-undo" data-do="undo">Undo</button><button type="button" class="lk-btn lk-low" data-do="done">Done</button></div>`;
  }).join('');
  box.onclick = async event => {
    const button = event.target.closest('[data-do]'), act = button?.dataset.do, id = button?.closest('[data-id]')?.dataset.id;
    const record = store.all().find(one => one.id === id);
    if (!act) return;
    if (!record) { last(place); return; }   // let go from another place meanwhile
    if (act === 'done') { store.drop(record); last(place); }
    if (act === 'undo') {
      box.querySelectorAll('button').forEach(one => { one.disabled = true; });
      const said = [...box.querySelectorAll('.lk-ask-said')].find(one => one.dataset.id === id);
      let done = null;
      try { done = await putBack(record, words => { if (said) said.textContent = words; }); }
      catch (error) { G.write.refused('The move could not be put back', error, 'Nothing was changed. Press Undo again.'); }
      if (done) {
        const total = record.rows.length;
        let kept = null;   // the refusal, where the property the move made could not be taken away
        record.rows = done.refused.map(one => one.row);
        if (record.rows.length) store.save();
        else {
          // The property the move made goes with it, once nothing is held under it any more.
          if (record.into.made) { try { G.read.forget(); if (!(await G.read.holders(record.into.ident)).length) await G.write.dropProperty(record.into.uuid); } catch (error) { kept = error; } }
          store.drop(record);
        }
        if (kept) G.write.refused(`The property “${record.into.title}”, which the move made, could not be removed`, kept, done.back === total ? 'Every value is back where it was.' : '');
        if (done.back === total) { if (!kept) G.say('Every value is back where it was'); }
        else {
          const n = done.changed.length, words = [`${done.back} of ${total} ${total === 1 ? 'node is' : 'nodes are'} back as ${total === 1 ? 'it was' : 'they were'} before the move.`,
            n ? `${n} ${n === 1 ? 'was' : 'were'} changed after the move and ${n === 1 ? 'is left as it is' : 'are left as they are'}: ${named(done.changed)}.` : ''].filter(Boolean).join(' ');
          if (done.refused.length) G.write.refused(`${words} ${done.refused.length} could not be put back (${named(done.refused.map(one => one.row))})`, done.refused[0].error, 'The line of the move stays: press its Undo again once that is mended.');
          else G.say(words, 'warning', true);
        }
      }
      last(place);
    }
  };
}

async function ask(place, { from = '', tag = null, only = null } = {}) {
  const doc = place.ownerDocument, box = boxAt(place);
  box.dataset.asking = '1'; box.onclick = null;
  const state = { from, into: null, naming: false, remove: false, nodes: [], made: null, busy: false };
  const [schema, pairs, tags] = await Promise.all([G.read.schema(), tag ? G.read.tagPairs() : [], G.read.tags()]);
  const below = tag ? G.tags.under(tag.id, tags) : null;   // the tag and the tags under it, worked out once
  const within = only ? new Set(only) : tag ? new Set(pairs.filter(([t]) => below.has(t)).map(([, node]) => node)) : null;
  // For ticked rows with no property named: the one most of them hold comes first.
  if (only && !state.from) { const held = await G.read.held([...within]), n = new Map(); for (const has of held.values()) for (const title of Object.keys(has)) n.set(title, (n.get(title) || 0) + 1);
    const most = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]; state.from = [...schema.props.values()].find(prop => prop.title === most)?.ident || ''; }
  const props = [...schema.props.values()].sort((a, b) => a.title.localeCompare(b.title));
  const whose = only ? `the ${within.size} ticked ${within.size === 1 ? 'node' : 'nodes'}` : tag ? `the nodes tagged ${tag.title}` : 'every node that holds it';
  const close = () => { delete box.dataset.asking; box.remove(); doc.removeEventListener('keydown', onKey, true); last(place); };
  const read = async () => {
    const prop = schema.props.get(state.from);
    if (!prop) { state.nodes = []; return; }
    const [has, holds] = await Promise.all([G.read.holders(state.from), state.into?.ident ? G.read.holders(state.into.ident) : []]);
    const into = new Map(holds.map(node => [node.id, node.values]));
    state.nodes = has.filter(node => !within || within.has(node.id)).map(node => ({ uuid: node.uuid, words: node.words, from: node.values, into: into.get(node.id) || [] }));
  };
  const plan = () => { const fromProp = schema.props.get(state.from); return fromProp ? G.move.plan({ nodes: state.nodes, from: fromProp, into: state.into && (state.into.isNew ? { ...state.into, type: fromProp.type, many: fromProp.many } : schema.props.get(state.into.ident)), remove: state.remove }) : { refused: 'Choose the property the values come out of', rows: [], values: 0, kept: 0, left: [] }; };
  const draw = () => {
    const fromProp = schema.props.get(state.from), made = plan(), yes = made.refused ? '' : G.move.yes(made, state.remove), changed = made.rows.filter(row => !row.skip && (row.comes.length || row.goes.length));
    state.made = made;
    const into = state.naming ? `<input class="lk-field lk-ask-name" type="text" placeholder="Name of the new property" aria-label="Name of the new property" spellcheck="false" autocomplete="off">`
      : `<button type="button" class="lk-btn lk-low lk-prop" data-do="into">${state.into ? esc(state.into.title) + (state.into.isNew ? ' (new)' : '') : 'choose…'}</button>`;
    box.innerHTML = `<div class="lk-ask-head">Move values</div>
<div class="lk-ask-line">From <button type="button" class="lk-btn lk-low lk-prop" data-do="from">${fromProp ? esc(fromProp.title) : 'choose…'}</button> on ${esc(whose)}</div>
<div class="lk-ask-line">Into ${into}</div>
<label class="lk-ask-line"><input type="checkbox" class="lk-tick"${state.remove ? ' checked' : ''}${fromProp ? '' : ' disabled'}> Remove them from ${fromProp ? `<span class="lk-prop">${esc(fromProp.title)}</span>` : 'the first property'}</label>
${state.into && fromProp && !made.refused && changed.length ? `<div class="lk-ask-rows">${changed.slice(0, 4).map(row => `<div class="lk-ask-row"><div class="lk-ask-words">${esc(row.words || 'Untitled')}</div><div><span class="lk-prop">${esc(fromProp.title)}</span> ${row.goes.length ? few(row.goes, 'lk-going') : few(state.nodes.find(node => node.uuid === row.uuid)?.from || [], '')}</div><div><span class="lk-prop">${esc(state.into.title)}</span> ${[few(row.stays, ''), few(row.comes, 'lk-coming')].filter(Boolean).join(', ') || '—'}</div></div>`).join('')}${changed.length > 4 ? `<div class="lk-ask-more">and ${changed.length - 4} more</div>` : ''}</div>` : ''}
${made.refused && (state.into || !fromProp) ? `<div class="lk-ask-note">${esc(made.refused)}</div>` : ''}
${!made.refused && state.into ? G.move.left(made).map(words => `<div class="lk-ask-note">${esc(words)}</div>`).join('') : ''}
<div class="lk-answers"><button type="button" class="lk-accent lk-i-move" data-do="yes"${yes && state.into && !state.busy ? '' : ' disabled'}>${esc(yes || 'Move values')}</button><button type="button" class="lk-btn" data-do="leave">Cancel</button></div>`;
    if (state.naming) box.querySelector('.lk-ask-name')?.focus();
  };
  const again = async () => { await read(); draw(); };
  const pick = (button, which) => {
    const fromProp = schema.props.get(state.from);
    if (which === 'from') {
      G.menu(button, [{ group: 'The values come out of' }, ...props.map(prop => ({ word: prop.title, face: 'prop', on: prop.ident === state.from, take: () => { state.from = prop.ident; if (state.into && !state.into.isNew && schema.props.get(state.into.ident)?.type !== prop.type) state.into = null; again(); } }))]);
    } else {
      const fit = props.filter(prop => prop.ident !== state.from && (!fromProp || prop.type === fromProp.type));
      G.menu(button, [{ group: 'The values go into' }, ...fit.map(prop => ({ word: prop.title, face: 'prop', on: state.into?.ident === prop.ident, take: () => { state.into = { ident: prop.ident, title: prop.title }; again(); } })),
        ...(fit.length ? [{ gap: true }] : []), { word: 'A new property…', take: () => { state.naming = true; draw(); } }]);
    }
  };
  /* The move, written node by node. What each node held before, and what the move sets it to, is kept before its writes (so a
     move cut short, by a refusal or by Logseq closing, can still be put back) and put right where a write was refused. */
  const apply = async () => {
    const fromProp = schema.props.get(state.from), made = state.made;
    if (!fromProp || !state.into || !made || made.refused || state.busy) return;
    state.busy = true; draw();
    const note = box.querySelector('.lk-answers');
    let record = null, fresh = null, failed = null, into = state.into.isNew ? null : schema.props.get(state.into.ident);
    try {
      if (!into) { fresh = await G.write.newProperty(state.into.title, fromProp.type, fromProp.many, fromProp.range || []); G.read.forget(); into = { ident: fresh.ident, title: state.into.title, type: fromProp.type, many: fromProp.many }; }
      const rows = made.rows.filter(row => !row.skip && (row.comes.length || row.goes.length)), node = new Map(state.nodes.map(one => [one.uuid, one]));
      record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, graph: await G.read.graph(), when: Date.now(), type: fromProp.type, remove: state.remove, from: { ident: fromProp.ident, title: fromProp.title, many: fromProp.many }, into: { ident: into.ident, title: into.title, many: into.many, made: !!fresh, uuid: fresh?.uuid || '' }, rows: [] };
      store.add(record);
      for (const [i, row] of rows.entries()) {
        note.textContent = `Writing ${i + 1} of ${rows.length}…`;
        const was = node.get(row.uuid), set = row.comes.length ? [...row.stays, ...row.comes].map(value => value.raw) : null;
        const kept = { uuid: row.uuid, words: String(row.words || '').slice(0, 60), comes: row.comes.map(value => value.raw), goes: row.goes.length > 0, was: { from: was.from.map(value => value.raw), into: was.into.map(value => value.raw) }, wrote: { into: set, from: row.goes.length > 0 } };
        record.rows.push(kept); store.save();
        let done = 0;
        try {
          if (set) await G.write.setValues(row.uuid, into.ident, set, { ref: REF(fromProp.type), many: into.many });
          done = 1;
          if (row.goes.length) await G.write.setValues(row.uuid, fromProp.ident, [], {});
        } catch (error) { if (!done) kept.wrote.into = null; kept.wrote.from = false; throw error; }
      }
    } catch (error) { failed = error; }
    G.read.forget();
    let n = 0;
    if (record) {
      record.rows = record.rows.filter(row => row.wrote.into || row.wrote.from);
      for (const row of record.rows) { if (!row.wrote.into) row.comes = []; if (!row.wrote.from) row.goes = false; n += row.comes.length; }
      // Nothing was written: no line; a property made for the move and left empty goes again.
      if (!record.rows.length) { let stays = false; if (fresh) { try { await G.write.dropProperty(fresh.uuid); } catch (error) { stays = true; } } if (stays) store.save(); else store.drop(record); }
      else store.save();
    }
    if (n) G.tending?.did([['', `${state.remove ? 'Moved' : 'Copied'} ${n} ${n === 1 ? 'value' : 'values'} from `], ['prop', fromProp.title], ['', ' into '], ['prop', into.title]]);   // a line in Ontology's History, for what was written
    if (failed) G.write.refused('The values could not all be moved', failed, record?.rows.length ? 'What was written by then can be put back with Undo on the line of this move.' : '');
    close();
  };
  const onKey = event => {
    if (!box.isConnected) { doc.removeEventListener('keydown', onKey, true); return; }
    if (!box.contains(event.target) || doc.querySelector('.lk-menu')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (state.naming) { state.naming = false; draw(); } else close(); }
    else if (event.key === 'Enter' && event.target.classList.contains('lk-ask-name')) { event.preventDefault(); event.stopPropagation(); const name = event.target.value.trim(); if (name) { const there = props.find(prop => prop.title.toLowerCase() === name.toLowerCase()); state.into = there ? { ident: there.ident, title: there.title } : { isNew: true, title: name }; state.naming = false; again(); } }
  };
  doc.addEventListener('keydown', onKey, true);
  box.onclick = event => {
    const button = event.target.closest('[data-do]');
    if (event.target.classList.contains('lk-tick')) { state.remove = event.target.checked; draw(); return; }
    if (!button || state.busy) return;
    const act = button.dataset.do;
    if (act === 'from' || act === 'into') pick(button, act); else if (act === 'leave') close(); else if (act === 'yes') apply();
  };
  await again();
  box.scrollIntoView({ block: 'nearest' });
  box.querySelector('[data-do="into"]')?.focus({ preventScroll: true });
}

// The box a change of many nodes is shown in before it is made: Move values' own, and the merge of Ontology.
G.changeBox = { CSS: `
.lk-ask { max-width: 420px; margin: 0 0 14px; padding: 12px; border-radius: var(--lk-corner-float); box-shadow: 0 0 0 1px var(--lk-line); display: flex; flex-direction: column; gap: 6px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-ask:empty { display: none; }
.lk-ask-head { font-weight: 600; }
.lk-ask-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.lk-ask .lk-prop { color: var(--lk-text); }
.lk-ask .lk-btn.lk-low { box-shadow: 0 0 0 1px var(--lk-hair); }
.lk-ask-rows { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 2px; padding: 8px 0 0; border-top: 1px solid var(--lk-hair); }
.lk-ask-row { display: flex; flex-direction: column; }
.lk-ask-row .lk-prop { color: var(--lk-quiet); margin-right: .3em; }
.lk-ask-more, .lk-ask-note { color: var(--lk-quiet); font-size: var(--lk-small); }
.lk-answers { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; align-items: center; }` };

G.part({
  key: 'moving', title: 'Move values', about: 'The values of one property put into another, for a tag’s nodes or for every node, with a look at the result first and one Undo.',
  start(base) {
    base.style('moving', G.changeBox.CSS + `
.lk-table-pop { position: fixed; z-index: 9990; width: min(420px, calc(100vw - 16px)); max-height: calc(100vh - 120px); overflow-y: auto; border-radius: 12px; background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); box-shadow: var(--lk-float-shadow), 0 0 0 .5px var(--lk-line); }
.lk-table-pop > .lk-ask { margin: 0; box-shadow: none; }
.lk-ask-name { flex: 1; min-width: 8em; border: 0; border-bottom: 1px solid var(--lk-line); outline: 0; background: none; color: inherit; font: inherit; padding: 2px 0; box-shadow: none; border-radius: 0; }
.lk-moving > .lk-answers + .lk-ask-said { margin-top: 8px; }   /* a second move's line, set apart from the first one's presses */`);
    G.moving = { ask, last };
    /* In Logseq's own tables, as the plugin before the rebuild had it: tick rows on a tag's or a property's page, and Logseq's bar
       for ticked rows has one more word, Move values…. The box hangs under the bar, for the ticked nodes only. */
    base.onStop(G.touch.tableBar('Move values…', ({ ids, bar }) => {
      const doc = bar.ownerDocument, spot = bar.getBoundingClientRect();
      doc.querySelector('.lk-table-pop')?.remove();
      const pop = doc.createElement('div'); pop.className = 'lk-table-pop';
      pop.style.left = `${Math.max(8, Math.min(spot.left, doc.defaultView.innerWidth - 440))}px`; pop.style.top = `${spot.bottom + 6}px`;
      doc.body.appendChild(pop);
      const watchEmpty = new (doc.defaultView.MutationObserver)(() => doc.defaultView.setTimeout(() => { if (pop.isConnected && !pop.querySelector('.lk-ask')) { watchEmpty.disconnect(); pop.remove(); } }, 600));   // the line of what was done takes the box's place a moment later
      ask(pop, { only: ids }).then(() => watchEmpty.observe(pop, { childList: true })).catch(error => { pop.remove(); G.write.refused('Move values could not open', error); });
    }));
    base.onStop(() => { for (const pop of G.host().querySelectorAll('.lk-table-pop')) pop.remove(); });
    base.onStop(() => { delete G.moving; for (const box of G.host().querySelectorAll('.lk-ask.lk-moving')) box.remove(); });   // no Move values: the parts that offer it look whether it is there
  },
});
})();
