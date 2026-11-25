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
const api = { valid, number, short, span };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).days = api;
})(typeof window !== 'undefined' ? window : globalThis);
