/* The window: find, then walk. One real dialog in Logseq's document. On top the find line, a row of pieces: each pick as
   the thing it is (a tag in mono, a node with its mark, a month in grey) and, after the last, the letters being typed.
   Under it the choices the graph holds for what is left (the kinds; inside a kind, its properties with their values and
   the months), then the rows: the grammar's row (day, chevron, bullet, name, tag), the chevron opening a node in place
   with its properties and what points at it. Every key has one job (docs/ALTERNATIVES.html, "All of it from the
   keyboard"). Nothing here reads the graph but through Find.db; the look of a row, a node, a tag and a day is Look's. */
(function () {
const Find = window.Find;
const { host, el, esc, style, kindIconHtml, dragBand, openPage, notify } = Find.kit;
const db = Find.db;

const FRAME = 220, ROW = 28;   // the find line, the foot, three lines of choices and "show all"; a row
const CSS = `
.fd { --fd-quiet: var(--lk-quiet); --fd-faint: var(--lk-faint); --fd-hair: var(--lk-hair); --fd-line: var(--lk-line); --fd-wash: var(--lk-wash);
  --fd-ring: color-mix(in srgb, currentColor 11%, transparent); --fd-mono: var(--lk-mono);
  position: fixed !important; left: 50% !important; right: auto !important; transform: translateX(-50%); margin: 0 !important; width: min(900px, 92vw); max-height: 78vh;
  box-sizing: border-box; padding: 0; border: 1px solid var(--fd-hair); border-radius: 8px; display: flex; flex-direction: column;
  background: var(--lk-paper, #fff); color: var(--lk-text, #222); font-size: 14px; line-height: 1.5;
  box-shadow: 0 10px 30px rgba(0,0,0,.14); }
.fd:not([open]) { display: none; }
.fd.fd-high { top: max(10vh, 60px) !important; bottom: auto !important; }
.fd.fd-centred { top: 50% !important; bottom: auto !important; transform: translate(-50%, -50%); }
.fd::backdrop { background: rgba(0,0,0,.12); }
.fd * { box-sizing: border-box; }
/* The find line: the pieces, then the letters. */
.fd-find { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; padding: 11px 16px; border-bottom: 1px solid var(--fd-hair); font-size: 16px; cursor: text; }
.fd-piece { display: inline-flex; align-items: baseline; gap: 5px; position: relative; }
/* A pick's ×, lk-x, only under the pointer: until then it takes no room. */
.fd-piece .fd-x { transition: opacity .12s; }
.fd-piece:not(:hover) .fd-x:not(:focus-visible) { opacity: 0; width: 0; padding: 0; overflow: hidden; }
.fd-piece .lk-tag { font-size: 14px !important; }
.fd-piece .fd-month { color: var(--fd-quiet); }
.fd-sep { color: var(--fd-faint); }
.fd-input { all: unset; flex: 1 1 60px; min-width: 60px; font: inherit; color: inherit; background: none; border: 0; outline: none; padding: 0; }
.fd-input::placeholder { color: var(--fd-faint); }
/* The body scrolls; the choices sit above the rows, a gap of one line between them. A property's name here stays a shade
   lighter than its values, which are quiet. */
.fd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 10px; transition: opacity .1s; }
.fd-body.fd-reading { opacity: .5; transition: opacity .15s ease .25s; }
.fd-head { font-size: 12px; color: var(--fd-faint); letter-spacing: .03em; margin: 6px 0 2px; }
.fd-ch { display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 2px 10px; font-size: 13px; padding: 2px 0 6px; align-items: baseline; }
.fd-choices { padding-bottom: 14px; }
.fd-head-rows { margin-top: 8px; }
.fd-ck { color: var(--fd-faint); display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-cv { display: flex; gap: 0 10px; flex-wrap: wrap; color: var(--fd-quiet); }
.fd-c { all: unset; cursor: pointer; display: inline-flex; align-items: baseline; gap: 3px; padding: 0 4px; margin: 0 -4px; border-radius: 3px; }
.fd-c:hover { color: inherit; }
/* A number stands only on the choice that is lit or pointed at; its room is kept, so nothing moves when it comes. */
.fd-c .fd-nb { color: var(--fd-faint); font-size: 12px; font-variant-numeric: tabular-nums; visibility: hidden; }
.fd-c:hover .fd-nb, .fd-c.fd-lit .fd-nb { visibility: visible; }
.fd-c.fd-lit { color: inherit; }
.fd-cv .fd-dot { color: var(--fd-faint); }
.fd-more { margin: -3px 0; }
.fd-more.fd-lit { color: var(--lk-text, #222) !important; }
.fd-icon { display: inline-flex; width: 12px; height: 12px; align-items: center; justify-content: center; color: var(--fd-faint); font-size: 12px; }
.fd-icon svg { width: 12px; height: 12px; }
/* The row: day | chevron | bullet | words and tag | right. */
.fd-r { display: grid; grid-template-columns: 52px 16px 18px minmax(0, 1fr) auto; align-items: baseline; column-gap: 2px; min-height: 26px; padding: 1px 6px 1px 0; border-radius: 3px; cursor: default; }
.fd-r.fd-on { background: var(--fd-wash); }
.fd-r .fd-day { font-size: 12.5px; color: var(--fd-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-fold { all: unset; cursor: pointer; display: inline-flex; width: 16px; height: 20px; align-items: center; justify-content: center; font-size: 11px; color: inherit; align-self: start; margin-top: .5px; }
.fd-r .lk-fold { opacity: 0; } .fd-r:hover .lk-fold, .fd-r.fd-on .lk-fold, .lk-fold[aria-expanded="true"] { opacity: .6; }
.fd-bul { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; align-items: center; justify-content: center; align-self: start; margin-top: 2.5px; }
.fd-bul .fd-d { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; }
.fd-bul.fd-folded { background: var(--fd-ring); }
.fd-nm { display: flex; align-items: baseline; gap: 7px; min-width: 0; flex-wrap: wrap; }
.fd-nm .fd-w { min-width: 0; cursor: pointer; }
.fd-nm .fd-w b { font-weight: 600; }
.fd-nm .lk-node { cursor: pointer; }
.fd-right { color: var(--fd-faint); font-size: 12.5px; white-space: nowrap; padding-left: 12px; font-variant-numeric: tabular-nums; }
.fd-right .fd-key { font-family: var(--fd-mono); }
.fd-body .fd-showall { display: block; padding: 2px 0 2px 88px; }
.fd-cut { display: flex; align-items: baseline; padding: 2px 0 2px 88px; }
.fd-cut .fd-showall { padding: 0; }
.fd-none { color: var(--fd-faint); padding: 6px 0 6px 88px; }
/* A node opened in place: its properties, then what points at it, each a line that opens: the grammar's row, the dot
   ringed while closed, the number after the words as faint as on a lit choice. */
.fd-kids { margin: 2px 0 6px 76px; padding-left: 10px; border-left: 1px solid var(--fd-hair); }
.fd-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 1px 12px; font-size: 13.5px; align-items: baseline; padding: 2px 0 10px; }
.fd-kv .fd-k { display: inline-flex; align-items: center; gap: 5px; }
.fd-kv .fd-v { display: flex; gap: 8px; flex-wrap: wrap; }
.fd-kids .fd-g { grid-template-columns: 16px 18px minmax(0, 1fr); }
.fd-kids .fd-g .lk-tag { margin-left: 2px; }
.fd-gn { margin-left: 16px; }
.fd-gn .fd-showall { padding-left: 86px; }
.fd-ct { color: var(--fd-faint); font-size: 12px; font-variant-numeric: tabular-nums; }
.fd-faint { color: var(--fd-faint); }
.fd-foot { display: flex; gap: 16px; flex-wrap: wrap; padding: 6px 16px 8px; border-top: 1px solid var(--fd-hair); font-size: 12.5px; color: var(--lk-text, #222); }
.fd-foot:empty { display: none; }
.fd-foot .fd-k { color: var(--fd-faint); margin-left: .4em; }
.fd-foot .fd-right { margin-left: auto; padding: 0; }
.fd-foot .lk-lone { margin: -3px -6px; }
.fd-wait { color: var(--fd-faint); padding: 6px 0; }
@media (prefers-reduced-motion: reduce) { .fd-piece .fd-x, .fd-r .lk-fold { transition: none; } }`;


const S = {
  dlg: null, doc: null, gen: 0, timer: 0, reads: 0, enter: null, making: false,
  picks: [], typed: '', mode: 'rows', rowAt: 0, choiceAt: 0,
  kinds: [], recents: [], base: [], shown: [], facets: null, allShown: false, moreOf: new Set(),
  dug: [], dugData: new Map(), openGroups: new Set(), groupAll: new Set(), stale: false,
  cache: { kind: new Map(), kindFacets: new Map(), counted: new Map(), words: new Map() }, loading: false, failed: '', commands: null,
};
const setting = key => Find.settings.setting(key);
const words = () => S.typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
const isCommandMode = () => S.typed.startsWith('>');
const kindPick = () => S.picks.find(p => p.kind === 'tag');
const hasWord = (text, ws) => { const t = text.toLowerCase(); return ws.every(w => t.includes(w)); };

/* What is on screen, worked out from the picks and the letters. */
async function compute() {
  const gen = ++S.gen;
  S.failed = '';
  try {
    if (isCommandMode()) { S.shown = []; S.facets = null; return; }
    const ws = words();
    const tag = kindPick();
    if (!tag && !ws.length) {
      if (!S.kinds.length) S.kinds = await db.kinds();
      if (!S.recents.length) S.recents = await db.recents();
      if (gen !== S.gen) return;
      S.base = []; S.shown = []; S.facets = null; return;
    }
    if (tag) {
      if (!S.cache.kind.has(tag.id)) S.cache.kind.set(tag.id, await db.nodesOfKind(tag.id));
      if (gen !== S.gen) return;
      let nodes = S.cache.kind.get(tag.id);
      if (!S.cache.kindFacets.has(tag.id)) S.cache.kindFacets.set(tag.id, await db.facets(nodes));
      if (gen !== S.gen) return;
      const full = S.cache.kindFacets.get(tag.id);
      // The choices are counted over the picks alone: the letters narrow the rows, and light the choice they name. So the
      // count is kept by the picks, and a letter costs only the narrowing.
      const picked = JSON.stringify(S.picks.map(p => [p.kind, p.kind === 'tag' ? p.id : p.name, p.key]));
      if (!S.cache.counted.has(picked)) {
        for (const p of S.picks) {
          if (p.kind === 'value') nodes = nodes.filter(n => full.byNode.get(n.id)?.has(p.name + '=' + p.key));
          if (p.kind === 'month') nodes = nodes.filter(n => Math.floor(n.day / 100) === p.key);
        }
        const base = nodes.slice().sort(db.byDay);
        S.cache.counted.set(picked, { base, facets: { props: countFacets(base, full), months: db.months(base), kinds: [] } });
      }
      const counted = S.cache.counted.get(picked);
      S.base = counted.base; S.facets = counted.facets;
      S.shown = ws.length ? S.base.filter(n => hasWord(n.text, ws)) : S.base;
    } else {
      if (!S.kinds.length) S.kinds = await db.kinds();
      const key = ws.join(' ');
      if (!S.cache.words.has(key)) S.cache.words.set(key, await db.search(S.typed.trim()));
      if (gen !== S.gen) return;
      S.base = S.cache.words.get(key);
      S.shown = S.base;
      S.facets = { props: [], months: db.months(S.shown), kinds: kindCounts(S.shown) };
    }
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
// The kinds beneath the picked one, among its nodes: under Entity, Doctor, Person, Organization. Two or more, else none.
function kindsBeneath(tag, nodes) {
  const kinds = kindCounts(nodes).filter(k => k.id !== tag.id);
  return kinds.length > 1 ? kinds : [];
}
function kindCounts(nodes) {
  const map = new Map();
  for (const n of nodes) if (n.kind) map.set(n.kind.id, { id: n.kind.id, uuid: n.kind.uuid, title: n.kind.title, count: (map.get(n.kind.id)?.count || 0) + 1 });
  return [...map.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

/* The choices, as groups of items; each item knows how to pick itself. */
function choiceGroups() {
  const groups = [];
  const ws = words(), typed = ws.length > 0;
  const matches = label => ws.every(w => label.toLowerCase().split(/[\s,./()-]+/).some(l => l.startsWith(w)) || label.toLowerCase().startsWith(w));
  const tag = kindPick();
  const limit = key => S.moreOf.has(key) ? 999 : 3;
  if (!tag) {
    // With letters typed, the kinds whose names match come first (so "cons" picks Consultation whatever the words find);
    // when none match, the kinds among the results say what was found.
    const named = ws.length ? S.kinds.filter(k => matches(k.title)) : S.kinds;
    const kinds = named.length ? named : (S.facets?.kinds || []);
    if (kinds.length) groups.push({ key: 'kind', label: ws.length ? 'kind' : 'start from', icon: '', items: kinds.slice(0, limit('kind')).map(k => ({ label: k.title, count: k.count, lit: typed && named.length > 0 && matches(k.title), pick: () => addPick({ kind: 'tag', id: k.id, uuid: k.uuid, title: k.title }) })), more: kinds.length > limit('kind') });
  }
  if (S.facets) {
    // Under an umbrella kind, the kinds beneath it come first; picking one takes the umbrella's place in the find line.
    if (tag) {
      const beneath = kindsBeneath(tag, S.base).filter(k => matches(k.title));
      if (beneath.length) groups.push({ key: 'kind', label: 'kind', icon: '', items: beneath.slice(0, limit('kind')).map(k => ({ label: k.title, count: k.count, lit: typed && matches(k.title), pick: () => replaceKind({ kind: 'tag', id: k.id, uuid: k.uuid, title: k.title }) })), more: beneath.length > limit('kind') });
    }
    // A few lines of properties, then "more choices"; with letters typed, every line that matches shows.
    let lines = 0;
    for (const p of S.facets.props) {
      if (S.picks.some(x => x.kind === 'value' && x.name === p.name)) continue;
      const vals = p.values.filter(v => matches(v.label));
      if (!vals.length) continue;
      if (!typed && !S.moreOf.has('lines') && lines >= 3) { groups.hidden = (groups.hidden || 0) + 1; continue; }
      lines++;
      groups.push({ key: 'p:' + p.name, label: p.name, icon: kindIconHtml(p.type), items: vals.slice(0, limit('p:' + p.name)).map(v => ({ label: v.label, count: v.count, lit: typed && matches(v.label), pick: () => addPick({ kind: 'value', name: p.name, type: p.type, key: v.key, label: v.label, uuid: v.uuid }) })), more: vals.length > limit('p:' + p.name) });
    }
    if (!S.picks.some(x => x.kind === 'month')) {
      const ms = S.facets.months.filter(m => matches(m.label));
      if (ms.length > 1) groups.push({ key: 'when', label: 'When', icon: kindIconHtml('date'), items: ms.slice(0, limit('when')).map(m => ({ label: m.label, count: m.count, lit: typed && matches(m.label), pick: () => addPick({ kind: 'month', key: m.key, label: m.label }) })), more: ms.length > limit('when') });
    }
  }
  // "more" is a choice like the others, so the arrows reach it and Tab or Enter takes it; the cursor stays where the first new one comes.
  for (const g of groups) if (g.more) g.items.push({ more: true, label: 'more', pick: () => { S.moreOf.add(g.key); render(); } });
  if (groups.hidden) groups.push({ key: 'lines', label: '', icon: '', items: [{ more: true, label: `${groups.hidden} more ${groups.hidden === 1 ? 'property' : 'properties'} to narrow by`, pick: () => { S.moreOf.add('lines'); render(); } }] });
  return groups;
}
const flatChoices = groups => groups.flatMap(g => g.items);
const litChoice = groups => (words().length === 1 ? flatChoices(groups).find(c => c.lit) : null);

function addPick(pick) {
  S.picks.push(pick);
  S.typed = ''; S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false; S.dug = []; S.openGroups.clear();
  refresh();
}
// A kind beneath the picked one takes its place; the value and month picks stay, since they hold under it too.
function replaceKind(pick) {
  S.picks = S.picks.map(p => (p.kind === 'tag' ? pick : p));
  S.typed = ''; S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false; S.dug = []; S.openGroups.clear(); S.moreOf.delete('lines');
  refresh();
}
function removePick(at) {
  S.picks.splice(at, 1);
  // A value or month pick needs its kind; without the kind they go too.
  if (!kindPick()) S.picks = S.picks.filter(p => p.kind === 'tag');
  S.rowAt = 0; S.allShown = false; S.dug = []; S.openGroups.clear();
  refresh();
}

/* The rows, flat, in the order they show: top rows, and inside a dug one its pointed-at groups and their nodes. */
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
  const top = (!kindPick() && !words().length) ? S.recents : S.shown;
  const shown = S.allShown ? top : top.slice(0, setting('rowsShown') || 12);
  for (const n of shown) {
    list.push({ kind: 'node', node: n, top: true });
    if (S.dug.includes(n.uuid)) {
      const data = S.dugData.get(n.uuid);
      if (!data) continue;
      for (const g of data.pointed) {
        const key = n.uuid + '|' + g.name + '|' + g.kind;
        list.push({ kind: 'group', key, name: g.name, tag: g.kind, count: g.nodes.length, nodes: g.nodes, of: n.uuid });
        if (S.openGroups.has(key)) for (const m of (S.groupAll.has(key) ? g.nodes : g.nodes.slice(0, 3))) list.push({ kind: 'node', node: m, under: key });
      }
      if (data.mentioned.length) {
        const key = n.uuid + '|mentioned';
        list.push({ kind: 'group', key, name: 'mentioned in', tag: '', count: data.mentioned.length, nodes: data.mentioned, of: n.uuid });
        if (S.openGroups.has(key)) for (const m of (S.groupAll.has(key) ? data.mentioned : data.mentioned.slice(0, 3))) list.push({ kind: 'node', node: m, under: key });
      }
    }
  }
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
  // the find line
  const find = d.querySelector('.fd-find');
  for (const piece of find.querySelectorAll('.fd-piece, .fd-sep')) piece.remove();
  const input = find.querySelector('.fd-input');
  S.picks.forEach((p, i) => {
    if (i) find.insertBefore(el(doc, 'span', { class: 'fd-sep' }, '·'), input);
    const piece = el(doc, 'span', { class: 'fd-piece' });
    piece.append(el(doc, 'button', { class: 'fd-x lk-x', type: 'button', title: 'Take this off', 'aria-label': 'Take off ' + (p.title || p.label), click: () => removePick(i) }, '×'));
    if (p.kind === 'tag') piece.append(el(doc, 'span', { class: 'lk-tag' }, p.title));
    else if (p.kind === 'value') { piece.append(el(doc, 'span', { class: 'lk-prop' }, p.name)); piece.append(p.uuid ? el(doc, 'span', { class: 'lk-node', 'data-uuid': p.uuid }, p.label) : el(doc, 'span', {}, p.label)); }
    else piece.append(el(doc, 'span', { class: 'fd-month' }, p.label));
    find.insertBefore(piece, input);
  });
  if (input.value !== S.typed) input.value = S.typed;
  input.placeholder = S.picks.length ? '' : 'pick a kind, or type';
  // the body
  const body = d.querySelector('.fd-body');
  const scrollTop = body.scrollTop;
  body.replaceChildren();
  if (S.failed) body.append(el(doc, 'div', { class: 'fd-none' }, 'The graph could not be read: ' + S.failed));
  if (!isCommandMode() && groups.length) {
    let ci = 0;
    const wrap = el(doc, 'div', { class: 'fd-choices' });
    // No word over the lines: each is a label and the choices that narrow the list, and the gap under them tells
    // them from the rows.
    for (const g of groups) {
      const box = el(doc, 'div', { class: 'fd-ch' });
      box.append(el(doc, 'span', { class: 'fd-ck' + (g.key.startsWith('p:') ? ' lk-prop' : ''), html: g.icon ? `<span class="fd-icon">${g.icon}</span>` : '' }, g.key === 'kind' ? 'kind' : g.label));
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
  if (!isCommandMode() && rows.length && !kindPick() && !words().length) body.append(el(doc, 'div', { class: 'fd-head fd-head-rows' }, 'recently opened'));
  const ws = words();
  // A dug node's lines (its properties, the groups pointing at it, their nodes) go into its box; the next top row ends it.
  let container = body;
  rows.forEach((r, i) => {
    const on = S.mode === 'rows' && i === S.rowAt;
    if (r.kind === 'command') { body.append(commandRow(doc, r, i, on)); return; }
    if (r.kind === 'group') {
      const open = S.openGroups.has(r.key);
      const row = el(doc, 'div', { class: 'fd-r fd-g lk-row' + (on ? ' fd-on' : ''), 'data-i': i });
      row.append(el(doc, 'button', { class: 'fd-fold lk-fold', type: 'button', 'aria-expanded': String(open), title: open ? 'Close' : 'Open the nodes', click: event => { event.stopPropagation(); toggleGroup(r); } }, open ? '▾' : '▸'));
      row.append(el(doc, 'span', { class: 'fd-bul' + (open ? '' : ' fd-folded') }, el(doc, 'i', { class: 'fd-d' })));
      const nm = el(doc, 'span', { class: 'fd-nm' }, el(doc, 'span', { class: 'lk-prop' }, r.name));
      if (r.tag) nm.append(el(doc, 'span', { class: 'lk-tag' }, r.tag));
      nm.append(el(doc, 'span', { class: 'fd-ct' }, String(r.count)));
      row.append(nm);
      row.addEventListener('click', () => { S.mode = 'rows'; S.rowAt = i; render(); });
      container.append(wrapIn(doc, row, r));
      return;
    }
    const node = r.node, dug = r.top && S.dug.includes(node.uuid);
    if (r.top) container = body;
    const row = el(doc, 'div', { class: 'fd-r lk-row' + (on ? ' fd-on' : ''), 'data-i': i, 'data-uuid': node.uuid });
    row.append(el(doc, 'span', { class: 'fd-day lk-day' }, node.journal ? '' : db.dayLabel(node.day)));   // a journal page's name is its day
    if (r.top) row.append(el(doc, 'button', { class: 'fd-fold lk-fold', type: 'button', 'aria-expanded': String(dug), title: dug ? 'Close' : 'Open in place', click: event => { event.stopPropagation(); S.rowAt = i; S.mode = 'rows'; toggleDig(node); } }, dug ? '▾' : '▸'));
    else row.append(el(doc, 'span', {}));
    row.append(el(doc, 'span', { class: 'fd-bul' + (node.isPage ? '' : '') }, el(doc, 'i', { class: 'fd-d' })));
    const nm = el(doc, 'span', { class: 'fd-nm' });
    // Under a kind picked, or a group's head naming one, the kind has been said: no mark before the name.
    const named = r.top ? kindPick() : rows.find(x => x.key === r.under)?.tag;
    const w = el(doc, 'span', { class: 'fd-w' + (node.isPage ? ' lk-node' + (named ? ' lk-bare' : '') : ''), ...(node.isPage ? { 'data-uuid': node.uuid } : {}) });
    if (node.isPage) w.innerHTML = markWords(esc(node.text), ws);
    else for (const part of node.parts) {
      if (part.uuid) w.append(el(doc, 'span', { class: 'lk-node', 'data-uuid': part.uuid, html: markWords(esc(part.text), ws), click: event => { event.stopPropagation(); openPage(part.uuid, event.shiftKey); close(); } }));
      else w.append(el(doc, 'span', { html: markWords(esc(part.text), ws) }));
    }
    w.addEventListener('click', event => { event.stopPropagation(); openPage(node.uuid, event.shiftKey); close(); });
    nm.append(w);
    if (node.kind && !(r.under && rows.find(x => x.key === r.under)?.tag === node.kind.title) && !(kindPick() && r.top && kindPick().title === node.kind.title && S.picks.length)) nm.append(el(doc, 'span', { class: 'lk-tag' }, node.kind.title));
    row.append(nm);
    const right = node.page && !node.page.journal ? node.page.title : (node.isPage && node.journal ? '' : '');
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
  if (!isCommandMode() && (kindPick() || ws.length)) {
    const total = S.shown.length, limit = setting('rowsShown') || 12, tag = kindPick();
    if (!S.loading && !total && !S.failed) body.append(el(doc, 'div', { class: 'fd-none' }, 'nothing with these words here'));
    const more = total > limit && !S.allShown ? el(doc, 'button', { class: 'fd-showall lk-more', type: 'button', click: () => { S.allShown = true; render(); } }, `show all ${total}`) : null;
    // A kind too long to read whole says so where the list ends, and which part it holds.
    const cutFrom = tag && S.cache.kind.get(tag.id)?.cutFrom;
    const line = more && cutFrom ? el(doc, 'div', { class: 'fd-cut' }, more, el(doc, 'span', { class: 'fd-faint' }, ` · the newest of ${cutFrom}`)) : more || (cutFrom ? el(doc, 'div', { class: 'fd-none' }, `the newest ${S.cache.kind.get(tag.id).length} of ${cutFrom}`) : null);
    if (line) body.append(line);
  }
  // While the graph is read, the rows that are there stay where they are and go a shade lighter after a moment; no line
  // is added or taken away, so nothing jumps between one letter and the next.
  body.classList.toggle('fd-reading', S.loading);
  body.scrollTop = scrollTop;
  const cur = body.querySelector(S.mode === 'choices' ? `[data-c="${S.choiceAt}"]` : `.fd-r[data-i="${S.rowAt}"]`);
  cur?.scrollIntoView?.({ block: 'nearest' });
  drawFoot(groups, rows);
}
function drawFoot(groups, rows) { S.dlg.querySelector('.fd-foot').replaceChildren(...foot(S.doc, groups, rows)); }
// The cursor moves along the rows: the lit mark goes from one to the other and nothing is drawn again.
function litRow(at, groups, rows) {
  S.rowAt = at;
  const body = S.dlg.querySelector('.fd-body');
  body.querySelector('.fd-r.fd-on')?.classList.remove('fd-on');
  const cur = body.querySelector(`.fd-r[data-i="${at}"]`);
  cur?.classList.add('fd-on');
  cur?.scrollIntoView?.({ block: 'nearest' });
  drawFoot(groups, rows);
}
// Rows under an opened group sit one step in; a group line sits inside its node's box.
function wrapIn(doc, row, r) {
  if (r.under) { const box = el(doc, 'div', { class: 'fd-gn' }); box.append(row); return box; }
  return row;
}
function commandRow(doc, r, i, on) {
  const row = el(doc, 'div', { class: 'fd-r fd-cmd lk-row' + (on ? ' fd-on' : ''), 'data-i': i });
  // No picture before a command: the > in the find line already says what these are; the words start where every row's do.
  row.append(el(doc, 'span', {}), el(doc, 'span', {}), el(doc, 'span', {}));
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
  const box = el(doc, 'div', { class: 'fd-kids' });
  if (!data) { box.append(el(doc, 'div', { class: 'fd-wait' }, 'reading…')); return box; }
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
const short = (text, max = 36) => { const t = String(text || '').trim(); return t.length > max ? t.slice(0, max - 2).replace(/\s+\S*$/, '') + '…' : t; };
const KEY = (k, label) => `<span>${label}<span class="fd-k">${k}</span></span>`;
/* The foot names what the keys do right now, naming the thing: "narrow to Consultation Tab", "open Look test Enter", "in the
   sidebar Shift Enter", dig →, close ←. What a key does is in the text colour and the key faint beside it, as in the Pressing set; the key is a word at the
   foot's own size, since the symbols ⏎ and ⇧⏎ small and faint could not be read. Not a legend of keys (none is wanted, 31 October): each word is the action at hand, and it changes
   with the cursor. Taken out that morning under the ruling, asked back the same day ("there are no hints at the bottom of
   view anymore like tab or shift enter"). The right end offers to make a page from the words. */
function foot(doc, groups, rows) {
  const items = [];
  const add = html => items.push(el(doc, 'span', { html }));
  const cur = rows[S.rowAt];
  if (isCommandMode()) { add(KEY('Enter', cur ? `run ${esc(cur.label)}` : 'run')); return items; }
  const choices = flatChoices(groups);
  const lit = S.mode === 'choices' ? choices[S.choiceAt] : litChoice(groups);
  if (S.mode === 'choices') { add(KEY('Tab', lit.more ? 'show more' : `narrow to ${esc(lit.label)}`)); add(KEY('← → ↑ ↓', 'choose')); add(KEY('Escape', 'back to the rows')); }
  else {
    if (lit) add(KEY('Tab', `narrow to ${esc(lit.label)}`)); else if (choices.length) add(KEY('Tab', 'narrow'));
    if (cur?.kind === 'node') { add(KEY('Enter', `open ${esc(short(cur.node.text))}`)); add(KEY('Shift Enter', 'in the sidebar')); }
    else if (cur?.kind === 'group') add(KEY('Enter', `open the ${cur.count}`));
  }
  if (!kindPick() && !words().length) return items;
  if (cur?.kind === 'node' && cur.top) add(KEY(S.dug.includes(cur.node.uuid) ? '←' : '→', S.dug.includes(cur.node.uuid) ? 'close' : 'dig'));
  if (cur?.kind === 'group') add(KEY(S.openGroups.has(cur.key) ? '←' : '→', S.openGroups.has(cur.key) ? 'close' : 'open'));
  if (S.picks.length && !S.typed) add(KEY('Backspace', `take ${esc(S.picks[S.picks.length - 1].title || S.picks[S.picks.length - 1].label)} off`));
  if (words().length && !kindPick()) { const name = S.typed.trim(); items.push(el(doc, 'span', { class: 'fd-right' }, el(doc, 'button', { class: 'lk-lone', type: 'button', title: 'Make a page with these words as its name', click: () => makePage(name) }, `make a page “${name}”`, makesPage(rows) ? el(doc, 'span', { class: 'fd-k' }, 'Enter') : ''))); }
  return items;
}

/* Doing. */
async function toggleDig(node) {
  if (S.dug.includes(node.uuid)) { S.dug = S.dug.filter(u => u !== node.uuid); for (const k of [...S.openGroups]) if (k.startsWith(node.uuid + '|')) S.openGroups.delete(k); render(); return; }
  S.dug.push(node.uuid);
  if (!S.dugData.has(node.uuid)) {
    render();
    try { S.dugData.set(node.uuid, await db.node(node.uuid)); } catch (error) { console.error('Find: could not read the node', error); S.dugData.set(node.uuid, { properties: [], pointed: [], mentioned: [] }); }
  }
  render();
}
function toggleGroup(g) {
  if (S.openGroups.has(g.key)) S.openGroups.delete(g.key); else S.openGroups.add(g.key);
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
// With no rows at all, making a page is the one thing offered, so Enter does it.
const makesPage = rows => !rows.length && !!words().length && !kindPick() && !isCommandMode() && !S.loading && !S.failed;
// Down past the last row of a list shows the rest of that list.
function showRest(rows) {
  const cur = rows[S.rowAt], next = rows[S.rowAt + 1];
  if (cur?.under && next?.under !== cur.under && !S.groupAll.has(cur.under) && rows.find(r => r.key === cur.under)?.count > 3) { S.groupAll.add(cur.under); return true; }
  if (next || S.allShown || isCommandMode() || !(kindPick() || words().length) || S.shown.length <= (setting('rowsShown') || 12)) return false;
  return S.allShown = true;
}
// Enter takes what is on screen; pressed while the letters are being read, it waits for what they find.
function takeEnter(shift) {
  const groups = choiceGroups(), rows = rowList();
  if (S.mode === 'choices') { flatChoices(groups)[S.choiceAt]?.pick(); return; }
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
    if (S.mode === 'choices') { S.mode = 'rows'; render(); return; }
    close(); return;
  }
  // Tab narrows, Enter opens: the two never overlap. Tab takes the choice the letters light; with none lit it steps into
  // the choices, where Tab again takes the one under the cursor. Enter opens the row the cursor is on (in the choices, it
  // takes the choice too, as a click would).
  if (k === 'Enter') {
    take();
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
    if (S.mode === 'choices') {
      // Up and Down step between the groups; Down from the last goes on to the rows.
      const at = groupOf(groups, S.choiceAt), next = at + (down ? 1 : -1);
      if (next >= groups.length) { if (rows.length) { S.mode = 'rows'; S.rowAt = 0; } }
      else if (next >= 0) S.choiceAt = groups.slice(0, next).reduce((n, g) => n + g.items.length, 0);
      render(); return;
    }
    if (down && showRest(rows)) { S.rowAt++; render(); return; }
    if (!down && S.rowAt === 0 && choices.length) { S.mode = 'choices'; S.choiceAt = groups.slice(0, -1).reduce((n, g) => n + g.items.length, 0); render(); return; }
    litRow(Math.max(0, Math.min(rows.length - 1, S.rowAt + (down ? 1 : -1))), groups, rows);
    return;
  }
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    const right = k === 'ArrowRight';
    if (S.mode === 'choices') { take(); S.choiceAt = Math.max(0, Math.min(choices.length - 1, S.choiceAt + (right ? 1 : -1))); render(); return; }
    const input = S.dlg.querySelector('.fd-input');
    // In the letters the arrows move the caret; at an end, or with no letters, they dig and close.
    if (S.typed && ((right && input.selectionEnd < input.value.length) || (!right && input.selectionStart > 0))) return;
    const cur = rows[S.rowAt]; if (!cur) return;
    take();
    if (cur.kind === 'node' && cur.top) { if (right !== S.dug.includes(cur.node.uuid)) toggleDig(cur.node); return; }
    if (cur.kind === 'group') { if (right !== S.openGroups.has(cur.key)) toggleGroup(cur); return; }
    return;
  }
  if (k === 'Backspace' && !S.typed && S.picks.length) { take(); removePick(S.picks.length - 1); return; }
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
  S.mode = 'rows'; S.rowAt = 0; S.choiceAt = 0; S.allShown = false;
  refresh();
}

/* Opening and closing. */
function open() {
  const doc = host();
  close();
  S.commands = null;
  if (S.stale) { S.stale = false; S.kinds = []; S.recents = []; S.dugData.clear(); }
  style('find', CSS);
  const dlg = el(doc, 'dialog', { class: 'fd fd-own ' + (setting('windowPlace') === 'centred' ? 'fd-centred' : 'fd-high'), 'aria-label': 'Find' });
  const find = el(doc, 'div', { class: 'fd-find' });
  const input = el(doc, 'input', { class: 'fd-input', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: 'pick a kind, or type' });
  input.addEventListener('input', onInput);
  find.append(input);
  dlg.append(find, el(doc, 'div', { class: 'fd-body' }), el(doc, 'div', { class: 'fd-foot' }));
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
  dlg.style.height = FRAME + (setting('rowsShown') || 12) * ROW + 'px';
  doc.body.appendChild(dlg);
  S.dlg = dlg; S.doc = doc;
  Object.assign(S, { picks: [], typed: '', mode: 'rows', rowAt: 0, choiceAt: 0, allShown: false, dug: [], failed: '', enter: null });
  S.moreOf.clear(); S.openGroups.clear(); S.groupAll.clear();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  input.focus();
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
// The graph changed: what was read is read again next time. What an open window shows stays until the next opening.
function forget() { S.cache.kind.clear(); S.cache.kindFacets.clear(); S.cache.counted.clear(); S.cache.words.clear(); S.stale = true; db.forget(); }

Find.window = { open, close, toggle, forget, state: S };
})();
