/* Days as Logseq keeps them (a number, 20261004), as a line says them, and as a person types them. No Logseq here.
   This is the one reader of a day said in words. Every piece that reads one (a task's "by nov 20" in core/todo.js, a list's
   "on Oct 7" in core/view.js, a search's "7 May" in core/sentence.js, a date asked for from outside) asks the pieces here and
   keeps no rule of its own: what a month's name is, what a day of the month is, which year is meant when none is said.
     MONTHS, FULL             the months' names, short ("Nov") and whole ("November"); written nowhere else
     valid(day)               whether a number is a day the calendar has (20260231 is not)
     number(date)             a Date as Logseq's number; toDate(day) the other way; shift(day, by) so many days on or back
     real(y, m, d)            the number of that day, 0 where the calendar has none
     monthOf(word)            1 to 12 for a month's name or a whole beginning of it, three letters or more ("nov", "Nov.",
                              "sept", "november"); 0 for any other word: "decadron", "mark" and "maya" are no months
     dateOf(word)             1 to 31 from "4" or "4th"; 0 otherwise
     yearOf(word, any)        a year said in four digits: 1900 to 2099, so that an amount among other words is not taken for
                              one; any four digits where the whole text is a day (any)
     said(words, i, any)      the day said from the word at i (words: what was typed, split at its spaces, or [{ key }]):
                              "nov 18", "Nov. 18th", "november 18, 2026", "18 nov", "18 november 2026"; a month alone or
                              with its year ("nov", "nov 2026") answers d 0.
                              -> { len, bare, y, m, d }: len words read, bare of them without the year, y 0 where none is said
     yearFor(m, d, today, lean)   the year of a day said without one: 'this' the year we are in; 'coming' the next time the day
                              comes, today too (a task's day); 'past' the last time it came, today too (a list turned back)
     written(text, today, lean)   a whole text that is one day written out: 2026-11-18, or one of the forms said() reads; 0
     typed(text, today)       the same, and today, tomorrow, yesterday; a year left out is the year we are in; 0 for no day
     short(day, today)        "Oct 4" in the year we are in, "Oct 4, 2025" in another; nothing for no day
     span(day)                the first and last millisecond of a day, for what Logseq keeps as a time within it */
(function (root) {
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS = FULL.map(name => name.slice(0, 3)), LOW = FULL.map(name => name.toLowerCase());
const number = date => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
const toDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
const real = (y, m, d) => { const at = new Date(y, m - 1, d); return y >= 1000 && y <= 9999 && at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d ? y * 10000 + m * 100 + d : 0; };
const valid = day => Number.isSafeInteger(day) && day > 0 && real(Math.floor(day / 10000), Math.floor(day / 100) % 100, day % 100) === day;
const shift = (day, by) => { const at = toDate(day); return number(new Date(at.getFullYear(), at.getMonth(), at.getDate() + by)); };
function short(day, today = number(new Date())) {
  if (!valid(day)) return '';
  const words = `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}`;
  return Math.floor(day / 10000) === Math.floor(today / 10000) ? words : `${words}, ${Math.floor(day / 10000)}`;
}
function span(day) {
  if (!valid(day)) return null;
  const from = toDate(day).getTime();
  return { from, to: from + 86400000 };
}
// A word without the marks that end it, and those marks: "Nov." -> "nov" and ".".
const END = /[.,;:!?]+$/;
const bare = word => String(word == null ? '' : word).toLowerCase().replace(END, '');
const monthOf = word => { const w = bare(word); return /^[a-z]{3,9}$/.test(w) ? LOW.findIndex(name => name.startsWith(w)) + 1 : 0; };
const dateOf = word => { const m = bare(word).match(/^(\d{1,2})(?:st|nd|rd|th)?$/), d = m ? Number(m[1]) : 0; return d >= 1 && d <= 31 ? d : 0; };
const yearOf = (word, any = false) => { const w = bare(word); return (any ? /^[1-9]\d{3}$/ : /^(19|20)\d\d$/).test(w) ? Number(w) : 0; };
function said(words, i, any = false) {
  const key = at => { const word = words[at]; return word == null ? '' : String(typeof word === 'object' ? word.key : word); }, end = at => (key(at).match(END) || [''])[0];
  let m = monthOf(key(i)), d = 0, len = 1;
  if (m) { if (/^\.?$/.test(end(i)) && dateOf(key(i + 1))) { d = dateOf(key(i + 1)); len = 2; } }   // only a full stop may stand between a month and its day
  else if (dateOf(key(i)) && !end(i) && monthOf(key(i + 1))) { d = dateOf(key(i)); m = monthOf(key(i + 1)); len = 2; }
  else return null;
  const y = /^[.,]?$/.test(end(i + len - 1)) ? yearOf(key(i + len), any) : 0;
  return { len: y ? len + 1 : len, bare: len, y, m, d };
}
function yearFor(m, d, today, lean = 'this') {
  const year = Math.floor(today / 10000), at = year * 10000 + m * 100 + d;
  return lean === 'coming' && at < today ? year + 1 : lean === 'past' && at > today ? year - 1 : year;
}
const tidy = text => String(text == null ? '' : text).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
function written(text, today = number(new Date()), lean = 'this') {
  const words = tidy(text).split(' '), iso = words.length === 1 && words[0].match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return real(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const got = said(words, 0, true);
  return got && got.d && got.len === words.length ? real(got.y || yearFor(got.m, got.d, today, lean), got.m, got.d) : 0;
}
function typed(text, today = number(new Date())) {
  const near = { today: 0, tomorrow: 1, yesterday: -1 }[tidy(text)];
  return near == null ? written(text, today, 'this') : shift(today, near);
}
const api = { MONTHS, FULL, valid, number, toDate, shift, real, monthOf, dateOf, yearOf, said, yearFor, written, typed, short, span };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).days = api;
})(typeof window !== 'undefined' ? window : globalThis);
