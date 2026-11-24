/* The measures' maths (24 November 2026; the owner: "compare to the pixel and measure movement to make sure everything works
   properly, fast, without flickering, and in the right space and alignment. use maths"). Pure functions over numbers, so each can
   be tried without Logseq: `node tools/measure/maths.js --test`. Lengths are CSS points; EPS is one device pixel on a 2x screen. */
const EPS = 0.5;

const spread = xs => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const median = xs => percentile(xs, 50);
function percentile(xs, p) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), i = (p / 100) * (s.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
// A series that goes one way has no change of direction and travels exactly |end − start|. Steps under `eps` are not steps.
function path(series, eps = EPS) {
  const steps = [];
  for (let i = 1; i < series.length; i++) { const d = series[i] - series[i - 1]; if (Math.abs(d) > eps / 2) steps.push(d); }
  let turns = 0;
  for (let i = 1; i < steps.length; i++) if (Math.sign(steps[i]) !== Math.sign(steps[i - 1])) turns++;
  const travel = steps.reduce((a, d) => a + Math.abs(d), 0), net = series.length ? Math.abs(series[series.length - 1] - series[0]) : 0;
  return { turns, overshoot: Math.max(0, travel - net), travel, net };
}
// Seen, unseen, seen again: how many times a thing that had shown went away and came back.
function reversals(seen) {
  let n = 0, state = null, wasSeen = false;
  for (const s of seen) { if (state === null) { state = s; wasSeen = s; continue; } if (s !== state) { if (s && wasSeen) n++; if (s) wasSeen = true; state = s; } }
  return n;
}
const area = r => Math.max(0, r.w) * Math.max(0, r.h);
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const union = rs => { if (!rs.length) return null; const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
/* As big as what it holds. `band` is the tallest strip of the float, top to bottom, in which no word or control stands (the room
   above the first, between two, and under the last); `side` is the float's width less the width its words span. */
function room(float, words) {
  if (!words.length) return { band: float.h, side: float.w };
  const s = [...words].sort((a, b) => a.y - b.y); let cursor = float.y, band = 0;
  for (const w of s) { band = Math.max(band, w.y - cursor); cursor = Math.max(cursor, w.y + w.h); }
  band = Math.max(band, float.y + float.h - cursor);
  return { band, side: float.w - (Math.max(...words.map(w => w.x + w.w)) - Math.min(...words.map(w => w.x))) };
}
// The largest move of any edge of a rectangle from where it stood.
const moved = (r, r0) => Math.max(Math.abs(r.x - r0.x), Math.abs(r.y - r0.y), Math.abs(r.x + r.w - r0.x - r0.w), Math.abs(r.y + r.h - r0.y - r0.h));
/* A flash, pixel by pixel, over three frames in a row with brightness a, b, c: the pixel goes one way and then back, so its two
   steps have opposite signs, (b − a)(c − b) < 0, and both are larger than TAU (so a fade, which goes one way in small steps, and
   the grain of a picture are not flashes). */
const TAU = 12;
const flashes = (a, b, c, tau = TAU) => (b - a) * (c - b) < 0 && Math.abs(b - a) > tau && Math.abs(c - b) > tau;
// WCAG contrast of two sRGB colours [r, g, b] 0..255.
function contrast(a, b) {
  const lum = c => { const [r, g, bl] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

module.exports = { EPS, TAU, spread, median, percentile, path, reversals, area, overlap, union, room, moved, flashes, contrast };

if (require.main === module && process.argv.includes('--test')) {
  const assert = require('node:assert');
  assert.equal(spread([10, 10.4, 10.1]).toFixed(1), '0.4');
  assert.equal(median([3, 1, 2]), 2); assert.equal(percentile([0, 10], 95), 9.5);
  assert.deepEqual(path([0, 4, 8, 12]), { turns: 0, overshoot: 0, travel: 12, net: 12 });   // a roll: one way
  const bounce = path([0, 6, 14, 12, 12]); assert.equal(bounce.turns, 1); assert.equal(bounce.overshoot, 4);   // past its place and back
  assert.equal(path([5, 5.1, 5, 5.2]).turns, 0);   // sub-pixel noise is not a move
  assert.equal(reversals([false, true, true]), 0); assert.equal(reversals([false, true, false, true]), 1); assert.equal(reversals([true, false, true, false, true]), 2);
  assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), 25); assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), 0);
  assert.deepEqual(room({ x: 0, y: 0, w: 200, h: 100 }, [{ x: 10, y: 10, w: 180, h: 20 }, { x: 10, y: 34, w: 100, h: 20 }]), { band: 46, side: 20 });   // two lines, then 46 pt of nothing
  assert.deepEqual(room({ x: 0, y: 0, w: 200, h: 64 }, [{ x: 10, y: 10, w: 180, h: 20 }, { x: 10, y: 34, w: 100, h: 20 }]), { band: 10, side: 20 });   // as big as what it holds
  assert.equal(moved({ x: 1, y: 2, w: 10, h: 10 }, { x: 1, y: 2, w: 10, h: 16 }), 6);
  assert.equal(flashes(250, 30, 250), true);   // white, a dark frame, white again
  assert.equal(flashes(250, 170, 90), false);   // a fade goes one way
  assert.equal(flashes(250, 245, 250), false);   // grain
  assert.equal(contrast([0, 0, 0], [255, 255, 255]).toFixed(0), '21'); assert.ok(contrast([118, 118, 118], [255, 255, 255]) > 4.5);
  console.log('the measures\' maths: every case as worked by hand');
}
