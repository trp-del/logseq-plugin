/* Where nodes fall in time, laid out along a line. No Logseq here.
   layout({ dots, lanes, pick, lit, tall, today }) answers what a timeline draws, every place in per cent of the line:
     dots   [{ day, lane = 0, off, title }]   a node on its day (off: outside what is narrowed to, drawn faded)
     lanes  [{ name, count, on }] or null     a lane for each value; pick: [fromDay, toDay] or null; lit: a dot's index or null
     tall   a week's dots piled into a column, "+n" over a pile higher than five
   -> { year, start, end, months: [{ left, name }], today, pick: { left, width } | null, dots: [{ i, left, lane, pile, off, lit, day, title }], more: [{ left, lane, n }] }
   The line runs from the first node's month to today, or to the last day when that is later.
   week(day) the seven days around a day; dayAt(start, end, fraction) the day at a place along the line; words(day) "Oct 7, 2026". */
(function (root) {
const D = typeof module !== 'undefined' && module.exports ? require('./days.js') : root.PluginDoor.days;
const DAY = 864e5, MONTHS = D.MONTHS, CAP = 5, date = D.toDate, number = D.number;
const words = day => `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}, ${Math.floor(day / 10000)}`;
function layout({ dots = [], lanes = null, pick = null, lit = null, tall = false, today } = {}) {
  const all = [...dots.map(dot => dot.day), today].filter(Boolean), lo = date(Math.min(...all)), hi = date(Math.max(...all));
  const start = new Date(lo.getFullYear(), lo.getMonth(), 1).getTime(), end = new Date(hi.getFullYear(), hi.getMonth(), hi.getDate() + 1).getTime();
  const pc = t => Math.round(Math.max(0, Math.min(1, (t - start) / (end - start))) * 100000) / 1000, at = day => pc(date(day).getTime() + DAY / 2);
  const months = [];
  for (let m = new Date(start); m.getTime() < end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const room = (end - m.getTime()) / (end - start) > 0.07;   // a month starting in the last days keeps its tick, not its name
    months.push({ left: pc(m.getTime()), name: room ? MONTHS[m.getMonth()] + (m.getMonth() === 0 && m.getTime() > start ? ' ' + m.getFullYear() : '') : '' });
  }
  const pileOf = dot => `${lanes ? dot.lane || 0 : 0}:${Math.floor((date(dot.day).getTime() - start) / (7 * DAY))}`;
  const totals = new Map(), piles = new Map(), out = [], more = [];
  if (tall) for (const dot of dots) totals.set(pileOf(dot), (totals.get(pileOf(dot)) || 0) + 1);
  dots.forEach((dot, i) => {
    const lane = lanes ? dot.lane || 0 : 0, key = pileOf(dot), pile = tall ? (piles.get(key) || 0) : 0;
    if (tall) piles.set(key, pile + 1);
    const left = tall ? pc(start + (Number(key.split(':')[1]) * 7 + 3.5) * DAY) : at(dot.day);
    if (pile >= CAP) { if (pile === CAP) more.push({ left, lane, n: totals.get(key) - CAP }); return; }
    out.push({ i, left, lane, pile, off: !!dot.off, lit: lit === i, day: dot.day, title: dot.title || '' });
  });
  const last = number(new Date(end - DAY));
  const band = pick ? { left: pc(date(pick[0]).getTime()), width: Math.round((date(Math.min(pick[1], last)).getTime() + DAY - date(pick[0]).getTime()) / (end - start) * 100000) / 1000 } : null;
  return { year: new Date(start).getFullYear(), start, end, months, today: at(today), pick: band, dots: out, more };
}
const week = day => { const t = date(day); return [number(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 3)), number(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 3))]; };
const dayAt = (start, end, fraction) => number(new Date(start + Math.max(0, Math.min(1, fraction)) * (end - start - 1)));
// The lanes of a list by a property: one for each of its three most held values, then "others".
function lanesBy(rows, name) {
  const n = new Map();
  for (const row of rows) for (const value of (row.held || {})[name] || []) n.set(value, (n.get(value) || 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([value]) => value);
  const laneOf = row => { const at = top.findIndex(value => ((row.held || {})[name] || []).includes(value)); return at < 0 ? top.length : at; };
  const counts = new Array(top.length + 1).fill(0);
  for (const row of rows) counts[laneOf(row)]++;
  return { names: [...top, 'others'], counts, laneOf };
}
const api = { layout, week, dayAt, words, lanesBy };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).time = api;
})(typeof window !== 'undefined' ? window : globalThis);
