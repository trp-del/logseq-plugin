/* Tasks, grouped by when they are due, narrowed to typed words, and the day said in a new task's words. No Logseq here.
   groups(tasks, today) answers the lists a Todo shows, in order, empty ones left out:
     Overdue    due before today and still open, the longest overdue first, each saying its day (late: true)
     Today      due today
     Coming up  due after today, the soonest first
     Any time   no day, by their words
   A task: { uuid, words, day } with day the day it is due (0 for none). Shaped as the lists of what points at a node are, so
   one piece draws both. */
(function (root) {
const node = typeof module !== 'undefined' && module.exports;
const D = node ? require('./days.js') : root.PluginDoor.days, W = node ? require('./words.js') : root.PluginDoor.words;
function groups(tasks, today, sort = 'day') {
  const by = { late: [], today: [], coming: [], any: [] };
  for (const task of tasks) (task.day ? (task.day < today ? by.late : task.day === today ? by.today : by.coming) : by.any).push(task);
  const words = (a, b) => String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  const dated = sort === 'name' ? words : (a, b) => a.day - b.day || words(a, b);
  by.late.sort(dated); by.today.sort(dated); by.coming.sort(dated); by.any.sort(words);
  const row = (task, shown) => ({ ...task, tagShown: !!task.tag && task.tag !== 'Task', dayShown: shown ? task.day : 0, late: !!task.day && task.day < today });   // every row here is a task: the tag Task says nothing
  return [
    { key: 'todo:late', kind: 'group', name: 'Overdue', tag: '', rows: by.late.map(task => row(task, true)) },
    { key: 'todo:today', kind: 'group', name: 'Today', tag: '', rows: by.today.map(task => row(task, false)) },
    { key: 'todo:coming', kind: 'group', name: 'Coming up', tag: '', rows: by.coming.map(task => row(task, true)) },
    { key: 'todo:any', kind: 'group', name: 'Any time', tag: '', rows: by.any.map(task => row(task, false)) },
  ].filter(list => list.rows.length);
}
/* The same tasks under another heading: by('status' | 'tag' | 'page', tasks, today, names) with names(task) the heading a task
   stands under ('' for none, which goes last under its own word). Every row then says its day, late first. */
function by(what, tasks, today, name, order = [], sort = 'day') {
  const none = { status: 'No status', tag: 'No tag', page: 'No page', parent: 'On no node', priority: 'No priority' }[what] || 'Other', lists = new Map();
  for (const task of tasks) { const key = name(task) || ''; if (!lists.has(key)) lists.set(key, []); lists.get(key).push(task); }
  const rank = key => key === '' ? 1e9 : order.includes(key) ? order.indexOf(key) : 1e6;
  const words = (a, b) => String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  return [...lists.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(key => ({ key: `todo:${what}:${key}`, kind: 'group', name: key || none, tag: '',
    rows: lists.get(key).sort((a, b) => (sort === 'name' ? 0 : (a.day || 99999999) - (b.day || 99999999)) || words(a, b)).map(task => ({ ...task, tagShown: what !== 'tag' && !!task.tag && task.tag !== 'Task', dayShown: task.day, late: !!task.day && task.day < today })) }));
}
/* The tasks a line of typed words narrows a list to: holding(tasks, typed, names) answers those whose words hold every word
   typed, in any case. The words are read as a person reads them (core/words.js): a link is the name of the node it leads to
   (names: uuid -> name), never its id, so "chen" finds "Call [[…]] back" where the link leads to Dr. Mei Chen. */
function holding(tasks, typed, names) {
  const wanted = String(typed || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!wanted.length) return tasks;
  return tasks.filter(task => { const words = W.plain(task.words, names).toLowerCase(); return wanted.every(word => words.includes(word)); });
}
/* The heading a task stands under by where it sits: under('page' | 'parent', task, names, today), with task.at the steps
   read.where answers (its page, then the bullet it is under). A journal page is said as its day; any other step by its words
   as a person reads them, a link in them the name of its node. '' for a task that sits nowhere known. */
function under(what, task, names, today) {
  const at = task.at || [], step = what === 'page' ? at[0] : at[at.length - 1];
  return !step ? '' : what === 'page' && step.day ? D.short(step.day, today) : W.plain(step.words, names);
}
/* A day said in a task's words, read before the task is made: dayIn("Call Sam by friday", today) -> { day, words: "Call Sam" },
   or null when the words name no day. Read: today, tomorrow; a weekday ("friday", "by friday", "next friday": the coming one,
   or the one after it when "next" is said of a day still in this week); "next week" (its Monday); "nov 20", "20 november"
   (this year, or the next when that day has passed); "3 december 2027", "nov 20, 2026": a year said with the day is its
   year and leaves the words with it, but a number that would put the day in a year gone by is no task's year and stays in the
   words ("Order masks nov 20 2000"). A short weekday ("fri", "sun") counts only after by, on, due or next,
   so "the sun" stays words. The phrase is taken out of the words.
   What a month and a day of it are is asked of core/days.js, the one reader of a day said in words: "Decadron 4 mg" and
   "Mark 2 times" hold no day, and stay in the words whole. */
const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function dayIn(text, today) {
  const words = String(text || ''), from = D.toDate(today), plus = n => D.shift(today, n);
  // The words without the phrase from at to end; a day alone is not a task.
  const without = (at, end, day) => { const rest = (words.slice(0, at) + ' ' + words.slice(end)).replace(/\s+/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim(); return rest ? { day, words: rest } : null; };
  const tries = [
    [/(?:^|\s)(?:(?:by|on|due)\s+)?(today|tomorrow)(?=$|[\s.,;!?])/gi, m => plus(m[1].toLowerCase() === 'today' ? 0 : 1)],
    [/(?:^|\s)next\s+week(?=$|[\s.,;!?])/gi, () => plus(((8 - from.getDay()) % 7) || 7)],
    [/(?:^|\s)(?:(by|on|due|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?=$|[\s.,;!?])/gi, m => {
      const said = m[2].toLowerCase(), lead = (m[1] || '').toLowerCase();
      if (said.length <= 5 && !WEEK.includes(said) && !lead) return 0;   // a short one alone is a word
      const want = WEEK.findIndex(name => name.startsWith(said.slice(0, 3))), ahead = ((want - from.getDay() + 7) % 7) || 7;
      const toSunday = (7 - from.getDay()) % 7;   // days left in this week, Monday to Sunday
      return plus(lead === 'next' && ahead <= toSunday ? ahead + 7 : ahead);
    }],
  ];
  // Each place a phrase could stand is tried, so a word that only looks like one ("sat with") does not hide a day said later.
  for (const [pattern, read] of tries) for (const m of words.matchAll(pattern)) { const day = read(m); if (day) return without(m.index, m.index + m[0].length, day); }
  // A month and a day of it: "nov 20" wherever it stands, then "20 november"; with the year said after it, this one or a later one.
  const typed = [...words.matchAll(/\S+/g)].map(m => ({ at: m.index, end: m.index + m[0].length, key: m[0] }));
  for (const monthFirst of [true, false]) for (let i = 0; i < typed.length; i++) {
    const got = !!D.monthOf(typed[i].key) === monthFirst && D.said(typed, i), year = got && got.y >= Math.floor(today / 10000) ? got.y : 0;
    const day = got && got.d ? D.real(year || D.yearFor(got.m, got.d, today, 'coming'), got.m, got.d) : 0;
    if (!day) continue;
    const first = typed[i > 0 && /^(by|on|due)$/i.test(typed[i - 1].key) ? i - 1 : i], last = typed[i + (year ? got.len : got.bare) - 1], marks = (last.key.match(/[.,;:!?]+$/) || [''])[0];
    return without(first.at, last.end - marks.length + (!monthFirst && !year && marks[0] === '.' ? 1 : 0), day);   // the marks after the phrase stay, but for the full stop of a month cut short ("3 dec.")
  }
  return null;
}
const api = { groups, by, holding, under, dayIn };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).todo = api;
})(typeof window !== 'undefined' ? window : globalThis);
