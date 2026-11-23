/* The window: find, then walk. One real dialog in Logseq's document. On top the find line, a row of pieces: each pick as
   the thing it is (a tag in mono, a node with its mark, a month in grey) and, after the last, the letters being typed.
   Under it the choices the graph holds for what is left (the kinds; inside a kind, its properties with their values and
   the months), then the rows: the grammar's row (day, chevron, bullet, name, tag), the chevron opening a node in place
   with its properties and what points at it. Every key has one job ("All of it from the
   keyboard"). Nothing here reads the graph but through Find.db; the look of a row, a node, a tag and a day is Look's.
   Opened by its own command (Find by sentence, Cmd Option K), the same window reads a sentence instead (the owner, 5 November
   2026: "only as something that is triggered or addon to find"): you type what you are looking for as you would say it
   ("Consultation with Dr. Mei Chen around May 2026"), and above each stretch it understood the window pencils what it
   read ("kind", the property's name, "when"); the words it did not read narrow the rows by their letters; Tab completes a
   lit choice in the sentence. Under it the year line, the nodes found as dots on it, the time asked for as a band; after
   the rows, under "Near", what sits just outside that time. The sentence is read by window.PluginDoor.sentence. */
(function () {
const Find = window.Find;
const { host, el, esc, style, kindIconHtml, dragBand, openPage, notify } = Find.kit;
const db = Find.db;

const FRAME = 236, SAY = 72, ROW = 32;   // the find line, the foot, three lines of choices and "show all"; what the sentence adds (room for the notes, the year line); a row
const CSS = `
.fd { position: fixed !important; left: 50% !important; right: auto !important; transform: translateX(-50%); margin: 0 !important; width: min(900px, 92vw); max-height: 78vh;
  box-sizing: border-box; padding: 0; display: flex; flex-direction: column; }   /* the window's look is the library's lk-window */
.fd:not([open]) { display: none; }
.fd.fd-high { top: max(10vh, 60px) !important; bottom: auto !important; }
.fd.fd-centred { top: 50% !important; bottom: auto !important; transform: translate(-50%, -50%); }
/* The same window as a small panel under the line being written (0.5, 22 November 2026, the owner: "the small should be build
   from same library"): no dimming, placed and sized by place(). */
.fd-coming { position: fixed; z-index: 98; pointer-events: none; }
.fd.fd-panel { transform: none; max-height: none; z-index: 99; line-height: 1.5; }   /* its edge and shadow are the library's pop-up, lk-pop */
.fd * { box-sizing: border-box; }
/* The find line: the pieces, then the letters. */
.fd-find { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; padding: 14px 16px; border-bottom: 1px solid var(--lk-hair); font-size: 16px; cursor: text; }
.fd-piece { display: inline-flex; align-items: baseline; gap: 5px; position: relative; }
/* A pick's × is the library's lk-reveal and keeps its place, so nothing moves when it shows. */
.fd-piece .fd-month { color: var(--lk-quiet); }
.fd-sep { visibility: hidden; }   /* space sorts these, not dots */
.fd-sentence { display: grid; flex: 1 1 60px; min-width: 60px; }
.fd-sentence > .fd-input, .fd-sentence > .fd-mirror { grid-area: 1 / 1; font: inherit; line-height: 1.5; white-space: pre; overflow: hidden; min-width: 0; }
.fd-input { all: unset; grid-area: 1 / 1; font: inherit; line-height: 1.5; white-space: pre; overflow: hidden; color: inherit; background: none; border: 0; outline: none; padding: 0; width: 100%; }
.fd-input::placeholder { color: var(--lk-quiet); }
.fd-mirror { display: none; }
/* The sentence (fd-say): one line of letters, with room above it for the notes. The letters are typed into the same box, its own
   text now clear, and a mirror under it draws the same letters in the same type, so the caret stands where it should, with each
   stretch read marked and its note above (lk-name, the small faint name over a value). */
.fd-say .fd-find { padding: 10px 16px 12px; }
.fd-say .fd-sentence > .fd-input, .fd-say .fd-sentence > .fd-mirror { padding: 16px 0 0; }
.fd-say .fd-input { color: transparent; caret-color: var(--lk-text, #222); }
.fd-say .fd-mirror { display: block; pointer-events: none; color: var(--lk-text, #222); }
/* The year line, under the sentence: the months, the nodes found as dots on their days, the time asked for as a band, the near ones
   hollow. Opened (Up from the choices, or a click), it grows in place to its full height: each day a column, its nodes piled; or a
   lane a value of the first choice line. The dot under the pointer or the cursor is named beside it, in the window's own type. */
.fd-line { display: none; min-height: 58px; padding: 6px 16px 0; border-bottom: 1px solid var(--lk-hair); flex: none; position: relative; overflow: hidden; }
.fd-say .fd-line { display: block; }
.fd-say .fd-line.fd-off { display: none; }
/* The two ways the line can be drawn, the library's alternatives (lk-alts): the one in force in the text colour. */
.fd-by { position: absolute; left: 64px; top: 6px; font-size: var(--lk-small); display: flex; gap: 12px; }   /* beside the year, clear of today at the right end */
.fd-by > span { cursor: pointer; }
/* The line itself is the library's timeline (lk-time, PluginDoor.timeline), the one Linked draws: here only its place. */
.fd-line .fd-time-empty { opacity: .45; pointer-events: none; }   /* waiting: the empty line, faint */
/* The body scrolls; the choices sit above the rows, a gap of one line between them. A property's name here stays a shade
   lighter than its values, which are quiet. */
.fd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 10px; }
.fd-head { margin: 6px 0 2px; }   /* the library's small faint name (lk-name) */
/* A group's head: a bold word after a gap of one line (the grammar). */
.fd-near { font-weight: 600; margin: 20px 0 2px calc(var(--fd-day) + 36px); }
/* Each choice line: its small name above its values, as the sentence's notes stand above its words (the audit's 35). */
.fd-head-rows { margin-top: 8px; }
/* A line of values is the library's tab picker (lk-views, lk-view) with no underline, since none is the one shown (the owner,
   13 November 2026: "keep it same tab picker sans underline"); its padding is taken away, so the whole tab space is the gap. */
/* The count stands after the word, always, quiet, as a tab's count does (Threads' kinds: All 12, No tag 7); then the space between
   the words is the tab picker's even space whatever the counts (the owner, 13 November 2026: a count of 506 ran into the next word). */
.fd-more { margin: -3px 0; }
/* The kinds opened: columns, each a top-level tag in bold over the tags beneath it, stepped in by depth. */
.fd-tree { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px 18px; }
.fd-col { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
/* Every kind is the library's tab word (lk-view), as on Topic and When's lines (16 November 2026: one look for a choice); the
   column takes the side padding away so the steps in stand on the words. */
.fd-tree { --lk-view-pad: 0px; }
.fd-tree .lk-view { white-space: nowrap; }   /* a kind's name and its count on one line, as in the lines above */
.fd-tree .lk-view.fd-top { color: var(--lk-text, currentColor) !important; }   /* a top-level tag heads its column, in the text colour, as the Logseq head beside it */
.fd-col .fd-c { margin-left: calc(var(--fd-depth, 0) * 14px); max-width: 100%; }
.fd-col .fd-top, .fd-col .fd-th { font-weight: 600; color: var(--lk-text, #222); }
.fd-col .fd-th { margin-top: 12px; }
.fd-more.fd-lit { color: var(--lk-text, #222) !important; }
.fd-icon { display: inline-flex; width: 12px; height: 12px; align-items: center; justify-content: center; color: var(--lk-quiet); font-size: 12px; }
.fd-icon svg { width: 12px; height: 12px; }
/* The row: day | chevron | bullet | words and tag | right. */
/* The day's column is there only when a row in the list has a day; the commands have no margin at all, their words under the >. */
.fd-body { --fd-day: 52px; }
.fd-body.fd-noday { --fd-day: 0px; }
.fd-r { display: grid; grid-template-columns: var(--fd-day) 16px 18px minmax(0, 1fr) auto; align-items: baseline; column-gap: 2px; min-height: 32px; padding: 5px 6px 6px 0; border-radius: 3px; cursor: default; }
.fd-r .fd-day { font-size: var(--lk-small); color: var(--lk-quiet); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The fold arrow and the bullet are the library's (lk-fold, lk-bul); here only where they stand on the row. */
.fd-fold { width: 16px; align-self: start; margin-top: .5px; }
.fd-bul { align-self: start; margin-top: 2.5px; }
/* A page, a tag, a property: Logseq's own signs from its left sidebar, and Look's property icon, in the faint grey. */
.fd-sign { color: var(--lk-quiet); font-size: 14px; line-height: 1; margin-top: 3px; }
.fd-sign .ti { font-size: 14px; }
.fd-sign .lk-web svg { width: 11px; height: 11px; }
.fd-sign .lk-sign svg { width: 14px; height: 14px; display: block; }
.fd-nm { display: flex; align-items: baseline; gap: 7px; min-width: 0; flex-wrap: wrap; }
.fd-nm .fd-w { min-width: 0; cursor: pointer; }
.fd-nm .fd-task.fd-in { margin: 0 2px 0 1px; }   /* a linked task's circle inside the words, as near its link as Logseq draws it */
.fd-nm .fd-task { margin-right: 6px; }   /* in the words' own line, 6px before them, as Threads: a separate piece of the wrapping row, a long line dropped under it (16 November 2026) */
.fd-nm .fd-w b { font-weight: 600; }
.fd-nm .lk-node { cursor: pointer; }
.fd-right { color: var(--lk-quiet); font-size: var(--lk-small); white-space: nowrap; padding-left: 12px; font-variant-numeric: tabular-nums; }
.fd-right .fd-key { font-family: var(--lk-mono); }
/* The page a found bullet is on: at most a third of the row, cut with an ellipsis, its whole name under the pointer. Until the 0.4
   audit a long name took the row and left the bullet's own words a column one letter wide. */
.fd-right.fd-page { flex: 0 1 auto; max-width: 33%; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fd-r.fd-cmd { grid-template-columns: minmax(0, 1fr) auto; padding-left: 8px; margin-left: -8px; }
.fd-body .fd-showall { display: block; padding: 5px 0 6px calc(var(--fd-day) + 36px); }
.fd-cut { display: flex; align-items: baseline; padding: 5px 0 6px calc(var(--fd-day) + 36px); }
.fd-cut .fd-showall { padding: 0; }
.fd-none, .fd-wait { padding-left: calc(var(--fd-day) + 36px); }   /* the library's nothing-here line (lk-none), under the words */
.fd-say :is(.fd-none, .fd-wait) { padding-left: 0; }   /* the sentence has no rows to stand under: the line starts where the sentence does (the audit's 38) */
/* A node opened in place: its properties, then what points at it, each a line that opens: the grammar's row, the dot
   ringed while closed, the number after the words as faint as on a lit choice. */
.fd-kids { margin: 2px 0 6px calc(var(--fd-day) + 24px); padding-left: 10px; border-left: 1px solid var(--lk-hair); }
/* A node Relations draws here (relHolds) brings its own hairline and steps in: the holder adds none, and stands so that line falls under the row's bullet. */
.fd-kids.fd-node { margin-left: calc(var(--fd-day) - 26px); padding-left: 0; border-left: 0; }
.fd-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 5px 12px; font-size: 14px; align-items: baseline; padding: 4px 0 10px; }
.fd-kv .fd-k { display: inline-flex; align-items: center; gap: 5px; }
.fd-kv .fd-v { display: flex; gap: 8px; flex-wrap: wrap; }
.fd-kids .fd-g { grid-template-columns: 16px 18px minmax(0, 1fr); }
.fd-kids .fd-g .lk-tag { margin-left: 2px; }
.fd-gn { margin-left: 16px; }
.fd-gn .fd-showall { padding-left: calc(var(--fd-day) + 34px); }
.fd-ct { color: var(--lk-quiet); font-size: var(--lk-small); font-variant-numeric: tabular-nums; }
.fd-faint { color: var(--lk-quiet); }
.fd-foot { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 16px 10px; border-top: 1px solid var(--lk-hair); font-size: var(--lk-small); color: var(--lk-text, #222); }
.fd-foot:empty { display: none; }
.fd-foot .fd-k { color: var(--lk-quiet); margin-left: .4em; display: inline-flex; gap: 3px; vertical-align: middle; }
.fd-foot .fd-right { margin-left: auto; padding: 0; }
.fd-foot .fd-say-way { margin-left: auto; } .fd-foot .fd-right + .fd-say-way { margin-left: 0; }   /* at the right end, after Make a page when that stands there */
`;

const NEAR_SHOWN = 5;   // near rows listed before "show all"
const S = {
  dlg: null, doc: null, gen: 0, timer: 0, reads: 0, enter: null, making: false, say: false,
  typed: '', picks: [], spans: [], words: [], trail: [], trailFrom: 0, mode: 'rows', rowAt: 0, choiceAt: 0,
  kinds: [], pages: null, names: null, tree: null, recents: [], base: [], shown: [], near: [], nearShown: [], facets: null, allShown: false, nearAll: false, moreOf: new Set(),
  host: null, hostOff: null, dug: [], dugData: new Map(), pointers: new Map(), noteOf: new Map(), unroll: null, unrollFrom: null, openGroups: new Set(), groupAll: new Set(), stale: false,
  line: 0, lineAt: 0, lineDots: [], lineDug: null, lineH: 52,   // the year line: 0 the strip, 1 the days as towers, 2 a lane a value; the dot the cursor is on; the dots drawn; the node dug from it
  cache: { kind: new Map(), kindFacets: new Map(), counted: new Map(), words: new Map() }, loading: false, failed: '', commands: null,
  statuses: new Map(), statusNow: new Map(),   // the statuses Logseq's Status takes (PluginDoor.statusChoices), by id; a status set here since the window opened, by node
};
const setting = key => Find.settings.setting(key);
/* The window has two hosts (0.5): the window itself, over the page, and a panel under the line being written (S.host: the bullet's
   box, where its caret was). One Find shows at a time, so the state is one; what differs is asked of the host. */
const PANEL_ROWS = 4, PANEL_FRAME = 148;   // the panel: its find line, one line of choices and the foot; the rows it shows
const rowsShown = () => S.host ? PANEL_ROWS : (setting('rowsShown') || 12);
// One height from the opening, whatever is listed; the line opened adds its own height to it.
const setHeight = () => { if (!S.dlg) return; if (S.host) return place(); S.dlg.style.height = FRAME + (S.say ? SAY : 0) + rowsShown() * ROW + (S.line ? S.lineH - 52 : 0) + 'px'; };
// The panel's place: under the bullet's words at their width; above them where the window has no room below.
function place() {
  const d = S.dlg, box = S.host?.box; if (!d || !box?.isConnected) return;
  const r = box.getBoundingClientRect(), win = S.doc.defaultView, h = PANEL_FRAME + PANEL_ROWS * ROW;
  const below = win.innerHeight - r.bottom - 12, above = r.top - 12;
  const under = below >= h || below >= above;
  const height = Math.max(180, Math.min(h, under ? below : above));
  const set = (k, v) => d.style.setProperty(k, v, 'important');
  set('left', Math.round(r.left) + 'px'); set('right', 'auto'); set('width', Math.round(Math.max(320, r.width)) + 'px');
  set('top', Math.round(under ? r.bottom + 4 : r.top - height - 4) + 'px'); set('bottom', 'auto');
  d.style.height = height + 'px';
}
const words = () => S.words;
const isCommandMode = () => S.typed.startsWith('>');
const kindPick = () => S.picks.find(p => p.kind === 'tag');
const whoPick = () => S.picks.find(p => p.kind === 'who');
const whenPick = () => S.picks.find(p => p.kind === 'when');
// Nothing asked yet: no stretch read, no letters that narrow.
const atRest = () => !isCommandMode() && !S.picks.length && !S.words.length;
const isMac = window.PluginDoor.keys.mac;
const hasWord = (text, ws) => { const t = text.toLowerCase(); return ws.every(w => t.includes(w)); };

/* The sentence, read with the names known so far: the kinds and the pages once the window has them, the kind's values once its
   nodes are read, a page's note once what points at it is read. Sync, so the mirror always draws the letters as they stand. */
function namesNow() {
  if (!S.names || S.names.kinds.size !== S.kinds.length || S.names.pagesOf !== S.pages) {
    const norm = window.PluginDoor.sentence.norm;
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
  let r = window.PluginDoor.sentence.read(S.typed, names);
  const kind = r.picks.find(p => p.kind === 'tag');
  const facets = kind && S.cache.kindFacets.get(kind.id);
  if (facets) r = window.PluginDoor.sentence.read(S.typed, { ...names, values: facets.byLabel });
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
  S.timePick = null; S.timeLane = null;   // a new sentence, a new list: the timeline lets go of what it narrowed
  try {
    if (isCommandMode()) { S.shown = []; S.near = []; S.nearShown = []; S.facets = null; return; }
    // Read again behind what is shown (open()): the answer replaces the old list and the window is drawn once more.
    const behind = (what, read, set) => { if (!S.again?.[what]) return; S.again[what] = false; read().then(got => { set(got); if (S.dlg && gen === S.gen) refresh(); }).catch(error => console.warn('Find: the graph could not be read again', error)); };
    if (!S.kinds.length) S.kinds = await db.kinds(); else behind('kinds', () => db.kinds(), got => { S.kinds = got; });
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
      if (!S.tree) S.tree = await db.kindTree(); else behind('tree', () => db.kindTree(), got => { S.tree = got; });
      if (!S.recents.length) S.recents = await db.recents(); else behind('recents', () => db.recents(), got => { S.recents = got; });
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
  /* In the panel with nothing typed, the first line is the tags the bullet could be, Predictive's own guesses with their reasons
     (0.5, the owner: the tag list goes "Into the panel"). One line, so the kinds wait until letters come. */
  if (S.host?.kinds?.length && newName(S.shown.slice(0, rowsShown()))) {
    groups.push({ key: 'newkind', label: 'kind of the new page', icon: '', items: S.host.kinds.map(k => ({ label: k.title, count: k.count, does: S.host.newKind?.uuid === k.uuid ? `no kind` : `make it a ${k.title}`, pick: () => { S.host.newKind = S.host.newKind?.uuid === k.uuid ? null : k; S.mode = 'rows'; S.rowAt = Math.max(0, rowList().findIndex(r => r.kind === 'make')); render(); } })) });
    return groups;
  }
  if (S.host?.tags?.length && atRest()) {
    groups.push({ key: 'tagme', label: 'tag this bullet', icon: '', items: S.host.tags.slice(0, limit('tagme')).map((t, i) => ({ label: t.title, hint: t.reason, does: `tag this bullet ${t.title}`, coming: t.title, pick: () => tagLine(i) })), more: S.host.tags.length > limit('tagme') });
    for (const g of groups) if (g.more) g.items.push({ more: true, label: 'more', pick: () => { S.moreOf.add(g.key); growChoices(); } });
    return groups;
  }
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
const monthSaid = key => window.PluginDoor.sentence.SHORT[key % 100 - 1] + ' ' + Math.floor(key / 100);

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

/* A node opened in place is Relations' own opened node (20 November 2026; the owner, 19 November, of the proposal: "ok this is good",
   and of what the parts join around: "the relations part is the non-negotiable part"): its properties to change, its bullets to write
   in, what points at it to walk on along. Find puts an empty holder under the row and Relations fills it, for as many nodes as
   Relations says it can hold at once; with Relations switched off, or for a node opened beyond that, Find draws what it always drew. */
const relRoom = () => { try { return window.PluginDoor.answers('relations:node') ? 2 : 0; } catch (error) { return 0; } };   // two here, so a task opened in Todo behind the window keeps its own
const relHolds = uuid => { const at = S.dug.filter(u => u !== S.lineDug).indexOf(uuid); return at >= 0 && at < relRoom(); };
const inNode = target => !!target?.closest?.('[data-th-node], [popover], .th-in-place, textarea');
/* The rows, flat, in the order they show: the rows found, then the near ones, and inside a dug one its pointed-at groups
   and their nodes. */
/* In the panel, words that name no page are a new name (0.5, B): one row, "+ words", that makes the page with its kind and links
   it. It stands first, lit, when no page's name begins with the words; after the pages found when one does (↓ reaches it). */
function newName(shown) {
  if (!S.host || !canMake() || S.loading || S.failed || S.picks.length) return null;
  const name = S.typed.trim(), low = name.toLowerCase();
  const names = shown.filter(n => n.isPage).map(n => String(n.text || '').toLowerCase());
  if (names.includes(low)) return null;
  return { kind: 'make', name, first: !names.some(n => n.startsWith(low)) };
}
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
  const top = atRest() ? S.recents : S.shown.filter(timeKeeps);
  const shown = S.allShown ? top : top.slice(0, rowsShown());
  const fresh = newName(shown);
  if (fresh?.first) list.push(fresh);
  const nearShown = atRest() ? [] : (S.nearAll ? S.nearShown : S.nearShown.slice(0, NEAR_SHOWN));
  const add = (n, near, fromLine) => {
    if (!fromLine) list.push({ kind: 'node', node: n, top: true, near });
    if (!S.dug.includes(n.uuid) || (!fromLine && S.lineDug === n.uuid)) return;
    if (relHolds(n.uuid)) return;   // its lines are Relations' own, walked with Relations' keys once the keyboard is in them
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
  if (fresh && !fresh.first) list.push(fresh);
  return list;
}

/* Drawing. The whole body is drawn again on each change, and nothing keeps state in the DOM; only the cursor stepping along
   the rows moves on its own (litRow), since after "show all" the rows can be thousands. */
/* A task's status circle, Logseq's own as Threads and Todo draw it (PluginDoor.statusHtml), before the words (15 November 2026,
   the owner: the rows of Find that are tasks show their circle). A press opens the status list Todo's circle opens (the
   library's menu, PluginDoor.menu): every status in Logseq's order with its icon, the one in force checked; what is picked is
   written at once, with the faded Undo arrow at the row. */
const readStatuses = async () => { try { S.statuses = new Map((await window.PluginDoor.statusChoices()).map(s => [s.id, s])); } catch (error) { console.error('Find: could not read the statuses', error); } };
const statusOf = node => (S.statusNow.has(node.uuid) ? S.statusNow.get(node.uuid) : node.status) || 0;
function circle(doc, node) {
  const s = S.statuses.get(statusOf(node));
  if (!s) return null;
  const t = doc.createElement('template');
  t.innerHTML = window.PluginDoor.statusHtml(s, { cls: 'fd-task', doc, attrs: ` data-task="${esc(node.uuid)}" title="${esc(s.title)}: click to set the status" aria-label="Status: ${esc(s.title)}"` });
  const button = t.content.firstElementChild;
  button.addEventListener('click', event => { event.stopPropagation(); openStatus(button, node); });
  // The keyboard stays in the one box: when the list closes (Escape) the focus it hands back to the circle goes on to the box.
  button.addEventListener('focus', () => { if (button.getAttribute('aria-expanded') !== 'true') S.dlg?.querySelector('.fd-input')?.focus(); });
  button.tabIndex = -1;
  return button;
}
function openStatus(from, node) {
  const now = statusOf(node), input = () => S.dlg?.querySelector('.fd-input')?.focus();
  // Logseq's own Set Status list, the one every circle opens (PluginDoor.pickStatus).
  window.PluginDoor.pickStatus(from, [...S.statuses.values()], s => s.id === now).then(s => { input(); if (s) setStatus(node, s.id); });
}
const STATUS = 'logseq.property/status';
const rowsOf = uuid => [...(S.dlg?.querySelectorAll(`.fd-r[data-uuid="${window.CSS.escape(uuid)}"] .fd-nm`) || [])];
async function setStatus(node, to) {
  const was = statusOf(node), uuid = node.uuid, Door = window.PluginDoor;
  if (to === was) return;
  const title = id => S.statuses.get(id)?.title || '';
  S.statusNow.set(uuid, to); render();
  let undo;
  try {
    await Door.write.setValue(uuid, STATUS, title(to));
    undo = await Door.write.guarded([[uuid, STATUS]], () => (was ? Door.write.setValue(uuid, STATUS, title(was)) : Door.write.unsetValue(uuid, STATUS)));
  } catch (error) {
    console.error('Find: the status could not be set', error);
    S.statusNow.set(uuid, was); render();
    return notify(`Not changed: ${Door.reason(error, 'Logseq did not take the status')}`, 'warning');
  }
  const words = node.text || node.raw || '', name = words.length > 40 ? words.slice(0, 38) + '…' : words;
  Door.undo.offer({ owner: 'find', key: `find:status:${uuid}`, node: uuid, text: `Set “${name}” to ${title(to)}`, at: () => rowsOf(uuid),
    run: async () => {
      S.statusNow.set(uuid, was); render();
      if (await undo() === 'kept') { notify('It has changed since, so it stays', 'warning'); S.statusNow.set(uuid, to); render(); }
    },
    onFail: error => { console.error('Find: could not undo', error); notify('The status could not be put back', 'warning'); S.statusNow.set(uuid, to); render(); } });
}
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
    const wrap = el(doc, 'div', { class: 'fd-choices lk-choices' });
    // No word over the lines: each is a label and the choices that narrow the list, and the gap under them tells
    // them from the rows.
    for (const g of groups) {
      const box = el(doc, 'div', { class: 'fd-ch lk-ch' });
      box.append(el(doc, 'span', { class: 'fd-ck lk-ck' + (g.key.startsWith('p:') ? ' lk-prop' : ''), html: g.icon ? `<span class="fd-icon lk-ck-icon">${g.icon}</span>` : '' }, g.key === 'kind' ? 'kind' : g.label));
      if (g.tree) { box.append(treeOf(doc, g, () => ci++, groups)); wrap.append(box); continue; }
      const vals = el(doc, 'span', { class: 'fd-cv lk-cv lk-views' });
      g.items.forEach((c, i) => {
        const at = ci++;
        const lit = (S.mode === 'choices' && at === S.choiceAt) || (S.mode !== 'choices' && litChoice(groups) === c);
        if (c.more) vals.append(el(doc, 'button', { class: 'fd-more lk-more' + (lit ? ' fd-lit' : ''), type: 'button', 'data-c': at, click: () => c.pick() }, c.label));
        else vals.append(el(doc, 'button', { class: 'fd-c lk-view' + (lit ? ' fd-lit lk-lit' : ''), type: 'button', 'data-c': at, title: c.hint || (c.label.length > 44 ? c.label : null), click: () => c.pick() }, short(c.label, 44), c.count == null ? null : el(doc, 'span', { class: 'fd-nb lk-nb' }, String(c.count))));
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
    const total = S.shown.length, limit = rowsShown(), tag = kindPick();
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
    if (r.kind === 'make') {
      const row = el(doc, 'div', { class: 'fd-r fd-make lk-row' + (on ? ' on' : ''), 'data-i': i });
      row.append(el(doc, 'span', { class: 'fd-day lk-day' }), el(doc, 'span', {}), el(doc, 'span', { class: 'fd-bul fd-sign', html: window.PluginDoor.logseqIconHtml('plus', { doc }) }));
      const nm = el(doc, 'span', { class: 'fd-nm' }, el(doc, 'span', { class: 'fd-w' }, r.name));
      if (S.host?.newKind) nm.append(el(doc, 'span', { class: 'lk-tag lk-coming' }, S.host.newKind.title));
      row.append(nm);
      row.addEventListener('click', () => makeAndLink(r.name));
      container = body; body.append(row); return;
    }
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
      if (part.uuid && part.status) { const c = circle(doc, { uuid: part.uuid, status: part.status, text: part.text }); if (c) { c.classList.add('fd-in'); w.append(c); } }
      if (part.uuid) w.append(el(doc, 'span', { class: 'lk-node', 'data-uuid': part.uuid, html: markWords(esc(part.text), ws), click: event => { event.stopPropagation(); openPage(part.uuid, event.shiftKey); close(); } }));
      else w.append(el(doc, 'span', { html: writtenHtml(part.text, ws) }));
    }
    w.addEventListener('click', event => {
      event.stopPropagation();
      // Past the last word (the words' holder itself, not a word in it): the caret goes into the words, for a bullet, as a press after them on the row does. In a narrow window the holder runs to the row's end, so this is where "after the last word" lies.
      if (event.target === w && !node.isPage && !node.sign && window.PluginDoor.answers('relations:editWords')) { window.PluginDoor.ask('relations:editWords', node.uuid, w).catch(() => {}); return; }
      openPage(node.uuid, event.shiftKey); close();
    });
    // The circle stands inside the words, so a long line wraps beside it and never drops under it.
    const task = circle(doc, node);
    if (task) w.prepend(task);
    nm.append(w);
    if (node.kind && !(r.under && rows.find(x => x.key === r.under)?.tag === node.kind.title) && !(kindPick() && r.top && kindPick().title === node.kind.title)) nm.append(el(doc, 'span', { class: 'lk-tag', 'data-tag-uuid': node.kind.uuid || '', 'data-tag-title': node.kind.title }, node.kind.title));
    // A found bullet holds what is under it folded: Look's ↳ line follows its words, as on Logseq's own folded bullets (16 November
    // 2026, the owner: in Linked and Find too). Opened in place, what it holds is shown, so no line.
    if (!node.isPage && !node.sign && !dug) nm.append(el(doc, 'span', { class: 'lk-held', 'data-lk-held': node.uuid }));
    row.append(nm);
    const right = node.page && !node.page.journal ? node.page.title : '';
    row.append(el(doc, 'span', { class: 'fd-right fd-page', ...(right ? { title: right } : {}) }, right));
    row.addEventListener('click', event => {
      // A press just after the row's last word puts the caret in its words, for a bullet (Relations changes them, asked through the door); anywhere else on the row it takes the cursor.
      const nm = event.target.closest('a, button, .fd-w, .lk-node, textarea') ? null : event.target.closest('.fd-nm');
      const words = nm ? row.querySelector('.fd-w') : null;
      if (words && node && !node.isPage && !node.sign && window.PluginDoor.answers('relations:editWords')) { event.stopPropagation(); window.PluginDoor.ask('relations:editWords', node.uuid, words).catch(() => {}); return; }
      S.mode = 'rows'; S.rowAt = i; render();
    });
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
    input.placeholder = S.picks.length ? '' : S.host ? 'link a page, or type' : 'pick a kind, or type';
    return;
  }
  input.placeholder = 'what, with whom, when';
  window.PluginDoor.sentence.mirror(mirror, S.typed, S.spans);
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
// A node's lane, by the first choice line's three values (others last), when the line is laid out in lanes.
function laneOfNode(nd, lanes = S.line === 2 ? laneProp() : null) {
  if (!lanes) return 0;
  const full = kindPick() && S.cache.kindFacets.get(kindPick().id), has = full?.byNode.get(nd.id);
  const i = lanes.values.slice(0, 3).findIndex(v => has?.has(lanes.name + '=' + v.key));
  return i < 0 ? 3 : i;
}
// What the timeline narrowed the rows to (16 November 2026, one timeline in Find and in Linked): a dot's week or a dragged span,
// and a lane's value. The line still shows every dot, faded outside what is kept.
const timeKeeps = nd => (!S.timePick || (nd.day && nd.day >= S.timePick[0] && nd.day <= S.timePick[1])) && (S.timeLane == null || laneOfNode(nd) === S.timeLane);
function drawLine(doc) {
  const box = S.dlg.querySelector('.fd-line');
  box.replaceChildren();
  box.classList.toggle('fd-off', isCommandMode());
  S.lineDots = [];
  if (!S.say || isCommandMode()) { S.line = 0; S.lineH = 52; setHeight(); return; }
  const when = atRest() ? null : whenPick();
  const dated = atRest() ? [] : [...S.shown.slice(0, 400).map(nd => ({ node: nd, near: false })), ...S.nearShown.slice(0, 400).map(nd => ({ node: nd, near: true }))].filter(d => d.node.day);
  /* Nothing found yet, or nothing with a day: the line still stands, empty and faint, over the last twelve months, so its place
     never shows as a blank band (16 November 2026, the owner: "looks weird without anything in empty space"). */
  if (!dated.length && !when) {
    S.line = 0; S.lineH = 52; S.lineDots = [];
    const t = new Date(), from = window.PluginDoor.dates.number(new Date(t.getFullYear(), t.getMonth() - 11, 1));
    box.insertAdjacentHTML('beforeend', window.PluginDoor.timeline.html({ key: 'find', from, label: 'The time of what will be found' }));
    box.firstElementChild?.classList.add('fd-time-empty');
    setHeight(); return;
  }
  const lanes = S.line === 2 ? laneProp() : null;
  if (S.line === 2 && !lanes) S.line = 1;
  if (!lanes) S.timeLane = null;
  // The dots in the order the arrows walk them: by day, a near one after a found one on the same day.
  dated.sort((a, b) => a.node.day - b.node.day || a.near - b.near);
  S.lineDots = dated.map(d => ({ ...d, lane: laneOfNode(d.node, lanes) }));
  if (S.lineStart) { S.lineStart = false; let at = S.lineDots.length - 1; while (at > 0 && S.lineDots[at].near) at--; S.lineAt = at; }
  S.lineAt = Math.max(0, Math.min(S.lineDots.length - 1, S.lineAt));
  const laneNames = lanes ? [...lanes.values.slice(0, 3).map(v => v.label), 'others'] : null;
  const html = window.PluginDoor.timeline.html({
    key: 'find', label: 'The time of what was found; drag across it to pick days',
    dots: S.lineDots.map(d => ({ day: d.node.day, lane: d.lane, near: d.near, title: d.node.text, off: !timeKeeps(d.node) })),
    lanes: laneNames && laneNames.map((name, i) => ({ name, count: S.lineDots.filter(d => !d.near && d.lane === i).length, on: S.timeLane === i, off: S.timeLane != null && S.timeLane !== i })),
    asked: when ? [when.from, when.to] : null, pick: S.timePick, tall: S.line > 0, at: S.mode === 'line' && S.line ? S.lineAt : null });
  box.insertAdjacentHTML('beforeend', html);
  if (S.line && laneProp()) box.append(el(doc, 'span', { class: 'fd-by lk-alts' },
    el(doc, 'span', { class: S.line === 2 ? '' : 'on', click: event => { event.stopPropagation(); setLine(1); } }, 'one lane'),
    el(doc, 'span', { class: S.line === 2 ? 'on' : '', click: event => { event.stopPropagation(); setLine(2); } }, 'by ' + laneProp().name)));
  // The line's height, as the library draws it: the labels above, a lane a row (60 px piled, 18 one line), the months under.
  S.lineH = 16 + (laneNames ? laneNames.length : 1) * (S.line ? (laneNames ? 40 : 60) : 18) + 18; setHeight();
  wireLine(box);
}
// The presses on the line, put on once: a dot narrows the rows to its week (again: all of them) and puts the cursor on it; a
// lane's name narrows to its value; a drag picks a span of days; a press elsewhere on the folded strip opens it.
function wireLine(box) {
  if (box.dataset.wired) return;
  box.dataset.wired = '1';
  let drag = null;
  const T = window.PluginDoor.timeline;
  box.addEventListener('mousedown', event => { const track = event.button === 0 && !event.target.closest('.lk-time-dot') && event.target.closest('.lk-time-track'); if (track) drag = { track, x: event.clientX, from: T.dayAt(track, event.clientX), moved: false }; });
  box.ownerDocument.addEventListener('mousemove', event => {
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 5) return;
    drag.moved = true; const to = T.dayAt(drag.track, event.clientX);
    S.timePick = [Math.min(drag.from, to), Math.max(drag.from, to)]; render();
    drag.track = box.querySelector('.lk-time-track') || drag.track;
  });
  box.ownerDocument.addEventListener('mouseup', () => { if (drag?.moved) box.dataset.dragged = '1'; drag = null; setTimeout(() => { delete box.dataset.dragged; }, 0); });
  box.addEventListener('click', event => {
    event.preventDefault();
    if (box.dataset.dragged) return;
    const dot = event.target.closest('.lk-time-dot'), lane = event.target.closest('.lk-time-lane');
    if (lane) { const i = Number(lane.dataset.lane); S.timeLane = S.timeLane === i ? null : i; render(); return; }
    if (dot) {
      const day = Number(dot.dataset.day), p = S.timePick;
      S.timePick = p && day >= p[0] && day <= p[1] ? null : T.week(day);
      if (S.line) { S.mode = 'line'; S.lineAt = Number(dot.dataset.i); }
      render(); return;
    }
    if (!S.line) setLine(1);
  });
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
  const tree = el(doc, 'span', { class: 'fd-cv lk-cv fd-tree' });
  for (let col = 0; col < g.tree; col++) {
    const box = el(doc, 'span', { class: 'fd-col' });
    for (const c of g.items.filter(x => x.col === col)) {
      if (c.head) box.append(el(doc, 'span', { class: 'fd-th' }, c.head));
      const at = next();
      const lit = S.mode === 'choices' && at === S.choiceAt;
      box.append(el(doc, 'button', { class: 'fd-c lk-view' + (c.depth ? '' : ' fd-top') + (lit ? ' fd-lit lk-lit' : ''), type: 'button', 'data-c': at, style: `--fd-depth: ${Math.max(0, c.depth - 1)}`, title: c.label.length > 30 ? c.label : null, click: () => c.pick() }, short(c.label, 30), el(doc, 'span', { class: 'fd-nb lk-nb' }, String(c.count))));
    }
    tree.append(box);
  }
  return tree;
}
function drawFoot(groups, rows) { S.dlg.querySelector('.fd-foot').replaceChildren(...foot(S.doc, groups, rows)); showComing(groups); }
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
/* Words as written (16 November 2026, the owner: "show the bullet and md preview like it was written"): line breaks, **bold**,
   *italic*, ~~struck~~, ==marked== and `code` drawn by DB Export's reader (window.DbExport.inline, as Linked's lines); a web address
   is a link out with ↗ after it (the door's webParts, urlHtml). */
function writtenHtml(text, ws) {
  const Door = window.PluginDoor, inline = window.DbExport?.inline;
  const plain = t => Door.webParts(t).map(p => p.url ? Door.urlHtml(p.url, markWords(esc(p.text), ws)) : markWords(esc(p.text), ws)).join('');
  if (!inline) return plain(text);
  const go = list => list.map(tok => {
    switch (tok.t) {
      case 'text': return plain(tok.s);
      case 'br': return '<br>';
      case 'code': return `<code>${esc(tok.s)}</code>`;
      case 'strong': return `<strong>${go(tok.k)}</strong>`;
      case 'em': return `<em>${go(tok.k)}</em>`;
      case 'strike': return `<s>${go(tok.k)}</s>`;
      case 'mark': return `<mark>${go(tok.k)}</mark>`;
      case 'math': return esc(tok.s);
      case 'link': return Door.urlHtml(tok.url, go(tok.k));
      case 'page': return tok.k ? go(tok.k) : markWords(esc(tok.name), ws);
      case 'tag': return markWords(esc('#' + tok.name), ws);
      case 'cite': return `(${go(tok.k)}${tok.page ? `, p. ${esc(tok.page)}` : ''})`;
      case 'image': return esc(tok.alt || '');
      default: return '';
    }
  }).join('');
  return go(inline.parse(text)).replace(/ +(<br>)/g, '$1');
}
function markWords(html, ws) {
  if (!ws.length) return html;
  const pattern = new RegExp('(' + ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return html.split(/(&[a-z#0-9]+;|<[^>]+>)/i).map((piece, i) => i % 2 ? piece : piece.replace(pattern, '<b>$1</b>')).join('');
}
// A node opened in place: its properties as name and value, the groups follow as rows of the list.
function dugBox(doc, node) {
  // Relations draws the node where it runs (relHolds): the holder is all Find puts here.
  if (relHolds(node.uuid)) return el(doc, 'div', { class: 'fd-kids fd-node', 'data-dug': node.uuid, 'data-th-node': node.uuid });
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
// A property the icon of what it holds; a page and a tag Logseq's own icon, as the library draws it (PluginDoor.signHtml: the diamond under Look's calm theme).
const signHtml = node => node.sign === 'property' ? kindIconHtml(node.propType) : window.PluginDoor.signHtml(node.sign);
const short = (text, max = 36) => { const t = String(text || '').trim(); return t.length > max ? t.slice(0, max - 2).replace(/\s+\S*$/, '') + '…' : t; };
/* The key beside what it does, in Logseq's key caps (Door.keyCaps), as Logseq's menus and the plugin's draw a key (the owner, 18 November
   2026: the keys in Find's foot looked too much like the words for what they do): the action in words, the key in its cap. "Shift Enter" is
   one press of two keys; "← → ↑ ↓" four keys, a cap each. */
const capsOf = k => k === 'Shift Enter' ? window.PluginDoor.keyCaps('shift+enter') : k.split(' ').map(part => window.PluginDoor.keyCaps(part)).join(' ');
const KEY = (k, label) => `<span>${label}<span class="fd-k">${capsOf(k)}</span></span>`;
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
  if (S.mode === 'choices' && lit?.does) { add(KEY('Enter', `<b>${esc(lit.does)}</b>`)); add(KEY('Escape', 'back to the rows')); }
  else if (S.mode === 'choices') { add(KEY('Tab', lit.more ? 'show more' : `narrow to ${esc(lit.label)}`)); add(KEY('← → ↑ ↓', 'choose')); add(KEY('Escape', 'back to the rows')); if (groupOf(groups, S.choiceAt) === 0 && canLine()) add(KEY('↑', 'the line')); }
  else {
    if (lit) add(KEY('Tab', `narrow to ${esc(lit.label)}`)); else if (choices.length) add(KEY('Tab', groups[0]?.key === 'newkind' ? 'its kind' : groups[0]?.key === 'tagme' ? 'tag it' : 'narrow'));
    if (cur?.kind === 'make') add(KEY('Enter', `<b>make ${esc(short(cur.name))}${S.host?.newKind ? `, a ${esc(S.host.newKind.title)},` : ''} and link it</b>`));
    else if (cur?.kind === 'node' && S.host) add(KEY('Enter', `<b>link ${esc(short(cur.node.text))}</b>`));
    else if (cur?.kind === 'node') { add(KEY('Enter', `open ${esc(short(cur.node.text))}`)); add(KEY('Shift Enter', 'in the sidebar')); }
    else if (cur?.kind === 'group') add(KEY('Enter', `open the ${cur.count}`));
  }
  /* The sentence's own key, said and pressable, in the plain window (16 November 2026, the owner: "put a shortcut in the find
     window"): a press or ⌥⌘K turns this window into Find by sentence, with its timeline. */
  // The panel's way to the window: Cmd K, said at the foot's right end where the window says By sentence.
  const wide = () => items.concat(el(doc, 'span', { class: 'fd-say-way' }, el(doc, 'button', { class: 'lk-btn lk-low', type: 'button', title: 'The Find window, with these letters', click: () => widen() }, 'Find window', el(doc, 'span', { class: 'fd-k', html: window.PluginDoor.keyCaps(setting('takesSearchKey') !== false ? 'mod+k' : 'mod+shift+k') }))));
  const way = () => S.host ? wide() : S.say ? items : items.concat(el(doc, 'span', { class: 'fd-say-way' }, el(doc, 'button', { class: 'lk-btn lk-low', type: 'button', title: 'Find by sentence, with its timeline', click: () => sentence() }, 'By sentence', el(doc, 'span', { class: 'fd-k', html: window.PluginDoor.keyCaps('mod+alt+k') }))));
  if (atRest()) return way();
  if (cur?.kind === 'node' && cur.top) { if (S.dug.includes(cur.node.uuid)) { add(KEY('→', 'into it')); add(KEY('←', 'close')); } else add(KEY('→', 'dig')); }
  if (cur?.kind === 'group') add(KEY(S.openGroups.has(cur.key) ? '←' : '→', S.openGroups.has(cur.key) ? 'close' : 'open'));
  if (!S.say && S.picks.length && !S.typed) add(KEY('Backspace', `take ${esc(S.picks[S.picks.length - 1].title || S.picks[S.picks.length - 1].label)} off`));
  if (canMake() && !S.host) { const name = S.typed.trim(); items.push(el(doc, 'span', { class: 'fd-right' }, el(doc, 'button', { class: 'lk-btn lk-low lk-i-plus', type: 'button', title: 'Make a page with these words as its name', click: () => makePage(name) }, `make a page “${name}”`, el(doc, 'span', { class: 'fd-k', html: window.PluginDoor.keyCaps(makesPage(rows) ? 'enter' : 'mod+enter') })))); }
  return way();
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
  try { await Find.commands.run(r); } catch (error) { notify(`Logseq did not run “${r.label}”`, 'warning'); }
}
async function makePage(name) {
  if (S.making) return;
  S.making = true;
  try { const uuid = await db.makePage(name); close(); if (!uuid) notify('The page was not made', 'warning'); }
  catch (error) { notify('The page was not made: ' + window.PluginDoor.reason(error, 'Logseq did not take the name'), 'warning'); }
  finally { S.making = false; }
}
// Words typed that the sentence did not read, and no kind: a page can be made of them, whatever is listed, with Cmd Enter (Ctrl elsewhere).
const canMake = () => !!words().length && !kindPick() && !isCommandMode();
// With no rows at all, making a page is the one thing offered, so Enter does it; never in the sentence, where Enter opens and
// Cmd Enter makes (10 November 2026, the owner: a whole sentence that found nothing became a page on a plain Enter).
const makesPage = rows => !S.say && !rows.length && canMake() && !S.loading && !S.failed;
// Down past the last row of a list shows the rest of that list.
function showRest(rows) {
  const cur = rows[S.rowAt], next = rows[S.rowAt + 1];
  if (cur?.under && next?.under !== cur.under && !S.groupAll.has(cur.under) && rows.find(r => r.key === cur.under)?.count > 3) { S.groupAll.add(cur.under); return true; }
  if (isCommandMode() || atRest()) return false;
  if (cur?.near) { if (next || S.nearAll || S.nearShown.length <= NEAR_SHOWN) return false; return S.nearAll = true; }
  if ((next && !next.near) || S.allShown || S.shown.length <= rowsShown()) return false;
  return S.allShown = true;
}
// Enter takes what is on screen; pressed while the letters are being read, it waits for what they find.
function takeEnter(shift) {
  const groups = choiceGroups(), rows = rowList();
  if (S.mode === 'choices') { flatChoices(groups)[S.choiceAt]?.pick(); return; }
  if (S.mode === 'line') { const d = S.lineDots[S.lineAt]; if (d) { openPage(d.node.uuid, shift); close(); } return; }
  if (S.host) { const r = rows[S.rowAt]; if (r?.kind === 'group') return toggleGroup(r); if (r?.kind === 'make') return makeAndLink(r.name); if (r?.kind === 'node') linkRow(r); return; }   // the panel links; a new name is made there in its own step
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
    if (S.timeLane != null) { S.timeLane = null; render(); return; }
    if (S.timePick) { S.timePick = null; render(); return; }
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
      // → on a node already open goes into it: its first line, the caret at the end (items 1–10, item 6: no key led from the find
      // line into an opened node). Escape there comes back to the find line.
      if (open === true && right && cur.kind === 'node') { take(); intoNode(cur.node.uuid); return; }
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

/* typing: a letter came. Only the find line is drawn at once; the list stays exactly as it stands, at full strength, until
   what the new letters find has been read, and is then drawn once. Nothing fades and nothing is redrawn between two letters. */
function refresh(typing) {
  clearTimeout(S.timer);
  S.loading = true;
  const at = ++S.reads;
  if (typing && S.dlg) drawSentence(S.doc); else render();
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
  S.typed = input.value; S.typedAt = Date.now();
  S.enter = null;
  S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false; S.nearAll = false;
  if (S.lineDug) { S.dug = S.dug.filter(u => u !== S.lineDug); S.lineDug = null; }
  readNow();
  refresh(true);
}

/* Opening and closing. open(typed, say): the window with those letters already in the find line (">" for the commands); say, as
   a sentence. */
function open(typed = '', say = false, panel = null) {
  const doc = host();
  close();
  S.host = panel;
  S.say = !!say && !panel;
  S.commands = null;
  /* The graph changed since the last opening: the kinds, their tree and the recent pages read before are shown at once and read
     again behind the window, which is drawn again when they answer. Emptied here, the window stood blank for about a tenth of a
     second on every such opening (recorded 12 November 2026: frames 96 to 187 ms empty). */
  if (S.stale) { S.stale = false; S.again = { kinds: S.kinds.length > 0, tree: !!S.tree, recents: S.recents.length > 0 }; S.pages = null; S.dugData.clear(); S.pointers.clear(); S.noteOf.clear(); }
  style('find', CSS);
  const dlg = panel ? el(doc, 'dialog', { class: 'fd lk-pop fd-own fd-panel', 'aria-label': 'Link from here', 'data-editor-popup-ref': 'find-panel' })
    : el(doc, 'dialog', { class: 'fd lk-window fd-own ' + (setting('windowPlace') === 'centred' ? 'fd-centred' : 'fd-high') + (S.say ? ' fd-say' : ''), 'aria-label': S.say ? 'Find by sentence' : 'Find' });
  const find = el(doc, 'div', { class: 'fd-find' });
  const sentence = el(doc, 'div', { class: 'fd-sentence' });
  const mirror = el(doc, 'div', { class: 'fd-mirror', 'aria-hidden': 'true' });
  const input = el(doc, 'input', { class: 'fd-input', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: panel ? 'link a page, or type' : S.say ? 'what, with whom, when' : 'pick a kind, or type' });
  input.addEventListener('input', onInput);
  input.addEventListener('scroll', () => { mirror.scrollLeft = input.scrollLeft; });
  sentence.append(mirror, input);
  find.append(sentence);
  dlg.append(find, el(doc, 'div', { class: 'fd-line' }), el(doc, 'div', { class: 'fd-body' }), el(doc, 'div', { class: 'fd-foot' }));
  // The keys are taken at the document, before Logseq's own handlers see them (a Tab that reached Logseq first never
  // came back); only keys from inside the window are taken.
  S.keys = Find.kit.listen(doc, 'keydown', event => {
    if (S.dlg !== dlg || !dlg.contains(event.target) || event.target.closest?.('.lk-door-menu')) return;
    /* Undo and Redo from the find line undo the last change made to a node in this window, as on the node's own page (the actions
       walk, 21 November 2026: Cmd+Z took a letter off the find line and the node kept its new words). Only while nothing was typed in
       the find line since that change: then the keys are the line's own again. */
    if (event.target === input && (isMac ? event.metaKey : event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'z' && (S.changedAt || 0) > (S.typedAt || 0)) {
      event.preventDefault(); event.stopPropagation();
      undoNode(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    // Inside an opened node the keys are Relations' (a bullet being written, a list of values); Escape outside a field there comes back to the find line.
    if (inNode(event.target)) { if (event.key === 'Escape' && !event.target.closest?.('input, textarea, [contenteditable="true"], [popover]')) { event.preventDefault(); event.stopPropagation(); input.focus(); } return; }
    onKey(event);
  }, true);   // the status list keeps its own keys   // what takes the listener off again
  for (const type of ['keyup', 'keypress']) dlg.addEventListener(type, event => event.stopPropagation());
  dlg.addEventListener('click', event => { if (!inNode(event.target)) input.focus(); }, true);   // whatever was pressed, the keyboard stays in the one box, but for a press inside an opened node, which is written in where it stands
  dlg.addEventListener('click', event => { if (event.target === dlg) close(); });
  // A row right-clicked: the node's menu, the same as in Todo and Relations (PluginDoor.nodeMenu), with Open here for the node in place.
  dlg.addEventListener('contextmenu', event => {
    if (inNode(event.target)) return;
    const row = event.target.closest?.('.fd-r[data-uuid]');
    if (!row) return;
    event.preventDefault(); event.stopPropagation();
    // The tag after the row: the tag's own menu, as on a bullet's tag (the thirteen proposals, 8; PluginDoor.tagMenu).
    const tagEl = event.target.closest?.('.lk-tag[data-tag-title]');
    if (tagEl) { window.PluginDoor.tagMenu(tagEl, row.dataset.uuid, { uuid: tagEl.dataset.tagUuid, title: tagEl.dataset.tagTitle }).then(ok => { if (!ok) (row.querySelector('.fd-w') || row).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY })); }); return; }   // a tag of Logseq's own: the row's menu
    const uuid = row.dataset.uuid, ti = id => window.PluginDoor.logseqIconHtml(id, { doc });
    window.PluginDoor.nodeMenu(row.querySelector('.fd-w') || row, uuid, {
      open: sidebar => { close(); if (sidebar) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid }); },
      extra: S.dug.includes(uuid) ? [] : [{ word: 'Open here', icon: ti('chevron-down'), take: () => toggleDig({ uuid }) }],
      changed: () => { if (S.dlg) { refresh(); render(); } },
      // Add property… and Add a line work on the node opened in place, as in Relations: it opens here first if it is not open.
      property: () => { inPlace(uuid).then(at => at && window.PluginDoor.ask('relations:addProp', uuid, at)); },
      newLine: () => { inPlace(uuid).then(at => at && window.PluginDoor.ask('relations:newLine', uuid, at)); },
    });
  });
  // The keyboard never falls out of the window: a field of an opened node that ends (Enter, Escape, a list picked) gives it back to the find line.
  /* A bullet of an opened node that ends with Enter makes the next bullet, whose field comes a moment later (the node is read again
     first): the find line waits for it, or the words typed meanwhile went into the search (the actions walk, 21 November 2026). */
  dlg.addEventListener('focusout', event => {
    const fromNode = inNode(event.target);
    if (fromNode) { S.held = ''; S.holding = true; }
    setTimeout(() => {
      if (S.dlg !== dlg) return;
      const at = doc.activeElement;
      if (!at || at === doc.body || !dlg.contains(at)) { input.focus({ preventScroll: true }); if (S.holding && S.held) { input.value += S.held; onInput(); } }
      S.holding = false; S.held = '';
    }, fromNode ? 900 : 0);
  });
  // What is typed while the next bullet is being made is held, and written into that bullet when its field comes.
  doc.addEventListener('keydown', S.holdKeys = event => {
    if (S.dlg !== dlg || !S.holding) return;
    const at = doc.activeElement;
    if (at && at !== doc.body && at !== dlg && dlg.contains(at)) return;
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault(); event.stopPropagation();
    S.held += event.key;
  }, true);
  dlg.addEventListener('focusin', event => {
    if (!S.holding || !inNode(event.target) || !/^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
    const held = S.held; S.holding = false; S.held = '';
    if (held) setTimeout(() => doc.execCommand('insertText', false, held), 0);
  });
  // A name pressed inside an opened node goes to its page: the window closes with the page it stood over.
  const win = doc.defaultView;
  dlg.addEventListener('click', event => { if (!event.target.closest?.('[data-th-node]')) return; const was = win?.location.hash; setTimeout(() => { if (S.dlg === dlg && win?.location.hash !== was) close(); }, 350); }, true);
  dlg.addEventListener('close', () => { if (S.dlg === dlg) S.dlg = null; dlg.remove(); });
  // One height from the opening, whatever is listed: the foot and the bottom edge stay put, and a longer list scrolls. It
  // leaves room for the rows shown before "show all", under three lines of choices.
  doc.body.appendChild(dlg);
  S.dlg = dlg; S.doc = doc;
  Object.assign(S, { typed, typedAt: 0, changedAt: 0, picks: [], spans: [], words: [], trail: [], trailFrom: typed.length, mode: 'rows', rowAt: 0, choiceAt: 0, allShown: false, nearAll: false, dug: [], failed: '', enter: null, near: [], nearShown: [], line: 0, lineAt: 0, lineDots: [], lineDug: null, lineH: 52 });
  setHeight();
  S.moreOf.clear(); S.openGroups.clear(); S.groupAll.clear();
  // The window dims the page and takes every key; the panel stands on the page, which stays as it is under it.
  if (panel) {
    if (typeof dlg.show === 'function') dlg.show(); else dlg.setAttribute('open', '');
    // A press anywhere else lets the panel go; the window resized, it is placed again.
    const away = event => { if (S.dlg === dlg && !dlg.contains(event.target) && !event.target.closest?.('.lk-door-menu, .lk-pop, [popover]')) close(); };
    doc.addEventListener('pointerdown', away, true);
    const moved = () => { if (S.dlg === dlg) place(); };
    doc.defaultView.addEventListener('resize', moved);
    S.hostOff = () => { doc.removeEventListener('pointerdown', away, true); doc.defaultView.removeEventListener('resize', moved); };
  } else if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  input.focus();
  S.statusNow.clear();
  readStatuses().then(() => { if (S.dlg === dlg) render(); });
  readNow();
  refresh();
}
// Into the node opened under its row: its first line written in, or a new line where it has none (Relations' copy draws it).
async function intoNode(uuid) {
  const at = await inPlace(uuid);
  if (at) window.PluginDoor.ask('relations:editLine', uuid, at);
}
// The node opened in place under its row (opened now if it was not), once Relations has drawn it: its holder, or null.
async function inPlace(uuid) {
  if (!S.dug.includes(uuid)) await toggleDig({ uuid });
  for (let i = 0; i < 40; i++) {
    const at = S.dlg?.querySelector(`.fd-kids[data-dug="${window.CSS.escape(uuid)}"] .th-ol-kids`);
    if (at) return at;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}
// Logseq's own Undo (or Redo), then the rows read the graph again, and the Undo arrows Find offered go, as their change is undone.
async function undoNode(which) {
  try { await logseq.App.invokeExternalCommand(`logseq.editor/${which}`); }
  catch (error) { console.error('Find: Logseq could not ' + which, error); return; }
  window.PluginDoor.undo.clear('find');
  S.statusNow.clear();
  await readStatuses();
  if (S.dlg) { refresh(); render(); }
}
function close() {
  if (!S.dlg) return;
  const d = S.dlg; S.dlg = null;
  if (S.keys) { S.keys(); S.keys = null; }
  if (S.holdKeys) { S.doc?.removeEventListener('keydown', S.holdKeys, true); S.holdKeys = null; S.holding = false; }
  window.PluginDoor.menu.close();
  try { d.close(); } catch (error) { /* not open */ }
  d.remove();
  // The panel gone: the caret is where it was in the line, the letters it stood between untouched.
  const h = S.host; S.host = null;
  h?.coming?.remove();
  if (S.hostOff) { S.hostOff(); S.hostOff = null; }
  if (h && !h.left) backToLine(h);
}
function backToLine(h, at = null) {
  const { box } = h, start = at ?? h.start, end = at ?? h.end;
  if (box?.isConnected) { box.focus({ preventScroll: true }); try { box.setSelectionRange(start, end); } catch (error) { /* the words changed under it */ } }
  else if (h.uuid) Promise.resolve(logseq.Editor.editBlock(h.uuid, { pos: start })).catch(() => {});
}
// A link put right after a letter gets a space before it (Logseq drops a line's last space when the line is opened again).
const spaced = (h, text) => (h.start > 0 && /[\p{L}\p{N}.,;:!?)]/u.test(h.box.value[h.start - 1] || '') ? ' ' : '') + text;
// What Enter does in the panel: the lit row is linked at the caret, as one change Cmd+Z takes back.
function linkRow(r) {
  const h = S.host; if (!h || r?.kind !== 'node') return;
  h.left = true; close();
  if (!h.box?.isConnected) return;
  const text = spaced(h, `[[${r.node.isPage ? r.node.text : r.node.uuid}]]`);
  h.box.focus({ preventScroll: true });
  window.PluginDoor.screen.insert(h.box, text, h.start, h.end);
  backToLine(h, h.start + text.length);
}
/* A new name taken: the page is made, given its kind, and linked at the caret. One Undo takes the link out again and drops the page
   while nothing was written on it (the library's dropMade), as Predictive's new page goes. */
async function makeAndLink(name) {
  const h = S.host; if (!h || S.making) return;
  const kind = h.newKind || null, D = window.PluginDoor, text = h.box?.isConnected ? spaced(h, `[[${name}]]`) : `[[${name}]]`;
  S.making = true; h.left = true; close();
  try {
    const page = await D.write.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!page?.uuid) throw new Error('Logseq did not make the page');
    if (kind) await D.write.addTag(page.uuid, kind.uuid);
    if (h.box?.isConnected) { h.box.focus({ preventScroll: true }); D.screen.insert(h.box, text, h.start, h.end); backToLine(h, h.start + text.length); }
    D.undo.offer({ owner: 'find', key: `find:made:${page.uuid}`, node: h.uuid || page.uuid, text: `Made “${name}”${kind ? ', a ' + kind.title : ''}`, at: () => null,
      run: async () => {
        const box = h.box;
        // The link goes first, and the line is given a moment to be saved without it: a page still linked is not untouched.
        if (box?.isConnected && box.value.slice(h.start, h.start + text.length) === text) { box.focus({ preventScroll: true }); D.screen.insert(box, '', h.start, h.start + text.length); box.setSelectionRange(h.start, h.start); await new Promise(r => setTimeout(r, 1200)); }
        const went = await D.write.dropMade(page);
        if (!went) notify(`“${name}” has been written on since, so it stays`, 'warning');
      } });
  } catch (error) { notify('The page was not made: ' + D.reason(error, 'Logseq did not take the name'), 'warning'); backToLine(h); }
  finally { S.making = false; }
}
// The panel on the line a box is writing: its caret kept for the way back.
function panel(box) {
  if (!box || box.tagName !== 'TEXTAREA' || setting('panel') === false) return false;
  const D = window.PluginDoor, dlgNow = () => S.dlg;
  // The bullet's tags, when Predictive runs: asked as the panel opens, drawn when they answer (nothing moves: the line is kept for them).
  if (D.answers?.('predictive:tagChoices')) Promise.resolve(D.ask('predictive:tagChoices', box)).then(tags => { if (S.host?.box === box && dlgNow() && Array.isArray(tags) && tags.length) { S.host.tags = tags; render(); } }).catch(() => {});
  // The kinds a new name here is likely to be, from the lines written before (Predictive, core/newkind.js): the clear one comes lit.
  if (D.answers?.('predictive:kindsFor')) Promise.resolve(D.ask('predictive:kindsFor', box.value.slice(0, box.selectionStart))).then(kinds => { if (S.host?.box === box && dlgNow() && Array.isArray(kinds) && kinds.length) { S.host.kinds = kinds; S.host.newKind = kinds.find(k => k.lit) || null; render(); } }).catch(() => {});
  open('', false, { box, start: box.selectionStart, end: box.selectionEnd, uuid: box.closest('.ls-block')?.getAttribute('blockid') || null });
  return true;
}
// The tag a choice would give, shown coming (green) at the line's right end while the choice is lit, before anything is written.
function showComing(groups) {
  const h = S.host; if (!h) return;
  const lit = S.mode === 'choices' ? flatChoices(groups)[S.choiceAt] : null, word = lit?.coming || '';
  if (!word) { h.coming?.remove(); h.coming = null; return; }
  if (!h.box?.isConnected) return;
  const r = h.box.getBoundingClientRect();
  if (!h.coming) { h.coming = el(S.doc, 'span', { class: 'fd-coming lk-tag lk-coming', 'aria-hidden': 'true' }); S.doc.body.append(h.coming); }
  h.coming.textContent = word;
  Object.assign(h.coming.style, { top: Math.round(r.top) + 'px', right: Math.round(S.doc.defaultView.innerWidth - r.right) + 'px', lineHeight: Math.round(Math.min(r.height, 28)) + 'px' });
}
// The lit tag taken: Predictive gives it, with its own Undo, and the caret is back in the line.
async function tagLine(i) {
  const h = S.host; if (!h) return;
  close();
  const ok = await Promise.resolve(window.PluginDoor.ask('predictive:tagTake', h.box, i)).catch(() => false);
  if (ok !== true) notify('The tag could not be given', 'warning');
}
// Cmd K from the panel: the window, with the same letters.
function widen() { const typed = S.typed, h = S.host; if (h) h.left = true; close(); open(typed); }
const toggle = () => (S.dlg ? (S.host ? widen() : close()) : open());
// The sentence's own key: open as a sentence; pressed while one is open, it closes; from the pieces it turns to a sentence.
const sentence = () => { if (S.host) { S.host.left = true; close(); return open('', true); } if (S.dlg && S.say) return close(); if (S.dlg) { S.picks = []; S.typed = ''; S.say = true; S.dlg.classList.add('fd-say'); setHeight(); S.dlg.querySelector('.fd-input').placeholder = 'what, with whom, when'; said(); return; } open('', true); };
// The commands' key: open with > typed; pressed while the commands are listed, it closes; from anything else it turns to them.
function commands() {
  if (S.host) { S.host.left = true; close(); return open('>'); }
  if (S.dlg && isCommandMode()) return close();
  if (!S.dlg) return open('>');
  S.typed = '>'; S.picks = []; S.mode = 'rows'; S.rowAt = 0; S.dug = []; readNow(); refresh(); S.dlg.querySelector('.fd-input')?.focus();
}
// The graph changed: what was read is read again next time. What an open window shows stays until the next opening.
// Another graph (whole): what was read is another graph's, so nothing of it is shown again.
function forget(whole = false) { if (S.dlg) S.changedAt = Date.now(); S.cache.kind.clear(); S.cache.kindFacets.clear(); S.cache.counted.clear(); S.cache.words.clear(); S.stale = true; if (whole) { S.kinds = []; S.tree = null; S.recents = []; S.pages = null; } db.forget(); }

/* Read once, a moment after the plugin starts, what the window shows with nothing typed (the kinds, their tree, the recent pages),
   so the first opening has them: without it the first window of a session stood empty for about a tenth of a second. */
async function warm() { try { if (!S.kinds.length) S.kinds = await db.kinds(); if (!S.tree) S.tree = await db.kindTree(); if (!S.recents.length) S.recents = await db.recents(); } catch (error) { /* the window reads them itself when it opens */ } }
/* The window opened on one kind, picked as if chosen from its list (the thirteen proposals, 9: "Show its nodes" leads to Find; the
   owner's go of 19 November 2026). kind: { uuid } or { title }. The kinds are read first when the window has none yet. Asked through
   the door as find:kind, so Ontology's and a tag's menus open it without knowing Find. */
async function openKind(kind = {}) {
  if (!S.kinds.length) { try { S.kinds = await db.kinds(); } catch (error) { /* the window reads them itself */ } }
  const norm = window.PluginDoor.sentence.norm;
  const k = S.kinds.find(x => (kind.uuid && x.uuid === kind.uuid) || (kind.title && norm(x.title) === norm(kind.title)));
  open('', false);
  if (k) addPick({ kind: 'tag', id: k.id, uuid: k.uuid, title: k.title });
  return !!k;
}
Find.window = { open, openKind, panel, close, toggle, sentence, commands, forget, warm, state: S };
})();
