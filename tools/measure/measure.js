#!/usr/bin/env node
/* Measures of place, size and movement for everything that floats or stands as a bar (24 November 2026; the owner: "compare to
   the pixel and measure movement to make sure everything works properly, fast, without flickering, and in the right space and
   alignment. use maths"). The guard sees a screen at rest; this watches every frame from the press that opens a thing.

     node tools/measure/measure.js [--plugin <folder>] [--flows a,b] [--runs 5] [--out <folder>] [--port 9480] [--dark]
                                   [--against <measures.json of main>]
     node tools/measure/measure.js --list

   It starts a Logseq of its own on a copy of each flow's graph (700 × 560, as the owner's window), drives the flow with real
   keys and clicks, reads each animation frame in the page (rectangles, opacity, rows) and the screen's own frames from the
   debugging port, and prints each measure beside its pass line. The maths is in maths.js; the flows in flows.js. Tools only:
   nothing here ships. The measures and their pass lines are written out in the workspace's reference/calm-app-wide.md. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const M = require('./maths');
const sandbox = require('../guard/sandbox');
const FLOWS = require('./flows');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PASS = { latencyMedian: 80, latencyP95: 120, settleSlack: 34, gapMin: 4, gapMax: 8, band: 36, side: 40, inside: 8, frameGap: 34, flash: 0.001 };

/* In the page: armed before the input, it reads every animation frame until `ms` after the first key or press. */
const SAMPLER = spec => {
  const vis = el => !!el && el.isConnected && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const all = sel => { try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; } };
  const editing = () => document.querySelector('.ls-block textarea') || null;   // the line being written
  const findFloat = () => { for (const sel of spec.float) { const els = all(sel).filter(e => vis(e) && e.getBoundingClientRect().width > 1); if (els.length) return els[els.length - 1]; } return null; };
  const opacity = el => { let o = 1; for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) o = Math.min(o, +getComputedStyle(e).opacity); return o; };
  const stillEls = spec.still.flatMap(sel => (sel === 'editing' ? [editing()].filter(Boolean) : all(sel).filter(vis).slice(0, 8)));
  const still0 = stillEls.map(rect);
  let t0 = null; const frames = [], inputs = [];
  const onIn = () => { const now = performance.now(); if (t0 === null) t0 = now; inputs.push(now); };
  addEventListener('keydown', onIn, true); addEventListener('pointerdown', onIn, true);
  const caret = () => {
    const ta = document.activeElement; if (!ta || !/^(TEXTAREA|INPUT)$/.test(ta.tagName)) return null;
    const cs = getComputedStyle(ta), d = document.createElement('div');
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing', 'textIndent', 'tabSize']) d.style[p] = cs[p];
    Object.assign(d.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', left: '0', top: '0', width: ta.getBoundingClientRect().width + 'px' });
    d.textContent = (ta.value || '').slice(0, ta.selectionStart ?? 0); const s = document.createElement('span'); s.textContent = '​'; d.appendChild(s); document.body.appendChild(d);
    const tr = ta.getBoundingClientRect(), dr = d.getBoundingClientRect(), sr = s.getBoundingClientRect(), out = { x: tr.left + sr.left - dr.left, y: tr.top + sr.top - dr.top, w: 0, h: sr.height };
    d.remove(); return out;
  };
  const final = () => {
    removeEventListener('keydown', onIn, true); removeEventListener('pointerdown', onIn, true);
    const f = findFloat(), out = { t0, inputs, frames, still0, view: { w: innerWidth, h: innerHeight }, float: null, caret: caret(), editing: editing() ? rect(editing()) : null };
    if (!f) return out;
    const fr = rect(f), cs = getComputedStyle(f), words = [];
    const clip = r => { const x = Math.max(r.left, fr.x), y = Math.max(r.top, fr.y), w = Math.min(r.right, fr.x + fr.w) - x, h = Math.min(r.bottom, fr.y + fr.h) - y; return w > 0.5 && h > 0.5 ? { x, y, w, h } : null; };
    const walker = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim() || !vis(n.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) { const c = clip(r); if (c) words.push(c); }
    }
    for (const el of f.querySelectorAll('input, textarea, svg, img, [role="switch"], [role="checkbox"]')) if (vis(el)) { const c = clip(el.getBoundingClientRect()); if (c) words.push(c); }
    const rows = spec.rows ? [...f.querySelectorAll(spec.rows)].filter(vis).slice(0, 40) : [];
    const firstWord = row => { const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim() && vis(n.parentElement)) { const r = document.createRange(); r.selectNodeContents(n); const c = r.getClientRects()[0]; if (c && c.width > 0) return c.left; } return null; };
    const face = el => { const c = getComputedStyle(el); return { family: c.fontFamily.split(',')[0].replace(/["']/g, '').trim(), style: c.fontStyle, line: c.textDecorationLine + ' ' + c.textDecorationStyle, text: el.textContent.trim().slice(0, 30) }; };
    out.float = {
      rect: fr, words, pad: { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 },
      rows: rows.map(r => ({ ...rect(r), word: firstWord(r) })), matched: spec.float.find(sel => all(sel).includes(f)) || '',
      scrolls: f.scrollHeight > f.clientHeight + 2 || [...f.querySelectorAll('*')].some(e => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)),
    };
    out.protect = spec.protect.flatMap(sel => (sel === 'editing' ? [editing()].filter(Boolean) : all(sel).filter(vis).slice(0, 12))).map(rect);
    out.faces = {}; for (const [kind, sel] of Object.entries(spec.faces || {})) out.faces[kind] = all(sel).filter(vis).slice(0, 12).map(face);
    return out;
  };
  return new Promise(res => {
    const armed = performance.now();
    const tick = () => {
      const now = performance.now(), f = findFloat();
      frames.push({
        t: now, f: f ? { ...rect(f), o: opacity(f) } : null,
        rows: f && spec.rows ? [...f.querySelectorAll(spec.rows)].filter(vis).slice(0, 30).map(r => { const b = r.getBoundingClientRect(); return { k: r.textContent.trim().slice(0, 60), y: b.top, h: b.height }; }) : null,
        still: stillEls.map(e => (e.isConnected ? rect(e) : null)),
      });
      if ((t0 !== null && now - t0 > spec.ms) || now - armed > spec.ms + 10000) res(final()); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

/* The screen's own frames while the flow runs, and the triangle excess of each three in a row (maths.js). */
async function screencast(page) {
  const cdp = await page.context().newCDPSession(page), shots = [];
  cdp.on('Page.screencastFrame', f => { shots.push({ data: f.data, t: f.metadata.timestamp }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  return { stop: async () => { await cdp.send('Page.stopScreencast').catch(() => {}); await cdp.detach().catch(() => {}); return shots; } };
}
const IN_PAGE_FLASH = async ([frames, TAU]) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
  const lum = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height); for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return out; };
  const P = (await Promise.all(frames.map(load))).map(lum);
  // A pixel flashes at frame k when it goes one way and then back: its two steps have opposite signs and both are more than TAU.
  let worst = 0, at = -1;
  for (let k = 1; k + 1 < P.length; k++) {
    if (P[k].length !== P[k - 1].length || P[k].length !== P[k + 1].length) continue;
    let n = 0; const a = P[k - 1], b = P[k], c = P[k + 1];
    for (let i = 0; i < b.length; i++) { const s1 = b[i] - a[i], s2 = c[i] - b[i]; if (s1 * s2 < 0 && Math.abs(s1) > TAU && Math.abs(s2) > TAU) n++; }
    if (n > worst) { worst = n; at = k; }
  }
  return { worst, at, pixels: P[0] ? P[0].length : 0, frames: P.length };
};

/* One run's numbers from what the page read. Times are ms from the first input. */
function reckon(flow, got, anchor) {
  const r = { ok: true };
  if (got.t0 === null) return { failed: 'no key or press reached the page' };
  if (!got.float) return { failed: 'nothing opened that the flow names' };
  const shown = f => !!f.f && f.f.o > 0.01 && f.f.w > 1;
  // The clock starts at the last key or press before the thing shows (a flow may need two keys, as [[ does).
  const firstAbs = got.frames.find(f => f.t >= got.t0 && shown(f)), t0 = Math.max(got.t0, ...got.inputs.filter(t => !firstAbs || t <= firstAbs.t));
  const after = got.frames.filter(f => f.t >= t0).map(f => ({ ...f, t: f.t - t0 })), before = got.frames.filter(f => f.t < t0);
  const first = after.find(shown);
  r.latency = first ? first.t : NaN;
  // The last frame anything watched changed.
  const key = f => JSON.stringify([f.f && [f.f.x, f.f.y, f.f.w, f.f.h, f.f.o].map(v => Math.round(v * 2) / 2), f.still]);
  let last = r.latency; for (let i = 1; i < after.length; i++) if (key(after[i]) !== key(after[i - 1])) last = after[i].t;
  r.settled = last; r.motion = Math.max(0, last - r.latency);
  // M3: what the person did not move.
  const base = before.length ? before[before.length - 1].still : got.still0;
  r.bystander = Math.max(0, ...after.flatMap(f => f.still.map((s, i) => (s && base[i] ? M.moved(s, base[i]) : 0))));
  // M4: one path for the float, from its first frame.
  const seq = after.filter(shown), series = k => seq.map(f => f.f[k]);
  r.turns = 0; r.overshoot = 0;
  for (const k of ['x', 'y', 'w', 'h']) { const p = M.path(series(k)); r.turns += p.turns; r.overshoot = Math.max(r.overshoot, p.overshoot); }
  const po = M.path(series('o'), 0.01); r.turns += po.turns; r.fadeOvershoot = po.overshoot;
  // M5 (in the page): shown, gone, shown again.
  r.reversals = M.reversals(after.map(shown));
  // M6: the longest gap between frames while anything moves.
  const moving = after.filter(f => f.t >= r.latency && f.t <= last + 1);
  r.frameGap = moving.length > 1 ? Math.max(...moving.slice(1).map((f, i) => f.t - moving[i].t)) : 0;
  // M8: sizes after the first frame.
  r.sizes = new Set(seq.map(f => `${Math.round(f.f.w)}x${Math.round(f.f.h)}`)).size;
  // At rest.
  const F = got.float.rect;
  if (anchor) {
    if (flow.anchor === 'caret') { r.dx = anchor.x - F.x; r.gap = F.y >= anchor.y ? F.y - (anchor.y + anchor.h) : anchor.y - (F.y + F.h); }
    else { r.dx = F.x - anchor.x; r.gap = F.y >= anchor.y + anchor.h - 1 ? F.y - (anchor.y + anchor.h) : anchor.y - (F.y + F.h); }
  }
  const room = M.room(F, got.float.words); r.band = room.band; r.side = room.side;
  r.width = F.w; r.height = F.h;
  r.inside = Math.min(F.x, F.y, got.view.w - F.x - F.w, got.view.h - F.y - F.h);
  r.covered = (got.protect || []).reduce((a, p) => a + M.overlap(F, p), 0);
  const rows = got.float.rows;
  r.rowHeights = M.spread(rows.map(x => x.h)); r.rowEdges = M.spread(rows.map(x => x.x)); r.rowWords = M.spread(rows.filter(x => x.word !== null).map(x => x.word));
  r.rows = rows.length; r.scrolls = got.float.scrolls;
  r.faces = got.faces || {};
  return r;
}

/* Typing: letters 80 ms apart with the thing open. Rows that stay keep their place; the list is never empty between two full
   frames; the float keeps its corner; its height changes at most once a letter. */
function reckonTyping(got) {
  if (got.t0 === null || !got.float) return { failed: 'the typing did not reach an open list' };
  const fs = got.frames.filter(f => f.t >= got.t0 && f.f), r = {};
  let shift = 0, empties = 0, heights = 0;
  for (let i = 1; i < fs.length; i++) {
    const a = fs[i - 1], b = fs[i];
    if (a.rows && b.rows) {
      // Rows that stay and whose order among the stayers is unchanged: a row found again has moved only if the rows before it are the same.
      const n = Math.min(a.rows.length, b.rows.length);
      for (let j = 0; j < n; j++) { if (a.rows[j].k !== b.rows[j].k) break; shift = Math.max(shift, Math.abs(a.rows[j].y - b.rows[j].y)); }
    }
    if (i + 1 < fs.length && a.rows?.length && b.rows && !b.rows.length && fs[i + 1].rows?.length) empties++;
    if (Math.abs(a.f.h - b.f.h) > M.EPS) heights++;
  }
  r.rowShift = shift; r.emptyFrames = empties; r.corner = Math.max(M.spread(fs.map(f => f.f.x)), M.spread(fs.map(f => f.f.y)));
  r.letters = got.inputs.length; r.heightChangesPerLetter = got.inputs.length ? heights / got.inputs.length : heights;
  r.reversals = M.reversals(got.frames.filter(f => f.t >= got.t0).map(f => !!f.f && f.f.o > 0.01));
  return r;
}

const fmt = (v, d = 1) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(d).replace(/\.0+$/, '') : '–') : String(v));
/* The table: each measure, its number, its pass line. `worst` over the runs, but latency as median and 95th percentile. */
function verdict(flow, runs, flash, base) {
  const good = runs.filter(r => !r.failed), lines = [];
  if (!good.length) return { failed: runs[0]?.failed || 'no run', lines };
  const worst = k => Math.max(...good.map(r => r[k] ?? 0)), least = k => Math.min(...good.map(r => r[k] ?? 0));
  const add = (id, name, value, pass, line, unit = '') => lines.push({ id, name, value, pass, line, said: `${fmt(value, unit === '' ? 3 : 1)}${unit}` });
  if (flow.typing) {
    add('M7', 'rows that stay keep their place', worst('rowShift'), worst('rowShift') <= M.EPS, '≤ 0.5 pt', ' pt');
    add('M7', 'frames with an empty list between full ones', worst('emptyFrames'), worst('emptyFrames') === 0, '0');
    add('M7', 'the float keeps its corner', worst('corner'), worst('corner') <= M.EPS, '≤ 0.5 pt', ' pt');
    add('M7', 'changes of height per letter', worst('heightChangesPerLetter'), worst('heightChangesPerLetter') <= 1, '≤ 1');
    add('M5', 'shown, gone, shown again', worst('reversals'), worst('reversals') === 0, '0');
  } else {
    const L = good.map(r => r.latency);
    add('M1', 'opens, median', M.median(L), M.median(L) <= PASS.latencyMedian, `≤ ${PASS.latencyMedian} ms`, ' ms');
    add('M1', 'opens, 95th percentile', M.percentile(L, 95), M.percentile(L, 95) <= PASS.latencyP95, `≤ ${PASS.latencyP95} ms`, ' ms');
    const allowed = (flow.motionMs || 0) + PASS.settleSlack;
    add('M2', 'still after it opens', worst('motion'), worst('motion') <= allowed, `≤ ${allowed} ms`, ' ms');
    add('M3', 'what you did not move, moved', worst('bystander'), worst('bystander') <= M.EPS, '≤ 0.5 pt', ' pt');
    add('M4', 'changes of direction', worst('turns'), worst('turns') === 0, '0');
    add('M4', 'overshoot', worst('overshoot'), worst('overshoot') <= M.EPS, '≤ 0.5 pt', ' pt');
    add('M5', 'shown, gone, shown again', worst('reversals'), worst('reversals') === 0, '0');
    add('M6', 'longest gap between frames while moving', worst('frameGap'), worst('frameGap') <= PASS.frameGap, `≤ ${PASS.frameGap} ms`, ' ms');
    add('M8', 'sizes it takes', worst('sizes'), worst('sizes') <= (flow.motionMs ? 99 : 1), flow.motionMs ? 'grows once' : '1');
    if (flow.anchor) {
      const dx = good.map(r => r.dx), gap = good.map(r => r.gap), worstDx = dx.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      const okDx = flow.anchor === 'caret' ? dx.every(v => v >= -M.EPS && v <= 24) : dx.every(v => Math.abs(v) <= M.EPS);
      add('G1', flow.anchor === 'caret' ? 'left of the caret by' : 'off its anchor’s edge by', worstDx, okDx, flow.anchor === 'caret' ? '0 to 24 pt' : '≤ 0.5 pt', ' pt');
      add('G1', 'gap to what called it', Math.max(...gap), gap.every(v => v >= PASS.gapMin - M.EPS && v <= PASS.gapMax + M.EPS), `${PASS.gapMin} to ${PASS.gapMax} pt`, ' pt');
    }
    add('G2', 'tallest band with nothing in it', worst('band'), worst('band') <= PASS.band, `≤ ${PASS.band} pt`, ' pt');
    if (!flow.keepsWidth) add('G2', 'room beside its widest row', worst('side'), worst('side') <= PASS.side, `≤ ${PASS.side} pt`, ' pt');
    add('G3', 'nearest edge of the window', least('inside'), least('inside') >= PASS.inside, `≥ ${PASS.inside} pt`, ' pt');
    if (flow.protect?.length) add('G4', 'covers what you are acting on', worst('covered'), worst('covered') === 0, '0 pt²', ' pt²');
    if (good[0].rows > 1) { add('G5', 'row heights differ by', worst('rowHeights'), flow.unevenRows || worst('rowHeights') <= M.EPS, '≤ 0.5 pt', ' pt'); add('G5', 'row edges differ by', worst('rowEdges'), worst('rowEdges') <= M.EPS, '≤ 0.5 pt', ' pt'); }
    for (const [kind, want] of Object.entries(flow.faceWant || {})) {
      const found = good[0].faces[kind] || [], bad = found.filter(f => !want(f));
      add('T1', `${kind}: in the wrong face`, bad.length, found.length > 0 && bad.length === 0, `0 of ${found.length}`);
    }
    add('size', 'width × height', `${Math.round(M.median(good.map(r => r.width)))} × ${Math.round(M.median(good.map(r => r.height)))}`, true, 'told');
  }
  if (flash) add('M5', 'pixels that flash (go and come back), share', flash.worst, flash.worst <= PASS.flash, `≤ ${PASS.flash * 100}%`);
  for (const l of lines) {
    const was = base?.lines?.find(b => b.id === l.id && b.name === l.name);
    if (!was || typeof l.value !== 'number' || typeof was.value !== 'number') continue;
    l.was = was.value; const tol = Math.max(Math.abs(was.value) * 0.1, M.EPS);
    l.change = Math.abs(l.value - was.value) <= tol ? 'same' : (l.pass && !was.pass) ? 'better' : (!l.pass && was.pass) ? 'worse' : l.lowerIsBetter !== false && l.value < was.value ? 'better' : 'worse';
    if (l.id === 'G3') l.change = Math.abs(l.value - was.value) <= tol ? 'same' : l.value > was.value ? 'better' : 'worse';
  }
  // Without a baseline every line must pass; against one, a line may fail only if it failed before and is no worse.
  return { lines, ok: lines.every(l => l.pass || (base && l.was !== undefined && l.change !== 'worse')) };
}

async function main() {
  if (args.includes('--list')) { for (const f of FLOWS) console.log(`${f.name.padEnd(28)} ${f.graph.padEnd(20)} ${f.says}`); return; }
  const plugin = path.resolve(String(opt('plugin', path.join(__dirname, '..', '..')))), port = Number(opt('port', 9480)), runsN = Number(opt('runs', 5));
  const only = opt('flows', '') ? String(opt('flows')).split(',') : null, dark = args.includes('--dark');
  const out = path.resolve(String(opt('out', path.join(os.tmpdir(), 'logseq-measure')))); fs.mkdirSync(out, { recursive: true });
  const flows = FLOWS.filter(f => !only || only.includes(f.name));
  const against = opt('against', '') ? JSON.parse(fs.readFileSync(String(opt('against')), 'utf8')).results : null;
  if (!flows.length) throw new Error('no such flow; --list names them');
  const results = [];
  const { chromium } = require('playwright'); const maths = await chromium.launch(); const mathsPage = await maths.newPage();
  for (const graph of [...new Set(flows.map(f => f.graph))]) {
    const dir = path.join(os.tmpdir(), `logseq-measure-${port}`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const pluginCopy = path.join(dir, 'plugin'); fs.mkdirSync(pluginCopy, { recursive: true });
    require('node:child_process').execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'node_modules', plugin + '/', pluginCopy + '/']);
    const box = await sandbox.start({ dir, graph, plugin: pluginCopy, port });
    try {
      const { page } = box;
      await page.evaluate(async () => { window.moveTo(80, 60); window.resizeTo(700, 560); await new Promise(r => setTimeout(r, 500)); });
      if (dark) { await page.evaluate(() => window.logseq.api.set_theme_mode?.('dark')).catch(() => {}); await sleep(600); }
      await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });   // a blinking caret is not a flash
      const H = FLOWS.helpers(box, sleep);
      for (const flow of flows.filter(f => f.graph === graph)) {
        const runs = []; let worstFlash = 0, pictured = false;
        for (let i = 0; i < runsN; i++) {
          try {
            await H.reset(); await flow.setup(box, H); await sleep(500);
            const anchor = flow.anchor && flow.anchor !== 'caret' ? await page.evaluate(FLOWS.anchorRect, flow.anchor) : null;
            const cast = await screencast(page);
            const reading = page.evaluate(SAMPLER, { float: flow.float, rows: flow.rows || '', still: flow.still || [], protect: flow.protect || [], faces: flow.faces || {}, ms: flow.ms || 700 });
            await sleep(120);
            await flow.input(box, H);
            const got = await reading, shots = await cast.stop();
            const a = flow.anchor === 'caret' ? got.caret : flow.anchor === 'editing' ? got.editing : anchor;
            runs.push(flow.typing ? reckonTyping(got) : reckon(flow, got, a));
            if (shots.length >= 3) { const e = await mathsPage.evaluate(IN_PAGE_FLASH, [shots.slice(0, 48).map(s => s.data), M.TAU]); const share = e.worst / (e.pixels || 1); if (share > worstFlash) { worstFlash = share; if (share > PASS.flash && e.at > 0) for (const j of [-1, 0, 1]) fs.writeFileSync(path.join(out, `${flow.name}${dark ? '.dark' : ''}.flash${j + 1}.png`), Buffer.from(shots[e.at + j].data, 'base64')); } }
            if (!pictured) { await page.screenshot({ path: path.join(out, `${flow.name}${dark ? '.dark' : ''}.png`) }); pictured = true; }
          } catch (e) { runs.push({ failed: String(e && e.message || e).split('\n')[0] }); }
          await flow.after?.(box, H).catch(() => {});
        }
        const v = verdict(flow, runs, { worst: worstFlash }, against?.find(r => r.flow === flow.name));
        results.push({ flow: flow.name, graph, says: flow.says, runs: runs.length, failed: v.failed || null, ok: !!v.ok, lines: v.lines });
        console.log(`\n${flow.name}  (${flow.says})${v.failed ? `\n  could not be measured: ${v.failed}` : ''}`);
        for (const l of v.lines) console.log(`  ${l.pass ? 'ok  ' : 'FAIL'} ${l.id.padEnd(5)} ${l.name.padEnd(50)} ${String(l.said).padEnd(14)} ${l.line.padEnd(12)}${l.was !== undefined ? ` was ${fmt(l.was, 1)}: ${l.change}` : ''}`);
      }
    } finally { await sandbox.stop(box); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  await maths.close();
  const file = path.join(out, `measures${dark ? '.dark' : ''}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), plugin, results }, null, 1));
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length} of ${results.length} flows pass every measure. Written to ${file}`);
  process.exit(bad.length ? 1 : 0);
}
main().catch(e => { console.error(String(e && e.stack || e)); process.exit(2); });
