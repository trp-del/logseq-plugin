/* How one list of Relations is shown, decided. No Logseq here.
   A row: { uuid, words, plain, tag, day, written, dates: { name: day }, held: { name: [text] }, changed, made }
     day      the day the row goes by when nothing is chosen (its Date, else the journal day it is written on)
     written  the journal day it is written on; dates: what it holds under each date property, Deadline and Scheduled too
     held     what it holds under each of the person's properties, as words; changed, made: times in milliseconds
   A view: { group, date, sort } kept for the list, and { kind } for this visit.
     group  '' | 'Tag' | 'Month' | a property's name        date  '' | 'Journal' | 'none' | a date property's name
     sort   '' (by day, newest first) | 'changed' | 'name' | 'tag'
     kind   '' (all) | a tag's name | '@none' (no tag) | '@new' (made since the page was last open)
   kinds(rows)              [{ name, n }]   the tags its rows hold, most first ('' is no tag)
   offers(rows)             { groups: [name], dates: [name], sorts: [name] }   what its View can be set to
   parse(words, today)      { words, upTo, said }   "chen on Oct 7", "up to 7 Oct", "until 2026-10-07": the words, and the day to turn back to
   shape(list, view, find, today)   what the list shows:
     { tabs, more, rows, groups, since, count, of, from, to, said, fresh }
     tabs    [{ kind, word, n, on }] the kinds a head names (All first, then the three most held), more: how many kinds beside them
     rows    the rows shown, in order, each with dayShown; groups: [{ key, name, rows, tag }] when a grouping is in force, else null
     since   the rows dated after the day turned back to (shown faint under a line); count, of: "8", "Consultations"
     from, to: the span of the shown rows' days; said: the settings that are not the default, as words; fresh: how many are new */
(function (root) {
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map(name => name.slice(0, 3).toLowerCase());
const tokens = text => String(text == null ? '' : text).toLowerCase().split(/\s+/).filter(Boolean);
function plural(name) {
  const word = String(name || '');
  if (!word || /s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(x|z|ch|sh)$/i.test(word)) return word + 'es';
  return word + 's';
}
function kinds(rows) {
  const n = new Map();
  for (const row of rows) n.set(row.tag || '', (n.get(row.tag || '') || 0) + 1);
  return [...n].map(([name, count]) => ({ name, n: count })).sort((a, b) => b.n - a.n || (!a.name) - (!b.name) || a.name.localeCompare(b.name));
}
const dayBy = (row, date) => date === 'none' ? 0 : !date ? (row.day || 0) : date === 'Journal' ? (row.written || 0) : ((row.dates || {})[date] || 0);
function offers(rows) {
  const dates = new Map(), held = new Map();
  for (const row of rows) {
    for (const name of Object.keys(row.dates || {})) dates.set(name, (dates.get(name) || 0) + 1);
    for (const [name, values] of Object.entries(row.held || {})) { if (!held.has(name)) held.set(name, { rows: 0, values: new Map() }); const at = held.get(name); at.rows++; for (const value of values) at.values.set(value, (at.values.get(value) || 0) + 1); }
  }
  const months = new Set(rows.map(row => Math.floor((row.day || 0) / 100)).filter(Boolean));
  const groups = [];
  if (kinds(rows).length > 1) groups.push('Tag');
  if (months.size > 1) groups.push('Month');
  // A property groups only where its groups would hold two nodes each on the whole, and most of the list holds it.
  for (const [name, at] of [...held].sort((a, b) => a[0].localeCompare(b[0]))) if (!dates.has(name) && at.values.size > 1 && at.rows >= rows.length / 2 && at.rows / at.values.size >= 2) groups.push(name);
  return { groups, dates: [...(rows.some(row => row.written) ? ['Journal'] : []), ...[...dates.keys()].sort((a, b) => a.localeCompare(b))], sorts: ['changed', 'name', ...(kinds(rows).length > 1 ? ['tag'] : [])] };
}
// A day typed in words: "Oct 7", "7 Oct", "October 7, 2026", "2026-10-07". With no year it is this year's, or last year's when this year's is still to come.
function dayIn(text, today) {
  const t = String(text).trim().toLowerCase();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  let name = '', date = 0, year = 0;
  if ((m = t.match(/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/))) [name, date, year] = [m[1], Number(m[2]), Number(m[3] || 0)];
  else if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?:,? (\d{4}))?$/))) [name, date, year] = [m[2], Number(m[1]), Number(m[3] || 0)];
  else return 0;
  const month = SHORT.indexOf(name.slice(0, 3)) + 1;
  if (!month || !MONTHS[month - 1].toLowerCase().startsWith(name) || date < 1 || date > 31) return 0;
  if (!year) { year = Math.floor(today / 10000); if (year * 10000 + month * 100 + date > today) year -= 1; }
  return year * 10000 + month * 100 + date;
}
function parse(text, today) {
  const m = String(text || '').match(/^(.*?)(?:^|\s)(?:on|up to|until)\s+(.+)$/i), upTo = m ? dayIn(m[2], today) : 0;
  return upTo ? { words: m[1].trim(), upTo } : { words: String(text || '').trim(), upTo: 0 };
}
const monthWord = (month, today) => `${MONTHS[month % 100 - 1]}${Math.floor(month / 100) === Math.floor(today / 10000) ? '' : ' ' + Math.floor(month / 100)}`;
const holds = (row, want) => {
  if (!want.length) return true;
  const own = String(row.plain ?? row.words ?? '').toLowerCase(), tag = String(row.tag || '').toLowerCase(), values = Object.values(row.held || {}).flat().map(value => String(value).toLowerCase());
  const day = row.day ? `${MONTHS[Math.floor(row.day / 100) % 100 - 1].toLowerCase()} ${row.day % 100} ${Math.floor(row.day / 10000)}` : '';
  return want.every(word => own.includes(word) || tag.includes(word) || day.split(' ').some(part => part.startsWith(word)) || values.some(value => value.includes(word)));
};
function shape(list, view = {}, find = {}, today = 0) {
  const all = list.rows || [], own = list.own || 0, since = view.since || 0;
  const every = kinds(all), isNew = row => !!since && (row.made || 0) > since;
  const fresh = all.filter(isNew).length;
  // A property four in five of the list hold: a node without it is marked ("no Topic?"). Only from five nodes up.
  const lacked = new Map();
  if (all.length >= 5) { const n = new Map(); for (const row of all) for (const name of Object.keys(row.held || {})) n.set(name, (n.get(name) || 0) + 1);
    const common = [...n].filter(([, count]) => count < all.length && count >= all.length * 0.8).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
    for (const row of all) { const name = common.find(one => !(row.held || {})[one]); if (name) lacked.set(row.uuid, name); } }
  // While words or a day narrow the list, its kinds count what was found, and the head says how many there are today.
  const found = all.filter(row => holds(row, tokens(find.words)) && !(find.upTo && dayBy(row, view.date || '') > find.upTo)), counted = find.words || find.upTo ? kinds(found) : every;
  const tabs = every.length > 1 ? [{ kind: '', word: 'All', n: found.length }, ...counted.slice(0, 3).map(one => ({ kind: one.name || '@none', word: one.name || 'No tag', n: one.n }))].map(tab => ({ ...tab, on: (view.kind || '') === tab.kind })) : [];
  let rows = !view.kind ? all : view.kind === '@new' ? all.filter(isNew) : all.filter(row => (row.tag || '@none') === view.kind);
  rows = rows.filter(row => holds(row, tokens(find.words)));
  /* A node found by what it holds under a property says where: that property and its values, under its line. Only from three
     letters (a number at once), so the first letters narrow the list without opening and shutting whole blocks of it. */
  const want = tokens(find.words), opens = String(find.words || '').trim().length >= 3 || /^\d+$/.test(String(find.words || '').trim());
  if (want.length && opens) rows = rows.map(row => ({ ...row, hits: Object.entries(row.held || {}).filter(([name, values]) => name !== list.own_name && values.some(value => want.some(word => String(value).toLowerCase().includes(word)))).map(([name, values]) => ({ name, values })) }));
  rows = rows.map(row => { const day = dayBy(row, view.date || ''); return { ...row, goesBy: day, dayShown: day && day !== own ? day : 0, lacks: lacked.get(row.uuid) || '' }; });
  const inSpan = row => !view.span || (row.goesBy >= view.span[0] && row.goesBy <= view.span[1]), inLane = row => !view.lane || view.lane.of(row) === view.lane.at;
  const timed = rows;
  rows = rows.filter(row => inSpan(row) && inLane(row));
  let later = find.upTo ? rows.filter(row => row.goesBy > find.upTo) : [];
  if (find.upTo) rows = rows.filter(row => !(row.goesBy > find.upTo));
  const byDay = (a, b) => (b.goesBy || 0) - (a.goesBy || 0), byWords = (a, b) => String(a.plain ?? a.words).localeCompare(String(b.plain ?? b.words)) || String(a.uuid).localeCompare(String(b.uuid));
  const order = view.sort === 'changed' ? (a, b) => (b.changed || 0) - (a.changed || 0) || byWords(a, b) : view.sort === 'name' ? byWords
    : view.sort === 'tag' ? (a, b) => String(a.tag || '￿').localeCompare(String(b.tag || '￿')) || byDay(a, b) || byWords(a, b) : (a, b) => byDay(a, b) || byWords(a, b);
  rows = [...rows].sort(order); later = [...later].sort(order);
  const oneTag = every.length === 1 && every[0].name ? every[0].name : (view.kind && !view.kind.startsWith('@') ? view.kind : '');
  rows = rows.map(row => ({ ...row, tagShown: !oneTag && !!row.tag && view.group !== 'Tag' }));
  /* The property that tells a list's nodes apart, said after each node's words where the head already names their one kind
     ("Amount 1413.56"): of what they hold, not the list's own property, never a node, a day or an address, a value of at
     most 24 letters, held by at least half of them with more than one value; the most held, then the fewest values. */
  if (oneTag && rows.length) {
    const held = new Map(), types = list.types || {};
    for (const row of rows) for (const [name, values] of Object.entries(row.held || {})) {
      if (name === list.own_name || /^(node|page|date|datetime|url)$/.test(types[name] || 'default') || !values.length || values.some(value => !value || String(value).length > 24)) continue;
      if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
      const at = held.get(name); at.nodes++; for (const value of values) at.values.add(value);
    }
    const best = [...held].filter(([, at]) => at.nodes * 2 >= rows.length && at.values.size > 1).sort((a, b) => b[1].nodes - a[1].nodes || a[1].values.size - b[1].values.size || a[0].localeCompare(b[0]))[0];
    if (best) rows = rows.map(row => { const text = ((row.held || {})[best[0]] || []).join(', '); return { ...row, tell: text && !(row.hits || []).some(hit => hit.name === best[0]) && !String(row.plain ?? row.words ?? '').toLowerCase().includes(text.toLowerCase()) ? `${best[0]} ${text}` : '' }; });
  }
  let groups = null;
  if (view.group) {
    const by = new Map();
    const put = (key, name, row, tag = false) => { if (!by.has(key)) by.set(key, { key, name, rows: [], tag }); by.get(key).rows.push(row); };
    for (const row of rows) {
      if (view.group === 'Tag') put(row.tag || '', row.tag || 'No tag', row, !!row.tag);
      else if (view.group === 'Month') { const month = Math.floor((row.goesBy || 0) / 100); put(String(month), month ? monthWord(month, today) : 'No day', row); }
      else { const values = (row.held || {})[view.group] || []; if (values.length) for (const value of values) put(value, value, row); else put('', `No ${view.group}`, row); }
    }
    groups = [...by.values()];
    if (view.group === 'Month') groups.sort((a, b) => Number(b.key) - Number(a.key));
    else groups.sort((a, b) => (!a.key) - (!b.key) || b.rows.length - a.rows.length || a.name.localeCompare(b.name));
  }
  const days = rows.map(row => row.dayShown).filter(Boolean), from = days.length ? Math.min(...days) : 0, to = days.length ? Math.max(...days) : 0;
  const said = [];
  if (view.group) said.push(view.group === 'Month' ? 'By month' : `By ${view.group === 'Tag' ? 'tag' : view.group}`);
  if (view.date) said.push(view.date === 'none' ? 'No date' : view.date);
  if (view.sort) said.push(view.sort === 'changed' ? 'Last changed first' : view.sort === 'name' ? 'By name' : 'By tag');
  return { tabs, more: Math.max(0, every.length - 3), rows, groups, since: later, count: rows.length, of: oneTag ? (rows.length === 1 ? oneTag : plural(oneTag)) : (rows.length === 1 ? 'node' : 'nodes'),
    from: from !== to ? from : 0, to: from !== to ? to : 0, said, fresh, total: all.length,
    dots: timed.filter(row => row.goesBy).map(row => ({ day: row.goesBy, uuid: row.uuid, title: String(row.plain ?? row.words ?? ''), off: !(inSpan(row) && inLane(row)), row })).sort((a, b) => a.day - b.day) };
}
// The lists of a page in the order the person gave them: the named ones first in that order, the rest as they came.
function ordered(lists, order = []) {
  const at = new Map(order.map((key, i) => [key, i]));
  return [...lists].map((list, i) => ({ list, i })).sort((a, b) => (at.has(a.list.key) ? at.get(a.list.key) : 1e6 + a.i) - (at.has(b.list.key) ? at.get(b.list.key) : 1e6 + b.i)).map(one => one.list);
}
// A list moved one place up or down among a page's lists: the new order of keys.
function moved(keys, key, by) {
  const out = [...keys], i = out.indexOf(key), j = i + by;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
const api = { kinds, offers, parse, shape, ordered, moved, dayIn };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).view = api;
})(typeof window !== 'undefined' ? window : globalThis);
