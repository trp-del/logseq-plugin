/* Days as Logseq keeps them (a number, 20261004) and as a line says them. No Logseq here. */
(function (root) {
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const valid = day => Number.isSafeInteger(day) && day >= 10000101 && day <= 99991231 && (Math.floor(day / 100) % 100) >= 1 && (Math.floor(day / 100) % 100) <= 12 && day % 100 >= 1 && day % 100 <= 31;
const number = date => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
// "Oct 4" in the year we are in, "Oct 4, 2025" in another; nothing for no day.
function short(day, today = number(new Date())) {
  if (!valid(day)) return '';
  const words = `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}`;
  return Math.floor(day / 10000) === Math.floor(today / 10000) ? words : `${words}, ${Math.floor(day / 10000)}`;
}
// The first and last millisecond of a day, for what Logseq keeps as a time within it.
function span(day) {
  if (!valid(day)) return null;
  const from = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100).getTime();
  return { from, to: from + 86400000 };
}
/* A day as a person types it, read into Logseq's number; 0 where no one day is meant.
   today, tomorrow, yesterday; 2026-11-18; nov 18, 18 nov, november 18 2026 (a year left out is the year we are in). */
const FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function typed(text, today = number(new Date())) {
  const said = String(text == null ? '' : text).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  const real = (y, m, d) => { const at = new Date(y, m - 1, d); return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d ? y * 10000 + m * 100 + d : 0; };
  const shift = by => number(new Date(Math.floor(today / 10000), Math.floor(today / 100) % 100 - 1, today % 100 + by));
  if (said === 'today') return today;
  if (said === 'tomorrow') return shift(1);
  if (said === 'yesterday') return shift(-1);
  const iso = said.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return real(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const monthOf = word => word.length >= 3 ? FULL.findIndex(name => name.startsWith(word)) + 1 : 0;
  const first = said.match(/^([a-z]+) (\d{1,2})(?: (\d{4}))?$/), second = said.match(/^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/);
  const month = first ? monthOf(first[1]) : second ? monthOf(second[2]) : 0, day = first ? Number(first[2]) : second ? Number(second[1]) : 0;
  const year = Number((first || second || [])[3]) || Math.floor(today / 10000);
  return month && day ? real(year, month, day) : 0;
}
const api = { valid, number, short, span, typed };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).days = api;
})(typeof window !== 'undefined' ? window : globalThis);
