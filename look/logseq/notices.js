/* Notices, Logseq's own and the plugin's alike. Logseq 2.0.2 draws them with Base UI's toasts (.ui__toaster-viewport, each
   .ui__toast) 360 px wide under the toolbar at the top right, 16 px words in a card with a large shadow, the next one
   peeking below; an error, and any notice given a timeout, stays until its × is pressed (measured: info, warning and
   success go after about 3 s). Here: one line of 13 px words, at the bottom centre of the window, the stack peeking upward;
   it fades in and out where it stands, no slide; and every notice goes after 4 s, held while the pointer or the keyboard is
   on it. The owner, 3 Nov 2026: the notice "gets in the way a lot and doesn't go away often", large, blocking the top right;
   Logseq's own made small and moved too, not a second look beside them. */
(function () {
const Look = window.Look;
const { style, watchScreen } = Look.kit;
const setting = key => Look.settings.setting(key);
const LAST = 4000;   // how long a notice stays, in ms

const V = '.ui__toaster-viewport', T = `${V} .ui__toast`;
const css = `
${V} { inset: auto auto 20px 50% !important; transform: translateX(-50%); width: min(30rem, calc(100vw - 2rem)) !important; }
${T} { top: auto !important; bottom: 0; transform-origin: center bottom !important;
  transform: translateY(calc(-1 * (var(--toast-index) * var(--peek) + var(--shrink) * var(--height)))) scale(var(--scale)) !important;
  border-color: var(--lk-hair) !important; box-shadow: 0 2px 10px rgb(0 0 0 / .08) !important; transition: transform .25s, opacity .25s, height .15s !important; }
${T}[data-expanded] { transform: translateY(calc(-1 * var(--offset-y))) !important; }
${T}:is([data-starting-style], [data-ending-style]) { opacity: 0; transform: translateY(calc(-1 * (var(--toast-index) * var(--peek) + var(--shrink) * var(--height)))) scale(var(--scale)) !important; }
${T} .ui__toast-content { padding: 7px 36px 7px 12px !important; gap: 0 !important; }
${T} .ui__toast-content.untitled .ui__toast-body { padding-block: 0 !important; }
${T} .ui__toast-text { align-items: center !important; gap: 8px !important; }
${T} .ui__toast-description { font-size: 13px !important; line-height: 18px !important; opacity: 1 !important; }
${T} .ui__toast-status-icon { width: 14px !important; height: 14px !important; }
${T} .ui__toast-status-icon svg { width: 14px; height: 14px; }
${T} .ui__toast-content.untitled .ui__toast-header { top: 50% !important; right: 6px !important; transform: translateY(-50%); }
${T} .ui__toast-close { width: 24px !important; height: 24px !important; }
${T} .ui__toast-close svg { width: 14px; height: 14px; }`;

/* Each notice, as it comes, is timed: after LAST its × is pressed for it, Logseq's own way out. Held while pointed at or
   focused, and while it waits behind the ones shown (Logseq keeps three; the rest wait, data-limited). */
const timers = new Set();
function time(toast) {
  const id = setTimeout(() => {
    timers.delete(id);
    if (!toast.isConnected || !setting('quietNotices')) return;
    if (toast.matches(':hover, :focus-within, [data-limited]') || toast.closest(V)?.matches(':hover')) return time(toast);
    toast.querySelector('.ui__toast-close')?.click();
  }, LAST);
  timers.add(id);
}
function timeNew(doc) {
  if (!setting('quietNotices')) return;
  for (const toast of doc.querySelectorAll(`${T}:not([data-lk-timed])`)) { toast.setAttribute('data-lk-timed', ''); time(toast); }
}
function apply() { style('notices', setting('quietNotices') ? css : ''); }
function start() { apply(); watchScreen(timeNew, timeNew); }
function stop() { style('notices', ''); for (const id of timers) clearTimeout(id); timers.clear(); }
Look.notices = { apply, start, stop };
})();
