/* The owner, 22 November 2026, of Find's small panel under the line: "look at the current find window that appears with hyper key.
   it is not well suited", then "i don't think find is right piece for the job"; asked which piece should open, they chose Logseq's
   own list. A tap of Hyper in a bullet opens the list Logseq shows after two [, with no bracket typed by hand: its typing and its
   Enter are Logseq's; Escape puts the line back exactly as it was, the caret where it stood. */
module.exports = {
  parts: ['predictive', 'find', 'shared'],
  name: 'Hyper on a line opens Logseq’s own link list, not Find; Enter links, Escape puts the line back',
  from: '22 Nov: "i don\'t think find is right piece for the job"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDLIST")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const hyper = async () => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await page.keyboard.down(k); await T.sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await page.keyboard.up(k); };
    const st = () => page.evaluate(() => { const t = document.querySelector('.ls-block textarea'); return { find: !!document.querySelector('dialog[open].fd'), list: !!document.querySelector('[data-editor-popup-ref="page-search"]'), editing: !!t, val: t?.value ?? null, pos: t?.selectionStart ?? null, focus: document.activeElement?.tagName }; });
    const WORDS = 'GUARDLIST paid the gas bill from';
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, WORDS);
    await T.sleep(700);
    await page.evaluate(u => { document.querySelector(`.ls-block[blockid="${u}"]`)?.scrollIntoView({ block: 'center' }); return window.logseq.api.edit_block(u, { pos: 32 }); }, uuid); await T.sleep(800);
    let s = await st();
    if (!s.editing || s.pos !== WORDS.length) return no('the bullet could not be put in writing at its end');

    await hyper(); await T.sleep(1200); s = await st();
    if (s.find) return no('a tap of Hyper on a line still opens Find’s panel');
    if (!s.list) return no('a tap of Hyper did not open Logseq’s own link list');
    if (s.focus !== 'TEXTAREA') return no('the typing left the line when the list opened');
    await page.keyboard.type('am', { delay: 80 }); await T.sleep(900);
    await page.keyboard.press('Escape'); await T.sleep(900); s = await st();
    if (s.list) { await page.keyboard.press('Escape'); await T.sleep(700); s = await st(); }
    if (!s.editing || s.val !== WORDS || s.pos !== WORDS.length) return no(`Escape did not put the line back (it reads “${s.val}”, caret at ${s.pos}, writing ${s.editing})`);

    await hyper(); await T.sleep(1200);
    await page.keyboard.type('amex g', { delay: 80 }); await T.sleep(1400);
    await page.keyboard.press('Enter'); await T.sleep(1200); s = await st();
    if (s.val !== WORDS + ' [[Amex Gold]]') return no(`Enter did not link the page after a space (the bullet reads “${s.val}”)`);
    if (s.pos !== s.val.length) return no(`the caret is not right after the link (at ${s.pos})`);
    return done({ ok: true, said: 'Hyper opened Logseq’s list, Escape put the line back with the caret, Enter linked Amex Gold after a space' });
  },
};
