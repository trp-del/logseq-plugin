/* Dates as Logseq keeps them: a journal day as a number (20261023), a Date-and-time, Deadline or Scheduled as milliseconds.
   Everything that writes a date to a document goes through here, so the look is one, and `locale` (undefined: the
   system's) is the one place it is set. Pure, runs in Node. */
(function () {
const E = (window.DbExport ||= {});
const DAY = /^\d{8}$/;
const isDay = n => DAY.test(String(n));
const toDate = n => isDay(n) ? new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100) : new Date(Number(n));
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
// A day and a timestamp on one scale, for sorting.
const scale = n => n == null ? null : isDay(n) ? toDate(n).getTime() : Number(n);
const valid = n => n != null && !Number.isNaN(toDate(n).getTime());
const pad = n => String(n).padStart(2, '0');

const fmt = {
  day: (n, locale) => toDate(n).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),        // 23 Oct 2026
  long: (n, locale) => toDate(n).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),        // 23 October 2026
  short: (n, locale) => toDate(n).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),                       // 23 Oct
  month: (n, locale) => toDate(n).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),                       // October 2026
  weekday: (n, locale) => toDate(n).toLocaleDateString(locale, { weekday: 'short' }),                                   // Fri
  // A time of day only when the value has one (a Date-and-time at midnight reads as a day).
  time: (n, locale) => { if (isDay(n)) return ''; const d = toDate(n); return d.getHours() || d.getMinutes() ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''; },
  iso: n => { const d = toDate(n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  // "Sep 9 – 12" within a month, "Sep 28 – Oct 2" across one.
  span: (from, to, locale) => {
    const a = toDate(from), b = to == null ? null : toDate(to);
    if (!b) return fmt.short(from, locale);
    if (a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear()) return `${fmt.short(from, locale)} – ${fmt.short(to, locale)}`;
    // "9 – 12 Sept" where the day comes first, "Sep 9 – 12" where the month does.
    return /^\d/.test(fmt.short(from, locale)) ? `${a.getDate()} – ${fmt.short(to, locale)}` : `${fmt.short(from, locale)} – ${b.getDate()}`;
  },
};
E.dates = { isDay, toDate, dayNumber, scale, valid, fmt };
})();
