/* The guard's comparison (18 November 2026): each screen of the tour on the plugin as it was (before) and as changed (after).
   Pictures are compared in a browser page, cell by cell (8 × 8 px): a cell counts as changed when its pixels differ by more than a
   faint shade; cells that differ between a side's own two pictures (700 ms apart) are the screen's restlessness and do not count.
   Changed cells that touch are joined into boxes, drawn in red on the after picture. The pieces whose place, size or words differ
   between the two layout records, inside a box or appearing or going, are named beside it. */
const fs = require('node:fs'), path = require('node:path');

const CELL = 8;
const IN_PAGE = async ([a, a2, b, b2, CELL]) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const pix = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
  const [A, A2, B, B2] = (await Promise.all([a, a2, b, b2].map(load))).map(pix);
  const W = Math.max(A.width, B.width), H = Math.max(A.height, B.height), cw = Math.ceil(W / CELL), ch = Math.ceil(H / CELL);
  const cellDiff = (P, Q) => {
    const out = new Uint8Array(cw * ch);
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let n = 0;
      for (let y = cy * CELL; y < Math.min(H, cy * CELL + CELL); y++) for (let x = cx * CELL; x < Math.min(W, cx * CELL + CELL); x++) {
        if (x >= P.width || y >= P.height || x >= Q.width || y >= Q.height) { n++; continue; }
        const i = (y * P.width + x) * 4, j = (y * Q.width + x) * 4;
        const d = Math.abs(P.data[i] - Q.data[j]) + Math.abs(P.data[i + 1] - Q.data[j + 1]) + Math.abs(P.data[i + 2] - Q.data[j + 2]);
        if (d > 24) n++;
      }
      out[cy * cw + cx] = n > 1 ? 1 : 0;
    }
    return out;
  };
  const restless = cellDiff(A, A2), restless2 = cellDiff(B, B2), changed = cellDiff(A, B);
  for (let i = 0; i < changed.length; i++) if (restless[i] || restless2[i]) changed[i] = 0;
  // Join touching cells (one empty cell of slack) into boxes.
  const seen = new Uint8Array(changed.length), boxes = [];
  for (let i = 0; i < changed.length; i++) {
    if (!changed[i] || seen[i]) continue;
    const stack = [i]; seen[i] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    while (stack.length) {
      const k = stack.pop(), x = k % cw, y = (k / cw) | 0; n++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue; const m = ny * cw + nx; if (changed[m] && !seen[m]) { seen[m] = 1; stack.push(m); } }
    }
    boxes.push({ x: x0 * CELL, y: y0 * CELL, w: (x1 - x0 + 1) * CELL, h: (y1 - y0 + 1) * CELL, cells: n });
  }
  // The after picture with the boxes drawn on it.
  const c = document.createElement('canvas'); c.width = B.width; c.height = B.height; const x = c.getContext('2d'); x.putImageData(B, 0, 0);
  x.strokeStyle = '#e0245e'; x.lineWidth = 3; for (const b of boxes) x.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  let restlessCells = 0; for (let i = 0; i < restless.length; i++) restlessCells += restless[i] | restless2[i];
  return { boxes, marked: c.toDataURL('image/png'), restlessCells, size: [W, H] };
};

const overlap = (r, b) => r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y;

// What moved, came or went, by name, near the changed boxes.
function moved(before = {}, after = {}, boxes = []) {
  const out = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[k], b = after[k];
    if (a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.words === b.words) continue;
    const r = b || a;
    if (boxes.length && !boxes.some(x => overlap(r, x))) continue;
    const name = k.replace(/#1$/, '');
    if (!a) out.push(`${name} came: “${b.words}”`);
    else if (!b) out.push(`${name} went: “${a.words}”`);
    else if (a.words !== b.words) out.push(`${name} reads “${b.words}” (was “${a.words}”)`);
    else out.push(`${name} ${a.x !== b.x || a.y !== b.y ? `moved ${b.x - a.x}, ${b.y - a.y} px` : ''}${a.w !== b.w || a.h !== b.h ? ` now ${b.w} × ${b.h} (was ${a.w} × ${a.h})` : ''}`.trim());
  }
  return out.slice(0, 12);
}

async function compare(beforeDir, afterDir, recsBefore, recsAfter, outDir) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const results = [];
  for (const b of recsAfter) {
    const a = recsBefore.find(r => r.name === b.name) || { name: b.name, missing: true };
    const res = { name: b.name, graph: b.graph, file: b.file, notes: [] };
    if (b.failed && !a.failed) res.notes.push({ kind: 'fails', said: `the screen could not be set up after the change: ${b.failed}` });
    if (b.failed || a.failed || a.missing) { res.notes.push({ kind: 'info', said: `not compared: ${b.failed || a.failed || 'no before'}` }); results.push(res); continue; }
    const got = await page.evaluate(IN_PAGE, [path.join(beforeDir, a.file + '.png'), path.join(beforeDir, a.file + '.again.png'), path.join(afterDir, b.file + '.png'), path.join(afterDir, b.file + '.again.png')].map(uri).concat([CELL]));
    res.boxes = got.boxes;
    res.restless = got.restlessCells;
    if (got.boxes.length) {
      fs.writeFileSync(path.join(outDir, b.file + '.marked.png'), Buffer.from(got.marked.split(',')[1], 'base64'));
      res.notes.push({ kind: 'looks', said: `${got.boxes.length} place${got.boxes.length > 1 ? 's' : ''} on the screen look different`, what: moved(a.layout, b.layout, got.boxes) });
    }
    // A piece that came or went with no picture difference (drawn below the fold, or late): still a difference.
    if (!got.boxes.length) {
      const cameWent = moved(a.layout, b.layout, []).filter(w => / (came|went): /.test(w));
      if (cameWent.length) res.notes.push({ kind: 'looks', said: `pieces came or went that the picture does not show`, what: cameWent });
    }
    const errs = (b.console || []).filter(t => !(a.console || []).includes(t));
    if (errs.length) res.notes.push({ kind: 'errors', said: `the console says something new: ${errs[0]}` });
    if (b.wrong && !a.wrong) res.notes.push({ kind: 'errors', said: 'Logseq shows “Something went wrong”' });
    const nA = a.churn?.n || 0, nB = b.churn?.n || 0;
    if (nB > Math.max(20, 3 * nA)) res.notes.push({ kind: 'restless', said: `the screen keeps changing by itself: ${nB} changes in 1.5 s once still (was ${nA}), most in ${(b.churn.who[0] || [])[0]}` });
    results.push(res);
  }
  await browser.close();
  return results;
}

module.exports = { compare };
