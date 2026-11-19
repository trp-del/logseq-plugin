#!/usr/bin/env node
/* node waiting-look.js <out dir> [label] [dark]   Goalpost line 3.6: dotted grey is Predictive's guess and nothing else; what a change
   brings is in green text, what it takes away is struck through in red.
   In the checks' own Logseq:
   (1) on the Ontology map two tags are ticked and moved under another tag with the bar's Move under…: the preview must show
       where they sit now struck through in red and where they will sit in green text text; after the yes the move waits in the
       tray, and every name it touches on the map must carry the wash and none a dotted line; Discard drops it and nothing waits.
   (2) in the settings window DB Export is switched off, so the part waits for the reload: "Parts" in the list and the sentence
       beside Reload to apply must carry the wash and no dotted line; the part is switched back on and nothing waits.
   Nothing is written to the graph: the tray is never applied, and the switch is put back. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, route, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'waiting-look'), label = process.argv[3] || 'now'; fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const before = await fingerprint(page);
  const dark = process.argv[4] === 'dark';
  if (dark) { await page.evaluate(() => window.logseq.api.set_theme_mode('dark')); await sleep(1200); }
  // What on screen is dotted, in green text, struck through in red: read from the computed look, whatever the class.
  const marks = scope => page.evaluate(scope => {
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const own = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const rgb = c => c.match(/rgba?\(([^)]+)\)/)?.[1].split(/[, /]+/).map(Number);
    const dotted = [], washed = [], struck = [];
    for (const el of document.querySelectorAll(scope + ' *')) {
      if (!vis(el) || !own(el)) continue;
      const s = getComputedStyle(el), words = el.innerText.trim().replace(/\s+/g, ' ').slice(0, 48);
      if (/underline/.test(s.textDecorationLine) && s.textDecorationStyle === 'dotted') dotted.push(words);
      const fg0 = rgb(s.color); if (fg0 && fg0[1] > fg0[0] + 40 && fg0[1] > fg0[2] + 20 && !/line-through/.test(s.textDecorationLine)) washed.push(words);
      const fg = rgb(s.color); if (/line-through/.test(s.textDecorationLine) && fg && fg[0] > 180 && fg[1] < 110 && fg[2] < 110) struck.push(words);
    }
    return { dotted, washed, struck };
  }, scope);
  const shot = name => page.screenshot({ path: path.join(out, `${name}-${label}.png`) });
  const list = a => a.join(', ') || 'nothing';

  // 1. A move of two tags, waiting in Ontology's tray.
  await route(page, '#/structure', 3500);
  { const d = page.locator('.st [data-discard]'); if (await d.count()) { await d.first().click(); await sleep(900); } const x = page.locator('.st-acts [data-tbar="clear"]'); if (await x.count()) { await x.first().click(); await sleep(500); } }
  const rowOf = name => page.locator('.st-row', { has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) }).first();
  const discard = async () => { const d = page.locator('.st [data-discard]'); if (await d.count()) { await d.first().click(); await sleep(900); } };
  const tickBoth = async () => { for (const name of ['Report', 'test']) { const row = rowOf(name); if (!await row.count()) throw new Error(`no row named ${name} on the Ontology map`); if (!await row.locator('.lk-tick').isChecked()) { await row.hover(); await row.locator('.lk-tick').click({ force: true }); await sleep(300); } } };
  // 1a. Move under… from the bar: it first says what it will do, and stages nothing before the yes.
  await tickBoth();
  await page.locator('.st-acts [data-tbar="move"]').click(); await sleep(700);
  await page.locator('.st-prompt [data-pin]').pressSequentially('Information', { delay: 40 }); await sleep(900);   // typed into the prompt's own box, never at large
  await page.keyboard.press('Enter'); await sleep(1000);
  const pv = await marks('.st-q'), asked = await page.locator('.st-q [data-stage]').count();
  const yes = asked ? (await page.locator('.st-q [data-stage]').innerText()).trim() : '';
  const early = await page.evaluate(() => /waiting/i.test(document.querySelector('.st-tray')?.innerText || ''));
  await shot('ontology-preview');
  const pvOk = pv.washed.includes('Information') && pv.struck.includes('Entity') && !pv.dotted.length && yes === 'Move 2 tags under Information' && !early;
  console.log(`${pvOk ? 'ok  ' : 'FAIL'} Ontology, Move under… for two ticked tags says what it will do first: in green text: ${list([...new Set(pv.washed)])}; struck through in red: ${list([...new Set(pv.struck)])}; dotted: ${list(pv.dotted)}; its yes says “${yes}”${early ? '; the move was staged before any yes' : ''}`);
  if (asked) { await page.locator('.st-q [data-leave]').click(); await sleep(600); }
  await discard();
  // 1b. The two ticked tags dragged onto Information: several moved together wait in the tray.
  await tickBoth();
  await rowOf('Report').locator('.ct').dragTo(rowOf('Information').locator('.nm'), { force: true }); await sleep(1300);
  const tray = await page.evaluate(() => { const t = document.querySelector('.st-tray'); return t ? t.innerText.replace(/\s*\n\s*/g, ' | ').slice(0, 200) : ''; });
  const map = await marks('.st'), trayMarks = await marks('.st-tray');
  await shot('ontology-waiting');
  const mapOk = /waiting/i.test(tray) && map.washed.includes('Report') && map.washed.includes('test') && !map.dotted.length && !trayMarks.dotted.length;
  console.log(`${mapOk ? 'ok  ' : 'FAIL'} Ontology, two tags dragged under Information and waiting: the tray says “${tray.slice(0, 110)}”; in green text: ${list([...new Set(map.washed)])}; dotted: ${list([...new Set([...map.dotted, ...trayMarks.dotted])])}`);
  await discard();
  const left = await page.evaluate(() => /waiting/i.test(document.querySelector('.st-tray')?.innerText || ''));
  const back = await marks('.st');
  const backOk = !left && !back.washed.length && !back.dotted.length;
  console.log(`${backOk ? 'ok  ' : 'FAIL'} Discard dropped the waiting moves: ${left ? 'the tray still says something waits' : 'nothing waits'}; washed now: ${list(back.washed)}; dotted now: ${list(back.dotted)}`);
  { const x = page.locator('.st-acts [data-tbar="clear"]'); if (await x.count()) { await x.first().click(); await sleep(400); } }

  // 2. A part waiting for the reload, in the settings window.
  await go(page, 'Dr. Mei Chen', 2000);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('g'); await page.keyboard.press(','); await sleep(1800);
  const dlg = 'dialog.sw-dialog';
  let setOk = false, setSaid = 'the settings window did not open';
  if (await page.locator(dlg).count()) {
    await page.locator(`${dlg} .sw-mod[data-place="parts"]`).click(); await sleep(600);
    await page.locator(`${dlg} .sw-row[data-row="exportOn"]`).click(); await sleep(600);
    await page.locator(`${dlg} .sw-opt[data-pick="exportOn"][data-val="false"]`).click(); await sleep(900);
    const m = await marks(dlg), reload = await page.locator(`${dlg} .sw-reload`).count();
    await shot('settings-waiting');
    setOk = reload > 0 && m.washed.some(w => /^Parts$/.test(w)) && m.washed.some(w => /waits for the reload/.test(w)) && !m.dotted.length;
    setSaid = `Reload to apply shown: ${reload > 0 ? 'yes' : 'no'}; in green text: ${list(m.washed)}; dotted: ${list(m.dotted)}`;
    await page.locator(`${dlg} .sw-opt[data-pick="exportOn"][data-val="true"]`).click(); await sleep(900);
    const still = await page.locator(`${dlg} .sw-reload`).count(), after = await marks(dlg);
    if (still || after.washed.length) { setOk = false; setSaid += `; switched back on, yet Reload to apply is ${still ? 'still shown' : 'gone'} and washed is ${list(after.washed)}`; }
  }
  console.log(`${setOk ? 'ok  ' : 'FAIL'} settings, DB Export switched off and waiting for the reload: ${setSaid}`);
  await page.keyboard.press('Escape'); await sleep(600);
  if (await page.locator(dlg + '[open]').count()) { await page.keyboard.press('Escape'); await sleep(400); }

  if (dark) { await page.evaluate(() => window.logseq.api.set_theme_mode('light')); await sleep(900); }
  const changed = differs(before, await fingerprint(page));
  if (changed.length) console.log(`FAIL the graph changed: ${changed.slice(0, 3).map(c => c.what + ' ' + c.words).join('; ')}`);
  const noise = ours(said);
  for (const s of [...new Set(noise.map(s => s.type + ': ' + s.text.slice(0, 200)))]) console.log('console ' + s);
  const ok = pvOk && mapOk && backOk && setOk && !changed.length && !noise.length;
  await finish(browser, { '3.6': { ok, said: ok ? 'a preview, a move waiting in Ontology and a part waiting for the reload show green for what comes and red for what goes, nothing dotted; both were put back' : 'a waiting change is dotted, or not in green text, or was not put back (see the lines above)' } });
})().catch(fail);
