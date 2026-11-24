/* The owner, 24 November 2026, of the box that stood under the bar after "Move up a level" ("Move Testing up a level, out from under
   Continuant", five lines, "nothing is lost", a yes and a no), sent as a picture: "This is confusing". A move loses nothing, so it
   is written at once with its Undo (the owner, 5 November 2026: "I don't want to have to accept every minor change"). Right-click
   Budget, Move up a level: no box asks, Budget stands under its parent's parent, and the Undo arrow puts it back. */
module.exports = {
  parts: ['structure'],
  name: 'Ontology: Move up a level moves the tag at once, no box, and Undo puts it back',
  from: '24 Nov: "This is confusing"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const parent = () => f.evaluate(async () => ((await logseq.DB.datascriptQuery('[:find ?pt :where [?t :block/title "Budget"] [?t :logseq.property.class/extends ?p] [?p :block/title ?pt]]')) || []).flat().join(', '));
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    const was = await parent();
    if (was !== 'Financial Document') return { ok: false, said: `Budget sits under “${was}” before the move, not under Financial Document` };
    const name = await page.evaluateHandle(() => [...document.querySelectorAll('#main-content-container .nm')].find(e => e.textContent.trim() === 'Budget') || null);
    if (!name.asElement()) return { ok: false, said: 'Budget is not in Ontology\'s map' };
    let r = await name.asElement().boundingBox();
    await page.mouse.click(r.x + 10, r.y + r.height / 2, { button: 'right' }); await T.sleep(800);
    const item = await page.evaluateHandle(() => [...document.querySelectorAll('.st-menu .lk-item')].find(e => /^Move up a level/.test(e.innerText.trim())) || null);
    if (!item.asElement()) return { ok: false, said: 'no Move up a level in Budget\'s menu' };
    r = await item.asElement().boundingBox(); await page.mouse.click(r.x + 30, r.y + r.height / 2); await T.sleep(2500);
    const asked = await page.evaluate(() => document.querySelector('#main-content-container .st-q')?.innerText.replace(/\s+/g, ' ').slice(0, 70) || '');
    const now = await parent();
    // Put back whatever happened, by the Undo arrow when the move was written, by leaving the box when it asked.
    let undone = false;
    if (asked) { const leave = await page.$('#main-content-container .st-q [data-leave]'); if (leave) await leave.click(); else await page.keyboard.press('Escape'); await T.sleep(500); }
    else { const arrow = await page.$('.st-tray .lk-undo, [data-lk-undo^="structure"]'); if (arrow) { await arrow.click(); await T.sleep(800); const yes = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => /^Undo (it|all)/.test(e.textContent.trim())) || null); if (yes.asElement()) { await yes.asElement().click(); await T.sleep(2500); undone = true; } } }
    const after = await parent();
    if (after !== 'Financial Document') await f.evaluate(async () => { const one = async t => ((await logseq.DB.datascriptQuery(`[:find (pull ?t [:block/uuid :db/id]) :where [?t :block/title "${t}"] [?t :block/tags ?c] [?c :db/ident :logseq.class/Tag]]`)) || []).flat()[0]; const b = await one('Budget'), fd = await one('Financial Document'); if (b && fd) await logseq.Editor.upsertBlockProperty(b.uuid, 'logseq.property.class/extends', [fd.id]).catch(() => {}); });
    if (asked) return { ok: false, said: `Move up a level opened a box that asks first (“${asked}”)` };
    if (now !== 'Continuant') return { ok: false, said: `after Move up a level Budget sits under “${now}”, not Continuant` };
    if (!undone) return { ok: false, said: 'the move left no Undo arrow to press' };
    if (after !== 'Financial Document') return { ok: false, said: `Undo left Budget under “${after}”, not back under Financial Document` };
    return { ok: true, said: 'Budget moved under Continuant at once, no box; Undo put it back under Financial Document' };
  },
};
