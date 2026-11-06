/* The window: find, then walk. One real dialog in Logseq's document. On top the find line, a row of pieces: each pick as
   the thing it is (a tag in mono, a node with its mark, a month in grey) and, after the last, the letters being typed.
   Under it the choices the graph holds for what is left (the kinds; inside a kind, its properties with their values and
   the months), then the rows: the grammar's row (day, chevron, bullet, name, tag), the chevron opening a node in place
   with its properties and what points at it. Every key has one job (docs/ALTERNATIVES.html, "All of it from the
   keyboard"). Nothing here reads the graph but through Find.db; the look of a row, a node, a tag and a day is Look's.
   Opened by its own command (Find by sentence, Cmd Option K), the same window reads a sentence instead (the owner, 5 November
   2026: "only as something that is triggered or addon to find"): you type what you are looking for as you would say it
   ("Consultation with Dr. Mei Chen around May 2026"), and above each stretch it understood the window pencils what it
   read ("kind", the property's name, "when"); the words it did not read narrow the rows by their letters; Tab completes a
   lit choice in the sentence. Under it the year line, the nodes found as dots on it, the time asked for as a band; after
   the rows, under "Near", what sits just outside that time. The sentence is read by Find.sentence. */
(function () {
const Find = window.Find;
const { host, el, esc, style, kindIconHtml, dragBand, openPage, notify } = Find.kit;
const db = Find.db;

const FRAME = 236, SAY = 72, ROW = 32;   // the find line, the foot, three lines of choices and "show all"; what the sentence adds (room for the notes, the year line); a row
const CSS = `
.fd { --fd-quiet: var(--lk-quiet); --fd-faint: var(--lk-faint); --fd-hair: var(--lk-hair); --fd-line: var(--lk-line); --fd-wash: var(--lk-wash);
  --fd-ring: color-mix(in srgb, currentColor 11%, transparent); --fd-mono: var(--lk-mono);
  position: fixed !important; left: 50% !important; right: auto !important; transform: translateX(-50%); margin: 0 !important; width: min(900px, 92vw); max-height: 78vh;
  box-sizing: border-box; padding: 0; display: flex; flex-direction: column; }   /* the window's look is the library's lk-window */
.fd:not([open]) { display: none; }
.fd.fd-high { top: max(10vh, 60px) !important; bottom: auto !important; }
.fd.fd-centred { top: 50% !important; bottom: auto !important; transform: translate(-50%, -50%); }
.fd * { box-sizing: border-box; }
/* The find line: the pieces, then the letters. */
.fd-find { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; padding: 14px 16px; border-bottom: 1px solid var(--fd-hair); font-size: 16px; cursor: text; }
.fd-piece { display: inline-flex; align-items: baseline; gap: 5px; position: relative; }
/* A pick's × is the library's lk-reveal and keeps its place, so nothing moves when it shows. */
.fd-piece .lk-tag { font-size: 14px !important; }
.fd-piece .fd-month { color: var(--fd-quiet); }
.fd-sep { visibility: hidden; }   /* space sorts these, not dots */
.fd-sentence { display: grid; flex: 1 1 60px; min-width: 60px; }
.fd-sentence > .fd-input, .fd-sentence > .fd-mirror { grid-area: 1 / 1; font: inherit; line-height: 1.5; white-space: pre; overflow: hidden; min-width: 0; }
.fd-input { all: unset; grid-area: 1 / 1; font: inherit; line-height: 1.5; white-space: pre; overflow: hidden; color: inherit; background: none; border: 0; outline: none; padding: 0; width: 100%; }
.fd-input::placeholder { color: var(--fd-faint); }
.fd-mirror { display: none; }
/* The sentence (fd-say): one line of letters, with room above it for the notes. The letters are typed into the same box, its own
   text now clear, and a mirror under it draws the same letters in the same type, so the caret stands where it should, with each
   stretch read marked and its note above (lk-name, the small faint name over a value). */
.fd-say .fd-find { padding: 10px 16px 12px; }
.fd-say .fd-sentence > .fd-input, .fd-say .fd-sentence > .fd-mirror { padding: 16px 0 0; }
.fd-say .fd-input { color: transparent; caret-color: var(--lk-text, #222); }
.fd-say .fd-mirror { display: block; pointer-events: none; color: var(--lk-text, #222); }
.fd-part { position: relative; }
.fd-note { position: absolute; left: 0; top: -14px; line-height: 1; white-space: nowrap; }
.fd-stop, .fd-when { color: var(--fd-quiet); }
.fd-who { text-decoration: underline; text-decoration-color: var(--lk-link); text-decoration-thickness: var(--lk-link-width, .5px); text-underline-offset: 3px; }
/* The year line, under the sentence: the months, the nodes found as dots on their days, the time asked for as a band, the near ones
   hollow. Opened (Up from the choices, or a click), it grows in place to its full height: each day a column, its nodes piled; or a
   lane a value of the first choice line. The dot under the pointer or the cursor is named beside it, in the window's own type. */
.fd-line { display: none; min-height: 58px; padding: 6px 16px 0; border-bottom: 1px solid var(--fd-hair); flex: none; position: relative; overflow: hidden; }
.fd-say .fd-line { display: block; }
.fd-say .fd-line.fd-off { display: none; }
.fd-line svg { display: block; width: 100%; overflow: visible; }
.fd-line circle[data-i] { cursor: pointer; }
.fd-line .fd-ring { fill: none; stroke: var(--lk-text, #222); stroke-width: 1.2; }
.fd-line .fd-lane { font-size: var(--lk-label); fill: var(--fd-quiet); }
.fd-line .fd-sep { stroke: var(--fd-hair); stroke-width: 1; }
.fd-line .fd-count { font-size: var(--lk-label); fill: var(--fd-faint); }
.fd-name { position: absolute; max-width: 60%; padding: 4px 9px; font-size: var(--lk-small); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.fd-name .lk-day { margin-right: 8px; }
/* The two ways the line can be drawn, the library's alternatives (lk-alts): the one in force in the text colour. */
.fd-by { position: absolute; right: 16px; top: 6px; font-size: var(--lk-small); display: flex; gap: 12px; }
.fd-by > span { cursor: pointer; }
.fd-line .fd-base, .fd-line .fd-tick { stroke: var(--fd-line); stroke-width: 1; }
.fd-line .fd-band { fill: var(--fd-wash); }
.fd-line .fd-dot { fill: currentColor; opacity: .8; }
.fd-line .fd-hollow { fill: var(--lk-paper, #fff); stroke: var(--fd-quiet); stroke-width: 1.2; }
.fd-line .fd-today { stroke: var(--fd-quiet); stroke-width: 1; }
.fd-line text { font-size: var(--lk-label); fill: var(--fd-faint); }
/* The body scrolls; the choices sit above the rows, a gap of one line between them. A property's name here stays a shade
   lighter than its values, which are quiet. */
.fd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 10px; transition: opacity .1s; }
.fd-body.fd-reading { opacity: .5; transition: opacity .15s ease .25s; }
.fd-head { margin: 6px 0 2px; }   /* the library's small faint name (lk-name) */
/* A group's head: a bold word after a gap of one line (the grammar). */
.fd-near { font-weight: 600; margin: 20px 0 2px calc(var(--fd-day) + 36px); }
.fd-ch { display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 2px 10px; font-size: var(--lk-small); padding: 3px 0 7px; align-items: baseline; }
.fd-choices { padding-bottom: 14px; }
.fd-head-rows { margin-top: 8px; }
.fd-ck { color: var(--fd-faint); display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-cv { display: flex; gap: 0 10px; flex-wrap: wrap; color: var(--fd-quiet); }
.fd-c { all: unset; cursor: pointer; display: inline-flex; align-items: baseline; gap: 3px; padding: 0 4px; margin: 0 -4px; border-radius: 3px; }
.fd-c:hover { color: inherit; }
/* A number stands only on the choice that is lit or pointed at; its room is kept, so nothing moves when it comes. */
.fd-c .fd-nb { color: var(--fd-faint); font-size: var(--lk-small); font-variant-numeric: tabular-nums; visibility: hidden; }
.fd-c:hover .fd-nb, .fd-c.fd-lit .fd-nb { visibility: visible; }
.fd-c.fd-lit { color: inherit; }
.fd-cv .fd-dot { visibility: hidden; }
.fd-more { margin: -3px 0; }
/* The kinds opened: columns, each a top-level tag in bold over the tags beneath it, stepped in by depth. */
.fd-tree { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px 18px; }
.fd-col { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.fd-col .fd-c { margin-left: calc(var(--fd-depth, 0) * 14px - 4px); max-width: 100%; }
.fd-col .fd-top, .fd-col .fd-th { font-weight: 600; color: var(--lk-text, #222); }
.fd-col .fd-th { margin-top: 12px; }
.fd-more.fd-lit { color: var(--lk-text, #222) !important; }
.fd-icon { display: inline-flex; width: 12px; height: 12px; align-items: center; justify-content: center; color: var(--fd-faint); font-size: 12px; }
.fd-icon svg { width: 12px; height: 12px; }
/* The row: day | chevron | bullet | words and tag | right. */
/* The day's column is there only when a row in the list has a day; the commands have no margin at all, their words under the >. */
.fd-body { --fd-day: 52px; }
.fd-body.fd-noday { --fd-day: 0px; }
.fd-r { display: grid; grid-template-columns: var(--fd-day) 16px 18px minmax(0, 1fr) auto; align-items: baseline; column-gap: 2px; min-height: 32px; padding: 5px 6px 6px 0; border-radius: 3px; cursor: default; }
.fd-r .fd-day { font-size: var(--lk-small); color: var(--fd-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The fold arrow and the bullet are the library's (lk-fold, lk-bul); here only where they stand on the row. */
.fd-fold { width: 16px; align-self: start; margin-top: .5px; }
.fd-bul { align-self: start; margin-top: 2.5px; }
/* A page, a tag, a property: Logseq's own signs from its left sidebar, and Look's property icon, in the faint grey. */
.fd-sign { color: var(--fd-faint); font-size: 14px; line-height: 1; margin-top: 3px; }
.fd-sign .ti, .fd-sign .lk-icon { font-size: 14px; }
.fd-sign .lk-web svg { width: 11px; height: 11px; }
.fd-nm { display: flex; align-items: baseline; gap: 7px; min-width: 0; flex-wrap: wrap; }
.fd-nm .fd-w { min-width: 0; cursor: pointer; }
.fd-nm .fd-w b { font-weight: 600; }
.fd-nm .lk-node { cursor: pointer; }
.fd-right { color: var(--fd-faint); font-size: var(--lk-small); white-space: nowrap; padding-left: 12px; font-variant-numeric: tabular-nums; }
.fd-right .fd-key { font-family: var(--fd-mono); }
.fd-r.fd-cmd { grid-template-columns: minmax(0, 1fr) auto; padding-left: 8px; margin-left: -8px; }
.fd-body .fd-showall { display: block; padding: 5px 0 6px calc(var(--fd-day) + 36px); }
.fd-cut { display: flex; align-items: baseline; padding: 5px 0 6px calc(var(--fd-day) + 36px); }
.fd-cut .fd-showall { padding: 0; }
.fd-none, .fd-wait { padding-left: calc(var(--fd-day) + 36px); }   /* the library's nothing-here line (lk-none), under the words */
/* A node opened in place: its properties, then what points at it, each a line that opens: the grammar's row, the dot
   ringed while closed, the number after the words as faint as on a lit choice. */
.fd-kids { margin: 2px 0 6px calc(var(--fd-day) + 24px); padding-left: 10px; border-left: 1px solid var(--fd-hair); }
.fd-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 5px 12px; font-size: 14px; align-items: baseline; padding: 4px 0 10px; }
.fd-kv .fd-k { display: inline-flex; align-items: center; gap: 5px; }
.fd-kv .fd-v { display: flex; gap: 8px; flex-wrap: wrap; }
.fd-kids .fd-g { grid-template-columns: 16px 18px minmax(0, 1fr); }
.fd-kids .fd-g .lk-tag { margin-left: 2px; }
.fd-gn { margin-left: 16px; }
.fd-gn .fd-showall { padding-left: calc(var(--fd-day) + 34px); }
.fd-ct { color: var(--fd-faint); font-size: var(--lk-small); font-variant-numeric: tabular-nums; }
.fd-faint { color: var(--fd-faint); }
.fd-foot { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 16px 10px; border-top: 1px solid var(--fd-hair); font-size: var(--lk-small); color: var(--lk-text, #222); }
.fd-foot:empty { display: none; }
.fd-foot .fd-k { color: var(--fd-faint); margin-left: .4em; }
.fd-foot .fd-right { margin-left: auto; padding: 0; }
@media (prefers-reduced-motion: reduce) { .fd-r .lk-fold { transition: none; } }`;

const NEAR_SHOWN = 5;   // near rows listed before "show all"
const S = {
  dlg: null, doc: null, gen: 0, timer: 0, reads: 0, enter: null, making: false, say: false,
  typed: '', picks: [], spans: [], words: [], trail: [], trailFrom: 0, mode: 'rows', rowAt: 0, choiceAt: 0,
  kinds: [], pages: null, names: null, tree: null, recents: [], base: [], shown: [], near: [], nearShown: [], facets: null, allShown: false, nearAll: false, moreOf: new Set(),
  dug: [], dugData: new Map(), pointers: new Map(), noteOf: new Map(), unroll: null, unrollFrom: null, openGroups: new Set(), groupAll: new Set(), stale: false,
  line: 0, lineAt: 0, lineDots: [], lineDug: null, lineH: 52,   // the year line: 0 the strip, 1 the days as towers, 2 a lane a value; the dot the cursor is on; the dots drawn; the node dug from it
  cache: { kind: new Map(), kindFacets: new Map(), counted: new Map(), words: new Map() }, loading: false, failed: '', commands: null,
};
const setting = key => Find.settings.setting(key);
// One height from the opening, whatever is listed; the line opened adds its own height to it.
const setHeight = () => { if (S.dlg) S.dlg.style.height = FRAME + (S.say ? SAY : 0) + (setting('rowsShown') || 12) * ROW + (S.line ? S.lineH - 52 : 0) + 'px'; };
const words = () => S.words;
const isCommandMode = () => S.typed.startsWith('>');
const kindPick = () => S.picks.find(p => p.kind === 'tag');
const whoPick = () => S.picks.find(p => p.kind === 'who');
const whenPick = () => S.picks.find(p => p.kind === 'when');
// Nothing asked yet: no stretch read, no letters that narrow.
const atRest = () => !isCommandMode() && !S.picks.length && !S.words.length;
const isMac = /Mac/i.test(navigator.platform || '');
const MOD = isMac ? 'Cmd' : 'Ctrl';
const hasWord = (text, ws) => { const t = text.toLowerCase(); return ws.every(w => t.includes(w)); };

/* The sentence, read with the names known so far: the kinds and the pages once the window has them, the kind's values once its
   nodes are read, a page's note once what points at it is read. Sync, so the mirror always draws the letters as they stand. */
function namesNow() {
  if (!S.names || S.names.kinds.size !== S.kinds.length || S.names.pagesOf !== S.pages) {
    const norm = Find.sentence.norm;
    S.names = { kinds: new Map(S.kinds.map(k => [norm(k.title), k])), pages: new Map((S.pages || []).map(p => [norm(p.title), p])), pagesOf: S.pages, noteOf: uuid => S.noteOf.get(uuid) };
    // A kind and a page of the same name: the kind is read first anyway; a page wins only once a kind is read.
  }
  return S.names;
}
function readNow() {
  if (isCommandMode()) { if (S.say) S.picks = []; S.spans = []; S.words = []; S.trail = []; S.trailFrom = S.typed.length; return; }
  // The pieces: the picks are what was picked, every word typed narrows and lights.
  if (!S.say) { const ws = S.typed.trim().toLowerCase().split(/\s+/).filter(Boolean); S.spans = []; S.words = ws; S.trail = ws; S.trailFrom = 0; return; }
  const names = namesNow();
  let r = Find.sentence.read(S.typed, names);
  const kind = r.picks.find(p => p.kind === 'tag');
  const facets = kind && S.cache.kindFacets.get(kind.id);
  if (facets) r = Find.sentence.read(S.typed, { ...names, values: facets.byLabel });
  S.picks = r.picks; S.spans = r.spans; S.words = r.words; S.trail = r.trail; S.trailFrom = r.trailFrom;
}
/* What points at a page, or mentions it, read once (the same reading a dug row shows): the nodes, and for each the property
   it came through. The property most of them came through is what the sentence pencils over the name. */
async function pointers(uuid) {
  if (S.pointers.has(uuid)) return S.pointers.get(uuid);
  if (!S.dugData.has(uuid)) { try { S.dugData.set(uuid, await db.node(uuid)); } catch (error) { console.error('Find: could not read the node', error); S.dugData.set(uuid, { properties: [], pointed: [], mentioned: [] }); } }
  const data = S.dugData.get(uuid), ids = new Map(), nodes = [], tally = new Map();
  for (const g of data.pointed) for (const n of g.nodes) if (!ids.has(n.id)) { ids.set(n.id, g.name); nodes.push(n); tally.set(g.name, (tally.get(g.name) || 0) + 1); }
  for (const n of data.mentioned) if (!ids.has(n.id)) { ids.set(n.id, ''); nodes.push(n); }
  S.noteOf.set(uuid, [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] || (data.mentioned.length ? 'mentioned' : 'node'));
  const got = { ids, nodes: nodes.sort(db.byDay) };
  S.pointers.set(uuid, got);
  return got;
}

/* What is on screen, worked out from the sentence. */
async function compute() {
  const gen = ++S.gen;
  S.failed = '';
  try {
    if (isCommandMode()) { S.shown = []; S.near = []; S.nearShown = []; S.facets = null; return; }
    if (!S.kinds.length) S.kinds = await db.kinds();
    if (S.say && !S.pages) S.pages = await db.pages();
    if (gen !== S.gen) return;
    readNow();
    const tag = kindPick();
    if (tag) {
      if (!S.cache.kind.has(tag.id)) S.cache.kind.set(tag.id, await db.nodesOfKind(tag.id));
      if (gen !== S.gen) return;
      if (!S.cache.kindFacets.has(tag.id)) { S.cache.kindFacets.set(tag.id, await db.facets(S.cache.kind.get(tag.id))); if (gen !== S.gen) return; }
      readNow();   // the kind's values are known now: a name among the words may be one of them
    }
    for (const p of S.picks) if (p.kind === 'who' && !p.name) { await pointers(p.uuid); if (gen !== S.gen) return; }
    readNow();
    const ws = S.words, when = whenPick();
    const inWindow = n => n.day >= when.from && n.day <= when.to;
    const isNear = n => n.day && !inWindow(n) && n.day >= when.nearFrom && n.day <= when.nearTo;
    const narrow = list => (ws.length ? list.filter(n => hasWord(n.text, ws)) : list);
    if (atRest()) {
      if (!S.tree) S.tree = await db.kindTree();
      if (!S.recents.length) S.recents = await db.recents();
      if (gen !== S.gen) return;
      S.base = []; S.shown = []; S.near = []; S.nearShown = []; S.facets = null; return;
    }
    if (tag) {
      let nodes = S.cache.kind.get(tag.id);
      const full = S.cache.kindFacets.get(tag.id);
      // The choices are counted over what the sentence read: the letters narrow the rows, and light the choice they name.
      const picked = JSON.stringify(S.picks.map(p => [p.kind, p.kind === 'tag' ? p.id : p.kind === 'who' ? (p.name ? p.name + '=' + p.key : p.uuid) : p.from + '-' + p.to + (p.around ? '~' : '')]));
      if (!S.cache.counted.has(picked)) {
        for (const p of S.picks) {
          if (p.kind !== 'who') continue;
          if (p.name) nodes = nodes.filter(n => full.byNode.get(n.id)?.has(p.name + '=' + p.key));
          else { const ptr = S.pointers.get(p.uuid); nodes = nodes.filter(n => ptr?.ids.has(n.id)); }
        }
        const near = when ? nodes.filter(isNear).sort(db.byDay) : [];
        const base = (when ? nodes.filter(n => n.day && inWindow(n)) : nodes).slice().sort(db.byDay);
        S.cache.counted.set(picked, { base, near, facets: { props: countFacets(base, full), months: db.months(base), kinds: [] } });
      }
      const counted = S.cache.counted.get(picked);
      S.base = counted.base; S.near = counted.near; S.facets = counted.facets;
    } else if (whoPick()) {
      // No kind: everything that points at the page, or mentions it; the kinds among them are the choices.
      let nodes = (await pointers(whoPick().uuid)).nodes;
      if (gen !== S.gen) return;
      for (const p of S.picks) if (p.kind === 'who' && p !== whoPick()) { const ptr = await pointers(p.uuid); nodes = nodes.filter(n => ptr.ids.has(n.id)); }
      if (gen !== S.gen) return;
      S.near = when ? nodes.filter(isNear).sort(db.byDay) : [];
      S.base = when ? nodes.filter(n => n.day && inWindow(n)) : nodes;
      S.facets = { props: [], months: db.months(S.base), kinds: kindCounts(S.base) };
    } else {
      // Words alone: Logseq's own search answers; a time keeps the rows in its window.
      const key = ws.join(' ');
      if (!S.cache.words.has(key)) S.cache.words.set(key, await db.search(ws.join(' ')));
      if (gen !== S.gen) return;
      const found = S.cache.words.get(key);
      S.near = when ? found.filter(isNear).sort(db.byDay) : [];
      S.base = when ? found.filter(n => n.day && inWindow(n)) : found;
      S.facets = { props: [], months: db.months(S.base), kinds: kindCounts(S.base) };
      S.shown = S.base; S.nearShown = S.near; return;
    }
    S.shown = narrow(S.base); S.nearShown = narrow(S.near);
  } catch (error) {
    console.error('Find: could not read the graph', error);
    S.failed = error?.message || String(error);
  }
}
// The values among a subset of a kind's nodes, recounted from the kind's full reading.
// A choice earns its place by narrowing: a property is offered when two or more of its values occur and at least one is
// held by more than one node (a value held by one node each is a list of the nodes, not a way to narrow them); free words
// only when they repeat among a few values. Properties most nodes hold come first.
function countFacets(nodes, full) {
  const ids = new Set(nodes.map(n => n.id)), counts = new Map();
  for (const id of ids) for (const held of full.byNode.get(id) || []) counts.set(held, (counts.get(held) || 0) + 1);
  return full.props.map(p => ({ name: p.name, type: p.type, values: p.values.map(v => ({ ...v, count: counts.get(p.name + '=' + v.key) || 0 })) }))
    .map(p => ({ ...p, values: p.values.filter(v => v.count > 0 && v.count < ids.size).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }))
    .filter(p => p.values.length > 1 && p.values.some(v => v.count >= 2) && !(p.type === 'default' && p.values.length > 8))
    .map(p => ({ ...p, held: p.values.reduce((n, v) => n + v.count, 0) }))
    .sort((a, b) => b.held - a.held || a.name.localeCompare(b.name));
}
// The kinds beneath the picked one, among its nodes: under Person, Doctor and Nurse. Two or more, else none.
function kindsBeneath(tag, nodes) {
  const kinds = kindCounts(nodes).filter(k => k.id !== tag.id);
  return kinds.length > 1 ? kinds : [];
}
function kindCounts(nodes) {
  const map = new Map();
  for (const n of nodes) if (n.kind) map.set(n.kind.id, { id: n.kind.id, uuid: n.kind.uuid, title: n.kind.title, count: (map.get(n.kind.id)?.count || 0) + 1 });
  return [...map.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

/* The choices, as groups of items; each item knows how to say itself in the sentence. The last words typed (the trail) light
   the choice they begin; Tab puts its name in their place. */
function choiceGroups() {
  const groups = [];
  if (isCommandMode()) return groups;
  const trail = S.trail, typed = trail.length > 0;
  const matches = label => typed && trail.every(w => label.toLowerCase().split(/[\s,./()-]+/).some(l => l.startsWith(w)) || label.toLowerCase().startsWith(w));
  const tag = kindPick();
  const limit = key => S.moreOf.has(key) ? 999 : 3;
  if (atRest() && S.moreOf.has('kind') && S.tree?.length) {
    // Opened with nothing typed, every kind, laid out as Structure's tree: a column under each top-level tag, each tag
    // beneath its parent, Task under "Logseq". The items run down each column, then on to the next.
    // "Logseq" is no column of its own: it stands under the last one, after a gap.
    const items = [];
    let col = -1, at = 0;
    for (const column of S.tree) {
      const under = column.tag == null && col >= 0;
      if (!under) { col++; at = 0; }
      column.rows.forEach((r, i) => items.push({ label: r.title, count: r.count, depth: r.depth, col, at: at++, head: under && !i ? column.title : '', pick: () => take({ kind: 'tag', id: r.id, uuid: r.uuid, title: r.title }, r.title, false) }));
    }
    groups.push({ key: 'kind', label: 'kind', icon: '', tree: col + 1, items });
  } else if (!tag) {
    // With letters typed, the kinds whose names match come first (so "cons" picks Consultation whatever the words find);
    // when none match, the kinds among the results say what was found.
    const named = typed ? S.kinds.filter(k => matches(k.title)) : atRest() ? S.kinds : [];
    const kinds = named.length ? named : (S.facets?.kinds || []);
    if (kinds.length) groups.push({ key: 'kind', label: typed ? 'kind' : 'start from', icon: '', items: kinds.slice(0, limit('kind')).map(k => ({ label: k.title, count: k.count, lit: named.length > 0 && matches(k.title), pick: () => take({ kind: 'tag', id: k.id, uuid: k.uuid, title: k.title }, k.title, matches(k.title)) })), more: kinds.length > limit('kind') });
  }
  if (S.facets) {
    // Under an umbrella kind, the kinds beneath it come first; saying one takes the umbrella's place in the sentence.
    if (tag) {
      const beneath = kindsBeneath(tag, S.base).filter(k => !typed || matches(k.title));
      if (beneath.length) groups.push({ key: 'kind', label: 'kind', icon: '', items: beneath.slice(0, limit('kind')).map(k => ({ label: k.title, count: k.count, lit: matches(k.title), pick: () => replaceKind({ kind: 'tag', id: k.id, uuid: k.uuid, title: k.title }) })), more: beneath.length > limit('kind') });
    }
    // A few lines of properties, then "more choices"; with letters typed, every line that matches shows.
    let lines = 0;
    for (const p of S.facets.props) {
      if (S.picks.some(x => x.kind === 'who' && x.name === p.name)) continue;
      const vals = p.values.filter(v => !typed || matches(v.label));
      if (!vals.length) continue;
      if (!typed && !S.moreOf.has('lines') && lines >= 3) { groups.hidden = (groups.hidden || 0) + 1; continue; }
      lines++;
      groups.push({ key: 'p:' + p.name, label: p.name, icon: kindIconHtml(p.type), items: vals.slice(0, limit('p:' + p.name)).map(v => ({ label: v.label, count: v.count, lit: matches(v.label), pick: () => take({ kind: 'who', name: p.name, type: p.type, key: v.key, label: v.label, uuid: v.uuid }, v.label, matches(v.label)) })), more: vals.length > limit('p:' + p.name) });
    }
    if (!whenPick()) {
      const ms = S.facets.months.filter(m => !typed || matches(m.label));
      if (ms.length > 1) groups.push({ key: 'when', label: 'When', icon: kindIconHtml('date'), items: ms.slice(0, limit('when')).map(m => ({ label: m.label, count: m.count, lit: matches(m.label), pick: () => take(monthPick(m), monthSaid(m.key), matches(m.label)) })), more: ms.length > limit('when') });
    }
  }
  // "more" is a choice like the others, so the arrows reach it and Tab or Enter takes it; the cursor stays where the first new one comes.
  // The kinds opened with nothing typed are laid out anew as columns, so the cursor goes to the first of them.
  for (const g of groups) if (g.more) g.items.push({ more: true, label: 'more', pick: () => { S.moreOf.add(g.key); if (g.key === 'kind' && atRest() && S.tree?.length) S.choiceAt = 0; growChoices(); } });
  if (groups.hidden) groups.push({ key: 'lines', label: '', icon: '', items: [{ more: true, label: `${groups.hidden} more ${groups.hidden === 1 ? 'property' : 'properties'} to narrow by`, pick: () => { S.moreOf.add('lines'); growChoices(); } }] });
  return groups;
}
const flatChoices = groups => groups.flatMap(g => g.items);
// "more" grows the choices where they stand, so the rows under them glide down (window.PluginDoor.regrow).
function growChoices() { const was = S.dlg?.querySelector('.fd-choices')?.getBoundingClientRect().height; render(); window.PluginDoor.regrow(S.dlg?.querySelector('.fd-choices'), was); }
const litChoice = groups => (S.trail.length && (S.say || S.trail.length === 1) ? flatChoices(groups).find(c => c.lit) : null);
// A month said in the sentence carries its year, so it reads as that month whatever the year today.
const monthSaid = key => Find.sentence.SHORT[key % 100 - 1] + ' ' + Math.floor(key / 100);

// A month picked among the pieces: that month, nothing near it.
function monthPick(m) { const y = Math.floor(m.key / 100), mo = m.key % 100, from = y * 10000 + mo * 100 + 1, to = y * 10000 + mo * 100 + new Date(y, mo, 0).getDate(); return { kind: 'when', month: true, from, to, nearFrom: from, nearTo: to, label: m.label }; }
/* Taking a choice: among the pieces it becomes a pick; in the sentence its name is said. */
function take(pick, label, lit) { if (S.say) say(label, lit); else addPick(pick); }
function addPick(pick) {
  S.picks.push(pick);
  S.typed = ''; said();
}
// A kind beneath the picked one takes its place; the value and month picks stay, since they hold under it too.
function replaceKind(pick) {
  if (S.say) return sayKind(pick.title);
  S.picks = S.picks.map(p => (p.kind === 'tag' ? pick : p));
  S.typed = ''; said();
}
function removePick(at) {
  S.picks.splice(at, 1);
  // A value or month pick needs its kind; without the kind they go too.
  if (!kindPick()) S.picks = S.picks.filter(p => p.kind === 'tag');
  said();
}
/* Saying a choice puts its name in the sentence: in place of the last words typed when they lit it, else after them. */
function say(label, inPlace = true) {
  const t = S.typed, cut = inPlace && S.trail.length ? S.trailFrom : t.length;
  const head = t.slice(0, cut).replace(/\s+$/, '');
  S.typed = (head ? head + ' ' : '') + label + ' ';
  said();
}
// A kind beneath the one read takes its place in the sentence; what else was said holds under it too.
function sayKind(title) {
  const k = kindPick();
  if (k) S.typed = S.typed.slice(0, k.at) + title + S.typed.slice(k.end);
  said();
}
function said() {
  S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false; S.nearAll = false; S.dug = []; S.openGroups.clear(); S.moreOf.delete('lines');
  readNow();
  const input = S.dlg?.querySelector('.fd-input');
  if (input) { input.value = S.typed; input.setSelectionRange(S.typed.length, S.typed.length); input.focus(); }
  refresh();
}

/* The rows, flat, in the order they show: the rows found, then the near ones, and inside a dug one its pointed-at groups
   and their nodes. */
function rowList() {
  const list = [];
  if (isCommandMode()) {
    // Logseq's commands, read once per opening; the letters after the > narrow them by name, every word must occur.
    const ws = S.typed.slice(1).trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!S.commands) S.commands = Find.commands.list().map(c => ({ kind: 'command', ...c }));
    for (const c of S.commands) if (hasWord(c.label, ws) && c.label !== 'Plugin settings') list.push(c);
    if (hasWord('Plugin settings', ws)) list.push({ kind: 'command', label: 'Plugin settings', id: 'plugin:settings', key: '' });
    return list;
  }
  const top = atRest() ? S.recents : S.shown;
  const shown = S.allShown ? top : top.slice(0, setting('rowsShown') || 12);
  const nearShown = atRest() ? [] : (S.nearAll ? S.nearShown : S.nearShown.slice(0, NEAR_SHOWN));
  const add = (n, near, fromLine) => {
    if (!fromLine) list.push({ kind: 'node', node: n, top: true, near });
    if (!S.dug.includes(n.uuid) || (!fromLine && S.lineDug === n.uuid)) return;
    const data = S.dugData.get(n.uuid);
    if (!data) return;
    for (const g of data.pointed) {
      const key = n.uuid + '|' + g.name + '|' + g.kind;
      list.push({ kind: 'group', key, name: g.name, tag: g.kind, count: g.nodes.length, nodes: g.nodes, of: n.uuid, near });
      if (S.openGroups.has(key)) for (const m of (S.groupAll.has(key) ? g.nodes : g.nodes.slice(0, 3))) list.push({ kind: 'node', node: m, under: key, near });
    }
    if (data.mentioned.length) {
      const key = n.uuid + '|mentioned';
      list.push({ kind: 'group', key, name: 'mentioned in', tag: '', count: data.mentioned.length, nodes: data.mentioned, of: n.uuid, near });
      if (S.openGroups.has(key)) for (const m of (S.groupAll.has(key) ? data.mentioned : data.mentioned.slice(0, 3))) list.push({ kind: 'node', node: m, under: key, near });
    }
  };
  const lineNode = lineDugNode();
  if (lineNode) add(lineNode, false, true);
  for (const n of shown) add(n, false);
  for (const n of nearShown) add(n, true);
  return list;
}

/* Drawing. The whole body is drawn again on each change, and nothing keeps state in the DOM; only the cursor stepping along
   the rows moves on its own (litRow), since after "show all" the rows can be thousands. */
function render() {
  const d = S.dlg; if (!d) return;
  const doc = S.doc;
  const groups = choiceGroups(), choices = flatChoices(groups), rows = rowList();
  S.choiceAt = Math.min(S.choiceAt, Math.max(0, choices.length - 1));
  S.rowAt = Math.min(S.rowAt, Math.max(0, rows.length - 1));
  if (S.mode === 'choices' && !choices.length) S.mode = 'rows';
  drawSentence(doc);
  drawLine(doc);
  // the body
  const body = d.querySelector('.fd-body');
  const scrollTop = body.scrollTop;
  // The day's column stands only when a node in the list has a day to show in it.
  const dayOf = n => (n.journal ? '' : db.dayLabel(n.day));
  body.classList.toggle('fd-noday', !isCommandMode() && ![...rows.filter(r => r.kind === 'node').map(r => r.node), ...S.shown].some(dayOf));
  body.replaceChildren();
  if (S.failed) body.append(el(doc, 'div', { class: 'fd-none lk-none' }, 'The graph could not be read: ' + S.failed));
  const lineNode = lineDugNode(), lineBox = lineNode ? dugBox(doc, lineNode) : null;
  if (lineBox) body.append(lineBox);
  if (!isCommandMode() && groups.length) {
    let ci = 0;
    const wrap = el(doc, 'div', { class: 'fd-choices' });
    // No word over the lines: each is a label and the choices that narrow the list, and the gap under them tells
    // them from the rows.
    for (const g of groups) {
      const box = el(doc, 'div', { class: 'fd-ch' });
      box.append(el(doc, 'span', { class: 'fd-ck' + (g.key.startsWith('p:') ? ' lk-prop' : ''), html: g.icon ? `<span class="fd-icon">${g.icon}</span>` : '' }, g.key === 'kind' ? 'kind' : g.label));
      if (g.tree) { box.append(treeOf(doc, g, () => ci++, groups)); wrap.append(box); continue; }
      const vals = el(doc, 'span', { class: 'fd-cv' });
      g.items.forEach((c, i) => {
        const at = ci++;
        const lit = (S.mode === 'choices' && at === S.choiceAt) || (S.mode !== 'choices' && litChoice(groups) === c);
        if (i) vals.append(el(doc, 'span', { class: 'fd-dot' }, '·'));
        if (c.more) vals.append(el(doc, 'button', { class: 'fd-more lk-more' + (lit ? ' fd-lit' : ''), type: 'button', 'data-c': at, click: () => c.pick() }, c.label));
        else vals.append(el(doc, 'button', { class: 'fd-c' + (lit ? ' fd-lit' : ''), type: 'button', 'data-c': at, title: c.label.length > 44 ? c.label : null, click: () => c.pick() }, short(c.label, 44), el(doc, 'span', { class: 'fd-nb' }, String(c.count))));
      });
      box.append(vals);
      wrap.append(box);
    }
    body.append(wrap);
  }
  // With nothing typed the rows are the pages opened last, and a head says so; otherwise the rows are what was found.
  if (!isCommandMode() && rows.length && atRest()) body.append(el(doc, 'div', { class: 'fd-head fd-head-rows lk-name' }, 'recently opened'));
  const ws = words();
  // What ends the list found: nothing found, "show all", a kind cut to its newest.
  const tail = () => {
    if (isCommandMode() || atRest()) return;
    const total = S.shown.length, limit = setting('rowsShown') || 12, tag = kindPick();
    if (!S.loading && !total && !S.failed) body.append(el(doc, 'div', { class: 'fd-none lk-none' }, 'Nothing with these words here'));
    const more = total > limit && !S.allShown ? el(doc, 'button', { class: 'fd-showall lk-more', type: 'button', click: () => { S.allShown = true; render(); } }, `show all ${total}`) : null;
    // A kind too long to read whole says so where the list ends, and which part it holds.
    const cutFrom = tag && S.cache.kind.get(tag.id)?.cutFrom;
    const line = more && cutFrom ? el(doc, 'div', { class: 'fd-cut' }, more, el(doc, 'span', { class: 'fd-faint' }, ` · the newest of ${cutFrom}`)) : more || (cutFrom ? el(doc, 'div', { class: 'fd-none lk-none' }, `The newest ${S.cache.kind.get(tag.id).length} of ${cutFrom}`) : null);
    if (line) body.append(line);
  };
  // A dug node's lines (its properties, the groups pointing at it, their nodes) go into its box; the next top row ends it.
  let container = lineBox || body, tailed = false;
  rows.forEach((r, i) => {
    const on = S.mode === 'rows' && i === S.rowAt;
    if (r.kind === 'command') { body.append(commandRow(doc, r, i, on)); return; }
    // The near rows stand after what was found, under their own head.
    if (r.near && !tailed) { tailed = true; tail(); body.append(el(doc, 'div', { class: 'fd-near' }, 'Near')); container = body; }
    if (r.kind === 'group') {
      const open = S.openGroups.has(r.key);
      const row = el(doc, 'div', { class: 'fd-r fd-g lk-row' + (on ? ' on' : ''), 'data-i': i });
      row.append(el(doc, 'button', { class: 'fd-fold lk-fold', type: 'button', 'aria-expanded': String(open), title: open ? 'Close' : 'Open the nodes', click: event => { event.stopPropagation(); toggleGroup(r); } }));
      row.append(el(doc, 'span', { class: 'fd-bul lk-bul' + (open ? '' : ' folded') }));
      const nm = el(doc, 'span', { class: 'fd-nm' }, el(doc, 'span', { class: 'lk-prop' }, r.name));
      if (r.tag) nm.append(el(doc, 'span', { class: 'lk-tag' }, r.tag));
      nm.append(el(doc, 'span', { class: 'fd-ct' }, String(r.count)));
      row.append(nm);
      row.addEventListener('click', () => { S.mode = 'rows'; S.rowAt = i; render(); });
      container.append(wrapIn(doc, row, r));
      return;
    }
    const node = r.node, dug = r.top && S.dug.includes(node.uuid) && S.lineDug !== node.uuid;
    if (r.top) container = body;
    const row = el(doc, 'div', { class: 'fd-r lk-row' + (on ? ' on' : ''), 'data-i': i, 'data-uuid': node.uuid });
    row.append(el(doc, 'span', { class: 'fd-day lk-day' }, node.journal ? '' : db.dayLabel(node.day)));   // a journal page's name is its day
    if (r.top) row.append(el(doc, 'button', { class: 'fd-fold lk-fold', type: 'button', 'aria-expanded': String(dug), title: dug ? 'Close' : 'Open in place', click: event => { event.stopPropagation(); S.rowAt = i; S.mode = 'rows'; toggleDig(node); } }));
    else row.append(el(doc, 'span', {}));
    // What the row is, in the bullet's place: a page Logseq's page sign, a tag its #, a property the icon of what it holds; a bullet its dot.
    row.append(node.sign ? el(doc, 'span', { class: 'fd-bul fd-sign fd-' + node.sign, title: SIGN_SAYS[node.sign], html: signHtml(node) }) : el(doc, 'span', { class: 'fd-bul lk-bul' }));
    const nm = el(doc, 'span', { class: 'fd-nm' });
    // Under a kind read, or a group's head naming one, the kind has been said: no mark before the name.
    const named = r.top ? kindPick() : rows.find(x => x.key === r.under)?.tag;
    const w = el(doc, 'span', { class: 'fd-w' + (node.isPage ? ' lk-node' + (named ? ' lk-bare' : '') : ''), ...(node.isPage ? { 'data-uuid': node.uuid } : {}) });
    if (node.isPage) w.innerHTML = markWords(esc(node.text), ws);
    else for (const part of node.parts) {
      if (part.uuid) w.append(el(doc, 'span', { class: 'lk-node', 'data-uuid': part.uuid, html: markWords(esc(part.text), ws), click: event => { event.stopPropagation(); openPage(part.uuid, event.shiftKey); close(); } }));
      else w.append(el(doc, 'span', { html: markWords(esc(part.text), ws) }));
    }
    w.addEventListener('click', event => { event.stopPropagation(); openPage(node.uuid, event.shiftKey); close(); });
    nm.append(w);
    if (node.kind && !(r.under && rows.find(x => x.key === r.under)?.tag === node.kind.title) && !(kindPick() && r.top && kindPick().title === node.kind.title)) nm.append(el(doc, 'span', { class: 'lk-tag' }, node.kind.title));
    row.append(nm);
    const right = node.page && !node.page.journal ? node.page.title : '';
    row.append(el(doc, 'span', { class: 'fd-right' }, right));
    row.addEventListener('click', () => { S.mode = 'rows'; S.rowAt = i; render(); });
    container.append(wrapIn(doc, row, r));
    // Under the last of a group's three nodes, "show all" lists the rest.
    if (r.under && rows[i + 1]?.under !== r.under && !S.groupAll.has(r.under)) {
      const g = rows.find(x => x.key === r.under);
      if (g && g.count > 3) container.append(wrapIn(doc, el(doc, 'button', { class: 'fd-showall lk-more', type: 'button', click: () => { S.groupAll.add(r.under); render(); } }, `show all ${g.count}`), r));
    }
    if (dug) { const box = dugBox(doc, node); body.append(box); container = box; }
  });
  if (!tailed) tail();
  else if (S.nearShown.length > NEAR_SHOWN && !S.nearAll) body.append(el(doc, 'button', { class: 'fd-showall lk-more', type: 'button', click: () => { S.nearAll = true; render(); } }, `show all ${S.nearShown.length}`));
  // While the graph is read, the rows that are there stay where they are and go a shade lighter after a moment; no line
  // is added or taken away, so nothing jumps between one letter and the next.
  body.classList.toggle('fd-reading', S.loading);
  body.scrollTop = scrollTop;
  const cur = body.querySelector(S.mode === 'choices' ? `[data-c="${S.choiceAt}"]` : `.fd-r[data-i="${S.rowAt}"]`);
  cur?.scrollIntoView?.({ block: 'nearest' });
  drawFoot(groups, rows);
  // What was just opened rolls out (a dug node once it is read, a group's nodes), so the rows under it glide down.
  // A node not read yet first shows "reading…", rolled out; what it holds then grows on from there.
  if (S.unroll) {
    const opened = S.unroll(body), waiting = opened.some(e => e.querySelector('.fd-wait'));
    if (opened.length) {
      const was = S.unrollFrom, now = opened.reduce((h, e) => h + e.getBoundingClientRect().height, 0);
      if (was == null) window.PluginDoor.unroll(opened); else window.PluginDoor.regrow(opened[0], was);
      if (waiting) S.unrollFrom = now; else { S.unroll = null; S.unrollFrom = null; }
    }
  }
}
/* The sentence as the mirror draws it: the letters as typed, each stretch read wrapped with its note above; the joining words
   quiet. The box keeps the caret and the keys; the mirror follows its scroll. */
function drawSentence(doc) {
  const find = S.dlg.querySelector('.fd-find'), input = find.querySelector('.fd-input'), mirror = find.querySelector('.fd-mirror'), sentence = find.querySelector('.fd-sentence');
  if (input.value !== S.typed) input.value = S.typed;
  mirror.replaceChildren();
  for (const piece of find.querySelectorAll('.fd-piece, .fd-sep')) piece.remove();
  if (!S.say) {
    // The pieces: each pick as the thing it is, its × under the pointer.
    S.picks.forEach((p, i) => {
      if (i) find.insertBefore(el(doc, 'span', { class: 'fd-sep' }, '·'), sentence);
      const piece = el(doc, 'span', { class: 'fd-piece lk-reveals' });
      piece.append(el(doc, 'button', { class: 'fd-x lk-x lk-reveal', type: 'button', title: 'Take this off', 'aria-label': 'Take off ' + (p.title || p.label), click: () => removePick(i) }, '×'));
      if (p.kind === 'tag') piece.append(el(doc, 'span', { class: 'lk-tag' }, p.title));
      else if (p.kind === 'who') { piece.append(el(doc, 'span', { class: 'lk-prop' }, p.name)); piece.append(p.uuid ? el(doc, 'span', { class: 'lk-node', 'data-uuid': p.uuid }, p.label) : el(doc, 'span', {}, p.label)); }
      else piece.append(el(doc, 'span', { class: 'fd-month' }, p.label));
      find.insertBefore(piece, sentence);
    });
    input.placeholder = S.picks.length ? '' : 'pick a kind, or type';
    return;
  }
  input.placeholder = 'what, with whom, when';
  let at = 0;
  for (const s of S.spans) {
    if (s.from < at) continue;
    if (s.from > at) mirror.append(doc.createTextNode(S.typed.slice(at, s.from)));
    const part = el(doc, 'span', { class: 'fd-part ' + s.cls }, S.typed.slice(s.from, s.to));
    if (s.note) part.append(el(doc, 'span', { class: 'fd-note lk-name' }, s.note));
    mirror.append(part);
    at = s.to;
  }
  if (at < S.typed.length) mirror.append(doc.createTextNode(S.typed.slice(at)));
  mirror.scrollLeft = input.scrollLeft;
}
/* The year line: whole years, from the first the rows found touch to the last (one year at least, ten at most); a tick a
   month, the months named when they fit, else the years; the time asked for as a band; each node found a dot on its day,
   a near one hollow; today a short line. Blank until something is found, and gone while the commands are listed.
   Opened, each day is a column (a week over more than four months, a month over more than two years) and the nodes of a
   column pile up; or a lane for each of the first choice line's three values and one for the rest. The dot the cursor is
   on is ringed and named; the pointer names the one under it. (The owner, 5 November 2026, from timeline-mockup.html.) */
const lineDugNode = () => (S.lineDug && S.line ? [...S.shown, ...S.nearShown].find(n => n.uuid === S.lineDug) : null);
// The line can open when the sentence found dated nodes.
const canLine = () => S.say && !isCommandMode() && !atRest() && [...S.shown, ...S.nearShown].some(n => n.day);
// The first choice line that is a property: its three values make the lanes.
function laneProp() { if (!S.facets) return null; for (const p of S.facets.props) { if (S.picks.some(x => x.kind === 'who' && x.name === p.name)) continue; if (p.values.length) return p; } return null; }
function drawLine(doc) {
  const box = S.dlg.querySelector('.fd-line');
  box.replaceChildren();
  box.classList.toggle('fd-off', isCommandMode());
  S.lineDots = [];
  if (!S.say || isCommandMode() || atRest()) { S.line = 0; S.lineH = 52; setHeight(); return; }
  const when = whenPick();
  const dated = [...S.shown, ...S.nearShown].filter(n => n.day);
  if (!dated.length && !when) { S.line = 0; S.lineH = 52; setHeight(); return; }
  const lanes = S.line === 2 ? laneProp() : null;
  if (S.line === 2 && !lanes) S.line = 1;
  const W = Math.max(120, (box.clientWidth || 900) - 32), PAD = 0;   // the window's own width before it is laid out
  const month = day => Math.floor(day / 10000) * 12 + Math.floor(day / 100) % 100 - 1;
  const months = dated.map(n => month(n.day));
  if (when) months.push(month(when.from), month(when.to));
  let lo = Math.floor(Math.min(...months) / 12) * 12, hi = Math.floor(Math.max(...months) / 12) * 12 + 11;
  if (hi - lo > 119) lo = hi - 119;
  const n = hi - lo + 1;
  const daysIn = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100, 0).getDate();
  const x = day => PAD + ((month(day) - lo) + (day % 100 - 1) / daysIn(day)) / n * W;
  const xm = m => PAD + (m - lo) / n * W;
  // The lanes: the values' names, "others" last; a node is in the first lane whose value it holds.
  const laneNames = lanes ? [...lanes.values.slice(0, 3).map(v => v.label), 'others'] : [''];
  const full = kindPick() && S.cache.kindFacets.get(kindPick().id);   // which values each node holds, read once per kind
  const laneOf = nd => { if (!lanes) return 0; const has = full?.byNode.get(nd.id); const i = lanes.values.slice(0, 3).findIndex(v => has?.has(lanes.name + '=' + v.key)); return i < 0 ? laneNames.length - 1 : i; };
  const LH = S.line === 2 ? 44 : S.line === 1 ? 96 : 0, top = S.line ? 24 : 0;
  const Y = S.line ? top + laneNames.length * LH : 30, H = S.line ? Y + 28 : 52;
  const parts = [];
  if (when) { const a = Math.max(xm(lo), x(when.from)), b = Math.min(xm(hi + 1), x(when.to) + W / n / daysIn(when.to)); if (b > a) parts.push(S.line ? `<rect class="fd-band" x="${a.toFixed(1)}" y="${top - 6}" width="${(b - a).toFixed(1)}" height="${Y - top + 6}" rx="2"/>` : `<rect class="fd-band" x="${a.toFixed(1)}" y="${Y - 14}" width="${(b - a).toFixed(1)}" height="28" rx="2"/>`); }
  parts.push(`<line class="fd-base" x1="${xm(lo)}" y1="${Y}" x2="${xm(hi + 1).toFixed(1)}" y2="${Y}"/>`);
  const everyMonth = n <= 36, labelMonths = n <= 12 || (n <= 24 && W / n >= 34);   // the months named when they fit, else the years alone
  for (let m = lo; m <= hi + 1; m++) {
    const jan = m % 12 === 0;
    if (everyMonth || jan) parts.push(`<line class="fd-tick" x1="${xm(m).toFixed(1)}" y1="${Y - (jan || m === hi + 1 ? 4 : 3)}" x2="${xm(m).toFixed(1)}" y2="${Y + (jan || m === hi + 1 ? 4 : 3)}"/>`);
    if (m > hi) continue;
    if (labelMonths) parts.push(`<text x="${(xm(m) + 2).toFixed(1)}" y="${Y + 20}">${Find.sentence.SHORT[m % 12]}</text>`);
    if (jan && (labelMonths || n <= 120)) parts.push(`<text x="${(xm(m) + (labelMonths ? 0 : 2)).toFixed(1)}" y="${S.line ? 14 : Y - 20}">${Math.floor(m / 12)}</text>`);
  }
  const today = new Date(), t = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  if (month(t) >= lo && month(t) <= hi) parts.push(`<line class="fd-today" x1="${x(t).toFixed(1)}" y1="${S.line ? top - 2 : Y - 11}" x2="${x(t).toFixed(1)}" y2="${Y + 11}"/><text x="${(x(t) + 6).toFixed(1)}" y="${S.line ? top - 5 : Y - 14}">today</text>`);
  if (!S.line) {
    const seen = new Set();
    const dot = (nd, cls) => { if (month(nd.day) < lo) return; const k = cls + nd.day; if (seen.has(k)) return; seen.add(k); parts.push(`<circle class="${cls}" cx="${x(nd.day).toFixed(1)}" cy="${Y}" r="4"><title>${esc(db.dayLabel(nd.day))}</title></circle>`); };
    for (const nd of S.nearShown.slice(0, 400)) if (nd.day) dot(nd, 'fd-hollow');
    for (const nd of S.shown.slice(0, 400)) if (nd.day) dot(nd, 'fd-dot');
  } else {
    // A column a day, a week or a month, as the span allows; the middle of the column is where its dots stand.
    const unit = n <= 4 ? 'day' : n <= 24 ? 'week' : 'month';
    const epoch = day => Math.floor(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) / 86400000);
    const col = day => unit === 'day' ? day : unit === 'week' ? Math.floor((epoch(day) + 3) / 7) : month(day);
    const cx = day => unit === 'day' ? x(day) + W / n / daysIn(day) / 2 : unit === 'week' ? (() => { const d = new Date(col(day) * 7 * 86400000); const mid = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); return month(mid) < lo ? xm(lo) : x(mid); })() : xm(month(day)) + W / n / 2;
    const totals = new Map(), piled = new Map(), cap = Math.floor((LH - 14) / 10);
    const list = [...S.shown.slice(0, 400).filter(nd => nd.day && month(nd.day) >= lo).map(nd => ({ nd, near: false })), ...S.nearShown.slice(0, 400).filter(nd => nd.day && month(nd.day) >= lo).map(nd => ({ nd, near: true }))];
    for (const d of list) { d.lane = laneOf(d.nd); d.key = d.lane + ':' + col(d.nd.day); totals.set(d.key, (totals.get(d.key) || 0) + 1); }
    for (let l = 0; l < laneNames.length; l++) if (lanes) { parts.push(`<text class="fd-lane" x="0" y="${top + l * LH + 12}">${esc(laneNames[l])}</text>`); if (l) parts.push(`<line class="fd-sep" x1="0" y1="${top + l * LH - 2}" x2="${W}" y2="${top + l * LH - 2}"/>`); }
    for (const d of list) {
      const h = piled.get(d.key) || 0; piled.set(d.key, h + 1);
      const X = cx(d.nd.day), bottom = top + (d.lane + 1) * LH - 8;
      if (h >= cap) { if (h === cap) parts.push(`<text class="fd-count" x="${(X - 4).toFixed(1)}" y="${bottom - cap * 10 + 2}">+${totals.get(d.key) - cap}</text>`); continue; }
      S.lineDots.push({ node: d.nd, near: d.near, lane: d.lane, cx: X, cy: bottom - h * 10 });
    }
    // The dots in the order the arrows walk them: left to right, a pile from its foot up.
    S.lineDots.sort((a, b) => a.cx - b.cx || b.cy - a.cy);
    // Opened, the cursor starts on the newest dot found, as the rows start with the newest.
    if (S.lineStart) { S.lineStart = false; let at = S.lineDots.length - 1; while (at > 0 && S.lineDots[at].near) at--; S.lineAt = at; }
    S.lineAt = Math.max(0, Math.min(S.lineDots.length - 1, S.lineAt));
    S.lineDots.forEach((d, i) => parts.push(`<circle class="${d.near ? 'fd-hollow' : 'fd-dot'}" data-i="${i}" cx="${d.cx.toFixed(1)}" cy="${d.cy}" r="4"/>`));
    if (S.mode === 'line' && S.lineDots[S.lineAt]) { const d = S.lineDots[S.lineAt]; parts.push(`<circle class="fd-ring" cx="${d.cx.toFixed(1)}" cy="${d.cy}" r="7"/>`); }
  }
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="The years, with what was found on its days">${parts.join('')}</svg>`;
  if (S.line && laneProp()) box.append(el(doc, 'span', { class: 'fd-by lk-alts' },
    el(doc, 'span', { class: S.line === 2 ? '' : 'on', click: event => { event.stopPropagation(); setLine(1); } }, 'one lane'),
    el(doc, 'span', { class: S.line === 2 ? 'on' : '', click: event => { event.stopPropagation(); setLine(2); } }, 'by ' + laneProp().name)));
  if (S.line) {
    const name = el(doc, 'div', { class: 'fd-name lk-pop' }); name.hidden = true; box.append(name);
    const show = d => { if (!d) { name.hidden = true; return; } name.replaceChildren(el(doc, 'span', { class: 'lk-day' }, db.dayLabel(d.node.day)), doc.createTextNode(d.node.text)); name.hidden = false; let left = Math.max(0, Math.min(16 + d.cx - 10, box.clientWidth - name.offsetWidth - 16));
      // The name stands above every dot it would otherwise cover, so no dot is ever hidden by it; and clear of the word at the right end.
      const topFor = left => { const under = S.lineDots.filter(o => o.cx + 4 >= left - 16 && o.cx - 4 <= left - 16 + name.offsetWidth).map(o => o.cy); return Math.max(0, 6 + Math.min(d.cy, ...under) - 8 - name.offsetHeight); };
      let top = topFor(left); const by = box.querySelector('.fd-by');
      if (by && top < 28 && left + name.offsetWidth > by.offsetLeft - 12) { left = Math.max(0, by.offsetLeft - name.offsetWidth - 12); top = topFor(left); }
      name.style.left = left + 'px'; name.style.top = top + 'px'; };
    box.addEventListener('mouseover', event => { const c = event.target.closest?.('circle[data-i]'); if (c) show(S.lineDots[Number(c.dataset.i)]); });
    box.addEventListener('mouseleave', () => show(S.mode === 'line' ? S.lineDots[S.lineAt] : null));
    if (S.mode === 'line') show(S.lineDots[S.lineAt]);
  }
  // A click on a dot puts the cursor on it; on the strip, it opens the line.
  box.addEventListener('click', event => { const c = event.target.closest?.('circle[data-i]'); if (c) { S.mode = 'line'; S.lineAt = Number(c.dataset.i); render(); } else if (!S.line) setLine(1); });
  S.lineH = H; setHeight();
}
// The line opens, folds, or lays its lanes out, growing or shrinking where it stands so the rows glide.
function setLine(mode) {
  const box = S.dlg?.querySelector('.fd-line'), was = box?.getBoundingClientRect().height;
  if (mode && !canLine()) return;
  if (mode && !S.line) S.lineStart = true;
  S.line = mode;
  if (!mode) { if (S.lineDug) { S.dug = S.dug.filter(u => u !== S.lineDug); S.lineDug = null; } if (S.mode === 'line') S.mode = 'rows'; }
  else S.mode = 'line';
  render();
  if (box && was != null) window.PluginDoor.regrow(box, was);
}
// Down on a dot digs its node under the line; on one dug, it steps the cursor into what opened.
function digDot() {
  const d = S.lineDots[S.lineAt]; if (!d) return;
  if (S.lineDug === d.node.uuid) { S.mode = 'rows'; S.rowAt = 0; render(); return; }
  if (S.lineDug) { S.dug = S.dug.filter(u => u !== S.lineDug); for (const k of [...S.openGroups]) if (k.startsWith(S.lineDug + '|')) S.openGroups.delete(k); }
  S.lineDug = d.node.uuid;
  toggleDig(d.node);
}
const withData = (root, name, value) => [...root.querySelectorAll(`[data-${name}]`)].filter(e => e.getAttribute('data-' + name) === value);
// The kinds in columns: a top-level tag bold at the head of its column, the tags under it stepped in by depth; "Logseq" a
// head that is no kind. Each is a choice like any other, lit by the cursor, its count shown only then or under the pointer.
function treeOf(doc, g, next, groups) {
  const tree = el(doc, 'span', { class: 'fd-cv fd-tree' });
  for (let col = 0; col < g.tree; col++) {
    const box = el(doc, 'span', { class: 'fd-col' });
    for (const c of g.items.filter(x => x.col === col)) {
      if (c.head) box.append(el(doc, 'span', { class: 'fd-th' }, c.head));
      const at = next();
      const lit = S.mode === 'choices' && at === S.choiceAt;
      box.append(el(doc, 'button', { class: 'fd-c' + (c.depth ? '' : ' fd-top') + (lit ? ' fd-lit' : ''), type: 'button', 'data-c': at, style: `--fd-depth: ${Math.max(0, c.depth - 1)}`, title: c.label.length > 30 ? c.label : null, click: () => c.pick() }, short(c.label, 30), el(doc, 'span', { class: 'fd-nb' }, String(c.count))));
    }
    tree.append(box);
  }
  return tree;
}
function drawFoot(groups, rows) { S.dlg.querySelector('.fd-foot').replaceChildren(...foot(S.doc, groups, rows)); }
// The cursor moves along the rows: the lit mark goes from one to the other and nothing is drawn again.
function litRow(at, groups, rows) {
  S.rowAt = at;
  const body = S.dlg.querySelector('.fd-body');
  body.querySelector('.fd-r.on')?.classList.remove('on');
  const cur = body.querySelector(`.fd-r[data-i="${at}"]`);
  cur?.classList.add('on');
  cur?.scrollIntoView?.({ block: 'nearest' });
  drawFoot(groups, rows);
}
// Rows under an opened group sit one step in; a group line sits inside its node's box.
function wrapIn(doc, row, r) {
  if (r.under) { const box = el(doc, 'div', { class: 'fd-gn', 'data-under': r.under }); box.append(row); return box; }
  return row;
}
function commandRow(doc, r, i, on) {
  const row = el(doc, 'div', { class: 'fd-r fd-cmd lk-row' + (on ? ' on' : ''), 'data-i': i });
  // No picture before a command and no margin: the > in the find line already says what these are, and the words start under it.
  row.append(el(doc, 'span', { class: 'fd-nm' }, el(doc, 'span', { class: 'fd-w', html: markWords(esc(r.label), S.typed.slice(1).trim().toLowerCase().split(/\s+/).filter(Boolean)) })));
  row.append(el(doc, 'span', { class: 'fd-right' }, el(doc, 'span', { class: 'fd-key' }, r.key)));
  row.addEventListener('click', () => runCommand(r));
  return row;
}
// The letters typed, in bold where they occur in the words (in the escaped text only).
function markWords(html, ws) {
  if (!ws.length) return html;
  const pattern = new RegExp('(' + ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return html.split(/(&[a-z#0-9]+;|<[^>]+>)/i).map((piece, i) => i % 2 ? piece : piece.replace(pattern, '<b>$1</b>')).join('');
}
// A node opened in place: its properties as name and value, the groups follow as rows of the list.
function dugBox(doc, node) {
  const data = S.dugData.get(node.uuid);
  const box = el(doc, 'div', { class: 'fd-kids', 'data-dug': node.uuid });
  if (!data) { box.append(el(doc, 'div', { class: 'fd-wait lk-none' }, 'Reading…')); return box; }
  if (data.properties.length) {
    const kv = el(doc, 'div', { class: 'fd-kv' });
    for (const p of data.properties) {
      kv.append(el(doc, 'span', { class: 'fd-k lk-prop', html: `<span class="fd-icon">${kindIconHtml(p.type)}</span>` }, p.name));
      const v = el(doc, 'span', { class: 'fd-v' });
      for (const val of p.values) v.append(val.uuid ? el(doc, 'span', { class: 'lk-node', 'data-uuid': val.uuid, click: event => { openPage(val.uuid, event.shiftKey); close(); } }, val.label) : el(doc, 'span', {}, val.label));
      kv.append(v);
    }
    box.append(kv);
  }
  if (!data.properties.length && !data.pointed.length && !data.mentioned.length) box.append(el(doc, 'div', { class: 'fd-faint' }, 'nothing points here'));
  return box;
}
const SIGN_SAYS = { page: 'A page', tag: 'A tag', property: 'A property' };
const signHtml = node => node.sign === 'property' ? kindIconHtml(node.propType) : `<i class="ti ti-${node.sign === 'tag' ? 'hash' : 'file'}" aria-hidden="true"></i>`;
const short = (text, max = 36) => { const t = String(text || '').trim(); return t.length > max ? t.slice(0, max - 2).replace(/\s+\S*$/, '') + '…' : t; };
const KEY = (k, label) => `<span>${label}<span class="fd-k">${k}</span></span>`;
/* The foot names what the keys do right now, naming the thing: "narrow to Consultation Tab", "open Look test Enter", "in the
   sidebar Shift Enter", dig →, close ←. What a key does is in the text colour and the key faint beside it, as in the Pressing set; the key is a word at the
   foot's own size, since the symbols ⏎ and ⇧⏎ small and faint could not be read. Not a legend of keys (none is wanted, 31 October): each word is the action at hand, and it changes
   with the cursor. Taken out that morning under the ruling, asked back the same day ("there are no hints at the bottom of
   view anymore like tab or shift enter"). The right end offers to make a page from the words, with its key: Cmd Enter, or Enter when
   nothing is listed. */
function foot(doc, groups, rows) {
  const items = [];
  const add = html => items.push(el(doc, 'span', { html }));
  const cur = rows[S.rowAt];
  if (isCommandMode()) { add(KEY('Enter', cur ? `run ${esc(cur.label)}` : 'run')); return items; }
  const choices = flatChoices(groups);
  const lit = S.mode === 'choices' ? choices[S.choiceAt] : litChoice(groups);
  if (S.mode === 'line') {
    const d = S.lineDots[S.lineAt];
    if (d) { add(KEY('Enter', `open ${esc(short(d.node.text))}`)); add(KEY('Shift Enter', 'in the sidebar')); add(KEY('↓', S.lineDug === d.node.uuid ? 'into it' : 'dig')); }
    if (laneProp()) add(KEY('↑', S.line === 2 ? 'one lane' : `by ${esc(laneProp().name)}`));
    add(KEY('Escape', S.lineDug ? 'close' : 'fold the line'));
    return items;
  }
  if (S.mode === 'choices') { add(KEY('Tab', lit.more ? 'show more' : `narrow to ${esc(lit.label)}`)); add(KEY('← → ↑ ↓', 'choose')); add(KEY('Escape', 'back to the rows')); if (groupOf(groups, S.choiceAt) === 0 && canLine()) add(KEY('↑', 'the line')); }
  else {
    if (lit) add(KEY('Tab', `narrow to ${esc(lit.label)}`)); else if (choices.length) add(KEY('Tab', 'narrow'));
    if (cur?.kind === 'node') { add(KEY('Enter', `open ${esc(short(cur.node.text))}`)); add(KEY('Shift Enter', 'in the sidebar')); }
    else if (cur?.kind === 'group') add(KEY('Enter', `open the ${cur.count}`));
  }
  if (atRest()) return items;
  if (cur?.kind === 'node' && cur.top) add(KEY(S.dug.includes(cur.node.uuid) ? '←' : '→', S.dug.includes(cur.node.uuid) ? 'close' : 'dig'));
  if (cur?.kind === 'group') add(KEY(S.openGroups.has(cur.key) ? '←' : '→', S.openGroups.has(cur.key) ? 'close' : 'open'));
  if (!S.say && S.picks.length && !S.typed) add(KEY('Backspace', `take ${esc(S.picks[S.picks.length - 1].title || S.picks[S.picks.length - 1].label)} off`));
  if (canMake()) { const name = S.typed.trim(); items.push(el(doc, 'span', { class: 'fd-right' }, el(doc, 'button', { class: 'lk-lone lk-i-plus', type: 'button', title: 'Make a page with these words as its name', click: () => makePage(name) }, `make a page “${name}”`, el(doc, 'span', { class: 'fd-k' }, makesPage(rows) ? 'Enter' : MOD + ' Enter')))); }
  return items;
}

/* Doing. */
async function toggleDig(node) {
  if (S.dug.includes(node.uuid)) {
    // Closing rolls the node's box back up first, then the list is drawn without it.
    await window.PluginDoor.rollUp(S.dlg ? withData(S.dlg, 'dug', node.uuid) : []);
    S.dug = S.dug.filter(u => u !== node.uuid); for (const k of [...S.openGroups]) if (k.startsWith(node.uuid + '|')) S.openGroups.delete(k);
    if (S.lineDug === node.uuid) { S.lineDug = null; if (S.mode === 'rows') S.mode = 'line'; }
    render(); return;
  }
  S.dug.push(node.uuid);
  S.unroll = body => withData(body, 'dug', node.uuid);
  if (!S.dugData.has(node.uuid)) {
    render();
    try { S.dugData.set(node.uuid, await db.node(node.uuid)); } catch (error) { console.error('Find: could not read the node', error); S.dugData.set(node.uuid, { properties: [], pointed: [], mentioned: [] }); }
  }
  render();
}
async function toggleGroup(g) {
  if (S.openGroups.has(g.key)) { await window.PluginDoor.rollUp(S.dlg ? withData(S.dlg, 'under', g.key) : []); S.openGroups.delete(g.key); }
  else { S.openGroups.add(g.key); S.unroll = body => withData(body, 'under', g.key); }
  render();
}
function openRow(r, inSidebar) {
  if (!r) return;
  if (r.kind === 'command') return runCommand(r);
  if (r.kind === 'group') return toggleGroup(r);
  openPage(r.node.uuid, inSidebar);
  close();
}
async function runCommand(r) {
  close();
  if (r.id === 'plugin:settings') return window.PluginDoor.settings.open('find');
  try { await Find.commands.run(r); } catch (error) { notify(`Logseq did not run “${r.label}”.`, 'warning'); }
}
async function makePage(name) {
  if (S.making) return;
  S.making = true;
  try { const uuid = await db.makePage(name); close(); if (!uuid) notify('The page was not made.', 'warning'); }
  catch (error) { notify('The page was not made: ' + (error?.message || error), 'warning'); }
  finally { S.making = false; }
}
// Words typed that the sentence did not read, and no kind: a page can be made of them, whatever is listed, with Cmd Enter (Ctrl elsewhere).
const canMake = () => !!words().length && !kindPick() && !isCommandMode();
// With no rows at all, making a page is the one thing offered, so Enter does it.
const makesPage = rows => !rows.length && canMake() && !S.loading && !S.failed;
// Down past the last row of a list shows the rest of that list.
function showRest(rows) {
  const cur = rows[S.rowAt], next = rows[S.rowAt + 1];
  if (cur?.under && next?.under !== cur.under && !S.groupAll.has(cur.under) && rows.find(r => r.key === cur.under)?.count > 3) { S.groupAll.add(cur.under); return true; }
  if (isCommandMode() || atRest()) return false;
  if (cur?.near) { if (next || S.nearAll || S.nearShown.length <= NEAR_SHOWN) return false; return S.nearAll = true; }
  if ((next && !next.near) || S.allShown || S.shown.length <= (setting('rowsShown') || 12)) return false;
  return S.allShown = true;
}
// Enter takes what is on screen; pressed while the letters are being read, it waits for what they find.
function takeEnter(shift) {
  const groups = choiceGroups(), rows = rowList();
  if (S.mode === 'choices') { flatChoices(groups)[S.choiceAt]?.pick(); return; }
  if (S.mode === 'line') { const d = S.lineDots[S.lineAt]; if (d) { openPage(d.node.uuid, shift); close(); } return; }
  if (makesPage(rows)) return makePage(S.typed.trim());
  openRow(rows[S.rowAt], shift);
}

/* The keys. The dialog takes every key (Logseq's shortcuts never see them); each does one thing. */
function onKey(event) {
  if (event.isComposing || event.keyCode === 229) return;
  const groups = choiceGroups(), choices = flatChoices(groups), rows = rowList();
  const take = () => { event.preventDefault(); event.stopPropagation(); };
  const k = event.key;
  if (k === 'Escape') {
    take();
    if (S.dug.length) { const last = S.dug[S.dug.length - 1]; toggleDig({ uuid: last }); return; }
    if (S.mode === 'line' || S.line) { setLine(0); return; }
    if (S.mode === 'choices') { S.mode = 'rows'; render(); return; }
    close(); return;
  }
  // Tab narrows, Enter opens: the two never overlap. Tab says the choice the letters light; with none lit it steps into
  // the choices, where Tab again takes the one under the cursor. Enter opens the row the cursor is on (in the choices, it
  // takes the choice too, as a click would).
  if (k === 'Enter') {
    take();
    if (isMac ? event.metaKey : event.ctrlKey) { if (canMake()) makePage(S.typed.trim()); return; }
    if (S.loading) S.enter = { shift: event.shiftKey }; else takeEnter(event.shiftKey);
    return;
  }
  if (k === 'Tab') {
    take();
    if (event.shiftKey) { if (S.mode === 'choices') { S.mode = 'rows'; render(); } return; }
    if (S.mode === 'choices') { choices[S.choiceAt]?.pick(); return; }
    const lit = litChoice(groups);
    if (lit) { lit.pick(); return; }
    if (!choices.length) return;
    S.mode = 'choices'; S.choiceAt = 0;
    render(); return;
  }
  if (k === 'ArrowDown' || k === 'ArrowUp') {
    take();
    const down = k === 'ArrowDown';
    // On the line: Down digs the dot's node, Up lays the lanes out or gathers them.
    if (S.mode === 'line') { if (down) digDot(); else if (laneProp()) setLine(S.line === 2 ? 1 : 2); return; }
    if (S.mode === 'choices') {
      // In the kinds' columns Up and Down step down a column and on to the next.
      const step = S.choiceAt + (down ? 1 : -1);
      if (choices[S.choiceAt]?.col != null && choices[step]?.col != null) { S.choiceAt = step; render(); return; }
      // Up and Down step between the groups; Down from the last goes on to the rows.
      const at = groupOf(groups, S.choiceAt), next = at + (down ? 1 : -1);
      if (next >= groups.length) { if (rows.length) { S.mode = 'rows'; S.rowAt = 0; } }
      else if (next >= 0) S.choiceAt = groups.slice(0, next).reduce((n, g) => n + g.items.length, 0);
      else if (canLine()) { if (S.line) { S.mode = 'line'; render(); } else setLine(1); return; }   // Up from the first line of choices steps onto the year line
      render(); return;
    }
    if (down && showRest(rows)) { S.rowAt++; render(); return; }
    if (!down && S.rowAt === 0 && choices.length) { S.mode = 'choices'; S.choiceAt = groups.slice(0, -1).reduce((n, g) => n + g.items.length, 0); render(); return; }
    if (!down && S.rowAt === 0 && !choices.length && canLine()) { if (S.line) { S.mode = 'line'; render(); } else setLine(1); return; }
    litRow(Math.max(0, Math.min(rows.length - 1, S.rowAt + (down ? 1 : -1))), groups, rows);
    return;
  }
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    const right = k === 'ArrowRight';
    if (S.mode === 'line') { take(); S.lineAt = Math.max(0, Math.min(S.lineDots.length - 1, S.lineAt + (right ? 1 : -1))); drawLine(S.doc); drawFoot(groups, rows); return; }
    if (S.mode === 'choices') {
      take();
      // In the kinds' columns Left and Right go to the column beside, at the same height or its last.
      const cur = choices[S.choiceAt];
      if (cur?.col != null) {
        const beside = choices.map((c, i) => [c, i]).filter(([c]) => c.col === cur.col + (right ? 1 : -1));
        if (beside.length) S.choiceAt = beside[Math.min(cur.at, beside.length - 1)][1];
      } else S.choiceAt = Math.max(0, Math.min(choices.length - 1, S.choiceAt + (right ? 1 : -1)));
      render(); return;
    }
    const input = S.dlg.querySelector('.fd-input');
    const cur = rows[S.rowAt]; if (!cur) return;
    const open = cur.kind === 'node' && cur.top ? S.dug.includes(cur.node.uuid) : cur.kind === 'group' ? S.openGroups.has(cur.key) : null;
    if (S.say) {
      // Inside the sentence the arrows move the caret. At its end, Right digs the row the cursor is on and Left closes what
      // is open there; with nothing open, Left walks back into the sentence.
      if (S.typed && (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length)) return;
      if (open == null || open === right) return;
    } else {
      // In the letters the arrows move the caret; at an end, or with no letters, they dig and close.
      if (S.typed && ((right && input.selectionEnd < input.value.length) || (!right && input.selectionStart > 0))) return;
      if (open == null || open === right) { take(); return; }
    }
    take();
    if (cur.kind === 'group') toggleGroup(cur); else toggleDig(cur.node);
    return;
  }
  if (k === 'Backspace' && !S.say && !S.typed && S.picks.length) { take(); removePick(S.picks.length - 1); return; }
  // Every other key is typing: the input has the focus, the letters arrive as input events.
  event.stopPropagation();
}
const groupOf = (groups, at) => { let n = 0; for (let i = 0; i < groups.length; i++) { n += groups[i].items.length; if (at < n) return i; } return groups.length - 1; };

function refresh() {
  clearTimeout(S.timer);
  S.loading = true;
  const at = ++S.reads;
  render();
  S.timer = setTimeout(async () => {
    await compute();
    if (at !== S.reads) return;   // newer letters came: their reading says when it is over
    S.loading = false;
    render();
    const enter = S.enter; S.enter = null;
    if (enter && S.dlg) takeEnter(enter.shift);
  }, S.typed ? 140 : 0);
}
function onInput() {
  const input = S.dlg.querySelector('.fd-input');
  if (input.value === S.typed) return;
  S.typed = input.value;
  S.enter = null;
  S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false; S.nearAll = false;
  if (S.lineDug) { S.dug = S.dug.filter(u => u !== S.lineDug); S.lineDug = null; }
  readNow();
  refresh();
}

/* Opening and closing. open(typed, say): the window with those letters already in the find line (">" for the commands); say, as
   a sentence. */
function open(typed = '', say = false) {
  const doc = host();
  close();
  S.say = !!say;
  S.commands = null;
  if (S.stale) { S.stale = false; S.kinds = []; S.pages = null; S.tree = null; S.recents = []; S.dugData.clear(); S.pointers.clear(); S.noteOf.clear(); }
  style('find', CSS);
  const dlg = el(doc, 'dialog', { class: 'fd lk-window fd-own ' + (setting('windowPlace') === 'centred' ? 'fd-centred' : 'fd-high') + (S.say ? ' fd-say' : ''), 'aria-label': S.say ? 'Find by sentence' : 'Find' });
  const find = el(doc, 'div', { class: 'fd-find' });
  const sentence = el(doc, 'div', { class: 'fd-sentence' });
  const mirror = el(doc, 'div', { class: 'fd-mirror', 'aria-hidden': 'true' });
  const input = el(doc, 'input', { class: 'fd-input', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: S.say ? 'what, with whom, when' : 'pick a kind, or type' });
  input.addEventListener('input', onInput);
  input.addEventListener('scroll', () => { mirror.scrollLeft = input.scrollLeft; });
  sentence.append(mirror, input);
  find.append(sentence);
  dlg.append(find, el(doc, 'div', { class: 'fd-line' }), el(doc, 'div', { class: 'fd-body' }), el(doc, 'div', { class: 'fd-foot' }));
  // The keys are taken at the document, before Logseq's own handlers see them (a Tab that reached Logseq first never
  // came back); only keys from inside the window are taken.
  S.keys = event => { if (S.dlg === dlg && dlg.contains(event.target)) onKey(event); };
  doc.addEventListener('keydown', S.keys, true);
  for (const type of ['keyup', 'keypress']) dlg.addEventListener(type, event => event.stopPropagation());
  dlg.addEventListener('click', () => input.focus(), true);   // whatever was pressed, the keyboard stays in the one box
  dlg.addEventListener('click', event => { if (event.target === dlg) close(); });
  dlg.addEventListener('close', () => { if (S.dlg === dlg) S.dlg = null; dlg.remove(); });
  // One height from the opening, whatever is listed: the foot and the bottom edge stay put, and a longer list scrolls. It
  // leaves room for the rows shown before "show all", under three lines of choices.
  doc.body.appendChild(dlg);
  S.dlg = dlg; S.doc = doc;
  Object.assign(S, { typed, picks: [], spans: [], words: [], trail: [], trailFrom: typed.length, mode: 'rows', rowAt: 0, choiceAt: 0, allShown: false, nearAll: false, dug: [], failed: '', enter: null, near: [], nearShown: [], line: 0, lineAt: 0, lineDots: [], lineDug: null, lineH: 52 });
  setHeight();
  S.moreOf.clear(); S.openGroups.clear(); S.groupAll.clear();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  input.focus();
  readNow();
  refresh();
}
function close() {
  if (!S.dlg) return;
  const d = S.dlg; S.dlg = null;
  if (S.keys) { S.doc?.removeEventListener('keydown', S.keys, true); S.keys = null; }
  try { d.close(); } catch (error) { /* not open */ }
  d.remove();
}
const toggle = () => (S.dlg ? close() : open());
// The sentence's own key: open as a sentence; pressed while one is open, it closes; from the pieces it turns to a sentence.
const sentence = () => { if (S.dlg && S.say) return close(); if (S.dlg) { S.picks = []; S.typed = ''; S.say = true; S.dlg.classList.add('fd-say'); setHeight(); S.dlg.querySelector('.fd-input').placeholder = 'what, with whom, when'; said(); return; } open('', true); };
// The commands' key: open with > typed; pressed while the commands are listed, it closes; from anything else it turns to them.
function commands() {
  if (S.dlg && isCommandMode()) return close();
  if (!S.dlg) return open('>');
  S.typed = '>'; S.picks = []; S.mode = 'rows'; S.rowAt = 0; S.dug = []; readNow(); refresh(); S.dlg.querySelector('.fd-input')?.focus();
}
// The graph changed: what was read is read again next time. What an open window shows stays until the next opening.
function forget() { S.cache.kind.clear(); S.cache.kindFacets.clear(); S.cache.counted.clear(); S.cache.words.clear(); S.stale = true; db.forget(); }

Find.window = { open, close, toggle, sentence, commands, forget, state: S };
})();
