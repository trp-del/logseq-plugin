/* Digging: a node opened in place under its line (its properties, what points at it, its first bullets), the shift
   into a node when its lines would break, the trail back, and writing a bullet or a value into an opened node.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, openEntity, notify, esc } = shared;
const O = shared.outline;
const { state, warnOnce } = twoWay;

/* Digging, one model (; it replaces the node opened in a row, the chain opened inside it and the
   step into a node, three models drawn three ways). state.dig: every node open, by its place: the row ('r:Provider'),
   then '>uuid' for each node down, the whole path from the page. A node opens in place under its own name for three
   levels or less: once a node just opened has a line that would break, the outline shifts (fitOrShift): the node below the top becomes the top and the top goes into the trail (state.steps, each with its key, a click back; Esc one step back
   once nothing is open under the top). state.focus is the place opened last: its line and what it holds
   sit on the light grey wash; a click inside another open node moves it there, closing it or Esc hands it to its
   parent. The way down is never listed again under a node (a node on the way, or this page, is left out). What a node
   holds is read in one go (state.node, readNode) and drawn once, unrolling; until it is read only its chevron turns. */
const BULLETS = 8;
// The node at the top of the section, and how deep a key is below it.
const topStep = () => state.steps[state.steps.length - 1] || null;
const below = key => { const t = topStep(); return t?.key ? (key.startsWith(t.key + '>') ? pathOf(key).length - pathOf(t.key).length : -1) : pathOf(key).length; };
// The core's uuid test; a drawing made before the part starts (the odd-names test) uses the same shape.
const isUuid = text => (twoWay.UUID || window.PluginDoor.UUID).test(String(text || ''));
const pathOf = key => key.split('>').slice(1);
const parentKey = key => key.split('>').slice(0, -1).join('>');
const onTheWay = (path, uuid) => path.includes(uuid) || uuid === state.pageUuid || state.steps.some(s => s.uuid === uuid);
function digChev(key, uuid, id, title, open = state.dig.has(key)) {
  if (!isUuid(uuid) || (!open && !holdsMore(uuid, key))) return '';
  return O.chev({ open, label: title, attrs: { 'data-dig': key, 'data-uuid': uuid, 'data-id': id ? String(id) : null, 'data-title': title } });
}
// What an opened node holds, under its name; the hairline starts at the chevron of its line ('day', 'prop', 'back', '').
function digKids(key, uuid, from) {
  const data = state.node.get(uuid);
  if (!data) return '';
  const fresh = state.fresh === key;
  // The names' column as wide as the longest name it holds, so none breaks onto two lines (C6, 7 November 2026), within
  // 7em and 16em: past that a name wraps between its words.
  const longest = Math.max(0, ...data.props.filter(r => r.values.length || state.emptyOpen.has(key) || data.guesses.has(r.prop.ident)).map(r => r.prop.title.length), ...data.rows.map(g => String(g.label || '').length));
  const name = `clamp(7em, calc(${longest} * .56em + 42px), 16em)`;
  return O.kids({ html: nodeHtml(uuid, key, data), from, fresh, attrs: { 'data-key': key, style: `--th-tw-name: ${name}` } });
}
/* Whether a node, opened at this place, would show anything beyond what its line says (10 November 2026, the owner's yes to
   the audit's "opens to an empty box": as in Logseq, a node with nothing under it has no fold arrow). Unread, it is
   taken to hold something; once read (the pointer coming to its arrow reads it) a node holding only the way back and the
   day its line shows offers no arrow, and a press that reads it first opens nothing. */
function holdsMore(uuid, key) {
  const data = state.node.get(uuid);
  // Read only by a look, its empty properties have not been asked what they would be filled with: it may hold a proposal.
  return !data || (data.looked && data.props.some(r => !r.values.length)) || !!nodeHtml(uuid, key, data, false, false).trim();
}
function nodeHtml(uuid, key, data, asTop = false, field = true) {
  const path = [...state.steps.map(s => s.uuid), ...pathOf(key)];
  // Opened by the find field: only its lines that hold the words, as they read when the node is dug.
  const onlyFound = state.findDug.get(key) === true && !!state.find.trim();
  let html = '', empties = '', emptyNames = [];
  // A value that is the way back (this page, or the node above) is left out: the row's property, on the left of the line
  // it opened from, already says how the node is tied here, and a thread cannot loop back on itself (the owner:
  // the line saying it again inside was "not right"). A property holding only the way back goes with it.
  const back = v => isUuid(v.uuid) && onTheWay(path, v.uuid);
  // A Date saying the day its line already shows in the margin is left out.
  const day = twoWay.lineDay.get(key) || '';
  for (const { prop, values: all } of data.props) {
    const values = all.filter(v => !back(v));
    if (all.length && !values.length) continue;
    if (day && prop.type === 'date' && values.length && values.every(v => v.text === day)) continue;
    const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
    const linked = (kind === 'node' || kind === 'page') && values.some(v => isUuid(v.uuid));
    const guess = !values.length ? data.guesses.get(prop.ident) : null;
    const found = twoWay.findsLine(prop, values) ? 'th-tw-match' : '';
    if (onlyFound && (!found || (prop.type === 'date' && !twoWay.has(prop.title, twoWay.readFind().q)))) continue;
    const nameAttrs = { 'data-edit': prop.ident, 'data-uuid': uuid, title: `Change “${prop.title}”`, class: null };
    if (guess) { html += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, value: O.pencil(guess.shown || '', { 'data-take': prop.ident, 'data-uuid': uuid, title: `${guess.guess ? 'A guess from its words' : 'From its words'}: click to fill it in` }) }); continue; }
    if (!linked) {
      // Several words or numbers: each its own, changed one at a time; the property's name adds another.
      const one = (text, at = '') => `<button type="button" class="th-tw-npvalue${values.length ? '' : ' th-faint'}" data-edit="${esc(prop.ident)}" data-uuid="${esc(uuid)}"${at} title="Change “${esc(prop.title)}”">${esc(text)}</button>`;
      const typed = !['choice', 'checkbox', 'date', 'datetime'].includes(kind);
      // Empty, it folds with the others into one line (C5, 7 November 2026: an empty property folds until you want it).
      if (!values.length && !onlyFound) { emptyNames.push(prop.title); empties += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, value: one('empty') }); continue; }
      html += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, value: !values.length ? one('empty') : typed && prop.many ? `<span>${values.map((v, i) => `<span>${one(v.text, ` data-value="${i}"`)}</span>`).join(', ')}</span>` : one(values.map(v => v.text).join(', ')) });
      continue;
    }
    values.forEach((v, i) => {
      const k = `${key}>${v.uuid}`, open = state.dig.has(k);
      const item = { uuid: v.uuid, title: v.text, words: v.words, tag: data.tags.get(v.id) || '' };
      // One outline (the owner, 10 November 2026: "the property values can have bullets like normally, then a chevron can
      // appear next"): a value that is a node is a bullet, its fold arrow before it, as on a page's own properties.
      const vchev = isUuid(v.uuid) ? digChev(k, v.uuid, v.id, v.text, open) : '';
      const vdot = isUuid(v.uuid) ? O.dot(false, { uuid: v.uuid, closed: !open && !!vchev, title: v.text }) : '';
      const line = O.prop({ kind, many: prop.many, name: i ? '' : prop.title, nameAttrs: i ? null : nameAttrs, cls: found, chev: vchev || (vdot ? O.room() : ''), value: `${vdot}<span class="th-ol-body">${isUuid(v.uuid) ? twoWay.nameHtml(item, open) : esc(v.text)}</span>` });
      html += open ? O.unit({ html: line + digKids(k, v.uuid, 'prop'), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
    });
  }
  if (onlyFound) return html + O.more({ text: 'show the rest', attrs: { 'data-findall': key } });
  /* An empty property draws nothing (8 November 2026, the owner: "remove the place holder for empty bullet"; the "3 empty"
     line went): only what the node holds shows. A list's "no Topic?" still opens the node with its empty properties shown
     (state.emptyOpen), to be filled in. */
  if (emptyNames.length && state.emptyOpen.has(key)) html += empties;
  if (data.guesses.size > 1 && data.props.filter(r => !r.values.length && data.guesses.has(r.prop.ident)).length > 1) html += O.more({ text: 'Take what is proposed', cls: 'lk-lone lk-i-tick', attrs: { 'data-takeall': uuid } });
  /* The nodes that link to it, after its own properties, under a line saying so: "2 nodes link here"
     (the owner's pick 2 of the two-way fixes: the same property
     name, one line apart, read as the node's own and as what links to it). Under it one step in, a row per property, one
     name per line, three then "show all"; each node a dot, then its day in a column where any of them has one, as on the rows. */
  const linking = asTop ? [] : data.rows.map(g => ({ g, items: g.items.filter(item => !onTheWay(path, item.uuid)) })).filter(r => r.items.length);
  const many = linking.reduce((n, r) => n + r.items.length, 0);
  if (many) {
    /* One outline (the owner, 10 November 2026: "all chevrons, bullets, etc to be aligned and consistent with how an
       outline would look"): each property that links here is a line, its fold arrow before it and its name where a
       bullet's words start; its nodes are bullets one step in under it, each with its day as the first words. The
       "N link here" line went (10 November 2026), then came back as "Linked", Logseq's word and the page's own, after the
       owner: "no idea about why those properties are there": the properties under it are other nodes' that point here. */
    const linkedShut = state.linksShut.has(key);
    html += `<div class="th-ol-line lk-row th-tw-lhead th-tw-linkedline" title="${esc(`${many} ${many === 1 ? 'node links' : 'nodes link'} to ${twoWay.shortName(titleOf(uuid))}`)}">${O.chev({ open: !linkedShut, label: 'Linked', attrs: { 'data-links': key } })}${O.dot(true)}<span class="th-ol-body">Linked</span></div>`;
    const outer = html; html = '';
    for (const { g, items } of linking) {
      const dated = items.some(item => twoWay.dayOf(g, item));
      const allKey = `${key}|${g.name}`, all = state.nall.has(allKey), shutKey = `${key}|links|${g.name}`, shut = state.linksShut.has(shutKey);
      const shownItems = all ? items : items.slice(0, twoWay.INLINE), first = shownItems.find(item => twoWay.dayOf(g, item));
      const days = shownItems.map(item => { const d = twoWay.lineDayOf(g, item, item !== first); return d && typeof d === 'object' ? { text: d.text.replace(/, \d{4}$/, ''), from: d.from } : String(d || '').replace(/, \d{4}$/, ''); });
      html += `<div class="th-ol-line lk-row th-tw-lhead">${O.chev({ open: !shut, label: g.label, attrs: { 'data-links': shutKey } })}<span class="th-ol-dot th-tw-lkind" aria-hidden="true">${shared.kindIconHtml(g.kind || 'node')}</span><span class="th-ol-body">${esc(g.label)}</span></div>`;
      if (shut) continue;
      let lines = '';
      shownItems.forEach((item, i) => {
        const k = `${key}>${item.uuid}`, open = state.dig.has(k);
        twoWay.lineDay.set(k, twoWay.dayCell(item));
        const line = O.line({ dot: { uuid: item.uuid, closed: !open && twoWay.hasKids(item.uuid), title: twoWay.shortName(item.title) }, chev: digChev(k, item.uuid, 0, twoWay.shortName(item.title), open), day: days[i] || (dated ? '' : null), body: `${twoWay.nameHtml(item, open)}${O.from(days[i])}` });
        lines += open ? O.unit({ html: line + digKids(k, item.uuid, 'in'), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
      });
      if (items.length > twoWay.INLINE) lines += O.more({ text: all ? 'show fewer' : `show ${items.length - twoWay.INLINE} more`, attrs: { 'data-nall': allKey }, under: dated ? 'dotday' : 'dot' });
      html += O.kids({ html: lines, cls: 'th-tw-lkids' });
    }
    html = outer + (linkedShut ? '' : O.kids({ html, cls: 'th-tw-linkedkids' }));
  }
  // Its words are changed where they stand (editBullet): a click, or Enter once Tab has reached them; its dot opens it.
  // A bullet holding bullets has Logseq's fold arrow and opens in place, one step in (the owner, 10 November 2026: "now we
  // cannot see children of bullets as we go deeper").
  for (const line of data.bullets) {
    const k = `${key}>${line.uuid}`, open = state.dig.has(k), kids = twoWay.hasKids(line.uuid);
    const label = twoWay.shortName(line.text || 'the bullet');
    const chev = kids || open ? O.chev({ open, label, attrs: { 'data-dig': k, 'data-uuid': line.uuid, 'data-title': label } }) : O.room();
    const row = O.bullet({ html: twoWay.lineHtml(line.text, 400) + (twoWay.bulletTail?.(line.uuid) || ''), closed: kids && !open, attrs: { 'data-bullet': line.uuid }, wordsAttrs: { tabindex: '0', 'data-edit-bullet': line.uuid } }).replace('<div class="th-ol-bullet"', '<div class="th-ol-bullet th-ol-chevved"').replace(/(<div class="th-ol-bullet[^>]*>)/, `$1${chev}`);
    html += open ? O.unit({ html: row + digKids(k, line.uuid, 'in'), focus: state.focus === k, attrs: { 'data-key': k } }) : row;
  }
  if (data.more) html += O.more({ text: 'show all its bullets', attrs: { 'data-ball': uuid } });
  if (!field) return html;
  html += O.newBullet({ label: `A new bullet inside ${twoWay.shortName(titleOf(uuid))}`, attrs: { class: 'th-tw-node-field', 'data-uuid': uuid, 'data-key': key } });
  return html;
}
// What a node is called, wherever it was seen.
function titleOf(uuid) {
  for (const s of state.steps) if (s.uuid === uuid) return s.title;
  for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return twoWay.shortName(item.title);
  for (const data of state.node.values()) {
    for (const g of data.rows) for (const item of g.items) if (item.uuid === uuid) return twoWay.shortName(item.title);
    for (const { values } of data.props) for (const v of values) if (v.uuid === uuid) return v.text;
  }
  return 'a node';
}
/* Read in one go: its properties with the tags of what they point at, what points at it, its first bullets and
   what the proposals would fill in; kept by node, so a node opened again draws at once and is read again behind. */
const reading = new Map();
// look: the pointer passing over a fold arrow, which reads the node but not the earlier lines the proposals learn from.
function readNode(uuid, id, { look = false } = {}) {
  const key = look ? uuid + '?' : uuid;
  if (reading.has(key)) return reading.get(key);
  const job = (async () => {
    const schema = await twoWay.provided.propSchema();
    const nodeId = Number(id) || await twoWay.provided.idByUuid(uuid).catch(() => 0);
    const [fields, held, rows, lines] = await Promise.all([
      twoWay.provided.fieldsOf(uuid, schema), twoWay.provided.nodeValues([uuid], { logseqs: true }),
      nodeId ? twoWay.groupsFor(nodeId).catch(error => { warnOnce('could not read what points at a node', error); return []; }) : [],
      twoWay.provided.firstLines(uuid, (state.ball.has(uuid) ? 500 : BULLETS) + 1, true).catch(error => { warnOnce('could not read the bullets of a node', error); return []; })]);
    const byIdent = new Map([...(held.get(uuid) || new Map()).values()].map(h => [h.ident, h.values]));
    const readable = async text => { try { return String(await twoWay.provided.readableTitle(String(text ?? ''))).trim(); } catch { return String(text ?? '').trim(); } };
    // Its tags' properties, then any other property it holds (a value set without the tag giving it, as a Treatment holding
    // "Side effects"), so whatever it holds shows (the way back itself is left out when drawn).
    const given = new Set(fields.map(p => p.ident));
    const extra = [...byIdent.keys()].filter(ident => !given.has(ident)).map(ident => schema.props.find(p => p.ident === ident)).filter(Boolean);
    // text as it reads; words as written, links whole, for the box that changes it; stored as Logseq holds it.
    const props = await Promise.all([...fields, ...extra].map(async prop => ({ prop, values: await Promise.all((byIdent.get(prop.ident) || []).map(async v => { const words = v.day ? '' : await readable(v.text); return { id: v.id ?? null, uuid: v.day ? '' : String(v.uuid || ''), text: v.day ? twoWay.dayText(v.day) : words.replace(/\[\[([^\]]+)\]\]/g, '$1'), words, stored: v.text }; })) })));
    // The property that points at this page stays in the list (the owner, 2026-10-27: "the nodes should actually have the
    // property that points to in the property list as well so there isn't confusion about relationship").
    const kept = props;
    const ids = kept.flatMap(r => r.values.map(v => v.id)).filter(Number.isSafeInteger);
    const most = state.ball.has(uuid) ? 500 : BULLETS;
    const [tags, bullets, guesses] = await Promise.all([
      twoWay.provided.firstTags ? twoWay.provided.firstTags(ids).catch(() => new Map()) : new Map(),
      Promise.all(lines.map(async line => ({ uuid: line.uuid, text: await readable(line.title) }))),
      !look && kept.some(r => !r.values.length) && twoWay.provided.nodeProposals ? twoWay.provided.nodeProposals(uuid).catch(() => []) : []]);
    const empty = new Set(kept.filter(r => !r.values.length).map(r => r.prop.ident));
    // Which of the nodes that link here, and of its own bullets, hold bullets of their own: those get the folded ring.
    await twoWay.readKids([...rows.flatMap(g => g.items.map(item => item.uuid)), ...lines.map(line => line.uuid)]);
    // And the node itself, read again here after a bullet is written in it or emptied, so its own dot is right once it folds.
    if (bullets.some(line => line.text)) state.kids.add(String(uuid).toLowerCase()); else state.kids.delete(String(uuid).toLowerCase());
    state.node.set(uuid, { looked: look, props: kept, rows, tags, bullets: bullets.filter(line => line.text || state.keepEmpty.has(line.uuid)).slice(0, most), more: lines.length > most,
      guesses: new Map(guesses.filter(g => empty.has(g.ident) && (g.kind !== 'day' || g.journalId)).map(g => [g.ident, g])) });
  })().finally(() => reading.delete(key));
  reading.set(key, job);
  return job;
}
const shownNode = uuid => [...state.dig.keys()].some(k => k.endsWith('>' + uuid)) || state.steps.some(s => s.uuid === uuid);
// Read again, then drawn, for every open node that shows this one (a change made in it, the graph changed).
async function readAgain(uuid) { await readNode(uuid); if (shownNode(uuid)) twoWay.draw(host()); }
async function toggleDig(key, uuid, id, title) {
  if (state.dig.has(key)) { shared.outline.close(state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`), () => closeDig(key)); return; }
  const from = nameRect(key);
  state.dig.set(key, { uuid, id: Number(id) || 0, title });
  state.focus = key;
  const had = state.node.has(uuid);
  if (!had) { state.html = null; twoWay.draw(host()); await readNode(uuid, id, { look: true }).catch(error => warnOnce('could not read a node', error)); }
  if (!state.dig.has(key)) return;
  // Read by a look and nothing to show yet but empty properties: what the proposals would fill in decides, so it is read
  // whole before anything opens, and an empty box is never drawn while it is asked.
  const data = state.node.get(uuid);
  if (data?.looked && !nodeHtml(uuid, key, data, false, false).trim()) { await readNode(uuid, id).catch(error => warnOnce('could not read a node', error)); if (!state.dig.has(key)) return; }
  // Nothing more to show: nothing opens, and the arrow goes, as in Logseq for a bullet with nothing under it.
  if (!holdsMore(uuid, key)) { closeDig(key); return; }
  state.fresh = key; state.html = null; twoWay.draw(host()); state.fresh = '';
  fitOrShift(key, from);
  // Read again behind what is drawn, this time with what the proposals would fill in: opening never waits for the earlier lines.
  readNode(uuid, id).then(() => { if (state.dig.has(key) && !holdsMore(uuid, key)) return closeDig(key); state.html = null; twoWay.draw(host()); }).catch(() => {});
}
function closeDig(key) {
  if (state.findDug.has(key)) state.findDug.set(key, false);
  for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k);
  if (state.focus === key || state.focus.startsWith(key + '>')) state.focus = state.dig.has(parentKey(key)) ? parentKey(key) : '';
  state.html = null; twoWay.draw(host());
}
/* The shift (the owner's mockup https://claude.ai/artifact/J4RLe8Kmo6dbXp2nUmfUfG): the node one level below the
   top becomes the section's top, read like a page (its properties, then the nodes linking to it as rows), and the top
   goes into the trail; the levels open under it stay open, the new one with them. Every opened node keeps its key, the
   whole path from the page, so nothing is moved between keys: a step only says where the view starts. The outline
   moves as one piece from where the clicked node was, so the eye stays on it. */
function shiftOnce(key) {
  const t = topStep(), at = (t?.key ? t.key.split('>').length : 1) + 1;
  const firstKey = key.split('>').slice(0, at).join('>'), first = state.dig.get(firstKey);
  if (!first) return false;
  state.steps = [...state.steps, { uuid: first.uuid, id: first.id, title: first.title, key: firstKey, entered: true }];
  return true;
}
/* When the shift comes (the owner: "shift as soon as lines would break, rather than always at the fourth
   level"): a node just opened is measured as drawn; while one of its own lines breaks (a name on two lines, its tag
   dropped under it, a line wider than the section) and it is more than one level below the top, the outline shifts by
   one level. Then the section slides once from where the clicked line was. */
function breaks(key) {
  const kids = state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`);
  if (!kids) return false;
  for (const line of kids.querySelectorAll('.th-ol-line')) {
    if (line.closest('.th-ol-kids') !== kids) continue;
    const name = line.querySelector('.th-ol-name, .th-tw-record'), pname = line.querySelector(':scope > .th-ol-pname');
    if (line.scrollWidth > line.clientWidth + 1) return true;
    // A property's name on two lines is a break too (the reviewer: "Therapy regimen" split under cisplatin).
    if (pname?.textContent.trim() && pname.getBoundingClientRect().height > 1.6 * (parseFloat(getComputedStyle(pname).lineHeight) || 21)) return true;
    if (!name) continue;
    if (name.getClientRects().length > 1) return true;
    const tag = name.parentElement?.querySelector(':scope > .th-tag');
    if (tag && tag.getBoundingClientRect().top > name.getBoundingClientRect().top + 4) return true;
  }
  return false;
}
// When even one level under the top would break (a narrow section), shifting all the way gives nothing back (the
// reviewer: at 445 px every click shifted): the lines wrap, as Logseq's own outline does, and the outline shifts only
// as far as keeps two levels under the top, the parent still in view.
function fitOrShift(key, from) {
  const before = state.steps.slice();
  while (state.dig.has(key) && below(key) > 1 && breaks(key) && shiftOnce(key)) { state.html = null; twoWay.draw(host()); }
  if (state.dig.has(key) && breaks(key)) {
    state.steps = before;
    while (state.dig.has(key) && below(key) > 2 && shiftOnce(key)) { /* to two levels under the top */ }
    state.html = null; twoWay.draw(host());
  }
  if (state.steps.length !== before.length) glide(key, from);
}
const nameRect = key => state.box?.querySelector(`.th-chev[data-dig="${CSS.escape(key)}"]`)?.closest('.th-ol-line')?.getBoundingClientRect() || null;
// The section slides from where the clicked line was to where it is now, as one piece.
function glide(key, from) {
  const box = state.box, now = nameRect(key);
  if (!box || !from || !now || box.ownerDocument.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  box.animate?.([{ transform: `translate(${Math.round(from.left - now.left)}px, ${Math.round(from.top - now.top)}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.25,.8,.25,1)' });
}
/* Back to a step of the trail (-1: the page): the view starts there again, with what was open under it, as deep as fits;
   the node that was the top stays open in place and has the focus, so Esc goes on closing upwards. */
function stepBack(to) {
  const was = topStep();
  state.steps = to < 0 ? [] : state.steps.slice(0, to + 1);
  // Measured as on the way down (the reviewer: back by the trail reopened lines that break): what is open under the new
  // top stays open as deep as its lines fit; a deeper level that would break is closed, the deepest first.
  state.html = null; twoWay.draw(host());
  for (let guard = 0; guard < 50; guard++) {
    const deepest = [...state.dig.keys()].filter(k => below(k) > 1).sort((a, b) => b.split('>').length - a.split('>').length)[0];
    if (!deepest || !breaks(deepest)) break;
    for (const k of [...state.dig.keys()]) if (k === deepest || k.startsWith(deepest + '>')) state.dig.delete(k);
    state.html = null; twoWay.draw(host());
  }
  // The focus goes to the deepest node still open on the way down (the reviewer: with the outermost, one Esc closed all
  // three levels at once).
  const on = was?.key ? [...state.dig.keys()].filter(k => k === was.key || k.startsWith(was.key + '>')) : [];
  state.focus = on.sort((a, b) => b.split('>').length - a.split('>').length)[0] || '';
  const top = topStep();
  if (top && !state.node.has(top.uuid)) readNode(top.uuid, top.id).then(() => { state.html = null; twoWay.draw(host()); }).catch(() => {});
  state.html = null; twoWay.draw(host());
}
// The section stepped into a node: the trail (the page, each step, the one shown with its tag), then what it holds.
function steppedHtml() {
  const top = state.steps[state.steps.length - 1];
  if (!top.key) { state.steps = []; return null; } // kept from: back on the page
  const tagOf = state.node.get(state.steps[state.steps.length - 2]?.uuid)?.tags;
  const tag = [...(tagOf?.entries() || [])].find(([id]) => id === top.id)?.[1] || twoWay.tagOfNode(top.uuid);
  const steps = [{ text: state.pageTitle || 'this page', attrs: { 'data-step': '-1' } }, ...state.steps.slice(0, -1).map((s, i) => ({ text: s.title, attrs: { 'data-step': String(i) } }))];
  const data = state.node.get(top.uuid);
  if (!data) return `<div class="th-tw-stepped th-ol">${O.trail(steps, `${esc(top.title)}${tag ? twoWay.tagLink({ tag }) : ''}`)}</div>`;
  // Its rows as the page's: what links to it, the way back left out.
  const path = [...state.steps.map(s => s.uuid), ...pathOf(top.key)];
  const groups = data.rows.map(g => ({ ...g, ident: '', items: g.items.filter(item => !onTheWay(path, item.uuid)) })).filter(g => g.items.length);
  const many = groups.reduce((n, g) => n + g.items.length, 0);
  state.drawingTop = true;
  let rows = '';
  try { rows = groups.map(g => twoWay.rowHtml(g, top)).join(''); } finally { state.drawingTop = false; }
  const line = many ? `<div class="th-tw-toplinks"><span class="lk-count">${many}</span> ${many === 1 ? 'node links' : 'nodes link'} here</div>` : '';
  return `<div class="th-tw-stepped th-ol">${O.trail(steps, `${esc(top.title)}${tag ? twoWay.tagLink({ tag }) : ''}`)}<div class="th-tw-stepbody">${nodeHtml(top.uuid, top.key, data, true)}</div></div>${line}${rows}`;
}
/* The focus moved by a click inside another open node, in place: only the wash moves. */
function setFocus(key) {
  if (state.focus === key || !state.box) return;
  state.focus = key;
  shared.outline.focus(state.box, key);
}
/* Where you are: once the names on the way scroll off, they stay pinned at the top of the section, the deepest
   last, each a click back to its line. Drawn on scroll into a line that takes no room. */
function pinNow() {
  const box = state.box, pin = box?.querySelector('.th-tw-pin');
  if (!pin) return;
  // The top of what can be read: under Logseq's top bar, which lies over the page.
  const scroller = box.closest('#main-content-container');
  const head = box.ownerDocument.querySelector('#head, .cp__header');
  const sTop = scroller?.getBoundingClientRect().top || 0, top = Math.max(sTop, head?.getBoundingClientRect().bottom || 0);
  const pinTop = Math.round(top - sTop) + 'px';
  if (box.style.getPropertyValue('--th-tw-pin-top') !== pinTop) box.style.setProperty('--th-tw-pin-top', pinTop);
  const passed = [...box.querySelectorAll('.th-ol-unit[data-key]')].filter(unit => {
    const line = unit.firstElementChild, r = unit.getBoundingClientRect();
    const kids = unit.querySelector(':scope > .th-ol-kids');
    return line && kids && line.getBoundingClientRect().bottom < top && kids.getBoundingClientRect().bottom > top + 40;
  });
  // Each name with its tag, as on its line.
  const tagOn = unit => unit.firstElementChild.querySelector('.th-tag')?.textContent || '';
  const last = passed[passed.length - 1];
  // Shifted, the way back comes first: the page and every step, as the trail above shows them.
  const way = state.steps.length ? [{ text: state.pageTitle || 'this page', attrs: { 'data-step': '-1' } }, ...state.steps.map((s, i) => ({ text: s.title, attrs: { 'data-step': String(i) } }))] : [];
  const html = passed.length ? O.trail([...way, ...passed.slice(0, -1).map(unit => ({ text: titleOf(state.dig.get(unit.dataset.key)?.uuid || ''), attrs: { 'data-goto': unit.dataset.key } }))], esc(titleOf(state.dig.get(last.dataset.key)?.uuid || '')) + (tagOn(last) ? twoWay.tagLink({ tag: tagOn(last) }) : '')) : '';
  if (pin.innerHTML !== html) pin.innerHTML = html;
  pin.toggleAttribute('data-on', !!html);
}
// The line to write a bullet in, drawn again with the rows; what was typed comes back with it.
function focusNodeField(key) {
  const field = state.box?.querySelector(`.th-tw-node-field[data-key="${CSS.escape(key)}"]`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
function keepNodeField(box) {
  for (const field of box.querySelectorAll('.th-tw-node-field')) {
    const uuid = field.dataset.uuid, key = field.dataset.key;
    if (state.nodeDraft?.key === key) field.value = state.nodeDraft.text;
    twoWay.keepGhost(field);
    field.addEventListener('input', () => { state.nodeDraft = { uuid, key, text: field.value }; twoWay.lookName(field, twoWay.tagOfNode(uuid)).catch(() => {}); });
    field.addEventListener('focus', () => setFocus(key));
    field.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); twoWay.clearGhost(); const typed = field.value; field.value = ''; writeBullet(uuid, key, typed).catch(error => warnOnce('could not add the bullet', error)); }
      else if (event.key === 'Escape') { event.preventDefault(); if (twoWay.looking.hit && twoWay.looking.key === twoWay.lineKey(field)) twoWay.clearGhost(); else field.blur(); }
      else if (event.key === 'ArrowRight') { if (twoWay.takeGhost(field)) event.preventDefault(); }
      else if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) twoWay.clearGhost();
    });
    field.addEventListener('blur', () => twoWay.leaveGhost(field));
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
// Enter adds the bullet at the node's end, as if typed there, and the empty bullet after it takes the caret for the next.
async function writeBullet(uuid, key, typed) {
  const text = String(typed || '').trim();
  if (!text) return;
  state.nodeDraft = null;
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  try {
    const block = await twoWay.model.addLineTo(uuid, text);
    if (!block?.uuid) throw new Error('the bullet was not made');
    await readAgain(uuid);
    focusNodeField(key);
    await twoWay.offerMade(block.uuid, `Added a bullet to “${twoWay.shortName(titleOf(uuid))}”`, async () => { await twoWay.model.removeBlock(block.uuid); await readAgain(uuid); twoWay.later(300); }, group?.name, twoWay.inBox(`[data-bullet="${CSS.escape(block.uuid)}"] .th-ol-words`));
  } catch (error) {
    warnOnce('could not add the bullet', error); notify('The bullet could not be added', 'warning');
    state.nodeDraft = { uuid, key, text };   // the words are not lost with it
    const field = state.box?.querySelector(`.th-tw-node-field[data-key="${CSS.escape(key)}"]`);
    if (field && !field.value) field.value = text;
  }
  twoWay.later(300);
}
/* A bullet of an opened node changed where it stands (7 November 2026, the owner: "Allow me to edit bullet in the thread"):
   a click on its words, or Enter on them once Tab has reached them, turns them into a box on the same place, as a value's is
   (editInPlace); the words are saved as they are typed, at each pause, as in Logseq; Enter or a click away ends it, Shift-Enter
   breaks a line, Escape puts back the words it had. The words are as written, a link whole ([[Page]]), a reference ((id)) left
   as it is, and are written back as Logseq holds a link; emptied, the bullet keeps its words. Ending it shows the new words in
   place at once, never the old ones for a moment. The faded Undo arrow puts the old words back, unless the bullet has
   changed since (in Logseq, say), when it stays and says so. The bullet's dot opens it, as the whole line did before. */
const ownerOf = bullet => { for (const [uuid, data] of state.node) if (data.bullets.some(line => line.uuid === bullet)) return uuid; return ''; };
/* Enter keeps the words and starts the next bullet under them, the caret in it, as Enter does in Logseq (C12, 7 November 2026);
   Escape, or the new bullet left empty, takes the new one away again. A click away just keeps. */
async function editBullet(uuid) {
  const how = await editBulletOnce(uuid);
  if (how !== 'enter') return;
  const owner = ownerOf(uuid);
  if (!owner) return;
  const block = await twoWay.model.insertBlock(uuid, '', { sibling: true, focus: false }).catch(error => { warnOnce('could not start the next bullet', error); return null; });
  if (!block?.uuid) return;
  const made = String(block.uuid);
  state.keepEmpty.add(made);
  await readAgain(owner);
  await editBulletOnce(made, { fresh: true });
  state.keepEmpty.delete(made);
  const words = await twoWay.provided.titleNow(made).catch(() => '');
  if (!String(words || '').trim()) { await twoWay.model.removeBlock(made).catch(() => {}); await readAgain(owner); return; }
  await readAgain(owner);
  const group = state.groups.find(g => g.items.some(item => item.uuid === owner));
  await twoWay.offerMade(made, `Added a bullet to “${twoWay.shortName(titleOf(owner))}”`, async () => { await twoWay.model.removeBlock(made); await readAgain(owner); twoWay.later(300); }, group?.name, twoWay.inBox(`[data-edit-bullet="${CSS.escape(made)}"]`));
  twoWay.later(300);
}
async function editBulletOnce(uuid, { fresh = false } = {}) {
  const find = twoWay.inBox(`[data-edit-bullet="${CSS.escape(uuid)}"]`);
  if (!find() || find().querySelector('.th-in-place')) return '';
  // A bullet just made empty has no words stored yet: it starts from nothing.
  const stored = (await twoWay.provided.titleNow(uuid)) ?? (fresh ? '' : null);
  if (stored == null || !find()) return '';
  let ended = '';
  const words = String(await twoWay.provided.readableTitle(stored, { pagesOnly: true, asShown: true }) ?? stored);
  // The words are saved as they are typed, as in Logseq's own bullets (the owner, 7 November 2026: "you shouldn't need to press
  // enter for text to save"): a pause in typing writes them; Enter, a click away or leaving the page keeps the last of them.
  let written = stored.trim(), timer = 0, saving = Promise.resolve();
  const save = text => (saving = saving.then(async () => {
    const t = String(text || '').trim();
    if (!t) return;
    const now = (await twoWay.provided.storedWords(t)).trim();
    if (now === written) return;
    await twoWay.model.setWords(uuid, now);
    written = now;
    twoWay.peek.cache.clear();
  }).catch(error => { warnOnce('could not change the bullet', error); notify('The bullet could not be changed', 'warning'); }));
  const onType = text => { clearTimeout(timer); timer = setTimeout(() => save(text), 400); };
  const typed = await shared.editInPlace({ at: find(), value: words, wrap: true, again: find, onType, onEnd: how => { ended = how; }, show: text => text.trim() ? twoWay.lineHtml(text.trim(), 400) : null });
  clearTimeout(timer);
  const next = typed?.trim();
  // Escape, or the words emptied: the bullet goes back to what it was, even if a pause had saved some of the typing.
  let reverted = false;
  if (next) await save(next); else { await saving; if (written !== stored.trim()) { await twoWay.model.setWords(uuid, stored); written = stored.trim(); reverted = true; } }
  await saving;
  const owner = ownerOf(uuid);
  if (written === stored.trim()) { if (reverted && owner) await readAgain(owner); return ended; }
  if (fresh) return ended;   // a bullet just started by Enter: its Undo is the one that takes it away
  const wrote = await twoWay.provided.titleNow(uuid);
  twoWay.peek.cache.clear();
  if (owner) await readAgain(owner); else twoWay.later(0);
  // Enter took the box away and left nothing in focus: the words take it, so Enter again changes them again. A click away left it elsewhere.
  const doc = host();
  if (!doc.activeElement || doc.activeElement === doc.body) find()?.focus({ preventScroll: true });
  const group = state.groups.find(g => g.items.some(item => item.uuid === owner));
  twoWay.offerUndo(`Changed a bullet of “${twoWay.shortName(titleOf(owner))}”`, async () => {
    if (await twoWay.provided.titleNow(uuid) !== wrote) return notify('It has changed since, so it stays', 'warning');
    await twoWay.model.setWords(uuid, stored);
    twoWay.peek.cache.clear();
    if (owner) await readAgain(owner);
    twoWay.later(300);
  }, group?.name, find);
  twoWay.later(300);
  return ended;
}
/* Cmd-Z (Ctrl-Z) presses Threads' faded arrow while the keyboard is in the section and the arrow is on screen (C18, 7 November
   2026); anywhere else, or while typing, the key stays Logseq's. */
twoWay.starters.push(() => {
  const doc = host();
  const onKey = event => {
    if (event.key?.toLowerCase() !== 'z' || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
    const at = doc.activeElement;
    if (!at?.closest?.('.th-two-way') || at.closest('input, textarea, [contenteditable="true"]')) return;
    const keys = [...(shared.undo.keys?.() || [])].filter(k => String(k).startsWith('two-way:'));
    if (!keys.length) return;
    event.preventDefault(); event.stopPropagation();
    shared.undo.take(keys[keys.length - 1]);
  };
  twoWay.listen(doc, 'keydown', onKey, true);
});
// The way in from the keyboard: Enter on a bullet's words, as Enter on a selected bullet in Logseq.
twoWay.starters.push(() => {
  const onKey = event => {
    const words = event.key === 'Enter' && !event.isComposing && !event.shiftKey && event.target.closest?.('[data-edit-bullet]');
    if (!words) return;
    event.preventDefault(); event.stopPropagation();
    editBullet(words.dataset.editBullet).catch(error => { warnOnce('could not change the bullet', error); notify('The bullet could not be changed', 'warning'); });
  };
  twoWay.listen(host(), 'keydown', onKey);
});
/* Taking what the proposals pencilled into an opened node: a click on one, or "Take what is proposed" for all;
   the faded Undo arrow empties them again. */
async function takeGuesses(uuid, idents) {
  const data = state.node.get(uuid);
  if (!data) return;
  const taken = [];
  for (const ident of idents) {
    const g = data.guesses.get(ident), prop = data.props.find(r => r.prop.ident === ident)?.prop;
    if (!g || !prop) continue;
    try {
      if (g.kind === 'node') await twoWay.setValues(uuid, prop, prop.many ? g.ids : g.ids.slice(0, 1));
      else if (g.kind === 'day') await twoWay.setValues(uuid, prop, [g.journalId]);
      else if (g.kind === 'number') await twoWay.model.setValue(uuid, ident, Number(g.shown));
      else continue;
      taken.push({ ident, title: g.title });
    } catch (error) { warnOnce('could not fill a proposed value', error); }
  }
  if (!taken.length) return;
  twoWay.peek.cache.clear();
  await readAgain(uuid);
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  await twoWay.offerKept(taken.map(t => [uuid, t.ident]), `Filled ${taken.map(t => `“${t.title}”`).join(', ')} on “${twoWay.shortName(titleOf(uuid))}”`, async () => { for (const t of taken) await twoWay.model.unsetValue(uuid, t.ident); twoWay.peek.cache.clear(); await readAgain(uuid); twoWay.later(300); }, group?.name, twoWay.inBox(`.th-ol-pname[data-edit="${CSS.escape(taken[taken.length - 1].ident)}"][data-uuid="${CSS.escape(uuid)}"] + .th-ol-pv`));
  twoWay.later(300);
}
/* A node's properties changed where they sit: a click on a property's name, or on what a plain one holds, asks
   for a new value in the kit's list, the likely ones first for a link (pickerOrder, when loaded), the choices for a
   choice, a day in words for a date, the words or the number as they are. A pick replaces one value, or for a property
   that holds several is added (one held already is taken off); Clear at the list's end, or empty and Enter where there
   is no list, clears it. The faded Undo arrow puts back what it held. A linked value's name opens what it names. */
async function editNodeProp(uuid, ident, at) {
  const row = state.node.get(uuid)?.props.find(r => r.prop.ident === ident);
  if (!row) return;
  const { prop } = row, name = twoWay.shortName(titleOf(uuid)), held = row.values.map(v => v.text);
  // Of several words or numbers: the one pressed; the property's name adds another.
  const one = prop.many && at?.dataset?.value != null ? row.values[Number(at.dataset.value)] : null;
  const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
  const isLink = kind === 'node' || kind === 'page', isDay = kind === 'date' || kind === 'datetime';
  let options = [];
  if (kind === 'choice') options = prop.choices.map(c => c.title);
  else if (isLink) {
    const takes = await twoWay.takerOf(prop), pages = (await twoWay.provided.propPages()).filter(p => !p.isTag && takes(p));
    const first = twoWay.provided.pickerOrder ? await twoWay.provided.pickerOrder(uuid, prop.title).catch(() => []) : [];
    const byId = new Map(pages.map(p => [p.id, p]));
    options = [...first.map(id => byId.get(id)).filter(Boolean), ...pages.filter(p => !first.includes(p.id))].map(p => p.title);
  } else if (kind === 'checkbox') options = ['yes', 'no'];
  const typedKind = !isLink && kind !== 'choice' && !isDay && kind !== 'checkbox', addsOne = typedKind && prop.many && !one && row.values.length > 0;
  const words = !typedKind || addsOne ? '' : one ? one.words : row.values.map(v => v.words).join(', ');   // as written: a link stays a link
  // In place, as Logseq does (1.0.3, the owner: "it is not a natural popup"): a page, a choice or yes/no is picked in
  // Logseq's own picker hanging under the value; a number, words or a day are typed where the value sits.
  const valueEl = one ? at.parentElement : at?.matches?.('.th-ol-pname') ? at.nextElementSibling : (at?.closest?.('.th-ol-pv') || at);
  let typed;
  if (options.length) {
    const picked = await shared.pickValue({ at: valueEl || at, placeholder: `Set ${prop.title}`, options: options.map(label => ({ label, held: held.includes(label) })),
      clearLabel: held.length ? 'Clear' : '', free: isLink });
    typed = picked == null ? null : picked.clear ? '' : (picked.typed ?? picked.label);
  } else typed = await shared.editInPlace({ at: valueEl || at, value: words, type: kind === 'number' ? 'number' : 'text', placeholder: isDay ? 'today, friday, 4 aug …' : '', again: one ? () => twoWay.inBox(`.th-tw-npvalue[data-edit="${CSS.escape(ident)}"][data-uuid="${CSS.escape(uuid)}"][data-value="${at.dataset.value}"]`)()?.parentElement : twoWay.valueBox(uuid, prop) });
  if (typed == null) return;
  const had = await twoWay.heldNow(uuid, prop);
  let done = '';
  const others = one ? had.filter(v => String(v) !== one.stored) : had;
  if (!typed.trim()) {
    if (!had.length || addsOne) return;
    if (one && others.length) await twoWay.setValues(uuid, prop, others); else await twoWay.model.unsetValue(uuid, prop.ident);
    done = `Cleared “${prop.title}”`;
  } else {
    if (words && typed.trim() === words) return;
    let value;
    if (kind === 'choice') value = prop.choices.find(c => c.title.toLowerCase() === typed.trim().toLowerCase())?.id;
    else if (isLink) value = (await twoWay.pageNamed(typed.trim(), prop))?.id;
    else if (isDay) value = await twoWay.dayValue(typed, kind);
    else if (kind === 'checkbox') value = /^(y|yes|true|1|on)$/i.test(typed.trim()) ? true : /^(n|no|false|0|off)$/i.test(typed.trim()) ? false : undefined;
    else if (kind === 'number') value = typed.trim() && Number.isFinite(Number(typed)) ? Number(typed) : undefined;
    else value = await twoWay.provided.storedWords(typed.trim());
    if (value == null) return notify(`“${typed.trim()}” is not a value “${prop.title}” takes, so nothing was changed`, 'warning');
    if (kind === 'choice' || isLink || isDay) await twoWay.setValues(uuid, prop, prop.many ? (had.includes(value) ? had.filter(v => v !== value) : [...had, value]) : [value]);
    else if (prop.many) await twoWay.setValues(uuid, prop, one ? had.map(v => String(v) === one.stored ? value : v) : [...had, value]);
    else await twoWay.model.setValue(uuid, prop.ident, value);
    done = `Set “${prop.title}”`;
  }
  twoWay.peek.cache.clear();
  await readAgain(uuid);
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  await twoWay.offerKept([[uuid, prop.ident]], `${done} on “${name}”`, async () => { await twoWay.setValues(uuid, prop, had); twoWay.peek.cache.clear(); await readAgain(uuid); twoWay.later(300); }, group?.name, twoWay.valueBox(uuid, prop));
  twoWay.later(300);
}
// A click inside the outline: a chevron opens or closes, a pencilled value is taken, "show all" shows all, a property's
// name or plain value is changed, a bullet opens itself, a link in a bullet its page. False: not one of these.
function onOutlineClick(event) {
  const t = event.target;
  const stop = () => { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); };
  const chev = t.closest('.th-chev[data-dig]');
  if (chev) { stop(); toggleDig(chev.dataset.dig, chev.dataset.uuid, chev.dataset.id, chev.dataset.title || '').catch(error => warnOnce('could not open a node', error)); return true; }
  const take = t.closest('[data-take]');
  if (take) { stop(); takeGuesses(take.dataset.uuid, [take.dataset.take]).catch(error => warnOnce('could not fill a proposed value', error)); return true; }
  const takeAll = t.closest('[data-takeall]');
  if (takeAll) { stop(); const uuid = takeAll.dataset.takeall; takeGuesses(uuid, [...(state.node.get(uuid)?.guesses.keys() || [])]).catch(error => warnOnce('could not fill the proposed values', error)); return true; }
  // The rest of a node the find field opened: it stays open, whole, as if dug.
  const findall = t.closest('[data-findall]');
  if (findall) { stop(); state.findDug.set(findall.dataset.findall, false); state.html = null; twoWay.draw(host()); return true; }
  const links = t.closest('[data-links]');
  if (links) { stop(); const k = links.dataset.links; if (state.linksShut.has(k)) state.linksShut.delete(k); else state.linksShut.add(k); state.html = null; twoWay.draw(host()); return true; }
  const nall = t.closest('[data-nall]');
  if (nall) { stop(); const key = nall.dataset.nall; if (state.nall.has(key)) state.nall.delete(key); else state.nall.add(key); state.html = null; twoWay.draw(host()); return true; }
  const ball = t.closest('[data-ball]');
  if (ball) { stop(); state.ball.add(ball.dataset.ball); readAgain(ball.dataset.ball).catch(error => warnOnce('could not read the bullets of a node', error)); return true; }
  const edit = t.closest('[data-edit]');
  if (edit) { stop(); editNodeProp(edit.dataset.uuid, edit.dataset.edit, edit).catch(error => { warnOnce('could not change a property of the node', error); notify('That could not be changed', 'warning'); }); return true; }
  const goto = t.closest('[data-goto]');
  if (goto) { stop(); state.box?.querySelector(`.th-ol-unit[data-key="${CSS.escape(goto.dataset.goto)}"]`)?.scrollIntoView({ block: 'start', behavior: shared.screen?.reduced?.() ? 'auto' : 'smooth' }); return true; }
  const page = t.closest('[data-open-page]')?.dataset.openPage;
  if (page) { stop(); twoWay.openPage(page, event.shiftKey); return true; }
  const step = t.closest('[data-open-uuid]')?.dataset.openUuid;
  if (step) { stop(); openEntity(step, event.shiftKey); return true; }
  // A bullet's words change where they stand; its dot opens it (Shift: in the sidebar).
  const words = !t.closest('a, button, input, textarea') && t.closest('[data-edit-bullet]');
  if (words) { stop(); editBullet(words.dataset.editBullet).catch(error => { warnOnce('could not change the bullet', error); notify('The bullet could not be changed', 'warning'); }); return true; }
  const bullet = !t.closest('a, button, input, textarea') && t.closest('.th-ol-bullet[data-bullet] > .th-ol-dot')?.parentElement;
  if (bullet) { stop(); openEntity(bullet.dataset.bullet, event.shiftKey); return true; }
  // A click inside another open node, not on anything that acts, moves the focus there.
  const inside = !t.closest('a, button, input') && t.closest('.th-ol-kids[data-key]');
  if (inside) setFocus(inside.dataset.key);
  return false;
}

Object.assign(twoWay, { closeDig, digChev, holdsMore, digKids, editBullet, focusNodeField, keepNodeField, onOutlineClick, pinNow, readNode, reading, stepBack, steppedHtml, topStep });
})();
