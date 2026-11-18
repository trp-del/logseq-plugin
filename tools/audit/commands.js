#!/usr/bin/env node
/* node commands.js <out dir>   Goalpost lines 5.1 and 5.3 (and the list 7.5 reads): every command the plugin puts in Logseq's
   command list is run as that list runs the row chosen (the action Logseq keeps for it), outside a bullet, on Dr. Mei Chen.
   For each: nothing in the console, no "Something went wrong", Escape closes whatever it opened, and no note changed.
   What each did (a window, a page, a notice) is written down. A command left out is named with its reason, never silently.
   The list comes from Logseq itself (what the plugin registered), so a new command is tried without anyone adding it here. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, outside, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
// Left out, each for its stated reason.
const SKIP = [
  [/^Update plugins$/, 'asks GitHub for newer plugins: Logseq\'s own doing, and the checks\' Logseq is kept off the network'],
  [/tune proposals to this graph|how well do proposals work|measure Apple|how fast is Apple/, 'a long measuring run over the whole graph (minutes), tried by Predictive\'s own harness instead'],
];
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'commands'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const before = await fingerprint(page);
  // What the plugin registered, read from Logseq's own list of commands (the one its command list is drawn from).
  const labels = await page.evaluate(() => (window.logseq.api.get_state_from_store('command-palette/commands') || []).filter(c => /^:?plugin\.logseq-plugin\//.test(String(c.id))).map(c => String(c.desc || '')).filter(Boolean));
  if (labels.length < 10) throw new Error(`Logseq lists only ${labels.length} commands of the plugin: the list could not be read (${labels.join(' | ')})`);
  // A command is run as Logseq's command list runs the row chosen: by the action Logseq keeps for it. Nothing is ever typed.
  const runCommand = label => page.evaluate(label => { const c = (window.logseq.api.get_state_from_store('command-palette/commands') || []).find(c => /^:?plugin\.logseq-plugin\//.test(String(c.id)) && String(c.desc) === label); if (!c || typeof c.action !== 'function') return false; try { c.action(); } catch (error) { console.error('the command threw: ' + (error && error.message)); } return true; }, label);
  const state = () => page.evaluate(() => ({ hash: decodeURIComponent(location.hash).slice(0, 60), dialogs: document.querySelectorAll('dialog[open], .ui__dialog-content, .ui__modal, .lk-window, .lk-pop').length, notice: [...document.querySelectorAll('.ui__notifications .notification-area, .ui__toast, .lk-notice, [class*="notification-content"]')].map(n => n.innerText.trim().slice(0, 120)).filter(Boolean).slice(-1)[0] || '', wrong: /Something went wrong/.test(document.body.innerText), focus: (document.activeElement && document.activeElement !== document.body ? (document.activeElement.getAttribute('placeholder') || document.activeElement.className || document.activeElement.tagName) : '').toString().slice(0, 40), side: !!window.logseq.api.get_state_from_store('ui/sidebar-open?') }));
  const rows = [], tried = [], skipped = [];
  for (const label of labels) {
    const skip = SKIP.find(([re]) => re.test(label));
    if (skip) { skipped.push({ label, why: skip[1] }); console.log(`left out: ${label} (${skip[1]})`); continue; }
    await go(page, 'Dr. Mei Chen', 1500);
    await page.evaluate(() => document.activeElement?.blur?.());
    for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await sleep(120); }
    const was = await state(), noiseAt = said.length, outAt = (await outside(page)).length;
    const ran = await runCommand(label);
    await sleep(1800);
    const now = await state(), outs = (await outside(page)).slice(outAt);
    const kept = outs.length ? [...new Set(outs.map(o => o.what === 'clipboard' ? `copied “${o.detail.slice(0, 40).replace(/\n/g, ' ')}…” (kept from the Mac's clipboard)` : o.what === 'print' ? `sent ${o.detail} to print (kept from the print window)` : o.what === 'showOpenDialog' ? 'asked for a folder (given the run\'s own)' : o.what === 'writeFile' ? `wrote ${o.detail.split('/').pop()} into the run's folder` : `${o.what} ${o.detail.slice(0, 60)}`))].join('; ') : '';
    const did = !ran ? 'Logseq keeps no action for it' : now.wrong ? 'Logseq said something went wrong' : now.dialogs > was.dialogs ? 'opened a window' : now.hash !== was.hash ? `went to ${now.hash}` : now.side !== was.side ? 'opened the right sidebar' : now.notice ? `said “${now.notice}”` : kept ? kept : now.focus && now.focus !== was.focus ? `put the cursor in “${now.focus}”` : 'nothing to see';
    await page.screenshot({ path: path.join(out, `${String(rows.length + 1).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`) }).catch(() => {});
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(220); }
    if (now.side !== was.side) { await page.evaluate(on => window.logseq.api.set_right_sidebar_visible?.(on), was.side); await sleep(500); }
    const after = await state(), noise = ours(said.slice(noiseAt));
    const left = after.dialogs > was.dialogs;
    const ok = ran && !now.wrong && !left && !noise.length;
    rows.push({ label, ok, did, left, noise: noise.map(n => n.text.slice(0, 160)) }); tried.push(label);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${did}${left ? '; Escape did not close it' : ''}${noise.length ? '; the console said: ' + noise[0].text.slice(0, 140) : ''}`);
  }
  await go(page, 'Dr. Mei Chen', 1200);
  const changed = differs(before, await fingerprint(page));
  if (changed.length) console.log(`FAIL the graph changed: ${changed.slice(0, 4).map(c => c.what + ' “' + c.words + '”').join('; ')}`);
  fs.writeFileSync(path.join(out, 'tried-commands.json'), JSON.stringify({ tried, skipped, rows }, null, 1));
  const bad = rows.filter(r => !r.ok), quiet = rows.filter(r => r.ok && r.did === 'nothing to see');
  for (const q of quiet) console.log(`look: “${q.label}” ran outside a bullet and showed nothing`);
  const ok = !bad.length && !changed.length;
  const words = ok ? `${rows.length} commands run from Logseq's command list: each did its thing, closed on Escape and changed no note (${skipped.length} left out, with reasons)` : `${bad.length} of ${rows.length} commands went wrong: ${bad.slice(0, 2).map(b => b.label + ' (' + (b.noise[0] || b.did) + ')').join('; ')}${changed.length ? `; ${changed.length} note(s) changed` : ''}`;
  await finish(browser, { '5.1': { ok, said: words }, '5.3': { ok, said: words } });
})().catch(fail);
