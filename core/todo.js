/* Tasks, grouped by when they are due. No Logseq here.
   groups(tasks, today) answers the lists a Todo shows, in order, empty ones left out:
     Today      due today or before it and still open, the longest overdue first (a row past its day is late: true)
     Coming up  due after today, the soonest first
     Any time   no day, by their words
   A task: { uuid, words, day } with day the day it is due (0 for none). Shaped as the lists of what points at a node are, so
   one piece draws both. */
(function (root) {
function groups(tasks, today, sort = 'day') {
  const by = { today: [], coming: [], any: [] };
  for (const task of tasks) (task.day ? (task.day <= today ? by.today : by.coming) : by.any).push(task);
  const words = (a, b) => String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  const dated = sort === 'name' ? words : (a, b) => a.day - b.day || words(a, b);
  by.today.sort(dated); by.coming.sort(dated); by.any.sort(words);
  const row = (task, shown) => ({ ...task, tagShown: !!task.tag && task.tag !== 'Task', dayShown: shown ? task.day : 0, late: !!task.day && task.day < today });   // every row here is a task: the tag Task says nothing
  return [
    { key: 'todo:today', kind: 'group', name: 'Today', tag: '', rows: by.today.map(task => row(task, task.day !== today)) },
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
/* A day said in a task's words, read before the task is made: dayIn("Call Sam by friday", today) -> { day, words: "Call Sam" },
   or null when the words name no day. Read: today, tomorrow; a weekday ("friday", "by friday", "next friday": the coming one,
   or the one after it when "next" is said of a day still in this week); "next week" (its Monday); "nov 20", "20 november"
   (this year, or the next when that day has passed). A short weekday ("fri", "sun") counts only after by, on, due or next,
   so "the sun" stays words. The phrase is taken out of the words. */
const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const toDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100), toDay = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
function dayIn(text, today) {
  const words = String(text || ''), from = toDate(today), plus = n => toDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n));
  const tries = [
    [/(?:^|\s)(?:(?:by|on|due)\s+)?(today|tomorrow)(?=$|[\s.,;!?])/i, m => plus(m[1].toLowerCase() === 'today' ? 0 : 1)],
    [/(?:^|\s)next\s+week(?=$|[\s.,;!?])/i, () => plus(((8 - from.getDay()) % 7) || 7)],
    [/(?:^|\s)(?:(by|on|due|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?=$|[\s.,;!?])/i, m => {
      const said = m[2].toLowerCase(), lead = (m[1] || '').toLowerCase();
      if (said.length <= 5 && !WEEK.includes(said) && !lead) return 0;   // a short one alone is a word
      const want = WEEK.findIndex(name => name.startsWith(said.slice(0, 3))), ahead = ((want - from.getDay() + 7) % 7) || 7;
      const toSunday = (7 - from.getDay()) % 7;   // days left in this week, Monday to Sunday
      return plus(lead === 'next' && ahead <= toSunday ? ahead + 7 : ahead);
    }],
    [/(?:^|\s)(?:(?:by|on|due)\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=$|[\s.,;!?])/i, m => monthDay(m[1], Number(m[2]))],
    [/(?:^|\s)(?:(?:by|on|due)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?=$|[\s.,;!?])/i, m => monthDay(m[2], Number(m[1]))],
  ];
  function monthDay(name, n) {
    const month = MON.indexOf(name.toLowerCase().slice(0, 3));
    if (month < 0 || n < 1 || n > 31) return 0;
    let d = new Date(from.getFullYear(), month, n);
    if (d.getMonth() !== month) return 0;
    if (toDay(d) < today) d = new Date(from.getFullYear() + 1, month, n);
    return toDay(d);
  }
  for (const [pattern, read] of tries) {
    const m = pattern.exec(words); if (!m) continue;
    const day = read(m); if (!day) continue;
    const rest = (words.slice(0, m.index) + ' ' + words.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
    return rest ? { day, words: rest } : null;   // a day alone is not a task
  }
  return null;
}
const api = { groups, by, dayIn };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).todo = api;
})(typeof window !== 'undefined' ? window : globalThis);
