/* 22 November 2026, before 0.5 gives the Hyper key a panel: what the writing keys do today must still be so afterwards. A tap of
   Hyper while a grey page name shows takes the name (the owner, 22 Nov: "you would press the hyperkey first"; the plan keeps "a
   grey name showing: Hyper takes it"); Option-T opens the list of tags for the bullet; Option-P shows the proposals or says
   "Nothing to suggest" (the owner, 22 Nov: "how do i know if there are no suggestions after option-p rather than it didn't work"). */
module.exports = {
  parts: ['predictive', 'find', 'shared'],
  name: 'While writing: Hyper takes a grey name, Option-T lists the tags, Option-P answers',
  from: '22 Nov: 0.5, the writing keys must keep their jobs',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDWRITE")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const hyper = async () => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await page.keyboard.down(k); await T.sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await page.keyboard.up(k); };
    const value = () => page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' ? document.activeElement.value : null);
    await clean();
    await T.go(page, 'Northgate Cancer Center'); await T.sleep(1500);
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Northgate Cancer Center'); return (await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDWRITE ')).uuid; });
    await T.sleep(700);
    await page.evaluate(u => window.logseq.api.edit_block(u), uuid); await T.sleep(700);
    if ((await value()) == null) return no('the bullet could not be put in writing');

    // 1. A grey name, and a tap of Hyper.
    await page.keyboard.press('End'); await page.keyboard.type('saw Dr. Mei Ch', { delay: 70 }); await T.sleep(1600);
    const grey = await page.evaluate(() => document.querySelector('.flow-grey')?.textContent || '');
    if (!grey) return no('no grey name showed after “Dr. Mei Ch”');
    await hyper(); await T.sleep(900);
    let v = await value();
    if (!/\[\[Dr\. Mei Chen\]\]/.test(v || '')) return no(`a tap of Hyper did not take the grey name (the bullet reads “${v}”)`);
    if (await page.evaluate(() => !!document.querySelector('.flow-pick'))) return no('the tap took the name and opened the tag list as well');

    // 2. Option-T: the list of tags, closed by Escape with the bullet still in writing.
    await page.keyboard.type(' about the scan results', { delay: 40 }); await T.sleep(900);
    await page.keyboard.press('Alt+t'); await T.sleep(1500);
    const rows = await page.evaluate(() => document.querySelectorAll('.flow-pick .flow-pick-row').length);
    if (!rows) return no('Option-T did not open the list of tags');
    await page.keyboard.press('Escape'); await T.sleep(600);
    if (await page.evaluate(() => !!document.querySelector('.flow-pick'))) return no('Escape did not close the list of tags');
    if ((await value()) == null) return no('Escape on the list of tags left the bullet');

    // 3. Option-P: proposals, or the words "Nothing to suggest".
    await page.keyboard.press('Alt+p'); await T.sleep(1800);
    const answer = await page.evaluate(() => ({ ghosts: document.querySelectorAll('.flow-ghost').length, said: /Nothing to suggest/.test(document.body.innerText) }));
    if (!answer.ghosts && !answer.said) return no('Option-P showed neither a proposal nor “Nothing to suggest”');
    return done({ ok: true, said: `Hyper took “${grey}”, Option-T listed ${rows} tags, Option-P ${answer.ghosts ? 'showed ' + answer.ghosts + ' proposals' : 'said Nothing to suggest'}` });
  },
};
