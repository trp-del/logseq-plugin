/* Todo's reading and writing of the graph. Logseq's own tasks only: a node with a Status, its day from Deadline, else Scheduled.
   Every write goes through the one door (PluginDoor.write), and each change offers the one Undo. */
(function () {
const T = (window.Todo ||= {});
const Door = window.PluginDoor;
const { query, dates } = Door;
T.base = Door.base('todo', { prefix: 'Todo: ', leaves: { elements: '.td-own' } });

const STATUS = 'logseq.property/status', DEADLINE = 'logseq.property/deadline', SCHEDULED = 'logseq.property/scheduled';
/* Open: every status but Done and Canceled (the owner, 18 November 2026: every task that isn't complete, not only Todo and Doing),
   a status of the person's own too. */
const SHUT = new Set(['done', 'canceled', 'cancelled']);
const isOpen = s => !!s && !SHUT.has(s);
const DONE_FOR = 7 * 86400000;   // Done holds what was done in the last seven days
const statusOf = ident => String(ident || '').replace(/^:?logseq\.property\/status\./, '');
const live = '(not [?b :logseq.property/deleted-at _]) [?b :block/page ?p] (not [?p :logseq.property/deleted-at _])';

// A day's number from what a date property holds: a journal page's day, or a time in milliseconds (Logseq's datetime), read in this Mac's time.
const dayOfMs = ms => { const d = new Date(Number(ms)); return Number.isNaN(d.getTime()) ? 0 : dates.number(d); };

/* Task and every tag under it in the ontology, at any depth (a tag's Extends), as ids. */
async function taskTags() {
  const [pairs, [[task] = []]] = await Promise.all([
    query('[:find ?c ?p :where [?c :logseq.property.class/extends ?p]]'),
    query('[:find ?t :where [?t :db/ident :logseq.class/Task]]'),
  ]);
  if (task == null) return [];
  const kids = new Map();
  for (const [c, p] of pairs) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
  const seen = new Set([task]), walk = [task];
  while (walk.length) for (const c of kids.get(walk.pop()) || []) if (!seen.has(c)) { seen.add(c); walk.push(c); }
  return [...seen];
}

/* The tasks as the list shows them: open ones (every status but Done and Canceled) and those done in the last seven days.
   Canceled is left out, and so is a bullet with no words. A node tagged Task, or a tag under Task, whose Status is empty reads as Todo (empty: true) and nothing is
   written to it. Links in the words are read as their pages' names. */
async function read() {
  const tags = await taskTags();
  const [withStatus, empties, choices] = await Promise.all([
    query(`[:find ?b ?u ?w ?sid ?c ?up :where [?b :logseq.property/status ?s] [?s :db/ident ?sid] [?b :block/uuid ?u] [?b :block/title ?w] [(get-else $ ?b :block/created-at 0) ?c] [(get-else $ ?b :block/updated-at 0) ?up] ${live}]`),
    tags.length ? query(`[:find ?b ?u ?w ?c ?up :where [(ground [${tags.join(' ')}]) [?t ...]] [?b :block/tags ?t] (not [?b :logseq.property/status _]) [?b :block/uuid ?u] [?b :block/title ?w] [(get-else $ ?b :block/created-at 0) ?c] [(get-else $ ?b :block/updated-at 0) ?up] ${live}]`) : [],
    // Each status's name and icon as the graph keeps them, read afresh, so a circle follows an icon changed in Logseq.
    Door.statusChoices(query),
  ]);
  // Priority's values as the graph keeps them, Urgent first, each with its icon (the right-click menu's lines).
  T.db.priorities = (await query('[:find ?v ?ident ?t ?o ?icon :where [?v :block/closed-value-property ?p] [?p :db/ident :logseq.property/priority] [?v :block/title ?t] [(get-else $ ?v :db/ident "") ?ident] [(get-else $ ?v :block/order "") ?o] [(get-else $ ?v :logseq.property/icon "") ?icon]]'))
    .map(([id, ident, title, order, icon]) => ({ id: Number(id), name: String(ident || '').replace(/^:?logseq\.property\/priority\./, ''), title: String(title || ''), order: String(order || ''), icon: icon && typeof icon === 'object' ? icon : null }))
    .sort((a, b) => (a.order < b.order ? 1 : a.order > b.order ? -1 : b.id - a.id));
  const empty = new Set(empties.map(([b]) => b));
  const rows = withStatus.concat(empties.map(([b, u, w, c, up]) => [b, u, w, 'logseq.property/status.todo', c, up]));
  const ids = rows.map(([b]) => b), these = `[(ground [${ids.join(' ')}]) [?b ...]]`;
  const [pages, dayRefs, dayMs, tagRows, priorities] = ids.length ? await Promise.all([
    query(`[:find ?b ?pt ?jd ?pu :where ${these} [?b :block/page ?p] [?p :block/title ?pt] [?p :block/uuid ?pu] [(get-else $ ?p :block/journal-day 0) ?jd]]`),
    query(`[:find ?b ?a ?day :where ${these} (or (and [?b :logseq.property/deadline ?d] [(ground :deadline) ?a]) (and [?b :logseq.property/scheduled ?d] [(ground :scheduled) ?a])) [?d :block/journal-day ?day]]`),
    query(`[:find ?b ?a ?ms :where ${these} (or (and [?b :logseq.property/deadline ?ms] [(ground :deadline) ?a]) (and [?b :logseq.property/scheduled ?ms] [(ground :scheduled) ?a])) [(number? ?ms)] [(> ?ms 100000000000)]]`),
    // Its tags besides Task, for grouping by tag; its priority, for grouping by priority.
    query(`[:find ?b ?tt :where ${these} [?b :block/tags ?t] (not [?t :db/ident :logseq.class/Task]) [?t :block/title ?tt]]`),
    query(`[:find ?b ?pid :where ${these} [?b :logseq.property/priority ?p] [?p :db/ident ?pid]]`),
  ]) : [[], [], [], [], []];
  T.db.statuses = new Map(choices.map(c => [c.name, c]));
  const tagsOf = new Map(), priorityOf = new Map();
  for (const [b, title] of tagRows) { const list = tagsOf.get(b) || []; if (!list.includes(String(title))) list.push(String(title)); tagsOf.set(b, list); }
  for (const [b, pid] of priorities) priorityOf.set(b, String(pid || '').replace(/^:?logseq\.property\/priority\./, ''));
  const pageOf = new Map(pages.map(([b, title, jd, pu]) => [b, { title: String(title || ''), journal: Number(jd) || 0, uuid: String(pu || '') }]));
  const due = new Map();   // node → { deadline, scheduled, deadlineMs (the Deadline as written, for its Undo) }
  const put = (b, a, day, ms) => { if (!day) return; const k = Door.bare(a), d = due.get(b) || {}; if (!d[k] || day < d[k]) { d[k] = day; if (k === 'deadline') d.deadlineMs = ms || msOfDay(day); } due.set(b, d); };
  for (const [b, a, day] of dayRefs) put(b, a, Number(day));
  for (const [b, a, ms] of dayMs) put(b, a, dayOfMs(ms), Number(ms));
  const since = Date.now() - DONE_FOR, list = [];
  for (const [b, uuid, words, sid, created, updated] of rows) {
    // A Status that is there but empty holds Logseq's empty value: read as an empty Status, a Todo, as above.
    const blank = Door.isEmptyValue(sid), status = blank ? 'todo' : statusOf(sid);
    if (blank) empty.add(b);
    if (!String(words ?? '').trim()) continue;   // a bullet with no words is no task to show: never a blank row
    if (!isOpen(status) && !(status === 'done' && Number(updated) >= since)) continue;
    const d = due.get(b) || {};
    list.push({ id: b, uuid: String(uuid), raw: String(words || ''), status, empty: empty.has(b), day: d.deadline || d.scheduled || 0, deadline: d.deadline || 0, deadlineMs: d.deadlineMs || 0, scheduled: d.scheduled || 0, page: pageOf.get(b) || { title: '', journal: 0 }, tags: (tagsOf.get(b) || []).sort((x, y) => x.localeCompare(y)), priority: priorityOf.get(b) || '', created: Number(created) || 0, updated: Number(updated) || 0 });
  }
  await written(list);
  return list;
}
/* The words as Logseq shows them (the owner, 18 November 2026: "todo doesn't show md syntax … correctly"). Logseq keeps a link
   as [[uuid]], a tag as #[[uuid]] and a block reference as ((uuid)); each task gets
     text:  the words as written, each [[uuid]] as [[Name]] and each ((uuid)) as the referenced block's own words, for the
            row to draw (**bold**, *italic*, `code`, ~~struck~~, ==marked==, links and tags; view.js, wordsHtml);
     links: each linked page's name (lower case) to its uuid, so a press on a link opens that page;
     words: the same as plain words (no ** or brackets), for the menus, Undo notices and the tests. */
const UUID_REF = /(\[\[|\(\()([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\]\]|\)\))/gi;
const REF_OPEN = '\uE000', REF_CLOSE = '\uE001', REF_ANY = /\uE000(\d+)\uE001/g;   // a block reference's stand-in (private-use letters)
async function written(list) {
  const names = new Map(), blocks = new Set();   // uuid → title; the uuids that are blocks
  const read = async uuids => {
    const fresh = [...new Set(uuids)].filter(u => !names.has(u));
    if (!fresh.length) return;
    for (const [u, title] of await query(`[:find ?u ?t :where ${Door.uuidsIn('?u', fresh)} [?e :block/uuid ?u] [?e :block/title ?t]]`)) names.set(String(u).toLowerCase(), String(title));
    // Which of them are blocks, not pages: Logseq 2.0.2 keeps a block reference as [[uuid]] too, and draws it as the block's own
    // words, marks and links drawn (a page's name it draws as written).
    for (const [u] of await query(`[:find ?u :where ${Door.uuidsIn('?u', fresh)} [?e :block/uuid ?u] [?e :block/page _]]`)) blocks.add(String(u).toLowerCase());
  };
  const idsIn = text => [...String(text).matchAll(UUID_REF)].map(m => m[2].toLowerCase());
  await read(list.flatMap(t => idsIn(t.raw)));
  // A referenced block's own words may hold links too: one more read for those.
  await read([...names.values()].flatMap(idsIn));
  const links = new Map(); let refs = [];
  const swap = (text, depth = 0) => String(text).replace(UUID_REF, (m, open, u, close) => {
    const id = u.toLowerCase(), title = names.get(id);
    if (title == null) return open === '((' ? '' : m;   // a block or page gone from the graph: nothing, as Logseq draws it
    if (open === '((') return depth < 2 ? swap(title, depth + 1) : title.replace(UUID_REF, '');
    if (blocks.has(id)) {
      // A block reference: a stand-in the reader passes as plain words, its label (the block's words, its own links read too) and
      // the block to open kept beside it for the row to draw (view.js) and the plain words below.
      refs.push({ uuid: id, text: depth < 2 ? swap(title, depth + 1) : title.replace(UUID_REF, '') });
      return `[[${REF_OPEN}${refs.length - 1}${REF_CLOSE}]]`;
    }
    links.set(title.toLowerCase(), id);
    return `[[${title}]]`;
  });
  const inline = window.DbExport?.inline;
  for (const t of list) {
    links.clear(); refs = [];
    t.text = swap(t.raw).trim();
    t.links = new Map(links);
    t.refs = refs;
    const plain = text => (inline ? inline.words(text) : text.replace(/\[\[([^\]]+)\]\]/g, '$1')).replace(/#\[\[([^\]]+)\]\]/g, '#$1');
    t.words = plain(t.text).replace(REF_ANY, (m, n) => refs[n] ? plain(refs[n].text) : '').trim();
  }
}

let taskTag = null, statusTitles = null;
async function taskTagUuid() {
  if (taskTag) return taskTag;
  const [[u] = []] = await query('[:find ?u :where [?t :db/ident :logseq.class/Task] [?t :block/uuid ?u]]');
  if (!u) throw new Error('Logseq has no Task tag in this graph');
  return (taskTag = String(u));
}
// The status's own name in this graph (Logseq writes a status by its name): Todo, Doing, Done.
async function statusTitle(status) {
  if (!statusTitles) statusTitles = new Map((await query('[:find ?id ?t :where [?s :block/closed-value-property ?p] [?p :db/ident :logseq.property/status] [?s :db/ident ?id] [?s :block/title ?t]]')).map(([id, t]) => [statusOf(id), String(t)]));
  return statusTitles.get(status) || status.charAt(0).toUpperCase() + status.slice(1);
}
const forget = () => { taskTag = null; statusTitles = null; };

// A day's start in this Mac's time, as Logseq's date picker writes a deadline without a time.
const msOfDay = day => dates.date(day).getTime();

/* A new task on today's journal: the words as a bullet at the end of the day's page, tagged Task, status Todo, and the
   Deadline when a day was given. The day's page is made when the graph has none. Gives what its Undo needs. */
async function add(words, day) {
  const { id: pageId, made } = await dates.page(dates.today());
  const [[pageUuid] = []] = await query(`[:find ?u :where [${Number(pageId)} :block/uuid ?u]]`);
  if (!pageUuid) throw new Error('Today’s journal could not be found');
  const block = await Door.write.appendBlock(String(pageUuid), words);
  if (!block?.uuid) throw new Error('Logseq did not add the bullet');
  const uuid = String(block.uuid);
  await Door.write.addTag(uuid, await taskTagUuid());
  await Door.write.setValue(uuid, STATUS, await statusTitle('todo'));
  if (day) await Door.write.setValue(uuid, DEADLINE, msOfDay(day));
  return { uuid, made, stamp: await Door.write.madeStamp(uuid) };
}
// Its Undo: the bullet goes while it is as it was added, and the day's page with it when the add made the page and nothing else is on it.
async function unadd({ uuid, made, stamp }) {
  if (await Door.write.madeStamp(uuid) !== stamp) return 'kept';
  await Door.write.removeBlock(uuid);
  if (made) await Door.write.dropMade({ uuid: made });
  return true;
}
/* A task's status set; gives its Undo, which puts the status back while it is as this left it. before '' is a Status that was
   empty: its Undo empties it again, never writes Todo. */
async function setStatus(uuid, status, before) {
  await Door.write.setValue(uuid, STATUS, await statusTitle(status));
  return Door.write.guarded([[uuid, STATUS]], async () => before ? Door.write.setValue(uuid, STATUS, await statusTitle(before)) : Door.write.unsetValue(uuid, STATUS));
}

/* A Priority or a Deadline set from the right-click menu, or taken off (value null); gives its Undo, which puts back what was
   there (before: the value as written, or null for none) while it is as this left it. */
const PRIORITY = 'logseq.property/priority';
async function setOne(uuid, ident, value, before) {
  if (value == null) await Door.write.unsetValue(uuid, ident); else await Door.write.setValue(uuid, ident, value);
  return Door.write.guarded([[uuid, ident]], async () => before == null ? Door.write.unsetValue(uuid, ident) : Door.write.setValue(uuid, ident, before));
}
const setPriority = (uuid, title, before) => setOne(uuid, PRIORITY, title, before);
const setDeadline = (uuid, day, beforeMs) => setOne(uuid, DEADLINE, day ? msOfDay(day) : null, beforeMs || null);

/* A day in the words typed: "today", "tomorrow", "friday", "next week", "nov 20", "20 november", "by friday", "on the 4th"
   is left as words. Gives { day, words } with the day's words taken out, or null. Predictive's reader reads the day. */
const LEAD = /^(?:on|by|due|this|until|till)\s+/;
const RELATIVE = /^(?:today|tonight|tomorrow|tmr)$/;
const WHOLE_WEEKDAY = /^(?:next\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day$/;
const SHORT_WEEKDAY = /^(?:next\s+)?(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)$/;
function dayIn(text, today = new Date()) {
  const reader = window.Flow?.dates?.reader;
  if (!reader) return null;
  const tokens = String(text).trim().split(/\s+/).filter(Boolean);
  const read = phrase => {
    const lower = phrase.toLowerCase().replace(/[.,;:!?]+$/, ''), led = LEAD.test(lower), rest = lower.replace(LEAD, '');
    if (rest === 'next week') { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; }
    if (RELATIVE.test(rest) || WHOLE_WEEKDAY.test(rest) || ((led || /^next\s/.test(rest)) && SHORT_WEEKDAY.test(rest)) || (/\d/.test(rest) && /\p{L}{3}/u.test(rest)) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(rest)) return reader.parseDay(rest, today);
    return null;
  };
  for (let n = Math.min(4, tokens.length); n >= 1; n--) {
    for (let i = tokens.length - n; i >= 0; i--) {
      const date = read(tokens.slice(i, i + n).join(' '));
      if (!date || Number.isNaN(date.getTime())) continue;
      const words = [...tokens.slice(0, i), ...tokens.slice(i + n)].join(' ').replace(/\s+([.,;:!?])/g, '$1').trim();
      if (!words) continue;   // a day alone is no task
      return { day: dates.number(date), words };
    }
  }
  return null;
}

const GROUPINGS = ['Day', 'Page', 'Tag', 'Priority', 'Status'];
T.db = { statuses: new Map(), priorities: [], read, add, unadd, setStatus, setPriority, setDeadline, dayIn, forget, statusTitle, isOpen, GROUPINGS };
})();
