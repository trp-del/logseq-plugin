/* Proposals, the drawing, the keys and the writing (the rules are core/propose.js; Option-Enter is logseq/steps.js).
   Ported from logseq-db-refinements (parts/shadow.js) and checked against Logseq 2.0.2.

   While a bullet is written, each proposed value is drawn faintly into the record's own property pill, where Logseq shows the
   empty value (italic grey; a guess also has a dotted line). Nothing is written until you leave the bullet. Leaving with
   Enter takes everything shown, the guesses too; leaving any other way (a click elsewhere, an arrow) takes only the sure
   values, and only if the words changed since the bullet was entered: an old bullet you pass through is left as it was.
   Escape hides them until you type again. A click on a proposed value accepts it (a second click takes the
   acceptance back). A faded arrow after the bullet puts back what was filled in, and takes off only what is still as it
   was filled in, and keeps those values from being proposed on that bullet again.

   Logseq's shape (read 2026-10-29 in 2.0.2): .ls-block[blockid] > .block-main-container > ... > .positioned-properties.block-below >
   .bottom-properties-row > .bottom-property-pill (the name in its first child, the value in .bottom-property-content, an
   .empty-value inside while there is none). A property Logseq shows no pill for gets one made for the value. A proposed tag is
   drawn where Logseq draws a bullet's tags: at the right end of the bullet's own line (.ls-block-right, which is there, empty,
   even on an untagged bullet), as "#Tag". */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, propose, text: textLib } = Flow;
const { setting, host, warnOnce, notify } = app;

const ENTER_LEAVES = 500, FILLING_MS = 6000;
// live: the bullet being written { uuid, text, changed, recordUuid, pieces, drawn, clicked, picked, left }. filling: bullets left a
// moment ago whose values are being written, kept on screen, solid, until Logseq shows its own (no flash of empty). entered:
// the bullet in edit and its words when it was entered. refused: what an Undo took off, by the record it was on.
const S = { live: null, hushed: { uuid: '' }, accepted: { uuid: '', at: 0, keys: new Set() }, filling: new Map(), allowedNow: false, version: 0, timer: 0, stopped: false, undo: null, visiting: { live: null, timer: 0, out: 0 }, entered: { uuid: '', words: '' }, refused: new Map() };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = t => String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const guessKey = p => p.key ?? `${p.kind}:${p.ident}:${p.ids.join(',')}`;
// The words of a saved title and of the box are compared without their links (saved [[uuid]] against typed [[Name]]) and
// without tags (Logseq keeps them apart from the words).
const linkless = t => { const bare = String(t || '').replace(textLib.TAG, ' '); return { n: (bare.match(textLib.LINK) || []).length, words: bare.replace(textLib.LINK, ' ').replace(/\s+/g, ' ').trim().toLowerCase() }; };
const sameWords = (saved, typed) => { const a = linkless(saved), b = linkless(typed); return a.n === b.n && a.words === b.words; };
const shownPieces = live => new Set(live.pieces.filter(p => live.drawn?.has(guessKey(p))).map(guessKey));
// What leaving a bullet writes: what was taken (Enter, a click), and the sure values of a bullet whose words changed.
// unseen: the bullet was left before its proposals were worked out; its sure values are written all the same.
const wanted = (live, p) => (live.unseen || live.drawn?.has(guessKey(p))) && (live.taken?.has(guessKey(p)) || (!p.guess && live.changed));

/* Several names in one proposal ("Dr. Mei Chen, Ruth Okoro"): a click on one name takes that one, and once any is clicked
   only the names clicked are filled in, by Enter too. live.picked: the names clicked, by the proposal's key. */
const pickedIn = (live, piece) => live?.picked?.get(guessKey(piece));
function narrowed(live, piece) {
  const picked = pickedIn(live, piece);
  if (!picked?.size || !piece.names) return piece;
  const names = piece.names.filter(n => picked.has(n.id));
  return { ...piece, key: guessKey(piece), ids: names.map(n => n.id), shown: names.map(n => n.title).join(', '), names: names.length > 1 ? names : undefined };
}

/* ---------- where things are on Logseq's screen ---------- */
const ownRow = row => el => el.closest('.ls-block[blockid]') === row;
const pillName = pill => (pill.firstElementChild?.textContent || '').trim().replace(/:$/, '').toLowerCase();
const pillsOf = row => [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(ownRow(row));
// The names of the properties Logseq itself shows filled on a row: a proposal for one of them is over.
const filledNames = row => new Set(pillsOf(row).filter(p => !p.classList.contains('flow-made') && !(p.querySelector('.bottom-property-content') || p).querySelector('.empty-value')).map(pillName));
// The names Logseq itself shows on a row, filled or empty: a pill the plugin made for one of them gives way to Logseq's.
const ownNames = row => new Set(pillsOf(row).filter(p => !p.classList.contains('flow-made')).map(pillName));
const editingBox = el => app.isBlockBox(el) ? el : null;
const uuidOf = app.uuidOf;

// The names of the tags Logseq itself shows on a row (at the right end of its line).
const tagsShown = row => new Set([...row.querySelectorAll('.block-tags .tag')].filter(ownRow(row)).map(a => a.textContent.trim().toLowerCase()));
// A pill for a property Logseq shows none for, in the record's own pill row; the row is made too when there is none.
function makePill(doc, row, piece) {
  const main = [...row.querySelectorAll('.block-main-container')].find(ownRow(row));
  if (!main) return null;
  let rowEl = [...main.querySelectorAll('.positioned-properties.block-below')].find(ownRow(row));
  if (!rowEl) {
    const inner = [...main.querySelectorAll(':scope > .flex-col > .flex-col')].find(ownRow(row)) || main.querySelector(':scope > .flex-col') || main;
    rowEl = doc.createElement('div');
    rowEl.className = 'positioned-properties block-below flex flex-col gap-1 text-sm flow-made';
    rowEl.innerHTML = '<div class="bottom-properties-row"></div>';
    inner.appendChild(rowEl);
  }
  const pill = doc.createElement('div');
  pill.className = 'bottom-property-pill flow-made flow-made-pill';
  pill.setAttribute('contenteditable', 'false');
  pill.innerHTML = `<span class="flow-made-name lk-prop">${esc(piece.prop.title)}:</span><span class="bottom-property-content"></span>`;
  // In the strip that holds Logseq's own pills, so it lines up with them and Look's dot reaches it.
  (rowEl.querySelector('.bottom-properties-pills-strip') || rowEl.querySelector('.bottom-properties-row') || rowEl).appendChild(pill);
  return pill;
}

/* ---------- drawing ---------- */
// Why (hover): where a value came from, and for a guess from look-alike bullets, the two nearest of them.
const REASONS = {
  alike: p => `Earlier bullets like this one had ${p.shown}`, 'alike-tag': () => 'Earlier lines like this one have this tag',
  words: () => 'Named in your words', parent: () => 'The bullet above has it', day: () => 'The day this is written on', 'guess-day': () => 'The day this is written on; change it if it happens another day',
  'words-day': () => 'A day named in your words', 'words-number': p => `The number beside “${p.prop.title.toLowerCase()}” in your words`,
  model: () => 'Read from your words by Apple’s model, on this Mac', untagged: () => 'A page linked in your words that has no tag yet; taking it gives the page the tag too',
  linked: () => 'A page linked in your words', 'linked-wide': () => 'A page linked in your words', page: () => 'The page this is written on', 'page-wide': () => 'The page this is written on',
};
function reasonOf(piece) {
  const parts = String(piece.how || '').split('+').map(how => REASONS[how]?.(piece)).filter(Boolean);
  const from = piece.from?.length ? `: ${piece.from.map(t => `“${t.length > 70 ? t.slice(0, 69) + '…' : t}”`).join(', ')}` : '';
  return parts.length ? parts.join('; ') + from : '';
}
function ghostLook(piece, live) {
  const what = piece.kind === 'tag' ? 'A guess: Enter gives the bullet this tag and fills in the rest'
    : piece.guess ? 'A guess: Enter fills it in with the rest; Option-Enter stops on it to check; a click accepts it'
    : live?.changed === false ? 'Enter fills it in with the rest; a click accepts it' : 'Filled in when you leave the bullet';
  const why = reasonOf(piece);
  return { cls: `flow-ghost${piece.guess ? ' flow-guess' : ''}`, title: why ? `${why}.\n${what}` : what };
}
// What a proposed value shows: its words; a tag in mono with no #; a page that would get a tag says so after its name.
function fillGhost(g, piece) {
  const doc = g.ownerDocument;
  if (piece.kind === 'tag') {   // a tag reads as a class: its name, no #, in Look's shared tag look (lk-tag)
    const title = piece.tag?.title || String(piece.shown).replace(/^#/, '');
    if (g.dataset.flowWords !== title) { g.dataset.flowWords = title; g.replaceChildren(Object.assign(doc.createElement('span'), { className: 'flow-tag lk-tag', textContent: title })); }
    return;
  }
  const words = piece.kind === 'tag' ? '' : piece.shown, tagTitle = piece.kind === 'tag' ? piece.tag?.title || String(piece.shown).replace(/^#/, '') : piece.tagPage?.tag.title || '';
  if (g.dataset.flowWords === words && g.dataset.flowTag === tagTitle) return;
  g.dataset.flowWords = words; g.dataset.flowTag = tagTitle;
  if (piece.kind === 'node' && piece.names?.length > 1) {   // several names: each its own, to be clicked by itself
    g.replaceChildren(...piece.names.flatMap((n, i) => {
      const name = doc.createElement('span'), sep = doc.createElement('span');
      name.className = 'flow-name lk-pencil'; name.dataset.flowId = String(n.id); name.textContent = n.title;
      name.title = `Click to take ${n.title}; once a name is clicked, only the names clicked are filled in`;
      sep.className = 'flow-sep'; sep.textContent = ', ';
      return i ? [sep, name] : [name];
    }));
    return;
  }
  const tag = tagTitle ? Object.assign(doc.createElement('span'), { className: 'flow-tag lk-tag', textContent: tagTitle }) : null;
  g.replaceChildren(...[words ? doc.createTextNode(words) : null, words && tagTitle ? doc.createTextNode(' ') : null, tag].filter(Boolean));
}
const fillingJobs = () => { const now = Date.now(); for (const [uuid, job] of S.filling) if (job.until < now) S.filling.delete(uuid); return [...S.filling.values()]; };

// The proposed tag, where Logseq draws a bullet's tags: the right end of its own line.
function drawTag(doc, row, piece, job) {
  if (tagsShown(row).has(String(piece.tag.title).toLowerCase())) return;   // Logseq shows it already: the proposal is over
  const right = [...row.querySelectorAll('.ls-block-right')].find(ownRow(row));
  if (!right) return;
  const look = ghostLook(piece);
  let g = right.querySelector(':scope > .flow-tag-ghost');
  if (!g) {
    g = doc.createElement('span');
    g.setAttribute('contenteditable', 'false');
    g.dataset.flowIdent = piece.ident; g.dataset.flowKey = guessKey(piece);
    right.appendChild(g);
  }
  fillGhost(g, piece);
  const cls = `${look.cls} flow-tag-ghost${(job.live ? job.live.clicked?.has(guessKey(piece)) : true) ? ' flow-taken' : ' lk-pencil'}`;
  if (g.className !== cls) g.className = cls;
  const title = job.live ? look.title : 'Being filled in';
  if (g.title !== title) g.title = title;
  if (job.live) (job.live.drawn ||= new Set()).add(guessKey(piece));
}

function drawInPlace(doc = host()) {
  const live = S.live;
  // What to draw: the bullet being written, and the bullets left a moment ago whose values are being filled in, each with
  // its rows on screen and the pieces wanted, by property.
  const jobs = [];
  for (const job of [...(live?.recordUuid ? [{ recordUuid: live.recordUuid, pieces: live.pieces, live }] : []), ...fillingJobs().filter(job => job.recordUuid !== live?.recordUuid)]) {
    const rows = [...doc.querySelectorAll(`.ls-block[blockid="${job.recordUuid}"]`)], want = new Map();
    for (const piece of job.pieces) want.set(piece.ident, piece);
    jobs.push({ ...job, rows, want });
  }
  // Out with what is no longer proposed (another bullet, a value changed, the bullet left and its values written).
  for (const g of doc.querySelectorAll('.flow-ghost')) {
    const row = g.closest('.ls-block[blockid]'), job = jobs.find(j => j.rows.includes(row)), piece = job?.want.get(g.dataset.flowIdent);
    const filled = g.classList.contains('flow-tag-ghost') ? !!piece && piece.kind === 'tag' && tagsShown(row).has(String(piece.tag.title).toLowerCase())
      : !g.closest('.flow-made') ? !g.parentElement?.querySelector('.empty-value') : piece && ownNames(row).has(piece.prop.lower);
    if (piece && !filled && g.dataset.flowKey === guessKey(piece)) continue;
    g.closest('[data-flow-proposal]')?.removeAttribute('data-flow-proposal');
    g.remove();
  }
  for (const el of doc.querySelectorAll('.flow-made-pill')) if (!el.querySelector('.flow-ghost')) el.remove();
  for (const el of doc.querySelectorAll('.positioned-properties.flow-made')) if (!el.querySelector('.bottom-property-pill')) el.remove();
  for (const job of jobs) for (const row of job.rows) {
    const pills = pillsOf(row), filled = filledNames(row);
    for (const piece of job.want.values()) {
      if (piece.kind === 'tag') { drawTag(doc, row, piece, job); continue; }
      if (filled.has(piece.prop.lower)) continue;   // filled meanwhile in Logseq's own way: the proposal for it goes
      // Logseq's own pill first, then one the plugin made earlier, else one made now.
      const pill = pills.find(p => pillName(p) === piece.prop.lower && !p.classList.contains('flow-made')) || pills.find(p => pillName(p) === piece.prop.lower) || makePill(doc, row, piece);
      const target = pill && (pill.querySelector('.bottom-property-content') || pill);
      if (!target) continue;
      const look = ghostLook(piece, job.live);
      let g = [...target.querySelectorAll(':scope > .flow-ghost')].find(el => el.dataset.flowIdent === piece.ident);
      if (!g) {
        g = doc.createElement('span');
        g.setAttribute('contenteditable', 'false');
        g.dataset.flowIdent = piece.ident; g.dataset.flowKey = guessKey(piece);
        target.appendChild(g);
      }
      fillGhost(g, piece);
      // Taken (clicked, or the bullet left and this value on its way): solid, as it will be.
      const taken = job.live ? job.live.clicked?.has(guessKey(piece)) : true;
      // Several names carry the pencil each (the dotted line under each name, not the commas), one value as a whole. Taken
      // keeps the name lk-pencil, so the property still counts as filled for Look's dot; flow-taken takes the look off it.
      const names = g.querySelectorAll(':scope > .flow-name');
      const cls = look.cls + (names.length ? '' : ' lk-pencil') + (taken ? ' flow-taken' : '');
      if (g.className !== cls) g.className = cls;
      const picked = job.live ? pickedIn(job.live, piece) : null;
      for (const n of names) n.classList.toggle('flow-taken', taken || !!picked?.has(Number(n.dataset.flowId)));
      const title = job.live ? look.title : 'Being filled in';
      if (g.title !== title) g.title = title;
      if (!pill.hasAttribute('data-flow-proposal')) pill.setAttribute('data-flow-proposal', '');
      if (job.live) (job.live.drawn ||= new Set()).add(guessKey(piece));
    }
  }
  // A pill marked with nothing of ours left in it (a copy cut short) is given back to Logseq.
  for (const pill of doc.querySelectorAll('[data-flow-proposal]')) if (!pill.querySelector('.flow-ghost')) pill.removeAttribute('data-flow-proposal');
  drawUndo(doc);
}
const hide = () => drawInPlace();
// Drawn again as soon as Logseq redraws the row, before the screen is painted, so its redraw cannot lose a proposal.
function onMutations(records) {
  const doc = host();
  if (!S.live && !S.filling.size && !S.undo && !doc.querySelector('.flow-ghost, .flow-made, [data-flow-proposal]')) return;
  const ours = n => n.nodeType === 1 && n.matches?.('.flow-ghost, .flow-made, .flow-undo');
  if (records.some(r => r.type === 'childList' && ![...r.addedNodes, ...r.removedNodes].every(ours))) { drawInPlace(doc); watcher?.takeRecords(); }
}
let watcher = null;

/* ---------- working out what to show ---------- */
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || S.hushed.uuid === uuid) { S.live = null; return hide(); }
  const version = ++S.version, words = box.value;
  const ok = await app.allowed();
  S.allowedNow = ok;
  if (!ok) { S.live = null; return hide(); }
  const ctx0 = await app.context({ wait: false });   // never waited for while typing
  if (!ctx0) return;
  const ctx = await app.freshLinks(ctx0, words);
  const block = await db.pullBlock(uuid);
  // Still the newest check, not cleared by Escape meanwhile, and the bullet still the one in edit.
  if (version !== S.version || S.stopped || S.hushed.uuid === uuid) return;
  const now = editingBox(host().activeElement);
  if (!now || uuidOf(now) !== uuid) return;
  if (!block) { S.live = null; return hide(); }
  const bullet = db.bulletOf(block, words, ctx.schema), result = propose.propose(ctx, bullet), { record } = result;
  const refused = S.refused.get(String(record.uuid || '')), open = p => !refused?.has(guessKey(p));
  const rules = result.pieces.filter(open).filter((p, i, kept) => !p.needsTag || kept.some(q => q.kind === 'tag'));
  // Apple's model (logseq/model.js), for what the rules left open: its answer for these words if it is in, else asked now and
  // drawn when it comes, as long as the bullet and its words are still the same.
  const asking = Flow.modelAsk, had = asking?.had(ctx, bullet, result);
  show(box, uuid, words, record, rules, (had || []).filter(open));
  if (had || !asking?.wanted(ctx, bullet, result)) return;
  asking.ask(ctx, bullet, result).then(more => {
    if (!more.length || version !== S.version || S.stopped || S.hushed.uuid === uuid) return;
    const now = editingBox(host().activeElement);
    if (now && uuidOf(now) === uuid && now.value === words) show(now, uuid, words, record, rules, more.filter(open));
  }, error => warnOnce('Apple’s model could not be asked', error));
}
// The proposals of the bullet being written: the rules' and the model's (core/model.js, merge).
function show(box, uuid, words, record, rules, more) {
  const pieces = Flow.model.merge(rules, more), fromModel = pieces.filter(p => p.how === 'model');
  if (!pieces.length) { S.live = null; return hide(); }
  if (S.accepted.uuid !== uuid) S.accepted = { uuid, at: 0, keys: new Set() };
  // What was clicked or picked stays while the words change, for the proposals still there.
  const keep = S.live?.uuid === uuid ? S.live : null;
  S.live = { uuid, text: words, changed: S.entered.uuid !== uuid || words !== S.entered.words, recordUuid: String(record.uuid || ''), pieces, drawn: new Set(), clicked: keep?.clicked, picked: keep?.picked, model: fromModel.length ? { words, pieces: fromModel } : null };
  drawInPlace(box.ownerDocument);
}
// Once typing pauses: longer than the gap between two letters, so a proposal is not worked out after every key.
const PAUSE = 200;
const soon = box => {
  clearTimeout(S.timer);
  const mine = S.dueId = (S.dueId || 0) + 1;
  S.due = uuidOf(box);   // this bullet's proposals are still to come
  S.timer = setTimeout(() => compute(box).catch(error => warnOnce('the proposals could not be worked out', error)).finally(() => { if (mine === S.dueId) S.due = ''; }), PAUSE);
};

/* ---------- leaving the bullet ---------- */
// The one way: the shadow is taken off the screen, and what was shown is filled in, unless Escape had cleared it. taken: the
// guesses to fill with the sure values (the ones Enter took; none for a click away).
function leave(live, taken = new Set()) {
  if (!live || live.left) return;
  live.left = true;
  live.taken = new Set([...taken, ...live.clicked || [], ...live.picked?.keys() || []]);   // the ones clicked are accepted too
  live.dismissed = S.hushed.uuid === live.uuid;
  S.version++;
  if (S.accepted.uuid === live.uuid) S.accepted = { uuid: '', at: 0, keys: new Set() };
  if (!live.dismissed && !S.stopped && live.recordUuid) {
    const pieces = live.pieces.filter(p => wanted(live, p)).map(p => narrowed(live, p));
    if (pieces.length) S.filling.set(live.recordUuid, { recordUuid: live.recordUuid, pieces, until: Date.now() + FILLING_MS });
  }
  if (S.live === live) { S.live = null; hide(); }
  if (live.dismissed || S.stopped) return;
  // What was not written goes at once; what was stays until Logseq shows it.
  takeShadow(live).then(written => {
    const keys = new Set((written || []).map(guessKey)), job = S.filling.get(live.recordUuid);
    if (job) { job.pieces = job.pieces.filter(p => keys.has(guessKey(p))); if (!job.pieces.length) S.filling.delete(live.recordUuid); }
  }, error => { S.filling.delete(live.recordUuid); warnOnce('the proposed values could not be taken', error); notify('The proposed values could not be filled in', 'warning'); })
    .finally(() => drawInPlace());
}
async function takeShadow(live) {
  if (S.stopped || live.dismissed || !await app.allowed()) return;
  const ctx = await app.freshLinks(await app.context(), live.text);
  // Logseq saves the words a moment after the box is left: wait for them, so the rules read what is saved.
  let block = null, saved = false;
  for (let tries = 0; tries < 12 && !saved; tries++) {
    block = await db.pullBlock(live.uuid);
    if (!block) return;   // the bullet is gone
    saved = sameWords(db.pick(block, 'block/title'), live.text);
    if (!saved) await sleep(100);
  }
  if (!saved) return;   // the words changed after the shadow was drawn, or never got saved: nothing is written
  // A tag typed in the words must be on the bullet as saved (Enter just before a typed tag moves the tag to the next bullet).
  const savedTags = new Set((db.pick(block, 'block/tags') || []).map(db.idOf));
  if (propose.inWords(live.text, ctx).tags.some(tag => !savedTags.has(tag))) return;
  const { record, pieces: found } = propose.propose(ctx, db.bulletOf(block, db.pick(block, 'block/title'), ctx.schema));
  const recordUuid = String(record.uuid || ''), refused = S.refused.get(recordUuid);
  // The model's guesses go with them, for the words they were given (the rules do not ask the model again here).
  const pieces = Flow.model.merge(found, live.model?.words === live.text ? live.model.pieces : []).filter(p => wanted(live, p) && !refused?.has(guessKey(p))).map(p => narrowed(live, p));
  if (!pieces.length || !textLib.UUID.test(recordUuid) || S.stopped) return;
  const { written, undo } = await writePieces(recordUuid, pieces);
  if (!written.length) return [];
  rememberUndo(recordUuid, live.uuid, written, undo);
  return written;
}

/* The writes. A value that rests on a proposed tag is written only once the bullet has the tag. */
async function writePieces(recordUuid, pieces) {
  const written = [];
  for (const piece of pieces) {
    if (piece.needsTag && !written.some(w => w.kind === 'tag')) continue;
    const gave = [];
    try {
      if (piece.kind === 'tag') { await db.addTag(recordUuid, piece.tag.uuid); written.push(piece); continue; }
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) { await db.addTag(uuid, piece.tagPage.tag.uuid); gave.push(uuid); }
      if (piece.kind === 'day') { piece.wrote = [piece.journalId ?? await db.journalPageFor(piece.day)]; await db.setValue(recordUuid, piece.ident, piece.wrote[0]); }
      else if (piece.kind === 'number') await db.setValue(recordUuid, piece.ident, piece.ids[0]);
      else if (piece.prop.many) await db.setValue(recordUuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await db.setValue(recordUuid, piece.ident, piece.ids[0], { entityId: true });
      piece.wrote ||= piece.ids;
      written.push(piece);
    } catch (error) {
      for (const uuid of gave) await db.removeTag(uuid, piece.tagPage.tag.uuid).catch(() => {});   // the tag a page was given for this fill goes again
      warnOnce(`${piece.prop.title} could not be filled in`, error); notify(`${piece.prop.title} could not be filled in`, 'warning');
    }
  }
  // Undo takes off only what is still as it was filled in: a value chosen by hand since is yours, and stays. Every step is
  // tried even when one fails, and a failure is reported at the end.
  const undo = async () => {
    const failed = [];
    for (const piece of [...written].reverse()) {
      try {
        if (piece.kind === 'tag') { await db.removeTag(recordUuid, piece.tag.uuid); continue; }
        const now = await db.currentIds(recordUuid, piece.prop);
        const same = piece.kind === 'number' ? now.length === 1 && now[0] === Number(piece.ids[0]) : textLib.sameIds(now, piece.wrote);
        if (same) await db.unsetValue(recordUuid, piece.ident);
        if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await db.removeTag(uuid, piece.tagPage.tag.uuid);
      } catch (error) { failed.push(error); }
    }
    if (failed.length) throw failed[0];
  };
  return { written, undo };
}

/* ---------- the faded arrow ---------- */
// A faded arrow at the end of the line of the bullet the values were filled in on, saying what it takes off when pointed at. It
// stays until that bullet is edited again or the page is left. A second fill on the same bullet adds to its undo; a fill on
// another takes the arrow's place. An arrow runs its own change only, and what it took off is not proposed there again.
const bulletLine = uuid => { const row = host().querySelector(`.ls-block[blockid="${uuid}"]`); return row && ([...row.querySelectorAll('.block-title-wrap')].find(ownRow(row)) || row); };
function rememberUndo(recordUuid, bulletUuid, written, undo) {
  const before = S.undo?.record === recordUuid ? S.undo : null;
  if (!before) S.undo?.button?.remove();
  const text = [...(before?.pieces || []), ...written].map(p => `${p.kind === 'tag' ? 'Tag' : p.prop.title}: ${p.kind === 'tag' ? String(p.shown).replace(/^#/, '') : p.shown}`).join(' · ');
  const run = before ? async () => { await undo(); await before.run(); } : undo;
  S.undo = { record: recordUuid, bullet: bulletUuid, pieces: [...(before?.pieces || []), ...written], text, run, button: before?.button || null };
  drawUndo(host());
}
function forgetUndo(uuid) { if (S.undo && (S.undo.record === uuid || S.undo.bullet === uuid)) { S.undo.button?.remove(); S.undo = null; } }
function drawUndo(doc) {
  const u = S.undo;
  if (!u) return;
  const line = bulletLine(u.bullet);
  if (!line) { u.button?.remove(); u.button = null; return; }   // not on screen (another page): it comes back with the bullet
  if (!u.button?.isConnected) {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'flow-undo lk-undo'; button.innerHTML = window.PluginDoor.UNDO;
    button.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    button.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      const mine = button.undo;
      if (S.undo === mine) S.undo = null;
      button.remove();
      const refused = S.refused.get(mine.record) || new Set();
      for (const piece of mine.pieces) refused.add(guessKey(piece));
      S.refused.set(mine.record, refused);
      S.filling.delete(mine.record);
      try { await mine.run(); } catch (error) { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); }
    });
    u.button = button;
  }
  u.button.undo = u;
  u.button.title = `Undo: ${u.text}`; u.button.setAttribute('aria-label', `Undo what was filled in: ${u.text}`);
  if (u.button.parentElement !== line) line.append(u.button);
}

/* ---------- events ---------- */
function onInput(event) {
  const box = editingBox(event.target);
  if (!box) return;
  if (S.hushed.uuid === uuidOf(box)) S.hushed.uuid = '';   // typing again ends Escape's hiding
  soon(box);
}
function onFocusIn(event) {
  const box = editingBox(event.target);
  if (!box) return;
  const uuid = uuidOf(box);
  forgetUndo(uuid);   // editing the bullet again ends the undo of what was filled in on it
  if (S.live?.uuid !== uuid) S.entered = { uuid, words: box.value };   // back from its own properties is not entering it
  soon(box);
}
function onFocusOut(event) {
  const box = editingBox(event.target);
  if (!box) return;
  const uuid = uuidOf(box), picking = Flow.steps?.picking;
  // Leaving a bullet Escape cleared: nothing is taken, and the clearing ends once the bullet is really left.
  if (S.hushed.uuid === uuid) { S.version++; setTimeout(() => { const now = editingBox(host().activeElement); if (!(now && uuidOf(now) === uuid) && picking?.uuid !== uuid && picking?.returning !== uuid) S.hushed.uuid = ''; }, 120); return; }
  // Into a property's list with Option-Enter, or coming back from it: the proposals wait for the words.
  if (picking && (picking.uuid === uuid || picking.returning === uuid)) return;
  const written = S.entered.uuid !== uuid || box.value !== S.entered.words, unseen = S.due === uuid && written;
  if (!S.live || S.live.uuid !== uuid) {
    if (S.accepted.uuid === uuid) S.accepted = { uuid: '', at: 0, keys: new Set() };
    if (!unseen) return;
    S.live = { uuid, text: box.value, changed: true, recordUuid: '', pieces: [], drawn: new Set() };
  }
  // Left within the pause: what is shown stands for the words as they end, which the saved words will be compared with.
  S.live.text = box.value; S.live.changed ||= written; S.live.unseen = unseen;
  // Enter's taking counts only when the bullet is left right after it.
  const live = S.live, taken = Date.now() - (S.accepted.at || 0) < ENTER_LEAVES && S.accepted.uuid === uuid ? new Set(S.accepted.keys) : new Set();
  S.version++;
  setTimeout(() => {
    const active = host().activeElement, now = editingBox(active);
    if (now && uuidOf(now) === live.uuid) return;
    if (live.left) return;
    // Into the bullet's own properties (Logseq's Down from the words, then Left/Right, Enter): not leaving it.
    if (inOwnProperties(active, live.recordUuid || live.uuid)) return visitProperties(live);
    leave(live, taken);
  }, 120);
}
// Moving about the bullet's own properties with Logseq's keys: the proposals stay shown while you are there, and are dealt
// with when the bullet is really left.
function inOwnProperties(el, rowUuid) {
  if (!el?.closest || !rowUuid) return false;
  if (el.closest('.cp__select')) return true;   // a list Logseq opened from one of them
  const place = el.closest('.bottom-property-pill, .property-pair, .bottom-properties-row, .positioned-properties');
  return !!place && [...el.ownerDocument.querySelectorAll(`.ls-block[blockid="${rowUuid}"]`)].some(row => ownRow(row)(place));
}
function visitProperties(live) {
  const v = S.visiting;
  if (v.live && v.live !== live) leave(v.live);   // a visit still going for another bullet ends as leaving it
  clearInterval(v.timer);
  Object.assign(v, { live, out: 0 });
  v.timer = setInterval(() => {
    const active = host().activeElement, box = editingBox(active), picking = Flow.steps?.picking;
    if (live.left) return stopVisiting();
    if (box && uuidOf(box) === live.uuid) return stopVisiting();   // back in the words: they take it from here
    if (inOwnProperties(active, live.recordUuid) || picking?.rowUuid === live.recordUuid) { v.out = 0; return; }
    if (++v.out < 2) return;   // a moment on nothing, as a list closes, is not leaving
    stopVisiting();
    leave(live);
  }, 150);
}
function stopVisiting() { const v = S.visiting; clearInterval(v.timer); Object.assign(v, { live: null, timer: 0, out: 0 }); }

function onKey(event) {
  if (event.isComposing || !S.live) return;
  const box = editingBox(event.target);
  if (!box || uuidOf(box) !== S.live.uuid) return;
  // Cmd-Option-Enter: everything shown is accepted, as with Enter, and the bullet is simply left, with no new bullet made.
  if (event.key === 'Enter' && app.keyMatches(event, setting('proposalsAcceptKeys'))) {
    if (app.editorPopupOpen()) return;
    S.accepted = { uuid: S.live.uuid, at: Date.now(), keys: shownPieces(S.live) };
    event.preventDefault(); event.stopImmediatePropagation();
    Promise.resolve(logseq.Editor.exitEditingMode()).catch(error => warnOnce('the bullet could not be left', error));
    return;
  }
  if (event.key !== 'Escape' && event.key !== 'Enter') return;
  if (app.editorPopupOpen()) return;
  if (event.key === 'Enter') {
    // Enter (plain, with no list of Logseq's open) takes the guesses too: the bullet is then left as usual. Nothing of Enter
    // is held back: Logseq still makes the next bullet.
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    S.accepted = { uuid: S.live.uuid, at: Date.now(), keys: shownPieces(S.live) };
    return;
  }
  // Escape hides the proposals until something is typed in the bullet again; the caret stays (a second Escape is Logseq's).
  event.preventDefault(); event.stopImmediatePropagation();
  S.hushed.uuid = S.live.uuid; S.version++;
  S.live = null; hide();
}
// A click on a proposed value accepts it: it turns solid and is filled in, guess or not, when the bullet is left; a second
// click takes the acceptance back. The press itself is held back, so Logseq's value editor does not open under the value.
function onGhostPress(event) {
  const el = event.target?.closest?.('.flow-ghost');
  if (!el) return;
  event.stopImmediatePropagation();
  if (event.type !== 'pointerdown') event.preventDefault();
  if (event.type !== 'click') return;
  const live = S.live, key = el.dataset.flowKey, piece = live?.pieces.find(p => guessKey(p) === key);
  if (!piece) return;
  const name = event.target.closest('.flow-name');
  if (name && piece.names) {   // one name of several: that one in or out
    const id = Number(name.dataset.flowId), picked = pickedIn(live, piece) || new Set();
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    live.picked ||= new Map();
    if (picked.size) live.picked.set(key, picked); else live.picked.delete(key);
    live.clicked?.delete(key);
  } else {
    live.clicked ||= new Set();
    if (live.clicked.has(key)) live.clicked.delete(key); else live.clicked.add(key);
    live.picked?.delete(key);
  }
  drawInPlace(el.ownerDocument);
}

const PILL = ':is(#main-content-container, #right-sidebar) .ls-block .positioned-properties.block-below .bottom-property-pill', AT = '.bottom-property-pill.bottom-property-pill[data-flow-at]';
const css = `
/* A proposed value, in the record's own property where the value goes. Its look (italic, grey, the dotted line, sure and
   guessed alike) is Look's, through the shared name lk-pencil; a tag's (mono, small capitals) through lk-tag. */
.flow-ghost { white-space: nowrap; opacity: 1; transition: opacity .15s ease, color .15s ease; }
@starting-style { .flow-ghost { opacity: 0; } }
/* A proposed tag, at the right end of the bullet's line where Logseq draws its tags. */
.flow-tag-ghost { margin-left: .25em; white-space: nowrap; }
/* A proposal clicked: solid, filled in when the bullet is left. */
/* Taken (clicked, or on its way in): it reads as plain words, over the pencil's look. */
.flow-ghost.flow-taken, .flow-ghost > .flow-name.flow-taken { color: inherit !important; font-style: normal !important; text-decoration: none !important; }
.flow-ghost { cursor: pointer; }
.ls-block .positioned-properties.block-below .bottom-property-pill[data-flow-proposal] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-flow-proposal] .empty-value { display: none !important; }
/* A property Option-Enter has opened keeps its pencil: Logseq's own empty value is back, unseen and in its place, for its list
   to sit under. A box of Logseq's opening in the pill (a number) holds the guess itself, so there the pencil steps aside. */
.bottom-property-pill[data-flow-proposal][data-flow-at] .empty-value { display: revert !important; }
.bottom-property-pill[data-flow-proposal][data-flow-at]:not(:has(input, textarea)) .empty-value { position: absolute; opacity: 0; pointer-events: none; }
.bottom-property-pill[data-flow-at]:has(input, textarea) .flow-ghost { display: none; }
/* Its ring, the one Look gives a property holding the keyboard: here the keyboard is in the list, outside the pill. */
${PILL}${AT}::after { inset: -2px 0 !important; border-radius: 6px !important; box-shadow: inset 0 0 0 1px var(--lk-line) !important; }
${PILL}:is(:not(:has(.empty-value)), :has(.lk-pencil)) ~ ${AT}::after { left: 16px !important; }
/* A pill row the plugin made (an untagged bullet): the pills side by side, as Logseq lays out its own. */
.positioned-properties.flow-made .bottom-properties-row { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: .5rem; row-gap: .25rem; }
.flow-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
/* The undo arrow at the end of the bullet's line; its fade is Look's, through lk-undo. */
.flow-undo { border: 0; background: none; padding: 0 4px; margin-left: .25em; font: inherit; line-height: 1; cursor: pointer; color: inherit; vertical-align: -2px; }
.flow-undo .ti { font-size: 14px; }
`;
// Empty properties hidden until something is proposed, only in graphs where the proposals write (elsewhere nothing would ever
// bring them back). Under the bullet being written they stay, so nothing comes and goes; where an empty property shows it is
// faint, which is Look's.
const hideCss = `
html.flow-hide-empty .ls-block .positioned-properties .bottom-property-pill:has(.empty-value):not([data-flow-proposal]):not([data-flow-at]):not(:focus-within):not(.block-main-container:has(textarea) *) { display: none !important; }
`;
let hideVersion = 0;
async function applyHide() {
  const version = ++hideVersion;
  const on = !S.stopped && setting('proposals') && setting('proposalsHideEmpty') && await app.allowed().catch(() => false);
  if (version === hideVersion) host().documentElement.classList.toggle('flow-hide-empty', !!on);
}

function start() {
  app.sendStyle('flow-proposals', css + hideCss);
  const win = host().defaultView, doc = host();
  app.listen(win, ['input'], onInput);
  app.listen(win, ['focusin'], onFocusIn);
  app.listen(win, ['focusout'], onFocusOut);
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onGhostPress, true);
  watcher = new win.MutationObserver(onMutations);
  watcher.observe(doc.body, { subtree: true, childList: true });
  S.stopped = false;
  applyHide();
  logseq.onSettingsChanged?.((now, before) => { if (window.PluginDoor.settingChanged(['proposals', 'proposalsSkipGraphs', 'proposalsHideEmpty'], now, before)) applyHide(); });
  logseq.App.onCurrentGraphChanged?.(() => { S.version++; S.live = null; S.filling.clear(); S.refused.clear(); forgetUndo(S.undo?.record); applyHide(); });
  logseq.App.onRouteChanged?.(() => { S.live = null; hide(); applyHide(); });
  app.onStop(() => {
    S.stopped = true; clearTimeout(S.timer); S.version++; watcher?.disconnect(); watcher = null; S.live = null; S.filling.clear();
    for (const el of doc.querySelectorAll('.flow-ghost, .flow-made, .flow-undo')) el.remove();
    for (const el of doc.querySelectorAll('[data-flow-proposal], [data-flow-at]')) { el.removeAttribute('data-flow-proposal'); el.removeAttribute('data-flow-at'); }
    doc.documentElement.classList.remove('flow-hide-empty');
  });
}
// What the stepping piece (logseq/steps.js) works with.
const api = { S, start, leave, shownPieces, editingBox, uuidOf, ownRow, pillName, pillsOf, guessKey, hide, soon, rememberUndo };
Flow.proposeUi = api;
})();
