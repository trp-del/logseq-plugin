/* Searching by a sentence, decided. No Logseq here. Find's way of reading what is typed (the owner, 5 November 2026: "I like
   the find feature"; brought into Search on their choice of 26 November 2026, "What Search gains from Find"): a stretch of the
   words that names a kind, a value the kind's nodes hold, a page, or a time is read as that; the other words narrow by their
   letters, and the last of them light the choice they begin.
     read(text, names, today)   { picks: [{ kind: 'tag' | 'value' | 'page' | 'when', … , at, end }], words: [word], trail: [word] }
                                names: { kinds: Map(name -> tag), values: Map(name -> { prop, label }), pages: Map(name -> { uuid, title }) },
                                every name lower case; today: a Date
     when(words, i, today)      a time from the word at i: "May", "May 2025", "7 May", "Aug 5th 2026", "2025", "today", "this
                                month", "last year", "since March", "May to August"; { len, from, to, nearFrom, nearTo, label } or null
     norm(text)                 a name as it is looked up
   Days are numbers as Logseq keeps them (20261004). "around" widens a time; near reaches a month beyond a day or a week, three
   beyond a month, six beyond a year. */
(function (root) {
const Days = typeof module !== 'undefined' && module.exports ? require('./days.js') : root.PluginDoor.days;
const SHORT = Days.MONTHS;
// Words that join the parts and say nothing of their own: they neither narrow nor light a choice.
const STOP = new Set(['with', 'about', 'and', 'the', 'a', 'an', 'of', 'on', 'in', 'at', 'for', 'by', 'to', 'from', 'or', 'around', 'near', 'roughly', 'circa', 'between', 'since', 'until', 'till', 'through', 'what', 'who', 'when', 'where', 'which', 'that', 'was', 'were', 'is', 'my', 'me', 'i', 'during']);
const AROUND = new Set(['around', 'about', 'near', 'roughly', 'circa']);
const TO = new Set(['to', 'until', 'till', 'through', '-', '–', '—']);
const TITLES = ['dr.', 'dr', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms'];
const norm = text => String(text == null ? '' : text).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const toks = text => [...String(text).matchAll(/\S+/g)].map(m => ({ at: m.index, end: m.index + m[0].length, key: norm(m[0].replace(/[,;:!?]+$/, '')) }));
const num = (y, m, d) => { const at = new Date(y, m - 1, d); return at.getFullYear() * 10000 + (at.getMonth() + 1) * 100 + at.getDate(); };   // rolls month 13 or day 0 over
const shift = Days.shift;
/* One time, from the word at i: { len, unit, y, m, d, yGiven }. A month, a day of it and its year are read by core/days.js, the
   one reader of a day said in words; the periods (this month, last year, a year alone) are read here. */
function one(words, i, today) {
  const t = words[i]; if (!t) return null;
  const Y = today.getFullYear(), M = today.getMonth() + 1, D = today.getDate();
  if (t.key === 'today') return { len: 1, unit: 'day', y: Y, m: M, d: D };
  if (t.key === 'yesterday') { const at = new Date(Y, M - 1, D - 1); return { len: 1, unit: 'day', y: at.getFullYear(), m: at.getMonth() + 1, d: at.getDate() }; }
  if ((t.key === 'this' || t.key === 'last') && words[i + 1]) {
    const back = t.key === 'last' ? 1 : 0, unit = words[i + 1].key;
    if (unit === 'year') return { len: 2, unit: 'year', y: Y - back, m: 1, d: 1 };
    if (unit === 'month') { const at = new Date(Y, M - 1 - back, 1); return { len: 2, unit: 'month', y: at.getFullYear(), m: at.getMonth() + 1, d: 1 }; }
    if (unit === 'week') { const at = new Date(Y, M - 1, D - 7 * back); return { len: 2, unit: 'week', y: at.getFullYear(), m: at.getMonth() + 1, d: at.getDate() }; }
  }
  const got = Days.said(words, i);
  if (got) {
    const y = got.y || Days.yearFor(got.m, 1, Days.number(today), 'past');   // with no year, the latest such month up to today
    return got.d && !Days.real(y, got.m, got.d) ? null : { len: got.len, unit: got.d ? 'day' : 'month', y, m: got.m, d: got.d || 1, yGiven: !!got.y };   // "feb 30" is no day
  }
  if (Days.yearOf(t.key)) return { len: 1, unit: 'year', y: Days.yearOf(t.key), m: 1, d: 1, yGiven: true };
  return null;
}
const NEAR = { day: 30, week: 30, month: 92, year: 183 };
function span(w, around) {
  const { unit, y, m, d } = w;
  let from, to;
  if (unit === 'day') { const k = around ? 7 : 0; from = num(y, m, d - k); to = num(y, m, d + k); }
  else if (unit === 'week') { from = num(y, m, d - 6); to = num(y, m, d); }
  else if (unit === 'month') { const k = around ? 1 : 0; from = num(y, m - k, 1); to = num(y, m + k + 1, 0); }
  else { const k = around ? 3 : 0; from = num(y, 1 - k, 1); to = num(y, 13 + k, 0); }
  const label = unit === 'year' ? String(y) : unit === 'month' ? `${SHORT[m - 1]} ${y}` : `${SHORT[m - 1]} ${d}, ${y}`;
  return { from, to, near: NEAR[unit], label };
}
// A time or a period from the word at i, with "around" before it.
function when(words, i, today) {
  const around = AROUND.has(words[i]?.key) && words[i + 1] ? 1 : 0, at = i + around, t = words[at];
  if (!t) return null;
  const done = (len, from, to, near, label) => ({ len: len + around, from, to, nearFrom: shift(from, -near), nearTo: shift(to, near), label: (around ? 'around ' : '') + label });
  if (t.key === 'since') {
    const a = one(words, at + 1, today); if (!a) return null;
    const A = span(a, !!around), now = num(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return done(a.len + 1, A.from, now, A.near, `since ${A.label}`);
  }
  const join = t.key === 'between' ? 'and' : null, start = join ? at + 1 : at, a = one(words, start, today);
  if (a) {
    const j = start + a.len, sep = words[j]?.key;
    if (join ? sep === join : TO.has(sep)) {
      const b = one(words, j + 1, today);
      if (b) {
        if (!a.yGiven && num(b.y, b.m, b.d) < num(a.y, a.m, a.d)) a.y--;
        const A = span(a, !!around), B = span(b, !!around);
        const label = a.unit === 'month' && b.unit === 'month' && a.y === b.y ? `${SHORT[a.m - 1]}–${SHORT[b.m - 1]} ${a.y}` : `${A.label}–${B.label}`;
        return done(j + 1 + b.len - at, A.from, B.to, Math.max(A.near, B.near), label);
      }
    }
    if (join) return null;
    const A = span(a, !!around);
    return done(a.len, A.from, A.to, A.near, A.label);
  }
  return null;
}
// A name as a sentence says it: as typed, then its last word as one ("consultations"), then a person without the title before it.
function look(map, key) {
  if (!map) return null;
  const m = key.match(/^(.*?)(\S+)$/), head = m ? m[1] : '', w = m ? m[2] : key, said = [key];
  if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss')) {
    if (w.endsWith('ies')) said.push(head + w.slice(0, -3) + 'y');
    if (/(s|x|z|ch|sh)es$/.test(w)) said.push(head + w.slice(0, -2));
    said.push(head + w.slice(0, -1));
  }
  for (const k of said) if (map.has(k)) return map.get(k);
  for (const k of said) for (const title of TITLES) if (map.has(`${title} ${k}`)) return map.get(`${title} ${k}`);
  return null;
}
function read(text, names = {}, today = new Date()) {
  const words = toks(text), picks = [], rest = [];
  const has = kind => picks.some(pick => pick.kind === kind);
  let i = 0, lastRead = 0;
  while (i < words.length) {
    let got = null;
    if (!has('when')) { const w = when(words, i, today); if (w) got = { len: w.len, pick: { kind: 'when', from: w.from, to: w.to, nearFrom: w.nearFrom, nearTo: w.nearTo, label: w.label } }; }
    for (let len = Math.min(6, words.length - i); len >= 1 && !got; len--) {
      const key = words.slice(i, i + len).map(t => t.key).join(' ');
      if (!key || (len === 1 && STOP.has(key))) continue;
      const kind = !has('tag') && look(names.kinds, key);
      if (kind) { got = { len, pick: { kind: 'tag', tag: kind } }; break; }
      const value = has('tag') && look(names.values, key);
      if (value) { got = { len, pick: { kind: 'value', prop: value.prop, label: value.label } }; break; }
      const page = look(names.pages, key);
      if (page) { got = { len, pick: { kind: 'page', uuid: page.uuid, title: page.title } }; break; }
    }
    if (got) { got.pick.at = words[i].at; got.pick.end = words[i + got.len - 1].end; picks.push(got.pick); i += got.len; lastRead = i; }
    else { rest.push(words[i]); i++; }
  }
  const trail = words.slice(lastRead); while (trail.length && STOP.has(trail[0].key)) trail.shift();
  return { picks, words: rest.filter(t => t.key && !STOP.has(t.key)).map(t => t.key), trail: trail.map(t => t.key).filter(Boolean) };
}
// Whether what was read is more than plain words: a time with something it narrows, or a kind with something else.
const sentenceLike = got => { const kinds = got.picks.map(pick => pick.kind), more = got.picks.length > 1 || got.words.length > 0; return more && (kinds.includes('when') || kinds.includes('tag')); };
const api = { sentenceLike, read, when: (text, today = new Date()) => when(toks(text), 0, today), norm, look, SHORT };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).sentence = api;
})(typeof window !== 'undefined' ? window : globalThis);
