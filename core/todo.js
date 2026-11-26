/* Tasks, grouped by when they are due. No Logseq here.
   groups(tasks, today) answers the lists a Todo shows, in order, empty ones left out:
     Today      due today or before it and still open, the longest overdue first (a row past its day is late: true)
     Coming up  due after today, the soonest first
     Any time   no day, by their words
   A task: { uuid, words, day } with day the day it is due (0 for none). Shaped as the lists of what points at a node are, so
   one piece draws both. */
(function (root) {
function groups(tasks, today) {
  const by = { today: [], coming: [], any: [] };
  for (const task of tasks) (task.day ? (task.day <= today ? by.today : by.coming) : by.any).push(task);
  const words = (a, b) => String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  by.today.sort((a, b) => a.day - b.day || words(a, b)); by.coming.sort((a, b) => a.day - b.day || words(a, b)); by.any.sort(words);
  const row = (task, shown) => ({ ...task, tagShown: !!task.tag && task.tag !== 'Task', dayShown: shown ? task.day : 0, late: !!task.day && task.day < today });   // every row here is a task: the tag Task says nothing
  return [
    { key: 'todo:today', kind: 'group', name: 'Today', tag: '', rows: by.today.map(task => row(task, task.day !== today)) },
    { key: 'todo:coming', kind: 'group', name: 'Coming up', tag: '', rows: by.coming.map(task => row(task, true)) },
    { key: 'todo:any', kind: 'group', name: 'Any time', tag: '', rows: by.any.map(task => row(task, false)) },
  ].filter(list => list.rows.length);
}
/* The same tasks under another heading: by('status' | 'tag' | 'page', tasks, today, names) with names(task) the heading a task
   stands under ('' for none, which goes last under its own word). Every row then says its day, late first. */
function by(what, tasks, today, name, order = []) {
  const none = { status: 'No status', tag: 'No tag', page: 'No page' }[what] || 'Other', lists = new Map();
  for (const task of tasks) { const key = name(task) || ''; if (!lists.has(key)) lists.set(key, []); lists.get(key).push(task); }
  const rank = key => key === '' ? 1e9 : order.includes(key) ? order.indexOf(key) : 1e6;
  const words = (a, b) => String(a.words).localeCompare(String(b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  return [...lists.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(key => ({ key: `todo:${what}:${key}`, kind: 'group', name: key || none, tag: '',
    rows: lists.get(key).sort((a, b) => (a.day || 99999999) - (b.day || 99999999) || words(a, b)).map(task => ({ ...task, tagShown: what !== 'tag' && !!task.tag && task.tag !== 'Task', dayShown: task.day, late: !!task.day && task.day < today })) }));
}
const api = { groups, by };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).todo = api;
})(typeof window !== 'undefined' ? window : globalThis);
