/* Proposals, the drawing, the keys and the writing (the rules are core/propose.js; Option-Enter is logseq/steps.js).
   Ported from logseq-db-refinements (parts/shadow.js) and checked against Logseq 2.0.2.

   While a bullet is written, each proposed value is drawn faintly into the record's own property pill, where Logseq shows the
   empty value (italic grey; a guess also has a dotted line). Nothing is written until you leave the bullet. Leaving with
   Enter takes everything shown, the guesses too; leaving any other way (a click elsewhere, an arrow) takes only the sure
   values, and only if the words changed since the bullet was entered: an old bullet you pass through is left as it was.
   Escape hides them until you type again. A click on a proposed value accepts it (a second click takes the
   acceptance back). Its × (the library's Take off, under the pointer, as it would repeat on every value) takes it off, and it
   is not proposed on that bullet again. A faded arrow after the bullet puts back what was filled in, and takes off only what is still as it
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

const ENTER_LEAVES = 500, FILLING_MS = 6000, SAVE_TRIES = 40;
// live: the bullet being written { uuid, text, changed, recordUuid, pieces, drawn, clicked, picked, left }. filling: bullets left a
// moment ago whose values are being written, kept on screen, solid, until Logseq shows its own (no flash of empty). entered:
// the bullet in edit and its words when it was entered. refused: what an Undo took off, by the record it was on.
const S = { live: null, hushed: { uuid: '' }, accepted: { uuid: '', at: 0, keys: new Set() }, filling: new Map(), allowedNow: false, version: 0, timer: 0, stopped: false, undo: null, visiting: { live: null, timer: 0, out: 0 }, entered: { uuid: '', words: '' }, asked: '', refused: new Map() };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { esc } = window.PluginDoor;
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
const pillsOf = row => [...row.querySelectorAll('.positioned-properties.block-below:not(.flow-closing) .bottom-property-pill')].filter(ownRow(row));
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
  let rowEl = [...main.querySelectorAll('.positioned-properties.block-below:not(.flow-closing)')].find(ownRow(row));
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
  'words-day': () => 'A day named in your words', 'words-deadline': () => 'The day your words say it is due', 'words-scheduled': () => 'The day your words say it is set for',
  lesson: p => `put in ${p.prop?.title} because you moved such values there before (the Predictive lessons page)`,
  'words-money': () => 'The sum of money in your words', 'alike-money': p => `The sum of money in your words; earlier bullets like this one put theirs in ${p.prop.title}`, 'words-number': p => `The number beside “${p.prop.title.toLowerCase()}” in your words`,
  model: () => 'Read from your words by Apple’s model, on this Mac', meaning: () => 'Earlier notes that mean the same, matched by Apple’s tools on this Mac',
  names: () => 'A name Apple’s name finder read in your words, with no page yet; taking it makes the page, with this tag', untagged: () => 'A page linked in your words that has no tag yet; taking it gives the page the tag too',
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
  // From Apple's tools (the model, the matcher, the name finder): the asterisk after the value (the stylesheet draws it, and
  // takes it off once the value is taken).
  const model = Flow.apple.fromApple(piece);
  return { cls: `flow-ghost${piece.guess ? ' flow-guess' : ''}${model ? ' flow-model' : ''}`, title: why ? `${why}.\n${what}` : what };
}
// A proposal whose value changes in place (more words typed, Apple's model reading the line): the old words fade out where
// they stood while the new fade in, so the place does not blink empty. The old words are a copy beside the proposal, placed
// over it, and go when they have faded.
const FADE_MS = 160;
// Still: the person asked for less motion (or the page cannot say, or animate).
const still = doc => { const win = doc.defaultView; return !win?.matchMedia || !win.Element.prototype.animate || win.matchMedia('(prefers-reduced-motion: reduce)').matches; };
function crossFade(g) {
  if (!g.isConnected || !g.childNodes.length || still(g.ownerDocument)) return;
  const old = g.cloneNode(true);
  old.className = 'flow-old ' + [...g.classList].filter(c => c !== 'flow-ghost' && c !== 'flow-model').join(' ');
  for (const key of Object.keys(old.dataset)) delete old.dataset[key];
  old.removeAttribute('title');
  Object.assign(old.style, { position: 'absolute', left: g.offsetLeft + 'px', top: g.offsetTop + 'px', pointerEvents: 'none', margin: '0' });
  g.before(old);
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease' }).finished.then(() => old.remove(), () => old.remove());
  g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease' });
}
// What a proposed value shows: its words; a tag in mono with no #; a page that would get a tag says so after its name.
function fillGhost(g, piece) {
  const doc = g.ownerDocument;
  if (piece.kind === 'tag') {   // a tag reads as a class: its name, no #, in Look's shared tag look (lk-tag)
    const title = piece.tag?.title || String(piece.shown).replace(/^#/, '');
    if (g.dataset.flowWords !== title) { crossFade(g); g.dataset.flowWords = title; g.replaceChildren(Object.assign(doc.createElement('span'), { className: 'flow-tag lk-tag', textContent: title })); }
    return;
  }
  const words = piece.kind === 'tag' ? '' : piece.shown, tagTitle = piece.kind === 'tag' ? piece.tag?.title || String(piece.shown).replace(/^#/, '') : piece.tagPage?.tag.title || piece.newPage?.tag.title || '';
  if (g.dataset.flowWords === words && g.dataset.flowTag === tagTitle) return;
  crossFade(g);
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
// The × beside a proposal, while it is being written: the library's Take off (lk-x), shown under the pointer. It takes no room
// (the stylesheet), so nothing moves when it goes: after a value, over the gap that follows it; before a tag, in the place
// Look keeps for a tag's × (the grammar's "in the #'s place").
const xOf = g => g.classList.contains('flow-tag-ghost') ? g.previousElementSibling : g.nextElementSibling;
const ghostOfX = x => x.classList.contains('flow-x-before') ? x.nextElementSibling : x.previousElementSibling;
function drawX(doc, g, piece) {
  let x = xOf(g);
  if (!x?.classList.contains('flow-x')) {
    x = doc.createElement('button');
    x.type = 'button'; x.className = 'flow-x lk-x lk-reveal'; x.textContent = '×';
    x.setAttribute('contenteditable', 'false');
    if (piece.kind === 'tag') { x.classList.add('flow-x-before'); g.before(x); } else g.after(x);
  }
  g.closest('.bottom-property-pill, .ls-block-right')?.classList.add('lk-reveals');
  const what = piece.kind === 'tag' ? `the tag ${piece.tag?.title || ''}` : `${piece.prop.title}: ${piece.shown}`;
  x.dataset.flowKey = guessKey(piece);
  if (x.title !== `Take off ${what}`) { x.title = `Take off ${what}`; x.setAttribute('aria-label', x.title); }
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
    g.dataset.flowIdent = piece.ident;
    right.appendChild(g);
  }
  g.dataset.flowKey = guessKey(piece);   // another tag in its place keeps the place, and fades over (fillGhost)
  fillGhost(g, piece);
  const cls = `${look.cls} flow-tag-ghost${(job.live ? job.live.clicked?.has(guessKey(piece)) : true) ? ' flow-taken' : ' lk-pencil'}`;
  if (g.className !== cls) g.className = cls;
  const title = job.live ? look.title : 'Being filled in';
  if (g.title !== title) g.title = title;
  if (job.live) { (job.live.drawn ||= new Set()).add(guessKey(piece)); drawX(doc, g, piece); }
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
  // Out with what is no longer proposed (another bullet, the bullet left and its values written). A proposal whose value only
  // changed keeps its place, and the new value fades over the old (fillGhost).
  const going = [];
  for (const g of doc.querySelectorAll('.flow-ghost')) {
    if (g.closest('.flow-closing')) continue;
    const row = g.closest('.ls-block[blockid]'), job = jobs.find(j => j.rows.includes(row)), piece = job?.want.get(g.dataset.flowIdent);
    const filled = g.classList.contains('flow-tag-ghost') ? !!piece && piece.kind === 'tag' && tagsShown(row).has(String(piece.tag.title).toLowerCase())
      : !g.closest('.flow-made') ? !g.parentElement?.querySelector('.empty-value') : piece && ownNames(row).has(piece.prop.lower);
    if (piece && !filled && (piece.kind === 'tag') === g.classList.contains('flow-tag-ghost')) continue;
    going.push(g);
  }
  // A row of pills the plugin made, all of whose proposals go, rolls closed as it is (rollClosed).
  for (const el of doc.querySelectorAll('.positioned-properties.flow-made:not(.flow-closing)')) {
    const own = [...el.querySelectorAll('.flow-ghost')];
    if (own.length && own.every(g => going.includes(g))) rollClosed(el);
  }
  for (const g of going) {
    if (g.closest('.flow-closing')) continue;
    g.closest('[data-flow-proposal]')?.removeAttribute('data-flow-proposal');
    g.remove();
  }
  for (const x of doc.querySelectorAll('.flow-x')) { if (x.closest('.flow-closing')) continue; const g = ghostOfX(x); if (!g?.classList.contains('flow-ghost') || g.dataset.flowKey !== x.dataset.flowKey || !live?.pieces.some(p => guessKey(p) === x.dataset.flowKey)) x.remove(); }
  for (const el of doc.querySelectorAll('.flow-made-pill')) if (!el.closest('.flow-closing') && !el.querySelector('.flow-ghost')) el.remove();
  for (const el of doc.querySelectorAll('.positioned-properties.flow-made:not(.flow-closing)')) if (!el.querySelector('.bottom-property-pill')) el.remove();
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
        g.dataset.flowIdent = piece.ident;
        target.appendChild(g);
      }
      g.dataset.flowKey = guessKey(piece);
      fillGhost(g, piece);
      // Taken (clicked, or the bullet left and this value on its way): solid, as it will be.
      const taken = job.live ? job.live.clicked?.has(guessKey(piece)) : true;
      // Several names carry the pencil each (the dotted line under each name, not the commas), one value as a whole. Taken
      // keeps the name lk-pencil, so the property still counts as filled for Look's dot; flow-taken takes the look off it.
      const names = g.querySelectorAll(':scope > .flow-name');
      const cls = look.cls + (names.length ? '' : ' lk-pencil') + (piece.kind === 'node' && !names.length ? ' flow-node' : '') + (taken ? ' flow-taken' : '');
      if (g.className !== cls) g.className = cls;
      const picked = job.live ? pickedIn(job.live, piece) : null;
      for (const n of names) n.classList.toggle('flow-taken', taken || !!picked?.has(Number(n.dataset.flowId)));
      const title = job.live ? look.title : 'Being filled in';
      if (g.title !== title) g.title = title;
      if (!pill.hasAttribute('data-flow-proposal')) pill.setAttribute('data-flow-proposal', '');
      if (job.live) { (job.live.drawn ||= new Set()).add(guessKey(piece)); drawX(doc, g, piece); }
    }
  }
  // A pill marked with nothing of ours left in it (a copy cut short) is given back to Logseq.
  for (const pill of doc.querySelectorAll('[data-flow-proposal]')) if (!pill.querySelector('.flow-ghost')) pill.removeAttribute('data-flow-proposal');
  drawUndo();
}
const hide = () => drawInPlace();
// A row of pills the plugin made, its proposals gone: it rolls closed as it stands, so the bullets under it slide up rather than
// jump. Where Logseq now shows a row of its own (the values were written), it goes at once, so the bullet is never two rows high.
const ROLL_MS = 170;
function rollClosed(el) {
  const row = el.closest('.ls-block[blockid]');
  const logseqRow = row && [...row.querySelectorAll('.positioned-properties.block-below:not(.flow-made)')].some(ownRow(row));
  if (logseqRow || still(el.ownerDocument)) { el.remove(); return; }
  el.classList.add('flow-closing');
  for (const g of el.querySelectorAll('.flow-ghost')) g.classList.replace('flow-ghost', 'flow-gone');
  for (const x of el.querySelectorAll('.flow-x')) x.remove();
  el.style.height = el.offsetHeight + 'px';
  void el.offsetHeight;
  el.style.height = '0px';
  setTimeout(() => el.remove(), ROLL_MS + 40);
}
// Drawn again as soon as Logseq redraws the row, before the screen is painted, so its redraw cannot lose a proposal.
// A pass on the one screen watcher (plugin.js), run at once on every change, before the screen is drawn; what it draws itself is set aside by the watcher.
function onMutations(doc, records) {
  if (!S.live && !S.filling.size && !S.undo && !doc.querySelector('.flow-ghost, .flow-made, [data-flow-proposal]')) return;
  const ours = n => n.nodeType === 1 && n.matches?.('.flow-ghost, .flow-made, .lk-undo, .flow-x, .flow-old');
  if (records.some(r => r.type === 'childList' && ![...r.addedNodes, ...r.removedNodes].every(ours))) drawInPlace(doc);
}

/* ---------- what was said no to, kept ---------- */
// What a × or an Undo took off stays off that bullet for good, across a restart of Logseq: kept in this Mac's storage for the plugin,
// by graph and by the bullet's id, the newest 2000 bullets. Only ids and the kind of value, never words.
const REFUSED_MOST = 2000, refusedKey = graph => `predictive.refused.${graph}`;
function loadRefused(graph) {
  if (!graph || S.refusedGraph === graph) return;
  S.refusedGraph = graph; S.refused = new Map();
  try { for (const [uuid, keys] of JSON.parse(localStorage.getItem(refusedKey(graph)) || '[]')) S.refused.set(uuid, new Set(keys)); } catch (error) { /* none kept */ }
}
function refuse(recordUuid, keys) {
  if (!recordUuid) return;
  const set = S.refused.get(recordUuid) || new Set();
  for (const key of keys) set.add(key);
  S.refused.delete(recordUuid); S.refused.set(recordUuid, set);   // the newest last
  while (S.refused.size > REFUSED_MOST) S.refused.delete(S.refused.keys().next().value);
  if (!S.refusedGraph) return;
  try { localStorage.setItem(refusedKey(S.refusedGraph), JSON.stringify([...S.refused].map(([uuid, set]) => [uuid, [...set]]))); } catch (error) { warnOnce('what was taken off could not be kept', error); }
}

/* ---------- working out what to show ---------- */
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || S.hushed.uuid === uuid) { S.live = null; return hide(); }
  const version = ++S.version, words = box.value;
  // Back in a bullet whose words are as they were when it was entered: nothing is proposed until they change (the owner, 8 November
  // 2026: a suggestion passed over should not come back on a bullet that has not changed). A tag picked with Option-T asks again.
  if (S.entered.uuid === uuid && words === S.entered.words && S.asked !== uuid) { S.live = null; return hide(); }
  const ok = await app.allowed();
  S.allowedNow = ok;
  if (!ok) { S.live = null; return hide(); }
  const ctx0 = await app.context({ wait: false });   // never waited for while typing
  if (!ctx0) return;
  loadRefused(ctx0.graph); Flow.lessonsStore?.load(ctx0.graph);
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
  // Apple's tools (logseq/apple.js: the matcher, the name finder, then the model), for what the rules left open: what is in for
  // these words at once, the rest asked now and drawn as it comes, as long as the bullet and its words are still the same.
  // A tag read comes first, the tag's properties as the next answer comes.
  const asking = Flow.apple, had = asking?.had(ctx, bullet, result);
  S.ctx = ctx;
  show(box, uuid, words, record, rules, (had || []).filter(open));
  if ((had && asking.done(ctx, bullet, result)) || !asking?.wanted(ctx, bullet, result)) return;
  const drawn = more => {
    if (!more.length || version !== S.version || S.stopped || S.hushed.uuid === uuid) return;
    const now = editingBox(host().activeElement);
    if (now && uuidOf(now) === uuid && now.value === words) show(now, uuid, words, record, rules, more.filter(open));
  };
  asking.ask(ctx, bullet, result, drawn).then(drawn, error => warnOnce('Apple’s model could not be asked', error));
}
/* The lessons of this graph (core/lessons.js) applied to what is proposed: a suggestion you keep saying no to is held back, and a
   value you keep moving to another property is proposed there. The record's properties as its tags (a proposed tag's too) give them. */
function byLessons(ctx, record, pieces) {
  const store = Flow.lessonsStore;
  if (!ctx || !store || !store.lessons().size) return pieces;
  const tags = [...new Set([...(record.tags || []), ...pieces.filter(p => p.kind === 'tag').flatMap(p => p.ids)])];
  const fields = Flow.schema.fieldsOfTags(tags, ctx.schema);
  return Flow.lessons.apply(pieces, store.lessons(), { fields, open: f => !(record.values?.get(f.ident) || []).length });
}
// What you did with a suggestion you left untaken, learned once the bullet is saved: another tag, or another value set by hand in
// its property, is a no; the same sum or day set by hand in another property of the same kind is a move.
async function learnLeft(live, block, ctx, record) {
  const store = Flow.lessonsStore, recordUuid = String(record.uuid || '');
  if (!store || !textLib.UUID.test(recordUuid)) return;
  const left = live.pieces.filter(p => p.guess && live.drawn?.has(guessKey(p)) && !wanted(live, p));
  if (!left.length) return;
  const tags = new Set((db.pick(block, 'block/tags') || []).map(db.idOf));
  const holds = (prop, ids, p) => !ids.length ? false : p.kind === 'number' ? Number(ids[0]) === Number(p.ids[0])
    : p.kind === 'day' ? (prop.type === 'datetime' ? Flow.dates.dayNumber(new Date(Number(ids[0]))) : ctx.days?.get(ids[0])) === p.day
    : textLib.sameIds(ids, p.ids);
  const fields = Flow.schema.fieldsOfTags(record.tags || [], ctx.schema);
  for (const p of left) {
    if (p.kind === 'tag') { if (!tags.has(p.tag.id) && [...tags].some(id => ctx.knownTags.has(id))) store.note(p, 'no'); continue; }
    if (!p.prop) continue;
    const own = await db.currentIds(recordUuid, p.prop);
    if (own.length) { if (!holds(p.prop, own, p)) store.note(p, 'no'); continue; }
    if (p.kind !== 'number' && p.kind !== 'day') continue;
    for (const f of fields) {
      if (f.ident === p.ident || !Flow.lessons.sameKind(f, p.prop)) continue;
      if (holds(f, await db.currentIds(recordUuid, f), p)) { store.note(p, 'moved', f.title); break; }
    }
  }
}
// The proposals of the bullet being written: the rules' and the model's (core/model.js, merge).
function show(box, uuid, words, record, rules, more) {
  const pieces = byLessons(S.ctx, record, Flow.model.merge(rules, more)), fromModel = pieces.filter(Flow.apple.fromApple);
  if (!pieces.length) { S.live = null; return hide(); }
  if (S.accepted.uuid !== uuid) S.accepted = { uuid, at: 0, keys: new Set() };
  // What was clicked or picked stays while the words change, for the proposals still there.
  const keep = S.live?.uuid === uuid ? S.live : null;
  S.live = { uuid, text: words, changed: S.entered.uuid !== uuid || words !== S.entered.words, recordUuid: String(record.uuid || ''), pieces, drawn: new Set(), clicked: keep?.clicked, picked: keep?.picked, model: fromModel.length ? { words, pieces: fromModel } : null };
  drawInPlace(box.ownerDocument);
}
// Once typing pauses: longer than the gap between two letters, so a proposal is not worked out after every key.
const PAUSE = 200;
// asked: proposals wanted on this bullet though its words have not changed (a tag just picked with Option-T).
const soon = (box, { asked = false } = {}) => {
  if (asked) S.asked = uuidOf(box);
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
  // Logseq saves the words a moment after the box is left: wait for them, so the rules read what is saved. A large graph or
  // a busy Mac can take a few seconds.
  let block = null, saved = false;
  for (let tries = 0; tries < SAVE_TRIES && !saved; tries++) {
    block = await db.pullBlock(live.uuid);
    if (!block) return;   // the bullet is gone
    saved = sameWords(db.pick(block, 'block/title'), live.text);
    if (!saved) await sleep(100);
  }
  // What was accepted (Enter, a click) and cannot be written is said, never dropped in silence.
  const lost = why => { if (live.taken?.size) { warnOnce('accepted values were not filled in', why); notify(`The values you accepted were not filled in: ${why}.`, 'warning'); } };
  if (!saved) return lost('the words changed, or had not been saved yet');
  // A tag typed in the words must be on the bullet as saved (Enter just before a typed tag moves the tag to the next bullet).
  const savedTags = new Set((db.pick(block, 'block/tags') || []).map(db.idOf));
  if (propose.inWords(live.text, ctx).tags.some(tag => !savedTags.has(tag))) return lost('the tag typed in the words is not on the bullet');
  const { record, pieces: found } = propose.propose(ctx, db.bulletOf(block, db.pick(block, 'block/title'), ctx.schema));
  const recordUuid = String(record.uuid || ''), refused = S.refused.get(recordUuid);
  // The guesses of Apple's tools go with them, for the words they were given (the rules do not ask them again here).
  const again = byLessons(ctx, record, Flow.model.merge(found, live.model?.words === (live.boxText ?? live.text) ? live.model.pieces : []));
  learnLeft(live, block, ctx, record).catch(error => warnOnce('a lesson could not be learned', error));
  // What was shown is what is written: the rules worked out again on the saved bullet, and where they now come out otherwise
  // for a property (another page, names in another order), the value that was on screen. The tag first, which the rest wait for.
  const chosen = new Map();
  for (const p of again) if (wanted(live, p)) chosen.set(p.ident, p);
  for (const p of live.pieces) if (!chosen.has(p.ident) && wanted(live, p)) chosen.set(p.ident, p);
  const pieces = [...chosen.values()].filter(p => !refused?.has(guessKey(p))).sort((x, y) => (y.kind === 'tag') - (x.kind === 'tag')).map(p => narrowed(live, p));
  if (!pieces.length || S.stopped) return;
  if (!textLib.UUID.test(recordUuid)) return lost('the bullet they belong to could not be found');
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
      // A guess fills only what is still empty as it is written (8 November 2026): a value set by hand while the guess was on
      // screen is yours, and stays.
      if ((await db.currentIds(recordUuid, piece.prop)).length) continue;
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) { await db.addTag(uuid, piece.tagPage.tag.uuid); gave.push(uuid); }
      // A new page for a name no page had (core/people.js): made with its tag, then filled in.
      if (piece.newPage) { const made = await db.makePage(piece.newPage.title, piece.newPage.tag.uuid); piece.madePage = made; piece.wrote = [made.id]; await db.setValue(recordUuid, piece.ident, made.id, { entityId: true }); }
      // Logseq's Deadline and Scheduled hold a moment, not a journal page: the day's start, as Logseq's own date picker writes it.
      else if (piece.kind === 'day' && piece.prop.type === 'datetime') { const d = Flow.dates.asDate(piece.day).getTime(); piece.wrote = [d]; await db.setValue(recordUuid, piece.ident, d); }
      else if (piece.kind === 'day') { piece.wrote = [piece.journalId ?? await db.journalPageFor(piece.day)]; await db.setValue(recordUuid, piece.ident, piece.wrote[0]); }
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
        if (piece.madePage) await db.dropPage(piece.madePage);   // the page made for this fill goes again, if nothing was written on it
        if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await db.removeTag(uuid, piece.tagPage.tag.uuid);
      } catch (error) { failed.push(error); }
    }
    if (failed.length) throw failed[0];
  };
  for (const piece of written) Flow.lessonsStore?.note(piece, 'taken');
  return { written, undo };
}

/* ---------- the faded arrow ---------- */
// A faded arrow at the end of the line of the bullet the values were filled in on, saying what it takes off when pointed at. It
// stays until that bullet is edited again or the page is left. A second fill on the same bullet adds to its undo; a fill on
// another takes the arrow's place. An arrow runs its own change only, and what it took off is not proposed there again.
const bulletLine = uuid => { const row = host().querySelector(`.ls-block[blockid="${uuid}"]`); return row && ([...row.querySelectorAll('.block-title-wrap')].find(ownRow(row)) || row); };
// The door's one Undo (PluginDoor.undo) draws the arrow and takes the press; here what Predictive remembers with it: the pieces, so
// what an Undo took off is not proposed on that bullet again. One entry at a time, keyed by the record it was filled in on.
const undoDoor = () => window.PluginDoor.undo;
function rememberUndo(recordUuid, bulletUuid, written, undo) {
  const before = S.undo?.record === recordUuid ? S.undo : null;
  const pieces = [...(before?.pieces || []), ...written];
  const text = written.map(p => `${p.kind === 'tag' ? 'Tag' : p.prop.title}: ${p.kind === 'tag' ? String(p.shown).replace(/^#/, '') : p.shown}`).join(' · ');
  S.undo = { record: recordUuid, bullet: bulletUuid, pieces };
  const mine = S.undo;
  undoDoor().offer({ owner: 'predictive', key: `predictive:${recordUuid}`, at: () => bulletLine(bulletUuid), node: bulletUuid, text,
    run: async () => {
      if (S.undo === mine) S.undo = null;
      refuse(mine.record, mine.pieces.map(guessKey));
      for (const piece of mine.pieces) Flow.lessonsStore?.note(piece, 'no');
      S.filling.delete(mine.record);
      await undo();
    },
    onFail: error => { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); } });
}
function forgetUndo(uuid) { if (S.undo && (S.undo.record === uuid || S.undo.bullet === uuid)) { undoDoor().forget(`predictive:${S.undo.record}`); S.undo = null; } }
function drawUndo() { undoDoor().draw(); }

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
  if (S.live?.uuid !== uuid) { S.entered = { uuid, words: box.value }; if (S.asked !== uuid) S.asked = ''; }   // back from its own properties is not entering it
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
  if (taken.size && S.accepted.words != null) { live.boxText = live.text; live.text = S.accepted.words; }
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
    // Enter splits the bullet at the cursor: the words before it are what this bullet keeps (a "$" Logseq paired after the cursor
    // goes on to the next bullet), so they are what the saved words are waited for.
    S.accepted = { uuid: S.live.uuid, at: Date.now(), keys: shownPieces(S.live), words: box.value.slice(0, box.selectionStart) };
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
  if (event.target?.closest?.('.flow-x')) return onTakeOff(event);
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

// The ×: the proposal goes, and is kept from being proposed on that bullet again, as after an Undo. A tag taken off takes the
// properties that came with it. The press is held back, so the bullet keeps the cursor.
function onTakeOff(event) {
  event.stopImmediatePropagation(); event.preventDefault();
  if (event.type !== 'click') return;
  const live = S.live, key = event.target.closest('.flow-x').dataset.flowKey, piece = live?.pieces.find(p => guessKey(p) === key);
  if (!piece) return;
  refuse(live.recordUuid, [key]);
  Flow.lessonsStore?.note(piece, 'no');
  live.pieces = live.pieces.filter(p => p !== piece && !(piece.kind === 'tag' && p.needsTag));
  live.clicked?.delete(key); live.picked?.delete(key);
  if (live.model) live.model.pieces = live.model.pieces.filter(p => live.pieces.includes(p));
  if (!live.pieces.length) { S.live = null; return hide(); }
  drawInPlace(event.target.ownerDocument);
}

const PILL = ':is(#main-content-container, #right-sidebar) .ls-block .positioned-properties.block-below .bottom-property-pill', AT = '.bottom-property-pill.bottom-property-pill[data-flow-at]';
const css = `
/* A proposed value, in the record's own property where the value goes. Its look (italic, grey, the dotted line, sure and
   guessed alike) is Look's, through the shared name lk-pencil; a tag's (mono, small capitals) through lk-tag. */
.flow-ghost { white-space: nowrap; opacity: 1; transition: opacity .15s ease, color .15s ease; }
@starting-style { .flow-ghost { opacity: 0; } }
/* A proposed tag, at the right end of the bullet's line where Logseq draws its tags. */
.flow-tag-ghost { white-space: nowrap; padding-right: 4px; }   /* the room Logseq's tag keeps after its name, so it stands where that tag will */
/* Taken (clicked, or on its way in): it reads as the value will once written, over the pencil's look, so when Logseq's own value
   takes its place nothing changes: plain words, and a node's name with the link's faint underline (Look's lk-node). */
.flow-ghost.flow-taken, .flow-ghost > .flow-name.flow-taken { color: inherit !important; font-style: normal !important; text-decoration: none !important; }
.flow-ghost.flow-taken.flow-node, .flow-ghost > .flow-name.flow-taken { text-decoration: underline !important; text-decoration-color: var(--lk-link) !important; text-decoration-thickness: var(--lk-link-width) !important; text-underline-offset: 3px !important; }
/* From Apple's model: a small asterisk raised at the end of the value, in the pencil's grey. It takes no room, so nothing moves
   when it goes, and it goes once the value is taken. */
.flow-ghost.flow-model { position: relative; }
.flow-ghost.flow-model::after { content: '*'; position: absolute; left: 100%; top: -.35em; margin-left: 1px; font-size: .8em; font-style: normal; line-height: 1; color: var(--lk-quiet); text-decoration: none; pointer-events: none; }
.flow-ghost.flow-model.flow-taken::after { content: none; }
.bottom-property-pill:hover .flow-ghost.flow-model::after { opacity: 0; }   /* the × stands there under the pointer */
/* A pill row the plugin made rolls open out of the bullet and closed into it (rollClosed), so the bullets under it slide. */
.positioned-properties.flow-made { interpolate-size: allow-keywords; min-height: 0 !important; overflow: clip; overflow-clip-margin: 4px; transition: height ${ROLL_MS}ms ease, opacity ${ROLL_MS}ms ease; }
@starting-style { .positioned-properties.flow-made { height: 0; opacity: 0; } }
.positioned-properties.flow-made.flow-closing { opacity: 0; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .positioned-properties.flow-made { transition: none; } }
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
/* A pill row the plugin made (an untagged bullet): the pills side by side, centred on one line as Logseq lays out its own (items-center);
   on their baselines the first pill stood 5 px above the others (the audit's 36). */
.positioned-properties.flow-made .bottom-properties-row { display: flex; flex-wrap: wrap; align-items: center; column-gap: .5rem; row-gap: .25rem; }
.flow-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
/* A proposal's ×, the library's Take off: under the pointer on its property, or on the line for a proposed tag. */
.flow-x { font-size: .95em; line-height: 1; display: inline-block; width: 0 !important; min-width: 0 !important; padding: 0 !important; margin: 0 !important; overflow: visible; white-space: nowrap; }
.flow-x-before { direction: rtl; }
.flow-x { text-indent: 3px; }   /* a hair from the words, on whichever side it stands */
/* In a value Logseq lays its parts out with a gap: the × gives that gap back, so it takes no room at all. */
/* Logseq clips a value at its end; a value holding a proposal shows past it, for the × and the asterisk that take no room. */
.bottom-property-pill:is([data-flow-proposal], .flow-made-pill) .bottom-property-content { overflow: visible !important; }
.bottom-property-content > .flow-x { margin-left: calc(-1 * var(--spacing, .25rem)) !important; }

/* The × sits past its zero-wide box, to the right, or to the left before a tag: its catch zone goes with it. */
.flow-x::after { inset: -9px -14px -9px -4px; }
.flow-x-before::after { inset: -9px -4px -9px -14px; }
/* The × stands outside its pill's box, so pointing at it would not count as pointing at the pill: the × itself stays
   pointable at rest (as Look's tag × is inside its tag), and its catch zone wakes only once it shows. */
.flow-x.lk-reveal { pointer-events: auto; }
.flow-x.lk-reveal::after { pointer-events: none; }
.lk-reveals:hover .flow-x.lk-reveal::after { pointer-events: auto; }
`;
// Empty properties hidden until something is proposed, only in graphs where the proposals write (elsewhere nothing would ever
// bring them back). Under the bullet being written they stay, so nothing comes and goes; where an empty property shows it is
// faint, which is Look's.
const hideCss = `
html.flow-hide-empty .ls-block .positioned-properties .bottom-property-pill:has(.empty-value):not([data-flow-proposal]):not([data-flow-at]):not(:focus-within):not(.block-main-container:has(textarea) *) { display: none !important; }
/* A row under a bullet whose every property is so hidden goes too: left standing, empty, it opened a gap under the bullet
   (11 November 2026, the owner: "bullets have this open view but empty so just have a gap"). A property shows while its value
   holds something, a proposal, the keyboard, or the bullet is being written. */
html.flow-hide-empty .ls-block .positioned-properties.block-below:not(:has(.bottom-property-content > :not(.empty-value, button, .lk-own), [data-flow-proposal], [data-flow-at], .flow-made-pill, :focus-within)):not(.block-main-container:has(textarea) *) { display: none !important; }
/* A bullet with nothing under it but properties that are all empty (bare): Logseq's ring said something was folded, and its fold
   arrow opened nothing (11 November 2026, the owner: "why do chevrons appear on bullets that upon opening still show nothing?"),
   so it gets Logseq's plain dot and no fold arrow, folded or open. */
html.flow-hide-empty .block-control-wrap[data-has-children="false"][data-flow-bare] .bullet-container.bullet-closed:not(.typed-list) { background-color: transparent !important; }
html.flow-hide-empty .block-control-wrap[data-has-children="false"][data-flow-bare] .block-control .rotating-arrow { visibility: hidden !important; }
`;
let hideVersion = 0;
async function applyHide() {
  const version = ++hideVersion;
  const on = !S.stopped && setting('proposals') && setting('proposalsHideEmpty') && await app.allowed().catch(() => false);
  if (version === hideVersion) host().documentElement.classList.toggle('flow-hide-empty', !!on);
}
/* Which bullets with no bullets under them, folded or showing a row of properties, hold a value in a property Logseq would show under them once opened: a property
   of your own not placed beside the words, or Deadline or Scheduled. The others are bare. Read once per bullet, again after a change. */
const bare = { held: new Map(), asking: false };
const FOLDED_LEAF = ':is(.block-control-wrap.bullet-closed, .block-main-container:has(.positioned-properties.block-below) > .block-control-wrap)[data-has-children="false"]';
async function readBare(uuids) {
  bare.asking = true;
  try {
    const rows = await window.PluginDoor.query(`[:find ?u :where ${window.PluginDoor.uuidsIn('?u', uuids)} [?b :block/uuid ?u] [?b ?a _] [?p :db/ident ?a]
      (or-join [?a] (and [(namespace ?a) ?ns] [(= ?ns "user.property")]) [(contains? #{:logseq.property/deadline :logseq.property/scheduled} ?a)])
      (not [?p :logseq.property/ui-position :block-left]) (not [?p :logseq.property/ui-position :block-right])]`);
    const holding = new Set(rows.map(([u]) => String(u).toLowerCase()));
    for (const u of uuids) bare.held.set(u, holding.has(u));
  } catch (error) { warnOnce('could not read which folded bullets hold values', error); for (const u of uuids) bare.held.set(u, true); }
  finally { bare.asking = false; }
  markBare(host());
}
function markBare(doc) {
  if (S.stopped) return;
  const ask = [], seen = new Set(doc.querySelectorAll(FOLDED_LEAF));
  for (const wrap of seen) {
    const uuid = wrap.closest('.ls-block[blockid]')?.getAttribute('blockid')?.toLowerCase();
    if (!uuid) continue;
    if (!bare.held.has(uuid)) { ask.push(uuid); continue; }
    wrap.toggleAttribute('data-flow-bare', !bare.held.get(uuid));
  }
  for (const wrap of doc.querySelectorAll('[data-flow-bare]')) if (!seen.has(wrap)) wrap.removeAttribute('data-flow-bare');
  if (ask.length && !bare.asking) readBare([...new Set(ask)].slice(0, 200));
}

function start() {
  app.sendStyle('flow-proposals', css + hideCss);
  const win = host().defaultView, doc = host();
  app.listen(win, ['input'], onInput);
  app.listen(win, ['focusin'], onFocusIn);
  app.listen(win, ['focusout'], onFocusOut);
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onGhostPress, true);
  app.watch(onMutations, { early: true });
  S.stopped = false;
  app.watch(markBare);
  app.onStop(logseq.DB.onChanged?.(() => { bare.held.clear(); markBare(host()); }));
  applyHide();
  app.onStop(logseq.onSettingsChanged?.((now, before) => { if (window.PluginDoor.settingChanged(['proposals', 'proposalsSkipGraphs', 'proposalsHideEmpty'], now, before)) applyHide(); }));
  app.onStop(logseq.App.onCurrentGraphChanged?.(() => { S.version++; S.live = null; S.filling.clear(); S.refused.clear(); S.refusedGraph = ''; forgetUndo(S.undo?.record); undoDoor().clear('predictive'); applyHide(); }));
  app.onStop(logseq.App.onRouteChanged?.(() => { S.live = null; hide(); applyHide(); }));
  app.onStop(() => {
    S.stopped = true; clearTimeout(S.timer); S.version++; S.live = null; S.filling.clear();
    undoDoor().clear('predictive');
    for (const el of doc.querySelectorAll('.flow-ghost, .flow-made, .flow-x, .flow-old')) el.remove();
    for (const el of doc.querySelectorAll('[data-flow-proposal], [data-flow-at]')) { el.removeAttribute('data-flow-proposal'); el.removeAttribute('data-flow-at'); }
    doc.documentElement.classList.remove('flow-hide-empty');
    for (const el of doc.querySelectorAll('[data-flow-bare]')) el.removeAttribute('data-flow-bare');
    bare.held.clear();
  });
}
// What the stepping piece (logseq/steps.js) works with.
const api = { S, start, leave, shownPieces, editingBox, uuidOf, ownRow, pillName, pillsOf, guessKey, hide, soon, rememberUndo };
Flow.proposeUi = api;
})();
