/* Todo from outside Logseq, for the Alfred workflow's Todo panel (outside.js asks; 18 November 2026). The same list the Todo page
   draws, from the same reading and the same grouping, and the same writes with their Undo.
     list()                       → { by, parts: [{ head, rows: [{ uuid, words, status, day, late, page }] }], statuses }
     add({ words })               → { uuid, words, day }      a day in the words ("by friday") is its Deadline, as on the page
     status({ uuid, status })     → { uuid, status }
     undo({ uuid })               → { undone }                                                                               */
(function () {
const T = window.Todo, Door = window.PluginDoor;
const undos = new Map();
const rowOf = (t, today) => ({ uuid: t.uuid, words: t.words || t.raw, status: T.app.shown(t), day: t.day ? T.view.dayWords(t.day, today) : '', late: Boolean(t.day && t.day < today), page: t.page.journal ? '' : t.page.title });
async function list() {
  T.app.tasks = await T.db.read();
  const today = Door.dates.today(), { parts } = T.app.groups();
  return {
    by: T.app.by(),
    parts: parts.map(p => ({ head: p.head, none: p.rows.length ? '' : p.none || '', rows: p.rows.slice(0, 30).map(t => rowOf(t, today)), more: Math.max(0, p.rows.length - 30) })),
    statuses: [...T.db.statuses.values()].map(s => ({ name: s.name, title: s.title })),
  };
}
async function add({ words = '' } = {}) {
  const read = T.db.dayIn(String(words)) || { day: 0, words: String(words).trim() };
  if (!read.words) throw new Error('There are no words for the task');
  const made = await T.db.add(read.words, read.day || 0);
  undos.set(made.uuid, () => T.db.unadd(made));
  return { uuid: made.uuid, words: read.words, day: read.day ? T.view.dayWords(read.day) : '' };
}
async function status({ uuid, status: to } = {}) {
  const t = (T.app.tasks.length ? T.app.tasks : await T.db.read()).find(x => x.uuid === uuid);
  const back = await T.db.setStatus(uuid, to, t ? (t.empty ? '' : T.app.shown(t)) : 'todo');
  undos.set(uuid, back);
  T.app.status.set(uuid, to);
  return { uuid, status: to };
}
async function undo({ uuid } = {}) {
  const run = undos.get(String(uuid || ''));
  if (!run) throw new Error('That can no longer be taken back from here: use Undo in Logseq');
  undos.delete(String(uuid));
  await run();
  T.app.status.delete(String(uuid));
  return { undone: true };
}
T.outside = { list, add, status, undo };
})();
