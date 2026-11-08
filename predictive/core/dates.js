/* The plain-language reader: dates and numbers that are literally in the words ("on Friday", "in two weeks", "cycle 5").
   Ported from logseq-db-refinements (parts/shadow-rules.js stage E, parts/model.js parseDay) with the language lifted
   out into a locale object, so a graph written in another language gets its own words by adding a locale; nothing else
   changes. English ships; set `locale` in the plugin's settings once another exists (README, "Other languages").

   Everything is pure and counted from a `base` day (the journal day the bullet is written on, else today). */
(function () {
const { cleanWords } = (typeof require === 'function' && typeof module !== 'undefined') ? require('./text.js') : window.Flow.text;

const en = {
  name: 'en',
  weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],   // index = Date.getDay()
  months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  relative: { today: 0, tomorrow: 1, tmr: 1, yesterday: -1 },
  next: 'next',
  // A short weekday ("fri") counts only after one of these ("on fri"); a whole name ("friday") counts anywhere.
  before: ['on', 'this', 'by', 'until', 'till'],
  weekdayPattern: '(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?',
  wholeWeekdaySuffix: 'day',
  // Whole month names only: "5 marathons" is not March 5. The lookahead keeps a month a word.
  monthPattern: '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?=\\s)',
  ambiguousMonth: 'may',                  // a month only where a date can end: "Dose 4 may need lowering" is the verb
  the: 'the',
  ordinalSuffix: '(?:st|nd|rd|th)',
  dayPrepositions: ['on', 'by', 'until', 'till', 'from', 'before', 'after', 'for'],   // "on the 4th"
  of: 'of',
  // After a bare "the 4th": the end of the words, a time, or a small joining word. "on the 2nd floor" is a floor.
  afterDay: ['at', 'in', 'and', 'then', 'for', 'so', 'but', 'or', 'to', 'when', 'with', 'please', 'until', 'till'],
  inWord: 'in',
  units: { day: 1, week: 7, fortnight: 14 },       // "in 3 days", matched by the word's start
  unitPattern: 'days?|weeks?|fortnights?',
  small: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  // Words that point ahead without naming a day: today's date would be wrong for them.
  ahead: /\b(?:next|tomorrow|later|soon|upcoming|coming up|in (?:a|an|\d+|a few|two|three) (?:days?|weeks?|months?|fortnight))\b/i,
  // Words that tell of what has been: a weekday among them may be the one gone or the one coming ("was moved to Friday").
  past: /\b(?:was|were|had|did|went|saw|came|got|felt|showed|told|last)\b/i,
  numberJoiners: ['and', 'or', 'to', '&', '-'],     // "cycles 3 and 4" names two numbers
  numberMarks: ['no\\.?\\s*', '#'],                 // "cycle no. 5", "cycle #5"
  /* Basic meanings: what a value in the words is, and which property's name says it takes such a value. A property is matched by a
     word of its own name, so "Amount", "Cost", "Total paid" and "Due date" each find theirs, in any graph.
     money: a sum with its currency ("$84", "€12.50", "40 dollars"), for a number property named for money.
     deadline: a day right after a word that says by when ("due Friday", "due by the 4th", "deadline in two weeks"), for a date named
     for a deadline (Logseq's own Deadline too). scheduled: a day right after a word that says it is set for then ("scheduled for
     Friday"), for Logseq's Scheduled or a date named so. */
  money: {
    before: '[$€£¥₹]|(?:us|usd|eur|gbp|chf|cad|aud)\\s?\\$?',
    after: '[$€£¥₹]|dollars?|bucks|euros?|pounds?|quid|usd|eur|gbp|chf|cad|aud|yen|francs?|rupees?',
    names: ['amount', 'cost', 'costs', 'price', 'fee', 'fees', 'paid', 'payment', 'pay', 'total', 'spent', 'spend', 'charge', 'charged', 'bill', 'billed',
      'budget', 'expense', 'expenses', 'balance', 'refund', 'refunded', 'owed', 'owe', 'debt', 'fare', 'rent', 'copay', 'co-pay', 'deposit', 'sum', 'invoice', 'salary', 'income'],
  },
  deadline: { words: ['due', 'deadline', 'by'], not: ['to'], names: ['deadline', 'due'] },   // "due to the pain" is a cause
  scheduled: { words: ['scheduled for', 'scheduled on', 'scheduled', 'planned for', 'booked for', 'set for'], names: ['scheduled', 'schedule', 'planned'] },
};

const dayAfter = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; };
// A date only when the day exists: 30 February is no day (it must not roll over into March).
const exactDay = (year, month, day) => { const d = new Date(year, month, day); return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null; };
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const asDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A day and month with no year that went by at most this long ago is that day: a note written after the fact. Further
// back, the words can only be about next year's.
const JUST_WENT = 56;

function makeReader(locale = en) {
  const L = locale;
  const weekdayIndex = word => L.weekdays.findIndex(d => d.startsWith(word) && word.length >= 2);
  const alt = list => `(?:${list.map(escape).join('|')})`;
  const AFTER_DAY = `(?=\\s*$|\\s+(?:${L.afterDay.join('|')}|\\d))`;
  const smallWords = Object.keys(L.small).join('|');

  // A day typed for a Date: today, tomorrow, yesterday, a weekday (the next one after today), "next" and a weekday (a
  // week later), +3 or -2 (days from today), 2026-10-23, 23 oct, oct 23 (this year, or next year when that day passed).
  function parseDay(text, today) {
    const t = String(text).trim().toLowerCase();
    if (!t) return null;
    if (t in L.relative) return dayAfter(today, L.relative[t]);
    let m = t.match(/^([+-])(\d{1,3})$/);
    if (m) return dayAfter(today, (m[1] === '-' ? -1 : 1) * Number(m[2]));
    m = t.match(new RegExp(`^(${escape(L.next)}\\s+)?(\\p{L}{2,12})$`, 'u'));
    if (m) {
      const wd = weekdayIndex(m[2]);
      if (wd >= 0) { let n = (wd - today.getDay() + 7) % 7 || 7; if (m[1]) n += 7; return dayAfter(today, n); }
    }
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return exactDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = t.match(/^(\d{1,2})\s+(\p{L}{3,12})\.?(?:\s+(\d{4}))?$/u) || t.match(/^(\p{L}{3,12})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/u);
    if (m) {
      const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
      const month = L.months.findIndex(name => name.startsWith(b));
      if (month < 0) return null;
      let date = exactDay(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(a));
      if (!m[3] && date && date < today) date = exactDay(today.getFullYear() + 1, month, Number(a));
      return date;
    }
    return null;
  }

  // The days the words name, as day numbers, each once, counted from `base`: a weekday is the coming one, and today's own
  // weekday, with no word that points ahead, is none (today, a week ago or a week on: the words cannot say), and so is any
  // weekday in words that tell of what has been; "the 4th" the
  // next 4th; a day and a month the next such day, or the one that just went (JUST_WENT); "in two weeks".
  function daysInWords(text, base) {
    const words = ' ' + cleanWords(text).toLowerCase().replace(/[.,;:!?()]/g, ' ') + ' ', today = asDate(base), found = new Set();
    const add = date => { if (date && !Number.isNaN(date.getTime())) found.add(dayNumber(date)); };
    const pointsAhead = L.ahead.test(text), tellsPast = !pointsAhead && L.past.test(text);
    for (const [, word] of words.matchAll(new RegExp(`\\s(${Object.keys(L.relative).join('|')})\\s`, 'g'))) add(parseDay(word, today));
    for (const [, next, on, day] of words.matchAll(new RegExp(`\\s(?:(${escape(L.next)})\\s+|(${L.before.map(escape).join('|')})\\s+)?(${L.weekdayPattern})(?=\\s)`, 'g'))) {
      if (!next && !on && !day.endsWith(L.wholeWeekdaySuffix)) continue;
      const date = parseDay(`${next ? L.next + ' ' : ''}${day}`, today);
      if (next || (!tellsPast && (pointsAhead || !date || !sameDay(date, dayAfter(today, 7))))) add(date);
    }
    for (const [, n] of words.matchAll(new RegExp(`\\s(?:${L.dayPrepositions.map(escape).join('|')}|${L.weekdayPattern})\\s+${escape(L.the)}\\s+(\\d{1,2})${L.ordinalSuffix}${AFTER_DAY}`, 'g'))) {
      const d = Number(n);
      if (d < 1 || d > 31) continue;
      let date = new Date(today.getFullYear(), today.getMonth(), d);
      if (date.getDate() !== d || date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, d);
      if (date.getDate() === d) add(date);
    }
    const dayMonth = (d, month, rest) => {
      if (month === L.ambiguousMonth && !new RegExp(`^${AFTER_DAY}`).test(rest)) return;
      const date = parseDay(`${d} ${month.slice(0, 3)}`, today);
      if (!date || date.getDate() !== Number(d)) return;
      const yearBefore = exactDay(date.getFullYear() - 1, date.getMonth(), date.getDate());
      add(yearBefore && !pointsAhead && dayAfter(yearBefore, JUST_WENT) >= today ? yearBefore : date);
    };
    for (const m of words.matchAll(new RegExp(`\\s(\\d{1,2})${L.ordinalSuffix}?\\s+(?:${escape(L.of)}\\s+)?(${L.monthPattern})`, 'g'))) dayMonth(m[1], m[2], words.slice(m.index + m[0].length));
    for (const m of words.matchAll(new RegExp(`\\s(${L.monthPattern})\\s+(\\d{1,2})${L.ordinalSuffix}?(?=\\s)`, 'g'))) dayMonth(m[2], m[1], words.slice(m.index + m[0].length));
    for (const [, n, unit] of words.matchAll(new RegExp(`\\s${escape(L.inWord)}\\s+(\\d{1,2}|${smallWords})\\s+(${L.unitPattern})(?=\\s)`, 'g'))) {
      const per = Object.entries(L.units).find(([name]) => unit.startsWith(name))?.[1] || 1;
      add(dayAfter(today, (L.small[n] ?? Number(n)) * per));
    }
    for (const [, iso] of words.matchAll(/\s(\d{4}-\d{1,2}-\d{1,2})\s/g)) add(parseDay(iso, today));
    return [...found];
  }

  // The number written beside a number property's name ("cycle 5", "5 cycles"), or null; two different ones, null.
  function numberInWords(text, propTitle) {
    const words = ' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ').replace(/\.(?=\s|$)/g, ' ') + ' ', found = new Set();
    const name = String(propTitle).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    if (!name) return null;
    const esc = escape(name).replace(/\s+/g, '\\s+');
    const marks = `(?:${L.numberMarks.join('|')})?`, joiners = L.numberJoiners.map(escape).join('|');
    for (const [, n] of words.matchAll(new RegExp(`\\s${esc}s?\\s+${marks}(\\d+(?:\\.\\d+)?)(?=\\s)(?!\\s+(?:${joiners})\\s+\\d)`, 'g'))) found.add(Number(n));
    for (const [, n] of words.matchAll(new RegExp(`\\s(\\d+(?:\\.\\d+)?)\\s+${esc}s?\\s`, 'g'))) found.add(Number(n));
    return found.size === 1 ? [...found][0] : null;
  }

  // A sum of money in the words ("$84", "€12.50", "84 dollars", "1,200 EUR"), as a number, or null; two different sums, null.
  function moneyInWords(text) {
    const M = L.money;
    if (!M) return null;
    const words = ' ' + cleanWords(text).toLowerCase() + ' ', found = new Set(), num = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?';
    const add = (whole, cents) => { const n = Number(String(whole).replace(/,/g, '') + (cents ? '.' + cents : '')); if (Number.isFinite(n)) found.add(n); };
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])(?:${M.before})\\s?${num}(?![\\d.,]?\\d)`, 'g'))) add(m[1], m[2]);
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])${num}\\s?(?:${M.after})(?=[\\s.,;:!?)]|$)`, 'g'))) add(m[1], m[2]);
    return found.size === 1 ? [...found][0] : null;
  }
  // Does a property's name say it takes this meaning? By a whole word of the name: "Amount paid", "Due date".
  function nameMeans(meaning, propTitle) {
    const names = L[meaning]?.names;
    if (!names) return false;
    const own = String(propTitle).toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
    return own.some(w => names.includes(w));
  }
  // A word a day can start with: a weekday, a month, a number, "next", "the", "in", a relative day, a word like "on" or "by".
  const startsDay = new RegExp(`^(?:\\d|${L.weekdayPattern}$|${L.monthPattern.replace(/\(\?=\\s\)$/, '')}$|${[L.next, L.the, L.inWord, ...L.before, ...Object.keys(L.relative)].map(escape).join('|')}$)`);
  // The day named right after a word of this meaning ("due Friday", "scheduled for the 4th"): one day, or null.
  function dayMeant(meaning, text, base) {
    const W = L[meaning];
    if (!W?.words) return null;
    const words = ' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ') + ' ', found = new Set();
    for (const m of words.matchAll(new RegExp(`\\s(?:${W.words.map(escape).join('|')})\\s+((?:\\S+\\s+){0,5})`, 'g'))) {
      // Up to the end of the sentence, and the day must start right after the word: "diagnosed by Dr. Chen on Friday" is no deadline.
      const rest = m[1].trim().split(/\.(?=\s|$)/)[0].trim(), first = rest.split(/\s+/)[0] || '';
      if (W.not?.includes(first) || !startsDay.test(first)) continue;
      for (const day of daysInWords(`${L.before.includes('by') ? 'by' : L.before[0]} ${rest}`, base)) found.add(day);
    }
    return found.size === 1 ? [...found][0] : null;
  }
  return { locale: L, parseDay, daysInWords, numberInWords, moneyInWords, nameMeans, dayMeant, ahead: L.ahead };
}

/* A day written in a date format of Logseq's (its preferredDateFormat, "MMM do, yyyy" unless set otherwise), as Logseq titles
   a journal page: the pencil then reads as the value will once written. The tokens Logseq's formats use; anything else is
   kept as written. */
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const cap = w => w.replace(/^./, c => c.toUpperCase());
function formatDay(day, format = 'MMM do, yyyy', locale = en) {
  const d = asDate(day), month = locale.months[d.getMonth()] || '', weekday = locale.weekdays[d.getDay()] || '';
  const two = n => String(n).padStart(2, '0');
  const parts = { yyyy: String(d.getFullYear()), yy: two(d.getFullYear() % 100), MMMM: cap(month), MMM: cap(month.slice(0, 3)), MM: two(d.getMonth() + 1), M: String(d.getMonth() + 1),
    do: ordinal(d.getDate()), dd: two(d.getDate()), d: String(d.getDate()), EEEE: cap(weekday), EEE: cap(weekday.slice(0, 3)), EE: cap(weekday.slice(0, 3)), E: cap(weekday.slice(0, 3)) };
  return String(format || 'MMM do, yyyy').replace(/yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|EE|E/g, t => parts[t]);
}

const api = { en, makeReader, formatDay, dayAfter, dayNumber, asDate, sameDay, exactDay, reader: makeReader(en) };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).dates = api;
})();
