#!/usr/bin/env node
/* node decide-shots.js <out dir>   Pictures of the places that ask you to act or decide (goalpost line 3.4), for the owner's look.
   Each is opened as a person opens it and left again without a yes: nothing is ever applied, deleted or changed.
   1 Ontology's question before a tag is deleted for good   2 Move under…'s preview   3 changes waiting in the tray
   4 the Suggested line, closed, and the box opened          5 the Recycle list's question before a delete for good
   6 the settings window's Reload to apply                    7 Relations' + with its words under the pointer */
const fs = require('node:fs'), path = require('node:path');
const { connect, go, route, sleep, fingerprint, differs, fail } = require('./kit');
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame } = await connect();
  await page.setViewportSize({ width: 1300, height: 860 });
  const before = await fingerprint(page);
  const shot = async (n, sel) => { await sleep(500); const el = sel && await page.$(sel); if (el) { const b = await el.boundingBox(); await page.screenshot({ path: path.join(out, n + '.png'), clip: { x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 24), width: Math.min(1300 - Math.max(0, b.x - 24), b.width + 48), height: Math.min(860 - Math.max(0, b.y - 24), b.height + 48) } }); } else await page.screenshot({ path: path.join(out, n + '.png') }); console.log('took ' + n); };
  const discard = async () => { const d = page.locator('.st [data-discard]'); if (await d.count()) { await d.first().click(); await sleep(700); } };
  // 1 the question before a delete for good
  await route(page, '#/structure', 3000); await discard();
  await frame().evaluate(() => { const S = window.Structure, m = S.app.tray.model, T = t => [...m.tags.values()].find(x => x.title === t); S.app.stage({ kind: 'merge', from: T('test').id, into: T('mergeable').id }, { wait: true }); S.app.draw(); });
  await sleep(600); await page.locator('.st-row .ct').first().click(); await page.keyboard.press('Meta+Enter'); await sleep(800);
  await shot('1-delete-for-good', '.st-tray');
  await page.keyboard.press('Escape'); await sleep(300); await discard();
  // 2 Move under…'s preview
  const rowOf = name => page.locator('.st-row', { has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) }).first();
  for (const n of ['Report', 'test']) { const r = rowOf(n); await r.hover(); await r.locator('.lk-tick').click({ force: true }); await sleep(250); }
  await page.locator('.st-acts [data-tbar="move"]').click(); await sleep(600);
  await page.locator('.st-prompt [data-pin]').pressSequentially('Information', { delay: 30 }); await sleep(700); await page.keyboard.press('Enter'); await sleep(900);
  await shot('2-move-preview', '.st-q');
  await page.locator('.st-q [data-leave]').click().catch(() => {}); await sleep(400);
  // 3 changes waiting in the tray
  await rowOf('Report').locator('.ct').dragTo(rowOf('Information').locator('.nm'), { force: true }); await sleep(1200);
  await shot('3-tray', '.st-tray');
  await discard(); { const x = page.locator('.st-acts [data-tbar="clear"]'); if (await x.count()) { await x.first().click(); await sleep(400); } }
  // 4 the Suggested line, closed and opened
  const shut = page.locator('.st .sugs-shut').first();
  if (await shut.count()) { await shut.scrollIntoViewIfNeeded(); await shot('4a-suggested-closed', '.st .sugs-shut'); await shut.click(); await sleep(700); const box = await page.$('.st [class*="sug"]:not(.sugs-shut)'); if (box) { await box.scrollIntoViewIfNeeded(); await shot('4b-suggested-open', '.st [class*="sug"]:not(.sugs-shut)'); } }
  // 5 the Recycle list's question (Delete on a row asks under it; Leave it)
  await go(page, 'Dr. Mei Chen', 2000);
  await page.evaluate(() => { const c = (window.logseq.api.get_state_from_store('command-palette/commands') || []).find(c => /^:?plugin\.logseq-plugin\//.test(String(c.id)) && /troubleshooting$/.test(String(c.desc))); c?.action?.(); }); await sleep(900);
  await page.locator('.th-pop .lk-item, .th-pop [role="menuitem"]', { hasText: /Recycle as a plain list/ }).first().click(); await sleep(1500);
  const del = page.locator('.th-recycle-acts .lk-del').first();
  if (await del.count()) { await del.click(); await sleep(700); await shot('5-recycle-delete', '.th-recycle-ask'); }
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(200); }
  // 6 the settings window's Reload to apply (a part switched off and back on)
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('g'); await page.keyboard.press(','); await sleep(1500);
  const dlg = 'dialog.sw-dialog';
  if (await page.locator(dlg).count()) { await page.locator(`${dlg} .sw-mod[data-place="parts"]`).click(); await sleep(400); await page.locator(`${dlg} .sw-row[data-row="exportOn"]`).click(); await sleep(400); await page.locator(`${dlg} .sw-opt[data-pick="exportOn"][data-val="false"]`).click(); await sleep(700); await shot('6-reload-to-apply', dlg); await page.locator(`${dlg} .sw-opt[data-pick="exportOn"][data-val="true"]`).click(); await sleep(500); await page.keyboard.press('Escape'); await sleep(400); }
  // 7 Relations' + under the pointer
  await go(page, 'Dr. Mei Chen', 2500);
  const plus = page.locator('#main-content-container .th-tw-add').first();
  if (await plus.count()) { await plus.hover(); await sleep(700); const row = await plus.evaluateHandle(e => e.closest('.th-tw-row')); const b = await row.asElement().boundingBox(); await page.screenshot({ path: path.join(out, '7-relations-plus.png'), clip: { x: b.x - 16, y: b.y - 12, width: b.width + 32, height: Math.min(160, b.height + 24) } }); console.log('took 7-relations-plus'); await page.mouse.move(5, 800); }
  const changed = differs(before, await fingerprint(page)).filter(c => !/^(Linked references|Unlinked references|All)?$/.test(c.words));
  console.log(changed.length ? `the graph changed: ${changed.slice(0, 3).map(c => c.what + ' ' + c.words).join('; ')}` : 'the graph is as it was');
  await browser.close();
})().catch(fail);
