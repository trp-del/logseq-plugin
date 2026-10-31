#!/usr/bin/env node
/* Frames of the real Logseq (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 3.5): every tour stop recorded with the
   plugin off (A) and on (B), with the three witnesses of tools/frame-kit.js (the ledger, the shift log and the
   screencast's pictures), and judged by the budgets of section 3.3. Needs Logseq started with its debugging port
   (open -a Logseq --args --remote-debugging-port=9222) and Playwright; without them it says so and stops (exit 2).

   What fails a stop (B, the plugin on, against A, the plugin off, on the same stop and theme):
   - a jump that is the plugin's: any move of an element the plugin draws, or a move of Logseq's own that A does not
     have (same element, same way, about as far);
   - a flash that is the plugin's: an element of the plugin shown and gone, gone and back, or changing its look and
     back within 250 ms; a picture region that flashes where A has none;
   - the two-way rows shown later than 1000 ms after the title on the first visit, 100 ms on the second; the tag chain
     and the kind icons later than 50 ms after the title; a property name first shown in another colour than it keeps;
   - the page settling more than 100 ms later than it does without the plugin;
   - a long frame (over 50 ms) with the plugin's code in it;
   - a noise mask over 2% of the page (the test would be blind).
   A failing measure is run again twice (section 3.3): three failures of three fail; one or two are written down as
   noise. Logseq's own jumps and flashes (A) are written to test/frames/known-logseq.json with --save-known.

   It touches only the three test graphs (it reads the open graph's name first and stops otherwise), switches the
   plugin off and on through Logseq's own plugin core, and leaves the app as it found it: the plugin on, the theme and
   the page as they were, its stylesheet and ledger gone (also on failure).

     node tools/app-frames.js                   every stop of the usual tour (docs/PROCESS.md), light and dark
     node tools/app-frames.js --stops "Dr. Mei Chen; Nausea" --themes light
     node tools/app-frames.js --save-known      also write Logseq's own movements to test/frames/known-logseq.json
     node tools/app-frames.js --now             do not wait for the Mac to be idle (the owner said so, 2026-10-23)
   Pictures and reports: check.log/frames/app/<theme>-<stop>/. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const K = require('./frame-kit');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'check.log/frames/app');
const knownFile = path.join(root, 'test/frames/known-logseq.json');
// The plugin's pieces each stop shows (the two-way rows, the tag chain, the kind icons), so one that stops showing fails.
const piecesFile = path.join(root, 'test/frames/app-pieces.json');
const expected = fs.existsSync(piecesFile) ? JSON.parse(fs.readFileSync(piecesFile, 'utf8')) : {};
const PLUGIN = 'logseq-threads';
const GRAPHS = ['Illness Test Graph', 'Seed Check', 'Stress Check'];
const arg = (name, fallback) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : fallback; };
const flag = name => process.argv.includes(name);
const STOPS = arg('--stops', 'Dr. Mei Chen; Consultation; Nausea; Northgate Cancer Center; Oxaliplatin; Tingling fingers; #/refinement-tags')
  .split(';').map(s => s.trim()).filter(Boolean);
const THEMES = arg('--themes', 'light,dark').split(',').map(s => s.trim());
const RUNS_A = Number(arg('--runs-a', 3));
const NEUTRAL = 'all-pages';
const BUDGET = { rowsFirst: 1000, rowsAgain: 100, withTitle: 50, settle: 100, longFrame: 50, mask: 0.02 };

let chromium;
try { ({ chromium } = require('playwright')); } catch (error) { console.log('app-frames: skipped (needs Playwright)'); process.exit(2); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The Mac must be quiet for measurements (section 4, "Load"): load under 2, and (unless --now) no input for 120 s.
async function waitForQuiet() {
  for (let minute = 0; minute < 60; minute++) {
    const load = Number(execSync('sysctl -n vm.loadavg').toString().replace(/[{}]/g, '').trim().split(/\s+/)[0]);
    const idle = Number(execSync(`ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'`).toString());
    if (load < 2 && (flag('--now') || idle > 120)) return { load, idle };
    console.log(`  waiting for a quiet Mac (load ${load}, idle ${Math.round(idle)} s)`);
    await sleep(60000);
  }
  throw new Error('the Mac was not quiet for an hour');
}

async function connect() {
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) {
    console.log('app-frames: Logseq is not reachable on its debugging port (start it with --remote-debugging-port=9222)'); process.exit(2);
  }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  if (!page || !(await page.evaluate(() => !!document.querySelector('#app-container')))) throw new Error('no Logseq main window');
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (!GRAPHS.includes(graph)) throw new Error(`the open graph is “${graph}”, not one of the test graphs; nothing was touched`);
  return { browser, page, graph };
}

// The plugin off or on through Logseq's own plugin core (the toggle in its Plugins panel does the same).
async function setPlugin(page, on) {
  await page.evaluate(async ([id, want]) => {
    const core = window.LSPluginCore, pl = core.registeredPlugins.get(id);
    if (!pl) throw new Error('the plugin is not installed');
    if (want && pl.disabled) await core.enable(id);
    if (!want && !pl.disabled) await core.disable(id);
  }, [PLUGIN, on]);
  // Wait until its kit is (or is no longer) on Logseq's page: the stylesheet the core sends first.
  for (let i = 0; i < 100; i++) {
    const has = await page.evaluate(() => !!document.querySelector('style[data-ref="logseq-threads"]'));
    if (has === on) break;
    await sleep(100);
  }
  await sleep(on ? 2500 : 800);
}

// The rooms the two-way rows remember for these stops, forgotten (as for a page never opened); returns what was there.
async function forgetRooms(page, stops) {
  return page.evaluate(async stops => {
    const rooms = JSON.parse(localStorage.getItem('refinementTwoWayRoom2') || '{}'), kept = {};
    for (const stop of stops) { if (stop.startsWith('#')) continue; const p = await window.logseq.api.get_page(stop.toLowerCase()); if (p?.uuid && p.uuid in rooms) { kept[p.uuid] = rooms[p.uuid]; delete rooms[p.uuid]; } }
    localStorage.setItem('refinementTwoWayRoom2', JSON.stringify(rooms));
    return kept;
  }, stops);
}
async function go(page, stop) {
  await page.evaluate(stop => {
    if (stop.startsWith('#')) location.hash = stop;
    else if (stop === 'all-pages') window.logseq.api.push_state('all-pages');
    else window.logseq.api.push_state('page', { name: stop.toLowerCase() });
  }, stop);
}

/* One visit: from the neutral page to the stop, recorded until still (no ledger change and no new picture for 800 ms,
   at least `least` ms, at most 6000 ms), then `idleMs` more with nothing done (for the noise mask). With the plugin on
   a visit lasts 2600 ms at least: the two-way rows remember a page's room only once it has settled two seconds, so a
   shorter visit would make every visit a first one. */
// Set when the run is stopped: a visit in flight stops at its next step, before it puts anything more in the page.
let stopping = false;
const halt = () => { if (stopping) throw new Error('stopped'); };
async function visit(page, session, vp, stop, idleMs, least = 1500) {
  halt();
  // The graph is read again before every visit: if the owner switched graphs meanwhile, nothing more is done.
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (!GRAPHS.includes(graph)) throw new Error(`the open graph became “${graph}” during the run; stopped`);
  await go(page, NEUTRAL);
  await sleep(1200);
  halt();
  await page.evaluate(`(${K.ledgerSource()})(...${JSON.stringify(K.ledgerArgs())})`);
  const cast = await K.screencast(session, { ...vp, offset: await K.wallOffset(page) });
  await sleep(250);
  halt();
  const t0 = await page.evaluate(stop => { window.__rfFrames.input('route ' + stop, false); return window.__rfFrames.now(); }, stop);
  await go(page, stop);
  const begun = Date.now();
  let lastCount = -1, still = Date.now();
  for (;;) {
    await sleep(100);
    if (stopping) break;
    const n = await page.evaluate(() => window.__rfFrames.frames.length) + cast.frames.length;
    if (n !== lastCount) { lastCount = n; still = Date.now(); }
    const age = Date.now() - begun;
    if ((Date.now() - still > 800 && age > least) || age > 6000) break;
  }
  const settleEnd = await page.evaluate(() => window.__rfFrames.now());
  await sleep(idleMs);
  const frames = await cast.stop();
  const ledger = await page.evaluate(() => { const l = window.__rfFrames.take(); window.__rfFrames.stop(); delete window.__rfFrames; return l; });
  return { t0, settleEnd, frames, ledger };
}

const rel = (t, t0) => Math.round(t - t0);
function analyseA(runs, vp) {
  for (const r of runs) if (!r.frames.some(f => f.t > r.t0)) throw new Error('blind: no pictures with the plugin off (is Logseq\'s window on screen?)');
  const jumpsA = runs.flatMap(r => [...K.jumps(r.ledger), ...K.shiftJumps(r.ledger)]);
  const growA = runs.flatMap(r => K.growths(r.ledger));
  const idle = runs.map(r => r.frames.filter(f => f.t >= r.settleEnd));
  const { mask, share } = K.noiseMask(idle);
  const pics = runs.map(r => K.pictureFlashes(r.frames.filter(f => f.t < r.settleEnd), mask, r.ledger.inputs));
  const flashesA = pics.flatMap(p => p.flashes);
  const elFlashesA = runs.flatMap(r => K.elementFlashes(r.ledger));
  const settle = pics.map((p, k) => p.settledAt - runs[k].t0);
  return { known: jumpsA.map(K.signature), growA, flashesA, elFlashesA, mask, maskShare: share, settleA: settle.reduce((a, b) => a + b, 0) / Math.max(1, settle.length), settleAll: settle };
}

// What fails one B visit, against A. `second` is the revisit (the rows' 100 ms budget).
function judge(run, A, vp, second) {
  const fails = [], notes = [];
  const all = [...K.jumps(run.ledger), ...K.shiftJumps(run.ledger)];
  for (const j of K.attribute(all, A.known, K.growths(run.ledger), A.growA)) if (j.whose === 'plugin')
    fails.push(`jump at ${rel(j.t, run.t0)} ms: ${j.name} moved ${j.dy ? `${j.dy > 0 ? 'down' : 'up'} ${Math.abs(j.dy)} px` : ''}${j.dx ? ` ${j.dx > 0 ? 'right' : 'left'} ${Math.abs(j.dx)} px` : ''}${j.shift ? ' (layout shift)' : ' (ledger)'}`);
  for (const f of K.elementFlashes(run.ledger)) {
    const landmark = f.name.startsWith('landmark: ');
    if (landmark && A.elFlashesA.some(g => g.name === f.name && g.what.split(' (')[0] === f.what.split(' (')[0])) continue;
    fails.push(`flash at ${rel(f.t, run.t0)}–${rel(f.until, run.t0)} ms: ${f.name}, ${f.what}`);
  }
  // Blind: no pictures after the page was asked for (Logseq's window hidden, on another Space, or minimised sends none),
  // or more of the plugin's elements than the ledger tracks.
  const after0 = run.frames.filter(f => f.t > run.t0).length;
  if (after0 < 1) fails.push(`blind: no picture after the page was asked for (is Logseq's window on screen?)`);
  if (run.ledger.capped) fails.push('blind: more of the plugin\'s elements than the ledger tracks');
  const pic = K.pictureFlashes(run.frames.filter(f => f.t < run.settleEnd), A.mask, run.ledger.inputs);
  for (const f of K.attributeFlashes(pic.flashes, A.flashesA)) if (f.whose === 'plugin')
    fails.push(`picture flash at ${rel(f.t, run.t0)}–${rel(f.until, run.t0)} ms in [${f.box.join(', ')}] (${f.px} px)`);
  const seen = K.appearances(run.ledger);
  const title = seen.title;
  const after = name => {
    const ids = Object.entries(run.ledger.names).filter(([, n]) => n === name).map(([id]) => Number(id));
    const lines = K.timelines(run.ledger);
    const times = ids.map(id => (lines.get(id) || []).find(([, row]) => K.shownRow(row))?.[0]).filter(t => t !== undefined);
    return times.length ? Math.min(...times) : undefined;
  };
  // Each piece is timed from what it sits in (DECISIONS-AUTONOMOUS.md, 2026-10-23): the rows and the tag chain from the
  // title; a kind icon from Logseq's own property button, which Logseq draws after the title.
  const shownPieces = [];
  const piece = (label, names, budget, from = 'title') => {
    const ts = names.map(after).filter(t => t !== undefined);
    const base = seen[from];
    if (ts.length) shownPieces.push(label);
    if (!ts.length || base === undefined) return;
    const late = Math.min(...ts) - base;
    notes.push(`${label} ${Math.round(late)} ms after the ${from}`);
    if (late > budget) fails.push(`${label} shown ${Math.round(late)} ms after the ${from} (budget ${budget} ms)`);
  };
  piece('two-way rows', ['div.rf-tw-row'], second ? BUDGET.rowsAgain : BUDGET.rowsFirst);
  piece('tag chain', ['span.rf-tag-path'], BUDGET.withTitle);
  piece('kind icons', ['i.rf-kind', 'i.rf-drawn', 'span.rf-kind'], BUDGET.withTitle, 'property button');
  // The page look: a property name keeps the colour it is first shown in.
  const nameLine = [...K.timelines(run.ledger)].find(([id]) => run.ledger.names[id] === 'landmark: property name')?.[1] || [];
  const shownName = nameLine.filter(([, row]) => K.shownRow(row));
  if (shownName.length && shownName[0][1][7] !== shownName[shownName.length - 1][1][7])
    fails.push(`a property name first shown in ${shownName[0][1][7]}, then ${shownName[shownName.length - 1][1][7]} at ${rel(shownName.find(([, r]) => r[7] === shownName[shownName.length - 1][1][7])[0], run.t0)} ms`);
  const settle = pic.settledAt - run.t0;
  notes.push(`settled at ${Math.round(settle)} ms (without the plugin ${Math.round(A.settleA)} ms)`);
  if (settle - A.settleA > BUDGET.settle) fails.push(`settled ${Math.round(settle - A.settleA)} ms later than without the plugin (budget ${BUDGET.settle} ms)`);
  for (const l of run.ledger.loafs) {
    const mine = l.scripts.filter(s => /logseq-plugin|refinements|lsp:\/\/logseq\.com\/external/.test(s.url));
    if (l.d > BUDGET.longFrame && mine.length) fails.push(`a long frame of ${l.d} ms at ${rel(l.t, run.t0)} ms with the plugin's code: ${mine.map(s => `${s.fn || '?'} ${s.d} ms`).join(', ')}`);
  }
  const agree = K.agreement(run.ledger, K.jumps(run.ledger), vp);
  if (agree.lonelyJumps.length) notes.push(`witnesses: ${agree.lonelyJumps.length} ledger jump(s) of 3 px or more with no layout shift`);
  // A piece this stop has always shown (test/frames/app-pieces.json, written with --save-known) must show.
  for (const want of expected[`${run.theme} · ${run.stop}`] || []) if (!shownPieces.includes(want)) fails.push(`${want} never showed`);
  return { fails, notes, pic, shownPieces };
}

function slug(text) { return text.replace(/^#\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }
function writePictures(dir, run, pic, fails) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.rmSync(path.join(dir, f));
  if (!fails.length) { const last = pic.decoded[pic.decoded.length - 1]; if (last) fs.writeFileSync(path.join(dir, 'settled.png'), K.encodePng(last.img)); return; }
  // The two frames around each failure, with the changed pixels in red.
  const times = fails.map(text => Number((text.match(/at (\d+)/) || [])[1])).filter(n => !Number.isNaN(n));
  let k = 0;
  for (const t of [...new Set(times)].slice(0, 8)) {
    const i = pic.decoded.findIndex(f => f.t - run.t0 >= t);
    if (i <= 0) continue;
    fs.writeFileSync(path.join(dir, `${t}ms-before.png`), K.encodePng(pic.decoded[i - 1].img));
    fs.writeFileSync(path.join(dir, `${t}ms-after.png`), K.encodePng(pic.decoded[i].img));
    fs.writeFileSync(path.join(dir, `${t}ms-changes.png`), K.changesPicture(pic.decoded[i - 1].img, pic.decoded[i].img));
    k++;
  }
  const last = pic.decoded[pic.decoded.length - 1];
  if (last) fs.writeFileSync(path.join(dir, 'settled.png'), K.encodePng(last.img));
}

(async () => {
  const { browser, page, graph } = await connect();
  const session = await page.context().newCDPSession(page);
  const was = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, system: localStorage.getItem('system-theme?') === 'true', hash: location.hash }));
  const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, timeOrigin: performance.timeOrigin }));
  const report = [], known = {}, results = [], pieces = {}, roomsKept = {};
  /* Leave the app as it was found, also when the run is stopped (Ctrl-C): the plugin on, the theme (or "follow the
     system") and the page as they were, the rooms the owner's visits remembered put back where no newer one was saved,
     nothing of this test left. */
  // One restore, however many ask for it: a second caller waits for the first to finish.
  let restoring = null;
  const restore = () => (restoring ||= restoreOnce());
  const restoreOnce = async () => {
    let ok = true;
    try { await setPlugin(page, true); } catch (error) { console.log('PROBLEM: the plugin could not be switched back on: ' + error.message); ok = false; }
    const clean = () => page.evaluate(() => { document.getElementById('rf-test-still')?.remove(); window.__rfFrames?.stop(); delete window.__rfFrames; }).catch(() => {});
    await clean();
    await page.evaluate(kept => { const rooms = JSON.parse(localStorage.getItem('refinementTwoWayRoom2') || '{}'); for (const [k, v] of Object.entries(kept)) if (!(k in rooms)) rooms[k] = v; localStorage.setItem('refinementTwoWayRoom2', JSON.stringify(rooms)); }, roomsKept).catch(() => {});
    await page.evaluate(w => window.logseq.api.set_theme_mode(w.system ? 'system' : (w.theme || 'light')), was).catch(() => {});
    await page.evaluate(h => { location.hash = h; }, was.hash).catch(() => {});
    await sleep(300);
    await clean();
    await browser.close().catch(() => {});
    return ok;
  };
  // Stopped: the visit in flight is let finish its current step (up to 2 s), then the app is put back, then the
  // clean-up runs once more for anything that step still put in the page.
  const onSignal = async () => {
    console.log('app-frames: stopped; putting the app back as it was');
    stopping = true;
    await sleep(2000);
    await restore();
    process.exit(130);
  };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  let failed = 0;
  console.log(`app-frames: ${graph}, ${STOPS.length} stops × ${THEMES.join(' and ')}, the plugin off (${RUNS_A} runs) then on (two visits)`);
  try {
    await waitForQuiet();
    await page.evaluate(css => { const st = document.createElement('style'); st.id = 'rf-test-still'; st.textContent = css; document.head.append(st); }, K.STILL_CSS);
    for (const theme of THEMES) {
      await page.evaluate(t => window.logseq.api.set_theme_mode(t), theme);
      await sleep(800);
      // A: the plugin off, every stop RUNS_A times.
      await setPlugin(page, false);
      const A = {};
      for (const stop of STOPS) {
        const runs = [];
        // The plugin's own views (#/refinement-…) do not exist with the plugin off; their A is a plain page of
        // Logseq's opened the same way (Nausea), which shows what Logseq itself does when a page opens.
        const plain = stop.startsWith('#/refinement') ? 'Nausea' : stop;
        for (let k = 0; k < RUNS_A; k++) runs.push(await visit(page, session, vp, plain, 1500));
        A[stop] = analyseA(runs, vp);
        known[`${theme} · ${stop}`] = { jumps: [...new Map(A[stop].known.map(s => [JSON.stringify(s), s])).values()], flashes: A[stop].flashesA.map(f => f.box), settle: A[stop].settleAll.map(Math.round), mask: Number(A[stop].maskShare.toFixed(5)) };
      }
      // B: the plugin on, every stop twice: a true first visit (the room the two-way rows remember for each stop is
      // forgotten before the plugin starts, as for a page never opened), then again (the room remembered by then).
      for (const [k, v] of Object.entries(await forgetRooms(page, STOPS))) if (!(k in roomsKept)) roomsKept[k] = v; // the owner's, not a run's
      await setPlugin(page, true);
      for (const stop of STOPS) {
        const lines = [];
        let stopFails = [];
        for (const second of [false, true]) {
          // A failing visit is run again twice; it fails only when all three fail (section 3.3).
          let tries = [];
          for (let k = 0; k < 3; k++) {
            // A first visit tried again is a first visit again: the room the first try saved is forgotten, and the
            // plugin restarted so it does not remember it either.
            if (!second && k) { await setPlugin(page, false); await forgetRooms(page, [stop]); await setPlugin(page, true); }
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
          if (allFailed) stopFails.push(...last.verdict.fails.map(f => `${label}: ${f}`));
          else if (tries.length > 1) lines.push(`  ${label}: noise, failed ${tries.length - 1} of ${tries.length} (${tries[0].verdict.fails.join('; ')})`);
          lines.push(`  ${label}: ${last.verdict.notes.join('; ')}`);
          writePictures(path.join(outDir, `${theme}-${slug(stop)}`, label), last.run, last.verdict.pic, allFailed ? last.verdict.fails : []);
          if (second) pieces[`${theme} · ${stop}`] = last.verdict.shownPieces;
        }
        stopFails = [...new Set(stopFails)];
        failed += stopFails.length ? 1 : 0;
        const head = `${theme} · ${stop}: ${stopFails.length ? 'FAILED' : 'OK'} (mask ${(A[stop].maskShare * 100).toFixed(2)}%, Logseq's own moves ${A[stop].known.length})`;
        report.push(head, ...lines, ...stopFails.map(f => '  PROBLEM: ' + f));
        console.log([head, ...lines, ...stopFails.map(f => '  PROBLEM: ' + f)].join('\n'));
        results.push({ theme, stop, fails: stopFails, lines });
        fs.writeFileSync(path.join(outDir, `${theme}-${slug(stop)}`, 'report.txt'), [head, ...lines, ...stopFails.map(f => '  PROBLEM: ' + f)].join('\n') + '\n');
      }
    }
  } finally {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    if (!(await restore())) failed++;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ graph, when: new Date().toISOString(), results, known }, null, 1));
  fs.writeFileSync(path.join(outDir, 'report.txt'), report.join('\n') + '\n');
  if (flag('--save-known')) {
    fs.mkdirSync(path.dirname(knownFile), { recursive: true });
    fs.writeFileSync(knownFile, JSON.stringify(known, null, 1) + '\n');
    fs.writeFileSync(piecesFile, JSON.stringify({ ...expected, ...pieces }, null, 1) + '\n');
    console.log('Logseq\'s own movements and the pieces each stop shows written to test/frames/');
  }
  console.log(failed ? `app-frames: FAILED (${failed} stops)` : 'app-frames: OK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
