/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Two-way links part of Threads (0.4.137). A link made by a field reads the same from both ends.
   On the record that holds the field it is a property row, "report: Chest X-ray 2026-08-03". On the page it
   points to, Logseq lists the record under a tab named after the record's tag ("Appointment"), below the
   page's own blocks, so nothing there says how the two belong together. This part draws the far end as a
   row in the page's own property list, with grey names like any property's (0.4.141), read-only:
     report of →    Chest X-ray Aug 3 · Appointment
     doctor of →    9 Appointments · next Nov 12 ▾   (opens into the list of those records)
   One row per field that points here, named by the field read backwards ("doctor" → "doctor of", "prescribed
   by" → "prescribed", or a name from the twoWayNames setting). Up to three records show inline; more become
   a count with the nearest date, which opens into the list (open to begin with, as asked: "the details …
   should by default be unfolded"). Only your own Node properties count; tags, aliases and mentions in
   sentences stay in Linked references. Drawn for the page in the main view only. Reading the rows writes nothing; what
   writes is what you press: the + that adds a node, the picking bar's actions and writing into a node, each through
   the model with an Undo arrow (0.4.228, 0.4.303, 0.4.376). The tag tree
   (0.4.174) changes how a field reads backwards, and turns its row off, through this part's settings.
   On the kit since 0.4.318 (docs/LAYERS.md; the pages): the rows keep their own layout (one set of columns: the
   day where Logseq's values start, the name, its tag right after it (0.4.320), the tick box in the margin) and draw
   everything else with the kit: a tag as a class (mono, no #), the tick box, the picking bar as the library's lk-bar
   above the rows, filters as words, the fold chevron and the arrow after a name from Logseq's font, the +
   as the library's lk-plus, the draft line's field, the menus and the lists as the kit's pop-up
   placed by the browser, a question beside what it asked, the hover card; the graph is read and written only
   through the model's doors, the page and settings changes come from the core; no logseq.* call here. */
const shared = window.Threads.shared;
const { host, openEntity, openPageNamed, notify, esc, iconHtml } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Threads (two-way): ', leaves: { elements: '.refinement-two-way' } });

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', group: 'reading', rank: 3, title: 'Threads', default: null,
    legend: 'Records that point at this page, as rows in its own properties',
    zone: '<div><span class="m">doctor of →</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your properties points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such property becomes a row in the page’s own property list, with an arrow after its name: “doctor of →   9 Appointments · next Nov 12”. Up to three nodes show by name; more show as a count that opens into the list. Click a node’s name to open it (Shift-click: in the sidebar); rest the pointer on it to see its properties and first lines. Click the property’s name to open the property; right-click it to change how it reads here. In a list with several kinds of nodes, click a kind to show only those. The + at the end of a row adds a new node with that property pointing here (Undo is the faded arrow after the row’s name). Tick the box before nodes (Shift-click a box: every one between) to act on them together: open in the sidebar, change this page to another one in their property, take the link off, add a tag, copy, set or clear a property, or delete them. A list of more than three can be grouped: the word “group” after its count (or right-click the name, “Group by…”) groups it by tag, month or any property its nodes hold, each group folding, and the + at the end of a group adds a node with that group’s tag or value already set. The chevron before a node’s name opens it under its name: its properties, what points at it and its first bullets, with a faint empty bullet to write a new one in; nodes open in place until one would break its lines, then the outline shifts by one level: the outermost goes into the way back above, the next reads like a page at the top. While you type a new node’s words in the + line, what it would get shows under the line in grey, as the proposals do in a bullet (a guess with a dotted line under it): Enter takes everything shown, a click on a guess keeps that one and lets the other guesses go, Escape clears them until you type again; a page’s name typed in the words completes in grey after the cursor, and the Right arrow links it. The same in the empty bullet of an opened node. The node’s properties show above its bullets there; click what one holds to change it (the likely values first), and the faded Undo arrow puts it back. After Enter the + line stays open, empty, for the next node; Escape closes it. Changing this page to another for the picked nodes lists first the pages their own words name.' },
  { key: 'twoWayDays', type: 'boolean', title: 'Show each node’s day in the margin', default: true,
    description: 'Each node in the rows shows its day (its own date, or the day it was written on) in a column at the left. Off, the column goes and the rows move left into its place; the day still shows in the card when you point at a node, and the find line still finds it.' },
  { key: 'twoWayNames', hidden: true, type: 'string', title: 'How properties read on the other page', default: '',
    list: { pairs: '=', split: ';', suggest: 'properties', left: 'Property', right: 'Reads back as', about: 'A row on the page a property points to is named by the property itself (“Provider”). Give other words here, or from the row’s right-click, or the Properties table’s Reads back as cell.' },
    description: 'Other words for a row on the page a property points to, as “property = words; property = words”. A property not listed is named by itself (“Provider”), nothing added.' },
  { key: 'twoWayOneEnd', hidden: true, type: 'string', title: 'Properties hidden on the other page', default: '',
    list: { split: ';', suggest: 'properties', about: 'Properties whose link is not shown as a row on the page they point to, for a property that points at a busy page (a status, a city with hundreds of people). The link stays in that page’s Linked references and in searches. Set from the tag tree as well.' },
    description: 'Properties whose link is not shown as a row on the page they point to, as “property; property”. Useful for a property that points at a busy page (a status, a city with hundreds of people). The link itself stays: it still shows in that page’s Linked references and in searches. Set from the tag tree as well.' },
  { key: 'twoWayMentions', type: 'boolean', title: 'Mentions come up to the rows', default: true,
    description: 'On a page, the nodes whose words link it (“Called [[Dr. Mei Chen]] about the scan”) show as one more row under the rows from properties, “Mentioned in”, with their day and tag, folding, grouping and tick boxes like the other rows. Logseq still lists them under Linked references too. A node that points here through a property shows in that property’s row only. Tick a mention that has no tag and the bar offers to make it a node: the tag its words look like first, with the property that would point at this page (“Make it a Conversation · Spoke with Dr. Mei Chen”). Its words stay as they are; the faded Undo arrow takes it back. Right-click “mentioned in” to hide the row on that page.' },
  { key: 'twoWayMentionsHidden', type: 'string', title: 'Pages without the mentions row', default: '',
    list: { split: ';', about: 'Pages where the “Mentioned in” row is left out, for a page almost everything names. Set from the row itself: right-click “Mentioned in”, Hide mentions on this page. The mentions stay in the page’s Linked references.' },
    description: 'Pages where the “Mentioned in” row is left out, as “page; page”, for a page almost everything names. Set from the row itself: right-click “Mentioned in”, then Hide mentions on this page. The mentions stay in the page’s Linked references.' },
  { key: 'twoWayHideLinkedRefs', type: 'boolean', title: 'Leave out Logseq’s Linked references the rows replace', default: true,
    description: 'Logseq’s Linked references at the foot of a page list every node that links the page, under the page and bullets it sits in. The rows above show the same nodes: through a property, read backwards, and in “mentioned in” with the bullets they sit in, each opened in place. So on a page with rows, Linked references is left out. Not on a tag’s page (its nodes are Logseq’s own table there), nor on a journal day (where it also lists the tasks scheduled or due that day), nor where “mentioned in” is hidden. Off: Linked references shows as well. Unlinked references always stays.' },
  { key: 'twoWayHideTagLists', type: 'boolean', title: 'Leave out Logseq’s tag lists the rows repeat', default: true,
    description: 'Below a page’s own text, Logseq lists the nodes that link to the page under a heading named after their tag (“Appointment”, “Project”), for tags with two-way links turned on. The rows above already show those nodes, with the property that links them, so on a page that has the rows the list is left out. In the right sidebar it is left out always: the same nodes are in the page’s Linked references there. Off: Logseq’s list shows as well.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange, model;
const take = (core, names) => shared.take(core, names, warnOnce);

// What is known about the page on screen: its uuid and one group per field that points at it.
// byPage: each page's rows as last read this session, drawn at once when you come back to it (0.4.150).
// indexed (0.4.182): every page's rows were read in one look-up, so a page not in byPage has none, and a page
// opened for the first time gets its rows in the same frame as its title instead of half a second later.
// open, all and only (0.4.184): per row, whether its list is open, shows every record, or only one kind ("Infusion").
const state = { kindsAll: new Set(), listed: [], findDug: new Map(), findAsked: new Set(), version: 0, pageUuid: '', groups: [], byPage: new Map(), indexed: false, open: new Map(), all: new Set(), only: new Map(), box: null, html: '', picked: new Set(), lastPick: '', group: new Map(), values: new Map(), nodeDraft: null, mentionsOf: new Map(), raise: new Map(), dig: new Map(), focus: '', fresh: '', node: new Map(), nall: new Set(), ball: new Set(), steps: [], pageTitle: '', kept: new Map(), find: '' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayNumber = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayText = day => {
  if (!day) return '';
  const year = Math.floor(day / 10000), text = `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}`;
  return year === Math.floor(todayNumber() / 10000) ? text : `${text}, ${year}`;
};
// A tag's name is a singular noun, or an illness that ends in s whatever the number: Diagnosis, Diagnoses; Measles, Measles.
// The kind of a node as a word: a node with no tag has none.
const tagWord = tag => tag === 'note' ? 'node' : tag;
const plural = (word, n) => n === 1 ? word : /[^aeiou]y$/i.test(word) ? word.slice(0, -1) + 'ies' : /sis$/i.test(word) ? word.slice(0, -2) + 'es' : /(ss|us|x|z|ch|sh)$/i.test(word) ? word + 'es' : /s$/i.test(word) ? word : word + 's';
/* How a row is named (0.4.444, the owner, 2026-10-26: "we should get rid by default of adding these prepositions like of",
   "but still keep features of changing name"; "why are you adding an arrow?"): by the property's own name, as it is
   written, nothing added ("Provider", not "provider of"; the readings of 0.4.237 and 0.4.264 are gone). Other words are
   given in the twoWayNames setting, from the row's right-click or the Properties table's Reads back as cell. The pairs
   this setting held by default until now ("works at = works here" and the like) were never chosen, so they are passed
   over; a pair giving a property its own name again is no renaming. */
const OLD_DEFAULTS = new Set(['symptoms|logged in', 'ask|asked', 'works at|works here', 'insurer|insurer of', 'related|related to']);
function backwardsNames() {
  const names = new Map();
  for (const pair of String(setting('twoWayNames') || '').split(/[;\n]/)) {
    const [field, words] = pair.split('=').map(part => part?.trim());
    if (!field || !words || OLD_DEFAULTS.has(`${field.toLowerCase()}|${words.toLowerCase()}`) || words.toLowerCase() === field.toLowerCase()) continue;
    names.set(field.toLowerCase(), words);
  }
  return names;
}
const readBackwards = (name, names) => names.get(name.toLowerCase()) || name;

// Fields shown from one end only (0.4.174): "status; city" -> Set of lower-case names.
const oneEndNames = () => new Set(String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(name => name.trim().toLowerCase()).filter(Boolean));
// For the tag tree (parts/tags.js): how a field reads from the other end, and whether it shows there. Both
// are written to the settings above, so a change in the tree shows in the settings window too.
const backwardsLabel = name => readBackwards(name, backwardsNames());
const shownAtOtherEnd = name => !oneEndNames().has(name.toLowerCase());
function setBackwards(name, words) {
  words = String(words || '').replace(/[;=\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const pairs = String(setting('twoWayNames') || '').split(/[;\n]/).map(pair => pair.split('=').map(part => part?.trim())).filter(([field, said]) => field && said && field.toLowerCase() !== name.toLowerCase());
  // Back to its own name: no pair needed.
  if (words && words.toLowerCase() !== name.toLowerCase()) pairs.push([name, words]);
  saveSettings({ twoWayNames: pairs.map(([field, said]) => `${field} = ${said}`).join('; ') });
}
function setShownAtOtherEnd(name, shown) {
  const names = String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(n => n.trim()).filter(n => n && n.toLowerCase() !== name.toLowerCase());
  if (!shown) names.push(name);
  saveSettings({ twoWayOneEnd: names.join('; ') });
}

async function load() {
  const version = ++state.version;
  let pageUuid = '', groups = [];
  try {
    if (setting('twoWayRows')) {
      const page = await model.currentPage();
      // A zoomed-in block comes back with a page of its own; only a page gets the rows.
      // A journal day too (0.4.437: Linked references shows on a day, so the rows do); the Journals list, with many days
      // on screen, gets none (see draw).
      if (page && !page.page && isEntityId(page.id)) {
        state.pageJournal = !!(page['journal?'] || page.journalDay);
        state.pageDay = Number(page.journalDay) || 0;
        state.replaces = false;
        pageUuid = String(page.uuid || '');
        state.pageId = page.id;
        state.pageTitle = String(page.title || page.originalName || page.name || '');
        groups = await groupsFor(page.id);
        const title = String(page.title || page.originalName || page.name || '').toLowerCase();
        if (!hiddenMentions().has(title)) {
          let read = !!(setting('twoWayMentions') && provided.mentionsInto);
          const mentions = await mentionsGroup(page.id, groups).catch(error => { read = false; warnOnce('could not read the nodes that name this page', error); return null; });
          if (mentions) groups = [...groups, mentions];
          // The rows replace Linked references on a page that is not a tag, once its mentions were really read (0.4.437): with
          // them off, or a read that failed, Linked references is the only place they are.
          // Not on a journal day: its Linked references also lists the tasks scheduled or due that day, through Logseq's own
          // properties, which the rows do not read.
          state.replaces = read && !state.pageJournal && !(await provided.kindOfPage?.(page.id).catch(() => null))?.isTag;
        }
        await readValues(groupedUuids(groups)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
      }
    }
  } catch (error) { warnOnce('could not find the fields that point at this page', error); }
  if (version !== state.version) return;
  if (pageUuid !== state.pageUuid) { state.raise.clear(); state.raisePairs = null; }
  putBackOpen(pageUuid);
  state.pageUuid = pageUuid;
  state.groups = groups;
  state.readAt = performance.now();
  peek.cache.clear();
  if (pageUuid) { state.byPage.set(pageUuid, groups); state.mentionsOf.set(pageUuid, groups.find(isMentions) || null); }
  // What the open nodes hold, read again (each once), drawn when read.
  readOpen2();
  draw(host());
  // Asked the moment the page changed, Logseq can still have named the page being left: ask once more for the one on screen.
  const shown = shownPage(host());
  if (shown && shown !== pageUuid && state.retried !== shown) { state.retried = shown; later(0); }
}
const shownPage = doc => {
  const shown = doc ? [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid')) : [];
  return shown.length === 1 ? shown[0] : '';
};
// A page's rows, with what points at its other names: a node holding an alias points at the page.
async function groupsFor(id) {
  const groups = (await groupsByPage(id)).get(id)?.groups || [];
  for (const other of await provided.aliasesOf?.(id) || []) {
    for (const group of (await groupsByPage(other)).get(other)?.groups || []) {
      const same = groups.find(g => g.name === group.name);
      if (!same) groups.push(group);
      else same.items = [...same.items, ...group.items.filter(item => !same.items.some(x => x.uuid === item.uuid))];
    }
  }
  return groups;
}
// A node's stored words as they read: links as the words they show (0.4.147), "saw [[Dr. Joe]]" as "saw Dr. Joe",
// "[the scan]([[CT]])" as "the scan", tags written in the words left out.
async function wordsOf(stored) {
  let title = stored;
  try { title = await provided.readableTitle(title); } catch { /* the stored words, then */ }
  return String(title).replace(/\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+)/g, '').replace(/\[([^\[\]]+)\]\(\[\[[^\]]*\]\]\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1').trim() || 'Untitled';
}
// Coming up first (nearest first), then the past (latest first), then nodes with no date.
const byWhen = today => (a, b) => (a.day >= today ? 0 : a.day ? 1 : 2) - (b.day >= today ? 0 : b.day ? 1 : 2) ||
  (a.day >= today ? a.day - b.day : b.day - a.day) || a.title.localeCompare(b.title);
/* Mentions come up to the rows (0.4.423, the owner's pick A from docs/history/TWO-WAY-POTENTIALS-2026-10-25.html, "do A
   and B"): the nodes whose own words link this page, which Logseq shows only in Linked references at the foot, as one
   more row after the rows from properties, "Mentioned in", drawn and worked like them (folding, grouping, tick boxes,
   the arrow into a node). A mention stays a mention: nothing is written by showing it. A node that points here through
   a property is in that property's row only. The row's name is MENTIONS, which no property can be called (Logseq
   trims a property's name), so the row's open state, order and grouping are kept like any row's. Hidden per page by the
   twoWayMentionsHidden setting (the right-click on its name). Read for the page on screen only, never for every page. */
const MENTIONS = ' mentioned in';
const isMentions = group => group?.name === MENTIONS;
const hiddenMentions = () => new Set(String(setting('twoWayMentionsHidden') || '').split(/[;\n]/).map(name => name.trim().toLowerCase()).filter(Boolean));
async function mentionsGroup(id, groups) {
  if (!setting('twoWayMentions') || !provided.mentionsInto) return null;
  const filed = new Set(groups.flatMap(g => g.items.map(item => item.uuid)));
  const found = (await provided.mentionsInto(id)).filter(m => UUID.test(m.uuid) && !filed.has(m.uuid));
  if (!found.length) return null;
  // What an untagged mention looks like, asked once each, a few at a time (0.4.438): at once when the earlier lines are
  // read, else after a quiet moment, since asking reads them, and a look at a page reads no whole graph.
  askQuietly.uuids = found.filter(m => !m.tag).slice(0, 30).map(m => m.uuid);
  clearTimeout(state.quiet);
  if (askQuietly.uuids.length) state.quiet = setTimeout(askQuietly, provided.earlierLinesRead?.() ? 0 : QUIET);
  // Each with the page and bullets it sits in, as Linked references shows it (0.4.437).
  const crumbs = provided.crumbsInto ? await provided.crumbsInto(id).catch(() => new Map()) : new Map();
  const items = await Promise.all(found.map(async m => ({ uuid: m.uuid, title: await wordsOf(m.title), tag: m.tag || 'note', day: m.day,
    crumbs: await Promise.all((crumbs.get(m.uuid) || []).map(async c => ({ uuid: c.uuid, name: shortName(await wordsOf(c.title)) }))) })));
  items.sort(byWhen(todayNumber()));
  return { name: MENTIONS, label: 'Mentioned in', items, fieldUuid: '', ident: '', mentions: true };
}
const QUIET = 5000;
function askQuietly() { for (const uuid of askQuietly.uuids.splice(0)) prepareRaise(uuid).catch(() => {}); }
askQuietly.uuids = [];
// Whether words being written reach this page's rows: a row's node or a node opened from it, a bullet under one of those, or
// a line that links this page. Writing elsewhere, or on this page itself, changes nothing the rows show.
function touchesRows({ blocks = [] } = {}) {
  const shown = new Set([...state.groups.flatMap(g => g.items.map(item => item.uuid)), ...state.node.keys()]);
  return blocks.some(b => shown.has(b.uuid) || shown.has(b.parent?.uuid) || (state.pageUuid && String(b.rawTitle || b.title || '').includes(state.pageUuid)) || b.refs?.some(ref => (ref?.id ?? ref) === state.pageId));
}
// The rows of one page (id), or of every page that is not a journal (no id), as a Map of page id to { uuid, groups }.
// The nodes that point at the pages come from the model (linksInto, 0.4.225); this shapes them into rows.
async function groupsByPage(id) {
  const { pages, fields, records: found } = await provided.linksInto(id);
  if (!found.size) return new Map();
  const records = new Map();
  // The titles are made readable together (0.4.150): each one with a link in it asks the database for that link's name.
  await Promise.all([...found].map(async ([b, record]) => { records.set(b, { uuid: record.uuid, title: await wordsOf(record.title), tag: record.tag || 'note', day: record.day }); }));
  const names = backwardsNames(), today = todayNumber(), oneEnd = oneEndNames();
  // What each property holds, for the icon before its name (0.4.477): a Date row on a journal day is a calendar, not the
  // triangle of a link to a node.
  const schema = !provided.propSchema ? null : await provided.propSchema().catch(error => { warnOnce('the properties’ kinds could not be read', error); return null; });
  const propOf = new Map((schema?.props || []).map(p => [p.title, p]));
  const kindOf = name => { const p = propOf.get(name); return p ? { kind: p.choices?.length ? 'choice' : p.type, many: !!p.many } : { kind: 'node', many: false }; };
  const result = new Map();
  for (const [page, { uuid, byField }] of pages) {
    const groups = [];
    for (const [name, set] of byField) {
      if (oneEnd.has(name.toLowerCase())) continue;
      const items = [...set].map(b => records.get(b)).filter(item => item && UUID.test(item.uuid));
      if (!items.length) continue;
      items.sort(byWhen(today));
      groups.push({ name, label: readBackwards(name, names), items, fieldUuid: fields.get(name)?.uuid || '', ident: fields.get(name)?.ident || '', ...kindOf(name) });
    }
    groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    result.set(page, { uuid, groups });
  }
  return result;
}

// Every page's rows in one look-up (0.4.182), at the start and again when the graph has been still for a while. The
// page on screen still asks for its own rows, which are newer; this only lets a page show its rows from its first
// frame. In a graph with very many links it is read once, at the start, so typing never waits behind it.
const BIG_INDEX = 5000;
let indexVersion = 0, indexSize = 0;
async function loadIndex() {
  const version = ++indexVersion;
  if (!setting('twoWayRows')) { state.indexed = false; return; }
  const all = await groupsByPage(null);
  if (version !== indexVersion) return;
  indexSize = 0;
  for (const { groups } of all.values()) for (const group of groups) indexSize += group.items.length;
  const fresh = new Map();
  for (const { uuid, groups } of all.values()) if (UUID.test(uuid) && groups.length) fresh.set(uuid, groups);
  // The mentions rows read this session stay with their pages (the index reads none: they are read page by page).
  for (const [uuid, mentions] of state.mentionsOf) if (mentions) fresh.set(uuid, [...(fresh.get(uuid) || []), mentions]);
  // The page on screen keeps what its own look-up found.
  if (state.pageUuid && state.byPage.has(state.pageUuid)) fresh.set(state.pageUuid, state.byPage.get(state.pageUuid));
  state.byPage = fresh;
  state.indexed = true;
  const want = [...fresh.values()].flatMap(groupedUuids);
  if (want.length) await readValues(want.slice(0, 2000)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
}

// "9 Appointments · next on Nov 12", "4 Lab panels, 3 Imaging studies · from Aug 2 to Oct 9"; whenOnly: the day part alone.
// The days said in words (0.4.402, the owner: "unclear from the visuals what the date mean"): from the first to the last,
// or the next one still to come; the tip says where a node's day comes from (WHEN_TIP).
function summary(items, whenOnly = false) {
  const counts = new Map();
  for (const item of items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${n} ${plural(tag, n)}`).join(', ');
  const today = todayNumber(), days = items.map(item => item.day).filter(Boolean);
  const next = days.filter(day => day >= today).sort((a, b) => a - b)[0];
  let when = '';
  if (next) when = `next on ${dayText(next)}`;
  else if (days.length) { const first = Math.min(...days), last = Math.max(...days); when = first === last ? `on ${dayText(first)}` : `from ${dayText(first)} to ${dayText(last)}`; }
  return whenOnly ? when : [kinds, when].filter(Boolean).join(' · ');
}
const WHEN_TIP = 'The days of these nodes: each node’s date, or the journal day it is written on';
const INLINE = 3, LISTED = 5;
/* Moving around the rows (0.4.184, the + and the hovers 0.4.185, the owner asked for the rows to be more interactive). A record's name
   opens it; Shift-click opens it in the sidebar (the icon at its
   end that did the same went on 31 October 2026). Resting on a record shows a card with its fields and first lines (peek, below). The field's
   name opens the field's own page. In an open list, a row of kinds ("All 13 · Infusion 8 · Scan 1") shows only
   that kind, as does a kind at the end of a line; a line marked "earlier" parts what is coming up from what is
   past; "show all 13" folds back with "show fewer". Whether a list is open is kept across restarts. */
/* A node's name: its own words, cut at a width, never at a sentence ("Clinic.", three times, could not be told apart; the
   review, 31 October). On a row the width is the row's (one line, with an ellipsis: the name in the stylesheet, its tag kept
   whole); opened, or while finding, it wraps; cut, the card shows the whole of it. This is for where words go in a sentence or a
   small place (a notice, a crumb, the trail). */
const NAME_ROOM = 60;
function shortName(title) {
  const text = String(title || '').trim();
  return text.length > NAME_ROOM ? text.slice(0, NAME_ROOM).replace(/\s+\S*$/, '') + '…' : text;
}
/* The + (as it was until 0.4.296, at the owner's word, 0.4.303: "return that code before we moved around the plus"): at the
   end of the last node of a short row, after the summary of a list. A click opens
   the line to type the new node in. Since 0.4.297 a short row's nodes span the row so their tags line up, so the + sits
   just after the last node's date (or name). The library's lk-plus. */
const addLink = group => group.ident && state.draft?.field !== group.name ? `<button type="button" class="lk-plus rf-tw-add" data-field="${esc(group.name)}" title="Add a${/^[aeiou]/i.test(kindsOf(group)[0] || '') ? 'n' : ''} ${esc(kindsOf(group)[0] || 'node')} with “${esc(group.name)}” set to this page">+</button>` : '';
// The kit's tick box, in the margin left of the record (0.4.228; the kit's since 0.4.318).
const pickBox = (group, item) => drawingTop ? '' : pickOn(group, item);
const pickOn = (group, item) => { const key = `${item.uuid}|${group.name}`, on = state.picked.has(key); state.listed.push(key); return `<input type="checkbox" class="rf-check lk-tick rf-tw-pick" data-pick="${esc(key)}"${on ? ' checked' : ''} aria-label="Pick" title="Pick (Shift-click: every one from the last picked)">`; };
// A record's tag at the right opens the tag's page, Shift-click in the sidebar (0.4.297, the owner: "should be able to
// click on tag in two-way area on right side"); a tag reads as a class, mono with no # (the kit's tag, 0.4.318).
const tagLink = item => item.tag && item.tag !== 'note' ? `<a class="rf-tag lk-tag rf-tw-tag" data-tag-page="${esc(item.tag)}" href="#">${esc(item.tag)}</a>` : `<span class="rf-tag lk-tag rf-tw-tag">${esc(item.tag)}</span>`;
// No sidebar icon at the end of a line (the review, 31 October: a control per row, and a long name left a blank line
// under itself where the icon wrapped); Shift-click on the name opens it in the sidebar, as everywhere in Logseq.
/* The rows on the kit's outline (0.4.442, docs/REWORK.md 4, the owner's drawings of 2026-10-26): every node on a line of its
   own, the tick box in the margin, its day in a column of one width, the one chevron right before its name, its tag
   after it. A row of more than three folds by the chevron before its count; its list opens under it. */
const O = shared.outline;
// On a journal day, a node of that day shows no day: the page's title says it (0.4.462).
const dayCell = item => item.day && item.day !== state.pageDay ? dayText(item.day) : '';
/* The day a node's line shows, by its place (the row's or the node's key), so what it opens leaves out a Date saying it
   again (0.4.462, the owner's pick 3 of the two-way fixes: "each line drops what its heading already says"). */
const lineDay = new Map();
const nameHtml = (item, open = false, bare = false) => `<a class="rf-tw-record rf-ol-name lk-node${bare ? ' lk-bare' : ''}${open ? ' rf-ol-open' : ''}" data-uuid="${esc(item.uuid)}" href="#">${esc(item.title)}</a>${item.tag && item.tag !== 'note' ? '<wbr>' + tagLink(item) : ''}`;
/* top: the node at the top of a shifted section (0.4.463): its rows are drawn as the page's are, keyed under it; nothing
   in them acts on the page (no tick boxes, no +, no Group). */
let drawingTop = false;
function rowHtml(group, top = null) {
  const key = `${top ? top.uuid : state.pageUuid}|${group.name}`;
  const tip = isMentions(group) ? 'These nodes name this page in their words. Right-click to hide this row here.' : `“${esc(group.name)}” on the nodes listed here points to this page. Change it on the node.`;
  const label = group.found && group.whole ? `<span class="rf-tw-matchname">${esc(group.label)}</span>` : esc(group.label);
  const name = group.fieldUuid
    ? `<div class="rf-tw-name lk-prop"><span class="rf-kind">${shared.kindIconHtml(group.kind || 'node')}</span><a class="rf-tw-field" data-uuid="${esc(group.fieldUuid)}" href="#" title="${tip} Click to open the property “${esc(group.name)}”.">${label}</a></div>`
    : `<div class="rf-tw-name lk-prop" title="${tip}">${label}</div>`;
  const base = top ? top.key : `r:${group.name}`;
  // Each row's list is a list of its own for the tick boxes (Look's lk-list): the pointer on it raises its boxes and no
  // other's; while anything is ticked every list shows its boxes, as before.
  const listCls = `rf-tw-value rf-ol lk-list`, picking = state.picked.size && !drawingTop ? ' data-picking=""' : '';
  // A row of one is the node itself, in place (its name, then its tag), not a header (1.0.2, the owner: "it is fine
  // that not everyone looked the same, especially since it is header v node"); every list of two or more has the one header.
  if (group.items.length === 1 && !(group.found && group.total > 1)) {
    const lines = group.items.map(item => itemHtml(group, item, base, addLink(group))).join('');
    return `<div class="rf-tw-row" data-field="${esc(group.name)}">${name}<div class="${listCls}"${picking}>${lines}${addLineHtml(group)}</div></div>`;
  }
  // While finding, a list opens in full only once something of it is left out (the reviewer: one letter made the list
  // longer, 323 → 535 px, a folded list unfolding though nothing was filtered).
  const narrowed = !!group.found && group.items.length < group.total;
  // In full only once the found are few: one node dropping out no longer makes the list three times longer.
  const open = narrowed || isOpen(key), all = state.all.has(key) || (narrowed && group.items.length <= LISTED);
  // While finding, the head keeps the whole list's words and order and only the nodes narrow (the review, 31 October:
  // "Consultation · Infusion · Scan" became "Infusion · Consultation" and "Admissions · from Aug 13 to Sep 12" became
  // "Admission · on Aug 13" as letters were typed), so the eye keeps its place.
  const whole = (group.found && state.groups.find(g => g.name === group.name)) || group;
  const counts = new Map();
  for (const item of whole.items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const only = counts.has(state.only.get(key)) ? state.only.get(key) : '';
  const items = only ? group.items.filter(item => item.tag === only) : group.items;
  const shown = all ? items : items.slice(0, LISTED);
  /* The kinds as the kit's filter words, the one in force in the text colour. With several kinds they are the line by the
     chevron itself, the days at the end (0.4.399, the owner: the header "3 Therapeutic sessions, 3 Cancer Drugs" said what
     the words under it said again): folded it reads as the summary, and a click on a kind opens the list with only those. */
  const chip = (tag, text, cls = '', raw = false) => `<button type="button" class="rf-chip rf-tw-chip${cls}" data-key="${esc(key)}" data-tag="${esc(tag)}" aria-pressed="${tag === only}">${raw ? text : esc(text)}</button>`;
  const kinds = counts.size > 1;
  /* One style for every list (1.0.2): the count and what they are first, in one weight ("11 Symptom Logs", or "4 nodes"
     when they are of several kinds); after it, quiet and parted by a dot, the kinds as filter words and the days. With several kinds the count is the old "All": it folds and unfolds the
     list, and shows every node again when one kind is picked. */
  const total = whole.items.length;
  const when = summary(whole.items, true);
  // The mentions row's head is its days alone (the review, 31 October: "notes" was the plugin's word for an untagged
  // mention, under a row already called "Mentioned in"); where the mentions are of several kinds, the kinds stay.
  const daysOnly = isMentions(group) && !kinds && !!when;
  // The number is a count (the grammar: none shown, lk-count); it is there for the words' sake.
  const leadText = kinds ? `All ${total}` : `${total} ${esc(plural(tagWord(whole.items[0]?.tag || 'note'), total))}`;   // the number shows on a closed head (the owner, 1 November, the research's rule that a head says what it holds)
  const lead = daysOnly ? '' : kinds ? chip('', leadText, ' rf-tw-lead', true)
    : `<a class="rf-tw-toggle rf-tw-lead" data-key="${esc(key)}" href="#" title="Click to ${open ? 'fold' : 'open'} the list.">${leadText}</a>`;
  const whenHtml = when ? `<a class="rf-tw-toggle rf-tw-when" data-key="${esc(key)}" href="#" title="${WHEN_TIP}. Click to ${open ? 'fold' : 'open'} the list.">${esc(when).replace(/ (?=\d)/g, '&nbsp;')}</a>` : '';
  const sep = '<span class="rf-tw-sep" aria-hidden="true">·</span>';
  // Three kinds, then "and 12 more" (the grammar; a click shows them all), the one in force always among them. The days stay.
  const byCount = [...counts].sort((a, b) => b[1] - a[1]);
  const named = state.kindsAll.has(key) || byCount.length <= 3 ? byCount : byCount.findIndex(([tag]) => tag === only) > 2 ? [...byCount.slice(0, 2), byCount.find(([tag]) => tag === only)] : byCount.slice(0, 3);
  const rest = byCount.length - named.length;
  const tail = [...(kinds ? named.map(([tag, n]) => chip(tag, `${esc(tag === 'note' ? 'No tag' : tag)} <span class="lk-count">${n}</span>`, '', true)) : []), ...(kinds && rest ? [`<button type="button" class="lk-more rf-tw-kinds" data-kinds="${esc(key)}">and ${rest} more</button>`] : []), whenHtml].filter(Boolean);
  // Each piece keeps its dot in the gap before it, and the head clips what stands before its left edge: a line that wraps starts on
  // its words, never on a dot (the stylesheet).
  const head = `<span class="rf-tw-chips">${lead}${tail.map((piece, i) => `<span class="rf-tw-piece">${lead || i ? sep : ''}${piece}</span>`).join('')}</span>`;
  let list = '';
  if (open) {
    const today = todayNumber();
    // Grouped (0.4.369): the nodes in groups by a tag, a month or a property's value, each group folding.
    const grouping = groupingOf(group, items);
    if (grouping) list = grouping.parts.map(part => groupHtml(group, part, grouping.by)).join('');
    else {
      const bare = !!only || counts.size === 1, tell = bare ? tellingProp(group, items) : '';
      list = shown.map((item, i) => (i > 0 && item.day && item.day < today && shown[i - 1].day >= today ? '<div class="rf-tw-earlier rf-note">earlier</div>' : '') + itemHtml(group, item, base, '', bare, tell)).join('')
        + (items.length > LISTED ? O.more({ text: all ? 'show fewer' : 'show all', attrs: { class: null, 'data-more': key }, under: 'name' }) : '');
    }
  }
  const fold = O.chev({ open, label: group.label, attrs: { 'data-fold': key } });
  // The list's own line is the parent of its nodes (the owner, 2026-10-27: "header chevron is over the other chevrons of
  // its children"): its chevron starts where the days do, its words right after; the nodes, their days too, one step in.
  const headLine = O.line({ day: null, chev: fold, body: `${head}${addLink(group)}${groupBtn(group)}`, cls: 'rf-tw-head' });
  const listHtml = open ? O.kids({ html: list, cls: 'rf-ol-bare rf-tw-list', fresh: state.fresh === key }) : '';
  return `<div class="rf-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="${listCls}"${picking}>${headLine}${listHtml}${addLineHtml(group)}</div></div>`;
}
// One node of a row: its line, where it sits (a mention's page and bullets), what it could be, and what it holds when open.
// bare: the heading above names the one tag, so the lines leave it out (0.4.404; 0.4.462 for a list of one kind); tell:
// the property whose value tells these nodes apart, said in the tag's place.
function itemHtml(group, item, base, end = '', bare = false, tell = '') {
  const key = `${base}>${item.uuid}`, open = state.dig.has(key);
  const shown = bare ? { ...item, tag: '' } : item;
  // [day] [chevron] [node] (the owner, 2026-10-27: "have [date] [chevron] [bullet]"), on every line: the day always in
  // the margin, so the left edge means time (0.4.462; "Name first", the day after the tag, is gone). What a node opens
  // hangs from its chevron (0.4.454).
  // Opened by the find field, its name keeps its weight, so the tag and day after it do not slide right as letters
  // are typed (the reviewer: 4 to 9 px).
  lineDay.set(key, dayCell(item));
  // Opened, the node's properties show the telling value: the line lets go of it.
  const body = `${nameHtml(shown, open && state.findDug.get(key) !== true, bare)}${couldBeHtml(item)}${tell && !open ? tellHtml(item, tell) : ''}${end}`;
  const line = O.line({ tick: pickBox(group, item), day: dayCell(item), chev: digChev(key, item.uuid, 0, shortName(item.title), open), body, cls: 'rf-tw-line', attrs: { 'data-uuid': item.uuid } });
  const under = `${crumbHtml(item)}${raiseHtml(group, item)}`;
  return open ? O.unit({ html: line + under + digKids(key, item.uuid, 'in'), focus: state.focus === key, attrs: { 'data-key': key } }) : line + under;
}
/* Where a mention sits (0.4.437): its page and the bullets above it, small, under its line. A mention with no tag whose
   words look like a known kind (0.4.438) says so, pencilled in where its tag would stand, on its own line, so that coming late
   moves nothing (the review, 31 October: it came after the rows and pushed them down): a click opens Make it… for that one mention. */
const couldBeHtml = item => {
  const best = (!item.tag || item.tag === 'note') ? state.raise.get(item.uuid)?.best : null;
  return best ? O.pencil(`could be a ${best.tag.title} · ${best.prop.title}`, { 'data-could': item.uuid, title: `Its words look like a ${best.tag.title}: click to make it one, with “${best.prop.title}” set to this page` }) : '';
};
// A crumb that is only the journal day the node is written on says the day again: left out. Each place is a step (lk-step,
// the faint underline of the trail): a press opens its page or bullet, Shift in the right sidebar.
const crumbsOf = item => (item.crumbs || []).filter((c, i) => !(i === 0 && item.day && /^[A-Z][a-z]{2} \d{1,2}(st|nd|rd|th), \d{4}$/.test(c.name)));
const crumbHtml = item => crumbsOf(item).length ? `<div class="rf-tw-crumb">${crumbsOf(item).map(c => `<a class="lk-step" href="#" data-open-uuid="${esc(c.uuid)}">${esc(c.name)}</a>`).join('<span class="rf-ol-sep"> › </span>')}</div>` : '';

/* Digging, one model (0.4.442, docs/REWORK.md 4; it replaces the node opened in a row, the chain opened inside it and the
   step into a node, three models drawn three ways). state.dig: every node open, by its place: the row ('r:Provider'),
   then '>uuid' for each node down, the whole path from the page. A node opens in place under its own name for three
   levels or less: once a node just opened has a line that would break, the outline shifts (0.4.463, 0.4.464 by fit,
   fitOrShift): the node below the top becomes the top and the top goes into the trail (state.steps, each with its key, a click back; Esc one step back
   once nothing is open under the top). state.focus is the place opened last: its line and what it holds
   sit on the light grey wash; a click inside another open node moves it there, closing it or Esc hands it to its
   parent. The way down is never listed again under a node (a node on the way, or this page, is left out). What a node
   holds is read in one go (state.node, readNode) and drawn once, unrolling; until it is read only its chevron turns. */
const BULLETS = 8;
// The node at the top of the section, and how deep a key is below it.
const topStep = () => state.steps[state.steps.length - 1] || null;
const below = key => { const t = topStep(); return t?.key ? (key.startsWith(t.key + '>') ? pathOf(key).length - pathOf(t.key).length : -1) : pathOf(key).length; };
// The core's uuid test; a drawing made before the part starts (the odd-names test) uses the same shape.
const isUuid = text => (UUID || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(String(text || ''));
const pathOf = key => key.split('>').slice(1);
const parentKey = key => key.split('>').slice(0, -1).join('>');
const onTheWay = (path, uuid) => path.includes(uuid) || uuid === state.pageUuid || state.steps.some(s => s.uuid === uuid);
function digChev(key, uuid, id, title, open = state.dig.has(key)) {
  if (!isUuid(uuid)) return '';
  return O.chev({ open, label: title, attrs: { 'data-dig': key, 'data-uuid': uuid, 'data-id': id ? String(id) : null, 'data-title': title } });
}
// What an opened node holds, under its name; the hairline starts at the chevron of its line ('day', 'prop', 'back', '').
function digKids(key, uuid, from) {
  const data = state.node.get(uuid);
  if (!data) return '';
  const fresh = state.fresh === key;
  return O.kids({ html: nodeHtml(uuid, key, data), from, fresh, attrs: { 'data-key': key } });
}
function nodeHtml(uuid, key, data, asTop = false) {
  const path = [...state.steps.map(s => s.uuid), ...pathOf(key)];
  // Opened by the find field: only its lines that hold the words, as they read when the node is dug.
  const onlyFound = state.findDug.get(key) === true && !!state.find.trim();
  let html = '';
  // A value that is the way back (this page, or the node above) is left out: the row's property, on the left of the line
  // it opened from, already says how the node is tied here, and a thread cannot loop back on itself (the owner, 0.4.451:
  // the line saying it again inside was "not right"). A property holding only the way back goes with it.
  const back = v => isUuid(v.uuid) && onTheWay(path, v.uuid);
  // A Date saying the day its line already shows in the margin is left out (0.4.462).
  const day = lineDay.get(key) || '';
  for (const { prop, values: all } of data.props) {
    const values = all.filter(v => !back(v));
    if (all.length && !values.length) continue;
    if (day && prop.type === 'date' && values.length && values.every(v => v.text === day)) continue;
    const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
    const linked = (kind === 'node' || kind === 'page') && values.some(v => isUuid(v.uuid));
    const guess = !values.length ? data.guesses.get(prop.ident) : null;
    const found = findsLine(prop, values) ? 'rf-tw-match' : '';
    if (onlyFound && (!found || (prop.type === 'date' && !has(prop.title, state.find.trim().toLowerCase())))) continue;
    const nameAttrs = { 'data-edit': prop.ident, 'data-uuid': uuid, title: `Change “${prop.title}”`, class: null };
    if (guess) { html += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, value: O.pencil(guess.shown || '', { 'data-take': prop.ident, 'data-uuid': uuid, title: `${guess.guess ? 'A guess from its words' : 'From its words'}: click to fill it in` }) }); continue; }
    if (!linked) {
      // Several words or numbers: each its own, changed one at a time; the property's name adds another.
      const one = (text, at = '') => `<button type="button" class="rf-tw-npvalue${values.length ? '' : ' rf-faint'}" data-edit="${esc(prop.ident)}" data-uuid="${esc(uuid)}"${at} title="Change “${esc(prop.title)}”">${esc(text)}</button>`;
      const typed = !['choice', 'checkbox', 'date', 'datetime'].includes(kind);
      html += O.prop({ kind, many: prop.many, name: prop.title, nameAttrs, cls: found, value: !values.length ? one('empty') : typed && prop.many ? `<span>${values.map((v, i) => `<span>${one(v.text, ` data-value="${i}"`)}</span>`).join(', ')}</span>` : one(values.map(v => v.text).join(', ')) });
      continue;
    }
    values.forEach((v, i) => {
      const k = `${key}>${v.uuid}`, open = state.dig.has(k);
      const item = { uuid: v.uuid, title: v.text, tag: data.tags.get(v.id) || '' };
      const line = O.prop({ kind, many: prop.many, name: i ? '' : prop.title, nameAttrs: i ? null : nameAttrs, cls: found, chev: isUuid(v.uuid) ? digChev(k, v.uuid, v.id, v.text, open) : '', value: `<span class="rf-ol-body">${isUuid(v.uuid) ? nameHtml(item, open) : esc(v.text)}</span>` });
      html += open ? O.unit({ html: line + digKids(k, v.uuid, 'prop'), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
    });
  }
  if (onlyFound) return html + O.more({ text: 'show the rest', attrs: { 'data-findall': key } });
  if (data.guesses.size > 1 && data.props.filter(r => !r.values.length && data.guesses.has(r.prop.ident)).length > 1) html += O.more({ text: 'Take what is proposed', cls: 'lk-lone lk-i-tick', attrs: { 'data-takeall': uuid } });
  /* The nodes that link to it, after its own properties, under a line saying so: "2 nodes link here"
     (0.4.462, the owner's pick 2 of the two-way fixes: the same property
     name, one line apart, read as the node's own and as what links to it). Under it one step in, a row per property, one
     name per line, three then "show all"; each node's day in the section's margin, as on the rows (placeDays). */
  const linking = asTop ? [] : data.rows.map(g => ({ g, items: g.items.filter(item => !onTheWay(path, item.uuid)) })).filter(r => r.items.length);
  const many = linking.reduce((n, r) => n + r.items.length, 0);
  if (many) {
    let lines = '';
    for (const { g, items } of linking) {
      const allKey = `${key}|${g.name}`, all = state.nall.has(allKey);
      (all ? items : items.slice(0, INLINE)).forEach((item, i) => {
        const k = `${key}>${item.uuid}`, open = state.dig.has(k);
        lineDay.set(k, dayCell(item));
        const line = O.prop({ kind: g.kind || 'node', many: g.many, name: i ? '' : g.label, cls: 'rf-tw-back', value: `${digChev(k, item.uuid, 0, shortName(item.title), open)}<span class="rf-ol-body">${nameHtml(item, open)}</span>${item.day ? `<span class="rf-ol-day rf-tw-mday">${esc(dayCell(item))}</span>` : ''}` });
        lines += open ? O.unit({ html: line + digKids(k, item.uuid, 'prop'), focus: state.focus === k, attrs: { 'data-key': k } }) : line;
      });
      if (items.length > INLINE) lines += O.more({ text: all ? 'show fewer' : 'show all', attrs: { 'data-nall': allKey }, under: 'value' });
    }
    html += `<div class="rf-tw-links" title="${esc(`${many} ${many === 1 ? 'node links' : 'nodes link'} to ${shortName(titleOf(uuid))}`)}"><span class="lk-count">${many}</span> ${many === 1 ? 'node links' : 'nodes link'} here</div><div class="rf-tw-linked">${lines}</div>`;
  }
  for (const line of data.bullets) html += O.bullet({ html: lineHtml(line.text, 400), attrs: { 'data-bullet': line.uuid } });
  if (data.more) html += O.more({ text: 'show all its bullets', attrs: { 'data-ball': uuid } });
  html += O.newBullet({ label: `A new bullet inside ${shortName(titleOf(uuid))}`, attrs: { class: 'rf-tw-node-field', 'data-uuid': uuid, 'data-key': key } });
  return html;
}
// What a node is called, wherever it was seen.
function titleOf(uuid) {
  for (const s of state.steps) if (s.uuid === uuid) return s.title;
  for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return shortName(item.title);
  for (const data of state.node.values()) {
    for (const g of data.rows) for (const item of g.items) if (item.uuid === uuid) return shortName(item.title);
    for (const { values } of data.props) for (const v of values) if (v.uuid === uuid) return v.text;
  }
  return 'a node';
}
/* Read in one go (0.4.442): its properties with the tags of what they point at, what points at it, its first bullets and
   what the proposals would fill in; kept by node, so a node opened again draws at once and is read again behind. */
const reading = new Map();
// look: the pointer passing over a fold arrow, which reads the node but not the earlier lines the proposals learn from.
function readNode(uuid, id, { look = false } = {}) {
  const key = look ? uuid + '?' : uuid;
  if (reading.has(key)) return reading.get(key);
  const job = (async () => {
    const schema = await provided.propSchema();
    const nodeId = Number(id) || await provided.idByUuid(uuid).catch(() => 0);
    const [fields, held, rows, lines] = await Promise.all([
      provided.fieldsOf(uuid, schema), provided.nodeValues([uuid], { logseqs: true }),
      nodeId ? groupsFor(nodeId).catch(error => { warnOnce('could not read what points at a node', error); return []; }) : [],
      provided.firstLines(uuid, (state.ball.has(uuid) ? 500 : BULLETS) + 1, true).catch(error => { warnOnce('could not read the bullets of a node', error); return []; })]);
    const byIdent = new Map([...(held.get(uuid) || new Map()).values()].map(h => [h.ident, h.values]));
    const readable = async text => { try { return String(await provided.readableTitle(String(text ?? ''))).trim(); } catch { return String(text ?? '').trim(); } };
    // Its tags' properties, then any other property it holds (a value set without the tag giving it, as a Treatment holding
    // "Side effects"), so whatever it holds shows (0.4.450; the way back itself is left out when drawn, 0.4.451).
    const given = new Set(fields.map(p => p.ident));
    const extra = [...byIdent.keys()].filter(ident => !given.has(ident)).map(ident => schema.props.find(p => p.ident === ident)).filter(Boolean);
    // text as it reads; words as written, links whole, for the box that changes it; stored as Logseq holds it.
    const props = await Promise.all([...fields, ...extra].map(async prop => ({ prop, values: await Promise.all((byIdent.get(prop.ident) || []).map(async v => { const words = v.day ? '' : await readable(v.text); return { id: v.id ?? null, uuid: v.day ? '' : String(v.uuid || ''), text: v.day ? dayText(v.day) : words.replace(/\[\[([^\]]+)\]\]/g, '$1'), words, stored: v.text }; })) })));
    // The property that points at this page stays in the list (the owner, 2026-10-27: "the nodes should actually have the
    // property that points to in the property list as well so there isn't confusion about relationship").
    const kept = props;
    const ids = kept.flatMap(r => r.values.map(v => v.id)).filter(Number.isSafeInteger);
    const most = state.ball.has(uuid) ? 500 : BULLETS;
    const [tags, bullets, guesses] = await Promise.all([
      provided.firstTags ? provided.firstTags(ids).catch(() => new Map()) : new Map(),
      Promise.all(lines.map(async line => ({ uuid: line.uuid, text: await readable(line.title) }))),
      !look && kept.some(r => !r.values.length) && provided.nodeProposals ? provided.nodeProposals(uuid).catch(() => []) : []]);
    const empty = new Set(kept.filter(r => !r.values.length).map(r => r.prop.ident));
    state.node.set(uuid, { props: kept, rows, tags, bullets: bullets.filter(line => line.text).slice(0, most), more: lines.length > most,
      guesses: new Map(guesses.filter(g => empty.has(g.ident) && (g.kind !== 'day' || g.journalId)).map(g => [g.ident, g])) });
  })().finally(() => reading.delete(key));
  reading.set(key, job);
  return job;
}
const shownNode = uuid => [...state.dig.keys()].some(k => k.endsWith('>' + uuid)) || state.steps.some(s => s.uuid === uuid);
// Read again, then drawn, for every open node that shows this one (a change made in it, the graph changed).
async function readAgain(uuid) { await readNode(uuid); if (shownNode(uuid)) draw(host()); }
async function toggleDig(key, uuid, id, title) {
  if (state.dig.has(key)) { shared.outline.close(state.box?.querySelector(`.rf-ol-kids[data-key="${CSS.escape(key)}"]`), () => closeDig(key)); return; }
  const from = nameRect(key);
  state.dig.set(key, { uuid, id: Number(id) || 0, title });
  state.focus = key;
  const had = state.node.has(uuid);
  if (!had) { state.html = null; draw(host()); await readNode(uuid, id, { look: true }).catch(error => warnOnce('could not read a node', error)); }
  if (!state.dig.has(key)) return;
  state.fresh = key; state.html = null; draw(host()); state.fresh = '';
  fitOrShift(key, from);
  // Read again behind what is drawn, this time with what the proposals would fill in: opening never waits for the earlier lines.
  readNode(uuid, id).then(() => { state.html = null; draw(host()); }).catch(() => {});
}
function closeDig(key) {
  if (state.findDug.has(key)) state.findDug.set(key, false);
  for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k);
  if (state.focus === key || state.focus.startsWith(key + '>')) state.focus = state.dig.has(parentKey(key)) ? parentKey(key) : '';
  state.html = null; draw(host());
}
/* The shift (0.4.463, the owner's mockup https://claude.ai/artifact/J4RLe8Kmo6dbXp2nUmfUfG): the node one level below the
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
/* When the shift comes (0.4.464, the owner: "shift as soon as lines would break, rather than always at the fourth
   level"): a node just opened is measured as drawn; while one of its own lines breaks (a name on two lines, its tag
   dropped under it, a line wider than the section) and it is more than one level below the top, the outline shifts by
   one level. Then the section slides once from where the clicked line was. */
function breaks(key) {
  const kids = state.box?.querySelector(`.rf-ol-kids[data-key="${CSS.escape(key)}"]`);
  if (!kids) return false;
  for (const line of kids.querySelectorAll('.rf-ol-line')) {
    if (line.closest('.rf-ol-kids') !== kids) continue;
    const name = line.querySelector('.rf-ol-name, .rf-tw-record'), pname = line.querySelector(':scope > .rf-ol-pname');
    if (line.scrollWidth > line.clientWidth + 1) return true;
    // A property's name on two lines is a break too (the reviewer: "Therapy regimen" split under cisplatin).
    if (pname?.textContent.trim() && pname.getBoundingClientRect().height > 1.6 * (parseFloat(getComputedStyle(pname).lineHeight) || 21)) return true;
    if (!name) continue;
    if (name.getClientRects().length > 1) return true;
    const tag = name.parentElement?.querySelector(':scope > .rf-tag');
    if (tag && tag.getBoundingClientRect().top > name.getBoundingClientRect().top + 4) return true;
  }
  return false;
}
// When even one level under the top would break (a narrow section), shifting all the way gives nothing back (the
// reviewer: at 445 px every click shifted): the lines wrap, as Logseq's own outline does, and the outline shifts only
// as far as keeps two levels under the top, the parent still in view.
function fitOrShift(key, from) {
  const before = state.steps.slice();
  while (state.dig.has(key) && below(key) > 1 && breaks(key) && shiftOnce(key)) { state.html = null; draw(host()); }
  if (state.dig.has(key) && breaks(key)) {
    state.steps = before;
    while (state.dig.has(key) && below(key) > 2 && shiftOnce(key)) { /* to two levels under the top */ }
    state.html = null; draw(host());
  }
  if (state.steps.length !== before.length) glide(key, from);
}
const nameRect = key => state.box?.querySelector(`.rf-chev[data-dig="${CSS.escape(key)}"]`)?.closest('.rf-ol-line')?.getBoundingClientRect() || null;
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
  state.html = null; draw(host());
  for (let guard = 0; guard < 50; guard++) {
    const deepest = [...state.dig.keys()].filter(k => below(k) > 1).sort((a, b) => b.split('>').length - a.split('>').length)[0];
    if (!deepest || !breaks(deepest)) break;
    for (const k of [...state.dig.keys()]) if (k === deepest || k.startsWith(deepest + '>')) state.dig.delete(k);
    state.html = null; draw(host());
  }
  // The focus goes to the deepest node still open on the way down (the reviewer: with the outermost, one Esc closed all
  // three levels at once).
  const on = was?.key ? [...state.dig.keys()].filter(k => k === was.key || k.startsWith(was.key + '>')) : [];
  state.focus = on.sort((a, b) => b.split('>').length - a.split('>').length)[0] || '';
  const top = topStep();
  if (top && !state.node.has(top.uuid)) readNode(top.uuid, top.id).then(() => { state.html = null; draw(host()); }).catch(() => {});
  state.html = null; draw(host());
}
/* The days of the nodes that link to an opened node hang in the section's margin, ending on the edge every row's day
   ends on (0.4.462, the owner's pick 1 of the two-way fixes: "the left edge always means time", at every depth). Each
   sits absolute in its line, so it takes no room in the value; placed after every drawing, before it is painted. In a
   node stepped into, the margin is the one its body keeps. */
function placeDays(box) {
  const days = box.querySelectorAll('.rf-tw-mday');
  if (!days.length) return;
  const edges = new Map();
  for (const day of days) {
    const root = day.closest('.rf-tw-value, .rf-tw-stepbody'), line = day.closest('.rf-ol-line'), name = line?.querySelector('.rf-ol-pv');
    if (!root || !line || !name) continue;
    // The edge a row's own day ends on, where one is drawn; in a shifted section's top, the margin its body keeps.
    if (!edges.has(root)) {
      const seen = root.matches('.rf-tw-value') && box.querySelector('.rf-tw-value .rf-tw-line > .rf-ol-day'), r = root.getBoundingClientRect();
      edges.set(root, seen ? seen.getBoundingClientRect().right : r.left + parseFloat(getComputedStyle(root).paddingLeft || '0') - 12);
    }
    const at = line.getBoundingClientRect();
    const left = Math.round(edges.get(root) - day.offsetWidth - at.left);
    day.style.left = `${left}px`;
    line.style.setProperty('--rf-tw-day-reach', `${Math.max(0, -left) + 6}px`);   // the row's wash reaches its day in the margin
    day.style.top = `${name.offsetTop}px`;
    day.style.lineHeight = getComputedStyle(name).lineHeight;
  }
}
// The section stepped into a node: the trail (the page, each step, the one shown with its tag), then what it holds.
function steppedHtml() {
  const top = state.steps[state.steps.length - 1];
  if (!top.key) { state.steps = []; return null; } // kept from before 0.4.463: back on the page
  const tagOf = state.node.get(state.steps[state.steps.length - 2]?.uuid)?.tags;
  const tag = [...(tagOf?.entries() || [])].find(([id]) => id === top.id)?.[1] || tagOfNode(top.uuid);
  const steps = [{ text: state.pageTitle || 'this page', attrs: { 'data-step': '-1' } }, ...state.steps.slice(0, -1).map((s, i) => ({ text: s.title, attrs: { 'data-step': String(i) } }))];
  const data = state.node.get(top.uuid);
  if (!data) return `<div class="rf-tw-stepped rf-ol">${O.trail(steps, `${esc(top.title)}${tag ? tagLink({ tag }) : ''}`)}</div>`;
  // Its rows as the page's: what links to it, the way back left out.
  const path = [...state.steps.map(s => s.uuid), ...pathOf(top.key)];
  const groups = data.rows.map(g => ({ ...g, ident: '', items: g.items.filter(item => !onTheWay(path, item.uuid)) })).filter(g => g.items.length);
  const many = groups.reduce((n, g) => n + g.items.length, 0);
  drawingTop = true;
  let rows = '';
  try { rows = groups.map(g => rowHtml(g, top)).join(''); } finally { drawingTop = false; }
  const line = many ? `<div class="rf-tw-toplinks"><span class="lk-count">${many}</span> ${many === 1 ? 'node links' : 'nodes link'} here</div>` : '';
  return `<div class="rf-tw-stepped rf-ol">${O.trail(steps, `${esc(top.title)}${tag ? tagLink({ tag }) : ''}`)}<div class="rf-tw-stepbody">${nodeHtml(top.uuid, top.key, data, true)}</div></div>${line}${rows}`;
}
/* Find among what points here (0.4.436; the kit's field since 0.4.442, the count at its end; the owner, 2026-10-27: "there
   should be a way to search like properties … it does not appear everywhere and it seems very limited"): a field above
   the rows on every page that something points at. Typing keeps a whole row whose name holds what is typed, and in the
   others the nodes whose title or tag hold it, or one of their own properties, by its name or a value ("Findings",
   "adenocarcinoma"); a node found by a property says which under its line. The lists open in full. The nodes' values are
   read once, as the field is first used. Esc in the field empties it. */
const FIND_FROM = 20; // the find line stands only when there are enough rows to need it (the owner, 2026-10-31)
const allPointing = () => new Set(state.groups.flatMap(g => g.items.map(item => item.uuid))).size;
function findHtml() {
  const n = allPointing();
  if (n < FIND_FROM && !state.find) return '';
  const found = state.find ? foundGroups().reduce((sum, g) => sum + g.items.length, 0) : 0;
  return `<div class="rf-tw-findrow">${shared.fieldHtml({ icon: 'find', value: state.find, placeholder: 'Find in what points here', count: state.find ? `${found} of ${n}` : n, inputCls: 'rf-tw-find', label: 'Find in what points here' })}</div>`;
}
// What is typed matches at the start of a word ("4" finds a severity of 4, not "Oct 4"; "ct" no "Doctor").
const has = (text, q) => { const t = String(text ?? '').toLowerCase(); let at = t.indexOf(q); while (at > 0 && /[\p{L}\p{N}]/u.test(t[at - 1])) at = t.indexOf(q, at + 1); return at >= 0; };

// The first of a node's own properties whose name or a value holds what is typed; the row's own property (it names this
// page) is left out.
function propHit(item, q, row) {
  for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === row) continue;
    // The node's own day is in the margin already: found by its words only through the property's name.
    const texts = entry.values.filter(v => !(v.day && v.day === item.day)).map(v => v.day ? dayText(v.day) : String(v.text ?? '')).filter(Boolean);
    if (has(name, q) || texts.some(t => has(t, q)) || everyWord(q, [name, ...texts])) return { name };
  }
  return null;
}
function foundGroups() {
  const q = state.find.trim().toLowerCase();
  if (!q) return state.groups;
  return state.groups.map(g => {
    const whole = has(g.label, q) || has(g.name, q);
    const items = g.items.map(item => {
      // A property that holds the words opens the node even when its title holds them too ("chen" shows the Provider).
      const hit = propHit(item, q, g.name);
      return hit ? { ...item, hit } : whole || has(item.title, q) || has(item.tag, q) || has(dayCell(item), q) ? item : null;
    }).filter(Boolean);
    return { ...g, items, found: true, total: g.items.length, whole };
  }).filter(g => g.items.length);
}
/* A node found by one of its own properties opens as when dug (the owner, 2026-10-27: "it should show me the actual
   Provider properties as they are seen in the outline already developed"), its matching property's name in the text's
   weight; at most 20 open so, the rest found by their line alone. What the field opened closes again when the words no
   longer find it by a property or the field is emptied; one closed by its chevron stays closed while finding. */
const FIND_OPENS = 20;
// Several words ("severity 4"): each found at the start of a word somewhere in the line.
const everyWord = (q, texts) => { const words = q.split(/\s+/).filter(Boolean); return words.length > 1 && words.every(w => texts.some(t => has(t, w))); };
// Nodes found by a property open only from this many letters (a number at once), so the first letters narrow the list
// without opening and shutting whole blocks of it (the reviewer: 323 → 1183 → 209 px over "s", "se", "sep").
const OPEN_FROM = 3;
const opensNow = q => q.length >= OPEN_FROM || /^\d+$/.test(q);
function openHits(groups) {
  const want = new Map();
  const q = state.find.trim().toLowerCase();
  if (q && opensNow(q)) for (const g of groups) for (const item of g.items) if (item.hit && want.size < FIND_OPENS) want.set(`r:${g.name}>${item.uuid}`, item);
  // What the field opened closes when no longer found, "show the rest" too; one closed by its chevron is closed already.
  for (const k of [...state.findDug.keys()]) if (!want.has(k)) { closeQuietly(k); state.findDug.delete(k); }
  for (const [k, item] of want) {
    if (state.findDug.has(k) || state.dig.has(k)) continue;
    // Opened only once read, so it never shows open and empty while its lines arrive.
    // Each node is asked for once a page: one that cannot be read is never asked again on every drawing.
    if (!state.node.has(item.uuid)) { if (!state.findAsked.has(item.uuid)) { state.findAsked.add(item.uuid); readNode(item.uuid, 0).then(() => { if (state.find.trim() && state.node.has(item.uuid)) { state.html = null; draw(host()); } }).catch(error => warnOnce('could not read a node', error)); } continue; }
    state.findDug.set(k, true);
    state.dig.set(k, { uuid: item.uuid, id: 0, title: shortName(item.title) });
  }
  return groups;
}
const closeQuietly = key => { for (const k of [...state.dig.keys()]) if (k === key || k.startsWith(key + '>')) state.dig.delete(k); };
/* The words found, lightly highlighted wherever they show in the section (the owner, 2026-10-27: "a very light highlight
   of things as well"): the browser's own highlights, so the text is not touched and nothing moves; Logseq's own subtle
   blue (the owner's word over the standing "no colour of the plugin's own"). The same start-of-word rule as the finding; at most 2000 text pieces looked at. */
function highlightFind(box) {
  const win = box?.ownerDocument?.defaultView, reg = win?.CSS?.highlights;
  if (!reg || !win.Highlight) return;
  const q = state.find.trim().toLowerCase();
  if (!q || !opensNow(q) || !box.isConnected) { reg.delete('rf-find'); return; }
  const words = [...new Set([q, ...q.split(/\s+/)])].filter(Boolean);
  const doc = box.ownerDocument, ranges = [];
  const walk = doc.createTreeWalker(box, win.NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest('.rf-tw-findrow, .rf-tw-head, .rf-ol-more') ? win.NodeFilter.FILTER_REJECT : win.NodeFilter.FILTER_ACCEPT });
  for (let n = walk.nextNode(), seen = 0; n && seen < 2000; n = walk.nextNode(), seen++) {
    const t = n.data.toLowerCase();
    for (const w of words) for (let at = t.indexOf(w); at >= 0; at = t.indexOf(w, at + w.length)) {
      if (at > 0 && /[\p{L}\p{N}]/u.test(t[at - 1])) continue;
      const r = doc.createRange(); r.setStart(n, at); r.setEnd(n, at + w.length); ranges.push(r);
    }
  }
  reg.set('rf-find', new win.Highlight(...ranges));
}
/* While the section is on a page, the page's scroll bar keeps its room (frame by frame, 2026-10-27, the owner: "things
   shift left or right"): finding, opening or folding made the page short enough to lose its scroll bar, and the whole
   page moved 8 px sideways and back. Let go when the section goes; a new page is drawn anew anyway. */
function steadyWidth(doc, on) {
  const pane = doc?.querySelector('#main-content-container');
  if (!pane) return;
  if (on) { if (pane.style.scrollbarGutter !== 'stable') pane.style.scrollbarGutter = 'stable'; }
  else if (pane.style.scrollbarGutter) pane.style.scrollbarGutter = '';
}
// While finding, a node's property line whose name or a value holds the words.
const findsLine = (prop, values) => { const q = state.find.trim().toLowerCase(); return !!q && (everyWord(q, [prop.title, ...values.map(v => v.day ? dayText(v.day) : v.text)]) || has(prop.title, q) || values.some(v => has(v.day ? dayText(v.day) : v.text, q))); };
// The values of every node pointing here, read once a page, the first time the field is used.
function readForFind() {
  if (state.findRead === state.pageUuid) return;
  state.findRead = state.pageUuid;
  readValues(state.groups.flatMap(g => g.items.map(item => item.uuid))).then(() => { if (state.find.trim()) { state.html = null; draw(host()); } }).catch(error => { state.findRead = ''; warnOnce('could not read the values to find in', error); });
}
function keepFind(box, caret) {
  const field = box.querySelector('.rf-tw-find');
  if (!field) return;
  if (caret != null) { field.focus({ preventScroll: true }); field.setSelectionRange(caret, caret); }
  field.addEventListener('focus', readForFind);
  // While finding, the section keeps at least the height it had before the first letter, so a page scrolled down to it
  // keeps its place (the reviewer: the field dropped 43 to 190 px under the cursor when the rows got shorter than the
  // screen). Emptied, it lets go.
  field.addEventListener('input', () => { if (!state.find.trim()) state.findHold = box.getBoundingClientRect().height; state.find = field.value; readForFind(); draw(host()); });
  field.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (state.find) { state.find = ''; draw(host()); } else field.blur(); } });
  for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
}
/* The focus moved by a click inside another open node, in place: only the wash moves. */
function setFocus(key) {
  if (state.focus === key || !state.box) return;
  state.focus = key;
  shared.outline.focus(state.box, key);
}
/* Where you are (0.4.442): once the names on the way scroll off, they stay pinned at the top of the section, the deepest
   last, each a click back to its line. Drawn on scroll into a line that takes no room. */
function pinNow() {
  const box = state.box, pin = box?.querySelector('.rf-tw-pin');
  if (!pin) return;
  // The top of what can be read: under Logseq's top bar, which lies over the page.
  const scroller = box.closest('#main-content-container');
  const head = box.ownerDocument.querySelector('#head, .cp__header');
  const sTop = scroller?.getBoundingClientRect().top || 0, top = Math.max(sTop, head?.getBoundingClientRect().bottom || 0);
  const pinTop = Math.round(top - sTop) + 'px';
  if (box.style.getPropertyValue('--rf-tw-pin-top') !== pinTop) box.style.setProperty('--rf-tw-pin-top', pinTop);
  const passed = [...box.querySelectorAll('.rf-ol-unit[data-key]')].filter(unit => {
    const line = unit.firstElementChild, r = unit.getBoundingClientRect();
    const kids = unit.querySelector(':scope > .rf-ol-kids');
    return line && kids && line.getBoundingClientRect().bottom < top && kids.getBoundingClientRect().bottom > top + 40;
  });
  // Each name with its tag, as on its line.
  const tagOn = unit => unit.firstElementChild.querySelector('.rf-tag')?.textContent || '';
  const last = passed[passed.length - 1];
  // Shifted, the way back comes first: the page and every step, as the trail above shows them (0.4.463).
  const way = state.steps.length ? [{ text: state.pageTitle || 'this page', attrs: { 'data-step': '-1' } }, ...state.steps.map((s, i) => ({ text: s.title, attrs: { 'data-step': String(i) } }))] : [];
  const html = passed.length ? O.trail([...way, ...passed.slice(0, -1).map(unit => ({ text: titleOf(state.dig.get(unit.dataset.key)?.uuid || ''), attrs: { 'data-goto': unit.dataset.key } }))], esc(titleOf(state.dig.get(last.dataset.key)?.uuid || '')) + (tagOn(last) ? tagLink({ tag: tagOn(last) }) : '')) : '';
  if (pin.innerHTML !== html) pin.innerHTML = html;
  pin.toggleAttribute('data-on', !!html);
}
// The line to write a bullet in, drawn again with the rows; what was typed comes back with it.
function focusNodeField(key) {
  const field = state.box?.querySelector(`.rf-tw-node-field[data-key="${CSS.escape(key)}"]`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
function keepNodeField(box) {
  for (const field of box.querySelectorAll('.rf-tw-node-field')) {
    const uuid = field.dataset.uuid, key = field.dataset.key;
    if (state.nodeDraft?.key === key) field.value = state.nodeDraft.text;
    keepGhost(field);
    field.addEventListener('input', () => { state.nodeDraft = { uuid, key, text: field.value }; lookName(field, tagOfNode(uuid)).catch(() => {}); });
    field.addEventListener('focus', () => setFocus(key));
    field.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); clearGhost(); const typed = field.value; field.value = ''; writeBullet(uuid, key, typed).catch(error => warnOnce('could not add the bullet', error)); }
      else if (event.key === 'Escape') { event.preventDefault(); if (looking.hit && looking.key === lineKey(field)) clearGhost(); else field.blur(); }
      else if (event.key === 'ArrowRight') { if (takeGhost(field)) event.preventDefault(); }
      else if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) clearGhost();
    });
    field.addEventListener('blur', () => leaveGhost(field));
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
    const block = await model.addLineTo(uuid, text);
    if (!block?.uuid) throw new Error('the bullet was not made');
    await readAgain(uuid);
    focusNodeField(key);
    await offerMade(block.uuid, `Added a bullet to “${shortName(titleOf(uuid))}”`, async () => { await model.removeBlock(block.uuid); await readAgain(uuid); later(300); }, group?.name, inBox(`[data-bullet="${CSS.escape(block.uuid)}"] .rf-ol-words`));
  } catch (error) {
    warnOnce('could not add the bullet', error); notify('The bullet could not be added', 'warning');
    state.nodeDraft = { uuid, key, text };   // the words are not lost with it
    const field = state.box?.querySelector(`.rf-tw-node-field[data-key="${CSS.escape(key)}"]`);
    if (field && !field.value) field.value = text;
  }
  later(300);
}
/* Taking what the proposals pencilled into an opened node (0.4.438): a click on one, or "Take what is proposed" for all;
   the faded Undo arrow empties them again. */
async function takeGuesses(uuid, idents) {
  const data = state.node.get(uuid);
  if (!data) return;
  const taken = [];
  for (const ident of idents) {
    const g = data.guesses.get(ident), prop = data.props.find(r => r.prop.ident === ident)?.prop;
    if (!g || !prop) continue;
    try {
      if (g.kind === 'node') await setValues(uuid, prop, prop.many ? g.ids : g.ids.slice(0, 1));
      else if (g.kind === 'day') await setValues(uuid, prop, [g.journalId]);
      else if (g.kind === 'number') await model.setValue(uuid, ident, Number(g.shown));
      else continue;
      taken.push({ ident, title: g.title });
    } catch (error) { warnOnce('could not fill a proposed value', error); }
  }
  if (!taken.length) return;
  peek.cache.clear();
  await readAgain(uuid);
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  offerUndo(`Filled ${taken.map(t => `“${t.title}”`).join(', ')} on “${shortName(titleOf(uuid))}”`, async () => { for (const t of taken) await model.unsetValue(uuid, t.ident); peek.cache.clear(); await readAgain(uuid); later(300); }, group?.name, inBox(`.rf-ol-pname[data-edit="${CSS.escape(taken[taken.length - 1].ident)}"][data-uuid="${CSS.escape(uuid)}"] + .rf-ol-pv`));
  later(300);
}
/* A node's properties changed where they sit (0.4.410): a click on a property's name, or on what a plain one holds, asks
   for a new value in the kit's list, the likely ones first for a link (pickerOrder, when loaded), the choices for a
   choice, a day in words for a date, the words or the number as they are. A pick replaces one value, or for a property
   that holds several is added (one held already is taken off); Clear at the list's end, or empty and Enter where there
   is no list, clears it. The faded Undo arrow puts back what it held. A linked value's name opens what it names. */
async function editNodeProp(uuid, ident, at) {
  const row = state.node.get(uuid)?.props.find(r => r.prop.ident === ident);
  if (!row) return;
  const { prop } = row, name = shortName(titleOf(uuid)), held = row.values.map(v => v.text);
  // Of several words or numbers: the one pressed; the property's name adds another.
  const one = prop.many && at?.dataset?.value != null ? row.values[Number(at.dataset.value)] : null;
  const kind = prop.choices?.length && prop.type !== 'node' ? 'choice' : prop.type;
  const isLink = kind === 'node' || kind === 'page', isDay = kind === 'date' || kind === 'datetime';
  let options = [];
  if (kind === 'choice') options = prop.choices.map(c => c.title);
  else if (isLink) {
    const takes = await takerOf(prop), pages = (await provided.propPages()).filter(p => !p.isTag && takes(p));
    const first = provided.pickerOrder ? await provided.pickerOrder(uuid, prop.title).catch(() => []) : [];
    const byId = new Map(pages.map(p => [p.id, p]));
    options = [...first.map(id => byId.get(id)).filter(Boolean), ...pages.filter(p => !first.includes(p.id))].map(p => p.title);
  } else if (kind === 'checkbox') options = ['yes', 'no'];
  const typedKind = !isLink && kind !== 'choice' && !isDay && kind !== 'checkbox', addsOne = typedKind && prop.many && !one && row.values.length > 0;
  const words = !typedKind || addsOne ? '' : one ? one.words : row.values.map(v => v.words).join(', ');   // as written: a link stays a link
  // In place, as Logseq does (1.0.3, the owner: "it is not a natural popup"): a page, a choice or yes/no is picked in
  // Logseq's own picker hanging under the value; a number, words or a day are typed where the value sits.
  const valueEl = one ? at.parentElement : at?.matches?.('.rf-ol-pname') ? at.nextElementSibling : (at?.closest?.('.rf-ol-pv') || at);
  let typed;
  if (options.length) {
    const picked = await shared.pickValue({ at: valueEl || at, placeholder: `Set ${prop.title}`, options: options.map(label => ({ label, held: held.includes(label) })),
      clearLabel: held.length ? 'Clear' : '', free: isLink });
    typed = picked == null ? null : picked.clear ? '' : (picked.typed ?? picked.label);
  } else typed = await shared.editInPlace({ at: valueEl || at, value: words, type: kind === 'number' ? 'number' : 'text', placeholder: isDay ? 'today, friday, 4 aug …' : '', again: one ? () => inBox(`.rf-tw-npvalue[data-edit="${CSS.escape(ident)}"][data-uuid="${CSS.escape(uuid)}"][data-value="${at.dataset.value}"]`)()?.parentElement : valueBox(uuid, prop) });
  if (typed == null) return;
  const had = await heldNow(uuid, prop);
  let done = '';
  const others = one ? had.filter(v => String(v) !== one.stored) : had;
  if (!typed.trim()) {
    if (!had.length || addsOne) return;
    if (one && others.length) await setValues(uuid, prop, others); else await model.unsetValue(uuid, prop.ident);
    done = `Cleared “${prop.title}”`;
  } else {
    if (words && typed.trim() === words) return;
    let value;
    if (kind === 'choice') value = prop.choices.find(c => c.title.toLowerCase() === typed.trim().toLowerCase())?.id;
    else if (isLink) value = (await pageNamed(typed.trim(), prop))?.id;
    else if (isDay) value = await dayValue(typed, kind);
    else if (kind === 'checkbox') value = /^(y|yes|true|1|on)$/i.test(typed.trim()) ? true : /^(n|no|false|0|off)$/i.test(typed.trim()) ? false : undefined;
    else if (kind === 'number') value = typed.trim() && Number.isFinite(Number(typed)) ? Number(typed) : undefined;
    else value = await provided.storedWords(typed.trim());
    if (value == null) return notify(`“${typed.trim()}” is not a value “${prop.title}” takes, so nothing was changed`, 'warning');
    if (kind === 'choice' || isLink || isDay) await setValues(uuid, prop, prop.many ? (had.includes(value) ? had.filter(v => v !== value) : [...had, value]) : [value]);
    else if (prop.many) await setValues(uuid, prop, one ? had.map(v => String(v) === one.stored ? value : v) : [...had, value]);
    else await model.setValue(uuid, prop.ident, value);
    done = `Set “${prop.title}”`;
  }
  peek.cache.clear();
  await readAgain(uuid);
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  offerUndo(`${done} on “${name}”`, async () => { await setValues(uuid, prop, had); peek.cache.clear(); await readAgain(uuid); later(300); }, group?.name, valueBox(uuid, prop));
  later(300);
}
// A click inside the outline: a chevron opens or closes, a pencilled value is taken, "show all" shows all, a property's
// name or plain value is changed, a bullet opens itself, a link in a bullet its page. False: not one of these.
function onOutlineClick(event) {
  const t = event.target;
  const stop = () => { event.preventDefault(); event.stopPropagation(); hidePeek(); };
  const chev = t.closest('.rf-chev[data-dig]');
  if (chev) { stop(); toggleDig(chev.dataset.dig, chev.dataset.uuid, chev.dataset.id, chev.dataset.title || '').catch(error => warnOnce('could not open a node', error)); return true; }
  const take = t.closest('[data-take]');
  if (take) { stop(); takeGuesses(take.dataset.uuid, [take.dataset.take]).catch(error => warnOnce('could not fill a proposed value', error)); return true; }
  const takeAll = t.closest('[data-takeall]');
  if (takeAll) { stop(); const uuid = takeAll.dataset.takeall; takeGuesses(uuid, [...(state.node.get(uuid)?.guesses.keys() || [])]).catch(error => warnOnce('could not fill the proposed values', error)); return true; }
  // The rest of a node the find field opened: it stays open, whole, as if dug.
  const findall = t.closest('[data-findall]');
  if (findall) { stop(); state.findDug.set(findall.dataset.findall, false); state.html = null; draw(host()); return true; }
  const nall = t.closest('[data-nall]');
  if (nall) { stop(); const key = nall.dataset.nall; if (state.nall.has(key)) state.nall.delete(key); else state.nall.add(key); state.html = null; draw(host()); return true; }
  const ball = t.closest('[data-ball]');
  if (ball) { stop(); state.ball.add(ball.dataset.ball); readAgain(ball.dataset.ball).catch(error => warnOnce('could not read the bullets of a node', error)); return true; }
  const edit = t.closest('[data-edit]');
  if (edit) { stop(); editNodeProp(edit.dataset.uuid, edit.dataset.edit, edit).catch(error => { warnOnce('could not change a property of the node', error); notify('That could not be changed', 'warning'); }); return true; }
  const goto = t.closest('[data-goto]');
  if (goto) { stop(); state.box?.querySelector(`.rf-ol-unit[data-key="${CSS.escape(goto.dataset.goto)}"]`)?.scrollIntoView({ block: 'start', behavior: shared.screen?.reduced?.() ? 'auto' : 'smooth' }); return true; }
  const page = t.closest('[data-open-page]')?.dataset.openPage;
  if (page) { stop(); openPage(page, event.shiftKey); return true; }
  const step = t.closest('[data-open-uuid]')?.dataset.openUuid;
  if (step) { stop(); openEntity(step, event.shiftKey); return true; }
  const bullet = !t.closest('a, button, input') && t.closest('[data-bullet]');
  if (bullet) { stop(); openEntity(bullet.dataset.bullet, event.shiftKey); return true; }
  // A click inside another open node, not on anything that acts, moves the focus there.
  const inside = !t.closest('a, button, input') && t.closest('.rf-ol-kids[data-key]');
  if (inside) setFocus(inside.dataset.key);
  return false;
}

/* Group a row by anything (0.4.369, the owner kept it from the ideas page): a list of nodes (more than three) can be
   grouped by their tag, their month, or the value of any property they hold (a claim's Confidence, a task's Project),
   each group folding, biggest first, those with none last. Chosen from the word after the count ("group", then "by
   Confidence") or from the right-click menu on the row's name, and remembered per property. Only how the row is shown:
   nothing is written. The values are read through the model (nodeValues) when a property is chosen and again whenever
   the rows are read, so a row grouped on a page opens grouped. */
const GROUP_KEY = 'refinementTwoWayGroup', GROUP_LISTED = 12;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const groupOf = group => state.group.get(group.name) || '';
const groupName = by => by === 'tag' ? 'tag' : by === 'month' ? 'month' : by.slice(2);
function readGroup() { try { state.group = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(GROUP_KEY) || '{}'))); } catch { state.group = new Map(); } }
function setGroup(field, by) {
  if (by) state.group.set(field, by); else state.group.delete(field);
  try { host().defaultView.localStorage.setItem(GROUP_KEY, JSON.stringify(Object.fromEntries(state.group))); } catch { /* kept for this session */ }
}
function groupingOf(group, items) {
  const by = drawingTop ? '' : groupOf(group);
  if (!by) return null;
  const buckets = new Map();
  const put = (key, label, item, value, none) => { let b = buckets.get(key); if (!b) buckets.set(key, b = { key: String(key), label, items: [], value, none: !!none }); b.items.push(item); };
  if (by === 'tag') for (const item of items) { const none = !item.tag || item.tag === 'note'; put(none ? '' : item.tag, none ? 'No tag' : item.tag, item, null, none); }
  else if (by === 'month') for (const item of items) { if (!item.day) put('', 'No date', item, null, true); else { const m = Math.floor(item.day / 100); put(m, `${MONTH_NAMES[m % 100 - 1]} ${Math.floor(m / 100)}`, item, null); } }
  else if (by.startsWith('p:')) {
    const name = by.slice(2);
    // Not read yet: the plain list until it is.
    if (!items.some(item => state.values.has(item.uuid))) return null;
    for (const item of items) {
      const held = state.values.get(item.uuid)?.get(name);
      if (!held?.values.length) { put('', `No ${name}`, item, null, true); continue; }
      const seen = new Set();
      for (const v of held.values) {
        let label = v.day ? dayText(v.day) : v.text;
        if (!label || seen.has(label)) continue;
        seen.add(label);
        // A bare number says nothing as a group's name: "Severity 3".
        put(label, /^-?\d+(\.\d+)?$/.test(label) ? `${name} ${label}` : label, item, { ident: held.ident, ...v });
      }
    }
  } else return null;
  // Biggest first; a month newest first; numbers, a scale, in order; those with none last.
  const parts = [...buckets.values()], numbers = by.startsWith('p:') && parts.filter(p => !p.none).every(p => p.value && typeof p.value.number === 'number');
  parts.sort((a, b) => a.none - b.none || (by === 'month' ? Number(b.key) - Number(a.key) : numbers ? a.value.number - b.value.number : b.items.length - a.items.length) || a.label.localeCompare(b.label));
  return { by, parts };
}
const groupKey = (group, by, part) => `${state.pageUuid}|${group.name}|${by}|${part.key}`;
function groupHtml(group, part, by) {
  const gkey = groupKey(group, by, part);
  const open = !!state.find.trim() || isOpen(gkey), all = state.all.has(gkey);
  const adding = state.draft?.field === group.name && state.draft.gkey === gkey;
  // The + puts a node here with the row's field pointing at this page and the group's value set (not for a month, nor for "none").
  const addable = group.ident && by !== 'month' && (by === 'tag' || !part.none);
  const plus = addable ? `<button type="button" class="lk-plus rf-tw-gadd" data-gkey="${esc(gkey)}" data-field="${esc(group.name)}" title="Add a node here: “${esc(group.name)}” set to this page${by === 'tag' ? `, tagged ${esc(part.label)}` : `, ${esc(groupName(by))} set to ${esc(part.label)}`}">+</button>` : '';
  const shown = all ? part.items : part.items.slice(0, GROUP_LISTED);
  // The group's heading names the tag, or the list's does when it holds one kind (0.4.462).
  const bare = (by === 'tag' && !part.none) || new Set(group.items.map(item => item.tag)).size === 1;
  const tell = bare ? tellingProp(group, part.items, by.startsWith('p:') ? by.slice(2) : '') : '';
  const more = open && part.items.length > GROUP_LISTED ? shared.outline.more({ text: all ? 'show fewer' : 'show all', attrs: { 'data-more': gkey }, under: 'name' }) : '';
  // The arrow folds; the words do not. A tag is a tag: it opens its page.
  const label = by === 'tag' && !part.none ? `<a class="rf-tag lk-tag rf-tw-tag rf-tw-gname" data-tag-page="${esc(part.label)}" href="#">${esc(part.label)}</a>` : `<span class="rf-tw-gname">${esc(part.label)}</span>`;
  return `<div class="rf-tw-group"${open ? ' data-open=""' : ''}><div class="rf-tw-ghead">${shared.outline.chev({ open, label: part.label, attrs: { 'data-gkey': gkey } })}<span class="rf-tw-gwords">${label}<span class="rf-note rf-tw-gn lk-count">${part.items.length}</span></span>${plus}</div>${open && adding ? draftLineHtml(group, state.draft) : ''}${open ? `<div class="rf-tw-gitems">${shown.map(item => itemHtml(group, item, `r:${group.name}`, '', bare, tell)).join('')}${more}</div>` : more}</div>`;
}
// A few nodes have nothing to group: Group shows above INLINE nodes, as the right-click's Group by… (1.0.2).
const groupBtn = group => { if (drawingTop || group.items.length <= INLINE) return ''; const by = groupOf(group); return `<button type="button" class="rf-quiet rf-faint rf-tw-groupby"${by ? ' data-on=""' : ''} data-field="${esc(group.name)}" title="Group the list by a tag, a month or a property">${by ? `By ${esc(groupName(by))}` : 'Group'}${iconHtml('chevron-down')}</button>`; };
// The values of these nodes, read through the model (400 at a time) into the cache the groups are made from.
async function readValues(uuids) {
  // The kinds of the properties, for the one telling a list's nodes apart (tellingProp).
  if (!state.schema) state.schema = await provided.propSchema().catch(() => null);
  const need = [...new Set(uuids)].filter(uuid => UUID.test(uuid));
  for (let at = 0; at < need.length; at += 400) {
    const part = need.slice(at, at + 400), found = await provided.nodeValues(part);
    for (const uuid of part) state.values.set(uuid, found.get(uuid) || new Map());
  }
}
// Read ahead for every list (not the mentions): grouped by a property, or of one kind (by itself, or one tag's word
// picked), its lines say the property telling its nodes apart (0.4.462).
const groupedUuids = groups => groups.filter(g => g.items.length > INLINE && !isMentions(g)).flatMap(g => g.items.map(item => item.uuid));
/* The property that tells a list's nodes apart, said where the tag was once the heading names the tag (0.4.462, the
   owner's pick 3 of the two-way fixes; Severity under "13 Symptom Logs"): of the properties the nodes hold, not the one
   linking here, a number, a choice or a few words, never a node (its name is mostly in the node's own words already,
   the reviewer: "about Blood in stool Blood in stool") nor a day (the margin has it), held by at least half of them, with
   more than one value; the most held, then the fewest values (the easiest to compare). None: nothing is said. */
function tellingProp(group, items, not = '') {
  if (!items.some(item => state.values.has(item.uuid))) return '';
  const held = new Map();
  const NOT = new Set(['node', 'page', 'date', 'datetime', 'url']);
  for (const item of items) for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === group.name || name === not || !entry.values.length || entry.values.some(v => v.day || !v.text || v.text.length > 24)) continue;
    const prop = state.schema?.props.find(x => x.ident === entry.ident);
    if (!prop || NOT.has(prop.type)) continue;
    if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
    const h = held.get(name); h.nodes++;
    for (const v of entry.values) h.values.add(v.text);
  }
  const best = [...held].filter(([, h]) => h.nodes * 2 >= items.length && h.values.size > 1).sort((a, b) => b[1].nodes - a[1].nodes || a[1].values.size - b[1].values.size || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : '';
}
// With its property's name, so it says what it is ("Severity 3", "Status Planned"); left out where the node's own
// words already say the value.
const tellHtml = (item, name) => {
  const values = state.values.get(item.uuid)?.get(name)?.values || [];
  const text = values.map(v => v.text).join(', ');
  if (!text || String(item.title || '').toLowerCase().includes(text.toLowerCase())) return '';
  return `<span class="rf-tw-tell">${esc(name)} ${esc(text)}</span>`;
};
// What a row can be grouped by, as the kit's menu: nothing, the tag, the month, then each property its nodes hold.
async function groupMenu(group, anchor) {
  closeAdd(); hidePeek();
  await readValues(group.items.map(item => item.uuid)).catch(error => warnOnce('could not read the values to group by', error));
  const by = groupOf(group), held = new Map();
  for (const item of group.items) for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === group.name) continue;
    if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
    const h = held.get(name); h.nodes++;
    for (const v of entry.values) h.values.add(v.day ? `d${v.day}` : v.text);
  }
  const choose = to => { setGroup(group.name, to); if (state.draft?.gkey) { state.draft = null; closeAdd(); } state.html = null; draw(host()); };
  const items = [{ label: 'Nothing', chosen: !by, run: () => choose('') }];
  if (new Set(group.items.map(item => item.tag)).size > 1) items.push({ icon: 'tag', label: 'Tag', chosen: by === 'tag', run: () => choose('tag') });
  if (group.items.some(item => item.day)) items.push({ icon: 'date', label: 'Month', chosen: by === 'month', run: () => choose('month') });
  const props = [...held].filter(([, h]) => h.values.size > 1 || h.nodes < group.items.length).sort((a, b) => b[1].nodes - a[1].nodes || a[0].localeCompare(b[0]));
  if (props.length) items.push({ sep: true }, ...props.map(([name, h]) => ({ icon: 'property', label: name, right: `${h.values.size} ${h.values.size === 1 ? 'value' : 'values'}`, chosen: by === `p:${name}`, run: () => choose(`p:${name}`) })));
  else items.push({ note: 'These nodes hold no property to group by' });
  adding.pop = shared.popup({ at: anchor, head: `Group “${group.label}” by`, width: 250, items, onClose: () => { adding.pop = null; } });
}
// The + in a group: the line to type in opens under the group's name, with what the group has in common set when it is made.
function startGroupDraft(group, gkey) {
  const grouping = groupingOf(group, group.items);
  const part = grouping?.parts.find(p => groupKey(group, grouping.by, p) === gkey);
  if (!part) return;
  closeAdd(); state.draft = null;
  const d = draftFor(group);
  d.gkey = gkey; d.step = 'name';
  if (grouping.by === 'tag') d.kind = part.none ? '' : part.label;
  d.set = grouping.by.startsWith('p:') && !part.none ? part.value : null;
  setOpen(gkey, true);
  state.html = null; draw(host()); focusDraft();
}
// What a group has in common, put on the new node: a node, a choice or a day by its id, a number or words as they are.
async function setGroupValue(uuid, set) {
  const prop = (await provided.propSchema()).props.find(p => p.ident === set.ident);
  if (!prop) return;
  const value = heldById(prop) ? set.id : set.time ?? set.number ?? set.boolean ?? set.text;
  if (value == null) return;
  if (heldById(prop)) await setValues(uuid, prop, [value]); else await model.setValue(uuid, prop.ident, value);
}

// Open or folded, per page and field, kept in Logseq's window storage (0.4.184): open unless you folded it.
/* Date first or name first per property (0.4.304 to 0.4.461) is gone (0.4.462, the owner's pick 1 of the two-way fixes):
   the day is always in the margin. What it kept is let go once. */
function forgetOrder() { try { host().defaultView.localStorage.removeItem('refinementTwoWayOrder'); } catch { /* nothing kept */ } }
const OPEN_KEY = 'refinementTwoWayOpen';
const isOpen = key => state.open.get(key) ?? true; // while finding, a row opens itself once narrowed (rowHtml, 0.4.458)
function readOpen() { try { state.open = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(OPEN_KEY) || '{}'))); } catch { state.open = new Map(); } }
function setOpen(key, open) {
  state.open.delete(key);
  if (!open) state.open.set(key, false);
  while (state.open.size > 300) state.open.delete(state.open.keys().next().value);
  try { host().defaultView.localStorage.setItem(OPEN_KEY, JSON.stringify(Object.fromEntries(state.open))); } catch { /* kept for this session */ }
}

/* Peek (0.4.184): resting the pointer on a record for a moment shows a card beside it, with the record's tag and
   day, its fields (the one that points here left out) and its first lines, read when asked and kept until the
   graph changes. It goes when the pointer leaves the record and the card. The card is the kit's (0.4.318). */
const PEEK_MS = 450;
const peek = { timer: 0, hide: 0, card: null, uuid: '', anchor: null, cache: new Map() };
/* Every piece of the card opens what it names (0.4.262, the owner: "make the different links and elements of the hover
   clickable"): the title the node itself, its tag the tag's page, a property's name the property's page, a value the
   page it points to, a line the bullet it is, a link in a line its page; Shift-click opens it in the right sidebar.
   Words that name nothing (a text value) open the node, as the card always did. */
async function peekData(uuid, field) {
  const key = `${uuid}|${field}`;
  if (peek.cache.has(key)) return peek.cache.get(key);
  const fields = await provided.nodeFields(uuid);
  fields.delete(field);
  const readable = async text => { try { return String(await provided.readableTitle(String(text || ''))).trim(); } catch { return String(text || '').trim(); } };
  const rows = [];
  for (const [name, values] of [...fields].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8)) {
    const shown = await Promise.all(values.map(async v => ({ text: v.day ? dayText(v.day) : (await readable(v.title ?? v.text)).replace(/\[\[([^\]]+)\]\]/g, '$1'), uuid: v.uuid || '' })));
    const seen = new Set(), kept = shown.filter(v => v.text && !seen.has(v.text) && seen.add(v.text));
    if (kept.length) rows.push({ name, uuid: fields.props?.get(name) || '', values: kept });
  }
  let lines = [];
  try { lines = (await Promise.all((await provided.firstLines(uuid, 4, true)).map(async line => ({ uuid: line.uuid, text: await readable(line.title) })))).filter(line => line.text); } catch { /* no lines, then */ }
  const data = { rows, lines };
  peek.cache.set(key, data);
  return data;
}
// A line's words with its links open: [[Page]] as Page, [words]([[Page]]) as words, each opening the page.
function lineHtml(text, limit = 140) {
  const short = text.length > limit ? text.slice(0, limit - 1) + '…' : text;
  let html = '', at = 0;
  for (const m of short.matchAll(/\[([^\[\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/g)) {
    html += esc(short.slice(at, m.index)) + `<span class="rf-tw-peek-open" data-open-page="${esc(m[2] ?? m[3])}">${esc(m[1] ?? m[3])}</span>`;
    at = m.index + m[0].length;
  }
  return html + esc(short.slice(at));
}
function findItem(uuid, rowEl) {
  const group = state.groups.find(g => g.name === rowEl?.dataset.field);
  return group ? { group, item: group.items.find(item => item.uuid === uuid) } : {};
}
function onOver(event) {
  const link = event.target.closest?.('a.rf-tw-record');
  if (!link) return;
  clearTimeout(peek.hide);
  if (peek.anchor === link && peek.card && !peek.card.isClosed) return;
  clearTimeout(peek.timer);
  peek.timer = setTimeout(() => showPeek(link).catch(error => warnOnce('could not show the node card', error)), PEEK_MS);
}
function onOut(event) {
  if (!event.target.closest?.('a.rf-tw-record')) return;
  clearTimeout(peek.timer);
  hidePeekSoon();
}
// A page by its name: its uuid from the page list, else Logseq finds it by name (openPageNamed, parts/shared.js).
async function openPage(name, inSidebar) {
  const page = (await provided.propPages().catch(() => [])).find(p => p.lower === name.toLowerCase());
  if (page?.uuid) return openEntity(page.uuid, inSidebar);
  return openPageNamed(name, inSidebar);
}
const hidePeekSoon = () => { clearTimeout(peek.hide); peek.hide = setTimeout(hidePeek, 200); };
function hidePeek() { clearTimeout(peek.timer); clearTimeout(peek.hide); peek.card?.close(); peek.card = null; peek.anchor = null; }
/* The card sits clear of the rows: to the right of the words on the lines it stands beside, else above the row. */
function placePeek(card, link) {
  const box = card.getBoundingClientRect(), at = link.getBoundingClientRect(), pane = link.closest('.refinement-two-way').getBoundingClientRect();
  const top = Math.max(48, at.top - 10), bottom = top + box.height;
  const words = [...card.ownerDocument.querySelectorAll('.refinement-two-way .rf-ol-line')].filter(line => { const r = line.getBoundingClientRect(); return r.bottom > top && r.top < bottom; })
    .flatMap(line => [...line.querySelectorAll('.rf-ol-body > *')]).map(part => part.getBoundingClientRect().right);
  const left = Math.max(at.right, ...words) + 16, room = left + box.width <= pane.right;
  Object.assign(card.style, { margin: '0', left: `${room ? left : at.left}px`, top: `${room ? top : Math.max(48, at.top - box.height - 6)}px` });
}
async function showPeek(link) {
  const { group, item } = findItem(link.dataset.uuid, link.closest('.rf-tw-row'));
  if (!item) return;
  const data = await peekData(item.uuid, group.name);
  if (!link.isConnected || !link.matches(':hover')) return;
  const doc = link.ownerDocument;
  hidePeek();
  // Only what the row does not say (the review, 31 October): its tag and day stand on it, and its name unless the row cut it.
  const fields = data.rows.filter(row => !item.day || row.values.map(v => v.text).join(', ') !== dayText(item.day));
  const cut = link.scrollHeight > link.clientHeight + 1;
  if (!cut && !fields.length && !data.lines.length) return;
  const card = peek.card = shared.card({ doc, at: link, title: cut ? item.title : '',
    fields: fields.map(row => ({ name: row.name, uuid: row.uuid, values: row.values })),
    lines: data.lines.map(line => ({ uuid: line.uuid, html: lineHtml(line.text) })),
    open: (what, value, event) => {
      // The innermost piece that names something: a link in a line before the line it is in.
      const page = event?.target?.closest?.('[data-open-page]')?.dataset.openPage;
      hidePeek();
      if (page) return openPage(page, event.shiftKey);
      if (what === 'prop') return value?.uuid ? openEntity(value.uuid, event.shiftKey) : openEntity(item.uuid, event.shiftKey);
      if (what === 'value' || what === 'line') return openEntity(value?.uuid || item.uuid, event.shiftKey);
      return openEntity(item.uuid, event.shiftKey);
    } });
  card.el.classList.add('refinement-two-way-peek');
  placePeek(card.el, link);
  card.el.addEventListener('mouseenter', () => clearTimeout(peek.hide));
  card.el.addEventListener('mouseleave', hidePeekSoon);
  peek.anchor = link;
}

// The page's own property list in the main view (not one inside a record, a reference or the sidebar), else its title:
// the rows stand under the title and the properties, above the page's own words (the owner, 1 November 2026).
function anchorFor(doc) {
  const main = doc.querySelector('#main-content-container');
  if (!main) return null;
  const outside = el => !el.closest('.references, .ls-bidirectional-properties, .ls-block .ls-block, .custom-query');
  const props = [...main.querySelectorAll('.ls-page-properties')].find(outside);
  if (props) return props;
  const titles = [...(provided.pageTitles?.(doc) || [])].filter(el => main.contains(el) && !el.parentElement?.closest('.ls-page-title, .page-title, h1.title'));
  const title = titles.length === 1 ? titles[0] : null;
  return title ? (title.querySelector('.is-page-title-row') || provided.titleAnchor?.(doc, title) || title) : null;
}
/* A page opening in steps (0.4.182). Logseq draws a page's title and its blocks first and its property list in two
   or three steps over the next half second, so the page's own words were pushed down each time, and once more when
   the rows came. Seen in the owner's Logseq: Oxaliplatin's blocks at 223px, then 303, 495 and 820. Now the rows are
   known before the page opens (loadIndex), and for the first two seconds after a page change the box keeps, above
   the rows, the room that lay between the title and the rows when the page was last seen settled, less what is
   there so far: the rows and the blocks start where they end. The room is kept in Logseq's window storage, so this
   works from the second visit on, across restarts. */
/* The keys end in 2 since 0.4.333: the rooms remembered before were measured while proposals still brought hidden
   property rows up and down, and a room remembered too large is let go at settle as a slide up (measured on Marcus
   Bell: 168 px, two seconds after the page). The old ones are dropped. */
const SETTLE_MS = 2000, HEIGHTS_KEY = 'refinementTwoWayRoom4', OLD_KEYS = ['refinementTwoWayRoom', 'refinementTwoWayLeast', 'refinementTwoWayRoom2', 'refinementTwoWayRoom3'];
/* A first visit (0.4.333, measured with the tour): the rows came under the title some 50 ms before Logseq's own property
   list, which then pushed them down (Dr. Raj Patel: 109 px). Now, on a page with no room remembered, they wait unseen in
   their place until that list is there, at most WAIT_MS, and no room is held for them: the least room of any page seen,
   held since 0.4.283, could be more than this page takes, and was let go at settle as a slide up (Marcus Bell: 56 px). */
const WAIT_MS = 900, STILL_MS = 200;
const settle = { since: 0, page: '', leaving: '', saved: false, timer: 0, ease: 0, wait: 0, frame: 0, stood: false };
/* The wait ends once Logseq's property list is there and the rows' place has stood still a moment, or at once for a page that will
   have no list (the review, 31 October: on a first visit they came 600 ms late, the list having long been drawn). Stillness alone is
   not enough: the list can come 200 ms after a still page (seen on Fatigue). WAIT_MS stays the most it can be.
   The rows stand above the page's words, so a page not yet read this session waits for its reading as well, words and all:
   its mentions and the find line come with that reading, and pushed the words down (Dr. Mei Chen: 266 px at half a second). */
function endWaitWhenStill(box, page) {
  if (settle.frame) cancelAnimationFrame(settle.frame);
  let top = null, since = performance.now(), noList = false;
  Promise.resolve(model?.pageHasList?.(page)).then(has => { noList = has === false; }).catch(() => {});
  const look = () => {
    if (!box.hasAttribute('data-rf-waiting')) return;
    const now = box.getBoundingClientRect().top;
    if (now !== top) { top = now; since = performance.now(); }
    const main = box.ownerDocument.querySelector('#main-content-container');
    const listThere = noList || !!main?.querySelector('.ls-page-properties');
    if (!listThere || !state.mentionsOf.has(page) || (!noList && performance.now() - since < STILL_MS)) { settle.frame = requestAnimationFrame(look); return; }
    settle.stood = true; box.removeAttribute('data-rf-waiting');
  };
  settle.frame = requestAnimationFrame(look);
}
let heights = new Map();
const readHeights = () => { try { const storage = host().defaultView.localStorage; for (const key of OLD_KEYS) storage.removeItem(key); heights = new Map(Object.entries(JSON.parse(storage.getItem(HEIGHTS_KEY) || '{}'))); } catch { heights = new Map(); } };
function remember(page, height) {
  height = Math.round(height);
  if (heights.get(page) === height) return;
  heights.delete(page);
  heights.set(page, height);
  if (heights.size > 500) heights.delete(heights.keys().next().value);
  try { host().defaultView.localStorage.setItem(HEIGHTS_KEY, JSON.stringify(Object.fromEntries(heights))); } catch { /* storage full or off: kept for this session */ }
}
// 'hold' while the page on screen settles, 'save' once when it has, else nothing.
function settling(page) {
  if (!page || page === settle.leaving) return '';
  const age = performance.now() - settle.since;
  if (!settle.page && age < SETTLE_MS) { settle.page = page; settle.saved = false; }
  if (settle.page !== page) return '';
  return age < SETTLE_MS ? 'hold' : settle.saved ? '' : 'save';
}
function holdRoom(doc, box, mode, page) {
  // The title's own row: the box and the property list sit inside the title's block, below that row.
  const title = doc.querySelector('#main-content-container :is(.ls-page-title, .page-title) .is-page-title-row');
  if (!mode || !title) { setHold(box, 0); return; }
  const held = parseFloat(box.style.getPropertyValue('--rf-tw-hold')) || 0;
  const room = box.getBoundingClientRect().top - title.getBoundingClientRect().bottom - held;
  // Settled: the room still held, if any, eases away over a moment instead of snapping (0.4.283); then the room
  // is kept for next time, so the next visit holds the right amount from the start.
  if (mode === 'save') { settle.saved = true; if (room >= 0) remember(page, room); if (held) easeHold(box); else setHold(box, 0); return; }
  setHold(box, heights.has(page) ? Math.max(0, Math.round(heights.get(page) - room)) : 0);
}
const setHold = (box, px) => { if (px) box.style.setProperty('--rf-tw-hold', px + 'px'); else box.style.removeProperty('--rf-tw-hold'); };
function easeHold(box) {
  box.setAttribute('data-rf-settling', '');
  box.style.setProperty('--rf-tw-hold', '0px');
  clearTimeout(settle.ease);
  settle.ease = setTimeout(() => { box.removeAttribute('data-rf-settling'); if (box.style.getPropertyValue('--rf-tw-hold') === '0px') setHold(box, 0); }, 300);
}
/* What is open is kept per page (0.4.436, the second break: "leaving closes everything"): the nodes opened in the
   rows, the chain under them, the steps and the lists shown whole, put back when the page is shown again, for the
   session. */
const KEPT_PAGES = 50;
function keepOpen() {
  const page = state.openFor;
  if (!page) return;
  const empty = !state.dig.size && !state.steps.length;
  state.kept.delete(page);
  if (!empty) state.kept.set(page, { dig: new Map(state.dig), focus: state.focus, steps: state.steps.slice(), nall: new Set(state.nall), ball: new Set(state.ball) });
  while (state.kept.size > KEPT_PAGES) state.kept.delete(state.kept.keys().next().value);
}
// Put back what was open on a page, once, when its rows are first shown again (by the stored rows or by a fresh reading).
function putBackOpen(pageUuid) {
  if (!pageUuid || state.openFor === pageUuid) return;
  state.openFor = pageUuid;
  const kept = state.kept.get(pageUuid);
  state.dig = new Map(kept?.dig || []); state.focus = kept?.focus || ''; state.steps = kept?.steps.slice() || [];
  state.nall = new Set(kept?.nall || []); state.ball = new Set(kept?.ball || []);
  readOpen2();
}
// Every node open here (and the one stepped into), read again once each, then drawn.
function readOpen2() {
  const nodes = new Map([...state.dig.values(), ...state.steps.slice(-1)].map(n => [n.uuid, n]));
  if (!nodes.size) return;
  Promise.all([...nodes.values()].map(n => readNode(n.uuid, n.id).catch(error => warnOnce('could not read a node', error)))).then(() => draw(host()));
}
function onRoute() {
  for (const [k, mine] of state.findDug) if (mine) closeQuietly(k);
  state.findDug.clear(); state.findAsked.clear(); state.findKeep = 0; state.findHold = 0;
  if (state.box) state.box.style.minHeight = '';
  keepOpen();
  state.find = ''; state.findRead = '';
  hidePeek(); closeAdd(); state.draft = null; state.kindsAll.clear(); state.picked.clear(); state.lastPick = ''; state.dig.clear(); state.focus = ''; state.steps = []; state.openFor = ''; state.nodeDraft = null;
  // The page being left, which may still be on screen for a moment and must not take the new page's place.
  // Only a page still on screen is being left: the same page opened again after it went is a new visit, held as one.
  settle.leaving = shownPage(host());
  Object.assign(settle, { since: performance.now(), page: '', saved: false, stood: false });
  clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait); if (settle.frame) cancelAnimationFrame(settle.frame);
  // Left while the held room eased away: left on, the easing slid the rows on every page opened after.
  state.box?.removeAttribute('data-rf-settling');
  // Once settled: no more room held, and the room is kept for next time.
  settle.timer = setTimeout(() => draw(host()), SETTLE_MS + 50);
  settle.wait = setTimeout(() => draw(host()), WAIT_MS + 20);
}
const shownPages = doc => [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid'));
function draw(doc) {
  if (!doc) return;
  const on = setting('twoWayRows');
  // The rows belong to the page they were read for; a page drawn before its look-up finishes gets the rows it had
  // when last seen, or none if every page's rows were read and it had none, until the look-up has checked them.
  const shown = shownPages(doc);
  if (shown.length && !shown.includes(state.pageUuid)) {
    const id = shown.find(uuid => state.byPage.has(uuid)) || (shown.length === 1 && state.indexed ? shown[0] : '');
    if (id) { state.pageUuid = id; state.groups = state.byPage.get(id) || []; state.html = null; putBackOpen(id); }
  }
  const anchor = on ? anchorFor(doc) : null;
  // A view with no page title the rows know (the Journals list), reached after the rows were read, has none of them (0.4.185).
  const stale = !shown.length && settle.since > (state.readAt || 0);
  // The Journals list shows many days at once: no rows there (a day of its own gets them, 0.4.437). Days by their uuid: a
  // page's alias is a second block in the title area too, and on the way from a journal day it read as that list.
  const rows = state.groups.length > 0 && !stale && !(shown.length && !shown.includes(state.pageUuid)) && shown.filter(uuid => uuid.startsWith('00000001-')).length < 2;
  // A page with an alias has more than one block in its title area; the page is the one the rows were read for.
  const page = shown.includes(state.pageUuid) ? state.pageUuid : shown.length === 1 ? shown[0] : '';
  const mode = anchor ? settling(page) : '';
  if (!anchor || (!rows && !mode)) { state.box?.remove(); highlightFind(state.box); steadyWidth(doc, false); return; }
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = doc.createElement('div');
    box.className = 'refinement-two-way';
    box.setAttribute('contenteditable', 'false');
    box.addEventListener('mousedown', event => { event.stopPropagation(); if (state.find && event.target.closest?.('.rf-chev, [data-findall]')) event.preventDefault(); });
    box.addEventListener('click', onClick);
    box.addEventListener('mouseover', onOver);
    box.addEventListener('mouseout', onOut);
    box.addEventListener('contextmenu', onRename);
    // What unrolled lets go of its clipping once it has (the kit clips it while it grows), so a day in the margin shows.
    box.addEventListener('animationend', event => { if (event.target.classList?.contains('rf-ol-unroll')) event.target.classList.remove('rf-ol-unroll'); });
    // A node is read while the pointer comes to its chevron, so it opens at once.
    box.addEventListener('pointerover', event => { const c = event.target.closest?.('.rf-chev[data-dig]'); if (c && !state.node.has(c.dataset.uuid)) readNode(c.dataset.uuid, c.dataset.id, { look: true }).catch(() => {}); });
    state.html = '';
  }
  if (!rows) state.picked.clear();
  const stepped = rows && state.steps.length ? steppedHtml() : null;
  state.listed = [];   // filled as the rows are drawn, so the rows come before the bar that reads it
  const rowsHtml = rows && stepped == null ? openHits(foundGroups()).map(g => rowHtml(g)).join('') : '';
  const html = rows ? '<div class="rf-tw-pin" aria-hidden="true"></div>' + (stepped ?? (barHtml() + findHtml() + rowsHtml)) : '';
  // What unrolls does so once: the drawing kept is the one without it, so the next drawing does not replace it.
  const bare = html.replace(/ rf-ol-unroll/g, '');
  box.toggleAttribute('data-finding', !!state.find.trim());
  box.toggleAttribute('data-no-days', !state.groups.some(group => group.items.some(dayCell)));   // on a day's own page, usually: nothing fills the margin
  // Held before the rows are drawn again, so the page never sees the section shorter for an instant (it pulled the page's
  // scroll up 26 px at a first letter).
  if (state.find.trim()) { if (state.findHold) box.style.minHeight = `${Math.round(state.findHold)}px`; }
  else if (state.findHold) {
    // Emptied: let go only of the room below what is on screen, so the page stays where it was read (the reviewer: the
    // page dropped 97 px on Esc after scrolling down); the rest goes with the page.
    const pane = doc.querySelector('#main-content-container');
    const spare = pane ? pane.scrollHeight - pane.clientHeight - pane.scrollTop : Infinity;
    state.findKeep = Math.max(0, Math.round(state.findHold - spare)); state.findHold = 0;
    box.style.minHeight = state.findKeep ? `${state.findKeep}px` : '';
  } else if (!state.findKeep) box.style.minHeight = '';
  box.style.alignContent = box.style.minHeight ? 'start' : ''; // the held room stays below the rows, not spread between them
  if (state.html !== bare) {
    const active = box.contains(box.ownerDocument.activeElement) ? box.ownerDocument.activeElement : null;
    const typing = active?.matches('.rf-tw-draft-name'), typingNode = active?.matches('.rf-tw-node-field') ? active.dataset.key : '';
    const finding = active?.matches('.rf-tw-find') ? active.selectionStart : null;
    const redraw = () => { state.html = bare; box.innerHTML = html; keepDraft(box); keepNodeField(box); keepFind(box, finding); };
    const inPlace = box.querySelector('.rf-in-place');
    if (inPlace) inPlace.across(redraw); else redraw();
    if (typing) focusDraft();
    if (typingNode) focusNodeField(typingNode);
  }
  highlightFind(box);
  placeDays(box);
  steadyWidth(box.ownerDocument, true);
  // The room held grows with the tallest the section has been while finding, so a page scrolled down to read the found
  // nodes keeps its place when the next letter makes them fewer (the reviewer: 214 px).
  if (state.find.trim() && state.findHold) state.findHold = Math.max(state.findHold, box.getBoundingClientRect().height);
  box.toggleAttribute('data-picking', state.picked.size > 0);
  placeBar(box);
  box.toggleAttribute('data-rf-replaces', rows && !!state.replaces);
  // The section stands for the page, stepped into a node or not (0.4.442): Logseq's lists it repeats stay hidden.
  box.toggleAttribute('data-rf-rows', !!rows);
  pinNow();
  if (anchor.nextElementSibling !== box) anchor.after(box);
  holdRoom(doc, box, mode, page);
  const waited = box.hasAttribute('data-rf-waiting');
  box.toggleAttribute('data-rf-waiting', mode === 'hold' && !settle.stood && (!state.mentionsOf.has(page) || (!heights.has(page) && !anchor.matches('.ls-page-properties'))) && performance.now() - settle.since < WAIT_MS);
  if (!waited && box.hasAttribute('data-rf-waiting')) endWaitWhenStill(box, page);
  if (!rows && mode === 'save') box.remove();
}
// Before the screen is drawn (0.4.182), so the rows come in the same frame as the property list they sit under. Only
// when elements came or went, or while a page settles.
const drawEarly = (doc, records) => { if (performance.now() - settle.since < SETTLE_MS || addsElements(records)) draw(doc); };
function onClick(event) {
  const pickEl = event.target.closest?.('.rf-tw-bar [data-act]') || event.target.closest?.('.rf-tw-row .rf-tw-pick');
  if (pickEl) { event.preventDefault(); event.stopPropagation(); hidePeek(); return pickEl.dataset.act ? act(pickEl.dataset.act, pickEl) : togglePick(pickEl, event.shiftKey); }
  const could = event.target.closest?.('[data-could]');
  if (could) {
    event.preventDefault(); event.stopPropagation(); hidePeek();
    const group = state.groups.find(isMentions);
    // The menu opens where the words were: the drawing that ticks the mention replaces them.
    const r = could.getBoundingClientRect(), at = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (group) { state.picked.clear(); state.picked.add(`${could.dataset.could}|${group.name}`); draw(host()); raiseMenu(at).catch(error => warnOnce('could not open Make it…', error)); }
    return;
  }
  const back = event.target.closest?.('[data-step]');
  if (back) { event.preventDefault(); event.stopPropagation(); hidePeek(); return stepBack(Number(back.dataset.step)); }
  if (onOutlineClick(event)) return;
  const fold = event.target.closest?.('.rf-chev[data-fold]');
  if (fold) { event.preventDefault(); event.stopPropagation(); hidePeek(); const key = fold.dataset.fold; if (isOpen(key)) { const list = fold.closest('.rf-tw-row')?.querySelector('.rf-tw-list'); shared.outline.close(list, () => { setOpen(key, false); draw(host()); }); } else { setOpen(key, true); state.fresh = key; state.html = null; draw(host()); state.fresh = ''; } return; }
  const gfold = event.target.closest?.('.rf-chev[data-gkey]');
  if (gfold) { event.preventDefault(); event.stopPropagation(); setOpen(gfold.dataset.gkey, !isOpen(gfold.dataset.gkey)); draw(host()); return; }
  const moreKinds = event.target.closest?.('[data-kinds]');
  if (moreKinds) { event.preventDefault(); event.stopPropagation(); state.kindsAll.add(moreKinds.dataset.kinds); draw(host()); return; }
  const more = event.target.closest?.('[data-more]');
  if (more) { event.preventDefault(); event.stopPropagation(); const key = more.dataset.more; if (state.all.has(key)) state.all.delete(key); else state.all.add(key); draw(host()); return; }
  const groupBy = event.target.closest?.('.rf-tw-groupby');
  if (groupBy) {
    event.preventDefault(); event.stopPropagation();
    const group = state.groups.find(g => g.name === groupBy.dataset.field);
    if (group) groupMenu(group, groupBy).catch(error => warnOnce('could not open the group menu', error));
    return;
  }
  const groupAdd = event.target.closest?.('.rf-tw-gadd');
  if (groupAdd) { event.preventDefault(); event.stopPropagation(); hidePeek(); const group = state.groups.find(g => g.name === groupAdd.dataset.field); if (group) startGroupDraft(group, groupAdd.dataset.gkey); return; }
  // A click that just misses the box, anywhere in the room left of the record, ticks it too (0.4.297, the owner: "make
  // checkbox tap area bigger"): before, it opened the record and took you off the page.
  const rowEl = !event.target.closest?.('a, button') && event.target.closest?.('.rf-tw-line');
  const first = rowEl && rowEl.querySelector(':scope > :not(.rf-tw-pick)');
  const box = rowEl && rowEl.querySelector(':scope > .rf-tw-pick');
  if (box && first && event.clientX < first.getBoundingClientRect().left) { event.preventDefault(); event.stopPropagation(); hidePeek(); return togglePick(box, event.shiftKey); }
  const plus = event.target.closest?.('.rf-tw-add');
  if (plus) { event.preventDefault(); event.stopPropagation(); hidePeek(); const group = state.groups.find(g => g.name === plus.dataset.field); if (group) { closeAdd(); draftFor(group); draw(host()); focusDraft(); } return; }
  const dpick = event.target.closest?.('.rf-tw-dpick');
  if (dpick) { event.preventDefault(); event.stopPropagation(); return keepPiece(dpick.dataset.pkey); }
  const lineEl = event.target.closest?.('.rf-tw-draft');
  if (lineEl && !event.target.closest('a, input, button')) { lineEl.querySelector('.rf-tw-draft-field')?.focus(); return; }
  // The name opens, the arrow unfolds: the blank part of a row does nothing, and the page stays.
  const target = event.target.closest?.('a, button');
  if (!target) return;
  event.preventDefault(); event.stopPropagation();
  hidePeek();
  if (target.matches('.rf-tw-record, .rf-tw-field')) return openEntity(target.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-tag[data-tag-page]')) return openPage(target.dataset.tagPage, event.shiftKey);
  if (target.matches('[data-draft="tag"]')) return tagList(target);
  const key = target.dataset.key;
  // The head folds its list as the fold arrow does: rolled up before it goes, unrolled as it comes.
  const turn = () => { if (isOpen(key)) shared.outline.close(target.closest('.rf-tw-row')?.querySelector('.rf-tw-list'), () => { setOpen(key, false); draw(host()); }); else { setOpen(key, true); state.fresh = key; state.html = null; draw(host()); state.fresh = ''; } };
  if (target.matches('.rf-tw-toggle')) return turn();
  else if (target.matches('.rf-tw-chip')) {
    // All folds and unfolds the list (0.4.401, the owner: "clicking All # should fold/unfold"); with one tag picked
    // it first shows every node again. A tag's word opens the list with only its nodes, a second click shows all.
    const tag = target.dataset.tag || '';
    if (!tag) { if (state.only.has(key)) { state.only.delete(key); setOpen(key, true); } else return turn(); }
    else { if (state.only.get(key) === tag) state.only.delete(key); else state.only.set(key, tag); if (!isOpen(key)) setOpen(key, true); }
  }
  draw(host());
}

// Where an Undo sits (shared.undo, 0.4.258): at the end of a row's name on the page in the main view; the first row's
// when the change was to several rows at once; at the bottom right when no row is left to sit beside.
const rowNames = field => [...host().querySelectorAll('#main-content-container .refinement-two-way .rf-tw-row')]
  .filter(row => field == null || row.dataset.field === field).map(row => row.querySelector('.rf-tw-name')).filter(Boolean);
let undoCount = 0;
// near: where the change sits in an opened node (0.4.442), found again by its key after each drawing; the row's name
// when it is not on screen.
const offerUndo = (text, run, field, near) => { made.key = ''; shared.undo.offer({ key: `two-way:${++undoCount}`, at: () => near?.() || (field == null ? rowNames().slice(0, 1) : rowNames(field)), text, run }); };
// The arrow on something just made takes the thing away, so it lasts only while the thing is as it was made: written in,
// renamed or given a bullet, it goes (asked after a change, and again when pressed). What was written is never taken with it.
const made = { key: '', uuid: '', was: '', timer: 0 };
async function offerMade(uuid, text, run, field, near) {
  const was = await model.madeState(uuid);
  offerUndo(text, async () => { if (await model.madeState(uuid) !== was) return notify('It has changed since it was made, so it stays', 'warning'); await run(); }, field, near);
  Object.assign(made, { key: `two-way:${undoCount}`, uuid, was });
}
function checkMade() {
  if (made.key && !shared.undo.has(made.key)) made.key = '';   // used, replaced or left behind with the page
  if (!made.key) return;
  clearTimeout(made.timer);
  made.timer = setTimeout(async () => {
    const key = made.key;
    if (key && await model.madeState(made.uuid).catch(() => made.was) !== made.was && key === made.key) { shared.undo.forget(key); made.key = ''; }
  }, 300);
}
const inBox = selector => () => state.box?.isConnected ? state.box.querySelector(selector) : null;
const valueBox = (uuid, prop) => inBox(`.rf-ol-pname[data-edit="${CSS.escape(prop.ident)}"][data-uuid="${CSS.escape(uuid)}"] + .rf-ol-pv`);

/* Right-click a row's name to change how it reads here (0.4.237, the owner: "I should be able to right click
   “report of of” and edit display name"). Saved in "Fields read backwards", as the tag map's box does; empty goes
   back to how the name reads by itself. Undo is the arrow after the row's name. */
/* The right-click on a row's name opens a short menu under it, the kit's pop-up (0.4.304): Group by…, Open in the map,
   Reads back as …, Hide …. */
function onRename(event) {
  const nameEl = event.target.closest?.('.rf-tw-name');
  const group = nameEl && state.groups.find(g => g.name === nameEl.closest('.rf-tw-row')?.dataset.field);
  if (!group) return;
  event.preventDefault(); event.stopPropagation(); hidePeek(); closeAdd();
  // As wide as its longest words (the review, 31 October: a set width cut the widest action short).
  adding.pop = shared.popup({ at: nameEl.querySelector('.rf-tw-field') || nameEl, head: group.label, onClose: () => { adding.pop = null; }, items: [
    ...(group.items.length > INLINE ? [{ icon: 'order', label: 'Group by…', run: () => { groupMenu(group, nameEl.querySelector('.rf-tw-field') || nameEl).catch(error => warnOnce('could not open the group menu', error)); } }] : []),
    { sep: true },
    isMentions(group)
      ? { icon: 'remove', label: 'Hide mentions on this page', run: () => { hideMentionsHere().catch(error => warnOnce('could not hide the mentions row', error)); } }
      : provided.tagTree?.showProp ? { icon: 'map', label: 'Open in the map', run: () => provided.tagTree.showProp(group.name) } : null,
    ...(isMentions(group) ? [] : [{ icon: 'rename', label: 'Reads back as …', run: () => { renameRow(group, nameEl).catch(error => warnOnce('could not rename the row', error)); } }]),
    // The same two words as the tag map's (0.4.444, one word for each idea); the head above already names the row.
    ...(isMentions(group) ? [] : [{ icon: 'hide', label: 'Hide on the pages it points to', run: () => {
      setShownAtOtherEnd(group.name, false);
      offerUndo(`“${group.label}” is hidden on every page it points to; the links stay`, () => { setShownAtOtherEnd(group.name, true); later(0); });
      later(0);
    } }]),
  ].filter(Boolean) });
}
// The mentions row left out on this page (0.4.423): its name added to "Pages without the mentions row"; Undo takes it out.
async function hideMentionsHere() {
  const uuid = state.pageUuid, stored = await provided.titleNow(uuid).catch(() => '');
  const title = String(await provided.readableTitle(stored).catch(() => stored) || '').trim();
  if (!title) return;
  const before = String(setting('twoWayMentionsHidden') || '');
  const names = before.split(/[;\n]/).map(name => name.trim()).filter(name => name && name.toLowerCase() !== title.toLowerCase());
  saveSettings({ twoWayMentionsHidden: [...names, title].join('; ') });
  offerUndo(`The mentions row is hidden on “${title}”`, () => { saveSettings({ twoWayMentionsHidden: before }); later(0); });
}
async function renameRow(group, nameEl) {
  const before = backwardsLabel(group.name);
  // Typed on the row's own name, as a page is renamed in Logseq (1.0.4); empty goes back to the property's own name.
  const typed = await shared.editInPlace({ at: nameEl, value: before, placeholder: group.name });
  if (typed == null || typed.trim() === before) return;
  setBackwards(group.name, typed.trim());
  offerUndo(typed.trim() && typed.trim() !== group.name ? `${group.name} reads “${typed.trim()}” on every page it points to` : `${group.name} reads as its own name again on every page it points to`, () => setBackwards(group.name, before), group.name);
}

/* Adding from the far end (0.4.185, the owner's pick of "Add only"): the + at the end of a row opens a small box,
   "New record · doctor: Dr. Mei Chen", with the kinds the row already holds (the most common chosen) and a name.
   Enter (or Add) makes the record with that name and tag and the field pointing at this page: a page of its own when
   most records in the row are pages (people, places), else a block on today's journal (visits, tests). Add and open
   also opens it in the sidebar to fill in. The bar at the bottom offers Undo, which removes what was made.
   Nothing is unlinked from here: a link is changed on the record that holds it. */
/* Adding a node from the page (0.4.303, the owner: "a line under each section that once upon hover a plus appears you
   can start typing. you hit enter, another logseq input appears about where if it is a node. otherwise it is just a
   page"). Under each row a quiet line; with the pointer on the row a + shows at its left and the words "Add a …".
   Typing there is the new node's name. Enter: where most of the linked nodes are pages, the page is made at once;
   otherwise a second field takes its place on the line, asking where it goes, with today's journal, this page and the
   pages matching what is typed as rows under it (the kit's pop-up); Enter takes the lit one. The tag it gets sits
   at the line's right in the tags' column, a click lists the others. Escape steps back, then drops it. The faded
   arrow by the row's name takes a made node away. */
const adding = { pop: null };
function closeAdd() { adding.pop?.close(); adding.pop = null; }
const pageTitleNow = () => named.uuid === state.pageUuid && named.title ? named.title : 'this page';
function kindsOf(group) {
  const counts = new Map();
  for (const item of group.items) if (item.tag !== 'note') counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}
function draftFor(group) {
  if (state.draft?.field === group.name) return state.draft;
  const kinds = kindsOf(group);
  state.draft = { field: group.name, kinds, kind: kinds[0] || '', step: 'name', name: '', where: '', asPage: null, lit: 0, gkey: '', set: null, proposals: [], kept: null, quiet: false };
  readTitle().catch(() => {});
  provided.pagesAmong(group.items.map(item => item.uuid), uuidsIn).then(pages => { if (state.draft?.field === group.name) state.draft.asPage = pages * 2 > group.items.length; }).catch(() => {});
  return state.draft;
}
function addLineHtml(group) {
  if (!group.ident) return '';
  const d = state.draft?.field === group.name ? state.draft : null;
  // The + in the gap under the row (0.4.303, the owner: "you can just have a plus in the gap that then open input"):
  // shown with the pointer on the row, it takes no room; the line comes only once it is clicked. A line begun from a
  // group's + is drawn in that group (0.4.369).
  if (!d || d.gkey) return '';
  return draftLineHtml(group, d);
}
function draftLineHtml(group, d) {
  const kind = d ? d.kind : kindsOf(group)[0] || '';
  const tag = `<a class="rf-tag lk-tag rf-tw-tag rf-tw-draft-tag" href="#" data-draft="tag" title="The tag it gets (click for the others)">${kind ? esc(kind) : 'no tag'}</a>`;
  const field = d?.step === 'where'
    ? `<span class="rf-tw-draft-typed">${esc(d.name)}</span><span class="rf-field rf-field-inline"><input type="text" class="rf-tw-draft-field rf-tw-draft-where" placeholder="Where? Enter: today’s journal" spellcheck="false" aria-label="Where the new node goes"></span>`
    : `<span class="rf-field rf-field-inline"><input type="text" class="rf-tw-draft-field rf-tw-draft-name" placeholder="Add a${/^[aeiou]/i.test(kind) ? 'n' : ''} ${esc(kind || 'node')}" spellcheck="false" aria-label="Name of a new node"></span>`;
  return `<div class="rf-tw-draft rf-tw-drafting" data-field="${esc(group.name)}"><span class="rf-tw-draft-plus rf-faint" aria-hidden="true">+</span><span class="rf-tw-draft-main">${field}</span>${tag}<div class="rf-tw-draft-props">${propsHtml(group, d)}</div></div>`;
}
/* The rest of the new node, under the line (0.4.406, the owner's pick from docs/history/TWO-WAY-ADD-PROPOSALS-2026-10-25.html):
   what the node will get, as the proposals read in a bullet, italic grey with a dotted line under a guess: the row's
   property pointing at this page and a group's value (set, never a proposal), then what the proposals' rules say for
   the words typed (a linked or named page, the nodes it looks like, the day), read through the core when the rules are
   loaded and nothing without them. Enter takes everything shown; a click on a guess keeps that one and lets the other
   guesses go (a second click lets go of it again); Escape clears them until something is typed again. The row keeps
   its height while the line is open, so proposals coming and going move nothing under them (as under a bullet, 0.4.322). */
const pieceKey = piece => `${piece.ident}|${(piece.ids || []).join(',')}`;
function propsHtml(group, d) {
  if (!d) return '';
  const item = (title, shown) => `<span class="rf-tw-dprop"><span class="rf-tw-dname">${esc(title)}</span><span class="rf-pencil rf-pencil-taken">${esc(shown)}</span></span>`;
  const parts = [item(group.name, pageTitleNow())];
  if (d.set?.ident && d.set.text != null) parts.push(item(groupName(groupOf(group)), String(d.set.text)));
  if (!d.quiet) {
    const anyKept = d.kept && d.proposals.some(p => p.guess && d.kept.has(pieceKey(p)));
    for (const p of d.proposals) {
      const key = pieceKey(p), kept = !!d.kept?.has(key), passed = p.guess && anyKept && !kept;
      const tip = p.guess ? (kept ? 'Kept: Enter sets it. Click to let it go again' : 'A guess. Enter sets it; click to keep this one and let the other guesses go') : 'From the words: Enter sets it';
      parts.push(`<button type="button" class="rf-tw-dprop rf-tw-dpick" data-pkey="${esc(key)}" aria-pressed="${kept}" title="${esc(tip)}"><span class="rf-tw-dname">${esc(p.title)}</span><span class="rf-pencil${kept ? ' rf-pencil-taken' : ' lk-pencil'}${passed ? ' rf-tw-dpassed' : ''}">${esc(p.shown)}</span></button>`);
    }
  }
  return parts.join('');
}
function drawDraftProps() {
  const d = state.draft, group = d && state.groups.find(g => g.name === d.field);
  const box = group && state.box?.querySelector(`.rf-tw-draft[data-field="${CSS.escape(d.field)}"] .rf-tw-draft-props`);
  if (box) box.innerHTML = propsHtml(group, d);
}
// What Enter sets beyond the row's property: everything shown, or with a guess kept, the sure ones and the kept guesses.
function takenPieces(d) {
  if (!d || d.quiet) return [];
  const anyKept = d.kept && d.proposals.some(p => p.guess && d.kept.has(pieceKey(p)));
  return d.proposals.filter(p => !p.guess || !anyKept || d.kept.has(pieceKey(p)));
}
function keepPiece(key) {
  const d = state.draft, piece = d?.proposals.find(p => pieceKey(p) === key);
  if (!d) return;
  if (piece?.guess) { d.kept ||= new Set(); if (d.kept.has(key)) d.kept.delete(key); else d.kept.add(key); drawDraftProps(); }
  focusDraft();
}
// The proposals are asked for a moment after the typing pauses, the newest answer only, for the line still open.
const proposing = { timer: 0, version: 0 };
function proposeSoon(group) {
  if (!provided.draftProposals) return;
  clearTimeout(proposing.timer);
  proposing.timer = setTimeout(() => proposeNow(group).catch(error => warnOnce('the new node’s proposals could not be worked out', error)), 250);
}
async function proposeNow(group) {
  const d = state.draft;
  if (!d || d.field !== group.name) return;
  const version = ++proposing.version, text = d.name;
  if (!text.trim()) { d.proposals = []; drawDraftProps(); return; }
  const page = await model.getPage(state.pageUuid).catch(() => null);
  const set = [];
  if (page?.id && group.ident) set.push({ ident: group.ident, ids: [page.id] });
  if (d.set?.ident && (d.set.id != null || d.set.number != null)) set.push({ ident: d.set.ident, ids: [d.set.id ?? d.set.number] });
  const pieces = await provided.draftProposals({ text, tag: d.kind || '', set, journalDay: d.asPage ? 0 : todayNumber() });
  if (version !== proposing.version || state.draft !== d || d.name !== text) return;
  d.proposals = Array.isArray(pieces) ? pieces : [];
  drawDraftProps();
}
/* A page's name typed in a line of the rows (0.4.406 in the + line; 0.4.409 also in the line that writes a bullet into
   a node, idea 2 of the brainstorm of 2026-10-25): the rest of the name in grey after the cursor, laid over the box,
   through the suggested links' own reading when that part is loaded (the pages that would fill one of the tag's
   properties first: the new node's tag, or the opened node's); the Right arrow writes [[the page]] in the line.
   looking.key says which line the grey name is for ('draft', or 'node:' and the node's uuid), so it comes back on the
   same line when the rows are drawn again. */
const looking = { version: 0, boost: new Map(), hit: null, key: '' };
const lineKey = field => field.matches('.rf-tw-draft-name') ? 'draft' : field.matches('.rf-tw-node-field') ? `node:${field.dataset.uuid}` : '';
async function lookName(field, kind) {
  const inner = provided.linkSuggestInner, key = lineKey(field);
  if (!inner?.suggestFor || !key) return clearGhost();
  const text = field.value, caret = field.selectionStart;
  if (caret !== field.selectionEnd || caret !== text.length) return clearGhost();
  const version = ++looking.version;
  pagesRead ||= await provided.propPages().catch(() => []);
  let boost = null;
  if (inner.boostFor && kind) {
    if (!looking.boost.has(kind)) {
      const tag = pagesRead.find(p => p.isTag && p.lower === kind.toLowerCase());
      looking.boost.set(kind, tag ? inner.boostFor([tag.id], await provided.propSchema(), pagesRead) : null);
    }
    boost = looking.boost.get(kind);
  }
  if (version !== looking.version || !field.isConnected || field.value !== text) return;
  const hit = inner.suggestFor(text, caret, pagesRead, { min: 3, boost });
  if (!hit || hit.after || !hit.ghost) return clearGhost();
  looking.hit = hit; looking.key = key;
  drawGhost(field, hit);
}
function drawGhost(field, hit) {
  const wrap = field.closest('.rf-field');
  if (!wrap) return;
  let over = wrap.querySelector('.rf-tw-ghost-over');
  if (!over) { wrap.insertAdjacentHTML('beforeend', '<span class="rf-tw-ghost-over" aria-hidden="true"><span class="rf-tw-ghost-typed"></span><span class="rf-tw-ghost-rest"></span></span>'); over = wrap.lastElementChild; }
  const style = field.ownerDocument.defaultView.getComputedStyle(field);
  Object.assign(over.style, { left: field.offsetLeft + 'px', top: field.offsetTop + 'px', width: field.offsetWidth + 'px', height: field.offsetHeight + 'px', paddingLeft: style.paddingLeft, paddingTop: style.paddingTop, font: style.font, letterSpacing: style.letterSpacing, transform: `translateX(-${field.scrollLeft || 0}px)` });
  over.firstElementChild.textContent = field.value.slice(0, hit.end);
  over.lastElementChild.textContent = hit.ghost;
  if (hit.name) over.lastElementChild.setAttribute('data-name', hit.name); else over.lastElementChild.removeAttribute('data-name');
}
// After the rows are drawn again: the grey name back on its own line, if it is still the one typed in.
function keepGhost(field) {
  const hit = looking.hit;
  if (!hit || looking.key !== lineKey(field)) return;
  setTimeout(() => { if (looking.hit === hit && field.isConnected && field.value.length === hit.end) drawGhost(field, hit); }, 0);
}
function clearGhost() {
  looking.hit = null; looking.key = '';
  looking.version++;
  for (const over of state.box?.querySelectorAll('.rf-tw-ghost-over') || []) over.remove();
}
// The Right arrow: the words become [[the page]], the caret after it. False when there is nothing to take here.
function takeGhost(field) {
  const hit = looking.hit, value = field.value;
  if (!hit || looking.key !== lineKey(field) || field.selectionStart !== value.length) return false;
  const next = value.slice(0, hit.start) + `[[${hit.title}]]` + value.slice(hit.end);
  field.value = next;
  field.setSelectionRange(next.length, next.length);
  clearGhost();
  if (field.matches('.rf-tw-node-field')) state.nodeDraft = { uuid: field.dataset.uuid, text: next };
  else if (state.draft) {
    state.draft.name = next;
    const group = state.groups.find(g => g.name === state.draft.field);
    if (group) proposeSoon(group);
  }
  return true;
}
// Leaving the line takes the grey name away (a line drawn again in its place is not a leaving: the old one is gone).
const leaveGhost = field => setTimeout(() => { if (field.isConnected && looking.key === lineKey(field) && field.ownerDocument.activeElement !== field) clearGhost(); }, 0);
// The tag of a node listed in the rows, by its uuid ('' for none).
const tagOfNode = uuid => { for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return item.tag && item.tag !== 'note' ? item.tag : ''; return ''; };
async function journalPageFor(day) {
  return provided.journalIdFor(day, await provided.journalTitleFor(Math.floor(day / 10000), Math.floor(day / 100) % 100, day % 100));
}
// The line is drawn again with the rows; what was typed and the caret come back with it.
function keepDraft(box) {
  for (const field of box.querySelectorAll('.rf-tw-draft-field')) {
    const line = field.closest('.rf-tw-draft'), group = state.groups.find(g => g.name === line.dataset.field);
    const d = state.draft?.field === line.dataset.field ? state.draft : null;
    if (d) field.value = field.matches('.rf-tw-draft-where') ? d.where : d.name;
    // The grey name comes back with the line (0.4.406): the rows are drawn again now and then while the line is open.
    if (d && field.matches('.rf-tw-draft-name')) keepGhost(field);
    field.addEventListener('focus', () => { if (group && state.draft?.field !== group.name) { closeAdd(); draftFor(group); draw(host()); focusDraft(); } else if (field.matches('.rf-tw-draft-where')) whereList(field); });
    field.addEventListener('input', () => {
      const now = state.draft?.field === line.dataset.field ? state.draft : group && draftFor(group);
      if (!now) return;
      if (field.matches('.rf-tw-draft-where')) { now.where = field.value; now.lit = 0; now.moved = true; whereList(field); }
      else { now.name = field.value; now.quiet = false; if (group) proposeSoon(group); lookName(field, now.kind).catch(() => {}); }
    });
    field.addEventListener('keydown', onDraftKey);
    field.addEventListener('blur', () => leaveGhost(field));
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
function focusDraft() {
  const d = state.draft;
  const field = d && state.box?.querySelector(`.rf-tw-draft[data-field="${CSS.escape(d.field)}"] .rf-tw-draft-field`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
function dropDraft() { state.draft = null; closeAdd(); draw(host()); }
function onDraftKey(event) {
  event.stopPropagation();
  if (event.isComposing) return;
  const d = state.draft, onWhere = event.target.matches('.rf-tw-draft-where');
  if (event.key === 'Escape') {
    event.preventDefault();
    if (onWhere) { d.step = 'name'; d.where = ''; closeAdd(); draw(host()); focusDraft(); }
    else if (looking.hit && looking.key === 'draft') clearGhost();
    else if (d?.proposals.length && !d.quiet) { d.quiet = true; drawDraftProps(); }
    else { dropDraft(); event.target.blur?.(); }
  } else if (!onWhere && event.key === 'ArrowRight') {
    if (takeGhost(event.target)) event.preventDefault();
  } else if (!onWhere && ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    clearGhost();
  } else if (onWhere && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const rows = adding.pop?.body.querySelectorAll('.rf-item').length || 0;
    if (rows) { d.moved = true; d.lit = (d.lit + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows; adding.pop.lit(d.lit); }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (!d?.name.trim()) return;
    if (onWhere) { const lit = adding.pop?.body.querySelectorAll('.rf-item')[d.lit]; return makeDraft(lit?.item?.act || 'journal', event.metaKey || event.ctrlKey); }
    // From a group's +: no question where, today's journal (a page of its own where the nodes are pages).
    if (d.gkey) return makeDraft(d.asPage ? 'page-itself' : 'journal', event.metaKey || event.ctrlKey);
    if (d.asPage) return makeDraft('page-itself', event.metaKey || event.ctrlKey);
    d.step = 'where'; d.lit = 0; d.moved = false; if (d.lastWhere?.startsWith('page:')) d.where = d.lastWhere.slice(5); clearGhost();
    draw(host()); focusDraft();
  }
}
// The rows under the where field: today's journal, this page, then the pages that match what is typed.
let pagesRead = null;
async function whereList(field) {
  const d = state.draft;
  if (!d || d.step !== 'where' || !field.isConnected) return;
  pagesRead ||= await provided.propPages().catch(() => []);
  if (state.draft !== d || !field.isConnected) return;
  const q = d.where.trim().toLowerCase();
  const rows = [['journal', 'Today’s journal', 'date'], ['here', pageTitleNow(), 'page']].filter(([, text]) => !q || text.toLowerCase().includes(q));
  if (q) for (const p of pagesRead.filter(p => p.lower.includes(q) && p.uuid !== state.pageUuid).sort((a, b) => (b.lower.startsWith(q) - a.lower.startsWith(q)) || a.lower.length - b.lower.length).slice(0, 6)) rows.push(['page:' + p.title, p.title, 'page']);
  // The place chosen for the node before, lit until the arrows or typing move the light (0.4.413).
  if (d.lastWhere && !d.moved) { const at = rows.findIndex(([act]) => act === d.lastWhere); if (at >= 0) d.lit = at; }
  d.lit = Math.min(d.lit, Math.max(0, rows.length - 1));
  const items = rows.length ? rows.map(([act, text, name]) => ({ icon: name, label: text, act, run: item => makeDraft(item.act, false) })) : [{ note: 'No page by that name' }];
  if (!adding.pop || adding.pop.isClosed) adding.pop = shared.popup({ at: field.closest('.rf-field') || field, manual: true, cls: 'refinement-two-way-add', width: 260, items, onClose: () => { adding.pop = null; } });
  else adding.pop.items(items);
  if (rows.length) adding.pop.lit(d.lit);
  if (field.isConnected && field.ownerDocument.activeElement !== field) field.focus({ preventScroll: true });   // the list opening takes the keyboard, and keys would reach Logseq's shortcuts
}
async function makeDraft(target, open) {
  const d = state.draft, group = d && state.groups.find(g => g.name === d.field);
  if (!group) return dropDraft();
  const name = d.name.trim();
  if (!name) return focusDraft();
  if (d.making) return;   // Enter twice makes one
  d.making = true;
  const page = await model.getPage(state.pageUuid).catch(() => null);
  if (!page?.id) { d.making = false; return notify('This page could not be read, so nothing was added', 'warning'); }
  const asPage = target === 'page-itself';
  const where = asPage || target === 'journal' ? 'journal' : target === 'here' ? 'here' : 'page';
  const other = where === 'page' ? target.slice(5) : '';
  const again = { kind: d.kind, gkey: d.gkey, set: d.set, lastWhere: asPage ? '' : target };
  dropDraft();
  let made = false;
  try { made = await addRecord({ group, page, name, kind: d.kind, open, asPage, where, other, set: d.set, pieces: takenPieces(d) }) === true; }
  catch (error) { warnOnce('could not add the new node', error); notify('The new node could not be added', 'warning'); }
  // The line stays open for the next one (0.4.413, idea 5 of the brainstorm of 2026-10-25): empty, in the same place,
  // with the same tag and group, the place chosen last lit in the where step. Not after Cmd-Enter, which opens the new
  // node in the sidebar; Escape on the empty line closes it, as before.
  if (made && !open && state.groups.some(g => g.name === group.name)) openAgain(group, again);
}
function openAgain(group, { kind, gkey, set, lastWhere }) {
  closeAdd(); state.draft = null;
  const d = draftFor(group);
  Object.assign(d, { kind, gkey, set, lastWhere });
  if (gkey) setOpen(gkey, true);
  state.html = null; draw(host()); focusDraft();
}
// The other tags, under the tag at the line's right: the kit's pop-up, the one in force ticked.
function tagList(anchor) {
  const line = anchor.closest('.rf-tw-draft'), group = state.groups.find(g => g.name === line?.dataset.field);
  if (!group) return;
  closeAdd();
  const d = draftFor(group);
  draw(host());
  const at = state.box?.querySelector(`.rf-tw-draft[data-field="${CSS.escape(d.field)}"] .rf-tw-draft-tag`) || anchor;
  adding.pop = shared.popup({ at, cls: 'refinement-two-way-add', width: 200, onClose: () => { adding.pop = null; },
    items: [...d.kinds, ''].map(k => ({ icon: k ? 'tag' : null, label: k || 'no tag', faint: !k, chosen: k === d.kind, run: () => { d.kind = k; draw(host()); focusDraft(); } })) });
}
async function addRecord({ group, page, name, kind, open, asPage, where = 'journal', other = '', edit = false, set = null, pieces = [] }) {
  // A page in the Recycle still answers to its name, and "making" that name hands it back still in the Recycle: it is brought back instead.
  const named = asPage ? await model.getPage(name).catch(() => null) : null, recycled = named?.uuid ? await model.inRecycle(String(named.uuid)).catch(() => false) : false;
  if (named && !recycled) return notify(`A page named “${name}” already exists, so nothing was added`, 'warning');
  const prop = (await provided.propSchema()).props.find(p => p.ident === group.ident);
  let tagUuid = '';
  if (kind) {
    tagUuid = await provided.tagUuidNamed(kind);
  }
  let block, undo;
  if (asPage) {
    if (recycled) { await model.restorePage(String(named.uuid)); block = named; }
    else block = await model.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!block?.uuid) throw new Error('the page was not made');
    // By name, as Properties in the line does: Logseq 2.0.2 left the page in place when asked by its uuid here.
    undo = async () => { await model.deletePage(name); later(300); };
    // A page made now is not in the look-up of every page: it has no rows of its own yet.
    state.byPage.set(String(block.uuid), []);
  } else {
    // Where it goes (0.4.298): today's journal, this page, or another page named in the box (an existing one only).
    let target = '';
    if (where === 'here') target = String(page.uuid);
    else if (where === 'page') {
      const found = (await provided.propPages()).find(p => p.lower === other.toLowerCase()) || await model.getPage(other).catch(() => null);
      if (!found?.uuid || await model.inRecycle(String(found.uuid))) return notify(`There is no page named “${other}”, so nothing was added`, 'warning');
      target = String(found.uuid);
    } else {
      const now = new Date();
      const journalId = await provided.journalIdFor(todayNumber(), await provided.journalTitleFor(now.getFullYear(), now.getMonth() + 1, now.getDate()));
      target = journalId ? String(await provided.uuidById(journalId)) : '';
      if (!target) throw new Error('no journal page for today');
    }
    block = await model.appendBlock(target, name);
    if (!block?.uuid) throw new Error('the block was not made');
    undo = async () => { await model.removeBlock(block.uuid); later(300); };
  }
  try {
    if (tagUuid) await model.addTag(block.uuid, tagUuid);
    if (prop?.many) await model.setValue(block.uuid, group.ident, [page.id], { entityId: true, reset: true });
    else await model.setValue(block.uuid, group.ident, page.id, { entityId: true });
    if (set?.ident) await setGroupValue(block.uuid, set);
  } catch (error) { await undo().catch(() => {}); throw error; }
  // The proposals shown under the line (0.4.406), each on its own: one that fails leaves the node made, and says so.
  const filled = [];
  for (const piece of pieces) {
    try {
      if (piece.kind === 'day') await model.setValue(block.uuid, piece.ident, piece.journalId ?? await journalPageFor(piece.day));
      else if (piece.kind === 'number') await model.setValue(block.uuid, piece.ident, piece.ids[0]);
      else if (piece.many) await model.setValue(block.uuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await model.setValue(block.uuid, piece.ident, piece.ids[0], { entityId: true });
      filled.push(piece.title);
    } catch (error) { warnOnce(`“${piece.title}” could not be filled in on the new node`, error); notify(`“${piece.title}” could not be filled in on the new node`, 'warning'); }
  }
  later(300);
  await offerMade(String(block.uuid), `Added “${name}”${kind ? ` (${kind})` : ''}${asPage ? ' as a page' : where === 'here' ? ' to this page' : where === 'page' ? ` to ${other}` : ' to today’s journal'}${filled.length ? `, with ${filled.join(', ')}` : ''}`, undo, group.name);
  if (open) openEntity(block.uuid, true);
  // Into its words at once (0.4.302): the sidebar draws it a moment after it opens.
  if (edit && !asPage) { const uuid = block.uuid; window.Threads.core.screen.waitFor(() => host().querySelector(`#right-sidebar .ls-block[blockid="${uuid}"]`), 3000).then(found => found && model.editBlock(uuid, { pos: 0 })).catch(error => warnOnce('the new record could not be put in edit', error)); }
  return true;
}

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
  const bar = box.querySelector('.rf-tw-bar');
  const first = state.picked.size ? [...box.querySelectorAll('input.rf-tw-pick')].find(input => input.checked)?.closest('.rf-tw-line') : null;
  if (bar && first && bar.nextElementSibling !== first) first.before(bar);
  const keep = state.keepStill; state.keepStill = null;
  if (!keep) return;
  const pick = [...box.querySelectorAll('input.rf-tw-pick')].find(input => input.dataset.pick === keep.key);
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
  return `<div class="lk-picked rf-tw-bar"${idle ? ' data-idle="" aria-hidden="true"' : ''} role="toolbar" aria-label="What to do with the picked nodes"><span class="lk-picked-count rf-count"><b class="lk-picked-n">${n}</b> picked</span><button type="button" class="lk-picked-x" data-act="clear" title="Clear the picks (Escape)" aria-label="Clear the picks">×</button>${
    b('sidebar', 'Open in sidebar', 'Open them in the right sidebar', 'side')}<button type="button" class="lk-picked-act rf-tw-menu" data-act="more" title="Everything else you can do with them" aria-haspopup="menu">More<span class="lk-i-chevron rf-tw-chev" aria-hidden="true"></span></button><span class="lk-picked-gap"></span>${
    b('delete', 'Delete', 'Delete them', 'bin', 'lk-del')}</div>`;
}
// The page's own name, for More's "Change “Dr. Mei Chen” to…" (0.4.233, the owner: "make it clear"), read once per page.
const named = { uuid: '', title: '' };
const pageTitle = () => named.uuid === state.pageUuid && named.title ? named.title : 'this page';
async function readTitle() {
  const uuid = state.pageUuid;
  if (named.uuid === uuid) return;
  const title = await provided.titleNow(uuid).catch(() => null);
  if (state.pageUuid !== uuid || !title) return;
  Object.assign(named, { uuid, title: await provided.readableTitle(title).catch(() => title) });
  draw(host());
}
function togglePick(el, range) {
  const key = el.dataset.pick, all = [...state.box.querySelectorAll('.rf-tw-row .rf-tw-pick')].map(p => p.dataset.pick);
  const from = all.indexOf(state.lastPick), to = all.indexOf(key);
  if (range && from >= 0 && to >= 0) { const on = !state.picked.has(key); for (const k of all.slice(Math.min(from, to), Math.max(from, to) + 1)) on ? state.picked.add(k) : state.picked.delete(k); }
  else if (state.picked.has(key)) state.picked.delete(key); else state.picked.add(key);
  state.lastPick = key;
  state.keepStill = { key, top: el.getBoundingClientRect().top };
  state.html = null;
  draw(host());
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
const raisablePicked = () => picks().filter(p => isMentions(p.group) && p.group.items.some(item => item.uuid === p.uuid && (!item.tag || item.tag === 'note'))).map(p => p.uuid);
async function raisePairs() {
  const uuid = state.pageUuid;
  if (state.raisePairs?.page === uuid) return state.raisePairs.pairs;
  const [schema, pages] = await Promise.all([provided.propSchema(), provided.propPages()]);
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
  state.raise.set(uuid, { pairs: [], best: null });
  const [pairs, guess] = await Promise.all([raisePairs(), provided.tagGuess ? provided.tagGuess(uuid).catch(error => { warnOnce('the tag a mention looks like could not be read', error); return null; }) : null]);
  const best = guess ? pairs.find(p => p.tag.id === guess.id) || null : null;
  state.raise.set(uuid, { pairs: best ? [best, ...pairs.filter(p => p !== best)] : pairs, best });
  state.html = null; draw(host());
}
// Under the one picked mention, what it would get, as the + line shows a new node's (the proposals' grey).
function raiseHtml(group, item) {
  if (!isMentions(group) || !state.picked.has(`${item.uuid}|${group.name}`)) return '';
  const only = raisablePicked();
  const best = only.length === 1 && only[0] === item.uuid ? state.raise.get(item.uuid)?.best : null;
  if (!best) return '';
  const piece = (name, value) => `<span class="rf-tw-dprop"><span class="rf-tw-dname">${esc(name)}</span><span class="rf-pencil lk-pencil">${esc(value)}</span></span>`;
  return `<div class="rf-tw-raise" title="What it would get: the tag its words look like, and “${esc(best.prop.title)}” set to this page. Make it from the bar above.">${piece('Tags', best.tag.title)}${piece(best.prop.title, pageTitle())}</div>`;
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
  const here = await provided.idByUuid(state.pageUuid);
  if (!here) return;
  const kind = pair.tag.title;
  return writeAll(`Made ${counted(uuids.length)} ${kind}, “${pair.prop.title}” set to “${pageTitle()}”`, uuids.map(uuid => async () => {
    const had = await provided.valuesOf(uuid, pair.prop.ident);
    const tagged = await provided.hasTag(uuid, pair.tag.uuid);
    if (!tagged) await model.addTag(uuid, pair.tag.uuid);
    if (!had.includes(here)) await setValues(uuid, pair.prop, pair.prop.many ? [...had, here] : [here]);
    state.raise.delete(uuid);
    return async () => { await setValues(uuid, pair.prop, had); if (!tagged) await model.removeTag(uuid, pair.tag.uuid); };
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
  if (heldById(prop)) return provided.valuesOf(uuid, prop.ident);
  const held = [...(await provided.nodeValues([uuid], { logseqs: true })).get(uuid)?.values() || []].find(h => h.ident === prop.ident);
  return (held?.values || []).map(v => v.time ?? v.number ?? v.boolean ?? v.text);
}
async function setValues(uuid, prop, values) {
  if (!values.length) return model.unsetValue(uuid, prop.ident);
  return model.setValue(uuid, prop.ident, prop.many ? values : values[0], heldById(prop) ? { entityId: true, reset: true } : { reset: true });
}
// A day typed for a date (a journal page, by its id) or a date-and-time (a moment: the day's first).
async function dayValue(typed, kind) {
  const day = provided.parseDay(typed, new Date());
  if (!day || kind === 'datetime') return day?.getTime();
  return provided.journalIdFor(provided.dayNumber(day), await provided.journalTitleFor(day.getFullYear(), day.getMonth() + 1, day.getDate()));
}
// Runs one change on every picked node; a node that fails is left as it was and the rest go on. Undo puts back the rest.
async function writeAll(text, steps) {
  const undos = [];
  let failed = 0;
  for (const step of steps) {
    try { const undo = await step(); if (undo) undos.push(undo); } catch (error) { failed++; warnOnce('a picked node could not be changed', error); }
  }
  state.picked.clear(); later(300); draw(host());
  if (failed) notify(`${failed} of the picked nodes could not be changed`, 'warning');
  if (undos.length) offerUndo(text, async () => {
    let missed = 0;
    for (const undo of undos.reverse()) { try { await undo(); } catch (error) { missed++; warnOnce('a picked node could not be put back', error); } }
    later(300);
    if (missed) notify(`${missed} of the nodes could not be put back`, 'warning');
  });
}
const propNamed = async name => (await provided.propSchema()).props.find(p => p.lower === name.toLowerCase());
// Whether a page fits a property: any page when it takes no tag, else a page with one of its tags or a tag beneath.
async function takerOf(prop) {
  const schema = await provided.propSchema(), ids = new Set((prop?.classes || []).map(c => c.id));
  return page => !ids.size || provided.fits(page, ids, schema);
}
// The pages the nodes' words name, among the ids allowed, the most named first, this page never ([] without the rules).
async function namedFirst(uuids, fields, allowed) {
  if (!provided.namedPages) return [];
  const tagIds = [...new Set(fields.flatMap(f => f.classes.map(c => c.id)))];
  const ok = new Set(allowed), count = new Map();
  for (const uuid of uuids) {
    const ids = await provided.namedPages(titleFor(uuid), tagIds).catch(error => { warnOnce('the names in the picked nodes could not be read', error); return []; });
    for (const id of ids) if (ok.has(id)) count.set(id, (count.get(id) || 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
async function pageNamed(name, prop) {
  const pages = (await provided.propPages()).filter(page => page.lower === name.toLowerCase());
  return pages.find(await takerOf(prop)) || pages[0] || null;
}
async function act(what, at = null) {
  // A press on the bar: its menus and questions open from where it stands on the screen (an anchor inside the rows' list is not
  // followed by a menu shown over the page).
  if (at?.closest?.('.rf-tw-bar')) { const r = at.getBoundingClientRect(); at = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
  const chosen = picks(), nodes = nodesPicked();
  if (what === 'clear') { state.picked.clear(); return draw(host()); }
  if (what === 'all') { for (const key of state.listed) state.picked.add(key); readTitle().catch(() => {}); return draw(host()); }
  if (!chosen.length) return;
  // The two words with a menu (0.4.327): the menu opens under the word, and what is picked from it acts as its own word did.
  if (what === 'raise') return raiseMenu(at);
  // More (5 November 2026): Select all, then every action but Open in sidebar and Delete, which stand on the bar; the page's own
  // two only with a node from a property's row picked, Make it… only with a mention that has no tag.
  if (what === 'more') {
    const fromProps = chosen.some(p => !isMentions(p.group)), raisable = raisablePicked();
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
  if (what === 'sidebar') { for (const uuid of nodes) openEntity(uuid, true); state.picked.clear(); return draw(host()); }
  try {
    if (what === 'copy') {
      const lines = await Promise.all(nodes.map(async uuid => { const page = await model.getPage(uuid).catch(() => null); return page?.name ? `[[${page.title || page.originalName || page.name}]]` : `((${uuid}))`; }));
      await host().defaultView.navigator.clipboard.writeText(lines.join('\n'));
      notify(`Copied ${counted(nodes.length)}`);
      state.picked.clear(); return draw(host());
    }
    const schema = await provided.propSchema();
    const here = await provided.idByUuid(state.pageUuid);
    if (what === 'point' || what === 'unlink') {
      chosen.splice(0, chosen.length, ...chosen.filter(p => !isMentions(p.group)));
      if (!chosen.length) return;
      const fields = [...new Set(chosen.map(p => p.group.ident))].map(ident => schema.props.find(p => p.ident === ident)).filter(Boolean);
      let target = null;
      if (what === 'point') {
        const takers = await Promise.all(fields.map(takerOf));
        const fits = (await provided.propPages()).filter(page => page.id !== here && takers.some(takes => takes(page)));
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
        const had = await provided.valuesOf(uuid, prop.ident);
        let now = had.filter(id => id !== here);
        if (target && !now.includes(target.id)) now = prop.many ? [...now, target.id] : [target.id];
        await setValues(uuid, prop, now);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'tag') {
      const tags = (await provided.propPages()).filter(page => page.isTag);
      const name = await ask(`Add a tag to ${counted(nodes.length)}`, '', tags.map(t => t.title), 'Add', '', false, at);
      if (!name) return;
      const tagUuid = await provided.tagUuidNamed(tags.find(t => t.lower === name.replace(/^#/, '').toLowerCase())?.title || name.replace(/^#/, ''));
      if (!tagUuid) return notify(`There is no tag named “${name}”, so nothing was changed`, 'warning');
      return writeAll(`Tagged ${counted(nodes.length)} ${name.replace(/^#/, '')}`, nodes.map(uuid => async () => {
        if (await provided.hasTag(uuid, tagUuid)) return null;
        await model.addTag(uuid, tagUuid);
        return () => model.removeTag(uuid, tagUuid);
      }));
    }
    if (what === 'set' || what === 'unset') {
      let names = schema.props.map(p => p.title);
      if (what === 'unset') {
        const held = new Set((await Promise.all(nodes.map(uuid => provided.userValues(uuid)))).flat());
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
          : ['node', 'page'].includes(kind) ? (await provided.propPages()).filter(await takerOf(prop)).map(page => page.title)
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
        if (what === 'unset') { if (!had.length) return null; await model.unsetValue(uuid, prop.ident); }
        else if (entity) await setValues(uuid, prop, prop.many ? [...new Set([...had, value])] : [value]);
        else await model.setValue(uuid, prop.ident, value);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'delete') {
      // A page goes with all its bullets: the question says so, the pages apart from the bullets.
      const pages = (await Promise.all(nodes.map(uuid => model.getPage(uuid).catch(() => null)))).filter(page => page?.name).length, bullets = nodes.length - pages;
      const one = nodes.length === 1 ? (pages ? `the page “${titleFor(nodes[0])}” with all its bullets` : `“${titleFor(nodes[0])}”`)
        : [pages && `${pages} ${pages === 1 ? 'page' : 'pages'} with all ${pages === 1 ? 'its' : 'their'} bullets`, bullets && `${bullets} ${bullets === 1 ? 'bullet' : 'bullets'}`].filter(Boolean).join(' and ');
      if (!await sure(`Delete ${one}? This cannot be undone from here.`, 'Delete', at)) return;
      return writeAll('', nodes.map(uuid => async () => {
        const page = await model.getPage(uuid).catch(() => null);
        if (page?.name) await model.deletePage(page.name); else await model.removeBlock(uuid);
        return null;
      }));
    }
  } catch (error) { warnOnce(`could not ${what} the picked nodes`, error); notify('That could not be done', 'warning'); }
}

const twoWayCss = `
/* Under the page's own properties, as more property rows (the light field around them went at the design audit,
   0.4.286, docs/history/DESIGN-AUDIT-2026-10-22.md: a box around rows meant to read as rows): these rows are the far end of a field held by other
   records, so they read like properties but are not this page's own; the → after the name, pointing at the records that hold the field, says so (a ← before the name until 0.4.186). The names are
   the grey of every property name and the days plain grey words (0.4.141, the owner's pick: no blue, no date box).
   Sizes and columns are Logseq's own property rows above, as measured in 2.0.2 (0.4.144): the text at the page's
   size (the names .94 of it, as theirs), a 150px name column, a 12px gap, the values 22px in where theirs start
   after their bullet, 28px rows; the name starts where theirs does, after the room of their property icon (15px and a 4px gap), and the → follows it.
   Only the rows' own layout is here (0.4.318): the tag, the tick box, the filter words, the icons, the field, the card
   and the pop-ups are the kit's, the bar and the buttons the library's (plugin.js). */
.refinement-two-way {
  margin: calc(.15rem + var(--rf-tw-hold, 0px)) 0 .5rem; padding: 0;
  line-height: 1.5; user-select: text;
  /* One name column for every row (0.4.377, the owner: "alignment of second column"): each row is a subgrid of the box,
     so the longest name sets where every row's values start, as in Logseq's own property list. */
  display: grid; grid-template-columns: minmax(150px, max-content) minmax(0, 1fr); column-gap: 12px;
}
.refinement-two-way > * { grid-column: 1 / -1; }
/* Waiting unseen in its place for Logseq's property list on a first visit (0.4.333), the page's words below it with it. */
.refinement-two-way[data-rf-waiting] { visibility: hidden; }
#main-content-container:has(.refinement-two-way[data-rf-waiting]) .ls-page-blocks { visibility: hidden; }
/* Only holding room while the page settles: no field, no rows. */
.refinement-two-way:not(:has(.rf-tw-row)) { margin: var(--rf-tw-hold, 0px) 0 0; }
/* The room held while the page settled eases away (0.4.283), only then: while the page settles the held room shrinks in the same frame Logseq's list grows, and must not lag. */
.refinement-two-way[data-rf-settling] { transition: margin-top .25s ease; }
.refinement-two-way .rf-tw-row { display: grid; grid-template-columns: subgrid; column-gap: 12px; align-items: first baseline; padding: 2px 0; }
/* After an open list, a gap of one line (the grammar's groups), well over the room between two of its lines. */
.refinement-two-way .rf-tw-row[data-open] { padding-bottom: 14px; }
/* A property's name starts with its icon (0.4.477), hung in the room left of the name so the names stay on one edge
   with the row's own words ("Mentioned in"), which have none. */
.refinement-two-way .rf-tw-name > .rf-kind { font-size: 15px; width: 15px; justify-content: center; margin-left: -19px; margin-right: 4px; opacity: .5; vertical-align: -1px; }
/* The names stand in one column you can scan down, lined up with the page's properties, in the quiet strength; only the head is bold (the owner, 1 November). */
.refinement-two-way .rf-tw-name { color: var(--rf-quiet); font-size: var(--rf-name, .94em); white-space: nowrap; cursor: default; padding-left: 19px; position: relative; }
.refinement-two-way .rf-tw-sep { visibility: hidden; }
.refinement-two-way .rf-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; row-gap: 4px; position: relative; }
.refinement-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
/* The underline under the words, on every line of a name that wraps (0.4.377, the owner: "you can underline the words of a whole
   sentence not just the bottom part of wrapped line"). */
/* In an open list the name keeps the pixel the old underline (a border) took, so the lines stay where they were. */
/* A little more room between records (0.4.230, the owner: "just increase line spacing of items", in place of taking the line away). */
.refinement-two-way .rf-tw-tag { margin-left: .5em; }
.refinement-two-way .rf-tw-toggle:hover { color: inherit; }
/* The list a count opens into: date, record, tag, one per line, under the value. */
/* The line drops from under the fold arrow (centred 11px in, 0.4.196), as Logseq's own guide lines drop from theirs; the words stay where they were. */
/* Moving around (0.4.184): a record's line lit under the pointer, the field's name
   and the kinds as quiet words, the kinds row above an open list, "earlier" before what is past. */
/* The field's name and the count that opens a list get the same soft patch under the pointer (0.4.185), drawn in the
   padding a negative margin gives back, so nothing moves. */
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle) { border-radius: 4px; padding: 0 .25em; margin-left: -.25em; margin-right: -.25em; transition: background-color .1s ease, color .1s ease; }
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle):hover { color: inherit; background: var(--rf-wash); }
.refinement-two-way a.rf-tw-field { color: inherit; }
.refinement-two-way .rf-tw-chips { display: inline-flex; flex-wrap: wrap; gap: .3rem .9rem; }
/* The days after the kinds, quiet and in the kinds' own size, so the line reads as one summary. */
.refinement-two-way .rf-tw-toggle.rf-tw-when { color: var(--rf-quiet); font-size: 14px; }
.refinement-two-way .rf-tw-earlier { display: flex; align-items: center; gap: .5em; margin: .2rem 0 .1rem calc(16px + var(--rf-ol-gap)); padding: 0; } /* at the chevrons of the nodes it parts (the owner: "start it at chevron") */
.refinement-two-way .rf-tw-earlier::after { content: ''; flex: 1; border-top: 1px solid var(--rf-hair); }
/* The line for adding a node (0.4.303): under the row's values, in the value column; a + at its left, the kit's
   field inline, the tag right after it. */
/* A node's tag sits right after its name (0.4.320, the owner: "move tags for two-way
   link next to item, not right aligned"); the last column takes the rest of the row. */
.refinement-two-way .rf-tw-draft { grid-column: 2; position: relative; display: grid; grid-template-columns: minmax(8em, 22em) auto 1.4em 1fr; column-gap: .5em; align-items: baseline; margin: 0 -.35rem; padding: 0 .35rem 0 calc(22px + .35rem); cursor: text; }
.refinement-two-way .rf-tw-row { position: relative; }
.refinement-two-way .rf-tw-add { margin-left: .6em; }
/* Date first in a short row, name first in a list (0.4.304): the same columns as the other kind, the other way round. */
.refinement-two-way .rf-tw-draft-plus { position: absolute; left: calc(.35rem + 3px); width: 16px; text-align: center; }
.refinement-two-way .rf-tw-draft-main { display: flex; align-items: baseline; gap: .5em; min-width: 0; }
.refinement-two-way .rf-tw-draft-main .rf-field { flex: 1; min-width: 0; }
/* No line under the box for a new node (0.4.400, the owner: it read as a link or a filled value beside the real links); its
   pixel is kept so nothing moves. */
.refinement-two-way .rf-tw-draft .rf-field { border-bottom-color: transparent; }
.refinement-two-way .rf-tw-draft-typed { flex: none; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-two-way .rf-tw-draft .rf-tw-draft-tag { margin-left: 0; white-space: nowrap; }
/* The rest of the new node under the line (0.4.406): the proposals' look (parts/proposals.js), the row's height kept. */
.refinement-two-way .rf-tw-draft-props { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1.1em; row-gap: .1em; min-height: 1.5em; font-size: .92em; line-height: 1.5; }
.refinement-two-way .rf-tw-dprop { display: inline-flex; align-items: baseline; gap: .35em; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: default; text-align: left; }
.refinement-two-way button.rf-tw-dpick { cursor: pointer; }
.refinement-two-way .rf-tw-dname { color: var(--rf-faint); }
.refinement-two-way .rf-tw-dpassed { opacity: .45; }
/* A page's name completed in grey after the cursor (0.4.406): a copy of the words laid over the box, the typed part clear. */
.refinement-two-way .rf-tw-draft .rf-field { position: relative; }
.refinement-two-way .rf-tw-ghost-over { position: absolute; box-sizing: border-box; pointer-events: none; white-space: pre; overflow: hidden; }
.refinement-two-way .rf-tw-ghost-typed { color: transparent; }
.refinement-two-way .rf-tw-ghost-rest { color: var(--rf-faint); }
.refinement-two-way .rf-tw-ghost-rest[data-name]::after { content: "  " attr(data-name); font-size: .8em; }
/* Group a row by anything (0.4.369): the word after the count, a group's name with its count and its +, the lines
   under it. Write into a node (0.4.369): the small arrow before a node, its bullets under its line. */
/* Group shows all along (0.4.403, the owner: "can keep Group there all along, capitalize G"); before it showed only with
   the pointer on the row. */
.refinement-two-way .rf-tw-groupby { margin-left: .6em; height: 20px; padding: 0 5px; gap: 2px; }
.refinement-two-way .rf-tw-groupby .ti { font-size: 12px; }
.refinement-two-way .rf-tw-ghead { display: flex; align-items: baseline; gap: var(--rf-ol-gap); margin: .85rem 0 .1rem; }
.refinement-two-way .rf-tw-group:first-child .rf-tw-ghead { margin-top: .1rem; }
.refinement-two-way .rf-tw-gwords { display: inline-flex; align-items: baseline; gap: .35em; padding-right: .25em; color: var(--rf-quiet); }
.refinement-two-way .rf-tw-gn { font-size: .88em; }
.refinement-two-way .rf-tw-gadd { visibility: hidden; }
.refinement-two-way .rf-tw-ghead:hover .rf-tw-gadd, .refinement-two-way .rf-tw-gadd:focus-visible { visibility: visible; }
.refinement-two-way .rf-tw-group .rf-tw-draft { padding-left: .35rem; }
.refinement-two-way .rf-tw-group .rf-tw-draft-plus { display: none; }
/* The chevron before a node's name (0.4.435): always there, faint; full under the pointer or while the node is open. */
/* A node's properties in its opened box (0.4.410): two columns as Logseq's own property list, the name lighter than the
   value, a node property's mark before the name (a fact none); a value a quiet button, a wash under the pointer; "empty" in grey. */
/* Follow a chain (0.4.423): a value that is another node has a small chevron before it, turning down when it is open;
   the node opened through it sits under the property, across both columns, with its properties, the rows that point at
   it and its bullets, a line down its left like an opened node's. Its size is the row's again, not the properties'. */
/* A mention made a node (0.4.423): what it would get, under the one picked, in the proposals' grey. */
/* Picking (0.4.228): the kit's tick box before each record, in the room left of it; shown under the pointer and on
   every record while any is picked. The bar is the library's, above the rows. */
/* The box answers 6px round it as well (0.4.297); the room left of the record ticks it too (onClick). */
/* In an open list the box sits left of the outline's line (0.4.229, the owner: "to the left of the outline, not within it"). */
/* Records not in a list too, one to a line so their boxes share that column (0.4.230, the owner: "even those not in a outline"). */
/* Each record on a line of its own, as in an open list (0.4.297); its tag right after its name since 0.4.320 (it was at
   the right edge from 0.4.297, the owner then: "the tags under decided should be right aligned"). */
/* In the wrapping row a negative margin shifts a node instead of widening it (measured in the app, 0.4.299: its right edge
   5 px and its tag 10 px short of an open list's): so it is widened by the margins themselves, the open list's .35rem. */
/* The same room as in an open list: half a letter before the day, a letter before the tag. */
/* The room between the words and the day, and before the tag: a space, widened, which a line may break at and which
   leaves no gap at the start of a line. */
/* a long name wraps, never cut (0.4.263) */
/* The room left of a record, where its box sits, counts as the record under the pointer, so the box shows there too. */
.refinement-two-way { position: relative; }
/* Drawn again whole on each change, so the browser's scroll anchoring would pick a new line to hold the page by and move
   it (frame by frame: 26 px up at the first letter typed, nothing having changed in height). The page keeps its place. */
.refinement-two-way, .refinement-two-way * { overflow-anchor: none; }
/* While finding, a list heading's + and Group are away: they rode on the end of its words, which change with each letter. */
.refinement-two-way[data-finding] :is(.rf-tw-add, .rf-tw-groupby) { display: none; }
/* The bar is the library's lk-picked. Above the first picked node it reaches as far left as the tick boxes and as far right as the
   picked nodes' grey, its top corners round, so the bar and the nodes under it are one block. No room is kept for it at rest. */
.refinement-two-way .rf-tw-bar[data-idle] { display: none; }
.refinement-two-way .rf-ol .rf-tw-bar { margin: 4px -12px 0 calc(-56px - var(--rf-ol-day, 48px) - var(--rf-tw-back, 0px)); padding-left: 18px; border-radius: 8px 8px 0 0; }
.refinement-two-way > .rf-tw-bar { margin: 0 0 6px; border-radius: 8px; }
.refinement-two-way .rf-tw-chev::before { margin: 0 0 0 .1em !important; opacity: .75; }
/* The picked nodes on one grey ground, so the eye sees which they are. */
.refinement-two-way .rf-tw-line:has(> input.rf-tw-pick:checked) { background: var(--lk-wash); box-shadow: -40px 0 0 var(--lk-wash), 12px 0 0 var(--lk-wash); border-radius: 0; }
.refinement-two-way :is(.rf-tw-add, .rf-tw-gadd):focus-visible { outline: none; background: var(--lk-wash); }

/* The rows on the kit's outline (0.4.442): each node a line, the tick box in the margin, the day in its column, the one
   chevron right before the name; a list opens under its count with no line of its own; what a node holds opens under
   its name (the kit's kids). The section keeps Logseq's value column: the outline starts where Logseq's values do. */
.refinement-two-way .rf-tw-value { display: block; font-size: inherit; }
.refinement-two-way .rf-tw-value.rf-ol { --rf-ol-day: 48px; font-size: inherit; line-height: 1.5; }
.refinement-two-way .rf-ol-line { min-height: 30px; padding-top: 3px; padding-bottom: 3px; }
.refinement-two-way .rf-ol-line > input.rf-check[type=checkbox] { top: 8px; }
.refinement-two-way .rf-tw-head { cursor: default; }
.refinement-two-way .rf-tw-head:hover { background: transparent; }
/* An outline (the owner, 2026-10-27: "have [date] [chevron] [bullet]"; "13 symptom logs chevron should be aligned with
   having fatigue and spoke with"): a list's line starts on the edge where a line with no day starts its chevron; its
   nodes show [day] [chevron] [node] to its right; under Group by a group's line is one step in from it. The list's line
   reads as a heading, a little heavier than a node. --rf-tw-in is the step. */
.refinement-two-way { --rf-tw-in: 22px; } /* the chevron and its gap (16px + 6px, --rf-ol-gap is set further in) */
.refinement-two-way .rf-tw-head .rf-tw-toggle, .refinement-two-way .rf-tw-head .rf-tw-chips { font-weight: 500; }
.refinement-two-way .rf-tw-head .rf-tw-chips { gap: .3rem 1.05rem; align-items: baseline; min-width: 0; overflow: hidden; }
.refinement-two-way .rf-tw-head .rf-tw-toggle.rf-tw-lead, .refinement-two-way .rf-tw-head .rf-chip.rf-tw-lead[aria-pressed="true"] { color: inherit; font-weight: 500; font-size: inherit; }
.refinement-two-way .rf-tw-head :is(.rf-tw-chip:not(.rf-tw-lead), .rf-tw-when) { font-weight: 400; color: var(--rf-quiet); font-size: inherit; }
.refinement-two-way .rf-tw-head .rf-tw-chip[aria-pressed="true"] { color: inherit; font-weight: 600; }
.refinement-two-way .rf-tw-head .rf-chip.rf-tw-lead[aria-pressed="false"] { color: var(--rf-quiet); font-weight: 400; font-size: inherit; }
.refinement-two-way .rf-tw-head .rf-tw-sep { position: absolute; right: 100%; margin-right: .42rem; color: var(--rf-faint); font-weight: 400; }
.refinement-two-way .rf-tw-head .lk-more { padding: 0; font-weight: 400; }
.refinement-two-way .rf-tw-head .rf-tw-piece { position: relative; display: inline-flex; align-items: baseline; white-space: nowrap; }
/* The days' words wrap as words do where the kinds' room is shorter than they are, never cut through a letter. */
.refinement-two-way .rf-tw-head .rf-tw-piece:has(> .rf-tw-when) { white-space: normal; min-width: 0; }
.refinement-two-way .rf-ol-kids.rf-ol-from-in { --rf-ol-cx: 8px; }
/* A list's days hang in the margin left of the outline (the owner, 2026-10-27: "dates … should not be in the way"): a
   node's chevron sits under its heading's words, one step in, and its day ends 4px short of the heading's chevron; under
   Group by the nodes step in once more under their group. */
/* The margin is the section's: room for a tick box and a day before the outline's edge, on every row, so a day never
   reaches the property names; a row with no heading has its chevron on the edge. */
.refinement-two-way .rf-tw-value { padding-left: calc(var(--rf-tw-in) + var(--rf-ol-day) + 12px); }
/* With no day on any line of the section (a day's own page leaves its own date out) the margin gives its room back to the words. */
.refinement-two-way[data-no-days] .rf-tw-value.rf-ol { --rf-ol-day: 0px; }
.refinement-two-way[data-no-days] .rf-tw-value.rf-ol .rf-ol-kids:not(.rf-tw-list) { --rf-ol-day: 48px; }
/* A heading's chevron is never over its nodes' chevrons (the owner, 2026-10-27: "the heading chevron cannot be over other
   chevrons"): everything a list holds steps in one step, dated or not, and a group's nodes once more under the group;
   a day stays in the margin left of its node's chevron. */
.refinement-two-way .rf-tw-list > .rf-ol-in { padding-left: var(--rf-tw-in); --rf-tw-back: var(--rf-tw-in); }
.refinement-two-way .rf-tw-group > .rf-tw-gitems { --rf-tw-back: calc(2 * var(--rf-tw-in)); }
/* Every day of the section ends on one edge, 12px short of the outline's edge, however far in its node's chevron is
   (--rf-tw-back: how far the room it sits in starts right of that edge), so the margin reads as one column of time. */
.refinement-two-way :is(.rf-tw-line, .rf-ol-moreline):has(> .rf-ol-day) { margin-left: calc(-16px - var(--rf-ol-day) - var(--rf-tw-back, 0px)); }
.refinement-two-way :is(.rf-tw-line, .rf-ol-moreline) > .rf-ol-day { margin-right: calc(12px + var(--rf-tw-back, 0px) - var(--rf-ol-gap)); text-align: right; }
/* Digging steps the same 22px as a list under its heading: a node's lines start under its words (8px to the hairline,
   1px of it, 13px after). The faint grey of an opened node stops at the section's right edge. */
.refinement-two-way .rf-ol-kids:not(.rf-ol-bare) { padding-left: 13px; }
.refinement-two-way .rf-ol-unit { margin-right: 0; }
.refinement-two-way .rf-tw-group > .rf-tw-gitems { padding-left: var(--rf-tw-in); }

/* The tick boxes show when the pointer is on their row, and all of them while anything is ticked (the owner, 2026-10-27:
   "checkboxes can be revealed on hover", in place of the faint box of 2026-10-25 for these). */
/* When the tick boxes show is Look's (the shared names lk-list and lk-tick). Each property's row is the list (the
   review, 31 October: the pointer on one row lit eleven boxes down the section, and the caret in the find line six),
   so only its boxes appear; the find line stands outside the rows and raises none. */
.refinement-two-way .rf-tw-head > .rf-ol-body { display: flex; align-items: baseline; column-gap: .9rem; }
.refinement-two-way .rf-tw-head > .rf-ol-body > .rf-tw-add, .refinement-two-way .rf-tw-head > .rf-ol-body > .rf-tw-groupby { margin-left: 0; flex: none; }
/* A name is one line, cut at the width the row leaves; its tag and what follows keep theirs. */
.refinement-two-way .rf-ol-body:has(> .rf-tw-record) { display: flex; align-items: baseline; }
/* A node's words run to two lines, then are cut (the owner, 1 November: a short note reads whole, a long one cannot run away). Opened or found, they read whole. */
.refinement-two-way .rf-ol-body > .rf-tw-record { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
/* The mark stays on the first line of a name that wraps (an opened node's), not in the middle of the words. */
.refinement-two-way .rf-ol-body > .rf-tw-record.rf-ol-open, .refinement-two-way[data-finding] .rf-ol-body > .rf-tw-record { display: block; -webkit-line-clamp: none; }
.refinement-two-way .rf-ol-body > .rf-tw-record ~ * { flex: none; }
.refinement-two-way .rf-ol-body > .rf-pencil { margin-left: 8px; }
/* No underline at rest in this section, under the pointer the firm one (the owner, 1 November 2026: long names, each underlined in full, striped it). */
.refinement-two-way a.rf-ol-name.lk-node { text-decoration-color: transparent !important; }
.refinement-two-way a.rf-ol-name.lk-node:is(:hover, :focus-visible) { text-decoration-color: currentColor !important; }
.refinement-two-way .rf-ol-body { display: inline; }
.refinement-two-way .rf-ol-body > .rf-tw-add, .refinement-two-way .rf-ol-body > .rf-tw-groupby { margin-left: .5em; }
.refinement-two-way .rf-tw-tell { margin-left: 6px; color: var(--rf-faint); font-size: 13px; white-space: nowrap; }
/* Inside an opened node, the nodes that link to it (0.4.462): their line in words, then their rows one step in; each
   day hangs in the section's margin, placed by placeDays (absolute in its line, so it takes no room in the value). */
.refinement-two-way .rf-tw-links { color: var(--rf-quiet); font-size: 13px; line-height: 1.5; padding: 4px 0 1px; }
.refinement-two-way .rf-tw-linked { padding-left: var(--rf-tw-in); }
.refinement-two-way .rf-tw-mday { position: absolute; width: var(--rf-ol-day); margin: 0; text-align: right; }
.refinement-two-way .rf-tw-mday:not([style]) { visibility: hidden; }
/* A row's wash covers its day, out in the margin, so the two read as one row (the owner, 2 November). */
.refinement-two-way .rf-ol-line:hover:has(.rf-tw-mday[style])::before { content: ""; position: absolute; top: 0; bottom: 0; left: calc(-1 * var(--rf-tw-day-reach, 0px)); width: var(--rf-tw-day-reach, 0px); background: var(--rf-wash); border-radius: 4px 0 0 4px; pointer-events: none; }
.refinement-two-way .rf-ol-line:hover:has(.rf-tw-mday[style]) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
/* A node stepped into keeps the margin for those days, as the rows do (0.4.462). */
/* always, so nothing moves sideways when a dated line first appears (the reviewer: 64 px) */
.refinement-two-way .rf-tw-stepbody { padding-left: calc(var(--rf-ol-day) + 16px); }
/* A shifted section's top (0.4.463): the trail ends on it in bold; its properties; then "N nodes link here" on the
   find field's hairline, and its rows as the page's. */
.refinement-two-way .rf-tw-toplinks { grid-column: 1 / -1; color: var(--rf-quiet); font-size: 13px; padding: 6px 0 5px; margin-bottom: 4px; border-bottom: 1px solid var(--rf-hair); }
::highlight(rf-find) { background-color: var(--rx-blue-04, #e1f0ff); } /* a very subtle blue, Logseq's own (the owner: "I don't like a yellow highlight, do very subtle blue") */
.refinement-two-way .rf-tw-crumb { color: var(--rf-faint); font-size: .82em; line-height: 1.3; padding: 0 0 3px calc(16px + var(--rf-ol-gap)); overflow-wrap: anywhere; }
.refinement-two-way .rf-tw-crumb .lk-step { font-size: inherit; }
.refinement-two-way .rf-tw-raise { display: flex; flex-wrap: wrap; column-gap: 1.1em; align-items: baseline; margin: 0 0 .2rem calc(16px + var(--rf-ol-gap)); font-size: .92em; line-height: 1.5; }
.refinement-two-way .rf-tw-npvalue { all: unset; cursor: pointer; border-radius: 3px; }
.refinement-two-way .rf-tw-npvalue.rf-faint { color: var(--rf-faint); }
.refinement-two-way .rf-tw-npvalue:hover, .refinement-two-way .rf-tw-npvalue:focus-visible { text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 3px; }
.refinement-two-way .rf-ol-pname[data-edit] { cursor: pointer; }
.refinement-two-way .rf-ol-pname[data-edit]:hover { color: inherit; }
.refinement-two-way .rf-tw-findrow { grid-column: 1 / -1; padding: 0 0 6px; }
/* The whole width of the section, its line a hairline even while typing (the owner: "weirdly short", "bottom of it can be
   hairline"). */
.refinement-two-way .rf-tw-findrow > .rf-field, .refinement-two-way .rf-tw-findrow > .rf-field:focus-within { border-bottom-color: var(--rf-hair); }
.refinement-two-way .rf-tw-stepped { grid-column: 1 / -1; }
.refinement-two-way .rf-tw-stepped > .rf-ol-trail { padding: 2px 0 8px; }
.refinement-two-way .rf-tw-ghead .rf-chev { align-self: center; }
/* The tick box of a node sits in the margin left of the outline (0.4.229, the owner: "to the left of the outline"). */
.refinement-two-way .rf-tw-line > input.rf-check.rf-tw-pick { left: -22px; }
/* Where you are (0.4.442): the names opened on the way, pinned at the top of the section once they scroll off; no room. */
.refinement-two-way .rf-tw-pin { grid-column: 1 / -1; position: sticky; top: var(--rf-tw-pin-top, 0px); height: 0; z-index: 3; }
.refinement-two-way .rf-tw-pin > .rf-ol-trail { position: absolute; left: -12px; right: -12px; top: 0; padding: 5px 12px; background: var(--lk-paper, var(--rf-bg)); border-bottom: 1px solid var(--rf-hair); }
`;
/* Logseq draws the properties under a record as one strip (.bottom-properties-pills-strip, flex-nowrap and
   overflow-x hidden), so a record with several fields is cut off at the right edge, behind an Expand button the
   plugin's plainProperties turns into a triangle. Here the strip wraps onto more lines, a field never split
   across two, so every field shows (seen in 2.0.2 on a scan visit: "report · date · doctor · facility · visit ty…"). */
const STRIP = '.ls-block .positioned-properties.block-below .bottom-properties-pills-strip';
// The row around the strip is held to one line's height (max-height 32px, overflow hidden) and centres it.
const openRowsCss = `
.ls-block .positioned-properties.block-below .bottom-properties-row { max-height: none !important; height: auto !important; overflow: visible !important; align-items: flex-start !important; }
${STRIP} { flex-wrap: wrap !important; overflow: visible !important; row-gap: .1rem; }
${STRIP} > .bottom-property-pill { max-width: 100%; }
`;
/* Logseq's own far end (0.4.146, the owner's pick): the tag-named tabs below a page's blocks list the same records
   as the rows, without the field that links them. Left out in the main view while the rows are drawn there, so a page
   with none keeps Logseq's list; and in the right sidebar always (0.4.421, the owner: "hide that bi-directional section
   that is already hidden in main views"), though it gets no rows: the same records are in its Linked references. */
// Logseq's Linked references (only that: Unlinked references sits outside .references) where the rows replace it (0.4.437).
const hideLinkedRefsCss = `
#main-content-container:has(.refinement-two-way[data-rf-replaces][data-rf-rows]) .references { display: none !important; }
`;
// The days' column taken away (twoWayDays off): its width to nothing, so the rows move left into it, and the days unseen.
const noDaysCss = `
.refinement-two-way, .refinement-two-way * { --rf-ol-day: 0px !important; }
.refinement-two-way :is(.rf-ol-day, .rf-tw-mday) { visibility: hidden !important; }
`;
const hideTagListsCss = `
#main-content-container:has(.refinement-two-way[data-rf-rows]) :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }
#right-sidebar :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }
`;
function applyStyles() {
  sendStyle('refinement-two-way', setting('twoWayRows') ? twoWayCss : '');
  sendStyle('refinement-two-way-hide-linked-refs', setting('twoWayRows') && setting('twoWayHideLinkedRefs') ? hideLinkedRefsCss : '');
  sendStyle('refinement-two-way-no-days', setting('twoWayRows') && !setting('twoWayDays') ? noDaysCss : '');
  sendStyle('refinement-two-way-hide-tag-lists', setting('twoWayRows') && setting('twoWayHideTagLists') ? hideTagListsCss : '');
  // openRowsCss changes how Logseq lays out its own properties: switched off with the page looks at 0.4.251 and not sent since.
  sendStyle('refinement-open-property-rows', '');
}

let timer = 0, indexTimer = 0;
const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(() => load().catch(error => warnOnce('could not refresh the two-way rows', error)), ms); };
// Right after Logseq starts its database is not ready for a while (the audit, 0.4.275: the read 1.5 s after a cold
// start failed, and nothing read again until the graph changed): a few quiet tries before saying so.
let indexTries = 0;
const indexLater = ms => { clearTimeout(indexTimer); indexTimer = setTimeout(() => loadIndex().then(() => { indexTries = 0; }, error => {
  if (++indexTries < 5) indexLater(2000 * indexTries); else { indexTries = 0; warnOnce('could not read the rows of every page', error); }
}), ms); };
let stopped = false;
function start() {
  ({ UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange } = take(window.Threads.core, ['UUID', 'isEntityId', 'watchDomEarly', 'addsElements', 'sendStyle', 'provided', 'uuidsIn', 'saveSettings', 'onPageChange', 'onDatabaseChange', 'onSettingsChange', 'currentPage', 'getPage', 'createPage', 'deletePage', 'appendBlock', 'removeBlock', 'addTag', 'removeTag', 'setValue', 'unsetValue', 'editBlock']));
  model = window.Threads.core.provided; // the graph is read and written through the model's doors (0.4.318)
  stopped = false;
  applyStyles();
  readHeights();
  forgetOrder();
  readOpen();
  readGroup();
  watchDomEarly(drawEarly);
  draw(host());
  // At once (0.4.150): the look-up waits in line behind Logseq loading the page anyway. The box stays until the next
  // page is drawn (0.4.182): draw() moves it, or takes it away, in the same frame. The hooks are the core's.
  onPageChange(() => { if (stopped) return; onRoute(); later(0); });
  onDatabaseChange(change => {
    if (stopped) return;
    clearTimeout(state.quiet);
    if (askQuietly.uuids.length) state.quiet = setTimeout(askQuietly, QUIET);
    checkMade();
    const writing = window.PluginDoor?.writing(change);
    if (!writing || touchesRows(change)) later(900);
    if (!writing && indexSize < BIG_INDEX) indexLater(10000);
  });
  // Another graph: nothing read of this one holds there.
  window.Threads.core.onGraphChange(() => { if (stopped) return; state.byPage = new Map(); state.mentionsOf = new Map(); state.indexed = false; state.node.clear(); reading.clear(); pagesRead = null; indexSize = 0; made.key = ''; later(0); indexLater(0); });
  onSettingsChange((now, before) => {
    if (stopped) return;
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); later(0); indexLater(0); }
  });
  // A click away from an empty draft line drops it; one with words keeps them.
  const away = event => { if (state.draft && !state.draft.name.trim() && !event.target.closest?.('.rf-tw-draft, .refinement-two-way-add, .rf-tw-add, .rf-tw-gadd')) { state.draft = null; closeAdd(); draw(host()); } };
  host().addEventListener('mousedown', away, true);
  onUnload(() => host().removeEventListener('mousedown', away, true));
  const escape = event => {
    if (event.key !== 'Escape' || event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    if (state.picked.size) { state.picked.clear(); draw(host()); }
    // The focus closes and hands the grey to its parent (0.4.442).
    else if (state.focus && state.dig.has(state.focus) && state.focus !== topStep()?.key) { event.preventDefault(); const key = state.focus; shared.outline.close(state.box?.querySelector(`.rf-ol-kids[data-key="${CSS.escape(key)}"]`), () => closeDig(key)); }
    // Nothing open under the top: one step back along the trail (0.4.463: Esc does one thing at a time).
    else if (state.steps.length) { event.preventDefault(); stepBack(state.steps.length - 2); }
  };
  host().addEventListener('keydown', escape);
  let pinFrame = 0;
  const onScroll = () => { cancelAnimationFrame(pinFrame); pinFrame = requestAnimationFrame(pinNow); };
  host().addEventListener('scroll', onScroll, { capture: true, passive: true });
  onUnload(() => host().removeEventListener('scroll', onScroll, { capture: true }));
  onUnload(() => host().removeEventListener('keydown', escape));
  onUnload(() => { steadyWidth(state.box?.ownerDocument, false); stopped = true; clearTimeout(timer); clearTimeout(indexTimer); clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait); if (settle.frame) cancelAnimationFrame(settle.frame); hidePeek(); closeAdd(); state.box?.remove(); state.box = null; });
  later(0);
  indexLater(1500);
}
function provide(core) {
  core.provide({ backwardsLabel, setBackwards, shownAtOtherEnd, setShownAtOtherEnd });
}
((window.Threads ||= {}).parts ||= []).push({ name: 'two-way', says: 'the rows on a page', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
