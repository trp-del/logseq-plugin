/* The sentence: how the words typed in the find line are read. A stretch of them that names a kind, a value the kind's
   nodes hold, a page, or a time is read as that, and the window pencils what it read above the stretch ("kind", the
   property's name, "when"); the other words narrow the rows by their letters, and the last of them light the choice they
   begin, which Tab completes in the sentence. "around May" widens May to the months beside it. Given the text and the
   names, this says what is there; nothing here reads the graph or draws. (The owner, 5 November 2026, from the Finding
   screen of after-kenya-hara.html: "I like the find feature".) */
(function () {
const Find = window.Find;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Words that join the parts and say nothing of their own: they neither narrow the rows nor light a choice.
const STOP = new Set(['with', 'about', 'and', 'the', 'a', 'an', 'of', 'on', 'in', 'at', 'for', 'by', 'to', 'from', 'or', 'around', 'near', 'roughly', 'circa', 'between', 'since', 'until', 'till', 'through', 'what', 'who', 'when', 'where', 'which', 'that', 'was', 'were', 'is', 'did', 'her', 'his', 'their', 'my', 'our']);
const AROUND = new Set(['around', 'about', 'near', 'roughly', 'circa']);
// The words that join the two ends of a period: "May to August", "between 2024 and 2025", "7–21 May".
const TO = new Set(['to', 'until', 'till', 'through', '-', '–', '—']);
// A name as it is looked up: lower case, one space between words, no quotes of two kinds.
const norm = text => String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
// The words with where they stand; a word's key drops the comma or stop that ends it.
const tokens = text => [...String(text).matchAll(/\S+/g)].flatMap(m => {
  const dash = m[0].match(/^([^\-–—]+)([\-–—])([^\-–—]+)$/);   // "May–August", "2024-2025", "7–21": the two ends and the dash between them
  const parts = dash ? [[dash[1], 0], [dash[2], dash[1].length], [dash[3], dash[1].length + 1]] : [[m[0], 0]];
  return parts.map(([w, off]) => ({ word: w, at: m.index + off, end: m.index + off + w.length, key: norm(w.replace(/[,;:!?]+$/, '')) }));
});

/* Days as the graph keeps them, yyyymmdd. */
const toInt = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const ymd = (y, m, d) => toInt(new Date(y, m - 1, d));   // the Date rolls a month 13 or a day 0 over
const monthOf = word => { const w = String(word).replace(/\.$/, ''); if (w.length < 3) return 0; const i = MONTHS.findIndex(m => m.startsWith(w)); return i < 0 ? 0 : i + 1; };
const yearOf = key => (/^(19|20)\d\d$/.test(key) ? Number(key) : 0);
const dayOf = key => { const m = key.match(/^(\d{1,2})(st|nd|rd|th)?$/); const d = m ? Number(m[1]) : 0; return d >= 1 && d <= 31 ? d : 0; };
/* A time among the words, from the word at i: "May", "May 2025", "7 May", "May 7th 2026", "2025", "today", "this month",
   "last year", "last week". { len, unit, y, m, d } or null. A month alone is the latest one up to today. */
function when(toks, i, today) {
  const t = toks[i]; if (!t) return null;
  const Y = today.getFullYear(), M = today.getMonth() + 1, D = today.getDate();
  if (t.key === 'today') return { len: 1, unit: 'day', y: Y, m: M, d: D };
  if (t.key === 'yesterday') { const d = new Date(Y, M - 1, D - 1); return { len: 1, unit: 'day', y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
  if ((t.key === 'this' || t.key === 'last') && toks[i + 1]) {
    const back = t.key === 'last' ? 1 : 0, u = toks[i + 1].key;
    if (u === 'year') return { len: 2, unit: 'year', y: Y - back, m: 1, d: 1 };
    if (u === 'month') { const d = new Date(Y, M - 1 - back, 1); return { len: 2, unit: 'month', y: d.getFullYear(), m: d.getMonth() + 1, d: 1 }; }
    if (u === 'week') { const d = new Date(Y, M - 1, D - 7 * back); return { len: 2, unit: 'week', y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
  }
  let m = monthOf(t.key);
  if (m) {
    let len = 1, d = 0, y = 0;
    if (toks[i + 1] && dayOf(toks[i + 1].key)) { d = dayOf(toks[i + 1].key); len = 2; }
    if (toks[i + len] && yearOf(toks[i + len].key)) { y = yearOf(toks[i + len].key); len++; }
    const yGiven = !!y; if (!y) y = m <= M ? Y : Y - 1;
    return d ? { len, unit: 'day', y, m, d, yGiven } : { len, unit: 'month', y, m, d: 1, yGiven };
  }
  if (dayOf(t.key) && toks[i + 1] && monthOf(toks[i + 1].key)) {
    const d = dayOf(t.key); m = monthOf(toks[i + 1].key);
    let len = 2, y = 0;
    if (toks[i + 2] && yearOf(toks[i + 2].key)) { y = yearOf(toks[i + 2].key); len++; }
    const yGiven = !!y; if (!y) y = m <= M ? Y : Y - 1;
    return { len, unit: 'day', y, m, d, yGiven };
  }
  if (yearOf(t.key)) return { len: 1, unit: 'year', y: yearOf(t.key), m: 1, d: 1, yGiven: true };
  return null;
}
/* The window a time names, and the band beside it that counts as near: a day is itself (around: a week either side), a week its
   seven days, a month itself (around: a month either side), a year itself (around: three months either side). Near reaches a
   month beyond a day or a week, three beyond a month, six beyond a year. */
function spanOf(w, around) {
  const { unit, y, m, d } = w;
  let from, to, near;
  if (unit === 'day') { const k = around ? 7 : 0; from = ymd(y, m, d - k); to = ymd(y, m, d + k); near = 30; }
  else if (unit === 'week') { from = ymd(y, m, d - 6); to = ymd(y, m, d); near = 30; }
  else if (unit === 'month') { const k = around ? 1 : 0; from = ymd(y, m - k, 1); to = ymd(y, m + k + 1, 0); near = 92; }
  else { const k = around ? 3 : 0; from = ymd(y, 1 - k, 1); to = ymd(y, 13 + k, 0); near = 183; }
  const nearFrom = ymd(Math.floor(from / 10000), Math.floor(from / 100) % 100, from % 100 - near), nearTo = ymd(Math.floor(to / 10000), Math.floor(to / 100) % 100, to % 100 + near);
  const label = unit === 'year' ? String(y) : unit === 'month' ? SHORT[m - 1] + ' ' + y : `${d} ${SHORT[m - 1]} ${y}`;
  return { from, to, nearFrom, nearTo, label: (around ? 'around ' : '') + label };
}

/* A period among the words, from the word at i: "May to August", "from May 2025 until Aug 2026", "between 2024 and 2025",
   "7–21 May", "since March" (up to today). { len, a, b } with a and b as when() gives them, or null. A bare day before the
   dash takes the month of the day after it; a start whose year was not said moves a year back when it would follow the end. */
function period(toks, i, today) {
  const t = toks[i]; if (!t) return null;
  if (t.key === 'since') { const a = when(toks, i + 1, today); if (!a) return null; const Y = today.getFullYear(), M = today.getMonth() + 1, D = today.getDate(); return { len: a.len + 1, a, b: { len: 0, unit: 'day', y: Y, m: M, d: D, yGiven: true }, since: true }; }
  const join = t.key === 'between' ? 'and' : null;
  const at = join ? i + 1 : i;
  let a = when(toks, at, today), aLen;
  if (a) aLen = a.len;
  else if (dayOf(toks[at]?.key) && TO.has(toks[at + 1]?.key)) { const b = when(toks, at + 2, today); if (!b || b.unit !== 'day') return null; a = { len: 1, unit: 'day', y: b.y, m: b.m, d: dayOf(toks[at].key), yGiven: b.yGiven }; aLen = 1; }
  if (!a) return null;
  const j = at + aLen, sep = toks[j]?.key;
  if (!(join ? sep === join : TO.has(sep))) return null;
  const b = when(toks, j + 1, today); if (!b) return null;
  if (!a.yGiven && toInt(new Date(b.y, b.m - 1, b.d)) < toInt(new Date(a.y, a.m - 1, a.d))) a.y--;
  return { len: j + 1 + b.len - i, a, b };
}
/* The window a period names: from the start of its first time to the end of its last; near reaches as far as the longer of
   the two. "around" widens both ends. The label: "May–Aug 2026", "7–21 May 2026", "2024–2025", "since Mar 2026". */
function periodSpan(p, around) {
  const A = spanOf(p.a, around), B = spanOf(p.b, around);
  const from = A.from, to = B.to;
  const nearDays = Math.max(p.a.unit === 'year' ? 183 : p.a.unit === 'month' ? 92 : 30, p.b.unit === 'year' ? 183 : p.b.unit === 'month' ? 92 : 30);
  const nearFrom = ymd(Math.floor(from / 10000), Math.floor(from / 100) % 100, from % 100 - nearDays), nearTo = ymd(Math.floor(to / 10000), Math.floor(to / 100) % 100, to % 100 + nearDays);
  let label;
  const { a, b } = p;
  if (p.since) label = 'since ' + A.label;
  else if (a.unit === 'year' && b.unit === 'year') label = `${a.y}–${b.y}`;
  else if (a.unit === 'month' && b.unit === 'month' && a.y === b.y) label = `${SHORT[a.m - 1]}–${SHORT[b.m - 1]} ${a.y}`;
  else if (a.unit === 'day' && b.unit === 'day' && a.y === b.y && a.m === b.m) label = `${a.d}–${b.d} ${SHORT[a.m - 1]} ${a.y}`;
  else if (a.unit === 'day' && b.unit === 'day' && a.y === b.y) label = `${a.d} ${SHORT[a.m - 1]}–${b.d} ${SHORT[b.m - 1]} ${a.y}`;
  else label = `${A.label}–${B.label}`;
  return { from, to, nearFrom, nearTo, label: (around ? 'around ' : '') + label, period: true };
}

/* read(text, names, today): what the sentence holds.
   names: { kinds: Map(name -> { id, uuid, title }), values: Map(name -> { name, key, label, uuid, type }) or null until a kind
   is read, pages: Map(name -> { id, uuid, title }), noteOf(uuid): what a page was last read as }.
   → { picks: [{ kind: 'tag' | 'who' | 'when', ... at, end }], spans: [{ from, to, note, cls }], words: the letters that narrow
   the rows, trail: the last words, which light a choice, trailFrom: where they start (text.length with none) }.
   The first stretch naming a kind is the kind; a later one is read as a page. The longest stretch wins at each word. */
function read(text, names, today = new Date()) {
  const toks = tokens(text);
  const picks = [], spans = [], rest = [];
  const has = kind => picks.some(p => p.kind === kind);
  let i = 0, lastRead = 0;
  while (i < toks.length) {
    let got = null;
    if (!has('when')) {
      const around = AROUND.has(toks[i].key) && toks[i + 1] ? 1 : 0;
      const p = period(toks, i + around, today);
      if (p) got = { len: p.len + around, pick: { kind: 'when', unit: p.a.unit, y: p.a.y, m: p.a.m, d: p.a.d, around: !!around, ...periodSpan(p, !!around) }, note: 'when', cls: 'fd-when' };
      if (!got) { const w = when(toks, i + around, today); if (w) got = { len: w.len + around, pick: { kind: 'when', ...w, around: !!around, ...spanOf(w, !!around) }, note: 'when', cls: 'fd-when' }; }
    }
    for (let len = Math.min(6, toks.length - i); len >= 1 && !got; len--) {
      const key = toks.slice(i, i + len).map(t => t.key).join(' ');
      if (!key) continue;
      const kind = !has('tag') && names.kinds?.get(key);
      if (kind) { got = { len, pick: { kind: 'tag', id: kind.id, uuid: kind.uuid, title: kind.title }, note: 'kind', cls: 'fd-kind' }; break; }
      const value = has('tag') && names.values?.get(key);
      if (value) { got = { len, pick: { kind: 'who', name: value.name, key: value.key, label: value.label, uuid: value.uuid, type: value.type }, note: value.name, cls: value.uuid ? 'fd-who' : 'fd-value' }; break; }
      const page = names.pages?.get(key);
      if (page) { got = { len, pick: { kind: 'who', uuid: page.uuid, id: page.id, label: page.title }, note: names.noteOf?.(page.uuid) || 'node', cls: 'fd-who' }; break; }
    }
    if (got) {
      const from = toks[i].at, to = toks[i + got.len - 1].end;
      got.pick.at = from; got.pick.end = to;   // where it stands in the text; a time's from and to are its days
      picks.push(got.pick); spans.push({ from, to, note: got.note, cls: got.cls });
      i += got.len; lastRead = i;
    } else { rest.push(toks[i]); i++; }
  }
  const words = rest.filter(t => t.key && !STOP.has(t.key)).map(t => t.key);
  for (const t of rest) if (STOP.has(t.key)) spans.push({ from: t.at, to: t.end, note: '', cls: 'fd-stop' });
  spans.sort((a, b) => a.from - b.from);
  // The trail: the words after the last thing read, less the joining words before them.
  let trail = toks.slice(lastRead);
  while (trail.length && STOP.has(trail[0].key)) trail.shift();
  return { picks, spans, words, trail: trail.map(t => t.key).filter(Boolean), trailFrom: trail.length ? trail[0].at : text.length };
}

Find.sentence = { read, tokens, norm, when, period, spanOf, STOP, SHORT };
})();
