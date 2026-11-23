/* The hand test of 23 November 2026: "the small Find panel for one line … has no way in by hand in this build": Hyper opens Logseq's
   own list, and the command "Find: link from here" answered "Put the cursor in a bullet first", since the palette takes the caret.
   The owner, the same day: "Give it its own key". The small Find under the line has a key of its own, a setting shown on the key
   sheet, free in Logseq's live list and among the plugin's own keys, with a modifier (no single letter). Pressed in a bullet being
   written it opens the panel under the line, the caret kept; pressed again it closes it; in a sidebar bullet too. The command from
   the palette opens it on the bullet that was being written. */
module.exports = {
  parts: ['find', 'look', 'shared'],
  name: '0.5: the small Find under the line has its own key, free among Logseq’s and the plugin’s; the palette command opens it too',
  from: '23 Nov: "Give it its own key"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDOWNKEY")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    const st = () => page.evaluate(() => { const d = document.querySelector('dialog[open].fd'); const a = document.activeElement; const t = document.querySelector('.ls-block textarea');
      return { panel: !!d && d.classList.contains('fd-panel'), editing: !!t, val: t?.value ?? null, pos: t?.selectionStart ?? null, focus: a?.tagName, side: !!t?.closest('#right-sidebar, .cp__right-sidebar'), block: t?.closest('.ls-block')?.getAttribute('blockid') || null,
        within: d ? (() => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })() : null }; });

    // 1. The key: a setting, on the key sheet's list, free in the live list, with a modifier.
    const key = await f.evaluate(() => {
      const D = window.PluginDoor, schema = D.modules.flatMap(m => m.schema || []), read = D.settingReader(() => schema);
      const item = schema.find(i => i.key === 'panelKeys');
      if (!item) return { none: true };
      const mine = String(read('panelKeys') || ''), mark = D.keyMarks(mine);
      const logseq = D.logseqCommands().flatMap(c => String(c?.shortcut || '').split(' | ').map(s => [D.keyMarks(s.trim()), String(c.id)])).filter(([m]) => m);
      const own = schema.filter(i => /Keys$/.test(i.key) && i.key !== 'panelKeys').map(i => [D.keyMarks(String(read(i.key) || '')), i.key]);
      const told = ['find', 'look.focus'].flatMap(part => Object.entries(D.keys.told(part) || {}).map(([name, spec]) => [D.keyMarks(spec), part + ' ' + name]));
      const taken = [...logseq, ...own, ...told].filter(([m]) => m === mark).map(([, who]) => who);
      return { mine, mark, taken, logseqCount: logseq.length };
    });
    if (key.none || !key.mine) return no('the small Find under the line has no key of its own (no setting panelKeys)');
    if (!/^(mod|alt|ctrl|shift|meta|cmd)\+/.test(key.mine)) return no(`its key “${key.mine}” has no modifier: a single letter is no command`);
    if (key.logseqCount < 50) return no('Logseq’s live list of keys could not be read');
    if (key.taken.length) return no(`its key ${key.mark} is already used by ${key.taken.join(', ')}`);
    // The key as pressed keys: "alt+k" is Alt held and the K key.
    const parts = key.mine.split('+'), last = parts.pop();
    const MOD = { mod: 'Meta', meta: 'Meta', cmd: 'Meta', alt: 'Alt', ctrl: 'Control', shift: 'Shift' };
    const code = /^[a-z]$/.test(last) ? 'Key' + last.toUpperCase() : /^\d$/.test(last) ? 'Digit' + last : ({ ';': 'Semicolon', ',': 'Comma', '.': 'Period', '/': 'Slash', "'": 'Quote', space: 'Space', enter: 'Enter' })[last] || last;
    const press = async () => { for (const m of parts) await page.keyboard.down(MOD[m]); await page.keyboard.press(code); for (const m of parts.reverse()) await page.keyboard.up(MOD[m]); parts.reverse(); };

    // 2. In a bullet being written on the page: the panel under the line, the caret kept, nothing typed into the line.
    await clean();
    await T.go(page, 'Chase Checking'); await T.sleep(1500);
    const WORDS = 'GUARDOWNKEY paid the gas bill from the account';
    const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Chase Checking'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, WORDS);
    await T.sleep(700);
    await page.evaluate(u => { document.querySelector(`.ls-block[blockid="${u}"]`)?.scrollIntoView({ block: 'center' }); return window.logseq.api.edit_block(u, { pos: 30 }); }, uuid); await T.sleep(800);
    let s = await st();
    if (!s.editing || s.pos !== 30) return no('the bullet could not be put in writing at its place');
    await press(); await T.sleep(1600); s = await st();
    if (!s.panel) return no(`the key ${key.mark} pressed in a bullet being written did not open the panel under the line`);
    if (!s.editing || s.val !== WORDS) return no(`the line changed when the key was pressed (it reads “${s.val}”)`);
    if (s.focus !== 'INPUT') return no('the panel did not take the typing');
    // The key again: the panel closes and the caret is where it was.
    await press(); await T.sleep(900); s = await st();
    if (s.panel || !s.editing || s.val !== WORDS || s.pos !== 30 || s.focus !== 'TEXTAREA') return no(`the key again did not close the panel with the caret back (panel ${s.panel}, writing ${s.editing}, at ${s.pos}, focus ${s.focus})`);
    // And Enter links at the caret.
    await press(); await T.sleep(1500);
    await page.keyboard.type('amex', { delay: 60 }); await T.sleep(1600);
    await page.keyboard.press('Enter'); await T.sleep(1200); s = await st();
    const linked = WORDS.slice(0, 30) + '[[Amex Gold]]' + WORDS.slice(30);
    if (s.panel || s.val !== linked) return no(`Enter did not link at the caret (the bullet reads “${s.val}”)`);
    await page.keyboard.press('Meta+z'); await T.sleep(900); s = await st();
    if (s.val !== WORDS) return no(`one Cmd+Z did not take the link back (the bullet reads “${s.val}”)`);

    // 3. The command from the palette, which takes the caret: the panel opens on the bullet that was being written.
    await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 30 }), uuid); await T.sleep(700);
    await page.keyboard.press('ArrowLeft'); await T.sleep(200);   // a key of the hand's own, as in writing: the caret at 29
    await page.keyboard.press('Meta+Shift+p'); await T.sleep(900);
    await page.keyboard.type('Find: link from here', { delay: 30 }); await T.sleep(1200);
    await page.keyboard.press('Enter'); await T.sleep(2200); s = await st();
    if (!s.panel) return no('the command “Find: link from here” from the palette did not open the panel on the bullet that was being written');
    if (s.block !== uuid) return no('the palette command opened the panel on another bullet');
    await page.keyboard.press('Escape'); await T.sleep(900); s = await st();
    if (s.panel || !s.editing || s.pos !== 29 || s.val !== WORDS) return no(`after the palette command, Escape did not put the caret back (writing ${s.editing}, at ${s.pos})`);
    await page.keyboard.press('Escape'); await T.sleep(300);

    // 4. In a bullet of the right sidebar, at the owner's 700 px: the panel under that bullet, inside the window.
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    await T.go(page, 'Amex Gold'); await T.sleep(1200);
    await T.inSidebar(box, 'Chase Checking'); await T.sleep(1500);
    const SIDE_BULLET = u => `#right-sidebar .ls-block[blockid="${u}"] .block-content, .cp__right-sidebar .ls-block[blockid="${u}"] .block-content`;
    const shown = await page.evaluate(sel => { const b = document.querySelector(sel); if (!b) return false; b.scrollIntoView({ block: 'center' }); return true; }, SIDE_BULLET(uuid));
    if (!shown) return no('the bullet did not show in the right sidebar');
    // Pressed on its words once it has come to rest, as a click there does; a second press if the first only woke the sidebar.
    for (let tries = 0; tries < 2; tries++) {
      await T.sleep(500);
      const at = await page.evaluate(sel => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + 30, r.top + Math.min(r.height / 2, 12)]; }, SIDE_BULLET(uuid));
      if (!at) return no('the bullet did not show in the right sidebar');
      await page.mouse.click(at[0], at[1]); await T.sleep(700);
      s = await st(); if (s.editing && s.side) break;
    }
    await page.keyboard.press('End'); await T.sleep(200); s = await st();
    if (!s.editing || !s.side) return no('the sidebar bullet could not be put in writing');
    await press(); await T.sleep(1600); s = await st();
    if (!s.panel) return no(`the key ${key.mark} pressed in a sidebar bullet did not open the panel`);
    if (!s.side || s.val !== WORDS) return no('the sidebar bullet left writing, or changed, when the key was pressed');
    if (!s.within) return no('the panel under the sidebar bullet runs past the window');
    const end = s.pos; await press(); await T.sleep(900); s = await st();
    if (s.panel || !s.side || s.pos !== end || s.focus !== 'TEXTAREA') return no('the key again in the sidebar did not close the panel with the caret back');
    return done({ ok: true, said: `the key ${key.mark} is free of Logseq’s ${key.logseqCount} keys and the plugin’s; it opened and closed the panel on the page and in the sidebar, the caret kept; Enter linked; the palette command opened it on the bullet that was being written` });
  },
};
