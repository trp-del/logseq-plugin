/* The owner, 22 November 2026, of Find's small panel under the line: "look at the current find window that appears with hyper key.
   it is not well suited", then "i don't think find is right piece for the job"; asked which piece should open, they chose Logseq's
   own list. A tap of Hyper in a bullet opens the list Logseq shows after two [, with no bracket typed by hand: its typing and its
   Enter are Logseq's; Escape puts the line back exactly as it was, the caret where it stood; in the middle of a line the link goes
   where the caret is, and one Cmd+Z takes it back. */
module.exports = {
  parts: ['predictive', 'find', 'shared'],
  name: 'Hyper on a line opens Logseq’s own link list, not Find; Enter links at the caret with one Cmd+Z, Escape puts the line back',
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

    // In the middle of the line (moved here from the case of Find's panel, which held these while Hyper opened Find): Enter links
    // where the caret stands, the words after it kept, and one Cmd+Z takes the link back.
    await page.keyboard.press('Escape'); await T.sleep(600);
    await f.evaluate(async ({ u, w }) => { await logseq.Editor.updateBlock(u, w); }, { u: uuid, w: WORDS }); await T.sleep(700);
    await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 28 }), uuid); await T.sleep(800); s = await st();
    if (!s.editing || s.val !== WORDS || s.pos !== 28) return no(`the bullet could not be put back in writing mid-line (it reads “${s.val}”, caret at ${s.pos})`);
    await hyper(); await T.sleep(1200); s = await st();
    if (s.find || !s.list) return no('a tap of Hyper mid-line did not open Logseq’s own link list');
    await page.keyboard.type('amex g', { delay: 80 }); await T.sleep(1400);
    await page.keyboard.press('Enter'); await T.sleep(1200); s = await st();
    // Logseq's own Enter puts a space after the link when a word follows; that is Logseq's way, and kept.
    const mid = [WORDS.slice(0, 28) + '[[Amex Gold]]' + WORDS.slice(28), WORDS.slice(0, 28) + '[[Amex Gold]] ' + WORDS.slice(28)];
    if (!mid.includes(s.val)) return no(`Enter mid-line did not link at the caret (the bullet reads “${s.val}”)`);
    if (s.pos < 28 + '[[Amex Gold]]'.length || s.pos > 28 + '[[Amex Gold]] '.length) return no(`the caret is not right after the link mid-line (at ${s.pos})`);
    await page.keyboard.press('Meta+z'); await T.sleep(900); s = await st();
    if (s.val !== WORDS) return no(`one Cmd+Z did not take the link back (the bullet reads “${s.val}”)`);
    return done({ ok: true, said: 'Hyper opened Logseq’s list, Escape put the line back with the caret, Enter linked Amex Gold after a space and mid-line, one Cmd+Z took it back' });
  },
};
