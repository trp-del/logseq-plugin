#!/usr/bin/env node
/* node parts-off.js <out dir>   Goalpost line 5.4 (second half): a part switched off is fully off.
   In the settings window (g then ,), under Parts, each part in turn is switched off and "Reload to apply" is pressed. After the
   reload: the part did not start, none of its commands is in Logseq's command list, nothing it draws is on Dr. Mei Chen's page,
   every other part started, and the console said nothing. Then it is switched on again and must be back. Last, "Run only the
   base" is switched on and off the same way. At the end the stored settings are what they were. No note is touched. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
// What each part puts in Logseq's command list, and what it draws on a person's page.
const PARTS = {
  lookOn: { part: 'look', name: 'Look', commands: /^Show the keys$/, drawn: '.lk-path' },
  findOn: { part: 'find', name: 'Find', commands: /^Find( by sentence)?$/, drawn: null },
  threadsOn: { part: 'threads', name: 'Threads', commands: /^Threads: /, drawn: '.th-two-way' },
  predictiveOn: { part: 'predictive', name: 'Predictive', commands: /^Predictive: /, drawn: null },
  structureOn: { part: 'structure', name: 'Ontology', commands: /^Ontology: /, drawn: '[data-on-click="structureOpen"], .st-holder-line' },
  exportOn: { part: 'export', name: 'DB Export', commands: /^Export: /, drawn: null },
};
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'parts-off'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const before = await fingerprint(page);
  const stored = () => frame().evaluate(() => JSON.parse(JSON.stringify(logseq.settings || {})));
  const settingsWere = await stored();
  const started = async () => { for (let i = 0; i < 60; i++) { const s = await frame()?.evaluate(() => window.PluginDoor && window.PluginDoor.started ? window.PluginDoor.started.map(m => m.key) : null).catch(() => null); if (s) return s; await sleep(400); } return null; };
  const commands = () => page.evaluate(() => (window.logseq.api.get_state_from_store('command-palette/commands') || []).filter(c => /^:?plugin\.logseq-plugin\//.test(String(c.id))).map(c => String(c.desc || '')));
  const all = await started();
  if (!all || all.length < 6) throw new Error('the plugin\'s parts could not be read: ' + JSON.stringify(all));
  const dlg = 'dialog.sw-dialog';
  const openParts = async () => { await go(page, 'Dr. Mei Chen', 1500); await page.evaluate(() => document.activeElement?.blur?.()); if (!await page.locator(dlg + '[open]').count()) { await page.keyboard.press('g'); await page.keyboard.press(','); await sleep(1600); } await page.locator(`${dlg} .sw-mod[data-place="parts"]`).click(); await sleep(500); };
  const flip = async (key, on) => {
    await openParts();
    await page.locator(`${dlg} .sw-list .sw-row[data-row="${key}"]`).click(); await sleep(400);
    await page.locator(`${dlg} .sw-body .sw-opt[data-pick="${key}"][data-val="${on}"]`).click(); await sleep(600);
    const reload = page.locator(`${dlg} .sw-reload`).first();
    if (!await reload.count()) return 'no “Reload to apply” was offered';
    await reload.click(); await sleep(5000);
    const now = await started(); await sleep(2500);
    for (let i = 0; i < 3 && await page.locator(dlg + '[open]').count(); i++) { await page.keyboard.press('Escape'); await sleep(350); }
    return now;
  };
  const faults = [], rows = [];
  for (const [key, p] of Object.entries(PARTS)) {
    const noiseAt = said.length;
    const off = await flip(key, 'false');
    if (!Array.isArray(off)) { faults.push(`${p.name}: ${off || 'the plugin did not come back after the reload'}`); continue; }
    await go(page, 'Dr. Mei Chen', 3000);
    const cmds = await commands(), stray = cmds.filter(c => p.commands.test(c));
    const drawn = p.drawn ? await page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0).length, p.drawn) : 0;
    const others = all.filter(k => k !== p.part && !off.includes(k));
    await page.screenshot({ path: path.join(out, `${p.part}-off.png`) }).catch(() => {});
    if (off.includes(p.part)) faults.push(`${p.name} switched off still started`);
    if (stray.length) faults.push(`${p.name} switched off: Logseq's command list still holds “${stray[0]}”`);
    if (drawn) faults.push(`${p.name} switched off: ${drawn} of its pieces are still drawn on Dr. Mei Chen (${p.drawn})`);
    if (others.length) faults.push(`with ${p.name} off, ${others.join(', ')} did not start either`);
    const on = await flip(key, 'true');
    if (!Array.isArray(on) || !on.includes(p.part)) faults.push(`${p.name} switched on again did not start`);
    const noise = ours(said.slice(noiseAt));
    if (noise.length) faults.push(`${p.name} off and on: the console said “${noise[0].text.slice(0, 140)}”`);
    rows.push({ key, part: p.part, off: !off.includes(p.part) && !stray.length && !drawn, back: Array.isArray(on) && on.includes(p.part) });
    console.log(`${rows.at(-1).off && rows.at(-1).back && !others.length ? 'ok  ' : 'FAIL'} ${p.name}: off, it does not start, has no command and draws nothing; the other ${all.length - 1} parts run; on again, it is back`);
  }
  // Threads' “Run only Threads' base”: after the reload Linked is not drawn and its commands are gone, every part still starts.
  { const noiseAt = said.length, base = await flip('foundationOnly', 'true');
    let fine = Array.isArray(base);
    if (!fine) faults.push(`Run only Threads' base: ${base || 'the plugin did not come back'}`);
    else { await go(page, 'Dr. Mei Chen', 3000); const drawn = await page.evaluate(() => [...document.querySelectorAll('.th-two-way')].filter(e => e.getBoundingClientRect().width > 0).length); if (drawn) { fine = false; faults.push(`Run only Threads' base is on, yet Linked is drawn on Dr. Mei Chen`); } if (base.length < all.length) { fine = false; faults.push(`Run only Threads' base stopped other parts too: only ${base.join(', ')} started`); } }
    const back = await flip('foundationOnly', 'false');
    if (!Array.isArray(back) || back.length < all.length) { fine = false; faults.push(`Run only Threads' base switched off again: only ${Array.isArray(back) ? back.join(', ') || 'nothing' : 'nothing'} started`); }
    else { await go(page, 'Dr. Mei Chen', 3000); if (!await page.evaluate(() => !!document.querySelector('.th-two-way'))) { fine = false; faults.push('switched off again, Linked is not back on Dr. Mei Chen'); } }
    const noise = ours(said.slice(noiseAt)); if (noise.length) faults.push(`Run only Threads' base: the console said “${noise[0].text.slice(0, 140)}”`);
    rows.push({ key: 'foundationOnly', off: fine, back: fine });
    console.log(`${fine ? 'ok  ' : 'FAIL'} Run only Threads' base: on, Linked is not drawn and the other parts run; off again, Linked is back`); }
  const settingsNow = await stored();
  const moved = Object.keys({ ...settingsWere, ...settingsNow }).filter(k => settingsWere[k] !== undefined && JSON.stringify(settingsWere[k]) !== JSON.stringify(settingsNow[k]));
  if (moved.length) faults.push(`settings left changed: ${moved.join(', ')}`);
  const changed = differs(before, await fingerprint(page));
  if (changed.length) faults.push(`${changed.length} note(s) changed`);
  fs.writeFileSync(path.join(out, 'tried-parts.json'), JSON.stringify({ rows, faults }, null, 1));
  for (const f of faults) console.log('FAIL ' + f);
  const ok = !faults.length && rows.length === 7;
  await finish(browser, { '5.4': { ok, said: ok ? 'each of the six parts switched off under Parts is fully off after the reload (it does not start, has no command, draws nothing) while the others run, and is back when switched on; Run only Threads\' base stops Linked alone' : `${faults.length} thing(s) wrong with switching parts off: ${faults[0]}` } });
})().catch(fail);
