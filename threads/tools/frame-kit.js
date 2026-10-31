/* The frame kit (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 3): what tools/frames.js (Chromium, a pretend page) and
   tools/app-frames.js (the real Logseq, over its debugging port) both use to record a page settling and to say whether
   anything jumped or flashed, and whose it was. Not a test by itself.

   Three witnesses on one clock (the page's performance.now()):
   - THE LEDGER: a requestAnimationFrame loop in the page that writes, every frame, what changed about each tracked
     element: its rect, whether it is in the document, its opacity (with its ancestors'), visibility, colour and
     background. Tracked: every element the plugin marks (the kit's one finder, MARK_CLASS and MARK_ATTR, from
     tools/marks.js) and Logseq's landmarks (LANDMARKS below). Inputs the test makes are written to it too.
   - THE SHIFT LOG: the browser's layout-shift entries, with each source's node, previous and current rect.
   - THE FRAMES: the screencast's pictures (Page.startScreencast), decoded here (decodePng) and compared pixel by
     pixel with the one before: a pixel is changed when a channel moves by more than 24, as in tools/pictures.js.

   The definitions (section 3.2 of the prompt), as built, with the two places this kit is stricter or more exact:
   - A JUMP: a tracked element shown in two consecutive ledger frames whose top or left moved by 1 px or more, with no
     input in the 500 ms before. A route change is NOT counted as input here (stricter than the prompt): a page is
     visited by a route change, so exempting it would hide exactly the jumps the owner sees while a page opens.
     Whose a jump is comes from comparing with the same visit with the plugin off (A): a Logseq landmark that moves the
     same way by about the same amount in A is Logseq's; any move of the plugin's own element is the plugin's.
   - A FLASH: a tracked element shown and gone again within 250 ms with nothing like it (same kind, same place) left
     after it (a piece replaced in place by its twin is not seen to flash), or gone and back within 250 ms; an
     element whose opacity, visibility, colour or background changes and changes back within 250 ms; a picture
     region of at least 16×16 px that changes and comes back (each pixel within 24) within 250 ms, outside the noise
     mask, with no input in [t − 50 ms, t + 250 ms].
   - SETTLE: from the route change to the last frame with a changed pixel outside the noise mask.
   - APPEARANCE: the first ledger frame a piece is shown (in the document, a rect, opacity above 0, visibility visible),
     from the title's own appearance.
   - THE NOISE MASK: pixels that change while the page sits with no input after it settled, with the plugin off,
     united over three runs; recorded per stop, and a mask over 2% of the page fails (the test would be blind).
   The shift log and the ledger are checked against each other (agreement()): a layout shift with no ledger jump at
   the same time is a hole in what the ledger tracks, reported so the test is fixed, not the page. Chrome reports no
   shift under 3 px and none for elements off screen, so only ledger jumps of 3 px or more on screen need a shift. */
const zlib = require('zlib');
const { MARK_CLASS, MARK_ATTR } = require('./marks');

// Logseq's landmarks on a page, by name. The first match of each selector is tracked under that name.
const LANDMARKS = {
  title: '#main-content-container .ls-page-title',
  'page properties': '#main-content-container .ls-page-properties',
  'page blocks': '#main-content-container .ls-page-blocks',
  'first block': '#main-content-container .ls-page-blocks .ls-block',
  'linked references': '#main-content-container .references',
  'references heading': '#main-content-container .references .ls-foldable-title, #main-content-container .references h2',
  'property name': '#main-content-container .ls-page-properties .property-key-inner, #main-content-container .ls-page-properties .property-key',
  'property value': '#main-content-container .ls-page-properties .property-value-container',
  // The button before a property's name, where Logseq draws its dot and the plugin its kind icon.
  'property button': '#main-content-container .ls-page-properties .property-m',
  'tag corner': '#main-content-container .ls-page-title .ls-block-right',
  'sidebar item': '#right-sidebar .sidebar-item',
  'tag map': '.refinement-tags',
};
// The plugin's pieces whose arrival is timed (section 3.3), by name.
const PIECES = {
  'two-way rows': '.refinement-two-way:not([data-rf-waiting]) .rf-tw-row',
  'tag chain': '.rf-tag-path',
  'kind icons': '.property-m > .rf-kind',
  'tag map rows': '.refinement-tags .rtg-row, .refinement-tags [class*="rtg-"]',
};

/* The ledger and the shift log, injected into the page (a function's text; run it with its arguments). It keeps
   window.__rfFrames = { frames, inputs, shifts, loafs, pieces, landmarks, input(name), stop() }. Each frame is
   [t, changes, gone]: changes are [id, top, left, width, height, opacity×1000, visible, colour, background], gone the
   ids no longer in the document; every id is described once in `names` (id → 'landmark: title' or 'tag.cls.cls'). */
function ledgerSource() {
  return function install(markClass, markAttr, landmarks, pieces, cap) {
    if (window.__rfFrames) window.__rfFrames.stop();
    const MC = new RegExp(markClass), MA = new RegExp(markAttr);
    const ids = new WeakMap(), nodes = new Map(), names = {}, last = new Map(), frames = [], inputs = [], shifts = [], loafs = [];
    let next = 1, running = true;
    // capped: more marked elements than the ledger tracks; the test is then blind past them and says so.
    const state = { capped: false };
    const idOf = (node, name) => { let id = ids.get(node); if (!id) { id = next++; ids.set(node, id); names[id] = name; } return id; };
    const describe = node => node.tagName.toLowerCase() + [...node.classList].filter(c => MC.test(c)).slice(0, 2).map(c => '.' + c).join('')
      + [...node.attributes].filter(a => MA.test(a.name)).slice(0, 1).map(a => `[${a.name}]`).join('');
    const own = node => [...node.attributes].some(a => MA.test(a.name)) || (typeof node.className === 'string' && [...node.classList].some(c => MC.test(c)));
    const tracked = () => {
      const out = [];
      for (const [name, selector] of Object.entries(landmarks)) { const node = document.querySelector(selector); if (node) out.push([node, 'landmark: ' + name]); }
      // The plugin's marks: walk the document once (querySelectorAll('*') with a test is fast enough at a few thousand nodes).
      let n = 0;
      for (const node of document.body.querySelectorAll('*')) { if (own(node)) { if (n >= cap) { state.capped = true; break; } out.push([node, describe(node)]); n++; } }
      return out;
    };
    const opacityOf = (node, cache) => {
      if (!node || node.nodeType !== 1) return 1;
      if (cache.has(node)) return cache.get(node);
      const value = Number(getComputedStyle(node).opacity) * opacityOf(node.parentElement, cache);
      cache.set(node, value);
      return value;
    };
    const tick = () => {
      if (!running) return;
      const t = performance.now(), cache = new Map(), seen = new Set(), changes = [];
      for (const [node, name] of tracked()) {
        const id = idOf(node, name);
        nodes.set(id, node);
        if (seen.has(id)) continue;
        seen.add(id);
        const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
        const shown = r.width > 0 || r.height > 0 ? 1 : 0;
        const row = [id, Math.round(r.top * 10) / 10, Math.round(r.left * 10) / 10, Math.round(r.width), Math.round(r.height),
          Math.round(opacityOf(node, cache) * 1000), shown && cs.visibility === 'visible' ? 1 : 0, cs.color, cs.backgroundColor];
        const was = last.get(id);
        if (!was || row.some((v, k) => k && v !== was[k])) { changes.push(row); last.set(id, row); }
      }
      const gone = [];
      // An element is written as gone only when it left the document: one past the cap is not gone, only untracked.
      for (const id of [...last.keys()]) if (!seen.has(id) && !(state.capped && nodes.get(id)?.isConnected)) { gone.push(id); last.delete(id); nodes.delete(id); }
      if (changes.length || gone.length || !frames.length) frames.push([Math.round(t * 10) / 10, changes, gone]);
      requestAnimationFrame(tick);
    };
    const name = node => node && node.nodeType === 1 ? node.tagName.toLowerCase() + [...node.classList].slice(0, 3).map(c => '.' + c).join('') : (node ? '#text' : '(gone)');
    const box = r => r ? [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)] : null;
    const shiftWatch = new PerformanceObserver(list => {
      for (const e of list.getEntries()) shifts.push({ t: Math.round(e.startTime * 10) / 10, value: e.value, recent: e.hadRecentInput,
        sources: (e.sources || []).map(s => ({ node: name(s.node), own: !!(s.node && s.node.nodeType === 1 && s.node.closest && [s.node, ...ancestors(s.node)].some(own)), from: box(s.previousRect), to: box(s.currentRect) })) });
    });
    // Ancestors below <body>: the proposals mark <html> itself (rfs-hide-empty), which would make every node the plugin's.
    const ancestors = node => { const out = []; for (let p = node.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) out.push(p); return out; };
    shiftWatch.observe({ type: 'layout-shift', buffered: false });
    // Long frames and the scripts in them (Chrome's long-animation-frame): the plugin's are those whose script came
    // from its frame (its URL names the plugin).
    let loafWatch = null;
    try {
      loafWatch = new PerformanceObserver(list => { for (const e of list.getEntries()) loafs.push({ t: Math.round(e.startTime), d: Math.round(e.duration),
        blocking: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).map(s => ({ url: String(s.sourceURL || ''), fn: String(s.sourceFunctionName || ''), d: Math.round(s.duration) })) }); });
      loafWatch.observe({ type: 'long-animation-frame', buffered: false });
    } catch (error) { /* not in this browser */ }
    requestAnimationFrame(tick);
    window.__rfFrames = {
      frames, inputs, shifts, loafs, names, landmarks, pieces,
      input: (what, exempt = true) => inputs.push([Math.round(performance.now() * 10) / 10, what, exempt]),
      now: () => performance.now(),
      timeOrigin: performance.timeOrigin,
      // What a piece is now, for appearance: the first matching shown element.
      stop: () => { running = false; shiftWatch.disconnect(); loafWatch?.disconnect(); },
      take: () => { const out = { frames: frames.splice(0), inputs: inputs.splice(0), shifts: shifts.splice(0), loafs: loafs.splice(0), names: { ...names }, capped: state.capped }; return out; },
    };
  };
}
// The arguments the ledger takes, with the kit's patterns.
const ledgerArgs = (cap = 20000) => [MARK_CLASS.source, MARK_ATTR.source, LANDMARKS, PIECES, cap];
// One stylesheet that stills the page while it is recorded: no caret, no animation, no transition (section 3.2).
const STILL_CSS = '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }';

/* PNG, decoded without a browser: 8-bit RGB or RGBA, not interlaced (what Chrome's screencast sends). Returns
   { width, height, data } with data as RGBA bytes. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, type = 0, depth = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`PNG of a kind not read here (depth ${depth}, type ${type}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4), line = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < width; x++) { const o = (y * width + x) * 4; out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2]; out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    line.copy(prev);
  }
  return { width, height, data: out };
}
// A PNG from RGBA bytes (for the pictures a failing run leaves to look at).
function encodePng({ width, height, data }) {
  const crcTable = encodePng.table ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (kind, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const kb = Buffer.concat([Buffer.from(kind, 'ascii'), body]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(kb)); return Buffer.concat([len, kb, c]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const CHANNEL = 24;
// The pixels that differ between two pictures of one size: a bitmap (1 = changed) with its count and bounding box.
function diff(a, b, mask) {
  const n = a.width * a.height, out = new Uint8Array(n);
  let count = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  if (a.width !== b.width || a.height !== b.height) return { bits: out.fill(1), count: n, box: [0, 0, a.width, a.height], whole: true };
  for (let i = 0; i < n; i++) {
    if (mask && mask[i]) continue;
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) > CHANNEL || Math.abs(a.data[o + 1] - b.data[o + 1]) > CHANNEL || Math.abs(a.data[o + 2] - b.data[o + 2]) > CHANNEL) {
      out[i] = 1; count++;
      const x = i % a.width, y = (i / a.width) | 0;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
  }
  return { bits: out, count, box: count ? [x0, y0, x1 + 1, y1 + 1] : null };
}
// Regions of at least 16×16 px in a bitmap: each 16 px tile with any change, joined by touching tiles.
function regions(bits, width, height, least = 16) {
  const tw = Math.ceil(width / least), th = Math.ceil(height / least), tiles = new Uint8Array(tw * th);
  for (let i = 0; i < bits.length; i++) if (bits[i]) tiles[((i / width / least) | 0) * tw + (((i % width) / least) | 0)] = 1;
  const seen = new Uint8Array(tw * th), out = [];
  for (let s = 0; s < tiles.length; s++) {
    if (!tiles[s] || seen[s]) continue;
    const stack = [s], cells = [];
    seen[s] = 1;
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
      const cx = c % tw, cy = (c / tw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, nc = ny * tw + nx;
        if (nx >= 0 && ny >= 0 && nx < tw && ny < th && tiles[nc] && !seen[nc]) { seen[nc] = 1; stack.push(nc); }
      }
    }
    const xs = cells.map(c => c % tw), ys = cells.map(c => (c / tw) | 0);
    const box = [Math.min(...xs) * least, Math.min(...ys) * least, Math.min(width, (Math.max(...xs) + 1) * least), Math.min(height, (Math.max(...ys) + 1) * least)];
    let px = 0;
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) px += bits[y * width + x];
    // A region counts when its changed pixels span at least 16×16 (a 16 px tile with one stray pixel does not).
    const span = (() => { let a = Infinity, b = -1, c = Infinity, d = -1; for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (bits[y * width + x]) { if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y; } return [b - a + 1, d - c + 1]; })();
    if (span[0] >= least && span[1] >= least) out.push({ box, px });
  }
  return out;
}

/* The ledger read back: for each id, its rows over time ([t, row] with row null when gone). */
function timelines(ledger) {
  const lines = new Map();
  for (const [t, changes, gone] of ledger.frames) {
    for (const row of changes) { if (!lines.has(row[0])) lines.set(row[0], []); lines.get(row[0]).push([t, row]); }
    for (const id of gone) { if (!lines.has(id)) lines.set(id, []); lines.get(id).push([t, null]); }
  }
  return lines;
}
const shownRow = row => row && (row[3] > 0 || row[4] > 0) && row[5] > 0 && row[6] === 1;
const inputBefore = (ledger, t, ms) => ledger.inputs.some(([ti, , exempt]) => exempt && ti <= t && t - ti < ms);

// Jumps: a shown element that moved between two of its consecutive rows (its rows change only when something did).
function jumps(ledger) {
  const out = [];
  for (const [id, line] of timelines(ledger)) {
    for (let k = 1; k < line.length; k++) {
      const [t, row] = line[k], [, was] = line[k - 1];
      if (!shownRow(row) || !shownRow(was)) continue;
      const dy = row[1] - was[1], dx = row[2] - was[2];
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
      if (inputBefore(ledger, t, 500)) continue;
      out.push({ t, id, name: ledger.names[id], dy: Math.round(dy * 10) / 10, dx: Math.round(dx * 10) / 10, top: row[1], size: [row[3], row[4]] });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
/* Jumps from the shift log: a layout shift with no recent input is a jump (section 3.2), named after its source node.
   Kept apart from the ledger's so the two witnesses can be compared; a shift of an element the plugin draws, or one
   inside it, is named as the plugin's. */
function shiftJumps(ledger) {
  const out = [];
  for (const s of ledger.shifts) {
    // The browser's own flag knows only real input; the test's own presses get the ledger's 500 ms too.
    if (s.recent || inputBefore(ledger, s.t, 500)) continue;
    for (const src of s.sources) {
      if (!src.from || !src.to) continue;
      // An element shrinking to nothing or growing from nothing is it leaving or arriving, not a move.
      if (!src.to[2] && !src.to[3]) continue;
      if (!src.from[2] && !src.from[3]) continue;
      const dy = src.to[0] - src.from[0], dx = src.to[1] - src.from[1];
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
      out.push({ t: s.t, name: (src.own ? '' : 'logseq: ') + src.node, dy, dx, top: src.to[0], size: [src.to[2], src.to[3]], value: s.value, shift: true });
    }
  }
  return out;
}
// Flashes in the ledger (elements and their look), as the header defines them.
function elementFlashes(ledger, ms = 250) {
  const out = [], lines = timelines(ledger);
  const near = (a, b) => a && b && Math.abs(a[1] - b[1]) < 2 && Math.abs(a[2] - b[2]) < 2;
  for (const [id, line] of lines) {
    const name = ledger.names[id];
    // Shown spans: [from, to) where the element was shown.
    const spans = [];
    let from = null, lastRow = null;
    for (const [t, row] of line) {
      if (shownRow(row) && from === null) from = t;
      if (!shownRow(row) && from !== null) { spans.push([from, t, lastRow]); from = null; }
      if (shownRow(row)) lastRow = row;
    }
    for (const [a, b, row] of spans) {
      if (b - a > ms || inputBefore(ledger, b, 500)) continue;
      // Replaced in place by its twin (same kind, same spot) by the frame it went: not seen to flash.
      const twin = [...lines].some(([other, l2]) => other !== id && ledger.names[other] === name && l2.some(([t2, r2]) => t2 <= b && t2 >= a && shownRow(r2) && near(r2, row)));
      if (!twin) out.push({ t: a, until: b, id, name, what: 'shown and gone' });
    }
    for (let k = 1; k < spans.length; k++) if (spans[k][0] - spans[k - 1][1] <= ms && !inputBefore(ledger, spans[k][0], 500))
      out.push({ t: spans[k - 1][1], until: spans[k][0], id, name, what: 'gone and back' });
    // A look that changes and changes back: opacity, visibility, colour, background.
    for (const [field, k] of [['opacity', 5], ['visibility', 6], ['colour', 7], ['background', 8]]) {
      for (let i = 1; i < line.length; i++) {
        const [t, row] = line[i], [, was] = line[i - 1];
        if (!row || !was || row[k] === was[k] || inputBefore(ledger, t, 500)) continue;
        for (let j = i + 1; j < line.length && line[j][0] - t <= ms; j++) if (line[j][1] && line[j][1][k] === was[k]) { out.push({ t, until: line[j][0], id, name, what: `${field} changed and back (${was[k]} → ${row[k]})` }); break; }
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
/* Picture flashes: frames as [{ t, png }] (the page's clock), mask a bitmap (or null). A region of frame i (changed
   from i−1) that is back within 24 of frame i−1 by a frame j within 250 ms. Also gives settle: the last frame with a
   change outside the mask. */
function pictureFlashes(frames, mask, inputs, ms = 250) {
  const out = [];
  let settledAt = frames.length ? frames[0].t : 0;
  const decoded = frames.map(f => ({ t: f.t, img: f.img || decodePng(f.png) }));
  const quiet = (a, b) => !inputs.some(([t, , exempt]) => exempt && t >= a - 50 && t <= b);
  // Is every changed pixel of region (box, bits of frame i) back within 24 of frame i−1 in frame j? Only the box is read.
  const back = (before, later, bits, box, width) => {
    const [x0, y0, x1, y1] = box;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * width + x;
      if (!bits[k]) continue;
      const o = k * 4;
      if (Math.abs(before.data[o] - later.data[o]) > CHANNEL || Math.abs(before.data[o + 1] - later.data[o + 1]) > CHANNEL || Math.abs(before.data[o + 2] - later.data[o + 2]) > CHANNEL) return false;
    }
    return true;
  };
  for (let i = 1; i < decoded.length; i++) {
    const d = diff(decoded[i - 1].img, decoded[i].img, mask);
    if (!d.count) continue;
    settledAt = decoded[i].t;
    if (d.whole) continue; // the page changed size: not a flash
    const width = decoded[i].img.width;
    for (const region of regions(d.bits, width, decoded[i].img.height)) {
      for (let j = i + 1; j < decoded.length && decoded[j].t - decoded[i].t <= ms; j++) {
        if (decoded[j].img.width !== width) break;
        if (back(decoded[i - 1].img, decoded[j].img, d.bits, region.box, width) && quiet(decoded[i].t, decoded[j].t)) { out.push({ t: decoded[i].t, until: decoded[j].t, box: region.box, px: region.px, frames: [i - 1, i, j] }); break; }
      }
    }
  }
  return { flashes: out, settledAt, decoded };
}
// The noise mask: every pixel that changed between consecutive frames of still recordings (several runs united).
function noiseMask(runs) {
  let mask = null, width = 0, height = 0;
  for (const frames of runs) {
    const decoded = frames.map(f => f.img || decodePng(f.png));
    for (let i = 1; i < decoded.length; i++) {
      const d = diff(decoded[i - 1], decoded[i]);
      width = decoded[i].width; height = decoded[i].height;
      if (!mask) mask = new Uint8Array(width * height);
      for (let k = 0; k < d.bits.length; k++) if (d.bits[k]) mask[k] = 1;
    }
  }
  const size = mask ? mask.reduce((s, v) => s + v, 0) : 0;
  return { mask, share: width ? size / (width * height) : 0 };
}
// When each piece was first shown, from the ledger, measured from the title's own appearance.
function appearances(ledger, pieceNames) {
  const lines = timelines(ledger), first = {};
  for (const [id, line] of lines) {
    const name = ledger.names[id];
    const at = line.find(([, row]) => shownRow(row));
    if (!at) continue;
    const key = name.startsWith('landmark: ') ? name.slice(10) : name;
    if (first[key] === undefined || at[0] < first[key]) first[key] = at[0];
  }
  return first;
}
// The shift log against the ledger: shifts with no ledger jump within 50 ms, and ledger jumps of 3 px or more of an
// element on screen with no shift (the browser reports none smaller). Both are holes in the test, not in the page.
function agreement(ledger, found, viewport) {
  const shifts = ledger.shifts.filter(s => !s.recent);
  const lonelyShifts = shifts.filter(s => !found.some(j => Math.abs(j.t - s.t) <= 50));
  const onScreen = j => j.top < viewport.height && j.top + j.size[1] > 0;
  const lonelyJumps = found.filter(j => (Math.abs(j.dy) >= 3 || Math.abs(j.dx) >= 3) && onScreen(j) && !shifts.some(s => Math.abs(j.t - s.t) <= 50));
  return { lonelyShifts, lonelyJumps };
}
/* Whose is it: a jump in B is Logseq's when the same landmark moved the same way in an A run by as much or more (with
   a 25% or 4 px margin): the plugin may make Logseq's own move smaller (Tingling fingers: Logseq's bullets drop 243 px
   while its property area and tag list arrive; with the rows holding their room, 80 px), never larger. Every jump of
   the plugin's own element, every larger one and every one A does not have, is the plugin's. */
function signature(j) { return { name: j.name.replace(/ #\d+$/, ''), dy: Math.sign(Math.round(j.dy)), dx: Math.sign(Math.round(j.dx)), size: Math.round(Math.max(Math.abs(j.dy), Math.abs(j.dx))) }; }
function matches(sig, known) {
  return known.some(k => k.name === sig.name && k.dy === sig.dy && k.dx === sig.dx && sig.size <= k.size + Math.max(4, k.size * 0.25));
}
/* Growth of Logseq's landmarks: [t, name, top, change in height] for every frame a landmark's height changed (or it
   appeared, from 0). A plugin element pushed down in the frame a Logseq landmark above it grew by the same amount (±2
   px) was pushed by Logseq, when the plugin-off run (A) has that landmark growing by as much too. */
function growths(ledger) {
  const out = [];
  for (const [id, line] of timelines(ledger)) {
    const name = ledger.names[id];
    if (!name.startsWith('landmark: ')) continue;
    for (let k = 0; k < line.length; k++) {
      const [t, row] = line[k], was = k ? line[k - 1][1] : null;
      const before = shownRow(was) ? was[4] : 0, now = shownRow(row) ? row[4] : 0;
      if (now !== before) out.push({ t, name, top: row ? row[1] : 0, grew: now - before });
    }
  }
  return out;
}
function pushedByLogseq(j, growB, growA) {
  if (!j.dy || j.dx) return false;
  return growB.some(g => Math.abs(g.t - j.t) <= 20 && g.top < j.top && Math.abs(g.grew - j.dy) <= 2
    && growA.some(a => a.name === g.name && a.grew >= g.grew - 2));
}
function attribute(jumpsB, knownSigs, growB = [], growA = []) {
  return jumpsB.map(j => {
    const sig = signature(j);
    const ownEl = !j.name.startsWith('landmark: ') && !j.name.startsWith('logseq: ');
    const logseq = ownEl ? pushedByLogseq(j, growB, growA) : matches(sig, knownSigs);
    return { ...j, sig, whose: logseq ? 'logseq' : 'plugin' };
  });
}
// Picture flashes in B that overlap one seen in A are Logseq's.
function attributeFlashes(flashesB, flashesA) {
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  return flashesB.map(f => ({ ...f, whose: flashesA.some(g => overlap(g.box, f.box)) ? 'logseq' : 'plugin' }));
}
// A picture of two frames with the changed pixels in red (as tools/pictures.js draws -changes.png).
function changesPicture(before, after) {
  const d = diff(before, after);
  const data = Buffer.from(after.data);
  for (let i = 0; i < d.bits.length; i++) {
    const o = i * 4;
    if (d.bits[i]) { data[o] = 230; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255; }
    else { data[o] = 255 - ((255 - data[o]) >> 2); data[o + 1] = 255 - ((255 - data[o + 1]) >> 2); data[o + 2] = 255 - ((255 - data[o + 2]) >> 2); }
  }
  return encodePng({ width: after.width, height: after.height, data });
}

/* The screencast over a CDP session: start, collect frames on the page's clock, stop. The screencast stamps a frame by
   the wall clock (metadata.timestamp, seconds since the epoch); the page's clock is performance.now(), which drifts
   from the wall clock in a page open for days (and stops while the Mac sleeps), so the two are tied together afresh
   for every recording: offset = Date.now() − performance.now(), read in the page just before (wallOffset(page)). */
const wallOffset = page => page.evaluate(() => Date.now() - performance.now());
async function screencast(session, { offset, width, height }) {
  if (typeof offset !== 'number') throw new Error('screencast needs the page\'s wall-clock offset');
  const frames = [];
  const onFrame = async ({ data, metadata, sessionId }) => {
    frames.push({ t: Math.round((metadata.timestamp * 1000 - offset) * 10) / 10, png: Buffer.from(data, 'base64') });
    try { await session.send('Page.screencastFrameAck', { sessionId }); } catch (error) { /* stopped meanwhile */ }
  };
  session.on('Page.screencastFrame', onFrame);
  await session.send('Page.startScreencast', { format: 'png', quality: 100, everyNthFrame: 1, maxWidth: width, maxHeight: height });
  return {
    frames,
    stop: async () => { try { await session.send('Page.stopScreencast'); } catch (error) { /* gone */ } session.off('Page.screencastFrame', onFrame); return frames; },
  };
}

module.exports = { LANDMARKS, PIECES, ledgerSource, ledgerArgs, STILL_CSS, decodePng, encodePng, diff, regions, timelines, jumps, shiftJumps, elementFlashes,
  pictureFlashes, noiseMask, appearances, agreement, signature, matches, growths, attribute, attributeFlashes, changesPicture, screencast, wallOffset, shownRow };
