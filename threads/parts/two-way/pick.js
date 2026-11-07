/* Picking nodes and acting on them together: the tick boxes, the bar above the first picked node, More, making an untagged
   mention a node, and Delete, which asks first and cannot be undone from here.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, openEntity, notify, esc } = shared;
const { state, warnOnce } = twoWay;

/* Picking records and acting on them together (0.4.228, the owner's ask: "selected in groups and be acted on", like
   Logseq's own tables). A tick box before each record, shown under the pointer and on every record while any is
   ticked; Shift-click ticks every record from the last one ticked. A pick is a record under one field ("uuid|field"),
   since a record can point here through two fields. The bar above the rows, the library's: how many are picked with its
   tick box, then open in the sidebar, point to another page, take the link off (these two through the picked
   record's own field), add a tag, copy, set a property, clear a property, delete, as the library's words with their icons.
   Every change but delete has Undo (the faded arrow); delete asks first. Escape or the bar's box clears
   the picks; going to another page does too. */
/* The bar's room is always kept above the rows, the bar shown in it only while something is picked (0.4.325, the owner:
   "the toolbar jumps in and causes the link table to jump down … that space is fine. allows breathing room"). */
/* The bar moves to just above the first picked node, where the picks are. The node just ticked keeps its place on the screen:
   the page scrolls by what the bar added or took above it, so the next tick box is where the hand left it. */
const placeBar = box => {
  const bar = box.querySelector('.th-tw-bar');
  const first = state.picked.size ? [...box.querySelectorAll('input.th-tw-pick')].find(input => input.checked)?.closest('.th-tw-line') : null;
  if (bar && first && bar.nextElementSibling !== first) first.before(bar);
  const keep = state.keepStill; state.keepStill = null;
  if (!keep) return;
  const pick = [...box.querySelectorAll('input.th-tw-pick')].find(input => input.dataset.pick === keep.key);
  const scroller = box.closest('#main-content-container'), moved = pick ? pick.getBoundingClientRect().top - keep.top : 0;
  if (scroller && Math.abs(moved) >= 1) scroller.scrollTop += moved;
};
function barHtml() {
  const idle = !state.picked.size;
  const n = state.picked.size;
  /* The bar stands right above the first picked node, on the same grey as the picked nodes, so the picks and what acts on them
     read as one block (5 November 2026, the owner, of the grey block in picking-redesign.html: "build 2"; before it: "there is
     nothing that allows the eyes to grab onto"). The count, large, and its ×; Open in sidebar, what is done most with picked
     nodes; More, which holds the rest; Delete at the right end, apart. Drawn here at the top, moved into place by placeBar. */
  const b = (act, text, title, name, cls = '') => `<button type="button" class="lk-picked-act lk-i-${name}${cls ? ' ' + cls : ''}" data-act="${act}" title="${esc(title)}">${text}</button>`;
  return `<div class="lk-picked th-tw-bar"${idle ? ' data-idle="" aria-hidden="true"' : ''} role="toolbar" aria-label="What to do with the picked nodes"><span class="lk-picked-count th-count"><b class="lk-picked-n">${n}</b> picked</span><button type="button" class="lk-picked-x" data-act="clear" title="Clear the picks (Escape)" aria-label="Clear the picks">×</button>${
    b('sidebar', 'Open in sidebar', 'Open them in the right sidebar', 'side')}<button type="button" class="lk-picked-act th-tw-menu" data-act="more" title="Everything else you can do with them" aria-haspopup="menu">More<span class="lk-i-chevron th-tw-chev" aria-hidden="true"></span></button><span class="lk-picked-gap"></span>${
    b('delete', 'Delete', 'Delete them', 'bin', 'lk-del')}</div>`;
}
// The page's own name, for More's "Change “Dr. Mei Chen” to…" (0.4.233, the owner: "make it clear"), read once per page.
const named = { uuid: '', title: '' };
const pageTitle = () => named.uuid === state.pageUuid && named.title ? named.title : 'this page';
async function readTitle() {
  const uuid = state.pageUuid;
  if (named.uuid === uuid) return;
  const title = await twoWay.provided.titleNow(uuid).catch(() => null);
  if (state.pageUuid !== uuid || !title) return;
  Object.assign(named, { uuid, title: await twoWay.provided.readableTitle(title).catch(() => title) });
  twoWay.draw(host());
}
function togglePick(el, range) {
  const key = el.dataset.pick, all = [...state.box.querySelectorAll('.th-tw-row .th-tw-pick')].map(p => p.dataset.pick);
  const from = all.indexOf(state.lastPick), to = all.indexOf(key);
  if (range && from >= 0 && to >= 0) { const on = !state.picked.has(key); for (const k of all.slice(Math.min(from, to), Math.max(from, to) + 1)) on ? state.picked.add(k) : state.picked.delete(k); }
  else if (state.picked.has(key)) state.picked.delete(key); else state.picked.add(key);
  state.lastPick = key;
  state.keepStill = { key, top: el.getBoundingClientRect().top };
  state.html = null;
  twoWay.draw(host());
  readTitle().catch(() => {});
  for (const uuid of raisablePicked()) prepareRaise(uuid).catch(error => warnOnce('could not work out what a mention could be made', error));
}
/* Making a mention a node (0.4.423, state 3 and 4 of pick A, the owner: "are you then proposing to change the tag from
   symptom log to consultation" — no: a mention that has a tag of yours keeps it and is offered nothing). For a picked
   mention with no tag of yours: every tag with a property that takes this page (Conversation · Spoke with, Consultation ·
   Provider, Decision · Decided by for a doctor), the one its words look like first (the proposals' tag vote, tagGuess,
   when that part is loaded), then the kinds of link the page already has, the most used first; with one mention picked, that one shows under it in the proposals' grey before anything is
   written. A pick from the bar's menu adds the tag and sets the property to this page on every picked mention with no
   tag; the words stay as they are; the faded Undo arrow takes both off again. */
const raisablePicked = () => picks().filter(p => twoWay.isMentions(p.group) && p.group.items.some(item => item.uuid === p.uuid && (!item.tag || item.tag === 'note'))).map(p => p.uuid);
async function raisePairs() {
  const uuid = state.pageUuid;
  if (state.raisePairs?.page === uuid) return state.raisePairs.pairs;
  const [schema, pages] = await Promise.all([twoWay.provided.propSchema(), twoWay.provided.propPages()]);
  const me = pages.find(p => p.uuid === uuid);
  const up = ids => { const seen = new Set(), queue = [...ids]; while (queue.length) { const t = queue.shift(); if (seen.has(t)) continue; seen.add(t); queue.push(...(schema.parentsOf?.get(t) || [])); } return seen; };
  const mine = up((me?.tags || []).map(t => t.id));
  const takesMe = prop => (prop.type === 'node' || prop.type === 'page') && prop.classes?.some(c => mine.has(c.id));
  const pairs = [];
  for (const tag of pages.filter(p => p.isTag && !schema.builtIn?.has(p.id))) {
    for (const t of up([tag.id])) for (const pid of schema.classProps?.get(t) || []) {
      const prop = schema.byId?.get(pid);
      if (prop && takesMe(prop) && !pairs.some(x => x.tag.id === tag.id && x.prop.ident === prop.ident)) pairs.push({ tag: { id: tag.id, uuid: tag.uuid, title: tag.title }, prop });
    }
  }
  // The kinds of link this page already has first, the most used first ("provider of" with four Consultations
  // puts Consultation · Provider at the top), then the rest by name.
  const used = pair => state.groups.filter(g => g.ident === pair.prop.ident).reduce((n, g) => n + g.items.filter(item => item.tag === pair.tag.title).length, 0);
  for (const pair of pairs) pair.used = used(pair);
  pairs.sort((a, b) => b.used - a.used || a.tag.title.localeCompare(b.tag.title) || a.prop.title.localeCompare(b.prop.title));
  state.raisePairs = { page: uuid, pairs };
  return pairs;
}
async function prepareRaise(uuid) {
  if (state.raise.has(uuid)) return;
  if (twoWay.couldBeOff().has(uuid)) return;   // its suggestion was taken off: not asked
  state.raise.set(uuid, { pairs: [], best: null });
  const [pairs, guess] = await Promise.all([raisePairs(), twoWay.provided.tagGuess ? twoWay.provided.tagGuess(uuid).catch(error => { warnOnce('the tag a mention looks like could not be read', error); return null; }) : null]);
  const best = guess ? pairs.find(p => p.tag.id === guess.id) || null : null;
  state.raise.set(uuid, { pairs: best ? [best, ...pairs.filter(p => p !== best)] : pairs, best });
  state.html = null; twoWay.draw(host());
}
// Under the one picked mention, what it would get, as the + line shows a new node's (the proposals' grey).
function raiseHtml(group, item) {
  if (!twoWay.isMentions(group) || !state.picked.has(`${item.uuid}|${group.name}`)) return '';
  const only = raisablePicked();
  const best = only.length === 1 && only[0] === item.uuid ? state.raise.get(item.uuid)?.best : null;
  if (!best) return '';
  const piece = (name, value) => `<span class="th-tw-dprop"><span class="th-tw-dname">${esc(name)}</span><span class="th-pencil lk-pencil">${esc(value)}</span></span>`;
  return `<div class="th-tw-raise" title="What it would get: the tag its words look like, and “${esc(best.prop.title)}” set to this page. Make it from the bar above.">${piece('Tags', best.tag.title)}${piece(best.prop.title, pageTitle())}</div>`;
}
async function raiseMenu(at) {
  const uuids = raisablePicked();
  if (!uuids.length) return;
  await Promise.all(uuids.map(uuid => prepareRaise(uuid)));
  const one = uuids.length === 1 ? state.raise.get(uuids[0]) : null;
  const pairs = one ? one.pairs : await raisePairs();
  if (!pairs.length) return notify(`No tag has a property that takes “${pageTitle()}”, so a mention cannot be made one here`, 'warning');
  const items = pairs.map(pair => ({ icon: 'tag', label: `${pair.tag.title} · ${pair.prop.title}`, right: one?.best === pair ? 'its words look like one' : '', run: () => { raise(pair, uuids).catch(error => { warnOnce('could not make the mentions nodes', error); notify('That could not be done', 'warning'); }); } }));
  shared.popup({ at, width: 'max-content', head: `Make ${uuids.length === 1 ? 'it' : `these ${uuids.length}`} a node, with “${pageTitle()}” set`, items });
}
async function raise(pair, uuids) {
  const here = await twoWay.provided.idByUuid(state.pageUuid);
  if (!here) return;
  const kind = pair.tag.title;
  return writeAll(`Made ${counted(uuids.length)} ${kind}, “${pair.prop.title}” set to “${pageTitle()}”`, uuids.map(uuid => async () => {
    const had = await twoWay.provided.valuesOf(uuid, pair.prop.ident);
    const tagged = await twoWay.provided.hasTag(uuid, pair.tag.uuid);
    if (!tagged) await twoWay.model.addTag(uuid, pair.tag.uuid);
    if (!had.includes(here)) await setValues(uuid, pair.prop, pair.prop.many ? [...had, here] : [here]);
    state.raise.delete(uuid);
    return async () => { await setValues(uuid, pair.prop, had); if (!tagged) await twoWay.model.removeTag(uuid, pair.tag.uuid); };
  }));
}
const picks = () => [...state.picked].map(key => { const at = key.indexOf('|'); return { uuid: key.slice(0, at), group: state.groups.find(g => g.name === key.slice(at + 1)) }; }).filter(p => p.group);
const nodesPicked = () => [...new Set(picks().map(p => p.uuid))];
const titleFor = uuid => { for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return item.title; return 'a node'; };
const counted = n => `${n} ${n === 1 ? 'node' : 'nodes'}`; // Logseq's word (the owner: never "record")
/* A question with a list to choose from, asked as Logseq asks for a value (1.0.4; the owner: "keep them close to how
   logseq would show"): Logseq's own picker under what asked, the question as its placeholder ("Change “Dr. Mei Chen” to …"),
   no hint (Logseq shows none). Resolves with the words picked or typed, '' for Clear, or null. */
const ask = async (heading, hint, options, button = 'OK', value = '', allowEmpty = false, at = null, clearLabel = '') => {
  const picked = await shared.pickValue({ at, placeholder: heading, options: options.map(label => ({ label, held: !!value && label === value })), clearLabel, free: true });
  return picked == null ? null : picked.clear ? '' : (picked.typed ?? picked.label);
};
const sure = (heading, button, at = null) => shared.ask({ at, question: heading, go: button });
// A link, a choice or a day is held by its id; anything else by what it says.
const heldById = prop => !!prop.choices?.length || ['node', 'page', 'date'].includes(prop.type);
/* What a node holds under a property, so it can be put back exactly: ids (the tag tree's way, parts/tags.js), or what it says.
   Logseq takes a cleared text value's own node away with it, so its old id is no value any more ("should be a text block"). */
async function heldNow(uuid, prop) {
  if (heldById(prop)) return twoWay.provided.valuesOf(uuid, prop.ident);
  const held = [...(await twoWay.provided.nodeValues([uuid], { logseqs: true })).get(uuid)?.values() || []].find(h => h.ident === prop.ident);
  return (held?.values || []).map(v => v.time ?? v.number ?? v.boolean ?? v.text);
}
async function setValues(uuid, prop, values) {
  if (!values.length) return twoWay.model.unsetValue(uuid, prop.ident);
  return twoWay.model.setValue(uuid, prop.ident, prop.many ? values : values[0], heldById(prop) ? { entityId: true, reset: true } : { reset: true });
}
// A day typed for a date (a journal page, by its id) or a date-and-time (a moment: the day's first).
async function dayValue(typed, kind) {
  const day = twoWay.provided.parseDay(typed, new Date());
  if (!day || kind === 'datetime') return day?.getTime();
  return twoWay.provided.journalIdFor(twoWay.provided.dayNumber(day), await twoWay.provided.journalTitleFor(day.getFullYear(), day.getMonth() + 1, day.getDate()));
}
// Runs one change on every picked node; a node that fails is left as it was and the rest go on. Undo puts back the rest.
async function writeAll(text, steps) {
  const undos = [];
  let failed = 0;
  for (const step of steps) {
    try { const undo = await step(); if (undo) undos.push(undo); } catch (error) { failed++; warnOnce('a picked node could not be changed', error); }
  }
  twoWay.stopPicking(); twoWay.later(300); twoWay.draw(host());
  if (failed) notify(`${failed} of the picked nodes could not be changed`, 'warning');
  if (undos.length) twoWay.offerUndo(text, async () => {
    let missed = 0;
    for (const undo of undos.reverse()) { try { await undo(); } catch (error) { missed++; warnOnce('a picked node could not be put back', error); } }
    twoWay.later(300);
    if (missed) notify(`${missed} of the nodes could not be put back`, 'warning');
  });
}
const propNamed = async name => (await twoWay.provided.propSchema()).props.find(p => p.lower === name.toLowerCase());
// Whether a page fits a property: any page when it takes no tag, else a page with one of its tags or a tag beneath.
async function takerOf(prop) {
  const schema = await twoWay.provided.propSchema(), ids = new Set((prop?.classes || []).map(c => c.id));
  return page => !ids.size || twoWay.provided.fits(page, ids, schema);
}
// The pages the nodes' words name, among the ids allowed, the most named first, this page never ([] without the rules).
async function namedFirst(uuids, fields, allowed) {
  if (!twoWay.provided.namedPages) return [];
  const tagIds = [...new Set(fields.flatMap(f => f.classes.map(c => c.id)))];
  const ok = new Set(allowed), count = new Map();
  for (const uuid of uuids) {
    const ids = await twoWay.provided.namedPages(titleFor(uuid), tagIds).catch(error => { warnOnce('the names in the picked nodes could not be read', error); return []; });
    for (const id of ids) if (ok.has(id)) count.set(id, (count.get(id) || 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
async function pageNamed(name, prop) {
  const pages = (await twoWay.provided.propPages()).filter(page => page.lower === name.toLowerCase());
  return pages.find(await takerOf(prop)) || pages[0] || null;
}
async function act(what, at = null) {
  // A press on the bar: its menus and questions open from where it stands on the screen (an anchor inside the rows' list is not
  // followed by a menu shown over the page).
  if (at?.closest?.('.th-tw-bar')) { const r = at.getBoundingClientRect(); at = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
  const chosen = picks(), nodes = nodesPicked();
  if (what === 'clear') { twoWay.stopPicking(); return twoWay.draw(host()); }
  if (what === 'all') { for (const key of state.listed) state.picked.add(key); readTitle().catch(() => {}); return twoWay.draw(host()); }
  if (!chosen.length) return;
  // The two words with a menu (0.4.327): the menu opens under the word, and what is picked from it acts as its own word did.
  if (what === 'raise') return raiseMenu(at);
  // More (5 November 2026): Select all, then every action but Open in sidebar and Delete, which stand on the bar; the page's own
  // two only with a node from a property's row picked, Make it… only with a mention that has no tag.
  if (what === 'more') {
    const fromProps = chosen.some(p => !twoWay.isMentions(p.group)), raisable = raisablePicked();
    const best = raisable.length === 1 ? state.raise.get(raisable[0])?.best : null;
    const items = [
      ...(state.listed.some(key => !state.picked.has(key)) ? [{ label: `Select all ${state.listed.length} shown`, run: () => { act('all', at); } }, { sep: true }] : []),
      { label: 'Tag…', run: () => { act('tag', at); } },
      { label: 'Set a property…', run: () => { act('set', at); } },
      { label: 'Clear a property…', run: () => { act('unset', at); } },
      ...(fromProps ? [{ label: `Change “${pageTitle()}” to…`, run: () => { act('point', at); } }, { label: `Take out “${pageTitle()}”`, run: () => { act('unlink', at); } }] : []),
      ...(raisable.length ? [{ label: best ? `Make it a${/^[aeiou]/i.test(best.tag.title) ? 'n' : ''} ${best.tag.title}…` : 'Make it…', run: () => { raiseMenu(at).catch(error => warnOnce('could not open Make it…', error)); } }] : []),
      { label: 'Copy as references', run: () => { act('copy', at); } },
    ];
    shared.popup({ at, width: 'max-content', items });
    return;
  }
  if (what === 'page-menu' || what === 'prop-menu') {
    const items = what === 'page-menu'
      ? [{ icon: 'to', label: `Change “${pageTitle()}” to…`, run: () => { act('point', at); } }, { icon: 'remove', label: `Remove “${pageTitle()}”`, run: () => { act('unlink', at); } }]
      : [{ icon: 'property', label: 'Set property…', run: () => { act('set', at); } }, { icon: 'remove', label: 'Unset property…', run: () => { act('unset', at); } }];
    // As wide as its longest item, so a long page name reads whole (0.4.397).
    shared.popup({ at, width: 'max-content', items });
    return;
  }
  if (what === 'sidebar') { for (const uuid of nodes) openEntity(uuid, true); twoWay.stopPicking(); return twoWay.draw(host()); }
  try {
    if (what === 'copy') {
      const lines = await Promise.all(nodes.map(async uuid => { const page = await twoWay.model.getPage(uuid).catch(() => null); return page?.name ? `[[${page.title || page.originalName || page.name}]]` : `((${uuid}))`; }));
      await host().defaultView.navigator.clipboard.writeText(lines.join('\n'));
      notify(`Copied ${counted(nodes.length)}`);
      twoWay.stopPicking(); return twoWay.draw(host());
    }
    const schema = await twoWay.provided.propSchema();
    const here = await twoWay.provided.idByUuid(state.pageUuid);
    if (what === 'point' || what === 'unlink') {
      chosen.splice(0, chosen.length, ...chosen.filter(p => !twoWay.isMentions(p.group)));
      if (!chosen.length) return;
      const fields = [...new Set(chosen.map(p => p.group.ident))].map(ident => schema.props.find(p => p.ident === ident)).filter(Boolean);
      let target = null;
      if (what === 'point') {
        const takers = await Promise.all(fields.map(takerOf));
        const fits = (await twoWay.provided.propPages()).filter(page => page.id !== here && takers.some(takes => takes(page)));
        // The pages the picked nodes' own words name first (0.4.414, idea 4 of the brainstorm of 2026-10-25): a node
        // pointing here while its words say "Spoke with Dr. Patel" offers Dr. Raj Patel at the top. Through the
        // proposals' reader of names (namedPages, parts/proposals.js) when it is loaded; the most named first.
        const named = await namedFirst(chosen.map(p => p.uuid), fields, fits.map(page => page.id));
        const ordered = [...named.map(id => fits.find(page => page.id === id)).filter(Boolean), ...fits.filter(page => !named.includes(page.id))];
        const hint = `On ${counted(nodes.length)}: their “${fields.map(f => f.title).join('”, “')}” will name the page you pick instead.${named.length ? ` First: ${named.length === 1 ? 'the page' : 'the pages'} their words name.` : ''}`;
        const name = await ask(`Change “${pageTitle()}” to …`, hint, ordered.map(page => page.title), 'Change', '', false, at);
        if (!name) return;
        target = await pageNamed(name, fields[0]);
        if (!target) return notify(`There is no page named “${name}”, so nothing was changed`, 'warning');
      }
      return writeAll(`${what === 'point' ? `Changed “${pageTitle()}” to “${target.title}” on ${counted(chosen.length)}` : `Removed “${pageTitle()}” from ${counted(chosen.length)}`}`, chosen.map(({ uuid, group }) => async () => {
        const prop = schema.props.find(p => p.ident === group.ident);
        if (!prop) return null;
        const had = await twoWay.provided.valuesOf(uuid, prop.ident);
        let now = had.filter(id => id !== here);
        if (target && !now.includes(target.id)) now = prop.many ? [...now, target.id] : [target.id];
        await setValues(uuid, prop, now);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'tag') {
      const tags = (await twoWay.provided.propPages()).filter(page => page.isTag);
      const name = await ask(`Add a tag to ${counted(nodes.length)}`, '', tags.map(t => t.title), 'Add', '', false, at);
      if (!name) return;
      const tagUuid = await twoWay.provided.tagUuidNamed(tags.find(t => t.lower === name.replace(/^#/, '').toLowerCase())?.title || name.replace(/^#/, ''));
      if (!tagUuid) return notify(`There is no tag named “${name}”, so nothing was changed`, 'warning');
      return writeAll(`Tagged ${counted(nodes.length)} ${name.replace(/^#/, '')}`, nodes.map(uuid => async () => {
        if (await twoWay.provided.hasTag(uuid, tagUuid)) return null;
        await twoWay.model.addTag(uuid, tagUuid);
        return () => twoWay.model.removeTag(uuid, tagUuid);
      }));
    }
    if (what === 'set' || what === 'unset') {
      let names = schema.props.map(p => p.title);
      if (what === 'unset') {
        const held = new Set((await Promise.all(nodes.map(uuid => twoWay.provided.userValues(uuid)))).flat());
        names = schema.props.filter(p => held.has(p.ident)).map(p => p.title);
        if (!names.length) return notify('The picked nodes hold none of your properties', 'warning');
      }
      const name = await ask(what === 'set' ? `Set a property on ${counted(nodes.length)}` : `Clear a property on ${counted(nodes.length)}`, what === 'unset' ? `They hold: ${names.join(', ')}` : '', names, 'Next', '', false, at);
      if (!name) return;
      const prop = await propNamed(name);
      if (!prop) return notify(`There is no property named “${name}”, so nothing was changed`, 'warning');
      let value = null;
      if (what === 'set') {
        const kind = prop.choices.length ? 'choice' : prop.type;
        const options = kind === 'choice' ? prop.choices.map(c => c.title)
          : ['node', 'page'].includes(kind) ? (await twoWay.provided.propPages()).filter(await takerOf(prop)).map(page => page.title)
          : kind === 'checkbox' ? ['yes', 'no'] : [];
        const typed = await ask(`${prop.title} for ${counted(nodes.length)}`, kind === 'date' || kind === 'datetime' ? 'A day: today, friday, 4 aug, 2026-08-04 …' : prop.many ? 'Added to what each one holds.' : '', options, 'Set', '', false, at);
        if (!typed) return;
        if (kind === 'choice') value = prop.choices.find(c => c.title.toLowerCase() === typed.toLowerCase())?.id;
        else if (['node', 'page'].includes(kind)) value = (await pageNamed(typed, prop))?.id;
        else if (kind === 'date' || kind === 'datetime') value = await dayValue(typed, kind);
        else if (kind === 'checkbox') value = /^(y|yes|true|1|on)$/i.test(typed) ? true : /^(n|no|false|0|off)$/i.test(typed) ? false : undefined;
        else if (kind === 'number') value = Number.isFinite(Number(typed)) ? Number(typed) : undefined;
        else value = typed;
        if (value == null) return notify(`“${typed}” is not a value “${prop.title}” takes, so nothing was changed`, 'warning');
      }
      const entity = what === 'set' && heldById(prop);
      return writeAll(what === 'set' ? `Set “${prop.title}” on ${counted(nodes.length)}` : `Cleared “${prop.title}” on ${counted(nodes.length)}`, nodes.map(uuid => async () => {
        const had = await heldNow(uuid, prop);
        if (what === 'unset') { if (!had.length) return null; await twoWay.model.unsetValue(uuid, prop.ident); }
        else if (entity) await setValues(uuid, prop, prop.many ? [...new Set([...had, value])] : [value]);
        else await twoWay.model.setValue(uuid, prop.ident, value);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'delete') {
      // A page goes with all its bullets: the question says so, the pages apart from the bullets.
      const pages = (await Promise.all(nodes.map(uuid => twoWay.model.getPage(uuid).catch(() => null)))).filter(page => page?.name).length, bullets = nodes.length - pages;
      const one = nodes.length === 1 ? (pages ? `the page “${titleFor(nodes[0])}” with all its bullets` : `“${titleFor(nodes[0])}”`)
        : [pages && `${pages} ${pages === 1 ? 'page' : 'pages'} with all ${pages === 1 ? 'its' : 'their'} bullets`, bullets && `${bullets} ${bullets === 1 ? 'bullet' : 'bullets'}`].filter(Boolean).join(' and ');
      if (!await sure(`Delete ${one}? This cannot be undone from here.`, 'Delete', at)) return;
      return writeAll('', nodes.map(uuid => async () => {
        const page = await twoWay.model.getPage(uuid).catch(() => null);
        if (page?.name) await twoWay.model.deletePage(page.name); else await twoWay.model.removeBlock(uuid);
        return null;
      }));
    }
  } catch (error) { warnOnce(`could not ${what} the picked nodes`, error); notify('That could not be done', 'warning'); }
}

Object.assign(twoWay, { act, barHtml, dayValue, heldById, heldNow, named, pageNamed, placeBar, prepareRaise, raiseHtml, raiseMenu, readTitle, setValues, takerOf, togglePick });
})();
