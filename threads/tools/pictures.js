#!/usr/bin/env node
/* Pictures of what the plugin draws, in a real browser (Chromium, through Playwright), compared with approved ones.
   Each scene is drawn from a small pretend graph shaped like the Illness Test Graph, in a light and a dark page,
   on a fixed day (2026-10-19), and photographed. The approved pictures are in test/pictures/; a picture that
   differs from its approved one by more than a few pixels fails, and the new picture and one with the changed
   pixels in red are left in check.log/pictures/ to look at.
     node tools/pictures.js            compare with the approved pictures
     node tools/pictures.js --approve  take the new pictures as the approved ones (after looking at them)
   Fonts differ between machines, so the pictures are compared only on the Mac they were approved on (macOS);
   elsewhere this is skipped. Needs Playwright and Chromium; skipped quietly where they are missing. */
const fs = require('fs');
const path = require('path');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('pictures skipped (needs Playwright and Chromium)'); process.exit(0); }
if (process.platform !== 'darwin') { console.log('pictures skipped (approved on the Mac; fonts differ elsewhere)'); process.exit(0); }

const root = path.resolve(__dirname, '..');
// The pretend Logseq, its themes and the two-way rows' groups are shared with tools/frames.js (tools/pretend-page.js).
const { THEMES, pretendLogseq, TWO_WAY_GROUPS, exposeAtEnd, tablerCss } = require('./pretend-page');
const approvedDir = path.join(root, 'test/pictures');
const newDir = path.join(root, 'check.log/pictures');
const approve = process.argv.includes('--approve');
// A pixel counts as changed when a colour channel moves by more than this; a picture fails above this many changed pixels.
const CHANNEL = 24, PIXELS = 20;
async function scenes(page) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  return {
    'two-way-rows': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('../plugin.js'), read('parts/shared.js'),
        exposeAtEnd(read('parts/two-way.js'), ['rowHtml', 'twoWayCss', 'state'], 'parts/two-way.js')],
      draw: async groups => {
        const style = document.createElement('style'); style.textContent = window.PluginDoor.NAMES + window.Threads.shared.kitCss + window.__twoWayCss; document.head.append(style);
        window.__state.pageUuid = 'page-mei-chen';
        const box = document.createElement('div');
        box.className = 'refinement-two-way';
        box.innerHTML = groups.map(window.__rowHtml).join('');
        document.getElementById('stage').append(box);
      },
      arg: TWO_WAY_GROUPS,
    },
    // The same rows with the days' column off (twoWayDays): the rows move left into its place.
    'two-way-rows-no-days': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('../plugin.js'), read('parts/shared.js'),
        exposeAtEnd(read('parts/two-way.js'), ['rowHtml', 'twoWayCss', 'noDaysCss', 'state'], 'parts/two-way.js')],
      draw: async groups => {
        const style = document.createElement('style'); style.textContent = window.PluginDoor.NAMES + window.Threads.shared.kitCss + window.__twoWayCss + window.__noDaysCss; document.head.append(style);
        window.__state.pageUuid = 'page-mei-chen';
        const box = document.createElement('div');
        box.className = 'refinement-two-way';
        box.innerHTML = groups.map(window.__rowHtml).join('');
        document.getElementById('stage').append(box);
      },
      arg: TWO_WAY_GROUPS,
    },
    // The troubleshooting tools as the kit's list pop-up (0.4.316), over a page full of words, so a see-through box shows.
    'dialog': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('../plugin.js'), read('parts/shared.js')],
      draw: async () => {
        const shared = window.Threads.shared;
        const style = document.createElement('style'); style.textContent = window.PluginDoor.NAMES + shared.kitCss; document.head.append(style);
        const stage = document.getElementById('stage');
        stage.style.height = '560px';
        stage.textContent = 'Linked references, Chemo cycle 7, Date: Dec 2nd, 2026, drugs: Oxaliplatin, Leucovorin. '.repeat(40);
        // The plugin's one Undo (0.4.258): an arrow at the end of a line, and one waiting at the bottom right with its words.
        const line = document.createElement('div'); line.textContent = 'Review of the tingling'; line.style.cssText = 'position:absolute;left:24px;top:470px;padding:2px 6px;background:inherit;';
        stage.append(line);
        shared.undo.offer({ key: 'p', at: () => line, text: 'Provider: Dr. Mei Chen', run: () => {} });
        shared.undo.offer({ key: 'd', at: () => null, text: 'Deleted 3 records', run: () => {} });
        shared.popup({ head: 'Troubleshooting · none of these changes your notes', width: 360, items: [
          { icon: 'show', label: 'Check what the plugin finds on this page' }, { icon: 'settings', label: 'Measuring', chosen: true }, { icon: 'copy', label: 'Copy performance report' },
          { icon: 'warning', label: 'Copy warnings' }, { sep: true }, { icon: 'help', label: 'Two-way links: check the rows on this page' }] });
      },
    },
  };
}

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (error) { console.log('pictures skipped (Chromium did not start)'); process.exit(0); }
  fs.mkdirSync(newDir, { recursive: true });
  for (const f of fs.readdirSync(newDir)) fs.rmSync(path.join(newDir, f));
  const problems = [], lines = [];
  const page0 = await browser.newPage();
  const list = await scenes(page0);
  await page0.close();
  for (const [name, scene] of Object.entries(list)) for (const [theme, look] of Object.entries(THEMES)) {
    const file = `${name}-${theme}.png`;
    const page = await browser.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 1 });
    await page.clock.setFixedTime(new Date('2026-10-19T10:00:00'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Logseq's own icon font, from the app's bundle (the kit draws every icon with it, 0.4.311); without the app, the pictures have no icons.
    await page.setContent(`<!doctype html><html${look.attrs}><head><style>${look.css} body { margin: 0; font: 16px -apple-system, system-ui, sans-serif; } #stage { padding: 16px 24px; width: 712px; }</style><style>${tablerCss}</style></head><body><div id="stage"></div></body></html>`);
    for (const content of scene.scripts) await page.addScriptTag({ content });
    await page.evaluate(scene.draw, scene.arg);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const shot = await page.locator('#stage').screenshot({ animations: 'disabled', caret: 'hide' });
    for (const e of errors) problems.push(`${file}: error in the page: ${e}`);
    const approvedFile = path.join(approvedDir, file);
    if (approve && errors.length) {
      lines.push(`  ${file}: not approved, the page had errors`);
    } else if (approve) {
      fs.mkdirSync(approvedDir, { recursive: true });
      fs.writeFileSync(approvedFile, shot);
      lines.push(`  ${file}: approved`);
    } else if (!fs.existsSync(approvedFile)) {
      fs.writeFileSync(path.join(newDir, file), shot);
      problems.push(`${file}: no approved picture yet (look at check.log/pictures/${file}, then run node tools/pictures.js --approve)`);
    } else {
      const result = await page.evaluate(async ([a, b, channel]) => {
        const load = src => new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = fail; img.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
        const da = px(ia), db = px(ib);
        const out = document.createElement('canvas'); out.width = w; out.height = h;
        const ox = out.getContext('2d'); ox.globalAlpha = .25; ox.drawImage(ib, 0, 0); ox.globalAlpha = 1;
        const marks = ox.getImageData(0, 0, w, h);
        let changed = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          if (Math.max(...[0, 1, 2, 3].map(k => Math.abs(da.data[i + k] - db.data[i + k]))) > channel) {
            changed++; marks.data[i] = 230; marks.data[i + 1] = 0; marks.data[i + 2] = 0; marks.data[i + 3] = 255;
          }
        }
        ox.putImageData(marks, 0, 0);
        return { changed, size: ia.width === ib.width && ia.height === ib.height, was: `${ia.width}×${ia.height}`, now: `${ib.width}×${ib.height}`, marks: out.toDataURL('image/png') };
      }, ['data:image/png;base64,' + fs.readFileSync(approvedFile).toString('base64'), 'data:image/png;base64,' + shot.toString('base64'), CHANNEL]);
      if (!result.size || result.changed > PIXELS) {
        fs.writeFileSync(path.join(newDir, file), shot);
        fs.writeFileSync(path.join(newDir, file.replace('.png', '-changes.png')), Buffer.from(result.marks.split(',')[1], 'base64'));
        problems.push(`${file}: differs from the approved picture (${result.size ? `${result.changed} pixels changed` : `size ${result.was} became ${result.now}`}); see check.log/pictures/`);
      } else lines.push(`  ${file}: same as approved${result.changed ? ` (${result.changed} pixels within tolerance)` : ''}`);
    }
    await page.close();
  }
  await browser.close();
  console.log('pictures of what the plugin draws, light and dark, on a pretend graph:');
  for (const line of lines) console.log(line);
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`pictures: FAILED (${problems.length})`); process.exit(1); }
  console.log('pictures: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
