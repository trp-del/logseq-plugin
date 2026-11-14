/* Todo's reading and writing of the graph. Logseq's own tasks only: a node with a Status, its day from Deadline, else Scheduled.
   Every write goes through the one door (PluginDoor.write), and each change offers the one Undo. */
(function () {
const T = (window.Todo ||= {});
const Door = window.PluginDoor;
const { query, dates } = Door;
T.base = Door.base('todo', { prefix: 'Todo: ', leaves: { elements: '.td-own' } });

const STATUS = 'logseq.property/status', DEADLINE = 'logseq.property/deadline', SCHEDULED = 'logseq.property/scheduled';
const OPEN = new Set(['todo', 'doing']);
const DONE_FOR = 7 * 86400000;   // Done holds what was done in the last seven days
const statusOf = ident => String(ident || '').replace(/^:?logseq\.property\/status\./, '');
const live = '(not [?b :logseq.property/deleted-at _]) [?b :block/page ?p] (not [?p :logseq.property/deleted-at _])';

// A day's number from what a date property holds: a journal page's day, or a time in milliseconds (Logseq's datetime), read in this Mac's time.
const dayOfMs = ms => { const d = new Date(Number(ms)); return Number.isNaN(d.getTime()) ? 0 : dates.number(d); };

/* The tasks as the list shows them: open ones (Todo, Doing) and those done in the last seven days. Backlog, In Review and
   Canceled are left out. Links in the words are read as their pages' names. */
async function read() {
  const [rows, pages, dayRefs, dayMs, tagRows, priorities] = await Promise.all([
    query(`[:find ?b ?u ?w ?sid ?c ?up :where [?b :logseq.property/status ?s] [?s :db/ident ?sid] [?b :block/uuid ?u] [?b :block/title ?w] [(get-else $ ?b :block/created-at 0) ?c] [(get-else $ ?b :block/updated-at 0) ?up] ${live}]`),
    query(`[:find ?b ?pt ?jd :where [?b :logseq.property/status _] [?b :block/page ?p] [?p :block/title ?pt] [(get-else $ ?p :block/journal-day 0) ?jd]]`),
    query(`[:find ?b ?a ?day :where [?b :logseq.property/status _] (or (and [?b :logseq.property/deadline ?d] [(ground :deadline) ?a]) (and [?b :logseq.property/scheduled ?d] [(ground :scheduled) ?a])) [?d :block/journal-day ?day]]`),
    query(`[:find ?b ?a ?ms :where [?b :logseq.property/status _] (or (and [?b :logseq.property/deadline ?ms] [(ground :deadline) ?a]) (and [?b :logseq.property/scheduled ?ms] [(ground :scheduled) ?a])) [(number? ?ms)] [(> ?ms 100000000000)]]`),
    // Its tags besides Task, for grouping by tag; its priority, for grouping by priority.
    query(`[:find ?b ?tt :where [?b :logseq.property/status _] [?b :block/tags ?t] (not [?t :db/ident :logseq.class/Task]) [?t :block/title ?tt]]`),
    query(`[:find ?b ?pid :where [?b :logseq.property/status _] [?b :logseq.property/priority ?p] [?p :db/ident ?pid]]`),
  ]);
  const tagsOf = new Map(), priorityOf = new Map();
  for (const [b, title] of tagRows) { const list = tagsOf.get(b) || []; if (!list.includes(String(title))) list.push(String(title)); tagsOf.set(b, list); }
  for (const [b, pid] of priorities) priorityOf.set(b, String(pid || '').replace(/^:?logseq\.property\/priority\./, ''));
  const pageOf = new Map(pages.map(([b, title, jd]) => [b, { title: String(title || ''), journal: Number(jd) || 0 }]));
  const due = new Map();   // node → { deadline, scheduled }
  const put = (b, a, day) => { if (!day) return; const k = Door.bare(a), d = due.get(b) || {}; if (!d[k] || day < d[k]) d[k] = day; due.set(b, d); };
  for (const [b, a, day] of dayRefs) put(b, a, Number(day));
  for (const [b, a, ms] of dayMs) put(b, a, dayOfMs(ms));
  const since = Date.now() - DONE_FOR, list = [];
  for (const [b, uuid, words, sid, created, updated] of rows) {
    const status = statusOf(sid);
    if (!OPEN.has(status) && !(status === 'done' && Number(updated) >= since)) continue;
    const d = due.get(b) || {};
    list.push({ id: b, uuid: String(uuid), raw: String(words || ''), status, day: d.deadline || d.scheduled || 0, page: pageOf.get(b) || { title: '', journal: 0 }, tags: (tagsOf.get(b) || []).sort((x, y) => x.localeCompare(y)), priority: priorityOf.get(b) || '', created: Number(created) || 0, updated: Number(updated) || 0 });
  }
  // [[uuid]] in the words: the page's name.
  const ids = [...new Set(list.flatMap(t => [...t.raw.matchAll(/\[\[([0-9a-f-]{36})\]\]/gi)].map(m => m[1].toLowerCase())))];
  const names = new Map();
  if (ids.length) for (const [u, title] of await query(`[:find ?u ?t :where ${Door.uuidsIn('?u', ids)} [?e :block/uuid ?u] [?e :block/title ?t]]`)) names.set(String(u).toLowerCase(), String(title));
  for (const t of list) t.words = t.raw.replace(/\[\[([0-9a-f-]{36})\]\]/gi, (m, u) => names.get(u.toLowerCase()) ?? m).replace(/\[\[([^\]]+)\]\]/g, '$1').trim();
  return list;
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
// A task's status set; gives its Undo, which puts the status back while it is as this left it.
async function setStatus(uuid, status, before) {
  await Door.write.setValue(uuid, STATUS, await statusTitle(status));
  return Door.write.guarded([[uuid, STATUS]], async () => Door.write.setValue(uuid, STATUS, await statusTitle(before)));
}

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
T.db = { read, add, unadd, setStatus, dayIn, forget, statusTitle, OPEN, GROUPINGS };
})();
