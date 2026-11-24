/* Digging: a node opened in place under its line (its properties, what points at it, its first bullets), the shift
   into a node when its lines would break, the trail back, and writing a bullet or a value into an opened node.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
// Given to each copy of the part (the main view's, and the right half's of two pages side by side); with no part loaded, nothing of it runs.
window.Threads.parts?.find(part => part.name === 'two-way')?.inner?.piece?.(twoWay => {
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
const PICTURES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic']);
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
/* On a ground (the owner, 23 November 2026, picture 1A: the node opened under a line "is unclear", it read as more of the outline):
   where the place that holds this node asks for it (data-lk-ground on the holder; Find's node under a line does), the node has no
   guide line from the margin, and a node opened inside it lies on one more layer of the library's ground (lk-ground), its top line
   saying its place (Look fills it) and holding the close ×, with the name that was opened lit (lk-opened). Elsewhere, as before. */
const grounded = () => !!twoWay.pane?.root?.(host())?.hasAttribute?.('data-lk-ground');
const groundTop = (key, uuid) => `<div class="lk-ground-top"><span data-lk-place="${esc(uuid)}"></span><button type="button" class="lk-close lk-i-x" data-dig="${esc(key)}" data-uuid="${esc(uuid)}" aria-label="Close ${esc(twoWay.shortName(titleOf(uuid)))}" title="Close"></button></div>`;
const lit = (html, open) => (open && grounded() ? html.replace('th-ol-open', 'th-ol-open lk-opened') : html);
// What an opened node holds, under its name; the hairline starts at the chevron of its line ('day', 'prop', 'back', '').
// node: it is a node opened from its name (a value, a node that links here), not a bullet's own children: on a ground it gets its layer.
function digKids(key, uuid, from, node = false) {
  const data = state.node.get(uuid);
  if (!data) return '';
  const fresh = state.fresh === key;
  // The names' column as wide as the longest name it holds, so none breaks onto two lines (C6, 7 November 2026), within
  // 7em and 16em: past that a name wraps between its words.
  const adding = state.addProp?.uuid === uuid && state.addProp.key === key ? state.addProp.prop.title.length : 0;
  const longest = Math.max(adding, ...data.props.filter(r => r.values.length || state.emptyOpen.has(key) || data.guesses.has(r.prop.ident)).map(r => r.prop.title.length), ...data.rows.map(g => String(g.label || '').length));
  const name = `clamp(7em, calc(${longest} * .6em + 58px), 16em)`;   // the letters, the kind's mark and its gap, the fold arrow's room ("Provider" took two lines at .56em + 42px, 11 November 2026)
  const on = grounded(), top = on && key.startsWith('node>') && !key.slice(5).includes('>');
  return O.kids({ html: (on && node ? groundTop(key, uuid) : '') + nodeHtml(uuid, key, data), from, fresh, cls: on && node ? 'th-ol-bare th-tw-ground lk-ground' : top ? 'th-ol-bare' : '', attrs: { 'data-key': key, style: `--th-tw-name: ${name}` } });
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
  /* The node's bullets are Logseq's own editor where Logseq lends it (plugin.js, Door.nodeEditor; 20 November 2026): typed in as on
     a page, the next bullet ready, pictures shown. Its properties stay this part's lines, every one of them on a line of its own
     with a value that opens in place, since following a value on to its node is what digging is (the owner, the same day, of a
     release that had put Logseq's own property line there, which shows a task's Status and Priority nowhere and opens no value in
     place: "this ruins the whole function of digging in relations"). In Find's window, a modal one where Logseq's editor could
     not be pressed, and while the find line narrows a node to its matching lines, the bullets are drawn here too, as before. */
  // TRIAL: a node with no bullet keeps Relations' one empty bullet (the hand test: Logseq's editor for an empty node left a faint bullet and a gap of four lines).
  if (field && !data.bullets?.length) (state.ownBullets ||= new Set()).add(key);
  // A node opened with no bullet keeps Relations' bullets while it stays open, so a line typed there and Enter go on there (the hand test: the switch to Logseq's editor lost the caret).
  const native = field && !onlyFound && !!data.bullets?.length && !state.ownBullets?.has(key) && twoWay.nativeNodes?.();
  // A value that is the way back (this page, or the node above) is left out: the row's property, on the left of the line
  // it opened from, already says how the node is tied here, and a thread cannot loop back on itself (the owner:
  // the line saying it again inside was "not right"). A property holding only the way back goes with it.
  const back = v => isUuid(v.uuid) && onTheWay(path, v.uuid);
  // A Date saying the day its line already shows in the margin is left out.
  const day = twoWay.lineDay.get(key) || '';
  // A property being added (addProp) stands as a line of its own while its value is asked for, whether or not the node's tags give it.
  const adding = state.addProp?.uuid === uuid && state.addProp.key === key ? state.addProp.prop : null;
  const rows = adding && !data.props.some(r => r.prop.ident === adding.ident) ? [...data.props, { prop: adding, values: [] }] : data.props;
  for (const { prop, values: all } of rows) {
    const values = all.filter(v => !back(v));
    if (all.length && !values.length) continue;
    if (day && prop.type === 'date' && values.length && values.every(v => v.text === day)) continue;
    const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
    const linked = (kind === 'node' || kind === 'page') && values.some(v => isUuid(v.uuid));
    const guess = !values.length ? data.guesses.get(prop.ident) : null;
    const found = twoWay.findsLine(prop, values) ? 'th-tw-match' : '';
    if (onlyFound && adding !== prop && (!found || (prop.type === 'date' && !twoWay.has(prop.title, twoWay.readFind().q)))) continue;
    // The name opens the property, as a property's name does in Logseq; its value is changed in the value's own area (12 November 2026,
    // the owner: "how do i go to the property if I have to click it to activate it. that should be in the value input area").
    const nameAttrs = { 'data-edit': prop.ident, 'data-uuid': uuid, 'data-prop': isUuid(prop.uuid) ? prop.uuid : null, title: isUuid(prop.uuid) ? `Open “${prop.title}”` : null, class: null };
    if (guess) { html += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, chev: O.room(), value: O.dot(true) + O.pencil(guess.shown || '', { 'data-take': prop.ident, 'data-uuid': uuid, title: `${guess.guess ? 'A guess from its words' : 'From its words'}: click to fill it in` }) }); continue; }
    if (!linked) {
      // Several words or numbers: each its own, changed one at a time; the property's name adds another.
      const one = (text, at = '') => `<button type="button" class="th-tw-npvalue lk-value${values.length ? '' : ' off'}" data-edit="${esc(prop.ident)}" data-uuid="${esc(uuid)}"${at} title="Change “${esc(prop.title)}”">${esc(text)}</button>`;
      const typed = !['choice', 'checkbox', 'date', 'datetime'].includes(kind);
      // Empty, it folds with the others into one line (C5, 7 November 2026: an empty property folds until you want it).
      // Each value a bullet of its own, in the column where a node's bullet stands, as Logseq draws a property's values (12 November
      // 2026, the owner: "Where are bullets for values?"); an empty property, or a proposal, keeps the bullet's room.
      if (!values.length) { const line = O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, chev: O.room(), value: O.dot(true) + one('empty') }); if (onlyFound || adding === prop) html += line; else { emptyNames.push(prop.title); empties += line; } continue; }
      values.forEach((v, i) => { html += O.prop({ kind, many: prop.many, name: i ? '' : prop.title, nameAttrs: i ? null : nameAttrs, cls: found, chev: O.room(), value: O.dot() + `<span class="th-ol-body">${one(v.text, typed && prop.many ? ` data-value="${i}"` : '')}</span>` }); });
      continue;
    }
    values.forEach((v, i) => {
      const k = `${key}>${v.uuid}`, open = state.dig.has(k);
      const item = { uuid: v.uuid, title: v.text, words: v.words, tag: data.tags.get(v.id) || '' };
      // One outline (the owner, 10 November 2026: "the property values can have bullets like normally, then a chevron can
      // appear next"): a value that is a node is a bullet, its fold arrow before it, as on a page's own properties.
      const vchev = isUuid(v.uuid) ? digChev(k, v.uuid, v.id, v.text, open) : '';
      const vdot = isUuid(v.uuid) ? O.dot(false, { uuid: v.uuid, closed: !open && !!vchev, title: v.text }) : '';
      const line = O.prop({ kind, many: prop.many, name: i ? '' : prop.title, nameAttrs: i ? null : nameAttrs, cls: found, chev: vchev || (vdot ? O.room() : ''), value: `${vdot}<span class="th-ol-body">${isUuid(v.uuid) ? lit(twoWay.nameHtml(item, open), open) : esc(v.text)}</span>` });
      html += open ? O.unit({ html: line + digKids(k, v.uuid, 'prop', true), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
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
    html += `<div class="th-ol-line lk-row th-tw-lhead th-tw-linkedline" title="${esc(`${many} ${many === 1 ? 'node links' : 'nodes link'} to ${twoWay.shortName(titleOf(uuid))}`)}">${O.chev({ open: !linkedShut, label: 'Relations', attrs: { 'data-links': key } })}${O.dot(true)}<span class="th-ol-body"><a class="th-tw-rule th-tw-rule-named" data-links="${esc(key)}" href="#"><span>Relations</span></a></span></div>`;   // the word and its line, as at the page's top (the owner, 12 November 2026: "put Linked----- within threads as well"; a thin line alone that morning)
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
        const line = O.line({ dot: { uuid: item.uuid, closed: !open && twoWay.hasKids(item.uuid), title: twoWay.shortName(item.title) }, chev: digChev(k, item.uuid, 0, twoWay.shortName(item.title), open), day: days[i] || (dated ? '' : null), body: `${lit(twoWay.nameHtml(item, open), open)}${O.from(days[i])}${!open && twoWay.hasKids(item.uuid) ? O.held(item.uuid) : ''}` });
        lines += open ? O.unit({ html: line + digKids(k, item.uuid, 'in', true), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
      });
      if (items.length > twoWay.INLINE) lines += O.more({ text: all ? 'show fewer' : `show ${items.length - twoWay.INLINE} more`, attrs: { 'data-nall': allKey }, under: dated ? 'dotday' : 'dot' });
      html += O.kids({ html: lines, cls: 'th-tw-lkids' });
    }
    html = outer + (linkedShut ? '' : O.kids({ html, cls: 'th-tw-linkedkids' }));
  }
  // Its words are changed where they stand (editBullet): a click, or Enter once Tab has reached them; its dot opens it.
  // A bullet holding bullets has Logseq's fold arrow and opens in place, one step in (the owner, 10 November 2026: "now we
  // cannot see children of bullets as we go deeper").
  if (!native) for (const line of data.bullets) {
    const k = `${key}>${line.uuid}`, open = state.dig.has(k), kids = twoWay.hasKids(line.uuid);
    const label = twoWay.shortName(line.text || 'the bullet');
    const chev = kids || open ? O.chev({ open, label, attrs: { 'data-dig': k, 'data-uuid': line.uuid, 'data-title': label } }) : O.room();
    /* A bullet that is a picture shows the picture, as it does on its page (the owner, 20 November 2026: "only the text of an asset
       appears"): at Logseq's own size for one (250 px wide until resized there). A press on it opens the
       picture's node; its name is not words to change here. Any other file keeps its name. */
    const picture = line.file && PICTURES.has(line.asset);
    const row = picture ? O.bullet({ html: `<span class="th-ol-asset" data-open-uuid="${esc(line.uuid)}" title="${esc(line.text)}"><img class="rounded-sm" src="${esc(line.file)}" alt="${esc(line.text)}" loading="lazy"></span>`, closed: kids && !open, held: line.uuid, attrs: { 'data-bullet': line.uuid }, wordsAttrs: { tabindex: '0' } }).replace('<div class="th-ol-bullet"', '<div class="th-ol-bullet th-ol-chevved"').replace(/(<div class="th-ol-bullet[^>]*>)/, `$1${chev}`)
      : O.bullet({ html: twoWay.lineHtml(line.text, 400), closed: kids && !open, held: line.uuid, attrs: { 'data-bullet': line.uuid }, wordsAttrs: { tabindex: '0', 'data-edit-bullet': line.uuid } }).replace('<div class="th-ol-bullet"', '<div class="th-ol-bullet th-ol-chevved"').replace(/(<div class="th-ol-bullet[^>]*>)/, `$1${chev}`).replace('<span class="th-ol-words"', `${twoWay.taskHtml(line)}<span class="th-ol-words"`);
    html += open ? O.unit({ html: row + digKids(k, line.uuid, 'in'), focus: state.focus === k, attrs: { 'data-key': k } }) : row;
  }
  if (!native && data.more) html += O.more({ text: 'show all its bullets', attrs: { 'data-ball': uuid } });
  if (!field) return html;
  if (native) return `${html}<div class="th-ls-node" data-ls-node="${esc(uuid)}"></div>`;
  // With no bullet of its own, the empty one stands ready to be written in (the owner, 20 November 2026: "there should be an empty bullet for ones without bullets already"); with bullets, it comes with Enter after the last, as before.
  const fieldHtml = O.newBullet({ label: `A new bullet inside ${twoWay.shortName(titleOf(uuid))}`, attrs: { class: 'th-tw-node-field', 'data-uuid': uuid, 'data-key': key } });
  html += data.bullets.length ? fieldHtml : fieldHtml.replace('class="th-ol-bullet th-ol-new"', 'class="th-ol-bullet th-ol-new th-ol-new-shown"');
  return html;
}
// What a node is called, wherever it was seen.
function titleOf(uuid) {
  if (twoWay.pane?.node && uuid === state.pageUuid && state.pageTitle) return twoWay.shortName(state.pageTitle.replace(/\[\[([^\]]+)\]\]/g, '$1'));
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
      Promise.all(lines.map(async line => ({ uuid: line.uuid, text: await readable(line.title), status: line.status || 0, asset: line.asset || '', file: line.file || '' }))),
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
const shownNode = uuid => (twoWay.pane?.node && uuid === state.pageUuid) || [...state.dig.keys()].some(k => k.endsWith('>' + uuid)) || state.steps.some(s => s.uuid === uuid);
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
  for (const k of [...(state.ownBullets || [])]) if (k === key || k.startsWith(key + '>')) state.ownBullets.delete(k);
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
  // On a ground each opened node has its own layer, which says where you are: nothing folds into a breadcrumb there, and a long line wraps as in Logseq's outline (a shift in a holder, which draws no breadcrumb, lost the opened node; found 23 November 2026).
  if (grounded()) return false;
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
    if (line.closest('.th-ol-kids[data-key]') !== kids) continue;
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
  /* TRIAL (digging tester, 20 November 2026, the owner: "can the view at least handle two levels before going to the breadcrumb
     outline per level"): two levels stay open in place under the node you are in (under a row of the page, the row's node and
     two more); a deeper dig folds the levels above into the breadcrumb, one line each. Every line glides to its new place. */
  const before = state.steps.slice(), rects = flipRects();
  // Under a row of the page: the row's node and two levels more; under the node you are in: two levels.
  while (state.dig.has(key) && below(key) > (state.steps.length ? 2 : 3) && shiftOnce(key)) { /* fold one more level into the breadcrumb */ }
  if (state.steps.length !== before.length) { state.html = null; twoWay.draw(host()); }
  // Still too narrow for its lines (a long name, the window): one more level folds, while two would stay.
  // Never before the third level from the page (the owner, 20 November 2026, of the first open going straight into the breadcrumb:
  // "sharp and drastic and unclear"): the row's node and the level under it always open in place.
  const deep = k => state.steps.length + below(k) >= 3;
  while (state.dig.has(key) && below(key) > 0 && deep(key) && (breaks(key) || rowBreaks(key)) && shiftOnce(key)) { state.html = null; twoWay.draw(host()); }
  if (state.steps.length !== before.length) flipPlay(rects, key);
}
/* The glide: each line of the section is measured before a change and after it, and moves from where it was to where it is
   (MOTION.dig); a line that comes fades in, a line that goes fades out where it stood. Lines are matched by the place they
   stand for (a node's key, a bullet, Logseq's editor), so a node folding into the breadcrumb is seen moving there. */
const FLIP = '.th-tw-bc, .th-tw-row, .th-ol-kids[data-key], .th-ol-line, .th-ol-prop, .th-ol-bullet, .th-ol-more, .th-tw-whole';
function flipKey(el) {
  if (el.dataset.flip) return el.dataset.flip;
  if (el.matches('.th-tw-row')) return 'row:' + el.dataset.field;
  if (el.matches('.th-ol-kids')) return 'k:' + el.dataset.key;
  if (el.matches('.th-tw-whole')) return 'whole';
  if (el.matches('.th-ol-more')) return 'more:' + (el.dataset.more || el.querySelector('[data-more]')?.dataset.more || el.textContent.trim());
  if (el.dataset.bullet) return 'b:' + el.dataset.bullet;
  const c = el.querySelector(':scope > .th-chev, :scope > * > .th-chev');
  if (c?.dataset.dig) return c.dataset.dig;
  if (c?.dataset.fold) return 'f:' + c.dataset.fold;
  // A line with no arrow: a property by its name in its node, any other by the node it names.
  const at = el.closest('.th-ol-kids[data-key]')?.dataset.key || '', pname = el.querySelector(':scope > .th-ol-pname')?.textContent.trim();
  if (pname) return `p:${at}:${pname}`;
  const named = el.querySelector('[data-uuid]')?.dataset.uuid;
  return named ? `n:${at}:${named}` : '';
}
function flipRects() {
  const map = new Map(), box = state.box;
  if (!box || window.PluginDoor.still(box)) return map;
  for (const el of box.querySelectorAll(FLIP)) { const k = flipKey(el); if (k && !map.has(k)) map.set(k, el.getBoundingClientRect()); }
  return map;
}
/* Every piece moves by how far it went less how far the piece around it goes: with one easing for all, a line inside a moving
   box follows the box and its own way at once, so nothing crosses another. A piece that was not there fades in once the rest
   is under way; nothing of what went is left behind. */
function flipPlay(before, dug = '') {
  const box = state.box;
  if (!box || !before.size) return;
  /* The node just opened moves as one piece: its lines follow it and never glide on their own. Matched one by one, some held still
     while the rest of the node slid past them, and "Relations" and "Charged" crossed the Oct 14 row (found by hand on 0.4.10,
     20 November 2026, the third dig on Chase Checking). */
  const { ms, ease } = window.PluginDoor.MOTION.dig, moves = new Map(), faded = new Set(), seen = new Set();
  const whole = dug ? box.querySelector(`.th-ol-kids[data-key="${CSS.escape(dug)}"]`) : null;
  /* Not drawn before the change, it waits unseen while the lines around it slide to their places, then fades in where it stands: shown at
     once, the bill's "Day of the Month" slid down through it (the check's wide window, 20 November 2026). */
  if (whole && !before.has('k:' + dug)) whole.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms * .5, delay: ms * .6, easing: ease, fill: 'backwards' });
  const around = el => { for (let p = el.parentElement; p && p !== box; p = p.parentElement) if (moves.has(p)) return moves.get(p); return [0, 0]; };
  for (const el of box.querySelectorAll(FLIP)) {
    const k = flipKey(el);
    if (!k || seen.has(k)) continue; seen.add(k);
    if ([...faded].some(f => f.contains(el))) continue;
    if (whole && whole !== el && whole.contains(el)) continue;
    const was = before.get(k), now = el.getBoundingClientRect();
    /* A piece that comes waits, unseen, until the moving pieces are nearly home, then fades in: shown at once where it will stand while
       the rest still glided there, "Relations" and "Charged" stood over the Oct 14 row for four frames (found by hand on 0.4.10,
       20 November 2026, the third dig on Chase Checking). */
    if (!was) { if (el.matches('.th-ol-kids, .th-tw-row, .th-tw-whole')) continue; el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms * .5, delay: ms * .6, easing: ease, fill: 'backwards' }); faded.add(el); continue; }
    const [ax, ay] = around(el), dx = was.left - now.left, dy = was.top - now.top, rx = dx - ax, ry = dy - ay;
    if (Math.abs(rx) + Math.abs(ry) > .5) el.animate([{ transform: `translate(${rx}px, ${ry}px)` }, { transform: 'none' }], { duration: ms, easing: ease });
    moves.set(el, [dx, dy]);
  }
}
// Any line of the section wrapping (a name on two lines, its tag under it, wider than the section), the breadcrumb aside.
function sectionBreaks() {
  for (const line of state.box?.querySelectorAll('.th-ol-kids[data-key] .th-ol-line') || []) {
    if (line.scrollWidth > line.clientWidth + 4) return true;
    const name = line.querySelector('.th-ol-name, .th-tw-record');
    if (!name) continue;
    if (name.getClientRects().length > 1) return true;
    const tag = name.parentElement?.querySelector(':scope > .th-tag');
    if (tag && tag.getBoundingClientRect().top > name.getBoundingClientRect().top + 4) return true;
  }
  return false;
}
// The line a node opened from breaks too: its name on two lines, its tag under it, or wider than the section.
function rowBreaks(key) {
  const line = state.box?.querySelector(`.th-chev[data-dig="${CSS.escape(key)}"]`)?.closest('.th-ol-line, .th-ol-prop');
  if (!line) return false;
  if (line.scrollWidth > line.clientWidth + 4) return true;
  const name = line.querySelector('.th-ol-name, .th-tw-record');
  if (!name) return false;
  if (name.getClientRects().length > 1) return true;
  const tag = name.parentElement?.querySelector(':scope > .th-tag');
  return !!tag && tag.getBoundingClientRect().top > name.getBoundingClientRect().top + 4;
}
const nameRect = key => state.box?.querySelector(`.th-chev[data-dig="${CSS.escape(key)}"]`)?.closest('.th-ol-line')?.getBoundingClientRect() || null;
/* Back to a step of the trail (-1: the page): the view starts there again, with what was open under it, as deep as fits;
   the node that was the top stays open in place and has the focus, so Esc goes on closing upwards. */
/* Going back mirrors digging (the hand check of 0.4.10: Escape kept levels as breadcrumb bands that digging would have shown in
   place): what stays open is laid out by the same rule as on the way down, from the page: the row's node and two levels in place,
   then the breadcrumb, folding further only where a line would wrap. to: the breadcrumb line pressed (-1: the page); that node
   becomes the deepest one open, everything under it closes. */
const deepestOpen = () => [...state.dig.keys()].filter(k => !k.startsWith('node>')).sort((a, b) => b.split('>').length - a.split('>').length)[0] || '';
function refold() {
  state.steps = [];
  // The focus first: set after the drawing, it changed the next drawing and every line was put back, ending the glide.
  const key = deepestOpen();
  state.focus = key;
  state.html = null; twoWay.draw(host());
  if (!key) return;
  while (state.dig.has(key) && below(key) > (state.steps.length ? 2 : 3) && shiftOnce(key)) { /* as on the way down */ }
  state.html = null; twoWay.draw(host());
  const deep = k => state.steps.length + below(k) >= 3;
  while (state.dig.has(key) && below(key) > 0 && deep(key) && (breaks(key) || rowBreaks(key)) && shiftOnce(key)) { state.html = null; twoWay.draw(host()); }
}
/* Going back moves as opening does (the owner, 20 November 2026: "have it glide"): the place the dig began at changes its height by
   the library's roll (Door.regrow) while what it now holds fades in, so nothing crosses anything; lines matched one by one
   went wrong here, a box gliding one way while its lines held still. */
const placeOf = rowKey => rowKey && state.box?.querySelector(`.th-tw-bcwrap, .th-ol-unit[data-key="${CSS.escape(rowKey)}"]`);
function backGlide(change) {
  const rowKey = deepestOpen().split('>').slice(0, 2).join('>');
  const was = placeOf(rowKey)?.getBoundingClientRect().height;
  change();
  const now = placeOf(rowKey) || state.box?.querySelector(`.th-chev[data-dig="${CSS.escape(rowKey)}"]`)?.closest('.th-ol-line');
  if (!now || was == null || !state.dig.has(rowKey) || window.PluginDoor.still(now)) return;
  window.PluginDoor.regrow(now, was);
  const { ms, ease } = window.PluginDoor.MOTION.roll;
  now.animate([{ opacity: .35 }, { opacity: 1 }], { duration: ms, easing: ease });
}
function stepBack(to) {
  const keep = to >= 0 ? state.steps[to]?.key : '';
  backGlide(() => {
    for (const k of [...state.dig.keys()]) if (keep ? k.startsWith(keep + '>') : true) state.dig.delete(k);
    refold();
  });
  const top = topStep();
  if (top && !state.node.has(top.uuid)) readNode(top.uuid, top.id).then(() => { state.html = null; twoWay.draw(host()); }).catch(() => {});
}
function escapeBack() {
  const key = deepestOpen();
  if (!key) return false;
  // The row itself closing: it rolls back up first, as a fold does.
  if (key.split('>').length === 2 && !state.steps.length) {
    const kids = state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`);
    window.PluginDoor.rollUp(kids ? [kids] : []).then(() => { for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k); refold(); });
    return true;
  }
  backGlide(() => {
    for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k);
    refold();
  });
  return true;
}
/* TRIAL (digging tester): the breadcrumb as an outline (the owner, 20 November 2026: "make an outline based breadcrumb", then
   "do combo of a and d"): each level dug through is one line, one step further in, with its bullet and a short guide line,
   on a band a shade darker; the property followed stands before the node's name, so the lines read as the path. The last
   line is the node you are in. A press on a line goes back to it; Escape goes back one. */
function crumbsHtml() {
  const n = state.steps.length;
  return `<div class="th-tw-bcs">${state.steps.map((s, i) => {
    const prev = state.steps[i - 1], pdata = prev ? state.node.get(prev.uuid) : null;
    const prop = pdata?.props.find(r => r.values.some(v => v.uuid === s.uuid))?.prop.title || '';
    const tag = pdata?.tags?.get(s.id) || twoWay.tagOfNode(s.uuid) || '';
    const here = i === n - 1;
    return `<div class="th-tw-bc${here ? ' th-tw-bc-here' : ''}" data-flip="${esc(s.key)}"${here ? '' : ` data-step="${i}" role="button" tabindex="0" title="Back to ${esc(s.title)}"`} style="--th-bc: ${i}"><span class="lk-bul"></span>${prop ? `<span class="th-tw-bc-prop">${esc(prop)}</span>` : ''}<span class="th-tw-bc-name">${esc(s.title)}</span>${tag ? twoWay.tagLink({ tag }) : ''}</div>`;
  }).join('')}</div>`;
}
/* TRIAL: dug in, the list stays as it was; the row the dig began at shows the breadcrumb, then the node you are in, opened
   in place one step in (the owner's hand test: "the whole Chase Checking Relations section vanishes while dug in"). */
function inPlaceHtml(key) {
  const top = topStep();
  if (!top || state.steps[0]?.key !== key || !state.node.get(top.uuid)) return null;
  return `<div class="th-tw-bcwrap" style="--th-bcs: ${state.steps.length}">${crumbsHtml()}<div class="th-tw-bcbody">${digKids(top.key, top.uuid, 'in')}</div></div>`;
}
// The section stepped into a node: the trail (the page, each step, the one shown with its tag), then what it holds.
function steppedHtml() {
  const top = state.steps[state.steps.length - 1];
  if (!top.key) { state.steps = []; return null; } // kept from: back on the page
  const tagOf = state.node.get(state.steps[state.steps.length - 2]?.uuid)?.tags;
  const tag = [...(tagOf?.entries() || [])].find(([id]) => id === top.id)?.[1] || twoWay.tagOfNode(top.uuid);
  const steps = [{ text: state.pageTitle || 'this page', attrs: { 'data-step': '-1' } }, ...state.steps.slice(0, -1).map((s, i) => ({ text: s.title, attrs: { 'data-step': String(i) } }))];
  const data = state.node.get(top.uuid);
  if (!data) return `<div class="th-tw-stepped th-ol">${crumbsHtml()}</div>`;
  // Its rows as the page's: what links to it, the way back left out.
  const path = [...state.steps.map(s => s.uuid), ...pathOf(top.key)];
  const groups = data.rows.map(g => ({ ...g, ident: '', items: g.items.filter(item => !onTheWay(path, item.uuid)) })).filter(g => g.items.length);
  const many = groups.reduce((n, g) => n + g.items.length, 0);
  state.drawingTop = true;
  let rows = '';
  try { rows = groups.map(g => twoWay.rowHtml(g, top)).join(''); } finally { state.drawingTop = false; }
  const line = many ? `<div class="th-tw-toplinks"><span class="lk-count">${many}</span> ${many === 1 ? 'node links' : 'nodes link'} here</div>` : '';
  return `<div class="th-tw-stepped th-ol" style="--th-crumbs: ${state.steps.length}">${crumbsHtml()}<div class="th-tw-stepbody">${nodeHtml(top.uuid, top.key, data, true)}</div></div>${line}${rows}`;
}
/* A node's own words, changed where they stand (the owner, 19 November 2026: "if it is a link, can't you just press on the end to enter
   text mode just like a md link"; 20 November: "no, you cannot edit the text of the node"): a press on the words opens the node, a
   press just after the last word puts the caret in them. For a bullet only: a page's name is changed on its own page. el: the
   element holding the words, in this section or in another part's row (asked through the door, 'relations:editWords'). */
async function editWordsAt(uuid, el) {
  if (!isUuid(uuid) || !el) return false;
  const page = await Promise.resolve(twoWay.model.getPage(uuid)).catch(() => null);
  if (page && !page.page) return false;
  // The words stand in a link that is only as wide as they are: while they are changed it takes its whole line, or the box shrank to a few
  // letters' width and the words wrapped into a narrow column (the owner's recording, 20 November 2026).
  twoWay.hidePeek?.();
  el.classList.add('th-editing-words');
  try { await editBulletOnce(uuid, { at: () => (el.isConnected ? el : null) }); } finally { el.classList.remove('th-editing-words'); }
  return true;
}
/* The node a holder in another part's window stands for (two-way.js, nodePane), drawn exactly as a node opened in a list is: its
   properties to change, its bullets to write in, and under "Relations" what points at it, each a node that opens in turn. One
   drawing for an opened node, wherever it opens (rule 7, act in place). Nothing until the node is read. */
function nodeTopHtml() {
  const uuid = state.pageUuid;
  // Inside the outline's own frame (th-ol), which gives its lines their gaps and columns, as a list's value does on a page.
  return uuid && state.node.has(uuid) ? `<div class="th-tw-value th-ol th-tw-nodetop">${digKids(`node>${uuid}`, uuid, '')}</div>` : '';
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
  const scroller = twoWay.pane.scroller(box);
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
  const way = [];   // TRIAL: the breadcrumb in the list says the way back
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
      /* Backspace in the empty line goes up into the node's last bullet, its caret at the end, as Backspace in an empty bullet does
         in Logseq (found by hand on 0.4.10, 20 November 2026: the key did nothing there). */
      else if (event.key === 'Backspace' && !field.value && !event.metaKey && !event.altKey) {
        const last = state.node.get(uuid)?.bullets?.at(-1)?.uuid;
        if (last && twoWay.inBox(`[data-edit-bullet="${CSS.escape(last)}"]`)()) { event.preventDefault(); editBullet(last).catch(error => { warnOnce('could not change the bullet', error); notify('The bullet could not be changed', 'warning'); }); }
      }
      else if (event.key === 'ArrowRight') { if (twoWay.takeGhost(field)) event.preventDefault(); }
      else if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) twoWay.clearGhost();
    });
    /* Words typed into the ready bullet are kept when it is left, by Escape or by a press elsewhere, as Logseq keeps a bullet you
       typed (20 November 2026, found on the owner's screen in Find: a line typed there and left with Escape stood on screen and was
       never saved; until 0.4.5 this bullet showed only after Enter, so few met it). Only while the field still stands on the page:
       a field taken away by a redraw keeps its words as the draft and gets them back. */
    field.addEventListener('blur', () => {
      if (!field.ownerDocument.hasFocus()) return;   // another app in front: the words wait, as in a Logseq bullet
      twoWay.leaveGhost(field);
      const typed = field.value;
      if (!typed.trim() || !field.isConnected) return;
      field.value = ''; state.nodeDraft = null;
      writeBullet(uuid, key, typed, false).catch(error => warnOnce('could not add the bullet', error));
    });
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
/* Writing a bullet offers no Undo arrow (the owner, 20 November 2026: "you don't need an undo for writing a bullet"): words written or a
   bullet added in an opened node are plain writing, taken back as any writing is in Logseq. The arrow stays for what is set: a value, a tag, a status. */
// Enter adds the bullet at the node's end, as if typed there, and the empty bullet after it takes the caret for the next.
async function writeBullet(uuid, key, typed, stay = true) {
  const text = String(typed || '').trim();
  if (!text) return;
  state.nodeDraft = null;
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  try {
    const block = await twoWay.model.addLineTo(uuid, text);
    if (!block?.uuid) throw new Error('the bullet was not made');
    await readAgain(uuid);
    if (stay) focusNodeField(key);   // after Enter the caret waits in the empty line for the next; left by Escape or a press elsewhere, the keyboard is not pulled back (found by hand, 20 November 2026: Escape put the caret into the empty line)
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
// The bullet above another in its opened node, or '' for the first.
const bulletAbove = bullet => { for (const [, data] of state.node) { const i = data.bullets.findIndex(line => line.uuid === bullet); if (i >= 0) return i > 0 ? data.bullets[i - 1].uuid : ''; } return ''; };
/* Backspace in an empty bullet takes it away and puts the caret at the end of the bullet above, as in Logseq (found by hand on 0.4.10,
   20 November 2026: an emptied bullet could not be removed by Backspace). */
async function editBullet(uuid) {
  const above = bulletAbove(uuid);
  const how = await editBulletOnce(uuid);
  if (how === 'backspace') { if (above) await editBullet(above); return; }
  if (how !== 'enter') return;
  const owner = ownerOf(uuid);
  if (!owner) return;
  const block = await twoWay.model.insertBlock(uuid, '', { sibling: true, focus: false }).catch(error => { warnOnce('could not start the next bullet', error); return null; });
  if (!block?.uuid) return;
  const made = String(block.uuid);
  state.keepEmpty.add(made);
  await readAgain(owner);
  const next = await editBulletOnce(made, { fresh: true });
  state.keepEmpty.delete(made);
  const words = await twoWay.provided.titleNow(made).catch(() => '');
  if (!String(words || '').trim()) { await twoWay.model.removeBlock(made).catch(() => {}); await readAgain(owner); if (next === 'backspace') await editBullet(uuid); return; }
  await readAgain(owner);
  const group = state.groups.find(g => g.items.some(item => item.uuid === owner));
  twoWay.later(300);
}
async function editBulletOnce(uuid, { fresh = false, at = null } = {}) {
  // at: where the words stand when they are not a bullet of an opened node (a node's own line in a list, a row of Find or Todo).
  const find = at || twoWay.inBox(`[data-edit-bullet="${CSS.escape(uuid)}"]`);
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
  let last = '';   // the words as last typed, for a new bullet left by Escape
  const onType = text => { last = String(text || ''); clearTimeout(timer); timer = setTimeout(() => save(text), 400); };
  const typed = await shared.editInPlace({ at: find(), value: words, wrap: true, again: find, onType, escapeKeeps: true, backspaceEnds: !at, onEnd: how => { ended = how; }, show: text => text.trim() ? twoWay.lineHtml(text.trim(), 400) : null });
  clearTimeout(timer);
  /* What was typed is kept however the bullet is left, Escape included, as in a Logseq bullet (found by hand on the owner's screen,
     20 November 2026: words changed and left with Escape came back as they were). A bullet whose words were all deleted is deleted
     with them (the same trial: "deleting a line isn't saved … an empty line can't be removed"), unless it holds bullets of its own,
     which stay with their words and say why. A node's own words on its line (at) are never emptied this way: its words stay. */
  const next = typed?.trim() || '';
  const emptied = typed != null && !next;
  if (emptied && !at && !fresh) {
    await saving;
    // Asked of the graph now, not of what was read earlier: deleting a bullet takes its bullets with it.
    const holds = twoWay.hasKids(uuid) || (await Promise.resolve(twoWay.provided.firstLines(uuid, 1, true)).catch(() => [1])).length > 0;
    if (holds) { ended = ''; notify('This bullet holds bullets of its own: delete it on its page', 'warning'); }
    else {
      const owner = ownerOf(uuid);
      const gone = await twoWay.model.removeBlock(uuid).then(() => true).catch(error => { warnOnce('could not delete the bullet', error); notify('The bullet could not be deleted', 'warning'); return false; });
      if (gone) { twoWay.peek.cache.clear(); if (owner) await readAgain(owner); twoWay.later(300); return ended === 'backspace' ? 'backspace' : ''; }   // not 'enter': there is no bullet left for Enter to start the next under; 'backspace' sends the caret to the bullet above
    }
  }
  // The words emptied where they must stay: the bullet goes back to what it was, even if a pause had saved some of the typing.
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
    if (!at?.closest?.('.th-two-way') || !twoWay.mine(at) || at.closest('input, textarea, [contenteditable="true"]')) return;
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
    if (!words || !twoWay.mine(words)) return;
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
/* A node's properties changed where they sit: a click in a value's area, or on what a plain one holds, asks
   for a new value (the property's name opens the property) in the kit's list, the likely ones first for a link (pickerOrder, when loaded), the choices for a
   choice, a day in words for a date, the words or the number as they are. A pick replaces one value, or for a property
   that holds several is added (one held already is taken off); Clear at the list's end, or empty and Enter where there
   is no list, clears it. The faded Undo arrow puts back what it held. A linked value's name opens what it names. */
async function editNodeProp(uuid, ident, at) {
  const row = state.node.get(uuid)?.props.find(r => r.prop.ident === ident) || (state.addProp?.uuid === uuid && state.addProp.prop.ident === ident ? { prop: state.addProp.prop, values: [] } : null);
  if (!row) return false;
  const { prop } = row, name = twoWay.shortName(titleOf(uuid)), held = row.values.map(v => v.text);
  // Status: the same list a task's circle opens, each status with its icon in Logseq's order (the owner, 20 November 2026, of this row's plain list: "they look different").
  if (ident === twoWay.model.STATUS_IDENT && twoWay.setStatus) { const words = at?.closest?.('.th-ol-pv') || at; await twoWay.setStatus(words, { uuid, had: Number(row.values[0]?.id) || 0, name }); await readAgain(uuid); return true; }
  // Of several words or numbers: the one pressed; the property's name adds another.
  const one = prop.many && at?.dataset?.value != null ? row.values[Number(at.dataset.value)] : null;
  const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
  const isLink = kind === 'node' || kind === 'page', isDay = kind === 'date' || kind === 'datetime';
  let options = [], known = new Set(), nodes = [];
  if (kind === 'choice') options = prop.choices.map(c => c.title);
  else if (isLink) {
    const everyPage = await twoWay.provided.propPages(), takes = await twoWay.takerOf(prop), pages = everyPage.filter(p => !p.isTag && takes(p));
    known = new Set(everyPage.map(p => p.lower));
    const first = twoWay.provided.pickerOrder ? await twoWay.provided.pickerOrder(uuid, prop.title).catch(() => []) : [];
    const byId = new Map(pages.map(p => [p.id, p]));
    // Bullets that carry a tag stand in the list too, each with its page above, as in Logseq's own.
    const blocks = twoWay.provided.nodeBlocks ? (await twoWay.provided.nodeBlocks().catch(() => [])).filter(b => b.uuid !== uuid && takes(b)) : [];
    nodes = [...first.map(id => byId.get(id)).filter(Boolean), ...[...pages.filter(p => !first.includes(p.id)), ...blocks].sort((a, b) => a.lower.localeCompare(b.lower))];
  } else if (kind === 'checkbox') options = ['yes', 'no'];
  const typedKind = !isLink && kind !== 'choice' && !isDay && kind !== 'checkbox', addsOne = typedKind && prop.many && !one && row.values.length > 0;
  const words = !typedKind || addsOne ? '' : one ? one.words : row.values.map(v => v.words).join(', ');   // as written: a link stays a link
  // In place, as Logseq does (1.0.3, the owner: "it is not a natural popup"): a page, a choice or yes/no is picked in
  // Logseq's own picker hanging under the value; a number, words or a day are typed where the value sits.
  // The words of the value, not its line: its bullet stays where it stands while it is typed into.
  const words_ = pv => pv?.querySelector?.(':scope > .th-ol-body') || pv;
  const valueEl = one ? at.parentElement : at?.matches?.('.th-ol-pname') ? words_(at.nextElementSibling) : (words_(at?.closest?.('.th-ol-pv')) || at);
  let typed, pickedId = null;
  if (options.length || isLink) {
    const heldIds = new Set(row.values.map(v => v.id));
    const picked = await shared.pickValue({ at: valueEl || at, placeholder: `Set ${prop.title}`, options: isLink ? nodes.map(n => ({ label: n.title, id: n.id, crumb: n.crumb || '', held: heldIds.has(n.id) })) : options.map(label => ({ label, held: held.includes(label) })),
      clearLabel: held.length ? 'Clear' : '', free: isLink,
      // A name no page has makes the page, as Logseq's own picker does (12 November 2026, the owner: "I want this ability").
      make: isLink ? words => known.has(words.toLowerCase()) ? '' : `+ New option: ${words}` : null });
    typed = picked == null ? null : picked.clear ? '' : (picked.typed ?? picked.label);
    if (picked?.id != null && picked.typed == null) pickedId = picked.id;   // the very node picked: two bullets may say the same words
  } else typed = await shared.editInPlace({ at: valueEl || at, value: words, type: kind === 'number' ? 'number' : 'text', placeholder: isDay ? 'today, friday, 4 aug …' : '', again: one ? () => twoWay.inBox(`.th-tw-npvalue[data-edit="${CSS.escape(ident)}"][data-uuid="${CSS.escape(uuid)}"][data-value="${at.dataset.value}"]`)()?.parentElement : () => words_(twoWay.valueBox(uuid, prop)()) });
  if (typed == null) return false;
  // A property not made yet (addProp, a new name) holds nothing, and is made only once there is a value to give it.
  const had = prop.pending ? [] : await twoWay.heldNow(uuid, prop);
  let done = '', made = null, madePage = null;
  const others = one ? had.filter(v => String(v) !== one.stored) : had;
  if (!typed.trim()) {
    if (!had.length || addsOne) return false;
    if (one && others.length) await twoWay.setValues(uuid, prop, others); else await twoWay.model.unsetValue(uuid, prop.ident);
    done = `Cleared “${prop.title}”`;
  } else {
    if (words && typed.trim() === words) return false;
    let value;
    if (kind === 'choice') value = prop.choices.find(c => c.title.toLowerCase() === typed.trim().toLowerCase())?.id;
    else if (isLink) {
      value = pickedId ?? (await twoWay.pageNamed(typed.trim(), prop))?.id;
      if (value == null) { madePage = await pageFor(typed.trim(), prop); value = madePage?.id; }
    }
    else if (isDay) value = await twoWay.dayValue(typed, kind);
    else if (kind === 'checkbox') value = /^(y|yes|true|1|on)$/i.test(typed.trim()) ? true : /^(n|no|false|0|off)$/i.test(typed.trim()) ? false : undefined;
    else if (kind === 'number') value = typed.trim() && Number.isFinite(Number(typed)) ? Number(typed) : undefined;
    else value = await twoWay.provided.storedWords(typed.trim());
    if (value == null) { notify(`“${typed.trim()}” is not a value “${prop.title}” takes, so nothing was changed`, 'warning'); return false; }
    if (prop.pending) {
      const got = await twoWay.model.makeProperty(prop.title, prop.type).catch(async error => { if (madePage) await twoWay.model.deletePage(madePage.uuid).catch(() => {}); throw error; });
      Object.assign(prop, { ident: got.ident, id: got.id, uuid: got.uuid, pending: false });
      if (got.made) made = got;
    }
    if (kind === 'choice' || isLink || isDay) await twoWay.setValues(uuid, prop, prop.many ? (had.includes(value) ? had.filter(v => v !== value) : [...had, value]) : [value]);
    else if (prop.many) await twoWay.setValues(uuid, prop, one ? had.map(v => String(v) === one.stored ? value : v) : [...had, value]);
    else await twoWay.model.setValue(uuid, prop.ident, value);
    done = (made ? `Added the new property “${prop.title}”` : `Set “${prop.title}”`) + (madePage ? ` to the new page “${madePage.title}”` : '');
  }
  twoWay.peek.cache.clear();
  await readAgain(uuid);
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  await twoWay.offerKept([[uuid, prop.ident]], `${done} on “${name}”`, async () => {
    await twoWay.setValues(uuid, prop, had);
    // The page this change made goes with its value, to Logseq's Recycle, unless it has been written in or linked to since.
    if (madePage) { if (await twoWay.model.pageUnlinked(madePage.uuid).catch(() => false)) await twoWay.model.deletePage(madePage.uuid).catch(error => warnOnce('could not take the new page away', error)); else notify(`“${madePage.title}” is in use by now, so the page stays`, 'warning'); }
    // The property this change made goes with its value, unless something else holds it by now.
    if (made && !await twoWay.model.dropMadeProperty(made).catch(error => { warnOnce('could not take the new property away', error); return false; })) notify(`“${prop.title}” is in use elsewhere by now, so the property stays`, 'warning');
    twoWay.peek.cache.clear(); await readAgain(uuid); twoWay.later(300);
  }, group?.name, twoWay.valueBox(uuid, prop));
  twoWay.later(300);
  return true;
}
/* A page made for a value: a name no page has, typed where a property's page is picked. A page of that name in Logseq's Recycle is
   brought back instead; a name that something else answers to (a tag, a property, a day) makes nothing. The new page gets the
   property's tag when the property takes exactly one, as Logseq gives it. Answers { id, uuid, title } or null. */
async function pageFor(name, prop) {
  const named = await twoWay.model.getPage(name).catch(() => null);
  let page = null;
  if (named?.uuid) { if (!await twoWay.model.inRecycle(String(named.uuid)).catch(() => false)) return null; await twoWay.model.restorePage(String(named.uuid)); page = named; }
  else page = await twoWay.model.createPage(name, {}, { redirect: false, createFirstBlock: false });
  if (!page?.uuid) throw new Error('the page was not made');
  if (!named && prop.classes?.length === 1 && prop.classes[0].uuid) await twoWay.model.addTag(String(page.uuid), prop.classes[0].uuid).catch(error => warnOnce('the new page could not be given its tag', error));
  window.Threads.core.graphWide?.forget?.('inlinePropsPages');
  const id = page.id ?? await twoWay.provided.idByUuid(String(page.uuid));
  return id == null ? null : { id, uuid: String(page.uuid), title: name };
}
/* A property added to a node, as Logseq's own "Add property" adds one to a bullet (12 November 2026, the owner: "add properties
   just like you could on regular logseq node ... or create it if it does not exists already"). The ways in: "Add property…" in
   the right-click menu of a node's line or of a line inside an opened node, and Logseq's own key for it (Cmd-P unless changed)
   while the keyboard is on a node's name. One list, Logseq's own picker: the properties its tags give and it has not filled first,
   then every other property; a name no property has is offered as "+ New option: …", Logseq's own words, second in the list as in Logseq's, and asks its type, in Logseq's words and
   order. The property then stands as a line in the node, opened for it if it was closed, and its value is asked for where a
   value is changed (editNodeProp), so a page, a choice, a day, words and a number are each given as they always are. A new
   property is made only once it has a value; Escape at any step leaves everything as it was. The faded Undo arrow takes the
   value off again, and the property with it when this change made it and nothing else holds it. */
const keyOfLine = name => {
  const line = name?.closest('.th-ol-line, .th-ol-prop'), dug = line?.querySelector('[data-dig]')?.dataset.dig;
  if (dug) return dug;
  const kids = name?.closest('.th-ol-kids[data-key]'), row = name?.closest('.th-tw-row');
  const base = kids ? kids.dataset.key : topStep()?.key || (row ? `r:${row.dataset.field}` : '');
  return base && name.dataset.uuid ? `${base}>${name.dataset.uuid}` : '';
};
const nameAt = (key, uuid) => [...state.box?.querySelectorAll(`a.th-tw-record[data-uuid="${CSS.escape(uuid)}"]`) || []].find(a => keyOfLine(a) === key) || null;
async function addProp(uuid, key, title = '') {
  if (!isUuid(uuid) || !key || state.addProp) return;
  // The list stands under the node's last property line where the node's own name is not in this box (a node opened in Find or
  // Todo: its name is the other part's row), never at the box's corner (21 November 2026).
  const kidsOf = () => state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`);
  const at = () => nameAt(key, uuid) || [...(kidsOf()?.querySelectorAll('.th-ol-prop > .th-ol-pname') || [])].filter(n => n.closest('.th-ol-kids') === kidsOf()).pop() || kidsOf() || state.box;
  if (!state.node.has(uuid) || state.node.get(uuid).looked) await readNode(uuid);
  const data = state.node.get(uuid);
  if (!data) return;
  const schema = await twoWay.provided.propSchema();
  const holds = new Set(data.props.filter(r => r.values.length).map(r => r.prop.ident)), own = data.props.filter(r => !r.values.length).map(r => r.prop);
  const options = [...own, ...schema.props.filter(p => !holds.has(p.ident) && !own.includes(p))].map(p => ({ label: p.title, prop: p, iconHtml: shared.kindIconHtml(p.choices?.length && p.type !== 'node' ? 'choice' : p.type) }));
  const picked = await shared.pickValue({ at: at(), placeholder: 'Add or change property', options, keepOrder: true, free: true, make: typed => `+ New option: ${typed}` });
  const name = String(picked?.typed ?? '').trim().replace(/\s+/g, ' ');
  let prop = picked?.prop || (name ? schema.props.find(p => p.lower === name.toLowerCase()) : null);
  if (!prop) {
    if (!name) return;
    const type = await shared.pickType({ at: at(), name, options: window.PluginDoor.PROPERTY_TYPES.map(([type, label]) => ({ label, type })) });
    if (!type?.type) return;
    prop = { ident: `new:${name}`, title: name, lower: name.toLowerCase(), type: type.type, many: false, classes: [], choices: [], pending: true };
  }
  const wasOpen = state.dig.has(key), from = nameRect(key);
  state.addProp = { uuid, key, prop };
  try {
    if (!wasOpen) { state.dig.set(key, { uuid, id: 0, title: title || titleOf(uuid) }); state.focus = key; }
    state.html = null; twoWay.draw(host());
    if (!wasOpen) fitOrShift(key, from);
    const line = twoWay.inBox(`.th-ol-kids[data-key="${CSS.escape(key)}"] .th-ol-pname[data-edit="${CSS.escape(prop.ident)}"][data-uuid="${CSS.escape(uuid)}"]`)();
    if (line) await editNodeProp(uuid, prop.ident, line);
  } finally {
    state.addProp = null; state.html = null;
    // Opened only to show the line: closed again when the line is not there any more (no value was given, or the value is the way
    // back, this page, which the node never lists: the page's own list under the property's name shows it).
    twoWay.draw(host());
    if (!wasOpen && state.dig.has(key) && !twoWay.inBox(`.th-ol-kids[data-key="${CSS.escape(key)}"] .th-ol-pname[data-edit="${CSS.escape(prop.ident)}"][data-uuid="${CSS.escape(uuid)}"]`)()) closeDig(key);
  }
}
// The right-click of a node's line inside an opened node, or of a property's line there (the node that holds it); the lines of the
// page's own lists have theirs through lineMenuHooks. True when the menu was opened.
function onNodeMenu(event) {
  const line = event.target.closest?.('.th-ol-kids[data-key] :is(.th-ol-line, .th-ol-prop)');
  if (!line || line.matches('.th-tw-line, .th-tw-lhead, .th-ol-moreline') || event.target.closest('input, textarea')) return false;
  const name = line.querySelector('a.th-tw-record[data-uuid]'), kids = line.closest('.th-ol-kids[data-key]');
  const onName = name && (event.target.closest('a.th-tw-record') || !line.matches('.th-ol-prop'));
  const key = onName ? keyOfLine(name) : kids.dataset.key, uuid = onName ? name.dataset.uuid : state.dig.get(key)?.uuid || topStep()?.uuid;
  if (!isUuid(uuid) || !key) return false;
  event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); twoWay.closeAdd();
  // The node's menu, the same in every place (PluginDoor.nodeMenu), with Add property… here where the node stands open.
  window.PluginDoor.nodeMenu(onName ? name : line, uuid, { property: () => addPropItem(uuid, key).run(), newLine: () => { newLine(uuid, key).catch(error => warnOnce('could not start a line', error)); } });
  return true;
}
/* A new line at the end of a node, from the node's menu (the owner, 21 November 2026: items 1–10, "Add a line under it" from any row):
   the node opens in place where it is shown, if it is not open, and the caret goes into the line after its last bullet. */
async function newLine(uuid, key, title = '') {
  if (!isUuid(uuid) || !key) return;
  if (!state.dig.has(key)) await toggleDig(key, uuid, 0, title || titleOf(uuid));
  const kids = () => state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`);
  for (let i = 0; i < 30 && !kids()?.querySelector(`.th-tw-node-field, .ls-block`); i++) await new Promise(r => setTimeout(r, 100));
  if (state.box?.querySelector(`.th-tw-node-field[data-key="${CSS.escape(key)}"]`)) { focusNodeField(key); return; }
  // Where Logseq's own editor draws the node's lines (a node opened on a page) there is no line of the plugin's to write in: a new
  // bullet after the last one, and Logseq's editor in it, as Enter at the end of that line would make.
  const made = await twoWay.model.addLineTo(uuid, '').catch(error => { warnOnce('could not start a line', error); return null; });
  if (made?.uuid) { await new Promise(r => setTimeout(r, 300)); await twoWay.model.editBlock(String(made.uuid)).catch(error => warnOnce('could not start writing the new line', error)); }
}
const addPropItem = (uuid, key, title) => ({ icon: 'property', label: 'Add property…', run: () => { addProp(uuid, key, title).catch(error => { warnOnce('could not add a property to the node', error); notify('The property could not be added', 'warning'); }); } });
twoWay.lineMenuHooks.push((group, item) => {
  const name = state.box?.querySelector(`.th-tw-row[data-field="${CSS.escape(group.name)}"] .th-tw-line[data-uuid="${CSS.escape(item.uuid)}"] a.th-tw-record`);
  const key = keyOfLine(name);
  return key && isUuid(item.uuid) ? [{ ...addPropItem(item.uuid, key, twoWay.shortName(item.title)), nodeLine: 'property' }, { label: 'Add a line', nodeLine: 'newLine', run: () => { newLine(item.uuid, key, item.title).catch(error => warnOnce('could not start a line', error)); } }] : [];
});
// Logseq's own key for "Add property", the one in force, while the keyboard is on a node's name.
twoWay.starters.push(() => {
  const doc = host();
  const onKey = event => {
    const at = doc.activeElement;
    if (!at?.matches?.('.th-two-way a.th-tw-record[data-uuid]') || !twoWay.mine(at)) return;
    const spec = window.PluginDoor.logseqCommands?.().find(c => String(c?.id || '').endsWith('editor/add-property'))?.shortcut || 'mod+p';
    if (![].concat(spec).some(one => window.PluginDoor.keys.matches(event, one))) return;
    const key = keyOfLine(at);
    if (!key) return;
    event.preventDefault(); event.stopPropagation();
    addPropItem(at.dataset.uuid, key).run();
  };
  twoWay.listen(doc, 'keydown', onKey, true);
});

// A click inside the outline: a chevron opens or closes, a pencilled value is taken, "show all" shows all, a property's
// name or plain value is changed, a bullet opens itself, a link in a bullet its page. False: not one of these.
function onOutlineClick(event) {
  const t = event.target;
  const stop = () => { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); };
  const chev = t.closest('.th-chev[data-dig], .lk-close[data-dig]');   // the × on an opened node's ground closes it as its arrow does
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
  // A property's name opens the property's own page (Shift: the right sidebar).
  const pname = t.closest('.th-ol-pname[data-edit]');
  if (pname) { stop(); if (pname.dataset.prop) openEntity(pname.dataset.prop, event.shiftKey); return true; }
  // A press in a value's area, beside what it holds, changes the value: a page's own name there still opens that page.
  const area = !t.closest('a, button, input, textarea, .th-chev, .lk-bul, .th-tag') && t.closest('.th-ol-prop > .th-ol-pv');
  const owner = area && area.parentElement.closest('.th-ol-kids[data-key]');
  if (area && owner) {
    // The line's own name, or for a second value's line the name on the first line of that property.
    const nameOf = el => el?.matches?.('.th-ol-prop') ? el.querySelector(':scope > .th-ol-pname') : el?.matches?.('.th-ol-unit') ? el.querySelector(':scope > .th-ol-prop > .th-ol-pname') : null;
    let line = area.parentElement.parentElement.matches('.th-ol-unit') ? area.parentElement.parentElement : area.parentElement, named = nameOf(line);
    while (named && !named.dataset.edit) { line = line.previousElementSibling; named = nameOf(line); }
    if (named?.dataset.edit) { stop(); editNodeProp(named.dataset.uuid, named.dataset.edit, named).catch(error => { warnOnce('could not change a property of the node', error); notify('That could not be changed', 'warning'); }); return true; }
  }
  const ownLine = t.closest('a, button, input, textarea, .lk-bul, .th-chev, .th-tag, .lk-tag, [data-edit], [data-edit-bullet], [data-take]') ? null : t.closest('.th-ol-line.th-tw-line');
  const ownName = ownLine ? ownLine.querySelector(':scope > .th-ol-body > .th-ol-name') : null;
  if (ownName && isUuid(ownLine.dataset.uuid)) { stop(); editWordsAt(ownLine.dataset.uuid, ownName).then(did => { if (did) twoWay.later(0); }).catch(error => { warnOnce('could not change the words of the node', error); notify('The words could not be changed', 'warning'); }); return true; }
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

// TRIAL: after a level closes, nothing still open may wrap: the deepest that does closes too (as stepping back does).
function settle() {
  for (let guard = 0; guard < 20 && sectionBreaks(); guard++) {
    const deepest = [...state.dig.keys()].filter(k => below(k) > 0).sort((a, b) => b.split('>').length - a.split('>').length)[0];
    if (!deepest) break;
    closeDig(deepest);
  }
}
Object.assign(twoWay, { newLine, escapeBack, settle, inPlaceHtml, flipRects, flipPlay, editWordsAt, nodeTopHtml, addProp, onNodeMenu, closeDig, digChev, holdsMore, digKids, editBullet, focusNodeField, keepNodeField, onOutlineClick, pinNow, readNode, reading, stepBack, steppedHtml, topStep });
});
})();
