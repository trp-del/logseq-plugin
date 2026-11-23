/* 0.5, the rest of the thread (the owner, 22 November 2026: "as simply as having to press `[[ ]]` twice then have to type `#` right
   after to add a tag to that page"; the tag list "Into the panel"; "viewing a node should pobably appear more inline"; "A different
   key for looking"). In the panel: Tab and Enter tag the bullet; words no page has make the page and link it, and the Undo takes both
   back. Option-L on a link opens its node under the line and Escape rolls it up with the bullet still in writing. Hyper with
   bullets selected tags them all, and one Undo takes the tag off them all. */
module.exports = {
  parts: ['find', 'predictive', 'threads', 'shared'],
  name: '0.5: the panel tags the bullet and makes a new page; Option-L opens a link under the line; Hyper tags selected bullets with one Undo',
  from: '22 Nov: 0.5, tag, new name, look, held',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const NAME = 'Guardfresh Roasters';
    const clean = () => f.evaluate(async name => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [?b :block/page _] [(clojure.string/includes? ?t "GUARDFIVE")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); const p = await logseq.Editor.getPage(name).catch(() => null); if (p) await logseq.Editor.deletePage(name).catch(() => {}); }, NAME);
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const hyper = async () => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await page.keyboard.down(k); await T.sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await page.keyboard.up(k); };
    const tagsOf = uuid => f.evaluate(async u => ((await logseq.DB.datascriptQuery(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?tg] [?tg :block/title ?t]]`)) || []).flat(), uuid);
    // Since 22 November 2026 a tap of Hyper on a line opens Logseq's own link list; Find's panel on a line is asked through the door, as its command does.
    const panel = () => f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().querySelector('.ls-block textarea') }); });
    const st = () => page.evaluate(() => { const d = document.querySelector('dialog[open].fd'); const t = document.querySelector('.ls-block textarea'); const h = document.querySelector('.fd-under'); return { panel: !!d, lines: d ? [...d.querySelectorAll('.fd-ch')].map(e => e.innerText.replace(/\s+/g, ' ')) : [], lit: d?.querySelector('.fd-r.on')?.textContent || '', foot: (d?.querySelector('.fd-foot')?.innerText || '').replace(/\s+/g, ' '), coming: [...document.querySelectorAll('.fd-coming')].map(e => e.textContent), editing: !!t, val: t?.value ?? null, under: !!h, filled: (h?.innerText || '').trim().length, selected: document.querySelectorAll('.ls-block.selected').length }; });
    const arrow = async key => { const a = await page.$(`[data-lk-undo^="${key}"]`); if (!a) return false; await a.click(); await T.sleep(2600); return true; };
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const ids = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Chase Checking'); const out = []; for (const w of ['GUARDFIVE paid the gas bill from Chase Checking $84 on Friday', 'GUARDFIVE lunch with Dana at', 'GUARDFIVE groceries $82.10', 'GUARDFIVE gas $51.30']) out.push((await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid); return out; });
    await T.sleep(800);

    // 1. Tag the bullet from the panel.
    await page.evaluate(u => window.logseq.api.edit_block(u), ids[0]); await T.sleep(800);
    await panel(); await T.sleep(2600); let s = await st();
    if (!s.panel || !/^tag this bullet /.test(s.lines[0] || '')) return no(`the panel has no “tag this bullet” line (lines: ${s.lines.join(' / ') || 'none'})`);
    await page.keyboard.press('Tab'); await T.sleep(700); s = await st();
    const tag = s.coming[0];
    if (!tag || !new RegExp('tag this bullet ' + tag + ' ↩').test(s.foot)) return no(`Tab did not light a tag to give (coming “${s.coming}”, foot “${s.foot}”)`);
    await page.keyboard.press('Enter'); await T.sleep(2200); s = await st();
    if (!(await tagsOf(ids[0])).includes(tag)) return no(`Enter did not tag the bullet ${tag}`);
    if (!s.editing) return no('the bullet left writing after it was tagged');
    await page.keyboard.press('Escape'); await T.sleep(500);

    // 2. A new name: the page is made and linked; its Undo takes the link out and drops the page.
    await page.evaluate(u => window.logseq.api.edit_block(u), ids[1]); await T.sleep(800);
    const before = await page.evaluate(() => document.querySelector('.ls-block textarea')?.value);
    await panel(); await T.sleep(1800);
    await page.keyboard.type(NAME, { delay: 40 }); await T.sleep(1800); s = await st();
    if (!s.lit.includes(NAME) || !new RegExp('make ' + NAME + '.* and link it ↩').test(s.foot)) return no(`a new name was not offered (lit “${s.lit.slice(0, 30)}”, foot “${s.foot}”)`);
    await page.keyboard.press('Enter'); await T.sleep(2600); s = await st();
    if (s.val !== `${before} [[${NAME}]]`) return no(`the new page was not linked at the caret (the bullet reads “${s.val}”)`);
    if (!(await f.evaluate(async n => !!(await logseq.Editor.getPage(n)), NAME))) return no('the new page was not made');
    if (!(await arrow('find:made'))) return no('no Undo was offered for the new page');
    await T.sleep(1200); s = await st();
    if (s.val !== before) return no(`the Undo did not take the link out (the bullet reads “${s.val}”)`);
    const gone = await f.evaluate(async n => { const r = await logseq.DB.datascriptQuery(`[:find ?p :where [?p :block/title "${n}"] (not [?p :logseq.property/deleted-at _])]`); return !(r || []).length; }, NAME);
    if (!gone) return no('the Undo left the new page in the graph');
    await page.keyboard.press('Escape'); await T.sleep(500);

    // 3. Option-L on a link: its node under the line; Escape rolls it up, the bullet still in writing.
    await f.evaluate(async u => logseq.Editor.updateBlock(u, 'GUARDFIVE paid the gas bill from [[Chase Checking]] on Friday'), ids[0]); await T.sleep(900);
    await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 'GUARDFIVE paid the gas bill from [[Chase Checking]]'.length }), ids[0]); await T.sleep(800);   // the caret just after the link
    await page.keyboard.press('Alt+l'); await T.sleep(2800); s = await st();
    if (!s.under || s.filled < 20) return no(`Option-L did not open the link's node under the line (holder ${s.under}, ${s.filled} letters)`);
    if (!s.editing) return no('the bullet left writing when the node opened');
    await page.keyboard.press('Escape'); await T.sleep(900); s = await st();
    if (s.under || !s.editing) return no(`Escape did not roll the node up with the bullet still in writing (holder ${s.under}, writing ${s.editing})`);
    await page.keyboard.press('Escape'); await T.sleep(500);

    // 4. Bullets held: one tag for all, one Undo for all.
    await page.evaluate(u => window.logseq.api.edit_block(u), ids[2]); await T.sleep(700);
    await page.keyboard.press('Escape'); await T.sleep(400); await page.keyboard.press('Shift+ArrowDown'); await T.sleep(500); s = await st();
    if (s.selected !== 2) return no(`two bullets could not be selected (${s.selected})`);
    await hyper(); await T.sleep(2000);
    await page.keyboard.type('purch', { delay: 60 }); await T.sleep(1800); s = await st();
    if (!/tag 2 bullets Purchase ↩/.test(s.foot) || s.coming.length !== 2) return no(`the held bullets were not offered Purchase (foot “${s.foot}”, coming ${s.coming.length})`);
    await page.keyboard.press('Enter'); await T.sleep(2600);
    const both = [await tagsOf(ids[2]), await tagsOf(ids[3])];
    if (!both.every(t => t.includes('Purchase'))) return no('Enter did not tag both held bullets');
    if (!(await arrow('find:held'))) return no('no Undo was offered for the held bullets');
    const after = [await tagsOf(ids[2]), await tagsOf(ids[3])];
    if (after.some(t => t.includes('Purchase'))) return no('one Undo did not take the tag off both bullets');
    return done({ ok: true, said: `tagged ${tag} from the panel; ${NAME} made, linked and undone; Option-L opened and closed; two held bullets tagged and untagged by one Undo` });
  },
};
