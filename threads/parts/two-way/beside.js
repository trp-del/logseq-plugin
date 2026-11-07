/* Two pages side by side (7 November 2026, the owner: "ok build each"): "and Dr. Helen Brooks" in the find line draws this
   page's rows and that page's in two columns, the same property on the same line, so the eye compares without reading
   twice. A property only one page has stands in full on its side and quiet, as "none", on the other. A node's name opens
   it as on a row; the other page's title opens that page with this one beside it, so the pair is kept.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, openEntity, esc } = shared;
const O = shared.outline;
const { state, warnOnce } = twoWay;

const SHOWN = 3;   // nodes per side under a property's head; "show all" opens the rest
// The page named after "and", among every page: by its whole name, else the one page whose name starts with the words.
function besidePage() {
  const { beside } = twoWay.readFind();
  if (!beside || !state.pagesList) return null;
  const lower = beside.toLowerCase();
  const whole = state.pagesList.find(p => p.lower === lower && p.uuid !== state.pageUuid);
  if (whole) return whole;
  const starts = state.pagesList.filter(p => p.lower.startsWith(lower) && p.uuid !== state.pageUuid);
  return starts.length === 1 ? starts[0] : null;
}
// What the other page holds, read once per page: its rows (from the look-up of every page, else read now) and its own
// properties, and this page's own properties beside them.
const reading = new Set();
function readBeside(page) {
  if (state.beside?.uuid === page.uuid && state.beside.forPage === state.pageUuid) return state.beside;
  const key = `${state.pageUuid}|${page.uuid}`;
  if (reading.has(key)) return null;
  reading.add(key);
  (async () => {
    const [groups, theirs, mine] = await Promise.all([
      state.byPage.has(page.uuid) ? state.byPage.get(page.uuid) : twoWay.groupsFor(page.id),
      twoWay.provided.nodeFields(page.uuid).catch(() => new Map()),
      twoWay.provided.nodeFields(state.pageUuid).catch(() => new Map())]);
    if (key !== `${state.pageUuid}|${page.uuid}`) return;
    state.beside = { uuid: page.uuid, id: page.id, title: page.title, forPage: state.pageUuid, groups: groups.filter(g => !twoWay.isMentions(g)), theirs, mine };
    state.html = null; twoWay.draw(host());
  })().catch(error => warnOnce('could not read the page to stand beside this one', error)).finally(() => reading.delete(key));
  return null;
}
// Every page's name, read once a session for the words after "and" (the model's list, as the + line uses it).
function readPages() {
  if (state.pagesList || state.pagesReading) return;
  state.pagesReading = true;
  twoWay.provided.propPages().then(pages => { state.pagesList = pages; state.html = null; twoWay.draw(host()); }).catch(error => warnOnce('could not read the pages', error)).finally(() => { state.pagesReading = false; });
}
// In the rows' place while a page stands beside this one; the rows as they are until it is read.
function rowsInstead() {
  const { beside: words } = twoWay.readFind();
  if (!words) return undefined;
  readPages();
  const page = besidePage();
  if (!page) return undefined;
  const got = readBeside(page);
  return got ? besideHtml(got) : undefined;
}
const valueText = v => v.day ? twoWay.dayText(v.day) : String(v.title ?? v.text ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1');
const fieldsHtml = (fields, name) => { const values = fields.get(name); return values ? esc(values.map(valueText).filter(Boolean).join(', ')) : '<span class="th-tw-none lk-note">none</span>'; };
// A side's head for a property: the count and kind and the days, as a row's head says them, or "none".
function sideHead(group) {
  if (!group) return '<span class="th-tw-none lk-note">none</span>';
  const counts = new Map();
  for (const item of group.items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const n = group.items.length, kinds = counts.size > 1;
  const lead = kinds ? `All ${n}` : `${n} ${esc(twoWay.plural(twoWay.tagWord(group.items[0]?.tag || 'note'), n))}`;
  const when = twoWay.summary(group.items, true);
  return `<span class="th-tw-chips"><span class="th-tw-lead">${lead}</span>${when ? `<span class="th-tw-piece"><span class="th-tw-sep" aria-hidden="true">·</span><span class="th-tw-when">${esc(when).replace(/ (?=\d)/g, '&nbsp;')}</span></span>` : ''}</span>`;
}
function sideList(group, key) {
  if (!group) return '';
  const all = state.all.has(key), shown = all ? group.items : group.items.slice(0, SHOWN);
  // The head names the one kind: the lines leave the tag out, as the rows do.
  const bare = new Set(group.items.map(item => item.tag)).size === 1;
  const lines = shown.map(item => O.line({ day: twoWay.dayCell(item), body: twoWay.nameHtml(bare ? { ...item, tag: '' } : item, false, bare), cls: 'th-tw-line th-tw-bline', attrs: { 'data-uuid': item.uuid } })).join('');
  const more = group.items.length > SHOWN ? O.more({ text: all ? 'show fewer' : `show all ${group.items.length}`, attrs: { class: null, 'data-more': key }, under: 'bare' }) : '';
  return `<div class="th-ol th-tw-bside">${lines}${more}</div>`;
}
function besideHtml(b) {
  const mine = state.groups.filter(g => !twoWay.isMentions(g));
  const names = [...new Set([...mine.map(g => g.name), ...b.groups.map(g => g.name)])];
  // The pages' own properties, where either page holds something.
  const held = fields => name => (fields.get(name) || []).some(v => valueText(v));
  const own = [...new Set([...b.mine.keys(), ...b.theirs.keys()])].filter(name => held(b.mine)(name) || held(b.theirs)(name));
  const prop = name => `<div class="th-tw-name lk-prop th-tw-bprop"><span class="th-kind">${shared.kindIconHtml('node')}</span>${esc(name)}</div>`;
  let html = `<div class="th-tw-beside" data-beside="${esc(b.uuid)}"><div></div><div class="th-tw-bhead"><span class="th-tw-btitle">${esc(state.pageTitle)}</span></div><div class="th-tw-bhead"><a href="#" class="th-tw-btitle th-tw-bpage lk-node" data-uuid="${esc(b.uuid)}" title="Open ${esc(b.title)}, with ${esc(state.pageTitle)} beside it">${esc(b.title)}</a></div>`;
  for (const name of own) html += `${prop(name)}<div class="th-tw-bown">${fieldsHtml(b.mine, name)}</div><div class="th-tw-bown">${fieldsHtml(b.theirs, name)}</div>`;
  for (const name of names) {
    const a = mine.find(g => g.name === name), c = b.groups.find(g => g.name === name);
    const label = (a || c).label;
    html += `${prop(label)}<div class="th-tw-bcell${a ? '' : ' th-tw-bnone'}">${sideHead(a)}${sideList(a, `${state.pageUuid}|${name}|beside`)}</div><div class="th-tw-bcell${c ? '' : ' th-tw-bnone'}">${sideHead(c)}${sideList(c, `${b.uuid}|${name}|beside`)}</div>`;
  }
  return html + '</div>';
}
// The other page's title opens that page with this one beside it; the pair stays, the other way round.
function pieceClick(event) {
  const other = event.target.closest?.('.th-tw-bpage');
  if (!other) return false;
  event.preventDefault(); event.stopPropagation();
  twoWay.hidePeek();
  state.besidePending = { page: other.dataset.uuid, words: state.pageTitle };
  openEntity(other.dataset.uuid, event.shiftKey);
  return true;
}
// Once the other page stands: this one named in its find line.
twoWay.settledHooks.push(() => {
  const pending = state.besidePending;
  if (!pending) return;
  state.besidePending = null;
  if (pending.page === state.pageUuid && pending.words) { state.find = `and ${pending.words}`; state.findShown = true; state.html = null; }
});
twoWay.starters.push(() => { state.beside = null; state.pagesList = null; });

Object.assign(twoWay, { besidePage, pieceClick, rowsInstead });
})();
