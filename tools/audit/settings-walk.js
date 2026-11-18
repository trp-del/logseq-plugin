#!/usr/bin/env node
/* node settings-walk.js <out dir>   Goalpost line 5.4 (first half), and the list 7.5 reads.
   The settings window is opened (g then ,) and walked: every place down the left, every setting's line, every choice of every
   setting. A choice is pressed: it must be written at once (read back from the plugin's stored settings), the line must say the
   new choice, and nothing may be said in the console; then the choice it came with is pressed again. A setting that is not a
   set of choices (a number, a key, a list of words) is opened and named, not changed. Parts are left alone (parts-off.js).
   At the end the stored settings must be exactly what they were. No note is touched. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'settings-walk'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const before = await fingerprint(page);
  const stored = () => frame().evaluate(() => JSON.parse(JSON.stringify(logseq.settings || {})));
  const settingsWere = await stored();
  await go(page, 'Dr. Mei Chen', 1500);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('g'); await page.keyboard.press(','); await sleep(1800);
  const dlg = 'dialog.sw-dialog';
  if (!await page.locator(dlg).count()) throw new Error('the settings window did not open on g then ,');
  const places = await page.evaluate(d => [...document.querySelectorAll(d + ' .sw-mod[data-place]')].map(b => ({ place: b.dataset.place, name: b.innerText.trim() })), dlg);
  const rows = [], notWalked = [], faults = [];
  for (const { place, name } of places) {
    if (place === 'parts') continue;
    await page.locator(`${dlg} .sw-mod[data-place="${place}"]`).click(); await sleep(450);
    const keys = await page.evaluate(d => [...document.querySelectorAll(d + ' .sw-list .sw-row[data-row]')].map(r => ({ key: r.dataset.row, title: r.querySelector('.sw-name')?.innerText.trim() || '', now: r.querySelector('.sw-now')?.innerText.trim() || '' })), dlg);
    for (const k of keys) {
      await page.locator(`${dlg} .sw-list .sw-row[data-row="${k.key}"]`).click(); await sleep(350);
      const opts = await page.evaluate(([d, key]) => [...document.querySelectorAll(`${d} .sw-body .sw-opt[data-pick="${key}"]`)].map((o, i) => ({ i, val: o.dataset.val, name: o.querySelector('.sw-nm')?.innerText.trim() || '', on: o.classList.contains('on'), pic: !!o.querySelector('.sw-pic') })), [dlg, k.key]);
      const body = await page.evaluate(d => { const b = document.querySelector(d + ' .sw-body'); return { h: b?.querySelector('h2')?.innerText.trim() || '', what: b?.querySelector('.sw-what')?.innerText.trim() || '', inputs: [...(b?.querySelectorAll('input, textarea, select, [data-key-record], .sw-key') || [])].map(i => i.tagName.toLowerCase() + (i.type ? ':' + i.type : '')).slice(0, 6) }; }, dlg);
      if (!body.what) faults.push(`${name} › ${k.title}: no sentence says what it does`);
      if (opts.length < 2) { notWalked.push({ place: name, key: k.key, title: k.title, kind: body.inputs.join(', ') || 'no choices drawn' }); rows.push({ key: k.key, title: k.title, place: name, choices: 0 }); continue; }
      const home = opts.find(o => o.on);
      if (!home) faults.push(`${name} › ${k.title}: none of its ${opts.length} choices is marked as the one in force`);
      if (opts.some(o => !o.name)) faults.push(`${name} › ${k.title}: a choice has no name`);
      const noiseAt = said.length; let walked = 0;
      for (const o of opts.filter(o => !o.on)) {
        await page.locator(`${dlg} .sw-body .sw-opt[data-pick="${k.key}"]`).nth(o.i).click(); await sleep(420);
        const got = await stored(), line = await page.evaluate(([d, key]) => document.querySelector(`${d} .sw-list .sw-row[data-row="${key}"] .sw-now`)?.innerText.trim() || '', [dlg, k.key]);
        let want = o.val; try { want = JSON.parse(o.val); } catch (e) { /* a plain word */ }
        if (JSON.stringify(got[k.key]) !== JSON.stringify(want) && String(got[k.key]) !== String(want)) faults.push(`${name} › ${k.title}: “${o.name}” pressed, but the stored setting is ${JSON.stringify(got[k.key])}, not ${JSON.stringify(want)}`);
        if (o.name && line && !line.replace(/^[·•\s]+/, '').toLowerCase().includes(o.name.toLowerCase().slice(0, 12))) faults.push(`${name} › ${k.title}: “${o.name}” pressed, but its line says “${line}”`);
        walked++;
      }
      if (home) { await page.locator(`${dlg} .sw-body .sw-opt[data-pick="${k.key}"]`).nth(home.i).click(); await sleep(380); }
      const noise = ours(said.slice(noiseAt));
      if (noise.length) faults.push(`${name} › ${k.title}: the console said “${noise[0].text.slice(0, 140)}”`);
      rows.push({ key: k.key, title: k.title, place: name, choices: opts.length, walked });
    }
  }
  await page.screenshot({ path: path.join(out, 'settings-walk-end.png') }).catch(() => {});
  const reload = await page.locator(`${dlg} .sw-reload`).count();
  if (reload) faults.push('after every choice was put back, the window still asks for a reload');
  for (let i = 0; i < 3 && await page.locator(dlg + '[open]').count(); i++) { await page.keyboard.press('Escape'); await sleep(350); }
  if (await page.locator(dlg + '[open]').count()) faults.push('Escape did not close the settings window');
  const settingsNow = await stored();
  const moved = [...new Set([...Object.keys(settingsWere), ...Object.keys(settingsNow)])].filter(k => JSON.stringify(settingsWere[k]) !== JSON.stringify(settingsNow[k]));
  // A setting with every choice at its start value may be stored now where it was absent before (the value it came with): that is no change of behaviour, but it is named.
  const real = moved.filter(k => settingsWere[k] !== undefined), born = moved.filter(k => settingsWere[k] === undefined);
  if (real.length) faults.push(`settings left changed: ${real.slice(0, 5).map(k => `${k} was ${JSON.stringify(settingsWere[k])}, is ${JSON.stringify(settingsNow[k])}`).join('; ')}`);
  const changed = differs(before, await fingerprint(page));
  if (changed.length) faults.push(`${changed.length} note(s) changed`);
  fs.writeFileSync(path.join(out, 'tried-settings.json'), JSON.stringify({ rows, notWalked, born, faults }, null, 1));
  const choices = rows.reduce((n, r) => n + (r.walked || 0), 0);
  console.log(`${places.length} places, ${rows.length} settings, ${choices} choices pressed and put back; ${notWalked.length} settings are not a set of choices; ${born.length} now stored at the value they came with`);
  for (const n of notWalked) console.log(`  not a set of choices: ${n.place} › ${n.title} (${n.kind})`);
  for (const f of faults) console.log('FAIL ' + f);
  const ok = !faults.length && rows.length >= 30;
  await finish(browser, { '5.4': { ok, said: ok ? `${rows.length} settings in ${places.length - 1} places: each of ${choices} choices is written the moment it is pressed, its line says so, and every one was put back (${notWalked.length} settings that are numbers, keys or lists were opened, not changed)` : `${faults.length} thing(s) wrong in the settings window: ${faults[0]}` } });
})().catch(fail);
