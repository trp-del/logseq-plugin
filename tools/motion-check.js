#!/usr/bin/env node
/* Measures what the plugin draws moving in the real Logseq, and says what caused each fault. Every stop (a page, a route, an
   action on a page) is recorded with the plugin off (A) and on (B), with the three witnesses of tools/frame-kit.js: the
   ledger (every element a module marks, and Logseq's landmarks, frame by frame), the browser's layout-shift log and the
   screencast's pictures. It needs Logseq started with its debugging port (open -a Logseq --args --remote-debugging-port=9222)
   on a test graph, and Playwright (NODE_PATH); without them it says so and stops (exit 2).

   What it measures, B against A on the same stop and theme (the definitions are the kit's header):
   - a JUMP that is the plugin's: any move of a module's own element with no input just before, or a move of Logseq's own that
     A does not have (same element, same way, about as far);
   - a FLASH that is the plugin's: an element shown and gone, gone and back, or changing its look and back within 250 ms; a
     picture region that flashes where A has none;
   - a LATE PIECE: the two-way rows later than 1000 ms after the title on the first visit, 100 ms on the second; the tag chain
     and the kind icons later than 50 ms; a property name first shown in another colour than it keeps;
   - SETTLING more than 100 ms later than without the plugin; a long frame (over 50 ms) with the plugin's code in it;
   - OUT OF PLACE, once the page is still: a tag of a bullet not on the bullets' one right edge, a day in a list's margin
     not on the days' one right edge, a chevron not on its list's one column, a module's element reaching past the main
     pane's right edge, or a module's element lying over Logseq's words.
   A failing measure is run again twice and fails only when all three fail; one or two are written as noise.

   What it deciphers, for each fault:
   - WHOSE the moving or misplaced element is, from its marks (Look, Find, Predictive, Structure, DB Export, Threads);
   - the CAUSE of a jump from the ledger: what came or grew above the mover in that frame, and whose it is;
   - with --blame, the SCRIPT: the stop is recorded once more with the blame log, which writes every change to the page with
     the function and file that made it, and each jump or flash is laid to the changes just before it above or on the mover.

   It touches only the three test graphs (read first; stopped otherwise), switches the plugin off and on through Logseq's own
   plugin core, writes nothing to the graph, and leaves the app as it found it: the plugin on, the theme, the page and the
   sidebar as they were, nothing of its own left in the page (also on failure or Ctrl-C).

     node tools/motion-check.js                            the usual stops, light
     node tools/motion-check.js --stops "Dr. Mei Chen; Consultation; sidebar:Dr. Mei Chen; find; #/structure" --themes light,dark
     node tools/motion-check.js --blame                    also name the script behind each fault
     node tools/motion-check.js --quiet                    wait for a quiet Mac first (load under 2, no input for 120 s)
   A stop is a page by name; "sidebar:<page>" opens the right sidebar on it; "find" opens Find's window and closes it;
   "#/…" is a route. Pictures and reports: dist/motion-check/<theme>-<stop>/. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const K = require('./frame-kit');
const D = require('../threads/tools/app-door');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'motion-check');
const knownFile = path.join(root, 'test', 'motion', 'known-logseq.json');
const arg = (name, fallback) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : fallback; };
const flag = name => process.argv.includes(name);
const STOPS = arg('--stops', 'Dr. Mei Chen; Consultation; Oct 23rd, 2026; sidebar:Dr. Mei Chen; find; #/structure').split(';').map(s => s.trim()).filter(Boolean);
const THEMES = arg('--themes', 'light').split(',').map(s => s.trim());
const RUNS_A = Number(arg('--runs-a', 2));
const NEUTRAL = 'all-pages';
const BUDGET = { rowsFirst: 1000, rowsAgain: 100, withTitle: 50, settle: 100, longFrame: 50, mask: 0.02 };
const sleep = D.sleep;
const known = fs.existsSync(knownFile) ? JSON.parse(fs.readFileSync(knownFile, 'utf8')) : {};

async function waitForQuiet() {
  for (let minute = 0; minute < 60; minute++) {
    const load = Number(execSync('sysctl -n vm.loadavg').toString().replace(/[{}]/g, '').trim().split(/\s+/)[0]);
    const idle = Number(execSync(`ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'`).toString());
    if (load < 2 && idle > 120) return;
    console.log(`  waiting for a quiet Mac (load ${load}, idle ${Math.round(idle)} s)`);
    await sleep(60000);
  }
  throw new Error('the Mac was not quiet for an hour');
}

/* A stop taken apart: its page (or route) and its action. The action runs once the page has settled, and is written to the
   ledger as input (so what it moves on purpose is not a jump), and undone before the next stop. */
function parseStop(stop) {
  if (stop.startsWith('sidebar:')) return { page: stop.slice(8).trim(), action: 'sidebar', label: stop };
  if (stop === 'find') return { page: 'Dr. Mei Chen', action: 'find', label: stop };
  return { page: stop, action: null, label: stop };
}
async function act(page, action, on) {
  if (action === 'sidebar') await page.evaluate(on => window.logseq.api.set_right_sidebar_visible(on), on);
  if (action === 'find') {
    const frame = D.plugin(page);
    if (!frame) return;
    await frame.evaluate(on => { const w = window.Find?.window; if (!w) return; if (on) w.open(); else w.close(); }, on).catch(() => {});
  }
}

let stopping = false;
const halt = () => { if (stopping) throw new Error('stopped'); };
/* One visit: from the neutral page to the stop, recorded until still, then the action (if any) and still again. With the
   plugin on a visit lasts 2600 ms at least (the two-way rows remember a page's room once it has settled two seconds). */
async function visit(page, session, vp, stop, idleMs, least = 1500, blame = false) {
  halt();
  await D.graphOk(page);
  const { page: name, action } = parseStop(stop);
  await D.go(page, NEUTRAL);
  await sleep(1200);
  halt();
  await page.evaluate(`(${K.ledgerSource()})(...${JSON.stringify(K.pluginLedgerArgs())})`);
  if (blame) await page.evaluate(`(${K.blameSource()})()`);
  const cast = await K.screencast(session, { ...vp, offset: await K.wallOffset(page) });
  await sleep(250);
  halt();
  const t0 = await page.evaluate(stop => { window.__rfFrames.input('route ' + stop, false); return window.__rfFrames.now(); }, name);
  await D.go(page, name);
  const settled = async (begun, leastMs) => {
    let lastCount = -1, still = Date.now();
    for (;;) {
      await sleep(100);
      if (stopping) return;
      const n = await page.evaluate(() => window.__rfFrames.frames.length) + cast.frames.length;
      if (n !== lastCount) { lastCount = n; still = Date.now(); }
      const age = Date.now() - begun;
      if ((Date.now() - still > 800 && age > leastMs) || age > 6000) return;
    }
  };
  await settled(Date.now(), least);
  let tAct = null;
  if (action) {
    tAct = await page.evaluate(a => { window.__rfFrames.input('action ' + a, true); return window.__rfFrames.now(); }, action);
    await act(page, action, true);
    await settled(Date.now(), 1200);
  }
  const settleEnd = await page.evaluate(() => window.__rfFrames.now());
  const placement = await page.evaluate(placementSource);
  await sleep(idleMs);
  const frames = await cast.stop();
  // The blame log is read for each jump and flash before the ledger goes, since it needs the elements themselves.
  const ledger = await page.evaluate(() => window.__rfFrames.take());
  let blamed = null;
  if (blame) {
    // Each event once: a group of jumps asks for its first few members, a flash for its element; the nearest change found counts.
    const events = [...K.groupJumps(K.jumps(ledger)).map(g => ({ kind: 'jump', t: g.t, dy: g.dy, dx: g.dx, ids: g.members.map(j => j.id).slice(0, 6), names: g.names, by: g.by })),
      ...K.elementFlashes(ledger).filter(f => !f.name.startsWith('landmark: ')).map(f => ({ kind: 'flash', t: f.t, until: f.until, ids: [f.id], names: [f.name], what: f.what }))].slice(0, 30);
    blamed = await page.evaluate(events => events.map(e => {
      let found = [], asked = 0;
      for (const id of e.ids) { const node = window.__rfFrames.nodeOf(id); if (!node) continue; asked++; found = window.__blame?.explain(node, e.t, 80) || []; if (found.length) break; }
      return { ...e, asked, found: found.slice(0, 6) };
    }), events);
    await page.evaluate(() => window.__blame?.stop());
  }
  await page.evaluate(() => { window.__rfFrames.stop(); delete window.__rfFrames; });
  if (action) { await act(page, action, false); await sleep(600); }
  return { t0, tAct, settleEnd, frames, ledger, placement, blamed };
}

/* Out of place, read in the page once it is still (the grammar's rows and edges; tools/motion-check.js header). Each finding
   names the element by its marks, so its module is known. */
const placementSource = `(() => {
  const out = [];
  const main = document.querySelector('#main-content-container');
  if (!main) return out;
  const mainRect = main.getBoundingClientRect();
  const desc = n => n.tagName.toLowerCase() + [...n.classList].filter(c => /^(lk-|fd-|flow-|st-|xp|th-|th-)/.test(c)).slice(0, 2).map(c => '.' + c).join('');
  const shown = n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility === 'visible'; };
  const edge = (nodes, side, what, within = 1) => {
    const xs = nodes.filter(shown).map(n => n.getBoundingClientRect()[side]);
    if (xs.length < 2) return;
    const sorted = [...xs].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
    const off = nodes.filter(shown).filter(n => Math.abs(n.getBoundingClientRect()[side] - median) > within);
    for (const n of off.slice(0, 5)) out.push({ what, name: desc(n), text: (n.textContent || '').trim().slice(0, 40), by: Math.round(n.getBoundingClientRect()[side] - median) });
  };
  // Tags keep one right edge: in each bullet with tags at its end, their right edges agree; across a page's bullets too.
  const tagEdges = [...main.querySelectorAll('.ls-block .block-tags, .ls-block-right')].filter(shown);
  edge(tagEdges, 'right', 'a bullet’s tags off the one right edge', 2);
  // Days in a list's margin, and chevrons in a list, each on one column.
  for (const list of main.querySelectorAll('.th-two-way .th-tw-list, .th-two-way')) {
    edge([...list.querySelectorAll(':scope .lk-day')], 'right', 'a day off the margin’s right edge');
    edge([...list.querySelectorAll(':scope .th-tw-line > .th-chev, :scope .th-tw-line > .th-chev-room')], 'left', 'a chevron off its list’s column');
  }
  // Nothing of a module's past the main pane's right edge.
  for (const n of main.querySelectorAll('[class*="lk-"], [class*="fd-"], [class*="flow-"], [class*="st-"], [class*="th-"], [class*="th-"]')) {
    if (!shown(n)) continue;
    const r = n.getBoundingClientRect();
    if (r.right > mainRect.right + 1 && r.width < mainRect.width) { out.push({ what: 'reaches past the pane’s right edge', name: desc(n), text: (n.textContent || '').trim().slice(0, 40), by: Math.round(r.right - mainRect.right) }); if (out.length > 60) break; }
  }
  // A module's own element lying over Logseq's words (neither holding the other).
  const own = [...main.querySelectorAll('.lk-own, .lk-path, .fd-own, .flow-ghost, .flow-made, .th-two-way .th-tw-row, .lk-picked, .st-holder')].filter(shown).slice(0, 300);
  const words = [...main.querySelectorAll('.ls-block .block-title-wrap, .ls-page-title .title, .property-key, .property-value-container')].filter(shown).slice(0, 400);
  const over = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  let n = 0;
  for (const o of own) { const ro = o.getBoundingClientRect(); for (const w of words) { if (o.contains(w) || w.contains(o)) continue; if (over(ro, w.getBoundingClientRect())) { out.push({ what: 'lies over Logseq’s words', name: desc(o), text: (w.textContent || '').trim().slice(0, 40) }); if (++n > 10) break; } } if (n > 10) break; }
  return out;
})()`;

const rel = (t, t0) => Math.round(t - t0);
function analyseA(runs) {
  for (const r of runs) if (!r.frames.some(f => f.t > r.t0)) throw new Error('blind: no pictures with the plugin off (is Logseq\'s window on screen?)');
  const jumpsA = runs.flatMap(r => [...K.jumps(r.ledger), ...K.shiftJumps(r.ledger)]);
  const growA = runs.flatMap(r => K.growths(r.ledger));
  const idle = runs.map(r => r.frames.filter(f => f.t >= r.settleEnd));
  const { mask, share } = K.noiseMask(idle);
  const pics = runs.map(r => K.pictureFlashes(r.frames.filter(f => f.t < r.settleEnd), mask, r.ledger.inputs));
  const settle = pics.map((p, k) => p.settledAt - runs[k].t0);
  return { known: jumpsA.map(K.signature), growA, flashesA: pics.flatMap(p => p.flashes), elFlashesA: runs.flatMap(r => K.elementFlashes(r.ledger)), mask, maskShare: share,
    settleA: settle.reduce((a, b) => a + b, 0) / Math.max(1, settle.length), placementA: runs.flatMap(r => r.placement) };
}
const moveWords = j => `${j.dy ? `${j.dy > 0 ? 'down' : 'up'} ${Math.abs(j.dy)} px` : ''}${j.dx ? `${j.dy ? ', ' : ''}${j.dx > 0 ? 'right' : 'left'} ${Math.abs(j.dx)} px` : ''}`;
const whose = name => K.moduleOf(name) || (name.startsWith('landmark: ') || name.startsWith('logseq: ') ? 'Logseq’s' : 'the plugin’s');
// What fails one B visit, against A, each fault with what it can be laid to.
function judge(run, A, vp, second) {
  const fails = [], notes = [], faults = [];
  const all = [...K.jumps(run.ledger), ...K.shiftJumps(run.ledger)];
  const ours = K.attribute(all, A.known, K.growths(run.ledger), A.growA).filter(j => j.whose === 'plugin');
  // One frame's moves the same way are one event: a box put in above them all.
  for (const g of K.groupJumps(ours)) {
    const cause = g.members.map(j => j.id ? K.causes(run.ledger, j)[0] : null).find(Boolean);
    const because = cause ? ` — ${cause.module || 'something'}’s ${cause.name} ${cause.grew > 0 ? 'came or grew by' : 'shrank by'} ${Math.abs(cause.grew)} px above` : '';
    const who = Object.entries(g.by).map(([m, n]) => `${n} of ${m === 'Logseq' ? 'Logseq’s' : m + '’s'}`).join(', ');
    const what = g.members.length === 1 ? `${whose(g.first.name)} ${g.names[0]}` : `${g.members.length} elements (${who}: ${[...new Set(g.names)].slice(0, 4).join(', ')}${g.names.length > 4 ? ', …' : ''})`;
    const text = `jump at ${rel(g.t, run.t0)} ms: ${what} moved ${moveWords(g)}${g.members.some(j => j.shift) ? ' (layout shift)' : ''}${because}`;
    fails.push(text); faults.push({ kind: 'jump', t: g.t, ids: g.members.map(j => j.id).filter(Boolean).slice(0, 6), text, cause });
  }
  // A flash of Logseq's own landmark is Logseq's drawing the page twice (its properties area comes twice on a page open),
  // and a module's element drawn inside it goes with it: both are noted, not faulted, unless the blame log lays the change to a module.
  const landmarkFlashes = K.elementFlashes(run.ledger).filter(f => f.name.startsWith('landmark: '));
  for (const f of K.elementFlashes(run.ledger)) {
    const landmark = f.name.startsWith('landmark: ');
    const withLogseq = !landmark && landmarkFlashes.some(g => Math.abs(g.t - f.t) <= 5 && Math.abs(g.until - f.until) <= 5);
    const text = `flash at ${rel(f.t, run.t0)}–${rel(f.until, run.t0)} ms: ${whose(f.name)} ${f.name.replace(/^landmark: /, '')}, ${f.what}`;
    if (landmark || withLogseq) { if (!notes.some(n => n.startsWith('Logseq drew'))) notes.push(`Logseq drew its page twice at ${rel(f.t, run.t0)}–${rel(f.until, run.t0)} ms (${landmark ? f.name.replace(/^landmark: /, '') : 'and ' + f.name + ' with it'})`); continue; }
    fails.push(text); faults.push({ kind: 'flash', t: f.t, ids: [f.id], text });
  }
  const after0 = run.frames.filter(f => f.t > run.t0).length;
  if (after0 < 1) fails.push('blind: no picture after the page was asked for (is Logseq\'s window on screen?)');
  if (run.ledger.capped) fails.push('blind: more marked elements than the ledger tracks');
  const pic = K.pictureFlashes(run.frames.filter(f => f.t < run.settleEnd), A.mask, run.ledger.inputs);
  for (const f of K.attributeFlashes(pic.flashes, A.flashesA)) if (f.whose === 'plugin')
    fails.push(`picture flash at ${rel(f.t, run.t0)}–${rel(f.until, run.t0)} ms in [${f.box.join(', ')}] (${f.px} px)`);
  const seen = K.appearances(run.ledger);
  const lines = K.timelines(run.ledger);
  const after = selectorNames => {
    const ids = Object.entries(run.ledger.names).filter(([, n]) => selectorNames.some(s => n === s || n.startsWith(s + '.'))).map(([id]) => Number(id));
    const times = ids.map(id => (lines.get(id) || []).find(([, row]) => K.shownRow(row))?.[0]).filter(t => t !== undefined);
    return times.length ? Math.min(...times) : undefined;
  };
  const piece = (label, names, budget, from = 'title') => {
    const t = after(names), base = seen[from];
    if (t === undefined || base === undefined) return;
    const late = Math.round(t - base);
    notes.push(`${label} ${late} ms after the ${from}`);
    if (late > budget) fails.push(`${label} shown ${late} ms after the ${from} (budget ${budget} ms)`);
  };
  piece('two-way rows', ['div.th-tw-row'], second ? BUDGET.rowsAgain : BUDGET.rowsFirst);
  piece('tag chain', ['span.lk-path', 'div.lk-path'], BUDGET.withTitle);
  piece('kind icons', ['i.lk-kind', 'span.lk-kind'], BUDGET.withTitle, 'property button');
  const nameLine = [...lines].find(([id]) => run.ledger.names[id] === 'landmark: property name')?.[1] || [];
  const shownName = nameLine.filter(([, row]) => K.shownRow(row));
  if (shownName.length && shownName[0][1][7] !== shownName[shownName.length - 1][1][7])
    fails.push(`a property name first shown in ${shownName[0][1][7]}, then ${shownName[shownName.length - 1][1][7]} (Look’s stylesheet landed after the words)`);
  const settle = pic.settledAt - run.t0;
  notes.push(`settled at ${Math.round(settle)} ms (without the plugin ${Math.round(A.settleA)} ms)`);
  if (settle - A.settleA > BUDGET.settle) {
    // What was still changing: the tracked elements of the last ledger frames before the page settled, by module.
    const late = run.ledger.frames.filter(([t]) => t > run.t0 + A.settleA + 50 && t <= pic.settledAt + 20).flatMap(([t, changes, gone]) => [...changes.map(c => [t, run.ledger.names[c[0]]]), ...gone.map(id => [t, run.ledger.names[id] + ' (gone)'])]);
    const by = {};
    for (const [, name] of late) { const who = K.moduleOf(name) || 'Logseq'; by[who] = (by[who] || 0) + 1; }
    const last = late.slice(-3).map(([t, name]) => `${name} at ${rel(t, run.t0)} ms`);
    fails.push(`settled ${Math.round(settle - A.settleA)} ms later than without the plugin (budget ${BUDGET.settle} ms)${late.length ? ` — still changing after it: ${Object.entries(by).map(([m, n]) => `${n} of ${m}’s`).join(', ')}; last ${last.join('; ')}` : ''}`);
  }
  for (const l of run.ledger.loafs) {
    const mine = l.scripts.map(s => ({ ...s, who: K.whoFrame(`at ${s.fn || 'anonymous'} (${s.url}:0:0)`) })).filter(s => s.who && s.who.module && s.who.module !== 'Logseq');
    if (l.d > BUDGET.longFrame && mine.length) fails.push(`a long frame of ${l.d} ms at ${rel(l.t, run.t0)} ms with ${mine.map(s => `${s.who.module}’s ${s.who.file} ${s.fn || ''} ${s.d} ms`).join(', ')}`);
  }
  // Out of place, less what Logseq's own page has without the plugin.
  const keyOf = p => `${p.what}|${p.name}|${p.text}`;
  const seenA = new Set(A.placementA.map(keyOf));
  for (const p of run.placement) if (!seenA.has(keyOf(p))) fails.push(`out of place: ${whose(p.name)} ${p.name} “${p.text}” ${p.what}${p.by ? ` by ${p.by} px` : ''}`);
  return { fails, notes, pic, faults };
}
// The blame log's answer for each fault of a run recorded with it: the nearest change above or on the mover, and its script.
function blameLines(run) {
  const out = [];
  for (const e of run.blamed || []) {
    const who = Object.entries(e.by || {}).map(([m, n]) => `${n} of ${m === 'Logseq' ? 'Logseq’s' : m + '’s'}`).join(', ');
    const head = e.kind === 'flash' ? `flash of ${whose(e.names[0])} ${e.names[0]} (${e.what})` : `jump of ${e.ids.length === 1 && e.names.length === 1 ? e.names[0] : `${e.names.length} elements (${who})`} ${moveWords(e)}`;
    if (!e.asked) { out.push(`    ${head} at ${rel(e.t, run.t0)} ms: its elements were gone before the log could be read`); continue; }
    if (!e.found.length) { out.push(`    ${head} at ${rel(e.t, run.t0)} ms: no change of the page within 80 ms before it stands above or on it (a style set through el.style, or a stylesheet)`); continue; }
    const top = e.found[0], made = K.whoMade(top.stack);
    out.push(`    ${head} at ${rel(e.t, run.t0)} ms: ${top.what} ${top.node ? `of ${top.node} ` : ''}${top.where === 'on' ? 'on' : top.where === 'inside' ? 'inside' : 'above'} it (${top.target}) at ${rel(top.t, run.t0)} ms, by ${made ? `${made.module}: ${made.file}${made.line ? ':' + made.line : ''}${made.fn ? ' ' + made.fn : ''}` : 'an unknown script'}`);
  }
  return out;
}
function slug(text) { return text.replace(/^#\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }
function writePictures(dir, run, pic, fails) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.rmSync(path.join(dir, f));
  const last = pic.decoded[pic.decoded.length - 1];
  if (last) fs.writeFileSync(path.join(dir, 'settled.png'), K.encodePng(last.img));
  const times = fails.map(text => Number((text.match(/at (\d+)/) || [])[1])).filter(n => !Number.isNaN(n));
  for (const t of [...new Set(times)].slice(0, 8)) {
    const i = pic.decoded.findIndex(f => f.t - run.t0 >= t);
    if (i <= 0) continue;
    fs.writeFileSync(path.join(dir, `${t}ms-before.png`), K.encodePng(pic.decoded[i - 1].img));
    fs.writeFileSync(path.join(dir, `${t}ms-after.png`), K.encodePng(pic.decoded[i].img));
    fs.writeFileSync(path.join(dir, `${t}ms-changes.png`), K.changesPicture(pic.decoded[i - 1].img, pic.decoded[i].img));
  }
}

(async () => {
  const { browser, page, graph } = await D.connect('motion-check');
  const session = await page.context().newCDPSession(page);
  const was = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, system: localStorage.getItem('system-theme?') === 'true', hash: location.hash }));
  const sidebarWas = await D.sidebarNow(page);
  const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const report = [], results = [];
  let restoring = null;
  const restore = () => (restoring ||= (async () => {
    let ok = true;
    try { await D.setPlugin(page, true); } catch (error) { console.log('PROBLEM: the plugin could not be switched back on: ' + error.message); ok = false; }
    const clean = () => page.evaluate(() => { document.getElementById('motion-check-still')?.remove(); window.__blame?.stop(); window.__rfFrames?.stop(); delete window.__rfFrames; }).catch(() => {});
    await clean();
    await act(page, 'find', false).catch(() => {});
    await D.sidebarBack(page, sidebarWas).catch(() => {});
    await page.evaluate(w => window.logseq.api.set_theme_mode(w.system ? 'system' : (w.theme || 'light')), was).catch(() => {});
    await page.evaluate(h => { location.hash = h; }, was.hash).catch(() => {});
    await sleep(300);
    await clean();
    await browser.close().catch(() => {});
    return ok;
  })());
  const onSignal = async () => { console.log('motion-check: stopped; putting the app back as it was'); stopping = true; await sleep(2000); await restore(); process.exit(130); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  let failed = 0;
  console.log(`motion-check: ${graph}, ${STOPS.length} stops × ${THEMES.join(' and ')}, the plugin off (${RUNS_A} runs) then on${flag('--blame') ? ', then once more with the blame log' : ''}`);
  try {
    if (flag('--quiet')) await waitForQuiet();
    await page.evaluate(css => { const st = document.createElement('style'); st.id = 'motion-check-still'; st.textContent = css; document.head.append(st); }, K.STILL_CSS);
    for (const theme of THEMES) {
      await page.evaluate(t => window.logseq.api.set_theme_mode(t), theme);
      await sleep(800);
      await D.setPlugin(page, false);
      const A = {};
      for (const stop of STOPS) {
        const plain = stop.startsWith('#/') || stop === 'find' ? 'Dr. Mei Chen' : stop;
        const runs = [];
        for (let k = 0; k < RUNS_A; k++) runs.push(await visit(page, session, vp, plain, 1500));
        A[stop] = analyseA(runs);
      }
      await D.setPlugin(page, true);
      for (const stop of STOPS) {
        const lines = [];
        let stopFails = [], deciphered = [];
        for (const second of [false, true]) {
          const tries = [];
          for (let k = 0; k < 3; k++) {
            const run = await visit(page, session, vp, stop, 0, 2600);
            Object.assign(run, { theme, stop });
            const verdict = judge(run, A[stop], vp, second);
            tries.push({ run, verdict });
            if (!verdict.fails.length) break;
          }
          const last = tries[tries.length - 1];
          const allFailed = tries.length === 3 && tries.every(t => t.verdict.fails.length);
          const label = second ? 'again' : 'first';
          if (A[stop].maskShare > BUDGET.mask) stopFails.push(`the noise mask covers ${(A[stop].maskShare * 100).toFixed(1)}% of the page (blind)`);
          if (allFailed) {
            stopFails.push(...last.verdict.fails.map(f => `${label}: ${f}`));
            // Deciphering with the blame log: the same visit once more, every change to the page with its script.
            if (flag('--blame') && last.verdict.faults.length) {
              const run = await visit(page, session, vp, stop, 0, 2600, true);
              Object.assign(run, { theme, stop });
              const found = blameLines(run);
              deciphered.push(`  ${label}, with the blame log:`, ...(found.length ? found : ['    the faults did not come back in the blame run (timing changed by the log); the ledger’s causes above stand']));
            }
          } else if (tries.length > 1) lines.push(`  ${label}: noise, failed ${tries.length - 1} of ${tries.length} (${tries[0].verdict.fails.join('; ')})`);
          lines.push(`  ${label}: ${last.verdict.notes.join('; ')}`);
          writePictures(path.join(outDir, `${theme}-${slug(stop)}`, label), last.run, last.verdict.pic, allFailed ? last.verdict.fails : []);
        }
        stopFails = [...new Set(stopFails)];
        failed += stopFails.length ? 1 : 0;
        const head = `${theme} · ${stop}: ${stopFails.length ? 'FAILED' : 'OK'} (mask ${(A[stop].maskShare * 100).toFixed(2)}%, Logseq’s own moves ${A[stop].known.length})`;
        const block = [head, ...lines, ...stopFails.map(f => '  PROBLEM: ' + f), ...deciphered];
        report.push(...block);
        console.log(block.join('\n'));
        results.push({ theme, stop, fails: stopFails, lines, deciphered });
        fs.mkdirSync(path.join(outDir, `${theme}-${slug(stop)}`), { recursive: true });
        fs.writeFileSync(path.join(outDir, `${theme}-${slug(stop)}`, 'report.txt'), block.join('\n') + '\n');
      }
    }
  } finally {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    if (!(await restore())) failed++;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ graph, when: new Date().toISOString(), results }, null, 1));
  fs.writeFileSync(path.join(outDir, 'report.txt'), report.join('\n') + '\n');
  console.log(failed ? `motion-check: FAILED (${failed} stops)` : 'motion-check: OK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
