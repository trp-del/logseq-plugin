/* 0.5, "you stay on your line" (the owner, 22 November 2026: "I want to be able to do actions quicker or edits, like through a more
   robust find, without losing context"; "that window opens and takes over majority of screen"; "you would press the hyperkey first").
   A tap of Hyper in a bullet opens Find as a small panel under the line: the bullet stays in writing, Enter links the lit row at the
   caret as one change Cmd+Z takes back, Escape puts the caret back exactly; Cmd K turns it into the window with the same letters. */
module.exports = {
  parts: ['find', 'predictive', 'shared'],
  name: '0.5: Find opens under the line; Enter links at the caret with one Cmd+Z; Escape returns the caret; Cmd K widens',
  from: '22 Nov: 0.5, the small panel',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDPANEL")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const hyper = async () => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await page.keyboard.down(k); await T.sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await page.keyboard.up(k); };
    // Since 22 November 2026 a tap of Hyper on a line opens Logseq's own link list (the owner: "i don't think find is right piece for the job");
    // the panel is still Find's, opened by its command, asked here through the door as the command does.
    const panel = () => f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().querySelector('.ls-block textarea') }); });
    const st = () => page.evaluate(() => { const d = document.querySelector('dialog[open].fd'); const t = document.querySelector('.ls-block textarea'); return { panel: !!d && d.classList.contains('fd-panel'), window: !!d && !d.classList.contains('fd-panel'), input: d?.querySelector('.fd-input')?.value ?? null, lit: d?.querySelector('.fd-r.on')?.textContent || '', foot: (d?.querySelector('.fd-foot')?.innerText || '').replace(/\s+/g, ' '), editing: !!t, val: t?.value ?? null, pos: t?.selectionStart ?? null, focus: document.activeElement?.tagName }; });
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDPANEL paid the gas bill from the account')).uuid; });
    await T.sleep(700);
    await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 29 }), uuid); await T.sleep(800);
    let s = await st();
    if (!s.editing || s.pos !== 29) return no('the bullet could not be put in writing at its place');
    const words = s.val;

    await panel(); await T.sleep(1800); s = await st();
    if (!s.panel) return no('the panel did not open under the line');
    if (!s.editing || s.val !== words) return no('the bullet left writing when the panel opened');
    if (s.focus !== 'INPUT') return no('the panel did not take the typing');
    await page.keyboard.type('amex', { delay: 60 }); await T.sleep(1600); s = await st();
    if (!/Amex Gold/.test(s.lit) || !/link Amex Gold ↩/.test(s.foot)) return no(`“amex” did not light Amex Gold to link (lit “${s.lit.slice(0, 30)}”, foot “${s.foot}”)`);
    await page.keyboard.press('Escape'); await T.sleep(700); s = await st();   // the letters first
    while (s.panel && s.input) { await page.keyboard.press('Escape'); await T.sleep(400); s = await st(); }
    if (s.panel) { await page.keyboard.press('Escape'); await T.sleep(700); s = await st(); }
    if (s.panel || !s.editing || s.val !== words || s.pos !== 29 || s.focus !== 'TEXTAREA') return no(`Escape did not put the caret back (writing ${s.editing}, at ${s.pos}, focus ${s.focus})`);

    await panel(); await T.sleep(1500);
    await page.keyboard.type('amex', { delay: 60 }); await T.sleep(1600);
    await page.keyboard.press('Enter'); await T.sleep(1200); s = await st();
    const linked = words.slice(0, 29) + '[[Amex Gold]]' + words.slice(29);
    if (s.panel || s.val !== linked) return no(`Enter did not link at the caret (the bullet reads “${s.val}”)`);
    if (s.pos !== 29 + '[[Amex Gold]]'.length) return no(`the caret is not right after the link (at ${s.pos})`);
    await page.keyboard.press('Meta+z'); await T.sleep(900); s = await st();
    if (s.val !== words) return no(`one Cmd+Z did not take the link back (the bullet reads “${s.val}”)`);

    await panel(); await T.sleep(1500);
    await page.keyboard.type('amex', { delay: 60 }); await T.sleep(1200);
    await page.keyboard.press('Meta+k'); await T.sleep(1500); s = await st();
    if (!s.window || s.input !== 'amex') return no(`Cmd K did not open the window with the same letters (window ${s.window}, line “${s.input}”)`);
    return done({ ok: true, said: 'opened under the line, linked at the caret, undone by one Cmd+Z, the caret back on Escape, widened by Cmd K' });
  },
};
