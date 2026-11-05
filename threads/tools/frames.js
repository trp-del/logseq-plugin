#!/usr/bin/env node
/* Frames of what the plugin draws, in Chromium (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 3.5): the pretend pages of
   tools/pictures.js (tools/pretend-page.js) made to move, recorded with the three witnesses of the plugin's tools/frame-kit.js (the
   ledger, the shift log, the screencast's pictures). Each scene runs twice in each theme: A, the pretend Logseq page
   alone, doing what Logseq does (a page opening in steps, a list filling); B, the same with the plugin's piece drawing
   on it. The real app is recorded by the plugin's tools/motion-check.js; this one runs in seconds and inside tools/check.sh.

   Scenes:
   - two-way, first visit: Dr. Mei Chen's page opening as Logseq opens it (the title, then the property list 120 ms
     later, then one more property 180 ms after that), the rows drawn by the part's own draw() from a watcher on every
     change, with no room remembered; then the same page again with the room remembered (a revisit);
   - two-way, no properties: a page with none (Nausea's symptom logs), the rows under the title;
   - two-way, long list: a field with 1000 records, opened, "show all" pressed, then the part's own redraws;
   - tag map, page and sidebar: drawn, then redrawn twice with nothing changed;
   - proposals: a bullet being written, the proposals growing as words are typed (a guess, then a sure date), then
     drawn again three times with nothing new;
   - pop-up: the troubleshooting list opened over a page of words, then left alone.
   What fails (B against A): any jump of the plugin's own element, or of the page's that A does not have, with no input
   in the 500 ms before (the scene's own presses are inputs; the page opening is not); any flash of the plugin's (an
   element shown and gone, or gone and back, or its look changed and back, within 250 ms; a picture region that comes
   and goes where A has none); the rows later than the budgets of section 3.3 (first visit 1000 ms after the title, a
   revisit 100 ms); the census of what is drawn at the end differing from the approved one in test/frames/ (look at
   check.log/frames/<scene>/, then node tools/frames.js --approve).
     node tools/frames.js             run every scene, light and dark
     node tools/frames.js --approve   take the census of this run as approved (after looking at the pictures)
     node tools/frames.js --only two-way-first
   Needs Playwright and Chromium; skipped quietly where they are missing. */
const fs = require('fs');
const path = require('path');
const K = require('../../tools/frame-kit');
const { THEMES, pretendLogseq, exposeAtEnd, tablerCss } = require('./pretend-page');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('frames skipped (needs Playwright and Chromium)'); process.exit(0); }

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'check.log/frames');
const approvedDir = path.join(root, 'test/frames');
const approve = process.argv.includes('--approve');
const only = (() => { const at = process.argv.indexOf('--only'); return at > 0 ? process.argv[at + 1] : null; })();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const W = 900, H = 700;

// The two-way part with its inner pieces reachable (the same way tools/pictures.js reaches rowHtml).
const twoWaySource = () => {
  const src = read('parts/two-way.js');
  const out = src.replace(/\}\)\(\);\s*$/, `window.__tw = { draw, state, onRoute, settle, twoWayCss, rowHtml, forget: () => { heights = new Map(); },
    setUp: core => { provided = core.provided; addsElements = core.addsElements; sendStyle = core.sendStyle; } }; })();`);
  if (out === src) throw new Error('the end of parts/two-way.js changed; tools/frames.js cannot reach it');
  return out;
};

/* A pretend Logseq page that opens in steps, as Logseq 2.0.2 does (measured: the title first, the property list
   140 to 530 ms later). Runs in the page; `steps` are [ms, what] with what one of 'title', 'props', 'prop', 'blocks'. */
function logseqPage() {
  window.__page = (spec, steps) => {
    const main = document.getElementById('main-content-container');
    // A step that fails ends the promise with its error, so the test fails instead of waiting for ever.
    const at = (ms, fn) => new Promise((resolve, reject) => setTimeout(() => { try { fn(); resolve(); } catch (error) { reject(error); } }, ms));
    const title = () => `<div class="ls-page-title"><div class="ls-block" blockid="${spec.uuid}"><div class="is-page-title-row" style="display:flex;align-items:center;gap:8px;font-size:30px;font-weight:600;padding:8px 0">${spec.title}</div></div></div>`;
    const prop = (name, value) => `<div class="property-pair" style="display:flex;gap:12px;padding:3px 0;font-size:15px"><span class="property-key-inner" style="width:130px;opacity:.7">${name}</span><span class="property-value-container">${value}</span></div>`;
    const blocks = () => `<div class="ls-page-blocks" style="margin-top:16px">${spec.blocks.map(b => `<div class="ls-block" style="padding:3px 0 3px 18px">• ${b}</div>`).join('')}</div><div class="references" style="margin-top:28px"><h2 class="ls-foldable-title" style="font-size:16px">Linked references</h2></div>`;
    return Promise.all(steps.map(([ms, what]) => at(ms, () => {
      if (what === 'title') main.innerHTML = title();
      if (what === 'props') main.querySelector('.ls-page-title .ls-block').insertAdjacentHTML('beforeend', `<div class="ls-page-properties" style="margin-top:6px">${spec.props.slice(0, 2).map(p => prop(...p)).join('')}</div>`);
      if (what === 'prop') main.querySelector('.ls-page-properties').insertAdjacentHTML('beforeend', spec.props.slice(2).map(p => prop(...p)).join(''));
      if (what === 'blocks') main.insertAdjacentHTML('beforeend', blocks());
    })));
  };
}
const MEI_CHEN = { uuid: 'page-mei-chen', title: 'Dr. Mei Chen', props: [['Specialty', 'Medical oncology'], ['Works at', 'Northgate Cancer Center'], ['Notes', 'Prefers the morning clinic']],
  blocks: ['Met her first on Jul 14 about the plan.', 'Spoke with Dr. Mei Chen about fatigue.', 'Next review in December.'] };
const NAUSEA = { uuid: 'page-nausea', title: 'Nausea', props: [], blocks: ['Worse two days after each cycle.', 'Ginger tea helps a little.'] };
const item = (i, title, tag, day) => ({ uuid: 'r' + i, title, tag, day });
const GROUPS = [
  { name: 'provider', label: 'provider of', ident: 'user.property/provider', fieldUuid: 'f1', items: [item(1, 'Consultation with Dr. Chen', 'Consultation', 20261112), item(2, 'Review of the scan', 'Consultation', 20261015)] },
  { name: 'spoke with', label: 'spoke with', ident: 'user.property/spokewith', fieldUuid: 'f2', items: [1, 2, 3, 4, 5, 6, 7].map(i => item(10 + i, `Conversation ${i}`, 'Conversation', 20260900 + i)) },
  { name: 'decided by', label: 'decided', ident: 'user.property/decidedby', fieldUuid: 'f3', items: [item(30, 'Start FOLFOX', 'Decision', 20260801)] },
];
const LONG = [{ name: 'symptoms', label: 'logged in', ident: 'user.property/symptoms', fieldUuid: 'f9',
  items: Array.from({ length: 1000 }, (_, i) => item(100 + i, `Symptom log ${i + 1}`, i % 3 ? 'Symptom Log' : 'Consultation', 20260701 + (i % 28))) }];

// In the page: the two-way part set up on a pretend core, its draw run early on every change as the core's watcher does.
function twoWaySetUp(groups, pageUuid) {
  const tw = window.__tw;
  const style = document.createElement('style'); style.textContent = window.PluginDoor.NAMES + window.Threads.shared.kitCss + tw.twoWayCss; document.head.append(style);
  tw.setUp({
    provided: { pageTitles: doc => doc.querySelectorAll('#main-content-container .ls-page-title') },
    addsElements: records => records.some(r => [...r.addedNodes].some(n => n.nodeType === 1)),
    sendStyle: () => {},
  });
  tw.state.byPage.set(pageUuid, groups);
  tw.state.indexed = true;
  tw.state.pageUuid = pageUuid;
  tw.state.groups = groups;
  // The core's early watcher: draw before the browser paints, on every change, while the page settles.
  window.__drawCount = 0;
  window.__watch = new MutationObserver(records => {
    if (records.every(r => [...r.addedNodes, ...r.removedNodes].every(n => n.nodeType !== 1 || n.closest?.('.refinement-two-way') || n.matches?.('.refinement-two-way')))) return;
    if (++window.__drawCount > 500) { window.__watch.disconnect(); throw new Error('the two-way rows redrew 500 times: a loop'); }
    tw.draw(document);
  });
  window.__watch.observe(document.getElementById('main-content-container'), { childList: true, subtree: true });
}

// The scenes, run in both themes; `budget` is how late the two-way rows may show after the title (section 3.3).
const SCENES = {
  'two-way-first': { kind: 'two-way', spec: MEI_CHEN, groups: GROUPS, props: true, budget: 1000 },
  'two-way-again': { kind: 'two-way', spec: MEI_CHEN, groups: GROUPS, props: true, budget: 100, again: true },
  'two-way-no-properties': { kind: 'two-way', spec: NAUSEA, groups: [GROUPS[0]], props: false, budget: 1000 },
  'two-way-long-list': { kind: 'long-list', spec: MEI_CHEN, groups: LONG, props: true },
  'pop-up': { kind: 'pop-up' },
};

async function record(browser, theme, name, scene, withPlugin) {
  const look = THEMES[theme];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // No frozen clock: Playwright's clock stops the page's own timers, which the parts' settle and wait run on.
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<!doctype html><html${look.attrs}><head><style>${look.css} body { margin: 0; font: 16px -apple-system, system-ui, sans-serif; } #main-content-container { padding: 16px 32px; width: ${scene.width || 760}px; }</style><style>${tablerCss}</style><style>${K.STILL_CSS}</style></head><body><div id="main-content-container"></div></body></html>`);
  await page.addScriptTag({ content: `(${logseqPage})(); window.__page.more = (spec, what) => window.__page(spec, [[0, what]]);` });
  // Logseq's icon font is loaded long before any page in the app; here it is loaded before recording, so its arrival is
  // not taken for a move (it made the tag map's icons grow 4 px under the recording).
  await page.evaluate(async () => { const i = document.createElement('i'); i.className = 'ti ti-search'; i.style.cssText = 'position:absolute;left:-99px'; document.body.append(i); await document.fonts.ready; await new Promise(r => setTimeout(r, 50)); i.remove(); });
  // The plugin's scripts are on the page in both runs (A draws nothing with them): the same page, the same fonts.
  const base = `window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`;
  if (scene.kind === 'two-way' || scene.kind === 'long-list') for (const content of [base, read('../plugin.js'), read('parts/shared.js'), twoWaySource(), `window.__twoWaySetUp = ${twoWaySetUp};`]) await page.addScriptTag({ content });
  if (scene.kind === 'pop-up') for (const content of [base, read('../plugin.js'), read('parts/shared.js')]) await page.addScriptTag({ content });
  const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, timeOrigin: performance.timeOrigin }));
  const session = await page.context().newCDPSession(page);
  await page.evaluate(`(${K.ledgerSource()})(...${JSON.stringify(K.ledgerArgs())})`);
  const cast = await K.screencast(session, { ...vp, offset: await K.wallOffset(page) });
  await page.waitForTimeout(150);
  const t0 = await page.evaluate(() => { window.__rfFrames.input('start', false); return window.__rfFrames.now(); });
  const input = (what, exempt = true) => page.evaluate(([w, e]) => window.__rfFrames.input(w, e), [what, exempt]);
  const sleep = ms => page.waitForTimeout(ms);

  if (scene.kind === 'two-way' || scene.kind === 'long-list') {
    if (withPlugin) await page.evaluate(([g, uuid]) => window.__twoWaySetUp(g, uuid), [scene.groups, scene.spec.uuid]);
    // A revisit: the page opened once and settled (the room remembered), left, opened again.
    const open = async () => {
      if (withPlugin) await page.evaluate(() => window.__tw.onRoute());
      await page.evaluate(s => window.__page(s, [[0, 'title']]), scene.spec);
      if (scene.props) { await sleep(120); await page.evaluate(s => window.__page.more(s, 'props'), scene.spec); await sleep(180); await page.evaluate(s => window.__page.more(s, 'prop'), scene.spec); }
      await sleep(60); await page.evaluate(s => window.__page.more(s, 'blocks'), scene.spec);
    };
    if (scene.again) {
      // Read on the visit before: no reading runs here, so a first visit waits out its limit, as a slow reading would.
      if (withPlugin) await page.evaluate(uuid => window.__tw.state.mentionsOf.set(uuid, null), scene.spec.uuid);
      await open(); await sleep(2400);
      await page.evaluate(() => { document.getElementById('main-content-container').innerHTML = ''; });
      await sleep(200);
      await page.evaluate(() => window.__rfFrames.input('route again', false));
      await page.evaluate(() => window.__rfFrames.take()); // only the second visit is judged
    }
    const tRoute = await page.evaluate(() => window.__rfFrames.now());
    await open();
    await sleep(2600); // past the two seconds the rows hold their room
    if (scene.kind === 'long-list' && withPlugin) {
      await input('open the list');
      await page.evaluate(() => { const tw = window.__tw; const key = `${tw.state.pageUuid}|symptoms`; tw.state.open.set(key, true); tw.state.html = null; tw.draw(document); });
      await sleep(600);
      await input('show all');
      await page.evaluate(() => { const tw = window.__tw; tw.state.all.add(`${tw.state.pageUuid}|symptoms`); tw.state.html = null; tw.draw(document); });
      await sleep(700);
      // The part's own redraws (a database round): nothing may move or flash.
      for (let k = 0; k < 3; k++) { await page.evaluate(() => { window.__tw.state.html = null; window.__tw.draw(document); }); await sleep(300); }
    }
    scene.tRoute = tRoute;
  }
  if (scene.kind === 'pop-up') {
    await page.evaluate(() => { const m = document.getElementById('main-content-container'); m.textContent = 'Linked references, Chemo cycle 7, Date: Dec 2nd, 2026, drugs: Oxaliplatin, Leucovorin. '.repeat(40); });
    if (withPlugin) {
      await page.evaluate(() => { const style = document.createElement('style'); style.textContent = window.PluginDoor.NAMES + window.Threads.shared.kitCss; document.head.append(style); });
      await input('open the list');
      await page.evaluate(() => window.Threads.shared.popup({ head: 'Troubleshooting · none of these changes your notes', width: 360, items: [
        { icon: 'show', label: 'Check what the plugin finds on this page' }, { icon: 'settings', label: 'Measuring', chosen: true }, { icon: 'copy', label: 'Copy performance report' }] }));
    }
    await sleep(1500);
  }
  await sleep(300);
  const settleEnd = await page.evaluate(() => window.__rfFrames.now());
  await sleep(800); // still, for the noise mask
  const frames = await cast.stop();
  const ledger = await page.evaluate(() => { const l = window.__rfFrames.take(); window.__rfFrames.stop(); return l; });
  const census = await page.evaluate(() => { const m = window.Threads.shared?.ownMarks(document); return m ? Object.fromEntries([...m].sort()) : {}; });
  await page.close();
  return { t0: scene.tRoute ?? t0, settleEnd, frames, ledger, census, errors };
}

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (error) { console.log('frames skipped (Chromium did not start)'); process.exit(0); }
  fs.mkdirSync(outDir, { recursive: true });
  const problems = [], lines = [];
  for (const [name, scene] of Object.entries(SCENES)) {
    if (only && name !== only) continue;
    for (const theme of Object.keys(THEMES)) {
      const label = `${name}-${theme}`;
      const dir = path.join(outDir, label);
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const A = await record(browser, theme, name, { ...scene }, false);
      const B = await record(browser, theme, name, { ...scene }, true);
      const fails = [];
      for (const e of [...A.errors, ...B.errors]) fails.push('error in the page: ' + e);
      // Blind: no pictures after the start, or more of the plugin's elements than the ledger tracks.
      for (const [run, which] of [[A, 'off'], [B, 'on']]) {
        const n = run.frames.filter(f => f.t > run.t0).length;
        if (n < 1) fails.push(`blind: no picture with the plugin ${which}`);
        if (run.ledger.capped) fails.push(`blind: more of the plugin's elements than the ledger tracks (plugin ${which})`);
      }
      const idle = [A.frames.filter(f => f.t >= A.settleEnd)];
      const { mask, share } = K.noiseMask(idle);
      if (share > 0.02) fails.push(`the noise mask covers ${(share * 100).toFixed(1)}% of the page (blind)`);
      const known = [...K.jumps(A.ledger), ...K.shiftJumps(A.ledger)].map(K.signature);
      // A revisit judges only the second visit (0.4.442): the pictures from its route on, as the ledger already was; the
      // page the test itself emptied before it is not the plugin's flash.
      const judged = R => R.frames.filter(f => f.t >= (scene.again ? R.t0 : -Infinity) && f.t < R.settleEnd);
      const picA = K.pictureFlashes(judged(A), mask, A.ledger.inputs);
      const picB = K.pictureFlashes(judged(B), mask, B.ledger.inputs);
      for (const j of K.attribute([...K.jumps(B.ledger), ...K.shiftJumps(B.ledger)], known, K.growths(B.ledger), K.growths(A.ledger))) if (j.whose === 'plugin')
        fails.push(`jump at ${Math.round(j.t - B.t0)} ms: ${j.name} moved ${j.dy ? `${j.dy > 0 ? 'down' : 'up'} ${Math.abs(j.dy)} px` : ''}${j.dx ? ` sideways ${j.dx} px` : ''}${j.shift ? ' (layout shift)' : ''}`);
      const elFlashA = K.elementFlashes(A.ledger);
      for (const f of K.elementFlashes(B.ledger)) {
        if (f.name.startsWith('landmark: ') && elFlashA.some(g => g.name === f.name)) continue;
        fails.push(`flash at ${Math.round(f.t - B.t0)}–${Math.round(f.until - B.t0)} ms: ${f.name}, ${f.what}`);
      }
      for (const f of K.attributeFlashes(picB.flashes, picA.flashes)) if (f.whose === 'plugin') fails.push(`picture flash at ${Math.round(f.t - B.t0)} ms in [${f.box.join(', ')}]`);
      const seen = K.appearances(B.ledger);
      if (scene.budget && seen.title !== undefined) {
        const rows = Object.entries(B.ledger.names).filter(([, n]) => n === 'div.rf-tw-row').map(([id]) => K.timelines(B.ledger).get(Number(id))?.find(([, r]) => K.shownRow(r))?.[0]).filter(t => t !== undefined);
        if (!rows.length) fails.push('the two-way rows never showed');
        else { const late = Math.min(...rows) - seen.title; if (late > scene.budget) fails.push(`the two-way rows showed ${Math.round(late)} ms after the title (budget ${scene.budget} ms)`); }
      }
      // The census of what is drawn at the end, against the approved one.
      const censusFile = path.join(approvedDir, `${label}.json`);
      const census = JSON.stringify(B.census, null, 1) + '\n';
      if (approve && !fails.length) { fs.mkdirSync(approvedDir, { recursive: true }); fs.writeFileSync(censusFile, census); }
      else if (!fs.existsSync(censusFile)) fails.push(`no approved census yet (look at ${path.relative(root, dir)}, then node tools/frames.js --approve)`);
      else if (fs.readFileSync(censusFile, 'utf8') !== census) fails.push(`what is drawn differs from the approved census (${path.relative(root, censusFile)}): ${census.replace(/\s+/g, ' ').slice(0, 200)}`);
      // Pictures to look at: the settled page, and the frames around each failure.
      const last = picB.decoded[picB.decoded.length - 1];
      if (last) fs.writeFileSync(path.join(dir, 'settled.png'), K.encodePng(last.img));
      for (const text of fails) {
        const t = Number((text.match(/at (\d+)/) || [])[1]);
        if (Number.isNaN(t)) continue;
        const i = picB.decoded.findIndex(f => f.t - B.t0 >= t);
        if (i > 0) { fs.writeFileSync(path.join(dir, `${t}ms-before.png`), K.encodePng(picB.decoded[i - 1].img)); fs.writeFileSync(path.join(dir, `${t}ms-changes.png`), K.changesPicture(picB.decoded[i - 1].img, picB.decoded[i].img)); }
      }
      const report = { scene: label, fails, settleA: Math.round(picA.settledAt - A.t0), settleB: Math.round(picB.settledAt - B.t0), frames: [A.frames.length, B.frames.length], mask: share, census: B.census };
      fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1));
      fs.writeFileSync(path.join(dir, 'report.txt'), `${label}: ${fails.length ? 'FAILED' : 'OK'}\n${fails.map(f => '  ' + f).join('\n')}\n`);
      lines.push(`  ${label}: ${fails.length ? 'FAILED' : approve ? 'approved' : 'OK'} (frames ${A.frames.length}/${B.frames.length})`);
      for (const f of fails) problems.push(`${label}: ${f}`);
    }
  }
  await browser.close();
  console.log('frames of what the plugin draws, recorded moving, light and dark, plugin off (A) and on (B):');
  for (const line of lines) console.log(line);
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`frames: FAILED (${problems.length})`); process.exit(1); }
  console.log('frames: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
